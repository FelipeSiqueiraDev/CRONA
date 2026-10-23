"""
GRUPO B2 da MANSÃO ALBUQUERQUE, "conforto" (21/10): o quarto do casal, o banheiro, o closet, a adega, a poltrona de
orelha, o carrinho de bar e os quadros, o espelho e a janela de parede. Pixel art 1:1 só por código, no estilo da
cozinha da fazenda (e dos módulos casa.py e escritorio.py, de onde reaproveita o estofado, as portas que giram, a
bacia esmaltada, as pernas torneadas e os materiais).

A paleta da casa: nogueira e mogno escuros, mármore creme, ouro discreto (latão e dourado), veludo vinho, verde-garrafa,
cristal (branco-gelo), marfim, couro caramelo. Riqueza sóbria de dinheiro velho.

Tudo no giro 4 (a frente para +y), a pegada começando em (0, 0), no tamanho do catálogo (largura x fundo em casas, a
altura em METROS; nenhuma peça tem `aumento`).
"""
import math

import numpy as np

import cozinha as CZ
import base_estilo as BE
import casa as CA
import escritorio as ES
import parede_casa as PC
from base_estilo import (hx, liso, mad2, tab2, vol, _tom, _pau, _barra, _p1_malha, _p1_mat_rampa, _p1_rampa,
                         _poligono_rodado, _disco, PH, PZ)
from motor import emissivo, ruido, suave, KX, KY, KZ

M = BE.M
CASA = 0.75
UN = 1.633


def C():
    return CZ.c


def novo(contorno=True, sombra=True):
    return C().novo_obj(3, contorno=contorno, sombra=sombra)


def cx(b, mat, ch=0.0, oid=None, contorno=True):
    o = novo(contorno) if oid is None else oid
    C().caixa(b, mat, M, o, ch=ch)
    return o


def peg(x0, x1, y0, y1):
    CZ.pegadas.append((x0, x1, y0, y1))


def peq(x0, x1, y0, y1, z):
    CZ.itens_peq.append((x0, x1, y0, y1, z))


def fp(pts, n, mat, oid, dois=False):
    C().face_plana(pts, n, mat, M, oid, dois_lados=dois)


def hexn(v):
    v = np.clip(np.round(np.asarray(v, float)), 0, 255).astype(int)
    return '#%02x%02x%02x' % tuple(v)


# ---------------------------------------------------------------------------------------------------------------------
# a paleta: madeiras, ouro, veludos, couro, mármore
# ---------------------------------------------------------------------------------------------------------------------
NOZ = '#4a2a16'            # a nogueira escura do corpo
NOZ_E = '#2e1a0e'          # a mais escura (o rodapé, o vão)
NOZ_T = ['#5a3420', '#563020', '#5e381e']          # o tampo/tábua de nogueira
NOZ_L = '#6e4228'          # a nogueira clara (as molduras)
CARV = '#b8905c'           # o carvalho claro (o closet)
CARV_T = ['#c49a64', '#bc925c', '#c8a06c']
OURO, OURO_L, OURO_E = '#b8902a', '#e8c860', '#7a5a1a'

_VERDE = _p1_rampa(['#08150e', '#0e2016', '#142c1e', '#1b3a28', '#234a33', '#2c5a3e', '#366b4a', '#417d58', '#4f9068', '#62a47a'])
_CARAMELO = _p1_rampa(['#34190a', '#4a2810', '#613616', '#79451c', '#8f5624', '#a5682d', '#b97c38', '#cb9248', '#dba85c', '#e9be78'])
_CHAMP = _p1_rampa(['#5e5038', '#74634a', '#8a7759', '#a08c6a', '#b49f7c', '#c5b08c', '#d4c19f', '#e0cfb0', '#ebdcc2', '#f6ead4'])
_MARFIM = _p1_rampa(['#6e6656', '#867e6c', '#9e9682', '#b4ad98', '#c8c1ac', '#d8d2be', '#e6e0cf', '#f0ebdc', '#f8f4e8', '#fffcf2'])
_VINHO = ES._VINHO
_OUROR = _p1_rampa(['#3e2a10', '#5e4216', '#7e5a1c', '#9a7424', '#b48e30', '#cca644', '#e0c05c', '#efd47c', '#f8e49c', '#fff2c4'])
_LOUCA = CA._LOUCA


def ouro(b=None, topo=None):
    """A peça dourada chapada (a moldura, a alça): o ouro com a fileira de cima clara."""
    return ES.metal(OURO, b, topo or OURO_L, quina=1.22, baixo=0.62)


def ouro_vol(x, y, brilho=0.7):
    return vol(x, y, OURO, brilho=brilho)


# ---------------------------------------------------------------------------------------------------------------------
# o que sobe numa fatia (x, z) e se estende em y: o perfil convexo (o encosto curvo, o arco do espelho)
# ---------------------------------------------------------------------------------------------------------------------
def extruda_xz(perfil, y0, y1, mats, o=None):
    """
    Um prisma deitado: o perfil (x, z), convexo e anti-horário, estendido de y0 a y1. mats: 'frente' (a face de +y),
    'costas', 'cima' (as bordas que olham para cima) e 'lado' (as outras). Cada borda leva a sua normal (a luz escorrega
    na curva).
    """
    o = novo() if o is None else o
    k = len(perfil)
    m = lambda nome, alt='lado': mats.get(nome) or mats.get(alt) or mats.get('*')
    fp([(x, y1, z) for (x, z) in perfil], (0, 1, 0), m('frente'), o)
    fp([(x, y0, z) for (x, z) in perfil[::-1]], (0, -1, 0), m('costas'), o)
    for i in range(k):
        (xa, za), (xb, zb) = perfil[i], perfil[(i + 1) % k]
        dx, dz = xb - xa, zb - za
        ln = math.hypot(dx, dz) or 1.0
        nx, nz = dz / ln, -dx / ln
        if abs(nx) < 1e-6 and abs(nz) < 1e-6:
            continue
        mt = m('cima') if nz > 0.35 else m('lado')
        fp([(xa, y0, za), (xb, y0, zb), (xb, y1, zb), (xa, y1, za)], (nx, 0, nz), mt, o)
    return o


def arco_perfil(x0, x1, z0, zc, zt, n=12):
    """O perfil de um retângulo com o topo em arco (de zc até zt no meio), convexo, anti-horário."""
    pts = [(x0, z0), (x1, z0), (x1, zc)]
    xm, rx = (x0 + x1) / 2, (x1 - x0) / 2
    for i in range(1, n):
        a = math.pi * i / n
        pts.append((xm + rx * math.cos(a), zc + (zt - zc) * math.sin(a)))
    pts.append((x0, zc))
    return pts


def oval_perfil(xc, zc, rx, rz, n=24):
    return [(xc + rx * math.cos(2 * math.pi * i / n), zc + rz * math.sin(2 * math.pi * i / n)) for i in range(n)]


# ---------------------------------------------------------------------------------------------------------------------
# o espelho (o vidro prateado com o reflexo em diagonal e a prata gasta), numa face em pé voltada para +y
# ---------------------------------------------------------------------------------------------------------------------
def vidro_espelho(x0, x1, z0, z1, tom='#a6c0c4', seed=0):
    """O espelho do móvel (a face da frente): azulado, com duas faixas de reflexo em diagonal e o escuro embaixo à direita."""
    c0 = hx(tom)

    def f(L, n, P):
        a = (P[:, 0] - x0) / PH
        b = (z1 - P[:, 2]) / PZ
        out = np.tile(c0, (len(P), 1))
        d = a * 0.8 + b * 0.8
        # a faixa larga clara e a fina, em diagonal (a mesma direção em todos os espelhos)
        w0 = (x1 - x0) / PH * 0.5
        out = np.where(((d > w0 * 0.55) & (d < w0 * 0.55 + 7))[:, None], _tom(c0, 1.14), out)
        out = np.where(((d > w0 * 0.55 + 10) & (d < w0 * 0.55 + 12))[:, None], _tom(c0, 1.2), out)
        out = np.where((d > (x1 - x0) / PH * 1.15 + (z1 - z0) / PZ * 0.1)[:, None], _tom(c0, 0.9), out)
        # o escurecimento da beira (a sombra da moldura)
        out = np.where(((a < 1.5) | (b < 1.5))[:, None], _tom(c0, 0.84), out)
        return out
    return emissivo(f)


# =====================================================================================================================
# a poltrona de orelha (1 x 1, o assento a 0,5 m): couro caramelo capitonê, tachas de latão
# =====================================================================================================================
def poltrona_orelha():
    """
    A poltrona de orelha (wingback; o assento a 0,5 m): o encosto alto capitonê com as duas orelhas que avançam dos lados,
    os braços em rolo, a almofada do assento com a costura, a fileira de tachas de latão no corpo e os pés torneados.
    """
    x0, x1 = 0.03, 0.72
    y0, y1 = 0.04, 0.73
    zs = 0.5
    zt = 1.16
    br = 0.15
    # os pés torneados (curtos, de nogueira escura)
    for (a, b_) in ((x0 + 0.07, y0 + 0.06), (x1 - 0.07, y0 + 0.06), (x0 + 0.07, y1 - 0.07), (x1 - 0.07, y1 - 0.07)):
        CA.perna_torneada(a, b_, 0.0, 0.11, 0.03, '#34190c')
    # o corpo de baixo (a saia com as tachas)
    b = (x0 + 0.03, x1 - 0.03, y0 + 0.05, y1 - 0.02, 0.09, zs - 0.1)
    ES.malha(b, (0.03, 0.03, 0.02, 0.03), ES.estofado(_CARAMELO, b, 1.4, 4.8, cupula=0, grad=0.8, tachas=(0.2, 3)), seg=2)
    # o encosto: a estrutura alta de trás com o topo em curva
    b = (x0 + 0.04, x1 - 0.04, y0, y0 + 0.2, zs - 0.15, zt)
    ES.malha(b, (0.09, 0.07, 0.02, 0.16), ES.estofado(_CARAMELO, b, 2.0, 6.2, cupula=0.4, grad=0.5), seg=3)
    # as orelhas: as abas laterais que avançam do encosto, mais altas que os braços
    for (a0, a1) in ((x0, x0 + 0.15), (x1 - 0.15, x1)):
        b = (a0 + 0.005, a1 - 0.005, y0 + 0.01, y0 + 0.4, zs + 0.2, zt - 0.1)
        ES.malha(b, (0.06, 0.12, 0.05, 0.13), ES.estofado(_CARAMELO, b, 2.0, 6.6, cupula=0.5, grad=0.4, tachas=(zs + 0.32, 3)), seg=3)
    # a almofada do encosto (capitonê, com os botões fundos)
    b = (x0 + br + 0.005, x1 - br - 0.005, y0 + 0.17, y0 + 0.31, zs + 0.02, zt - 0.1)
    ES.malha(b, (0.05, 0.05, 0.04, 0.1), ES.estofado(_CARAMELO, b, 2.4, 7.8, cupula=0.5, capi=(0.17, 0.15), grad=0.5), seg=2)
    # a almofada do assento (a frente passa um pouco do corpo)
    b = (x0 + br - 0.005, x1 - br + 0.005, y0 + 0.28, y1, zs - 0.15, zs)
    ES.malha(b, (0.06, 0.06, 0.035, 0.07), ES.estofado(_CARAMELO, b, 2.2, 7.8, cupula=1.2, brilho=True, grad=1.0), seg=2)
    # os braços: o painel e o rolo em cima, saindo para os lados
    for (a0, a1) in ((x0, x0 + br), (x1 - br, x1)):
        b = (a0 + 0.02, a1 - 0.02, y0 + 0.2, y1 - 0.02, 0.09, zs + 0.07)
        ES.malha(b, (0.04, 0.05, 0.02, 0.03), ES.estofado(_CARAMELO, b, 1.8, 5.8, cupula=0, grad=1.0, tachas=(zs - 0.06, 3)), seg=2)
        b = (a0 - 0.005, a1 + 0.005, y0 + 0.18, y1, zs + 0.05, zs + 0.25)
        ES.malha(b, (0.07, 0.07, 0.08, 0.1), ES.estofado(_CARAMELO, b, 2.4, 7.8, cupula=0.9, brilho=True), seg=2)
    peg(x0, x1, y0, y1)


# =====================================================================================================================
# o carrinho de bar (1 x 1, 0,95 m): dourado e vidro, decanters, copos de cristal, duas rodas grandes
# =====================================================================================================================
def _decanter(x, y, z, h=0.24, r=0.05, cor='#9a5a28', rolha=True):
    """O decanter de cristal: o corpo largo facetado, o pescoço longo, a rolha dourada; o líquido âmbar até a metade."""
    def faixa(P, base):
        zz = P[:, 2] - z
        base = np.where((zz < h * 0.5)[:, None], hx(cor), base)
        return np.where(((zz > h * 0.18) & (zz < h * 0.24))[:, None], _tom(base, 1.25), base)
    o = novo()
    _poligono_rodado(x, y, [(z, r * 0.9), (z + h * 0.1, r), (z + h * 0.42, r), (z + h * 0.58, r * 0.4), (z + h * 0.8, r * 0.26), (z + h * 0.88, r * 0.38)],
                     vol(x, y, '#dcecec', brilho=0.8, faixas=faixa), o, lados=12)
    if rolha:
        o2 = novo()
        _poligono_rodado(x, y, [(z + h * 0.86, r * 0.3), (z + h * 0.92, r * 0.46), (z + h * 1.0, r * 0.4), (z + h * 1.08, r * 0.1)],
                         vol(x, y, OURO, brilho=0.7), o2, lados=10)
    peq(x - r, x + r, y - r, y + r, z)


def _copo_cristal(x, y, z, h=0.1, r=0.026, vinho=False):
    """O copo de cristal (cálice ou tulipa): a haste fina e o bojo branco-gelo com um ponto de brilho."""
    o = novo()
    if vinho:
        perfil = [(z, r * 0.9), (z + 0.006, r * 0.9), (z + 0.01, r * 0.2), (z + h * 0.42, r * 0.16), (z + h * 0.5, r * 0.8),
                  (z + h * 0.7, r * 1.1), (z + h * 0.97, r * 0.95)]
    else:
        perfil = [(z, r * 0.9), (z + h * 0.1, r), (z + h * 0.9, r * 1.18), (z + h, r * 1.2)]
    _poligono_rodado(x, y, perfil, vol(x, y, '#cfe4e6', brilho=0.9), o, lados=10)
    peq(x - r, x + r, y - r, y + r, z)


def _garrafa_bar(x, y, z, h=0.3, r=0.034, cor='#1c3a24', rotulo='#d8c890'):
    def faixa(P, base):
        zz = P[:, 2] - z
        base = np.where(((zz > h * 0.2) & (zz < h * 0.42))[:, None], hx(rotulo), base)
        return np.where((zz > h * 0.9)[:, None], hx(OURO), base)
    o = novo()
    _poligono_rodado(x, y, [(z, r * 0.95), (z + 0.01, r), (z + h * 0.5, r), (z + h * 0.62, r * 0.55), (z + h * 0.7, r * 0.4), (z + h * 0.93, r * 0.38), (z + h, r * 0.42)],
                     vol(x, y, cor, brilho=0.7, faixas=faixa), o, lados=10)
    peq(x - r, x + r, y - r, y + r, z)


