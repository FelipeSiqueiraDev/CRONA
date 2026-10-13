"""A Alosi de frente (virada para a câmera): a referência de qualidade antes das outras direções."""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import numpy as np
from PIL import Image
from chibi import Sprite, ampliar, RAMPA

W, H = 36, 46
C = 18.0


def montar():
    s = Sprite(W, H)
    # ---- de trás para a frente
    # o capuz embolado atrás do pescoço
    s.elipse(C, 25.2, 8.5, 2.8, 'jaqueta', 'capuz', 1)
    # as pernas e as botas
    s.capsula((C - 2.6, 36), (C - 2.8, 41.5), 2.4, 2.2, 'calca', 'perna_e', 2)
    s.capsula((C + 2.6, 36), (C + 2.8, 41.5), 2.4, 2.2, 'calca', 'perna_d', 2)
    s.elipse(C - 3.1, 43.2, 3.0, 1.9, 'bota', 'bota_e', 3)
    s.elipse(C + 3.1, 43.2, 3.0, 1.9, 'bota', 'bota_d', 3)
    # o tronco: a jaqueta, com os ombros redondos
    s.poli([(C - 7.5, 25.5), (C + 7.5, 25.5), (C + 7.2, 36.5), (C - 7.2, 36.5)], 'jaqueta', 'tronco', 4, n=(0.25, 0.1, 1), bojo=1.6)
    s.elipse(C - 6.5, 27.2, 3.0, 2.6, 'jaqueta', 'tronco', 4.1)
    s.elipse(C + 6.5, 27.2, 3.0, 2.6, 'jaqueta', 'tronco', 4.1)
    # a camisa no vão da jaqueta aberta e o cinto
    s.poli([(C - 2.6, 24.5), (C + 2.6, 24.5), (C + 3.2, 35.2), (C - 3.2, 35.2)], 'camisa', 'camisa', 5, bojo=0.5)
    s.poli([(C - 3.4, 34.2), (C + 3.4, 34.2), (C + 3.4, 35.6), (C - 3.4, 35.6)], 'cinto', 'camisa', 5.1)
    # a gola clerical
    s.poli([(C - 2.2, 23.6), (C + 2.2, 23.6), (C + 2.0, 25.6), (C - 2.0, 25.6)], 'camisa', 'gola', 5.5)
    # os braços (as mangas) e as mãos
    s.capsula((C - 7.6, 27.5), (C - 8.6, 34.0), 2.3, 2.0, 'jaqueta', 'braco_e', 6)
    s.capsula((C + 7.6, 27.5), (C + 8.6, 34.0), 2.3, 2.0, 'jaqueta', 'braco_d', 6)
    s.elipse(C - 8.7, 35.6, 1.7, 1.6, 'pele', 'mao_e', 6.5)
    s.elipse(C + 8.7, 35.6, 1.7, 1.6, 'pele', 'mao_d', 6.5)
    # o livro preso no cinto (do lado dele direito = esquerda da tela)
    s.poli([(C - 7.0, 35.0), (C - 4.4, 35.0), (C - 4.4, 39.2), (C - 7.0, 39.2)], 'livro', 'livro', 6.2, bojo=0.3)
    # ---- a cabeça
    # o cabelo de trás (as laterais descendo até o queixo)
    s.elipse(C - 8.6, 16.5, 3.4, 5.6, 'cabelo', 'cabelo_tras', 6.8)
    s.elipse(C + 8.6, 16.5, 3.4, 5.6, 'cabelo', 'cabelo_tras', 6.8)
    s.elipse(C, 12.0, 11.0, 9.6, 'cabelo', 'cabelo_tras', 6.8)
    # o pescoço, as orelhas e a cara
    s.poli([(C - 2.0, 20.5), (C + 2.0, 20.5), (C + 2.0, 24.0), (C - 2.0, 24.0)], 'pele', 'pescoco', 6.9)
    s.elipse(C - 7.4, 17.4, 1.6, 2.1, 'pele', 'orelha', 7.0)
    s.elipse(C + 7.4, 17.4, 1.6, 2.1, 'pele', 'orelha', 7.0)
    s.elipse(C, 16.6, 7.3, 6.4, 'pele', 'cara', 7.2)
    # a franja e as mechas da frente (bagunçadas, caindo para o lado esquerdo da tela)
    for (cx, cy, rx, ry) in ((C - 6.5, 10.5, 4.6, 3.6), (C - 1.5, 9.4, 5.0, 3.4), (C + 4.0, 9.8, 4.8, 3.6),
                             (C + 7.6, 11.6, 3.4, 3.6)):
        k = len(s.partes)
        s.elipse(cx, cy, rx, ry, 'cabelo', f'cabelo_m{k}', 8 + 0.01 * k)
    # as pontas da franja descendo na testa
    for pts in (
        [(C - 7.5, 11.0), (C - 3.5, 11.0), (C - 6.2, 15.0)],
        [(C - 4.0, 11.0), (C + 0.5, 11.0), (C - 2.6, 14.2)],
        [(C - 0.5, 11.0), (C + 4.0, 11.0), (C + 1.2, 13.6)],
        [(C + 3.5, 11.0), (C + 8.0, 11.0), (C + 6.0, 14.6)],
        [(C + 7.0, 11.0), (C + 9.6, 11.5), (C + 8.6, 16.0)],
        [(C - 9.6, 11.5), (C - 6.8, 11.0), (C - 8.6, 16.6)],
    ):
        k = len(s.partes)
        s.poli(pts, 'cabelo', f'cabelo_p{k}', 8.5 + 0.01 * k, n=(0, -0.3, 1), bojo=0.6)
    # os tufos do alto (a silhueta bagunçada)
    for (cx, cy, rx, ry) in ((C - 7.5, 5.8, 2.6, 2.2), (C - 2.0, 3.6, 3.0, 2.4), (C + 4.0, 3.9, 3.0, 2.3),
                             (C + 8.6, 6.6, 2.4, 2.2)):
        k = len(s.partes)
        s.elipse(cx, cy, rx, ry, 'cabelo', f'cabelo_t{k}', 6.85 + 0.01 * k)
    s.sem_linha = {'pescoco'}
    img = s.pintar()
    rosto(s)
    return s


