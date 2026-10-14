"""
GRUPO V, "Santo Berço por fora": as peças de fora da vila (docs/SANTO-BERCO.md) em pixel art 1:1 feita só por código,
no estilo da cozinha e da fazenda por fora (fazenda_fora.py): a estátua dos Guardiões, o poste e as drusas de
cristal (vermelho, verde, azul e o preto da Provação), a poça de Lodo Preto, a sebe do Labirinto, a árvore retorcida
de copa de cor estranha, o arbusto estranho, o poço e as pedras.

Tudo no giro 4 (a frente para +y), a pegada começando em (0, 0), no tamanho do catálogo (shared/src/furni.ts,
FURNI_METERS: a altura já em metros, como a árvore da fazenda). O exportador (exportar_px.py) gira e faz o acabamento.

Decisões:
  - a vila é anacrônica e "errada": a vegetação tem cor estranha (roxo, amarelo-mostarda, azulado) e as árvores são
    tortas; a pedra é velha, cinza-esverdeada, com musgo.
  - cristal aceso (estado 0): as facetas brilham (CZ.luzes: sem luz de face e sem contorno) e em volta vai o halo
    de pixels (o anel de 1 px na cor do brilho, colado na silhueta, e as faíscas em cruz). Apagado ('1'): a mesma
    drusa opaca, com a luz e o contorno normais.
  - o tronco torto, os galhos e os braços da estátua são tubos facetados ao longo de um caminho em 3D (_tubo3).
  - a sebe é um bloco que emenda com a vizinha: o padrão das folhas repete a cada casa (a costura não aparece), o
    corpo não tem o contorno do motor (senão a emenda vira um risco), e o topo são tufos que fazem a borda irregular.
  - o lodo é decalque de 1 px (sem pegada, sem sombra), feito das manchas do ocultismo.py.
"""
import math

import numpy as np

import cozinha as CZ
import base_estilo as BE
from base_estilo import hx, liso, mad2, vol, _tom, _cru, _luz_k, _LUZ2, PZ, PH, _poligono_rodado, _disco
from motor import emissivo, ruido, suave, tela, VISTA
import fazenda_fora as FF
import ocultismo as OC

M = BE.M
CASA = 0.75


def C():
    return CZ.c


def novo(contorno=True, sombra=True):
    return C().novo_obj(3, contorno=contorno, sombra=sombra)


def fp(pts, n, mat, o, dois_lados=False):
    C().face_plana(pts, n, mat, M, o, dois_lados)


def peg(x0, x1, y0, y1):
    CZ.pegadas.append((x0, x1, y0, y1))


def _hex(c):
    c = np.clip(np.round(np.asarray(c, float)), 0, 255).astype(int)
    return '#%02x%02x%02x' % tuple(c)


# =====================================================================================================================
# os tubos e os prismas facetados (o tronco torto, os braços, os cristais)
# =====================================================================================================================
def _base_ortho(t):
    """Dois vetores perpendiculares a t (o anel do tubo)."""
    t = np.asarray(t, float) / np.linalg.norm(t)
    ref = np.array([0.0, 0.0, 1.0]) if abs(t[2]) < 0.9 else np.array([1.0, 0.0, 0.0])
    u = np.cross(t, ref)
    u /= np.linalg.norm(u)
    return u, np.cross(t, u)


def _quad(o, pts, centro, mat, dois_lados=False):
    """Uma face plana com a normal virada para fora (para longe do `centro`)."""
    P = np.asarray(pts, float)
    n = np.cross(P[1] - P[0], P[2] - P[0])
    if np.linalg.norm(n) < 1e-12 and len(P) > 3:
        n = np.cross(P[2] - P[0], P[3] - P[0])
    ln = np.linalg.norm(n)
    if ln < 1e-12:
        return
    n /= ln
    if n @ (P.mean(0) - np.asarray(centro, float)) < 0:
        n = -n
    fp([tuple(p) for p in P], tuple(n), mat, o, dois_lados)


def _tubo3(o, pts, raios, mat, lados=8, tampa=True, giro=0.0):
    """
    Um tubo facetado ao longo de um caminho em 3D (o tronco torto, o galho, o braço): `pts` os pontos do eixo, `raios`
    o raio em cada ponto. O anel segue o caminho (o referencial transportado de ponto em ponto, sem torcer).
    """
    pts = [np.asarray(p, float) for p in pts]
    n = len(pts)
    tans = []
    for i in range(n):
        a = pts[max(i - 1, 0)]
        b = pts[min(i + 1, n - 1)]
        tans.append((b - a) / np.linalg.norm(b - a))
    u, v = _base_ortho(tans[0])
    aneis = []
    for i in range(n):
        if i:
            # o transporte paralelo: tira de u a parte que anda junto com a tangente nova
            u = u - (u @ tans[i]) * tans[i]
            u /= np.linalg.norm(u)
            v = np.cross(tans[i], u)
        r = raios[i]
        aneis.append([pts[i] + r * (math.cos(2 * math.pi * k / lados + giro) * u + math.sin(2 * math.pi * k / lados + giro) * v)
                      for k in range(lados)])
    for i in range(n - 1):
        cen = (pts[i] + pts[i + 1]) / 2
        for k in range(lados):
            k1 = (k + 1) % lados
            _quad(o, [aneis[i][k], aneis[i][k1], aneis[i + 1][k1], aneis[i + 1][k]], cen, mat)
    if tampa:
        _quad(o, aneis[-1], pts[-2], mat)
        _quad(o, aneis[0], pts[1], mat)


def mat_casca(cor, seed=0, musgo=None, riscas=0.09):
    """
    A casca torta (e a pedra dos braços): a luz pela normal da faceta (em degraus, como o vol), as riscas compridas da
    casca seguindo a altura e, com `musgo`, a mancha verde nas facetas viradas para cima.
    """
    c0 = hx(cor)

    def f(L, n, P):
        nn = np.asarray(n, float) / np.linalg.norm(n)
        d = BE.n_mundo(nn) @ _LUZ2
        k = float(_luz_k(d))
        base = np.tile(c0, (len(P), 1))
        if riscas:
            s = np.floor((P[:, 0] * 0.7 - P[:, 1] * 0.7) / (2 * PH))
            z = np.floor(P[:, 2] / riscas)
            r = ruido(s, z, seed + 1.0)
            base = np.where((r < 0.22)[:, None], _tom(base, 0.8), base)
            base = np.where((r > 0.86)[:, None], _tom(base, 1.12), base)
        if musgo is not None and nn[2] > 0.25:
            m = suave(np.floor(P[:, 0] / (2 * PH)), np.floor(P[:, 1] / (2 * PH)) + P[:, 2] * 20, 3.0, seed + 5) > 0.5
            base = np.where(m[:, None], hx(musgo), base)
        return _cru(_tom(base, k), n)
    return emissivo(f)


# =====================================================================================================================
# a pedra (as pedras, a estátua, o poço, a base dos cristais)
# =====================================================================================================================
PEDRA = '#8a8a80'           # a pedra da vila: cinza que puxa para o verde, gasta
MUSGO = '#4e6234'
MUSGO_C = '#66803e'


def mat_pedra_eli(base=PEDRA, musgo=0.55, seed=0):
    """
    A pedra redonda (elipsoide): manchas em dois tons em blocos de 2 px, as trincas raras e o musgo nas partes viradas
    para cima (N·z > musgo). O motor põe a luz do elipsoide por cima.
    """
    c0 = hx(base)

    def f(Pc, N, P):
        a = np.floor((P[:, 0] - P[:, 1]) / (2 * PH))
        b = np.floor((P[:, 0] + P[:, 1]) / (4 * PH) - P[:, 2] / (2 * PZ))
        s = suave(a, b, 3.0, seed)
        out = np.tile(c0, (len(P), 1))
        out = np.where((s > 0.66)[:, None], _tom(c0, 1.08), out)
        out = np.where((s < 0.3)[:, None], _tom(c0, 0.88), out)
        if musgo is not None:
            m = N[:, 2] + 0.35 * (suave(a, b, 2.0, seed + 3) - 0.5) > musgo
            mc = np.where((suave(a, b, 1.5, seed + 4) > 0.55)[:, None], hx(MUSGO_C), hx(MUSGO))
            out = np.where(m[:, None], mc, out)
        return out
    return f


