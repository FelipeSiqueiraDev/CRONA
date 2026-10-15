"""
A SALA DE UTENSÍLIOS da Casa de Mantimentos (Fazenda): a estante de tábuas cheia de utensílios de cozinha e a régua
de ganchos na parede, em pixel art 1:1, só por código, no estilo da cozinha (agente_cozinha/cozinha.py).

A fazenda está ABANDONADA há mais de um ano: nada novo, tudo velho e um pouco desarrumado (a frigideira com o cabo
para fora, a caneca de boca para baixo, as tampas encostadas tortas), a madeira acinzentada e a poeira por cima de
tudo (o que é topo puxa para o cinza da poeira).

  - estante_utensilios (2 × 1 casas, 2,0 m): a estante de tábuas rústicas, fechada dos lados e atrás (as costas lisas
    de tábua), quatro prateleiras e o tampo; em cada prateleira os utensílios: as panelas de alumínio de tamanhos
    diferentes, as frigideiras de ferro empilhadas, os pratos esmaltados, as canecas, o bule, a chaleira, os potes de
    vidro, a cesta com os talheres e as tampas encostadas no fundo.
  - utensilios_parede (64 × 40 px): a régua de madeira presa na parede com os ganchos; penduradas, as duas frigideiras
    (as da cozinha, CZ.frigideira), a concha, a escumadeira, as duas colheres de pau e a peneira.

Desenhado no giro 4 (a frente para +y), a pegada começando em (0, 0); o item de parede na parede de trás (y = 0).
"""
import math

import numpy as np

import cozinha as CZ
import base_estilo as BE
import parede_casa as PC
from base_estilo import (hx, liso, mad2, tab2, vol, _tom, _barra, _poligono_rodado, _disco, _fita, PH, PZ)
from motor import emissivo

M = BE.M

# ------------------------------------------------------------------ as cores ------------------------------------------------------------------
MAD = ['#7a5232', '#74502f', '#805836']        # as tábuas velhas (a cor do catálogo, já acinzentando)
MAD_J = '#33200f'                               # a junta
MAD_E = '#3a2618'                               # o fundo de dentro (na sombra)
PO = hx('#b0a48c')                              # a poeira
ALU, ALU_E = '#a2a8ae', '#7c8288'               # o alumínio (fosco, velho) e o escurecido
FERRO = '#383634'                               # a frigideira de ferro
ESM, ESM_A = '#e4e0d4', '#3e5f8e'               # o esmalte branco e a borda azul


def C():
    return CZ.c


def novo(contorno=True, sombra=True):
    return C().novo_obj(3, contorno=contorno, sombra=sombra)


def caixa(b, mat, sombra=False):
    return CZ.caixa(b, mat, tipo=3, sombra=sombra)


def _po(mat, k=0.3, lado=0.0):
    """A poeira por cima: o topo (e, com `lado`, as faces em pé) puxa para o cinza da poeira."""
    def f(L, n, P):
        out = mat(L, n, P)
        nn = np.asarray(n, float)
        nn = nn / np.linalg.norm(nn)
        kk = k if nn[2] > 0.6 else lado
        return out * (1 - kk) + PO * kk if kk else out
    f.emissivo = True
    return f


def _peq(x, y, r, z):
    CZ.itens_peq.append((x - r, x + r, y - r, y + r, z))


