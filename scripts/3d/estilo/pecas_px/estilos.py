"""
Os estilos de CHÃO e PAREDE do tabuleiro em pixel art 1:1 (grupo I): madeira, taco, concreto, bloco, cela, selo,
azulejo, carpete, musgo, xadrez, ladrilho, metal, calabouco, terra, grama e os terrenos (estrada, lavoura, cascalho,
pier). O texturas_px.py junta o ESTILOS daqui sozinho.

Tudo é desenhado no TEXEL: 1 texel = 1 px da arte (PH ao longo de x/y, PZ na vertical). O exportador recorta 4 x 4
casas de chão (3 m = 128 texels) e 4 trechos de parede, que o jogo repete; por isso todo padrão aqui é PERIÓDICO em
128 texels (os mapas de peças são montados num toro de 128 x 128 e o ruído usa índices em módulo). Assim a casa 3
emenda com a casa 0 sem costura.

Cada material: um mapa de peças (tábua, ladrilho, pedra...) com a junta de 1 px, o px claro logo depois da junta e o
escuro antes da próxima (o volume de cada peça), a cor de cada peça sorteada numa rampa curta, e manchas grandes em
degraus (sem dither, sem pixel solto).
"""
import os
import sys

_AQUI = os.path.dirname(os.path.abspath(__file__))
for _p in (os.path.join(_AQUI, '..', 'agente_cozinha'), os.path.join(_AQUI, '..', '..', 'codigo')):
    if _p not in sys.path:
        sys.path.insert(0, _p)

import numpy as np                              # noqa: E402
from motor import emissivo, ruido               # noqa: E402
from base_estilo import hx, _tom, PH, PZ        # noqa: E402

W = 128                     # o período: 4 casas = 3 m = 128 texels
HP = 256                    # a altura dos mapas de parede (a parede tem 3,6 m = 189 texels)
ZM = 1 / PZ                 # texels por metro na vertical (52,26)


# =====================================================================================================================
# o texel e o ruído periódico
# =====================================================================================================================
def _uv_chao(P):
    return (np.floor(P[:, 0] / PH + 1e-6).astype(np.int64), np.floor(P[:, 1] / PH + 1e-6).astype(np.int64))


def _uv_parede(P, eixo):
    a = P[:, 0] if eixo == 'x' else P[:, 1]
    return (np.floor(a / PH + 1e-6).astype(np.int64), np.floor(P[:, 2] / PZ + 1e-6).astype(np.int64))


def _h(*a):
    """Sorteio determinístico (0..1) por índices inteiros (já em módulo do período)."""
    return ruido(*[np.asarray(x, float) for x in a])


def _ns(u, v, cel, seed, per_v=True):
    """Ruído suave periódico (valor interpolado) em células de `cel` texels; 128 / cel precisa ser inteiro."""
    nu = W // cel
    A, B = np.asarray(u, float) / cel, np.asarray(v, float) / cel
    i, j = np.floor(A), np.floor(B)
    fa, fb = A - i, B - j
    fa, fb = fa * fa * (3 - 2 * fa), fb * fb * (3 - 2 * fb)

    def r(x, y):
        return ruido(x % nu, (y % nu) if per_v else y, seed)
    return (r(i, j) * (1 - fa) + r(i + 1, j) * fa) * (1 - fb) + (r(i, j + 1) * (1 - fa) + r(i + 1, j + 1) * fa) * fb


def _mancha(u, v, seed, per_v=True, grande=32, pequena=16, mix=0.65):
    return _ns(u, v, grande, seed, per_v) * mix + _ns(u, v, pequena, seed + 7, per_v) * (1 - mix)


def _rampa(cores):
    return np.stack([hx(c) for c in cores])


def _w(cond, a, b):
    return np.where(np.asarray(cond)[:, None], a, b)


# =====================================================================================================================
# os mapas de peças (num toro de W x H texels)
# =====================================================================================================================
class Grade:
    """As peças (id por texel) e, de cada texel, se é junta e se está logo depois/antes de uma."""

    def __init__(self, ids, juntas=None):
        self.ids = ids
        self.H, self.W = ids.shape
        j = (ids != np.roll(ids, 1, 1)) | (ids != np.roll(ids, 1, 0)) if juntas is None else juntas
        self.j = j
        self.jl = np.roll(j, 1, 1) & ~j      # o texel de antes (u - 1) é junta
        self.jr = np.roll(j, -1, 1) & ~j     # o de depois (u + 1)
        self.jd = np.roll(j, 1, 0) & ~j      # o de baixo (v - 1)
        self.ju = np.roll(j, -1, 0) & ~j     # o de cima (v + 1)
        self.extra = {}

    def at(self, u, v):
        uu, vv = u % self.W, np.clip(v, 0, None) % self.H
        o = type('L', (), {})()
        for k in ('ids', 'j', 'jl', 'jr', 'jd', 'ju'):
            setattr(o, k, getattr(self, k)[vv, uu])
        for k, a in self.extra.items():
            setattr(o, k, a[vv, uu])
        o.u, o.v = u, v
        return o


def _ij(Wd=W, H=W):
    v, u = np.mgrid[0:H, 0:Wd]
    return u, v


