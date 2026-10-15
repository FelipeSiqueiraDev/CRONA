"""
GRUPO: os prédios da vila de Santo Berço (docs/SANTO-BERCO.md), vistos de fora, em pixel art 1:1 feita só por código,
no mesmo acabamento dos prédios da fazenda (fazenda_fora.py: casarão, celeiro, galpão).

A vila é medieval e anacrônica, isolada, um pouco sinistra: casas de enxaimel (a taipa clara entre as vigas escuras),
pedra, telha vermelha; nada de eletricidade, a luz vem dos cristais vermelhos (a janela acesa é vermelha e morna, o
lampião da porta é um cristal numa gaiola de ferro).

Tudo desenhado no giro 4 (a frente para +y), a pegada começando em (0, 0), no tamanho do catálogo (shared/src/furni.ts,
categoria 'vila': width x depth em casas de 0,75 m; o `height` de lá está em METROS, o catalogo-lugares.json guarda
em unidades). A PORTA fica na face da frente, com o meio na casa floor(width / 2): o jogo põe a peça "entrada" na casa
logo à frente dela. Os prédios são fechados dos quatro lados (o jogador vê as costas nos outros giros).

O kit da fachada (telhado, rodapé de pedra, juntas, chaminé, reboco) vem do fazenda_fora.py; aqui ficam o enxaimel,
a janela acesa de cristal, a porta de tábuas, a pedra em volta da torre, a telha do cone, as toras e a fumaça.
"""
import math
import sys

import numpy as np

import cozinha as CZ
import base_estilo as BE
import fazenda_fora as FF
import motor
from base_estilo import hx, liso, mad2, _tom, _cru, PZ, PH
from motor import ruido, suave, emissivo, MUNDO as M

CASA = 0.75

# ---------------------------------------------------------------- a paleta da vila
TAIPA_COR = '#dccdaa'      # a taipa caiada, clara (o furni.ts dá '#d8c8a4')
VIGA_COR = '#4a3020'       # as vigas do enxaimel, escuras
VIGA_J = '#3a2618'         # o batente da janela e da porta (um tom abaixo da viga)
PORTA_COR = ['#6a4428', '#62402a', '#704a2c']
JANELA_TAB = ['#6e2e22', '#682a1e', '#763426']   # as folhas da janela (o vermelho-sangue desbotado da vila)
TELHA_V = ['#a8402a', '#b24a30', '#9c3826', '#b85236']
TELHA_VJ = '#4a1a10'
CUMEEIRA_V = '#8a3020'
PEDRA = ['#9a9284', '#8e8678', '#a49c8e', '#878072']
PEDRA_J = '#4e483f'
FERRO = '#2e2a28'
# o cristal vermelho aceso (do miolo para a borda) e a luz dele na janela
CRISTAL = ['#ffd2b0', '#ff9a6a', '#f2603a', '#c83a26', '#8a2018']
LUZ_JAN = ['#ffbe8a', '#f77a48', '#d24a30', '#9a2e22']

PW = 0.13                  # a largura da viga do enxaimel
EV = 0.04                  # o quanto a viga sai da taipa
FR = 0.05                  # o batente da janela


# =====================================================================================================================
# o básico (o mesmo jeito do fazenda_fora)
# =====================================================================================================================
obj = FF.obj
caixa = FF.caixa
fp = FF.fp
pegada = FF.pegada
pegada_redonda = FF.pegada_redonda
_bx = FF._bx


def _hex(c):
    return '#%02x%02x%02x' % tuple(np.clip(np.round(np.asarray(c, float)), 0, 255).astype(int))


