"""
GRUPO D da MANSÃO ALBUQUERQUE, "o moderno" (23/10, o Felipe: "a casa dos Albuquerque está muito feinha, cheio de madeira
e coisas com aparência velha; é uma mansão no meio da grande São Paulo: é tudo mármore, coisas chiques, prateleiras em
madeira maciça feita à mão por um artista do século 17, essas coisas atuais muito chiques que os ricos têm").

As peças do dia a dia viram o que uma casa de milionário de hoje tem: a cozinha gourmet de mármore Calacatta (a ilha em
cascata, as bancadas sem puxador, a coluna de fornos, a geladeira embutida), o jantar de mármore com a base de latão, os
quartos em laca marfim com o latão escovado, as camas estofadas de cabeceira alta, os tapetes contemporâneos, o sofá de
bouclé, o bar de mármore preto com a adega iluminada, a escultura moderna. A única madeira que fica é a das estantes
entalhadas à mão (as do século XVII, peças de museu, lustrosas e douradas), como o Felipe pediu.

Tudo no giro 4 (a frente para +y), a pegada começando em (0, 0), no tamanho do catálogo (largura x fundo em casas, a
altura em METROS). As peças ficam com o mesmo tamanho das que substituem (o seed troca uma pela outra no mesmo lugar).
"""
import math

import numpy as np

import cozinha as CZ
import base_estilo as BE
import bar as BAR
import casa as CA
import escritorio as ES
import laboratorio as LAB
import mansao_conforto as MC
import mansao_estrutura as MSE
import mansao_luxo as ML
import mansao_quartos as MQ
from base_estilo import hx, liso, mad2, vol, _tom, _p1_rampa, _poligono_rodado, PH, PZ
from motor import emissivo, suave

M = BE.M
CASA = 0.75
novo, cx, peg, peq = MC.novo, MC.cx, MC.peg, MC.peq
ouro, OURO, OURO_L = MC.ouro, MC.OURO, MC.OURO_L


# ------------------------------------------------------------------ os materiais ------------------------------------------------------------------
def calacata(seed=0):
    """O mármore Calacatta: o branco quente com os veios cinza e dourados, fortes."""
    return MSE.marmore('#f1eee8', '#a89878', seed=seed, forte=1.3, escala=1.2)


def nero(seed=0):
    """O Nero Marquina: o preto com os veios dourados."""
    return MSE.marmore('#1b1a1f', '#c8a860', seed=seed, forte=1.2, escala=1.1)


# a laca clara: a chapa pintada lisa (o MSE.laca é o preto do piano e, claro, estoura em amarelo)
LACA_MARFIM = ES.metal('#e2dbce', topo='#ece6dc', quina=1.05, baixo=0.82)
LACA_GRAFITE = MSE.laca('#2a292e')
LACA_NOITE = ES.metal('#18181c', topo='#24242a', quina=1.08, baixo=0.85)
VIDRO_FUME = LAB.vidro_mat('#3a4248')
INOX = ES.metal('#b8bcc0', topo='#d8dcde')
_BOUCLE = _p1_rampa(['#8a8072', '#9a9082', '#aaa092', '#b8ae9f', '#c6bcac', '#d2c8b8', '#ddd4c4', '#e6ddce', '#eee6d8', '#f6efe3'])
_VELUDO_TAUPE = _p1_rampa(['#3a302a', '#463a32', '#52453b', '#5e5044', '#6a5b4e', '#766658', '#827162', '#8e7c6d', '#9a8878', '#a89584'])


def friso_ouro(x0, x1, y, z0, z1):
    """O filete de latão escovado na frente (1 a 2 px)."""
    cx((x0, x1, y, y + 0.006, z0, z1), ouro(), contorno=False)


def puxador_vertical(x, y, z0, z1):
    """O puxador de latão em barra, vertical, encostado na frente."""
    cx((x - PH * 0.5, x + PH * 0.5, y, y + 0.018, z0, z1), ouro(), contorno=False)


def portas_laca(x0, x1, y1, z0, z1, n, mat=LACA_MARFIM, vinco='#b8b0a2'):
    """As portas sem puxador (o vinco fino entre elas e o canal de latão em cima)."""
    w = (x1 - x0) / n
    for k in range(1, n):
        xx = x0 + k * w
        cx((xx - PH * 0.4, xx + PH * 0.4, y1, y1 + 0.003, z0 + 0.02, z1 - 0.02), liso(vinco), contorno=False)
    friso_ouro(x0 + 0.01, x1 - 0.01, y1, z1 - 0.03, z1 - 0.018)


# =====================================================================================================================
# A COZINHA GOURMET
# =====================================================================================================================
def _base_cozinha(x0, x1, y0, y1, zt=0.9):
    """O gabinete de baixo em laca grafite (o rodapé recuado escuro) com o tampo de Calacatta de 4 cm e a frente do tampo."""
    cx((x0 + 0.03, x1 - 0.03, y0, y1 - 0.06, 0.0, 0.1), liso('#141416'))
    cx((x0, x1, y0, y1 - 0.02, 0.1, zt - 0.04), {'*': LACA_GRAFITE, 'frente': LACA_GRAFITE})
    portas_laca(x0, x1, y1 - 0.02, 0.1, zt - 0.04, 3, LACA_GRAFITE, '#121214')
    cx((x0 - 0.01, x1 + 0.01, y0, y1 + 0.02, zt - 0.04, zt), calacata(3), ch=0.006)


def _espelho_marmore(x0, x1, y0, z0, z1, seed=4):
    """O painel de Calacatta atrás da bancada (do tampo até a coifa), encostado na parede."""
    cx((x0, x1, y0, y0 + 0.03, z0, z1), {'*': calacata(seed), 'frente': calacata(seed)}, ch=0.0)


def bancada_cooktop():
    """A bancada do cooktop (2 x 1): o gabinete grafite, o Calacatta, o cooktop de vidro preto com as bocas, o painel de mármore e a coifa de latão."""
    x0, x1, y0, y1 = 0.02, 1.48, 0.02, 0.66
    _base_cozinha(x0, x1, y0, y1)
    _espelho_marmore(x0, x1, y0, 0.9, 1.55)
    # o cooktop por indução: o vidro preto liso com os quatro círculos finos
    zc = 0.9
    xc0, xc1, yc0, yc1 = 0.38, 1.12, 0.16, 0.56

    def vidro(L, n, P):
        out = np.tile(hx('#101014'), (len(P), 1))
        for (a, b_) in ((0.56, 0.28), (0.94, 0.28), (0.56, 0.45), (0.94, 0.45)):
            r = np.sqrt((P[:, 0] - a) ** 2 + (P[:, 1] - b_) ** 2)
            out = np.where((np.abs(r - 0.09) < 0.008)[:, None], hx('#4a4a52'), out)
        out = np.where(((P[:, 1] > yc1 - 0.04) & (np.abs(P[:, 0] - 0.75) < 0.12))[:, None], hx('#c84a2a'), out)
        return out
    cx((xc0, xc1, yc0, yc1, zc, zc + 0.008), {'cima': emissivo(vidro), '*': liso('#1a1a1e')}, contorno=False)
    # a coifa: a caixa de latão escovado presa no painel, com a luz embaixo
    cx((0.4, 1.1, y0 + 0.03, 0.46, 1.55, 1.72), {'*': ouro(), 'baixo': liso('#fff0c8')}, ch=0.008)
    cx((0.55, 0.95, y0 + 0.03, 0.2, 1.72, 2.1), ouro(), ch=0.006)
    peg(x0, x1, y0, y1)


