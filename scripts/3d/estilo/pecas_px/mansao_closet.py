"""
O CLOSET DO CASAL da MANSÃO ALBUQUERQUE (23/10, o Felipe: "faria mais sentido o casal Albuquerque ter um closet ao
invés de um guarda-roupas né?! Metade masculino metade feminino"): o cômodo ao lado da suíte, com o lado dele e o lado
dela, cada um uma estante aberta de 3 casas (2,25 m, 2,3 m de altura) em três vãos, com a luz quente no alto de cada vão,
e no meio a ilha de vidro com os relógios e as joias.

- `closet_masculino`: nogueira escura. Os ternos (azul-marinho, grafite, preto) com a camisa branca por baixo e os
  sapatos sociais embaixo; as camisas e as calças em duas barras, com as gavetas; as prateleiras com as malhas dobradas,
  as gravatas enroladas, o chapéu e os mocassins.
- `closet_feminino`: laqueado marfim com friso de ouro. Os vestidos longos; as blusas, com as bolsas nas prateleiras de
  baixo; a parede de saltos e as caixas de chapéu no alto.
- `ilha_joias`: a ilha laqueada marfim com os pés e o rodapé de ouro, as gavetas dos dois lados e o tampo de mármore
  com o vidro sobre o veludo azul-noite (os relógios, os anéis, os colares de pérolas, os brincos).

Pixel art 1:1 só por código (o estofado, o ouro e o mármore do mansao_conforto.py). Tudo no giro 4 (a frente para +y),
a pegada começando em (0, 0), no tamanho do catálogo (largura x fundo em casas, a altura em METROS).
"""
import math

import numpy as np

import cozinha as CZ
import base_estilo as BE
import casa as CA
import mansao_conforto as MC
from base_estilo import hx, liso, mad2, vol, _poligono_rodado

M = BE.M
CASA = 0.75
novo, cx, peg = MC.novo, MC.cx, MC.peg
ouro, OURO = MC.ouro, MC.OURO
_mix = MC._mix

NOZ = MC.NOZ
MARFIM = '#ece4d4'

# as medidas da estante (as duas iguais: o closet é um só, metade de cada um)
X0, X1 = 0.03, 3 * CASA - 0.03
Y0, Y1 = 0.04, 0.62
ZB, ZT = 0.1, 2.26
E = 0.04
YM = (Y0 + Y1) / 2 + 0.02


def _estante(corpo, claro, fundo, frisos=False):
    """
    O móvel aberto: o rodapé, o fundo, as laterais e os dois divisores, a cornija (com o filete de ouro) e a faixa de luz no
    alto de cada vão. corpo/fundo: os materiais; claro: a cor de cima das tábuas. Devolve os três vãos [(x0, x1)].
    """
    w = (X1 - X0) / 3
    cx((X0, X1, Y0, Y0 + E, ZB, ZT), {'*': fundo})
    for xa in (X0, X0 + w - E / 2, X0 + 2 * w - E / 2, X1 - E):
        cx((xa, xa + E, Y0, Y1, ZB, ZT), {'*': corpo, 'cima': liso(claro)}, ch=0.006)
    cx((X0, X1, Y0, Y1, 0.0, ZB), {'*': corpo, 'frente': liso(_mix(claro, '#000000', 0.45)), 'cima': liso(claro)})
    cx((X0, X1, Y0, Y1, ZB, ZB + 0.025), {'*': corpo, 'cima': liso(claro)})
    cx((X0 - 0.02, X1 + 0.02, Y0, Y1 + 0.03, ZT, ZT + 0.12), {'*': corpo, 'cima': liso(claro)}, ch=0.01)
    cx((X0 - 0.02, X1 + 0.02, Y1 + 0.03, Y1 + 0.036, ZT + 0.03, ZT + 0.05), ouro((0, 0, 0, 0, 0, 1)), contorno=False)
    if frisos:
        # o friso de ouro na frente de cada lateral (o lado dela)
        for xa in (X0, X0 + w - E / 2, X0 + 2 * w - E / 2, X1 - E):
            cx((xa + 0.012, xa + E - 0.012, Y1, Y1 + 0.004, ZB + 0.04, ZT - 0.04), ouro((0, 0, 0, 0, 0, 1)), contorno=False)
    vaos = []
    for k in range(3):
        a0 = X0 + k * w + (E if k == 0 else E / 2)
        a1 = X0 + (k + 1) * w - (E if k == 2 else E / 2)
        ol = cx((a0, a1, Y0 + 0.1, Y1 - 0.08, ZT - 0.015, ZT), liso('#fff0c8'), contorno=False)
        CZ.luzes.add(ol)
        vaos.append((a0, a1))
    return vaos


