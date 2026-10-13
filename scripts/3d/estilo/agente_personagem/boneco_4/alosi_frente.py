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
    '0': hx('b4845e'), '1': hx('855740'), '2': hx('5a372a'), '3': hx('3c2226'), '4': hx('26141c'),
    # pele (luz, base, sombra, sombra funda)
    's': hx('ffe6cc'), 'S': hx('f5c49e'), 'T': hx('d98f76'), 'U': hx('a4585e'),
    'e': hx('1e1426'), 'w': hx('ffffff'), 'm': hx('b0505a'),
    # oculos: aro claro (luz em cima) e aro escuro
    'l': hx('c8986c'), 'g': hx('6e4029'),
    # camisa branca
    'A': hx('ffffff'), 'B': hx('e6e4ee'), 'C': hx('b6b0c8'), 'D': hx('807698'),
    # jaqueta creme
    'J': hx('fff7e6'), 'j': hx('ead9bd'), 'q': hx('c9ab8c'), 'Q': hx('8f6c66'),
    # dourado (ziper, corrente, cruz)
    'y': hx('ffe07a'), 'Y': hx('d89c36'), 'z': hx('8c5428'),
    # cinto e fivela
    'b': hx('2a2232'), 'v': hx('e0e0ea'),
    # calca
    'p': hx('5a5474'), 'P': hx('3c3654'), 'o': hx('262036'),
    # botas
    'r': hx('b0703e'), 'R': hx('7c4830'), 'x': hx('4a2828'),
    # livro
    'n': hx('c0603e'), 'c': hx('8c3434'), 'N': hx('561c2c'), 'f': hx('f2e4c2'),
}

ARTE = r"""
............kk................
.........kkk12kkkkkkkk........
.......kk2111311110122k.......
......k2211131110112323k......
.....k211213211210123123k.....
....k22212232212311232234k....
...k132322322223222232334k....
....k322231223122312223334k...
....k32122412411241223334k....
....k32223422422342233334k....
...k123k23TT23TT23T233k34k....
....k32k4TlllTggT4llT4k343k...
....k32kSgswegSSgwesgTk34k....
....k33ksgSeegSSgeeSgTk33k....
...k132ksSgggSSTSgggTTk333k...
...k4kk4kSSTSSSSSSTSTk4kk4k...
....kkJjkSSSSSmSSSSTTkqQkk....
....kJJjjQkTSSSSTTTkQqQQQk....
....kJjjqQQkkkkkkkkQQqqQQk....
...kJJjjqQQkAABBBCkQQqqQQQk...
...kJjjqQjJYzCBBCzYqjQqqQQk...
...kJjjqkJjYBzABzCYqqkjqQQk...
...kJjjqkJjYBBzzBCYqqkjqQQk...
..kJjjqkkJjYBByBCCYqQkkjqQQk..
..kJjjqkkjqYByyYCCYqQkkjqQQk..
..kjqQjkkjjYBBYBCDYqQkkqQjQk..
..kJjqqkkqqYCBzBCDYQQkkjqQQk..
..kqJqJkkjqYbbvvbbYQQkkqjqjk..
..ksSSk.kjqYPPPoPoYQQk.kSSTk..
..kSSTkkkkkzPPPoPozQQqkkSTUk..
...kkkknnckkpPPoPokkkkk.kkk...
......kcYckPPPoopPPok.........
......kccNkPPokkpPPPok........
......kfffkPok..kpPPok........
.......kkkPok....kpPPok.......
......krrRRxk....krRRRxk......
......krRRRxk....krRRRxk......
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

def comparacao(im, z=8):
    ref = AQUI.parent.parent.parent.parent.parent / 'scratchpad_ref_nao_existe'
    refs = []
    p1 = Path('/tmp/claude-0/-home-user-CRONA/65db675f-ba05-5f24-a910-ad8d18d74f3d/scratchpad/ref/ref_nativo.png')
    if p1.exists():
        r = Image.open(p1).convert('RGBA')
        refs.append(r.crop((44, 12, 86, 62)))   # padre
        refs.append(r.crop((86, 12, 128, 62)))  # loiro
    p2 = Path('/root/.claude/uploads/65db675f-ba05-5f24-a910-ad8d18d74f3d/4a493885-image.jpg')
    if p2.exists():
        r = Image.open(p2).convert('RGBA')
        r = r.crop((1, 1, 1 + 127 * 4, 1 + 179 * 4)).resize((127, 179), Image.BOX)
        refs.append(r.crop((86, 10, 116, 60)))  # rapaz de jaqueta
    fundo = Image.new('RGBA', (im.width + 8, 50), (0xcd, 0xc8, 0xbe, 255))
    fundo.alpha_composite(im, (4, 50 - im.height - 2))
    pecas = refs[:2] + [fundo] + refs[2:]
    W = sum(p.width for p in pecas) + 4 * (len(pecas) + 1)
    H = max(p.height for p in pecas) + 8
    tela = Image.new('RGBA', (W, H), (0xcd, 0xc8, 0xbe, 255))
    x = 4
    for p in pecas:
        tela.alpha_composite(p.convert('RGBA'), (x, H - 4 - p.height))
        x += p.width + 4
    return tela.resize((W * z, H * z), Image.NEAREST)

if __name__ == '__main__':
    im = imagem()
    im.save(AQUI / 'alosi_frente.png')
    no_fundo(im, 8).save(AQUI / 'alosi_frente_8x.png')
    comparacao(im).save(AQUI / 'comparacao.png')
    print('tamanho', im.size)
