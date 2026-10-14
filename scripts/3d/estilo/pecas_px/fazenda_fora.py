"""
GRUPO C: a fazenda por fora (Fazenda · Olhos de Águia, os Arredores e o Pátio do orfanato), em pixel art 1:1 feita
só por código, no estilo da cozinha (agente_cozinha/cozinha.py) e do casarão visto de fora (agente_casarao/casarao.py).

Tudo desenhado no giro 4 (a frente para +y), a pegada começando em (0, 0), no tamanho do catálogo
(catalogo-lugares.json: def.height em unidades, metros = height / 1,633). O exportador (exportar_px.py) gira e faz o
acabamento (a luz das faces, o contorno de 1 px, a sombra macia pelas pegadas).

Como o acabamento do exportador é o da cozinha (sem o passe de folhas e de juntas do casarão), as folhas e as juntas
(telha, pedra, tábua) saem prontas do MATERIAL: a folha calcula o tufo (Voronoi no ponto da cena), a luz do tufo e
a borda de 1 px dele, e devolve a cor já compensada da luz que o motor e o exportador vão pôr por cima.

Peças que emendam em fila (cerca, baia, horta, milharal): o módulo de 1 casa corre ao longo de x; o poste fica na
quina x = 0 (meio para fora da casa) e as travessas vão até a face do poste da casa vizinha, então a fila fecha sem
degrau nem poste dobrado em todos os giros. A terra das leiras não tem contorno (a emenda não aparece).
"""
import math

import numpy as np

import cozinha as CZ
import base_estilo as BE
from base_estilo import hx, liso, mad2, tab2, _tom, _cru, PZ, PH, coords, vol, _fita, _disco, _poligono_rodado
from motor import ruido, suave, emissivo, Q, KX, KY, KZ, MUNDO as M

CASA = 0.75
UM = 1 / 1.633            # 1 unidade de altura do jogo em metros


# =====================================================================================================================
# o básico
# =====================================================================================================================
def _c():
    return CZ.c


def obj(contorno=True, sombra=True):
    return CZ.c.novo_obj(3, contorno=contorno, sombra=sombra)


def caixa(b, mat, o=None, contorno=True):
    o = obj(contorno) if o is None else o
    CZ.c.caixa(b, mat, M, o)
    return o


def fp(pts, n, mat, o, dois_lados=False):
    CZ.c.face_plana(pts, n, mat, M, o, dois_lados)


def pegada(x0, x1, y0, y1):
    CZ.pegadas.append((x0, x1, y0, y1))


def pegada_redonda(cx, cy, r, passos=15):
    """A sombra macia redonda: faixas que formam o disco (a sombra do exportador é feita de retângulos)."""
    for i in range(passos):
        a = -1 + (i + 0.5) * 2 / passos
        h = math.sqrt(max(0.0, 1 - a * a)) * r
        y0 = cy + (a - 1 / passos) * r
        y1 = cy + (a + 1 / passos) * r
        CZ.pegadas.append((cx - h, cx + h, y0, y1))


def n_mundo(n):
    return BE.n_mundo(n)


def _tela_dir(v):
    """Quanto anda na tela (dx, dy em px) um metro na direção local v (já girada para o mundo)."""
    w = n_mundo(np.asarray(v, float))
    return np.array([(w[0] - w[1]) * KX, (w[0] + w[1]) * KY - w[2] * KZ])


def _px_vertical(eixo_a, eixo_s):
    """Metros, ao longo de eixo_s, que dão 1 px na vertical da tela andando no plano (a, s) com a tela parada em x."""
    A, B = _tela_dir(eixo_a), _tela_dir(eixo_s)
    if abs(A[0]) < 1e-6:
        dy = abs(B[1])
    else:
        dy = abs(B[1] - A[1] * B[0] / A[0])
    return 1.0 / max(dy, 1e-3)


# a luz que o motor (elipsoide) e o exportador (face) põem: para o material que já traz a cor final
_LD_ELI = np.array([-0.35, 0.45, 1.0]) / np.linalg.norm([-0.35, 0.45, 1.0])
_Q1 = np.array([-10.0, -4.0, 14.0])
_Q2 = np.array([16.0, 4.0, -10.0])


def _cru_eli(cor, N):
    """A cor que, depois da luz do elipsoide (motor) e da luz da face (exportador), vira exatamente `cor`."""
    d = np.clip(N @ _LD_ELI, 0, 1)
    f1 = Q(0.62 + 0.42 * d, 1 / 0.09)[:, None]
    nz, nx, ny = N[:, 2], N[:, 0], N[:, 1]
    f2 = np.where(nz > 0.6, 1.0, np.where(ny >= nx, 0.84, 0.66))[:, None]
    c1 = (cor - (1 - f2) * _Q2) / f2
    return (c1 - (1 - f1) * _Q1) / f1


def mat_cor(cores, ids_fn, seed=0):
    cs = np.stack([hx(x) for x in cores])

    def f(L, n, P):
        ids = ids_fn(L, n)
        k = (ruido(ids * 0.37, seed + 1.3) * len(cs)).astype(int) % len(cs)
        return cs[k]
    return emissivo(f)


def velho(cor, k=0.62, clareia=6):
    """
    A cor gasta pelo tempo (a fazenda está abandonada há mais de um ano): a madeira e a tinta perdem a cor e puxam
    para o cinza-prata do sol e da chuva (um fio quente sobra).
    """
    c0 = hx(cor) if isinstance(cor, str) else np.asarray(cor, float)
    lum = c0 @ np.array([0.3, 0.59, 0.11])
    cinza = lum * np.array([1.0, 0.97, 0.92]) + clareia
    out = np.clip(c0 * (1 - k) + cinza * k, 0, 255)
    return '#%02x%02x%02x' % tuple(np.round(out).astype(int))


def _menos(pal, k=0.18):
    """A rampa de folha um pouco menos saturada."""
    out = []
    for c0 in pal:
        lum = c0 @ np.array([0.3, 0.59, 0.11])
        out.append(c0 * (1 - k) + lum * k)
    return out


# =====================================================================================================================
# as folhas (árvore, arbusto): o tufo no material
# =====================================================================================================================
FOLHA_PAL = [hx(x) for x in ('#1d3519', '#2a4c23', '#3a682c', '#4f8636', '#6ea444', '#94c058')]
FOLHA_PAL_B = [hx(x) for x in ('#24361a', '#344f22', '#4a6c2a', '#648a34', '#86a642', '#b0c460')]   # mais amarelada
FOLHA_PAL_C = [hx(x) for x in ('#13291f', '#1c3a2a', '#285034', '#346a40', '#4a8650', '#6aa266')]   # o pinheiro (azulado)
# a fazenda está largada: a natureza continua, mas um tom menos viva
FOLHA_PAL, FOLHA_PAL_B, FOLHA_PAL_C = _menos(FOLHA_PAL), _menos(FOLHA_PAL_B), _menos(FOLHA_PAL_C, 0.12)
# o mato que cresce sem ninguém cortar (verde-palha) e a planta que secou
MATO_PAL = [hx(x) for x in ('#2a3018', '#3c4422', '#525c2c', '#6c7436', '#8a8c44', '#a8a45a')]
SECO_PAL = [hx(x) for x in ('#2e2414', '#43341c', '#5a4626', '#745c32', '#8e7442', '#a88c56')]
LD_FOLHA = np.array([-0.55, 0.3, 0.8]) / np.linalg.norm([-0.55, 0.3, 0.8])


def mat_folha(centro, ext, pal=FOLHA_PAL, q=0.11, seed=0, flores=None, clareia=0.0):
    """
    As folhas em tufos: Voronoi no ponto da cena (o tufo não gira com o giro), cada tufo num tom só pela luz da normal
    média dele e pela posição na copa inteira (em cima à esquerda acende), em 6 degraus; a borda de baixo do tufo um
    tom abaixo e a de cima um acima. flores: (cor, miolo) a florzinha de 3 px no meio de alguns tufos acesos.
    Material de ELIPSOIDE: N é a normal no mundo; devolve a cor já compensada da luz.
    """
    centro = np.asarray(centro, float)
    ext = np.asarray(ext, float)
    pal = np.stack(pal)

    def f(Lc, N, P):
        G = P / q
        I = np.floor(G)
        b1 = np.full(len(P), 1e9)
        b2 = np.full(len(P), 1e9)
        s1 = np.zeros((len(P), 3))
        s2 = np.zeros((len(P), 3))
        id1 = np.zeros(len(P), np.int64)
        for dx in (-1, 0, 1):
            for dy in (-1, 0, 1):
                for dz in (-1, 0, 1):
                    cc = I + np.array([dx, dy, dz])
                    pp = cc + 0.15 + 0.7 * np.stack([ruido(cc[:, 0], cc[:, 1], cc[:, 2] + seed), ruido(cc[:, 1], cc[:, 2], cc[:, 0] + 3 + seed),
                                                     ruido(cc[:, 2], cc[:, 0], cc[:, 1] + 7 + seed)], 1)
                    d = ((G - pp) ** 2).sum(1)
                    m1 = d < b1
                    m2 = ~m1 & (d < b2)
                    b2 = np.where(m1, b1, np.where(m2, d, b2))
                    s2 = np.where(m1[:, None], s1, np.where(m2[:, None], pp, s2))
                    b1 = np.where(m1, d, b1)
                    s1 = np.where(m1[:, None], pp, s1)
                    id1 = np.where(m1, (cc[:, 0] * 73856093 + cc[:, 1] * 19349663 + cc[:, 2] * 83492791).astype(np.int64), id1)
        # a distância até a borda do tufo (o plano do meio entre as duas sementes), em metros
        dS = np.linalg.norm(s2 - s1, axis=1) * q
        borda_d = (b2 - b1) * q * q / np.maximum(2 * dS, 1e-6)
        # a luz do pixel (pela normal no mundo) e da copa (a posição do pixel nela, girada para o mundo)
        l_px = np.clip(N @ LD_FOLHA, 0, 1)
        u = (P - centro) / ext
        uw = BE.n_mundo(u) if u.ndim == 2 else u
        l_copa = np.clip(0.5 + 0.5 * (uw @ LD_FOLHA) * 1.15, 0, 1)
        l = 0.1 + 0.9 * (0.45 * l_px + 0.55 * l_copa) + clareia
        un, inv = np.unique(id1, return_inverse=True)
        lc = np.bincount(inv, l) / np.bincount(inv)
        L = 0.85 * lc[inv] + 0.15 * l
        nv = np.digitize(L, [0.2, 0.33, 0.47, 0.62, 0.78])
        # a borda de baixo do tufo um tom abaixo (a sombra do tufo de cima); a de cima, nos tons do meio, um acima
        borda = borda_d < PH * 1.05
        Sz = s1[:, 2] * q
        baixo = borda & (P[:, 2] < Sz - 0.01)
        cima = borda & (P[:, 2] > Sz + 0.03) & (nv >= 2) & (nv <= 3)
        nv = np.where(baixo, nv - 1, np.where(cima, nv + 1, nv))
        nv = np.clip(nv, 0, len(pal) - 1)
        out = pal[nv]
        if flores is not None:
            cf, cm = hx(flores[0]), hx(flores[1])
            tem = (ruido(id1 % 100003 * 0.37, 9.1 + seed) > 0.5) & (nv >= 2)
            sp = s1 * q
            dd = P - sp
            # a cruzinha (pela tela: 1 px para cada lado e para cima), o miolo no meio
            dh = np.hypot(dd[:, 0], dd[:, 1])
            dl = dh / PH + np.abs(dd[:, 2]) / PZ
            pet = tem & (dl < 2.3)
            mio = tem & (dl < 0.9)
            out = np.where(pet[:, None], cf * (0.86 + 0.14 * (nv >= 4))[:, None], out)
            out = np.where(mio[:, None], cm, out)
        return _cru_eli(out, N)
    return f


def _cachos(o, cx, cy, zc, R, Rz, n, rmin, rmax, rng, mat, achata=0.85, corte=None, sobe=0.75):
    """A copa em cachos: o miolo e n cachos pequenos pela casca (mais em cima e na frente): a borda em dentes."""
    c = CZ.c
    c.elipsoide((cx, cy, zc), (R * 0.84, R * 0.84, Rz * 0.84), mat, o, corte_z=corte)
    for i in range(n):
        u = rng.normal(size=3)
        u[2] = abs(u[2]) * 0.8 + 0.1 if rng.random() < sobe else -abs(u[2]) * 0.6
        u /= np.linalg.norm(u)
        p = (cx + u[0] * R * 0.86, cy + u[1] * R * 0.86, zc + u[2] * Rz * 0.86)
        rr = rmin + (rmax - rmin) * rng.random()
        c.elipsoide(p, (rr, rr, rr * achata), mat, o, corte_z=corte)


# =====================================================================================================================
# árvore e arbusto
# =====================================================================================================================
def _tronco(cx, cy, H, r0=0.17, r1=0.11, cor='#5e4029'):
    c = CZ.c
    o = obj()

    def casca(P, base):
        th = np.arctan2(P[:, 1] - cy, P[:, 0] - cx)
        k = np.floor((th / (2 * math.pi) * 11 + 11 + 0.3 * np.sin(P[:, 2] * 2.3)) % 11)
        base = np.where((k % 3 == 0)[:, None], _tom(base, 0.82), base)
        base = np.where((k % 3 == 1)[:, None], _tom(base, 1.06), base)
        return base
    c.cilindro(cx, cy, r0, 0, H, vol(cx, cy, cor, faixas=casca), M, o, lados=14, r1=r1, tampa=False)
    # o pé que abre (as raízes)
    c.cilindro(cx, cy, r0 * 1.55, 0, 0.1, vol(cx, cy, cor), M, o, lados=14, r1=r0, tampa=False)
    return o


def _galhos(cx, cy, z0, galhos, cor='#5a3c26'):
    """Os galhos abrindo do tronco para a copa (fitas de frente para a câmera: iguais nos 4 giros)."""
    o = obj()
    m = liso(cor)
    for pts in galhos:
        _fita([(s, z0 + z) for (s, z) in pts], cx, cy, m, o, 0.085)
    return o


def _arvore(variante='a'):
    cx = cy = 0.375
    H = 8.98 * UM               # 5,5 m: o topo da copa
    if variante == 'a':
        # a copa larga e redonda (a do terreiro): o miolo, as massas dos lados, a saia de baixo e o topo
        R, seed, pal, cor_t = 1.45, 4, FOLHA_PAL, '#5e4029'
        zc = H - R * 0.95
        _tronco(cx, cy, zc - 0.3)
        _galhos(cx, cy, 0, [[(0, 1.5), (-0.42, 2.3), (-0.62, 2.75)], [(0, 1.75), (0.45, 2.45), (0.66, 2.8)]])
        massas = ((0, 0, 0, 0.98, 1.0), (-R * 0.5, R * 0.32, -R * 0.3, 0.66, 0.9), (R * 0.42, -R * 0.4, R * 0.1, 0.68, 0.9),
                  (-R * 0.12, -R * 0.12, R * 0.34, 0.6, 0.85), (R * 0.42, R * 0.42, -R * 0.42, 0.56, 0.85), (0, 0, -R * 0.58, 0.66, 0.7))
        ext = (R * 1.5, R * 1.5, R * 1.3)
    elif variante == 'b':
        # a copa alta e oval, mais clara (amarelada)
        R, seed, pal, cor_t = 1.08, 9, FOLHA_PAL_B, '#6a4a30'
        zc = H - R * 1.62
        _tronco(cx, cy, zc - 0.5, r0=0.15, r1=0.1, cor=cor_t)
        _galhos(cx, cy, 0, [[(0, 1.4), (-0.32, 2.15)], [(0, 1.65), (0.36, 2.4)]], cor='#64462c')
        massas = ((0, 0, 0, 1.0, 1.0), (0, 0, R * 0.8, 0.8, 1.0), (-R * 0.42, R * 0.3, -R * 0.5, 0.62, 0.9), (R * 0.42, -R * 0.2, -R * 0.38, 0.64, 0.9),
                  (R * 0.3, R * 0.3, R * 0.35, 0.6, 0.9))
        ext = (R * 1.35, R * 1.35, R * 2.0)
    else:
        return _pinheiro()
    o = obj()
    rng = np.random.default_rng(seed)
    centro = (cx, cy, zc + R * 0.2)
    mat = mat_folha(centro, ext, pal, seed=seed)
    for (ox_, oy_, oz_, kr, kz) in massas:
        _cachos(o, cx + ox_, cy + oy_, zc + oz_, R * kr, R * 0.9 * kr * kz, int(60 * kr), R * 0.1, R * 0.16, rng, mat)
    pegada(cx - 0.22, cx + 0.22, cy - 0.22, cy + 0.22)
    pegada_redonda(cx + 0.05, cy + 0.05, R * 0.8)


def _pinheiro():
    """O pinheiro: o tronco reto e a copa em andares (discos de tufos azulados que caem para fora), a ponta fina."""
    cx = cy = 0.375
    H = 8.98 * UM
    _tronco(cx, cy, H * 0.5, r0=0.15, r1=0.09, cor='#5a3a26')
    o = obj()
    rng = np.random.default_rng(17)
    ext = (1.1, 1.1, 2.4)
    mat = mat_folha((cx, cy, H * 0.55), ext, FOLHA_PAL_C, q=0.09, seed=17)
    andares = 6
    for i in range(andares):
        t = i / (andares - 1)
        z = 1.05 + t * 3.55
        r = 1.12 * (1 - t) + 0.34 * t
        _cachos(o, cx, cy, z, r, 0.36, int(22 + 36 * (1 - t)), 0.1, 0.16, rng, mat, achata=0.75, sobe=0.6)
    CZ.c.elipsoide((cx, cy, H - 0.55), (0.2, 0.2, 0.36), mat, o)
    _cachos(o, cx, cy, H - 0.42, 0.16, 0.3, 8, 0.07, 0.1, rng, mat, sobe=0.9)
    pegada(cx - 0.2, cx + 0.2, cy - 0.2, cy + 0.2)
    pegada_redonda(cx + 0.05, cy + 0.05, 0.95)


def _arbusto(flores=None, seed=0, pal=FOLHA_PAL):
    cx = cy = 0.375
    h = 1.47 * UM               # 0,9 m
    r = 0.4
    o = obj()
    rng = np.random.default_rng(seed + 21)
    mat = mat_folha((cx, cy, h * 0.5), (r * 1.2, r * 1.2, h * 0.6), pal, q=0.07, seed=seed, flores=flores)
    zc = h * 0.5
    _cachos(o, cx, cy, zc, r, h * 0.48, 34, r * 0.2, r * 0.32, rng, mat, corte=0.0)
    _cachos(o, cx - 0.1, cy + 0.06, zc + 0.12, r * 0.6, h * 0.3, 10, r * 0.2, r * 0.28, rng, mat, corte=0.0)
    pegada_redonda(cx, cy, r * 1.05, 4)