def bancada_pia():
    """A bancada da pia (2 x 1): o gabinete grafite, o Calacatta com a cuba embutida e a torneira gourmet de latão, o painel de mármore."""
    x0, x1, y0, y1 = 0.02, 1.48, 0.02, 0.66
    _base_cozinha(x0, x1, y0, y1)
    _espelho_marmore(x0, x1, y0, 0.9, 1.55, seed=6)
    # a cuba: o recorte escuro no tampo (inox fosco por dentro)
    cx((0.42, 1.08, 0.18, 0.54, 0.86, 0.902), {'cima': liso('#8a9096'), '*': liso('#6a7076')}, contorno=False)
    cx((0.46, 1.04, 0.22, 0.5, 0.86, 0.903), liso('#5a6066'), contorno=False)
    # a torneira gourmet: a haste alta curvada de latão
    o = novo()
    _poligono_rodado(0.75, 0.12, [(0.9, 0.03), (0.92, 0.022), (1.22, 0.016)], vol(0.75, 0.12, OURO, brilho=0.8), o, lados=10, tampa_mat=liso(OURO_L))
    o = novo()
    ES.haste((0.75, 0.12, 1.22), (0.75, 0.34, 1.22), 0.026, ouro(), o, 0.026)
    o = novo()
    ES.haste((0.75, 0.34, 1.22), (0.75, 0.34, 1.12), 0.022, ouro(), o, 0.022)
    # o pano de prato dobrado e a saboneteira de vidro
    cx((1.16, 1.36, 0.5, 0.6, 0.9, 0.915), liso('#d8d2c8'), contorno=False)
    CA.C().cilindro(1.3, 0.2, 0.03, 0.9, 1.04, LAB.vidro_mat('#c8d8d4'), M, novo(), lados=10, tampa_mat=ouro())
    peg(x0, x1, y0, y1)


def armario_cozinha_laca():
    """A coluna de fornos (2 x 1, 2,2 m): a laca marfim do chão ao teto, o forno e o forno a vapor de vidro preto, os puxadores de latão."""
    x0, x1, y0, y1 = 0.02, 1.48, 0.04, 0.68
    zt = 2.2
    cx((x0 + 0.03, x1 - 0.03, y0, y1 - 0.05, 0.0, 0.1), liso('#141416'))
    cx((x0, x1, y0, y1, 0.1, zt), {'*': LACA_MARFIM, 'frente': LACA_MARFIM})
    portas_laca(x0, x1, y1, 0.1, zt, 2)
    # os dois fornos de vidro preto embutidos na metade da esquerda, com o painel de latão
    for (z0, z1) in ((0.78, 1.28), (1.32, 1.66)):
        cx((x0 + 0.06, (x0 + x1) / 2 - 0.04, y1, y1 + 0.012, z0, z1), {'frente': LAB.vidro_mat('#16161c'), '*': liso('#101014')}, contorno=False)
        cx((x0 + 0.06, (x0 + x1) / 2 - 0.04, y1 + 0.012, y1 + 0.016, z1 - 0.05, z1 - 0.02), ouro(), contorno=False)
    # a metade da direita: as portas com os puxadores de latão compridos
    for xx in ((x0 + x1) / 2 + 0.06, x1 - 0.06):
        puxador_vertical(xx, y1, 0.6, 1.6)
    peg(x0, x1, y0, y1)


def ilha_marmore():
    """
    A ilha em cascata (3 x 2, 0,92 m): o tampo grosso de Calacatta descendo até o chão nas duas pontas (a cascata), o
    miolo recuado em laca grafite com as portas, o filete de latão.
    """
    x0, x1, y0, y1 = 0.04, 3 * CASA - 0.04, 0.12, 2 * CASA - 0.12
    zt = 0.92
    e = 0.06
    cx((x0 + e, x1 - e, y0 + 0.06, y1 - 0.12, 0.0, zt - e), {'*': LACA_GRAFITE, 'frente': LACA_GRAFITE})
    portas_laca(x0 + e, x1 - e, y1 - 0.12, 0.08, zt - e, 4, LACA_GRAFITE, '#121214')
    cx((x0, x1, y0, y1, zt - e, zt), calacata(8), ch=0.006)
    for (a, b) in ((x0, x0 + e), (x1 - e, x1)):
        cx((a, b, y0, y1, 0.0, zt - e), calacata(9), ch=0.006)
    friso_ouro(x0 + e, x1 - e, y1 - 0.12, zt - e - 0.012, zt - e)
    peg(x0, x1, y0, y1)


def geladeira_embutida():
    """
    A geladeira de porta dupla (2 x 1, 2,2 m; 23/10, o Felipe: "faz uma geladeira porta dupla"): as duas portas altas de
    inox escovado lado a lado, os puxadores longos no meio, o dispenser de água e gelo na porta da esquerda.
    """
    x0, x1, y0, y1 = 0.03, 2 * CASA - 0.03, 0.04, 0.7
    zt = 2.2

    def escovado(L, n, P):
        out = np.tile(hx('#b4b8bc'), (len(P), 1))
        if abs(n[2]) < 0.5:
            out = np.where((np.floor(P[:, 2] / PZ) % 5 == 0)[:, None], hx('#c4c8cc'), out)
        return out
    cx((x0 + 0.02, x1 - 0.02, y0, y1 - 0.04, 0.0, 0.08), liso('#141416'))
    cx((x0, x1, y0, y1, 0.08, zt), {'*': emissivo(escovado), 'cima': liso('#c8ccd0')})
    xm = (x0 + x1) / 2
    # a fresta entre as duas portas e os dois puxadores longos de inox claro, juntos no meio
    cx((xm - PH * 0.5, xm + PH * 0.5, y1, y1 + 0.003, 0.1, zt - 0.02), liso('#3a3e42'), contorno=False)
    for xx in (xm - 0.07, xm + 0.07):
        cx((xx - PH * 0.6, xx + PH * 0.6, y1, y1 + 0.03, 0.5, 1.8), liso('#dce0e2'), contorno=False)
    # o dispenser de água e gelo na porta da esquerda (o nicho escuro com a luz azul)
    cx((x0 + 0.14, xm - 0.2, y1, y1 + 0.004, 1.02, 1.4), liso('#1a1c20'), contorno=False)
    ol = CZ.c.novo_obj(3, contorno=False, sombra=False)
    CZ.luzes.add(ol)
    CZ.c.caixa((x0 + 0.18, xm - 0.24, y1 + 0.004, y1 + 0.006, 1.33, 1.36), liso('#7ad0ff'), M, ol)
    # o painelzinho digital na porta da direita
    cx((xm + 0.12, xm + 0.26, y1, y1 + 0.004, 1.5, 1.56), liso('#1a1c20'), contorno=False)
    peg(x0, x1, y0, y1)