def carrinho_bar():
    """
    O carrinho de bar dourado (0,95 m no tampo): quatro colunas de latão, duas bandejas de espelho fumê com a borda
    dourada e o corrimão, a alça curva num dos lados, duas rodas grandes de latão com o raio, decanters e copos de cristal.
    """
    x0, x1 = 0.08, 0.67
    y0, y1 = 0.14, 0.62
    zt = 0.95
    zb = 0.3
    zr = 0.1          # a altura do eixo das rodas
    # os pés e as colunas (latão torneado)
    for (a, b_) in ((x0 + 0.02, y0 + 0.02), (x1 - 0.02, y0 + 0.02), (x0 + 0.02, y1 - 0.02), (x1 - 0.02, y1 - 0.02)):
        o = novo()
        _poligono_rodado(a, b_, [(0.05, 0.016), (zt, 0.016)], vol(a, b_, OURO, brilho=0.8), o, lados=10, tampa_mat=liso(OURO_L))
    # as bandejas: o espelho fumê com a borda de ouro e o corrimão de fio
    ESP = emissivo(lambda L, n, P: np.where(((np.floor(P[:, 0] / PH) + np.floor(P[:, 1] / PH)) % 18 < 2)[:, None] & (n[2] > 0.5),
                                            hx('#e0f2f2'), hx('#94b8bc')) if n[2] > 0.5 else np.tile(hx(OURO), (len(P), 1)))
    for z in (zb, zt - 0.03):
        cx((x0 - 0.02, x1 + 0.02, y0 - 0.02, y1 + 0.02, z, z + 0.03), {'cima': ESP, '*': ouro((0, 0, 0, 0, z, z + 0.03))})
        cx((x0 - 0.02, x1 + 0.02, y0 - 0.02, y0, z + 0.03, z + 0.06), ouro((0, 0, 0, 0, z + 0.03, z + 0.06)))
        cx((x0 - 0.02, x0, y0, y1 + 0.02, z + 0.03, z + 0.06), ouro((0, 0, 0, 0, z + 0.03, z + 0.06)))
        cx((x1, x1 + 0.02, y0, y1 + 0.02, z + 0.03, z + 0.06), ouro((0, 0, 0, 0, z + 0.03, z + 0.06)))
        cx((x0 - 0.02, x1 + 0.02, y1, y1 + 0.02, z + 0.03, z + 0.06), ouro((0, 0, 0, 0, z + 0.03, z + 0.06)))
    # a alça: o arco de latão no lado esquerdo (dois montantes e a barra de cima, mais alta)
    for b_ in (y0 + 0.05, y1 - 0.05):
        cx((x0 - 0.035, x0 - 0.02, b_ - 0.008, b_ + 0.008, zt - 0.02, zt + 0.2), ouro((0, 0, 0, 0, zt - 0.02, zt + 0.2)))
    cx((x0 - 0.04, x0 - 0.016, y0 + 0.05 - 0.008, y1 - 0.05 + 0.008, zt + 0.2, zt + 0.225), ouro((0, 0, 0, 0, zt + 0.2, zt + 0.225)))
    # as rodas: duas grandes de latão (nos lados de y), o raio em fio
    for yy in (y0 - 0.005, y1 + 0.005):
        _roda_y(x0 + 0.14, yy, 0.075, 0.075, 1 if yy > 0.4 else -1)
        _roda_y(x1 - 0.17, yy, zr + 0.01, 0.12, 1 if yy > 0.4 else -1)
    # o que está em cima: o decanter grande, o médio, a garrafa e três copos (e na prateleira de baixo, mais)
    zc = zt
    _decanter(x0 + 0.13, y0 + 0.16, zc, 0.28, 0.06, '#a05a22')
    _decanter(x0 + 0.3, y0 + 0.27, zc, 0.22, 0.05, '#7a2a1a')
    _garrafa_bar(x0 + 0.45, y0 + 0.12, zc, 0.3, 0.034, '#1a3a26')
    _copo_cristal(x1 - 0.06, y1 - 0.1, zc, 0.1, 0.026, True)
    _copo_cristal(x1 - 0.15, y1 - 0.06, zc, 0.1, 0.026, True)
    _copo_cristal(x1 - 0.24, y1 - 0.12, zc, 0.075, 0.03)
    zc = zb + 0.03
    _garrafa_bar(x0 + 0.14, y0 + 0.15, zc, 0.3, 0.035, '#3a2a16', '#e8dcc0')
    _garrafa_bar(x0 + 0.26, y0 + 0.28, zc, 0.28, 0.034, '#2a4a30')
    _decanter(x0 + 0.42, y0 + 0.17, zc, 0.21, 0.046, '#b27a30')
    peg(x0 - 0.03, x1 + 0.02, y0 - 0.02, y1 + 0.02)


def _roda_y(xc, y, zc, r, lado):
    """Uma roda de latão em pé no plano y = const: o aro, o cubo e seis raios (fios), com a face voltada para `lado`."""
    o = novo()
    esp = 0.016
    ya, yb = (y, y + lado * esp)
    ya, yb = min(ya, yb), max(ya, yb)
    n = 18
    for i in range(n):
        a0, a1 = 2 * math.pi * i / n, 2 * math.pi * (i + 1) / n
        am = (a0 + a1) / 2
        ro = r
        fp([(xc + ro * math.cos(a0), ya, zc + ro * math.sin(a0)), (xc + ro * math.cos(a1), ya, zc + ro * math.sin(a1)),
            (xc + ro * math.cos(a1), yb, zc + ro * math.sin(a1)), (xc + ro * math.cos(a0), yb, zc + ro * math.sin(a0))],
           (math.cos(am), 0, math.sin(am)), liso(hexn(np.clip(hx(OURO) * (0.8 + 0.3 * max(0.0, math.sin(am))), 0, 255))), o)
    # a face de fora: o anel (o aro) e o miolo escuro com os raios
    py = yb if lado > 0 else ya
    nn = (0, 1, 0) if lado > 0 else (0, -1, 0)
    rr = r - 0.022
    fp([(xc + r * math.cos(2 * math.pi * i / n), py, zc + r * math.sin(2 * math.pi * i / n)) for i in range(n)], nn, liso(OURO_L), o)
    o2 = novo()
    fp([(xc + rr * math.cos(2 * math.pi * i / n), py + lado * 0.002, zc + rr * math.sin(2 * math.pi * i / n)) for i in range(n)], nn, liso('#2a1e12'), o2)
    o4 = novo()
    fp([(xc + 0.022 * math.cos(2 * math.pi * i / 10), py + lado * 0.006, zc + 0.022 * math.sin(2 * math.pi * i / 10)) for i in range(10)], nn, liso('#fff0b0'), o4)


# =====================================================================================================================
# (a cama e o divã ficam aqui)
# =====================================================================================================================
# a cama master (3 x 3, 0,7 m): cabeceira alta capitonê champanhe com moldura de nogueira, roupa de seda, seis travesseiros
# =====================================================================================================================
def _poste(x, y, z0, z1, r, bola=True):
    """O poste torneado de nogueira (a cama): o perfil de torno e, em cima, a bola dourada."""
    h = z1 - z0
    perfil = [(z0, r * 0.7), (z0 + h * 0.04, r), (z0 + h * 0.12, r * 0.8), (z0 + h * 0.2, r), (z0 + h * 0.55, r * 0.78),
              (z0 + h * 0.6, r * 0.95), (z0 + h * 0.66, r * 0.78), (z0 + h * 0.9, r * 0.82), (z0 + h * 0.95, r * 1.0), (z1, r * 0.9)]
    o = novo()
    _poligono_rodado(x, y, perfil, vol(x, y, '#4e2c18', brilho=0.35), o, lados=12, tampa_mat=liso('#5e3a22'))
    if bola:
        o2 = novo()
        _poligono_rodado(x, y, [(z1, r * 0.45), (z1 + 0.012, r * 0.78), (z1 + 0.05, r * 0.82), (z1 + 0.085, r * 0.55), (z1 + 0.11, r * 0.18), (z1 + 0.125, r * 0.05)],
                         vol(x, y, OURO, brilho=0.8), o2, lados=12)


def cama_master():
    """
    A cama do casal (o colchão a 0,7 m): a cabeceira de nogueira entalhada com o painel capitonê champanhe em arco e o
    friso de ouro, os quatro postes torneados com a bola dourada, o pé baixo almofadado, a roupa de seda champanhe com a
    dobra marfim, a manta de caxemira vinho dobrada no pé e seis travesseiros em três fileiras.
    """
    x0, x1 = 0.04, 2.21
    y0, y1 = 0.03, 2.2
    zm = 0.7
    xm = (x0 + x1) / 2
    # --- a cabeceira: a tábua de nogueira com as almofadas, os postes e o painel em arco
    yh = y0 + 0.02
    cx((x0 + 0.1, x1 - 0.1, yh, yh + 0.07, 0.16, 1.22), {'frente': CA.almofadas(NOZ, [(x0 + 0.22, x1 - 0.22, 0.24, 0.5, 'p')], seed=401),
                                                         'costas': mad2(NOZ_E, seed=402, passo=0.05), 'cima': liso('#6e4228'),
                                                         '*': mad2(NOZ, eixo=1, seed=403, passo=0.05)})
    # o friso de cima (a travessa grossa de nogueira com o filete de ouro)
    cx((x0 + 0.08, x1 - 0.08, yh - 0.01, yh + 0.09, 1.22, 1.3), {'cima': liso('#7a4a2c'), '*': _pau('#5a3420', '#8a5a36', quina=1.25, b=(0, 0, 0, 0, 0, 1.3))})
    # o painel capitonê em arco (champanhe), com o friso de ouro atrás
    px0, px1 = x0 + 0.34, x1 - 0.34
    arco_o = arco_perfil(px0 - 0.045, px1 + 0.045, 0.3, 1.2, 1.64, n=16)
    extruda_xz(arco_o, yh + 0.07, yh + 0.1, {'frente': ouro(), 'costas': mad2(NOZ_E, seed=409, passo=0.05), '*': ouro()})
    arco_p = arco_perfil(px0, px1, 0.32, 1.2, 1.6, n=16)
    bb = (px0, px1, yh + 0.1, yh + 0.17, 0.32, 1.6)
    CAPI = ES.estofado(_CHAMP, bb, 3.0, 8.0, cupula=0.6, grad=0.2, capi=(0.2, 0.18))
    extruda_xz(arco_p, yh + 0.1, yh + 0.17, {'frente': CAPI, 'cima': CAPI, 'lado': CAPI, 'costas': mad2(NOZ, seed=410, passo=0.05)})
    # os postes torneados da cabeceira e do pé
    for xx in (x0 + 0.07, x1 - 0.07):
        _poste(xx, yh + 0.05, 0.0, 1.5, 0.062)
        _poste(xx, y1 - 0.07, 0.0, 0.86, 0.056)
    # --- o pé: o painel baixo de nogueira almofadado entre os postes
    cx((x0 + 0.12, x1 - 0.12, y1 - 0.1, y1 - 0.04, 0.14, 0.62), {'frente': CA.almofadas(NOZ, [(x0 + 0.24, xm - 0.03, 0.2, 0.56, 'p'), (xm + 0.03, x1 - 0.24, 0.2, 0.56, 'p')], seed=404),
                                                                 'costas': mad2(NOZ_E, seed=405), 'cima': liso('#6e4228'), '*': mad2(NOZ, eixo=1, seed=406, passo=0.05)})
    cx((x0 + 0.1, x1 - 0.1, y1 - 0.11, y1 - 0.03, 0.62, 0.68), {'cima': liso('#7a4a2c'), '*': _pau('#5a3420', '#8a5a36', quina=1.25, b=(0, 0, 0, 0, 0, 0.68))})
    # as laterais (as réguas do estrado, baixas, quase escondidas pela roupa de cama)
    for xx in (x0 + 0.02, x1 - 0.1):
        cx((xx, xx + 0.08, y0 + 0.14, y1 - 0.1, 0.16, 0.34), {'cima': liso('#6e4228'), '*': mad2(NOZ, seed=407, passo=0.05)})
    # --- o colchão e a roupa de cama
    zc0 = 0.3
    b = (x0 + 0.1, x1 - 0.1, yh + 0.1, y1 - 0.1, zc0, zm - 0.1)
    ES.malha(b, (0.05, 0.05, 0.02, 0.05), ES.estofado(_MARFIM, b, 3.0, 7.0, cupula=0.3, grad=0.5), seg=2)
    # a seda champanhe: cobre do meio até o pé e cai dos lados
    yq = yh + 0.78
    b = (x0 + 0.05, x1 - 0.05, yq, y1 - 0.06, zc0 - 0.04, zm)
    ES.malha(b, (0.07, 0.06, 0.02, 0.07), ES.estofado(_CHAMP, b, 1.6, 7.0, cupula=1.1, brilho=True, grad=1.6), seg=2)
    # a dobra marfim com o filete de ouro (a roupa dobrada para trás)
    b = (x0 + 0.045, x1 - 0.045, yq - 0.2, yq + 0.1, zm - 0.07, zm + 0.025)
    ES.malha(b, (0.04, 0.05, 0.02, 0.05), ES.estofado(_MARFIM, b, 3.6, 8.4, cupula=0.5, brilho=True), seg=2)
    # a manta vinho dobrada no pé (com a listra de ouro nas pontas)
    b = (x0 + 0.06, x1 - 0.06, y1 - 0.62, y1 - 0.26, zm - 0.02, zm + 0.075)
    ES.malha(b, (0.04, 0.05, 0.02, 0.05), ES.estofado(_VINHO, b, 1.8, 6.4, cupula=1.0, brilho=False, grad=0.6), seg=2)
    # --- os seis travesseiros: dois grandes marfim atrás, dois euros champanhe no meio, dois almofadões na frente
    zp = zm - 0.04
    for (a0, a1) in ((x0 + 0.14, xm - 0.04), (xm + 0.04, x1 - 0.14)):
        b = (a0, a1, yh + 0.14, yh + 0.54, zp, zp + 0.3)
        ES.malha(b, (0.16, 0.15, 0.05, 0.14), ES.estofado(_MARFIM, b, 3.4, 8.8, cupula=1.0, grad=0.6), seg=2)
    for (a0, a1) in ((x0 + 0.34, xm - 0.2), (xm + 0.2, x1 - 0.34)):
        b = (a0, a1, yh + 0.5, yh + 0.84, zp + 0.02, zp + 0.24)
        ES.malha(b, (0.1, 0.09, 0.05, 0.1), ES.estofado(_CHAMP, b, 2.8, 8.6, cupula=0.9, brilho=True, grad=0.8), seg=2)
    for (a0, a1, R) in ((xm - 0.5, xm - 0.08, _VINHO), (xm + 0.08, xm + 0.5, _VERDE)):
        b = (a0, a1, yh + 0.84, yh + 1.1, zm - 0.01, zm + 0.15)
        ES.malha(b, (0.09, 0.08, 0.05, 0.08), ES.estofado(R, b, 2.8, 8.4, cupula=1.0, brilho=True, grad=0.6), seg=2)
    peg(x0, x1, y0, y1)


# =====================================================================================================================
# o divã (chaise longue, 2 x 1, 0,6 m): veludo verde-garrafa, o encosto curvo, os pés torneados
# =====================================================================================================================
def chaise_longue():
    """
    O divã de veludo verde-garrafa (o assento a 0,6 m): o apoio alto e redondo numa ponta, o encosto curvo que desce até a
    outra, o assento capitonê, a almofada cilíndrica com as pontas douradas, o filete de tachas e os pés torneados.
    """
    x0, x1 = 0.03, 1.47
    y0, y1 = 0.04, 0.72
    zs = 0.6
    # os pés torneados (nogueira escura): quatro nas quinas e dois no meio
    for (a, b_) in ((x0 + 0.08, y0 + 0.07), (x1 - 0.08, y0 + 0.07), (x0 + 0.08, y1 - 0.07), (x1 - 0.08, y1 - 0.07), ((x0 + x1) / 2, y1 - 0.07), ((x0 + x1) / 2, y0 + 0.07)):
        CA.perna_torneada(a, b_, 0.0, 0.2, 0.033, '#34190c')
    # a base: a saia de veludo com a fileira de tachas de ouro
    b = (x0 + 0.02, x1 - 0.02, y0 + 0.03, y1 - 0.02, 0.15, 0.44)
    ES.malha(b, (0.03, 0.03, 0.02, 0.03), ES.estofado(_VERDE, b, 1.4, 4.6, cupula=0, grad=0.8, tachas=(0.25, 3)), seg=2)
    # o apoio alto da ponta esquerda: o rolo redondo (alto e fofo), capitonê por dentro
    b = (x0, x0 + 0.26, y0, y1, 0.3, 0.88)
    ES.malha(b, (0.1, 0.1, 0.03, 0.16), ES.estofado(_VERDE, b, 2.2, 7.4, cupula=0.6, grad=0.6, capi=(0.14, 0.13)), seg=3)
    # o encosto curvo ao longo do fundo: sai do apoio e desce suave até o pé do divã
    xa, xb = x0 + 0.16, x1 - 0.02
    n = 14
    pts = [(xa, 0.3), (xb, 0.3), (xb, 0.56)] + [(xa + (xb - xa) * t, 0.56 + 0.3 * math.sqrt(max(0.0, 1 - t * t))) for t in [1 - k / n for k in range(1, n + 1)]]
    bb = (xa, xb, y0, y0 + 0.17, 0.3, 0.86)
    ENC = ES.estofado(_VERDE, bb, 2.0, 7.2, cupula=0.5, grad=0.3, capi=(0.15, 0.13))
    extruda_xz(pts, y0, y0 + 0.17, {'frente': ENC, 'cima': ENC, 'lado': ENC, 'costas': ENC})
    # a almofada do assento (capitonê, os botões fundos)
    b = (x0 + 0.22, x1 - 0.04, y0 + 0.14, y1 - 0.01, 0.4, zs)
    ES.malha(b, (0.07, 0.07, 0.04, 0.07), ES.estofado(_VERDE, b, 2.4, 7.8, cupula=1.1, brilho=True, capi=(0.15, 0.14), grad=0.8), seg=2)
    # a almofada cilíndrica (champanhe) junto do apoio, as pontas douradas
    o = novo()
    ES.cil_eixo((x0 + 0.36, y0 + 0.2, zs + 0.07), (x0 + 0.36, y1 - 0.07, zs + 0.07), 0.07,
                _p1_mat_rampa(_CHAMP, 1.6, 8.6), o, lados=12, tampa_mat=liso(OURO))
    peg(x0, x1, y0, y1)


# =====================================================================================================================
# os espelhos de moldura dourada (a face da frente: o ouro trabalhado em volta e o vidro com o reflexo)
# =====================================================================================================================
def _dentro_arco(X, Z, x0, x1, z0, zc, zt, b):
    """Dentro do vão (a moldura de largura b tirada) de um retângulo com o topo em arco."""
    xm, rx = (x0 + x1) / 2, (x1 - x0) / 2 - b
    ra = max(1e-6, zt - zc - b)
    ret = (X >= x0 + b) & (X <= x1 - b) & (Z >= z0 + b) & (Z <= zc)
    arc = (Z > zc) & ((((X - xm) / rx) ** 2 + ((Z - zc) / ra) ** 2) <= 1.0)
    return ret | arc


