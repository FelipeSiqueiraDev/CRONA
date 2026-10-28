"""
O sprite como matriz de cores editável (28/10): um .txt com a paleta (letra = cor) e o mapa de letras, uma linha por
linha de pixel ('.' = transparente). Edita-se o texto e exporta-se em blocos exatos, sem suavizar.

Uso:
    python px_mapa.py ler  <sprite.png> <mapa.txt>             # PNG -> matriz
    python px_mapa.py png  <mapa.txt> <saida.png> [escala=1]   # matriz -> PNG (vizinho mais próximo)
"""
import sys

from PIL import Image

LETRAS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789#@%&*+=~'


def ler(png, txt):
    im = Image.open(png).convert('RGBA')
    w, h = im.size
    px = im.load()
    pal = {}
    linhas = []
    for y in range(h):
        s = ''
        for x in range(w):
            r, g, b, a = px[x, y]
            if a < 128:
                s += '.'
                continue
            k = (r, g, b)
            if k not in pal:
                if len(pal) >= len(LETRAS):
                    raise SystemExit('paleta com cores demais (%d): reduza antes' % len(pal))
                pal[k] = LETRAS[len(pal)]
            s += pal[k]
        linhas.append(s)
    with open(txt, 'w', encoding='utf-8') as f:
        f.write('# %d x %d, %d cores\n' % (w, h, len(pal)))
        for k, l in pal.items():
            f.write('%s #%02x%02x%02x\n' % (l, *k))
        f.write('---\n')
        f.write('\n'.join(linhas) + '\n')
    print('ok', w, h, len(pal), 'cores')


def png(txt, saida, escala=1):
    pal, linhas, lendo = {}, [], False
    for l in open(txt, encoding='utf-8').read().splitlines():
        if l.startswith('#') or not l.strip():
            continue
        if l == '---':
            lendo = True
        elif not lendo:
            c, h = l.split()
            pal[c] = tuple(int(h[i:i + 2], 16) for i in (1, 3, 5)) + (255,)
        else:
            linhas.append(l)
    w = max(len(l) for l in linhas)
    im = Image.new('RGBA', (w, len(linhas)), (0, 0, 0, 0))
    px = im.load()
    for y, l in enumerate(linhas):
        for x, c in enumerate(l):
            if c != '.':
                px[x, y] = pal[c]
    if escala > 1:
        im = im.resize((w * escala, len(linhas) * escala), Image.NEAREST)
    im.save(saida)
    print('ok', im.size)


if __name__ == '__main__':
    a = sys.argv[1:]
    if a[0] == 'ler':
        ler(a[1], a[2])
    else:
        png(a[1], a[2], int(a[3]) if len(a) > 3 else 1)
