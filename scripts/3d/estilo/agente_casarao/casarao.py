"""
O casarão da Fazenda Olhos de Águia visto de fora, em pixel art feito só por código (motor do CRONA, ESC 0,75:
1 pixel da arte ~ 0,032 m), no estilo da sala4: faces chapadas com a luz por face, contorno de 1 px, juntas de 1 px
desenhadas no pixel (pedra, telha, tábua), sombra do sol no chão, luz quente nas janelas e a fumaça da chaminé.

As medidas vêm do jogo:
  - shared/src/furni.ts: casarao width 14 x depth 9 casas (10,5 x 6,75 m), height 6,5;
  - server/src/seedFazenda.ts: ["casarao", 13, 9, 4] (x 13..26, y 9..17, frente para +y) e a entrada larga em (19, 18);
    a volta de terra volta(9, 6, 33, 28, r 5, larg 2), a trilha ret(19, 18, 20, 21) e o pátio de pedra
    disco(20.5, 23.5, 4.2, 3.4); os arbustos em (14,18) (16,18) (23,18) (25,18) (17,21) (23,21) e a árvore em (12,22);
  - client/src/render/furniFazenda.ts (casarao): corpo u 0,4..D-1,9 / v 0,3..W-0,3 / z 0..6 (dois andares de 3 m),
    a faixa entre os andares em 3,0..3,15, rodapé de pedra até 0,5, varanda (deck 0,42) com 6 pilares, guarda-corpo
    a 1,25..1,33 e o telhado de uma água de 2,95 a 3,5; telhado de duas águas (beiral 6,0, cumeeira 8,4, beiral
    0,35 casa); janelas 0,9 x 1,4 (lados 0,8) a 1,1 e 3,9 m, 5 vãos na frente (o do meio é a porta de 2 folhas,
    1,5 casa x 2,4 m); chaminé em u 1,6..2,3, v 0,72 W (+0,7), até 8,9 m; cores parede #d9cbb0, telha #8c3b26,
    madeira #4a3020, vidro #26323a, veneziana #3e5a3a, moldura #e8e0d0.

Uso:  python3 casarao.py [saida.png]          a imagem inteira (2x), a 1x e os recortes
      python3 casarao.py --gif                também o GIF (12 quadros: a fumaça, o fogo na janela, o capim)
"""
import os
import sys
os.environ['ESC'] = '0.75'
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'codigo'))
import math
import numpy as np
from PIL import Image
from motor import Cena, MUNDO, tela, ruido, suave, emissivo, KX, KY, KZ, VISTA

M = MUNDO
C = 0.75                    # a casa do tabuleiro, em metros
PXM = 0.032                 # ~1 px da arte no chão, em metros
PZ = 1 / KZ                 # 1 px na vertical, em metros
AQUI = os.path.dirname(os.path.abspath(__file__))


def hx(h):
    h = h.lstrip('#')
    return np.array([int(h[i:i + 2], 16) for i in (0, 2, 4)], float)


def tom(c, k):
    return np.clip(np.asarray(c, float) * k, 0, 255)


def liso(c):
    c = hx(c) if isinstance(c, str) else np.asarray(c, float)
    return emissivo(lambda L, n, P: np.tile(c, (len(L), 1)))


def coords(L, n):
    """As duas coordenadas da face (a ao longo, b para cima / para o fundo)."""
    if abs(n[2]) > 0.5:
        return L[:, 0], L[:, 1]
    if abs(n[1]) >= abs(n[0]):
        return L[:, 0], L[:, 2]
    return L[:, 1], L[:, 2]


def viz(a, dy, dx, fill):
    """O vizinho (dy, dx) de cada pixel: viz(a, 1, 0) = o de baixo."""
    h, w = a.shape[:2]
    out = np.full_like(a, fill)
    ys = slice(max(0, dy), h + min(0, dy))
    yd = slice(max(0, -dy), h + min(0, -dy))
    xs = slice(max(0, dx), w + min(0, dx))
    xd = slice(max(0, -dx), w + min(0, -dx))
    out[yd, xd] = a[ys, xs]
    return out


# ================================================================ as medidas (metros) ================================
# o casarão: pegada x 13..27, y 9..18 casas; corpo u 0,4..7,1 e v 0,3..13,7 (u = fundo -> frente = y, v = x)
X0, Y0 = 13 * C, 9 * C
W, D = 14 * C, 9 * C
HX0, HX1 = X0 + 0.3 * C, X0 + W - 0.3 * C          # 9,975 .. 20,025
HY0, HY1 = Y0 + 0.4 * C, Y0 + D - 1.9 * C         # 7,05 .. 12,075
ZE, ZR = 6.0, 8.4                                  # o beiral e a cumeeira
YR = (HY0 + HY1) / 2                               # a cumeeira (em y)
BEIRAL = 0.35 * C
KT = (ZR - ZE) / (YR - HY0)                        # a inclinação do telhado (m por m)
ZB = ZE - BEIRAL * KT
DECK = (X0 + 0.2 * C, X0 + W - 0.2 * C, HY1, Y0 + D - 0.15 * C, 0.0, 0.42)
YFR = DECK[3]                                      # a frente do deck
MEIO = X0 + W / 2                                  # o meio da frente (a porta) = 20 casas
PILARES = [X0 + v * C for v in (0.35, 3.5, 6.0, 8.0, 10.5, 13.65)]
YPIL = Y0 + D - 0.35 * C                           # o meio dos pilares (u D-0,42..D-0,28)
CHAM = (X0 + 0.72 * W, X0 + 0.72 * W + 0.7 * C, Y0 + 1.6 * C, Y0 + 2.3 * C)
# o pedaço da fazenda em volta (casas 9..29.5 x 7..23)
GX0, GX1, GY0, GY1 = 9.0 * C, 29.5 * C, 7.0 * C, 23.0 * C
GZ = -0.42                                         # a espessura da "fatia" de chão

# ================================================================ a paleta ===========================================
PAREDE = '#dccdb0'
CAL = '#eee7d8'            # a moldura branca (cunhais, cimalha, janelas, pilares)
VENEZ = '#4a6a44'
VENEZ_E = '#34502f'
TELHA = ['#a4492a', '#ac522f', '#9a4428', '#b05a34']
TELHA_J = '#5e2416'
MAD = '#5a3a24'
DECK_C = ['#9a6a40', '#a27146', '#94643c']
PEDRA = ['#a7a196', '#9b958a', '#b1ab9f', '#928c82']
PEDRA_J = '#5a544c'
GRAMA = [hx('#7fa24a'), hx('#88aa50'), hx('#93b458'), hx('#77983f')]
TERRA = hx('#b98f5c')
TERRA_E = hx('#a47c4c')
SOLO = '#7a5434'

# ================================================================ a cena ============================================
cantos = np.array([[x, y, z] for x in (GX0, GX1) for y in (GY0, GY1) for z in (GZ - 0.1, 11.6)])
S = tela(cantos)
sx0, sy0 = int(S[:, 0].min()) - 6, int(S[:, 1].min()) - 6
c = Cena(sx0, sy0, int(S[:, 0].max() - sx0) + 6, int(S[:, 1].max() - sy0) + 6)
luzes = set()          # os objetos que brilham (sem luz de face nem sombra)
CELULAS = []           # (oids, fn(P, N) -> ids, opções): as juntas de 1 px desenhadas no pixel
pegadas = []           # (x0, x1, y0, y1, forca) a sombra de contato no chão
VIDROS = {}            # oid -> 'escuro' | 'aceso' | 'fogo'


def obj(tipo=3, contorno=True, sombra=True):
    return c.novo_obj(tipo, contorno=contorno, sombra=sombra)


def caixa(b, mat, tipo=3, contorno=True, sombra=True, ch=0.0, o=None):
    o = obj(tipo, contorno, sombra) if o is None else o
    c.caixa(b, mat, M, o, ch=ch)
    return o


def celulas(oids, fn, junta, luz=1.12, sombra=0.86, lado=1.05, so_baixo=False):
    CELULAS.append((list(oids) if isinstance(oids, (list, tuple, set)) else [oids], fn, hx(junta), luz, sombra, lado, so_baixo))


# ---------------------------------------------------------------- texturas (no mundo)
def mat_cel(cores, fn, seed=0):
    """A cor de cada célula (pedra, telha, tábua): o tom sorteado pelo id da célula (constante dentro dela)."""
    cs = np.stack([hx(x) for x in cores])

    def f(L, n, P):
        ids = fn(P, np.tile(n, (len(P), 1)))
        k = (ruido(ids * 0.37, seed + 1.3) * len(cs)).astype(int) % len(cs)
        return cs[k]
    return emissivo(f)


