"""
GRUPO D da Mansão Albuquerque, "o escritório do CEO e a biblioteca" (21/10): o gabinete do pai (o CEO atual do
Frigorífico Albuquerque: madeira escura, couro, cofre, bar, o touro de bronze, o mapa e as fotos das unidades) e a
grande biblioteca de dinheiro velho. Pixel art 1:1 só por código, no estilo de escritorio.py (o Gabinete do Veríssimo)
e de casa.py, de quem este módulo reaproveita as peças (estofado, almofadas, lombadas, abajur, papéis...).

Tudo no giro 4 (a frente para +y), a pegada começando em (0, 0), no tamanho final do catálogo (a altura em METROS; o
`aumento` 1,2 das duas mesas entra só na largura e no fundo: a arte sai com 3,6 x 1,8 m e a pegada fica no meio).

Decisões:
  - tom da casa: nogueira escura (corpo #44281a, tampos nas tábuas #583520), couro verde-garrafa e preto, dourado
    discreto (#b8902a / #e0c060), mármore, cristal. Nada de vermelho berrante: o vinho só nas lombadas e no veludo.
  - mesa_ceo (vao 'fundo'): o tampo a 0,78 m com o forro de couro verde e o friso dourado; os dois gaveteiros
    viram para +y (o lado da cadeira) e o painel de trás fecha o vão; em cima só o que o catálogo pede.
  - mesa_leitura (vao 'vazada'): só tampo, saia recuada e quatro pernas torneadas nas quinas; nada embaixo.
  - cadeira_ceo (sit): o `height` (0,52 m) é o assento; o encosto alto passa dele; as costas ficam em -y.
  - cofre / bar_escritorio: 0 FECHADO, '1' ABERTO. O bar aberto traz a prateleira iluminada (peça que brilha).
  - itens de parede: a pintura é pintada num plano (Pl, de parede_casa) e a moldura é volume; tamanhos em ITENS_PAREDE.
"""
import math

import numpy as np

import cozinha as CZ
import base_estilo as BE
import casa as CA
import medieval as MD
import escritorio as E
import parede_casa as PC
from base_estilo import (hx, liso, mad2, tab2, vol, _tom, _pau, _barra, _p1_malha, _poligono_rodado, _disco, PH, PZ)
from motor import emissivo, ruido, suave, KX, KZ

M = BE.M
CASA = 0.75
cx, novo, peg, fp, luz_obj, pau = MD.cx, MD.novo, MD.peg, MD.fp, MD.luz_obj, MD.pau
peq = E.peq


def C():
    return CZ.c


# ---------------------------------------------------------------------------------------------------------------------
# as cores e os materiais da casa
# ---------------------------------------------------------------------------------------------------------------------
ND = '#44281a'                                   # a nogueira escura (o corpo dos móveis)
ND_E = '#2a170d'                                 # o escuro (rodapé, vão, junta)
ND_L = '#5e3a24'                                 # a quina que pega luz
ND_TAB = ['#583520', '#52301d', '#5e3a24']      # as tábuas dos tampos
OURO, OURO_L, OURO_E = '#b8902a', '#e0c060', '#7a5e1a'
VERDE_COURO = '#2c4a37'
BRONZE = ['#2a1c12', '#4a321c', '#6e4a26', '#946a34', '#b88e48', '#d8b268']
_PRETO = E._PRETO


def hexs(c):
    c = np.clip(np.round(np.asarray(c, float)), 0, 255).astype(int)
    return '#%02x%02x%02x' % tuple(c)


def ouro(b=None):
    """O dourado discreto: a cor lisa com a quina de cima mais clara."""
    return _pau(OURO, OURO_L, quina=1.2, b=b)


def painel_rel(x0, x1, y0, y1, z0, z1, eixo='y', seed=0, face=+1):
    """Um painel em relevo (a almofada entalhada) colado numa face: de pé em y (a frente/costas) ou em x (os lados)."""
    m = {'cima': liso(ND_L), '*': mad2('#4e2e1c', eixo=1, seed=seed, passo=0.04)}
    cx((x0, x1, y0, y1, z0, z1), m)


def couro_mesa(bx0, bx1, by0, by1, cor=VERDE_COURO, filete=OURO, folga=0.05):
    """
    O forro de couro do tampo: o couro com a beira mais escura, o friso dourado de 1 px dentro da beira com um
    quadradinho dourado em cada quina, e uns gastos claros (couro velho e bom).
    """
    c0 = hx(cor)
    el = hx('#b8902a') if filete is None else hx(filete)

    def f(L, n, P):
        X, Y = P[:, 0], P[:, 1]
        out = np.tile(c0, (len(P), 1))
        if abs(n[2]) < 0.5:
            return np.tile(_tom(c0, 0.6), (len(P), 1))
        dx = np.minimum(X - bx0, bx1 - X)
        dy = np.minimum(Y - by0, by1 - Y)
        d = np.minimum(dx, dy)
        out = np.where((d < 2 * PH)[:, None], _tom(c0, 0.72), out)
        fio = (d >= folga) & (d < folga + PH)
        out = np.where(fio[:, None], el, out)
        canto = (dx < folga + 4 * PH) & (dy < folga + 4 * PH) & (dx >= folga) & (dy >= folga) & ((dx < folga + PH * 1.5) | (dy < folga + PH * 1.5))
        out = np.where(canto[:, None], _tom(el, 1.1), out)
        return out
    return emissivo(f)


def placa_nome(x, y, z, larg=0.3, seed=1):
    """A plaquinha de nome (latão sobre a base de nogueira): faz de cada lado, com as 'letras' em riscas escuras."""
    cx((x - larg / 2 - 0.02, x + larg / 2 + 0.02, y - 0.045, y + 0.045, z, z + 0.02), {'cima': liso(ND_L), '*': _pau(ND, quina=1.2, b=(0, 0, 0, 0, 0, z + 0.02))})

    def f(L, n, P):
        out = np.tile(hx(OURO), (len(P), 1))
        if abs(n[2]) > 0.5:
            return np.tile(hx(OURO_L), (len(P), 1))
        u = (P[:, 0] - (x - larg / 2)) / PH
        v = (P[:, 2] - (z + 0.02)) / PZ
        letra = (v >= 2) & (v < 4) & (u >= 3) & (u < larg / PH - 3) & (ruido(np.floor(u / 2), seed) > 0.28)
        letra2 = (v >= 5) & (v < 6) & (u >= 7) & (u < larg / PH - 7)
        out = np.where((letra | letra2)[:, None], hx(OURO_E), out)
        out = np.where((v >= 6)[:, None], hx(OURO_L), out)
        return out
    cx((x - larg / 2, x + larg / 2, y - 0.012, y + 0.012, z + 0.02, z + 0.09), {'*': emissivo(f)})
    peq(x - larg / 2, x + larg / 2, y - 0.045, y + 0.045, z)


def caneta_tinteiro(x, y, z, ang=0.5):
    """A caneta-tinteiro deitada: o corpo preto laqueado, a anilha e o bico de ouro, o clipe (tudo em 1 a 2 px)."""
    d = np.array([math.cos(ang), math.sin(ang), 0.0])
    p0 = np.array([x, y, z + 0.012])
    o = novo()
    E.cil_eixo(p0, p0 + d * 0.13, 0.011, liso('#181618'), o, lados=8, tampa_mat=liso('#2a2628'))
    o = novo()
    E.cil_eixo(p0 + d * 0.125, p0 + d * 0.138, 0.012, liso(OURO_L), o, lados=8)
    o = novo()
    E.cil_eixo(p0 + d * 0.138, p0 + d * 0.17, 0.006, liso(OURO), o, lados=6, r1=0.001)
    o = novo()
    E.cil_eixo(p0 - d * 0.01, p0 + d * 0.05, 0.012, liso('#181618'), o, lados=8)
    peq(x - 0.02, x + 0.17, y - 0.02, y + 0.1, z)


def tinteiro_cristal(x, y, z):
    """O tinteiro de cristal lapidado com a tampa de prata: o vidro claro com a faixa de facetas e o brilho."""
    def faceta(P, b):
        zz = P[:, 2] - z
        b = np.where(((zz > 0.012) & (zz <= 0.012 + PZ))[:, None], hx('#ffffff'), b)
        return np.where(((zz > 0.036) & (zz <= 0.036 + PZ))[:, None], hx('#9fb4c4'), b)
    o = novo()
    C().cilindro(x, y, 0.05, z, z + 0.058, vol(x, y, '#c8d8e4', brilho=0.6, faixas=faceta), M, o, lados=10, tampa=False)
    o = novo()
    C().cilindro(x, y, 0.028, z + 0.058, z + 0.074, vol(x, y, '#c4c8cc', brilho=0.6), M, o, lados=10, tampa_mat=liso('#e8eaec'))
    peq(x - 0.05, x + 0.05, y - 0.05, y + 0.05, z)


def notebook_fechado(x0, y0, z, ang=0.0):
    """O notebook fechado: a chapa de alumínio escovado (tampa cinza-prata), a borda escura e a maçã... só o retângulo claro."""
    w, d = 0.31, 0.215
    o = novo()
    pts = E.ret_girado(x0 + w / 2, y0 + d / 2, ang, w / 2, d / 2)

    def f(L, n, P):
        if abs(n[2]) > 0.5:
            out = np.tile(hx('#b4b8bc'), (len(P), 1))
            u = (P[:, 0] - x0) * math.cos(ang) + (P[:, 1] - y0) * math.sin(ang)
            v = -(P[:, 0] - x0) * math.sin(ang) + (P[:, 1] - y0) * math.cos(ang)
            out = np.where((np.floor(v / PH) % 3 == 0)[:, None], hx('#a8acb0'), out)
            lg = (np.abs(u - w / 2) < 0.022) & (np.abs(v - d / 2) < 0.016)
            return np.where(lg[:, None], hx('#e6e8ea'), out)
        return np.tile(hx('#6a6e72'), (len(P), 1))
    E.prisma(pts, z, z + 0.017, emissivo(f), o)
    peq(x0 - 0.02, x0 + w + 0.02, y0 - 0.02, y0 + d + 0.02, z)


# ---------------------------------------------------------------------------------------------------------------------
# a mesa do CEO (4 x 2, aumento 1,2: 3,6 x 1,8 m; o tampo a 0,78 m; vao 'fundo')
# ---------------------------------------------------------------------------------------------------------------------
def _mesa_ceo():
    w, d = 3.6, 1.8
    x, y = -0.3, -0.15
    x1, y1 = x + w, y + d
    h, tp = 0.78, 0.075
    zb = 0.07
    zt = h - tp - 0.04
    # o tampo de nogueira e a moldura de baixo (a gola do tampo)
    cx((x, x1, y, y1, h - tp, h), {'cima': tab2(ND_TAB, 0.3, ND_E, eixo=0, seed=201, comp=1.4, org=y),
                                   '*': _pau('#4e2e1c', quina=1.3, b=(0, 0, 0, 0, h - tp, h))})
    cx((x + 0.035, x1 - 0.035, y + 0.035, y1 - 0.035, zt, h - tp), _pau(ND_E, '#4a2c1a', quina=1.2, b=(0, 0, 0, 0, zt, h - tp)))
    pw = 0.86
    bordas = []
    for (a0, a1) in ((x + 0.12, x + 0.12 + pw), (x1 - 0.12 - pw, x1 - 0.12)):
        bordas.append((a0, a1))
        ya, yb = y + 0.12, y1 - 0.1
        # o rodapé (plinto) com o filete dourado
        cx((a0 - 0.02, a1 + 0.02, ya - 0.01, yb + 0.02, 0.0, zb), _pau(ND_E, '#3e2616', quina=1.2, b=(0, 0, 0, 0, 0, zb)))
        cx((a0 - 0.02, a1 + 0.02, yb + 0.02, yb + 0.03, zb - 0.014, zb - 0.002), liso(OURO))
        fi = np.linspace(zb + 0.025, zt - 0.02, 5)
        pain = [(a0 + 0.04, a1 - 0.04, fi[i] + 0.006, fi[i + 1] - 0.006, 'g') for i in range(4)]
        cx((a0, a1, ya, yb, zb, zt), {'frente': CA.almofadas(ND, pain, eixo=0, seed=202 + a0, passo=0.05, fresta='#1c0e06'),
                                      'costas': CA.almofadas(ND, [], seed=203),
                                      '*': mad2(ND, eixo=1, seed=204, passo=0.05)})
        for i in range(4):
            CA.alca((a0 + a1) / 2, (fi[i] + fi[i + 1]) / 2, yb, 0.16)
            # a fechadura da gaveta (1 px escuro entre as alças e a quina)
        # os painéis em relevo nos lados e atrás
        for (b0, b1) in ((ya + 0.1, (ya + yb) / 2 - 0.04), ((ya + yb) / 2 + 0.04, yb - 0.1)):
            for xs_ in ((a0 - 0.014, a0), (a1, a1 + 0.014)):
                painel_rel(xs_[0], xs_[1], b0, b1, zb + 0.1, zt - 0.1, seed=205)
        painel_rel(a0 + 0.12, a1 - 0.12, ya - 0.014, ya, zb + 0.1, zt - 0.1, seed=206)
    # o painel de trás do vão (fecha a mesa por trás; a cadeira encaixa na frente dele), almofadado dos dois lados
    i0, i1 = bordas[0][1], bordas[1][0]
    cx((i0, i1, y + 0.16, y + 0.2, zb + 0.03, zt), {'cima': liso(ND_L), '*': mad2(ND, seed=207, passo=0.05)})
    n = 3
    lw = (i1 - i0 - 0.2) / n
    for k in range(n):
        u0 = i0 + 0.1 + k * lw + 0.02
        u1 = i0 + 0.1 + (k + 1) * lw - 0.02
        painel_rel(u0, u1, y + 0.2, y + 0.214, zb + 0.14, zt - 0.1, seed=208)
        painel_rel(u0, u1, y + 0.146, y + 0.16, zb + 0.14, zt - 0.1, seed=209)
    # a gaveta de cima do meio (o escrivão), embaixo do tampo
    cx((i0, i1, y1 - 0.44, y1 - 0.1, zt - 0.11, zt), {'frente': CA.almofadas(ND, [(i0 + 0.05, i1 - 0.05, zt - 0.1, zt - 0.012, 'g')], seed=210, fresta='#1c0e06'),
                                                     '*': mad2(ND, seed=211)})
    CA.alca((i0 + i1) / 2 - 0.2, zt - 0.055, y1 - 0.1, 0.12)
    CA.alca((i0 + i1) / 2 + 0.2, zt - 0.055, y1 - 0.1, 0.12)
    cx(((i0 + i1) / 2 - 0.012, (i0 + i1) / 2 + 0.012, y1 - 0.1, y1 - 0.092, zt - 0.07, zt - 0.04), liso(OURO_E))
    peg(x, x1, y, y1)
    # o couro do tampo, com o friso dourado
    bx0, bx1, by0, by1 = x + 0.27, x1 - 0.27, y + 0.18, y1 - 0.18
    cx((bx0, bx1, by0, by1, h, h + 0.008), {'cima': couro_mesa(bx0, bx1, by0, by1), '*': liso('#1c2e22')})
    zc = h + 0.008
    # em cima: a plaquinha de nome (de frente para o CEO), o telefone, o abajur, o notebook, os papéis, a caneta
    placa_nome((bx0 + bx1) / 2, by1 - 0.12, zc, 0.3, seed=3)
    PC.telefone(bx1 - 0.5, by0 + 0.1, zc)
    E._abajur_verde(bx0 + 0.22, by0 + 0.28, zc)
    notebook_fechado(bx1 - 0.55, by0 + 0.5, zc, ang=-0.12)
    E._papeis((bx0 + bx1) / 2 - 0.35, (by0 + by1) / 2 - 0.02, zc, n=3, seed=5, ang=0.08)
    E._papeis((bx0 + bx1) / 2 - 0.05, (by0 + by1) / 2 + 0.1, zc, n=2, seed=9, ang=-0.2)
    caneta_tinteiro((bx0 + bx1) / 2 + 0.02, (by0 + by1) / 2 + 0.02, zc + 2 * PZ * 0.7, ang=0.9)
    tinteiro_cristal((bx0 + bx1) / 2 + 0.38, by1 - 0.16, zc)


