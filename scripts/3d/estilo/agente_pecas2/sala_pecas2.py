"""
Teste 2 do estilo da referência: a sala pequena (5 x 5 casas) com os móveis grandes, cada tábua e cada pedra com
luz em cima e sombra embaixo (o chanfro desenhado), veio na madeira, a moldura grossa, a lareira em degraus e as
sombras macias (em degraus) embaixo dos móveis e nos cantos. 1 pixel da arte = 1,33 do tabuleiro (ESC 0,75).
"""
import os
import sys
os.environ['ESC'] = os.environ.get('ESC', '0.75')
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'codigo'))
import math
import numpy as np
from PIL import Image
from motor import Cena, MUNDO, tela, ruido, emissivo

M = MUNDO
SALA = 5.25
ALTO = 2.85
ESP = 0.16
PXM = 0.032          # ~1 pixel da arte, em metros (no chão e na parede)


def hx(h):
    h = h.lstrip('#')
    return np.array([int(h[i:i + 2], 16) for i in (0, 2, 4)], float)


def coords(L, n):
    if abs(n[2]) > 0.5:
        return L[:, 0], L[:, 1]
    if abs(n[1]) >= abs(n[0]):
        return L[:, 0], L[:, 2]
    return L[:, 1], L[:, 2]


def liso(c):
    c = hx(c)
    return emissivo(lambda L, n, P: np.tile(c, (len(L), 1)))


def madeira(c, eixo=0, seed=0, veio=True):
    """A madeira do móvel: a cor e o veio claro (riscas finas e quebradas ao longo da peça)."""
    c = hx(c)

    def f(L, n, P):
        a, b = coords(L, n)
        t, s = (a, b) if eixo == 0 else (b, a)
        out = np.tile(c, (len(L), 1))
        if veio:
            g = s / 0.09
            fila = np.floor(g)
            w = (g % 1) - (0.35 + 0.3 * ruido(fila, seed)) - 0.08 * np.sin(t * 5 + fila * 2.1)
            risca = (np.abs(w) < 0.5 * PXM / 0.09) & (np.sin(t * 3.1 + fila * 1.7 + seed) > -0.1)
            out = np.where(risca[:, None], out * 1.1 + 4, out)
        return out
    return emissivo(f)


def tabuas(cores, larg, comp, junta, eixo=0, seed=0, ponta=True, veio=True):
    """Tábuas com o chanfro desenhado: a junta escura, 1 px claro logo depois dela e 1 px mais escuro antes; o veio."""
    cs = [hx(x) for x in cores]
    jc = hx(junta)

    def f(L, n, P):
        a, b = coords(L, n)
        t, s = (a, b) if eixo == 0 else (b, a)
        fila = np.floor(s / larg)
        off = ruido(fila, seed + 1) * comp
        col = np.floor((t + off) / comp) if ponta else np.zeros_like(t)
        k = (ruido(fila, col, seed + 2) * len(cs)).astype(int) % len(cs)
        out = np.stack(cs)[k]
        g = (s / larg) % 1
        e = PXM / larg
        if veio:
            for j, base in enumerate((0.3, 0.62)):
                w = g - (base + 0.12 * ruido(fila, col, seed + 5 + j)) - 0.05 * np.sin(t * 4.3 + fila * 2.3 + j)
                risca = (np.abs(w) < 0.5 * e) & (np.sin(t * 2.7 + fila * 1.3 + j * 2) > -0.25)
                out = np.where(risca[:, None], out * 1.08 + 3, out)
        out = np.where(((g > e) & (g < 2.2 * e))[:, None], out * 1.16 + 6, out)
        out = np.where((g > 1 - e)[:, None], out * 0.86, out)
        jun = g < e
        if ponta:
            h = ((t + off) / comp) % 1
            ep = PXM / comp
            jun |= h < ep
            out = np.where(((h > ep) & (h < 2 * ep))[:, None], out * 1.1 + 4, out)
        return np.where(jun[:, None], jc, out)
    return emissivo(f)


def pedras(cores, junta, alt=0.17, comp=0.3, seed=0, so_frente=False):
    """Pedras em fiadas desencontradas, cada uma com a luz em cima e à esquerda e a sombra embaixo e à direita."""
    cs = [hx(x) for x in cores]
    jc = hx(junta)

    def f(L, n, P):
        if abs(n[2]) > 0.5:
            a, b = L[:, 0] - L[:, 1] * 0.0, L[:, 1]
            altura = 0.2
        else:
            a, b = coords(L, n)
            b = -b                      # a fiada de cima primeiro: "em cima" é o começo da pedra
            altura = alt
        fila = np.floor(b / altura)
        off = (fila % 2) * comp * 0.5 + ruido(fila, seed) * 0.06
        col = np.floor((a + off) / comp)
        k = (ruido(fila, col, seed + 3) * len(cs)).astype(int) % len(cs)
        out = np.stack(cs)[k]
        gb = (b / altura) % 1
        ga = ((a + off) / comp) % 1
        eb, ea = PXM / altura, PXM / comp
        out = np.where(((gb > eb) & (gb < 2.5 * eb))[:, None], out * 1.18 + 8, out)     # a luz em cima
        out = np.where(((ga > ea) & (ga < 2 * ea))[:, None], out * 1.08 + 3, out)       # e à esquerda
        out = np.where((gb > 1 - 1.5 * eb)[:, None], out * 0.8, out)                    # a sombra embaixo
        out = np.where((ga > 1 - ea)[:, None], out * 0.88, out)
        jun = (gb < eb) | (ga < ea)
        return np.where(jun[:, None], jc, out)
    return emissivo(f)


def lambri(c, risca, luz, passo=0.2):
    c, r, lz = hx(c), hx(risca), hx(luz)

    def f(L, n, P):
        a, b = coords(L, n)
        g = (a / passo) % 1
        e = PXM / passo
        out = np.tile(c, (len(L), 1))
        out = np.where(((g > e) & (g < 2 * e))[:, None], lz, out)
        out = np.where((g > 1 - e)[:, None], out * 0.95, out)
        out = np.where((g < e)[:, None], r, out)
        # a parede clareia um pouco para cima
        out = out * (0.94 + 0.06 * np.clip(b / ALTO, 0, 1))[:, None]
        return out
    return emissivo(f)


# a paleta (a da referência: madeira laranja quente, lambri creme, pedra cinza)
CHAO = ['#c47a42', '#cc844a', '#bd7440']
CHAO_J = '#6e3a1e'
MOV = '#a9693a'
MOV_ESC = '#94582f'
MOV_CLA = '#b8773f'
MOLD = ['#b5733e', '#ad6c3a']
COURO, COURO_C = '#a8602f', '#bb7040'
PEDRA = ['#a4a39e', '#96958f', '#afaea8', '#8c8b86']
PEDRA_J = '#4e4b48'

cantos = np.array([[x, y, z] for x in (-0.5, SALA + 0.3) for y in (-0.5, SALA + 0.3) for z in (-0.35, ALTO + 0.5)])
S = tela(cantos)
x0, y0 = int(S[:, 0].min()) - 4, int(S[:, 1].min()) - 4
c = Cena(x0, y0, int(S[:, 0].max() - x0) + 4, int(S[:, 1].max() - y0) + 4)
luzes = set()
pegadas = []


def caixa(b, mat, tipo=3, sombra=True, ch=0.0):
    o = c.novo_obj(tipo)
    c.caixa(b, mat, M, o, ch=ch)
    if sombra and tipo == 3 and b[4] < 0.05:
        pegadas.append(b[:4])
    return o


def disco_de_pe(cx, y, cz, r, mat, lados=20):
    """Um disco em pé, de frente para +y (o mostrador do relógio)."""
    o = c.novo_obj(3)
    pts = [(cx + r * math.cos(2 * math.pi * i / lados), y, cz + r * math.sin(2 * math.pi * i / lados)) for i in range(lados)]
    c.face_plana(pts, (0, 1, 0), mat, M, o)
    return o



# ---------- a sala (medida na referência: quadrada, a parede 0,6 do lado, a viga grossa, o lambri com a barra escura) ----------
o = c.novo_obj(1)
c.caixa((0, SALA, 0, SALA, -0.28, 0), {'cima': tabuas(CHAO, 0.32, 1.25, CHAO_J),
                                      '*': madeira('#94552c', veio=False)}, M, o)
LB = lambri('#ddd5c7', '#a89c8a', '#ebe5da', passo=0.25)
caixa((-ESP, SALA, -ESP, 0, 0, ALTO), {'frente': LB, '*': liso('#8a5230')}, tipo=2)
caixa((-ESP, 0, 0, SALA, 0, ALTO), {'dir': LB, '*': liso('#8a5230')}, tipo=2)
# a barra de madeira escura embaixo do lambri (com o friso em cima)
BAR = tabuas(['#7e4a2a', '#84502e'], 0.2, 9, '#5a3018', ponta=False, veio=False)
BARy = tabuas(['#7e4a2a', '#84502e'], 0.2, 9, '#5a3018', eixo=1, ponta=False, veio=False)
caixa((0, SALA, 0, 0.035, 0, 0.46), {'frente': emissivo(lambda L, n, P: np.where(((L[:, 0] / 0.34) % 1 < PXM / 0.34)[:, None], hx('#5a3018'), hx('#7e4a2a'))), '*': liso('#7e4a2a')}, tipo=2)
caixa((0, 0.035, 0.035, SALA, 0, 0.46), {'dir': emissivo(lambda L, n, P: np.where(((L[:, 1] / 0.34) % 1 < PXM / 0.34)[:, None], hx('#5a3018'), hx('#7e4a2a'))), '*': liso('#7e4a2a')}, tipo=2)
caixa((0, SALA, 0, 0.06, 0.46, 0.52), madeira('#9a5e34'), tipo=2)
caixa((0, 0.06, 0.06, SALA, 0.46, 0.52), madeira('#9a5e34', eixo=1), tipo=2)
# a viga grossa em cima e os pilares (no canto de trás e nas duas pontas da frente)
VG = tabuas(MOLD, 0.6, 9, '#7a4222', ponta=False)
VGy = tabuas(MOLD, 0.6, 9, '#7a4222', eixo=1, ponta=False)
caixa((-ESP - 0.14, SALA + 0.12, -ESP - 0.14, 0.16, ALTO, ALTO + 0.38), {'*': VG, 'cima': VG}, tipo=2)
caixa((-ESP - 0.14, 0.16, 0.16, SALA + 0.12, ALTO, ALTO + 0.38), {'*': VG, 'cima': VGy}, tipo=2)
PIL = madeira('#a3633a', eixo=1)
caixa((-ESP - 0.06, 0.12, -ESP - 0.06, 0.12, 0, ALTO), PIL, tipo=2)
caixa((SALA - 0.12, SALA + 0.1, -ESP - 0.1, 0.12, -0.28, ALTO), PIL, tipo=2)
caixa((-ESP - 0.1, 0.12, SALA - 0.12, SALA + 0.1, -0.28, ALTO), PIL, tipo=2)


# ---------- os móveis ----------
def mesa(x, y, w, d, h=0.78, tampo=0.1, perna=0.11):
    caixa((x, x + w, y, y + d, h - tampo, h), {'cima': tabuas([MOV_CLA, '#b2723c'], 0.2, 9, '#6e3c1e', eixo=0 if w >= d else 1, ponta=False),
                                              '*': madeira(MOV)}, sombra=False)
    caixa((x + 0.07, x + w - 0.07, y + 0.07, y + d - 0.07, h - tampo - 0.12, h - tampo), madeira(MOV_ESC), sombra=False)
    for (a, b) in ((x + 0.05, y + 0.05), (x + w - 0.05 - perna, y + 0.05), (x + 0.05, y + d - 0.05 - perna), (x + w - 0.05 - perna, y + d - 0.05 - perna)):
        caixa((a, a + perna, b, b + perna, 0, h - tampo), madeira(MOV, eixo=1), sombra=False)
    pegadas.append((x, x + w, y, y + d))


def cadeira(x, y, costas, s=0.48):
    hs = 0.48
    caixa((x, x + s, y, y + s, hs - 0.07, hs), {'cima': tabuas([MOV_CLA], 0.12, 9, '#6e3c1e', ponta=False), '*': madeira(MOV)}, sombra=False)
    for (a, b) in ((x + 0.03, y + 0.03), (x + s - 0.1, y + 0.03), (x + 0.03, y + s - 0.1), (x + s - 0.1, y + s - 0.1)):
        caixa((a, a + 0.07, b, b + 0.07, 0, hs - 0.07), madeira(MOV_ESC, eixo=1, veio=False), sombra=False)
    if costas in ('-y', '+y'):
        yy = y + 0.02 if costas == '-y' else y + s - 0.09
        for a in (x + 0.03, x + s - 0.1):
            caixa((a, a + 0.07, yy, yy + 0.07, hs, 1.02), madeira(MOV_ESC, eixo=1, veio=False), sombra=False)
        caixa((x + 0.03, x + s - 0.03, yy + 0.01, yy + 0.06, 0.86, 1.0), madeira(MOV_CLA), sombra=False)
        for a in (x + 0.15, x + s - 0.2):
            caixa((a, a + 0.05, yy + 0.015, yy + 0.055, hs, 0.86), madeira(MOV), sombra=False)
    else:
        xx = x + 0.02 if costas == '-x' else x + s - 0.09
        for b in (y + 0.03, y + s - 0.1):
            caixa((xx, xx + 0.07, b, b + 0.07, hs, 1.02), madeira(MOV_ESC, eixo=1, veio=False), sombra=False)
        caixa((xx + 0.01, xx + 0.06, y + 0.03, y + s - 0.03, 0.86, 1.0), madeira(MOV_CLA, eixo=1), sombra=False)
        for b in (y + 0.15, y + s - 0.2):
            caixa((xx + 0.015, xx + 0.055, b, b + 0.05, hs, 0.86), madeira(MOV), sombra=False)
    pegadas.append((x, x + s, y, y + s))


