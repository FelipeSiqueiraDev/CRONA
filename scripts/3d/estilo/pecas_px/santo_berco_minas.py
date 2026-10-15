"""
GRUPO SB-M, "Santo Berço: as minas e a caverna" (15/10): as peças das galerias das minas (o trilho, o carrinho, a
escora, a toca da Toupeira de Lodo, as drusas grandes de cristal das quatro cores, a boca de túnel), as celas brancas
dos Mananciais e o lugar do Parasita de Dimensões, na caverna embaixo do Labirinto, e os itens de parede (o veio de
cristal na rocha, a penca de Morcegosas, o lodo escorrendo). Pixel art 1:1 só por código, no estilo de medieval.py e
vila_natureza.py (que este módulo reaproveita: os cristais, a pedra, o lodo, os tubos facetados).

Tudo no giro 4 (a frente para +y), a pegada começando em (0, 0), no tamanho do catálogo (shared/src/furni.ts, o bloco
"SANTO BERÇO (15/10)": a altura lá está em METROS).

Decisões:
  - boca_tunel (kind 'portal', como a porta): fica encostada na parede do fundo; só os giros 4 e 2 (SO_GIROS). O vão
    é escuro (a galeria seguinte), com a boca em arco; a das minas é escorada com dois esteios e a trave, a da caverna
    (~b) é só a pedra em volta.
  - trilho_mina (flat): os dois trilhos ao comprido da casa (o y do giro 4) nos dois dormentes; sem o contorno do
    motor nos trilhos, que emendam com a casa vizinha.
  - cristal_grande_*: estado 0 aceso (o halo de pixels, como as drusas da vila), '1' apagado/coberto. O preto não
    acende: só as faíscas roxas frias.
  - cela_branca: o bloco da casa inteira (emenda com o vizinho, sem contorno), branco liso "demais", só a sujeira de
    lodo embaixo. porta_cela_branca: 0 fechada (a grade no plano da frente), '1' aberta (girada para dentro).
  - ninho_parasita: o rasgo de luz errada no chão (brilha, sem a luz das faces) e os tentáculos de lodo endurecido.
"""
import math

import numpy as np

import cozinha as CZ
import base_estilo as BE
import medieval as MD
import vila_natureza as VN
import vila_predios as VP
import parede_casa as PC
import estrutura as ES
import ocultismo as OC
from base_estilo import hx, liso, mad2, _tom, _cru, PH, PZ, _poligono_rodado
from motor import emissivo, ruido, suave

M = BE.M
CASA = 0.75
cx, novo, peg, fp, luz_obj, pau = MD.cx, MD.novo, MD.peg, MD.fp, MD.luz_obj, MD.pau


def C():
    return CZ.c


LD = np.array([-0.35, 0.45, 1.0]) / np.linalg.norm([-0.35, 0.45, 1.0])


def mat_facetas(rampa, k0=1.4, kd=2.2, brilho_k=None):
    """O material das facetas (o lodo duro, a rocha lascada): o degrau da rampa pela luz da faceta, já cru."""
    R = np.stack([hx(c) for c in rampa])

    def f(L, n, P):
        nn = np.asarray(n, float) / max(1e-9, np.linalg.norm(n))
        d = float(BE.n_mundo(nn) @ LD)
        k = int(np.clip(round(k0 + kd * d), 0, len(R) - 1))
        out = np.tile(R[k], (len(P), 1))
        if brilho_k is not None and d > 0.55:
            # o brilho molhado: riscas compridas de 1 px na faceta que pega luz
            s = np.floor((P[:, 0] + P[:, 1] + P[:, 2] * 0.5) / (3 * PH))
            out = np.where((s % 5 == 0)[:, None], R[min(len(R) - 1, brilho_k)], out)
        return _cru(out, n)
    return emissivo(f)


LODO = ['#060508', '#0e0b12', '#18121e', '#241a2e', '#3a2a4c', '#6a52a0']
TERRA = '#5a4632'


def mat_terra_eli(base=TERRA, seed=0, lodo=0.0):
    """A terra revirada (o monte da toca): blocos de 2 px em três tons; com `lodo`, as manchas pretas babadas."""
    c0 = hx(base)

    def f(Pc, N, P):
        a = np.floor((P[:, 0] - P[:, 1]) / (2 * PH))
        b = np.floor((P[:, 0] + P[:, 1]) / (4 * PH) - P[:, 2] / (2 * PZ))
        s = suave(a, b, 2.5, seed)
        out = np.tile(c0, (len(P), 1))
        out = np.where((s > 0.64)[:, None], _tom(c0, 1.12), out)
        out = np.where((s < 0.32)[:, None], _tom(c0, 0.84), out)
        if lodo:
            m = suave(a * 0.7, b * 0.7, 2.0, seed + 5) > 1 - lodo
            out = np.where(m[:, None], hx('#120e16'), out)
        return out
    return f


# =====================================================================================================================
# a boca de túnel (a passagem de uma galeria para a outra)
# =====================================================================================================================
VAO0, VAO1, ZV = 0.07, 0.68, 2.0