def estante_despensa():
    """
    A despensa organizada (2 x 1, 2,2 m): as prateleiras de laca marfim com o filete de latão, os potes de vidro com
    tampa de latão em fileira, as caixas de linho, as garrafas de azeite, os vinhos deitados embaixo.
    """
    x0, x1, y0, y1 = 0.03, 1.47, 0.04, 0.58
    h = 2.2
    cx((x0, x1, y0, y0 + 0.03, 0.0, h), LACA_MARFIM)
    for xx in (x0, x1 - 0.03):
        cx((xx, xx + 0.03, y0, y1, 0.0, h), LACA_MARFIM)
    zs = (0.06, 0.5, 0.94, 1.38, 1.82, h - 0.03)
    for z in zs:
        cx((x0, x1, y0, y1, z, z + 0.03), {'*': LACA_MARFIM, 'cima': liso('#efe9de')})
        friso_ouro(x0 + 0.03, x1 - 0.03, y1, z + 0.006, z + 0.024)
    xi, xf = x0 + 0.07, x1 - 0.07
    for k, z in enumerate(zs[:-1]):
        z += 0.03
        if k == 0:
            # os vinhos deitados (os gargalos para a frente)
            for i in range(9):
                xx = xi + i * (xf - xi) / 8
                o = novo()
                CA.C().elipsoide(np.array([xx, (y0 + y1) / 2, z + 0.05]), np.array([0.04, 0.17, 0.045]), liso('#2a3a28'), o, brilho=0.6)
                cx((xx - 0.012, xx + 0.012, y1 - 0.08, y1 - 0.02, z + 0.04, z + 0.065), liso('#6a1a20'), contorno=False)
        elif k in (1, 3):
            for i in range(7):
                xx = xi + 0.04 + i * (xf - xi - 0.08) / 6
                CA.C().cilindro(xx, (y0 + y1) / 2 + 0.04, 0.05, z, z + 0.24 - 0.04 * (i % 2), LAB.vidro_mat('#d4e0dc'), M, novo(), lados=12, tampa_mat=ouro())
                cx((xx - 0.035, xx + 0.035, (y0 + y1) / 2 + 0.04, (y0 + y1) / 2 + 0.06, z + 0.02, z + 0.12),
                   liso(['#d8b870', '#c8a060', '#e8dcc0', '#a8683a', '#f0e8d0', '#7a5a3a', '#d0c0a0'][i]), contorno=False)
        else:
            for i in range(3):
                a = xi + i * (xf - xi) / 3
                cx((a + 0.02, a + (xf - xi) / 3 - 0.02, y0 + 0.08, y1 - 0.06, z, z + 0.26), {'*': liso('#cfc6b4'), 'cima': liso('#ddd5c4'), 'frente': liso('#c4baa6')})
                cx((a + 0.12, a + 0.2, y1 - 0.061, y1 - 0.055, z + 0.16, z + 0.2), ouro(), contorno=False)
    peg(x0, x1, y0, y1)


def cesto_roupa():
    """O cesto de roupa (1 x 1): a palha trançada clara com a alça de couro e o lençol branco dobrado em cima."""
    xc, yc = 0.375, 0.375

    def palha(P, b):
        th = np.arctan2(P[:, 1] - yc, P[:, 0] - xc)
        t = (np.floor(th * 0.2 / PH) + np.floor(P[:, 2] / PZ)) % 2
        return np.where((t == 0)[:, None], _tom(b, 1.12), b)
    o = novo()
    _poligono_rodado(xc, yc, [(0.0, 0.18), (0.05, 0.21), (0.46, 0.23), (0.5, 0.22)], vol(xc, yc, '#c8a870', faixas=palha), o, lados=18, tampa_mat=liso('#3a2a1a'))
    cx((xc - 0.16, xc + 0.16, yc - 0.12, yc + 0.12, 0.44, 0.52), CA.lencol('#f2ede4'), contorno=False)
    peq(xc - 0.23, xc + 0.23, yc - 0.23, yc + 0.23, 0.0)
    peg(xc - 0.23, xc + 0.23, yc - 0.23, yc + 0.23)


# =====================================================================================================================
# O JANTAR E A ESCULTURA
# =====================================================================================================================
def mesa_jantar_marmore():
    """
    A mesa de jantar de Calacatta (4 x 2, 0,76 m): o tampo de 6 cm com a borda chanfrada e as duas bases esculpidas de
    latão (o trapézio em leque), recuadas.
    """
    x0, x1, y0, y1 = 0.06, 4 * CASA - 0.06, 0.1, 2 * CASA - 0.1
    zt = 0.76
    ym = (y0 + y1) / 2
    for xb in (x0 + 0.55, x1 - 0.55):
        o = novo()
        for k in range(6):
            z0 = k * (zt - 0.06) / 6
            z1 = (k + 1) * (zt - 0.06) / 6
            w = 0.1 + 0.07 * abs(k - 2.5)
            cx((xb - 0.06, xb + 0.06, ym - w, ym + w, z0, z1), ouro(), oid=o)
        cx((xb - 0.1, xb + 0.1, ym - 0.24, ym + 0.24, 0.0, 0.02), ouro(), oid=o)
    cx((x0, x1, y0, y1, zt - 0.06, zt), calacata(12), ch=0.012)
    peg(x0, x1, y0, y1)


def aparador_marmore():
    """O aparador (2 x 1, 0,9 m): a laca preta ripada (as caneluras), o tampo de Nero Marquina, os pés de latão."""
    x0, x1, y0, y1 = 0.03, 1.47, 0.08, 0.62
    zt = 0.9
    for (a, b_) in ((x0 + 0.06, y0 + 0.05), (x1 - 0.06, y0 + 0.05), (x0 + 0.06, y1 - 0.05), (x1 - 0.06, y1 - 0.05)):
        _poligono_rodado(a, b_, [(0.0, 0.016), (0.14, 0.02)], vol(a, b_, OURO, brilho=0.8), novo(), lados=8)

    def ripado(L, n, P):
        out = np.tile(hx('#1e1d22'), (len(P), 1))
        if abs(n[1]) > 0.5:
            out = np.where((np.floor(P[:, 0] / PH) % 3 == 0)[:, None], hx('#323138'), out)
        return out
    cx((x0, x1, y0, y1, 0.14, zt - 0.04), {'*': LACA_NOITE, 'frente': emissivo(ripado)})
    friso_ouro(x0, x1, y1, 0.14, 0.16)
    cx((x0 - 0.02, x1 + 0.02, y0 - 0.01, y1 + 0.02, zt - 0.04, zt), nero(14), ch=0.006)
    peg(x0, x1, y0, y1)


def escultura_moderna():
    """A escultura (1 x 1, 2,2 m): o pedestal de Nero Marquina e, em cima, a fita de bronze dourado girando em laço (as gotas empilhadas)."""
    xc, yc = 0.375, 0.375
    cx((xc - 0.22, xc + 0.22, yc - 0.22, yc + 0.22, 0.0, 1.05), nero(20), ch=0.01)
    cx((xc - 0.24, xc + 0.24, yc - 0.24, yc + 0.24, 1.05, 1.09), ouro(), ch=0.006)
    o = novo()
    n = 22
    for k in range(n):
        t = k / (n - 1)
        a = t * math.pi * 3.2
        r = 0.16 * math.sin(t * math.pi) + 0.03
        p = np.array([xc + r * math.cos(a), yc + r * math.sin(a), 1.12 + t * 1.0])
        CA.C().elipsoide(p, np.array([0.06, 0.06, 0.07]), liso(OURO if k % 3 else OURO_L), o, brilho=0.9)
    peg(xc - 0.24, xc + 0.24, yc - 0.24, yc + 0.24)


# =====================================================================================================================
# OS QUARTOS: a laca marfim, o latão, as camas estofadas
# =====================================================================================================================
def _pes_latao(x0, x1, y0, y1, z1, r=0.016, dentro=0.05):
    for (a, b_) in ((x0 + dentro, y0 + dentro), (x1 - dentro, y0 + dentro), (x0 + dentro, y1 - dentro), (x1 - dentro, y1 - dentro)):
        _poligono_rodado(a, b_, [(0.0, r * 0.7), (z1, r)], vol(a, b_, OURO, brilho=0.8), novo(), lados=8)


def _gavetas(x0, x1, y1, z0, z1, n, puxador=True):
    """As frentes de gaveta em laca (o vinco entre elas) com o puxador de latão em barra no meio."""
    h = (z1 - z0) / n
    for k in range(1, n):
        zz = z0 + k * h
        cx((x0 + 0.02, x1 - 0.02, y1, y1 + 0.003, zz - PZ * 0.4, zz + PZ * 0.4), liso('#b8b0a2'), contorno=False)
    if puxador:
        xm = (x0 + x1) / 2
        for k in range(n):
            zz = z0 + (k + 0.5) * h
            cx((xm - 0.08, xm + 0.08, y1, y1 + 0.016, zz - PZ * 0.6, zz + PZ * 0.6), ouro(), contorno=False)


