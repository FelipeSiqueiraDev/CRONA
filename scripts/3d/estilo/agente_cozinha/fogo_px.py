"""
O fogo da lareira em pixel art, desenhado no espaço da tela depois do acabamento (contorno incluído).

desenhar_fogo(cor, c, t) devolve a nova `cor` (h, w, 3, float):
  1. o fundo da boca: a boca é só uma face plana na frente da base; cada pixel dela solta um raio para dentro
     (contra a câmera) e acha o que veria numa caixa funda: a parede do fundo com fuligem e tijolo, a parede da
     esquerda (a de dentro, que a câmera vê) e o chão de cinza com as brasas; tudo aceso pelo fogo em degraus;
  2. as toras: cilindros achados pelo mesmo raio, com casca em degraus, a quina de cima acesa pelo fogo e as pontas
     da frente em brasa (anel de carvão, laranja e o miolo amarelo);
  3. as chamas: línguas (gotas) aninhadas na tela, cinco tons do vermelho-escuro ao miolo quase branco, sem
     contorno, com a borda limpa (sem pixel solto) e o balanço do loop `t` (0..1);
  4. as fagulhas e as lambidas soltas que sobem;
  5. a luz do fogo nos arredores: anéis em degraus pela distância 3D de `c.mundoP` ao fogo (só na frente da boca),
     então quem está longe ou atrás não ganha luz errada.

A geometria da boca vem de `c.fogo_geo` (se a cena der), senão do padrão da lareira da sala 3.
"""
import math
import numpy as np

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'codigo'))
from motor import tela, VISTA, ruido  # noqa: E402

TAU = 2 * math.pi


def hx(h):
    h = h.lstrip('#')
    return np.array([int(h[i:i + 2], 16) for i in (0, 2, 4)], float)


def paleta(*cs):
    return np.stack([hx(x) for x in cs])


# as chamas: 1 vermelho-escuro (a borda) .. 5 o miolo quase branco
CHAMA = paleta('#9c2a1c', '#d8501e', '#f58a26', '#ffc643', '#fff3c4')
# o fundo e a parede de dentro: da fuligem ao tijolo aceso
FUNDO = paleta('#140b0a', '#1f100c', '#30160e', '#4a1e10', '#6e2c12', '#984016')
# o chão de dentro: a cinza e as brasas
CINZA = paleta('#1e120e', '#33190f', '#4a2414')
BRASA = paleta('#7a2412', '#c8461a', '#f4842a', '#ffd060')
# as toras: casca no escuro .. a quina acesa
CASCA = paleta('#24150e', '#3e2614', '#5c381e', '#7e4c26', '#b4642a', '#e88a34')
PONTA = paleta('#2a1710', '#5a2614', '#d2541c', '#f99a2e', '#ffd968')

GEO = dict(m=2.92, bw=0.42, z0=0.12, zt=0.88, chanfro=0.08, yb=0.722, fundo=0.24)


def _tela(c, Q):
    s = tela(np.asarray(Q, float))
    return s[..., 0] - c.x0, s[..., 1] - c.y0


def _viz(a, dy, dx, fill):
    h, w = a.shape[:2]
    out = np.full_like(a, fill)
    ys = slice(max(0, dy), h + min(0, dy))
    yd = slice(max(0, -dy), h + min(0, -dy))
    xs = slice(max(0, dx), w + min(0, dx))
    xd = slice(max(0, -dx), w + min(0, -dx))
    out[yd, xd] = a[ys, xs]
    return out


def _mascara_boca(c, g):
    if getattr(c, 'boca', None) is not None:
        return c.obj == c.boca
    P = c.mundoP
    X, Y, Z = P[..., 0], P[..., 1], P[..., 2]
    return ((np.abs(Y - g['yb']) < 0.004) & (np.abs(X - g['m']) <= g['bw'] + 1e-3) & (Z >= g['z0'] - 1e-3) & (Z <= g['zt'] + 1e-3)
            & (np.abs(c.nrm[..., 1] - 1) < 1e-3))


def _toras(g):
    """As toras: (a, b, raio, ponta em brasa em a?, em b?). Em metros, dentro da caixa da boca."""
    m, yb, z0, F = g['m'], g['yb'], g['z0'], g['fundo']
    yf = yb - F              # a parede do fundo
    return [
        # a de trás, deitada ao longo da boca (a ponta da direita fica escondida pelo batente)
        (np.array([m - 0.40, yf + 0.07, z0 + 0.055]), np.array([m + 0.30, yf + 0.07, z0 + 0.055]), 0.055, False, False),
        # a da frente, deitada quase ao longo da boca, com a ponta da direita (virada para a câmera) em brasa
        (np.array([m - 0.38, yb - 0.13, z0 + 0.05]), np.array([m + 0.27, yb - 0.06, z0 + 0.05]), 0.05, False, True),
        # a de cima, cruzada sobre as duas, com a ponta da frente em brasa
        (np.array([m + 0.02, yb - 0.03, z0 + 0.125]), np.array([m - 0.30, yf + 0.04, z0 + 0.2]), 0.045, True, False),
    ]


