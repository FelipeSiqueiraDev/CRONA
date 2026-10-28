"""
A arte do personagem em pixel art de verdade (28/10, v2), do jeito dos artistas das referências: primeiro simplificar,
depois reduzir. Antes (px_de_arte.py) a pintura era reduzida e depois limpa, e saía suja.

  1. suaviza a textura da pintura sem borrar as bordas (bilateral);
  2. paleta curta no espaço Lab (k-means), uma paleta só para todas as poses do personagem (mesmas cores em tudo);
  3. a imagem inteira vira essas cores ANTES de reduzir;
  4. reduz por bloco: a cor que mais aparece, com um empurrão para as linhas escuras e os brilhos (não se perdem);
  5. limpa o pixel solto e os degraus de 1 px; contorno escuro de 1 px por fora.

Uso: python px2.py <personagem> <saida_dir> [altura=94] [cores=16]
"""
import os
import sys

import numpy as np
from PIL import Image
from scipy.cluster.vq import kmeans2
from scipy.ndimage import median_filter
from skimage import color
from skimage.restoration import denoise_bilateral

ARTE = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', '..', '..', 'client', 'public', 'arte', 'personagens')
DIRS = ['s', 'se', 'e', 'ne', 'n', 'nw', 'w', 'sw']


def abrir(png, bloco):
    im = Image.open(png).convert('RGBA')
    im = im.crop(im.getbbox())
    w, h = im.size
    W, H = -(-w // bloco) * bloco, -(-h // bloco) * bloco
    tela = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    tela.paste(im, ((W - w) // 2, H - h))          # centrado, os pés no chão
    return np.asarray(tela)


def suavizar(a, sigma_cor=0.06, sigma_esp=2.0):
    rgb = a[..., :3].astype(np.float64) / 255
    out = denoise_bilateral(rgb, sigma_color=sigma_cor, sigma_spatial=sigma_esp, channel_axis=-1)
    r = a.copy()
    r[..., :3] = np.clip(out * 255, 0, 255).astype(np.uint8)
    return r


def paleta_de(imagens, n, amostra=60000, seed=7):
    lab = []
    for a in imagens:
        m = a[..., 3] > 128
        lab.append(color.rgb2lab(a[..., :3][m][None].astype(np.float64) / 255)[0])
    lab = np.concatenate(lab)
    rng = np.random.default_rng(seed)
    if len(lab) > amostra:
        lab = lab[rng.choice(len(lab), amostra, replace=False)]
    cent, _ = kmeans2(lab, n, minit='++', seed=seed)
    # tira o centro sem ninguém e ordena do escuro para o claro
    cent = cent[np.argsort(cent[:, 0])]
    return cent


def indices(a, cent):
    m = a[..., 3] > 128
    lab = color.rgb2lab(a[..., :3].astype(np.float64) / 255)
    d = ((lab[..., None, :] - cent[None, None, :, :]) ** 2).sum(-1)
    idx = d.argmin(-1)
    idx[~m] = -1
    return idx


def reduzir(idx, a, cent, bloco, viés_escuro=1.7, viés_claro=1.4):
    H, W = idx.shape
    h, w = H // bloco, W // bloco
    n = len(cent)
    L = cent[:, 0]
    escuro = L <= np.percentile(L, 14)
    claro = L >= np.percentile(L, 90)
    # as cores de acento: bem saturadas e raras na imagem
    c = np.hypot(cent[:, 1], cent[:, 2])
    freq = np.bincount(idx[idx >= 0], minlength=n) / max(1, (idx >= 0).sum())
    acento = (c > 38) & (freq < 0.035) & ~escuro
    peso = np.ones(n)
    peso[escuro] = viés_escuro
    peso[claro] = viés_claro
    out = np.full((h, w), -1, int)
    for by in range(h):
        for bx in range(w):
            b = idx[by * bloco:(by + 1) * bloco, bx * bloco:(bx + 1) * bloco]
            op = b >= 0
            if op.sum() < bloco * bloco * 0.5:
                continue
            cont = np.bincount(b[op], minlength=n)
            win = (cont * peso).argmax()
            # o detalhe pequeno e escuro (o olho, a sobrancelha, a boca) vence quando ocupa um quarto do bloco
            if not escuro[win] and cont[escuro].sum() >= 0.22 * op.sum():
                win = np.where(escuro, cont, -1).argmax()
            # o brilho e o acento pequeno e colorido (o brinco de ouro) também
            elif not claro[win] and not acento[win] and cont[acento].sum() >= 0.3 * op.sum():
                win = np.where(acento, cont, -1).argmax()
            out[by, bx] = win
    # segunda passada: dentro da pele (o rosto), um pouco de escuro já é olho, sobrancelha ou boca
    pele = (cent[:, 0] > 55) & (cent[:, 1] > 4) & (cent[:, 2] > 10) & (cent[:, 2] < 45)
    novo = out.copy()
    for by in range(1, h - 1):
        for bx in range(1, w - 1):
            if out[by, bx] < 0 or escuro[out[by, bx]]:
                continue
            viz = out[by - 1:by + 2, bx - 1:bx + 2].ravel()
            if (pele[viz[viz >= 0]]).sum() < 5:
                continue
            b = idx[by * bloco:(by + 1) * bloco, bx * bloco:(bx + 1) * bloco]
            op = b >= 0
            cont = np.bincount(b[op], minlength=n)
            if cont[escuro].sum() >= 0.11 * op.sum():
                novo[by, bx] = np.where(escuro, cont, -1).argmax()
    return novo


def limpar(idx, voltas=2):
    h, w = idx.shape
    for _ in range(voltas):
        novo = idx.copy()
        for y in range(h):
            for x in range(w):
                c = idx[y, x]
                if c < 0:
                    continue
                viz = [idx[y + dy, x + dx] if 0 <= y + dy < h and 0 <= x + dx < w else -1 for dy, dx in ((-1, 0), (1, 0), (0, -1), (0, 1))]
                if c not in viz:
                    ops = [v for v in viz if v >= 0]
                    if len(ops) >= 3:
                        cont = np.bincount(ops)
                        if cont.max() >= 2:
                            novo[y, x] = cont.argmax()
        idx = novo
    return idx


def montar(idx, cent, contorno=0.45):
    rgb = (np.clip(color.lab2rgb(cent[None]), 0, 1)[0] * 255).astype(np.uint8)
    h, w = idx.shape
    img = np.zeros((h, w, 4), np.uint8)
    m = idx >= 0
    img[m, :3] = rgb[idx[m]]
    img[m, 3] = 255
    # o contorno por fora: o pixel de borda escurece (na cor dele, não preto chapado)
    borda = np.zeros_like(m)
    for dy, dx in ((0, 1), (1, 0), (0, -1), (-1, 0)):
        viz = np.zeros_like(m)
        viz[max(0, -dy):h - max(0, dy), max(0, -dx):w - max(0, dx)] = m[max(0, dy):h - max(0, -dy) if dy else h, max(0, dx):w - max(0, -dx) if dx else w][:h - abs(dy), :w - abs(dx)] if False else False
    pad = np.pad(m, 1)
    viz4 = [pad[0:h, 1:w + 1], pad[2:h + 2, 1:w + 1], pad[1:h + 1, 0:w], pad[1:h + 1, 2:w + 2]]
    borda = m & ~(viz4[0] & viz4[1] & viz4[2] & viz4[3])
    escuro = np.array([20, 12, 14], np.float64)
    img[borda, :3] = (img[borda, :3] * contorno + escuro * (1 - contorno)).astype(np.uint8)
    return Image.fromarray(img, 'RGBA')


def converter(imagens_png, alto=94, n=16, bloco=None):
    bloco = bloco or max(1, round(469 / alto))
    arts = [suavizar(abrir(p, bloco)) for p in imagens_png]
    cent = paleta_de(arts, n)
    saidas = []
    for a in arts:
        idx = limpar(reduzir(indices(a, cent), a, cent, bloco))
        saidas.append(montar(idx, cent))
    return saidas


if __name__ == '__main__':
    nome, saida = sys.argv[1], sys.argv[2]
    alto = int(sys.argv[3]) if len(sys.argv) > 3 else 94
    n = int(sys.argv[4]) if len(sys.argv) > 4 else 16
    os.makedirs(saida, exist_ok=True)
    pngs = [os.path.join(ARTE, nome, 'tabuleiro-32bits', 'idle-desarmado-%s.png' % k) for k in DIRS]
    for k, im in zip(DIRS, converter(pngs, alto, n)):
        im.save(os.path.join(saida, '%s.png' % k))
    print('ok', len(DIRS))