def _vao_arco(z_arco=1.62):
    """O vão escuro em arco na parede (a galeria do outro lado), mais claro embaixo onde o chão de lá pega luz."""
    def cor(L, n, P):
        z = L[:, 2]
        out = np.tile(hx('#080607'), (len(L), 1))
        out = np.where((z < 0.36)[:, None], hx('#120e0c'), out)
        return np.where((z < 0.12)[:, None], hx('#1c1612'), out)
    o = C().novo_obj(3, contorno=False, sombra=False)
    xm, r = (VAO0 + VAO1) / 2, (VAO1 - VAO0) / 2
    pts = [(VAO0, -0.02, 0.01), (VAO1, -0.02, 0.01), (VAO1, -0.02, z_arco)]
    for i in range(1, 12):
        a = math.pi * i / 12
        pts.append((xm + r * math.cos(a), -0.02, z_arco + r * 0.75 * math.sin(a)))
    pts.append((VAO0, -0.02, z_arco))
    fp(pts, (0, 1, 0), emissivo(cor), o)


def _boca_tunel(escorada=True):
    def d():
        _vao_arco(1.62 if escorada else 1.5)
        PEDRAS = '#7a766c' if escorada else '#6e6c6a'
        o = novo()
        rng = np.random.default_rng(3 if escorada else 4)
        xm = (VAO0 + VAO1) / 2
        if escorada:
            # a rocha por cima da trave e as pedras no pé dos esteios
            for k in range(7):
                x = -0.02 + k * 0.13
                C().elipsoide(np.array([x, 0.0, ZV + 0.24 + 0.06 * rng.random()]), np.array([0.13, 0.06, 0.12]),
                              VN.mat_pedra_eli(PEDRAS, None, seed=k + 10), o)
            for (x, r) in ((0.0, 0.12), (0.75, 0.13)):
                C().elipsoide(np.array([x, 0.06, 0.0]), np.array([r, 0.1, r * 0.8]), VN.mat_pedra_eli(PEDRAS, None, seed=int(x * 10) + 3), o, corte_z=0.0)
        else:
            # a boca de pedra: as pedras grandes encravadas em volta do arco, uma encostada na outra
            for k in range(13):
                a = math.pi * (k / 12)
                x = xm + 0.4 * math.cos(a)
                z = 1.55 + 0.42 * math.sin(a)
                C().elipsoide(np.array([x, 0.0, z]), np.array([0.13 + 0.04 * rng.random(), 0.07, 0.12 + 0.04 * rng.random()]),
                              VN.mat_pedra_eli(PEDRAS, None, seed=k + 10), o)
            # as ombreiras de rocha bruta (a pedra empilhada, sem argamassa)
            RO = MD.cantaria('#6a6660', alt=5, comp=6, seed=12)
            for (x0, x1) in ((-0.05, VAO0), (VAO1, CASA + 0.05)):
                cx((x0, x1, 0.0, 0.1, 0.0, 1.62), {'*': RO, 'cima': liso('#7a766e')})
        if escorada:
            # os dois esteios de tronco e a trave em cima, com a cunha; o cristal vermelho pendurado num prego
            for x in (0.07, 0.68):
                VP._tora_z(x, 0.07, 0.0, ZV + 0.02, 0.055, seed=int(x * 10))
            cx((-0.04, 0.79, 0.0, 0.13, ZV, ZV + 0.13), {'*': mad2('#4e3622', eixo=0, seed=5, passo=0.05), 'cima': liso('#5e4430')})
            cx((0.33, 0.42, 0.13, 0.15, ZV + 0.02, ZV + 0.11), liso('#3a2818'))
            cx((0.6, 0.62, 0.1, 0.16, ZV - 0.12, ZV), liso('#2a2624'))
            MD.cristal(0.61, 0.17, ZV - 0.36, 0.22, 0.045, aceso=True)
            cx((0.57, 0.65, 0.13, 0.21, ZV - 0.38, ZV - 0.35), liso('#2a2624'))
        peg(0.0, CASA, 0.0, 0.16)
    return d


# =====================================================================================================================
# o trilho, o carrinho, a escora
# =====================================================================================================================
def _trilho():
    """Os dois dormentes de tábua grossa e os dois trilhos de ferro ao comprido (sem contorno: emenda com a vizinha)."""
    DM = {'cima': BE.tab2(['#5e4228', '#563c24'], 0.06, '#2e1e12', eixo=0, seed=3), '*': liso('#3e2a18')}
    for y in (0.12, 0.47):
        cx((0.06, 0.69, y, y + 0.15, 0.0, 0.035), DM)
    TR = {'cima': liso('#9a948c'), 'frente': liso('#4e4844'), 'costas': liso('#4e4844'), 'esq': liso('#3a3532'), 'dir': liso('#5a5450')}
    for x in (0.19, 0.53):
        o = novo(contorno=False, sombra=False)
        C().caixa((x, x + 0.035, 0.0, CASA, 0.035, 0.06), TR, M, o)
        C().caixa((x - 0.012, x + 0.047, 0.0, CASA, 0.035, 0.042), liso('#36302c'), M, o)
        # os pregos (os grampos que prendem o trilho no dormente)
        for y in (0.19, 0.54):
            cx((x - 0.025, x - 0.012, y, y + 0.025, 0.035, 0.05), liso('#2a2624'), o=novo(contorno=False))
            cx((x + 0.047, x + 0.06, y, y + 0.025, 0.035, 0.05), liso('#2a2624'), o=novo(contorno=False))