def espelho_arco_mat(x0, x1, z0, zc, zt, b=0.06, tom='#a4c0c4'):
    """
    O espelho de arco com a moldura de ouro: a faixa de ouro de b (o filete claro por fora, o friso de contas no meio, o
    filete escuro por dentro) e o vidro azulado com as duas faixas de reflexo em diagonal.
    """
    c0 = hx(tom)
    ouro_m, ouro_c, ouro_e = hx(OURO), hx(OURO_L), hx(OURO_E)

    def f(L, n, P):
        X, Z = P[:, 0], P[:, 2]
        dentro = _dentro_arco(X, Z, x0, x1, z0, zc, zt, b)
        d1 = _dentro_arco(X, Z, x0, x1, z0, zc, zt, b * 0.62)
        d2 = _dentro_arco(X, Z, x0, x1, z0, zc, zt, b * 0.3)
        # o ouro: o corpo, as contas claras no meio da faixa, o filete claro de fora e o escuro de dentro
        out = np.tile(ouro_m, (len(P), 1))
        conta = (np.floor(X / (2.2 * PH)) + np.floor(Z / (2.2 * PZ))) % 2 == 0
        out = np.where((~d2 & d1 & ~dentro)[:, None] & conta[:, None], ouro_c, out)
        out = np.where((~d2 & d1 & ~dentro)[:, None] & ~conta[:, None], _tom(ouro_m, 0.8), out)
        out = np.where((d2 & ~dentro)[:, None], ouro_c, out)
        fora = ~d1
        out = np.where(fora[:, None], _tom(ouro_m, 1.12), out)
        # o vidro
        a = (X - x0) / PH
        bb = (zc + (zt - zc) - Z) / PZ
        g = a * 0.85 + bb * 0.85
        w0 = (x1 - x0) / PH * 0.5
        v = np.tile(c0, (len(P), 1))
        v = np.where(((g > w0 * 0.5) & (g < w0 * 0.5 + 8))[:, None], _tom(c0, 1.15), v)
        v = np.where(((g > w0 * 0.5 + 11) & (g < w0 * 0.5 + 13))[:, None], _tom(c0, 1.22), v)
        v = np.where((g > w0 * 2.0 + 20)[:, None], _tom(c0, 0.9), v)
        sh = _dentro_arco(X, Z, x0, x1, z0, zc, zt, b * 1.0 + 0.03) & ~_dentro_arco(X, Z, x0, x1, z0, zc, zt, b + 0.03 + 0.0001)
        v = np.where((dentro & ~_dentro_arco(X, Z, x0 + 0.03, x1 - 0.03, z0 + 0.03, zc, zt - 0.03, b))[:, None] & ((X < (x0 + x1) / 2) | (Z > zc))[:, None],
                     _tom(v, 0.86), v)
        out = np.where(dentro[:, None], v, out)
        return BE._cru(out, n)
    return emissivo(f)


def espelho_corpo():
    """
    O espelho de chão inteiro (2 m): o vidro em arco numa moldura dourada trabalhada (as contas, o remate de folhas em
    cima), preso por dois parafusos aos montantes de nogueira do cavalete, com os pés em trenó e a travessa baixa.
    """
    x0, x1 = 0.1, 0.65
    yf0, yf1 = 0.33, 0.4
    zb, zc, zt = 0.26, 1.72, 1.97
    # o cavalete: os montantes torneados, os pés em trenó (ao longo de y) e a travessa
    for xx in (x0 - 0.045, x1 + 0.045):
        for yy in (0.37,):
            _poste(xx, yy, 0.0, 1.9, 0.036, bola=True)
        cx((xx - 0.035, xx + 0.035, 0.1, 0.66, 0.0, 0.06), {'cima': liso('#6e4228'), '*': mad2(NOZ, eixo=1, seed=421, passo=0.05)}, ch=0.012)
    cx((x0 - 0.045, x1 + 0.045, 0.35, 0.39, 0.3, 0.36), {'cima': liso('#6e4228'), '*': mad2(NOZ, seed=422, passo=0.04)})
    # os dois parafusos (as borboletas de latão) que seguram o espelho
    # o espelho: o arco dourado inteiro
    bb = (x0, x1, yf0, yf1, zb, zt)
    MAT = espelho_arco_mat(x0, x1, zb, zc, zt, b=0.062)
    extruda_xz(arco_perfil(x0, x1, zb, zc, zt, n=18), yf0, yf1, {'frente': MAT, 'cima': ouro(), 'lado': ouro(), 'costas': mad2('#3e2414', seed=423, passo=0.05)})
    # o remate de cima: o penacho de folhas e a concha (ouro)
    xm = (x0 + x1) / 2
    extruda_xz(oval_perfil(xm, zt + 0.03, 0.09, 0.05, 14), yf0 - 0.005, yf1 + 0.012, {'frente': ouro_vol_x(), '*': ouro()})
    extruda_xz(oval_perfil(xm - 0.1, zt - 0.02, 0.04, 0.025, 10), yf0 + 0.005, yf1 + 0.006, {'*': ouro()})
    extruda_xz(oval_perfil(xm + 0.1, zt - 0.02, 0.04, 0.025, 10), yf0 + 0.005, yf1 + 0.006, {'*': ouro()})
    for xx in (x0 - 0.045, x1 + 0.045):
        cx((xx - 0.012, xx + 0.012, yf0 - 0.012, yf1 + 0.012, 1.26, 1.3), ouro((0, 0, 0, 0, 1.26, 1.3)), contorno=False)
    peg(x0 - 0.08, x1 + 0.08, 0.1, 0.66)


def ouro_vol_x():
    return ouro((0, 0, 0, 0, 0, 3), OURO_L)


# =====================================================================================================================
# a penteadeira (2 x 1, 1,7 m): o tampo com perfumes, escovas e a caixinha de joias; o espelho tríptico dourado
# =====================================================================================================================
def espelho_plano_mat(u_fn, W, z0, z1, b=0.045):
    """O painel de espelho girado (a folha de porta): a moldura de ouro (u = a distância à dobradiça) e o vidro."""
    c0 = hx('#a4c0c4')
    ouro_m, ouro_c = hx(OURO), hx(OURO_L)

    def f(L, n, P):
        u, z = u_fn(P), P[:, 2]
        borda = (u < b) | (u > W - b) | (z < z0 + b) | (z > z1 - b)
        ext = (u < b * 0.4) | (u > W - b * 0.4) | (z < z0 + b * 0.4) | (z > z1 - b * 0.4)
        out = np.tile(c0, (len(P), 1))
        g = u / PH * 0.9 + (z1 - z) / PZ * 0.9
        out = np.where(((g > W / PH * 0.35) & (g < W / PH * 0.35 + 5))[:, None], _tom(c0, 1.16), out)
        out = np.where(((g > W / PH * 0.35 + 8) & (g < W / PH * 0.35 + 9.5))[:, None], _tom(c0, 1.22), out)
        conta = (np.floor(u / (2.2 * PH)) + np.floor(z / (2.2 * PZ))) % 2 == 0
        o = np.where(conta[:, None], ouro_c, _tom(ouro_m, 0.82))
        out = np.where(borda[:, None], o, out)
        out = np.where(ext[:, None], ouro_c, out)
        return BE._cru(out, n)
    return emissivo(f)


def _perfume(x, y, z, k):
    cores = ['#d8a8b0', '#8ab0c8', '#c8b868', '#a8c8a0']
    r = 0.028 + 0.004 * (k % 2)
    h = 0.1 + 0.03 * (k % 3)
    o = novo()
    _poligono_rodado(x, y, [(z, r), (z + h * 0.62, r), (z + h * 0.7, r * 0.45), (z + h * 0.78, r * 0.35)],
                     vol(x, y, cores[k % 4], brilho=0.8), o, lados=8)
    o2 = novo()
    _poligono_rodado(x, y, [(z + h * 0.76, r * 0.5), (z + h * 0.84, r * 0.62), (z + h * 1.0, r * 0.5), (z + h * 1.08, r * 0.1)],
                     vol(x, y, OURO, brilho=0.7), o2, lados=8)
    peq(x - r, x + r, y - r, y + r, z)


def penteadeira():
    """
    A penteadeira (1,7 m): a mesa de nogueira com a saia de duas gavetas e as pernas em cabriolé, o tampo com os frascos
    de perfume, o par de escovas, o espelhinho de mão e a caixinha de joias de veludo; atrás, o espelho tríptico (o
    central em arco, os dois laterais girados para dentro) de moldura dourada.
    """
    x0, x1 = 0.05, 1.45
    y0, y1 = 0.12, 0.72
    zt = 0.78
    xm = (x0 + x1) / 2
    for (a, b_) in ((x0 + 0.06, y0 + 0.06), (x1 - 0.06, y0 + 0.06), (x0 + 0.06, y1 - 0.06), (x1 - 0.06, y1 - 0.06)):
        CA.perna_torneada(a, b_, 0.0, zt - 0.2, 0.034, '#34190c')
    # a saia com as gavetas (nogueira, alças de ouro)
    pain = [(x0 + 0.1, xm - 0.04, zt - 0.2, zt - 0.1, 'g'), (xm - 0.0, xm + 0.0, 0, 0, 'g'), (xm + 0.04, x1 - 0.1, zt - 0.2, zt - 0.1, 'g')]
    cx((x0 + 0.03, x1 - 0.03, y0 + 0.02, y1 - 0.02, zt - 0.2, zt - 0.06), {'frente': CA.almofadas(NOZ, [pain[0], pain[2]], seed=431),
                                                                          'costas': mad2(NOZ_E, seed=432), '*': mad2(NOZ, eixo=1, seed=433, passo=0.05)})
    for xa in ((x0 + xm) / 2, (xm + x1) / 2):
        CA.alca(xa, zt - 0.15, y1 - 0.02, 0.07)
    # o tampo: nogueira com o filete e a quina que pega luz
    cx((x0, x1, y0 - 0.01, y1 + 0.01, zt - 0.06, zt), {'cima': tab2(NOZ_T, 0.2, '#2a160a', seed=434, org=y0), '*': _pau('#4a2a16', '#7a4a2c', quina=1.25, b=(0, 0, 0, 0, 0, zt))})
    # em cima: o tapetinho de renda, os frascos, as escovas, o espelho de mão, a caixa de joias
    cx((x0 + 0.1, x0 + 0.6, y0 + 0.2, y0 + 0.5, zt, zt + 0.004), liso('#e6dcc4'), contorno=False)
    for k, (dx, dy) in enumerate(((0.16, 0.34), (0.26, 0.26), (0.36, 0.38), (0.46, 0.3))):
        _perfume(x0 + dx, y0 + dy, zt + 0.004, k)
    for k, (dx, dy) in enumerate(((0.72, 0.36), (0.78, 0.44))):
        o = novo()
        ES.haste((x0 + dx, y0 + dy, zt + 0.012), (x0 + dx + 0.16, y0 + dy - 0.04 - 0.03 * k, zt + 0.012), 0.022, liso('#c8a050'), o, 0.016)
        cx((x0 + dx - 0.05, x0 + dx + 0.012, y0 + dy - 0.022, y0 + dy + 0.022, zt, zt + 0.02), liso('#d8d0b8'), contorno=False)
    # o espelhinho de mão (o disco de ouro com o vidro)
    o = novo()
    _poligono_rodado(x1 - 0.5, y0 + 0.4, [(zt, 0.04), (zt + 0.012, 0.04)], vol(x1 - 0.5, y0 + 0.4, OURO, brilho=0.6), o, lados=12, tampa_mat=liso('#a4c0c4'))
    # a caixinha de joias: veludo vinho com o fecho e a tampa aberta mostrando o colar de pérolas
    b = (x1 - 0.34, x1 - 0.1, y0 + 0.24, y0 + 0.44, zt, zt + 0.07)
    ES.malha(b, (0.015, 0.015, 0.005, 0.01), ES.estofado(_VINHO, b, 2.4, 7.0, cupula=0.5), seg=1)
    cx((x1 - 0.34, x1 - 0.1, y0 + 0.24, y0 + 0.44, zt + 0.07, zt + 0.078), ouro((0, 0, 0, 0, 0, 1)), contorno=False)
    cx((x1 - 0.225, x1 - 0.205, y0 + 0.44, y0 + 0.455, zt + 0.03, zt + 0.055), liso(OURO_L), contorno=False)
    o = novo()
    C().elipsoide(np.array([x1 - 0.22, y0 + 0.34, zt + 0.1]), np.array([0.026, 0.026, 0.026]), liso('#f6f0e4'), o, brilho=0.8)
    peq(x1 - 0.34, x1 - 0.1, y0 + 0.24, y0 + 0.44, zt)
    # o espelho tríptico: o central em arco, os laterais girados para dentro
    zb = zt + 0.14
    cw = 0.42
    cxa, cxb = xm - cw / 2, xm + cw / 2
    yb = y0 + 0.06
    extruda_xz(arco_perfil(cxa, cxb, zb, 1.48, 1.72, n=16), yb, yb + 0.04,
               {'frente': espelho_arco_mat(cxa, cxb, zb, 1.48, 1.72, b=0.05), 'cima': ouro(), 'lado': ouro(), 'costas': mad2(NOZ_E, seed=435, passo=0.05)})
    cx((xm - 0.03, xm + 0.03, yb, yb + 0.05, 1.72, 1.78), liso(OURO_L))
    Wp = 0.3
    for (lado, Hx, ang) in ((-1, cxa, 180 - 24), (1, cxb, 24)):
        H = (Hx, yb + 0.04)
        mf = espelho_plano_mat(lambda P, H=H, ang=ang: (P[:, 0] - H[0]) * math.cos(math.radians(ang)) + (P[:, 1] - H[1]) * math.sin(math.radians(ang)), Wp, zb, 1.5)
        CA.porta_giro(H, ang, Wp, zb, 1.5, mf, mad2(NOZ_E, seed=436), esp=0.035, lado=lado, mat_b=ouro())
    # o pé do espelho: a base de nogueira atrás do tampo
    cx((cxa - 0.35, cxb + 0.35, y0 + 0.02, y0 + 0.1, zt, zt + 0.14), {'cima': liso('#7a4a2c'), '*': mad2(NOZ, seed=437, passo=0.05)})
    peg(x0, x1, y0, y1)


# =====================================================================================================================
# a banheira de luxo (2 x 3, 0,8 m): louça branca com o friso de ouro, pés de garra dourados, torneira alta de latão
# =====================================================================================================================
def banheira_luxo():
    """
    A banheira independente (a borda a 0,8 m): o casco de louça branca com o friso de ouro, a borda larga, a água clara
    e calma, os quatro pés de garra dourados e a torneira alta de piso com o chuveirinho, na cabeceira.
    """
    x0, x1 = 0.1, 1.4
    y0, y1 = 0.3, 2.2
    zt = 0.8
    zb = 0.16
    cx_, cy_ = (x0 + x1) / 2, (y0 + y1) / 2
    ax, ay = (x1 - x0) / 2, (y1 - y0) / 2
    LOU = _p1_mat_rampa(_LOUCA, 3.0, 6.2)
    ouro_f = hx(OURO)

    def casco(L, n, P):
        out = LOU(L, n, P)
        z = P[:, 2]
        faixa = ((z > 0.36) & (z < 0.36 + 2 * PZ)) | ((z > 0.4) & (z < 0.4 + PZ))
        return np.where(faixa[:, None] & (abs(n[2]) < 0.5), BE._p1_final(np.where((z > 0.4)[:, None] if False else True, ouro_f, ouro_f), n, 3), out)
    b = (x0, x1, y0, y1, zb, zt - 0.003)
    _p1_malha(b, (0.5, 0.5, 0.2, 0.03), emissivo(casco), seg=4)
    o = novo()
    C().face_plana(CA._ret_redondo(cx_, cy_, ax - 0.005, ay - 0.005, 0.42, zt), (0, 0, 1), CA.bacia(cx_, cy_, ax - 0.005, ay - 0.005, 0.42, zt, aro=0.07), M, o)
    # os pés de garra dourados
    for (a, b_) in ((x0 + 0.2, y0 + 0.3), (x1 - 0.2, y0 + 0.3), (x0 + 0.2, y1 - 0.3), (x1 - 0.2, y1 - 0.3)):
        o = novo()
        _poligono_rodado(a, b_, [(0.0, 0.06), (0.03, 0.055), (0.07, 0.034), (0.1, 0.03), (zb + 0.06, 0.05)], vol(a, b_, OURO, brilho=0.7), o, lados=12)
        o = novo()
        _poligono_rodado(a, b_, [(0.0, 0.07), (0.012, 0.07), (0.022, 0.05)], vol(a, b_, OURO_L, brilho=0.4), o, lados=12)
    # a torneira alta de piso (na cabeceira, y0): o tubo, o bico em arco por cima da borda, as duas cruzetas, o chuveirinho
    tx, ty = cx_, 0.18
    o = novo()
    _poligono_rodado(tx, ty, [(0.0, 0.05), (0.03, 0.045), (0.06, 0.024), (1.0, 0.02)], vol(tx, ty, OURO, brilho=0.8), o, lados=12, tampa_mat=liso(OURO_L))
    o = novo()
    ES.haste((tx, ty, 1.0), (tx, ty + 0.26, 1.0), 0.032, ouro(), o, 0.032)
    o = novo()
    ES.haste((tx, ty + 0.26, 1.0), (tx, ty + 0.26, 0.9), 0.026, ouro(), o, 0.026)
    for dx in (-0.1, 0.1):
        o = novo()
        ES.haste((tx, ty, 0.78), (tx + dx, ty, 0.78), 0.02, ouro(), o, 0.02)
        o2 = novo()
        C().elipsoide(np.array([tx + dx, ty, 0.78]), np.array([0.03, 0.03, 0.03]), vol_esfera(OURO), o2, brilho=0.8)
    # o chuveirinho: o gancho na lateral do tubo e a cabeça de ouro com os furos
    o = novo()
    ES.cil_eixo((tx + 0.05, ty, 0.64), (tx + 0.05, ty + 0.1, 0.64), 0.028, _p1_mat_rampa(_OUROR, 2.0, 8.0), o, lados=10, tampa_mat=liso('#4a3a1a'), r1=0.04)
    peg(x0, x1, 0.12, y1)


