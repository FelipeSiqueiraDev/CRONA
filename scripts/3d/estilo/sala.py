"""
Teste do estilo da referência (sala de madeira em pixel art), só por código, desenhado direto no pixel:
1 pixel da arte = 2 do tabuleiro (ESC 0,5). Cada material tem a cor de base (chapada, sem ruído realista) e o
tom de cada face sai de uma rampa quente (o topo, o lado esquerdo e o direito); o contorno escuro, o brilho
na quina de cima e as juntas das tábuas são feitos no pixel.
"""
import os
import sys
os.environ['ESC'] = '0.5'
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'codigo'))
import math
import numpy as np
from PIL import Image
import motor
from motor import Cena, MUNDO, tela, ruido, emissivo

M = MUNDO
SALA = 5.25          # 7 casas
ALTO = 2.25          # a parede
ESP = 0.14           # a espessura da parede


def hx(h):
    h = h.lstrip('#')
    return np.array([int(h[i:i + 2], 16) for i in (0, 2, 4)], float)


def liso(c):
    c = hx(c)
    return emissivo(lambda L, n, P: np.tile(c, (len(L), 1)))


def coords(L, n):
    """As duas coordenadas da face (metros): no topo (x, y); na parede de pé, (ao longo, altura)."""
    if abs(n[2]) > 0.5:
        return L[:, 0], L[:, 1]
    if abs(n[1]) >= abs(n[0]):
        return L[:, 0], L[:, 2]
    return L[:, 1], L[:, 2]


def tabuas(cores, larg, comp, junta, eixo=0, e=0.022, ponta=True, seed=0):
    """Tábuas: faixas de `larg` ao longo do eixo da face, emendas a cada `comp` (desencontradas), um tom por tábua."""
    cs = [hx(c) for c in cores]
    jc = hx(junta)

    def f(L, n, P):
        a, b = coords(L, n)
        t, s = (a, b) if eixo == 0 else (b, a)   # t: ao longo da tábua; s: atravessado
        fila = np.floor(s / larg)
        off = ruido(fila, seed + 1) * comp
        col = np.floor((t + off) / comp) if ponta else np.zeros_like(t)
        k = (ruido(fila, col, seed + 2) * len(cs)).astype(int) % len(cs)
        out = np.stack(cs)[k]
        jun = (s / larg) % 1 < e / larg
        if ponta:
            jun |= ((t + off) / comp) % 1 < e / comp
        return np.where(jun[:, None], jc, out)
    return emissivo(f)


def pedras(cores, junta, alt=0.16, comp=0.3, e=0.03, seed=0):
    """Pedras em fiadas desencontradas, com a argamassa clara."""
    cs = [hx(c) for c in cores]
    jc = hx(junta)

    def f(L, n, P):
        a, b = coords(L, n)
        if abs(n[2]) > 0.5:
            a, b = L[:, 0] + L[:, 1], L[:, 0] - L[:, 1]
        fila = np.floor(b / alt)
        off = (fila % 2) * comp / 2 + ruido(fila, seed) * 0.05
        col = np.floor((a + off) / comp)
        k = (ruido(fila, col, seed + 3) * len(cs)).astype(int) % len(cs)
        out = np.stack(cs)[k]
        jun = ((b / alt) % 1 < e / alt) | (((a + off) / comp) % 1 < e / comp)
        return np.where(jun[:, None], jc, out)
    return emissivo(f)


def frisos(c, risca, passo=0.22, e=0.03):
    """A parede de lambri: tábuas de pé, com a risca fina entre elas."""
    c, r = hx(c), hx(risca)

    def f(L, n, P):
        a, b = coords(L, n)
        out = np.tile(c, (len(L), 1))
        return np.where(((a / passo) % 1 < e / passo)[:, None], r, out)
    return emissivo(f)


# a paleta (quente, como a referência)
MAD = ['#c07a42', '#c9844a', '#b8733d']             # o chão
MAD_J = '#7a4424'
MOV = ['#a8683a', '#b0703f', '#a16236']             # os móveis de madeira
MOV_J = '#6a3a1e'
MOLD = '#9a5a2e'                                    # a moldura das paredes
LAMBRI, LAMBRI_R = '#e6e0d4', '#c9c0b0'
COURO = '#b5683a'
PEDRA = ['#a9a9a6', '#b8b8b4', '#9c9c99', '#c2c1bc']
PEDRA_J = '#d8d6cf'

