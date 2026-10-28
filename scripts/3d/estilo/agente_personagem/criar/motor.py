"""
Desenhar o personagem do zero em pixel art (28/10, o Felipe: "você tá copiando demais o desenho que já existe; crie a sua
versão"). O método dos tutoriais das referências: forma, linha, volume, acabamento.

  - a FORMA: cada peça do personagem é um polígono (ou elipse) em coordenadas de pixel, com um material;
  - o VOLUME: cada peça ganha a luz (a borda de cima e da esquerda) e a sombra (a de baixo e da direita), pelo próprio
    formato da peça, mais uma faixa de sombra nas peças grandes;
  - a LINHA: o contorno escuro por fora e entre as peças (do lado da peça de trás);
  - o ACABAMENTO: pixels e traços à mão (olhos, fios de cabelo, ziper...), por cima.

Nada de filtro nem de redução de imagem: cada pixel sai de uma conta de forma ou de uma decisão.
"""
import numpy as np
from PIL import Image, ImageDraw

SS = 8   # supersampling só para decidir de que lado da borda cada pixel cai (a saída não tem meio-tom)


def c(h):
    return tuple(int(h[i:i + 2], 16) for i in (1, 3, 5))


class Material:
    """sombra2 (a mais escura), sombra, base, luz, linha (o contorno)."""
    def __init__(self, sombra2, sombra, base, luz, linha=None):
        self.cores = [c(sombra2), c(sombra), c(base), c(luz)]
        self.linha = c(linha) if linha else tuple(int(v * 0.35) for v in c(sombra2))


class Peca:
    def __init__(self, nome, forma, mat, camada, volume=True, faixa=0, luz=True):
        self.nome, self.forma, self.mat, self.camada = nome, forma, mat, camada
        self.volume, self.faixa, self.luz = volume, faixa, luz


def mascara(forma, W, H):
    """forma: ('poli', [(x,y)...]) | ('elipse', cx, cy, rx, ry) | ('ret', x0,y0,x1,y1). Máscara booleana de pixel (centro do pixel dentro)."""
    big = Image.new('L', (W * SS, H * SS), 0)
    d = ImageDraw.Draw(big)
    k = forma[0]
    if k == 'poli':
        d.polygon([(x * SS, y * SS) for x, y in forma[1]], fill=255)
    elif k == 'elipse':
        _, cx, cy, rx, ry = forma
        d.ellipse([(cx - rx) * SS, (cy - ry) * SS, (cx + rx) * SS, (cy + ry) * SS], fill=255)
    elif k == 'ret':
        _, x0, y0, x1, y1 = forma
        d.rectangle([x0 * SS, y0 * SS, x1 * SS - 1, y1 * SS - 1], fill=255)
    arr = np.asarray(big).reshape(H, SS, W, SS).mean(axis=(1, 3))
    return arr >= 127.5


def desloca(m, dx, dy):
    out = np.zeros_like(m)
    H, W = m.shape
    ys0, ys1 = max(0, dy), H + min(0, dy)
    xs0, xs1 = max(0, dx), W + min(0, dx)
    out[ys0:ys1, xs0:xs1] = m[ys0 - dy:ys1 - dy, xs0 - dx:xs1 - dx]
    return out


def renderizar(pecas, W, H, contorno=True):
    ordem = sorted(pecas, key=lambda p: p.camada)
    img = np.zeros((H, W, 3), np.uint8)
    dono = np.full((H, W), -1, int)
    cam = np.zeros((H, W), int)
    masks = []
    for i, p in enumerate(ordem):
        m = mascara(p.forma, W, H)
        masks.append(m)
        # as cores da peça: base + luz na borda de cima e da esquerda, sombra embaixo e à direita
        base, luz_, sombra, sombra2 = p.mat.cores[2], p.mat.cores[3], p.mat.cores[1], p.mat.cores[0]
        col = np.zeros((H, W, 3), np.uint8)
        col[:] = base
        if p.volume:
            sup = ~desloca(m, 1, 1)          # o vizinho de cima e da esquerda fora da peça: borda iluminada
            inf = ~desloca(m, -1, -1)        # o de baixo e da direita fora da peça: borda na sombra
            inf2 = ~desloca(m, -2, -2)
            if p.luz:
                col[m & sup] = luz_
            col[m & inf2] = sombra
            col[m & inf] = sombra2 if p.faixa == 0 else sombra
            if p.faixa:
                # a faixa de sombra larga (as peças grandes: a jaqueta, a calça): tudo à direita de x = centro + faixa
                ys, xs = np.nonzero(m)
                cx = (xs.min() + xs.max()) / 2
                col[m & (np.arange(W)[None, :] > cx + p.faixa)] = sombra
                col[m & inf] = sombra2
        img[m] = col[m]
        dono[m] = i
        cam[m] = p.camada
    saida = np.zeros((H, W, 4), np.uint8)
    saida[..., :3] = img
    saida[..., 3] = (dono >= 0) * 255
    if contorno:
        for y in range(H):
            for x in range(W):
                i = dono[y, x]
                if i < 0:
                    continue
                for dy, dx in ((0, 1), (1, 0), (0, -1), (-1, 0)):
                    yy, xx = y + dy, x + dx
                    j = dono[yy, xx] if 0 <= yy < H and 0 <= xx < W else -1
                    if j < 0 or (j != i and ordem[j].camada > ordem[i].camada):
                        saida[y, x, :3] = ordem[i].mat.linha
                        break
    return Image.fromarray(saida, 'RGBA'), dono, ordem