# =====================================================================================================================
# as cercas (emendam em fila ao longo de x)
# =====================================================================================================================
MAD_CERCA = velho('#8a6040')
MAD_CERCA_E = velho('#5e3e26', 0.55)


def _poste(x, y, larg, alto, cor=MAD_CERCA_E, topo=velho('#9a7450'), ponta=True):
    """O poste quadrado com a ponta chanfrada (o topo em pirâmide baixa), o veio em pé."""
    c = CZ.c
    o = obj()
    m = {'*': mad2(cor, eixo=1, seed=3, passo=0.06), 'cima': liso(topo)}
    h = larg / 2
    zt = alto - (0.05 if ponta else 0)
    c.caixa((x - h, x + h, y - h, y + h, 0, zt), m, M, o)
    if ponta:
        ap = (x, y, alto)
        mt = mad2(topo, eixo=1, seed=4)
        for (a, b, n) in (((x - h, y + h), (x + h, y + h), (0, 0.7, 0.7)), ((x + h, y + h), (x + h, y - h), (0.7, 0, 0.7)),
                          ((x + h, y - h), (x - h, y - h), (0, -0.7, 0.7)), ((x - h, y - h), (x - h, y + h), (-0.7, 0, 0.7))):
            c.face_plana([(a[0], a[1], zt), (b[0], b[1], zt), ap], n, mt, M, o)
    return o


def _travessa(x0, x1, y, z, esp, alt, cor=MAD_CERCA, o=None):
    o = obj() if o is None else o
    m = {'*': mad2(cor, eixo=0, seed=int(z * 100), passo=0.05), 'cima': mad2(_hex(_tom(hx(cor), 1.18)), eixo=0, seed=7, passo=0.05)}
    CZ.c.caixa((x0, x1, y - esp / 2, y + esp / 2, z, z + alt), m, M, o)
    return o


def _hex(c):
    c = np.clip(np.round(np.asarray(c, float)), 0, 255).astype(int)
    return '#%02x%02x%02x' % tuple(c)


def _cerca():
    """A cerca de madeira (1,1 m): o poste na quina x = 0 e duas travessas que vão até o poste da casa vizinha."""
    y = 0.375
    alto = 1.8 * UM
    lp = 0.12
    _poste(0.0, y, lp, alto)
    for z in (0.36, 0.76):
        _travessa(lp / 2, CASA - lp / 2, y + 0.01, z, 0.05, 0.11)
    pegada(-0.06, CASA, y - 0.06, y + 0.06)


def _baia():
    """A cerca da baia (1,4 m): o mourão grosso na quina e as tábuas largas fechadas embaixo, a travessa em cima."""
    y = 0.375
    alto = 2.29 * UM
    lp = 0.15
    _poste(0.0, y, lp, alto, cor=velho('#5a3a22', 0.55), topo=velho('#86603c'))
    c = CZ.c
    # as tábuas de baixo (deitadas, encostadas umas nas outras, com a fresta escura)
    o = obj()
    x0, x1 = lp / 2, CASA - lp / 2
    tab = tab2([velho('#9a6a40'), velho('#8e623a'), velho('#a27046', 0.7)], 0.16, '#2e2620', eixo=1, seed=11, org=0.06)
    c.caixa((x0, x1, y - 0.025, y + 0.025, 0.06, 0.06 + 0.16 * 4), {'*': tab, 'cima': liso(velho('#b48452'))}, M, o)
    # a travessa de cima e a diagonal (a mão-francesa) na frente das tábuas
    _travessa(x0, x1, y, alto - 0.3, 0.07, 0.12, cor=velho('#7a5232'))
    o2 = obj()
    mt = liso(velho('#7e5434'))
    d = 0.05
    for lado in (1, -1):
        yy = y + lado * 0.03
        n = (0, lado, 0)
        pts = [(x0 + 0.02, yy, 0.1), (x0 + 0.02, yy, 0.1 + d * 2.2), (x1 - 0.02, yy, 0.06 + 0.64 - 0.02), (x1 - 0.02, yy, 0.06 + 0.64 - 0.02 - d * 2.2)]
        if lado < 0:
            pts = pts[::-1]
        c.face_plana(pts, n, mt, M, o2)
    pegada(-0.075, CASA, y - 0.06, y + 0.06)


# =====================================================================================================================
# juntas de 1 px no material (pedra, laje): a célula do pixel comparada com a do pixel de baixo e a do da direita
# =====================================================================================================================
def mat_juntas(cores, fn, junta, seed=0, luz=1.12, sombra=0.86, lado=1.05, so_baixo=False, extra=None):
    """
    cores: os tons da célula (sorteados pelo id); fn(P) -> id da célula (no ponto da cena). A junta escura de 1 px
    embaixo e à direita de cada célula (na tela), a luz logo abaixo da junta (o alto da pedra) e a sombra logo acima.
    """
    cs = np.stack([hx(x) for x in cores])
    jc = hx(junta)

    def f(L, n, P):
        n = np.asarray(n, float)
        h, rv = BE.frente_tela()
        if abs(n[2]) > 0.5:
            dv = np.array([h[0], h[1], 0.0]) * 0.034
        else:
            dv = np.array([0.0, 0.0, -PZ])
        dr = np.array([rv[0], rv[1], 0.0]) * PH * 1.15
        i0 = fn(P)
        ib = fn(P + dv)
        ia = fn(P - dv)
        ir = fn(P + dr)
        il = fn(P - dr)
        iar = fn(P - dv + dr)
        jb = i0 != ib
        jr = (i0 != ir) & (not so_baixo)
        jun = jb | jr
        ja = (ia != i0) | ((ia != iar) & (not so_baixo))
        jl = (il != i0) & (not so_baixo)
        ib2 = fn(P + 2 * dv)
        so = (ib != ib2) & ~jun
        k = (ruido(i0 * 0.37, seed + 1.3) * len(cs)).astype(int) % len(cs)
        out = cs[k]
        if extra is not None:
            out = extra(L, n, P, out, i0)
        out = np.where((jl & ~jun)[:, None], out * lado, out)
        out = np.where((so & ~ja)[:, None], out * sombra, out)
        out = np.where((ja & ~jun)[:, None], np.minimum(out * luz + 4, 255), out)
        return np.where(jun[:, None], jc, out)
    return emissivo(f)


def id_pedras_cil(cx, cy, alt=0.15, ang=0.36, desloc=0.5):
    """As pedras em fiadas na volta de um cilindro (a bacia): a fiada pela altura, a pedra pelo ângulo."""
    def fn(P):
        fila = np.floor(P[:, 2] / alt + 50)
        th = np.arctan2(P[:, 1] - cy, P[:, 0] - cx) + 4
        col = np.floor(th / ang + desloc * (fila % 2))
        return (fila * 1000 + col).astype(np.int64)
    return fn


def id_pedras_parede(alt=0.14, comp=0.3, seed=0):
    """Pedras em fiadas desencontradas numa parede (o comprimento de cada uma varia um pouco)."""
    def fn(P):
        fila = np.floor((P[:, 2] + 3.0) / alt)
        lat = P[:, 0] - P[:, 1]
        off = ruido(fila, seed) * comp
        g = (lat + off) / comp
        col = np.floor(g + 0.3 * np.sin(fila * 1.7 + np.floor(g) * 2.3))
        return (fila * 1000 + col).astype(np.int64)
    return fn


# =====================================================================================================================
# a horta e o milharal (a leira de terra emenda ao longo de x)
# =====================================================================================================================
TERRA_C = ['#6a4628', '#5e3e22', '#74502e']


def mat_terra(seed=0):
    cs = np.stack([hx(x) for x in TERRA_C])

    def f(L, n, P):
        # torrões de 2 px (blocos na grade de 2 px), três tons, e umas pedrinhas claras
        bx = np.floor(P[:, 0] / (2 * PH))
        by = np.floor(P[:, 1] / (2 * PH))
        bz = np.floor(P[:, 2] / (2 * PZ))
        r = ruido(bx, by + bz * 7, seed)
        out = cs[(r * 3).astype(int) % 3]
        return np.where((r > 0.965)[:, None], hx('#a08060'), out)
    return emissivo(f)


def _leira(y0=0.15, y1=0.6, zt=0.12, k=0.1, seed=0):
    """A leira: o monte de terra comprido ao longo de x (0 a 0,75), o topo achatado e os lados inclinados; sem contorno."""
    c = CZ.c
    o = obj(contorno=False)
    m = mat_terra(seed)
    x0, x1 = -0.004, CASA + 0.004
    a0, a1 = y0 + k, y1 - k
    c.face_plana([(x0, a0, zt), (x1, a0, zt), (x1, a1, zt), (x0, a1, zt)], (0, 0, 1), m, M, o)
    s = zt / k
    nf = np.array([0, 1.0, 1 / s]); nf /= np.linalg.norm(nf)
    c.face_plana([(x0, a1, zt), (x1, a1, zt), (x1, y1, 0), (x0, y1, 0)], tuple(nf), m, M, o)
    c.face_plana([(x1, a0, zt), (x0, a0, zt), (x0, y0, 0), (x1, y0, 0)], (0, -nf[1], nf[2]), m, M, o)
    # as pontas (só aparecem na ponta da fila; a do meio fica escondida pela vizinha)
    for x, sg in ((x1, 1), (x0, -1)):
        pts = [(x, y0, 0), (x, a0, zt), (x, a1, zt), (x, y1, 0)]
        c.face_plana(pts if sg < 0 else pts[::-1], (sg, 0, 0), m, M, o)
    pegada(0, CASA, y0 + 0.02, y1 - 0.02)
    return o


def _folha_fita(o, cx, cy, pts, larg, mat):
    """Uma folha comprida de frente para a câmera: pts [(s, z)], larg a largura em cada ponto (afina na ponta)."""
    h, r = BE.frente_tela()
    for i in range(len(pts) - 1):
        (s0, z0), (s1, z1) = pts[i], pts[i + 1]
        w0, w1 = larg[i] / 2, larg[i + 1] / 2
        ds, dz = s1 - s0, z1 - z0
        l = math.hypot(ds, dz) or 1e-6
        ps, pz = -dz / l, ds / l
        q = [(s0 + ps * w0, z0 + pz * w0), (s1 + ps * w1, z1 + pz * w1), (s1 - ps * w1, z1 - pz * w1), (s0 - ps * w0, z0 - pz * w0)]
        CZ.c.face_plana([(cx + s * r[0], cy + s * r[1], z) for (s, z) in q], (h[0], h[1], 0), mat, M, o, dois_lados=True)


def mat_chapado(cor):
    """A cor chapada que sai igual em qualquer face (já compensada da luz da face)."""
    c0 = hx(cor)

    def f(L, n, P):
        return _cru(np.tile(c0, (len(P), 1)), n)
    return emissivo(f)


def _pe_milho(cx, cy, h, seed, torto=0.0, quebra=None):
    """
    O pé de milho SECO (a roça largada): o colmo cor de palha, as folhas secas penduradas e rasgadas, a espiga seca
    com a palha aberta e o pendão ralo. torto: quanto o colmo deita (para o lado na tela, m por m de altura).
    quebra: (z, deita) o colmo quebrado em z e a ponta caída para o lado.
    """
    rng = np.random.default_rng(seed)
    o = obj()
    seco = ['#a08a52', '#8e7846', '#b09a5e', '#7e6a40', '#9a7e4a']

    def eixo(z):
        """O ponto do colmo na altura z (s para o lado na tela, z de verdade)."""
        if quebra is not None and z > quebra[0]:
            zq = quebra[0]
            s0 = torto * zq
            d = z - zq
            return (s0 + d * quebra[1], zq + d * math.sqrt(max(0.0, 1 - quebra[1] ** 2)))
        return (torto * z, z)
    zs = np.linspace(0, h * 0.92, 7)
    _folha_fita(o, cx, cy, [eixo(z) for z in zs], [0.05, 0.045, 0.04, 0.035, 0.032, 0.03, 0.025], mat_chapado('#9a8650'))
    nf = 6
    for k in range(nf):
        t = k / (nf - 1)
        z = h * (0.14 + 0.66 * t)
        s0, z0 = eixo(z)
        lado = 1 if (k + seed) % 2 else -1
        comp = 0.36 * (1 - 0.4 * t) + 0.06 * rng.random()
        # a folha seca: sobe pouco e cai pendurada (as de baixo quase retas para baixo)
        sobe = 0.06 + 0.06 * rng.random()
        cai = 0.45 + 0.25 * (1 - t)
        pts = []
        for j in range(6):
            u = j / 5
            pts.append((s0 + lado * comp * u * (0.8 - 0.3 * u), z0 + sobe * math.sin(u * 2.0) - cai * u * u))
        larg = [0.06, 0.07, 0.06, 0.045, 0.03, 0.015] if rng.random() > 0.35 else [0.06, 0.07, 0.05, 0.02, 0.02, 0.012]
        _folha_fita(o, cx, cy, pts, larg, mat_chapado(seco[(k + seed) % 5]))
    lado = 1 if seed % 2 else -1
    se, ze = eixo(h * 0.5)
    _folha_fita(o, cx, cy, [(se, ze), (se + lado * 0.05, ze + h * 0.04), (se + lado * 0.08, ze + h * 0.12), (se + lado * 0.07, ze + h * 0.17)],
                [0.07, 0.085, 0.07, 0.04], mat_chapado('#c0a870'))
    _folha_fita(o, cx, cy, [(se + lado * 0.07, ze + h * 0.16), (se + lado * 0.09, ze + h * 0.2)], [0.04, 0.025], mat_chapado('#5e4228'))
    st, zt = eixo(h * 0.92)
    for (ds, dz) in ((-0.06, 0.12), (0.03, 0.15), (0.07, 0.1)):
        _folha_fita(o, cx, cy, [(st, zt), (st + ds * 0.6, zt + dz * 0.5), (st + ds * 1.2, zt + dz * 0.75)], [0.026, 0.022, 0.016], mat_chapado('#8a7448'))


def _milharal():
    _leira(0.12, 0.63, 0.1, 0.1, seed=3)
    h = 3.1 * UM - 0.14          # 1,9 m com o pendão
    # três pés por casa: um quase em pé, um torto e um quebrado no meio, com a ponta caída
    pes = ((0.125, -0.05, 0.94, 0.1, None), (0.375, 0.07, 1.0, -0.16, None), (0.625, -0.05, 0.9, 0.06, (0.85, 0.82)))
    for i, (x, dy, k, torto, quebra) in enumerate(pes):
        _pe_milho(x, 0.375 + dy, h * k, seed=i, torto=torto, quebra=quebra)
    # o mato baixo que tomou a leira
    _matinho(0.12, 0.63, seed=4, n=5)


COUVE = [hx(x) for x in ('#1f3a2a', '#2c5238', '#3c6c46', '#548a58', '#74a86c', '#9cc48a')]
ALFACE = [hx(x) for x in ('#2a4618', '#3c6420', '#548428', '#70a232', '#94c044', '#bcdc66')]


def _matinho(y0, y1, seed=0, n=6, alto=0.32, o=None):
    """O mato que cresce na leira largada: tufos de capim (folhas finas de frente para a câmera), verde-palha."""
    rng = np.random.default_rng(seed + 50)
    o = obj() if o is None else o
    cores = [mat_chapado(x) for x in ('#6c7436', '#8a8c44', '#5a6230', '#a09a58')]
    for k in range(n):
        x = 0.06 + (k + rng.random() * 0.8) * (CASA - 0.12) / n
        y = y0 + 0.08 + rng.random() * (y1 - y0 - 0.16)
        z0 = 0.09
        for j in range(3 + int(rng.random() * 3)):
            a = (rng.random() - 0.5) * 0.9
            hh = alto * (0.45 + 0.55 * rng.random())
            _folha_fita(o, x, y, [(0.0, z0), (a * hh * 0.5, z0 + hh * 0.6), (a * hh * 1.1, z0 + hh)], [0.03, 0.022, 0.012],
                        cores[(j + k) % 4])
    return o


def _horta(variante='a'):
    _leira(0.14, 0.61, 0.1, 0.09, seed=5)
    rng = np.random.default_rng(31 if variante == 'a' else 37)
    if variante == 'a':
        # o pé de couve que secou e deitou (folhas marrons, abertas no chão) e o que sobrou da alface (um toco seco)
        for (x, pal, r, hz) in ((0.2, SECO_PAL, 0.17, 0.2), (0.56, SECO_PAL, 0.12, 0.12)):
            o = obj()
            m = mat_folha((x, 0.375, 0.15), (0.25, 0.25, 0.15), pal, q=0.05, seed=int(x * 100))
            _cachos(o, x, 0.375, 0.1 + hz * 0.4, r, hz * 0.45, 12, r * 0.28, r * 0.42, rng, m, achata=0.55, corte=0.1)
        _matinho(0.14, 0.61, seed=1, n=6)
    else:
        # o tomateiro seco: as estacas tortas, a rama marrom murcha e os tomates secos e escuros
        o_e = obj()
        for (x, dx, dy) in ((0.19, 0.12, -0.05), (0.56, -0.09, 0.07)):
            _viga(o_e, (x, 0.375, 0.08), (x + dx, 0.375 + dy, 0.66), 0.035, liso(velho('#9a7a50')), liso(velho('#b89a6a')))
            o = obj()
            m = mat_folha((x, 0.375, 0.3), (0.22, 0.22, 0.3), SECO_PAL, q=0.05, seed=int(x * 100) + 3, flores=('#5a2a1a', '#3a1a10'))
            _cachos(o, x + dx * 0.5, 0.375 + dy * 0.5, 0.3, 0.12, 0.18, 12, 0.05, 0.08, rng, m, achata=0.7)
        _matinho(0.14, 0.61, seed=2, n=5)


# =====================================================================================================================
# o feno, as sacas e os itens no chão
# =====================================================================================================================
def mat_palha(seed=0, velha=False):
    """
    A palha: riscas compridas de 1 px em quatro tons ao longo do fardo; a ponta cortada em blocos. velha: a palha de
    mais de um ano largada (cinza-amarelada, com as manchas escuras do mofo).
    """
    if velha:
        cs = np.stack([hx(x) for x in ('#a29672', '#aea27c', '#8e8262', '#b8ae8a')])
    else:
        cs = np.stack([hx(x) for x in ('#c8a24e', '#d6b25a', '#b8903e', '#e2c26c')])
    f0 = _mat_palha_base(cs, seed)
    if not velha:
        return f0

    def f(L, n, P):
        out = f0(L, n, P)
        a, b = coords(P, np.asarray(n, float))
        q = suave(a, b + P[:, 2], 0.16, seed + 9)
        out = np.where((q > 0.66)[:, None], out * 0.8 + np.array([4.0, 6.0, 4.0]), out)
        return np.where((q > 0.8)[:, None], out * 0.86, out)
    return emissivo(f)