def vol_esfera(cor):
    c0 = hx(cor)
    return lambda Pc, N, P: np.tile(c0, (len(P), 1))


# =====================================================================================================================
# a pia dupla (2 x 1, 0,95 m): mármore com duas cubas, torneiras douradas, o armário de nogueira
# =====================================================================================================================
def marmore(cor='#e8e0d0', veio='#a89e90', seed=0, esc=0.9):
    """O mármore creme: o tom, os veios longos e finos em diagonal (riscas de 1 px) e o brilho."""
    c0, cv = hx(cor), hx(veio)

    def f(L, n, P):
        a, b = ES._uv(n, P)
        out = np.tile(c0, (len(P), 1))
        # um tom um pouco mais claro e mais escuro em manchas grandes
        s = suave(np.floor(a / 3) * 3 * PH, np.floor(b / 3) * 3 * PH, 0.35, seed)
        out = np.where((s > 0.62)[:, None], _tom(c0, 1.05), out)
        out = np.where((s < 0.3)[:, None], _tom(c0, 0.95), out)
        d = a * 0.6 + b * 0.8 + 14 * suave(a * PH, b * PH, 0.5, seed + 3)
        v1 = np.abs(((d / 17.0 + seed) % 1.0) - 0.5) < (0.5 / 17.0)
        v2 = (np.abs(((d / 29.0 + seed * 0.3) % 1.0) - 0.5) < (0.5 / 29.0)) & (ruido(np.floor(a / 9), np.floor(b / 9), seed) > 0.4)
        out = np.where((v1 & (ruido(np.floor(a / 7), np.floor(b / 7), seed + 1) > 0.35))[:, None], _tom(cv, 1.15), out)
        out = np.where(v2[:, None], _tom(cv, 1.25), out)
        return BE._cru(out, n)
    return emissivo(f)


def _torneira_dourada(x, y, z):
    o = novo()
    _poligono_rodado(x, y, [(z, 0.026), (z + 0.012, 0.02), (z + 0.1, 0.014), (z + 0.15, 0.014)], vol(x, y, OURO, brilho=0.8), o, lados=10, tampa_mat=liso(OURO_L))
    o = novo()
    ES.haste((x, y, z + 0.14), (x, y + 0.12, z + 0.14), 0.026, ouro(), o, 0.026)
    o = novo()
    ES.haste((x, y + 0.12, z + 0.14), (x, y + 0.12, z + 0.11), 0.022, ouro(), o, 0.022)
    for dx in (-0.06, 0.06):
        o = novo()
        _poligono_rodado(x + dx, y - 0.01, [(z, 0.016), (z + 0.05, 0.012)], vol(x + dx, y - 0.01, OURO, brilho=0.7), o, lados=8)
        o = novo()
        C().elipsoide(np.array([x + dx, y - 0.01, z + 0.06]), np.array([0.022, 0.022, 0.022]), vol_esfera(OURO_L), o, brilho=0.8)


def pia_dupla():
    """
    A bancada de mármore creme com duas cubas de louça (a de dentro mais escura, o ralo), as duas torneiras de ouro com
    as cruzetas, o frontão baixo atrás e, embaixo, o armário de nogueira de duas portas almofadadas com puxadores de ouro.
    """
    x0, x1 = 0.04, 1.46
    y0, y1 = 0.06, 0.7
    zt = 0.95
    zm = zt - 0.045
    xm = (x0 + x1) / 2
    cx((x0 + 0.04, x1 - 0.04, y0 + 0.04, y1 - 0.06, 0.0, 0.1), mad2(NOZ_E, seed=441, passo=0.04))
    pain = [(x0 + 0.06, xm - 0.02, 0.16, zm - 0.08, 'p'), (xm + 0.02, x1 - 0.06, 0.16, zm - 0.08, 'p')]
    cx((x0 + 0.01, x1 - 0.01, y0 + 0.02, y1 - 0.03, 0.1, zm), {'frente': CA.almofadas(NOZ, pain, seed=442), 'costas': mad2(NOZ_E, seed=443),
                                                              '*': mad2(NOZ, eixo=1, seed=444, passo=0.05)})
    for xx in (xm - 0.07, xm + 0.07):
        CA.botao(xx, zm - 0.22, y1 - 0.03, OURO, OURO_L)
    # o tampo de mármore com as duas cubas
    bx = (x0 + 0.37, x1 - 0.37)
    MARM = marmore(seed=5)
    cubas = [(c, 0.36, 0.24, 0.16, 0.08) for c in bx]
    bacias = [CA.bacia(c, cy, ax, ay, r, zt, aro=0.03, agua=False) for (c, cy, ax, ay, r) in [(a, b, c_, d, e) for (a, b, c_, d, e) in cubas]]

    def topo(L, n, P):
        out = MARM(L, n, P)
        if n[2] < 0.5:
            return out
        for (c, cy, ax, ay, r), bm in zip(cubas, bacias):
            d = CA._sdf_ret(P[:, 0], P[:, 1], c, cy, ax, ay, r)
            ins = d > 0.0
            if ins.any():
                out = np.where(ins[:, None], bm(L, n, P), out)
        return out
    tp = emissivo(topo)
    o = novo()
    C().caixa((x0 - 0.01, x1 + 0.01, y0, y1 + 0.02, zm, zt), {'cima': tp, '*': MARM}, M, o)
    cx((x0 - 0.01, x1 + 0.01, y0, y0 + 0.04, zt, zt + 0.13), {'*': MARM, 'cima': marmore(seed=6)}, ch=0.01)
    for c in bx:
        _torneira_dourada(c, y0 + 0.11, zt)
    # o sabonete e o frasco na ponta
    peq(x1 - 0.15, x1 - 0.05, y1 - 0.14, y1 - 0.04, zt)
    peg(x0, x1, y0, y1)


# =====================================================================================================================
# as folhas de porta que giram (a moldura de madeira, com ou sem o vidro) e a roupa pendurada
# =====================================================================================================================
def folha_moldura(H, ang, W, z0, z1, lado, mat, mat_d=None, barra=0.04, esp=0.026, meio=False):
    """A folha de porta aberta só de moldura (o vidro é o vão): quatro barras (e uma travessa no meio, se `meio`)."""
    th = math.radians(ang)
    dx, dy = math.cos(th), math.sin(th)
    md = mat_d or mat
    P = lambda s: (H[0] + s * dx, H[1] + s * dy)
    CA.porta_giro(H, ang, W, z0, z0 + barra, mat, md, esp=esp, lado=lado, mat_b=md)
    CA.porta_giro(H, ang, W, z1 - barra, z1, mat, md, esp=esp, lado=lado, mat_b=md)
    CA.porta_giro(H, ang, barra, z0, z1, mat, md, esp=esp, lado=lado, mat_b=md)
    CA.porta_giro(P(W - barra), ang, barra, z0, z1, mat, md, esp=esp, lado=lado, mat_b=md)
    if meio:
        zm = (z0 + z1) / 2
        CA.porta_giro(H, ang, W, zm - barra / 2, zm + barra / 2, mat, md, esp=esp, lado=lado, mat_b=md)


GARRAFAS = [('#2a5a38', '#68b484'), ('#5a3220', '#c08a5c'), ('#2e5a40', '#74bc94'), ('#6a2a2e', '#d4706a'), ('#3a5a3a', '#86c894'),
            ('#6a4a2a', '#dca862')]


def adega(aberta=False):
    """
    A adega climatizada (2,1 m): o armário de nogueira escura com a luz quente de LED em cima, cinco prateleiras
    cheias de garrafas deitadas (os fundos virados para a frente, verde, âmbar e vinho), o visor azul do termostato e as
    duas portas de vidro com a moldura de nogueira e o puxador dourado (aberta: as folhas giradas para fora).
    """
    x0, x1 = 0.04, 1.46
    y0, y1 = 0.06, 0.69
    zt = 2.1
    e = 0.07
    FORA = mad2(NOZ, eixo=1, seed=451, passo=0.05)
    IN = CA.dentro('#3c2412', 0.2, 1.95)
    CA_ = mad2(NOZ_E, seed=452, passo=0.04)
    cx((x0 + 0.04, x1 - 0.04, y0 + 0.04, y1 - 0.06, 0.0, 0.1), CA_)
    # a carcaça aberta na frente: o fundo, as laterais e o chão
    CA.casca(x0, x1, y0, y1 - 0.02, 0.1, zt - 0.14, e, FORA, IN, mad2(NOZ_E, seed=453, passo=0.05), fundo=liso('#3a2010'))
    # a cornija (dois degraus com o filete de ouro) e o frontão
    cx((x0 - 0.02, x1 + 0.02, y0 - 0.01, y1 + 0.02, zt - 0.14, zt - 0.1), _pau('#5a3420', '#8a5a36', quina=1.2, b=(0, 0, 0, 0, zt - 0.14, zt - 0.1)))
    cx((x0 - 0.04, x1 + 0.04, y0 - 0.015, y1 + 0.04, zt - 0.1, zt), {'cima': tab2(NOZ_T, 0.2, '#2a160a', seed=454, org=y0), '*': _pau('#5a3420', '#8a5a36', quina=1.25, b=(0, 0, 0, 0, zt - 0.1, zt))})
    cx((x0 - 0.04, x1 + 0.04, y1 + 0.04, y1 + 0.046, zt - 0.075, zt - 0.045), ouro((0, 0, 0, 0, 0, 1)), contorno=False)
    # a luz de LED (a faixa quente embaixo da cornija) e o visor do termostato
    o = cx((x0 + e, x1 - e, y0 + 0.1, y1 - 0.06, zt - 0.17, zt - 0.14), liso('#fbe8b8'), contorno=False)
    CZ.luzes.add(o)
    # as prateleiras com as garrafas deitadas (o fundo da garrafa para a frente)
    zs = [0.3, 0.62, 0.94, 1.26, 1.58]
    bx0, bx1 = x0 + e + 0.02, x1 - e - 0.02
    n = 8
    pas = (bx1 - bx0) / n
    for ki, z in enumerate(zs):
        cx((x0 + e, x1 - e, y0 + e, y1 - 0.04, z - 0.025, z), {'cima': liso('#3c2412'), '*': _pau('#5a3420', '#8a5a36', quina=1.3, b=(0, 0, 0, 0, z - 0.025, z))})
        for k in range(n):
            if ki == 4 and k in (3, 4):
                continue
            c_, c_l = GARRAFAS[(k + ki * 2) % len(GARRAFAS)]
            xc = bx0 + pas * (k + 0.5)
            o = novo()
            ES.cil_eixo((xc, y0 + e + 0.02, z + 0.037), (xc, y1 - 0.075, z + 0.037), 0.037, _p1_mat_rampa(_p1_rampa(_ramp(c_, c_l)), 1.6, 8.8),
                        o, lados=10, tampa_mat=liso(_mix(c_, '#000000', 0.15)), tampa0=False)
            # o aro do fundo (o vidro mais grosso) e o ponto de luz
            o2 = novo(contorno=False)
            ES.cil_eixo((xc, y1 - 0.082, z + 0.037), (xc, y1 - 0.075, z + 0.037), 0.028, liso(_mix(c_l, '#ffffff', 0.25)), o2, lados=8, tampa0=False)
    # as garrafas de cima, em pé, com a rolha de ouro (a prateleira de exposição)
    for k, xx in enumerate((0.3, 0.52, 0.74, 0.96, 1.18)):
        c_, c_l = GARRAFAS[k % len(GARRAFAS)]
        _garrafa_bar(xx, y0 + 0.3, zs[4] + 0.0 if False else 1.84 - 0.0, 0.3, 0.034, c_)
    cx((x0 + e, x1 - e, y0 + e, y1 - 0.04, 1.84 - 0.025, 1.84), {'cima': liso('#3c2412'), '*': _pau('#5a3420', '#8a5a36', quina=1.3, b=(0, 0, 0, 0, 1.815, 1.84))})
    # o visor azul do termostato (num dos montantes)
    ov = cx((x1 - e - 0.12, x1 - e - 0.04, y1 - 0.06, y1 - 0.045, 1.9, 1.94), liso('#58d0ff'), contorno=False)
    CZ.luzes.add(ov)
    # as portas de vidro: a moldura de nogueira e o vidro (o vão, tingido)
    meio = (x0 + x1) / 2
    Wd = meio - x0
    zd0, zd1 = 0.12, zt - 0.17
    if not aberta:
        PT = mad2(NOZ, eixo=1, seed=455, passo=0.04)
        b_ = 0.045
        yb = y1 - 0.01
        for (a0, a1) in ((x0 + 0.004, meio - 0.004), (meio + 0.004, x1 - 0.004)):
            for bb in ((a0, a0 + b_, yb, yb + 0.026, zd0, zd1), (a1 - b_, a1, yb, yb + 0.026, zd0, zd1),
                       (a0, a1, yb, yb + 0.026, zd0, zd0 + b_), (a0, a1, yb, yb + 0.026, zd1 - b_, zd1),
                       (a0, a1, yb, yb + 0.026, 0.96, 0.96 + 0.03)):
                cx(bb, {'*': PT, 'frente': PT, 'cima': liso('#6e4228')}, contorno=True)
            CZ.vidros.append((a0 + b_, a1 - b_, yb - 0.01, yb + 0.03, zd0 + b_, zd1 - b_))
        for xx in (meio - 0.07, meio + 0.07):
            cx((xx - 0.012, xx + 0.012, yb + 0.026, yb + 0.05, 0.9, 1.22), ouro((0, 0, 0, 0, 0.9, 1.22)))
    else:
        PT = mad2('#6a4228', eixo=1, seed=455, passo=0.04)
        for (lado, Hx, ang) in ((1, x0 + 0.004, 105), (-1, x1 - 0.004, 180 - 105)):
            folha_moldura((Hx, y1 - 0.01), ang, Wd - 0.01, zd0, zd1, lado, PT, mad2('#3a2010', seed=456), barra=0.055, esp=0.034, meio=True)
    peg(x0, x1, y0, y1)


def _mix(a, b, t):
    return hexn(hx(a) * (1 - t) + hx(b) * t)


def _ramp(c1, c2, n=10):
    """Uma rampa de 10 tons do escuro (c1 bem escurecido) ao claro (c2)."""
    a, b = hx(c1) * 0.55, hx(c2)
    return [hexn(a + (b - a) * (i / (n - 1)) ** 1.1) for i in range(n)]


# =====================================================================================================================
# o closet aberto (2 x 1, 2,2 m): portas de madeira clara com espelho; aberto: ternos, vestidos, sapatos e gavetas
# =====================================================================================================================
def _cabide(x, y, zr, ln, cor, larg=0.07, prof=0.26, terno=False, camisa=None):
    """A peça pendurada na barra: o ombro, o corpo caindo; (terno: a lapela clara e o botão; camisa: o colarinho branco)."""
    o = novo()
    cx((x - larg / 2, x + larg / 2, y - prof / 2, y + prof / 2, zr - ln, zr - 0.035), {'*': liso(cor), 'dir': liso(_mix(cor, '#000000', 0.18)),
                                                                                         'cima': liso(_mix(cor, '#ffffff', 0.1))}, oid=o)
    cx((x - larg / 2 - 0.004, x + larg / 2 + 0.004, y - prof / 2 - 0.004, y + prof / 2 + 0.004, zr - 0.075, zr - 0.035), {'*': liso(_mix(cor, '#ffffff', 0.08))}, oid=o)
    if camisa:
        cx((x - larg / 2 + 0.004, x + larg / 2 - 0.004, y + prof / 2 - 0.004, y + prof / 2 + 0.006, zr - 0.2, zr - 0.04), liso(camisa), contorno=False)
    # o gancho do cabide
    cx((x - 0.006, x + 0.006, y - 0.006, y + 0.006, zr - 0.04, zr + 0.01), liso('#b8902a'), contorno=False)


