"""A paleta e o desenho do sprite (cada letra = uma cor; o contorno K é desenhado à mão, como nas referências)."""
import numpy as np
from PIL import Image

PAL = {
    'K': '#140d12',
    'a': '#28150f', 'b': '#472818', 'c': '#6b3f26', 'd': '#955c36', 'e': '#c08250',      # cabelo
    '1': '#8a4634', '2': '#c47658', '3': '#e9a882', '4': '#f9d0aa',                       # pele
    'E': '#1c1016', 'G': '#ffffff', 'F': '#4a2418',                                       # olho, brilho, armação
    '5': '#5e5048', '6': '#9a8a76', '7': '#c8bba3', '8': '#e7ddc9', '9': '#fffaf0',       # jaqueta
    's': '#8c8c9c', 't': '#cdcdd8', 'u': '#f3f3f8',                                       # camisa
    'y': '#8a5a14', 'Y': '#d8a038', 'Z': '#ffe08a',                                       # ouro
    'p': '#18141e', 'q': '#2b2533', 'r': '#453c4f',                                       # calça
    'm': '#2a160e', 'n': '#5a341e', 'o': '#8a5634',                                       # bota
    'v': '#3a1410', 'w': '#7a2a1c', 'x': '#b0442c', 'z': '#f0e4c4',                       # livro
    'l': '#1a1214', 'L': '#c8c8d0',                                                       # cinto
}


def hx(h):
    h = h.lstrip('#')
    return [int(h[i:i + 2], 16) for i in (0, 2, 4)]


def desenhar(texto, espelho=False):
    linhas = [l.split(' ', 1)[-1] if l[:3].strip().isdigit() else l for l in texto.strip('\n').split('\n')]
    W = max(len(l) for l in linhas)
    img = np.zeros((len(linhas), W, 4), np.uint8)
    for i, l in enumerate(linhas):
        for j, ch in enumerate(l):
            if ch in PAL:
                img[i, j, :3] = hx(PAL[ch]); img[i, j, 3] = 255
    return img[:, ::-1].copy() if espelho else img


def ampliar(img, k, fundo=(205, 200, 190)):
    h, w = img.shape[:2]
    b = np.zeros((h, w, 3), np.uint8); b[:] = fundo
    a = img[..., 3:4] / 255.0
    return Image.fromarray((img[..., :3] * a + b * (1 - a)).astype(np.uint8)).resize((w * k, h * k), Image.NEAREST)