# =====================================================================================================================
# os utensílios (fechados de todos os lados: a estante gira)
# =====================================================================================================================
def panela_alu(x, y, z, r, h, tampa=False, cabo=None, orelhas=True, cor=ALU):
    """
    A panela de alumínio velha: o corpo com o fundo queimado (1 px escuro embaixo) e a boca com o lábio claro; aberta
    (o fundo escuro dentro) ou com a tampa abaulada e o pegador. cabo: '+x', '-x' ou '+y' (a caçarola de cabo comprido);
    orelhas: as duas alças pequenas dos lados.
    """
    o = novo()

    def faixas(P, base):
        zz = P[:, 2] - z
        base = np.where((zz > h - PZ)[:, None], _tom(base, 1.16), base)
        base = np.where((zz < 1.2 * PZ)[:, None], _tom(base, 0.62), base)
        return base
    _poligono_rodado(x, y, [(z, r * 0.95), (z + 0.012, r), (z + h, r)], vol(x, y, cor, brilho=0.45, faixas=faixas), o, lados=24)
    if tampa:
        _poligono_rodado(x, y, [(z + h, r + 0.008), (z + h + 0.014, r * 0.92), (z + h + 0.034, r * 0.4)], vol(x, y, cor, brilho=0.45), o,
                         lados=24, tampa_mat=_po(liso('#9ca2a8'), 0.35))
        c = C()
        c.cilindro(x, y, 0.022, z + h + 0.034, z + h + 0.056, vol(x, y, '#2a2624'), M, o, lados=10, tampa_mat=_po(liso('#3a3430'), 0.3))
    else:
        c0, cr = hx('#4a4e52'), hx('#c8ccd0')

        def boca(L, n, P):
            dx, dy = P[:, 0] - x, P[:, 1] - y
            rr = np.hypot(dx, dy)
            out = np.tile(c0, (len(P), 1))
            # a parede de dentro do lado de lá (pega luz) e o fundo, mais escuro
            out = np.where(((dy < 0) & (rr > r * 0.55))[:, None], _tom(c0, 1.25), out)
            out = np.where((rr > r - 0.014)[:, None], cr, out)
            return out
        _disco(x, y, z + h, r, _po(emissivo(boca), 0.18), o, lados=24)
    if orelhas and not cabo:
        for s in (-1, 1):
            xa = x + s * (r + 0.012)
            _barra((xa - 0.016, xa + 0.016, y - 0.022, y + 0.022, z + h - 0.035, z + h - 0.018), '#5e6266', '#8a9094', quina=False)
    if cabo:
        zc = z + h - 0.03
        if cabo == '+x':
            _barra((x + r - 0.005, x + r + 0.17, y - 0.014, y + 0.014, zc, zc + 0.022), '#2e2a28', '#4a4440', quina=False)
        elif cabo == '-x':
            _barra((x - r - 0.17, x - r + 0.005, y - 0.014, y + 0.014, zc, zc + 0.022), '#2e2a28', '#4a4440', quina=False)
        else:
            _barra((x - 0.014, x + 0.014, y + r - 0.005, y + r + 0.17, zc, zc + 0.022), '#2e2a28', '#4a4440', quina=False)
    _peq(x, y, r, z)
    return z + h + (0.056 if tampa else 0.0)


def frigideira_deitada(x, y, z, r, cabo='+y'):
    """A frigideira de ferro deitada: a borda baixa e aberta, o fundo preto com o anel de brilho e o cabo de ferro."""
    o = novo()
    h = 0.04
    _poligono_rodado(x, y, [(z, r * 0.8), (z + h, r)], vol(x, y, FERRO, brilho=0.35), o, lados=24)
    c0 = hx('#262422')

    def fundo(L, n, P):
        dx, dy = P[:, 0] - x, P[:, 1] - y
        rr = np.hypot(dx, dy)
        out = np.tile(c0, (len(P), 1))
        out = np.where(((rr > r * 0.42) & (rr < r * 0.58) & (dy < 0) & (dx < 0.3 * r))[:, None], hx('#4a4644'), out)
        out = np.where((rr > r * 0.84)[:, None], hx('#3e3a38'), out)
        out = np.where((rr > r - 0.012)[:, None], hx('#5a5654'), out)
        return out
    _disco(x, y, z + h, r, _po(emissivo(fundo), 0.2), o, lados=24)
    zc = z + h - 0.022
    L_ = 0.16
    if cabo == '+y':
        b = (x - 0.014, x + 0.014, y + r - 0.01, y + r + L_, zc, zc + 0.02)
    elif cabo == '+x':
        b = (x + r - 0.01, x + r + L_, y - 0.014, y + 0.014, zc, zc + 0.02)
    else:
        b = (x - r - L_, x - r + 0.01, y - 0.014, y + 0.014, zc, zc + 0.02)
    _barra(b, '#2a2826', '#4e4a46', quina=False)
    _peq(x, y, r, z)
    return z + h