def criado_laca():
    """O criado-mudo (1 x 1, 0,6 m): a laca marfim com duas gavetas, o tampo de Calacatta, os pés finos de latão."""
    x0, x1, y0, y1 = 0.1, 0.65, 0.12, 0.6
    zt = 0.6
    _pes_latao(x0, x1, y0, y1, 0.14)
    cx((x0, x1, y0, y1, 0.14, zt - 0.03), {'*': LACA_MARFIM, 'frente': LACA_MARFIM})
    _gavetas(x0, x1, y1, 0.14, zt - 0.03, 2)
    cx((x0 - 0.01, x1 + 0.01, y0 - 0.01, y1 + 0.01, zt - 0.03, zt), calacata(22), ch=0.004)
    peg(x0, x1, y0, y1)


def armario_laca():
    """O guarda-roupa (2 x 1, 2 m): a laca marfim ripada do chão ao alto, a faixa de espelho no meio, os puxadores longos de latão."""
    x0, x1, y0, y1 = 0.02, 1.48, 0.06, 0.66
    zt = 2.0

    def ripado(L, n, P):
        out = np.tile(hx('#e6dfd2'), (len(P), 1))
        if abs(n[1]) > 0.5:
            out = np.where((np.floor(P[:, 0] / PH) % 4 == 0)[:, None], hx('#d4ccbe'), out)
        return out
    cx((x0 + 0.02, x1 - 0.02, y0, y1 - 0.03, 0.0, 0.08), liso('#2a2826'))
    cx((x0, x1, y0, y1, 0.08, zt), {'*': LACA_MARFIM, 'frente': emissivo(ripado)})
    xm = (x0 + x1) / 2
    cx((xm - 0.14, xm + 0.14, y1, y1 + 0.008, 0.16, zt - 0.08), {'*': MC.vidro_espelho(xm - 0.14, xm + 0.14, 0.16, zt - 0.08, seed=3)}, contorno=False)
    for xx in (xm - 0.19, xm + 0.19):
        puxador_vertical(xx, y1, 0.7, 1.4)
    friso_ouro(x0, x1, y1, zt - 0.03, zt - 0.015)
    peg(x0, x1, y0, y1)


def comoda_laca():
    """A cômoda (2 x 1, 0,9 m): três gavetões de laca marfim, o tampo de Calacatta, os pés de latão."""
    x0, x1, y0, y1 = 0.04, 1.46, 0.1, 0.62
    zt = 0.9
    _pes_latao(x0, x1, y0, y1, 0.14)
    cx((x0, x1, y0, y1, 0.14, zt - 0.03), {'*': LACA_MARFIM, 'frente': LACA_MARFIM})
    _gavetas(x0, x1, y1, 0.14, zt - 0.03, 3)
    cx((x0 - 0.01, x1 + 0.01, y0 - 0.01, y1 + 0.01, zt - 0.03, zt), calacata(24), ch=0.004)
    peg(x0, x1, y0, y1)


def escrivaninha_vidro():
    """A escrivaninha (2 x 1, 0,76 m): o tampo de vidro fumê sobre o quadro de latão, a gavetinha de laca grafite embaixo."""
    x0, x1, y0, y1 = 0.06, 1.44, 0.1, 0.62
    zt = 0.76
    o = novo()
    for xx in (x0, x1 - 0.025):
        for yy in (y0, y1 - 0.025):
            cx((xx, xx + 0.025, yy, yy + 0.025, 0.0, zt - 0.02), ouro(), oid=o)
    for yy in (y0, y1 - 0.025):
        cx((x0, x1, yy, yy + 0.025, zt - 0.05, zt - 0.02), ouro(), oid=o)
    cx((x0 + 0.3, x1 - 0.3, y0 + 0.04, y1 - 0.04, zt - 0.14, zt - 0.03), {'*': LACA_GRAFITE, 'frente': LACA_GRAFITE})
    cx((0.66, 0.84, y1 - 0.04, y1 - 0.024, zt - 0.1, zt - 0.08), ouro(), contorno=False)
    cx((x0 - 0.01, x1 + 0.01, y0 - 0.01, y1 + 0.01, zt - 0.02, zt), {'*': VIDRO_FUME, 'cima': VIDRO_FUME}, contorno=False)
    peg(x0, x1, y0, y1)


def cadeira_design():
    """A cadeira de design (1 x 1, o assento a 0,45 m): a concha de bouclé com o encosto curvo, os pés de latão finos."""
    xc, yc = 0.375, 0.39
    zs = 0.45
    for (a, b_) in ((xc - 0.17, yc - 0.15), (xc + 0.17, yc - 0.15), (xc - 0.17, yc + 0.17), (xc + 0.17, yc + 0.17)):
        _poligono_rodado(a, b_, [(0.0, 0.012), (zs - 0.08, 0.016)], vol(a, b_, OURO, brilho=0.8), novo(), lados=8)
    b = (xc - 0.23, xc + 0.23, yc - 0.2, yc + 0.24, zs - 0.09, zs)
    ES.malha(b, (0.08, 0.08, 0.03, 0.08), ES.estofado(_BOUCLE, b, 2.0, 7.0, cupula=1.0, grad=0.9), seg=2)
    # o encosto em concha: três gomos curvando atrás
    for (dx, dy) in ((-0.17, -0.12), (0.0, -0.19), (0.17, -0.12)):
        b = (xc + dx - 0.1, xc + dx + 0.1, yc + dy - 0.05, yc + dy + 0.06, zs - 0.04, zs + 0.38)
        ES.malha(b, (0.06, 0.06, 0.04, 0.08), ES.estofado(_BOUCLE, b, 2.0, 7.0, cupula=0.6, grad=0.6), seg=2)
    peg(xc - 0.24, xc + 0.24, yc - 0.25, yc + 0.25)


def _cama_estofada(largura_casas):
    """
    A cama estofada: a cabeceira alta de veludo taupe em gomos verticais (do chão até 1,3 m), a base estofada baixa, o
    lençol marfim, o edredom branco, a manta cinza dobrada no pé, as almofadas.
    """
    x0, x1 = 0.03, largura_casas * CASA - 0.03
    y0, y1 = 0.02, 3 * CASA - 0.04
    zb, zt = 0.14, 0.55
    # a base estofada (o veludo descendo até perto do chão) e o rodapé de latão
    b = (x0 + 0.02, x1 - 0.02, y0 + 0.16, y1, 0.04, zb + 0.18)
    ES.malha(b, (0.03, 0.04, 0.02, 0.03), ES.estofado(_VELUDO_TAUPE, b, 1.6, 5.0, cupula=0, grad=0.8), seg=2)
    cx((x0 + 0.03, x1 - 0.03, y1 - 0.01, y1 + 0.004, 0.02, 0.04), ouro(), contorno=False)
    # a cabeceira em gomos verticais
    n = int(round((x1 - x0) / 0.16))
    for k in range(n):
        a0 = x0 + k * (x1 - x0) / n
        a1 = a0 + (x1 - x0) / n
        b = (a0 + 0.004, a1 - 0.004, y0, y0 + 0.16, 0.04, 1.3)
        ES.malha(b, (0.03, 0.04, 0.05, 0.06), ES.estofado(_VELUDO_TAUPE, b, 2.0, 7.0, cupula=0.4, brilho=True, grad=0.5), seg=2)
    CA.leito(x0 + 0.02, x1 - 0.02, y0 + 0.16, y1 - 0.02, zb + 0.18, zt + 0.12, 'listra', 2 if largura_casas >= 2 else 1, seed=7, borda=0.03)
    # o edredom branco por cima de tudo (a cama de hotel) e a manta cinza no pé
    yq = y0 + 0.66
    b = (x0 + 0.0, x1 - 0.0, yq, y1 - 0.02, zb + 0.14, zt + 0.13)
    BE._p1_malha(b, (0.05, 0.05, 0.015, 0.06), CA.lencol('#f6f3ec'), seg=2)
    b = (x0 - 0.005, x1 + 0.005, y1 - 0.5, y1 - 0.18, zt + 0.1, zt + 0.15)
    BE._p1_malha(b, (0.03, 0.04, 0.015, 0.03), CA.lencol('#8a8890'), seg=2)
    # as almofadas na frente dos travesseiros (veludo taupe e bouclé)
    n_alm = 3 if largura_casas >= 2 else 1
    w = (x1 - x0 - 0.16) / n_alm
    for k, R in enumerate((_VELUDO_TAUPE, _BOUCLE, _VELUDO_TAUPE)[:n_alm]):
        a0 = x0 + 0.08 + k * w
        b = (a0, a0 + w - 0.04, y0 + 0.4, y0 + 0.5, zt + 0.1, zt + 0.32)
        ES.malha(b, (0.05, 0.06, 0.04, 0.06), ES.estofado(R, b, 2.0, 7.0, cupula=1.0), seg=2)
    peg(x0, x1, y0, y1)


