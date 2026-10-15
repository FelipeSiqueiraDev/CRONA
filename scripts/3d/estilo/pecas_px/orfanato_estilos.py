"""
Os estilos de CHÃO e PAREDE do Orfanato QUEIMADO (15/10), em pixel art 1:1, só código: `queimado_madeira` (as tábuas e o
taco das salas, dos quartos e da ala), `queimado_xadrez` (os sanitários, o banheiro e a sala de banho) e
`queimado_concreto` (o anexo). O texturas_px.py junta o ESTILOS daqui sozinho (veja o LEIA-ME.md).

O Orfanato pegou fogo e virou covil, e os móveis já são queimados (ocultismo.py: madeira carbonizada, cinza, fuligem);
estes estilos põem o piso e a parede no mesmo clima, com a mesma paleta (carvão #2c2420, rachadura #0e0b0a, fuligem
#4e4440..#121010, cinza #6e6964..#bcb7ae).

COMO É FEITO (diferente de estilos.py): cada estilo é "assado" uma vez numa imagem de 128 x 128 texels (o chão) ou
128 x 256 (a parede) com operações de imagem (vizinhança, bordas, manchas), e o material só consulta o texel. Isso
deixa pôr a borda rachada em volta da mancha de queima, a lasca de ladrilho, a poça com o reflexo, etc. Tudo é PERIÓDICO
em 128 texels na horizontal (e no chão também na vertical), como os outros estilos: a casa 3 emenda com a casa 0.

Regras de pixel art seguidas: manchas em degraus (sem dither), padrão em riscas/blocos de 2 px ou mais, 1 px claro depois
da junta e 1 px escuro antes da próxima, nada de pixel solto, sem texto. O móvel queimado é escuro (carvão), então o piso
fica numa faixa média (marrom-cinza, cinza sujo) com as manchas pretas e a cinza clara, para o móvel não sumir nele.
"""
import math

import numpy as np

import estilos as EST
from estilos import W, HP, _uv_chao, _uv_parede, _h, _ns, _rampa, Grade, g_grade, g_voronoi
from base_estilo import hx
from motor import emissivo

# =====================================================================================================================
# a paleta (a dos móveis queimados do ocultismo.py)
# =====================================================================================================================
CARVAO = hx('#2c2420')
RACHA = hx('#0e0b0a')
FULIGEM = _rampa(['#4e4440', '#3c3430', '#2a2422', '#1c1817', '#121010'])
CINZA = _rampa(['#6e6964', '#8a857e', '#a29d94', '#bcb7ae'])
AGUA = hx('#2d3436')


# =====================================================================================================================
# as ferramentas de imagem (tudo em 2D: [v, u]; a parede tem v = a altura em texels, sem volta)
# =====================================================================================================================
def _uvg(H=W):
    v, u = np.mgrid[0:H, 0:W]
    return u, v


def _t(cor, k):
    """Clareia (k > 1) ou escurece (k < 1) como o _tom do base_estilo, mas em imagem (H, W, 3) com k (H, W) ou número."""
    cor = np.asarray(cor, float)
    k = np.asarray(k, float)
    if k.ndim and k.ndim == cor.ndim - 1:
        k = k[..., None]
    esc = cor * k + (1 - k) * np.array([11.0, -1.0, 7.0])
    cla = cor + (k - 1) * (np.array([255.0, 238.0, 190.0]) - cor) * 0.9
    return np.where(k < 1, esc, cla)


def _w2(cond, a, b):
    return np.where(np.asarray(cond)[..., None], a, b)


def _mix(a, b, alfa):
    """a e b se misturam em `alfa` (número ou imagem): a mistura em degraus vem de alfa já em degraus."""
    alfa = np.asarray(alfa, float)
    if alfa.ndim:
        alfa = alfa[..., None]
    return np.asarray(a, float) * (1 - alfa) + np.asarray(b, float) * alfa


def _sh(a, dv=0, du=0, pv=True):
    """resultado[v, u] = a[v - dv, u - du]; em u sempre dá a volta, em v só se `pv` (senão repete a borda)."""
    a = np.roll(a, du, axis=1)
    if pv or dv == 0:
        return np.roll(a, dv, axis=0)
    b = np.empty_like(a)
    if dv > 0:
        b[dv:] = a[:-dv]
        b[:dv] = a[:1]
    else:
        b[:dv] = a[-dv:]
        b[dv:] = a[-1:]
    return b


def _dil(m, r=1, pv=True):
    o = m.copy()
    for dv in range(-r, r + 1):
        for du in range(-r, r + 1):
            if dv or du:
                o |= _sh(m, dv, du, pv)
    return o


def _ero(m, r=1, pv=True):
    return ~_dil(~m, r, pv)


def _fb(u, v, seed, pv=True, g=(32, 16, 8), w=(0.5, 0.3, 0.2)):
    """O ruído de manchas (três escalas); 128 / célula precisa ser inteiro (assim a imagem emenda)."""
    return w[0] * _ns(u, v, g[0], seed, pv) + w[1] * _ns(u, v, g[1], seed + 7, pv) + w[2] * _ns(u, v, g[2], seed + 13, pv)


def _nz(a):
    """O campo normalizado (média 0, desvio 1): os limites ficam por conta de quem usa, sem depender do campo."""
    return (a - a.mean()) / (a.std() + 1e-9)


def _frac(a, frac):
    """A máscara dos `frac` (0..1) maiores valores do campo."""
    return a > np.quantile(a, 1 - frac)


def _volta(a, c, n=W):
    d = np.abs(a - c)
    return np.minimum(d, n - d)


def _trilha(m, rng, x0, y0, ang, n, tors=0.4, pv=True, larg=1):
    """Uma rachadura: um passeio torto de n passos que liga os texels em `m` (volta em u, e em v se `pv`)."""
    H = m.shape[0]
    x, y = float(x0), float(y0)
    for _ in range(n):
        ang += rng.normal(0, tors)
        x += math.cos(ang)
        y += math.sin(ang)
        xi, yi = int(round(x)) % W, int(round(y))
        if pv:
            yi %= H
        elif not 0 <= yi < H:
            continue
        m[yi, xi] = True
        if larg > 1:
            m[yi, (xi + 1) % W] = True
    return m


