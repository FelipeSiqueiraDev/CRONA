"""
Liga os quadros de um personagem em pixel art (o piloto e os pacotes do Códex: personagem-<id>.zip) ao tabuleiro.

Entrada: uma pasta com <id>-<dir>-idle.png, <id>-<dir>-andar-1..N.png e <id>-<dir>-parado-1..M.png
(<dir> = n, ne, e, se, s, sw, w, nw), todos do mesmo tamanho (64 x 64 ou maior, quadrado, os pés na última linha).
Saída: client/public/arte/personagens/<id>/tabuleiro-3d/ com as tiras (parado-desarmado-<dir>.png, andar-desarmado-<dir>.png)
e o anim.json (o formato do boneco do tabuleiro, versão 2: o servidor e o cliente já leem). As direções que faltam caem
na vizinha mais próxima (sheetDirFor).

    python scripts/dev/personagem_pixel.py <pasta com os PNGs> <id> [--escala 1.5] [--casas 1.6]

--escala  quantos pixels do tabuleiro vale cada pixel da arte (o boneco fica maior ou menor).
--casas   quantas casas um ciclo de andar (6 quadros) anda.
"""
import glob
import json
import os
import re
import sys

import numpy as np
from PIL import Image

REPO = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DIRS = ['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw']


def abrir(p):
    return Image.open(p).convert('RGBA')


def pes_do_quadro(im, escala):
    """Onde cada pé toca o chão neste quadro: [dx, dy, altura no ar], em pixels da tela (zoom 1), a partir da âncora."""
    a = np.array(im)[..., 3] > 0
    h, w = a.shape
    base = h - 1
    meio = (w - 1) / 2
    # a faixa dos pés: as 14 últimas linhas num quadro de 64 (proporcional nos maiores)
    faixa = a[h - round(14 * h / 64) :, :]
    cols = np.where(faixa.any(axis=0))[0]
    if not len(cols):
        return [[0.0, 0.0, 0.0], [0.0, 0.0, 0.0]]
    # dois grupos de colunas: separa no maior vazio entre elas (ou ao meio)
    cols = sorted(cols)
    corte = None
    vazio = 0
    for i in range(1, len(cols)):
        d = cols[i] - cols[i - 1]
        if d > vazio and d > 1:
            vazio, corte = d, i
    grupos = [cols[:corte], cols[corte:]] if corte else [[c for c in cols if c <= meio], [c for c in cols if c > meio]]
    out = []
    for g in grupos:
        if not g:
            continue
        sub = a[:, g[0] : g[-1] + 1]
        ys = np.where(sub.any(axis=1))[0]
        fundo = ys.max() if len(ys) else base
        out.append([round(((g[0] + g[-1]) / 2 - meio) * escala, 1), 0.0, round(max(0, base - fundo) * escala, 1)])
    while len(out) < 2:
        out.append(list(out[0]) if out else [0.0, 0.0, 0.0])
    return sorted(out[:2])


def tira(quadros, destino):
    w, h = quadros[0].size
    t = Image.new('RGBA', (w * len(quadros), h), (0, 0, 0, 0))
    for i, q in enumerate(quadros):
        t.paste(q, (i * w, 0))
    t.save(destino)
    return w, h


def main():
    import argparse

    ap = argparse.ArgumentParser(description='Liga os quadros de um personagem em pixel art ao tabuleiro.')
    ap.add_argument('pasta')
    ap.add_argument('id')
    ap.add_argument('--escala', type=float, default=1.5)
    ap.add_argument('--casas', type=float, default=1.6)
    o = ap.parse_args()
    pasta, pid, escala, casas = o.pasta, o.id, o.escala, o.casas
    destino = os.path.join(REPO, 'client', 'public', 'arte', 'personagens', pid, 'tabuleiro-3d')
    os.makedirs(destino, exist_ok=True)
    # as tiras e o anim.json de antes (o boneco filmado em 3D) saem: o novo vale no lugar
    for velho in glob.glob(os.path.join(destino, '*.png')) + [os.path.join(destino, 'anim.json')]:
        if os.path.exists(velho):
            os.remove(velho)

    dirs = {}
    for d in DIRS:
        idle_p = os.path.join(pasta, f'{pid}-{d}-idle.png')
        if not os.path.exists(idle_p):
            continue
        andar = sorted(glob.glob(os.path.join(pasta, f'{pid}-{d}-andar-*.png')), key=lambda p: int(re.search(r'andar-(\d+)', p).group(1)))
        parado = sorted(glob.glob(os.path.join(pasta, f'{pid}-{d}-parado-*.png')), key=lambda p: int(re.search(r'parado-(\d+)', p).group(1)))
        idle = abrir(idle_p)
        q_andar = [abrir(p) for p in andar] or [idle]
        q_parado = [abrir(p) for p in parado] or [idle, idle]
        w, h = tira(q_andar, os.path.join(destino, f'andar-desarmado-{d}.png'))
        tira(q_parado, os.path.join(destino, f'parado-desarmado-{d}.png'))
        dirs[d] = {
            'parado': {
                'arquivo': f'parado-desarmado-{d}.png',
                'quadros': len(q_parado),
                'w': w,
                'h': h,
                'ax': w // 2,
                'ay': h - 1,
                'laco': True,
                'ms': 520,
                'pes': [pes_do_quadro(q, escala) for q in q_parado],
            },
            'andar': {
                'arquivo': f'andar-desarmado-{d}.png',
                'quadros': len(q_andar),
                'w': w,
                'h': h,
                'ax': w // 2,
                'ay': h - 1,
                'laco': True,
                'casasPorCiclo': casas,
                'fase': 0.0,
                'pes': [pes_do_quadro(q, escala) for q in q_andar],
            },
        }
    if not dirs:
        print('nenhuma direção achada em', pasta)
        sys.exit(1)
    anim = {'versao': 2, 'escala': escala, 'estados': {'desarmado': dirs}}
    with open(os.path.join(destino, 'anim.json'), 'w', encoding='utf-8') as f:
        json.dump(anim, f, indent=1)
    print('ok', pid, sorted(dirs), '->', destino)


if __name__ == '__main__':
    main()
