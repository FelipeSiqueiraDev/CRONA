"""
O retoque à mão do rosto da Ágata, pixel a pixel (28/10): olhos (branco, íris, pupila), sobrancelhas, nariz, boca, rubor e
o brinco, sobre a pixel art que o px2.py tira da arte. As posições vêm da arte original na mesma grade.
Uso: python polir_agata.py <se.png de entrada> <saida.png>
"""
import sys

from PIL import Image


def c(h):
    return tuple(int(h[i:i + 2], 16) for i in (1, 3, 5)) + (255,)


BROW = c('#2a1216')
OLHO = c('#1c0c10')
IRIS = c('#a8222c')
IRIS_E = c('#6e1620')
BRANCO = c('#f6ebe6')
NARIZ = c('#e0866a')
RUBOR = c('#ec9484')
BOCA = c('#8c3a3a')
OURO_C = c('#f6dc70')
OURO = c('#d8a830')
OURO_E = c('#9c7418')

PIXELS_SE = [
    # a sobrancelha de longe, brava (desce para o meio)
    ((21, 22), BROW), ((22, 22), BROW), ((23, 22), BROW), ((24, 22), BROW), ((25, 23), BROW), ((26, 23), BROW),
    # o olho de longe: branco, íris, pupila
    ((22, 23), BRANCO), ((23, 23), BRANCO), ((24, 23), IRIS), ((25, 23), IRIS_E),
    ((23, 24), IRIS_E), ((24, 24), OLHO), ((25, 24), IRIS),
    # a sobrancelha de perto e o olho de perto
    ((28, 22), BROW), ((29, 22), BROW), ((30, 22), BROW),
    ((29, 23), IRIS), ((30, 23), OLHO), ((29, 24), BRANCO), ((30, 24), OLHO),
    # o nariz, o rubor, a boca franzida
    ((29, 26), NARIZ),
    ((23, 25), RUBOR), ((24, 25), RUBOR), ((23, 26), RUBOR),
    ((27, 28), BOCA), ((28, 28), BOCA), ((29, 28), BOCA), ((26, 27), NARIZ),
    # o brinco de ouro: o aro e a gota
    ((15, 26), OURO_C), ((16, 26), OURO), ((15, 27), OURO), ((16, 27), OURO), ((15, 28), OURO), ((16, 28), OURO),
    ((15, 29), OURO), ((16, 29), OURO_E), ((15, 30), OURO_E), ((16, 30), OURO),
]


PIXELS_SW = [
    # as sobrancelhas, bravas
    ((14, 22), BROW), ((15, 22), BROW), ((16, 22), BROW), ((17, 21), BROW), ((18, 21), BROW), ((19, 21), BROW),
    ((21, 21), BROW), ((22, 21), BROW), ((23, 21), BROW), ((24, 21), BROW), ((25, 22), BROW),
    # o olho da esquerda e o da direita
    ((14, 23), BRANCO), ((15, 23), IRIS), ((16, 23), OLHO), ((15, 24), IRIS_E), ((16, 24), IRIS),
    ((22, 23), BRANCO), ((23, 23), IRIS), ((24, 23), OLHO), ((22, 24), BRANCO), ((23, 24), IRIS_E), ((24, 24), IRIS),
    # o nariz, o rubor, a boca franzida
    ((16, 26), NARIZ), ((14, 25), RUBOR), ((15, 25), RUBOR), ((22, 25), RUBOR), ((23, 25), RUBOR), ((22, 26), RUBOR),
    ((17, 28), BOCA), ((18, 28), BOCA), ((19, 28), BOCA), ((20, 28), BOCA),
    # o brinco de ouro, do outro lado
    ((30, 26), OURO_C), ((31, 26), OURO), ((30, 27), OURO), ((31, 27), OURO), ((30, 28), OURO), ((31, 28), OURO),
    ((30, 29), OURO), ((31, 29), OURO), ((30, 30), OURO_E), ((31, 30), OURO),
]

PIXELS_S = [
    # as sobrancelhas bravas, descendo para o meio
    ((17, 23), BROW), ((18, 23), BROW), ((19, 23), BROW), ((20, 24), BROW), ((21, 24), BROW),
    ((26, 24), BROW), ((27, 24), BROW), ((28, 23), BROW), ((29, 23), BROW), ((30, 23), BROW),
    # os olhos: branco, íris, pupila (o da esquerda e o da direita)
    ((18, 24), BRANCO), ((19, 25), IRIS), ((20, 25), OLHO), ((21, 25), IRIS_E), ((18, 25), BRANCO),
    ((27, 25), IRIS_E), ((28, 25), OLHO), ((29, 25), IRIS), ((30, 25), BRANCO), ((30, 24), BRANCO),
    # o nariz, o rubor e a boca franzida
    ((24, 27), NARIZ), ((17, 26), RUBOR), ((18, 26), RUBOR), ((30, 26), RUBOR), ((31, 26), RUBOR),
    ((22, 29), BOCA), ((23, 29), BOCA), ((24, 29), BOCA), ((25, 29), BOCA), ((26, 29), BOCA),
    # o brinco de ouro (do lado direito dela)
    ((32, 27), OURO_C), ((33, 27), OURO), ((32, 28), OURO), ((33, 28), OURO), ((32, 29), OURO), ((33, 29), OURO),
    ((32, 30), OURO_E), ((33, 30), OURO),
]

# (pixel a pintar, pixel de onde copiar a cor): a pele clara da testa
ESPACOS = {'sw': [((20, 21), (18, 19)), ((20, 22), (18, 19)), ((19, 22), (18, 19)), ((20, 23), (18, 19)), ((19, 23), (18, 19))]}
POR_DIRECAO = {'s': PIXELS_S, 'se': PIXELS_SE, 'sw': PIXELS_SW}


def polir(im, direcao):
    im = im.convert('RGBA').copy()
    p = im.load()
    for (x, y), cor in POR_DIRECAO.get(direcao, []):
        p[x, y] = cor
    # o respiro entre as sobrancelhas e entre os olhos: o tom claro da própria pele da pose
    for (x, y), (ox, oy) in ESPACOS.get(direcao, []):
        p[x, y] = p[ox, oy]
    return im


if __name__ == '__main__':
    # python polir_agata.py <pasta com as 8 pngs do px2> <pasta de saída>
    import os
    ent, sai = sys.argv[1], sys.argv[2]
    os.makedirs(sai, exist_ok=True)
    for k in ('s', 'se', 'e', 'ne', 'n', 'nw', 'w', 'sw'):
        polir(Image.open(os.path.join(ent, k + '.png')), k).save(os.path.join(sai, k + '.png'))
    print('ok')
