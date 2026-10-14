"""
O chão e a parede em pixel art 1:1 para o jogo, já no ângulo do tabuleiro: uma imagem por casa (o chão, um losango de
64 x 32) e por trecho de parede (uma casa de largura, do chão para cima). O jogo cola cada uma no lugar, sem esticar
(a textura vista de cima, entortada para o isométrico, borraria o pixel). As variações: n x n casas de chão e n
trechos de cada parede, escolhidos pela casa (x % n, y % n).

Saída: client/public/arte/texturas/px/<nome>/ com piso-<i>-<j>.png, parede-r-<i>.png, parede-l-<i>.png e px.json
(as âncoras). Os materiais são os da cozinha da fazenda (agente_cozinha/cozinha.py).

Uso: python texturas_px.py [nome] [--destino pasta]   (padrão: cozinha_fazenda; os outros estilos em pecas_px/)
"""
import json
import os
import sys

os.environ['ESC'] = '1'
AQUI = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(AQUI, '..', '..', '..'))
sys.path.insert(0, os.path.join(AQUI, '..', 'codigo'))
sys.path.insert(0, os.path.join(AQUI, 'agente_cozinha'))
import numpy as np                     # noqa: E402
from PIL import Image                  # noqa: E402
import motor                           # noqa: E402
from motor import Cena, CASA, tela     # noqa: E402
import base_estilo as BE               # noqa: E402
import cozinha as CZ                   # noqa: E402

N = 4                 # variações: N x N casas de chão, N trechos de cada parede

# os estilos: o material do chão, o da parede (por eixo: 'x' = a do fundo, 'y' = a da esquerda), o rodapé (as duas
# cores da madeira, ou None) e, se quiser, `extra(lado, L)`, que põe mais peças na parede (faixa, lambri, barrado).
# Os estilos dos outros cômodos ficam nos módulos de pecas_px/ (ESTILOS = {...}).
ESTILOS = {
    'cozinha_fazenda': {'piso': lambda: CZ.ladrilho(), 'parede': lambda eixo: CZ.parede(eixo), 'rodape': ('#6e4026', '#8a5434')},
}


def _carregar_estilos():
    import importlib
    pasta = os.path.join(AQUI, 'pecas_px')
    if not os.path.isdir(pasta):
        return
    sys.path.insert(0, pasta)
    for arq in sorted(os.listdir(pasta)):
        if arq.endswith('.py') and not arq.startswith('_'):
            ESTILOS.update(getattr(importlib.import_module(arq[:-3]), 'ESTILOS', {}))


_carregar_estilos()
ALTO = 3.6            # a parede desenhada (o jogo corta no topo da parede do cômodo)
QUENTE = np.array([16.0, 4.0, -10.0])


def cena(x0w, x1w, y0w, y1w, z1):
    cantos = np.array([[x, y, z] for x in (x0w, x1w) for y in (y0w, y1w) for z in (0, z1)])
    S = tela(cantos)
    x0, y0 = int(np.floor(S[:, 0].min())) - 2, int(np.floor(S[:, 1].min())) - 2
    c = Cena(x0, y0, int(np.ceil(S[:, 0].max() - x0)) + 2, int(np.ceil(S[:, 1].max() - y0)) + 2)
    CZ.c = c
    CZ.pegadas, CZ.luzes, CZ.vidros, CZ.fades, CZ.fades_atras, CZ.lampadas, CZ.itens_peq = [], set(), [], [], [], [], []
    CZ.ALTO = 99.0          # a sujeira embaixo da viga não entra (a viga é a do jogo)
    BE.ligar(vars(CZ))
    return c


def luz(c, parede):
    cor = c.cor.copy()
    nz, nx, ny = c.nrm[..., 2], c.nrm[..., 0], c.nrm[..., 1]
    topo = nz > 0.6
    esq = ~topo & (ny >= nx)
    if parede:
        f = np.where(topo, 1.04, np.where(esq, 0.97, 0.9))
    else:
        f = np.where(topo, 1.0, np.where(esq, 0.84, 0.66))
    return cor * f[..., None] + (1 - f[..., None]) * QUENTE


def recorta(c, cor, quem, caixa_tela):
    """A imagem RGBA dos pixels `quem` dentro da caixa da tela (x0, y0, x1, y1, em px da projeção)."""
    sx0, sy0, sx1, sy1 = caixa_tela
    a0, b0 = sx0 - c.x0, sy0 - c.y0
    w, h = sx1 - sx0, sy1 - sy0
    img = np.zeros((h, w, 4), np.uint8)
    sub = quem[b0:b0 + h, a0:a0 + w]
    img[..., :3] = np.clip(cor[b0:b0 + h, a0:a0 + w], 0, 255).round().astype(np.uint8)
    img[..., 3] = np.where(sub, 255, 0)
    return img


