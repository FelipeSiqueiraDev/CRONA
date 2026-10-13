"""
Cópia do fogo_px2 (agente_fogo), adaptada à fornalha pequena do fogão a lenha. Duas escalas: g['esc'] = o tamanho da
boca no mundo (as distâncias em metros) e g['px'] = o tamanho das formas desenhadas em pixels (as chamas, as lambidas,
as fagulhas, a fumaça), que segue o ESC do motor (padrão: o próprio g['esc'] x ESC / 0,75).
"""
"""
O fogo da lareira de vão 3D (a lareira do agente_lareira: arco, vão fundo de verdade), desenhado no pixel depois do
acabamento (contorno incluído), com o fogo apagando e a fumaça.

API (chame quadro a quadro, no fim do acabamento, antes de montar a imagem):

    desenhar_fogo(cor, c, t=0.0, forca=1.0, fumaca=None, fumaca_t=None, geo=None, chamine=None,
                  fumaca_chamine=None) -> nova cor (h, w, 3, float)

    cor       a imagem do acabamento (h, w, 3, float 0..255); não é alterada (volta uma cópia).
    c         a Cena do motor (usa c.obj, c.mundoP, c.nrm, c.x0, c.y0).
    t         o instante do loop do fogo aceso, 0..1 (t e t + 1 dão o mesmo quadro): chamas, brasas, fagulhas.
    forca     1 = aceso cheio, 0 = apagado. Caindo: as chamas encolhem e somem (abaixo de ~0,35 não há chama), as
              brasas ficam pulsando cada vez mais fracas (até ~0), as toras viram carvão com fissuras em brasa que
              apagam (e, no fim, a quina coberta de cinza), a luz na sala e no vão some junto.
    fumaca    0..1, quanto de fumaça (fiapos cinza-claros semitransparentes que sobem das toras, ondulam e se
              desfazem). None = automático pela força (fumaca_de): começa em forca 0,5 e é cheia no apagado.
              Para a fumaça que vai acabando depois de apagar, passe forca=0 e fumaca descendo de 1 a 0.
    fumaca_t  o tempo da fumaça (em voltas; cada fiapo leva ~2 voltas para subir). Não precisa fechar loop;
              None = t. Numa sequência, use o número do quadro / 12, por exemplo.
    geo       a boca: m, bw (meia largura), zp (o chão do vão), bt (a chave do arco), yb (a frente), yf (o fundo),
              chamine (o ponto do meio do topo da chaminé, em metros). Também lido de c.fogo_geo. Padrão: a
              lareira da sala do agente_lareira.
    chamine   o meio do topo da chaminé (x, y, z) em metros; None = geo['chamine'].
    fumaca_chamine  0..1, a fumaça da chaminé; None = automático: max(fumaca, 0,35 x a força das chamas) (aceso
              sai um fio; apagando, mais). 0 desliga.

A fumaça aparece em três lugares: dentro do vão (sobe e some no alto), um fiapo claro que escapa pela frente da boca
e sobe rente à frente da lareira até se desfazer antes do capelo (só com fumaca > 0,05), e a do topo da chaminé, que
sobe acima da viga ondulando com um ventinho para a direita (mais escura que o fundo claro).

O que desenha:
  1. o vão (os pixels cujo ponto do mundo cai dentro da caixa do vão): a pedra escura de dentro com o brilho do
     fogo em degraus; o chão vira um leito de carvão em pedaços (Voronoi de ~0,13 m: o pedaço escuro, a borda um
     tom acima, a fresta em brasa, uns pedaços em brasa viva pulsando; apagado, tudo cinza);
  2. as toras (o raio de cada pixel entra pelo plano da boca e anda até a superfície vista): três toras empilhadas,
     cada uma com a sua paleta, a quina de baixo escura (separa uma da outra), a de cima acesa; pontas em brasa;
  3. as chamas, as lambidas e as fagulhas, num plano atrás da tora do meio, recortadas pelo arco;
  4. a fumaça (só no vão: sobe e some pela chaminé);
  5. a luz do fogo nas pedras e no chão em anéis (distância 3D, só na frente da boca); a pedra clara puxa para o
     tom de areia queimada multiplicando (sem clarear) e a madeira esquenta somando: nada fica bege nem branco.
"""
import math
import numpy as np

from fogo_px import TAU, hx, paleta, CHAMA, PONTA, _tela, _viz, _toras_hit, _gota, _limpar, _sem_pixel_solto
from motor import VISTA, ruido, KX, KY, ESC

GEO2 = dict(m=2.92, bw=0.42, zp=0.124, bt=0.88, yb=0.72, yf=0.37, chamine=(2.92, 0.23, 3.23))

