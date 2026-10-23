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
from base_estilo import hx, liso, vol, _tom, _p1_rampa, _poligono_rodado, PH
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


ITENS = {
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
