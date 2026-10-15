"""
GRUPO SB-F, "Santo Berço por fora, segunda leva" (15/10): a casa da Fazendeira (a fachada nova da Fazenda), a boca das
minas na encosta da montanha (o prédio-marco da vila, a oeste), o toco de morador e o túmulo do Bosque da Provação e a
boca da caverna no miolo do Labirinto. Pixel art 1:1 só por código, no estilo de vila_predios.py (a fachada usa o
`_andar` de lá, que confere os vãos sozinho) e de vila_natureza.py (a pedra, o musgo, as moitas).

Tudo no giro 4 (a frente para +y), a pegada começando em (0, 0), no tamanho do catálogo (shared/src/furni.ts, o bloco
"SANTO BERÇO (15/10)", a altura em METROS).

Decisões:
  - casa_fazendeira (7 x 6, 5,0 m): a casinha de enxaimel da vila, mais comprida, com o alpendre de tábuas na frente
    (os dois esteios, o telhadinho de uma água), o banco, as réstias de cebola e o fardo de feno; a porta no meio da
    frente (a casa 3), onde o jogo põe a Entrada.
  - boca_mina (5 x 4, 4,0 m): a rocha da encosta (os pedregulhos com musgo em cima) e, na frente (a casa 2, o meio),
    o portal de troncos com o vão escuro, o trilho saindo dele e o cristal vermelho pendurado. Na vila fica de giro 2
    (a frente para o leste, para a vila).
  - boca_caverna (2 x 2, pisável): o buraco no chão com a borda de pedras e os degraus de pedra descendo para o escuro;
    o que fica abaixo do chão só aparece pela boca (estrutura._por_cima_do_chao).
  - tumulo: a cova de terra com a cruz de galhos amarrada (~a) ou a lápide de pedra com a espiral (~b) na cabeceira (o
    fundo, o y = 0 do giro 4: no bosque, a árvore fica logo atrás).
"""
import math

import numpy as np

import cozinha as CZ
import base_estilo as BE
import medieval as MD
import vila_natureza as VN
import vila_predios as VP
import fazenda_fora as FF
import estrutura as ES
from base_estilo import hx, liso, mad2, tab2, _tom, _pau, _p1_malha, PH, PZ
from motor import emissivo, suave

M = BE.M
CASA = 0.75
cx, novo, peg, pau = MD.cx, MD.novo, MD.peg, MD.pau


def C():
    return CZ.c


def mat_terra(base='#5a4632', seed=0):
    """A terra da cova: blocos de 2 px em três tons e uns torrões claros."""
    c0 = hx(base)

    def f(L, n, P):
        a = np.floor((P[:, 0] - P[:, 1]) / (2 * PH))
        b = np.floor((P[:, 0] + P[:, 1]) / (4 * PH) - P[:, 2] / (2 * PZ))
        s = suave(a, b, 2.5, seed)
        out = np.tile(c0, (len(P), 1))
        out = np.where((s > 0.66)[:, None], _tom(c0, 1.14), out)
        out = np.where((s < 0.3)[:, None], _tom(c0, 0.84), out)
        return BE._cru(out, n)
    return emissivo(f)


# =====================================================================================================================
# a casa da Fazendeira (7 x 6 casas, 5,0 m)
# =====================================================================================================================
def _restia(x, y, z0, n=5):
    """A réstia de cebolas pendurada: o cordão de palha e as cebolas roxas em fila."""
    cx((x - 0.008, x + 0.008, y - 0.008, y + 0.008, z0 - 0.06 * n - 0.04, z0), liso('#c8a868'), o=novo(contorno=False))
    oc = novo()
    for k in range(n):
        z = z0 - 0.06 - 0.06 * k
        s = 0.025 if k % 2 else -0.025
        C().elipsoide(np.array([x + s, y + 0.01, z]), np.array([0.035, 0.035, 0.035]), lambda Pc, N, P: np.tile(hx('#8a3a5a'), (len(P), 1)), oc)


