"""
GRUPO E, "escritório e tecnologia": os móveis da Sala de Tecnologia da Sede (o canto dos nerds da Ordem: monitores,
servidores, a luz roxa e azul das telas, a bagunça de lanche), do Gabinete do Veríssimo (o escritório antigo e
elegante), da Prisão, do Laboratório e do Calabouço/Escritório da fazenda (os aparelhos antigos de pesquisa), em pixel
art 1:1 no estilo da cozinha da fazenda (agente_cozinha/cozinha.py) e da casa (pecas_px/casa.py).

Cada peça é desenhada no giro 4 (a frente para +y), com a pegada começando em (0, 0), no tamanho final do catálogo
(def.height em metros; o `aumento` entra só na largura e no fundo, a altura é a de verdade). O exportador (exportar_px.py) gira e faz o acabamento.

Decisões (o que o catálogo deixava em aberto):
  - chair_office, chair_verissimo, armchair_verissimo, sofa_verissimo: o `height` é a altura do ASSENTO.
  - cadeira_gamer: não é `sit`; o `height` (1,56 m) é o alto do encosto.
  - monitor: desenhado no chão da casa (z = 0); o jogo empilha em cima do tampo.
  - estados: 0 = ligado/aceso (o padrão), '1' = desligado/apagado (monitor, console, mesa_holografica, fluorescent).
    O cabinet_file segue o jogo (furniFloor.file_cabinet): 0 = fechado, '1' = a gaveta de cima aberta.
  - telas: acesas, a cor chapada e clara (fora da luz das faces e do contorno, como as lâmpadas); apagadas, o vidro
    escuro com o reflexo. Nada de texto legível: linhas e blocos.
  - mesas (desk_metal, desk_verissimo, table_work, desk_u): sem travessa embaixo, o tampo na altura do `height`.
  - desk_u: as casas `vazio` (o meio e a entrada) ficam livres; os três postos olham para dentro do U.
  - fluorescent: a calha no alto (2,4 m), os dois fios sobem e somem em transparência (CZ.fades) antes da viga.
  - papers: decalque de chão (1 px), sem pegada e sem contorno forte.
"""
import math

import numpy as np

import cozinha as CZ
import base_estilo as BE
import casa as CA
from base_estilo import (hx, liso, mad2, tab2, vol, _tom, _cru, _pau, _barra, _p1_malha, _p1_mat_rampa, _p1_rampa,
                         _poligono_rodado, _disco, PH, PZ)
from motor import emissivo, ruido, suave, KX, KZ

M = BE.M
CASA = 0.75
UN = 1.633                      # unidades do jogo por metro


def C():
    return CZ.c


def novo(contorno=True, sombra=True):
    return C().novo_obj(3, contorno=contorno, sombra=sombra)


def cx(b, mat, oid=None, contorno=True):
    o = novo(contorno) if oid is None else oid
    C().caixa(b, mat, M, o)
    return o


def peg(x0, x1, y0, y1):
    CZ.pegadas.append((x0, x1, y0, y1))


def peq(x0, x1, y0, y1, z):
    CZ.itens_peq.append((x0, x1, y0, y1, z))


def luz(o):
    CZ.luzes.add(o)
    return o


# =====================================================================================================================
# os materiais
# =====================================================================================================================
def metal(cor, b=None, topo=None, quina=1.14, baixo=0.7):
    """A chapa pintada (aço, plástico): a cor chapada, o topo mais claro, a fileira de cima das faces em pé com a luz."""
    c0 = hx(cor)
    ct = hx(topo) if topo else _tom(c0, 1.16)

    def f(L, n, P):
        if n[2] > 0.5:
            return np.tile(ct, (len(P), 1))
        if n[2] < -0.5:
            return np.tile(_tom(c0, baixo), (len(P), 1))
        out = np.tile(c0, (len(P), 1))
        if b is not None and quina:
            out = np.where((P[:, 2] > b[5] - PZ)[:, None], _tom(c0, quina), out)
        return out
    return emissivo(f)


def _uv(n, P):
    """As coordenadas da face em px: (a ao longo da face, b de cima para baixo na vertical / ao longo de y no topo)."""
    nn = np.asarray(n, float)
    if abs(nn[2]) > 0.5:
        return P[:, 0] / PH, P[:, 1] / PH
    if abs(nn[1]) >= abs(nn[0]):
        return P[:, 0] / PH, -P[:, 2] / PZ
    return P[:, 1] / PH, -P[:, 2] / PZ


def frente_metal(cor, paineis, b=None, topo=None, etiqueta=True, fenda=None):
    """
    A chapa com gavetas na frente (+y): paineis = (x0, x1, z0, z1). A fresta escura de 1 px em volta, a luz em cima e
    à esquerda, a sombra embaixo e à direita, e o porta-etiqueta (o cartãozinho creme, em branco) no alto do meio.
    """
    base = metal(cor, b, topo)
    c0 = hx(cor)

    def f(L, n, P):
        out = base(L, n, P)
        if n[1] <= 0.5:
            return out
        u, z = P[:, 0], P[:, 2]
        for (u0, u1, z0, z1) in paineis:
            d = (u >= u0) & (u < u1) & (z >= z0) & (z < z1)
            fr = d & ((u < u0 + PH) | (u >= u1 - PH) | (z < z0 + PZ) | (z >= z1 - PZ))
            luz_ = d & ~fr & ((z >= z1 - 2 * PZ) | (u < u0 + 2 * PH))
            som = d & ~fr & ((z < z0 + 2 * PZ) | (u >= u1 - 2 * PH))
            out = np.where(luz_[:, None], _tom(c0, 1.12), out)
            out = np.where(som[:, None], _tom(c0, 0.84), out)
            out = np.where(fr[:, None], _tom(c0, 0.42), out)
            if etiqueta:
                um = (u0 + u1) / 2
                ew = min(0.05, (u1 - u0) * 0.2)
                ez1 = z1 - 0.04
                ez0 = ez1 - 4 * PZ
                et = d & (np.abs(u - um) < ew) & (z >= ez0) & (z < ez1)
                eb = et & ((np.abs(u - um) >= ew - PH) | (z < ez0 + PZ) | (z >= ez1 - PZ))
                out = np.where(et[:, None], hx('#e8e0c8'), out)
                out = np.where(eb[:, None], _tom(c0, 0.62), out)
        return out
    return emissivo(f)


def ventilado(cor, passo=3, larg=0.3, seed=0, so=None, topo=None, b=None):
    """A chapa com as fendas de ventilação (riscas de 1 px escuras, compridas, em fileiras): so = (a0, a1, z0, z1) na face."""
    base = metal(cor, b, topo)
    c0 = hx(cor)

    def f(L, n, P):
        out = base(L, n, P)
        if abs(n[2]) > 0.5:
            return out
        a, bb = _uv(n, P)
        lin = (np.floor(bb) % passo == 0)
        seg = np.floor(a / max(2, larg / PH))
        lin &= ((a - seg * larg / PH) > 1) & (np.floor(a) % 1 == 0)
        if so is not None:
            a0, a1, z0, z1 = so
            aa = P[:, 0] if abs(n[1]) >= abs(n[0]) else P[:, 1]
            lin &= (aa > a0) & (aa < a1) & (P[:, 2] > z0) & (P[:, 2] < z1)
        out = np.where(lin[:, None], _tom(c0, 0.5), out)
        out = np.where((np.roll(lin, 0) & False)[:, None], out, out)
        return out
    return emissivo(f)


# ----- as telas -----
TELAS = {
    # fundo, a barra de cima, as linhas, o destaque
    'azul': ('#3a5fd0', '#86a8ff', '#c8dcff', '#ffe08a'),
    'roxo': ('#6a3ac8', '#b08aff', '#e6d4ff', '#7af0ff'),
    'verde': ('#1d6e40', '#4cc878', '#a6f4b8', '#e8ffd0'),
    'ciano': ('#1f7f96', '#58c8de', '#c4f2fa', '#ff9ad6'),
    'ambar': ('#8a5214', '#e0a040', '#ffd890', '#fff2c8'),
}


def tela_mat(n, a0, a1, z0, z1, estilo='azul', ligada=True, seed=0, canto=None):
    """
    O que aparece na tela (o plano da face, a de a0 a a1 e z de z0 a z1). Acesa: o fundo claro e colorido, a barra
    de cima, as linhas de "texto" (barras de comprimentos soltos, nada legível), o gráfico ou o mapa; apagada: o vidro
    escuro com as duas riscas de reflexo. canto: a cor da moldura nas quinas (a tela redonda do tubo).
    """
    nn = np.asarray(n, float)
    eixo_x = abs(nn[1]) >= abs(nn[0])
    W = max(1, int(round((a1 - a0) / PH)))
    H = max(1, int(round((z1 - z0) / PZ)))

    def f(L, n_, P):
        a = (P[:, 0] if eixo_x else P[:, 1]) - a0
        i = np.clip(np.floor(a / PH), 0, W - 1)
        j = np.clip(np.floor((z1 - P[:, 2]) / PZ), 0, H - 1)
        if not ligada:
            out = np.tile(hx('#1e2529'), (len(P), 1))
            g = i + j
            ref = ((g >= W * 0.35) & (g < W * 0.35 + 1)) | ((g >= W * 0.35 + 3) & (g < W * 0.35 + 5))
            out = np.where((ref & (j < H * 0.7))[:, None], hx('#3c474c'), out)
            out = np.where((j >= H - 1)[:, None], hx('#161b1e'), out)
        else:
            fu, br, ln, de = (hx(x) for x in TELAS[estilo if estilo in TELAS else 'azul'])
            out = np.tile(fu, (len(P), 1))
            kind = seed % 4 if estilo != 'estatica' else 9
            if kind == 9:
                k = ruido(np.floor(i / 2), np.floor(j / 2), seed + 1.7)
                out = np.where((k > 0.66)[:, None], hx('#d8dce0'), np.where((k > 0.33)[:, None], hx('#9aa2aa'), hx('#5e666e')))
            else:
                out = np.where((j < 2)[:, None], br, out)
                if kind in (0, 2) or W < 10:
                    # as linhas de texto: de 2 em 2 px, cada uma de um comprimento, algumas recuadas
                    lin = (j >= 3) & ((j - 3) % 2 == 0) & (j < H - 1)
                    comp = 2 + np.floor(ruido(j, seed + 3.1) * (W - 4))
                    rec = np.where(ruido(j, seed + 5.3) > 0.7, 2, 1)
                    tx = lin & (i >= rec) & (i < rec + comp)
                    corl = np.where((ruido(j, seed + 7.7) > 0.8)[:, None], de, ln)
                    out = np.where(tx[:, None], corl, out)
                    if kind == 2 and W >= 10:
                        bx = (i >= W * 0.6) & (i < W - 1) & (j >= 3) & (j < H * 0.6)
                        out = np.where(bx[:, None], _tom(fu, 0.7), out)
                        out = np.where((bx & ((i == np.floor(W * 0.6)) | (j == 3)))[:, None], ln, out)
                elif kind == 1:
                    # o gráfico: as barras e a linha
                    col = np.floor(i / 2)
                    hb = 2 + np.floor(ruido(col, seed + 2.2) * (H - 6))
                    bar = (i % 2 == 0) & (i >= 1) & (i < W - 1) & (j >= H - 1 - hb) & (j < H - 1)
                    out = np.where(bar[:, None], ln, out)
                    yv = np.floor(3 + (H - 6) * (0.5 + 0.4 * np.sin(i * 0.7 + seed)))
                    out = np.where(((j == yv) & (i >= 1) & (i < W - 1))[:, None], de, out)
                else:
                    # o mapa: a grade e os pontos
                    out = np.where((((i % 5) == 2) | (((j - 2) % 4) == 3))[:, None], _tom(fu, 1.2), out)
                    cxp, cyp = W * (0.3 + 0.4 * ruido(seed, 1.1)), H * (0.4 + 0.3 * ruido(seed, 2.2))
                    d = np.abs(i - cxp) + np.abs(j - cyp)
                    out = np.where(((d >= 2) & (d < 3))[:, None], de, out)
                    out = np.where((d < 1)[:, None], de, out)
            # a quina de cima à esquerda com o brilho do vidro
            out = np.where(((i + j) < 2)[:, None], _tom(out, 1.15), out)
        if canto is not None:
            q = ((i == 0) | (i == W - 1)) & ((j == 0) | (j == H - 1))
            out = np.where(q[:, None], hx(canto), out)
        return out
    return emissivo(f)


def _quad(face, plano, a0, a1, z0, z1):
    if face == '+y':
        return [(a0, plano, z0), (a1, plano, z0), (a1, plano, z1), (a0, plano, z1)], (0, 1, 0)
    if face == '-y':
        return [(a0, plano, z0), (a0, plano, z1), (a1, plano, z1), (a1, plano, z0)], (0, -1, 0)
    if face == '+x':
        return [(plano, a0, z0), (plano, a0, z1), (plano, a1, z1), (plano, a1, z0)], (1, 0, 0)
    return [(plano, a0, z0), (plano, a1, z0), (plano, a1, z1), (plano, a0, z1)], (-1, 0, 0)


def placa(face, plano, a0, a1, z0, z1, mat, acesa=False, contorno=False):
    """Uma placa fina na face (a tela, o painel de luzinhas): +y, -y, +x ou -x, no plano dado."""
    o = novo(contorno=contorno, sombra=False)
    pts, n = _quad(face, plano, a0, a1, z0, z1)
    C().face_plana(pts, n, mat, M, o)
    if acesa:
        luz(o)
    return o


def tela(face, plano, a0, a1, z0, z1, estilo='azul', ligada=True, seed=0, canto=None):
    pts, n = _quad(face, plano, a0, a1, z0, z1)
    return placa(face, plano, a0, a1, z0, z1, tela_mat(n, a0, a1, z0, z1, estilo, ligada, seed, canto), acesa=ligada)


def leds(face, plano, pos, z, cores, ligado=True, w=1, h=1):
    """As luzinhas: um quadradinho de w x h px por posição (ao longo da face), cada uma com a sua cor."""
    for k, a in enumerate(pos):
        cor = cores[k % len(cores)]
        cc = cor if ligado else '#2a2e30'
        placa(face, plano, a, a + w * PH, z, z + h * PZ, liso(cc), acesa=ligado)


# ----- as peças redondas e tortas -----
def prisma(base, z0, z1, mat, oid):
    """O prisma em pé de base convexa (a perna girada da cadeira, a caixa torta): base = [(x, y), ...] anti-horário."""
    k = len(base)
    cc = C()
    cc.face_plana([(x, y, z1) for (x, y) in base], (0, 0, 1), mat, M, oid)
    cc.face_plana([(x, y, z0) for (x, y) in base[::-1]], (0, 0, -1), mat, M, oid)
    for i in range(k):
        (xa, ya), (xb, yb) = base[i], base[(i + 1) % k]
        nx, ny = yb - ya, -(xb - xa)
        ln = math.hypot(nx, ny) or 1
        cc.face_plana([(xa, ya, z0), (xb, yb, z0), (xb, yb, z1), (xa, ya, z1)], (nx / ln, ny / ln, 0), mat, M, oid)


def ret_girado(cx_, cy_, ang, a, b):
    """Os 4 cantos (anti-horário) do retângulo de meia-largura a (ao longo de ang) e b, centrado em (cx, cy)."""
    ca, sa = math.cos(ang), math.sin(ang)
    pts = []
    for (u, v) in ((-a, -b), (a, -b), (a, b), (-a, b)):
        pts.append((cx_ + u * ca - v * sa, cy_ + u * sa + v * ca))
    return pts


def haste(p0, p1, w, mat, oid, h=None):
    """A barra fina entre dois pontos (a perna do tripé, o braço da lupa): seção w x h."""
    p0, p1 = np.array(p0, float), np.array(p1, float)
    h = w if h is None else h
    d = p1 - p0
    d /= np.linalg.norm(d)
    up = np.array([0.0, 0.0, 1.0]) if abs(d[2]) < 0.95 else np.array([1.0, 0.0, 0.0])
    u = np.cross(d, up)
    u /= np.linalg.norm(u)
    v = np.cross(u, d)
    cs = [(-1, -1), (1, -1), (1, 1), (-1, 1)]
    A = [p0 + u * su * w / 2 + v * sv * h / 2 for (su, sv) in cs]
    B = [p1 + u * su * w / 2 + v * sv * h / 2 for (su, sv) in cs]
    cc = C()
    for i in range(4):
        j = (i + 1) % 4
        nrm = (A[i] + A[j]) / 2 - p0
        nrm /= np.linalg.norm(nrm)
        cc.face_plana([tuple(A[i]), tuple(A[j]), tuple(B[j]), tuple(B[i])], tuple(nrm), mat, M, oid)
    cc.face_plana([tuple(p) for p in A], tuple(-d), mat, M, oid)
    cc.face_plana([tuple(p) for p in B], tuple(d), mat, M, oid)


def cil_eixo(p0, p1, r, mat, oid, lados=14, tampa_mat=None, tampa0=True, r1=None):
    """O cilindro deitado (a lente, o rolo): de p0 a p1, raio r (r1 na ponta p1); as tampas."""
    p0, p1 = np.array(p0, float), np.array(p1, float)
    r1 = r if r1 is None else r1
    d = p1 - p0
    d /= np.linalg.norm(d)
    up = np.array([0.0, 0.0, 1.0]) if abs(d[2]) < 0.95 else np.array([1.0, 0.0, 0.0])
    u = np.cross(d, up)
    u /= np.linalg.norm(u)
    v = np.cross(u, d)
    cc = C()
    ang = [2 * math.pi * (i + 0.5) / lados for i in range(lados)]
    R0 = [p0 + r * (u * math.cos(a) + v * math.sin(a)) for a in ang]
    R1 = [p1 + r1 * (u * math.cos(a) + v * math.sin(a)) for a in ang]
    for i in range(lados):
        j = (i + 1) % lados
        am = (ang[i] + ang[j] + (2 * math.pi if j == 0 else 0)) / 2
        nrm = u * math.cos(am) + v * math.sin(am)
        cc.face_plana([tuple(R0[i]), tuple(R0[j]), tuple(R1[j]), tuple(R1[i])], tuple(nrm), mat, M, oid)
    if tampa0:
        cc.face_plana([tuple(p) for p in R0[::-1]], tuple(-d), tampa_mat or mat, M, oid)
    cc.face_plana([tuple(p) for p in R1], tuple(d), tampa_mat or mat, M, oid)


def bola(c_, r, cor, oid=None, rz=None):
    o = novo() if oid is None else oid
    C().elipsoide(np.array(c_, float), np.array([r, r, rz or r]), liso(cor), o)
    return o


# =====================================================================================================================
# os estofados: o tecido da cadeira, o couro vinho e o vermelho do Veríssimo (o capitonê, as tachas)
# =====================================================================================================================
_TECIDO = _p1_rampa(['#16181f', '#1e222b', '#272c37', '#303744', '#3a4252', '#465062', '#536074', '#627086', '#728098', '#8492aa'])
_PRETO = _p1_rampa(['#100e12', '#17151a', '#1f1c23', '#28242d', '#322d38', '#3d3744', '#4a4352', '#585062', '#686072', '#7a7284'])
_ROXO = _p1_rampa(['#1c0c30', '#281242', '#361a58', '#46226e', '#562c86', '#68389c', '#7c48b2', '#9060c6', '#a87ad8', '#c098e6'])
_VINHO = _p1_rampa(['#1e080c', '#2c0c12', '#3e1118', '#521820', '#661e26', '#7a262e', '#8e3036', '#a23c40', '#b44c4c', '#c4605a'])
_VERMELHO = _p1_rampa(['#3a0a0a', '#560f0e', '#721614', '#8e1e1a', '#a82620', '#c03228', '#d24434', '#e05a44', '#ec7658', '#f49470'])
LATAO, LATAO_L = '#b8862e', '#e8c060'


def estofado(R, b, lo=2.2, hi=6.6, cupula=0.8, brilho=False, grad=1.0, capi=None, tachas=None):
    """
    O estofado (tecido ou couro): a cúpula clara no topo, os lados que escurecem embaixo, o reflexo (couro). capi =
    (pa, pb): o capitonê (os losangos com os botões fundos e os vincos). tachas: (z, passo) a fileira de tachas de latão
    perto de z nas faces em pé.
    """
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
            e += np.where(t < 0.3, -grad, 0)
        if capi is not None:
            pa, pb = capi
            if abs(n[2]) > 0.6:
                a, bb = P[:, 0], P[:, 1]
                ub = PH
            elif abs(n[1]) >= abs(n[0]):
                a, bb = P[:, 0], P[:, 2]
                ub = PZ
            else:
                a, bb = P[:, 1], P[:, 2]
                ub = PZ
            s = a / pa + bb / pb
            t = a / pa - bb / pb
            fs, ft = np.abs((s % 1) - 0.5), np.abs((t % 1) - 0.5)          # 0.5 na aresta, 0 no meio
            es = 0.5 - 1.0 * max(PH / pa, ub / pb)
            vinco = (fs > es) | (ft > es)
            botao = (fs > 0.5 - 1.4 * PH / pa) & (ft > 0.5 - 1.4 * PH / pa)
            e += np.where(botao, -3.0, np.where(vinco, -1.4, 0.0))
            e += np.where((fs < 0.16) & (ft < 0.16), 0.7, 0)
        return e
    m = _p1_mat_rampa(R, lo, hi, extra=extra)
    if tachas is None:
        return m
    zt, passo = tachas

    def f(L, n, P):
        out = m(L, n, P)
        if abs(n[2]) > 0.6:
            return out
        a = P[:, 0] if abs(n[1]) >= abs(n[0]) else P[:, 1]
        t = (np.abs(P[:, 2] - zt) < 0.6 * PZ) & (np.floor(a / PH) % passo == 0)
        return np.where(t[:, None], _cru(hx(LATAO_L), n), out)
    return emissivo(f)


def malha(b, r, mat, seg=2):
    return _p1_malha(b, r, mat, seg=seg)


# =====================================================================================================================
# as cadeiras: a de escritório (29 vezes), a gamer, a do Veríssimo e a poltrona das visitas
# =====================================================================================================================
PLAST = '#26252a'
CROMO = '#a4aab2'


def base_estrela(cx_, cy_, r=0.3, cor=PLAST, rodinhas=True):
    """A base de cinco pés com as rodinhas: o cubo, os pés (barras giradas, a ponta mais baixa) e as rodízios."""
    o = novo()
    C().cilindro(cx_, cy_, 0.055, 0.06, 0.14, vol(cx_, cy_, cor, brilho=0.3), M, o, lados=14, tampa_mat=liso('#3a383e'))
    for k in range(5):
        ang = math.radians(90 + 72 * k + 18)
        a = (r - 0.02) / 2
        mx, my = cx_ + math.cos(ang) * (a + 0.02), cy_ + math.sin(ang) * (a + 0.02)
        o = novo()
        prisma(ret_girado(mx, my, ang, a, 0.022), 0.075, 0.115, metal(cor, (0, 0, 0, 0, 0.075, 0.115), topo='#4a4850'), o)
        if rodinhas:
            ex, ey = cx_ + math.cos(ang) * r, cy_ + math.sin(ang) * r
            o = novo()
            C().elipsoide(np.array([ex, ey, 0.035]), np.array([0.03, 0.03, 0.035]), liso('#1a191d'), o)
            _barra((ex - PH, ex + PH, ey - PH, ey + PH, 0.06, 0.09), '#3a383e', quina=False)


def coluna_gas(cx_, cy_, z0, z1):
    o = novo()
    C().cilindro(cx_, cy_, 0.036, z0, z0 + (z1 - z0) * 0.55, vol(cx_, cy_, PLAST, brilho=0.3), M, o, lados=12, tampa=False)
    o = novo()
    C().cilindro(cx_, cy_, 0.024, z0 + (z1 - z0) * 0.55, z1, vol(cx_, cy_, CROMO, brilho=0.6), M, o, lados=12, tampa=False)


def braco_cadeira(xb, cy_, zs, zt, cor=PLAST):
    """O braço em T: a haste que sai de baixo do assento e o apoio estofado em cima."""
    o = novo()
    cx((xb - 0.018, xb + 0.018, cy_ - 0.08, cy_ - 0.04, zs - 0.05, zt - 0.03), metal(cor, (0, 0, 0, 0, zs - 0.05, zt - 0.03)), o)
    b = (xb - 0.035, xb + 0.035, cy_ - 0.17, cy_ + 0.12, zt - 0.035, zt)
    malha(b, (0.015, 0.03, 0.01, 0.012), estofado(_PRETO, b, 2.6, 6.0, cupula=0.5), seg=1)


