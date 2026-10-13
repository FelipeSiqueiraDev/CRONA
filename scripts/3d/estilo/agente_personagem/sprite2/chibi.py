"""
Sprite chibi feito do zero, em formas desenhadas no pixel (sem 3D): cada parte é uma forma (elipse, cápsula,
polígono) com um volume (a normal sai da própria forma), pintada em tons chapados pela luz de cima-esquerda, com o
brilho na borda da luz, a sombra que uma parte faz na de baixo e o contorno preto. O rosto vai ponto a ponto.
"""
import math
import numpy as np
from PIL import Image


def hx(h):
    h = h.lstrip('#')
    return np.array([int(h[i:i + 2], 16) for i in (0, 2, 4)], float)


# 5 tons: sombra funda, sombra, base, luz, brilho
RAMPA = {
    'cabelo':  ['#1a0c0a', '#341a12', '#55301e', '#7c4a2a', '#a8683c'],
    'pele':    ['#7a3a2c', '#bd6a50', '#e8a07a', '#f8c8a0', '#ffe2c2'],
    'jaqueta': ['#4e3c3a', '#8c7262', '#c2ad90', '#e6d8bc', '#fff6e2'],
    'camisa':  ['#6c6c80', '#a6a6ba', '#dcdce6', '#f6f6fa', '#ffffff'],
    'calca':   ['#120e18', '#211b2b', '#342c40', '#4a4058', '#625670'],
    'bota':    ['#200e08', '#3e2016', '#663820', '#8e542e', '#b27444'],
    'cinto':   ['#0c080a', '#1a1214', '#2a2022', '#3e3234', '#544648'],
    'ouro':    ['#5a3410', '#946018', '#d09a34', '#f4ca5c', '#fff0a6'],
    'livro':   ['#2a0c0a', '#561a14', '#86281c', '#b2402a', '#d26040'],
    'papel':   ['#8a7a5c', '#bba98a', '#e6d8b8', '#f6ecd4', '#fffaee'],
}
RAMPA = {k: np.array([hx(c) for c in v]) for k, v in RAMPA.items()}
PRETO = hx('#140c12')
LUZ = np.array([-0.55, -0.62, 0.56])
LUZ = LUZ / np.linalg.norm(LUZ)


