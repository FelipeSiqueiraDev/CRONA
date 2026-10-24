"""
O JARDIM DO FRITZ (23/10), a propriedade murada em Pedra Serena, afastada do centro, pela planta ilustrada do Felipe
("Jardim Secreto"): os prédios e as peças de fora, em pixel art 1:1 só por código, no acabamento da mansão
(mansao_predios.py: as janelas de cantaria, a porta dupla, os cunhais, a cornija) e de Santa Amália (santa_amalia.py:
o reboco, o telhado de telha cerâmica).

O casarão é uma vila de reboco creme e telha de barro: o corpo central de dois andares recuado, as duas alas que vêm
para a frente, a varanda com as colunas e o terraço em cima, a escadaria. Atrás, a estufa principal de ferro e vidro
(a abóbada) e as estufas auxiliares (duas águas de vidro); o laboratório, o alojamento e a oficina, de reboco e telha;
a instalação de contenção, de concreto, sem janela. E as peças do jardim: o gazebo, o pergolado da área de convivência,
o canteiro elevado, a composteira e o buxinho podado dos canteiros formais.

Tudo desenhado no giro 4 (a frente para +y), a pegada começando em (0, 0), no tamanho do catálogo (shared/src/furni.ts,
o bloco "JARDIM DO FRITZ"). Os prédios são fechados (o interior, quando houver, é outra cena). Nada de texto, número,
logo ou símbolo.
"""
import math

import numpy as np

import cozinha as CZ
import fazenda_fora as FF
import vila_predios as VP
import tiradentes as TD
import santa_amalia as SA
import mansao_predios as MP
from base_estilo import hx, liso, mad2, tab2, vol, _tom, _poligono_rodado, _disco, PH, PZ
from motor import suave, emissivo, MUNDO as M

CASA = 0.75
obj = FF.obj
caixa = FF.caixa
pegada = FF.pegada
_bx = FF._bx
_hex = TD._hex

VP.ALTO_CANVAS.update({'casarao_fritz': 9.4, 'estufa_principal': 7.2, 'estufa_auxiliar': 4.8, 'laboratorio_fritz': 5.6,
                       'alojamento_fritz': 7.4, 'oficina_fritz': 5.2, 'contencao_fritz': 5.0})

# ---------------------------------------------------------------- a paleta
REBOCO = '#e6d6b4'          # o reboco creme do casarão e dos anexos
REBOCO_ANEXO = '#ddcfb2'
BARRADO = '#9a8a6a'
FERRO = '#2c2c2a'
CAIXILHO = '#e4e8e2'        # o ferro pintado de branco das estufas
CONCRETO = ['#8e8e8a', '#868682', '#96968f']


def _parede(cor=REBOCO, seed=0):
    return SA.mat_parede(cor, seed=seed, sujeira=0.35)


# =====================================================================================================================
# o vidro das estufas: o caixilho branco em grade, o reflexo do céu em cima e as plantas lá dentro embaixo
# =====================================================================================================================
def mat_vidro_estufa(eixo_lat, passo=0.5, travessa=0.62, z_mato=1.6, seed=0, teto=False):
    def f(L, n, P):
        lat = P[:, eixo_lat]
        z = P[:, 2]
        k = np.clip((z - 0.3) / 3.0, 0, 1)[:, None]
        out = hx('#86aaa0') * (1 - k) + hx('#b4d0c8') * k
        if not teto:
            # as plantas atrás do vidro: a mancha verde que sobe e desce ao longo da parede, em três tons
            q = suave(lat * 1.3, z * 0.2, 0.6, 31 + seed)
            alto = z_mato * (0.55 + 0.7 * q)
            mato = z < alto
            t = suave(lat * 3.0, z * 3.0, 0.3, 37 + seed)
            verde = np.where((t > 0.6)[:, None], hx('#5a8a48'), np.where((t < 0.3)[:, None], hx('#2c5030'), hx('#3e6a3c')))
            out = np.where(mato[:, None], verde, out)
            out = np.where((mato & (z > alto - 0.06))[:, None], hx('#6e9a54'), out)
        else:
            out = np.where((suave(lat * 0.8, P[:, 1 - eixo_lat] * 0.8, 0.9, 41 + seed) > 0.7)[:, None], hx('#cde2da'), out)
        # o caixilho: os montantes ao longo e as travessas (1 px e meio, brancos), a luz de 1 px depois
        a = ((lat + 50) / passo) % 1
        b = ((z + 50) / travessa) % 1 if not teto else ((P[:, 1 - eixo_lat] + 50) / travessa) % 1
        fr = (a < 1.4 * PH / passo) | (b < 1.4 * PZ / travessa)
        out = np.where(fr[:, None], hx(CAIXILHO), out)
        return out
    return emissivo(f)


def _vidro_quad(pts, n, eixo_lat, o, seed=0, teto=False):
    CZ.c.face_plana(pts, n, mat_vidro_estufa(eixo_lat, seed=seed, teto=teto), M, o)


def _mureta(X0, X1, Y0, Y1, z, cortes=()):
    """A mureta de tijolo aparente embaixo do vidro, com a capa de cimento clara."""
    tij = FF.mat_juntas(['#9a5a3e', '#a4644a', '#8e5238'], lambda P: (np.floor((P[:, 2] + 50) / 0.075).astype(np.int64) * 1000
                        + np.floor((P[:, 0] + P[:, 1] + 50 + 0.1 * (np.floor((P[:, 2] + 50) / 0.075) % 2)) / 0.22).astype(np.int64)), '#5a3426', seed=5)
    for b in ((X0, X1, Y1 - 0.12, Y1), (X0, X1, Y0, Y0 + 0.12), (X0, X0 + 0.12, Y0, Y1), (X1 - 0.12, X1, Y0, Y1)):
        caixa((b[0], b[1], b[2], b[3], 0.0, z), tij)
    for b in ((X0 - 0.03, X1 + 0.03, Y1 - 0.15, Y1 + 0.03), (X0 - 0.03, X1 + 0.03, Y0 - 0.03, Y0 + 0.15),
              (X0 - 0.03, X0 + 0.15, Y0, Y1), (X1 - 0.15, X1 + 0.03, Y0, Y1)):
        caixa((b[0], b[1], b[2], b[3], z, z + 0.05), {'*': liso('#a8a49a'), 'cima': liso('#c4c0b6')})


