"""A Ágata, de frente, desenhada do zero em pixel art (28/10). Tela de 48 x 96 px (o tabuleiro: 94 px de altura)."""
import sys

from PIL import Image

from motor import Material, Peca, renderizar, c

W, H = 48, 96
PELE = Material('#b8704e', '#e8a07c', '#fbcba2', '#ffe2c4')
MARROM = Material('#24140c', '#42281a', '#664230', '#8c6244')
VERM = Material('#640c14', '#a4141c', '#d4222a', '#f24c3c')
JAQ = Material('#141418', '#232329', '#34343c', '#52525e')
CAMISA = Material('#740f16', '#ae1820', '#d8262c', '#f4523f')
PANO = Material('#4a3820', '#78603a', '#a8844c', '#d2ac6e')
CALCA = Material('#1a2030', '#283044', '#38445a', '#546280')
BOTA = Material('#26160c', '#46301a', '#6c482a', '#9a6c42')
OURO = Material('#785812', '#b68820', '#e0b030', '#fae088')
OSSO = Material('#9a6048', '#c88c6c', '#e8b496', '#f6cdb0')   # a pele do joelho rasgado


def esp(pts):
    """espelha uma lista de pontos em volta do centro (x = 24)."""
    return [(W - x, y) for x, y in pts][::-1]


def pecas():
    P = []
    a = P.append
    # --- o cabelo de trás: o volume bagunçado, com as pontas para fora
    a(Peca('cabelo_fundo', ('poli', [(5, 20), (4, 14), (8, 12), (7, 6), (13, 6), (14, 1), (19, 4), (24, 0), (29, 4), (34, 1), (35, 6), (41, 6), (40, 12), (44, 14), (43, 20), (45, 27), (41, 31), (42, 37), (36, 33), (12, 33), (6, 37), (7, 31), (3, 27)]), MARROM, 1, faixa=6))
    a(Peca('pescoco', ('ret', 21, 32, 27, 39), PELE, 2))
    # --- o tronco: a camisa vermelha e a jaqueta aberta por cima
    a(Peca('camisa', ('poli', [(16, 37), (32, 37), (33, 62), (15, 62)]), CAMISA, 3))
    jl = [(10, 40), (17, 37), (20, 38), (19, 61), (10, 61), (8, 50)]
    a(Peca('jaqueta_e', ('poli', jl), JAQ, 4))
    a(Peca('jaqueta_d', ('poli', esp(jl)), JAQ, 4))
    a(Peca('gola', ('poli', [(16, 35), (32, 35), (31, 40), (24, 43), (17, 40)]), VERM, 5))
    # --- as pernas (a calça), antes do pano
    leg = [(12, 62), (22, 62), (22, 86), (11, 86), (10, 74)]
    a(Peca('calca_e', ('poli', leg), CALCA, 7))
    a(Peca('calca_d', ('poli', esp(leg)), CALCA, 7))
    # --- as botas, de ponta redonda
    bl = [(9, 83), (22, 83), (22, 90), (24, 94), (7, 94), (7, 89)]
    a(Peca('bota_e', ('poli', bl), BOTA, 8))
    a(Peca('bota_d', ('poli', esp(bl)), BOTA, 8))
    # --- os braços: a manga da jaqueta, o punho vermelho, a luva
    ml = [(5, 44), (11, 40), (14, 44), (13, 55), (5, 56), (3, 50)]
    a(Peca('manga_e', ('poli', ml), JAQ, 9))
    a(Peca('manga_d', ('poli', esp(ml)), JAQ, 9))
    pl = [(3, 53), (13, 53), (13, 59), (3, 59)]
    a(Peca('punho_e', ('poli', pl), VERM, 10))
    a(Peca('punho_d', ('poli', esp(pl)), VERM, 10))
    a(Peca('luva_e', ('elipse', 8, 63.5, 4.6, 5), VERM, 11))
    a(Peca('luva_d', ('elipse', 40, 63.5, 4.6, 5), VERM, 11))
    # --- a cintura e o pano amarrado do lado esquerdo, com as duas pontas caindo
    a(Peca('cinto', ('ret', 11, 59, 37, 62), Material('#1a100a', '#2c1c12', '#442c1c', '#684630'), 12, volume=False))
    a(Peca('pano', ('poli', [(10, 60), (38, 60), (39, 66), (30, 67), (14, 68), (9, 67)]), PANO, 13))
    a(Peca('ponta_1', ('poli', [(10, 66), (17, 66), (16, 79), (9, 76)]), PANO, 14))
    a(Peca('ponta_2', ('poli', [(16, 67), (21, 67), (22, 75), (18, 77)]), PANO, 14))
    a(Peca('no', ('elipse', 14, 62.5, 3.8, 3.2), PANO, 15))
    # --- a cabeça: o rosto, as orelhas
    a(Peca('orelha_e', ('elipse', 13.5, 26, 2.2, 2.6), PELE, 16))
    a(Peca('orelha_d', ('elipse', 34.5, 26, 2.2, 2.6), PELE, 16))
    a(Peca('rosto', ('poli', [(14, 20), (18, 15), (30, 15), (34, 20), (34, 28), (31, 33), (24, 35), (17, 33), (14, 28)]), PELE, 17))
    # --- o cabelo da frente: a franja repartida e as asas ao lado do rosto, com as pontas
    a(Peca('franja_e', ('poli', [(11, 17), (10, 11), (14, 8), (13, 3), (19, 6), (26, 5), (26, 13), (23, 20), (19, 17), (16, 23), (13, 24)]), MARROM, 18, faixa=3))
    a(Peca('franja_d', ('poli', [(25, 5), (31, 4), (34, 8), (38, 10), (37, 17), (37, 27), (34, 22), (31, 17), (28, 21), (26, 14)]), MARROM, 18, faixa=3))
    a(Peca('asa_e', ('poli', [(8, 18), (14, 20), (14, 30), (12, 36), (6, 38), (4, 31), (6, 24)]), MARROM, 17))
    a(Peca('asa_d', ('poli', [(40, 18), (34, 20), (34, 30), (36, 36), (42, 38), (44, 31), (42, 24)]), MARROM, 17))
    # --- a mecha vermelha: três mechas em leque, saindo do repartido para baixo e para a esquerda
    a(Peca('mecha1', ('poli', [(12, 8), (17, 5), (19, 7), (17, 16), (13, 25), (9, 33), (6, 37), (5, 31), (8, 22), (10, 14)]), VERM, 19, faixa=1))
    a(Peca('mecha2', ('poli', [(18, 6), (22, 6), (22, 14), (19, 21), (16, 27), (16, 21), (18, 14)]), VERM, 20, faixa=0))
    a(Peca('mecha3', ('poli', [(35, 9), (37, 11), (38, 19), (36, 25), (35, 17)]), VERM, 19, faixa=0))
    a(Peca('brinco', ('elipse', 36.5, 31, 1.6, 2.8), OURO, 21))
    return P