def mat_pedra(base=PEDRA, seed=0, musgo=None, juntas=None, gasto=True):
    """
    A pedra lavrada (o pedestal, o poço): o ocultismo.pedra_q (manchas e trincas) e, com `juntas` (comprimento, altura
    em m), as fiadas; com `musgo` (altura em m), o musgo subindo do chão em línguas, e o escorrido da chuva.
    """
    pq = OC.pedra_q(base, seed=seed, celula=(14, 8), trinca=0.18)
    jc = _tom(hx(base), 0.6)

    def f(L, n, P):
        out = pq(L, n, P)
        vert = abs(n[2]) <= 0.5
        a, b = BE.coords(L, n)
        if juntas is not None and vert:
            la, lb = juntas
            fila = np.floor(b / lb)
            off = (fila % 2) * la * 0.5
            jun = ((b - fila * lb) < PZ) | (((a + off) % la) < PH)
            out = np.where((((b - fila * lb) >= PZ) & ((b - fila * lb) < 2 * PZ))[:, None], _tom(out, 1.1), out)
            out = np.where(jun[:, None], jc, out)
        if gasto and vert:
            esc = suave(np.floor(a / (2 * PH)), P[:, 2] / 0.6, 1.5, seed + 9) > 0.62
            out = np.where(esc[:, None], out * 0.88, out)
        if musgo is not None:
            if vert:
                lim = musgo * (0.5 + suave(np.floor(a / (2 * PH)), 0.0, 2.5, seed + 7))
                m = P[:, 2] < lim
            else:
                m = suave(np.floor(P[:, 0] / (2 * PH)), np.floor(P[:, 1] / (2 * PH)), 4.0, seed + 8) > 0.6
            mc = np.where((suave(np.floor(a / (2 * PH)), np.floor(b / (2 * PZ)), 1.5, seed + 4) > 0.55)[:, None], hx(MUSGO_C), hx(MUSGO))
            out = np.where(m[:, None], mc, out)
        return out
    return emissivo(f)


def pedra(cx, cy, rx, ry, rz, base=PEDRA, musgo=0.55, seed=0, o=None):
    o = novo() if o is None else o
    C().elipsoide(np.array([cx, cy, 0.0]), np.array([rx, ry, rz]), mat_pedra_eli(base, musgo, seed), o, corte_z=0.0)
    return o


def _pedras():
    """O grupo de pedras com musgo (1 x 1, 0,6 m): a grande atrás, a do meio na frente e as pequenas soltas."""
    pedra(0.32, 0.3, 0.33, 0.29, 0.58, seed=1)
    pedra(0.56, 0.52, 0.23, 0.2, 0.32, base='#82847a', seed=2)
    pedra(0.2, 0.56, 0.13, 0.12, 0.2, base='#929288', seed=3)
    pedra(0.6, 0.18, 0.1, 0.09, 0.13, base='#7c7e74', seed=4, musgo=0.4)
    FF.pegada_redonda(0.38, 0.38, 0.36, 8)


# =====================================================================================================================
# os cristais: o prisma de seis faces com a ponta, a drusa e o halo de pixels
# =====================================================================================================================
CRISTAL = {
    #           a rampa acesa (do escuro ao quase branco)                                 a rampa apagada (opaca)
    'vermelho': (['#5a0c12', '#8e1518', '#c42a1e', '#ec4a26', '#ff8a4a', '#ffd29a'], ['#2e1616', '#3e1e1c', '#4e2622', '#603028', '#743c30', '#8a4c3c']),
    'verde': (['#073a22', '#0e6034', '#169048', '#2ec466', '#78f09a', '#d6ffe0'], ['#16281e', '#1c3226', '#243e2e', '#2e4a38', '#3a5844', '#4a6a54']),
    'azul': (['#0c1c50', '#14347e', '#1e5cb6', '#3292e4', '#7ccaff', '#dcf4ff'], ['#161c2a', '#1c2434', '#242e40', '#2e3a4e', '#3a4860', '#4c5a72']),
    'preto': (['#050407', '#0c0910', '#151019', '#221a2c', '#3e2c56', '#8460b4'], None),
}
LD_CRISTAL = np.array([-0.45, 0.55, 0.75]) / np.linalg.norm([-0.45, 0.55, 0.75])


def mat_cristal(base, eixo, comp, rampa, face_k, aresta, aceso, preto=False):
    """
    A faceta do cristal: o degrau da rampa pela luz da faceta (a normal no mundo), mais escuro no pé e mais claro perto
    da ponta (a luz que vem de dentro), e a aresta da esquerda da faceta com 1 px de brilho (o fio do cristal).
    face_k: o degrau extra desta faceta; aresta: (ponto, direção) da aresta da esquerda, para medir a distância.
    """
    R = np.stack([hx(c) for c in rampa])
    base, eixo = np.asarray(base, float), np.asarray(eixo, float)
    ap, ad = aresta

    def f(L, n, P):
        nn = np.asarray(n, float) / np.linalg.norm(n)
        d = float(BE.n_mundo(nn) @ LD_CRISTAL)
        t = np.clip(((P - base) @ eixo) / comp, 0, 1)
        lvl = 1.0 + 2.6 * max(d, -0.2) + face_k + (1.6 if aceso else 0.9) * (t - 0.45)
        if preto:
            lvl = 0.6 + 1.8 * max(d, 0.0) + face_k + 0.8 * (t - 0.5)
        # a aresta da esquerda (1 px ao longo do fio): +2 degraus
        w = P - ap
        dist = np.linalg.norm(w - np.outer(w @ ad, ad), axis=1)
        fio = dist < PH * 1.1
        lv = np.round(lvl + np.where(fio, 2.0 if not preto else 3.2, 0.0)).astype(int)
        out = R[np.clip(lv, 0, len(R) - 1)]
        return out if aceso else _cru(out, n)
    return emissivo(f)


def _tela_x(p):
    """O x na tela de um ponto da cena, no giro que está sendo desenhado."""
    pc = BE._peca()
    P = np.asarray([p], float)
    return float(tela(pc.mundo(P) if pc is not None else P)[0][0])


def cristal(o, base, eixo, r, comp, ponta, rampa, aceso, preto=False, lados=6, giro=0.3, seed=0):
    """Um cristal: o prisma de `lados` faces do pé até `comp` e a ponta de altura `ponta`, inclinado no `eixo`."""
    base = np.asarray(base, float)
    t = np.asarray(eixo, float) / np.linalg.norm(eixo)
    u, v = _base_ortho(t)
    rng = np.random.default_rng(seed)
    total = comp + ponta
    topo = base + t * comp
    tip = base + t * total
    ang = [2 * math.pi * k / lados + giro for k in range(lados)]
    # o pé entra na pedra (um pouco mais fino), o alto do prisma no raio cheio
    a0 = [base + 0.88 * r * (math.cos(a) * u + math.sin(a) * v) for a in ang]
    a1 = [topo + r * (math.cos(a) * u + math.sin(a) * v) for a in ang]
    for k in range(lados):
        k1 = (k + 1) % lados
        fk = (rng.random() - 0.5) * 0.9
        cen = base + t * comp * 0.5
        # a aresta da esquerda na tela: a que fica mais à esquerda das duas
        e0, e1 = a1[k], a1[k1]
        sx0, sx1 = _tela_x(e0), _tela_x(e1)
        ap = e0 if sx0 < sx1 else e1
        m = mat_cristal(base, t, total, rampa, fk, (ap, t), aceso, preto)
        _quad(o, [a0[k], a0[k1], a1[k1], a1[k]], cen, m)
        mt = mat_cristal(base, t, total, rampa, fk + 0.8, (ap, (tip - ap) / np.linalg.norm(tip - ap)), aceso, preto)
        _quad(o, [a1[k], a1[k1], tip], topo, mt)
    _quad(o, a0, tip, liso(rampa[0]))


