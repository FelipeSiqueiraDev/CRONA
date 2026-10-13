"""
O boneco 3D com a pintura da Alosi aprovada (teste de 13/10).

O corpo e a pose vêm do boneco 3D (alosi.py, as poses de guia_acoes.py); as cores, da Alosi que o gerador desenhou e
o Felipe aprovou (as 8 direções paradas, gerador/alosi_gerador_guia_90_<1..8>.png). Cada pixel do boneco posado:
  1. o ponto do corpo que ele acerta (q.L) volta para a pose parada (desfaz a curva do tronco, gira cada osso de volta);
  2. esse ponto parado é procurado nas 8 direções paradas: em cada uma, se ele aparece (não está escondido atrás de
     outra parte), o pixel da Alosi aprovada naquele lugar; fica a direção que olha mais de frente para ele.
Assim qualquer pose, em qualquer direção, sai com o rosto, os óculos, o cabelo e a roupa da arte aprovada.

Uso: python3 textura.py <saida.png>   (a folha de teste)
"""
import math
import os
import sys

AQUI = os.path.dirname(os.path.abspath(__file__))
PERS = os.path.join(AQUI, '..')
sys.path.insert(0, PERS)
sys.path.insert(0, os.path.join(PERS, 'gerador'))
import numpy as np                # noqa: E402
from PIL import Image             # noqa: E402
import alosi as A                 # noqa: E402
import guia_acoes as G            # noqa: E402
from motor import tela, VISTA     # noqa: E402

ORDEM_SPRITE = ['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw']
DIRS8 = ORDEM_SPRITE


# ---------------------------------------------------------------------------------------------------------------
# os ossos de uma pose (no corpo reto, antes da curva do tronco)
# ---------------------------------------------------------------------------------------------------------------
def ossos(J):
    S = J['sobe']
    inc = J['incl']
    ch = J['resp'] * A.PZ
    T0 = np.array([0, inc * 0.4, 0.76 + S + ch * 0.6])
    o = {'S': S, 'T0': T0}
    for lado, (H, K, A_, ang) in J['pernas'].items():
        o['perna_' + lado] = (H, K, A_, ang)
    for lado, s in (('d', 1), ('e', -1)):
        bal, cot = J['braco'][lado]
        Ob = T0 + np.array([0.205 * s, -0.01, 0.12])
        ab = J.get('abre', 0.11)
        Cv = Ob + 0.2 * np.array([math.sin(ab) * s, math.sin(bal), -math.cos(bal)])
        bal2 = bal + cot
        Pu = Cv + 0.16 * np.array([math.sin(0.04) * s, math.sin(bal2), -math.cos(bal2)])
        o['braco_' + lado] = (Ob, Cv, Pu)
    return o


def _volta(L, pv, a):
    """O inverso do giro para a frente de `a` em volta de pv (eixo x)."""
    q = L - pv
    ca, sa = math.cos(a), math.sin(a)
    return np.stack([q[:, 0], ca * q[:, 1] - sa * q[:, 2], sa * q[:, 1] + ca * q[:, 2]], 1) + pv


def _rot_x(L, pv, a):
    """Gira os pontos em volta do eixo x por pv: o ângulo th da perna (0 = para baixo, + = para a frente) vira th + a."""
    q = L - pv
    ca, sa = math.cos(a), math.sin(a)
    return np.stack([q[:, 0], q[:, 1] * ca - q[:, 2] * sa, q[:, 1] * sa + q[:, 2] * ca], 1) + pv


def _th(a, b):
    v = b - a
    return math.atan2(v[1], -v[2])


def _alinha(u, v):
    """A rotação que leva a direção u para a direção v (Rodrigues)."""
    u = u / np.linalg.norm(u)
    v = v / np.linalg.norm(v)
    k = np.cross(u, v)
    s = np.linalg.norm(k)
    c = float(u @ v)
    if s < 1e-9:
        return np.eye(3)
    k = k / s
    K = np.array([[0, -k[2], k[1]], [k[2], 0, -k[0]], [-k[1], k[0], 0]])
    return np.eye(3) + s * K + (1 - c) * K @ K