def chao(pasta, est):
    L = N * CASA
    c = cena(-0.2, L + 0.2, -0.2, L + 0.2, 0.1)
    o = c.novo_obj(1)
    c.face_plana([(-0.1, -0.1, 0), (L + 0.1, -0.1, 0), (L + 0.1, L + 0.1, 0), (-0.1, L + 0.1, 0)], (0, 0, 1), est['piso'](), motor.MUNDO, o)
    cor = luz(c, False)
    P = c.mundoP
    for i in range(N):
        for j in range(N):
            quem = (c.obj == o) & (P[..., 0] >= i * CASA) & (P[..., 0] < (i + 1) * CASA) & (P[..., 1] >= j * CASA) & (P[..., 1] < (j + 1) * CASA)
            sx, sy = tela(np.array([i * CASA, j * CASA, 0.0]))
            sx, sy = int(round(sx)), int(round(sy))
            img = recorta(c, cor, quem, (sx - 32, sy, sx + 32, sy + 32))
            Image.fromarray(img, 'RGBA').save(os.path.join(pasta, f'piso-{i}-{j}.png'), optimize=True)
    return {'ax': 32, 'ay': 0}


def paredes(pasta, est):
    L = N * CASA
    meta = {}
    # a do fundo (o jogo: 'r', ao longo de x, no plano y) e a da esquerda ('l', ao longo de y, no plano x)
    for lado in ('r', 'l'):
        if lado == 'r':
            c = cena(-0.1, L + 0.1, -0.1, 0.1, ALTO)
            o = c.novo_obj(2)
            c.face_plana([(-0.05, 0, 0), (L + 0.05, 0, 0), (L + 0.05, 0, ALTO), (-0.05, 0, ALTO)], (0, 1, 0), est['parede']('x'), motor.MUNDO, o)
            if est.get('rodape'):
                RDP = BE._pau(*est['rodape'], quina=1.3, b=(0, 0, 0, 0, 0, 0.09))
                CZ.caixa((-0.05, L + 0.05, 0, 0.018, 0, 0.09), RDP, tipo=2)
        else:
            c = cena(-0.1, 0.1, -0.1, L + 0.1, ALTO)
            o = c.novo_obj(2)
            c.face_plana([(0, -0.05, 0), (0, L + 0.05, 0), (0, L + 0.05, ALTO), (0, -0.05, ALTO)], (1, 0, 0), est['parede']('y'), motor.MUNDO, o)
            if est.get('rodape'):
                RDP = BE._pau(*est['rodape'], quina=1.3, b=(0, 0, 0, 0, 0, 0.09))
                CZ.caixa((0, 0.018, -0.05, L + 0.05, 0, 0.09), RDP, tipo=2)
        if est.get('extra'):
            est['extra'](lado, L)
        cor = luz(c, True)
        P = c.mundoP
        parede = c.tipo == 2
        for i in range(N):
            a = P[..., 0] if lado == 'r' else P[..., 1]
            quem = parede & (a >= i * CASA) & (a < (i + 1) * CASA)
            if lado == 'r':
                sxa, sya = tela(np.array([i * CASA, 0.0, 0.0]))         # o pé do começo do trecho
                x0, x1 = int(round(sxa)), int(round(sxa)) + 32
            else:
                sxa, sya = tela(np.array([0.0, i * CASA, 0.0]))
                x0, x1 = int(round(sxa)) - 32, int(round(sxa))
            ys = np.nonzero(quem.any(axis=1))[0]
            y0, y1 = int(ys.min()) + c.y0, int(ys.max()) + 1 + c.y0
            img = recorta(c, cor, quem, (x0, y0, x1, y1))
            Image.fromarray(img, 'RGBA').save(os.path.join(pasta, f'parede-{lado}-{i}.png'), optimize=True)
            if i == 0:
                # a âncora: o pé do começo do trecho (o ponto (at, plano, chão) do jogo)
                meta[lado] = {'ax': int(round(sxa)) - x0, 'ay': int(round(sya)) - y0}
    return meta


def main():
    args = sys.argv[1:]
    base = os.path.join(REPO, 'client', 'public', 'arte', 'texturas', 'px')
    if '--destino' in args:
        i = args.index('--destino')
        base = args[i + 1]
        del args[i:i + 2]
    nome = args[0] if args else 'cozinha_fazenda'
    if nome not in ESTILOS:
        raise SystemExit(f'estilo {nome} não existe; há: {", ".join(sorted(ESTILOS))}')
    est = ESTILOS[nome]
    pasta = os.path.join(base, nome)
    os.makedirs(pasta, exist_ok=True)
    meta = {'n': N, 'piso': chao(pasta, est), 'parede': paredes(pasta, est), 'alto': ALTO}
    json.dump(meta, open(os.path.join(pasta, 'px.json'), 'w'), indent=1)
    print('ok', pasta, meta)


if __name__ == '__main__':
    main()
