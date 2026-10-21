"""
GRUPO A1: os quatro blocos da MANSAO ALBUQUERQUE vistos de fora (o corpo central, o portico de entrada e as duas alas),
em pixel art 1:1 feita so por codigo, no acabamento dos predios da vila (vila_predios.py) e da fazenda (fazenda_fora.py).

A familia e dona do Frigorifico Albuquerque (1918), dinheiro antigo: a casa e de PEDRA ESCURA (cinza-marrom) com a
cantaria clara nas quinas, nos frisos e nas molduras das janelas, e o telhado e de telha FERRUGEM (terracota gasta, com
manchas de ferrugem). Os quatro blocos usam a mesma pedra, a mesma telha, as mesmas janelas altas de guilhotina (com a
cortina vaga e, uma ou outra, a luz amarela e morna de quem mora la) e os mesmos frisos: encostados, formam um U.

Tudo desenhado no giro 4 (a frente para +y), a pegada comecando em (0, 0), no tamanho do pedido (casas de 0,75 m):
  mansao_central   13 x 18  7,6 m   o corpo central: telhado de quatro aguas com o frontao e o oculo, tres chamines
  mansao_portico    9 x  9  5,0 m   o portico: colunas, escada de 4 degraus, tapete vermelho, terraco com balaustres
  mansao_ala_oeste 13 x 24  6,9 m   a ala comprida: duas aguas com a cumeeira em y, a empena para a frente
  mansao_ala_leste 12 x 24  6,9 m   a mesma ala, com 12 casas de largura
Posicoes no jogo (casas): central (18, 2), ala oeste (5, 7), ala leste (31, 7), portico (20, 21). Os blocos se tocam
(o lado da ala que encosta no central e rente, sem beiral); o portico tem um "cotovelo" de pedra de 0,75 m que vai para
tras da pegada e fecha a fresta de 1 casa entre ele e a frente do central.
"""
import math
import sys

import numpy as np

import cozinha as CZ
import base_estilo as BE
import fazenda_fora as FF
import motor
from base_estilo import hx, liso, mad2, _tom, _cru, PZ, PH
from motor import ruido, suave, emissivo, MUNDO as M

CASA = 0.75

# ---------------------------------------------------------------- a paleta da mansao
PEDRA_M = ['#756d61', '#7d7467', '#6a6358', '#837a6c']        # a pedra escura da parede (cinza-marrom)
PEDRA_J = '#3e3a32'
CANT = ['#c9c1af', '#d2cab8', '#beb6a3']                       # a cantaria clara (quinas, frisos, molduras)
CANT_J = '#7a7364'
SOCO = ['#6e675b', '#766f62', '#645e53']                       # o embasamento (blocos grandes e escuros)
TELHA_R = ['#9a5030', '#a65a34', '#8a4628', '#b2643a']        # a telha ferrugem (terracota gasta)
TELHA_J = '#4a2214'
CUME_R = '#6e3422'
FASCIA = '#3a2a22'
FERRO = '#2a2624'
MARM = ['#e6dfd0', '#ded6c4', '#eae4d6']                       # o marmore creme do portico
MARM_J = '#b4ab96'

obj = FF.obj
caixa = FF.caixa
pegada = FF.pegada
_bx = FF._bx


def _hex(c):
    return '#%02x%02x%02x' % tuple(np.clip(np.round(np.asarray(c, float)), 0, 255).astype(int))


# =====================================================================================================================
# o canvas do exportador: os blocos passam do alto que ele reserva (4,6 m): enquanto desenha um deles, a conta da caixa
# da imagem usa o alto do bloco (o resto do exportador nao muda; a ancora continua certa)
# =====================================================================================================================
ALTO_CANVAS = {'mansao_central': 9.6, 'mansao_portico': 5.6, 'mansao_ala_oeste': 9.0, 'mansao_ala_leste': 9.0}


def _canvas_alto():
    main = sys.modules.get('__main__')
    t0 = getattr(main, 'tela', None)
    if t0 is None or getattr(t0, '_mansao', False) or not hasattr(main, 'ITENS'):
        return

    def tela_alta(P):
        A = np.asarray(P, float)
        if A.ndim == 2 and A.shape == (8, 3):
            f = sys._getframe(1)
            for _ in range(6):
                if f is None:
                    break
                if f.f_code.co_name == 'desenhar':
                    nome = f.f_locals.get('nome')
                    if nome in ALTO_CANVAS:
                        A = A.copy()
                        A[:, 2] = np.where(A[:, 2] > 0, max(ALTO_CANVAS[nome], float(A[:, 2].max())), A[:, 2])
                    break
                f = f.f_back
        return t0(A)
    tela_alta._mansao = True
    main.tela = tela_alta


_canvas_alto()


# =====================================================================================================================
# a geometria da fachada: l ao longo, e para fora, z a altura
# =====================================================================================================================
def _P(face, plano, l, e, z):
    sg = 1 if face[0] == '+' else -1
    if face[1] == 'y':
        return (l, plano + sg * e, z)
    return (plano + sg * e, l, z)


def _N(face, nl, ne, nz):
    sg = 1.0 if face[0] == '+' else -1.0
    return (nl, sg * ne, nz) if face[1] == 'y' else (sg * ne, nl, nz)


def _lat(face):
    return 0 if face[1] == 'y' else 1


def _quad(pts, mat, o, hint):
    """Um poligono plano (convexo) com a normal virada para o lado de `hint` (calculada dos pontos)."""
    P = np.array(pts, float)
    n = np.cross(P[1] - P[0], P[2] - P[0])
    n = n / np.linalg.norm(n)
    if n @ np.asarray(hint, float) < 0:
        n = -n
    CZ.c.face_plana([tuple(p) for p in pts], tuple(n), mat, M, o)


# =====================================================================================================================
# os materiais: a pedra escura, a cantaria, a telha ferrugem
# =====================================================================================================================
def mat_pedra(seed=0, alt=0.17, comp=0.36, cores=PEDRA_M, junta=PEDRA_J, sujo=True):
    """A pedra da parede em fiadas desencontradas (a junta escura de 1 px, a luz depois dela), com a umidade na base e
    as manchas largas e suaves de tempo (sem pixel solto)."""
    def extra(L, n, P, out, i0):
        if not sujo:
            return out
        a = P[:, 0] - P[:, 1]
        q = suave(a, P[:, 2], 0.9, 71 + seed)
        out = np.where((q > 0.7)[:, None], out * 0.9, out)
        out = np.where((P[:, 2] < 0.5)[:, None], out * 0.9, out)
        return out
    return FF.mat_juntas(list(cores), FF.id_pedras_parede(alt, comp, seed), junta, seed=seed + 3, extra=extra)


def mat_cant(seed=0, alt=0.3, comp=0.62):
    """A cantaria clara em blocos grandes (cunhais, frisos, cimalhas, molduras)."""
    return FF.mat_juntas(list(CANT), FF.id_pedras_parede(alt, comp, seed), CANT_J, seed=seed + 5)


def mat_marmore(seed=0, lado=1.125):
    """O marmore creme do portico: lajes grandes de tres tons, a junta fina e escura, e um veio claro raro."""
    def fn(P):
        return (np.floor((P[:, 0] + 50) / lado) * 1000 + np.floor((P[:, 1] + 50) / lado)).astype(np.int64)

    def extra(L, n, P, out, i0):
        a = P[:, 0] * 0.7 + P[:, 1] * 0.3 + P[:, 2] * 0.5
        veio = (suave(a, P[:, 1] * 0.2 + P[:, 2], 0.9, 91 + seed) > 0.8) & (((P[:, 0] + P[:, 1]) / (2 * PH)) % 3 < 1.2)
        return np.where(veio[:, None], out * 0.94, out)
    return FF.mat_juntas(list(MARM), fn, MARM_J, seed=seed + 7, extra=extra)