def _roda(x0, x1, yc, zc, r):
    pts = [(yc + r * math.cos(2 * math.pi * k / 12), zc + r * math.sin(2 * math.pi * k / 12)) for k in range(12)]
    o = MD.placa_yz(pts, x0, x1, liso('#3a3532'), mat_borda=liso('#5a5450'))
    pts2 = [(yc + r * 0.35 * math.cos(2 * math.pi * k / 8), zc + r * 0.35 * math.sin(2 * math.pi * k / 8)) for k in range(8)]
    MD.placa_yz(pts2, x0 - 0.008, x1 + 0.008, liso('#6a645e'), o=novo(contorno=False))
    return o


def _carrinho():
    """
    O carrinho de mina (1 x 1, 0,9 m), ao comprido do trilho (o y do giro 4): a caçamba de chapa abrindo para cima, com
    o aro e os rebites, o chassi de tábua, as quatro rodas de ferro nos trilhos e a carga de pedra com lascas de
    cristal (vermelho, verde e azul) por cima.
    """
    zb, zt = 0.26, 0.76
    b0 = (0.17, 0.58, 0.14, 0.61)
    t0 = (0.11, 0.64, 0.06, 0.69)
    FE = MD.ferro('#4a4440', '#6a645e')
    o = novo()
    P = lambda x, y, z: (x, y, z)
    (ax0, ax1, ay0, ay1), (bx0, bx1, by0, by1) = b0, t0
    lados = [
        ([P(ax0, ay1, zb), P(ax1, ay1, zb), P(bx1, by1, zt), P(bx0, by1, zt)], (0, 0.7, 0.3)),
        ([P(ax1, ay0, zb), P(ax0, ay0, zb), P(bx0, by0, zt), P(bx1, by0, zt)], (0, -0.7, 0.3)),
        ([P(ax1, ay1, zb), P(ax1, ay0, zb), P(bx1, by0, zt), P(bx1, by1, zt)], (0.7, 0, 0.3)),
        ([P(ax0, ay0, zb), P(ax0, ay1, zb), P(bx0, by1, zt), P(bx0, by0, zt)], (-0.7, 0, 0.3)),
        ([P(ax0, ay0, zb), P(ax1, ay0, zb), P(ax1, ay1, zb), P(ax0, ay1, zb)], (0, 0, -1)),
    ]

    def chapa(L, n, P_):
        out = np.tile(hx('#56504a'), (len(P_), 1))
        z = P_[:, 2]
        out = np.where(((z > zt - 0.05))[:, None], hx('#6a645e'), out)
        out = np.where(((z > zb + 0.02) & (z < zb + 0.02 + PZ))[:, None], hx('#3a3532'), out)
        # os rebites em fileira embaixo do aro e a ferrugem escorrida
        a = (P_[:, 0] + P_[:, 1]) / (5 * PH)
        reb = (np.abs(z - (zt - 0.08)) < PZ * 0.6) & (np.floor(a) % 3 == 0)
        out = np.where(reb[:, None], hx('#8a847c'), out)
        fer = (ruido(np.floor(a), 3.0) > 0.7) & (z < zt - 0.12) & (z > zb + 0.05)
        return np.where(fer[:, None], hx('#6a4430'), out)
    for pts, n in lados:
        fp(pts, n, emissivo(chapa), o)
    # o aro de cima (a borda dobrada)
    for (bb) in ((bx0 - 0.012, bx1 + 0.012, by1 - 0.01, by1 + 0.012), (bx0 - 0.012, bx1 + 0.012, by0 - 0.012, by0 + 0.01),
                 (bx0 - 0.012, bx0 + 0.01, by0, by1), (bx1 - 0.01, bx1 + 0.012, by0, by1)):
        cx((*bb, zt - 0.02, zt + 0.015), FE)
    # a carga: o monte de pedra e as lascas de cristal
    rng = np.random.default_rng(7)
    om = novo()
    for k in range(9):
        x = 0.2 + 0.35 * rng.random()
        y = 0.15 + 0.45 * rng.random()
        C().elipsoide(np.array([x, y, zt - 0.04]), np.array([0.08, 0.07, 0.07 + 0.04 * rng.random()]), VN.mat_pedra_eli('#6e6a62', None, seed=k), om)
    for (x, y, cor, inc) in ((0.28, 0.3, 'vermelho', (-0.3, 0.2, 1)), (0.46, 0.46, 'verde', (0.3, 0.1, 1)), (0.36, 0.55, 'azul', (0.1, 0.4, 1))):
        oc = luz_obj()
        VN.cristal(oc, (x, y, zt), inc, 0.03, 0.1, 0.05, VN.CRISTAL[cor][0], True, seed=int(x * 100))
    # o chassi e as rodas nos trilhos
    for x in (0.17, 0.54):
        cx((x, x + 0.05, 0.08, 0.67, 0.17, zb), {'*': mad2('#4e3622', eixo=1, seed=2, passo=0.04), 'cima': liso('#5e4430')})
    for y in (0.2, 0.55):
        cx((0.14, 0.61, y - 0.015, y + 0.015, 0.1, 0.13), FE)
        for (xa, xb) in ((0.15, 0.19), (0.56, 0.6)):
            _roda(xa, xb, y, 0.115, 0.1)
    # a argola de puxar na frente
    cx((0.33, 0.42, 0.69, 0.72, 0.35, 0.37), FE)
    peg(0.11, 0.64, 0.06, 0.69)