def livros(x0, x1, y, z, fundo, seed):
    x = x0 + 0.04
    i = 0
    cores = ['#8a3e30', '#3f5e74', '#6e6d3c', '#946030', '#5c4060', '#2f4a3a', '#a07040']
    while x < x1 - 0.06:
        r = ruido(i, seed)
        if r < 0.62:
            n = 3 + int(ruido(i, seed + 1) * 4)
            for k in range(n):
                if x > x1 - 0.07:
                    break
                cor = cores[int(ruido(i, k, seed) * len(cores))]
                hh = 0.24 + 0.1 * ruido(k, i, seed + 2)
                ww = 0.05 + 0.025 * ruido(k, i, seed + 3)
                caixa((x, x + ww, y + 0.05, y + fundo - 0.04, z, z + hh), {'*': liso(cor), 'cima': liso('#e8dcc0')}, sombra=False)
                x += ww + 0.004
        elif r < 0.82:
            o = c.novo_obj(3)
            c.cilindro(x + 0.09, y + fundo / 2, 0.08, z, z + 0.18, liso(['#8a8a84', '#b06a40', '#5a6a70'][int(ruido(i, seed + 4) * 3)]), M, o, lados=12,
                       tampa_mat=liso('#3a2a20'))
            x += 0.2
        else:
            o = c.novo_obj(3)
            c.cilindro(x + 0.1, y + fundo / 2, 0.1, z, z + 0.07, liso('#d8d0c0'), M, o, lados=14, r1=0.12)
            x += 0.24
        x += 0.03
        i += 1


def estante(x0, x1, y, fundo=0.4, h=1.75, prat=(0.06, 0.5, 0.92, 1.34), seed=1):
    lado = madeira(MOV, eixo=1)
    topo = madeira(MOV_CLA)
    caixa((x0, x0 + 0.07, y, y + fundo, 0, h), {'*': lado, 'cima': topo})
    caixa((x1 - 0.07, x1, y, y + fundo, 0, h), {'*': lado, 'cima': topo})
    caixa((x0, x1, y, y + 0.03, 0, h), liso('#6a3a1e'))
    caixa((x0 - 0.03, x1 + 0.03, y, y + fundo + 0.03, h - 0.06, h), {'cima': topo, '*': madeira(MOV)})
    for i, z in enumerate(prat):
        caixa((x0 + 0.07, x1 - 0.07, y, y + fundo, z, z + 0.05), {'cima': topo, '*': madeira(MOV)})
        if i > 0 or len(prat) < 4:
            livros(x0 + 0.07, x1 - 0.07, y, z + 0.05, fundo, seed + i)
    return y + fundo


def lareira(m, y=0.0):
    """A lareira de pedra em degraus: a pedra do pé, a base com o arco e o fogo, o consolo e a chaminé afinando."""
    P = pedras(PEDRA, PEDRA_J)
    caixa((m - 0.74, m + 0.74, y, y + 1.0, 0, 0.09), {'*': pedras(['#c9c8c2', '#bdbcb6'], PEDRA_J, alt=0.09, comp=0.36)})
    caixa((m - 0.6, m + 0.6, y, y + 0.66, 0.09, 1.02), {'*': P, 'cima': P})
    # o arco (o buraco escuro em cima do pé) e o fogo dentro
    yb = y + 0.66 + 0.002
    o = c.novo_obj(3)
    arco = [(m - 0.32, yb, 0.09), (m + 0.32, yb, 0.09)] + [(m + 0.32 * math.cos(a), yb, 0.5 + 0.3 * math.sin(a)) for a in np.linspace(0, math.pi, 12)]
    c.face_plana([(m + 0.32, yb, 0.09), (m + 0.32, yb, 0.5)] + [(m + 0.32 * math.cos(a), yb, 0.5 + 0.32 * math.sin(a)) for a in np.linspace(0, math.pi, 14)] + [(m - 0.32, yb, 0.09)],
                 (0, 1, 0), liso('#2a1812'), M, o)
    # as pedras do arco (a volta clara)
    o = c.novo_obj(3)
    for i in range(7):
        a0, a1 = math.pi * i / 7, math.pi * (i + 1) / 7
        r0, r1 = 0.32, 0.42
        c.face_plana([(m + r0 * math.cos(a0), yb + 0.001, 0.5 + r0 * math.sin(a0)), (m + r1 * math.cos(a0), yb + 0.001, 0.5 + r1 * math.sin(a0)),
                      (m + r1 * math.cos(a1), yb + 0.001, 0.5 + r1 * math.sin(a1)), (m + r0 * math.cos(a1), yb + 0.001, 0.5 + r0 * math.sin(a1))],
                     (0, 1, 0), liso(['#cfcec8', '#c2c1bb'][i % 2]), M, o)
    fogo = c.novo_obj(3, contorno=False)
    luzes.add(fogo)
    yf = yb + 0.004
    for (a, w_, hh, cor) in ((-0.26, 0.2, 0.3, '#d8602a'), (-0.12, 0.24, 0.44, '#f09030'), (0.06, 0.2, 0.34, '#d8602a'),
                             (-0.08, 0.16, 0.32, '#f6c040'), (-0.03, 0.08, 0.18, '#fff2a8')):
        c.face_plana([(m + a, yf, 0.16), (m + a + w_, yf, 0.16), (m + a + w_ * 0.55, yf, 0.16 + hh)], (0, 1, 0), liso(cor), M, fogo)
    lenha = c.novo_obj(3)
    c.face_plana([(m - 0.28, yf + 0.001, 0.1), (m + 0.28, yf + 0.001, 0.1), (m + 0.24, yf + 0.001, 0.18), (m - 0.24, yf + 0.001, 0.18)], (0, 1, 0), liso('#5a3420'), M, lenha)
    # o consolo e a chaminé em degraus
    caixa((m - 0.68, m + 0.68, y, y + 0.74, 1.02, 1.12), {'*': liso('#cfcdc6'), 'cima': liso('#d9d7d0')})
    for (meia, fundo, z0, z1) in ((0.52, 0.56, 1.12, 1.5), (0.43, 0.47, 1.5, 1.86), (0.34, 0.38, 1.86, ALTO + 0.24)):
        caixa((m - meia, m + meia, y, y + fundo, z0, z1), {'*': P, 'cima': pedras(['#c9c8c2', '#bdbcb6'], PEDRA_J, alt=0.12)})
    pegadas.append((m - 0.74, m + 0.74, y, y + 1.0))


def sofa(x, y0, y1):
    C, Cc = liso(COURO), liso(COURO_C)
    caixa((x, x + 0.9, y0, y1, 0.06, 0.44), {'*': C, 'cima': Cc}, ch=0.05)
    caixa((x, x + 0.26, y0 + 0.04, y1 - 0.04, 0.4, 0.95), {'*': C, 'cima': Cc}, ch=0.08)
    caixa((x, x + 0.9, y0, y0 + 0.24, 0.4, 0.7), {'*': C, 'cima': Cc}, ch=0.09)
    caixa((x, x + 0.9, y1 - 0.24, y1, 0.4, 0.7), {'*': C, 'cima': Cc}, ch=0.09)
    m = (y0 + y1) / 2
    caixa((x + 0.24, x + 0.88, y0 + 0.24, m - 0.01, 0.42, 0.56), {'*': C, 'cima': Cc}, sombra=False, ch=0.05)
    caixa((x + 0.24, x + 0.88, m + 0.01, y1 - 0.24, 0.42, 0.56), {'*': C, 'cima': Cc}, sombra=False, ch=0.05)
    for b in (y0 + 0.04, y1 - 0.1):
        caixa((x + 0.78, x + 0.84, b, b + 0.06, 0, 0.06), liso('#4a2a18'), sombra=False)
    pegadas.append((x, x + 0.9, y0, y1))


def porta(y0, y1):
    caixa((0, 0.06, y0 - 0.1, y1 + 0.1, 0, 2.08), madeira('#9a5a30', eixo=1), tipo=2)
    caixa((0, 0.05, y0, y1, 0, 1.98), {'dir': tabuas(['#a8683a', '#b0703f', '#a26338'], 0.18, 9, '#6a3a1e', eixo=1, ponta=False), '*': liso('#8e532d')}, tipo=2)
    caixa((0, 0.07, y0 + 0.1, y1 - 0.1, 1.15, 1.78), madeira('#7a4424'), tipo=2)
    for (a0, a1, b0, b1) in ((y0 + 0.14, (y0 + y1) / 2 - 0.02, 1.48, 1.74), ((y0 + y1) / 2 + 0.02, y1 - 0.14, 1.48, 1.74),
                             (y0 + 0.14, (y0 + y1) / 2 - 0.02, 1.19, 1.44), ((y0 + y1) / 2 + 0.02, y1 - 0.14, 1.19, 1.44)):
        caixa((0, 0.072, a0, a1, b0, b1), {'dir': emissivo(lambda L, n, P: np.where((L[:, 2] - L[:, 1] * 0.8 > 1.3)[:, None] & (L[:, 2] - L[:, 1] * 0.8 < 1.34)[:, None],
                                                                                    hx('#e8f6fc'), hx('#9fd0e6'))), '*': liso('#7a4424')}, tipo=2)
    caixa((0.05, 0.11, y1 - 0.16, y1 - 0.09, 0.95, 1.02), liso('#d4a640'), tipo=2)


def quadro(x0, x1, z0, z1):
    caixa((x0, x1, 0, 0.05, z0, z1), madeira('#7a4424'), tipo=2)
    caixa((x0 + 0.06, x1 - 0.06, 0, 0.055, z0 + 0.06, z1 - 0.06), liso('#c8b890'), tipo=2)
    caixa((x0 + 0.06, x1 - 0.06, 0, 0.056, z0 + 0.06, z0 + 0.16), liso('#6e7a4a'), tipo=2)
    caixa((x0 + 0.14, x1 - 0.2, 0, 0.057, z0 + 0.14, z1 - 0.16), liso('#8a9a7a'), tipo=2)


def placa(x0, x1, z0, z1):
    caixa((x0, x1, 0, 0.03, z0, z1), madeira('#8a5030'), tipo=2)


def barril(x, y, r=0.24, h=0.46):
    o = c.novo_obj(3)
    c.cilindro(x, y, r, 0, h, madeira('#9a5c32', eixo=1), M, o, lados=16,
               tampa_mat=tabuas(['#c08850', '#b47c48'], 0.09, 9, '#6a3a1e', ponta=False))
    for z in (0.07, h - 0.13):
        o2 = c.novo_obj(3)
        c.cilindro(x, y, r + 0.01, z, z + 0.05, liso('#55555a'), M, o2, lados=16, tampa=False)
    pegadas.append((x - r, x + r, y - r, y + r))


def pinheirinho(x, y, z):
    o = c.novo_obj(3)
    c.cilindro(x, y, 0.09, z, z + 0.12, liso('#a05a36'), M, o, lados=12, tampa_mat=liso('#4a3020'))
    for k, (r, a) in enumerate(((0.16, 0.1), (0.12, 0.24), (0.08, 0.36))):
        o = c.novo_obj(3)
        c.cilindro(x, y, r, z + a, z + a + 0.18, liso(['#3c7448', '#447e50', '#4c8858'][k]), M, o, lados=14, r1=0.012)


def vaso(x, y, z):
    o = c.novo_obj(3)
    c.cilindro(x, y, 0.06, z, z + 0.08, liso('#b0603a'), M, o, lados=12, tampa_mat=liso('#4a3020'))
    o = c.novo_obj(3)
    c.elipsoide(np.array([x, y, z + 0.13]), np.array([0.08, 0.08, 0.07]), liso('#4e8a4e'), o)


def escrivaninha_piano(x0, x1, y0, y1):
    mesa(x0, y0, x1 - x0, y1 - y0, h=0.8, tampo=0.08, perna=0.08)
    # o teclado: o corpo escuro e as teclas
    caixa((x0 + 0.05, x1 - 0.05, y0 + 0.08, y0 + 0.32, 0.8, 0.86), liso('#3a3236'), sombra=False)
    tecla = emissivo(lambda L, n, P: np.where(((L[:, 0] / 0.045) % 1 < 0.25)[:, None], hx('#4a4448'), hx('#f2eee6')))
    caixa((x0 + 0.08, x1 - 0.08, y0 + 0.2, y0 + 0.31, 0.86, 0.875), {'cima': tecla, '*': liso('#d8d4cc')}, sombra=False)
    # o relógio redondo em pé
    cx = x1 - 0.2
    caixa((cx - 0.06, cx + 0.06, y0 + 0.05, y0 + 0.13, 0.8, 0.95), liso('#5a3420'), sombra=False)
    disco_de_pe(cx, y0 + 0.14, 1.08, 0.19, liso('#6a3a1e'))
    disco_de_pe(cx, y0 + 0.142, 1.08, 0.15, liso('#efe8d6'))
    o = c.novo_obj(3, contorno=False)
    c.face_plana([(cx - 0.008, y0 + 0.145, 1.08), (cx + 0.008, y0 + 0.145, 1.08), (cx + 0.008, y0 + 0.145, 1.2), (cx - 0.008, y0 + 0.145, 1.2)], (0, 1, 0), liso('#2a2020'), M, o)
    c.face_plana([(cx, y0 + 0.145, 1.072), (cx + 0.09, y0 + 0.145, 1.072), (cx + 0.09, y0 + 0.145, 1.088), (cx, y0 + 0.145, 1.088)], (0, 1, 0), liso('#2a2020'), M, o)
    # o banquinho
    caixa((x0 + 0.15, x0 + 0.5, y1 + 0.05, y1 + 0.35, 0.36, 0.44), {'cima': madeira(MOV_CLA), '*': madeira(MOV)}, sombra=False)
    for (a, b) in ((x0 + 0.17, y1 + 0.07), (x0 + 0.42, y1 + 0.07), (x0 + 0.17, y1 + 0.27), (x0 + 0.42, y1 + 0.27)):
        caixa((a, a + 0.06, b, b + 0.06, 0, 0.36), madeira(MOV_ESC, veio=False), sombra=False)
    pegadas.append((x0 + 0.15, x0 + 0.5, y1 + 0.05, y1 + 0.35))



# ---------- os móveis no desenho da referência ----------
MOV, MOV_ESC, MOV_CLA = '#8e5631', '#7a4628', '#a2663a'


def cadeira(x, y, costas, s=0.44):
    """A cadeira da referência: o assento escuro, os pés retos, o encosto com a travessa de cima larga e dois sarrafos."""
    hs = 0.47
    caixa((x, x + s, y, y + s, hs - 0.06, hs), {'cima': madeira(MOV_CLA), '*': madeira(MOV)}, sombra=False)
    for (a, b) in ((x + 0.02, y + 0.02), (x + s - 0.08, y + 0.02), (x + 0.02, y + s - 0.08), (x + s - 0.08, y + s - 0.08)):
        caixa((a, a + 0.06, b, b + 0.06, 0, hs - 0.06), madeira(MOV_ESC, eixo=1, veio=False), sombra=False)
    if costas in ('-y', '+y'):
        yy = y + 0.02 if costas == '-y' else y + s - 0.08
        for a in (x + 0.02, x + s - 0.08):
            caixa((a, a + 0.06, yy, yy + 0.06, hs, 1.0), madeira(MOV_ESC, eixo=1, veio=False), sombra=False)
        caixa((x + 0.02, x + s - 0.02, yy, yy + 0.06, 0.8, 0.97), madeira(MOV_CLA), sombra=False)
        for a in (x + 0.14, x + s - 0.19):
            caixa((a, a + 0.05, yy + 0.01, yy + 0.05, hs, 0.8), madeira(MOV), sombra=False)
    else:
        xx = x + 0.02 if costas == '-x' else x + s - 0.08
        for b in (y + 0.02, y + s - 0.08):
            caixa((xx, xx + 0.06, b, b + 0.06, hs, 1.0), madeira(MOV_ESC, eixo=1, veio=False), sombra=False)
        caixa((xx, xx + 0.06, y + 0.02, y + s - 0.02, 0.8, 0.97), madeira(MOV_CLA, eixo=1), sombra=False)
        for b in (y + 0.14, y + s - 0.19):
            caixa((xx + 0.01, xx + 0.05, b, b + 0.05, hs, 0.8), madeira(MOV), sombra=False)
    pegadas.append((x, x + s, y, y + s))