def _halo(objs, cor_anel, faiscas, cor_faisca, miolo='#fff6e0', seed=0, anel=True):
    """
    O brilho do cristal aceso, desenhado na tela em volta da silhueta (só onde ainda não tem nada):
      (a profundidade é a mais alta: o chão invisível que o exportador põe depois não cobre o halo)
      - o anel de 1 px colado na silhueta dos objetos `objs` (a luz que vaza), na cor do brilho;
      - as faíscas em cruz (5 px, o miolo claro) nos pontos `faiscas` (em px da tela, relativos ao meio do cristal).
    """
    c = C()
    marca = np.isin(c.obj, list(objs))
    if not marca.any():
        return
    oid = c.novo_obj(3, contorno=False, sombra=False)
    CZ.luzes.add(oid)
    ys, xs = np.nonzero(marca)
    P0 = c.mundoP[ys, xs].mean(0)
    vazio = c.obj < 0

    def pinta(m, cor, prof=1e8):
        yy, xx = np.nonzero(m)
        c.faces += 1
        c.cor[yy, xx] = hx(cor)
        c.prof[yy, xx] = prof
        c.obj[yy, xx] = oid
        c.face[yy, xx] = c.faces
        c.tipo[yy, xx] = 3
        c.nz[yy, xx] = 0.0
        c.nrm[yy, xx] = (0.0, 1.0, 0.0)
        c.mundoP[yy, xx] = P0
    if anel:
        viz = np.zeros_like(marca)
        for dy, dx in ((0, 1), (1, 0), (0, -1), (-1, 0)):
            viz |= np.roll(np.roll(marca, dy, 0), dx, 1)
        pinta(viz & vazio, cor_anel)
    # as faíscas em cruz em volta (o meio do cristal na tela: a média dos pixels marcados)
    mx, my = int(round(xs.mean())), int(round(ys.min() + (ys.max() - ys.min()) * 0.4))
    h, w = c.obj.shape
    for (dx, dy, tam) in faiscas:
        x, y = mx + dx, my + dy
        cruz = np.zeros_like(marca)
        meio = np.zeros_like(marca)
        for k in range(-tam, tam + 1):
            if 0 <= y < h and 0 <= x + k < w:
                cruz[y, x + k] = True
            if 0 <= y + k < h and 0 <= x < w:
                cruz[y + k, x] = True
        if 0 <= y < h and 0 <= x < w:
            meio[y, x] = True
        livre = c.obj < 0
        pinta(cruz & livre & ~meio, cor_faisca, prof=1e8 + 1)
        pinta(meio & (livre | (c.obj == oid)), miolo, prof=1e8 + 2)


def _base_drusa(seed=0, cor='#5a5650'):
    """A pedra de onde a drusa sai: o calombo achatado e duas lascas do lado, sem musgo (o cristal queima o musgo)."""
    o = novo()
    C().elipsoide(np.array([0.38, 0.38, 0.0]), np.array([0.3, 0.27, 0.15]), mat_pedra_eli(cor, 0.82, seed), o, corte_z=0.0)
    C().elipsoide(np.array([0.6, 0.48, 0.0]), np.array([0.11, 0.1, 0.08]), mat_pedra_eli(_hex(_tom(hx(cor), 1.08)), 0.9, seed + 1), o, corte_z=0.0)
    C().elipsoide(np.array([0.16, 0.5, 0.0]), np.array([0.09, 0.08, 0.06]), mat_pedra_eli(_hex(_tom(hx(cor), 0.94)), 0.9, seed + 2), o, corte_z=0.0)
    return o


# os cristais da drusa: (dx, dy do pé, a inclinação para x, para y, o raio, o comprimento do prisma, a ponta)
DRUSA = [
    (0.0, 0.0, 0.02, 0.06, 0.085, 0.5, 0.2),
    (-0.1, 0.06, -0.45, 0.3, 0.06, 0.3, 0.12),
    (0.11, 0.05, 0.5, 0.2, 0.065, 0.33, 0.13),
    (0.04, 0.12, 0.15, 0.7, 0.05, 0.2, 0.1),
    (-0.06, -0.08, -0.3, -0.4, 0.055, 0.32, 0.12),
    (0.09, -0.07, 0.45, -0.3, 0.045, 0.24, 0.1),
    (-0.15, -0.01, -0.85, 0.05, 0.04, 0.16, 0.08),
]


def _drusa(cor, aceso=True, alto=0.9):
    """A drusa (1 x 1): a pedra e os cristais saindo dela em leque; acesa, o halo de pixels em volta."""
    pal_aceso, pal_apag = CRISTAL[cor]
    preto = cor == 'preto'
    rampa = pal_aceso if (aceso or preto) else pal_apag
    _base_drusa(seed={'vermelho': 1, 'verde': 2, 'azul': 3, 'preto': 4}[cor], cor='#4a4644' if preto else '#5a5650')
    o = novo(contorno=not (aceso and not preto))
    if aceso and not preto:
        CZ.luzes.add(o)
    k = alto / 0.9
    for i, (dx, dy, ix, iy, r, comp, ponta) in enumerate(DRUSA):
        z0 = 0.06 if i else 0.08
        eixo = (ix, iy, 1.0)
        cristal(o, (0.38 + dx, 0.38 + dy, z0), eixo, r * (1.08 if preto else 1.0), comp * k, ponta * k, rampa, aceso and not preto,
                preto=preto, giro=0.3 + i * 0.7, seed=i + 7)
    if aceso and not preto:
        _halo([o], rampa[4], [(-17, -14, 2), (15, -24, 2), (19, 6, 1), (-14, 10, 1)], rampa[4], miolo=rampa[5])
    if preto:
        # o preto não ilumina: só umas faíscas roxas, frias, perto das pontas
        _halo([o], None, [(-9, -26, 1), (12, -14, 1)], '#5a3a86', miolo='#b496e0', anel=False)
    FF.pegada_redonda(0.4, 0.4, 0.3, 6)


# =====================================================================================================================
# o poste de cristal: o mourão, a gaiola de ferro e o cristal vermelho (aceso) ou o capuz de pano (coberto)
# =====================================================================================================================
FERRO = '#2e2a2c'
FERRO_C = '#4a4446'