def _escora():
    """
    A escora (1 x 1, 2,4 m): o esteio de tronco com a casca, a laje de pedra no pé, a trave em cima indo até a parede
    do fundo (o y = 0 do giro 4) e a cunha batida entre os dois.
    """
    xc, yc = 0.375, 0.3
    VN.pedra(xc, yc, 0.16, 0.15, 0.08, base='#6e6a62', musgo=None, seed=3)
    VP._tora_z(xc, yc, 0.0, 2.24, 0.09, seed=4, r1=0.08)
    cx((xc - 0.1, xc + 0.1, -0.02, yc + 0.14, 2.24, 2.38), {'*': mad2('#4e3622', eixo=1, seed=6, passo=0.05), 'cima': liso('#5e4430'),
                                                            'frente': VP._ponta_tora(xc, 2.31, 0.1)})
    cx((xc - 0.07, xc + 0.07, yc - 0.12, yc - 0.07, 2.15, 2.24), liso('#3a2818'))
    # o mão-francesa (a escora inclinada) do esteio até a trave
    pau((xc, yc - 0.05, 1.7), (xc, 0.04, 2.24), 0.06, mad2('#4a3220', eixo=1, seed=8, passo=0.04))
    FF_peg = VP.pegada_redonda
    FF_peg(xc, yc, 0.16, 8)


# =====================================================================================================================
# a toca da Toupeira de Lodo
# =====================================================================================================================
def _toca():
    """
    A toca (1 x 1, 0,3 m): o monte de terra revirada em cone baixo, com a boca escura no meio, os torrões em volta e o
    lodo preto escorrendo da boca pela encosta (brilhando).
    """
    xc, yc = 0.37, 0.39
    o = novo()
    _poligono_rodado(xc, yc, [(0.0, 0.33), (0.08, 0.27), (0.17, 0.18), (0.24, 0.12)], BE.vol(xc, yc, '#5e4a34'), o, lados=18)
    # a boca: o escuro com a beira de lodo
    ob = novo(contorno=False)
    BE._disco(xc, yc, 0.241, 0.11, liso('#0a080c'), ob, lados=16)
    ol = novo(contorno=False)
    for k in range(5):
        a = 2 * math.pi * k / 5 + 0.4
        x, y = xc + 0.12 * math.cos(a), yc + 0.12 * math.sin(a)
        C().elipsoide(np.array([x, y, 0.2]), np.array([0.035, 0.035, 0.03]), lambda Pc, N, P: np.tile(hx('#120e16'), (len(P), 1)), ol)
    # o lodo escorrendo pela frente da encosta (as línguas pretas) e o brilho
    for (a, comp) in ((1.3, 0.2), (1.9, 0.15), (0.6, 0.12)):
        x0, y0 = xc + 0.12 * math.cos(a), yc + 0.12 * math.sin(a)
        x1, y1 = xc + (0.12 + comp) * math.cos(a), yc + (0.12 + comp) * math.sin(a)
        z0, z1 = 0.22, max(0.01, 0.24 - comp * 1.2)
        pau((x0, y0, z0), (x1, y1, z1), 0.035, liso('#0e0b12'), o=novo(contorno=False))
        C().elipsoide(np.array([x1, y1, z1]), np.array([0.03, 0.03, 0.02]), lambda Pc, N, P: np.tile(hx('#18121e'), (len(P), 1)), ol)
    # os torrões soltos
    rng = np.random.default_rng(5)
    ot = novo()
    for k in range(6):
        a = 2 * math.pi * rng.random()
        r = 0.3 + 0.08 * rng.random()
        C().elipsoide(np.array([xc + r * math.cos(a), yc + r * math.sin(a), 0.0]), np.array([0.045, 0.04, 0.04]),
                      mat_terra_eli(seed=k), ot, corte_z=0.0)
    VP.pegada_redonda(xc, yc, 0.34, 9)


# =====================================================================================================================
# as drusas grandes de cristal (2 x 2, 2,0 m)
# =====================================================================================================================
# os cristais: (dx, dy do pé a partir do meio, a inclinação x, y, o raio, o prisma, a ponta)
GRANDE = [
    (0.0, 0.0, 0.03, 0.05, 0.17, 1.3, 0.45),
    (-0.28, 0.12, -0.42, 0.25, 0.11, 0.78, 0.26),
    (0.3, 0.1, 0.45, 0.2, 0.12, 0.85, 0.28),
    (0.08, 0.32, 0.12, 0.6, 0.09, 0.5, 0.2),
    (-0.14, -0.26, -0.25, -0.45, 0.1, 0.72, 0.25),
    (0.24, -0.22, 0.4, -0.35, 0.08, 0.55, 0.2),
    (-0.4, -0.06, -0.85, -0.05, 0.06, 0.34, 0.14),
    (0.44, 0.3, 0.8, 0.5, 0.055, 0.3, 0.12),
    (-0.22, 0.4, -0.35, 0.8, 0.06, 0.32, 0.12),
]