def mesa(x, y, w, d, h=0.78, tampo=0.09, perna=0.1, tabua=0.21):
    eixo = 0 if w >= d else 1
    caixa((x, x + w, y, y + d, h - tampo, h), {'cima': tabuas(['#a8693c', '#b0703f', '#a26438'], tabua, 0.8, '#5e3418', eixo=eixo),
                                              '*': madeira(MOV, eixo=eixo)}, sombra=False)
    caixa((x + 0.06, x + w - 0.06, y + 0.06, y + d - 0.06, h - tampo - 0.11, h - tampo), madeira(MOV_ESC, eixo=eixo), sombra=False)
    for (a, b) in ((x + 0.04, y + 0.04), (x + w - 0.04 - perna, y + 0.04), (x + 0.04, y + d - 0.04 - perna), (x + w - 0.04 - perna, y + d - 0.04 - perna)):
        caixa((a, a + perna, b, b + perna, 0, h - tampo), madeira(MOV, eixo=1), sombra=False)
    pegadas.append((x, x + w, y, y + d))


def estante_parede_tras(x0, x1, fundo=0.42, h=1.75, prat=(0.05, 0.45, 0.85, 1.25), seed=1):
    """A estante de livros encostada na parede de trás (y = 0), com o tampo e as prateleiras cheias."""
    lado, topo = madeira(MOV, eixo=1), madeira(MOV_CLA)
    caixa((x0, x0 + 0.06, 0, fundo, 0, h), {'*': lado, 'cima': topo})
    caixa((x1 - 0.06, x1, 0, fundo, 0, h), {'*': lado, 'cima': topo})
    caixa((x0, x1, 0, 0.03, 0, h), liso('#4e2a16'))
    caixa((x0 - 0.02, x1 + 0.02, 0, fundo + 0.02, h - 0.05, h), {'cima': topo, '*': madeira(MOV)})
    for i, z in enumerate(prat):
        caixa((x0 + 0.06, x1 - 0.06, 0, fundo, z, z + 0.04), {'cima': topo, '*': madeira(MOV)})
        livros(x0 + 0.06, x1 - 0.06, 0, z + 0.04, fundo, seed + i, alto=0.32)
    # em cima: dois potes e uma garrafa
    for (xx, r, hh, cor) in ((x0 + 0.15, 0.06, 0.12, '#8a5a34'), (x0 + 0.32, 0.05, 0.09, '#a06a40')):
        o = c.novo_obj(3)
        c.cilindro(xx, fundo / 2, r, h, h + hh, liso(cor), M, o, lados=12, tampa_mat=liso('#5a3420'))
    o = c.novo_obj(3)
    c.cilindro(x0 + 0.46, fundo / 2, 0.035, h, h + 0.22, liso('#6e4028'), M, o, lados=10)


def livros(x0, x1, y, z, fundo, seed, alto=0.3):
    x = x0 + 0.03
    i = 0
    cores = ['#7a3a2e', '#5a3a26', '#6e4a2e', '#3e4a52', '#8a5a34', '#5e3a3a']
    while x < x1 - 0.06:
        r = ruido(i, seed)
        if r < 0.38:
            n = 2 + int(ruido(i, seed + 1) * 3)
            for k in range(n):
                if x > x1 - 0.06:
                    break
                cor = cores[int(ruido(i, k, seed) * len(cores))]
                hh = alto * (0.72 + 0.22 * ruido(k, i, seed + 2))
                ww = 0.045 + 0.02 * ruido(k, i, seed + 3)
                caixa((x, x + ww, y + 0.05, y + fundo - 0.05, z, z + hh), {'*': liso(cor), 'cima': liso(cor)}, sombra=False)
                x += ww + 0.003
        elif r < 0.66:
            # a pilha de livros deitados
            for k in range(3):
                cor = cores[int(ruido(i, k, seed + 7) * len(cores))]
                caixa((x, x + 0.2, y + 0.06, y + fundo - 0.06, z + k * 0.045, z + (k + 1) * 0.045), {'*': liso(cor), 'cima': liso(cor)}, sombra=False)
            x += 0.21
        elif r < 0.84:
            # a pilha de tigelas
            for k in range(3):
                o = c.novo_obj(3)
                c.cilindro(x + 0.1, y + fundo / 2, 0.08, z + k * 0.04, z + k * 0.04 + 0.04, liso(['#6a7a84', '#5a6a74'][k % 2]), M, o, lados=14, r1=0.1, tampa_mat=liso('#3a4248'))
            x += 0.21
        else:
            # o pote de barro
            o = c.novo_obj(3)
            c.cilindro(x + 0.08, y + fundo / 2, 0.075, z, z + 0.17, liso('#8a5230'), M, o, lados=12, tampa_mat=liso('#4a2a18'))
            x += 0.17
        x += 0.025
        i += 1


def lareira(m, largura=1.62):
    """
    A lareira da referência: a laje de pedra clara na frente, a base alta de pedra com a boca (o fogo e a lenha) e a
    verga clara, o consolo, o capelo que afina em degraus e a chaminé estreita até a viga.
    """
    P = pedras(PEDRA, PEDRA_J, alt=0.2, comp=0.36)
    TOPO = liso('#bdbcb5')
    PC = pedras(['#b4b3ad', '#aaa9a3', '#bcbbb5'], PEDRA_J, alt=0.12, comp=0.34)
    meia = largura / 2
    fundo = 0.72
    caixa((m - meia - 0.08, m + meia + 0.08, 0, fundo + 0.24, 0, 0.12), {'*': PC, 'cima': pedras(['#b4b3ad', '#a8a7a1', '#bcbbb5'], PEDRA_J, alt=0.2, comp=0.4)})
    caixa((m - meia, m + meia, 0, fundo, 0.12, 1.3), {'*': P, 'cima': TOPO})
    yb = fundo + 0.002
    o = c.novo_obj(3)
    bw, bt = 0.42, 0.88
    c.face_plana([(m - bw, yb, 0.12), (m + bw, yb, 0.12), (m + bw, yb, bt - 0.08), (m + bw - 0.08, yb, bt), (m - bw + 0.08, yb, bt), (m - bw, yb, bt - 0.08)],
                 (0, 1, 0), liso('#22140f'), M, o)
    caixa((m - bw - 0.1, m + bw + 0.1, fundo - 0.01, fundo + 0.05, bt, bt + 0.16), {'*': liso('#b8b7b0')})
    fogo = c.novo_obj(3, contorno=False)
    luzes.add(fogo)
    yf = yb + 0.004
    for (a, w_, hh, cor) in ((-0.3, 0.22, 0.32, '#d0582a'), (-0.14, 0.26, 0.46, '#ec8a2c'), (0.06, 0.24, 0.36, '#d0582a'),
                             (-0.08, 0.18, 0.33, '#f6bc3e'), (-0.03, 0.09, 0.2, '#fff1a6')):
        c.face_plana([(m + a, yf, 0.22), (m + a + w_, yf, 0.22), (m + a + w_ * 0.55, yf, 0.22 + hh)], (0, 1, 0), liso(cor), M, fogo)
    for k in range(3):
        caixa((m - 0.32 + k * 0.21, m - 0.15 + k * 0.21, fundo - 0.08, fundo + 0.14, 0.12, 0.22), {'*': liso('#5e3820'), 'cima': liso('#a06a40')}, sombra=False)
    caixa((m - meia - 0.06, m + meia + 0.06, 0, fundo + 0.07, 1.3, 1.42), {'*': liso('#b4b3ac'), 'cima': TOPO})
    degraus = ((meia - 0.1, fundo - 0.08, 1.42, 1.68), (meia - 0.26, fundo - 0.18, 1.68, 1.92), (meia - 0.42, fundo - 0.26, 1.92, 2.12))
    for (mm, ff, z0, z1) in degraus:
        caixa((m - mm, m + mm, 0, ff, z0, z1), {'*': P, 'cima': TOPO})
    caixa((m - 0.3, m + 0.3, 0, 0.44, 2.12, ALTO + 0.38), {'*': P, 'cima': TOPO})
    pegadas.append((m - meia - 0.08, m + meia + 0.08, 0, fundo + 0.24))


def sofa(x, y0, y1):
    """O sofá de couro de dois lugares encostado na parede da esquerda (x = 0), virado para +x."""
    C, Cc = liso(COURO), liso(COURO_C)
    prof = 0.82
    caixa((x + 0.03, x + prof, y0 + 0.03, y1 - 0.03, 0.0, 0.08), liso('#4a2a18'))
    caixa((x, x + prof, y0, y1, 0.08, 0.4), {'*': C, 'cima': Cc}, ch=0.05)
    caixa((x, x + 0.26, y0 + 0.02, y1 - 0.02, 0.36, 0.86), {'*': C, 'cima': Cc}, ch=0.09)
    caixa((x, x + prof, y0, y0 + 0.22, 0.36, 0.64), {'*': C, 'cima': Cc}, ch=0.1)
    caixa((x, x + prof, y1 - 0.22, y1, 0.36, 0.64), {'*': C, 'cima': Cc}, ch=0.1)
    mm = (y0 + y1) / 2
    caixa((x + 0.24, x + prof - 0.02, y0 + 0.22, mm - 0.01, 0.38, 0.52), {'*': C, 'cima': Cc}, sombra=False, ch=0.05)
    caixa((x + 0.24, x + prof - 0.02, mm + 0.01, y1 - 0.22, 0.38, 0.52), {'*': C, 'cima': Cc}, sombra=False, ch=0.05)
    caixa((x + 0.06, x + 0.26, y0 + 0.22, mm - 0.01, 0.5, 0.82), {'*': C, 'cima': Cc}, sombra=False, ch=0.06)
    caixa((x + 0.06, x + 0.26, mm + 0.01, y1 - 0.22, 0.5, 0.82), {'*': C, 'cima': Cc}, sombra=False, ch=0.06)
    pegadas.append((x, x + prof, y0, y1))


def porta(y0, y1, alto=2.05):
    """A porta na parede da esquerda (x = 0): o batente, as tábuas, a janelinha de 4 vidros em cima e a maçaneta."""
    caixa((0, 0.07, y0 - 0.09, y1 + 0.09, 0, alto + 0.1), madeira('#8a5232', eixo=1), tipo=2)
    caixa((0, 0.08, y0 - 0.12, y1 + 0.12, alto + 0.02, alto + 0.14), madeira('#9a5e36', eixo=1), tipo=2)
    caixa((0, 0.05, y0, y1, 0, alto), {'dir': tabuas(['#7e4a2c', '#86502f', '#7a462a'], 0.16, 9, '#4e2a16', eixo=1, ponta=False), '*': liso('#6e3e22')}, tipo=2)
    caixa((0, 0.07, y0 + 0.08, y1 - 0.08, 1.2, 1.9), madeira('#6e3e22', eixo=1), tipo=2)
    vidro = emissivo(lambda L, n, P: np.where(((L[:, 2] + L[:, 1] * 0.9) % 0.5 < 0.06)[:, None], hx('#eef8fc'), hx('#a8d6ea')))
    ym = (y0 + y1) / 2
    for (a0, a1, b0, b1) in ((y0 + 0.12, ym - 0.025, 1.57, 1.86), (ym + 0.025, y1 - 0.12, 1.57, 1.86),
                             (y0 + 0.12, ym - 0.025, 1.24, 1.53), (ym + 0.025, y1 - 0.12, 1.24, 1.53)):
        caixa((0, 0.072, a0, a1, b0, b1), {'dir': vidro, '*': liso('#6e3e22')}, tipo=2)
    caixa((0.05, 0.12, y0 + 0.08, y0 + 0.15, 0.92, 1.0), liso('#3a3a3e'), tipo=2)


def barril_cesto(x, y, r=0.3, h=0.45):
    """O barril baixo da frente: o corpo de aduelas, a tampa de madeira clara e as duas cintas escuras."""
    o = c.novo_obj(3)
    adu = emissivo(lambda L, n, P: np.where(((np.arctan2(P[:, 1] - y, P[:, 0] - x) / (2 * math.pi) * 14) % 1 < 0.12)[:, None], hx('#5a3018'), hx('#8a5230')))
    c.cilindro(x, y, r, 0, h, adu, M, o, lados=18, tampa_mat=tabuas(['#c08a52', '#b47e48'], 0.08, 9, '#6a3a1e', ponta=False))
    for z in (0.05, h - 0.11):
        o2 = c.novo_obj(3)
        c.cilindro(x, y, r + 0.012, z, z + 0.07, liso('#3e3e44'), M, o2, lados=18, tampa=False)
    pegadas.append((x - r, x + r, y - r, y + r))


def pote_barro(x, y, z, r=0.09, h=0.16):
    o = c.novo_obj(3)
    c.cilindro(x, y, r, z, z + h, liso('#8a5230'), M, o, lados=14, tampa_mat=liso('#5a3018'))
    o = c.novo_obj(3)
    c.cilindro(x, y, r + 0.01, z + h * 0.35, z + h * 0.5, liso('#6a3a1e'), M, o, lados=14, tampa=False)


def pinheirinho(x, y, z):
    o = c.novo_obj(3)
    c.cilindro(x, y, 0.08, z, z + 0.11, liso('#9a5434'), M, o, lados=12, tampa_mat=liso('#4a3020'))
    for k, (r, a) in enumerate(((0.15, 0.09), (0.12, 0.2), (0.085, 0.31), (0.05, 0.4))):
        o = c.novo_obj(3)
        c.cilindro(x, y, r, z + a, z + a + 0.15, liso(['#2f6440', '#367048', '#3e7a50', '#468458'][k]), M, o, lados=14, r1=0.012)