def _prateleira(a0, a1, z, corpo, claro, friso=False):
    cx((a0, a1, Y0 + E, Y1 - 0.02, z - 0.025, z), {'*': corpo, 'cima': liso(claro)})
    if friso:
        cx((a0, a1, Y1 - 0.02, Y1 - 0.016, z - 0.018, z - 0.008), ouro((0, 0, 0, 0, 0, 1)), contorno=False)


def _barra(a0, a1, zr):
    cx((a0, a1, YM - 0.01, YM + 0.01, zr, zr + 0.022), ouro((0, 0, 0, 0, zr, zr + 0.022)), contorno=False)


def _cabides(a0, a1, zr, lista, larg=0.058, prof=0.26):
    """As roupas penduradas na barra, espalhadas pelo vão: lista de (cor, comprimento, colarinho)."""
    n = len(lista)
    passo = (a1 - a0 - 0.06) / max(1, n - 1)
    for k, (cor, ln, gola) in enumerate(lista):
        MC._cabide(a0 + 0.03 + k * passo, YM, zr, ln, cor, larg, prof, camisa=gola)


def _sapato(x, y, z, cor, salto=False):
    """Um pé de sapato de frente para +y (x: o lado esquerdo; y: o calcanhar). O salto alto: a sola inclinada e o salto fino."""
    cl = liso(_mix(cor, '#ffffff', 0.2))
    if not salto:
        cx((x, x + 0.042, y, y + 0.22, z, z + 0.045), {'*': liso(cor), 'cima': cl})
        cx((x, x + 0.042, y, y + 0.08, z + 0.045, z + 0.075), {'*': liso(cor), 'cima': cl})
    else:
        cx((x, x + 0.036, y + 0.13, y + 0.2, z, z + 0.035), {'*': liso(cor), 'cima': cl})
        cx((x, x + 0.036, y, y + 0.09, z + 0.07, z + 0.1), {'*': liso(cor), 'cima': cl})
        cx((x + 0.01, x + 0.026, y + 0.005, y + 0.02, z, z + 0.07), liso('#1a1416'), contorno=False)


def _pares(a0, a1, z, cores, salto=False):
    n = len(cores)
    larg = (a1 - a0) / n
    for k, cor in enumerate(cores):
        xc = a0 + larg * (k + 0.5)
        y = Y1 - 0.28 if not salto else Y1 - 0.26
        _sapato(xc - 0.05, y, z, cor, salto)
        _sapato(xc + 0.008, y, z, cor, salto)


def _dobradas(x, y, z, cores, w=0.24, d=0.28, h=0.055):
    """A pilha de malhas dobradas (cada uma um tom)."""
    for k, cor in enumerate(cores):
        cx((x, x + w, y, y + d, z + k * h, z + (k + 1) * h - 0.004), {'*': liso(cor), 'cima': liso(_mix(cor, '#ffffff', 0.15))}, ch=0.004)


def _bolsa(x, z, cor, w=0.2, h=0.15):
    y = YM - 0.06
    cx((x, x + w, y, y + 0.11, z, z + h), {'*': liso(cor), 'cima': liso(_mix(cor, '#ffffff', 0.18))}, ch=0.01)
    # a alça (o arco em três pedaços) e o fecho de ouro
    for (a, b, z0, z1) in ((x + 0.04, x + 0.06, z + h, z + h + 0.06), (x + w - 0.06, x + w - 0.04, z + h, z + h + 0.06), (x + 0.04, x + w - 0.04, z + h + 0.05, z + h + 0.07)):
        cx((a, b, y + 0.045, y + 0.065, z0, z1), liso(_mix(cor, '#000000', 0.25)), contorno=False)
    cx((x + w / 2 - 0.015, x + w / 2 + 0.015, y + 0.11, y + 0.114, z + h - 0.05, z + h - 0.02), ouro((0, 0, 0, 0, 0, 1)), contorno=False)