def _cristal_grande(cor, aceso=True):
    def d():
        pal_aceso, pal_apag = VN.CRISTAL[cor]
        preto = cor == 'preto'
        rampa = pal_aceso if (aceso or preto) else pal_apag
        xc = yc = 0.75
        # a rocha de onde a drusa sai (sem musgo: o cristal queima o musgo)
        ob = novo()
        base = '#4a4644' if preto else '#5a5650'
        for (dx, dy, rx, ry, rz, s) in ((0, 0, 0.56, 0.5, 0.26, 1), (0.38, 0.3, 0.24, 0.22, 0.16, 2), (-0.4, 0.24, 0.22, 0.2, 0.14, 3),
                                        (-0.3, -0.36, 0.2, 0.18, 0.12, 4), (0.32, -0.34, 0.18, 0.16, 0.1, 5)):
            C().elipsoide(np.array([xc + dx, yc + dy, 0.0]), np.array([rx, ry, rz]), VN.mat_pedra_eli(base, None, seed=s + 20), ob, corte_z=0.0)
        o = novo(contorno=not (aceso and not preto))
        if aceso and not preto:
            CZ.luzes.add(o)
        for i, (dx, dy, ix, iy, r, comp, ponta) in enumerate(GRANDE):
            z0 = 0.12 if i else 0.16
            VN.cristal(o, (xc + dx, yc + dy, z0), (ix, iy, 1.0), r * (1.08 if preto else 1.0), comp, ponta, rampa, aceso and not preto,
                       preto=preto, giro=0.3 + i * 0.7, seed=i + 31)
        if aceso and not preto:
            VN._halo([o], rampa[4], [(-30, -34, 2), (26, -52, 2), (34, 2, 1), (-28, 6, 1), (4, -70, 2)], rampa[4], miolo=rampa[5])
        if preto:
            VN._halo([o], None, [(-18, -50, 1), (20, -30, 1), (-6, -66, 1)], '#5a3a86', miolo='#b496e0', anel=False)
        VP.pegada_redonda(xc, yc, 0.62, 12)
    return d


# =====================================================================================================================
# a cela branca dos Mananciais
# =====================================================================================================================
H_CELA = 2.2


def mat_branco(seed=0):
    """O branco liso demais: sem junta, só a luz caindo para baixo em degraus e a sujeira de lodo no pé."""
    c0 = hx('#e8e4dc')
    ct = hx('#d6d2ca')

    def f(L, n, P):
        vert, a, z = ES._face_info(L, n)
        if not vert:
            return ES._topo_bloco(ct, L, seed, 0.94, 1.04)
        out = np.tile(c0, (len(P), 1))
        out = np.where((z < 1.4)[:, None], _tom(c0, 0.975), out)
        out = np.where((z < 0.7)[:, None], _tom(c0, 0.95), out)
        # o lodo que sobe do chão: a faixa escura e os fios subindo, repetindo a cada casa
        k = ES._celula(a, np.zeros_like(z), 2 * PH, 1.0, seed + 3)
        suja = (z < 0.06) | ((z < 0.06 + 0.4 * k ** 3) & (k > 0.6))
        out = np.where(suja[:, None], hx('#2a2430'), out)
        out = np.where(((z >= 0.06) & (z < 0.06 + PZ) & ~suja)[:, None], _tom(c0, 0.86), out)
        return np.where((z > H_CELA - PZ)[:, None], hx('#f6f4ee'), out)
    return emissivo(f)


def _cela_branca():
    ES._bloco(mat_branco(seed=41), H_CELA)


def _porta_cela_branca(aberta):
    """
    A grade branca na casa inteira entre dois blocos brancos: as ombreiras e a verga, e a grade de barras lisas como
    osso, com as três travessas e a argola. Fechada (0): no plano da frente. Aberta ('1'): girada para dentro, no lado
    de trás na tela (não tapa a passagem).
    """
    def d():
        rot = ES._rot()
        m = mat_branco(seed=41)
        J0, J1, ZV2 = 0.06, 0.69, 2.02
        o = C().novo_obj(3, contorno=False)
        C().caixa((0, J0, 0, CASA, 0, H_CELA), m, M, o)
        C().caixa((J1, CASA, 0, CASA, 0, H_CELA), m, M, o)
        C().caixa((J0, J1, 0, CASA, ZV2, H_CELA), m, M, o)
        peg(0, J0, 0, CASA)
        peg(J1, CASA, 0, CASA)
        cx((J0, J1, 0.0, CASA, 0.0, 0.012), {'cima': liso('#c8c4bc'), '*': liso('#a8a49c')}, o=novo(contorno=False))
        BAR = {'*': liso('#ece8e0'), 'cima': liso('#fbf9f4'), 'esq': liso('#d0ccc4'), 'dir': liso('#bcb8b0')}
        F0, F1 = J0 + 0.02, J1 - 0.02
        VF = 0.6
        og = novo()
        if not aberta:
            for k in range(6):
                x = F0 + 0.02 + k * (F1 - F0 - 0.06) / 5
                C().caixa((x, x + 0.022, VF, VF + 0.022, 0.012, ZV2), BAR, M, og)
            for z in (0.12, 1.0, 1.88):
                C().caixa((F0, F1, VF - 0.008, VF + 0.03, z, z + 0.04), BAR, M, og)
            ua = F1 - 0.08 if rot == 4 else F0 + 0.04
            cx((ua, ua + 0.04, VF + 0.03, VF + 0.05, 0.98, 1.06), liso('#9a968e'))
        else:
            L = F1 - F0
            xg = F0 if rot == 4 else F1 - 0.03
            for k in range(6):
                y = VF + 0.03 - L + 0.02 + k * (L - 0.06) / 5
                C().caixa((xg, xg + 0.022, y, y + 0.022, 0.012, ZV2), BAR, M, og)
            for z in (0.12, 1.0, 1.88):
                C().caixa((xg - 0.008, xg + 0.03, VF + 0.03 - L, VF + 0.03, z, z + 0.04), BAR, M, og)
            peg(xg, xg + 0.03, VF + 0.03 - L, VF + 0.03)
    return d