def pilha_pratos(x, y, z, r, n, aro=ESM_A, lascado=True):
    """
    A pilha de pratos esmaltados: de lado, as bordas em fiadas (o branco e a borda azul, 1 px cada); em cima, o prato
    de cima (a aba, o fundo e a borda azul) com uma lasca preta no esmalte.
    """
    o = novo()
    hh = n * 1.5 * PZ

    def fiadas(P, base):
        k = np.floor((P[:, 2] - z) / PZ + 1e-6)
        return np.where((k % 3 == 2)[:, None], hx(aro), base)
    _poligono_rodado(x, y, [(z, r * 0.8), (z + PZ, r), (z + hh, r)], vol(x, y, ESM, brilho=0.3, faixas=fiadas), o, lados=22)
    cb, ca = hx(ESM), hx(aro)

    def topo(L, n_, P):
        dx, dy = P[:, 0] - x, P[:, 1] - y
        rr = np.hypot(dx, dy) / r
        out = np.tile(cb, (len(P), 1))
        out = np.where(((rr > 0.6) & (rr < 0.68))[:, None], _tom(cb, 0.86), out)
        out = np.where((rr > 0.86)[:, None], ca, out)
        if lascado:
            lasca = (rr > 0.72) & (np.abs(np.arctan2(dy, dx) - 2.2) < 0.22)
            out = np.where(lasca[:, None], hx('#2a2a30'), out)
        return out
    _disco(x, y, z + hh, r, _po(emissivo(topo), 0.22), o, lados=22)
    _peq(x, y, r, z)
    return z + hh


def tigelas(x, y, z, r, n, cor='#e4e0d4', aro='#a8442e'):
    """A pilha de tigelas de ágata (pratos fundos): cada uma um tronco de cone com a borda colorida."""
    o = novo()
    h = 0.03
    for k in range(n):
        zz = z + k * h
        borda = (lambda P, b, zz=zz: np.where((P[:, 2] - zz > h + 0.012 - PZ)[:, None], hx(aro), b))
        _poligono_rodado(x, y, [(zz, r * 0.62), (zz + h + 0.012, r)], vol(x, y, cor, brilho=0.3, faixas=borda), o, lados=20)
    zt = z + (n - 1) * h + h + 0.012
    cc = hx(cor)

    def boca(L, n_, P):
        rr = np.hypot(P[:, 0] - x, P[:, 1] - y) / r
        out = np.where((rr > 0.86)[:, None], hx(aro), _tom(cc, 0.88))
        return np.where(((rr < 0.55) & (P[:, 1] - y > -0.2 * r))[:, None], _tom(cc, 0.76), out)
    _disco(x, y, zt, r, _po(emissivo(boca), 0.2), o, lados=20)
    _peq(x, y, r, z)
    return zt


def caneca(x, y, z, cor='#e4dccb', borda='#34507a', virada=False, asa=1):
    """A caneca de ágata vazia (o fundo escuro dentro), ou virada de boca para baixo; a asa de lado."""
    r, h = 0.05, 0.1
    o = novo()

    def faixas(P, base):
        zz = P[:, 2] - z
        if virada:
            return np.where((zz < PZ)[:, None], hx(borda), base)
        return np.where((zz > h - PZ)[:, None], hx(borda), base)
    C().cilindro(x, y, r, z, z + h, vol(x, y, cor, brilho=0.3, faixas=faixas), M, o, lados=18, tampa=False)
    if virada:
        _disco(x, y, z + h, r, _po(emissivo(lambda L, n, P: np.tile(_tom(hx(cor), 0.92), (len(P), 1))), 0.3), o, lados=18)
    else:
        cc = hx(borda)

        def boca(L, n, P):
            rr = np.hypot(P[:, 0] - x, P[:, 1] - y)
            out = np.where((rr > r - 0.012)[:, None], hx('#ece6d6'), hx('#2e2a2c'))
            return np.where(((rr > r - 0.03) & (rr <= r - 0.012) & (P[:, 1] - y < 0))[:, None], _tom(cc, 0.8), out)
        _disco(x, y, z + h, r, emissivo(boca), o, lados=18)
    oa = novo()
    za = (z + 0.02, z + 0.08)
    _fita([(asa * 0.045, za[1]), (asa * 0.085, za[1] - 0.005), (asa * 0.092, (za[0] + za[1]) / 2), (asa * 0.085, za[0] + 0.005), (asa * 0.045, za[0])],
          x, y, emissivo(lambda L, n, P: np.tile(_tom(hx(cor), 0.86), (len(P), 1))), oa, 0.026)
    _peq(x, y, r, z)


