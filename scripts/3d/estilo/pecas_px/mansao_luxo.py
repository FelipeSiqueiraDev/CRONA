"""
GRUPO D da MANSÃO ALBUQUERQUE, "o luxo" (23/10, o Felipe: "é a casa de milionários, tudo tem que ser chique"): a
vitrine do canto da biblioteca (o ovo de joia num pedestal de mármore), o sofá e a poltrona de veludo capitonê com os pés
dourados, a mesa de centro de mármore, o tapete grande e os objetinhos de mesa (o decanter com as taças na bandeja de
prata, a fruteira, o arranjo de flores, o serviço de chá, o candelabro, os perfumes, os porta-retratos, os livros de
couro e o balde de champanhe). Pixel art 1:1 só por código, com o estofado, o cristal, o ouro e o mármore de
mansao_conforto.py.

Tudo no giro 4 (a frente para +y), a pegada começando em (0, 0), no tamanho do catálogo (largura x fundo em casas, a
altura em METROS).
"""
import math

import numpy as np

import cozinha as CZ
import base_estilo as BE
import casa as CA
import escritorio as ES
import mansao_conforto as MC
import mansao_quartos as MQ
from base_estilo import hx, liso, vol, _tom, _p1_rampa, _poligono_rodado, PH, PZ
from motor import emissivo

M = BE.M
CASA = 0.75
novo, cx, peg, peq = MC.novo, MC.cx, MC.peg, MC.peq
OURO, OURO_L, OURO_E = MC.OURO, MC.OURO_L, MC.OURO_E
ouro = MC.ouro

_ESMERALDA = _p1_rampa(['#04140e', '#082018', '#0c2c22', '#10382c', '#164636', '#1c5442', '#24644f', '#2e765e', '#3a8a70', '#4aa084'])
_VINHO = MC._VINHO
_PRATA = '#c8ccd4'


def _pe_dourado(x, y, z1, r=0.024):
    """O pé curto de latão, cônico, com a bolinha embaixo."""
    o = novo()
    _poligono_rodado(x, y, [(0.0, r * 0.7), (0.02, r), (0.04, r * 0.8), (z1, r * 1.15)], vol(x, y, OURO, brilho=0.8), o, lados=10)


# =====================================================================================================================
# o sofá de veludo (3 x 1, o assento a 0,45 m): capitonê, braços em rolo, os pés de latão
# =====================================================================================================================
def _sofa(R, w_casas):
    x0, x1 = 0.03, w_casas * CASA - 0.03
    y0, y1 = 0.05, 0.72
    zs = 0.45
    zt = 0.92
    br = 0.17
    for xa in (x0 + 0.08, (x0 + x1) / 2, x1 - 0.08):
        for ya in (y0 + 0.07, y1 - 0.07):
            _pe_dourado(xa, ya, 0.1)
    # o corpo, a saia
    b = (x0 + 0.03, x1 - 0.03, y0 + 0.04, y1 - 0.02, 0.09, zs - 0.11)
    ES.malha(b, (0.03, 0.03, 0.02, 0.03), ES.estofado(R, b, 1.4, 4.8, cupula=0, grad=0.8), seg=2)
    # o encosto capitonê (os botões fundos em losango)
    b = (x0 + 0.04, x1 - 0.04, y0, y0 + 0.24, zs - 0.15, zt)
    ES.malha(b, (0.1, 0.08, 0.03, 0.12), ES.estofado(R, b, 2.2, 7.4, cupula=0.5, capi=(0.16, 0.14), grad=0.5), seg=3)
    # as almofadas do assento (uma por casa, com a costura)
    n = w_casas
    for i in range(n):
        a0 = x0 + br + (x1 - x0 - 2 * br) * i / n
        a1 = x0 + br + (x1 - x0 - 2 * br) * (i + 1) / n
        b = (a0 + 0.006, a1 - 0.006, y0 + 0.22, y1, zs - 0.13, zs)
        ES.malha(b, (0.05, 0.05, 0.03, 0.06), ES.estofado(R, b, 2.2, 7.8, cupula=1.1, brilho=True, grad=1.0), seg=2)
    # os braços em rolo, um pouco mais altos que o assento
    for (a0, a1) in ((x0, x0 + br), (x1 - br, x1)):
        b = (a0 + 0.02, a1 - 0.02, y0 + 0.16, y1 - 0.02, 0.09, zs + 0.08)
        ES.malha(b, (0.04, 0.05, 0.02, 0.03), ES.estofado(R, b, 1.8, 5.8, cupula=0, grad=1.0), seg=2)
        b = (a0 - 0.01, a1 + 0.01, y0 + 0.14, y1, zs + 0.06, zs + 0.27)
        ES.malha(b, (0.08, 0.08, 0.09, 0.1), ES.estofado(R, b, 2.4, 7.8, cupula=0.9, brilho=True, capi=(0.12, 0.1)), seg=2)
    # o friso dourado da base, na frente
    cx((x0 + 0.04, x1 - 0.04, y1 - 0.03, y1 - 0.012, 0.1, 0.125), ouro(), contorno=False)
    peg(x0, x1, y0, y1)


def sofa_luxo():
    _sofa(_ESMERALDA, 3)


def sofa_luxo_vinho():
    _sofa(_VINHO, 3)


# =====================================================================================================================
# a poltrona de veludo (1 x 1): a bergère de encosto em medalhão, capitonê, a moldura dourada entalhada
# =====================================================================================================================
def _poltrona(R):
    x0, x1 = 0.06, 0.69
    y0, y1 = 0.05, 0.71
    zs = 0.46
    zt = 1.1
    # os quatro pés dourados curvos (cabriolé: o cone que abre embaixo)
    for (a, b_) in ((x0 + 0.06, y0 + 0.06), (x1 - 0.06, y0 + 0.06), (x0 + 0.06, y1 - 0.06), (x1 - 0.06, y1 - 0.06)):
        o = novo()
        _poligono_rodado(a, b_, [(0.0, 0.03), (0.03, 0.02), (0.14, 0.022), (0.2, 0.03)], vol(a, b_, OURO, brilho=0.8), o, lados=10)
    # a moldura dourada do assento
    cx((x0, x1, y0 + 0.02, y1, 0.18, 0.24), ouro(), ch=0.01)
    # o assento
    b = (x0 + 0.03, x1 - 0.03, y0 + 0.16, y1 - 0.01, 0.23, zs)
    ES.malha(b, (0.06, 0.06, 0.04, 0.07), ES.estofado(R, b, 2.2, 7.8, cupula=1.2, brilho=True, grad=1.0), seg=2)
    # o encosto em medalhão: o painel com o topo curvo, a moldura de ouro em volta, capitonê
    perfil = MC.arco_perfil(x0 + 0.05, x1 - 0.05, 0.24, zt - 0.2, zt)
    MC.extruda_xz(perfil, y0, y0 + 0.07, {'*': ouro(), 'frente': ouro()}, novo())
    perfil2 = MC.arco_perfil(x0 + 0.1, x1 - 0.1, 0.3, zt - 0.24, zt - 0.06)
    capi = ES.estofado(R, (x0 + 0.1, x1 - 0.1, y0 + 0.07, y0 + 0.13, 0.3, zt - 0.06), 2.2, 7.4, cupula=0.4, capi=(0.13, 0.12), grad=0.5)
    MC.extruda_xz(perfil2, y0 + 0.07, y0 + 0.13, {'*': capi, 'frente': capi}, novo())
    # os braços: a haste dourada curva e a almofadinha
    for (a0, a1) in ((x0, x0 + 0.07), (x1 - 0.07, x1)):
        cx((a0, a1, y0 + 0.1, y1 - 0.04, zs - 0.02, zs + 0.18), ouro(), ch=0.01)
        b = (a0 - 0.005, a1 + 0.005, y0 + 0.2, y1 - 0.12, zs + 0.18, zs + 0.24)
        ES.malha(b, (0.02, 0.02, 0.02, 0.02), ES.estofado(R, b, 2.0, 6.0, cupula=0.8, brilho=True), seg=1)
    peg(x0, x1, y0, y1)


