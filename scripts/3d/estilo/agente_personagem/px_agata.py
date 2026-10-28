"""
A Ágata em pixel art feita só por código (28/10, o Felipe: "e sobre os bonecos no código puro? me mostra com a Agatha").
Um teste, não vai para o jogo. Diferente das tentativas de 13/10 (o boneco 3D reduzido a pixel), aqui o sprite é
desenhado direto na grade pequena, como os chibis das referências (F:\\Dhellow\\CRONA\\arte\\referencias-pixel\\06): as
partes em formas simples, três tons por material (a luz de cima e da esquerda), o brilho na borda de cima, o contorno
escuro por fora e a linha entre as partes.

Grade de 32 x 48 px, de frente para +x (a pose "se" do tabuleiro); no jogo vai em 2x (94 px de altura).

Uso: python px_agata.py <saida.png>
"""
import sys

import numpy as np
from PIL import Image

L, A = 32, 48
# os materiais: (escuro, base, claro)
MAT = {
    'cabelo': ('#2a1a12', '#4a2e1e', '#6e4630'),
    'mecha': ('#7a0e10', '#c41a1e', '#ee4a3c'),
    'pele': ('#b8734e', '#e0a07a', '#f4c49c'),
    'jaqueta': ('#18171a', '#2c2a30', '#46434c'),
    'camisa': ('#7e1014', '#b81c20', '#de3a32'),
    'luva': ('#8a1014', '#c8221e', '#ec4a3a'),
    'pano': ('#6a5230', '#9a7a48', '#c4a26a'),
    'cinto': ('#2a1a10', '#4a3020', '#6a4630'),
    'calca': ('#1e1e22', '#34343a', '#4c4c54'),
    'bota': ('#3e2616', '#6a4428', '#946238'),
    'ouro': ('#8a6a1a', '#d4a830', '#f4d870'),
    'olho': ('#1a0c0c', '#1a0c0c', '#1a0c0c'),
    'iris': ('#6a1414', '#a82020', '#a82020'),
}
CONTORNO = np.array([16, 10, 10, 255], np.uint8)


def hx(c):
    return np.array([int(c[i:i + 2], 16) for i in (1, 3, 5)] + [255], np.uint8)


parte = np.full((A, L), '', dtype=object)   # o material de cada pixel
ordem = np.zeros((A, L), int)              # qual peça (para a linha entre as partes)
peca_n = [0]


def nova():
    peca_n[0] += 1
    return peca_n[0]


def pinta(mat, cond, k=None):
    k = k or nova()
    yy, xx = np.mgrid[0:A, 0:L]
    m = cond(xx + 0.5, yy + 0.5)
    parte[m] = mat
    ordem[m] = k
    return k


def elipse(cx, cy, rx, ry):
    return lambda x, y: ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1


def ret(x0, y0, x1, y1):
    return lambda x, y: (x >= x0) & (x < x1) & (y >= y0) & (y < y1)


def uniao(*fs):
    return lambda x, y: np.logical_or.reduce([f(x, y) for f in fs])


# --- as pernas e as botas (de trás para a frente: a perna esquerda dela fica atrás)
pinta('calca', ret(11, 36, 16, 43))
pinta('calca', ret(17, 36, 22, 43))
pinta('bota', uniao(ret(10, 42, 16, 46), ret(10, 45, 17, 47)))
pinta('bota', uniao(ret(17, 42, 23, 46), ret(17, 45, 24, 47)))
# --- o tronco: a jaqueta aberta e a camisa vermelha no meio, a gola
pinta('jaqueta', uniao(ret(9, 23, 23, 33), elipse(16, 24, 7.5, 3)))
pinta('camisa', ret(14, 23, 19, 33))
pinta('camisa', uniao(ret(12, 22, 15, 25), ret(18, 22, 21, 25)))
# --- os braços: a manga preta, o punho vermelho e a luva
pinta('jaqueta', ret(6, 24, 10, 30))
pinta('camisa', ret(6, 29, 10, 31))
pinta('luva', elipse(8, 32.5, 2.6, 2.4))
pinta('jaqueta', ret(22, 24, 26, 30))
pinta('camisa', ret(22, 29, 26, 31))
pinta('luva', elipse(24, 32.5, 2.6, 2.4))
# --- o cinto e o pano amarrado na cintura, caindo dos lados
pinta('cinto', ret(10, 32, 22, 34))
pinta('pano', uniao(ret(9, 34, 23, 36), ret(9, 36, 12, 40), ret(20, 36, 23, 39)))
# --- o cabelo de trás: a massa bagunçada por cima e atrás da cabeça, com as pontas
cab = nova()
pinta('cabelo', uniao(elipse(14, 10, 10, 7.5), elipse(9, 15, 5, 6.5)), cab)
for (px, py, r) in ((5, 9, 2.2), (8, 4.5, 2.2), (13, 2.8, 2.4), (19, 3.2, 2.2), (24, 6, 2.0), (5, 15, 2.0), (6, 20, 1.6)):
    pinta('cabelo', elipse(px, py, r, r), cab)