# =====================================================================================================================
# o lugar do Parasita de Dimensões (3 x 3, 1,6 m)
# =====================================================================================================================
def _rasgo(L, n, P):
    """A luz errada do rasgo: faixas que giram para dentro, do roxo fundo ao ciano e ao branco no meio."""
    xc = yc = 1.125
    u, v = (P[:, 0] - xc) / 0.62, (P[:, 1] - yc) / 0.5
    r = np.hypot(u, v)
    th = np.arctan2(v, u)
    k = (r * 3.2 + th / (2 * math.pi) * 2 + 0.3 * np.sin(th * 3)) % 1.0
    pal = np.stack([hx(c) for c in ('#1a0626', '#3c0e5a', '#6a2ab8', '#b05ae8', '#6ad8e8', '#e8fcff')])
    lvl = np.clip(np.round((1 - r) * 4 + (k < 0.3) * 1.2), 0, 5).astype(int)
    return pal[lvl]


def _ninho():
    xc = yc = 1.125
    # o chão rachado em volta, de lodo endurecido (a placa preta, um pouco acima do chão)
    ms = [OC.Mancha(xc, yc, 1.0, seed=811, amp=0.16, ex=1.05, ey=0.95, lobos=(2, 3, 5, 7))]
    OC.manchas_decal(ms, OC.mat_mancha(ms, ['#1c1524', '#0a080c'], beira=1.6))
    # o rasgo: o polígono torto que brilha
    o = luz_obj()
    pts = []
    for i in range(20):
        a = 2 * math.pi * i / 20
        rr = 1 + 0.18 * math.sin(3 * a + 0.5) + 0.1 * math.sin(7 * a)
        pts.append((xc + 0.62 * rr * math.cos(a), yc + 0.5 * rr * math.sin(a), 0.025))
    fp(pts, (0, 0, 1), emissivo(_rasgo), o)
    VN._halo([o], '#8a5ad8', [(-40, -30, 2), (36, -44, 2), (8, -60, 1), (-20, -70, 1)], '#c8a0ff', miolo='#ffffff')
    # a beira: os calombos de lodo duro em volta do rasgo
    ob = novo()
    for i in range(14):
        a = 2 * math.pi * i / 14 + 0.2
        rr = 1 + 0.18 * math.sin(3 * a + 0.5) + 0.1 * math.sin(7 * a)
        x, y = xc + 0.7 * rr * math.cos(a), yc + 0.58 * rr * math.sin(a)
        C().elipsoide(np.array([x, y, 0.0]), np.array([0.12, 0.11, 0.1 + 0.05 * (i % 3)]),
                      lambda Pc, N, P: np.tile(hx(LODO[2]), (len(P), 1)), ob, corte_z=0.0)
    # os tentáculos: tubos facetados saindo da beira, subindo e curvando para dentro, finos na ponta
    mt = mat_facetas(LODO, k0=1.2, kd=2.4, brilho_k=5)
    tent = [(0.3, 1.55, 0.8), (1.2, 1.2, 0.9), (2.0, 1.45, 0.75), (2.9, 1.0, 0.85), (3.7, 1.3, 0.7), (4.6, 1.5, 0.8), (5.5, 0.9, 0.85)]
    for (a, alto, ida) in tent:
        rr = 1 + 0.18 * math.sin(3 * a + 0.5) + 0.1 * math.sin(7 * a)
        x0, y0 = xc + 0.72 * rr * math.cos(a), yc + 0.6 * rr * math.sin(a)
        pts, raios = [], []
        for t in np.linspace(0, 1, 7):
            k = 1 - ida * t ** 1.6
            torce = 0.25 * math.sin(t * 4 + a)
            pts.append((xc + (x0 - xc) * k + torce * math.cos(a + 1.57) * t, yc + (y0 - yc) * k + torce * math.sin(a + 1.57) * t, alto * t))
            raios.append(0.075 * (1 - t) + 0.014)
        VN._tubo3(novo(), pts, raios, mt, lados=6)
    # as lascas pretas boiando em cima do rasgo
    for (x, y, z, ix, iy) in ((0.95, 1.05, 0.7, 0.4, -0.2), (1.3, 1.2, 0.95, -0.3, 0.3), (1.15, 0.9, 1.2, 0.1, 0.5)):
        VN.cristal(novo(), (x, y, z), (ix, iy, 1.0), 0.035, 0.12, 0.05, VN.CRISTAL['preto'][0], False, preto=True, seed=int(z * 10))
    VP.pegada_redonda(xc, yc, 1.0, 14)