def mat_telha(zb, sin_t, a, s, ax, seed=0, tom=1.0):
    """A telha ferrugem: as fiadas de capa e canal do FF, com as manchas de ferrugem (laranja vivo e marrom escuro) em
    blocos largos e limpos por cima."""
    base = FF.mat_telha(TELHA_R, TELHA_J, zb, sin_t, a, s, ax, 'capa', 0.0, seed)

    def f(L, n, P):
        out = base(L, n, P)
        q = suave(P[:, 0], P[:, 1] + P[:, 2], 0.8, 81 + seed) * 0.62 + suave(P[:, 0], P[:, 1], 0.26, 82 + seed) * 0.38
        out = np.where((q > 0.7)[:, None], out * 0.55 + hx('#cc7632') * 0.45, out)
        out = np.where((q < 0.24)[:, None], out * 0.8, out)
        return out * tom
    return emissivo(f)


def _agua(pts, seed=0, esp=0.11, beira=True):
    """Uma agua de telhado: pts = [beiral a, beiral b, alto b, alto a] (os dois primeiros no beiral, em baixo; o ultimo
    pode faltar: triangulo). A normal sai do polígono; a telha e a ferrugem seguem a agua."""
    P = np.array(pts, float)
    a = P[1] - P[0]
    a[2] = 0
    a = a / np.linalg.norm(a)
    em = (P[0] + P[1]) / 2
    hm = P[2:].mean(0)
    s = hm - em
    s = s - a * (s @ a)
    s = s / np.linalg.norm(s)
    n = np.cross(a, s)
    if n[2] < 0:
        n = -n
    ax = 0 if abs(a[0]) > abs(a[1]) else 1
    # as aguas viradas para +x ficam um tom mais escuras (como a parede de +x)
    tom = 1.0 - 0.1 * max(0.0, n[0]) - 0.0 * n[1]
    o = obj()
    mat = mat_telha(em[2], s[2], a, s, ax, seed, tom)
    CZ.c.face_plana([tuple(p) for p in P], tuple(n), mat, M, o)
    if beira:
        # a testeira (a tabua do beiral): uma faixa fina embaixo da borda baixa
        h = np.array([n[0], n[1], 0.0])
        h = h / max(np.linalg.norm(h), 1e-9)
        ofa = obj()
        f0 = [P[0] - np.array([0, 0, esp]), P[1] - np.array([0, 0, esp]), P[1], P[0]]
        CZ.c.face_plana([tuple(p) for p in f0], tuple(h), liso(FASCIA), M, ofa)
    return o


# =====================================================================================================================
# a luz redonda (as colunas): a luz em degraus pela normal de cada pixel (como as torres da vila)
# =====================================================================================================================
def _redondo(base, normal_px):
    def f(L, n, P):
        out = base(L, n, P)
        N = normal_px(P)
        k = BE._luz_k(BE.n_mundo(N) @ BE._LUZ2)
        return _cru(_tom(out, k), n)
    return emissivo(f)


def _n_cil(cx, cy, inc=0.0):
    def f(P):
        th = np.arctan2(P[:, 1] - cy, P[:, 0] - cx)
        N = np.stack([np.cos(th), np.sin(th), np.full(len(P), inc)], 1)
        return N / np.linalg.norm(N, axis=1, keepdims=True)
    return f


def mat_coluna(cx, cy, r, inc=0.0, estrias=14):
    """O fuste de pedra clara canelado (as estrias em faixas de ~4 px), com a luz redonda."""
    cs = [hx('#cfc7b4'), hx('#c3baa6')]

    def base(L, n, P):
        th = np.arctan2(P[:, 1] - cy, P[:, 0] - cx)
        g = (th / (2 * math.pi) * estrias) % 1
        out = np.where((g < 0.2)[:, None], cs[1] * 0.9, cs[0])
        return np.where(((P[:, 2] * 1.0 / 0.4) % 1 < 0.0)[:, None], cs[1], out)
    return _redondo(base, _n_cil(cx, cy, inc))


# =====================================================================================================================
# a janela alta de guilhotina: vidro (aceso e morno ou escuro), cortina vaga, esquadria, moldura de cantaria
# =====================================================================================================================
def mat_vidro_m(lat, a0, a1, z0, z1, acesa, seed=0):
    """O vidro da janela. Aceso: a luz morna do lado de dentro (em degraus, mais forte embaixo) e a cortina de veludo
    dos dois lados com as pregas; apagado: o vidro escuro com o reflexo do ceu em diagonal e a cortina vinho no escuro."""
    lit = [hx(x) for x in ('#fff0c4', '#ffd88a', '#f2b45e', '#c8843a')]

    def f(L, n, P):
        u = (P[:, lat] - a0) / (a1 - a0)
        v = (P[:, 2] - z0) / (z1 - z0)
        pr = (((P[:, lat] - a0) / (2 * PH)) % 1) < 0.5
        if acesa:
            r = np.maximum(np.abs(u - 0.5) * 2.2, np.abs(v - 0.32) * 1.5)
            out = np.where((r < 0.5)[:, None], lit[0], np.where((r < 0.85)[:, None], lit[1], np.where((r < 1.15)[:, None], lit[2], lit[3])))
            cort = (u < 0.2 - 0.06 * v) | (u > 0.8 + 0.06 * v)
            cc = np.where(pr[:, None], hx('#b8683a'), hx('#c8783e'))
            out = np.where(cort[:, None], cc, out)
            out = np.where((v > 0.9)[:, None], hx('#8a3a2c'), out)
            return out
        out = np.tile(hx('#262e38'), (len(P), 1))
        out = np.where((v > 0.6)[:, None], hx('#2e3844'), out)
        d = v * 1.5 - u * 1.0
        out = np.where(((d > 0.5) & (d < 0.68))[:, None], hx('#4a5a6a'), out)
        out = np.where(((d > 0.82) & (d < 0.9))[:, None], hx('#3c4a58'), out)
        cort = (u < 0.2 - 0.06 * v) | (u > 0.8 + 0.06 * v)
        out = np.where(cort[:, None], np.where(pr[:, None], hx('#40242a'), hx('#4a2a30')), out)
        return np.where((v > 0.92)[:, None], hx('#3a2024'), out)
    return emissivo(f)