def vaso(x, y, z):
    o = c.novo_obj(3)
    c.cilindro(x, y, 0.06, z, z + 0.09, liso('#a85a36'), M, o, lados=12, tampa_mat=liso('#4a3020'))
    for (dx, dy, dz, r) in ((0, 0, 0.13, 0.06), (0.04, 0.02, 0.11, 0.045), (-0.035, 0.03, 0.115, 0.045), (0.01, -0.035, 0.12, 0.045)):
        o = c.novo_obj(3)
        c.elipsoide(np.array([x + dx, y + dy, z + dz]), np.array([r, r, r * 0.9]), liso('#4e8a4e'), o)


def piano(x0, x1, fundo=0.62):
    """A escrivaninha com o teclado, encostada na parede de trás (y = 0), e o caixote embaixo."""
    h = 0.8
    caixa((x0, x1, 0, fundo, h - 0.06, h), {'cima': madeira(MOV_CLA), '*': madeira(MOV)}, sombra=False)
    for (a, b) in ((x0 + 0.03, 0.03), (x1 - 0.1, 0.03), (x0 + 0.03, fundo - 0.1), (x1 - 0.1, fundo - 0.1)):
        caixa((a, a + 0.07, b, b + 0.07, 0, h - 0.06), madeira(MOV_ESC, eixo=1, veio=False), sombra=False)
    caixa((x0 + 0.05, x1 - 0.05, 0.05, fundo - 0.05, 0.1, 0.14), madeira(MOV_ESC), sombra=False)
    # o teclado: o corpo escuro, a fileira de botões e as teclas
    caixa((x0 + 0.04, x1 - 0.04, 0.04, fundo - 0.06, h, h + 0.08), {'*': liso('#2e2a2e'), 'cima': liso('#3a353a')}, sombra=False)
    caixa((x0 + 0.04, x1 - 0.04, 0.04, 0.16, h + 0.08, h + 0.2), {'*': liso('#2e2a2e'), 'cima': liso('#46404a')}, sombra=False)
    tecla = emissivo(lambda L, n, P: np.where((((L[:, 0] / 0.1) % 1 > 0.45) & (L[:, 1] < 0.32))[:, None], hx('#2a2628'), hx('#f2eee6')))
    caixa((x0 + 0.08, x1 - 0.08, 0.18, fundo - 0.09, h + 0.08, h + 0.095), {'cima': tecla, '*': liso('#cfcac2')}, sombra=False)
    # o caixote embaixo
    caixa((x0 + 0.12, x0 + 0.42, 0.08, 0.4, 0.14, 0.36), {'*': madeira('#9a6238'), 'cima': madeira('#a8703f')}, sombra=False)
    pegadas.append((x0, x1, 0, fundo))


def relogio_parede(xc, z, r=0.2):
    """O relógio redondo na parede de trás (y = 0)."""
    disco_de_pe(xc, 0.04, z, r, liso('#4a2a18'), lados=24)
    disco_de_pe(xc, 0.045, z, r - 0.06, liso('#f0ead8'), lados=24)
    o = c.novo_obj(3, contorno=False)
    c.face_plana([(xc - 0.015, 0.05, z), (xc + 0.015, 0.05, z), (xc + 0.015, 0.05, z + 0.14), (xc - 0.015, 0.05, z + 0.14)], (0, 1, 0), liso('#2a2020'), M, o)
    c.face_plana([(xc, 0.05, z - 0.015), (xc + 0.1, 0.05, z - 0.015), (xc + 0.1, 0.05, z + 0.015), (xc, 0.05, z + 0.015)], (0, 1, 0), liso('#2a2020'), M, o)


def quadro_esq(y0, y1, z0, z1):
    """O quadro na parede da esquerda (x = 0): a moldura, o céu, a montanha e o campo."""
    caixa((0, 0.05, y0, y1, z0, z1), madeira('#6e3e22', eixo=1), tipo=2)
    paisagem = emissivo(lambda L, n, P: np.where((L[:, 2] < z0 + 0.12 + 0.1 * np.abs(np.sin((L[:, 1] - y0) * 6)))[:, None],
                                                 np.where((L[:, 2] < z0 + 0.14)[:, None], hx('#6a6a3e'), hx('#7e8a8a')), hx('#d8d0b8')))
    caixa((0, 0.055, y0 + 0.05, y1 - 0.05, z0 + 0.05, z1 - 0.05), {'dir': paisagem, '*': liso('#6e3e22')}, tipo=2)


def placa(eixo, a0, a1, z0, z1):
    """A plaquinha de madeira na parede."""
    if eixo == 'x':
        caixa((0, 0.04, a0, a1, z0, z1), madeira('#7a4424', eixo=1), tipo=2)
        caixa((0, 0.045, a0 + 0.03, a1 - 0.03, z0 + 0.03, z1 - 0.03), liso('#a06a3e'), tipo=2)
    else:
        caixa((a0, a1, 0, 0.04, z0, z1), madeira('#7a4424'), tipo=2)
        caixa((a0 + 0.03, a1 - 0.03, 0, 0.045, z0 + 0.03, z1 - 0.03), liso('#a06a3e'), tipo=2)


def estante_baixa(y0, y1, fundo=0.48, h=1.0):
    """A estante baixa encostada na parede da esquerda (x = 0), na ponta da frente: duas prateleiras com coisas."""
    lado, topo = madeira(MOV), madeira(MOV_CLA, eixo=1)
    caixa((0, fundo, y0, y0 + 0.06, 0, h), {'*': lado, 'cima': topo})
    caixa((0, fundo, y1 - 0.06, y1, 0, h), {'*': lado, 'cima': topo})
    caixa((0, 0.03, y0, y1, 0, h), liso('#4e2a16'))
    for z in (0.04, 0.44):
        caixa((0, fundo, y0 + 0.06, y1 - 0.06, z, z + 0.04), {'cima': topo, '*': madeira(MOV, eixo=1)})
    caixa((0, fundo + 0.02, y0 - 0.02, y1 + 0.02, h - 0.05, h), {'cima': topo, '*': madeira(MOV, eixo=1)})
    # nas prateleiras: os livros deitados, a cesta e os potes
    for k, cor in enumerate(('#5a3a26', '#6e4a2e', '#3e4a52')):
        caixa((0.06, fundo - 0.06, y0 + 0.12, y0 + 0.42, 0.08 + k * 0.05, 0.13 + k * 0.05), liso(cor), sombra=False)
    o = c.novo_obj(3)
    c.cilindro(fundo / 2, y1 - 0.25, 0.12, 0.08, 0.2, liso('#4e5a62'), M, o, lados=14, r1=0.14, tampa_mat=liso('#2e363c'))
    caixa((0.06, fundo - 0.06, y0 + 0.14, y0 + 0.5, 0.48, 0.64), {'*': madeira('#8a5a34'), 'cima': madeira('#9a6a3e')}, sombra=False)
    o = c.novo_obj(3)
    c.cilindro(fundo / 2, y1 - 0.24, 0.1, 0.48, 0.56, liso('#6a6a6e'), M, o, lados=14, r1=0.12, tampa_mat=liso('#3a3a3e'))
    # em cima: o pote de barro e o pinheirinho
    pote_barro(fundo / 2, y0 + 0.3, h, r=0.11, h=0.2)
    pinheirinho(fundo / 2, y1 - 0.3, h)
    pegadas.append((0, fundo, y0, y1))


def mesinha(x, y, w=0.85, d=0.68):
    """A mesinha da frente do sofá, com a bolsa e a caixinha em cima."""
    mesa(x, y, w, d, h=0.6, tampo=0.07, perna=0.08, tabua=0.16)
    caixa((x + 0.14, x + 0.42, y + 0.16, y + 0.32, 0.6, 0.74), {'*': liso('#7a4a2c'), 'cima': liso('#8a5634')}, sombra=False, ch=0.03)
    caixa((x + 0.52, x + 0.68, y + 0.3, y + 0.46, 0.6, 0.67), {'*': liso('#5a4a40'), 'cima': liso('#6e5e52')}, sombra=False)


# ---------- as peças novas (pecas2.py) ----------
# ===================== peças 2: as peças pequenas com o desenho da referência =====================
# Para colar na cena: estas defs vão depois das defs antigas (as substituem) e antes da montagem.
# Na montagem, o trecho do vasinho de galhos (o cilindro em (0.66, 5.0), os três galhos e a pegada) vira só:
#     vasinho_galhos(0.66, 5.0)
# Usa o que a cena já tem: c, M, caixa, pegadas, hx, coords, ruido, emissivo, np, math.
# Tudo em pixel limpo: as riscas e as faixas têm a espessura de 1 px exato na tela (PZ na vertical, PH ao longo de x
# ou de y), e o veio vem em pedaços compridos (nunca um pixel solto).

PZ = 1 / 39.195          # 1 px da arte na vertical (m)
PH = 1 / 32.0            # 1 px da arte ao longo de x ou de y (m)
_QUENTE = np.array([16.0, 4.0, -10.0])
_LUZ = np.array([-0.3, 0.55, 1.0]) / np.linalg.norm([-0.3, 0.55, 1.0])


def _fac(n):
    """A luz que o acabamento põe na face (o topo 1, a face +y 0,84, a +x 0,66)."""
    n = np.asarray(n, float)
    n = n / np.linalg.norm(n)
    if n[2] > 0.6:
        return 1.0
    return 0.84 if n[1] >= n[0] else 0.66


def _cru(cor, n):
    """A cor que, depois da luz da face do acabamento, fica igual a `cor` (para o material que já traz a luz)."""
    f = _fac(n)
    return (cor - (1 - f) * _QUENTE) / f


def _tom(cor, k):
    """Clareia (k > 1) ou escurece (k < 1): a sombra puxa para o vermelho-roxo, a luz para o amarelo claro."""
    cor = np.asarray(cor, float)
    k = np.asarray(k, float)
    if k.ndim == 1 and cor.ndim == 2:
        k = k[:, None]
    esc = cor * k + (1 - k) * np.array([11.0, -1.0, 7.0])
    cla = cor + (k - 1) * (np.array([255.0, 238.0, 190.0]) - cor) * 0.9
    return np.where(k < 1, esc, cla)


def _luz_k(d):
    """A luz pela normal (d = normal · luz), em degraus como pixel art."""
    k = np.interp(d, [-1, -0.5, -0.25, 0.46, 0.52, 0.85, 1.0], [0.5, 0.56, 0.66, 0.84, 0.9, 1.0, 1.04])
    return np.round(k / 0.075) * 0.075


def _riscas(t, s, passo, esp, seed, comp=0.22, frac=0.55):
    """Riscas de 1 px (esp) ao longo de t, uma por faixa de `passo`, em pedaços compridos."""
    fila = np.floor(s / passo)
    o = (0.25 + 0.5 * ruido(fila, seed)) * passo
    g = s - fila * passo
    linha = (g >= o) & (g < o + esp)
    seg = np.floor(t / comp + ruido(fila, seed + 1))
    return linha & (ruido(fila, seg, seed + 2) < frac)


def mad2(cor, eixo=0, seed=0, passo=0.1, claro=1.1, escuro=0.9):
    """Madeira de pixel limpo: a cor e o veio em riscas de 1 px, claras e escuras, compridas."""
    c0 = hx(cor)

    def f(L, n, P):
        a, b = coords(L, n)
        t, s = (a, b) if eixo == 0 else (b, a)
        esp = PZ if (abs(n[2]) <= 0.5 and eixo == 0) else PH
        out = np.tile(c0, (len(L), 1))
        r1 = _riscas(t, s, passo, esp, seed)
        r2 = _riscas(t + 0.13, s + passo * 0.5, passo, esp, seed + 9, frac=0.4)
        out = np.where(r1[:, None], _tom(c0, claro), out)
        out = np.where((r2 & ~r1)[:, None], _tom(c0, escuro), out)
        return out
    return emissivo(f)


def tab2(cores, larg, junta='#4a2414', eixo=0, seed=0, comp=None, org=0.0, veio=True, luz_borda=1.1, sombra_borda=0.92):
    """
    Tábuas de pixel limpo: a junta escura de 1 px, a linha clara logo acima dela (a quina que pega luz) e a escura
    logo abaixo; as emendas das pontas (comp) desencontradas; o veio. org: onde começa a primeira tábua.
    """
    cs = np.stack([hx(x) for x in cores])
    jc = hx(junta)

    def f(L, n, P):
        a, b = coords(L, n)
        t, s = (a, b) if eixo == 0 else (b, a)
        vert = abs(n[2]) <= 0.5
        e = PZ if (vert and eixo == 0) else PH          # 1 px de través da tábua
        et = PZ if (vert and eixo == 1) else PH         # 1 px ao longo dela
        s = s - org
        fila = np.floor(s / larg)
        g = s - fila * larg
        if comp:
            off = ruido(fila, seed + 1) * comp
            col = np.floor((t + off) / comp)
            hp = (t + off) - col * comp
        else:
            col = np.zeros_like(t)
            hp = None
        k = (ruido(fila, col, seed + 2) * len(cs)).astype(int) % len(cs)
        out = cs[k]
        if veio:
            # uma risca de veio por tábua, um pouco mais escura, em pedaços bem compridos
            o = np.floor((0.45 + 0.2 * ruido(fila, seed + 4)) * larg / e) * e
            lin = (g >= o) & (g < o + e)
            seg = np.floor(t / 0.34 + ruido(fila, col, seed + 5))
            vv = lin & (ruido(fila, seg, seed + 7) < 0.6)
            out = np.where(vv[:, None], _tom(out, veio if isinstance(veio, float) else 0.93), out)
        out = np.where((g >= larg - e)[:, None], _tom(out, luz_borda), out)
        out = np.where(((g >= e) & (g < 2 * e))[:, None], _tom(out, sombra_borda), out)
        jun = g < e
        if hp is not None:
            jun |= hp < et
            out = np.where(((hp >= et) & (hp < 2 * et))[:, None], _tom(out, 1.08), out)
        return np.where(jun[:, None], jc, out)
    return emissivo(f)