def _poca(u, v, cu, cv, ru, rv, seed, pv=True):
    """O desenho da poça: uma elipse de borda irregular (com a volta)."""
    du = _volta(u, cu)
    dv = _volta(v, cv) if pv else np.abs(v - cv)
    d = np.hypot(du / ru, dv / rv)
    n = _ns(u, v, 8, seed, pv)
    return d < 0.8 + 0.5 * (n - 0.25)


def _agua(out, u, v, pocas, pv=True):
    """As poças de água suja: o corpo escuro esverdeado, a beira molhada de 1 px, o reflexo em dois riscos e o chão molhado em volta."""
    for i, (cu, cv, ru, rv) in enumerate(pocas):
        P = _poca(u, v, cu, cv, ru, rv, 61 + i, pv)
        halo = _dil(P, 2, pv) & ~P
        borda = _dil(P, 1, pv) & ~P
        corpo = _mix(AGUA, hx('#353c3a'), (_ns(u, v, 8, 71 + i, pv) > 0.55) * 1.0)
        out = _w2(halo, _t(out, 0.78), out)
        out = _w2(borda, hx('#15110f'), out)
        out = _w2(P, corpo, out)
        # a beira de dentro, um pouco mais clara (o brilho do menisco) e os dois riscos do reflexo
        dentro = P & ~_ero(P, 1, pv)
        out = _w2(dentro & (_sh(P, 1, 0, pv) == 0), hx('#56605f'), out)
        for k, (dx, dy, c) in enumerate(((-0.35, 0.3, '#6f7a78'), (0.05, -0.2, '#566160'))):
            ru_ = max(3, int(ru * 0.28))
            r = P & (np.abs(u - (cu + dx * ru)) <= ru_) & (v == int(round(cv + dy * rv)))
            out = _w2(r, hx(c), out)
    return out