# ---------------------------------------------------------------------------------------------------------------------
# a cadeira do CEO (1 x 1, o assento a 0,52 m)
# ---------------------------------------------------------------------------------------------------------------------
COURO_PRETO = E._p1_rampa(['#121010', '#1c1918', '#272322', '#34302e', '#443f3d', '#58524f', '#6e6763', '#868079', '#a09a92', '#bab4ac'])


def _cadeira_ceo():
    cx_, cy_ = 0.375, 0.4
    zs = 0.52
    R = COURO_PRETO
    E.base_estrela(cx_, cy_, 0.31, cor=E.CROMO)
    E.coluna_gas(cx_, cy_, 0.13, zs - 0.12)
    cx((cx_ - 0.12, cx_ + 0.12, cy_ - 0.1, cy_ + 0.1, zs - 0.15, zs - 0.1), E.metal('#a4aab2', (0, 0, 0, 0, zs - 0.15, zs - 0.1), quina=1.2))
    # o assento fundo (couro, a cúpula, as tachas de latão) entre os braços grossos
    b = (cx_ - 0.24, cx_ + 0.24, cy_ - 0.22, cy_ + 0.28, zs - 0.13, zs)
    E.malha(b, (0.08, 0.08, 0.025, 0.06), E.estofado(R, b, 2.0, 6.6, cupula=1.3, grad=1.0, brilho=True, tachas=(zs - 0.055, 3)))
    # o encosto: a concha de trás, o painel capitonê com os botões, as duas asas e a cabeceira
    yb0 = cy_ - 0.37
    b = (cx_ - 0.29, cx_ + 0.29, yb0, yb0 + 0.07, zs + 0.0, zs + 0.86)
    E.malha(b, (0.1, 0.02, 0.07, 0.14), E.estofado(R, b, 1.8, 5.2, cupula=0.2, grad=0.4))
    b = (cx_ - 0.25, cx_ + 0.25, yb0 + 0.05, yb0 + 0.15, zs + 0.06, zs + 0.8)
    E.malha(b, (0.08, 0.04, 0.06, 0.12), E.estofado(R, b, 2.6, 7.6, cupula=0.8, grad=0.6, capi=(0.12, 0.11), tachas=(zs + 0.76, 3)))
    for sx in (-1, 1):
        a0, a1 = (cx_ + sx * 0.235, cx_ + sx * 0.3)
        b = (min(a0, a1), max(a0, a1), yb0 + 0.04, yb0 + 0.27, zs + 0.2, zs + 0.84)
        E.malha(b, (0.03, 0.08, 0.04, 0.1), E.estofado(R, b, 2.2, 7.2, cupula=0.5, grad=0.6, brilho=True))
    b = (cx_ - 0.17, cx_ + 0.17, yb0 + 0.04, yb0 + 0.17, zs + 0.74, zs + 1.0)
    E.malha(b, (0.07, 0.05, 0.05, 0.12), E.estofado(R, b, 2.8, 7.8, cupula=1.0, grad=0.2, capi=(0.12, 0.11), brilho=True))
    # a haste cromada do encosto atrás
    o = novo()
    cx((cx_ - 0.035, cx_ + 0.035, yb0 - 0.005, yb0 + 0.02, zs - 0.12, zs + 0.3), E.metal('#a4aab2', (0, 0, 0, 0, zs - 0.12, zs + 0.3)), o)
    # os braços: o rolo de couro grosso (de pé na lateral do assento), a base cromada e a tampinha de latão
    for sx in (-1, 1):
        xb = cx_ + sx * 0.31
        o = novo()
        cx((xb - 0.014, xb + 0.014, cy_ - 0.08, cy_ - 0.04, zs - 0.1, zs + 0.2), E.metal('#a4aab2', (0, 0, 0, 0, zs - 0.1, zs + 0.2)), o)
        b = (xb - 0.055, xb + 0.055, cy_ - 0.22, cy_ + 0.25, zs + 0.17, zs + 0.27)
        E.malha(b, (0.04, 0.05, 0.03, 0.045), E.estofado(R, b, 2.6, 7.6, cupula=0.9, brilho=True), seg=2)
        cx((xb - 0.056, xb + 0.056, cy_ + 0.245, cy_ + 0.255, zs + 0.185, zs + 0.255), liso(OURO))
    peg(cx_ - 0.37, cx_ + 0.37, cy_ - 0.37, cy_ + 0.35)


# ---------------------------------------------------------------------------------------------------------------------
# o cofre (1 x 1, 1,25 m): 0 fechado, 1 aberto
# ---------------------------------------------------------------------------------------------------------------------
ACO = '#27432f'          # o aço pintado de verde-escuro
ACO_L = '#3a6044'
ACO_P = '#34553d'        # o painel em relevo dos lados


def _roda_cofre(xc, yf, zc, r=0.12):
    """A roda do segredo (latão): a placa escura, o aro de latão, o miolo escuro, os três raios com os pomos e o cubo."""
    o = novo()
    E.cil_eixo((xc, yf, zc), (xc, yf + 0.012, zc), r + 0.035, liso('#15211a'), o, lados=22, tampa_mat=liso('#1c2b22'))
    o = novo()
    E.cil_eixo((xc, yf + 0.012, zc), (xc, yf + 0.026, zc), r, liso(OURO), o, lados=22, tampa_mat=liso(OURO_L))
    o = novo()
    E.cil_eixo((xc, yf + 0.026, zc), (xc, yf + 0.032, zc), r - 0.028, liso('#1c2b22'), o, lados=20, tampa_mat=liso('#243a2e'))
    for k in range(3):
        a = math.pi / 2 + k * 2 * math.pi / 3 + 0.35
        px, pz = xc + math.cos(a) * (r + 0.005), zc + math.sin(a) * (r + 0.005)
        o = novo()
        E.haste((xc, yf + 0.045, zc), (px, yf + 0.045, pz), 0.032, liso(OURO), o, h=0.032)
        o = novo()
        E.bola((px, yf + 0.05, pz), 0.036, OURO_L, o, rz=0.036)
    o = novo()
    E.cil_eixo((xc, yf + 0.03, zc), (xc, yf + 0.07, zc), 0.036, liso(OURO_L), o, lados=14, tampa_mat=liso('#f6e29a'))


def _livro_familia(x, y, z, ang=0.0, alt=0.06):
    """O livro antigo de capa de couro com o fecho de metal: o couro marrom, os frisos dourados, o fecho de latão."""
    w, d = 0.26, 0.19
    c0 = hx('#6a3820')
    pts = E.ret_girado(x, y, ang, w / 2, d / 2)
    ca, sa = math.cos(ang), math.sin(ang)

    def f(L, n, P):
        u = (P[:, 0] - x) * ca + (P[:, 1] - y) * sa
        v = -(P[:, 0] - x) * sa + (P[:, 1] - y) * ca
        if abs(n[2]) > 0.5:
            out = np.tile(c0, (len(P), 1))
            borda = (np.abs(u) > w / 2 - 3 * PH) | (np.abs(v) > d / 2 - 3 * PH)
            out = np.where(borda[:, None], _tom(c0, 0.8), out)
            fio = ((np.abs(np.abs(u) - (w / 2 - 5 * PH)) < PH * 0.6) & (np.abs(v) < d / 2 - 5 * PH)) | ((np.abs(np.abs(v) - (d / 2 - 5 * PH)) < PH * 0.6) & (np.abs(u) < w / 2 - 5 * PH))
            out = np.where(fio[:, None], hx(OURO), out)
            sel = (np.abs(u) < 0.034) & (np.abs(v) < 0.034)
            return np.where(sel[:, None], hx(OURO_L), out)
        zz = (P[:, 2]) % (alt / 3)
        out = np.tile(hx('#e6d8b4'), (len(P), 1))
        return np.where((zz < PZ * 0.6)[:, None], hx('#c8b88c'), out)
    o = novo()
    E.prisma(pts, z, z + alt, emissivo(f), o)
    o = novo()
    E.prisma(E.ret_girado(x, y, ang, w / 2 + 0.006, d / 2 + 0.006), z - 0.012, z, liso('#4a2416'), o)
    o = novo()
    E.prisma(E.ret_girado(x, y, ang, w / 2 + 0.006, d / 2 + 0.006), z + alt, z + alt + 0.012, liso('#5a2e1a'), o)
    fx, fy = x + (w / 2) * ca, y + (w / 2) * sa
    o = novo()
    E.prisma(E.ret_girado(fx, fy, ang, 0.014, 0.034), z - 0.004, z + alt + 0.01, liso(OURO_L), o)
    peq(x - w / 2, x + w / 2, y - d / 2, y + d / 2, z)


def _maco_dinheiro(x, y, z, ang=0.0, n=3):
    """O maço de notas amarrado com a cinta de papel: o verde das cédulas, a cinta creme no meio."""
    w, d = 0.17, 0.075
    for k in range(n):
        zk = z + k * 0.034
        pts = E.ret_girado(x, y, ang, w / 2, d / 2)

        def f(L, n_, P, ang=ang, x=x, y=y):
            u = (P[:, 0] - x) * math.cos(ang) + (P[:, 1] - y) * math.sin(ang)
            if abs(n_[2]) > 0.5:
                out = np.tile(hx('#9ab88a'), (len(P), 1))
                out = np.where((np.abs(u) < 0.022)[:, None], hx('#efe4bc'), out)
                return np.where((np.abs(u) < 0.012)[:, None], hx('#c8b888'), out)
            out = np.where((np.floor(P[:, 2] / PZ) % 2 == 0)[:, None], hx('#b4d0a4'), hx('#7aa06c'))
            return np.where((np.abs(u) < 0.022)[:, None], hx('#efe4bc'), out)
        o = novo()
        E.prisma(pts, zk, zk + 0.032, emissivo(f), o)
    peq(x - w / 2, x + w / 2, y - d / 2, y + d / 2, z)


def _frente_cofre(x0, x1, y1, zb, zt):
    """A porta fechada (a face +y): a chapa verde com o recuo, o friso dourado em retângulo, os rebites, a placa do fabricante."""
    c0 = hx(ACO)
    el = hx(OURO)

    def f(L, n, P):
        X, Z = P[:, 0], P[:, 2]
        out = np.tile(c0, (len(P), 1))
        dx = np.minimum(X - x0, x1 - X)
        dz = np.minimum(Z - zb, zt - 0.05 - Z)
        dd = np.minimum(dx, dz)
        out = np.where((dd < 0.05)[:, None], _tom(c0, 1.1), out)
        out = np.where(((dd >= 0.05) & (dd < 0.05 + PH))[:, None], _tom(c0, 0.5), out)
        out = np.where(((dd >= 0.05 + PH) & (dd < 0.05 + 2 * PH))[:, None], _tom(c0, 1.3), out)
        out = np.where(((dd >= 0.1) & (dd < 0.1 + PH))[:, None], el, out)
        for (ux, uz) in ((x0 + 0.025, zb + 0.03), (x1 - 0.025, zb + 0.03), (x0 + 0.025, zt - 0.08), (x1 - 0.025, zt - 0.08)):
            r = (np.abs(X - ux) < PH) & (np.abs(Z - uz) < PZ)
            out = np.where(r[:, None], _tom(c0, 1.6), out)
        xm = (x0 + x1) / 2
        pl = (np.abs(X - xm) < 0.12) & (Z > zt - 0.31) & (Z < zt - 0.245)
        out = np.where(pl[:, None], hx(OURO), out)
        pl2 = pl & (Z > zt - 0.29) & (Z < zt - 0.267) & (np.abs(X - xm) < 0.1) & (ruido(np.floor(X / (2 * PH)), 4.0) > 0.25)
        out = np.where(pl2[:, None], hx(OURO_E), out)
        out = np.where((pl & (Z > zt - 0.256))[:, None], hx(OURO_L), out)
        return out
    return emissivo(f)