def _poste_cristal(aceso=True):
    cx = cy = 0.375
    H = 2.6
    c = C()
    # a sapata de pedra e o mourão de madeira escura (o veio em pé), com o anel de ferro no alto
    pedra(cx, cy, 0.17, 0.17, 0.14, base='#7a7a72', musgo=0.6, seed=8)
    om = novo()
    c.caixa((cx - 0.06, cx + 0.06, cy - 0.06, cy + 0.06, 0.0, 1.98), {'*': mad2('#4a3222', eixo=1, seed=3, passo=0.05), 'cima': liso('#5e4430')}, M, om)
    oa = novo()
    for z in (0.5, 1.82):
        c.caixa((cx - 0.072, cx + 0.072, cy - 0.072, cy + 0.072, z, z + 0.05), {'*': liso(FERRO), 'cima': liso(FERRO_C)}, M, oa)
    # a gaiola: o prato de baixo, as quatro barras, o aro de cima e a tampa em pirâmide com a argola
    zb, zt = 1.98, 2.42
    og = novo()
    c.caixa((cx - 0.13, cx + 0.13, cy - 0.13, cy + 0.13, zb, zb + 0.04), {'*': liso(FERRO), 'cima': liso(FERRO_C)}, M, og)
    for (sx, sy) in ((-1, -1), (1, -1), (1, 1), (-1, 1)):
        x, y = cx + sx * 0.11, cy + sy * 0.11
        c.caixa((x - 0.014, x + 0.014, y - 0.014, y + 0.014, zb + 0.04, zt), {'*': liso(FERRO), 'cima': liso(FERRO_C)}, M, og)
    c.caixa((cx - 0.13, cx + 0.13, cy - 0.13, cy + 0.13, zt, zt + 0.03), {'*': liso(FERRO), 'cima': liso(FERRO_C)}, M, og)
    ap = (cx, cy, zt + 0.14)
    for (a, b) in (((cx - 0.13, cy + 0.13), (cx + 0.13, cy + 0.13)), ((cx + 0.13, cy + 0.13), (cx + 0.13, cy - 0.13)),
                   ((cx + 0.13, cy - 0.13), (cx - 0.13, cy - 0.13)), ((cx - 0.13, cy - 0.13), (cx - 0.13, cy + 0.13))):
        _quad(og, [(a[0], a[1], zt + 0.03), (b[0], b[1], zt + 0.03), ap], (cx, cy, zt), liso(FERRO_C))
    _tubo3(og, [(cx, cy, zt + 0.13), (cx, cy, H - 0.03)], [0.012, 0.012], liso(FERRO), lados=6)
    _tubo3(og, [(cx - 0.03, cy, H - 0.03), (cx, cy, H), (cx + 0.03, cy, H - 0.03)], [0.01, 0.01, 0.01], liso(FERRO), lados=5)
    if aceso:
        pal = CRISTAL['vermelho'][0]
        oc = novo(contorno=False)
        CZ.luzes.add(oc)
        # o cristal de duas pontas, em pé no meio da gaiola
        cristal(oc, (cx, cy, zb + 0.16), (0.0, 0.0, 1.0), 0.085, 0.12, 0.14, pal, True, giro=0.4, seed=3)
        cristal(oc, (cx, cy, zb + 0.16), (0.0, 0.0, -1.0), 0.085, 0.0, 0.11, pal, True, giro=0.4, seed=4)
        _halo([oc], pal[4], [(-14, -8, 2), (13, -14, 2), (12, 10, 1), (-11, 12, 1)], pal[4], miolo=pal[5])
    else:
        # o capuz de pano escuro por cima da gaiola, amarrado embaixo com o cordão (as dobras caindo em pé)
        def dobras(P, b):
            th = np.arctan2(P[:, 1] - cy, P[:, 0] - cx)
            k = np.sin(th * 7 + 0.6 * np.sin(P[:, 2] * 14))
            b = np.where((k > 0.55)[:, None], _tom(b, 1.12), b)
            return np.where((k < -0.6)[:, None], _tom(b, 0.82), b)
        op = novo()
        _poligono_rodado(cx, cy, [(zb - 0.1, 0.16), (zb - 0.02, 0.165), (zb + 0.03, 0.125), (zb + 0.1, 0.16), (zt - 0.08, 0.17),
                                  (zt + 0.02, 0.15), (zt + 0.1, 0.1), (zt + 0.15, 0.04), (zt + 0.16, 0.0)],
                         vol(cx, cy, '#4a3c34', faixas=dobras), op, lados=14)
        # o cordão e as pontas soltas
        oc = novo()
        c.cilindro(cx, cy, 0.125, zb + 0.02, zb + 0.05, vol(cx, cy, '#a08a5a'), M, oc, lados=14, tampa=False)
        _tubo3(oc, [(cx + 0.08, cy + 0.1, zb + 0.03), (cx + 0.1, cy + 0.15, zb - 0.06), (cx + 0.09, cy + 0.16, zb - 0.16)], [0.012] * 3, liso('#a08a5a'), lados=5)
        _tubo3(oc, [(cx + 0.03, cy + 0.12, zb + 0.03), (cx + 0.03, cy + 0.17, zb - 0.05), (cx + 0.01, cy + 0.18, zb - 0.12)], [0.012] * 3, liso('#8e7a4e'), lados=5)
    peg(cx - 0.12, cx + 0.12, cy - 0.12, cy + 0.12)


# =====================================================================================================================
# o Lodo Preto: a poça de bordas orgânicas, o brilho de óleo roxo e a espiral que hipnotiza
# =====================================================================================================================
def _lodo():
    cx, cy = 0.76, 0.74
    ms = [OC.Mancha(cx, cy, 0.5, seed=701, amp=0.14, ex=1.1, ey=0.95, ang=20, lobos=(2, 3, 5, 7)),
          OC.Mancha(cx + 0.42, cy + 0.36, 0.17, seed=702, amp=0.16, ang=40, lobos=(2, 3)),
          OC.Mancha(cx - 0.44, cy + 0.18, 0.14, seed=703, amp=0.14, lobos=(2, 3, 5)),
          OC.Mancha(cx + 0.18, cy - 0.46, 0.13, seed=704, amp=0.12, lobos=(2, 3)),
          OC.Mancha(cx - 0.3, cy - 0.38, 0.09, seed=705, amp=0.1, lobos=(2, 3)),
          # os pingos soltos da beira
          OC.Mancha(cx + 0.62, cy - 0.12, 0.07, seed=706, amp=0.08, lobos=(2,))]

    def extra(X, Y, d, out):
        # a tela: s ao longo da diagonal da casa (o "x" da tela) e t o "y" (em px)
        sx = (X - Y) / PH
        sy = (X + Y) / (2 * PH)
        mx, my = (cx - cy) / PH, (cx + cy) / (2 * PH)
        u, v = sx - mx, (sy - my) * 2
        rr = np.hypot(u, v)
        th = np.arctan2(v, u)
        # a espiral roxa (duas voltas que se fecham no meio), de 1 px, só por dentro e longe da beira
        esp = (rr / 7.0 + th / (2 * math.pi)) % 1.0
        espiral = (np.abs(esp - 0.5) < 0.09) & (rr > 3) & (rr < 26) & (d > 3)
        anel_ = (np.abs(rr - 30) < 0.8) & (d > 3) & (np.sin(th * 3 + 1) > -0.2)
        out = np.where(((d >= 1.4) & (d < 3.2))[:, None], hx('#1c1524'), out)
        out = np.where(anel_[:, None], hx('#2c2040'), out)
        out = np.where(espiral[:, None], np.where((rr < 12)[:, None], hx('#6a4a9a'), hx('#43305e')), out)
        # o brilho molhado (as riscas claras do céu, compridas) e o olho de luz no meio
        r1 = (np.abs(v + u * 0.5 + 16) < 0.7) & (np.abs(u + 14) < 6) & (d > 3)
        r2 = (np.abs(v + u * 0.5 + 12) < 0.7) & (np.abs(u + 8) < 3) & (d > 3)
        out = np.where((r1 | r2)[:, None], hx('#a08ac4'), out)
        olho = (rr < 1.6)
        out = np.where(olho[:, None], hx('#c8b0f0'), out)
        # as bolhas (o anel de 1 px com o ponto de luz em cima)
        for (bu, bv, br) in ((22, 10, 2.2), (-26, 18, 1.6), (10, -20, 1.6), (-34, -2, 1.2)):
            db = np.hypot(u - bu, v - bv)
            out = np.where(((db < br + 0.6) & (db > br - 0.6) & (d > 2))[:, None], hx('#2e2440'), out)
            out = np.where(((np.abs(u - bu + 1) < 0.6) & (np.abs(v - bv + br * 0.6) < 0.6) & (d > 2))[:, None], hx('#9a84c0'), out)
        return out
    OC.manchas_decal(ms, OC.mat_mancha(ms, ['#2a1e34', '#0b090e'], beira=1.4, extra=extra))


# =====================================================================================================================
# a sebe do Labirinto: o bloco de folhas escuras que emenda com a vizinha, as flores roxas e o topo em tufos
# =====================================================================================================================
SEBE = ['#101a14', '#16241a', '#1e3022', '#283e2c', '#344e36', '#46623e']
FLOR = ('#7a3a9a', '#a85ccc', '#e0b4f4')