# =====================================================================================================================
# os itens de parede: o veio de cristal, as Morcegosas, o lodo escorrendo
# =====================================================================================================================
def veio_cristal(cor, xc=1.5, zc=1.3):
    """
    O veio de cristal na rocha (50 x 60 px): a mancha de rocha lascada mais escura na parede e os cristais brotando
    dela, inclinados para fora e para cima, acesos (o halo de pixels).
    """
    n0 = len(C().objs)
    a, h = 0.55, 0.55
    pl = PC.Pl(xc - a, xc + a, zc - h, zc + h, 0.003)
    W, H = pl.W, 2 * h * MD.KZ
    du = (pl.u - W / 2) / (W / 2)
    dw = (pl.w - H / 2) / (H / 2)
    rr = np.hypot(du, dw * 1.1) + (suave(pl.u, pl.w, 4.0, 3) - 0.5) * 0.35
    rocha = pl.dentro & (rr < 0.9)
    pl.pin(rocha, '#3a3632')
    pl.pin(rocha & (suave(pl.u, pl.w, 3.0, 7) > 0.6), '#4a4640')
    pl.pin(rocha & (rr > 0.78), '#2a2622')
    pal = VN.CRISTAL[cor][0]
    pl.pin(rocha & (rr < 0.5) & (suave(pl.u, pl.w, 2.0, 9) > 0.55), pal[1])
    pl.limpa_soltos()
    pl.grava()
    o = luz_obj()
    for i, (dx, dz, ix, iz, r, comp, ponta) in enumerate(((0.0, -0.12, 0.05, 0.6, 0.07, 0.3, 0.12), (-0.2, -0.2, -0.5, 0.4, 0.05, 0.2, 0.09),
                                                          (0.22, -0.05, 0.6, 0.6, 0.055, 0.22, 0.1), (-0.08, 0.14, -0.3, 1.0, 0.045, 0.18, 0.08),
                                                          (0.14, 0.2, 0.35, 1.0, 0.04, 0.14, 0.07), (-0.26, 0.08, -0.8, 0.5, 0.035, 0.12, 0.06))):
        VN.cristal(o, (xc + dx, 0.02, zc + dz), (ix * 0.6, 0.45, 0.6 + iz), r, comp, ponta, pal, True, giro=0.4 + i, seed=i + 61)
    VN._halo([o], pal[4], [(-16, -20, 2), (18, -12, 1), (4, -30, 1)], pal[4], miolo=pal[5])
    PC.sombra_parede(n0, 1, 2)


def morcegosas(xc=1.5, zc=2.2):
    """
    A penca de Morcegosas (56 x 30 px): a saliência de pedra no alto da parede e, penduradas de cabeça para baixo, seis
    criaturas de asa fechada (o corpo de pelo cinza-roxo, as asas de couro enroladas, as orelhinhas para baixo) com os
    olhinhos vermelhos abertos.
    """
    n0 = len(C().objs)
    zt = zc + 0.26
    orc = novo()
    for k in range(9):
        C().elipsoide(np.array([xc - 0.6 + k * 0.15, 0.02, zt - 0.02 + 0.03 * math.sin(k * 2.1)]), np.array([0.1, 0.06, 0.06]),
                      VN.mat_pedra_eli('#6a665e', None, seed=k + 40), orc)
    bats = [(-0.48, 0.08, 1.0), (-0.28, 0.0, 0.85), (-0.06, 0.1, 1.05), (0.15, 0.02, 0.9), (0.34, 0.12, 1.0), (0.52, 0.04, 0.8)]
    hv, rv = BE.frente_tela()
    for i, (dx, cai, k) in enumerate(bats):
        x = xc + dx
        y = 0.06
        z1 = zt - 0.06
        zc_ = z1 - 0.06 - cai - 0.1 * k
        # os pés agarrados na pedra
        for s in (-0.012, 0.012):
            cx((x + s - 0.004, x + s + 0.004, y - 0.004, y + 0.004, zc_ + 0.08 * k, z1), liso('#2a2024'), o=novo(contorno=False))
        ob = novo()
        C().elipsoide(np.array([x, y, zc_]), np.array([0.04 * k, 0.035 * k, 0.085 * k]), lambda Pc, N, P: np.tile(hx('#4a3e4e'), (len(P), 1)), ob)
        for s in (-1, 1):
            C().elipsoide(np.array([x + s * 0.035 * k, y + 0.005, zc_ + 0.01]), np.array([0.028 * k, 0.04 * k, 0.1 * k]),
                          lambda Pc, N, P: np.tile(hx('#2e2432'), (len(P), 1)), ob)
        # a cabeça embaixo, as orelhas apontando para o chão e os olhinhos vermelhos (para a tela)
        C().elipsoide(np.array([x, y + 0.01, zc_ - 0.085 * k]), np.array([0.03 * k, 0.03 * k, 0.03 * k]), lambda Pc, N, P: np.tile(hx('#3e3242'), (len(P), 1)), ob)
        for s in (-1, 1):
            pau((x + s * 0.015 * k, y + 0.01, zc_ - 0.1 * k), (x + s * 0.022 * k, y + 0.01, zc_ - 0.14 * k), 0.012, liso('#2e2432'), o=novo(contorno=False))
        oe = luz_obj()
        for s in (-1, 1):
            ex, ey = x + s * 0.013 * rv[0] * 1.4, y + 0.04 + s * 0.013 * rv[1] * 1.4
            ez = zc_ - 0.085 * k
            P4 = [(ex, ey, ez), (ex + 0.012 * rv[0], ey + 0.012 * rv[1], ez), (ex + 0.012 * rv[0], ey + 0.012 * rv[1], ez + 0.014), (ex, ey, ez + 0.014)]
            fp(P4, (hv[0], hv[1], 0), liso('#ff3a2a'), oe, dois=True)
    PC.sombra_parede(n0, 1, 2)


