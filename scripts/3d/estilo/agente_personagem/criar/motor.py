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
    """Cinco tons, do mais escuro ao brilho: sombra2, sombra, base, luz, brilho; linha = o contorno. Os tons de luz e de
    sombra mudam de matiz (a luz esquenta, a sombra esfria), como na pixel art de verdade."""
    def __init__(self, sombra2, sombra, base, luz, linha=None, brilho=None):
        self.cores = [c(sombra2), c(sombra), c(base), c(luz)]
        self.brilho = c(brilho) if brilho else tuple(min(255, int(v * 1.12 + 18)) for v in c(luz))
        self.linha = c(linha) if linha else tuple(int(v * 0.32) for v in c(sombra2))
        self.tons = [c(sombra2), c(sombra), c(base), c(luz), self.brilho]


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


LUZ = np.array([-0.55, -0.62, 0.56])
LUZ = LUZ / np.linalg.norm(LUZ)


def tons_por_volume(m, p):
    """O tom (0 a 4) de cada pixel da peça: a peça é um relevo (a máscara borrada), a normal sai do gradiente e o tom é
    a luz de cima e da esquerda em degraus. `faixa` = o quanto a peça é redonda (o borrão, em px; 0 usa o tamanho da peça)."""
    from scipy.ndimage import gaussian_filter
    ys, xs = np.nonzero(m)
    tam = max(xs.max() - xs.min(), ys.max() - ys.min()) + 1
    sig = p.faixa if p.faixa else max(1.2, tam / 7.0)
    h = gaussian_filter(m.astype(np.float64), sig, mode='constant')
    gy, gx = np.gradient(h)
    esc = 5.5 * sig                       # quanto mais borrado, mais a normal tomba na borda
    n = np.stack([-gx * esc, -gy * esc, np.ones_like(h)], -1)
    n /= np.linalg.norm(n, axis=-1, keepdims=True)
    lum = n @ LUZ
    lum = (lum - 0.5) * 1.6 + 0.5
    t = np.digitize(lum, [0.18, 0.42, 0.66, 0.86])
    return np.where(m, t, 0)


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
            tom = tons_por_volume(m, p)
            for t in range(5):
                col[m & (tom == t)] = p.mat.tons[t]
        img[m] = col[m]
        dono[m] = i
        cam[m] = p.camada
    # a sombra de contato: a peça de trás escurece 1 tom até 2 px da borda de uma peça da frente (à direita e embaixo dela)
    from scipy.ndimage import binary_dilation
    for i, p in enumerate(ordem):
        if not p.volume:
            continue
        frente = np.zeros((H, W), bool)
        for j, q in enumerate(ordem):
            if q.camada > p.camada:
                frente |= masks[j]
        proj = desloca(binary_dilation(frente, iterations=1), 1, 1) & masks[i] & ~frente
        tt = tons_por_volume(masks[i], p)
        for y, x in zip(*np.nonzero(proj)):
            img[y, x] = p.mat.tons[max(0, min(tt[y, x], 3) - 1)]
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