def tampa_encostada(x, yb, z, r, incl=0.28, cor=ALU, pegador='#2a2624'):
    """
    A tampa de panela em pé, encostada no fundo (o alto inclinado para trás): o disco de alumínio com o anel e o
    pegador no meio. Fina (dois lados).
    """
    o = novo()
    zc = z + r * math.cos(math.asin(min(0.99, incl)))
    nrm = np.array([0.0, math.cos(math.asin(incl)), math.sin(math.asin(incl))])
    # o plano: y = yb + (zc - Z) * tan, o pé na frente, o alto para trás
    tg = incl / math.sqrt(1 - incl * incl)
    c0, cl, ce = hx(cor), _tom(hx(cor), 1.18), _tom(hx(cor), 0.78)

    def f(L, n, P):
        u = P[:, 0] - x
        v = (P[:, 2] - zc) / math.cos(math.asin(incl))
        rr = np.hypot(u, v) / r
        out = np.tile(c0, (len(P), 1))
        out = np.where(((rr > 0.5) & (rr < 0.6))[:, None], ce, out)
        out = np.where((rr > 0.86)[:, None], cl, out)
        out = np.where(((rr > 0.66) & (rr < 0.8) & (u < 0) & (v > 0))[:, None], cl, out)
        return out
    lados = 22
    pts = []
    for i in range(lados):
        a = 2 * math.pi * i / lados
        dz = r * math.sin(a) * math.cos(math.asin(incl))
        pts.append((x + r * math.cos(a), yb - dz * tg, zc + dz))
    C().face_plana(pts, tuple(nrm), emissivo(f), M, o, dois_lados=True)
    # o pegador: um toquinho saindo do meio para a frente
    yc = yb
    _barra((x - 0.02, x + 0.02, yc, yc + 0.03, zc - 0.012, zc + 0.012), pegador, '#4a4440', quina=False)


def cesta_talheres(x, y, z, r=0.095, hh=0.1):
    """A cesta de vime com os talheres de pé: os garfos e as colheres de lata e uma colher de pau, tortos."""
    CZ.cesto(x, y, z, r=r, hh=hh)
    zt = z + hh
    mt, md = liso('#b4b8bc'), liso('#a8763e')
    # (deslocamento na tela, inclinação, altura, cor, cabeça)
    for (s, ang, alto, mat, cab) in ((-0.05, -0.12, 0.13, mt, 'garfo'), (-0.02, -0.04, 0.16, md, 'pau'), (0.015, 0.05, 0.12, mt, 'colher'),
                                     (0.045, 0.14, 0.14, mt, 'garfo'), (0.0, 0.0, 0.1, mt, 'faca')):
        o = novo()
        s1 = s + ang * alto
        _fita([(s, zt - 0.03), (s1, zt + alto)], x, y, mat, o, 0.022 if cab != 'pau' else 0.026)
        if cab == 'colher':
            _fita([(s1 - 0.004, zt + alto - 0.01), (s1 + 0.004, zt + alto + 0.04)], x, y, liso('#c4c8cc'), o, 0.04)
        elif cab == 'pau':
            _fita([(s1 - 0.004, zt + alto - 0.01), (s1 + 0.006, zt + alto + 0.05)], x, y, liso('#b88450'), o, 0.05)
        elif cab == 'garfo':
            _fita([(s1, zt + alto - 0.01), (s1 + ang * 0.05, zt + alto + 0.04)], x, y, liso('#9ea2a6'), o, 0.04)
        else:
            _fita([(s1, zt + alto - 0.01), (s1, zt + alto + 0.05)], x, y, liso('#d0d4d8'), o, 0.03)


# =====================================================================================================================
# a estante de utensílios (2 × 1 casas, 2,0 m): as tábuas rústicas, as quatro prateleiras e o tampo, tudo fechado
# =====================================================================================================================
X0, X1 = 0.04, 1.46
Y0, Y1 = 0.04, 0.5
ALT = 2.0
E = 0.05                      # a grossura das laterais
EF = 0.03                     # a grossura do fundo
NIV = (0.12, 0.58, 1.04, 1.5)  # o tampo de cada prateleira
TOPO = ALT - 0.05


def _fundo_dentro():
    """O fundo por dentro: as tábuas em pé escuras e, logo embaixo de cada prateleira, a sombra (dois degraus)."""
    base = tab2([MAD_E, '#3e2a1b', '#362416'], 0.13, '#1e120a', eixo=1, seed=301, veio=False)

    def f(L, n, P):
        out = base(L, n, P)
        z = P[:, 2]
        for zt in NIV[1:] + (TOPO,):
            zb = zt - 0.035
            out = np.where(((z < zb) & (z > zb - 0.1))[:, None], _tom(out, 0.86), out)
            out = np.where(((z < zb) & (z > zb - 0.04))[:, None], _tom(out, 0.86), out)
        return out
    return emissivo(f)