c = Cena(0, 0, 1, 1)
# o tamanho da tela: a sala, a parede e uma folga
cantos = np.array([[x, y, z] for x in (-0.4, SALA + 0.2) for y in (-0.4, SALA + 0.2) for z in (-0.3, ALTO + 0.3)])
S = tela(cantos)
x0, y0 = int(S[:, 0].min()) - 4, int(S[:, 1].min()) - 4
c = Cena(x0, y0, int(S[:, 0].max() - x0) + 4, int(S[:, 1].max() - y0) + 4)

luzes = set()       # os objetos que brilham sozinhos (o fogo): sem rampa de face
pegadas = []        # (x0, x1, y0, y1): a sombra de contato no chão


def caixa(b, mat, tipo=3, sombra=True):
    o = c.novo_obj(tipo)
    c.caixa(b, mat, M, o)
    if sombra and tipo == 3 and b[4] < 0.05:
        pegadas.append(b[:4])
    return o


# ---------- a sala ----------
# o piso (um tablado com a borda de madeira)
o = c.novo_obj(1)
c.caixa((0, SALA, 0, SALA, -0.2, 0), {'cima': tabuas(MAD, 0.3, 1.25, MAD_J, e=0.05), '*': tabuas(['#9a5a32'], 0.1, 9, '#6a3a1e', eixo=1, ponta=False, e=0.025)}, M, o)
# as paredes de lambri
caixa((-ESP, SALA, -ESP, 0, 0, ALTO), {'frente': frisos(LAMBRI, LAMBRI_R), '*': liso(MOLD)}, tipo=2)
caixa((-ESP, 0, 0, SALA, 0, ALTO), {'dir': frisos(LAMBRI, LAMBRI_R), '*': liso(MOLD)}, tipo=2)
# o rodapé
caixa((0, SALA, 0, 0.04, 0, 0.12), liso('#8a4e28'), tipo=2)
caixa((0, 0.04, 0.04, SALA, 0, 0.12), liso('#8a4e28'), tipo=2)
# a moldura: a viga de cima e os pilares (no canto e nas pontas)
VG = tabuas(['#b06c3a', '#a8653a'], 0.5, 9, '#7a4222', ponta=False)
caixa((-ESP - 0.06, SALA + 0.06, -ESP - 0.06, 0.06, ALTO, ALTO + 0.16), VG, tipo=2)
caixa((-ESP - 0.06, 0.06, 0.06, SALA + 0.06, ALTO, ALTO + 0.16), VG, tipo=2)
for (a, b) in ((-ESP - 0.04, -ESP - 0.04), (SALA - 0.1, -ESP - 0.04), (-ESP - 0.04, SALA - 0.1)):
    caixa((a, a + 0.24 if a < 0 else SALA + 0.08, b, b + 0.24 if b < 0 else SALA + 0.08, 0, ALTO), liso('#a5623a'), tipo=2)
caixa((0.9, SALA - 0.9, 0.0, 0.08, 0, ALTO), liso('#a5623a'), tipo=2) if False else None

# ---------- os móveis ----------
TB = tabuas(MOV, 0.16, 0.95, MOV_J)
TBy = tabuas(MOV, 0.16, 0.95, MOV_J, eixo=1)
ESC_M = liso('#8a5230')


def mesa(x, y, w, d, h=0.76, tampo=0.07):
    caixa((x, x + w, y, y + d, h - tampo, h), {'cima': TB if w >= d else TBy, '*': liso('#9a5c32')}, sombra=False)
    caixa((x + 0.06, x + w - 0.06, y + 0.06, y + d - 0.06, h - tampo - 0.1, h - tampo), liso('#8e532d'), sombra=False)
    for (a, b) in ((x + 0.04, y + 0.04), (x + w - 0.13, y + 0.04), (x + 0.04, y + d - 0.13), (x + w - 0.13, y + d - 0.13)):
        caixa((a, a + 0.09, b, b + 0.09, 0, h - tampo), liso('#94582f'))
    pegadas.append((x, x + w, y, y + d))


