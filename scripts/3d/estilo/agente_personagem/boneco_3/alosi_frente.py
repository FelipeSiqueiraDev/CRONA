"""Alosi Walker, sprite chibi de frente (parado), desenhado pixel a pixel.

Tudo por codigo: o mapa de letras abaixo e o desenho; cada letra e uma cor da
paleta ('.' = transparente). Luz de cima-esquerda, sombra a direita/embaixo.

Rodar:  python3 alosi_frente.py
Grava, nesta pasta:
  alosi_frente.png      RGBA no tamanho nativo (23 x 43), fundo transparente
  alosi_frente_8x.png   ampliado 8x (vizinho mais proximo) no fundo #cdc8be
  comparacao.png        ao lado de 3 personagens da referencia, tambem em 8x
"""
from pathlib import Path

import numpy as np
from PIL import Image

AQUI = Path(__file__).resolve().parent
FUNDO = (0xCD, 0xC8, 0xBE)

PALETA = {
    # contorno (quase preto) e contorno da pele (marrom-escuro avermelhado)
    'o': '#1a1016', 'x': '#5e2e2e',
    # cabelo castanho: H mais escuro .. K brilho
    'H': '#1f1318', 'h': '#33201e', 'm': '#4c2f27', 'l': '#684334', 'L': '#875c43', 'K': '#ad805c',
    # pele: a luz, b base, c sombra, r bochecha
    'a': '#fde0c4', 'b': '#f2c09c', 'c': '#d8937a', 'r': '#f2a592',
    # olhos e sobrancelha
    'e': '#22161f', 'i': '#6e4632', 'k': '#3a2220',
    # oculos: g armacao, G ponte (mais clara), q reflexo da lente
    'g': '#7a4632', 'G': '#a8664a', 'q': '#fff8f0',
    # jaqueta creme: A luz, B base, C sombra, D sombra funda (puxa pro roxo)
    'A': '#f6eedc', 'B': '#e2d3b6', 'C': '#bfa88c', 'D': '#8a7266',
    # camisa branca de gola clerical
    'W': '#fbfaf6', 'V': '#cbc6d2',
    # ouro (ziper, corrente, cruz): Y luz, y sombra
    'Y': '#ecbf4e', 'y': '#a8702c',
    # cinto (fivela S) e calca escura
    'S': '#d6d0cc', 'P': '#4b4049', 'p': '#342a34', 'Q': '#211a22',
    # botas marrons
    'T': '#93603e', 't': '#6a412c', 'u': '#432820',
    # livro (codex) no quadril
    'X': '#5c2826', 'Z': '#8e4436',
}

#        0         1         2
#        01234567890123456789012
SPRITE = [
    "..........oooo.oo......",  # 0
    "........oolLLLlolLloo..",  # 1
    "......oLLhlLKKLlllmmo..",  # 2
    "....olLKlhlLhLKLlhLlmo.",  # 3
    "...oLLllhmlLLhlLlmhlmo.",  # 4
    "..oLLlmhmLlmmmhlmmmhmo.",  # 5
    ".olLmmhmmLlmmmmhlmmmhho",  # 6
    "olmhmmhmmmllmmmmhlmmhHo",  # 7
    "ommhmhhmmmmlmmmmmhmmhHo",  # 8
    ".ohmhhaahmmmllmmmhmhhHo",  # 9
    "olhhhbaabbhmmmlmmmhmhHo",  # 10
    ".omhhbbbabbchmmmllhmhHo",  # 11
    "..omhckkbbbbbkhmmhhHo..",  # 12
    "..ohhbgggbbbbgghhhHo...",  # 13
    "..olhgqeagGGgaebghHo...",  # 14
    "..ohhgaiagbbgaibgmHo...",  # 15
    ".omhobgggbbbbgggcohHo..",  # 16
    "..oo.xrbbbbbbbrcx.oo...",  # 17
    ".oAABCxbbbccbbcxCBCDo..",  # 18
    ".oABBCDxxbbbcxxDCBCDo..",  # 19
    ".oABCDDVWxxxxWVDDCDDo..",  # 20
    ".oABBCDCWWVVWWCDCBCDo..",  # 21
    ".oAADABYVyWWyWyCCDCDo..",  # 22
    ".oAADAByVWyyWWyCCDCDo..",  # 23
    ".oABDAByVWYWWVyCCDCDo..",  # 24
    ".oBBDBCyVYYyWVyCCDCDo..",  # 25
    ".oBCDCByVWYWWVyCDDCDo..",  # 26
    ".oCDDCCyVVyVVVyCDDDDo..",  # 27
    ".oabxBCyQQSSQQyCDxbco..",  # 28
    ".obcxCCyQpSQQpyDDxcco..",  # 29
    "..oooDDyppPpppyDyooo...",  # 30
    ".....oPPppppQQQooZZXo..",  # 31
    ".....oPPppQpQQQoXYXo...",  # 32
    ".....oPPpQooPpQoZXXo...",  # 33
    ".....oPPpQooPpQoBBCo...",  # 34
    ".....oPPpQooPpQooooo...",  # 35
    ".....oPppQooPPQQo......",  # 36
    ".....oPppQooPpQQo......",  # 37
    ".....oPppQooPpQQo......",  # 38
    "....oTTttuooTtttuo.....",  # 39
    "...oTTtttuooTttttuo....",  # 40
    "...ottuuuuootuuuuuo....",  # 41
    "...ooooooo..ooooooo....",  # 42
]


