"""
O corpo do personagem em cubinhos, esculpido das 8 vistas dele (28/10, o Felipe: "estuda o que eles fazem"). O mesmo
truque do PixZels e dos editores de voxel, em código:

  1. cada vista (as 8 direções da arte) é uma câmera ortográfica em volta do corpo; o cubinho que cai fora da
     silhueta de uma vista é cortado (o "casco visual"); a silhueta é engordada um pouco, porque a arte não é igual
     de uma vista para outra;
  2. cada cubinho da casca é pintado com a cor da vista que o enxerga de frente (a que tem a normal mais voltada
     para a câmera e o cubinho sem nada na frente);
  3. o corpo se renderiza de qualquer ângulo, em pixel art no tamanho do tabuleiro (z-buffer, contorno de 1 px).

Coordenadas do corpo (px da arte, 469 de altura): x = a direita dele, y = a frente, z = para cima. Uma vista com o
personagem olhando para (fu, fd) na tela (fu = direita, fd = para a câmera) tem: u = -fd*x + fu*y; d = fu*x + fd*y;
tela: X = cx + u; Y = gy - z*cosE + d*sinE (o que está mais perto da câmera aparece mais embaixo).
"""
import math
import os

import numpy as np
from PIL import Image

ARTE = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', '..', '..', '..', 'client', 'public', 'arte', 'personagens')
FRENTE = {'s': (0, 1), 'se': (0.7071, 0.7071), 'e': (1, 0), 'ne': (0.7071, -0.7071), 'n': (0, -1),
          'nw': (-0.7071, -0.7071), 'w': (-1, 0), 'sw': (-0.7071, 0.7071)}
PASSO = 5          # px da arte por cubinho (469 / 5 = 94 cubinhos de altura)
ALTURA = 469.0


class Vista:
    def __init__(self, nome, png, elev):
        self.nome = nome
        im = Image.open(png).convert('RGBA')
        self.rgba = np.asarray(im)
        self.alfa = self.rgba[..., 3] > 128
        self.h, self.w = self.alfa.shape
        ys, xs = np.nonzero(self.alfa)
        y0, y1 = ys.min(), ys.max()
        alt = y1 - y0
        sel = (ys > y0 + 0.45 * alt) & (ys < y0 + 0.6 * alt)
        self.cx = xs[sel].mean()
        self.gy = float(y1) - 12.0     # o chão do eixo do corpo: um pouco acima da sola mais baixa
        self.fu, self.fd = FRENTE[nome]
        self.ce, self.se = math.cos(math.radians(elev)), math.sin(math.radians(elev))

    def projetar(self, P):
        x, y, z = P[:, 0], P[:, 1], P[:, 2]
        u = -self.fd * x + self.fu * y
        d = self.fu * x + self.fd * y
        return self.cx + u, self.gy - z * self.ce + d * self.se, d


def carregar(nome, elev=30.0, dir_arte=None):
    pasta = os.path.join(dir_arte or ARTE, nome, 'tabuleiro-32bits')
    return [Vista(k, os.path.join(pasta, 'idle-desarmado-%s.png' % k), elev) for k in FRENTE]


def grade(larg=250, fundo=220):
    xs = np.arange(-larg / 2, larg / 2 + 1, PASSO) + PASSO / 2
    ys = np.arange(-fundo / 2, fundo / 2 + 1, PASSO) + PASSO / 2
    zs = np.arange(0, ALTURA + 1, PASSO) + PASSO / 2
    X, Y, Z = np.meshgrid(xs, ys, zs, indexing='ij')
    return xs, ys, zs, np.stack([X, Y, Z], -1).reshape(-1, 3)


def esculpir(vistas, tolera=1, engorda=3):
    """Os cubinhos que cabem em todas as silhuetas (menos `tolera` vistas). Devolve (P, dentro)."""
    from scipy.ndimage import binary_dilation
    _, _, _, P = grade()
    conta = np.zeros(len(P), np.int16)
    for v in vistas:
        sil = binary_dilation(v.alfa, iterations=engorda) if engorda else v.alfa
        X, Y, _ = v.projetar(P)
        xi, yi = np.round(X).astype(int), np.round(Y).astype(int)
        ok = (xi >= 0) & (xi < v.w) & (yi >= 0) & (yi < v.h)
        dentro = np.zeros(len(P), bool)
        dentro[ok] = sil[yi[ok], xi[ok]]
        conta += dentro
    return P, conta >= len(vistas) - tolera


