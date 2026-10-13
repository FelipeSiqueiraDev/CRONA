"""
A Alosi nova no jogo: grava o boneco no formato do tabuleiro (tabuleiro-3d/anim.json, versão 2; ver findBoneco em
server/src/portraits.ts e BonecoTabuleiro em shared/src/protocol.ts):

  client/public/arte/personagens/alosi/tabuleiro-3d/
    parado-desarmado-<dir>.png   4 quadros: a pose parada aprovada respirando (o tronco sobe 1 px e volta)
    andar-desarmado-<dir>.png    6 quadros do andar (andar8/)
    anim.json

Pixel 1:1: o tabuleiro desenha a pessoa com ESCALA_ARTE_PESSOA (0,91); a `escala` do boneco é 1/0,91, e cada pixel
da arte vira 1 pixel da tela no zoom 1 (o desenho em pixel inteiro, sem suavizar).

Uso: python3 exportar_jogo.py
"""
import json
import os
import sys

AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, AQUI)
import numpy as np                  # noqa: E402
from PIL import Image               # noqa: E402
import cena                         # noqa: E402

REPO = os.path.abspath(os.path.join(AQUI, '..', '..', '..', '..', '..'))
SAIDA = os.path.join(REPO, 'client', 'public', 'arte', 'personagens', 'alosi', 'tabuleiro-3d')
ESCALA_ARTE_PESSOA = 0.91
ESCALA = 1 / ESCALA_ARTE_PESSOA
ORDEM = ['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw']        # a ordem da folha das 8 paradas (1..8)
AFUNDA = 2                                                   # o pé passa 2 px do ponto do chão (pisa, não flutua)


def carregar(f):
    return np.asarray(Image.open(f).convert('RGBA')).copy()


def ancora_pes(q):
    """O meio dos pés: a média dos pixels opacos das 6 linhas de baixo."""
    a = q[-6:, :, 3] > 0
    return float(np.nonzero(a)[1].mean())


def ancora_tronco(q):
    a = q[int(q.shape[0] * 0.4):int(q.shape[0] * 0.6), :, 3] > 0
    return float(np.nonzero(a)[1].mean())


def pes(q, ax, ay):
    """Os pés do quadro: [dx, dy, altura no ar] de cada bota (os 2 grupos de colunas mais baixos), na escala da tela."""
    h, w = q.shape[:2]
    op = q[..., 3] > 0
    base = np.full(w, -1)
    for x in range(w):
        ys = np.nonzero(op[int(h * 0.84):, x])[0]
        if len(ys):
            base[x] = ys.max() + int(h * 0.84)
    cols = np.nonzero(base >= 0)[0]
    if not len(cols):
        return []
    grupos, ini = [], cols[0]
    for p, n in zip(cols[:-1], cols[1:]):
        if n - p > 1:
            grupos.append((ini, p)); ini = n
    grupos.append((ini, cols[-1]))
    # cada grupo: o ponto mais baixo e o meio
    pts = []
    for (c0, c1) in grupos:
        yb = base[c0:c1 + 1].max()
        xs = np.arange(c0, c1 + 1)[base[c0:c1 + 1] >= yb - 1]
        pts.append((xs.mean(), yb, c1 - c0 + 1))
    # um grupo só (as botas juntas): duas metades
    if len(pts) == 1:
        (c0, c1) = grupos[0]
        meio = (c0 + c1) / 2
        pts = [((c0 + meio) / 2, base[c0:int(meio) + 1].max(), 1), ((meio + c1) / 2, base[int(meio):c1 + 1].max(), 1)]
    pts = sorted([p for p in pts if p[2] >= 3] or pts, key=lambda p: -p[2])[:2]
    chao = max(p[1] for p in pts)
    return [[round((x - ax) * ESCALA, 1), round((y + 1 - ay) * ESCALA, 1), round((chao - y) * ESCALA, 1)] for (x, y, _) in pts]


def tira(quadros, ancoras):
    """Os quadros lado a lado com a âncora no mesmo x: devolve a tira, w, h, ax."""
    esq = max(a for a in ancoras)
    dir_ = max(q.shape[1] - a for q, a in zip(quadros, ancoras))
    ax = int(np.ceil(esq)) + 1
    w = ax + int(np.ceil(dir_)) + 1
    h = max(q.shape[0] for q in quadros)
    out = np.zeros((h, w * len(quadros), 4), np.uint8)
    pos = []
    for i, (q, a) in enumerate(zip(quadros, ancoras)):
        x0 = i * w + ax - int(round(a))
        y0 = h - q.shape[0]
        out[y0:y0 + q.shape[0], x0:x0 + q.shape[1]] = q
        pos.append((x0 - i * w, y0))
    return out, w, h, ax, pos


def respirar(q):
    """4 quadros: parado, parado, o tronco 1 px acima (da cintura para cima), de novo acima."""
    up = q.copy()
    corte = int(q.shape[0] * 0.58)
    up[:corte - 1] = q[1:corte]
    up[corte - 1] = q[corte - 1]
    return [q, q, up, up]


def main():
    os.makedirs(SAIDA, exist_ok=True)
    estados = {}
    for i, d in enumerate(ORDEM):
        clipes = {}
        idle = cena.harmonizar(carregar(os.path.join(AQUI, f'alosi_gerador_guia_90_{i + 1}.png'))).astype(np.uint8)
        qs = respirar(idle)
        anc = [ancora_pes(idle)] * len(qs)
        t, w, h, ax, pos = tira(qs, anc)
        nome = f'parado-desarmado-{d}.png'
        Image.fromarray(t, 'RGBA').save(os.path.join(SAIDA, nome))
        ay = h - AFUNDA
        clipes['parado'] = dict(arquivo=nome, quadros=len(qs), w=w, h=h, ax=ax, ay=ay, laco=True, ms=420,
                                pes=[pes(t[:, k * w:(k + 1) * w], ax, ay) for k in range(len(qs))])
        andar = [carregar(os.path.join(AQUI, 'andar8', f'andar-{d}-{k}.png')) for k in range(6)]
        anc = [ancora_tronco(q) for q in andar]
        t, w, h, ax, pos = tira(andar, anc)
        nome = f'andar-desarmado-{d}.png'
        Image.fromarray(t, 'RGBA').save(os.path.join(SAIDA, nome))
        ay = h - AFUNDA
        clipes['andar'] = dict(arquivo=nome, quadros=len(andar), w=w, h=h, ax=ax, ay=ay, laco=True, fase=0.0,
                               pes=[pes(t[:, k * w:(k + 1) * w], ax, ay) for k in range(len(andar))])
        estados[d] = clipes
    anim = {'versao': 2, 'escala': round(ESCALA, 5), 'estados': {'desarmado': estados}}
    with open(os.path.join(SAIDA, 'anim.json'), 'w') as f:
        json.dump(anim, f, indent=1)
    print('ok', SAIDA)


if __name__ == '__main__':
    main()