def _seg_t(P, a, b):
    v = b - a
    return np.clip(((P - a) @ v) / (v @ v), 0, 1), np.linalg.norm(P - (a + np.clip(((P - a) @ v) / (v @ v), 0, 1)[:, None] * v), axis=1)


def _cab(J, P):
    """Pontos da cabeça reta (N, 3) -> o corpo com a cabeça inclinada de J (alosi.cab, para muitos pontos)."""
    Pv = A._pivo(J)
    return Pv + (P - Pv) @ J['Rcab'].T


def para_parado(nome, L, J, J0):
    """Os pontos L (do corpo posado, como o raio acerta) da parte `nome` -> o corpo parado J0."""
    o, o0 = ossos(J), ossos(J0)
    ang = J.get('curva', 0.0)
    baixo = nome.startswith(G.BAIXO)
    R = L
    if ang and not baixo:
        R = _volta(R, np.array([0.0, 0.0, 0.52 + o['S']]), ang)
        if nome.startswith(G.CABECA) and J.get('cabeca_ergue'):
            R = _volta(R, np.array([0.0, 0.0, 1.1 + o['S']]), -J['cabeca_ergue'])
    if nome.startswith(('calca_', 'bota_')):
        lado = nome[-1]
        H, K, A_, an = o['perna_' + lado]
        H0, K0, A0, an0 = o0['perna_' + lado]
        if nome.startswith('bota_'):
            return _rot_x(R - A_ + A0, A0, an0 - an)
        t1, d1 = _seg_t(R, H, K)
        t2, d2 = _seg_t(R, K, A_)
        coxa = _rot_x(R - H + H0, H0, _th(H0, K0) - _th(H, K))
        canela = _rot_x(R - K + K0, K0, _th(K0, A0) - _th(K, A_))
        return np.where((d1 <= d2)[:, None], coxa, canela)
    if nome.startswith(('manga_', 'punho_', 'mao_')):
        lado = nome[-1]
        Ob, Cv, Pu = o['braco_' + lado]
        Ob0, Cv0, Pu0 = o0['braco_' + lado]
        R1 = _alinha(Cv - Ob, Cv0 - Ob0)
        R2 = _alinha(Pu - Cv, Pu0 - Cv0)
        braco = (R - Ob) @ R1.T + Ob0
        ante = (R - Cv) @ R2.T + Cv0
        if nome.startswith('manga_'):
            t1, d1 = _seg_t(R, Ob, Cv)
            t2, d2 = _seg_t(R, Cv, Pu)
            return np.where((d1 <= d2)[:, None], braco, ante)
        return ante
    if nome.startswith(G.CABECA):
        # a cabeça: volta para a cabeça reta desta pose e vai para a da pose parada
        return _cab(J0, A.de_cab(J, R)) if 'Rcab' in J0 else R
    # o tronco: só a subida e a inclinação
    return R - (o['T0'] - o0['T0']) * np.array([0, 1, 1]) if not baixo else R - np.array([0, 0, o['S'] - o0['S']])


# ---------------------------------------------------------------------------------------------------------------
# as 8 paradas: o boneco parado em cada direção e a Alosi aprovada em cima dele
# ---------------------------------------------------------------------------------------------------------------
class Vista:
    pass


def _bbox(a):
    ys, xs = np.nonzero(a)
    return ys.min(), ys.max(), xs.min(), xs.max()


def _preenche(img, falta, voltas=8):
    img = img.copy()
    for _ in range(voltas):
        if not falta.any():
            break
        soma = np.zeros(img.shape[:2] + (3,))
        n = np.zeros(img.shape[:2])
        for dy, dx in ((0, 1), (1, 0), (0, -1), (-1, 0)):
            ok = np.roll(np.roll(~falta & (img[..., 3] > 0), dy, 0), dx, 1)
            soma += np.where(ok[..., None], np.roll(np.roll(img[..., :3].astype(float), dy, 0), dx, 1), 0)
            n += ok
        pega = falta & (n > 0)
        img[pega, :3] = (soma[pega] / n[pega, None]).astype(np.uint8)
        falta = falta & ~pega
    return img