def cama_estofada():
    _cama_estofada(2)


def cama_solteiro_estofada():
    _cama_estofada(1)


# =====================================================================================================================
# OS TAPETES CONTEMPORÂNEOS (a lã marfim e cinza com as manchas orgânicas e o fio dourado)
# =====================================================================================================================
def _tapete_moderno(w_casas, d_casas, seed=0):
    x0, x1 = 0.06, w_casas * CASA - 0.06
    y0, y1 = 0.08, d_casas * CASA - 0.08
    campo, cinza, grafite, fio = hx('#e8e2d8'), hx('#bdb6ac'), hx('#7a746c'), hx('#c8a050')

    def f(L, n, P):
        u, v = np.floor(P[:, 0] / PH) * PH, np.floor(P[:, 1] / PH) * PH
        out = np.tile(campo, (len(P), 1))
        s = suave(u, v, 0.55, seed)
        out = np.where((s > 0.6)[:, None], cinza, out)
        out = np.where((s > 0.74)[:, None], grafite, out)
        borda = (np.abs(s - 0.6) < 0.012) | (np.abs(s - 0.74) < 0.01)
        out = np.where(borda[:, None], fio, out)
        # a trama da lã, bem leve
        out = np.where((((np.floor(P[:, 0] / PH) + np.floor(P[:, 1] / PH)) % 7) == 0)[:, None], _tom(out, 0.97), out)
        return out
    CA._tapete(x0, x1, y0, y1, f, borda='#9a948a')


def tapete_contemporaneo():
    _tapete_moderno(4, 3, seed=31)


def tapete_contemporaneo_v():
    _tapete_moderno(3, 4, seed=33)


def tapete_contemporaneo_p():
    _tapete_moderno(2, 3, seed=35)


# =====================================================================================================================
# AS ESTANTES ENTALHADAS (o século XVII: a nogueira maciça entalhada à mão, lustrosa, com a talha dourada)
# =====================================================================================================================
_NOG_LUSTRE = '#4a2412'


def _talha(x0, x1, y, z0, z1, seed=0):
    """A talha dourada em volutas (as folhas de acanto em relevo): a faixa de ouro com os enrolamentos em pixel."""
    ondas = max(2, round((x1 - x0) / 0.24))

    def f(L, n, P):
        u = (P[:, 0] - x0) / (x1 - x0)
        w = (P[:, 2] - z0) / (z1 - z0)
        out = np.tile(hx('#5a2c14'), (len(P), 1))
        onda = 0.5 + 0.34 * np.sin(u * math.pi * 2 * ondas)
        folha = np.abs(w - onda) < 0.2
        out = np.where(folha[:, None], hx('#c89a3a'), out)
        out = np.where((folha & (w > onda))[:, None], hx('#e8c870'), out)
        out = np.where((np.abs(w - onda) < 0.06)[:, None], hx('#8a6420'), out)
        return out
    cx((x0, x1, y, y + 0.03, z0, z1), {'frente': emissivo(f), '*': MSE.dourado(seed)}, contorno=False)


def _estante_entalhada(w_casas, h):
    """
    A estante: a nogueira escura polida (o lustre do verniz), a cornija alta com a talha dourada e o frontão quebrado,
    as pilastras caneladas com os capitéis dourados, as prateleiras cheias de livros de couro e um ou outro objeto.
    """
    x0, x1, y0, y1 = 0.02, w_casas * CASA - 0.02, 0.03, 0.56
    NOG = mad2(_NOG_LUSTRE, eixo=1, seed=71, passo=0.05, claro=1.18, escuro=0.88)
    # o corpo: as costas e os lados
    cx((x0, x1, y0, y0 + 0.03, 0.12, h - 0.3), NOG)
    for xx in (x0, x1 - 0.1):
        cx((xx, xx + 0.1, y0, y1, 0.0, h - 0.3), NOG)

        def canelura(L, n, P, xx=xx):
            out = np.tile(hx('#5a2c16'), (len(P), 1))
            if abs(n[1]) > 0.5:
                out = np.where(((np.floor((P[:, 0] - xx) / PH) % 3) == 1)[:, None], hx('#3a1a0c'), out)
            return out
        # a pilastra canelada na frente, com o capitel e a base dourados
        cx((xx - 0.01, xx + 0.11, y1, y1 + 0.03, 0.14, h - 0.42), {'frente': emissivo(canelura), '*': NOG})
        cx((xx - 0.02, xx + 0.12, y1, y1 + 0.04, h - 0.42, h - 0.32), MSE.dourado(72), ch=0.006)
        cx((xx - 0.02, xx + 0.12, y1, y1 + 0.04, 0.08, 0.14), MSE.dourado(73), ch=0.006)
    # a base (o plinto) e a cornija
    cx((x0 - 0.02, x1 + 0.02, y0, y1 + 0.04, 0.0, 0.12), {'*': NOG, 'cima': liso('#6a3a1c')}, ch=0.008)
    cx((x0 - 0.04, x1 + 0.04, y0, y1 + 0.06, h - 0.32, h - 0.22), {'*': NOG, 'cima': liso('#6a3a1c')}, ch=0.01)
    _talha(x0 + 0.1, x1 - 0.1, y1 + 0.06, h - 0.31, h - 0.23, seed=74)
    cx((x0 - 0.06, x1 + 0.06, y0, y1 + 0.08, h - 0.22, h - 0.16), {'*': MSE.dourado(75), 'cima': liso('#7a4420')}, ch=0.008)
    # o frontão quebrado: as duas volutas e o vaso dourado no meio
    xm = (x0 + x1) / 2
    for (a, b_) in ((x0 + 0.06, xm - 0.14), (xm + 0.14, x1 - 0.06)):
        cx((a, b_, y0 + 0.2, y1 + 0.02, h - 0.16, h - 0.08), {'*': NOG, 'frente': NOG}, ch=0.01)
    o = novo()
    CA.C().elipsoide(np.array([xm, (y0 + y1) / 2 + 0.1, h - 0.06]), np.array([0.08, 0.06, 0.07]), liso('#d8b050'), o, brilho=0.8)
    # as prateleiras com o friso de ouro, e os livros
    nz = int((h - 0.5) / 0.42)
    zs = [0.12 + k * (h - 0.44 - 0.12) / nz for k in range(nz + 1)]
    for k, z in enumerate(zs[:-1]):
        cx((x0 + 0.1, x1 - 0.1, y0 + 0.03, y1 - 0.02, z, z + 0.03), {'*': NOG, 'cima': liso('#6a3a1c')})
        cx((x0 + 0.1, x1 - 0.1, y1 - 0.02, y1 - 0.014, z + 0.008, z + 0.022), ouro(), contorno=False)
        alto = zs[k + 1] - z - 0.08
        CA._fileira(x0 + 0.13, x1 - 0.13 - (0.24 if k % 2 else 0), y0 + 0.06, y1 - 0.05, z + 0.03, alto, 80 + k, 30)
        if k % 2:
            # o objeto de arte no fim da prateleira: o vaso de porcelana azul e branca, ou o vaso de bronze
            CA.C().cilindro(x1 - 0.24, (y0 + y1) / 2, 0.06, z + 0.03, z + 0.03 + alto * 0.7, liso('#e8ecf0' if k % 4 == 1 else '#b08a3a'), M, novo(), lados=12,
                            tampa_mat=liso('#2a4a8a' if k % 4 == 1 else '#d8b050'))
    peg(x0, x1, y0, y1)