def rosto(s):
    olho, aro, brilho = '#1c1018', '#6a3220', '#ffffff'
    y = 17
    for ex in (14, 21):                 # o olho: 1 x 2, escuro, com o brilho no alto
        s.px(ex, y, olho); s.px(ex, y + 1, olho)
        s.px(ex + 1, y, olho); s.px(ex + 1, y + 1, olho)
        s.px(ex, y, brilho)
    # os óculos: o aro redondo em volta de cada olho e a ponte
    for cx in (14.5, 21.5):
        for (dx, dy) in ((-2, -1), (-2, 0), (-2, 1), (-1, -2), (0, -2), (1, -2), (2, -2), (3, -1), (3, 0), (3, 1),
                         (-1, 2), (0, 2), (1, 2), (2, 2)):
            pass
    for (x, y_) in [(12, 16), (12, 17), (12, 18), (13, 15), (14, 15), (15, 15), (16, 16), (16, 17), (16, 18),
                    (13, 19), (14, 19), (15, 19),
                    (19, 16), (19, 17), (19, 18), (20, 15), (21, 15), (22, 15), (23, 16), (23, 17), (23, 18),
                    (20, 19), (21, 19), (22, 19), (17, 17), (18, 17)]:
        s.px(x, y_, aro)
    for (x, y_) in ((15, 16), (22, 16)):
        s.px(x, y_, ('pele', 4))
    # a boca e a bochecha
    s.px(18, 21, ('pele', 1))
    s.px(12, 20, ('pele', 1)); s.px(23, 20, ('pele', 1))
    # a cruz na camisa
    for (x, y_, t) in ((18, 28, 4), (17, 29, 3), (18, 29, 3), (19, 29, 2), (18, 30, 2), (18, 31, 2)):
        s.px(x, y_, ('ouro', t))
    s.px(18, 35, ('ouro', 3)); s.px(17, 35, ('ouro', 4))


if __name__ == '__main__':
    s = montar()
    a = ampliar(s.img, 12)
    ref = Image.open('/tmp/claude-0/-home-user-CRONA/65db675f-ba05-5f24-a910-ad8d18d74f3d/scratchpad/ref/padre12.png')
    m = Image.new('RGB', (a.width + ref.width + 20, max(a.height, ref.height)), (205, 200, 190))
    m.paste(a, (0, 0)); m.paste(ref, (a.width + 20, 0))
    m.save(os.path.join(os.path.dirname(os.path.abspath(__file__)), os.environ.get('V', 'frente') + '.png'))