# --- o pescoço e o rosto (virado para a direita: o rosto avança para +x)
pinta('pele', ret(14, 20, 19, 23))
pinta('pele', uniao(elipse(18, 16, 5.2, 5.0), ret(13, 14, 22, 20)))
# --- a franja por cima da testa e a mecha vermelha da frente
pinta('cabelo', uniao(ret(12, 10, 24, 13), elipse(23, 12, 2.2, 2.2), elipse(13, 13, 2, 3)), nova())
pinta('mecha', uniao(elipse(20, 10.5, 2.6, 2.6), ret(19, 10, 22, 14)), nova())
# --- os olhos (os dois para a direita), a boca, o brinco
olho = nova()
for ox in (18, 21):
    pinta('olho', ret(ox, 15, ox + 2, 17), olho)
    pinta('iris', ret(ox + 1, 16, ox + 2, 17), olho)
pinta('ouro', ret(13, 18, 14, 20))

# --- a cor: três tons pela posição dentro de cada peça (a luz de cima e da esquerda)
img = np.zeros((A, L, 4), np.uint8)
for k in range(1, peca_n[0] + 1):
    m = ordem == k
    if not m.any():
        continue
    ys, xs = np.nonzero(m)
    y0, y1, x0, x1 = ys.min(), ys.max(), xs.min(), xs.max()
    for (y, x) in zip(ys, xs):
        mat = parte[y, x]
        esc, base, claro = (hx(c) for c in MAT[mat])
        t = (x - x0) / max(1, x1 - x0) * 0.55 + (y - y0) / max(1, y1 - y0) * 0.45
        if mat == 'pele':
            t = 0.5 if x < x1 - 1 else 0.9
        cor = claro if t < 0.28 else base if t < 0.72 else esc
        # o brilho na borda de cima: o pixel sem a mesma peça logo acima
        if y > 0 and ordem[y - 1, x] != k and mat not in ('olho', 'iris'):
            cor = claro
        img[y, x] = cor
# a linha entre as partes: o pixel da peça de trás que encosta na da frente fica escuro
for y in range(A):
    for x in range(L):
        k = ordem[y, x]
        if not k or parte[y, x] in ('olho', 'iris'):
            continue
        for (dy, dx) in ((0, 1), (1, 0), (0, -1), (-1, 0)):
            yy, xx = y + dy, x + dx
            if 0 <= yy < A and 0 <= xx < L and ordem[yy, xx] and ordem[yy, xx] > k and parte[yy, xx] != parte[y, x]:
                img[y, x] = hx(MAT[parte[y, x]][0])
                break
# o contorno por fora
cheio = ordem > 0
fora = np.zeros_like(cheio)
for (dy, dx) in ((0, 1), (1, 0), (0, -1), (-1, 0)):
    viz = np.roll(np.roll(cheio, dy, 0), dx, 1)
    fora |= viz & ~cheio
saida = np.zeros((A + 2, L + 2, 4), np.uint8)
saida[1:-1, 1:-1] = img
borda = np.zeros((A + 2, L + 2), bool)
c2 = np.zeros((A + 2, L + 2), bool)
c2[1:-1, 1:-1] = cheio
for (dy, dx) in ((0, 1), (1, 0), (0, -1), (-1, 0)):
    borda |= np.roll(np.roll(c2, dy, 0), dx, 1) & ~c2
saida[borda] = CONTORNO
Image.fromarray(saida, 'RGBA').save(sys.argv[1] if len(sys.argv) > 1 else 'agata_px.png')
print('ok', saida.shape)