def chair_office():
    """
    A cadeira de escritório (o assento a 0,47 m): a base de cinco pés com as rodinhas, a coluna a gás cromada, o
    mecanismo, o assento estofado de tecido azul-grafite, o encosto na haste e os braços em T.
    """
    cx_, cy_ = 0.375, 0.39
    zs = 0.47
    base_estrela(cx_, cy_, 0.31)
    coluna_gas(cx_, cy_, 0.13, zs - 0.12)
    cx((cx_ - 0.11, cx_ + 0.11, cy_ - 0.1, cy_ + 0.1, zs - 0.13, zs - 0.09), metal('#2e2d33', (0, 0, 0, 0, zs - 0.13, zs - 0.09)))
    # a alavanca
    _barra((cx_ + 0.1, cx_ + 0.17, cy_ + 0.02, cy_ + 0.02 + 2 * PH, zs - 0.12, zs - 0.12 + 2 * PZ), '#1e1d22', quina=False)
    b = (cx_ - 0.245, cx_ + 0.245, cy_ - 0.22, cy_ + 0.25, zs - 0.1, zs)
    malha(b, (0.07, 0.07, 0.02, 0.05), estofado(_TECIDO, b, 2.4, 7.0, cupula=1.0, grad=1.2))
    # a haste do encosto (sai de baixo do assento e sobe atrás)
    o = novo()
    cx((cx_ - 0.03, cx_ + 0.03, cy_ - 0.27, cy_ - 0.05, zs - 0.12, zs - 0.08), metal(PLAST, (0, 0, 0, 0, zs - 0.12, zs - 0.08)), o)
    cx((cx_ - 0.03, cx_ + 0.03, cy_ - 0.3, cy_ - 0.26, zs - 0.12, zs + 0.2), metal(PLAST, (0, 0, 0, 0, zs - 0.12, zs + 0.2)), o)
    # o encosto: a concha de plástico atrás e a almofada na frente
    b = (cx_ - 0.22, cx_ + 0.22, cy_ - 0.33, cy_ - 0.28, zs + 0.1, zs + 0.56)
    malha(b, (0.08, 0.02, 0.06, 0.09), estofado(_PRETO, b, 1.6, 5.0, cupula=0.2, grad=0.4))
    b = (cx_ - 0.205, cx_ + 0.205, cy_ - 0.3, cy_ - 0.22, zs + 0.12, zs + 0.54)
    malha(b, (0.07, 0.035, 0.06, 0.09), estofado(_TECIDO, b, 2.6, 7.4, cupula=0.9, grad=0.6))
    for xb in (cx_ - 0.27, cx_ + 0.27):
        braco_cadeira(xb, cy_, zs, zs + 0.2)
    peg(cx_ - 0.3, cx_ + 0.3, cy_ - 0.3, cy_ + 0.3)


def cadeira_gamer():
    """
    A cadeira gamer (o encosto a 1,32 m): a base de cinco pés, o assento com as abas, o encosto alto de corrida com as
    asas roxas, as fendas do cinto, a almofada de pescoço e os braços em T.
    """
    cx_, cy_ = 0.375, 0.4
    zs = 0.5
    H = 1.32
    base_estrela(cx_, cy_, 0.33)
    coluna_gas(cx_, cy_, 0.13, zs - 0.13)
    cx((cx_ - 0.12, cx_ + 0.12, cy_ - 0.12, cy_ + 0.1, zs - 0.15, zs - 0.1), metal('#2e2d33', (0, 0, 0, 0, zs - 0.15, zs - 0.1)))
    # o assento e as abas roxas dos lados
    b = (cx_ - 0.2, cx_ + 0.2, cy_ - 0.22, cy_ + 0.25, zs - 0.11, zs - 0.01)
    malha(b, (0.05, 0.06, 0.02, 0.04), estofado(_PRETO, b, 2.2, 6.6, cupula=0.9))
    for (a0, a1) in ((cx_ - 0.27, cx_ - 0.18), (cx_ + 0.18, cx_ + 0.27)):
        b = (a0, a1, cy_ - 0.22, cy_ + 0.26, zs - 0.11, zs + 0.04)
        malha(b, (0.035, 0.06, 0.02, 0.04), estofado(_ROXO, b, 2.6, 7.4, cupula=0.6))
    # o encosto: o painel do meio preto, as asas roxas, o alto mais estreito
    yb0, yb1 = cy_ - 0.34, cy_ - 0.2

    def furos(base):
        def f(L, n, P):
            out = base(L, n, P)
            if n[1] < 0.5:
                return out
            fx = (np.abs(np.abs(P[:, 0] - cx_) - 0.06) < PH) & (P[:, 2] < H - 0.3) & (P[:, 2] > zs + 0.32)
            out = np.where(fx[:, None], _cru(hx('#8a50d0'), n), out)
            lo = (np.abs(P[:, 0] - cx_) + np.abs(P[:, 2] - (H - 0.2)) / 0.82 < 0.045)
            return np.where(lo[:, None], _cru(hx('#a87ae0'), n), out)
        return emissivo(f)
    b = (cx_ - 0.17, cx_ + 0.17, yb0, yb1, zs - 0.02, H)
    malha(b, (0.07, 0.04, 0.03, 0.08), furos(estofado(_PRETO, b, 2.4, 6.8, cupula=0.6, grad=0.3)))
    for (a0, a1) in ((cx_ - 0.25, cx_ - 0.14), (cx_ + 0.14, cx_ + 0.25)):
        b = (a0, a1, yb0 + 0.01, yb1 + 0.05, zs + 0.02, H - 0.3)
        malha(b, (0.04, 0.05, 0.04, 0.12), estofado(_ROXO, b, 2.4, 7.2, cupula=0.5, grad=0.4))
    # a almofada de pescoço e a lombar
    b = (cx_ - 0.12, cx_ + 0.12, yb1 - 0.01, yb1 + 0.06, H - 0.36, H - 0.24)
    malha(b, (0.05, 0.03, 0.04, 0.05), estofado(_PRETO, b, 3.0, 7.4, cupula=0.8))
    b = (cx_ - 0.13, cx_ + 0.13, yb1 - 0.01, yb1 + 0.07, zs + 0.12, zs + 0.3)
    malha(b, (0.05, 0.03, 0.05, 0.06), estofado(_ROXO, b, 3.0, 7.6, cupula=0.8))
    for xb in (cx_ - 0.3, cx_ + 0.3):
        braco_cadeira(xb, cy_, zs, zs + 0.24)
    peg(cx_ - 0.32, cx_ + 0.32, cy_ - 0.32, cy_ + 0.32)


# ----- o Veríssimo -----
JAC = CA.JAC
NOG, NOG_E, NOG_TAB = CA.NOG, CA.NOG_E, CA.NOG_TAB


def chair_verissimo():
    """
    A cadeira do Veríssimo (o assento a 0,48 m): o espaldar alto entalhado (os postes com os pináculos, a crista em
    arco), o couro vinho capitonê, as tachas de latão, os braços de madeira com a almofada e as pernas torneadas.
    """
    x0, x1 = 0.08, 0.67
    y0, y1 = 0.06, 0.7
    zs = 0.78 / UN
    H = 1.32
    for (a, b) in ((x0 + 0.04, y0 + 0.04), (x1 - 0.04, y0 + 0.04), (x0 + 0.04, y1 - 0.05), (x1 - 0.04, y1 - 0.05)):
        CA.perna_torneada(a, b, 0.0, zs - 0.1, 0.032, '#3e1c0e')
    # a caixa do assento (a saia de madeira com as tachas) e a almofada de couro
    b = (x0, x1, y0 + 0.06, y1, zs - 0.12, zs - 0.06)
    cx(b, {'cima': liso('#4a2412'), '*': CA.almofadas(JAC, [], seed=3)})
    b = (x0 + 0.01, x1 - 0.01, y0 + 0.09, y1 + 0.005, zs - 0.07, zs)
    malha(b, (0.04, 0.04, 0.015, 0.035), estofado(_VINHO, b, 2.2, 7.2, cupula=1.1, brilho=True, tachas=(zs - 0.045, 3)))
    # os postes de trás com os pináculos
    for xx in (x0, x1 - 0.06):
        cx((xx, xx + 0.06, y0, y0 + 0.07, 0.0, H - 0.06), {'cima': liso('#7a3e22'), '*': mad2('#4e2414', eixo=1, seed=5, passo=0.04)})
        o = novo()
        cc_ = (xx + 0.03, y0 + 0.035)
        _poligono_rodado(cc_[0], cc_[1], [(H - 0.06, 0.03), (H - 0.04, 0.042), (H - 0.01, 0.036), (H + 0.03, 0.022), (H + 0.06, 0.0)],
                         vol(cc_[0], cc_[1], '#6a3420', brilho=0.2), o, lados=12)
    # o espaldar: o painel de couro capitonê dentro da moldura e a crista em arco
    zp0, zp1 = zs + 0.08, H - 0.16
    cx((x0 + 0.06, x1 - 0.06, y0, y0 + 0.025, zp0, zp1), CA.almofadas(JAC, [], seed=9))
    b = (x0 + 0.06, x1 - 0.06, y0 + 0.025, y0 + 0.085, zp0, zp1)
    malha(b, (0.02, 0.02, 0.02, 0.02), estofado(_VINHO, b, 2.4, 6.8, cupula=0.4, capi=(0.115, 0.1)), seg=1)
    cx((x0 + 0.06, x1 - 0.06, y0 + 0.005, y0 + 0.06, zp0 - 0.05, zp0), _pau('#5a2a16', '#7a3e22', quina=1.2, b=(0, 0, 0, 0, zp0 - 0.05, zp0)))
    # a crista: três degraus em arco (a do meio mais alta) com o entalhe (o friso claro)
    for (a0, a1, zz) in ((x0 + 0.06, x1 - 0.06, H - 0.06), (x0 + 0.14, x1 - 0.14, H), (x0 + 0.22, x1 - 0.22, H + 0.05)):
        cx((a0, a1, y0 + 0.005, y0 + 0.065, zp1, zz), {'frente': CA.almofadas(JAC, [(a0 + 0.02, a1 - 0.02, zp1 + 0.02, zz - 0.015, 'p')] if a1 - a0 > 0.2 else [], seed=7),
                                                         'cima': liso('#7a3e22'), '*': mad2(JAC, seed=8, passo=0.04)})
    # os braços: o apoio de madeira com a almofadinha de couro, a haste da frente torneada
    for (a0, a1) in ((x0 - 0.01, x0 + 0.06), (x1 - 0.06, x1 + 0.01)):
        cx((a0, a1, y0 + 0.05, y1 - 0.02, zs + 0.2, zs + 0.24), {'cima': liso('#7a3e22'), '*': _pau('#5a2a16', quina=1.22, b=(0, 0, 0, 0, zs + 0.2, zs + 0.24))})
        b = (a0 + 0.008, a1 - 0.008, y0 + 0.14, y1 - 0.12, zs + 0.24, zs + 0.27)
        malha(b, (0.015, 0.02, 0.005, 0.012), estofado(_VINHO, b, 2.6, 7.0, cupula=0.6), seg=1)
        CA.perna_torneada((a0 + a1) / 2, y1 - 0.05, zs - 0.02, zs + 0.2, 0.024, '#4e2414')
    peg(x0, x1, y0, y1)


def armchair_verissimo():
    """
    A poltrona das visitas (o assento a 0,45 m): o club de couro vinho, os braços em rolo com a fileira de tachas de
    latão, o encosto capitonê, a almofada do assento e os pezinhos torneados.
    """
    x0, x1 = 0.03, 0.72
    y0, y1 = 0.04, 0.72
    zs = 0.73 / UN
    br = 0.15
    for (a, b_) in ((x0 + 0.07, y0 + 0.06), (x1 - 0.07, y0 + 0.06), (x0 + 0.07, y1 - 0.07), (x1 - 0.07, y1 - 0.07)):
        CA.pe_bola(a, b_, 0.09, 0.03, '#3e1c0e')
    b = (x0 + 0.04, x1 - 0.04, y0 + 0.05, y1 - 0.03, 0.08, zs - 0.11)
    malha(b, (0.03, 0.03, 0.02, 0.03), estofado(_VINHO, b, 1.4, 4.6, cupula=0, grad=0.8, tachas=(zs - 0.14, 3)))
    b = (x0 + 0.04, x1 - 0.04, y0, y0 + 0.2, zs - 0.15, 0.86)
    malha(b, (0.07, 0.07, 0.02, 0.1), estofado(_VINHO, b, 2.0, 6.0, cupula=0.4, grad=0.5))
    b = (x0 + 0.06, x1 - 0.06, y0 + 0.12, y0 + 0.24, zs - 0.04, 0.85)
    malha(b, (0.03, 0.03, 0.02, 0.06), estofado(_VINHO, b, 2.6, 7.4, cupula=0.4, capi=(0.12, 0.1)), seg=2)
    b = (x0 + br - 0.005, x1 - br + 0.005, y0 + 0.24, y1, zs - 0.14, zs)
    malha(b, (0.06, 0.06, 0.03, 0.06), estofado(_VINHO, b, 2.2, 7.4, cupula=1.2, brilho=True))
    for (a0, a1) in ((x0, x0 + br), (x1 - br, x1)):
        b = (a0 + 0.02, a1 - 0.02, y0 + 0.04, y1 - 0.02, 0.08, zs + 0.06)
        malha(b, (0.04, 0.05, 0.02, 0.03), estofado(_VINHO, b, 1.8, 5.6, cupula=0, grad=1.0, tachas=(zs + 0.02, 3)))
        b = (a0, a1, y0 + 0.02, y1, zs, zs + 0.2)
        malha(b, (0.07, 0.07, 0.07, 0.09), estofado(_VINHO, b, 2.2, 7.6, cupula=0.8, brilho=True))
    peg(x0, x1, y0, y1)


def sofa_verissimo():
    """
    O sofá Chesterfield (3 casas; o assento a 0,45 m): o couro vermelho-vivo capitonê no encosto e nos braços (a mesma
    altura, em rolo), as três almofadas do assento, a fileira de tachas de latão embaixo e os pezinhos de bola.
    """
    x0, x1 = 0.04, 2.21
    y0, y1 = 0.04, 0.72
    zs = 0.73 / UN
    H = 0.78
    br = 0.2
    for (a, b_) in ((x0 + 0.08, y0 + 0.07), (x1 - 0.08, y0 + 0.07), (x0 + 0.08, y1 - 0.08), (x1 - 0.08, y1 - 0.08), ((x0 + x1) / 2, y1 - 0.08)):
        CA.pe_bola(a, b_, 0.08, 0.032, '#2e140a')
    # a base (a saia com as tachas)
    b = (x0 + 0.03, x1 - 0.03, y0 + 0.05, y1 - 0.02, 0.07, zs - 0.1)
    malha(b, (0.03, 0.03, 0.02, 0.03), estofado(_VERMELHO, b, 1.4, 4.8, cupula=0, grad=0.6, tachas=(0.1, 3)))
    # o encosto capitonê (alto como os braços), com o rolo em cima
    b = (x0 + 0.03, x1 - 0.03, y0, y0 + 0.22, zs - 0.12, H)
    malha(b, (0.06, 0.08, 0.02, 0.1), estofado(_VERMELHO, b, 2.2, 6.8, cupula=0.6, capi=(0.15, 0.13), grad=0.4))
    # as três almofadas do assento
    w = (x1 - x0 - 2 * br) / 3
    for k in range(3):
        a0 = x0 + br + k * w
        b = (a0 + 0.004, a0 + w - 0.004, y0 + 0.2, y1, zs - 0.13, zs)
        malha(b, (0.06, 0.06, 0.03, 0.06), estofado(_VERMELHO, b, 2.4, 7.4, cupula=1.1, brilho=True))
    # os braços em rolo (capitonê por dentro, o rolo saindo para fora)
    for (a0, a1) in ((x0, x0 + br), (x1 - br, x1)):
        b = (a0 + 0.02, a1 - 0.02, y0 + 0.02, y1 - 0.01, 0.07, H - 0.08)
        malha(b, (0.04, 0.05, 0.02, 0.03), estofado(_VERMELHO, b, 1.8, 6.0, cupula=0, grad=0.8, capi=(0.15, 0.13), tachas=(0.1, 3)))
        b = (a0 - 0.01, a1 + 0.01, y0, y1 + 0.01, H - 0.2, H)
        malha(b, (0.09, 0.08, 0.08, 0.1), estofado(_VERMELHO, b, 2.4, 7.6, cupula=0.8, brilho=True))
    peg(x0, x1, y0, y1)


# =====================================================================================================================
# as mesas
# =====================================================================================================================
def _papeis(x, y, z, n=3, w=0.21, d=0.28, seed=0, ang=0.0):
    """A pilha de folhas (cada uma 1 px, um pouco torta): o branco com as linhas cinza (nada legível)."""
    for k in range(n):
        a = ang + 0.12 * (ruido(seed, k) - 0.5)
        o = novo()
        x_, y_ = x + 0.012 * (ruido(seed, k, 1.3) - 0.5), y + 0.012 * (ruido(seed, k, 2.3) - 0.5)
        pts = ret_girado(x_, y_, a, w / 2, d / 2)

        def folha(L, n_, P, x_=x_, y_=y_, a=a, k=k):
            u = (P[:, 0] - x_) * math.cos(a) + (P[:, 1] - y_) * math.sin(a)
            v = -(P[:, 0] - x_) * math.sin(a) + (P[:, 1] - y_) * math.cos(a)
            out = np.tile(hx('#f0eadc' if k % 2 == 0 else '#e8e0cc'), (len(P), 1))
            if n_[2] < 0.5:
                return np.tile(hx('#c8c0ac'), (len(P), 1))
            lv = np.floor((v + d / 2) / PH)
            lin = (lv % 2 == 0) & (lv > 1) & (lv < d / PH - 2) & (np.abs(u) < w / 2 - 2 * PH)
            lin &= (u + w / 2 - 2 * PH) / (w - 4 * PH) < 0.55 + 0.45 * ruido(lv, seed + k)
            return np.where(lin[:, None], hx('#a8a498'), out)
        prisma(pts, z + k * PZ * 0.7, z + (k + 1) * PZ * 0.7, emissivo(folha), o)
    peq(x - w / 2, x + w / 2, y - d / 2, y + d / 2, z)


def _caneca(x, y, z, cor='#e8e2d4'):
    def faixa(P, b):
        return np.where((P[:, 2] > z + 0.1 - PZ)[:, None], _tom(b, 0.8), b)
    o = novo()
    C().cilindro(x, y, 0.045, z, z + 0.1, vol(x, y, cor, brilho=0.3, faixas=faixa), M, o, lados=16, tampa=False)
    _disco(x, y, z + 0.1, 0.045, emissivo(lambda L, n, P: np.where((np.hypot(P[:, 0] - x, P[:, 1] - y) > 0.032)[:, None], hx(cor), hx('#3a2016'))), o, lados=16)
    o = novo()
    BE._fita([(0.04, z + 0.08), (0.075, z + 0.075), (0.08, z + 0.045), (0.04, z + 0.03)], x, y, liso(cor), o, 0.022)
    peq(x - 0.05, x + 0.05, y - 0.05, y + 0.05, z)


def _lapis(x, y, z, ang, cor='#e0b030'):
    o = novo()
    pts = ret_girado(x, y, ang, 0.08, PH * 0.8)
    prisma(pts, z, z + PZ, liso(cor), o)


def table_work():
    """
    A mesa de trabalho (3 x 2 casas, aumento 1,2: 2,7 x 1,8 m; o tampo a 0,76 m): o tampo grosso de compensado claro com a borda
    de fórmica, as quatro pernas de tubo de aço (nada embaixo: vazada), as folhas, o lápis e a caneca.
    """
    w, d = 2.25 * 1.2, 1.5 * 1.2
    x, y = 1.125 - w / 2, 0.75 - d / 2
    h = 0.76
    tp = 0.05
    TAB = tab2(["#c8a272", "#c29c6c", "#cca878"], 0.6, "#8a6440", eixo=0, seed=11, comp=1.35, org=y, veio=False)
    VEIO = mad2('#c8a272', eixo=0, seed=12, passo=0.07, claro=1.05, escuro=0.95)

    def topo_m(L, n, P):
        out = TAB(L, n, P)
        v = VEIO(L, n, P)
        return np.where((np.abs(out - hx('#8a6440')).sum(1) < 1)[:, None], out, np.where((np.abs(v - hx('#c8a272')).sum(1) > 1)[:, None], _tom(out, 0.95), out))
    TOPO = emissivo(topo_m)
    cx((x, x + w, y, y + d, h - tp, h), {'cima': TOPO, '*': metal('#4a4a46', (0, 0, 0, 0, h - tp, h), quina=1.3)})
    # a régua de aço embaixo do tampo (só nas bordas: a cadeira encaixa)
    for (a0, a1, b0, b1) in ((x + 0.04, x + w - 0.04, y + 0.04, y + 0.07), (x + 0.04, x + w - 0.04, y + d - 0.07, y + d - 0.04)):
        cx((a0, a1, b0, b1, h - tp - 0.06, h - tp), metal('#3a3c3e', (0, 0, 0, 0, h - tp - 0.06, h - tp)))
    for (a, b) in ((x + 0.04, y + 0.04), (x + w - 0.1, y + 0.04), (x + 0.04, y + d - 0.1), (x + w - 0.1, y + d - 0.1)):
        cx((a, a + 0.06, b, b + 0.06, 0.0, h - tp), {'cima': liso('#6a6c6e'), '*': metal('#46484a', quina=False)})
        cx((a - 0.01, a + 0.07, b - 0.01, b + 0.07, 0.0, 0.025), metal('#26282a', (0, 0, 0, 0, 0, 0.025)))
    peg(x, x + w, y, y + d)
    _papeis(x + 0.7, y + 0.6, h, n=3, seed=3, ang=0.3)
    _papeis(x + 1.1, y + 0.85, h, n=1, seed=7, ang=-0.5)
    _lapis(x + 1.0, y + 0.45, h, 0.9)
    _caneca(x + w - 0.45, y + 0.5, h, '#3e5f8e')


def _gaveteiro(x0, x1, y0, y1, z0, z1, cor, n, alca_cor='#1e2022'):
    """O gaveteiro de aço (o pé da mesa metálica): as gavetas com o porta-etiqueta e a alça embutida."""
    fi = np.linspace(z0 + 0.03, z1 - 0.01, n + 1)
    pain = [(x0 + 0.02, x1 - 0.02, fi[i] + 0.006, fi[i + 1] - 0.006) for i in range(n)]
    cx((x0, x1, y0, y1, z0, z1), {'frente': frente_metal(cor, pain[::-1], (0, 0, 0, 0, z0, z1)), '*': metal(cor, (0, 0, 0, 0, z0, z1))})
    for i in range(n):
        zm = fi[i + 1] - 0.075
        _barra(((x0 + x1) / 2 - 0.05, (x0 + x1) / 2 + 0.05, y1, y1 + 0.015, zm - PZ, zm + PZ), alca_cor, '#5a5c60', quina=False)
    return fi