def sem_linhas(spr):
    """A arte aprovada sem as linhas: o contorno de fora e as linhas escuras finas entre as partes (menos no rosto,
    onde ficam os olhos e os óculos) viram a cor de dentro. As linhas são desenhadas de novo pelo 3D."""
    a = spr[..., 3] > 0
    borda = np.zeros(a.shape, bool)
    for dy, dx in ((0, 1), (1, 0), (0, -1), (-1, 0)):
        borda |= a & ~np.roll(np.roll(a, dy, 0), dx, 1)
    lum = spr[..., :3].astype(float) @ np.array([0.3, 0.59, 0.11])
    escuro = a & (lum < 60)
    claro = a & ~escuro
    fina = (np.roll(claro, 1, 1) & np.roll(claro, -1, 1)) | (np.roll(claro, 1, 0) & np.roll(claro, -1, 0))
    h = a.shape[0]
    rosto = np.zeros(a.shape, bool)
    rosto[:int(h * 0.36)] = True
    return _preenche(spr, borda | (escuro & fina & ~rosto))


def vistas():
    G._curvar(A)
    out = {}
    for i, d in enumerate(ORDEM_SPRITE):
        J0 = A.pose()
        q = A.render(d, J0, sombra_chao=False)
        v = Vista()
        v.d, v.J0, v.q = d, J0, q
        hit = q.parte >= 0
        v.hit = hit
        v.prof = np.where(hit, q.c.prof, -np.inf)
        v.nrm = q.c.nrm
        spr = np.asarray(Image.open(os.path.join(PERS, 'gerador', f'alosi_gerador_guia_90_{i + 1}.png')).convert('RGBA'))
        v.spr_orig = spr
        v.spr = sem_linhas(spr)
        # o encaixe: a mesma escala nos dois eixos (a altura) e o meio dos pés no mesmo lugar
        y0, y1, x0, x1 = _bbox(hit)
        sy0, sy1, sx0, sx1 = _bbox(spr[..., 3] > 0)
        v.esc = (sy1 - sy0 + 1) / (y1 - y0 + 1)
        pr = np.nonzero(hit[y1 - 5:y1 + 1])[1].mean()
        ps = np.nonzero(spr[sy1 - 5:sy1 + 1, :, 3] > 0)[1].mean()
        v.ref = (y1 + 0.5, pr + 0.5, sy1 + 0.5, ps + 0.5)
        out[d] = v
    return out


def _chave(c):
    c = c.astype(np.int64)
    return (c[..., 0] << 16) | (c[..., 1] << 8) | c[..., 2]


def paletas(V):
    """Em cada material do 3D, as cores da arte aprovada que caem nele (o quanto cada cor aparece ali)."""
    from collections import Counter
    por_mat = {}
    total = Counter()
    for v in V.values():
        q = v.q
        hit = q.parte >= 0
        mats = np.array([p.mat for p in q.partes])
        ys, xs = np.nonzero(hit)
        c = _cor_sprite(v, xs + 0.5, ys + 0.5)
        ok = c[:, 3] > 0
        k = _chave(c[ok, :3])
        m = mats[q.parte[ys, xs]][ok]
        for mat in np.unique(m):
            cnt = por_mat.setdefault(mat, Counter())
            cnt.update(k[m == mat].tolist())
        total.update(k.tolist())
    return por_mat, total


def vale(pal, mats, c):
    """A cor c (N, 4) serve para o material de cada ponto? (aparece nele e é sobretudo dele)"""
    por_mat, total = pal
    k = _chave(c[:, :3])
    out = np.zeros(len(c), bool)
    for mat in np.unique(mats):
        m = np.nonzero(mats == mat)[0]
        cnt = por_mat.get(mat)
        if not cnt:
            out[m] = True
            continue
        out[m] = [cnt.get(x, 0) >= 2 and cnt.get(x, 0) >= 0.3 * total.get(x, 1) for x in k[m].tolist()]
    return out