def vol(cx, cy, cor, brilho=0.0, faixas=None, costuras=None):
    """
    O material das peças redondas (cilindro, cone): a luz pela normal de cada pixel (o ângulo em volta do eixo e a
    inclinação da face), em degraus. brilho: a risca de luz no lado aceso (o esmalte, o ferro). faixas: função
    (P, cor) -> cor para pintar faixas em volta. costuras: (n, cor) as linhas verticais das aduelas.
    """
    c0 = hx(cor) if isinstance(cor, str) else np.asarray(cor, float)

    def f(L, n, P):
        nn = np.asarray(n, float) / np.linalg.norm(n)
        th = np.arctan2(P[:, 1] - cy, P[:, 0] - cx)
        ch = math.sqrt(max(0.0, 1 - nn[2] ** 2))
        N = np.stack([ch * np.cos(th), ch * np.sin(th), np.full(len(P), nn[2])], 1)
        d = N @ _LUZ
        k = _luz_k(d)
        base = np.tile(c0, (len(P), 1))
        if faixas is not None:
            base = faixas(P, base)
        if costuras is not None:
            nc, cc, r = costuras
            sx = (P[:, 0] - P[:, 1]) * 32
            rr = np.hypot(P[:, 0] - cx, P[:, 1] - cy)
            ok = np.zeros(len(P), bool)
            angs = [2 * math.pi * (i + 0.5) / nc for i in range(nc)]
            vis = [a for a in angs if math.cos(a - math.radians(45)) > -0.05]
            xs = sorted([(math.cos(a) - math.sin(a), a) for a in vis])
            for j, (v, a) in enumerate(xs):
                # a costura que fica perto demais da vizinha na tela (perto da borda) some
                viz = [abs(v - w) for (w, _) in xs if w != v]
                if viz and min(viz) * r * 32 < 2.6:
                    continue
                sk = 32 * ((cx - cy) + rr * v)
                ok |= (sx >= sk - 0.5) & (sx < sk + 0.5) & (np.cos(th - a) > 0.2)
            base = np.where(ok[:, None], hx(cc), base)
        out = _vao(_tom(base, k), P)
        if brilho:
            sp = (np.cos(th - math.radians(112)) > 0.965) & (nn[2] < 0.6)
            out = np.where(sp[:, None], _tom(base, 1.0 + brilho), out)
        return _cru(out, n)
    return emissivo(f)


def _poligono_rodado(cx, cy, perfil, mat, oid, lados=22, tampa_mat=None):
    """Uma peça redonda pelo perfil [(z, r), ...] de baixo para cima (o pote, o barril, o vaso): troncos de cone."""
    for (za, ra), (zb, rb) in zip(perfil[:-1], perfil[1:]):
        c.cilindro(cx, cy, ra, za, zb, mat, M, oid, lados=lados, tampa=False, r1=rb)
    if tampa_mat is not None:
        z, r = perfil[-1]
        pts = [(cx + r * math.cos(2 * math.pi * i / lados), cy + r * math.sin(2 * math.pi * i / lados), z) for i in range(lados)]
        c.face_plana(pts, (0, 0, 1), tampa_mat, M, oid)


def _disco(cx, cy, z, r, mat, oid, lados=22):
    pts = [(cx + r * math.cos(2 * math.pi * i / lados), cy + r * math.sin(2 * math.pi * i / lados), z) for i in range(lados)]
    c.face_plana(pts, (0, 0, 1), mat, M, oid)


def _fita(pts2, cx, cy, mat, oid, w):
    """
    Uma fita fina de frente para a câmera (o galho, a alça): pts2 = [(s, z), ...] no plano vertical que passa por
    (cx, cy) de frente para a câmera; s anda para a direita na tela. Cada trecho é um quadrilátero.
    """
    k = 1 / math.sqrt(2)
    for (s0, z0), (s1, z1) in zip(pts2[:-1], pts2[1:]):
        ds, dz = s1 - s0, z1 - z0
        l = math.hypot(ds, dz) or 1e-6
        ps, pz = -dz / l * w / 2, ds / l * w / 2
        q = [(s0 + ps, z0 + pz), (s1 + ps, z1 + pz), (s1 - ps, z1 - pz), (s0 - ps, z0 - pz)]
        c.face_plana([(cx + s * k, cy - s * k, z) for (s, z) in q], (k, k, 0), mat, M, oid)


# ---------------------------------------------------------------- a cadeira ----------------------------------------------------------------
CAD_LADO, CAD_TOPO, CAD_ESC = '#743c22', '#c07c44', '#542a16'
_VAO = {'teto': None}


def _vao(out, P):
    """Dentro do vão da estante: o alto (logo embaixo da prateleira de cima) fica na sombra."""
    t = _VAO['teto']
    if t is None:
        return out
    return np.where((P[:, 2] > t - 0.07)[:, None], _tom(out, 0.8), out)


def _pau(cor, topo=None, quina=1.32, b=None):
    """A peça fina de madeira em cor chapada: a fileira de cima das faces em pé mais clara (a quina que pega luz)."""
    c0 = hx(cor)
    ct = hx(topo) if topo else _tom(c0, 1.3)

    def f(L, n, P):
        if n[2] > 0.5:
            return np.tile(ct, (len(P), 1))
        out = np.tile(c0, (len(P), 1))
        if b is not None and quina:
            out = np.where((P[:, 2] > b[5] - PZ)[:, None], _tom(c0, quina), out)
        return out
    return emissivo(f)


def _barra(b, cor, topo=None, oid=None, quina=1.32):
    o = c.novo_obj(3) if oid is None else oid
    c.caixa(b, _pau(cor, topo, quina, b), M, o)
    return o


def cadeira(x, y, costas, s=0.44):
    """
    A cadeira rústica da referência: os pés de trás sobem e viram os montantes do encosto, o encosto de três
    travessas (a de cima larga) com a quina clara, o assento de duas tábuas claras com a saia escura embaixo e as
    travessas baixas entre os pés. Peças finas em cor chapada (sem veio, que nelas vira pontilhado).
    """
    hs = 0.47

    def B(u0, u1, v0, v1, z0, z1):
        # local: u de través, v da costa (0) para a frente (s)
        if costas == '-y':
            return (x + u0, x + u1, y + v0, y + v1, z0, z1)
        if costas == '+y':
            return (x + u0, x + u1, y + s - v1, y + s - v0, z0, z1)
        if costas == '-x':
            return (x + v0, x + v1, y + u0, y + u1, z0, z1)
        return (x + s - v1, x + s - v0, y + u0, y + u1, z0, z1)
    eu = 0 if costas in ('-y', '+y') else 1      # o eixo de u no tampo
    p = 2 * PH                                  # os pés e montantes: 2 px de cada lado
    fr = 2 * PH                                 # o fundo das travessas: o tampo delas dá 2 px exatos na tela
    # o encosto (um objeto: os montantes e as travessas, sem contorno entre eles)
    o = c.novo_obj(3)
    for u0 in (0.015, s - 0.015 - p):
        _barra(B(u0, u0 + p, 0.015, 0.015 + p, 0, 1.03), CAD_LADO, CAD_TOPO, o, quina=False)
    zt = 1.0
    for (h_, gap) in ((5, 0), (3, 2), (3, 2)):
        z1 = zt - gap * PZ
        z0 = z1 - h_ * PZ
        _barra(B(0.015 + p, s - 0.015 - p, 0.015 + (p - fr) / 2, 0.015 + (p + fr) / 2, z0, z1), CAD_LADO, CAD_TOPO, o, quina=False)
        zt = z0
    # o assento: duas tábuas claras e a saia escura embaixo
    o = c.novo_obj(3)
    bs = B(0.0, s, 0.0, s, hs - 3 * PZ, hs)
    c.caixa(bs, {'cima': tab2(['#c88248', '#c07c44'], s / 2, '#5a2c16', eixo=eu, seed=25, org=(y if eu == 0 else x), veio=False),
                 '*': _pau(CAD_LADO, quina=False, b=bs)}, M, o)
    _barra(B(0.03, s - 0.03, 0.03, s - 0.03, hs - 6 * PZ, hs - 3 * PZ), CAD_ESC, oid=o, quina=False)
    # os pés da frente
    for u0 in (0.015, s - 0.015 - p):
        _barra(B(u0, u0 + p, s - 0.015 - p, s - 0.015, 0, hs - 3 * PZ), CAD_LADO, CAD_TOPO, quina=False)
    # a travessa baixa da frente
    _barra(B(0.015 + p, s - 0.015 - p, s - 0.015 - p / 2 - PH / 2, s - 0.015 - p / 2 + PH / 2, 0.12, 0.12 + 2 * PZ), CAD_LADO, quina=False)
    pegadas.append((x, x + s, y, y + s))


# ---------------------------------------------------------------- a mesa ----------------------------------------------------------------
MESA_TAB = ['#c8844a', '#c07c44', '#cd8b50', '#bb7840']


def _ponta_tabuas(cor, larg, org, junta='#4a2414'):
    """A ponta do tampo (a face em pé onde as tábuas terminam): as juntas descem retas, 1 px."""
    c0, jc = hx(cor), hx(junta)

    def f(L, n, P):
        a, b = coords(L, n)
        g = ((a - org) / larg) % 1 * larg
        out = np.tile(c0, (len(L), 1))
        out = np.where(((g >= larg - PH))[:, None], _tom(c0, 1.08), out)
        return np.where((g < PH)[:, None], jc, out)
    return emissivo(f)


def mesa(x, y, w, d, h=0.78, tampo=0.09, perna=0.1, tabua=0.21):
    """
    A mesa de tábuas grossas: o tampo de tábuas com as emendas desencontradas e a quina clara, as juntas descendo
    pela ponta, a saia escura recuada e os pés grossos com o veio comprido.
    """
    eixo = 0 if w >= d else 1
    org = y if eixo == 0 else x
    TOPO = tab2(MESA_TAB, tabua, '#4e2614', eixo=eixo, seed=31, comp=(0.78 if max(w, d) > 1.0 else None), org=org)
    lado_long = mad2('#94542e', eixo=0, seed=32, passo=0.045)
    ponta = _ponta_tabuas('#94542e', tabua, org)
    mats = {'cima': TOPO, 'frente': lado_long if eixo == 0 else ponta, 'dir': ponta if eixo == 0 else lado_long, '*': lado_long}
    caixa((x, x + w, y, y + d, h - tampo, h), mats, sombra=False)
    # a saia (recuada) e os pés
    caixa((x + 0.06, x + w - 0.06, y + 0.06, y + d - 0.06, h - tampo - 0.11, h - tampo), mad2('#6a3820', eixo=0, seed=33, passo=0.05), sombra=False)
    PE = {'cima': mad2('#a8643a'), '*': mad2('#86492a', eixo=1, seed=34, passo=0.05)}
    for (a, b) in ((x + 0.04, y + 0.04), (x + w - 0.04 - perna, y + 0.04), (x + 0.04, y + d - 0.04 - perna), (x + w - 0.04 - perna, y + d - 0.04 - perna)):
        caixa((a, a + perna, b, b + perna, 0, h - tampo), PE, sombra=False)
    pegadas.append((x, x + w, y, y + d))


# ---------------------------------------------------------------- a mesinha ----------------------------------------------------------------
def mesinha(x, y, w=0.85, d=0.68):
    """A mesinha da frente do sofá (com o quadro de travessas embaixo), a bolsa de couro com a alça e a caneca."""
    mesa(x, y, w, d, h=0.6, tampo=0.07, perna=0.08, tabua=0.17)
    TR = {'cima': mad2('#a8643a', eixo=0), '*': mad2('#7a4226', eixo=0, seed=35, passo=0.04)}
    TRy = {'cima': mad2('#a8643a', eixo=1), '*': mad2('#7a4226', eixo=0, seed=35, passo=0.04)}
    o = c.novo_obj(3)
    for b in (y + 0.06, y + d - 0.09):
        c.caixa((x + 0.12, x + w - 0.12, b, b + 0.03, 0.1, 0.15), TR, M, o)
    for a in (x + 0.06, x + w - 0.09):
        c.caixa((a, a + 0.03, y + 0.12, y + d - 0.12, 0.1, 0.15), TRy, M, o)
    bolsa(x + 0.1, x + 0.46, y + 0.14, y + 0.33, 0.6)
    caneca(x + 0.63, y + 0.42, 0.6)


def bolsa(bx0, bx1, by0, by1, bz, alto=0.16):
    """A bolsa de couro: o corpo de quinas redondas, as duas correias claras com a fivela, a boca e a alça em arco."""
    COURO, COURO_T, CORREIA = hx('#6a3622'), hx('#94543a'), hx('#a8683e')
    xs = (bx0 + (bx1 - bx0) * 0.24, bx0 + (bx1 - bx0) * 0.76)

    def couro(L, n, P):
        if n[2] > 0.5:
            out = np.tile(COURO_T, (len(P), 1))
            corr = np.zeros(len(P), bool)
            for xc in xs:
                corr |= (P[:, 0] >= xc - PH) & (P[:, 0] < xc + PH)
            return np.where(corr[:, None], _tom(CORREIA, 1.1), out)
        out = np.tile(COURO, (len(P), 1))
        z = P[:, 2] - bz
        if n[1] > 0.5:
            corr = np.zeros(len(P), bool)
            fiv = np.zeros(len(P), bool)
            for xc in xs:
                cc = (P[:, 0] >= xc - PH) & (P[:, 0] < xc + PH)
                corr |= cc
                fiv |= cc & (z > alto * 0.55) & (z <= alto * 0.55 + 2 * PZ)
            out = np.where(corr[:, None], CORREIA, out)
            out = np.where(fiv[:, None], hx('#e6c060'), out)
            # a costura embaixo da boca
            out = np.where(((z > alto - 2 * PZ) & (z <= alto - PZ) & ~corr)[:, None], _tom(COURO, 1.25), out)
        elif n[0] > 0.5:
            out = np.where(((z > alto - 2 * PZ) & (z <= alto - PZ))[:, None], _tom(COURO, 1.25), out)
        return out
    o = c.novo_obj(3)
    c.caixa((bx0, bx1, by0, by1, bz, bz + alto), emissivo(couro), M, o, ch=0.035)
    ym = (by0 + by1) / 2
    c.caixa((bx0 + 0.04, bx1 - 0.04, ym - PH, ym + PH, bz + alto, bz + alto + PZ * 1.5), _pau('#3e2014', '#5a3020', quina=False), M, o)
    # a alça em arco, de pé no plano do meio da bolsa
    o = c.novo_obj(3)
    xm = (bx0 + bx1) / 2
    arco = [(xm - 0.08 + 0.16 * i / 10, bz + alto + 0.02 + 0.075 * math.sin(math.pi * i / 10)) for i in range(11)]
    for (u0, z0), (u1, z1) in zip(arco[:-1], arco[1:]):
        du, dz = u1 - u0, z1 - z0
        l = math.hypot(du, dz)
        pu, pz = -dz / l * 0.02, du / l * 0.02
        q = [(u0 + pu, z0 + pz), (u1 + pu, z1 + pz), (u1 - pu, z1 - pz), (u0 - pu, z0 - pz)]
        c.face_plana([(u, ym, zz) for (u, zz) in q], (0, 1, 0), liso('#5a2e1c'), M, o)