def desk_metal():
    """
    A mesa metálica de repartição (2 x 1 casas, aumento 1,2: 1,8 x 0,9 m; o tampo a 0,76 m): o tampo de fórmica verde-cinza com o
    friso de alumínio, o gaveteiro de três gavetas à direita, a lateral fechada à esquerda e o painel de trás (o vão
    'fundo'); a pilha de papéis e o porta-lápis.
    """
    w, d = 1.5 * 1.2, 0.75 * 1.2
    x, y = 0.75 - w / 2, 0.375 - d / 2
    h = 0.76
    tp = 0.04
    COR = '#5e6a62'

    def formica(L, n, P):
        out = np.tile(hx('#8e9a8c'), (len(P), 1))
        s = suave(np.floor(P[:, 0] / PH) * PH, np.floor(P[:, 1] / PH) * PH, 0.3, 21)
        out = np.where((s > 0.7)[:, None], hx('#96a294'), out)
        bd = (P[:, 0] < x + 0.015) | (P[:, 0] > x + w - 0.015) | (P[:, 1] < y + 0.015) | (P[:, 1] > y + d - 0.015)
        return np.where(bd[:, None], hx('#b8bcb8'), out)
    cx((x, x + w, y, y + d, h - tp, h), {'cima': emissivo(formica), '*': metal('#9aa09c', (0, 0, 0, 0, h - tp, h), quina=1.2)})
    m = 0.02
    # o gaveteiro (direita) e a lateral (esquerda)
    _gaveteiro(x + w - m - 0.5, x + w - m, y + m, y + d - m, 0.0, h - tp, COR, 3)
    cx((x + m, x + m + 0.04, y + m, y + d - m, 0.0, h - tp), metal(COR, (0, 0, 0, 0, 0, h - tp)))
    # a gaveta fina do meio e o painel de trás (o vão 'fundo')
    cx((x + m + 0.04, x + w - m - 0.5, y + d - m - 0.5, y + d - m, h - tp - 0.1, h - tp),
       {'frente': frente_metal(COR, [(x + m + 0.08, x + w - m - 0.54, h - tp - 0.094, h - tp - 0.006)], etiqueta=False), '*': metal(COR)})
    _barra((x + 0.55, x + 0.75, y + d - m, y + d - m + 0.012, h - tp - 0.06, h - tp - 0.06 + 2 * PZ), '#1e2022', '#5a5c60', quina=False)
    cx((x + m + 0.04, x + w - m - 0.5, y + m, y + m + 0.03, 0.12, h - tp - 0.1), metal(_hexs(COR, 0.9)))
    peg(x, x + w, y, y + d)
    _papeis(x + 0.4, y + 0.42, h, n=4, seed=11, ang=0.15)
    # o porta-lápis
    px_, py_ = x + w - 0.25, y + 0.25
    o = novo()
    C().cilindro(px_, py_, 0.04, h, h + 0.1, vol(px_, py_, '#3a3e44', brilho=0.3), M, o, lados=14, tampa_mat=liso('#16181a'))
    for (dx, dy, cor, hh) in ((-0.012, 0.0, '#c83a2a', 0.17), (0.012, -0.01, '#2a4ab8', 0.15), (0.0, 0.014, '#e0b030', 0.16)):
        _barra((px_ + dx - PH / 2, px_ + dx + PH / 2, py_ + dy - PH / 2, py_ + dy + PH / 2, h + 0.1, h + hh), cor, quina=False)
    peq(px_ - 0.04, px_ + 0.04, py_ - 0.04, py_ + 0.04, h)


def _hexs(cor, k):
    c = _tom(hx(cor), k)
    return '#%02x%02x%02x' % tuple(int(max(0, min(255, v))) for v in c)


def _abajur_verde(x, y, z):
    """A luminária de banqueiro: a base de latão, a haste, a cúpula de vidro verde (o banho de luz no tampo é do jogo)."""
    o = novo()
    _poligono_rodado(x, y, [(z, 0.075), (z + 0.02, 0.075), (z + 0.035, 0.05)], vol(x, y, LATAO, brilho=0.5), o, lados=18, tampa_mat=liso('#d0a050'))
    _barra((x - PH, x + PH, y - PH, y + PH, z + 0.035, z + 0.3), LATAO, LATAO_L, quina=False)
    o = novo()
    cil_eixo((x - 0.19, y + 0.02, z + 0.33), (x + 0.19, y + 0.02, z + 0.33), 0.075, liso('#2e8a52'), o, lados=10, tampa_mat=liso('#1e5a36'))
    o = luz(novo(contorno=False, sombra=False))
    C().face_plana([(x - 0.15, y - 0.03, z + 0.26), (x + 0.15, y - 0.03, z + 0.26), (x + 0.15, y + 0.07, z + 0.26), (x - 0.15, y + 0.07, z + 0.26)],
                   (0, 0, -1), liso('#fff0b8'), M, o, dois_lados=True)
    peq(x - 0.08, x + 0.08, y - 0.08, y + 0.08, z)


def _pasta(x, y, z, ang, cor='#c8a46a', seed=0, alto=0.03):
    """A pasta de caso (o papelão pardo dobrado, a orelha, o elástico vermelho)."""
    o = novo()
    pts = ret_girado(x, y, ang, 0.17, 0.12)

    def m(L, n, P):
        out = np.tile(hx(cor), (len(P), 1))
        if n[2] < 0.5:
            fo = np.floor((P[:, 2] - z) / PZ) % 2 == 0
            return np.where(fo[:, None], hx('#efe6cc'), _tom(hx(cor), 0.8))
        u = (P[:, 0] - x) * math.cos(ang) + (P[:, 1] - y) * math.sin(ang)
        out = np.where((np.abs(u - 0.06) < PH * 0.9)[:, None], hx('#a82a22'), out)
        return out
    prisma(pts, z, z + alto, emissivo(m), o)


def desk_verissimo():
    """
    A mesa do Veríssimo (3 x 2 casas, aumento 1,2: 2,7 x 1,8 m; o tampo a 0,76 m): a mesa de pedestais de jacarandá entalhado
    (as gavetas dos dois lados, o vão do meio), o painel de trás almofadado (o vão 'fundo'), o tampo com o forro de
    couro verde, os livros, as pastas de casos, a luminária verde, o tinteiro e a pena.
    """
    w, d = 2.25 * 1.2, 1.5 * 1.2
    x, y = 1.125 - w / 2, 0.75 - d / 2
    h = 0.76
    tp = 0.06
    zb = 0.1
    pw = 0.72
    cx((x, x + w, y, y + d, h - tp, h), {'cima': tab2(CA.JAC_TAB, 0.3, '#3a1a0c', seed=71, comp=1.2, org=y),
                                         '*': _pau('#6e3820', '#7a3e22', quina=1.25, b=(0, 0, 0, 0, h - tp, h))})
    cx((x + 0.03, x + w - 0.03, y + 0.03, y + d - 0.03, h - tp - 0.035, h - tp), _pau('#4a2412', quina=1.2, b=(0, 0, 0, 0, h - tp - 0.035, h - tp)))
    zt = h - tp - 0.035
    for (a0, a1) in ((x + 0.06, x + 0.06 + pw), (x + w - 0.06 - pw, x + w - 0.06)):
        # o rodapé saliente
        cx((a0 - 0.02, a1 + 0.02, y + 0.04, y + d - 0.04, 0.0, zb), _pau('#3e1c0e', quina=1.2, b=(0, 0, 0, 0, 0, zb)))
        fi = np.linspace(zb + 0.02, zt - 0.01, 4)
        pain = [(a0 + 0.04, a1 - 0.04, fi[i] + 0.008, fi[i + 1] - 0.008, 'g' if i > 0 else 'p') for i in range(3)]
        cx((a0, a1, y + 0.06, y + d - 0.06, zb, zt), {'frente': CA.almofadas(JAC, pain, eixo=0, seed=72, passo=0.05),
                                                      'costas': CA.almofadas(JAC, [], seed=73),
                                                      '*': mad2(JAC, eixo=1, seed=74, passo=0.05)})
        for i in range(3):
            CA.alca((a0 + a1) / 2, (fi[i] + fi[i + 1]) / 2 + (0.0 if i else 0.05), y + d - 0.06, 0.1)
        # os painéis almofadados dos lados e de trás (em relevo: aparecem em todos os giros)
        for (b0, b1) in ((y + 0.16, y + d / 2 - 0.05), (y + d / 2 + 0.05, y + d - 0.16)):
            for xs_ in ((a0 - 0.012, a0), (a1, a1 + 0.012)):
                cx((xs_[0], xs_[1], b0, b1, zb + 0.08, zt - 0.08), {'cima': liso('#7a3e22'), '*': mad2('#6a3220', eixo=1, seed=75, passo=0.04)})
        cx((a0 + 0.08, a1 - 0.08, y + 0.048, y + 0.06, zb + 0.08, zt - 0.08), {'cima': liso('#7a3e22'), '*': mad2('#6a3220', eixo=1, seed=76, passo=0.04)})
    # o painel de trás do vão (o vão 'fundo'), com as duas almofadas em relevo
    a0, a1 = x + 0.06 + pw, x + w - 0.06 - pw
    cx((a0, a1, y + 0.08, y + 0.12, zb + 0.06, zt), {'cima': liso('#4a2412'), '*': mad2(JAC, seed=77, passo=0.05)})
    for (u0, u1) in ((a0 + 0.06, (a0 + a1) / 2 - 0.03), ((a0 + a1) / 2 + 0.03, a1 - 0.06)):
        cx((u0, u1, y + 0.065, y + 0.08, zb + 0.14, zt - 0.08), {'cima': liso('#7a3e22'), '*': mad2('#6a3220', eixo=1, seed=78, passo=0.04)})
        cx((u0, u1, y + 0.12, y + 0.135, zb + 0.14, zt - 0.08), {'cima': liso('#7a3e22'), '*': mad2('#6a3220', eixo=1, seed=79, passo=0.04)})
    # a gaveta do meio, embaixo do tampo
    cx((a0, a1, y + d - 0.5, y + d - 0.06, zt - 0.1, zt), {'frente': CA.almofadas(JAC, [(a0 + 0.05, a1 - 0.05, zt - 0.092, zt - 0.008, 'g')], seed=80), '*': mad2(JAC, seed=81)})
    CA.alca((a0 + a1) / 2, zt - 0.05, y + d - 0.06, 0.12)
    peg(x, x + w, y, y + d)
    # o forro de couro verde do tampo, com a beira de couro escuro
    bx0, bx1, by0, by1 = x + 0.7, x + w - 0.7, y + d - 0.85, y + d - 0.15

    def forro(L, n, P):
        X, Y = P[:, 0], P[:, 1]
        out = np.tile(hx('#3e6a4a'), (len(P), 1))
        bd = (X < bx0 + 0.06) | (X > bx1 - 0.06) | (Y < by0 + 0.05) | (Y > by1 - 0.05)
        out = np.where(bd[:, None], hx('#5a2e1a'), out)
        fio = ((X >= bx0 + 0.06) & (X < bx0 + 0.06 + PH)) | ((Y >= by0 + 0.05) & (Y < by0 + 0.05 + PH))
        out = np.where((fio & ~bd)[:, None], hx('#2c4a34'), out)
        out = np.where(((X > bx1 - 0.06 - PH) & (X <= bx1 - 0.06) & ~bd)[:, None], hx('#5a8a64'), out)
        return out
    cx((bx0, bx1, by0, by1, h, h + 0.006), {'cima': emissivo(forro), '*': liso('#3a2014')})
    # os livros (a pilha de couro), as pastas de casos, a luminária verde, o tinteiro e a pena
    zz = h
    for k, (cor, ll) in enumerate((('#5e2422', 0.32), ('#2e4c3c', 0.29), ('#6e4228', 0.3), ('#22304a', 0.26))):
        CA._livro_deitado(x + 0.12 + 0.012 * k, x + 0.12 + 0.012 * k + ll, y + 0.22 + 0.01 * k, y + 0.44 - 0.005 * k, zz, zz + 0.05, cor)
        zz += 0.05
    peq(x + 0.1, x + 0.46, y + 0.2, y + 0.46, h)
    _pasta(x + w - 0.42, y + d - 0.45, h, 0.25, '#c8a46a')
    _pasta(x + w - 0.4, y + d - 0.46, h + 0.03, 0.05, '#b89a5e')
    _pasta(x + w - 0.44, y + d - 0.44, h + 0.06, 0.4, '#d0ae74')
    peq(x + w - 0.62, x + w - 0.22, y + d - 0.65, y + d - 0.25, h)
    _abajur_verde(x + w - 0.45, y + 0.35, h)
    _papeis((bx0 + bx1) / 2 - 0.1, (by0 + by1) / 2 + 0.05, h + 0.006, n=2, seed=31, ang=-0.2)
    ix, iy = (bx0 + bx1) / 2 + 0.32, by1 - 0.2
    o = novo()
    _poligono_rodado(ix, iy, [(h + 0.006, 0.045), (h + 0.05, 0.045), (h + 0.06, 0.025), (h + 0.075, 0.025)], vol(ix, iy, '#2a3448', brilho=0.5), o, lados=14,
                     tampa_mat=liso('#141820'))
    o = novo()
    BE._fita([(-0.01, h + 0.07), (0.03, h + 0.16), (0.05, h + 0.22)], ix, iy, liso('#ece4d0'), o, 0.022)
    peq(ix - 0.045, ix + 0.045, iy - 0.045, iy + 0.045, h + 0.006)


# =====================================================================================================================
# os monitores, os teclados e os computadores
# =====================================================================================================================
def monitor_lcd(cx_, cy_, z, face='+y', larg=0.48, alto=0.3, estilo='azul', ligado=True, seed=0, pe=0.1):
    """
    O monitor de tela plana na base: a base oval, o pescoço, a moldura preta com a quina clara, a tela (acesa ou
    apagada), as costas com a caixa da fonte e o ledzinho. face: para onde a tela olha.
    """
    if face in ('+y', '-y'):
        s = 1 if face == '+y' else -1
        X = lambda a, b: (cx_ + a, cy_ + s * b)
    else:
        s = 1 if face == '+x' else -1
        X = lambda a, b: (cx_ + s * b, cy_ + a)

    def bx(a0, a1, b0, b1, z0, z1, mat, o=None):
        p0, p1 = X(a0, b0), X(a1, b1)
        return cx((min(p0[0], p1[0]), max(p0[0], p1[0]), min(p0[1], p1[1]), max(p0[1], p1[1]), z0, z1), mat, o)
    # a base e o pescoço
    bx(-0.11, 0.11, -0.08, 0.06, z, z + 0.018, metal('#222126', (0, 0, 0, 0, z, z + 0.018), topo='#34333a'))
    bx(-0.03, 0.03, -0.05, -0.02, z + 0.018, z + pe + 0.06, metal('#1e1d22', topo='#34333a'))
    # a moldura e a caixa das costas
    z0, z1 = z + pe, z + pe + alto
    MOL = metal('#1c1b20', (0, 0, 0, 0, z0, z1), topo='#3a3940', quina=1.6)
    o = bx(-larg / 2, larg / 2, -0.0, 0.03, z0, z1, MOL)
    bx(-larg / 2 + 0.06, larg / 2 - 0.06, -0.06, 0.0, z0 + 0.04, z1 - 0.06, metal('#242329', (0, 0, 0, 0, z0 + 0.04, z1 - 0.06), topo='#38373e'))
    # a tela, um pouco à frente da moldura
    m = 0.018
    pl = X(0, 0.031)
    if face in ('+y', '-y'):
        tela(face, pl[1], cx_ - larg / 2 + m, cx_ + larg / 2 - m, z0 + m, z1 - m * 0.8, estilo, ligado, seed)
        a = cx_ + larg / 2 - 0.04
    else:
        tela(face, pl[0], cy_ - larg / 2 + m, cy_ + larg / 2 - m, z0 + m, z1 - m * 0.8, estilo, ligado, seed)
        a = cy_ + larg / 2 - 0.04
    # o ledzinho da moldura
    p = X(larg / 2 - 0.04, 0.031)
    if face in ('+y', '-y'):
        placa(face, p[1] + 0.001 * s, a, a + PH, z0 + 0.002, z0 + 0.002 + PZ, liso('#7af08a' if ligado else '#e0a030'), acesa=True)
    else:
        placa(face, p[0] + 0.001 * s, a, a + PH, z0 + 0.002, z0 + 0.002 + PZ, liso('#7af08a' if ligado else '#e0a030'), acesa=True)


def teclado(x0, x1, y0, y1, z, roxo=True, ligado=True):
    """O teclado: a caixa baixa preta, as teclas em fileiras (blocos de 2 px) e, aceso, o roxo vazando entre elas."""
    def tec(L, n, P):
        if n[2] < 0.5:
            return np.tile(hx('#18171c'), (len(P), 1))
        i = np.floor((P[:, 0] - x0) / PH)
        j = np.floor((P[:, 1] - y0) / PH)
        W, D = (x1 - x0) / PH, (y1 - y0) / PH
        fundo = hx('#8a4ae0') if (roxo and ligado) else hx('#141318')
        out = np.tile(fundo, (len(P), 1))
        tecla = (i % 3 != 2) & (j % 3 != 2) & (i > 0) & (i < W - 1) & (j > 0) & (j < D - 1)
        out = np.where(tecla[:, None], hx('#2a2930'), out)
        out = np.where((tecla & (j % 3 == 0))[:, None], hx('#3a3942'), out)
        return out
    o = novo()
    cx((x0, x1, y0, y1, z, z + 0.025), emissivo(tec), o)
    if roxo and ligado:
        luz(o)
    peq(x0, x1, y0, y1, z)


def mouse(x, y, z, aceso=True):
    o = novo()
    C().elipsoide(np.array([x, y, z + 0.015]), np.array([0.03, 0.045, 0.018]), liso('#222126'), o)
    if aceso:
        placa('+y', y + 0.04, x - PH / 2, x + PH / 2, z + 0.004, z + 0.004 + PZ, liso('#c080ff'), acesa=True)


def gabinete_pc(x0, x1, y0, y1, z0, z1, cor='#1e1d22', ligado=True, frente='+y', roxo=True):
    """O gabinete (a torre): a caixa, a frente com as baias e o botão, a janela lateral com o roxo dentro."""
    pain = []
    cx((x0, x1, y0, y1, z0, z1), {'frente': ventilado(cor, passo=3, larg=0.08, so=(x0 + 0.03, x1 - 0.03, z0 + 0.04, z0 + 0.2), b=(0, 0, 0, 0, z0, z1)),
                                  '*': metal(cor, (0, 0, 0, 0, z0, z1), topo='#34333a')})
    for k in range(2):
        zz = z1 - 0.05 - k * 0.05
        placa('+y', y1 + 0.001, x0 + 0.025, x1 - 0.025, zz, zz + 0.035, metal('#2c2b32'))
    placa('+y', y1 + 0.002, (x0 + x1) / 2 - PH, (x0 + x1) / 2 + PH, z1 - 0.16, z1 - 0.16 + 2 * PZ, liso('#7af0ff' if ligado else '#2a2e30'), acesa=ligado)
    if roxo:
        placa('+x', x1 + 0.001, y0 + 0.06, y1 - 0.06, z0 + 0.08, z1 - 0.06, liso('#6a34c8' if ligado else '#24232a'), acesa=ligado)


def crt(x0, x1, y0, y1, z0, z1, estilo='verde', ligado=True, seed=0, corpo='#cfc6ae', fundo=0.55):
    """
    O monitor de tubo (CRT): a caixa da frente com a moldura funda em volta da tela de quinas redondas, a caixa de
    trás mais estreita (o tubo), os botõezinhos e o led embaixo.
    """
    d = y1 - y0
    yf = y0 + d * (1 - fundo)
    c0 = corpo
    # a frente
    cx((x0, x1, yf, y1, z0, z1), {'frente': metal(c0, (0, 0, 0, 0, z0, z1), quina=1.1), '*': metal(c0, (0, 0, 0, 0, z0, z1), quina=1.1)})
    # o tubo (atrás, mais estreito e mais baixo) com as fendas
    w = x1 - x0
    cx((x0 + w * 0.14, x1 - w * 0.14, y0, yf, z0 + (z1 - z0) * 0.06, z1 - (z1 - z0) * 0.12),
       {'*': ventilado(_hexs(c0, 0.92), passo=4, larg=0.09, so=(-9, 9, z1 - (z1 - z0) * 0.4, z1 - (z1 - z0) * 0.18), b=(0, 0, 0, 0, z0, z1 - (z1 - z0) * 0.12)),
        'cima': metal(_hexs(c0, 0.95))})
    # a moldura funda e a tela
    m = 0.045
    tz0, tz1 = z0 + 0.06, z1 - m
    placa('+y', y1 + 0.001, x0 + m - 0.012, x1 - m + 0.012, tz0 - 0.012, tz1 + 0.012, metal(_hexs(c0, 0.62)))
    tela('+y', y1 + 0.003, x0 + m, x1 - m, tz0, tz1, estilo, ligado, seed, canto=_hexs(c0, 0.62))
    # os botões e o led
    for k in range(3):
        a = x1 - m - 0.02 - k * 0.035
        placa('+y', y1 + 0.002, a, a + 2 * PH, z0 + 0.02, z0 + 0.02 + PZ, liso(_hexs(c0, 0.55)))
    placa('+y', y1 + 0.002, x0 + m, x0 + m + PH, z0 + 0.025, z0 + 0.025 + PZ, liso('#7af08a' if ligado else '#3a3a30'), acesa=ligado)


def monitor(ligado=True):
    """O monitor (0,45 m, no chão da casa: o jogo empilha no tampo): a tela plana na base, acesa ou apagada."""
    monitor_lcd(0.375, 0.42, 0.0, '+y', larg=0.5, alto=0.32, estilo='azul', ligado=ligado, seed=0, pe=0.11)
    peg(0.2, 0.55, 0.3, 0.5)


# =====================================================================================================================
# a mesa em U da Sala de Tecnologia
# =====================================================================================================================
def _cristal(x, y, z, cor='#b07aff', luz_cor='#e8d0ff', k=1.0):
    """O cristal esquisito: três pontas de prisma, a do meio mais alta, brilhando."""
    for (dx, dy, hh, r) in ((0.0, 0.0, 0.14, 0.025), (-0.03, 0.01, 0.08, 0.018), (0.028, -0.012, 0.1, 0.018)):
        o = luz(novo(contorno=False))
        xx, yy = x + dx * k, y + dy * k
        _poligono_rodado(xx, yy, [(z, r * k), (z + hh * k * 0.75, r * k), (z + hh * k, 0.0)],
                         emissivo(lambda L, n, P, xx=xx, yy=yy: np.where((((P[:, 0] - xx) - (P[:, 1] - yy)) > 0)[:, None], hx(cor), hx(luz_cor))), o, lados=6)
    peq(x - 0.05, x + 0.05, y - 0.05, y + 0.05, z)


def _fita_vhs(x, y, z, ang=0.0, cor='#1a191d'):
    o = novo()
    pts = ret_girado(x, y, ang, 0.095, 0.052)

    def m(L, n, P):
        if n[2] > 0.5:
            u = (P[:, 0] - x) * math.cos(ang) + (P[:, 1] - y) * math.sin(ang)
            v = -(P[:, 0] - x) * math.sin(ang) + (P[:, 1] - y) * math.cos(ang)
            out = np.tile(hx(cor), (len(P), 1))
            et = (np.abs(u) < 0.06) & (np.abs(v + 0.01) < 0.022)
            return np.where(et[:, None], hx('#e8e0cc'), out)
        return np.tile(_tom(hx(cor), 1.3), (len(P), 1))
    prisma(pts, z, z + 0.025, emissivo(m), o)


def _fone(x, y, z, cor='#222126', aro='#8a4ae0'):
    """O fone de ouvido deitado no tampo: as duas conchas e o arco."""
    for dx in (-0.08, 0.08):
        o = novo()
        C().cilindro(x + dx, y, 0.045, z, z + 0.035, vol(x + dx, y, cor, brilho=0.3), M, o, lados=14, tampa_mat=liso(aro))
    o = novo()
    pts = [(-0.08 + 0.16 * t / 8, 0.08 * math.sin(math.pi * t / 8)) for t in range(9)]
    for (a, b), (c_, d_) in zip(pts[:-1], pts[1:]):
        haste((x + a, y - b, z + 0.03), (x + c_, y - d_, z + 0.03), 0.018, liso(cor), o, h=0.012)
    peq(x - 0.13, x + 0.13, y - 0.1, y + 0.05, z)


def _lata(x, y, z, cor='#2ad04a', topo='#c8ccd0', deitada=False, ang=0.0):
    def f(P, b):
        zz = P[:, 2] - z
        b = np.where(((zz > 0.035) & (zz < 0.06))[:, None], hx('#101012'), b)
        return np.where((zz > 0.1)[:, None], hx('#a8acb0'), b)
    o = novo()
    if deitada:
        d = np.array([math.cos(ang), math.sin(ang), 0.0]) * 0.06
        cil_eixo((x - d[0], y - d[1], z + 0.033), (x + d[0], y + d[1], z + 0.033), 0.033, liso(cor), o, lados=10, tampa_mat=liso(topo))
    else:
        C().cilindro(x, y, 0.033, z, z + 0.12, vol(x, y, cor, brilho=0.5, faixas=f), M, o, lados=12, tampa_mat=liso(topo))
        peq(x - 0.035, x + 0.035, y - 0.035, y + 0.035, z)