def closet_aberto(aberto=False):
    """
    O closet embutido (2,2 m) de madeira clara: fechado, as duas portas com o espelho alto e o friso de ouro; aberto, as
    portas giradas e o interior iluminado: à esquerda os ternos e camisas na barra com as prateleiras de sapatos,
    à direita os vestidos longos, e embaixo as três gavetas com puxadores de ouro.
    """
    x0, x1 = 0.04, 1.46
    y0, y1 = 0.05, 0.69
    zt = 2.2
    zc = zt - 0.14
    zg = 0.5
    meio = (x0 + x1) / 2
    FORA = mad2(CARV, eixo=1, seed=461, passo=0.06, claro=1.08)
    pain = []
    for (u0, u1) in ((x0 + 0.04, meio - 0.008), (meio + 0.008, x1 - 0.04)):
        pain.append((u0, u1, zg + 0.02, zc - 0.04, 'g'))
        pain.append((u0 + 0.06, u1 - 0.06, zg + 0.12, zc - 0.14, 'e'))
    gav = [(x0 + 0.04, x1 - 0.04, 0.14, 0.26, 'g'), (x0 + 0.04, x1 - 0.04, 0.28, 0.4, 'g')]
    cx((x0 + 0.04, x1 - 0.04, y0 + 0.02, y1 - 0.04, 0.0, 0.12), mad2('#7a5a38', seed=462, passo=0.04))
    if not aberto:
        cx((x0, x1, y0, y1, 0.12, zc), {'frente': CA.almofadas(CARV, gav + pain, eixo=1, seed=463, passo=0.06),
                                        'costas': tab2(CA.PINHO, 0.15, '#6a4426', eixo=1, seed=464),
                                        '*': FORA, 'cima': liso('#a88458')})
        for xx in (meio - 0.05, meio + 0.05):
            cx((xx - PH, xx + PH, y1, y1 + 0.022, 1.0, 1.3), ouro((0, 0, 0, 0, 1.0, 1.3)), contorno=False)
        for xa in ((x0 + x1) / 2 - 0.2, (x0 + x1) / 2 + 0.2):
            CA.alca(xa, 0.27 - 0.0, y1, 0.07)
            CA.alca(xa, 0.41 - 0.0, y1, 0.07)
    else:
        e = 0.04
        IN = CA.dentro('#8a6a44', 0.16, zc)
        CA.casca(x0, x1, y0, y1, 0.12, zc, e, FORA, IN, tab2(CA.PINHO, 0.15, '#6a4426', eixo=1, seed=464), fundo=liso('#7a5a38'))
        cx((x0, x1, y0, y1, zc - e, zc), {'baixo': IN, 'cima': liso('#a88458'), '*': FORA})
        # o bloco das gavetas embaixo (fechadas) com o tampo (as prateleiras de sapato ficam dos dois lados do vão)
        cx((x0 + e, x1 - e, y0 + e, y1, 0.12, zg), {'frente': CA.almofadas(CARV, gav, eixo=1, seed=463, passo=0.06), 'cima': liso('#8a6a44'), '*': FORA})
        for xa in (meio - 0.2, meio + 0.2):
            CA.alca(xa, 0.27, y1, 0.07)
            CA.alca(xa, 0.41, y1, 0.07)
        # o divisor do meio
        cx((meio - 0.012, meio + 0.012, y0 + e, y1 - 0.02, zg, zc - e), {'*': FORA, 'dir': liso('#8a6a44'), 'esq': liso('#a07c52')})
        # a luz do closet (a faixa quente no teto)
        ol = cx((x0 + e, x1 - e, y0 + 0.12, y1 - 0.1, zc - e - 0.012, zc - e), liso('#fff0c8'), contorno=False)
        CZ.luzes.add(ol)
        # as barras de latão e a roupa: ternos e camisas à esquerda, vestidos à direita
        zr = zc - 0.2
        for (a0, a1) in ((x0 + e, meio - 0.014), (meio + 0.014, x1 - e)):
            cx((a0, a1, y0 + 0.28, y0 + 0.3, zr, zr + 0.022), ouro((0, 0, 0, 0, zr, zr + 0.022)), contorno=False)
        L = [('#1c2236', 0.82, '#f2efe8'), ('#2a2a2e', 0.84, '#f2efe8'), ('#1a1a1c', 0.82, '#e8e4dc'), ('#3a3e4c', 0.8, '#f2efe8'),
             ('#e8e4dc', 0.62, None), ('#7aa0c0', 0.62, None), ('#e8e4dc', 0.6, None)]
        for k, (cc, ln, cam) in enumerate(L):
            _cabide(x0 + e + 0.07 + k * 0.083, y0 + 0.29, zr, ln, cc, 0.058, 0.26, camisa=cam)
        V = [('#6a1a24', 1.25), ('#1f3a2a', 1.3), ('#e0cfb0', 1.2), ('#1a1a1e', 1.28), ('#3a2a5a', 1.22), ('#a8443a', 1.26)]
        for k, (cc, ln) in enumerate(V):
            _cabide(meio + 0.014 + 0.065 + k * 0.088, y0 + 0.29, zr, ln, cc, 0.07, 0.22)
        # as prateleiras de sapatos, à esquerda embaixo da roupa (dois níveis com os pares de sapato)
        for zsap in (zg + 0.0, zg + 0.34):
            if zsap > zg:
                cx((x0 + e, meio - 0.014, y0 + e, y1 - 0.06, zsap - 0.02, zsap), {'cima': liso('#a88458'), '*': FORA})
            for k in range(4):
                xx = x0 + e + 0.06 + k * 0.15
                cor = ['#2a1a12', '#7a4a28', '#1a1a1c', '#5a2a1c'][k]
                cx((xx, xx + 0.06, y0 + 0.2, y0 + 0.44, zsap, zsap + 0.05), {'*': liso(cor), 'cima': liso(_mix(cor, '#ffffff', 0.18))})
                cx((xx, xx + 0.06, y0 + 0.36, y0 + 0.44, zsap + 0.05, zsap + 0.075), {'*': liso(cor), 'cima': liso(_mix(cor, '#ffffff', 0.18))})
        # as portas abertas: a esquerda mostra a face de dentro, a direita o espelho de fora
        zf0, zf1 = zg + 0.02, zc - 0.04
        Wp = meio - x0
        for (lado, Hx, ang) in ((1, x0, 128), (-1, x1, 180 - 128)):
            H = (Hx, y1)
            pd = [(0.04, Wp - 0.04, zf0, zf1, 'g'), (0.1, Wp - 0.1, zf0 + 0.1, zf1 - 0.1, 'e')]
            CA.porta_giro(H, ang, Wp, zf0, zf1, CA.mat_folha(CARV, pd, H, ang, seed=461), CA.mat_folha('#a88458', [(0.04, Wp - 0.04, zf0, zf1, 'g')], H, ang, seed=466),
                          lado=lado, mat_b=FORA)
    cx((x0 - 0.02, x1 + 0.02, y0 - 0.01, y1 + 0.02, zc, zc + 0.04), _pau('#a88458', quina=1.2, b=(0, 0, 0, 0, zc, zc + 0.04)))
    cx((x0 - 0.04, x1 + 0.04, y0 - 0.015, y1 + 0.04, zc + 0.04, zt), {'cima': tab2(CARV_T, 0.2, '#6a4a2a', seed=465, org=y0), '*': _pau('#b08a5c', quina=1.2, b=(0, 0, 0, 0, zc + 0.04, zt))})
    cx((x0 - 0.04, x1 + 0.04, y1 + 0.04, y1 + 0.046, zc + 0.01, zc + 0.03), ouro((0, 0, 0, 0, 0, 1)), contorno=False)
    peg(x0, x1, y0, y1)


# =====================================================================================================================
# OS ITENS DE PAREDE: a moldura dourada trabalhada e as pinturas
# =====================================================================================================================
def moldura_ouro(x0, x1, z0, z1, e=0.075, fundo=0.06, cantos=True, coroa=False):
    """
    O quadro de moldura dourada trabalhada: a pintura rebaixada atrás (a sombra da moldura em cima e à esquerda), a moldura
    larga em três faixas (o filete claro de fora, o corpo, o filete escuro por dentro), as rosetas nos quatro cantos e no
    meio dos lados maiores e, se `coroa`, o remate entalhado em cima.
    """
    n0 = len(C().objs)
    return n0


def quadro_ouro(x0, x1, z0, z1, pintor, e=0.075, fundo=0.06, coroa=False):
    n0 = len(C().objs)
    ez = e * KX / KZ
    pl = PC.Pl(x0 + e - PH, x1 - e + PH, z0 + ez - PZ, z1 - ez + PZ, 0.015)
    W, H = (x1 - x0 - 2 * e) * KX, (z1 - z0 - 2 * ez) * KZ
    pl.u, pl.w = pl.u - 1, pl.w - 1
    pintor(pl, W, H)
    m = pl.opaco()
    # a sombra da moldura sobre a tela (em cima e à esquerda) e o filete escuro de dentro
    pl.rgb[m & (pl.w < 1)] = _tom(pl.rgb[m & (pl.w < 1)], 0.62)
    pl.rgb[m & (pl.w >= 1) & (pl.w < 2)] = _tom(pl.rgb[m & (pl.w >= 1) & (pl.w < 2)], 0.82)
    pl.rgb[m & (pl.u < 1)] = _tom(pl.rgb[m & (pl.u < 1)], 0.7)
    pl.rgb[m & (pl.u >= 1) & (pl.u < 2)] = _tom(pl.rgb[m & (pl.u >= 1) & (pl.u < 2)], 0.86)
    pl.grava()
    # a moldura: as quatro réguas com as faixas e, por cima, o friso de contas na faixa do meio
    PC.moldura(x0, x1, z0, z1, e, fundo, PC.MOL_DOURADA)
    # o friso entalhado: uma fileira de contas (blocos de 1 px alternados) no meio da faixa larga
    ouro_c = OURO_L
    yb = fundo
    ey = e * 0.5
    for (a0, a1, b0, b1) in ((x0 + e * 0.36, x1 - e * 0.36, z1 - ez * 0.62, z1 - ez * 0.38), (x0 + e * 0.36, x1 - e * 0.36, z0 + ez * 0.38, z0 + ez * 0.62)):
        k = int((a1 - a0) / (2 * PH))
        for i in range(0, k, 2):
            cx((a0 + i * 2 * PH, a0 + (i + 1) * 2 * PH, yb, yb + 0.006, b0, b1), liso('#fff0a8'), contorno=False)
    for (a0, a1) in ((x0 + e * 0.36, x0 + e * 0.64), (x1 - e * 0.64, x1 - e * 0.36)):
        k = int((z1 - z0 - 2 * ez) / (2 * PZ))
        for i in range(0, k, 2):
            cx((a0, a1, yb, yb + 0.006, z0 + ez + i * 2 * PZ, z0 + ez + (i + 1) * 2 * PZ), liso('#fff0a8'), contorno=False)
    # as rosetas dos cantos (blocos de ouro que saem mais, com o miolo claro) e do meio dos lados
    def roseta(xc, zc, r=0.07):
        cx((xc - r, xc + r, 0.0, yb + 0.022, zc - r * KX / KZ, zc + r * KX / KZ), {'*': ouro(), 'cima': liso(OURO_L), 'frente': ouro_roseta(xc, zc, r)}, ch=0.012)
    for (xx, zz) in ((x0 + e * 0.5, z0 + ez * 0.5), (x1 - e * 0.5, z0 + ez * 0.5), (x0 + e * 0.5, z1 - ez * 0.5), (x1 - e * 0.5, z1 - ez * 0.5)):
        roseta(xx, zz, 0.058)
    xm, zm = (x0 + x1) / 2, (z0 + z1) / 2
    roseta(xm, z1 - ez * 0.5, 0.05)
    roseta(xm, z0 + ez * 0.5, 0.05)
    if coroa:
        # o remate de cima: a concha com as duas volutas
        cx((xm - 0.16, xm + 0.16, 0.0, yb + 0.012, z1, z1 + 0.034), {'*': ouro(), 'cima': liso(OURO_L)}, ch=0.01)
        cx((xm - 0.09, xm + 0.09, 0.0, yb + 0.02, z1 + 0.034, z1 + 0.07), {'*': ouro(), 'cima': liso(OURO_L)}, ch=0.01)
        cx((xm - 0.03, xm + 0.03, 0.0, yb + 0.026, z1 + 0.07, z1 + 0.1), {'*': ouro(), 'cima': liso(OURO_L)}, ch=0.01)
    PC.sombra_parede(n0, 1, 2)


def ouro_roseta(xc, zc, r):
    """A frente da roseta: o ouro com o miolo claro (uma flor de quatro pétalas em quadradinhos)."""
    om, oc, oe = hx(OURO), hx(OURO_L), hx(OURO_E)

    def f(L, n, P):
        a = (P[:, 0] - xc) / PH
        b = (P[:, 2] - zc) / PZ
        out = np.tile(om, (len(P), 1))
        out = np.where((((np.abs(a) < 1.2) & (np.abs(b) < 2.4)) | ((np.abs(a) < 2.4) & (np.abs(b) < 1.2)))[:, None], oc, out)
        out = np.where((np.abs(a) + np.abs(b) > 4.6)[:, None], _tom(om, 0.86), out)
        return BE._cru(out, n)
    return emissivo(f)


# ---------- as pinturas: a caixa de ferramentas ----------
_spr = PC._spr


def _bandas(pl, m, w0, w1, cores):
    n = len(cores)
    for k, c in enumerate(cores):
        a = w0 + (w1 - w0) * k / n
        b = w0 + (w1 - w0) * (k + 1) / n
        pl.pin(m & (pl.w >= a) & (pl.w < b), c)


def _ruido_px(pl, sal=0.0, esc=1):
    """O ruído por pixel da grade da tela (para as quebras de cor em blocos)."""
    return ruido(np.floor(pl.u / esc), np.floor(pl.w / esc), sal)


def _esfera(pl, cu, cw, r, cor, rz=None, spec=True):
    """A bola com a luz de cima e da esquerda em degraus (a fruta, a bola de vidro): 4 tons e um brilho."""
    rz = rz or r
    m = pl.elipse(cu, cw, r, rz)
    du, dw = (pl.u - cu) / r, (pl.w - cw) / rz
    d = -(du * 0.55 + dw * 0.75)
    c0 = hx(cor) if isinstance(cor, str) else np.asarray(cor, float)
    pl.pin(m, hexn(_tom(c0, 0.96)))
    pl.pin(m & (d > 0.35), hexn(_tom(c0, 1.16)))
    pl.pin(m & (d < -0.2), hexn(_tom(c0, 0.78)))
    pl.pin(m & (d < -0.62), hexn(_tom(c0, 0.6)))
    if spec:
        pl.pin(pl.elipse(cu - r * 0.38, cw - rz * 0.42, max(0.7, r * 0.2), max(0.6, rz * 0.18)), hexn(_tom(c0, 1.7)))
    return m


def _pinheiro(pl, cu, base, h, larg, cor='#13211a', luz='#27412f'):
    """O pinheiro escuro em três andares de saia, com o lado da luz (a direita) um tom acima."""
    tiers = 3
    for k in range(tiers):
        y1 = base - h * (k / tiers) * 0.82
        y0 = base - h * ((k + 1.15) / tiers) * 0.82 - h * 0.1 * (k == tiers - 1)
        wd = larg * (1 - 0.28 * k) / 2
        m = pl.poli([(cu - wd, y1), (cu + wd, y1), (cu, y0)])
        pl.pin(m, cor)
        pl.pin(m & (pl.u > cu + wd * 0.1 * 0 + 0.4), luz)
    pl.pin(pl.ret(cu - 0.6, base, cu + 0.6, base + 2), '#2a1c14')