def mat_sebe(seed=0, flores=True):
    """
    As folhas da sebe numa face: tufos (Voronoi em px da face, que repete a cada casa: a costura com a vizinha não
    aparece), cada tufo num tom, a borda de cima do tufo um tom acima e a de baixo um abaixo (a sombra do tufo de
    cima); as flores roxas em cruz no meio de alguns tufos; o pé mais escuro (a terra e a sombra).
    """
    pal = np.stack([hx(x) for x in SEBE])
    PER = 32                                    # px por casa ao longo da face (a repetição)

    def f(L, n, P):
        a, b = OC._px_face(L, n)
        vert = abs(n[2]) <= 0.5
        cw, ch = 8.0, 7.0 if vert else 8.0
        A = a % PER
        i0, j0 = np.floor(A / cw), np.floor(b / ch)
        nper = PER / cw
        d1 = np.full(a.shape, 1e9)
        d2 = np.full(a.shape, 1e9)
        idc = np.zeros(a.shape)
        cyb = np.zeros(a.shape)
        cxv = np.zeros(a.shape)
        for di in (-1, 0, 1):
            for dj in (-1, 0, 1):
                i, j = i0 + di, j0 + dj
                iw = i % nper
                px_ = (i + 0.08 + 0.84 * ruido(iw, j, seed + 0.3)) * cw
                py_ = (j + 0.08 + 0.84 * ruido(iw, j, seed + 0.7)) * ch
                d = np.hypot((A - px_) / cw, (b - py_) / ch)
                menor = d < d1
                d2 = np.where(menor, d1, np.minimum(d2, d))
                idc = np.where(menor, iw * 7919 + j, idc)
                cyb = np.where(menor, py_, cyb)
                cxv = np.where(menor, px_, cxv)
                d1 = np.where(menor, d, d1)
        folga = (d2 - d1) * min(cw, ch) * 0.5
        k = ruido(idc, seed + 3.0)
        nv = np.where(k < 0.3, 2, np.where(k < 0.75, 3, 4))
        borda = folga < 0.9
        # em b, para baixo é menor b na face em pé (b sobe com a altura)
        baixo = borda & (b < cyb)
        cima = borda & (b > cyb)
        nv = np.where(baixo, nv - 2, np.where(cima, nv + 1, nv))
        if vert:
            # o pé da sebe mais escuro e o alto um pouco mais claro
            nv = np.where(P[:, 2] < 0.18, np.minimum(nv, 1), nv)
            nv = np.where((P[:, 2] < 0.36) & (P[:, 2] >= 0.18), nv - 1, nv)
        nv = np.clip(nv, 0, len(pal) - 1)
        out = pal[nv]
        if flores:
            grupo = suave(np.floor(A / cw), np.floor(b / ch), 2.2, seed + 12) > 0.5
            tem = grupo & (ruido(idc, seed + 9.1) > 0.3) & ~borda & (P[:, 2] > 0.4)
            # o meio do tufo (o ponto do Voronoi) e a cruzinha de 1 px para cada lado
            da = np.abs(A - cxv)
            db = np.abs(b - cyb)
            pet = tem & (((da < 1.1) & (db < 1.6)) | ((da < 1.6) & (db < 1.1)))
            mio = tem & (da < 0.6) & (db < 0.6)
            out = np.where(pet[:, None], hx(FLOR[1]), out)
            out = np.where(mio[:, None], hx(FLOR[2]), out)
        return out
    return emissivo(f)


def _sebe():
    """A sebe (1 x 1, 2,4 m): o bloco que enche a casa (emenda com a vizinha) e a fileira de tufos no alto."""
    H = 2.4
    zc = H - 0.2
    o = novo(contorno=False)
    C().caixa((0.0, CASA, 0.0, CASA, 0.0, zc), mat_sebe(seed=0), M, o)
    # os tufos do topo: dois de cada lado, um pouco para dentro (o topo fica em ondas na fileira inteira)
    ot = novo()
    rng = np.random.default_rng(31)
    mat = FF.mat_folha((0.375, 0.375, zc), (0.5, 0.5, 0.3), [hx(x) for x in SEBE], q=0.07, seed=31)
    for (x, y, r, rz) in ((0.2, 0.2, 0.22, 0.2), (0.56, 0.2, 0.22, 0.17), (0.2, 0.56, 0.22, 0.16), (0.56, 0.56, 0.23, 0.2), (0.38, 0.38, 0.2, 0.22)):
        C().elipsoide((x, y, zc - 0.04), (r, r, rz), mat, ot, corte_z=zc - 0.1)
        FF._cachos(ot, x, y, zc - 0.02, r * 0.8, rz * 0.8, 6, 0.06, 0.09, rng, mat, corte=zc - 0.1)
    peg(0.0, CASA, 0.0, CASA)


# =====================================================================================================================
# a árvore retorcida e o arbusto estranho
# =====================================================================================================================
COPA = {
    'a': [hx(x) for x in ('#24112e', '#381a48', '#502866', '#6c3886', '#8a4ea6', '#ac70c6')],     # roxa
    'b': [hx(x) for x in ('#3a2a0c', '#584010', '#7a5c16', '#9e7c20', '#c29e30', '#e2c452')],     # amarela
    'c': [hx(x) for x in ('#0e2230', '#163246', '#20485e', '#2c6278', '#3e8094', '#62a4b4')],     # azulada
}
CASCA = '#4a3a36'


def _arvore_retorcida(variante='a'):
    """
    A árvore torta (1 x 1, 5 m): o tronco que entorta para um lado e volta, dois galhos grossos que se torcem para
    fora e sobem, os galhos finos, e a copa em três massas separadas (vê-se o galho entre elas), de cor estranha.
    """
    cx = cy = 0.375
    pal = COPA[variante]
    seed = {'a': 3, 'b': 5, 'c': 7}[variante]
    ot = novo()
    mc = mat_casca(CASCA, seed=seed, musgo='#3e4a3a')
    # o tronco: abre no pé (as raízes), entorta para -x, volta para +x e divide
    tronco = [(cx, cy, 0.0), (cx - 0.02, cy + 0.02, 0.35), (cx - 0.12, cy + 0.04, 0.9), (cx - 0.08, cy + 0.0, 1.4), (cx + 0.06, cy - 0.04, 1.85),
              (cx + 0.1, cy - 0.02, 2.25), (cx + 0.04, cy + 0.02, 2.6)]
    _tubo3(ot, tronco, [0.2, 0.15, 0.13, 0.12, 0.11, 0.1, 0.08], mc, lados=9)
    # as raízes que saem do pé
    for ang, ln in ((0.6, 0.38), (2.3, 0.32), (3.9, 0.36), (5.3, 0.3)):
        dx, dy = math.cos(ang), math.sin(ang)
        _tubo3(ot, [(cx + dx * 0.05, cy + dy * 0.05, 0.16), (cx + dx * ln * 0.6, cy + dy * ln * 0.6, 0.07), (cx + dx * ln, cy + dy * ln, 0.0)],
               [0.07, 0.05, 0.025], mc, lados=6)
    # os galhos grossos (do alto do tronco para os lados, torcendo para cima)
    galhos = [
        [(cx + 0.04, cy + 0.02, 2.5), (cx - 0.3, cy + 0.1, 2.85), (cx - 0.55, cy + 0.05, 3.05), (cx - 0.7, cy + 0.12, 3.45)],
        [(cx + 0.06, cy, 2.45), (cx + 0.38, cy - 0.12, 2.75), (cx + 0.5, cy - 0.04, 3.15), (cx + 0.68, cy - 0.1, 3.5)],
        [(cx + 0.04, cy + 0.02, 2.55), (cx + 0.02, cy + 0.12, 3.1), (cx - 0.1, cy + 0.06, 3.6), (cx - 0.02, cy - 0.04, 4.0)],
        [(cx - 0.08, cy + 0.0, 1.5), (cx - 0.36, cy + 0.14, 1.75), (cx - 0.5, cy + 0.32, 2.1)],
    ]
    for g in galhos:
        n = len(g)
        _tubo3(ot, g, [0.08 * (1 - 0.6 * i / (n - 1)) + 0.02 for i in range(n)], mc, lados=7)
    # a copa: três massas (uma em cada ponta de galho grosso) e a do galho baixo, pequena
    o = novo()
    rng = np.random.default_rng(seed)
    massas = [(cx - 0.72, cy + 0.1, 3.75, 0.62, 0.48), (cx + 0.7, cy - 0.08, 3.78, 0.6, 0.46), (cx - 0.02, cy - 0.04, 4.42, 0.58, 0.5),
              (cx - 0.52, cy + 0.34, 2.32, 0.34, 0.28)]
    centro = (cx, cy, 3.8)
    mat = mat_folha_torta(centro, (1.3, 1.3, 1.0), pal, seed)
    for (x, y, z, R, Rz) in massas:
        FF._cachos(o, x, y, z, R, Rz, int(46 * R), R * 0.16, R * 0.26, rng, mat, achata=0.8)
    peg(cx - 0.2, cx + 0.2, cy - 0.2, cy + 0.2)
    FF.pegada_redonda(cx + 0.05, cy + 0.05, 1.0)


