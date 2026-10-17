"""
GRUPO A, "a casa": os móveis de casa (quarto, sala, jantar, escritório, banheiro, tapetes e luzes) em pixel art 1:1,
no estilo da cozinha da fazenda (agente_cozinha/cozinha.py). A versão "normal, bem cuidada" (o queimado é outro grupo).

Cada peça é desenhada no giro 4 (a frente para +y), com a pegada começando em (0, 0), no tamanho final do catálogo
(def.height em metros; o `aumento` entra só na largura e no fundo, a altura é a de verdade). O exportador (exportar_px.py) gira e faz o acabamento.

Decisões (o que o catálogo deixava em aberto):
  - armchair, bench, toilet, stool: o `height` é a altura do ASSENTO (é onde a peça senta); o encosto passa dele.
  - desk_lamp, candles: desenhados no chão da casa (z = 0); o jogo empilha em cima do tampo.
  - ceiling_lamp: height 0; a cúpula fica no alto (2,3 m), o fio sobe e some em transparência antes de 2,85 m.
  - estados das luzes: o jogo usa 0 = aceso (furniArte.ts); o desenho padrão é o aceso, o estado '1' é o apagado.
  - beliche: leitos 0,55 m e 1,52 m (0,9 e 2,48 unidades); a escada é o pé da cama de cima.
  - tapetes: decalque de 1 px de altura, sem sombra no chão (não entram nas pegadas).
"""
import math

import numpy as np

import cozinha as CZ
import base_estilo as BE
from base_estilo import (hx, liso, mad2, tab2, vol, _tom, _pau, _barra, _p1_malha, _p1_mat_rampa, _p1_rampa,
                         _poligono_rodado, _disco, PH, PZ)
from motor import emissivo, ruido, suave, KX, KZ

M = BE.M
CASA = 0.75
UN = 1.633                      # unidades do jogo por metro

# ------------------------------------------------------------------ as madeiras ------------------------------------------------------------------
NOG_TAB = ['#8e4a2c', '#884629', '#924e2e', '#844428']   # o tampo de nogueira (o da mesa da cozinha)
NOG = '#6c341c'                                           # o corpo
NOG_E = '#4a2412'                                         # o escuro (o rodapé, o vão)
JAC = '#5a2a18'                                           # o jacarandá (o guarda-roupa, o aparador)
JAC_TAB = ['#74381e', '#6e351c', '#7a3c20']
PINHO = ['#b88a58', '#b08254', '#bc8e5c']                 # as costas (o pinho cru)
CLARA = '#9a5a30'                                         # a madeira clara (a prateleira rústica)
CLARA_TAB = ['#b07440', '#a86e3c', '#b67a44']
LATAO, LATAO_L = '#b8862e', '#e8c060'


def C():
    return CZ.c


def caixa(b, mat, sombra=False, ch=0.0):
    return CZ.caixa(b, mat, tipo=3, sombra=sombra, ch=ch)


def peg(x0, x1, y0, y1):
    CZ.pegadas.append((x0, x1, y0, y1))


def novo(contorno=True, sombra=True):
    return C().novo_obj(3, contorno=contorno, sombra=sombra)


# ------------------------------------------------------------------ materiais ------------------------------------------------------------------
def almofadas(cor, paineis, eixo=0, seed=0, passo=0.06, fresta=None, u_fn=None):
    """
    A madeira com gavetas e portas na face da frente (+y): paineis = (u0, u1, z0, z1, tipo), u = x. tipo 'g' gaveta
    (a fresta de 1 px, a luz em cima e à esquerda, a sombra embaixo e à direita), 'p' porta almofadada (com o rebaixo
    do meio), 'e' porta com espelho (o vidro prateado no rebaixo).
    u_fn: para a folha de porta que gira (aberta): devolve o u de cada ponto (a distância ao longo da folha) e a
    almofada vale em qualquer face (sem u_fn, só na da frente, +y, e u = x).
    """
    base = mad2(cor, eixo=eixo, seed=seed, passo=passo)
    c0 = hx(cor)
    fr_c = hx(fresta) if fresta else _tom(c0, 0.42)

    def f(L, n, P):
        out = base(L, n, P)
        if u_fn is None and n[1] <= 0.5:
            return out
        u, z = (P[:, 0] if u_fn is None else u_fn(P)), P[:, 2]
        for (u0, u1, z0, z1, k) in paineis:
            d = (u >= u0) & (u < u1) & (z >= z0) & (z < z1)
            fr = d & ((u < u0 + PH) | (u >= u1 - PH) | (z < z0 + PZ) | (z >= z1 - PZ))
            luz = d & ~fr & ((z >= z1 - 2 * PZ) | (u < u0 + 2 * PH))
            som = d & ~fr & ((z < z0 + 2 * PZ) | (u >= u1 - 2 * PH))
            out = np.where(luz[:, None], _tom(out, 1.13), out)
            out = np.where(som[:, None], _tom(out, 0.84), out)
            if k in 'pe':
                m = min(0.055, (u1 - u0) * 0.22)
                mz = min(0.065, (z1 - z0) * 0.18)
                mi = d & (u >= u0 + m) & (u < u1 - m) & (z >= z0 + mz) & (z < z1 - mz)
                mib = mi & ((u < u0 + m + PH) | (z >= z1 - mz - PZ))
                mil = mi & ((u >= u1 - m - PH) | (z < z0 + mz + PZ))
                if k == 'e':
                    vid = mi & ~mib & ~mil
                    g = np.floor((u - u0) / PH) + np.floor((z1 - z) / PZ)
                    esp = np.tile(hx('#9fb4bc'), (len(P), 1))
                    esp = np.where((((g % 16) < 2) | ((g % 16) == 4))[:, None], hx('#d8e6ea'), esp)
                    esp = np.where((z > z1 - mz - 4 * PZ)[:, None], _tom(esp, 0.9), esp)
                    out = np.where(vid[:, None], esp, out)
                out = np.where(mib[:, None], _tom(c0, 0.7), out)
                out = np.where(mil[:, None], _tom(c0, 1.18), out)
            out = np.where(fr[:, None], fr_c, out)
        return out
    return emissivo(f)


def botao(x, z, yf, cor=LATAO, topo=LATAO_L):
    """O puxador redondo (2 x 2 px) saindo da frente (y = yf)."""
    _barra((x - PH, x + PH, yf, yf + 0.02, z - PZ, z + PZ), cor, topo, quina=False)


def alca(x, z, yf, larg=0.09):
    """A alça de latão das gavetas: a barra e as duas pontas."""
    _barra((x - larg / 2, x + larg / 2, yf + 0.012, yf + 0.026, z - 0.5 * PZ, z + 1.0 * PZ), LATAO, LATAO_L, quina=False)
    for xx in (x - larg / 2, x + larg / 2 - PH):
        _barra((xx, xx + PH, yf, yf + 0.026, z - 0.5 * PZ, z + 1.0 * PZ), '#8a6420', quina=False)


def perna_torneada(x, y, z0, z1, r, cor):
    """A perna torneada (a bola, o pescoço, o anel): troncos de cone com a luz pela volta."""
    h = z1 - z0
    perfil = [(z0, r * 0.62), (z0 + h * 0.08, r * 0.72), (z0 + h * 0.14, r * 0.95), (z0 + h * 0.24, r * 0.9),
              (z0 + h * 0.4, r * 0.66), (z0 + h * 0.6, r * 0.62), (z0 + h * 0.7, r * 0.95), (z0 + h * 0.76, r * 0.72),
              (z0 + h * 0.8, r), (z1, r)]
    o = novo()
    _poligono_rodado(x, y, perfil, vol(x, y, cor), o, lados=12)


def pe_bola(x, y, z1, r, cor):
    """O pezinho em bola (a cômoda, o aparador)."""
    o = novo()
    _poligono_rodado(x, y, [(0.0, r * 0.7), (z1 * 0.35, r), (z1 * 0.75, r * 0.85), (z1, r * 0.9)], vol(x, y, cor), o, lados=12)


# ------------------------------------------------------------------ os móveis ABERTOS (portas, gavetas) ------------------------------------------------------------------
def dentro(cor='#2c170c', z0=0.0, z1=1.0):
    """
    O interior de um móvel aberto: bem mais escuro que a face de fora, com a sombra do tampo (os últimos pixels de
    cima mais escuros) e um fio de luz perto do chão do vão; em degraus, sem degradê liso.
    """
    c0 = hx(cor)

    def f(L, n, P):
        z = P[:, 2]
        out = np.tile(c0, (len(P), 1))
        out = np.where((z > z1 - 5 * PZ)[:, None], _tom(c0, 0.82), out)
        out = np.where((z > z1 - 2 * PZ)[:, None], _tom(c0, 0.64), out)
        out = np.where((z < z0 + 1.5 * PZ)[:, None], _tom(c0, 1.18), out)
        return out
    return emissivo(f)


def casca(x0, x1, y0, y1, zb, zc, e, fora, IN, costas, fundo=None, tras=None):
    """
    A carcaça de um móvel de abrir, sem a frente (+y): o fundo, as duas laterais e o chão do vão, com o lado de
    dentro `IN` (escuro). fora: a madeira por fora. costas: a face de trás do fundo.
    """
    caixa((x0, x1, y0, y0 + e, zb, zc), {'frente': IN, 'costas': costas, '*': fora})
    caixa((x0, x0 + e, y0 + e, y1, zb, zc), {'dir': IN, '*': fora})
    caixa((x1 - e, x1, y0 + e, y1, zb, zc), {'esq': IN, '*': fora})
    caixa((x0 + e, x1 - e, y0 + e, y1, zb, zb + e), {'cima': fundo or IN, '*': fora})


def prateleira_in(x0, x1, y0, y1, z, e=0.02, fora=None, cor='#4a2a16'):
    """Uma prateleira dentro do vão: o tampo claro (pega a luz) e a quina da frente."""
    caixa((x0, x1, y0, y1, z - e, z), {'cima': liso(cor), '*': fora or mad2('#6c341c', eixo=1, seed=7, passo=0.05)})


def porta_giro(H, ang, W, z0, z1, mat_f, mat_d, esp=0.026, lado=1, mat_b=None):
    """
    A folha de porta aberta: dobradiça em H = (x, y), a folha parte dela na direção `ang` (graus, de +x girando para
    +y; a porta fechada da dobradiça da esquerda é 0, a da direita 180), de largura W e espessura esp; o lado de fora
    (a face que era a da frente) é `mat_f` e o de dentro `mat_d`. lado = 1 dobradiça na esquerda, -1 na direita.
    """
    th = math.radians(ang)
    dx, dy = math.cos(th), math.sin(th)
    nx, ny = -lado * dy, lado * dx                      # a normal da face de fora
    Hx, Hy = H
    A, B = (Hx, Hy), (Hx + W * dx, Hy + W * dy)
    A2, B2 = (Hx - esp * nx, Hy - esp * ny), (B[0] - esp * nx, B[1] - esp * ny)
    o = novo()
    fp = CZ.fp
    mb = mat_b or mat_d

    def q(P, Q, nn, m):
        fp([(P[0], P[1], z0), (Q[0], Q[1], z0), (Q[0], Q[1], z1), (P[0], P[1], z1)], nn, m, o)
    q(A, B, (nx, ny, 0), mat_f)
    q(B2, A2, (-nx, -ny, 0), mat_d)
    q(A2, A, (-dx, -dy, 0), mb)
    q(B, B2, (dx, dy, 0), mb)
    fp([(A[0], A[1], z1), (B[0], B[1], z1), (B2[0], B2[1], z1), (A2[0], A2[1], z1)], (0, 0, 1), mb, o)
    return o


def mat_folha(cor, paineis, H, ang, seed=0, passo=0.05):
    """A madeira da folha de porta aberta, com as almofadas (u = a distância à dobradiça ao longo da folha)."""
    th = math.radians(ang)
    dx, dy = math.cos(th), math.sin(th)
    return almofadas(cor, paineis, eixo=1, seed=seed, passo=passo, u_fn=lambda P: (P[:, 0] - H[0]) * dx + (P[:, 1] - H[1]) * dy)


def tirador(H, ang, u, z, lado=1, esp=0.026, larg=0.012):
    """O puxador de latão na face de fora de uma folha aberta (u = a distância à dobradiça)."""
    th = math.radians(ang)
    dx, dy = math.cos(th), math.sin(th)
    nx, ny = -lado * dy, lado * dx
    px, py = H[0] + u * dx + nx * 0.014, H[1] + u * dy + ny * 0.014
    _barra((px - larg, px + larg, py - larg, py + larg, z - 0.03, z + 0.03), LATAO, LATAO_L, quina=False)


def gaveta_puxada(gx0, gx1, yf, ge, gz0, gz1, fr_mat, funda=0.38, cor='#b08254', tecidos=(), alcas=(), esp=0.014):
    """
    A gaveta puxada: o vão escuro na frente do móvel (y = yf), a gaveta saindo `ge` para a frente (o fundo e as
    laterais de pinho, a testeira com o material `fr_mat` e as alças em `alcas` = [x]), e o que ela guarda em
    `tecidos` = [(x0, x1, y0, y1, cor)] (panos dobrados, que passam da borda).
    """
    caixa((gx0 - 0.005, gx1 + 0.005, yf, yf + 0.004, gz0 - 0.004, gz1 + 0.004), liso('#1c0e06'))
    yb, yfr = yf - funda + ge, yf + ge
    MAD = mad2(cor, eixo=0, seed=9, passo=0.04)
    caixa((gx0 + 0.012, gx1 - 0.012, yb, yfr, gz0 + 0.01, gz0 + 0.026), {'cima': tab2(PINHO, 0.1, '#8a6038', eixo=0, seed=8, org=yb), '*': MAD})
    caixa((gx0 + 0.012, gx0 + 0.012 + esp, yb, yfr, gz0 + 0.01, gz1 - 0.025), {'dir': liso('#a87a4c'), '*': MAD})
    caixa((gx1 - 0.012 - esp, gx1 - 0.012, yb, yfr, gz0 + 0.01, gz1 - 0.025), {'esq': liso('#7a5430'), '*': MAD})
    caixa((gx0 + 0.012, gx1 - 0.012, yb, yb + esp, gz0 + 0.01, gz1 - 0.025), {'frente': liso('#a0724a'), '*': MAD})
    for (a0, a1, b0, b1, cc) in tecidos:
        _p1_malha((a0, a1, yb + b0, yb + b1, gz0 + 0.026, gz1 - 0.005), (0.02, 0.02, 0.01, 0.025), liso(cc), seg=2)
    caixa((gx0, gx1, yfr, yfr + 0.026, gz0, gz1), {'frente': fr_mat, '*': mad2(NOG, eixo=1, seed=4, passo=0.05)})
    for xa in alcas:
        alca(xa, (gz0 + gz1) / 2, yfr + 0.026, 0.07)


def livro(x0, x1, y0, y1, z0, z1, cor, lomba='frente'):
    """O livro deitado: a capa em cima, a lombada de cor numa das faces e as folhas creme nas outras."""
    pag = emissivo(lambda L, n, P: np.where(((np.floor(P[:, 2] / PZ) % 2) == 0)[:, None], hx('#d8c8a0'), hx('#c0ae84')))
    ca = liso(cor)
    caixa((x0, x1, y0, y1, z0, z1), {'cima': ca, lomba: liso(_hexn(_tom(hx(cor), 0.8))), '*': pag})


def _hexn(v):
    v = np.clip(np.round(np.asarray(v, float)), 0, 255).astype(int)
    return '#%02x%02x%02x' % tuple(v)


def _ret_redondo(cx, cy, ax, ay, r, z, n=6):
    """Os pontos de um retângulo de quinas redondas (convexo), no plano z."""
    pts = []
    for (sx, sy, a0) in ((1, 1, 0), (-1, 1, 90), (-1, -1, 180), (1, -1, 270)):
        qx, qy = cx + sx * (ax - r), cy + sy * (ay - r)
        for i in range(n + 1):
            a = math.radians(a0 + 90 * i / n)
            pts.append((qx + r * math.cos(a), qy + r * math.sin(a), z))
    return pts


def _sdf_ret(X, Y, cx, cy, ax, ay, r):
    """A distância para dentro da borda do retângulo redondo (> 0 dentro)."""
    qx = np.abs(X - cx) - (ax - r)
    qy = np.abs(Y - cy) - (ay - r)
    fora = np.hypot(np.maximum(qx, 0), np.maximum(qy, 0)) + np.minimum(np.maximum(qx, qy), 0)
    return r - fora