def estante_entalhada():
    _estante_entalhada(3, 2.9)


def estante_entalhada_2():
    _estante_entalhada(2, 2.2)


# =====================================================================================================================
# O ESCRITÓRIO, O BAR E A SALA
# =====================================================================================================================
def mesa_executiva():
    """A mesa do CEO (4 x 2, 0,78 m): o tampo grosso de Nero Marquina, os dois cavaletes de latão em U, o descanso de couro."""
    x0, x1, y0, y1 = 0.1, 4 * CASA - 0.1, 0.1, 2 * CASA - 0.1
    zt = 0.78
    for xb in (x0 + 0.18, x1 - 0.18):
        o = novo()
        cx((xb - 0.03, xb + 0.03, y0 + 0.08, y0 + 0.14, 0.0, zt - 0.08), ouro(), oid=o)
        cx((xb - 0.03, xb + 0.03, y1 - 0.14, y1 - 0.08, 0.0, zt - 0.08), ouro(), oid=o)
        cx((xb - 0.03, xb + 0.03, y0 + 0.08, y1 - 0.08, 0.0, 0.04), ouro(), oid=o)
    # o gaveteiro suspenso de laca grafite embaixo do tampo
    cx((x0 + 0.6, x1 - 0.6, y0 + 0.2, y1 - 0.2, zt - 0.16, zt - 0.08), {'*': LACA_GRAFITE, 'frente': LACA_GRAFITE})
    cx((x0, x1, y0, y1, zt - 0.08, zt), nero(40), ch=0.012)
    # o descanso de couro preto
    cx(((x0 + x1) / 2 - 0.36, (x0 + x1) / 2 + 0.36, y1 - 0.5, y1 - 0.12, zt, zt + 0.008), {'cima': liso('#1a1614'), '*': liso('#141210')}, contorno=False)
    peg(x0, x1, y0, y1)


def bar_vidro():
    """O bar do escritório (2 x 1, 1,2 m): o quadro de latão com as portas de vidro fumê, as garrafas acesas por dentro, o tampo de Nero."""
    x0, x1, y0, y1 = 0.04, 1.46, 0.08, 0.6
    zt = 1.2
    cx((x0, x1, y0, y0 + 0.03, 0.08, zt - 0.04), LACA_NOITE)
    o = novo()
    for xx in (x0, (x0 + x1) / 2 - 0.012, x1 - 0.025):
        cx((xx, xx + 0.025, y0, y1, 0.0, zt - 0.04), ouro(), oid=o)
    for zz in (0.06, 0.6):
        cx((x0, x1, y0, y1, zz, zz + 0.02), {'*': ouro(), 'cima': LAB.vidro_mat('#5a6268')}, oid=o)
    # as garrafas (cristal, uísque, conhaque) acesas pela luz quente de dentro
    for k in range(6):
        BAR.garrafa(x0 + 0.14 + k * 0.21, (y0 + y1) / 2, 0.08, [1, 5, 1, 3, 1, 2][k], k=1.1, luz=True)
    for k in range(5):
        BAR.garrafa(x0 + 0.2 + k * 0.24, (y0 + y1) / 2, 0.62, [1, 2, 0, 1, 5][k], k=1.0)
    ol = CZ.c.novo_obj(3, contorno=False, sombra=False)
    CZ.luzes.add(ol)
    CZ.c.caixa((x0 + 0.04, x1 - 0.04, y0 + 0.03, y0 + 0.035, 0.1, 0.56), liso('#5a3a1a'), M, ol)
    # o vidro fumê na frente (as riscas de reflexo deixam ver as garrafas)
    of = CZ.c.novo_obj(3, contorno=False, sombra=False)
    for (a, b_) in ((x0 + 0.06, x0 + 0.1), ((x0 + x1) / 2 + 0.05, (x0 + x1) / 2 + 0.09)):
        CZ.c.face_plana([(a, y1 + 0.004, 0.12), (b_, y1 + 0.004, 0.12), (b_ + 0.12, y1 + 0.004, zt - 0.1), (a + 0.12, y1 + 0.004, zt - 0.1)], (0, 1, 0), liso('#c8d8dc'), M, of)
    cx((x0 - 0.02, x1 + 0.02, y0 - 0.01, y1 + 0.02, zt - 0.04, zt), nero(42), ch=0.006)
    peg(x0, x1, y0, y1)


def sofa_moderno():
    """O sofá de bouclé (3 x 1, o assento a 0,45 m): baixo e fundo, os braços largos e retos, as almofadas soltas, o rodapé de latão."""
    x0, x1 = 0.03, 3 * CASA - 0.03
    y0, y1 = 0.04, 0.72
    zs = 0.42
    cx((x0 + 0.04, x1 - 0.04, y0 + 0.04, y1 - 0.04, 0.0, 0.05), ouro(), ch=0.004)
    b = (x0, x1, y0, y1, 0.05, zs - 0.12)
    ES.malha(b, (0.04, 0.04, 0.02, 0.04), ES.estofado(_BOUCLE, b, 1.6, 5.4, cupula=0, grad=0.8), seg=2)
    br = 0.2
    for (a0, a1) in ((x0, x0 + br), (x1 - br, x1)):
        b = (a0, a1, y0, y1, 0.05, zs + 0.18)
        ES.malha(b, (0.06, 0.06, 0.04, 0.06), ES.estofado(_BOUCLE, b, 2.0, 7.0, cupula=0.6, grad=0.8), seg=2)
    b = (x0 + br, x1 - br, y0, y0 + 0.22, zs - 0.12, zs + 0.38)
    ES.malha(b, (0.08, 0.08, 0.06, 0.1), ES.estofado(_BOUCLE, b, 2.0, 7.2, cupula=0.6, grad=0.6), seg=2)
    for i in range(3):
        a0 = x0 + br + (x1 - x0 - 2 * br) * i / 3
        a1 = x0 + br + (x1 - x0 - 2 * br) * (i + 1) / 3
        b = (a0 + 0.006, a1 - 0.006, y0 + 0.2, y1, zs - 0.12, zs)
        ES.malha(b, (0.06, 0.06, 0.03, 0.07), ES.estofado(_BOUCLE, b, 2.2, 7.8, cupula=1.1, grad=1.0), seg=2)
    # as almofadas soltas: uma de veludo esmeralda e uma de veludo taupe
    for (xa, R) in ((x0 + br + 0.08, ML._ESMERALDA), (x1 - br - 0.4, _VELUDO_TAUPE)):
        b = (xa, xa + 0.32, y0 + 0.18, y0 + 0.3, zs, zs + 0.3)
        ES.malha(b, (0.06, 0.08, 0.05, 0.08), ES.estofado(R, b, 2.0, 7.0, cupula=1.0, brilho=True), seg=2)
    peg(x0, x1, y0, y1)