def caneca(mx, my, z, mr=0.064, mh=0.13):
    """A caneca de esmalte creme: a borda azul, o friso, a risca de brilho, o café dentro e a asa do lado."""
    def esmalte(P, base):
        zz = P[:, 2] - z
        base = np.where((zz > mh - PZ)[:, None], hx('#34507a'), base)
        return np.where(((zz > 0.035) & (zz <= 0.035 + PZ))[:, None], hx('#5a78a4'), base)
    o = c.novo_obj(3)
    c.cilindro(mx, my, mr, z, z + mh, vol(mx, my, '#ece2cc', brilho=0.3, faixas=esmalte), M, o, lados=20, tampa=False)

    def cafe(L, n, P):
        r = np.hypot(P[:, 0] - mx, P[:, 1] - my)
        out = np.where((r > mr - 0.016)[:, None], hx('#f4ecda'), hx('#3a2016'))
        return np.where(((r > mr - 0.036) & (r <= mr - 0.016) & (P[:, 1] - my < 0))[:, None], hx('#6a4430'), out)
    _disco(mx, my, z + mh, mr, emissivo(cafe), o, lados=20)
    o = c.novo_obj(3)
    _fita([(0.05, z + 0.105), (0.1, z + 0.1), (0.112, z + 0.065), (0.1, z + 0.03), (0.05, z + 0.026)], mx, my, liso('#d8ccb4'), o, 0.03)


# ---------------------------------------------------------------- os livros e as coisas da estante ----------------------------------------------------------------
LIVRO_CORES = ['#84362a', '#3e5266', '#5a6230', '#9e6a34', '#5a3446', '#2e4c3c', '#6e4228', '#94744c', '#5e2422', '#46585e']
PAPEL = '#e6d6b2'
PAPEL_VAO = '#bba57e'      # o papel do topo dos livros em pé (fica na sombra da prateleira)


def _lombada(cor, x0, z0, alto, larg, seed, ang=0.0, frente='y', ymax=None, hmin=None):
    """
    O livro em pé: a lombada com as faixas (claras ou escuras) ou o rótulo creme, a fileira clara do lado da luz;
    no topo, o papel creme com a capa na frente; do lado, a capa mais escura. Faixa só em livro de 2 px ou mais.
    """
    c0 = hx(cor)
    up = (-math.sin(ang), math.cos(ang))
    ac = (math.cos(ang), math.sin(ang))
    estilo = int(ruido(seed, 3.3) * 5)
    if larg < 0.06 and estilo == 0:
        estilo = 1
    if larg < 0.085 and estilo == 2:
        estilo = 3

    def f(L, n, P):
        dx, dz = P[:, 0] - x0, P[:, 2] - z0
        v = dx * up[0] + dz * up[1]
        u = dx * ac[0] + dz * ac[1]
        out = np.tile(c0, (len(P), 1))
        nn = np.asarray(n, float)
        if (frente == 'y' and nn[1] > 0.5) or (frente == 'x' and nn[0] > 0.5):
            if frente == 'x':
                v = P[:, 2] - z0
            band = lambda vv, k=1: (v >= vv) & (v < vv + k * PZ)
            if estilo == 0:
                m = band(alto * 0.14) | band(alto * 0.8)
                out = np.where(m[:, None], _tom(c0, 1.45), out)
            elif estilo == 1:
                out = np.where((band(alto * 0.72, 2) | band(alto * 0.14))[:, None], _tom(c0, 0.6), out)
            elif estilo == 2:
                out = np.where(band(alto * 0.5, 2)[:, None], hx('#c8b088'), out)
            if frente == 'y':
                out = np.where((u < PH)[:, None], _tom(out, 1.14), out)
        elif nn[2] > 0.5:
            # o topo: a capa e o papel juntos, na cor do livro mais clara (o creme puro soltava pixel)
            out = _tom(c0, 1.3)
        else:
            # a capa à mostra: mais escura, com o friso claro 1 px para dentro da borda
            out = _tom(out, 0.85)
            if ymax is not None:
                hc = P[:, 1] if frente == 'y' else P[:, 0]
                vv = v if frente == 'y' else P[:, 2] - z0
                lo = hmin if hmin is not None else -1e9
                dentro = (hc < ymax - PH) & (hc >= lo + PH) & (vv >= PZ) & (vv < alto - PZ)
                fr = (hc >= ymax - 2 * PH) | (hc < lo + 2 * PH) | (vv >= alto - 2 * PZ) | (vv < 2 * PZ)
                out = np.where((fr & dentro)[:, None], _tom(c0, 1.08), out)
        return _vao(out, P)
    return emissivo(f)


def _livro_inclinado(xl, z, w, alto, y0, y1, ang, cor, seed):
    """O livro encostado no vizinho (de pé, inclinado ang para a esquerda), apoiado na quina de baixo."""
    o = c.novo_obj(3)
    up = np.array([-math.sin(ang), math.cos(ang)])
    ac = np.array([math.cos(ang), math.sin(ang)])
    p0 = np.array([xl, z])
    p1 = p0 + ac * w
    p2 = p1 + up * alto
    p3 = p0 + up * alto
    mat = _lombada(cor, xl, z, alto, w, seed, ang=ang, ymax=y1, hmin=y0)
    c.face_plana([(p0[0], y1, p0[1]), (p1[0], y1, p1[1]), (p2[0], y1, p2[1]), (p3[0], y1, p3[1])], (0, 1, 0), mat, M, o)
    c.face_plana([(p3[0], y0, p3[1]), (p2[0], y0, p2[1]), (p2[0], y1, p2[1]), (p3[0], y1, p3[1])], (up[0], 0, up[1]), mat, M, o)
    c.face_plana([(p1[0], y0, p1[1]), (p2[0], y0, p2[1]), (p2[0], y1, p2[1]), (p1[0], y1, p1[1])], (ac[0], 0, ac[1]), mat, M, o)
    return p1[0]


def _livro_deitado(x0, x1, y0, y1, z0, z1, cor, frente='y'):
    """
    O livro deitado na pilha (3 px de grosso): na lombada, a cor com a fileira do meio clara; na ponta, o papel creme
    entre a capa de baixo e a de cima (1 px cada); em cima, a capa.
    """
    c0 = hx(cor)

    def f(L, n, P):
        out = np.tile(c0, (len(P), 1))
        nn = np.asarray(n, float)
        zz = P[:, 2] - z0
        meio = (zz >= PZ) & (zz < 2 * PZ)
        papel = (frente == 'y' and nn[0] > 0.5) or (frente == 'x' and nn[1] > 0.5)
        if papel:
            out = np.where(meio[:, None], hx(PAPEL), _tom(c0, 0.9))
        elif abs(nn[2]) < 0.5:
            out = np.where(meio[:, None], _tom(c0, 1.22), out)
        return _vao(out, P)
    caixa((x0, x1, y0, y1, z0, z1), emissivo(f), sombra=False)


def _tigelas(cx, cy, z, n=3, r=0.095, cor='#5e7686'):
    """A pilha de tigelas de barro esmaltado (azul-cinza): um bloco que abre para cima, a borda clara de cada uma."""
    o = c.novo_obj(3)
    hb = 2 * PZ
    zt = z + n * hb

    def bordas(P, base):
        zz = P[:, 2] - z
        topo = np.zeros(len(P), bool)
        for k in range(n):
            topo |= (zz >= (k + 1) * hb - PZ) & (zz < (k + 1) * hb)
        return np.where(topo[:, None], _tom(base, 1.32), _tom(base, 0.92))
    _poligono_rodado(cx, cy, [(z, r * 0.62), (z + hb, r * 0.8), (zt, r)], vol(cx, cy, cor, brilho=0.25, faixas=bordas), o, lados=20)

    def dentro(L, n_, P):
        rr = np.hypot(P[:, 0] - cx, P[:, 1] - cy)
        out = np.where((rr > r - 0.018)[:, None], _tom(hx(cor), 1.3), _tom(hx(cor), 0.66))
        return _vao(np.where(((rr < r * 0.6) & (P[:, 1] - cy > 0))[:, None], _tom(hx(cor), 0.84), out), P)
    _disco(cx, cy, zt, r, emissivo(dentro), o, lados=20)


def _caixinha(x0, x1, y0, y1, z0, z1, cor='#7a4a2c', frente='y'):
    """A caixinha de madeira com a tampa (a linha clara) e o fecho de latão."""
    c0 = hx(cor)

    def f(L, n, P):
        out = np.tile(c0, (len(P), 1))
        nn = np.asarray(n, float)
        if abs(nn[2]) < 0.5:
            zz = P[:, 2] - z1
            out = np.where(((zz > -0.04 - PZ) & (zz <= -0.04))[:, None], _tom(c0, 0.62), out)
            out = np.where(((zz > -0.04) & (zz <= -0.04 + PZ))[:, None], _tom(c0, 1.2), out)
            if (frente == 'y' and nn[1] > 0.5) or (frente == 'x' and nn[0] > 0.5):
                a = P[:, 0] if frente == 'y' else -P[:, 1]
                m = (x0 + x1) / 2 if frente == 'y' else -(y0 + y1) / 2
                fe = (np.abs(a - m) < 0.022) & (zz > -0.06) & (zz <= -0.025)
                out = np.where(fe[:, None], hx('#d8ac4a'), out)
        else:
            out = _tom(out, 1.12)
        return _vao(out, P)
    caixa((x0, x1, y0, y1, z0, z1), emissivo(f), sombra=False)


def _fileira(x, x1, yb0, yb1, z, alto, seed, n, tomba=False):
    """Uma fileira de livros em pé (larguras e alturas variadas); tomba: o último encosta no vizinho."""
    for k in range(n):
        ww = round((0.05 + 0.035 * ruido(k, seed + 3)) / PH) * PH
        if x + ww > x1:
            break
        cor = LIVRO_CORES[int(ruido(seed, k, 5.1) * len(LIVRO_CORES))]
        hh = alto * (0.72 + 0.26 * ruido(k, seed + 2))
        yy1 = yb1 - 0.03 * ruido(k, seed + 8)
        o = c.novo_obj(3)
        c.caixa((x, x + ww, yb0, yy1, z, z + hh), _lombada(cor, x, z, hh, ww, int(seed * 31 + k * 7), ymax=yy1, hmin=yb0), M, o)
        x += ww
    if tomba and x < x1 - 0.12:
        cor = LIVRO_CORES[int(ruido(seed, 12.7) * len(LIVRO_CORES))]
        hh = alto * 0.84
        ang = math.radians(18 + 8 * ruido(seed, 13.3))
        xl = x + hh * math.sin(ang) + 0.004
        x = _livro_inclinado(xl, z, 2 * PH, hh, yb0, yb1 - 0.01, ang, cor, int(seed * 13))
    return x


def _pilha(x, comp, yb0, yb1, z, seed, n=3):
    """A pilha de livros deitados, cada um um pouco torto em relação ao de baixo."""
    zz = z
    for k in range(n):
        cor = LIVRO_CORES[int(ruido(seed, k, 7.7) * len(LIVRO_CORES))]
        enc = 0.025 * ruido(seed, k, 9.1)
        cc = comp - 0.03 * k
        _livro_deitado(x + enc, x + enc + cc, yb0 + 0.015 * k, yb1 - 0.01 * k, zz, zz + 3 * PZ, cor)
        zz += 3 * PZ
    return x + comp + 0.03


# os arranjos de cada prateleira (fileiras de livros, pilhas, tigelas, potes e a caixinha), um por prateleira
_ARRANJOS = (
    (('fileira', 5, False), ('tigelas',), ('fileira', 4, False)),
    (('pilha', 3), ('fileira', 6, True), ('pote',)),
    (('fileira', 3, False), ('caixinha',), ('fileira', 4, False), ('pilha', 2)),
    (('pote',), ('fileira', 5, False), ('pilha', 3)),
)


def livros(x0, x1, y, z, fundo, seed, alto=0.3):
    """
    O que fica numa prateleira (de frente para +y), num arranjo que muda com a semente: fileiras de livros em pé
    (alturas diferentes, às vezes um tombado no vizinho), pilhas deitadas, tigelas, o pote de barro e a caixinha.
    """
    x = x0 + 0.03
    yb0, yb1 = y + 0.06, y + fundo - 2 * PH - 0.005
    for j, item in enumerate(_ARRANJOS[seed % len(_ARRANJOS)]):
        sd = seed * 10 + j
        if item[0] == 'fileira':
            x = _fileira(x, x1 - 0.03, yb0, yb1, z, alto, sd, item[1], item[2]) + 0.03
        elif item[0] == 'pilha':
            x = _pilha(x, 0.22, yb0 + 0.02, yb1, z, sd, item[1])
        elif item[0] == 'tigelas':
            _tigelas(x + 0.1, yb1 - 0.1, z)
            x += 0.3
        elif item[0] == 'pote':
            pote_barro(x + 0.085, yb1 - 0.09, z, r=0.075, h=0.17)
            x += 0.26
        else:
            _caixinha(x, x + 0.2, yb0 + 0.03, yb1, z, z + 0.13)
            x += 0.23
        if x > x1 - 0.08:
            break