def _posto(face, xs, y, z, estilos, seeds, eixo_y=False):
    """Os três monitores de um posto, lado a lado (x ou y, a tela para `face`)."""
    for k, (a, est, sd) in enumerate(zip(xs, estilos, seeds)):
        if eixo_y:
            monitor_lcd(y, a, z, face, larg=0.5, alto=0.3, estilo=est, ligado=True, seed=sd, pe=0.1)
        else:
            monitor_lcd(a, y, z, face, larg=0.5, alto=0.3, estilo=est, ligado=True, seed=sd, pe=0.1)


def desk_u():
    """
    A mesa em U da Sala de Tecnologia (6 x 4 casas; 0,78 m): o fundo e os dois braços (as casas do meio e a entrada,
    `vazio`, ficam livres), o tampo de fórmica cinza-escuro com a borda de alumínio, os painéis de fechamento por fora
    e os pés; três postos com três monitores cada (olhando para dentro do U), os teclados acesos de roxo, os mouses,
    os fones, as fitas, as latas de energético, os cristais esquisitos no meio das pastas e as torres embaixo.
    """
    W, D = 6 * CASA, 4 * CASA
    h = 1.27 / UN
    tp = 0.04
    pr = 0.68                         # o fundo de cada braço do tampo
    COR = '#2e2d33'

    def formica(L, n, P):
        out = np.tile(hx('#4a4852'), (len(P), 1))
        s = suave(np.floor(P[:, 0] / PH) * PH, np.floor(P[:, 1] / PH) * PH, 0.4, 41)
        return np.where((s > 0.7)[:, None], hx('#504e58'), out)
    TOPO = {'cima': emissivo(formica), '*': metal('#8a8c94', (0, 0, 0, 0, h - tp, h), quina=1.25)}
    m = 0.04
    # os três tampos: o fundo (inteiro) e os braços
    cx((m, W - m, m, m + pr, h - tp, h), TOPO)
    cx((m, m + pr, m + pr, D - m, h - tp, h), TOPO)
    cx((W - m - pr, W - m, m + pr, D - m, h - tp, h), TOPO)
    # os painéis de fechamento por fora (o fundo e os dois lados de fora) e as cabeceiras dos braços
    PAIN = metal(COR, (0, 0, 0, 0, 0, h - tp), topo='#3a3940')
    cx((m + 0.02, W - m - 0.02, m + 0.02, m + 0.05, 0.04, h - tp), PAIN)
    cx((m + 0.02, m + 0.05, m + 0.05, D - m - 0.02, 0.04, h - tp), PAIN)
    cx((W - m - 0.05, W - m - 0.02, m + 0.05, D - m - 0.02, 0.04, h - tp), PAIN)
    for (a0, a1) in ((m + 0.02, m + pr - 0.02), (W - m - pr + 0.02, W - m - 0.02)):
        cx((a0, a1, D - m - 0.05, D - m - 0.02, 0.04, h - tp), PAIN)
    # as sapatas
    for (a, b) in ((m + 0.02, m + 0.02), (W - m - 0.08, m + 0.02), (m + 0.02, D - m - 0.08), (W - m - 0.08, D - m - 0.08),
                   (m + pr - 0.08, D - m - 0.08), (W - m - pr + 0.02, D - m - 0.08)):
        cx((a, a + 0.06, b, b + 0.06, 0.0, 0.04), metal('#18171c'))
    peg(m, W - m, m, m + pr)
    peg(m, m + pr, m + pr, D - m)
    peg(W - m - pr, W - m, m + pr, D - m)
    # as torres embaixo (uma por posto, encostadas no painel de fora)
    gabinete_pc(m + 0.08, m + 0.3, m + 0.08, m + 0.55, 0.0, 0.5)
    gabinete_pc(W / 2 + 0.6, W / 2 + 0.82, m + 0.08, m + 0.55, 0.0, 0.5)
    gabinete_pc(W - m - 0.3, W - m - 0.08, D - m - 0.62, D - m - 0.15, 0.0, 0.5)
    # o posto do fundo (olha para +y)
    _posto('+y', (W / 2 - 0.62, W / 2, W / 2 + 0.62), m + 0.2, h, ('roxo', 'azul', 'ciano'), (0, 2, 1))
    teclado(W / 2 - 0.24, W / 2 + 0.24, m + 0.44, m + 0.6, h)
    mouse(W / 2 + 0.36, m + 0.52, h)
    _fone(W / 2 - 0.95, m + 0.45, h)
    _lata(W / 2 + 1.05, m + 0.5, h, '#2ad04a')
    _lata(W / 2 + 1.16, m + 0.42, h, '#a040e0')
    _fita_vhs(W / 2 - 1.5, m + 0.4, h, 0.2)
    _fita_vhs(W / 2 - 1.48, m + 0.42, h + 0.025, -0.1, '#26252a')
    # o posto da esquerda (olha para +x)
    ys = (D / 2 + 0.05, D / 2 + 0.67, D / 2 + 1.29)
    _posto('+x', ys, m + 0.2, h, ('azul', 'verde', 'roxo'), (3, 0, 2), eixo_y=True)
    o_ = None
    teclado(m + 0.42, m + 0.58, ys[1] - 0.24, ys[1] + 0.24, h)
    mouse(m + 0.5, ys[1] + 0.38, h)
    _pasta(m + 0.4, ys[0] - 0.62, h, 1.4, '#c8a46a')
    _pasta(m + 0.41, ys[0] - 0.6, h + 0.03, 1.7, '#b0b8c8')
    _cristal(m + 0.42, ys[0] - 0.38, h, '#7a5ae0', '#d8c8ff')
    _cristal(m + 0.3, ys[0] - 0.3, h, '#4ac8d8', '#c8f8ff', k=0.7)
    _lata(m + 0.52, ys[2] + 0.1, h, '#e0d020')
    _lata(m + 0.5, ys[2] - 0.2, h, '#3ad060', deitada=True, ang=1.2)
    # o posto da direita (olha para -x)
    _posto('-x', ys, W - m - 0.2, h, ('ciano', 'roxo', 'azul'), (1, 3, 0), eixo_y=True)
    teclado(W - m - 0.58, W - m - 0.42, ys[1] - 0.24, ys[1] + 0.24, h)
    mouse(W - m - 0.5, ys[1] - 0.38, h)
    _fone(W - m - 0.45, ys[0] - 0.35, h)
    _papeis(W - m - 0.42, ys[0] - 0.5, h, n=3, seed=41, ang=0.6)
    _cristal(W - m - 0.3, ys[0] - 0.75, h, '#b07aff', '#f0e0ff', k=0.8)
    # a fita de led roxa embaixo da borda de dentro do U
    zl = h - tp - 2 * PZ
    placa('+y', m + pr + 0.001, m + pr, W - m - pr, zl, zl + 2 * PZ, liso('#a46af8'), acesa=True)
    placa('+x', m + pr + 0.001, m + pr, D - m, zl, zl + 2 * PZ, liso('#a46af8'), acesa=True)
    placa('-x', W - m - pr - 0.001, m + pr, D - m, zl, zl + 2 * PZ, liso('#a46af8'), acesa=True)


# =====================================================================================================================
# as estantes e os racks
# =====================================================================================================================
def shelf_verissimo():
    """
    A estante do Veríssimo (6 casas, 2,6 m): a parede inteira de jacarandá em três vãos, o armário de portas
    almofadadas embaixo, cinco prateleiras de livros de couro, as pastas da Ordem, o globo, a caixa das chaves antigas
    e, dobrado num canto, o pedaço de capuz amarelo; a cimalha em cima.
    """
    x0, x1 = 0.03, 4.47
    fundo = 0.5
    h = 4.25 / UN
    zb = 0.78                                   # o alto do armário de baixo
    prat = (zb, 1.12, 1.46, 1.8, 2.14)
    ztopo = h - 0.12
    cols = np.linspace(x0, x1, 4)
    LADO = mad2(JAC, eixo=1, seed=41, passo=0.06)
    FRENTE = mad2('#7a3e22', eixo=1, seed=43, passo=0.03)
    DENTRO = mad2('#3a1c10', eixo=1, seed=44, passo=0.07, claro=1.06, escuro=0.94)

    def fundo_m(L, n, P):
        g = (P[:, 0] - x0) % 0.18
        out = np.tile(hx('#2e160c'), (len(P), 1))
        out = np.where((g < PH)[:, None], hx('#24100a'), out)
        for z in prat[1:] + (ztopo,):
            out = np.where(((P[:, 2] < z) & (P[:, 2] > z - 0.06))[:, None], out * 0.78, out)
        return out
    COSTAS = tab2(CA.PINHO, 0.16, '#6a4426', eixo=1, seed=49)
    cx((x0, x1, 0.02, 0.05, 0, h), {'frente': emissivo(fundo_m), 'costas': COSTAS, '*': LADO})
    # os montantes (os dois de fora e os dois do meio)
    for i, xc in enumerate(cols):
        a0 = xc if i == 0 else (xc - 0.07 if i == 3 else xc - 0.035)
        a1 = a0 + 0.07
        cx((a0, a1, 0.02, fundo, 0, h), {'cima': liso('#7a3e22'), 'frente': FRENTE, 'dir': DENTRO, 'esq': DENTRO, '*': LADO})
    # o armário de baixo: as portas almofadadas de cada vão, o rodapé e o tampo saliente
    for i in range(3):
        a0 = cols[i] + (0.07 if i == 0 else 0.035)
        a1 = cols[i + 1] - (0.07 if i == 2 else 0.035)
        mid = (a0 + a1) / 2
        pain = [(a0 + 0.03, mid - 0.006, 0.16, zb - 0.06, 'p'), (mid + 0.006, a1 - 0.03, 0.16, zb - 0.06, 'p')]
        cx((a0, a1, fundo - 0.06, fundo - 0.02, 0.1, zb - 0.03), {'frente': CA.almofadas(JAC, pain, eixo=1, seed=50 + i, passo=0.05), '*': mad2(JAC, seed=51)})
        for xx in (mid - 0.04, mid + 0.04):
            _barra((xx - PH, xx + PH, fundo - 0.02, fundo, 0.42, 0.52), LATAO, LATAO_L, quina=False)
    cx((x0 + 0.02, x1 - 0.02, 0.05, fundo, 0.0, 0.1), _pau('#3e1c0e', quina=1.2, b=(0, 0, 0, 0, 0, 0.1)))
    cx((x0 - 0.02, x1 + 0.02, 0.02, fundo + 0.04, zb - 0.03, zb + 0.02), {'cima': tab2(CA.JAC_TAB, 0.2, '#3a1a0c', seed=52, org=0.02),
                                                                      '*': _pau('#7a3e22', quina=1.25, b=(0, 0, 0, 0, zb - 0.03, zb + 0.02))})

    def prateleira(a0, a1, zp):
        def topo(L, n, P):
            out = np.tile(hx('#8a4a2a'), (len(P), 1))
            yy = P[:, 1]
            out = np.where((yy < fundo - 0.14)[:, None], _tom(out, 0.78), out)
            out = np.where((yy < fundo - 0.28)[:, None], _tom(hx('#8a4a2a'), 0.62), out)
            return np.where((yy > fundo - PH)[:, None], _tom(hx('#8a4a2a'), 1.14), out)
        cx((a0, a1, 0.05, fundo, zp, zp + 0.035), {'cima': emissivo(topo), '*': mad2('#7a3e22', eixo=0, seed=46, passo=0.03)})
    yb0, yb1 = 0.11, fundo - 0.02
    for i in range(3):
        a0 = cols[i] + (0.07 if i == 0 else 0.035)
        a1 = cols[i + 1] - (0.07 if i == 2 else 0.035)
        for k, z in enumerate(prat):
            if k > 0:
                prateleira(a0, a1, z)
            zz = z + (0.035 if k > 0 else 0.02)
            teto = prat[k + 1] if k + 1 < len(prat) else ztopo
            BE._VAO['teto'] = teto
            alto = min(0.3, (teto - zz) * 0.86)
            sd = 17 + i * 7 + k * 3
            _prateleira_verissimo(i, k, a0, a1, yb0, yb1, zz, alto, sd)
        BE._VAO['teto'] = None
    # a cimalha
    cx((x0 - 0.04, x1 + 0.04, 0.02, fundo + 0.05, ztopo + 0.05, h), {'cima': tab2(CA.JAC_TAB, 0.2, '#3a1a0c', seed=47, org=0.02),
                                                                 '*': _pau('#7a3e22', quina=1.25, b=(0, 0, 0, 0, ztopo + 0.05, h))})
    cx((x0 - 0.015, x1 + 0.015, 0.02, fundo + 0.02, ztopo, ztopo + 0.05), _pau('#5a2a16', quina=1.2, b=(0, 0, 0, 0, ztopo, ztopo + 0.05)))
    peg(x0, x1, 0.02, fundo)


COURO_CORES = ['#5e2422', '#2e4c3c', '#6e4228', '#22304a', '#4a2a1c', '#7a2a24', '#3a3020', '#5a3446']
PASTA_CORES = ['#3a4a6a', '#3a4a6a', '#6a2a24', '#2e3e2e']


def _lombadas(x, x1, yb0, yb1, z, alto, seed, n, cores, tomba=False):
    """A fileira de livros com as cores dadas (o couro, as pastas da Ordem): as faixas douradas da lombada."""
    for k in range(n):
        ww = round((0.045 + 0.035 * ruido(k, seed + 3)) / PH) * PH
        if x + ww > x1:
            break
        cor = cores[int(ruido(seed, k, 5.1) * len(cores))]
        hh = alto * (0.78 + 0.2 * ruido(k, seed + 2))
        yy1 = yb1 - 0.03 * ruido(k, seed + 8)
        o = novo()
        C().caixa((x, x + ww, yb0, yy1, z, z + hh), _lombada_couro(cor, x, z, hh, ww, int(seed * 31 + k * 7), ymax=yy1, hmin=yb0), M, o)
        x += ww
    if tomba and x < x1 - 0.12:
        cor = cores[int(ruido(seed, 12.7) * len(cores))]
        hh = alto * 0.84
        ang = math.radians(16 + 8 * ruido(seed, 13.3))
        xl = x + hh * math.sin(ang) + 0.004
        x = CA._livro_inclinado(xl, z, 2 * PH, hh, yb0, yb1 - 0.01, ang, cor, int(seed * 13))
    return x


def _lombada_couro(cor, x0, z0, alto, larg, seed, ymax=None, hmin=None):
    """O livro de couro em pé: as nervuras e as faixas douradas na lombada (sem letra), o topo das folhas, a capa."""
    c0 = hx(cor)
    ouro = hx('#c8a050')
    est = int(ruido(seed, 3.3) * 3)

    def f(L, n, P):
        v = P[:, 2] - z0
        u = P[:, 0] - x0
        out = np.tile(c0, (len(P), 1))
        nn = np.asarray(n, float)
        if nn[1] > 0.5:
            band = lambda vv, k=1: (v >= vv) & (v < vv + k * PZ)
            if est == 0:
                out = np.where((band(alto * 0.12) | band(alto * 0.85))[:, None], ouro, out)
                out = np.where(band(alto * 0.5, 2)[:, None], _tom(c0, 0.6), out)
            elif est == 1:
                for t in (0.22, 0.42, 0.62, 0.82):
                    out = np.where(band(alto * t)[:, None], _tom(c0, 1.35), out)
            else:
                out = np.where((band(alto * 0.7, 3))[:, None], _tom(c0, 0.62), out)
                out = np.where((band(alto * 0.7, 3) & (u > PH) & (u < larg - PH))[:, None], ouro, out)
            out = np.where((u < PH)[:, None], _tom(out, 1.14), out)
        elif nn[2] > 0.5:
            out = np.tile(hx('#d8c8a0'), (len(P), 1))
            out = np.where(((u < PH) | (u > larg - PH))[:, None], c0, out)
        else:
            out = _tom(out, 0.85)
        return BE._vao(out, P)
    return emissivo(f)


def _globo(x, y, z):
    """O globo terrestre no pé de latão: a bola azul-petróleo com os continentes cor de pergaminho, o meridiano."""
    o = novo()
    _poligono_rodado(x, y, [(z, 0.07), (z + 0.02, 0.07), (z + 0.03, 0.03), (z + 0.07, 0.018)], vol(x, y, LATAO, brilho=0.5), o, lados=16)
    r = 0.125
    zc = z + 0.07 + r

    def m(L, n, P):
        a = np.arctan2(P[:, 1] - y, P[:, 0] - x)
        b = (P[:, 2] - zc) / r
        t = suave(np.floor(a / 0.25) * 0.25 * 0.3, np.floor(b / 0.2) * 0.2, 0.18, 5)
        return np.where((t > 0.55)[:, None], hx('#d8c08a'), hx('#2e5a6a'))
    o = novo()
    C().elipsoide(np.array([x, y, zc]), np.array([r, r, r]), emissivo(m), o)
    o = novo()
    BE._fita([(-r - 0.02, zc - 0.06), (-r - 0.02, zc + 0.05), (-0.06, zc + r + 0.015), (0.06, zc + r + 0.015), (r + 0.02, zc + 0.05), (r + 0.02, zc - 0.06)],
             x, y, liso(LATAO), o, 0.018)


def _capuz(x0, x1, y0, y1, z):
    """O pedaço de capuz amarelo dobrado: o pano em duas dobras, a beira mais escura, a costura."""
    R = _p1_rampa(['#4a3a08', '#6a520c', '#8a6c10', '#a88616', '#c49e20', '#d8b42c', '#e6c840', '#f0da5c', '#f6e880', '#faf2a8'])
    b = (x0, x1, y0, y1, z, z + 0.06)
    malha(b, (0.03, 0.03, 0.01, 0.03), estofado(R, b, 2.4, 7.2, cupula=0.6))
    b = (x0 + 0.03, x1 - 0.06, y0 + 0.02, y1 - 0.03, z + 0.06, z + 0.1)
    malha(b, (0.03, 0.03, 0.01, 0.025), estofado(R, b, 2.8, 7.6, cupula=0.6))


def _chaves(x, y, z):
    """A caixinha das chaves antigas: a caixa de madeira aberta e as chaves de ferro grandes no tampo."""
    CA._caixinha(x, x + 0.18, y, y + 0.14, z, z + 0.08, cor='#5a2e1a')
    for k in range(3):
        o = novo()
        a = 0.4 + 0.6 * k
        prisma(ret_girado(x + 0.08 + 0.025 * k, y + 0.07, a, 0.06, PH * 0.8), z + 0.08, z + 0.08 + PZ, liso('#6a6a68' if k != 1 else LATAO), o)
        o = novo()
        C().cilindro(x + 0.08 + 0.025 * k + 0.06 * math.cos(a), y + 0.07 + 0.06 * math.sin(a), 0.016, z + 0.08, z + 0.08 + PZ,
                     liso('#7a7a76' if k != 1 else LATAO_L), M, o, lados=8)


def _prateleira_verissimo(i, k, a0, a1, yb0, yb1, z, alto, sd):
    """O que vai em cada prateleira (vão i, fileira k): os livros de couro, as pastas, o globo, as chaves, o capuz."""
    x = a0 + 0.03
    if (i, k) == (0, 0):
        _globo(a0 + 0.25, (yb0 + yb1) / 2, z)
        x = a0 + 0.45
        x = _lombadas(x, a1 - 0.03, yb0, yb1, z, alto, sd, 14, COURO_CORES, tomba=True)
        return
    if (i, k) == (2, 1):
        x = _lombadas(x, a1 - 0.45, yb0, yb1, z, alto, sd, 12, COURO_CORES)
        _chaves(a1 - 0.3, yb0 + 0.12, z)
        return
    if (i, k) == (2, 4):
        x = _lombadas(x, a1 - 0.5, yb0, yb1, z, alto, sd, 12, COURO_CORES, tomba=True)
        _capuz(a1 - 0.36, a1 - 0.06, yb0 + 0.08, yb1 - 0.02, z)
        return
    if (i, k) in ((1, 2), (0, 3)):
        # as pastas da Ordem (as lombadas largas de cartão, a etiqueta em branco)
        x = _pastas_ordem(x, a1 - 0.03, yb0, yb1, z, alto, sd)
        return
    if (i + k) % 3 == 0:
        x = _lombadas(x, a1 - 0.3, yb0, yb1, z, alto, sd, 12, COURO_CORES)
        CA._pilha(x + 0.02, 0.24, yb0 + 0.02, yb1, z, sd, 3)
        return
    _lombadas(x, a1 - 0.03, yb0, yb1, z, alto, sd, 18, COURO_CORES, tomba=(k % 2 == 1))


def _pastas_ordem(x, x1, yb0, yb1, z, alto, seed):
    while x + 0.08 < x1:
        cor = PASTA_CORES[int(ruido(seed, x * 10) * len(PASTA_CORES))]
        ww = 0.07
        hh = alto * 0.95
        c0 = hx(cor)

        def f(L, n, P, x_=x, c0=c0, hh=hh):
            out = np.tile(c0, (len(P), 1))
            if n[1] > 0.5:
                v = P[:, 2] - z
                u = P[:, 0] - x_
                et = (u > 2 * PH) & (u < ww - 2 * PH) & (v > hh * 0.55) & (v < hh * 0.8)
                out = np.where(et[:, None], hx('#ece4cc'), out)
                fu = (np.abs(u - ww / 2) < PH) & (np.abs(v - hh * 0.25) < 1.5 * PZ)
                out = np.where(fu[:, None], hx('#141010'), out)
                out = np.where((u < PH)[:, None], _tom(out, 1.14), out)
            elif n[2] > 0.5:
                out = np.where(((P[:, 0] - x_ > PH) & (P[:, 0] - x_ < ww - PH))[:, None], hx('#e6dcc0'), _tom(c0, 1.2))
            else:
                out = _tom(out, 0.85)
            return BE._vao(out, P)
        o = novo()
        C().caixa((x, x + ww, yb0, yb1 - 0.01, z, z + hh), emissivo(f), M, o)
        x += ww
    return x


