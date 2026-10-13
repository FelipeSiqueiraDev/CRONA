"""
As 4 folhas do andar (2 direções cada) limpas juntas: os 48 quadros (8 direções x 6), a folha de conferência, o vídeo
das 8 direções andando no lugar lado a lado (para ver se batem) e o vídeo andando pela cozinha.

Uso: python3 andar8.py <pasta de saída>
"""
import os
import subprocess
import sys

AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, AQUI)
import numpy as np                  # noqa: E402
from PIL import Image               # noqa: E402
import andar                        # noqa: E402

FOLHAS = [('andar_1_n_ne.png', 'n', 'ne'), ('andar_2_e_se.png', 'e', 'se'),
          ('andar_3_s_sw.png', 's', 'sw'), ('andar_4_w_nw.png', 'w', 'nw')]
ORDEM = ['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw']


def tudo():
    Q = {}
    for f, d1, d2 in FOLHAS:
        L = andar.limpar_folha(os.path.join(AQUI, f))
        Q[d1], Q[d2] = L[0], L[1]
    # o gerador fechou os olhos num quadro da frente (piscar no meio do passo): os olhos voltam do quadro anterior
    Q['s'][4] = olhos_de(Q['s'][4], Q['s'][3])
    for d, qs in Q.items():
        for i, q in enumerate(qs):
            Image.fromarray(q.astype(np.uint8), 'RGBA').save(os.path.join(AQUI, 'andar8', f'andar-{d}-{i}.png'))
    return Q


def olhos_de(q, fonte, y0=27, y1=35):
    """Copia a faixa dos olhos (linhas y0..y1) de `fonte` para `q`, alinhando pelo meio do tronco."""
    q = q.copy()
    dx = andar.ancora(fonte) - andar.ancora(q)
    for y in range(y0, y1):
        for x in range(q.shape[1]):
            xf = x + dx
            if 0 <= xf < fonte.shape[1] and q[y, x, 3] > 0 and fonte[y, xf, 3] > 0:
                q[y, x] = fonte[y, xf]
    return q


def folha(Q, saida, k=5):
    W = 50
    m = Image.new('RGBA', (W * 6, 94 * 8), (205, 200, 190, 255))
    for r, d in enumerate(ORDEM):
        for i, q in enumerate(Q[d]):
            ax = andar.ancora(q)
            m.alpha_composite(Image.fromarray(q.astype(np.uint8), 'RGBA'), (i * W + 25 - ax, r * 94 + 92 - q.shape[0]))
    m.convert('RGB').resize((m.width * k, m.height * k), Image.NEAREST).save(saida)


def no_lugar(Q, saida, k=5):
    pasta = saida + '_q'
    os.makedirs(pasta, exist_ok=True)
    W = 50
    for t in range(24):
        m = Image.new('RGBA', (W * 8, 98), (205, 200, 190, 255))
        for c, d in enumerate(ORDEM):
            q = Q[d][t % 6]
            m.alpha_composite(Image.fromarray(q.astype(np.uint8), 'RGBA'), (c * W + 25 - andar.ancora(q), 96 - q.shape[0]))
        m.convert('RGB').resize((m.width * k, m.height * k), Image.NEAREST).save(os.path.join(pasta, f'q{t:03d}.png'))
    subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', '-framerate', '10', '-i', os.path.join(pasta, 'q%03d.png'),
                    '-vf', 'format=yuv420p', '-c:v', 'libx264', '-r', '30', '-crf', '18', saida], check=True)
    subprocess.run(['rm', '-rf', pasta])


if __name__ == '__main__':
    out = sys.argv[1]
    os.makedirs(os.path.join(AQUI, 'andar8'), exist_ok=True)
    Q = tudo()
    folha(Q, os.path.join(out, 'andar8_folha.png'))
    no_lugar(Q, os.path.join(out, 'andar8_lugar.mp4'))
    # pela cozinha: uma volta passando pelas 8 direções (casas livres)
    # (a sala tem 10 x 6 casas: x 0..9, y 0..5)
    rotas = [('se', (2, 1), (6, 1)), ('s', (6, 1), (8, 3)), ('sw', (8, 3), (8, 5)), ('nw', (8, 5), (6, 5)),
             ('w', (9, 2), (7, 4)), ('e', (7, 4), (9, 2)), ('n', (9, 5), (8, 4)), ('ne', (8, 4), (8, 1))]
    andar.video([Q[d] for d, _, _ in rotas], [d for d, _, _ in rotas], [(a, b) for _, a, b in rotas],
                os.path.join(out, 'andar8_cozinha.mp4'))
    print('ok')