def _mat_palha_base(cs, seed):

    def f(L, n, P):
        n = np.asarray(n, float)
        if abs(n[1]) > 0.5 and abs(n[2]) < 0.5:
            bz = np.floor(P[:, 2] / (2 * PZ))
            bx = np.floor(P[:, 0] / (2 * PH))
            r = ruido(bx, bz, seed + 3)
            out = cs[(r * 4).astype(int) % 4] * 0.95
            return np.where((r > 0.86)[:, None], hx('#9a7834'), out)
        if abs(n[2]) > 0.5:
            s, t, e = P[:, 0], P[:, 1], PH
        else:
            s, t, e = P[:, 2], P[:, 1], PZ
        fila = np.floor(s / e)
        seg = np.floor(t / 0.09 + ruido(fila, seed))
        r = ruido(fila, seg, seed + 1)
        return cs[(r * 4).astype(int) % 4]
    return emissivo(f)


def _feno():
    """O fardo velho (0,5 m, empilha): a palha cinza, as quinas comidas, uma amarra arrebentada e a palha solta no pé."""
    c = CZ.c
    h = 0.82 * UM
    b = (0.04, 0.71, 0.05, 0.7, 0.0, h)
    o = obj()
    c.caixa(b, mat_palha(2, velha=True), M, o, ch=0.065)
    # a amarra de pé e a que arrebentou (só os dois pedaços pendurados)
    o2 = obj(contorno=False)
    corda = liso('#4e4436')
    c.caixa((b[0] - 0.004, b[1] + 0.004, 0.25 - PH, 0.25 + PH * 0.6, 0.03, h + 0.004), corda, M, o2)
    for (xa, xb) in ((b[0] - 0.004, b[0] + 0.12), (b[1] - 0.2, b[1] + 0.004)):
        c.caixa((xa, xb, 0.5 - PH, 0.5 + PH * 0.6, h, h + 0.004), corda, M, o2)
    # a palha solta: tufos caídos no chão em volta e uns fios espetados no alto
    os_ = obj()
    rng = np.random.default_rng(7)
    m = mat_chapado('#a89c78')
    m2 = mat_chapado('#8e8262')
    for k in range(9):
        x = b[0] + rng.random() * (b[1] - b[0])
        y = b[3] + 0.02 + rng.random() * 0.06 if k < 5 else b[2] - 0.02 - rng.random() * 0.03
        a = rng.random() * 2 * math.pi
        L_ = 0.1 + 0.08 * rng.random()
        _tubo(os_, [(x, y, 0.012), (x + math.cos(a) * L_, y + math.sin(a) * L_ * 0.4, 0.012)], 0.012, m if k % 2 else m2)
    for k in range(5):
        x = b[0] + 0.1 + rng.random() * (b[1] - b[0] - 0.2)
        y = b[2] + 0.1 + rng.random() * (b[3] - b[2] - 0.2)
        _tubo(os_, [(x, y, h - 0.01), (x + 0.04 * (rng.random() - 0.5), y + 0.03, h + 0.07 + 0.04 * rng.random())], 0.011, m)
    pegada(b[0], b[1], b[2], b[3])


def mat_juta(cor='#c4a878', seed=0):
    """A juta do saco: a trama em xadrez de 2 px (dois tons próximos) e umas manchas."""
    c0 = hx(cor)

    def f(L, n, P):
        n = np.asarray(n, float)
        a, b = coords(P, n)
        ea = PH * 2
        eb = (PH if abs(n[2]) > 0.5 else PZ) * 2
        g = (np.floor(a / ea) + np.floor(b / eb)) % 2
        out = np.where((g == 0)[:, None], c0, _tom(c0, 0.94))
        mancha = suave(a, b, 0.12, seed) > 0.72
        return np.where(mancha[:, None], _tom(out, 0.88), out)
    return emissivo(f)


def _saco(b, cor='#c4a878', seed=0, boca='y+'):
    """Um saco deitado: o bloco de quinas redondas (juta) e a boca amarrada numa ponta."""
    BE._p1_malha(b, (0.12, 0.12, 0.08, 0.11), mat_juta(cor, seed), seg=3)
    x0, x1, y0, y1, z0, z1 = b
    zm = (z0 + z1) / 2
    c = CZ.c
    o2 = obj()
    if boca == 'x+':
        ym = (y0 + y1) / 2
        c.caixa((x1 - 0.01, x1 + 0.04, ym - 0.045, ym + 0.045, zm - 0.04, zm + 0.04), mat_juta('#8a6a3a', seed + 1), M, o2)
        c.caixa((x1 + 0.04, x1 + 0.08, ym - 0.07, ym + 0.07, zm - 0.06, zm + 0.06), mat_juta(cor, seed + 2), M, o2)
    else:
        xm = (x0 + x1) / 2
        c.caixa((xm - 0.045, xm + 0.045, y1 - 0.01, y1 + 0.04, zm - 0.04, zm + 0.04), mat_juta('#8a6a3a', seed + 1), M, o2)
        c.caixa((xm - 0.07, xm + 0.07, y1 + 0.04, y1 + 0.08, zm - 0.06, zm + 0.06), mat_juta(cor, seed + 2), M, o2)


def _sacas():
    """A pilha de sacas de grão (0,7 m): duas deitadas embaixo, uma atravessada em cima e uma em pé atrás."""
    h = 1.14 * UM
    BE._p1_malha((0.4, 0.68, 0.05, 0.3, 0.0, h - 0.04), (0.1, 0.1, 0.05, 0.12), mat_juta('#bca070', 7), seg=3)
    caixa((0.49, 0.59, 0.13, 0.22, h - 0.06, h - 0.01), mat_juta('#8a6a3a', 8))
    caixa((0.47, 0.61, 0.11, 0.24, h - 0.01, h + 0.02), mat_juta('#bca070', 9))
    _saco((0.05, 0.37, 0.06, 0.62, 0.0, 0.25), '#c8ac7c', 1, boca='y+')
    _saco((0.39, 0.7, 0.33, 0.64, 0.0, 0.24), '#c0a272', 2, boca='y+')
    _saco((0.08, 0.56, 0.26, 0.58, 0.24, 0.46), '#ccb084', 3, boca='x+')
    pegada(0.05, 0.7, 0.05, 0.68)


def _pilha_chao():
    """Itens largados no chão (0,12 m): a trouxa de pano, a latinha, o caderno e o caixotinho."""
    c = CZ.c
    BE._p1_malha((0.12, 0.44, 0.3, 0.6, 0.0, 0.12), (0.07, 0.07, 0.03, 0.06), mat_juta('#8a6a5a', 4), seg=2)
    caixa((0.27, 0.3, 0.3, 0.6, 0.06, 0.125), liso('#5a3a2e'), contorno=False)
    o = obj()
    c.cilindro(0.56, 0.52, 0.045, 0.0, 0.11, vol(0.56, 0.52, '#9a9ea4', brilho=0.4), M, o, lados=14, tampa_mat=liso('#7a7e84'))
    caixa((0.42, 0.66, 0.14, 0.32, 0.0, 0.03), {'*': liso('#e0d6c0'), 'cima': liso('#5a3a30')})
    caixa((0.12, 0.3, 0.1, 0.26, 0.0, 0.09), {'*': mad2('#8a5a34', seed=2, passo=0.04), 'cima': mad2('#a06a40', seed=3, passo=0.04)})
    pegada(0.12, 0.66, 0.1, 0.6)


# =====================================================================================================================
# a placa
# =====================================================================================================================
def mat_placa(x0, x1, z0, z1, olho=True, letras=True):
    """As tábuas da placa e o "escrito à mão" em rabiscos de 1 px (nada legível); o olho de águia pintado à esquerda."""
    cs = np.stack([hx(velho(x, 0.68)) for x in ('#b08250', '#a47848', '#b88a56')])

    def f(L, n, P):
        n = np.asarray(n, float)
        if abs(n[1]) < 0.5:
            return np.tile(hx(velho('#8a6038')), (len(P), 1))
        x, z = P[:, 0], P[:, 2]
        larg = (z1 - z0) / (2 if (z1 - z0) > 0.2 else 1)
        fila = np.floor((z - z0) / larg)
        g = (z - z0) - fila * larg
        out = cs[(fila % 3).astype(int)]
        out = np.where(((g < PZ) & (fila > 0))[:, None], hx('#3a322c'), out)
        out = np.where(((g >= PZ) & (g < 2 * PZ))[:, None], _tom(out, 1.08), out)
        if n[1] > 0 and letras:
            xo = x0 + 0.12
            xl = xo + 0.12 if olho else x0 + 0.06
            linhas = (z0 + (z1 - z0) * 0.68, z0 + (z1 - z0) * 0.32) if olho else (z0 + (z1 - z0) * 0.5,)
            for k, zl in enumerate(linhas):
                t = x - x0
                onda = zl + 0.02 * np.sin(t * 90 + k * 2) * (0.6 + 0.4 * np.sin(t * 23 + k))
                palavra = np.sin(t * 24 + k * 1.7 + 0.8 * np.sin(t * 9)) > -0.5
                lin = (np.abs(z - onda) < PZ * 0.6) & (x > xl) & (x < x1 - 0.05 - k * 0.07) & palavra
                out = np.where((lin & (ruido(np.floor(x / (3 * PH)), k, 2.0) > 0.25))[:, None], hx('#4e443c'), out)
            if olho:
                ex, ez = xo, (z0 + z1) / 2
                d = ((x - ex) / 0.085) ** 2 + ((z - ez) / 0.05) ** 2
                out = np.where((d < 1.0)[:, None], hx('#c8c0b0'), out)
                di = np.hypot((x - ex) / 0.03, (z - ez) / 0.036)
                out = np.where((di < 1.0)[:, None], hx('#8e7a58'), out)
                out = np.where((di < 0.5)[:, None], hx('#3a322c'), out)
                out = np.where(((d >= 0.66) & (d < 1.2))[:, None], hx('#4e443c'), out)
                desc = (z < ez + 0.06) & (z > ez - 0.1) & (np.abs(x - ex) < 0.1) & (ruido(np.floor(x / (2 * PH)), np.floor(z / (2 * PZ)), 4.0) > 0.45)
                out = np.where(desc[:, None], cs[0] * 0.95, out)
        return out
    return emissivo(f)


def _tabua_seta(x0, x1, y0, y1, z0, z1, sg, mat, mat_borda):
    """A tábua da placa com a ponta em seta (sg +1: a ponta para +x): o prisma inteiro, fechado."""
    c = CZ.c
    o = obj()
    zm = (z0 + z1) / 2
    ps = 0.09
    if sg > 0:
        perfil = [(x0, z0), (x1, z0), (x1 + ps, zm), (x1, z1), (x0, z1)]
    else:
        perfil = [(x0 - ps, zm), (x0, z0), (x1, z0), (x1, z1), (x0, z1)]
    # frente e costas
    c.face_plana([(a, y1, b) for (a, b) in perfil], (0, 1, 0), mat, M, o)
    c.face_plana([(a, y0, b) for (a, b) in perfil[::-1]], (0, -1, 0), mat, M, o)
    # as bordas
    k = len(perfil)
    area = sum(perfil[i][0] * perfil[(i + 1) % k][1] - perfil[(i + 1) % k][0] * perfil[i][1] for i in range(k))
    for i in range(k):
        (a0, b0), (a1, b1) = perfil[i], perfil[(i + 1) % k]
        nx, nz = (b1 - b0), -(a1 - a0)
        if area < 0:
            nx, nz = -nx, -nz
        ln = math.hypot(nx, nz)
        c.face_plana([(a0, y0, b0), (a1, y0, b1), (a1, y1, b1), (a0, y1, b0)], (nx / ln, 0, nz / ln), mat_borda, M, o)
    return o


def _placa():
    h = 2.94 * UM                # 1,8 m
    cx, cy = 0.375, 0.4
    _poste(cx, cy, 0.1, h, cor=velho('#6a4a2c'), topo=velho('#8a6440'))
    for (x0, x1, z0, z1, olho, sg) in ((cx - 0.36, cx + 0.3, 1.24, 1.5, True, 1), (cx - 0.22, cx + 0.34, 0.97, 1.15, False, -1)):
        _tabua_seta(x0, x1, cy + 0.05, cy + 0.085, z0, z1, sg, mat_placa(x0, x1, z0, z1, olho), liso(velho('#8a6038')))
        for xx in (cx - 0.03, cx + 0.03):
            caixa((xx, xx + PH, cy + 0.085, cy + 0.09, (z0 + z1) / 2 - PZ, (z0 + z1) / 2), liso('#5a3a2a'), contorno=False)
    pegada(cx - 0.08, cx + 0.08, cy - 0.06, cy + 0.12)


# =====================================================================================================================
# a porteira (3 casas): os dois mourões e as duas folhas (fechada 0, aberta 1)
# =====================================================================================================================
def _diagonal(o, a, b, plano, esp, z0, z1, eixo):
    """A tábua diagonal da folha: as duas faces (frente e costas) e a borda de cima."""
    c = CZ.c
    w = 0.09
    m = liso(velho('#a47a52'))
    if eixo == 'x':
        for (yy, n) in ((plano + esp, (0, 1, 0)), (plano, (0, -1, 0))):
            c.face_plana([(a, yy, z0), (b, yy, z1 - w), (b, yy, z1), (a, yy, z0 + w)], n, m, M, o, dois_lados=True)
    else:
        for (xx, n) in ((plano + esp, (1, 0, 0)), (plano, (-1, 0, 0))):
            c.face_plana([(xx, a, z0), (xx, b, z1 - w), (xx, b, z1), (xx, a, z0 + w)], n, m, M, o, dois_lados=True)


def _folha_porteira(xh, y, comp, sentido, aberta, h=1.25):
    """
    Uma folha da porteira, presa no mourão em (xh, y): fechada corre ao longo de x (sentido +1 ou -1); aberta gira
    90 graus para a frente (+y). As quatro travessas, os dois montantes e a diagonal (a mão-francesa).
    """
    o = obj()
    m = {'*': mad2(velho('#9a7048'), eixo=0, seed=5, passo=0.05), 'cima': liso(velho('#b48a5a'))}
    mv = {'*': mad2(velho('#8a623e'), eixo=1, seed=6, passo=0.05), 'cima': liso(velho('#a87e52'))}
    e = 0.05
    trav = (0.18, 0.5, 0.82, 1.12)
    c = CZ.c
    if not aberta:
        a0, a1 = sorted((xh, xh + sentido * comp))
        for z in trav:
            c.caixa((a0, a1, y - e / 2, y + e / 2, z, z + 0.1), m, M, o)
        for xm in (a0, a1 - 0.09):
            c.caixa((xm, xm + 0.09, y - e / 2 - 0.006, y + e / 2 + 0.006, 0.12, h), mv, M, o)
        xa, xb = (a0 + 0.09, a1 - 0.09) if sentido > 0 else (a1 - 0.09, a0 + 0.09)
        _diagonal(o, xa, xb, y + e / 2 + 0.006, 0.03, 0.2, h - 0.08, 'x')
    else:
        b0, b1 = y + 0.1, y + 0.1 + comp
        for z in trav:
            c.caixa((xh - e / 2, xh + e / 2, b0, b1, z, z + 0.1), m, M, o)
        for ym in (b0, b1 - 0.09):
            c.caixa((xh - e / 2 - 0.006, xh + e / 2 + 0.006, ym, ym + 0.09, 0.12, h), mv, M, o)
        pl = xh + e / 2 + 0.006 if sentido > 0 else xh - e / 2 - 0.006 - 0.03
        _diagonal(o, b0 + 0.09, b1 - 0.09, pl, 0.03, 0.2, h - 0.08, 'y')
    return o


def _porteira(aberta=False):
    W = 3 * CASA
    y = 0.375
    hm = 1.6
    for x in (0.12, W - 0.12):
        _poste(x, y, 0.2, hm, cor=velho('#5e3e26', 0.55), topo=velho('#8a6440'))
        pegada(x - 0.1, x + 0.1, y - 0.1, y + 0.1)
        # as dobradiças de ferro
        for z in (0.3, 1.05):
            sg = 1 if x < W / 2 else -1
            caixa((x + sg * 0.1 - (0.0 if sg > 0 else 0.06), x + sg * 0.1 + (0.06 if sg > 0 else 0.0), y - 0.035, y + 0.035, z, z + 0.05), liso('#5a3a2a'))
    vao = W - 0.24 - 0.2
    comp = vao / 2 - 0.015
    if not aberta:
        _folha_porteira(0.22, y, comp, 1, False)
        _folha_porteira(W - 0.22, y, comp, -1, False)
        caixa((W / 2 - 0.09, W / 2 + 0.09, y + 0.031, y + 0.05, 0.86, 0.9), liso('#6a3e28'), contorno=False)
        pegada(0.22, W - 0.22, y - 0.03, y + 0.03)
    else:
        _folha_porteira(0.25, y, comp, 1, True)
        _folha_porteira(W - 0.25, y, comp, -1, True)
        pegada(0.22, 0.28, y + 0.1, y + 0.1 + comp)
        pegada(W - 0.28, W - 0.22, y + 0.1, y + 0.1 + comp)


# =====================================================================================================================
# a carroça (2 x 3 casas): a caixa de tábuas, as duas rodas de raios e os varais para a frente (+y)
# =====================================================================================================================
def _tubo(o, pts, w, mat):
    """Uma linha fina no espaço (o fio de água, a corda) de frente para a câmera: quadriláteros de largura 2w."""
    h, rv = BE.frente_tela()
    r3 = np.array([rv[0], rv[1], 0.0])
    for P0, P1 in zip(pts[:-1], pts[1:]):
        P0, P1 = np.array(P0, float), np.array(P1, float)
        n = np.cross(P1 - P0, r3)
        if np.linalg.norm(n) < 1e-9:
            continue
        n /= np.linalg.norm(n)
        q = [P0 - r3 * w, P1 - r3 * w, P1 + r3 * w, P0 + r3 * w]
        CZ.c.face_plana([tuple(x) for x in q], tuple(n), mat, M, o, dois_lados=True)