# as toras: [a quina de baixo (separa), escuro, meio, claro, a quina de cima acesa, acesa quente]
CASCAS = [
    paleta('#120a07', '#1e120b', '#2e1c10', '#43291a', '#7a4020', '#b45c26'),   # a de trás, na sombra das chamas
    paleta('#1a0e08', '#3a2212', '#6a4022', '#8e5a30', '#c47c3c', '#f0a24c'),   # a da frente, a mais clara
    paleta('#160c08', '#2e1a10', '#56341e', '#76482a', '#b46c38', '#ea9646'),   # a do meio
]
# o carvão das toras (apagando) e a cinza da quina de cima (apagado)
CARV_TORA = paleta('#0c0807', '#151010', '#1f1817', '#2a211e', '#3a2f2a', '#463a33')
CINZA_TORA = paleta('#0c0807', '#151010', '#1f1817', '#2e2724', '#5e5852', '#77706a')
FISSURA = paleta('#4a160c', '#8e2c14', '#d6561c', '#ff9a3a')
# o leito de carvão: o pedaço (escuro .. aceso), a fresta em brasa (fria .. viva) e a cinza (apagado)
CARVAO = paleta('#1a100c', '#2a1810', '#43231a', '#6a2e18')
FRESTA = paleta('#4a1a10', '#8a2c14', '#d0541c', '#f89434', '#ffd060')
CINZA = paleta('#1c1816', '#2c2624', '#3e3633')
FUMACA = hx('#c4bcb4')            # dentro do vão (no escuro)
FUMACA_FRENTE = hx('#f6f3ee')     # pela frente da boca (por cima da pedra clara)
FUMACA_CHAMINE = hx('#7e7874')    # no topo da chaminé (por cima do fundo claro)


def fumaca_de(forca):
    """A fumaça automática pela força: nada aceso cheio, começa em 0,5 e é cheia no apagado."""
    return float(np.clip((0.5 - forca) / 0.4, 0, 1))


def _faixas(forca):
    """Da força: as chamas (somem em 0,35), as brasas (somem em 0) e a luz na sala (quase toda das chamas)."""
    fl = float(np.clip((forca - 0.35) / 0.65, 0, 1))
    br = float(np.clip(forca / 0.6, 0, 1)) ** 0.8
    lz = 0.8 * fl + 0.2 * br
    return fl, br, lz


def _toras2(g):
    m, yb, yf, z0, bw = g['m'], g['yb'], g['yf'], g['zp'], g['bw']
    r = g.get('r_tora', 0.034)
    # na fornalha a lenha entra de frente (ao longo de y): duas toras embaixo e uma em cima, a ponta da frente em brasa
    return [
        (np.array([m - 0.42 * bw, yf + 0.03, z0 + r]), np.array([m - 0.4 * bw, yb - 0.05, z0 + r]), r, False, True),
        (np.array([m + 0.44 * bw, yf + 0.03, z0 + r * 0.95]), np.array([m + 0.4 * bw, yb - 0.09, z0 + r * 0.95]), r * 0.95, False, True),
        (np.array([m + 0.02 * bw, yf + 0.05, z0 + r * 2.6]), np.array([m - 0.02 * bw, yb - 0.035, z0 + r * 2.5]), r * 0.95, False, True),
    ]


def _chamas2(sx, sy, bx, by, t, fl, esc=1.0):
    """As línguas de fogo (tons 1..5) com a força das chamas fl: as dos lados somem primeiro, a do meio encolhe."""
    nivel = np.zeros(sx.shape, int)
    if fl <= 0:
        return nivel
    # (deslocamento x, largura, altura, tom máximo, fase, frequência, quanto a ponta abre, força em que some)
    linguas = [
        (0.0, 14.0, 21.0, 5, 0.00, 1, 0.0, 0.0),
        (-5.5, 10.0, 16.0, 4, 0.31, 2, -1.5, 0.2),
        (5.5, 9.0, 14.0, 4, 0.62, 1, 1.5, 0.3),
        (-10.5, 8.0, 12.0, 4, 0.47, 1, -1.2, 0.35),
        (-15.0, 6.0, 8.0, 3, 0.15, 2, -1.0, 0.55),
        (10.0, 6.0, 8.0, 3, 0.74, 1, 1.0, 0.6),
    ]
    tons = [(1.0, 1.0, 0.0), (0.8, 0.84, 0.5), (0.62, 0.68, 1.0), (0.44, 0.5, 1.4), (0.24, 0.3, 1.8)]
    for (dx, w, hgt, tmax, fase, fr, abre, some) in linguas:
        f = float(np.clip((fl - some) / (1 - some), 0, 1))
        if f <= 0:
            continue
        a = TAU * (fr * t + fase)
        hh = esc * hgt * (0.22 + 0.78 * f) * (1 + 0.13 * math.sin(a) + 0.06 * math.sin(2 * a + 1.3))
        ww = esc * w * (0.5 + 0.5 * f) * (1 + 0.05 * math.cos(a + 0.7))
        tm = max(1, int(round(tmax * (0.3 + 0.7 * f))))
        v = np.clip((by - sy) / hh, 0, 1)
        bal = (abre * v ** 1.5 + 1.6 * math.sin(a + 0.4) * v ** 1.6 + 0.6 * np.sin(2 * a + 2.0 + 5 * v) * v ** 2) * (hh / 18)
        for k, (fw, fh, sobe) in enumerate(tons[:tm]):
            g = _gota(sx - bal, sy, bx + dx * esc * (0.6 + 0.4 * f), by - sobe, ww * fw, hh * fh)
            nivel = np.where(g > 0, np.maximum(nivel, k + 1), nivel)
    return nivel