def bar_marmore():
    """O balcão do bar (2 x 1, 1,1 m): a frente inteira de Nero Marquina, o tampo de latão escovado, a fita de luz embaixo do tampo, o descanso de pé."""
    x0, x1, y0, y1 = 0.02, 1.48, 0.06, 0.64
    zt = 1.1
    cx((x0 + 0.04, x1 - 0.04, y0, y1 - 0.06, 0.0, 0.08), liso('#0c0c0e'))
    cx((x0, x1, y0, y1 - 0.04, 0.08, zt - 0.05), {'*': nero(50), 'frente': nero(51)})
    ol = CZ.c.novo_obj(3, contorno=False, sombra=False)
    CZ.luzes.add(ol)
    CZ.c.caixa((x0 + 0.02, x1 - 0.02, y1 - 0.04, y1 - 0.034, zt - 0.08, zt - 0.06), liso('#ffd890'), M, ol)
    cx((x0 - 0.02, x1 + 0.02, y0 - 0.02, y1 + 0.04, zt - 0.05, zt), {'*': ouro(), 'cima': ouro()}, ch=0.006)
    # o descanso de pé de latão, na frente embaixo
    o = novo()
    ES.haste((x0 + 0.06, y1 + 0.05, 0.22), (x1 - 0.06, y1 + 0.05, 0.22), 0.03, ouro(), o, 0.03)
    for xx in (x0 + 0.1, x1 - 0.1):
        cx((xx - 0.012, xx + 0.012, y1 - 0.04, y1 + 0.05, 0.2, 0.24), ouro(), oid=o)
    peg(x0, x1, y0, y1)


def adega_iluminada():
    """A adega de parede (2 x 1, 2 m): o quadro preto, as prateleiras de vidro acesas por trás, as fileiras de garrafas, o tampo de latão."""
    x0, x1, y0, y1 = 0.03, 1.47, 0.04, 0.5
    h = 2.0
    cx((x0, x1, y0, y0 + 0.03, 0.0, h), LACA_NOITE)
    for xx in (x0, x1 - 0.04):
        cx((xx, xx + 0.04, y0, y1, 0.0, h), LACA_NOITE)
    cx((x0, x1, y0, y1, 0.0, 0.1), LACA_NOITE)
    cx((x0, x1, y0, y1, h - 0.06, h), {'*': ouro(), 'cima': ouro()})
    # a luz quente atrás de tudo (o fundo aceso)
    ol = CZ.c.novo_obj(3, contorno=False, sombra=False)
    CZ.luzes.add(ol)
    CZ.c.caixa((x0 + 0.04, x1 - 0.04, y0 + 0.03, y0 + 0.034, 0.1, h - 0.06), liso('#e8a850'), M, ol)
    zs = (0.1, 0.48, 0.86, 1.24, 1.62)
    for k, z in enumerate(zs):
        cx((x0 + 0.04, x1 - 0.04, y0 + 0.04, y1, z, z + 0.012), {'*': LAB.vidro_mat('#c8dcdc'), 'cima': LAB.vidro_mat('#d8ecec')}, contorno=False)
        for i in range(7):
            BAR.garrafa(x0 + 0.13 + i * 0.2, (y0 + y1) / 2 + 0.02, z + 0.012, [0, 1, 3, 0, 1, 5, 2][(i + k) % 7], k=1.05)
    peg(x0, x1, y0, y1)


def banqueta_design():
    """A banqueta alta (1 x 1, o assento a 0,75 m): as pernas e o aro de latão, o assento redondo de couro caramelo com o encosto baixo."""
    xc, yc = 0.375, 0.375
    zs = 0.75
    for (a, b_) in ((xc - 0.14, yc - 0.14), (xc + 0.14, yc - 0.14), (xc - 0.14, yc + 0.14), (xc + 0.14, yc + 0.14)):
        o = novo()
        ES.haste((a, b_, 0.0), (xc + (a - xc) * 0.7, yc + (b_ - yc) * 0.7, zs - 0.06), 0.022, ouro(), o, 0.022)
    o = novo()
    _poligono_rodado(xc, yc, [(0.28, 0.17), (0.3, 0.17)], vol(xc, yc, OURO, brilho=0.8), o, lados=14)
    o = novo()
    _poligono_rodado(xc, yc, [(zs - 0.07, 0.18), (zs - 0.02, 0.2), (zs, 0.18)], vol(xc, yc, '#9a5a2a', brilho=0.5), o, lados=16, tampa_mat=liso('#b06e38'))
    cx((xc - 0.16, xc + 0.16, yc - 0.2, yc - 0.14, zs - 0.02, zs + 0.18), {'*': liso('#9a5a2a'), 'cima': liso('#b06e38')}, ch=0.01)
    peg(xc - 0.2, xc + 0.2, yc - 0.2, yc + 0.2)


def banco_moderno():
    """O banco do corredor (2 x 1, o assento a 0,45 m): o estofado de bouclé comprido sobre o quadro fino de latão."""
    x0, x1, y0, y1 = 0.08, 1.42, 0.18, 0.56
    zs = 0.45
    _pes_latao(x0, x1, y0, y1, zs - 0.12, r=0.014, dentro=0.04)
    cx((x0, x1, y0, y1, zs - 0.14, zs - 0.12), ouro(), ch=0.0)
    b = (x0, x1, y0, y1, zs - 0.12, zs)
    ES.malha(b, (0.04, 0.05, 0.03, 0.05), ES.estofado(_BOUCLE, b, 2.0, 7.0, cupula=1.0, grad=1.0), seg=2)
    peg(x0, x1, y0, y1)


def cuba_marmore():
    """A pia do banheiro (1 x 1, 0,9 m): o tampo suspenso de Calacatta com a cuba esculpida, a torneira de latão, o gaveteiro de laca."""
    x0, x1, y0, y1 = 0.04, 0.71, 0.06, 0.6
    zt = 0.9
    cx((x0 + 0.04, x1 - 0.04, y0, y1 - 0.06, 0.42, zt - 0.08), {'*': LACA_GRAFITE, 'frente': LACA_GRAFITE})
    friso_ouro(x0 + 0.06, x1 - 0.06, y1 - 0.06, zt - 0.2, zt - 0.188)
    cx((x0, x1, y0, y1, zt - 0.08, zt), calacata(60), ch=0.008)
    cx((x0 + 0.12, x1 - 0.12, y0 + 0.16, y1 - 0.1, zt - 0.02, zt + 0.001), {'cima': liso('#d8d2c6'), '*': liso('#c8c2b6')}, contorno=False)
    MC._torneira_dourada((x0 + x1) / 2, y0 + 0.08, zt)
    peg(x0, x1, y0, y1)


ITENS = {
    'bancada_cooktop': (2, 1, (0.0, 0.0), bancada_cooktop, {}),
    'bancada_pia': (2, 1, (0.0, 0.0), bancada_pia, {}),
    'armario_cozinha_laca': (2, 1, (0.0, 0.0), armario_cozinha_laca, {}),
    'ilha_marmore': (3, 2, (0.0, 0.0), ilha_marmore, {}),
    'geladeira_embutida': (2, 1, (0.0, 0.0), geladeira_embutida, {}),
    'estante_despensa': (2, 1, (0.0, 0.0), estante_despensa, {}),
    'cesto_roupa': (1, 1, (0.0, 0.0), cesto_roupa, {}),
    'mesa_jantar_marmore': (4, 2, (0.0, 0.0), mesa_jantar_marmore, {}),
    'aparador_marmore': (2, 1, (0.0, 0.0), aparador_marmore, {}),
    'escultura_moderna': (1, 1, (0.0, 0.0), escultura_moderna, {}),
    'criado_laca': (1, 1, (0.0, 0.0), criado_laca, {}),
    'armario_laca': (2, 1, (0.0, 0.0), armario_laca, {}),
    'comoda_laca': (2, 1, (0.0, 0.0), comoda_laca, {}),
    'escrivaninha_vidro': (2, 1, (0.0, 0.0), escrivaninha_vidro, {}),
    'cadeira_design': (1, 1, (0.0, 0.0), cadeira_design, {}),
    'cama_estofada': (2, 3, (0.0, 0.0), cama_estofada, {}),
    'cama_solteiro_estofada': (1, 3, (0.0, 0.0), cama_solteiro_estofada, {}),
    'tapete_contemporaneo': (4, 3, (0.0, 0.0), tapete_contemporaneo, {}),
    'tapete_contemporaneo_v': (3, 4, (0.0, 0.0), tapete_contemporaneo_v, {}),
    'tapete_contemporaneo_p': (2, 3, (0.0, 0.0), tapete_contemporaneo_p, {}),
    'estante_entalhada': (3, 1, (0.0, 0.0), estante_entalhada, {}),
    'estante_entalhada_2': (2, 1, (0.0, 0.0), estante_entalhada_2, {}),
    'mesa_executiva': (4, 2, (0.0, 0.0), mesa_executiva, {}),
    'bar_vidro': (2, 1, (0.0, 0.0), bar_vidro, {}),
    'sofa_moderno': (3, 1, (0.0, 0.0), sofa_moderno, {}),
    'bar_marmore': (2, 1, (0.0, 0.0), bar_marmore, {}),
    'adega_iluminada': (2, 1, (0.0, 0.0), adega_iluminada, {}),
    'banqueta_design': (1, 1, (0.0, 0.0), banqueta_design, {}),
    'banco_moderno': (2, 1, (0.0, 0.0), banco_moderno, {}),
    'cuba_marmore': (1, 1, (0.0, 0.0), cuba_marmore, {}),
}


