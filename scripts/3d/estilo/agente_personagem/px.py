"""
Pixel art desenhado à mão, em código: o boneco é escrito como mapas de letras (uma letra = uma região: mecha de
cabelo, rosto, orelha, manga...). O código pinta cada região com a rampa do material dela, no jeito das referências
(sprites chibi de RPG): o tom base chapado, a faixa de sombra no lado de baixo/direita, o brilho fino no lado de
cima/esquerda (a luz vem de cima, da esquerda), o contorno escuro de 1 px por fora e a linha de dentro só onde uma
região passa na frente da outra. Os detalhes (olhos, óculos, boca, zíper, cruz) vão por cima, pixel a pixel.

    legenda = {'A': ('cabelo', 5), 's': ('pele', 2), ...}   # letra: (material, z)  z maior = na frente
    q = Quadro(w, h); q.mapa(texto, legenda, x, y); ...; img = q.pintar(detalhes)
"""
import numpy as np


def hx(h):
    h = h.lstrip('#')
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


# rampa: contorno, escuro, sombra, base, luz, brilho
RAMPAS = {
    'cabelo':  ['#1a0f0c', '#2e1a12', '#43271a', '#5c3922', '#7b5030', '#9c6a40'],
    'pele':    ['#4a2418', '#a05a40', '#c97b5a', '#e8a07a', '#f6be96', '#fbd6b4'],
    'jaqueta': ['#3a2f2a', '#8a7b6b', '#b3a48f', '#d6cab4', '#ebe2cf', '#f8f2e4'],
    'forro':   ['#3a2f2a', '#6f6152', '#8f7e6a', '#a89680', '#bba993', '#ccbca6'],
    'camisa':  ['#33313a', '#8a8896', '#aeacb8', '#d0cfd8', '#e9e8ee', '#f8f8fa'],
    'calca':   ['#0e0b10', '#19151c', '#241f28', '#322c37', '#433b48', '#544a58'],
    'bota':    ['#1a0f0a', '#38200f', '#52311a', '#6c4325', '#8a5732', '#a56c40'],
    'cinto':   ['#0c0909', '#171211', '#201918', '#2c2321', '#3a2f2c', '#4a3c38'],
    'livro':   ['#1e0c0a', '#4a1a14', '#6a261c', '#873325', '#a3452f', '#bb5a3c'],
    'ouro':    ['#3a2608', '#6b4a14', '#94681e', '#c0902f', '#e0b452', '#f5d77e'],
}
RAMPAS = {k: np.array([hx(c) for c in v], float) for k, v in RAMPAS.items()}
OL, ESC, SOM, BASE, LUZ, BRI = range(6)


def _tem(m, dy, dx):
    """m deslocado: _tem(m, dy, dx)[y, x] = m[y+dy, x+dx] (fora do quadro = False)."""
    h, w = m.shape
    o = np.zeros_like(m)
    ys0, ys1 = max(0, -dy), min(h, h - dy)
    xs0, xs1 = max(0, -dx), min(w, w - dx)
    o[ys0:ys1, xs0:xs1] = m[ys0 + dy:ys1 + dy, xs0 + dx:xs1 + dx]
    return o


