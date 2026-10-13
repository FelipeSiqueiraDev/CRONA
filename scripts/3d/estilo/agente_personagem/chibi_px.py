"""
A Alosi no estilo dos sprites de RPG das referências (docs/estilo, ~40 px, pixel grosso, contorno preto, 3 tons
chapados e o brilho na borda de cima), feita do boneco 3D de alosi.py:

  1. o boneco é desenhado 4x maior que o sprite (ALOSI_ESC=2, o dobro do 1:1 do tabuleiro);
  2. cada pixel do sprite é um bloco de 4 x 4: fica a peça que mais aparece no bloco, com a normal média dela;
  3. a cor: o material em 3 tons pela luz (sombra, base, luz) e o brilho na borda virada para a luz;
  4. o contorno: preto por fora; entre as peças, a de trás ganha a linha escura;
  5. os detalhes no pixel: olhos, óculos, cruz, fivela, livro.

O sprite tem metade da resolução do tabuleiro: no jogo ele vai em 2x (cada pixel dele = 2 x 2 px da tela).

Uso: ALOSI_ESC=2 python3 chibi_px.py [saida.png]
"""
import math
import os
import sys

os.environ['ALOSI_ESC'] = '2'
AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, AQUI)
import numpy as np                       # noqa: E402
from PIL import Image                    # noqa: E402
import alosi as A                        # noqa: E402
from motor import tela, VISTA            # noqa: E402

K = 4                     # o tamanho do bloco (px do desenho por px do sprite)
ESC = 2.0                 # a escala do desenho grande (o 1:1 do tabuleiro = 1)

PRETO = np.array([20.0, 13.0, 18.0])


def hx(h):
    h = h.lstrip('#')
    return np.array([int(h[i:i + 2], 16) for i in (0, 2, 4)], float)


# 4 tons por material: sombra funda, sombra, base, luz (o brilho da borda é o último)
TONS = {
    'cabelo':  ['#2a1610', '#4a2818', '#6e4026', '#9a5e36', '#c48650'],
    'pele':    ['#8a4634', '#c47658', '#ecaa82', '#f9cfa8', '#ffe4c8'],
    'jaqueta': ['#6a5a50', '#a8977f', '#d4c7ae', '#efe6d2', '#fffaee'],
    'forro':   ['#5e4e44', '#8e7c68', '#b3a08a', '#cdbca4', '#e2d4bc'],
    'camisa':  ['#7c7c8e', '#b4b4c4', '#e2e2ea', '#f8f8fc', '#ffffff'],
    'calca':   ['#141019', '#221c2a', '#352d3f', '#4a4056', '#5e536c'],
    'bota':    ['#24120a', '#43251a', '#6a3e24', '#925a34', '#b47848'],
    'sola':    ['#120a08', '#1e120c', '#2c1a12', '#3a2418', '#4a2e1e'],
    'cinto':   ['#0e0a0a', '#1a1414', '#2a2220', '#3c322e', '#504440'],
    'ouro':    ['#6a4012', '#9a6a1e', '#d09a36', '#f2c85e', '#fff0a8'],
    'livro':   ['#2c0e0a', '#5a1c14', '#8a2c1e', '#b4442c', '#d06440'],
}
TONS = {k: np.array([hx(c) for c in v]) for k, v in TONS.items()}
LUZ = np.array([-0.45, 0.35, 1.0]) / np.linalg.norm([-0.45, 0.35, 1.0])


def _viz(a, dy, dx, fill):
    return A._viz(a, dy, dx, fill)