def _caixa_redonda(xc, z, r, cor, h=0.16):
    o = novo()
    _poligono_rodado(xc, YM, [(z, r), (z + h, r)], vol(xc, YM, cor, brilho=0.4), o, lados=14)
    o2 = novo()
    _poligono_rodado(xc, YM, [(z + h, r + 0.008), (z + h + 0.03, r + 0.008)], vol(xc, YM, _mix(cor, '#ffffff', 0.25), brilho=0.4), o2, lados=14)


def _gavetas(a0, a1, z0, z1, n, cor, puxador_ouro=True):
    """As gavetas (fechadas) embaixo do vão, com o puxador."""
    h = (z1 - z0) / n
    for k in range(n):
        za, zb = z0 + k * h + 0.008, z0 + (k + 1) * h - 0.008
        cx((a0 + 0.008, a1 - 0.008, Y1 - 0.05, Y1 - 0.02, za, zb), {'*': liso(cor), 'frente': liso(_mix(cor, '#ffffff', 0.06))}, ch=0.004)
        CA.alca((a0 + a1) / 2, (za + zb) / 2, Y1 - 0.02, 0.08 if puxador_ouro else 0.06)
    cx((a0, a1, Y0 + E, Y1 - 0.05, z0, z1), liso(_mix(cor, '#000000', 0.3)))