def _cofre(aberto=False):
    def d():
        x0, x1, y0, y1 = 0.06, 0.69, 0.06, 0.7
        zt = 1.25
        zb = 0.07
        e = 0.05                                           # a espessura da parede do cofre
        zc = zt - 0.05                                     # o alto do corpo (em cima, a cornija)
        cx((x0 - 0.015, x1 + 0.015, y0 - 0.015, y1 + 0.015, 0.0, zb), E.metal('#1c2a22', (0, 0, 0, 0, 0, zb), '#2a3a30'))
        lado = E.metal(ACO, (0, 0, 0, 0, zb, zc), ACO_L, quina=1.2)
        cuerpo = {'cima': E.metal(ACO, None, '#4a7656', quina=False), '*': lado}
        if not aberto:
            cx((x0, x1, y0, y1, zb, zc), {**cuerpo, 'frente': _frente_cofre(x0, x1, y1, zb, zt)})
        else:
            ESC = emissivo(lambda L, n, P: np.tile(hx('#222a25'), (len(P), 1)))
            cx((x0, x1, y0, y0 + e, zb, zc), {**cuerpo, 'frente': ESC})
            cx((x0, x0 + e, y0 + e, y1, zb, zc), {**cuerpo, 'dir': liso('#2c352f')})
            cx((x1 - e, x1, y0 + e, y1, zb, zc), {**cuerpo, 'esq': liso('#252d28')})
            cx((x0 + e, x1 - e, y0 + e, y1, zc - e, zc), {**cuerpo, 'baixo': liso('#161a18')})
            cx((x0 + e, x1 - e, y0 + e, y1, zb, zb + e), {**cuerpo, 'cima': liso('#323a35')})
            # as prateleiras de aço (clarinhas, para o que está nelas aparecer) e a de baixo
            for zs in (0.56, 0.94):
                cx((x0 + e, x1 - e, y0 + e, y1 - 0.005, zs, zs + 0.025), {'cima': liso('#6e7a72'), '*': E.metal('#48524c', (0, 0, 0, 0, zs, zs + 0.025), '#6e7a72')})
            xi0, xi1 = x0 + e, x1 - e
            xm = (xi0 + xi1) / 2
            # embaixo: as pastas de documentos e o maço de dinheiro
            zz = zb + e
            for k, (cor, ang) in enumerate((('#d0ae74', 0.1), ('#b08c52', -0.12), ('#dcc088', 0.2))):
                E._pasta(xi0 + 0.2, y0 + 0.3, zz + k * 0.032, ang, cor, alto=0.03)
            _maco_dinheiro(xi1 - 0.18, y0 + 0.28, zz, ang=0.15, n=3)
            _maco_dinheiro(xi1 - 0.16, y0 + 0.43, zz, ang=-0.1, n=2)
            # no meio: os papéis e as pastas
            E._papeis(xm - 0.1, y0 + 0.3, 0.585, n=4, w=0.22, d=0.28, seed=11, ang=0.05)
            E._pasta(xm + 0.12, y0 + 0.4, 0.585, 0.3, '#c8a46a', alto=0.04)
            # em cima: o livro da família (o couro com o fecho de metal) e uma pasta
            _livro_familia(xm - 0.02, y0 + 0.33, 0.965, ang=-0.12, alt=0.075)
            E._pasta(xi1 - 0.15, y0 + 0.28, 0.965, 0.2, '#b89a5e', alto=0.04)
        # os painéis em relevo nos lados e atrás, a cornija e o friso dourado
        for (a0, a1, ya, yb) in ((x1, x1 + 0.012, y0 + 0.1, y1 - 0.1), (x0 - 0.012, x0, y0 + 0.1, y1 - 0.1)):
            cx((a0, a1, ya, yb, zb + 0.14, zc - 0.16), {'cima': liso(ACO_L), '*': E.metal(ACO_P, (0, 0, 0, 0, zb + 0.14, zc - 0.16), ACO_L)})
        cx((x0 + 0.1, x1 - 0.1, y0 - 0.012, y0, zb + 0.14, zc - 0.16), {'cima': liso(ACO_L), '*': E.metal(ACO_P, (0, 0, 0, 0, zb + 0.14, zc - 0.16), ACO_L)})
        cx((x0 - 0.02, x1 + 0.02, y0 - 0.02, y1 + 0.02, zc, zt), {'cima': E.metal(ACO, None, '#4a7656', quina=False), '*': E.metal('#2f5038', (0, 0, 0, 0, zc, zt), ACO_L, quina=1.25)})
        cx((x0 - 0.022, x1 + 0.022, y0 - 0.022, y1 + 0.022, zc - 0.008, zc), liso(OURO), o=novo(contorno=False))
        if aberto:
            H = (x0 + 0.02, y1)
            ang = 105
            W = (x1 - x0) - 0.04
            CA.porta_giro(H, ang, W, zb + 0.03, zc - 0.03, E.metal(ACO, None, ACO_L), liso('#4a6454'), esp=0.075, lado=1, mat_b=liso('#8a9a90'))
            th = math.radians(ang)
            dx, dy = math.cos(th), math.sin(th)
            px, py = H[0] + dx * (W - 0.05), H[1] + dy * (W - 0.05)
            for zz in (zb + 0.2, (zb + zc) / 2, zc - 0.2):
                o = novo()
                E.cil_eixo((px - 0.025 * dy, py + 0.025 * dx, zz), (px - 0.12 * dy, py + 0.12 * dx, zz), 0.022, liso('#9aa0a6'), o, lados=8, tampa_mat=liso('#d0d4d8'))
            # a roda aparece por trás da porta (a roda de dentro, o contrapeso)
            for zz in (zb + 0.18, zc - 0.2):
                cx((H[0] - 0.05, H[0] + 0.02, H[1] - 0.02, H[1] + 0.05, zz, zz + 0.09), E.metal(OURO_E, (0, 0, 0, 0, zz, zz + 0.09), OURO))
        peg(x0, x1, y0, y1)
    return d


def _cofre_fechado():
    _cofre(False)()
    x0, x1, y1 = 0.06, 0.69, 0.7
    xm = (x0 + x1) / 2
    _roda_cofre(xm - 0.02, y1, 0.74, r=0.125)
    # o puxador de latão (a barra vertical com as duas pontas) à direita
    px = xm + 0.21
    o = novo()
    E.cil_eixo((px, y1 + 0.012, 0.55), (px, y1 + 0.04, 0.55), 0.014, liso(OURO), o, lados=8)
    E.cil_eixo((px, y1 + 0.012, 0.93), (px, y1 + 0.04, 0.93), 0.014, liso(OURO), o, lados=8)
    E.haste((px, y1 + 0.04, 0.55), (px, y1 + 0.04, 0.93), 0.028, liso(OURO), o, h=0.026)
    for zz in (0.22, 0.98):
        o = novo()
        C().cilindro(x0 - 0.005, y1 - 0.005, 0.022, zz, zz + 0.13, vol(x0 - 0.005, y1 - 0.005, OURO, brilho=0.6), M, o, lados=8, tampa_mat=liso(OURO_L))
    cx((xm - 0.03, xm + 0.03, y1, y1 + 0.01, 0.245, 0.33), {'frente': liso(OURO_E), '*': liso(OURO)})
    cx((xm - 0.014, xm + 0.014, y1 + 0.01, y1 + 0.016, 0.265, 0.305), liso('#0e0c0a'))


# ---------------------------------------------------------------------------------------------------------------------
# ---------------------------------------------------------------------------------------------------------------------
# objetos de bar e de mesa: o decanter, o copo, a garrafa, o balde de gelo
# ---------------------------------------------------------------------------------------------------------------------
CRISTAL = '#c4d8e4'


def garrafa(x, y, z, h, r, cor, rotulo=None, ombro=0.62):
    """A garrafa de vidro escuro: o corpo, o ombro, o gargalo, a rolha e (se tem) o rótulo creme com o friso."""
    def faixa(P, b):
        zz = (P[:, 2] - z) / h
        if rotulo:
            b = np.where(((zz > 0.16) & (zz < 0.44))[:, None], hx(rotulo), b)
            b = np.where(((zz > 0.27) & (zz < 0.3))[:, None], hx('#8a2a22'), b)
        return b
    o = novo()
    _poligono_rodado(x, y, [(z, r), (z + h * ombro, r), (z + h * (ombro + 0.12), r * 0.6), (z + h * (ombro + 0.2), r * 0.38), (z + h * 0.95, r * 0.36)],
                     vol(x, y, cor, brilho=0.5, faixas=faixa), o, lados=12)
    C().cilindro(x, y, r * 0.34, z + h * 0.94, z + h, vol(x, y, '#b08a58'), M, novo(), lados=8, tampa_mat=liso('#c8a070'))


def decanter(x, y, z, h=0.26, r=0.055, conteudo='#c88a3a', nivel=0.55, forma=0):
    """O decanter de cristal: a barriga facetada (faixas claras), o pescoço, a rolha de bola; o licor âmbar até `nivel`."""
    def faixa(P, b):
        zz = (P[:, 2] - z) / h
        b = np.where((zz < nivel)[:, None], _tom(hx(conteudo), 1.0) * 0.55 + b * 0.45, b)
        b = np.where(((zz > 0.2) & (zz < 0.2 + PZ / h))[:, None], hx('#ffffff'), b)
        b = np.where(((zz > nivel + 0.0) & (zz < nivel + PZ / h * 1.2))[:, None], _tom(b, 1.25), b)
        return np.where(((zz > 0.62) & (zz < 0.62 + PZ / h))[:, None], hx('#eaf4fa'), b)
    if forma == 0:
        perfil = [(z, r * 0.78), (z + h * 0.06, r), (z + h * 0.42, r), (z + h * 0.62, r * 0.5), (z + h * 0.84, r * 0.42), (z + h * 0.88, r * 0.56), (z + h * 0.9, r * 0.5)]
    else:
        perfil = [(z, r * 0.9), (z + h * 0.06, r), (z + h * 0.62, r * 0.82), (z + h * 0.72, r * 0.5), (z + h * 0.86, r * 0.42), (z + h * 0.88, r * 0.56), (z + h * 0.9, r * 0.5)]
    o = novo()
    _poligono_rodado(x, y, perfil, vol(x, y, CRISTAL, brilho=0.8, faixas=faixa), o, lados=12)
    o = novo()
    C().elipsoide(np.array([x, y, z + h * 0.98]), np.array([r * 0.6, r * 0.6, r * 0.55]), liso('#d8eaf4'), o)
    peq(x - r, x + r, y - r, y + r, z)


def copo(x, y, z, h=0.1, r=0.034, licor=True):
    """O copo de cristal baixo (tumbler): o vidro claro com o fundo grosso e o uísque dentro."""
    def faixa(P, b):
        zz = (P[:, 2] - z) / h
        if licor:
            b = np.where(((zz > 0.12) & (zz < 0.5))[:, None], hx('#c8903e') * 0.6 + b * 0.4, b)
        return np.where((zz < 0.1)[:, None], hx('#f0f8fc'), b)
    o = novo()
    _poligono_rodado(x, y, [(z, r * 0.82), (z + h, r)], vol(x, y, '#d4e4ee', brilho=0.8, faixas=faixa), o, lados=10)
    peq(x - r, x + r, y - r, y + r, z)


def balde_gelo(x, y, z):
    """O balde de gelo de prata: o corpo cônico com os dois anéis, as alças de argola, o gelo e a pinça."""
    def aneis(P, b):
        zz = P[:, 2] - z
        b = np.where(((zz > 0.07) & (zz <= 0.07 + PZ))[:, None], _tom(b, 0.7), b)
        return np.where(((zz > 0.16) & (zz <= 0.16 + PZ))[:, None], _tom(b, 1.25), b)
    o = novo()
    _poligono_rodado(x, y, [(z, 0.065), (z + 0.02, 0.08), (z + 0.17, 0.1), (z + 0.2, 0.105)], vol(x, y, '#c0c4c8', brilho=0.8, faixas=aneis), o, lados=16)

    def gelo(L, n, P):
        r = np.hypot(P[:, 0] - x, P[:, 1] - y)
        k = ruido(np.floor(P[:, 0] / (2 * PH)), np.floor(P[:, 1] / (2 * PH)), 3.0)
        out = np.where((k > 0.5)[:, None], hx('#e6f4fa'), hx('#bcd8e4'))
        return np.where((r > 0.094)[:, None], hx('#d8dcde'), out)
    _disco(x, y, z + 0.2, 0.105, emissivo(gelo), o, lados=16)
    for sx in (-1, 1):
        C().cilindro(x + sx * 0.108, y, 0.018, z + 0.15, z + 0.17, liso('#a8acb0'), M, novo(), lados=8)
    # a pinça de prata espetada no gelo
    pau((x + 0.02, y, z + 0.21), (x + 0.07, y - 0.03, z + 0.34), 0.012, liso('#d0d4d8'))
    pau((x + 0.04, y, z + 0.21), (x + 0.085, y - 0.02, z + 0.34), 0.012, liso('#9a9ea2'))
    peq(x - 0.105, x + 0.105, y - 0.105, y + 0.105, z)