# =====================================================================================================================
# A SUÍTE: a cama do casal estofada, a penteadeira moderna, a mesinha lateral
# =====================================================================================================================
def cama_master_estofada():
    """A cama do casal (3 x 3): a cama estofada de cabeceira alta de veludo taupe, na largura king."""
    _cama_estofada(3)


def penteadeira_moderna():
    """A penteadeira (2 x 1, 1,7 m): o tampo de Calacatta sobre a laca marfim com as gavetas, o espelho redondo iluminado por trás, os pés de latão."""
    x0, x1, y0, y1 = 0.06, 1.44, 0.08, 0.56
    zt = 0.76
    _pes_latao(x0, x1, y0, y1, 0.5)
    for (a, b_) in ((x0, x0 + 0.42), (x1 - 0.42, x1)):
        cx((a, b_, y0, y1, 0.5, zt - 0.03), {'*': LACA_MARFIM, 'frente': LACA_MARFIM})
        _gavetas(a, b_, y1, 0.5, zt - 0.03, 1)
    cx((x0 - 0.01, x1 + 0.01, y0 - 0.01, y1 + 0.01, zt - 0.03, zt), calacata(70), ch=0.004)
    # o espelho redondo na parede, com a luz quente atrás (o halo) e a moldura fina de latão
    xm, zc, r = (x0 + x1) / 2, 1.3, 0.34
    halo = CZ.c.novo_obj(3, contorno=False, sombra=False)
    CZ.luzes.add(halo)
    MC.extruda_xz(MC.oval_perfil(xm, zc, r + 0.03, r + 0.03), y0, y0 + 0.01, {'*': liso('#fff0c8')}, halo)
    MC.extruda_xz(MC.oval_perfil(xm, zc, r + 0.012, r + 0.012), y0 + 0.01, y0 + 0.03, {'*': ouro()}, novo())
    MC.extruda_xz(MC.oval_perfil(xm, zc, r, r), y0 + 0.03, y0 + 0.034, {'*': MC.vidro_espelho(xm - r, xm + r, zc - r, zc + r, seed=9), 'frente': MC.vidro_espelho(xm - r, xm + r, zc - r, zc + r, seed=9)}, novo(contorno=False))
    # os perfumes de cristal e a caixinha de joias em cima
    for k, cor in enumerate(('#e8c8d8', '#d8e8f0', '#f0dcb0')):
        CA.C().cilindro(x0 + 0.2 + k * 0.1, y0 + 0.24, 0.03, zt, zt + 0.1 + 0.02 * k, LAB.vidro_mat(cor), M, novo(), lados=8, tampa_mat=ouro())
    cx((x1 - 0.34, x1 - 0.14, y0 + 0.16, y0 + 0.32, zt, zt + 0.07), {'*': liso('#1f3a46'), 'cima': ouro()}, ch=0.004)
    peg(x0, x1, y0, y1)


def mesa_lateral_marmore():
    """A mesinha lateral (1 x 1, 0,7 m): o tampo redondo de Calacatta sobre a base de latão em ampulheta."""
    xc, yc = 0.375, 0.375
    zt = 0.7
    o = novo()
    _poligono_rodado(xc, yc, [(0.0, 0.16), (0.03, 0.16), (0.1, 0.05), (zt - 0.12, 0.04), (zt - 0.04, 0.12)], vol(xc, yc, OURO, brilho=0.8), o, lados=16)
    o = novo()
    _poligono_rodado(xc, yc, [(zt - 0.04, 0.27), (zt, 0.27)], vol(xc, yc, '#f1eee8', brilho=0.5, faixas=MSE.faixa_marmore(xc, yc, '#f1eee8', '#a89878', seed=71, raio=0.27)), o, lados=20, tampa_mat=calacata(71))
    peq(xc - 0.27, xc + 0.27, yc - 0.27, yc + 0.27, zt)
    peg(xc - 0.27, xc + 0.27, yc - 0.27, yc + 0.27)


# =====================================================================================================================
# A PORTA DE LACA (portal@laca): a mesma porta do jogo (estrutura.py), com a folha de laca marfim, a moldura marfim com o
# filete de ouro e a maçaneta de latão. Vale nos pisos da mansão (MATERIAL em client/src/render/furniArte.ts).
# =====================================================================================================================
import estrutura as EST  # noqa: E402


def _moldura_laca():
    forro = liso('#d8d0c2')
    EST._cx((EST.VAO0 - 0.015, EST.VAO0, -EST.REV, 0.0, 0.0, EST.ZV), forro)
    EST._cx((EST.VAO1, EST.VAO1 + 0.015, -EST.REV, 0.0, 0.0, EST.ZV), forro)
    EST._cx((EST.VAO0, EST.VAO1, -EST.REV, 0.03, 0.0, 0.022), calacata(80))
    for (a0, a1) in ((0.0, EST.VAO0), (EST.VAO1, CASA)):
        fr = ((a0 + 2 * PH, 0.94), (a1 - 2 * PH, 1.04))
        EST._cx((a0, a1, 0.0, 0.035, 0.0, EST.ZV), EST.guarnicao('#e6dfd2', eixo=1, seed=int(a0 * 100), frisos=fr, topo='#f0ebe2'))
        EST._cx((a0 - 0.004, a1 + 0.004, 0.0, 0.045, 0.0, 0.15), liso('#f4f0e8'))
    EST._cx((0.0, CASA, 0.0, 0.04, EST.ZV, EST.ZG), EST.guarnicao('#e6dfd2', eixo=0, seed=35, frisos=((EST.ZV + 2 * PZ, 0.94),), topo='#f0ebe2'))
    EST._cx((-0.015, CASA + 0.015, 0.0, 0.055, EST.ZG, EST.ZG + 0.035), liso('#f4f0e8'))
    EST._cx((-0.015, CASA + 0.015, 0.055, 0.06, EST.ZG + 0.005, EST.ZG + 0.02), ouro())


def _porta_laca(estado):
    def d():
        rot = EST._rot()
        _moldura_laca()
        antes = EST.FOLHA
        EST.FOLHA = '#e2dbce'
        try:
            if estado == 0:
                EST._vao_escuro()
                EST._folha_aberta(rot, False)
            else:
                EST._folha_fechada(rot, False)
                if estado == 2:
                    EST._tranca()
        finally:
            EST.FOLHA = antes
    return d


ITENS['cama_master_estofada'] = (3, 3, (0.0, 0.0), cama_master_estofada, {})
ITENS['penteadeira_moderna'] = (2, 1, (0.0, 0.0), penteadeira_moderna, {})
ITENS['mesa_lateral_marmore'] = (1, 1, (0.0, 0.0), mesa_lateral_marmore, {})
ITENS['portal@laca'] = (1, 1, (0.0, 0.0), _porta_laca(0), {'1': _porta_laca(1), '2': _porta_laca(2)})
SO_GIROS = {'portal@laca': (4, 2)}