def estante_parede_tras(x0, x1, fundo=0.42, h=1.75, prat=(0.05, 0.45, 0.85, 1.25), seed=1):
    """
    A estante de livros alta encostada na parede de trás (y = 0): o fundo escuro de tábuas, os lados com a quina
    clara, as prateleiras grossas com a frente clara, o rodapé, o tampo saliente e as coisas em cima.
    """
    LADO = mad2('#7a4028', eixo=1, seed=41, passo=0.07)
    TOPO = tab2(['#c27e46', '#ba7842'], 0.21, '#5a2c16', eixo=0, seed=42, org=0.0)
    FRENTE = mad2('#9e5a34', eixo=1, seed=43, passo=0.03)
    DENTRO = mad2('#3e2216', eixo=1, seed=44, passo=0.07, claro=1.06, escuro=0.94)

    def fundo_m(L, n, P):
        g = (P[:, 0] - x0) % 0.16
        out = np.tile(hx('#30190f'), (len(P), 1))
        out = np.where((g < PH)[:, None], hx('#26140c'), out)
        # a sombra embaixo de cada prateleira (no fundo)
        for z in prat[1:] + (h - 0.05,):
            out = np.where(((P[:, 2] < z) & (P[:, 2] > z - 0.06))[:, None], out * 0.78, out)
        return out
    caixa((x0, x1, 0, 0.03, 0, h), emissivo(fundo_m))
    caixa((x0, x0 + 0.06, 0, fundo, 0, h), {'cima': TOPO, 'frente': FRENTE, 'dir': DENTRO, '*': LADO})
    caixa((x1 - 0.06, x1, 0, fundo, 0, h), {'cima': TOPO, 'frente': FRENTE, '*': LADO})
    caixa((x0 + 0.06, x1 - 0.06, fundo - 0.03, fundo, 0, prat[0]), mad2('#7a4226', seed=45, passo=0.03))

    def prateleira(zp):
        def topo(L, n, P):
            out = np.tile(hx('#b8743e'), (len(P), 1))
            yy = P[:, 1]
            out = np.where((yy < fundo - 0.12)[:, None], _tom(out, 0.78), out)
            out = np.where((yy < fundo - 0.24)[:, None], _tom(hx('#b8743e'), 0.62), out)
            return np.where((yy > fundo - PH)[:, None], _tom(hx('#b8743e'), 1.12), out)
        caixa((x0 + 0.06, x1 - 0.06, 0.03, fundo, zp, zp + 0.045), {'cima': emissivo(topo), '*': mad2('#a86438', eixo=0, seed=46, passo=0.03)})
    for i, z in enumerate(prat):
        prateleira(z)
        _VAO['teto'] = prat[i + 1] if i + 1 < len(prat) else h - 0.08
        livros(x0 + 0.06, x1 - 0.06, 0.0, z + 0.045, fundo, seed + i, alto=0.32)
    _VAO['teto'] = None
    caixa((x0 - 0.025, x1 + 0.025, 0, fundo + 0.025, h - 0.05, h), {'cima': TOPO, '*': mad2('#a86438', eixo=0, seed=47, passo=0.03)})
    caixa((x0 - 0.01, x1 + 0.01, 0.0, fundo + 0.01, h - 0.08, h - 0.05), mad2('#6e3a20', seed=48, passo=0.03))
    # em cima: dois potes e a garrafa
    pote_barro(x0 + 0.16, fundo / 2, h, r=0.08, h=0.17)
    pote_barro(x0 + 0.36, fundo / 2 + 0.04, h, r=0.055, h=0.12)
    _garrafa(x0 + 0.54, fundo / 2, h)


def _garrafa(cx, cy, z):
    """A garrafa de vidro verde-escuro: o corpo, o ombro, o gargalo e a rolha; a risca de brilho do vidro."""
    o = c.novo_obj(3)
    m = vol(cx, cy, '#3e5e44', brilho=0.45)
    _poligono_rodado(cx, cy, [(z, 0.04), (z + 0.14, 0.04), (z + 0.17, 0.028), (z + 0.19, 0.016), (z + 0.24, 0.016)], m, o, lados=16)
    c.cilindro(cx, cy, 0.014, z + 0.24, z + 0.27, vol(cx, cy, '#b8865a'), M, o, lados=12, tampa_mat=liso('#c89a6a'))


def estante_baixa(y0, y1, fundo=0.48, h=1.0):
    """
    A estante baixa encostada na parede da esquerda (x = 0), aberta para +x: duas prateleiras com a cesta, os
    livros deitados e em pé, as tigelas e a caixinha; em cima, o pote de barro e o pinheirinho.
    """
    LADO = mad2('#7a4028', eixo=0, seed=51, passo=0.07)
    TOPO = tab2(['#c27e46', '#ba7842'], 0.16, '#5a2c16', eixo=1, seed=52, org=0.0)
    FRENTE = mad2('#9e5a34', eixo=1, seed=53, passo=0.03)
    DENTRO = mad2('#3e2216', eixo=0, seed=54, passo=0.07, claro=1.06, escuro=0.94)

    def fundo_m(L, n, P):
        g = (P[:, 1] - y0) % 0.16
        out = np.tile(hx('#30190f'), (len(P), 1))
        out = np.where((g < PH)[:, None], hx('#26140c'), out)
        for z in (0.44, h - 0.05):
            out = np.where(((P[:, 2] < z) & (P[:, 2] > z - 0.06))[:, None], out * 0.78, out)
        return out
    caixa((0, 0.03, y0, y1, 0, h), emissivo(fundo_m))
    caixa((0, fundo, y0, y0 + 0.06, 0, h), {'cima': TOPO, 'dir': FRENTE, 'frente': DENTRO, '*': LADO})
    caixa((0, fundo, y1 - 0.06, y1, 0, h), {'cima': TOPO, 'dir': FRENTE, '*': LADO})
    caixa((fundo - 0.03, fundo, y0 + 0.06, y1 - 0.06, 0, 0.04), mad2('#7a4226', eixo=1, seed=55, passo=0.03))

    def prateleira(zp):
        def topo(L, n, P):
            out = np.tile(hx('#b8743e'), (len(P), 1))
            xx = P[:, 0]
            out = np.where((xx < fundo - 0.12)[:, None], _tom(out, 0.78), out)
            out = np.where((xx < fundo - 0.26)[:, None], _tom(hx('#b8743e'), 0.62), out)
            return np.where((xx > fundo - PH)[:, None], _tom(hx('#b8743e'), 1.12), out)
        caixa((0.03, fundo, y0 + 0.06, y1 - 0.06, zp, zp + 0.045), {'cima': emissivo(topo), '*': mad2('#a86438', eixo=0, seed=56, passo=0.03)})
    prateleira(0.04)
    prateleira(0.44)
    caixa((0, fundo + 0.025, y0 - 0.025, y1 + 0.025, h - 0.05, h), {'cima': TOPO, '*': mad2('#a86438', eixo=0, seed=57, passo=0.03)})
    # embaixo: a pilha de livros deitados (atrás), a cesta de vime e o pote de barro (na frente)
    zp = 0.085
    _VAO['teto'] = 0.44
    for k, (cor, enc) in enumerate((('#5a3a26', 0.0), ('#84362a', 0.025), ('#3e5266', 0.005))):
        _livro_deitado(0.07 + enc, fundo - 0.06 - enc * 0.5, y0 + 0.1 + enc, y0 + 0.42 - enc, zp + k * 3 * PZ, zp + (k + 1) * 3 * PZ, cor, frente='x')
    _cesto(fundo / 2 + 0.01, y0 + 0.74, zp)
    pote_barro(fundo / 2 + 0.03, y1 - 0.26, zp, r=0.085, h=0.19)
    # em cima: três livros em pé (lombada para +x), a caixinha e as tigelas
    zp = 0.485
    _VAO['teto'] = h - 0.05
    yy = y0 + 0.1
    for k in range(4):
        ww = round((0.055 + 0.03 * ruido(k, 4.1)) / PH) * PH
        hh = 0.26 + 0.1 * ruido(k, 4.2)
        cor = LIVRO_CORES[int(ruido(k, 4.3) * len(LIVRO_CORES))] if k < 3 else '#4e2e1e'
        o = c.novo_obj(3)
        c.caixa((0.06, fundo - 0.07, yy, yy + ww, zp, zp + hh), _lombada(cor, 0, zp, hh, ww, 70 + k, frente='x', ymax=fundo - 0.07, hmin=0.06), M, o)
        yy += ww
    _tigelas(fundo / 2 + 0.06, y0 + 0.74, zp, n=3)
    _caixinha(0.1, fundo - 0.06, y1 - 0.62, y1 - 0.34, zp, zp + 0.14, frente='x')
    _VAO['teto'] = None
    # em cima: o pote de barro e o pinheirinho
    pote_barro(fundo / 2, y0 + 0.3, h, r=0.11, h=0.2)
    pinheirinho(fundo / 2, y1 - 0.3, h)
    pegadas.append((0, fundo, y0, y1))


def _cesto(cx, cy, z, r=0.13, hh=0.2):
    """A cesta de vime: as fiadas trançadas (desencontradas, 2 px) e a borda grossa enrolada."""
    def trama(P, base):
        th = np.arctan2(P[:, 1] - cy, P[:, 0] - cx)
        fila = np.floor((P[:, 2] - z) / (2 * PZ))
        col = np.floor((th * r) / 0.05 + fila * 0.5)
        alt = (col + fila) % 2 == 0
        base = np.where(alt[:, None], _tom(base, 1.1), _tom(base, 0.92))
        return np.where((((P[:, 2] - z) % (2 * PZ)) < PZ * 0.999)[:, None] & ~alt[:, None], _tom(base, 0.9), base)
    o = c.novo_obj(3)
    _poligono_rodado(cx, cy, [(z, r * 0.85), (z + hh, r)], vol(cx, cy, '#c49a5c', faixas=trama), o, lados=20)
    c.cilindro(cx, cy, r + 0.008, z + hh - 0.035, z + hh, vol(cx, cy, '#a87a42'), M, o, lados=20, tampa=False)

    def miolo(L, n, P):
        rr = np.hypot(P[:, 0] - cx, P[:, 1] - cy)
        return np.where((rr > r - 0.02)[:, None], hx('#c8a062'), hx('#4a3020'))
    _disco(cx, cy, z + hh, r + 0.008, emissivo(miolo), o, lados=20)


# ---------------------------------------------------------------- o barril, os potes e as plantas ----------------------------------------------------------------
def barril_cesto(x, y, r=0.3, h=0.45):
    """
    O barril baixo: as aduelas (uma linha escura de 1 px entre elas, a luz em degraus pela volta), a barriga, as
    cintas de ferro com a quina de cima clara e o brilho, e a tampa de tábuas dentro do anel das aduelas.
    """
    perfil = [(0.0, r * 0.9), (h * 0.22, r * 0.975), (h * 0.5, r), (h * 0.78, r * 0.975), (h, r * 0.9)]
    cintas = ((0.055, 0.115), (h - 0.125, h - 0.065))

    def rr_em(z):
        zs, rs = zip(*perfil)
        return np.interp(z, zs, rs)

    def aduela(P, base):
        th = np.arctan2(P[:, 1] - y, P[:, 0] - x)
        k = np.floor(((th / (2 * math.pi)) * 16 + 16) % 16)
        base = np.where((k % 2 == 0)[:, None], _tom(base, 1.04), base)
        # a sombra de 1 px embaixo de cada cinta
        zz = P[:, 2]
        for (a, b) in cintas:
            base = np.where(((zz < a) & (zz >= a - PZ))[:, None], _tom(base, 0.7), base)
        return base
    o = c.novo_obj(3)
    _poligono_rodado(x, y, perfil, vol(x, y, '#92562e', faixas=aduela, costuras=(16, '#4a2614', r)), o, lados=28)

    def tampa(L, n, P):
        dx, dy = P[:, 0] - x, P[:, 1] - y
        rr = np.hypot(dx, dy)
        ri = r * 0.9 - 0.045
        larg = 4 * PH
        fila = np.floor((dy + 0.4) / larg)
        g = (dy + 0.4) - fila * larg
        cores = np.stack([hx('#d29c5e'), hx('#c48e52'), hx('#d8a868')])
        out = cores[(fila % 3).astype(int)]
        out = np.where((g >= larg - PH)[:, None], _tom(out, 0.9), out)
        out = np.where((g < PH)[:, None], hx('#6a3c1e'), out)
        # o anel das aduelas (a ponta da madeira, mais escura) e a sombra dentro dele
        anel = rr > ri
        out = np.where(anel[:, None], hx('#a0643a'), out)
        out = np.where(((rr > ri - 0.022) & (rr <= ri) & (dy < 0.02))[:, None], _tom(out, 0.8), out)
        return out
    _disco(x, y, h, r * 0.9, emissivo(tampa), o, lados=28)
    for (a, b) in cintas:
        o2 = c.novo_obj(3)

        def ferro(P, base, a=a, b=b):
            zz = P[:, 2]
            base = np.where((zz > b - PZ)[:, None], hx('#8a8e98'), base)
            # os rebites
            th = np.arctan2(P[:, 1] - y, P[:, 0] - x)
            reb = ((((th / (2 * math.pi)) * 8 + 8.25) % 1) < 0.04) & (zz > a + PZ) & (zz <= a + 2 * PZ)
            return np.where(reb[:, None], hx('#a8acb4'), base)
        ra, rb = rr_em(a) + 0.012, rr_em(b) + 0.012
        c.cilindro(x, y, ra, a, b, vol(x, y, '#44464f', brilho=0.5, faixas=ferro), M, o2, lados=28, tampa=False, r1=rb)
    pegadas.append((x - r, x + r, y - r, y + r))


def pote_barro(x, y, z, r=0.09, h=0.16):
    """O pote de barro em jarro: a barriga redonda, a faixa escura com a linha clara, o ombro, o gargalo e a boca."""
    perfil = [(z, r * 0.62), (z + h * 0.12, r * 0.86), (z + h * 0.38, r), (z + h * 0.62, r * 0.93), (z + h * 0.78, r * 0.68),
              (z + h * 0.86, r * 0.5), (z + h * 0.93, r * 0.5), (z + h * 0.93, r * 0.6), (z + h, r * 0.6)]

    def faixa(P, base):
        zz = P[:, 2] - z
        zb = h * 0.5
        base = np.where(((zz > zb) & (zz <= zb + PZ))[:, None], _tom(base, 0.7), base)
        return np.where(((zz > zb + PZ) & (zz <= zb + 2 * PZ))[:, None], _tom(base, 1.18), base)
    o = c.novo_obj(3)
    _poligono_rodado(x, y, perfil, vol(x, y, '#a8603a', brilho=0.12, faixas=faixa), o, lados=20)

    def boca(L, n, P):
        rr = np.hypot(P[:, 0] - x, P[:, 1] - y)
        return _vao(np.where((rr > r * 0.6 - 0.016)[:, None], hx('#c47a4a'), hx('#3a2014')), P)
    _disco(x, y, z + h, r * 0.6, emissivo(boca), o, lados=20)


PINHO = ['#142c28', '#1c3e36', '#255446', '#2f6a52', '#3f8160', '#5c9c72', '#86ba8a']


def _copa(cx, cy, r, z0, z1, oid, dentes, prof, giro, zprox):
    """
    Uma camada do pinheiro: a pirâmide de base em estrela (as pontas dos galhos em dentes no contorno). A luz vem
    pela volta (lisa, em degraus); as pontas de baixo pegam luz e o alto, embaixo da camada de cima, fica escuro.
    """
    pts = []
    nv = dentes * 2
    for i in range(nv):
        a = giro + 2 * math.pi * i / nv
        rr = r if i % 2 == 0 else r * (1 - prof)
        pts.append(np.array([cx + rr * math.cos(a), cy + rr * math.sin(a), z0]))
    ap = np.array([cx, cy, z1])
    nzc = r / math.hypot(r, z1 - z0)
    chc = math.sqrt(1 - nzc ** 2)
    rampa = np.stack([hx(x_) for x_ in PINHO])

    def f(L, n, P):
        th = np.arctan2(P[:, 1] - cy, P[:, 0] - cx)
        d = chc * (np.cos(th) * _LUZ[0] + np.sin(th) * _LUZ[1]) + nzc * _LUZ[2]
        idx = np.clip(np.round((d - 0.25) / 0.16), 0, 3).astype(int) + 1
        zz = P[:, 2]
        idx = np.where((zz < z0 + PZ) & (d > 0.1), idx + 1, idx)
        idx = np.where(zz > zprox - PZ, idx - 1, idx)
        return _cru(rampa[np.clip(idx, 0, len(PINHO) - 1)], n)
    mat = emissivo(f)
    for i in range(nv):
        p, q = pts[i], pts[(i + 1) % nv]
        nrm = np.cross(p - ap, q - ap)
        if nrm[2] < 0:
            nrm = -nrm
        c.face_plana([tuple(ap), tuple(p), tuple(q)], tuple(nrm / np.linalg.norm(nrm)), mat, M, oid)


