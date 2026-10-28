"""
O cabelo em mechas (28/10): as referências fazem o cabelo em grupos de 3 a 4 tons, com listras de luz que seguem o
fio, e é o cabelo que enquadra o rosto. Aqui: o cabelo da pose é dividido em mechas que saem de um ponto na cabeça
(o repartido) e descem para as pontas; cada mecha leva um tom (a luz vem de cima à esquerda), com uma linha escura entre
elas e o contorno escuro por fora. A forma (a silhueta e onde fica a mecha vermelha) vem da conversão da arte.
"""
import colorsys
import math

from PIL import Image


def c(h):
    return tuple(int(h[i:i + 2], 16) for i in (1, 3, 5)) + (255,)


MARROM = [c('#26150e'), c('#3e2618'), c('#58382a'), c('#74503a'), c('#94694a')]      # gap, sombra, base, luz, brilho
VERMELHO = [c('#5e0e16'), c('#9a1620'), c('#cc2028'), c('#e84434'), c('#fb7658')]


def classe_vermelha(r, g, b):
    h, s, v = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
    return s > 0.5 and (h < 0.04 or h > 0.95) and v > 0.35


def pintar(im, centro, cabelo_ate_y, mascara_rosto, protegidos=(), passo=0.2, y_min=0):
    """Redesenha o cabelo (os pixels acima de `cabelo_ate_y`, fora do rosto) em mechas. `centro` = (x, y) de onde as mechas saem."""
    im = im.convert('RGBA').copy()
    p = im.load()
    W, H = im.size
    cx, cy = centro
    cor_orig = {}
    for y in range(H):
        for x in range(W):
            cor_orig[(x, y)] = p[x, y]
    face = {(x, y) for y, (x0, x1) in mascara_rosto.items() for x in range(x0, x1 + 1)}
    prot = set(protegidos)

    def vazio(x, y):
        return not (0 <= x < W and 0 <= y < H) or cor_orig[(x, y)][3] < 128

    conj = []
    for y in range(y_min, cabelo_ate_y + 1):
        for x in range(W):
            if cor_orig[(x, y)][3] >= 128 and (x, y) not in face and (x, y) not in prot:
                conj.append((x, y))
    topo = min((y for _, y in conj), default=0)
    for (x, y) in conj:
        r, g, b, a = cor_orig[(x, y)]
        verm = classe_vermelha(r, g, b)
        pal = VERMELHO if verm else MARROM
        borda = any(vazio(x + dx, y + dy) for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)))
        ang = math.atan2(y - cy, x - cx)
        raio = math.hypot(x - cx, y - cy)
        k = ang / passo
        lock = math.floor(k)
        f = k - lock
        h = (lock * 2654435761) % 7
        if borda:
            tom = 0
        elif f < 0.16:
            tom = 1                                 # a linha entre as mechas
        else:
            # o tom da mecha: alterna entre base, luz e sombra
            tom = (2, 3, 2, 1, 3, 2, 2)[h]
            # a luz no meio da mecha, na parte de cima e à esquerda
            if 0.3 < f < 0.62 and raio > 5 and (x - cx) < 6 and tom >= 2:
                tom = min(4, tom + 1)
            # as pontas (longe do centro) e a parte de baixo ficam na sombra; com o centro acima da cabeça (de costas),
            # conta a altura dentro do cabelo
            if cy >= 0 and raio > 17 and tom > 1:
                tom -= 1
            if y > (cy + 16 if cy >= 0 else topo + 18) and tom > 1:
                tom -= 1
        p[x, y] = pal[tom]
    return im