def media_shelf():
    """
    A estante de mídias (2 casas, 1,1 m): a estante de aço cinza-claro de três prateleiras com os montantes furados,
    as fitas VHS em pé (as etiquetas brancas), as caixas de disquete, as fitas cassete e as caixas de papelão.
    """
    x0, x1 = 0.04, 1.46
    y0, y1 = 0.12, 0.6
    h = 1.8 / UN
    COR = '#a8aaa4'
    pr = (0.08, 0.42, 0.76, h - 0.03)

    def furado(L, n, P):
        out = np.tile(hx(COR), (len(P), 1))
        if n[2] > 0.5:
            return np.tile(hx('#c4c6c0'), (len(P), 1))
        fz = np.floor(P[:, 2] / PZ) % 4 == 0
        a = P[:, 0] if abs(n[1]) >= abs(n[0]) else P[:, 1]
        meio = np.abs(((a / PH) % 1.0)) >= 0
        return np.where((fz & meio)[:, None], hx('#56585a'), out)
    for xx in (x0, x1 - 0.035):
        for yy in (y0, y1 - 0.035):
            cx((xx, xx + 0.035, yy, yy + 0.035, 0.0, h), {'cima': liso('#c4c6c0'), '*': emissivo(furado)})
    for z in pr:
        cx((x0, x1, y0, y1, z, z + 0.03), {'cima': liso('#b8bab4'), '*': metal('#9a9c96', (0, 0, 0, 0, z, z + 0.03), quina=1.25)})
    # o X de trás (as duas diagonais de reforço)
    o = novo()
    haste((x0 + 0.03, y0 + 0.01, 0.1), (x1 - 0.03, y0 + 0.01, pr[2]), 0.02, liso('#8a8c86'), o, h=0.008)
    haste((x1 - 0.03, y0 + 0.01, 0.1), (x0 + 0.03, y0 + 0.01, pr[2]), 0.02, liso('#8a8c86'), o, h=0.008)
    # as fitas VHS em pé (a lombada preta com a etiqueta branca)
    def vhs(x, z, cor='#1a191d', n=10, alto=0.19):
        for k in range(n):
            c0 = hx(cor if ruido(k, x) > 0.2 else '#2a2830')

            def f(L, n_, P, xx=x, c0=c0, k=k):
                out = np.tile(c0, (len(P), 1))
                if n_[1] > 0.5:
                    v = P[:, 2] - z
                    et = (v > alto * 0.25) & (v < alto * 0.8) & (P[:, 0] - xx > PH * 0.5)
                    out = np.where(et[:, None], hx('#e8e2d0' if ruido(k, xx, 1.1) > 0.3 else '#e0c050'), out)
                    out = np.where((et & (np.abs(P[:, 2] - z - alto * 0.5) < PZ * 0.5))[:, None], hx('#a8a498'), out)
                elif n_[2] > 0.5:
                    out = _tom(c0, 1.5)
                return out
            o = novo()
            C().caixa((x, x + 0.03, y0 + 0.08, y0 + 0.08 + 0.36 - 0.02 * ruido(k, x, 2.2), z, z + alto), emissivo(f), M, o)
            x += 0.032
        return x
    z1 = pr[0] + 0.03
    xx = vhs(x0 + 0.06, z1, n=12)
    # as caixas de papelão
    caixa_papelao(xx + 0.06, x1 - 0.06, y0 + 0.06, y1 - 0.04, z1, z1 + 0.26, aberta=False, seed=2)
    z2 = pr[1] + 0.03
    xx = vhs(x0 + 0.06, z2, n=7)
    # as caixas de disquete (as tampas de acrílico fumê com os disquetes coloridos dentro)
    for k, cor in enumerate(('#2a4ab8', '#c83a2a', '#1a191d')):
        a = xx + 0.05 + k * 0.17
        cx((a, a + 0.14, y0 + 0.12, y1 - 0.08, z2, z2 + 0.11), {'cima': liso('#5a5660'), '*': metal('#3a3640', (0, 0, 0, 0, z2, z2 + 0.11))})
        for j in range(4):
            placa('+y', y1 - 0.079, a + 0.012 + j * 0.032, a + 0.012 + j * 0.032 + 0.024, z2 + 0.03, z2 + 0.1, liso(cor if j % 2 == 0 else '#d8d4c8'))
    xx += 0.6
    vhs(xx, z2, cor='#26252a', n=5)
    z3 = pr[2] + 0.03
    # as fitas cassete deitadas em pilha e as fitas VHS deitadas
    for k in range(4):
        cx((x0 + 0.08, x0 + 0.08 + 0.11, y0 + 0.14, y0 + 0.21, z3 + k * 0.018, z3 + (k + 1) * 0.018),
           {'cima': emissivo(lambda L, n, P: np.where((np.abs(P[:, 0] - (x0 + 0.135)) < 0.035)[:, None], hx('#e8e0c8'), hx('#c8c4bc'))),
            '*': liso('#2a2830' if k % 2 else '#7a3a8a')})
    for k in range(3):
        _fita_vhs(x0 + 0.45, (y0 + y1) / 2, z3 + k * 0.025, 0.06 * k - 0.05)
    caixa_papelao(x1 - 0.55, x1 - 0.08, y0 + 0.06, y1 - 0.04, z3, z3 + 0.2, aberta=True, seed=5, abas=False)
    peg(x0, x1, y0, y1)


PAPELAO = '#b48a58'


def caixa_papelao(x0, x1, y0, y1, z0, z1, aberta=False, seed=0, abas=True):
    """A caixa de papelão: o pardo com a fita adesiva clara no meio, as abas abertas para fora (se aberta)."""
    c0 = hx(PAPELAO)
    xm = (x0 + x1) / 2

    def f(L, n, P):
        out = np.tile(c0, (len(P), 1))
        if n[2] > 0.5:
            out = _tom(c0, 1.1)
            if not aberta:
                out = np.where((np.abs(P[:, 0] - xm) < 0.025)[:, None], hx('#d8c49a'), out)
                out = np.where((np.abs(P[:, 0] - xm) < PH * 0.5)[:, None], _tom(c0, 0.8), out)
            return out
        zz = z1 - P[:, 2]
        if not aberta:
            out = np.where((zz < 0.06)[:, None] & (np.abs((P[:, 0] if abs(n[1]) >= abs(n[0]) else P[:, 1]) - (xm if abs(n[1]) >= abs(n[0]) else (y0 + y1) / 2)) < 0.025)[:, None],
                           hx('#d8c49a'), out)
        # a dobra e as manchas (blocos de 2 px)
        s = suave(np.floor(P[:, 0] / (2 * PH)), np.floor(P[:, 2] / (2 * PZ)) + np.floor(P[:, 1] / (2 * PH)), 3.0, seed)
        out = np.where((s > 0.75)[:, None], _tom(c0, 0.92), out)
        return out
    o = novo()
    if aberta:
        def dentro(L, n, P):
            return np.tile(_tom(c0, 0.55), (len(P), 1))
        C().caixa((x0, x1, y0, y1, z0, z1), {'cima': emissivo(dentro), '*': emissivo(f)}, M, o)
        if abas:
            # as abas: placas finas inclinadas para fora nas bordas da frente e de trás
            for (yy, s) in ((y1, 1), (y0, -1)):
                oa = novo()
                fl = 0.09
                C().face_plana([(x0 + 0.01, yy, z1), (x1 - 0.01, yy, z1), (x1 - 0.01, yy + s * fl * 0.6, z1 + fl * 0.75), (x0 + 0.01, yy + s * fl * 0.6, z1 + fl * 0.75)],
                               (0, s * 0.78, -0.6 * s * 0 + 0.62), emissivo(lambda L, n, P: np.tile(_tom(c0, 1.05), (len(P), 1))), M, oa, dois_lados=True)
    else:
        C().caixa((x0, x1, y0, y1, z0, z1), emissivo(f), M, o)
    return o


def server_rack(moderno=False):
    """
    O rack de servidores (2 m): o armário de aço com as colunas furadas, os servidores empilhados (as gavetas de 1U e
    2U com as baias de disco, os ledzinhos verdes e âmbar piscando), o switch com os cabos coloridos, o teto ventilado.
    """
    x0, x1 = 0.1, 0.65
    y0, y1 = 0.05, 0.7
    h = 3.27 / UN
    COR = '#3a3c40'
    # o armário: os lados, o teto, a base
    LAT = ventilado(COR, passo=4, larg=0.12, so=(y0 + 0.1, y1 - 0.1, h - 0.5, h - 0.15), b=(0, 0, 0, 0, 0, h))
    cx((x0, x0 + 0.03, y0, y1, 0.04, h), {'cima': liso('#5a5c62'), '*': LAT})
    cx((x1 - 0.03, x1, y0, y1, 0.04, h), {'cima': liso('#5a5c62'), '*': LAT})
    cx((x0, x1, y0, y0 + 0.03, 0.04, h), metal(COR, (0, 0, 0, 0, 0.04, h)))
    cx((x0, x1, y0, y1, h - 0.04, h), {'cima': ventilado('#4a4c52', passo=3, larg=0.1), '*': metal('#4a4c52', (0, 0, 0, 0, h - 0.04, h))})
    cx((x0, x1, y0, y1, 0.0, 0.06), metal('#26282c', (0, 0, 0, 0, 0, 0.06)))
    # as colunas da frente (os trilhos com os furos)
    for (a0, a1) in ((x0 + 0.03, x0 + 0.06), (x1 - 0.06, x1 - 0.03)):
        cx((a0, a1, y1 - 0.06, y1 - 0.02, 0.06, h - 0.04),
           emissivo(lambda L, n, P: np.where((np.floor(P[:, 2] / PZ) % 3 == 0)[:, None], hx('#18191c'), hx('#5a5c62'))))
    # o fundo escuro dentro
    cx((x0 + 0.03, x1 - 0.03, y0 + 0.03, y0 + 0.05, 0.06, h - 0.04), liso('#121315'))
    # os servidores
    z = 0.12
    k = 0
    unidades = (2, 1, 1, 2, 3, 1, 1, 2, 1, 2, 1, 1, 2)
    for u in unidades:
        zz1 = z + u * 0.085
        if zz1 > h - 0.12:
            break
        _servidor(x0 + 0.06, x1 - 0.06, y0 + 0.1, y1 - 0.04, z + 0.003, zz1 - 0.003, k, moderno)
        z = zz1
        k += 1
    peg(x0, x1, y0, y1)


def _servidor(x0, x1, y0, y1, z0, z1, k, moderno=False):
    tipo = int(ruido(k, 4.4) * 4)
    cores = ('#2a2c30', '#3e4046', '#c8c4b4', '#24262a') if not moderno else ('#1a1b1f', '#222328', '#1e1f24', '#26272c')
    cor = cores[tipo % len(cores)]
    c0 = hx(cor)
    alto = z1 - z0

    def f(L, n, P):
        out = np.tile(c0, (len(P), 1))
        if n[1] < 0.5:
            return out
        u = P[:, 0] - x0
        v = P[:, 2] - z0
        if tipo in (0, 3) and alto > 0.1:
            # as baias de disco: fileira de retângulos com a fresta
            i = np.floor(u / 0.05)
            g = u - i * 0.05
            baia = (u > 0.08) & (u < (x1 - x0) - 0.03) & (v > 0.012) & (v < alto - 0.012)
            out = np.where((baia & (g < PH))[:, None], _tom(c0, 0.5), out)
            out = np.where((baia & (g >= PH) & (g < 2 * PH))[:, None], _tom(c0, 1.25), out)
        else:
            vent = (np.floor(v / PZ) % 2 == 0) & (u > (x1 - x0) * 0.45) & (u < (x1 - x0) - 0.04) & (v > PZ) & (v < alto - PZ)
            out = np.where(vent[:, None], _tom(c0, 0.55), out)
        out = np.where((v > alto - PZ)[:, None], _tom(c0, 1.2), out)
        out = np.where((v < PZ)[:, None], _tom(c0, 0.6), out)
        return out
    cx((x0, x1, y0, y1, z0, z1), {'frente': emissivo(f), '*': metal(cor, (0, 0, 0, 0, z0, z1))})
    # os ledzinhos (verdes, um âmbar, um azul nos modernos)
    pos = [x0 + 0.015 + 3 * PH * j for j in range(3)]
    cs = ['#5af07a', '#5af07a', '#ffb43a'] if not moderno else ['#5ab8ff', '#5ab8ff', '#b07aff']
    if ruido(k, 9.1) > 0.6:
        cs = cs[::-1]
    leds('+y', y1 + 0.001, pos, z0 + (z1 - z0) / 2 - PZ / 2, cs, True)


def rack_moderno(vazio=False):
    """
    O rack de servidores moderno (1 x 2 casas, 2 m): o armário preto fundo, a porta de malha perfurada (as fileiras de
    furos em riscas), por trás dela os servidores com os leds azuis e roxos, a faixa de luz no alto e o teto ventilado.
    vazio: a gêmea esvaziada (rack_moderno!vazio): os servidores foram levados, pela malha só o fundo escuro; a faixa
    de luz e o painelzinho da porta continuam (são do armário).
    """
    x0, x1 = 0.08, 0.67
    y0, y1 = 0.05, 1.45
    h = 3.27 / UN
    COR = '#24252b'
    cx((x0, x1, y0, y1, 0.0, h), {'frente': metal(COR, (0, 0, 0, 0, 0, h)), 'cima': ventilado('#2a2b31', passo=3, larg=0.12),
                                  '*': ventilado(COR, passo=5, larg=0.2, so=(y0 + 0.15, y1 - 0.15, 0.25, h - 0.25), b=(0, 0, 0, 0, 0, h))})
    # a porta de malha: a moldura e a malha (riscas de furos), com os leds aparecendo
    yf = y1 + 0.004
    zm0, zm1 = 0.1, h - 0.14

    def malha_m(L, n, P):
        u = (P[:, 0] - (x0 + 0.05)) / PH
        v = (zm1 - P[:, 2]) / PZ
        Wm = (x1 - x0 - 0.1) / PH
        out = np.tile(hx('#3a3b44'), (len(P), 1))
        # as fendas da malha: riscas de 1 px a cada 2, em pedaços de 5 px
        fen = (np.floor(v) % 2 == 0) & (np.floor(u) % 6 != 5) & (u >= 1) & (u < Wm - 1)
        out = np.where(fen[:, None], hx('#0c0d10'), out)
        # os servidores por trás (uma faixa a cada 6 px) e os leds na ponta esquerda de cada um
        fila = np.floor(v / 6)
        g = v - fila * 6
        tem = (ruido(fila, 2.7) > 0.06) & (not vazio)
        bez = tem & (np.floor(g) == 4) & (u >= 1) & (u < Wm - 1)
        out = np.where((bez & fen)[:, None], hx('#26303e'), out)
        led = tem & fen & (((u >= 2) & (u < 3 + np.floor(ruido(fila, 4.1) * 4)) & (np.floor(g) == 2)) | ((u >= 2) & (u < 2 + np.floor(ruido(fila, 5.3) * 3)) & (np.floor(g) == 0)))
        cor = np.where((ruido(fila, 7.1) > 0.72)[:, None], hx('#c890ff'), hx('#6ac4ff'))
        out = np.where(led[:, None], _cru(cor, n), out)
        led2 = tem & fen & (np.floor(u) == np.floor(Wm - 3)) & (np.floor(g) == 2) & (ruido(fila, 9.3) > 0.4)
        return np.where(led2[:, None], _cru(hx('#7affa0'), n), out)
    o = novo(contorno=False, sombra=False)
    C().face_plana([(x0 + 0.05, yf, zm0), (x1 - 0.05, yf, zm0), (x1 - 0.05, yf, zm1), (x0 + 0.05, yf, zm1)], (0, 1, 0), emissivo(malha_m), M, o)
    # a moldura da porta e a maçaneta
    MOL = metal('#2a2b31', topo='#3e3f46', quina=1.3)
    for (a0, a1, z0, z1) in ((x0 + 0.02, x0 + 0.05, 0.06, h - 0.06), (x1 - 0.05, x1 - 0.02, 0.06, h - 0.06), (x0 + 0.02, x1 - 0.02, 0.06, zm0), (x0 + 0.02, x1 - 0.02, zm1, h - 0.06)):
        cx((a0, a1, y1, y1 + 0.012, z0, z1), MOL)
    _barra((x1 - 0.045, x1 - 0.03, y1 + 0.012, y1 + 0.03, 1.0, 1.18), '#8a8c94', '#c0c2c8', quina=False)
    # a faixa de luz no alto e o painelzinho
    placa('+y', y1 + 0.013, x0 + 0.08, x1 - 0.08, h - 0.12, h - 0.12 + 2 * PZ, liso('#7a6aff'), acesa=True)
    leds('+y', y1 + 0.013, [x0 + 0.06 + 3 * PH * j for j in range(4)], 0.07, ['#5af07a', '#5ab8ff', '#5ab8ff', '#ffb43a'])
    peg(x0, x1, y0, y1)


def torre_crt(vazio=False):
    """
    A torre de monitores CRT (2 casas, 1,8 m): a estante baixa de madeira com o videocassete, os seis monitores de tubo
    empilhados (dois grandes embaixo, dois no meio, dois menores em cima), todos ligados em cores diferentes.
    vazio: a gêmea esvaziada (torre_crt!vazio): levaram os monitores, o videocassete e as fitas; sobra a estante baixa.
    """
    x0, x1 = 0.04, 1.46
    y0, y1 = 0.06, 0.7
    H = 2.94 / UN
    zs = 0.3
    # a estante baixa com o videocassete na prateleira
    cx((x0, x1, y0, y1, zs - 0.03, zs), {'cima': liso('#5a3a26'), '*': _pau('#4a2e1e', quina=1.2, b=(0, 0, 0, 0, zs - 0.03, zs))})
    cx((x0, x1, y0, y1, 0.0, 0.03), _pau('#3a2216', quina=1.2, b=(0, 0, 0, 0, 0, 0.03)))
    for xx in (x0, (x0 + x1) / 2 - 0.02, x1 - 0.04):
        cx((xx, xx + 0.04, y0, y1, 0.03, zs - 0.03), {'cima': liso('#5a3a26'), '*': mad2('#4a2e1e', eixo=1, seed=91, passo=0.04)})
    cx((x0 + 0.04, x1 - 0.04, y0, y0 + 0.02, 0.03, zs - 0.03), liso('#24160e'))
    if vazio:
        peg(x0, x1, y0, y1)
        return
    # o videocassete (a caixa preta, a boca da fita, o visor âmbar) e a caixa de fitas
    vx0, vx1 = x0 + 0.1, (x0 + x1) / 2 - 0.08
    cx((vx0, vx1, y0 + 0.08, y1 - 0.06, 0.03, 0.13), {'frente': metal('#1e1d22', (0, 0, 0, 0, 0.03, 0.13)), '*': metal('#1e1d22', (0, 0, 0, 0, 0.03, 0.13), topo='#34333a')})
    placa('+y', y1 - 0.059, vx0 + 0.05, vx0 + 0.28, 0.08, 0.1, liso('#0a0a0c'))
    placa('+y', y1 - 0.059, vx1 - 0.15, vx1 - 0.05, 0.075, 0.095, liso('#ffb43a'), acesa=True)
    leds('+y', y1 - 0.059, [vx0 + 0.32], 0.06, ['#ff4a3a'])
    for k in range(3):
        _fita_vhs((x0 + x1) / 2 + 0.3, (y0 + y1) / 2, 0.03 + k * 0.025, 0.05 * k)
    # os monitores
    w = (x1 - x0) / 2
    filas = ((zs, 0.5, 0.0, ('verde', 'azul')), (zs + 0.5, 0.46, 0.03, ('roxo', 'estatica')), (zs + 0.96, H - zs - 0.96, 0.09, ('ciano', 'ambar')))
    for j, (z0, hh, enc, ests) in enumerate(filas):
        for i in range(2):
            a0 = x0 + i * w + enc + (0.01 if i == 0 else 0.0)
            a1 = x0 + (i + 1) * w - enc - (0.0 if i == 0 else 0.01)
            corpo = ('#cfc6ae', '#b8b2a0', '#2a2a2e', '#d6ceb8')[(i + 2 * j) % 4]
            crt(a0, a1, y0 + 0.02 + 0.03 * j, y1 - 0.01 - 0.02 * j, z0, z0 + hh, ests[i], True, seed=i + 2 * j, corpo=corpo)
    peg(x0, x1, y0, y1)


# =====================================================================================================================
# os aparelhos
# =====================================================================================================================
def cabinet_file(aberta=False):
    """
    O arquivo de aço (1,35 m): quatro gavetas com o porta-etiqueta em branco e a alça embutida, o rodapé recuado.
    Aberta (estado 1): a gaveta de cima puxada para a frente, com as pastas suspensas e as orelhas coloridas.
    """
    x0, x1 = 0.12, 0.63
    y0, y1 = 0.06, 0.71
    h = 2.2 / UN
    COR = '#5c656e'
    zb = 0.06
    fi = np.linspace(zb + 0.01, h - 0.02, 5)
    pain = [(x0 + 0.02, x1 - 0.02, fi[i] + 0.006, fi[i + 1] - 0.006) for i in range(4)]
    if aberta:
        pain = pain[:3]
    cx((x0 + 0.02, x1 - 0.02, y0 + 0.02, y1 - 0.04, 0.0, zb), metal('#2c3036', (0, 0, 0, 0, 0, zb)))
    cx((x0, x1, y0, y1, zb, h), {'frente': frente_metal(COR, pain, (0, 0, 0, 0, zb, h)), '*': metal(COR, (0, 0, 0, 0, zb, h), topo='#7a848c')})
    for i in range(4 if not aberta else 3):
        zm = fi[i + 1] - 0.1
        _barra(((x0 + x1) / 2 - 0.06, (x0 + x1) / 2 + 0.06, y1, y1 + 0.018, zm - PZ, zm + PZ), '#2a2e34', '#a8b0b8', quina=False)
    if aberta:
        # o vão da gaveta (escuro) e a gaveta puxada
        z0, z1 = fi[3] + 0.006, fi[4] - 0.006
        placa('+y', y1 + 0.0005, x0 + 0.02, x1 - 0.02, z0, z1, liso('#121416'))
        sai = 0.42
        gy0, gy1 = y1 - 0.2, y1 + sai
        g0 = z0 + 0.02
        PAR = metal(COR, (0, 0, 0, 0, g0, z1 - 0.03))
        cx((x0 + 0.04, x0 + 0.06, gy0, gy1 - 0.02, g0, z1 - 0.03), PAR)
        cx((x1 - 0.06, x1 - 0.04, gy0, gy1 - 0.02, g0, z1 - 0.03), PAR)
        cx((x0 + 0.06, x1 - 0.06, gy0, gy1 - 0.02, g0, g0 + 0.02), liso('#3a4048'))
        cx((x0 + 0.02, x1 - 0.02, gy1 - 0.02, gy1, z0, z1), {'frente': frente_metal(COR, [(x0 + 0.02, x1 - 0.02, z0, z1)], (0, 0, 0, 0, z0, z1)), '*': metal(COR, (0, 0, 0, 0, z0, z1))})
        zm = z1 - 0.1
        _barra(((x0 + x1) / 2 - 0.06, (x0 + x1) / 2 + 0.06, gy1, gy1 + 0.018, zm - PZ, zm + PZ), '#2a2e34', '#a8b0b8', quina=False)
        # as pastas suspensas: placas de papelão em pé, com as orelhas coloridas
        cores = ('#c8a46a', '#d6b47a', '#b89a5e', '#c8a46a', '#d6b47a', '#c0a066')
        orelhas = ('#c83a2a', '#2a6ab8', '#e0c030', '#3a8a4a', '#c83a2a', '#8a4ac8')
        for k in range(6):
            yy = gy0 + 0.06 + k * (sai + 0.1) / 6
            cx((x0 + 0.07, x1 - 0.07, yy, yy + 0.012, g0 + 0.02, z1 - 0.02 + 0.01 * (k % 2)), {'cima': liso('#efe6cc'), '*': liso(cores[k])})
            a = x0 + 0.1 + (k % 3) * 0.1
            cx((a, a + 0.06, yy, yy + 0.012, z1 - 0.02, z1 + 0.012), liso(orelhas[k]))
    peg(x0, x1, y0, y1)


def console(ligado=True):
    """
    A bancada de computadores antiga (2 casas, o tampo a 0,78 m): o móvel de aço bege, o painel inclinado da frente
    com as fileiras de botões e as luzinhas, os dois monitores de tubo de fósforo verde no fundo do tampo, o teclado.
    """
    x0, x1 = 0.03, 1.47
    y0, y1 = 0.06, 0.7
    h = 1.27 / UN
    COR = '#b8b09a'
    zp = h - 0.26                  # onde começa o painel inclinado
    yp = y1 - 0.14                 # o recuo do painel em cima
    # o corpo (o rodapé escuro, o armário) e o tampo
    cx((x0 + 0.03, x1 - 0.03, y0 + 0.03, y1 - 0.04, 0.0, 0.06), metal('#3a3630', (0, 0, 0, 0, 0, 0.06)))
    pain = [(x0 + 0.04, (x0 + x1) / 2 - 0.01, 0.1, zp - 0.04), ((x0 + x1) / 2 + 0.01, x1 - 0.04, 0.1, zp - 0.04)]
    cx((x0, x1, y0, y1, 0.06, zp), {'frente': frente_metal(COR, pain, (0, 0, 0, 0, 0.06, zp), etiqueta=False), '*': metal(COR, (0, 0, 0, 0, 0.06, zp))})
    for xx in ((x0 + x1) / 2 - 0.06, (x0 + x1) / 2 + 0.06):
        _barra((xx - PH, xx + PH, y1, y1 + 0.015, zp - 0.2, zp - 0.12), '#4a4438', '#8a8270', quina=False)
    cx((x0, x1, y0, yp, zp, h), {'cima': liso(_hexs(COR, 1.08)), '*': metal(COR, (0, 0, 0, 0, zp, h))})
    # o painel inclinado (a face de frente, olhando para cima e para a frente): os botões e as luzinhas
    t0, t1 = (y1, zp), (yp, h)
    ln = math.hypot(t1[0] - t0[0], t1[1] - t0[1])
    nrm = ((t1[1] - t0[1]) / ln, (t1[0] - t0[0]) / ln)          # (ny, nz) para fora

    def painel(L, n, P):
        s = (P[:, 2] - zp) / (h - zp)
        u = (P[:, 0] - x0) / PH
        out = np.tile(hx('#4a4a44'), (len(P), 1))
        fil = np.floor(s * 6)
        g = s * 6 - fil
        botao = (fil >= 1) & (fil <= 4) & (g > 0.25) & (g < 0.75) & ((np.floor(u) % 4) < 2) & (u > 4) & (u < (x1 - x0) / PH - 4)
        kk = ruido(fil, np.floor(u / 4), 1.7)
        cores = [hx('#d8d0b8'), hx('#c83a2a'), hx('#2a2a2e'), hx('#e0b030')]
        cb = np.stack(cores)[(kk * 4).astype(int) % 4]
        out = np.where(botao[:, None], cb, out)
        # as luzinhas (a fileira de cima): acesas ou apagadas
        lz = (fil == 5) & (g > 0.3) & (g < 0.7) & ((np.floor(u) % 3) == 0) & (u > 4) & (u < (x1 - x0) / PH - 4)
        kl = ruido(np.floor(u / 3), 5.5)
        if ligado:
            cl = np.where((kl > 0.66)[:, None], hx('#ff6a4a'), np.where((kl > 0.33)[:, None], hx('#8affa0'), hx('#ffe060')))
            cl = _cru(cl, n)
        else:
            cl = np.tile(hx('#2a2a26'), (len(P), 1))
        out = np.where(lz[:, None], cl, out)
        out = np.where((s > 0.97)[:, None], _tom(hx('#4a4a44'), 1.3), out)
        return out
    o = novo()
    C().face_plana([(x0, y1, zp), (x1, y1, zp), (x1, yp, h), (x0, yp, h)], (0, nrm[0], nrm[1]), emissivo(painel), M, o)
    # o teclado bege e os dois monitores de fósforo verde no fundo do tampo
    teclado_bege(x0 + 0.45, x1 - 0.45, y0 + 0.32, y0 + 0.48, h)
    for (a0, a1) in ((x0 + 0.06, x0 + 0.56), (x1 - 0.56, x1 - 0.06)):
        crt(a0, a1, y0 + 0.02, y0 + 0.3, h, h + 0.4, 'verde', ligado, seed=0 if a0 < 0.5 else 2, corpo='#c8c0a8', fundo=0.5)
    peg(x0, x1, y0, y1)