def _paredes_vidro(X0, X1, Y0, Y1, z0, z1, seed=0, porta=None):
    """As quatro paredes de vidro (planas) de z0 a z1. porta: (a0, a1, alto) o vão da porta na frente (+y)."""
    o = obj()
    for (pts, n, ax) in (([(X0, Y1, z0), (X1, Y1, z0), (X1, Y1, z1), (X0, Y1, z1)], (0, 1, 0), 0),
                         ([(X1, Y0, z0), (X0, Y0, z0), (X0, Y0, z1), (X1, Y0, z1)], (0, -1, 0), 0),
                         ([(X1, Y1, z0), (X1, Y0, z0), (X1, Y0, z1), (X1, Y1, z1)], (1, 0, 0), 1),
                         ([(X0, Y0, z0), (X0, Y1, z0), (X0, Y1, z1), (X0, Y0, z1)], (-1, 0, 0), 1)):
        _vidro_quad(pts, n, ax, o, seed=seed + ax)
    # os pilares de canto e o frechal (o ferro branco)
    mf = {'*': liso(CAIXILHO), 'cima': liso('#f4f6f2')}
    for (x, y) in ((X0, Y0), (X1, Y0), (X0, Y1), (X1, Y1)):
        caixa((x - 0.05, x + 0.05, y - 0.05, y + 0.05, z0, z1 + 0.05), mf)
    for b in ((X0 - 0.05, X1 + 0.05, Y1 - 0.05, Y1 + 0.05), (X0 - 0.05, X1 + 0.05, Y0 - 0.05, Y0 + 0.05),
              (X0 - 0.05, X0 + 0.05, Y0, Y1), (X1 - 0.05, X1 + 0.05, Y0, Y1)):
        caixa((b[0], b[1], b[2], b[3], z1 - 0.02, z1 + 0.06), mf)
    if porta:
        a0, a1, h = porta
        caixa((a0, a1, Y1, Y1 + 0.03, z0, z0 + h), {'*': emissivo(lambda L, n_, P: np.where(
            ((np.abs(P[:, 0] - (a0 + a1) / 2) < 0.02) | (((P[:, 0] - a0) % ((a1 - a0) / 2)) < 0.05) | (P[:, 2] > z0 + h - 0.05)
             | (np.abs(P[:, 2] - (z0 + h * 0.45)) < 0.03))[:, None], hx(CAIXILHO), hx('#5a7a70')))})
        # a maçaneta de latão
        caixa(((a0 + a1) / 2 - 0.06, (a0 + a1) / 2 + 0.06, Y1 + 0.03, Y1 + 0.05, z0 + 0.95, z0 + 1.0), liso('#d8b060'), contorno=False)


# =====================================================================================================================
# a ESTUFA PRINCIPAL (10 x 12 casas, 6,4 m): o vidro reto até 2,8 m e a abóbada de vidro em cima (a cumeeira em y), a
# porta dupla de vidro na frente (virada para o casarão), a lanterna de ventilação no alto
# =====================================================================================================================
def _estufa_principal():
    W, D = 10 * CASA, 12 * CASA
    X0, X1, Y0, Y1 = 0.25, W - 0.25, 0.3, D - 0.4
    XM = (X0 + X1) / 2
    R = (X1 - X0) / 2
    ZM, ZP = 0.55, 2.8
    _mureta(X0, X1, Y0, Y1, ZM)
    _paredes_vidro(X0, X1, Y0, Y1, ZM + 0.05, ZP, seed=1, porta=(XM - 0.75, XM + 0.75, 2.1))
    # a abóbada: N faixas retas ao longo de y, as nervuras de ferro nas emendas
    N = 10
    o = obj()
    ang = [math.pi * i / N for i in range(N + 1)]
    pt = lambda a, y: (XM + R * math.cos(a), y, ZP + R * math.sin(a) * 0.82)
    for i in range(N):
        a0, a1 = ang[i], ang[i + 1]
        am = (a0 + a1) / 2
        nrm = (math.cos(am), 0.0, math.sin(am))
        _vidro_quad([pt(a0, Y1), pt(a0, Y0), pt(a1, Y0), pt(a1, Y1)], nrm, 1, o, seed=10 + i, teto=True)
    mf = liso(CAIXILHO)
    for i in range(N + 1):
        FF._viga(obj(), pt(ang[i], Y0 - 0.02), pt(ang[i], Y1 + 0.02), 0.05, mf)
    # as testeiras (os arcos de ferro da frente e do fundo) e o vidro em meia-lua nas duas pontas
    for (yy, sg) in ((Y1, 1), (Y0, -1)):
        oe = obj()
        pts = [pt(a, yy) for a in (ang if sg > 0 else ang[::-1])]
        CZ.c.face_plana(pts, (0, sg, 0), mat_vidro_estufa(0, seed=20 + sg), M, oe)
        for i in range(N):
            FF._viga(obj(), pt(ang[i], yy + sg * 0.03), pt(ang[i + 1], yy + sg * 0.03), 0.08, mf)
        # os raios do leque (do meio da base para o arco)
        for i in range(1, N, 2):
            FF._viga(obj(), (XM, yy + sg * 0.02, ZP), pt(ang[i], yy + sg * 0.02), 0.035, mf)
    # a lanterna de ventilação no alto: a caixinha de vidro com o telhadinho e o pináculo
    zt = ZP + R * 0.82
    caixa((XM - 0.35, XM + 0.35, Y0 + 1.6, Y1 - 1.6, zt - 0.05, zt + 0.32), {'*': mat_vidro_estufa(1, passo=0.35, seed=31, teto=False), 'cima': liso('#6a8a84')})
    FF._viga(obj(), (XM, Y0 + 1.5, zt + 0.36), (XM, Y1 - 1.5, zt + 0.36), 0.1, liso('#4a5a56'))
    for yy in (Y0 + 1.5, Y1 - 1.5):
        CZ.c.cilindro(XM, yy, 0.035, zt + 0.36, zt + 0.7, liso(FERRO), M, obj(), lados=8, tampa=True)
        CZ.c.elipsoide((XM, yy, zt + 0.72), (0.06, 0.06, 0.06), lambda Pc, N_, P: FF._cru_eli(np.tile(hx('#d8b060'), (len(P), 1)), N_), obj())
    # o caminho de lajota da porta e os dois vasos de buxinho
    caixa((XM - 0.8, XM + 0.8, Y1, D - 0.02, 0.0, 0.04), {'cima': SA.mat_cimento(0.4, 0, seed=7), '*': liso('#8a867c')})
    for xx in (XM - 1.2, XM + 1.2):
        TD._vaso(xx, Y1 + 0.22, 0.0, r=0.17, h=0.34, flores=None, seed=int(xx * 10))
    pegada(X0, X1, Y0, Y1)