def _soltas2(sx, sy, bx, by, t, fl, esc=1.0):
    """As lambidas que se soltam das pontas (só com o fogo forte)."""
    nivel = np.zeros(sx.shape, int)
    if fl < 0.45:
        return nivel
    for (dx, topo, fase, fr) in ((-1.0, 21, 0.1, 1), (4.5, 16, 0.55, 1), (-5.0, 15, 0.8, 2)):
        q = (fr * t + fase) % 1
        if q > 0.75:
            continue
        cy = by - esc * (topo * fl + 1 + q * 7)
        cx = bx + esc * (dx + 1.2 * math.sin(TAU * q))
        tam = 1 - q / 0.75
        g = _gota(sx, sy, cx, cy + esc * 2.2 * tam, esc * (3.2 * tam + 1.6), esc * (4.5 * tam + 1.8))
        nivel = np.where(g > 0, np.where(g > 0.55, 2, 1), nivel)
    return nivel


_ESC = {'e': 1.0}


def _carvao(Q, dist, t, br):
    """O leito de carvão no chão do vão: pedaços (Voronoi), a fresta em brasa; com br caindo, tudo vira cinza."""
    X, Y = Q[:, 0], Q[:, 1]
    sx, sy = 0.14 * _ESC['e'], 0.11 * _ESC['e']
    gi, gj = np.floor(X / sx), np.floor(Y / sy)
    d1 = np.full(len(X), 9.0)
    d2 = np.full(len(X), 9.0)
    cel = np.zeros((len(X), 2))
    for di in (-1, 0, 1):
        for dj in (-1, 0, 1):
            ci, cj = gi + di, gj + dj
            cx = (ci + 0.2 + 0.6 * ruido(ci, cj, 11.0)) * sx
            cy = (cj + 0.2 + 0.6 * ruido(ci, cj, 12.0)) * sy
            d = np.hypot((X - cx) / sx, (Y - cy) / sy)
            menor = d < d1
            d2 = np.where(menor, d1, np.minimum(d2, d))
            cel = np.where(menor[:, None], np.stack([ci, cj], 1), cel)
            d1 = np.where(menor, d, d1)
    r = ruido(cel[:, 0], cel[:, 1], 13.0)
    pulsa = 0.5 + 0.5 * np.sin(TAU * (t + ruido(cel[:, 0], cel[:, 1], 14.0)))
    # o calor: perto do fogo, vezes a força das brasas; cada pedaço com o seu (os mais quentes apagam por último)
    calor = np.clip(1 - dist / 0.55, 0, 1) * np.clip(br * (1.25 + 0.6 * r) - 0.25 * (1 - br), 0, 1.3)
    fresta = (d2 - d1) < 0.13
    borda = (d2 - d1) < 0.34
    kf = np.floor(calor * 4.2 + 0.7 * pulsa * min(1.0, br * 3) - 0.3).astype(int)
    kc = np.clip(np.floor(calor * 2.2).astype(int) + borda.astype(int), 0, len(CARVAO) - 1)
    out = np.where(fresta[:, None], np.where((kf >= 0)[:, None], FRESTA[np.clip(kf, 0, 4)], CINZA[1]), CARVAO[kc])
    vivo = (r > 0.8) & (calor > 0.3) & ~fresta
    kv = np.clip(np.where(d1 < 0.3, 2, 1) + np.where(pulsa > 0.55, 1, 0) - np.where(br < 0.5, 1, 0), 0, 4)
    out = np.where(vivo[:, None], FRESTA[kv], out)
    # apagado: o carvão vira cinza (o pedaço cinza-escuro, a fresta mais clara) onde não há mais brasa
    morto = (calor <= 0.02) & (br < 0.6)
    cz = np.where(fresta, 2, np.where(borda, 1, 0))
    mistura = np.clip((0.6 - br) / 0.6, 0, 1)
    out = np.where(morto[:, None], out * (1 - mistura) + CINZA[cz] * mistura, out)
    return out


