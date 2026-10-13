"""Alosi Walker, de frente, parado: sprite chibi em pixel art, desenhado a mao.

Cada caractere da grade e um pixel; a paleta diz a cor. Nada de gerador de
imagem: o desenho e esta grade. Rodar:  python3 alosi_frente.py
Grava alosi_frente.png (nativo, fundo transparente), alosi_frente_8x.png
(fundo #cdc8be) e comparacao.png (ao lado de personagens das referencias).
"""
from pathlib import Path
import sys
from PIL import Image

AQUI = Path(__file__).resolve().parent

def hx(s):
    s = s.lstrip('#')
    return tuple(int(s[i:i + 2], 16) for i in (0, 2, 4)) + (255,)

PAL = {
    '.': (0, 0, 0, 0),
    'k': hx('1a1220'),   # contorno
    # cabelo castanho escuro (brilho -> mais escuro)
    '0': hx('a07256'), '1': hx('734a38'), '2': hx('4c2f28'), '3': hx('331d22'), '4': hx('201218'),
    # pele (luz, base, sombra, sombra funda)
    's': hx('fde2c6'), 'S': hx('f0c09e'), 'T': hx('cc8672'), 'U': hx('9a5260'),
    'e': hx('1e1426'), 'w': hx('ffffff'),
    # oculos: aro claro (luz em cima) e aro escuro, fino
    'l': hx('c8986c'), 'g': hx('6e4029'),
    # camisa branca
    'A': hx('ffffff'), 'B': hx('e6e4ee'), 'C': hx('b6b0c8'), 'D': hx('807698'),
    # jaqueta creme
    'J': hx('fbf4e6'), 'j': hx('e4d6c0'), 'q': hx('bba08e'), 'Q': hx('7e6068'),
    # dourado (ziper, corrente, cruz)
    'y': hx('ffe07a'), 'Y': hx('d89c36'), 'z': hx('8c5428'),
    # cinto e fivela
    'b': hx('2a2232'), 'v': hx('e0e0ea'),
    # calca
    'p': hx('514a5a'), 'P': hx('35303e'), 'o': hx('211c28'),
    # botas
    'r': hx('94603e'), 'R': hx('63402e'), 'x': hx('3c2424'),
    # livro
    'n': hx('c0603e'), 'c': hx('8c3434'), 'N': hx('561c2c'), 'f': hx('f2e4c2'),
}

ARTE = r"""
............kk................
.........kkk12kkkkkkkk........
.......kk2112321112223k.......
......k2100131001131123k......
.....k101123211223211233k.....
....k21122322223223223234k....
...k122232232222322322334k....
....k322231223122312223334k...
....k32222412411241223334k....
....k32223422422342233334k....
...k123k23TT23TT23T233k34k....
....k32k4TlllTggT4llT4k343k...
....k32k2gSesgSSgSesg3k34k....
....k33k3gSeSgSSgSeSg3k33k....
...k132k4SgggSSTSgggT4k333k...
...k4kk4kSSTSSSSSSTTTk4kk4k...
....kkJjkSSSSSTSSSSTTkjqkk....
....kJJjjQkTSSSSTTTkQjjqQk....
....kJjjqQQQkkkkkkQQqjjqQk....
...kJJjjqQQkAABBBCkQqjqqQQk...
...kJjjqQjJyzCBBCzQqjQqqQQk...
...kJjjqkJjYBzABzCQqqkjqQQk...
...kJjjqkJjYBBzzBCQqqkjqQQk...
..kJjjqQkJjzBByBCCQqQkQjqQQk..
..kJjjqQkjjzByyYCCQqQkQjqQQk..
..kjqQjQkjjzBBYBCDQqQkQqQjQk..
..kJjqqQkqqzCBzBCDQQQkQjqQQk..
..kqJqJQkjqzbbvvbbQQQkQqjqjk..
..ksSSk.kjqzPPPoPoQYQk.kSSTk..
..kSSTkkkkkzPPPoPoQQYqkkSTUk..
...kkkknnckkpPPoPokkkkk.kkk...
......kcYckPPPoopPPok.........
......kccNkPPokkpPPPok........
......kfffkPok..kpPPok........
.......kkkPok....kpPPok.......
......krrRRxk....krRRRxk......
.....krrRRRxk....krRRRRxk.....
.....kxxxxxxk....kxxxxxxk.....
......kkkkkk......kkkkkk......
"""