# =====================================================================================================================
# a ESTUFA AUXILIAR (7 x 10 casas, 4,2 m): o vidro reto até 2,3 m e o telhado de vidro de duas águas (a cumeeira em y)
# =====================================================================================================================
def _estufa_auxiliar():
    W, D = 7 * CASA, 10 * CASA
    X0, X1, Y0, Y1 = 0.25, W - 0.25, 0.3, D - 0.4
    XM = (X0 + X1) / 2
    ZM, ZP, ZR = 0.5, 2.3, 4.0
    _mureta(X0, X1, Y0, Y1, ZM)
    _paredes_vidro(X0, X1, Y0, Y1, ZM + 0.05, ZP, seed=3, porta=(XM - 0.45, XM + 0.45, 1.95))
    o = obj()
    k = (ZR - ZP) / (XM - X0)
    nn = math.hypot(1, k)
    _vidro_quad([(X0 - 0.1, Y1 + 0.1, ZP - 0.1 * k), (X0 - 0.1, Y0 - 0.1, ZP - 0.1 * k), (XM, Y0 - 0.1, ZR), (XM, Y1 + 0.1, ZR)], (-k / nn, 0, 1 / nn), 1, o, seed=4, teto=True)
    _vidro_quad([(X1 + 0.1, Y0 - 0.1, ZP - 0.1 * k), (X1 + 0.1, Y1 + 0.1, ZP - 0.1 * k), (XM, Y1 + 0.1, ZR), (XM, Y0 - 0.1, ZR)], (k / nn, 0, 1 / nn), 1, o, seed=5, teto=True)
    for (yy, sg) in ((Y1, 1), (Y0, -1)):
        pts = [(X0, yy, ZP), (X1, yy, ZP), (XM, yy, ZR - 0.05)] if sg > 0 else [(X1, yy, ZP), (X0, yy, ZP), (XM, yy, ZR - 0.05)]
        CZ.c.face_plana(pts, (0, sg, 0), mat_vidro_estufa(0, seed=6 + sg), M, obj())
    mf = liso(CAIXILHO)
    FF._viga(obj(), (XM, Y0 - 0.12, ZR + 0.02), (XM, Y1 + 0.12, ZR + 0.02), 0.08, mf)
    for yy in np.linspace(Y0, Y1, 6):
        FF._viga(obj(), (X0 - 0.1, yy, ZP - 0.08), (XM, yy, ZR), 0.04, mf)
        FF._viga(obj(), (X1 + 0.1, yy, ZP - 0.08), (XM, yy, ZR), 0.04, mf)
    # as janelas basculantes abertas no telhado (duas de cada lado, a borda escura)
    for yy in (Y0 + 1.6, Y1 - 2.4):
        for sx in (-1, 1):
            xa = XM + sx * 0.6
            za = ZR - 0.6 * k
            caixa((min(xa, xa + sx * 0.5), max(xa, xa + sx * 0.5), yy, yy + 0.8, za, za + 0.08), {'*': liso('#4a5a56'), 'cima': liso('#a4c4bc')})
    pegada(X0, X1, Y0, Y1)


# =====================================================================================================================
# os prédios de reboco: a parede, o barrado, a cornija simples, o telhado cerâmico
# =====================================================================================================================
def _corpo_reboco(B, ZE, cor=REBOCO, seed=0, barrado=True):
    X0, X1, Y0, Y1 = B
    caixa((X0, X1, Y0, Y1, 0.0, ZE), _parede(cor, seed))
    if barrado:
        TD._faixa(B, 0.0, 0.42, {'*': liso(BARRADO), 'cima': liso(_hex(_tom(hx(BARRADO), 1.14)))}, e=0.03)
    # a cimalha clara embaixo do beiral
    caixa((X0 - 0.05, X1 + 0.05, Y0 - 0.05, Y1 + 0.05, ZE - 0.16, ZE), {'*': liso(MP.CANT[1]), 'cima': liso(MP.CANT[0])})


def _jan(face, plano, a, z0, w=0.84, h=1.5, acesa=False, seed=0, topo='reta'):
    MP._janela_m(face, plano, a, z0, w, h, acesa=acesa, topo=topo, seed=seed)