def _janela_m(face, plano, a, z0, w, h, acesa=False, topo='reta', seed=0, grade=3):
    """
    A janela alta na fachada: o vidro um pouco para dentro, a esquadria (travessa do meio dobrada e `grade` colunas), os
    umbrais, a verga de cantaria (reta com cornija, ou com frontao triangular) e o peitoril saliente.
    Devolve o vão (a0, a1, z0, z1) para conferir.
    """
    c = CZ.c
    bx = lambda l0, l1, e0, e1, za, zb: _bx(face, plano, l0, l1, e0, e1, za, zb)
    a0, a1 = a - w / 2, a + w / 2
    lat = _lat(face)
    ov = obj(contorno=not acesa)
    if acesa:
        CZ.luzes.add(ov)
    c.caixa(bx(a0, a1, -0.05, 0.004, z0, z0 + h), mat_vidro_m(lat, a0, a1, z0, z0 + h, acesa, seed), M, ov)
    # a esquadria de cor creme (as barras de 1 px)
    oc = obj(contorno=False)
    cc = liso('#d8cfba')
    zm = z0 + h * 0.5
    c.caixa(bx(a0, a1, 0, 0.022, zm - PZ * 0.9, zm + PZ * 0.9), cc, M, oc)
    for k in range(1, grade):
        lm = a0 + (a1 - a0) * k / grade
        c.caixa(bx(lm - PH * 0.5, lm + PH * 0.5, 0, 0.02, z0, z0 + h), cc, M, oc)
    for fz in (0.25, 0.75):
        zz = z0 + h * fz
        c.caixa(bx(a0, a1, 0, 0.018, zz - PZ * 0.5, zz + PZ * 0.5), cc, M, oc)
    # a moldura de cantaria
    o = obj()
    m = liso(CANT[1])
    mo = liso(CANT[0])
    FR = 0.1
    for b in (bx(a0 - FR, a0, 0, 0.07, z0 - 0.02, z0 + h), bx(a1, a1 + FR, 0, 0.07, z0 - 0.02, z0 + h)):
        c.caixa(b, m, M, o)
    # a verga (e a cornija em cima)
    c.caixa(bx(a0 - FR, a1 + FR, 0, 0.08, z0 + h, z0 + h + 0.15), mo, M, o)
    if topo == 'frontao':
        # o frontão triangular em cima da verga
        zb_ = z0 + h + 0.15
        hh = 0.3
        pts = [_P(face, plano, a0 - FR - 0.08, 0.1, zb_), _P(face, plano, a1 + FR + 0.08, 0.1, zb_), _P(face, plano, a, 0.1, zb_ + hh)]
        _quad(pts, liso(CANT[1]), obj(), _N(face, 0, 1, 0))
        # o miolo escuro do tímpano
        pts2 = [_P(face, plano, a0 - FR + 0.03, 0.105, zb_ + 0.02), _P(face, plano, a1 + FR - 0.03, 0.105, zb_ + 0.02),
                _P(face, plano, a, 0.105, zb_ + hh - 0.1)]
        _quad(pts2, liso('#9a9182'), obj(contorno=False), _N(face, 0, 1, 0))
        # as cornijas inclinadas
        for lg, la in ((a0 - FR - 0.08, a), (a1 + FR + 0.08, a)):
            FF._viga(obj(), _P(face, plano, lg, 0.1, zb_), _P(face, plano, la, 0.1, zb_ + hh), 0.045, liso(CANT[0]))
    else:
        c.caixa(bx(a0 - FR - 0.06, a1 + FR + 0.06, 0.0, 0.13, z0 + h + 0.15, z0 + h + 0.22), mo, M, o)
        # a pedra-chave (mais clara) no meio da verga
        c.caixa(bx(a - 0.08, a + 0.08, 0.07, 0.1, z0 + h, z0 + h + 0.15), liso('#ddd5c3'), M, obj(contorno=False))
    # o peitoril
    c.caixa(bx(a0 - FR - 0.06, a1 + FR + 0.06, 0, 0.12, z0 - 0.1, z0 - 0.02), mo, M, o)
    return (a0 - FR - 0.06, a1 + FR + 0.06, z0 - 0.1, z0 + h + 0.22)


# =====================================================================================================================
# as partes comuns: o corpo de pedra, o soco, os cunhais, a faixa entre os andares, a cornija
# =====================================================================================================================
def _corpo(X0, X1, Y0, Y1, ze, seed=0):
    caixa((X0, X1, Y0, Y1, 0, ze), mat_pedra(seed=seed))


def _soco(X0, X1, Y0, Y1, zs=0.55):
    """O embasamento: blocos grandes e escuros, um pouco para fora, com a cimalha clara em cima."""
    e = 0.05
    caixa((X0 - e, X1 + e, Y0 - e, Y1 + e, 0, zs), mat_pedra(seed=2, alt=0.27, comp=0.55, cores=SOCO, junta='#2e2a24'))
    caixa((X0 - e - 0.03, X1 + e + 0.03, Y0 - e - 0.03, Y1 + e + 0.03, zs, zs + 0.07), liso(CANT[1]))


def _cunhais(X0, X1, Y0, Y1, z0, z1, lados=('+y', '+x', '-y', '-x'), alt=0.31, EV=0.045):
    """Os cunhais: blocos de cantaria clara nas quinas, alternando o lado comprido (fiadas desencontradas)."""
    cm = FF.mat_juntas(list(CANT), lambda P: np.floor((P[:, 2] + 50) / alt).astype(np.int64) * 1000
                       + (np.floor(P[:, 0] * 2 + P[:, 1] * 2)).astype(np.int64) % 7, CANT_J, seed=11)
    for (xa, ya, sx, sy) in ((X1, Y1, 1, 1), (X0, Y1, -1, 1), (X1, Y0, 1, -1), (X0, Y0, -1, -1)):
        k = 0
        z = z0
        while z < z1 - 0.02:
            zt = min(z + alt, z1)
            w1, w2 = (0.5, 0.26) if k % 2 == 0 else (0.26, 0.5)
            xs = sorted((xa - sx * w1, xa + sx * EV))
            ys = sorted((ya - sy * w2, ya + sy * EV))
            caixa((xs[0], xs[1], ys[0], ys[1], z, zt), cm)
            z += alt
            k += 1


def _faixa(X0, X1, Y0, Y1, z, h=0.16, sai=0.08):
    """A faixa de cantaria entre os andares (com o filete em cima)."""
    caixa((X0 - sai, X1 + sai, Y0 - sai, Y1 + sai, z, z + h), {'cima': liso(CANT[1]), '*': mat_cant(seed=3, alt=h, comp=0.8)})
    caixa((X0 - sai - 0.03, X1 + sai + 0.03, Y0 - sai - 0.03, Y1 + sai + 0.03, z + h, z + h + 0.04), liso(CANT[0]))


def _cornija(X0, X1, Y0, Y1, ze, h=0.36, sai=0.16):
    """A cornija de cantaria sob o beiral: o friso, os modilhoes (os dentinhos) e o filete que projeta a sombra."""
    caixa((X0 - 0.07, X1 + 0.07, Y0 - 0.07, Y1 + 0.07, ze - h, ze - h + 0.1), {'cima': liso(CANT[0]), '*': liso(CANT[1])})

    def dent(L, n, P):
        n = np.asarray(n, float)
        lat = P[:, 0] if abs(n[1]) > 0.5 else P[:, 1]
        g = (lat / (4 * PH)) % 1
        return np.where((g < 0.45)[:, None], hx(CANT[1]), hx('#8a8272'))
    caixa((X0 - sai + 0.02, X1 + sai - 0.02, Y0 - sai + 0.02, Y1 + sai - 0.02, ze - h + 0.1, ze - h + 0.2), {'*': emissivo(dent), 'cima': liso(CANT[1])})
    caixa((X0 - sai, X1 + sai, Y0 - sai, Y1 + sai, ze - h + 0.2, ze - 0.02), {'cima': liso(CANT[0]), '*': liso(CANT[2])})