def id_pedras(alt=0.16, comp=(0.22, 0.42), seed=0):
    """Pedras em fiadas desencontradas (na face em pé), o comprimento de cada uma sorteado."""
    def fn(P, N):
        n = N[0] if N.ndim == 1 else N
        lat = np.where(np.abs(n[:, 0]) > np.abs(n[:, 1]), P[:, 1], P[:, 0])
        fila = np.floor((P[:, 2] + 3.0) / alt)
        passo = comp[0] + (comp[1] - comp[0]) * 0.5
        off = ruido(fila, seed) * passo
        col = np.floor((lat + off) / passo + 0.35 * np.sin(fila * 1.7 + np.floor((lat + off) / passo) * 2.3))
        return (fila * 1000 + col).astype(np.int64)
    return fn


def id_lajes(tam=0.34, seed=0):
    """As lajes do pátio (no chão): células de Voronoi em grade torta."""
    def fn(P, N):
        gx, gy = P[:, 0] / tam, P[:, 1] / tam
        ix, iy = np.floor(gx), np.floor(gy)
        best = np.full(len(P), 1e9)
        bid = np.zeros(len(P), np.int64)
        for dx in (-1, 0, 1):
            for dy in (-1, 0, 1):
                cx, cy = ix + dx, iy + dy
                px = cx + 0.15 + 0.7 * ruido(cx, cy, seed)
                py = cy + 0.15 + 0.7 * ruido(cy, cx, seed + 3)
                d = (gx - px) ** 2 + (gy - py) ** 2 * 1.0
                m = d < best
                best = np.where(m, d, best)
                bid = np.where(m, (cx * 7919 + cy * 104729).astype(np.int64), bid)
        return bid
    return fn


# ================================================================ o chão ============================================
def volta_d(x, y):
    """A volta de terra em redor do casarão (casas): a borda de 2 casas do retângulo 9..33 x 6..28 de cantos r 5."""
    x0, y0, x1, y1, r = 9, 6, 33, 28, 5
    qx = np.maximum(np.maximum(x0 + r - x, 0), x - (x1 - r))
    qy = np.maximum(np.maximum(y0 + r - y, 0), y - (y1 - r))
    fora = np.hypot(qx, qy) - r          # > 0 fora do retângulo arredondado
    return fora


def terreno(P):
    """O tipo do chão em cada ponto: 0 grama, 1 terra (estrada, trilha), 2 pedra (pátio)."""
    X, Y = P[:, 0] / C, P[:, 1] / C
    # a borda com um tremido (não é casa por casa: a terra come a grama aos pouquinhos)
    tr = (suave(P[:, 0], P[:, 1], 0.45, 3) - 0.5) * 0.35 + (suave(P[:, 0], P[:, 1], 0.16, 4) - 0.5) * 0.18
    f = volta_d(X, Y)
    estrada = (f < 0 + tr) & (f > -2 - tr)
    trilha = (np.abs(X - 20.0) < 1.0 + tr * 0.8) & (Y > 17.5) & (Y < 22)
    patio = ((X - 20.5) / 4.2) ** 2 + ((Y - 23.5) / 3.4) ** 2 <= 1 + tr * 0.25
    t = np.zeros(len(P), int)
    t = np.where(estrada | trilha, 1, t)
    t = np.where(patio, 2, t)
    return t


def mat_chao():
    lajes = id_lajes()
    pedra = np.stack([hx(x) for x in ('#cfc8b8', '#c4bdac', '#d6cfbf', '#bdb6a6')])

    def f(L, n, P):
        t = terreno(P)
        X, Y = P[:, 0], P[:, 1]
        # a grama: manchas grandes e pequenas em 4 tons (degraus limpos)
        q = suave(X, Y, 1.3, 11) * 0.6 + suave(X, Y, 0.5, 12) * 0.4
        k = np.digitize(q, [0.36, 0.5, 0.64])
        g = np.stack(GRAMA)[np.array([3, 0, 1, 2])[k]]
        # a terra: os sulcos das rodas (estrada) e manchas
        qt = suave(X, Y, 0.6, 21)
        terra = np.where((qt > 0.58)[:, None], TERRA_E, TERRA)
        terra = np.where((qt < 0.3)[:, None], TERRA * 1.05, terra)
        ids = lajes(P, None)
        kk = (ruido(ids * 0.37, 2.3) * 4).astype(int) % 4
        out = np.where((t == 0)[:, None], g, np.where((t == 1)[:, None], terra, pedra[kk]))
        return out
    return emissivo(f)


def mat_solo():
    """O lado da fatia de chão: a grama por cima (franja), a terra em camadas e umas pedrinhas."""
    def f(L, n, P):
        z = P[:, 2]
        lat = np.where(abs(n[0]) > abs(n[1]), P[:, 1], P[:, 0])
        base = np.tile(hx(SOLO), (len(P), 1))
        cam = np.floor((z - GZ) / 0.09 + 0.6 * np.sin(lat * 2.1))
        base = np.where((cam % 3 == 1)[:, None], hx('#6c4a2e'), base)
        base = np.where(((cam % 3 == 2) & (ruido(np.floor(lat / 0.12), cam, 5.0) > 0.7))[:, None], hx('#8a6a4c'), base)
        # a franja de grama: 3 px que descem em dentes
        dente = 0.05 + 0.04 * (ruido(np.floor(lat / 0.064), 9.0) > 0.5) + 0.03 * (ruido(np.floor(lat / 0.096), 8.0) > 0.6)
        base = np.where((z > -dente)[:, None], hx('#6f9440'), base)
        base = np.where((z > -0.028)[:, None], hx('#8bae52'), base)
        return base
    return emissivo(f)


o_chao = obj(1)
c.caixa((GX0, GX1, GY0, GY1, GZ, 0.0), {'cima': mat_chao(), '*': mat_solo()}, M, o_chao)
celulas([o_chao], lambda P, N: np.where(terreno(P) == 2, id_lajes()(P, None), -1), '#8f8878', luz=1.08, sombra=0.9)


# ================================================================ o casarão =========================================
def mat_reboco():
    """A parede caiada: o reboco em manchas grandes e suaves (2 tons) e a sujeira que sobe do chão."""
    base = hx(PAREDE)

    def f(L, n, P):
        a, b = coords(L, n)
        q = suave(a, P[:, 2], 0.9, 31) * 0.7 + suave(a, P[:, 2], 0.35, 32) * 0.3
        out = np.tile(base, (len(P), 1))
        out = np.where((q > 0.62)[:, None], base * 0.965, out)
        out = np.where((q < 0.3)[:, None], np.minimum(base * 1.025, 255), out)
        suja = P[:, 2] < 0.62 + 0.1 * suave(a, 0, 0.3, 33)
        out = np.where(suja[:, None], out * 0.93, out)
        return out
    return emissivo(f)


def mat_veneziana():
    """A folha da veneziana: as palhetas (1 px escuro a cada 3 na vertical) e o quadro em volta."""
    c0, ce, cc = hx(VENEZ), hx(VENEZ_E), hx('#5c7e54')
    per = 3 * PZ

    def f(L, n, P):
        g = ((P[:, 2] + 10) / per) % 1
        out = np.where((g < 1 / 3)[:, None], ce, np.where((g < 2 / 3)[:, None], c0, cc))
        return out
    return emissivo(f)


def mat_vidro(kind, a0, a1, z0, z1, eixo):
    """O vidro: escuro com o reflexo do céu em diagonal, ou aceso (a luz quente de dentro, a cortina nos lados)."""
    def f(L, n, P):
        lat = P[:, 0] if eixo == 'x' else P[:, 1]
        u = (lat - a0) / (a1 - a0)
        v = (P[:, 2] - z0) / (z1 - z0)
        if kind == 'escuro':
            out = np.tile(hx('#2c3c48'), (len(P), 1))
            out = np.where((v > 0.62)[:, None], hx('#344856'), out)
            d = v * 1.6 - u * 1.0
            out = np.where(((d > 0.55) & (d < 0.75))[:, None], hx('#5a7484'), out)
            out = np.where(((d > 0.9) & (d < 0.98))[:, None], hx('#4a6474'), out)
            return out
        quente = hx('#ffcf78') if kind == 'aceso' else hx('#ffb054')
        meio = hx('#f6a94e') if kind == 'aceso' else hx('#ec8434')
        borda = hx('#d9803a') if kind == 'aceso' else hx('#c25a26')
        r = np.maximum(np.abs(u - 0.5) * 2, np.abs(v - 0.45) * 1.6)
        out = np.where((r < 0.5)[:, None], quente, np.where((r < 0.82)[:, None], meio, borda))
        # a cortina franzida nos dois lados (creme, com as pregas)
        cort = (u < 0.2) | (u > 0.8)
        pr = ((lat / 0.064) % 1) < 0.5
        out = np.where((cort & pr)[:, None], hx('#f2dcae'), np.where(cort[:, None], hx('#e2c08a'), out))
        return out
    return emissivo(f)