def _roda(xc, yc, zc, r, esp=0.07, raios=10):
    """A roda de madeira no plano x = xc: o aro (com a calota de ferro), os raios e o cubo. Fechada dos dois lados."""
    c = CZ.c
    o = obj()
    lados = 24
    ri = r - 0.075
    aro = mad2(velho('#7a5232'), eixo=1, seed=8, passo=0.04)
    ferro = liso('#5a3e30')
    x0, x1 = xc - esp / 2, xc + esp / 2
    for i in range(lados):
        a0, a1 = 2 * math.pi * i / lados, 2 * math.pi * (i + 1) / lados
        am = (a0 + a1) / 2
        p = lambda rr, a, x: (x, yc + rr * math.cos(a), zc + rr * math.sin(a))
        # a banda de rodagem (o ferro), por fora
        c.face_plana([p(r, a0, x0), p(r, a1, x0), p(r, a1, x1), p(r, a0, x1)], (0, math.cos(am), math.sin(am)), ferro, M, o)
        # por dentro do aro
        c.face_plana([p(ri, a1, x0), p(ri, a0, x0), p(ri, a0, x1), p(ri, a1, x1)], (0, -math.cos(am), -math.sin(am)), aro, M, o)
        # as duas faces do aro
        for (x, s) in ((x1, 1), (x0, -1)):
            c.face_plana([p(ri, a0, x), p(r, a0, x), p(r, a1, x), p(ri, a1, x)], (s, 0, 0), aro, M, o)
    # os raios (prismas finos) e o cubo
    mr = liso(velho('#8a6040'))
    w = 0.028
    for k in range(raios):
        a = 2 * math.pi * (k + 0.5) / raios
        ca, sa = math.cos(a), math.sin(a)
        pa, pb = (0.09, ri + 0.01)
        q = lambda rr, s, x: (x, yc + rr * ca - s * sa * w, zc + rr * sa + s * ca * w)
        for (x, s) in ((xc + 0.015, 1), (xc - 0.015, -1)):
            c.face_plana([q(pa, -1, x), q(pb, -1, x), q(pb, 1, x), q(pa, 1, x)], (s, 0, 0), mr, M, o)
        for sg in (1, -1):
            c.face_plana([q(pa, sg, xc - 0.015), q(pb, sg, xc - 0.015), q(pb, sg, xc + 0.015), q(pa, sg, xc + 0.015)],
                         (0, -sg * sa, sg * ca), mr, M, o)
    oc = obj()
    c.caixa((xc - 0.07, xc + 0.07, yc - 0.08, yc + 0.08, zc - 0.08, zc + 0.08), {'*': liso(velho('#5a3a24')), 'dir': liso('#5a3e30'), 'esq': liso('#5a3e30')}, M, oc)


def _carroca():
    W, D = 2 * CASA, 3 * CASA
    c = CZ.c
    h = 1.96 * UM                 # 1,2 m (a guarda de cima)
    x0, x1 = 0.24, W - 0.24
    y0, y1 = 0.12, 1.86
    zf = 0.62                     # o assoalho
    tab = lambda e: tab2([velho('#9a6a40'), velho('#8e623a'), velho('#a27046', 0.72)], 0.15, '#2e2620', eixo=e, seed=13, org=zf)
    # o assoalho e a viga de baixo
    caixa((x0, x1, y0, y1, zf - 0.08, zf), {'*': liso(velho('#6a4428')), 'cima': tab2([velho('#a87848'), velho('#9c6e42')], 0.14, '#3a302a', eixo=1, seed=3, org=x0)})
    caixa((x0 + 0.18, x1 - 0.18, y0 + 0.1, y1 - 0.1, zf - 0.2, zf - 0.08), liso(velho('#4a2e1c', 0.5)))
    # os quatro lados de tábuas (3 tábuas de 0,15 m), as fueiros (os paus de canto) e a guarda
    e = 0.04
    o = obj()
    zt = zf + 0.45
    for b in ((x0, x1, y0, y0 + e, zf, zt), (x0, x1, y1 - e, y1, zf, zt)):
        c.caixa(b, {'*': tab(0), 'cima': liso(velho('#b48452'))}, M, o)
    for b in ((x0, x0 + e, y0 + e, y1 - e, zf, zt), (x1 - e, x1, y0 + e, y1 - e, zf, zt)):
        c.caixa(b, {'*': tab(0), 'cima': liso(velho('#b48452'))}, M, o)
    for (xx, yy) in ((x0, y0), (x1 - 0.06, y0), (x0, y1 - 0.06), (x1 - 0.06, y1 - 0.06), (x0, (y0 + y1) / 2 - 0.03), (x1 - 0.06, (y0 + y1) / 2 - 0.03)):
        caixa((xx - 0.01, xx + 0.07, yy, yy + 0.06, zf - 0.08, h), {'*': mad2(velho('#6a4428', 0.55), eixo=1, seed=2, passo=0.04), 'cima': liso(velho('#8a6040'))})
    # dentro: a palha no fundo e dois sacos
    caixa((x0 + e, x1 - e, y0 + e, y1 - e, zf, zf + 0.05), mat_palha(7, velha=True), contorno=False)
    _saco((x0 + 0.12, x0 + 0.62, y0 + 0.2, y0 + 0.55, zf + 0.04, zf + 0.26), velho('#c8ac7c', 0.5), 4, boca='x+')
    # as rodas (no meio da caixa, dos dois lados) e o eixo
    yr = (y0 + y1) / 2 + 0.05
    rr = 0.52
    caixa((x0 - 0.12, x1 + 0.12, yr - 0.04, yr + 0.04, rr - 0.04, rr + 0.04), liso(velho('#3a2a1e', 0.4)))
    _roda(x0 - 0.09, yr, rr, rr)
    _roda(x1 + 0.09, yr, rr, rr)
    # os varais: as duas varas saindo da frente e descendo até o chão (o cavalo vai entre elas), a travessa
    for xv in (0.5, W - 0.5):
        o2 = obj()
        ya, yb = y1 - 0.25, D - 0.05
        za, zb = zf - 0.12, 0.04
        k = 0.035
        pts = [(xv - k, ya, za), (xv + k, ya, za), (xv + k, yb, zb), (xv - k, yb, zb)]
        dz = za - zb
        dy = yb - ya
        nn = np.array([0, dz, dy]); nn /= np.linalg.norm(nn)
        mv = mad2(velho('#7a5232'), eixo=1, seed=9, passo=0.04)
        c.face_plana([(x, y, z + 0.07) for (x, y, z) in pts], tuple(nn), mv, M, o2)
        c.face_plana(pts[::-1], tuple(-nn), mv, M, o2)
        for sg in (1, -1):
            xx = xv + sg * k
            c.face_plana([(xx, ya, za), (xx, yb, zb), (xx, yb, zb + 0.07), (xx, ya, za + 0.07)], (sg, 0, 0), liso(velho('#6a4428')), M, o2)
        c.face_plana([(xv - k, yb, zb), (xv + k, yb, zb), (xv + k, yb, zb + 0.07), (xv - k, yb, zb + 0.07)], (0, 1, 0), liso(velho('#5a3a24')), M, o2)
    caixa((0.46, W - 0.46, y1 + 0.15, y1 + 0.21, zf - 0.22, zf - 0.15), liso(velho('#7a5232')))
    pegada(x0, x1, y0, y1)
    pegada(0.45, W - 0.45, y1, D - 0.05)


# =====================================================================================================================
# a fonte do pátio (3 x 3 casas): a bacia de pedra, a água, a coluna, a taça e a pinha
# =====================================================================================================================
def _manchas_pedra(L, n, P, out, ids):
    """A pedra largada: as manchas escuras que a chuva escorreu (riscas em pé) e o musgo verde perto do chão."""
    a, b = coords(P, np.asarray(n, float))
    esc = suave(a / 0.25, P[:, 2] / 2.5, 1.0, 81) > 0.6
    out = np.where(esc[:, None], out * 0.86, out)
    mus = P[:, 2] < 0.1 + 0.12 * suave(a, 0.0, 0.18, 82)
    return np.where(mus[:, None], out * 0.55 + hx('#5a6a38') * 0.45, out)


def _parede_seca(L, n, P):
    """A parede de dentro da bacia seca: a marca da água que secou (a faixa clara em cima) e o lodo escuro embaixo."""
    out = np.tile(hx('#6e695c'), (len(P), 1))
    out = np.where((P[:, 2] > 0.46)[:, None], hx('#8e887a'), out)
    return np.where((P[:, 2] < 0.41)[:, None], hx('#4e5634'), out)


def _escorrido(cx, cy, musgo=False):
    """As faixas de sujeira escorrida na coluna e na taça (e o musgo no pé)."""
    def f(P, base):
        th = np.arctan2(P[:, 1] - cy, P[:, 0] - cx)
        esc = np.sin(th * 7 + 1.3) > 0.55
        base = np.where(esc[:, None], base * 0.86, base)
        if musgo:
            base = np.where((P[:, 2] < 0.47)[:, None], base * 0.55 + hx('#5a6a38') * 0.45, base)
        return base
    return f


def _fonte():
    c = CZ.c
    F = 1.5 * CASA
    FX = FY = F
    lados = 36
    o = obj()
    fn = id_pedras_cil(FX, FY, 0.14, 0.32)
    pedra = mat_juntas(['#aca698', '#a29c8e', '#b2ac9e', '#9a9488'], fn, '#6a6458', seed=6, extra=_manchas_pedra)
    c.cilindro(FX, FY, 1.02, 0, 0.42, pedra, M, o, lados=lados, tampa=False)
    # a borda de cima (o anel claro em gomos), a parede de dentro e a água
    ob = obj()
    c.cilindro(FX, FY, 1.07, 0.42, 0.5, emissivo(lambda L, n, P: _manchas_pedra(L, n, P, np.tile(hx('#bcb6a8'), (len(P), 1)), None)), M, ob, lados=lados, tampa=False)
    for i in range(lados):
        a0, a1 = 2 * math.pi * i / lados, 2 * math.pi * (i + 1) / lados
        c.face_plana([(FX + 0.88 * math.cos(a0), FY + 0.88 * math.sin(a0), 0.5), (FX + 1.07 * math.cos(a0), FY + 1.07 * math.sin(a0), 0.5),
                      (FX + 1.07 * math.cos(a1), FY + 1.07 * math.sin(a1), 0.5), (FX + 0.88 * math.cos(a1), FY + 0.88 * math.sin(a1), 0.5)],
                     (0, 0, 1), mat_cor(['#c4beb0', '#bab4a6'], lambda L, n: np.floor((np.arctan2(L[:, 1] - FY, L[:, 0] - FX) + 4) / 0.35).astype(np.int64)), M, ob)
        # a parede de dentro (virada para o meio)
        am = (a0 + a1) / 2
        c.face_plana([(FX + 0.88 * math.cos(a1), FY + 0.88 * math.sin(a1), 0.36), (FX + 0.88 * math.cos(a0), FY + 0.88 * math.sin(a0), 0.36),
                      (FX + 0.88 * math.cos(a0), FY + 0.88 * math.sin(a0), 0.5), (FX + 0.88 * math.cos(a1), FY + 0.88 * math.sin(a1), 0.5)],
                     (-math.cos(am), -math.sin(am), 0), emissivo(_parede_seca), M, ob)
    oa = obj(contorno=False)

    def fundo(L, n, P):
        """O fundo da bacia seca: a pedra manchada, o musgo nos cantos, as folhas secas amontoadas e a marca da água."""
        r = np.hypot(P[:, 0] - FX, P[:, 1] - FY)
        bx = np.floor(P[:, 0] / (2 * PH))
        by = np.floor(P[:, 1] / (2 * PH))
        q = suave(P[:, 0], P[:, 1], 0.25, 71)
        out = np.where((q > 0.55)[:, None], hx('#6e6a5e'), hx('#7c776a'))
        # o musgo: perto da parede da bacia e em manchas
        mus = (r > 0.62 + 0.12 * suave(P[:, 0], P[:, 1], 0.18, 72)) | (suave(P[:, 0], P[:, 1], 0.2, 73) > 0.7)
        out = np.where(mus[:, None], np.where((ruido(bx, by, 3.0) > 0.5)[:, None], hx('#4e5a32'), hx('#5c6a3a')), out)
        # as folhas secas que o vento juntou (blocos de 2 px, três tons de marrom e um laranja)
        fol = (suave(P[:, 0], P[:, 1], 0.3, 74) > 0.6) & (ruido(bx, by, 5.0) > 0.55)
        cf = np.stack([hx('#6a5034'), hx('#7a5a38'), hx('#54402a'), hx('#8a6840')])
        out = np.where(fol[:, None], cf[(ruido(bx, by, 6.0) * 4).astype(int) % 4], out)
        return out
    c.face_plana([(FX + 0.88 * math.cos(2 * math.pi * i / lados), FY + 0.88 * math.sin(2 * math.pi * i / lados), 0.38) for i in range(lados)],
                 (0, 0, 1), emissivo(fundo), M, oa)
    # a coluna, a taça e a pinha
    oc = obj()
    c.cilindro(FX, FY, 0.16, 0.38, 1.0, vol(FX, FY, '#aea89a', faixas=_escorrido(FX, FY)), M, oc, lados=16, r1=0.11, tampa=False)
    c.cilindro(FX, FY, 0.22, 0.38, 0.55, vol(FX, FY, '#a8a294', faixas=_escorrido(FX, FY, musgo=True)), M, oc, lados=16, tampa=False)
    ot = obj()
    c.cilindro(FX, FY, 0.12, 1.0, 1.16, vol(FX, FY, '#b4aea0', faixas=_escorrido(FX, FY)), M, ot, lados=24, r1=0.44, tampa=False)

    def taca(L, n, P):
        rr = np.hypot(P[:, 0] - FX, P[:, 1] - FY)
        seca = np.where((suave(P[:, 0], P[:, 1], 0.08, 75) > 0.6)[:, None], hx('#6a5232'), hx('#6e6a5e'))
        return np.where((rr > 0.37)[:, None], hx('#c0baac'), np.where((rr > 0.3)[:, None], hx('#5e5a50'), seca))
    _disco(FX, FY, 1.16, 0.44, emissivo(taca), ot, lados=24)
    op = obj()
    c.cilindro(FX, FY, 0.06, 1.14, 1.36, vol(FX, FY, '#aea89a'), M, op, lados=12, tampa=False)
    c.elipsoide((FX, FY, 1.46), (0.11, 0.11, 0.13), lambda Pc, N, P: _cru_eli(np.tile(hx('#b4aea0'), (len(P), 1)), N), op)
    c.elipsoide((FX, FY, 1.57), (0.04, 0.04, 0.05), lambda Pc, N, P: _cru_eli(np.tile(hx('#bcb6a8'), (len(P), 1)), N), op)
    pegada_redonda(FX, FY, 1.05)


# =====================================================================================================================
# os prédios: o kit (fachada, janela, porta, telhado, viga)
# =====================================================================================================================
CAL = '#d6cebc'            # a moldura branca, encardida (cunhais, cimalha, janelas, pilares)
VENEZ = '#5a6a56'          # a veneziana verde, desbotada


def _bx(face, plano, l0, l1, e0, e1, z0, z1):
    """Uma caixa presa na fachada `face` ('+y', '-y', '+x', '-x', no plano da parede): l ao longo, e para fora."""
    if face == '+y':
        return (l0, l1, plano + e0, plano + e1, z0, z1)
    if face == '-y':
        return (l0, l1, plano - e1, plano - e0, z0, z1)
    if face == '+x':
        return (plano + e0, plano + e1, l0, l1, z0, z1)
    return (plano - e1, plano - e0, l0, l1, z0, z1)


def _plano(B, face):
    X0, X1, Y0, Y1 = B
    return {'+y': Y1, '-y': Y0, '+x': X1, '-x': X0}[face]


def _viga(o, p0, p1, w, mat, cima=None):
    """Uma viga de seção quadrada (w) entre dois pontos: as quatro faces e as duas pontas."""
    c = CZ.c
    p0, p1 = np.array(p0, float), np.array(p1, float)
    d = p1 - p0
    d /= np.linalg.norm(d)
    a = np.cross(d, [0, 0, 1.0])
    if np.linalg.norm(a) < 1e-6:
        a = np.array([1.0, 0, 0])
    a /= np.linalg.norm(a)
    b = np.cross(a, d)
    h = w / 2
    cs = [(-1, -1), (1, -1), (1, 1), (-1, 1)]
    Q = lambda p, s, t: tuple(p + a * s * h + b * t * h)
    for i in range(4):
        (s0, t0), (s1, t1) = cs[i], cs[(i + 1) % 4]
        n = a * (s0 + s1) / 2 + b * (t0 + t1) / 2
        n /= np.linalg.norm(n)
        m = cima if (cima is not None and n[2] > 0.5) else mat
        c.face_plana([Q(p0, s0, t0), Q(p0, s1, t1), Q(p1, s1, t1), Q(p1, s0, t0)], tuple(n), m, M, o)
    c.face_plana([Q(p1, s, t) for (s, t) in cs], tuple(d), mat, M, o)
    c.face_plana([Q(p0, s, t) for (s, t) in cs[::-1]], tuple(-d), mat, M, o)


def mat_reboco(cor, seed=0, sujeira=0.6, fuligem=None, descasca=0.0, tijolo='#9a6a52'):
    """
    A parede caiada: manchas grandes e suaves (2 tons, em degraus) e a sujeira que sobe do chão. fuligem: lista de
    (lat0, lat1, z0, z1) as janelas queimadas, com a fumaça preta que subiu delas (em 4 degraus, abrindo para cima).
    """
    base = hx(cor)

    def f(L, n, P):
        n = np.asarray(n, float)
        a, b = coords(P, n)
        q = suave(a, P[:, 2], 0.9, 31 + seed) * 0.7 + suave(a, P[:, 2], 0.35, 32 + seed) * 0.3
        out = np.tile(base, (len(P), 1))
        out = np.where((q > 0.64)[:, None], base * 0.965, out)
        out = np.where((q < 0.28)[:, None], np.minimum(base * 1.02, 255), out)
        suja = P[:, 2] < sujeira + 0.1 * suave(a, 0, 0.3, 33)
        out = np.where(suja[:, None], out * 0.92, out)
        if descasca:
            # o abandono: a sujeira sobe mais (dois degraus), a chuva escorre em riscas e o reboco cai em placas,
            # mostrando o tijolo (a borda de cima da placa com 1 px de sombra)
            suja2 = P[:, 2] < sujeira * 0.55 + 0.08 * suave(a, 0, 0.25, 34)
            out = np.where(suja2[:, None], out * 0.9, out)
            risca = suave(a / 0.22, P[:, 2] / 3.0, 1.0, 35 + seed) > 0.66
            out = np.where(risca[:, None], out * 0.93, out)
            def placa(z):
                return suave(a, z, 0.32, 36 + seed) * 0.75 + suave(a, z, 0.11, 37 + seed) * 0.25
            t = 1 - 0.38 * descasca
            dentro = placa(P[:, 2]) > t
            borda = dentro & (placa(P[:, 2] + PZ) <= t)
            tj = hx(tijolo)
            fiada = (np.floor(P[:, 2] / (4 * PZ)) % 2) == 0
            tij = np.where(fiada[:, None], tj, tj * 0.9)
            junta_t = (P[:, 2] / PZ) % 4 < 1
            tij = np.where(junta_t[:, None], hx('#8a8070'), tij)
            out = np.where(dentro[:, None], tij, out)
            out = np.where(borda[:, None], out * 0.6, out)
        if fuligem:
            k = np.zeros(len(P))
            for (l0, l1, z0, z1) in fuligem:
                lm, lw = (l0 + l1) / 2, (l1 - l0) / 2
                sobe = np.clip((P[:, 2] - z0) / 1.4, 0, 1)
                # a pluma: sai larga da janela, abre e torce um pouco para o lado subindo
                torce = 0.18 * np.sin(P[:, 2] * 2.4 + l0 * 3) * sobe
                larg = lw * (1.05 + 0.7 * sobe) + 0.05 * np.sin(P[:, 2] * 9 + l0)
                dl = np.abs(a - lm - torce) / np.maximum(larg, 1e-3)
                kk = np.where(P[:, 2] > z0 - 0.06, np.clip(1.5 - dl, 0, 1) * (1.0 - 0.4 * sobe), 0)
                k = np.maximum(k, kk)
            k = np.maximum(k, np.clip((P[:, 2] - 2.5) / 0.9, 0, 1) * 0.5 * (0.6 + 0.4 * suave(a, 0, 0.5, 41)))
            nv = np.digitize(k, [0.18, 0.42, 0.7])
            esc = np.array([0.0, 0.32, 0.55, 0.74])[nv]
            out = out * (1 - esc[:, None]) + np.array([26.0, 20.0, 18.0]) * esc[:, None]
        return out
    return emissivo(f)