def _fumaca(sx, sy, bx, by, ft, quanto, altura=26, espalha=12, raio=(1.3, 3.9), n=7, vel=0.5, onda=2.2, vento=0.0,
            seed=0.0, ganho=1.0):
    """
    Os fiapos de fumaça (alfa em 3 degraus): bolinhas que nascem em volta de (bx, by) na tela, sobem `altura` px
    ondulando devagar, crescem de raio[0] a raio[1], vão com o `vento` (px no alto) e se desfazem.
    ft = o tempo da fumaça (em voltas); quanto = 0..1 (quantos fiapos saem e quão densos).
    """
    alfa = np.zeros(np.shape(sx))
    if quanto <= 0:
        return alfa
    for i in range(n):
        idade = ft * vel + i / n + 0.13 * ruido(i, 3.0 + seed)
        q = idade % 1                       # a idade do fiapo (0 nasce, 1 some)
        volta = math.floor(idade)
        # cada fiapo nasce num ponto (muda a cada volta) e só sai se a quantidade deixar
        if ruido(i, volta, 5.0 + seed) > quanto * 1.1:
            continue
        x0 = bx + (ruido(i, volta, 6.0 + seed) - 0.5) * espalha
        cx = x0 + onda * math.sin(TAU * (q * 0.9 + ruido(i, 7.0 + seed))) * (0.4 + q) + vento * q ** 1.5
        cy = by + 2 - q * altura
        rad = raio[0] + (raio[1] - raio[0]) * q
        dens = (1 - q) ** 0.75 * min(1.0, q * 5) * (0.7 + 0.3 * quanto)
        # a bolinha alongada para cima e o rabo mais fino embaixo
        d = np.hypot((sx - cx) / rad, (sy - cy) / (rad * 1.35))
        d2 = np.hypot((sx - cx + 0.8 * math.sin(TAU * q)) / (rad * 0.55), (sy - cy - rad * 1.4) / (rad * 0.9))
        a = np.where(d < 1, dens, 0) + np.where(d2 < 1, dens * 0.6, 0)
        alfa = np.maximum(alfa, a)
    # os degraus (pixel limpo): 0, 0,14, 0,26, 0,38
    return ganho * np.where(alfa > 0.62, 0.38, np.where(alfa > 0.38, 0.26, np.where(alfa > 0.16, 0.14, 0.0)))


def _fumaca_tela(img, caixa, cor_f, forca_alfa=1.0, **kw):
    """A fumaça desenhada por cima de tudo, numa janela da tela (x0, y0, x1, y1), sem o degrau sozinho de 1 px."""
    h, w = img.shape[:2]
    x0, y0, x1, y1 = [int(round(v)) for v in caixa]
    x0, y0, x1, y1 = max(0, x0), max(0, y0), min(w, x1), min(h, y1)
    if x0 >= x1 or y0 >= y1:
        return img
    yy, xx = np.mgrid[y0:y1, x0:x1]
    a = _fumaca(xx + 0.5, yy + 0.5, **kw) * forca_alfa
    viz_a = np.stack([_viz(a, dy, dx, 0.0) for dy, dx in ((0, 1), (1, 0), (0, -1), (-1, 0))])
    a = np.where((a > 0) & ((viz_a > 0).sum(0) <= 1), 0, a)
    img = img.copy()
    img[y0:y1, x0:x1] = img[y0:y1, x0:x1] + (cor_f - img[y0:y1, x0:x1]) * a[..., None]
    return img


def _luz_quente(cor, k):
    """A luz do fogo sobre a cor: a clara puxa para o laranja multiplicando (sem clarear), a escura esquenta somando."""
    lum = cor @ np.array([0.3, 0.55, 0.15])
    L = np.clip((lum - 90) / 110, 0, 1)[..., None]
    aceso = cor * np.concatenate([1.0 + 0.24 * (1 - L), 0.80 + 0.1 * (1 - L), 0.56 + 0.0 * L], -1) + (1 - L) * np.array([30.0, 8.0, 0.0])
    return cor + (aceso - cor) * k[..., None]