# =====================================================================================================================
# a chamine alta de pedra: o fuste, o corbel, a tampa clara e os potes de barro
# =====================================================================================================================
def _chamine(cx, cy, z0, z1, w=0.78, d=0.7, seed=0):
    x0, x1, y0, y1 = cx - w / 2, cx + w / 2, cy - d / 2, cy + d / 2
    caixa((x0, x1, y0, y1, z0, z1 - 0.34), mat_pedra(seed=seed + 5, alt=0.15, comp=0.3))
    # as tres faixas de cantaria no alto (o corbel que abre)
    caixa((x0 - 0.04, x1 + 0.04, y0 - 0.04, y1 + 0.04, z1 - 0.34, z1 - 0.26), {'cima': liso(CANT[0]), '*': liso(CANT[2])})
    caixa((x0 - 0.08, x1 + 0.08, y0 - 0.08, y1 + 0.08, z1 - 0.26, z1 - 0.12), {'cima': liso(CANT[0]), '*': liso(CANT[1])})
    caixa((x0 - 0.05, x1 + 0.05, y0 - 0.05, y1 + 0.05, z1 - 0.12, z1), {'cima': liso('#9a9282'), '*': liso(CANT[1])})
    caixa((x0 + 0.1, x1 - 0.1, y0 + 0.1, y1 - 0.1, z1, z1 + 0.012), liso('#1c1612'), contorno=False)
    # os dois potes de barro
    for k, xx in enumerate((cx - 0.16, cx + 0.16)):
        o = obj()
        CZ.c.cilindro(xx, cy, 0.09, z1, z1 + 0.34, _redondo(lambda L, n, P: np.tile(hx('#a85a34'), (len(P), 1)), _n_cil(xx, cy)), M, o,
                      lados=12, tampa=True, tampa_mat=liso('#2a1a14'))
        o = obj()
        CZ.c.cilindro(xx, cy, 0.115, z1 + 0.28, z1 + 0.37, _redondo(lambda L, n, P: np.tile(hx('#b86a3c'), (len(P), 1)), _n_cil(xx, cy)), M, o,
                      lados=12, tampa=True, tampa_mat=liso('#2a1a14'))


# =====================================================================================================================
# a lucarna (janelinha no telhado): corpo de pedra, janela, empena com o telhadinho de duas aguas
# =====================================================================================================================
def _lucarna(face, plano, a, ef, ze, p, acesa=False, seed=0, hw=0.5, hwall=0.92, rise=0.46):
    """
    A lucarna numa agua do telhado. face/plano: a parede de baixo daquela agua; `a`: o meio ao longo da parede; `ef`
    (negativo): quanto a frente da lucarna esta para dentro do plano da parede; ze: o beiral na parede; p: o declive.
    O fundo some dentro do telhado (o z-buffer resolve).
    """
    sg = 1 if face[0] == '+' else -1
    zs = ze - p * ef
    z0 = zs - 0.25
    zt = zs + hwall
    zr = zt + rise
    eb = ef - (zr - zs) / p - 0.35
    bx = lambda l0, l1, e0, e1, za, zb: _bx(face, plano, l0, l1, e0, e1, za, zb)
    caixa(bx(a - hw, a + hw, eb, ef, z0, zt), mat_pedra(seed=seed + 3, alt=0.14, comp=0.28))
    # a janela (no plano da frente da lucarna)
    pf = plano + sg * ef
    _janela_m(face, pf, a, zs + 0.14, 0.5, 0.72, acesa=acesa, topo='reta', seed=seed, grade=2)
    # o telhadinho de duas aguas
    pd = rise / hw
    ov = 0.11
    efo = ef + 0.12
    for s in (-1, 1):
        le = a + s * (hw + ov)
        ze_ = zt - ov * pd
        pts = [_P(face, plano, le, efo, ze_), _P(face, plano, le, eb, ze_), _P(face, plano, a, eb, zr), _P(face, plano, a, efo, zr)]
        _agua(pts, seed=seed + int(s) + 9, esp=0.07)
    # a empena (triangulo de pedra) na frente e a cornija inclinada de cantaria
    tri = [_P(face, plano, a - hw, ef, zt), _P(face, plano, a + hw, ef, zt), _P(face, plano, a, ef, zr - 0.1)]
    _quad(tri, mat_pedra(seed=seed + 4, alt=0.14, comp=0.28), obj(), _N(face, 0, 1, 0))
    for s in (-1, 1):
        FF._viga(obj(), _P(face, plano, a + s * (hw + ov), efo, zt - ov * pd), _P(face, plano, a, efo, zr), 0.05, liso(CANT[0]))
    # as cumeeiras
    FF._viga(obj(), _P(face, plano, a, efo, zr + 0.01), _P(face, plano, a, eb + 0.4, zr + 0.01), 0.07, liso(CUME_R))


# =====================================================================================================================
# a luz de ferro (os lampioes do portico): braco, gaiola e o vidro amarelo aceso
# =====================================================================================================================
def _lampiao(cx, cy, z, alto=0.36):
    c = CZ.c
    ferro = liso(FERRO)
    s = 0.075
    caixa((cx - s - 0.02, cx + s + 0.02, cy - s - 0.02, cy + s + 0.02, z, z + 0.04), ferro)
    o = obj()
    for (px, py) in ((cx - s, cy - s), (cx + s, cy - s), (cx - s, cy + s), (cx + s, cy + s)):
        c.caixa((px - 0.012, px + 0.012, py - 0.012, py + 0.012, z + 0.04, z + alto - 0.03), ferro, M, o)
    ov = obj(contorno=False)
    CZ.luzes.add(ov)

    def vidro(L, n, P):
        v = (P[:, 2] - z) / alto
        return np.where((v < 0.5)[:, None], hx('#ffe39a'), hx('#ffcf6e'))
    c.caixa((cx - s + 0.012, cx + s - 0.012, cy - s + 0.012, cy + s - 0.012, z + 0.05, z + alto - 0.04), emissivo(vidro), M, ov)
    # o chapeu (piramide) e o anel
    zc = z + alto - 0.03
    oc = obj()
    for (pts, n) in (([(cx - s - 0.03, cy + s + 0.03, zc), (cx + s + 0.03, cy + s + 0.03, zc), (cx, cy, zc + 0.12)], (0, 0.7, 0.7)),
                     ([(cx + s + 0.03, cy + s + 0.03, zc), (cx + s + 0.03, cy - s - 0.03, zc), (cx, cy, zc + 0.12)], (0.7, 0, 0.7)),
                     ([(cx - s - 0.03, cy - s - 0.03, zc), (cx - s - 0.03, cy + s + 0.03, zc), (cx, cy, zc + 0.12)], (-0.7, 0, 0.7)),
                     ([(cx + s + 0.03, cy - s - 0.03, zc), (cx - s - 0.03, cy - s - 0.03, zc), (cx, cy, zc + 0.12)], (0, -0.7, 0.7))):
        c.face_plana(pts, n, liso('#3a3430'), M, oc)
    caixa((cx - 0.02, cx + 0.02, cy - 0.02, cy + 0.02, zc + 0.12, zc + 0.17), ferro)


