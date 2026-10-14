"""
GRUPO H2, "parede da Sede": os itens de parede da Sede da Ordem (bar, salão, tecnologia, laboratório, enfermaria,
arsenal, prisão, corredor) em pixel art 1:1, no estilo da cozinha da fazenda (agente_cozinha/cozinha.py).

Cada item é desenhado sozinho na parede de trás (o plano y = 0, saindo para +y), com o meio em (X, 0, Z) metros
(o exportador, exportar_parede_px.py, faz a luz, o contorno e a âncora). O tamanho vem do catálogo: def.w × def.h em
px do tabuleiro (32 px = 0,75 m na horizontal, 32 px ≈ 0,61 m na vertical); a peça inteira (a frente e a grossura que
sai da parede) cabe nessa medida. O Z é o meio do item no seed (server/src/seedSede.ts): (z + h/64) / 1,633.

Como o desenho é feito:
  - a peça é uma caixa (ou disco) que sai da parede: o topo e o lado direito aparecem e dão o volume; o contorno de
    1 px vem do acabamento;
  - a FRENTE é pintada pixel a pixel numa tela (Px) no quadro da própria face: i anda para a direita (x), v desce
    (z); a linha "deitada" da tela vira a linha 2:1 da parede, sem serrilhado. O canto da frente cai no pixel inteiro
    (_snap), então a tela casa 1:1 com a imagem;
  - as cores da tela são as FINAIS (o que aparece): o material desfaz a luz que o acabamento põe na face (_cru);
  - as telas ligadas (estado 0) são claras e coloridas; o estado '1' (onde existe) é a tela escura / a luz apagada.

Decisões:
  - dartboard: o disco tem o mesmo meio e o mesmo tamanho do desenho em código do jogo (furniWall.ts: círculo de raio
    w/2 = 14 px em volta do meio do item, na tela da parede); a frente do disco é que fica no meio (a grossura vai
    para trás, para a parede).
  - neon_bar: o tubo desenha uma caneca de chope, uma garrafa e uma taça dentro de uma moldura de tubo; nada de letra.
  - nada de texto legível, logo ou símbolo: a escrita é feita de riscas de 1 px, os avisos são faixas de cor.
"""
import math

import numpy as np

import cozinha as CZ
import base_estilo as BE
from base_estilo import hx, liso, mad2, _tom, _cru, _luz_k, n_mundo, _LUZ2
from motor import emissivo, tela, KX, KY, KZ

UN = 1.633          # unidades do jogo por metro
X0 = 1.5            # o meio de todos os itens ao longo da parede (m); o exportador ancora nele


def _zm(z_un, h):
    """O meio do item (m) pela base do seed (unidades) e a altura (px)."""
    return (z_un + h / 64) / UN


# =====================================================================================================================
# a tela de pixels da frente
# =====================================================================================================================
def _c(cor):
    return hx(cor) if isinstance(cor, str) else np.asarray(cor, float)


def _mistura(a, b, t):
    return _c(a) * (1 - t) + _c(b) * t


def _desloca(m, dv, di):
    out = np.zeros_like(m)
    H, W = m.shape
    out[max(0, dv):H + min(0, dv), max(0, di):W + min(0, di)] = m[max(0, -dv):H + min(0, -dv), max(0, -di):W + min(0, -di)]
    return out


def _dilata(m, r=1, quadrado=False):
    out = m.copy()
    for dv in range(-r, r + 1):
        for di in range(-r, r + 1):
            if (dv or di) and (quadrado or abs(dv) + abs(di) <= r):
                out |= _desloca(m, dv, di)
    return out


class Px:
    """A tela de pixels da frente de uma peça: a[v, i], i para a direita, v para baixo."""

    def __init__(s, W, H, fundo='#000000'):
        s.W, s.H = int(W), int(H)
        s.a = np.zeros((s.H, s.W, 3))
        s.a[:] = _c(fundo)
        s.v, s.i = np.mgrid[0:s.H, 0:s.W]

    def m_ret(s, i0, v0, i1, v1):
        return (s.i >= i0) & (s.i < i1) & (s.v >= v0) & (s.v < v1)

    def ret(s, i0, v0, i1, v1, cor):
        s.a[s.m_ret(i0, v0, i1, v1)] = _c(cor)

    def pinta(s, m, cor):
        s.a[m] = _c(cor)

    def tom(s, m, k):
        if m.any():
            s.a[m] = _tom(s.a[m], k)

    def mistura(s, m, cor, t):
        s.a[m] = s.a[m] * (1 - t) + _c(cor) * t

    def borda(s, i0, v0, i1, v1, cor):
        s.pinta(s.m_ret(i0, v0, i1, v1) & ~s.m_ret(i0 + 1, v0 + 1, i1 - 1, v1 - 1), cor)

    def elipse(s, ci, cv, ri, rv=None):
        rv = ri if rv is None else rv
        return ((s.i + 0.5 - ci) / ri) ** 2 + ((s.v + 0.5 - cv) / rv) ** 2 <= 1.0

    def linha_m(s, pts):
        m = np.zeros((s.H, s.W), bool)
        for (i0, v0), (i1, v1) in zip(pts[:-1], pts[1:]):
            n = max(abs(i1 - i0), abs(v1 - v0), 1)
            for t in range(n + 1):
                i = int(math.floor(i0 + (i1 - i0) * t / n + 0.5))
                v = int(math.floor(v0 + (v1 - v0) * t / n + 0.5))
                if 0 <= i < s.W and 0 <= v < s.H:
                    m[v, i] = True
        return m

    def linha(s, pts, cor):
        s.pinta(s.linha_m(pts), cor)

    def contorno_de(s, m):
        """Os pixels de m que encostam (4 vizinhos) em fora de m."""
        dentro = _desloca(m, 1, 0) & _desloca(m, -1, 0) & _desloca(m, 0, 1) & _desloca(m, 0, -1)
        return m & ~dentro

    def sombra(s, m, k=0.72, dv=1, di=1, em=None):
        """A sombra de m (1 px para a direita e para baixo) no que está embaixo."""
        sh = (_desloca(m, dv, 0) | _desloca(m, dv, di) | _desloca(m, 0, di)) & ~m
        if em is not None:
            sh &= em
        s.tom(sh, k)

    def blocos(s, m, cores, seed, cel=(2, 2), pesos=None):
        """Mancha em blocos (nada de pixel solto): cada bloco cel de m ganha uma das cores."""
        bi, bv = s.i // cel[0], s.v // cel[1]
        r = np.sin(bi * 12.9898 + bv * 78.233 + seed * 37.719) * 43758.5453
        r = r - np.floor(r)
        pesos = pesos or [1.0 / len(cores)] * len(cores)
        acc = np.cumsum(pesos)
        for k, cor in enumerate(cores):
            lo = 0.0 if k == 0 else acc[k - 1]
            mm = m & (r >= lo) & (r < acc[k])
            s.pinta(mm, cor)


def mat_px(px, x0, z1, cru=True):
    """O material da frente (plano y, olhando para +y): o pixel (i, v) da tela, com a luz da face desfeita."""
    def f(L, n, P):
        i = np.clip(np.floor((P[:, 0] - x0) * KX + 1e-4).astype(int), 0, px.W - 1)
        v = np.clip(np.floor((z1 - P[:, 2]) * KZ + 1e-4).astype(int), 0, px.H - 1)
        c = px.a[v, i]
        return _cru(c, n) if cru else c
    return emissivo(f)


def mat_curva(cor, faixa=None):
    """A peça redonda: o tom pela normal da face, em degraus (a luz que o acabamento põe é desfeita)."""
    c0 = _c(cor)

    def f(L, n, P):
        nn = np.asarray(n, float) / np.linalg.norm(n)
        k = float(_luz_k(n_mundo(nn) @ _LUZ2))
        base = np.tile(c0, (len(P), 1))
        if faixa is not None:
            base = faixa(P, base)
        return _cru(_tom(base, k), nn)
    return emissivo(f)


def mat_tela(ref, fn):
    """O material pintado no pixel da TELA (para detalhe pequeno em face torta): fn(dx, dy, P) -> cores finais."""
    s0 = np.floor(tela(np.asarray(ref, float)))

    def f(L, n, P):
        S = np.floor(tela(P)) - s0
        return _cru(fn(S[:, 0].astype(int), S[:, 1].astype(int), P), n)
    return emissivo(f)


def lado(cor, topo=None):
    """O material das faces de lado e de cima de uma caixa de cor chapada."""
    c0 = _c(cor)
    ct = _c(topo) if topo else _tom(c0, 1.12)

    def f(L, n, P):
        return np.tile(ct if n[2] > 0.5 else c0, (len(P), 1))
    return emissivo(f)


# =====================================================================================================================
# as peças 3D
# =====================================================================================================================
def novo(contorno=True):
    return CZ.c.novo_obj(3, contorno=contorno)


def _snap(x0, y, z1):
    """Põe o canto de cima da esquerda da frente num pixel inteiro da tela (a tela de pixels casa 1:1)."""
    s = tela(np.array([x0, y, z1]))
    x0 += (round(s[0]) - s[0]) / KX
    s = tela(np.array([x0, y, z1]))
    z1 -= (round(s[1]) - s[1]) / KZ
    return x0, z1


def placa(X, Z, W, H, D, px, lados, cima=None, y0=0.0, centro=0.5, oid=None):
    """
    Uma caixa na parede: a frente de W x H px (pintada pela tela px) com o meio em (X, Z), saindo D px (D / KX m) de
    y0. centro: que fração da grossura fica no meio do item (1: a frente fica bem no meio; 0: o fundo). Devolve
    (x0, x1, z0, z1, y) da frente.
    """
    d = D / KX
    y = y0 + d
    sx = centro * d
    x0 = X - W / 2 / KX + sx
    z1 = Z + H / 2 / KZ + 2 * sx * KY / KZ
    x0, z1 = _snap(x0, y, z1)
    x1, z0 = x0 + W / KX, z1 - H / KZ
    o = novo() if oid is None else oid
    mats = {'frente': mat_px(px, x0, z1), '*': lados}
    if cima is not None:
        mats['cima'] = cima
    CZ.c.caixa((x0, x1, y0, y, z0, z1), mats, CZ.M, o)
    return x0, x1, z0, z1, y


def bloco(C, U, V, W, mats, oid):
    """Uma caixa torta: o meio C e os três semi-eixos U, V, W (vetores). mats: material ou dict '+u', '-v'... ou '*'."""
    C, U, V, W = (np.asarray(a, float) for a in (C, U, V, W))
    for nome, N, A, B in (('+u', U, V, W), ('-u', -U, V, W), ('+v', V, W, U), ('-v', -V, W, U), ('+w', W, U, V), ('-w', -W, U, V)):
        cc = C + N
        pts = [cc - A - B, cc + A - B, cc + A + B, cc - A + B]
        m = mats.get(nome, mats.get('*')) if isinstance(mats, dict) else mats
        if m is None:
            continue
        CZ.c.face_plana([tuple(p) for p in pts], tuple(N / np.linalg.norm(N)), m, CZ.M, oid)


def disco_y(cx, cz, rx, rz, y0, y1, frente, lado_m, oid, lados=36):
    """Um disco (ou elipse) deitado na parede: a frente no plano y1 e a borda de y0 a y1."""
    ang = [2 * math.pi * k / lados for k in range(lados)]
    CZ.c.face_plana([(cx + rx * math.cos(a), y1, cz + rz * math.sin(a)) for a in ang], (0, 1, 0), frente, CZ.M, oid)
    for a, b in zip(ang, ang[1:] + ang[:1]):
        am = (a + b) / 2
        n = np.array([math.cos(am) / rx, 0.0, math.sin(am) / rz])
        n /= np.linalg.norm(n)
        CZ.c.face_plana([(cx + rx * math.cos(a), y0, cz + rz * math.sin(a)), (cx + rx * math.cos(b), y0, cz + rz * math.sin(b)),
                         (cx + rx * math.cos(b), y1, cz + rz * math.sin(b)), (cx + rx * math.cos(a), y1, cz + rz * math.sin(a))],
                        tuple(n), lado_m, CZ.M, oid)