def g_tabuas(larg, comp, seed, H=W, ponta=True):
    """Tábuas ao longo de u (largura `larg`, comprimento `comp`, que divide 128), as pontas desencontradas."""
    rng = np.random.default_rng(seed)
    u, v = _ij(W, H)
    fila = v // larg
    off = rng.integers(0, comp, H // larg + 1)[fila]
    col = ((u + off) // comp) % (W // comp) if ponta else np.zeros_like(u)
    g = Grade(fila * 1000 + col)
    g.extra['pos'] = (u + off) % comp          # a posição ao longo da tábua (0 = a ponta)
    return g


def g_grade(tu, tv, H=W, junta_u=1, desloc=0):
    """Ladrilhos/blocos de tu x tv texels (tu divide 128); `desloc` desloca as fiadas ímpares (o tijolo amarrado)."""
    u, v = _ij(W, H)
    fila = v // tv
    uu = u + (fila % 2) * desloc
    col = (uu // tu) % (W // tu)
    return Grade(fila * 1000 + col)


def g_espinha(w, L):
    """O taco em espinha de peixe: tacos de w x L (L = n.w); período 2L x 2L (2L divide 128)."""
    P = 2 * L
    ids = np.full((P, P), -1, np.int64)
    ori = np.zeros((P, P), np.int8)
    k_n = P // w
    for k in range(k_n):
        x0 = k * w
        ys, xs = np.mgrid[x0:x0 + w, x0:x0 + L]           # o deitado (ao longo de u)
        ids[ys % P, xs % P] = 2 * k
        ori[ys % P, xs % P] = 0
        ys, xs = np.mgrid[x0 + w:x0 + w + L, x0:x0 + w]   # o em pé (ao longo de v)
        ids[ys % P, xs % P] = 2 * k + 1
        ori[ys % P, xs % P] = 1
    assert (ids >= 0).all()
    rep = W // P
    g = Grade(np.tile(ids, (rep, rep)))
    g.extra['ori'] = np.tile(ori, (rep, rep))
    return g


def g_voronoi(n, seed, H=W, jit=0.75, esticar=1.0):
    """Pedras irregulares: n x (n.H/W) pontos numa grade torta, no toro; esticar > 1 alarga ao longo de u."""
    rng = np.random.default_rng(seed)
    nv = max(1, int(round(n * H / W)))
    cu, cv = W / n, H / nv
    gy, gx = np.mgrid[0:nv, 0:n]
    px = (gx + 0.5 + (rng.random((nv, n)) - 0.5) * jit) * cu
    py = (gy + 0.5 + (rng.random((nv, n)) - 0.5) * jit) * cv
    px, py = px.ravel(), py.ravel()
    u, v = _ij(W, H)
    best = np.full(u.shape, 1e18)
    bid = np.zeros(u.shape, np.int64)
    for k in range(len(px)):
        du = np.abs(u + 0.5 - px[k])
        du = np.minimum(du, W - du) / esticar
        dv = np.abs(v + 0.5 - py[k])
        dv = np.minimum(dv, H - dv)
        d = du * du + dv * dv
        m = d < best
        best = np.where(m, d, best)
        bid = np.where(m, k, bid)
    return Grade(bid)


def g_fiadas(alt, cmin, cmax, seed, H=HP, alts=None):
    """Pedras/blocos em fiadas (parede): cada fiada com peças de cmin..cmax texels, que fecham em 128."""
    rng = np.random.default_rng(seed)
    ids = np.zeros((H, W), np.int64)
    v0, r = 0, 0
    while v0 < H:
        a = alt if alts is None else int(alts[r % len(alts)])
        cortes = []
        tot = 0
        while tot < W:
            c = int(rng.integers(cmin, cmax + 1))
            if W - (tot + c) < cmin:
                c = W - tot
            cortes.append(c)
            tot += c
        pos = np.cumsum([0] + cortes[:-1])
        rot = int(rng.integers(0, W))
        lin = np.zeros(W, np.int64)
        for i, p in enumerate(pos):
            lin[(np.arange(p, p + cortes[i]) + rot) % W] = i
        ids[v0:v0 + a] = r * 1000 + lin
        v0 += a
        r += 1
    return Grade(ids)


def g_bruta(alt, cmin, cmax, seed, H=HP, salto=4):
    """
    A pedra bruta: fiadas de `alt` com peças de cmin..cmax, mas cada pedra sobe/desce até `salto` texels na base
    (come a de baixo), então as fiadas não alinham; o canto de cada pedra é cortado (a pedra arredondada).
    """
    base = g_fiadas(alt, cmin, cmax, seed, H=H)
    rng = np.random.default_rng(seed + 1)
    desl = {int(i): int(rng.integers(0, salto + 1)) for i in np.unique(base.ids)}
    u, v = _ij(W, H)
    fila = v // alt
    dv = v % alt
    off = np.vectorize(desl.get)(base.ids)
    # cada pedra desce `off` texels para dentro da fiada de baixo (no lugar da pedra de baixo, naquela coluna)
    sobe = np.roll(off, -alt, 0)               # o deslocamento da pedra de cima, na mesma coluna
    desce = ((alt - dv) <= sobe) & (fila < (H // alt) - 1)
    ids = np.where(desce, np.roll(base.ids, -alt, 0), base.ids)
    g = Grade(ids)
    # os cantos arredondados: o texel de canto (junta à esquerda e em cima ao mesmo tempo, ou à direita e embaixo) vira junta
    j = g.j | (g.jl & g.ju) | (g.jr & g.ju) | (g.jl & g.jd) | (g.jr & g.jd)
    return Grade(ids, j)


# =====================================================================================================================
# o volume da peça
# =====================================================================================================================
def vol_chao(out, g, junta, luz=1.07, sombra=0.92):
    """No chão: o px claro logo depois da junta (lado de trás, de onde vem a luz), o escuro antes da próxima."""
    out = _w(g.jr | g.ju, _tom(out, sombra), out)
    out = _w(g.jl | g.jd, _tom(out, luz), out)
    return _w(g.j, junta, out)


def vol_parede(out, g, junta, cima=1.1, esq=1.045, baixo=0.92, dir=0.955):
    """Na parede: a fiada de cima e a coluna da esquerda pegam luz, a de baixo e a da direita na sombra."""
    out = _w(g.jr, _tom(out, dir), out)
    out = _w(g.jd, _tom(out, baixo), out)
    out = _w(g.jl, _tom(out, esq), out)
    out = _w(g.ju, _tom(out, cima), out)
    return _w(g.j, junta, out)


def cor_peca(g, pal, seed):
    k = (_h(g.ids * 0.37, seed) * len(pal)).astype(int) % len(pal)
    return pal[k]


def veio(out, u, v, g, larg, seed, ori=None, escuro=0.88, claro=1.06):
    """O veio da madeira: riscas compridas de 1 px ao longo da tábua (2 por tábua), em pedaços."""
    t = u if ori is None else np.where(ori == 0, u, v)
    s = v if ori is None else np.where(ori == 0, v, u)
    fila = (s // larg) % (W // larg)
    gs = s % larg
    o1 = 2 + (_h(fila, g.ids % 997, seed) * max(1, larg - 4)).astype(int)
    o2 = (o1 + larg // 2) % larg
    seg = ((t + (_h(fila, seed + 1) * 16).astype(int)) // 16) % (W // 16)
    r1 = (gs == o1) & (_h(fila, seg, seed + 2) < 0.6)
    seg2 = ((t + 5 + (_h(fila, seed + 3) * 8).astype(int)) // 8) % (W // 8)
    r2 = (gs == o2) & (_h(fila, seg2, seed + 4) < 0.35) & (larg >= 6)
    out = _w(r1 & ~g.j, _tom(out, escuro), out)
    return _w(r2 & ~g.j & ~r1, _tom(out, claro), out)


def no_madeira(out, u, v, g, larg, seed, freq=0.2):
    """O nó: um caroço escuro de 2 px com o anel um tom abaixo, em algumas tábuas."""
    fila = (v // larg) % (W // larg)
    seg = (u // 32) % 4
    tem = _h(fila, seg, seed) < freq
    cu = seg * 32 + 6 + (_h(fila, seg, seed + 1) * 20).astype(int)
    cv = fila * larg + larg // 2
    du, dv = np.abs(u % W - cu), np.abs(v % W - cv)
    anel = tem & (du <= 2) & (dv <= 1) & ~((du == 2) & (dv == 1))
    caro = tem & (du <= 1) & (dv == 0)
    out = _w(anel & ~g.j, _tom(out, 0.86), out)
    return _w(caro & ~g.j, _tom(out, 0.66), out)


def moldura(out, v, z, cor, alt=3):
    """A régua de madeira pintada na parede (a moldura do lambri): embaixo a sombra, em cima a quina clara."""
    c0 = hx(cor)
    out = _w((v >= z) & (v < z + alt), c0, out)
    out = _w(v == z, _tom(c0, 0.8), out)
    out = _w(v == z + alt - 1, _tom(c0, 1.35), out)
    out = _w((v >= z + alt) & (v < z + alt + 2), _tom(out, 0.84), out)
    return out


def com_rodape(parede, cores, alt=5):
    """
    O rodapé desenhado na própria parede (5 texels = 0,09 m, a fileira de cima clara: a quina que pega luz). Vai pintado
    e não como caixa porque a caixa sai 1 px para fora do plano e o recorte do texturas_px (pelo P da peça) perde a
    última coluna de cada trecho: ficava um risco escuro a cada casa.
    """
    c0, ct = hx(cores[0]), hx(cores[1])

    def par(eixo):
        base = parede(eixo)

        def f(L, n, P):
            out = base(L, n, P)
            v = np.floor(P[:, 2] / PZ + 1e-6)
            out = _w(v < alt, c0, out)
            out = _w(v == alt - 1, _tom(ct, 1.15), out)
            out = _w(v == 0, _tom(c0, 0.82), out)
            return _w(v == alt, _tom(out, 0.86), out)
        return emissivo(f)
    return par


# =====================================================================================================================
# os mapas de cada estilo (montados uma vez)
# =====================================================================================================================
_G = {}


def _g(nome, f):
    if nome not in _G:
        _G[nome] = f()
    return _G[nome]


# =====================================================================================================================
# MADEIRA: o assoalho de tábuas (o bar da Sede, o escritório, os quartos do Orfanato)
# parede: lambri de madeira escura até 1 m (com a moldura) e papel de parede listrado verde-escuro
# =====================================================================================================================
MAD_P = _rampa(['#76604f', '#826a57', '#6c5848', '#8b725d'])     # um nogueira acinzentado (não laranja)
MAD_J = hx('#33261e')


def piso_madeira():
    def f(L, n, P):
        u, v = _uv_chao(P)
        g = _g('mad', lambda: g_tabuas(8, 64, 11)).at(u, v)
        out = cor_peca(g, MAD_P, 3.1)
        out = veio(out, u, v, g, 8, 5.0, escuro=0.9, claro=1.05)
        out = no_madeira(out, u, v, g, 8, 9.0, 0.12)
        # o gasto do uso: manchas grandes um tom abaixo / acima
        m = _mancha(u, v, 41)
        out = _w(m > 0.66, _tom(out, 0.95), out)
        out = _w(m < 0.3, _tom(out, 1.03), out)
        return vol_chao(out, g, MAD_J, 1.08, 0.9)
    return emissivo(f)


LAMBRI_Z = 50                 # o alto do lambri em texels (~0,96 m)
PAPEL = hx('#3f5446')         # o papel de parede verde-garrafa
PAPEL_L = hx('#4a6050')
PAPEL_M = hx('#8a8a5e')       # o desenho dourado apagado
LAMB_P = _rampa(['#4e3122', '#553625', '#4a2e20'])


def parede_madeira(eixo):
    def f(L, n, P):
        u, v = _uv_parede(P, eixo)
        uu = u % W
        # o papel: listras de 8 texels em dois tons e, na listra clara, o raminho (losango de 5 px) a cada 16
        lis = (uu // 8) % 2 == 0
        out = _w(lis, PAPEL_L, np.tile(PAPEL, (len(P), 1)))
        out = _w((uu % 8 == 0), _tom(PAPEL, 0.86), out)
        cu, cv = uu % 16 - 4, (v - LAMBRI_Z - 6) % 14 - 6
        alt = ((v - LAMBRI_Z - 6) // 14) % 2
        cu = np.where(alt == 1, (uu + 8) % 16 - 4, cu)
        mot = (np.abs(cu) + np.abs(cv) <= 2) & ~((cu == 0) & (cv == 0))
        out = _w(mot, PAPEL_M, out)
        out = _w(mot & (cv < 0), _tom(PAPEL_M, 0.85), out)
        # o tempo: o papel escurecido em cima e manchas grandes
        m = _mancha(uu, v, 13, per_v=False)
        out = _w(m > 0.68, _tom(out, 0.92), out)
        out = _w(v > 175, _tom(out, 0.9), out)
        # o lambri: tábuas em pé de 8 texels, a junta em V (escura + clara)
        g = _g('lambri', lambda: g_grade(8, HP, H=HP)).at(u, np.zeros_like(v))
        lam = cor_peca(g, LAMB_P, 1.7)
        lam = _w(g.jl, _tom(lam, 1.12), lam)
        lam = _w(g.jr, _tom(lam, 0.88), lam)
        lam = _w(g.j, hx('#24160f'), lam)
        # o veio em pé: riscas compridas
        col = (uu // 8)
        vv = (uu % 8 == 3 + (_h(col, 2.0) * 3).astype(int)) & (_h(col, (v + (_h(col, 4.0) * 20).astype(int)) // 20, 3.0) < 0.55)
        lam = _w(vv & ~g.j, _tom(lam, 0.9), lam)
        out = _w(v < LAMBRI_Z, lam, out)
        return moldura(out, v, LAMBRI_Z, '#4a2d1e')
    return emissivo(f)



# =====================================================================================================================
# TACO: em espinha de peixe (o casarão, o gabinete da Sede, as salas do Orfanato)
# parede: caiada (creme) com o lambri de almofadas em madeira média até 0,9 m
# =====================================================================================================================
TACO_P = _rampa(['#b48d5c', '#a98354', '#bd9766', '#a07a4e', '#b8925f'])     # mel claro (a mesa laranja-escura destaca)
TACO_J = hx('#5e4228')


def piso_taco():
    def f(L, n, P):
        u, v = _uv_chao(P)
        G = _g('taco', lambda: g_espinha(8, 32))
        g = G.at(u, v)
        out = cor_peca(g, TACO_P, 7.3)
        # o veio ao longo do taco (deitado: ao longo de u; em pé: ao longo de v)
        ori = g.ori
        t = np.where(ori == 0, u, v)
        s = np.where(ori == 0, v, u) % 8
        lin = (s == 3 + (_h(g.ids % 997, 1.0) * 2).astype(int))
        seg = (t // 10) % 13
        out = _w(lin & (_h(g.ids % 997, seg, 2.0) < 0.6), _tom(out, 0.9), out)
        lin2 = (s == 6) & (_h(g.ids % 997, (t + 4) // 7 % 19, 3.0) < 0.4)
        out = _w(lin2, _tom(out, 1.06), out)
        m = _mancha(u, v, 23)
        out = _w(m > 0.67, _tom(out, 0.95), out)
        out = _w(m < 0.3, _tom(out, 1.03), out)
        return vol_chao(out, g, TACO_J, 1.08, 0.9)
    return emissivo(f)


CAL = hx('#e6dcc4')
LAMB2 = hx('#8a5a36')
LAMB2_Z = 46


def parede_taco(eixo):
    def f(L, n, P):
        u, v = _uv_parede(P, eixo)
        uu = u % W
        out = np.tile(CAL, (len(P), 1))
        out = _w(v > 110, _tom(CAL, 1.03), out)
        m = _mancha(uu, v, 31, per_v=False, grande=64, pequena=16, mix=0.7)
        out = _w(m > 0.68, _tom(out, 0.975), out)
        out = _w(v > 178, _tom(out, 0.94), out)
        # o lambri de almofadas: o quadro (montante 3 px) e a almofada de 26 x 32 com o chanfro claro/escuro
        pw = 32
        a = uu % pw
        b = v - 4
        quadro = np.tile(LAMB2, (len(P), 1))
        dentro = (a >= 4) & (a < pw - 3) & (b >= 4) & (b < LAMBRI_ALM)
        alm = _tom(LAMB2, 1.06)
        lam = _w(dentro, alm, quadro)
        # o chanfro da almofada: em cima e à esquerda escuro (sombra do quadro), embaixo e à direita claro
        lam = _w(dentro & ((b == LAMBRI_ALM - 1) | (a == 4)), _tom(LAMB2, 0.8), lam)
        lam = _w(dentro & ((b == 4) | (a == pw - 4)), _tom(LAMB2, 1.2), lam)
        # o veio do quadro (riscas na horizontal / vertical) e da almofada
        lam = _w(~dentro & (a < 4) & (a == 1) & ((v // 6) % 3 != 0), _tom(LAMB2, 0.9), lam)
        lam = _w(~dentro & (a >= 4) & ((b == 1) | (b == LAMBRI_ALM + 2)) & (((uu + v) // 7) % 3 != 0), _tom(LAMB2, 0.9), lam)
        lam = _w(dentro & (b % 7 == 3) & (((uu // 5) + (b // 7)) % 3 != 0), _tom(alm, 0.93), lam)
        lam = _w((a == 0), _tom(LAMB2, 0.72), lam)
        out = _w(v < LAMB2_Z, lam, out)
        return moldura(out, v, LAMB2_Z, '#7a4c2c')
    return emissivo(f)


LAMBRI_ALM = 38



# =====================================================================================================================
# CONCRETO: placas de concreto (o salão principal da Sede, a sala de cirurgia)
# parede: reboco pintado, a barra de baixo em tinta a óleo cinza-esverdeada
# =====================================================================================================================
CON_P = _rampa(['#8b8780', '#85817a', '#908c84'])


def _concreto(u, v, pal, junta, seed, placa=64, sujo=0.0):
    g = _g(f'con{placa}', lambda: g_grade(placa, placa)).at(u, v)
    out = cor_peca(g, pal, seed)
    m = _mancha(u, v, seed + 3, grande=32, pequena=8, mix=0.55)
    out = _w(m > 0.64, _tom(out, 0.95), out)
    out = _w(m > 0.76, _tom(out, 0.91), out)
    out = _w(m < 0.3, _tom(out, 1.035), out)
    # o agregado: pontinhos de 2 px (deitados), claros e escuros
    pu, pv = u // 2, v
    pnt = _h(pu % 64, pv % W, seed + 5)
    out = _w((pnt < 0.025), _tom(out, 0.84), out)
    out = _w((pnt > 0.975), _tom(out, 1.08), out)
    if sujo:
        s = _ns(u, v, 32, seed + 11) * 0.6 + _ns(u, v, 16, seed + 12) * 0.4
        out = _w(s > 1 - sujo, _tom(out, 0.82), out)
        out = _w(s > 1 - sujo * 0.55, _tom(out, 0.86), out)
    # a junta de dilatação (1 px escuro + o px claro do corte)
    out = _w(g.jl | g.jd, _tom(out, 1.06), out)
    return _w(g.j, junta, out)


def piso_concreto():
    def f(L, n, P):
        u, v = _uv_chao(P)
        return _concreto(u, v, CON_P, hx('#5c5954'), 3.0)
    return emissivo(f)


def _barra_pintada(u, v, cima, baixo, z_barra, linha, seed):
    uu = u % W
    out = np.tile(cima, (len(u), 1))
    m = _mancha(uu, v, seed, per_v=False, grande=64, pequena=16, mix=0.7)
    out = _w(m > 0.67, _tom(out, 0.975), out)
    out = _w(v > 176, _tom(out, 0.93), out)
    bar = np.tile(baixo, (len(u), 1))
    bar = _w(m > 0.65, _tom(baixo, 0.965), bar)
    bar = _w(m < 0.3, _tom(baixo, 1.025), bar)
    # a tinta descascada perto do chão (manchas claras com a borda escura)
    out = _w(v < z_barra, bar, out)
    out = _w((v >= z_barra) & (v < z_barra + 2), linha, out)
    out = _w(v == z_barra - 1, _tom(baixo, 1.12), out)
    return out


def parede_concreto(eixo):
    def f(L, n, P):
        u, v = _uv_parede(P, eixo)
        out = _barra_pintada(u, v, hx('#c9c4b6'), hx('#6f7d72'), 62, hx('#3e4740'), 17)
        # o reboco: placas grandes com a fissurinha (degrau de tom) e a mancha de umidade embaixo
        um = _ns(u % W, v, 32, 21, per_v=False)
        out = _w((um > 0.62) & (v < 30 + (um * 40).astype(int)) & (v >= 62), _tom(out, 0.93), out)
        return out
    return emissivo(f)


# =====================================================================================================================
# BLOCO: o corredor da Sede (piso de placas quadradas de concreto, parede de blocos de concreto pintados)
# =====================================================================================================================
BLO_P = _rampa(['#7f7d78', '#77756f', '#86837d', '#7b7973'])


def piso_bloco():
    def f(L, n, P):
        u, v = _uv_chao(P)
        g = _g('blo_piso', lambda: g_grade(32, 32)).at(u, v)
        out = cor_peca(g, BLO_P, 4.4)
        m = _mancha(u, v, 51, grande=32, pequena=8, mix=0.5)
        out = _w(m > 0.66, _tom(out, 0.94), out)
        out = _w(m < 0.3, _tom(out, 1.04), out)
        # a trilha gasta no meio do corredor (mais clara e lisa)
        pnt = _h((u // 2) % 64, v % W, 7.7)
        out = _w(pnt < 0.03, _tom(out, 0.86), out)
        return vol_chao(out, g, hx('#4b4945'), 1.09, 0.9)
    return emissivo(f)


def parede_bloco(eixo):
    def f(L, n, P):
        u, v = _uv_parede(P, eixo)
        uu = u % W
        g = _g('blo_par', lambda: g_grade(32, 11, H=HP, desloc=16)).at(u, v)
        baixo = v < 60
        pal = np.where(baixo[:, None], _rampa(['#5f6e66', '#5b6a62', '#63716a'])[(_h(g.ids * 0.37, 2.0) * 3).astype(int) % 3],
                       _rampa(['#b9b6aa', '#b3b0a4', '#bebbb0'])[(_h(g.ids * 0.37, 2.0) * 3).astype(int) % 3])
        # a textura do bloco: furinhos de 2 px escuros
        pnt = _h((uu // 2) % 64, v, 9.1)
        pal = _w(pnt < 0.05, _tom(pal, 0.9), pal)
        m = _mancha(uu, v, 77, per_v=False)
        pal = _w(m > 0.7, _tom(pal, 0.95), pal)
        out = vol_parede(pal, g, np.where(baixo[:, None], hx('#3f4a44'), hx('#8f8c82')), 1.07, 1.03, 0.9, 0.96)
        # a faixa que divide as duas tintas (2 px escuros)
        out = _w((v >= 60) & (v < 62), hx('#38423c'), out)
        out = _w(v > 178, _tom(out, 0.93), out)
        return out
    return emissivo(f)


# =====================================================================================================================
# CELA: a prisão da Sede (concreto sujo, manchado; parede de concreto aparente com os furos da forma e a ferrugem)
# =====================================================================================================================
CELA_P = _rampa(['#7a766d', '#736f67', '#7f7b72'])


def piso_cela():
    def f(L, n, P):
        u, v = _uv_chao(P)
        out = _concreto(u, v, CELA_P, hx('#4a4741'), 8.0, placa=128, sujo=0.32)
        # o ralo no meio (um quadrado de grade escura) numa casa só
        du, dv = u % W - 80, v % W - 80
        ralo = (np.abs(du) <= 4) & (np.abs(dv) <= 4)
        r = _w(((du + 5) % 2 == 0), hx('#2a2622'), hx('#57534c'))
        r = _w((np.abs(du) == 4) | (np.abs(dv) == 4), hx('#9a968c'), r)
        return _w(ralo, r, out)
    return emissivo(f)


def parede_cela(eixo):
    def f(L, n, P):
        u, v = _uv_parede(P, eixo)
        uu = u % W
        # o concreto aparente: as placas da forma (32 x 40), o furo da amarração (2 x 2) nos cantos
        g = _g('cela_par', lambda: g_grade(32, 40, H=HP, desloc=0)).at(u, v)
        pal = _rampa(['#8e897f', '#88837a', '#938e84'])
        out = cor_peca(g, pal, 5.5)
        out = _w(g.jd, _tom(out, 0.93), out)
        out = _w(g.j, _tom(out, 0.86), out)
        fu, fv = uu % 32, v % 40
        furo = ((fu == 7) | (fu == 8) | (fu == 23) | (fu == 24)) & ((fv == 19) | (fv == 20))
        out = _w(furo, hx('#3e3a35'), out)
        out = _w(((fu == 7) | (fu == 8) | (fu == 23) | (fu == 24)) & (fv == 18), _tom(pal[0], 0.9), out)
        # o escorrido: riscas em pé que descem do alto (larg. 2), de comprimentos sorteados
        col = uu // 3
        tem = _h(col % 43, 3.3) < 0.28
        fim = 189 - (20 + _h(col % 43, 4.4) * 120).astype(int)
        esc = tem & (v > fim)
        out = _w(esc, _tom(out, 0.88), out)
        # a ferrugem/sujeira embaixo e as manchas grandes
        m = _mancha(uu, v, 61, per_v=False, grande=32, pequena=8)
        out = _w(m > 0.66, _tom(out, 0.92), out)
        out = _w(v < 16 + (m * 12).astype(int), _tom(out, 0.86), out)
        out = _w(v < 5 + (m * 7).astype(int), out * 0.7 + hx('#5a4a3a') * 0.3, out)
        out = _w(v > 178, _tom(out, 0.9), out)
        return out
    return emissivo(f)


# =====================================================================================================================
# SELO: a Câmara do Selo (lajes de pedra antiga, irregulares; parede de cantaria em fiadas)
# =====================================================================================================================
SELO_P = _rampa(['#a69e88', '#9e9680', '#ada590', '#958d78', '#b2aa94'])


def piso_selo():
    def f(L, n, P):
        u, v = _uv_chao(P)
        g = _g('selo', lambda: g_voronoi(5, 19, jit=0.8)).at(u, v)
        out = cor_peca(g, SELO_P, 2.9)
        m = _mancha(u, v, 33, grande=16, pequena=8, mix=0.5)
        out = _w(m > 0.66, _tom(out, 0.93), out)
        out = _w(m < 0.3, _tom(out, 1.04), out)
        # o desgaste das pedras: cavidades de 2 x 2 escuras
        pnt = _h((u // 2) % 64, (v // 2) % 64, 3.7)
        out = _w(pnt < 0.03, _tom(out, 0.82), out)
        out = vol_chao(out, g, hx('#3b372f'), 1.1, 0.88)
        # a junta mais larga (o rejunte gasto): o px depois da junta também escurece de leve
        return out
    return emissivo(f)


def parede_selo(eixo):
    """
    A cantaria da Câmara do Selo: blocos grandes e claros, bem aparelhados (junta fina), a fiada de base alta, a
    cimalha lisa a ~1,9 m e, em cima, fiadas mais baixas. Antiga: as quinas lascadas e o escorrido do tempo.
    """
    pal = _rampa(['#b8af98', '#b0a790', '#bfb6a0', '#a99f88'])

    def f(L, n, P):
        u, v = _uv_parede(P, eixo)
        uu = u % W
        g = _g('selo_par2', lambda: g_fiadas(22, 40, 64, 5, alts=(26, 22, 24, 22, 8, 16, 16, 16, 16, 16))).at(u, v)
        out = cor_peca(g, pal, 6.6)
        m = _mancha(uu, v, 81, per_v=False, grande=32, pequena=16, mix=0.6)
        out = _w(m > 0.67, _tom(out, 0.95), out)
        out = _w(m < 0.3, _tom(out, 1.03), out)
        # o escorrido antigo: faixas em pé de 2 px, um tom abaixo, descendo das juntas de cima
        col = uu // 2
        esc = (_h(col % 64, 5.1) < 0.12) & (v > 60 + (_h(col % 64, 5.2) * 90).astype(int))
        out = _w(esc, _tom(out, 0.95), out)
        out = vol_parede(out, g, hx('#6e6654'), 1.1, 1.05, 0.9, 0.95)
        # as quinas lascadas: um dente de 2 x 2 escuro no canto de cima de algumas pedras
        G = _G['selo_par2']
        if 'lasca' not in G.extra:
            # o canto de cima à esquerda de cada pedra (2 x 2 texels): a junta esquerda e a de cima se encontram
            jl1, ju1 = G.jl, G.ju
            canto = jl1 & ju1
            las = canto | np.roll(canto, 1, 1) | np.roll(canto, -1, 0) | np.roll(np.roll(canto, 1, 1), -1, 0)
            G.extra['lasca'] = las & ~G.j
        g2 = G.at(u, v)
        lasca = g2.lasca & (_h(g.ids * 0.37, 9.3) < 0.4)
        out = _w(lasca, _tom(out, 0.74), out)
        # a cimalha (a fiada fina de 8): lisa, a quina de cima clara e a sombra embaixo
        cim = (v >= 96) & (v < 104)
        out = _w(cim, hx('#c6bea8'), out)
        out = _w(v == 103, hx('#ddd6c2'), out)
        out = _w(v == 96, hx('#8a826e'), out)
        out = _w((v == 100) & ~((uu % 32) < 2), _tom(hx('#c6bea8'), 0.9), out)
        out = _w((v >= 94) & (v < 96), _tom(out, 0.85), out)
        out = _w(v > 178, _tom(out, 0.9), out)
        return out
    return emissivo(f)


# =====================================================================================================================
# AZULEJO: o laboratório (piso branco clínico 16 x 16, parede de azulejo branco 8 x 8 até 2 m com a faixa verde)
# =====================================================================================================================
AZB_P = _rampa(['#d9dbd6', '#d3d6d0', '#dddfda'])


def piso_azulejo():
    def f(L, n, P):
        u, v = _uv_chao(P)
        g = _g('az_piso', lambda: g_grade(16, 16)).at(u, v)
        out = cor_peca(g, AZB_P, 1.9)
        m = _mancha(u, v, 91, grande=32, pequena=16)
        out = _w(m > 0.7, _tom(out, 0.96), out)
        # o brilho do esmalte: uma risquinha de 2 px no canto de trás de metade das peças
        gu, gv = u % 16, v % 16
        sh = (_h(g.ids * 0.37, 4.0) > 0.5) & (((gu == 3) | (gu == 4)) & (gv == 3))
        out = _w(sh, _tom(out, 1.15), out)
        return vol_chao(out, g, hx('#9da09b'), 1.04, 0.95)
    return emissivo(f)


def _azulejo_parede(u, v, pal, rej, seed, t=8):
    g = _g(f'azp{t}', lambda: g_grade(t, t, H=HP)).at(u, v)
    out = cor_peca(g, pal, seed)
    gu, gv = u % t, v % t
    sh = (_h(g.ids * 0.37, seed + 1) > 0.45) & (gu == 2) & ((gv == t - 2) | (gv == t - 3))
    out = vol_parede(out, g, rej, 1.06, 1.03, 0.93, 0.97)
    return _w(sh, _tom(out, 1.16), out)


def parede_azulejo(eixo):
    def f(L, n, P):
        u, v = _uv_parede(P, eixo)
        tinta = np.tile(hx('#cfd6cf'), (len(P), 1))
        m = _mancha(u % W, v, 37, per_v=False)
        tinta = _w(m > 0.66, _tom(tinta, 0.96), tinta)
        tinta = _w(v > 176, _tom(tinta, 0.93), tinta)
        az = _azulejo_parede(u, v, _rampa(['#e6e8e3', '#e0e3dd', '#eaece7']), hx('#b2b7b1'), 2.0)
        verde = _azulejo_parede(u, v, _rampa(['#5f9387', '#5a8d81', '#64998c']), hx('#3e655c'), 3.0)
        out = _w(v < 104, az, tinta)
        out = _w((v >= 56) & (v < 64), verde, out)               # a faixa verde (1 fiada)
        out = _w((v < 8), verde, out)                             # o rodapé de azulejo verde
        out = _w(v == 104, hx('#f2f3ef'), out)                    # o friso de arremate
        out = _w((v == 105) | (v == 106), _tom(hx('#cfd6cf'), 0.88), out)
        return out
    return emissivo(f)


# =====================================================================================================================
# CARPETE: a sala de tecnologia (placas de carpete 32 x 32 com a trama alternada; parede pintada com a barra cinza)
# =====================================================================================================================
def piso_carpete():
    c0, c1, c2 = hx('#4b5566'), hx('#45505f'), hx('#525d6e')

    def f(L, n, P):
        u, v = _uv_chao(P)
        g = _g('carp', lambda: g_grade(32, 32)).at(u, v)
        alt = ((u // 32) + (v // 32)) % 2 == 0
        t = np.where(alt, u, v)
        s = np.where(alt, v, u)
        # a trama: riscas de 1 px a cada 2, que se quebram (o pelo) — em uma placa deitadas, na outra em pé
        out = np.tile(c0, (len(P), 1))
        out = _w((s % 2 == 0) & (_h(s % W, (t // 3) % 43, 5.0) < 0.55), c1, out)
        out = _w((s % 4 == 1) & (_h(s % W, (t // 5) % 26, 6.0) < 0.3), c2, out)
        m = _mancha(u, v, 15, grande=32, pequena=16)
        out = _w(m > 0.68, _tom(out, 0.93), out)
        # a emenda das placas (sem rejunte: só um tom abaixo)
        return _w(g.j, _tom(c0, 0.86), out)
    return emissivo(f)


def parede_carpete(eixo):
    def f(L, n, P):
        u, v = _uv_parede(P, eixo)
        out = _barra_pintada(u, v, hx('#b9bec0'), hx('#7a8088'), 54, hx('#4a5058'), 27)
        # os painéis acústicos em cima da barra: retângulos de 32 x 44 com o friso
        a, b = u % 32, v - 70
        pain = (b >= 0) & (b < 64) & (a >= 3) & (a < 30)
        out = _w(pain, _tom(hx('#b9bec0'), 0.94), out)
        out = _w(pain & ((b == 63) | (a == 3)), _tom(hx('#b9bec0'), 0.85), out)
        out = _w(pain & ((b == 0) | (a == 29)), _tom(hx('#b9bec0'), 1.08), out)
        return out
    return emissivo(f)


# =====================================================================================================================
# MUSGO: a sala de rituais (lajes de pedra escura com musgo nas juntas e em manchas; parede de pedra com musgo embaixo)
# =====================================================================================================================
MUS_P = _rampa(['#6d6a62', '#66635b', '#74716a', '#5f5c55'])
MUSGO = _rampa(['#4c6234', '#56703a', '#3f5430', '#627c42'])


def _musgo(out, u, v, g, seed, forca, per_v=True, perto=None):
    q = _ns(u % W, v, 16, seed, per_v) * 0.55 + _ns(u % W, v, 8, seed + 1, per_v) * 0.45
    if perto is not None:
        q = q + perto
    lim = 1 - forca
    k = np.digitize(q, [lim, lim + 0.06, lim + 0.13])
    out = _w((k >= 1) & (g.j | g.jl | g.jd | g.jr | g.ju), MUSGO[2], out)
    out = _w(k == 2, MUSGO[0], out)
    out = _w(k == 3, MUSGO[1], out)
    out = _w((k == 3) & ((u + v) % 5 == 0) & (g.ju | g.jl), MUSGO[3], out)
    return out


def piso_musgo():
    def f(L, n, P):
        u, v = _uv_chao(P)
        g = _g('mus', lambda: g_voronoi(6, 29, jit=0.85)).at(u, v)
        out = cor_peca(g, MUS_P, 9.9)
        m = _mancha(u, v, 63, grande=16, pequena=8, mix=0.5)
        out = _w(m > 0.66, _tom(out, 0.92), out)
        out = vol_chao(out, g, hx('#2e2b26'), 1.1, 0.88)
        return _musgo(out, u, v, g, 71, 0.38)
    return emissivo(f)


def parede_musgo(eixo):
    """A pedra média, cinza-esverdeada (fiadas irregulares de pedra de mão), o musgo subindo do chão e em manchas."""
    def f(L, n, P):
        u, v = _uv_parede(P, eixo)
        g = _g('mus_par2', lambda: g_bruta(10, 10, 22, 15, salto=3)).at(u, v)
        out = cor_peca(g, _rampa(['#6e6d5c', '#666554', '#757462', '#5f5e4f']), 4.2)
        m = _mancha(u % W, v, 85, per_v=False, grande=16, pequena=8, mix=0.5)
        out = _w(m > 0.64, _tom(out, 0.92), out)
        out = vol_parede(out, g, hx('#2c2a22'), 1.12, 1.05, 0.88, 0.94)
        # o musgo sobe do chão (forte embaixo), e manchas soltas no alto; a umidade escurece
        perto = np.clip((50 - v) / 100.0, -0.12, 0.3)
        out = _musgo(out, u, v, g, 93, 0.33, per_v=False, perto=perto)
        out = _w(v > 176, _tom(out, 0.88), out)
        return out
    return emissivo(f)


# =====================================================================================================================
# XADREZ: os banheiros (piso xadrez preto e branco 16 x 16; azulejo branco até 1,5 m com a fiada preta de arremate)
# =====================================================================================================================
def piso_xadrez():
    br = _rampa(['#dcd8cc', '#d6d2c6', '#e0dcd1'])
    pr = _rampa(['#2f2d30', '#353336', '#2b292c'])

    def f(L, n, P):
        u, v = _uv_chao(P)
        g = _g('xad', lambda: g_grade(16, 16)).at(u, v)
        claro = ((u // 16) + (v // 16)) % 2 == 0
        k = (_h(g.ids * 0.37, 1.1) * 3).astype(int) % 3
        out = np.where(claro[:, None], br[k], pr[k])
        m = _mancha(u, v, 45, grande=32, pequena=16)
        out = _w(m > 0.7, _tom(out, 0.96), out)
        gu, gv = u % 16, v % 16
        sh = ((gu == 3) | (gu == 4)) & (gv == 3)
        out = _w(sh & claro, _tom(out, 1.1), out)
        out = _w(sh & ~claro, _tom(out, 1.5), out)
        out = _w((g.jl | g.jd) & claro, _tom(out, 1.04), out)
        out = _w((g.jl | g.jd) & ~claro, _tom(out, 1.3), out)
        return _w(g.j, hx('#8d897f'), out)
    return emissivo(f)


def parede_xadrez(eixo):
    def f(L, n, P):
        u, v = _uv_parede(P, eixo)
        tinta = np.tile(hx('#d9d3bf'), (len(P), 1))
        m = _mancha(u % W, v, 57, per_v=False)
        tinta = _w(m > 0.64, _tom(tinta, 0.95), tinta)
        tinta = _w(v > 176, _tom(tinta, 0.92), tinta)
        az = _azulejo_parede(u, v, _rampa(['#e8e5da', '#e2dfd4', '#ece9df']), hx('#b6b1a3'), 4.0)
        pr = _azulejo_parede(u, v, _rampa(['#343236', '#2f2d31', '#39373b']), hx('#6a6660'), 5.0)
        # a umidade: manchas amareladas no azulejo de baixo
        az = _w((m > 0.72) & (v < 24), _tom(az, 0.93), az)
        out = _w(v < 80, az, tinta)
        out = _w((v >= 72) & (v < 80), pr, out)
        out = _w(v < 8, pr, out)
        out = _w((v == 80) | (v == 81), _tom(hx('#d9d3bf'), 0.86), out)
        return out
    return emissivo(f)


# =====================================================================================================================
# LADRILHO: a enfermaria da Sede (ladrilho octogonal branco com o tento verde-escuro; barra a óleo verde-hospital)
# =====================================================================================================================
def piso_ladrilho():
    br = _rampa(['#d8d6cb', '#d2d0c5', '#dddbd0'])
    verde = hx('#3f6a5c')

    def f(L, n, P):
        u, v = _uv_chao(P)
        T = 16
        gu, gv = u % T, v % T
        # a distância até o canto mais perto (o tento em losango no cruzamento das peças)
        du = np.minimum(gu, T - gu)
        dv = np.minimum(gv, T - gv)
        tento = (du + dv) <= 4
        borda_t = (du + dv) == 5
        ids = ((u // T) % (W // T)) * 100 + (v // T) % (W // T)
        k = (_h(ids * 0.37, 2.2) * 3).astype(int) % 3
        out = br[k]
        m = _mancha(u, v, 47, grande=32, pequena=16)
        out = _w(m > 0.7, _tom(out, 0.96), out)
        out = _w((gu == 1) | (gv == 1), _tom(out, 1.04), out)
        out = _w(((gu == T - 1) | (gv == T - 1)) & ~tento, _tom(out, 0.95), out)
        out = _w((gu == 0) | (gv == 0), hx('#a9a69b'), out)
        t = np.tile(verde, (len(P), 1))
        t = _w((du + dv == 4) & ((gu < 8) ^ (gv < 8)), _tom(verde, 1.18), t)
        out = _w(tento, t, out)
        out = _w(borda_t, hx('#9a978c'), out)
        return out
    return emissivo(f)


def parede_ladrilho(eixo):
    def f(L, n, P):
        u, v = _uv_parede(P, eixo)
        out = _barra_pintada(u, v, hx('#e3e0d3'), hx('#7fa595'), 76, hx('#3f6a5c'), 49)
        out = _w((v >= 76) & (v < 78), hx('#3f6a5c'), out)
        return out
    return emissivo(f)


# =====================================================================================================================
# METAL: o arsenal (chapa xadrez de aço em placas de 64; parede de chapas rebitadas com o rodapé zebrado)
# =====================================================================================================================
def piso_metal():
    c0 = hx('#6e7276')

    def f(L, n, P):
        u, v = _uv_chao(P)
        g = _g('met', lambda: g_grade(64, 64)).at(u, v)
        out = cor_peca(g, _rampa(['#6e7276', '#6a6e72', '#73777b']), 3.3)
        m = _mancha(u, v, 49, grande=32, pequena=16)
        out = _w(m > 0.66, _tom(out, 0.93), out)
        out = _w(m < 0.28, _tom(out, 1.05), out)
        # o relevo da chapa xadrez: grãos de 3 x 1 em células de 6, deitados e em pé alternados (claro + sombra)
        cu, cv = u % 8, v % 8
        alt = ((u // 8) + (v // 8)) % 2 == 0
        grao_h = alt & (cv == 3) & (cu >= 2) & (cu <= 5)
        grao_v = ~alt & (cu == 3) & (cv >= 2) & (cv <= 5)
        somb_h = alt & (cv == 4) & (cu >= 2) & (cu <= 5)
        somb_v = ~alt & (cu == 4) & (cv >= 2) & (cv <= 5)
        out = _w(somb_h | somb_v, _tom(out, 0.8), out)
        out = _w(grao_h | grao_v, _tom(out, 1.22), out)
        # os parafusos nos cantos da chapa (2 x 2)
        pu, pv = u % 64, v % 64
        paraf = ((pu >= 3) & (pu <= 4) | (pu >= 59) & (pu <= 60)) & ((pv >= 3) & (pv <= 4) | (pv >= 59) & (pv <= 60))
        out = _w(paraf, hx('#4a4d50'), out)
        out = _w(paraf & ((pu == 3) | (pu == 59)) & ((pv == 3) | (pv == 59)), hx('#a9adb0'), out)
        return vol_chao(out, g, hx('#2e3134'), 1.12, 0.86)
    return emissivo(f)


def parede_metal(eixo):
    def f(L, n, P):
        u, v = _uv_parede(P, eixo)
        uu = u % W
        g = _g('met_par', lambda: g_grade(32, 64, H=HP)).at(u, np.maximum(v - 14, 0))
        out = cor_peca(g, _rampa(['#5b6458', '#566052', '#606a5c']), 8.8)
        m = _mancha(uu, v, 87, per_v=False, grande=64, pequena=16, mix=0.7)
        out = _w(m > 0.67, _tom(out, 0.95), out)
        out = _w(m < 0.3, _tom(out, 1.03), out)
        out = vol_parede(out, g, hx('#2b302a'), 1.12, 1.06, 0.86, 0.93)
        # os rebites: uma fileira de 2 x 2 perto da junta de cima e da de baixo, a cada 8
        gv = (v - 14) % 64
        reb = (uu % 8 >= 3) & (uu % 8 <= 4) & ((gv == 3) | (gv == 4) | (gv == 59) | (gv == 60))
        out = _w(reb, _tom(out, 0.78), out)
        out = _w(reb & (uu % 8 == 3) & ((gv == 4) | (gv == 60)), _tom(out, 1.5), out)
        # o rodapé zebrado (amarelo e preto, em diagonal) com o friso
        zeb = ((uu + v) // 6) % 2 == 0
        z = _w(zeb, hx('#c49a2c'), hx('#2a2826'))
        z = _w(m > 0.66, _tom(z, 0.9), z)
        out = _w(v < 12, z, out)
        out = _w((v == 12) | (v == 13), hx('#3a3e38'), out)
        out = _w(v > 178, _tom(out, 0.9), out)
        return out
    return emissivo(f)


# =====================================================================================================================
# CALABOUÇO: o calabouço da fazenda (pedra escura e úmida: o chão de pedras redondas com poças; a parede bruta)
# =====================================================================================================================
CAL_P = _rampa(['#4f4a43', '#48443d', '#56514a', '#433f39'])


def piso_calabouco():
    def f(L, n, P):
        u, v = _uv_chao(P)
        g = _g('calab', lambda: g_voronoi(9, 37, jit=0.8)).at(u, v)
        out = cor_peca(g, CAL_P, 5.7)
        out = vol_chao(out, g, hx('#1f1c19'), 1.16, 0.84)
        # as poças: manchas grandes escuras e frias, com o reflexo (riscas claras de 3 px)
        q = _ns(u, v, 32, 101) * 0.65 + _ns(u, v, 16, 102) * 0.35
        poca = q > 0.64
        out = _w(poca, out * 0.78 + hx('#20262a') * 0.22, out)
        out = _w(q > 0.7, out * 0.85 + hx('#1a2024') * 0.15, out)
        refl = (q > 0.66) & ((v % 7) == 2) & (((u + v // 7 * 3) % 11) < 3)
        out = _w(refl, hx('#6c7478'), out)
        # o brilho molhado no alto das pedras (2 px)
        out = _w(g.jl & g.jd.__invert__() & (_h(g.ids * 0.37, 8.0) < 0.5), _tom(out, 1.1), out)
        return out
    return emissivo(f)


def parede_calabouco(eixo):
    """
    A pedra bruta do calabouço: pedras irregulares (sem fiada), largas e escuras, a junta funda; molhada: o brilho
    no alto de algumas pedras, os escorridos esverdeados e a base encharcada.
    """
    def f(L, n, P):
        u, v = _uv_parede(P, eixo)
        uu = u % W
        g = _g('calab_par3', lambda: g_bruta(14, 14, 34, 25)).at(u, v)
        out = cor_peca(g, _rampa(['#4a453e', '#423e37', '#524c44', '#3c3832', '#57514a']), 7.4)
        m = _mancha(uu, v, 111, per_v=False, grande=16, pequena=8, mix=0.5)
        out = _w(m > 0.64, _tom(out, 0.88), out)
        # a pedra abaulada: 2 px de luz no alto e 2 de sombra embaixo
        out = vol_parede(out, g, hx('#15130f'), 1.16, 1.06, 0.8, 0.9)
        # o brilho molhado no alto de algumas pedras (riscas de 3 px)
        br = g.ju & (_h(g.ids * 0.37, 3.3) < 0.4) & ((uu % 7) < 3)
        out = _w(br, hx('#7a7a72'), out)
        # os escorridos (largura 2), escuros e esverdeados
        col = uu // 2
        tem = _h(col % 64, 1.3) < 0.2
        ini = 189 - (_h(col % 64, 2.6) * 120).astype(int)
        comp = 16 + (_h(col % 64, 3.9) * 50).astype(int)
        esc = tem & (v < ini) & (v > ini - comp)
        out = _w(esc, out * 0.78 + hx('#22302a') * 0.22, out)
        # a base encharcada (até ~0,4 m, borda irregular) e o limo
        base = v < 14 + (m * 16).astype(int)
        out = _w(base, out * 0.75 + hx('#1e2a1c') * 0.25, out)
        out = _w(v > 176, _tom(out, 0.82), out)
        return out
    return emissivo(f)


# =====================================================================================================================
# TERRA: o celeiro (chão de terra batida com palha; parede de tábuas largas em pé, com as frestas e a mata-junta)
# =====================================================================================================================
TERRA_P = _rampa(['#7e6248', '#755a42', '#876a4e', '#6c533d'])


def _terra(u, v, P, base, seed, pedras=0.0, palha=0.0):
    """A terra batida: manchas grandes em 4 tons; pedrinhas e fiapos de palha carimbados na tela (>= 2 px)."""
    q = _ns(u, v, 32, seed) * 0.55 + _ns(u, v, 16, seed + 1) * 0.3 + _ns(u, v, 8, seed + 2) * 0.15
    k = np.digitize(q, [0.36, 0.5, 0.63])
    out = base[np.array([3, 1, 0, 2])[k]]
    if pedras:
        out = _carimbo(out, u, v, P, 16, seed + 3, pedras, PEDRINHA,
                       {'a': hx('#bdb4a2'), 'b': hx('#958c7c'), 's': _tom(base[3], 0.8)})
        out = _carimbo(out, u, v, P, 8, seed + 4, pedras * 0.6, PEDRINHA_P,
                       {'a': hx('#ada593'), 'b': hx('#857d6e'), 's': _tom(base[3], 0.82)})
    if palha:
        out = _carimbo(out, u, v, P, 16, seed + 5, palha, FIAPO,
                       {'a': hx('#d2b366'), 'b': hx('#a8873f'), 's': _tom(base[3], 0.84)})
        out = _carimbo(out, u, v, P, 16, seed + 6, palha * 0.8, FIAPO2,
                       {'a': hx('#c8a65a'), 'b': hx('#9a7a38'), 's': _tom(base[3], 0.84)})
    return out


def piso_terra():
    def f(L, n, P):
        u, v = _uv_chao(P)
        return _terra(u, v, P, TERRA_P, 121, 0.12, 0.45)
    return emissivo(f)


def parede_terra(eixo):
    pal = _rampa(['#6e5a48', '#665343', '#75604d', '#5f4d3e'])

    def f(L, n, P):
        u, v = _uv_parede(P, eixo)
        uu = u % W
        g = _g('celeiro', lambda: g_grade(16, HP, H=HP)).at(u, np.zeros_like(v))
        out = cor_peca(g, pal, 12.3)
        col = uu // 16
        # o veio em pé, comprido
        for k, o in ((0.88, 5), (1.07, 10)):
            vv = (uu % 16 == o + (_h(col, o) * 3).astype(int)) & (_h(col, (v + (_h(col, o + 1) * 30).astype(int)) // 30, o + 2) < 0.6)
            out = _w(vv, _tom(out, k), out)
        out = _w(g.jl, _tom(out, 1.1), out)
        out = _w(g.jr, _tom(out, 0.86), out)
        # a fresta (2 px escuros) e a mata-junta por cima a cada outra tábua
        out = _w(g.j | (uu % 16 == 15), hx('#1e1610'), out)
        mj = (uu % 32 >= 30) | (uu % 32 <= 1)
        out = _w(mj, hx('#7c6650'), out)
        out = _w(mj & (uu % 32 == 30), _tom(hx('#7c6650'), 1.12), out)
        out = _w(mj & (uu % 32 == 1), _tom(hx('#7c6650'), 0.82), out)
        # a travessa (a tábua deitada a 1,1 m) e os pregos
        tr = (v >= 54) & (v < 62)
        out = _w(tr, _tom(hx('#7c6650'), 0.97), out)
        out = _w(v == 61, _tom(hx('#7c6650'), 1.12), out)
        out = _w(v == 54, _tom(hx('#7c6650'), 0.78), out)
        m = _mancha(uu, v, 131, per_v=False, grande=32, pequena=8)
        out = _w(m > 0.68, _tom(out, 0.92), out)
        out = _w(v < 6 + (m * 8).astype(int), _tom(out, 0.82), out)
        return out
    return emissivo(f)


# =====================================================================================================================
# GRAMA (ao ar livre): a grama do casarão (manchas em 4 tons, os tufos claros e umas florzinhas)
# =====================================================================================================================
GRAMA = _rampa(['#86a84a', '#90b250', '#9bbb58', '#7c9e44'])


def _tela_rel(P, cu, cv):
    """O deslocamento em px da TELA do ponto até o texel (cu, cv) do chão (um texel do chão é um losango de 2 x 1 px)."""
    du, dv = P[:, 0] / PH - cu - 0.5, P[:, 1] / PH - cv - 0.5
    return np.floor(du - dv + 0.5).astype(int), np.floor((du + dv) / 2 + 0.5).astype(int)


def _na_tela(u, v, cel, seed, dens, P=None):
    """
    Um enfeite por célula de `cel` texels (alguns), e o deslocamento do texel até ele EM PX DA TELA: no chão um px da
    tela pega só um texel a cada dois, então o desenho miúdo (tufo, flor) é feito na tela: dx = du - dv, dy = (du+dv)/2.
    """
    n = W // cel
    ci, cj = (u // cel) % n, (v // cel) % n
    cid = ci * n + cj
    tem = _h(cid, seed) < dens
    m = max(1, cel - 6)
    cu = 3 + (_h(cid, seed + 1) * m).astype(int)
    cv = 3 + (_h(cid, seed + 2) * m).astype(int)
    dx, dy = _tela_rel(P, u - u % cel + cu, v - v % cel + cv)
    return tem, dx, dy, cid


# os carimbos (desenhados na tela, a base no meio da última linha): '.' nada; as letras são as cores do dicionário
PEDRINHA = ['.aa.', 'abbb', '.sss']
PEDRINHA_P = ['aa', 'bs']
FIAPO = ['...aa', '.aab.', 'ab...', 's....']
FIAPO2 = ['aa...', '.baa.', '...ab', '....s']
TUFO = ['..a....a.', 'a..a..ab.', '.a.ab.b..', '.bab.bba.', '..bbbbb..', '.sssssss.']
TUFO_P = ['a..a.', '.ab.a', '.bbb.', 'sssss']
FLOR = ['aa', 'aa', 'ss']


def _carimbo(out, u, v, P, cel, seed, dens, molde, cores, espelha=True):
    """Um desenho pequeno (molde) por célula, em px da tela, espelhado ao acaso; nunca pixel solto."""
    h, w = len(molde), len(molde[0])
    margem = max(3, (max(h, w) + 3) // 2 + 1)
    n = W // cel
    ci, cj = (u // cel) % n, (v // cel) % n
    cid = ci * n + cj
    tem = _h(cid, seed) < dens
    m = max(1, cel - 2 * margem)
    cu = margem + (_h(cid, seed + 1) * m).astype(int)
    cv = margem + (_h(cid, seed + 2) * m).astype(int)
    dx, dy = _tela_rel(P, u - u % cel + cu, v - v % cel + cv)
    if espelha:
        dx = np.where(_h(cid, seed + 3) < 0.5, dx, -dx)
    col = dx + w // 2
    lin = dy + h - 1
    dentro = tem & (col >= 0) & (col < w) & (lin >= 0) & (lin < h)
    arr = np.array([list(r) for r in molde])
    ch = np.full(len(u), '.', dtype='<U1')
    ch[dentro] = arr[lin[dentro], col[dentro]]
    for k, c in cores.items():
        out = _w(ch == k, c, out)
    return out


def piso_grama():
    """A grama da fazenda abandonada: seca, oliva e palha, com touceiras altas amareladas e florzinhas raras."""
    pal = _rampa(['#6a7040', '#767b46', '#82844c', '#8e8b52', '#9a9458'])

    def f(L, n, P):
        u, v = _uv_chao(P)
        q = _ns(u, v, 64, 141) * 0.45 + _ns(u, v, 32, 142) * 0.35 + _ns(u, v, 16, 143) * 0.2
        k = np.digitize(q, [0.4, 0.5, 0.6, 0.68])
        out = pal[k]
        # as manchas de capim seco (palha) e as de terra aparecendo
        sec = _ns(u, v, 32, 147) * 0.6 + _ns(u, v, 16, 148) * 0.4
        out = _w(sec > 0.66, hx('#a49a62'), out)
        out = _w(sec > 0.74, hx('#aea46a'), out)
        out = _w(sec < 0.24, hx('#7c6a48'), out)
        out = _carimbo(out, u, v, P, 16, 151, 0.55, TUFO_P,
                       {'a': hx('#a8a464'), 'b': hx('#86884e'), 's': hx('#565c34')})
        out = _carimbo(out, u, v, P, 32, 157, 0.7, TUFO,
                       {'a': hx('#d2c27e'), 'b': hx('#a8a062'), 's': hx('#545a32')})
        out = _carimbo(out, u, v, P, 32, 159, 0.5, TUFO,
                       {'a': hx('#bcb070'), 'b': hx('#929052'), 's': hx('#545a32')})
        # as florzinhas (bloco de 2 x 2 na tela com a sombra embaixo): amarela e branca, raras
        out = _carimbo(out, u, v, P, 32, 161, 0.3, FLOR, {'a': hx('#e8cc50'), 's': hx('#545a32')}, espelha=False)
        out = _carimbo(out, u, v, P, 32, 165, 0.25, FLOR, {'a': hx('#ece6d4'), 's': hx('#545a32')}, espelha=False)
        return out
    return emissivo(f)


def parede_reboco(eixo, cor='#cfc4ad'):
    """Para os estilos de fora (sem parede no jogo): um reboco simples, caso algum cômodo os use."""
    def f(L, n, P):
        u, v = _uv_parede(P, eixo)
        out = np.tile(hx(cor), (len(P), 1))
        m = _mancha(u % W, v, 171, per_v=False, grande=64, pequena=16, mix=0.7)
        out = _w(m > 0.67, _tom(out, 0.975), out)
        out = _w(v < 10 + (m * 8).astype(int), _tom(out, 0.86), out)
        return out
    return emissivo(f)


# =====================================================================================================================
# TERRENOS: estrada (terra com cascalho), lavoura (sulcos arados), cascalho, píer (tábuas com frestas)
# =====================================================================================================================
def piso_estrada():
    base = _rampa(['#ad8a5e', '#a28056', '#b69466', '#987650'])

    def f(L, n, P):
        u, v = _uv_chao(P)
        return _terra(u, v, P, base, 181, pedras=0.3)
    return emissivo(f)


def piso_lavoura():
    c = _rampa(['#76502e', '#825a36', '#8e6640', '#664428', '#56381f'])
    perfil = np.array([4, 4, 3, 3, 0, 1, 1, 2, 2, 2, 2, 2, 3, 3, 4, 4])     # o sulco (16): fundo, a encosta clara, o alto

    def f(L, n, P):
        u, v = _uv_chao(P)
        g = v % 16
        out = c[perfil[g]]
        q = _ns(u, v, 32, 191)
        out = _w(q > 0.64, _tom(out, 0.93), out)
        # os torrões: 2 px claros no alto do leirão
        tor = ((g == 4) | (g == 5)) & (_h((u // 3) % 43, v // 16 % 8, 193) < 0.2)
        out = _w(tor & (g == 4), _tom(c[0], 1.1), out)
        # a muda no alto de cada leirão, a cada 16 (desenhada na tela: 2 folhas e o caule)
        dx, dy = _tela_rel(P, u - u % 16 + 8, v - g + 8)
        tem = _h((u // 16) % 8, (v // 16) % 8, 195) < 0.75
        out = _w(tem & (dy == 0) & (np.abs(dx) <= 1), _tom(c[3], 0.9), out)
        out = _w(tem & (dy == -1) & (dx == 0), hx('#5e8a34'), out)
        out = _w(tem & (dy == -2) & ((dx == -1) | (dx == 1)), hx('#7aa844'), out)
        out = _w(tem & (dy == -2) & (dx == 0), hx('#5e8a34'), out)
        return out
    return emissivo(f)


def piso_cascalho():
    pal = _rampa(['#9a948a', '#8c867c', '#a7a196', '#7f796f', '#b0aa9e'])

    def f(L, n, P):
        u, v = _uv_chao(P)
        g = _g('casc', lambda: g_voronoi(14, 201, jit=0.9)).at(u, v)
        out = cor_peca(g, pal, 2.1)
        out = vol_chao(out, g, hx('#4e483f'), 1.14, 0.84)
        q = _ns(u, v, 32, 203)
        return _w(q > 0.66, _tom(out, 0.93), out)
    return emissivo(f)


def piso_pier():
    pal = _rampa(['#8a7a66', '#7f705d', '#94846f', '#76685a'])

    def f(L, n, P):
        u, v = _uv_chao(P)
        g = _g('pier', lambda: g_tabuas(8, 64, 211)).at(u, v)
        out = cor_peca(g, pal, 4.9)
        out = veio(out, u, v, g, 8, 7.0, escuro=0.9, claro=1.0)
        m = _mancha(u, v, 213, grande=64, pequena=16, mix=0.7)
        out = _w(m > 0.66, _tom(out, 0.94), out)
        # os pregos: 2 texels escuros perto da ponta de cada tábua
        pr = ((g.pos == 3) | (g.pos == 4)) & ((v % 8 == 3) | (v % 8 == 6))
        out = _w(pr & ~g.j, hx('#4a3e32'), out)
        out = _w(g.jl | g.jd, _tom(out, 1.08), out)
        # a fresta entre as tábuas: 1 px escuro (a água lá embaixo)
        return _w(g.j, hx('#1c2a30'), out)
    return emissivo(f)


# =====================================================================================================================
RDP_MAD = ('#3a2418', '#5e3c28')
RDP_TACO = ('#6e4026', '#8a5434')
_R = com_rodape

# 'rodape' fica None: o rodapé vai pintado na parede (com_rodape), veja a nota lá.
ESTILOS = {
    'madeira': {'piso': piso_madeira, 'parede': _R(parede_madeira, RDP_MAD), 'rodape': None, 'extra': None},
    'taco': {'piso': piso_taco, 'parede': _R(parede_taco, RDP_TACO), 'rodape': None, 'extra': None},
    'concreto': {'piso': piso_concreto, 'parede': _R(parede_concreto, ('#3e4740', '#56625a')), 'rodape': None, 'extra': None},
    'bloco': {'piso': piso_bloco, 'parede': _R(parede_bloco, ('#3a3c3a', '#545654')), 'rodape': None, 'extra': None},
    'cela': {'piso': piso_cela, 'parede': parede_cela, 'rodape': None, 'extra': None},
    'selo': {'piso': piso_selo, 'parede': parede_selo, 'rodape': None, 'extra': None},
    'azulejo': {'piso': piso_azulejo, 'parede': parede_azulejo, 'rodape': None, 'extra': None},
    'carpete': {'piso': piso_carpete, 'parede': _R(parede_carpete, ('#2e3036', '#46484f')), 'rodape': None, 'extra': None},
    'musgo': {'piso': piso_musgo, 'parede': parede_musgo, 'rodape': None, 'extra': None},
    'xadrez': {'piso': piso_xadrez, 'parede': parede_xadrez, 'rodape': None, 'extra': None},
    'ladrilho': {'piso': piso_ladrilho, 'parede': _R(parede_ladrilho, ('#2f5246', '#44705f')), 'rodape': None, 'extra': None},
    'metal': {'piso': piso_metal, 'parede': parede_metal, 'rodape': None, 'extra': None},
    'calabouco': {'piso': piso_calabouco, 'parede': parede_calabouco, 'rodape': None, 'extra': None},
    'terra': {'piso': piso_terra, 'parede': parede_terra, 'rodape': None, 'extra': None},
    'grama': {'piso': piso_grama, 'parede': parede_reboco, 'rodape': None, 'extra': None},
    'estrada': {'piso': piso_estrada, 'parede': parede_reboco, 'rodape': None, 'extra': None},
    'lavoura': {'piso': piso_lavoura, 'parede': parede_reboco, 'rodape': None, 'extra': None},
    'cascalho': {'piso': piso_cascalho, 'parede': parede_reboco, 'rodape': None, 'extra': None},
    'pier': {'piso': piso_pier, 'parede': parede_terra, 'rodape': None, 'extra': None},
}