def bacia(cx, cy, ax, ay, r, z, aro=0.045, agua=True, esmalte='#e8ece8'):
    """
    O que se vê de cima numa bacia esmaltada (a banheira, a pia): a borda clara, a parede de dentro do lado de lá (a
    câmera vê a do fundo, pela vista do giro) mais clara, o fundo e, com água, o espelho d'água com o brilho.
    """
    hv, _ = BE.frente_tela()
    e = hx(esmalte)

    def f(L, n, P):
        X, Y = P[:, 0], P[:, 1]
        d = _sdf_ret(X, Y, cx, cy, ax, ay, r)
        ux, uy = (X - cx) / ax, (Y - cy) / ay
        nr = np.maximum(np.hypot(ux, uy), 1e-6)
        lado = -(ux * hv[0] + uy * hv[1]) / nr            # 1 do lado de lá (a parede que se vê)
        parede = aro + 0.025 + 0.13 * np.clip(lado, 0, 1)
        out = np.tile(_tom(e, 1.04), (len(P), 1))
        out = np.where((d < PH * 1.5)[:, None], _tom(e, 0.9), out)               # a quina de fora da borda
        out = np.where(((d >= aro - PH) & (d < aro))[:, None], _tom(e, 0.78), out)   # a quina de dentro
        dentro = d >= aro
        par = dentro & (d < parede)
        out = np.where(par[:, None], np.where((lado > 0.2)[:, None], _tom(e, 0.97), _tom(e, 0.8)), out)
        fundo = dentro & ~par
        if agua:
            ag = np.tile(hx('#8ab8c0'), (len(P), 1))
            ag = np.where((d < parede + PH * 1.5)[:, None], hx('#a8ccd0'), ag)
            g = np.floor(X / PH) - np.floor(Y / PH)
            ag = np.where((((g % 23) < 2) & (d > parede + 0.04))[:, None], hx('#c4e0e2'), ag)
            out = np.where(fundo[:, None], ag, out)
        else:
            out = np.where(fundo[:, None], _tom(e, 0.86), out)
            ralo = np.hypot((X - cx) * KX, (Y - cy) * KX) < 1.2
            out = np.where((fundo & ralo)[:, None], hx('#6a6e70'), out)
        return out
    return emissivo(f)


# =====================================================================================================================
# o quarto: o criado-mudo, a cômoda, o guarda-roupa
# =====================================================================================================================
def criado_mudo(aberto=False, vazio=False):
    """
    O criado-mudo de nogueira (0,6 m): a gaveta com a alça, a portinha, os pés torneados curtos, o tampo.
    aberto: a gaveta puxada (o livro e a vela de cera no fundo dela) e a portinha aberta pela dobradiça da esquerda
    (os livros empilhados e a jarra lá dentro); vazio: o mesmo aberto, sem o que ficava dentro.
    """
    x0, x1, y0, y1 = 0.1, 0.65, 0.06, 0.54
    zt = 0.98 / UN
    pain = [(x0 + 0.03, x1 - 0.03, 0.43, 0.53, 'g'), (x0 + 0.03, x1 - 0.03, 0.13, 0.4, 'p')]
    for (a, b) in ((x0 + 0.04, y0 + 0.04), (x1 - 0.04, y0 + 0.04), (x0 + 0.04, y1 - 0.04), (x1 - 0.04, y1 - 0.04)):
        pe_bola(a, b, 0.09, 0.03, NOG_E)
    zb, zc = 0.08, zt - 0.035
    if not aberto:
        caixa((x0, x1, y0, y1, zb, zc), {'frente': almofadas(NOG, pain, seed=3), 'costas': tab2(PINHO, 0.12, '#6a4426', eixo=1, seed=5),
                                         '*': mad2(NOG, eixo=1, seed=4, passo=0.05)})
    else:
        e = 0.03
        zd = 0.415                                    # a prateleira entre a gaveta e a portinha
        FORA = mad2(NOG, eixo=1, seed=4, passo=0.05)
        IN = dentro('#2a150b', zb, zc)
        casca(x0, x1, y0, y1, zb, zc, e, FORA, IN, tab2(PINHO, 0.12, '#6a4426', eixo=1, seed=5), fundo=liso('#3a1e10'))
        caixa((x0 + e, x1 - e, y0 + e, y1, zd - 0.02, zd), {'cima': liso('#5a3018'), 'frente': liso('#6a3a1e'), '*': FORA})
        # a gaveta puxada uns 40%: a testeira com a alça, as laterais e o fundo de pinho
        ge, gz0, gz1 = 0.2, 0.43, 0.53
        gx0, gx1 = x0 + e + 0.01, x1 - e - 0.01
        gy0, gy1 = y0 + 0.08, y1 + ge
        PIN = tab2(PINHO, 0.1, '#8a6038', eixo=0, seed=8, org=gy0)
        caixa((gx0, gx1, gy0, gy1, gz0, gz0 + 0.012), {'cima': PIN, '*': mad2('#b08254', eixo=0, seed=9, passo=0.04)})
        caixa((gx0, gx0 + 0.015, gy0, gy1, gz0, gz1 - 0.02), {'dir': liso('#a87a4c'), '*': mad2('#b08254', eixo=0, seed=9, passo=0.04)})
        caixa((gx1 - 0.015, gx1, gy0, gy1, gz0, gz1 - 0.02), {'esq': liso('#7a5430'), '*': mad2('#b08254', eixo=0, seed=9, passo=0.04)})
        caixa((gx0, gx1, gy0, gy0 + 0.015, gz0, gz1 - 0.02), {'frente': liso('#a0724a'), '*': mad2('#b08254', eixo=0, seed=9, passo=0.04)})
        caixa((gx0 - 0.01, gx1 + 0.01, gy1, gy1 + 0.025, gz0 - 0.005, gz1), {'frente': almofadas(NOG, [(gx0 + 0.02, gx1 - 0.02, gz0 + 0.0, gz1 - 0.005, 'g')], seed=3),
                                                                             '*': mad2(NOG, eixo=1, seed=4, passo=0.05)})
        alca((gx0 + gx1) / 2, 0.48, gy1 + 0.025)
        if not vazio:
            livro(gx0 + 0.04, gx0 + 0.2, gy0 + 0.1, gy0 + 0.3, gz0 + 0.012, gz0 + 0.04, '#3e5a74')
            for (xx, cc) in ((gx1 - 0.1, '#e8e0c8'), (gx1 - 0.19, '#d0c8b0')):
                caixa((xx - 0.025, xx + 0.025, gy0 + 0.08, gy0 + 0.17, gz0 + 0.012, gz0 + 0.1), {'cima': liso('#c07a3a'), '*': liso(cc)})
        # a portinha aberta (dobradiça na esquerda, aberta uns 105 graus: a folha sai para a frente e um pouco para o lado)
        pz0, pz1 = 0.095, 0.405
        H = (x0, y1 + 0.0)
        ang = 105
        pd = [(0.03, y1 - y0 - 0.03 + 0.0, pz0 + 0.04, pz1 - 0.04, 'p')]
        W = x1 - x0
        pd = [(0.02, W - 0.02, pz0 + 0.02, pz1 - 0.02, 'p')]
        porta_giro(H, ang, W, pz0, pz1, mat_folha(NOG, pd, H, ang, seed=3), mad2(_hexn(_tom(hx(NOG), 0.9)), eixo=1, seed=4, passo=0.05),
                   mat_b=mad2(NOG, eixo=1, seed=4, passo=0.05))
        if not vazio:
            for (a0, a1, cc) in ((x0 + e + 0.03, x0 + e + 0.27, '#7a2a24'), (x0 + e + 0.02, x0 + e + 0.25, '#2e4c3c')):
                pass
            zz = zb + e
            for k, (cc, d) in enumerate((('#7a2a24', 0.0), ('#2e4c3c', 0.01), ('#9e6a34', -0.01))):
                livro(x0 + e + 0.03 + d, x0 + e + 0.3 + d, y0 + e + 0.1, y0 + e + 0.3, zz, zz + 0.035, cc)
                zz += 0.035
            vx, vy = x1 - e - 0.12, y0 + e + 0.15
            o = novo()
            _poligono_rodado(vx, vy, [(zb + e, 0.04), (zb + e + 0.05, 0.065), (zb + e + 0.12, 0.06), (zb + e + 0.17, 0.03), (zb + e + 0.2, 0.026)],
                             vol(vx, vy, '#8a5a3a', brilho=0.3), o, lados=12)
    caixa((x0 - 0.015, x1 + 0.015, y0 - 0.01, y1 + 0.02, zt - 0.035, zt), {'cima': tab2(NOG_TAB, 0.16, '#3e1c0e', seed=6, org=y0),
                                                                            '*': _pau('#7e4026', quina=1.22, b=(0, 0, 0, 0, zt - 0.035, zt))})
    if not aberto:
        alca((x0 + x1) / 2, 0.48, y1)
        botao(x1 - 0.09, 0.3, y1)
    peg(x0, x1, y0, y1)


def comoda(vazio=False, aberto=False):
    """
    A cômoda de quatro fiadas de gavetas (0,9 m): as duas de cima pequenas, as alças de latão, os pés em bola.
    vazio: a gêmea esvaziada (comoda!vazio), sem o caminho de crochê em cima; o móvel é o mesmo.
    aberto: a gaveta pequena de cima (à esquerda) e a de baixo puxadas uns 40%, com os panos dobrados à vista
    (na gêmea vazia, as gavetas puxadas e vazias).
    """
    x0, x1, y0, y1 = 0.05, 1.45, 0.07, 0.62
    zt = 1.47 / UN
    zb = 0.1
    fi = np.linspace(zb + 0.03, zt - 0.06, 5)
    pain = []
    meio = (x0 + x1) / 2
    for i in range(4):
        z0, z1 = fi[i] + 0.006, fi[i + 1] - 0.006
        if i == 3:
            pain += [(x0 + 0.04, meio - 0.006, z0, z1, 'g'), (meio + 0.006, x1 - 0.04, z0, z1, 'g')]
        else:
            pain.append((x0 + 0.04, x1 - 0.04, z0, z1, 'g'))
    for (a, b) in ((x0 + 0.06, y0 + 0.05), (x1 - 0.06, y0 + 0.05), (x0 + 0.06, y1 - 0.05), (x1 - 0.06, y1 - 0.05)):
        pe_bola(a, b, zb + 0.01, 0.04, NOG_E)
    caixa((x0, x1, y0, y1, zb, zt - 0.04), {'frente': almofadas(NOG, pain, seed=11), 'costas': tab2(PINHO, 0.14, '#6a4426', eixo=1, seed=12),
                                            '*': mad2(NOG, eixo=1, seed=13, passo=0.05)})
    caixa((x0 - 0.02, x1 + 0.02, y0 - 0.01, y1 + 0.025, zt - 0.04, zt), {'cima': tab2(NOG_TAB, 0.18, '#3e1c0e', seed=14, org=y0),
                                                                         '*': _pau('#7e4026', quina=1.22, b=(0, 0, 0, 0, zt - 0.04, zt))})
    puxadas = {3: 'e', 1: 'c'} if aberto else {}          # a fiada de cima, só a da esquerda; a segunda de baixo, inteira
    for i in range(4):
        zm = (fi[i] + fi[i + 1]) / 2
        if i == 3:
            if puxadas.get(3) != 'e':
                alca((x0 + meio) / 2, zm, y1, 0.07)
            alca((meio + x1) / 2, zm, y1, 0.07)
        elif i not in puxadas:
            alca(meio - 0.32, zm, y1)
            alca(meio + 0.32, zm, y1)
    if aberto:
        fr = almofadas(NOG, pain, seed=11)
        T = [(0.05, 0.2, 0.0, 0.32, '#c8d0d8'), (0.25, 0.4, 0.0, 0.32, '#9a4a3a'), (0.45, 0.6, 0.0, 0.3, '#e0d8c0')]
        # a de cima (esquerda): camisas dobradas
        z0, z1 = fi[3] + 0.006, fi[4] - 0.006
        gaveta_puxada(x0 + 0.04, meio - 0.006, y1, 0.2, z0, z1, fr, alcas=[(x0 + meio) / 2],
                      tecidos=[] if vazio else [(x0 + 0.1, x0 + 0.34, 0.06, 0.34, '#4e6a8a'), (x0 + 0.38, x0 + 0.6, 0.06, 0.34, '#d8cfb8')])
        # a segunda de baixo para cima (larga): meias e lençóis
        z0, z1 = fi[1] + 0.006, fi[2] - 0.006
        gaveta_puxada(x0 + 0.04, x1 - 0.04, y1, 0.24, z0, z1, fr, alcas=[meio - 0.32, meio + 0.32], funda=0.4,
                      tecidos=[] if vazio else [(x0 + 0.1, x0 + 0.5, 0.06, 0.3, '#a8443a'), (x0 + 0.55, x0 + 0.95, 0.06, 0.3, '#e8dcc0'), (x0 + 1.0, x0 + 1.3, 0.06, 0.3, '#3e5a74')])
    # o caminho de crochê em cima (o que vai em cima fica por cima dele)
    if not vazio:
        CZ.toalhinha(x0 + 0.22, x1 - 0.22, y0 + 0.1, y1 - 0.1, zt + 0.0005)
    peg(x0, x1, y0, y1)