# =====================================================================================================================
# o CASARÃO (24 x 12 casas, 8,6 m): o corpo central recuado de dois andares, as duas alas que vêm para a frente, a varanda
# entre elas (as colunas, o terraço com a balaustrada em cima), a escadaria, a porta dupla, as janelas de cantaria
# =====================================================================================================================
def _balaustrada(x0, x1, y0, y1, z, alto=0.85, passo=0.2):
    """A balaustrada: o rodapé, os balaústres (cilindros barrigudos) e o corrimão de cantaria."""
    m = {'*': liso(MP.CANT[1]), 'cima': liso(MP.CANT[0])}
    caixa((x0, x1, y0, y1, z, z + 0.1), m)
    caixa((x0 - 0.03, x1 + 0.03, y0 - 0.03, y1 + 0.03, z + alto - 0.1, z + alto), m)
    comp = max(x1 - x0, y1 - y0)
    n = max(2, int(comp / passo))
    for i in range(n):
        t = (i + 0.5) / n
        x = x0 + (x1 - x0) * t if (x1 - x0) >= (y1 - y0) else (x0 + x1) / 2
        y = (y0 + y1) / 2 if (x1 - x0) >= (y1 - y0) else y0 + (y1 - y0) * t
        _poligono_rodado(x, y, [(z + 0.1, 0.035), (z + 0.3, 0.06), (z + 0.5, 0.04), (z + alto - 0.1, 0.035)], vol(x, y, MP.CANT[1]), obj(contorno=False), lados=8)


def _casarao():
    W, D = 24 * CASA, 12 * CASA
    # as alas (a de oeste e a de leste) e o corpo central recuado
    AW = 6 * CASA
    XA0, XA1 = 0.3, AW                           # a ala oeste
    XB0, XB1 = W - AW, W - 0.3                   # a ala leste
    Y0 = 0.3
    YA = D - 0.5                                 # a frente das alas
    YC = D - 2.3                                 # a frente do corpo central (recuado: a varanda na frente dele)
    ZS, ZE, ZR = 3.1, 6.3, 8.5
    ZEA = 6.0
    BC = (XA1, XB0, Y0, YC)
    BA = (XA0, XA1, Y0, YA)
    BB = (XB0, XB1, Y0, YA)
    _corpo_reboco(BC, ZE, seed=81)
    _corpo_reboco(BA, ZEA, seed=82)
    _corpo_reboco(BB, ZEA, seed=83)
    for B in (BA, BB):
        MP._cunhais(B[0], B[1], B[2], B[3], 0.45, ZEA - 0.2)
        MP._faixa(B[0], B[1], B[2], B[3], ZS, h=0.12, sai=0.05)
    MP._faixa(BC[0], BC[1], BC[2], BC[3], ZS, h=0.12, sai=0.05)
    XM = (XA1 + XB0) / 2
    # ---- a varanda: o piso de cantaria (0,6 m acima do chão), a escadaria, as quatro colunas e o terraço em cima
    ZV = 0.6
    caixa((XA1, XB0, YC, YA, 0.0, ZV), {'cima': MP.mat_marmore(seed=4), '*': MP.mat_cant(seed=5, alt=0.3, comp=0.6)})
    for k in range(4):
        zt = ZV * (4 - k) / 4
        caixa((XM - 1.6 - 0.1 * k, XM + 1.6 + 0.1 * k, YA, YA + 0.26 * (k + 1), 0.0, zt), {'cima': liso(MP.CANT[0]), '*': liso(MP.CANT[2])})
    xs_col = [XA1 + 0.45, XM - 1.7, XM + 1.7, XB0 - 0.45]
    for x in xs_col:
        CZ.c.cilindro(x, YA - 0.35, 0.16, ZV + 0.15, ZS - 0.2, MP.mat_coluna(x, YA - 0.35, 0.16), M, obj(), lados=14, tampa=False)
        caixa((x - 0.24, x + 0.24, YA - 0.59, YA - 0.11, ZV, ZV + 0.15), {'*': liso(MP.CANT[1]), 'cima': liso(MP.CANT[0])})
        caixa((x - 0.24, x + 0.24, YA - 0.59, YA - 0.11, ZS - 0.2, ZS - 0.05), {'*': liso(MP.CANT[1]), 'cima': liso(MP.CANT[0])})
    # o terraço (a laje com a cornija) e a balaustrada em cima, de ala a ala
    caixa((XA1, XB0, YC, YA, ZS - 0.05, ZS + 0.2), {'*': liso(MP.CANT[1]), 'cima': MP.mat_marmore(seed=6)})
    _balaustrada(XA1 + 0.05, XB0 - 0.05, YA - 0.14, YA - 0.02, ZS + 0.2)
    # a balaustrada baixa da varanda entre as colunas (aberta no meio, na escadaria)
    for (a0, a1) in ((xs_col[0] + 0.24, xs_col[1] - 0.24), (xs_col[2] + 0.24, xs_col[3] - 0.24)):
        _balaustrada(a0, a1, YA - 0.4, YA - 0.3, ZV, alto=0.7)
    # ---- a porta dupla e as janelas do corpo central (térreo: duas de cada lado da porta; em cima: as portas do terraço)
    MP._porta_dupla('+y', YC, XM, ZV, 1.5, 2.3, seed=3)
    for i, a in enumerate((XM - 3.0, XM - 1.6, XM + 1.6, XM + 3.0)):
        _jan('+y', YC, a, ZV + 0.4, h=1.6, acesa=(i in (1, 2)), seed=i, topo='frontao')
    for i, a in enumerate((XM - 3.0, XM - 1.0, XM + 1.0, XM + 3.0)):
        _jan('+y', YC, a, ZS + 0.25, w=0.8, h=2.1, acesa=(i == 2), seed=10 + i)
    # ---- as alas: duas janelas por andar na frente; nos lados e atrás, as de sempre
    for (B, sg) in ((BA, -1), (BB, 1)):
        xa = (B[0] + B[1]) / 2
        for i, a in enumerate((xa - 1.05, xa + 1.05)):
            _jan('+y', YA, a, 0.95, h=1.7, acesa=(i == (0 if sg < 0 else 1)), seed=20 + i, topo='frontao')
            _jan('+y', YA, a, ZS + 0.4, h=1.5, acesa=False, seed=24 + i)
        face, plano = ('-x', B[0]) if sg < 0 else ('+x', B[1])
        for i, a in enumerate(np.linspace(Y0 + 1.1, YA - 1.1, 4)):
            _jan(face, plano, a, 0.95, h=1.7, acesa=(i == 2), seed=30 + i)
            _jan(face, plano, a, ZS + 0.4, h=1.5, acesa=False, seed=34 + i)
        # o canto interno da ala com o central (a parede que vira para a varanda): uma janela por andar
        face_i, plano_i = ('+x', B[1]) if sg < 0 else ('-x', B[0])
        _jan(face_i, plano_i, (YC + YA) / 2, ZS + 0.4, w=0.7, h=1.3, acesa=False, seed=40)
    for i, a in enumerate(np.linspace(XA0 + 1.2, XB1 - 1.2, 9)):
        _jan('-y', Y0, a, 0.95, h=1.7, acesa=(i == 4), seed=50 + i)
        _jan('-y', Y0, a, ZS + 0.4, h=1.5, acesa=False, seed=60 + i)
    # ---- os telhados: o do central (quatro águas, a cumeeira em x) e os das alas (quatro águas, a cumeeira em y)
    SA.telhado4(BC, ZE, ZR, BEI=0.45, eixo='x', seed=84)
    SA.telhado4(BA, ZEA, ZEA + 2.0, BEI=0.45, eixo='y', seed=85)
    SA.telhado4(BB, ZEA, ZEA + 2.0, BEI=0.45, eixo='y', seed=86)
    MP._chamine(XA1 + 1.6, Y0 + 2.2, ZE - 0.2, ZR + 0.6, seed=7)
    MP._chamine(XB0 - 1.6, Y0 + 2.2, ZE - 0.2, ZR + 0.6, seed=8)
    # ---- os lampiões nos pedestais da escadaria e os vasos da varanda
    for x in (XM - 1.75, XM + 1.75):
        caixa((x - 0.18, x + 0.18, YA + 0.75, YA + 1.11, 0.0, 0.85), {'*': MP.mat_cant(seed=9, alt=0.3, comp=0.4), 'cima': liso(MP.CANT[0])})
        MP._lampiao(x, YA + 0.93, 0.85, alto=0.42)
    for x in (XA1 + 0.9, XB0 - 0.9):
        TD._vaso(x, YC + 0.4, ZV, r=0.2, h=0.4, flores=None, seed=int(x * 3))
    for x in (XM - 2.4, XM + 2.4):
        TD._vaso(x, YC + 0.35, ZV, r=0.16, h=0.32, flores=('#f2f0e8', '#f0c850'), seed=int(x * 5))
    pegada(XA0, XB1, Y0, YA)