def mat_folha_torta(centro, ext, pal, seed):
    """A folha da fazenda (tufos no material), na rampa de cor estranha da copa."""
    return FF.mat_folha(centro, ext, pal, q=0.1, seed=seed)


ARB = {
    'a': ([hx(x) for x in ('#3a2c0c', '#58420e', '#7a5e14', '#9c7c1c', '#bc9c2c', '#d8bc4c')], ('#2a5ad0', '#9ad4ff')),   # mostarda, bagas azuis
    'b': ([hx(x) for x in ('#22102c', '#361a46', '#4e2862', '#68387e', '#84509a', '#a46eb8')], ('#3a8ad8', '#c4ecff')),   # roxo, bagas azuladas
}


def _arbusto_estranho(variante='a'):
    """O arbusto da fazenda na rampa estranha e, por cima, os cachos de bagas redondas (bolinhas de 3 a 4 px com o brilho)."""
    pal, (cb, cl) = ARB[variante]
    sd = {'a': 11, 'b': 13}[variante]
    FF._arbusto(None, sd, pal)
    cx = cy = 0.375
    h = 0.9
    o = novo()
    rng = np.random.default_rng(sd + 40)
    mb = lambda Pc, N, P: np.where((N @ np.array([-0.4, 0.4, 0.82]) > 0.8)[:, None], hx(cl), hx(cb))
    for k in range(13):
        # um cacho de 2 a 3 bagas num ponto da casca (mais na frente e em cima)
        a = rng.uniform(0, 2 * math.pi)
        el = rng.uniform(0.15, 0.95)
        rx, rz = 0.4 * math.cos(el * 0.9), h * 0.48 * math.sin(el * 0.9)
        x, y, z = cx + math.cos(a) * rx * 1.1, cy + math.sin(a) * rx * 1.1, h * 0.5 + rz * 1.08
        for j in range(int(rng.integers(2, 4))):
            C().elipsoide((x + rng.uniform(-0.04, 0.04), y + rng.uniform(-0.04, 0.04), z + rng.uniform(-0.03, 0.03)), (0.04, 0.04, 0.04), mb, o)


# =====================================================================================================================
# a estátua de um dos Cinco Guardiões: o pedestal, o manto com capuz e o rosto apagado
# =====================================================================================================================
PEDRA_EST = '#8c8a82'


def mat_manto(cx, cy, seed=0):
    """O manto de pedra: as dobras em pé (o vol com faixas), o escorrido da chuva e o musgo subindo da barra."""
    def faixas(P, b):
        th = np.arctan2(P[:, 1] - cy, P[:, 0] - cx)
        k = np.sin(th * 9 + 0.8 * np.sin(P[:, 2] * 3.0))
        b = np.where((k > 0.6)[:, None], _tom(b, 1.1), b)
        b = np.where((k < -0.55)[:, None], _tom(b, 0.84), b)
        esc = suave(np.floor(th * 18), P[:, 2] / 0.7, 1.0, seed + 2) > 0.66
        b = np.where(esc[:, None], b * 0.88, b)
        mus = P[:, 2] < 0.75 + 0.35 * suave(np.floor(th * 14), 0.0, 1.8, seed + 3)
        mc = np.where((ruido(np.floor(th * 30), np.floor(P[:, 2] / 0.05), seed + 4.0) > 0.5)[:, None], hx(MUSGO_C), hx(MUSGO))
        return np.where(mus[:, None], mc, b)
    return vol(cx, cy, PEDRA_EST, faixas=faixas)


def mat_capuz(cx, cy, zc, frente=(0.0, 1.0)):
    """
    O capuz (elipsoide): a pedra com o musgo em cima e, na frente, a abertura funda e escura com o rosto apagado (a
    pedra lisa e gasta, sem traço nenhum) no fundo. Ponto da cena: a frente é +y.
    """
    def f(Pc, N, P):
        out = np.tile(hx(PEDRA_EST), (len(P), 1))
        # o musgo no alto do capuz
        mus = (N[:, 2] > 0.72) & (suave(np.floor(P[:, 0] / (2 * PH)), np.floor(P[:, 1] / (2 * PH)), 2.0, 61) > 0.42)
        out = np.where(mus[:, None], hx(MUSGO), out)
        # a abertura: na frente (o ponto em +y do centro), oval em pé
        dx = (P[:, 0] - cx) / 0.15
        dz = (P[:, 2] - (zc - 0.03)) / 0.2
        fr = (P[:, 1] - cy) > 0.0
        ab = fr & (dx * dx + dz * dz < 1.0)
        out = np.where(ab[:, None], hx('#2a2826'), out)
        # o rosto apagado: a pedra lisa, mais clara, no meio da sombra (sem olhos, sem boca)
        dx2, dz2 = (P[:, 0] - cx) / 0.085, (P[:, 2] - (zc - 0.07)) / 0.12
        rosto = fr & (dx2 * dx2 + dz2 * dz2 < 1.0)
        out = np.where(rosto[:, None], hx('#6e6c66'), out)
        out = np.where((rosto & (dx2 < -0.2) & (dz2 > 0.0))[:, None], hx('#7c7a72'), out)
        return out
    return f