def mat_vidro(kind, eixo_lat, a0, a1, z0, z1):
    """O vidro: escuro com o reflexo do céu em diagonal; aceso (a luz quente de dentro com a cortina); queimado (o buraco)."""
    def f(L, n, P):
        lat = P[:, 0] if eixo_lat == 0 else P[:, 1]
        u = (lat - a0) / (a1 - a0)
        v = (P[:, 2] - z0) / (z1 - z0)
        if kind == 'escuro':
            out = np.tile(hx('#2c3c48'), (len(P), 1))
            out = np.where((v > 0.62)[:, None], hx('#344856'), out)
            d = v * 1.6 - u * 1.0
            out = np.where(((d > 0.55) & (d < 0.75))[:, None], hx('#5a7484'), out)
            out = np.where(((d > 0.9) & (d < 0.98))[:, None], hx('#4a6474'), out)
            return out
        if kind == 'sujo':
            out = np.tile(hx('#2e3438'), (len(P), 1))
            d = v * 1.6 - u * 1.0
            out = np.where(((d > 0.55) & (d < 0.72))[:, None], hx('#465056'), out)
            # a poeira assentada embaixo e nos cantos
            out = np.where((v < 0.16 + 0.06 * np.sin(u * 9))[:, None], hx('#4a4a44'), out)
            return out
        if kind == 'breu':
            out = np.tile(hx('#181412'), (len(P), 1))
            return np.where((v > 0.85)[:, None], hx('#221c18'), out)
        if kind == 'queimado':
            out = np.tile(hx('#120d0b'), (len(P), 1))
            out = np.where((v > 0.8)[:, None], hx('#1c1512'), out)
            # os cacos de vidro que sobraram nos cantos (pontas tortas)
            caco = ((u < 0.18 - v * 0.25) & (v < 0.5)) | ((u > 0.86 - (1 - v) * 0.2) & (v > 0.55)) | ((v > 0.9 - u * 0.3) & (u < 0.35))
            return np.where(caco[:, None], hx('#5a6668'), out)
        quente, meio, borda = hx('#ffcf78'), hx('#f6a94e'), hx('#d9803a')
        r = np.maximum(np.abs(u - 0.5) * 2, np.abs(v - 0.45) * 1.6)
        out = np.where((r < 0.5)[:, None], quente, np.where((r < 0.82)[:, None], meio, borda))
        cort = (u < 0.2) | (u > 0.8)
        pr = ((lat / (3 * PH)) % 1) < 0.5
        return np.where((cort & pr)[:, None], hx('#f2dcae'), np.where(cort[:, None], hx('#e2c08a'), out))
    return emissivo(f)


def mat_veneziana(cor=VENEZ):
    c0 = hx(cor)

    def f(L, n, P):
        g = np.floor(P[:, 2] / PZ) % 3
        return np.where((g == 0)[:, None], _tom(c0, 0.75), np.where((g == 1)[:, None], c0, _tom(c0, 1.14)))
    return emissivo(f)


def janela(B, face, a, z0, w, h, kind='escuro', venez=VENEZ, moldura=CAL, cruz=True, peitoril=True, tabuas=False, solta=False):
    """A janela na fachada: as venezianas abertas, o vidro, o batente, a verga, o peitoril e a cruz da esquadria."""
    c = CZ.c
    p = _plano(B, face)
    a0, a1 = a - w / 2, a + w / 2
    bx = lambda l0, l1, e0, e1, za, zb: _bx(face, p, l0, l1, e0, e1, za, zb)
    eixo_lat = 0 if face in ('+y', '-y') else 1
    if venez:
        sw = w * 0.45
        for k, (l0, l1) in enumerate(((a0 - 0.07 - sw, a0 - 0.07), (a1 + 0.07, a1 + 0.07 + sw))):
            if solta and k == 1:
                # a folha da veneziana que soltou da dobradiça de cima: caída, torta, pendurada pela de baixo
                caixa(bx(l0, l1, 0.0, 0.035, z0 - 0.3, z0 + h - 0.32), mat_veneziana(venez))
                continue
            caixa(bx(l0, l1, 0.0, 0.035, z0 - 0.02, z0 + h + 0.02), mat_veneziana(venez))
    ov = obj(contorno=(kind != 'aceso'))
    if kind == 'aceso':
        CZ.luzes.add(ov)
    c.caixa(bx(a0, a1, -0.03, 0.004, z0, z0 + h), mat_vidro(kind, eixo_lat, a0, a1, z0, z0 + h), M, ov)
    o = obj()
    m = liso(moldura)
    e = 0.06
    for b in (bx(a0 - e, a0, 0, 0.05, z0, z0 + h), bx(a1, a1 + e, 0, 0.05, z0, z0 + h), bx(a0 - e, a1 + e, 0, 0.05, z0 + h, z0 + h + 0.07),
              bx(a0 - e, a1 + e, 0, 0.05, z0 - 0.05, z0)):
        c.caixa(b, m, M, o)
    if peitoril:
        caixa(bx(a0 - 0.11, a1 + 0.11, 0, 0.08, z0 + h + 0.07, z0 + h + 0.13), liso(moldura))
        caixa(bx(a0 - 0.1, a1 + 0.1, 0, 0.1, z0 - 0.11, z0 - 0.05), liso(moldura))
    if cruz and kind != 'queimado':
        oc = obj(contorno=False)
        am = (a0 + a1) / 2
        cc = liso(_hex(_tom(hx(moldura), 0.95)))
        c.caixa(bx(am - PH * 0.7, am + PH * 0.7, 0, 0.02, z0, z0 + h), cc, M, oc)
        for zz in (z0 + h * 0.36, z0 + h * 0.68):
            c.caixa(bx(a0, a1, 0, 0.02, zz - PZ * 0.7, zz + PZ * 0.7), cc, M, oc)
    if tabuas:
        # as tábuas pregadas por cima (três, desencontradas e uma meio torta) e os pregos
        mt = tab2([velho('#8a6a46'), velho('#7e6040'), velho('#94744e')], 0.13, '#2e2620', eixo=0, seed=int(a * 10))
        ot = obj()
        for k, (zt, dl) in enumerate(((z0 + h * 0.16, -0.04), (z0 + h * 0.5, 0.03), (z0 + h * 0.8, -0.02))):
            c.caixa(bx(a0 - 0.1 + dl, a1 + 0.1 + dl, 0.05, 0.085, zt, zt + 0.13 - 0.02 * k), mt, M, ot)
            for l in (a0 - 0.04 + dl, a1 + 0.04 + dl):
                caixa(bx(l - PH * 0.6, l + PH * 0.6, 0.085, 0.09, zt + 0.05, zt + 0.05 + PZ * 1.2), liso('#3a3430'), contorno=False)
    return ov


def mat_porta(cor, a0, a1, z0, z1, folhas=2, eixo_lat=0, queimada=False):
    """A porta de almofadas (uma ou duas folhas): a almofada com a luz em cima à esquerda e a sombra embaixo à direita."""
    c0 = hx(cor)

    def f(L, n, P):
        x = P[:, 0] if eixo_lat == 0 else P[:, 1]
        z = P[:, 2]
        out = np.tile(c0, (len(P), 1))
        meio = (a0 + a1) / 2
        cols = ((a0 + 0.1, meio - 0.1), (meio + 0.1, a1 - 0.1)) if folhas == 2 else ((a0 + 0.12, a1 - 0.12),)
        for (zb, zt) in ((z0 + 0.15, z0 + (z1 - z0) * 0.42), (z0 + (z1 - z0) * 0.5, z1 - 0.14)):
            for (l0, l1) in cols:
                dentro = (x > l0) & (x < l1) & (z > zb) & (z < zt)
                out = np.where(dentro[:, None], c0 * 0.9, out)
                out = np.where((dentro & (z > zt - PZ))[:, None], c0 * 0.72, out)
                out = np.where((dentro & (x < l0 + PH * 1.4))[:, None], c0 * 0.74, out)
                out = np.where((dentro & (z < zb + PZ * 1.2))[:, None], np.minimum(c0 * 1.2, 255), out)
        if folhas == 2:
            out = np.where((np.abs(x - meio) < PH * 0.7)[:, None], hx('#2a1a10'), out)
        if queimada:
            # o carvão: a madeira rachada em escamas (blocos escuros e as rachas mais claras de brasa apagada)
            bx_ = np.floor(x / (3 * PH))
            bz = np.floor(z / (2 * PZ) + 0.5 * (bx_ % 2))
            r = ruido(bx_, bz, 7.0)
            out = np.where((r > 0.55)[:, None], out * 0.6, out * 0.8)
            out = np.where((r > 0.93)[:, None], hx('#6a4a3a'), out)
        return out
    return emissivo(f)


def porta(B, face, a, z0, w, h, cor, folhas=2, moldura=CAL, queimada=False, macaneta=True):
    p = _plano(B, face)
    bx = lambda l0, l1, e0, e1, za, zb: _bx(face, p, l0, l1, e0, e1, za, zb)
    a0, a1 = a - w / 2, a + w / 2
    z1 = z0 + h
    m = liso(moldura)
    caixa(bx(a0 - 0.08, a0, 0, 0.06, z0, z1 + 0.1), m)
    caixa(bx(a1, a1 + 0.08, 0, 0.06, z0, z1 + 0.1), m)
    caixa(bx(a0 - 0.14, a1 + 0.14, 0, 0.1, z1 + 0.1, z1 + 0.2), m)
    eixo_lat = 0 if face in ('+y', '-y') else 1
    caixa(bx(a0, a1, -0.03, 0.02, z0, z1), mat_porta(cor, a0, a1, z0, z1, folhas, eixo_lat, queimada))
    if macaneta and not queimada:
        for s in ((-1, 1) if folhas == 2 else (1,)):
            xm = (a0 + a1) / 2 + s * 0.07 if folhas == 2 else a1 - 0.12
            caixa(bx(xm - 0.02, xm + 0.02, 0.02, 0.06, z0 + h * 0.45, z0 + h * 0.45 + 0.05), liso('#d8b060'), contorno=False)


# ---------------------------------------------------------------- o telhado
def mat_telha(cores, junta, zb, sin_t, a_dir, s_dir, ax, tipo='capa', fuligem=0.0, seed=0, col=0.15, px_fiada=6, falta=0.0, musgo=0.0):
    """
    As telhas numa água: as fiadas pela altura (z, contada do beiral zb ao longo da água), cada uma com `px_fiada` px
    na tela; a junta escura de 1 px embaixo de cada fiada, a luz logo acima dela e a sombra no alto da fiada (a de cima
    passa por cima). tipo 'capa': capa e canal (a capa redonda acesa do lado da luz); 'tabuinha': tabuinhas desencontradas.
    ax: o eixo da cumeeira (0 = x, 1 = y). fuligem: o quanto o telhado está preto de fumaça (manchas).
    """
    cs = np.stack([hx(x) for x in cores])
    jc = hx(junta)

    def f(L, n, P):
        mpp = _px_vertical(a_dir, s_dir)
        fi = px_fiada * mpp
        s = (P[:, 2] - zb) / sin_t
        fila = np.floor(s / fi)
        g = s - fila * fi
        u = P[:, ax] + 50
        _, rv = BE.frente_tela()
        dirr = rv[ax] >= 0          # u crescendo anda para a direita na tela?
        if tipo == 'capa':
            cl = np.floor(u / col)
            gx = (u / col) % 1
            if not dirr:
                gx = 1 - gx
            ids = fila * 4096 + cl
            out = cs[(ruido(ids * 0.37, 7.7 + seed) * len(cs)).astype(int) % len(cs)]
            capa = (cl % 2) == 0
            out = np.where((capa & (gx < 0.3))[:, None], out * 1.14 + 4, out)
            out = np.where((capa & (gx > 0.8))[:, None], out * 0.82, out)
            out = np.where((~capa)[:, None], out * 0.8, out)
        else:
            cl = np.floor(u / 0.26 + 0.5 * (fila % 2))
            ids = fila * 4096 + cl
            out = cs[(ruido(ids * 0.37, 3.3 + seed) * len(cs)).astype(int) % len(cs)]
            hh = (u / 0.26 + 0.5 * (fila % 2)) % 1
            if not dirr:
                hh = 1 - hh
            out = np.where((hh * 0.26 < PH * 1.0)[:, None], out * 0.72, out)
        out = np.where((g > fi - mpp * 1.05)[:, None], out * 0.84, out)
        out = np.where(((g >= mpp) & (g < 2 * mpp))[:, None], np.minimum(out * 1.12 + 4, 255), out)
        out = np.where((g < mpp)[:, None], jc, out)
        if musgo:
            q = suave(P[:, 0], P[:, 1] + P[:, 2], 0.5, 61 + seed) * 0.7 + suave(P[:, 0], P[:, 1], 0.18, 62 + seed) * 0.3
            mm = q > 0.7 - musgo * 0.25
            out = np.where(mm[:, None], out * 0.6 + hx('#5a6438') * 0.4, out)
            out = np.where((q > 0.8 - musgo * 0.2)[:, None], out * 0.86, out)
        if falta:
            # a telha deslocada (mais clara: levantada, pegando luz, a junta de baixo aberta) e a que caiu (o buraco
            # com a ripa de madeira atravessada e o escuro do forro)
            rf = ruido(ids * 0.71, 13.0 + seed)
            desl = (rf >= falta) & (rf < falta * 1.6)
            out = np.where(desl[:, None], np.minimum(out * 1.16 + 6, 255), out)
            out = np.where((desl & (g < 2 * mpp))[:, None], hx('#1e1614'), out)
            buraco = rf < falta
            fundo = np.where(((g > fi * 0.35) & (g < fi * 0.35 + 2 * mpp))[:, None], hx('#6a5238'), hx('#241c18'))
            out = np.where(buraco[:, None], fundo, out)
        if fuligem:
            k = suave(P[:, 0], P[:, 1] + P[:, 2], 0.8, 51 + seed) * 0.6 + suave(P[:, 0], P[:, 1], 0.3, 52 + seed) * 0.4
            k = np.floor(np.clip((k - (0.62 - fuligem * 0.35)) * 3.2, 0, 1) * 3) / 3
            out = out * (1 - k[:, None] * 0.7) + np.array([24.0, 18.0, 16.0]) * k[:, None] * 0.7
        return out
    return emissivo(f)


def _M(eixo):
    """O mapa (u ao longo da cumeeira, v através, z) -> (x, y, z) e o das normais."""
    if eixo == 'x':
        return (lambda u, v, z: (u, v, z)), (lambda nu, nv, nz: (nu, nv, nz))
    return (lambda u, v, z: (v, u, z)), (lambda nu, nv, nz: (nv, nu, nz))