def _porta_x(W):
    """O meio da porta (em m): o meio da casa floor(width / 2), onde o jogo põe a entrada."""
    return (W // 2 + 0.5) * CASA


def _P(face, plano, l, e, z):
    """O ponto na fachada `face` (no plano da parede): l ao longo, e para fora, z a altura."""
    sg = 1 if face[0] == '+' else -1
    if face[1] == 'y':
        return (l, plano + sg * e, z)
    return (plano + sg * e, l, z)


def _N(face):
    sg = 1.0 if face[0] == '+' else -1.0
    return (0.0, sg, 0.0) if face[1] == 'y' else (sg, 0.0, 0.0)


def _lados(B):
    X0, X1, Y0, Y1 = B
    return {'+y': (Y1, X0, X1), '-y': (Y0, X0, X1), '+x': (X1, Y0, Y1), '-x': (X0, Y0, Y1)}


def mat_taipa(cor=TAIPA_COR, seed=0, sujeira=0.55):
    """A taipa caiada: as manchas grandes do reboco (2 tons) e a sujeira que sobe do chão (o mat_reboco da fazenda)."""
    return FF.mat_reboco(cor, seed=seed, sujeira=sujeira)


def mat_pedra(seed=0, alt=0.15, comp=0.3, cores=PEDRA, junta=PEDRA_J, extra=None):
    return FF.mat_juntas(list(cores), FF.id_pedras_parede(alt, comp, seed=seed), junta, seed=seed + 3, extra=extra)


# =====================================================================================================================
# a luz redonda (as peças de volta: a torre, o cone, as toras): a luz em degraus pela normal de cada pixel
# =====================================================================================================================
def _redondo(base, normal_px):
    """Embrulha um material de cor (base) com a luz em degraus pela normal de cada pixel (normal_px(P) -> N local)."""
    def f(L, n, P):
        out = base(L, n, P)
        N = normal_px(P)
        k = BE._luz_k(BE.n_mundo(N) @ BE._LUZ2)
        return _cru(_tom(out, k), n)
    return emissivo(f)


def _n_cil(cx, cy, inc=0.0):
    def f(P):
        th = np.arctan2(P[:, 1] - cy, P[:, 0] - cx)
        N = np.stack([np.cos(th), np.sin(th), np.full(len(P), inc)], 1)
        return N / np.linalg.norm(N, axis=1, keepdims=True)
    return f


def _n_tora_x(cy, cz):
    def f(P):
        th = np.arctan2(P[:, 2] - cz, P[:, 1] - cy)
        return np.stack([np.zeros(len(P)), np.cos(th), np.sin(th)], 1)
    return f


# =====================================================================================================================
# o enxaimel: as vigas escuras por cima da taipa (soleira, frechal, esteios, travessas e escoras)
# =====================================================================================================================
def _escora(face, plano, p0, p1, larg, e, mat, o):
    """A escora diagonal de p0 = (l, z) até p1 = (l, z): a face da frente e as duas laterais (a espessura)."""
    (la, za), (lb, zb) = p0, p1
    h = larg / 2
    c = CZ.c
    q = [(la - h, za), (la + h, za), (lb + h, zb), (lb - h, zb)]
    c.face_plana([_P(face, plano, l, e, z) for (l, z) in q], _N(face), mat, M, o)
    dl, dz = lb - la, zb - za
    ln = math.hypot(dl, dz)
    for s in (-1, 1):
        nl, nz = (-dz / ln, dl / ln)
        if nl * s < 0:
            nl, nz = -nl, -nz
        pts = [_P(face, plano, la + s * h, 0.0, za), _P(face, plano, lb + s * h, 0.0, zb),
               _P(face, plano, lb + s * h, e, zb), _P(face, plano, la + s * h, e, za)]
        n = (nl, 0.0, nz) if face[1] == 'y' else (0.0, nl, nz)
        c.face_plana(pts, n, mat, M, o)


def _enxaimel(face, plano, l0, l1, z0, z1, aberturas=(), riegel=None, escoras=True, cor=VIGA_COR, seed=0, passo=1.0,
              soleira=True, o=None):
    """
    Um andar de enxaimel numa face: a soleira embaixo, o frechal em cima, os esteios (nas quinas, dos dois lados de
    cada vão e no meio dos panos largos), as travessas do peitoril e da verga em volta das janelas, a travessa do meio
    (riegel) nos panos cheios e a escora diagonal nos panos das quinas (subindo para a quina).
    aberturas: [(a0, a1, zb, zt)] os vãos (já com o batente); a porta tem zb = z0 (a soleira abre nela).
    """
    o = obj() if o is None else o
    mh = mad2(cor, eixo=0, seed=seed, passo=0.05)
    mv = mad2(cor, eixo=1, seed=seed + 1, passo=0.05)
    md = mad2(cor, eixo=0, seed=seed + 2, passo=0.05)

    def b(a0, a1, za, zb, m, e=EV):
        if a1 - a0 > 1e-3 and zb - za > 1e-3:
            CZ.c.caixa(_bx(face, plano, a0, a1, 0.0, e, za, zb), m, M, o)
    # a soleira (aberta na porta) e o frechal
    portas = sorted((a0, a1) for (a0, a1, zb, zt) in aberturas if zb <= z0 + 0.05)
    if soleira:
        x = l0 - EV
        for (a0, a1) in portas:
            b(x, a0, z0, z0 + PW, mh)
            x = a1
        b(x, l1 + EV, z0, z0 + PW, mh)
    b(l0 - EV, l1 + EV, z1 - PW, z1, mh)
    # os esteios
    iv = [(l0 - EV, l0 + PW), (l1 - PW, l1 + EV)]
    for (a0, a1, zb, zt) in aberturas:
        iv += [(a0 - PW, a0), (a1, a1 + PW)]
    iv.sort()
    postes = list(iv)
    for (i0, i1), (j0, j1) in zip(iv[:-1], iv[1:]):
        g = j0 - i1
        n = int(round(g / passo))
        for k in range(1, n):
            m_ = i1 + g * k / n
            postes.append((m_ - PW / 2, m_ + PW / 2))
    postes.sort()
    zp0 = z0 + (PW if soleira else 0.0)
    for (a0, a1) in postes:
        b(a0, a1, zp0, z1 - PW, mv)
    # os panos entre os esteios
    for (i0, i1), (j0, j1) in zip(postes[:-1], postes[1:]):
        pa, pb = i1, j0
        if pb - pa < 0.05:
            continue
        ab = next((x for x in aberturas if x[0] >= pa - 1e-6 and x[1] <= pb + 1e-6), None)
        if ab is not None:
            a0, a1, zb, zt = ab
            if zb > z0 + 0.05:
                b(pa, pb, zb - PW, zb, mh)
            if zt + PW < z1 - PW - 0.04:
                b(pa, pb, zt, zt + PW, mh)
            continue
        primeiro = i0 <= l0
        ultimo = j1 >= l1
        if escoras and (primeiro or ultimo) and pb - pa > 0.3:
            # a escora sobe para a quina (o "A" das fachadas de enxaimel)
            if primeiro:
                p0, p1 = (pb - PW * 0.55, zp0), (pa + PW * 0.55, z1 - PW)
            else:
                p0, p1 = (pa + PW * 0.55, zp0), (pb - PW * 0.55, z1 - PW)
            _escora(face, plano, p0, p1, PW * 1.05, EV, md, o)
        if riegel is not None:
            b(pa, pb, riegel - PW / 2, riegel + PW / 2, mh)
    return o


def _z_telhado(perfil, v, esp=0.1):
    return FF._interp_z(perfil, v) - esp


def _oitao(face, plano, V0, V1, ZE, perfil, janela=None, cor=VIGA_COR, seed=0):
    """
    O enxaimel do oitão (o triângulo da parede embaixo do telhado): o pendural no meio (ou os dois esteios da
    janelinha do sótão), as duas escoras subindo para ele e a travessa do colarinho. janela: (z0, w, h) no meio.
    """
    o = obj()
    vr, zr = max(perfil, key=lambda p: p[1])
    zt = _z_telhado(perfil, vr) - 0.04
    mh = mad2(cor, eixo=0, seed=seed, passo=0.05)
    mv = mad2(cor, eixo=1, seed=seed + 1, passo=0.05)

    def b(a0, a1, za, zb, m):
        CZ.c.caixa(_bx(face, plano, a0, a1, 0.0, EV, za, zb), m, M, o)
    if janela is None:
        b(vr - PW / 2, vr + PW / 2, ZE, zt, mv)
        topo_e = ZE + (zt - ZE) * 0.55
        alvo = [(vr - PW / 2, topo_e), (vr + PW / 2, topo_e)]
    else:
        jz, jw, jh = janela
        a0, a1 = vr - jw / 2 - FR, vr + jw / 2 + FR
        for (p0, p1) in ((a0 - PW, a0), (a1, a1 + PW)):
            # o esteio vai até o telhado (cortado pela água)
            zz = min(_z_telhado(perfil, p0 if p0 < vr else p1), _z_telhado(perfil, p1 if p0 < vr else p0)) - 0.03
            b(p0, p1, ZE, zz, mv)
        b(a0, a1, jz - FR - PW, jz - FR, mh)
        b(a0, a1, jz + jh + FR, jz + jh + FR + PW, mh)
        alvo = [(a0 - PW, jz + jh * 0.7), (a1 + PW, jz + jh * 0.7)]
    # as escoras: do pé, perto da quina, até o pendural (ou o esteio da janela)
    md = mad2(cor, eixo=0, seed=seed + 2, passo=0.05)
    for (vq, (va, za)) in ((V0, alvo[0]), (V1, alvo[1])):
        sg = 1 if vq < vr else -1
        pe = vq + sg * 0.42
        # o alto da escora fica embaixo da água (com folga)
        zlim = _z_telhado(perfil, va) - 0.12
        za = min(za, zlim)
        _escora(face, plano, (pe, ZE), (va - sg * PW * 0.5, za), PW, EV, md, o)
    return o


# =====================================================================================================================
# a janela acesa de cristal, a porta de tábuas, o lampião de cristal
# =====================================================================================================================
def mat_vidro_cristal(uf, vf, acesa=True):
    """
    O vidro da janela: aceso, a luz vermelha e morna do cristal lá dentro (em degraus, mais forte embaixo do meio, onde
    fica o cristal) com a sombra da verga em cima; apagado, o vidro escuro com o reflexo em diagonal.
    uf(P), vf(P): a posição no vidro (0 a 1, da esquerda para a direita e de baixo para cima).
    """
    cs = [hx(x) for x in LUZ_JAN]

    def f(L, n, P):
        u, v = uf(P), vf(P)
        if not acesa:
            out = np.tile(hx('#2a2c34'), (len(P), 1))
            out = np.where((v > 0.62)[:, None], hx('#32363e'), out)
            d = v * 1.6 - u * 1.0
            out = np.where(((d > 0.55) & (d < 0.75))[:, None], hx('#4e5560'), out)
            return out
        r = np.maximum(np.abs(u - 0.5) * 2.0, np.abs(v - 0.36) * 1.55)
        out = np.where((r < 0.42)[:, None], cs[0], np.where((r < 0.72)[:, None], cs[1], np.where((r < 1.0)[:, None], cs[2], cs[3])))
        return np.where((v > 0.86)[:, None], cs[3], out)
    return emissivo(f)


def _janela(face, plano, a, z0, w, h, acesa=True, folhas=True, cruz=True, seed=0, moldura=VIGA_J, peitoril=True):
    """
    A janela na fachada: o vidro (aceso de vermelho ou escuro) um pouco para dentro, o batente escuro, a cruz da
    esquadria, o peitoril de tábua e as duas folhas de tábua abertas para os lados.
    """
    c = CZ.c
    a0, a1 = a - w / 2, a + w / 2
    bx = lambda l0, l1, e0, e1, za, zb: _bx(face, plano, l0, l1, e0, e1, za, zb)
    lat = 0 if face[1] == 'y' else 1
    sgl = 1.0
    uf = lambda P: (P[:, lat] - a0) / (a1 - a0)
    vf = lambda P: (P[:, 2] - z0) / h
    ov = obj(contorno=not acesa)
    if acesa:
        CZ.luzes.add(ov)
    c.caixa(bx(a0, a1, -0.04, 0.004, z0, z0 + h), mat_vidro_cristal(uf, vf, acesa), M, ov)
    o = obj()
    m = liso(moldura)
    for b in (bx(a0 - FR, a0, 0, 0.055, z0, z0 + h), bx(a1, a1 + FR, 0, 0.055, z0, z0 + h),
              bx(a0 - FR, a1 + FR, 0, 0.055, z0 + h, z0 + h + FR), bx(a0 - FR, a1 + FR, 0, 0.055, z0 - FR, z0)):
        c.caixa(b, m, M, o)
    if peitoril:
        caixa(bx(a0 - FR - 0.07, a1 + FR + 0.07, 0, 0.11, z0 - FR - 0.06, z0 - FR), {'cima': liso('#7a5232'), '*': liso('#5a3a24')})
    if cruz:
        oc = obj(contorno=False)
        cc = liso(moldura)
        am = (a0 + a1) / 2
        c.caixa(bx(am - PH * 0.7, am + PH * 0.7, 0, 0.02, z0, z0 + h), cc, M, oc)
        zz = z0 + h * 0.56
        c.caixa(bx(a0, a1, 0, 0.02, zz - PZ * 0.7, zz + PZ * 0.7), cc, M, oc)
    if folhas:
        sw = w * 0.5 + FR * 0.5
        mt = FF.mat_tabua_v(JANELA_TAB, 0.075, '#3a1410', seed=seed + 11)
        for (l0, l1) in ((a0 - FR - sw, a0 - FR), (a1 + FR, a1 + FR + sw)):
            caixa(bx(l0, l1, 0.045, 0.075, z0 - 0.02, z0 + h + 0.02), {'*': mt, 'cima': liso('#7e3a2a')})
            # as duas travessas de trás da folha (o Z não aparece de frente: só as pontas de ferro das dobradiças)
            for zz in (z0 + h * 0.2, z0 + h * 0.78):
                ld = l1 - 0.07 if l0 < a0 else l0
                caixa(bx(ld, ld + 0.07, 0.075, 0.085, zz, zz + 0.035), liso(FERRO), contorno=False)
    return (a0 - FR, a1 + FR, z0 - FR, z0 + h + FR)


def mat_porta_tabuas(a0, a1, z0, z1, eixo_lat=0, cores=PORTA_COR, seed=0):
    """A porta de tábuas em pé (a junta escura de 1 px, a luz depois da junta e o veio)."""
    return FF.mat_tabua_v(cores, 0.12, '#2a1a10', seed=seed)


def _porta(face, plano, a, z0, w, h, folhas=1, cores=PORTA_COR, seed=0, moldura=VIGA_J, postigo=False):
    """
    A porta de tábuas: o batente grosso e a verga escuros, as folhas de tábua um pouco para dentro, as duas ferragens
    de ferro atravessadas com os cravos, a argola. postigo: a janelinha de grade no alto (acesa por dentro).
    Devolve o vão (para o enxaimel).
    """
    c = CZ.c
    a0, a1 = a - w / 2, a + w / 2
    z1 = z0 + h
    bx = lambda l0, l1, e0, e1, za, zb: _bx(face, plano, l0, l1, e0, e1, za, zb)
    m = mad2(moldura, eixo=1, seed=seed, passo=0.05)
    caixa(bx(a0 - 0.08, a0, 0, 0.07, z0, z1 + 0.04), m)
    caixa(bx(a1, a1 + 0.08, 0, 0.07, z0, z1 + 0.04), m)
    caixa(bx(a0 - 0.14, a1 + 0.14, 0, 0.09, z1 + 0.04, z1 + 0.16), mad2(moldura, eixo=0, seed=seed + 1, passo=0.05))
    od = obj()
    mt = FF.mat_tabua_v(cores, 0.11, '#2a1a10', seed=seed + 3)
    meio = (a0 + a1) / 2
    if folhas == 2:
        c.caixa(bx(a0, meio, -0.03, 0.015, z0, z1), mt, M, od)
        c.caixa(bx(meio, a1, -0.03, 0.015, z0, z1), mt, M, obj())
    else:
        c.caixa(bx(a0, a1, -0.03, 0.015, z0, z1), mt, M, od)
    # as ferragens (as faixas de ferro com os cravos claros)
    oc = obj(contorno=False)
    for zz in (z0 + h * 0.2, z0 + h * 0.74):
        for (l0, l1) in (((a0 + 0.03, meio - 0.03), (meio + 0.03, a1 - 0.03)) if folhas == 2 else ((a0 + 0.03, a1 - 0.12),)):
            c.caixa(bx(l0, l1, 0.015, 0.027, zz, zz + 0.055), liso(FERRO), M, oc)
            for lc in np.arange(l0 + 0.05, l1 - 0.02, 0.13):
                c.caixa(bx(lc, lc + PH, 0.027, 0.031, zz + 0.02, zz + 0.02 + PZ), liso('#8a8278'), M, oc)
    # a argola
    for lx in ((meio - 0.08, meio + 0.05) if folhas == 2 else (a1 - 0.14,)):
        caixa(bx(lx, lx + 0.05, 0.015, 0.045, z0 + h * 0.47, z0 + h * 0.47 + 0.07), liso('#a08a5a'), contorno=False)
    if postigo:
        ov = obj(contorno=False)
        CZ.luzes.add(ov)
        pa0, pa1 = meio - 0.13, meio + 0.13
        pz0, pz1 = z1 - 0.52, z1 - 0.28
        lat = 0 if face[1] == 'y' else 1
        c.caixa(bx(pa0, pa1, 0.0, 0.017, pz0, pz1),
                mat_vidro_cristal(lambda P: (P[:, lat] - pa0) / (pa1 - pa0), lambda P: (P[:, 2] - pz0) / (pz1 - pz0)), M, ov)
        og = obj(contorno=False)
        for lg in (meio - 0.045, meio + 0.045):
            c.caixa(bx(lg - PH * 0.6, lg + PH * 0.6, 0.017, 0.03, pz0, pz1), liso(FERRO), M, og)
    return (a0 - 0.08, a1 + 0.08, z0, z1 + 0.16)


def _degraus(face, plano, a, w, z_alto, n=2, prof=0.22, seed=0):
    """Os degraus de pedra na frente da porta (de z_alto até o chão)."""
    eixo = 0 if face[1] == 'y' else 1
    fnd = lambda P: np.floor((P[:, eixo] + 50) / 0.42).astype(np.int64)
    mat = FF.mat_juntas(['#b0a898', '#a49c8c', '#bab2a2'], fnd, '#5e584e', seed=seed)
    for k in range(n):
        zt = z_alto * (n - k) / n
        caixa(_bx(face, plano, a - w / 2, a + w / 2, 0.0, prof * (k + 1), 0.0, zt), mat)


def _cristal(cx, cy, z0, r, h, o=None, lados=6, giro=0.3):
    """
    O cristal vermelho aceso (a lâmpada da vila): a bipirâmide de seis faces, cada faceta num tom chapado pela luz
    (a de cima à esquerda acende), sem contorno (é luz).
    """
    c = CZ.c
    o = obj(contorno=False) if o is None else o
    CZ.luzes.add(o)
    cs = [hx(x) for x in CRISTAL]
    zb, zm, zt = z0 + h * 0.28, z0 + h * 0.72, z0 + h

    def tom(n):
        nn = np.asarray(n, float)
        nn = nn / np.linalg.norm(nn)
        d = BE.n_mundo(nn) @ BE._LUZ2
        k = 0 if d > 0.85 else (1 if d > 0.55 else (2 if d > 0.2 else 3))
        return liso(_hex(cs[k]))
    pts = [(cx + r * math.cos(giro + 2 * math.pi * i / lados), cy + r * math.sin(giro + 2 * math.pi * i / lados)) for i in range(lados)]
    for i in range(lados):
        (xa, ya), (xb, yb) = pts[i], pts[(i + 1) % lados]
        am = giro + 2 * math.pi * (i + 0.5) / lados
        nh = (math.cos(am), math.sin(am))
        c.face_plana([(xa, ya, zb), (xb, yb, zb), (xb, yb, zm), (xa, ya, zm)], (nh[0], nh[1], 0.0), tom((nh[0], nh[1], 0.0)), M, o)
        nt = (nh[0], nh[1], r / (zt - zm))
        c.face_plana([(xa, ya, zm), (xb, yb, zm), (cx, cy, zt)], nt, tom(nt), M, o)
        nb = (nh[0], nh[1], -r / (zb - z0))
        c.face_plana([(xa, ya, zb), (cx, cy, z0), (xb, yb, zb)], nb, tom(nb), M, o)
    return o


def _lampiao_cristal(face, plano, a, z, alto=0.34):
    """O lampião de parede: o braço de ferro, a gaiola (quatro varetas, o chapéu e a base) e o cristal aceso dentro."""
    c = CZ.c
    bx = lambda l0, l1, e0, e1, za, zb: _bx(face, plano, l0, l1, e0, e1, za, zb)
    ferro = liso('#2a2624')
    caixa(bx(a - 0.025, a + 0.025, 0.0, 0.05, z + alto * 0.6, z + alto + 0.12), ferro)
    caixa(bx(a - 0.02, a + 0.02, 0.0, 0.24, z + alto + 0.08, z + alto + 0.12), ferro)
    cx, cy, _ = _P(face, plano, a, 0.24, 0.0)
    s = 0.09
    caixa((cx - s - 0.02, cx + s + 0.02, cy - s - 0.02, cy + s + 0.02, z, z + 0.04), ferro)
    o = obj()
    for (px, py) in ((cx - s, cy - s), (cx + s, cy - s), (cx - s, cy + s), (cx + s, cy + s)):
        c.caixa((px - 0.012, px + 0.012, py - 0.012, py + 0.012, z + 0.04, z + alto - 0.02), ferro, M, o)
    oc = obj()
    zc = z + alto - 0.02
    for (pts, n) in (([(cx - s - 0.03, cy + s + 0.03, zc), (cx + s + 0.03, cy + s + 0.03, zc), (cx, cy, zc + 0.11)], (0, 0.7, 0.7)),
                     ([(cx + s + 0.03, cy + s + 0.03, zc), (cx + s + 0.03, cy - s - 0.03, zc), (cx, cy, zc + 0.11)], (0.7, 0, 0.7)),
                     ([(cx - s - 0.03, cy - s - 0.03, zc), (cx - s - 0.03, cy + s + 0.03, zc), (cx, cy, zc + 0.11)], (-0.7, 0, 0.7)),
                     ([(cx + s + 0.03, cy - s - 0.03, zc), (cx - s - 0.03, cy - s - 0.03, zc), (cx, cy, zc + 0.11)], (0, -0.7, 0.7))):
        c.face_plana(pts, n, liso('#3a3230'), M, oc)
    _cristal(cx, cy, z + 0.05, 0.055, alto - 0.1)


def _fumaca(x, y, z, n=4, seed=0, r=0.22, sobe=0.42, vento=(0.16, -0.05)):
    """
    A fumaça da chaminé (só desenho): os rolos subindo, abrindo e indo com o vento, cada um em três tons chapados
    (o de cima à esquerda mais claro), sem contorno; os de cima mais transparentes no tom (mais perto do céu).
    """
    rng = np.random.default_rng(seed)
    for k in range(n):
        rr = r * (1.0 + 0.32 * k) * (0.9 + 0.2 * rng.random())
        p = (x + vento[0] * k * k * 0.6 + 0.05 * rng.random(), y + vento[1] * k, z + 0.12 + k * sobe + rr * 0.6)
        base = np.array([196.0, 190.0, 184.0]) * (1 - 0.06 * k) + np.array([40.0, 40.0, 44.0]) * 0.06 * k

        def m(Pc, N, P, base=base):
            d = N @ (np.array([-0.45, 0.35, 0.82]) / np.linalg.norm([-0.45, 0.35, 0.82]))
            k_ = np.where(d > 0.55, 1.06, np.where(d > 0.05, 0.93, 0.8))
            return FF._cru_eli(base[None, :] * k_[:, None], N)
        o = obj(contorno=False, sombra=False)
        CZ.c.elipsoide(p, (rr, rr, rr * 0.78), m, o)


def _moita(x, y, r=0.22, h=0.4, seed=0, pal=None, flores=None):
    """A moita da vila (as plantas de cor estranha: roxa, amarelada, azulada), encostada na parede."""
    o = obj()
    rng = np.random.default_rng(seed + 90)
    pal = pal or MOITA_ROXA
    m = FF.mat_folha((x, y, h * 0.45), (r * 1.3, r * 1.3, h * 0.6), pal, q=0.06, seed=seed + 7, flores=flores)
    FF._cachos(o, x, y, h * 0.4, r, h * 0.42, 12, r * 0.25, r * 0.42, rng, m, corte=0.0)
    pegada_redonda(x, y, r * 0.9, 5)


MOITA_ROXA = [hx(x) for x in ('#1e1428', '#2e1e40', '#44305c', '#5e4478', '#7a5c96', '#9a7ab2')]
MOITA_OCRE = [hx(x) for x in ('#2a2412', '#3e3418', '#5a4a20', '#7a6428', '#9a8032', '#b89c44')]
MOITA_AZUL = [hx(x) for x in ('#121e2a', '#1a2c3c', '#243e52', '#305468', '#406c80', '#5a8a9a')]


# =====================================================================================================================
# o canvas do exportador: a torre (9 m) passa do alto que ele reserva (4,6 m). Enquanto ele desenha um prédio alto
# daqui, a conta da caixa da imagem usa o alto do prédio (o resto do exportador não muda; a âncora continua certa).
# =====================================================================================================================
ALTO_CANVAS = {'torre_porteiro': 9.5, 'hotel_predio': 8.2, 'casa_doutor': 7.8, 'taverna_predio': 7.0}


def _canvas_alto():
    main = sys.modules.get('__main__')
    t0 = getattr(main, 'tela', None)
    if t0 is None or getattr(t0, '_vila', False) or not hasattr(main, 'ITENS'):
        return

    def tela_alta(P):
        A = np.asarray(P, float)
        if A.ndim == 2 and A.shape == (8, 3):
            f = sys._getframe(1)
            nome = f.f_locals.get('nome') if f.f_code.co_name == 'desenhar' else None
            if nome in ALTO_CANVAS:
                A = A.copy()
                A[:, 2] = np.where(A[:, 2] > 0, max(ALTO_CANVAS[nome], float(A[:, 2].max())), A[:, 2])
        return t0(A)
    tela_alta._vila = True
    main.tela = tela_alta


_canvas_alto()


# =====================================================================================================================
# um corpo de enxaimel (as quatro faces de um andar, com as janelas e as portas)
# =====================================================================================================================
def _ocupa(v, z0):
    """O que um vão ocupa na fachada: (a0, a1, z0, z1), com o batente e, na janela, as duas folhas abertas."""
    if v[0] == 'j':
        _, a, zj, w, h, _, folhas = v
        lado = w / 2 + FR + ((w * 0.5 + FR * 0.5) if folhas else 0.0)
        return (a - lado, a + lado, zj - FR, zj + h + FR)
    _, a, w, h, _, _ = v
    return (a - w / 2 - FR, a + w / 2 + FR, z0, z0 + h + FR)


def _conferir_vaos(vaos, z0):
    """
    Nada em cima de nada na mesma fachada (14/10, o Felipe: "janelas bugadas"; a folha aberta da janela caía em cima
    da porta). Para na hora de exportar, com o que bateu, para não ir errado para o jogo.
    """
    erros = []
    for face, lista in vaos.items():
        caixas = [(v, _ocupa(v, z0)) for v in lista]
        for i in range(len(caixas)):
            for k in range(i + 1, len(caixas)):
                (va, A), (vb, Bx) = caixas[i], caixas[k]
                if A[0] < Bx[1] - 1e-6 and Bx[0] < A[1] - 1e-6 and A[2] < Bx[3] - 1e-6 and Bx[2] < A[3] - 1e-6:
                    erros.append(f'{face}: {va[0]} em {va[1]:.2f} m bate em {vb[0]} em {vb[1]:.2f} m')
    if erros:
        raise ValueError('vãos encavalados na fachada: ' + '; '.join(erros))


def _andar(B, z0, z1, vaos, riegel=None, cor=VIGA_COR, seed=0, soleira=True, escoras=True):
    """
    vaos: {face: [('j', a, zj, w, h, acesa, folhas) | ('p', a, w, h, folhas, postigo)]} as janelas e as portas do andar
    em cada face. Desenha as janelas, as portas e o enxaimel em volta delas.
    """
    L = _lados(B)
    _conferir_vaos(vaos, z0)
    for face, (plano, l0, l1) in L.items():
        abert = []
        for k, v in enumerate(vaos.get(face, [])):
            if v[0] == 'j':
                _, a, zj, w, h, acesa, folhas = v
                abert.append(_janela(face, plano, a, zj, w, h, acesa=acesa, folhas=folhas, seed=seed + k))
            else:
                _, a, w, h, folhas, postigo = v
                abert.append(_porta(face, plano, a, z0, w, h, folhas=folhas, seed=seed + k, postigo=postigo))
        _enxaimel(face, plano, l0, l1, z0, z1, abert, riegel=riegel, cor=cor, seed=seed + 5 * len(face) + int(plano * 7),
                  soleira=soleira, escoras=escoras)


# =====================================================================================================================
# a casa da vila (6 x 5 casas, 5,0 m): a casinha de enxaimel, o oitão na frente, a chaminé de pedra
# =====================================================================================================================
def _casa_vila():
    W, D = 6 * CASA, 5 * CASA
    X0, X1, Y0, Y1 = 0.32, W - 0.32, 0.3, D - 0.5
    B = (X0, X1, Y0, Y1)
    XP = _porta_x(6)
    XM = (X0 + X1) / 2
    ZB, ZE, ZR = 0.3, 2.65, 5.0 - 0.05
    BEI = 0.3
    TAIPA = mat_taipa(seed=1)
    caixa((X0, X1, Y0, Y1, 0, ZE), TAIPA)
    FF.rodape_pedra(B, ZB)
    YM = (Y0 + Y1) / 2
    vaos = {
        '+y': [('p', XP, 0.86, 1.9, 1, True), ('j', X0 + 0.95, 1.05, 0.56, 0.72, True, True)],
        '-y': [('j', X0 + 1.4, 1.05, 0.56, 0.72, True, True)],
        '+x': [('j', YM, 1.05, 0.56, 0.72, True, True)],
        '-x': [('j', YM, 1.05, 0.56, 0.72, False, True)],
    }
    _andar(B, ZB, ZE - 0.1, vaos, riegel=1.05 - FR - 0.07, seed=3)
    _degraus('+y', Y1, XP, 1.15, ZB, n=2, prof=0.18)
    # o telhado de duas águas com o oitão na frente (a cumeeira ao longo de y)
    KT = (ZR - ZE) / (XM - X0)
    perfil = [(X0 - BEI, ZE - BEI * KT), (XM, ZR), (X1 + BEI, ZE - BEI * KT)]
    FF.telhado(Y0, Y1, X0, X1, perfil, 'y', TELHA_V, TELHA_VJ, TAIPA, testeira='#5a3a24', cumeeira=CUMEEIRA_V, seed=5,
               beiral_u=0.28, musgo=0.0)
    # o enxaimel e a janelinha do sótão nos dois oitões
    jz = ZE + 0.42
    _janela('+y', Y1, XM, jz, 0.42, 0.52, acesa=True, folhas=False)
    _oitao('+y', Y1, X0, X1, ZE - 0.1, perfil, janela=(jz, 0.42, 0.52), seed=7)
    _oitao('-y', Y0, X0, X1, ZE - 0.1, perfil, seed=8)
    # a chaminé de pedra (o fogão de dentro) na água da direita, perto do fundo
    FF.chamine(X1 - 1.15, X1 - 0.68, Y0 + 0.55, Y0 + 1.02, ZE - 0.5, ZR + 0.3)
    _fumaca(X1 - 0.92, Y0 + 0.78, ZR + 0.35, n=3, seed=2, r=0.13, sobe=0.3)
    # o lampião de cristal do lado da porta
    _lampiao_cristal('+y', Y1, XP + 0.75, 1.55)
    # as plantas estranhas encostadas na parede
    _moita(X0 + 0.45, Y1 + 0.22, 0.2, 0.42, seed=1)
    _moita(X1 + 0.18, Y1 - 0.5, 0.2, 0.5, seed=2, pal=MOITA_OCRE)
    _moita(X0 - 0.15, Y0 + 0.6, 0.18, 0.4, seed=3, pal=MOITA_AZUL)
    pegada(X0, X1, Y0, Y1)


# =====================================================================================================================
# a taverna (10 x 7 casas, 6,0 m): dois pisos de enxaimel (o de cima em balanço na frente), a placa de ferro com a
# caneca, os barris na frente, as janelas acesas
# =====================================================================================================================
def _placa_caneca(x, y_parede, z_braco):
    """
    A placa pendurada: o braço de ferro saindo da parede (com a mão-francesa), as duas correntes e a chapa de ferro
    com a caneca de cobre recortada (a espuma clara em cima e a asa), de frente para os lados (+x e -x).
    """
    c = CZ.c
    ferro = liso('#2a2624')
    caixa((x - 0.025, x + 0.025, y_parede, y_parede + 0.92, z_braco, z_braco + 0.05), ferro)
    o = obj()
    FF._viga(o, (x, y_parede, z_braco - 0.42), (x, y_parede + 0.5, z_braco), 0.035, ferro)
    caixa((x - 0.02, x + 0.02, y_parede + 0.88, y_parede + 0.94, z_braco + 0.05, z_braco + 0.09), liso('#3a3430'))
    ya, yb = y_parede + 0.16, y_parede + 0.88
    za, zb = z_braco - 0.78, z_braco - 0.1
    for yc in (ya + 0.05, yb - 0.05):
        caixa((x - 0.012, x + 0.012, yc - 0.012, yc + 0.012, zb, z_braco), liso('#4a4440'), contorno=False)

    def chapa(L, n, P):
        u = (P[:, 1] - ya) / (yb - ya)
        v = (P[:, 2] - za) / (zb - za)
        if n[0] < 0:
            u = 1 - u
        out = np.tile(hx('#34302e'), (len(P), 1))
        borda = (u < 0.07) | (u > 0.93) | (v < 0.08) | (v > 0.92)
        out = np.where(borda[:, None], hx('#4a4542'), out)
        # a caneca: o corpo de cobre, a asa (o anel do lado), a espuma em cima e os aros escuros
        corpo = (u > 0.26) & (u < 0.6) & (v > 0.2) & (v < 0.68)
        du, dv = (u - 0.62) / 0.13, (v - 0.44) / 0.17
        asa = (du * du + dv * dv < 1.0) & (du * du + dv * dv > 0.3) & (u > 0.58)
        esp = (u > 0.23) & (u < 0.63) & (v >= 0.66) & (v < 0.8) & ~((u > 0.5) & (v > 0.76))
        out = np.where((corpo | asa)[:, None], hx('#c27a3e'), out)
        out = np.where((corpo & (u < 0.33))[:, None], hx('#e09a52'), out)
        out = np.where((corpo & ((np.abs(v - 0.3) < 0.035) | (np.abs(v - 0.58) < 0.035)))[:, None], hx('#7a4220'), out)
        out = np.where(esp[:, None], hx('#efe2c4'), out)
        return out
    caixa((x - 0.018, x + 0.018, ya, yb, za, zb), {'*': emissivo(chapa), 'cima': liso('#4a4542')})


def _taverna():
    W, D = 10 * CASA, 7 * CASA
    X0, X1, Y0, Y1 = 0.3, W - 0.3, 0.3, D - 0.75
    B = (X0, X1, Y0, Y1)
    J = 0.32                                    # o balanço do andar de cima, na frente e atrás
    B2 = (X0, X1, Y0 - J, Y1 + J)
    XP = _porta_x(10)
    ZB, ZF, ZE, ZR = 0.38, 2.55, 4.55, 6.0 - 0.05
    TAIPA = mat_taipa('#d8c9a4', seed=2)
    caixa((X0, X1, Y0, Y1, 0, ZF), TAIPA)
    FF.rodape_pedra(B, ZB)
    caixa((B2[0], B2[1], B2[2], B2[3], ZF, ZE), TAIPA)
    # as cabeças das vigas do piso (o balanço), na frente e atrás
    mv = mad2(VIGA_COR, eixo=1, seed=4, passo=0.05)
    for (y0_, y1_) in ((Y1, Y1 + J), (Y0 - J, Y0)):
        caixa((X0 - EV, X1 + EV, y0_, y1_, ZF - 0.02, ZF + 0.02), liso(VIGA_COR), contorno=False)
        for x in np.arange(X0 + 0.12, X1 - 0.05, 0.55):
            caixa((x, x + 0.12, y0_, y1_, ZF - 0.16, ZF), mv)
    YM = (Y0 + Y1) / 2
    jw, jh = 0.68, 0.82
    vaos1 = {
        # a primeira janela 10 cm para a quina: as folhas abertas dela e da vizinha batiam (14/10)
        '+y': [('p', XP, 1.25, 2.0, 2, False), ('j', X0 + 0.8, 1.05, jw, jh, True, True), ('j', X0 + 2.35, 1.05, jw, jh, True, True),
               ('j', X1 - 0.85, 1.05, jw, jh, True, True)],
        '-y': [('j', X0 + 1.2, 1.05, jw, jh, True, True), ('j', X0 + 3.3, 1.05, jw, jh, False, True), ('j', X1 - 1.4, 1.05, jw, jh, True, True)],
        '+x': [('j', YM, 1.05, jw, jh, True, True)],
        '-x': [('j', YM + 0.5, 1.05, jw, jh, True, True)],
    }
    _andar(B, ZB, ZF, vaos1, riegel=1.05 - FR - 0.07, seed=11)
    # o andar de cima (em balanço)
    z2 = ZF + 0.62
    vaos2 = {
        '+y': [('j', X0 + 0.9, z2, 0.6, 0.78, True, True), ('j', X0 + 2.35, z2, 0.6, 0.78, False, True), ('j', XP, z2, 0.6, 0.78, True, True),
               ('j', X1 - 0.85, z2, 0.6, 0.78, True, True)],
        '-y': [('j', X0 + 1.2, z2, 0.6, 0.78, True, True), ('j', X1 - 1.4, z2, 0.6, 0.78, False, True)],
        '+x': [('j', YM, z2, 0.6, 0.78, False, True)],
        '-x': [('j', YM, z2, 0.6, 0.78, True, True)],
    }
    _andar(B2, ZF, ZE - 0.1, vaos2, riegel=z2 - FR - 0.07, seed=21)
    _degraus('+y', Y1, XP, 1.6, ZB, n=2, prof=0.2)
    # o telhado (a cumeeira ao longo de x) e a chaminé de pedra no oitão da esquerda
    BEI = 0.3
    YR = (B2[2] + B2[3]) / 2
    KT = (ZR - ZE) / (YR - B2[2])
    perfil = [(B2[2] - BEI, ZE - BEI * KT), (YR, ZR), (B2[3] + BEI, ZE - BEI * KT)]
    FF.telhado(X0, X1, B2[2], B2[3], perfil, 'x', TELHA_V, TELHA_VJ, TAIPA, testeira='#5a3a24', cumeeira=CUMEEIRA_V, seed=9,
               beiral_u=0.3, musgo=0.0)
    _oitao('+x', X1, B2[2], B2[3], ZE - 0.1, perfil, seed=13)
    _oitao('-x', X0, B2[2], B2[3], ZE - 0.1, perfil, seed=14)
    # a chaminé de pedra encostada no oitão da esquerda (do chão até passar a cumeeira)
    cy0 = YR - 0.35
    caixa((X0 - 0.55, X0, cy0, cy0 + 0.7, 0, ZE), mat_pedra(seed=3, alt=0.14, comp=0.28))
    FF.chamine(X0 - 0.48, X0 + 0.05, cy0 + 0.07, cy0 + 0.63, ZE - 0.05, ZR + 0.45)
    _fumaca(X0 - 0.2, cy0 + 0.35, ZR + 0.5, n=3, seed=4, r=0.15, sobe=0.32)
    # a placa da caneca (à esquerda da porta, pendurada do andar de cima) e os lampiões
    _placa_caneca(XP - 1.0, Y1 + J, ZF + 0.55)
    _lampiao_cristal('+y', Y1, XP + 0.95, 1.5)
    # os barris na frente (dois de pé e um deitado... de pé, um em cima do outro não: três lado a lado) e o banco
    BE.barril_cesto(X0 + 0.55, Y1 + 0.5, r=0.27, h=0.72)
    BE.barril_cesto(X0 + 1.18, Y1 + 0.42, r=0.25, h=0.62)
    BE.barril_cesto(X1 - 0.5, Y1 + 0.48, r=0.27, h=0.72)
    _banco(X0 + 1.85, X0 + 3.0, Y1 + 0.1)
    _moita(X1 - 1.15, Y1 + 0.25, 0.2, 0.4, seed=5, pal=MOITA_ROXA)
    _moita(X1 + 0.2, Y0 + 0.6, 0.2, 0.46, seed=6, pal=MOITA_OCRE)
    pegada(X0, X1, Y0, Y1)


def _banco(x0, x1, y0):
    """O banco de tábua grossa encostado na parede (pés de toco)."""
    tab = FF.mat_cor(['#7a5232', '#70482c'], lambda L, n: np.floor(L[:, 1] / 0.12).astype(np.int64))
    caixa((x0, x1, y0, y0 + 0.36, 0.38, 0.45), {'cima': tab, '*': liso('#5a3a24')})
    for xx in (x0 + 0.08, x1 - 0.2):
        caixa((xx, xx + 0.12, y0 + 0.06, y0 + 0.3, 0.0, 0.38), mad2('#4e321e', eixo=1, seed=3, passo=0.04))


# =====================================================================================================================
# a ferraria (8 x 6 casas, 5,0 m): de pedra, a chaminé larga soltando fumaça e o alpendre aberto da forja à direita
# =====================================================================================================================
FORJA_C = (4.95, 1.55)                     # o meio das brasas (para o brilho laranja em volta)


def _brilho_forja(L, n, P, out, i0=None, forca=1.0):
    """O brilho laranja da forja nas paredes e no chão do alpendre: em três degraus, pela distância das brasas."""
    d = np.hypot(P[:, 0] - FORJA_C[0], P[:, 1] - FORJA_C[1]) + np.maximum(P[:, 2] - 0.9, 0) * 0.55
    k = np.where(d < 1.0, 0.42, np.where(d < 1.6, 0.26, np.where(d < 2.3, 0.12, 0.0))) * forca
    lar = np.array([255.0, 132.0, 52.0])
    return out * (1 - k[:, None]) + lar * k[:, None]


def _ferraria():
    W, D = 8 * CASA, 6 * CASA
    X0, X1, Y0, Y1 = 0.3, 4.3, 0.35, D - 0.5
    XA = W - 0.25                                # o fim do alpendre (à direita)
    B = (X0, X1, Y0, Y1)
    XP = _porta_x(8)
    ZE, ZR = 3.0, 5.0 - 0.05
    XM = (X0 + X1) / 2
    YR = (Y0 + Y1) / 2
    PED = mat_pedra(seed=1, alt=0.17, comp=0.34)
    PED_LUZ = mat_pedra(seed=1, alt=0.17, comp=0.34, extra=lambda L, n, P, out, i0: _brilho_forja(L, n, P, out, forca=0.85))
    c = CZ.c
    # o corpo de pedra (a face da direita, dentro do alpendre, com o brilho da forja)
    caixa((X0, X1, Y0, Y1, 0, ZE), {'*': PED, 'dir': PED_LUZ})
    # os cunhais de pedra maior nas quinas (blocos alternados)
    QU = FF.mat_juntas(['#b2aa9c', '#a69e90'], lambda P: np.floor(P[:, 2] / 0.3).astype(np.int64), '#5a544a', seed=2)
    for (xa, ya) in ((X0, Y1), (X1, Y1), (X0, Y0), (X1, Y0)):
        sx = 1 if xa > XM else -1
        sy = 1 if ya > YR else -1
        caixa((min(xa, xa - sx * 0.3), max(xa, xa - sx * 0.3) + 0.0, min(ya, ya + sy * 0.03), max(ya, ya + sy * 0.03), 0.0, ZE - 0.05), QU)
        caixa((min(xa, xa + sx * 0.03), max(xa, xa + sx * 0.03), min(ya, ya - sy * 0.3), max(ya, ya - sy * 0.3), 0.0, ZE - 0.05), QU)
    # a porta (pesada, de tábua, com a verga de pedra) e as janelas (pequenas, com a verga de pedra)
    _porta('+y', Y1, XP, 0.0, 1.0, 2.05, folhas=1, seed=4, moldura='#3a2a1e')
    caixa(_bx('+y', Y1, XP - 0.68, XP + 0.68, 0.0, 0.1, 2.21, 2.42), liso('#a49c8e'))
    _degraus('+y', Y1, XP, 1.3, 0.12, n=1, prof=0.3)
    for (face, plano, a, acesa) in (('+y', Y1, X0 + 1.1, True), ('-y', Y0, X0 + 1.3, True), ('-y', Y0, X1 - 1.1, False),
                                    ('-x', X0, YR, True)):
        _janela(face, plano, a, 1.15, 0.56, 0.68, acesa=acesa, folhas=True, seed=int(a * 10))
        caixa(_bx(face, plano, a - 0.45, a + 0.45, 0.0, 0.08, 1.15 + 0.68 + FR, 1.15 + 0.68 + FR + 0.16), liso('#a49c8e'))
    # o telhado de telha (a cumeeira ao longo de x), enegrecido de fuligem perto da chaminé
    BEI = 0.3
    KT = (ZR - ZE) / (YR - Y0)
    perfil = [(Y0 - BEI, ZE - BEI * KT), (YR, ZR), (Y1 + BEI, ZE - BEI * KT)]
    FF.telhado(X0, X1, Y0, Y1, perfil, 'x', TELHA_V, TELHA_VJ, PED, testeira='#4a3020', cumeeira=CUMEEIRA_V, seed=3,
               beiral_u=0.28, musgo=0.0)
    # ---- o alpendre: o chão de terra batida com o brilho, os esteios grossos, o telhado de uma água
    ZA_HI, ZA_LO = ZE - 0.12, 2.35
    oc = obj(contorno=False)
    cs = np.stack([hx('#5a4634'), hx('#524030'), hx('#625040')])

    def chao(L, n, P):
        bx_ = np.floor(P[:, 0] / (3 * PH))
        by_ = np.floor(P[:, 1] / (3 * PH))
        out = cs[(ruido(bx_, by_, 3.0) * 3).astype(int) % 3]
        return _brilho_forja(L, n, P, out)
    c.face_plana([(X1, Y0, 0.012), (XA, Y0, 0.012), (XA, Y1, 0.012), (X1, Y1, 0.012)], (0, 0, 1), emissivo(chao), M, oc)
    # a parede do fundo do alpendre (pedra baixa e tábuas em cima: fecha as costas)
    caixa((X1, XA, Y0, Y0 + 0.22, 0, 1.0), {'*': PED, 'frente': PED_LUZ})
    TABF = FF.mat_tabua_v(['#5e4028', '#563a24', '#64462c'], 0.16, '#2a1a10', seed=7)
    caixa((X1, XA, Y0 + 0.04, Y0 + 0.16, 1.0, ZA_HI - 0.3), TABF)
    # os esteios e a viga da frente e do lado
    MV = mad2('#4e3420', eixo=1, seed=5, passo=0.05)
    MH = mad2('#4e3420', eixo=0, seed=6, passo=0.05)
    for (px, py) in ((XA - 0.18, Y1 - 0.12), (XA - 0.18, Y0 + 0.3), (X1 + 0.05, Y1 - 0.12)):
        caixa((px - 0.08, px + 0.08, py - 0.08, py + 0.08, 0.0, ZA_LO - 0.05), MV)
        caixa((px - 0.12, px + 0.12, py - 0.12, py + 0.12, 0.0, 0.14), liso('#8a8278'))
    caixa((XA - 0.28, XA - 0.08, Y0, Y1 - 0.02, ZA_LO - 0.17, ZA_LO + 0.02), MH)
    o = obj()
    FF._viga(o, (XA - 0.18, Y1 - 0.12, ZA_LO - 0.75), (XA - 0.18, Y1 - 0.62, ZA_LO - 0.12), 0.09, liso('#4e3420'))
    FF._viga(o, (XA - 0.18, Y0 + 0.3, ZA_LO - 0.75), (XA - 0.18, Y0 + 0.8, ZA_LO - 0.12), 0.09, liso('#4e3420'))
    # o telhado do alpendre (uma água, caindo para +x), com o triângulo de tábua em cima da viga da frente e do fundo
    perf_a = [(X1 - 0.02, ZA_HI), (XA + 0.22, ZA_LO - 0.08)]
    FF.telhado(Y0, Y1, X1 - 0.02, XA, perf_a, 'y', TELHA_V, TELHA_VJ, TABF, testeira='#4a3020', cumeeira=CUMEEIRA_V, seed=8,
               beiral_u=0.22, fuligem=0.15, musgo=0.0)
    # ---- a forja: o fogão de pedra com as brasas (vermelhas e laranja, do cristal no meio do carvão), a coifa e a
    # chaminé larga que sobe pelo telhado do alpendre soltando fumaça
    fx0, fx1, fy0, fy1 = 4.45, 5.45, Y0 + 0.24, Y0 + 1.3
    caixa((fx0, fx1, fy0, fy1, 0.0, 0.82), {'*': mat_pedra(seed=6, alt=0.13, comp=0.24, extra=lambda L, n, P, out, i0: _brilho_forja(L, n, P, out, 0.6)),
                                           'cima': liso('#5a524a')})
    ob = obj(contorno=False)
    CZ.luzes.add(ob)
    bc = [hx(x) for x in ('#ffe0a0', '#ffb050', '#f07028', '#c03a1c', '#5a2014')]

    def brasa(L, n, P):
        bx_ = np.floor(P[:, 0] / (2 * PH))
        by_ = np.floor(P[:, 1] / (2 * PH))
        r = ruido(bx_, by_, 5.0)
        d = np.hypot((P[:, 0] - FORJA_C[0]) / 0.42, (P[:, 1] - (fy0 + fy1) / 2) / 0.4)
        nv = np.clip((d * 2.4 + r * 1.4).astype(int), 0, 4)
        return np.stack(bc)[nv]
    c.face_plana([(fx0 + 0.1, fy0 + 0.1, 0.84), (fx1 - 0.1, fy0 + 0.1, 0.84), (fx1 - 0.1, fy1 - 0.1, 0.84), (fx0 + 0.1, fy1 - 0.1, 0.84)],
                 (0, 0, 1), emissivo(brasa), M, ob)
    # a beira do fogão (a borda de pedra em volta das brasas)
    for b in ((fx0, fx1, fy0, fy0 + 0.1), (fx0, fx1, fy1 - 0.1, fy1), (fx0, fx0 + 0.1, fy0, fy1), (fx1 - 0.1, fx1, fy0, fy1)):
        caixa((b[0], b[1], b[2], b[3], 0.82, 0.9), liso('#7a7268'))
    _cristal(FORJA_C[0], (fy0 + fy1) / 2, 0.82, 0.07, 0.2)
    # a coifa (de pedra, afinando) e a chaminé larga
    hx0, hx1, hy0, hy1 = fx0 + 0.15, fx1 - 0.15, fy0, fy0 + 0.75
    caixa((fx0 + 0.05, fx1 - 0.05, fy0, fy0 + 0.9, 1.75, 2.0), mat_pedra(seed=8, alt=0.12, comp=0.22,
                                                                       extra=lambda L, n, P, out, i0: _brilho_forja(L, n, P, out, 0.5)))
    caixa((hx0, hx1, hy0, hy1, 2.0, ZR + 0.2), mat_pedra(seed=9, alt=0.13, comp=0.26))
    caixa((hx0 - 0.06, hx1 + 0.06, hy0 - 0.06, hy1 + 0.06, ZR + 0.08, ZR + 0.24), {'cima': liso('#7a7468'), '*': liso('#a8a092')})
    caixa((hx0 + 0.08, hx1 - 0.08, hy0 + 0.08, hy1 - 0.08, ZR + 0.24, ZR + 0.242), liso('#1a1412'), contorno=False)
    _fumaca((hx0 + hx1) / 2, (hy0 + hy1) / 2, ZR + 0.26, n=4, seed=7, r=0.24, sobe=0.4)
    # a bigorna no toco, a tina d'água e as barras de ferro encostadas
    ax_, ay_ = 5.05, Y1 - 0.75
    oT = obj()
    CZ.c.cilindro(ax_, ay_, 0.2, 0.0, 0.5, BE.vol(ax_, ay_, '#6a4a2c'), M, oT, lados=16,
                  tampa_mat=liso('#a07a4a'))
    caixa((ax_ - 0.08, ax_ + 0.08, ay_ - 0.1, ay_ + 0.1, 0.5, 0.6), liso('#3a3a40'))
    caixa((ax_ - 0.26, ax_ + 0.16, ay_ - 0.1, ay_ + 0.1, 0.6, 0.72), {'cima': liso('#5e6068'), '*': liso('#3e3e46')})
    caixa((ax_ + 0.16, ax_ + 0.3, ay_ - 0.05, ay_ + 0.05, 0.64, 0.72), liso('#3e3e46'))
    BE.barril_cesto(XA - 0.55, Y1 - 0.45, r=0.24, h=0.5)
    for k in range(3):
        o = obj()
        FF._viga(o, (X1 + 0.12 + k * 0.08, Y1 - 0.3, 0.02), (X1 + 0.06 + k * 0.08, Y1 - 0.25, 1.35 - k * 0.1), 0.03, liso('#4a4a52'))
    _moita(X0 + 0.5, Y1 + 0.22, 0.2, 0.38, seed=8, pal=MOITA_AZUL)
    _moita(X0 - 0.15, Y0 + 0.9, 0.22, 0.45, seed=9, pal=MOITA_ROXA)
    pegada(X0, XA, Y0, Y1)


# =====================================================================================================================
# o hotel (10 x 8 casas, 7,5 m): dois andares de enxaimel, a varanda de madeira em cima da porta, as águas-furtadas
# =====================================================================================================================
def _agua_furtada(x, y_frente, y_fundo, z_base, w, h, perfil_tel, seed=0):
    """
    A água-furtada (a janelinha que sai do telhado): o corpo de taipa com a janela acesa, as faces dos lados, e o
    telhadinho de duas águas com a cumeeira ao longo de y (o oitão virado para a frente).
    """
    TAIPA = mat_taipa(seed=seed + 30, sujeira=0.0)
    x0, x1 = x - w / 2, x + w / 2
    caixa((x0, x1, y_fundo, y_frente, z_base - 0.3, z_base + h), TAIPA)
    for xx in (x0, x1 - PW):
        caixa((xx - 0.01, xx + PW + 0.01, y_frente - 0.02, y_frente + EV, z_base, z_base + h), mad2(VIGA_COR, eixo=1, seed=seed, passo=0.05))
    caixa((x0 - 0.01, x1 + 0.01, y_frente - 0.02, y_frente + EV, z_base + h - PW, z_base + h), mad2(VIGA_COR, eixo=0, seed=seed, passo=0.05))
    _janela('+y', y_frente, x, z_base + 0.2, w - 2 * PW - 2 * FR - 0.04, h - 0.42, acesa=True, folhas=False, peitoril=True)
    BEI = 0.14
    kt = 1.05
    zr = z_base + h + (w / 2) * kt
    perfil = [(x0 - BEI, z_base + h - BEI * kt), (x, zr), (x1 + BEI, z_base + h - BEI * kt)]
    FF.telhado(y_fundo, y_frente, x0, x1, perfil, 'y', TELHA_V, TELHA_VJ, TAIPA, testeira='#5a3a24', cumeeira=CUMEEIRA_V,
               seed=seed, beiral_u=0.12, esp=0.07)


def _hotel():
    W, D = 10 * CASA, 8 * CASA
    X0, X1, Y0, Y1 = 0.3, W - 0.3, 0.3, D - 1.05
    B = (X0, X1, Y0, Y1)
    XP = _porta_x(10)
    ZB, ZF, ZE, ZR = 0.4, 2.85, 5.25, 7.5 - 0.05
    TAIPA = mat_taipa('#d6c8a4', seed=4)
    caixa((X0, X1, Y0, Y1, 0, ZE), TAIPA)
    FF.rodape_pedra(B, ZB)
    YM = (Y0 + Y1) / 2
    jw, jh = 0.62, 0.86
    xs = [X0 + 0.85, X0 + 2.2, X1 - 2.0, X1 - 0.75]
    vaos1 = {
        # as duas janelas do meio sem folhas: abertas, a da direita caía na porta e as do meio batiam nas da quina (14/10)
        '+y': [('p', XP, 1.15, 2.05, 2, True)] + [('j', x, 1.1, jw, jh, k != 1, k in (0, 3)) for k, x in enumerate(xs)],
        # a porta de trás no vão entre as duas janelas (em X1 - 2,6 ela entrava 16 cm na janela da direita; 14/10)
        '-y': [('j', x, 1.1, jw, jh, k in (0, 3), True) for k, x in enumerate(xs[::2])] + [('p', X1 - 3.6, 0.9, 1.95, 1, False)],
        '+x': [('j', Y0 + 1.3, 1.1, jw, jh, True, True), ('j', Y1 - 1.3, 1.1, jw, jh, True, True)],
        '-x': [('j', Y0 + 1.3, 1.1, jw, jh, False, True), ('j', Y1 - 1.3, 1.1, jw, jh, True, True)],
    }
    _andar(B, ZB, ZF, vaos1, riegel=1.1 - FR - 0.07, seed=31)
    z2 = ZF + 0.72
    vaos2 = {
        # em cima também: folhas só nas janelas da quina (as do meio batiam na porta da sacada e nas vizinhas)
        '+y': [('p', XP, 1.0, 1.95, 2, True)] + [('j', x, z2, jw, jh, k in (0, 2, 3), k in (0, 3)) for k, x in enumerate(xs)],
        '-y': [('j', x, z2, jw, jh, k != 2, k in (0, 3)) for k, x in enumerate(xs)],
        '+x': [('j', Y0 + 1.3, z2, jw, jh, False, True), ('j', Y1 - 1.3, z2, jw, jh, True, True)],
        '-x': [('j', Y0 + 1.3, z2, jw, jh, True, True), ('j', Y1 - 1.3, z2, jw, jh, True, True)],
    }
    _andar(B, ZF, ZE - 0.1, vaos2, riegel=z2 - FR - 0.07, seed=41)
    # a faixa entre os andares (a viga do piso, mais saliente)
    caixa((X0 - 0.06, X1 + 0.06, Y0 - 0.06, Y1 + 0.06, ZF - 0.08, ZF + 0.06), {'*': mad2(VIGA_COR, eixo=0, seed=9, passo=0.05), 'cima': liso('#5e4028')})
    # o telhado (a cumeeira ao longo de x), as águas-furtadas na frente e as chaminés nos oitões
    BEI = 0.3
    YR = (Y0 + Y1) / 2
    KT = (ZR - ZE) / (YR - Y0)
    perfil = [(Y0 - BEI, ZE - BEI * KT), (YR, ZR), (Y1 + BEI, ZE - BEI * KT)]
    FF.telhado(X0, X1, Y0, Y1, perfil, 'x', TELHA_V, TELHA_VJ, TAIPA, testeira='#5a3a24', cumeeira=CUMEEIRA_V, seed=12,
               beiral_u=0.3, musgo=0.0)
    _oitao('+x', X1, Y0, Y1, ZE - 0.1, perfil, janela=(ZE + 0.45, 0.48, 0.6), seed=15)
    _oitao('-x', X0, Y0, Y1, ZE - 0.1, perfil, janela=(ZE + 0.45, 0.48, 0.6), seed=16)
    _janela('+x', X1, YR, ZE + 0.45, 0.48, 0.6, acesa=True, folhas=False)
    _janela('-x', X0, YR, ZE + 0.45, 0.48, 0.6, acesa=False, folhas=False)
    for xd in (X0 + 1.5, X1 - 1.5):
        yf = Y1 - 0.55
        zb_ = FF._interp_z(perfil, yf)
        # o fundo da água-furtada some dentro do telhado (a cumeeira dela encontra a água antes da do prédio)
        _agua_furtada(xd, yf, YR + 0.3, zb_, 0.95, 0.9, perfil, seed=int(xd * 10))
    FF.chamine(X0 + 0.35, X0 + 0.85, YR - 0.85, YR - 0.35, ZE - 0.4, ZR + 0.35)
    FF.chamine(X1 - 0.9, X1 - 0.4, YR + 0.3, YR + 0.8, ZE - 0.4, ZR + 0.25)
    _fumaca(X0 + 0.6, YR - 0.6, ZR + 0.4, n=3, seed=11, r=0.13, sobe=0.28)
    # ---- a varanda em cima da porta: o piso de tábua em balanço, as mãos-francesas, os esteios até o chão, o
    # guarda-corpo de balaústres
    VX0, VX1 = XP - 1.3, XP + 1.3
    VY1 = Y1 + 0.85
    zv = ZF + 0.02
    tab = FF.tab2([ '#7a5232', '#70482c', '#82583a'], 0.14, '#3a2414', eixo=0, seed=4)
    caixa((VX0, VX1, Y1, VY1, zv - 0.12, zv), {'cima': tab, '*': mad2('#5a3a24', eixo=0, seed=2, passo=0.05)})
    MVp = mad2('#4e3420', eixo=1, seed=7, passo=0.05)
    for xx in (VX0 + 0.1, VX1 - 0.1):
        caixa((xx - 0.07, xx + 0.07, VY1 - 0.18, VY1 - 0.04, 0.0, zv - 0.12), MVp)
        caixa((xx - 0.1, xx + 0.1, VY1 - 0.21, VY1 - 0.01, 0.0, 0.12), liso('#8a8278'))
        o = obj()
        FF._viga(o, (xx, Y1, zv - 0.75), (xx, Y1 + 0.5, zv - 0.13), 0.08, liso('#4e3420'))
    ob = obj(contorno=False)
    zc = zv + 0.95
    corr = {'cima': liso('#7a5232'), '*': mad2('#5a3a24', eixo=0, seed=8, passo=0.05)}
    # o corrimão na frente e nos lados, os balaústres
    caixa((VX0, VX1, VY1 - 0.1, VY1, zc - 0.07, zc), corr)
    for xx in (VX0, VX1 - 0.1):
        caixa((xx, xx + 0.1, Y1 + 0.02, VY1, zc - 0.07, zc), corr)
        caixa((xx, xx + 0.1, VY1 - 0.1, VY1, zv, zc), MVp)
    for x in np.arange(VX0 + 0.18, VX1 - 0.12, 0.14):
        CZ.c.caixa((x, x + 0.05, VY1 - 0.08, VY1 - 0.03, zv, zc - 0.07), liso('#5e3e26'), M, ob)
    for xx in (VX0 + 0.03, VX1 - 0.08):
        for y in np.arange(Y1 + 0.14, VY1 - 0.12, 0.14):
            CZ.c.caixa((xx, xx + 0.05, y, y + 0.05, zv, zc - 0.07), liso('#5e3e26'), M, ob)
    # o vaso de flor roxa na varanda e os lampiões da porta
    _lampiao_cristal('+y', Y1, XP - 0.95, 1.45)
    _lampiao_cristal('+y', Y1, XP + 0.95, 1.45)
    _degraus('+y', Y1, XP, 1.5, ZB, n=2, prof=0.2)
    # a placa do hotel (a tábua pendurada embaixo da varanda, com a chave pintada)
    _placa_chave(XP, VY1 - 0.06, zv - 0.14)
    _moita(X0 + 0.45, Y1 + 0.25, 0.22, 0.45, seed=12, pal=MOITA_ROXA)
    _moita(X1 - 0.4, Y1 + 0.25, 0.2, 0.4, seed=13, pal=MOITA_AZUL)
    _moita(X1 + 0.18, Y0 + 0.7, 0.2, 0.44, seed=14, pal=MOITA_OCRE)
    pegada(X0, X1, Y0, Y1)


def _placa_chave(x, y, z_topo):
    """A tábua do hotel pendurada embaixo da varanda (duas correntinhas): a chave dourada pintada na madeira."""
    a0, a1 = x - 0.36, x + 0.36
    z1, z0 = z_topo - 0.16, z_topo - 0.5
    for xc in (a0 + 0.06, a1 - 0.06):
        caixa((xc - 0.012, xc + 0.012, y - 0.012, y + 0.012, z1, z_topo), liso('#4a4440'), contorno=False)

    def m(L, n, P):
        u = (P[:, 0] - a0) / (a1 - a0)
        v = (P[:, 2] - z0) / (z1 - z0)
        if n[1] < 0:
            u = 1 - u
        out = np.tile(hx('#6a4428'), (len(P), 1))
        out = np.where(((v < 0.12) | (v > 0.88) | (u < 0.05) | (u > 0.95))[:, None], hx('#4e3020'), out)
        # a chave: a argola à esquerda, a haste e os dentes
        du, dv = (u - 0.27) / 0.1, (v - 0.5) / 0.26
        arg = (du * du + dv * dv < 1.0) & (du * du + dv * dv > 0.28)
        haste = (u > 0.35) & (u < 0.78) & (np.abs(v - 0.5) < 0.08)
        dente = (((u > 0.62) & (u < 0.67)) | ((u > 0.72) & (u < 0.78))) & (v < 0.5) & (v > 0.26)
        ouro = arg | haste | dente
        out = np.where(ouro[:, None], hx('#d8a848'), out)
        return out
    caixa((a0, a1, y - 0.025, y + 0.025, z0, z1), {'*': emissivo(m), 'cima': liso('#7a5232')})


# =====================================================================================================================
# a casa do Doutor (10 x 8 casas, 7,0 m): o casarão austero, o térreo de pedra, o andar de cima de enxaimel escuro,
# as janelas altas (quase todas fechadas), o pórtico de pedra na porta, duas chaminés
# =====================================================================================================================
def _casa_doutor():
    W, D = 10 * CASA, 8 * CASA
    X0, X1, Y0, Y1 = 0.3, W - 0.3, 0.3, D - 0.75
    B = (X0, X1, Y0, Y1)
    XP = _porta_x(10)
    ZF, ZE, ZR = 3.0, 5.35, 7.0 - 0.05
    VIGA_D = '#3a2a20'
    TELHA_D = ['#8a3226', '#94392a', '#7e2c22', '#9a4030']
    PED = mat_pedra(seed=5, alt=0.22, comp=0.45, cores=['#a49c8c', '#9a9282', '#aea696', '#928a7c'], junta='#4a443a')
    TAIPA = mat_taipa('#cbbfa6', seed=6, sujeira=0.0)
    caixa((X0, X1, Y0, Y1, 0, ZF), PED)
    caixa((X0, X1, Y0, Y1, ZF, ZE), TAIPA)
    # a cornija de pedra entre o térreo e o andar
    caixa((X0 - 0.07, X1 + 0.07, Y0 - 0.07, Y1 + 0.07, ZF - 0.12, ZF + 0.02), {'cima': liso('#bab2a2'), '*': liso('#aaa292')})
    # os cunhais (os blocos grandes nas quinas do térreo)
    QU = FF.mat_juntas(['#bcb4a4', '#b0a898'], lambda P: np.floor(P[:, 2] / 0.36).astype(np.int64), '#5a544a', seed=4)
    XM, YR = (X0 + X1) / 2, (Y0 + Y1) / 2
    for (xa, ya) in ((X0, Y1), (X1, Y1), (X0, Y0), (X1, Y0)):
        sx = 1 if xa > XM else -1
        sy = 1 if ya > YR else -1
        caixa((min(xa, xa - sx * 0.34), max(xa, xa - sx * 0.34), min(ya, ya + sy * 0.035), max(ya, ya + sy * 0.035), 0.0, ZF - 0.12), QU)
        caixa((min(xa, xa + sx * 0.035), max(xa, xa + sx * 0.035), min(ya, ya - sy * 0.34), max(ya, ya - sy * 0.34), 0.0, ZF - 0.12), QU)
    # o térreo: as janelas altas com a verga de pedra (a do consultório acesa) e a porta no pórtico
    jw, jh = 0.58, 1.15
    xs = [X0 + 0.95, X0 + 2.3, X1 - 2.0, X1 - 0.85]
    acesas_t = {('+y', 0), ('+y', 1), ('-y', 2), ('+x', 0)}
    xs_t = [X0 + 0.8, X0 + 2.1, X1 - 1.2]          # na frente, as janelas abrem espaço para o pórtico
    for (face, plano, lista) in (('+y', Y1, xs_t), ('-y', Y0, xs), ('+x', X1, [Y0 + 1.2, Y1 - 1.2]), ('-x', X0, [Y0 + 1.2, Y1 - 1.2])):
        for k, a in enumerate(lista):
            ac = (face, k) in acesas_t
            _janela(face, plano, a, 0.95, jw, jh, acesa=ac, folhas=True, seed=k + 3, moldura='#2e2018')
            caixa(_bx(face, plano, a - 0.48, a + 0.48, 0.0, 0.09, 0.95 + jh + FR, 0.95 + jh + FR + 0.2), {'cima': liso('#c2baaa'), '*': liso('#b0a898')})
            if not ac and k % 2 == 0:
                # a janela fechada (as folhas de tábua batidas por cima do vidro)
                caixa(_bx(face, plano, a - jw / 2, a + jw / 2, 0.055, 0.085, 0.95, 0.95 + jh),
                      {'*': FF.mat_tabua_v(['#4a3a30', '#42342a'], 0.07, '#221812', seed=k), 'cima': liso('#5a4a3e')})
    # o pórtico: as duas pilastras de pedra, a verga com o frontão baixo, os degraus
    _porta('+y', Y1, XP, 0.36, 1.1, 2.05, folhas=2, cores=['#3e2a1e', '#3a2618', '#44301f'], seed=7, moldura='#2e2018', postigo=False)
    for s in (-1, 1):
        px = XP + s * 0.78
        caixa((px - 0.14, px + 0.14, Y1, Y1 + 0.22, 0.36, 2.55), mat_pedra(seed=11, alt=0.2, comp=0.28, cores=['#bab2a2', '#b0a898']))
    caixa((XP - 1.0, XP + 1.0, Y1, Y1 + 0.3, 2.55, 2.72), {'cima': liso('#c2baaa'), '*': liso('#b4ac9c')})
    o = obj()
    CZ.c.face_plana([(XP - 0.95, Y1 + 0.28, 2.72), (XP + 0.95, Y1 + 0.28, 2.72), (XP, Y1 + 0.28, 3.0)], (0, 1, 0), liso('#b4ac9c'), M, o)
    CZ.c.face_plana([(XP - 0.95, Y1, 2.72), (XP, Y1, 3.0), (XP, Y1 + 0.28, 3.0), (XP - 0.95, Y1 + 0.28, 2.72)], (-0.28, 0, 0.96), liso('#c6beae'), M, o)
    CZ.c.face_plana([(XP + 0.95, Y1, 2.72), (XP + 0.95, Y1 + 0.28, 2.72), (XP, Y1 + 0.28, 3.0), (XP, Y1, 3.0)], (0.28, 0, 0.96), liso('#c6beae'), M, o)
    _degraus('+y', Y1, XP, 1.9, 0.36, n=2, prof=0.24)
    # a plaquinha de latão do Doutor do lado da porta
    caixa((XP - 0.86, XP - 0.7, Y1 + 0.22, Y1 + 0.24, 1.45, 1.6), liso('#b89048'), contorno=False)
    # o andar de cima (enxaimel escuro, as janelas com as folhas fechadas na maioria)
    z2 = ZF + 0.55
    jh2 = 0.95
    # as janelas da quina 5 cm para fora: as folhas abertas batiam nas das vizinhas por 1 cm (14/10)
    xs = [X0 + 0.75, X0 + 2.1, X1 - 2.2, X1 - 0.85]
    vaos2 = {
        '+y': [('j', x, z2, jw, jh2, k == 1, True) for k, x in enumerate(xs)],
        '-y': [('j', x, z2, jw, jh2, False, True) for k, x in enumerate(xs)],
        '+x': [('j', Y0 + 1.2, z2, jw, jh2, False, True), ('j', Y1 - 1.2, z2, jw, jh2, False, True)],
        '-x': [('j', Y0 + 1.2, z2, jw, jh2, True, True), ('j', Y1 - 1.2, z2, jw, jh2, False, True)],
    }
    _andar(B, ZF + 0.02, ZE - 0.1, vaos2, riegel=z2 - FR - 0.07, cor=VIGA_D, seed=51, soleira=True)
    for face, lst in vaos2.items():
        plano = _lados(B)[face][0]
        for k, v in enumerate(lst):
            _, a, zj, w_, h_, ac, _f = v
            if not ac and (k + len(face)) % 2 == 0:
                caixa(_bx(face, plano, a - w_ / 2, a + w_ / 2, 0.055, 0.085, zj, zj + h_),
                      {'*': FF.mat_tabua_v(['#4a3a30', '#42342a'], 0.07, '#221812', seed=k + 4), 'cima': liso('#5a4a3e')})
    # o telhado escuro (íngreme), as duas chaminés nos oitões
    BEI = 0.3
    KT = (ZR - ZE) / (YR - Y0)
    perfil = [(Y0 - BEI, ZE - BEI * KT), (YR, ZR), (Y1 + BEI, ZE - BEI * KT)]
    FF.telhado(X0, X1, Y0, Y1, perfil, 'x', TELHA_D, '#3a120c', TAIPA, testeira='#3a2a20', cumeeira='#6a261c', seed=21,
               beiral_u=0.3, musgo=0.0)
    _oitao('+x', X1, Y0, Y1, ZE - 0.1, perfil, cor=VIGA_D, seed=17)
    _oitao('-x', X0, Y0, Y1, ZE - 0.1, perfil, cor=VIGA_D, seed=18)
    for (xa, xb) in ((X0 - 0.05, X0 + 0.55), (X1 - 0.55, X1 + 0.05)):
        caixa((xa, xb, YR - 0.32, YR + 0.32, 0.0, ZE), mat_pedra(seed=13, alt=0.16, comp=0.3))
        FF.chamine(xa + 0.02, xb - 0.02, YR - 0.28, YR + 0.28, ZE - 0.1, ZR + 0.42)
    _fumaca(X1 - 0.25, YR, ZR + 0.47, n=3, seed=21, r=0.13, sobe=0.3)
    _lampiao_cristal('+y', Y1, XP + 1.17, 1.5)
    # o mato baixo e escuro em volta (austero: sem flor)
    _moita(X0 + 0.4, Y1 + 0.22, 0.2, 0.4, seed=22, pal=MOITA_AZUL)
    _moita(X1 - 0.4, Y1 + 0.22, 0.2, 0.42, seed=23, pal=MOITA_AZUL)
    _moita(X1 + 0.2, Y0 + 0.8, 0.2, 0.4, seed=24, pal=MOITA_ROXA)
    pegada(X0, X1, Y0, Y1)


# =====================================================================================================================
# a torre do Porteiro (4 x 4 casas, 9,0 m): redonda, de pedra, como um farol: as janelinhas em espiral, a galeria lá
# em cima com o cristal vermelho aceso, o telhado cônico de telha vermelha
# =====================================================================================================================
def mat_pedra_cil(cx, cy, alt=0.17, ang=0.3, cores=PEDRA, junta=PEDRA_J, seed=0, inc=0.0):
    base = FF.mat_juntas(list(cores), FF.id_pedras_cil(cx, cy, alt=alt, ang=ang), junta, seed=seed)
    return _redondo(base, _n_cil(cx, cy, inc))


def mat_cone_telha(cx, cy, zb, cores=TELHA_V, junta=TELHA_VJ, inc=1.0, fiada=0.1, n_col=22):
    """As telhas no cone: as fiadas pela altura (a junta escura embaixo, a luz logo acima), a capa clara à esquerda."""
    cs = np.stack([hx(x) for x in cores])
    jc = hx(junta)

    def base(L, n, P):
        th = np.arctan2(P[:, 1] - cy, P[:, 0] - cx)
        s = P[:, 2] - zb
        fila = np.floor(s / fiada)
        g = s - fila * fiada
        u = (th / (2 * math.pi) + 0.5) * n_col + 0.5 * (fila % 2)
        col = np.floor(u)
        gx = u - col
        out = cs[(ruido(fila * 97 + col, 4.4) * len(cs)).astype(int) % len(cs)]
        out = np.where((gx < 0.22)[:, None], out * 1.1 + 4, out)
        out = np.where((gx > 0.85)[:, None], out * 0.84, out)
        out = np.where((g > fiada - PZ * 1.05)[:, None], out * 0.86, out)
        out = np.where(((g >= PZ) & (g < 2 * PZ))[:, None], np.minimum(out * 1.1 + 4, 255), out)
        return np.where((g < PZ)[:, None], jc, out)
    return _redondo(base, _n_cil(cx, cy, inc))


def _janela_cil(cx, cy, r, ang, z0, w, h, acesa=True):
    """A seteira da torre: o vidro aceso (ou escuro) no plano tangente, a moldura de pedra clara e o peitoril."""
    c = CZ.c
    ca, sa = math.cos(ang), math.sin(ang)
    t = (-sa, ca)

    def pt(l, e, z):
        rr = r + e
        return (cx + ca * rr + t[0] * l, cy + sa * rr + t[1] * l, z)
    n = (ca, sa, 0.0)
    of = obj()
    m = liso('#bcb4a4')
    q = lambda l0, l1, za, zb, e: [pt(l0, e, za), pt(l1, e, za), pt(l1, e, zb), pt(l0, e, zb)]
    e0 = 0.03
    fw = 0.06
    for (l0, l1, za, zb) in ((-w / 2 - fw, -w / 2, z0 - fw, z0 + h + fw), (w / 2, w / 2 + fw, z0 - fw, z0 + h + fw),
                             (-w / 2, w / 2, z0 + h, z0 + h + fw), (-w / 2, w / 2, z0 - fw, z0)):
        c.face_plana(q(l0, l1, za, zb, e0 + 0.012), n, m, M, of)
    # o arco de cima (a pedra da verga, um pouco mais larga)
    c.face_plana(q(-w / 2 - fw - 0.03, w / 2 + fw + 0.03, z0 + h + fw, z0 + h + fw + 0.07, e0 + 0.012), n, liso('#c6beae'), M, of)
    ov = obj(contorno=not acesa)
    if acesa:
        CZ.luzes.add(ov)
    uf = lambda P: np.clip(((P[:, 0] - cx) * t[0] + (P[:, 1] - cy) * t[1] + w / 2) / w, 0, 1)
    vf = lambda P: (P[:, 2] - z0) / h
    c.face_plana(q(-w / 2, w / 2, z0, z0 + h, e0 - 0.005), n, mat_vidro_cristal(uf, vf, acesa), M, ov)


def _torre():
    c = CZ.c
    W, D = 4 * CASA, 4 * CASA
    cx, cy = 1.5, 1.38
    R0, R1 = 1.22, 1.04          # o raio no pé e no alto (a torre afina subindo)
    ZG = 6.2                     # o alto da parede (a galeria em cima)
    XP = _porta_x(4)
    inc = (R0 - R1) / ZG

    def raio(z):
        return R0 + (R1 - R0) * z / ZG
    o = obj()
    c.cilindro(cx, cy, R0 + 0.06, 0.0, 0.42, mat_pedra_cil(cx, cy, 0.14, 0.26, ['#8e8678', '#857d70', '#968e80'], seed=2), M, o, lados=32,
               tampa=True, tampa_mat=liso('#a8a092'))
    o = obj()
    c.cilindro(cx, cy, R0, 0.42, ZG, mat_pedra_cil(cx, cy, 0.17, 0.3, seed=1, inc=inc), M, o, lados=32, tampa=False, r1=R1)
    # as faixas de pedra clara (os andares da escada) e as seteiras em espiral
    for zf in (2.4, 4.3):
        rf = raio(zf)
        o = obj()
        c.cilindro(cx, cy, rf + 0.05, zf, zf + 0.12, _redondo(lambda L, n, P: np.tile(hx('#b4ac9c'), (len(P), 1)), _n_cil(cx, cy)),
                   M, o, lados=32, tampa=True, tampa_mat=liso('#c2baaa'))
    janelas = [(math.radians(58), 1.2, True), (math.radians(-10), 1.95, False), (math.radians(-95), 2.8, True),
               (math.radians(-170), 3.55, True), (math.radians(118), 4.75, True), (math.radians(40), 5.45, True)]
    for (a, z0, ac) in janelas:
        _janela_cil(cx, cy, raio(z0 + 0.3) + 0.012, a, z0, 0.26, 0.56, acesa=ac)
    # a entrada (o portal de pedra que sai da torre, com a porta de tábuas e o lampião)
    yb0, yb1 = cy + 0.6, D - 0.12
    caixa((XP - 0.6, XP + 0.6, yb0, yb1, 0.0, 2.55), mat_pedra(seed=4, alt=0.15, comp=0.28))
    caixa((XP - 0.66, XP + 0.66, yb0, yb1 + 0.05, 2.55, 2.7), {'cima': liso('#b4ac9c'), '*': liso('#a8a092')})
    o = obj()
    for (pts, n) in (([(XP - 0.66, yb1 + 0.05, 2.7), (XP + 0.66, yb1 + 0.05, 2.7), (XP, yb1 + 0.05, 3.08)], (0, 1, 0)),):
        c.face_plana(pts, n, mat_pedra(seed=5, alt=0.12, comp=0.22), M, o)
    o = obj()
    c.face_plana([(XP - 0.74, yb1 + 0.1, 2.66), (XP, yb1 + 0.1, 3.12), (XP, yb0, 3.12), (XP - 0.74, yb0, 2.66)], (-0.53, 0, 0.85),
                 FF.mat_telha(TELHA_V, TELHA_VJ, 2.66, 0.53, np.array([0.0, 1.0, 0.0]), np.array([0.85, 0.0, 0.53]), 1, seed=3), M, o)
    c.face_plana([(XP + 0.74, yb1 + 0.1, 2.66), (XP + 0.74, yb0, 2.66), (XP, yb0, 3.12), (XP, yb1 + 0.1, 3.12)], (0.53, 0, 0.85),
                 FF.mat_telha(TELHA_V, TELHA_VJ, 2.66, 0.53, np.array([0.0, 1.0, 0.0]), np.array([-0.85, 0.0, 0.53]), 1, seed=4), M, o)
    c.face_plana([(XP - 0.74, yb1 + 0.1, 2.66 - 0.06), (XP, yb1 + 0.1, 3.12 - 0.06), (XP, yb1 + 0.1, 3.12), (XP - 0.74, yb1 + 0.1, 2.66)],
                 (0, 1, 0), liso('#5a3a24'), M, o)
    c.face_plana([(XP, yb1 + 0.1, 3.12 - 0.06), (XP + 0.74, yb1 + 0.1, 2.66 - 0.06), (XP + 0.74, yb1 + 0.1, 2.66), (XP, yb1 + 0.1, 3.12)],
                 (0, 1, 0), liso('#5a3a24'), M, o)
    _porta('+y', yb1, XP, 0.0, 0.82, 1.95, folhas=1, seed=9, moldura='#3a2a1e')
    _degraus('+y', yb1, XP, 1.0, 0.12, n=1, prof=0.1)
    _lampiao_cristal('-x', XP - 0.6, (yb0 + yb1) / 2 + 0.1, 1.55, alto=0.3)
    # a galeria: as mísulas (o cone que abre), o piso, o guarda-corpo de ferro
    o = obj()
    RG = R1 + 0.2
    c.cilindro(cx, cy, R1, ZG - 0.35, ZG, mat_pedra_cil(cx, cy, 0.12, 0.22, ['#a8a092', '#9c9486'], seed=6, inc=-0.5), M, o, lados=32,
               tampa=False, r1=RG)
    o = obj()
    c.cilindro(cx, cy, RG, ZG, ZG + 0.1, _redondo(lambda L, n, P: np.tile(hx('#b0a898'), (len(P), 1)), _n_cil(cx, cy)), M, o, lados=32,
               tampa=True, tampa_mat=liso('#8e8678'))
    og = obj()
    zg = ZG + 0.1
    for i in range(16):
        a = 2 * math.pi * (i + 0.5) / 16
        px, py = cx + (RG - 0.05) * math.cos(a), cy + (RG - 0.05) * math.sin(a)
        c.caixa((px - 0.018, px + 0.018, py - 0.018, py + 0.018, zg, zg + 0.62), liso('#2a2624'), M, og)
    o = obj()
    c.cilindro(cx, cy, RG - 0.03, zg + 0.58, zg + 0.64, _redondo(lambda L, n, P: np.tile(hx('#3a3432'), (len(P), 1)), _n_cil(cx, cy)), M, o,
               lados=32, tampa=False)
    c.cilindro(cx, cy, RG - 0.07, zg + 0.58, zg + 0.64, liso('#2a2624'), M, o, lados=32, tampa=False)
    # a lanterna: o pedestal, os seis esteios de madeira e o cristal grande aceso no meio
    RL = 0.72
    ZL1 = zg + 1.2
    o = obj()
    c.cilindro(cx, cy, 0.3, zg, zg + 0.2, mat_pedra_cil(cx, cy, 0.1, 0.4, ['#b0a898', '#a49c8e'], seed=8), M, o, lados=16, tampa=True,
               tampa_mat=liso('#c2baaa'))
    for i in range(6):
        a = 2 * math.pi * (i + 0.25) / 6
        px, py = cx + RL * math.cos(a), cy + RL * math.sin(a)
        caixa((px - 0.05, px + 0.05, py - 0.05, py + 0.05, zg, ZL1), mad2('#4a3020', eixo=1, seed=i, passo=0.05))
    _cristal(cx, cy, zg + 0.14, 0.25, 0.9, giro=0.2)
    # a luz do cristal no piso da galeria (a mancha vermelha em degraus em volta do pedestal)
    ol = obj(contorno=False)
    CZ.luzes.add(ol)

    def luz_piso(L, n, P):
        d = np.hypot(P[:, 0] - cx, P[:, 1] - cy)
        out = np.where((d < 0.55)[:, None], hx('#e2846a'), np.where((d < 0.82)[:, None], hx('#c06a56'), hx('#9c7a6e')))
        return out
    c.face_plana([(cx + (RG - 0.08) * math.cos(a), cy + (RG - 0.08) * math.sin(a), zg + 0.004) for a in np.linspace(0, 2 * math.pi, 32, endpoint=False)],
                 (0, 0, 1), emissivo(luz_piso), M, ol)
    # o telhado cônico de telha vermelha (com o beiral) e o pináculo de ferro
    o = obj()
    RC = RL + 0.16
    c.cilindro(cx, cy, RC, ZL1, ZL1 + 0.08, liso('#4a3020'), M, o, lados=32, tampa=False)
    o = obj()
    HC = 9.0 - 0.18 - (ZL1 + 0.08)
    c.cilindro(cx, cy, RC, ZL1 + 0.08, 9.0 - 0.18, mat_cone_telha(cx, cy, ZL1 + 0.08, inc=RC / HC), M, o, lados=32, tampa=False, r1=0.0)
    o = obj()
    c.cilindro(cx, cy, 0.035, 9.0 - 0.3, 9.0, liso('#2a2624'), M, o, lados=8, tampa=True)
    c.elipsoide((cx, cy, 9.0 - 0.22), (0.06, 0.06, 0.05), lambda Pc, N, P: FF._cru_eli(np.tile(hx('#3a3432'), (len(P), 1)), N), o)
    # as plantas no pé
    _moita(cx - 1.15, cy + 0.65, 0.2, 0.42, seed=31, pal=MOITA_ROXA)
    _moita(cx + 1.2, cy + 0.5, 0.18, 0.38, seed=32, pal=MOITA_OCRE)
    pegada_redonda(cx, cy, R0 + 0.06, 15)
    pegada(XP - 0.6, XP + 0.6, yb0, yb1)


# =====================================================================================================================
# o portão da vila (4 x 1 casas, 4,5 m, pisável): o arco de troncos sobre a estrada, o vão do meio livre
# =====================================================================================================================
CASCA = ['#5a3e28', '#4e3622', '#64462c']


def mat_casca(eixo, a, b, r, seed=0):
    """
    A casca do tronco: as riscas compridas (escuras e claras) ao longo do tronco, em faixas de 2 px na volta.
    (a, b): o eixo do tronco (x, y no tronco em pé; y, z no deitado); r: o raio.
    """
    cs = np.stack([hx(x) for x in CASCA])

    def f(L, n, P):
        if eixo == 'z':
            t, s = P[:, 2], np.arctan2(P[:, 1] - b, P[:, 0] - a) * r
        else:
            t, s = P[:, 0], np.arctan2(P[:, 2] - b, P[:, 1] - a) * r
        fila = np.floor(s / (2 * PH))
        seg = np.floor(t / 0.35 + ruido(fila, seed + 1.0))
        q = ruido(fila, seg, seed + 2.0)
        out = cs[(q * 3).astype(int) % 3]
        risca = ruido(fila * 3.1, np.floor(t / 0.22), seed + 3.0) > 0.7
        out = np.where(risca[:, None], hx('#3a2818'), out)
        return out
    return f


def _ponta_tora(cx, cy, r):
    """A ponta cortada do tronco: a madeira clara com os anéis e a casca em volta (no plano da ponta)."""
    def f(L, n, P):
        nn = np.asarray(n, float)
        if abs(nn[2]) > 0.5:
            d = np.hypot(P[:, 0] - cx, P[:, 1] - cy)
        else:
            d = np.hypot(P[:, 1] - cx, P[:, 2] - cy)
        d = d / r
        out = np.tile(hx('#c49a64'), (len(P), 1))
        out = np.where(((d * 4.2) % 1 < 0.22)[:, None], hx('#a87c4c'), out)
        out = np.where((d < 0.16)[:, None], hx('#9a6e40'), out)
        return np.where((d > 0.84)[:, None], hx('#4e3622'), out)
    return emissivo(f)


def _tora_x(x0, x1, cy, cz, r, lados=16, seed=0):
    """O tronco deitado ao longo de x (a trave do portão): a casca com a luz redonda e as duas pontas cortadas."""
    c = CZ.c
    o = obj()
    m = _redondo(mat_casca('x', cy, cz, r, seed), _n_tora_x(cy, cz))
    for i in range(lados):
        a0 = 2 * math.pi * i / lados
        a1 = 2 * math.pi * (i + 1) / lados
        am = (a0 + a1) / 2
        p = lambda x, a: (x, cy + r * math.cos(a), cz + r * math.sin(a))
        c.face_plana([p(x0, a0), p(x1, a0), p(x1, a1), p(x0, a1)], (0.0, math.cos(am), math.sin(am)), m, M, o)
    for (x, s) in ((x1, 1), (x0, -1)):
        pts = [(x, cy + r * math.cos(2 * math.pi * i / lados), cz + r * math.sin(2 * math.pi * i / lados)) for i in range(lados)]
        c.face_plana(pts, (s, 0, 0), _ponta_tora(cy, cz, r), M, o)
    return o


def _tora_z(cx, cy, z0, z1, r, seed=0, r1=None):
    c = CZ.c
    o = obj()
    r1 = r if r1 is None else r1
    m = _redondo(mat_casca('z', cx, cy, r, seed), _n_cil(cx, cy, (r - r1) / (z1 - z0)))
    c.cilindro(cx, cy, r, z0, z1, m, M, o, lados=20, tampa=True, r1=r1, tampa_mat=_ponta_tora(cx, cy, r1))
    return o


def _portao():
    D = CASA
    y = D / 2
    R = 0.22
    XA, XB = 0.3, 4 * CASA - 0.3
    ZT = 4.2                     # o meio da trave
    for (x, s) in ((XA, 0), (XB, 1)):
        _tora_z(x, y, 0.0, ZT + 0.25, R, seed=s, r1=R * 0.92)
        # as pedras em volta do pé do tronco
        o = obj()
        for k in range(5):
            a = 2 * math.pi * (k + 0.3 * s) / 5
            px, py = x + 0.25 * math.cos(a), y + 0.25 * math.sin(a)
            caixa((px - 0.1, px + 0.1, py - 0.08, py + 0.08, 0.0, 0.1 + 0.04 * (k % 2)), {'cima': liso('#a49c8e'), '*': liso('#8a8274')}, o=o)
        pegada_redonda(x, y, R + 0.1, 7)
    # a trave de cima (passando um pouco das pontas) e a trave de baixo, mais fina, com as escoras
    _tora_x(XA - 0.42, XB + 0.42, y, ZT, R * 0.95, seed=3)
    _tora_x(XA + 0.1, XB - 0.1, y, ZT - 0.55, R * 0.62, seed=4)
    o = obj()
    for (x, s) in ((XA, 1), (XB, -1)):
        FF._viga(o, (x + s * 0.12, y, ZT - 1.5), (x + s * 0.75, y, ZT - 0.62), 0.12, FF.liso('#4e3622'))
    # as amarras de corda nas juntas
    for x in (XA, XB):
        for zc_ in (ZT - 0.66, ZT - 0.5):
            o = obj()
            CZ.c.cilindro(x, y, R * 0.95 + 0.025, zc_, zc_ + 0.07, _redondo(lambda L, n, P: np.tile(hx('#a8905e'), (len(P), 1)), _n_cil(x, y)),
                          M, o, lados=20, tampa=False)
    # o cristal vermelho pendurado no meio da trave (a corrente e a gaiola), lá no alto, sobre o vão
    xm = (XA + XB) / 2
    caixa((xm - 0.012, xm + 0.012, y - 0.012, y + 0.012, ZT - 0.55 - 0.5, ZT - 0.55 - 0.12), liso('#4a4440'), contorno=False)
    zc = ZT - 0.55 - 0.5 - 0.36
    s = 0.1
    ferro = liso('#2a2624')
    caixa((xm - s - 0.02, xm + s + 0.02, y - s - 0.02, y + s + 0.02, zc, zc + 0.04), ferro)
    caixa((xm - s - 0.02, xm + s + 0.02, y - s - 0.02, y + s + 0.02, zc + 0.32, zc + 0.36), ferro)
    og = obj()
    for (px, py) in ((xm - s, y - s), (xm + s, y - s), (xm - s, y + s), (xm + s, y + s)):
        CZ.c.caixa((px - 0.012, px + 0.012, py - 0.012, py + 0.012, zc + 0.04, zc + 0.32), ferro, M, og)
    _cristal(xm, y, zc + 0.05, 0.065, 0.25)
    # a tábua com o símbolo da espiral (gravado), pregada no meio da trave
    def espiral(L, n, P):
        u = (P[:, 0] - xm) / 0.42
        v = (P[:, 2] - (ZT - 0.02)) / 0.42
        out = np.tile(hx('#7a5634'), (len(P), 1))
        out = np.where(((np.abs(u) > 0.9) | (np.abs(v) > 0.82))[:, None], hx('#5a3e26'), out)
        rr = np.hypot(u, v * 1.4)
        th = np.arctan2(v * 1.4, u)
        k = (rr / 0.16 - th / (2 * math.pi)) % 1
        sulco = (k < 0.36) & (rr < 0.7) & (rr > 0.05)
        return np.where(sulco[:, None], hx('#3a2616'), out)
    caixa((xm - 0.42, xm + 0.42, y + R * 0.75, y + R * 0.75 + 0.05, ZT - 0.36, ZT + 0.32), {'*': emissivo(espiral), 'cima': liso('#8a6440')})
    caixa((xm - 0.42, xm + 0.42, y - R * 0.75 - 0.05, y - R * 0.75, ZT - 0.36, ZT + 0.32), {'*': emissivo(espiral), 'cima': liso('#8a6440')})


# =====================================================================================================================
ITENS = {
    'casa_vila': (6, 5, (0.0, 0.0), _casa_vila, {}),
    'taverna_predio': (10, 7, (0.0, 0.0), _taverna, {}),
    'ferraria_predio': (8, 6, (0.0, 0.0), _ferraria, {}),
    'hotel_predio': (10, 8, (0.0, 0.0), _hotel, {}),
    'casa_doutor': (10, 8, (0.0, 0.0), _casa_doutor, {}),
    'torre_porteiro': (4, 4, (0.0, 0.0), _torre, {}),
    'portao_vila': (4, 1, (0.0, 0.0), _portao, {}),
}