def janela(face, a, z0, w, h, kind='escuro'):
    """A janela na face 'y' (frente, y = HY1) ou 'x' (o lado, x = HX1): venezianas abertas, moldura, peitoril e cruz."""
    a0, a1 = a - w / 2, a + w / 2
    if face == 'y':
        p0 = HY1

        def bx(l0, l1, e0, e1, z_0, z_1):
            return (l0, l1, p0 + e0, p0 + e1, z_0, z_1)
    else:
        p0 = HX1

        def bx(l0, l1, e0, e1, z_0, z_1):
            return (p0 + e0, p0 + e1, l0, l1, z_0, z_1)
    sw = w * 0.42
    # as duas folhas da veneziana, abertas contra a parede
    for (l0, l1) in ((a0 - 0.05 - sw, a0 - 0.06), (a1 + 0.06, a1 + 0.05 + sw)):
        o = caixa(bx(l0, l1, 0.0, 0.035, z0 - 0.02, z0 + h + 0.02), mat_veneziana())
    # o vidro (no plano da parede) e o batente em volta
    ov = obj(3)
    VIDROS[ov] = kind
    if kind != 'escuro':
        luzes.add(ov)
    c.caixa(bx(a0, a1, -0.02, 0.004, z0, z0 + h), mat_vidro(kind, a0, a1, z0, z0 + h, 'x' if face == 'y' else 'y'), M, ov)
    o = obj(3)
    m = liso(CAL)
    e = 0.06
    c.caixa(bx(a0 - e, a0, 0, 0.05, z0, z0 + h), m, M, o)
    c.caixa(bx(a1, a1 + e, 0, 0.05, z0, z0 + h), m, M, o)
    c.caixa(bx(a0 - e, a1 + e, 0, 0.05, z0 + h, z0 + h + 0.07), m, M, o)
    c.caixa(bx(a0 - e, a1 + e, 0, 0.05, z0 - 0.05, z0), m, M, o)
    # a verga (a cornija em cima) e o peitoril
    caixa(bx(a0 - 0.11, a1 + 0.11, 0, 0.08, z0 + h + 0.07, z0 + h + 0.13), liso(CAL))
    caixa(bx(a0 - 0.1, a1 + 0.1, 0, 0.1, z0 - 0.11, z0 - 0.05), liso(CAL))
    # a cruz da esquadria (fininha, sem contorno)
    oc = obj(3, contorno=False)
    am = (a0 + a1) / 2
    c.caixa(bx(am - 0.016, am + 0.016, 0, 0.02, z0, z0 + h), liso('#e4dccb'), M, oc)
    for zz in (z0 + h * 0.36, z0 + h * 0.68):
        c.caixa(bx(a0, a1, 0, 0.02, zz - 0.014, zz + 0.014), liso('#e4dccb'), M, oc)
    return ov


def porta_frente():
    a0, a1 = MEIO - 0.56, MEIO + 0.56
    z0, z1 = 0.42, 2.82
    y = HY1
    caixa((a0 - 0.08, a0, y, y + 0.06, z0, z1 + 0.1), liso(CAL))
    caixa((a1, a1 + 0.08, y, y + 0.06, z0, z1 + 0.1), liso(CAL))
    caixa((a0 - 0.14, a1 + 0.14, y, y + 0.1, z1 + 0.1, z1 + 0.2), liso(CAL))
    od = obj(3)
    cor = hx(MAD)

    def f(L, n, P):
        x, z = P[:, 0], P[:, 2]
        out = np.tile(cor, (len(P), 1))
        meio = np.abs(x - MEIO) < 0.016
        for (zb, zt) in ((z0 + 0.15, z0 + 1.0), (z0 + 1.15, z1 - 0.14)):
            for (l0, l1) in ((a0 + 0.1, MEIO - 0.1), (MEIO + 0.1, a1 - 0.1)):
                dentro = (x > l0) & (x < l1) & (z > zb) & (z < zt)
                out = np.where(dentro[:, None], cor * 0.9, out)
                # a almofada: a luz em cima e à esquerda, a sombra embaixo e à direita (1 px)
                out = np.where((dentro & (z > zt - PZ))[:, None], cor * 0.72, out)
                out = np.where((dentro & (x < l0 + 0.032))[:, None], cor * 0.72, out)
                out = np.where((dentro & (z < zb + PZ * 1.2))[:, None], cor * 1.22, out)
                out = np.where((dentro & (x > l1 - 0.032))[:, None], cor * 1.15, out)
        out = np.where(meio[:, None], hx('#2a1a10'), out)
        return out
    c.caixa((a0, a1, y - 0.03, y + 0.02, z0, z1), emissivo(f), M, od)
    # as maçanetas
    caixa((MEIO + 0.05, MEIO + 0.09, y + 0.02, y + 0.06, z0 + 1.02, z0 + 1.08), liso('#d8b060'), contorno=False)
    caixa((MEIO - 0.09, MEIO - 0.05, y + 0.02, y + 0.06, z0 + 1.02, z0 + 1.08), liso('#d8b060'), contorno=False)


# ---------- o corpo
o_corpo = obj(3)
REB = mat_reboco()
c.caixa((HX0, HX1, HY0, HY1, 0, ZE), REB, M, o_corpo)
# o rodapé de pedra
o_rod = caixa((HX0 - 0.03, HX1 + 0.03, HY0 - 0.03, HY1 + 0.03, 0, 0.5), mat_cel(PEDRA, id_pedras(0.125, seed=2), 5))
celulas([o_rod], id_pedras(0.125, seed=2), PEDRA_J)
caixa((HX0 - 0.05, HX1 + 0.05, HY0 - 0.05, HY1 + 0.05, 0.5, 0.56), liso('#b8b0a2'))
# os cunhais brancos nas quinas e a faixa entre os andares; a cimalha embaixo do beiral
for (x0_, x1_, y0_, y1_) in ((HX1 - 0.22, HX1 + 0.025, HY1 - 0.0, HY1 + 0.025), (HX0 - 0.025, HX0 + 0.22, HY1, HY1 + 0.025),
                              (HX1, HX1 + 0.025, HY0 - 0.025, HY0 + 0.22)):
    caixa((x0_, x1_, y0_, y1_, 0.56, ZE - 0.1), liso(CAL))
caixa((HX0 - 0.04, HX1 + 0.04, HY0 - 0.04, HY1 + 0.04, 3.0, 3.15), liso(CAL))
caixa((HX0 - 0.07, HX1 + 0.07, HY0 - 0.07, HY1 + 0.07, ZE - 0.22, ZE - 0.1), liso(CAL))
caixa((HX0 - 0.11, HX1 + 0.11, HY0 - 0.11, HY1 + 0.11, ZE - 0.1, ZE), liso('#e2dac9'))

# ---------- as janelas (5 vãos na frente, o do meio é a porta; 2 por andar no lado)
VAOS = [HX0 + (i + 0.5) * (HX1 - HX0) / 5 for i in range(5)]
ACESAS_FRENTE = {(0, 0): 'escuro', (1, 0): 'aceso', (3, 0): 'aceso', (4, 0): 'escuro',
                 (0, 1): 'escuro', (1, 1): 'escuro', (2, 1): 'aceso', (3, 1): 'escuro', (4, 1): 'aceso'}
for i, a in enumerate(VAOS):
    for k, z0 in enumerate((1.1, 3.9)):
        if i == 2 and k == 0:
            continue
        janela('y', a, z0, 0.9 * C, 1.4, ACESAS_FRENTE[(i, k)])
LADO_Y = [HY0 + (HY1 - HY0) * t for t in (0.3, 0.7)]
O_COZINHA = janela('x', LADO_Y[0], 1.1, 0.8 * C, 1.4, 'fogo')    # a cozinha, com o fogão a lenha
janela('x', LADO_Y[1], 1.1, 0.8 * C, 1.4, 'escuro')
janela('x', LADO_Y[0], 3.9, 0.8 * C, 1.4, 'escuro')
janela('x', LADO_Y[1], 3.9, 0.8 * C, 1.4, 'aceso')
porta_frente()

# ---------- o telhado: as telhas capa e canal em fiadas
TL_FIADA = 0.3        # o comprimento de cada fiada ao longo da água (m)
TL_COL = 0.2          # a largura de cada telha