def pinheirinho(x, y, z):
    """O pinheirinho no vaso de barro: cinco camadas de galhos em dentes, verde-azulado, a luz do lado esquerdo."""
    perfil = [(z, 0.07), (z + 0.1, 0.094), (z + 0.135, 0.1)]
    o = c.novo_obj(3)

    def aro(P, base):
        zz = P[:, 2] - z
        base = np.where((zz > 0.1 + PZ * 0.5)[:, None], _tom(base, 1.1), base)
        return np.where(((zz > 0.1 - PZ) & (zz <= 0.1))[:, None], _tom(base, 0.7), base)
    _poligono_rodado(x, y, perfil, vol(x, y, '#b0623a', faixas=aro), o, lados=20)

    def terra(L, n, P):
        rr = np.hypot(P[:, 0] - x, P[:, 1] - y)
        return np.where((rr > 0.084)[:, None], hx('#9a5432'), hx('#3e2a1c'))
    _disco(x, y, z + 0.135, 0.1, emissivo(terra), o, lados=20)
    o = c.novo_obj(3)
    c.cilindro(x, y, 0.018, z + 0.13, z + 0.2, vol(x, y, '#6a4428'), M, o, lados=8, tampa=False)
    o = c.novo_obj(3)
    camadas = ((0.18, 0.18, 0.34), (0.15, 0.26, 0.41), (0.12, 0.33, 0.48), (0.088, 0.4, 0.55), (0.055, 0.47, 0.62))
    for k, (r, a, b) in enumerate(camadas):
        zprox = z + camadas[k + 1][1] if k + 1 < len(camadas) else 1e9
        _copa(x, y, r, z + a, z + b, o, dentes=11 - k, prof=0.3, giro=0.35 * k, zprox=zprox)


def vaso(x, y, z):
    """O vasinho de barro da mesa com a suculenta: as folhas grossas em leque, cada uma com o lado aceso."""
    o = c.novo_obj(3)
    perfil = [(z, 0.045), (z + 0.065, 0.058), (z + 0.065, 0.064), (z + 0.09, 0.064)]

    def aro(P, base):
        return np.where((P[:, 2] > z + 0.065 + PZ * 0.5)[:, None], _tom(base, 1.08), base)
    _poligono_rodado(x, y, perfil, vol(x, y, '#b0623a', faixas=aro), o, lados=18)

    def terra(L, n, P):
        rr = np.hypot(P[:, 0] - x, P[:, 1] - y)
        return np.where((rr > 0.05)[:, None], hx('#c47448'), hx('#3e2a1c'))
    _disco(x, y, z + 0.09, 0.064, emissivo(terra), o, lados=18)
    o = c.novo_obj(3)
    # as folhas gordas de ponta romba, em leque (as de fora mais escuras); o lado esquerdo de cada uma aceso
    folhas = ((-58, 0.1, 0.07, '#2c623a'), (58, 0.1, 0.07, '#285a36'), (-28, 0.13, 0.075, '#367842'),
              (28, 0.13, 0.075, '#2f6a3e'), (0, 0.155, 0.08, '#4a9450'))
    k = 1 / math.sqrt(2)
    zb = z + 0.075
    for (ang, l, w, cor) in folhas:
        a_ = math.radians(ang)
        ts, tz = math.sin(a_), math.cos(a_)
        ns, nz_ = -tz, ts
        forma = ((0.0, 0.18), (0.25, 0.5), (0.6, 0.5), (0.92, 0.3), (1.0, 0.0), (0.92, -0.3), (0.6, -0.5), (0.25, -0.5), (0.0, -0.18))
        pts = [(u * l * ts + v * w * ns, zb + u * l * tz + v * w * nz_) for (u, v) in forma]
        c0 = hx(cor)

        def f(L, n, P, c0=c0, ns=ns, nz_=nz_):
            s_ = (P[:, 0] - x) * k - (P[:, 1] - y) * k
            lado = s_ * ns + (P[:, 2] - zb) * nz_
            out = np.where((lado > 0.004)[:, None], _tom(c0, 1.22), c0)
            return _cru(out, n)
        c.face_plana([(x + s_ * k, y - s_ * k, zz) for (s_, zz) in pts], (k, k, 0), emissivo(f), M, o)


def vasinho_galhos(x, y):
    """O vaso alto de barro no canto, com as faixas claras, os galhos secos e as plumas de capim."""
    o = c.novo_obj(3)
    perfil = [(0.0, 0.08), (0.05, 0.1), (0.14, 0.105), (0.22, 0.085), (0.26, 0.06), (0.29, 0.058), (0.3, 0.07)]

    def faixas(P, base):
        zz = P[:, 2]
        for z0 in (0.07, 0.17):
            base = np.where(((zz > z0) & (zz <= z0 + 2 * PZ))[:, None], hx('#d8c49a'), base)
        return base
    _poligono_rodado(x, y, perfil, vol(x, y, '#8e4a2c', brilho=0.15, faixas=faixas), o, lados=20)

    def boca(L, n, P):
        rr = np.hypot(P[:, 0] - x, P[:, 1] - y)
        return np.where((rr > 0.055)[:, None], hx('#a65a36'), hx('#2e1a10'))
    _disco(x, y, 0.3, 0.07, emissivo(boca), o, lados=20)
    # os galhos: fitas de frente para a câmera (o lado esquerdo de cada um, 1 px, mais claro)
    galhos = (
        [(-0.01, 0.28), (-0.05, 0.45), (-0.1, 0.62)],
        [(0.0, 0.28), (0.03, 0.48), (0.05, 0.68)],
        [(0.015, 0.28), (0.07, 0.42), (0.13, 0.56)],
        [(-0.005, 0.28), (-0.02, 0.5), (-0.07, 0.66), (-0.08, 0.72)],
        [(0.04, 0.5), (0.1, 0.62), (0.12, 0.66)],
    )
    og = c.novo_obj(3, contorno=False)
    k = 1 / math.sqrt(2)
    for g in galhos:
        _fita(g, x, y, liso('#3e2416'), og, 0.03)
    # as plumas de capim (creme, o lado esquerdo aceso, o direito na sombra)
    for (s0, z0, s1, z1, w) in ((-0.1, 0.6, -0.16, 0.84, 0.1), (0.05, 0.68, 0.08, 0.93, 0.105)):
        of = c.novo_obj(3)
        ds, dz = s1 - s0, z1 - z0
        l = math.hypot(ds, dz)
        ts, tz = ds / l, dz / l
        ns, nz_ = -tz, ts
        pts = []
        for i in range(10):
            a_ = 2 * math.pi * i / 10
            u, v = math.cos(a_) * l / 2, math.sin(a_) * w / 2 * (0.75 + 0.3 * math.cos(a_))
            pts.append((s0 + ds / 2 + u * ts + v * ns, z0 + dz / 2 + u * tz + v * nz_))

        def pluma(L, n, P, s0=s0, z0=z0, ns=ns, nz_=nz_, ds=ds, dz=dz):
            sp = (P[:, 0] - x) * k - (P[:, 1] - y) * k
            lado = (sp - s0 - ds / 2) * ns + (P[:, 2] - z0 - dz / 2) * nz_
            out = np.where((lado > 0.012)[:, None], hx('#f2e6c8'), hx('#dccaa0'))
            out = np.where((lado < -0.016)[:, None], hx('#b49a72'), out)
            return _cru(out, n)
        c.face_plana([(x + a * k, y - a * k, b) for (a, b) in pts], (k, k, 0), emissivo(pluma), M, of)
    pegadas.append((x - 0.1, x + 0.1, y - 0.1, y + 0.1))



# ---------- a montagem (as posições medidas na referência; a sala de 7 x 7 casas) ----------
# parede da esquerda (x = 0), do canto de trás para a frente: o sofá com o quadro em cima, a porta, a plaquinha e a estante baixa
quadro_esq(1.0, 1.62, 1.4, 2.2)
sofa(0.06, 0.62, 2.08)
porta(2.25, 3.2)
placa('x', 3.95, 4.5, 1.85, 2.05)
estante_baixa(3.46, 5.1)
# parede de trás (y = 0): a estante de livros alta, a plaquinha, a lareira, o relógio e a escrivaninha com o teclado
estante_parede_tras(0.12, 1.42)
placa('y', 0.75, 1.3, 2.3, 2.5)
lareira(2.92)
relogio_parede(4.68, 1.2, r=0.26)
piano(3.94, 5.04)
# no chão: a mesinha, o barril, a mesa com 6 cadeiras (2 + 2 nos lados compridos, 1 em cada ponta) e o vaso
mesinha(1.0, 3.18)
barril_cesto(1.15, 4.73)
vasinho_galhos(0.66, 5.0)
mx0, mx1, my0, my1 = 2.82, 4.32, 3.1, 3.95
mesa(mx0, my0, mx1 - mx0, my1 - my0)
for cx in (3.08, 3.78):
    cadeira(cx, my0 - 0.36, '-y')
    cadeira(cx, my1 - 0.08, '+y')
cadeira(mx0 - 0.36, (my0 + my1) / 2 - 0.22, '-x')
cadeira(mx1 - 0.08, (my0 + my1) / 2 - 0.22, '+x')
vaso(3.6, 3.52, 0.78)
FOGO = (2.92, 1.1)


# ---------- o acabamento no pixel ----------
cor = c.cor.copy()
nrm, obj, tipo, face, prof, P = c.nrm, c.obj, c.tipo, c.face, c.prof, c.mundoP
h, w = obj.shape
nz, nx, ny = nrm[..., 2], nrm[..., 0], nrm[..., 1]
topo = nz > 0.6
esq = ~topo & (ny >= nx)
dirt = ~topo & (nx > ny)
f = np.where(topo, 1.0, np.where(esq, 0.84, 0.66))
f = np.where(tipo == 2, np.where(topo, 1.04, np.where(esq, 0.97, 0.9)), f)
quente = np.array([16.0, 4.0, -10.0])
luz_m = np.isin(obj, list(luzes))
cor = np.where(luz_m[..., None], cor, cor * f[..., None] + (1 - f[..., None]) * quente)


def viz(a, dy, dx, fill):
    out = np.full_like(a, fill)
    ys = slice(max(0, dy), h + min(0, dy))
    yd = slice(max(0, -dy), h + min(0, -dy))
    xs = slice(max(0, dx), w + min(0, dx))
    xd = slice(max(0, -dx), w + min(0, -dx))
    out[yd, xd] = a[ys, xs]
    return out


chao = (tipo == 1) & topo
# a sombra macia (dois degraus): embaixo do móvel e um pouco para a frente e a direita
dentro = np.zeros((h, w), bool)
volta = np.zeros((h, w), bool)
for (a0, a1, b0, b1) in pegadas:
    X, Y = P[..., 0], P[..., 1]
    dentro |= chao & (X > a0 + 0.02) & (X < a1 + 0.08) & (Y > b0 + 0.02) & (Y < b1 + 0.1)
    volta |= chao & (X > a0 - 0.05) & (X < a1 + 0.16) & (Y > b0 - 0.05) & (Y < b1 + 0.2)
cor = np.where(dentro[..., None], cor * 0.74, np.where(volta[..., None], cor * 0.88, cor))
# os cantos: o chão perto da parede e a parede perto do chão escurecem (em degraus)
X, Y, Z = P[..., 0], P[..., 1], P[..., 2]
dp = np.minimum(X, Y)
cor = np.where((chao & (dp < 0.1))[..., None], cor * 0.86, np.where((chao & (dp < 0.22))[..., None], cor * 0.94, cor))
parede = (tipo == 2) & ~topo
cor = np.where((parede & (Z < 0.3) & (Z > 0.13))[..., None], cor * 0.93, cor)
# o fogo acende o chão em volta da lareira (em anéis)
dfog = np.hypot((X - FOGO[0]) * 0.8, Y - FOGO[1])
anel = np.floor(np.clip(1 - dfog / 1.4, 0, 1) * 4) / 4
cor = np.where(chao[..., None], cor + anel[..., None] * np.array([30.0, 16.0, 0.0]), cor)

# o brilho da quina de cima e o contorno
emb_obj, emb_nz = viz(obj, 1, 0, -1), viz(nz, 1, 0, 0.0)
brilho = topo & (obj >= 0) & (emb_obj == obj) & (emb_nz < 0.5) & ~luz_m & (tipo != 1)
cor = np.where(brilho[..., None], np.minimum(255, cor * 1.15 + 10), cor)
borda = np.zeros((h, w), bool)
for dy, dx in ((0, 1), (1, 0), (0, -1), (-1, 0)):
    On, Pn = viz(obj, dy, dx, -1), viz(prof, dy, dx, -1e9)
    borda |= (obj >= 0) & (On != obj) & ((Pn < prof - 0.04) | (On < 0))
borda &= ~luz_m
quina = np.zeros((h, w), bool)
for dy, dx in ((0, 1), (1, 0)):
    On, Fn, Nn = viz(obj, dy, dx, -1), viz(face, dy, dx, -1), viz(nrm, dy, dx, 0.0)
    quina |= (obj >= 0) & (On == obj) & (Fn != face) & ((Nn * nrm).sum(-1) < 0.5)
quina &= (tipo == 3) & ~borda & ~luz_m & ~brilho
cor = np.where(quina[..., None], cor * 0.8, cor)
cor = np.where(borda[..., None], cor * 0.28 + np.array([26.0, 12.0, 10.0]), cor)

fundo = np.array([214.0, 214.0, 210.0])
img = np.where((obj >= 0)[..., None], cor, fundo)
img = Image.fromarray(np.clip(img, 0, 255).astype(np.uint8))
saida = sys.argv[1] if len(sys.argv) > 1 else 'sala3.png'
img.resize((img.width * 3, img.height * 3), Image.NEAREST).save(saida)
print('ok', img.size)