def _lado_dentro():
    base = mad2('#4a3020', eixo=1, seed=302, passo=0.06, claro=1.06, escuro=0.94)

    def f(L, n, P):
        out = base(L, n, P)
        z = P[:, 2]
        for zt in NIV[1:] + (TOPO,):
            zb = zt - 0.035
            out = np.where(((z < zb) & (z > zb - 0.06))[:, None], _tom(out, 0.84), out)
        # a parte de trás do vão, mais funda (escura)
        return np.where((P[:, 1] < Y0 + 0.2)[:, None], _tom(out, 0.86), out)
    return emissivo(f)


def _prateleira_topo(seed):
    """O tampo da prateleira: as tábuas ao comprido, a poeira e o fundo na sombra da prateleira de cima."""
    base = tab2(['#8e6440', '#8a613e', '#946a44'], 0.135, MAD_J, eixo=0, seed=seed, org=Y0)

    def f(L, n, P):
        out = base(L, n, P)
        out = out * 0.72 + PO * 0.28
        y = P[:, 1]
        out = np.where((y < Y1 - 0.2)[:, None], _tom(out, 0.84), out)
        out = np.where((y < Y1 - 0.36)[:, None], _tom(out, 0.86), out)
        return out
    return emissivo(f)


def estante_utensilios(vazio=False):
    """
    A estante de utensílios da Casa de Mantimentos: as laterais e o fundo de tábua, o rodapé, as quatro prateleiras
    e o tampo saliente; cheia (de baixo para cima): o caldeirão tampado, a pilha de frigideiras e as panelas; os pratos
    esmaltados, as canecas e o bule; os potes de vidro, a cesta com os talheres e a chaleira; a pilha de panelas de
    alumínio, as tampas encostadas e a caçarola. Tudo empoeirado. vazio: só a estante.
    """
    LADO = _po(tab2(MAD, 0.125, MAD_J, eixo=1, seed=311, org=Y0), 0.3, 0.1)     # as tábuas em pé das laterais (por fora)
    COSTAS = _po(tab2(MAD, 0.14, MAD_J, eixo=1, seed=312, org=X0), 0.3, 0.1)   # as costas: as tábuas em pé, lisas
    PONTA = mad2('#94683f', eixo=1, seed=313, passo=0.05)            # a ponta das tábuas (a frente das laterais)
    TAMPO = _po(tab2(['#86603c', '#805c3a', '#8a643f'], 0.135, MAD_J, eixo=0, seed=314, org=Y0), 0.38)
    FRENTE_T = mad2('#7e5634', eixo=0, seed=315, passo=0.03)
    # o fundo (as costas lisas de tábua por fora, o escuro por dentro)
    caixa((X0, X1, Y0, Y0 + EF, 0.0, TOPO), {'frente': _fundo_dentro(), 'costas': COSTAS, 'cima': _po(liso('#6a4a2e'), 0.35), '*': PONTA})
    # as laterais
    caixa((X0, X0 + E, Y0 + EF, Y1, 0.0, TOPO), {'dir': _lado_dentro(), 'frente': PONTA, 'cima': _po(liso('#8a6440'), 0.35), '*': LADO})
    caixa((X1 - E, X1, Y0 + EF, Y1, 0.0, TOPO), {'esq': _lado_dentro(), 'frente': PONTA, 'cima': _po(liso('#8a6440'), 0.35), '*': LADO})
    # o rodapé (a tábua da frente embaixo da primeira prateleira, um pouco para dentro)
    caixa((X0 + E, X1 - E, Y1 - 0.045, Y1 - 0.02, 0.0, NIV[0] - 0.035), mad2('#5e3e26', eixo=0, seed=316, passo=0.03))
    # as prateleiras
    for k, z in enumerate(NIV):
        caixa((X0 + E, X1 - E, Y0 + EF, Y1 - 0.01, z - 0.035, z), {'cima': _prateleira_topo(320 + k), '*': FRENTE_T})
    # o tampo, saliente na frente e nos lados
    caixa((X0 - 0.02, X1 + 0.02, Y0, Y1 + 0.025, TOPO, ALT), {'cima': TAMPO, '*': mad2('#7a5432', eixo=0, seed=317, passo=0.03)})
    CZ.pegadas.append((X0, X1, Y0, Y1))
    if vazio:
        return
    ym = (Y0 + EF + Y1) / 2           # o meio do fundo da prateleira
    yf = Y1 - 0.14                    # mais para a frente
    yt = Y0 + EF + 0.04               # encostado no fundo

    def vao(i):
        BE._VAO['teto'] = (NIV[i + 1] if i + 1 < len(NIV) else TOPO) - 0.035

    # ---- 1ª (embaixo): o caldeirão tampado, a pilha de frigideiras de ferro com os cabos tortos, a panela com a
    # caçarola dentro (o cabo para fora) e as tigelas
    z = NIV[0]
    vao(0)
    tampa_encostada(0.7, yt, z, 0.14, incl=0.3)
    panela_alu(0.27, ym - 0.02, z, 0.17, 0.2, tampa=True)
    zz = frigideira_deitada(0.68, yf - 0.02, z, 0.15, cabo='+y')
    zz = frigideira_deitada(0.69, yf - 0.03, zz, 0.13, cabo='+x')
    frigideira_deitada(0.675, yf - 0.02, zz, 0.115, cabo='+y')
    panela_alu(1.06, yf - 0.03, z, 0.14, 0.13)
    panela_alu(1.07, yf - 0.02, z + 0.06, 0.1, 0.11, orelhas=False, cabo='+y', cor='#b2b8be')
    tigelas(1.3, Y1 - 0.08, z, 0.065, 3)
    # ---- 2ª: os pratos esmaltados empilhados (e um em pé atrás), as canecas (uma virada), o bule e os pratos fundos
    z = NIV[1]
    vao(1)
    CZ.prato_pe(0.38, yt, z + 0.11, 0.11, aro='#a8442e')
    pilha_pratos(0.24, ym, z, 0.125, 7)
    pilha_pratos(0.5, yf, z, 0.105, 6, aro='#4e7a52')
    caneca(0.72, ym - 0.04, z, asa=1)
    caneca(0.74, yf + 0.04, z, cor='#c8b48a', borda='#7a3a2a', virada=True, asa=-1)
    caneca(0.86, yf - 0.05, z, cor='#e4dccb', borda='#34507a', asa=1)
    CZ.bule(1.03, ym + 0.02, z)
    pilha_pratos(1.26, Y1 - 0.1, z, 0.085, 4, aro='#a8442e')
    # ---- 3ª: os potes de vidro (um quase vazio), a cesta com os talheres, a chaleira e a lata velha
    z = NIV[2]
    vao(2)
    for (xx, yy, cont, hh, rr) in ((0.17, ym - 0.05, '#5a2e1e', 0.17, 0.06), (0.32, ym - 0.03, '#ddd0a8', 0.2, 0.065),
                                   (0.47, ym - 0.05, '#a8b4ae', 0.14, 0.055), (0.27, yf + 0.04, '#c89a3a', 0.11, 0.05)):
        CZ.pote_vidro(xx, yy, z, cont, h=hh, r=rr)
    cesta_talheres(0.7, yf - 0.01, z)
    CZ.chaleira(1.04, ym + 0.03, z)
    CZ.lata(1.28, Y1 - 0.09, z, '#8a3a2a', 0.14)
    # ---- 4ª: a pilha de panelas de alumínio (de tamanhos diferentes), as tampas encostadas, a caçarola de cabo e a
    # frigideira pequena
    z = NIV[3]
    vao(3)
    tampa_encostada(0.66, yt, z, 0.14, incl=0.26)
    tampa_encostada(0.82, yt + 0.03, z, 0.11, incl=0.34, cor='#b0b6bc')
    panela_alu(0.28, ym, z, 0.17, 0.11)
    panela_alu(0.28, ym + 0.01, z + 0.06, 0.135, 0.11, cor='#aab0b6')
    panela_alu(0.29, ym, z + 0.12, 0.1, 0.1, orelhas=False)
    panela_alu(0.78, yf + 0.02, z, 0.11, 0.1, cabo='+y', orelhas=False, cor='#9aa0a6')
    zz = frigideira_deitada(1.13, yf, z, 0.12, cabo='+y')
    tigelas(1.13, yf, zz, 0.06, 2, cor='#e8e2d4', aro='#3e5f8e')
    BE._VAO['teto'] = None


