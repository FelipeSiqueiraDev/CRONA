"""Alosi Walker de frente, parada: sprite chibi desenhado pixel a pixel (mapa de letras + paleta).

Gera, na pasta deste script:
  alosi_frente.png     o sprite RGBA no tamanho nativo
  alosi_frente_8x.png  ampliado 8x sobre #cdc8be
  comparacao.png       o sprite ao lado de personagens das referências (se as referências existirem)
"""
import os
import sys

import numpy as np
from PIL import Image

AQUI = os.path.dirname(os.path.abspath(__file__))

# ---------------------------------------------------------------- paleta
# luz de cima-esquerda; sombras puxando para roxo/vermelho
PAL = {
    '.': None,
    'K': (38, 28, 36),      # contorno geral (quase preto, roxo)
    'L': (74, 38, 34),      # contorno da pele (marrom avermelhado)
    # cabelo castanho escuro
    'A': (34, 20, 28),      # vão entre mechas
    'B': (58, 34, 38),      # sombra
    'C': (86, 54, 46),     # base
    'D': (120, 78, 58),     # luz
    'E': (164, 116, 80),    # brilho
    # pele
    'p': (186, 112, 112),    # sombra funda / boca
    'q': (232, 172, 158),   # sombra
    'r': (253, 220, 204),   # base
    's': (255, 240, 230),   # luz
    # óculos e olhos
    'o': (104, 54, 38),     # armação
    'O': (156, 92, 58),     # armação com luz
    'e': (44, 30, 44),      # olho
    'W': (255, 255, 255),   # brilho do olho / da lente
    # jaqueta creme
    'J': (255, 252, 240),
    'I': (238, 230, 210),
    'H': (210, 198, 178),
    'G': (180, 166, 156),
    'F': (128, 112, 118),
    # camisa branca (sombra azulada)
    'X': (252, 252, 250),
    'Y': (220, 222, 232),
    'Z': (168, 170, 196),
    # dourado (zíper, cordão, cruz, fivela)
    'y': (250, 220, 140),
    'g': (206, 156, 72),
    'n': (136, 92, 54),
    'z': (196, 166, 120),   # corrente
    # calça escura
    'u': (84, 78, 98),
    't': (58, 52, 70),
    'v': (40, 34, 50),
    # botas marrons
    'b': (160, 104, 68),
    'c': (118, 72, 50),
    'd': (78, 46, 40),
    # cinto
    'k': (34, 30, 38),
    'm': (196, 196, 206),
    # livro (capa de couro vinho, folhas)
    'R': (160, 70, 58),
    'S': (110, 44, 48),
    'P': (244, 228, 186),
}

# ---------------------------------------------------------------- o desenho
# 32 colunas; o meio do corpo fica entre as colunas 15 e 16
MAPA = """
................................
................................
................................
................................
""".strip('\n').split('\n')


def imagem():
    h = len(MAPA)
    w = max(len(l) for l in MAPA)
    a = np.zeros((h, w, 4), np.uint8)
    for y, linha in enumerate(MAPA):
        for x, ch in enumerate(linha):
            cor = PAL[ch]
            if cor is not None:
                a[y, x] = (*cor, 255)
    return Image.fromarray(a, 'RGBA')


def ampliar(im, k, fundo=(0xcd, 0xc8, 0xbe)):
    g = Image.new('RGBA', (im.width * k, im.height * k), (*fundo, 255))
    g.alpha_composite(im.resize((im.width * k, im.height * k), Image.NEAREST))
    return g.convert('RGB')


REFS = [
    # (arquivo, escala do pixel na imagem, deslocamento da grade, recorte em pixels nativos)
    ('/root/.claude/uploads/65db675f-ba05-5f24-a910-ad8d18d74f3d/6382924f-image.jpg', 3.863, (3.8, 4.0), (46, 12, 84, 62)),
    ('/root/.claude/uploads/65db675f-ba05-5f24-a910-ad8d18d74f3d/4a493885-image.jpg', 4.0, (0.0, 0.0), (87, 8, 116, 62)),
    ('/root/.claude/uploads/65db675f-ba05-5f24-a910-ad8d18d74f3d/4a493885-image.jpg', 4.0, (0.0, 0.0), (11, 63, 44, 117)),
]


def nativo(caminho, p, off):
    """Reduz uma referência ampliada ao pixel nativo (média do miolo de cada célula)."""
    a = np.asarray(Image.open(caminho).convert('RGB')).astype(float)
    xs = np.arange(off[0], a.shape[1] - p, p)
    ys = np.arange(off[1], a.shape[0] - p, p)
    out = np.zeros((len(ys), len(xs), 3))
    for j, y in enumerate(ys):
        for i, x in enumerate(xs):
            cy, cx = y + p / 2, x + p / 2
            out[j, i] = a[int(cy - 1):int(cy + 1) + 1, int(cx - 1):int(cx + 1) + 1].mean((0, 1))
    return Image.fromarray(out.round().clip(0, 255).astype(np.uint8))


def comparacao(sprite, k=8):
    pecas = [ampliar(sprite, k)]
    for caminho, p, off, caixa in REFS:
        if not os.path.exists(caminho):
            continue
        pecas.append(nativo(caminho, p, off).crop(caixa).resize(((caixa[2] - caixa[0]) * k, (caixa[3] - caixa[1]) * k), Image.NEAREST))
    h = max(pc.height for pc in pecas)
    w = sum(pc.width for pc in pecas) + 16 * (len(pecas) + 1)
    folha = Image.new('RGB', (w, h + 32), (0xcd, 0xc8, 0xbe))
    x = 16
    for pc in pecas:
        folha.paste(pc, (x, 16 + h - pc.height))
        x += pc.width + 16
    return folha


if __name__ == '__main__':
    larg = {len(l) for l in MAPA}
    if len(larg) != 1:
        for i, l in enumerate(MAPA):
            print(i, len(l))
        sys.exit('linhas com larguras diferentes')
    sp = imagem()
    sp = sp.crop(sp.getbbox())
    pad = Image.new('RGBA', (sp.width + 2, sp.height + 2), (0, 0, 0, 0))
    pad.paste(sp, (1, 1))
    pad.save(os.path.join(AQUI, 'alosi_frente.png'))
    ampliar(pad, 8).save(os.path.join(AQUI, 'alosi_frente_8x.png'))
    comparacao(pad).save(os.path.join(AQUI, 'comparacao.png'))
    print('sprite', pad.size)