# =====================================================================================================================
# o LABORATÓRIO (10 x 9 casas, 5,0 m): térreo de reboco, o telhado de quatro águas, a porta dupla com a pequena
# escadaria, as janelas altas (uma acesa), a chaminé do exaustor de metal
# =====================================================================================================================
def _laboratorio():
    W, D = 10 * CASA, 9 * CASA
    B = (0.3, W - 0.3, 0.3, D - 0.6)
    X0, X1, Y0, Y1 = B
    XM = (X0 + X1) / 2
    ZE, ZR = 3.5, 5.0
    _corpo_reboco(B, ZE, cor=REBOCO_ANEXO, seed=91)
    MP._cunhais(X0, X1, Y0, Y1, 0.45, ZE - 0.2)
    caixa((XM - 1.0, XM + 1.0, Y1, Y1 + 0.5, 0.0, 0.3), {'cima': liso(MP.CANT[0]), '*': liso(MP.CANT[2])})
    MP._porta_dupla('+y', Y1, XM, 0.3, 1.3, 2.2, seed=4)
    for i, a in enumerate((X0 + 1.1, X0 + 2.3, X1 - 2.3, X1 - 1.1)):
        _jan('+y', Y1, a, 1.0, w=0.8, h=1.7, acesa=(i == 3), seed=i)
    for face, plano in (('+x', X1), ('-x', X0), ('-y', Y0)):
        lo, hi = (Y0, Y1) if face[1] == 'x' else (X0, X1)
        for i, a in enumerate(np.linspace(lo + 1.0, hi - 1.0, 3)):
            _jan(face, plano, a, 1.0, w=0.8, h=1.7, acesa=(face == '+x' and i == 1), seed=10 + i)
    SA.telhado4(B, ZE, ZR, BEI=0.4, eixo='x', seed=92)
    # o duto do exaustor (metal) saindo pelo telhado, com o chapéu
    xd, yd = X1 - 1.4, Y0 + 1.2
    CZ.c.cilindro(xd, yd, 0.16, ZE + 0.6, ZR + 0.5, vol(xd, yd, '#9aa0a4', brilho=0.4), M, obj(), lados=12, tampa=False)
    _poligono_rodado(xd, yd, [(ZR + 0.5, 0.3), (ZR + 0.72, 0.04)], vol(xd, yd, '#7a8084'), obj(), lados=12)
    TD._vaso(XM - 1.4, Y1 + 0.25, 0.0, r=0.15, h=0.3, flores=None, seed=93)
    pegada(X0, X1, Y0, Y1)


# =====================================================================================================================
# o ALOJAMENTO DOS PESQUISADORES (12 x 7 casas, 7,0 m): dois andares de reboco, as portas dos quartos embaixo, as
# janelas em cima, o beiral largo
# =====================================================================================================================
def _alojamento():
    W, D = 12 * CASA, 7 * CASA
    B = (0.3, W - 0.3, 0.3, D - 0.5)
    X0, X1, Y0, Y1 = B
    ZS, ZE, ZR = 2.9, 5.6, 7.0
    _corpo_reboco(B, ZE, seed=101)
    MP._cunhais(X0, X1, Y0, Y1, 0.45, ZE - 0.2)
    MP._faixa(X0, X1, Y0, Y1, ZS, h=0.1, sai=0.04)
    xs = np.linspace(X0 + 1.0, X1 - 1.0, 6)
    for i, a in enumerate(xs):
        if i in (1, 4):
            SA.porta_frisada(B, '+y', a, 0.05, 0.85, 2.1, '#5a3a24')
            SA.arandela('+y', Y1, a + 0.6, 2.0)
        else:
            _jan('+y', Y1, a, 0.95, w=0.75, h=1.5, acesa=(i == 2), seed=i)
        _jan('+y', Y1, a, ZS + 0.4, w=0.75, h=1.4, acesa=(i == 5), seed=10 + i)
    for face, plano in (('+x', X1), ('-x', X0)):
        for k, a in enumerate((Y0 + 1.3, Y1 - 1.3)):
            _jan(face, plano, a, 0.95, w=0.75, h=1.5, acesa=False, seed=20 + k)
            _jan(face, plano, a, ZS + 0.4, w=0.75, h=1.4, acesa=(face == '-x' and k == 0), seed=24 + k)
    for i, a in enumerate(xs):
        _jan('-y', Y0, a, ZS + 0.4, w=0.75, h=1.4, acesa=False, seed=30 + i)
    SA.telhado4(B, ZE, ZR, BEI=0.5, eixo='x', seed=102)
    pegada(X0, X1, Y0, Y1)


