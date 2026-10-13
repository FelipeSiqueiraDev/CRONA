"""Alosi Walker, de frente, parado: sprite chibi em pixel art 1:1, desenhado à mão.

Cada letra do mapa é uma cor da paleta; '.' é transparente.
Gera, nesta pasta:
  alosi_frente.png     o sprite no tamanho de verdade (RGBA, fundo transparente)
  alosi_frente_8x.png  ampliado 8x, fundo #cdc8be
  comparacao.png       o sprite ao lado de personagens das referências, na mesma ampliação
Uso: python3 alosi_frente.py [pasta-das-referencias-nativas]  (padrão: ./ref, recortes 1:1 das referências)
"""
import os
import sys

import numpy as np
from PIL import Image

AQUI = os.path.dirname(os.path.abspath(__file__))

PALETA = {
    '.': None,
    # contorno
    'K': (38, 24, 36),      # contorno de fora, quase preto puxado para o roxo
    'k': (84, 52, 62),      # linha de dentro, mais macia
    # cabelo castanho escuro
    'a': (58, 34, 38),
    'b': (90, 56, 46),
    'c': (126, 82, 58),
    'd': (168, 116, 78),
    'e': (204, 156, 106),
    # pele
    'S': (184, 106, 104),    # sombra funda
    's': (222, 150, 132),
    't': (246, 198, 166),
    'u': (255, 226, 198),
    'm': (196, 116, 106),     # boca
    # olhos e óculos
    'E': (44, 30, 44),
    'f': (110, 66, 52),     # íris castanha
    'w': (250, 248, 240),
    'g': (140, 84, 54),     # armação
    'G': (78, 42, 34),      # armação na sombra
    'l': (214, 226, 230),   # brilho da lente
    # camisa branca
    'W': (250, 250, 252),
    'X': (216, 216, 228),
    'x': (166, 160, 184),
    # jaqueta creme
    'J': (244, 232, 204),
    'j': (222, 204, 172),
    'i': (178, 150, 130),
    'h': (124, 96, 98),
    # dourado (zíper, cruz, corrente, cantos do livro)
    'Y': (252, 222, 120),
    'y': (216, 164, 64),
    'z': (148, 96, 44),
    # cinto
    'B': (46, 38, 46),
    'n': (118, 112, 124),   # fivela
    # calça escura
    'P': (92, 84, 104),
    'p': (64, 58, 76),
    'q': (44, 40, 56),
    # botas marrons
    'O': (150, 98, 66),
    'o': (108, 68, 48),
    'r': (72, 44, 38),
    # livro (capa vinho, páginas)
    'R': (140, 58, 54),
    'v': (96, 38, 44),
    'L': (238, 226, 196),
}

MAPA = """
..........KKKK.KK.......
.......KKKdedcKdKK......
.....KKcdecbbcdecKK.....
....KbcdecbabbcdecbK....
...KbcdecbbabbccdebaK...
..KbdcbbbbccbbbbcdcbaK..
..KbcbbacbbbcbbacbbbaK..
..KccbcbbacbbbacbbbbaK..
.KbcbbbcbbacbbacbbbabK..
.KbcbabsabbcbasbcsbbaK..
..KcbattGGtggtGGttbaaK..
..KbaatGwEGttGwEGsbbaaK.
..KbbatgEEgttgEEgsbaaaK.
..KabattggttttggtsabaK..
...KaKtuttttttttssKaK...
....KJKsttttmttssKiK....
...KJJjKsttttssSKjiiK...
...KJJjjKKKKKKKKjiihK...
...KJJJjjkWWWXkjiiihK...
...KJJJJjkWzXxkiiiihK...
..KJJjkJiyWYXxziiKiihK..
..KJJjkJiyyYyxzhiKiihK..
..KJijkJiyWyXxzhiKjihK..
..KJjikJYyWWXxzyiKiihK..
..KJjikJjyWXXxzjiKiihK..
..KiiikJjyXXxxzjiKhhhK..
..KttskjjyBnnBziiKtsSK..
...KtsKjjypPpqziBKsSK...
....KKKKjyPpqqzKKKKK....
......KKKpqKKpPKRRLK....
......KppqqKKpqKRyLK....
......KpPpqKKpPKvvLK....
......KpPpqKKpPKKKKK....
......KPPpqKKpPpqK......
......KpPpqKKpPqqK......
......KpPpqKKpPqqK......
......KoOooKKoOooK......
.....KOOOooKKoOOooK.....
.....KrrrrrKKrrrrrK.....
......KKKKK..KKKKK......
"""


def montar(mapa=None):
    linhas = [l for l in (mapa or MAPA).strip('\n').split('\n')]
    largura = max(len(l) for l in linhas)
    erros = [(i, len(l)) for i, l in enumerate(linhas) if len(l) != largura]
    if erros:
        raise SystemExit(f'linhas com largura errada (esperado {largura}): {erros}')
    img = np.zeros((len(linhas), largura, 4), np.uint8)
    for y, l in enumerate(linhas):
        for x, ch in enumerate(l):
            cor = PALETA[ch]
            if cor is not None:
                img[y, x] = (*cor, 255)
    return Image.fromarray(img, 'RGBA')


def ampliar(img, fator, fundo=(205, 200, 190)):
    base = Image.new('RGBA', img.size, (*fundo, 255))
    base.alpha_composite(img)
    return base.resize((img.size[0] * fator, img.size[1] * fator), Image.NEAREST)


def comparacao(img, pasta_ref, fator=8):
    pecas = [ampliar(img, fator)]
    for nome in ('padre_n.png', 'ruivo_n.png', 'chapeu_n.png'):
        caminho = os.path.join(pasta_ref, nome)
        if os.path.exists(caminho):
            r = Image.open(caminho).convert('RGBA')
            pecas.append(r.resize((r.size[0] * fator, r.size[1] * fator), Image.NEAREST))
    alt = max(p.size[1] for p in pecas)
    larg = sum(p.size[0] for p in pecas) + 16 * (len(pecas) + 1)
    folha = Image.new('RGBA', (larg, alt + 32), (205, 200, 190, 255))
    x = 16
    for p in pecas:
        folha.alpha_composite(p, (x, 16 + alt - p.size[1]))
        x += p.size[0] + 16
    return folha


if __name__ == '__main__':
    pasta_ref = sys.argv[1] if len(sys.argv) > 1 else os.path.join(AQUI, 'ref')
    img = montar()
    img.save(os.path.join(AQUI, 'alosi_frente.png'))
    ampliar(img, 8).save(os.path.join(AQUI, 'alosi_frente_8x.png'))
    comparacao(img, pasta_ref).save(os.path.join(AQUI, 'comparacao.png'))
    print('tamanho', img.size)