def p_lago(pl, W, H):
    """A paisagem com o lago ao entardecer: o céu em degraus do violeta ao ouro, o sol baixo, as montanhas, o espelho d'água."""
    t = pl.dentro
    hz = H * 0.44
    ceu = ['#2c3870', '#3a4580', '#4c4c8a', '#645694', '#80609c', '#a46c9c', '#c8809a', '#e6948e', '#f4ac84', '#fbc890', '#fee0a4']
    _bandas(pl, t, 0, hz + 1, ceu)
    sx = W * 0.64
    pl.pin(t & pl.elipse(sx, hz + 1, 8.5, 6.4) & (pl.w < hz + 1), '#f6b888')
    pl.pin(t & pl.elipse(sx, hz + 1, 6.0, 4.6) & (pl.w < hz + 1), '#fad196')
    pl.pin(t & pl.elipse(sx, hz + 1, 3.6, 3.2) & (pl.w < hz + 1), '#fff2c0')
    # as nuvens: finas, a luz por baixo (rosa e laranja)
    for (cu, cw, rx, ry, c1, c2) in ((W * 0.22, hz * 0.38, 13, 1.7, '#9a6a9a', '#d68a98'), (W * 0.5, hz * 0.2, 10, 1.4, '#7a5a9a', '#c07a9e'),
                                     (W * 0.84, hz * 0.52, 11, 1.6, '#e8847c', '#fcb488'), (W * 0.4, hz * 0.62, 8, 1.2, '#d87c88', '#f6a488')):
        m = t & pl.elipse(cu, cw, rx, ry)
        pl.pin(m, c1)
        pl.pin(m & (pl.w > cw - 0.1), c2)
    # as montanhas ao longe (duas fileiras, a de trás mais clara e azulada)
    r1 = hz - 6.5 - 3.2 * np.sin(pl.u / 7.0 + 1.0) - 1.6 * np.sin(pl.u / 3.3) - np.where(pl.u < W * 0.28, 2.5 * (1 - pl.u / (W * 0.28)), 0)
    m1 = t & (pl.w >= r1) & (pl.w < hz + 1)
    pl.pin(m1, '#6a5c92')
    pl.pin(m1 & (pl.w < r1 + 1.1), '#8a74a2')
    r2 = hz - 2.6 - 2.4 * np.sin(pl.u / 5.5 + 3.0) - 1.1 * np.sin(pl.u / 2.4 + 1)
    m2 = t & (pl.w >= r2) & (pl.w < hz + 1)
    pl.pin(m2, '#463e72')
    pl.pin(m2 & (pl.w < r2 + 1.0), '#625486')
    # o lago: o espelho do céu (as faixas voltam, escurecendo para baixo), as ondas e a trilha do sol
    lago = t & (pl.w >= hz + 1)
    ag = ['#f0b682', '#e8a082', '#c88890', '#a0709a', '#7a5e92', '#58508a', '#40447a', '#323a6c', '#2a3260', '#222a54']
    _bandas(pl, lago, hz + 1, H, ag)
    # a trilha do sol: faixa clara quebrada em segmentos
    for v in range(int(hz) + 2, int(H)):
        larg = 1.2 + (v - hz) * 0.1
        seg = _ruido_px(pl, 3.0 + v, 3) > 0.42
        pl.pin(lago & (np.floor(pl.w) == v) & (np.abs(pl.u - sx) < larg) & seg, '#fde8ac' if v < hz + 8 else '#f0c88e')
    # as ondas (riscas claras curtas e escuras curtas, em fileiras)
    for v in range(int(hz) + 3, int(H) - 1, 3):
        cl = _ruido_px(pl, 7.0 + v, 5) > 0.5
        lin = lago & (np.floor(pl.w) == v) & cl
        pl.rgb[lin & pl.opaco()] = _tom(pl.rgb[lin & pl.opaco()], 1.2)
        lin2 = lago & (np.floor(pl.w) == v + 1) & (_ruido_px(pl, 11.0 + v, 4) > 0.62)
        pl.rgb[lin2 & pl.opaco()] = _tom(pl.rgb[lin2 & pl.opaco()], 0.86)
    # a margem de baixo à esquerda (a terra escura) e os pinheiros
    contorno_banco = [(-1, hz + 3.2), (W * 0.2, hz + 4.2), (W * 0.34, hz + 8.0), (W * 0.45, H * 0.74), (W * 0.47, H + 1), (-1, H + 1)]
    banco = pl.poli(contorno_banco)
    pl.pin(banco, '#1d2a22')
    pl.pin(banco & ~pl.poli([(a, b + 1.2) for (a, b) in contorno_banco[:5]] + [(W * 0.47, H + 2), (-1, H + 2)]), '#3a4a36')
    base = H * 0.66
    _pinheiro(pl, W * 0.07, base - 0.5, H * 0.52, 11)
    _pinheiro(pl, W * 0.19, base + 1.5, H * 0.36, 8)
    _pinheiro(pl, W * 0.3, base + 3.5, H * 0.26, 7)
    pl.pin(t & (pl.w >= H - 6) & (pl.u < W * 0.4), '#141e18')
    # a ponta de terra à direita, com as árvores redondas
    pl.pin(t & (pl.u > W * 0.84) & (pl.w >= hz + 3.5 - np.clip((pl.u - W * 0.84) * 0.0, 0, 0)) & (pl.w < hz + 5.6), '#2a3a2e')
    for (cu, cw, rx, ry) in ((W * 0.91, hz - 0.2, 4.2, 3.6), (W * 0.97, hz + 0.6, 3.4, 3.0), (W * 0.86, hz + 1.2, 2.6, 2.4)):
        m = t & pl.elipse(cu, cw, rx, ry) & (pl.w < hz + 4)
        pl.pin(m, '#1a2c24')
        pl.pin(m & (pl.u < cu - rx * 0.2) & (pl.w < cw - ry * 0.2), '#2e4a3a')
    # o barquinho de vela no meio do lago
    bu, bw = W * 0.5, hz + 8.4
    pl.pin(pl.poli([(bu - 0.6, bw - 6.2), (bu - 0.6, bw - 0.6), (bu - 4.0, bw - 0.6)]), '#f2d8b4')
    pl.pin(pl.poli([(bu + 0.4, bw - 5.2), (bu + 0.4, bw - 0.6), (bu + 2.6, bw - 0.6)]), '#d8b090')
    pl.pin(pl.ret(bu - 4.4, bw - 0.2, bu + 3.2, bw + 0.9), '#2a1c18')
    pl.pin(pl.ret(bu - 3.4, bw + 1.0, bu + 2.2, bw + 1.9), '#6a4a58')


def p_caca(pl, W, H):
    """A caçada à raposa numa manhã de outono: a névoa, os bosques ruivos, os cavaleiros de casaca vermelha, os cães e a raposa."""
    t = pl.dentro
    hz = H * 0.5
    _bandas(pl, t, 0, hz + 2, ['#9aa8b4', '#aab6bc', '#bcc4c0', '#cecfc4', '#e0dccc', '#ece4d0'])
    # o sol pálido
    pl.pin(t & pl.elipse(W * 0.3, hz * 0.55, 5.2, 4.6), '#f0e6cc')
    pl.pin(t & pl.elipse(W * 0.3, hz * 0.55, 3.2, 3.0), '#fbf4de')
    # as colinas azuladas na névoa
    h1 = hz - 5 - 2.4 * np.sin(pl.u / 8 + 0.4) - 1.2 * np.sin(pl.u / 3.1)
    pl.pin(t & (pl.w >= h1) & (pl.w < hz + 3), '#9aa4a6')
    h2 = hz - 1.6 - 2.0 * np.sin(pl.u / 6 + 2.2) - 0.9 * np.sin(pl.u / 2.7)
    pl.pin(t & (pl.w >= h2) & (pl.w < hz + 4), '#7e8c7c')
    pl.pin(t & (pl.w >= h2) & (pl.w < h2 + 1), '#98a490')
    # o campo: faixas de pasto seco e verde, mais escuras para a frente
    campo = t & (pl.w >= hz + 2)
    _bandas(pl, campo, hz + 2, H, ['#8a8a4a', '#7e8444', '#70783c', '#62703a', '#566236', '#4a5630'])
    # as sebes e o muro de pedra ao fundo
    pl.pin(t & (pl.w >= hz + 2.2) & (pl.w < hz + 3.6) & (_ruido_px(pl, 2.0, 2) > 0.3), '#4e5a38')
    # os bosques ruivos: copas redondas de laranja, ferrugem e ouro (esquerda e direita)
    for (cu, cw, rx, ry) in ((4.0, hz - 3.5, 6.0, 7.0), (11.5, hz - 1.0, 5.0, 5.4), (W - 6, hz - 4.5, 6.4, 7.6), (W - 14, hz - 1.5, 5.0, 5.6), (W - 2, hz + 1.5, 4.0, 4.4)):
        m = t & pl.elipse(cu, cw, rx, ry)
        pl.pin(m, '#9a4a20')
        pl.pin(m & (pl.u < cu + rx * 0.3) & (pl.w < cw + ry * 0.2), '#c46a28')
        pl.pin(m & (pl.u < cu - rx * 0.1) & (pl.w < cw - ry * 0.3), '#e2943a')
        pl.pin(m & (_ruido_px(pl, 5.0, 2) > 0.8) & (pl.u < cu + rx * 0.3), '#f0b450')
        pl.pin(m & (pl.u > cu + rx * 0.35) & (pl.w > cw), '#6a3018')
        pl.pin(pl.ret(cu - 0.7, cw + ry * 0.7, cu + 0.7, hz + 4), '#3a261c')
    # a raposa fugindo para o bosque da esquerda (ruiva, ponta da cauda branca)
    RA = {'o': '#d2662a', 'O': '#a84a1c', 'w': '#f6ecd8', 'k': '#2a1a14', 'b': '#e8c8a0'}
    raposa = ["........oo.",
              "..wOOooooooO",
              "wwOoooooooOk",
              ".OOoobbboo..",
              "....k..k.k..",
              "...k..k..k.."]
    _spr(pl, 16, int(hz + 3.2), [r[::-1] for r in raposa], RA)
    # os cães: pontos brancos e castanhos correndo atrás da raposa
    CAO = {'w': '#f4ecdc', 'b': '#b06a34', 'k': '#2a1a14'}
    cao = [".wwbb.",
           "wwwwwb",
           ".k..k."]
    for (cu, cw) in ((30, hz + 7), (35, hz + 9.5), (26, hz + 10.5), (40, hz + 7.4)):
        _spr(pl, int(cu), int(cw), [r[::-1] for r in cao], CAO)
    # os cavaleiros de casaca vermelha, galopando para a esquerda (o cavalo baio, a calça branca, a cartola preta)
    CV = {'r': '#c42a22', 'R': '#8e1a18', 'k': '#16120e', 's': '#e8c49c', 'b': '#6a3a1c', 'B': '#8a5028', 'd': '#4a2814', 'w': '#f0e8d8', 'x': '#2a1a10'}
    cav = [
        "......kk.......",
        ".....kkkk......",
        "......ss.......",
        ".....rrrr......",
        "....rrRrrr.....",
        "....rrRrrr.....",
        ".....wwww......",
        "..bbbbBBBbbb.bb",
        ".bbBBBBBBBBbbbb",
        "bbbbbbbbbbbbbb.",
        "bb.dbbbbbbbd.bb",
        "b..d.d....d..d.",
        "...x..x...x..x.",
        "...x..x...x..x.",
    ]
    for (cu, cw) in ((W * 0.58, hz + 8.0), (W * 0.74, hz + 12.5), (W * 0.44, hz + 14.6)):
        _spr(pl, int(cu), int(cw - 10), [r[::-1] for r in cav], CV)
    # o gramado de frente com um pouco de relva clara (traços)
    for v in range(int(hz + 14), int(H) - 1, 3):
        pl.pin(t & (np.floor(pl.w) == v) & (_ruido_px(pl, 9.0 + v, 3) > 0.7), '#7a8a42')


def p_natureza_morta(pl, W, H):
    """A natureza-morta flamenga: o fundo escuro, a mesa de madeira, a fruteira de prata com maçãs, pêras e uvas, a garrafa e o cálice."""
    t = pl.dentro
    mesa = H * 0.66
    _bandas(pl, t, 0, mesa + 1, ['#1c1612', '#221a14', '#2a2018', '#32261c', '#3a2c20'])
    # a luz vem da esquerda: o clarão no fundo, a cortina vinho no canto
    pl.pin(t & pl.elipse(W * 0.3, H * 0.3, W * 0.28, H * 0.26) & (pl.w < mesa), '#3e3024')
    pl.pin(t & pl.elipse(W * 0.3, H * 0.3, W * 0.17, H * 0.16) & (pl.w < mesa), '#4a3a2a')
    cort = t & (pl.u > W * 0.82 + np.sin(pl.w / 3.0) * 1.4)
    pl.pin(cort & (pl.w < mesa), '#4a1a22')
    pl.pin(cort & (pl.w < mesa) & (np.floor(pl.u / 3) % 2 == 0), '#5c2230')
    # a mesa: o tampo em perspectiva, a borda da frente e a toalha dobrada
    pl.pin(t & (pl.w >= mesa), '#52331e')
    pl.pin(t & (pl.w >= mesa) & (pl.w < mesa + 1), '#82552e')
    pl.pin(t & (pl.w >= mesa + 4), '#3e2616')
    pl.pin(t & (pl.w >= mesa + 4) & (pl.w < mesa + 5), '#6a4426')
    pl.pin(t & (pl.w >= mesa + 1) & (pl.w < mesa + 4) & (np.floor((pl.u + pl.w) / 5) % 2 == 0), '#5e3c22')
    pl.pin(pl.poli([(W * 0.44, mesa + 0.6), (W * 0.9, mesa + 0.6), (W * 0.96, mesa + 4), (W * 0.4, mesa + 4)]), '#d8cfba')
    pl.pin(pl.poli([(W * 0.44, mesa + 0.6), (W * 0.9, mesa + 0.6), (W * 0.9, mesa + 1.6), (W * 0.44, mesa + 1.6)]), '#efe8d6')
    # a garrafa verde-escura (alta, ao fundo à esquerda) com o rótulo e a rolha
    gu = W * 0.17
    pl.pin(pl.ret(gu - 3.2, mesa - 15, gu + 3.2, mesa + 0.6), '#1a3a28')
    pl.pin(pl.poli([(gu - 3.2, mesa - 15), (gu - 1.1, mesa - 20), (gu + 1.1, mesa - 20), (gu + 3.2, mesa - 15)]), '#1a3a28')
    pl.pin(pl.ret(gu - 1.1, mesa - 24, gu + 1.1, mesa - 19), '#1a3a28')
    pl.pin(pl.ret(gu - 1.4, mesa - 25, gu + 1.4, mesa - 23), '#b8902a')
    pl.pin(pl.ret(gu - 2.2, mesa - 15, gu - 1.0, mesa), '#3e7a54')
    pl.pin(pl.ret(gu - 3.2, mesa - 11, gu + 3.2, mesa - 6), '#d8c8a0')
    pl.pin(pl.ret(gu - 2, mesa - 9.4, gu + 2, mesa - 7.6), '#7a2a24')
    pl.pin(pl.ret(gu + 1.6, mesa - 15, gu + 3.2, mesa + 0.6), '#10281c')
    # o cálice de cristal com o vinho (na frente da garrafa, à direita)
    cu0 = W * 0.34
    pl.pin(pl.poli([(cu0 - 3.4, mesa - 9.5), (cu0 + 3.4, mesa - 9.5), (cu0 + 2.2, mesa - 4.6), (cu0 - 2.2, mesa - 4.6)]), '#cfe0dc')
    pl.pin(pl.poli([(cu0 - 3.0, mesa - 6.6), (cu0 + 3.0, mesa - 6.6), (cu0 + 2.2, mesa - 4.6), (cu0 - 2.2, mesa - 4.6)]), '#8a1c2c')
    pl.pin(pl.ret(cu0 - 0.5, mesa - 4.6, cu0 + 0.5, mesa - 0.8), '#c4d8d4')
    pl.pin(pl.ret(cu0 - 3, mesa - 0.8, cu0 + 3, mesa + 0.3), '#c4d8d4')
    pl.pin(pl.ret(cu0 - 2.4, mesa - 9, cu0 - 1.6, mesa - 5.4), '#f2faf8')
    # a fruteira de prata (pé e taça) com maçãs, pêras e as uvas pendendo
    fu = W * 0.6
    pl.pin(pl.poli([(fu - 9, mesa - 6.4), (fu + 9, mesa - 6.4), (fu + 6.6, mesa - 2.2), (fu - 6.6, mesa - 2.2)]), '#a8aab0')
    pl.pin(pl.ret(fu - 9, mesa - 6.8, fu + 9, mesa - 5.6), '#d8dae0')
    pl.pin(pl.ret(fu - 1.2, mesa - 2.2, fu + 1.2, mesa - 0.2), '#8a8c92')
    pl.pin(pl.ret(fu - 4.2, mesa - 0.4, fu + 4.2, mesa + 0.7), '#a8aab0')
    pl.pin(pl.poli([(fu + 5, mesa - 6.2), (fu + 8.6, mesa - 6.2), (fu + 6.6, mesa - 2.4)]), '#7a7c84')
    pl.pin(pl.ret(fu - 9, mesa - 6.4, fu - 8.0, mesa - 5.4), '#fcfcff')
    for (a, b, r, c) in ((-4.8, -9.4, 3.8, '#c42a24'), (0.4, -10.4, 4.0, '#d2b030'), (5.0, -9.2, 3.6, '#b0261e'), (-1.6, -13.6, 3.6, '#84a032'), (2.6, -13.0, 3.2, '#c42a24')):
        _esfera(pl, fu + a, mesa + b, r, c)
    # a pêra amarela (o corpo em duas bolas)
    _esfera(pl, fu - 8.2, mesa - 8.4, 3.0, '#b8b440', rz=2.8)
    _esfera(pl, fu - 8.2, mesa - 11.4, 2.0, '#b8b440', rz=2.4, spec=False)
    # as uvas roxas: cacho de bolinhas pendendo da borda da fruteira para a mesa
    for k, (a, b) in enumerate(((7.0, -7.4), (9.0, -6.0), (8.0, -4.2), (10.2, -4.4), (9.2, -2.2), (7.0, -2.8), (10.8, -1.4), (8.4, -0.6))):
        _esfera(pl, fu + a + 1.4, mesa + b + 0.4, 1.9, '#5a2a6a', spec=(k % 2 == 0))
    pl.pin(pl.ret(fu + 6.4, mesa - 9.6, fu + 7.2, mesa - 6.6), '#4a3a1c')
    # a casca de limão em espiral, caída na toalha
    pl.pin(pl.seg((W * 0.74, mesa + 2.2), (W * 0.8, mesa + 2.6), 1.4), '#e8d048')
    pl.pin(pl.seg((W * 0.8, mesa + 2.6), (W * 0.84, mesa + 1.8), 1.2), '#c8b030')