# ---------------------------------------------------------------------------------------------------------------------
# o globo antigo (1 x 1, 1,5 m)
# ---------------------------------------------------------------------------------------------------------------------
def _globo():
    xc, yc = 0.375, 0.375
    # o tripé torneado: três pés curvos que sobem para a coluna, a coluna, o anel do horizonte
    pe = mad2('#3a2012', eixo=1, seed=401, passo=0.04)
    for k in range(3):
        a = math.radians(90 + 120 * k + 30)
        fx, fy = xc + math.cos(a) * 0.3, yc + math.sin(a) * 0.3
        pau((fx, fy, 0.035), (xc + math.cos(a) * 0.12, yc + math.sin(a) * 0.12, 0.28), 0.06, pe)
        pau((xc + math.cos(a) * 0.12, yc + math.sin(a) * 0.12, 0.28), (xc + math.cos(a) * 0.045, yc + math.sin(a) * 0.045, 0.52), 0.05, pe)
        o = novo()
        C().elipsoide(np.array([fx, fy, 0.03]), np.array([0.045, 0.045, 0.03]), liso('#b8902a'), o)
    # a coluna central torneada
    o = novo()
    perfil = [(0.5, 0.05), (0.54, 0.07), (0.62, 0.04), (0.7, 0.05), (0.78, 0.03), (0.88, 0.032), (0.92, 0.055), (0.94, 0.04)]
    _poligono_rodado(xc, yc, perfil, vol(xc, yc, '#4a2c1a', brilho=0.25), o, lados=12)
    # o anel do horizonte (a moldura de madeira em volta, com a graduação)
    zr = 0.96
    o = novo()
    for k in range(16):
        a0, a1 = 2 * math.pi * k / 16, 2 * math.pi * (k + 1) / 16
        am = (a0 + a1) / 2
        ri, ro = 0.27, 0.35
        pts = [(xc + ri * math.cos(a0), yc + ri * math.sin(a0), zr), (xc + ro * math.cos(a0), yc + ro * math.sin(a0), zr),
               (xc + ro * math.cos(a1), yc + ro * math.sin(a1), zr), (xc + ri * math.cos(a1), yc + ri * math.sin(a1), zr)]
        kk = 1.0 if k % 2 == 0 else 0.92
        fp(pts, (0, 0, 1), liso(hexs(hx('#6a4426') * kk)), o)
        pts2 = [(xc + ro * math.cos(a0), yc + ro * math.sin(a0), zr - 0.035), (xc + ro * math.cos(a1), yc + ro * math.sin(a1), zr - 0.035),
                (xc + ro * math.cos(a1), yc + ro * math.sin(a1), zr), (xc + ro * math.cos(a0), yc + ro * math.sin(a0), zr)]
        fp(pts2, (math.cos(am), math.sin(am), 0), liso(hexs(hx('#3e2414') * kk)), o)
        # o dourado do aro de dentro (a quina do anel)
        pts3 = [(xc + (ri + 0.01) * math.cos(a0), yc + (ri + 0.01) * math.sin(a0), zr + 0.001), (xc + ri * math.cos(a0), yc + ri * math.sin(a0), zr + 0.001),
                (xc + ri * math.cos(a1), yc + ri * math.sin(a1), zr + 0.001), (xc + (ri + 0.01) * math.cos(a1), yc + (ri + 0.01) * math.sin(a1), zr + 0.001)]
        fp(pts3, (0, 0, 1), liso(OURO), o)
    # a bola: o mar azul desbotado, os continentes cor de pergaminho, as linhas de graus, as calotas polares
    R = 0.27
    zc = 1.2
    tau = math.radians(23)
    ct, st = math.cos(tau), math.sin(tau)

    def mapa(L, n, P):
        v = (P - np.array([xc, yc, zc])) / R
        # inclina o eixo (23 graus) em torno de x
        vy = v[:, 1] * ct - v[:, 2] * st
        vz = v[:, 1] * st + v[:, 2] * ct
        vx = v[:, 0]
        lat = np.arcsin(np.clip(vz, -1, 1))
        lon = np.arctan2(vy, vx)
        a = np.floor(lon / 0.2) * 0.2
        b = np.floor(lat / 0.18) * 0.18
        t = suave(a * 1.3, b * 1.8, 0.5, 9) * 0.75 + suave(a * 3.0, b * 3.5, 0.4, 3) * 0.25
        terra = (t > 0.52) & (np.abs(lat) < 1.3)
        out = np.where(terra[:, None], hx('#d8c490'), hx('#6f8fa4'))
        out = np.where((terra & (t > 0.62))[:, None], hx('#c4aa76'), out)
        out = np.where((np.abs(lat) > 1.3)[:, None], hx('#e8e0cc'), out)
        # os paralelos e os meridianos (linhas finas)
        gl = (np.abs(((lat / 0.5236 + 0.5) % 1) - 0.5) > 0.5 - 0.075) | (np.abs(((lon / 0.5236 + 0.5) % 1) - 0.5) > 0.5 - 0.06)
        out = np.where((gl & ~terra)[:, None], hx('#8aa6b8'), out)
        out = np.where((gl & terra)[:, None], hx('#a8905c'), out)
        return out
    o = novo()
    C().elipsoide(np.array([xc, yc, zc]), np.array([R, R, R]), emissivo(mapa), o, brilho=0.35)
    # o meridiano de latão (o arco de frente para a câmera, do polo de baixo ao de cima) e os pinos dos polos
    o = novo()
    pts = [(math.sin(a) * (R + 0.022), zc + math.cos(a) * (R + 0.022)) for a in np.linspace(math.radians(-168), math.radians(168), 22)]
    BE._fita(pts, xc, yc, liso(OURO), o, 0.022)
    o = novo()
    C().cilindro(xc, yc, 0.012, zc + R * 0.93, zc + R + 0.07, vol(xc, yc, OURO, brilho=0.6), M, o, lados=8, tampa_mat=liso(OURO_L))
    o = novo()
    C().elipsoide(np.array([xc, yc, zc + R + 0.075]), np.array([0.026, 0.026, 0.026]), liso(OURO_L), o)
    o = novo()
    C().cilindro(xc, yc, 0.026, zr + 0.0, zc - R + 0.015, vol(xc, yc, OURO, brilho=0.5), M, o, lados=10, tampa_mat=liso(OURO))
    peg(xc - 0.36, xc + 0.36, yc - 0.36, yc + 0.36)


# ---------------------------------------------------------------------------------------------------------------------
# o bar do escritório (2 x 1, 1,2 m): 0 fechado, 1 aberto
# ---------------------------------------------------------------------------------------------------------------------
def _bar(aberto=False):
    def d():
        x0, x1, y0, y1 = 0.04, 1.46, 0.1, 0.62
        h = 1.2
        zb = 0.1
        tp = 0.08
        zc = h - tp
        e = 0.03
        W = (x1 - x0 - 0.06) / 2
        # o rodapé (pés de console) e a gola do tampo
        cx((x0 - 0.01, x1 + 0.01, y0 - 0.01, y1 + 0.02, 0.0, zb), _pau(ND_E, '#3a2214', quina=1.2, b=(0, 0, 0, 0, 0, zb)))
        cx((x0 + 0.02, x1 - 0.02, y1 + 0.02, y1 + 0.03, zb - 0.015, zb - 0.003), liso(OURO))
        # o tampo de nogueira, saindo 3 cm
        cx((x0 - 0.03, x1 + 0.03, y0 - 0.03, y1 + 0.04, zc, h), {'cima': tab2(ND_TAB, 0.2, ND_E, eixo=0, seed=411, comp=1.1, org=y0),
                                                                  '*': _pau('#4e2e1c', quina=1.3, b=(0, 0, 0, 0, zc, h))})
        cx((x0 - 0.01, x1 + 0.01, y0 - 0.01, y1 + 0.02, zc - 0.035, zc), _pau(ND_E, '#4a2c1a', quina=1.2, b=(0, 0, 0, 0, zc - 0.035, zc)))
        zt = zc - 0.035
        # os dentículos da cornija (uma fileira de dentinhos de 2 px, bem pequenos)
        for k in range(int((x1 - x0) / 0.065)):
            xa = x0 + 0.01 + k * 0.065
            cx((xa, xa + 0.032, y1 + 0.02, y1 + 0.036, zt - 0.025, zt), liso('#5a3822'), o=novo(contorno=False))
        # a carcaça
        face_m = mad2(ND, eixo=1, seed=412, passo=0.05)
        if not aberto:
            pain = []
            for i in range(2):
                a0 = x0 + 0.03 + i * (W + 0.0) + (0.0 if i == 0 else 0.0)
                pain.append((a0 + 0.015, a0 + W - 0.015, zb + 0.02, zt - 0.03, 'p'))
            cx((x0, x1, y0, y1, zb, zt), {'frente': CA.almofadas(ND, pain, eixo=1, seed=413, passo=0.05, fresta='#1c0e06'),
                                          'costas': CA.almofadas(ND, [], seed=414), '*': face_m, 'cima': liso(ND_L)})
            xm = (x0 + x1) / 2
            for xx in (xm - 0.05, xm + 0.05):
                cx((xx - PH, xx + PH, y1, y1 + 0.03, 0.55, 0.78), liso(OURO), o=novo(contorno=False))
                cx((xx - PH, xx + PH, y1 + 0.03, y1 + 0.045, 0.55, 0.78), ouro((0, 0, 0, 0, 0, 0.78)))
            # as molduras em relevo (a almofada de cada porta)
            for i in range(2):
                a0 = x0 + 0.03 + i * W
                cx((a0 + 0.1, a0 + W - 0.1, y1, y1 + 0.012, zb + 0.14, zt - 0.14), {'cima': liso(ND_L), '*': mad2('#4e2e1c', eixo=1, seed=415, passo=0.04)})
        else:
            IN = CA.dentro('#3e2412', zb, zt)
            cx((x0, x1, y0, y0 + e, zb, zt), {'frente': IN, 'costas': mad2(ND, seed=416), '*': face_m})
            cx((x0, x0 + e, y0 + e, y1, zb, zt), {'dir': IN, '*': face_m})
            cx((x1 - e, x1, y0 + e, y1, zb, zt), {'esq': IN, '*': face_m})
            cx((x0 + e, x1 - e, y0 + e, y1, zb, zb + e), {'cima': liso('#3a2214'), '*': face_m})
            cx((x0 + e, x1 - e, y0 + e, y1, zt - e, zt), {'baixo': liso('#2a170d'), '*': face_m})
            # a prateleira de vidro do meio e a luz quente embaixo do tampo (a prateleira iluminada)
            cx((x0 + e, x1 - e, y0 + e, y1 - 0.01, 0.62, 0.64), {'cima': liso('#7fa4aa'), '*': liso('#5c8890')})
            lo = luz_obj()
            C().caixa((x0 + e + 0.02, x1 - e - 0.02, y0 + e + 0.04, y1 - 0.06, zt - e - 0.012, zt - e - 0.002), liso('#ffe2a0'), M, lo)
            cx((x0 + e, x1 - e, y0 + e, y0 + e + 0.01, zb + e, zt - e), {'frente': liso('#5a3a22')}, o=novo(contorno=False))
            xi0, xi1 = x0 + e + 0.05, x1 - e - 0.05
            cores = ['#2e4a30', '#5a2a1c', '#c8902a', '#2a3a58', '#3a4a2a', '#6a1a22', '#cfd8d4', '#6a4a1a']
            for (zz, n, hh, sd) in ((zb + e, 8, 0.42, 1.0), (0.64, 8, 0.4, 3.0)):
                for k in range(n):
                    xx = xi0 + 0.06 + k * (xi1 - xi0 - 0.12) / (n - 1)
                    c_ = cores[int(ruido(k, sd) * len(cores))]
                    garrafa(xx, y0 + 0.3 + 0.06 * ruido(k, sd + 5), zz, hh * (0.85 + 0.2 * ruido(k, sd + 1)), 0.04, c_,
                            rotulo='#e8dcc0' if ruido(k, sd + 3) > 0.35 else None)
            decanter(xi0 + 0.3, y0 + 0.4, 0.64, h=0.3, r=0.05, forma=1)
            copo(xi1 - 0.2, y0 + 0.42, 0.64)
            copo(xi1 - 0.12, y0 + 0.38, 0.64)
            # as portas abertas: a da esquerda gira 130 graus, a da direita 130 (as duas para os lados)
            PTm = {'*': mad2(ND, eixo=1, seed=417, passo=0.05)}
            for (H, ang, lado, a0) in (((x0 + 0.01, y1), 130, 1, x0 + 0.03), ((x1 - 0.01, y1), 50, -1, x1 - 0.03 - W)):
                pain = [(0.07, W - 0.09, zb + 0.06, zt - 0.06, 'p')]
                CA.porta_giro(H, ang, W, zb + 0.01, zt - 0.01, CA.mat_folha(ND, pain, H, ang if lado == 1 else 180 - ang, seed=418),
                              CA.mat_folha('#4e2e1c', pain, H, ang if lado == 1 else 180 - ang, seed=419), esp=0.026, lado=lado, mat_b=liso('#5a3822'))
        # os decanters, os copos e o balde de gelo em cima (o tampo a 1,2 m)
        zz = h
        decanter(x0 + 0.2, y0 + 0.26, zz, h=0.3, r=0.062, forma=0)
        decanter(x0 + 0.42, y0 + 0.3, zz, h=0.26, r=0.055, forma=1, conteudo='#a8601e', nivel=0.45)
        decanter(x0 + 0.62, y0 + 0.24, zz, h=0.28, r=0.058, forma=0, conteudo='#b8402a', nivel=0.5)
        for (xx, yy) in ((x0 + 0.85, y0 + 0.4), (x0 + 0.95, y0 + 0.3), (x0 + 1.04, y0 + 0.42)):
            copo(xx, yy, zz)
        balde_gelo(x1 - 0.2, y0 + 0.28, zz)
        # a bandeja de prata embaixo dos copos
        o = novo()
        _poligono_rodado(x0 + 0.94, y0 + 0.36, [(zz, 0.14), (zz + 0.008, 0.145), (zz + 0.014, 0.12)], vol(x0 + 0.94, y0 + 0.36, '#c0c4c8', brilho=0.6), o, lados=18, tampa_mat=liso('#d8dce0'))
        peg(x0, x1, y0, y1)
    return d


# ---------------------------------------------------------------------------------------------------------------------
# a estante da biblioteca (3 x 1, 2,9 m): três vãos entre colunas entalhadas, o trilho de latão para a escada
# ---------------------------------------------------------------------------------------------------------------------
BIB_CORES = ['#5e1e24', '#6e2428', '#24402e', '#2e4c3c', '#5a3820', '#6e4228', '#4a2a1c', '#22304a', '#1e1a18', '#8a6a38', '#4e1a22', '#34281c']


def flautado(cor, a0, a1=None):
    """A face do fuste caneluda: riscas de 3 px (1 escura, 1 clara, 1 do corpo) em pé."""
    c0 = hx(cor)

    def f(L, n, P):
        out = np.tile(c0, (len(P), 1))
        if n[2] > 0.5:
            return np.tile(_tom(c0, 1.15), (len(P), 1))
        a = P[:, 0] if abs(n[1]) >= abs(n[0]) else P[:, 1]
        k = np.floor((a - a0) / PH).astype(int) % 3
        out = np.where((k == 0)[:, None], _tom(c0, 0.7), out)
        out = np.where((k == 1)[:, None], _tom(c0, 1.14), out)
        return out
    return emissivo(f)