def cadeira(x, y, costas):
    """Cadeira (0,44 x 0,44); costas: '-y', '+y', '-x', '+x' (o lado do encosto)."""
    s, hs = 0.44, 0.46
    caixa((x, x + s, y, y + s, hs - 0.06, hs), {'cima': TB, '*': liso('#9a5c32')}, sombra=False)
    for (a, b) in ((x + 0.02, y + 0.02), (x + s - 0.08, y + 0.02), (x + 0.02, y + s - 0.08), (x + s - 0.08, y + s - 0.08)):
        caixa((a, a + 0.06, b, b + 0.06, 0, hs - 0.06), liso('#8e532d'), sombra=False)
    if costas in ('-y', '+y'):
        yy = y if costas == '-y' else y + s - 0.06
        for a in (x + 0.02, x + s - 0.08):
            caixa((a, a + 0.06, yy, yy + 0.06, hs, 0.98), liso('#94582f'), sombra=False)
        caixa((x + 0.02, x + s - 0.02, yy, yy + 0.06, 0.82, 0.96), liso('#a0623a'), sombra=False)
        caixa((x + 0.02, x + s - 0.02, yy, yy + 0.06, 0.62, 0.68), liso('#a0623a'), sombra=False)
    else:
        xx = x if costas == '-x' else x + s - 0.06
        for b in (y + 0.02, y + s - 0.08):
            caixa((xx, xx + 0.06, b, b + 0.06, hs, 0.98), liso('#94582f'), sombra=False)
        caixa((xx, xx + 0.06, y + 0.02, y + s - 0.02, 0.82, 0.96), liso('#a0623a'), sombra=False)
        caixa((xx, xx + 0.06, y + 0.02, y + s - 0.02, 0.62, 0.68), liso('#a0623a'), sombra=False)
    pegadas.append((x, x + s, y, y + s))


def estante(x0, x1, y, fundo=0.36, h=1.75, prat=(0.04, 0.5, 0.95, 1.38)):
    """Estante encostada na parede de trás (y = 0)."""
    lado = liso('#9a5c32')
    caixa((x0, x0 + 0.06, y, y + fundo, 0, h), {'*': lado, 'cima': liso('#b0703f')})
    caixa((x1 - 0.06, x1, y, y + fundo, 0, h), {'*': lado, 'cima': liso('#b0703f')})
    caixa((x0, x1, y, y + 0.03, 0, h), liso('#6e3c20'))
    caixa((x0, x1, y, y + fundo, h - 0.05, h), {'cima': liso('#b8763f'), '*': lado})
    for z in prat:
        caixa((x0 + 0.06, x1 - 0.06, y, y + fundo, z, z + 0.04), {'cima': liso('#b8763f'), '*': lado})
    return prat


def coisas_na_prateleira(x0, x1, y, z, seed):
    """Livros, potes e caixas numa prateleira."""
    x = x0 + 0.1
    i = 0
    while x < x1 - 0.18:
        r = ruido(i, seed)
        if r < 0.45:   # livros
            for k in range(3 + int(ruido(i, seed + 1) * 3)):
                if x > x1 - 0.12:
                    break
                cor = ['#7c3b2e', '#3e5a6e', '#6b6a3a', '#8a5a2a', '#5a3d58'][int(ruido(i, k, seed) * 5)]
                hh = 0.24 + 0.08 * ruido(k, i, seed + 2)
                caixa((x, x + 0.05, y + 0.08, y + 0.3, z, z + hh), {'*': liso(cor)}, sombra=False)
                x += 0.055
        elif r < 0.75:  # pote
            o = c.novo_obj(3)
            c.cilindro(x + 0.08, y + 0.18, 0.07, z, z + 0.16, liso(['#7a7a74', '#a05a3a', '#4e5a5e'][int(ruido(i, seed + 4) * 3)]), M, o, lados=10)
            x += 0.18
        else:           # caixinha
            caixa((x, x + 0.18, y + 0.08, y + 0.3, z, z + 0.12), liso('#c49a62'), sombra=False)
            x += 0.2
        x += 0.04
        i += 1


