"""
O rosto da Ágata, simples (28/10, o Felipe: "simplifica... faz os olhos, e boa... um risquinho na boca ali bem sutil"):
a pele do rosto vira uma cor só (sem o ruído da conversão), com os dois olhos (2 x 3 px: o cílio escuro em cima, o
brilho e a íris, a íris escura embaixo) e a boca num risco discreto. O brinco de ouro fica.

Cada pose tem a máscara do rosto (as linhas e o intervalo de x da pele), a posição dos olhos (o canto de cima à esquerda
de cada um), a boca e o brinco, medidos na arte original com grade_rosto.py.

Uso: python polir_agata.py <pasta com as 8 pngs do px2> <pasta de saída>
"""
import os
import sys
from collections import Counter

from PIL import Image


def c(h):
    return tuple(int(h[i:i + 2], 16) for i in (1, 3, 5)) + (255,)


CILIO = c('#2a1216')
IRIS = c('#9a2430')
BRILHO = c('#fbf4ee')
BOCA = c('#cf8272')
OURO_C = c('#f6dc70')
OURO = c('#d8a830')
OURO_E = c('#9c7418')

# a máscara: {y: (x0, x1)}
FACES = {
    's': {
        'mask': {17: (26, 27), 18: (23, 29), 19: (22, 29), 20: (22, 29), 21: (22, 29), 22: (22, 29), 23: (18, 30), 24: (17, 31),
                 25: (17, 31), 26: (17, 31), 27: (18, 30), 28: (18, 30), 29: (19, 29), 30: (20, 28), 31: (22, 26)},
        'olhos': [(18, 24), (28, 24)],
        'boca': [(23, 29), (24, 29), (25, 29)],
        'brinco': [((32, 27), OURO_C), ((33, 27), OURO), ((32, 28), OURO), ((33, 28), OURO), ((32, 29), OURO), ((33, 29), OURO), ((32, 30), OURO_E), ((33, 30), OURO)],
    },
    'se': {
        'mask': {17: (28, 31), 18: (27, 31), 19: (27, 31), 20: (26, 30), 21: (26, 30), 22: (23, 30), 23: (22, 30), 24: (21, 30),
                 25: (18, 30), 26: (17, 29), 27: (18, 28), 28: (19, 28), 29: (20, 27), 30: (24, 27)},
        'olhos': [(23, 23), (29, 23)],
        'boca': [(26, 28), (27, 28), (28, 28)],
        'brinco': [((15, 26), OURO_C), ((16, 26), OURO), ((15, 27), OURO), ((16, 27), OURO), ((15, 28), OURO), ((16, 28), OURO), ((15, 29), OURO), ((16, 29), OURO_E), ((15, 30), OURO_E), ((16, 30), OURO)],
    },
    'sw': {
        'mask': {16: (16, 17), 17: (15, 20), 18: (14, 20), 19: (14, 20), 20: (14, 20), 21: (14, 20), 22: (14, 21), 23: (13, 26), 24: (13, 27),
                 25: (14, 27), 26: (14, 27), 27: (14, 26), 28: (15, 25), 29: (15, 23), 30: (16, 22)},
        'olhos': [(14, 23), (22, 23)],
        'boca': [(17, 28), (18, 28), (19, 28)],
        'brinco': [((30, 26), OURO_C), ((31, 26), OURO), ((30, 27), OURO), ((31, 27), OURO), ((30, 28), OURO), ((31, 28), OURO), ((30, 29), OURO), ((31, 29), OURO), ((30, 30), OURO_E), ((31, 30), OURO)],
    },
}


def pele_base(p, mask):
    """A cor de pele clara que mais aparece dentro da máscara."""
    cont = Counter()
    for y, (x0, x1) in mask.items():
        for x in range(x0, x1 + 1):
            r, g, b, a = p[x, y]
            if a and r > 230 and g > 180 and b > 140 and r > g > b:
                cont[(r, g, b, a)] += 1
    return cont.most_common(1)[0][0]


def polir(im, direcao):
    f = FACES.get(direcao)
    im = im.convert('RGBA').copy()
    if not f:
        return im
    p = im.load()
    pele = pele_base(p, f['mask'])
    for y, (x0, x1) in f['mask'].items():
        for x in range(x0, x1 + 1):
            p[x, y] = pele
    for (x, y) in f['olhos']:
        p[x, y] = CILIO
        p[x + 1, y] = CILIO
        p[x, y + 1] = BRILHO
        p[x + 1, y + 1] = IRIS
        p[x, y + 2] = IRIS
        p[x + 1, y + 2] = CILIO
    for (x, y) in f['boca']:
        p[x, y] = BOCA
    for (x, y), cor in f['brinco']:
        p[x, y] = cor
    return im


if __name__ == '__main__':
    ent, sai = sys.argv[1], sys.argv[2]
    os.makedirs(sai, exist_ok=True)
    for k in ('s', 'se', 'e', 'ne', 'n', 'nw', 'w', 'sw'):
        polir(Image.open(os.path.join(ent, k + '.png')), k).save(os.path.join(sai, k + '.png'))
    print('ok')