def telhado(U0, U1, V0, V1, perfil, eixo, cores, junta, parede, testeira='#e6decd', beiral_u=0.25, tipo='capa',
            fuligem=0.0, cumeeira='#9c4428', seed=0, trechos=None, esp=0.1, falta=0.0, musgo=0.0):
    """
    O telhado de duas águas sobre o corpo (U ao longo da cumeeira, V através): perfil = [(v, z), ...] da quina de um
    lado até a do outro passando pela cumeeira (2 pontos de cada lado = duas águas; 3 = o telhado do celeiro, de
    mansarda). O beiral é o primeiro e o último ponto do perfil (já para fora da parede). Os oitões (o triângulo de
    parede) nas duas pontas, com o material `parede`; as tábuas do oitão e a testeira com a boca das telhas.
    trechos: [(u0, u1)] os pedaços de telhado que ainda existem (o orfanato); o resto caiu.
    """
    c = CZ.c
    P3, N3 = _M(eixo)
    ax = 0 if eixo == 'x' else 1
    a_dir = np.array(P3(1.0, 0.0, 0.0))
    o_t = obj()
    SU0, SU1 = U0 - beiral_u, U1 + beiral_u
    trechos = trechos or [(SU0, SU1)]
    zb_min = perfil[0][1]
    for i in range(len(perfil) - 1):
        (va, za), (vb, zb) = perfil[i], perfil[i + 1]
        if abs(zb - za) < 1e-6:
            continue
        sobe = zb > za
        lo_v, lo_z, hi_v, hi_z = (va, za, vb, zb) if sobe else (vb, zb, va, za)
        dv = hi_v - lo_v
        ln = math.hypot(dv, hi_z - lo_z)
        sin_t = (hi_z - lo_z) / ln
        # a normal: para fora (o lado do beiral)
        nv_ = -math.copysign(1.0, dv) * (hi_z - lo_z) / ln
        nz_ = abs(dv) / ln
        s_dir = np.array(P3(0.0, dv / ln, (hi_z - lo_z) / ln))
        # o z do beiral desta água (para contar as fiadas): o da ponta de baixo do primeiro trecho desta água
        zb_agua = lo_z
        if not sobe and i > 0:
            pass
        m = mat_telha(cores, junta, zb_agua, sin_t, a_dir, s_dir, ax, tipo, fuligem, seed, falta=falta, musgo=musgo)
        for (t0, t1) in trechos:
            pts = [P3(t0, va, za), P3(t1, va, za), P3(t1, vb, zb), P3(t0, vb, zb)]
            c.face_plana(pts, N3(0, nv_, nz_), m, M, o_t)
            # a espessura nas pontas do trecho (a tábua do oitão ou a quebra do telhado caído)
            for (tu, sg) in ((t1, 1), (t0, -1)):
                c.face_plana([P3(tu, va, za - esp), P3(tu, vb, zb - esp), P3(tu, vb, zb), P3(tu, va, za)], N3(sg, 0, 0),
                             liso(testeira if (tu in (SU0, SU1)) else '#3a2a22'), M, o_t)
    # a testeira (a frente da espessura, nos dois beirais), com a boca das telhas
    o_te = obj()
    for (v, z, sg) in ((perfil[0][0], perfil[0][1], -1 if perfil[0][0] < perfil[-1][0] else 1),
                       (perfil[-1][0], perfil[-1][1], 1 if perfil[0][0] < perfil[-1][0] else -1)):
        def mt(L, n, P, z=z):
            out = np.tile(hx(testeira), (len(P), 1))
            u = P[:, ax] + 50
            capa = (np.floor(u / 0.15) % 2) == 0
            gx = (u / 0.15) % 1
            boca = capa & (gx > 0.15) & (gx < 0.85) & (P[:, 2] > z - 0.04) if tipo == 'capa' else (P[:, 2] > z - 0.03)
            out = np.where(boca[:, None], hx('#4a2418') if tipo == 'capa' else hx(cores[0]) * 0.7, out)
            return out
        for (t0, t1) in trechos:
            c.face_plana([P3(t0, v, z - esp), P3(t1, v, z - esp), P3(t1, v, z), P3(t0, v, z)], N3(0, sg, 0), emissivo(mt), M, o_te)
    # os oitões (o triângulo de parede nas duas pontas, no plano da parede)
    o_o = obj()
    for (uu, sg) in ((U1, 1), (U0, -1)):
        pts = []
        for (v, z) in perfil:
            pts.append((min(max(v, V0), V1), z))
        # o perfil por dentro da parede: corta nas paredes (o beiral fica de fora)
        poly = [(V0, perfil[0][1] if perfil[0][0] >= V0 else _interp_z(perfil, V0))]
        for (v, z) in perfil[1:-1]:
            poly.append((v, z - esp))
        poly.append((V1, _interp_z(perfil, V1)))
        base_z = min(p[1] for p in poly)
        poly = [(V0, base_z)] + [(v, z) for (v, z) in poly] + [(V1, base_z)]
        q = [P3(uu, v, z) for (v, z) in poly]
        q2 = []
        for x in q:
            if not q2 or np.linalg.norm(np.array(x) - np.array(q2[-1])) > 1e-6:
                q2.append(x)
        c.face_plana(q2, N3(sg, 0, 0), parede, M, o_o)
    # a cumeeira (as telhas de cima, em gomos)
    vr, zr = max(perfil, key=lambda p: p[1])
    o_c = obj()
    mc = mat_cor([cumeeira, _hex(_tom(hx(cumeeira), 1.08))], lambda L, n: np.floor((L[:, ax] + 50) / 0.34).astype(np.int64))
    for (t0, t1) in trechos:
        for u in np.arange(t0, t1 - 0.01, 0.34):
            u1 = min(u + 0.36, t1)
            for sg in (1, -1):
                pts = [P3(u, vr, zr + 0.08), P3(u1, vr, zr + 0.08), P3(u1, vr + sg * 0.13, zr - 0.05), P3(u, vr + sg * 0.13, zr - 0.05)]
                c.face_plana(pts, N3(0, sg * 0.6, 0.8), mc, M, o_c)
            for (uu, s2) in ((u1, 1), (u, -1)):
                c.face_plana([P3(uu, vr - 0.13, zr - 0.05), P3(uu, vr + 0.13, zr - 0.05), P3(uu, vr, zr + 0.08)], N3(s2, 0, 0),
                             liso(_hex(_tom(hx(cumeeira), 0.8))), M, o_c)
    return o_t


def _interp_z(perfil, v):
    vs = [p[0] for p in perfil]
    zs = [p[1] for p in perfil]
    if vs[0] > vs[-1]:
        vs, zs = vs[::-1], zs[::-1]
    return float(np.interp(v, vs, zs))


def _moita(x, y, r=0.24, h=0.42, seed=0):
    """A moita de mato que cresceu encostada na parede: um tufo redondo verde-palha e os capins espetados por cima."""
    o = obj()
    rng = np.random.default_rng(seed + 90)
    m = mat_folha((x, y, h * 0.4), (r * 1.3, r * 1.3, h * 0.6), MATO_PAL, q=0.06, seed=seed + 7)
    _cachos(o, x, y, h * 0.32, r, h * 0.36, 12, r * 0.25, r * 0.4, rng, m, corte=0.0)
    cores = [mat_chapado(cc) for cc in ('#7a7e3e', '#9a9450', '#6a7034', '#b0a462')]
    for j in range(5):
        a = (rng.random() - 0.5) * 1.2
        hh = h * (0.9 + 0.7 * rng.random())
        s0 = (rng.random() - 0.5) * r
        _folha_fita(o, x, y, [(s0, h * 0.3), (s0 + a * hh * 0.35, hh * 0.75), (s0 + a * hh * 0.7, hh)], [0.03, 0.022, 0.012], cores[j % 4])
    pegada_redonda(x, y, r * 0.9, 5)


def _mato_paredes(B, por_lado, seed=0, pular=()):
    """As moitas de mato ao longo das quatro paredes (por_lado = quantas em cada lado), encostadas no rodapé."""
    X0, X1, Y0, Y1 = B
    rng = np.random.default_rng(seed)
    k = 0
    for face in ('+y', '-y', '+x', '-x'):
        n = por_lado.get(face, 0)
        for i in range(n):
            t = (i + 0.2 + rng.random() * 0.6) / n
            if face in ('+y', '-y'):
                x = X0 + 0.3 + t * (X1 - X0 - 0.6)
                y = (Y1 + 0.2) if face == '+y' else (Y0 - 0.2)
            else:
                y = Y0 + 0.3 + t * (Y1 - Y0 - 0.6)
                x = (X1 + 0.2) if face == '+x' else (X0 - 0.2)
            if any(a0 <= (x if face in ('+y', '-y') else y) <= a1 and face == f for (f, a0, a1) in pular):
                continue
            _moita(x, y, 0.22 + 0.14 * rng.random(), 0.45 + 0.45 * rng.random(), seed=seed * 10 + k)
            k += 1


def chamine(x0, x1, y0, y1, z0, z1):
    fn = id_pedras_parede(0.11, 0.2, seed=9)
    caixa((x0, x1, y0, y1, z0, z1), mat_juntas(['#a7a196', '#9b958a', '#b1ab9f', '#928c82'], fn, '#5a544c', seed=3))
    caixa((x0 - 0.05, x1 + 0.05, y0 - 0.05, y1 + 0.05, z1 - 0.12, z1 + 0.05), {'cima': liso('#8e887e'), '*': liso('#b8b2a6')})
    caixa((x0 + 0.07, x1 - 0.07, y0 + 0.07, y1 - 0.07, z1 + 0.05, z1 + 0.052), liso('#1e1714'), contorno=False)


def rodape_pedra(B, z1=0.45, cores=('#a7a196', '#9b958a', '#b1ab9f', '#928c82'), junta='#5a544c', esp=0.03):
    X0, X1, Y0, Y1 = B
    fn = id_pedras_parede(0.13, 0.32, seed=2)
    caixa((X0 - esp, X1 + esp, Y0 - esp, Y1 + esp, 0, z1), mat_juntas(list(cores), fn, junta, seed=5))
    caixa((X0 - esp - 0.02, X1 + esp + 0.02, Y0 - esp - 0.02, Y1 + esp + 0.02, z1, z1 + 0.05), liso('#b8b0a2'))


def oculo(B, face, l, z, r=0.22):
    """A janelinha redonda do sótão no oitão."""
    c = CZ.c
    p = _plano(B, face)
    sg = 1 if face[0] == '+' else -1
    eixo = face[1]
    n = (sg, 0, 0) if eixo == 'x' else (0, sg, 0)

    def pt(rr, a, e):
        if eixo == 'x':
            return (p + sg * e, l + rr * math.cos(a), z + rr * math.sin(a))
        return (l + rr * math.cos(a), p + sg * e, z + rr * math.sin(a))
    o = obj()
    c.face_plana([pt(r, a, 0.03) for a in np.linspace(0, 2 * math.pi, 22, endpoint=False)], n, liso(CAL), M, o)
    o2 = obj(contorno=False)
    c.face_plana([pt(r * 0.66, a, 0.035) for a in np.linspace(0, 2 * math.pi, 20, endpoint=False)], n, liso('#2c3c48'), M, o2)


# =====================================================================================================================
# o casarão (14 x 9 casas, 6,5 m): dois andares, a varanda na frente, o telhado de telha capa e canal
# =====================================================================================================================
TELHA = [velho(x, 0.32, 0) for x in ('#a4492a', '#ac522f', '#9a4428', '#b05a34')]   # a telha desbotada de sol
TELHA_J = '#5e2416'


def _casarao():
    c = CZ.c
    W, D = 14 * CASA, 9 * CASA
    HX0, HX1 = 0.3 * CASA, W - 0.3 * CASA
    HY0, HY1 = 0.4 * CASA, D - 1.9 * CASA
    B = (HX0, HX1, HY0, HY1)
    ZE, ZR = 5.0, 10.61 * UM - 0.05          # o beiral e a cumeeira (6,45 m: o alto do catálogo)
    YR = (HY0 + HY1) / 2
    BEI = 0.28
    KT = (ZR - ZE) / (YR - HY0)
    ZF = 2.55                                  # a faixa entre os andares
    REB = mat_reboco('#cdc3ad', seed=1, sujeira=0.9, descasca=0.75, tijolo='#9a6a52')
    caixa((HX0, HX1, HY0, HY1, 0, ZE), REB)
    rodape_pedra(B, 0.42)
    # os cunhais brancos nas quatro quinas, a faixa entre os andares e a cimalha embaixo do beiral
    for (xa, ya) in ((HX0, HY0), (HX1, HY0), (HX0, HY1), (HX1, HY1)):
        sx = 1 if xa > W / 2 else -1
        sy = 1 if ya > D / 2 else -1
        caixa((min(xa, xa - sx * 0.2), max(xa, xa - sx * 0.2), min(ya, ya + sy * 0.025), max(ya, ya + sy * 0.025), 0.47, ZE - 0.1), liso(CAL))
        caixa((min(xa, xa + sx * 0.025), max(xa, xa + sx * 0.025), min(ya, ya - sy * 0.2), max(ya, ya - sy * 0.2), 0.47, ZE - 0.1), liso(CAL))
    caixa((HX0 - 0.04, HX1 + 0.04, HY0 - 0.04, HY1 + 0.04, ZF, ZF + 0.13), liso(CAL))
    caixa((HX0 - 0.05, HX1 + 0.05, HY0 - 0.05, HY1 + 0.05, ZE - 0.2, ZE - 0.05), liso('#e2dac9'))
    # as janelas: 5 vãos na frente e atrás (o do meio da frente é a porta), 2 por andar nos lados
    VAOS = [HX0 + (i + 0.5) * (HX1 - HX0) / 5 for i in range(5)]
    Z1, Z2, HJ = 0.95, 3.25, 1.25
    # tudo escuro (ninguém mora mais): o vidro empoeirado, duas janelas com tábua pregada, uma quebrada, uma
    # veneziana caída
    tabua = {('+y', 0, 0), ('-y', 3, 1)}
    quebrada = {('+y', 4, 1), ('-y', 1, 0)}
    solta = {('+y', 3, 1), ('-y', 0, 0)}
    for face in ('+y', '-y'):
        for i, a in enumerate(VAOS):
            for k, z0 in enumerate((Z1, Z2)):
                if i == 2 and k == 0:
                    continue
                q = (face, i, k)
                janela(B, face, a, z0, 0.68, HJ, 'breu' if q in tabua else ('queimado' if q in quebrada else 'sujo'),
                       tabuas=q in tabua, solta=q in solta, cruz=q not in quebrada)
    porta(B, '-y', VAOS[2], 0.42, 0.9, 1.95, velho('#5a3a24', 0.45), folhas=1)
    caixa((VAOS[2] - 0.6, VAOS[2] + 0.6, HY0 - 0.4, HY0, 0, 0.42), mat_juntas(['#c6bfb0', '#bcb5a6'], lambda P: np.floor((P[:, 0] + 50) / 0.45).astype(np.int64), '#8a8374'))
    for face in ('+x', '-x'):
        for t in (0.3, 0.7):
            a = HY0 + (HY1 - HY0) * t
            for k, z0 in enumerate((Z1, Z2)):
                tb = (face, t, k) == ('-x', 0.7, 0)
                janela(B, face, a, z0, 0.6, HJ, 'breu' if tb else 'sujo', tabuas=tb, solta=(face, t, k) == ('+x', 0.7, 1))
        oculo(B, face, YR, ZE + 0.62, 0.21)
    porta(B, '+y', VAOS[2], 0.42, 1.12, 1.95, velho('#5a3a24', 0.45), folhas=2)
    # o telhado de duas águas (cumeeira ao longo de x) e a chaminé de pedra (o fogão a lenha da cozinha)
    zb = ZE - BEI * KT
    telhado(HX0, HX1, HY0, HY1, [(HY0 - BEI, zb), (YR, ZR), (HY1 + BEI, zb)], 'x', TELHA, TELHA_J, REB, testeira='#cfc7b6',
            falta=0.035, musgo=0.5)
    cx0 = HX0 + 0.72 * (HX1 - HX0)
    chamine(cx0, cx0 + 0.5, HY0 + 0.95, HY0 + 1.45, ZE - 0.6, ZR + 0.55)
    # ---- a varanda: o deck, os degraus, os pilares, o guarda-corpo e o telhado de uma água
    DK = (HX0 + 0.08, HX1 - 0.08, HY1, D - 0.1, 0.0, 0.42)
    tab = tab2([velho('#9a6a40'), velho('#a27146'), velho('#94643c', 0.7)], 0.14, '#3a322a', eixo=1, seed=4, comp=2.1, org=HY1)
    caixa(DK, {'cima': tab, '*': liso(velho('#6a4a30'))})
    YFR = DK[3]
    MEIO = (HX0 + HX1) / 2
    # as ripas do rodapé do deck
    def ripas(L, n, P):
        n = np.asarray(n, float)
        lat = P[:, 0] if abs(n[1]) > 0.5 else P[:, 1]
        g = (lat / (4 * PH)) % 1
        out = np.where((g < 0.3)[:, None], hx('#2e2822'), hx(velho('#7a5636')))
        return np.where((P[:, 2] > 0.33)[:, None], hx(velho('#8a6440')), out)
    o = obj(contorno=False)
    c.caixa((DK[0] + 0.02, DK[1] - 0.02, YFR - 0.04, YFR + 0.002, 0.0, 0.4), emissivo(ripas), M, o)
    for xx in (DK[0] - 0.002, DK[1] - 0.04):
        c.caixa((xx, xx + 0.042, HY1, YFR - 0.04, 0.0, 0.4), emissivo(ripas), M, o)
    # os degraus de pedra
    for (y0_, y1_, z1_) in ((YFR - 0.05, YFR + 0.42, 0.14), (YFR - 0.05, YFR + 0.2, 0.28)):
        fnd = lambda P: np.floor((P[:, 0] + 50) / 0.45).astype(np.int64)
        caixa((MEIO - 0.68, MEIO + 0.68, y0_, y1_, 0, z1_), mat_juntas(['#c6bfb0', '#bcb5a6'], fnd, '#8a8374'))
    # os pilares brancos (base e capitel) e o guarda-corpo com os balaústres
    ZTV = 2.5
    YPIL = D - 0.3 * CASA
    PIL = [HX0 + 0.18, HX0 + (HX1 - HX0) * 0.25, MEIO - 0.75, MEIO + 0.75, HX0 + (HX1 - HX0) * 0.75, HX1 - 0.18]
    for x in PIL:
        caixa((x - 0.075, x + 0.075, YPIL - 0.075, YPIL + 0.075, 0.42, ZTV), liso(CAL))
        caixa((x - 0.1, x + 0.1, YPIL - 0.1, YPIL + 0.1, 0.42, 0.56), liso('#e2dac9'))
        caixa((x - 0.1, x + 0.1, YPIL - 0.1, YPIL + 0.1, ZTV - 0.14, ZTV - 0.06), liso('#e2dac9'))
    ob = obj(contorno=False)
    for i in range(5):
        if i == 2:
            continue
        xa, xb = PIL[i], PIL[i + 1]
        caixa((xa + 0.075, xb - 0.075, YPIL - 0.05, YPIL + 0.05, 1.12, 1.2), liso(CAL))
        caixa((xa + 0.075, xb - 0.075, YPIL - 0.035, YPIL + 0.035, 0.5, 0.56), liso('#e2dac9'))
        for x in np.arange(xa + 0.075 + 0.1, xb - 0.075 - 0.04, 0.125):
            c.caixa((x, x + 0.045, YPIL - 0.022, YPIL + 0.022, 0.56, 1.12), liso('#e8e0d0'), M, ob)
    for xs_ in (DK[0] + 0.1, DK[1] - 0.1):
        caixa((xs_ - 0.05, xs_ + 0.05, HY1 + 0.02, YPIL - 0.075, 1.12, 1.2), liso(CAL))
        for y in np.arange(HY1 + 0.12, YPIL - 0.1, 0.125):
            c.caixa((xs_ - 0.022, xs_ + 0.022, y, y + 0.045, 0.5, 1.12), liso('#e8e0d0'), M, ob)
    # a viga em cima dos pilares e o telhado da varanda (uma água, encostado na parede)
    caixa((DK[0] - 0.04, DK[1] + 0.04, YPIL - 0.08, YPIL + 0.08, ZTV - 0.06, ZTV + 0.1), liso('#e2dac9'))
    ZV0, ZV1 = 2.6, 3.06
    YV = D + 0.02
    telhado_v = [(YV, ZV0), (HY1, ZV1)]
    _agua_uma(DK[0] - 0.1, DK[1] + 0.1, YV, ZV0, HY1, ZV1, TELHA, TELHA_J, falta=0.05, musgo=0.6)
    # as coisas da varanda: o banco, os vasos, os lampiões, o capacho
    _banco(VAOS[0] - 0.55, VAOS[0] + 0.55, HY1 + 0.05)
    _vaso(MEIO - 1.0, YFR - 0.3, 0.42)
    _vaso(MEIO + 1.0, YFR - 0.3, 0.42)
    _vaso(VAOS[3] + 0.5, HY1 + 0.25, 0.42, r=0.13, h=0.26)
    for xl in (MEIO - 0.85, MEIO + 0.85):
        _lampiao(xl, HY1, 1.55)
    caixa((MEIO - 0.45, MEIO + 0.45, HY1 + 0.15, HY1 + 0.6, 0.42, 0.435), liso(velho('#8a5a3a')), contorno=False)
    # as folhas secas que o vento juntou no canto do deck e o mato que tomou a volta da casa
    _folhas_secas(DK[0] + 0.2, DK[0] + 1.1, HY1 + 0.05, HY1 + 0.6, 0.42)
    _folhas_secas(DK[1] - 1.4, DK[1] - 0.3, YFR - 0.5, YFR - 0.1, 0.42, seed=2)
    _mato_paredes(B, {'-y': 5, '+x': 3, '-x': 3}, seed=1, pular=(('-y', VAOS[2] - 0.8, VAOS[2] + 0.8),))
    for (xm_, ym_) in ((DK[0] + 0.25, YFR + 0.12), (MEIO - 1.6, YFR + 0.12), (MEIO + 2.3, YFR + 0.12), (DK[1] - 0.3, YFR + 0.12)):
        _moita(xm_, ym_, 0.26, 0.6, seed=int(xm_ * 10))
    # a lenha empilhada no lado direito, embaixo da janela da cozinha
    _lenha(HX1 + 0.03, HX1 + 0.21, HY0 + 0.25, HY0 + 1.5, 0.8)
    pegada(HX0, HX1, HY0, HY1)
    pegada(DK[0], DK[1], HY1, YFR)