def guarda_roupa(aberto=False):
    """
    O guarda-roupa de jacarandá (2 m): duas portas almofadadas (a da direita com o espelho), as duas gavetas
    embaixo, o rodapé recuado, a cimalha saliente; as costas de pinho.
    aberto: as duas folhas abertas (a da esquerda mostra o lado de dentro, a da direita o espelho de fora), o vão
    escuro com a barra e as roupas penduradas (camisas, um vestido, um casaco) e uma prateleira com panos dobrados.
    """
    x0, x1, y0, y1 = 0.04, 1.46, 0.05, 0.66
    zt = 3.27 / UN
    zc = zt - 0.12
    meio = (x0 + x1) / 2
    zg = 0.4
    pain = [(x0 + 0.05, meio - 0.008, 0.15, zg - 0.01, 'g'), (meio + 0.008, x1 - 0.05, 0.15, zg - 0.01, 'g'),
            (x0 + 0.05, meio - 0.008, zg + 0.02, zc - 0.05, 'p'), (meio + 0.008, x1 - 0.05, zg + 0.02, zc - 0.05, 'e')]
    # as portas: a almofada de cima comprida e a de baixo curta (duas faixas por porta)
    pain_p = []
    for (u0, u1, k) in ((x0 + 0.05, meio - 0.008, 'p'), (meio + 0.008, x1 - 0.05, 'e')):
        pain_p.append((u0, u1, zg + 0.02, zc - 0.05, 'g'))
        pain_p.append((u0 + 0.06, u1 - 0.06, zg + 0.42, zc - 0.12, k))
        pain_p.append((u0 + 0.06, u1 - 0.06, zg + 0.1, zg + 0.34, 'p'))
    pain = pain[:2] + pain_p
    caixa((x0 + 0.04, x1 - 0.04, y0 + 0.02, y1 - 0.04, 0.0, 0.12), mad2(NOG_E, seed=21, passo=0.04))
    if not aberto:
        caixa((x0, x1, y0, y1, 0.12, zc), {'frente': almofadas(JAC, pain, eixo=1, seed=22, passo=0.05),
                                           'costas': tab2(PINHO, 0.15, '#6a4426', eixo=1, seed=23),
                                           '*': mad2(JAC, eixo=1, seed=24, passo=0.06), 'cima': liso('#6a3420')})
    else:
        e = 0.04
        FORA = mad2(JAC, eixo=1, seed=24, passo=0.06)
        IN = dentro('#2a1208', 0.12 + e, zc)
        casca(x0, x1, y0, y1, 0.12, zc, e, FORA, IN, tab2(PINHO, 0.15, '#6a4426', eixo=1, seed=23), fundo=liso('#3a1c0e'))
        caixa((x0, x1, y0, y1, zc - e, zc), {'baixo': IN, 'cima': liso('#6a3420'), '*': FORA})
        # o bloco das gavetas de baixo (fechadas) e o chão do vão
        caixa((x0 + e, x1 - e, y0 + e, y1, 0.12, zg), {'frente': almofadas(JAC, pain[:2], eixo=1, seed=22, passo=0.05), 'cima': liso('#4a2812'), '*': FORA})
        # a prateleira dos panos, na ponta direita, e a barra com as roupas
        zp = zc - 0.55
        prateleira_in(meio + 0.06, x1 - e, y0 + e, y1 - 0.06, zp, 0.025, FORA, '#5a3018')
        zr = zc - 0.22
        _barra((x0 + e, x1 - e, y0 + 0.28, y0 + 0.3, zr, zr + 0.022), '#8a8e92', '#c0c4c8', quina=False)
        if True:
            for k, (cc, ln) in enumerate((('#c8c0a8', 0.78), ('#3e5a74', 0.82), ('#8a3a30', 0.78), ('#d8d0b8', 0.74), ('#2e4c3c', 1.0),
                                          ('#5a3446', 0.74))):
                xx = x0 + e + 0.07 + k * 0.095
                caixa((xx, xx + 0.055, y0 + 0.14, y0 + 0.46, zr - ln, zr - 0.02), {'*': liso(cc), 'dir': liso(_hexn(_tom(hx(cc), 0.9)))})
                _barra((xx + 0.02, xx + 0.035, y0 + 0.28, y0 + 0.3, zr - 0.01, zr + 0.05), '#6a6e72', quina=False)
            for k, cc in enumerate(('#d8d0b8', '#4e6a8a', '#a8443a')):
                caixa((meio + 0.1, x1 - e - 0.06, y0 + e + 0.1, y0 + e + 0.36, zp + 0.01 + k * 0.05, zp + 0.06 + k * 0.05), liso(cc))
        # as folhas: a da esquerda (dobradiça em x0) e a da direita (dobradiça em x1)
        zf0, zf1 = zg + 0.02, zc - 0.05
        Wp = meio - x0
        for (lado, Hx, ang, kk) in ((1, x0, 100, 'p'), (-1, x1, 180 - 108, 'e')):
            H = (Hx, y1)
            pd = [(0.05, Wp - 0.05, zf0 + 0.0, zf1, 'g'), (0.11, Wp - 0.11, zf0 + 0.42, zf1 - 0.07, kk), (0.11, Wp - 0.11, zf0 + 0.1, zf0 + 0.36, 'p')]
            pi = [(0.05, Wp - 0.05, zf0, zf1, 'g'), (0.11, Wp - 0.11, zf0 + 0.1, zf1 - 0.07, 'p')]
            porta_giro(H, ang, Wp, zf0, zf1, mat_folha(JAC, pd, H, ang, seed=22), mat_folha(_hexn(_tom(hx(JAC), 0.92)), pi, H, ang, seed=26),
                       lado=lado, mat_b=mad2(JAC, eixo=1, seed=24, passo=0.06))
            tirador(H, ang, Wp - 0.05, 1.0, lado)
    # a cimalha: a moldura em dois degraus
    caixa((x0 - 0.02, x1 + 0.02, y0 - 0.01, y1 + 0.02, zc, zc + 0.04), _pau('#6e3820', quina=1.2, b=(0, 0, 0, 0, zc, zc + 0.04)))
    caixa((x0 - 0.04, x1 + 0.04, y0 - 0.015, y1 + 0.04, zc + 0.04, zt), {'cima': tab2(JAC_TAB, 0.2, '#3a1a0c', seed=25, org=y0),
                                                                         '*': _pau('#7a3e22', quina=1.25, b=(0, 0, 0, 0, zc + 0.04, zt))})
    # os puxadores das portas e as alças das gavetas, o espelho da fechadura
    if not aberto:
        for xx in (meio - 0.05, meio + 0.05):
            _barra((xx - PH, xx + PH, y1, y1 + 0.022, 1.0, 1.12), LATAO, LATAO_L, quina=False)
        _barra((meio - 0.035 - PH, meio - 0.035 + PH, y1, y1 + 0.01, 1.18, 1.18 + 3 * PZ), '#2a1a10', quina=False)
    for xx in ((x0 + meio) / 2, (meio + x1) / 2):
        alca(xx, (0.15 + zg) / 2, y1)
    peg(x0, x1, y0, y1)


# =====================================================================================================================
# as camas e a beliche
# =====================================================================================================================
def colcha(tipo, seed=0):
    """
    O pano da colcha: 'retalhos' (a colcha de retalhos, blocos de 7 px com a costura), 'listra' (a manta lisa com a
    listra creme perto do pé), 'xadrez' (o xadrez de lã). As dobras: riscas de 1 px escuras com a luz do lado.
    """
    if tipo == 'retalhos':
        cs = np.stack([hx(x) for x in ('#a8443a', '#c8963c', '#e6d8b8', '#4e6a8a', '#b8604a', '#e6d8b8')])
    elif tipo == 'listra':
        cs = np.stack([hx('#4e6a8a'), hx('#e8dcc0'), hx('#3e5674')])
    else:
        cs = np.stack([hx('#a83a30'), hx('#7a2a24'), hx('#d8c8a8'), hx('#c05a48')])

    def f(L, n, P):
        X, Y, Z = P[:, 0], P[:, 1], P[:, 2]
        top = n[2] > 0.6
        if top:
            a, b = X / PH, Y / PH
        elif abs(n[1]) >= abs(n[0]):
            a, b = X / PH, -Z / PZ
        else:
            a, b = Y / PH, -Z / PZ
        if tipo == 'retalhos':
            i, j = np.floor(a / 9), np.floor(b / 9 if top else (b + 3) / 9)
            k = (ruido(i, j, seed + 3.0) * len(cs)).astype(int) % len(cs)
            out = cs[k]
            ga, gb = a - i * 9, (b if top else b + 3) - j * 9
            out = np.where(((ga < 1) | (gb < 1))[:, None], _tom(out, 0.78), out)
            out = np.where((((ga >= 1) & (ga < 2)) | ((gb >= 1) & (gb < 2)))[:, None], _tom(out, 1.06), out)
        elif tipo == 'listra':
            out = np.tile(cs[0], (len(P), 1))
            yy = Y / PH
            out = np.where(((yy % 40 > 30) & (yy % 40 < 34))[:, None], cs[1], out)
            out = np.where(((yy % 40 == 30) | (np.floor(yy) % 40 == 34))[:, None], cs[2], out)
            out = np.where((np.floor(a) % 4 == 0)[:, None], _tom(out, 0.96), out)
        else:
            i, j = np.floor(a / 8), np.floor(b / 8)
            k = (i % 2) + (j % 2)
            out = np.where((k == 0)[:, None], cs[0], np.where((k == 1)[:, None], cs[3], cs[1]))
            lin = ((np.floor(a) % 8 == 3) | (np.floor(b) % 8 == 3))
            out = np.where(lin[:, None], cs[2] * 0.5 + out * 0.5, out)
        if top:
            # as dobras (riscas de comprido, quebradas): a escura e a clara do lado
            for (y0f, ph) in ((0.5, 0.0), (1.1, 1.7), (1.55, 3.1)):
                w = Y - y0f - 0.03 * np.sin(X * 7 + ph)
                q = (np.abs(X - np.mean(X)) < 0.35) & (np.sin(X * 4.3 + ph) > -0.3)
                out = np.where(((w >= 0) & (w < PH) & q)[:, None], _tom(out, 0.8), out)
                out = np.where(((w >= PH) & (w < 2 * PH) & q)[:, None], _tom(out, 1.1), out)
        return out
    return emissivo(f)


def lencol(cor='#ece6da'):
    """O lençol e a fronha: o branco-creme com a costura de 1 px na beira (só no topo)."""
    c0 = hx(cor)

    def f(L, n, P):
        out = np.tile(c0, (len(P), 1))
        if n[2] > 0.6:
            s = suave(np.floor(P[:, 0] / PH) * PH, np.floor(P[:, 1] / PH) * PH, 0.12, 5)
            out = np.where((s > 0.68)[:, None], _tom(c0, 0.94), out)
        return out
    return emissivo(f)


def leito(x0, x1, y0, y1, zb, ztop, tipo='retalhos', travesseiros=1, seed=0, borda=0.04):
    """
    Um leito (o colchão, o lençol dobrado, a colcha caindo dos lados, os travesseiros), da cabeceira (y0) ao pé (y1),
    com o estrado em zb e o topo da colcha em ztop. Desenha só os panos; a madeira é de quem chama.
    """
    zc0 = zb + 0.02
    # o colchão (fica à mostra embaixo do travesseiro) e o lençol
    b = (x0 + borda, x1 - borda, y0 + 0.04, y1 - 0.04, zc0, ztop - 0.025)
    _p1_malha(b, (0.05, 0.05, 0.02, 0.05), lencol(), seg=2)
    # a colcha: cobre do meio para o pé e cai pelos lados
    yq = y0 + 0.5
    b = (x0 + borda - 0.025, x1 - borda + 0.025, yq, y1 - 0.02, zc0 - 0.06, ztop)
    _p1_malha(b, (0.05, 0.05, 0.015, 0.06), colcha(tipo, seed), seg=2)
    # o lençol dobrado por cima da colcha (a faixa branca)
    b = (x0 + borda - 0.02, x1 - borda + 0.02, yq - 0.03, yq + 0.13, ztop - 0.06, ztop + 0.014)
    _p1_malha(b, (0.03, 0.04, 0.02, 0.04), lencol('#f2ede2'), seg=2)
    # os travesseiros (fofos, um pouco tortos)
    w = (x1 - x0 - 2 * borda) / travesseiros
    for k in range(travesseiros):
        a0 = x0 + borda + k * w + 0.03
        a1 = a0 + w - 0.06
        b = (a0, a1, y0 + 0.07, y0 + 0.4, ztop - 0.07, ztop + 0.08)
        _p1_malha(b, (0.07, 0.08, 0.04, 0.08), lencol('#f4efe4'), seg=2)


def cabeceira(x0, x1, y, z0, z1, esp=0.05, poste=0.07, zp=None, cor=NOG, seed=0, alm=True):
    """A cabeceira (ou o pé) de madeira: os dois postes com a bola e o painel almofadado entre eles."""
    zp = z1 + 0.04 if zp is None else zp
    pain = [(x0 + poste + 0.04, x1 - poste - 0.04, z0 + 0.08, z1 - 0.07, 'p')] if alm else []
    caixa((x0 + poste, x1 - poste, y, y + esp, z0, z1), {'frente': almofadas(cor, pain, seed=seed), 'costas': almofadas(cor, [], seed=seed + 1),
                                                         'cima': _pau('#8a4a2a'), '*': mad2(cor, seed=seed + 2)})
    # a travessa de cima (mais grossa, sai um pouco)
    caixa((x0 + poste, x1 - poste, y - 0.01, y + esp + 0.01, z1 - 0.05, z1), _pau('#7e4026', quina=1.25, b=(0, 0, 0, 0, z1 - 0.05, z1)))
    for xx in (x0, x1 - poste):
        caixa((xx, xx + poste, y - 0.01, y + esp + 0.01, 0.0, zp), {'cima': liso('#8a4a2a'), '*': mad2('#5e2e18', eixo=1, seed=seed + 3, passo=0.04)})
        o = novo()
        cx_, cy_ = xx + poste / 2, y + esp / 2
        _poligono_rodado(cx_, cy_, [(zp, poste * 0.4), (zp + 0.02, poste * 0.6), (zp + 0.05, poste * 0.55), (zp + 0.07, poste * 0.2)],
                         vol(cx_, cy_, '#7a3e22'), o, lados=12)


def cama(larg, tipo, travesseiros):
    """A cama (casal ou solteiro): a cabeceira alta encostada no fundo, o pé baixo, as laterais, o leito."""
    x0, x1 = 0.03, larg - 0.03
    y0, y1 = 0.02, 2.25 - 0.03
    ztop = 0.9 / UN
    cabeceira(x0, x1, y0, 0.12, 1.0, seed=31)
    cabeceira(x0, x1, y1 - 0.05, 0.12, 0.62, seed=35)
    for xx in (x0 + 0.01, x1 - 0.05):
        caixa((xx, xx + 0.04, y0 + 0.05, y1 - 0.05, 0.14, 0.32), {'cima': liso('#8a4a2a'), '*': mad2(NOG, seed=37, passo=0.04)})
    leito(x0 + 0.04, x1 - 0.04, y0 + 0.05, y1 - 0.05, 0.28, ztop, tipo, travesseiros, seed=7)
    peg(x0, x1, y0, y1)


def cama_casal():
    cama(1.5, 'retalhos', 2)


def cama_solteiro():
    cama(0.75, 'listra', 1)


def beliche():
    """
    A beliche (1,85 m): os quatro postes, os dois estrados (os leitos a 0,55 e a 1,52 m), a grade da cama de cima nos
    dois lados e a escadinha no pé (os degraus entre os postes do pé).
    """
    x0, x1 = 0.04, 0.71
    y0, y1 = 0.02, 2.22
    zt = 3.02 / UN
    z1, z2 = 0.9 / UN, 2.48 / UN
    p = 0.07
    POSTE = {'cima': liso('#8a4a2a'), '*': mad2('#5e2e18', eixo=1, seed=41, passo=0.04)}
    for xx in (x0, x1 - p):
        for yy in (y0, y1 - p):
            caixa((xx, xx + p, yy, yy + p, 0.0, zt), POSTE)
    # as cabeceiras (as tábuas entre os postes de trás) e o pé de baixo
    for (zz0, zz1) in ((0.12, 0.62), (z2 - 0.3, z2 + 0.25)):
        caixa((x0 + p, x1 - p, y0 + 0.01, y0 + 0.05, zz0, zz1), {'frente': almofadas(NOG, [(x0 + p + 0.04, x1 - p - 0.04, zz0 + 0.06, zz1 - 0.06, 'p')], seed=42),
                                                                 'cima': _pau('#8a4a2a'), '*': mad2(NOG, seed=43)})
    caixa((x0 + p, x1 - p, y1 - 0.05, y1 - 0.01, 0.12, 0.42), {'frente': almofadas(NOG, [(x0 + p + 0.04, x1 - p - 0.04, 0.18, 0.36, 'p')], seed=44),
                                                               'cima': _pau('#8a4a2a'), '*': mad2(NOG, seed=45)})
    # as laterais de cada estrado
    for zb in (0.14, z2 - 0.42):
        for xx in (x0, x1 - 0.035):
            caixa((xx, xx + 0.035, y0 + p, y1 - p, zb, zb + 0.16), {'cima': liso('#8a4a2a'), '*': mad2(NOG, seed=46, passo=0.04)})
    # o estrado de cima (a tábua que faz o teto da cama de baixo)
    caixa((x0 + 0.035, x1 - 0.035, y0 + p, y1 - p, z2 - 0.42, z2 - 0.39), mad2(NOG_E, seed=47, passo=0.04))
    leito(x0 + 0.03, x1 - 0.03, y0 + 0.06, y1 - 0.06, 0.28, z1, 'xadrez', 1, seed=3)
    leito(x0 + 0.03, x1 - 0.03, y0 + 0.06, y1 - 0.06, z2 - 0.27, z2, 'listra', 1, seed=9)
    # a grade da cama de cima (dos dois lados, da cabeceira até antes do pé)
    for xx in (x0, x1 - 0.035):
        caixa((xx, xx + 0.035, y0 + p, y1 - 0.5, z2 + 0.12, z2 + 0.17), {'cima': liso('#8a4a2a'), '*': mad2(NOG, seed=48, passo=0.04)})
        caixa((xx + 0.005, xx + 0.03, y1 - 0.53, y1 - 0.5, z2 - 0.25, z2 + 0.12), POSTE)
    # a escadinha no pé: os degraus entre os postes do pé, até a cama de cima
    for k in range(5):
        zz = 0.52 + k * (z2 + 0.15 - 0.52) / 4
        caixa((x0 + p, x1 - p, y1 - 0.05, y1 - 0.015, zz, zz + 0.04), _pau('#8a4a2a', quina=1.2, b=(0, 0, 0, 0, zz, zz + 0.04)))
    peg(x0, x1, y0, y1)