# =====================================================================================================================
# as camadas que os três pisos e as paredes repartem
# =====================================================================================================================
def _carvao_placas(out, u, v, mask, seed, pv=True, H=W, esticar=1.0, n=20, vertical=False):
    """
    O couro de jacaré da madeira e do reboco queimados, dentro de `mask`: placas (Voronoi) em três tons com a
    rachadura preta de 1 px entre elas e a quina de cima clara.
    """
    g = g_voronoi(n, seed, H=W, jit=0.8, esticar=esticar)
    ids, j = g.ids, g.j
    if vertical:
        ids, j = ids.T, j.T
    if H != W:
        ids, j = np.tile(ids, (H // W, 1)), np.tile(j, (H // W, 1))
    gg = Grade(ids, j)
    k = _h(ids * 0.37, seed + 3.0)
    base = _w2(k < 0.3, hx('#241d19'), _w2(k > 0.72, hx('#3b2f29'), hx('#2e2520')))
    base = _w2(gg.jl | gg.ju, _t(base, 1.16), base)
    base = _w2(gg.jr | gg.jd, _t(base, 0.82), base)
    base = _w2(gg.j, RACHA, base)
    return _w2(mask, base, out)


def _cinza_placas(out, u, v, seed, forca=0.26, pv=True, H=W, zona=None, n=9):
    """
    A cinza clara por cima, em placas: as placas (Voronoi) que ficam inteiras de cinza (a borda irregular, cortada por um
    ruído), em quatro tons, com a quina de cima clara, a de baixo escura e a trinca entre elas.
    """
    g = g_voronoi(n, seed, H=W, jit=0.9)
    ids, j = (np.tile(g.ids, (H // W, 1)), np.tile(g.j, (H // W, 1))) if H != W else (g.ids, g.j)
    ca = _fb(u, v, seed + 21, pv, g=(32, 16, 8), w=(0.55, 0.3, 0.15))
    sel = (_h(ids * 0.37, seed + 5.0) < forca) & (ca > 0.34)
    if zona is not None:
        sel &= zona
    sel &= _ns(u, v, 8, seed + 23, pv) > 0.3                 # a borda comida e irregular
    sel = _ero(_dil(sel, 1, pv), 1, pv)                      # sem pixel solto: some o que ficou fininho
    k = (_h(ids * 0.37, seed + 6.0) * 3).astype(int) % 3
    cor = _rampa(['#6f6a64', '#79746d', '#827d76'])[k]
    cor = _w2(_ns(u, v, 16, seed + 25, pv) > 0.66, _t(cor, 0.93), cor)
    topo = sel & ~_sh(sel, 1, 0, pv)                          # a quina de trás (a que pega luz)
    esq = sel & ~_sh(sel, 0, 1, pv)
    baixo = sel & ~_sh(sel, -1, 0, pv)
    dire = sel & ~_sh(sel, 0, -1, pv)
    cor = _w2(topo | esq, hx('#948f86'), cor)
    cor = _w2(baixo | dire, hx('#5c5751'), cor)
    cor = _w2(j & sel & ~(topo | esq | baixo | dire), hx('#5f5a54'), cor)
    # a sombra no chão, colada na beira de baixo da placa de cinza
    somb = _dil(sel, 1, pv) & ~sel & _sh(sel, 1, 1, pv)
    out = _w2(somb, _t(out, 0.7), out)
    return _w2(sel, cor, out)


def _zona_queima(u, v, seed, lim=0.62, pv=True, frac=None):
    """A mancha de queima: o campo de manchas cortado num limite, com a borda esfarelada por um ruído fino."""
    q = _fb(u, v, seed, pv)
    q = q + (_ns(u, v, 8, seed + 31, pv) - 0.5) * 0.09 + (_ns(u, v, 16, seed + 32, pv) - 0.5) * 0.04
    Z = _frac(q, frac) if frac else q > lim
    return _ero(_dil(Z, 1, pv), 1, pv) if True else Z


def _borda_queima(out, Z, pv=True, seed=0, quebrada=0.78):
    """
    A borda da mancha de queima: o anel de madeira/reboco chamuscado em volta (1 a 2 px, um tom abaixo, escurecendo
    para a mancha) e a linha preta rachada logo na beira (1 px, que falha aqui e ali: a rachadura).
    """
    u, v = _uvg(Z.shape[0])
    r1 = _dil(Z, 1, pv) & ~Z
    r2 = _dil(Z, 2, pv) & ~_dil(Z, 1, pv)
    out = _w2(r2, _t(out, 0.82), out)
    out = _w2(r1, _t(out, 0.6), out)
    quebra = r1 & (_h(u // 2, v // 2, seed + 9.0) < quebrada)
    return _w2(quebra, RACHA, out)


# =====================================================================================================================
# O PISO DE TÁBUA queimado (as salas de taco e de madeira: enfermaria, salão, cozinha, quarto da diretora, quartos, ala)
# =====================================================================================================================
_C = {}


def _cache(nome, f):
    if nome not in _C:
        _C[nome] = f()
    return _C[nome]


def _tabuas_empenadas(seed=311, larg=8, comp=64):
    """
    Tábuas de `larg` texels ao longo de u, as pontas desencontradas, e cada fiada EMPENADA: a borda dela ondula (0 a
    2 texels) com um ou dois ciclos nos 128 texels. Devolve a Grade e, por texel, a posição ao longo da tábua e a de
    través (0 = a borda de trás).
    """
    rng = np.random.default_rng(seed)
    u, v = _uvg()
    nf = W // larg
    amp = rng.choice([0.0, 0.0, 0.9, 1.3, 1.7, 2.2], nf)
    kc = rng.integers(1, 3, nf)
    ph = rng.random(nf) * 2 * np.pi
    off = rng.integers(0, comp, nf)

    def borda(k):
        kk = k % nf
        return k * larg + np.rint(amp[kk] * np.sin(2 * np.pi * kc[kk] * u / W + ph[kk])).astype(int)
    k0 = v // larg
    fila = k0 - 1
    for k in (k0, k0 + 1):
        fila = np.where(borda(k) <= v, k, fila)
    fm = fila % nf
    yy = v - borda(fila)
    uu = u + off[fm]
    col = (uu // comp) % (W // comp)
    ids = fm * 1000 + col
    g = Grade(ids)
    g.extra['pos'] = uu % comp
    g.pos, g.yy, g.fm, g.col, g.uu = uu % comp, yy, fm, col, uu
    return g


def _tex_piso_madeira():
    larg, comp = 8, 64
    u, v = _uvg()
    g = _tabuas_empenadas(311, larg, comp)
    ids, fm, pos, yy = g.ids, g.fm, g.pos, g.yy

    # --- as tábuas: o tostado (marrom-cinza, o que o fogo só lambeu) e o chamuscado, cada tábua no seu tom
    Q = _fb(u, v, 41)
    nivel = 0.55 * _h(ids * 0.37, 3.1) + 0.45 * Q
    k = (_h(ids * 0.37, 5.5) * 4).astype(int) % 4
    TOST = _rampa(['#6e5947', '#65513f', '#76604d', '#5c493a'])
    CHAM = _rampa(['#55443a', '#4c3d33', '#5d4a3e', '#47382e'])
    out = _w2(nivel < 0.47, TOST[k], CHAM[k])
    # o veio: riscas compridas de 1 px ao longo da tábua (2 por tábua), em pedaços; seguem a ondulação da fiada
    o1 = 2 + (_h(fm, ids % 997, 5.0) * 4).astype(int)
    seg = ((pos + (_h(fm, 6.0) * 16).astype(int)) // 16) % (comp // 16)
    r1 = (yy == o1) & (_h(fm, seg, ids % 997, 7.0) < 0.62)
    out = _w2(r1 & ~g.j, _t(out, 0.84), out)
    o2 = (o1 + 4) % larg
    seg2 = ((pos + 5) // 8) % (comp // 8)
    r2 = (yy == o2) & (_h(fm, seg2, ids % 997, 8.0) < 0.3) & ~r1
    out = _w2(r2 & ~g.j, _t(out, 1.07), out)
    # as rachaduras de través: uma por tábua em umas poucas (1 px escuro, com o lado de cá 1 px mais claro)
    cp = 6 + (_h(ids * 0.37, 9.0) * (comp - 12)).astype(int)
    rt = (pos == cp) & (_h(ids * 0.37, 9.5) < 0.38) & (yy >= 1) & (yy <= larg - 2)
    out = _w2(rt, hx('#1b1411'), out)
    out = _w2(_sh(rt, 0, 1) & ~rt & ~g.j & (_h(ids * 0.37, 9.5) < 0.38), _t(out, 1.1), out)
    # o volume: 1 px claro depois da junta, 1 escuro antes da próxima
    out = _w2(g.jr | g.ju, _t(out, 0.88), out)
    out = _w2(g.jl | g.jd, _t(out, 1.08), out)
    out = _w2(g.j, hx('#1a1411'), out)
    # a pontinha da tábua empenada: a junta de topo (a ponta) mais funda
    out = _w2(g.j & (pos == 0), hx('#0f0b0a'), out)

    # --- a queima: as manchas pretas com o couro de jacaré e a borda rachada (e a cinza por cima)
    Z = _zona_queima(u, v, 43, 0.64)
    out0 = out
    out = _carvao_placas(out, u, v, Z, 313, esticar=2.3, n=20)
    out = _w2(Z & g.j & (_h(u // 2, v // 2, 4.4) < 0.5), RACHA, out)       # as juntas das tábuas ainda aparecem na mancha
    out = _borda_queima(out, Z, True, 5)
    out = _cinza_placas(out, u, v, 317, 0.18, True, W, None, 9)

    # --- as poças de água suja (poucas, pequenas)
    out = _agua(out, u, v, [(22, 100, 10, 5)])

    # --- as tábuas que faltam: o escuro de baixo (o barrote, a terra), a ponta da tábua de cada lado
    a = (_h(ids * 0.37, 8.1) * 8).astype(int)
    b = (_h(ids * 0.37, 8.2) * 26).astype(int)
    furo = (_h(ids * 0.37, 7.7) < 0.1) & (pos >= a) & (pos < comp - b)
    furo = _ero(_dil(furo, 1), 1)
    fundo = np.tile(hx('#0f0b0a'), (W, W, 1))
    bar = ((u + 6) % 32 >= 8) & ((u + 6) % 32 < 17)                        # o barrote que corre por baixo, de través
    fundo = _w2(bar, hx('#241b17'), fundo)
    fundo = _w2(bar & ((u + 6) % 32 == 8), hx('#3b2e26'), fundo)
    fundo = _w2(bar & ((u + 6) % 32 == 16), hx('#17110f'), fundo)
    fundo = _w2(_ns(u, v, 8, 83) > 0.62, _t(fundo, 1.25), fundo)
    # a quina da tábua de trás (de onde vem a luz) e a da esquerda, cortadas de fresco, e a sombra logo embaixo
    topo = furo & ~_sh(furo, 1, 0)
    topo2 = furo & _sh(topo, 1, 0)
    esq = furo & ~_sh(furo, 0, 1)
    fundo = _w2(topo2, _t(fundo, 0.55), fundo)
    fundo = _w2(esq, hx('#4a3a2f'), fundo)
    fundo = _w2(topo, hx('#6a5543'), fundo)
    out = _w2(furo, fundo, out)
    return np.clip(out, 0, 255)


def piso_madeira_q():
    def f(L, n, P):
        u, v = _uv_chao(P)
        return _cache('piso_mad', _tex_piso_madeira)[v % W, u % W]
    return emissivo(f)


# =====================================================================================================================
# O PISO DE XADREZ queimado (os sanitários, o banheiro, a sala de banho): ladrilhos 16 x 16 rachados e enegrecidos
# =====================================================================================================================
def _buraco(out, H, fundo, claro_borda='#b8b2a3', pv=True):
    """
    Um buraco `H` (onde falta o ladrilho/a tábua) pintado com `fundo` (imagem): a quina de trás cortada de fresco (1 px
    claro), a sombra logo abaixo dela (2 px) e a quina da esquerda; o resto fica no escuro do fundo.
    """
    topo = H & ~_sh(H, 1, 0, pv)
    topo2 = H & _sh(topo, 1, 0, pv) & ~topo
    esq = H & ~_sh(H, 0, 1, pv) & ~topo
    f = _w2(topo2, _t(fundo, 0.55), fundo)
    f = _w2(esq, _t(hx(claro_borda), 0.8), f)
    f = _w2(topo, hx(claro_borda), f)
    return _w2(H, f, out)


def _argamassa(u, v, seed=57):
    """O que sobra onde o ladrilho solta: a argamassa e o contrapiso, cinza-marrom, em blocos de 2 px."""
    b = np.tile(hx('#5e574e'), (u.shape[0], u.shape[1], 1))
    n = _h(u // 2, v // 2, seed)
    b = _w2(n < 0.22, hx('#4b453d'), b)
    b = _w2(n > 0.82, hx('#6e675c'), b)
    b = _w2(_ns(u, v, 16, seed + 1) > 0.66, _t(b, 0.88), b)
    return b


def _tex_piso_xadrez():
    T = 16
    u, v = _uvg()
    g = g_grade(T, T)
    tu, tv = u // T, v // T
    tid = tu * 8 + tv
    claro = (tu + tv) % 2 == 0
    k = (_h(tid * 0.37, 1.1) * 3).astype(int) % 3
    BR = _rampa(['#aaa496', '#a29c8e', '#b2ac9d'])           # o branco, já amarelado e sujo
    PR = _rampa(['#2f2c2e', '#363336', '#2a282a'])
    out = _w2(claro, BR[k], PR[k])
    # a fuligem: nuvens em degraus (3 níveis) que escurecem o branco; o preto só fica um pouco mais pardo
    F = _fb(u, v, 45) + (_h(tid * 0.37, 2.6) - 0.5) * 0.1
    lv = np.digitize(F, [0.5, 0.6, 0.7])
    cl = out
    cl = _w2(lv == 1, _mix(out, hx('#6f675b'), 0.5), cl)
    cl = _w2(lv == 2, _mix(out, hx('#4c453e'), 0.78), cl)
    cl = _w2(lv == 3, _mix(out, hx('#2d2926'), 0.92), cl)
    pr = _w2(lv >= 2, _mix(out, hx('#2b2725'), 0.45), out)
    out = _w2(claro, cl, pr)
    # o volume: a quina de trás clara (o preto brilha mais, como no xadrez inteiro)
    out = _w2((g.jl | g.jd) & claro, _t(out, 1.05), out)
    out = _w2((g.jl | g.jd) & ~claro, _t(out, 1.28), out)
    out = _w2((g.jr | g.ju) & ~claro, _t(out, 0.86), out)
    # as rachaduras: um passeio torto dentro de metade dos ladrilhos, com o lado de lá 1 px mais claro
    rng = np.random.default_rng(97)
    rach = np.zeros((W, W), bool)
    for ti in range(W // T):
        for tj in range(W // T):
            if rng.random() < 0.5:
                m = np.zeros((W, W), bool)
                x0, y0 = ti * T + int(rng.integers(3, T - 3)), tj * T + int(rng.integers(3, T - 3))
                _trilha(m, rng, x0, y0, rng.random() * 6.28, int(rng.integers(6, 13)), 0.55)
                if rng.random() < 0.45:
                    _trilha(m, rng, x0, y0, rng.random() * 6.28, int(rng.integers(4, 9)), 0.55)
                rach |= m & (tu == ti) & (tv == tj) & ~g.j
    out = _w2(_sh(rach, 0, 1) & ~rach & ~g.j & claro, _t(out, 1.14), out)
    out = _w2(rach, hx('#16120f'), out)
    # os ladrilhos que soltaram (inteiros) e os cantos lascados: aparece a argamassa, com a quina cortada
    fura = _h(tid * 0.37, 3.3) < 0.085
    gu, gv = u % T, v % T
    cant = (_h(tid * 0.37, 3.9) < 0.3) & ~fura
    cs = 3 + (_h(tid * 0.37, 4.2) * 3).astype(int)
    c = (_h(tid * 0.37, 4.6) * 4).astype(int) % 4
    lasca = cant & (((c == 0) & (gu + gv < cs)) | ((c == 1) & ((T - 1 - gu) + gv < cs)) |
                    ((c == 2) & (gu + (T - 1 - gv) < cs)) | ((c == 3) & ((T - 1 - gu) + (T - 1 - gv) < cs)))
    Hm = fura | lasca
    arg = _argamassa(u, v)
    # a junta (o rejunte): cinza, com cinza clara acumulada em trechos
    jun = _w2(g.j, hx('#6d675d'), out)
    jun = _w2(g.j & (_fb(u, v, 47, g=(16, 8, 8)) > 0.52), hx('#9a948a'), jun)
    out = jun
    out = _buraco(out, Hm, arg, '#b8b2a3')
    # a cinza clara em placas, as manchas de queima mais pretas (com a borda) e a água suja
    Zq = _zona_queima(u, v, 49, 0.67)
    out = _w2(Zq, _mix(out, hx('#1e1b1a'), 0.82), out)
    out = _borda_queima(out, Zq, True, 7)
    out = _cinza_placas(out, u, v, 331, 0.16, True, W, None, 11)
    out = _agua(out, u, v, [(40, 24, 10, 5)])
    return np.clip(out, 0, 255)


def piso_xadrez_q():
    def f(L, n, P):
        u, v = _uv_chao(P)
        return _cache('piso_xad', _tex_piso_xadrez)[v % W, u % W]
    return emissivo(f)


# =====================================================================================================================
# O PISO DE CONCRETO queimado (o anexo): cimento fuliginoso, rachado, lascado, com as marcas de fogo
# =====================================================================================================================
def _tex_piso_concreto():
    u, v = _uvg()
    g = g_grade(64, 64)
    CON = _rampa(['#7d786f', '#767168', '#837e75'])
    k = (_h(g.ids * 0.37, 3.0) * 3).astype(int) % 3
    out = CON[k]
    m = _fb(u, v, 6, g=(32, 16, 8), w=(0.55, 0.25, 0.2))
    out = _w2(m > 0.64, _t(out, 0.95), out)
    out = _w2(m > 0.76, _t(out, 0.91), out)
    out = _w2(m < 0.3, _t(out, 1.035), out)
    pnt = _h(u // 2, v, 8.5)
    out = _w2(pnt < 0.03, _t(out, 0.82), out)
    out = _w2(pnt > 0.975, _t(out, 1.08), out)
    # a fuligem: nuvens em três degraus (o fogo e as velas) escurecendo o cinza
    F = _fb(u, v, 51)
    lv = np.digitize(F, [0.5, 0.6, 0.69])
    out = _w2(lv == 1, _mix(out, hx('#4e4a45'), 0.4), out)
    out = _w2(lv == 2, _mix(out, hx('#37332f'), 0.68), out)
    out = _w2(lv == 3, _mix(out, hx('#231f1d'), 0.88), out)
    # a junta de dilatação: 1 px escuro, o px claro depois; cinza acumulada nela aqui e ali
    out = _w2(g.jl | g.jd, _t(out, 1.06), out)
    out = _w2(g.j, hx('#2b2723'), out)
    out = _w2(g.j & (_fb(u, v, 53, g=(16, 8, 8)) > 0.55), hx('#8a857c'), out)
    # as lascas: o concreto soltou (um pedaço irregular de 4 a 9 texels), aparece o miolo, com a quina de trás clara
    rng = np.random.default_rng(401)
    las = np.zeros((W, W), bool)
    for i in range(9):
        cu, cv = int(rng.integers(0, W)), int(rng.integers(0, W))
        ru, rv = rng.uniform(2.5, 5.5), rng.uniform(2, 4.5)
        d = np.hypot(_volta(u, cu) / ru, _volta(v, cv) / rv)
        las |= d < 0.75 + 0.5 * (_ns(u, v, 8, 411 + i, True) - 0.25)
    las &= ~g.j
    miolo = _mix(hx('#58534c'), hx('#3d3935'), (_h(u // 2, v // 2, 7.1) < 0.3) * 1.0)
    miolo = _w2(_h(u // 2, v // 2, 7.7) > 0.84, hx('#7a746b'), miolo)
    out = _buraco(out, las, miolo, '#a39d92')
    # as rachaduras compridas: um passeio torto de 45 a 95 passos, 1 px escuro (às vezes 2), o px de trás claro
    rach = np.zeros((W, W), bool)
    for i in range(4):
        _trilha(rach, rng, rng.integers(0, W), rng.integers(0, W), rng.random() * 6.28, int(rng.integers(45, 95)), 0.28,
                larg=int(rng.integers(1, 3)))
    rach = rach & ~las
    out = _w2(_sh(rach, 1, 0) & ~rach, _t(out, 1.12), out)
    out = _w2(rach, hx('#14100e'), out)
    # as marcas de fogo: a mancha preta com o couro de jacaré (placas largas) e a borda rachada; a cinza por cima
    Zq = _zona_queima(u, v, 55, 0.66)
    out = _carvao_placas(out, u, v, Zq, 421, esticar=1.0, n=14)
    out = _borda_queima(out, Zq, True, 8)
    out = _cinza_placas(out, u, v, 337, 0.18, True, W, None, 9)
    out = _agua(out, u, v, [(60, 70, 10, 5)])
    return np.clip(out, 0, 255)


def piso_concreto_q():
    def f(L, n, P):
        u, v = _uv_chao(P)
        return _cache('piso_con', _tex_piso_concreto)[v % W, u % W]
    return emissivo(f)


# =====================================================================================================================
# AS PAREDES queimadas (as três têm a mesma anatomia, o que muda é a "pele" de antes do fogo)
#   1. a pele inteira (lambri e reboco / azulejo / tinta e concreto)
#   2. onde o reboco/azulejo/tinta descascou: o tijolo ou a ripa por baixo (com a quina de cima na sombra)
#   3. a fuligem: o chão e o teto escurecem e sobem línguas pretas do pé da parede (degraus de 4 níveis, sem dither)
#   4. as manchas de queima (preto de couro de jacaré) com o anel chamuscado e a borda rachada
#   5. a água escorrendo (riscas claras e escuras) e a faixa molhada de baixo
#   6. o rodapé carbonizado (5 texels), com pedaços faltando
# A imagem tem 128 x 256 (a parede desenhada tem 3,6 m = 189 texels) e emenda em u.
# =====================================================================================================================
LING = [(10, 14, 150), (44, 18, 100), (72, 11, 175), (104, 16, 86)]      # (u do pé, largura, altura) das línguas de fuligem
SOOT = np.stack([hx('#5f574d'), hx('#6a6156'), hx('#443d37'), hx('#2a2522'), hx('#1a1716')])
SOOT_A = np.array([0.22, 0.5, 0.7, 0.86, 0.95])
BRK = _rampa(['#85584a', '#7b5143', '#8e6050', '#70493d', '#795246'])    # tijolo queimado, terracota apagada
MORT = hx('#8f887a')


def _nivel_fuligem(u, v, seed, ling, forca=1.0, base=0.46):
    S = base + 0.24 * np.clip((v - 92) / 100.0, 0, 1) + 0.30 * np.clip((26 - v) / 26.0, 0, 1)
    for i, (cu, lg, alto) in enumerate(ling):
        bal = 3.0 * np.sin(v / 15.0 + i * 1.7)
        du = _volta(u, (cu + bal) % W)
        t = np.clip(v / float(alto), 0, 1)
        w = lg * (1 - t) ** 0.8 + 1.0
        wob = (_ns(u, v, 8, seed + cu, False) - 0.5) * 7
        S = np.maximum(S, np.where(v < alto, np.clip(1.35 * (1 - (du + wob) / w), 0, 1.05), 0))
    fum = 0.4 * _ns(u, v // 3, 16, seed + 3, False) + 0.35 * _ns(u, v // 2, 8, seed + 4, False) + 0.25 * _ns(u, v, 32, seed + 5, False)
    S = S + _nz(fum) * 0.15
    return np.digitize(S * forca, [0.3, 0.5, 0.7, 0.88])


def _tijolo(u, v, seed=5):
    g = g_grade(16, 5, H=HP, desloc=8)
    out = BRK[(_h(g.ids * 0.37, seed) * 5).astype(int) % 5]
    out = _w2(_ns(u, v, 16, seed + 1, False) > 0.64, _t(out, 0.9), out)
    out = _w2(g.jr | g.jd, _t(out, 0.86), out)
    out = _w2(g.jl | g.ju, _t(out, 1.1), out)
    return _w2(g.j, MORT, out)


def _ripa(u, v, seed=6):
    """As ripas de madeira (tira de 5 texels, vão de 3) onde o reboco caiu; o reboco que entrou entre elas fica em pedaços."""
    r = v % 8
    fila = v // 8
    tira = r >= 3
    seg = ((u + (_h(fila, seed) * 48).astype(int)) // 40) % 4
    cor = _rampa(['#54412f', '#4a392a', '#5c4734'])[(_h(fila, seg, seed + 1) * 3).astype(int) % 3]
    cor = _w2(r == 7, _t(cor, 1.16), cor)
    cor = _w2(r == 3, _t(cor, 0.78), cor)
    cor = _w2((r == 5) & (_h(fila, seg + (u // 12), seed + 2) < 0.5), _t(cor, 0.86), cor)
    vao = np.tile(hx('#15100e'), (v.shape[0], v.shape[1], 1))
    chave = (r < 3) & (_h(u // 5, fila, seed + 3) < 0.42)             # o reboco que entrou no vão (a "chave" do reboco)
    vao = _w2(chave, hx('#8a806e'), vao)
    vao = _w2(chave & (r == 2), _t(hx('#8a806e'), 0.8), vao)
    return _w2(tira, cor, vao)


def _reboco(u, v, cor='#b4a88f', seed=17):
    """O reboco/caiação de antes do fogo: bege, com manchas grandes e umas fissuras de 1 px."""
    out = np.tile(hx(cor), (v.shape[0], v.shape[1], 1))
    m = _fb(u, v, seed, False, g=(64, 32, 16), w=(0.5, 0.3, 0.2))
    out = _w2(m > 0.64, _t(out, 0.95), out)
    out = _w2(m < 0.34, _t(out, 1.03), out)
    return out


def _fissuras(out, u, v, seed, n=6, cor='#4a4036'):
    rng = np.random.default_rng(seed)
    m = np.zeros(u.shape, bool)
    for i in range(n):
        _trilha(m, rng, rng.integers(0, W), rng.integers(30, 170), np.pi / 2 + rng.normal(0, 0.5), int(rng.integers(14, 46)),
                0.35, pv=False)
    return _w2(m, hx(cor), out)


def _falta(out, F, claro=1.18):
    """A borda de onde o reboco/azulejo soltou: a quina de cima do que sobrou embaixo acende, e a de cima do buraco fica na sombra."""
    labio = ~F & _sh(F, -1, 0, False)               # o topo do reboco que ficou embaixo do buraco
    teto = F & ~_sh(F, -1, 0, False)                # a beira de cima do buraco (embaixo do reboco que sobrou)
    teto2 = F & _sh(teto, 1, 0, False) & ~teto
    lado = ~F & (_sh(F, 0, 1, False) | _sh(F, 0, -1, False))
    out = _w2(lado & ~labio, _t(out, 0.68), out)
    out = _w2(teto, _t(out, 0.42), out)
    out = _w2(teto2, _t(out, 0.68), out)
    return _w2(labio, _t(out, claro), out)


def _carvao_madeira(u, v, g8, seed, topo, falta_p=0.1):
    """O lambri carbonizado (tábuas em pé de 8 texels): o couro de jacaré comprido, cada tábua queimada até uma altura."""
    col = u // 8
    alt = topo + (_h(col, seed) * 20).astype(int)
    pres = (v < alt)
    out = np.tile(hx('#2e2520'), (v.shape[0], v.shape[1], 1))
    out = _carvao_placas(out, u, v, np.ones(v.shape, bool), seed + 5, False, HP, 1.0, 16, True)
    k = _h(col, seed + 2)
    out = _w2(k < 0.25, _t(out, 0.85), out)
    out = _w2(k > 0.8, _t(out, 1.18), out)
    out = _w2(g8.jl, _t(out, 1.14), out)
    out = _w2(g8.jr, _t(out, 0.84), out)
    out = _w2(g8.j, hx('#0e0b0a'), out)
    # a ponta de cima da tábua queimada: 1 px de madeira ainda parda (a quina) e 2 px de preto
    topo1 = pres & (v == alt - 1)
    out = _w2(pres & (v >= alt - 3), hx('#130e0c'), out)
    out = _w2(topo1, hx('#51423a'), out)
    return pres, out, (_h(col, seed + 9) < falta_p)


def _tex_parede(pele, sub='tijolo', forca=1.0, ling=LING, seed=100, spall=0.3, queima=0.08, lambri=0, rodape=True):
    u, v = _uvg(HP)
    out = pele(u, v)
    # --- 2. onde descascou
    sp = _fb(u, v, seed + 5, False, g=(32, 16, 8), w=(0.45, 0.35, 0.2)) + 0.12 * np.exp(-((v - 105) / 55.0) ** 2)
    sp = sp + (_ns(u, v, 8, seed + 6, False) - 0.5) * 0.1
    SP = _frac(sp, spall)
    SP = _ero(_dil(SP, 1, False), 1, False)
    SP &= v > 2
    tij = _fb(u, v, seed + 9, False, g=(64, 32, 16)) > 0.5
    und = _w2(tij, _tijolo(u, v), _ripa(u, v)) if sub == 'tijolo' else _bloco(u, v)
    out = _w2(SP, und, out)
    out = _falta(out, SP)
    # --- o lambri carbonizado de baixo (só a madeira)
    if lambri:
        g8 = g_grade(8, HP, H=HP)
        pres, mad, falta = _carvao_madeira(u, v, g8, seed + 20, lambri)
        out = _w2(pres & ~falta, mad, out)
        fa = pres & falta
        out = _w2(fa, _t(und, 0.55), out)
        out = _falta(out, fa & ~SP)
    # --- 3. a fuligem
    lv = _nivel_fuligem(u, v, seed, ling, forca)
    out = _mix(out, SOOT[lv], SOOT_A[lv])
    # --- 4. as manchas de queima: o preto de couro de jacaré, o anel chamuscado e a borda rachada
    Z = _zona_queima(u, v, seed + 40, 0, pv=False, frac=queima)
    out = _carvao_placas(out, u, v, Z, seed + 41, False, HP, 1.0, 14)
    out = _borda_queima(out, Z, False, seed)
    out = _fissuras(out, u, v, seed + 3)
    # --- 5. a água escorrendo (riscas) e a faixa molhada de baixo
    col2 = u // 2
    tem = _h(col2 % 64, seed + 21) < 0.14
    topo = 40 + (_h(col2 % 64, seed + 22) * 120).astype(int)
    comp = 24 + (_h(col2 % 64, seed + 23) * 70).astype(int)
    escuro = _h(col2 % 64, seed + 24) < 0.45
    est = tem & (v < topo) & (v > topo - comp)
    out = _w2(est & ~escuro, _mix(out, hx('#a89c85'), 0.34), out)
    out = _w2(est & escuro, _mix(out, hx('#1b1613'), 0.4), out)
    gota = tem & (v <= topo - comp) & (v > topo - comp - 3) & ((u % 2) == 0)
    out = _w2(gota & ~escuro, _mix(out, hx('#c0b49c'), 0.55), out)
    mol = v < 9 + (_fb(u, v, seed + 11, False) * 16).astype(int)
    out = _w2(mol, _mix(out, hx('#16201b'), 0.36), out)
    out = _w2(mol & ~_ero(mol, 1, False), _t(out, 0.72), out)
    # --- 6. o rodapé carbonizado
    if rodape:
        out = _rodape_q(out, u, v, und, seed + 60)
    return np.clip(out, 0, 255)


def _rodape_q(out, u, v, under, seed):
    """O rodapé de madeira carbonizado (5 texels): placas de 24 texels, umas faltando, rachaduras e a quina de cima parda."""
    seg = u // 24
    falta = _h(seg, seed) < 0.14
    sk = v < 5
    k = (_h(seg, seed + 1) * 3).astype(int) % 3
    cor = _rampa(['#2c2420', '#352a25', '#262019'])[k]
    cor = _w2(v == 4, hx('#4d4038'), cor)
    cor = _w2(v == 0, hx('#120e0c'), cor)
    cor = _w2((u % 24 == 0) | ((_h(u // 4, seed + 2) < 0.1) & (v >= 1) & (v <= 3) & ((u % 4) == 1)), RACHA, cor)
    out = _w2(sk & ~falta, cor, out)
    out = _w2(sk & falta, _t(under, 0.5), out)
    out = _w2((v == 5) & ~falta, _t(out, 0.8), out)
    return out


def _bloco(u, v, seed=7):
    """O bloco de concreto cinza que aparece onde o reboco do anexo caiu."""
    g = g_grade(32, 11, H=HP, desloc=16)
    out = _rampa(['#7f7d78', '#77756f', '#86837d', '#7b7973'])[(_h(g.ids * 0.37, seed) * 4).astype(int) % 4]
    out = _w2(_h(u // 2, v, seed + 1) < 0.05, _t(out, 0.9), out)
    out = _w2(g.jr | g.jd, _t(out, 0.9), out)
    out = _w2(g.jl | g.ju, _t(out, 1.07), out)
    return _w2(g.j, hx('#4a4843'), out)


# --------------------------------------------------------------------- a pele de cada estilo (antes do fogo)
def _pele_madeira(u, v):
    return _reboco(u, v, '#b4a88f', 17)


def _pele_xadrez(u, v):
    """Azulejo 8 x 8 até 1,5 m (a fiada preta de cima e a de baixo), reboco acima; azulejo solto ou rachado."""
    out = _reboco(u, v, '#bdb49c', 19)
    g = g_grade(8, 8, H=HP)
    k = (_h(g.ids * 0.37, 2.0) * 3).astype(int) % 3
    az = _rampa(['#cfcabc', '#c7c2b4', '#d5d0c3'])[k]
    az = _w2(g.jl | g.ju, _t(az, 1.07), az)
    az = _w2(g.jr | g.jd, _t(az, 0.9), az)
    az = _w2(g.j, hx('#85807a'), az)
    pr = _rampa(['#343236', '#2f2d31', '#39373b'])[k]
    pr = _w2(g.jl | g.ju, _t(pr, 1.3), pr)
    pr = _w2(g.j, hx('#59554f'), pr)
    # a faixa preta e o rodapé de azulejo preto
    t = np.where(((v >= 72) & (v < 80)) | (v < 8), 1, 0).astype(bool)
    pel = _w2(t, pr, az)
    # o azulejo rachado: uma diagonal fina dentro de uns poucos; e o que soltou, mostrando o reboco cinza
    tid = g.ids
    gu, gv = u % 8, v % 8
    diag = (_h(tid * 0.37, 5.1) < 0.16) & (np.abs(gu - gv) <= 0) & (gu >= 1) & (gv >= 1)
    pel = _w2(diag, hx('#171412'), pel)
    solto = (_h(tid * 0.37, 6.1) < 0.1) & ~g.j
    sol = _reboco(u, v, '#8b8372', 23)
    sol = _w2(_h(u // 3, v // 2, 24.0) < 0.2, _t(sol, 0.85), sol)
    pel = _w2(solto, sol, pel)
    pel = _falta(pel, solto)
    out = _w2(v < 80, pel, out)
    out = _w2((v == 80) | (v == 81), _t(out, 0.82), out)
    return out


def _pele_concreto(u, v):
    """Reboco bege em cima e a barra de tinta a óleo cinza-esverdeada (até 1,2 m); a tinta descascada mostra o concreto."""
    out = _reboco(u, v, '#b0a998', 29)
    barra = np.tile(hx('#6c7a6f'), (v.shape[0], v.shape[1], 1))
    m = _fb(u, v, 31, False, g=(64, 32, 16))
    barra = _w2(m > 0.64, _t(barra, 0.96), barra)
    barra = _w2(m < 0.3, _t(barra, 1.03), barra)
    # a tinta que descascou: manchas de concreto cinza com a borda irregular
    pe = (_fb(u, v, 33, False) + (_ns(u, v, 8, 34, False) - 0.5) * 0.1) > 0.6
    pe = _ero(_dil(pe, 1, False), 1, False)
    conc = _rampa(['#8e8a82', '#88847c', '#928e86'])[(_h(u // 8, v // 8, 3.0) * 3).astype(int) % 3]
    conc = _w2(_h(u // 2, v // 2, 4.0) < 0.05, _t(conc, 0.86), conc)
    barra = _w2(pe, conc, barra)
    barra = _falta(barra, pe, 1.1)
    out = _w2(v < 62, barra, out)
    out = _w2((v >= 62) & (v < 64), hx('#3e4740'), out)
    out = _w2(v == 61, _t(hx('#6c7a6f'), 1.12), out)
    return out


def _tex_parede_madeira():
    return _tex_parede(_pele_madeira, 'tijolo', 1.0, LING, 100, 0.3, 0.06, lambri=40)


def _tex_parede_xadrez():
    return _tex_parede(_pele_xadrez, 'tijolo', 0.95, [(18, 10, 130), (58, 8, 160), (92, 12, 100)], 200, 0.28, 0.07)


def _tex_parede_concreto():
    return _tex_parede(_pele_concreto, 'bloco', 0.85, [(30, 8, 110), (88, 10, 150)], 300, 0.26, 0.06)


def _material_parede(nome, fabrica):
    def parede(eixo):
        def f(L, n, P):
            u, v = _uv_parede(P, eixo)
            return _cache(nome, fabrica)[np.clip(v, 0, HP - 1), u % W]
        return emissivo(f)
    return parede


parede_madeira_q = _material_parede('par_mad', _tex_parede_madeira)
parede_xadrez_q = _material_parede('par_xad', _tex_parede_xadrez)
parede_concreto_q = _material_parede('par_con', _tex_parede_concreto)


ESTILOS = {
    'queimado_madeira': {'piso': piso_madeira_q, 'parede': parede_madeira_q, 'rodape': None, 'extra': None},
    'queimado_xadrez': {'piso': piso_xadrez_q, 'parede': parede_xadrez_q, 'rodape': None, 'extra': None},
    'queimado_concreto': {'piso': piso_concreto_q, 'parede': parede_concreto_q, 'rodape': None, 'extra': None},
}