def id_telha(P, N):
    """A fiada (ao longo da água, contada do beiral) e a coluna (ao longo de x)."""
    n = N if N.ndim == 2 else np.tile(N, (len(P), 1))
    # a distância ao longo da água desde o beiral (a de trás tem o sentido contrário; só a da frente aparece)
    s = np.where(n[:, 1] >= 0, (YFRT - P[:, 1]), (P[:, 1] - YBKT)) * math.sqrt(1 + KT * KT)
    fila = np.floor(s / TL_FIADA)
    col = np.floor((P[:, 0] + 50) / TL_COL)
    return (fila * 4096 + col).astype(np.int64)


YFRT, YBKT = HY1 + BEIRAL, HY0 - BEIRAL


def mat_telha(base=TELHA):
    cs = np.stack([hx(x) for x in base])

    def f(L, n, P):
        ids = id_telha(P, np.tile(n, (len(P), 1)))
        col = ids % 4096
        k = (ruido(ids * 0.37, 7.7) * len(cs)).astype(int) % len(cs)
        out = cs[k]
        g = ((P[:, 0] + 50) / TL_COL) % 1
        capa = (col % 2) == 0
        # a capa (redonda, por cima): o lado esquerdo aceso, o direito na sombra; o canal (por baixo) mais escuro
        out = np.where((capa & (g < 0.3))[:, None], out * 1.14 + 4, out)
        out = np.where((capa & (g > 0.8))[:, None], out * 0.82, out)
        out = np.where((~capa)[:, None], out * 0.8, out)
        out = np.where((~capa & (g > 0.4) & (g < 0.62))[:, None], out * 0.9, out)
        return out
    return emissivo(f)


SX0, SX1 = HX0 - 0.25, HX1 + 0.25
ESP_T = 0.1
o_tel = obj(3)
frente = [(SX0, YFRT, ZB), (SX1, YFRT, ZB), (SX1, YR, ZR), (SX0, YR, ZR)]
nf = np.array([0, 1.0, 1 / KT]); nf /= np.linalg.norm(nf)
c.face_plana(frente, tuple(nf), mat_telha(), M, o_tel)
tras = [(SX1, YBKT, ZB), (SX0, YBKT, ZB), (SX0, YR, ZR), (SX1, YR, ZR)]
c.face_plana(tras, (0, -nf[1], nf[2]), mat_telha(), M, o_tel)
celulas([o_tel], id_telha, TELHA_J, luz=1.16, sombra=0.72, lado=1.0, so_baixo=True)
# a espessura do telhado (a testeira na frente e a ponta das águas no lado), com a boca das telhas
o_test = obj(3)


def mat_testeira(L, n, P):
    out = np.tile(hx('#e6decd'), (len(P), 1))
    g = ((P[:, 0] + 50) / TL_COL) % 1
    capa = (np.floor((P[:, 0] + 50) / TL_COL) % 2) == 0
    boca = capa & (g > 0.15) & (g < 0.85) & (P[:, 2] > ZB - 0.035)
    out = np.where(boca[:, None], hx('#6a2a18'), out)
    out = np.where((P[:, 2] > ZB - 0.012)[:, None] & ~boca[:, None], hx(TELHA[0]), out)
    return out


c.face_plana([(SX0, YFRT, ZB - ESP_T), (SX1, YFRT, ZB - ESP_T), (SX1, YFRT, ZB), (SX0, YFRT, ZB)], (0, 1, 0), emissivo(mat_testeira), M, o_test)
# a ponta das águas no lado direito (a tábua do oitão) e o oitão (o triângulo de parede)
c.face_plana([(SX1, YFRT, ZB - ESP_T), (SX1, YR, ZR - ESP_T), (SX1, YR, ZR), (SX1, YFRT, ZB)], (1, 0, 0), liso('#e6decd'), M, o_test)
c.face_plana([(SX1, YR, ZR - ESP_T), (SX1, YBKT, ZB - ESP_T), (SX1, YBKT, ZB), (SX1, YR, ZR)], (1, 0, 0), liso('#e6decd'), M, o_test)
o_oit = obj(3)
c.face_plana([(HX1, HY0, ZE), (HX1, HY1, ZE), (HX1, YR, ZR - ESP_T)], (1, 0, 0), REB, M, o_oit)
# o óculo do oitão (a janelinha redonda do sótão)
o_oc = obj(3)
zo = ZE + 1.0
pts = [(HX1 + 0.03, YR + 0.26 * math.cos(a_), zo + 0.26 * math.sin(a_)) for a_ in np.linspace(0, 2 * math.pi, 20, endpoint=False)]
c.face_plana(pts, (1, 0, 0), liso(CAL), M, o_oc)
o_oc2 = obj(3, contorno=False)
VIDROS[o_oc2] = 'escuro'
pts = [(HX1 + 0.035, YR + 0.17 * math.cos(a_), zo + 0.17 * math.sin(a_)) for a_ in np.linspace(0, 2 * math.pi, 18, endpoint=False)]
c.face_plana(pts, (1, 0, 0), liso('#2c3c48'), M, o_oc2)
# a cumeeira: as telhas de cumeeira (em gomos)
o_cum = obj(3)
for x in np.arange(SX0, SX1 - 0.01, 0.34):
    x1 = min(x + 0.36, SX1)
    c.face_plana([(x, YR + 0.12, ZR - 0.06), (x1, YR + 0.12, ZR - 0.06), (x1, YR, ZR + 0.09), (x, YR, ZR + 0.09)],
                 (0, 0.7, 0.7), mat_cel(['#9c4428', '#a64c2c'], lambda P, N: np.floor((P[:, 0] + 50) / 0.34).astype(np.int64)), M, o_cum)
    c.face_plana([(x1, YR + 0.12, ZR - 0.06), (x1, YR - 0.12, ZR - 0.06), (x1, YR, ZR + 0.09)], (1, 0, 0), liso('#8a3a22'), M, o_cum)

# ---------- a chaminé de pedra (o fogão a lenha da cozinha)
CX0, CX1, CY0, CY1 = CHAM
ZCH = 8.9
o_ch = caixa((CX0, CX1, CY0, CY1, 6.2, ZCH), mat_cel(PEDRA, id_pedras(0.11, (0.14, 0.26), seed=9), 3))
celulas([o_ch], id_pedras(0.11, (0.14, 0.26), seed=9), PEDRA_J)
o_chc = caixa((CX0 - 0.05, CX1 + 0.05, CY0 - 0.05, CY1 + 0.05, ZCH - 0.12, ZCH + 0.06), {'cima': liso('#8e887e'), '*': liso('#b8b2a6')})
o_boca = caixa((CX0 + 0.08, CX1 - 0.08, CY0 + 0.08, CY1 - 0.08, ZCH + 0.06, ZCH + 0.061), liso('#1e1714'), contorno=False)
TOPO_CHAMINE = np.array([(CX0 + CX1) / 2, (CY0 + CY1) / 2, ZCH + 0.08])

# ---------- a varanda: o deck, os degraus, os pilares, o guarda-corpo e o telhado de uma água
def id_tabua(P, N):
    return (np.floor((P[:, 1] - HY1) / 0.14) * 100 + np.floor((P[:, 0] + ruido(np.floor((P[:, 1] - HY1) / 0.14), 3.0) * 2.0) / 2.1)).astype(np.int64)


o_deck = obj(3)
c.caixa(DECK, {'cima': mat_cel(DECK_C, id_tabua, 4), '*': liso('#6a4a30')}, M, o_deck)
celulas([o_deck], lambda P, N: np.where(P[:, 2] > 0.41, id_tabua(P, N), -1), '#5a3a22')
# o rodapé do deck: as ripas verticais (treliça escura)
o_rip = obj(3, contorno=False)


def mat_ripas(L, n, P):
    lat = P[:, 0] if abs(n[1]) > 0.5 else P[:, 1]
    g = (lat / 0.096) % 1
    out = np.where((g < 0.34)[:, None], hx('#3a2618'), hx('#7a5636'))
    out = np.where((P[:, 2] > 0.33)[:, None], hx('#8a6440'), out)
    return out


c.caixa((DECK[0] + 0.02, DECK[1] - 0.02, DECK[3] - 0.04, DECK[3] + 0.001, 0, 0.4), emissivo(mat_ripas), M, o_rip)
c.caixa((DECK[1] - 0.04, DECK[1] + 0.001, DECK[2], DECK[3] - 0.04, 0, 0.4), emissivo(mat_ripas), M, o_rip)
# os degraus de pedra
for k, (y0_, y1_, z1_) in enumerate(((YFR, YFR + 0.56, 0.14), (YFR, YFR + 0.3, 0.28))):
    o = caixa((MEIO - 0.68, MEIO + 0.68, y0_, y1_, 0, z1_), mat_cel(['#c6bfb0', '#bcb5a6'], lambda P, N: np.floor((P[:, 0] + 50) / 0.45).astype(np.int64), 2))
    celulas([o], lambda P, N: np.floor((P[:, 0] + 50) / 0.45).astype(np.int64), '#8a8374')
    pegadas.append((MEIO - 0.68, MEIO + 0.68, y0_, y1_, 0.5))