def poltrona_luxo():
    _poltrona(_VINHO)


def poltrona_luxo_verde():
    _poltrona(_ESMERALDA)


# =====================================================================================================================
# a mesa de centro (2 x 1, 0,42 m): o tampo de mármore, a moldura e as pernas douradas
# =====================================================================================================================
def mesa_centro_luxo():
    x0, x1 = 0.08, 1.42
    y0, y1 = 0.1, 0.66
    zt = 0.42
    for (a, b_) in ((x0 + 0.06, y0 + 0.05), (x1 - 0.06, y0 + 0.05), (x0 + 0.06, y1 - 0.05), (x1 - 0.06, y1 - 0.05)):
        o = novo()
        _poligono_rodado(a, b_, [(0.0, 0.03), (0.04, 0.018), (zt - 0.08, 0.02), (zt - 0.04, 0.03)], vol(a, b_, OURO, brilho=0.8), o, lados=10)
    cx((x0, x1, y0, y1, zt - 0.07, zt - 0.03), ouro(), ch=0.01)
    cx((x0 - 0.02, x1 + 0.02, y0 - 0.02, y1 + 0.02, zt - 0.03, zt), {'*': MC.marmore('#1e1c1e', '#8a8478', seed=5), 'cima': MC.marmore('#24222a', '#9a9488', seed=5)}, ch=0.008)
    peg(x0, x1, y0, y1)


# =====================================================================================================================
# a vitrine do canto (1 x 1, 1,75 m): o pedestal de mármore e, na caixa de vidro de moldura dourada, o ovo de joia
# =====================================================================================================================
def vitrine_ovo():
    xc, yc = 0.375, 0.375
    # o pedestal: a base larga, a coluna canelada e o capitel
    cx((0.1, 0.65, 0.1, 0.65, 0.0, 0.08), {'*': MC.marmore(seed=2), 'cima': MC.marmore('#f0e8da', seed=2)}, ch=0.01)
    cx((0.16, 0.59, 0.16, 0.59, 0.08, 0.92), {'*': MC.marmore('#e8e0d2', seed=3)}, ch=0.012)
    cx((0.14, 0.61, 0.14, 0.61, 0.92, 0.98), ouro(), ch=0.008)
    cx((0.12, 0.63, 0.12, 0.63, 0.98, 1.02), {'*': MC.marmore(seed=4), 'cima': MC.marmore('#f0e8da', seed=4)}, ch=0.006)
    # a almofada de veludo vinho e o ovo dourado com as faixas de pedras
    b = (0.24, 0.51, 0.24, 0.51, 1.02, 1.07)
    ES.malha(b, (0.03, 0.03, 0.02, 0.02), ES.estofado(_VINHO, b, 2.0, 6.0, cupula=0.8, brilho=True), seg=1)

    def faixas(P, base):
        zz = P[:, 2]
        ang = np.arctan2(P[:, 1] - yc, P[:, 0] - xc)
        base = np.where((np.abs(zz - 1.2) < 0.012)[:, None], hx('#d83a5a'), base)
        base = np.where((np.abs(zz - 1.28) < 0.01)[:, None], hx('#3a8ad8'), base)
        pedra = (np.abs(zz - 1.16) < 0.014) & (np.floor((ang + math.pi) / (2 * math.pi) * 10) % 2 == 0)
        return np.where(pedra[:, None], hx('#40c070'), base)
    o = novo()
    _poligono_rodado(xc, yc, [(1.07, 0.02), (1.09, 0.055), (1.13, 0.075), (1.19, 0.082), (1.25, 0.072), (1.3, 0.05), (1.33, 0.022), (1.345, 0.006)],
                     vol(xc, yc, OURO_L, brilho=0.9, faixas=faixas), o, lados=16)
    # o pezinho do ovo e a coroinha no alto
    o2 = novo()
    _poligono_rodado(xc, yc, [(1.335, 0.012), (1.35, 0.02), (1.37, 0.008)], vol(xc, yc, OURO, brilho=0.8), o2, lados=8)
    # a caixa de vidro: as quatro colunetas e as molduras douradas de cima e de baixo, o vidro com o reflexo nas faces da frente
    z0, z1 = 1.02, 1.62
    for (a, b_) in ((0.15, 0.15), (0.6, 0.15), (0.15, 0.6), (0.6, 0.6)):
        cx((a - 0.012, a + 0.012, b_ - 0.012, b_ + 0.012, z0, z1), ouro(), contorno=False)
    for z in (z0, z1 - 0.03):
        for (a0, a1, b0, b1) in ((0.14, 0.61, 0.14, 0.165), (0.14, 0.61, 0.585, 0.61), (0.14, 0.165, 0.14, 0.61), (0.585, 0.61, 0.14, 0.61)):
            cx((a0, a1, b0, b1, z, z + 0.03), ouro(), contorno=False)
    cx((0.13, 0.62, 0.13, 0.62, z1, z1 + 0.025), ouro(), ch=0.006)
    # o reflexo do vidro: só as riscas em diagonal nas faces da frente (o ovo continua à mostra)
    of = CZ.c.novo_obj(3, contorno=False, sombra=False)
    for (pa, pb, n) in (((0.165, 0.6), (0.6, 0.6), (0, 1, 0)), ((0.6, 0.165), (0.6, 0.6), (1, 0, 0))):
        for k, (t0, t1) in enumerate(((0.12, 0.18), (0.26, 0.29))):
            pts = []
            for (t, dz) in ((t0, 0.0), (t1, 0.0), (t1 + 0.3, 1.0), (t0 + 0.3, 1.0)):
                tt = min(1.0, t)
                x = pa[0] + (pb[0] - pa[0]) * tt
                y = pa[1] + (pb[1] - pa[1]) * tt
                pts.append((x + n[0] * 0.003, y + n[1] * 0.003, z0 + 0.06 + dz * (z1 - z0 - 0.14)))
            CZ.c.face_plana(pts, n, liso('#e8f6f8' if k == 0 else '#cfe8ee'), M, of)
    peg(0.1, 0.65, 0.1, 0.65)