def _estatua(variante='a'):
    """
    A estátua de um Guardião (2 x 2, 3,6 m): o pedestal em dois degraus de pedra lavrada, a figura encapuzada de manto
    comprido, os ombros e o capuz pontudo, o rosto apagado. a: as mãos juntas no peito, escondidas nas mangas; b: as
    duas mãos no punho da espada, de ponta no pedestal.
    """
    c = C()
    cx = cy = 0.75
    # o pedestal (dois degraus) com as juntas, o musgo subindo do chão e a placa gasta
    ob = novo()
    pm = mat_pedra('#86847c', seed=2, musgo=0.18, juntas=(0.42, 0.13))
    c.caixa((cx - 0.66, cx + 0.66, cy - 0.66, cy + 0.66, 0.0, 0.26), {'*': pm, 'cima': mat_pedra('#9a988e', seed=3, musgo=1)}, M, ob)
    ob2 = novo()
    c.caixa((cx - 0.5, cx + 0.5, cy - 0.5, cy + 0.5, 0.26, 0.62), {'*': mat_pedra('#8c8a82', seed=4, musgo=0.1, juntas=(0.5, 0.18)),
                                                                     'cima': mat_pedra('#a09e94', seed=5, musgo=1)}, M, ob2)
    z0 = 0.62
    # o manto (do pé até o peito) e os ombros
    om = novo()
    _poligono_rodado(cx, cy, [(z0, 0.4), (z0 + 0.08, 0.41), (z0 + 0.5, 0.36), (z0 + 1.2, 0.3), (z0 + 1.7, 0.28), (z0 + 1.95, 0.3)],
                     mat_manto(cx, cy, 6), om, lados=20)
    oo = novo()
    C().elipsoide((cx, cy, z0 + 1.98), (0.4, 0.3, 0.2), lambda Pc, N, P: mat_pedra_eli(PEDRA_EST, 0.78, 7)(Pc, N, P), oo)
    # a capa caída nas costas (um pano largo atrás, de pedra)
    _poligono_rodado(cx, cy - 0.06, [(z0 + 0.02, 0.36), (z0 + 1.0, 0.32), (z0 + 1.85, 0.34)], mat_manto(cx, cy - 0.06, 9), om, lados=20)
    # o capuz: a cabeça e a ponta caída para trás
    zc = z0 + 2.32
    oc = novo()
    C().elipsoide((cx, cy, zc), (0.2, 0.21, 0.27), mat_capuz(cx, cy, zc), oc)
    C().elipsoide((cx, cy - 0.1, zc + 0.12), (0.13, 0.14, 0.18), mat_pedra_eli(PEDRA_EST, 0.7, 8), oc)
    # o pescoço do capuz caindo nos ombros
    C().elipsoide((cx, cy - 0.02, zc - 0.22), (0.24, 0.22, 0.12), mat_pedra_eli(PEDRA_EST, 0.8, 9), oc)
    mb = mat_casca(PEDRA_EST, seed=4, musgo=None, riscas=0)
    ombro_e, ombro_d = (cx - 0.33, cy + 0.02, z0 + 1.98), (cx + 0.33, cy + 0.02, z0 + 1.98)
    oa = novo()
    if variante == 'a':
        # os braços dobrados, as mangas largas se encontrando na frente do peito
        _tubo3(oa, [ombro_e, (cx - 0.36, cy + 0.12, z0 + 1.6), (cx - 0.14, cy + 0.3, z0 + 1.55)], [0.11, 0.11, 0.13], mb, lados=8)
        _tubo3(oa, [ombro_d, (cx + 0.36, cy + 0.12, z0 + 1.6), (cx + 0.14, cy + 0.3, z0 + 1.55)], [0.11, 0.11, 0.13], mb, lados=8)
        C().elipsoide((cx, cy + 0.32, z0 + 1.56), (0.14, 0.08, 0.1), mat_pedra_eli(PEDRA_EST, 0.75, 11), oa)
    else:
        # a espada de ponta no pedestal, na frente; as mãos no punho
        ox = novo()
        ys = cy + 0.48
        lam = mat_pedra('#9a988e', seed=12, gasto=False)
        c.caixa((cx - 0.05, cx + 0.05, ys - 0.018, ys + 0.018, z0 + 0.12, z0 + 1.15), lam, M, ox)
        _quad(ox, [(cx - 0.05, ys + 0.018, z0 + 0.12), (cx + 0.05, ys + 0.018, z0 + 0.12), (cx, ys + 0.018, z0)], (cx, ys - 1, z0), lam)
        _quad(ox, [(cx - 0.05, ys - 0.018, z0 + 0.12), (cx + 0.05, ys - 0.018, z0 + 0.12), (cx, ys - 0.018, z0)], (cx, ys + 1, z0), lam)
        _quad(ox, [(cx + 0.05, ys + 0.018, z0 + 0.12), (cx + 0.05, ys - 0.018, z0 + 0.12), (cx, ys, z0)], (cx - 1, ys, z0 + 0.1), lam)
        _quad(ox, [(cx - 0.05, ys + 0.018, z0 + 0.12), (cx - 0.05, ys - 0.018, z0 + 0.12), (cx, ys, z0)], (cx + 1, ys, z0 + 0.1), lam)
        # o sulco do meio da lâmina
        c.caixa((cx - 0.008, cx + 0.008, ys + 0.017, ys + 0.022, z0 + 0.2, z0 + 1.1), liso('#7a786e'), M, ox)
        c.caixa((cx - 0.24, cx + 0.24, ys - 0.04, ys + 0.04, z0 + 1.15, z0 + 1.23), {'*': lam, 'cima': liso('#aaa89e')}, M, ox)
        c.cilindro(cx, ys, 0.032, z0 + 1.23, z0 + 1.48, vol(cx, ys, '#8a887e'), M, ox, lados=10)
        C().elipsoide((cx, ys, z0 + 1.53), (0.05, 0.05, 0.05), mat_pedra_eli('#9a988e', None, 13), ox)
        _tubo3(oa, [ombro_e, (cx - 0.4, cy + 0.16, z0 + 1.62), (cx - 0.08, ys - 0.02, z0 + 1.42)], [0.11, 0.1, 0.09], mb, lados=8)
        _tubo3(oa, [ombro_d, (cx + 0.4, cy + 0.16, z0 + 1.62), (cx + 0.08, ys - 0.02, z0 + 1.42)], [0.11, 0.1, 0.09], mb, lados=8)
        C().elipsoide((cx, ys - 0.01, z0 + 1.4), (0.13, 0.08, 0.08), mat_pedra_eli(PEDRA_EST, 0.75, 14), oa)
    peg(cx - 0.66, cx + 0.66, cy - 0.66, cy + 0.66)


# =====================================================================================================================
# o poço: a boca de pedra, a água escura, os esteios, o sarilho, o telhadinho de telha vermelha e o balde
# =====================================================================================================================
TELHA_V = ['#9a3424', '#a83c28', '#8e2e20', '#b04630']


def mat_telha_v(eixo_desce, z_alto):
    """A telha vermelha numa água do telhadinho: as fiadas (a junta escura embaixo de cada uma) e a capa de cada telha."""
    cs = np.stack([hx(x) for x in TELHA_V])

    def f(L, n, P):
        # ao longo do caimento (de cima para baixo) e ao longo da cumeeira (x)
        s = (z_alto - P[:, 2]) / 0.065
        fila = np.floor(s)
        col = np.floor(P[:, 0] / 0.09 + 0.5 * (fila % 2))
        k = (ruido(fila, col, 3.0) * len(cs)).astype(int) % len(cs)
        out = cs[k]
        fr = s - fila
        out = np.where((fr > 0.72)[:, None], _tom(out, 0.72), out)
        out = np.where((fr < 0.2)[:, None], _tom(out, 1.12), out)
        u = (P[:, 0] / 0.09 + 0.5 * (fila % 2)) % 1.0
        out = np.where((u < 0.12)[:, None], _tom(out, 0.78), out)
        return out
    return emissivo(f)