def caixa(b, mat, oid=None):
    o = novo() if oid is None else oid
    CZ.c.caixa(b, mat, CZ.M, o)
    return o


# =====================================================================================================================
# os papéis, as fotos e a cortiça
# =====================================================================================================================
CORK = ['#b8884f', '#ad7e48', '#c39459']
CORK_E = '#94683a'
FIO = '#c8262c'


def cortica(px, i0, v0, i1, v1, seed):
    m = px.m_ret(i0, v0, i1, v1)
    px.blocos(m, CORK, seed, (2, 2), [0.5, 0.3, 0.2])
    esc = m & _riscas_cork(px, seed)
    px.pinta(esc, CORK_E)
    # a sombra da moldura na cortiça (em cima e à esquerda)
    px.tom(m & ((px.v == v0) | (px.i == i0)), 0.8)


def _riscas_cork(px, seed):
    """As manchinhas escuras da cortiça: riscas de 2 px deitadas, espalhadas."""
    bi, bv = px.i // 3, px.v // 2
    r = np.sin(bi * 41.31 + bv * 17.17 + seed * 9.7) * 24634.6345
    r = r - np.floor(r)
    return (r < 0.09) & (px.i % 3 != 2) & (px.v % 2 == 0)


def moldura(px, larg, cor, claro=None, escuro=None):
    """A moldura de larg px em volta: o anel de fora na cor, o do meio claro em cima e à esquerda, o de dentro escuro."""
    W, H = px.W, px.H
    fora = ~px.m_ret(larg, larg, W - larg, H - larg)
    px.pinta(fora, cor)
    claro = claro or _tom(_c(cor), 1.25)
    escuro = escuro or _tom(_c(cor), 0.7)
    if larg >= 2:
        anel = px.m_ret(1, 1, W - 1, H - 1) & ~px.m_ret(2, 2, W - 2, H - 2)
        px.pinta(anel & ((px.v == 1) | (px.i == 1)), claro)
    dentro = px.m_ret(larg - 1, larg - 1, W - larg + 1, H - larg + 1) & ~px.m_ret(larg, larg, W - larg, H - larg)
    px.pinta(dentro & ((px.v == H - larg) | (px.i == W - larg)), _tom(_c(cor), 1.1))
    px.pinta(dentro & ((px.v == larg - 1) | (px.i == larg - 1)), escuro)