# =====================================================================================================================
# as mesas, o banco, a banqueta, a poltrona, o aparador
# =====================================================================================================================
def mesa_tampo_pernas(x, y, w, d, h, tampo=0.07, saia=0.11, perna=0.055, cores=NOG_TAB, lado=NOG, seed=0, tabua=0.25):
    """A mesa: o tampo de tábuas, a saia recuada embaixo dele (nada embaixo: a cadeira encaixa) e as pernas torneadas."""
    eixo = 0 if w >= d else 1
    org = y if eixo == 0 else x
    caixa((x, x + w, y, y + d, h - tampo, h), {'cima': tab2(cores, tabua, '#3e1c0e', eixo=eixo, seed=seed, comp=0.95, org=org),
                                               '*': _pau(lado, '#7e4026', quina=1.22, b=(0, 0, 0, 0, h - tampo, h))})
    m = 0.07
    caixa((x + m, x + w - m, y + m, y + d - m, h - tampo - saia, h - tampo), mad2('#4a2412', seed=seed + 1, passo=0.05))
    for (a, b) in ((x + m + perna * 0.6, y + m + perna * 0.6), (x + w - m - perna * 0.6, y + m + perna * 0.6),
                   (x + m + perna * 0.6, y + d - m - perna * 0.6), (x + w - m - perna * 0.6, y + d - m - perna * 0.6)):
        perna_torneada(a, b, 0.0, h - tampo - saia + 0.01, perna, '#5e2e18')
    peg(x, x + w, y, y + d)


def mesa_jantar(vazio=False):
    """
    A mesa de jantar (4 x 2 casas, aumento 1,2: 3,6 x 1,8 m; o tampo a 0,76 m): o tampo, as pernas torneadas, o caminho e a fruteira.
    vazio: a gêmea esvaziada (mesa_jantar!vazio), só a mesa, sem o caminho e a fruteira.
    """
    w, d = 3.0 * 1.2, 1.5 * 1.2
    x, y = 1.5 - w / 2, 0.75 - d / 2
    h = 0.76
    mesa_tampo_pernas(x, y, w, d, h, seed=51)
    if vazio:
        return
    CZ.toalhinha(x + 0.6, x + w - 0.6, 0.75 - 0.17, 0.75 + 0.17, h + 0.0005)
    CZ.fruteira(1.5, 0.75, h + 0.0005)


def desk_wood():
    """
    A escrivaninha (2 x 1 casas, aumento 1,2: 1,8 x 0,9 m; o tampo a 0,76 m): o tampo com o forro de couro verde, as três
    gavetas na saia, as pernas quadradas, o painel de trás (o vão é 'fundo'); o tinteiro, a pena e os papéis.
    """
    w, d = 1.5 * 1.2, 0.75 * 1.2
    x, y = 0.75 - w / 2, 0.375 - d / 2
    h = 0.76
    tp = 0.05
    caixa((x, x + w, y, y + d, h - tp, h), {'cima': tab2(NOG_TAB, 0.22, '#3e1c0e', seed=61, comp=0.9, org=y),
                                            '*': _pau(NOG, '#7e4026', quina=1.22, b=(0, 0, 0, 0, h - tp, h))})
    m = 0.04
    zs = h - tp - 0.14
    pain = []
    xs = np.linspace(x + m + 0.07, x + w - m - 0.07, 4)
    for i in range(3):
        pain.append((xs[i] + 0.008, xs[i + 1] - 0.008, zs + 0.015, h - tp - 0.012, 'g'))
    caixa((x + m, x + w - m, y + m, y + d - m, zs, h - tp), {'frente': almofadas(NOG, pain, seed=62), '*': mad2(NOG, seed=63, passo=0.05)})
    for i in range(3):
        alca((xs[i] + xs[i + 1]) / 2, (zs + h - tp) / 2, y + d - m, 0.07)
    # o painel de trás (o vão 'fundo') entre as pernas de trás
    caixa((x + m + 0.07, x + w - m - 0.07, y + m + 0.01, y + m + 0.035, 0.18, zs), {'costas': almofadas(NOG, [], seed=64),
                                                                                    '*': mad2(NOG_E, seed=65, passo=0.05)})
    PE = {'cima': liso('#7e4026'), '*': mad2('#5e2e18', eixo=1, seed=66, passo=0.04)}
    for (a, b) in ((x + m, y + m), (x + w - m - 0.07, y + m), (x + m, y + d - m - 0.07), (x + w - m - 0.07, y + d - m - 0.07)):
        caixa((a, a + 0.07, b, b + 0.07, 0.0, zs), PE)
    peg(x, x + w, y, y + d)
    # o forro de couro verde (o mata-borrão) com a beira de couro escuro
    bx0, bx1, by0, by1 = x + 0.5, x + 1.25, y + 0.3, y + 0.75

    def forro(L, n, P):
        X, Y = P[:, 0], P[:, 1]
        out = np.tile(hx('#3e6a4a'), (len(P), 1))
        bd = (X < bx0 + 0.06) | (X > bx1 - 0.06)
        out = np.where(bd[:, None], hx('#5a2e1a'), out)
        out = np.where(((X >= bx0 + 0.06) & (X < bx0 + 0.06 + PH))[:, None], hx('#2c4a34'), out)
        return out
    o = novo()
    CZ.fp([(bx0, by0, h + 0.004), (bx1, by0, h + 0.004), (bx1, by1, h + 0.004), (bx0, by1, h + 0.004)], (0, 0, 1), emissivo(forro), o)
    caixa((bx0, bx1, by0, by1, h, h + 0.004), liso('#3a2014'))
    # a pilha de papéis e o tinteiro com a pena
    for k in range(3):
        caixa((x + 0.12 + 0.01 * k, x + 0.4 + 0.01 * k, y + 0.18 - 0.008 * k, y + 0.52 - 0.008 * k, h + k * PZ, h + (k + 1) * PZ),
              {'cima': liso('#efe6cc'), '*': liso('#d8ccb0')})
    CZ.itens_peq.append((x + 0.12, x + 0.42, y + 0.16, y + 0.52, h))
    ix, iy = x + w - 0.3, y + 0.24
    o = novo()
    _poligono_rodado(ix, iy, [(h, 0.045), (h + 0.05, 0.045), (h + 0.06, 0.025), (h + 0.075, 0.025)], vol(ix, iy, '#2a3448', brilho=0.5), o, lados=14,
                     tampa_mat=liso('#141820'))
    o = novo()
    BE._fita([(-0.01, h + 0.07), (0.03, h + 0.16), (0.05, h + 0.22)], ix, iy, liso('#ece4d0'), o, 0.022)
    CZ.itens_peq.append((ix - 0.045, ix + 0.045, iy - 0.045, iy + 0.045, h))


def table_round():
    """A mesa redonda (2 x 2 casas, aumento 1,2: 1,8 m de diâmetro; o tampo a 0,76 m): o tampo de tábuas com o friso, a coluna torneada e os quatro pés."""
    cx, cy = 0.75, 0.75
    r = 0.9
    h = 0.76
    tp = 0.06
    T = tab2(NOG_TAB, 0.22, '#3e1c0e', seed=71, comp=0.9, org=cy - r)

    def topo(L, n, P):
        out = T(L, n, P)
        rr = np.hypot(P[:, 0] - cx, P[:, 1] - cy)
        out = np.where((rr > r - 0.06)[:, None], hx('#7a3c22'), out)
        out = np.where(((rr > r - 0.06 - PH) & (rr <= r - 0.06))[:, None], hx('#4a2412'), out)
        out = np.where((rr > r - PH * 1.2)[:, None], hx('#9a5a34'), out)
        return out
    o = novo()
    C().cilindro(cx, cy, r, h - tp, h, vol(cx, cy, NOG), M, o, lados=48, tampa_mat=emissivo(topo))
    o = novo()
    C().cilindro(cx, cy, r - 0.12, h - tp - 0.08, h - tp, vol(cx, cy, '#4a2412'), M, o, lados=36, tampa=False)
    # a coluna torneada
    o = novo()
    zc = h - tp - 0.08
    f = zc / 0.772                # o perfil foi desenhado para a coluna de 0,77 m (o tampo de antes, 0,91 m)
    _poligono_rodado(cx, cy, [(0.12 * f, 0.11), (0.2 * f, 0.13), (0.26 * f, 0.09), (0.4 * f, 0.075), (0.5 * f, 0.1), (0.56 * f, 0.08), (zc - 0.08, 0.075),
                              (zc - 0.03, 0.11), (zc, 0.12)], vol(cx, cy, '#5e2e18'), o, lados=18)
    # os quatro pés em cruz (as patas baixas)
    PE = {'cima': mad2('#7e4026', seed=72), '*': mad2('#5e2e18', seed=73, passo=0.04)}
    caixa((cx - 0.48, cx + 0.48, cy - 0.045, cy + 0.045, 0.04, 0.13), PE)
    caixa((cx - 0.045, cx + 0.045, cy - 0.48, cy + 0.48, 0.04, 0.13), PE)
    for (a, b) in ((cx - 0.46, cy), (cx + 0.46, cy), (cx, cy - 0.46), (cx, cy + 0.46)):
        o = novo()
        _poligono_rodado(a, b, [(0.0, 0.035), (0.04, 0.055), (0.07, 0.05)], vol(a, b, '#4a2412'), o, lados=10)
    peg(cx - 0.5, cx + 0.5, cy - 0.5, cy + 0.5)


def table_small():
    """
    A mesinha (1 casa, 0,70 m; 16/10, o Felipe: "essa marrom do lado da sinuca e na frente da poltrona, nada a ver" era a
    caixa de reserva, sem desenho): o tampo quadrado de tábuas de nogueira com o friso claro na beira, a saia de madeira
    embaixo do tampo e as quatro pernas quadradas que afinam um pouco. Embaixo fica vazio (vao 'vazada').
    """
    cx, cy = 0.375, 0.375
    a = 0.31                      # meia largura do tampo (0,62 m)
    h = 0.70
    tp = 0.045
    T = tab2(NOG_TAB, 0.2, '#3e1c0e', seed=81, comp=0.62, org=cy - a)

    def topo(L, n, P):
        out = T(L, n, P)
        d = np.minimum(np.minimum(P[:, 0] - (cx - a), (cx + a) - P[:, 0]), np.minimum(P[:, 1] - (cy - a), (cy + a) - P[:, 1]))
        out = np.where((d < 0.035)[:, None], hx('#7a3c22'), out)
        out = np.where(((d >= 0.035) & (d < 0.035 + PH))[:, None], hx('#4a2412'), out)
        out = np.where((d < PH * 1.2)[:, None], hx('#9a5a34'), out)
        return out
    caixa((cx - a, cx + a, cy - a, cy + a, h - tp, h), {'cima': emissivo(topo), '*': mad2('#5e2e18', seed=82, passo=0.04)})
    # a saia: as quatro tábuas embaixo do tampo, um pouco para dentro
    s_ = a - 0.05
    SA = {'*': mad2('#4a2412', seed=83, passo=0.04), 'cima': None}
    caixa((cx - s_, cx + s_, cy - s_, cy - s_ + 0.025, h - tp - 0.09, h - tp), SA)
    caixa((cx - s_, cx + s_, cy + s_ - 0.025, cy + s_, h - tp - 0.09, h - tp), SA)
    caixa((cx - s_, cx - s_ + 0.025, cy - s_, cy + s_, h - tp - 0.09, h - tp), SA)
    caixa((cx + s_ - 0.025, cx + s_, cy - s_, cy + s_, h - tp - 0.09, h - tp), SA)
    # as pernas
    PE = {'cima': mad2('#7e4026', seed=84), '*': mad2('#5e2e18', seed=85, passo=0.04)}
    for (sx, sy) in ((-1, -1), (1, -1), (-1, 1), (1, 1)):
        x = cx + sx * (s_ - 0.02)
        y = cy + sy * (s_ - 0.02)
        caixa((x - 0.025, x + 0.025, y - 0.025, y + 0.025, 0.0, h - tp), PE)
    peg(cx - a, cx + a, cy - a, cy + a)


def stool():
    """A banqueta (aumento 1,2 na largura; o assento a 0,45 m): o assento redondo de tábuas, as quatro pernas e o apoio dos pés."""
    cx, cy = 0.375, 0.375
    k = 1.2
    h = 0.45
    r = 0.17 * k
    o = novo()

    def assento(L, n, P):
        g = (P[:, 1] - (cy - r)) % 0.1
        out = np.tile(hx('#a86438'), (len(P), 1))
        out = np.where((g < PH)[:, None], hx('#4a2412'), out)
        out = np.where(((g >= PH) & (g < 2 * PH))[:, None], hx('#bc7a48'), out)
        return out
    C().cilindro(cx, cy, r, h - 0.045, h, vol(cx, cy, '#7e4026'), M, o, lados=26, tampa_mat=emissivo(assento))
    a = 0.1 * k
    for (sx, sy) in ((-1, -1), (1, -1), (-1, 1), (1, 1)):
        _barra((cx + sx * a - PH, cx + sx * a + PH, cy + sy * a - PH, cy + sy * a + PH, 0.0, h - 0.045), '#5e2e18', '#7e4026', quina=False)
    zr = 0.15
    for bb in ((cx - a, cx + a, cy + a - PH, cy + a + PH), (cx + a - PH, cx + a + PH, cy - a, cy + a),
               (cx - a, cx + a, cy - a - PH, cy - a + PH), (cx - a - PH, cx - a + PH, cy - a, cy + a)):
        _barra((bb[0], bb[1], bb[2], bb[3], zr, zr + 2 * PZ), '#6a3820', '#8a4a2a', quina=False)
    peg(cx - a - 0.02, cx + a + 0.02, cy - a - 0.02, cy + a + 0.02)


def bench():
    """
    O banco de madeira de dois lugares (o assento a 0,45 m): as cabeceiras inteiriças com o braço, o assento de duas
    tábuas e o encosto de três ripas nos postes de trás.
    """
    x0, x1 = 0.05, 1.45
    y0, y1 = 0.12, 0.64
    zs = 0.73 / UN
    LAT = {'frente': almofadas(NOG, [], seed=81), 'cima': liso('#8a4a2a'), '*': mad2(NOG, eixo=1, seed=82, passo=0.05)}
    for xx in (x0, x1 - 0.05):
        caixa((xx, xx + 0.05, y0 + 0.04, y1, 0.0, zs + 0.18), LAT)
        caixa((xx - 0.01, xx + 0.06, y0 + 0.02, y1 + 0.02, zs + 0.18, zs + 0.22), _pau('#7e4026', quina=1.25, b=(0, 0, 0, 0, zs + 0.18, zs + 0.22)))
    caixa((x0 + 0.05, x1 - 0.05, y0 + 0.08, y1 - 0.01, zs - 0.04, zs), {'cima': tab2(NOG_TAB, (y1 - y0 - 0.09) / 2, '#3e1c0e', seed=83, org=y0 + 0.08),
                                                                        '*': _pau(NOG, quina=1.2, b=(0, 0, 0, 0, zs - 0.04, zs))})
    caixa((x0 + 0.05, x1 - 0.05, y1 - 0.06, y1 - 0.03, zs - 0.13, zs - 0.04), mad2(NOG_E, seed=84, passo=0.04))
    # o encosto: os postes de trás e as ripas
    for xx in (x0, x1 - 0.05):
        caixa((xx, xx + 0.05, y0 - 0.05, y0 + 0.04, 0.0, 0.95), {'cima': liso('#8a4a2a'), '*': mad2('#5e2e18', eixo=1, seed=85, passo=0.04)})
    for (za, zb) in ((zs + 0.08, zs + 0.15), (zs + 0.22, zs + 0.29), (0.86, 0.95)):
        caixa((x0 + 0.05, x1 - 0.05, y0 - 0.03, y0 + 0.01, za, zb), {'frente': mad2('#7e4026', seed=86, passo=0.03), 'cima': liso('#9a5a34'),
                                                                     '*': mad2(NOG, seed=87, passo=0.03)})
    peg(x0, x1, y0 - 0.05, y1)


# ----- o couro (o do sofá da sala) -----
_COURO = _p1_rampa(['#4a2416', '#5e2e1a', '#743a20', '#8a4826', '#a0572e', '#b46836', '#c67a40', '#d68c4c', '#e4a05c', '#eeb672'])