def pt(p, x, y, cor):
    if 0 <= x < W and 0 <= y < H and p[x, y][3]:
        p[x, y] = cor + (255,)


def traco(p, pts, cor):
    """uma linha de 1 px pelos pontos (Bresenham), só em cima de pixel que já existe."""
    for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
        dx, dy = abs(x1 - x0), -abs(y1 - y0)
        sx, sy = (1 if x0 < x1 else -1), (1 if y0 < y1 else -1)
        err = dx + dy
        while True:
            pt(p, x0, y0, cor)
            if (x0, y0) == (x1, y1):
                break
            e2 = 2 * err
            if e2 >= dy:
                err += dy
                x0 += sx
            if e2 <= dx:
                err += dx
                y0 += sy


def acabamento(im):
    im = im.copy()
    p = im.load()
    OLHO, IRIS, IRIS2 = c('#2a1216'), c('#b0303a'), c('#6e1620')
    BOCA, BOCHECHA, SOB = c('#c87c6c'), c('#f2988a'), c('#42281a')
    M_LUZ, M_ESC = c('#94694a'), c('#2e1a10')
    R_LUZ, R_ESC = c('#ff7a58'), c('#7a0e16')
    J_LUZ, J_ESC = c('#5c5a6a'), c('#0e0d12')
    # os fios de luz e as linhas escuras do cabelo marrom (saindo do repartido, descendo para as pontas)
    for pts in ([(27, 6), (30, 9), (34, 14)], [(29, 5), (33, 7), (37, 12)], [(25, 7), (26, 11), (28, 15)],
                [(36, 18), (37, 24)], [(41, 22), (42, 28)], [(8, 22), (6, 28)], [(15, 8), (13, 12)]):
        traco(p, pts, M_LUZ)
    for pts in ([(30, 11), (33, 16)], [(34, 19), (35, 25)], [(25, 14), (23, 18)], [(40, 24), (40, 30)]):
        traco(p, pts, M_ESC)
    # a mecha vermelha: a luz no alto de cada mecha e a linha escura entre elas
    for pts in ([(14, 8), (12, 15), (10, 22)], [(19, 7), (19, 13)], [(36, 12), (36, 18)]):
        traco(p, pts, R_LUZ)
    for pts in ([(18, 8), (17, 14), (14, 22)], [(21, 12), (19, 19)]):
        traco(p, pts, R_ESC)
    # a jaqueta: o bolso, o zíper (a borda clara) e a costura do ombro
    for pts in ([(12, 51), (17, 51), (17, 56)], [(12, 51), (12, 56)]):
        traco(p, pts, J_ESC)
    traco(p, [(12, 52), (16, 52)], J_LUZ)
    traco(p, [(19, 42), (19, 60)], J_LUZ)
    traco(p, [(29, 42), (29, 60)], J_ESC)
    # o joelho rasgado, o cadarço e a sola das botas, o pano
    for (x, y) in ((14, 74), (15, 74), (16, 74), (15, 75), (16, 75), (30, 71), (31, 71), (32, 71), (31, 72), (32, 72)):
        pt(p, x, y, c('#e8b496'))
    for (x, y) in ((13, 85), (16, 85), (19, 85), (14, 87), (17, 87), (28, 85), (31, 85), (34, 85), (29, 87), (32, 87)):
        pt(p, x, y, c('#d8b878'))
    traco(p, [(8, 93), (23, 93)], c('#140a06'))
    traco(p, [(25, 93), (40, 93)], c('#140a06'))
    traco(p, [(12, 61), (16, 59)], c('#d2ac6e'))
    # o rosto: olhos pequenos (2 x 2), a sobrancelha brava, a bochecha, o risquinho da boca
    for (x, y) in ((18, 26), (28, 26)):
        p[x, y] = OLHO + (255,)
        p[x + 1, y] = OLHO + (255,)
        p[x, y + 1] = IRIS + (255,)
        p[x + 1, y + 1] = IRIS2 + (255,)
    for (x, y) in ((17, 24), (18, 24), (19, 25), (30, 24), (29, 24), (28, 25)):
        p[x, y] = SOB + (255,)
    for (x, y) in ((17, 29), (30, 29)):
        p[x, y] = BOCHECHA + (255,)
    for x in (23, 24, 25):
        p[x, 31] = BOCA + (255,)
    return im


if __name__ == '__main__':
    im, dono, ordem = renderizar(pecas(), W, H)
    im = acabamento(im)
    im.save(sys.argv[1] if len(sys.argv) > 1 else 'agata_frente.png')
    print('ok', im.size)