def _casa_fazendeira():
    W, D = 7 * CASA, 6 * CASA
    X0, X1, Y0, Y1 = 0.3, W - 0.3, 0.3, D - 1.2
    B = (X0, X1, Y0, Y1)
    XP = VP._porta_x(7)
    XM = (X0 + X1) / 2
    ZB, ZE, ZR = 0.3, 2.6, 5.0 - 0.05
    BEI = 0.3
    TAIPA = VP.mat_taipa('#d8c8a2', seed=7)
    VP.caixa((X0, X1, Y0, Y1, 0, ZE), TAIPA)
    FF.rodape_pedra(B, ZB)
    YM = (Y0 + Y1) / 2
    vaos = {
        '+y': [('p', XP, 0.86, 1.9, 1, True), ('j', X0 + 0.85, 1.05, 0.56, 0.72, True, True), ('j', X1 - 0.85, 1.05, 0.56, 0.72, True, True)],
        '-y': [('j', XM, 1.05, 0.56, 0.72, False, True)],
        '+x': [('j', YM, 1.05, 0.56, 0.72, True, True)],
        '-x': [('j', YM, 1.05, 0.56, 0.72, True, True)],
    }
    VP._andar(B, ZB, ZE - 0.1, vaos, riegel=1.05 - VP.FR - 0.07, seed=13)
    # o telhado de duas águas (a cumeeira ao longo de x) e a chaminé de pedra do fogão
    YR = (Y0 + Y1) / 2
    KT = (ZR - ZE) / (YR - Y0)
    perfil = [(Y0 - BEI, ZE - BEI * KT), (YR, ZR), (Y1 + BEI, ZE - BEI * KT)]
    FF.telhado(X0, X1, Y0, Y1, perfil, 'x', VP.TELHA_V, VP.TELHA_VJ, TAIPA, testeira='#5a3a24', cumeeira=VP.CUMEEIRA_V, seed=17,
               beiral_u=0.28, musgo=0.0)
    VP._oitao('+x', X1, Y0, Y1, ZE - 0.1, perfil, seed=18)
    VP._oitao('-x', X0, Y0, Y1, ZE - 0.1, perfil, seed=19)
    FF.chamine(X0 + 0.5, X0 + 0.97, YR - 0.3, YR + 0.17, ZE - 0.4, ZR + 0.3)
    VP._fumaca(X0 + 0.73, YR - 0.06, ZR + 0.35, n=3, seed=4, r=0.13, sobe=0.3)
    # o alpendre: o piso de tábua, os dois esteios, o telhadinho de uma água encostado na parede
    PY1 = Y1 + 0.95
    zt0, zt1 = 2.25, 2.55
    cx((X0 + 0.2, X1 - 0.2, Y1, PY1, 0.0, ZB), {'cima': tab2(['#7a5232', '#70482c', '#82583a'], 0.14, '#3a2414', eixo=0, seed=8),
                                                '*': mad2('#5a3a24', eixo=0, seed=9, passo=0.05)})
    for xx in (X0 + 0.32, X1 - 0.32):
        VP._tora_z(xx, PY1 - 0.12, ZB, zt0, 0.06, seed=int(xx * 10))
    cx((X0 + 0.2, X1 - 0.2, PY1 - 0.2, PY1 - 0.06, zt0 - 0.1, zt0), {'*': mad2('#4e3420', eixo=0, seed=10, passo=0.05), 'cima': liso('#5e4430')})
    tel = FF.tab2(['#9c3826', '#a8402a', '#b24a30'], 0.12, '#4a1a10', eixo=1, seed=11) if hasattr(FF, 'tab2') else liso('#a8402a')
    o = novo()
    pts = [(X0 + 0.1, Y1 - 0.02, zt1), (X1 - 0.1, Y1 - 0.02, zt1), (X1 - 0.1, PY1 + 0.2, zt0 - 0.02), (X0 + 0.1, PY1 + 0.2, zt0 - 0.02)]
    MD.fp(pts, (0, 0.6, 0.8), tel, o, dois=True)
    cx((X0 + 0.1, X1 - 0.1, PY1 + 0.16, PY1 + 0.22, zt0 - 0.08, zt0 - 0.01), liso('#5a3a24'))
    _degraus = VP._degraus
    _degraus('+y', PY1, XP, 1.1, ZB, n=2, prof=0.18)
    # o banco encostado na parede, as réstias de cebola, o fardo de feno e o balde
    cx((X0 + 0.45, X0 + 1.35, Y1 + 0.05, Y1 + 0.38, ZB + 0.4, ZB + 0.46), {'cima': tab2(['#7a5232', '#70482c'], 0.11, '#3a2414', eixo=0, seed=12),
                                                                         '*': liso('#5a3a24')})
    for xx in (X0 + 0.5, X0 + 1.3):
        cx((xx - 0.03, xx + 0.03, Y1 + 0.1, Y1 + 0.33, ZB, ZB + 0.4), liso('#4a3020'))
    for xx in (X1 - 1.4, X1 - 1.2, X1 - 1.0):
        _restia(xx, Y1 + 0.06, zt0 - 0.15)
    VP._lampiao_cristal('+y', Y1, XP + 0.72, 1.6)
    _p1_malha((X1 - 0.95, X1 - 0.25, Y1 + 0.2, Y1 + 0.75, ZB, ZB + 0.45), (0.05, 0.05, 0.03, 0.05), MD.palhoca(), seg=2)
    VP._moita(X0 - 0.12, Y1 - 0.4, 0.2, 0.42, seed=21, pal=VP.MOITA_ROXA)
    VP._moita(X1 + 0.15, Y0 + 0.6, 0.2, 0.45, seed=22, pal=VP.MOITA_OCRE)
    VP.pegada(X0, X1, Y0, PY1)