def couro(b, lo=2.4, hi=6.6, cupula=1.0, brilho=True, grad=1.0, costura=None):
    """O couro do estofado (o mesmo do sofá da sala): a cúpula clara no topo, o reflexo, os lados que escurecem embaixo."""
    x0, x1, y0, y1, z0, z1 = b

    def extra(L, n, P):
        e = np.zeros(len(L))
        if n[2] > 0.8:
            u = (P[:, 0] - (x0 + x1) / 2) / ((x1 - x0) / 2)
            v = (P[:, 1] - (y0 + y1) / 2) / ((y1 - y0) / 2)
            d = (np.abs(u) ** 3 + np.abs(v) ** 3) ** (1 / 3)
            e += np.where(d < 0.42, cupula, np.where(d < 0.72, cupula * 0.55, 0))
            if brilho:
                bu, bv = (u + 0.3) * 1.3, v - 0.3
                e += np.where((np.abs(bu) ** 3 + np.abs(bv) ** 3) < 0.03, 1.0, 0)
        elif n[2] < 0.6:
            t = np.clip((P[:, 2] - z0) / max(1e-6, z1 - z0), 0, 1)
            e += np.where(t < 0.4, -grad, 0)
        if costura is not None and abs(n[2]) < 0.75:
            e += np.where(np.abs(P[:, 2] - costura) < 0.5 * PZ, -2.0, 0)
            e += np.where(np.abs(P[:, 2] - costura - PZ) < 0.5 * PZ, 0.8, 0)
        return e
    return _p1_mat_rampa(_COURO, lo, hi, extra=extra)


def armchair():
    """
    A poltrona de couro (o assento a 0,45 m): os braços com o rolo, o encosto alto com a almofada fofa, a almofada do
    assento com a costura, o corpo escuro embaixo e os pés de madeira.
    """
    x0, x1 = 0.02, 0.73
    y0, y1 = 0.03, 0.72
    zs = 0.73 / UN
    br = 0.15
    MAD = _p1_mat_rampa(BE._MAD, 2.0, 6.0)
    for a in (x0 + 0.05, x1 - 0.11):
        for b_ in (y0 + 0.04, y1 - 0.1):
            _p1_malha((a, a + 0.06, b_, b_ + 0.06, 0.0, 0.1), (0.012, 0.012, 0.0, 0.0), MAD, seg=1)
    b = (x0 + 0.04, x1 - 0.04, y0 + 0.05, y1 - 0.03, 0.08, zs - 0.12)
    _p1_malha(b, (0.03, 0.03, 0.02, 0.03), couro(b, lo=1.2, hi=4.6, cupula=0, brilho=False, grad=0.8), seg=2)
    # o encosto (a estrutura de trás, com o rolo em cima) e a almofada
    b = (x0 + 0.04, x1 - 0.04, y0, y0 + 0.22, zs - 0.15, 0.98)
    _p1_malha(b, (0.07, 0.07, 0.02, 0.1), couro(b, lo=2.0, hi=6.0, cupula=0.4, brilho=False, grad=0.6), seg=2)
    b = (x0 + br - 0.01, x1 - br + 0.01, y0 + 0.14, y0 + 0.36, zs - 0.04, 0.92)
    _p1_malha(b, (0.09, 0.08, 0.06, 0.13), couro(b, lo=2.2, hi=7.4, cupula=0.8, grad=1.6), seg=2)
    # a almofada do assento (a frente passa um pouco do corpo)
    b = (x0 + br - 0.005, x1 - br + 0.005, y0 + 0.28, y1, zs - 0.15, zs)
    _p1_malha(b, (0.07, 0.06, 0.035, 0.07), couro(b, lo=2.0, hi=7.2, cupula=1.2, grad=1.0), seg=2)
    # os braços: o painel e o rolo em cima, que sai para os lados
    for (a0, a1) in ((x0, x0 + br), (x1 - br, x1)):
        b = (a0 + 0.02, a1 - 0.02, y0 + 0.04, y1 - 0.02, 0.08, zs + 0.08)
        _p1_malha(b, (0.04, 0.05, 0.02, 0.03), couro(b, lo=1.8, hi=5.6, cupula=0, brilho=False, grad=1.0), seg=2)
        b = (a0, a1, y0 + 0.02, y1, zs, zs + 0.23)
        _p1_malha(b, (0.07, 0.08, 0.08, 0.1), couro(b, lo=2.2, hi=7.6, cupula=0.8, grad=1.0), seg=2)
    peg(x0, x1, y0, y1)


def sideboard(aberto=False):
    """
    O aparador de jacarandá (0,9 m): as duas gavetas e as três portas, as pernas torneadas curtas, o tampo; em cima o
    caminho, as garrafas, a licoreira e os copos.
    aberto: a portinha da esquerda e a da direita abertas (garrafas, pratos e um jarro lá dentro), a gaveta da esquerda
    puxada com os talheres; a do meio fica fechada.
    """
    x0, x1, y0, y1 = 0.04, 1.46, 0.08, 0.6
    zt = 1.47 / UN
    zb = 0.16
    zg = zt - 0.16
    cols = np.linspace(x0 + 0.04, x1 - 0.04, 4)
    pain = [(x0 + 0.04, (x0 + x1) / 2 - 0.006, zg + 0.012, zt - 0.05, 'g'), ((x0 + x1) / 2 + 0.006, x1 - 0.04, zg + 0.012, zt - 0.05, 'g')]
    for i in range(3):
        pain.append((cols[i] + 0.006, cols[i + 1] - 0.006, zb + 0.04, zg - 0.012, 'p'))
    for (a, b) in ((x0 + 0.06, y0 + 0.06), (x1 - 0.06, y0 + 0.06), (x0 + 0.06, y1 - 0.06), (x1 - 0.06, y1 - 0.06)):
        perna_torneada(a, b, 0.0, zb + 0.01, 0.04, '#3e1c0e')
    FORA = mad2(JAC, eixo=1, seed=93, passo=0.05)
    if not aberto:
        caixa((x0, x1, y0, y1, zb, zt - 0.04), {'frente': almofadas(JAC, pain, eixo=1, seed=91, passo=0.05),
                                                'costas': tab2(PINHO, 0.14, '#6a4426', eixo=1, seed=92), '*': FORA})
    else:
        e = 0.035
        IN = dentro('#2a1208', zb + e, zg)
        casca(x0, x1, y0, y1, zb, zg, e, FORA, IN, tab2(PINHO, 0.14, '#6a4426', eixo=1, seed=92), fundo=liso('#3a1c0e'))
        # a faixa das gavetas (fechada, menos a da esquerda) e o chão do vão
        caixa((x0, x1, y0, y1, zg, zt - 0.04), {'frente': almofadas(JAC, pain[:2], eixo=1, seed=91, passo=0.05),
                                                'costas': tab2(PINHO, 0.14, '#6a4426', eixo=1, seed=92), '*': FORA})
        # a porta do meio (fechada) e a divisória
        caixa((cols[1] + 0.006, cols[2] - 0.006, y1 - 0.025, y1, zb + 0.04, zg - 0.012),
              {'frente': almofadas(JAC, [(cols[1] + 0.006, cols[2] - 0.006, zb + 0.04, zg - 0.012, 'p')], eixo=1, seed=91, passo=0.05), '*': FORA})
        meio_ = (x0 + x1) / 2
        # as prateleiras de dentro e o que guardam
        for k, cc in enumerate(('#2e5a3c', '#5a3a1e', '#2a4a6a')):
            xx = x0 + e + 0.07 + k * 0.1
            o = novo()
            zq = zb + e
            _poligono_rodado(xx, y0 + 0.3, [(zq, 0.036), (zq + 0.17, 0.036), (zq + 0.22, 0.017), (zq + 0.32, 0.015)], vol(xx, y0 + 0.3, cc, brilho=0.5), o, lados=12)
        for k in range(4):
            xx = cols[2] + 0.12
            o = novo()
            C().cilindro(xx, y0 + 0.3, 0.12, zb + e + 0.014 * k, zb + e + 0.014 * (k + 1), vol(xx, y0 + 0.3, '#e8e0cc', brilho=0.4), M, o, lados=16, tampa_mat=liso('#f0e8d4'))
        o = novo()
        jx, jy = x1 - e - 0.14, y0 + 0.3
        _poligono_rodado(jx, jy, [(zb + e, 0.05), (zb + e + 0.08, 0.085), (zb + e + 0.18, 0.07), (zb + e + 0.26, 0.04)], vol(jx, jy, '#8a5a3a', brilho=0.3), o, lados=14)
        # as portinhas abertas
        Wd = cols[1] - cols[0] - 0.012
        zf0, zf1 = zb + 0.04, zg - 0.012
        for (lado, Hx, ang) in ((1, cols[0] + 0.006, 100), (-1, cols[3] - 0.006, 180 - 108)):
            H = (Hx, y1)
            pd = [(0.04, Wd - 0.04, zf0 + 0.03, zf1 - 0.03, 'p')]
            porta_giro(H, ang, Wd, zf0, zf1, mat_folha(JAC, pd, H, ang, seed=91), mat_folha(_hexn(_tom(hx(JAC), 0.92)), pd, H, ang, seed=95),
                       lado=lado, mat_b=FORA)
            tirador(H, ang, Wd - 0.06, (zf0 + zf1) / 2 + 0.05, lado)
        # a gaveta da esquerda puxada: os talheres e o pano
        gaveta_puxada(x0 + 0.04, meio_ - 0.006, y1, 0.17, zg + 0.012, zt - 0.05, almofadas(JAC, pain[:1], eixo=1, seed=91, passo=0.05),
                      alcas=[(x0 + meio_) / 2], funda=0.4, cor='#8a5a34',
                      tecidos=[(x0 + 0.1, x0 + 0.5, 0.05, 0.3, '#d8cfb8')])
        for k in range(5):
            _barra((x0 + 0.14 + k * 0.07, x0 + 0.155 + k * 0.07, y1 - 0.34 + 0.17 + 0.06, y1 - 0.34 + 0.17 + 0.2, zg + 0.04, zg + 0.052), '#b8bcc0', '#e8ecf0', quina=False)
    caixa((x0 + 0.02, x1 - 0.02, y0 + 0.02, y1 + 0.005, zb - 0.03, zb), _pau('#4a2412', quina=1.2, b=(0, 0, 0, 0, zb - 0.03, zb)))
    caixa((x0 - 0.025, x1 + 0.025, y0 - 0.01, y1 + 0.03, zt - 0.04, zt), {'cima': tab2(JAC_TAB, 0.17, '#3a1a0c', seed=94, org=y0),
                                                                          '*': _pau('#7a3e22', quina=1.25, b=(0, 0, 0, 0, zt - 0.04, zt))})
    for xx in ((x0 + x1) / 2 - 0.36, (x0 + x1) / 2 + 0.36):
        if aberto and xx < (x0 + x1) / 2:
            continue
        alca(xx, (zg + zt - 0.04) / 2, y1, 0.08)
    for i in range(3):
        if aberto and i != 1:
            continue
        botao((cols[i] + cols[i + 1]) / 2 + (0.13 if i == 0 else -0.13 if i == 2 else 0.0), (zb + zg) / 2 + 0.06, y1)
    peg(x0, x1, y0, y1)
    # em cima: o caminho de crochê, as garrafas, a licoreira de vidro e os copos
    CZ.toalhinha(x0 + 0.15, x1 - 0.15, y0 + 0.12, y1 - 0.12, zt + 0.0005)
    BE._garrafa(x0 + 0.2, y0 + 0.2, zt)
    CZ.itens_peq.append((x0 + 0.16, x0 + 0.24, y0 + 0.16, y0 + 0.24, zt))
    o = novo()
    gx, gy = x0 + 0.34, y0 + 0.18
    _poligono_rodado(gx, gy, [(zt, 0.04), (zt + 0.16, 0.04), (zt + 0.19, 0.022), (zt + 0.25, 0.018)], vol(gx, gy, '#7a2a24', brilho=0.45), o, lados=14)
    C().cilindro(gx, gy, 0.02, zt + 0.25, zt + 0.27, vol(gx, gy, '#2a2420'), M, o, lados=10, tampa_mat=liso('#3a3430'))
    CZ.itens_peq.append((gx - 0.04, gx + 0.04, gy - 0.04, gy + 0.04, zt))
    # a licoreira (o vidro com o licor âmbar) e a bandeja de prata com os copos
    lx, ly = x1 - 0.42, y0 + 0.24
    o = novo()

    def licor(P, base):
        return np.where((P[:, 2] > zt + 0.11)[:, None], hx('#c8dcdc'), base)
    _poligono_rodado(lx, ly, [(zt, 0.05), (zt + 0.03, 0.075), (zt + 0.1, 0.075), (zt + 0.15, 0.035), (zt + 0.19, 0.022)],
                     vol(lx, ly, '#c07a2a', brilho=0.55, faixas=licor), o, lados=16)
    o = novo()
    _poligono_rodado(lx, ly, [(zt + 0.19, 0.012), (zt + 0.2, 0.032), (zt + 0.24, 0.0)], vol(lx, ly, '#d8e4e4', brilho=0.4), o, lados=12)
    CZ.itens_peq.append((lx - 0.075, lx + 0.075, ly - 0.075, ly + 0.075, zt))
    bx, by = x1 - 0.2, y0 + 0.26
    o = novo()
    C().cilindro(bx, by, 0.13, zt, zt + 0.012, vol(bx, by, '#a8acb0', brilho=0.5), M, o, lados=24, tampa_mat=liso('#c4c8cc'))
    for (dx, dy) in ((-0.05, -0.04), (0.05, -0.02), (0.0, 0.06)):
        o = novo()
        C().cilindro(bx + dx, by + dy, 0.026, zt + 0.012, zt + 0.08, vol(bx + dx, by + dy, '#cfe2e2', brilho=0.6), M, o, lados=12,
                     tampa_mat=liso('#e8f2f2'))
    CZ.itens_peq.append((bx - 0.13, bx + 0.13, by - 0.13, by + 0.13, zt))


# =====================================================================================================================
# as estantes: a de livros e a prateleira de mantimentos
# =====================================================================================================================
LIVRO_CORES = ['#84362a', '#3e5266', '#5a6230', '#9e6a34', '#5a3446', '#2e4c3c', '#6e4228', '#94744c', '#5e2422', '#46585e']
PAPEL = '#e6d6b2'


def _lombada(cor, x0, z0, alto, larg, seed, ang=0.0, ymax=None, hmin=None):
    """O livro em pé: a lombada com as faixas ou o rótulo, a fileira clara do lado da luz; o topo; a capa do lado."""
    c0 = hx(cor)
    up = (-math.sin(ang), math.cos(ang))
    ac = (math.cos(ang), math.sin(ang))
    estilo = int(ruido(seed, 3.3) * 5)
    if larg < 0.06 and estilo == 0:
        estilo = 1
    if larg < 0.085 and estilo == 2:
        estilo = 3

    def f(L, n, P):
        dx, dz = P[:, 0] - x0, P[:, 2] - z0
        v = dx * up[0] + dz * up[1]
        u = dx * ac[0] + dz * ac[1]
        out = np.tile(c0, (len(P), 1))
        nn = np.asarray(n, float)
        if nn[1] > 0.5:
            band = lambda vv, k=1: (v >= vv) & (v < vv + k * PZ)
            if estilo == 0:
                out = np.where((band(alto * 0.14) | band(alto * 0.8))[:, None], _tom(c0, 1.45), out)
            elif estilo == 1:
                out = np.where((band(alto * 0.72, 2) | band(alto * 0.14))[:, None], _tom(c0, 0.6), out)
            elif estilo == 2:
                out = np.where(band(alto * 0.5, 2)[:, None], hx('#c8b088'), out)
            out = np.where((u < PH)[:, None], _tom(out, 1.14), out)
        elif nn[2] > 0.5:
            out = _tom(c0, 1.3)
        else:
            out = _tom(out, 0.85)
            if ymax is not None:
                hc = P[:, 1]
                lo = hmin if hmin is not None else -1e9
                dentro = (hc < ymax - PH) & (hc >= lo + PH) & (v >= PZ) & (v < alto - PZ)
                fr = (hc >= ymax - 2 * PH) | (hc < lo + 2 * PH) | (v >= alto - 2 * PZ) | (v < 2 * PZ)
                out = np.where((fr & dentro)[:, None], _tom(c0, 1.08), out)
        return BE._vao(out, P)
    return emissivo(f)


