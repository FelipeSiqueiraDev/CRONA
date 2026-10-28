"""
A Ágata no caminho A (28/10): a conversão da arte (px2.py) + o cabelo em mechas (cabelo.py) + o rosto novo (olho de cílio e
íris, sobrancelha brava, nariz, boca e bochecha pequenos), nas 8 direções.

Uso: python montar_agata.py <pasta do px2 (base/)> <pasta de saída>
"""
import os
import sys

import numpy as np
from PIL import Image

import cabelo as CB
import px_de_arte as PX


def c(h):
    return tuple(int(h[i:i + 2], 16) for i in (1, 3, 5)) + (255,)


PELE, SOMBRA, SOMBRA2 = c('#fbcba2'), c('#eba27e'), c('#d98a6c')
ESC, IRIS, IRIS_E = c('#2a1216'), c('#b0303a'), c('#7a1a24')
SOB, BOCA, BOCHECHA = c('#3a2016'), c('#cf7a6a'), c('#f2988a')

# o rosto de cada pose: a máscara (linha -> (x0, x1)), os olhos [(x, y, largura)], as sobrancelhas, o nariz, a boca, as bochechas
ROSTOS = {
    's': dict(
        mask={17: (26, 27), 18: (24, 29), 19: (22, 29), 20: (22, 29), 21: (21, 30), 22: (19, 30), 23: (18, 30), 24: (17, 31), 25: (17, 31),
              26: (17, 31), 27: (18, 30), 28: (19, 29), 29: (20, 28), 30: (21, 27), 31: (23, 25)},
        olhos=[(19, 25, 3, 'e'), (27, 25, 3, 'd')], sob=[[(18, 23), (19, 23), (20, 24), (21, 24)], [(30, 23), (29, 23), (28, 24), (27, 24)]],
        nariz=(24, 28), boca=[(23, 30), (24, 30), (25, 30)], bochecha=[(18, 28), (30, 28)], centro=(25, 8)),
    'se': dict(
        mask={17: (28, 31), 18: (27, 31), 19: (27, 31), 20: (26, 30), 21: (26, 30), 22: (23, 30), 23: (22, 30), 24: (21, 30), 25: (18, 30),
              26: (17, 29), 27: (18, 28), 28: (19, 28), 29: (20, 27), 30: (24, 27)},
        olhos=[(22, 24, 2, 'e'), (28, 24, 3, 'd')], sob=[[(21, 22), (22, 22), (23, 23)], [(31, 22), (30, 22), (29, 22), (28, 23)]],
        nariz=(26, 27), boca=[(26, 29), (27, 29), (28, 29)], bochecha=[(21, 27), (30, 27)], centro=(27, 8)),
    'sw': dict(
        mask={16: (16, 17), 17: (15, 20), 18: (14, 20), 19: (14, 20), 20: (14, 20), 21: (14, 20), 22: (14, 21), 23: (13, 26), 24: (13, 27),
              25: (14, 27), 26: (14, 27), 27: (14, 26), 28: (15, 25), 29: (15, 23), 30: (16, 22)},
        olhos=[(14, 24, 3, 'e'), (22, 24, 2, 'd')], sob=[[(13, 22), (14, 22), (15, 22), (16, 23)], [(24, 22), (23, 22), (22, 23)]],
        nariz=(19, 27), boca=[(17, 29), (18, 29), (19, 29)], bochecha=[(13, 27), (24, 27)], centro=(21, 8)),
}
BRINCOS = {
    's': [((32, 27), c('#f6dc70')), ((33, 27), c('#d8a830')), ((32, 28), c('#d8a830')), ((33, 28), c('#d8a830')), ((32, 29), c('#d8a830')), ((33, 29), c('#d8a830')), ((32, 30), c('#9c7418')), ((33, 30), c('#d8a830'))],
    'se': [((15, 26), c('#f6dc70')), ((16, 26), c('#d8a830')), ((15, 27), c('#d8a830')), ((16, 27), c('#d8a830')), ((15, 28), c('#d8a830')), ((16, 28), c('#d8a830')), ((15, 29), c('#d8a830')), ((16, 29), c('#9c7418')), ((15, 30), c('#9c7418')), ((16, 30), c('#d8a830'))],
    'sw': [((30, 26), c('#f6dc70')), ((31, 26), c('#d8a830')), ((30, 27), c('#d8a830')), ((31, 27), c('#d8a830')), ((30, 28), c('#d8a830')), ((31, 28), c('#d8a830')), ((30, 29), c('#d8a830')), ((31, 29), c('#d8a830')), ((30, 30), c('#9c7418')), ((31, 30), c('#d8a830'))],
}