# =====================================================================================================================
# a boca das minas (5 x 4 casas, 4,0 m)
# =====================================================================================================================
def _boca_mina():
    W, D = 5 * CASA, 4 * CASA
    XP = VP._porta_x(5)
    YF = D - 0.35                         # a frente do portal
    # a rocha da encosta: os pedregulhos grandes, com o musgo por cima
    o = novo()
    for (x, y, rx, ry, rz, s) in ((XP, 1.1, 1.75, 1.15, 3.9, 1), (0.55, 1.7, 0.75, 0.85, 2.2, 2), (W - 0.55, 1.6, 0.75, 0.9, 2.5, 3),
                                  (0.9, 0.6, 0.9, 0.6, 3.0, 4), (W - 0.9, 0.6, 0.9, 0.6, 3.2, 5), (XP - 0.9, YF - 0.3, 0.45, 0.4, 1.4, 6),
                                  (XP + 0.95, YF - 0.25, 0.42, 0.42, 1.2, 7), (0.3, YF - 0.1, 0.35, 0.3, 0.6, 8), (W - 0.3, YF - 0.2, 0.32, 0.3, 0.5, 9)):
        C().elipsoide(np.array([x, y, 0.0]), np.array([rx, ry, rz]), VN.mat_pedra_eli('#7a766c', 0.5, seed=s), o, corte_z=0.0)
    # o vão escuro em arco e o portal de troncos na frente dele
    xa, xb = XP - 0.42, XP + 0.42
    ZT = 2.15

    def escuro(L, n, P):
        z = L[:, 2]
        out = np.tile(hx('#080607'), (len(L), 1))
        out = np.where((z < 0.4)[:, None], hx('#120e0c'), out)
        return np.where((z < 0.12)[:, None], hx('#1c1612'), out)
    ov = C().novo_obj(3, contorno=False, sombra=False)
    MD.fp([(xa, YF - 0.12, 0.0), (xb, YF - 0.12, 0.0), (xb, YF - 0.12, ZT), (xa, YF - 0.12, ZT)], (0, 1, 0), emissivo(escuro), ov)
    for x in (xa - 0.04, xb + 0.04):
        VP._tora_z(x, YF - 0.05, 0.0, ZT + 0.1, 0.075, seed=int(x * 10))
    VP._tora_x(xa - 0.3, xb + 0.3, YF - 0.05, ZT + 0.1, 0.09, seed=3)
    # a tábua com a espiral pregada na trave e o cristal vermelho pendurado na corrente
    cx((XP - 0.18, XP + 0.18, YF + 0.04, YF + 0.07, ZT + 0.2, ZT + 0.42), {'*': mad2('#6a4a2c', seed=5, passo=0.04), 'cima': liso('#7a5634')})
    cx((XP + 0.24, XP + 0.26, YF + 0.02, YF + 0.04, ZT - 0.25, ZT + 0.02), liso('#3a3432'), VP.obj(contorno=False))
    MD.cristal(XP + 0.25, YF + 0.03, ZT - 0.55, 0.28, 0.05, aceso=True)
    # o trilho saindo do escuro
    for xx in (XP - 0.2, XP + 0.14):
        cx((xx, xx + 0.035, YF - 0.12, D, 0.03, 0.06), {'cima': liso('#9a948c'), '*': liso('#4e4844')}, o=novo(contorno=False))
    for yy in (YF - 0.05, YF + 0.25):
        cx((XP - 0.3, XP + 0.28, yy, yy + 0.12, 0.0, 0.03), {'cima': liso('#5e4228'), '*': liso('#3e2a18')})
    # as pedras soltas e a picareta encostada
    for (x, y, r, s) in ((XP - 0.75, YF + 0.15, 0.12, 11), (XP + 0.7, YF + 0.2, 0.1, 12), (0.4, D - 0.15, 0.13, 13)):
        VN.pedra(x, y, r, r * 0.9, r * 0.8, base='#7a766c', musgo=None, seed=s)
    pau((XP + 0.62, YF, 0.0), (XP + 0.55, YF - 0.05, 0.9), 0.03, liso('#8a6a42'))
    cx((XP + 0.42, XP + 0.7, YF - 0.07, YF - 0.03, 0.86, 0.92), MD.ferro())
    VP._moita(0.3, 0.3, 0.25, 0.5, seed=31, pal=VP.MOITA_ROXA)
    VP._moita(W - 0.3, YF, 0.2, 0.4, seed=32, pal=VP.MOITA_AZUL)
    VP.pegada(0.1, W - 0.1, 0.1, D - 0.1)