def teclado_bege(x0, x1, y0, y1, z):
    def tec(L, n, P):
        if n[2] < 0.5:
            return np.tile(hx('#a8a08a'), (len(P), 1))
        i = np.floor((P[:, 0] - x0) / PH)
        j = np.floor((P[:, 1] - y0) / PH)
        W, D = (x1 - x0) / PH, (y1 - y0) / PH
        out = np.tile(hx('#8a8470'), (len(P), 1))
        tecla = (i % 3 != 2) & (j % 3 != 2) & (i > 0) & (i < W - 1) & (j > 0) & (j < D - 1)
        out = np.where(tecla[:, None], hx('#d8d0b8'), out)
        out = np.where((tecla & (j % 3 == 1))[:, None], hx('#c4bca4'), out)
        return out
    o = novo()
    cx((x0, x1, y0, y1, z, z + 0.03), emissivo(tec), o)
    peq(x0, x1, y0, y1, z)


def bancada_eletronica(vazio=False):
    """
    vazio: a gêmea esvaziada (bancada_eletronica!vazio): sem as caixas e a maleta de baixo, sem as ferramentas do
    painel e sem nada em cima (a placa, o multímetro, o osciloscópio, o carretel, o ferro); ficam as queimadas no
    tampo e a lupa, que é presa na borda.

    A bancada de eletrônica (2 casas, o tampo a 0,95 m): o tampo de madeira gasto com as queimadas, o quadro de pés de
    cantoneira, a prateleira de baixo com as caixas, o painel perfurado atrás com as ferramentas; em cima o ferro de
    solda no suporte (fumegando), a lupa com a luz presa na borda, a placa verde, o multímetro, o osciloscópio de tela
    verde e o carretel de solda.
    """
    x0, x1 = 0.03, 1.47
    y0, y1 = 0.06, 0.72
    h = 1.55 / UN
    tp = 0.05
    COR = '#4a5450'

    def tampo(L, n, P):
        out = tab2(['#a87848', '#a07244', '#ae7e4c'], 0.33, '#5a3a20', eixo=0, seed=61, comp=1.4, org=y0)(L, n, P)
        if n[2] < 0.5:
            return out
        s = suave(np.floor(P[:, 0] / (2 * PH)) * 2 * PH, np.floor(P[:, 1] / (2 * PH)) * 2 * PH, 0.22, 8)
        out = np.where((s > 0.74)[:, None], _tom(out, 0.86), out)
        for (bx_, by_) in ((x0 + 0.5, y0 + 0.5), (x0 + 0.95, y0 + 0.3), (x0 + 0.3, y0 + 0.25)):
            d = np.hypot((P[:, 0] - bx_) / PH, (P[:, 1] - by_) / PH)
            out = np.where((d < 1.6)[:, None], hx('#2a1810'), out)
            out = np.where(((d >= 1.6) & (d < 2.6))[:, None], hx('#5a3a24'), out)
        return out
    cx((x0, x1, y0, y1, h - tp, h), {'cima': emissivo(tampo), '*': _pau('#7a5232', '#a07244', quina=1.2, b=(0, 0, 0, 0, h - tp, h))})
    # o quadro de cantoneira e a prateleira de baixo
    for (a, b) in ((x0 + 0.03, y0 + 0.03), (x1 - 0.08, y0 + 0.03), (x0 + 0.03, y1 - 0.08), (x1 - 0.08, y1 - 0.08)):
        cx((a, a + 0.05, b, b + 0.05, 0.0, h - tp), {'cima': liso('#6a7470'), '*': metal(COR, quina=False)})
    zpr = 0.16
    cx((x0 + 0.03, x1 - 0.03, y0 + 0.03, y1 - 0.03, zpr, zpr + 0.03), {'cima': liso('#5a6460'), '*': metal(COR, (0, 0, 0, 0, zpr, zpr + 0.03))})
    if vazio:
        _painel_perfurado(x0, x1, y0, h, COR)
        _lupa_bancada(x0, y1, h)
        peg(x0, x1, y0, y1)
        return
    caixa_papelao(x0 + 0.12, x0 + 0.55, y0 + 0.12, y1 - 0.08, zpr + 0.03, zpr + 0.28, aberta=True, seed=4, abas=False)
    caixa_papelao(x0 + 0.62, x0 + 0.98, y0 + 0.1, y1 - 0.12, zpr + 0.03, zpr + 0.22, aberta=False, seed=7)
    # a maleta de gavetinhas (os componentes) em cima da prateleira
    cx((x1 - 0.42, x1 - 0.1, y0 + 0.15, y1 - 0.1, zpr + 0.03, zpr + 0.3), {'frente': frente_metal('#c84a2a', [(x1 - 0.42 + 0.02 + j * 0.1, x1 - 0.42 + 0.02 + j * 0.1 + 0.08, zpr + 0.05 + i * 0.08, zpr + 0.05 + i * 0.08 + 0.065) for i in range(3) for j in range(3)], etiqueta=False),
                                                                  '*': metal('#c84a2a', (0, 0, 0, 0, zpr + 0.03, zpr + 0.3))})
    # o painel perfurado atrás, com as ferramentas penduradas
    zt = _painel_perfurado(x0, x1, y0, h, COR)
    # as ferramentas: o alicate, a chave de fenda, o rolo de fio, a tesoura
    for (xx, cor, hh) in ((x0 + 0.2, '#c83a2a', 0.16), (x0 + 0.26, '#e0b030', 0.18), (x0 + 0.32, '#2a6ab8', 0.15), (x0 + 0.38, '#c83a2a', 0.14)):
        _barra((xx, xx + 2 * PH, y0 + 0.025, y0 + 0.04, zt - 0.12 - hh, zt - 0.12 - hh * 0.45), cor, quina=False)
        _barra((xx + PH * 0.5, xx + PH * 1.5, y0 + 0.025, y0 + 0.035, zt - 0.12 - hh * 0.45, zt - 0.12), '#9aa0a8', quina=False)
    o = novo()
    cil_eixo((x0 + 0.62, y0 + 0.025, zt - 0.22), (x0 + 0.62, y0 + 0.09, zt - 0.22), 0.07, liso('#c86a2a'), o, lados=14, tampa_mat=liso('#3a2a20'))
    o = novo()
    cil_eixo((x1 - 0.42, y0 + 0.025, zt - 0.2), (x1 - 0.42, y0 + 0.07, zt - 0.2), 0.08, liso('#2a2a2e'), o, lados=14, tampa_mat=liso('#3a7a4a'))
    # em cima: a placa verde, o multímetro amarelo, o osciloscópio, o carretel, o ferro de solda e a lupa
    pcx, pcy = x0 + 0.62, y0 + 0.45
    o = novo()

    def pcb(L, n, P):
        out = np.tile(hx('#2a7a48'), (len(P), 1))
        if n[2] < 0.5:
            return np.tile(hx('#1e5a34'), (len(P), 1))
        u, v = np.floor((P[:, 0] - pcx) / PH), np.floor((P[:, 1] - pcy) / PH)
        trilha = ((u % 3 == 0) & (np.abs(v) < 4)) | ((v % 4 == 0) & (u > -5) & (u < 2))
        out = np.where(trilha[:, None], hx('#4aa86a'), out)
        chip = (np.abs(u - 3) < 2) & (np.abs(v + 1) < 2)
        return np.where(chip[:, None], hx('#1a1a1e'), out)
    prisma(ret_girado(pcx, pcy, 0.15, 0.14, 0.1), h, h + 0.012, emissivo(pcb), o)
    peq(pcx - 0.15, pcx + 0.15, pcy - 0.11, pcy + 0.11, h)
    for (dx, dy, cor) in ((0.04, 0.02, '#2a2a2e'), (-0.05, -0.03, '#c8a040'), (0.0, -0.05, '#3a4ab8')):
        cx((pcx + dx - 0.02, pcx + dx + 0.02, pcy + dy - 0.015, pcy + dy + 0.015, h + 0.012, h + 0.035), liso(cor))
    # o multímetro
    mx, my = x0 + 0.95, y0 + 0.5
    cx((mx - 0.07, mx + 0.07, my - 0.1, my + 0.1, h, h + 0.04), {'cima': emissivo(lambda L, n, P: np.where(((np.abs(P[:, 0] - mx) < 0.045) & (P[:, 1] < my - 0.02) & (P[:, 1] > my - 0.08))[:, None], hx('#9ab8a0'), np.where((np.hypot(P[:, 0] - mx, P[:, 1] - my - 0.04) < 0.03)[:, None], hx('#2a2a2e'), hx('#e8c030')))),
                                                                '*': liso('#c8a020')})
    peq(mx - 0.07, mx + 0.07, my - 0.1, my + 0.1, h)
    o = novo()
    for (cor, dx) in (('#c83a2a', 0.02), ('#1a1a1e', -0.02)):
        haste((mx + dx, my + 0.09, h + 0.03), (mx + dx * 3 + 0.06, my + 0.2, h + 0.004), 0.012, liso(cor), o)
    # o osciloscópio (a caixa cinza, a tela verde com a onda, os botões)
    ox0, ox1 = x1 - 0.5, x1 - 0.12
    oy0, oy1 = y0 + 0.08, y0 + 0.42
    cx((ox0, ox1, oy0, oy1, h, h + 0.22), {'*': metal('#8a8e90', (0, 0, 0, 0, h, h + 0.22), topo='#a4a8aa')})

    def onda(L, n, P):
        u = (P[:, 0] - (ox0 + 0.03)) / PH
        v = (h + 0.19 - P[:, 2]) / PZ
        out = np.tile(hx('#1e5a34'), (len(P), 1))
        out = np.where(((np.floor(u) % 4 == 0) | (np.floor(v) % 3 == 0))[:, None], hx('#2a7044'), out)
        yv = np.floor(4 + 2.6 * np.sin(np.floor(u) * 0.9))
        return np.where((np.floor(v) == yv)[:, None], hx('#b8ffc8'), out)
    placa('+y', oy1 + 0.001, ox0 + 0.03, ox0 + 0.2, h + 0.06, h + 0.19, emissivo(onda), acesa=True)
    for k in range(3):
        for j in range(2):
            a = ox0 + 0.25 + j * 0.05
            zz = h + 0.05 + k * 0.05
            placa('+y', oy1 + 0.001, a, a + 2 * PH, zz, zz + 2 * PZ, liso('#2a2a2e'))
    # o carretel de solda
    o = novo()
    C().cilindro(x0 + 1.18, y0 + 0.55, 0.045, h, h + 0.05, vol(x0 + 1.18, y0 + 0.55, '#c0c4c8', brilho=0.5), M, o, lados=14, tampa_mat=liso('#3a7ab8'))
    peq(x0 + 1.13, x0 + 1.23, y0 + 0.5, y0 + 0.6, h)
    # o ferro de solda no suporte de mola, com a fumacinha
    fx, fy = x0 + 0.25, y0 + 0.5
    cx((fx - 0.06, fx + 0.06, fy - 0.05, fy + 0.05, h, h + 0.02), {'cima': liso('#d0b860'), '*': liso('#3a3a3e')})
    o = novo()
    cil_eixo((fx - 0.03, fy, h + 0.02), (fx + 0.03, fy - 0.04, h + 0.11), 0.03, liso('#a8acb0'), o, lados=8)
    o = novo()
    cil_eixo((fx + 0.03, fy - 0.04, h + 0.11), (fx + 0.12, fy - 0.1, h + 0.17), 0.018, liso('#2a6ab8'), o, lados=8)
    cil_eixo((fx - 0.08, fy + 0.04, h + 0.05), (fx + 0.03, fy - 0.04, h + 0.11), 0.008, liso('#c0c4c8'), o, lados=6)
    of = novo(contorno=False, sombra=False)
    BE._fita([(-0.08, h + 0.07), (-0.09, h + 0.13), (-0.07, h + 0.18), (-0.09, h + 0.24)], fx + 0.0, fy + 0.04, liso('#d8d8d4'), of, 0.014)
    peq(fx - 0.06, fx + 0.06, fy - 0.05, fy + 0.05, h)
    _lupa_bancada(x0, y1, h)
    peg(x0, x1, y0, y1)


def _painel_perfurado(x0, x1, y0, h, COR):
    """O painel perfurado atrás da bancada de eletrônica e os dois montantes; devolve o alto dele."""
    zt = h + 0.68

    def perfurado(L, n, P):
        out = np.tile(hx('#a88a62'), (len(P), 1))
        if n[1] < 0.5:
            return out
        u, v = np.floor(P[:, 0] / PH), np.floor(P[:, 2] / PZ)
        fu = (u % 4 == 0) & (v % 4 == 0)
        return np.where(fu[:, None], hx('#4a3420'), out)
    cx((x0 + 0.02, x1 - 0.02, y0, y0 + 0.025, h, zt), {'frente': emissivo(perfurado), 'cima': liso('#b89a72'), '*': liso('#8a6e4a')})
    for (a0, a1) in ((x0, x0 + 0.04), (x1 - 0.04, x1)):
        cx((a0, a1, y0, y0 + 0.04, h, zt + 0.02), {'cima': liso('#6a7470'), '*': metal(COR, quina=False)})
    return zt


def _lupa_bancada(x0, y1, h):
    """A lupa com luz, presa na borda do tampo: a garra, o braço articulado e o anel aceso com a lente."""
    gx, gy = x0 + 0.08, y1 - 0.02
    cx((gx - 0.03, gx + 0.03, gy - 0.05, gy + 0.03, h - 0.07, h + 0.04), metal('#d8d8d4', (0, 0, 0, 0, h - 0.07, h + 0.04)))
    o = novo()
    p1 = (gx, gy - 0.01, h + 0.04)
    p2 = (gx + 0.06, gy - 0.12, h + 0.42)
    p3 = (gx + 0.24, gy - 0.18, h + 0.36)
    haste(p1, p2, 0.02, liso('#e0e0dc'), o)
    haste(p2, p3, 0.02, liso('#e0e0dc'), o)
    rx, ry, rz = gx + 0.32, gy - 0.18, h + 0.3
    o = novo()
    C().cilindro(rx, ry, 0.1, rz, rz + 0.04, vol(rx, ry, '#e8e8e4', brilho=0.3), M, o, lados=22, tampa=False)
    o = luz(novo(contorno=False))

    def anel(L, n, P):
        r = np.hypot(P[:, 0] - rx, P[:, 1] - ry)
        out = np.where((r > 0.075)[:, None], hx('#fffbe8'), hx('#c8e4e8'))
        return np.where(((r < 0.06) & ((P[:, 0] - rx) - (P[:, 1] - ry) < -0.02) & ((P[:, 0] - rx) - (P[:, 1] - ry) > -0.04))[:, None], hx('#ffffff'), out)
    _disco(rx, ry, rz + 0.041, 0.1, emissivo(anel), o, lados=22)


def gravador_rolo():
    """
    O gravador de rolo (0,95 m): o carrinho de aço com a prateleira, o gravador deitado em cima (a caixa de madeira e
    o painel de alumínio escovado), os dois rolos de fita marrom parados, os cabeçotes, os medidores VU e os botões.
    """
    x0, x1 = 0.08, 0.67
    y0, y1 = 0.1, 0.65
    zc = 0.74
    h = 1.55 / UN
    COR = '#4a4e52'
    # o carrinho: os quatro pés de tubo, as duas prateleiras, as rodinhas
    for (a, b) in ((x0, y0), (x1 - 0.035, y0), (x0, y1 - 0.035), (x1 - 0.035, y1 - 0.035)):
        cx((a, a + 0.035, b, b + 0.035, 0.05, zc), {'cima': liso('#6a6e72'), '*': metal(COR, quina=False)})
        bola((a + 0.0175, b + 0.0175, 0.028), 0.028, '#1a1a1e')
    for z in (0.16, zc - 0.03):
        cx((x0, x1, y0, y1, z, z + 0.03), {'cima': liso('#5a5e62'), '*': metal(COR, (0, 0, 0, 0, z, z + 0.03), quina=1.25)})
    # as caixas de fita na prateleira de baixo
    for k in range(4):
        cx((x0 + 0.06 + k * 0.012, x0 + 0.34 + k * 0.012, y0 + 0.06, y0 + 0.36, 0.19 + k * 0.03, 0.19 + (k + 1) * 0.03),
           {'cima': liso(('#c8b890', '#3a5a8a', '#b8a888', '#8a3a2a')[k]), '*': liso('#e8e0c8')})
    # o gravador: a caixa de madeira e o painel de alumínio
    gz0, gz1 = zc, h - 0.04
    cx((x0 - 0.01, x1 + 0.01, y0 - 0.02, y1 + 0.02, gz0, gz1), {'cima': liso('#7a4a2a'), '*': mad2('#6a3e22', eixo=0, seed=81, passo=0.04)})

    def aluminio(L, n, P):
        out = np.tile(hx('#b4b8b8'), (len(P), 1))
        lin = np.floor(P[:, 1] / PH) % 5 == 0
        out = np.where(lin[:, None], hx('#a8acac'), out)
        # a faixa preta dos cabeçotes (no meio) e o friso
        out = np.where((np.abs(P[:, 1] - (y1 - 0.12)) < 0.035)[:, None], hx('#26262a'), out)
        out = np.where(((P[:, 0] < x0 + PH) | (P[:, 0] > x1 - PH) | (P[:, 1] < y0 + PH) | (P[:, 1] > y1 - PH))[:, None], hx('#8a8e8e'), out)
        return out
    cx((x0 + 0.01, x1 - 0.01, y0, y1, gz1, h), {'cima': emissivo(aluminio), '*': metal('#a0a4a4', (0, 0, 0, 0, gz1, h))})
    # os dois rolos (o carretel de alumínio com os furos, a fita marrom enrolada)
    for (rx, ry, rf) in ((x0 + 0.14, y0 + 0.2, 0.112), (x1 - 0.14, y0 + 0.2, 0.06)):
        R0 = 0.125
        # o rolo de fita (o anel marrom em volta do cubo) entre as duas flanges
        o = novo()
        C().cilindro(rx, ry, rf, h + 0.006, h + 0.026, vol(rx, ry, '#4a2e1a', brilho=0.1), M, o, lados=20, tampa=False)

        def flange(L, n, P, rx=rx, ry=ry, rf=rf, R0=R0):
            r = np.hypot(P[:, 0] - rx, P[:, 1] - ry)
            a = np.arctan2(P[:, 1] - ry, P[:, 0] - rx)
            out = np.tile(hx('#d4d8d8'), (len(P), 1))
            # pelos furos da flange aparece a fita marrom (ou o fundo, onde não tem fita)
            furo = (r > 0.04) & (r < R0 - 0.025) & (np.cos(5 * a) > 0.45)
            out = np.where((furo & (r < rf))[:, None], hx('#6a4228'), out)
            out = np.where((furo & (r >= rf))[:, None], hx('#3a3a3e'), out)
            out = np.where(((r > R0 - 2 * PH) & (r <= R0 - PH))[:, None], hx('#eef0f0'), out)
            out = np.where((r > R0 - PH)[:, None], hx('#9a9e9e'), out)
            out = np.where((r < 0.018)[:, None], hx('#2a2a2e'), out)
            return out
        o = novo()
        C().cilindro(rx, ry, R0, h + 0.026, h + 0.032, vol(rx, ry, '#b8bcbc', brilho=0.4), M, o, lados=24, tampa_mat=emissivo(flange))
        o = novo()
        C().cilindro(rx, ry, R0, h + 0.002, h + 0.006, liso('#a8acac'), M, o, lados=24, tampa=False)
    # a fita passando pelos cabeçotes
    o = novo()
    for (p, q) in (((x0 + 0.06, y0 + 0.28), (x0 + 0.2, y1 - 0.12)), ((x0 + 0.2, y1 - 0.12), (x1 - 0.2, y1 - 0.12)), ((x1 - 0.2, y1 - 0.12), (x1 - 0.1, y0 + 0.24))):
        haste((p[0], p[1], h + 0.016), (q[0], q[1], h + 0.016), PH, liso('#5a3a22'), o, h=0.014)
    for xx in (x0 + 0.23, (x0 + x1) / 2, x1 - 0.23):
        cx((xx - 0.025, xx + 0.025, y1 - 0.15, y1 - 0.09, h, h + 0.035), metal('#7a7e80', (0, 0, 0, 0, h, h + 0.035)))
    # o painel da frente: os dois medidores VU (âmbar, ponteiro) e os botões
    for (a0, a1) in ((x0 + 0.06, x0 + 0.2), (x0 + 0.24, x0 + 0.38)):
        def vu(L, n, P, a0=a0, a1=a1):
            u = (P[:, 0] - a0) / PH
            v = (gz1 - 0.02 - P[:, 2]) / PZ
            out = np.tile(hx('#f0c870'), (len(P), 1))
            arco = (np.abs(np.hypot(u - (a1 - a0) / PH / 2, v - 9) - 6) < 0.6) & (v < 5)
            out = np.where(arco[:, None], hx('#8a5a20'), out)
            pt = np.abs((u - (a1 - a0) / PH / 2) - (9 - v) * 0.5) < 0.6
            return np.where((pt & (v > 1))[:, None], hx('#2a1a10'), out)
        placa('+y', y1 + 0.021, a0, a1, gz1 - 0.12, gz1 - 0.02, emissivo(vu), acesa=True)
        placa('+y', y1 + 0.0205, a0 - 0.01, a1 + 0.01, gz1 - 0.13, gz1 - 0.01, liso('#2a2a2e'))
    for k in range(4):
        a = x1 - 0.22 + k * 0.045
        placa('+y', y1 + 0.021, a, a + 2 * PH, gz1 - 0.08, gz1 - 0.08 + 2 * PZ, liso('#d8d8d4' if k else '#c83a2a'))
    peg(x0, x1, y0, y1)


