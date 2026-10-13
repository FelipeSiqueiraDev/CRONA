"""
O boneco híbrido (teste de 13/10): o corpo do 3D (alosi.py, qualquer pose, com a luz e o contorno do cenário) com as
cores tiradas da Alosi aprovada, e a cabeça recortada da própria arte aprovada daquela direção (a cabeça é rígida:
em qualquer pose ela é a mesma, só muda de lugar), presa no pescoço do 3D.

Uso: python3 hibrido.py <saida.png>
"""
import math
import os
import sys

AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, AQUI)
import numpy as np                 # noqa: E402
from PIL import Image              # noqa: E402
import textura as TX               # noqa: E402
from textura import A, G           # noqa: E402
from motor import tela, VISTA      # noqa: E402

CABECA = ('cabeca', 'nariz', 'orelha', 'cabelo')


# ---------------------------------------------------------------------------------------------------------------
# a curva do tronco (a de guia_acoes) sem desligar os detalhes; os detalhes do peito vão junto com a curva
# ---------------------------------------------------------------------------------------------------------------
def _curva_pt(J, P):
    """Um ponto do corpo reto -> o corpo curvado (o tronco para a frente em volta do quadril)."""
    ang = J.get('curva', 0.0)
    P = np.asarray(P, float)
    if not ang or P[2] < 0.5 + J['sobe']:
        return P
    pv = np.array([0.0, 0.0, 0.52 + J['sobe']])
    q = P - pv
    c, s = math.cos(ang), math.sin(ang)
    # o giro para a frente (o inverso de _volta)
    return np.array([q[0], c * q[1] + s * q[2], -s * q[1] + c * q[2]]) + pv


def preparar():
    if getattr(A, '_hibrido', False):
        return
    A._hibrido = True
    det = A.detalhes
    G._curvar(A)
    A.detalhes = det
    px0 = A._px

    def _px(q, P):
        return px0(q, _curva_pt(q.J, P))
    A._px = _px


# ---------------------------------------------------------------------------------------------------------------
# as cores do corpo: as rampas de cada material tiradas da arte aprovada
# ---------------------------------------------------------------------------------------------------------------
# (a pele e o livro ficam com as rampas do 3D: as mãos da arte não caem no mesmo lugar das do 3D)
MATS = ('jaqueta', 'forro', 'camisa', 'calca', 'bota', 'cinto')