# =====================================================================================================================
# o lado dele (3 x 1): nogueira
# =====================================================================================================================
def closet_masculino():
    corpo = mad2(NOZ, eixo=1, seed=471, passo=0.05)
    fundo = mad2('#3a2010', eixo=1, seed=472, passo=0.05)
    claro = '#6e4228'
    v0, v1, v2 = _estante(corpo, claro, fundo)
    # 1. os ternos: a barra alta, os paletós com a camisa e a gola branca; embaixo, os sapatos sociais em dois níveis
    _barra(*v0, 1.86)
    _cabides(*v0, 1.86, [('#1c2440', 0.98, '#f2efe8'), ('#2a2c34', 1.0, '#f2efe8'), ('#16161a', 0.98, '#e8e4dc'), ('#3a3e4c', 0.96, '#f2efe8'),
                         ('#1c2440', 0.98, '#cfe0f0'), ('#4a4a50', 1.0, '#f2efe8'), ('#16161a', 0.98, '#f2efe8')])
    _prateleira(*v0, 0.48, corpo, claro)
    _pares(v0[0] + 0.02, v0[1] - 0.02, ZB + 0.025, ['#1a1414', '#5a2e18', '#1a1414'])
    _pares(v0[0] + 0.02, v0[1] - 0.02, 0.48, ['#3a1c10', '#1a1414', '#7a4a28'])
    # 2. as camisas na barra de cima, as calças na de baixo e as gavetas
    _barra(*v1, 2.0)
    _cabides(*v1, 2.0, [('#f2efe8', 0.66, None), ('#cfe0f0', 0.66, None), ('#f2efe8', 0.64, None), ('#e8d8e0', 0.66, None),
                        ('#a8c4e0', 0.66, None), ('#f2efe8', 0.64, None), ('#d8e4ec', 0.66, None)])
    _barra(*v1, 1.2)
    _cabides(*v1, 1.2, [('#1c2440', 0.5, None), ('#2a2c34', 0.52, None), ('#4a4436', 0.5, None), ('#16161a', 0.52, None), ('#5a5a60', 0.5, None),
                        ('#2a2c34', 0.5, None)], larg=0.05)
    _gavetas(*v1, ZB + 0.03, 0.6, 3, '#4a2a16')
    # 3. as prateleiras: as malhas dobradas, as gravatas enroladas nos nichos, o chapéu e os mocassins
    for z in (0.62, 1.06, 1.5, 1.92):
        _prateleira(*v2, z, corpo, claro)
    a0, a1 = v2
    _dobradas(a0 + 0.04, Y0 + 0.12, 1.06, ['#2a3a5a', '#8a8478', '#5a2a2a'])
    _dobradas(a0 + 0.36, Y0 + 0.12, 1.06, ['#e8e0d0', '#3a4a3a', '#1c2440'])
    _dobradas(a0 + 0.04, Y0 + 0.12, 1.5, ['#b8a888', '#4a4a50'])
    _dobradas(a0 + 0.36, Y0 + 0.12, 1.5, ['#f2efe8', '#cfe0f0', '#f2efe8'], h=0.04)
    # as gravatas enroladas (os rolinhos coloridos, em fila)
    cores = ['#7a1a24', '#1c2c5a', '#2a5a3a', '#b8902a', '#5a1a4a', '#1a1a1e', '#8a3a1a', '#3a5a8a']
    for k, cor in enumerate(cores):
        x = a0 + 0.04 + k * ((a1 - a0 - 0.1) / (len(cores) - 1))
        cx((x, x + 0.05, Y1 - 0.2, Y1 - 0.06, 0.62, 0.67), {'*': liso(cor), 'cima': liso(_mix(cor, '#ffffff', 0.25))}, ch=0.006)
    # o chapéu (a aba e a copa) e a caixinha de relógio
    xc = a0 + 0.2
    CZ.c.elipsoide((xc, YM, 1.935), (0.14, 0.12, 0.012), lambda Pc, N, P: np.tile(hx('#2a2420'), (len(P), 1)), novo())
    CZ.c.elipsoide((xc, YM, 1.97), (0.08, 0.07, 0.05), lambda Pc, N, P: np.tile(hx('#2e2824'), (len(P), 1)), novo())
    cx((a1 - 0.24, a1 - 0.04, YM - 0.08, YM + 0.06, 1.92, 1.99), {'*': liso('#3a1c10'), 'cima': liso('#5a2e18')}, ch=0.006)
    _pares(a0 + 0.02, a1 - 0.02, ZB + 0.025, ['#6a3a1c', '#1a1414', '#8a5a30'])
    peg(X0, X1, Y0, Y1)


# =====================================================================================================================
# o lado dela (3 x 1): laqueado marfim com o friso de ouro
# =====================================================================================================================
def closet_feminino():
    corpo = liso(MARFIM)
    fundo = liso('#e2d8c4')
    claro = '#f6f0e4'
    v0, v1, v2 = _estante(corpo, claro, fundo, frisos=True)
    # 1. os vestidos longos
    _barra(*v0, 2.0)
    _cabides(*v0, 2.0, [('#6a1a24', 1.5, None), ('#1f3a2a', 1.55, None), ('#e0cfb0', 1.45, None), ('#16161a', 1.55, None), ('#e8b0b8', 1.45, None),
                        ('#1c2440', 1.5, None), ('#a8443a', 1.5, None)], larg=0.07, prof=0.24)
    _pares(v0[0] + 0.02, v0[1] - 0.02, ZB + 0.025, ['#16161a', '#a8443a', '#e0cfb0'], salto=True)
    # 2. as blusas e, embaixo, as bolsas em duas prateleiras
    _barra(*v1, 2.0)
    _cabides(*v1, 2.0, [('#f2efe8', 0.72, None), ('#e8b0b8', 0.7, None), ('#cfe0f0', 0.72, None), ('#e0cfb0', 0.7, None), ('#16161a', 0.72, None),
                        ('#f6e8d0', 0.7, None)], larg=0.062)
    a0, a1 = v1
    _prateleira(a0, a1, 0.98, corpo, claro, friso=True)
    _prateleira(a0, a1, 0.56, corpo, claro, friso=True)
    for z, cores in ((0.98, ['#6a1a24', '#e0cfb0', '#16161a']), (0.56, ['#b8902a', '#1f3a2a', '#e8b0b8']), (ZB + 0.025, ['#5a2e18', '#16161a'])):
        n = len(cores)
        w = (a1 - a0 - 0.06) / n
        for k, cor in enumerate(cores):
            _bolsa(a0 + 0.03 + k * w + (w - 0.18) / 2, z, cor, w=0.18, h=0.14 if z > 0.5 else 0.18)
    # 3. a parede de saltos e as caixas de chapéu no alto
    a0, a1 = v2
    nivel = [ZB + 0.025, 0.42, 0.74, 1.06, 1.38, 1.7]
    tons = [['#16161a', '#a8443a', '#e0cfb0'], ['#e8b0b8', '#16161a', '#b8902a'], ['#6a1a24', '#f2efe8', '#1c2440'],
            ['#c8c4cc', '#16161a', '#a8443a'], ['#e0cfb0', '#6a1a24', '#16161a'], ['#b8902a', '#e8b0b8', '#f2efe8']]
    for z, cores in zip(nivel, tons):
        if z > ZB + 0.1:
            _prateleira(a0, a1, z, corpo, claro, friso=True)
        _pares(a0 + 0.02, a1 - 0.02, z, cores, salto=True)
    _prateleira(a0, a1, 2.0, corpo, claro, friso=True)
    _caixa_redonda(a0 + 0.17, 2.0, 0.13, '#e8b0b8')
    _caixa_redonda(a1 - 0.17, 2.0, 0.12, '#16161a', h=0.13)
    peg(X0, X1, Y0, Y1)


