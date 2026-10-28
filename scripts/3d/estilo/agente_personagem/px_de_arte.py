"""
O personagem do tabuleiro em pixel art de verdade, a partir da arte dele (28/10, o Felipe: "quero os bonecos em pixel
art tal qual as referências, tal qual temos de artes do Códex"). Hoje o tabuleiro desenha a arte grande encolhida, com
cara de pintura; aqui ela vira pixel art 1:1 no tamanho do tabuleiro, como os chibis das referências
(F:\\Dhellow\\CRONA\\arte\\referencias-pixel\\): poucas cores, cachos de pixel limpos, contorno escuro de 1 px.

  1. reduz a pose para a altura do tabuleiro (a média de cada bloco, sem o borrado do Lanczos);
  2. alfa só 0 ou 255;
  3. a paleta curta: as cores parecidas viram uma só (cores por personagem, padrão 28);
  4. limpa o pixel solto (o que difere de todos os vizinhos vira o vizinho da maioria);
  5. o contorno: a borda de dentro da silhueta escurece na cor dela (o contorno colorido das referências).

Uso: python px_de_arte.py <pose.png> <saida.png> [altura=94] [cores=28]
"""
import sys

import numpy as np
from PIL import Image


def reduzir(im: Image.Image, alto: int) -> Image.Image:
    im = im.crop(im.getbbox())
    k = alto / im.height
    larg = max(1, round(im.width * k))
    a = np.asarray(im).astype(np.float64) / 255
    # pré-multiplica o alfa, faz a média por bloco (BOX) e desfaz
    pm = a.copy()
    pm[..., :3] *= pm[..., 3:4]
    peq = np.asarray(Image.fromarray((pm * 255).astype(np.uint8), 'RGBA').resize((larg, alto), Image.BOX)).astype(np.float64) / 255
    al = peq[..., 3:4]
    cor = np.where(al > 0, peq[..., :3] / np.maximum(al, 1e-6), 0)
    out = np.concatenate([np.clip(cor, 0, 1), (al > 0.5).astype(np.float64)], axis=2)
    return Image.fromarray((out * 255).astype(np.uint8), 'RGBA')


def pele(a: np.ndarray) -> np.ndarray:
    """Os pixels de pele (o laranja-claro, pouco saturado e claro): ganham paleta própria, para o rubor do rosto não
    virar o vermelho do cabelo e da roupa."""
    rgb = a[..., :3].astype(np.float64) / 255
    mx, mn = rgb.max(-1), rgb.min(-1)
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    sat = np.where(mx > 0, (mx - mn) / np.maximum(mx, 1e-6), 0)
    return (a[..., 3] > 0) & (r >= g) & (g >= b * 0.95) & (mx > 0.55) & (sat > 0.18) & (sat < 0.62) & (g > r * 0.62)


def paleta(im: Image.Image, n: int, n_pele: int = 5) -> Image.Image:
    a = np.asarray(im).copy()
    cheio = a[..., 3] > 0
    mp = pele(a)
    for mask, k in ((cheio & ~mp, n), (mp, n_pele)):
        if not mask.any():
            continue
        lista = a[mask][:, :3]
        q = Image.fromarray(lista[None, :, :]).quantize(colors=min(k, len(lista)), method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).convert('RGB')
        a[mask, :3] = np.asarray(q)[0]
    a[~cheio, :3] = 0
    return Image.fromarray(a, 'RGBA')


def limpar(im: Image.Image, voltas: int = 2) -> Image.Image:
    a = np.asarray(im).copy()
    h, w = a.shape[:2]
    for _ in range(voltas):
        b = a.copy()
        for y in range(h):
            for x in range(w):
                if a[y, x, 3] == 0:
                    continue
                viz = [tuple(a[y + dy, x + dx]) for dy, dx in ((0, 1), (1, 0), (0, -1), (-1, 0)) if 0 <= y + dy < h and 0 <= x + dx < w and a[y + dy, x + dx, 3]]
                if len(viz) >= 3 and tuple(a[y, x]) not in viz:
                    cont = {}
                    for v in viz:
                        cont[v] = cont.get(v, 0) + 1
                    v, n = max(cont.items(), key=lambda kv: kv[1])
                    if n >= 2:
                        b[y, x] = v
        a = b
    return Image.fromarray(a, 'RGBA')


def contorno(im: Image.Image, forca: float = 0.38) -> Image.Image:
    a = np.asarray(im).copy()
    cheio = a[..., 3] > 0
    borda = np.zeros_like(cheio)
    for dy, dx in ((0, 1), (1, 0), (0, -1), (-1, 0)):
        viz = np.zeros_like(cheio)
        ys = slice(max(0, dy), cheio.shape[0] + min(0, dy))
        yd = slice(max(0, -dy), cheio.shape[0] + min(0, -dy))
        xs = slice(max(0, dx), cheio.shape[1] + min(0, dx))
        xd = slice(max(0, -dx), cheio.shape[1] + min(0, -dx))
        viz[yd, xd] = cheio[ys, xs]
        borda |= cheio & ~viz
    escuro = (a[..., :3].astype(np.float64) * forca + np.array([14, 8, 10]) * (1 - forca)).astype(np.uint8)
    a[..., :3] = np.where(borda[..., None], escuro, a[..., :3])
    return Image.fromarray(a, 'RGBA')


if __name__ == '__main__':
    ent, sai = sys.argv[1], sys.argv[2]
    alto = int(sys.argv[3]) if len(sys.argv) > 3 else 94
    n = int(sys.argv[4]) if len(sys.argv) > 4 else 28
    im = Image.open(ent).convert('RGBA')
    px = contorno(limpar(paleta(reduzir(im, alto), n)))
    px.save(sai)
    print('ok', px.size)