def lareira(x0, x1, y):
    """Lareira de pedra encostada na parede de trás: a base larga, a boca com o fogo e a chaminé até a viga."""
    P = pedras(PEDRA, PEDRA_J)
    d = 0.75
    caixa((x0, x1, y, y + d, 0, 1.05), {'*': P, 'cima': liso('#c8c7c1')})
    caixa((x0 - 0.06, x1 + 0.06, y, y + d + 0.06, 1.05, 1.15), liso('#cfcdc6'))
    m = (x0 + x1) / 2
    caixa((m - 0.42, m + 0.42, y, y + 0.5, 1.15, ALTO), {'*': P, 'cima': liso('#c8c7c1')})
    # a boca (o buraco escuro) e o fogo
    caixa((m - 0.32, m + 0.32, y + d - 0.02, y + d + 0.001, 0.06, 0.6), liso('#2a1a14'), sombra=False)
    caixa((m - 0.3, m + 0.3, y + d - 0.02, y + d + 0.06, 0, 0.06), liso('#5a5a58'), sombra=False)
    fogo = c.novo_obj(3, contorno=False)
    luzes.add(fogo)
    for (a, w_, hh, cor) in ((-0.26, 0.2, 0.36, '#e8782a'), (-0.12, 0.22, 0.48, '#f0a030'), (0.06, 0.2, 0.38, '#e8782a'),
                             (-0.06, 0.14, 0.34, '#f6c040'), (-0.02, 0.08, 0.2, '#fff0a0')):
        c.face_plana([(m + a, y + d + 0.004, 0.08), (m + a + w_, y + d + 0.004, 0.08), (m + a + w_ / 2, y + d + 0.004, 0.08 + hh)],
                     (0, 1, 0), liso(cor), M, fogo)
    for k in range(3):   # a lenha
        caixa((m - 0.24 + k * 0.16, m - 0.12 + k * 0.16, y + d - 0.3, y + d - 0.02, 0.06, 0.13), liso('#6a3e22'), sombra=False)


def sofa(x, y0, y1):
    """Sofá de couro encostado na parede da esquerda (x = 0), virado para +x."""
    C = liso(COURO)
    Cc = liso('#c4774a')
    caixa((x, x + 0.85, y0, y1, 0.05, 0.42), {'*': C, 'cima': Cc})
    caixa((x, x + 0.25, y0, y1, 0.42, 0.9), {'*': C, 'cima': Cc})            # encosto
    caixa((x, x + 0.85, y0, y0 + 0.2, 0.42, 0.66), {'*': C, 'cima': Cc})    # braços
    caixa((x, x + 0.85, y1 - 0.2, y1, 0.42, 0.66), {'*': C, 'cima': Cc})
    m = (y0 + y1) / 2
    caixa((x + 0.25, x + 0.82, y0 + 0.2, m - 0.01, 0.42, 0.52), {'*': C, 'cima': Cc}, sombra=False)   # almofadas
    caixa((x + 0.25, x + 0.82, m + 0.01, y1 - 0.2, 0.42, 0.52), {'*': C, 'cima': Cc}, sombra=False)
    caixa((x + 0.06, x + 0.12, y0 + 0.04, y0 + 0.1, 0, 0.05), liso('#5a3420'), sombra=False)


def porta(y0, y1):
    """Porta na parede da esquerda (x = 0), com a janelinha."""
    caixa((0, 0.05, y0 - 0.08, y1 + 0.08, 0, 2.02), liso('#8e532d'), tipo=2)
    caixa((0.0, 0.04, y0, y1, 0, 1.94), {'dir': tabuas(['#a8683a', '#b0703f'], 0.2, 9, '#6a3a1e', eixo=1, ponta=False), '*': liso('#8e532d')}, tipo=2)
    caixa((0.0, 0.06, y0 + 0.12, y1 - 0.12, 1.2, 1.75), liso('#7a4424'), tipo=2)
    caixa((0.0, 0.062, y0 + 0.16, y1 - 0.16, 1.24, 1.71), liso('#a8d4e6'), tipo=2)
    caixa((0.0, 0.064, (y0 + y1) / 2 - 0.02, (y0 + y1) / 2 + 0.02, 1.24, 1.71), liso('#7a4424'), tipo=2)
    caixa((0.0, 0.064, y0 + 0.16, y1 - 0.16, 1.455, 1.495), liso('#7a4424'), tipo=2)
    caixa((0.04, 0.1, y1 - 0.16, y1 - 0.1, 0.95, 1.01), liso('#d0a040'), tipo=2)