def papel(px, i0, v0, W, H, cor='#ece5d2', tinta='#6e6a64', seed=0, titulo=None, linhas=True, sombra=True, passo=3, rasgado=False,
          margem=None):
    m = px.m_ret(i0, v0, i0 + W, v0 + H)
    if rasgado:
        r = np.sin((px.i - i0) * 7.13 + seed) * 999.1
        m &= ~((px.v == v0) & ((r - np.floor(r)) < 0.5))
    if sombra:
        px.sombra(m, 0.7)
    px.pinta(m, cor)
    px.tom(m & ((px.i == i0 + W - 1) | (px.v == v0 + H - 1)), 0.88)
    rng = np.random.default_rng(seed)
    v = v0 + 2
    if titulo:
        tw = max(3, int(W * rng.uniform(0.45, 0.7)))
        px.ret(i0 + 2, v, i0 + 2 + tw, v + 2, titulo)
        v += 4
    if margem:
        px.ret(i0 + 3, v0 + 1, i0 + 4, v0 + H - 1, margem)
    if linhas:
        ii = i0 + (5 if margem else 2)
        while v < v0 + H - 2:
            L = int(rng.integers(max(2, (W - 4) // 2), max(3, i0 + W - 2 - ii) + 1))
            corte = int(rng.integers(3, max(4, L - 2))) if L > 8 and rng.random() < 0.6 else None
            for (a, b) in ([(ii, ii + corte), (ii + corte + 1, ii + L)] if corte else [(ii, ii + L)]):
                if b - a >= 2:
                    px.ret(a, v, min(b, i0 + W - 2), v + 1, tinta)
            v += passo
    return m


def foto(px, i0, v0, W, H, tema, seed=0, borda='#efeadc', polaroid=False, sombra=True):
    """Uma foto (com a borda branca; polaroid = a borda de baixo mais larga) com o tema pintado dentro."""
    m = px.m_ret(i0, v0, i0 + W, v0 + H)
    if sombra:
        px.sombra(m, 0.7)
    px.pinta(m, borda)
    px.tom(m & ((px.i == i0 + W - 1) | (px.v == v0 + H - 1)), 0.88)
    b = 1
    a0, b0, a1, b1 = i0 + b, v0 + b, i0 + W - b, v0 + H - (3 if polaroid else b)
    imagem(px, a0, b0, a1, b1, tema, seed)
    return m


def imagem(px, a0, b0, a1, b1, tema, seed=0):
    """O que a foto mostra, no retângulo [a0, a1) x [b0, b1)."""
    w, h = a1 - a0, b1 - b0
    R = px.m_ret(a0, b0, a1, b1)
    ci = (a0 + a1) / 2
    if tema in ('rosto', 'rosto2', 'rosto3'):
        fundo, pele = {'rosto': ('#7d8794', '#3a3436'), 'rosto2': ('#a68d6a', '#4a3828'), 'rosto3': ('#8f9c86', '#2e3430')}[tema]
        px.pinta(R, fundo)
        px.pinta(R & (px.v < b0 + 2), _tom(_c(fundo), 1.12))
        cab = px.elipse(ci, b0 + h * 0.4, max(2.0, w * 0.2), max(2.4, h * 0.24)) & R
        omb = px.elipse(ci, b1 + h * 0.12, w * 0.42, h * 0.4) & R
        px.pinta(cab | omb, pele)
        px.pinta(cab & (px.v < b0 + h * 0.4 - h * 0.12) & (px.i < ci), _tom(_c(pele), 1.35))
    elif tema == 'casa':
        px.pinta(R, '#9db9cf')
        px.pinta(R & (px.v >= b0 + h * 0.62), '#6c7e48')
        cx0, cx1 = int(a0 + w * 0.25), int(a0 + w * 0.7)
        px.pinta(px.m_ret(cx0, int(b0 + h * 0.38), cx1, int(b0 + h * 0.8)) & R, '#d8cbb0')
        telh = (px.v >= b0 + h * 0.18) & (px.v < b0 + h * 0.38) & (np.abs(px.i + 0.5 - (cx0 + cx1) / 2) <= (px.v - (b0 + h * 0.18)) * 1.6 + 1)
        px.pinta(telh & R, '#8a3a2a')
        px.pinta(px.m_ret(int((cx0 + cx1) / 2) - 1, int(b0 + h * 0.58), int((cx0 + cx1) / 2) + 1, int(b0 + h * 0.8)) & R, '#4a3022')
    elif tema == 'mar':
        px.pinta(R, '#8cc8ec')
        px.pinta(R & (px.v < b0 + 2), '#b8e0f6')
        px.pinta(R & (px.v >= b0 + h * 0.45), '#2f7fb8')
        px.pinta(R & (px.v >= b0 + h * 0.45) & (px.v < b0 + h * 0.45 + 1), '#7ab8e0')
        px.pinta(R & (px.v >= b0 + h * 0.78), '#e8d49a')
    elif tema == 'mata':
        px.pinta(R, '#c4ccc4')
        px.pinta(R & (px.v >= b1 - 2), '#4a5a30')
        for k, c in enumerate(np.linspace(a0 + 1, a1 - 2, 3)):
            alto = h * (0.75 - 0.15 * (k % 2))
            tri = (px.v >= b1 - alto) & (np.abs(px.i + 0.5 - c) <= (px.v - (b1 - alto)) * 0.5 + 0.5)
            px.pinta(tri & R, '#2e4a2a' if k % 2 else '#3a5a30')
    elif tema == 'noite':
        px.pinta(R, '#1e2440')
        px.pinta(R & (px.v >= b0 + h * 0.4), '#2c2c3a')
        for k in range(3):
            ii = int(a0 + 1 + k * (w - 2) / 3)
            px.pinta(px.m_ret(ii, int(b0 + h * 0.55), ii + 2, int(b0 + h * 0.55) + 2) & R, '#f4d060')
        px.pinta(px.elipse(a1 - 2.5, b0 + 2.5, 1.5) & R, '#e8e4d0')
    elif tema == 'por':
        bandas = ['#f6c45a', '#f09848', '#e0684a', '#a8486a']
        for k, c in enumerate(bandas):
            px.pinta(R & (px.v >= b0 + k * h / 5), c)
        px.pinta(px.elipse(ci, b0 + h * 0.62, w * 0.22, h * 0.2) & R & (px.v < b0 + h * 0.7), '#fff0b0')
        px.pinta(R & (px.v >= b0 + h * 0.7), '#4a2a48')
    elif tema == 'carro':
        px.pinta(R, '#8e9498')
        px.pinta(R & (px.v >= b0 + h * 0.7), '#5c6064')
        corpo = px.m_ret(int(a0 + w * 0.12), int(b0 + h * 0.42), int(a1 - w * 0.08), int(b0 + h * 0.75)) & R
        teto = px.m_ret(int(a0 + w * 0.3), int(b0 + h * 0.22), int(a1 - w * 0.25), int(b0 + h * 0.45)) & R
        px.pinta(corpo | teto, '#7a2a24')
        px.pinta(teto & ~px.contorno_de(teto) | (teto & (px.v > b0 + h * 0.3) & (px.i > a0 + w * 0.34) & (px.i < a1 - w * 0.3)), '#a8c4d4')
        for c in (a0 + w * 0.3, a1 - w * 0.25):
            px.pinta(px.elipse(c, b0 + h * 0.76, 1.6) & R, '#1e1e20')
    elif tema == 'mapa':
        px.pinta(R, '#d8d0a6')
        verde = R & (np.sin((px.i - a0) * 0.45 + seed) + np.cos((px.v - b0) * 0.6 + seed * 0.3) > 0.7)
        px.pinta(verde, '#aab87a')
        rio = [(a0, b0 + h * 0.7), (a0 + w * 0.3, b0 + h * 0.55), (a0 + w * 0.55, b0 + h * 0.62), (a1, b0 + h * 0.3)]
        px.pinta(_dilata(px.linha_m([(int(a), int(b)) for a, b in rio]), 0) & R, '#4a7eb0')
        estr = [(a0 + w * 0.2, b0), (a0 + w * 0.35, b1)]
        px.pinta(px.linha_m([(int(a), int(b)) for a, b in estr]) & R, '#a89878')
        estr2 = [(a0, b0 + h * 0.3), (a1, b0 + h * 0.4)]
        px.pinta(px.linha_m([(int(a), int(b)) for a, b in estr2]) & R, '#a89878')
    else:
        px.pinta(R, '#7a7a7a')


def nota(px, i0, v0, W, H, cor, seed=0, linhas='#8a7a3a'):
    """O bilhete colado (post-it): a cor, a ponta de baixo da direita levantada e 2 ou 3 riscas."""
    m = px.m_ret(i0, v0, i0 + W, v0 + H)
    px.sombra(m, 0.7)
    px.pinta(m, cor)
    px.pinta(m & (px.v == v0), _tom(_c(cor), 0.88))
    rng = np.random.default_rng(seed)
    for v in range(v0 + 2, v0 + H - 2, 3):
        L = int(rng.integers(max(2, W - 6), W - 2))
        px.ret(i0 + 1, v, i0 + 1 + L, v + 1, linhas)
    return m


def alfinete(px, i, v, cor='#d23a2e'):
    m = px.m_ret(i, v, i + 2, v + 2)
    px.sombra(m, 0.6)
    px.pinta(m, cor)
    px.pinta(px.m_ret(i, v, i + 1, v + 1), _tom(_c(cor), 1.45))
    px.pinta(px.m_ret(i + 1, v + 1, i + 2, v + 2), _tom(_c(cor), 0.72))


def fita(px, i, v, w=4, h=2, cor='#e4dcb8'):
    m = px.m_ret(i, v, i + w, v + h)
    px.mistura(m, cor, 0.75)
    px.tom(m & (px.v == v + h - 1), 0.92)


# =====================================================================================================================
# 1. ar-condicionado (38 x 17)
# =====================================================================================================================
def ac_wall():
    X, Z = X0, _zm(3.9, 17)
    W, H, D = 31, 13, 7
    px = Px(W, H, '#e8e6de')
    px.pinta(px.v == 0, '#f2f0ea')
    px.pinta(px.v == 4, '#d6d3c8')                     # a emenda da tampa
    px.pinta((px.v >= 5) & (px.v < H - 4), '#e2dfd6')
    px.ret(W - 7, 2, W - 3, 3, '#3a4044')               # o visor
    px.ret(W - 6, 2, W - 5, 3, '#5ce08a')               # o led verde (no visor)
    px.ret(W - 4, 2, W - 3, 3, '#2a3034')
    # a saída de ar: a boca escura e a aleta clara no meio
    px.pinta((px.v >= H - 4) & (px.v < H - 1) & (px.i >= 1) & (px.i < W - 1), '#3a3c42')
    px.pinta((px.v == H - 3) & (px.i >= 2) & (px.i < W - 2), '#b8b6ae')
    px.pinta((px.v == H - 1), '#cfccc2')
    px.pinta((px.v == H - 5), '#d4d1c6')
    # as riscas da grade de cima (vistas na face de cima, como riscas de 2 px deitadas)

    def topo(L, n, P):
        g = np.floor((P[:, 0] - X) * KX / 2) % 2 == 0
        return np.where(g[:, None], hx('#f0eee6'), hx('#d8d5ca'))
    placa(X, Z, W, H, D, px, lado('#d8d5cc', '#eceae2'), cima=emissivo(topo))


# =====================================================================================================================
# 2. o quadro de detetive (152 x 82) e 3. o quadro de cortiça (76 x 50)
# =====================================================================================================================
def _quadro(W, H, cor_mold, larg, seed):
    px = Px(W, H, cor_mold)
    cortica(px, larg, larg, W - larg, H - larg, seed)
    moldura(px, larg, cor_mold)
    return px


def board_detective():
    X, Z = X0, _zm(1.95, 82)
    W, H, D = 149, 80, 3
    px = _quadro(W, H, '#6a3e24', 3, 11)
    pinos = {}
    # (nome, tipo, i, v, w, h, extra)
    itens = [
        ('f1', 'foto', 8, 7, 13, 16, ('rosto', True)),
        ('p1', 'papel', 25, 6, 17, 23, ('#3a3a40',)),
        ('mapa', 'mapa', 47, 8, 34, 25, None),
        ('f2', 'foto', 86, 6, 13, 16, ('rosto2', True)),
        ('j1', 'jornal', 104, 8, 22, 27, None),
        ('n1', 'nota', 131, 9, 10, 10, ('#f2d94e',)),
        ('f3', 'foto', 9, 32, 17, 13, ('casa', False)),
        ('p2', 'papel', 31, 36, 15, 21, (None,)),
        ('f4', 'foto', 51, 41, 15, 12, ('noite', False)),
        ('ficha', 'ficha', 70, 38, 21, 27, None),
        ('f5', 'foto', 97, 42, 13, 16, ('rosto3', True)),
        ('n2', 'nota', 115, 45, 9, 9, ('#f28ab0',)),
        ('p3', 'papel', 127, 39, 16, 23, ('#8a2a2a',)),
        ('f6', 'foto', 12, 56, 17, 13, ('carro', False)),
        ('p4', 'papel', 37, 62, 15, 11, (None,)),
        ('j2', 'jornal', 99, 63, 20, 12, None),
        ('n3', 'nota', 58, 63, 9, 9, ('#f2d94e',)),
        ('n4', 'nota', 126, 66, 9, 8, ('#9ad0f0',)),
    ]
    for k, (nome, tipo, i, v, w, h, ex) in enumerate(itens):
        if tipo == 'foto':
            foto(px, i, v, w, h, ex[0], seed=k, polaroid=ex[1])
        elif tipo == 'papel':
            papel(px, i, v, w, h, seed=k + 3, titulo=ex[0])
        elif tipo == 'nota':
            nota(px, i, v, w, h, ex[0], seed=k)
        elif tipo == 'mapa':
            m = px.m_ret(i, v, i + w, v + h)
            px.sombra(m, 0.7)
            imagem(px, i, v, i + w, v + h, 'mapa', seed=4)
            px.tom(m & ((px.i == i + w - 1) | (px.v == v + h - 1)), 0.86)
            # o círculo vermelho de caneta e o X
            anel = px.elipse(i + 22, v + 10, 4.2, 3.4) & ~px.elipse(i + 22, v + 10, 3.0, 2.3)
            px.pinta(anel, '#c8262c')
            px.linha([(i + 8, v + 15), (i + 11, v + 18)], '#c8262c')
            px.linha([(i + 11, v + 15), (i + 8, v + 18)], '#c8262c')
        elif tipo == 'jornal':
            m = papel(px, i, v, w, h, cor='#d9d6cb', tinta='#7a7872', seed=k + 7, titulo='#2e2e32', passo=3)
            fh = min(8, h - 7)
            px.ret(i + 2, v + 6, i + 9, v + 6 + fh, '#8a8a88')
            px.ret(i + 3, v + 7, i + 8, v + 5 + fh, '#6a6a6c')
            px.ret(i + 4, v + 8, i + 7, v + 4 + fh, '#4c4a4e')
        elif tipo == 'ficha':
            papel(px, i, v, w, h, cor='#e8dfc4', seed=21, titulo=None)
            px.ret(i + 2, v + 2, i + 9, v + 10, '#efeadc')
            imagem(px, i + 3, v + 3, i + 8, v + 9, 'rosto', seed=2)
            px.ret(i + 11, v + 3, i + w - 2, v + 4, '#3a3a40')
            px.ret(i + 11, v + 6, i + w - 4, v + 7, '#6e6a64')
            px.ret(i + 11, v + 8, i + w - 3, v + 9, '#6e6a64')
            # o carimbo vermelho (um retângulo vazado, sem letra)
            px.borda(i + 4, v + h - 8, i + 14, v + h - 4, '#b8323a')
        pinos[nome] = (i + w // 2 - 1, v + 1 if tipo != 'nota' else v)
    # os fios vermelhos ligando ao meio (a ficha) e entre as pistas
    ligacoes = [('ficha', 'f1'), ('ficha', 'mapa'), ('ficha', 'f2'), ('ficha', 'j1'), ('ficha', 'f5'), ('ficha', 'f6'),
                ('mapa', 'f4'), ('j1', 'p3'), ('f1', 'p1'), ('f3', 'f6')]
    for a, b in ligacoes:
        (ia, va), (ib, vb) = pinos[a], pinos[b]
        px.linha([(ia + 1, va + 1), (ib + 1, vb + 1)], FIO)
    cores = ['#d23a2e', '#d23a2e', '#3a6ad2', '#e8c040', '#d23a2e', '#2a9a5a']
    for k, (nome, (i, v)) in enumerate(pinos.items()):
        if nome.startswith('n'):
            continue
        alfinete(px, i, v, cores[k % len(cores)])
    placa(X, Z, W, H, D, px, mad2('#6a3e24', eixo=0, seed=3), cima=liso('#8a5432'))


def board_investigation():
    X, Z = X0, _zm(2.36, 50)
    W, H, D = 73, 48, 3
    px = _quadro(W, H, '#8a5a34', 3, 23)
    pinos = {}
    foto(px, 7, 6, 12, 15, 'rosto', seed=1, polaroid=True)
    pinos['a'] = (12, 7)
    papel(px, 23, 5, 15, 20, seed=5, titulo='#3a3a40')
    pinos['b'] = (29, 6)
    m = px.m_ret(42, 7, 66, 25)
    px.sombra(m, 0.7)
    imagem(px, 42, 7, 66, 25, 'mapa', seed=8)
    px.tom(m & ((px.i == 65) | (px.v == 24)), 0.86)
    anel = px.elipse(56, 15, 3.4, 2.8) & ~px.elipse(56, 15, 2.2, 1.7)
    px.pinta(anel, '#c8262c')
    pinos['c'] = (53, 8)
    foto(px, 8, 27, 15, 12, 'casa', seed=3)
    pinos['d'] = (14, 28)
    nota(px, 27, 30, 9, 9, '#f2d94e', seed=2)
    papel(px, 42, 28, 18, 14, seed=9, titulo=None)
    pinos['e'] = (50, 29)
    for a, b in (('a', 'b'), ('b', 'c'), ('a', 'd'), ('c', 'e')):
        (ia, va), (ib, vb) = pinos[a], pinos[b]
        px.linha([(ia + 1, va + 1), (ib + 1, vb + 1)], FIO)
    for k, (i, v) in enumerate(pinos.values()):
        alfinete(px, i, v, ['#d23a2e', '#3a6ad2', '#d23a2e', '#e8c040', '#2a9a5a'][k])
    placa(X, Z, W, H, D, px, mad2('#8a5a34', eixo=0, seed=4), cima=liso('#a87046'))


# =====================================================================================================================
# 4. câmera de segurança (20 x 24)
# =====================================================================================================================
def cctv():
    X, Z = X0, _zm(3.63, 24)
    CINZA = '#d6d6ce'
    # a base na parede e o braço
    o = novo()
    caixa((X - 0.045, X + 0.045, 0.0, 0.02, Z + 0.06, Z + 0.17), lado('#b8b8b0', '#cfcfc8'), o)
    caixa((X - 0.015, X + 0.015, 0.02, 0.11, Z + 0.1, Z + 0.13), lado('#9a9a94', '#b4b4ac'), o)
    caixa((X - 0.015, X + 0.015, 0.08, 0.11, Z + 0.04, Z + 0.13), lado('#9a9a94', '#b4b4ac'), o)
    # o corpo: comprido, apontando para a sala (+y), um pouco para baixo e para a direita
    f = np.array([0.32, 0.9, -0.3])
    f /= np.linalg.norm(f)
    u = np.cross(f, [0, 0, 1.0])
    u /= np.linalg.norm(u)
    w = np.cross(u, f)
    C = np.array([X + 0.02, 0.2, Z])
    oc = novo()
    frente_c = C + f * 0.13

    def lente(dx, dy, P):
        out = np.tile(hx('#2a2c30'), (len(P), 1))
        d = np.hypot(dx + 0.5 - 0.5, (dy + 0.5) * 1.0)
        out = np.where((np.hypot(dx - 0.0, dy - 0.0) <= 2.3)[:, None], hx('#16181c'), out)
        out = np.where(((dx >= -1) & (dx <= 0) & (dy == -1))[:, None], hx('#6a8ac8'), out)
        out = np.where(((dx >= 2) & (dx <= 3) & (dy == 2))[:, None], hx('#ff3a30'), out)
        return out
    bloco(C, f * 0.13, u * 0.05, w * 0.048, {'+u': mat_tela(frente_c, lente), '*': lado(CINZA, '#ecece6')}, oc)
    # a viseira em cima
    bloco(C + w * 0.058 + f * 0.03, f * 0.14, u * 0.06, w * 0.008, lado('#c4c4bc', '#e8e8e2'), novo())


# =====================================================================================================================
# 5. alvo de dardos (28 x 28): o disco no mesmo lugar e do mesmo tamanho do desenho do jogo
# =====================================================================================================================
def dartboard():
    X, Z = X0, _zm(2.8, 28)
    R = 14
    D = 2
    px = Px(2 * R, 2 * R, '#1e1a16')
    c = R
    di, dv = px.i + 0.5 - c, px.v + 0.5 - c
    rr = np.hypot(di, dv)
    ang = (np.degrees(np.arctan2(dv, di)) + 360 + 360 / 24) % 360
    setor = (ang // (360 / 12)).astype(int)
    par = setor % 2 == 0
    px.pinta(rr < R, '#26201a')                                 # o aro preto (onde iam os números)
    px.pinta((rr >= R - 1.6) & (rr < R), '#3a3430')
    jogo = rr < R - 2.6
    px.pinta(jogo & par, '#e2d8bc')
    px.pinta(jogo & ~par, '#1e1a16')
    dupla = (rr >= R - 4.2) & (rr < R - 2.6)
    tripla = (rr >= 5.4) & (rr < 7.0)
    px.pinta((dupla | tripla) & par, '#c42a24')
    px.pinta((dupla | tripla) & ~par, '#2f8a40')
    px.pinta(rr < 3.2, '#2f8a40')
    px.pinta(rr < 1.6, '#c42a24')
    px.pinta(px.m_ret(c - 1, c - 1, c + 1, c + 1), '#c42a24')
    # os dois dardos cravados (o cabo e as penas), como no desenho do jogo
    for (x, y) in ((c + 4, c - 3), (c - 5, c + 2)):
        px.linha([(x, y), (x + 2, y - 3)], '#d8d4cc')
        px.ret(x + 2, y - 5, x + 4, y - 3, '#d23a2e')
        px.pinta(px.m_ret(x + 2, y - 5, x + 3, y - 4), '#f07068')
        px.pinta(px.m_ret(x, y, x + 1, y + 1), '#5a5a5e')
    # a frente fica no meio do item (a grossura vai para a parede): o mesmo lugar do desenho do jogo
    d = D / KX
    cx, cz = X + d, Z + 2 * d * KY / KZ
    x0, z1 = _snap(cx - R / KX, d, cz + R / KZ)
    cx, cz = x0 + R / KX, z1 - R / KZ
    o = novo()
    disco_y(cx, cz, R / KX, R / KZ, 0.0, d, mat_px(px, x0, z1), mat_curva('#2a2420'), o, lados=40)


# =====================================================================================================================
# 6. luz de emergência (22 x 16), acesa (0) e apagada (1)
# =====================================================================================================================
def _emergencia(acesa):
    X, Z = X0, _zm(3.27, 16)
    W, H, D = 18, 7, 4
    px = Px(W, H, '#e6e2d6')
    px.pinta(px.v == 0, '#f0ede4')
    px.pinta(px.v == H - 1, '#cfcabc')
    px.ret(2, 2, W - 2, 4, '#d8d3c6')                       # a grade do alto-falante/bateria
    px.pinta((px.v == 3) & (px.i >= 2) & (px.i < W - 2) & (px.i % 2 == 0), '#bdb8aa')
    px.ret(W - 5, 2, W - 3, 3, '#4ade70' if acesa else '#4a6a50')   # o led de carga
    px.ret(3, 5, 5, 6, '#c43a2e')                           # o botão de teste
    x0, x1, z0, z1, y = placa(X, Z - 0.05, W, H, D, px, lado('#d6d1c4', '#efebe2'))
    # os dois faróis em cima, virados um pouco para fora
    for s in (-1, 1):
        cx = X + s * 0.12 + 0.03
        hp = Px(6, 6, '#f4e8b0' if acesa else '#d8d3c6')
        hp.pinta(hp.contorno_de(hp.m_ret(0, 0, 6, 6)), '#c4beb0')
        lamp = hp.elipse(3, 3, 2.4)
        hp.pinta(lamp, '#fff6c8' if acesa else '#8e9090')
        hp.pinta(hp.m_ret(1, 1, 5, 5), '#ffd84a' if acesa else '#7a7e80')
        hp.pinta(hp.m_ret(2, 2, 4, 4), '#fffbe6' if acesa else '#9a9ea0')
        hp.pinta(hp.m_ret(2, 1, 4, 2) | hp.m_ret(1, 2, 2, 4), '#fff2b0' if acesa else '#8a8e90')
        placa(cx, z1 + 3.5 / KZ, 6, 6, 2, hp, lado('#cfcabc', '#ebe7de'), y0=0.012)
        caixa((cx - 0.012, cx + 0.012, 0.03, 0.06, z1 - 0.005, z1 + 0.02), lado('#a8a498', '#c8c4b8'))


def emergency_light():
    _emergencia(True)


def emergency_light_off():
    _emergencia(False)


# =====================================================================================================================
# 7. extintor (12 x 30)
# =====================================================================================================================
def extinguisher():
    X, Z = X0, _zm(1.63, 30)
    r = 0.064
    cx, cy = X - 0.02, r + 0.02
    z0, z1 = Z - 0.27, Z + 0.12
    th0 = math.atan2(1, 1)

    def rotulo(P, base):
        th = np.arctan2(P[:, 1] - cy, P[:, 0] - cx)
        frente = np.cos(th - th0) > 0.25
        zz = P[:, 2]
        lab = frente & (zz > Z - 0.16) & (zz < Z + 0.0)
        base = np.where(lab[:, None], hx('#ece4cc'), base)
        base = np.where((lab & (np.abs(zz - (Z - 0.08)) < 0.6 / KZ))[:, None], hx('#9a8a72'), base)
        base = np.where((lab & (np.abs(zz - (Z - 0.12)) < 0.6 / KZ) & (np.cos(th - th0) > 0.6))[:, None], hx('#9a8a72'), base)
        return base
    o = novo()
    CZ.c.cilindro(cx, cy, r, z0, z1, BE.vol(cx, cy, '#c42e26', brilho=0.35, faixas=rotulo), CZ.M, o, lados=24, tampa=False)
    # o ombro (a cúpula) e o gargalo
    perfil = [(z1, r), (z1 + 0.025, r * 0.85), (z1 + 0.045, r * 0.55), (z1 + 0.055, r * 0.3)]
    BE._poligono_rodado(cx, cy, perfil, BE.vol(cx, cy, '#c42e26', brilho=0.35), o, lados=24, tampa_mat=liso('#a82822'))
    # o fundo (o pé preto)
    CZ.c.cilindro(cx, cy, r * 1.02, z0 - 0.02, z0, BE.vol(cx, cy, '#2a2626'), CZ.M, o, lados=24, tampa=False)
    # a válvula, a alavanca e o manômetro
    ov = novo()
    CZ.c.cilindro(cx, cy, 0.018, z1 + 0.05, z1 + 0.085, BE.vol(cx, cy, '#3a3a3c', brilho=0.3), CZ.M, ov, lados=10, tampa_mat=liso('#4a4a4c'))
    caixa((cx - 0.025, cx + 0.06, cy - 0.012, cy + 0.012, z1 + 0.085, z1 + 0.1), lado('#2a2a2c', '#4a4a4e'), ov)
    caixa((cx - 0.02, cx + 0.07, cy - 0.01, cy + 0.01, z1 + 0.11, z1 + 0.125), lado('#2a2a2c', '#4a4a4e'), ov)
    caixa((cx - 0.06, cx - 0.018, cy - 0.006, cy + 0.006, z1 + 0.055, z1 + 0.07), lado('#2a2a2c', '#3a3a3c'), ov)
    # a mangueira: sai da válvula, desce pela frente-esquerda e vai até o pé
    om = novo()
    pts = [(cx - 0.06, cy + 0.0, z1 + 0.06), (cx - 0.075, cy + 0.03, z1 + 0.0), (cx - 0.07, cy + 0.05, z0 + 0.12), (cx - 0.05, cy + 0.06, z0 + 0.03)]
    for a, b in zip(pts[:-1], pts[1:]):
        a, b = np.array(a), np.array(b)
        C = (a + b) / 2
        F = (b - a) / 2
        u = np.cross(F, [0, 0, 1.0]) if abs(F[2]) < 0.9 * np.linalg.norm(F) else np.array([1.0, 0, 0])
        u = u / np.linalg.norm(u) * 0.011
        w = np.cross(F, u)
        w = w / np.linalg.norm(w) * 0.011
        bloco(C, F * 1.08, u, w, lado('#1e1e20', '#3a3a3e'), om)
    caixa((cx - 0.065, cx - 0.035, cy + 0.045, cy + 0.075, z0 - 0.0, z0 + 0.04), lado('#2a2a2c', '#4a4a4e'), om)
    # a presilha da parede (a cinta em volta do corpo)
    CZ.c.cilindro(cx, cy, r * 1.04, Z + 0.02, Z + 0.035, BE.vol(cx, cy, '#3a3a3e'), CZ.M, novo(), lados=24, tampa=False)


# =====================================================================================================================
# 8. ventilador de parede (24 x 30)
# =====================================================================================================================
def fan_wall():
    X, Z = X0, _zm(3.54, 30)
    VERDE = '#6a9c8a'
    zc = Z - 0.04
    R = 0.19
    # o suporte na parede e o braço até o motor
    o = novo()
    caixa((X - 0.04, X + 0.04, 0.0, 0.02, zc + 0.16, zc + 0.27), lado('#3e4448', '#5a6064'), o)
    caixa((X - 0.016, X + 0.016, 0.02, 0.1, zc + 0.2, zc + 0.23), lado('#4a5054', '#6a7074'), o)
    caixa((X - 0.016, X + 0.016, 0.08, 0.11, zc + 0.05, zc + 0.23), lado('#4a5054', '#6a7074'), o)
    # o motor (o tambor deitado) atrás da grade
    om = novo()
    disco_y(X, zc, 0.07, 0.07, 0.09, 0.2, liso('#5a8a7a'), mat_curva(VERDE), om, lados=20)
    # a grade com as pás (opaca: o fundo escuro do motor entre as pás)
    rx, rz = R, R
    W, H = int(round(2 * rx * KX)), int(round(2 * rz * KZ))
    px = Px(W, H, '#2e3a38')
    ci, cv = W / 2, H / 2
    di, dv = (px.i + 0.5 - ci) / (W / 2), (px.v + 0.5 - cv) / (H / 2)
    rr = np.hypot(di, dv)
    ang = np.arctan2(dv, di)
    px.pinta(rr < 0.86, '#3e4e4a')
    for k in range(3):
        a0 = k * 2 * math.pi / 3 + 0.3
        dd = np.angle(np.exp(1j * (ang - a0)))
        pa = (np.abs(dd) < 0.62 * np.clip(rr * 1.5, 0.45, 1.0)) & (rr > 0.18) & (rr < 0.82)
        px.pinta(pa, '#a4d0c0')
        px.pinta(pa & px.contorno_de(pa) & (dd > 0), '#78a494')
    px.pinta(rr < 0.24, VERDE)
    px.pinta((rr < 0.24) & (di + dv < -0.12), '#8ab8a8')
    px.pinta((rr >= 0.52) & (rr < 0.6), '#b8bcbe')                 # o anel do meio da grade
    px.pinta(rr >= 0.86, '#c8ccce')                                   # o aro
    px.pinta((rr >= 0.86) & (di + dv > 0.4), '#9a9ea2')
    d1 = 0.25
    x0, z1 = _snap(X - rx, d1, zc + rz)
    cx, cz = x0 + rx, z1 - rz
    og = novo()
    disco_y(cx, cz, rx, rz, 0.19, d1, mat_px(px, x0, z1), mat_curva('#aeb2b4'), og, lados=36)


# =====================================================================================================================
# 9. painel de monitoramento (61 x 52): quatro monitores, ligados (0) e desligados (1)
# =====================================================================================================================
def _feed(px, a0, b0, a1, b1, qual, ligado):
    R = px.m_ret(a0, b0, a1, b1)
    w, h = a1 - a0, b1 - b0
    if not ligado:
        px.pinta(R, '#1c2426')
        diag = R & (((px.i - a0) + (px.v - b0) * 2) % 40 >= 22) & (((px.i - a0) + (px.v - b0) * 2) % 40 < 26)
        px.pinta(diag, '#2c383a')
        px.pinta(R & (px.v == b0), '#141a1c')
        return
    rampa = {'a': ['#2a6e58', '#4aa884', '#7ad8b0', '#c4f4dc'], 'b': ['#2a4a7a', '#4a78b8', '#7ab0ec', '#c8e0fc'],
             'c': ['#7a5a2a', '#b88a40', '#e8b860', '#fce4a8'], 'd': ['#4a6e2a', '#78a840', '#a8d868', '#e0f8b8']}[qual]
    c0, c1, c2, c3 = rampa
    px.pinta(R, c1)
    I, V = px.i - a0, px.v - b0
    if qual == 'a':      # o corredor em perspectiva
        px.pinta(R & (V >= h * 0.55), c2)
        chao = R & (V >= h * 0.55) & (np.abs(I + 0.5 - w / 2) <= (V - h * 0.55) * 1.3 + 2)
        px.pinta(chao, c3)
        px.pinta(R & (V < 3), c0)
        px.pinta(px.m_ret(a0 + w // 2 - 2, b0 + 5, a0 + w // 2 + 2, b0 + 11), c0)
        px.pinta(px.m_ret(a0 + 3, b0 + 4, a0 + 6, b0 + 5) | px.m_ret(a1 - 6, b0 + 4, a1 - 3, b0 + 5), c3)
    elif qual == 'b':    # a cela com as grades
        px.pinta(px.m_ret(a0 + 3, b1 - 6, a0 + 12, b1 - 3), c2)
        px.pinta(px.m_ret(a0 + 3, b1 - 3, a0 + 4, b1), c0)
        px.pinta(px.m_ret(a0 + 11, b1 - 3, a0 + 12, b1), c0)
        px.pinta(px.elipse(a0 + 16, b0 + 9, 1.6, 1.8) | px.m_ret(a0 + 14, b0 + 10, a0 + 18, b1 - 3), c0)
        px.pinta(R & (I % 4 == 1) & (V >= 1), c0)
        px.pinta(R & (V == 1), c0)
    elif qual == 'c':    # o salão: a mesa e as cadeiras vistas do alto
        px.pinta(R & (V >= h * 0.4), c2)
        px.pinta(px.m_ret(a0 + 6, b0 + 9, a1 - 6, b0 + 14), c3)
        px.pinta(px.m_ret(a0 + 6, b0 + 14, a1 - 6, b0 + 15), c0)
        for k in range(3):
            ii = a0 + 7 + k * 4
            px.pinta(px.m_ret(ii, b0 + 7, ii + 2, b0 + 9) | px.m_ret(ii, b0 + 15, ii + 2, b0 + 17), c0)
    else:                # a porta da entrada com alguém parado
        px.pinta(px.m_ret(a0 + 4, b0 + 3, a0 + 13, b1), c2)
        px.pinta(px.m_ret(a0 + 5, b0 + 4, a0 + 12, b1), c0)
        px.pinta(px.elipse(a0 + 17.5, b0 + 8, 1.6, 1.8) | px.m_ret(a0 + 16, b0 + 9, a0 + 20, b1), c0)
        px.pinta(R & (V >= h - 2), c3)
    # as linhas de varredura (fracas), o REC e a hora (riscas)
    px.tom(R & (V % 2 == 1), 0.93)
    px.pinta(px.m_ret(a0 + 1, b0 + 1, a0 + 3, b0 + 3), '#ff3a30')
    px.pinta(px.m_ret(a1 - 8, b0 + 1, a1 - 2, b0 + 2), '#f4f8f0')
    px.pinta(R & ((px.i == a0) | (px.v == b0)), _tom(_c(c0), 0.8))


def _monitores(ligado):
    X, Z = X0, _zm(2.9, 52)
    # a armação atrás (o poste e a barra)
    pt = Px(6, 48, '#4a4c52')
    pt.pinta(pt.i == 0, '#5e6066')
    placa(X, Z, 6, 48, 1, pt, lado('#3a3c42', '#5a5c62'))
    pb = Px(56, 4, '#4a4c52')
    pb.pinta(pb.v == 0, '#5e6066')
    placa(X, Z, 56, 4, 1, pb, lado('#3a3c42', '#5a5c62'))
    MW, MH = 28, 23
    for k, (di, dv, q) in enumerate(((-1, -1, 'a'), (1, -1, 'b'), (-1, 1, 'c'), (1, 1, 'd'))):
        px = Px(MW, MH, '#26272c')
        px.pinta(px.v == 0, '#34363c')
        px.pinta(px.i == 0, '#303238')
        _feed(px, 2, 2, MW - 2, MH - 4, q, ligado)
        px.ret(MW - 5, MH - 2, MW - 3, MH - 1, '#5ce07a' if ligado else '#d07a2a')
        cx = X + di * (MW / 2 + 1) / KX
        cz = Z - dv * (MH / 2 + 1) / KZ
        placa(cx, cz, MW, MH, 3, px, lado('#202126', '#3a3c42'), y0=1 / KX)


def monitor_wall():
    _monitores(True)


def monitor_wall_off():
    _monitores(False)


# =====================================================================================================================
# 10. mural de polaroids (46 x 31)
# =====================================================================================================================
def mural_polaroids(vazio=False):
    """
    O mural de cortiça com as seis polaroids (presas com fita ou alfinete).
    vazio: a gêmea esvaziada (mural_polaroids!vazio): levaram as fotos; na cortiça fica a marca mais clara de cada uma
    (onde o sol não pegou), os alfinetes espetados e os pedaços de fita.
    """
    X, Z = X0, _zm(2.6, 31)
    W, H, D = 44, 29, 2
    px = _quadro(W, H, '#2e2a28', 2, 31)
    pol = [(4, 3, 'mar', 'fita'), (17, 4, 'por', '#d23a2e'), (30, 3, 'mata', 'fita'),
           (8, 15, 'rosto2', '#3a6ad2'), (21, 16, 'noite', 'fita'), (33, 15, 'casa', '#e8c040')]
    for k, (i, v, tema, prende) in enumerate(pol):
        if vazio:
            px.tom(px.m_ret(i, v, i + 10, v + 12), 1.1)
        else:
            foto(px, i, v, 10, 12, tema, seed=k, polaroid=True)
        if prende == 'fita':
            fita(px, i + 3, v - 1, 4, 2)
        else:
            alfinete(px, i + 4, v, prende)
    placa(X, Z, W, H, D, px, lado('#2e2a28', '#4a4440'))


# =====================================================================================================================
# 11. letreiro neon do bar (64 x 26): o tubo desenha uma caneca, uma garrafa e uma taça; aceso (0) e apagado (1)
# =====================================================================================================================
def _neon(aceso):
    X, Z = X0, _zm(3.08, 26)
    W, H, D = 62, 24, 2
    FUNDO = '#1e161a'
    px = Px(W, H, FUNDO)
    px.pinta(px.contorno_de(px.m_ret(0, 0, W, H)), '#2e2428')
    for (i, v) in ((1, 1), (W - 3, 1), (1, H - 3), (W - 3, H - 3)):
        px.ret(i, v, i + 2, v + 2, '#6a6266')
        px.ret(i, v, i + 1, v + 1, '#8a8286')
    tubos = []
    # a moldura de tubo (cantos cortados)
    mold = px.linha_m([(5, 3), (W - 6, 3), (W - 4, 5), (W - 4, H - 6), (W - 6, H - 4), (5, H - 4), (3, H - 6), (3, 5), (5, 3)])
    tubos.append((mold, '#ff4f9a', '#ffd0e6'))
    # a caneca de chope: o copo, a alça e a espuma
    can = px.linha_m([(9, 8), (9, 18), (19, 18), (19, 8)]) | px.linha_m([(19, 10), (22, 10), (22, 15), (19, 15)])
    can |= px.linha_m([(12, 11), (12, 15)]) | px.linha_m([(16, 11), (16, 15)])
    tubos.append((can, '#ffb43c', '#fff2c4'))
    esp = px.linha_m([(8, 7), (10, 5), (12, 6), (14, 5), (16, 6), (18, 5), (20, 7)])
    tubos.append((esp, '#f4f4f4', '#ffffff'))
    # a garrafa
    gar = px.linha_m([(29, 18), (29, 11), (31, 9), (31, 5), (34, 5), (34, 9), (36, 11), (36, 18), (29, 18)])
    gar |= px.linha_m([(30, 13), (35, 13)])
    tubos.append((gar, '#46dcff', '#dcfaff'))
    # a taça (a borda, o pé e a azeitona)
    taca = px.linha_m([(41, 6), (55, 6), (48, 13), (41, 6)]) | px.linha_m([(48, 13), (48, 18)]) | px.linha_m([(44, 18), (52, 18)])
    tubos.append((taca, '#8aff6a', '#eaffe0'))
    tubos.append((px.elipse(50.5, 8.5, 1.3), '#ff5a4a', '#ffd0c8'))
    tudo = np.zeros((H, W), bool)
    for m, _, _ in tubos:
        tudo |= m
    if aceso:
        # o brilho no fundo (dois degraus), da cor do tubo mais perto
        for r, t in ((2, 0.22), (1, 0.45)):
            for m, cor, _ in tubos:
                anel = _dilata(m, r, quadrado=(r == 1)) & ~tudo
                px.mistura(anel, cor, t)
        for m, cor, nucleo in tubos:
            px.pinta(m, nucleo)
        for m, cor, nucleo in tubos:
            borda_t = _dilata(m, 1) & ~tudo
            px.pinta(borda_t & ~_dilata(tudo & ~m, 1), cor)
    else:
        for m, cor, _ in tubos:
            apag = _mistura(_tom(_c(cor), 0.5), '#6e666a', 0.5)
            px.pinta(m, apag)
            px.pinta(m & (_desloca(m, 0, -1) == False) & (_desloca(m, 1, 0) == False), _tom(apag, 0.8))
    placa(X, Z, W, H, D, px, lado('#2a2226', '#3e3438'))


def neon_bar():
    _neon(True)


def neon_bar_off():
    _neon(False)


# =====================================================================================================================
# 12. bilhetes colados na parede (40 x 38)
# =====================================================================================================================
def notes_wall():
    X, Z = X0, _zm(2.36, 38)
    # (meio em px a partir do meio do item: di para a direita, dv para baixo), w, h, desenho
    def folha_pautada(w, h, s):
        p = Px(w, h, '#f2f0e8')
        for v in range(4, h - 1, 3):
            p.pinta((p.v == v) & (p.i >= 1) & (p.i < w - 1), '#b4c8e0')
        p.pinta((p.i == 3) & (p.v >= 1), '#e08888')
        rng = np.random.default_rng(s)
        for v in range(4, h - 2, 3):
            L = int(rng.integers(4, w - 6))
            p.ret(5, v - 1, 5 + L, v, '#3a4a7a')
        p.pinta(p.contorno_de(p.m_ret(0, 0, w, h)), '#d6d2c6')
        fita(p, w // 2 - 2, 0, 4, 2)
        return p

    def postit(w, h, cor, s):
        p = Px(w, h, cor)
        p.pinta(p.v == 0, _tom(_c(cor), 0.88))
        rng = np.random.default_rng(s)
        for v in range(2, h - 2, 3):
            L = int(rng.integers(max(2, w - 6), w - 2))
            p.ret(1, v, 1 + L, v + 1, '#4a4a5a')
        p.pinta(p.contorno_de(p.m_ret(0, 0, w, h)) & ((p.i == w - 1) | (p.v == h - 1)), _tom(_c(cor), 0.85))
        return p

    def diagrama(w, h, s):
        p = Px(w, h, '#ece6d4')
        for (i, v) in ((3, 3), (w - 4, 4), (5, h - 4), (w - 4, h - 3)):
            p.pinta(p.elipse(i + 0.5, v + 0.5, 2.2) & ~p.elipse(i + 0.5, v + 0.5, 1.2), '#3a3a4a')
        p.linha([(5, 4), (w - 6, 4)], '#3a3a4a')
        p.linha([(3, 5), (5, h - 6)], '#3a3a4a')
        p.linha([(w - 5, 6), (w - 4, h - 5)], '#c8262c')
        p.pinta(p.contorno_de(p.m_ret(0, 0, w, h)) & ((p.i == w - 1) | (p.v == h - 1)), '#cfc8b4')
        fita(p, 1, 0, 3, 2)
        return p

    def cartao(w, h, s):
        p = Px(w, h, '#cfe2f2')
        p.pinta(p.v == 2, '#d86a6a')
        for v in (4, 6):
            p.ret(1, v, w - 3 - (v % 3), v + 1, '#3a4a6a')
        p.pinta(p.contorno_de(p.m_ret(0, 0, w, h)) & ((p.i == w - 1) | (p.v == h - 1)), '#a8bccc')
        return p

    def foto_p(w, h, s):
        p = Px(w, h, '#efeadc')
        imagem(p, 1, 1, w - 1, h - 3, 'rosto3', s)
        p.pinta(p.contorno_de(p.m_ret(0, 0, w, h)) & ((p.i == w - 1) | (p.v == h - 1)), '#cfc8b4')
        fita(p, w // 2 - 2, 0, 4, 2)
        return p

    notas = [(-11, -9, 15, 18, folha_pautada, 1), (7, -11, 13, 12, diagrama, 2), (12, 5, 10, 13, foto_p, 3),
             (-12, 11, 12, 8, cartao, 4), (3, 3, 9, 9, lambda w, h, s: postit(w, h, '#f2d94e', s), 5),
             (-1, 13, 8, 8, lambda w, h, s: postit(w, h, '#f28ab0', s), 6), (-6, -2, 8, 8, lambda w, h, s: postit(w, h, '#9ae0a8', s), 7)]
    for k, (di, dv, w, h, f, s) in enumerate(notas):
        placa(X + di / KX, Z - dv / KZ, w, h, 1, f(w, h, s), lado('#d8d2c2', '#ece8dc'), y0=k * 0.004)


# =====================================================================================================================
# 13. quadro de avisos (52 x 35)
# =====================================================================================================================
def notice_board():
    X, Z = X0, _zm(2.0, 35)
    W, H, D = 50, 33, 2
    px = _quadro(W, H, '#a8acb0', 2, 41)
    px.pinta(px.contorno_de(px.m_ret(0, 0, W, H)) & ((px.v == 0) | (px.i == 0)), '#d4d8dc')
    # o aviso com a faixa de cor em cima
    papel(px, 4, 4, 13, 17, cor='#f0eee6', seed=1, titulo=None)
    px.ret(5, 5, 16, 8, '#c83a32')
    alfinete(px, 9, 3, '#3a6ad2')
    # a escala (a tabela)
    m = papel(px, 19, 4, 15, 13, cor='#f0eee6', seed=2, linhas=False)
    for v in range(7, 16, 2):
        px.pinta((px.v == v) & (px.i >= 20) & (px.i < 33), '#a8b0bc')
    for i in (24, 29):
        px.pinta((px.i == i) & (px.v >= 5) & (px.v < 16), '#a8b0bc')
    px.ret(20, 5, 33, 7, '#4a6a9a')
    alfinete(px, 25, 3, '#d23a2e')
    # o calendário
    papel(px, 36, 4, 10, 12, cor='#f4f2ea', seed=3, linhas=False)
    px.ret(37, 5, 45, 7, '#d0403a')
    for v in range(8, 15, 2):
        for i in range(38, 45, 2):
            px.pinta(px.m_ret(i, v, i + 1, v + 1), '#7a7a80')
    px.pinta(px.m_ret(42, 10, 43, 11), '#d0403a')
    alfinete(px, 40, 3, '#e8c040')
    # o folheto colorido, o cartão e o post-it
    m = papel(px, 19, 19, 12, 11, cor='#f6b44a', seed=4, linhas=False)
    px.ret(21, 21, 29, 25, '#4a8ac8')
    px.ret(21, 26, 28, 27, '#7a4a1a')
    alfinete(px, 24, 18, '#2a9a5a')
    papel(px, 34, 19, 12, 9, cor='#d6e8f4', tinta='#4a5a7a', seed=5)
    alfinete(px, 39, 18, '#d23a2e')
    nota(px, 5, 23, 9, 7, '#f2d94e', seed=6)
    placa(X, Z, W, H, D, px, lado('#9a9ea2', '#c8ccd0'))


# =====================================================================================================================
# 14. painel de telas (100 x 56)
# =====================================================================================================================
def _tela_conteudo(px, a0, b0, a1, b1, qual, seed=0):
    R = px.m_ret(a0, b0, a1, b1)
    w, h = a1 - a0, b1 - b0
    I, V = px.i - a0, px.v - b0
    if qual == 'radar':
        px.pinta(R, '#1e6a4a')
        c = (a0 + w / 2, b0 + h / 2)
        rr = np.hypot(px.i + 0.5 - c[0], (px.v + 0.5 - c[1]) * 1.15)
        ang = np.arctan2(px.v + 0.5 - c[1], px.i + 0.5 - c[0])
        varre = R & (rr < h * 0.48) & (np.angle(np.exp(1j * (ang + 0.6))) > 0) & (np.angle(np.exp(1j * (ang + 0.6))) < 0.9)
        px.pinta(varre, '#2e9a68')
        for rad in (h * 0.46, h * 0.24):
            px.pinta(R & (rr >= rad - 0.6) & (rr < rad + 0.5), '#6af0a8')
        px.pinta(R & (np.abs(px.i + 0.5 - c[0]) < 0.5) & (rr < h * 0.48), '#4ac888')
        px.pinta(R & (np.abs(px.v + 0.5 - c[1]) < 0.5) & (rr < h * 0.48), '#4ac888')
        for (di, dv) in ((4, -3), (-6, 2), (2, 5)):
            px.pinta(px.m_ret(int(c[0]) + di, int(c[1]) + dv, int(c[0]) + di + 2, int(c[1]) + dv + 2), '#fff06a')
    elif qual == 'onda':
        px.pinta(R, '#1e3e70')
        px.pinta(R & ((I % 6 == 0) | (V % 5 == 0)), '#2a5290')
        for (amp, fr, fase, cor) in ((h * 0.28, 0.45, 0.0, '#6af0ff'), (h * 0.18, 0.8, 1.3, '#ff78c8')):
            pts = [(a0 + k, int(b0 + h / 2 + amp * math.sin(k * fr + fase))) for k in range(w)]
            px.linha(pts, cor)
    elif qual == 'barras':
        px.pinta(R, '#3a2c5c')
        px.pinta(R & (V % 4 == 0), '#44356a')
        rng = np.random.default_rng(seed)
        for k, i in enumerate(range(a0 + 2, a1 - 2, 4)):
            alt = int(rng.integers(3, h - 3))
            px.ret(i, b1 - 2 - alt, i + 3, b1 - 2, '#ffb040' if k % 3 else '#ffe070')
            px.ret(i, b1 - 2 - alt, i + 3, b1 - 1 - alt, '#fff0b0')
        px.ret(a0 + 1, b1 - 2, a1 - 1, b1 - 1, '#c8c0e0')
    elif qual == 'mapa':
        px.pinta(R, '#2c6eae')
        px.pinta(R & ((I % 8 == 0) | (V % 6 == 0)), '#3a7cbc')
        terra = R & (np.sin(I * 0.33 + seed) * np.cos(V * 0.42 + seed * 0.7) + np.sin((I + V) * 0.17) * 0.6 > 0.35)
        px.pinta(terra, '#8ad07a')
        px.pinta(terra & ~_desloca(terra, 1, 0), '#b4e8a0')
        for (i, v) in ((a0 + w * 0.3, b0 + h * 0.4), (a0 + w * 0.68, b0 + h * 0.62), (a0 + w * 0.8, b0 + h * 0.3)):
            anel = px.elipse(i, v, 3.2, 2.8) & ~px.elipse(i, v, 2.0, 1.7)
            px.pinta(anel & R, '#ff5a50')
            px.pinta(px.m_ret(int(i) - 1, int(v) - 1, int(i) + 1, int(v) + 1), '#fff0e0')
    elif qual == 'dados':
        px.pinta(R, '#16344c')
        rng = np.random.default_rng(seed)
        px.ret(a0 + 2, b0 + 2, a0 + 11, b0 + 12, '#2a5a7a')
        imagem(px, a0 + 3, b0 + 3, a0 + 10, b0 + 11, 'rosto', 1)
        px.mistura(px.m_ret(a0 + 3, b0 + 3, a0 + 10, b0 + 11), '#6af0ff', 0.25)
        px.pinta(px.m_ret(a0 + 3, b0 + 7, a0 + 10, b0 + 8), '#aaffff')
        for v in range(b0 + 3, b1 - 5, 3):
            L = int(rng.integers(6, max(7, w - 18)))
            px.ret(a0 + 14, v, a0 + 14 + L, v + 1, '#7af0a8' if v % 4 else '#e8f4f0')
        px.ret(a0 + 2, b1 - 4, a1 - 2, b1 - 2, '#2a4a62')
        px.ret(a0 + 2, b1 - 4, a0 + int((w - 4) * 0.7), b1 - 2, '#ffc840')
    elif qual == 'janela':
        px.pinta(R, '#e8eef6')
        px.ret(a0, b0, a1, b0 + 3, '#4a78c8')
        rng = np.random.default_rng(seed)
        for v in range(b0 + 5, b1 - 1, 3):
            L = int(rng.integers(4, max(5, w - 4)))
            px.ret(a0 + 2, v, a0 + 2 + L, v + 1, '#5a6a8a' if (v // 3) % 4 else '#e86a3a')
    px.pinta(R & ((px.i == a0) | (px.v == b0)), '#101418')


def painel_telas():
    X, Z = X0, _zm(2.3, 56)
    # a placa de trás (o rack) com os parafusos
    W, H = 98, 54
    pb = Px(W, H, '#383a40')
    pb.pinta(pb.contorno_de(pb.m_ret(0, 0, W, H)) & ((pb.v == 0) | (pb.i == 0)), '#4e5058')
    for (i, v) in ((2, 2), (W - 4, 2), (2, H - 4), (W - 4, H - 4)):
        pb.ret(i, v, i + 2, v + 2, '#6a6c74')
        pb.ret(i, v, i + 1, v + 1, '#8a8c94')
    pb.pinta(pb.m_ret(44, H - 3, 54, H - 2), '#2a2c30')
    for k in range(3):
        pb.ret(46 + k * 3, H - 3, 47 + k * 3, H - 2, ['#5ce07a', '#5ce07a', '#ffb040'][k])
    placa(X, Z, W, H, 1, pb, lado('#2e3036', '#4a4c54'))
    telas = [(5, 4, 29, 21, 'radar'), (35, 4, 29, 21, 'onda'), (65, 4, 29, 21, 'barras'), (5, 27, 45, 23, 'mapa'), (51, 27, 43, 23, 'dados')]
    for k, (i, v, w, h, q) in enumerate(telas):
        px = Px(w, h, '#222328')
        px.pinta(px.v == 0, '#30323a')
        px.pinta(px.i == 0, '#2c2e34')
        _tela_conteudo(px, 2, 2, w - 2, h - 2, q, seed=k)
        cx = X + (i + w / 2 - W / 2) / KX
        cz = Z - (v + h / 2 - H / 2) / KZ
        placa(cx, cz, w, h, 2, px, lado('#1e1f24', '#3a3c44'), y0=1 / KX)


# =====================================================================================================================
# 15. caixa de força (23 x 29)
# =====================================================================================================================
def power_box():
    X, Z = X0, _zm(2.0, 29)
    W, H, D = 19, 26, 4
    px = Px(W, H, '#8c9296')
    px.pinta(px.v == 0, '#a4aaae')
    px.borda(2, 2, W - 2, H - 2, '#6e7478')                 # a fresta da porta
    px.pinta((px.v == 2) & (px.i >= 2) & (px.i < W - 2), '#6e7478')
    px.pinta((px.v == 3) & (px.i >= 3) & (px.i < W - 3), '#a0a6aa')
    px.pinta((px.i == 3) & (px.v >= 3) & (px.v < H - 3), '#9ca2a6')
    for v in (5, H - 8):                                      # as dobradiças
        px.ret(1, v, 2, v + 3, '#4a4e52')
    px.ret(W - 5, 10, W - 3, 15, '#3a3e42')                   # o trinco
    px.ret(W - 5, 10, W - 4, 11, '#6a7074')
    px.ret(6, 5, 13, 8, '#e8c040')                            # a plaquinha amarela (sem desenho)
    px.ret(6, 7, 13, 8, '#c8a030')
    for v in (H - 7, H - 5):                                  # a ventilação
        px.ret(6, v, 13, v + 1, '#4e5458')
    placa(X, Z, W, H, D, px, lado('#7a8084', '#a8aeb2'))
    # o eletroduto que sai de baixo e entra na parede
    caixa((X - 0.03, X - 0.0, 0.025, 0.055, Z - H / 2 / KZ - 0.06, Z - H / 2 / KZ), lado('#7a7e82', '#9a9ea2'))


# =====================================================================================================================
# 16. leitor de digital (10 x 14)
# =====================================================================================================================
def scanner_digital():
    X, Z = X0, _zm(1.3, 14)
    W, H, D = 8, 12, 3
    px = Px(W, H, '#2e3236')
    px.pinta(px.v == 0, '#40464a')
    px.ret(1, 1, W - 1, 4, '#5af0c0')                        # o visor aceso
    px.ret(1, 1, W - 1, 2, '#9afce0')
    px.ret(2, 3, 5, 4, '#2aa880')
    px.ret(2, 5, W - 2, 10, '#3a8ce8')                        # o vidro da digital, aceso
    px.pinta(px.m_ret(3, 6, W - 3, 9), '#7ac4ff')
    px.pinta(px.m_ret(3, 7, W - 3, 8), '#c4e8ff')
    px.ret(5, H - 1, 7, H, '#5ce07a')
    placa(X, Z, W, H, D, px, lado('#26292c', '#454a4e'))


# =====================================================================================================================
# 17. a tela grande do C.R.I.S (130 x 72): o monitor antigo de plástico bege, ligado
# =====================================================================================================================
def tela_cris():
    X, Z = X0, _zm(1.9, 72)
    W, H, D = 124, 69, 6
    BEGE = '#cfc6aa'
    px = Px(W, H, BEGE)
    px.pinta(px.v <= 1, '#ddd5bc')
    px.pinta(px.i <= 1, '#d8d0b6')
    a0, b0, a1, b1 = 7, 6, W - 7, H - 11
    # o rebaixo da tela (o plástico entrando) e o vidro
    px.borda(a0 - 2, b0 - 2, a1 + 2, b1 + 2, '#b4ab90')
    px.pinta(px.m_ret(a0 - 2, b0 - 2, a1 + 2, b1 + 2) & ((px.v == b1 + 1) | (px.i == a1 + 1)), '#e2dac2')
    px.borda(a0 - 1, b0 - 1, a1 + 1, b1 + 1, '#3a3834')
    R = px.m_ret(a0, b0, a1, b1)
    px.pinta(R, '#2456a8')
    I, V = px.i - a0, px.v - b0
    px.pinta(R & ((I % 10 == 0) | (V % 10 == 0)), '#2c62b6')
    w, h = a1 - a0, b1 - b0
    # a janela grande: o mapa com os pontos achados
    _janela(px, a0 + 3, b0 + 3, a0 + 64, b0 + 38, 'mapa', 1)
    # o radar
    _janela(px, a0 + 67, b0 + 3, a1 - 3, b0 + 22, 'radar', 2)
    # a lista (clara)
    _janela(px, a0 + 67, b0 + 25, a1 - 3, b1 - 3, 'janela', 3)
    # a barra de progresso e os quadradinhos de estado
    px.ret(a0 + 3, b0 + 41, a0 + 64, b0 + 46, '#16306a')
    px.ret(a0 + 4, b0 + 42, a0 + 46, b0 + 45, '#ffc840')
    px.ret(a0 + 4, b0 + 42, a0 + 46, b0 + 43, '#ffe8a0')
    for k in range(4):
        px.ret(a0 + 3 + k * 5, b1 - 4, a0 + 6 + k * 5, b1 - 2, ['#5ce07a', '#5ce07a', '#ffb040', '#ff5a50'][k])
    # o vidro curvo: a borda escurece, o reflexo em cima à esquerda
    px.tom(R & ((I == 0) | (V == 0) | (I == w - 1) | (V == h - 1)), 0.72)
    px.pinta(R & ((I <= 1) & (V <= 1) | (I >= w - 2) & (V <= 1) | (I <= 1) & (V >= h - 2) | (I >= w - 2) & (V >= h - 2)), '#3a3834')
    refl = R & (I + V * 2 >= 8) & (I + V * 2 < 11) & (V < 10)
    px.mistura(refl, '#ffffff', 0.35)
    # embaixo: o led, os botões redondos e a grade de ventilação
    px.ret(a0 + 2, H - 6, a0 + 4, H - 5, '#5ce07a')
    for k in range(3):
        bi = a1 - 18 + k * 6
        px.ret(bi, H - 7, bi + 3, H - 4, '#a89e84')
        px.ret(bi, H - 7, bi + 3, H - 6, '#ddd5bc')
    for k in range(6):
        px.ret(a0 + 30 + k * 4, H - 7, a0 + 32 + k * 4, H - 4, '#a89e84')
    placa(X, Z, W, H, D, px, lado('#b8af94', '#ddd5bc'))


def _janela(px, a0, b0, a1, b1, qual, seed):
    px.ret(a0 + 1, b0 + 1, a1 + 1, b1 + 1, '#16306a')      # a sombra da janela
    px.ret(a0, b0, a1, b1, '#c8d2e6')
    px.ret(a0, b0, a1, b0 + 3, '#d8e0f0')
    px.ret(a0 + 2, b0 + 1, a0 + 2 + (a1 - a0) // 3, b0 + 2, '#8a9ab8')
    for k, cor in enumerate(('#ff5a50', '#ffc840', '#5ce07a')):
        px.ret(a1 - 3 - k * 3, b0 + 1, a1 - 1 - k * 3, b0 + 2, cor)
    _tela_conteudo(px, a0 + 1, b0 + 3, a1 - 1, b1 - 1, qual, seed)


# =====================================================================================================================
# 18. tela de derrota (56 x 34): um monitor parado na tela de "fim de jogo" (sem letra)
# =====================================================================================================================
def tela_derrota():
    X, Z = X0, _zm(2.6, 34)
    W, H, D = 54, 32, 2
    px = Px(W, H, '#1c1c20')
    px.pinta(px.v == 0, '#2c2c32')
    a0, b0, a1, b1 = 2, 2, W - 2, H - 4
    R = px.m_ret(a0, b0, a1, b1)
    I, V = px.i - a0, px.v - b0
    w, h = a1 - a0, b1 - b0
    px.pinta(R, '#3a1a52')
    px.pinta(R & (V >= h * 0.35), '#4a1e5e')
    px.pinta(R & (V >= h * 0.7), '#5a2268')
    # os três corações vazios em cima
    for k in range(3):
        ci = a0 + 3 + k * 6
        cor = px.m_ret(ci, b0 + 2, ci + 2, b0 + 3) | px.m_ret(ci + 3, b0 + 2, ci + 5, b0 + 3) | px.m_ret(ci, b0 + 3, ci + 5, b0 + 4) | \
            px.m_ret(ci + 1, b0 + 4, ci + 4, b0 + 5) | px.m_ret(ci + 2, b0 + 5, ci + 3, b0 + 6)
        px.pinta(cor, '#ff4a6a' if k == 0 else '#6a3a7a')
    # a faixa vermelha no meio (o lugar da palavra, sem letra) com os enfeites nas pontas
    fb0, fb1 = b0 + 9, b0 + 16
    px.ret(a0 + 5, fb0, a1 - 5, fb1, '#d42a3a')
    px.ret(a0 + 5, fb0, a1 - 5, fb0 + 1, '#ff6a72')
    px.ret(a0 + 5, fb1 - 1, a1 - 5, fb1, '#8a1626')
    for i in (a0 + 3, a1 - 5):
        px.ret(i, fb0 + 2, i + 2, fb1 - 2, '#a81e30')
    px.ret(a0 + 12, fb0 + 3, a1 - 12, fb0 + 4, '#ff9aa0')
    # o boneco caído (deitado) com a espada do lado
    px.ret(a0 + 6, b1 - 4, a0 + 14, b1 - 2, '#c8c4d0')
    px.ret(a0 + 14, b1 - 5, a0 + 17, b1 - 2, '#e8c8a8')
    px.ret(a0 + 6, b1 - 2, a0 + 15, b1 - 1, '#2a1238')
    px.linha([(a0 + 19, b1 - 2), (a0 + 25, b1 - 4)], '#d8dce8')
    # os dois botões do menu (um aceso)
    px.borda(a1 - 22, b1 - 6, a1 - 13, b1 - 2, '#ffd84a')
    px.ret(a1 - 21, b1 - 5, a1 - 14, b1 - 3, '#7a3a8a')
    px.borda(a1 - 11, b1 - 6, a1 - 3, b1 - 2, '#9a7aaa')
    px.pinta(R & ((I == 0) | (V == 0)), '#1a0c26')
    px.ret(W // 2 - 1, H - 2, W // 2 + 1, H - 1, '#e8e8f0')
    placa(X, Z, W, H, D, px, lado('#18181c', '#34343a'))


# =====================================================================================================================
# 19. porta-toalhas (18 x 22)
# =====================================================================================================================
def towel_dispenser():
    X, Z = X0, _zm(2.27, 22)
    W, H, D = 14, 18, 6
    px = Px(W, H, '#e8e8e2')
    px.pinta(px.v == 0, '#f4f4ee')
    px.pinta(px.v == 2, '#cfcfc6')
    px.ret(2, 4, W - 2, 10, '#7c8c98')                       # a janelinha fumê
    px.ret(3, 6, W - 3, 9, '#a8b8c2')                        # o rolo de papel lá dentro
    px.ret(3, 6, W - 3, 7, '#c8d4da')
    px.pinta(px.m_ret(2, 4, W - 2, 5), '#5e6e7a')
    px.ret(3, 12, W - 3, 14, '#6a6e74')                      # a alavanca
    px.ret(3, 12, W - 3, 13, '#8a8e94')
    px.pinta(px.v >= H - 3, '#d6d6ce')
    px.ret(2, H - 2, W - 2, H - 1, '#4a4c50')                # a fenda
    x0, x1, z0, z1, y = placa(X, Z + 0.03, W, H, D, px, lado('#d4d4cc', '#f0f0ea'))
    # a ponta da toalha saindo da fenda
    tp = Px(8, 5, '#f4f2ec')
    tp.pinta(tp.v == tp.H - 1, '#dedbd2')
    tp.pinta(tp.i == tp.W - 1, '#e2dfd6')
    placa((x0 + x1) / 2, z0 - 1.5 / KZ, 8, 4, 1, tp, lado('#e4e2da', '#f4f2ec'), y0=y - 2.5 / KX)


# =====================================================================================================================
# 20. TV grande (72 x 42), ligada: a cidade no fim da tarde
# =====================================================================================================================
def tv_grande():
    X, Z = X0, _zm(2.45, 42)
    W, H, D = 70, 40, 2
    px = Px(W, H, '#16161a')
    px.pinta(px.v == 0, '#26262c')
    a0, b0, a1, b1 = 1, 1, W - 1, H - 3
    R = px.m_ret(a0, b0, a1, b1)
    I, V = px.i - a0, px.v - b0
    w, h = a1 - a0, b1 - b0
    bandas = [('#4a3488', 0), ('#7a3c8e', 6), ('#c04a7a', 11), ('#ee7a52', 16), ('#ffb45a', 20), ('#ffd88a', 23)]
    for cor, v in bandas:
        px.pinta(R & (V >= v), cor)
    # as nuvens compridas
    for (i, v, L, cor) in ((6, 4, 14, '#9a5aa4'), (30, 8, 18, '#e06a8a'), (48, 14, 12, '#ff9a6a'), (12, 13, 10, '#e06a8a')):
        px.ret(a0 + i, b0 + v, a0 + i + L, b0 + v + 1, cor)
    # o sol se pondo
    sol = px.elipse(a0 + 44, b0 + 25, 5.0, 4.4) & R & (V < 25)
    px.pinta(sol, '#fff2b8')
    # os prédios
    rng = np.random.default_rng(7)
    i = a0
    while i < a1:
        bw = int(rng.integers(4, 9))
        alt = int(rng.integers(7, 18))
        top = b0 + 26 - alt
        corp = px.m_ret(i, top, min(i + bw, a1), b0 + 29) & R
        px.pinta(corp, '#2a1e44' if (i // 3) % 2 else '#33244e')
        px.pinta(corp & (px.i == i), '#4a3466')
        for vv in range(top + 2, b0 + 26, 3):
            for ii in range(i + 1, min(i + bw, a1) - 1, 2):
                if rng.random() < 0.45:
                    px.pinta(px.m_ret(ii, vv, ii + 1, vv + 2), '#ffd060')
        i += bw
    # a água com o reflexo
    agua = R & (V >= 29)
    px.pinta(agua, '#2a2a5a')
    for (ii, v, L) in ((38, 30, 12), (40, 32, 8), (42, 34, 5)):
        px.ret(a0 + ii, b0 + v, a0 + ii + L, b0 + v + 1, '#ffb45a')
    for (ii, v, L) in ((8, 31, 6), (20, 33, 5), (56, 31, 7)):
        px.ret(a0 + ii, b0 + v, a0 + ii + L, b0 + v + 1, '#4a4a8a')
    px.pinta(R & ((I == 0) | (V == 0)), _tom(hx('#4a3488'), 0.7))
    px.ret(W // 2 - 1, H - 2, W // 2 + 1, H - 1, '#e8e8f0')
    placa(X, Z, W, H, D, px, lado('#141418', '#2e2e34'))


# =====================================================================================================================
# 21. TV de tubo no suporte (26 x 34), passando futebol
# =====================================================================================================================
def tv_wall():
    X, Z = X0, _zm(2.99, 34)
    W, H, D = 17, 15, 8
    MAD = '#6e4428'
    px = Px(W, H, '#2e2c2c')
    px.pinta(px.v == 0, '#3e3a38')
    px.pinta(px.i == 0, '#3a3634')
    a0, b0, a1, b1 = 2, 2, 12, 12
    R = px.m_ret(a0, b0, a1, b1)
    I, V = px.i - a0, px.v - b0
    px.pinta(R, '#3aa04a')
    px.pinta(R & ((I // 3) % 2 == 0), '#48b058')
    px.pinta(R & (V < 3), '#3a4a7a')
    px.pinta(R & (V < 3) & ((I // 2) % 2 == 0), '#4a5a8a')
    px.pinta(R & (V == 3), '#e8f0e8')
    px.pinta(R & (I == 5) & (V >= 3), '#e8f0e8')
    for (i, v, cor) in ((2, 5, '#e83a30'), (7, 6, '#3a6ae8'), (3, 8, '#3a6ae8'), (8, 8, '#e83a30')):
        px.ret(a0 + i, b0 + v, a0 + i + 1, b0 + v + 2, cor)
    px.ret(a0 + 5, b0 + 7, a0 + 6, b0 + 8, '#ffffff')
    for (i, v) in ((a0, b0), (a1 - 1, b0), (a0, b1 - 1), (a1 - 1, b1 - 1)):
        px.pinta(px.m_ret(i, v, i + 1, v + 1), '#1e1c1c')
    px.mistura(R & (I + V >= 1) & (I + V < 3), '#ffffff', 0.3)
    # o painel do lado: dois botões e o alto-falante
    for v in (3, 6):
        px.ret(13, v, 15, v + 2, '#c8c0b0')
        px.ret(14, v + 1, 15, v + 2, '#8a8478')
    for v in (9, 11):
        px.ret(13, v, 16, v + 1, '#1a1818')
    px.ret(2, 13, 12, 14, '#4a4644')
    zt = Z + 0.08
    x0, x1, z0, z1, y = placa(X - 0.02, zt, W, H, D, px, lado(MAD, '#8a5634'), y0=0.02)
    # o suporte: a bandeja embaixo e o braço inclinado até a parede
    ob = novo()
    caixa((x0 - 0.01, x1 + 0.01, 0.0, y - 0.01, z0 - 0.025, z0), lado('#3a3a40', '#5a5a62'), ob)
    a = np.array([X - 0.02, 0.02, z0 - 0.2])
    b = np.array([X - 0.02, y - 0.04, z0 - 0.02])
    C = (a + b) / 2
    F = (b - a) / 2
    u = np.array([0.018, 0, 0])
    w = np.cross(u, F)
    w = w / np.linalg.norm(w) * 0.012
    bloco(C, F, u, w, lado('#3a3a40', '#5a5a62'), ob)
    caixa((X - 0.06, X + 0.02, 0.0, 0.02, z0 - 0.24, z0 - 0.14), lado('#3a3a40', '#5a5a62'), ob)


# =====================================================================================================================
# 22. alvo de papel (29 x 46): a silhueta furada de bala
# =====================================================================================================================
def target_paper():
    X, Z = X0, _zm(1.72, 46)
    W, H, D = 27, 45, 2
    px = Px(W, H, '#8a6a44')
    px.pinta(px.v == 0, '#a07c52')
    a0, b0, a1, b1 = 2, 3, W - 2, H - 2
    R = px.m_ret(a0, b0, a1, b1)
    px.sombra(R, 0.7)
    px.pinta(R, '#ece6d2')
    px.pinta(R & ((px.i == a1 - 1) | (px.v == b1 - 1)), '#d4ccb4')
    ci = (a0 + a1) / 2
    cab = px.elipse(ci, b0 + 7.5, 3.6, 4.4)
    corpo = (px.v >= b0 + 13) & (px.v < b1 - 1) & (np.abs(px.i + 0.5 - ci) <= np.minimum(8.5, 3 + (px.v - (b0 + 13)) * 2.2)) & R
    pesc = px.m_ret(int(ci) - 2, b0 + 11, int(ci) + 2, b0 + 14)
    sil = (cab | corpo | pesc) & R
    px.pinta(sil, '#2c2c34')
    # os anéis de pontuação (claros, dentro da silhueta)
    for (cv, r) in ((b0 + 24, 6.5), (b0 + 24, 3.6)):
        anel = px.elipse(ci, cv, r, r * 1.1) & ~px.elipse(ci, cv, r - 1, (r - 1) * 1.1)
        px.pinta(anel & sil, '#6a6a76')
    anel = px.elipse(ci, b0 + 7.5, 2.4, 2.8) & ~px.elipse(ci, b0 + 7.5, 1.4, 1.8)
    px.pinta(anel & sil, '#6a6a76')
    # os furos de bala (o furo escuro e a borda clara do papel rasgado)
    for (i, v) in ((12, b0 + 22), (15, b0 + 25), (11, b0 + 27), (13, b0 + 7), (17, b0 + 19), (7, b0 + 31)):
        f = px.m_ret(i, v, i + 2, v + 2)
        px.pinta(_dilata(f, 1) & ~f & ~sil, '#b8b09a')
        px.pinta(_dilata(f, 1) & ~f & sil, '#5a5a66')
        px.pinta(f, '#120e0c')
    placa(X, Z, W, H, D, px, mad2('#8a6a44', eixo=0, seed=8), cima=liso('#a88458'))
    # os dois prendedores em cima
    for di in (-0.17, 0.11):
        caixa((X + di, X + di + 0.06, 2 / KX, 2 / KX + 0.025, Z + H / 2 / KZ - 0.06, Z + H / 2 / KZ + 0.01), lado('#2a2a2e', '#4a4a52'))


# =====================================================================================================================
ITENS_PAREDE = {
    'ac_wall': (ac_wall, (X0, _zm(3.9, 17))),
    'board_detective': (board_detective, (X0, _zm(1.95, 82))),
    'board_investigation': (board_investigation, (X0, _zm(2.36, 50))),
    'cctv': (cctv, (X0, _zm(3.63, 24))),
    'dartboard': (dartboard, (X0, _zm(2.8, 28))),
    'emergency_light': (emergency_light, (X0, _zm(3.27, 16)), {'1': emergency_light_off}),
    'extinguisher': (extinguisher, (X0, _zm(1.63, 30))),
    'fan_wall': (fan_wall, (X0, _zm(3.54, 30))),
    'monitor_wall': (monitor_wall, (X0, _zm(2.9, 52)), {'1': monitor_wall_off}),
    'mural_polaroids': (mural_polaroids, (X0, _zm(2.6, 31))),
    'mural_polaroids!vazio': (lambda: mural_polaroids(True), (X0, _zm(2.6, 31))),   # a gêmea vazia: sem as fotos
    'neon_bar': (neon_bar, (X0, _zm(3.08, 26)), {'1': neon_bar_off}),
    'notes_wall': (notes_wall, (X0, _zm(2.36, 38))),
    'notice_board': (notice_board, (X0, _zm(2.0, 35))),
    'painel_telas': (painel_telas, (X0, _zm(2.3, 56))),
    'power_box': (power_box, (X0, _zm(2.0, 29))),
    'scanner_digital': (scanner_digital, (X0, _zm(1.3, 14))),
    'tela_cris': (tela_cris, (X0, _zm(1.9, 72))),
    'tela_derrota': (tela_derrota, (X0, _zm(2.6, 34))),
    'towel_dispenser': (towel_dispenser, (X0, _zm(2.27, 22))),
    'tv_grande': (tv_grande, (X0, _zm(2.45, 42))),
    'tv_wall': (tv_wall, (X0, _zm(2.99, 34))),
    'target_paper': (target_paper, (X0, _zm(1.72, 46))),
}