def grade():
    linhas = [l for l in ARTE.strip('\n').split('\n')]
    w = max(len(l) for l in linhas)
    for i, l in enumerate(linhas):
        for ch in l:
            if ch not in PAL:
                sys.exit(f'linha {i}: cor desconhecida {ch!r}')
    return [l.ljust(w, '.') for l in linhas]

def imagem():
    g = grade()
    h, w = len(g), len(g[0])
    im = Image.new('RGBA', (w, h))
    px = im.load()
    for y, l in enumerate(g):
        for x, ch in enumerate(l):
            px[x, y] = PAL[ch]
    return im.crop(im.getbbox())

def no_fundo(im, z, fundo=(0xcd, 0xc8, 0xbe, 255), margem=4):
    W, H = im.width + 2 * margem, im.height + 2 * margem
    base = Image.new('RGBA', (W, H), fundo)
    base.alpha_composite(im, (margem, margem))
    return base.resize((W * z, H * z), Image.NEAREST)

REF1 = Path('/tmp/claude-0/-home-user-CRONA/65db675f-ba05-5f24-a910-ad8d18d74f3d/scratchpad/ref/ref_nativo.png')
REF2 = Path('/root/.claude/uploads/65db675f-ba05-5f24-a910-ad8d18d74f3d/4a493885-image.jpg')

def ref2_nativo():
    """A 2a referencia vem ampliada 4x em JPEG: volta ao pixel nativo pela mediana de cada bloco."""
    import numpy as np
    b = np.asarray(Image.open(REF2).convert('RGB')).astype(float)
    h, w = (b.shape[0] - 1) // 4, (b.shape[1] - 1) // 4
    blocos = b[1:1 + h * 4, 1:1 + w * 4].reshape(h, 4, w, 4, 3)[:, 1:3, :, 1:3, :]
    med = np.median(blocos.transpose(0, 2, 1, 3, 4).reshape(h, w, 4, 3), axis=2)
    return Image.fromarray(med.astype('uint8')).convert('RGBA')

def comparacao(im, z=8):
    """Alosi entre personagens das referencias, tudo no pixel nativo e na mesma ampliacao."""
    fundo = (0xcd, 0xc8, 0xbe, 255)
    pecas = []
    if REF1.exists():
        r = Image.open(REF1).convert('RGBA')
        pecas.append(r.crop((44, 12, 86, 62)))    # padre (livro e cruz)
        pecas.append(r.crop((86, 12, 126, 62)))   # loiro
    p = Image.new('RGBA', (im.width + 8, 50), fundo)
    p.alpha_composite(im, (4, 50 - im.height - 4))
    pecas.append(p)
    if REF2.exists():
        r = ref2_nativo()
        pecas.append(r.crop((86, 6, 116, 56)))    # rapaz de jaqueta
        pecas.append(r.crop((86, 62, 116, 112)))  # loiro de jaqueta
    W = sum(q.width for q in pecas) + 4 * (len(pecas) + 1)
    H = max(q.height for q in pecas) + 8
    tela = Image.new('RGBA', (W, H), fundo)
    x = 4
    for q in pecas:
        tela.alpha_composite(q.convert('RGBA'), (x, H - 4 - q.height))
        x += q.width + 4
    return tela.resize((W * z, H * z), Image.NEAREST)

if __name__ == '__main__':
    im = imagem()
    im.save(AQUI / 'alosi_frente.png')
    no_fundo(im, 8).save(AQUI / 'alosi_frente_8x.png')
    comparacao(im).save(AQUI / 'comparacao.png')
    print('tamanho', im.size)