# =====================================================================================================================
# os utensílios pendurados (64 × 40 px): a régua de madeira com os ganchos e o que pende dela
# =====================================================================================================================
def colher_pau(xc, zr, comp=0.34, larg=0.1, alto=0.13, cor='#b8844e'):
    """
    A colher de pau pendurada pelo furo do cabo (de frente): o cabo de 1 px e a concha oval embaixo, com a luz do
    lado de cima e a sombra do fundo. A concha sai um pouco mais larga que a de verdade, para não sumir no 1:1.
    """
    CZ._pend(xc, zr, None, comp=0.03)
    o = novo()
    y = 0.04
    z1 = zr - 0.025
    z0 = z1 - comp
    cz = z0 + alto / 2
    CZ.fp([(xc - 0.012, y, cz), (xc + 0.012, y, cz), (xc + 0.012, y, z1), (xc - 0.012, y, z1)], (0, 1, 0), liso(_hexs(_tom(hx(cor), 0.92))), o)
    pts = [(xc + larg / 2 * math.cos(t), y + 0.002, cz + alto / 2 * math.sin(t)) for t in np.linspace(0, 2 * math.pi, 18, endpoint=False)]
    c0 = hx(cor)

    def f(L, n, P):
        dx, dz = (P[:, 0] - xc) / (larg / 2), (P[:, 2] - cz) / (alto / 2)
        out = np.tile(c0, (len(P), 1))
        out = np.where(((dx * dx + dz * dz < 0.42) & (dz < 0.3))[:, None], _tom(c0, 0.84), out)
        out = np.where(((dx < -0.2) & (dz > 0.25) & (dx * dx + dz * dz > 0.42))[:, None], _tom(c0, 1.14), out)
        return out
    CZ.fp(pts, (0, 1, 0), emissivo(f), o)