# =====================================================================================================================
# o Bosque da Provação: o toco de morador e o túmulo
# =====================================================================================================================
def _toco():
    """O toco (1 x 1, 0,45 m): o tronco cortado rente com a casca (o corte claro com os anéis em cima) e as raízes."""
    xc, yc = 0.375, 0.39
    VP._tora_z(xc, yc, 0.0, 0.45, 0.2, seed=7, r1=0.19)
    for k in range(5):
        a = 2 * math.pi * k / 5 + 0.3
        pau((xc + 0.15 * math.cos(a), yc + 0.15 * math.sin(a), 0.14), (xc + 0.31 * math.cos(a), yc + 0.31 * math.sin(a), 0.0), 0.055,
            mad2('#4e3622', eixo=1, seed=k, passo=0.04))
    # o musgo roxo na casca e o machado de quem cortou, marcado no corte
    C().elipsoide(np.array([xc - 0.12, yc + 0.12, 0.18]), np.array([0.07, 0.05, 0.08]), lambda Pc, N, P: np.tile(hx('#5e3c78'), (len(P), 1)), novo())
    cx((xc - 0.05, xc + 0.07, yc - 0.01, yc + 0.01, 0.45, 0.452), liso('#7a5634'), o=novo(contorno=False))
    VP.pegada_redonda(xc, yc, 0.3, 8)