def lodo_parede(xc=1.5, zc=1.0):
    """
    O lodo escorrendo (44 x 96 px, mancha na parede): a nascente torta lá em cima, os fios grossos descendo com a gota
    na ponta, a poça embaixo; o corpo preto-roxo, a beira um tom acima e o brilho molhado em riscas de 1 px.
    """
    a, h = 0.5, 0.9
    pl = PC.Pl(xc - a, xc + a, zc - h, zc + h, 0.003)
    W, H = pl.W, 2 * h * MD.KZ
    rng = np.random.default_rng(17)
    corpo = np.zeros_like(pl.dentro)
    # a nascente: a mancha irregular no alto
    du = (pl.u - W / 2) / (W * 0.42)
    dw = (pl.w - 14) / 9
    corpo |= pl.dentro & (np.hypot(du, dw) + (suave(pl.u, 0, 3.0, 4) - 0.5) * 0.6 < 1)
    # os fios descendo, cada um com a gota na ponta
    for k in range(7):
        u0 = W * (0.14 + 0.72 * k / 6) + rng.uniform(-2, 2)
        larg = rng.uniform(2.0, 4.2)
        fim = H - 5 if k in (1, 3, 4) else rng.uniform(H * 0.45, H * 0.85)
        onda = rng.uniform(0, 6)
        uu = u0 + 1.2 * np.sin(pl.w / 9 + onda)
        corpo |= pl.dentro & (np.abs(pl.u - uu) < larg / 2) & (pl.w > 10) & (pl.w < fim)
        corpo |= pl.elipse(u0 + 1.2 * math.sin(fim / 9 + onda), fim, larg * 0.75, larg * 0.95)
    # a poça embaixo
    corpo |= pl.dentro & (np.abs(pl.u - W / 2) < W * 0.46 * np.sqrt(np.clip(1 - ((H - pl.w) / 9) ** 2, 0, 1))) & (pl.w > H - 9)
    pl.pin(corpo, LODO[1])
    borda = pl.borda(corpo)
    pl.pin(borda, LODO[3])
    # o brilho: riscas verticais curtas e os pontos de luz
    br = corpo & ~borda & (np.floor(pl.u) % 7 == 2) & (suave(pl.u, pl.w, 5.0, 8) > 0.62)
    pl.pin(br, LODO[4])
    pl.pin(br & (suave(pl.u, pl.w, 2.0, 11) > 0.8), LODO[5])
    pl.limpa_soltos()
    pl.grava()


# =====================================================================================================================
ITENS = {
    'boca_tunel': (1, 1, (0.0, 0.0), _boca_tunel(True), {}),
    'boca_tunel~b': (1, 1, (0.0, 0.0), _boca_tunel(False), {}),
    'trilho_mina': (1, 1, (0.0, 0.0), _trilho, {}),
    'carrinho_mina': (1, 1, (0.0, 0.0), _carrinho, {}),
    'escora_mina': (1, 1, (0.0, 0.0), _escora, {}),
    'toca_toupeira': (1, 1, (0.0, 0.0), _toca, {}),
    'cristal_grande_verde': (2, 2, (0.0, 0.0), _cristal_grande('verde'), {'1': _cristal_grande('verde', False)}),
    'cristal_grande_vermelho': (2, 2, (0.0, 0.0), _cristal_grande('vermelho'), {'1': _cristal_grande('vermelho', False)}),
    'cristal_grande_azul': (2, 2, (0.0, 0.0), _cristal_grande('azul'), {'1': _cristal_grande('azul', False)}),
    'cristal_grande_preto': (2, 2, (0.0, 0.0), _cristal_grande('preto', False), {}),
    'cela_branca': (1, 1, (0.0, 0.0), _cela_branca, {}),
    'porta_cela_branca': (1, 1, (0.0, 0.0), _porta_cela_branca(False), {'1': _porta_cela_branca(True)}),
    'ninho_parasita': (3, 3, (0.0, 0.0), _ninho, {}),
}

SO_GIROS = {'boca_tunel': (4, 2), 'boca_tunel~b': (4, 2)}

ITENS_PAREDE = {
    'veio_cristal_verde': (lambda: veio_cristal('verde', 1.5, 1.3), (1.5, 1.3)),
    'veio_cristal_vermelho': (lambda: veio_cristal('vermelho', 1.5, 1.3), (1.5, 1.3)),
    'veio_cristal_azul': (lambda: veio_cristal('azul', 1.5, 1.3), (1.5, 1.3)),
    'morcegosas': (lambda: morcegosas(1.5, 2.2), (1.5, 2.2)),
    'lodo_parede': (lambda: lodo_parede(1.5, 1.0), (1.5, 1.0)),
}