def desenhar_fogo(cor, c, t=0.0, forca=1.0, fumaca=None, fumaca_t=None, geo=None, chamine=None, fumaca_chamine=None):
    g = dict(GEO2)
    g.update(getattr(c, 'fogo_geo', None) or {})
    if geo:
        g.update(geo)
    m, bw, z0, bt, yb, yf = g['m'], g['bw'], g['zp'], g['bt'], g['yb'], g['yf']
    if chamine is None:
        chamine = g.get('chamine', (m, 0.23, 3.23))
    rec = yb - yf
    _ESC['e'] = g.get('esc', 1.0)
    pe = g.get('px', g.get('esc', 1.0) * ESC / 0.75)      # a escala das formas em pixels
    forca = float(np.clip(forca, 0, 1))
    fl, br, lz = _faixas(forca)
    if fumaca is None:
        fumaca = fumaca_de(forca)
    if fumaca_t is None:
        fumaca_t = t
    cor = cor.copy()
    h, w = c.obj.shape
    P = c.mundoP
    X, Y, Z = P[..., 0], P[..., 1], P[..., 2]
    vao = ((c.obj >= 0) & (Y < yb - 1e-3) & (Y > yf - 2e-3) & (np.abs(X - m) < bw + 2e-3) & (Z > z0 - 8e-3) & (Z < bt + 0.02))
    ii, jj = np.nonzero(vao)
    sx, sy = jj + 0.5, ii + 0.5
    Q = P[ii, jj]

    centro = np.array([m - 0.1 * g.get('esc', 1.0), yb - rec * 0.55, z0 + 0.2 * g.get('esc', 1.0)])
    pulso = 1 + 0.05 * math.sin(TAU * t) + 0.03 * math.sin(TAU * 3 * t + 0.8)

    # ---------- 1. o vão: a pedra escura de dentro com o brilho do fogo, o chão de carvão ----------
    base = cor[ii, jj]
    dist = np.linalg.norm(Q - centro, axis=1) / pulso
    nq = c.nrm[ii, jj]
    para = centro - Q
    para /= np.maximum(np.linalg.norm(para, axis=1, keepdims=True), 1e-6)
    olha = np.clip((nq * para).sum(1), 0, 1)
    raio_v = 0.3 + 0.45 * lz
    kb = (np.clip(1 - dist / raio_v, 0, 1) * (0.45 + 0.55 * olha) * np.clip(1.3 - (Q[:, 2] - z0) / 0.6, 0.35, 1)
          * (0.35 + 0.65 * lz))
    kb = np.floor(kb * 5) / 5
    brilho = hx('#c0501a')
    out = base + (brilho - base) * (kb * 0.6)[:, None]
    chao = Q[:, 2] < z0 + 0.01
    if chao.any():
        out[chao] = _carvao(Q[chao], dist[chao], t, br)

    # ---------- 2. as toras ----------
    s_e = (yb - Q[:, 1]) / VISTA[1]
    P0 = Q + s_e[:, None] * VISTA
    toras = _toras2(g)
    s_tor, qual, ponta, lado_b, rho, n_tor, hpos = _toras_hit(P0, toras, s_e - 1e-4)
    tora = s_tor < s_e - 1e-4
    s_sup = np.where(tora, s_tor, s_e)
    if tora.any():
        idx = np.nonzero(tora)[0]
        Qt = P0[idx] - s_tor[idx, None] * VISTA
        nn = n_tor[idx]
        pf = centro - Qt
        pf /= np.linalg.norm(pf, axis=1, keepdims=True)
        lf = np.clip((nn * pf).sum(1), 0, 1)
        perto = np.clip(1 - np.linalg.norm(Qt - centro, axis=1) / (0.6 * pulso), 0, 1) * fl
        tm = np.full((h, w), -1)
        tm[ii[idx], jj[idx]] = qual[idx] * 2 + ponta[idx]
        eu = tm[ii[idx], jj[idx]]
        acima = _viz(tm, -1, 0, -1)[ii[idx], jj[idx]]
        acima2 = _viz(tm, -2, 0, -1)[ii[idx], jj[idx]]
        abaixo = _viz(tm, 1, 0, -1)[ii[idx], jj[idx]]
        dg = np.full(len(idx), 2)
        dg = np.where(abaixo != eu, 1, dg)
        dg = np.where((abaixo != eu) & (abaixo >= 0), 0, dg)          # encostada noutra tora: a separação
        dg = np.where((acima2 != eu) & (perto > 0.3), 3, dg)
        dg = np.where(acima != eu, np.where(perto > 0.15, 4, 3), dg)
        dg = np.where((acima != eu) & (perto > 0.45) & (lf > 0.3), 5, dg)
        dg = np.clip(dg, 0, 5)
        casca = np.stack([CASCAS[q][d] for q, d in zip(qual[idx], dg)])
        # apagando, a madeira vira carvão; apagado, a quina de cima fica coberta de cinza
        carv = float(np.clip((1 - forca) / 0.7, 0, 1))
        alvo = CARV_TORA[dg] * br + CINZA_TORA[dg] * (1 - br)
        oc = casca * (1 - carv) + alvo * carv
        # as fissuras em brasa no carvão (riscas ao longo da tora, no corpo), pulsando e apagando
        if carv > 0.2 and br > 0:
            hq = hpos[idx] / 0.085 + 0.37 * qual[idx]
            risca = ((hq % 1) < 0.24) & (dg >= 1) & (dg <= 3) & (ruido(np.floor(hq), qual[idx], 21.0) > 0.3)
            pul = 0.5 + 0.5 * np.sin(TAU * (2 * t + ruido(np.floor(hq), qual[idx], 22.0)))
            kfi = np.floor(br * (3.2 + 1.0 * pul) * min(1.0, carv * 1.6)).astype(int) - 1
            oc = np.where((risca & (kfi >= 0))[:, None], FISSURA[np.clip(kfi, 0, 3)], oc)
        pt = ponta[idx]
        em_brasa = np.array([toras[q][4] if lb else toras[q][3] for q, lb in zip(qual[idx], lado_b[idx])], bool)
        bp = 0.5 + 0.5 * math.sin(TAU * (2 * t + 0.2))
        rr = rho[idx]
        # a ponta em brasa: o miolo encolhe e escurece com as brasas; apagada, carvão com o miolo cinza
        kp = np.where(rr > 0.78, 0, np.where(rr > 0.5, 2, np.where(rr > 0.22 + 0.06 * bp, 3, 4)))
        kp = np.clip(kp - int(round((1 - br) * 3)), 0, 4)
        kp = np.where((kp >= 1) & (br < 0.08), 0, kp)
        pc = np.where((kp == 0)[:, None], np.where((rr < 0.5)[:, None], CINZA_TORA[3], CARV_TORA[1]), PONTA[kp])
        oc = np.where((pt & em_brasa)[:, None], pc, oc)
        corte = paleta('#3a2416', '#7a5232', '#9a6a40') * (1 - 0.6 * carv)
        kc = np.where(rr > 0.75, 0, np.where(rr > 0.4, 1, 2))
        oc = np.where((pt & ~em_brasa)[:, None], corte[kc], oc)
        out[idx] = oc

    # ---------- 3. as chamas (num plano atrás da tora do meio; só nos pixels do vão: o arco recorta) ----------
    bx, by = _tela(c, np.array([m + g.get('chama_dx', -0.15 * g.get('esc', 1.0)), yb - rec * g.get('chama_y', 0.75), z0 + 0.2 * g.get('esc', 1.0)]))
    bx, by = float(bx), float(by)
    s_chama = (P0[:, 1] - (yb - rec * g.get('chama_y', 0.75))) / VISTA[1]
    nivel_px = np.maximum(_chamas2(sx, sy, bx, by, t, fl, esc=pe), _soltas2(sx, sy, bx, by, t, fl, esc=pe))
    niv = np.zeros((h, w), int)
    niv[ii, jj] = np.where(s_chama < s_sup, nivel_px, 0)
    niv = _limpar(niv)
    nv = niv[ii, jj]
    out = np.where((nv > 0)[:, None], CHAMA[np.clip(nv - 1, 0, 4)], out)
    novo = cor.copy()
    novo[ii, jj] = out
    novo = _sem_pixel_solto(novo, vao)

    # ---------- 4. as fagulhas (com a força) e a fumaça ----------
    for i, (dx, fase, fr, alto) in enumerate(((-3.0, 0.05, 1, 24), (2.0, 0.4, 2, 20), (6.0, 0.7, 1, 22), (-6.0, 0.9, 2, 17))):
        if forca < 0.3 + 0.15 * i:
            continue
        q = (fr * t + fase) % 1
        e = pe
        px = int(round(bx + dx * e + 2.0 * e * math.sin(TAU * (q * 1.5 + fase))))
        py = int(round(by - 6 * e - q * alto * e * (0.5 + 0.5 * fl)))
        for (yy, cc) in ((py, hx('#ffe7a0')), (py + 1, hx('#f08a2a'))):
            if 0 <= yy < h and 0 <= px < w and vao[yy, px] and niv[yy, px] <= 2:
                novo[yy, px] = cc
    if fumaca > 0:
        a = np.zeros((h, w))
        a[ii, jj] = _fumaca(sx, sy, bx, by + pe, fumaca_t, fumaca, altura=26 * pe, espalha=12 * pe, raio=(1.3 * pe, 3.9 * pe), onda=2.2 * pe)
        # pixel limpo: o degrau sozinho some
        viz_a = np.stack([_viz(a, dy, dx, 0.0) for dy, dx in ((0, 1), (1, 0), (0, -1), (-1, 0))])
        a = np.where((a > 0) & ((viz_a > 0).sum(0) <= 1), 0, a)
        novo = novo + (FUMACA - novo) * a[..., None]
    cor = novo

    # ---------- 4b. a fumaça de fora: o fiapo que escapa pela frente da boca e a da chaminé ----------
    # (1) pela frente: nasce no alto da boca, sobe rente à frente (por cima das pedras do arco e do consolo) e se
    # desfaz antes do capelo; clara (a pedra é clara: a fumaça aparece mais clara que ela)
    if fumaca > 0.05:
        fx, fy = _tela(c, np.array([m - 0.04, yb + 0.03, bt - 0.04]))
        fx, fy = float(fx), float(fy)
        cor = _fumaca_tela(cor, (fx - 14 * pe, fy - 34 * pe, fx + 18 * pe, fy + 6 * pe), FUMACA_FRENTE, bx=fx, by=fy, ft=fumaca_t,
                           quanto=fumaca, altura=28 * pe, espalha=6 * pe, raio=(1.4 * pe, 3.6 * pe), n=6, vel=0.45, onda=1.6 * pe,
                           vento=1.5 * pe, seed=40.0, ganho=1.55)
    # (2) a chaminé: aceso, um fio de fumaça; apagando, mais; sobe acima da viga ondulando, mais escura que o fundo
    if chamine is not None:
        qc = max(fumaca, 0.35 * fl) if fumaca_chamine is None else fumaca_chamine
        if qc > 0:
            cx_, cy_ = _tela(c, np.array(chamine))
            cx_, cy_ = float(cx_), float(cy_)
            cor = _fumaca_tela(cor, (cx_ - 20 * pe, cy_ - 58 * pe, cx_ + 32 * pe, cy_ + 6 * pe), FUMACA_CHAMINE, bx=cx_, by=cy_ - 1,
                               ft=fumaca_t, quanto=qc, altura=46 * pe, espalha=8 * pe, raio=(2.4 * pe, 7.0 * pe), n=10, vel=0.35,
                               onda=2.6 * pe, vento=7.0 * pe, seed=80.0, ganho=1.45)

    # ---------- 5. a luz do fogo nas pedras e no chão (anéis em degraus, distância 3D, só na frente da boca) ----------
    if lz > 0:
        luzc = np.array([m, yb + 0.06, z0 + 0.3 * g.get('esc', 1.0)])
        d3 = np.linalg.norm(P - luzc, axis=-1) / pulso
        para = luzc - P
        para /= np.maximum(np.linalg.norm(para, axis=-1, keepdims=True), 1e-6)
        olha = np.clip((c.nrm * para).sum(-1), 0, 1)
        frente = (Y > yb + g.get('luz_y0', -0.03)) & (c.obj >= 0) & ~vao
        if g.get('luz_fora'):
            a0, a1, b0, b1, zf = g['luz_fora']
            fora = (X > a0) & (X < a1) & (Y > b0) & (Y < b1) & (Z > zf)
        # o raio dos anéis encolhe com a luz (as brasas sozinhas só esquentam a beira da boca)
        R = g.get('raio_luz', 0.5 + 1.2 * lz)
        k = ((np.clip(1 - d3 / R, 0, 1) ** 0.8 * (0.3 + 0.8 * olha) + 0.5 * np.clip(1 - d3 / (0.3 + 0.32 * lz), 0, 1))
             * (0.4 + 0.6 * lz))
        k = np.minimum(np.floor(k * 4) / 4, 1.0)
        k = np.where(frente, k, 0.0)
        if g.get('luz_fora'):
            # na frente do próprio fogão a luz é mais fraca (só esquenta: não vira marrom)
            k = np.where(fora, np.floor(k * g.get('luz_fora_k', 0.0) * 4) / 4, k)
        cor = _luz_quente(cor, k)
    return np.clip(cor, 0, 255)


