"""
A teia de aranha de canto (14/10, a fazenda abandonada há mais de um ano): pixel art 1:1 feita por código, presa no
canto de cima da parede de trás com a da esquerda, em quadros que tremem de leve (o vento da janela).

A teia é desenhada no plano da parede de trás (u ao longo dela, v para cima, em metros) e projetada na câmera do
tabuleiro (a mesma do motor e do jogo); os fios são linhas de 1 px, sem suavizar. Sai na parede da direita e espelhada
na da esquerda, com a âncora no meio do item (o ponto que o jogo usa: o meio do def `teia`, 40 x 40 px).

Uso: python teia_px.py [--destino pasta]   (sem destino: a arte do jogo, client/public/arte/mobiliario/)
"""
import json
import math
import os
import sys

from PIL import Image, ImageDraw

AQUI = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(AQUI, '..', '..', '..'))
DESTINO = os.path.join(REPO, 'client', 'public', 'arte', 'mobiliario')

KU = 32 / 0.75            # px por metro ao longo da parede (na tela, x)
KV = 52.26                # px por metro na vertical
NOME = 'teia'
QUADROS, MS = 8, 230
# o canto da teia fica 0,45 m à esquerda e 0,35 m acima do meio do item
CU, CV = -0.45, 0.35
FIOS = 5                  # os raios
ANEIS = (0.2, 0.36, 0.52, 0.66)   # as voltas, pela distância do canto (m)
# cada raio tem um comprimento e cada volta cede diferente (a teia velha não é regular)
TORTO = (1.0, 0.86, 1.08, 0.92, 0.8)
FIO = (128, 120, 108, 150)
VOLTA = (136, 128, 116, 120)
POEIRA = (104, 96, 86, 180)


def tela(u, v):
    """(u, v) em metros no plano da parede, relativos ao meio do item -> px na tela (relativos ao meio)."""
    return u * KU, u * KU * 0.5 - v * KV


def pontos(t):
    """Os raios e as voltas no instante t (0..1): a ponta solta treme mais que o canto preso."""
    raios = []
    for i in range(FIOS):
        ang = math.radians(-8 - i * (74 / (FIOS - 1)))      # do longo da parede até quase a vertical
        raios.append(ang)

    def ponto(r, ang, k):
        r = r * TORTO[int(k) % len(TORTO)] if r < ANEIS[-1] + 0.05 else r
        tremor = 0.012 * (r / ANEIS[-1]) ** 1.5 * math.sin(2 * math.pi * (t + 0.11 * k) + r * 9)
        return CU + (r + tremor) * math.cos(ang), CV + r * math.sin(ang) - tremor * 0.6
    voltas = []
    for j, r in enumerate(ANEIS):
        # a volta cede um pouco entre os raios (o fio é mole)
        linha = []
        for i, ang in enumerate(raios):
            linha.append(ponto(r, ang, i))
            if i < len(raios) - 1:
                meio = (ang + raios[i + 1]) / 2
                linha.append(ponto(r * 0.9, meio, i))
        voltas.append(linha)
    pontas = [ponto((ANEIS[-1] + 0.1) * TORTO[i % len(TORTO)], ang, i) for i, ang in enumerate(raios)]
    return raios, voltas, pontas


def quadro(t):
    raios, voltas, pontas = pontos(t)
    todos = [(CU, CV)] + pontas + [p for v in voltas for p in v]
    xs, ys = zip(*[tela(u, v) for u, v in todos])
    x0, y0 = math.floor(min(xs)) - 2, math.floor(min(ys)) - 2
    x1, y1 = math.ceil(max(xs)) + 3, math.ceil(max(ys)) + 3
    return (x0, y0, x1, y1), raios, voltas, pontas


def desenhar(t, caixa):
    x0, y0, x1, y1 = caixa
    _, raios, voltas, pontas = quadro(t)
    im = Image.new('RGBA', (x1 - x0, y1 - y0), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)

    def P(p):
        x, y = tela(*p)
        return round(x - x0), round(y - y0)
    canto = P((CU, CV))
    # a volta de dentro fica sem (o canto não vira um borrão); uma das de fora rasgada no meio
    for j, v in enumerate(voltas):
        pts = [P(p) for p in v]
        if j == len(voltas) - 1:
            d.line(pts[:3], fill=VOLTA, width=1)
            d.line(pts[5:], fill=VOLTA, width=1)
        else:
            d.line(pts, fill=VOLTA, width=1)
    for pt in pontas:
        d.line([canto, P(pt)], fill=FIO, width=1)
    # bolinhas de poeira presas nos fios (2 px), sempre nos mesmos lugares
    for j, v in enumerate(voltas[1:3]):
        for i in (2, 5):
            if i < len(v):
                x, y = P(v[i])
                d.rectangle([x, y, x + 1, y], fill=POEIRA)
    return im


def main():
    args = sys.argv[1:]
    destino = DESTINO
    if '--destino' in args:
        destino = args[args.index('--destino') + 1]
    caixas = [quadro(k / QUADROS)[0] for k in range(QUADROS)]
    caixa = (min(c[0] for c in caixas), min(c[1] for c in caixas), max(c[2] for c in caixas), max(c[3] for c in caixas))
    pasta = os.path.join(destino, NOME)
    os.makedirs(pasta, exist_ok=True)
    w = caixa[2] - caixa[0]
    ax, ay = -caixa[0], -caixa[1]
    quadros = {'r': [], 'l': []}
    for k in range(QUADROS):
        im = desenhar(k / QUADROS, caixa)
        suf = '' if k == 0 else f'-q{k}'
        im.save(os.path.join(pasta, f'parede-r{suf}.png'), optimize=True)
        im.transpose(Image.FLIP_LEFT_RIGHT).save(os.path.join(pasta, f'parede-l{suf}.png'), optimize=True)
        quadros['r'].append({'arquivo': f'{NOME}/parede-r{suf}.png', 'ax': float(ax), 'ay': float(ay)})
        quadros['l'].append({'arquivo': f'{NOME}/parede-l{suf}.png', 'ax': float(w - ax), 'ay': float(ay)})
    linha = {'escala': 1, 'pixel': True, 'codigo': True, 'parede': {'r': quadros['r'][0], 'l': quadros['l'][0]}, 'quadros': quadros, 'ms': MS}
    arq = os.path.join(destino, 'moveis.json')
    lista = json.load(open(arq, encoding='utf-8')) if os.path.exists(arq) else {}
    lista[NOME] = linha
    with open(arq, 'w', encoding='utf-8') as f:
        json.dump(lista, f, ensure_ascii=False, indent=2)
        f.write('\n')
    print(f'{NOME}: {w}x{caixa[3] - caixa[1]} px, âncora ({ax}, {ay}), {QUADROS} quadros')


if __name__ == '__main__':
    main()