# =====================================================================================================================
# o tapete grande (6 x 5): o persa imperial vinho e azul-noite, o medalhão de ouro, a barra larga, a franja
# =====================================================================================================================
def tapete_imperial():
    x0, x1, y0, y1 = 0.08, 6 * CASA - 0.08, 0.1, 5 * CASA - 0.1
    U, V = (x1 - x0) / PH, (y1 - y0) / PH
    vinho, vinho2 = hx('#6a1420'), hx('#561018')
    noite, ouro_c, ouro_e = hx('#14203a'), hx('#c8a048'), hx('#8a6a28')
    creme = hx('#e8d8b0')

    def f(L, n, P):
        u, v = np.floor((P[:, 0] - x0) / PH), np.floor((P[:, 1] - y0) / PH)
        out = np.tile(vinho, (len(P), 1))
        # o campo com o losangozinho repetido
        out = np.where(((np.abs((u % 10) - 5) + np.abs((v % 10) - 5)) == 3)[:, None], vinho2, out)
        bd = np.minimum(np.minimum(u, U - 1 - u), np.minimum(v, V - 1 - v))
        # a barra: a faixa azul-noite com as volutas de ouro, entre dois fios creme
        barra = (bd >= 3) & (bd < 13)
        out = np.where(barra[:, None], noite, out)
        vol_ = barra & ((((u + v) % 8) < 2) | (((u - v) % 8) < 2)) & (bd > 5) & (bd < 11)
        out = np.where(vol_[:, None], ouro_e, out)
        out = np.where(((bd >= 1) & (bd < 3))[:, None] | ((bd >= 13) & (bd < 14))[:, None], creme, out)
        out = np.where((bd < 1)[:, None], vinho2, out)
        # o medalhão: o losango azul com a borda de ouro e a rosa de ouro no meio
        du, dv = np.abs(u - U / 2) / (U * 0.22), np.abs(v - V / 2) / (V * 0.26)
        d = du + dv
        out = np.where((d < 1)[:, None], noite, out)
        out = np.where(((d >= 0.93) & (d < 1.06))[:, None], ouro_c, out)
        e = np.hypot(u - U / 2, (v - V / 2) * 1.1)
        out = np.where((e < 7)[:, None], ouro_e, out)
        out = np.where((e < 4.5)[:, None], ouro_c, out)
        out = np.where((e < 2)[:, None], vinho, out)
        # os quatro cantos do campo com o quarto de medalhão
        for (cu, cv) in ((14, 14), (U - 15, 14), (14, V - 15), (U - 15, V - 15)):
            ec = np.hypot(u - cu, v - cv)
            out = np.where(((ec > 4) & (ec < 6))[:, None], ouro_c, out)
        return out
    CA._tapete(x0, x1, y0, y1, f, franja='x', borda='#3a0c12', franja_cor='#e8dcc0')


# =====================================================================================================================
# os objetinhos de mesa (1 x 1, em cima de mesa, aparador ou cômoda: a pegada é a casa da mesa)
# =====================================================================================================================
def _bandeja_prata(x0, x1, y0, y1, z):
    """A bandeja de prata oval com a borda."""
    o = novo()
    cx((x0, x1, y0, y1, z, z + 0.012), {'*': ES.metal(_PRATA, topo='#eef0f4', quina=1.2, baixo=0.7)}, ch=0.006, oid=o)
    cx((x0 - 0.008, x1 + 0.008, y0 - 0.008, y1 + 0.008, z + 0.006, z + 0.02), {'*': ES.metal('#a8acb4', topo='#dde0e6', quina=1.2, baixo=0.7)}, oid=novo(contorno=False))


def decanter_tacas():
    """A bandeja de prata com o decanter de uísque e duas taças de cristal."""
    _bandeja_prata(0.16, 0.6, 0.2, 0.56, 0.0)
    MC._decanter(0.3, 0.33, 0.02, h=0.26, r=0.055)
    MC._copo_cristal(0.47, 0.32, 0.02, h=0.09, r=0.028)
    MC._copo_cristal(0.44, 0.46, 0.02, h=0.09, r=0.028)
    peg(0.16, 0.6, 0.2, 0.56)


