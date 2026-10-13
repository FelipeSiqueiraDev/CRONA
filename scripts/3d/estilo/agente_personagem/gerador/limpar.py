"""
Limpa a folha que o gerador de imagem fez (pixel art "falsa": blocos de tamanho irregular, alfa macio, cores demais)
para pixel art de verdade: acha a grade, pega a cor do meio de cada bloco, alfa só 0 ou 255, paleta limitada,
separa os bonecos.

Uso: python3 limpar.py folha.png [px_x px_y off_x off_y] [cores]
"""
import sys, os
import numpy as np
from PIL import Image


def grade(a):
    """O passo e o começo da grade em x e em y (o que mais bate com as bordas das cores)."""
    g = a[..., :3].mean(2) * (a[..., 3] / 255)
    out = []
    for ax in (1, 0):
        d = np.abs(np.diff(g, axis=ax)).sum(1 - ax)
        best = (0, 0, 0)
        for p in np.arange(5.0, 12.01, 0.02):
            for off in np.arange(0, p, 0.25):
                idx = np.arange(off, len(d) - 1, p).astype(int)
                v = d[idx].mean()
                if v > best[0]:
                    best = (v, p, off)
        out.append(best[1:])
    return out


def reduzir(a, px, py, ox, oy):
    H, W = a.shape[:2]
    xs = np.arange(ox + px / 2, W - 1, px)
    ys = np.arange(oy + py / 2, H - 1, py)
    out = np.zeros((len(ys), len(xs), 4))
    for i, y in enumerate(ys):
        for j, x in enumerate(xs):
            y0, y1 = int(y - py * 0.25), int(y + py * 0.25) + 1
            x0, x1 = int(x - px * 0.25), int(x + px * 0.25) + 1
            blk = a[y0:y1, x0:x1].reshape(-1, 4)
            op = blk[blk[:, 3] > 127]
            if len(op) * 2 >= len(blk):
                out[i, j, :3] = np.median(op[:, :3], 0)
                out[i, j, 3] = 255
    return out


def paleta(n, cores):
    m = n[..., 3] > 0
    im = Image.fromarray(np.where(m[..., None], n[..., :3], 0).astype(np.uint8))
    q = im.quantize(cores, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).convert('RGB')
    o = n.copy()
    o[..., :3] = np.asarray(q)
    return o


def solto(n):
    """O pixel opaco sem vizinho opaco (ou o furo sem vizinho vazio) some."""
    a = n[..., 3] > 0
    v = np.zeros(a.shape, int)
    for dy, dx in ((0, 1), (1, 0), (0, -1), (-1, 0)):
        v += np.roll(np.roll(a, dy, 0), dx, 1)
    n[a & (v == 0), 3] = 0
    return n


def separar(n):
    """Os bonecos: as faixas de colunas com algo opaco."""
    col = (n[..., 3] > 0).any(0)
    bon, x = [], 0
    while x < len(col):
        if col[x]:
            x0 = x
            while x < len(col) and col[x]:
                x += 1
            if x - x0 > 4:
                bon.append((x0, x))
        x += 1
    return bon


if __name__ == '__main__':
    f = sys.argv[1]
    a = np.asarray(Image.open(f).convert('RGBA')).astype(float)
    if len(sys.argv) >= 6:
        px, py, ox, oy = map(float, sys.argv[2:6])
    else:
        (px, ox), (py, oy) = grade(a)
    cores = int(sys.argv[6]) if len(sys.argv) > 6 else 40
    print('grade', px, py, ox, oy)
    n = solto(paleta(reduzir(a, px, py, ox, oy), cores))
    base = os.path.splitext(f)[0]
    Image.fromarray(n.astype(np.uint8), 'RGBA').save(base + '_limpo.png')
    ys = np.nonzero((n[..., 3] > 0).any(1))[0]
    for k, (x0, x1) in enumerate(separar(n)):
        b = n[ys.min():ys.max() + 1, x0:x1]
        Image.fromarray(b.astype(np.uint8), 'RGBA').save(f'{base}_{k + 1}.png')
        print(k + 1, b.shape[1], 'x', b.shape[0])