def _busto(x, y, z):
    """O busto de mármore (a cabeça de um fundador) no pedestalzinho: o peito, a cabeça, o nariz e o cabelo em dois tons."""
    cx((x - 0.07, x + 0.07, y - 0.07, y + 0.07, z, z + 0.04), {'cima': liso('#2a2a30'), '*': liso('#1c1c20')})
    M_ = emissivo(lambda L, n, P: np.tile(hx('#e6dfd0'), (len(P), 1)))
    o = novo()
    C().elipsoide(np.array([x, y, z + 0.075]), np.array([0.075, 0.05, 0.045]), M_, o)
    C().elipsoide(np.array([x, y, z + 0.17]), np.array([0.042, 0.048, 0.062]), M_, o)
    C().elipsoide(np.array([x, y, z + 0.115]), np.array([0.02, 0.02, 0.03]), M_, o)
    C().elipsoide(np.array([x, y + 0.012, z + 0.2]), np.array([0.044, 0.044, 0.03]), emissivo(lambda L, n, P: np.tile(hx('#c4bcac'), (len(P), 1))), o)
    peq(x - 0.07, x + 0.07, y - 0.07, y + 0.07, z)


def _esfera_armilar(x, y, z):
    """A esfera armilar de latão: o pé torneado, os anéis cruzados de frente para a câmera e a bolinha no meio."""
    o = novo()
    _poligono_rodado(x, y, [(z, 0.07), (z + 0.02, 0.07), (z + 0.035, 0.03), (z + 0.09, 0.016), (z + 0.1, 0.03)], vol(x, y, OURO, brilho=0.6), o, lados=14, tampa_mat=liso(OURO_L))
    zc = z + 0.2
    for (rx, k) in ((0.1, 0), (0.1, 1), (0.1, 2)):
        o = novo()
        a0 = [0.0, 0.0, math.radians(60)][k]
        pts = []
        for a in np.linspace(0, 2 * math.pi, 26):
            if k == 0:
                pts.append((math.sin(a) * 0.1, zc + math.cos(a) * 0.1))
            elif k == 1:
                pts.append((math.sin(a) * 0.1 * 0.45, zc + math.cos(a) * 0.1))
            else:
                pts.append((math.sin(a) * 0.1 * math.cos(math.radians(70)) + math.cos(a) * 0.1 * math.sin(math.radians(70)) * 0.0 + math.sin(a) * 0.0,
                            zc + math.cos(a) * 0.1 * 0.32 * 0 + math.cos(a) * 0.045))
        BE._fita(pts, x, y, liso(OURO if k != 2 else OURO_L), o, 0.012)
    o = novo()
    C().elipsoide(np.array([x, y, zc]), np.array([0.03, 0.03, 0.03]), liso('#3a6a88'), o)
    peq(x - 0.07, x + 0.07, y - 0.07, y + 0.07, z)


def _estante_biblioteca():
    x0, x1 = 0.03, 2.22
    fundo = 0.5
    h = 2.9
    zb = 0.82                                    # o alto do armário de baixo
    prat = (zb, 1.17, 1.52, 1.87, 2.22)
    ztopo = 2.62
    cols = np.linspace(x0, x1, 4)
    pw = 0.1                                     # a largura das colunas
    LADO = mad2(ND, eixo=1, seed=421, passo=0.06)
    FRENTE = mad2('#52301d', eixo=1, seed=423, passo=0.03)
    DENTRO = mad2('#2e180c', eixo=1, seed=424, passo=0.07, claro=1.06, escuro=0.94)

    def fundo_m(L, n, P):
        g = (P[:, 0] - x0) % 0.18
        out = np.tile(hx('#2a140a'), (len(P), 1))
        out = np.where((g < PH)[:, None], hx('#200e08'), out)
        for z in prat[1:] + (ztopo,):
            out = np.where(((P[:, 2] < z) & (P[:, 2] > z - 0.06))[:, None], out * 0.78, out)
        return out
    cx((x0, x1, 0.02, 0.05, 0, h), {'frente': emissivo(fundo_m), 'costas': tab2(['#7a5a3a', '#74543a', '#80603e'], 0.16, '#3a2414', eixo=1, seed=429), '*': LADO})
    # as colunas entalhadas: a base, o fuste caneluda, o capitel (com o filete dourado) e o remate
    for i, xc in enumerate(cols):
        a0 = xc if i == 0 else (xc - pw if i == 3 else xc - pw / 2)
        a1 = a0 + pw
        yf = fundo + 0.035
        cx((a0, a1, 0.02, yf - 0.012, 0.0, h), {'cima': liso(ND_L), 'frente': FRENTE, 'dir': DENTRO, 'esq': DENTRO, '*': LADO})
        cx((a0 - 0.006, a1 + 0.006, 0.02, yf, 0.0, 0.12), _pau('#52301d', ND_L, quina=1.2, b=(0, 0, 0, 0, 0, 0.12)))
        cx((a0 + 0.012, a1 - 0.012, 0.02, yf + 0.0, 0.12, zb - 0.04), {'frente': flautado('#4e2e1c', a0), 'dir': liso('#3e2314'), 'esq': liso('#3e2314'), '*': liso(ND_L)})
        cx((a0 - 0.012, a1 + 0.012, 0.02, yf + 0.008, zb - 0.04, zb + 0.02), _pau('#52301d', ND_L, quina=1.22, b=(0, 0, 0, 0, zb - 0.04, zb + 0.02)))
        cx((a0 + 0.012, a1 - 0.012, 0.02, yf, zb + 0.02, ztopo - 0.06), {'frente': flautado('#4e2e1c', a0), 'dir': liso('#3e2314'), 'esq': liso('#3e2314'), '*': liso(ND_L)})
        cx((a0 - 0.014, a1 + 0.014, 0.02, yf + 0.012, ztopo - 0.06, ztopo + 0.03), _pau('#5a3622', ND_L, quina=1.25, b=(0, 0, 0, 0, ztopo - 0.06, ztopo + 0.03)))
        cx((a0 - 0.014, a1 + 0.014, yf + 0.012, yf + 0.016, ztopo - 0.05, ztopo - 0.044), liso(OURO), o=novo(contorno=False))
    # o armário de baixo: as portas almofadadas de cada vão, o rodapé e o tampo saliente
    for i in range(3):
        a0 = cols[i] + (pw if i == 0 else pw / 2)
        a1 = cols[i + 1] - (pw if i == 2 else pw / 2)
        mid = (a0 + a1) / 2
        pain = [(a0 + 0.03, mid - 0.006, 0.16, zb - 0.06, 'p'), (mid + 0.006, a1 - 0.03, 0.16, zb - 0.06, 'p')]
        cx((a0, a1, fundo - 0.06, fundo - 0.02, 0.1, zb - 0.03), {'frente': CA.almofadas(ND, pain, eixo=1, seed=430 + i, passo=0.05, fresta='#1c0e06'), '*': mad2(ND, seed=431)})
        for xx in (mid - 0.04, mid + 0.04):
            _barra((xx - PH, xx + PH, fundo - 0.02, fundo + 0.01, 0.42, 0.55), OURO, OURO_L, quina=False)
    cx((x0 + 0.02, x1 - 0.02, 0.05, fundo, 0.0, 0.1), _pau('#2e1a0e', quina=1.2, b=(0, 0, 0, 0, 0, 0.1)))
    cx((x0 - 0.02, x1 + 0.02, 0.02, fundo + 0.05, zb - 0.03, zb + 0.025), {'cima': tab2(ND_TAB, 0.2, ND_E, seed=432, org=0.02),
                                                                            '*': _pau('#5a3622', quina=1.25, b=(0, 0, 0, 0, zb - 0.03, zb + 0.025))})

    def prateleira(a0, a1, zp):
        def topo(L, n, P):
            out = np.tile(hx('#7a4a2a'), (len(P), 1))
            yy = P[:, 1]
            out = np.where((yy < fundo - 0.14)[:, None], _tom(out, 0.78), out)
            out = np.where((yy < fundo - 0.28)[:, None], _tom(hx('#7a4a2a'), 0.62), out)
            return np.where((yy > fundo - PH)[:, None], _tom(hx('#7a4a2a'), 1.14), out)
        cx((a0, a1, 0.05, fundo, zp, zp + 0.035), {'cima': emissivo(topo), '*': mad2('#5e3a22', eixo=0, seed=436, passo=0.03)})
    yb0, yb1 = 0.11, fundo - 0.02
    for i in range(3):
        a0 = cols[i] + (pw if i == 0 else pw / 2)
        a1 = cols[i + 1] - (pw if i == 2 else pw / 2)
        for k, z in enumerate(prat):
            if k > 0:
                prateleira(a0, a1, z)
            zz = z + (0.035 if k > 0 else 0.025)
            teto = prat[k + 1] if k + 1 < len(prat) else ztopo
            BE._VAO['teto'] = teto
            alto = min(0.3, (teto - zz) * 0.88)
            sd = 31 + i * 7 + k * 3
            _prat_biblioteca(i, k, a0, a1, yb0, yb1, zz, alto, sd)
        BE._VAO['teto'] = None
    # o friso de cima (a faixa com os painéis entalhados), os dentículos e a cornija
    cx((x0 - 0.01, x1 + 0.01, 0.02, fundo + 0.025, ztopo, ztopo + 0.17), {'frente': CA.almofadas(ND, [(cols[i] + 0.1, cols[i + 1] - 0.1, ztopo + 0.03, ztopo + 0.15, 'p') for i in range(3)], eixo=0, seed=437, passo=0.05, fresta='#1c0e06'),
                                                                        'cima': liso(ND_L), '*': mad2(ND, seed=438, passo=0.04)})
    for k in range(int((x1 - x0) / 0.06)):
        xa = x0 + 0.01 + k * 0.06
        cx((xa, xa + 0.03, fundo + 0.025, fundo + 0.05, ztopo + 0.17, ztopo + 0.2), liso('#5a3822'), o=novo(contorno=False))
    cx((x0 - 0.045, x1 + 0.045, 0.02, fundo + 0.075, ztopo + 0.17, h - 0.0), {'cima': mad2('#5a3622', eixo=0, seed=433, passo=0.05),
                                                                          '*': _pau('#5a3622', quina=1.25, b=(0, 0, 0, 0, ztopo + 0.17, h))})
    # o trilho de latão para a escada: a barra de ponta a ponta em frente às prateleiras, presa nas colunas por suportes
    zr, yr = 2.42, fundo + 0.1
    PC.tubo_x(x0 - 0.02, x1 + 0.02, yr, zr, 0.014, OURO, lados=8)
    for xc in cols:
        a0 = xc if xc == cols[0] else (xc - pw if xc == cols[-1] else xc - pw / 2)
        xm = a0 + pw / 2
        cx((xm - 0.012, xm + 0.012, fundo + 0.035, yr + 0.016, zr - 0.016, zr + 0.016), ouro((0, 0, 0, 0, 0, zr + 0.016)))
    peg(x0, x1, 0.02, fundo)


def _prat_biblioteca(i, k, a0, a1, yb0, yb1, z, alto, sd):
    """O que vai em cada prateleira (vão i, fileira k): os livros de couro, o busto, a esfera armilar, as pilhas e os deitados."""
    x = a0 + 0.03
    if (i, k) == (1, 2):
        x = E._lombadas(x, a1 - 0.3, yb0, yb1, z, alto, sd, 9, BIB_CORES, tomba=True)
        _busto(a1 - 0.17, (yb0 + yb1) / 2 + 0.03, z)
        return
    if (i, k) == (0, 1):
        _esfera_armilar(a1 - 0.17, (yb0 + yb1) / 2 + 0.03, z)
        E._lombadas(x, a1 - 0.3, yb0, yb1, z, alto, sd, 10, BIB_CORES, tomba=False)
        return
    if (i, k) == (2, 3):
        x = E._lombadas(x, a1 - 0.4, yb0, yb1, z, alto, sd, 10, BIB_CORES, tomba=True)
        CA._pilha(a1 - 0.36, 0.3, yb0 + 0.02, yb1, z, sd, 3)
        return
    if (i + k) % 4 == 1:
        x = E._lombadas(x, a1 - 0.34, yb0, yb1, z, alto, sd, 12, BIB_CORES)
        CA._pilha(x + 0.02, 0.28, yb0 + 0.02, yb1, z, sd, 3)
        return
    E._lombadas(x, a1 - 0.03, yb0, yb1, z, alto, sd, 18, BIB_CORES, tomba=(k % 2 == 0))