# os pilares (brancos, com a base e o capitel) e o guarda-corpo com os balaústres
ZTV = 3.0
for x in PILARES:
    caixa((x - 0.075, x + 0.075, YPIL - 0.075, YPIL + 0.075, 0.42, ZTV), liso(CAL))
    caixa((x - 0.1, x + 0.1, YPIL - 0.1, YPIL + 0.1, 0.42, 0.56), liso('#e2dac9'))
    caixa((x - 0.1, x + 0.1, YPIL - 0.1, YPIL + 0.1, ZTV - 0.14, ZTV - 0.06), liso('#e2dac9'))
o_bal = obj(3, contorno=False)
VAOS_GC = [(PILARES[i], PILARES[i + 1]) for i in range(5) if i != 2]
for (xa, xb) in VAOS_GC:
    caixa((xa + 0.075, xb - 0.075, YPIL - 0.05, YPIL + 0.05, 1.2, 1.28), liso(CAL))
    caixa((xa + 0.075, xb - 0.075, YPIL - 0.035, YPIL + 0.035, 0.5, 0.56), liso('#e2dac9'))
    for x in np.arange(xa + 0.075 + 0.11, xb - 0.075 - 0.04, 0.125):
        c.caixa((x, x + 0.045, YPIL - 0.022, YPIL + 0.022, 0.56, 1.2), liso('#e8e0d0'), M, o_bal)
# o guarda-corpo do lado direito (de frente para +x)
xs_ = DECK[1] - 0.12
caixa((xs_ - 0.05, xs_ + 0.05, HY1 + 0.02, YPIL - 0.075, 1.2, 1.28), liso(CAL))
caixa((xs_ - 0.035, xs_ + 0.035, HY1 + 0.02, YPIL - 0.075, 0.5, 0.56), liso('#e2dac9'))
for y in np.arange(HY1 + 0.12, YPIL - 0.1, 0.125):
    c.caixa((xs_ - 0.022, xs_ + 0.022, y, y + 0.045, 0.56, 1.2), liso('#e8e0d0'), M, o_bal)
# a viga em cima dos pilares e o telhado da varanda (uma água: 2,95 na frente, 3,5 na parede)
caixa((DECK[0] - 0.05, DECK[1] + 0.05, YPIL - 0.08, YPIL + 0.08, ZTV - 0.06, ZTV + 0.12), liso('#e2dac9'))
ZV0, ZV1 = 3.08, 3.6
YV = YFR + 0.1
o_tv = obj(3)
kv = (ZV1 - ZV0) / (YV - HY1)
nv = np.array([0, kv, 1.0]); nv /= np.linalg.norm(nv)


def id_telha_v(P, N):
    s = (YV - P[:, 1]) * math.sqrt(1 + kv * kv)
    return (np.floor(s / TL_FIADA) * 4096 + np.floor((P[:, 0] + 50) / TL_COL)).astype(np.int64)


def mat_telha_v():
    cs = np.stack([hx(x) for x in TELHA])

    def f(L, n, P):
        ids = id_telha_v(P, None)
        col = ids % 4096
        out = cs[(ruido(ids * 0.37, 3.1) * len(cs)).astype(int) % len(cs)]
        g = ((P[:, 0] + 50) / TL_COL) % 1
        capa = (col % 2) == 0
        out = np.where((capa & (g < 0.3))[:, None], out * 1.14 + 4, out)
        out = np.where((capa & (g > 0.8))[:, None], out * 0.82, out)
        out = np.where((~capa)[:, None], out * 0.8, out)
        return out
    return emissivo(f)


VX0, VX1 = DECK[0] - 0.12, DECK[1] + 0.12
c.face_plana([(VX0, YV, ZV0), (VX1, YV, ZV0), (VX1, HY1, ZV1), (VX0, HY1, ZV1)], tuple(nv), mat_telha_v(), M, o_tv)
celulas([o_tv], id_telha_v, TELHA_J, luz=1.16, sombra=0.72, lado=1.0, so_baixo=True)
o_tvt = obj(3)
c.face_plana([(VX0, YV, ZV0 - 0.09), (VX1, YV, ZV0 - 0.09), (VX1, YV, ZV0), (VX0, YV, ZV0)], (0, 1, 0), emissivo(mat_testeira_v := (lambda L, n, P: mat_testeira(L, n, P + np.array([0, 0, ZB - ZV0])))), M, o_tvt)
c.face_plana([(VX1, YV, ZV0 - 0.09), (VX1, HY1, ZV1 - 0.09), (VX1, HY1, ZV1), (VX1, YV, ZV0)], (1, 0, 0), liso('#e6decd'), M, o_tvt)

# ---------- as coisas da varanda: o banco, os vasos, o lampião, o capacho
def banco(x0, x1, y0):
    m = liso('#7a5232')
    caixa((x0, x1, y0, y0 + 0.4, 0.84, 0.9), {'cima': mat_cel(['#8e6038', '#86593a'], lambda P, N: np.floor((P[:, 1]) / 0.1).astype(np.int64)), '*': m})
    for xx in (x0 + 0.05, x1 - 0.1):
        caixa((xx, xx + 0.05, y0 + 0.04, y0 + 0.36, 0.42, 0.84), liso('#5e3e26'))
    caixa((x0, x1, y0, y0 + 0.05, 0.9, 1.32), {'*': mat_cel(['#8e6038', '#86593a'], lambda P, N: np.floor(P[:, 2] / 0.1).astype(np.int64)), 'cima': m})
    caixa((x0 - 0.04, x0 + 0.02, y0, y0 + 0.38, 0.9, 1.08), m)
    caixa((x1 - 0.02, x1 + 0.04, y0, y0 + 0.38, 0.9, 1.08), m)
    pegadas.append((x0, x1, y0, y0 + 0.4, 0.6))


def vaso(x, y, z, r=0.16, h=0.32, flores=None):
    o = obj(3)
    c.cilindro(x, y, r * 0.78, z, z + h, liso('#b0603a'), M, o, lados=16, r1=r, tampa=False)
    c.cilindro(x, y, r * 1.05, z + h - 0.06, z + h, liso('#c0704a'), M, o, lados=16, tampa_mat=liso('#3e2a1c'))
    ob = obj(3)
    FOLHAS.append(ob)
    # a planta: uma bola de folhas com as flores
    c.elipsoide((x, y, z + h + r * 0.9), (r * 1.25, r * 1.25, r * 1.1), mat_folhas('#4e7a38'), ob)
    if flores:
        FLORES_EM.append((ob, flores))
    pegadas.append((x - r, x + r, y - r, y + r, 0.6))


FOLHAS = []         # os objetos de folhas (a textura de folha é feita no pixel)
FLORES_EM = []      # (objeto, cor das flores)


def mat_folhas(cor):
    base = hx(cor)

    def f(Pc, N, P):
        return np.tile(base, (len(P), 1))
    f.folha = True
    return f


def lampiao(x, z):
    y = HY1
    caixa((x - 0.025, x + 0.025, y, y + 0.22, z + 0.36, z + 0.39), liso('#2a2220'))
    o = caixa((x - 0.09, x + 0.09, y + 0.12, y + 0.3, z + 0.3, z + 0.35), liso('#2a2220'))
    ov = obj(3, contorno=True)
    luzes.add(ov)
    c.caixa((x - 0.07, x + 0.07, y + 0.14, y + 0.28, z + 0.06, z + 0.3), {'*': liso('#ffd889'), 'cima': liso('#2a2220')}, M, ov)
    o2 = obj(3, contorno=False)
    for xx in (x - 0.075, x + 0.055):
        c.caixa((xx, xx + 0.02, y + 0.13, y + 0.29, z + 0.06, z + 0.3), liso('#2a2220'), M, o2)
    caixa((x - 0.09, x + 0.09, y + 0.12, y + 0.3, z, z + 0.06), liso('#2a2220'))
    return ov, np.array([x, y + 0.35, z + 0.18])