def casca(P, dentro):
    """Os cubinhos da superfície (com algum vizinho vazio) e a grade de ocupação."""
    from scipy.ndimage import binary_erosion
    xs, ys, zs, _ = grade()
    occ = dentro.reshape(len(xs), len(ys), len(zs))
    sup = occ & ~binary_erosion(occ, structure=np.ones((3, 3, 3), bool), border_value=0)
    return occ, sup


def normais(occ, sup):
    from scipy.ndimage import gaussian_filter
    g = gaussian_filter(occ.astype(np.float32), 2.0)
    gx, gy, gz = np.gradient(g)
    n = -np.stack([gx, gy, gz], -1)[sup]
    return n / np.maximum(np.linalg.norm(n, axis=1, keepdims=True), 1e-6)


def pintar(vistas, P, occ, sup, elev=30.0):
    """A cor de cada cubinho da casca: da vista que o enxerga melhor (a normal mais voltada para a câmera, sem nada na
    frente). Devolve (Ps, cores) dos cubinhos da superfície."""
    Ps = P.reshape(*occ.shape, 3)[sup]
    n = normais(occ, sup)
    ce, se = math.cos(math.radians(elev)), math.sin(math.radians(elev))
    melhor = np.full(len(Ps), -1.0)
    cor = np.zeros((len(Ps), 3), np.uint8)
    for v in vistas:
        X, Y, d = v.projetar(Ps)
        xi, yi = np.round(X).astype(int), np.round(Y).astype(int)
        ok = (xi >= 0) & (xi < v.w) & (yi >= 0) & (yi < v.h)
        # o que está na frente: o z-buffer da vista (o cubinho mais perto da câmera em cada pixel)
        zb = np.full((v.h, v.w), -1e9)
        np.maximum.at(zb, (yi[ok], xi[ok]), d[ok])
        vis = ok.copy()
        vis[ok] = d[ok] >= zb[yi[ok], xi[ok]] - PASSO * 1.6
        cam = np.array([v.fu * ce, v.fd * ce, se])
        w = np.clip(n @ cam, 0, None) ** 2
        w[~vis] = -1
        # só a cor onde a arte tem pixel
        sel = vis & (w > melhor)
        amostra = np.zeros((len(Ps), 4), np.uint8)
        amostra[ok] = v.rgba[yi[ok], xi[ok]]
        sel &= amostra[:, 3] > 128
        cor[sel] = amostra[sel, :3]
        melhor[sel] = w[sel]
    sem = melhor < 0
    return Ps, cor, ~sem


def renderizar(Ps, cor, fu, fd, alto=94, elev=30.0, ss=4, margem=4):
    """O corpo visto de uma direção (fu, fd), em pixel art do tamanho do tabuleiro (alto px). z-buffer com supersampling."""
    ce, se = math.cos(math.radians(elev)), math.sin(math.radians(elev))
    sc = alto / ALTURA
    x, y, z = Ps[:, 0], Ps[:, 1], Ps[:, 2]
    u = -fd * x + fu * y
    d = fu * x + fd * y
    Yv = -z * ce + d * se
    X0, X1 = u.min() * sc - margem, u.max() * sc + margem
    Y0, Y1 = Yv.min() * sc - margem, Yv.max() * sc + margem
    W, H = int(math.ceil(X1 - X0)), int(math.ceil(Y1 - Y0))
    img = np.zeros((H * ss, W * ss, 4), np.uint8)
    ordem = np.argsort(d)               # de longe para perto: o perto pinta por cima
    xi = np.round((u[ordem] * sc - X0) * ss).astype(int)
    yi = np.round((Yv[ordem] * sc - Y0) * ss).astype(int)
    c = cor[ordem]
    r = int(math.ceil(PASSO * sc * ss * 0.75))
    for dy in range(-r, r + 1):
        for dx in range(-r, r + 1):
            yy, xx = yi + dy, xi + dx
            ok = (yy >= 0) & (yy < H * ss) & (xx >= 0) & (xx < W * ss)
            img[yy[ok], xx[ok], :3] = c[ok]
            img[yy[ok], xx[ok], 3] = 255
    pm = img.astype(np.float64)
    pm[..., :3] *= pm[..., 3:4] / 255
    peq = np.asarray(Image.fromarray(pm.astype(np.uint8), 'RGBA').resize((W, H), Image.BOX)).astype(np.float64)
    al = peq[..., 3:4] / 255
    rgb = np.where(al > 0, peq[..., :3] / np.maximum(al, 1e-6), 0)
    out = np.concatenate([np.clip(rgb, 0, 255), (al > 0.5) * 255.0], 2)
    return Image.fromarray(out.astype(np.uint8), 'RGBA')