def _hexs(cor):
    return '#%02x%02x%02x' % tuple(int(round(v)) for v in np.clip(cor, 0, 255))


def _cabo_lata(xc, z0, z1, oid):
    """O cabo de lata de 1 px de frente (a face clara com a quina de brilho), sem a caixa fina que vira só contorno."""
    CZ.fp([(xc - 0.013, 0.05, z0), (xc + 0.013, 0.05, z0), (xc + 0.013, 0.05, z1), (xc - 0.013, 0.05, z1)], (0, 1, 0), liso('#b4b8bc'), oid)


def concha(xc, zr, r=0.07, comp=0.3):
    """
    A concha de servir (de frente): o cabo comprido de lata com o furo em cima e a cuia embaixo, a borda clara e o
    fundo escuro da cuia (a parte de dentro que aparece). Maior que a da cozinha (CZ.concha), para ler no 1:1.
    """
    CZ._pend(xc, zr, None)
    o = novo()
    zc = zr - 0.04 - comp
    _cabo_lata(xc, zc, zr - 0.035, o)
    lados = 18

    def f(L, n, P):
        dx, dz = (P[:, 0] - xc) / r, (P[:, 2] - zc) / r
        out = np.tile(hx('#a2a6aa'), (len(P), 1))
        out = np.where((dz > -0.05)[:, None], hx('#4e5256'), out)
        out = np.where(((dz > -0.05) & (dz < 0.25))[:, None], hx('#c8ccd0'), out)
        out = np.where(((dz < -0.3) & (dx < -0.2))[:, None], hx('#c0c4c8'), out)
        return out
    pts = [(xc + r * math.cos(t), 0.054, zc + r * 0.8 * math.sin(t)) for t in np.linspace(math.pi, 2 * math.pi, lados)]
    pts += [(xc + r, 0.054, zc + 0.03), (xc - r, 0.054, zc + 0.03)]
    CZ.fp(pts, (0, 1, 0), emissivo(f), o)


def escumadeira(xc, zr, r=0.075, comp=0.28):
    """A escumadeira de lata: o cabo comprido e o disco raso com os furos em blocos (de 3 em 3 px, sem xadrez)."""
    CZ._pend(xc, zr, None)
    zc = zr - 0.04 - comp
    o = novo()
    _cabo_lata(xc, zc + r * 0.7, zr - 0.035, o)

    def f(L, n, P):
        u, v = (P[:, 0] - xc) / PH, (P[:, 2] - zc) / PZ
        out = np.tile(hx('#a4a8ac'), (len(P), 1))
        rr = np.hypot((P[:, 0] - xc) / r, (P[:, 2] - zc) / (r * 0.9))
        out = np.where(((rr < 0.8) & (P[:, 2] > zc) & (P[:, 0] < xc))[:, None], hx('#b8bcc0'), out)
        out = np.where((rr > 0.8)[:, None], hx('#cfd3d6'), out)
        furo = (rr < 0.66) & (np.floor(u + 0.5) % 3 == 0) & (np.floor(v + 0.5) % 3 == 0)
        return np.where(furo[:, None], hx('#3e4246'), out)
    lados = 18
    CZ.fp([(xc + r * math.cos(2 * math.pi * i / lados), 0.056, zc + r * 0.9 * math.sin(2 * math.pi * i / lados)) for i in range(lados)], (0, 1, 0),
          emissivo(f), o)