# ---------------------------------------------------------------------------------------------------------------------
# a escada de biblioteca (1 x 1, 2,6 m): de rodízio, encostada no trilho
# ---------------------------------------------------------------------------------------------------------------------
def _escada_biblioteca():
    xl, xr = 0.14, 0.61
    yb, yt = 0.66, 0.14                              # o pé (na frente) e o topo (encostado no trilho)
    zt = 2.5
    pe = mad2(ND, eixo=1, seed=441, passo=0.03)

    def y_em(z):
        return yb + (yt - yb) * z / zt
    for x in (xl, xr):
        o = novo()
        E.haste((x, y_em(0.06), 0.06), (x, yt, zt), 0.05, pe, o, h=0.04)
        # o latão no alto do trilho (o gancho) e a roda de baixo
        o = novo()
        E.cil_eixo((x - 0.025, y_em(0.06) + 0.01, 0.05), (x + 0.025, y_em(0.06) + 0.01, 0.05), 0.05, liso('#1e1a18'), o, lados=12, tampa_mat=liso('#2a2624'))
        o = novo()
        E.cil_eixo((x - 0.03, y_em(0.06) + 0.01, 0.05), (x + 0.03, y_em(0.06) + 0.01, 0.05), 0.02, liso(OURO), o, lados=8, tampa_mat=liso(OURO_L))
        cx((x - 0.03, x + 0.03, yt - 0.03, yt + 0.045, zt - 0.1, zt + 0.02), ouro((0, 0, 0, 0, 0, zt + 0.02)))
    # os degraus (cinco, de tábua larga com a ponta chanfrada, a ripa de cima mais clara)
    for k, z in enumerate((0.42, 0.85, 1.28, 1.71, 2.14)):
        y = y_em(z)
        cx((xl - 0.02, xr + 0.02, y - 0.1, y + 0.1, z - 0.025, z + 0.015), {'cima': tab2(ND_TAB, 0.2, ND_E, eixo=0, seed=442 + k, org=y - 0.1), '*': _pau('#4e2e1c', quina=1.25, b=(0, 0, 0, 0, z - 0.025, z + 0.015))})
        cx((xl, xr, y - 0.07, y + 0.07, z - 0.065, z - 0.025), liso(ND_E), o=novo(contorno=False))
    # o corrimão de latão: duas hastes que sobem das pontas e a barra de cima
    for x in (xl, xr):
        o = novo()
        E.haste((x, y_em(1.5), 1.5), (x, y_em(zt + 0.08) - 0.02, zt + 0.1), 0.026, liso(OURO), o, h=0.026)
    o = novo()
    E.haste((xl, y_em(zt + 0.08) - 0.02, zt + 0.1), (xr, y_em(zt + 0.08) - 0.02, zt + 0.1), 0.03, liso(OURO_L), o, h=0.03)
    # a travessa de ferro embaixo (entre os rodízios, rente ao chão)
    cx((xl, xr, y_em(0.2) - 0.02, y_em(0.2) + 0.02, 0.18, 0.22), liso(OURO_E), o=novo())
    peg(xl - 0.04, xr + 0.04, yt - 0.05, yb + 0.08)


# ---------------------------------------------------------------------------------------------------------------------
# a mesa de leitura (4 x 2, aumento 1,2: 3,6 x 1,8 m; o tampo a 0,78 m; vazada)
# ---------------------------------------------------------------------------------------------------------------------
def _livro_aberto(x, y, z, ang=0.0, cor='#5e2420'):
    """O livro aberto de lado a lado: a capa de couro, as duas metades de folhas em leque com as linhas, a fita marcadora."""
    ca, sa = math.cos(ang), math.sin(ang)
    w, d = 0.15, 0.22
    for s in (-1, 1):
        cxm, cym = x + s * (w / 2 + 0.003) * ca, y + s * (w / 2 + 0.003) * sa

        def pag(L, n, P, cxm=cxm, cym=cym):
            u = (P[:, 0] - cxm) * ca + (P[:, 1] - cym) * sa
            v = -(P[:, 0] - cxm) * sa + (P[:, 1] - cym) * ca
            if abs(n[2]) > 0.5:
                out = np.tile(hx('#eadfc2'), (len(P), 1))
                lv = np.floor((v + d / 2) / PH)
                lin = (lv % 2 == 0) & (lv > 1) & (lv < d / PH - 2) & (np.abs(u) < w / 2 - 0.012) & (ruido(lv, 3.0 + s) > 0.2)
                out = np.where(lin[:, None], hx('#8a7a64'), out)
                gut = np.abs(u + s * w / 2) < 0.012
                return np.where(gut[:, None], hx('#cdbf9e'), out)
            return np.tile(hx('#cdbf9e'), (len(P), 1))
        o = novo()
        E.prisma(E.ret_girado(cxm, cym, ang, w / 2, d / 2), z + 0.008, z + 0.03, emissivo(pag), o)
    o = novo()
    E.prisma(E.ret_girado(x, y, ang, w + 0.012, d / 2 + 0.008), z, z + 0.008, liso(cor), o)
    o = novo()
    E.prisma(E.ret_girado(x + 0.02 * ca, y + 0.02 * sa - 0.01, ang, 0.004, d / 2 + 0.03), z + 0.03, z + 0.034, liso('#8a1a14'), o)
    peq(x - w - 0.01, x + w + 0.01, y - d / 2, y + d / 2, z)


def _lupa(x, y, z, ang=0.6):
    """A lupa: o aro de latão, o vidro claro e o cabo de madeira."""
    d = np.array([math.cos(ang), math.sin(ang), 0.0])
    p = np.array([x, y, z + 0.012])
    o = novo()
    E.cil_eixo(p, p + np.array([0, 0, 0.012]), 0.052, liso(OURO), o, lados=14, tampa_mat=liso('#cfe4ea'))
    o = novo()
    E.cil_eixo(p + np.array([0, 0, 0.012]), p + np.array([0, 0, 0.016]), 0.038, liso('#d8ecf0'), o, lados=14, tampa_mat=liso('#f2fafc'))
    o = novo()
    E.cil_eixo(p + d * 0.05, p + d * 0.2, 0.014, liso('#2a1a10'), o, lados=8, tampa_mat=liso('#3a2414'))
    peq(x - 0.06, x + 0.2, y - 0.06, y + 0.12, z)


def _mesa_leitura():
    w, d = 3.6, 1.8
    x, y = -0.3, -0.15
    x1, y1 = x + w, y + d
    h, tp = 0.78, 0.07
    zt = h - tp - 0.16
    cx((x, x1, y, y1, h - tp, h), {'cima': tab2(ND_TAB, 0.3, ND_E, eixo=0, seed=451, comp=1.4, org=y),
                                   '*': _pau('#4e2e1c', quina=1.3, b=(0, 0, 0, 0, h - tp, h))})
    # a gola do tampo e a saia entalhada recuada (sem travessa embaixo: a mesa é vazada)
    cx((x + 0.04, x1 - 0.04, y + 0.04, y1 - 0.04, h - tp - 0.025, h - tp), _pau(ND_E, '#4a2c1a', quina=1.2, b=(0, 0, 0, 0, h - tp - 0.025, h - tp)))
    m = 0.07
    cx((x + m, x1 - m, y + m, y1 - m, zt, h - tp - 0.02), {'frente': CA.almofadas(ND, [(x + m + 0.2 + 1.05 * k, x + m + 1.05 * k + 0.95, zt + 0.015, h - tp - 0.035, 'p') for k in range(3)], eixo=0, seed=452, passo=0.05, fresta='#1c0e06'),
                                                          'costas': CA.almofadas(ND, [], seed=453), '*': mad2(ND, eixo=1, seed=454, passo=0.05)})
    # as quatro pernas torneadas grossas nas quinas
    for (a, b) in ((x + 0.14, y + 0.14), (x1 - 0.14, y + 0.14), (x + 0.14, y1 - 0.14), (x1 - 0.14, y1 - 0.14)):
        CA.perna_torneada(a, b, 0.0, h - tp, 0.068, '#3a2012')
        cx((a - 0.075, a + 0.075, b - 0.075, b + 0.075, h - tp - 0.12, h - tp), _pau('#4a2c1a', ND_L, quina=1.2, b=(0, 0, 0, 0, h - tp - 0.12, h - tp)))
        o = novo()
        C().cilindro(a, b, 0.05, 0.0, 0.025, vol(a, b, OURO, brilho=0.5), M, o, lados=10, tampa_mat=liso(OURO_L))
    peg(x, x1, y, y1)
    # o couro, em faixa comprida no meio do tampo, com o friso dourado
    bx0, bx1, by0, by1 = x + 0.3, x1 - 0.3, y + 0.34, y1 - 0.34
    cx((bx0, bx1, by0, by1, h, h + 0.008), {'cima': couro_mesa(bx0, bx1, by0, by1, cor='#2a2420', folga=0.045), '*': liso('#161210')})
    zc = h + 0.008
    ym = (by0 + by1) / 2
    # em cima: os dois abajures de banqueiro, os livros abertos e empilhados, a lupa e o tinteiro
    E._abajur_verde(bx0 + 0.3, ym - 0.12, zc)
    E._abajur_verde(bx1 - 0.3, ym + 0.12, zc)
    _livro_aberto(bx0 + 0.95, ym + 0.05, zc, ang=0.12, cor='#5e2420')
    _livro_aberto(bx1 - 0.95, ym - 0.1, zc, ang=-0.2, cor='#24402e')
    zz = zc
    for (cor, ll, dd) in (('#5e2422', 0.3, 0.22), ('#2e4c3c', 0.27, 0.2), ('#6e4228', 0.28, 0.21), ('#22304a', 0.24, 0.19)):
        CA._livro_deitado(bx0 + 0.55 - ll / 2, bx0 + 0.55 + ll / 2, ym - 0.45 - dd / 2 + 0.2, ym - 0.45 + dd / 2 + 0.2, zz, zz + 0.045, cor)
        zz += 0.045
    peq(bx0 + 0.4, bx0 + 0.7, ym - 0.35, ym - 0.05, zc)
    zz = zc
    for (cor, ll, dd) in (('#6e2428', 0.28, 0.2), ('#3a3020', 0.26, 0.19), ('#2e4c3c', 0.25, 0.2)):
        CA._livro_deitado(bx1 - 0.6 - ll / 2, bx1 - 0.6 + ll / 2, ym + 0.2 - dd / 2, ym + 0.2 + dd / 2, zz, zz + 0.045, cor)
        zz += 0.045
    peq(bx1 - 0.76, bx1 - 0.46, ym + 0.1, ym + 0.3, zc)
    _lupa((bx0 + bx1) / 2 + 0.1, ym + 0.2, zc, ang=0.5)
    tinteiro_cristal((bx0 + bx1) / 2 - 0.12, ym - 0.1, zc)
    caneta_tinteiro((bx0 + bx1) / 2 - 0.02, ym - 0.2, zc, ang=-0.4)
    E._papeis((bx0 + bx1) / 2 + 0.25, ym - 0.2, zc, n=2, seed=15, ang=0.15)


# ---------------------------------------------------------------------------------------------------------------------
# o touro de bronze (1 x 1, 1,2 m): o mascote do Frigorífico, no pedestal de mármore preto
# ---------------------------------------------------------------------------------------------------------------------
def marmore_preto(seed=0, fio='#4a4a56'):
    """O mármore preto polido com os veios cinza-claros em diagonais finas e a quina de cima com brilho."""
    c0 = hx('#18181d')

    def f(L, n, P):
        out = np.tile(c0, (len(P), 1))
        a = P[:, 0] + P[:, 1] if n[2] > 0.5 else (P[:, 0] if abs(n[1]) >= abs(n[0]) else P[:, 1]) + P[:, 2] * 0.6
        t = a + 0.05 * np.sin(P[:, 2] * 18 + a * 11 + seed)
        v = np.abs(((t * 9 + seed) % 1) - 0.5) < 0.035
        v &= ruido(np.floor(a / 0.07), np.floor(P[:, 2] / 0.08), seed + 2.0) > 0.45
        out = np.where(v[:, None], hx(fio), out)
        out = np.where((v & (ruido(np.floor(a / 0.05), seed + 5.0) > 0.7))[:, None], hx('#7a7a88'), out)
        return out
    return emissivo(f)


def _bronze(R=None):
    """O bronze: a cor pela luz da normal em seis degraus, o verdete (azinhavre) nas partes viradas para baixo e uns pontos de brilho."""
    def f(Lc, N, P):
        up = np.clip(N[:, 2], -1, 1)
        base = np.stack([hx(BRONZE[2]), hx(BRONZE[3])])
        out = np.tile(hx(BRONZE[3]), (len(P), 1))
        out = np.where((up < -0.1)[:, None], hx(BRONZE[2]), out)
        ver = (up < 0.1) & (ruido(np.floor(P[:, 0] / (3 * PH)), np.floor(P[:, 2] / (3 * PZ)), 7.0) > 0.78)
        out = np.where(ver[:, None], hx('#4e6a58'), out)
        bril = (up > 0.7) & (ruido(np.floor(P[:, 0] / (2 * PH)), np.floor(P[:, 1] / (2 * PH)), 9.0) > 0.7)
        return np.where(bril[:, None], hx('#d8b268'), out)
    return emissivo(f)