def _poco():
    c = C()
    cx = cy = 0.75
    R, Ri, zb = 0.52, 0.4, 0.72
    # a boca de pedra (as fiadas na volta) e a borda de lajes em cima
    o = novo()
    fn = FF.id_pedras_cil(cx, cy, 0.12, 0.3)
    pedra_ = FF.mat_juntas(['#8e8c84', '#84827a', '#96948a', '#7c7a72'], fn, '#4e4c46', seed=3, extra=FF._manchas_pedra)
    c.cilindro(cx, cy, R, 0, zb, pedra_, M, o, lados=24, tampa=False)
    ob = novo()
    c.cilindro(cx, cy, R + 0.04, zb, zb + 0.08, vol(cx, cy, '#a09e94'), M, ob, lados=24, tampa=False)
    lados = 24
    for i in range(lados):
        a0, a1 = 2 * math.pi * i / lados, 2 * math.pi * (i + 1) / lados
        tom = ['#aeaca2', '#a4a298', '#b6b4aa'][i % 3]
        fp([(cx + Ri * math.cos(a0), cy + Ri * math.sin(a0), zb + 0.08), (cx + (R + 0.04) * math.cos(a0), cy + (R + 0.04) * math.sin(a0), zb + 0.08),
            (cx + (R + 0.04) * math.cos(a1), cy + (R + 0.04) * math.sin(a1), zb + 0.08), (cx + Ri * math.cos(a1), cy + Ri * math.sin(a1), zb + 0.08)],
           (0, 0, 1), liso(tom), ob)
        am = (a0 + a1) / 2
        fp([(cx + Ri * math.cos(a1), cy + Ri * math.sin(a1), zb - 0.3), (cx + Ri * math.cos(a0), cy + Ri * math.sin(a0), zb - 0.3),
            (cx + Ri * math.cos(a0), cy + Ri * math.sin(a0), zb + 0.08), (cx + Ri * math.cos(a1), cy + Ri * math.sin(a1), zb + 0.08)],
           (-math.cos(am), -math.sin(am), 0), emissivo(lambda L, n, P: np.where((P[:, 2] > zb - 0.05)[:, None], hx('#5a5852'), hx('#34322e'))), ob)
    # a água lá embaixo: escura, com o reflexo do céu
    oa = novo(contorno=False)

    def agua(L, n, P):
        u = (P[:, 0] - P[:, 1]) / PH
        v = (P[:, 0] + P[:, 1]) / PH
        out = np.tile(hx('#141e24'), (len(P), 1))
        out = np.where(((np.abs(v - (cx + cy) / PH + 3) < 0.6) & (np.abs(u + 4) < 5))[:, None], hx('#4a6a78'), out)
        return out
    _disco(cx, cy, zb - 0.3, Ri, emissivo(agua), oa, lados=24)
    # os esteios de madeira (fora da boca, nos lados x) e o sarilho com a corda enrolada
    ow = novo()
    mw = {'*': mad2('#5e4430', eixo=1, seed=5, passo=0.05), 'cima': liso('#7a5a3e')}
    zt = 1.3
    for sx in (-1, 1):
        x = cx + sx * 0.6
        c.caixa((x - 0.05, x + 0.05, cy - 0.05, cy + 0.05, 0.0, zt), mw, M, ow)
    zs = 1.0
    osr = novo()

    def corda(P, b):
        en = (np.abs(P[:, 0] - cx) < 0.2)
        b = np.where(en[:, None], hx('#a89060'), b)
        return np.where((en & ((np.floor(P[:, 0] / (2 * PH)) % 2) == 0))[:, None], hx('#8a744a'), b)
    _tubo3(osr, [(cx - 0.56, cy, zs), (cx + 0.56, cy, zs)], [0.05, 0.05], emissivo(lambda L, n, P: corda(P, np.tile(hx('#6a4c34'), (len(P), 1)))), lados=8)
    _tubo3(osr, [(cx - 0.18, cy, zs), (cx + 0.18, cy, zs)], [0.075, 0.075], emissivo(lambda L, n, P: corda(P, np.tile(hx('#6a4c34'), (len(P), 1)))), lados=10)
    # a manivela do lado +x
    _tubo3(osr, [(cx + 0.65, cy, zs), (cx + 0.72, cy, zs)], [0.025, 0.025], liso(FERRO), lados=6)
    _tubo3(osr, [(cx + 0.72, cy, zs), (cx + 0.72, cy + 0.03, zs - 0.18)], [0.02, 0.02], liso(FERRO), lados=6)
    _tubo3(osr, [(cx + 0.72, cy + 0.03, zs - 0.18), (cx + 0.8, cy + 0.03, zs - 0.18)], [0.026, 0.026], liso('#6a4c34'), lados=6)
    # a corda descendo e o balde de aduelas pendurado na boca
    ok = novo()
    _tubo3(ok, [(cx, cy + 0.06, zs - 0.04), (cx, cy + 0.06, zb + 0.32)], [0.012, 0.012], liso('#a89060'), lados=5)
    bz = zb + 0.12

    def aros(P, b):
        z = P[:, 2] - bz
        return np.where(((np.abs(z - 0.03) < 0.012) | (np.abs(z - 0.15) < 0.012))[:, None], hx(FERRO_C), b)
    c.cilindro(cx, cy + 0.06, 0.09, bz, bz + 0.18, vol(cx, cy + 0.06, '#7a5636', faixas=aros, costuras=(6, '#4a3020', 0.1)), M, ok, lados=14,
               r1=0.11, tampa_mat=liso('#2a2018'))
    _tubo3(ok, [(cx - 0.1, cy + 0.06, bz + 0.18), (cx, cy + 0.06, bz + 0.32), (cx + 0.1, cy + 0.06, bz + 0.18)], [0.008] * 3, liso(FERRO), lados=4)
    # o telhadinho: duas águas de telha (cumeeira ao longo de x), o oitão de tábua e a cumeeira de telha
    zr, ze, ye = 1.4, 1.1, 0.46
    x0, x1 = cx - 0.74, cx + 0.74
    otl = novo()
    fp([(x0, cy, zr), (x1, cy, zr), (x1, cy + ye, ze), (x0, cy + ye, ze)], (0, ye, zr - ze), mat_telha_v(+1, zr), otl)
    fp([(x0, cy, zr), (x0, cy - ye, ze), (x1, cy - ye, ze), (x1, cy, zr)], (0, -ye, zr - ze), mat_telha_v(-1, zr), otl)
    # a beirada (a grossura da telha, embaixo das águas)
    for sy in (1, -1):
        y = cy + sy * ye
        fp([(x0, y, ze), (x1, y, ze), (x1, y, ze - 0.04), (x0, y, ze - 0.04)], (0, sy, 0), liso('#6a2418'), otl)
    for (xx, sx) in ((x0, -1), (x1, 1)):
        fp([(xx, cy - ye, ze), (xx, cy + ye, ze), (xx, cy + ye, ze - 0.04), (xx, cy - ye, ze - 0.04)], (sx, 0, 0), liso('#6a2418'), otl)
        fp([(xx, cy - ye, ze - 0.04), (xx, cy + ye, ze - 0.04), (xx, cy, zr - 0.04)], (sx, 0, 0), liso('#6a2418'), otl)
    ocu = novo()
    _tubo3(ocu, [(x0 - 0.02, cy, zr + 0.01), (x1 + 0.02, cy, zr + 0.01)], [0.04, 0.04], vol(cx, cy, '#8e2c1e'), lados=8)
    # a terça de baixo da cumeeira, de esteio a esteio (segura a telha)
    otc = novo()
    c.caixa((cx - 0.66, cx + 0.66, cy - 0.04, cy + 0.04, zt - 0.03, zt + 0.04), {'*': mad2('#5e4430', eixo=0, seed=9, passo=0.05), 'cima': liso('#7a5a3e')}, M, otc)
    FF.pegada_redonda(cx, cy, R + 0.06, 12)
    peg(cx - 0.65, cx + 0.65, cy - 0.06, cy + 0.06)


# =====================================================================================================================
ITENS = {
    'estatua_guardiao': (2, 2, (0.0, 0.0), lambda: _estatua('a'), {}),
    'estatua_guardiao~b': (2, 2, (0.0, 0.0), lambda: _estatua('b'), {}),
    'poste_cristal': (1, 1, (0.0, 0.0), lambda: _poste_cristal(True), {'1': lambda: _poste_cristal(False)}),
    'cristal_vermelho': (1, 1, (0.0, 0.0), lambda: _drusa('vermelho', True), {'1': lambda: _drusa('vermelho', False)}),
    'cristal_verde': (1, 1, (0.0, 0.0), lambda: _drusa('verde', True), {'1': lambda: _drusa('verde', False)}),
    'cristal_azul': (1, 1, (0.0, 0.0), lambda: _drusa('azul', True), {'1': lambda: _drusa('azul', False)}),
    'cristal_preto': (1, 1, (0.0, 0.0), lambda: _drusa('preto', False, alto=1.1), {}),
    'lodo_preto': (2, 2, (0.0, 0.0), _lodo, {}),
    'sebe': (1, 1, (0.0, 0.0), _sebe, {}),
    'arvore_retorcida': (1, 1, (0.0, 0.0), lambda: _arvore_retorcida('a'), {}),
    'arvore_retorcida~b': (1, 1, (0.0, 0.0), lambda: _arvore_retorcida('b'), {}),
    'arvore_retorcida~c': (1, 1, (0.0, 0.0), lambda: _arvore_retorcida('c'), {}),
    'arbusto_estranho': (1, 1, (0.0, 0.0), lambda: _arbusto_estranho('a'), {}),
    'arbusto_estranho~b': (1, 1, (0.0, 0.0), lambda: _arbusto_estranho('b'), {}),
    'poco': (2, 2, (0.0, 0.0), _poco, {}),
    'pedras': (1, 1, (0.0, 0.0), _pedras, {}),
}