# =====================================================================================================================
# o oculo do frontao (a janela redonda com os raios) e a porta dupla grande
# =====================================================================================================================
def _oculo(face, plano, a, z, r=0.42):
    c = CZ.c
    n = _N(face, 0, 1, 0)

    def pt(rr, ang, e):
        return _P(face, plano, a + rr * math.cos(ang), e, z + rr * math.sin(ang))
    angs = np.linspace(0, 2 * math.pi, 28, endpoint=False)
    o = obj()
    c.face_plana([pt(r + 0.1, t, 0.04) for t in angs], n, liso(CANT[0]), M, o)
    # os raios do vitral em cima do vidro escuro (a luz atras: o ceu do sotao)
    lat = _lat(face)
    ov = obj(contorno=False)

    def vid(L, nn, P):
        du = P[:, lat] - a
        dv = P[:, 2] - z
        rr = np.hypot(du, dv)
        th = np.arctan2(dv, du)
        k = (th / (2 * math.pi / 8)) % 1
        dist = np.minimum(k, 1 - k) * (2 * math.pi / 8) * rr
        out = np.where((rr / r < 0.45)[:, None], hx('#33404c'), hx('#27323d'))
        out = np.where((rr / r > 0.45)[:, None] & (((th * 8 / math.pi) % 2) < 1)[:, None], hx('#2c3945'), out)
        out = np.where(((dist < PH * 0.7) & (rr / r > 0.2))[:, None], hx('#d2c9b4'), out)
        out = np.where((np.abs(rr / r - 0.45) < PH * 0.7 / r)[:, None], hx('#d2c9b4'), out)
        return np.where((rr / r < 0.2)[:, None], hx('#c8c0ac'), out)
    c.face_plana([pt(r, t, 0.05) for t in angs], n, emissivo(vid), M, ov)


def _porta_dupla(face, plano, a, z0, w, h, moldura=True, seed=0):
    """A porta dupla grande de madeira escura (almofadas, macanetas de latao), a bandeira de vidro aceso e a moldura de pedra."""
    c = CZ.c
    bx = lambda l0, l1, e0, e1, za, zb: _bx(face, plano, l0, l1, e0, e1, za, zb)
    a0, a1 = a - w / 2, a + w / 2
    z1 = z0 + h
    lat = _lat(face)
    mc = liso(CANT[1])
    mo = liso(CANT[0])
    # os umbrais de cantaria e a verga
    caixa(bx(a0 - 0.2, a0, 0, 0.1, z0, z1 + 0.62), mat_cant(seed=seed, alt=0.3, comp=0.4))
    caixa(bx(a1, a1 + 0.2, 0, 0.1, z0, z1 + 0.62), mat_cant(seed=seed + 1, alt=0.3, comp=0.4))
    caixa(bx(a0 - 0.3, a1 + 0.3, 0, 0.14, z1 + 0.62, z1 + 0.82), mo)
    caixa(bx(a0 - 0.38, a1 + 0.38, 0, 0.2, z1 + 0.82, z1 + 0.95), mo)
    # a porta (duas folhas de almofadas)
    od = obj()
    c.caixa(bx(a0, a1, -0.04, 0.02, z0, z1), FF.mat_porta('#3a2416', a0, a1, z0, z1, 2, lat), M, od)
    oc = obj(contorno=False)
    for s in (-1, 1):
        xm = a + s * 0.1
        c.caixa(bx(xm - 0.025, xm + 0.025, 0.02, 0.07, z0 + h * 0.45, z0 + h * 0.45 + 0.07), liso('#d8b060'), M, oc)
    c.caixa(bx(a - 0.015, a + 0.015, 0.02, 0.04, z0, z1), liso('#2a1a10'), M, oc)
    # a bandeira de vidro aceso (o hall) acima das folhas
    ov = obj(contorno=False)
    CZ.luzes.add(ov)
    c.caixa(bx(a0, a1, -0.04, 0.0, z1, z1 + 0.6), mat_vidro_m(lat, a0, a1, z1, z1 + 0.6, True, seed), M, ov)
    cc = liso('#d8cfba')
    for k in range(1, 6):
        lm = a0 + (a1 - a0) * k / 6
        c.caixa(bx(lm - PH * 0.5, lm + PH * 0.5, 0, 0.02, z1, z1 + 0.6), cc, M, oc)
    c.caixa(bx(a0, a1, 0, 0.02, z1 - PZ, z1 + PZ), liso(FERRO), M, oc)


# =====================================================================================================================
# o telhado de quatro aguas (o corpo central) e o de duas aguas (as alas)
# =====================================================================================================================
def _telhado_4(x0, x1, y0, y1, ze, zr, b, seed=0):
    """Quatro aguas (cumeeira ao longo de y), o mesmo declive nas quatro e o beiral b em volta."""
    wd = x1 - x0
    hl = wd / 2
    p = (zr - ze) / hl
    xm = (x0 + x1) / 2
    yf, yb = y1 - hl, y0 + hl
    zo = ze - b * p
    xa, xb, ya, yc = x0 - b, x1 + b, y0 - b, y1 + b
    cum_f, cum_b = (xm, yf, zr), (xm, yb, zr)
    # frente (+y), costas (-y), leste (+x), oeste (-x)
    _agua([(xa, yc, zo), (xb, yc, zo), cum_f], seed=seed + 1)
    _agua([(xb, ya, zo), (xa, ya, zo), cum_b], seed=seed + 2)
    _agua([(xb, yc, zo), (xb, ya, zo), cum_b, cum_f], seed=seed + 3)
    _agua([(xa, ya, zo), (xa, yc, zo), cum_f, cum_b], seed=seed + 4)
    # as quatro arestas e a cumeeira: pecas de telha de capa
    cm = liso(CUME_R)
    for (pa, pb) in (((xb, yc, zo), cum_f), ((xa, yc, zo), cum_f), ((xb, ya, zo), cum_b), ((xa, ya, zo), cum_b)):
        FF._viga(obj(), (pa[0], pa[1], pa[2] + 0.02), (pb[0], pb[1], pb[2] + 0.02), 0.15, cm)
    FF._viga(obj(), (xm, yb, zr + 0.03), (xm, yf, zr + 0.03), 0.2, cm)
    return p


def _telhado_2(x0, x1, y0, y1, ze, zr, bw, be, bu, seed=0):
    """Duas aguas, cumeeira ao longo de y; bw/be: o beiral do lado oeste/leste; bu: o beiral nas empenas (frente e fundo).
    Devolve o declive. As empenas (triangulos de parede) sao feitas pelo chamador."""
    xm = (x0 + x1) / 2
    p = (zr - ze) / (xm - x0)
    zw, zl = ze - bw * p, ze - be * p
    xa, xb = x0 - bw, x1 + be
    ya, yc = y0 - bu, y1 + bu
    _agua([(xa, yc, zw), (xa, ya, zw), (xm, ya, zr), (xm, yc, zr)], seed=seed + 1)
    _agua([(xb, ya, zl), (xb, yc, zl), (xm, yc, zr), (xm, ya, zr)], seed=seed + 2)
    FF._viga(obj(), (xm, ya, zr + 0.03), (xm, yc, zr + 0.03), 0.2, liso(CUME_R))
    # a testeira inclinada nas empenas (a tabua do rake)
    for (yy, sgn) in ((yc, 1), (ya, -1)):
        FF._viga(obj(), (xa, yy, zw + 0.0), (xm, yy, zr + 0.02), 0.09, liso(FASCIA))
        FF._viga(obj(), (xb, yy, zl + 0.0), (xm, yy, zr + 0.02), 0.09, liso(FASCIA))
    return p


def _empena(face, plano, x0, x1, ze, zr, seed=0):
    """O triangulo de parede da empena (pedra) no plano da fachada, de x0 a x1 sob as duas aguas."""
    xm = (x0 + x1) / 2
    pts = [_P(face, plano, x0, 0.0, ze - 0.001), _P(face, plano, x1, 0.0, ze - 0.001), _P(face, plano, xm, 0.0, zr - 0.13)]
    _quad(pts, mat_pedra(seed=seed), obj(), _N(face, 0, 1, 0))