banco(VAOS[0] - 0.62, VAOS[0] + 0.62, HY1 + 0.04)
vaso(MEIO - 0.95, YFR - 0.32, 0.42, flores='#e86a86')
vaso(MEIO + 0.95, YFR - 0.32, 0.42, flores='#f4e6a0')
vaso(VAOS[3] + 0.55, HY1 + 0.25, 0.42, r=0.13, h=0.26)
O_LAMP, P_LAMP = lampiao(MEIO + 0.82, 1.9)
O_LAMP2, P_LAMP2 = lampiao(MEIO - 0.82, 1.9)
o_cap = caixa((MEIO - 0.45, MEIO + 0.45, HY1 + 0.15, HY1 + 0.6, 0.42, 0.435), liso('#8a5a3a'), contorno=False)

# ---------- a lenha empilhada no lado da cozinha (as pontas das toras para +x)
LX0, LX1, LY0, LY1 = HX1 + 0.08, HX1 + 0.5, HY0 + 0.25, LADO_Y[0] - 0.55
o_len = obj(3)


def mat_lenha(L, n, P):
    if abs(n[0]) < 0.5:
        return np.tile(hx('#6a4628'), (len(P), 1))
    r = 0.085
    y, z = P[:, 1], P[:, 2]
    fila = np.floor(z / (r * 1.75))
    off = (fila % 2) * r
    cy = np.floor((y - LY0 + off) / (2 * r)) * 2 * r + r - off + LY0
    cz = fila * r * 1.75 + r * 0.95
    d = np.hypot(y - cy, (z - cz) * 1.0) / r
    kk = ruido(np.floor((y - LY0 + off) / (2 * r)), fila, 4.0)
    cort = np.where((kk > 0.5)[:, None], hx('#d9b07a'), hx('#c99c66'))
    out = np.where((d < 0.82)[:, None], cort, np.where((d < 1.0)[:, None], hx('#5a3a22'), hx('#2a1a10')))
    out = np.where(((d < 0.38) & (d > 0.2))[:, None], cort * 0.88, out)
    return out


c.caixa((LX0, LX1, LY0, LY1, 0, 1.0), emissivo(mat_lenha), M, o_len)
caixa((LX0 - 0.04, LX1 + 0.12, LY0 - 0.08, LY1 + 0.08, 1.0, 1.06), liso('#6a4a30'))
pegadas.append((LX0, LX1, LY0, LY1, 0.7))
# o toco de rachar lenha com o machado
o_toco = obj(3)
c.cilindro(HX1 + 0.95, LY1 + 0.1, 0.2, 0, 0.42, liso('#7a5232'), M, o_toco, lados=16, tampa_mat=liso('#c9a06a'))
caixa((HX1 + 0.9, HX1 + 0.94, LY1 + 0.05, LY1 + 0.36, 0.42, 0.46), liso('#9a9aa0'))
caixa((HX1 + 0.92, HX1 + 0.96, LY1 + 0.3, LY1 + 0.34, 0.42, 0.95), liso('#8a6040'))
pegadas.append((HX1 + 0.75, HX1 + 1.15, LY1 - 0.1, LY1 + 0.3, 0.6))

# ================================================================ o jardim ==========================================
def arbusto(cx, cy, r=0.42, h=0.75, cor='#46703a', flores=None):
    o = obj(3)
    c.elipsoide((cx, cy, h * 0.55), (r, r, h * 0.58), mat_folhas(cor), o, corte_z=0.0)
    FOLHAS.append(o)
    if flores:
        FLORES_EM.append((o, flores))
    pegadas.append((cx - r * 0.8, cx + r * 0.8, cy - r * 0.8, cy + r * 0.8, 0.7))


for (bx_, by_, fl) in ((14, 18, '#7aa0e0'), (16, 18, None), (23, 18, '#e88aa8'), (25, 18, None), (17, 21, None), (23, 21, '#f2f0e0')):
    arbusto((bx_ + 0.5) * C, (by_ + 0.5) * C, flores=fl)


def arvore(cx, cy, H=5.4, R=1.45):
    o = obj(3)
    c.cilindro(cx, cy, 0.17, 0, H * 0.55, liso('#5e4028'), M, o, lados=12, r1=0.12, tampa=False)
    # dois galhos
    caixa((cx - 0.05, cx + 0.05, cy - 0.05, cy + 0.05, H * 0.4, H * 0.62), liso('#5e4028'), o=o)
    ob = obj(3)
    FOLHAS.append(ob)
    rng = np.random.default_rng(4)
    zc = H * 0.66
    copa = [((0, 0, 0.25), (R * 0.95, R * 0.95, R * 0.78))]
    for i in range(9):
        a_ = i / 9 * 2 * math.pi + rng.random() * 0.4
        d = R * (0.5 + 0.2 * rng.random())
        copa.append(((d * math.cos(a_), d * math.sin(a_), (rng.random() - 0.4) * R * 0.6), (R * 0.55, R * 0.55, R * 0.48)))
    copa.append(((0.1, 0.1, R * 0.7), (R * 0.6, R * 0.6, R * 0.5)))
    for (dc, rr) in copa:
        c.elipsoide((cx + dc[0], cy + dc[1], zc + dc[2]), rr, mat_folhas('#4a7434'), ob)
    pegadas.append((cx - 0.3, cx + 0.3, cy - 0.3, cy + 0.3, 0.8))


arvore(12.5 * C, 22.2 * C)


# a cerca de madeira do lado direito (a do quintal), com o portãozinho aberto
def cerca(x, y0, y1):
    m = liso('#8a6644')
    for y in np.arange(y0, y1 + 0.01, 1.2):
        caixa((x - 0.06, x + 0.06, y - 0.06, y + 0.06, 0, 1.05), {'*': m, 'cima': liso('#a07a52')})
    for z in (0.42, 0.82):
        caixa((x - 0.03, x + 0.03, y0, y1, z, z + 0.1), {'*': liso('#9a7450'), 'cima': liso('#ae8a62')})


cerca(28.6 * C, 9.4 * C, 21.4 * C)


# ================================================================ o acabamento ======================================
SOL = np.array([0.5, -0.32, -0.8])
SOL /= np.linalg.norm(SOL)