class Sprite:
    def __init__(self, w, h):
        self.w, self.h = w, h
        yy, xx = np.mgrid[0:h, 0:w]
        self.X, self.Y = xx + 0.5, yy + 0.5
        self.parte = np.full((h, w), -1)
        self.N = np.zeros((h, w, 3))
        self.N[..., 2] = 1
        self.partes = []          # (material, grupo, z, opções)

    def _por(self, m, N, mat, grupo, z, tons=None):
        i = len(self.partes)
        self.partes.append(dict(mat=mat, grupo=grupo, z=z, tons=tons))
        zz = np.array([p['z'] for p in self.partes])
        atual = np.where(self.parte >= 0, zz[np.maximum(self.parte, 0)], -1e9)
        m = m & (z >= atual)
        self.parte[m] = i
        self.N[m] = N[m]
        return m

    # ---- formas
    def elipse(self, cx, cy, rx, ry, mat, grupo, z, bojo=1.0):
        dx, dy = (self.X - cx) / rx, (self.Y - cy) / ry
        r2 = dx * dx + dy * dy
        m = r2 <= 1.0
        nz = np.sqrt(np.clip(1 - r2, 0, 1)) * bojo + 0.25
        N = np.stack([dx, dy, nz], -1)
        N /= np.linalg.norm(N, axis=-1, keepdims=True)
        return self._por(m, N, mat, grupo, z)

    def capsula(self, a, b, ra, rb, mat, grupo, z):
        a, b = np.array(a, float), np.array(b, float)
        ab = b - a
        t = np.clip(((self.X - a[0]) * ab[0] + (self.Y - a[1]) * ab[1]) / (ab @ ab), 0, 1)
        px, py = a[0] + t * ab[0], a[1] + t * ab[1]
        r = ra + (rb - ra) * t
        dx, dy = (self.X - px) / r, (self.Y - py) / r
        r2 = dx * dx + dy * dy
        m = r2 <= 1.0
        N = np.stack([dx, dy, np.sqrt(np.clip(1 - r2, 0, 1)) + 0.25], -1)
        N /= np.linalg.norm(N, axis=-1, keepdims=True)
        return self._por(m, N, mat, grupo, z)

    def poli(self, pts, mat, grupo, z, n=(0.0, 0.0, 1.0), bojo=0.0):
        pts = np.array(pts, float)
        m = np.zeros((self.h, self.w), bool)
        k = len(pts)
        for i in range(k):
            (x0, y0), (x1, y1) = pts[i], pts[(i + 1) % k]
            cruza = ((y0 <= self.Y) & (y1 > self.Y)) | ((y1 <= self.Y) & (y0 > self.Y))
            xi = x0 + (self.Y - y0) * (x1 - x0) / np.where(y1 - y0 == 0, 1e-9, y1 - y0)
            m ^= cruza & (self.X < xi)
        N = np.zeros((self.h, self.w, 3))
        N[:] = np.array(n) / np.linalg.norm(n)
        if bojo:
            # um pouco de volume: perto da borda a normal vira para fora
            cx, cy = pts[:, 0].mean(), pts[:, 1].mean()
            rx = (pts[:, 0].max() - pts[:, 0].min()) / 2 + 0.5
            ry = (pts[:, 1].max() - pts[:, 1].min()) / 2 + 0.5
            dx, dy = (self.X - cx) / rx * bojo, (self.Y - cy) / ry * bojo
            N = N + np.stack([dx, dy, np.zeros_like(dx)], -1)
            N /= np.linalg.norm(N, axis=-1, keepdims=True)
        return self._por(m, N, mat, grupo, z)

    def apagar(self, m):
        self.parte[m] = -1

    # ---- a pintura
    def pintar(self, limiares=(0.32, 0.78, 0.9)):
        H, W = self.h, self.w
        p = self.parte
        hit = p >= 0
        zz = np.array([q['z'] for q in self.partes] + [-1e9])
        gr = np.array([q['grupo'] for q in self.partes] + ['-'])
        mt = np.array([q['mat'] for q in self.partes] + ['-'])
        Z = np.where(hit, zz[p], -1e9)
        G = np.where(hit, gr[p], '-')
        M = np.where(hit, mt[p], '-')
        s = self.N @ LUZ
        a, b, c = limiares
        nivel = np.where(s < a, 1, np.where(s < b, 2, np.where(s < c, 3, 3)))

        def viz(arr, dy, dx, fill):
            o = np.full_like(arr, fill)
            ys = slice(max(0, dy), H + min(0, dy)); yd = slice(max(0, -dy), H + min(0, -dy))
            xs = slice(max(0, dx), W + min(0, dx)); xd = slice(max(0, -dx), W + min(0, -dx))
            o[yd, xd] = arr[ys, xs]
            return o
        # a sombra que a parte de cima (mais na frente) faz logo embaixo dela
        for dy, dx, t in ((-1, 0, 1), (-1, 1, 1), (-2, 0, 2), (-2, 1, 2)):
            Zc, Gc = viz(Z, dy, dx, -1e9), viz(G, dy, dx, '-')
            cai = hit & (Gc != '-') & (Gc != G) & (Zc > Z)
            nivel = np.where(cai, np.minimum(nivel, t), nivel)
        # o brilho: a borda de cima/esquerda que dá para fora (ou para algo atrás), onde já está claro
        brilho = np.zeros((H, W), bool)
        for dy, dx in ((-1, 0), (0, -1)):
            Gn, Zn = viz(G, dy, dx, '-'), viz(Z, dy, dx, -1e9)
            brilho |= hit & ((Gn == '-') | ((Gn != G) & (Zn < Z)))
        nivel = np.where(brilho & (nivel >= 3), 4, nivel)
        nivel = np.where(brilho & (nivel == 2) & (s > b - 0.12), 3, nivel)
        # a sombra funda: a borda de baixo/direita que dá para fora
        funda = np.zeros((H, W), bool)
        for dy, dx in ((1, 0), (0, 1)):
            funda |= hit & (viz(G, dy, dx, '-') == '-')
        nivel = np.where(funda & (nivel == 1), 0, nivel)
        self.nivel, self.M, self.G, self.Z = nivel, M, G, Z
        cor = np.zeros((H, W, 3))
        for k, R in RAMPA.items():
            mm = M == k
            cor[mm] = R[nivel[mm]]
        # o contorno: preto por fora; entre grupos, a de trás ganha a linha
        fora = np.zeros((H, W), bool)
        entre = np.zeros((H, W), bool)
        for dy, dx in ((0, 1), (1, 0), (0, -1), (-1, 0)):
            Gn, Zn = viz(G, dy, dx, '-'), viz(Z, dy, dx, -1e9)
            fora |= ~hit & (Gn != '-')
            entre |= hit & (Gn != '-') & (Gn != G) & (Zn > Z)
        self.sem_linha = getattr(self, 'sem_linha', set())
        for g in self.sem_linha:
            entre &= G != g
        # entre mechas do cabelo: a linha é o tom mais fundo do cabelo (não o preto)
        mecha = np.zeros((H, W), bool)
        for dy, dx in ((0, 1), (1, 0), (0, -1), (-1, 0)):
            Gn, Zn = viz(G, dy, dx, '-'), viz(Z, dy, dx, -1e9)
            mecha |= hit & (np.char.startswith(Gn.astype(str), 'cabelo')) & (Gn != G) & (Zn > Z)
        mecha &= np.char.startswith(G.astype(str), 'cabelo')
        cor = np.where((entre & ~mecha)[..., None], cor * 0.3 + PRETO * 0.7, cor)
        cor = np.where(mecha[..., None], RAMPA['cabelo'][0], cor)
        img = np.zeros((H, W, 4), np.uint8)
        img[..., :3] = np.clip(cor, 0, 255).round()
        img[..., 3] = np.where(hit, 255, 0)
        img[fora, :3] = PRETO
        img[fora, 3] = 255
        self.img = img
        return img

    def px(self, x, y, cor):
        if isinstance(cor, tuple):
            cor = RAMPA[cor[0]][cor[1]]
        elif isinstance(cor, str):
            cor = hx(cor)
        self.img[y, x, :3] = cor
        self.img[y, x, 3] = 255


def ampliar(img, k, fundo=(205, 200, 190)):
    h, w = img.shape[:2]
    b = np.zeros((h, w, 3), np.uint8)
    b[:] = fundo
    a = img[..., 3:4] / 255.0
    return Image.fromarray((img[..., :3] * a + b * (1 - a)).astype(np.uint8)).resize((w * k, h * k), Image.NEAREST)