# =====================================================================================================================
# o CORPO CENTRAL (13 x 18 casas, 7,6 m): dois andares, quatro aguas, frontao com o oculo, lucarnas, tres chamines
# =====================================================================================================================
def _central():
    W, D = 13 * CASA, 18 * CASA
    X0, X1, Y0, Y1 = 0.0, W, 0.3, D                 # leste e oeste rentes (encostam nas alas), a frente rente a pegada
    B = (X0, X1, Y0, Y1)
    XM = (X0 + X1) / 2
    ZE, ZR = 5.45, 7.55
    ZS = 3.02                                       # a faixa entre os andares
    BEI = 0.28
    _corpo(X0, X1, Y0, Y1, ZE, seed=1)
    _soco(X0, X1, Y0, Y1)
    _cunhais(X0, X1, Y0, Y1, 0.6, ZE - 0.34)
    _faixa(X0, X1, Y0, Y1, ZS)
    _cornija(X0, X1, Y0, Y1, ZE)
    JW, HJ1, HJ2 = 0.84, 1.8, 1.4
    Z1, Z2 = 0.95, 3.5
    xs = [XM + 1.95 * k for k in (-2, -1, 0, 1, 2)]       # os cinco vaos da frente e das costas (0,975 ... 8,775)
    acesas = {('+y', 0, 0), ('+y', 4, 1), ('-y', 1, 1), ('-y', 3, 0), ('+x', 0, 1), ('-x', 1, 0)}

    def jan(face, plano, a, k, i):
        z0, h = (Z1, HJ1) if k == 0 else (Z2, HJ2)
        _janela_m(face, plano, a, z0, JW, h, acesa=(face, i, k) in acesas, topo='frontao' if k == 0 else 'reta', seed=i * 3 + k)
    for i, a in enumerate(xs):
        for k in (0, 1):
            if i == 2 and k == 0:
                continue
            jan('+y', Y1, a, k, i)
            jan('-y', Y0, a, k, i)
    _porta_dupla('+y', Y1, xs[2], 0.6, 1.5, 2.35, seed=3)
    # a porta de servico atras (no meio) com dois degraus
    _porta_dupla('-y', Y0, xs[2], 0.6, 1.3, 2.2, seed=5)
    FF.caixa(_bx('-y', Y0, xs[2] - 0.9, xs[2] + 0.9, 0.0, 0.5, 0.0, 0.3), mat_cant(seed=4, alt=0.3, comp=0.5))
    # as laterais: duas janelas por andar na parte que aparece (as de leste e de oeste sao as do fundo, a ala tapa o resto)
    for face, plano in (('+x', X1), ('-x', X0)):
        for i, a in enumerate((Y0 + 1.25, Y0 + 3.1, Y0 + 5.0, Y0 + 6.9, Y0 + 8.8, Y0 + 10.7, Y0 + 12.6)):
            for k in (0, 1):
                jan(face, plano, a, k, i)
    # ---- o telhado de quatro aguas
    p = _telhado_4(X0, X1, Y0, Y1, ZE, ZR, BEI, seed=7)
    # ---- o frontao central (frente +y): o triangulo de pedra, a cornija e as duas aguas do frontinho + o oculo
    hg, pg, og = 1.95, 0.78, 0.2
    zg = ZE + hg * pg
    tri = [(XM - hg + 0.154, Y1, ZE), (XM + hg - 0.154, Y1, ZE), (XM, Y1, zg - 0.12)]
    _quad(tri, mat_pedra(seed=9, alt=0.15, comp=0.3), obj(), (0, 1, 0))
    yfo = Y1 + BEI
    ye = Y1 - 4.4
    for s in (-1, 1):
        xe = XM + s * (hg + og)
        zw = ZE - og * pg
        pts = [(xe, yfo, zw), (xe, ye, zw), (XM, ye, zg), (XM, yfo, zg)]
        _agua(pts, seed=10 + int(s), esp=0.12)
        FF._viga(obj(), (xe, yfo, zw), (XM, yfo, zg), 0.1, liso(CANT[0]))
    FF._viga(obj(), (XM, yfo, zg + 0.02), (XM, ye + 0.6, zg + 0.02), 0.18, liso(CUME_R))
    # o oculo no triangulo e a moldura de cantaria que sobe em volta da base
    _oculo('+y', Y1, XM, ZE + 0.62, 0.42)
    # a cornija horizontal da base do frontao
    caixa((XM - hg - og, XM + hg + og, Y1, Y1 + BEI - 0.02, ZE - 0.02, ZE + 0.02), liso(CANT[0]), contorno=False)
    # ---- as lucarnas: duas de cada lado do frontao (frente), duas nas costas, tres em cada lado
    for a in (1.9, XM + (XM - 1.9)):
        _lucarna('+y', Y1, a, -1.15, ZE, p, acesa=(a < XM), seed=int(a * 10), hw=0.5)
    for a in (1.9, XM + (XM - 1.9)):
        _lucarna('-y', Y0, a, -1.15, ZE, p, acesa=False, seed=int(a * 10) + 3)
    for k, a in enumerate((Y0 + 2.6, Y0 + 5.6, Y0 + 8.6)):
        _lucarna('+x', X1, a, -1.2, ZE, p, acesa=(k == 1), seed=20 + k)
        _lucarna('-x', X0, a, -1.2, ZE, p, acesa=(k == 0), seed=30 + k)
    # ---- as tres chamines altas (nos cantos da cumeeira e no meio das costas)
    _chamine(1.75, Y0 + 3.2, ZE - 0.2, ZR + 1.15, seed=1)
    _chamine(W - 1.75, Y0 + 3.2, ZE - 0.2, ZR + 1.15, seed=2)
    _chamine(XM, Y0 + 1.7, ZE - 0.1, ZR + 0.7, seed=3, w=0.9)
    pegada(X0, X1, Y0, Y1)