# ---------- os retratos ----------
def _busto(cfg):
    def p(pl, W, H):
        t = pl.dentro
        bg = cfg['fundo']
        pl.pin(t, bg)
        d = np.hypot((pl.u - W / 2) / W, (pl.w - H * 0.38) / H)
        pl.pin(t & (d < 0.3) & (pl.w < H * 0.52), hexn(_tom(hx(bg), 1.16)))
        pl.pin(t & (d > 0.42), hexn(_tom(hx(bg), 0.8)))
        pl.pin(t & (d > 0.56), hexn(_tom(hx(bg), 0.64)))
        cu = W / 2 - 0.5
        hy = H * 0.35
        rx, ry = cfg.get('rx', W * 0.215), cfg.get('ry', H * 0.17)
        pele = hx(cfg['pele'])
        roupa = hx(cfg['roupa'])
        # o corpo (os ombros largos) e a luz
        sh = H * 0.64
        corpo = pl.poli([(cu - W * 0.52, H + 1), (cu - W * 0.5, H * 0.84), (cu - W * 0.38, sh + 2), (cu - W * 0.16, sh - 1), (cu + W * 0.16, sh - 1),
                         (cu + W * 0.38, sh + 2), (cu + W * 0.5, H * 0.84), (cu + W * 0.52, H + 1)])
        pl.pin(corpo, hexn(roupa))
        pl.pin(corpo & (pl.u > cu + W * 0.17), hexn(_tom(roupa, 0.78)))
        pl.pin(corpo & (pl.u < cu - W * 0.2) & (pl.w < H * 0.76), hexn(_tom(roupa, 1.2)))
        # o pescoço
        pl.pin(pl.ret(cu - rx * 0.46, hy + ry * 0.7, cu + rx * 0.46, sh + 2), hexn(_tom(pele, 0.86)))
        pl.pin(pl.ret(cu + rx * 0.05, hy + ry * 0.7, cu + rx * 0.46, sh + 2), hexn(_tom(pele, 0.7)))
        cfg['roupa_fn'](pl, W, H, cu, hy, rx, ry, sh)
        # a cabeça: pele em quatro tons
        cab = pl.elipse(cu, hy, rx, ry)
        pl.pin(cab, hexn(pele))
        d1 = ((pl.u - cu) * 0.6 + (pl.w - hy) * 0.8)
        pl.pin(cab & (d1 < -rx * 0.45), hexn(_tom(pele, 1.1)))
        pl.pin(cab & (pl.u > cu + rx * 0.42), hexn(_tom(pele, 0.84)))
        pl.pin(cab & (pl.u > cu + rx * 0.74), hexn(_tom(pele, 0.7)))
        pl.pin(cab & (pl.w > hy + ry * 0.8), hexn(_tom(pele, 0.84)))
        # as orelhas
        for s in (-1, 1):
            pl.pin(pl.elipse(cu + s * (rx + 0.2), hy + 0.8, 1.2, 2.0), hexn(_tom(pele, 0.9 if s < 0 else 0.74)))
        cfg['cabelo_fn'](pl, W, H, cu, hy, rx, ry)
        # o rosto: sobrancelhas, olhos, nariz e boca
        ol = hx(cfg.get('olho', '#1a1210'))
        sb = hx(cfg.get('sobr', cfg['cabelo']))
        for s in (-1, 1):
            ex = cu + s * rx * 0.42 + 0.3
            pl.pin(pl.ret(ex - 1.7, hy - 3.0, ex + 1.7, hy - 2.0), hexn(sb))
            pl.pin(pl.ret(ex - 1.3, hy - 1.0, ex + 1.3, hy + 0.4), '#f4ecdc')
            pl.pin(pl.ret(ex - 0.5 + (0.2 if s > 0 else 0), hy - 1.0, ex + 0.9 + (0.2 if s > 0 else 0), hy + 0.4), hexn(ol))
            pl.pin(pl.ret(ex - 1.5, hy - 1.4, ex + 1.5, hy - 0.9), hexn(_tom(pele, 0.72)))
        pl.pin(pl.ret(cu + 0.2, hy + 0.2, cu + 1.4, hy + 2.8), hexn(_tom(pele, 0.8)))
        pl.pin(pl.ret(cu - 0.8, hy + 0.4, cu + 0.2, hy + 2.2), hexn(_tom(pele, 1.14)))
        pl.pin(pl.ret(cu - 0.8, hy + 2.6, cu + 1.8, hy + 3.3), hexn(_tom(pele, 0.72)))
        cfg['boca_fn'](pl, W, H, cu, hy, rx, ry)
    return p


def _boca(cor='#8a3a30', larg=2.0):
    def f(pl, W, H, cu, hy, rx, ry):
        pl.pin(pl.ret(cu - larg, hy + 4.4, cu + larg, hy + 5.4), cor)
        pl.pin(pl.ret(cu - larg + 0.4, hy + 5.4, cu + larg - 0.4, hy + 5.9), hexn(_tom(hx(cor), 0.7)))
    return f


# o homem de 1930 (terno escuro, bigode)
def _roupa_homem30(pl, W, H, cu, hy, rx, ry, sh):
    pl.pin(pl.poli([(cu - 4.6, sh - 1), (cu + 4.6, sh - 1), (cu, sh + 12)]), '#ece6d6')
    pl.pin(pl.poli([(cu - 4.6, sh - 1), (cu - 2.0, sh - 1), (cu, sh + 3)]), '#d4ccb8')
    pl.pin(pl.poli([(cu - 11, sh + 1), (cu - 4.6, sh - 1), (cu - 1, sh + 12), (cu - 5, sh + 18), (cu - 12, sh + 6)]), '#2c3040')
    pl.pin(pl.poli([(cu + 11, sh + 1), (cu + 4.6, sh - 1), (cu + 1, sh + 12), (cu + 5, sh + 18), (cu + 12, sh + 6)]), '#1a1c28')
    pl.pin(pl.poli([(cu - 1.4, sh + 0.5), (cu + 1.4, sh + 0.5), (cu + 1.1, sh + 2.4), (cu - 1.1, sh + 2.4)]), '#7a1a26')
    pl.pin(pl.poli([(cu - 1.2, sh + 2.4), (cu + 1.2, sh + 2.4), (cu + 1.6, sh + 11), (cu, sh + 12.4), (cu - 1.6, sh + 11)]), '#7a1a26')
    pl.pin(pl.ret(cu - 1.2, sh + 3, cu - 0.2, sh + 10), '#a43040')
    pl.pin(pl.ret(cu - 11, sh + 9, cu - 8, sh + 10.2), '#f2eee2')


def _cabelo_homem30(pl, W, H, cu, hy, rx, ry):
    c = '#8a3418'
    m = pl.elipse(cu, hy - 1.0, rx + 0.7, ry + 0.6) & (pl.w < hy - ry * 0.35)
    pl.pin(m, c)
    pl.pin(m & (pl.u > cu + rx * 0.4), '#5e2410')
    pl.pin(pl.poli([(cu - 2.5, hy - ry - 0.6), (cu + 3.0, hy - ry - 0.6), (cu + 2.0, hy - ry + 2.4), (cu - 4.0, hy - ry + 1.4)]) & (pl.w < hy - ry * 0.55), '#b04a22')
    pl.pin(pl.seg((cu - 3.2, hy - ry + 0.6), (cu + 1.4, hy - ry - 0.6), 1.0), '#c45a2a')
    pl.pin(pl.ret(cu - rx - 0.7, hy - ry * 0.4, cu - rx + 0.8, hy + 1.2), c)
    pl.pin(pl.ret(cu + rx - 0.8, hy - ry * 0.4, cu + rx + 0.7, hy + 1.2), '#5e2410')


def _boca_bigode(pl, W, H, cu, hy, rx, ry):
    pl.pin(pl.poli([(cu - 4.0, hy + 3.6), (cu + 4.0, hy + 3.6), (cu + 3.0, hy + 4.8), (cu, hy + 4.2), (cu - 3.0, hy + 4.8)]), '#8a3418')
    pl.pin(pl.ret(cu - 1.8, hy + 5.2, cu + 1.8, hy + 6.0), '#7a3028')


# a mulher (vestido de gola alta, colar de pérolas)
def _roupa_mulher(pl, W, H, cu, hy, rx, ry, sh):
    pl.pin(pl.ret(cu - 4.0, hy + ry * 0.6, cu + 4.0, sh + 3), '#ece2c8')
    pl.pin(pl.ret(cu + 1.2, hy + ry * 0.6, cu + 4.0, sh + 3), '#cfc4a8')
    for v in range(int(hy + ry * 0.8), int(sh + 3), 2):
        pl.pin(pl.ret(cu - 4.0, v, cu + 4.0, v + 0.6), '#c8bc9e')
    pl.pin(pl.poli([(cu - 4.8, sh - 1), (cu + 4.8, sh - 1), (cu + 3.5, sh + 4), (cu - 3.5, sh + 4)]), '#e0d4b8')
    # o decote do vestido (um V pequeno de renda) e a gola alta: as pérolas em duas voltas
    for k in range(9):
        a = math.pi * (0.1 + 0.8 * k / 8)
        pl.pin(pl.ret(cu - 5.6 * math.cos(a) - 0.9, sh + 1.2 + 4.2 * math.sin(a) - 0.8, cu - 5.6 * math.cos(a) + 0.9, sh + 1.2 + 4.2 * math.sin(a) + 0.8), '#f8f4ec')
    for k in range(7):
        a = math.pi * (0.12 + 0.76 * k / 6)
        pl.pin(pl.ret(cu - 4.6 * math.cos(a) - 0.7, sh - 0.2 + 3.0 * math.sin(a) - 0.6, cu - 4.6 * math.cos(a) + 0.7, sh - 0.2 + 3.0 * math.sin(a) + 0.6), '#fcf8f0')
    pl.pin(pl.ret(cu - 1.0, sh + 4.4, cu + 1.0, sh + 6.2), '#c8a030')
    pl.pin(pl.ret(cu - 0.4, sh + 4.9, cu + 0.4, sh + 5.7), '#8a1a2a')


def _cabelo_mulher(pl, W, H, cu, hy, rx, ry):
    c = '#b84e1e'
    m = pl.elipse(cu, hy - 1.2, rx + 1.3, ry + 0.9) & (pl.w < hy - ry * 0.1)
    m2 = pl.ret(cu - rx - 1.4, hy - ry * 0.2, cu - rx + 0.6, hy + ry * 0.6) | pl.ret(cu + rx - 0.6, hy - ry * 0.2, cu + rx + 1.4, hy + ry * 0.6)
    pl.pin(m | m2, c)
    pl.pin((m | m2) & (pl.u > cu + rx * 0.3), '#8a3414')
    pl.pin(pl.elipse(cu, hy - ry - 2.2, 4.4, 3.2), c)
    pl.pin(pl.elipse(cu - 1.0, hy - ry - 2.8, 2.6, 1.6), '#d8743a')
    pl.pin(pl.seg((cu - rx + 1.0, hy - 3), (cu - 2.0, hy - ry + 0.8), 1.0), '#d8743a')
    pl.pin(pl.seg((cu + 2.0, hy - ry + 1.2), (cu + rx - 1.0, hy - 3.4), 1.0), '#d8743a')


# o menino (paletó escuro, camisa e gravata)
def _roupa_menino(pl, W, H, cu, hy, rx, ry, sh):
    pl.pin(pl.poli([(cu - 4.4, sh - 1), (cu + 4.4, sh - 1), (cu, sh + 11)]), '#f0ebde')
    pl.pin(pl.poli([(cu - 4.4, sh - 1), (cu - 1.6, sh - 1), (cu - 4.8, sh + 3.6)]), '#d4ccb8')
    pl.pin(pl.poli([(cu + 4.4, sh - 1), (cu + 1.6, sh - 1), (cu + 4.8, sh + 3.6)]), '#cfc6b0')
    pl.pin(pl.poli([(cu - 11, sh + 1), (cu - 4.4, sh - 1), (cu - 1, sh + 11), (cu - 5, sh + 16), (cu - 12, sh + 6)]), '#303a60')
    pl.pin(pl.poli([(cu + 11, sh + 1), (cu + 4.4, sh - 1), (cu + 1, sh + 11), (cu + 5, sh + 16), (cu + 12, sh + 6)]), '#1e2644')
    pl.pin(pl.poli([(cu - 1.2, sh + 0.5), (cu + 1.2, sh + 0.5), (cu + 1, sh + 2.4), (cu - 1, sh + 2.4)]), '#b02a2a')
    pl.pin(pl.poli([(cu - 1.0, sh + 2.4), (cu + 1.0, sh + 2.4), (cu + 1.5, sh + 9), (cu, sh + 10.4), (cu - 1.5, sh + 9)]), '#b02a2a')
    pl.pin(pl.ret(cu - 0.8, sh + 3, cu - 0.1, sh + 8), '#d85050')
    pl.pin(pl.ret(cu - 11, sh + 8, cu - 8, sh + 9.2), '#e8e4d8')


def _cabelo_menino(pl, W, H, cu, hy, rx, ry):
    c = '#d0682a'
    m = pl.elipse(cu, hy - 0.8, rx + 0.6, ry + 0.5) & (pl.w < hy - ry * 0.45)
    pl.pin(m, c)
    pl.pin(m & (pl.u > cu + rx * 0.35), '#a04a1e')
    pl.pin(m & (pl.u < cu - rx * 0.2) & (pl.w < hy - ry * 0.7), '#e88a48')
    pl.pin(pl.poli([(cu - 5.5, hy - ry * 0.45), (cu - 1.0, hy - ry * 0.45), (cu - 2.0, hy - ry * 0.05), (cu - 5.0, hy - ry * 0.3)]) & (pl.w < hy - ry * 0.2), c)
    pl.pin(pl.seg((cu - 5.0, hy - ry + 1.6), (cu + 2.0, hy - ry - 0.4), 1.0), '#f0a05a')
    pl.pin(pl.ret(cu - rx - 0.6, hy - ry * 0.4, cu - rx + 0.6, hy), c)
    pl.pin(pl.ret(cu + rx - 0.6, hy - ry * 0.4, cu + rx + 0.6, hy), '#a04a1e')


def _boca_menino(pl, W, H, cu, hy, rx, ry):
    pl.pin(pl.elipse(cu - rx * 0.55, hy + 2.8, 1.8, 1.1), '#e8a090')
    pl.pin(pl.elipse(cu + rx * 0.55, hy + 2.8, 1.8, 1.1), '#d08878')
    pl.pin(pl.ret(cu - 1.6, hy + 4.6, cu + 1.6, hy + 5.4), '#b04a40')
    pl.pin(pl.ret(cu - 1.2, hy + 4.6, cu + 0.2, hy + 4.9), '#d86a5a')


# o homem de barba (casaca preta do início do século)
def _roupa_homem_barba(pl, W, H, cu, hy, rx, ry, sh):
    pl.pin(pl.ret(cu - 4.8, hy + ry * 0.6, cu + 4.8, sh + 3), '#f0ece0')
    pl.pin(pl.ret(cu - 4.8, hy + ry * 0.6, cu - 3.4, sh + 3), '#fffcf0')
    pl.pin(pl.poli([(cu - 5, sh - 2), (cu + 5, sh - 2), (cu + 4, sh + 8), (cu, sh + 10), (cu - 4, sh + 8)]), '#f0ece0')
    pl.pin(pl.poli([(cu - 4.5, sh + 5), (cu + 4.5, sh + 5), (cu + 4.8, sh + 20), (cu, sh + 23), (cu - 4.8, sh + 20)]), '#6a6a74')
    pl.pin(pl.poli([(cu - 4.5, sh + 5), (cu - 2, sh + 5), (cu - 4.8, sh + 20)]), '#8a8a94')
    pl.pin(pl.poli([(cu, sh + 6), (cu + 4.5, sh + 5), (cu + 4.8, sh + 20), (cu, sh + 23)]), '#585862')
    pl.pin(pl.poli([(cu - 13, sh + 2), (cu - 5, sh - 2), (cu - 4.2, sh + 20), (cu - 8, sh + 24), (cu - 14, sh + 8)]), '#24242c')
    pl.pin(pl.poli([(cu + 13, sh + 2), (cu + 5, sh - 2), (cu + 4.2, sh + 20), (cu + 8, sh + 24), (cu + 14, sh + 8)]), '#101014')
    pl.pin(pl.poli([(cu - 2.6, sh + 0.6), (cu + 2.6, sh + 0.6), (cu + 2.6, sh + 3), (cu - 2.6, sh + 3)]), '#16161c')
    pl.pin(pl.ret(cu - 0.8, sh + 1.0, cu + 0.8, sh + 2.6), '#3a3a44')
    pl.seg  # (o correntão do relógio)
    pl.pin(pl.seg((cu - 2.0, sh + 12), (cu + 6.0, sh + 13.4), 1.0), '#d8b048')
    pl.pin(pl.ret(cu - 2.6, sh + 11.4, cu - 1.2, sh + 12.8), '#f0d070')
    pl.pin(pl.ret(cu - 4.6, sh + 6.4, cu - 3.6, sh + 7.4), '#e8c860')