def _na_vista(v, P):
    """Pontos do corpo parado (N, 3) -> pixel da vista v, profundidade, e se ele aparece."""
    q = v.q
    Pw = P @ q.Mw.T + q.T3
    sx, sy = tela(Pw).T
    x0, y0 = q.caixa[0], q.caixa[1]
    px = sx - x0
    py = sy - y0
    prof = Pw @ VISTA
    h, w = v.hit.shape
    ix = np.clip(np.floor(px).astype(int), 0, w - 1)
    iy = np.clip(np.floor(py).astype(int), 0, h - 1)
    # aparece: é a superfície da frente naquele pixel
    pv = v.prof[iy, ix]
    vis = prof >= pv - 0.04
    return px, py, vis


def _cor_sprite(v, px, py):
    yb, xr, syb, sxs = v.ref
    u = (px - xr) * v.esc + sxs
    t = (py - yb) * v.esc + syb
    h, w = v.spr.shape[:2]
    iu = np.clip(np.floor(u).astype(int), 0, w - 1)
    it = np.clip(np.floor(t).astype(int), 0, h - 1)
    c = v.spr[it, iu]
    return c


def pintar(q, J, V):
    """O quadro posado q (render do alosi) pintado com as 8 paradas."""
    hit = q.parte >= 0
    h, w = hit.shape
    ys, xs = np.nonzero(hit)
    L = q.L[ys, xs]
    nomes = np.array([p.nome for p in q.partes])[q.parte[ys, xs]]
    mats = np.array([p.mat for p in q.partes])[q.parte[ys, xs]]
    J0 = A.pose()
    P = np.zeros_like(L)
    for nome in np.unique(nomes):
        m = nomes == nome
        P[m] = para_parado(nome, L[m], J, dict(J0, Rcab=V['s'].J0['Rcab']))
    # a normal parada (para escolher a vista que olha mais de frente): pelo campo da própria parte na pose parada
    melhor = np.full(len(P), -np.inf)
    cor = np.zeros((len(P), 4), np.uint8)
    for d, v in V.items():
        if d.startswith('_'):
            continue
        # a cabeça parada daquela vista tem a inclinação da câmera dela: os pontos de cabeça usam o Rcab dela
        Pd = P.copy()
        cab = np.array([n.startswith(G.CABECA) for n in nomes])
        if cab.any():
            Pd[cab] = _cab(v.J0, A.de_cab(dict(J0, Rcab=V['s'].J0['Rcab']), P[cab]))
        px, py, vis = _na_vista(v, Pd)
        c = _cor_sprite(v, px, py)
        ok = vis & (c[:, 3] > 0) & vale(V['_pal'], mats, c)
        # quanto a vista olha de frente: a normal da vista parada naquele pixel contra a direção da câmera
        ix = np.clip(np.floor(px).astype(int), 0, w - 1)
        iy = np.clip(np.floor(py).astype(int), 0, h - 1)
        n = v.nrm[np.clip(iy, 0, v.nrm.shape[0] - 1), np.clip(ix, 0, v.nrm.shape[1] - 1)]
        fr = n @ (VISTA / np.linalg.norm(VISTA))
        sc = np.where(ok, fr, -np.inf)
        if d == q.direcao:
            sc = sc + 0.35          # a própria direção ganha (a arte daquele ângulo)
        tro = sc > melhor
        melhor[tro] = sc[tro]
        cor[tro] = c[tro]
    img = np.zeros((h, w, 4), np.uint8)
    img[ys, xs] = cor
    # o que nenhuma vista viu: a cor do vizinho pintado mais perto, do mesmo material
    matimg = np.full((h, w), '', dtype=object)
    matimg[ys, xs] = mats
    falta = hit & (img[..., 3] == 0)
    for _ in range(12):
        if not falta.any():
            break
        for dy, dx in ((0, 1), (1, 0), (0, -1), (-1, 0), (1, 1), (-1, -1), (1, -1), (-1, 1)):
            viz = np.roll(np.roll(img, dy, 0), dx, 1)
            vm = np.roll(np.roll(matimg, dy, 0), dx, 1)
            pega = falta & (viz[..., 3] > 0) & (vm == matimg)
            img[pega] = viz[pega]
            falta &= ~pega
    for dy, dx in ((0, 1), (1, 0), (0, -1), (-1, 0)):
        viz = np.roll(np.roll(img, dy, 0), dx, 1)
        pega = falta & (viz[..., 3] > 0)
        img[pega] = viz[pega]
        falta &= ~pega
    return img