# o nome de antes (a primeira versão no vão 3D)
desenhar_fogo2 = desenhar_fogo


# ---------------------------------------------------------------------------------------------------------------------
# a boca aberta da chapa (só da cozinha): as argolas tiradas, o fogo lambendo para cima pelo buraco
# ---------------------------------------------------------------------------------------------------------------------
BRASA_BOCA = paleta('#4a1a10', '#8a2c14', '#d0541c', '#f89434', '#ffd060')


def _linguas_boca(sx, sy, bx, by, t, fl, meia, kp=1.0):
    """As línguas baixas e largas que saem do buraco da boca (tons 1..5), espalhadas pela largura do buraco."""
    nivel = np.zeros(sx.shape, int)
    if fl <= 0:
        return nivel
    # (posição na largura, largura px, altura px, tom máximo, fase, frequência)
    linguas = [(-0.7, 6.0, 8.0, 3, 0.10, 2), (-0.25, 8.0, 14.0, 5, 0.45, 1), (0.25, 7.5, 11.5, 4, 0.78, 2),
               (0.72, 5.5, 8.0, 3, 0.30, 1), (0.0, 9.0, 7.0, 4, 0.6, 3)]
    tons = [(1.0, 1.0, 0.0), (0.78, 0.82, 0.4), (0.58, 0.64, 0.8), (0.4, 0.46, 1.1), (0.24, 0.28, 1.4)]
    for (px, w, hgt, tmax, fase, fr) in linguas:
        a = TAU * (fr * t + fase)
        hh = kp * hgt * (0.82 + 0.18 * math.sin(a) + 0.06 * math.sin(2 * a + 1.1)) * (0.35 + 0.65 * fl)
        ww = kp * w * (0.95 + 0.05 * math.cos(a + 0.7))
        tm = max(1, int(round(tmax * (0.4 + 0.6 * fl))))
        v = np.clip((by - sy) / max(hh, 1e-6), 0, 1)
        bal = kp * (0.9 * math.sin(a + 0.4) * v ** 1.5 + 0.4 * np.sin(2 * a + 2.0 + 5 * v) * v ** 2)
        for k, (fw, fh, sobe) in enumerate(tons[:tm]):
            g = _gota(sx - bal, sy, bx + px * meia, by - sobe, ww * fw, hh * fh)
            nivel = np.where(g > 0, np.maximum(nivel, k + 1), nivel)
    return nivel


