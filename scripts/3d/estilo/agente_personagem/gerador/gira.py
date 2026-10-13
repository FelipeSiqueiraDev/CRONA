"""O boneco girando no lugar (as 8 direções desenhadas), na cozinha de dia: um vídeo para conferir se são consistentes."""
import os, sys, subprocess
AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, AQUI)
import numpy as np


def pe_x(spr):
    """A âncora: o meio dos pés (a média dos pixels opacos das 6 linhas de baixo), não o meio da caixa."""
    a = spr[-6:, :, 3] > 0
    return int(round(np.nonzero(a)[1].mean()))

from PIL import Image
import cena

base, saida = sys.argv[1], sys.argv[2]
# a ordem da folha: 1 n, 2 ne, 3 e, 4 se, 5 s, 6 sw, 7 w, 8 nw; o giro no sentido do relógio a partir da frente
ordem = [5, 4, 3, 2, 1, 8, 7, 6]
bon = {n: cena.harmonizar(np.asarray(Image.open(f'{base}_{n}.png').convert('RGBA'))) for n in range(1, 9)}
dia, c = cena._cozinha(False)
from motor import tela, VISTA, KZ
P = c.mundoP
chao = (c.tipo == 1) & (c.nz > 0.6) & (c.obj >= 0)
x, y = 8.5 * 0.75, 3.5 * 0.75
d = np.hypot(P[..., 0] - x, P[..., 1] - y) - 0.15
ks = np.where(d <= 0, 0.74, np.where(d < 0.045, 0.8, np.where(d < 0.1, 0.87, np.where(d < 0.17, 0.94, 1.0))))
ks = np.where(chao, ks, 1.0)
fundo = dia * ks[..., None] + (1 - ks[..., None]) * np.array([14.0, 2.0, 12.0])
sx, sy = tela(np.array([x, y, 0.0]))
px, py = int(round(sx - c.x0)), int(round(sy - c.y0))
pasta = os.path.join(os.path.dirname(saida), 'gira_q')
os.makedirs(pasta, exist_ok=True)
for k, n in enumerate(ordem):
    img = fundo.copy()
    spr = bon[n]
    h, w = spr.shape[:2]
    x0, y0 = px - pe_x(spr), py - h + 2
    z = (py - (y0 + np.arange(h))) / KZ
    dprof = (np.array([x, y, 0.0]) @ VISTA) + z * VISTA[2] + 0.12
    fr = dprof[:, None] >= c.prof[y0:y0 + h, x0:x0 + w] - 0.01
    a = spr[..., 3:4] / 255.0 * fr[..., None]
    img[y0:y0 + h, x0:x0 + w] = img[y0:y0 + h, x0:x0 + w] * (1 - a) + spr[..., :3] * a
    im = Image.fromarray(np.clip(img, 0, 255).astype(np.uint8)).crop((px - 140, py - 150, px + 140, py + 50))
    im.resize((im.width * 3, im.height * 3), Image.NEAREST).save(os.path.join(pasta, f'q{k}.png'))
subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', '-framerate', '2', '-stream_loop', '3', '-i', os.path.join(pasta, 'q%d.png'),
                '-vf', 'format=yuv420p', '-c:v', 'libx264', '-r', '30', '-crf', '18', saida], check=True)
print('ok', saida)