def _touro():
    xc = 0.375
    zp = 0.47                                          # o alto do pedestal (onde o touro pisa)
    # o pedestal de mármore preto: a base larga, o fuste, o capitel e o tampo, com a placa de latão na frente
    cx((0.08, 0.67, 0.08, 0.67, 0.0, 0.07), {'cima': liso('#3a3a44'), '*': marmore_preto(1.0)})
    cx((0.13, 0.62, 0.13, 0.62, 0.07, 0.41), {'cima': liso('#26262c'), '*': marmore_preto(2.0)})
    cx((0.09, 0.66, 0.09, 0.66, 0.41, zp), {'cima': liso('#40404a'), '*': marmore_preto(4.0)})
    cx((0.09, 0.66, 0.09, 0.66, 0.405, 0.41 + PZ), liso(OURO), o=novo(contorno=False))

    def placa(L, n, P):
        out = np.tile(hx(OURO), (len(P), 1))
        u = (P[:, 0] - (xc - 0.09)) / PH
        v = (P[:, 2] - 0.18) / PZ
        out = np.where(((u < 1) | (u >= 0.18 / PH - 1) | (v < 1) | (v >= 0.075 / PZ - 1))[:, None], hx(OURO_L), out)
        let = (v >= 2) & (v < 4) & (u >= 3) & (u < 0.18 / PH - 3) & (ruido(np.floor(u / 2), 6.0) > 0.25)
        let2 = (v >= 4.5) & (v < 5.5) & (u >= 6) & (u < 0.18 / PH - 6)
        return np.where((let | let2)[:, None], hx(OURO_E), out)
    cx((xc - 0.09, xc + 0.09, 0.62, 0.628, 0.18, 0.255), {'*': emissivo(placa)})
    B = _bronze()
    # as quatro pernas (as de trás mais finas no jarrete) com os cascos
    for (lx, ly, r0) in ((xc - 0.09, 0.13, 0.04), (xc + 0.09, 0.13, 0.04), (xc - 0.09, 0.37, 0.05), (xc + 0.09, 0.37, 0.05)):
        o = novo()
        C().cilindro(lx, ly, r0 + 0.006, zp, zp + 0.25, vol(lx, ly, BRONZE[3], brilho=0.4), M, o, lados=10, r1=r0 - 0.006)
        o = novo()
        C().cilindro(lx, ly, r0 + 0.012, zp, zp + 0.045, vol(lx, ly, BRONZE[1]), M, o, lados=10, tampa_mat=liso(BRONZE[1]))
    o = novo()

    def E_(c, r, mat=B):
        C().elipsoide(np.array(c, float), np.array(r, float), mat, o, brilho=0.35)
    # o corpo: a barriga, o quarto traseiro, o peito, a corcova; o pescoço grosso e a cabeça baixa
    BH = emissivo(lambda L, n, P: np.tile(hx(BRONZE[2]), (len(P), 1)))
    E_((xc, 0.25, zp + 0.43), (0.15, 0.2, 0.15))
    E_((xc, 0.14, zp + 0.42), (0.14, 0.09, 0.14))
    E_((xc, 0.37, zp + 0.45), (0.155, 0.12, 0.16))
    E_((xc, 0.39, zp + 0.6), (0.125, 0.12, 0.11))
    E_((xc, 0.47, zp + 0.5), (0.115, 0.09, 0.12))
    E_((xc, 0.58, zp + 0.37), (0.1, 0.1, 0.105), BH)
    E_((xc, 0.655, zp + 0.31), (0.07, 0.06, 0.066), BH)
    E_((xc, 0.52, zp + 0.29), (0.055, 0.07, 0.08))
    for s in (-1, 1):
        o2 = novo()
        pts = [(xc + s * 0.085, 0.56, zp + 0.45), (xc + s * 0.17, 0.57, zp + 0.47), (xc + s * 0.23, 0.6, zp + 0.57), (xc + s * 0.2, 0.65, zp + 0.71)]
        for j, (a_, b_) in enumerate(zip(pts[:-1], pts[1:])):
            r0 = 0.036 - 0.011 * j
            E.cil_eixo(a_, b_, r0, liso(BRONZE[5] if j > 0 else BRONZE[4]), o2, lados=8, r1=max(0.008, r0 - 0.011), tampa_mat=liso(BRONZE[5]))
        E.haste((xc + s * 0.09, 0.53, zp + 0.47), (xc + s * 0.15, 0.52, zp + 0.43), 0.045, liso(BRONZE[2]), novo(), h=0.022)
    o4 = novo()
    E.haste((xc, 0.06, zp + 0.52), (xc + 0.01, 0.04, zp + 0.38), 0.026, liso(BRONZE[3]), o4, h=0.026)
    E.haste((xc + 0.01, 0.04, zp + 0.38), (xc + 0.03, 0.05, zp + 0.22), 0.022, liso(BRONZE[3]), o4, h=0.022)
    E.bola((xc + 0.03, 0.052, zp + 0.2), 0.03, BRONZE[2], o4, rz=0.05)
    peg(0.08, 0.67, 0.08, 0.67)


# ---------------------------------------------------------------------------------------------------------------------
# os itens de parede
# ---------------------------------------------------------------------------------------------------------------------
MOL_NOGUEIRA = ('#1e0e06', '#4a2c1a', '#7a5232', '#a07a4a')
MOL_OURO = PC.MOL_DOURADA
BRASIL = [(-51.6, 4.5), (-50.0, 1.8), (-48.0, -0.5), (-44.5, -2.3), (-40.0, -2.8), (-37.0, -4.7), (-35.0, -5.5), (-34.8, -7.5), (-35.5, -9.8),
          (-37.5, -12), (-39.0, -14), (-39.2, -17.5), (-40.8, -21), (-41.8, -23), (-44.5, -23.2), (-47.8, -25), (-48.7, -28), (-50.2, -31),
          (-53.4, -33.7), (-53.6, -32.5), (-57.6, -30.2), (-55.7, -28.0), (-54.0, -26.2), (-54.6, -25.5), (-57.5, -22.1), (-58.2, -20),
          (-57.8, -16.5), (-60.3, -14.5), (-60.5, -13.5), (-65.0, -11.0), (-69.5, -11.0), (-72.5, -9.5), (-73.9, -7.5), (-70.0, -4.2),
          (-69.5, -2.5), (-70.0, -1.0), (-69.5, 1.6), (-67.0, 1.8), (-65.0, 1.2), (-64.0, 3.5), (-60.5, 5.2), (-59.8, 4.2), (-57.5, 2.0),
          (-54.0, 2.3)]
# as unidades do frigorífico: (lon, lat) dos alfinetes vermelhos
UNIDADES = [(-55.0, -13.5), (-49.5, -16.5), (-47.0, -22.0), (-51.0, -26.0), (-54.5, -20.5), (-60.5, -10.5), (-50.5, -5.5), (-43.5, -19.5)]


def _p_mapa_brasil(pl, W, H):
    """O mapa do Brasil a nanquim: o mar azul desbotado com os graus, a terra cor de pergaminho, os alfinetes e as rotas."""
    t = pl.dentro
    pl.pin(t, '#d8c8a0')                                                           # a margem de pergaminho
    pl.pin(t & ((pl.u < 1) | (pl.w < 1) | (pl.u > W - 2) | (pl.w > H - 2)), '#a89468')
    mar = t & (pl.u >= 3) & (pl.u < W - 3) & (pl.w >= 3) & (pl.w < H - 3)
    pl.pin(mar, '#9db4b6')
    # os graus (linhas finas mais claras no mar)
    pl.pin(mar & ((np.floor(pl.u) % 12) == 0), '#a8bebe')
    pl.pin(mar & ((np.floor(pl.w) % 12) == 0), '#a8bebe')
    s = (H - 6) / 39.5
    ox = 8 + 4
    oy = 5.0

    def P(lon, lat):
        return (ox + (lon + 74) * s, oy + (5.5 - lat) * s)
    poly = [P(*p) for p in BRASIL]
    terra = pl.poli(poly) & mar
    pl.pin(terra, '#e0d2a4')
    # a sombra de relevo (1 px à esquerda e embaixo) e a costa escura
    pl.pin(pl.borda(terra), '#9a8656')
    pl.pin(terra & (pl.u > ox + 14 * s) & (pl.u < ox + 22 * s) & (pl.w > oy + 20 * s) & (pl.w < oy + 24 * s), '#d4c496')
    # um rio comprido (o Amazonas) e o São Francisco, em azul
    # as rotas (tracejadas, vermelho escuro) ligando as unidades e os alfinetes
    pts = [P(*u) for u in UNIDADES]
    ordem = [0, 1, 2, 3, 4, 0, 5, 6, 7, 1]
    for a, b in zip(ordem[:-1], ordem[1:]):
        seg = pl.seg(pts[a], pts[b], 1.0)
        d = np.hypot(pl.u - pts[a][0], pl.w - pts[a][1])
        pl.pin(seg & ((np.floor(d / 2) % 2) == 0), '#7a2a20')
    for (u, w) in pts:
        pl.pin(pl.ret(u - 1, w - 1, u + 1, w + 1), '#c42e22')
        pl.pin(pl.ret(u - 1, w - 1, u, w), '#f49a88')
    # a rosa dos ventos (canto direito de baixo) e a faixa de legenda com o escudo do frigorífico
    cu, cw = W - 12, H - 12
    pl.pin(pl.seg((cu, cw - 7), (cu, cw + 7), 1.0) | pl.seg((cu - 7, cw), (cu + 7, cw), 1.0), '#5a4a30')
    pl.pin(pl.seg((cu - 4, cw - 4), (cu + 4, cw + 4), 1.0) | pl.seg((cu - 4, cw + 4), (cu + 4, cw - 4), 1.0), '#8a7a58')
    pl.pin(pl.elipse(cu, cw, 2.2, 2.2), '#d8c8a0')
    pl.pin(pl.seg((cu, cw - 7), (cu, cw - 2), 1.6), '#9a2a1e')
    pl.pin(pl.elipse(cu, cw, 1.0, 1.0), '#5a4a30')
    lg = pl.ret(W - 28, 6, W - 5, 18)
    pl.pin(lg, '#d8c8a0')
    pl.pin(lg & pl.borda(lg), '#8a7a58')
    pl.pin(pl.ret(W - 25, 8.5, W - 8, 9.5) | pl.ret(W - 25, 12, W - 14, 13) | pl.ret(W - 25, 15, W - 11, 16), '#6a5a3a')
    pl.pin(pl.ret(W - 11.5, 11, W - 8, 14.5), '#c42e22')


def mapa_frigorifico(xc=1.5, zc=1.6):
    PC.quadro(xc - 0.98, xc + 0.98, zc - 0.55, zc + 0.55, _p_mapa_brasil, MOL_NOGUEIRA, e=0.055)