def _agua_uma(x0, x1, ylo, zlo, yhi, zhi, cores, junta, esp=0.09, falta=0.0, musgo=0.0):
    """Uma água só (o telhado da varanda): de ylo (o beiral, embaixo) até yhi (encostado na parede, em cima)."""
    c = CZ.c
    o = obj()
    dv = yhi - ylo
    ln = math.hypot(dv, zhi - zlo)
    sin_t = (zhi - zlo) / ln
    n = (0, -math.copysign(1.0, dv) * (zhi - zlo) / ln, abs(dv) / ln)
    m = mat_telha(cores, junta, zlo, sin_t, np.array([1.0, 0, 0]), np.array([0, dv / ln, (zhi - zlo) / ln]), 0, falta=falta, musgo=musgo, seed=3)
    c.face_plana([(x0, ylo, zlo), (x1, ylo, zlo), (x1, yhi, zhi), (x0, yhi, zhi)], n, m, M, o)
    sg = 1 if ylo > yhi else -1

    def mt(L, n_, P):
        out = np.tile(hx('#e6decd'), (len(P), 1))
        u = P[:, 0] + 50
        capa = (np.floor(u / 0.15) % 2) == 0
        gx = (u / 0.15) % 1
        boca = capa & (gx > 0.15) & (gx < 0.85) & (P[:, 2] > zlo - 0.04)
        return np.where(boca[:, None], hx('#4a2418'), out)
    c.face_plana([(x0, ylo, zlo - esp), (x1, ylo, zlo - esp), (x1, ylo, zlo), (x0, ylo, zlo)], (0, sg, 0), emissivo(mt), M, o)
    for (x, s) in ((x1, 1), (x0, -1)):
        c.face_plana([(x, ylo, zlo - esp), (x, yhi, zhi - esp), (x, yhi, zhi), (x, ylo, zlo)], (s, 0, 0), liso('#e6decd'), M, o)
    c.face_plana([(x0, ylo, zlo - esp), (x1, ylo, zlo - esp), (x1, yhi, zhi - esp), (x0, yhi, zhi - esp)], (0, 0, -1), liso('#d8d0c0'), M, o)


def _banco(x0, x1, y0):
    m = liso(velho('#7a5232'))
    tab = mat_cor([velho('#8e6038'), velho('#86593a')], lambda L, n: np.floor(L[:, 1] / 0.1).astype(np.int64))
    caixa((x0, x1, y0, y0 + 0.4, 0.84, 0.9), {'cima': tab, '*': m})
    for xx in (x0 + 0.05, x1 - 0.1):
        caixa((xx, xx + 0.05, y0 + 0.04, y0 + 0.36, 0.42, 0.84), liso(velho('#5e3e26')))
    caixa((x0, x1, y0, y0 + 0.05, 0.9, 1.3), {'*': mat_cor([velho('#8e6038'), velho('#86593a')], lambda L, n: np.floor(L[:, 2] / 0.1).astype(np.int64)), 'cima': m})
    caixa((x0 - 0.04, x0 + 0.02, y0, y0 + 0.38, 0.9, 1.08), m)
    caixa((x1 - 0.02, x1 + 0.04, y0, y0 + 0.38, 0.9, 1.08), m)


def _folhas_secas(x0, x1, y0, y1, z, seed=0):
    """O monte de folhas secas que o vento juntou num canto (blocos de 2 px, marrons e laranja, sem contorno)."""
    o = obj(contorno=False)
    cf = np.stack([hx('#7a5230'), hx('#8e6234'), hx('#5e4024'), hx('#a8743a')])
    def f(L, n, P):
        bx = np.floor(P[:, 0] / (2 * PH))
        by = np.floor(P[:, 1] / (2 * PH))
        return cf[(ruido(bx, by, 6.0 + seed) * 4).astype(int) % 4]

    rng = np.random.default_rng(seed + 11)
    for k in range(9):
        a = x0 + rng.random() * (x1 - x0)
        b = y0 + rng.random() * (y1 - y0)
        s_ = 0.08 + 0.08 * rng.random()
        CZ.c.caixa((a - s_, a + s_, b - s_ * 0.7, b + s_ * 0.7, z, z + 0.012 + 0.02 * rng.random()), emissivo(f), M, o)


def _vaso(x, y, z, r=0.16, h=0.32, flores=None):
    c = CZ.c
    o = obj()
    _poligono_rodado(x, y, [(z, r * 0.78), (z + h - 0.06, r), (z + h - 0.06, r * 1.08), (z + h, r * 1.08)], vol(x, y, '#9a6a4e'), o, lados=16)
    _disco(x, y, z + h, r * 1.0, liso('#3e2a1c'), o, lados=16)
    ob = obj()
    m = mat_folha((x, y, z + h + r * 0.5), (r * 1.3, r * 1.3, r * 1.0), SECO_PAL, q=0.045, seed=int(x * 10))
    rng = np.random.default_rng(int(x * 100))
    _cachos(ob, x, y, z + h + r * 0.35, r * 0.95, r * 0.45, 9, r * 0.25, r * 0.38, rng, m, achata=0.6)
    for (ds, dz) in ((-0.08, 0.32), (0.06, 0.38), (0.11, 0.26)):
        _folha_fita(ob, x, y, [(0.0, z + h + 0.05), (ds * 0.5, z + h + dz * 0.6), (ds, z + h + dz)], [0.02, 0.016, 0.01], mat_chapado('#5e4a32'))


def _lampiao(x, y, z):
    """O lampião de parede: o braço de ferro, o chapéu, o vidro aceso e a base."""
    c = CZ.c
    preto = liso('#3e2e26')
    caixa((x - 0.03, x + 0.03, y, y + 0.06, z + 0.1, z + 0.5), preto)
    caixa((x - 0.025, x + 0.025, y, y + 0.26, z + 0.47, z + 0.51), preto)
    oc = obj()
    for (pts, n) in (([(x - 0.15, y + 0.38, z + 0.42), (x + 0.15, y + 0.38, z + 0.42), (x, y + 0.23, z + 0.56)], (0, 0.7, 0.7)),
                     ([(x + 0.15, y + 0.38, z + 0.42), (x + 0.15, y + 0.08, z + 0.42), (x, y + 0.23, z + 0.56)], (0.7, 0, 0.7)),
                     ([(x - 0.15, y + 0.08, z + 0.42), (x - 0.15, y + 0.38, z + 0.42), (x, y + 0.23, z + 0.56)], (-0.7, 0, 0.7)),
                     ([(x + 0.15, y + 0.08, z + 0.42), (x - 0.15, y + 0.08, z + 0.42), (x, y + 0.23, z + 0.56)], (0, -0.7, 0.7))):
        c.face_plana(pts, n, liso('#4a3628'), M, oc)
    ov = obj()

    def vid(L, n, P):
        zz = (P[:, 2] - z - 0.06) / 0.34
        out = np.where((zz > 0.62)[:, None], hx('#4a4a42'), hx('#3a3a34'))
        # o fuligem da última vela no alto do vidro e o reflexo apagado
        return np.where(((zz > 0.25) & (zz < 0.35))[:, None], hx('#5c5e58'), out)
    c.caixa((x - 0.11, x + 0.11, y + 0.12, y + 0.34, z + 0.06, z + 0.42), emissivo(vid), M, ov)
    caixa((x - 0.14, x + 0.14, y + 0.1, y + 0.36, z, z + 0.06), preto)


def _lenha(x0, x1, y0, y1, z1, r=0.09):
    """A lenha empilhada (as toras deitadas ao longo de x: as pontas viradas para +x e para -x)."""
    def toras(y, z):
        fila = np.floor(z / (r * 1.74))
        off = (fila % 2) * r
        col = np.floor((y - y0 + off) / (2 * r))
        cy = col * 2 * r + r - off + y0
        cz = fila * r * 1.74 + r
        rr = r * (0.86 + 0.12 * ruido(col, fila, 2.0))
        return np.hypot(y - cy, z - cz) / rr, ruido(col, fila, 4.0), z > cz + r * 0.3, y > cy

    def m(L, n, P):
        n = np.asarray(n, float)
        y, z = P[:, 1], P[:, 2]
        d, k, cima, dir_ = toras(y, z)
        if abs(n[0]) > 0.5:
            claro = np.where((k > 0.66)[:, None], hx('#e8c48a'), np.where((k > 0.33)[:, None], hx('#dcb27a'), hx('#d0a46c')))
            out = np.tile(hx('#1e130c'), (len(P), 1))
            out = np.where((d < 1.0)[:, None], hx('#4a2e1a'), out)
            out = np.where((d < 0.78)[:, None], claro, out)
            out = np.where(((d < 0.52) & (d > 0.36))[:, None], claro * 0.86, out)
            return out
        g = ((z / (r * 1.74)) % 1) if abs(n[2]) < 0.5 else ((y - y0) / (2 * r)) % 1
        out = np.tile(hx('#6e4a2c'), (len(P), 1))
        out = np.where((g < 0.18)[:, None], hx('#2a1a10'), out)
        return np.where(((g > 0.25) & (g < 0.45))[:, None], hx('#86603a'), out)
    caixa((x0, x1, y0, y1, 0, z1), emissivo(m))
    pegada(x0, x1, y0, y1)


# =====================================================================================================================
# o celeiro (12 x 8 casas, 6,5 m): o vermelho de tábuas em pé, o telhado de mansarda e o portão grande na frente
# =====================================================================================================================
def mat_tabua_v(cores, larg, junta, eixo_cima=False, branco=None, seed=0, descasca=0.0):
    """As tábuas em pé (o celeiro): a junta de 1 px entre elas, a luz logo depois da junta, o veio e o desbotado em cima."""
    base = tab2(cores, larg, junta, eixo=1, seed=seed, veio=0.92)

    def f(L, n, P):
        out = base(L, n, P)
        a, b = coords(P, np.asarray(n, float))
        d = suave(a, P[:, 2], 0.7, 61 + seed)
        out = np.where((d > 0.7)[:, None], _tom(out, 1.06), out)
        if descasca:
            # a tinta que descascou: a madeira cinza aparece em placas compridas (em pé, como a tábua), a borda de
            # cima da placa com 1 px de sombra; a sujeira subindo do chão
            def placa(z):
                return suave(a / 0.6, z / 1.6, 0.35, 63 + seed) * 0.7 + suave(a, z, 0.12, 64 + seed) * 0.3
            t = 1 - 0.4 * descasca
            dentro = placa(P[:, 2]) > t
            borda = dentro & (placa(P[:, 2] + PZ) <= t)
            nu = hx('#8a8276') * np.where((((a / PH) % 9) < 1)[:, None], 0.8, 1.0)
            out = np.where(dentro[:, None], nu, out)
            out = np.where(borda[:, None], out * 0.62, out)
            out = np.where((P[:, 2] < 0.55 + 0.1 * suave(a, 0, 0.3, 65))[:, None], out * 0.88, out)
        return out
    return emissivo(f)


def _x_porta(face, plano, a0, a1, z0, z1, cor='#d2cab8', larg=0.09):
    """O X branco e o quadro da porta do celeiro (tábuas pregadas por cima)."""
    c = CZ.c
    o = obj()
    m = liso(cor)
    e0, e1 = 0.02, 0.05
    bx = lambda l0, l1, za, zb: _bx(face, plano, l0, l1, e0, e1, za, zb)
    for b in (bx(a0, a1, z0, z0 + larg), bx(a0, a1, z1 - larg, z1), bx(a0, a0 + larg, z0, z1), bx(a1 - larg, a1, z0, z1)):
        c.caixa(b, m, M, o)
    sg = 1 if face[0] == '+' else -1
    e = e1 - 0.005
    for (pa, pb) in (((a0 + larg, z0 + larg), (a1 - larg, z1 - larg)), ((a1 - larg, z0 + larg), (a0 + larg, z1 - larg))):
        k = larg * 0.75
        pts2 = [(pa[0], pa[1]), (pa[0], pa[1] + k), (pb[0], pb[1]), (pb[0], pb[1] - k)] if pa[0] < pb[0] else \
               [(pa[0], pa[1]), (pa[0], pa[1] + k), (pb[0], pb[1]), (pb[0], pb[1] - k)]
        if face in ('+y', '-y'):
            pts = [(l, plano + sg * e, z) for (l, z) in pts2]
            n = (0, sg, 0)
        else:
            pts = [(plano + sg * e, l, z) for (l, z) in pts2]
            n = (sg, 0, 0)
        c.face_plana(pts, n, m, M, o, dois_lados=True)


def _celeiro(aberto=True):
    c = CZ.c
    W, D = 12 * CASA, 8 * CASA
    X0, X1, Y0, Y1 = 0.25, W - 0.25, 0.3, D - 0.3
    B = (X0, X1, Y0, Y1)
    ZE = 3.5
    ZR = 10.61 * UM - 0.05
    XM = (X0 + X1) / 2
    VERM = ['#7e3e32', '#76392e', '#864436']
    TAB = mat_tabua_v(VERM, 0.2, '#3e1c16', seed=3, descasca=0.8)
    caixa((X0, X1, Y0, Y1, 0, ZE), TAB)
    caixa((X0 - 0.03, X1 + 0.03, Y0 - 0.03, Y1 + 0.03, 0, 0.3), mat_juntas(['#9b958a', '#a7a196', '#8f897e'], id_pedras_parede(0.1, 0.3, 4), '#5a544c'))
    # os cantos brancos e a faixa branca no alto da parede
    for (xa, ya) in ((X0, Y0), (X1, Y0), (X0, Y1), (X1, Y1)):
        sx = 1 if xa > W / 2 else -1
        sy = 1 if ya > D / 2 else -1
        caixa((min(xa, xa - sx * 0.14), max(xa, xa - sx * 0.14), min(ya, ya + sy * 0.03), max(ya, ya + sy * 0.03), 0.3, ZE), liso('#d2cab8'))
        caixa((min(xa, xa + sx * 0.03), max(xa, xa + sx * 0.03), min(ya, ya - sy * 0.14), max(ya, ya - sy * 0.14), 0.3, ZE), liso('#d2cab8'))
    caixa((X0 - 0.03, X1 + 0.03, Y0 - 0.03, Y1 + 0.03, ZE - 0.14, ZE), liso('#d2cab8'))
    # o telhado de mansarda (a cumeeira ao longo de y: o oitão de cinco lados na frente, com a porta do palheiro)
    KN = 1.45
    perfil = [(X0 - 0.3, ZE - 0.34), (X0 + KN, 5.15), (XM, ZR), (X1 - KN, 5.15), (X1 + 0.3, ZE - 0.34)]
    TELHA_C = ['#4e3a34', '#56403a', '#463430', '#5c463e']
    telhado(Y0, Y1, X0, X1, perfil, 'y', TELHA_C, '#241a16', TAB, testeira='#d2cab8', beiral_u=0.3, tipo='tabuinha', cumeeira='#3e2e28', seed=2,
            falta=0.04, musgo=0.55)
    # a faixa branca na base do oitão (frente e fundo)
    for (yy, s) in ((Y1, 1), (Y0, -1)):
        caixa((X0, X1, min(yy, yy + s * 0.04), max(yy, yy + s * 0.04), ZE - 0.02, ZE + 0.1), liso('#d2cab8'))
    # o portão grande (duas folhas de correr, o quadro e o X brancos) na frente e no fundo; o da frente abre (14/10):
    # as folhas correm no trilho para os lados e fica o vão escuro do celeiro, com o chão de terra e palha na boca
    for (face, yy, w, h) in (('+y', Y1, 3.0, 2.9), ('-y', Y0, 2.2, 2.5)):
        sg = 1 if face == '+y' else -1
        a0, a1 = XM - w / 2, XM + w / 2
        caixa((a0 - 0.05, a1 + 0.05, min(yy, yy + sg * 0.02), max(yy, yy + sg * 0.02), 0, h + 0.05), liso('#3a1610'))
        abre = aberto and face == '+y'
        if abre:
            caixa(_bx(face, yy, a0, a1, 0.0, 0.035, 0.0, h), liso('#0c0806'))
            caixa(_bx(face, yy, a0, a1, 0.0, 0.036, 0.0, 0.16), liso('#2a2016'))
            caixa(_bx(face, yy, a0 + 0.3, a1 - 0.5, 0.0, 0.037, 0.0, 0.07), liso('#4a3c22'))
        folhas = ((a0 - w / 2, a0), (a1, a1 + w / 2)) if abre else ((a0, XM), (XM, a1))
        for (l0, l1) in folhas:
            caixa(_bx(face, yy, l0 + 0.01, l1 - 0.01, 0.0, 0.02, 0.02, h), mat_tabua_v(['#6e3a2e', '#68362a'], 0.18, '#34160e', seed=5, descasca=0.7))
            _x_porta(face, yy, l0 + 0.01, l1 - 0.01, 0.02, h)
        # o trilho da porta de correr (aberto, comprido o bastante para as folhas)
        folga = w / 2 + 0.1 if abre else 0.5
        caixa(_bx(face, yy, a0 - folga, a1 + folga, 0.0, 0.08, h + 0.05, h + 0.15), liso('#3a3634'))
    # a porta do palheiro em cima, com o X, e a viga da roldana saindo do alto do oitão
    zp0, zp1 = ZE + 0.25, ZE + 1.1
    caixa(_bx('+y', Y1, XM - 0.55, XM + 0.55, 0.0, 0.02, zp0, zp1), mat_tabua_v(['#6e3a2e', '#68362a'], 0.18, '#34160e', seed=6, descasca=0.7))
    _x_porta('+y', Y1, XM - 0.55, XM + 0.55, zp0, zp1)
    caixa((XM - 0.08, XM + 0.08, Y1 - 0.1, Y1 + 0.75, ZR - 0.45, ZR - 0.3), {'*': mad2('#5a3a26', seed=3, passo=0.04), 'cima': liso('#7a5232')})
    o = obj()
    _tubo(o, [(XM, Y1 + 0.65, ZR - 0.45), (XM, Y1 + 0.65, ZR - 1.4)], 0.012, liso('#8a8068'))
    caixa((XM - 0.05, XM + 0.05, Y1 + 0.6, Y1 + 0.7, ZR - 1.5, ZR - 1.38), liso('#3a3634'))
    # as janelas pequenas dos lados (quadradas, o quadro branco) e o óculo do oitão de trás
    for face in ('+x', '-x'):
        for t in (0.22, 0.5, 0.78):
            q = (face, t)
            tb = q == ('+x', 0.5)
            janela(B, face, Y0 + (Y1 - Y0) * t, 1.5, 0.62, 0.62, 'breu' if tb else ('queimado' if q == ('-x', 0.22) else 'sujo'),
                   venez=None, moldura='#d2cab8', tabuas=tb, cruz=q != ('-x', 0.22))
    janela(B, '-y', XM, ZE + 0.5, 0.6, 0.6, 'sujo', venez=None, moldura='#d2cab8')
    # o feno saindo pela porta da frente (um montinho no pé) e o bebedouro do lado
    o = obj()
    rng = np.random.default_rng(3)
    for k in range(5):
        x = XM + 1.95 + k * 0.12
        caixa((x, x + 0.1, Y1 + 0.05, Y1 + 0.5, 0, 0.12 + 0.05 * rng.random()), mat_palha(k, velha=True), o=o)
    # o bebedouro seco (o fundo com o lodo e as folhas)
    caixa((X0 + 0.6, X0 + 1.7, Y1 + 0.05, Y1 + 0.45, 0, 0.4), {'*': mad2(velho('#6a4a2c'), seed=4, passo=0.05), 'cima': liso('#4e4a36')})
    _mato_paredes(B, {'+y': 4, '-y': 4, '+x': 4, '-x': 4}, seed=3, pular=(('+y', XM - 1.8, XM + 1.8), ('-y', XM - 1.4, XM + 1.4)))
    pegada(X0, X1, Y0, Y1)