def camera_tripe():
    """
    A câmera no tripé (1,6 m): as três pernas de alumínio abertas com as sapatas, a coluna do meio, a cabeça com o
    cabo, a filmadora de fita preta (a lente para a frente, o visor do lado, a alça) e a luzinha vermelha de gravando.
    """
    cx_, cy_ = 0.375, 0.42
    zh = 1.2
    R = 0.32
    o = novo()
    for k in range(3):
        a = math.radians(90 + 120 * k + 60)
        pe = (cx_ + R * math.cos(a), cy_ + R * math.sin(a), 0.02)
        topo = (cx_ + 0.04 * math.cos(a), cy_ + 0.04 * math.sin(a), zh - 0.04)
        meio = tuple(np.array(pe) * 0.45 + np.array(topo) * 0.55)
        haste(topo, meio, 0.026, liso('#9aa0a6'), o)
        haste(meio, pe, 0.018, liso('#7a8086'), o)
        cx((pe[0] - 0.02, pe[0] + 0.02, pe[1] - 0.02, pe[1] + 0.02, 0.0, 0.025), metal('#1a1a1e'))
        # a trava preta no meio
        cx((meio[0] - 0.02, meio[0] + 0.02, meio[1] - 0.02, meio[1] + 0.02, meio[2] - 0.03, meio[2] + 0.03), metal('#1e1e22'))
    o = novo()
    C().cilindro(cx_, cy_, 0.05, zh - 0.06, zh, vol(cx_, cy_, '#2a2a2e', brilho=0.3), M, o, lados=14, tampa_mat=liso('#3a3a3e'))
    o = novo()
    C().cilindro(cx_, cy_, 0.02, zh, zh + 0.1, vol(cx_, cy_, '#b0b4b8', brilho=0.5), M, o, lados=10, tampa=False)
    cx((cx_ - 0.05, cx_ + 0.05, cy_ - 0.05, cy_ + 0.05, zh + 0.1, zh + 0.14), metal('#26262a', (0, 0, 0, 0, zh + 0.1, zh + 0.14)))
    o = novo()
    haste((cx_ + 0.03, cy_ - 0.02, zh + 0.12), (cx_ + 0.12, cy_ - 0.3, zh + 0.04), 0.018, liso('#1e1e22'), o)
    # a filmadora
    b0, b1 = zh + 0.14, H_CAM
    cx((cx_ - 0.07, cx_ + 0.07, cy_ - 0.2, cy_ + 0.14, b0, b1), {'frente': metal('#202024', (0, 0, 0, 0, b0, b1)), '*': metal('#24242a', (0, 0, 0, 0, b0, b1), topo='#3a3a40')})
    # a faixa e o compartimento da fita do lado
    placa('+x', cx_ + 0.071, cy_ - 0.15, cy_ + 0.06, b0 + 0.03, b1 - 0.04, metal('#2e2e34'))
    placa('+x', cx_ + 0.072, cy_ - 0.14, cy_ + 0.05, b0 + 0.06, b0 + 0.06 + PZ, liso('#c83a2a'))
    # a lente (o cilindro deitado para +y, o anel, o vidro azulado)
    o = novo()
    cil_eixo((cx_, cy_ + 0.14, (b0 + b1) / 2), (cx_, cy_ + 0.27, (b0 + b1) / 2), 0.055, liso('#1a1a1e'), o, lados=16, tampa_mat=liso('#1a1a1e'), r1=0.062)
    o = novo(contorno=False)

    def vidro(L, n, P):
        d = np.hypot(P[:, 0] - cx_, P[:, 2] - (b0 + b1) / 2)
        out = np.where((d < 0.04)[:, None], hx('#3a5a7a'), hx('#2a2a30'))
        return np.where(((d < 0.035) & (P[:, 0] - cx_ < -0.008) & (P[:, 2] - (b0 + b1) / 2 > 0.008))[:, None], hx('#9ac8e8'), out)
    pts = [(cx_ + 0.055 * math.cos(2 * math.pi * i / 16), cy_ + 0.271, (b0 + b1) / 2 + 0.055 * math.sin(2 * math.pi * i / 16)) for i in range(16)]
    C().face_plana(pts, (0, 1, 0), emissivo(vidro), M, o)
    # o para-sol da lente
    # o visor (o tubo do lado esquerdo, atrás) e a alça em cima
    o = novo()
    cil_eixo((cx_ - 0.07, cy_ - 0.14, b1 - 0.035), (cx_ - 0.07, cy_ - 0.26, b1 - 0.035), 0.025, liso('#1a1a1e'), o, lados=10, tampa_mat=liso('#0e0e10'))
    o = novo()
    haste((cx_, cy_ - 0.14, b1), (cx_, cy_ - 0.1, b1 + 0.06), 0.022, liso('#2a2a2e'), o)
    haste((cx_, cy_ - 0.1, b1 + 0.06), (cx_, cy_ + 0.08, b1 + 0.06), 0.022, liso('#2a2a2e'), o)
    haste((cx_, cy_ + 0.08, b1 + 0.06), (cx_, cy_ + 0.12, b1), 0.022, liso('#2a2a2e'), o)
    # a luzinha de gravando
    placa('+y', cy_ + 0.141, cx_ + 0.035, cx_ + 0.035 + 2 * PH, b1 - 0.035, b1 - 0.035 + 2 * PZ, liso('#ff2a2a'), acesa=True)
    peg(cx_ - R, cx_ + R, cy_ - R, cy_ + R)


H_CAM = 2.61 / UN - 0.08


def frigobar_energetico():
    """
    O frigobar de energético (0,9 m): o corpo preto, a porta de vidro com a moldura, a luz fria de dentro, as três
    prateleiras de latas verdes, roxas e amarelas; os adesivos na lateral e as latas vazias em cima.
    """
    x0, x1 = 0.1, 0.65
    y0, y1 = 0.08, 0.68
    h = 1.47 / UN
    COR = '#1c1c20'
    cx((x0, x1, y0, y1, 0.04, h), {'*': metal(COR, (0, 0, 0, 0, 0.04, h), topo='#2e2e34'), 'frente': metal(COR, (0, 0, 0, 0, 0.04, h))})
    cx((x0 + 0.02, x1 - 0.02, y0 + 0.02, y1 - 0.04, 0.0, 0.04), metal('#101012'))
    # os adesivos na lateral (formas simples, sem letra)
    placa('+x', x1 + 0.001, y0 + 0.12, y0 + 0.26, 0.5, 0.62, liso('#7af0a0'))
    placa('+x', x1 + 0.0015, y0 + 0.15, y0 + 0.23, 0.53, 0.59, liso('#1c1c20'))
    placa('+x', x1 + 0.001, y0 + 0.32, y0 + 0.44, 0.28, 0.36, liso('#c084ff'))
    # a porta: a moldura e o vidro com o que tem dentro (a luz fria e as latas)
    m = 0.05
    vz0, vz1 = 0.1, h - 0.06

    def dentro(L, n, P):
        u = (P[:, 0] - x0 - m) / PH
        v = (vz1 - P[:, 2]) / PZ
        out = np.tile(hx('#cfe8f0'), (len(P), 1))
        H_ = (vz1 - vz0) / PZ
        fil = np.floor(v / (H_ / 3))
        g = v - fil * (H_ / 3)
        pr = g > H_ / 3 - 2
        out = np.where(pr[:, None], hx('#8aa8b4'), out)
        lata = (g > 2) & (g <= H_ / 3 - 2) & (np.floor(u) % 4 != 3)
        k = (ruido(fil, np.floor(u / 4), 2.2) * 3).astype(int)
        cores = np.stack([hx('#3ad060'), hx('#9a4ae0'), hx('#e8d030')])
        cl = cores[np.where(fil == 0, 0, np.where(fil == 1, 1, k)) % 3]
        out = np.where(lata[:, None], cl, out)
        # a tampinha prateada e o brilho na lata
        out = np.where((lata & (g <= 3))[:, None], hx('#d8dce0'), out)
        out = np.where((lata & (np.floor(u) % 4 == 0) & (g > 3))[:, None], _tom(cl, 1.3), out)
        # o reflexo do vidro
        ref = (np.abs((u + v) - H_ * 0.55) < 1.0)
        return np.where(ref[:, None], _tom(out, 1.25), out)
    placa('+y', y1 + 0.003, x0 + m, x1 - m, vz0, vz1, emissivo(dentro), acesa=True)
    MOL = metal('#2a2a30', topo='#3e3e46', quina=1.3)
    for (a0, a1, z0, z1) in ((x0 + 0.01, x0 + m, 0.06, h - 0.02), (x1 - m, x1 - 0.01, 0.06, h - 0.02), (x0 + 0.01, x1 - 0.01, 0.06, vz0), (x0 + 0.01, x1 - 0.01, vz1, h - 0.02)):
        cx((a0, a1, y1, y1 + 0.02, z0, z1), MOL)
    _barra((x1 - 0.045, x1 - 0.03, y1 + 0.02, y1 + 0.035, 0.35, 0.65), '#8a8c94', '#c0c2c8', quina=False)
    # as latas vazias em cima (uma deitada)
    _lata(x0 + 0.15, y0 + 0.2, h, '#3ad060')
    _lata(x0 + 0.26, y0 + 0.3, h, '#9a4ae0')
    _lata(x0 + 0.38, y0 + 0.42, h, '#3ad060', deitada=True, ang=0.6)
    peg(x0, x1, y0, y1)


def lixeira_lanches():
    """
    A lixeira transbordando (0,6 m): o cesto de plástico cinza com a borda, o monte por cima (a caixa de pizza torta,
    as latas, os saquinhos de salgadinho coloridos, as bolas de papel) e o que caiu no chão em volta.
    """
    cx_, cy_ = 0.36, 0.34
    h = 0.98 / UN
    r0, r1 = 0.17, 0.2
    zb = 0.42

    def cesto(P, b):
        th = np.arctan2(P[:, 1] - cy_, P[:, 0] - cx_)
        nerv = (np.floor(th / (2 * math.pi) * 24) % 2 == 0)
        return np.where(nerv[:, None], _tom(b, 1.06), b)
    o = novo()
    C().cilindro(cx_, cy_, r0, 0.0, zb, vol(cx_, cy_, '#6a7078', faixas=cesto), M, o, lados=24, tampa=False, r1=r1)
    o = novo()
    C().cilindro(cx_, cy_, r1 + 0.012, zb - 0.03, zb, vol(cx_, cy_, '#7a8088', brilho=0.2), M, o, lados=24, tampa_mat=liso('#2a2a2e'))
    # o monte: os papéis amassados, os saquinhos, a caixa de pizza e as latas
    for (dx, dy, dz, r, cor) in ((-0.06, -0.05, 0.05, 0.08, '#e8e4dc'), (0.07, -0.02, 0.04, 0.07, '#d8d4c8'), (0.0, 0.06, 0.06, 0.06, '#f0ece4'),
                                 (-0.02, 0.0, 0.11, 0.06, '#e0dcd2')):
        o = novo()
        C().elipsoide(np.array([cx_ + dx, cy_ + dy, zb + dz]), np.array([r, r, r * 0.8]), emissivo(lambda L, n, P, c=cor: np.where((np.floor(P[:, 0] / PH) + np.floor(P[:, 2] / PZ)) % 5 == 0, 0, 1)[:, None] * hx(c) + np.where((np.floor(P[:, 0] / PH) + np.floor(P[:, 2] / PZ)) % 5 == 0, 1, 0)[:, None] * _tom(hx(c), 0.82)), o)
    for (dx, dy, cor, faixa) in ((0.08, 0.05, '#e84a2a', '#f0d040'), (-0.08, 0.06, '#3a6ae0', '#e8e8e8')):
        b = (cx_ + dx - 0.06, cx_ + dx + 0.06, cy_ + dy - 0.035, cy_ + dy + 0.035, zb + 0.04, zb + 0.15)
        R = _p1_rampa([_hexs(cor, k) for k in (0.4, 0.55, 0.7, 0.85, 1.0, 1.1, 1.2)])
        def sb(L, n, P, b=b, faixa=faixa, R=R):
            m = _p1_mat_rampa(R, 1.5, 5.5)(L, n, P)
            fx = np.abs(P[:, 2] - (b[4] + b[5]) / 2) < 0.012
            return np.where(fx[:, None], _cru(hx(faixa), n), m)
        malha(b, (0.02, 0.015, 0.01, 0.02), emissivo(sb), seg=1)
    # a caixa de pizza torta por cima (inclinada, apoiada no monte)
    o = novo()
    zp = zb + 0.13
    pts = [(cx_ - 0.24, cy_ - 0.2, zp + 0.17), (cx_ + 0.02, cy_ - 0.2, zp + 0.17), (cx_ + 0.02, cy_ + 0.06, zp - 0.04), (cx_ - 0.24, cy_ + 0.06, zp - 0.04)]

    def pizza(L, n, P):
        out = np.tile(hx('#d8b07a'), (len(P), 1))
        d = np.hypot(P[:, 0] - (cx_ - 0.11), P[:, 1] - (cy_ - 0.07))
        out = np.where(((d > 0.07) & (d < 0.07 + PH))[:, None], hx('#a8442a'), out)
        return np.where((d < 0.025)[:, None], hx('#c8582a'), out)
    C().face_plana(pts, (0.0, 0.62, 0.78), emissivo(pizza), M, o, dois_lados=True)
    pts2 = [(x, y, z - 0.025) for (x, y, z) in pts]
    for i in range(4):
        a, b = pts[i], pts[(i + 1) % 4]
        a2, b2 = pts2[i], pts2[(i + 1) % 4]
        nx, ny = b[1] - a[1], -(b[0] - a[0])
        C().face_plana([a2, b2, b, a], (nx, ny, 0), liso('#b8905a'), M, o, dois_lados=True)
    _lata(cx_ + 0.08, cy_ - 0.06, zb + 0.06, '#3ad060')
    # o que caiu no chão: a lata deitada e as bolas de papel
    _lata(cx_ + 0.1, cy_ + 0.3, 0.0, '#9a4ae0', deitada=True, ang=0.4)
    for (dx, dy) in ((-0.2, 0.25), (0.28, 0.08)):
        o = novo()
        C().elipsoide(np.array([cx_ + dx, cy_ + dy, 0.04]), np.array([0.045, 0.045, 0.04]), liso('#ece8e0'), o)
    peg(cx_ - r1, cx_ + r1, cy_ - r1, cy_ + r1)


def parts_boxes():
    """
    As caixas de componentes (0,5 m): a caixa grande aberta embaixo com os cabos saindo, a menor por cima, torta e
    aberta, e o teclado velho encostado do lado.
    """
    caixa_papelao(0.06, 0.66, 0.1, 0.66, 0.0, 0.3, aberta=True, seed=3, abas=False)
    # os cabos saindo da grande (alças coloridas)
    for (dx, cor) in ((0.12, '#2a2a2e'), (0.32, '#c83a2a'), (0.45, '#3a6ae0')):
        o = novo()
        BE._fita([(-0.06, 0.25), (-0.03, 0.36), (0.03, 0.38), (0.06, 0.28)], 0.06 + dx, 0.6, liso(cor), o, 0.02)
    # a caixa menor por cima, torta
    o = novo()
    z0, z1 = 0.3, 0.5
    pts = ret_girado(0.32, 0.36, 0.18, 0.2, 0.16)
    c0 = hx(PAPELAO)

    def lado(L, n, P):
        if n[2] > 0.5:
            return np.tile(_tom(c0, 0.5), (len(P), 1))
        s = suave(np.floor(P[:, 0] / (2 * PH)), np.floor(P[:, 2] / (2 * PZ)), 3.0, 9)
        return np.where((s > 0.72)[:, None], _tom(c0, 0.9), _tom(c0, 1.04))
    prisma(pts, z0, z1, emissivo(lado), o)
    # o que tem dentro: o emaranhado de fios e as plaquinhas
    for (dx, dy, cor) in ((0.0, 0.0, '#2a7a48'), (0.06, -0.04, '#2a2a2e')):
        cx((0.32 + dx - 0.05, 0.32 + dx + 0.05, 0.36 + dy - 0.04, 0.36 + dy + 0.04, z1 - 0.02, z1 + 0.01), liso(cor))
    o = novo()
    BE._fita([(-0.08, z1 - 0.02), (-0.04, z1 + 0.06), (0.02, z1 + 0.04), (0.06, z1 + 0.08), (0.1, z1 + 0.01)], 0.32, 0.36, liso('#e0b030'), o, 0.016)
    # o teclado velho encostado (inclinado na frente da caixa grande)
    o = novo()
    kx0, kx1 = 0.12, 0.6
    yb, zt_ = 0.72, 0.2
    pts = [(kx0, yb, 0.0), (kx1, yb, 0.0), (kx1, yb - 0.05, zt_), (kx0, yb - 0.05, zt_)]

    def tec(L, n, P):
        i = np.floor((P[:, 0] - kx0) / PH)
        j = np.floor(P[:, 2] / PZ)
        out = np.tile(hx('#8a8470'), (len(P), 1))
        tecla = (i % 3 != 2) & (j % 3 != 2) & (i > 0) & (i < (kx1 - kx0) / PH - 1) & (j > 0) & (j < zt_ / PZ - 1)
        return np.where(tecla[:, None], hx('#d8d0b8'), out)
    C().face_plana(pts, (0, 0.97, 0.24), emissivo(tec), M, o)
    C().face_plana(pts[::-1], (0, -0.97, -0.24), liso('#a8a08a'), M, o)
    peg(0.06, 0.66, 0.1, 0.72)


def printer_dot():
    """
    A impressora matricial (1 m): o suporte de aço com a prateleira, a impressora bege com a tampa fumê e os puxadores
    de papel, o papel contínuo (a faixa com os furinhos e as linhas) saindo da caixa embaixo e caindo em sanfona na
    frente até o chão.
    """
    x0, x1 = 0.12, 0.63
    y0, y1 = 0.08, 0.58
    zs = 0.72
    h = 1.63 / UN
    COR = '#3e4246'
    for (a, b) in ((x0, y0), (x1 - 0.03, y0), (x0, y1 - 0.03), (x1 - 0.03, y1 - 0.03)):
        cx((a, a + 0.03, b, b + 0.03, 0.0, zs), {'cima': liso('#5a5e62'), '*': metal(COR, quina=False)})
    for z in (0.12, zs - 0.03):
        cx((x0, x1, y0, y1, z, z + 0.03), {'cima': liso('#5a5e62'), '*': metal(COR, (0, 0, 0, 0, z, z + 0.03), quina=1.25)})
    # a caixa de papel na prateleira de baixo (a pilha de formulário)

    def pilha(L, n, P):
        if n[2] > 0.5:
            return np.where((np.floor(P[:, 0] / PH) % 9 < 1)[:, None], hx('#c8d8c0'), hx('#f0ecdc'))
        return np.where((np.floor(P[:, 2] / PZ) % 2 == 0)[:, None], hx('#e8e4d4'), hx('#d0ccbc'))
    cx((x0 + 0.06, x1 - 0.06, y0 + 0.06, y1 - 0.12, 0.15, 0.3), emissivo(pilha))
    # a impressora
    pz0, pz1 = zs, zs + 0.16
    COR_P = '#d4ccb4'
    cx((x0 + 0.01, x1 - 0.01, y0 + 0.06, y1 - 0.04, pz0, pz1), {'frente': ventilado(COR_P, passo=3, larg=0.1, so=(x0 + 0.06, x1 - 0.18, pz0 + 0.03, pz0 + 0.08), b=(0, 0, 0, 0, pz0, pz1)),
                                                                '*': metal(COR_P, (0, 0, 0, 0, pz0, pz1), quina=1.08)})
    # a tampa fumê inclinada e os botões
    cx((x0 + 0.05, x1 - 0.05, y0 + 0.12, y1 - 0.14, pz1, pz1 + 0.03), {'cima': liso('#5a5650'), '*': liso('#4a4640')})
    leds('+y', y1 - 0.039, [x1 - 0.12, x1 - 0.09], pz0 + 0.1, ['#7af08a', '#ffb43a'], True, w=2)
    for xx in (x0 + 0.03, x1 - 0.05):
        cx((xx, xx + 0.02, (y0 + y1) / 2 - 0.04, (y0 + y1) / 2 + 0.04, pz0 + 0.05, pz0 + 0.11), metal('#2a2a2e'))
    # o papel: sobe da caixa por trás, passa pela impressora e sai por cima, caindo na frente em sanfona

    def papel(L, n, P):
        u = (P[:, 0] - (x0 + 0.08)) / PH
        out = np.tile(hx('#f2eee0'), (len(P), 1))
        borda = (u < 2) | (u > (x1 - x0 - 0.16) / PH - 2)
        furo = borda & (np.floor(P[:, 2] / PZ + P[:, 1] / PH) % 3 == 0)
        out = np.where(borda[:, None], hx('#e4e0d0'), out)
        out = np.where(furo[:, None], hx('#a8a498'), out)
        # as faixas verdes do formulário e as linhas de "texto"
        s = np.floor(P[:, 2] / PZ + P[:, 1] / PH)
        out = np.where((~borda & (s % 8 < 3))[:, None], hx('#cfe0c8'), out)
        lin = ~borda & (s % 2 == 0) & (u > 4) & (u < 4 + (ruido(s, 3.1) * ((x1 - x0 - 0.16) / PH - 8)))
        return np.where(lin[:, None], hx('#7a7a74'), out)
    o = novo()
    a0, a1 = x0 + 0.08, x1 - 0.08
    yt = y1 - 0.06
    # a folha saindo em cima, dobrando para a frente
    C().face_plana([(a0, y0 + 0.2, pz1 + 0.04), (a1, y0 + 0.2, pz1 + 0.04), (a1, yt, pz1 + 0.02), (a0, yt, pz1 + 0.02)], (0, 0.05, 1), emissivo(papel), M, o, dois_lados=True)
    # a cortina de papel caindo na frente da impressora e do suporte
    zz = pz1 + 0.02
    yy = yt
    k = 0
    while zz > 0.12:
        z2 = max(0.0, zz - 0.18)
        y2 = y1 + 0.04 + (0.03 if k % 2 == 0 else 0.0)
        C().face_plana([(a0, yy, zz), (a1, yy, zz), (a1, y2, z2), (a0, y2, z2)], (0, 1, 0.1), emissivo(papel), M, o, dois_lados=True)
        zz, yy = z2, y2
        k += 1
    # a pilha dobrada no chão
    for j in range(6):
        cx((a0 - 0.005 * (j % 2), a1 - 0.005 * (j % 2), y1 + 0.02, y1 + 0.17, j * 0.012, (j + 1) * 0.012), emissivo(pilha))
    peg(x0, x1, y0, y1 + 0.17)


def ups():
    """
    O nobreak e o estabilizador (0,3 m): a torre preta do nobreak com o painel de leds e o botão, o estabilizador bege
    ao lado com as tomadas e a chave; o tampo é plano na altura do `height` (dá para empilhar).
    """
    h = 0.49 / UN
    # o nobreak
    x0, x1, y0, y1 = 0.08, 0.36, 0.08, 0.68
    cx((x0, x1, y0, y1, 0.0, h), {'frente': metal('#1e1e22', (0, 0, 0, 0, 0, h)), '*': ventilado('#222226', passo=3, larg=0.1, so=(y0 + 0.1, y1 - 0.1, 0.05, h - 0.05), b=(0, 0, 0, 0, 0, h), topo='#34343a')})
    placa('+y', y1 + 0.001, x0 + 0.04, x1 - 0.04, h - 0.1, h - 0.03, liso('#2e2e34'))
    leds('+y', y1 + 0.002, [x0 + 0.06, x0 + 0.06 + 3 * PH, x0 + 0.06 + 6 * PH, x0 + 0.06 + 9 * PH], h - 0.07, ['#5af07a', '#5af07a', '#5af07a', '#ffb43a'], True, w=2)
    o = novo()
    cil_eixo(((x0 + x1) / 2, y1, 0.1), ((x0 + x1) / 2, y1 + 0.012, 0.1), 0.025, liso('#3a3a40'), o, lados=12, tampa_mat=liso('#5a5a62'))
    # o estabilizador
    x0, x1, y0, y1 = 0.4, 0.68, 0.18, 0.62
    hb = h - 0.06
    cx((x0, x1, y0, y1, 0.0, hb), {'*': metal('#c8c0a8', (0, 0, 0, 0, 0, hb), topo='#d8d2bc')})
    for k in range(2):
        a = x0 + 0.05 + k * 0.1
        placa('+y', y1 + 0.001, a, a + 0.07, 0.06, 0.15, liso('#e8e2d0'))
        placa('+y', y1 + 0.002, a + 0.02, a + 0.02 + PH, 0.09, 0.12, liso('#3a3a3a'))
        placa('+y', y1 + 0.002, a + 0.045, a + 0.045 + PH, 0.09, 0.12, liso('#3a3a3a'))
    placa('+y', y1 + 0.002, x1 - 0.06, x1 - 0.03, hb - 0.06, hb - 0.03, liso('#c83a2a'), acesa=True)
    peg(0.08, 0.68, 0.08, 0.68)