def rosto(im, f, brinco):
    p = im.load()
    m = f['mask']
    ys = sorted(m)
    for y, (x0, x1) in m.items():
        for x in range(x0, x1 + 1):
            p[x, y] = PELE
    for y in ys[:3]:
        for x in range(m[y][0], m[y][1] + 1):
            p[x, y] = SOMBRA
    for y in ys[3:-1]:
        p[m[y][0], y] = SOMBRA
        p[m[y][1], y] = SOMBRA
    for y in ys[-2:]:
        for x in range(m[y][0], m[y][1] + 1):
            p[x, y] = SOMBRA
    for (x, y, w, lado) in f['olhos']:
        for k in range(w):
            p[x + k, y] = ESC
        # a íris embaixo, do lado de dentro do rosto
        if lado == 'e':
            p[x + w - 2, y + 1] = IRIS
            p[x + w - 1, y + 1] = IRIS_E
        else:
            p[x, y + 1] = IRIS
            p[x + 1, y + 1] = IRIS_E
    for pts in f['sob']:
        for q in pts:
            p[q] = SOB
    p[f['nariz']] = SOMBRA2
    for q in f['boca']:
        p[q] = BOCA
    for q in f['bochecha']:
        p[q] = BOCHECHA
    for xy, cor in brinco:
        p[xy] = cor


def perfil(im, direcao, base):
    """O rosto de perfil (e, w): a máscara sai da própria pele da conversão; um olho só, a sobrancelha, a boca."""
    a = np.asarray(base)
    mp = PX.pele(a)
    mp[36:] = False
    ys, xs = np.nonzero(mp)
    if len(ys) < 20:
        return
    p = im.load()
    y0, y1 = ys.min(), ys.max()
    frente = 1 if direcao == 'e' else -1
    # só os pixels de pele viram a pele lisa (a linha inteira pegava o cabelo do meio)
    for y, x in zip(ys, xs):
        p[x, y] = PELE
    yo = y0 + int((y1 - y0) * 0.5)
    xf = xs[ys == yo].max() if frente == 1 else xs[ys == yo].min()
    ex = xf - 3 if frente == 1 else xf + 1
    for k in range(3):
        p[ex + k, yo] = ESC
    p[ex + (1 if frente == 1 else 0), yo + 1] = IRIS
    p[ex + (2 if frente == 1 else 1), yo + 1] = IRIS_E
    for k in range(3):
        p[ex + k - (1 if frente == 1 else 0), yo - 2] = SOB
    ym = yo + 5
    xm = xs[ys == ym].max() if frente == 1 and (ys == ym).any() else (xs[ys == ym].min() if (ys == ym).any() else xf)
    p[xm - (1 if frente == 1 else -1), ym] = BOCA
    p[xm - (2 if frente == 1 else -2), ym] = BOCA


if __name__ == '__main__':
    ent, sai = sys.argv[1], sys.argv[2]
    os.makedirs(sai, exist_ok=True)
    for k in ('s', 'se', 'e', 'ne', 'n', 'nw', 'w', 'sw'):
        base = Image.open(os.path.join(ent, k + '.png')).convert('RGBA')
        if k in ROSTOS:
            f = ROSTOS[k]
            im = CB.pintar(base, f['centro'], 28, f['mask'], protegidos=[xy for xy, _ in BRINCOS[k]])
            rosto(im, f, BRINCOS[k])
        elif k in ('n', 'ne', 'nw'):
            # de costas: as mechas caem do alto da cabeça (o centro bem acima, as linhas quase verticais)
            im = CB.pintar(base, (24, -34), 28, {}, passo=0.07)
        else:
            mp = PX.pele(np.asarray(base))
            mp[36:] = False
            ys, xs = np.nonzero(mp)
            im = CB.pintar(base, (24, 8), 28, {}, protegidos=list(zip(xs.tolist(), ys.tolist())))
            if k in ('e', 'w'):
                perfil(im, k, base)
        im.save(os.path.join(sai, k + '.png'))
    print('ok')