def quadro(x0, x1, z0, z1):
    caixa((x0, x1, 0, 0.04, z0, z1), liso('#7a4424'), tipo=2)
    caixa((x0 + 0.06, x1 - 0.06, 0, 0.045, z0 + 0.06, z1 - 0.06), liso('#9ab0a0'), tipo=2)
    caixa((x0 + 0.06, x1 - 0.06, 0, 0.046, z0 + 0.06, z0 + 0.2), liso('#6a7a5a'), tipo=2)


def barril(x, y, r=0.24, h=0.5):
    o = c.novo_obj(3)
    c.cilindro(x, y, r, 0, h, liso('#9a5c32'), M, o, lados=14, tampa_mat=tabuas(['#b0703f', '#a8683a'], 0.08, 9, '#6a3a1e', ponta=False))
    for z in (0.08, h - 0.12):
        o2 = c.novo_obj(3)
        c.cilindro(x, y, r + 0.008, z, z + 0.05, liso('#4a4a4e'), M, o2, lados=14, tampa=False)
    pegadas.append((x - r, x + r, y - r, y + r))


def vaso(x, y, z, folha='#4a8a4a'):
    o = c.novo_obj(3)
    c.cilindro(x, y, 0.07, z, z + 0.1, liso('#b0603a'), M, o, lados=10, tampa_mat=liso('#5a3a22'))
    o = c.novo_obj(3)
    c.elipsoide(np.array([x, y, z + 0.17]), np.array([0.09, 0.09, 0.09]), liso(folha), o)


def pinheirinho(x, y, z):
    o = c.novo_obj(3)
    c.cilindro(x, y, 0.08, z, z + 0.12, liso('#8a5a3a'), M, o, lados=10, tampa_mat=liso('#5a3a22'))
    for k, (r, a) in enumerate(((0.14, 0.12), (0.11, 0.24), (0.07, 0.34))):
        o = c.novo_obj(3)
        c.cilindro(x, y, r, z + a, z + a + 0.16, liso('#3e7a4a'), M, o, lados=12, r1=0.01)


def relogio(x, y):
    """Relógio de mesa redondo na escrivaninha."""
    o = c.novo_obj(3)
    c.cilindro(x, y, 0.15, 0.82, 0.86, liso('#6a3a1e'), M, o, lados=16)
    caixa((x - 0.14, x + 0.14, y - 0.04, y + 0.04, 0.76, 1.08), liso('#7a4424'), sombra=False)
    caixa((x - 0.11, x + 0.11, y + 0.04, y + 0.05, 0.8, 1.04), liso('#f0ead8'), sombra=False)


# a montagem (a sala da referência)
porta(2.0, 2.85)
quadro(1.2, 1.85, 1.2, 1.75)
sofa(0.06, 0.3, 1.75)
p = estante(2.25, 3.25, 0.04)
for i, z in enumerate(p[1:]):
    coisas_na_prateleira(2.31, 3.19, 0.04, z + 0.04, 7 + i)
coisas_na_prateleira(2.31, 3.19, 0.04, 1.75, 3)
lareira(3.65, 4.65, 0.04)
# a prateleira da esquerda (com o pinheirinho e o barrilzinho)
estante_l = estante(0.3, 1.25, 0.04, fundo=0.34, h=0.95, prat=(0.04, 0.45))
for i, z in enumerate(estante_l[1:]):
    coisas_na_prateleira(0.36, 1.19, 0.04, z + 0.04, 21)
pinheirinho(0.95, 0.2, 0.95)
barril(0.55, 0.22, r=0.1, h=0.16) if False else None
# a mesa de jantar com 4 cadeiras
mesa(1.95, 3.15, 1.55, 0.9)
cadeira(2.15, 2.6, '-y')
cadeira(2.95, 2.6, '-y')
cadeira(2.15, 4.15, '+y')
cadeira(2.95, 4.15, '+y')
vaso(2.75, 3.6, 0.76)
# a mesinha de centro na frente do sofá
mesa(1.1, 0.75, 0.6, 0.5, h=0.45, tampo=0.06)
# a escrivaninha (o teclado) e o relógio no canto da direita
mesa(4.45, 1.6, 0.6, 1.0, h=0.76)
relogio(4.9, 1.75)
caixa((4.55, 4.95, 2.1, 2.5, 0.76, 0.8), liso('#3a3a40'), sombra=False)
caixa((4.58, 4.92, 2.13, 2.47, 0.8, 0.81), liso('#e8e4dc'), sombra=False)
# o barril de lenha na frente
barril(0.8, 4.4)