def contorno(img):
    """O contorno de 1 px por fora, no jeito dos móveis (a cor de dentro * 0,28 + marrom)."""
    import cena
    a = img[..., 3] > 0
    out = img.astype(float)
    borda = np.zeros(a.shape, bool)
    for dy, dx in ((0, 1), (1, 0), (0, -1), (-1, 0)):
        borda |= ~a & np.roll(np.roll(a, dy, 0), dx, 1)
    # a borda nova fica do lado de fora: pega a cor do vizinho de dentro
    soma = np.zeros(img.shape[:2] + (3,))
    n = np.zeros(a.shape)
    for dy, dx in ((0, 1), (1, 0), (0, -1), (-1, 0)):
        ok = np.roll(np.roll(a, dy, 0), dx, 1)
        soma += np.where(ok[..., None], np.roll(np.roll(img[..., :3].astype(float), dy, 0), dx, 1), 0)
        n += ok
    cor = soma / np.maximum(n, 1)[..., None] * 0.28 + np.array([26.0, 13.0, 11.0])
    out[borda, :3] = cor[borda]
    out[borda, 3] = 255
    return np.clip(out, 0, 255).astype(np.uint8)


def recorta(imgs):
    """Recorta todos os quadros na mesma caixa (a união)."""
    if len({im.shape for im in imgs}) > 1:
        return imgs
    a = np.zeros(imgs[0].shape[:2], bool)
    for im in imgs:
        a |= im[..., 3] > 0
    y0, y1, x0, x1 = _bbox(a)
    return [im[max(0, y0 - 1):y1 + 2, max(0, x0 - 1):x1 + 2] for im in imgs]


def folha(linhas, esc=4, fundo=(96, 92, 104)):
    hs = [max(im.shape[0] for im in l) for l in linhas]
    ws = [sum(im.shape[1] + 4 for im in l) for l in linhas]
    out = Image.new('RGBA', (max(ws), sum(hs) + 4 * len(linhas)), fundo + (255,))
    y = 0
    for l, hh in zip(linhas, hs):
        x = 0
        for im in l:
            out.alpha_composite(Image.fromarray(im, 'RGBA'), (x, y + hh - im.shape[0]))
            x += im.shape[1] + 4
        y += hh + 4
    return out.resize((out.width * esc, out.height * esc), Image.NEAREST)


if __name__ == '__main__':
    saida = sys.argv[1] if len(sys.argv) > 1 else os.path.join(AQUI, 'teste.png')
    V = vistas()
    V['_pal'] = paletas(V)
    linhas = []
    # 1) as 8 paradas refeitas pelo 3D (tem de dar a arte aprovada)
    l = []
    for d in DIRS8:
        J = A.pose()
        q = A.render(d, J, sombra_chao=False)
        l.append(contorno(pintar(q, J, V)))
    linhas.append(recorta(l))
    linhas.append(recorta([V[d].spr for d in DIRS8]))
    # 2) o andar agachado (s e se) e o andar normal (se)
    for d in ('s', 'se', 'e'):
        l = []
        for k in range(6):
            J = G.agachado(k / 6)
            q = A.render(d, J, sombra_chao=False)
            l.append(contorno(pintar(q, J, V)))
        linhas.append(recorta(l))
    folha(linhas).save(saida)
    print('ok', saida)
