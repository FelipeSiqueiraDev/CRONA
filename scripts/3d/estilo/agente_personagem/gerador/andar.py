"""
O andar do gerador: limpa uma folha do andar (2 linhas = 2 direções, 6 quadros) para o pixel do mapa e monta o
vídeo do boneco andando na cozinha.

A escala é a mesma para todos os quadros de uma linha (o passo do pixel sai da altura do quadro mais alto, os dois
pés no chão, para dar 90 px), e todos são cortados na mesma janela de cima a baixo: o pé que sobe deixa vazio
embaixo, o corpo que sobe e desce fica onde o gerador pôs. A âncora de cada quadro é o meio do tronco (as pernas
balançam, o tronco fica no lugar).

Uso: python3 andar.py folha.png dir1 dir2 saida.mp4
"""
import os
import subprocess
import sys

AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, AQUI)
import numpy as np                  # noqa: E402
from PIL import Image               # noqa: E402
import limpar                       # noqa: E402
import cena                         # noqa: E402

ALTURA = 90
CASA = 0.75
DIRS = {'se': (1, 0), 's': (1, 1), 'sw': (0, 1), 'w': (-1, 1), 'nw': (-1, 0), 'n': (-1, -1), 'ne': (0, -1), 'e': (1, -1)}


def limpar_folha(f):
    A = np.asarray(Image.open(f).convert('RGBA')).astype(float)
    op = A[..., 3] > 127
    linhas = []
    for (r0, r1) in limpar._faixas(op.any(1), 10):
        cols = limpar._faixas(op[r0:r1].any(0), 15)
        tops, bases = [], []
        for (c0, c1) in cols:
            ys = np.nonzero(op[r0:r1, c0:c1].any(1))[0]
            tops.append(r0 + ys.min()); bases.append(r0 + ys.max())
        top, base = min(tops), max(bases)
        p = (base - top + 1) / ALTURA
        cy = np.round(top + np.arange(ALTURA + 1) * p).astype(int)
        quadros = []
        for (c0, c1) in cols:
            sub = A[:, max(0, c0 - 6):c1 + 6].copy()
            sub[:top, :, 3] = 0
            sub[base + 1:, :, 3] = 0
            larg = sub.shape[1]
            nx = int(np.ceil(larg / p))
            cx = np.round((larg - nx * p) / 2 + np.arange(nx + 1) * p).astype(int).clip(0, larg)
            n = limpar.solto(limpar.paleta(limpar._por_cortes(sub, cx, cy), 128))
            xs = np.nonzero((n[..., 3] > 0).any(0))[0]
            n = n[:, xs.min():xs.max() + 1]
            quadros.append(cena.harmonizar(n))
        linhas.append(quadros)
    return linhas


def ancora(q):
    """O meio do tronco (as linhas de 40% a 60% da altura)."""
    a = q[int(ALTURA * 0.4):int(ALTURA * 0.6), :, 3] > 0
    return int(round(np.nonzero(a)[1].mean()))


def video(linhas, dirs, rotas, saida, por_casa=6, fps=10):
    from motor import tela, VISTA, KZ
    dia, c = cena._cozinha(False)
    P = c.mundoP
    chao = (c.tipo == 1) & (c.nz > 0.6) & (c.obj >= 0)
    pasta = saida + '_q'
    os.makedirs(pasta, exist_ok=True)
    k = 0
    for quadros, d, (a, b) in zip(linhas, dirs, rotas):
        a, b = np.array(a, float), np.array(b, float)
        dist = np.abs(b - a).max()
        n = int(round(dist * por_casa))
        for i in range(n + 1):
            casa = a + (b - a) * (i / max(n, 1))
            x, y = (casa + 0.5) * CASA
            q = quadros[i % len(quadros)]
            img = dia.copy()
            dd = np.hypot(P[..., 0] - x, P[..., 1] - y) - 0.15
            ks = np.where(dd <= 0, 0.74, np.where(dd < 0.045, 0.8, np.where(dd < 0.1, 0.87, np.where(dd < 0.17, 0.94, 1.0))))
            ks = np.where(chao, ks, 1.0)
            img = img * ks[..., None] + (1 - ks[..., None]) * np.array([14.0, 2.0, 12.0])
            sx, sy = tela(np.array([x, y, 0.0]))
            px, py = int(round(sx - c.x0)), int(round(sy - c.y0))
            h, w = q.shape[:2]
            x0, y0 = px - ancora(q), py - h + 2
            z = (py - (y0 + np.arange(h))) / KZ
            dprof = (np.array([x, y, 0.0]) @ VISTA) + z * VISTA[2] + 0.12
            fr = dprof[:, None] >= c.prof[y0:y0 + h, x0:x0 + w] - 0.01
            al = q[..., 3:4] / 255.0 * fr[..., None]
            img[y0:y0 + h, x0:x0 + w] = img[y0:y0 + h, x0:x0 + w] * (1 - al) + q[..., :3] * al
            im = Image.fromarray(np.clip(img, 0, 255).astype(np.uint8))
            im.resize((im.width * 2, im.height * 2), Image.NEAREST).save(os.path.join(pasta, f'q{k:04d}.png'))
            k += 1
    subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', '-framerate', str(fps), '-i', os.path.join(pasta, 'q%04d.png'),
                    '-vf', 'format=yuv420p', '-c:v', 'libx264', '-r', '30', '-crf', '18', saida], check=True)
    subprocess.run(['rm', '-rf', pasta])


def folha_x(linhas, saida, k=6):
    """Os quadros limpos lado a lado, ampliados."""
    W = max(sum(q.shape[1] + 6 for q in l) for l in linhas)
    H = ALTURA * len(linhas) + 6 * len(linhas)
    m = Image.new('RGBA', (W, H), (205, 200, 190, 255))
    for r, l in enumerate(linhas):
        x = 0
        for q in l:
            m.alpha_composite(Image.fromarray(q.astype(np.uint8), 'RGBA'), (x, r * (ALTURA + 6)))
            x += q.shape[1] + 6
    m.convert('RGB').resize((W * k, H * k), Image.NEAREST).save(saida)


if __name__ == '__main__':
    f, d1, d2, saida = sys.argv[1:5]
    linhas = limpar_folha(f)
    base = os.path.splitext(f)[0]
    for r, d in enumerate((d1, d2)):
        for i, q in enumerate(linhas[r]):
            Image.fromarray(q.astype(np.uint8), 'RGBA').save(f'{base}_{d}_{i}.png')
    folha_x(linhas, saida.replace('.mp4', '_folha.png'))
    # as rotas (casas): cada direção anda umas casas no sentido dela, por casas livres da cozinha
    rotas = {'n': ((9, 5), (8, 4)), 'ne': ((8, 5), (8, 1)), 'e': ((2, 2), (6, -2)), 'se': ((2, 1), (6, 1)),
             's': ((8, 1), (9, 2)), 'sw': ((8, 1), (8, 5)), 'w': ((6, 1), (2, 5)), 'nw': ((6, 1), (2, 1))}
    video(linhas, (d1, d2), (rotas[d1], rotas[d2]), saida)
    print('ok', saida)