def _livro_inclinado(xl, z, w, alto, y0, y1, ang, cor, seed):
    o = novo()
    up = np.array([-math.sin(ang), math.cos(ang)])
    ac = np.array([math.cos(ang), math.sin(ang)])
    p0 = np.array([xl, z])
    p1 = p0 + ac * w
    p2 = p1 + up * alto
    p3 = p0 + up * alto
    mat = _lombada(cor, xl, z, alto, w, seed, ang=ang, ymax=y1, hmin=y0)
    cc = C()
    cc.face_plana([(p0[0], y1, p0[1]), (p1[0], y1, p1[1]), (p2[0], y1, p2[1]), (p3[0], y1, p3[1])], (0, 1, 0), mat, M, o)
    cc.face_plana([(p0[0], y0, p0[1]), (p1[0], y0, p1[1]), (p2[0], y0, p2[1]), (p3[0], y0, p3[1])], (0, -1, 0), mat, M, o)
    cc.face_plana([(p3[0], y0, p3[1]), (p2[0], y0, p2[1]), (p2[0], y1, p2[1]), (p3[0], y1, p3[1])], (up[0], 0, up[1]), mat, M, o)
    cc.face_plana([(p1[0], y0, p1[1]), (p2[0], y0, p2[1]), (p2[0], y1, p2[1]), (p1[0], y1, p1[1])], (ac[0], 0, ac[1]), mat, M, o)
    cc.face_plana([(p0[0], y0, p0[1]), (p3[0], y0, p3[1]), (p3[0], y1, p3[1]), (p0[0], y1, p0[1])], (-ac[0], 0, -ac[1]), mat, M, o)
    return p1[0]


def _livro_deitado(x0, x1, y0, y1, z0, z1, cor):
    c0 = hx(cor)

    def f(L, n, P):
        out = np.tile(c0, (len(P), 1))
        nn = np.asarray(n, float)
        zz = P[:, 2] - z0
        meio = (zz >= PZ) & (zz < 2 * PZ)
        if abs(nn[0]) > 0.5:
            out = np.where(meio[:, None], hx(PAPEL), _tom(c0, 0.9))
        elif abs(nn[2]) < 0.5:
            out = np.where(meio[:, None], _tom(c0, 1.22), out)
        return BE._vao(out, P)
    caixa((x0, x1, y0, y1, z0, z1), emissivo(f))


def _caixinha(x0, x1, y0, y1, z0, z1, cor='#7a4a2c'):
    c0 = hx(cor)

    def f(L, n, P):
        out = np.tile(c0, (len(P), 1))
        nn = np.asarray(n, float)
        if abs(nn[2]) < 0.5:
            zz = P[:, 2] - z1
            out = np.where(((zz > -0.04 - PZ) & (zz <= -0.04))[:, None], _tom(c0, 0.62), out)
            out = np.where(((zz > -0.04) & (zz <= -0.04 + PZ))[:, None], _tom(c0, 1.2), out)
            if nn[1] > 0.5:
                fe = (np.abs(P[:, 0] - (x0 + x1) / 2) < 0.022) & (zz > -0.06) & (zz <= -0.025)
                out = np.where(fe[:, None], hx('#d8ac4a'), out)
        else:
            out = _tom(out, 1.12)
        return BE._vao(out, P)
    caixa((x0, x1, y0, y1, z0, z1), emissivo(f))


def _fileira(x, x1, yb0, yb1, z, alto, seed, n, tomba=False):
    for k in range(n):
        ww = round((0.05 + 0.035 * ruido(k, seed + 3)) / PH) * PH
        if x + ww > x1:
            break
        cor = LIVRO_CORES[int(ruido(seed, k, 5.1) * len(LIVRO_CORES))]
        hh = alto * (0.72 + 0.26 * ruido(k, seed + 2))
        yy1 = yb1 - 0.03 * ruido(k, seed + 8)
        o = novo()
        C().caixa((x, x + ww, yb0, yy1, z, z + hh), _lombada(cor, x, z, hh, ww, int(seed * 31 + k * 7), ymax=yy1, hmin=yb0), M, o)
        x += ww
    if tomba and x < x1 - 0.12:
        cor = LIVRO_CORES[int(ruido(seed, 12.7) * len(LIVRO_CORES))]
        hh = alto * 0.84
        ang = math.radians(18 + 8 * ruido(seed, 13.3))
        xl = x + hh * math.sin(ang) + 0.004
        x = _livro_inclinado(xl, z, 2 * PH, hh, yb0, yb1 - 0.01, ang, cor, int(seed * 13))
    return x


def _pilha(x, comp, yb0, yb1, z, seed, n=3):
    zz = z
    for k in range(n):
        cor = LIVRO_CORES[int(ruido(seed, k, 7.7) * len(LIVRO_CORES))]
        enc = 0.025 * ruido(seed, k, 9.1)
        cc = comp - 0.03 * k
        _livro_deitado(x + enc, x + enc + cc, yb0 + 0.015 * k, yb1 - 0.01 * k, zz, zz + 3 * PZ, cor)
        zz += 3 * PZ
    return x + comp + 0.03


_ARRANJOS = (
    (('fileira', 6, False), ('pilha', 2), ('fileira', 5, False)),
    (('pilha', 3), ('fileira', 7, True), ('pote',)),
    (('fileira', 4, False), ('caixinha',), ('fileira', 6, False)),
    (('pote',), ('fileira', 7, False), ('pilha', 3)),
    (('fileira', 8, True), ('pilha', 2)),
)


def _livros(x0, x1, y, z, fundo, seed, alto=0.3):
    x = x0 + 0.03
    yb0, yb1 = y + 0.06, y + fundo - 2 * PH - 0.005
    for j, item in enumerate(_ARRANJOS[seed % len(_ARRANJOS)]):
        sd = seed * 10 + j
        if item[0] == 'fileira':
            x = _fileira(x, x1 - 0.03, yb0, yb1, z, alto, sd, item[1], item[2]) + 0.03
        elif item[0] == 'pilha':
            x = _pilha(x, 0.22, yb0 + 0.02, yb1, z, sd, item[1])
        elif item[0] == 'pote':
            BE.pote_barro(x + 0.085, yb1 - 0.09, z, r=0.075, h=0.17)
            x += 0.26
        else:
            _caixinha(x, x + 0.2, yb0 + 0.03, yb1, z, z + 0.13)
            x += 0.23
        if x > x1 - 0.08:
            break


def bookshelf():
    """
    A estante de livros alta (2,2 m; a da sala de madeira): o fundo escuro de tábuas, os lados com a quina clara, as
    cinco prateleiras com os livros em fileiras, pilhas, o pote e a caixinha; a cimalha; as costas de pinho.
    """
    x0, x1 = 0.03, 1.47
    fundo = 0.44
    h = 3.59 / UN
    prat = (0.05, 0.47, 0.89, 1.31, 1.73)
    LADO = mad2('#7a4028', eixo=1, seed=41, passo=0.07)
    TOPO = tab2(['#c27e46', '#ba7842'], 0.21, '#5a2c16', eixo=0, seed=42, org=0.0)
    FRENTE = mad2('#9e5a34', eixo=1, seed=43, passo=0.03)
    DENTRO = mad2('#3e2216', eixo=1, seed=44, passo=0.07, claro=1.06, escuro=0.94)

    def fundo_m(L, n, P):
        g = (P[:, 0] - x0) % 0.16
        out = np.tile(hx('#30190f'), (len(P), 1))
        out = np.where((g < PH)[:, None], hx('#26140c'), out)
        for z in prat[1:] + (h - 0.08,):
            out = np.where(((P[:, 2] < z) & (P[:, 2] > z - 0.06))[:, None], out * 0.78, out)
        return out
    COSTAS = tab2(PINHO, 0.16, '#6a4426', eixo=1, seed=49)
    caixa((x0, x1, 0.02, 0.05, 0, h), {'frente': emissivo(fundo_m), 'costas': COSTAS, '*': LADO})
    caixa((x0, x0 + 0.06, 0.02, fundo, 0, h), {'cima': TOPO, 'frente': FRENTE, 'dir': DENTRO, '*': LADO})
    caixa((x1 - 0.06, x1, 0.02, fundo, 0, h), {'cima': TOPO, 'frente': FRENTE, 'esq': DENTRO, '*': LADO})
    caixa((x0 + 0.06, x1 - 0.06, fundo - 0.03, fundo, 0, prat[0]), mad2('#7a4226', seed=45, passo=0.03))

    def prateleira(zp):
        def topo(L, n, P):
            out = np.tile(hx('#b8743e'), (len(P), 1))
            yy = P[:, 1]
            out = np.where((yy < fundo - 0.12)[:, None], _tom(out, 0.78), out)
            out = np.where((yy < fundo - 0.24)[:, None], _tom(hx('#b8743e'), 0.62), out)
            return np.where((yy > fundo - PH)[:, None], _tom(hx('#b8743e'), 1.12), out)
        caixa((x0 + 0.06, x1 - 0.06, 0.05, fundo, zp, zp + 0.045), {'cima': emissivo(topo), '*': mad2('#a86438', eixo=0, seed=46, passo=0.03)})
    for i, z in enumerate(prat):
        prateleira(z)
        BE._VAO['teto'] = prat[i + 1] if i + 1 < len(prat) else h - 0.08
        alto = min(0.32, (BE._VAO['teto'] - z - 0.045) * 0.85)
        _livros(x0 + 0.06, x1 - 0.06, 0.03, z + 0.045, fundo - 0.03, 7 + i * 3, alto=alto)
    BE._VAO['teto'] = None
    caixa((x0 - 0.025, x1 + 0.025, 0.02, fundo + 0.025, h - 0.05, h), {'cima': TOPO, '*': mad2('#a86438', eixo=0, seed=47, passo=0.03)})
    caixa((x0 - 0.01, x1 + 0.01, 0.02, fundo + 0.01, h - 0.08, h - 0.05), mad2('#6e3a20', seed=48, passo=0.03))
    peg(x0, x1, 0.02, fundo)


def saco(x, y, z, r=0.12, h=0.3, cor='#b89a6a'):
    """O saco de estopa (a trama em 2 px, a boca amarrada com o barbante)."""
    c0 = hx(cor)

    def trama(L, n, P):
        a = np.floor(P[:, 0] / PH) + np.floor(P[:, 1] / PH)
        b = np.floor(P[:, 2] / PZ)
        out = np.where((((np.floor(a / 2) + np.floor(b / 2)) % 2) == 0)[:, None], c0, _tom(c0, 0.92))
        return out
    _p1_malha((x - r, x + r, y - r * 0.85, y + r * 0.85, z, z + h * 0.78), (r * 0.6, r * 0.6, 0.03, r * 0.7), emissivo(trama), seg=2)
    _p1_malha((x - r * 0.35, x + r * 0.35, y - r * 0.3, y + r * 0.3, z + h * 0.7, z + h), (0.03, 0.03, 0.02, 0.03), emissivo(trama), seg=1)
    _barra((x - r * 0.37, x + r * 0.37, y - r * 0.32, y + r * 0.32, z + h * 0.8, z + h * 0.8 + 2 * PZ), '#6a4a2a', '#8a6a3a', quina=False)


def prateleira(vazio=False):
    """
    A prateleira rústica de mantimentos (2,2 m): os quatro montantes, cinco tábuas, a travessa de trás; os sacos de
    estopa, os potes de vidro, as latas, os potes de barro, o cesto e as garrafas.
    vazio: a gêmea esvaziada (prateleira!vazio), só a armação e as tábuas.
    """
    x0, x1 = 0.04, 1.46
    y0, y1 = 0.04, 0.6
    h = 3.59 / UN
    pr = (0.1, 0.56, 1.02, 1.48, 1.94, h - 0.04)
    POSTE = {'cima': liso('#a8643a'), '*': mad2('#7a4426', eixo=1, seed=101, passo=0.05)}
    for xx in (x0, x1 - 0.06):
        for yy in (y0, y1 - 0.06):
            caixa((xx, xx + 0.06, yy, yy + 0.06, 0.0, h), POSTE)
    for (k, z) in enumerate(pr):
        caixa((x0 + 0.005, x1 - 0.005, y0 + 0.005, y1 - 0.005, z, z + 0.04), {'cima': tab2(CLARA_TAB, (y1 - y0 - 0.01) / 2, '#5a2c16', seed=102 + k, org=y0),
                                                                              '*': _pau(CLARA, '#b07440', quina=1.2, b=(0, 0, 0, 0, z, z + 0.04))})
    # as travessas de trás e dos lados (o que segura a armação)
    for z in (0.34, 1.26, 2.0):
        caixa((x0 + 0.06, x1 - 0.06, y0, y0 + 0.025, z, z + 0.05), _pau('#7a4426', quina=False))
    zz = [z + 0.04 for z in pr]
    if vazio:
        peg(x0, x1, y0, y1)
        return
    # 1: os sacos de estopa e o caixote
    saco(x0 + 0.22, (y0 + y1) / 2, zz[0], r=0.15, h=0.36)
    saco(x0 + 0.52, (y0 + y1) / 2 + 0.03, zz[0], r=0.13, h=0.3, cor='#c4a878')
    caixa((x1 - 0.55, x1 - 0.1, y0 + 0.08, y1 - 0.08, zz[0], zz[0] + 0.25), CZ.ripado('#a8743e', x1 - 0.55, x1 - 0.1, y0 + 0.08, y1 - 0.08, zz[0], zz[0] + 0.25))
    # 2: os potes de vidro e as latas
    for k, (cor, hh) in enumerate((('#5a2a1e', 0.18), ('#f0ead8', 0.2), ('#e8c050', 0.17), ('#7a8a3a', 0.16))):
        CZ.pote_vidro(x0 + 0.16 + k * 0.17, (y0 + y1) / 2, zz[1], cor, h=hh, r=0.065)
    for k, (cor, hh) in enumerate((('#b8402e', 0.2), ('#3e6a8e', 0.16))):
        CZ.lata(x1 - 0.4 + k * 0.17, (y0 + y1) / 2, zz[1], cor, hh)
    # 3: os potes de barro e o cesto
    BE.pote_barro(x0 + 0.2, (y0 + y1) / 2, zz[2], r=0.11, h=0.24)
    BE.pote_barro(x0 + 0.46, (y0 + y1) / 2, zz[2], r=0.08, h=0.18)
    CZ.cesto(x1 - 0.32, (y0 + y1) / 2, zz[2], r=0.17, hh=0.15)
    # 4: as garrafas e a moringa
    for k in range(3):
        BE._garrafa(x0 + 0.16 + k * 0.12, (y0 + y1) / 2, zz[3])
    CZ.moringa(x1 - 0.3, (y0 + y1) / 2, zz[3])
    # 5: a caixa de madeira e os potes de vidro pequenos
    _caixinha(x0 + 0.12, x0 + 0.5, y0 + 0.12, y1 - 0.1, zz[4], zz[4] + 0.16, cor='#8a5230')
    for k, cor in enumerate(('#c8342a', '#e8c050')):
        CZ.pote_vidro(x1 - 0.42 + k * 0.15, (y0 + y1) / 2, zz[4], cor, h=0.13, r=0.05)
    peg(x0, x1, y0, y1)


# =====================================================================================================================
# o banheiro: a banheira, a pia, o vaso
# =====================================================================================================================
_ESMALTE = _p1_rampa(['#1e3436', '#284446', '#30524f', '#3a605c', '#466e68', '#547c74', '#628a80'])
_LOUCA = _p1_rampa(['#8e8a80', '#a8a498', '#bcb8ac', '#cecabe', '#dedace', '#ebe7dc', '#f6f2e8'])