def _raio(P0, g):
    """Do ponto na face da boca, o raio para dentro: a distância até a parede, o tipo dela e o ponto."""
    d = -VISTA
    m, bw, z0, yb, F = g['m'], g['bw'], g['z0'], g['yb'], g['fundo']
    s_fundo = (P0[:, 1] - (yb - F)) / -d[1]
    s_esq = (P0[:, 0] - (m - bw)) / -d[0]
    s_chao = (P0[:, 2] - z0) / -d[2]
    S = np.stack([s_fundo, s_esq, s_chao], 1)
    S = np.where(S < 0, 1e9, S)
    k = S.argmin(1)
    s = S[np.arange(len(S)), k]
    return s, k


def _toras_hit(P0, toras, s_max):
    """Marcha o raio pelas toras (cilindros de ponta cortada): a distância, qual tora, a normal e se é a ponta."""
    d = -VISTA
    n = len(P0)
    s_hit = np.full(n, 1e9)
    qual = np.full(n, -1)
    ponta = np.zeros(n, bool)
    lado_b = np.zeros(n, bool)
    rho = np.zeros(n)
    nrm = np.zeros((n, 3))
    hpos = np.zeros(n)
    passo = 0.002
    for s in np.arange(0, 0.8, passo):
        viva = (qual < 0) & (s < s_max)
        if not viva.any():
            break
        Q = P0 + s * d
        for i, (a, b, r, _, _) in enumerate(toras):
            ax = b - a
            L = np.linalg.norm(ax)
            ax = ax / L
            v = Q - a
            hh = v @ ax
            rad = v - hh[:, None] * ax
            rr = np.linalg.norm(rad, axis=1)
            dentro = viva & (qual < 0) & (rr < r) & (hh > 0) & (hh < L)
            if dentro.any():
                s_hit[dentro] = s
                qual[dentro] = i
                # a ponta: entrou pela tampa (perto de h = 0 ou h = L) e não pela casca
                na_ponta = dentro & ((hh < passo * 1.6) | (hh > L - passo * 1.6)) & (rr < r * 0.97)
                ponta[na_ponta] = True
                lado_b[dentro] = hh[dentro] > L / 2
                rho[dentro] = rr[dentro] / r
                hpos[dentro] = hh[dentro]
                nn = rad[dentro] / np.maximum(rr[dentro], 1e-6)[:, None]
                nrm[dentro] = nn
    return s_hit, qual, ponta, lado_b, rho, nrm, hpos


def _gota(sx, sy, bx, by, w, hgt):
    """A língua de fogo: 1 no eixo, 0 na borda, < 0 fora. A ponta fina em cima e a base redonda."""
    v = (by - sy) / hgt
    r = (np.clip(1 - v, 0, 1) ** 1.25) * np.sqrt(np.clip((v + 0.22) / 0.36, 0, 1)) * (w / 2) * 1.12
    u = np.abs(sx - bx)
    return np.where(r > 0.35, 1 - u / np.maximum(r, 1e-6), -1.0)


def _limpar(nivel, passes=2):
    """Nada de pixel solto: o pico ou o buraco de 1 px vira o tom dos vizinhos; a pontinha de 1 px sozinha some."""
    for _ in range(passes):
        viz = np.stack([_viz(nivel, dy, dx, 0) for dy, dx in ((0, 1), (1, 0), (0, -1), (-1, 0))])
        mx, mn = viz.max(0), viz.min(0)
        nivel = np.where(nivel > mx, mx, nivel)
        nivel = np.where((nivel < mn), mn, nivel)
        # um tom que não encosta em nenhum vizinho do mesmo tom ou mais alto vira o vizinho mais parecido
        iguais = (viz >= nivel[None]).sum(0)
        so = (nivel > 0) & (iguais == 0)
        nivel = np.where(so, mx, nivel)
        # a borda de 1 px (só 1 vizinho aceso, e na diagonal nada) é cortada
        acesos = (viz > 0).sum(0)
        nivel = np.where((nivel > 0) & (acesos <= 1), 0, nivel)
    return nivel


