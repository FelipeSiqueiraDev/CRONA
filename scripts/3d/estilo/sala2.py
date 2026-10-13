"""
Teste 2 do estilo da referência: a sala pequena (5 x 5 casas) com os móveis grandes, cada tábua e cada pedra com
luz em cima e sombra embaixo (o chanfro desenhado), veio na madeira, a moldura grossa, a lareira em degraus e as
sombras macias (em degraus) embaixo dos móveis e nos cantos. 1 pixel da arte = 1,33 do tabuleiro (ESC 0,75).
"""
import os
import sys
os.environ['ESC'] = '0.75'
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'codigo'))
import math
import numpy as np
from PIL import Image
from motor import Cena, MUNDO, tela, ruido, emissivo

M = MUNDO
SALA = 3.75
ALTO = 2.3
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
CHAO = ['#c98a4e', '#d29455', '#c28348']
CHAO_J = '#7e4a28'
MOV = '#a9693a'
MOV_ESC = '#94582f'
MOV_CLA = '#b8773f'
MOLD = ['#b8743e', '#b06c3a']
COURO, COURO_C = '#b8693a', '#c97a46'
PEDRA = ['#b9b8b2', '#aaa9a4', '#c4c3bd', '#a2a19c']
PEDRA_J = '#6f6c68'

cantos = np.array([[x, y, z] for x in (-0.5, SALA + 0.3) for y in (-0.5, SALA + 0.3) for z in (-0.35, ALTO + 0.35)])
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


# ---------- a sala ----------
o = c.novo_obj(1)
c.caixa((0, SALA, 0, SALA, -0.24, 0), {'cima': tabuas(CHAO, 0.36, 1.3, CHAO_J),
                                       '*': madeira('#a8642f', veio=False)}, M, o)
LB = lambri('#e6dfd1', '#bfb5a4', '#f3eee5')
caixa((-ESP, SALA, -ESP, 0, 0, ALTO), {'frente': LB, '*': liso('#9a5a2e')}, tipo=2)
caixa((-ESP, 0, 0, SALA, 0, ALTO), {'dir': LB, '*': liso('#9a5a2e')}, tipo=2)
caixa((0, SALA, 0, 0.05, 0, 0.13), madeira('#9a5a30'), tipo=2)
caixa((0, 0.05, 0.05, SALA, 0, 0.13), madeira('#9a5a30', eixo=1), tipo=2)
VG = tabuas(MOLD, 0.6, 9, '#7a4222', ponta=False)
VGy = tabuas(MOLD, 0.6, 9, '#7a4222', eixo=1, ponta=False)
caixa((-ESP - 0.1, SALA + 0.1, -ESP - 0.1, 0.1, ALTO, ALTO + 0.24), {'*': VG, 'cima': VG}, tipo=2)
caixa((-ESP - 0.1, 0.1, 0.1, SALA + 0.1, ALTO, ALTO + 0.24), {'*': VGy, 'cima': VGy}, tipo=2)
PIL = madeira('#b06e3c', eixo=1)
caixa((-ESP - 0.1, 0.16, -ESP - 0.1, 0.16, -0.24, ALTO), PIL, tipo=2)
caixa((SALA - 0.14, SALA + 0.12, -ESP - 0.1, 0.16, -0.24, ALTO), PIL, tipo=2)
caixa((-ESP - 0.1, 0.16, SALA - 0.14, SALA + 0.12, -0.24, ALTO), PIL, tipo=2)


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