def rampas(V):
    cores = {m: [] for m in MATS}
    for d, v in V.items():
        if d.startswith('_'):
            continue
        q = v.q
        hit = q.parte >= 0
        mats = np.array([p.mat for p in q.partes] + ['-'])
        nomes = np.array([p.nome for p in q.partes] + ['-'])
        mat = mats[q.parte]
        nome = nomes[q.parte]
        for m in MATS:
            mm = hit & (mat == m) & ~np.isin(nome, CABECA)
            # só o miolo (longe da beirada da parte)
            mio = mm.copy()
            for dy, dx in ((0, 1), (1, 0), (0, -1), (-1, 0), (0, 2), (2, 0), (0, -2), (-2, 0)):
                mio &= np.roll(np.roll(mm, dy, 0), dx, 1)
            ys, xs = np.nonzero(mio)
            if not len(ys):
                continue
            c = TX._cor_sprite(v, xs + 0.5, ys + 0.5)
            c = c[c[:, 3] > 0, :3].astype(float)
            lum = c @ np.array([0.3, 0.59, 0.11])
            c = c[lum > 45] if m not in ('calca', 'cinto') else c
            cores[m].append(c)
    out = {}
    for m, l in cores.items():
        if not l:
            continue
        c = np.concatenate(l)
        if len(c) < 10:
            continue
        lum = c @ np.array([0.3, 0.59, 0.11])
        o = np.argsort(lum)
        c = c[o]
        # 5 tons: os quantis 4, 20, 45, 72, 95 (a sombra mais funda, o meio, a luz e o brilho)
        ks = [0.04, 0.2, 0.45, 0.72, 0.95]
        out[m] = np.stack([np.median(c[max(0, int(k * len(c)) - len(c) // 20):int(k * len(c)) + len(c) // 20 + 1], 0) for k in ks])
    return out


# ---------------------------------------------------------------------------------------------------------------
# a cabeça da arte aprovada
# ---------------------------------------------------------------------------------------------------------------
def cabecas(V):
    """Em cada direção: o recorte da cabeça na arte aprovada (com o contorno) e o ponto do pescoço nele."""
    out = {}
    for d, v in V.items():
        if d.startswith('_'):
            continue
        q = v.q
        nomes = np.array([p.nome for p in q.partes] + ['-'])
        cab = np.isin(nomes[q.parte], CABECA) & (q.parte >= 0)
        ys, xs = np.nonzero(cab)
        yb, xr, syb, sxs = v.ref
        # a última linha da cabeça (o queixo / a nuca) na arte
        corte = int(round((ys.max() + 1 - yb) * v.esc + syb))
        spr = v.spr_orig
        h, w = spr.shape[:2]
        m = np.zeros((h, w), bool)
        m[:corte] = True
        # o cabelo que desce da linha (a nuca, de costas): o marrom ligado ao de cima
        lum = spr[..., :3].astype(float) @ np.array([0.3, 0.59, 0.11])
        r, g, b = [spr[..., k].astype(float) for k in range(3)]
        cabelo = (spr[..., 3] > 0) & (lum < 120) & (r > b + 12)
        for y in range(corte, min(h, corte + 6)):
            m[y] = cabelo[y] & m[y - 1]
        m &= spr[..., 3] > 0
        img = np.where(m[..., None], spr, 0).astype(np.uint8)
        # o pescoço: o pivô da cabeça do 3D, na arte
        Pv = A._pivo(v.J0)
        Pw = Pv @ q.Mw.T + q.T3
        sx, sy = tela(Pw)
        px, py = sx - q.caixa[0], sy - q.caixa[1]
        ax = (px - xr) * v.esc + sxs
        ay = (py - yb) * v.esc + syb
        out[d] = (img, ax, ay, corte)
    return out


def montar(d, J, V, CAB, RAMP):
    """O quadro: o corpo do 3D com as rampas da arte, a cabeça da arte por cima."""
    old = dict(A.RAMPAS)
    A.RAMPAS.update(RAMP)
    try:
        q = A.render(d, J, sombra_chao=False)
    finally:
        A.RAMPAS.clear()
        A.RAMPAS.update(old)
    img = np.array(A.rgba(q))
    img[img[..., 3] < 255] = 0
    h, w = img.shape[:2]
    nomes = np.array([p.nome for p in q.partes] + ['-'])
    cab3d = np.isin(nomes[q.parte], CABECA) & (q.parte >= 0)
    # tira a cabeça do 3D (e o contorno dela)
    perto = cab3d.copy()
    for dy, dx in ((0, 1), (1, 0), (0, -1), (-1, 0), (1, 1), (-1, -1), (1, -1), (-1, 1)):
        perto |= np.roll(np.roll(cab3d, dy, 0), dx, 1) & (q.parte < 0)
    img[perto] = 0
    # os pontos soltos dos detalhes do rosto do 3D (fora das partes do corpo): saem
    corpo = (q.parte >= 0) & ~cab3d
    viz = corpo.copy()
    for dy in (-1, 0, 1):
        for dx in (-1, 0, 1):
            viz |= np.roll(np.roll(corpo, dy, 0), dx, 1)
    img[~viz] = 0
    # o pescoço posado
    Pv = A._pivo(J)
    Pv = _curva_pt(J, Pv)
    Pw = Pv @ q.Mw.T + q.T3
    sx, sy = tela(Pw)
    px, py = sx - q.caixa[0], sy - q.caixa[1]
    ci, ax, ay, corte = CAB[d]
    ox = int(round(px - ax))
    oy = int(round(py - ay))
    # a tela maior, para caber a cabeça
    pad = 20
    out = np.zeros((h + 2 * pad, w + 2 * pad, 4), np.uint8)
    out[pad:pad + h, pad:pad + w] = img
    ch, cw = ci.shape[:2]
    reg = out[pad + oy:pad + oy + ch, pad + ox:pad + ox + cw]
    m = ci[..., 3] > 0
    reg[m] = ci[m]
    return out


if __name__ == '__main__':
    saida = sys.argv[1] if len(sys.argv) > 1 else os.path.join(AQUI, 'hibrido.png')
    preparar()
    V = TX.vistas()
    RAMP = rampas(V)
    CAB = cabecas(V)
    linhas = []
    linhas.append(TX.recorta([montar(d, A.pose(), V, CAB, RAMP) for d in TX.DIRS8]))
    linhas.append(TX.recorta([V[d].spr_orig for d in TX.DIRS8]))
    for d in ('se', 's', 'e', 'n'):
        linhas.append(TX.recorta([montar(d, A.pose(andar=k / 6), V, CAB, RAMP) for k in range(6)]))
    for d in ('se', 's', 'e'):
        linhas.append(TX.recorta([montar(d, G.agachado(k / 6), V, CAB, RAMP) for k in range(6)]))
    TX.folha(linhas).save(saida)
    print('ok', saida)