def banheira():
    """
    A banheira de pés de bronze (0,6 m): o casco redondo pintado de verde por fora, a borda branca, o esmalte por dentro
    com a água, a torneira de latão na cabeceira e os quatro pés de garra.
    """
    x0, x1 = 0.05, 0.7
    y0, y1 = 0.06, 1.44
    zt = 0.98 / UN
    zb = 0.12
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    ax, ay = (x1 - x0) / 2, (y1 - y0) / 2
    VERDE = _p1_mat_rampa(_ESMALTE, 1.5, 5.2)
    BRANCO = _p1_mat_rampa(_LOUCA, 3.4, 6.0)
    zr = zt - 0.045

    def casco(L, n, P):
        out = VERDE(L, n, P)
        out = np.where((P[:, 2] > zr)[:, None], BRANCO(L, n, P), out)
        return out
    b = (x0, x1, y0, y1, zb, zt - 0.003)
    _p1_malha(b, (0.2, 0.26, 0.12, 0.02), emissivo(casco), seg=3)
    o = novo()
    C().face_plana(_ret_redondo(cx, cy, ax - 0.004, ay - 0.004, 0.19, zt), (0, 0, 1), bacia(cx, cy, ax - 0.004, ay - 0.004, 0.19, zt, aro=0.04), M, o)
    # os pés de garra (latão)
    for (a, b_) in ((x0 + 0.09, y0 + 0.14), (x1 - 0.09, y0 + 0.14), (x0 + 0.09, y1 - 0.14), (x1 - 0.09, y1 - 0.14)):
        o = novo()
        _poligono_rodado(a, b_, [(0.0, 0.05), (0.03, 0.045), (0.07, 0.028), (zb + 0.04, 0.04)], vol(a, b_, '#b0843a', brilho=0.5), o, lados=12)
    # a torneira de latão na cabeceira (y0), com as duas cruzetas
    tx = cx
    _barra((tx - 0.015, tx + 0.015, y0 + 0.02, y0 + 0.05, zt, zt + 0.16), LATAO, LATAO_L, quina=False)
    _barra((tx - 0.015, tx + 0.015, y0 + 0.02, y0 + 0.15, zt + 0.13, zt + 0.16), LATAO, LATAO_L, quina=False)
    _barra((tx - 0.015, tx + 0.015, y0 + 0.12, y0 + 0.15, zt + 0.08, zt + 0.13), LATAO, LATAO_L, quina=False)
    for dx in (-0.08, 0.08):
        _barra((tx + dx - 0.012, tx + dx + 0.012, y0 + 0.02, y0 + 0.045, zt, zt + 0.06), LATAO, quina=False)
        _barra((tx + dx - 0.035, tx + dx + 0.035, y0 + 0.02, y0 + 0.045, zt + 0.06, zt + 0.06 + 2 * PZ), '#e8e2d4', '#ffffff', quina=False)
    peg(x0, x1, y0, y1)


def sink():
    """
    O lavatório (0,9 m): o gabinete de madeira com as duas portinhas, o tampo de louça com a bacia, o espelhinho de
    louça atrás, a torneira cromada e o sabonete.
    """
    x0, x1, y0, y1 = 0.09, 0.66, 0.05, 0.56
    zt = 1.47 / UN
    zb = zt - 0.08
    meio = (x0 + x1) / 2
    pain = [(x0 + 0.04, meio - 0.006, 0.14, zb - 0.04, 'p'), (meio + 0.006, x1 - 0.04, 0.14, zb - 0.04, 'p')]
    caixa((x0 + 0.03, x1 - 0.03, y0 + 0.02, y1 - 0.04, 0.0, 0.08), mad2(NOG_E, seed=111, passo=0.04))
    caixa((x0, x1, y0, y1, 0.08, zb), {'frente': almofadas(NOG, pain, eixo=1, seed=112), 'costas': tab2(PINHO, 0.12, '#6a4426', eixo=1, seed=113),
                                       '*': mad2(NOG, eixo=1, seed=114, passo=0.05)})
    botao(meio - 0.05, zb - 0.12, y1)
    botao(meio + 0.05, zb - 0.12, y1)
    # o tampo de louça (com a bacia) e o espelhinho atrás
    LOU = _p1_mat_rampa(_LOUCA, 3.0, 6.0)
    tx0, tx1, ty0, ty1 = x0 - 0.02, x1 + 0.02, y0 - 0.01, y1 + 0.03
    o = novo()
    C().caixa((tx0, tx1, ty0, ty1, zb, zt), {'cima': bacia(meio, 0.33, 0.2, 0.15, 0.08, zt, aro=0.035, agua=False), '*': LOU}, M, o)
    caixa((tx0, tx1, ty0, ty0 + 0.025, zt, zt + 0.14), {'*': LOU, 'cima': liso('#f6f2e8')})
    # a torneira (o cano que sai do espelhinho, o bico, as cruzetas)
    CR = ('#a4aeb2', '#e8eef0')
    _barra((meio - 0.015, meio + 0.015, ty0 + 0.025, ty0 + 0.13, zt + 0.08, zt + 0.11), CR[0], CR[1], quina=False)
    _barra((meio - 0.015, meio + 0.015, ty0 + 0.1, ty0 + 0.13, zt + 0.04, zt + 0.08), CR[0], CR[1], quina=False)
    for dx in (-0.1, 0.1):
        _barra((meio + dx - 0.012, meio + dx + 0.012, ty0 + 0.03, ty0 + 0.055, zt, zt + 0.05), CR[0], CR[1], quina=False)
        _barra((meio + dx - 0.03, meio + dx + 0.03, ty0 + 0.03, ty0 + 0.055, zt + 0.05, zt + 0.05 + 2 * PZ), '#e8e2d4', '#ffffff', quina=False)
    # o sabonete
    _barra((x1 - 0.07, x1 - 0.0, y1 - 0.06, y1 - 0.0, zt, zt + 0.03), '#e0a8a0', '#f0c4bc', quina=False)
    CZ.itens_peq.append((x1 - 0.07, x1, y1 - 0.06, y1, zt))
    peg(x0, x1, y0, y1)


def toilet():
    """
    O vaso sanitário antigo (o assento a 0,45 m): o pé de louça, a bacia oval, o assento e a tampa de madeira fechados,
    a caixa de louça atrás com a tampa e a alavanca cromada.
    """
    cx = 0.375
    zs = 0.73 / UN
    LOU = _p1_mat_rampa(_LOUCA, 2.6, 6.0)
    # o pé e a bacia
    _p1_malha((cx - 0.12, cx + 0.12, 0.2, 0.52, 0.0, 0.2), (0.09, 0.12, 0.0, 0.04), LOU, seg=2)
    _p1_malha((cx - 0.19, cx + 0.19, 0.17, 0.66, 0.16, zs - 0.035), (0.16, 0.22, 0.08, 0.03), LOU, seg=3)
    # o assento e a tampa fechada de madeira
    MAD = _p1_mat_rampa(BE._MAD, 2.4, 6.2)
    _p1_malha((cx - 0.2, cx + 0.2, 0.18, 0.68, zs - 0.035, zs - 0.012), (0.17, 0.23, 0.005, 0.008), MAD, seg=3)
    _p1_malha((cx - 0.19, cx + 0.19, 0.19, 0.67, zs - 0.012, zs), (0.16, 0.22, 0.004, 0.006), MAD, seg=3)
    # as dobradiças e a caixa
    _barra((cx - 0.12, cx + 0.12, 0.16, 0.2, zs - 0.03, zs), '#c8ccd0', '#e8eef0', quina=False)
    caixa((cx - 0.22, cx + 0.22, 0.03, 0.2, zs - 0.06, zs + 0.34), {'*': LOU}, ch=0.02)
    caixa((cx - 0.235, cx + 0.235, 0.02, 0.215, zs + 0.34, zs + 0.38), {'*': LOU, 'cima': liso('#f6f2e8')})
    _barra((cx - 0.17, cx - 0.1, 0.2, 0.225, zs + 0.26, zs + 0.26 + 2 * PZ), '#a4aeb2', '#e8eef0', quina=False)
    _barra((cx - 0.19, cx - 0.16, 0.2, 0.22, zs + 0.24, zs + 0.29), '#a4aeb2', '#e8eef0', quina=False)
    peg(cx - 0.22, cx + 0.22, 0.03, 0.66)


# =====================================================================================================================
# os tapetes (decalques no chão: 1 px de altura, sem sombra)
# =====================================================================================================================
def _tapete(x0, x1, y0, y1, desenho, franja=None, borda='#3a1e18', franja_cor='#e8dcc0'):
    """O tapete: a placa fininha (1 px) com o desenho no topo; a franja nas pontas (ao longo de y: 'y'; de x: 'x')."""
    o = C().novo_obj(3)          # (sombra=True só para a medida 'real'; o chão não escurece: sem pegada)
    C().caixa((x0, x1, y0, y1, 0.0, PZ * 0.9), {'cima': emissivo(desenho), '*': liso(borda)}, M, o)
    if franja:
        fc = hx(franja_cor)

        def fr(L, n, P):
            a = P[:, 0] if franja == 'y' else P[:, 1]
            out = np.tile(fc, (len(P), 1))
            out = np.where((np.floor(a / PH) % 3 == 2)[:, None], _tom(fc, 0.78), out)
            return out
        of = C().novo_obj(3, sombra=False, contorno=False)
        L_ = 0.05
        zz = PZ * 0.3
        if franja == 'y':
            for (b0, b1) in ((y0 - L_, y0), (y1, y1 + L_)):
                C().face_plana([(x0 + 0.02, b0, zz), (x1 - 0.02, b0, zz), (x1 - 0.02, b1, zz), (x0 + 0.02, b1, zz)], (0, 0, 1), emissivo(fr), M, of)
        else:
            for (a0, a1) in ((x0 - L_, x0), (x1, x1 + L_)):
                C().face_plana([(a0, y0 + 0.02, zz), (a1, y0 + 0.02, zz), (a1, y1 - 0.02, zz), (a0, y1 - 0.02, zz)], (0, 0, 1), emissivo(fr), M, of)


def rug_worn():
    """O tapete gasto (2 x 3 casas): o kilim terracota de faixas com os losangos, a barra azul, as manchas de uso, a franja."""
    x0, x1, y0, y1 = 0.06, 1.44, 0.1, 2.15
    U, V = (x1 - x0) / PH, (y1 - y0) / PH
    campo, campo2 = hx('#9a4a36'), hx('#8a3e2e')
    azul, creme, mostarda = hx('#3e4a5e'), hx('#e2d2ae'), hx('#c8963c')

    def f(L, n, P):
        u, v = np.floor((P[:, 0] - x0) / PH), np.floor((P[:, 1] - y0) / PH)
        out = np.tile(campo, (len(P), 1))
        bd = np.minimum(np.minimum(u, U - 1 - u), np.minimum(v, V - 1 - v))
        # as faixas de través com a fileira de losangos
        fv = (v - 10) % 22
        faixa = (fv < 7) & (bd >= 6)
        out = np.where(((fv >= 7) & (fv < 11) & (bd >= 6))[:, None], campo2, out)
        out = np.where(faixa[:, None], hx('#6a3a2a'), out)
        cu = (u % 8) - 3.5
        los = faixa & (np.abs(cu) + np.abs(fv - 3) < 3.6)
        out = np.where(los[:, None], creme, out)
        out = np.where((faixa & (np.abs(cu) + np.abs(fv - 3) < 1.6))[:, None], mostarda, out)
        # a barra: azul, a linha creme por dentro
        out = np.where((bd < 5)[:, None], azul, out)
        out = np.where((bd == 1)[:, None], hx('#566278'), out)
        out = np.where((bd == 5)[:, None], creme, out)
        out = np.where(((bd == 3) & ((u + v) % 4 < 2))[:, None], hx('#8a96a8'), out)
        # o uso: manchas desbotadas em dois degraus (a borda segue a grade)
        s = suave(u * PH, v * PH * 1.3, 0.35, 7)
        out = np.where((s > 0.66)[:, None], _tom(out, 1.1), out)
        out = np.where((s > 0.78)[:, None], _tom(out, 1.08), out)
        return out
    _tapete(x0, x1, y0, y1, f, franja='y', borda='#2c2430')


def rug_ornate():
    """O tapete persa (3 x 4 casas): o campo vermelho, o medalhão azul com o miolo, os cantos, a barra larga com os losangos dourados, a franja."""
    x0, x1, y0, y1 = 0.07, 2.18, 0.1, 2.9
    U, V = (x1 - x0) / PH, (y1 - y0) / PH
    verm, verm2 = hx('#8e2a24'), hx('#7a2420')
    azul, azul2 = hx('#22304a'), hx('#2e4060')
    ouro, creme = hx('#c8963c'), hx('#e6d4a8')

    def f(L, n, P):
        u, v = np.floor((P[:, 0] - x0) / PH), np.floor((P[:, 1] - y0) / PH)
        out = np.tile(verm, (len(P), 1))
        bd = np.minimum(np.minimum(u, U - 1 - u), np.minimum(v, V - 1 - v))
        # o miudinho do campo (cruzinhas a cada 12 px)
        cu, cv = (u % 12) - 6, (v % 12) - 6
        cruz = ((np.abs(cu) < 1) & (np.abs(cv) < 2)) | ((np.abs(cv) < 1) & (np.abs(cu) < 2))
        out = np.where(cruz[:, None], ouro, out)
        # o medalhão do meio (losango) e o miolo
        du, dv = u - U / 2, v - V / 2
        q = np.abs(du) / (U * 0.28) + np.abs(dv) / (V * 0.26)
        out = np.where((q < 1)[:, None], azul, out)
        out = np.where(((q >= 1) & (q < 1.06))[:, None], ouro, out)
        out = np.where(((q < 0.82) & (q > 0.74))[:, None], azul2, out)
        q2 = np.abs(du) / (U * 0.14) + np.abs(dv) / (V * 0.13)
        out = np.where((q2 < 1)[:, None], verm, out)
        out = np.where(((q2 >= 1) & (q2 < 1.12))[:, None], creme, out)
        out = np.where((np.abs(du) + np.abs(dv) < 4)[:, None], ouro, out)
        out = np.where((np.abs(du) + np.abs(dv) < 2)[:, None], creme, out)
        # os pontos do medalhão (as pontas em cima e embaixo)
        out = np.where(((np.abs(du) < 2) & (np.abs(np.abs(dv) - V * 0.29) < 3))[:, None], ouro, out)
        # os cantos do campo (quartos de losango azuis)
        cu2 = np.minimum(u - 12, U - 13 - u)
        cv2 = np.minimum(v - 12, V - 13 - v)
        qc = cu2 / (U * 0.18) + cv2 / (V * 0.14)
        canto = (qc < 1) & (cu2 >= 0) & (cv2 >= 0)
        out = np.where(canto[:, None], azul, out)
        out = np.where((canto & (qc > 0.86))[:, None], ouro, out)
        # a barra larga: azul, os losangos dourados, as linhas de guarda
        barra = bd < 11
        out = np.where(barra[:, None], azul, out)
        al = np.where((np.minimum(v, V - 1 - v) < 11) & (np.minimum(u, U - 1 - u) >= 11), u, v)
        lb = (al % 10) - 5
        los = barra & (np.abs(lb) + np.abs(bd - 5.5) < 4.2) & (bd >= 2) & (bd <= 9)
        out = np.where(los[:, None], ouro, out)
        out = np.where((barra & (np.abs(lb) + np.abs(bd - 5.5) < 1.6))[:, None], verm, out)
        out = np.where(((bd == 1) | (bd == 10))[:, None], ouro, out)
        out = np.where(((bd == 11) | (bd == 12))[:, None], verm2, out)
        out = np.where((bd == 13)[:, None], ouro, out)
        return out
    _tapete(x0, x1, y0, y1, f, franja='y', borda='#1a2030')