# a montagem (como a referência)
quadro(0.0, 0.0, 0, 0) if False else None
# parede da esquerda (x = 0): o quadro e o sofá perto do canto, a porta, a estante baixa na ponta
caixa((0, 0.05, 0.55, 1.15, 1.3, 1.82), madeira('#7a4424', eixo=1), tipo=2)
caixa((0, 0.055, 0.61, 1.09, 1.36, 1.76), liso('#c8b890'), tipo=2)
caixa((0, 0.056, 0.61, 1.09, 1.36, 1.48), liso('#6e7a4a'), tipo=2)
caixa((0, 0.057, 0.7, 0.98, 1.48, 1.66), liso('#8a9a7a'), tipo=2)
sofa(0.06, 0.22, 1.5)
porta(1.85, 2.6)
caixa((0, 0.04, 3.02, 3.42, 1.55, 1.68), madeira('#8a5030', eixo=1), tipo=2)   # a plaquinha
estante_y = estante(0, 0, 0, 0) if False else None
# a estante baixa encostada na parede da esquerda (x = 0), na ponta da frente
lado = madeira(MOV)
caixa((0, 0.4, 2.85, 2.92, 0, 0.98), {'*': lado, 'cima': madeira(MOV_CLA)})
caixa((0, 0.4, 3.6, 3.67, 0, 0.98), {'*': lado, 'cima': madeira(MOV_CLA)})
caixa((0, 0.03, 2.85, 3.67, 0, 0.98), liso('#6a3a1e'))
for z in (0.05, 0.48, 0.92):
    caixa((0, 0.4, 2.85, 3.67, z, z + 0.06), {'cima': madeira(MOV_CLA, eixo=1), '*': madeira(MOV, eixo=1)})
o = c.novo_obj(3)
c.cilindro(0.2, 3.05, 0.12, 0.54, 0.76, madeira('#9a5c32', eixo=1), M, o, lados=14, tampa_mat=liso('#b47c48'))   # o barrilzinho
o = c.novo_obj(3)
c.cilindro(0.2, 3.45, 0.13, 0.11, 0.2, liso('#7a7a76'), M, o, lados=14, r1=0.15)
pinheirinho(0.2, 3.3, 0.98)
# parede da direita (y = 0): a estante de livros, a lareira, a escrivaninha com o teclado e o relógio
estante(0.62, 1.52, 0.0, seed=4)
placa(1.72, 2.15, 1.55, 1.68) if False else caixa((1.68, 2.08, 0, 0.04, 1.62, 1.75), madeira('#8a5030'), tipo=2)
lareira(2.38)
escrivaninha_piano(3.05, 3.7, 0.04, 0.58)
# no chão: a mesinha com o gaveteiro, o barril e a mesa com 4 cadeiras
mesa(1.1, 1.62, 0.56, 0.46, h=0.5, tampo=0.07, perna=0.08)
caixa((1.18, 1.46, 1.68, 1.86, 0.5, 0.66), {'*': madeira('#8a5030'), 'cima': madeira(MOV_CLA)}, sombra=False)
barril(0.82, 3.1)
mesa(1.62, 2.42, 1.45, 0.82)
cadeira(1.72, 1.86, '-y')
cadeira(2.5, 1.86, '-y')
cadeira(1.72, 3.28, '+y')
cadeira(2.5, 3.28, '+y')
vaso(2.4, 2.83, 0.78)

# ---------- o acabamento no pixel ----------
cor = c.cor.copy()
nrm, obj, tipo, face, prof, P = c.nrm, c.obj, c.tipo, c.face, c.prof, c.mundoP
h, w = obj.shape
nz, nx, ny = nrm[..., 2], nrm[..., 0], nrm[..., 1]
topo = nz > 0.6
esq = ~topo & (ny >= nx)
dirt = ~topo & (nx > ny)
f = np.where(topo, 1.0, np.where(esq, 0.86, 0.7))
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
dfog = np.hypot((X - 2.38) * 0.8, Y - 0.85)
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
cor = np.where(borda[..., None], cor * 0.34 + np.array([22.0, 11.0, 4.0]), cor)

fundo = np.array([214.0, 214.0, 210.0])
img = np.where((obj >= 0)[..., None], cor, fundo)
img = Image.fromarray(np.clip(img, 0, 255).astype(np.uint8))
saida = sys.argv[1] if len(sys.argv) > 1 else 'sala2.png'
img.resize((img.width * 3, img.height * 3), Image.NEAREST).save(saida)
print('ok', img.size)