# =====================================================================================================================
# a ALA (13 ou 12 x 24 casas, 6,9 m): duas aguas com a cumeeira em y, a empena para a frente com duas janelas
# =====================================================================================================================
def _ala(largura, oeste):
    W, D = largura * CASA, 24 * CASA
    # o lado que encosta no central e rente (sem beiral); o outro tem 0,3 m de folga para o beiral
    X0 = 0.3 if oeste else 0.0
    X1 = W if oeste else W - 0.3
    Y0, Y1 = 0.3, D - 0.3
    XM = (X0 + X1) / 2
    ZE, ZR = 4.8, 6.85
    ZS = 2.62
    bw, be = (0.3, 0.0) if oeste else (0.0, 0.3)
    _corpo(X0, X1, Y0, Y1, ZE, seed=21)
    _soco(X0, X1, Y0, Y1)
    _cunhais(X0, X1, Y0, Y1, 0.6, ZE - 0.34)
    _faixa(X0, X1, Y0, Y1, ZS)
    _cornija(X0, X1, Y0, Y1, ZE)
    JW, HJ1, HJ2 = 0.84, 1.6, 1.3
    Z1, Z2 = 0.85, 3.0
    # frente (+y): cinco janelas por andar
    ls = 1.8 if oeste else 1.7
    xs = [XM + ls * k for k in (-2, -1, 0, 1, 2)]
    acesas_f = {(0, 0), (3, 1), (4, 0)}
    for i, a in enumerate(xs):
        for k in (0, 1):
            z0, h = (Z1, HJ1) if k == 0 else (Z2, HJ2)
            _janela_m('+y', Y1, a, z0, JW, h, acesa=(i, k) in acesas_f, topo='frontao' if k == 0 else 'reta', seed=i + 7 * k)
    # fundo (-y): idem
    for i, a in enumerate(xs):
        for k in (0, 1):
            z0, h = (Z1, HJ1) if k == 0 else (Z2, HJ2)
            _janela_m('-y', Y0, a, z0, JW, h, acesa=(i + k) % 4 == 3, topo='frontao' if k == 0 else 'reta', seed=i + 7 * k + 40)
    # laterais (+x e -x): nove vaos por andar, a cada 1,9 m
    ys = [Y0 + 1.15 + 1.9 * k for k in range(9)]
    luz_l = {('+x', 1, 0), ('+x', 2, 1), ('+x', 5, 0), ('+x', 7, 1), ('-x', 3, 0), ('-x', 6, 1), ('+x', 8, 1)}
    for face, plano in (('+x', X1), ('-x', X0)):
        for i, a in enumerate(ys):
            for k in (0, 1):
                z0, h = (Z1, HJ1) if k == 0 else (Z2, HJ2)
                _janela_m(face, plano, a, z0, JW, h, acesa=(face, i, k) in luz_l, topo='frontao' if k == 0 else 'reta', seed=i + 3 * k + 60)
    # ---- o telhado de duas aguas, as empenas (triangulos de pedra) e as duas janelas de cada empena
    p = _telhado_2(X0, X1, Y0, Y1, ZE, ZR, bw, be, 0.28, seed=33)
    _empena('+y', Y1, X0, X1, ZE, ZR, seed=11)
    _empena('-y', Y0, X0, X1, ZE, ZR, seed=12)
    for face, plano, seed_ in (('+y', Y1, 0), ('-y', Y0, 5)):
        for k, a in enumerate((XM - 1.0, XM + 1.0)):
            _janela_m(face, plano, a, ZE + 0.22, 0.66, 0.9, acesa=(face == '+y' and k == 1), topo='reta', seed=seed_ + k + 80, grade=2)
        # o oculo pequeno no alto da empena
        _oculo(face, plano, XM, ZE + 1.62, 0.2) if False else None
    # a faixa de cantaria que acompanha a empena (o friso triangular)
    # ---- as lucarnas na agua que da para leste (as duas) e uma na de oeste
    for k, a in enumerate((Y0 + 5.2, Y0 + 11.6)):
        _lucarna('+x', X1, a, -0.75, ZE, p, acesa=(k == 1), seed=90 + k)
    for k, a in enumerate((Y0 + 5.2, Y0 + 11.6)):
        _lucarna('-x', X0, a, -0.75, ZE, p, acesa=(k == 0), seed=95 + k)
    # ---- as chamines: uma perto da frente e outra no meio, na cumeeira
    _chamine(XM, Y1 - 2.6, ZE + 0.5, ZR + 1.05, seed=11)
    _chamine(XM, Y0 + 7.4, ZE + 0.5, ZR + 1.05, seed=12)
    pegada(X0, X1, Y0, Y1)