def chamas_boca(cor, c, t, forca, centro, raio, zt, esc=0.45, luz=(0.9, 0.55), px=None):
    """
    O buraco da boca aberta (centro x, y; raio; zt = o alto da chapa): o fundo em brasa pulsando (pedaços), as
    chamas subindo do buraco por cima da chapa (sem tapar o que está na frente delas) e a luz do fogo em volta,
    também na parede de trás. luz = (raio da luz em m, força).
    """
    forca = float(np.clip(forca, 0, 1))
    fl, br, lz = _faixas(forca)
    cor = cor.copy()
    h, w = c.obj.shape
    P = c.mundoP
    X, Y, Z = P[..., 0], P[..., 1], P[..., 2]
    bx0, by0 = centro
    rr = np.hypot(X - bx0, Y - by0)
    # 1. o buraco: a brasa em pedaços (as frestas acesas pulsam), apagado vira cinza
    furo = (c.obj >= 0) & (np.abs(Z - zt) < 0.006) & (rr < raio)
    if furo.any():
        ii, jj = np.nonzero(furo)
        Q = P[ii, jj]
        gi, gj = np.floor(Q[:, 0] / 0.045), np.floor(Q[:, 1] / 0.045)
        r0 = ruido(gi, gj, 31.0)
        pul = 0.5 + 0.5 * np.sin(TAU * (t + r0))
        borda = (np.abs((Q[:, 0] / 0.045) % 1 - 0.5) > 0.36) | (np.abs((Q[:, 1] / 0.045) % 1 - 0.5) > 0.36)
        k = np.where(borda, 3 + (pul > 0.5), 1 + (r0 > 0.6) + (pul > 0.7)).astype(int)
        k = np.clip(np.round(k * br + 0.0).astype(int), 0, 4)
        # a beira do buraco (a espessura da chapa, do lado de trás) fica escura
        ka = rr[ii, jj] > raio - 0.02
        out = np.where(ka[:, None], hx('#1c1716'), BRASA_BOCA[k])
        cor[ii, jj] = out if br > 0.02 else np.where(ka[:, None], hx('#1c1716'), CINZA[1])
    # 2. as chamas: na tela, do meio do buraco para cima; só onde nada mais perto da câmera está na frente
    if fl > 0:
        C = np.array([bx0, by0, zt])
        bx, by = _tela(c, C)
        bx, by = float(bx), float(by) + 1
        pe = ESC / 0.75 if px is None else px
        x0, x1 = int(bx - 14 * pe), int(bx + 15 * pe)
        y0, y1 = int(by - 26 * pe), int(by + 3 * pe)
        x0, y0, x1, y1 = max(0, x0), max(0, y0), min(w, x1), min(h, y1)
        yy, xx = np.mgrid[y0:y1, x0:x1]
        niv = np.zeros((h, w), int)
        nv = _linguas_boca(xx + 0.5, yy + 0.5, bx, by, t, fl, raio * KX * 1.2, kp=pe)
        prof_ch = C @ VISTA
        livre = (c.prof[y0:y1, x0:x1] < prof_ch + 0.02) | (c.obj[y0:y1, x0:x1] < 0)
        # embaixo da linha do buraco as chamas não aparecem (estão dentro da chapa)
        sx_rel = (xx + 0.5 - bx) / (raio * KX * 1.42)
        dentro_furo = (yy + 0.5 - by) < -1 + 0 * sx_rel
        niv[y0:y1, x0:x1] = np.where(livre & (dentro_furo | (np.abs(sx_rel) < 1) & ((yy + 0.5 - by) < raio * KY * 1.42 * np.sqrt(np.clip(1 - sx_rel ** 2, 0, 1)) - 1)), nv, 0)
        niv = _limpar(niv)
        cor = np.where((niv > 0)[..., None], CHAMA[np.clip(niv - 1, 0, 4)], cor)
    # 3. a luz do fogo da boca em volta (a parede de trás, a chaminé, a chaleira, a chapa), em anéis
    if lz > 0:
        L0 = np.array([bx0, by0, zt + 0.12])
        pulso = 1 + 0.05 * math.sin(TAU * t) + 0.03 * math.sin(TAU * 3 * t + 0.8)
        d3 = np.linalg.norm(P - L0, axis=-1) / pulso
        k = np.clip(1 - d3 / luz[0], 0, 1) ** 1.3 * luz[1] * lz
        # em 3 degraus fracos (pixel limpo: sem pontilhado)
        k = np.minimum(np.floor(k * 3 + 0.35) / 3, 1.0) * 0.8
        k = np.where((c.obj >= 0) & ~furo, k, 0.0)
        cor = _luz_quente(cor, k)
    return np.clip(cor, 0, 255)