def peneira(xc, zr, r=0.15, fio=0.08):
    """A peneira de taquara: o aro de madeira vergada e a trama de palha (em blocos de 2 px), pendurada pelo barbante."""
    CZ._pend(xc, zr, None, comp=0.03)
    zc = zr - 0.04 - fio - r
    o = novo()
    y = 0.045
    lados = 26

    def f(L, n, P):
        u, v = (P[:, 0] - xc) / PH, (P[:, 2] - zc) / PZ
        rr = np.hypot(P[:, 0] - xc, P[:, 2] - zc) / r
        out = np.tile(hx('#c8a868'), (len(P), 1))
        # a trama: as fitas em blocos de 2 px, alternadas por fileira de 2
        bloco = ((np.floor(u / 2) + np.floor(v / 2)) % 2 == 0)
        out = np.where(bloco[:, None], hx('#b49456'), out)
        # a sombra do aro em cima, por dentro
        out = np.where(((rr > 0.7) & (P[:, 2] > zc))[:, None], _tom(out, 0.84), out)
        out = np.where((rr > 0.84)[:, None], hx('#8a5a2e'), out)
        out = np.where(((rr > 0.84) & (rr < 0.93) & (P[:, 2] < zc))[:, None], hx('#a87040'), out)
        return out
    CZ.fp([(xc + r * math.cos(2 * math.pi * i / lados), y, zc + r * math.sin(2 * math.pi * i / lados)) for i in range(lados)], (0, 1, 0), emissivo(f), o)
    CZ.fp([(xc + r * math.cos(2 * math.pi * i / lados), 0.0, zc + r * math.sin(2 * math.pi * i / lados)) for i in range(lados)][::-1], (0, -1, 0), liso('#6a4422'), o)
    # o barbante (do gancho ao aro)
    _barra((xc - 0.006, xc + 0.006, 0.03, 0.045, zc + r - 0.01, zr - 0.03), '#8a7a58', quina=False)


def utensilios_parede(xc=1.5, zc=1.5):
    """
    A régua de madeira dos utensílios (64 × 40 px): a ripa velha presa com dois pregos, os ganchos em S e, penduradas,
    a frigideira grande, as duas colheres de pau, a peneira, a concha, a escumadeira e a frigideira pequena.
    Do alto da régua (zc + 0,31) ao fundo da frigideira grande (zc - 0,31): o meio do desenho é (xc, zc).
    """
    n0 = len(C().objs)
    a = 0.7
    zr = zc + 0.23                      # a linha dos ganchos
    zt = zr + 0.1                       # o alto da régua
    regua = caixa((xc - a, xc + a, 0.0, 0.04, zr - 0.01, zt), {'*': mad2('#7a5232', eixo=0, seed=331, passo=0.04),
                                                               'cima': _po(liso('#8e6842'), 0.35)})
    for xx in (xc - a + 0.05, xc + a - 0.08):
        _barra((xx, xx + 0.03, 0.04, 0.05, zr + 0.025, zr + 0.055), '#2e2a28', '#6a625c', quina=False)
    CZ.frigideira(xc - 0.5, zr, 0.15)
    colher_pau(xc - 0.3, zr, comp=0.4, larg=0.11, alto=0.14)
    colher_pau(xc - 0.19, zr, comp=0.32, larg=0.1, alto=0.13, cor='#a8763e')
    peneira(xc + 0.06, zr, 0.14, fio=0.1)
    concha(xc + 0.28, zr, r=0.075, comp=0.36)
    escumadeira(xc + 0.43, zr, r=0.075, comp=0.19)
    CZ.frigideira(xc + 0.6, zr, 0.1)
    PC.sombra_parede(n0, 1, 2, sobre=(regua,))


ITENS = {
    'estante_utensilios': (2, 1, (0.0, 0.0), estante_utensilios, {}),
}
ITENS_PAREDE = {
    'utensilios_parede': (lambda: utensilios_parede(1.5, 1.5), (1.5, 1.5)),
}