def base_render():
    """O que não muda com o tempo: a cor depois das luzes de face, da sombra do sol, das juntas e do contorno."""
    cor = c.cor.copy()
    P, nrm, ob, tipo, face, prof = c.mundoP, c.nrm, c.obj, c.tipo, c.face, c.prof
    h, w = ob.shape
    nz, nx, ny = nrm[..., 2], nrm[..., 0], nrm[..., 1]
    # ----- as juntas de 1 px (pedra, telha, tábua, laje)
    for oids, fn, jc, kl, ks, kla, so_baixo in CELULAS:
        m = np.isin(ob, oids)
        if not m.any():
            continue
        ids = np.full((h, w), -1, np.int64)
        ids[m] = fn(P[m], nrm[m])
        ids[ids < 0] = -1
        m = ids >= 0
        mesma = lambda dy, dx: (viz(face, dy, dx, -9) == face) & viz(m, dy, dx, False)
        db, dr = viz(ids, 1, 0, -1), viz(ids, 0, 1, -1)
        jb = m & mesma(1, 0) & (db != ids)
        jr = m & mesma(0, 1) & (dr != ids) & (not so_baixo)
        junta = jb | jr
        # a luz logo abaixo da junta (o alto da pedra) e à direita dela; a sombra logo acima (o pé da pedra)
        ac = m & ~junta & viz(junta, -1, 0, False)
        al = m & ~junta & viz(junta, 0, -1, False)
        so = m & ~junta & viz(junta, 1, 0, False)
        cor = np.where(al[..., None], cor * kla, cor)
        cor = np.where(ac[..., None], np.minimum(cor * kl + 4, 255), cor)
        cor = np.where(so[..., None], cor * ks, cor)
        cor = np.where(junta[..., None], jc, cor)
    # ----- as folhas (arbustos, árvore, vasos): tufos em Voronoi na tela, a borda de baixo de cada tufo escura
    fol = np.isin(ob, FOLHAS + [o for o, _ in FLORES_EM])
    if fol.any():
        ys, xs = np.nonzero(fol)
        Pf = P[ys, xs]
        q = 0.11
        gx, gy, gz = Pf[:, 0] / q, Pf[:, 1] / q, Pf[:, 2] / q
        best = np.full(len(Pf), 1e9)
        bid = np.zeros(len(Pf), np.int64)
        ix, iy, iz = np.floor(gx), np.floor(gy), np.floor(gz)
        for dx in (-1, 0, 1):
            for dy in (-1, 0, 1):
                for dz in (-1, 0, 1):
                    cx_, cy_, cz_ = ix + dx, iy + dy, iz + dz
                    px = cx_ + ruido(cx_, cy_, cz_)
                    py = cy_ + ruido(cy_, cz_, cx_ + 3)
                    pz = cz_ + ruido(cz_, cx_, cy_ + 7)
                    d = (gx - px) ** 2 + (gy - py) ** 2 + (gz - pz) ** 2
                    mm = d < best
                    best = np.where(mm, d, best)
                    bid = np.where(mm, (cx_ * 73856093 + cy_ * 19349663 + cz_ * 83492791).astype(np.int64), bid)
        ids = np.full((h, w), -1, np.int64)
        ids[ys, xs] = bid
        db = viz(ids, 1, 0, -1)
        dr = viz(ids, 0, 1, -1)
        du = viz(ids, -1, 0, -1)
        borda_b = fol & (db != ids) & (db >= 0)
        borda_t = fol & (du != ids) & (du >= 0) & ~borda_b
        k = (ruido(ids * 0.001, 5.5) > 0.5)
        cor = np.where((fol & k)[..., None], cor * 1.06, cor)
        cor = np.where(borda_t[..., None], cor * 1.2 + 6, cor)
        cor = np.where(borda_b[..., None], cor * 0.68, cor)
        c._folha_ids = ids
    # ----- a luz de cada face (topo 1,0; +y 0,84; +x 0,66) e o tom quente do sol baixo
    topo = nz > 0.6
    esq = ~topo & (ny >= nx)
    f = np.where(topo, 1.0, np.where(esq, 0.86, 0.66))
    # as folhas: a luz pela normal (bola), em 3 degraus
    if fol.any():
        Ld = -SOL
        dd = np.clip((nrm * Ld).sum(-1), 0, 1)
        ff = np.where(dd > 0.75, 1.08, np.where(dd > 0.45, 0.92, np.where(dd > 0.15, 0.78, 0.66)))
        f = np.where(fol, ff, f)
    luz_m = np.isin(ob, list(luzes))
    quente = np.array([14.0, 4.0, -12.0])
    cor = np.where(luz_m[..., None], cor, cor * f[..., None] + (1 - f[..., None]) * quente)
    # ----- a sombra do sol (macia, em 3 degraus) e o tom frio da sombra
    aceso = c.sombra_direcional(SOL, res=0.02, vies=0.02, raio=1)
    aceso = np.round(aceso * 2) / 2
    costas = (nrm @ SOL) > -0.02
    k = (1 - aceso) * 0.36
    k = np.where(costas | luz_m, 0, k)
    sombra_c = np.array([40.0, 46.0, 78.0])
    cor = cor * (1 - k[..., None]) + sombra_c * k[..., None] * 0.6
    # no sol, um quentinho (fim de tarde)
    sol_m = (aceso > 0.9) & ~costas & ~luz_m & (ob >= 0)
    cor = np.where(sol_m[..., None], cor * np.array([1.04, 1.0, 0.94]) + np.array([6.0, 3.0, 0.0]), cor)
    # ----- a sombra de contato no chão (o pé da casa, as plantas, o banco)
    chao = (tipo == 1) & topo
    X, Y, Z = P[..., 0], P[..., 1], P[..., 2]
    dpe = np.maximum(np.maximum(HX0 - X, X - HX1), np.maximum(HY0 - Y, Y - DECK[3]))
    cor = np.where((chao & (dpe < 0.12))[..., None], cor * 0.8, np.where((chao & (dpe < 0.3))[..., None], cor * 0.9, cor))
    dentro = np.zeros((h, w), bool)
    volta = np.zeros((h, w), bool)
    for (a0, a1, b0, b1, fo) in pegadas:
        sup = (np.abs(Z - 0.0) < 0.02) | (np.abs(Z - 0.42) < 0.02)
        dentro |= sup & topo & (X > a0 + 0.02) & (X < a1 + 0.06) & (Y > b0 + 0.02) & (Y < b1 + 0.08)
        volta |= sup & topo & (X > a0 - 0.05) & (X < a1 + 0.14) & (Y > b0 - 0.05) & (Y < b1 + 0.16)
    cor = np.where(dentro[..., None], cor * 0.74, np.where(volta[..., None], cor * 0.88, cor))
    c._aceso = aceso
    # ----- o brilho da quina de cima, as quinas por dentro e o contorno
    emb_obj, emb_nz = viz(ob, 1, 0, -1), viz(nz, 1, 0, 0.0)
    brilho = topo & (ob >= 0) & (emb_obj == ob) & (emb_nz < 0.5) & ~luz_m & (tipo != 1) & ~fol
    cor = np.where(brilho[..., None], np.minimum(255, cor * 1.12 + 8), cor)
    borda = np.zeros((h, w), bool)
    for dy, dx in ((0, 1), (1, 0), (0, -1), (-1, 0)):
        On, Pn = viz(ob, dy, dx, -1), viz(prof, dy, dx, -1e9)
        borda |= (ob >= 0) & (On != ob) & ((Pn < prof - 0.04) | (On < 0))
    for oid, cc in c.contornos.items():
        if not cc:
            borda &= ob != oid
    quina = np.zeros((h, w), bool)
    for dy, dx in ((0, 1), (1, 0)):
        On, Fn, Nn = viz(ob, dy, dx, -1), viz(face, dy, dx, -1), viz(nrm, dy, dx, 0.0)
        quina |= (ob >= 0) & (On == ob) & (Fn != face) & ((Nn * nrm).sum(-1) < 0.5)
    quina &= (tipo == 3) & ~borda & ~luz_m & ~brilho & ~fol
    cor = np.where(quina[..., None], cor * 0.8, cor)
    cor = np.where(borda[..., None], cor * 0.3 + np.array([26.0, 14.0, 12.0]), cor)
    return cor


FUNDO = np.array([216.0, 214.0, 206.0])


def luz_quente(cor, P0, raio, forca, cor_l=(255, 200, 120), so=None, degraus=4):
    """Uma luz quente (janela acesa, lampião): clareia em volta em anéis (sem dither)."""
    P = c.mundoP
    d = np.linalg.norm(P - np.asarray(P0), axis=-1)
    s = np.clip(1 - d / raio, 0, 1) ** 1.3 * forca
    s = np.floor(s * degraus) / degraus
    s = np.where(c.obj >= 0, s, 0)
    if so is not None:
        s = np.where(so, s, 0)
    s = np.where(np.isin(c.obj, list(luzes)), 0, s)
    cl = np.array(cor_l, float)
    return cor + (cl - cor * 0.4) * s[..., None] * 0.42


def fumaca_loop(sx, sy, bx, by, t, n=6, vida=2, altura=70, raio=(2.0, 7.0), onda=2.4, vento=10.0, seed=0.0):
    """
    A fumaça em loop perfeito: n bolinhas por volta, cada uma leva `vida` voltas para subir `altura` px; a i e a i+n
    fazem o mesmo caminho (t e t + 1 dão o mesmo quadro). Devolve o alfa em degraus e o lado aceso (em cima à esquerda).
    """
    alfa = np.zeros(np.shape(sx))
    lit = np.zeros(np.shape(sx))
    for j in range(n * vida):
        i = j % n
        q = ((t + j / n) / vida) % 1
        jx = (ruido(i, 6.0 + seed) - 0.5) * 3
        fase = ruido(i, 7.0 + seed)
        cx = bx + jx + onda * math.sin(2 * math.pi * (q * 1.3 + fase)) * (0.3 + q) + vento * q ** 1.4
        cy = by - q * altura
        rad = raio[0] + (raio[1] - raio[0]) * q ** 0.8
        dens = (1 - q) ** 0.9 * min(1.0, q * 7)
        d = np.hypot((sx - cx) / rad, (sy - cy) / (rad * 0.92))
        a = np.where(d < 1, dens, 0)
        dl = np.hypot((sx - cx + rad * 0.3) / rad, (sy - cy + rad * 0.32) / (rad * 0.92))
        lit = np.maximum(lit, np.where((d < 1) & (dl < 0.62), dens, 0))
        alfa = np.maximum(alfa, a)
    a = np.where(alfa > 0.6, 0.62, np.where(alfa > 0.32, 0.44, np.where(alfa > 0.1, 0.26, 0.0)))
    return a, lit > 0.25