def desenho_grande(direcao, J):
    """O boneco no desenho grande, sem o acabamento: os buffers (a peça de cada pixel, a normal, a profundidade)."""
    guarda = A.acabar
    A.acabar = lambda q, s: q
    try:
        sx0, sy0 = tela(np.array([0.0, 0.0, 0.0]))
        w, h = 44 * K, 60 * K
        caixa = (int(round(sx0)) - w // 2, int(round(sy0)) - h + 4 * K, w, h)
        q = A.render(direcao, J, caixa=caixa, sombra_chao=False)
    finally:
        A.acabar = guarda
    return q


def reduzir(q):
    """Cada bloco K x K vira um pixel: a peça que mais aparece (se o bloco estiver ao menos 40% coberto)."""
    parte = q.parte
    h, w = parte.shape
    H, W = h // K, w // K
    blocos = parte[:H * K, :W * K].reshape(H, K, W, K).transpose(0, 2, 1, 3).reshape(H, W, K * K)
    n = len(q.partes)
    cont = np.zeros((H, W, n + 1), int)
    for i in range(n):
        cont[..., i] = (blocos == i).sum(-1)
    cob = (blocos >= 0).sum(-1) / (K * K)
    p = cont[..., :n].argmax(-1)
    p = np.where(cob >= 0.4, p, -1)
    # a normal e o ponto (no corpo) médios da peça escolhida no bloco
    N = q.Nl[:H * K, :W * K].reshape(H, K, W, K, 3).transpose(0, 2, 1, 3, 4).reshape(H, W, K * K, 3)
    L = q.L[:H * K, :W * K].reshape(H, K, W, K, 3).transpose(0, 2, 1, 3, 4).reshape(H, W, K * K, 3)
    D = q.c.prof[:H * K, :W * K].reshape(H, K, W, K).transpose(0, 2, 1, 3).reshape(H, W, K * K)
    m = (blocos == p[..., None]) & (p[..., None] >= 0)
    k = np.maximum(m.sum(-1, keepdims=True), 1)
    Nm = (N * m[..., None]).sum(2) / k
    Nm /= np.maximum(np.linalg.norm(Nm, axis=-1, keepdims=True), 1e-9)
    Lm = (L * m[..., None]).sum(2) / k
    Dm = np.where(m, D, -1e9).max(-1)
    return p, Nm, Lm, Dm


def pintar(q, p, Nl, Lp, Dp):
    H, W = p.shape
    hit = p >= 0
    partes = q.partes
    mats = np.array([x.mat for x in partes] + ['-'])
    grupos = np.array([x.grupo for x in partes] + ['-'])
    nomes = np.array([x.nome for x in partes] + ['-'])
    mat = np.where(hit, mats[p], '-')
    grupo = np.where(hit, grupos[p], '-')
    nome = np.where(hit, nomes[p], '-')
    S = q.J['sobe']
    z = Lp[..., 2] - S
    mat = np.where((nome == 'jaqueta') & (z < 0.64), 'forro', mat)
    mat = np.where((mat == 'bota') & (z < 0.03), 'sola', mat)
    Nw = Nl @ q.Mw.T
    s = Nw @ LUZ
    # 3 tons chapados pela luz
    nivel = np.where(s < 0.05, 1, np.where(s < 0.62, 2, 3))
    # o que fica embaixo de outra peça (logo abaixo, mais na frente): a sombra que ela faz (cabelo na testa,
    # cabeça no pescoço, jaqueta na calça)
    for dy in (1, 2):
        Gc = _viz(grupo, -dy, 0, '-')
        Pc = _viz(Dp, -dy, 0, -1e9)
        cai = hit & (Gc != '-') & (Gc != grupo) & (Pc > Dp + 0.02)
        nivel = np.where(cai & (dy == 1), np.minimum(nivel, 1), nivel)
        nivel = np.where(cai & (dy == 2), np.minimum(nivel, 2), nivel)
    # o cabelo: as divisas entre os cachos (o de trás escurece) e o alto de cada cacho mais claro
    cab = mat == 'cabelo'
    if cab.any():
        cachos = []
        Hc = A.cabeca_centro(q.J)
        A.cabelo(Hc, cachos)
        Lh = A.de_cab(q.J, Lp[cab])
        dc = np.stack([f(Lh) for f in cachos])
        cid = np.full((H, W), -1)
        cid[cab] = dc.argmin(0)
        div = np.zeros((H, W), bool)
        for dy, dx in ((-1, 0), (0, 1), (0, -1), (1, 0)):
            cn = _viz(cid, dy, dx, -1)
            pn = _viz(Dp, dy, dx, -1e9)
            div |= cab & (cn >= 0) & (cn != cid) & ((pn > Dp + 0.01) | ((dy == -1) & (pn > Dp - 0.005)))
        nivel = np.where(div, np.minimum(nivel, 1), nivel)
    # o brilho na borda de cima e da esquerda (a luz pega a beirada): um tom acima, só onde já está claro
    borda_luz = np.zeros((H, W), bool)
    for dy, dx in ((-1, 0), (-1, -1), (0, -1)):
        Gn = _viz(grupo, dy, dx, '-')
        Pn = _viz(Dp, dy, dx, -1e9)
        borda_luz |= hit & ((Gn == '-') | ((Gn != grupo) & (Pn < Dp - 0.03)))
    nivel = np.where(borda_luz & (nivel >= 2) & (s > 0.35), nivel + 1, nivel)
    # o fundo do lado da sombra: a borda de baixo e da direita, um tom abaixo
    borda_sombra = np.zeros((H, W), bool)
    for dy, dx in ((1, 0), (1, 1), (0, 1)):
        borda_sombra |= hit & (_viz(grupo, dy, dx, '-') == '-')
    nivel = np.where(borda_sombra & (nivel <= 2) & (s < 0.5), nivel - 1, nivel)
    nivel = np.clip(nivel, 0, 4)
    # o pixel solto: vira a maioria dos vizinhos do mesmo material
    for _ in range(2):
        cont = np.zeros((H, W, 5), int)
        iguais = np.zeros((H, W), int)
        for dy, dx in ((0, 1), (1, 0), (0, -1), (-1, 0)):
            vn, vm = _viz(nivel, dy, dx, -9), _viz(mat, dy, dx, '-')
            iguais += (vn == nivel) & (vm == mat)
            for t in range(5):
                cont[..., t] += (vn == t) & (vm == mat)
        solto = hit & (iguais == 0) & (cont.max(-1) > 0)
        nivel = np.where(solto, cont.argmax(-1), nivel)
    cor = np.zeros((H, W, 3))
    for m_, R in TONS.items():
        mm = mat == m_
        cor[mm] = R[nivel[mm]]
    # o contorno: preto por fora; entre os grupos, a peça de trás ganha a linha (quase preta)
    fora = np.zeros((H, W), bool)
    entre = np.zeros((H, W), bool)
    for dy, dx in ((0, 1), (1, 0), (0, -1), (-1, 0)):
        Gn = _viz(grupo, dy, dx, '-')
        Pn = _viz(Dp, dy, dx, -1e9)
        fora |= hit & (Gn == '-')
        entre |= hit & (Gn != '-') & (Gn != grupo) & (Pn > Dp + 0.05)
    # entre a cara e o cabelo, e o pescoço: sem linha (a sombra já separa)
    entre &= ~((grupo == 'pele') | (grupo == 'camisa'))
    cor = np.where(entre[..., None], cor * 0.25 + PRETO * 0.75, cor)
    cor = np.where(fora[..., None], PRETO, cor)
    out = np.zeros((H, W, 4), np.uint8)
    out[..., :3] = np.clip(cor, 0, 255).round()
    out[..., 3] = np.where(hit, 255, 0)
    return out, mat, nivel


def _pt(q, Pl):
    """Ponto do corpo -> (coluna, linha) no sprite."""
    Pw = q.Mw @ np.asarray(Pl, float) + q.T3
    sx, sy = tela(Pw)
    return (sx - q.caixa[0]) / K, (sy - q.caixa[1]) / K, Pw @ VISTA


def _px(img, x, y, cor):
    i, j = int(math.floor(y)), int(math.floor(x))
    if 0 <= i < img.shape[0] and 0 <= j < img.shape[1] and img[i, j, 3] > 0:
        img[i, j, :3] = cor
        return True
    return False


def detalhes(q, img, Dp, olhos=True):
    J = q.J
    Hc = A.cabeca_centro(J)
    Vc = A._vista_cab(q)
    nV = np.linalg.norm(Vc)
    S = J['sobe']
    ouro = TONS['ouro']
    olho = np.array([28.0, 16.0, 22.0])
    aro = np.array([70.0, 36.0, 24.0])

    def vis(Pl, folga=0.06):
        x, y, d = _pt(q, Pl)
        i, j = int(math.floor(y)), int(math.floor(x))
        if not (0 <= i < Dp.shape[0] and 0 <= j < Dp.shape[1]):
            return None
        return (x, y) if d >= Dp[i, j] - folga else None
    # os olhos atrás dos óculos: o olho de 1 x 2 escuro com o brilho em cima; a armação: o canto de fora
    for s in (1, -1):
        ex, ez = 0.1, -0.05
        Pe = Hc + np.array([ex * s, 0.23 * math.sqrt(max(0.0, 1 - (ex / 0.25) ** 2 - (ez / 0.235) ** 2)), ez])
        n_o = np.array([ex * s / 0.25 ** 2, (Pe[1] - Hc[1]) / 0.23 ** 2, ez / 0.235 ** 2])
        n_o /= np.linalg.norm(n_o)
        if n_o @ Vc / nV < 0.15:
            continue
        r = vis(A.cab(J, Pe))
        if r is None:
            continue
        x, y = r
        if olhos:
            _px(img, x, y - 0.5, olho)
            _px(img, x, y + 0.5, olho)
        else:
            _px(img, x, y + 0.5, olho)
        # a armação redonda: o aro em volta (2 px de cada lado do olho, em cima e embaixo)
        for (dx, dy) in ((-1, -1), (0, -1.5), (1, -1), (1, 0), (1, 1), (0, 1.5), (-1, 1), (-1, 0)):
            pass
        _px(img, x - 1, y - 1, aro)
        _px(img, x + 1, y - 1, aro)
        _px(img, x, y - 1.5, aro)
        _px(img, x + 1, y + 0.5, aro)
        _px(img, x - 1, y + 0.5, aro)
        _px(img, x, y + 1.5, aro)
    # a cruz no peito
    Vl = VISTA @ q.Mw
    if Vl[1] > 0.1:
        r = vis([0.0, 0.122, 0.8 + S], 0.03)
        if r:
            x, y = r
            for (dx, dy, t) in ((0, -1, 4), (-1, 0, 3), (0, 0, 3), (1, 0, 2), (0, 1, 2)):
                _px(img, x + dx, y + dy, ouro[t])
        r = vis([0.0, 0.135, 0.545 + S], 0.03)
        if r:
            _px(img, r[0], r[1], ouro[3])
    return img


def sprite(direcao, J=None, olhos=True):
    J = J or A.pose()
    q = desenho_grande(direcao, J)
    p, Nl, Lp, Dp = reduzir(q)
    img, mat, nivel = pintar(q, p, Nl, Lp, Dp)
    detalhes(q, img, Dp, olhos)
    ys, xs = np.nonzero(img[..., 3])
    return img, (q.caixa, ys, xs)


def ampliar(img, k, fundo=(205, 200, 190)):
    h, w = img.shape[:2]
    b = np.zeros((h, w, 3), np.uint8)
    b[:] = fundo
    a = img[..., 3:4] / 255.0
    return Image.fromarray((img[..., :3] * a + b * (1 - a)).astype(np.uint8)).resize((w * k, h * k), Image.NEAREST)


if __name__ == '__main__':
    saida = sys.argv[1] if len(sys.argv) > 1 else os.path.join(AQUI, 'saida', 'chibi_px.png')
    dirs = ['s', 'se', 'e', 'ne', 'n']
    imgs = [sprite(d)[0] for d in dirs]
    h, w = imgs[0].shape[:2]
    m = np.zeros((h, w * len(imgs), 4), np.uint8)
    for k, im in enumerate(imgs):
        m[:, k * w:(k + 1) * w] = im
    ampliar(m, 8).save(saida)
    print('ok', saida, (w, h))