def _tumulo(pedra=False):
    def d():
        # a cova: o monte comprido de terra (a cabeceira no fundo)
        _p1_malha((0.13, 0.62, 0.28, 1.42, 0.0, 0.2), (0.12, 0.14, 0.02, 0.12), mat_terra(seed=3 if pedra else 4), seg=3)
        # as florzinhas roxas e amarelas plantadas em cima
        of = novo()
        for (x, y, cor) in ((0.28, 0.6, '#9a5ac8'), (0.45, 0.85, '#d8b840'), (0.3, 1.1, '#9a5ac8'), (0.5, 1.25, '#7a8ad8')):
            C().elipsoide(np.array([x, y, 0.22]), np.array([0.03, 0.03, 0.025]), lambda Pc, N, P, c=cor: np.tile(hx(c), (len(P), 1)), of)
        if pedra:
            # a lápide de pedra, com a espiral riscada
            def espiral(L, n, P):
                out = np.tile(hx('#8a8478'), (len(P), 1))
                if abs(n[1]) > 0.5:
                    u = (P[:, 0] - 0.375) / 0.16
                    v = (P[:, 2] - 0.36) / 0.16
                    rr = np.hypot(u, v * 1.3)
                    th = np.arctan2(v * 1.3, u)
                    k = (rr / 0.32 - th / (2 * math.pi)) % 1
                    out = np.where(((k < 0.3) & (rr < 0.9) & (rr > 0.08))[:, None], hx('#4e4a42'), out)
                    out = np.where((P[:, 2] < 0.08)[:, None], hx('#5a6a4a'), out)
                return out
            cx((0.16, 0.59, 0.1, 0.22, 0.0, 0.52), {'*': emissivo(espiral), 'cima': liso('#a49e92')}, ch=0.03)
        else:
            # a cruz de galhos amarrada com corda
            CA = mad2('#5a3e28', eixo=1, seed=9, passo=0.03)
            cx((0.35, 0.4, 0.13, 0.18, 0.0, 0.62), CA)
            pau((0.2, 0.155, 0.44), (0.55, 0.155, 0.47), 0.04, mad2('#5a3e28', eixo=0, seed=10, passo=0.03))
            cx((0.34, 0.41, 0.12, 0.19, 0.42, 0.48), liso('#b89a5e'))
        peg(0.13, 0.62, 0.1, 1.42)
    return d


# =====================================================================================================================
# a boca da caverna (2 x 2, pisável), no miolo do Labirinto
# =====================================================================================================================
def _boca_caverna():
    U0, U1, V0, V1 = 0.35, 1.15, 0.3, 1.2
    FUNDO = -1.6
    ES._poco(U0, U1, V0, V1, FUNDO, ES.pedra('#5a5650', 0.2, 0.15, seed=4))
    ES._degraus_descendo(U0 + 0.05, U1 - 0.05, V0, V1, 7, 0.22, ES.pedra('#7a766c', 0.2, 0.12, seed=5), liso('#4a4640'), FUNDO)
    # a borda de pedras em volta do buraco (meio enterradas), sem tapar a frente (a entrada da escada)
    o = novo()
    rng = np.random.default_rng(9)
    for k in range(16):
        t = k / 16
        if t < 0.25:
            x, y = U0 + (U1 - U0) * (t / 0.25), V0 - 0.07
        elif t < 0.5:
            x, y = U1 + 0.07, V0 + (V1 - V0) * ((t - 0.25) / 0.25)
        elif t < 0.75:
            x, y = U1 - (U1 - U0) * ((t - 0.5) / 0.25), V1 + 0.07
        else:
            x, y = U0 - 0.07, V1 - (V1 - V0) * ((t - 0.75) / 0.25)
        r = 0.1 + 0.05 * rng.random()
        C().elipsoide(np.array([x, y, 0.0]), np.array([r, r * 0.9, 0.08 + 0.05 * rng.random()]), VN.mat_pedra_eli('#6e6a62', 0.5, seed=k + 3), o, corte_z=0.0)
    ES._por_cima_do_chao((U0, U1, V0, V1))


# =====================================================================================================================
ITENS = {
    'casa_fazendeira': (7, 6, (0.0, 0.0), _casa_fazendeira, {}),
    'boca_mina': (5, 4, (0.0, 0.0), _boca_mina, {}),
    'toco_morador': (1, 1, (0.0, 0.0), _toco, {}),
    'tumulo': (1, 2, (0.0, 0.0), _tumulo(False), {}),
    'tumulo~b': (1, 2, (0.0, 0.0), _tumulo(True), {}),
    'boca_caverna': (2, 2, (0.0, 0.0), _boca_caverna, {}),
}