def tufos(cor, t=0.0):
    """Os tufos de capim e as florzinhas na grama (no pixel, depois do contorno). t balança a ponta de uns tufos."""
    P, ob = c.mundoP, c.obj
    h, w = ob.shape
    chao = (ob == o_chao) & (c.nrm[..., 2] > 0.6)
    tipo_t = np.full((h, w), -1)
    tipo_t[chao] = terreno(P[chao])
    grama = tipo_t == 0
    rng = np.random.default_rng(11)
    out = cor.copy()
    TUFOS = [
        ["l...l", ".d.d.", "..d.."],
        [".l.", "ldl", ".d."],
        ["l.l.", ".dl.", ".dd."],
        ["..l..", "l.d.l", ".ddd."],
    ]
    pts = []
    for gx in np.arange(GX0 + 0.15, GX1 - 0.1, 0.42):
        for gy in np.arange(GY0 + 0.15, GY1 - 0.1, 0.42):
            pts.append((gx + rng.random() * 0.34, gy + rng.random() * 0.34, rng.integers(0, 4), rng.random(), rng.random()))
    for (x, y, k, r1, r2) in pts:
        if r1 < 0.32:
            continue
        sx, sy = tela(np.array([x, y, 0.0]))
        px, py = int(sx - c.x0), int(sy - c.y0)
        if not (2 <= px < w - 6 and 3 <= py < h - 2):
            continue
        if not grama[py, px]:
            continue
        st = TUFOS[k]
        base = cor[py, px]
        sway = 1 if (math.sin(2 * math.pi * (t + r2)) > 0.6 and r2 > 0.5) else 0
        hh = len(st)
        for j, row in enumerate(st):
            for i, ch in enumerate(row):
                if ch == '.':
                    continue
                xx = px + i - len(row) // 2 + (sway if j == 0 else 0)
                yy = py + j - hh + 1
                if not (0 <= xx < w and 0 <= yy < h) or not chao[yy, xx]:
                    continue
                if ch == 'd':
                    out[yy, xx] = base * 0.72 + np.array([-4, 2, -6])
                else:
                    out[yy, xx] = np.minimum(base * 1.18 + np.array([8, 10, -2]), 255)
    # as florzinhas (2 px: a pétala em cima do talo), em grupinhos
    cores = [hx('#f6f2e4'), hx('#f6d860'), hx('#e8a0c0'), hx('#b8a8f0')]
    for g in range(70):
        x = GX0 + rng.random() * (GX1 - GX0)
        y = GY0 + rng.random() * (GY1 - GY0)
        cf = cores[rng.integers(0, 4)]
        for k in range(rng.integers(2, 5)):
            xx_ = x + (rng.random() - 0.5) * 0.4
            yy_ = y + (rng.random() - 0.5) * 0.4
            sx, sy = tela(np.array([xx_, yy_, 0.0]))
            px, py = int(sx - c.x0), int(sy - c.y0)
            if not (1 <= px < w - 1 and 1 <= py < h - 1) or not grama[py, px] or not grama[py - 1, px]:
                continue
            aa = c._aceso[py, px]
            k_ = 0.75 + 0.25 * aa
            out[py - 1, px] = cf * k_
            out[py, px] = cor[py, px] * 0.75
    return out


def flores_pixel(cor):
    """As flores nos arbustos e nos vasos: pontinhos de 2 px no alto das bolas de folhas."""
    out = cor.copy()
    ob = c.obj
    ids = getattr(c, '_folha_ids', None)
    if ids is None:
        return out
    for (o, cf) in FLORES_EM:
        m = (ob == o) & (c.nrm[..., 2] > 0.25)
        # uma flor por tufo: o pixel de cima à esquerda de cada tufo
        cima = viz(ids, -1, 0, -2)
        esq = viz(ids, 0, -1, -2)
        sel = m & (cima != ids) & (esq != ids) & (ruido(ids * 0.001, 9.1) > 0.35)
        ys, xs = np.nonzero(sel)
        cfc = hx(cf)
        for y, x in zip(ys, xs):
            out[y, x] = cfc
            if x + 1 < out.shape[1] and m[y, x + 1]:
                out[y, x + 1] = cfc * 0.8
    return out


BASE = None


def quadro(t=0.0):
    global BASE
    if BASE is None:
        BASE = base_render()
    cor = BASE.copy()
    ob = c.obj
    # o fundo
    cor = np.where((ob >= 0)[..., None], cor, FUNDO)
    # a luz quente das janelas acesas e do lampião (na varanda, no chão e na parede em volta)
    pisca = 0.85 + 0.15 * math.sin(2 * math.pi * t * 2) * math.sin(2 * math.pi * t * 3 + 1)
    for ov, kind in VIDROS.items():
        if kind == 'escuro':
            continue
        m = ob == ov
        if not m.any():
            continue
        Pm = c.mundoP[m].mean(0)
        nn = c.nrm[m].mean(0)
        p0 = Pm + nn * 0.5 - np.array([0, 0, 0.5])
        cor = luz_quente(cor, p0, 1.4, 0.7 * (pisca if kind == 'fogo' else 1.0),
                         cor_l=(255, 190, 110) if kind == 'aceso' else (255, 150, 70))
    for p in (P_LAMP, P_LAMP2):
        cor = luz_quente(cor, p, 1.1, 0.75 * (0.95 + 0.05 * math.sin(2 * math.pi * t * 4)))
    # o fogo na janela da cozinha: o vidro todo tremula
    m = ob == O_COZINHA
    cor = np.where(m[..., None], cor * (0.9 + 0.12 * pisca), cor)
    cor = tufos(cor, t)
    cor = flores_pixel(cor)
    # a fumaça da chaminé
    bx, by = tela(TOPO_CHAMINE)
    bx, by = bx - c.x0, by - c.y0
    x0, y0, x1, y1 = int(bx - 30), int(by - 110), int(bx + 70), int(by + 4)
    x0, y0 = max(0, x0), max(0, y0)
    yy, xx = np.mgrid[y0:y1, x0:x1]
    a, lit = fumaca_loop(xx + 0.5, yy + 0.5, bx, by - 2, t)
    # pixel limpo: o degrau sozinho some
    vz = np.stack([viz(a, dy, dx, 0.0) for dy, dx in ((0, 1), (1, 0), (0, -1), (-1, 0))])
    a = np.where((a > 0) & ((vz > 0).sum(0) <= 1), 0, a)
    reg = cor[y0:y1, x0:x1]
    fum = np.where(lit[..., None], hx('#f4f0ea'), hx('#a8a4a2'))
    cor[y0:y1, x0:x1] = reg + (fum - reg) * a[..., None]
    return np.clip(cor, 0, 255)


def salvar(arr, nome, esc=1):
    img = Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8))
    if esc != 1:
        img = img.resize((img.width * esc, img.height * esc), Image.NEAREST)
    img.save(os.path.join(AQUI, nome) if not os.path.isabs(nome) else nome)
    return img


def recorte(arr, P_mundo, larg, alt, nome, esc=4):
    sx, sy = tela(np.array(P_mundo))
    px, py = int(sx - c.x0), int(sy - c.y0)
    x0, y0 = max(0, px - larg // 2), max(0, py - alt // 2)
    salvar(arr[y0:y0 + alt, x0:x0 + larg], nome, esc)


if __name__ == '__main__':
    saida = sys.argv[1] if len(sys.argv) > 1 and not sys.argv[1].startswith('--') else os.path.join(AQUI, 'casarao.png')
    img = quadro(0.0)
    salvar(img, saida, 2)
    salvar(img, os.path.join(AQUI, 'casarao_1x.png'))
    recorte(img, TOPO_CHAMINE + np.array([0.3, 0, 0.9]), 150, 130, 'zoom_chamine.png')
    recorte(img, (MEIO, YFR, 1.5), 220, 150, 'zoom_varanda.png')
    recorte(img, (HX1, (HY0 + HY1) / 2, 2.6), 170, 230, 'zoom_lado.png')
    recorte(img, (MEIO - 3.5, YFR + 2.0, 0.3), 220, 140, 'zoom_jardim.png')
    print('ok', img.shape)
    if '--gif' in sys.argv:
        quadros = []
        for f in range(12):
            q = quadro(f / 12)
            quadros.append(Image.fromarray(np.clip(q, 0, 255).astype(np.uint8)))
        q2 = [q.resize((q.width * 2, q.height * 2), Image.NEAREST) for q in quadros]
        q2[0].save(os.path.join(AQUI, 'casarao.gif'), save_all=True, append_images=q2[1:], duration=150, loop=0, disposal=2)
        # o GIF do recorte da chaminé (maior)
        sx, sy = tela(TOPO_CHAMINE + np.array([0.3, 0, 0.9]))
        px, py = int(sx - c.x0), int(sy - c.y0)
        r = [q.crop((px - 75, py - 65, px + 75, py + 65)).resize((600, 520), Image.NEAREST) for q in quadros]
        r[0].save(os.path.join(AQUI, 'chamine_fumaca.gif'), save_all=True, append_images=r[1:], duration=150, loop=0, disposal=2)
        print('gif ok')