# =====================================================================================================================
# o PORTICO (9 x 9 casas, 5,0 m): laje de marmore, tapete vermelho, quatro colunas, escada de 4 degraus, terraco
# =====================================================================================================================
def _portico():
    c = CZ.c
    W, D = 9 * CASA, 9 * CASA
    XM = W / 2
    YB = 0.3                       # o plano da porta (o fundo do portico)
    YST = -0.75                    # o cotovelo de pedra que fecha a fresta ate a frente do central
    ZP = 0.64                      # o piso do portico
    ZL0, ZL1 = 4.1, 4.5            # a laje do terraco (a face de cima a 4,5 m)
    YPF = 5.55                     # a borda da frente do piso
    YC = 5.1                       # a linha das colunas
    YLF = 5.75                     # a borda da frente da laje
    ZTOP = 5.0
    mm = mat_marmore(seed=1)
    # ---- o cotovelo de pedra de tras (o fundo do portico, com a porta), do chao ate a laje
    caixa((0.0, W, YST, YB, 0.0, ZL0), mat_pedra(seed=41))
    caixa((-0.0, W, YST - 0.0, YB + 0.05, 0.0, 0.55), mat_pedra(seed=42, alt=0.27, comp=0.55, cores=SOCO, junta='#2e2a24'))
    caixa((0.0, W, YB + 0.05, YB + 0.1, 0.55 - 0.0, 0.62), liso(CANT[1]))
    # ---- o piso de marmore (a plataforma) e os degraus
    caixa((0.0, W, YB, YPF, 0.0, ZP), {'*': mm, 'cima': mm})
    caixa((0.0, W, YB, YPF + 0.02, ZP - 0.05, ZP), liso(CANT[1]), contorno=False)
    xs0, xs1 = 0.95, W - 0.95
    for j in range(4):
        zt = ZP - 0.16 * (j + 1)
        caixa((xs0, xs1, YPF, YPF + 0.3 * (j + 1), 0.0, zt), {'*': mat_marmore(seed=2 + j), 'cima': mat_marmore(seed=2 + j)})
    # as paredes baixas (muretas) das laterais, ate 1,3 m, com a capa de cantaria; os pilares de arranque da escada
    for (xa, xb) in ((0.0, 0.42), (W - 0.42, W)):
        caixa((xa, xb, YB, YPF + 0.02, ZP, 1.3), mat_pedra(seed=43 + int(xa), alt=0.17, comp=0.36))
        caixa((xa - 0.04, xb + 0.04, YB, YPF + 0.06, 1.3, 1.4), {'cima': liso(CANT[0]), '*': liso(CANT[1])})
    # a mureta de cada lado da escada (a escada e mais estreita que o piso): sobe e desce
    for (xa, xb) in ((0.0, xs0), (xs1, W)):
        for j in range(4):
            zt = ZP - 0.16 * (j + 1)
            pass
    # ---- o tapete vermelho (do batente ate o fim da escada), com a faixa de ouro nas bordas
    def mat_tapete(face_top):
        def f(L, n, P):
            u = (P[:, 0] - XM) / 0.8
            out = np.tile(hx('#7e1a24'), (len(P), 1))
            borda = np.abs(u) > 0.78
            fio = (np.abs(u) > 0.62) & (np.abs(u) <= 0.7)
            out = np.where(borda[:, None], hx('#d6aa48'), out)
            out = np.where(fio[:, None], hx('#c99a3c'), out)
            los = ((P[:, 1] / 0.3 + np.abs(u) * 1.3) % 1 < 0.2) & (np.abs(u) < 0.5)
            out = np.where(los[:, None], hx('#962232'), out)
            return out
        return emissivo(f)
    tp = mat_tapete(True)
    caixa((XM - 0.8, XM + 0.8, YB + 0.1, YPF + 0.02, ZP, ZP + 0.018), {'cima': tp, '*': liso('#6a1620')}, contorno=False)
    for j in range(4):
        zt = ZP - 0.16 * (j + 1)
        caixa((XM - 0.8, XM + 0.8, YPF + 0.3 * j + 0.0, YPF + 0.3 * (j + 1) + 0.012, zt - 0.0, zt + 0.018),
              {'cima': tp, '*': liso('#6a1620'), 'frente': liso('#7e1a24')}, contorno=False)
    # ---- a porta dupla grande, de madeira escura, com a moldura de pedra (no fundo)
    _porta_dupla('+y', YB, XM, ZP, 1.9, 2.6, seed=9)
    # as pilastras de pedra dos lados da porta
    for s in (-1, 1):
        xp = XM + s * 1.75
        caixa((xp - 0.2, xp + 0.2, YB, YB + 0.12, ZP, ZL0 - 0.02), mat_cant(seed=12 + int(s), alt=0.3, comp=0.4))
        caixa((xp - 0.26, xp + 0.26, YB, YB + 0.17, ZP, ZP + 0.2), liso(CANT[0]))
        caixa((xp - 0.26, xp + 0.26, YB, YB + 0.17, ZL0 - 0.2, ZL0 - 0.02), liso(CANT[0]))
    # ---- as quatro colunas redondas de pedra (base, fuste canelado, capitel jonico estilizado)
    cols = [XM - 2.825, XM - 0.975, XM + 0.975, XM + 2.825]
    for k, cx in enumerate(cols):
        # a base quadrada e o toro
        caixa((cx - 0.38, cx + 0.38, YC - 0.38, YC + 0.38, ZP, ZP + 0.16), {'cima': liso(CANT[0]), '*': mat_cant(seed=20 + k, alt=0.16, comp=0.5)})
        o = obj()
        c.cilindro(cx, YC, 0.31, ZP + 0.16, ZP + 0.3, _redondo(lambda L, n, P: np.tile(hx('#c8bfab'), (len(P), 1)), _n_cil(cx, YC)), M, o,
                   lados=24, tampa=True, tampa_mat=liso(CANT[0]))
        o = obj()
        c.cilindro(cx, YC, 0.27, ZP + 0.3, ZL0 - 0.32, mat_coluna(cx, YC, 0.27, inc=0.0), M, o, lados=24, tampa=False, r1=0.24)
        o = obj()
        c.cilindro(cx, YC, 0.3, ZL0 - 0.32, ZL0 - 0.2, _redondo(lambda L, n, P: np.tile(hx('#c8bfab'), (len(P), 1)), _n_cil(cx, YC)), M, o,
                   lados=24, tampa=True, tampa_mat=liso(CANT[0]))
        # o capitel: o abaco quadrado e as volutas dos lados (dois cilindros achatados)
        caixa((cx - 0.4, cx + 0.4, YC - 0.4, YC + 0.4, ZL0 - 0.2, ZL0 - 0.02), {'cima': liso(CANT[0]), '*': liso(CANT[1])})
        for sx in (-1, 1):
            o = obj()
            c.cilindro(cx + sx * 0.3, YC, 0.07, ZL0 - 0.17, ZL0 - 0.05, _redondo(lambda L, n, P: np.tile(hx('#d4ccb8'), (len(P), 1)), _n_cil(cx + sx * 0.3, YC)), M, o,
                       lados=10, tampa=True, tampa_mat=liso('#a89f8c'))
    # os lampioes de ferro nas colunas do meio e das pontas, do lado que olha para a frente
    for cx in cols:
        caixa((cx - 0.012, cx + 0.012, YC + 0.26, YC + 0.4, 2.4, 2.45), liso(FERRO), contorno=False)
        _lampiao(cx, YC + 0.4, 2.2)
    # ---- a laje do terraco (entablamento na frente e nos lados) e a cornija
    caixa((0.0, W, YST, YLF, ZL0, ZL1), {'cima': mat_marmore(seed=6), '*': mat_cant(seed=30, alt=0.4, comp=0.9), 'baixo': liso('#8a8272')})
    caixa((-0.07, W + 0.07, YST, YLF + 0.07, ZL1 - 0.13, ZL1 - 0.02), {'cima': liso(CANT[0]), '*': liso(CANT[1])}, contorno=True)
    # o friso do entablamento (a faixa de dentinhos na frente e nos lados)
    def dent2(L, n, P):
        n = np.asarray(n, float)
        lat = P[:, 0] if abs(n[1]) > 0.5 else P[:, 1]
        g = (lat / (4 * PH)) % 1
        return np.where((g < 0.5)[:, None], hx(CANT[1]), hx('#9a9282'))
    caixa((-0.04, W + 0.04, YST, YLF + 0.04, ZL1 - 0.26, ZL1 - 0.13), {'*': emissivo(dent2), 'cima': liso(CANT[1])})
    # ---- o balaustre do terraco: os pilares de canto, o corrimao e os balaustres torneados
    ob = obj(contorno=False)
    mb = liso('#cfc7b4')
    mb2 = liso('#e0d8c4')

    def balaustre(x, y):
        c.caixa((x - 0.045, x + 0.045, y - 0.045, y + 0.045, ZL1, ZL1 + 0.42), mb, M, ob)
        c.caixa((x - 0.065, x + 0.065, y - 0.065, y + 0.065, ZL1 + 0.1, ZL1 + 0.24), mb2, M, ob)
    for x in np.arange(0.46, W - 0.4, 0.24):
        balaustre(x, YLF - 0.12)
    for xx in (0.14, W - 0.14):
        for y in np.arange(YST + 0.3, YLF - 0.38, 0.24):
            balaustre(xx, y)
    caixa((0.05, W - 0.05, YLF - 0.2, YLF - 0.04, ZL1 + 0.42, ZTOP), {'cima': liso(CANT[0]), '*': liso(CANT[1])})
    for xx in (0.0, W - 0.28):
        caixa((xx + 0.02, xx + 0.28 - 0.02 + 0.0, YST + 0.1, YLF - 0.04, ZL1 + 0.42, ZTOP), {'cima': liso(CANT[0]), '*': liso(CANT[1])})
    # os pilares de canto (com a bola de pedra em cima) e os intermediarios
    for (px, py) in ((0.14, YLF - 0.12), (W - 0.14, YLF - 0.12)):
        caixa((px - 0.13, px + 0.13, py - 0.13, py + 0.13, ZL1, ZTOP + 0.2), {'cima': liso(CANT[0]), '*': mat_cant(seed=31, alt=0.2, comp=0.3)})
        caixa((px - 0.16, px + 0.16, py - 0.16, py + 0.16, ZTOP + 0.2, ZTOP + 0.27), liso(CANT[0]))
        o = obj()
        c.elipsoide((px, py, ZTOP + 0.4), (0.1, 0.1, 0.1), lambda Pc, N, P: FF._cru_eli(np.tile(hx('#cfc7b4'), (len(P), 1)), N), o)
    for px in (XM,):
        caixa((px - 0.13, px + 0.13, YLF - 0.25, YLF + 0.01, ZL1, ZTOP + 0.12), {'cima': liso(CANT[0]), '*': mat_cant(seed=32, alt=0.2, comp=0.3)})
        caixa((px - 0.16, px + 0.16, YLF - 0.28, YLF + 0.04, ZTOP + 0.12, ZTOP + 0.19), liso(CANT[0]))
    pegada(0.0, W, YST, YPF + 1.2)


# =====================================================================================================================
ITENS = {
    'mansao_central': (13, 18, (0.0, 0.0), _central, {}),
    'mansao_portico': (9, 9, (0.0, 0.0), _portico, {}),
    'mansao_ala_oeste': (13, 24, (0.0, 0.0), lambda: _ala(13, True), {}),
    'mansao_ala_leste': (12, 24, (0.0, 0.0), lambda: _ala(12, False), {}),
}