def _cabelo_homem_barba(pl, W, H, cu, hy, rx, ry):
    c = '#b8704a'
    m = pl.elipse(cu, hy - 0.8, rx + 0.8, ry + 0.6) & (pl.w < hy - ry * 0.3)
    pl.pin(m, c)
    pl.pin(m & (pl.u > cu + rx * 0.4), '#8a4a2c')
    pl.pin(m & (pl.u < cu - rx * 0.3) & (pl.w < hy - ry * 0.55), '#d8a07a')
    pl.pin(pl.ret(cu - rx - 0.8, hy - ry * 0.5, cu - rx + 0.9, hy + ry * 0.2), c)
    pl.pin(pl.ret(cu + rx - 0.9, hy - ry * 0.5, cu + rx + 0.8, hy + ry * 0.2), '#8a4a2c')
    # a barba cheia (do começo das costeletas até depois do queixo)
    b = pl.elipse(cu, hy + ry * 0.35, rx + 0.4, ry * 0.9) & (pl.w > hy + 1.2)
    pl.pin(b | pl.ret(cu - rx - 0.5, hy - 1.0, cu - rx + 1.8, hy + 4), c)
    pl.pin(b & (pl.u > cu + rx * 0.3), '#9a5634')
    pl.pin(b & (pl.u < cu - rx * 0.4) & (pl.w > hy + 3), '#d8a07a')
    pl.pin(pl.poli([(cu - 5, hy + 3.2), (cu + 5, hy + 3.2), (cu + 3.6, hy + 4.8), (cu, hy + 4.2), (cu - 3.6, hy + 4.8)]), '#cc8a62')
    pl.pin(pl.ret(cu - 1.6, hy + 5.2, cu + 1.6, hy + 6.2), '#7a3a32')


def _boca_vazia(pl, W, H, cu, hy, rx, ry):
    pass


# os retratos da família: todos ruivos (23/10, o Felipe: "os quadros nas paredes têm que ser todos de pessoas ruivas")
RETRATOS = {
    1: dict(fundo='#2c3a30', pele='#dcb490', roupa='#202430', cabelo='#8a3418', sobr='#7a2e16', roupa_fn=_roupa_homem30, cabelo_fn=_cabelo_homem30, boca_fn=_boca_bigode),
    2: dict(fundo='#5a2a38', pele='#e8c4a4', roupa='#2c2a46', cabelo='#b84e1e', sobr='#9a4018', roupa_fn=_roupa_mulher, cabelo_fn=_cabelo_mulher, boca_fn=_boca('#a8404a', 1.8), rx=7.4),
    3: dict(fundo='#344a60', pele='#ecc4a0', roupa='#2a3254', cabelo='#d0682a', sobr='#b05424', roupa_fn=_roupa_menino, cabelo_fn=_cabelo_menino, boca_fn=_boca_menino, rx=7.8, ry=9.4),
    4: dict(fundo='#4a3624', pele='#d4aa86', roupa='#16161c', cabelo='#a85a36', sobr='#94502e', roupa_fn=_roupa_homem_barba, cabelo_fn=_cabelo_homem_barba, boca_fn=_boca_vazia),
}


def retrato_nobre(n=1, xc=1.5, zc=1.6):
    """O retrato a óleo de gente da família (1,0 x 1,2 m na parede): o busto sobre fundo escuro, na moldura dourada entalhada."""
    w, h = 1.0, 1.2
    quadro_ouro(xc - w / 2, xc + w / 2, zc - h / 2, zc + h / 2, _busto(RETRATOS[n]), e=0.075, fundo=0.06, coroa=False)


def quadro_oleo_grande(modelo=1, xc=1.5, zc=1.6):
    """O quadro a óleo grande (1,9 x 1,15 m na parede): a paisagem do lago, a caçada à raposa ou a natureza-morta."""
    w, h = 1.9, 1.15
    pint = {1: p_lago, 2: p_caca, 3: p_natureza_morta}[modelo]
    quadro_ouro(xc - w / 2, xc + w / 2, zc - h / 2, zc + h / 2, pint, e=0.085, fundo=0.065, coroa=True)


# =====================================================================================================================
# o espelho dourado (arco) e a janela com cortinas
# =====================================================================================================================
def espelho_dourado(xc=1.5, zc=1.6):
    """
    O espelho de moldura dourada em arco (0,8 x 1,15 m): a faixa de ouro larga com o friso de contas, o vidro azulado com os
    dois reflexos em diagonal, o remate de folhas e concha em cima e o aventalzinho entalhado embaixo.
    """
    n0 = len(C().objs)
    x0, x1 = xc - 0.4, xc + 0.4
    z0, zt = zc - 0.57, zc + 0.58
    za = zt - 0.4
    y1 = 0.055
    extruda_xz(arco_perfil(x0, x1, z0, za, zt, n=20), 0.0, y1,
               {'frente': espelho_arco_mat(x0, x1, z0, za, zt, b=0.075), 'cima': ouro(), 'lado': ouro(), 'costas': ouro()})
    # o remate de cima (a concha, as duas volutas) e o aventalzinho de baixo
    extruda_xz(oval_perfil(xc, zt + 0.02, 0.13, 0.065, 16), 0.0, y1 + 0.016, {'frente': ouro((0, 0, 0, 0, 0, 3), OURO_L), '*': ouro()})
    extruda_xz(oval_perfil(xc, zt + 0.075, 0.05, 0.05, 12), 0.0, y1 + 0.026, {'frente': liso(OURO_L), '*': ouro()})
    for s in (-1, 1):
        extruda_xz(oval_perfil(xc + s * 0.2, zt - 0.1, 0.06, 0.035, 12), 0.0, y1 + 0.01, {'*': ouro()})
        extruda_xz(oval_perfil(x0 if s < 0 else x1, zc + 0.05, 0.03, 0.08, 12), 0.0, y1 + 0.012, {'*': ouro()})
    extruda_xz(oval_perfil(xc, z0 - 0.005, 0.18, 0.045, 16), 0.0, y1 + 0.016, {'frente': ouro((0, 0, 0, 0, 0, 3), OURO_L), '*': ouro()})
    extruda_xz(oval_perfil(xc, z0 - 0.035, 0.04, 0.04, 10), 0.0, y1 + 0.02, {'frente': liso(OURO_L), '*': ouro()})
    PC.sombra_parede(n0, 1, 2)


JAN_FRAME = ('#8a826e', '#e6dec8', '#faf6e8', '#ffffff')
_VELUDO = ['#32080f', '#4a1019', '#661822', '#82242f', '#9e3441']


def _pano(pl, m, uloc, w, cx_, Hh, larg_dobra=4.0, idx0=0.0, tie_w=None, rampa=None):
    """O veludo pesado em dobras verticais: cinco tons em degraus (o fio claro na crista) e a sombra onde o pano é preso."""
    fase = (uloc - cx_) * (2 * math.pi / larg_dobra) + 1.7 * np.sin(w / 15.0 + idx0) + 0.6 * np.sin(uloc / 5.0)
    k = 0.5 + 0.5 * np.sin(fase)
    idx = np.floor(k * 4.99).astype(int)
    if tie_w is not None:
        idx = idx - ((np.abs(w - tie_w) < 3.2).astype(int))
    idx = idx - (w < 3).astype(int)
    idx = np.clip(idx, 0, 4)
    cores = np.stack([hx(c) for c in (rampa or _VELUDO)])
    pl.rgb[m] = cores[idx][m]
    pl.nv[m] = 255
    cr = m & (k > 0.94)
    pl.rgb[cr] = hx('#c4586a')


def _painel_cortina(pl, W, Hh, aberta, lado):
    """Uma folha de cortina no plano (u, w): aberta, presa ao lado por um laço dourado com borla; fechada, caída reta."""
    u = pl.u if lado < 0 else (W - pl.u)
    w = pl.w
    t = pl.dentro
    if aberta:
        tw = Hh * 0.56
        s = np.clip(w / tw, 0, 1)
        inner_top = 17.0 - 7.0 * (s * s * (3 - 2 * s))
        s2 = np.clip((w - tw) / (Hh - tw), 0, 1)
        inner = np.where(w < tw, inner_top, 10.0 + 10.0 * np.sin(s2 * math.pi / 2) ** 1.4)
        bord = t & (u >= -1) & (u < inner) & (w < Hh - 1 + 1.2 * np.sin(u * 0.9))
        _pano(pl, bord, u, w, 0.0, Hh, larg_dobra=3.6 + 2.6 * np.clip(w / Hh, 0, 1), idx0=lado, tie_w=tw)
        # o laço de ouro e a borla
        laco = bord & (np.abs(w - tw) < 1.3)
        pl.pin(laco, '#d8b048')
        pl.pin(laco & (np.abs(w - tw) < 0.5), '#f4d878')
        ub = 10.5
        pl.pin(pl.ret(ub - 1.6, tw + 1.2, ub + 1.6, tw + 4.0) if lado < 0 else pl.ret(W - ub - 1.6, tw + 1.2, W - ub + 1.6, tw + 4.0), '#d8b048')
        c0 = ub if lado < 0 else W - ub
        pl.pin(pl.ret(c0 - 2.0, tw + 4.0, c0 + 2.0, tw + 9.0), '#b8902a')
        pl.pin(pl.ret(c0 - 2.0, tw + 4.0, c0 - 1.0, tw + 9.0), '#e8c860')
        for k in (-1.5, -0.5, 0.5, 1.5):
            pl.pin(pl.ret(c0 + k - 0.1, tw + 9.0, c0 + k + 0.6, tw + 10.8), '#d8b048')
    else:
        inner = W * 0.5 + 1.6
        bord = t & (u >= -1) & (u < inner) & (w < Hh - 1 + 1.0 * np.sin(u * 0.8 + 1))
        _pano(pl, bord, u, w, 0.0, Hh, larg_dobra=4.4, idx0=lado * 2)
    return bord


def janela_cortinas(fechada=False, xc=1.5, zc=1.55):
    """
    A janela alta de duas folhas (moldura branca, vidro com a luz do dia, o peitoril de mármore) com as cortinas pesadas de
    veludo vinho e o bandô de babados com franja de ouro, sobre o varão. Aberta: as cortinas presas dos lados pelo laço de
    ouro com borla. Fechada: caídas retas até o chão da janela, com uma fresta de luz no meio.
    """
    n0 = len(C().objs)
    jx = 0.5
    wz0, wz1 = zc - 0.72, zc + 0.72
    # o peitoril de mármore
    cx((xc - jx - 0.07, xc + jx + 0.07, 0.0, 0.065, wz0 - 0.04, wz0), {'*': marmore(seed=9), 'cima': marmore(seed=10)}, ch=0.01)
    # o vidro (a luz do dia), atrás da moldura
    gl = PC.Pl(xc - jx + 0.05, xc + jx - 0.05, wz0 + 0.05, wz1 - 0.05, 0.012)
    gl.u, gl.w = gl.u - 1, gl.w - 1
    Wg, Hg = (2 * jx - 0.1) * KX, (wz1 - wz0 - 0.1) * KZ
    t = gl.dentro
    _bandas(gl, t, 0, Hg * 0.8, ['#6ea8dc', '#7eb6e4', '#92c4ea', '#a8d2ee', '#c0e0f2', '#d8eef8'])
    gl.pin(t & (gl.w >= Hg * 0.8 - 1.6 * np.sin(gl.u / 5.0) - 2), '#7ea85a')
    gl.pin(t & (gl.w >= Hg * 0.86 - 1.0 * np.sin(gl.u / 3.0 + 1)), '#5a8a46')
    gl.pin(t & (gl.w >= Hg * 0.93), '#46703a')
    for (cu, cw, rx, ry) in ((Wg * 0.28, Hg * 0.2, 7, 2.0), (Wg * 0.72, Hg * 0.36, 8, 2.2), (Wg * 0.5, Hg * 0.58, 6, 1.6)):
        gl.pin(t & gl.elipse(cu, cw, rx, ry), '#f6faff')
        gl.pin(t & gl.elipse(cu, cw + 0.8, rx * 0.8, ry * 0.7), '#dce8f4')
    d = gl.u * 0.8 + gl.w * 0.8
    gl.pin(t & (d > Wg * 0.5) & (d < Wg * 0.5 + 6), '#e8f4fc')
    gl.pin(t & (d > Wg * 0.5 + 9) & (d < Wg * 0.5 + 10.6), '#f0f8fe')
    # os caixilhos: o travessão do meio (duas folhas) e as divisões
    gl.pin(t & (np.abs(gl.u - Wg / 2) < 1.2), '#f2ecd8')
    gl.pin(t & (np.abs(gl.u - Wg / 2) < 1.2) & (gl.u > Wg / 2), '#d4ccb4')
    for k in (1, 2):
        gl.pin(t & (np.abs(gl.w - Hg * k / 3) < 0.55), '#f2ecd8')
    gl.pin(t & (gl.w < 1), '#9ab4c8')
    gl.pin(t & (gl.u < 1), '#a8c0d0')
    gl.grava()
    PC.moldura(xc - jx, xc + jx, wz0, wz1, 0.055, 0.05, JAN_FRAME)
    # o frontão de gesso em cima da janela
    cx((xc - jx - 0.04, xc + jx + 0.04, 0.0, 0.07, wz1, wz1 + 0.04), {'*': liso('#e6dec8'), 'cima': liso('#faf6e8')}, ch=0.008)
    # as cortinas
    zb, zt_ = zc - 1.02, zc + 0.86
    cu0, cu1 = xc - 0.78, xc + 0.78
    cp = PC.Pl(cu0, cu1, zb, zt_, 0.075)
    Wc, Hc = cp.W, (zt_ - zb) * KZ
    cp.u, cp.w = cp.u - 0.0, cp.w - 0.0
    for lado in (-1, 1):
        _painel_cortina(cp, (cu1 - cu0) * KX, Hc, not fechada, lado)
    cp.contorno()
    cp.grava()
    # o bandô: o babado de veludo com a franja de ouro e a tábua em cima, sobre o varão
    vz0, vz1 = zc + 0.7, zc + 1.06
    vp = PC.Pl(cu0 - 0.02, cu1 + 0.02, vz0, vz1, 0.13)
    Wv, Hv = (cu1 - cu0 + 0.04) * KX, (vz1 - vz0) * KZ
    tv = vp.dentro
    bord = 8.0 + 8.0 * np.sin(math.pi * ((vp.u % 22.0) / 22.0)) ** 0.9
    mv = tv & (vp.w < bord)
    _pano(vp, mv, vp.u % 22.0, vp.w, 11.0, Hv, larg_dobra=7.5, idx0=3.0, rampa=['#4a1019', '#6e1c2a', '#963042', '#b84a5c', '#d8707c'])
    vp.pin(tv & (vp.w < 1.6), '#d8b048')
    vp.pin(tv & (vp.w < 0.8), '#f4d878')
    vp.pin(tv & (vp.w >= bord - 1.2) & (vp.w < bord), '#d8b048')
    vp.pin(tv & (vp.w >= bord) & (vp.w < bord + 2.2) & ((np.floor(vp.u) % 2) == 0), '#d8b048')
    vp.pin(tv & (vp.w >= bord) & (vp.w < bord + 1.0) & ((np.floor(vp.u) % 2) == 1), '#a67c24')
    vp.contorno()
    vp.grava()
    cx((cu0 - 0.04, cu1 + 0.04, 0.0, 0.15, vz1, vz1 + 0.04), {'*': mad2('#3a1e10', seed=471), 'cima': liso('#5a3420')}, ch=0.01)
    for s in (-1, 1):
        xx = cu0 - 0.07 if s < 0 else cu1 + 0.07
        o = novo()
        C().elipsoide(np.array([xx, 0.075, zc + 0.88]), np.array([0.034, 0.034, 0.034]), vol_esfera(OURO), o, brilho=0.8)
        cx((xx - 0.018, xx + 0.018, 0.04, 0.11, zc + 0.86, zc + 0.9), liso(OURO), contorno=False)
    PC.sombra_parede(n0, 1, 2)


# =====================================================================================================================
ITENS = {
    'adega': (2, 1, (0.0, 0.0), lambda: adega(False), {'1': lambda: adega(True)}),
    'closet_aberto': (2, 1, (0.0, 0.0), lambda: closet_aberto(False), {'1': lambda: closet_aberto(True)}),
    'espelho_corpo': (1, 1, (0.0, 0.0), espelho_corpo, {}),
    'penteadeira': (2, 1, (0.0, 0.0), penteadeira, {}),
    'banheira_luxo': (2, 3, (0.0, 0.0), banheira_luxo, {}),
    'pia_dupla': (2, 1, (0.0, 0.0), pia_dupla, {}),
    'cama_master': (3, 3, (0.0, 0.0), cama_master, {}),
    'chaise_longue': (2, 1, (0.0, 0.0), chaise_longue, {}),
    'poltrona_orelha': (1, 1, (0.0, 0.0), poltrona_orelha, {}),
    'carrinho_bar': (1, 1, (0.0, 0.0), carrinho_bar, {}),
}

ITENS_PAREDE = {
    'quadro_oleo_grande': (lambda: quadro_oleo_grande(1), (1.5, 1.6)),
    'quadro_oleo_grande~2': (lambda: quadro_oleo_grande(2), (1.5, 1.6)),
    'quadro_oleo_grande~3': (lambda: quadro_oleo_grande(3), (1.5, 1.6)),
    'espelho_dourado': (lambda: espelho_dourado(1.5, 1.6), (1.5, 1.6)),
    'janela_cortinas': (lambda: janela_cortinas(False), (1.5, 1.55), {'1': lambda: janela_cortinas(True)}),
    'retrato_nobre': (lambda: retrato_nobre(1), (1.5, 1.6)),
    'retrato_nobre~2': (lambda: retrato_nobre(2), (1.5, 1.6)),
    'retrato_nobre~3': (lambda: retrato_nobre(3), (1.5, 1.6)),
    'retrato_nobre~4': (lambda: retrato_nobre(4), (1.5, 1.6)),
}