def _sem_pixel_solto(img, mask, passes=2):
    """
    Dentro da boca: o pixel cuja cor não aparece em nenhum dos 8 vizinhos (o ruído de 1 px) vira a cor mais comum
    entre os 4 vizinhos de lado (se ela aparece em pelo menos 2). A diagonal conta como vizinha: a escadinha de 1 px
    da borda fica.
    """
    for _ in range(passes):
        k = np.round(img).astype(np.int64)
        k = k[..., 0] * 65536 + k[..., 1] * 256 + k[..., 2]
        igual = np.zeros(k.shape, bool)
        for dy in (-1, 0, 1):
            for dx in (-1, 0, 1):
                if dy or dx:
                    igual |= _viz(k, dy, dx, -1) == k
        lados = np.stack([_viz(k, dy, dx, -1) for dy, dx in ((0, 1), (1, 0), (0, -1), (-1, 0))])
        conta = np.stack([(lados == lados[i]).sum(0) for i in range(4)])
        melhor = conta.argmax(0)
        moda = np.take_along_axis(lados, melhor[None], 0)[0]
        troca = mask & ~igual & (conta.max(0) >= 2) & (moda >= 0)
        if not troca.any():
            break
        ys, xs = np.nonzero(troca)
        alvo = moda[ys, xs]
        img = img.copy()
        img[ys, xs] = np.stack([alvo // 65536, (alvo // 256) % 256, alvo % 256], 1).astype(float)
    return img


def _chamas(sx, sy, bx, by, t):
    """O mapa de tons das chamas (0 nada, 1..5) em volta da base (bx, by) da tela, no instante t."""
    nivel = np.zeros(sx.shape, int)
    # (deslocamento x, largura, altura, tom máximo, fase, frequência do balanço, quanto a ponta abre para fora)
    linguas = [
        (0.0, 13.0, 23.0, 5, 0.00, 1, 0.0),
        (-5.5, 9.0, 16.0, 4, 0.31, 2, -1.5),
        (5.5, 9.0, 14.0, 4, 0.62, 1, 1.5),
        (-9.0, 6.0, 9.0, 3, 0.15, 2, -1.0),
        (9.0, 6.0, 8.0, 3, 0.74, 1, 1.0),
    ]
    # o tamanho de cada tom por dentro: (largura, altura, subida da base)
    tons = [(1.0, 1.0, 0.0), (0.8, 0.84, 0.5), (0.62, 0.68, 1.0), (0.44, 0.5, 1.4), (0.24, 0.3, 1.8)]
    for (dx, w, hgt, tmax, fase, fr, abre) in linguas:
        a = TAU * (fr * t + fase)
        hh = hgt * (1 + 0.13 * math.sin(a) + 0.06 * math.sin(2 * a + 1.3))
        ww = w * (1 + 0.05 * math.cos(a + 0.7))
        v = np.clip((by - sy) / hh, 0, 1)
        # o balanço: a ponta vai mais longe que a base (e dobra um pouco, como labareda)
        bal = (abre * v ** 1.5 + 1.6 * math.sin(a + 0.4) * v ** 1.6 + 0.6 * np.sin(2 * a + 2.0 + 5 * v) * v ** 2) * (hh / 18)
        for k, (fw, fh, sobe) in enumerate(tons[:tmax]):
            f = _gota(sx - bal, sy, bx + dx, by - sobe, ww * fw, hh * fh)
            nivel = np.where(f > 0, np.maximum(nivel, k + 1), nivel)
    return nivel


def _soltas(sx, sy, bx, by, t):
    """As lambidas que se soltam das pontas e sobem encolhendo (2 x 3 px, vermelho e laranja)."""
    nivel = np.zeros(sx.shape, int)
    for (dx, topo, fase, fr) in ((-1.0, 21, 0.1, 1), (4.5, 16, 0.55, 1), (-5.0, 15, 0.8, 2)):
        q = (fr * t + fase) % 1
        if q > 0.75:
            continue
        cy = by - topo - 1 - q * 7
        cx = bx + dx + 1.2 * math.sin(TAU * q)
        tam = 1 - q / 0.75
        f = _gota(sx, sy, cx, cy + 2.2 * tam, 3.2 * tam + 1.6, 4.5 * tam + 1.8)
        nivel = np.where(f > 0, np.where(f > 0.55, 2, 1), nivel)
    return nivel


def desenhar_fogo(cor, c, t=0.0, geo=None):
    g = dict(GEO)
    g.update(getattr(c, 'fogo_geo', None) or {})
    if geo:
        g.update(geo)
    m, bw, z0, zt, yb, F = g['m'], g['bw'], g['z0'], g['zt'], g['yb'], g['fundo']
    cor = cor.copy()
    h, w = c.obj.shape
    boca = _mascara_boca(c, g)
    ii, jj = np.nonzero(boca)
    sx, sy = jj + 0.5, ii + 0.5

    # o centro do fogo (a luz) e o pulso dela no loop
    centro = np.array([m - 0.05, yb - F * 0.5, z0 + 0.2])
    pulso = 1 + 0.05 * math.sin(TAU * t) + 0.03 * math.sin(TAU * 3 * t + 0.8)

    # ---------- 1. o fundo da boca ----------
    P0 = c.mundoP[ii, jj]
    s_par, k_par = _raio(P0, g)
    toras = _toras(g)
    s_tor, qual, ponta, lado_b, rho, n_tor, hpos = _toras_hit(P0, toras, s_par)
    tora = s_tor < s_par
    s_sup = np.where(tora, s_tor, s_par)
    Q = P0 - s_sup[:, None] * VISTA

    dist = np.linalg.norm(Q - centro, axis=1) / pulso
    out = np.zeros((len(ii), 3))
    # a parede do fundo e a da esquerda: fuligem em cima, tijolo aceso perto do fogo (em degraus)
    # a fuligem: o alto da boca escurece
    luz = np.clip(1 - dist / 0.72, 0, 1) * np.clip(1.3 - (Q[:, 2] - z0) / 0.55, 0.35, 1.0)
    par = ~tora & (k_par != 2)
    # a parede da esquerda olha para o fogo: um degrau a mais
    deg = np.floor(luz * 6.0).astype(int) + np.where(k_par == 1, 1, 0)
    # o tijolo: fiadas de 0,09 m, juntas 1 tom abaixo (só aparece onde a luz chega)
    a_coord = np.where(k_par == 1, Q[:, 1], Q[:, 0])
    fila = np.floor((Q[:, 2] - z0) / 0.09)
    gb = ((Q[:, 2] - z0) / 0.09) % 1
    ga = ((a_coord + (fila % 2) * 0.1) / 0.2) % 1
    junta = np.zeros_like(gb, bool)
    deg = deg - np.where(junta & (deg >= 2) & (deg <= 4), 1, 0)
    deg = np.clip(deg, 0, len(FUNDO) - 1)
    out[par] = FUNDO[deg[par]]

    # o chão de dentro: a cinza e as brasas em manchas (células de 0,06 m, nada de pixel solto)
    chao = ~tora & (k_par == 2)
    if chao.any():
        cxq, cyq = Q[chao, 0], Q[chao, 1]
        ci, cj = np.floor(cxq / 0.055), np.floor((cyq + 0.5 * np.floor(cxq / 0.055) * 0.055) / 0.045)
        r0 = ruido(ci, cj, 7.0)
        cint = np.clip(1 - dist[chao] / 0.5, 0, 1)
        # a brasa pisca no loop, cada célula no seu tempo
        pis = 0.5 + 0.5 * np.sin(TAU * (t * 2 + ruido(ci, cj, 3.0)))
        calor = cint * (0.55 + 0.45 * r0) + 0.18 * pis * cint
        bk = np.floor(calor * 4.6).astype(int) - 1
        cin = np.clip(np.floor(cint * 3).astype(int), 0, 2)
        oc = np.where((bk >= 0)[:, None], BRASA[np.clip(bk, 0, 3)], CINZA[cin])
        out[chao] = oc

    # ---------- 2. as toras ----------
    if tora.any():
        idx = np.nonzero(tora)[0]
        nn = n_tor[idx]
        Qt = Q[idx]
        para_fogo = centro - Qt
        para_fogo /= np.linalg.norm(para_fogo, axis=1, keepdims=True)
        lf = np.clip((nn * para_fogo).sum(1), 0, 1)
        perto = np.clip(1 - np.linalg.norm(Qt - centro, axis=1) / (0.55 * pulso), 0, 1)
        # o volume da tora como no pixel art: o pixel de cima da silhueta claro (a quina acesa pelo fogo, que fica
        # atrás e em cima), o corpo no meio, o de baixo escuro; a ponta é tratada à parte
        tm = np.full((h, w), -1)
        tm[ii[idx], jj[idx]] = qual[idx] * 2 + ponta[idx]
        acima = _viz(tm, -1, 0, -1)[ii[idx], jj[idx]]
        acima2 = _viz(tm, -2, 0, -1)[ii[idx], jj[idx]]
        abaixo = _viz(tm, 1, 0, -1)[ii[idx], jj[idx]]
        eu = tm[ii[idx], jj[idx]]
        dg = np.full(len(idx), 2)
        dg = np.where(abaixo != eu, 1, dg)
        dg = np.where(acima2 != eu, 3, dg)
        dg = np.where((acima != eu) & (perto > 0.15), 4, np.where(acima != eu, 3, dg))
        dg = np.where((acima != eu) & (perto > 0.45) & (lf > 0.3), 5, dg)
        dg = np.clip(dg, 0, len(CASCA) - 1)
        oc = CASCA[dg]
        # a ponta em brasa (anel de carvão por fora, laranja, o miolo amarelo); a outra, madeira cortada
        pt = ponta[idx]
        em_brasa = np.array([toras[q][4] if lb else toras[q][3] for q, lb in zip(qual[idx], lado_b[idx])], bool)
        brilho_p = 0.5 + 0.5 * math.sin(TAU * (2 * t + 0.2))
        rr = rho[idx]
        kp = np.where(rr > 0.78, 0, np.where(rr > 0.5, 2, np.where(rr > 0.22 + 0.06 * brilho_p, 3, 4)))
        oc = np.where((pt & em_brasa)[:, None], PONTA[kp], oc)
        corte = paleta('#3a2416', '#7a5232', '#9a6a40')
        kc = np.where(rr > 0.75, 0, np.where(rr > 0.4, 1, 2))
        oc = np.where((pt & ~em_brasa)[:, None], corte[kc], oc)
        out[idx] = oc

    # ---------- 3. as chamas (na tela, num plano no meio da boca: a tora da frente cobre a base) ----------
    bx, by = _tela(c, np.array([m - 0.08, yb - F * 0.62, z0 + 0.13]))
    s_chama = (P0[:, 1] - (yb - F * 0.6)) / VISTA[1]
    nivel_px = _chamas(sx, sy, float(bx), float(by), t)
    nivel_px = np.maximum(nivel_px, _soltas(sx, sy, float(bx), float(by), t))
    # monta o mapa inteiro para limpar a borda com os vizinhos
    niv = np.zeros((h, w), int)
    niv[ii, jj] = np.where(s_chama < s_sup, nivel_px, 0)
    niv = _limpar(niv)
    nv = niv[ii, jj]
    out = np.where((nv > 0)[:, None], CHAMA[np.clip(nv - 1, 0, 4)], out)

    # ---------- 4. as fagulhas (1 px, com o rastro de 1 px mais escuro embaixo) ----------
    novo = cor.copy()
    novo[ii, jj] = out
    novo = _sem_pixel_solto(novo, boca)
    for (dx, fase, fr, alto) in ((-3.0, 0.05, 1, 24), (2.0, 0.4, 2, 20), (6.0, 0.7, 1, 22), (-6.0, 0.9, 2, 17)):
        q = (fr * t + fase) % 1
        px = int(round(bx + dx + 2.0 * math.sin(TAU * (q * 1.5 + fase))))
        py = int(round(by - 6 - q * alto))
        for (yy, cc) in ((py, hx('#ffe7a0')), (py + 1, hx('#f08a2a'))):
            if 0 <= yy < h and 0 <= px < w and boca[yy, px] and niv[yy, px] <= 2:
                novo[yy, px] = cc
    cor = novo

    # ---------- 5. a luz do fogo nos arredores (anéis em degraus, distância 3D) ----------
    P = c.mundoP
    luzc = np.array([m, yb + 0.06, z0 + 0.32])
    d3 = np.linalg.norm(P - luzc, axis=-1) / pulso
    para = luzc - P
    para /= np.maximum(np.linalg.norm(para, axis=-1, keepdims=True), 1e-6)
    olha = np.clip((c.nrm * para).sum(-1), 0, 1)
    # só o que está na frente da boca (a parede de trás e os lados da base não veem o fogo)
    frente = (P[..., 1] > yb - 0.03) & (c.obj >= 0) & ~boca
    R = 1.65
    k = np.clip(1 - d3 / R, 0, 1) ** 0.8 * (0.3 + 0.8 * olha) + 0.5 * np.clip(1 - d3 / 0.62, 0, 1)
    k = np.minimum(np.floor(k * 4) / 4, 1.0)   # os degraus
    k = np.where(frente, k, 0)
    aceso = cor * np.array([1.24, 0.92, 0.62]) + np.array([34.0, 10.0, 0.0])
    cor = cor + (aceso - cor) * k[..., None]
    return np.clip(cor, 0, 255)