def cor(h):
    h = h.lstrip('#')
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def desenhar(mapa=SPRITE, paleta=PALETA):
    alt, larg = len(mapa), max(len(r) for r in mapa)
    px = np.zeros((alt, larg, 4), np.uint8)
    for y, linha in enumerate(mapa):
        for x, ch in enumerate(linha):
            if ch == '.':
                continue
            px[y, x, :3] = cor(paleta[ch])
            px[y, x, 3] = 255
    return Image.fromarray(px, 'RGBA')


def ampliar(im, k, fundo=FUNDO):
    base = Image.new('RGBA', im.size, fundo + (255,))
    base.alpha_composite(im)
    return base.resize((im.width * k, im.height * k), Image.NEAREST)


def lado_a_lado(ims, folga=48, fundo=FUNDO):
    larg = sum(i.width for i in ims) + folga * (len(ims) + 1)
    alt = max(i.height for i in ims) + folga * 2
    out = Image.new('RGBA', (larg, alt), fundo + (255,))
    x = folga
    for i in ims:
        out.alpha_composite(i, (x, alt - folga - i.height))  # todos pisando na mesma linha
        x += i.width + folga
    return out


# referencia: 8 personagens, pixel ampliado 4x (grade comeca em 0)
REF = Path('/root/.claude/uploads/65db675f-ba05-5f24-a910-ad8d18d74f3d/4a493885-image.jpg')
RECORTES = {  # no tamanho nativo da referencia
    'garota de cabelo prateado': (10, 62, 44, 118),
    'rapaz loiro': (88, 62, 124, 118),
    'rapaz grisalho': (86, 6, 124, 62),
}


def referencias():
    if not REF.exists():
        return []
    a = np.array(Image.open(REF).convert('RGB')).astype(int)
    alt, larg = a.shape[0] // 4, a.shape[1] // 4
    nat = np.zeros((alt, larg, 3), np.uint8)
    for y in range(alt):
        for x in range(larg):  # mediana do miolo de cada bloco 4x4 (tira o ruido do JPEG)
            nat[y, x] = np.median(a[4 * y + 1:4 * y + 3, 4 * x + 1:4 * x + 3].reshape(-1, 3), axis=0)
    return [Image.fromarray(nat[y0:y1, x0:x1]).convert('RGBA') for (x0, y0, x1, y1) in RECORTES.values()]


if __name__ == '__main__':
    assert all(len(r) == len(SPRITE[0]) for r in SPRITE)
    im = desenhar()
    im.save(AQUI / 'alosi_frente.png')
    ampliar(im, 8).save(AQUI / 'alosi_frente_8x.png')
    refs = referencias()
    lado_a_lado([ampliar(im, 8)] + [ampliar(r, 8, fundo=tuple(r.getpixel((0, 0))[:3])) for r in refs]).save(AQUI / 'comparacao.png')
    print('sprite', im.size, '| comparacao com', len(refs), 'referencias')