# =====================================================================================================================
# a ilha de joias (2 x 1, 0,92 m): o vidro sobre o veludo, com os relógios dele e as joias dela
# =====================================================================================================================
def ilha_joias():
    x0, x1 = 0.06, 2 * CASA - 0.06
    y0, y1 = 0.09, 0.66
    zt = 0.92
    # o rodapé de ouro, o corpo laqueado e as gavetas dos dois lados (a frente e as costas)
    cx((x0 + 0.03, x1 - 0.03, y0 + 0.03, y1 - 0.03, 0.0, 0.07), ouro(), ch=0.006)
    cx((x0, x1, y0, y1, 0.07, zt - 0.05), {'*': liso(MARFIM), 'cima': liso('#f6f0e4')}, ch=0.008)
    n = 3
    w = (x1 - x0 - 0.06) / n
    for (yf, s) in ((y1, 1), (y0, -1)):
        for k in range(n):
            a = x0 + 0.03 + k * w
            for (za, zb) in ((0.12, 0.44), (0.48, 0.8)):
                ya, yb = (yf - 0.003, yf + 0.012) if s > 0 else (yf - 0.012, yf + 0.003)
                cx((a + 0.01, a + w - 0.01, ya, yb, za, zb), {'*': liso('#f2ecde'), 'frente': liso('#f4eee2')}, ch=0.003)
                cx((a + w / 2 - 0.04, a + w / 2 + 0.04, yb if s > 0 else ya - 0.006, (yb + 0.006) if s > 0 else ya, (za + zb) / 2 - 0.008, (za + zb) / 2 + 0.008),
                   ouro((0, 0, 0, 0, 0, 1)), contorno=False)
    # o tampo: a moldura de mármore e, dentro, o veludo azul-noite (o vidro por cima só aparece no reflexo)
    b = 0.07
    for (a0, a1, b0, b1) in ((x0 - 0.02, x1 + 0.02, y0 - 0.02, y0 + b), (x0 - 0.02, x1 + 0.02, y1 - b, y1 + 0.02),
                             (x0 - 0.02, x0 + b, y0 + b, y1 - b), (x1 - b, x1 + 0.02, y0 + b, y1 - b)):
        cx((a0, a1, b0, b1, zt - 0.05, zt), {'*': MC.marmore('#f0eae0', '#b8ae9e', seed=31), 'cima': MC.marmore('#f6f2ea', '#b8ae9e', seed=31)}, ch=0.005)
    vx0, vx1, vy0, vy1 = x0 + b, x1 - b, y0 + b, y1 - b
    zv = zt - 0.04
    cx((vx0, vx1, vy0, vy1, zt - 0.06, zv), {'*': liso('#141a30'), 'cima': liso('#1c2440')}, contorno=False)
    # as divisórias de ouro do veludo (três bandejas)
    for t in (1 / 3, 2 / 3):
        xa = vx0 + (vx1 - vx0) * t
        cx((xa - 0.006, xa + 0.006, vy0, vy1, zv, zv + 0.012), ouro((0, 0, 0, 0, 0, 1)), contorno=False)
    # 1. os relógios dele: a caixa de ouro ou aço e o mostrador
    for k, (caixa, mostr) in enumerate((('ouro', '#f4f0e6'), ('aco', '#1a1a20'), ('ouro', '#1c2c4a'), ('aco', '#f4f0e6'))):
        x = vx0 + 0.03 + (k % 2) * 0.13
        y = vy0 + 0.05 + (k // 2) * 0.17
        cx((x + 0.025, x + 0.065, y - 0.03, y + 0.11, zv, zv + 0.008), liso('#2a1a12' if k % 2 else '#c8ccd4'), contorno=False)
        mat = ouro((0, 0, 0, 0, 0, 1)) if caixa == 'ouro' else liso('#c8ccd4')
        cx((x + 0.015, x + 0.075, y + 0.01, y + 0.07, zv + 0.008, zv + 0.026), {'*': mat, 'cima': liso(mostr)}, ch=0.004)
    # 2. os anéis e os brincos: o aro de ouro e a pedra
    xa0, xa1 = vx0 + (vx1 - vx0) / 3, vx0 + 2 * (vx1 - vx0) / 3
    pedras = ['#d83a5a', '#3a8ad8', '#40c070', '#f4f6fa', '#d83a5a', '#f4f6fa', '#3a8ad8', '#b04ad8']
    for k, cor in enumerate(pedras):
        x = xa0 + 0.04 + (k % 4) * ((xa1 - xa0 - 0.1) / 3)
        y = vy0 + 0.07 + (k // 4) * 0.16
        cx((x, x + 0.03, y, y + 0.03, zv, zv + 0.012), ouro((0, 0, 0, 0, 0, 1)), contorno=False)
        cx((x + 0.008, x + 0.022, y + 0.008, y + 0.022, zv + 0.012, zv + 0.024), liso(cor), contorno=False)
    # 3. os colares de pérolas (o U de contas) e o de ouro
    xc0 = xa1 + 0.03
    for k, (cor, r) in enumerate((('#f6f2ea', 0.07), ('#f6f2ea', 0.055), ('#e0c060', 0.06))):
        xm = xc0 + 0.09 + (k % 2) * 0.0
        ym = vy0 + 0.1 + k * 0.12
        if ym > vy1 - 0.05:
            break
        for j in range(9):
            a = math.pi * j / 8
            px_ = xm + r * math.cos(a)
            py_ = ym + r * 0.55 * math.sin(a)
            cx((px_ - 0.008, px_ + 0.008, py_ - 0.008, py_ + 0.008, zv, zv + 0.014), liso(cor), contorno=False)
    # o vidro: as riscas de reflexo em diagonal, deitadas no tampo
    of = CZ.c.novo_obj(3, contorno=False, sombra=False)
    for (t0, t1) in ((0.14, 0.17), (0.66, 0.68)):
        xa = vx0 + (vx1 - vx0) * t0
        xb = vx0 + (vx1 - vx0) * t1
        CZ.c.face_plana([(xa, vy1, zt - 0.003), (xb, vy1, zt - 0.003), (xb - 0.18, vy0, zt - 0.003), (xa - 0.18, vy0, zt - 0.003)], (0, 0, 1),
                        liso('#d8e8f0'), M, of)
    peg(x0, x1, y0, y1)


ITENS = {
    'closet_masculino': (3, 1, (0.0, 0.0), closet_masculino, {}),
    'closet_feminino': (3, 1, (0.0, 0.0), closet_feminino, {}),
    'ilha_joias': (2, 1, (0.0, 0.0), ilha_joias, {}),
}