# ---------- o acabamento no pixel ----------
cor = c.cor.copy()
nrm = c.nrm
obj = c.obj
tipo = c.tipo
h, w = obj.shape

# a rampa quente de cada face: o topo, a esquerda (+y) e a direita (+x)
nz, nx, ny = nrm[..., 2], nrm[..., 0], nrm[..., 1]
topo = nz > 0.6
esq = ~topo & (ny >= nx)
dirt = ~topo & (nx > ny)
f = np.where(topo, 1.0, np.where(esq, 0.86, 0.72))
f = np.where(tipo == 2, np.where(esq, 0.98, np.where(dirt, 0.9, 1.0)), f)       # as paredes: quase iguais
quente = np.array([14.0, 2.0, -12.0])
sh = cor * f[..., None] + (1 - f[..., None]) * quente
luz_m = np.isin(obj, list(luzes))
cor = np.where(luz_m[..., None], cor, sh)

# a sombra de contato no chão (embaixo e um pouco para a frente de cada móvel)
P = c.mundoP
chao = (tipo == 1) & topo
som = np.zeros((h, w), bool)
for (a0, a1, b0, b1) in pegadas:
    som |= chao & (P[..., 0] > a0 - 0.02) & (P[..., 0] < a1 + 0.1) & (P[..., 1] > b0 - 0.02) & (P[..., 1] < b1 + 0.12)
cor = np.where(som[..., None], cor * 0.8 + np.array([4, -2, -4]), cor)
# o fogo acende o chão na frente da lareira (em degraus, como pixel art)
dfog = np.hypot(P[..., 0] - 4.15, P[..., 1] - 1.0)
anel = np.floor(np.clip(1 - dfog / 1.3, 0, 1) * 3) / 3
cor = np.where((chao & ~som)[..., None], cor + anel[..., None] * np.array([34.0, 18.0, 0.0]), cor)


def viz(a, dy, dx, fill):
    out = np.full_like(a, fill)
    ys = slice(max(0, dy), h + min(0, dy))
    yd = slice(max(0, -dy), h + min(0, -dy))
    xs = slice(max(0, dx), w + min(0, dx))
    xd = slice(max(0, -dx), w + min(0, -dx))
    out[yd, xd] = a[ys, xs]
    return out


# o brilho na quina de cima: o pixel do topo que tem embaixo dele a face de lado da mesma peça
face = c.face
emb_obj, emb_nz = viz(obj, 1, 0, -1), viz(nz, 1, 0, 0.0)
brilho = topo & (obj >= 0) & (emb_obj == obj) & (emb_nz < 0.5) & ~luz_m & (tipo != 1)
cor = np.where(brilho[..., None], np.minimum(255, cor * 1.14 + 10), cor)

# o contorno: 1 px escuro do lado de quem está na frente, na borda de cada peça
prof = c.prof
borda = np.zeros((h, w), bool)
for dy, dx in ((0, 1), (1, 0), (0, -1), (-1, 0)):
    On, Pn = viz(obj, dy, dx, -1), viz(prof, dy, dx, -1e9)
    borda |= (obj >= 0) & (On != obj) & ((Pn < prof - 0.04) | (On < 0))
borda &= ~luz_m
# a quina de dentro (a mesma peça, outra face): um traço médio
quina = np.zeros((h, w), bool)
for dy, dx in ((0, 1), (1, 0)):
    On, Fn, Nn = viz(obj, dy, dx, -1), viz(face, dy, dx, -1), viz(nrm, dy, dx, 0.0)
    quina |= (obj >= 0) & (On == obj) & (Fn != face) & ((Nn * nrm).sum(-1) < 0.5)
quina &= (tipo == 3) & ~borda & ~luz_m & ~brilho
cor = np.where(quina[..., None], cor * 0.78, cor)
escuro = cor * 0.38 + np.array([20.0, 10.0, 4.0])
cor = np.where(borda[..., None], escuro, cor)

fundo = np.array([214.0, 214.0, 210.0])
img = np.where((obj >= 0)[..., None], cor, fundo)
img = Image.fromarray(np.clip(img, 0, 255).astype(np.uint8))
saida = sys.argv[1] if len(sys.argv) > 1 else 'sala.png'
img.resize((img.width * 3, img.height * 3), Image.NEAREST).save(saida)
print('ok', img.size)