# =====================================================================================================================
# a OFICINA / MANUTENÇÃO (12 x 6 casas, 4,6 m): o galpãozinho de reboco, o portão de enrolar de aço, a porta lateral,
# as janelinhas altas, as ferramentas e os galões encostados na frente
# =====================================================================================================================
def _oficina():
    W, D = 12 * CASA, 6 * CASA
    B = (0.3, W - 0.3, 0.3, D - 0.5)
    X0, X1, Y0, Y1 = B
    ZE, ZR = 3.4, 4.6
    _corpo_reboco(B, ZE, cor='#d4c8ae', seed=111)
    # o portão de enrolar: as lâminas horizontais de aço, a guia dos lados e a caixa em cima
    ga, gb = X0 + 1.0, X0 + 4.2

    def lam(L, n, P):
        z = P[:, 2]
        out = np.tile(hx('#8a9094'), (len(P), 1))
        out = np.where((((z + 50) / 0.1) % 1 < 0.25)[:, None], hx('#6a7074'), out)
        out = np.where((z < 0.25)[:, None], hx('#5a5e60'), out)
        return out
    caixa(_bx('+y', Y1, ga, gb, -0.02, 0.03, 0.0, 2.6), {'*': emissivo(lam)})
    caixa(_bx('+y', Y1, ga - 0.1, gb + 0.1, 0.0, 0.14, 2.6, 2.95), {'*': liso('#7a8084'), 'cima': liso('#9aa0a4')})
    for a in (ga - 0.06, gb + 0.06):
        caixa(_bx('+y', Y1, a - 0.04, a + 0.04, 0.0, 0.06, 0.0, 2.6), liso('#5a5e60'))
    SA.porta_frisada(B, '+y', X1 - 1.6, 0.05, 0.85, 2.1, '#4a4a46')
    SA.arandela('+y', Y1, X1 - 1.0, 2.0)
    for a in (X1 - 3.3, X1 - 2.6):
        _jan('+y', Y1, a, 1.9, w=0.5, h=0.6, acesa=False, seed=int(a * 10))
    for face, plano in (('+x', X1), ('-x', X0)):
        _jan(face, plano, (Y0 + Y1) / 2, 1.9, w=0.6, h=0.6, acesa=False, seed=5)
    SA.telhado4(B, ZE, ZR, BEI=0.4, eixo='x', seed=112)
    # na frente: os galões, o carrinho de mão e a pilha de tábuas
    for k, x in enumerate((X1 - 0.5, X1 - 0.75)):
        CZ.c.cilindro(x, Y1 + 0.3, 0.13, 0.0, 0.42, vol(x, Y1 + 0.3, ['#2f5a8a', '#8a3a2a'][k], brilho=0.3), M, obj(), lados=12, tampa=True, tampa_mat=liso('#3a3a3a'))
    for k in range(4):
        caixa((X0 + 0.2, X0 + 0.85, Y1 + 0.1 + 0.07 * k, Y1 + 0.16 + 0.07 * k, 0.0 + 0.04 * k, 0.04 + 0.04 * k), mad2('#9a7a4a', seed=k), contorno=k == 3)
    pegada(X0, X1, Y0, Y1)