def rug_aubusson():
    """O tapete Aubusson (4 x 3 casas): o campo creme, o medalhão oval rosado com a rosa, a guirlanda, a barra verde-oliva com as flores, sem franja."""
    x0, x1, y0, y1 = 0.06, 2.94, 0.06, 2.19
    U, V = (x1 - x0) / PH, (y1 - y0) / PH
    creme, creme2 = hx('#e6d8b8'), hx('#dccca8')
    oliva, oliva2 = hx('#7a8a5a'), hx('#5e6e44')
    rosa, rosa2, rosa_c = hx('#c4766a'), hx('#a85a54'), hx('#e0a898')
    bege = hx('#d8b49a')

    def f(L, n, P):
        u, v = np.floor((P[:, 0] - x0) / PH), np.floor((P[:, 1] - y0) / PH)
        out = np.tile(creme, (len(P), 1))
        out = np.where((((u // 6) + (v // 6)) % 2 == 0)[:, None] & ((u % 6 == 0) | (v % 6 == 0))[:, None], creme2, out)
        bd = np.minimum(np.minimum(u, U - 1 - u), np.minimum(v, V - 1 - v))
        du, dv = (u - U / 2) / (U * 0.26), (v - V / 2) / (V * 0.3)
        e = np.hypot(du, dv)
        # a guirlanda em volta do medalhão (botõezinhos rosa com as folhas)
        ang = np.arctan2(dv, du)
        k = np.floor((ang + math.pi) / (2 * math.pi) * 18)
        am = (k + 0.5) / 18 * 2 * math.pi - math.pi
        bu = U / 2 + np.cos(am) * U * 0.26 * 1.32
        bv = V / 2 + np.sin(am) * V * 0.3 * 1.32
        db = np.abs(u - bu) + np.abs(v - bv)
        out = np.where((db < 2.5)[:, None], rosa, out)
        out = np.where((db < 1)[:, None], rosa_c, out)
        out = np.where(((db >= 2.5) & (db < 3.5) & ((u - bu) * (v - bv) > 0))[:, None], oliva, out)
        # o medalhão oval
        out = np.where((e < 1)[:, None], bege, out)
        out = np.where(((e >= 1) & (e < 1.06))[:, None], oliva2, out)
        out = np.where(((e > 0.86) & (e < 0.9))[:, None], rosa2, out)
        # a rosa do meio
        rr = np.hypot(u - U / 2, (v - V / 2) * 1.1)
        out = np.where((rr < 6)[:, None], rosa, out)
        out = np.where(((rr < 6) & (np.sin(np.arctan2(v - V / 2, u - U / 2) * 3 + rr * 0.9) > 0.4))[:, None], rosa2, out)
        out = np.where((rr < 2)[:, None], rosa_c, out)
        for s in (-1, 1):
            fo = (np.abs(u - U / 2 - s * 8) + np.abs(v - V / 2 + s * 2) * 1.6) < 3.5
            out = np.where(fo[:, None], oliva, out)
        # os cantos (o arabesco de 1 linha)
        cu2 = np.minimum(u - 12, U - 13 - u)
        cv2 = np.minimum(v - 12, V - 13 - v)
        rc = np.hypot(cu2 / 26, cv2 / 20)
        out = np.where(((cu2 >= 0) & (cv2 >= 0) & (np.abs(rc - 1) < 0.05))[:, None], oliva, out)
        out = np.where(((cu2 >= 0) & (cv2 >= 0) & (np.abs(cu2 - 4) + np.abs(cv2 - 4) < 2.5))[:, None], rosa, out)
        # a barra: oliva com as flores rosa e a linha rosa por dentro
        barra = bd < 10
        out = np.where(barra[:, None], oliva, out)
        al = np.where((np.minimum(v, V - 1 - v) < 10) & (np.minimum(u, U - 1 - u) >= 10), u, v)
        fl = barra & ((np.abs((al % 12) - 6) + np.abs(bd - 5)) < 2.6)
        out = np.where(fl[:, None], rosa, out)
        out = np.where((barra & ((np.abs((al % 12) - 6) + np.abs(bd - 5)) < 1))[:, None], rosa_c, out)
        out = np.where((barra & (np.abs((al % 12)) + np.abs(bd - 5) < 1.5))[:, None], creme, out)
        out = np.where(((bd == 1) | (bd == 8))[:, None], oliva2, out)
        out = np.where((bd == 10)[:, None], rosa2, out)
        return out
    _tapete(x0, x1, y0, y1, f, franja=None, borda='#4a5234')


# =====================================================================================================================
# as luzes: a luminária, as velas, o candelabro, a lâmpada pendurada (estado 0 aceso, '1' apagado)
# =====================================================================================================================
def chama(x, y, z, k=1.0, acesa=True):
    """A chama da vela (sem luz de face e sem contorno: brilha) ou, apagada, o pavio."""
    if acesa:
        o = C().novo_obj(3, contorno=False, sombra=False)
        CZ.luzes.add(o)
        C().elipsoide(np.array([x, y, z + 0.04 * k]), np.array([0.022, 0.022, 0.045]) * k, liso('#ffa830'), o)
        o2 = C().novo_obj(3, contorno=False, sombra=False)
        CZ.luzes.add(o2)
        C().elipsoide(np.array([x + 0.003, y + 0.003, z + 0.032 * k]), np.array([0.012, 0.012, 0.026]) * k, liso('#fff4c0'), o2)
    _barra((x - PH * 0.5, x + PH * 0.5, y - PH * 0.5, y + PH * 0.5, z - 0.005, z + 0.018), '#2a1e18', quina=False)


def vela(x, y, z, h, r=0.03, acesa=True):
    """A vela de cera marfim: o corpo, o escorrido na beira de cima e a poça de cera no topo."""
    def esc(P, b):
        zz = P[:, 2] - (z + h)
        th = np.arctan2(P[:, 1] - y, P[:, 0] - x)
        pin = (zz > -0.02 - 0.03 * (np.sin(th * 3) > 0.6)) & (np.sin(th * 3) > 0.2)
        return np.where(pin[:, None], _tom(b, 1.08), b)
    o = novo()
    C().cilindro(x, y, r, z, z + h, _pau('#eadcbc', quina=False), M, o, lados=12, tampa_mat=liso('#f8f0dc'))
    chama(x, y, z + h, 1.0, acesa)


def lampadinha(x, y, z0, z1, acesa, oid):
    """A lâmpada (o bulbo em gota, de baixo para cima): acesa, a cor chapada clara (sem luz de face nem contorno)."""
    h = z1 - z0
    cor = '#fff4c8' if acesa else '#bdb8ac'
    m = liso(cor) if acesa else vol(x, y, cor, brilho=0.3)
    _poligono_rodado(x, y, [(z0, 0.0), (z0 + h * 0.15, 0.03), (z0 + h * 0.45, 0.045), (z0 + h * 0.75, 0.035), (z1, 0.02)], m, oid, lados=14)


def desk_lamp(acesa=True):
    """A luminária de mesa (0,45 m): a base de latão, a haste, o botão, a cúpula de pano creme (acesa: clara por dentro, a lâmpada à mostra)."""
    cx, cy = 0.375, 0.375
    h = 0.73 / UN
    o = novo()
    _poligono_rodado(cx, cy, [(0.0, 0.1), (0.015, 0.1), (0.03, 0.075), (0.045, 0.03)], vol(cx, cy, '#b0843a', brilho=0.5), o, lados=22,
                     tampa_mat=liso('#d0a050'))
    o = novo()
    C().cilindro(cx, cy, 0.014, 0.045, h - 0.12, vol(cx, cy, '#b0843a', brilho=0.5), M, o, lados=10, tampa=False)
    _barra((cx + 0.012, cx + 0.04, cy - PH, cy + PH, 0.2, 0.2 + 2 * PZ), '#5a4020', quina=False)
    # a cúpula: o tronco de cone de pano, a costura de baixo e a de cima
    zb, zt = h - 0.17, h
    def pano(P, b):
        zz = P[:, 2]
        b = np.where((zz < zb + 1.5 * PZ)[:, None], _tom(b, 0.82), b)
        b = np.where((zz > zt - 1.5 * PZ)[:, None], _tom(b, 0.86), b)
        if acesa:
            b = np.where((zz < zb + 0.06)[:, None] & (zz >= zb + 1.5 * PZ)[:, None], _tom(b, 1.08), b)
        return b
    cor = '#f2dca0' if acesa else '#cdbf9a'
    o = novo()
    C().cilindro(cx, cy, 0.14, zb, zt, vol(cx, cy, cor, faixas=pano), M, o, lados=24, tampa=False, r1=0.085)

    def boca(L, n, P):
        rr = np.hypot(P[:, 0] - cx, P[:, 1] - cy)
        dentro = hx('#fff0c0') if acesa else hx('#6a5a40')
        return np.where((rr > 0.085 - 0.012)[:, None], hx(cor) * 0.9, dentro)
    od = C().novo_obj(3, contorno=False, sombra=False)
    _disco(cx, cy, zt + 0.001, 0.085 - 0.012, emissivo(boca), od, lados=24)
    _disco(cx, cy, zt, 0.085, liso('#e8d498' if acesa else '#b8aa88'), o, lados=24)
    if acesa:
        CZ.luzes.add(od)
    # a lâmpada aparecendo embaixo da cúpula
    ob = C().novo_obj(3, contorno=not acesa, sombra=False)
    if acesa:
        CZ.luzes.add(ob)
    lampadinha(cx, cy, zb - 0.06, zb + 0.01, acesa, ob)
    peg(cx - 0.1, cx + 0.1, cy - 0.1, cy + 0.1)


def candles(acesa=True):
    """As velas (0,35 m): três velas de alturas diferentes no pratinho de latão."""
    cx, cy = 0.375, 0.375
    o = novo()
    _poligono_rodado(cx, cy, [(0.0, 0.13), (0.012, 0.15), (0.022, 0.155)], vol(cx, cy, '#b0843a', brilho=0.5), o, lados=26)

    def prato(L, n, P):
        rr = np.hypot(P[:, 0] - cx, P[:, 1] - cy)
        return np.where((rr > 0.13)[:, None], hx('#d8ac58'), hx('#a07430'))
    _disco(cx, cy, 0.022, 0.155, emissivo(prato), o, lados=26)
    for (dx, dy, hh) in ((-0.06, -0.04, 0.26), (0.06, -0.03, 0.18), (-0.01, 0.07, 0.12)):
        vela(cx + dx, cy + dy, 0.012, hh, 0.032, acesa)
    CZ.itens_peq.append((cx - 0.1, cx + 0.1, cy - 0.1, cy + 0.1, 0.022))
    peg(cx - 0.15, cx + 0.15, cy - 0.15, cy + 0.15)


def candelabra(acesa=True):
    """O candelabro de chão de bronze (1,6 m): a base redonda em degraus, a haste torneada, os quatro braços e as cinco velas."""
    cx, cy = 0.375, 0.375
    B = '#a87a34'
    o = novo()
    _poligono_rodado(cx, cy, [(0.0, 0.2), (0.03, 0.2), (0.05, 0.16), (0.09, 0.12), (0.12, 0.06), (0.16, 0.045)],
                     vol(cx, cy, B, brilho=0.5), o, lados=26)
    o = novo()
    za = 1.3
    _poligono_rodado(cx, cy, [(0.16, 0.03), (0.3, 0.022), (0.36, 0.045), (0.4, 0.022), (0.9, 0.018), (0.95, 0.04), (0.99, 0.02),
                              (za - 0.05, 0.02), (za, 0.05)], vol(cx, cy, B, brilho=0.5), o, lados=14)
    braco = 0.2
    # a coroa: o prato de bronze em cima da haste, com a beira clara
    o = novo()
    C().cilindro(cx, cy, braco + 0.04, za, za + 0.025, vol(cx, cy, B, brilho=0.5), M, o, lados=26, tampa=False, r1=braco + 0.05)

    def coroa(L, n, P):
        rr = np.hypot(P[:, 0] - cx, P[:, 1] - cy)
        out = np.where((rr > braco + 0.035)[:, None], hx('#e0b860'), hx('#8a6224'))
        return np.where((rr < braco - 0.03)[:, None], hx('#a87a34'), out)
    _disco(cx, cy, za + 0.025, braco + 0.05, emissivo(coroa), o, lados=26)
    for (px_, py_, zc, hv) in ((cx + braco, cy, za + 0.025, 0.14), (cx - braco, cy, za + 0.025, 0.14), (cx, cy + braco, za + 0.025, 0.14),
                               (cx, cy - braco, za + 0.025, 0.14), (cx, cy, za + 0.025, 0.2)):
        o = novo()
        _poligono_rodado(px_, py_, [(zc, 0.03), (zc + 0.02, 0.04), (zc + 0.03, 0.042)], vol(px_, py_, B, brilho=0.5), o, lados=12,
                         tampa_mat=liso('#d8ac58'))
        vela(px_, py_, zc + 0.03, hv, 0.022, acesa)
    peg(cx - 0.2, cx + 0.2, cy - 0.2, cy + 0.2)


def ceiling_lamp(acesa=True):
    """
    A lâmpada pendurada (a da cozinha): a cúpula de esmalte branco com a borda azul, a lâmpada, o soquete e o fio que
    sobe e some em transparência antes da viga (não há onde prender no desenho).
    """
    x, y, zc = 0.375, 0.375, 2.3
    o = novo()
    perfil = [(zc, 0.2), (zc + 0.03, 0.18), (zc + 0.08, 0.12), (zc + 0.13, 0.055), (zc + 0.15, 0.04)]

    def esmalte(P, b):
        zz = P[:, 2] - zc
        b = np.where((zz < 1.5 * PZ)[:, None], hx('#3e5f8e'), b)
        return np.where(((zz > 0.115) & (zz < 0.115 + PZ))[:, None], hx('#3e5f8e'), b)
    _poligono_rodado(x, y, perfil, vol(x, y, '#ece6d6', brilho=0.35, faixas=esmalte), o, lados=26, tampa_mat=liso('#d8d2c2'))
    C().cilindro(x, y, 0.025, zc + 0.15, zc + 0.2, vol(x, y, '#2a2624', brilho=0.3), M, o, lados=10, tampa_mat=liso('#3a3634'))
    ob = C().novo_obj(3, contorno=not acesa, sombra=False)
    if acesa:
        CZ.luzes.add(ob)
    lampadinha(x, y, zc - 0.17, zc, acesa, ob)
    of = C().novo_obj(3, sombra=False, contorno=False)
    C().caixa((x - 0.012, x + 0.012, y - 0.012, y + 0.012, zc + 0.2, 2.84), liso('#2a2420'), M, of)
    CZ.fades.append((of, 2.55, 0.28))


# =====================================================================================================================
# o catálogo deste grupo: def -> (largura, fundo em casas, a quina da pegada, o desenho, {estado: desenho})
# =====================================================================================================================
ITENS = {
    'guarda_roupa': (2, 1, (0.0, 0.0), guarda_roupa, {'1': lambda: guarda_roupa(True)}),
    'comoda': (2, 1, (0.0, 0.0), comoda, {'1': lambda: comoda(False, True)}),
    'cama_casal': (2, 3, (0.0, 0.0), cama_casal, {}),
    'cama_solteiro': (1, 3, (0.0, 0.0), cama_solteiro, {}),
    'beliche': (1, 3, (0.0, 0.0), beliche, {}),
    'nightstand': (1, 1, (0.0, 0.0), criado_mudo, {'1': lambda: criado_mudo(True)}),
    'mesa_jantar': (4, 2, (0.0, 0.0), mesa_jantar, {}),
    # as gêmeas vazias (o jogo troca quando os jogadores pegam o que estava em cima/dentro): o mesmo móvel, a mesma
    # pegada e a mesma âncora, sem os objetos soltos. O criado-mudo não tem nada solto: a vazia é ele mesmo.
    'comoda!vazio': (2, 1, (0.0, 0.0), lambda: comoda(True), {'1': lambda: comoda(True, True)}),
    'nightstand!vazio': (1, 1, (0.0, 0.0), criado_mudo, {'1': lambda: criado_mudo(True, True)}),
    'mesa_jantar!vazio': (4, 2, (0.0, 0.0), lambda: mesa_jantar(True), {}),
    'prateleira!vazio': (2, 1, (0.0, 0.0), lambda: prateleira(True), {}),
    'desk_wood': (2, 1, (0.0, 0.0), desk_wood, {}),
    'prateleira': (2, 1, (0.0, 0.0), prateleira, {}),
    'bookshelf': (2, 1, (0.0, 0.0), bookshelf, {}),
    'armchair': (1, 1, (0.0, 0.0), armchair, {}),
    'bench': (2, 1, (0.0, 0.0), bench, {}),
    'sideboard': (2, 1, (0.0, 0.0), sideboard, {'1': lambda: sideboard(True)}),
    'banheira': (1, 2, (0.0, 0.0), banheira, {}),
    'sink': (1, 1, (0.0, 0.0), sink, {}),
    'toilet': (1, 1, (0.0, 0.0), toilet, {}),
    'rug_worn': (2, 3, (0.0, 0.0), rug_worn, {}),
    'rug_ornate': (3, 4, (0.0, 0.0), rug_ornate, {}),
    'rug_aubusson': (4, 3, (0.0, 0.0), rug_aubusson, {}),
    'desk_lamp': (1, 1, (0.0, 0.0), lambda: desk_lamp(True), {'1': lambda: desk_lamp(False)}),
    'candles': (1, 1, (0.0, 0.0), lambda: candles(True), {'1': lambda: candles(False)}),
    'candelabra': (1, 1, (0.0, 0.0), lambda: candelabra(True), {'1': lambda: candelabra(False)}),
    # a lâmpada do teto fica a do jogo (a cúpula preta da cozinha, que balança): esta saiu pequena demais
    # 'ceiling_lamp': (1, 1, (0.0, 0.0), lambda: ceiling_lamp(True), {'1': lambda: ceiling_lamp(False)}),
    'table_round': (2, 2, (0.0, 0.0), table_round, {}),
    'table_small': (1, 1, (0.0, 0.0), table_small, {}),
    'stool': (1, 1, (0.0, 0.0), stool, {}),
}