def fruteira_prata():
    """A fruteira de prata de pé, cheia: uvas, maçãs vermelhas, peras e uma romã."""
    xc, yc = 0.375, 0.38
    o = novo()
    _poligono_rodado(xc, yc, [(0.0, 0.07), (0.015, 0.06), (0.03, 0.02), (0.08, 0.018), (0.09, 0.06), (0.12, 0.13), (0.13, 0.14)],
                     vol(xc, yc, _PRATA, brilho=0.9), o, lados=16)
    frutas = [((-0.06, -0.03), 0.045, '#b81c22'), ((0.05, -0.04), 0.045, '#c8b440'), ((0.0, 0.05), 0.046, '#a81820'), ((0.06, 0.04), 0.04, '#8a2a3a'),
              ((-0.05, 0.05), 0.036, '#c8b440'), ((0.0, -0.01), 0.05, '#c02a28')]
    for (dx, dy), r, cor in frutas:
        oo = novo()
        CZ.c.elipsoide((xc + dx, yc + dy, 0.13 + r * 0.8), (r, r, r * 0.95), lambda Pc, N, P, c0=hx(cor): np.tile(c0, (len(P), 1)), oo)
    # o cacho de uvas escuras caindo pela borda
    for i in range(6):
        oo = novo(contorno=False)
        CZ.c.elipsoide((xc + 0.1 + (i % 2) * 0.02, yc + 0.02 + (i // 2) * 0.02, 0.12 - i * 0.012), (0.016, 0.016, 0.016), lambda Pc, N, P: np.tile(hx('#3a1a4a'), (len(P), 1)), oo)
    peq(xc - 0.14, xc + 0.14, yc - 0.14, yc + 0.14, 0.0)
    peg(xc - 0.14, xc + 0.14, yc - 0.14, yc + 0.14)


def arranjo_flores():
    """O arranjo de flores no vaso de cristal: rosas brancas, peônias rosadas e folhagem."""
    xc, yc = 0.375, 0.38
    o = novo()
    _poligono_rodado(xc, yc, [(0.0, 0.05), (0.02, 0.06), (0.14, 0.07), (0.18, 0.05), (0.2, 0.055)], vol(xc, yc, '#cfe4e6', brilho=0.9), o, lados=14)
    flores = [((0.0, 0.0, 0.3), 0.05, '#f4f0ec'), ((-0.07, 0.02, 0.26), 0.045, '#e8a8b8'), ((0.07, -0.02, 0.27), 0.045, '#f0c8d0'),
              ((0.03, 0.06, 0.24), 0.04, '#f4f0ec'), ((-0.04, -0.06, 0.25), 0.04, '#d88898'), ((0.06, 0.05, 0.31), 0.038, '#f4f0ec'),
              ((-0.06, 0.06, 0.31), 0.036, '#e8a8b8')]
    for (dx, dy, z), r, cor in flores:
        oo = novo()
        CZ.c.elipsoide((xc + dx, yc + dy, z), (r, r, r * 0.8), lambda Pc, N, P, c0=hx(cor): np.tile(c0, (len(P), 1)), oo)
    for (dx, dy, z) in ((-0.1, 0.0, 0.22), (0.1, 0.03, 0.22), (0.0, -0.09, 0.21), (0.02, 0.1, 0.2)):
        oo = novo()
        CZ.c.elipsoide((xc + dx, yc + dy, z), (0.04, 0.03, 0.02), lambda Pc, N, P: np.tile(hx('#2e5a32'), (len(P), 1)), oo)
    peq(xc - 0.12, xc + 0.12, yc - 0.12, yc + 0.12, 0.0)
    peg(xc - 0.12, xc + 0.12, yc - 0.12, yc + 0.12)


def servico_cha():
    """O serviço de chá de prata na bandeja: o bule, o açucareiro, a leiteira e duas xícaras de porcelana."""
    _bandeja_prata(0.12, 0.64, 0.2, 0.58, 0.0)
    o = novo()
    _poligono_rodado(0.28, 0.36, [(0.02, 0.04), (0.04, 0.06), (0.1, 0.065), (0.14, 0.05), (0.16, 0.02), (0.18, 0.008)], vol(0.28, 0.36, _PRATA, brilho=0.9), o, lados=14)
    cx((0.33, 0.39, 0.35, 0.37, 0.08, 0.1), ES.metal(_PRATA), contorno=False)
    for (x, y) in ((0.46, 0.3), (0.5, 0.46)):
        oo = novo()
        _poligono_rodado(x, y, [(0.02, 0.025), (0.03, 0.03), (0.06, 0.035)], vol(x, y, '#f4f0ec', brilho=0.6), oo, lados=10)
    oo = novo()
    _poligono_rodado(0.24, 0.5, [(0.02, 0.025), (0.06, 0.03), (0.08, 0.02)], vol(0.24, 0.5, _PRATA, brilho=0.9), oo, lados=10)
    peg(0.12, 0.64, 0.2, 0.58)


def candelabro_prata():
    """O candelabro de prata de mesa: três braços e as velas acesas."""
    xc, yc = 0.375, 0.38
    o = novo()
    _poligono_rodado(xc, yc, [(0.0, 0.06), (0.02, 0.05), (0.04, 0.02), (0.2, 0.014), (0.22, 0.02)], vol(xc, yc, _PRATA, brilho=0.9), o, lados=12)
    for dx in (-0.08, 0.0, 0.08):
        z0 = 0.22 if dx == 0 else 0.2
        if dx:
            cx((min(xc, xc + dx) - 0.006, max(xc, xc + dx) + 0.006, yc - 0.006, yc + 0.006, 0.19, 0.205), ES.metal(_PRATA), contorno=False)
        oo = novo()
        _poligono_rodado(xc + dx, yc, [(z0, 0.018), (z0 + 0.02, 0.02)], vol(xc + dx, yc, _PRATA, brilho=0.9), oo, lados=8)
        ov = novo()
        _poligono_rodado(xc + dx, yc, [(z0 + 0.02, 0.012), (z0 + 0.14, 0.012)], vol(xc + dx, yc, '#f4ecd8', brilho=0.3), ov, lados=8)
        oc = CZ.c.novo_obj(3, contorno=False, sombra=False)
        CZ.c.elipsoide((xc + dx, yc, z0 + 0.165), (0.008, 0.008, 0.02), lambda Pc, N, P: np.tile(hx('#ffd060'), (len(P), 1)), oc)
    peq(xc - 0.1, xc + 0.1, yc - 0.06, yc + 0.06, 0.0)
    peg(xc - 0.1, xc + 0.1, yc - 0.06, yc + 0.06)


def perfumes():
    """Os frascos de perfume de cristal na bandejinha espelhada."""
    _bandeja_prata(0.18, 0.58, 0.24, 0.52, 0.0)
    for k, (x, y) in enumerate(((0.26, 0.32), (0.36, 0.3), (0.47, 0.34), (0.32, 0.44), (0.45, 0.45))):
        MC._perfume(x, y, 0.02, k)
    peg(0.18, 0.58, 0.24, 0.52)


def porta_retratos():
    """Os porta-retratos de prata em pé (as fotos da família, só a mancha da foto)."""
    for (x, y, w, h, cor) in ((0.22, 0.34, 0.14, 0.18, '#6a5a4a'), (0.4, 0.3, 0.12, 0.15, '#5a6a7a'), (0.5, 0.46, 0.1, 0.13, '#7a6a5a')):
        cx((x, x + w, y, y + 0.02, 0.0, h), {'*': ES.metal(_PRATA, topo='#eef0f4', quina=1.2, baixo=0.7), 'frente': liso('#a8acb4')})
        cx((x + 0.02, x + w - 0.02, y + 0.02, y + 0.024, 0.02, h - 0.02), liso(cor), contorno=False)
    peg(0.22, 0.62, 0.3, 0.5)


def livros_couro():
    """Os livros de couro com o título em ouro, deitados e em pé entre os aparadores de bronze."""
    cores = ['#5a1818', '#1a3a28', '#2a2440', '#6a3a18', '#3a1a2a']
    for i, cor in enumerate(cores):
        x = 0.22 + i * 0.055
        h = 0.2 + 0.02 * (i % 3)
        cx((x, x + 0.045, 0.3, 0.46, 0.0, h), liso(cor))
        cx((x + 0.005, x + 0.04, 0.459, 0.462, h * 0.6, h * 0.7), liso(OURO_L), contorno=False)
    for x in (0.19, 0.505):
        cx((x, x + 0.025, 0.3, 0.46, 0.0, 0.16), ES.metal('#8a6a3a', topo='#c8a060'))
    peg(0.19, 0.53, 0.3, 0.46)


def balde_champanhe():
    """O balde de champanhe de prata no pé alto, com a garrafa no gelo e o guardanapo branco."""
    xc, yc = 0.375, 0.38
    # o pé de três hastes douradas
    for a in (0.0, 2.1, 4.2):
        x = xc + math.cos(a) * 0.12
        y = yc + math.sin(a) * 0.12
        CA.perna_torneada(x, y, 0.0, 0.62, 0.014, OURO)
    cx((xc - 0.13, xc + 0.13, yc - 0.13, yc + 0.13, 0.6, 0.62), ouro(), ch=0.01)
    o = novo()
    _poligono_rodado(xc, yc, [(0.62, 0.09), (0.66, 0.1), (0.8, 0.12), (0.82, 0.125)], vol(xc, yc, _PRATA, brilho=0.9), o, lados=16)
    # o gelo, a garrafa inclinada e o guardanapo
    og = novo(contorno=False)
    CZ.c.elipsoide((xc, yc, 0.81), (0.1, 0.1, 0.02), lambda Pc, N, P: np.tile(hx('#e4f2f6'), (len(P), 1)), og)
    MC._garrafa_bar(xc - 0.02, yc + 0.01, 0.74, h=0.3, r=0.034, cor='#1a2a1e', rotulo='#e8d8a0')
    cx((xc + 0.06, xc + 0.11, yc - 0.03, yc + 0.03, 0.66, 0.86), liso('#f4f2ec'), contorno=False)
    peg(xc - 0.14, xc + 0.14, yc - 0.14, yc + 0.14)


# =====================================================================================================================
# a cadeira de jantar (1 x 1; 23/10, o Felipe: "essas cadeiras de jantar estão pobres, cadê o milionário"): o encosto
# alto de medalhão em moldura dourada entalhada, o veludo capitonê, o assento estofado e os pés dourados torneados
# =====================================================================================================================
def _cadeira(R, alto=1.12, larga=False):
    x0, x1 = (0.08, 0.67) if not larga else (0.02, 0.73)
    y0, y1 = 0.1, 0.68
    zs = 0.47
    for (a, b_) in ((x0 + 0.06, y0 + 0.05), (x1 - 0.06, y0 + 0.05), (x0 + 0.06, y1 - 0.06), (x1 - 0.06, y1 - 0.06)):
        o = novo()
        _poligono_rodado(a, b_, [(0.0, 0.026), (0.03, 0.02), (0.12, 0.024), (0.18, 0.017), (0.3, 0.021), (zs - 0.1, 0.026)], vol(a, b_, OURO, brilho=0.8), o, lados=10)
    # a moldura do assento, dourada, e o assento estofado
    cx((x0, x1, y0 + 0.02, y1, zs - 0.12, zs - 0.06), ouro(), ch=0.01)
    b = (x0 + 0.02, x1 - 0.02, y0 + 0.06, y1 - 0.01, zs - 0.07, zs)
    ES.malha(b, (0.05, 0.05, 0.03, 0.06), ES.estofado(R, b, 2.2, 7.8, cupula=1.0, brilho=True, grad=1.0), seg=2)
    # o encosto: a moldura dourada em arco alto (com a crista entalhada em cima) e o medalhão capitonê dentro
    perfil = MC.arco_perfil(x0 + 0.03, x1 - 0.03, zs - 0.06, alto - 0.16, alto)
    MC.extruda_xz(perfil, y0, y0 + 0.06, {'*': ouro(), 'frente': ouro()}, novo())
    perfil2 = MC.arco_perfil(x0 + 0.08, x1 - 0.08, zs + 0.04, alto - 0.2, alto - 0.06)
    capi = ES.estofado(R, (x0 + 0.08, x1 - 0.08, y0 + 0.06, y0 + 0.11, zs + 0.04, alto - 0.06), 2.2, 7.4, cupula=0.4, capi=(0.12, 0.11), grad=0.5)
    MC.extruda_xz(perfil2, y0 + 0.06, y0 + 0.11, {'*': capi, 'frente': capi}, novo())
    # a crista: o florão dourado no alto do encosto
    xm = (x0 + x1) / 2
    o = novo()
    CZ.c.elipsoide((xm, y0 + 0.03, alto + 0.025), (0.05, 0.025, 0.035), lambda Pc, N, P: np.tile(hx(OURO_L), (len(P), 1)), o)
    peg(x0, x1, y0, y1)


def cadeira_jantar_luxo():
    _cadeira(_VINHO)


def cadeira_cabeceira():
    """A poltrona da cabeceira (o lugar do dono da casa): mais alta e mais larga, o encosto quase um trono."""
    _cadeira(_VINHO, alto=1.5, larga=True)
    # os braços dourados com a almofadinha
    for (a0, a1) in ((0.02, 0.08), (0.67, 0.73)):
        cx((a0, a1, 0.2, 0.64, 0.47, 0.7), ouro(), ch=0.01)
        b = (a0 - 0.005, a1 + 0.005, 0.26, 0.56, 0.7, 0.75)
        ES.malha(b, (0.02, 0.02, 0.02, 0.02), ES.estofado(_VINHO, b, 2.0, 6.0, cupula=0.8, brilho=True), seg=1)


# =====================================================================================================================
# a vitrine de troféus (3 x 1, 1,9 m; 23/10, o Felipe: "esses troféus parecem pintura e não um troféu"): o móvel de
# nogueira com o vidro na frente, quatro prateleiras com as taças, as estatuetas e as medalhas de verdade, em volume
# =====================================================================================================================
def vitrine_trofeus():
    x0, x1, y0, y1 = 0.04, 3 * CASA - 0.04, 0.04, 0.46
    mad = '#4a2c18'
    for xa in (x0, (x0 + x1) / 2 - 0.02, x1 - 0.05):
        cx((xa, xa + 0.05, y0, y1, 0.0, 1.86), {'*': liso(mad), 'frente': liso('#5a3820'), 'cima': liso('#6a4428')}, ch=0.008)
    cx((x0 + 0.05, x1 - 0.05, y0, y0 + 0.025, 0.0, 1.86), {'*': liso('#2e1c10')})
    cx((x0 - 0.02, x1 + 0.02, y0, y1 + 0.03, 1.86, 1.94), {'*': liso('#5a3820'), 'cima': liso('#7a5232'), 'frente': ouro()}, ch=0.01)
    cx((x0, x1, y0, y1 + 0.02, 0.0, 0.12), {'*': liso('#3a2214'), 'frente': liso('#2e1a0e'), 'cima': liso('#6a4428')})
    zs = (0.12, 0.56, 1.0, 1.42)
    for z in zs[1:]:
        cx((x0 + 0.05, x1 - 0.05, y0 + 0.025, y1, z - 0.03, z), {'*': liso('#6a4428'), 'cima': liso('#8a6038'), 'frente': ouro()})
    yc = 0.25
    metais = ['ouro', 'prata', 'bronze', 'ouro', 'prata', 'ouro']
    for i, z in enumerate(zs):
        n = 5 if i != 2 else 6
        for j in range(n):
            x = x0 + 0.14 + (x1 - x0 - 0.28) * j / (n - 1)
            if abs(x - (x0 + x1) / 2) < 0.06:
                continue
            m = metais[(i + j) % len(metais)]
            if i == 2:
                MQ._medalha(x, yc, z, m, MQ.FITAS[(i + j) % len(MQ.FITAS)])
            else:
                MQ._taca(x, yc, z, 1.9 + 0.4 * ((i + j) % 3 == 0) + (0.5 if i == 0 else 0), m)
    # o vidro: as riscas de reflexo na frente
    of = CZ.c.novo_obj(3, contorno=False, sombra=False)
    for (t0, t1) in ((0.12, 0.135), (0.62, 0.632)):
        xa = x0 + (x1 - x0) * t0
        xb = x0 + (x1 - x0) * t1
        CZ.c.face_plana([(xa, y1 + 0.004, 0.16), (xb, y1 + 0.004, 0.16), (xb + 0.25, y1 + 0.004, 1.8), (xa + 0.25, y1 + 0.004, 1.8)], (0, 1, 0), liso('#cfe2e6'), M, of)
    peg(x0, x1, y0, y1)


# =====================================================================================================================
# a mesa de 21 (3 x 2, 0,8 m; 23/10, o Felipe: "aquelas que têm formato de C, sabe?! que o dealer fica em pé"): a
# meia-lua de feltro verde com o friso de couro vinho almofadado na curva (os jogadores sentam ali), o lado reto de
# nogueira para o dealer em pé, a bandeja de fichas embutida, o sapato das cartas, os círculos de aposta e as duas
# linhas de ouro pintadas no feltro, sobre a saia de couro com o filete de latão e o pedestal duplo
# =====================================================================================================================
def mesa_21():
    xc, y0 = 1.125, 0.1                   # o meio do lado reto (o do dealer)
    zr, zf = 0.8, 0.765                  # o alto do couro e o feltro
    RX, RY = 1.06, 1.33                  # a curva de fora (vai a 1,43 m do lado reto)
    BI = 0.14                            # a largura do couro
    N = 18

    def curva(rx, ry):
        return [(xc + rx * math.cos(math.pi * i / N), y0 + ry * math.sin(math.pi * i / N)) for i in range(N + 1)]
    O = curva(RX, RY)
    I = curva(RX - BI, RY - BI)

    def dist(P):
        return np.sqrt(((P[:, 0] - xc) / (RX - BI)) ** 2 + ((P[:, 1] - y0) / (RY - BI)) ** 2)

    def feltro(L, n, P):
        d = dist(P)
        a = np.arctan2((P[:, 1] - y0) / (RY - BI), (P[:, 0] - xc) / (RX - BI))
        out = np.tile(hx('#23744a'), (len(P), 1))
        out = np.where((d > 0.62)[:, None], hx('#206c45'), out)
        out = np.where((d > 0.86)[:, None], hx('#1c623e'), out)
        out = np.where((d < 0.3)[:, None], hx('#267a4e'), out)
        # as duas linhas de ouro pintadas (o arco do seguro e o da frase)
        for r in (0.42, 0.52):
            out = np.where((np.abs(d - r) < 0.012)[:, None], hx('#c8a040'), out)
        # os cinco círculos de aposta na curva, a 0,74 do raio
        for k in range(5):
            ak = math.pi * (0.14 + 0.18 * k)
            cxk = xc + (RX - BI) * 0.74 * math.cos(ak)
            cyk = y0 + (RY - BI) * 0.74 * math.sin(ak)
            r = np.sqrt((P[:, 0] - cxk) ** 2 + (P[:, 1] - cyk) ** 2)
            out = np.where((np.abs(r - 0.085) < 0.011)[:, None], hx('#e8dcb8'), out)
        # a sombra do couro na beira e a da bandeja
        out = np.where(((d > 0.95) & (a > math.pi * 0.5))[:, None], hx('#165034'), out)
        return out
    o = novo()
    MQ.C().face_plana([(x, y, zf) for (x, y) in I], (0, 0, 1), emissivo(feltro), M, o)

    def couro_alto(L, n, P):
        d = np.sqrt(((P[:, 0] - xc) / RX) ** 2 + ((P[:, 1] - y0) / RY) ** 2)
        t = (1 - d) / (BI / RX)
        out = np.tile(hx('#5a1620'), (len(P), 1))
        out = np.where(((t > 0.25) & (t < 0.75))[:, None], hx('#74202c'), out)
        out = np.where(((t > 0.38) & (t < 0.56))[:, None], hx('#8a2a36'), out)
        out = np.where((t < 0.08)[:, None], hx('#3a0c14'), out)
        # o pesponto dourado
        ang = np.arctan2(P[:, 1] - y0, P[:, 0] - xc)
        pes = (np.abs(t - 0.86) < 0.06) & (np.floor(ang * 60) % 2 == 0)
        return np.where(pes[:, None], hx('#d0a040'), out)
    couro_lado = liso('#4a1018')
    for k in range(N):
        a, b = O[k], O[k + 1]
        c_, d_ = I[k + 1], I[k]
        am = math.pi * (k + 0.5) / N
        nx, ny = math.cos(am) * RY, math.sin(am) * RX
        ln = math.hypot(nx, ny)
        nx, ny = nx / ln, ny / ln
        MQ.C().face_plana([(a[0], a[1], zr), (b[0], b[1], zr), (c_[0], c_[1], zr), (d_[0], d_[1], zr)], (0, 0, 1), emissivo(couro_alto), M, o)
        MQ.C().face_plana([(d_[0], d_[1], zf), (c_[0], c_[1], zf), (c_[0], c_[1], zr), (d_[0], d_[1], zr)], (-nx, -ny, 0), liso('#2a0a10'), M, o)
        MQ.C().face_plana([(a[0], a[1], 0.6), (b[0], b[1], 0.6), (b[0], b[1], zr), (a[0], a[1], zr)], (nx, ny, 0), couro_lado, M, o)
        # o filete de latão em volta da saia
        MQ.C().face_plana([(a[0], a[1], 0.62), (b[0], b[1], 0.62), (b[0], b[1], 0.64), (a[0], a[1], 0.64)], (nx, ny, 0),
                          liso('#d8b050' if k % 2 == 0 else '#c8a040'), M, o)
    # o lado reto do dealer: a borda de nogueira com o friso de ouro (de x0 a x1, em y0)
    x0, x1 = xc - RX, xc + RX
    cx((x0, x1, y0 - 0.06, y0, 0.6, zr), {'*': liso('#4a2614'), 'frente': liso('#5a3018'), 'cima': liso('#6a3a1c'), 'costas': liso('#3a1e10')}, ch=0.008)
    cx((x0, x1, y0 - 0.065, y0 - 0.06, 0.66, 0.68), ouro(), ch=0.0)
    # a bandeja de fichas embutida no feltro, junto do dealer: as colunas de fichas deitadas, das cores do cassino
    bx0, bx1, by0, by1 = xc - 0.42, xc + 0.42, y0 + 0.02, y0 + 0.2
    cx((bx0, bx1, by0, by1, zf - 0.02, zf + 0.012), {'*': liso('#2a1610'), 'cima': liso('#3a1e10')}, ch=0.0)
    cores = ['#d8402f', '#2f9a52', '#232328', '#7a3ab0', '#d8a830', '#f0ece0', '#2a4aa8', '#d8402f', '#2f9a52', '#232328']
    lc = (bx1 - bx0 - 0.04) / len(cores)
    for k, cor in enumerate(cores):
        xa = bx0 + 0.02 + k * lc
        claro = '#%02x%02x%02x' % tuple(min(255, int(int(cor[q:q + 2], 16) * 1.2)) for q in (1, 3, 5))
        listra = emissivo(lambda L, n, P, cor=cor: np.where((np.floor(P[:, 1] / PH) % 3 == 0)[:, None], hx('#f4f0e6'), np.tile(hx(cor), (len(P), 1))))
        cx((xa + 0.004, xa + lc - 0.004, by0 + 0.02, by1 - 0.02, zf + 0.012, zf + 0.05), {'*': listra, 'cima': listra, 'frente': liso(claro)}, ch=0.0)
    # o sapato das cartas (à direita do dealer) e a pilha do descarte (à esquerda)
    xs, ys = xc + 0.66, y0 + 0.16
    cx((xs - 0.08, xs + 0.08, ys - 0.11, ys + 0.11, zf, zf + 0.09), {'*': liso('#1a1a1e'), 'cima': liso('#2a2a30'), 'frente': liso('#24242a')}, ch=0.006)
    cx((xs - 0.065, xs + 0.065, ys + 0.09, ys + 0.115, zf + 0.02, zf + 0.075), {'*': liso('#7a1824'), 'frente': liso('#8a2030')}, ch=0.0)
    cx((xs - 0.07, xs + 0.07, ys + 0.105, ys + 0.12, zf + 0.0, zf + 0.02), ouro(), ch=0.0)
    xd, yd = xc - 0.66, y0 + 0.16
    cx((xd - 0.06, xd + 0.06, yd - 0.08, yd + 0.08, zf, zf + 0.012), {'*': liso('#c8c0b0'), 'cima': liso('#7a1824')}, ch=0.0)
    # as cartas de uma mão na mesa e as fichas apostadas em dois círculos
    for (k, ang) in ((1, 0.2), (3, -0.15)):
        ak = math.pi * (0.14 + 0.18 * k)
        cxk = xc + (RX - BI) * 0.74 * math.cos(ak)
        cyk = y0 + (RY - BI) * 0.74 * math.sin(ak)
        MQ._ficha(cxk, cyk, zf, ['#d8402f', '#232328'][k % 2 == 1], 4 if k == 1 else 6)
        MQ._carta(cxk + 0.03, cyk - 0.15, zf, ang)
        MQ._carta(cxk + 0.065, cyk - 0.14, zf, ang + 0.12)
    MQ._carta(xc - 0.03, y0 + 0.36, zf, 0.0)
    MQ._carta(xc + 0.02, y0 + 0.37, zf, 0.05, verso=True)
    # o pedestal: duas colunas torneadas de nogueira sob a mesa, com os pés de garra dourados
    for lx in (xc - 0.5, xc + 0.5):
        CA.perna_torneada(lx, y0 + 0.55, 0.0, 0.6, 0.1, '#4a2614')
        o2 = novo()
        MQ.elip((lx, y0 + 0.55, 0.03), (0.13, 0.13, 0.035), '#c8a040', o2)
    peg(x0, x1, y0 - 0.06, y0 + RY)


# =====================================================================================================================
# a jukebox (1 x 1, 1,6 m; 23/10, o Felipe: "temos que melhorar essa jukebox aí... tá bem feia"): a clássica de arco,
# o gabinete de nogueira com a frente toda em vidro: os tubos de luz coloridos (com as bolhas) subindo pelos lados e
# contornando o arco, o friso cromado, a cúpula com o leque dourado, a janela dos discos (o disco no prato e a fileira
# das etiquetas de escolher) e a grade de som dourada embaixo. Estado 0 ligada (acesa), '1' desligada.
# =====================================================================================================================
_ARCO = [(0.0, '#ff4a3a'), (0.2, '#ff9a2a'), (0.4, '#ffd84a'), (0.6, '#5ae070'), (0.8, '#4ab0ff'), (1.0, '#c060ff')]


def _cor_arco(t):
    t = np.clip(t, 0, 1)
    out = np.zeros((len(t), 3))
    for (a, ca), (b, cb) in zip(_ARCO, _ARCO[1:]):
        m = (t >= a) & (t <= b)
        k = ((t - a) / (b - a))[:, None]
        out = np.where(m[:, None], hx(ca) * (1 - k) + hx(cb) * k, out)
    return out


def jukebox(ligada=True):
    x0, x1 = 0.07, 0.68
    y0, y1 = 0.12, 0.6
    zc, zt = 1.12, 1.58                     # onde o arco começa e o alto dele
    xm, rx = (x0 + x1) / 2, (x1 - x0) / 2
    luz = 1.0 if ligada else 0.32

    def apaga(c):
        return c * luz + hx('#141018') * (1 - luz)

    def frente(L, n, P):
        X, Z = P[:, 0], P[:, 2]
        dx = (X - xm) / rx
        dz = np.where(Z > zc, (Z - zc) / (zt - zc), 0.0)
        d = np.sqrt(dx * dx + dz * dz)
        # o caminho ao longo do tubo: de baixo à esquerda, pelo arco, até embaixo à direita (0 a 1)
        ang = np.arctan2(dz, dx)
        ao_longo = np.where(Z > zc, 0.5 - (ang - math.pi / 2) / math.pi * 0.5, np.where(dx < 0, Z / zc * 0.25, Z / zc * 0.25))
        out = np.tile(hx('#2a1810'), (len(P), 1))
        # ---- o miolo (dentro dos tubos): de baixo para cima
        dentro = d < 0.74
        # a base cromada
        base = Z < 0.08
        # a grade de som: a madeira com a treliça dourada em losango e o painel de luz no meio
        grade = dentro & (Z >= 0.08) & (Z < 0.52)
        lu = (X - x0) / PH
        lz = Z / PH
        trel = ((np.floor(lu + lz) % 6 == 0) | (np.floor(lu - lz) % 6 == 0))
        out = np.where(grade[:, None], hx('#3a2216'), out)
        out = np.where((grade & trel)[:, None], hx('#d0a040'), out)
        painel = grade & (np.abs(dx) < 0.32) & (Z > 0.16) & (Z < 0.44)
        bolha = (np.floor(lu) % 3 == 1) & (np.floor(lz) % 3 == 1)
        out = np.where(painel[:, None], apaga(_cor_arco(Z / 0.5)) * 0.75 + hx('#ffffff') * 0.0, out)
        out = np.where((painel & bolha)[:, None], apaga(hx('#fff4d0')), out)
        # o friso cromado no meio, com a faixa de luz
        friso = dentro & (Z >= 0.52) & (Z < 0.6)
        out = np.where(friso[:, None], hx('#d8dee4'), out)
        out = np.where((friso & (Z > 0.55) & (Z < 0.57))[:, None], apaga(hx('#ff9a2a')), out)
        out = np.where((friso & (Z < 0.53))[:, None], hx('#8a949c'), out)
        # a janela dos discos: o vidro escuro, o disco no prato (o preto com a etiqueta vermelha) e as etiquetas creme
        jan = dentro & (Z >= 0.6) & (Z < zc + 0.06)
        out = np.where(jan[:, None], apaga(hx('#241a2a')) * 0.6 + hx('#0a0810') * 0.4, out)
        # a pilha dos discos guardados (as bordas prateadas) embaixo do prato
        pilha = jan & (np.abs(dx) < 0.5) & (Z > 0.82) & (Z < 0.88)
        out = np.where((pilha & (np.floor(Z / PZ) % 2 == 0))[:, None], hx('#a8b0b8'), out)
        out = np.where((pilha & (np.floor(Z / PZ) % 2 == 1))[:, None], hx('#1a1a20'), out)
        ex, ez = (X - xm) / 0.21, (Z - 0.97) / 0.075
        disco = jan & (ex * ex + ez * ez < 1)
        out = np.where(disco[:, None], hx('#16161c'), out)
        out = np.where((disco & (ex * ex + ez * ez < 0.7) & (ex * ex + ez * ez > 0.6))[:, None], hx('#4a4a56'), out)
        out = np.where((disco & (ex * ex + ez * ez < 0.12))[:, None], apaga(hx('#e8c040')), out)
        out = np.where((disco & (ex * ex + ez * ez < 0.015))[:, None], hx('#101014'), out)
        # o braço do toca-discos, cromado, vindo da direita
        braco = jan & (np.abs(Z - (1.02 - (X - xm) * 0.25)) < PZ * 0.8) & (X > xm + 0.04) & (X < xm + 0.25)
        out = np.where(braco[:, None], hx('#d8dee4'), out)
        out = np.where((jan & (np.abs(ez) < 1.25) & (np.abs(ex) > 1.05) & (np.abs(ex) < 1.5))[:, None], hx('#c8ccd4'), out)
        etiq = jan & (Z > 0.64) & (Z < 0.78) & (np.abs(dx) < 0.62)
        col = np.floor((X - (xm - 0.62 * rx)) / (0.124 * rx))
        etq = etiq & (((Z > 0.655) & (Z < 0.705)) | ((Z > 0.72) & (Z < 0.77))) & ((X - (xm - 0.62 * rx)) % (0.124 * rx) > PH)
        out = np.where(etq[:, None], apaga(hx('#f4ecd4')), out)
        out = np.where((etq & (col % 2 == 0) & (np.abs(Z - 0.68) < PH * 0.6))[:, None], hx('#c83a3a'), out)
        # a cúpula do alto: o vidro com o leque dourado
        cup = dentro & (Z >= zc + 0.06)
        raio = np.arctan2(Z - (zc + 0.06), X - xm)
        leque = (np.floor(raio / (math.pi / 14)) % 2 == 0)
        out = np.where(cup[:, None], apaga(hx('#5a2a5a')), out)
        out = np.where((cup & leque)[:, None], apaga(hx('#d8a040')) * 0.85 + hx('#2a1830') * 0.15, out)
        out = np.where((cup & (d > 0.66))[:, None], hx('#d8dee4'), out)
        # ---- os tubos de luz (os pilares e o arco): o cromo por dentro, as cores e as bolhas
        tubo = (d >= 0.74) & (d < 0.95)
        cor = apaga(_cor_arco(ao_longo))
        brilho = 1 + 0.35 * np.cos((d - 0.845) / 0.105 * math.pi / 2) ** 2
        out = np.where(tubo[:, None], np.clip(cor * brilho[:, None], 0, 255), out)
        bol = tubo & (np.floor(ao_longo * 90) % 7 == 0) & (np.abs(d - 0.845) < 0.04)
        out = np.where(bol[:, None], apaga(hx('#fffaf0')), out)
        out = np.where(((d >= 0.72) & (d < 0.75))[:, None], hx('#c8ccd4'), out)
        # o cromo de fora do arco
        out = np.where((d >= 0.95)[:, None], hx('#e4e8ec'), out)
        out = np.where((d >= 0.985)[:, None], hx('#9aa2aa'), out)
        out = np.where(base[:, None], hx('#c8ccd4'), out)
        out = np.where((base & (Z < 0.02))[:, None], hx('#6a7078'), out)
        return out

    perfil = MC.arco_perfil(x0, x1, 0.0, zc, zt, n=16)
    nog = {'*': liso('#4a2614'), 'lado': liso('#5a3018'), 'cima': liso('#6a3a1c'), 'costas': liso('#2a160c')}
    MC.extruda_xz(perfil, y0, y1, nog, novo())
    # a frente de vidro aceso (um objeto de luz: o jogo a deixa brilhar no escuro)
    if ligada:
        o = CZ.c.novo_obj(3, contorno=False, sombra=False)
        CZ.luzes.add(o)
    else:
        o = novo()
    MC.extruda_xz(perfil, y1, y1 + 0.008, {'*': emissivo(frente), 'frente': emissivo(frente)}, o)
    # o rodapé cromado um pouco mais largo e os pezinhos
    cx((x0 - 0.01, x1 + 0.01, y0 - 0.01, y1 + 0.02, 0.0, 0.05), {'*': liso('#c8ccd4'), 'cima': liso('#e4e8ec')}, ch=0.006)
    peg(x0 - 0.01, x1 + 0.01, y0 - 0.01, y1 + 0.02)


ITENS = {
    'jukebox': (1, 1, (0.0, 0.0), lambda: jukebox(True), {'1': lambda: jukebox(False)}),
    'mesa_21': (3, 2, (0.0, 0.0), mesa_21, {}),
    'cadeira_jantar_luxo': (1, 1, (0.0, 0.0), cadeira_jantar_luxo, {}),
    'cadeira_cabeceira': (1, 1, (0.0, 0.0), cadeira_cabeceira, {}),
    'vitrine_trofeus': (3, 1, (0.0, 0.0), vitrine_trofeus, {}),
    'sofa_luxo': (3, 1, (0.0, 0.0), sofa_luxo, {}),
    'sofa_luxo_vinho': (3, 1, (0.0, 0.0), sofa_luxo_vinho, {}),
    'poltrona_luxo': (1, 1, (0.0, 0.0), poltrona_luxo, {}),
    'poltrona_luxo_verde': (1, 1, (0.0, 0.0), poltrona_luxo_verde, {}),
    'mesa_centro_luxo': (2, 1, (0.0, 0.0), mesa_centro_luxo, {}),
    'vitrine_ovo': (1, 1, (0.0, 0.0), vitrine_ovo, {}),
    'tapete_imperial': (6, 5, (0.0, 0.0), tapete_imperial, {}),
    'decanter_tacas': (1, 1, (0.0, 0.0), decanter_tacas, {}),
    'fruteira_prata': (1, 1, (0.0, 0.0), fruteira_prata, {}),
    'arranjo_flores': (1, 1, (0.0, 0.0), arranjo_flores, {}),
    'servico_cha': (1, 1, (0.0, 0.0), servico_cha, {}),
    'candelabro_prata': (1, 1, (0.0, 0.0), candelabro_prata, {}),
    'perfumes': (1, 1, (0.0, 0.0), perfumes, {}),
    'porta_retratos': (1, 1, (0.0, 0.0), porta_retratos, {}),
    'livros_couro': (1, 1, (0.0, 0.0), livros_couro, {}),
    'balde_champanhe': (1, 1, (0.0, 0.0), balde_champanhe, {}),
}