# =====================================================================================================================
# a INSTALAÇÃO DE CONTENÇÃO (12 x 9 casas, 4,4 m): o bloco de concreto aparente sem janela, a laje plana com a mureta,
# a porta de aço pesada com o recuo e a luz vermelha em cima, as máquinas do ar no teto, a câmera e as grelhas
# =====================================================================================================================
def _contencao():
    W, D = 12 * CASA, 9 * CASA
    B = (0.3, W - 0.3, 0.3, D - 0.5)
    X0, X1, Y0, Y1 = B
    XM = (X0 + X1) / 2
    ZE, ZP = 3.7, 4.05
    con = FF.mat_juntas(CONCRETO, lambda P: (np.floor((P[:, 2] + 50) / 1.2).astype(np.int64) * 1000
                        + np.floor((P[:, 0] + P[:, 1] + 50) / 2.4).astype(np.int64)), '#5e5e5a', seed=12)
    caixa((X0, X1, Y0, Y1, 0.0, ZE), con)
    SA.platibanda(B, ZE, ZP, con, rufo='#a8a8a2')
    caixa((X0 + 0.14, X1 - 0.14, Y0 + 0.14, Y1 - 0.14, ZE - 0.02, ZE + 0.02), liso('#6a6a66'), contorno=False)
    # a porta: o recuo no concreto, a folha de aço com os rebites e a barra, a luz vermelha
    caixa(_bx('+y', Y1, XM - 0.9, XM + 0.9, 0.0, 0.25, 0.0, 2.6), {'*': con, 'cima': liso(CONCRETO[0])})

    def aco(L, n, P):
        out = np.tile(hx('#5a6066'), (len(P), 1))
        rb = (((P[:, 0] + 50) / 0.2) % 1 < 0.2) & (((P[:, 2] + 50) / 0.3) % 1 < 0.12)
        out = np.where(rb[:, None], hx('#8a9096'), out)
        out = np.where((np.abs(P[:, 2] - 1.05) < 0.04)[:, None], hx('#3a3e42'), out)
        return out
    caixa(_bx('+y', Y1, XM - 0.6, XM + 0.6, 0.25, 0.29, 0.0, 2.2), {'*': emissivo(aco)})
    caixa(_bx('+y', Y1, XM + 0.3, XM + 0.42, 0.29, 0.35, 1.0, 1.4), liso('#c8ccd0'), contorno=False)
    ov = obj(contorno=False)
    CZ.luzes.add(ov)
    CZ.c.caixa(_bx('+y', Y1, XM - 0.08, XM + 0.08, 0.25, 0.37, 2.35, 2.5), liso('#ff3a2a'), M, ov)
    # o teclado ao lado da porta, as grelhas de ventilação embaixo, a câmera no canto
    caixa(_bx('+y', Y1, XM + 1.05, XM + 1.25, 0.0, 0.05, 1.2, 1.5), liso('#2a2e32'))
    for a in (X0 + 1.2, X1 - 1.2):
        caixa(_bx('+y', Y1, a - 0.35, a + 0.35, 0.0, 0.03, 0.2, 0.5), {'*': emissivo(lambda L, n, P: np.where(((((P[:, 2] + 50) / 0.06) % 1) < 0.4)[:, None], hx('#3a3a38'), hx('#7a7a76')))})
    caixa((X1 - 0.25, X1 - 0.05, Y1 - 0.05, Y1 + 0.2, ZE - 0.5, ZE - 0.35), liso('#e8e8e4'))
    caixa((X1 - 0.22, X1 - 0.08, Y1 + 0.2, Y1 + 0.28, ZE - 0.48, ZE - 0.38), liso('#1a1a1a'), contorno=False)
    # as máquinas do ar no teto (com o ventilador redondo) e a antena
    for (x0, y0) in ((X0 + 1.0, Y0 + 1.0), (X0 + 2.6, Y0 + 1.0)):
        caixa((x0, x0 + 1.2, y0, y0 + 0.9, ZE, ZE + 0.7), {'*': liso('#b8bcbe'), 'cima': liso('#cdd0d2')})
        _disco(x0 + 0.6, y0 + 0.45, ZE + 0.705, 0.32, emissivo(lambda L, n, P: np.where(((np.floor((P[:, 0] + P[:, 1]) / 0.05)) % 2 == 0)[:, None], hx('#3a3e40'), hx('#6a6e70'))), obj(contorno=False), lados=16)
    CZ.c.cilindro(X1 - 1.0, Y0 + 1.0, 0.03, ZE, ZE + 1.6, liso('#5a5e60'), M, obj(), lados=8, tampa=True)
    pegada(X0, X1, Y0, Y1)


# =====================================================================================================================
# as peças do jardim
# =====================================================================================================================
def _gazebo():
    """O gazebo (4 x 4 casas, 3,6 m): o piso octogonal de pedra, as oito colunas brancas, a mureta, a cúpula de cobre."""
    cx, cy = 1.5, 1.5
    R = 1.3
    _poligono_rodado(cx, cy, [(0.0, R + 0.12), (0.22, R + 0.12)], vol(cx, cy, '#b8b0a0'), obj(), lados=8, tampa_mat=MP.mat_marmore(seed=3, lado=0.6))
    ang = [2 * math.pi * (i + 0.5) / 8 for i in range(8)]
    pts = [(cx + R * math.cos(a), cy + R * math.sin(a)) for a in ang]
    for (x, y) in pts:
        CZ.c.cilindro(x, y, 0.07, 0.22, 2.45, vol(x, y, '#efe8da'), M, obj(), lados=10, tampa=False)
    # a mureta baixa entre as colunas (aberta na frente, a entrada)
    for i in range(8):
        (xa, ya), (xb, yb) = pts[i], pts[(i + 1) % 8]
        if ya > cy + 0.5 and yb > cy + 0.5:
            continue
        FF._viga(obj(), (xa, ya, 0.75), (xb, yb, 0.75), 0.07, liso('#efe8da'))
        FF._viga(obj(), (xa, ya, 0.3), (xb, yb, 0.3), 0.05, liso('#e2dbcc'))
    # o friso e a cúpula (cobre esverdeado), o pináculo dourado
    _poligono_rodado(cx, cy, [(2.45, R + 0.1), (2.62, R + 0.1)], vol(cx, cy, '#efe8da'), obj(), lados=8)
    _poligono_rodado(cx, cy, [(2.62, R + 0.32), (2.8, R + 0.05), (3.05, R * 0.72), (3.28, R * 0.38), (3.42, 0.06)], vol(cx, cy, '#5a8a78', brilho=0.25), obj(), lados=8)
    CZ.c.cilindro(cx, cy, 0.025, 3.42, 3.62, liso('#c8a050'), M, obj(), lados=6, tampa=True)
    FF.pegada_redonda(cx, cy, R + 0.12)