# ---------- a foto aérea de uma unidade ----------
def _p_foto_unidade(pl, W, H):
    """A foto aérea em sépia (o passe-partout cria a moldura em volta): galpões brancos compridos, o curral, caminhões e a estrada."""
    t = pl.dentro
    pl.pin(t, '#e6dcc2')                                                           # o passe-partout creme
    f0 = 4
    foto = t & (pl.u >= f0) & (pl.u < W - f0) & (pl.w >= f0) & (pl.w < H - f0)
    pl.pin(foto, '#8c9a62')                                                        # o capim
    pl.pin(foto & (pl.w > H * 0.62), '#80905a')
    pl.pin(foto & (((pl.u + pl.w * 1.0) % 9) < 1.2) & (pl.w > H * 0.62), '#76864e')
    # a estrada de terra batida na diagonal e o pátio
    pl.pin(foto & (np.abs(pl.w - (H * 0.78 - (pl.u - W * 0.1) * 0.12)) < 3), '#c4b48a')
    pl.pin(foto & (pl.u > W * 0.28) & (pl.u < W * 0.78) & (pl.w > H * 0.5) & (pl.w < H * 0.62), '#b8a880')
    # os galpões brancos (três, compridos, de telhado de duas águas: uma água clara, uma na sombra) com a cumeeira e o beiral
    for k, (a, b, c_) in enumerate(((6, 7, 42), (6, 15.5, 42), (9, 24, 38))):
        pl.pin(foto & pl.ret(a, b, a + c_, b + 3), '#fbf8ec')
        pl.pin(foto & pl.ret(a, b + 3, a + c_, b + 6.5), '#cfc9b2')
        pl.pin(foto & pl.ret(a, b + 2.6, a + c_, b + 3.6), '#ffffff')
        pl.pin(foto & pl.ret(a, b + 6.5, a + c_, b + 8), '#5c6240')                                      # a sombra no capim
        pl.pin(foto & pl.ret(a, b - 0.6, a + c_, b), '#8a8668')
        for i in range(int(c_ // 7)):
            pl.pin(foto & pl.ret(a + 3 + i * 7, b + 0.6, a + 3.8 + i * 7, b + 2.4), '#b8b29a')
    # o curral (dois anéis de cerca com o gado em pontinhos) à direita
    for (cu, cw, rr) in ((W - 14, 12, 8.5), (W - 12, 29, 7)):
        c0 = pl.elipse(cu, cw, rr, rr * 0.8)
        pl.pin(c0, '#d2c294')
        pl.pin(c0 & ~pl.elipse(cu, cw, rr - 1.2, (rr - 1.2) * 0.8), '#5a4a32')
        pl.pin(c0 & pl.elipse(cu, cw, rr - 1.2, (rr - 1.2) * 0.8) & (((np.floor(pl.u) + np.floor(pl.w) * 3) % 11) == 0), '#a8946a')
    # os caminhões brancos no pátio e a caixa-d'água
    for (u, w) in ((W * 0.33, H * 0.55), (W * 0.46, H * 0.57), (W * 0.6, H * 0.53)):
        pl.pin(pl.ret(u, w, u + 5, w + 2.4), '#fbf8ec')
        pl.pin(pl.ret(u + 4, w, u + 5.6, w + 2.4), '#c42e22')
    pl.pin(pl.elipse(W * 0.82, H * 0.64, 2.0, 2.0), '#f0ecdc')
    # o tom sépia suave por cima da foto e o bordo escuro
    m = pl.opaco() & foto
    pl.rgb[m] = pl.rgb[m] * 0.88 + np.array([58.0, 36.0, 10.0]) * 0.18
    pl.pin(pl.borda(foto), '#5a4630')


def foto_unidade(xc=1.5, zc=1.6):
    PC.quadro(xc - 0.75, xc + 0.75, zc - 0.4, zc + 0.4, _p_foto_unidade, MOL_NOGUEIRA, e=0.07)


# ---------- a placa de bronze e esmalte ----------
LETRA_F = ["#####", "#....", "###..", "#....", "#....", "#....", "#...."]
LETRA_A = [".###.", "#...#", "#...#", "#####", "#...#", "#...#", "#...#"]
DIG = {'1': ["..#", ".##", "..#", "..#", "..#"], '9': ["###", "#.#", "###", "..#", "###"], '8': ["###", "#.#", "###", "#.#", "###"]}


def _p_placa(pl, W, H):
    """O esmalte verde-garrafa com a moldura de bronze: o touro dourado, o monograma FA entrelaçado e '1918'."""
    t = pl.dentro
    pl.pin(t, '#b88a40')                                                           # o bronze
    pl.pin(t & ((pl.u < 1) | (pl.w < 1)), '#e6c470')
    pl.pin(t & ((pl.u > W - 2) | (pl.w > H - 2)), '#7a5624')
    esm = t & (pl.u >= 3) & (pl.u < W - 3) & (pl.w >= 3) & (pl.w < H - 3)
    pl.pin(esm, '#1f3a2a')
    pl.pin(esm & ((pl.u < 4) | (pl.w < 4)), '#142a1e')
    pl.pin(esm & ((pl.u >= W - 4) | (pl.w >= H - 4)), '#2c4c38')
    pl.pin(esm & pl.borda(esm), '#142a1e')
    # os rebites de bronze nos quatro cantos
    for (u, w) in ((1.5, 1.5), (W - 2.5, 1.5), (1.5, H - 2.5), (W - 2.5, H - 2.5)):
        pl.pin(pl.ret(u, w, u + 1, w + 1), '#f0d488')
    ouro = '#e8c460'
    ouro_e = '#a8802e'
    # o touro (de perfil, para a direita, de cabeça baixa) dourado: corpo, corcova, cabeça, chifre, patas e rabo
    bu, bw = 6.0, 5.0
    corpo = pl.elipse(bu + 8.5, bw + 6.0, 6.8, 3.4) | pl.elipse(bu + 12.5, bw + 3.5, 3.6, 3.0) | pl.elipse(bu + 17.5, bw + 5.5, 2.8, 2.3)
    pernas = pl.seg((bu + 4.5, bw + 8), (bu + 4.0, bw + 12), 1.8) | pl.seg((bu + 7.5, bw + 8.5), (bu + 7.5, bw + 12), 1.8) | \
        pl.seg((bu + 12, bw + 8), (bu + 12.5, bw + 12), 1.8) | pl.seg((bu + 15, bw + 7), (bu + 15.5, bw + 12), 1.8)
    chifre = pl.seg((bu + 18, bw + 4), (bu + 20.5, bw + 1.2), 1.2) | pl.seg((bu + 20.5, bw + 1.2), (bu + 19.8, bw - 0.5), 1.0)
    rabo = pl.seg((bu + 2.2, bw + 4.5), (bu + 0.5, bw + 9), 1.0)
    forma = (corpo | pernas | chifre | rabo) & esm
    pl.pin(forma, ouro)
    pl.pin(forma & (pl.w > bw + 7.5) & (pl.w < bw + 11), ouro_e)
    pl.pin(forma & ~pl.elipse(bu + 8.5, bw + 6.0, 5.4, 2.4) & (pl.w < bw + 8) & (pl.u < bu + 11), ouro_e)
    pl.pin(pl.ret(bu + 18.5, bw + 5, bu + 19.5, bw + 6), '#1f3a2a')                    # o olho
    # a linha vertical separando o touro do monograma
    pl.pin(esm & pl.ret(W * 0.46, 5, W * 0.46 + 1, H - 5), ouro_e)
    # o monograma FA entrelaçado (as letras se sobrepõem em 2 px) e o '1918' embaixo, à direita
    mu = W * 0.46 + 6
    mw = 4
    from_str = lambda ln: [r.replace('#', 'g').replace('.', '.') for r in ln]
    PC._spr(pl, int(mu), mw, from_str(LETRA_F), {'g': ouro})
    PC._spr(pl, int(mu) + 3, mw + 1, from_str(LETRA_A), {'g': '#f6dc88'})
    pl.pin(pl.ret(mu, mw + 9, mu + 14, mw + 10), ouro_e)
    for i, d in enumerate('1918'):
        PC._spr(pl, int(mu) + 0 + i * 4, mw + 12, [r.replace('#', 'g') for r in DIG[d]], {'g': ouro})
    # o brilho do bronze (uma risca diagonal fina clareia o que já está pintado)
    br = t & (np.abs(pl.u * 0.9 - pl.w * 2.0 - W * 0.2) < 0.8) & (pl.u > 8)
    pl.tom(br, 1.14)


def placa_frigorifico(xc=1.5, zc=1.6):
    PC.quadro(xc - 0.7, xc + 0.7, zc - 0.25, zc + 0.25, _p_placa, ('#3a2410', '#8a5e2a', '#d8ac58', '#f0d488'), e=0.03, fundo=0.04)


# ---------- os três diplomas ----------
def _p_diploma(selo='#b82a22', k=0):
    def p(pl, W, H):
        t = pl.dentro
        pl.pin(t, '#eee2c0')
        pl.pin(t & ((pl.u < 2) | (pl.w < 2) | (pl.u >= W - 2) | (pl.w >= H - 2)), '#d8b868')                  # o fio dourado
        pl.pin(t & (pl.u >= 3) & (pl.u < W - 3) & (pl.w >= 3) & (pl.w < H - 3) & ((pl.u < 4) | (pl.w < 4) | (pl.u >= W - 4) | (pl.w >= H - 4)), '#b8a070')
        cu = W / 2
        pl.pin(pl.ret(cu - 5, 7, cu + 5, 8), '#7a5a38')
        pl.pin(pl.ret(cu - 3, 9.5, cu + 3, 10.5), '#9a7a4a')                                                     # o título
        for i in range(4 + k % 2):                                                                       # as linhas de texto
            ln = 15 + i * 3
            pl.pin(pl.ret(5, ln, W - 5 - (i % 2) * 3, ln + 1), '#a8987a')
        pl.pin(pl.ret(cu - 5, H - 11, cu - 1, H - 10), '#8a7a58')                                         # a assinatura
        pl.pin(pl.seg((cu - 1, H - 7), (cu - 3, H - 3), 1.6) | pl.seg((cu + 1, H - 7), (cu + 3, H - 3), 1.6), _tom(hx(selo), 0.8))
        pl.pin(pl.elipse(cu, H - 9, 3.2, 3.2), selo)
        pl.pin(pl.elipse(cu, H - 9, 3.2, 3.2) & ~pl.elipse(cu, H - 9, 2.4, 2.4), '#d8b868')
        pl.pin(pl.elipse(cu, H - 9, 1.6, 1.6), _tom(hx(selo), 1.3))
    return p


def diplomas(xc=1.5, zc=1.6):
    w, h = 0.36, 0.5
    for k, dx in enumerate((-0.42, 0.0, 0.42)):
        PC.quadro(xc + dx - w / 2, xc + dx + w / 2, zc - h / 2, zc + h / 2, _p_diploma(('#b82a22', '#a02a22', '#b83a2a')[k], k), MOL_NOGUEIRA, e=0.035)


# ---------- a vitrine de troféus ----------
def _taca(pl, u, w, h, cor='#e8c460'):
    """A taça: o pé, a haste, o bojo com as duas alças; u, w o meio da base."""
    esc = hexs(_tom(hx(cor), 0.7))
    cla = hexs(_tom(hx(cor), 1.25))
    pl.pin(pl.ret(u - h * 0.28, w - 1, u + h * 0.28, w), esc)
    pl.pin(pl.ret(u - 0.6, w - h * 0.45, u + 0.6, w - 1), cor)
    pl.pin(pl.poli([(u - h * 0.32, w - h), (u + h * 0.32, w - h), (u + h * 0.2, w - h * 0.5), (u - h * 0.2, w - h * 0.5)]), cor)
    pl.pin(pl.ret(u - h * 0.3, w - h, u - h * 0.12, w - h * 0.85), cla)
    pl.pin(pl.seg((u - h * 0.32, w - h * 0.9), (u - h * 0.42, w - h * 0.68), 1.0) | pl.seg((u + h * 0.32, w - h * 0.9), (u + h * 0.42, w - h * 0.68), 1.0), esc)


def _obelisco(pl, u, w, h, cor='#cfe4f0'):
    """O troféu de cristal (obelisco facetado): a base de vidro, o corpo em duas faces (clara e escura) e a ponta."""
    pl.pin(pl.ret(u - 3, w - 2, u + 3, w), '#9db8c4')
    pl.pin(pl.poli([(u - 2, w - 2), (u + 2, w - 2), (u + 1.5, w - h + 3), (u, w - h), (u - 1.5, w - h + 3)]), cor)
    pl.pin(pl.poli([(u, w - 2), (u + 2, w - 2), (u + 1.5, w - h + 3), (u, w - h)]), '#a4c4d4')
    pl.pin(pl.ret(u - 1.4, w - h + 4, u - 0.4, w - 4), '#f4fcff')


def _p_vitrine(pl, W, H):
    """O fundo da vitrine (veludo verde-garrafa), as prateleiras de vidro e o que está nelas: taças, cristais, placas, medalhas."""
    t = pl.dentro
    pl.pin(t, '#17281e')
    pl.pin(t & (np.floor(pl.u) % 4 == 0), '#1b2f23')
    pl.pin(t & (pl.w < 2), '#0e1a14')
    pl.pin(t & (pl.u < 2), '#122219')
    zs = (H * 0.5 - 1, H - 2)
    for z in zs[:-1]:
        pl.pin(t & (pl.w >= z) & (pl.w < z + 2), '#8ab4bc')                                                     # a prateleira de vidro (a borda)
        pl.pin(t & (pl.w >= z + 2) & (pl.w < z + 3), '#233a2c')
        pl.pin(t & (pl.w >= z) & (pl.w < z + 1), '#d4f0f4')
    pl.pin(t & (pl.w >= H - 2), '#8ab4bc')
    top = zs[0]
    # em cima: taças, obelisco de cristal, placa de madeira, um globo de cristal
    _taca(pl, 10, top, 14, '#e8c460')
    _obelisco(pl, 24, top, 18)
    _taca(pl, 38, top, 12, '#cfd2d6')
    pl.pin(pl.ret(48, top - 11, 62, top), '#6a4426')
    pl.pin(pl.ret(49, top - 10, 61, top - 1), '#8a5e36')
    pl.pin(pl.ret(51, top - 8, 59, top - 7), '#e8c460')
    pl.pin(pl.ret(51, top - 5, 57, top - 4), '#c8a050')
    _obelisco(pl, 70, top, 14, '#e0d4f0')
    _taca(pl, 82, top, 15, '#c88a4a')
    # embaixo: placas de bronze com fita, medalhões, troféu de cristal grande e uma taça grande
    base = H - 2
    pl.pin(pl.ret(4, base - 10, 18, base), '#5a3a22')
    pl.pin(pl.ret(5, base - 9, 17, base - 1), '#b88a40')
    pl.pin(pl.ret(7, base - 6, 15, base - 5), '#e6c470')
    pl.pin(pl.ret(7, base - 3.5, 13, base - 2.5), '#8a6428')
    _taca(pl, 29, base, 16, '#e8c460')
    for (u, c_) in ((42, '#e8c460'), (49, '#cfd2d6'), (56, '#c88a4a')):
        pl.pin(pl.elipse(u, base - 4.5, 3.4, 3.4), c_)
        pl.pin(pl.elipse(u, base - 4.5, 2.2, 2.2), _tom(hx(c_), 0.82))
        pl.pin(pl.seg((u - 1.5, base - 8), (u, base - 12), 1.0) | pl.seg((u + 1.5, base - 8), (u, base - 12), 1.0), '#9a2a22' if c_ == '#e8c460' else '#2a4a6a')
    _obelisco(pl, 68, base, 20)
    pl.pin(pl.ret(75, base - 12, 87, base), '#5a3a22')
    pl.pin(pl.ret(76, base - 11, 86, base - 1), '#9a6a38')
    pl.pin(pl.ret(78, base - 8, 84, base - 7), '#e6c470')
    pl.pin(pl.ret(78, base - 5, 83, base - 4), '#c8a050')
    # os reflexos do vidro da frente: duas faixas diagonais que clareiam o que estiver embaixo
    for (a, esp) in ((W * 0.3, 3), (W * 0.62, 1.4)):
        d = pl.u * 0.85 + pl.w * 0.5
        pl.tom(t & (np.abs(d - a) < esp) & (pl.w > 2), 1.2)


def trofeus_empresa(xc=1.5, zc=1.6):
    n0 = len(C().objs)
    a, b = 1.12, 0.5
    x0, x1, z0, z1 = xc - a, xc + a, zc - b, zc + b
    f = 0.06
    fundo = 0.14
    ez = f * KX / KZ
    MAD = mad2('#4a2c1a', eixo=0, seed=461, passo=0.05)
    # a moldura-caixa de nogueira (as quatro réguas) e a cornija
    for bb in ((x0, x1, 0.0, fundo, z1 - ez, z1), (x0, x1, 0.0, fundo, z0, z0 + ez), (x0, x0 + f, 0.0, fundo, z0 + ez, z1 - ez), (x1 - f, x1, 0.0, fundo, z0 + ez, z1 - ez)):
        PC.caixa(bb, {'cima': liso(ND_L), 'frente': _pau('#52301d', ND_L, quina=1.25, b=(0, 0, 0, 0, 0, 9)), '*': MAD}, ch=0.01)
    PC.caixa((x0 - 0.02, x1 + 0.02, 0.0, fundo + 0.02, z1, z1 + 0.04), _pau('#5a3622', ND_L, quina=1.25, b=(0, 0, 0, 0, 0, z1 + 0.04)))
    pl = PC.Pl(x0 + f - PH, x1 - f + PH, z0 + ez - PZ, z1 - ez + PZ, 0.03)
    pl.u, pl.w = pl.u - 1, pl.w - 1
    _p_vitrine(pl, (x1 - x0 - 2 * f) * KX, (z1 - z0 - 2 * ez) * KZ)
    m = pl.opaco()
    pl.rgb[m & (pl.w < 1)] = _tom(pl.rgb[m & (pl.w < 1)], 0.7)
    pl.grava()
    PC.sombra_parede(n0, 1, 2)


# ---------------------------------------------------------------------------------------------------------------------
ITENS = {
    'mesa_ceo': (4, 2, (0.0, 0.0), _mesa_ceo, {}),
    'cadeira_ceo': (1, 1, (0.0, 0.0), _cadeira_ceo, {}),
    'cofre': (1, 1, (0.0, 0.0), _cofre_fechado, {'1': _cofre(True)}),
    'globo': (1, 1, (0.0, 0.0), _globo, {}),
    'bar_escritorio': (2, 1, (0.0, 0.0), _bar(False), {'1': _bar(True)}),
    'estante_biblioteca': (3, 1, (0.0, 0.0), _estante_biblioteca, {}),
    'escada_biblioteca': (1, 1, (0.0, 0.0), _escada_biblioteca, {}),
    'mesa_leitura': (4, 2, (0.0, 0.0), _mesa_leitura, {}),
    'touro_bronze': (1, 1, (0.0, 0.0), _touro, {}),
}

ITENS_PAREDE = {
    'mapa_frigorifico': (lambda: mapa_frigorifico(1.5, 1.6), (1.5, 1.6)),
    'foto_unidade': (lambda: foto_unidade(1.5, 1.6), (1.5, 1.6)),
    'placa_frigorifico': (lambda: placa_frigorifico(1.5, 1.6), (1.5, 1.6)),
    'diplomas': (lambda: diplomas(1.5, 1.6), (1.5, 1.6)),
    'trofeus_empresa': (lambda: trofeus_empresa(1.5, 1.6), (1.5, 1.6)),
}