# =====================================================================================================================
# a casa de mantimentos (8 x 6 casas, 4,6 m): tábuas deitadas, a porta com o toldo, telha escura
# =====================================================================================================================
def _galpao():
    c = CZ.c
    W, D = 8 * CASA, 6 * CASA
    X0, X1, Y0, Y1 = 0.25, W - 0.25, 0.25, D - 0.5
    B = (X0, X1, Y0, Y1)
    ZE = 2.9
    ZR = 7.51 * UM - 0.05
    YR = (Y0 + Y1) / 2
    BEI = 0.28
    KT = (ZR - ZE) / (YR - Y0)
    TAB = tab2([velho('#8a6a46', 0.55), velho('#82623f', 0.55), velho('#927050', 0.65), velho('#7c5c3c', 0.5)], 0.16, '#2e2620', eixo=0, seed=8, comp=1.6)
    caixa((X0, X1, Y0, Y1, 0, ZE), TAB)
    # os esteios dos cantos (mais escuros) e o rodapé de pedra
    for (xa, ya) in ((X0, Y0), (X1, Y0), (X0, Y1), (X1, Y1)):
        caixa((xa - 0.07, xa + 0.07, ya - 0.07, ya + 0.07, 0, ZE), {'*': mad2(velho('#5a3e26', 0.5), eixo=1, seed=2, passo=0.04), 'cima': liso(velho('#7a5636'))})
    caixa((X0 - 0.03, X1 + 0.03, Y0 - 0.03, Y1 + 0.03, 0, 0.26), mat_juntas(['#9b958a', '#a7a196', '#8f897e'], id_pedras_parede(0.09, 0.26, 6), '#5a544c'))
    MAD = '#5a3e26'
    MOL = velho('#6e4e30', 0.5)
    VZ = velho('#5a4a30', 0.4)
    porta(B, '+y', (X0 + X1) / 2, 0.0, 1.2, 2.15, velho('#4a3424', 0.4), folhas=2, moldura=MOL)
    for k, xx in enumerate((X0 + (X1 - X0) * 0.18, X0 + (X1 - X0) * 0.82)):
        janela(B, '+y', xx, 1.05, 0.62, 0.72, 'breu' if k == 1 else 'sujo', venez=VZ, moldura=MOL, peitoril=True, tabuas=k == 1)
    for face in ('+x', '-x'):
        janela(B, face, (Y0 + Y1) / 2, 1.05, 0.62, 0.72, 'queimado' if face == '-x' else 'sujo', venez=VZ, moldura=MOL,
               cruz=face != '-x', solta=face == '+x')
    janela(B, '-y', X0 + (X1 - X0) * 0.3, 1.05, 0.62, 0.72, 'sujo', venez=VZ, moldura=MOL)
    porta(B, '-y', X0 + (X1 - X0) * 0.72, 0.0, 0.85, 2.0, velho('#4a3424', 0.4), folhas=1, moldura=MOL)
    TEL = ['#6e3e2c', '#76442e', '#663a2a', '#7c4a34']
    zb = ZE - BEI * KT
    telhado(X0, X1, Y0, Y1, [(Y0 - BEI, zb), (YR, ZR), (Y1 + BEI, zb)], 'x', TEL, '#3a160c', TAB, testeira=MOL, cumeeira='#6a3020', seed=4,
            falta=0.04, musgo=0.6)
    # o toldo em cima da porta (uma água, nas mãos-francesas)
    xm = (X0 + X1) / 2
    _agua_uma(xm - 1.0, xm + 1.0, Y1 + 0.62, 2.32, Y1, 2.62, TEL, '#3a160c', esp=0.06, falta=0.06, musgo=0.5)
    for xx in (xm - 0.85, xm + 0.85):
        o = obj()
        _viga(o, (xx, Y1, 1.95), (xx, Y1 + 0.5, 2.36), 0.06, liso(velho('#5a3e26')))
    # o barril largado e o saco rasgado do lado da porta, e o mato em volta
    BE.barril_cesto(X1 - 0.55, Y1 + 0.28, r=0.2, h=0.62)
    _saco((X0 + 0.35, X0 + 0.85, Y1 + 0.05, Y1 + 0.4, 0.0, 0.2), velho('#c8ac7c', 0.55), 6, boca='x+')
    _mato_paredes(B, {'+y': 3, '-y': 3, '+x': 3, '-x': 3}, seed=5, pular=(('+y', xm - 1.0, xm + 1.0), ('+y', X1 - 0.9, X1)))
    pegada(X0, X1, Y0, Y1)


# =====================================================================================================================
# o orfanato queimado (16 x 46 casas, 5,4 m, só o giro 0): comprido, um andar, o telhado caído em trechos, a fuligem
# =====================================================================================================================
def mat_cinza(seed=0):
    """O chão por dentro do prédio queimado: a cinza e o carvão em manchas, os caquinhos de telha."""
    cs = np.stack([hx(x) for x in ('#3a3330', '#2c2624', '#4a423c', '#24201e')])

    def f(L, n, P):
        bx = np.floor(P[:, 0] / (3 * PH))
        by = np.floor(P[:, 1] / (3 * PH))
        q = suave(P[:, 0], P[:, 1], 0.7, seed) * 0.75 + suave(P[:, 0], P[:, 1], 0.22, seed + 1) * 0.25
        out = cs[np.digitize(q, [0.32, 0.5, 0.68])]
        r = ruido(bx, by, seed + 5)
        return np.where((r > 0.97)[:, None], hx('#6a3a2a'), out)
    return emissivo(f)


def _orfanato():
    c = CZ.c
    W, D = 16 * CASA, 46 * CASA
    X0, X1, Y0, Y1 = 0.3, W - 0.3, 0.3, D - 0.3
    B = (X0, X1, Y0, Y1)
    ZE = 3.3
    ZR = 8.82 * UM - 0.05
    XM = (X0 + X1) / 2
    ESP = 0.24
    BEI = 0.25
    # as janelas (o mesmo ritmo nos dois lados compridos) e a fuligem que subiu delas
    JY = [Y0 + 1.2 + k * 2.55 for k in range(13)]
    JX = [X0 + 1.6, XM - 2.0, XM + 2.0, X1 - 1.6]
    ZJ, HJ, WJ = 1.0, 1.35, 0.8
    fug_lat_y = [(y - WJ / 2, y + WJ / 2, ZJ + HJ, ZE) for y in JY]
    fug_lat_x = [(x - WJ / 2, x + WJ / 2, ZJ + HJ, ZE) for x in JX]
    REB_Y = mat_reboco('#958a7a', seed=3, sujeira=0.8, fuligem=fug_lat_y)      # as paredes dos lados (+x, -x)
    REB_X = mat_reboco('#958a7a', seed=4, sujeira=0.8, fuligem=fug_lat_x + [(5.25, 6.0, 2.2, ZE)])
    DENTRO = mat_reboco('#4a403a', seed=5, sujeira=1.2)
    o = obj()
    # as quatro paredes (com a espessura: por dentro aparece onde o telhado caiu)
    for (b, m, dentro) in (((X0, X1, Y0, Y0 + ESP, 0, ZE), REB_X, 'frente'), ((X0, X1, Y1 - ESP, Y1, 0, ZE), REB_X, 'costas'),
                           ((X0, X0 + ESP, Y0 + ESP, Y1 - ESP, 0, ZE), REB_Y, 'dir'), ((X1 - ESP, X1, Y0 + ESP, Y1 - ESP, 0, ZE), REB_Y, 'esq')):
        c.caixa(b, {'*': m, 'cima': liso('#3a3230'), dentro: None}, M, o)
    # por dentro, as faces das paredes no escuro (o reboco queimado)
    oi = obj()
    for (pts, n) in (([(X0 + ESP, Y0 + ESP, 0), (X1 - ESP, Y0 + ESP, 0), (X1 - ESP, Y0 + ESP, ZE), (X0 + ESP, Y0 + ESP, ZE)], (0, 1, 0)),
                     ([(X0 + ESP, Y0 + ESP, 0), (X0 + ESP, Y1 - ESP, 0), (X0 + ESP, Y1 - ESP, ZE), (X0 + ESP, Y0 + ESP, ZE)], (1, 0, 0)),
                     ([(X1 - ESP, Y1 - ESP, 0), (X0 + ESP, Y1 - ESP, 0), (X0 + ESP, Y1 - ESP, ZE), (X1 - ESP, Y1 - ESP, ZE)], (0, -1, 0)),
                     ([(X1 - ESP, Y1 - ESP, 0), (X1 - ESP, Y0 + ESP, 0), (X1 - ESP, Y0 + ESP, ZE), (X1 - ESP, Y1 - ESP, ZE)], (-1, 0, 0))):
        c.face_plana(pts, n, DENTRO, M, oi)
    # o chão de cinza
    oc = obj(contorno=False)
    c.face_plana([(X0 + ESP, Y0 + ESP, 0.02), (X1 - ESP, Y0 + ESP, 0.02), (X1 - ESP, Y1 - ESP, 0.02), (X0 + ESP, Y1 - ESP, 0.02)], (0, 0, 1), mat_cinza(3), M, oc)
    # as paredes de dentro (os quartos da ala: o corredor no meio; o salão e o refeitório depois)
    od = obj()
    PAR = {'*': DENTRO, 'cima': liso('#2e2826')}
    for xx in (XM - 2.3, XM + 2.3):
        c.caixa((xx - 0.08, xx + 0.08, Y0 + ESP, 18.0, 0, ZE - 0.3), PAR, M, od)
    for k in range(1, 6):
        yy = Y0 + ESP + k * 3.0
        c.caixa((X0 + ESP, XM - 2.3, yy - 0.07, yy + 0.07, 0, ZE - 0.3), PAR, M, od)
        c.caixa((XM + 2.3, X1 - ESP, yy - 0.07, yy + 0.07, 0, ZE - 0.3), PAR, M, od)
    for (yy, xa, xb) in ((18.0, X0 + ESP, X1 - ESP), (24.5, X0 + ESP, XM + 1.0), (24.5, XM + 2.2, X1 - ESP)):
        c.caixa((xa, xb, yy - 0.08, yy + 0.08, 0, ZE - 0.3), PAR, M, od)
    # as janelas queimadas (sem vidro, os cacos nos cantos, o batente carbonizado)
    for face in ('+x', '-x'):
        for y in JY:
            janela(B, face, y, ZJ, WJ, HJ, 'queimado', venez=None, moldura='#3a2e28', cruz=False)
    for face in ('+y', '-y'):
        for x in JX:
            if face == '-y' and abs(x - 5.6) < 1.0:
                continue
            janela(B, face, x, ZJ, WJ, HJ, 'queimado', venez=None, moldura='#3a2e28', cruz=False)
    # a porta da frente carbonizada (no fim da ala dos quartos: o lado -y daqui é o de baixo no pátio)
    porta(B, '-y', 5.625, 0.0, 1.3, 2.2, '#2a201c', folhas=2, moldura='#3a2e28', queimada=True)
    caixa((5.625 - 0.9, 5.625 + 0.9, Y0 - 0.45, Y0, 0, 0.16), mat_juntas(['#8a8478', '#7e786c'], lambda P: np.floor((P[:, 0] + 50) / 0.45).astype(np.int64), '#4a4640'))
    # o telhado: os trechos que ficaram (preto de fuligem) e os que caíram (só as vigas carbonizadas, as quebradas)
    TEL = ['#7a3a2a', '#6e3426', '#82402e', '#5e2e22']
    perfil = [(X0 - BEI, ZE - BEI * (ZR - ZE) / (XM - X0)), (XM, ZR), (X1 + BEI, ZE - BEI * (ZR - ZE) / (XM - X0))]
    ficou = [(Y0 - BEI, 4.6), (9.8, 16.2), (20.4, 27.5), (31.2, Y1 + BEI)]
    telhado(Y0, Y1, X0, X1, perfil, 'y', TEL, '#2a1410', REB_X, testeira='#3a2e28', fuligem=0.45, cumeeira='#4a2a20', seed=7, trechos=ficou)
    caiu = [(4.6, 9.8), (16.2, 20.4), (27.5, 31.2)]
    kt = (ZR - ZE) / (XM - X0)
    ov = obj()
    carv = liso('#2a201c')
    carv_c = liso('#3e322c')
    rng = np.random.default_rng(5)
    for (ya, yb) in caiu:
        # a cumeeira quebrada (um pedaço pendurado) e os caibros que sobraram, uns inteiros e outros partidos
        ym = ya + (yb - ya) * (0.35 + 0.3 * rng.random())
        _viga(ov, (XM, ya, ZR - 0.1), (XM, ym, ZR - 0.1), 0.16, carv, carv_c)
        _viga(ov, (XM, ym + 0.05, ZR - 0.18), (XM + 0.3, ym + 1.2, ZR - 1.5), 0.15, carv, carv_c)
        for y in np.arange(ya + 0.4, yb - 0.2, 0.7):
            for s in (-1, 1):
                q = rng.random()
                if q < 0.3:
                    continue
                xw = X0 + ESP / 2 if s < 0 else X1 - ESP / 2
                frac = 1.0 if q > 0.65 else 0.35 + 0.4 * rng.random()
                xe = xw + (XM - xw) * frac
                ze_ = ZE + (ZR - ZE) * frac - 0.1
                _viga(ov, (xw, y, ZE - 0.02), (xe, y, ze_), 0.12, carv, carv_c)
        # as vigas caídas no chão, atravessadas, e os montes de telha quebrada
        for k in range(3):
            x0_ = X0 + 1.0 + rng.random() * (X1 - X0 - 2)
            y0_ = ya + rng.random() * (yb - ya)
            ang = rng.random() * math.pi
            L_ = 1.4 + rng.random() * 1.6
            p0 = (x0_, y0_, 0.1)
            p1 = (min(max(x0_ + math.cos(ang) * L_, X0 + 0.4), X1 - 0.4), min(max(y0_ + math.sin(ang) * L_, ya), yb), 0.1 + 0.5 * rng.random())
            _viga(ov, p0, p1, 0.13, carv, carv_c)
        ot = obj()
        for k in range(14):
            x = X0 + 0.8 + rng.random() * (X1 - X0 - 1.6)
            y = ya + 0.3 + rng.random() * (yb - ya - 0.6)
            s = 0.12 + 0.12 * rng.random()
            caixa((x, x + s, y, y + s * 0.7, 0.02, 0.06 + 0.06 * rng.random()), {'*': liso('#5a2e22'), 'cima': liso('#7a3e2a')}, o=ot)
    pegada(X0, X1, Y0, Y1)


ITENS = {
    'arvore': (1, 1, (0.0, 0.0), lambda: _arvore('a'), {}),
    'arvore~b': (1, 1, (0.0, 0.0), lambda: _arvore('b'), {}),
    'arvore~c': (1, 1, (0.0, 0.0), lambda: _arvore('c'), {}),
    'arbusto': (1, 1, (0.0, 0.0), lambda: _arbusto(None, 0), {}),
    'arbusto~b': (1, 1, (0.0, 0.0), lambda: _arbusto(('#f6a8c4', '#e8c050'), 3), {}),
    'arbusto~c': (1, 1, (0.0, 0.0), lambda: _arbusto(('#fbf6e8', '#f2c860'), 5), {}),
    'cerca': (1, 1, (0.0, 0.0), _cerca, {}),
    'baia': (1, 1, (0.0, 0.0), _baia, {}),
    'horta': (1, 1, (0.0, 0.0), lambda: _horta('a'), {}),
    'horta~b': (1, 1, (0.0, 0.0), lambda: _horta('b'), {}),
    'milharal': (1, 1, (0.0, 0.0), _milharal, {}),
    'feno': (1, 1, (0.0, 0.0), _feno, {}),
    'sacas': (1, 1, (0.0, 0.0), _sacas, {}),
    'pilha_chao': (1, 1, (0.0, 0.0), _pilha_chao, {}),
    'placa': (1, 1, (0.0, 0.0), _placa, {}),
    'carroca': (2, 3, (0.0, 0.0), _carroca, {}),
    'fonte': (3, 3, (0.0, 0.0), _fonte, {}),
    'casarao': (14, 9, (0.0, 0.0), _casarao, {}),
    # estado 0 o portão da frente aberto (o padrão: dá para entrar), 1 fechado
    'celeiro': (12, 8, (0.0, 0.0), _celeiro, {'1': lambda: _celeiro(False)}),
    'galpao': (8, 6, (0.0, 0.0), _galpao, {}),
    'orfanato_predio': (16, 46, (0.0, 0.0), _orfanato, {}),
    'porteira': (3, 1, (0.0, 0.0), lambda: _porteira(False), {'1': lambda: _porteira(True)}),
}

# o orfanato só existe no giro 0 (rotations [0] no catálogo)
SO_GIROS = {'orfanato_predio': (0,)}