def _pergolado():
    """O pergolado da área de convivência (8 x 5 casas, 2,8 m): os seis pilares de madeira, as vigas, os caibros e a
    trepadeira em tufos por cima (dá para andar embaixo)."""
    W, D = 8 * CASA, 5 * CASA
    x0, x1, y0, y1 = 0.3, W - 0.3, 0.3, D - 0.3
    h = 2.6
    mp = {'*': mad2('#6a4a30', eixo=2, seed=3, passo=0.05), 'cima': liso('#7a5a3a')}
    for x in (x0, (x0 + x1) / 2, x1 - 0.14):
        for y in (y0, y1 - 0.14):
            caixa((x, x + 0.14, y, y + 0.14, 0.0, h), mp)
    for y in (y0, y1 - 0.14):
        caixa((x0 - 0.2, x1 + 0.2, y - 0.02, y + 0.16, h, h + 0.18), {'*': mad2('#5e4028', seed=4, passo=0.06), 'cima': liso('#7a5a3a')})
    for x in np.arange(x0 - 0.1, x1 + 0.2, 0.42):
        caixa((x, x + 0.07, y0 - 0.25, y1 + 0.25, h + 0.18, h + 0.3), {'*': liso('#5a3e26'), 'cima': liso('#7e5e3e')})
    rng = np.random.default_rng(7)
    for k, (cx, cy) in enumerate(((x0 + 0.8, y0 + 0.6), (x0 + 2.4, y1 - 0.7), (x1 - 1.2, y0 + 0.9), (x1 - 0.6, y1 - 0.5), ((x0 + x1) / 2, (y0 + y1) / 2))):
        m = FF.mat_folha((cx, cy, h + 0.4), (0.9, 0.9, 0.3), FF.FOLHA_PAL, q=0.08, seed=20 + k, flores=('#c86ab8', '#f0d0e8') if k % 2 == 0 else None)
        FF._cachos(obj(), cx, cy, h + 0.38, 0.75, 0.22, 10, 0.15, 0.28, rng, m, corte=h + 0.25)
    # a trepadeira descendo por dois pilares
    for (x, y) in ((x0 + 0.07, y1 - 0.07), (x1 - 0.07, y0 + 0.07)):
        m = FF.mat_folha((x, y, 1.3), (0.25, 0.25, 1.3), FF.FOLHA_PAL, q=0.06, seed=int(x * 10))
        FF._cachos(obj(), x, y, 1.4, 0.22, 1.2, 8, 0.08, 0.14, rng, m, corte=0.05)


def _canteiro_elevado():
    """O canteiro elevado de madeira (4 x 1 casas, 0,7 m): a caixa de tábuas, a terra escura e as fileiras de verdura."""
    x0, x1, y0, y1 = 0.08, 4 * CASA - 0.08, 0.1, CASA - 0.1
    z = 0.48
    caixa((x0, x1, y0, y1, 0.0, z), {'*': tab2(['#7a5634', '#6e4c2e', '#84603c'], 0.12, '#3a2414', eixo=2, seed=5), 'cima': liso('#8a6a44')})
    CZ.c.caixa((x0 + 0.06, x1 - 0.06, y0 + 0.06, y1 - 0.06, z - 0.03, z + 0.004), FF.mat_terra(seed=5), M, obj(contorno=False))
    rng = np.random.default_rng(3)
    for i, x in enumerate(np.linspace(x0 + 0.22, x1 - 0.22, 9)):
        for j, y in enumerate((y0 + 0.16, y1 - 0.16)):
            pal = FF.FOLHA_PAL_B if (i + j) % 2 else FF.FOLHA_PAL
            m = FF.mat_folha((x, y, z + 0.1), (0.14, 0.14, 0.12), pal, q=0.05, seed=i * 3 + j)
            FF._cachos(obj(), x, y, z + 0.08, 0.12, 0.1, 5, 0.04, 0.07, rng, m, corte=z)
    pegada(x0, x1, y0, y1)


def _composteira():
    """A composteira (3 x 1 casas, 1,0 m): as três baias de ripas de madeira e o composto escuro dentro."""
    x0, x1, y0, y1 = 0.06, 3 * CASA - 0.06, 0.08, CASA - 0.08
    h = 0.95
    w = (x1 - x0) / 3

    def ripas(L, n, P):
        z = P[:, 2]
        out = np.tile(hx('#8a6a42'), (len(P), 1))
        fresta = ((z + 50) / 0.16) % 1 < 0.22
        return np.where(fresta[:, None], hx('#2a1c10'), out)
    for k in range(3):
        a0, a1 = x0 + w * k, x0 + w * (k + 1)
        caixa((a0, a1, y0, y1, 0.0, h * (0.7 if k == 2 else 1.0)), {'*': emissivo(ripas), 'cima': liso('#9a7a52')})
        nivel = (0.75, 0.55, 0.35)[k]
        CZ.c.caixa((a0 + 0.05, a1 - 0.05, y0 + 0.05, y1 - 0.05, nivel - 0.02, nivel), FF.mat_terra(seed=10 + k), M, obj(contorno=False))
    pegada(x0, x1, y0, y1)


def _buxo():
    """O buxinho podado (1 x 1, 0,55 m): o bloco de folhinhas miúdas com a quina arredondada e a sombra embaixo."""
    x0, x1, y0, y1 = 0.04, CASA - 0.04, 0.04, CASA - 0.04
    h = 0.55

    def folha(L, n, P):
        q = suave(P[:, 0] * 5 + P[:, 2] * 3, P[:, 1] * 5 + P[:, 2] * 2, 0.25, 13)
        out = np.where((q > 0.62)[:, None], hx('#4e7e3a'), np.where((q < 0.3)[:, None], hx('#2a4c24'), hx('#3a6430')))
        n = np.asarray(n, float)
        if n[2] > 0.5:
            out = np.where((q > 0.5)[:, None], hx('#5e8e44'), hx('#467434'))
        return out
    caixa((x0, x1, y0, y1, 0.0, h), {'*': emissivo(folha)})
    pegada(x0, x1, y0, y1)


ITENS = {
    'casarao_fritz': (24, 12, (0.0, 0.0), _casarao, {}),
    'estufa_principal': (10, 12, (0.0, 0.0), _estufa_principal, {}),
    'estufa_auxiliar': (7, 10, (0.0, 0.0), _estufa_auxiliar, {}),
    'laboratorio_fritz': (10, 9, (0.0, 0.0), _laboratorio, {}),
    'alojamento_fritz': (12, 7, (0.0, 0.0), _alojamento, {}),
    'oficina_fritz': (12, 6, (0.0, 0.0), _oficina, {}),
    'contencao_fritz': (12, 9, (0.0, 0.0), _contencao, {}),
    'gazebo_jardim': (4, 4, (0.0, 0.0), _gazebo, {}),
    'pergolado': (8, 5, (0.0, 0.0), _pergolado, {}),
    'canteiro_elevado': (4, 1, (0.0, 0.0), _canteiro_elevado, {}),
    'composteira': (3, 1, (0.0, 0.0), _composteira, {}),
    'buxo': (1, 1, (0.0, 0.0), _buxo, {}),
}