class Quadro:
    def __init__(self, w, h):
        self.w, self.h = w, h
        self.reg = np.full((h, w), -1, int)      # o índice da região de cada pixel
        self.regs = []                           # (material, z, tipo)
        self._ids = {}

    def mapa(self, texto, legenda, x0=0, y0=0, espelho=False, chave=''):
        linhas = [l for l in texto.strip('\n').split('\n')]
        larg = max(len(l) for l in linhas)
        for i, l in enumerate(linhas):
            l = l.ljust(larg, '.')
            if espelho:
                l = l[::-1]
            for j, ch in enumerate(l):
                if ch in '. ' or ch not in legenda:
                    continue
                y, x = y0 + i, x0 + j
                if not (0 <= y < self.h and 0 <= x < self.w):
                    continue
                k = (chave, ch)
                if k not in self._ids:
                    mat, z = legenda[ch][:2]
                    tipo = legenda[ch][2] if len(legenda[ch]) > 2 else ''
                    self._ids[k] = len(self.regs)
                    self.regs.append((mat, z, tipo))
                self.reg[y, x] = self._ids[k]

    def pintar(self):
        h, w = self.h, self.w
        cor = np.zeros((h, w, 3))
        alfa = self.reg >= 0
        nivel = np.full((h, w), BASE, int)
        mat_de = {}
        zmap = np.full((h, w), -1e9)
        for r, (mat, z, tipo) in enumerate(self.regs):
            zmap[self.reg == r] = z
        for r, (mat, z, tipo) in enumerate(self.regs):
            m = self.reg == r
            if not m.any():
                continue
            # sombra: perto da borda de baixo/direita; brilho: logo dentro da borda de cima/esquerda
            fora = lambda dy, dx: ~_tem(m, dy, dx)
            sombra = m & (fora(2, 1) | fora(1, 2) | fora(3, 0))
            if tipo == 'mecha':          # mecha: o brilho numa faixa logo abaixo da borda de cima, a sombra embaixo
                sombra = m & (fora(1, 0) | fora(1, 1))
                brilho = m & fora(-2, 0) & ~fora(-1, 0) & ~fora(-1, -1) & ~sombra & _tem(m, 0, 2)
                luz = m & (fora(-3, 0) | fora(-2, -1)) & ~brilho & ~sombra
            elif tipo == 'liso':           # pano grande: a sombra só na borda de baixo e da direita
                sombra = m & (fora(0, 2) | fora(2, 0))
                brilho = m & fora(0, -2) & ~fora(-1, 0) & ~sombra
                luz = m & fora(0, -3) & ~brilho & ~sombra
            else:
                brilho = m & fora(-1, -1) & ~fora(-1, 0) & ~fora(0, -1) & ~sombra
                luz = m & (fora(-2, -1) | fora(-1, -2)) & ~brilho & ~sombra
            # a sombra que a região de cima (mais na frente) faz nesta: 1-2 px logo abaixo dela
            acima = np.zeros_like(m)
            for dy, dx in ((-1, 0), (-2, 0), (-1, -1), (-2, -1)):
                vz = _tem(zmap, dy, dx)
                acima |= vz > z
            sombra |= m & acima
            nivel[m] = BASE
            nivel[luz] = LUZ
            nivel[brilho] = BRI
            nivel[sombra] = SOM
            mat_de[r] = mat
        # contorno e linhas de dentro
        regz = zmap
        for dy, dx in ((0, 1), (0, -1), (1, 0), (-1, 0)):
            viz = _tem(self.reg, dy, dx)
            vz = _tem(regz, dy, dx)
            borda_ext = alfa & (_tem(alfa, dy, dx) == False)        # noqa: E712
            nivel[borda_ext] = OL
            atras = alfa & (viz >= 0) & (viz != self.reg) & (vz > regz)
            nivel[atras & (nivel != OL)] = ESC
        for r, mat in mat_de.items():
            m = self.reg == r
            cor[m] = RAMPAS[mat][nivel[m]]
        img = np.zeros((h, w, 4), np.uint8)
        img[..., :3] = np.clip(cor, 0, 255).round().astype(np.uint8)
        img[..., 3] = np.where(alfa, 255, 0)
        self.img = img
        return img

    def detalhes(self, texto, cores, x0=0, y0=0, espelho=False):
        """Pixels por cima, já com a cor: cores = {letra: '#rrggbb' ou (material, nível)}."""
        linhas = texto.strip('\n').split('\n')
        larg = max(len(l) for l in linhas)
        for i, l in enumerate(linhas):
            l = l.ljust(larg, '.')
            if espelho:
                l = l[::-1]
            for j, ch in enumerate(l):
                if ch not in cores:
                    continue
                y, x = y0 + i, x0 + j
                if not (0 <= y < self.h and 0 <= x < self.w):
                    continue
                c = cores[ch]
                rgb = hx(c) if isinstance(c, str) else tuple(int(v) for v in RAMPAS[c[0]][c[1]])
                self.img[y, x, :3] = rgb
                self.img[y, x, 3] = 255
        return self.img


def ampliar(img, k, fundo=(150, 146, 140)):
    from PIL import Image
    h, w = img.shape[:2]
    base = np.zeros((h, w, 3), np.uint8)
    base[:] = fundo
    a = img[..., 3:4] / 255.0
    base = (img[..., :3] * a + base * (1 - a)).astype(np.uint8)
    return Image.fromarray(base).resize((w * k, h * k), Image.NEAREST)
