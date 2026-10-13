"""
Sprite chibi desenhado à mão, pixel a pixel (o estilo das referências de RPG): cada letra é uma cor da paleta, o
contorno escuro de fora é posto pelo código (1 px em volta da silhueta), o resto é desenho.
"""
import numpy as np
from PIL import Image

PAL = {
    'K': '#22181c',                                            # contorno
    'h': '#2e1a14', 'H': '#4e2e1e', 'j': '#734629', 'J': '#9a6640',   # cabelo
    'x': '#a35b45', 's': '#cf8564', 'S': '#efb48c', 'T': '#fbd2ac',   # pele
    'e': '#1e1416', 'g': '#5e2a1c', 'w': '#f2eee6', 'm': '#b55a48',   # olho, óculos, brilho, boca
    'd': '#7a6a5a', 'c': '#ab9c84', 'C': '#d8cdb6', 'D': '#f2eada',   # jaqueta
    'r': '#9a9aa8', 'R': '#d6d6de', 'W': '#f7f7fa',                   # camisa, gola
    'y': '#a87822', 'Y': '#f0c85e',                                   # ouro
    'b': '#1c1416', 'B': '#a4a4ae',                                   # cinto, fivela
    'q': '#18141c', 'p': '#29242f', 'P': '#3d3746', 'Q': '#524a5c',   # calça
    'o': '#3e2416', 'O': '#653c22', 'u': '#8c5a36',                   # bota
    'l': '#5a2018', 'L': '#8a3426', 'M': '#e6d8b8',                   # livro
}


def hx(h):
    h = h.lstrip('#')
    return [int(h[i:i + 2], 16) for i in (0, 2, 4)]


def desenhar(texto, borda=True, espelho=False):
    linhas = texto.strip('\n').split('\n')
    W = max(len(l) for l in linhas) + 2
    H = len(linhas) + 2
    img = np.zeros((H, W, 4), np.uint8)
    for i, l in enumerate(linhas):
        for j, ch in enumerate(l):
            if ch in PAL:
                img[i + 1, j + 1, :3] = hx(PAL[ch])
                img[i + 1, j + 1, 3] = 255
    if borda:
        a = img[..., 3] > 0
        viz = np.zeros_like(a)
        for dy, dx in ((0, 1), (0, -1), (1, 0), (-1, 0)):
            viz |= np.roll(np.roll(a, dy, 0), dx, 1)
        fora = viz & ~a
        img[fora, :3] = hx(PAL['K'])
        img[fora, 3] = 255
    if espelho:
        img = img[:, ::-1].copy()
    return img


def ampliar(img, k, fundo=(205, 200, 190)):
    h, w = img.shape[:2]
    b = np.zeros((h, w, 3), np.uint8)
    b[:] = fundo
    a = img[..., 3:4] / 255.0
    b = (img[..., :3] * a + b * (1 - a)).astype(np.uint8)
    return Image.fromarray(b).resize((w * k, h * k), Image.NEAREST)