def water_cooler():
    """
    O bebedouro (1,2 m): o gabinete branco com a frente cinza, as duas torneiras (azul e vermelha), a bandeja da
    pingadeira, o porta-copos do lado, e o galão de água azul em cima (o vidro com a água, a linha, o brilho).
    """
    cx_, cy_ = 0.375, 0.38
    h = 1.96 / UN
    x0, x1 = cx_ - 0.17, cx_ + 0.17
    y0, y1 = cy_ - 0.17, cy_ + 0.17
    zb = 0.86
    cx((x0, x1, y0, y1, 0.0, zb), {'frente': frente_metal('#e4e2dc', [(x0 + 0.03, x1 - 0.03, 0.08, 0.5)], (0, 0, 0, 0, 0, zb), etiqueta=False),
                                   '*': metal('#e4e2dc', (0, 0, 0, 0, 0, zb), topo='#f0eee8')})
    # o recorte das torneiras (escuro) e as torneiras
    placa('+y', y1 + 0.001, x0 + 0.04, x1 - 0.04, 0.58, 0.78, liso('#5a5e64'))
    for (dx, cor) in ((-0.06, '#3a6ae0'), (0.06, '#d83a2a')):
        cx((cx_ + dx - 0.02, cx_ + dx + 0.02, y1, y1 + 0.04, 0.7, 0.75), {'cima': liso(cor), '*': liso(_hexs(cor, 0.8))})
        cx((cx_ + dx - 0.012, cx_ + dx + 0.012, y1 + 0.02, y1 + 0.04, 0.67, 0.7), liso('#2a2a2e'))
    cx((x0 + 0.05, x1 - 0.05, y1, y1 + 0.06, 0.58, 0.6), {'cima': ventilado('#3a3e44', passo=2, larg=0.04), '*': liso('#3a3e44')})
    # o porta-copos do lado direito
    o = novo()
    cil_eixo((x1, cy_ + 0.04, 0.62), (x1 + 0.05, cy_ + 0.04, 0.62), 0.035, liso('#e8e8e4'), o, lados=12, tampa_mat=liso('#d0d0cc'))
    o = novo()
    C().cilindro(x1 + 0.025, cy_ + 0.04, 0.032, 0.32, 0.6, vol(x1 + 0.025, cy_ + 0.04, '#f2f2ee', brilho=0.3), M, o, lados=12, tampa=False)
    # o anel de cima e o galão
    o = novo()
    C().cilindro(cx_, cy_, 0.13, zb, zb + 0.03, vol(cx_, cy_, '#d8d6d0', brilho=0.3), M, o, lados=22, tampa_mat=liso('#c8c6c0'))

    def agua(P, b):
        zz = P[:, 2]
        b = np.where((zz > h - 0.1)[:, None], _tom(hx('#a8d4f0'), 1.05), b)
        b = np.where(((zz > h - 0.1) & (zz <= h - 0.1 + PZ))[:, None], hx('#e0f4ff'), b)
        for zc in (zb + 0.1, zb + 0.22):
            b = np.where((np.abs(zz - zc) < PZ * 0.6)[:, None], _tom(b, 0.82), b)
        return b
    o = novo()
    _poligono_rodado(cx_, cy_, [(zb + 0.03, 0.03), (zb + 0.06, 0.05), (zb + 0.08, 0.14), (h - 0.04, 0.14), (h, 0.12)],
                     vol(cx_, cy_, '#5aa0d8', brilho=0.6, faixas=agua), o, lados=24, tampa_mat=liso('#a8d4f0'))
    peg(x0, x1 + 0.05, y0, y1)


def whiteboard():
    """
    O quadro branco de rodinhas (3 casas, 1,8 m): os dois pés em T com os rodízios, as colunas, o quadro com a moldura
    de alumínio, a bandeja dos marcadores, e os rabiscos (as setas, os círculos, as caixas, as linhas, nada legível) em
    azul, vermelho e preto; as costas também brancas, mais limpas.
    """
    x0, x1 = 0.06, 2.19
    yc = 0.38
    zq0, zq1 = 0.62, 2.94 / UN - 0.04
    AL = metal('#a8acb0', topo='#c8ccd0', quina=1.2)
    for xx in (x0, x1 - 0.05):
        # o pé em T e os rodízios
        cx((xx - 0.02, xx + 0.07, yc - 0.3, yc + 0.3, 0.06, 0.1), metal('#5a5e64', (0, 0, 0, 0, 0.06, 0.1)))
        for yy in (yc - 0.27, yc + 0.27):
            bola((xx + 0.025, yy, 0.03), 0.03, '#1a1a1e')
        cx((xx, xx + 0.05, yc - 0.025, yc + 0.025, 0.1, zq1 + 0.04), {'cima': liso('#c8ccd0'), '*': metal('#8a8e94', quina=False)})
    # o quadro: a moldura de alumínio e as duas faces brancas

    def rabisco(lado):
        def f(L, n, P):
            u = (P[:, 0] - (x0 + 0.05)) / PH
            v = (zq1 - 0.03 - P[:, 2]) / PZ
            out = np.tile(hx('#f4f4f0'), (len(P), 1))
            # a sujeira de apagador (manchas cinza bem claras, em blocos)
            s = suave(np.floor(u / 2) * 2 * PH, np.floor(v / 2) * 2 * PZ, 0.25, 13 + lado)
            out = np.where((s > (0.7 if lado == 0 else 0.9))[:, None], hx('#eaecea'), out)
            if lado == 1:
                return out
            azul, verm, preto = hx('#2a4ab8'), hx('#c83a2a'), hx('#2a2a2e')
            marca = np.zeros(len(P), int)
            # os círculos
            for (cu, cv, r, k) in ((14, 10, 6.5, 1), (60, 22, 8, 2), (30, 30, 4.5, 3)):
                d = np.hypot(u - cu, (v - cv) * 1.2)
                marca = np.where(np.abs(d - r) < 0.65, k, marca)
            # as setas (a linha e a ponta)
            for (ua, va, ub, vb, k) in ((21, 11, 50, 20, 2), (60, 31, 36, 30, 1), (8, 20, 8, 34, 3)):
                t = np.clip(((u - ua) * (ub - ua) + (v - va) * (vb - va)) / ((ub - ua) ** 2 + (vb - va) ** 2), 0, 1)
                d = np.hypot(u - (ua + t * (ub - ua)), v - (va + t * (vb - va)))
                marca = np.where(d < 0.6, k, marca)
                ang = math.atan2(vb - va, ub - ua)
                for s_ in (2.5, -2.5):
                    pu, pv = ub - 4 * math.cos(ang + s_ * 0.25), vb - 4 * math.sin(ang + s_ * 0.25)
                    t = np.clip(((u - ub) * (pu - ub) + (v - vb) * (pv - vb)) / ((pu - ub) ** 2 + (pv - vb) ** 2), 0, 1)
                    d = np.hypot(u - (ub + t * (pu - ub)), v - (vb + t * (pv - vb)))
                    marca = np.where(d < 0.6, k, marca)
            # a caixa e as "linhas de texto" (traços curtos ondulados, nada legível)
            bx = ((np.abs(u - 76) <= 9) & (np.abs(v - 9) <= 5)) & ~((np.abs(u - 76) <= 8) & (np.abs(v - 9) <= 4))
            marca = np.where(bx, 3, marca)
            for (ua, va, comp, k) in ((70, 7, 12, 3), (70, 10, 9, 3), (70, 13, 11, 1), (40, 6, 14, 3), (40, 9, 10, 3), (6, 40, 18, 2), (6, 43, 13, 3)):
                ond = np.floor(va + 0.7 * np.sin(u * 1.3))
                ok = (u >= ua) & (u < ua + comp) & (np.floor(v) == ond) & (np.floor(u) % 5 != 4)
                marca = np.where(ok, k, marca)
            out = np.where((marca == 1)[:, None], azul, out)
            out = np.where((marca == 2)[:, None], verm, out)
            out = np.where((marca == 3)[:, None], preto, out)
            return out
        return emissivo(f)
    cx((x0 + 0.05, x1 - 0.05, yc - 0.02, yc + 0.02, zq0, zq1), {'frente': rabisco(0), 'costas': rabisco(1), '*': AL})
    for (a0, a1, z0, z1) in ((x0 + 0.05, x1 - 0.05, zq1, zq1 + 0.025), (x0 + 0.05, x1 - 0.05, zq0 - 0.025, zq0)):
        cx((a0, a1, yc - 0.026, yc + 0.026, z0, z1), AL)
    for xx in (x0 + 0.05, x1 - 0.07):
        cx((xx, xx + 0.02, yc - 0.026, yc + 0.026, zq0, zq1), AL)
    # a bandeja e os marcadores
    cx((x0 + 0.5, x1 - 0.5, yc + 0.02, yc + 0.08, zq0 - 0.04, zq0 - 0.02), AL)
    for (dx, cor) in ((0.0, '#2a4ab8'), (0.14, '#c83a2a'), (0.24, '#2a2a2e')):
        o = novo()
        cil_eixo((x0 + 0.7 + dx, yc + 0.05, zq0 - 0.008), (x0 + 0.82 + dx, yc + 0.05, zq0 - 0.008), 0.012, liso('#e8e8e4'), o, lados=8, tampa_mat=liso(cor))
    o = novo()
    cx((x1 - 0.8, x1 - 0.66, yc + 0.03, yc + 0.075, zq0 - 0.02, zq0 + 0.01), {'cima': liso('#3a3a3e'), '*': liso('#2a4ab8')})
    peg(x0, x1, yc - 0.3, yc + 0.3)


def mesa_holografica(ligada=True, vazio=False):
    """
    A mesa holográfica (2 x 2 casas, 1 m): a mesa redonda de metal escuro no pedestal, o tampo de vidro preto com o
    anel de luz ciano e o emissor no meio; ligada, o feixe sobe e o mapa da cidade flutua no ar em linhas de luz
    (a grade, os prédios em arame, os pontos); desligada, tudo apagado.
    vazio: a gêmea esvaziada (mesa_holografica!vazio): o mapa foi tirado da mesa; ligada, só o vidro com a grade e o
    emissor aceso, sem o feixe e sem o mapa no ar.
    """
    cx_, cy_ = 0.75, 0.75
    r = 0.68
    h = 1.63 / UN
    # o pedestal (a base em degraus) e a coluna
    o = novo()
    _poligono_rodado(cx_, cy_, [(0.0, 0.42), (0.05, 0.42), (0.08, 0.36), (0.12, 0.2), (0.18, 0.14)], vol(cx_, cy_, '#2a2c34', brilho=0.3), o, lados=32,
                     tampa_mat=liso('#3a3c44'))
    o = novo()
    C().cilindro(cx_, cy_, 0.13, 0.18, h - 0.12, vol(cx_, cy_, '#22242a', brilho=0.4), M, o, lados=24, tampa=False)
    # as faixas de luz na coluna
    for zz in (0.35, 0.6):
        o = novo(contorno=False)
        C().cilindro(cx_, cy_, 0.132, zz, zz + 2 * PZ, liso('#4ae0f0' if ligada else '#2a3a40'), M, o, lados=24, tampa=False)
        if ligada:
            luz(o)
    # o tampo: a borda de metal e o vidro preto com o anel
    o = novo()
    C().cilindro(cx_, cy_, r, h - 0.08, h, vol(cx_, cy_, '#30323a', brilho=0.4), M, o, lados=48, tampa=False, r1=r)
    o = novo()
    C().cilindro(cx_, cy_, r - 0.08, h - 0.14, h - 0.08, vol(cx_, cy_, '#1e2026', brilho=0.3), M, o, lados=40, tampa=False, r1=r)

    def vidro(L, n, P):
        d = np.hypot(P[:, 0] - cx_, P[:, 1] - cy_)
        out = np.tile(hx('#14161c'), (len(P), 1))
        out = np.where((d > r - 0.06)[:, None], hx('#3a3c44'), out)
        out = np.where((d > r - PH)[:, None], hx('#5a5c66'), out)
        anel = (d > r - 0.1) & (d <= r - 0.06)
        out = np.where(anel[:, None], hx('#5ae8f8') if ligada else hx('#24343a'), out)
        if ligada:
            # o mapa projetado no vidro (a grade fraca) e o emissor
            g = ((np.floor(P[:, 0] / PH) % 6 == 0) | (np.floor(P[:, 1] / PH) % 6 == 0)) & (d < r - 0.14)
            out = np.where(g[:, None], hx('#1e4a58'), out)
            out = np.where((d < 0.08)[:, None], hx('#c8fcff'), out)
            out = np.where(((d >= 0.08) & (d < 0.1))[:, None], hx('#4ae0f0'), out)
        else:
            out = np.where((d < 0.1)[:, None], hx('#2a2e36'), out)
            ref = (np.abs((P[:, 0] - cx_) - (P[:, 1] - cy_) + 0.2) < PH) & (d < r - 0.12)
            out = np.where(ref[:, None], hx('#2a2e36'), out)
        return out
    o = novo()
    _disco(cx_, cy_, h, r, emissivo(vidro), o, lados=48)
    if ligada and not vazio:
        # o feixe: as linhas de luz subindo do emissor até o mapa
        zm = h + 0.42
        ob = luz(novo(contorno=False, sombra=False))
        for k in range(6):
            a = 2 * math.pi * k / 6 + 0.3
            haste((cx_ + 0.05 * math.cos(a), cy_ + 0.05 * math.sin(a), h + 0.005), (cx_ + 0.34 * math.cos(a), cy_ + 0.34 * math.sin(a), zm - 0.01),
                  PH * 0.9, liso('#7af0ff'), ob)
        # o mapa no ar: a grade quadrada de linhas, os prédios em arame e os pontos
        og = luz(novo(contorno=False, sombra=False))
        L_ = 0.36
        for i in range(7):
            t = -L_ + 2 * L_ * i / 6
            cx((cx_ - L_, cx_ + L_, cy_ + t - PH / 2, cy_ + t + PH / 2, zm, zm + PZ * 0.6), liso('#3ad0e8'), og)
            cx((cx_ + t - PH / 2, cx_ + t + PH / 2, cy_ - L_, cy_ + L_, zm, zm + PZ * 0.6), liso('#3ad0e8'), og)
        for (bx_, by_, bw, bh, cor) in ((-0.22, -0.16, 0.1, 0.2, '#9af8ff'), (0.04, -0.22, 0.12, 0.13, '#9af8ff'), (0.14, 0.08, 0.08, 0.28, '#d0a8ff'),
                                        (-0.14, 0.14, 0.1, 0.09, '#9af8ff'), (-0.02, -0.02, 0.07, 0.17, '#9af8ff')):
            xa, xb, ya, yb = cx_ + bx_, cx_ + bx_ + bw, cy_ + by_, cy_ + by_ + bw
            c1 = hx(cor)

            def holo(L, n, P, xa=xa, xb=xb, ya=ya, yb=yb, zb_=zm + bh, c1=c1):
                X, Y, Z = P[:, 0], P[:, 1], P[:, 2]
                if n[2] > 0.5:
                    ed = (X < xa + PH) | (X > xb - PH) | (Y < ya + PH) | (Y > yb - PH)
                elif abs(n[1]) >= abs(n[0]):
                    ed = (X < xa + PH) | (X > xb - PH) | (Z > zb_ - PZ)
                else:
                    ed = (Y < ya + PH) | (Y > yb - PH) | (Z > zb_ - PZ)
                base = np.array([10.0, 40.0, 60.0])
                fundo = np.where((np.floor(Z / PZ) % 3 == 0)[:, None], c1 * 0.5 + base * 0.5, c1 * 0.36 + base * 0.64)
                return np.where(ed[:, None], c1, fundo)
            op = luz(novo(contorno=False, sombra=False))
            cx((xa, xb, ya, yb, zm, zm + bh), emissivo(holo), op)
        # o alvo: o ponto vermelho pulsando no meio do mapa
        oa = luz(novo(contorno=False, sombra=False))
        C().elipsoide(np.array([cx_ - 0.04, cy_ + 0.02, zm + 0.04]), np.array([0.025, 0.025, 0.025]), liso('#ff5a7a'), oa)
    peg(cx_ - 0.42, cx_ + 0.42, cy_ - 0.42, cy_ + 0.42)


def fluorescent(acesa=True):
    """
    A luminária fluorescente do teto (a régua de tubos, no alto a 2,4 m): a calha estreita de chapa branca no meio e
    os dois tubos à mostra dos lados, presos nos soquetes das pontas (acesos: o branco-azulado chapado e claro, que
    se vê de longe; apagados: o vidro cinza), e os dois fios que sobem e somem em transparência antes da viga.
    """
    xc = 0.375
    y0, y1 = 0.02, 0.73
    z1 = 2.46
    COR = '#e4e6e4'
    # a calha do meio
    o = novo()
    cx((xc - 0.045, xc + 0.045, y0 + 0.02, y1 - 0.02, z1 - 0.05, z1), metal('#b4b8b8', (0, 0, 0, 0, z1 - 0.05, z1), topo='#c4c8c6', quina=1.04), o)
    # os soquetes das pontas (a placa que segura os tubos)
    for (b0, b1) in ((y0, y0 + 0.025), (y1 - 0.025, y1)):
        cx((xc - 0.13, xc + 0.13, b0, b1, z1 - 0.075, z1 - 0.01), metal('#a8acac', (0, 0, 0, 0, z1 - 0.075, z1 - 0.01)))
    # os tubos
    for xx in (xc - 0.09, xc + 0.09):
        if acesa:
            ot = luz(novo(contorno=False, sombra=False))

            def tubo(L, n, P, xx=xx):
                d = P[:, 0] - xx
                out = np.tile(hx('#f4fbff'), (len(P), 1))
                out = np.where((d < -0.016)[:, None], hx('#c8e8fa'), out)
                return np.where((np.abs(d + 0.004) < 0.005)[:, None], hx('#ffffff'), out)
            cil_eixo((xx, y0 + 0.025, z1 - 0.045), (xx, y1 - 0.025, z1 - 0.045), 0.03, emissivo(tubo), ot, lados=10)
        else:
            ot = novo(sombra=False)
            cil_eixo((xx, y0 + 0.025, z1 - 0.045), (xx, y1 - 0.025, z1 - 0.045), 0.03, liso('#7e8488'), ot, lados=10)
    # os fios
    of = novo(sombra=False, contorno=False)
    for yy in (y0 + 0.12, y1 - 0.12):
        cx((xc - 0.008, xc + 0.008, yy - 0.008, yy + 0.008, z1, 2.84), liso('#2a2420'), of)
    CZ.fades.append((of, 2.55, 0.28))


def papers():
    """Os papéis espalhados no chão (decalque de 1 px): as folhas tortas, uma dobrada, as linhas de texto apagadas."""
    folhas = ((0.25, 0.3, 0.5, 0.21, 0.28, '#f0eadc', 3), (0.48, 0.42, -0.35, 0.21, 0.28, '#e8e2d0', 5), (0.32, 0.58, 1.1, 0.21, 0.28, '#f2ecde', 7),
              (0.55, 0.18, 0.2, 0.15, 0.2, '#e0d8c0', 9))
    for k, (x, y, a, w, d, cor, sd) in enumerate(folhas):
        o = novo(contorno=False)          # (sombra=True só para a medida 'real'; sem pegada, o chão não escurece)
        pts = ret_girado(x, y, a, w / 2, d / 2)

        def folha(L, n, P, x=x, y=y, a=a, w=w, d=d, cor=cor, sd=sd):
            u = (P[:, 0] - x) * math.cos(a) + (P[:, 1] - y) * math.sin(a)
            v = -(P[:, 0] - x) * math.sin(a) + (P[:, 1] - y) * math.cos(a)
            out = np.tile(hx(cor), (len(P), 1))
            borda = (np.abs(u) > w / 2 - PH) | (np.abs(v) > d / 2 - PH)
            out = np.where(borda[:, None], _tom(hx(cor), 0.8), out)
            lv = np.floor((v + d / 2) / PH)
            lin = (lv % 2 == 0) & (lv > 1) & (lv < d / PH - 2) & (np.abs(u) < w / 2 - 2 * PH)
            lin &= (u + w / 2 - 2 * PH) / (w - 4 * PH) < 0.55 + 0.45 * ruido(lv, sd)
            out = np.where(lin[:, None], hx('#a8a090'), out)
            # a dobra (a folha 2: a metade de cima mais escura, como dobrada)
            if sd == 5:
                out = np.where((v > d * 0.15)[:, None], _tom(out, 0.9), out)
            return out
        C().face_plana([(px_, py_, PZ * 0.5 + k * 0.0005) for (px_, py_) in pts], (0, 0, 1), emissivo(folha), M, o)


# =====================================================================================================================
# o catálogo deste grupo: def -> (largura, fundo em casas, a quina da pegada, o desenho, {estado: desenho})
# =====================================================================================================================
ITENS = {
    'chair_office': (1, 1, (0.0, 0.0), chair_office, {}),
    'cadeira_gamer': (1, 1, (0.0, 0.0), cadeira_gamer, {}),
    'chair_verissimo': (1, 1, (0.0, 0.0), chair_verissimo, {}),
    'armchair_verissimo': (1, 1, (0.0, 0.0), armchair_verissimo, {}),
    'sofa_verissimo': (3, 1, (0.0, 0.0), sofa_verissimo, {}),
    'desk_verissimo': (3, 2, (0.0, 0.0), desk_verissimo, {}),
    'shelf_verissimo': (6, 1, (0.0, 0.0), shelf_verissimo, {}),
    'desk_metal': (2, 1, (0.0, 0.0), desk_metal, {}),
    'table_work': (3, 2, (0.0, 0.0), table_work, {}),
    'desk_u': (6, 4, (0.0, 0.0), desk_u, {}),
    'monitor': (1, 1, (0.0, 0.0), lambda: monitor(True), {'1': lambda: monitor(False)}),
    'console': (2, 1, (0.0, 0.0), lambda: console(True), {'1': lambda: console(False)}),
    'cabinet_file': (1, 1, (0.0, 0.0), lambda: cabinet_file(False), {'1': lambda: cabinet_file(True)}),
    'server_rack': (1, 1, (0.0, 0.0), server_rack, {}),
    'rack_moderno': (1, 2, (0.0, 0.0), rack_moderno, {}),
    'torre_crt': (2, 1, (0.0, 0.0), torre_crt, {}),
    'ups': (1, 1, (0.0, 0.0), ups, {}),
    'printer_dot': (1, 1, (0.0, 0.0), printer_dot, {}),
    'media_shelf': (2, 1, (0.0, 0.0), media_shelf, {}),
    'parts_boxes': (1, 1, (0.0, 0.0), parts_boxes, {}),
    'bancada_eletronica': (2, 1, (0.0, 0.0), bancada_eletronica, {}),
    'gravador_rolo': (1, 1, (0.0, 0.0), gravador_rolo, {}),
    'camera_tripe': (1, 1, (0.0, 0.0), camera_tripe, {}),
    'frigobar_energetico': (1, 1, (0.0, 0.0), frigobar_energetico, {}),
    'lixeira_lanches': (1, 1, (0.0, 0.0), lixeira_lanches, {}),
    'water_cooler': (1, 1, (0.0, 0.0), water_cooler, {}),
    'whiteboard': (3, 1, (0.0, 0.0), whiteboard, {}),
    'mesa_holografica': (2, 2, (0.0, 0.0), lambda: mesa_holografica(True), {'1': lambda: mesa_holografica(False)}),
    # as gêmeas vazias (o jogo troca quando os jogadores pegam o que estava em cima/dentro): o mesmo móvel, a mesma
    # pegada e a mesma âncora, sem os objetos soltos
    'bancada_eletronica!vazio': (2, 1, (0.0, 0.0), lambda: bancada_eletronica(True), {}),
    'mesa_holografica!vazio': (2, 2, (0.0, 0.0), lambda: mesa_holografica(True, True), {'1': lambda: mesa_holografica(False, True)}),
    'rack_moderno!vazio': (1, 2, (0.0, 0.0), lambda: rack_moderno(True), {}),
    'torre_crt!vazio': (2, 1, (0.0, 0.0), lambda: torre_crt(True), {}),
    'fluorescent': (1, 1, (0.0, 0.0), lambda: fluorescent(True), {'1': lambda: fluorescent(False)}),
    'papers': (1, 1, (0.0, 0.0), papers, {}),
}
