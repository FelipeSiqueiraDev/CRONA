"""
GRUPO G, "ocultismo, sangue e queimado": os decalques de chão (sangue, fuligem, cinza, sujeira, poça, ralo, cera,
sigilos, cabos) e as peças do horror (o altar, o estrado e a pedra do ritual, os crânios, os corpos cobertos, os
ganchos, as vitrines e pedestais da Ordem, o monitor tomado pela Energia) e o Orfanato QUEIMADO (a cama carbonizada,
os escombros, a viga caída, o catre, o colchão no chão, a fogueira do bando), mais o que sobra da Sede (a lixeira, a
placa de piso molhado, o carrinho de limpeza, a grade de ventilação), em pixel art 1:1 no estilo da cozinha.

Tudo no giro 4 (a frente para +y), a pegada começando em (0, 0), no tamanho final do catálogo (def.height / 1,633 em
metros; o `aumento` já entra). O exportador (exportar_px.py) gira e faz o acabamento.

Decisões:
  - decalque de chão: uma placa de 1 px (só o topo, a z ~ 0), sem pegada (sem sombra) e sem o contorno do motor; a
    forma é feita de polígonos convexos (leques de triângulos em volta de "manchas" de raio irregular, anéis e riscas),
    e a beira escura de 1 px é pintada pelo material (a distância até a borda da mancha). Nada de pixel solto.
  - os sigilos são INVENTADOS (anéis, raios e marcas de traço próprio), nada de símbolo da Ordem nem de outro lugar.
  - fogueira: o fogo é desenhado como peças (as línguas são polígonos de frente para a câmera, sem luz de face nem
    contorno: CZ.luzes), para aparecer nos 4 giros; o FOGO do exportador é o da fornalha da cozinha (não serve aqui).
    Estado 0 acesa, '1' apagada (as toras pretas, a cinza e uma brasa fraca).
  - monitor_energia: estado 0 ligado (a tela clara, as veias acesas), '1' desligado.
  - horror sem gore: o que se vê são panos, sacos, manchas e formas; nada de carne exposta.
"""
import math

import numpy as np

import cozinha as CZ
import base_estilo as BE
from base_estilo import (hx, liso, mad2, tab2, vol, _tom, _pau, _barra, _p1_malha, _poligono_rodado, _disco, _fita,
                         PH, PZ)
from motor import emissivo, ruido, suave, KX, KZ

M = BE.M
CASA = 0.75
UN = 1.633                      # unidades do jogo por metro
ZD = 0.004                      # a altura do decalque (a placa de 1 px fica rente ao chão)


def C():
    return CZ.c


def novo(contorno=True, sombra=True):
    return C().novo_obj(3, contorno=contorno, sombra=sombra)


def caixa(b, mat, o=None, sombra=True):
    o = novo(sombra=sombra) if o is None else o
    C().caixa(b, mat, M, o)
    return o


def fp(pts, n, mat, o, dois_lados=False):
    C().face_plana(pts, n, mat, M, o, dois_lados)


def peg(x0, x1, y0, y1):
    CZ.pegadas.append((x0, x1, y0, y1))


def _n(pts):
    """A normal de um polígono plano (pelo sentido dos pontos)."""
    P = np.asarray(pts, float)
    n = np.zeros(3)
    for i in range(len(P)):
        a, b = P[i], P[(i + 1) % len(P)]
        n += np.cross(a, b)
    return n / (np.linalg.norm(n) or 1.0)


def bloco(cen, tam, mat, yaw=0.0, pitch=0.0, roll=0.0, o=None, sombra=True):
    """
    Uma caixa girada (o entulho, a viga caída, a telha quebrada): o centro, o tamanho (ao longo de x, y, z da caixa) e
    os giros em graus (yaw em volta de z, pitch levanta a ponta +y, roll tomba de lado). Todas as faces.
    """
    o = novo(sombra=sombra) if o is None else o
    a, b, c_ = (np.radians(v) for v in (yaw, pitch, roll))
    Rz = np.array([[math.cos(a), -math.sin(a), 0], [math.sin(a), math.cos(a), 0], [0, 0, 1]])
    Rx = np.array([[1, 0, 0], [0, math.cos(b), -math.sin(b)], [0, math.sin(b), math.cos(b)]])
    Ry = np.array([[math.cos(c_), 0, math.sin(c_)], [0, 1, 0], [-math.sin(c_), 0, math.cos(c_)]])
    R = Rz @ Rx @ Ry
    h = np.array(tam, float) / 2
    cen = np.array(cen, float)

    def p(sx, sy, sz):
        return tuple(cen + R @ (h * np.array([sx, sy, sz])))
    faces = {
        'cima': ([p(-1, -1, 1), p(1, -1, 1), p(1, 1, 1), p(-1, 1, 1)], R @ [0, 0, 1]),
        'baixo': ([p(-1, -1, -1), p(-1, 1, -1), p(1, 1, -1), p(1, -1, -1)], R @ [0, 0, -1]),
        'frente': ([p(-1, 1, -1), p(-1, 1, 1), p(1, 1, 1), p(1, 1, -1)], R @ [0, 1, 0]),
        'costas': ([p(-1, -1, -1), p(1, -1, -1), p(1, -1, 1), p(-1, -1, 1)], R @ [0, -1, 0]),
        'dir': ([p(1, -1, -1), p(1, 1, -1), p(1, 1, 1), p(1, -1, 1)], R @ [1, 0, 0]),
        'esq': ([p(-1, -1, -1), p(-1, -1, 1), p(-1, 1, 1), p(-1, 1, -1)], R @ [-1, 0, 0]),
    }
    for nome, (pts, n) in faces.items():
        m = mat.get(nome, mat.get('*')) if isinstance(mat, dict) else mat
        if m is not None:
            fp(pts, tuple(n), m, o)
    return o


def prisma(pts2, z0, z1, mat, o=None, topo=None, sombra=True):
    """Um prisma de base convexa (a pedra lascada, o caco de reboco): os pontos (x, y) da base, de z0 a z1."""
    o = novo(sombra=sombra) if o is None else o
    k = len(pts2)
    area = sum(pts2[i][0] * pts2[(i + 1) % k][1] - pts2[(i + 1) % k][0] * pts2[i][1] for i in range(k))
    if area < 0:
        pts2 = pts2[::-1]
    fp([(x, y, z1) for (x, y) in pts2], (0, 0, 1), topo or mat, o)
    for i in range(k):
        (xa, ya), (xb, yb) = pts2[i], pts2[(i + 1) % k]
        n = (yb - ya, -(xb - xa), 0.0)
        fp([(xa, ya, z0), (xb, yb, z0), (xb, yb, z1), (xa, ya, z1)], n, mat, o)
    return o


# =====================================================================================================================
# os decalques: manchas de raio irregular (leque de triângulos), anéis e riscas, num objeto sem contorno do motor
# =====================================================================================================================
class Mancha:
    """
    Uma mancha de raio irregular em volta de (cx, cy): r(θ) = r·(1 + Σ a·sen(kθ + φ)), esticada (ex, ey) e girada
    (ang). `d(X, Y)` é quanto o ponto está para dentro da borda (m; > 0 dentro), para pintar a beira.
    """

    def __init__(self, cx, cy, r, seed=0, amp=0.22, ex=1.0, ey=1.0, ang=0.0, lobos=(2, 3, 5, 7), n=40):
        self.cx, self.cy, self.r = cx, cy, r
        self.ex, self.ey, self.ang = ex, ey, math.radians(ang)
        rng = np.random.default_rng(seed + 101)
        self.ondas = [(k, amp * rng.uniform(0.3, 1.0) / (1 + 0.35 * i), rng.uniform(0, 2 * math.pi)) for i, k in enumerate(lobos)]
        self.n = n

    def raio(self, th):
        return self.r * (1 + sum(a * np.sin(k * th + f) for (k, a, f) in self.ondas))

    def _loc(self, X, Y):
        ca, sa = math.cos(self.ang), math.sin(self.ang)
        u = ((X - self.cx) * ca + (Y - self.cy) * sa) / self.ex
        v = (-(X - self.cx) * sa + (Y - self.cy) * ca) / self.ey
        return u, v

    def d(self, X, Y):
        u, v = self._loc(X, Y)
        th = np.arctan2(v, u)
        return (self.raio(th) - np.hypot(u, v)) * min(self.ex, self.ey)

    def pontos(self):
        ca, sa = math.cos(self.ang), math.sin(self.ang)
        out = []
        for i in range(self.n):
            th = 2 * math.pi * i / self.n
            rr = float(self.raio(th))
            u, v = rr * math.cos(th) * self.ex, rr * math.sin(th) * self.ey
            out.append((self.cx + u * ca - v * sa, self.cy + u * sa + v * ca))
        return out


def _leque(m):
    """Os triângulos (convexos) da mancha, do centro para a borda."""
    pts = m.pontos()
    return [[(m.cx, m.cy), pts[i], pts[(i + 1) % len(pts)]] for i in range(len(pts))]


def anel(cx, cy, r0, r1, a0=0.0, a1=360.0, n=None, ex=1.0, ey=1.0):
    """Os quadriláteros de um anel (ou arco, de a0 a a1 graus), opcionalmente achatado."""
    n = n or max(8, int(abs(a1 - a0) / 6))
    out = []
    for i in range(n):
        t0 = math.radians(a0 + (a1 - a0) * i / n)
        t1 = math.radians(a0 + (a1 - a0) * (i + 1) / n)
        out.append([(cx + r0 * math.cos(t0) * ex, cy + r0 * math.sin(t0) * ey), (cx + r1 * math.cos(t0) * ex, cy + r1 * math.sin(t0) * ey),
                    (cx + r1 * math.cos(t1) * ex, cy + r1 * math.sin(t1) * ey), (cx + r0 * math.cos(t1) * ex, cy + r0 * math.sin(t1) * ey)])
    return out


def risca(p0, p1, w):
    """O quadrilátero de uma risca reta de largura w (m)."""
    (x0, y0), (x1, y1) = p0, p1
    L = math.hypot(x1 - x0, y1 - y0) or 1e-6
    nx, ny = -(y1 - y0) / L * w / 2, (x1 - x0) / L * w / 2
    return [(x0 + nx, y0 + ny), (x1 + nx, y1 + ny), (x1 - nx, y1 - ny), (x0 - nx, y0 - ny)]


def decal(polis, mat, z=ZD, o=None):
    """Os polígonos (x, y) no chão, todos com o mesmo material (que pinta pela posição), sem contorno do motor."""
    o = C().novo_obj(3, contorno=False, sombra=True) if o is None else o
    for pts in polis:
        P = [(x, y, z) for (x, y) in pts]
        if _n(P)[2] < 0:
            P = P[::-1]
        fp(P, (0, 0, 1), mat, o)
    return o


def mat_mancha(manchas, pal, beira=1.6, miolo=None, extra=None):
    """
    O material de uma mancha (união de manchas): pal = [beira, corpo, (meio), (claro)]. A beira (até `beira` px para
    dentro) na cor 0, o corpo na 1; com `miolo` (px), mais para dentro a cor 2. extra(X, Y, d, out) acrescenta.
    """
    P_ = [hx(c) for c in pal]

    def f(L, n, P):
        X, Y = P[:, 0], P[:, 1]
        d = np.max(np.stack([m.d(X, Y) for m in manchas]), 0) / PH
        out = np.tile(P_[1], (len(P), 1))
        out = np.where((d < beira)[:, None], P_[0], out)
        if miolo is not None and len(P_) > 2:
            out = np.where((d > miolo)[:, None], P_[2], out)
        if extra is not None:
            out = extra(X, Y, d, out)
        return out
    return emissivo(f)


def manchas_decal(manchas, mat, z=ZD):
    polis = []
    for m in manchas:
        polis += _leque(m)
    return decal(polis, mat, z)


# ------------------------------------------------------------------ o sangue ------------------------------------------------------------------
SANGUE = ['#3c0a0a', '#5e1210', '#7a1a14', '#962a1e']     # a beira seca, o corpo, o miolo, o brilho molhado




def gota(x, y, r, seed, ang=0.0, cauda=0.0, coroa=3):
    """
    Uma gota caída: a mancha redonda, a coroa (calombos grudados na beira, o respingo do impacto) e, com `cauda`, o
    fio que sai para o lado do andar (ang, graus). Devolve as manchas.
    """
    rng = np.random.default_rng(seed)
    ms = [Mancha(x, y, r, seed=seed, amp=0.1, lobos=(2, 3, 5))]
    for k in range(coroa):
        a = rng.uniform(0, 2 * math.pi)
        rr = r * rng.uniform(0.32, 0.45)
        ms.append(Mancha(x + math.cos(a) * r * 0.95, y + math.sin(a) * r * 0.95, rr, seed=seed + k + 1, amp=0.08, lobos=(2, 3)))
    if cauda:
        t = math.radians(ang)
        ms.append(Mancha(x + math.cos(t) * r * (0.6 + cauda), y + math.sin(t) * r * (0.6 + cauda), r * 0.38, seed=seed + 9, amp=0.06,
                         ex=1.0 + cauda * 2.2, ey=1.0, ang=ang, lobos=(2, 3)))
    return ms


def blood_drops():
    """
    Os respingos (1 x 1): o rastro de quem passou sangrando, cruzando a casa numa curva: gotas grandes com a coroa do
    impacto e a cauda para o lado do andar, intercaladas com gotas menores; a beira seca escura e o brilho nas grandes.
    """
    rastro = [(0.1, 0.2, 0.06, 3, 0.9), (0.24, 0.3, 0.045, 0, 1.2), (0.36, 0.33, 0.075, 4, 0.8), (0.5, 0.42, 0.05, 2, 1.0),
              (0.6, 0.55, 0.07, 3, 0.7), (0.68, 0.68, 0.045, 0, 1.1)]
    ms = []
    for i, (x, y, r, cr, ca) in enumerate(rastro):
        ms += gota(x, y, r, seed=11 * i + 2, ang=35 + 8 * math.sin(i), cauda=ca, coroa=cr)
    ms += gota(0.28, 0.6, 0.05, seed=91, coroa=2)
    ms += gota(0.55, 0.16, 0.045, seed=93, coroa=2)
    cs = [hx(c) for c in SANGUE]

    def extra(X, Y, d, out):
        out = np.where((d > 3.2)[:, None], cs[2], out)
        for (x, y, r, cr, ca) in rastro:
            if r < 0.06:
                continue
            q = (np.abs((X - x) + (Y - y) + r * 0.35) < PH * 0.9) & (np.abs((X - x) - (Y - y)) < r * 0.55) & (d > 2.2)
            out = np.where(q[:, None], cs[3], out)
        return out
    manchas_decal(ms, mat_mancha(ms, SANGUE[:2], beira=1.3, extra=extra))


def blood_pool():
    """
    A poça de sangue (1 x 1): a mancha grande de lóbulos (vários círculos que escorreram juntos), um braço escorrido,
    a beira seca bem escura e a camada já seca por dentro dela, o corpo, o miolo vivo e o brilho molhado; gotas em volta.
    """
    ms = [Mancha(0.36, 0.37, 0.24, seed=3, amp=0.12, ex=1.15, ey=0.95, ang=-20, lobos=(2, 3, 4)),
          Mancha(0.53, 0.5, 0.13, seed=5, amp=0.12, ex=1.2, ang=35, lobos=(2, 3)),
          Mancha(0.2, 0.5, 0.12, seed=8, amp=0.12, lobos=(2, 3)),
          Mancha(0.5, 0.2, 0.11, seed=9, amp=0.12, lobos=(2, 3)),
          Mancha(0.63, 0.63, 0.06, seed=10, amp=0.1, ex=1.8, ang=45, lobos=(2,))]
    ms += gota(0.13, 0.14, 0.045, seed=61, coroa=2)
    ms += gota(0.68, 0.3, 0.04, seed=63, coroa=1)
    ms += gota(0.26, 0.69, 0.042, seed=65, coroa=2)
    cs = [hx(c) for c in SANGUE]

    def extra(X, Y, d, out):
        out = np.where(((d >= 1.3) & (d < 2.6))[:, None], _tom(cs[1], 0.8), out)
        out = np.where((d > 6)[:, None], cs[2], out)
        s = (X - 0.32) + (Y - 0.3)
        t = (X - 0.32) - (Y - 0.3)
        b1 = (np.abs(s) < PH * 0.9) & (np.abs(t) < 0.08) & (d > 6)
        b2 = (np.abs(s - 0.07) < PH * 0.9) & (np.abs(t - 0.05) < 0.035) & (d > 6)
        out = np.where((b1 | b2)[:, None], cs[3], out)
        return out
    manchas_decal(ms, mat_mancha(ms, SANGUE[:2], beira=1.3, extra=extra))


# ------------------------------------------------------------------ fuligem, cinza, sujeira, poça ------------------------------------------------------------------
def fuligem():
    """
    A mancha de fuligem (1 x 1): o preto do miolo e a borda em três degraus clareando (a fuligem espalhada), as
    línguas compridas para um lado (o fogo lambeu o chão), as riscas e um caco de carvão no meio.
    """
    ms = [Mancha(0.36, 0.36, 0.26, seed=21, amp=0.16, ex=1.15, ey=0.95, ang=30, lobos=(2, 3, 5)),
          Mancha(0.55, 0.55, 0.13, seed=22, amp=0.15, ex=1.9, ang=45, lobos=(2, 3)),
          Mancha(0.62, 0.3, 0.08, seed=24, amp=0.15, ex=1.9, ang=20, lobos=(2, 3)),
          Mancha(0.3, 0.62, 0.08, seed=25, amp=0.15, ex=1.9, ang=70, lobos=(2, 3))]
    cs = [hx('#4e4440'), hx('#3c3430'), hx('#2a2422'), hx('#1c1817'), hx('#121010')]

    def extra(X, Y, d, out):
        out = np.where(((d >= 2) & (d < 4.5))[:, None], cs[1], out)
        out = np.where(((d >= 4.5) & (d < 8))[:, None], cs[2], out)
        out = np.where((d >= 8)[:, None], cs[3], out)
        s = np.floor(((X - Y) / PH) / 2)
        lin = (ruido(s, 3.0) < 0.2) & (d > 3) & (d < 12)
        out = np.where(lin[:, None], _tom(out, 0.82), out)
        q = np.abs((X - 0.38) / 0.045) + np.abs((Y - 0.36) / 0.03)
        out = np.where((q < 1)[:, None], cs[4], out)
        out = np.where(((q < 1) & (X + Y < 0.74 - 0.01))[:, None], hx('#4a403c'), out)
        return out
    manchas_decal(ms, mat_mancha(ms, ['#4e4440', '#4e4440'], beira=2, extra=extra))


def cinzas():
    """
    As cinzas (1 x 1): o montinho baixo de cinza clara (com a luz de cima) e a cinza espalhada em volta em degraus, os
    pedaços de carvão (blocos de 2 px) e um toco preto meio enterrado.
    """
    ms = [Mancha(0.37, 0.37, 0.27, seed=31, amp=0.14, ex=1.15, ey=0.95, ang=-25, lobos=(2, 3, 5)),
          Mancha(0.58, 0.56, 0.12, seed=32, amp=0.15, ex=1.5, ang=40, lobos=(2, 3)),
          Mancha(0.16, 0.56, 0.08, seed=33, amp=0.12, lobos=(2, 3))]
    cs = [hx('#6e6964'), hx('#8a857e'), hx('#a29d94'), hx('#bcb7ae')]

    def extra(X, Y, d, out):
        out = np.where(((d >= 1.5) & (d < 4))[:, None], cs[1], out)
        out = np.where((d >= 4)[:, None], cs[2], out)
        s = suave(np.floor(X / PH) * PH, np.floor(Y / PH) * PH, 0.08, 4)
        out = np.where(((s > 0.68) & (d > 2.5))[:, None], cs[3], out)
        out = np.where(((s < 0.25) & (d > 2.5))[:, None], cs[1], out)
        for (x, y) in ((0.18, 0.28), (0.55, 0.22), (0.5, 0.6), (0.2, 0.5), (0.64, 0.44), (0.32, 0.6)):
            q = (np.abs(X - x) < PH * 1.05) & (np.abs(Y - y) < PH * 1.05)
            out = np.where(q[:, None], hx('#2a2422'), out)
        return out
    manchas_decal(ms, mat_mancha(ms, ['#6e6964', '#8a857e'], extra=extra))
    o = C().novo_obj(3, contorno=False, sombra=True)

    def cin(L, n, P):
        out = np.tile(cs[2], (len(P), 1))
        s = suave(np.floor(P[:, 0] / PH) * PH, np.floor(P[:, 1] / PH) * PH, 0.06, 6)
        out = np.where((s > 0.6)[:, None], cs[3], out)
        return out
    C().elipsoide(np.array([0.36, 0.36, 0.0]), np.array([0.17, 0.14, 0.06]), emissivo(cin), o, corte_z=0.0)
    bloco((0.47, 0.3, 0.014), (0.13, 0.04, 0.035), {'cima': liso('#3a3230'), '*': liso('#221e1d')}, yaw=30)


def dirt():
    """A sujeira (1 x 1): o barro seco marrom-acinzentado, as faixas do arraste (alguém varreu e não limpou), os grãos."""
    ms = [Mancha(0.32, 0.34, 0.22, seed=41, amp=0.16, ex=1.35, ang=15, lobos=(2, 3, 5)),
          Mancha(0.52, 0.5, 0.15, seed=42, amp=0.16, ex=1.3, ang=60, lobos=(2, 3)),
          Mancha(0.6, 0.24, 0.08, seed=43, amp=0.12, ex=1.6, ang=10, lobos=(2, 3))]
    cs = [hx('#5a4836'), hx('#6c5842'), hx('#7c6850')]

    def extra(X, Y, d, out):
        f = np.floor(Y / (2 * PH))
        out = np.where(((ruido(f, 5.0) < 0.3) & (d > 2.5))[:, None], cs[2], out)
        g = (ruido(np.floor(X / (2 * PH)), np.floor(Y / (2 * PH)), 7.0) < 0.06) & (d > 2)
        out = np.where(g[:, None], hx('#3e3226'), out)
        return out
    manchas_decal(ms, mat_mancha(ms, ['#5a4836', '#6c5842'], extra=extra))


def puddle():
    """A poça d'água (1 x 1): a água parada escura, a beira molhada, a faixa rasa e os reflexos do teto em riscas claras."""
    ms = [Mancha(0.36, 0.37, 0.27, seed=51, amp=0.12, ex=1.25, ey=0.9, ang=-15, lobos=(2, 3, 5)),
          Mancha(0.56, 0.57, 0.12, seed=52, amp=0.12, ex=1.3, ang=40, lobos=(2, 3)),
          Mancha(0.15, 0.22, 0.07, seed=53, amp=0.1, lobos=(2, 3))]

    def extra(X, Y, d, out):
        s = (X + Y) / PH
        t = (X - Y) / PH
        r1 = (np.abs(s - 21) < 0.6) & (np.abs(t + 2) < 8) & (d > 3)
        r2 = (np.abs(s - 25) < 0.6) & (np.abs(t - 4) < 5) & (d > 3)
        r3 = (np.abs(s - 33) < 0.6) & (np.abs(t + 5) < 3) & (d > 3)
        out = np.where(((d >= 1.2) & (d < 3))[:, None], hx('#4a5a64'), out)
        out = np.where((r1 | r2 | r3)[:, None], hx('#9ab0ba'), out)
        return out
    manchas_decal(ms, mat_mancha(ms, ['#2a343a', '#3c4a52'], beira=1.2, extra=extra))


def oil_stain():
    """A mancha de óleo (1 x 1): o preto-marrom grosso, a beira que espalhou mais clara e o furta-cor (riscas roxa e verde)."""
    ms = [Mancha(0.36, 0.38, 0.24, seed=71, amp=0.14, ex=1.3, ey=0.9, ang=10, lobos=(2, 3, 4)),
          Mancha(0.55, 0.52, 0.12, seed=72, amp=0.12, ex=1.4, ang=50, lobos=(2, 3)),
          Mancha(0.2, 0.2, 0.07, seed=73, amp=0.1, lobos=(2, 3))]

    def extra(X, Y, d, out):
        out = np.where(((d >= 1.5) & (d < 3.5))[:, None], hx('#2e2620'), out)
        out = np.where((d > 6)[:, None], hx('#14100e'), out)
        rr = np.hypot((X - 0.34) / 1.3, Y - 0.36) / PH
        out = np.where(((np.abs(rr - 6.5) < 0.6) & (d > 3) & (X > Y - 0.05))[:, None], hx('#4e3e66'), out)
        out = np.where(((np.abs(rr - 7.6) < 0.6) & (d > 3) & (X > Y - 0.05))[:, None], hx('#30585a'), out)
        out = np.where(((np.abs(rr - 4) < 0.6) & (d > 4) & (X < Y + 0.02) & (X > Y - 0.1))[:, None], hx('#5a4e44'), out)
        return out
    manchas_decal(ms, mat_mancha(ms, ['#3a3028', '#1e1814'], beira=1.5, extra=extra))


def drain():
    """
    O ralo (1 x 1): a grelha redonda de ferro fundido no meio (o aro, as barras e os vãos pretos), a mancha molhada
    escura em volta e o escorrido de ferrugem para um lado.
    """
    cx, cy, r = 0.375, 0.375, 0.17
    ms = [Mancha(cx, cy, 0.3, seed=81, amp=0.1, ex=1.05, lobos=(2, 3, 5)), Mancha(0.6, 0.56, 0.1, seed=82, amp=0.1, ex=1.8, ang=45, lobos=(2, 3))]

    def molhado(X, Y, d, out):
        fer = (np.abs((X - cx) - (Y - cy)) < 0.05 + 0.02 * np.sin(X * 40)) & (X > cx + 0.1) & (Y > cy + 0.1)
        out = np.where((fer & (d > 1.5))[:, None], hx('#5e3a24'), out)
        return out
    manchas_decal(ms, mat_mancha(ms, ['#3a3532', '#2e2a28'], beira=1.5, extra=molhado))
    o = C().novo_obj(3, contorno=False, sombra=True)

    def grelha(L, n, P):
        X, Y = P[:, 0], P[:, 1]
        rr = np.hypot(X - cx, Y - cy)
        out = np.tile(hx('#4a4542'), (len(P), 1))
        out = np.where((rr > r - 1.5 * PH)[:, None], hx('#2a2624'), out)
        out = np.where(((rr > r - 3 * PH) & (rr <= r - 1.5 * PH))[:, None], hx('#625c56'), out)
        dentro = rr < r - 3 * PH
        u = (X - cx) / PH
        vao = dentro & ((np.floor(u + 0.5) % 4) < 2) & (np.abs(Y - cy) < r - 4.5 * PH) & (np.abs(u) < 5.5)
        out = np.where(vao[:, None], hx('#0e0c0c'), out)
        out = np.where((dentro & ~vao & ((np.floor(u + 0.5) % 4) == 2))[:, None], hx('#5a544e'), out)
        out = np.where((dentro & ~vao & (X + Y > cx + cy + 0.08))[:, None], hx('#6a4430'), out)
        return out
    pts = [(cx + r * math.cos(2 * math.pi * i / 28), cy + r * math.sin(2 * math.pi * i / 28), ZD + 0.002) for i in range(28)]
    fp(pts, (0, 0, 1), emissivo(grelha), o)


def vent():
    """
    A grade de ventilação do chão (1 x 1): o caixilho de chapa galvanizada com os 4 parafusos, as aletas (a luz na
    beira de cima de cada uma, o vão preto entre elas) e a poeira presa num canto.
    """
    x0, x1, y0, y1 = 0.12, 0.63, 0.14, 0.61
    o = C().novo_obj(3, contorno=True, sombra=True)

    def grade(L, n, P):
        X, Y = P[:, 0], P[:, 1]
        out = np.tile(hx('#8a9094'), (len(P), 1))
        bd = np.minimum(np.minimum(X - x0, x1 - X), np.minimum(Y - y0, y1 - Y)) / PH
        out = np.where((bd < 1)[:, None], hx('#a8aeb0'), out)
        out = np.where((bd >= 3)[:, None], hx('#6e7478'), out)
        dentro = bd >= 4
        g = np.floor((X - x0) / PH) % 4
        out = np.where((dentro & (g < 2))[:, None], hx('#1a1c1e'), out)
        out = np.where((dentro & (g == 2))[:, None], hx('#b4babc'), out)
        out = np.where((dentro & (g == 3))[:, None], hx('#7c8286'), out)
        out = np.where(((bd >= 3) & (bd < 4))[:, None], hx('#4a4e52'), out)
        for (a, b) in ((x0 + 1.5 * PH, y0 + 1.5 * PH), (x1 - 1.5 * PH, y0 + 1.5 * PH), (x0 + 1.5 * PH, y1 - 1.5 * PH), (x1 - 1.5 * PH, y1 - 1.5 * PH)):
            q = (np.abs(X - a) < PH * 0.95) & (np.abs(Y - b) < PH * 0.95)
            out = np.where(q[:, None], hx('#4a4e52'), out)
        po = dentro & (np.hypot(X - x1, Y - y1) < 0.13) & (ruido(np.floor(X / (2 * PH)), np.floor(Y / (2 * PH)), 2.0) < 0.7)
        out = np.where(po[:, None], hx('#7a7268'), out)
        return out
    C().caixa((x0, x1, y0, y1, 0.0, PZ), {'cima': emissivo(grade), '*': liso('#5a6064')}, M, o)


def wax_pool():
    """
    A poça de cera (1 x 1): a cera marfim derretida e endurecida em camadas, um escorrido de cera vermelha por cima, os
    pingos em calombo, dois tocos de vela caídos e um em pé, queimado até o fim.
    """
    ms = [Mancha(0.37, 0.38, 0.27, seed=91, amp=0.12, ex=1.2, ey=0.95, ang=20, lobos=(2, 3, 5)),
          Mancha(0.58, 0.55, 0.12, seed=92, amp=0.12, ex=1.5, ang=40, lobos=(2, 3)),
          Mancha(0.17, 0.56, 0.09, seed=93, amp=0.12, lobos=(2, 3))]
    verm = [Mancha(0.5, 0.3, 0.1, seed=94, amp=0.12, ex=1.5, ang=-30, lobos=(2, 3))]

    def extra(X, Y, d, out):
        out = np.where(((d >= 1.3) & (d < 2.6))[:, None], hx('#e8dcbc'), out)
        out = np.where((d >= 2.6)[:, None], hx('#d8caa6'), out)
        out = np.where(((np.abs(d - 5.5) < 0.5) | (np.abs(d - 9) < 0.5))[:, None], hx('#c8b890'), out)
        dv = np.max(np.stack([m.d(X, Y) for m in verm]), 0) / PH
        out = np.where((dv > 0)[:, None], hx('#7a1e1a'), out)
        out = np.where((dv > 1.2)[:, None], hx('#9a2a22'), out)
        return out
    manchas_decal(ms, mat_mancha(ms, ['#bfae86', '#e8dcbc'], beira=1.3, extra=extra))
    for (x, y, r) in ((0.27, 0.33, 0.035), (0.5, 0.45, 0.03), (0.32, 0.5, 0.028)):
        o = C().novo_obj(3, contorno=False)
        C().elipsoide(np.array([x, y, ZD]), np.array([r, r, 0.022]), liso('#efe4c8'), o, corte_z=ZD)
    for (x, y, comp, yaw, cor) in ((0.2, 0.24, 0.17, 25, '#f2eada'), (0.58, 0.6, 0.14, -60, '#a8302a')):
        bloco((x, y, 0.032), (comp, 0.06, 0.06), {'cima': liso(cor), '*': liso(_hexa(_tom(hx(cor), 0.85)))}, yaw=yaw)
        t = math.radians(yaw)
        bloco((x + math.cos(t) * (comp / 2 + 0.008), y + math.sin(t) * (comp / 2 + 0.008), 0.026), (0.016, 0.014, 0.014), liso('#1e1816'), yaw=yaw)
    o = novo()
    x, y = 0.4, 0.42
    C().cilindro(x, y, 0.045, ZD, 0.1, _pau('#ece2c6', quina=False), M, o, lados=14, tampa_mat=liso('#d8caa6'))
    _barra((x - PH * 0.5, x + PH * 0.5, y - PH * 0.5, y + PH * 0.5, 0.1, 0.12), '#1e1816', quina=False)


# ------------------------------------------------------------------ os sigilos (inventados) e os cabos ------------------------------------------------------------------
def _giz(cor='#d8d0bc', escuro='#a8a08c', seed=0):
    """O giz riscado: a cor, os trechos gastos (blocos de 2 px um tom abaixo) e as falhas mais escuras."""
    c0, c1 = hx(cor), hx(escuro)

    def f(L, n, P):
        X, Y = P[:, 0], P[:, 1]
        i, j = np.floor(X / (2 * PH)), np.floor(Y / (2 * PH))
        r = ruido(i, j, seed + 1.0)
        out = np.tile(c0, (len(P), 1))
        out = np.where((r < 0.3)[:, None], c1, out)
        out = np.where((r > 0.9)[:, None], _tom(c0, 1.08), out)
        return out
    return emissivo(f)


def sigil_floor():
    """
    O sigilo riscado no chão (3 x 3, inventado): o círculo duplo de giz, entre os dois anéis as marcas de traço (riscas
    radiais em grupos de 1, 2 e 3, umas com a travessa), dentro a estrela de sete pontas desenhada de um traço só, o
    olho do meio (o anel com a risca atravessada) e, em cada ponta da estrela, a marca de sangue seco. O giz falha em
    alguns trechos (o anel não fecha por inteiro).
    """
    c = 1.125
    w = 0.05
    polis = []
    # os dois anéis (com falhas: trechos que o giz não pegou)
    for (r0, a_falha) in ((1.0, (40, 52)), (0.86, (200, 214))):
        for (a0, a1) in ((a_falha[1], a_falha[0] + 360),):
            polis += anel(c, c, r0, r0 + w, a0, a1, n=72)
    # as marcas entre os anéis: grupos de riscas radiais, girando
    for k in range(14):
        a = 2 * math.pi * (k + 0.5) / 14
        nrisc = (1, 2, 3, 1, 2, 1, 3)[k % 7]
        for q in range(nrisc):
            aa = a + (q - (nrisc - 1) / 2) * 0.05
            p0 = (c + math.cos(aa) * 0.9, c + math.sin(aa) * 0.9)
            p1 = (c + math.cos(aa) * 0.99, c + math.sin(aa) * 0.99)
            polis.append(risca(p0, p1, 0.04))
        if k % 3 == 0:
            # a travessa (um T deitado)
            pa = (c + math.cos(a - 0.07) * 0.955, c + math.sin(a - 0.07) * 0.955)
            pb = (c + math.cos(a + 0.07) * 0.955, c + math.sin(a + 0.07) * 0.955)
            polis.append(risca(pa, pb, 0.035))
    # a estrela de sete pontas {7/3}: um traço só
    R = 0.84
    vs = [(c + R * math.cos(2 * math.pi * i / 7 - math.pi / 2), c + R * math.sin(2 * math.pi * i / 7 - math.pi / 2)) for i in range(7)]
    for i in range(7):
        polis.append(risca(vs[(3 * i) % 7], vs[(3 * i + 3) % 7], w))
    # o olho do meio: o anel, a risca que o atravessa e o ponto
    polis += anel(c, c, 0.2, 0.2 + w, n=36)
    polis.append(risca((c - 0.34, c + 0.34), (c + 0.34, c - 0.34), w))
    decal(polis, _giz(seed=3))
    # o sangue seco: a marca em cada ponta da estrela e o ponto do olho
    ms = []
    for i, (x, y) in enumerate(vs):
        ms.append(Mancha(x, y, 0.06, seed=200 + i, amp=0.15, lobos=(2, 3)))
    ms.append(Mancha(c, c, 0.08, seed=230, amp=0.12, lobos=(2, 3)))
    ms += gota(c + 0.32, c + 0.12, 0.04, seed=240, coroa=2)
    ms += gota(c - 0.5, c + 0.45, 0.035, seed=250, coroa=1)
    manchas_decal(ms, mat_mancha(ms, ['#3c0a0a', '#5e1210', '#6e1612'], beira=1.2, miolo=2.5), z=ZD + 0.001)


def _ouro(seed=0):
    """O metal dourado embutido: o corpo, a beira de baixo mais escura (1 px), os reflexos em riscas na diagonal da tela."""
    c0 = hx('#c8963c')

    def f(L, n, P):
        X, Y = P[:, 0], P[:, 1]
        out = np.tile(c0, (len(P), 1))
        s = np.floor((X + Y) / PH)
        out = np.where(((s % 19) < 2)[:, None], hx('#ecc868'), out)
        out = np.where(((s % 19) == 9)[:, None], hx('#a87a2e'), out)
        return out
    return emissivo(f)


def sigil_gold():
    """
    O selo dourado (3 x 3, inventado): o disco de pedra negra embutido no chão e, por cima, o metal dourado: o anel
    duplo, os doze cravos entre os anéis, os dois quadrados cruzados (a estrela de oito pontas), o anel do meio e o
    miolo com as quatro pétalas; o metal com o reflexo em riscas.
    """
    c = 1.125
    # o disco de pedra negra (com a junta das lajes em anel)

    def pedra(L, n, P):
        X, Y = P[:, 0], P[:, 1]
        rr = np.hypot(X - c, Y - c)
        th = np.arctan2(Y - c, X - c)
        out = np.tile(hx('#2a2630'), (len(P), 1))
        out = np.where(((ruido(np.floor(th * 4), np.floor(rr / 0.3), 3.0) < 0.4))[:, None], hx('#302b36'), out)
        junta = (np.abs(rr - 0.62) < PH * 0.6) | ((np.abs(((th * 8 / math.pi) % 1) - 0.5) < 0.012 * 8 / math.pi / np.maximum(rr, 0.1)) & (rr > 0.62))
        out = np.where(junta[:, None], hx('#1a171e'), out)
        out = np.where((rr > 1.08 - PH * 1.2)[:, None], hx('#16141a'), out)
        return out
    o = decal([[(c + 1.08 * math.cos(2 * math.pi * i / 64), c + 1.08 * math.sin(2 * math.pi * i / 64)) for i in range(64)]], emissivo(pedra))
    polis = []
    polis += anel(c, c, 1.0, 1.05, n=72)
    polis += anel(c, c, 0.87, 0.9, n=72)
    for k in range(12):
        a = 2 * math.pi * k / 12
        x, y = c + 0.945 * math.cos(a), c + 0.945 * math.sin(a)
        polis.append([(x + 0.03 * math.cos(t), y + 0.03 * math.sin(t)) for t in np.linspace(0, 2 * math.pi, 10, endpoint=False)])
    for giro in (0, 45):
        vs = [(c + 0.84 * math.cos(math.radians(giro + 90 * i)), c + 0.84 * math.sin(math.radians(giro + 90 * i))) for i in range(4)]
        for i in range(4):
            polis.append(risca(vs[i], vs[(i + 1) % 4], 0.05))
    polis += anel(c, c, 0.4, 0.45, n=48)
    for k in range(4):
        a = math.pi / 4 + k * math.pi / 2
        # a pétala: um losango comprido do miolo até o anel do meio
        p = [(c + 0.1 * math.cos(a), c + 0.1 * math.sin(a)), (c + 0.24 * math.cos(a + 0.35), c + 0.24 * math.sin(a + 0.35)),
             (c + 0.38 * math.cos(a), c + 0.38 * math.sin(a)), (c + 0.24 * math.cos(a - 0.35), c + 0.24 * math.sin(a - 0.35))]
        polis.append(p)
    polis.append([(c + 0.09 * math.cos(t), c + 0.09 * math.sin(t)) for t in np.linspace(0, 2 * math.pi, 16, endpoint=False)])
    decal(polis, _ouro(), z=ZD + 0.001)
    # o furo do miolo (o ponto escuro)
    decal([[(c + 0.035 * math.cos(t), c + 0.035 * math.sin(t)) for t in np.linspace(0, 2 * math.pi, 10, endpoint=False)]], liso('#3a2a14'), z=ZD + 0.002)


def tubo_chao(pts, w, h, cor, o=None):
    """Um cabo deitado no chão pelos pontos (x, y): trechos de caixa girada no mesmo objeto (sem quina entre eles)."""
    o = novo() if o is None else o
    mat = {'cima': liso(_hexa(_tom(hx(cor), 1.25))), '*': liso(cor)}
    for (x0, y0), (x1, y1) in zip(pts[:-1], pts[1:]):
        L = math.hypot(x1 - x0, y1 - y0)
        yaw = math.degrees(math.atan2(y1 - y0, x1 - x0))
        bloco(((x0 + x1) / 2, (y0 + y1) / 2, h / 2), (L + w * 0.6, w, h), mat, yaw=yaw, o=o)
    return o


def _hexa(c):
    c = np.clip(np.round(c), 0, 255).astype(int)
    return '#%02x%02x%02x' % tuple(c)


def cables_floor():
    """
    Os cabos no chão (3 x 1): três cabos (o preto grosso, o cinza, o vermelho) correndo ao comprido, em ondas que se
    cruzam, presos por duas faixas de fita prateada; atravessam a casa inteira (emendam com a vizinha).
    """
    xs = np.linspace(-0.02, 2.27, 30)
    for (y, amp, fase, w, cor) in ((0.3, 0.09, 0.0, 0.05, '#1e1e24'), (0.42, 0.11, 1.9, 0.04, '#4e4e56'), (0.52, 0.08, 3.6, 0.035, '#8a2a22')):
        pts = [(x, y + amp * math.sin(x * 3.1 + fase)) for x in xs]
        tubo_chao(pts, w, w * 0.7, cor)
    for x in (0.62, 1.58):
        bloco((x, 0.42, 0.04), (0.09, 0.5, 0.008), {'cima': liso('#a8aaa8'), '*': liso('#7a7c7a')})


# =====================================================================================================================
# o Orfanato queimado: a madeira carbonizada, a cama, o catre, o colchão no chão, a viga, os escombros, a fogueira
# =====================================================================================================================
def _voronoi(a, b, cw, ch, seed):
    """
    As placas irregulares (Voronoi num grade com sorteio): a e b em px da face, a célula de cw x ch px. Devolve
    (id da placa, a folga até a vizinha em px, a direção da vizinha em b).
    """
    i0, j0 = np.floor(a / cw), np.floor(b / ch)
    d1 = np.full(a.shape, 1e9)
    d2 = np.full(a.shape, 1e9)
    idc = np.zeros(a.shape)
    for di in (-1, 0, 1):
        for dj in (-1, 0, 1):
            i, j = i0 + di, j0 + dj
            cx = (i + 0.15 + 0.7 * ruido(i, j, seed + 0.3)) * cw
            cy = (j + 0.15 + 0.7 * ruido(i, j, seed + 0.7)) * ch
            d = np.hypot((a - cx) / cw, (b - cy) / ch)
            menor = d < d1
            d2 = np.where(menor, d1, np.minimum(d2, d))
            idc = np.where(menor, i * 7919 + j, idc)
            d1 = np.where(menor, d, d1)
    return idc, (d2 - d1) * min(cw, ch) * 0.5


def _px_face(L, n):
    """As coordenadas da face em px da arte (a ao longo, b de través)."""
    from base_estilo import coords
    a, b = coords(L, n)
    vert = abs(n[2]) <= 0.5
    return a / PH, b / (PZ if vert else PH)


def carvao(base='#2c2420', brasa=0.0, seed=0, celula=(7, 4)):
    """
    A madeira carbonizada (o couro de jacaré): placas irregulares de carvão (Voronoi esticado ao comprido), a
    rachadura preta de 1 px entre elas, três tons de placa e, com `brasa`, parte das rachaduras ainda em brasa.
    """
    c0 = hx(base)
    cw, ch = celula

    def f(L, n, P):
        a, b = _px_face(L, n)
        idc, folga = _voronoi(a, b, cw, ch, seed)
        k = ruido(idc, seed + 3.0)
        out = np.tile(c0, (len(P), 1))
        out = np.where((k < 0.3)[:, None], _tom(c0, 0.84), out)
        out = np.where((k > 0.75)[:, None], _tom(c0, 1.16), out)
        rach = folga < 0.55
        out = np.where(rach[:, None], hx('#0e0b0a'), out)
        if brasa:
            em = rach & (ruido(np.floor(a / 6), np.floor(b / 4), seed + 4.0) < brasa)
            out = np.where(em[:, None], hx('#d8561c'), out)
            out = np.where((em & (ruido(np.floor(a / 3), np.floor(b / 3), seed + 6.0) < 0.35))[:, None], hx('#ffa040'), out)
        return out
    return emissivo(f)


def pedra_q(base='#8e8a82', seed=0, celula=(12, 7), trinca=0.3):
    """A pedra ou o concreto quebrado: as manchas em dois tons (blocos de 2 px), umas poucas trincas de 1 px."""
    c0 = hx(base)
    cw, ch = celula

    def f(L, n, P):
        a, b = _px_face(L, n)
        s = suave(np.floor(a / 2) * 2, np.floor(b / 2) * 2, 5.0, seed)
        out = np.tile(c0, (len(P), 1))
        out = np.where((s > 0.64)[:, None], _tom(c0, 1.1), out)
        out = np.where((s < 0.3)[:, None], _tom(c0, 0.9), out)
        idc, folga = _voronoi(a, b, cw, ch, seed + 11)
        tr = (folga < 0.5) & (ruido(idc, seed + 2.0) < trinca)
        out = np.where(tr[:, None], _tom(c0, 0.6), out)
        return out
    return emissivo(f)


def tecido_queimado(cor, seed=0, resto=0.35, molas=None):
    """
    O pano queimado (o colchão, a colcha): o preto do chamuscado tomando quase tudo, ilhas do pano original (`cor`, uma
    função de material) com a beira marrom (o pano tostado), a cinza clara em manchas e, em `molas` (x0, x1, y0, y1),
    o rasgo com as molas à mostra.
    """
    def f(L, n, P):
        X, Y, Z = P[:, 0], P[:, 1], P[:, 2]
        top = n[2] > 0.6
        a = np.floor(X / PH) * PH
        b = np.floor((Y if top else Z) / PH) * PH
        s = suave(a + (0 if top else 3.1), b, 0.16, seed)
        out = np.tile(hx('#1e1817'), (len(P), 1))
        out = np.where((s > 0.42)[:, None], hx('#2a2220'), out)
        orig = cor(L, n, P)
        ilha = s > 1 - (resto if top else resto * 0.4)
        r_ = resto if top else resto * 0.4
        out = np.where(((s > 1 - r_ - 0.07) & ~ilha)[:, None], hx('#4a3020'), out)
        out = np.where(((s > 1 - r_ - 0.035) & ~ilha)[:, None], hx('#6a4630'), out)
        out = np.where(ilha[:, None], orig, out)
        s2 = suave(a + 7.7, b + 1.3, 0.1, seed + 5)
        out = np.where(((s2 > 0.74) & ~ilha)[:, None], hx('#6a6460'), out)
        if molas is not None and top:
            x0, x1, y0, y1 = molas
            dentro = (X > x0) & (X < x1) & (Y > y0) & (Y < y1)
            out = np.where(dentro[:, None], hx('#0e0b0a'), out)
            # as molas: argolas de 4 px em fileira, o arame enferrujado
            gx = ((X - x0) / PH) % 6
            gy = ((Y - y0) / PH) % 6
            argola = dentro & (((np.abs(gx - 3) < 1.6) & (np.abs(gy - 3) < 1.6)) & ~((np.abs(gx - 3) < 0.6) & (np.abs(gy - 3) < 0.6)))
            out = np.where(argola[:, None], hx('#7a4a2a'), out)
            out = np.where((argola & (gx < 3) & (gy < 3))[:, None], hx('#a8683a'), out)
            bd = dentro & ((X < x0 + PH) | (X > x1 - PH) | (Y < y0 + PH) | (Y > y1 - PH))
            out = np.where(bd[:, None], hx('#5a3a24'), out)
        return out
    return emissivo(f)


def _listra_azul():
    """O pano da colcha listrada da cama de solteiro (o que sobrou dela)."""
    def f(L, n, P):
        out = np.tile(hx('#4e6a8a'), (len(P), 1))
        yy = np.floor(P[:, 1] / PH)
        out = np.where(((yy % 40 > 30) & (yy % 40 < 34))[:, None], hx('#e8dcc0'), out)
        return out
    return f


def _lona(cor='#9a8c66', seed=0):
    """A lona encardida: a trama em riscas de 2 px um tom abaixo, as manchas de uso (marrom) em degraus."""
    c0 = hx(cor)

    def f(L, n, P):
        X, Y = P[:, 0], P[:, 1]
        out = np.tile(c0, (len(P), 1))
        out = np.where((np.floor(Y / PH) % 5 == 0)[:, None], _tom(c0, 0.92), out)
        s = suave(np.floor(X / PH) * PH, np.floor(Y / PH) * PH, 0.14, seed)
        out = np.where((s > 0.64)[:, None], _tom(c0, 0.82), out)
        out = np.where((s > 0.76)[:, None], hx('#6a5232'), out)
        return out
    return f


def cama_queimada():
    """
    A cama de solteiro (a do quarto) depois do incêndio (1 x 3, 0,5 m): a mesma cabeceira de tábuas com a madeira
    carbonizada e as tábuas de cima comidas pelo fogo (cada uma numa altura), um poste quebrado, a bola que sobrou, o
    pé baixo torto; o colchão afundado e preto, com ilhas da colcha listrada azul que sobrou, a cinza, o rasgo com as
    molas à mostra e a ponta do pano caída pelo lado.
    """
    x0, x1 = 0.03, 0.72
    y0, y1 = 0.02, 2.22
    ztop = 0.82 / UN
    CV = carvao('#2c2420', seed=1)
    CVb = carvao('#30261f', brasa=0.12, seed=2)
    # a cabeceira: os postes (o da direita quebrado) e as tábuas queimadas de alturas diferentes
    p = 0.07
    caixa((x0, x0 + p, y0 - 0.01, y0 + 0.06, 0.0, 1.04), {'cima': liso('#3a302a'), '*': CV})
    caixa((x1 - p, x1, y0 - 0.01, y0 + 0.06, 0.0, 0.66), {'cima': liso('#5a3a24'), '*': CV})
    o = novo()
    _poligono_rodado(x0 + p / 2, y0 + 0.025, [(1.04, p * 0.4), (1.06, p * 0.6), (1.09, p * 0.5)], vol(x0 + p / 2, y0 + 0.025, '#2a221e'), o, lados=10)
    alt = [0.98, 0.9, 0.72, 0.55, 0.62]
    n = len(alt)
    for i, h in enumerate(alt):
        a0 = x0 + p + i * (x1 - x0 - 2 * p) / n
        a1 = a0 + (x1 - x0 - 2 * p) / n - 0.006
        caixa((a0, a1, y0, y0 + 0.045, 0.12, h), {'cima': liso('#5a3a24'), '*': CVb if i in (2, 3) else CV})
    caixa((x0 + p, x1 - p, y0 - 0.005, y0 + 0.05, 0.12, 0.2), {'cima': liso('#3a302a'), '*': CV})
    # o pé (baixo, com uma tábua faltando) e as laterais
    caixa((x0, x0 + p, y1 - 0.06, y1 + 0.01, 0.0, 0.62), {'cima': liso('#3a302a'), '*': CV})
    caixa((x1 - p, x1, y1 - 0.06, y1 + 0.01, 0.0, 0.58), {'cima': liso('#3a302a'), '*': CV})
    caixa((x0 + p, x1 - p, y1 - 0.05, y1 - 0.01, 0.12, 0.3), {'cima': liso('#3a302a'), '*': CV})
    caixa((x0 + p, (x0 + x1) / 2 - 0.02, y1 - 0.05, y1 - 0.01, 0.3, 0.5), {'cima': liso('#5a3a24'), '*': CVb})
    for xx in (x0 + 0.01, x1 - 0.05):
        caixa((xx, xx + 0.04, y0 + 0.05, y1 - 0.05, 0.14, 0.32), {'cima': liso('#3a302a'), '*': CV})
    # o colchão afundado e preto (o meio mais baixo)
    MAT = tecido_queimado(_listra_azul(), seed=4, resto=0.3, molas=(x0 + 0.2, x0 + 0.45, 0.95, 1.3))
    zb = 0.28
    _p1_malha((x0 + 0.05, x1 - 0.05, y0 + 0.07, 1.0, zb, ztop), (0.06, 0.06, 0.02, 0.05), MAT, seg=2)
    _p1_malha((x0 + 0.05, x1 - 0.05, 0.98, 1.6, zb, ztop - 0.05), (0.06, 0.06, 0.02, 0.05), MAT, seg=2)
    _p1_malha((x0 + 0.05, x1 - 0.05, 1.58, y1 - 0.07, zb, ztop - 0.01), (0.06, 0.06, 0.02, 0.05), MAT, seg=2)
    # o travesseiro queimado (meio desfeito)
    _p1_malha((x0 + 0.1, x1 - 0.14, y0 + 0.1, y0 + 0.36, ztop - 0.03, ztop + 0.05), (0.06, 0.07, 0.03, 0.05),
              tecido_queimado(lambda L, n, P: np.tile(hx('#d8d0c0'), (len(P), 1)), seed=9, resto=0.4), seg=2)
    # a ponta do pano caída pelo lado (uma aba fina, inclinada)
    bloco((x1 + 0.005, 1.85, 0.2), (0.012, 0.36, 0.26), {'*': tecido_queimado(_listra_azul(), seed=12, resto=0.25)}, roll=-12)
    peg(x0, x1, y0, y1)


def catre():
    """
    O catre da enfermaria (1 x 3, 0,4 m): as duas varas de madeira ao comprido, as pernas em X (três pares), a lona
    encardida esticada com a barriga no meio, o travesseiro achatado e o cobertor cinza dobrado no pé.
    """
    x0, x1 = 0.1, 0.65
    y0, y1 = 0.08, 2.17
    zt = 0.65 / UN
    zv = zt - 0.05
    PAU = {'cima': liso('#8a6a44'), '*': mad2('#6a4a2c', eixo=1, seed=71, passo=0.05)}
    for xx in (x0, x1 - 0.045):
        caixa((xx, xx + 0.045, y0, y1, zv - 0.045, zv), PAU)
    # as pernas em X (no plano de través, ao longo de x), em três lugares
    for yy in (y0 + 0.12, (y0 + y1) / 2, y1 - 0.12):
        for s in (-1, 1):
            ang = math.degrees(math.atan2(zv - 0.03, x1 - x0 - 0.04))
            bloco(((x0 + x1) / 2, yy + s * 0.02, (zv - 0.03) / 2), (math.hypot(x1 - x0 - 0.04, zv - 0.03), 0.03, 0.035),
                  {'*': mad2('#5e4026', seed=72, passo=0.04), 'cima': liso('#7a5a38')}, roll=-s * ang)
        caixa((x0 + 0.02, x1 - 0.02, yy - 0.03, yy + 0.03, 0.0, 0.02), {'cima': liso('#7a5a38'), '*': liso('#4e3420')})
    # a lona
    LONA = emissivo(_lona(seed=73))
    _p1_malha((x0 + 0.02, x1 - 0.02, y0 + 0.04, y1 - 0.04, zv - 0.03, zt - 0.005), (0.03, 0.04, 0.01, 0.02), LONA, seg=2)
    # o travesseiro achatado (o encardido amarelado) e o cobertor dobrado
    _p1_malha((x0 + 0.06, x1 - 0.06, y0 + 0.08, y0 + 0.36, zt - 0.02, zt + 0.06), (0.06, 0.07, 0.02, 0.04),
              emissivo(_lona('#d0c4a4', seed=74)), seg=2)
    _p1_malha((x0 + 0.01, x1 - 0.01, y1 - 0.5, y1 - 0.12, zt - 0.02, zt + 0.08), (0.03, 0.05, 0.02, 0.04),
              emissivo(_lona('#6a6a62', seed=75)), seg=2)
    peg(x0, x1, y0, y1)


def colchao_chao():
    """
    O colchão largado no chão (1 x 2, 0,14 m): o tecido listrado de colchão velho (creme e cinza-azulado), afundado no
    meio, as manchas de uso e as de sangue seco, o canto rasgado com a espuma amarela, e o cobertor embolado em cima.
    """
    x0, x1, y0, y1 = 0.04, 0.71, 0.05, 1.45
    zt = 0.23 / UN

    def tique(L, n, P):
        X, Y, Z = P[:, 0], P[:, 1], P[:, 2]
        top = n[2] > 0.6
        out = np.tile(hx('#c8bc9c'), (len(P), 1))
        g = np.floor(X / PH) % 7
        out = np.where((g < 1)[:, None], hx('#7a8494'), out)
        out = np.where((g == 3)[:, None], hx('#a0a2a0'), out)
        a = np.floor(X / PH) * PH
        b = np.floor((Y if top else Z * 3) / PH) * PH
        s = suave(a, b, 0.12, 31)
        out = np.where((s > 0.6)[:, None], _tom(out, 0.84), out)
        out = np.where((s > 0.72)[:, None], hx('#8a7454'), out)
        if top:
            # o sangue seco: duas manchas com a beira escura
            for (cx, cy, r) in ((0.42, 0.9, 0.13), (0.24, 0.4, 0.07)):
                d = (r * (1 + 0.15 * np.sin(np.arctan2(Y - cy, X - cx) * 3 + cx * 9)) - np.hypot(X - cx, (Y - cy) * 0.8)) / PH
                out = np.where((d > 0)[:, None], hx('#4a1210'), out)
                out = np.where((d > 1.5)[:, None], hx('#6a1a14'), out)
            # o afundado do meio (um anel um tom abaixo)
            rr = np.hypot((X - 0.38) / 0.24, (Y - 0.75) / 0.45)
            out = np.where(((rr > 0.92) & (rr < 1.0))[:, None], _tom(out, 0.86), out)
            # o canto rasgado com a espuma
            esp = (X > x1 - 0.2) & (Y > y1 - 0.24) & ((X - (x1 - 0.2)) + (Y - (y1 - 0.24)) > 0.12)
            out = np.where(esp[:, None], hx('#d8b860'), out)
            out = np.where((esp & ((np.floor(X / PH) + np.floor(Y / PH)) % 5 == 0))[:, None], hx('#b89848'), out)
        return out
    _p1_malha((x0, x1, y0, y1, 0.0, zt), (0.06, 0.06, 0.03, 0.05), emissivo(tique), seg=2)
    # o cobertor embolado (verde-escuro gasto): três calombos
    COB = emissivo(_lona('#4a5442', seed=77))
    _p1_malha((x0 + 0.05, x0 + 0.42, y1 - 0.62, y1 - 0.18, zt - 0.02, zt + 0.1), (0.07, 0.08, 0.03, 0.07), COB, seg=2)
    _p1_malha((x0 + 0.28, x1 - 0.06, y1 - 0.5, y1 - 0.22, zt - 0.02, zt + 0.06), (0.06, 0.06, 0.02, 0.05), COB, seg=2)
    peg(x0, x1, y0, y1)


def viga_queimada():
    """
    A viga do telhado caída no incêndio (1 x 3, 0,3 m): o tronco esquadrado carbonizado deitado ao comprido, a ponta
    de trás apoiada num bolo de telha e reboco (inclinada), as rachaduras com brasa, as lascas na ponta quebrada e a
    cinza embaixo.
    """
    # a cinza embaixo (decalque)
    ms = [Mancha(0.4, 1.1, 0.3, seed=301, amp=0.15, ex=1.0, ey=2.6, lobos=(2, 3, 5))]
    manchas_decal(ms, mat_mancha(ms, ['#5e5a56', '#7a7570'], beira=1.5))
    # o calço: pedaços de reboco e telha
    prisma([(0.2, 0.15), (0.5, 0.12), (0.58, 0.3), (0.3, 0.38)], 0.0, 0.11, liso('#b8b0a2'), topo=liso('#cec6b8'))
    bloco((0.36, 0.42, 0.06), (0.22, 0.12, 0.04), {'cima': liso('#a8543a'), '*': liso('#8a4430')}, yaw=20, roll=8)
    # a viga
    L = 2.05
    pitch = -math.degrees(math.atan2(0.12, L))
    bloco((0.39, 1.15, 0.13), (0.2, L, 0.18), {'cima': carvao('#2e2622', brasa=0.18, seed=3), '*': carvao('#2a221e', brasa=0.1, seed=4),
                                               'frente': liso('#1a1412'), 'costas': liso('#3a2a20')}, pitch=pitch, yaw=2)
    # a ponta quebrada (da frente): as lascas
    for (dx, dz, w, l, yaw, pt) in ((-0.05, 0.03, 0.05, 0.16, -6, -10), (0.04, -0.02, 0.06, 0.12, 8, 6), (0.0, 0.05, 0.04, 0.2, 2, -18)):
        bloco((0.39 + dx, 2.18 + l / 2 - 0.02, 0.07 + dz + 0.04), (w, l, 0.04), {'*': carvao('#2a221e', seed=5), 'cima': liso('#4a3a30')}, yaw=yaw, pitch=pt)
    # o miolo de madeira à mostra na ponta de trás (a madeira clara tostada)
    peg(0.25, 0.53, 0.1, 2.2)


def _pedacos(rng, n, area, tam, alt, cores, yaw=(0, 180), incl=25, zbase=0.0):
    """n pedaços (caixas giradas) espalhados em `area` (x0, x1, y0, y1): tam (min, max) e a altura (min, max)."""
    x0, x1, y0, y1 = area
    for i in range(n):
        x, y = rng.uniform(x0, x1), rng.uniform(y0, y1)
        a, b = rng.uniform(*tam), rng.uniform(*tam) * 0.7
        h = rng.uniform(*alt)
        cor = cores[i % len(cores)]
        bloco((x, y, zbase + h / 2), (a, b, h), {'cima': liso(cor[0]), '*': liso(cor[1])}, yaw=rng.uniform(*yaw),
              pitch=rng.uniform(-incl, incl), roll=rng.uniform(-incl, incl))


def monte(cx, cy, rx, ry, rz, cores, seed=0, blocos=2):
    """O monte baixo de entulho miúdo (um elipsoide cortado no chão): as manchas de cor em blocos de 2 px."""
    cs = np.stack([hx(c) for c in cores])

    def m(L, n, P):
        a, b = np.floor(P[:, 0] / (blocos * PH)), np.floor(P[:, 1] / (blocos * PH)) + np.floor(P[:, 2] / (blocos * PZ)) * 3
        k = (ruido(a, b, seed + 1.0) * len(cs)).astype(int) % len(cs)
        out = cs[k]
        s = suave(P[:, 0], P[:, 1] + P[:, 2], 0.12, seed)
        return np.where((s > 0.62)[:, None], _tom(out, 1.1), out)
    o = novo()
    C().elipsoide(np.array([cx, cy, 0.0]), np.array([rx, ry, rz]), emissivo(m), o, corte_z=0.0)
    return o


def escombros():
    """
    Os escombros do teto que caiu (2 x 2, 0,6 m): o monte de reboco, telha e cinza (o miúdo em manchas), as telhas
    quebradas (terracota), os cacos de reboco com a pintura, os caibros carbonizados atravessados (um apontando para
    cima) e a fuligem espalhada em volta.
    """
    rng = np.random.default_rng(11)
    ms = [Mancha(0.78, 0.78, 0.64, seed=401, amp=0.12, lobos=(2, 3, 5))]
    manchas_decal(ms, mat_mancha(ms, ['#3e3836', '#4e4846'], beira=2))
    monte(0.8, 0.78, 0.5, 0.46, 0.2, ['#5e5854', '#4a4440', '#7a746c', '#2e2826', '#8a5a44'], seed=3)
    monte(0.62, 0.95, 0.24, 0.22, 0.26, ['#6a645e', '#4a4440', '#2e2826', '#8a8478'], seed=4)
    # os caibros carbonizados
    CV = {'*': carvao('#2e2622', brasa=0.08, seed=10), 'cima': carvao('#3a2e28', seed=11)}
    bloco((0.78, 0.72, 0.2), (1.3, 0.1, 0.09), CV, yaw=35, roll=4)
    bloco((1.06, 1.02, 0.17), (0.8, 0.09, 0.08), CV, yaw=-55, roll=-8)
    bloco((0.66, 0.92, 0.42), (0.08, 0.9, 0.08), CV, yaw=-12, pitch=32)
    # as telhas e os cacos de reboco por cima
    _pedacos(rng, 8, (0.4, 1.2, 0.4, 1.2), (0.13, 0.2), (0.025, 0.035), [('#b4583c', '#8a4030'), ('#a04c34', '#7a3a2a')], incl=22, zbase=0.15)
    _pedacos(rng, 6, (0.35, 1.25, 0.35, 1.25), (0.1, 0.18), (0.04, 0.06), [('#d8d0c0', '#a8a094'), ('#9aa48e', '#7a8270')], incl=25, zbase=0.1)
    peg(0.3, 1.3, 0.3, 1.3)


def rubble():
    """
    O entulho (2 x 2, 0,5 m): o monte de concreto miúdo e pó, os blocos grandes de concreto quebrado (com as trincas),
    os pedaços de tijolo, os vergalhões enferrujados saindo e o pó claro em volta.
    """
    rng = np.random.default_rng(23)
    ms = [Mancha(0.76, 0.78, 0.62, seed=501, amp=0.12, lobos=(2, 3, 5))]
    manchas_decal(ms, mat_mancha(ms, ['#8a847a', '#9e988c'], beira=1.5))
    monte(0.78, 0.8, 0.5, 0.45, 0.17, ['#8e8a82', '#a29e94', '#7a766e', '#b4b0a6', '#9a5a40'], seed=5)
    CON = pedra_q('#8e8a82', seed=12)
    CONt = pedra_q('#aaa69c', seed=13)
    bloco((0.6, 0.66, 0.18), (0.44, 0.3, 0.2), {'*': CON, 'cima': CONt}, yaw=20, roll=8)
    bloco((1.02, 0.98, 0.15), (0.38, 0.34, 0.16), {'*': CON, 'cima': CONt}, yaw=-25, pitch=-10)
    bloco((0.82, 0.84, 0.34), (0.32, 0.22, 0.12), {'*': CON, 'cima': CONt}, yaw=55, pitch=12, roll=-6)
    _pedacos(rng, 6, (0.4, 1.2, 0.4, 1.2), (0.1, 0.15), (0.05, 0.07), [('#b0563a', '#8a4030'), ('#9a4a34', '#7a3a2a')], incl=25, zbase=0.1)
    for (x, y, yaw, pt) in ((0.66, 0.6, 30, 40), (0.9, 0.86, -40, 55), (1.08, 1.0, 10, 28)):
        bloco((x, y, 0.36), (0.022, 0.42, 0.022), {'*': liso('#6a3a22'), 'cima': liso('#8a4a2a')}, yaw=yaw, pitch=pt)
    peg(0.3, 1.3, 0.3, 1.3)


def chama_corpo(cx, cy, s, z0, larg, alto, cor, frente, torto=0.0, o=None):
    """
    Uma chama de frente para a câmera: o corpo arredondado (o octógono largo embaixo, afinando) e a ponta torta, em
    pedaços convexos, no plano vertical por (cx, cy); `s` para a direita na tela, `frente` para a câmera (m).
    """
    hv, rv = BE.frente_tela()
    w = larg / 2
    corpo = [(s - w * 0.7, z0), (s + w * 0.7, z0), (s + w, z0 + alto * 0.12), (s + w * 0.95, z0 + alto * 0.3),
             (s + w * 0.6 + torto * 0.5, z0 + alto * 0.5), (s - w * 0.6 + torto * 0.5, z0 + alto * 0.5), (s - w * 0.95, z0 + alto * 0.3),
             (s - w, z0 + alto * 0.12)]
    ponta = [(s - w * 0.6 + torto * 0.5, z0 + alto * 0.5), (s + w * 0.6 + torto * 0.5, z0 + alto * 0.5),
             (s + w * 0.25 + torto, z0 + alto * 0.78), (s + torto * 1.6, z0 + alto)]
    oo = o if o is not None else C().novo_obj(3, contorno=False, sombra=False)
    CZ.luzes.add(oo)
    for q in (corpo, ponta):
        P = [(cx + a * rv[0] + frente * hv[0], cy + a * rv[1] + frente * hv[1], z) for (a, z) in q]
        fp(P, (hv[0], hv[1], 0.0), liso(cor), oo, dois_lados=True)
    return oo


def fogueira(acesa=True):
    """
    A fogueira do bando no chão do salão (2 x 2, 0,6 m): a roda de pedras (enegrecidas por dentro, o lado do fogo
    alaranjado), a cama de cinza e carvão com as brasas, as toras armadas em cone e o fogo: o corpo largo e as línguas
    em três camadas (o vermelho de fora, o laranja, o miolo amarelo) e as fagulhas. Apagada ('1'): as toras pretas, a
    cinza e uma brasa fraca.
    """
    cx, cy = 0.75, 0.75
    ms = [Mancha(cx, cy, 0.66, seed=601, amp=0.07, lobos=(2, 3, 5))]
    manchas_decal(ms, mat_mancha(ms, ['#3e3634', '#4a4240'], beira=2))
    ms2 = [Mancha(cx, cy, 0.42, seed=602, amp=0.05, lobos=(3, 5))]

    def cama(X, Y, d, out):
        s = suave(np.floor(X / PH) * PH, np.floor(Y / PH) * PH, 0.06, 8)
        out = np.where((s > 0.6)[:, None], hx('#8a847c'), out)
        out = np.where((s < 0.32)[:, None], hx('#2a2422'), out)
        r = ruido(np.floor(X / (2 * PH)), np.floor(Y / (2 * PH)), 4.0)
        if acesa:
            out = np.where(((np.hypot(X - cx, Y - cy) < 0.28) & (r < 0.35))[:, None], hx('#d8561c'), out)
            out = np.where(((np.hypot(X - cx, Y - cy) < 0.2) & (r < 0.12))[:, None], hx('#ffa040'), out)
        else:
            out = np.where(((np.hypot(X - cx - 0.05, Y - cy) < 0.08) & (r < 0.45))[:, None], hx('#8a2e14'), out)
        return out
    manchas_decal(ms2, mat_mancha(ms2, ['#4a4440', '#6a6460'], beira=1.5, extra=cama), z=ZD + 0.001)
    # a roda de pedras (maiores, encostadas)
    n = 10
    for i in range(n):
        a = 2 * math.pi * i / n + 0.15
        r = 0.52 + 0.03 * math.sin(i * 2.3)
        x, y = cx + r * math.cos(a), cy + r * math.sin(a)
        rx, ry, rz = 0.15 + 0.02 * math.sin(i * 1.7), 0.12 + 0.02 * math.cos(i), 0.11 + 0.025 * math.sin(i * 3.1)
        o = novo()

        def pedra(L, n_, P, x=x, y=y, i=i):
            out = np.tile(hx(('#8e8a84', '#7e7a72', '#9a968e')[i % 3]), (len(P), 1))
            s = suave(np.floor(P[:, 0] / (2 * PH)) * 2 * PH, np.floor(P[:, 1] / (2 * PH)) * 2 * PH + P[:, 2], 0.08, i)
            out = np.where((s > 0.65)[:, None], _tom(out, 1.1), out)
            dentro = ((P[:, 0] - x) * (cx - x) + (P[:, 1] - y) * (cy - y)) > 0.004
            out = np.where(dentro[:, None], hx('#3e3634'), out)
            if acesa:
                out = np.where((dentro & (P[:, 2] > 0.05))[:, None], hx('#b0643a'), out)
            return out
        C().elipsoide(np.array([x, y, 0.0]), np.array([rx, ry, rz]), emissivo(pedra), o, corte_z=0.0)
    # as toras armadas em cone
    for k in range(5):
        a = 2 * math.pi * k / 5 + 0.4
        dx, dy = math.cos(a), math.sin(a)
        bloco((cx + dx * 0.16, cy + dy * 0.16, 0.14), (0.085, 0.52, 0.085),
              {'*': carvao('#3a2c22' if acesa else '#262020', brasa=0.3 if acesa else 0.0, seed=20 + k, celula=(5, 3)),
               'frente': liso('#c8a070' if k % 2 else '#b08a5a'), 'costas': liso('#1a1412')},
              yaw=math.degrees(a) - 90, pitch=-38)
    if acesa:
        o1 = C().novo_obj(3, contorno=False, sombra=False)
        chama_corpo(cx, cy, 0.0, 0.06, 0.42, 0.5, '#c8401a', 0.0, 0.0, o1)
        for (s, lg, al, tt) in ((-0.15, 0.14, 0.5, -0.04), (0.02, 0.18, 0.8, 0.03), (0.15, 0.13, 0.58, 0.05)):
            chama_corpo(cx, cy, s, 0.1, lg, al, '#c8401a', 0.0, tt, o1)
        o2 = C().novo_obj(3, contorno=False, sombra=False)
        chama_corpo(cx, cy, 0.0, 0.07, 0.32, 0.4, '#f08a2a', 0.03, 0.0, o2)
        for (s, lg, al, tt) in ((-0.09, 0.11, 0.42, -0.03), (0.04, 0.14, 0.6, 0.025), (0.12, 0.09, 0.4, 0.03)):
            chama_corpo(cx, cy, s, 0.1, lg, al, '#f08a2a', 0.03, tt, o2)
        o3 = C().novo_obj(3, contorno=False, sombra=False)
        chama_corpo(cx, cy, 0.0, 0.08, 0.2, 0.26, '#ffd468', 0.06, 0.0, o3)
        chama_corpo(cx, cy, 0.03, 0.12, 0.09, 0.36, '#ffd468', 0.06, 0.02, o3)
        chama_corpo(cx, cy, -0.05, 0.12, 0.07, 0.24, '#ffd468', 0.06, -0.015, o3)
        hv, rv = BE.frente_tela()
        of = C().novo_obj(3, contorno=False, sombra=False)
        CZ.luzes.add(of)
        for (s, z) in ((-0.12, 0.8), (0.12, 0.92), (0.0, 1.04)):
            P = [(cx + (s + a) * rv[0] + 0.08 * hv[0], cy + (s + a) * rv[1] + 0.08 * hv[1], z + b) for (a, b) in
                 ((0, 0), (0.033, 0), (0.033, 0.04), (0, 0.04))]
            fp(P, (hv[0], hv[1], 0.0), liso('#ffb040'), of, dois_lados=True)
    peg(cx - 0.6, cx + 0.6, cy - 0.6, cy + 0.6)


# =====================================================================================================================
# o ritual: os crânios, o altar, o estrado, a pedra do sacrifício, os pedestais, os livros, a mesa das ferramentas
# =====================================================================================================================
import casa as CA                # noqa: E402  (a vela acesa e a madeira da casa)

OSSO = '#d8cdb0'
PEDRA_N = '#3a3640'             # a pedra negra (o estrado, a pedra do sacrifício)


def cranio(x, y, z, s=0.2, frente=(0.0, 1.0), cor=OSSO, marca=None):
    """
    Um crânio (s = o comprimento, m) apoiado em z, olhando para `frente` (no plano): a calota, o rosto mais baixo, as
    órbitas e o nariz escuros (elipsoides escuros que afloram na frente), o queixo; `marca` pinta uma risca na testa.
    """
    fx, fy = frente
    nrm = math.hypot(fx, fy) or 1.0
    fx, fy = fx / nrm, fy / nrm
    lx, ly = -fy, fx
    c0 = hx(cor)

    def osso(L, n, P):
        out = np.tile(c0, (len(P), 1))
        if marca is not None:
            t = (P[:, 0] - x) * lx + (P[:, 1] - y) * ly
            q = (np.abs(t) < PH * 0.9) & (P[:, 2] > z + s * 0.62) & (((P[:, 0] - x) * fx + (P[:, 1] - y) * fy) > 0)
            out = np.where(q[:, None], hx(marca), out)
        return out
    o = novo()
    C().elipsoide(np.array([x - fx * s * 0.08, y - fy * s * 0.08, z + s * 0.48]), np.array([s * 0.46, s * 0.46, s * 0.42]), emissivo(osso), o)
    C().elipsoide(np.array([x + fx * s * 0.18, y + fy * s * 0.18, z + s * 0.34]), np.array([s * 0.34, s * 0.34, s * 0.3]), emissivo(osso), o)
    C().elipsoide(np.array([x + fx * s * 0.3, y + fy * s * 0.3, z + s * 0.1]), np.array([s * 0.2, s * 0.2, s * 0.1]), liso(_hexa(_tom(c0, 0.92))), o)
    oe = C().novo_obj(3, contorno=False)
    for sg in (-1, 1):
        C().elipsoide(np.array([x + fx * s * 0.47 + lx * sg * s * 0.15, y + fy * s * 0.47 + ly * sg * s * 0.15, z + s * 0.48]),
                      np.array([s * 0.12, s * 0.12, s * 0.11]), liso('#1c1412'), oe)
    C().elipsoide(np.array([x + fx * s * 0.52, y + fy * s * 0.52, z + s * 0.32]), np.array([s * 0.06, s * 0.06, s * 0.07]), liso('#2a1e18'), oe)
    # os dentes (a fileira clara com as frestas) logo acima do queixo
    for k in range(-2, 3):
        C().elipsoide(np.array([x + fx * s * 0.45 + lx * k * s * 0.07, y + fy * s * 0.45 + ly * k * s * 0.07, z + s * 0.17]),
                      np.array([s * 0.035, s * 0.035, s * 0.045]), liso('#ece4cc'), oe)
    return o


def vela_acesa(x, y, z, h, r=0.03, acesa=True):
    CA.vela(x, y, z, h, r, acesa)


def escorrido(x0, x1, y, z0, z1, cor='#ece2c6', passo=0.05, seed=0):
    """A cera escorrida pela beira da frente (y): fiozinhos de 2 px de larguras e comprimentos diferentes."""
    rng = np.random.default_rng(seed)
    x = x0
    while x < x1 - 0.03:
        comp = rng.uniform(0.25, 1.0) * (z1 - z0)
        w = rng.choice([2, 3]) * PH
        bloco((x + w / 2, y + 0.006, z1 - comp / 2), (w, 0.012, comp), {'*': liso(cor), 'cima': liso(cor)})
        x += w + rng.uniform(0.6, 2.4) * passo


def pedra_m(base=PEDRA_N, seed=0, junta=None, lajes=None):
    """A pedra lavrada: as manchas em dois tons, as trincas raras e, com `lajes` (comprimento, altura em m), as juntas."""
    pq = pedra_q(base, seed=seed, celula=(14, 8), trinca=0.18)
    jc = hx(junta) if junta else _tom(hx(base), 0.62)

    def f(L, n, P):
        out = pq(L, n, P)
        if lajes is not None and abs(n[2]) <= 0.5:
            from base_estilo import coords
            a, b = coords(L, n)
            la, lb = lajes
            fila = np.floor(b / lb)
            off = (fila % 2) * la * 0.5
            jun = ((b - fila * lb) < PZ) | (((a + off) % la) < PH)
            out = np.where(jun[:, None], jc, out)
            out = np.where((((b - fila * lb) >= PZ) & ((b - fila * lb) < 2 * PZ))[:, None], _tom(out, 1.1), out)
        return out
    return emissivo(f)


def altar():
    """
    O altar baixo de pedra antiga (2 x 1, 0,6 m): o pé de lajes, o tampo inteiriço saindo um pouco, a cera escorrida
    pela beira da frente, as velas (umas acesas, uma apagada caída), a tigela com o líquido escuro e um osso.
    """
    x0, x1, y0, y1 = 0.08, 1.42, 0.08, 0.66
    zt = 0.98 / UN
    PED = pedra_m('#6a6670', seed=31, lajes=(0.32, 0.16))
    caixa((x0 - 0.03, x1 + 0.03, y0 - 0.03, y1 + 0.03, 0.0, 0.07), {'*': pedra_m('#5a5660', seed=32), 'cima': liso('#6e6a74')})
    caixa((x0 + 0.04, x1 - 0.04, y0 + 0.04, y1 - 0.04, 0.07, zt - 0.09), {'*': PED, 'cima': PED})
    TOPO = pedra_m('#7a7680', seed=33)
    caixa((x0 - 0.02, x1 + 0.02, y0 - 0.02, y1 + 0.03, zt - 0.09, zt), {'*': pedra_m('#6a6670', seed=34), 'cima': TOPO})
    # a cera derretida no tampo (decalque) e escorrida pela frente
    ms = [Mancha(0.4, 0.42, 0.14, seed=35, amp=0.15, ex=1.6, lobos=(2, 3)), Mancha(1.1, 0.4, 0.12, seed=36, amp=0.15, ex=1.4, lobos=(2, 3))]
    manchas_decal(ms, mat_mancha(ms, ['#c8b890', '#e8dcbc'], beira=1.2), z=zt + 0.002)
    escorrido(x0 + 0.1, 0.62, y1 + 0.03, zt - 0.2, zt, seed=1)
    escorrido(0.92, x1 - 0.08, y1 + 0.03, zt - 0.16, zt, seed=2)
    for (x, y, h) in ((0.3, 0.38, 0.22), (0.44, 0.48, 0.14), (0.36, 0.26, 0.1), (1.08, 0.32, 0.18), (1.2, 0.46, 0.12)):
        vela_acesa(x, y, zt, h, 0.03)
    bloco((1.24, 0.24, zt + 0.02), (0.12, 0.04, 0.04), liso('#e8dcbc'), yaw=-20)
    # a tigela de bronze com o líquido escuro
    o = novo()
    _poligono_rodado(0.74, 0.4, [(zt, 0.07), (zt + 0.04, 0.11), (zt + 0.07, 0.13)], vol(0.74, 0.4, '#8a6428', brilho=0.4), o, lados=18)
    _disco(0.74, 0.4, zt + 0.06, 0.115, liso('#3a0c0a'), o, lados=18)
    # o osso (o fêmur: a haste e as duas cabeças)
    bloco((0.82, 0.58, zt + 0.02), (0.26, 0.035, 0.035), liso(OSSO), yaw=10)
    for dx in (-0.13, 0.13):
        o = novo()
        C().elipsoide(np.array([0.82 + dx, 0.58 + dx * 0.17, zt + 0.025]), np.array([0.03, 0.035, 0.026]), liso(OSSO), o)
    CZ.itens_peq.append((0.6, 0.9, 0.3, 0.62, zt))
    peg(x0 - 0.03, x1 + 0.03, y0 - 0.03, y1 + 0.03)


def _sulco(cor='#4a0c0c'):
    """O sangue nas canaletas: o escuro, o miolo um tom acima em pedaços."""
    def f(L, n, P):
        out = np.tile(hx(cor), (len(P), 1))
        r = ruido(np.floor(P[:, 0] / (3 * PH)), np.floor(P[:, 1] / (3 * PH)), 9.0)
        out = np.where((r < 0.35)[:, None], hx('#6a1410'), out)
        out = np.where((r > 0.85)[:, None], hx('#2a0806'), out)
        return out
    return emissivo(f)


def estrado_altar():
    """
    O estrado redondo de pedra negra do calabouço (5 x 5, 0,61 m, pisável; os cantos ficam vazios): o tambor de
    pedra em fiadas, a beira de cima em laje mais clara, o tampo com o sigilo cavado (inventado: os anéis, a cruz
    torta de oito braços e as marcas) com o sangue escorrido nas canaletas, e na borda as velas e os crânios.
    """
    cx = cy = 1.875
    R = 1.82
    zt = 1.0 / UN
    o = novo()

    def tambor(L, n, P):
        th = np.arctan2(P[:, 1] - cy, P[:, 0] - cx)
        z = P[:, 2]
        a = th * R / PH
        fila = np.floor(z / 0.14)
        off = (fila % 2) * 9
        out = np.tile(hx('#3e3a44'), (len(P), 1))
        k = ruido(np.floor((a + off) / 18), fila, 3.0)
        out = np.where((k < 0.35)[:, None], hx('#36323c'), out)
        out = np.where((k > 0.75)[:, None], hx('#46424c'), out)
        jun = ((z - fila * 0.14) < PZ) | (((a + off) % 18) < 1)
        out = np.where(jun[:, None], hx('#1e1c22'), out)
        out = np.where((((z - fila * 0.14) >= PZ) & ((z - fila * 0.14) < 2 * PZ) & ~jun)[:, None], hx('#4e4a54'), out)
        return out
    C().cilindro(cx, cy, R, 0.0, zt - 0.06, vol(cx, cy, '#3e3a44', faixas=lambda P, b: tambor(None, None, P)), M, o, lados=64, tampa=False)
    # a beira de cima: a laje saliente (o anel claro) e o tampo
    o2 = novo()
    C().cilindro(cx, cy, R + 0.03, zt - 0.06, zt, vol(cx, cy, '#5a5660'), M, o2, lados=64, tampa=False)

    def tampo(L, n, P):
        X, Y = P[:, 0], P[:, 1]
        rr = np.hypot(X - cx, Y - cy)
        out = np.tile(hx('#2e2a34'), (len(P), 1))
        s = suave(np.floor(X / (2 * PH)) * 2 * PH, np.floor(Y / (2 * PH)) * 2 * PH, 0.25, 5)
        out = np.where((s > 0.62)[:, None], hx('#36323c'), out)
        out = np.where((rr > R - 0.2)[:, None], hx('#5a5660'), out)
        out = np.where(((rr > R - 0.2) & (rr < R - 0.2 + PH))[:, None], hx('#1e1c22'), out)
        th = np.arctan2(Y - cy, X - cx)
        jl = (rr > R - 0.2) & ((np.abs(((th / (2 * math.pi) * 24) % 1) - 0.5) > 0.5 - 0.012 * 24 / (2 * math.pi * R)))
        out = np.where(jl[:, None], hx('#3a3640'), out)
        return out
    pts = [(cx + (R + 0.03) * math.cos(2 * math.pi * i / 64), cy + (R + 0.03) * math.sin(2 * math.pi * i / 64), zt) for i in range(64)]
    fp(pts, (0, 0, 1), emissivo(tampo), o2)
    # o sigilo cavado (o sangue nas canaletas)
    polis = []
    polis += anel(cx, cy, 1.38, 1.44, n=72)
    polis += anel(cx, cy, 0.6, 0.66, n=48)
    for k in range(8):
        a = 2 * math.pi * k / 8 + 0.2
        p0 = (cx + 0.66 * math.cos(a), cy + 0.66 * math.sin(a))
        p1 = (cx + 1.38 * math.cos(a + 0.12), cy + 1.38 * math.sin(a + 0.12))
        polis.append(risca(p0, p1, 0.055))
        # o gancho na ponta (cada braço dobra para o lado)
        p2 = (cx + 1.2 * math.cos(a + 0.28), cy + 1.2 * math.sin(a + 0.28))
        pm = (cx + 1.15 * math.cos(a + 0.1), cy + 1.15 * math.sin(a + 0.1))
        polis.append(risca(pm, p2, 0.05))
    for k in range(16):
        a = 2 * math.pi * (k + 0.5) / 16
        polis.append(risca((cx + 1.5 * math.cos(a), cy + 1.5 * math.sin(a)), (cx + 1.58 * math.cos(a), cy + 1.58 * math.sin(a)), 0.045))
    polis.append([(cx + 0.18 * math.cos(t), cy + 0.18 * math.sin(t)) for t in np.linspace(0, 2 * math.pi, 16, endpoint=False)])
    decal(polis, _sulco(), z=zt + 0.002)
    # o sangue que escorreu para fora do sulco (duas manchas) e pela beira
    ms = [Mancha(cx + 0.9, cy + 0.95, 0.1, seed=701, amp=0.2, ex=1.6, ang=45, lobos=(2, 3)), Mancha(cx - 0.3, cy + 1.25, 0.08, seed=702, amp=0.2, lobos=(2, 3))]
    manchas_decal(ms, mat_mancha(ms, ['#2a0806', '#4a0c0c']), z=zt + 0.003)
    # as velas e os crânios na borda
    for k in range(10):
        a = 2 * math.pi * k / 10 + 0.31
        x, y = cx + 1.68 * math.cos(a), cy + 1.68 * math.sin(a)
        if k % 3 == 1:
            cranio(x, y, zt, 0.19, frente=(cx - x, cy - y))
        else:
            vela_acesa(x, y, zt, 0.12 + 0.08 * ((k * 7) % 3) / 2, 0.035)
    peg(cx - R, cx + R, cy - R * 0.6, cy + R * 0.6)
    peg(cx - R * 0.6, cx + R * 0.6, cy - R, cy + R)


def corrente(p0, p1, elos=None, cor='#3a3634'):
    """A corrente reta de p0 a p1 (3D): os elos ao comprido, alternando deitado e de lado (caixas finas giradas)."""
    p0, p1 = np.array(p0, float), np.array(p1, float)
    d = p1 - p0
    L = float(np.linalg.norm(d))
    n = elos or max(2, int(L / 0.055))
    yaw = math.degrees(math.atan2(d[1], d[0])) - 90
    pitch = math.degrees(math.atan2(d[2], math.hypot(d[0], d[1])))
    o = novo()
    for i in range(n):
        c = p0 + d * (i + 0.5) / n
        bloco(tuple(c), (0.06, L / n * 1.3, 0.022), {'*': liso(cor if i % 2 else '#4a4642'), 'cima': liso('#5e5a56')}, yaw=yaw, pitch=pitch,
              roll=90 if i % 2 else 0, o=o)
    return o


def pedra_sacrificio():
    """
    A pedra do sacrifício (3 x 2, 1,0 m): o bloco de pedra negra, lisa de uso, com o tampo côncavo (o sulco do meio
    ao comprido, úmido de sangue, escorrendo pela ponta), as argolas de ferro nas quatro pontas com as correntes caídas
    até o chão e o sangue seco escorrido nos lados.
    """
    x0, x1, y0, y1 = 0.12, 2.13, 0.16, 1.34
    zt = 1.63 / UN

    def lado(L, n, P):
        out = pedra_m('#3e3a44', seed=41)(L, n, P)
        from base_estilo import coords
        a, b = coords(L, n)
        # os escorridos de sangue seco (faixas verticais de 2 a 3 px, do tampo para baixo)
        col = np.floor(a / (3 * PH))
        comp = ruido(col, 4.0)
        q = (ruido(col, 5.0) < 0.22) & (P[:, 2] > zt - 0.06 - comp * 0.55)
        out = np.where(q[:, None], hx('#3a0e0c'), out)
        return out
    caixa((x0 + 0.04, x1 - 0.04, y0 + 0.04, y1 - 0.04, 0.0, 0.08), {'*': pedra_m('#2e2a34', seed=42), 'cima': liso('#3a3640')})
    caixa((x0, x1, y0, y1, 0.08, zt - 0.08), {'*': emissivo(lado), 'cima': liso('#3e3a44')})
    yc = (y0 + y1) / 2

    def tampo(L, n, P):
        X, Y = P[:, 0], P[:, 1]
        out = pedra_m('#4a4650', seed=43)(L, n, P)
        dy = np.abs(Y - yc)
        # a concavidade: anéis de tom descendo para o meio (o desgaste), o sulco de sangue no meio
        out = np.where((dy < 0.42)[:, None], hx('#423e48'), out)
        out = np.where((dy < 0.3)[:, None], hx('#3a3640'), out)
        out = np.where((dy < 0.17)[:, None], hx('#322e38'), out)
        sul = (dy < 0.05 + 0.012 * np.sin(X * 13)) & (X > x0 + 0.12)
        out = np.where(sul[:, None], hx('#4a0c0c'), out)
        out = np.where((sul & (dy < 0.025) & (np.sin(X * 23) > 0.2))[:, None], hx('#7a1612'), out)
        out = np.where(((np.abs(dy - 0.06) < PH * 0.6) & (X > x0 + 0.12))[:, None], hx('#26222a'), out)
        # as manchas que já secaram em volta do meio
        d = 0.16 * (1 + 0.3 * np.sin(X * 9 + 1.1)) - np.hypot((X - 1.2) * 0.5, Y - yc)
        out = np.where(((d > 0) & ~sul)[:, None], hx('#3a1212'), out)
        return out
    caixa((x0 - 0.03, x1 + 0.03, y0 - 0.03, y1 + 0.03, zt - 0.08, zt), {'*': pedra_m('#46424c', seed=44), 'cima': emissivo(tampo)})
    # o sangue escorrendo pela ponta da frente (x1) até o chão
    bloco((x1 + 0.035, yc, (zt - 0.05) / 2 + 0.02), (0.012, 0.06, zt - 0.05), {'*': _sulco(), 'cima': _sulco()})
    ms = [Mancha(x1 + 0.12, yc, 0.12, seed=711, amp=0.2, ex=1.4, lobos=(2, 3))]
    manchas_decal(ms, mat_mancha(ms, ['#2a0806', '#4a0c0c', '#6a1410'], miolo=3))
    # as argolas (quadradinhas de ferro saindo da quina de cima) e as correntes
    for (ax, ay, sx, sy) in ((x0, y0, -1, -1), (x1, y0, 1, -1), (x0, y1, -1, 1), (x1, y1, 1, 1)):
        px, py = ax + sx * 0.05, ay + sy * 0.0
        _barra((px - 0.04, px + 0.04, py - 0.008, py + 0.008, zt - 0.13, zt - 0.05), '#3a3634', '#5a5652', quina=False)
        corrente((px, py + sy * 0.02, zt - 0.14), (px + sx * 0.03, py + sy * 0.08, 0.03))
        corrente((px + sx * 0.03, py + sy * 0.09, 0.012), (px + sx * 0.18, py + sy * 0.2, 0.012))
    peg(x0, x1, y0, y1)


def pedestal():
    """
    O pedestal estreito de pedra (1 x 1, 1,0 m): a base em dois degraus, a coluna oitavada, o capitel, a tigela de
    bronze em cima, cheia de cinza clara com um toco preto.
    """
    cx = cy = 0.375
    zt = 1.63 / UN
    PED = pedra_m('#8a8478', seed=51)
    caixa((0.12, 0.63, 0.12, 0.63, 0.0, 0.08), {'*': PED, 'cima': liso('#a49e92')})
    caixa((0.17, 0.58, 0.17, 0.58, 0.08, 0.15), {'*': PED, 'cima': liso('#a49e92')})
    o = novo()
    C().cilindro(cx, cy, 0.12, 0.15, zt - 0.2, vol(cx, cy, '#8a8478', faixas=lambda P, b: np.where((np.floor(P[:, 2] / 0.21) % 2 == 0)[:, None] &
                 ((P[:, 2] % 0.21) < PZ)[:, None], _tom(b, 0.7), b)), M, o, lados=8, tampa=False)
    caixa((0.18, 0.57, 0.18, 0.57, zt - 0.2, zt - 0.12), {'*': PED, 'cima': liso('#a49e92')})
    o = novo()
    _poligono_rodado(cx, cy, [(zt - 0.12, 0.06), (zt - 0.09, 0.07), (zt - 0.06, 0.15), (zt, 0.2)], vol(cx, cy, '#8a6428', brilho=0.5), o, lados=22)

    def cinza(L, n, P):
        s = suave(np.floor(P[:, 0] / PH) * PH, np.floor(P[:, 1] / PH) * PH, 0.05, 3)
        out = np.where((s > 0.55)[:, None], hx('#b8b2a8'), hx('#9a948a'))
        rr = np.hypot(P[:, 0] - cx, P[:, 1] - cy)
        return np.where((rr > 0.185)[:, None], hx('#d8b060'), out)
    _disco(cx, cy, zt - 0.01, 0.2, emissivo(cinza), o, lados=22)
    bloco((cx + 0.03, cy - 0.02, zt + 0.0), (0.09, 0.03, 0.03), liso('#1e1a18'), yaw=40)
    peg(0.12, 0.63, 0.12, 0.63)


def marmore(base='#2c2a30', veio='#8a8690'):
    """O mármore escuro: a cor e os veios claros em diagonal (riscas quebradas de 1 px)."""
    c0, cv = hx(base), hx(veio)

    def f(L, n, P):
        from base_estilo import coords
        a, b = coords(L, n)
        out = np.tile(c0, (len(P), 1))
        w = (a / PH + (b / PH) * 0.7 + 6 * np.sin(b * 11 + a * 3))
        v = (np.abs((w % 23) - 11) < 0.5) & (np.sin(a * 17 + b * 5) > -0.2)
        out = np.where(v[:, None], cv, out)
        out = np.where(((np.abs((w % 23) - 11) < 1.5) & ~v)[:, None], _tom(c0, 1.18), out)
        return out
    return emissivo(f)


def caixa_vidro(x0, x1, y0, y1, z0, z1, aro='#b0843a'):
    """A redoma quadrada: a base e a tampa de latão, as quatro hastes nas quinas, o vidro (o que fica dentro, tingido)."""
    _barra((x0 - 0.01, x1 + 0.01, y0 - 0.01, y1 + 0.01, z0 - 0.025, z0), aro, '#e0b860', quina=1.2)
    for (a, b) in ((x0, y0), (x1 - 0.012, y0), (x0, y1 - 0.012), (x1 - 0.012, y1 - 0.012)):
        _barra((a, a + 0.012, b, b + 0.012, z0, z1), aro, '#e0b860', quina=False)
    o = novo()
    C().caixa((x0, x1, y0, y1, z1, z1 + 0.02), {'cima': emissivo(lambda L, n, P: np.where((((np.floor((P[:, 0] + P[:, 1]) / PH)) % 11) < 2)[:, None], np.tile(hx('#d8e8ea'), (len(P), 1)), np.tile(hx('#9ab4ba'), (len(P), 1)))), '*': _pau(aro, '#e0b860', quina=False)}, M, o)
    cxm, cym = (x0 + x1) / 2, (y0 + y1) / 2
    _barra((cxm - 0.025, cxm + 0.025, cym - 0.025, cym + 0.025, z1 + 0.02, z1 + 0.05), aro, '#e0b860', quina=False)
    CZ.vidros.append((x0 + 0.001, x1 - 0.001, y0 + 0.001, y1 - 0.001, z0 + 0.001, z1 - 0.001))


def pedestal_relic():
    """
    O pedestal da relíquia (1 x 1, 1,3 m): a coluna quadrada de mármore escuro com os veios, a base e o capitel
    salientes, e a redoma de vidro (o aro de latão) com a relíquia: um ídolo de pedra negra, torto, com a marca
    vermelha, deitado na almofada de veludo vinho.
    """
    zt = 2.12 / UN
    zc = zt - 0.32
    MAR = marmore()
    caixa((0.15, 0.6, 0.15, 0.6, 0.0, 0.1), {'*': MAR, 'cima': liso('#3a3840')})
    caixa((0.21, 0.54, 0.21, 0.54, 0.1, zc - 0.08), {'*': MAR, 'cima': MAR})
    caixa((0.16, 0.59, 0.16, 0.59, zc - 0.08, zc), {'*': MAR, 'cima': liso('#3a3840')})
    # a almofada de veludo e o ídolo
    _p1_malha((0.24, 0.51, 0.25, 0.5, zc, zc + 0.05), (0.04, 0.04, 0.02, 0.02), liso('#6a1a26'), seg=2)
    prisma([(0.3, 0.3), (0.42, 0.27), (0.47, 0.41), (0.39, 0.48), (0.29, 0.43)], zc + 0.04, zc + 0.22, carvao('#24222a', seed=55, celula=(4, 3)),
           topo=liso('#3a3644'))
    prisma([(0.33, 0.33), (0.41, 0.31), (0.44, 0.4), (0.36, 0.43)], zc + 0.22, zc + 0.27, liso('#24222a'), topo=liso('#3a3644'))
    bloco((0.44, 0.45, zc + 0.15), (0.014, 0.05, 0.08), liso('#c02a22'), yaw=45)
    caixa_vidro(0.2, 0.55, 0.2, 0.55, zc, zt - 0.04)
    peg(0.15, 0.6, 0.15, 0.6)


def skull():
    """O crânio (1 x 1, 0,3 m): o crânio no chão, olhando para a frente, com o toco de vela derretido em cima e a cera escorrida."""
    cranio(0.375, 0.34, 0.0, 0.34, frente=(0.35, 1.0))
    o = novo()
    C().cilindro(0.35, 0.32, 0.04, 0.29, 0.35, _pau('#ece2c6', quina=False), M, o, lados=12, tampa_mat=liso('#d8caa6'))
    CA.chama(0.35, 0.32, 0.35, 0.9, True)
    for (dx, comp) in ((-0.03, 0.08), (0.02, 0.12), (0.05, 0.06)):
        o = C().novo_obj(3, contorno=False)
        C().elipsoide(np.array([0.36 + dx, 0.36, 0.31 - comp / 2]), np.array([0.014, 0.022, comp / 2]), liso('#efe4c8'), o)
    peg(0.25, 0.5, 0.22, 0.52)


def pilha_cranios():
    """A pilha de crânios (1 x 1, 0,45 m): os crânios amontoados em três andares, cada um virado para um lado, o osso amarelado e sujo."""
    pos = [(0.22, 0.3, 0.0, (0.3, 1.0)), (0.5, 0.26, 0.0, (1.0, 0.4)), (0.32, 0.54, 0.0, (0.0, 1.0)), (0.56, 0.52, 0.0, (0.8, 1.0)),
           (0.37, 0.36, 0.15, (0.5, 1.0)), (0.5, 0.45, 0.14, (1.0, 0.7)), (0.42, 0.42, 0.29, (0.6, 1.0))]
    cores = ['#d8cdb0', '#c8bc9a', '#d0c4a6', '#bcae8c']
    for i, (x, y, z, f) in enumerate(pos):
        cranio(x, y, z, 0.2, frente=f, cor=cores[i % 4])
    peg(0.12, 0.64, 0.14, 0.64)


def _livro(cen, tam, yaw, cor, o=None):
    """Um livro deitado: a capa de couro, as folhas creme nas três beiras (com as riscas) e a lombada na beira esquerda."""
    c0 = hx(cor)

    def folhas(L, n, P):
        out = np.tile(hx('#ddd0b0'), (len(P), 1))
        zz = P[:, 2]
        out = np.where(((np.floor(zz / PZ) % 2) == 0)[:, None], hx('#c8bc9c'), out)
        return out

    def capa(L, n, P):
        out = np.tile(c0, (len(P), 1))
        return out
    lomb = emissivo(lambda L, n, P: np.where(((P[:, 2] - (cen[2] - tam[2] / 2)) % 0.05 < PZ)[:, None], np.tile(hx('#c8a050'), (len(P), 1)), np.tile(_tom(c0, 0.9), (len(P), 1))))
    w, d, h = tam
    bloco(cen, (w, d, h), {'cima': emissivo(capa), 'baixo': emissivo(capa), 'esq': lomb, '*': emissivo(folhas)}, yaw=yaw, o=o)
    # as capas (um pouco maiores, finas) em cima e embaixo
    for dz in (h / 2 - PZ * 0.5, -h / 2 + PZ * 0.5):
        bloco((cen[0], cen[1], cen[2] + dz), (w + 0.012, d + 0.014, PZ), {'*': emissivo(capa)}, yaw=yaw)


def books_stack():
    """
    A pilha de livros velhos (1 x 1, 0,4 m): os livros de couro escuro empilhados tortos (cada um girado), o maior
    embaixo, o pequeno de pé encostado, e o toco de vela em cima com a cera escorrendo pela pilha.
    """
    cores = ['#4a2a1e', '#2e3a2a', '#5a1e1a', '#3a2e24', '#22262e', '#6a4a2a']
    z = 0.0
    tams = [(0.36, 0.48, 0.07), (0.32, 0.42, 0.06), (0.3, 0.4, 0.08), (0.26, 0.36, 0.05), (0.28, 0.34, 0.06), (0.22, 0.3, 0.05)]
    for i, (w, d, h) in enumerate(tams):
        _livro((0.37 + 0.02 * math.sin(i * 2.1), 0.37 + 0.02 * math.cos(i * 1.7), z + h / 2), (w, d, h), [5, -8, 12, -4, 18, -14][i], cores[i])
        z += h + PZ * 0.5
    zt = z
    vela_acesa(0.36, 0.36, zt, 0.06, 0.04)
    for (dx, comp) in ((-0.04, 0.12), (0.03, 0.2)):
        o = C().novo_obj(3, contorno=False)
        C().elipsoide(np.array([0.36 + dx, 0.53, zt - comp / 2]), np.array([0.015, 0.012, comp / 2]), liso('#efe4c8'), o)
    peg(0.15, 0.6, 0.12, 0.62)


def table_tools():
    """
    A mesa das ferramentas (2 x 1, aumento 1,2: 1,8 x 0,9 m; 0,96 m; o vão é 'fundo'): o tampo rústico de tábuas
    grossas e manchadas, as pernas quadradas, a tábua de trás; em cima a faca cerimonial, os gizes, a tigela de
    bronze, a corda enrolada, as velas e o pano manchado.
    """
    w, d = 1.5 * 1.2, 0.75 * 1.2
    x, y = 0.75 - w / 2, 0.375 - d / 2
    h = 1.57 / UN
    tp = 0.07
    TAB = ['#6a4a30', '#644428', '#704e34', '#5e4026']

    def tampo(L, n, P):
        out = tab2(TAB, 0.22, '#2a1a10', seed=81, comp=0.9, org=y)(L, n, P)
        s = suave(np.floor(P[:, 0] / PH) * PH, np.floor(P[:, 1] / PH) * PH, 0.1, 82)
        out = np.where((s > 0.72)[:, None], _tom(out, 0.78), out)
        d_ = 0.09 - np.hypot(P[:, 0] - (x + 1.25), (P[:, 1] - (y + 0.55)) * 1.4)
        out = np.where((d_ > 0)[:, None], hx('#4a1a14'), out)
        return out
    caixa((x, x + w, y, y + d, h - tp, h), {'cima': emissivo(tampo), '*': _pau('#5a3c24', '#6a4a30', quina=1.2, b=(0, 0, 0, 0, h - tp, h))})
    m = 0.05
    caixa((x + m + 0.08, x + w - m - 0.08, y + m + 0.01, y + m + 0.04, 0.2, h - tp), {'*': mad2('#4a3020', seed=83, passo=0.05)})
    PE = {'cima': liso('#6a4a30'), '*': mad2('#4e3420', eixo=1, seed=84, passo=0.04)}
    for (a, b) in ((x + m, y + m), (x + w - m - 0.08, y + m), (x + m, y + d - m - 0.08), (x + w - m - 0.08, y + d - m - 0.08)):
        caixa((a, a + 0.08, b, b + 0.08, 0.0, h - tp), PE)
    peg(x, x + w, y, y + d)
    # a faca cerimonial: a lâmina escura e comprida, a guarda, o cabo de osso
    bloco((x + 0.52, y + 0.6, h + 0.01), (0.4, 0.06, 0.016), {'cima': liso('#6a6e78'), '*': liso('#3a3e44')}, yaw=-15)
    bloco((x + 0.3, y + 0.66, h + 0.016), (0.03, 0.12, 0.03), liso('#b08a3a'), yaw=-15)
    bloco((x + 0.2, y + 0.69, h + 0.018), (0.16, 0.045, 0.036), liso(OSSO), yaw=-15)
    CZ.itens_peq.append((x + 0.2, x + 0.66, y + 0.55, y + 0.7, h))
    # os gizes (três bastões brancos) e o toco de giz vermelho
    for i, (dx, dy, yaw) in enumerate(((0.0, 0.0, 20), (0.06, 0.03, 70), (0.02, 0.08, -10))):
        bloco((x + 0.18 + dx, y + 0.22 + dy, h + 0.012), (0.11, 0.035, 0.03), liso('#ece8e0' if i < 2 else '#b03a2e'), yaw=yaw)
    # a tigela de bronze
    o = novo()
    bx, by = x + 0.85, y + 0.3
    _poligono_rodado(bx, by, [(h, 0.08), (h + 0.05, 0.13), (h + 0.09, 0.15)], vol(bx, by, '#8a6428', brilho=0.4), o, lados=18)
    _disco(bx, by, h + 0.075, 0.135, liso('#3a0c0a'), o, lados=18)
    # a corda enrolada (o rolo: o cilindro baixo com as voltas no topo)
    rx, ry = x + 1.3, y + 0.25

    def voltas(L, n, P):
        rr = np.hypot(P[:, 0] - rx, P[:, 1] - ry) / PH
        out = np.where(((np.floor(rr) % 3) == 0)[:, None], hx('#7a6038'), hx('#a8885a'))
        return np.where((rr < 1.5)[:, None], hx('#4a3a24'), out)
    o = novo()
    C().cilindro(rx, ry, 0.16, h, h + 0.08, vol(rx, ry, '#9a7c50', faixas=lambda P, b: np.where(((np.floor(P[:, 2] / PZ)) % 2 == 0)[:, None], _tom(b, 0.86), b)),
                 M, o, lados=20, tampa_mat=emissivo(voltas))
    bloco((rx + 0.12, ry + 0.2, h + 0.016), (0.24, 0.035, 0.032), liso('#9a7c50'), yaw=60)
    # as velas
    for (dx, dy, hh) in ((1.6, 0.6, 0.16), (1.68, 0.68, 0.1)):
        vela_acesa(x + dx, y + dy, h, hh, 0.03)
    # o pano manchado dobrado
    _p1_malha((x + 0.9, x + 1.15, y + 0.5, y + 0.78, h, h + 0.035), (0.02, 0.02, 0.01, 0.01),
              emissivo(lambda L, n, P: np.where((suave(P[:, 0], P[:, 1], 0.05, 3) > 0.55)[:, None], np.tile(hx('#6a2a20'), (len(P), 1)),
                                                np.tile(hx('#cfc4a8'), (len(P), 1)))), seg=2)


# =====================================================================================================================
# a Ordem (a vitrine, a armadura), os corpos, os ganchos, o monitor tomado
# =====================================================================================================================
def vitrine_paranormal():
    """
    A vitrine das relíquias (2 x 1, 2,0 m): o armário de jacarandá com a frente de vidro (os montantes e a travessa
    do meio), o fundo de veludo vinho, três prateleiras com as relíquias: a máscara clara de olhos vazados, o crânio
    marcado de vermelho, a adaga escura de lâmina torta e o pedaço do capuz amarelo dobrado; a cimalha e o rodapé.
    """
    x0, x1, y0, y1 = 0.04, 1.46, 0.08, 0.62
    zt = 3.27 / UN
    J = '#4a2416'
    MJ = {'cima': liso('#6a3420'), '*': mad2(J, eixo=1, seed=91, passo=0.05)}
    caixa((x0 + 0.03, x1 - 0.03, y0 + 0.02, y1 - 0.02, 0.0, 0.12), {'*': mad2('#2e160c', seed=92, passo=0.04)})
    # o fundo de veludo e os lados de madeira
    caixa((x0, x1, y0, y0 + 0.04, 0.12, zt - 0.12), {'frente': liso('#5a1a24'), '*': mad2(J, eixo=1, seed=93)})
    for xx in (x0, x1 - 0.05):
        caixa((xx, xx + 0.05, y0, y1, 0.12, zt - 0.12), MJ)
    # as prateleiras (o veludo em cima)
    zs = [0.12, 0.62, 1.08, 1.54]
    for z in zs:
        caixa((x0 + 0.05, x1 - 0.05, y0 + 0.04, y1 - 0.02, z, z + 0.035), {'cima': liso('#6a2230'), '*': _pau(J, '#6a3420', quina=1.2, b=(0, 0, 0, 0, z, z + 0.035))})
    # a cimalha
    caixa((x0 - 0.03, x1 + 0.03, y0 - 0.01, y1 + 0.03, zt - 0.12, zt), {'cima': tab2(['#5a2a18', '#542816'], 0.2, '#2a120a', seed=94, org=y0),
                                                                         '*': _pau('#5a2a18', quina=1.25, b=(0, 0, 0, 0, zt - 0.12, zt))})
    # as relíquias
    # a máscara (o oval claro deitado no suporte, os olhos vazados e a boca)
    o = novo()
    mx, my, mz = 0.42, 0.34, zs[1] + 0.035
    caixa((mx - 0.02, mx + 0.02, my - 0.02, my + 0.02, mz, mz + 0.1), liso('#2a1a10'))
    C().elipsoide(np.array([mx, my + 0.04, mz + 0.2]), np.array([0.1, 0.03, 0.13]), liso('#e2d8c0'), o)
    oe = C().novo_obj(3, contorno=False)
    for sg in (-1, 1):
        C().elipsoide(np.array([mx + sg * 0.04, my + 0.065, mz + 0.24]), np.array([0.022, 0.012, 0.016]), liso('#140e0c'), oe)
    C().elipsoide(np.array([mx, my + 0.065, mz + 0.13]), np.array([0.03, 0.012, 0.01]), liso('#140e0c'), oe)
    # o crânio marcado
    cranio(1.06, 0.32, zs[1] + 0.035, 0.24, frente=(0.2, 1.0), marca='#a8201a')
    # a adaga escura, deitada no veludo, a lâmina torta
    bloco((0.48, 0.36, zs[2] + 0.05), (0.32, 0.05, 0.016), {'cima': liso('#3a3a44'), '*': liso('#24242c')}, yaw=8)
    bloco((0.3, 0.33, zs[2] + 0.055), (0.03, 0.12, 0.025), liso('#8a6428'), yaw=8)
    bloco((0.22, 0.32, zs[2] + 0.055), (0.13, 0.035, 0.03), liso('#2a1a14'), yaw=8)
    # o pedaço do capuz amarelo dobrado (o pano em dois calombos)
    AM = emissivo(lambda L, n, P: np.where((np.floor((P[:, 0] + P[:, 2]) / PH) % 6 == 0)[:, None], np.tile(hx('#b08a20'), (len(P), 1)),
                                           np.tile(hx('#d8b030'), (len(P), 1))))
    _p1_malha((0.9, 1.25, 0.2, 0.5, zs[2] + 0.035, zs[2] + 0.12), (0.05, 0.05, 0.02, 0.04), AM, seg=2)
    _p1_malha((0.95, 1.2, 0.24, 0.44, zs[2] + 0.1, zs[2] + 0.17), (0.04, 0.04, 0.02, 0.03), AM, seg=2)
    # embaixo: as caixinhas de catálogo e uma esfera escura
    for (a, b, cor) in ((0.15, 0.45, '#3a2a20'), (0.5, 0.75, '#2a2e2a')):
        caixa((a, b, 0.2, 0.46, zs[0] + 0.035, zs[0] + 0.2), {'cima': liso(_hexa(_tom(hx(cor), 1.25))), '*': liso(cor)})
    o = novo()
    C().elipsoide(np.array([1.1, 0.34, zs[0] + 0.13]), np.array([0.1, 0.1, 0.1]), liso('#2a2438'), o, brilho=0.4)
    # a frente de vidro: os montantes, as travessas e o vidro (o de dentro tingido)
    for xx in (x0, x1 - 0.05, (x0 + x1) / 2 - 0.02):
        _barra((xx, xx + (0.05 if xx in (x0, x1 - 0.05) else 0.04), y1 - 0.03, y1, 0.12, zt - 0.12), '#5a2a18', '#7a3e22', quina=1.15)
    for z in (0.12, zt - 0.17):
        _barra((x0, x1, y1 - 0.03, y1, z, z + 0.05), '#5a2a18', '#7a3e22', quina=1.2)
    CZ.vidros.append((x0 + 0.05, x1 - 0.05, y0 + 0.04, y1 - 0.03, 0.17, zt - 0.17))
    # os puxadores de latão
    for xx in ((x0 + x1) / 2 - 0.05, (x0 + x1) / 2 + 0.03):
        _barra((xx, xx + 0.02, y1, y1 + 0.02, 1.0, 1.08), '#b0843a', '#e0b860', quina=False)
    peg(x0, x1, y0, y1)


def armor_display():
    """
    A armadura de exposição (1 x 1, 2,0 m): o pedestal de madeira escura, a armadura de placas (as grevas, o saiote
    em lâminas, a couraça com a quilha, as ombreiras, os braços caídos com as manoplas, o elmo com a viseira de
    frestas) em aço cinza com o brilho, e a espada apoiada no pedestal.
    """
    cx, cy = 0.375, 0.36
    zt = 3.27 / UN
    caixa((0.1, 0.65, 0.1, 0.62, 0.0, 0.14), {'cima': tab2(['#3a2014', '#361e12'], 0.18, '#1a0c06', seed=95, org=0.1),
                                             '*': _pau('#2e180e', quina=1.2, b=(0, 0, 0, 0, 0, 0.14))})
    ACO = lambda x, y, c='#8a9098': vol(x, y, c, brilho=0.55)
    # as pernas (grevas e coxotes)
    for sg in (-1, 1):
        lx = cx + sg * 0.085
        o = novo()
        _poligono_rodado(lx, cy, [(0.14, 0.07), (0.2, 0.06), (0.36, 0.065), (0.5, 0.055), (0.56, 0.065), (0.6, 0.06), (0.86, 0.075)], ACO(lx, cy), o, lados=12)
        bloco((lx, cy + 0.06, 0.18), (0.1, 0.16, 0.06), {'cima': liso('#a0a6ae'), '*': liso('#6a7078')})
    # o saiote em lâminas
    o = novo()
    _poligono_rodado(cx, cy, [(0.82, 0.19), (0.9, 0.17), (0.92, 0.18), (1.0, 0.16), (1.02, 0.17), (1.1, 0.15)],
                     vol(cx, cy, '#7e848c', brilho=0.4, faixas=lambda P, b: np.where(((P[:, 2] % 0.08) < PZ * 1.2)[:, None], _tom(b, 0.7), b)), o, lados=16)
    # a couraça (o peito abaulado: alargando para os ombros) com a quilha
    o = novo()
    _poligono_rodado(cx, cy, [(1.1, 0.15), (1.2, 0.17), (1.35, 0.2), (1.48, 0.21), (1.56, 0.17), (1.6, 0.08)], ACO(cx, cy), o, lados=18,
                     tampa_mat=liso('#5a6068'))
    bloco((cx, cy + 0.19, 1.34), (0.02, 0.03, 0.4), {'*': liso('#b8c0c8'), 'cima': liso('#c8d0d8')})
    # as ombreiras e os braços caídos
    for sg in (-1, 1):
        ox = cx + sg * 0.25
        o = novo()
        C().elipsoide(np.array([ox, cy, 1.5]), np.array([0.1, 0.11, 0.08]), liso('#8a9098'), o, brilho=0.6)
        o = novo()
        _poligono_rodado(ox + sg * 0.01, cy, [(1.0, 0.045), (1.12, 0.05), (1.22, 0.06), (1.3, 0.05), (1.45, 0.055)], ACO(ox, cy), o, lados=10)
        o = novo()
        C().elipsoide(np.array([ox + sg * 0.01, cy + 0.01, 0.96]), np.array([0.05, 0.055, 0.06]), liso('#6a7078'), o, brilho=0.4)
    # o gorjal e o elmo
    o = novo()
    C().cilindro(cx, cy, 0.08, 1.6, 1.66, ACO(cx, cy, '#7e848c'), M, o, lados=14, tampa=False)
    o = novo()
    _poligono_rodado(cx, cy, [(1.66, 0.11), (1.72, 0.125), (1.82, 0.125), (1.9, 0.11), (1.96, 0.07), (1.99, 0.02)], ACO(cx, cy), o, lados=18)
    # a viseira: as frestas (riscas pretas de 1 px na frente do elmo)
    for k in range(3):
        bloco((cx, cy + 0.115, 1.8 + k * 0.03), (0.13, 0.025, 0.012), liso('#14141a'))
    bloco((cx, cy + 0.125, 1.86), (0.012, 0.02, 0.14), liso('#b8c0c8'))
    # o penacho vermelho atrás
    o = novo()
    C().elipsoide(np.array([cx, cy - 0.06, 2.02]), np.array([0.03, 0.09, 0.05]), liso('#8a1e1a'), o)
    # a espada apoiada no pedestal (a lâmina, a guarda, o cabo, o pomo)
    sx, sy = 0.62, 0.66
    bloco((sx, sy, 0.48), (0.05, 0.012, 0.88), {'*': liso('#a8b0b8'), 'cima': liso('#c8d0d8')}, roll=-8)
    bloco((sx - 0.065, sy, 0.94), (0.2, 0.025, 0.03), liso('#7a5a24'), roll=-8)
    bloco((sx - 0.08, sy, 1.04), (0.03, 0.03, 0.16), liso('#3a2014'), roll=-8)
    o = novo()
    C().elipsoide(np.array([sx - 0.095, sy, 1.13]), np.array([0.03, 0.03, 0.03]), liso('#b0843a'), o)
    peg(0.1, 0.65, 0.1, 0.62)


def _lencol_sujo(seed=0, sangue=None):
    """O lençol encardido: o creme acinzentado, as dobras em riscas, as manchas de uso e, em `sangue`, a mancha que vazou."""
    def f(L, n, P):
        X, Y, Z = P[:, 0], P[:, 1], P[:, 2]
        out = np.tile(hx('#cdc6b2'), (len(P), 1))
        s = suave(np.floor(X / PH) * PH, np.floor(Y / PH) * PH + Z, 0.12, seed)
        out = np.where((s > 0.6)[:, None], hx('#bab29c'), out)
        out = np.where((s > 0.74)[:, None], hx('#a89c80'), out)
        # as dobras (riscas compridas ao comprido)
        g = (X / PH + 3 * np.sin(Y * 5)) % 9
        out = np.where(((g < 1) & (n[2] > 0.5))[:, None], hx('#a8a08a'), out)
        if sangue is not None:
            for (cx, cy, r) in sangue:
                d = (r * (1 + 0.2 * np.sin(np.arctan2(Y - cy, X - cx) * 3 + cx * 7)) - np.hypot(X - cx, Y - cy)) / PH
                out = np.where((d > 0)[:, None], hx('#7a4434'), out)
                out = np.where((d > 2)[:, None], hx('#6a1c16'), out)
                out = np.where((d > 5)[:, None], hx('#4e1210'), out)
        return out
    return emissivo(f)


def corpo_lencol():
    """
    O corpo coberto (1 x 3, 0,3 m): alguém deitado de costas no chão embaixo do lençol encardido: o volume da cabeça,
    os ombros e o peito, as mãos sobre a barriga, as pernas e os pés (o lençol cai pelos lados até o chão) e, na
    ponta, os dois pés descalços para fora, cinzentos, com a etiqueta presa no dedo. A mancha que vazou na barriga.
    """
    x0, x1 = 0.06, 0.69
    cxm = (x0 + x1) / 2
    zt = 0.49 / UN
    LEN = _lencol_sujo(seed=7, sangue=[(cxm + 0.04, 0.95, 0.13), (cxm - 0.1, 1.3, 0.05)])
    # o lençol no chão (a aba larga e baixa) e os volumes por baixo
    _p1_malha((x0, x1, 0.05, 2.0, 0.0, 0.05), (0.08, 0.08, 0.01, 0.04), LEN, seg=2)
    _p1_malha((cxm - 0.12, cxm + 0.12, 0.08, 0.38, 0.02, 0.24), (0.11, 0.13, 0.05, 0.11), LEN, seg=4)   # a cabeça
    _p1_malha((x0 + 0.03, x1 - 0.03, 0.34, 0.86, 0.02, zt - 0.02), (0.2, 0.2, 0.04, 0.16), LEN, seg=4)   # o peito e os ombros
    _p1_malha((x0 + 0.08, x1 - 0.08, 0.72, 1.24, 0.02, zt - 0.07), (0.16, 0.18, 0.04, 0.13), LEN, seg=4)   # a barriga
    _p1_malha((cxm - 0.15, cxm + 0.15, 0.84, 1.06, zt - 0.1, zt - 0.03), (0.08, 0.08, 0.03, 0.05), LEN, seg=3)   # as mãos
    for sg in (-1, 1):
        lx = cxm + sg * 0.09
        _p1_malha((lx - 0.085, lx + 0.085, 1.15, 1.92, 0.02, 0.15), (0.07, 0.1, 0.03, 0.07), LEN, seg=2)   # as pernas
        _p1_malha((lx - 0.06, lx + 0.06, 1.82, 1.96, 0.02, 0.2), (0.05, 0.05, 0.04, 0.05), LEN, seg=2)      # o bico do pé
    # os pés descalços para fora (a sola virada para a frente) e a etiqueta
    PELE = emissivo(lambda L, n, P: np.where((P[:, 2] < 0.04)[:, None], np.tile(hx('#8a8088'), (len(P), 1)), np.tile(hx('#b8aca8'), (len(P), 1))))
    for sg in (-1, 1):
        lx = cxm + sg * 0.1
        _p1_malha((lx - 0.05, lx + 0.05, 1.94, 2.12, 0.01, 0.1), (0.045, 0.06, 0.03, 0.045), PELE, seg=3)
        _p1_malha((lx - 0.05, lx + 0.05, 2.06, 2.16, 0.04, 0.19), (0.045, 0.045, 0.03, 0.045), PELE, seg=3)
    bloco((cxm + 0.12, 2.18, 0.12), (0.07, 0.008, 0.05), {'*': liso('#e8dcb8'), 'cima': liso('#e8dcb8')}, yaw=15, roll=-20)
    bloco((cxm + 0.105, 2.165, 0.16), (0.008, 0.008, 0.04), liso('#6a5a3a'))
    peg(x0, x1, 0.05, 2.2)


def corpo_saco():
    """
    O saco de cadáver (1 x 3, 0,3 m): o vinil preto fechado, com o volume da cabeça, dos ombros e dos pés por baixo,
    os vincos e o brilho do plástico, o zíper prateado no meio de ponta a ponta (o puxador perto da cabeça) e as
    alças de lona cinza dos lados.
    """
    x0, x1 = 0.07, 0.68
    cxm = (x0 + x1) / 2

    def vinil(L, n, P):
        X, Y, Z = P[:, 0], P[:, 1], P[:, 2]
        out = np.tile(hx('#24262c'), (len(P), 1))
        g = (Y / PH + 4 * np.sin(X * 9)) % 13
        out = np.where((g < 1)[:, None], hx('#16181c'), out)
        if n[2] > 0.5:
            # o brilho do plástico: riscas claras curtas no lado de cima
            br = (np.abs(X - cxm + 0.12) < PH * 0.9) & (np.sin(Y * 7) > 0.3)
            out = np.where(br[:, None], hx('#4a4e58'), out)
            zip_ = np.abs(X - cxm) < PH * 1.0
            out = np.where(zip_[:, None], hx('#8a8e94'), out)
            out = np.where((zip_ & (np.floor(Y / PH) % 2 == 0))[:, None], hx('#b8bcc0'), out)
        return out
    V = emissivo(vinil)
    _p1_malha((x0, x1, 0.06, 2.12, 0.0, 0.1), (0.12, 0.14, 0.02, 0.08), V, seg=3)
    _p1_malha((cxm - 0.13, cxm + 0.13, 0.12, 0.42, 0.02, 0.25), (0.11, 0.12, 0.05, 0.1), V, seg=3)
    _p1_malha((x0 + 0.03, x1 - 0.03, 0.4, 1.25, 0.02, 0.3), (0.13, 0.16, 0.04, 0.13), V, seg=3)
    _p1_malha((x0 + 0.08, x1 - 0.08, 1.2, 1.95, 0.02, 0.18), (0.1, 0.12, 0.03, 0.08), V, seg=3)
    _p1_malha((x0 + 0.1, x1 - 0.1, 1.85, 2.08, 0.02, 0.22), (0.07, 0.07, 0.04, 0.08), V, seg=2)
    # o puxador do zíper
    bloco((cxm, 0.5, 0.31), (0.03, 0.06, 0.012), liso('#c8ccd0'))
    # as alças
    for yy in (0.6, 1.6):
        for xx in (x0 - 0.01, x1 + 0.01):
            bloco((xx, yy, 0.05), (0.02, 0.12, 0.05), {'*': liso('#6a6a64'), 'cima': liso('#8a8a82')})
    peg(x0, x1, 0.06, 2.12)


def gancho_carne():
    """
    Os ganchos de açougue (1 x 2, 1,9 m): o cavalete de ferro (os dois pés em T, os postes, a travessa ao comprido),
    os ganchos pendurados nas correntinhas: dois com fardos embrulhados em estopa amarrada com corda (a ponta de
    baixo escura de sangue), um com o saco plástico preto e um vazio; as gotas e a poça embaixo.
    """
    cx = 0.375
    zt = 3.1 / UN
    FE = {'*': liso('#3a3634'), 'cima': liso('#5a5652')}
    for yy in (0.12, 1.38):
        caixa((cx - 0.03, cx + 0.03, yy - 0.03, yy + 0.03, 0.0, zt), FE)
        caixa((cx - 0.26, cx + 0.26, yy - 0.035, yy + 0.035, 0.0, 0.05), FE)
    caixa((cx - 0.035, cx + 0.035, 0.08, 1.42, zt - 0.07, zt), FE)
    # o sangue embaixo
    ms = [Mancha(cx, 0.55, 0.16, seed=801, amp=0.18, ex=1.2, lobos=(2, 3)), Mancha(cx + 0.05, 0.98, 0.1, seed=802, amp=0.15, lobos=(2, 3))]
    ms += gota(cx - 0.1, 0.78, 0.04, seed=803, coroa=2)
    manchas_decal(ms, mat_mancha(ms, ['#3c0a0a', '#5e1210', '#7a1a14'], beira=1.3, miolo=3.5))

    def estopa(sangue_z):
        def f(L, n, P):
            X, Y, Z = P[:, 0], P[:, 1], P[:, 2]
            out = np.tile(hx('#9a8462'), (len(P), 1))
            tr = ((np.floor(Z / PZ) + np.floor((X + Y) / PH)) % 3 == 0)
            out = np.where(tr[:, None], hx('#86704e'), out)
            out = np.where(((Z % 0.16) < PZ * 1.5)[:, None], hx('#5a4630'), out)     # as voltas da corda
            out = np.where((Z < sangue_z)[:, None], np.where(tr[:, None], hx('#4a1210'), hx('#5e1812')), out)
            out = np.where(((Z >= sangue_z) & (Z < sangue_z + 0.04) & (np.sin(X * 40 + Y * 30) > 0))[:, None], hx('#5e1812'), out)
            return out
        return emissivo(f)
    ganchos = [(0.3, 'estopa'), (0.62, 'vazio'), (0.9, 'estopa'), (1.18, 'saco')]
    for i, (yy, kind) in enumerate(ganchos):
        zc = zt - 0.07
        # a correntinha e o gancho em S
        corrente((cx, yy, zc), (cx, yy, zc - 0.18), elos=3)
        bloco((cx, yy + 0.02, zc - 0.22), (0.015, 0.015, 0.08), liso('#5a5652'))
        bloco((cx, yy + 0.04, zc - 0.27), (0.015, 0.05, 0.015), liso('#5a5652'))
        bloco((cx, yy + 0.06, zc - 0.25), (0.015, 0.015, 0.04), liso('#7a7672'))
        if kind == 'estopa':
            z1 = zc - 0.27
            z0 = z1 - 0.72 - 0.06 * i
            o = novo()
            _poligono_rodado(cx, yy + 0.02, [(z0, 0.05), (z0 + 0.08, 0.1), (z0 + 0.3, 0.12), (z0 + 0.55, 0.11), (z1 - 0.06, 0.07), (z1, 0.03)],
                             vol(cx, yy + 0.02, '#9a8462', faixas=lambda P, b, z0=z0: estopa(z0 + 0.14)(None, np.array([0, 1.0, 0]), P)), o, lados=12)
        elif kind == 'saco':
            z1 = zc - 0.27
            z0 = z1 - 0.6
            o = novo()
            _poligono_rodado(cx, yy + 0.02, [(z0, 0.06), (z0 + 0.1, 0.12), (z0 + 0.35, 0.13), (z1 - 0.1, 0.07), (z1, 0.025)],
                             vol(cx, yy + 0.02, '#26282c', brilho=0.5), o, lados=12)
    peg(cx - 0.26, cx + 0.26, 0.08, 1.42)


def monitor_energia(ligado=True):
    """
    O monitor tomado pela Energia (1 x 1, 1,6 m): o suporte de rodinhas com o mastro, o monitor de tubo fundido com
    outro aparelho (a caixa torta grudada do lado, as duas carcaças derretidas uma na outra), os cabos enrolados no
    mastro e no aparelho como veias (acesos em violeta quando ligado) e a tela: ligada, o verde-água com a linha do
    batimento; desligada, o vidro escuro.
    """
    cx, cy = 0.375, 0.375
    zt = 2.61 / UN
    FE = {'*': liso('#4a4e54'), 'cima': liso('#6a6e74')}
    # a base em cruz com as rodinhas e o mastro
    for yaw in (0, 90):
        bloco((cx, cy, 0.06), (0.6, 0.05, 0.035), FE, yaw=yaw)
    for (dx, dy) in ((0.28, 0), (-0.28, 0), (0, 0.28), (0, -0.28)):
        o = novo()
        C().elipsoide(np.array([cx + dx, cy + dy, 0.028]), np.array([0.03, 0.03, 0.028]), liso('#1e1e22'), o)
    caixa((cx - 0.025, cx + 0.025, cy - 0.025, cy + 0.025, 0.06, 1.05), FE)
    # o monitor de tubo (a caixa bege e o fundo afunilado) e o aparelho fundido do lado
    mz0, mz1 = 1.0, zt - 0.08
    cv = hx('#d890ff') if ligado else hx('#5a5060')
    cv2 = hx('#9a40e0') if ligado else hx('#6e6872')

    def carcaca(cor):
        c0 = hx(cor)

        def f(L, n, P):
            from base_estilo import coords
            a, b = coords(L, n)
            out = np.tile(c0, (len(P), 1))
            w = np.abs(np.sin(a * 9 + 2.5 * np.sin(b * 13 + a * 4)))
            w2 = np.abs(np.sin(b * 8 + 2.0 * np.sin(a * 11)))
            v = ((w < 0.09) & (np.sin(b * 5 + a * 3) > -0.3)) | ((w2 < 0.07) & (np.sin(a * 6) > 0.1))
            out = np.where(((w < 0.2) & ~v & (np.sin(b * 5 + a * 3) > -0.3))[:, None], _tom(c0, 0.8), out)
            out = np.where(v[:, None], cv, out)
            out = np.where((v & (np.sin(a * 40) > 0.5))[:, None], cv2, out)
            return out
        return emissivo(f)
    BEGE = {'cima': carcaca('#bcb4a0'), '*': carcaca('#a8a08a'), 'frente': liso('#b4ac96')}
    caixa((cx - 0.24, cx + 0.24, cy - 0.06, cy + 0.2, mz0, mz1), BEGE)
    caixa((cx - 0.17, cx + 0.17, cy - 0.28, cy - 0.06, mz0 + 0.06, mz1 - 0.08), {'cima': carcaca('#a8a08a'), '*': carcaca('#948c78')})
    # a tela (afundada na moldura)
    tx0, tx1, tz0, tz1 = cx - 0.19, cx + 0.19, mz0 + 0.07, mz1 - 0.06

    def tela(L, n, P):
        X, Z = P[:, 0], P[:, 2]
        if not ligado:
            out = np.tile(hx('#2a3034'), (len(P), 1))
            out = np.where((((np.floor((X - tx0) / PH) + np.floor((tz1 - Z) / PZ)) % 13) < 2)[:, None], hx('#3e464a'), out)
            return out
        out = np.tile(hx('#1e4a46'), (len(P), 1))
        out = np.where(((np.floor(Z / PZ) % 2) == 0)[:, None], hx('#1a423e'), out)
        u = (X - tx0) / (tx1 - tx0)
        lin = 0.5 + 0.06 * np.sin(u * 30)
        pico = np.abs(u - 0.55) < 0.05
        lin = np.where(pico, 0.5 + 0.35 * (1 - np.abs(u - 0.55) / 0.05) * np.sign(np.sin(u * 200)), 0.5)
        v = (Z - tz0) / (tz1 - tz0)
        q = np.abs(v - lin) < 0.05
        out = np.where(q[:, None], hx('#7cf0a8'), out)
        # o violeta da Energia vazando pela beira da tela
        bd = (u < 0.06) | (u > 0.94) | (v < 0.08) | (v > 0.92)
        out = np.where((bd & (np.sin(u * 37 + v * 23) > 0.2))[:, None], hx('#a050e0'), out)
        return out
    ot = C().novo_obj(3, contorno=False)
    if ligado:
        CZ.luzes.add(ot)
    fp([(tx0, cy + 0.202, tz0), (tx1, cy + 0.202, tz0), (tx1, cy + 0.202, tz1), (tx0, cy + 0.202, tz1)], (0, 1, 0), emissivo(tela), ot)
    # o aparelho fundido: a caixa preta torta grudada do lado direito, a massa derretida entre os dois
    bloco((cx + 0.3, cy + 0.02, mz0 + 0.12), (0.2, 0.3, 0.22), {'*': liso('#2a2a30'), 'cima': liso('#3a3a42'), 'frente': liso('#24242a')}, yaw=12, roll=-14)
    o = novo()
    C().elipsoide(np.array([cx + 0.22, cy + 0.04, mz0 + 0.18]), np.array([0.08, 0.14, 0.16]), liso('#4a4440'), o)
    o = novo()
    C().elipsoide(np.array([cx + 0.2, cy + 0.1, mz0 + 0.02]), np.array([0.05, 0.06, 0.07]), liso('#3a3430'), o)
    # os leds do aparelho
    for k in range(3):
        bloco((cx + 0.32, cy + 0.18, mz0 + 0.1 + k * 0.04), (0.02, 0.012, 0.02), liso('#c060ff' if ligado else '#3a3040'))
    # as veias: os cabos enrolados (acesos)
    cor_v = '#c070ff' if ligado else '#3a3440'
    ov = C().novo_obj(3, contorno=not ligado, sombra=False)
    if ligado:
        CZ.luzes.add(ov)
    for k in range(26):
        z = 0.1 + k * 0.035
        a = k * 0.9
        bloco((cx + 0.032 * math.cos(a), cy + 0.032 * math.sin(a), z), (0.026, 0.05, 0.026), liso(cor_v), yaw=math.degrees(a), o=ov)
    for (p0, p1) in (((cx - 0.24, cy + 0.2, mz1 - 0.02), (cx - 0.1, cy + 0.205, mz1 + 0.01)), ((cx + 0.24, cy + 0.12, mz0 + 0.3), (cx + 0.35, cy + 0.1, mz0 + 0.24)),
                     ((cx - 0.25, cy + 0.05, mz0 + 0.1), (cx - 0.24, cy + 0.15, mz0 + 0.38)), ((cx + 0.1, cy - 0.28, mz0 + 0.3), (cx - 0.02, cy - 0.3, mz0 + 0.12))):
        p0, p1 = np.array(p0), np.array(p1)
        d = p1 - p0
        bloco(tuple((p0 + p1) / 2), (0.02, float(np.linalg.norm(d)) + 0.02, 0.02), liso(cor_v),
              yaw=math.degrees(math.atan2(d[1], d[0])) - 90, pitch=math.degrees(math.atan2(d[2], math.hypot(d[0], d[1]))), o=ov)
    # o cabo grosso descendo até o chão e correndo para a frente
    tubo_chao([(cx, cy), (cx + 0.1, cy + 0.2), (cx + 0.05, 0.75)], 0.04, 0.03, '#1e1e24')
    peg(cx - 0.3, cx + 0.3, cy - 0.3, cy + 0.3)


# =====================================================================================================================
# o resto (a Sede e o bando): a bandeja, a lixeira, a placa de piso molhado, o carrinho de limpeza
# =====================================================================================================================
def food_tray():
    """
    A bandeja de comida (1 x 1, 0,1 m): a bandeja de alumínio amassada com as divisões, o mingau cinzento, o pedaço
    de pão duro, o osso roído, a colher torta e a caneca de lata ao lado.
    """
    x0, x1, y0, y1 = 0.12, 0.6, 0.18, 0.56
    zb, zt = 0.0, 0.035

    def bandeja(L, n, P):
        X, Y = P[:, 0], P[:, 1]
        out = np.tile(hx('#a8acb0'), (len(P), 1))
        if n[2] > 0.5:
            bd = np.minimum(np.minimum(X - x0, x1 - X), np.minimum(Y - y0, y1 - Y)) / PH
            out = np.where((bd > 2)[:, None], hx('#8a8e94'), out)
            out = np.where(((bd > 2) & (bd < 3))[:, None], hx('#6a6e74'), out)
            div = (np.abs(X - 0.38) < PH) & (bd > 2) | (np.abs(Y - 0.34) < PH) & (X > 0.38) & (bd > 2)
            out = np.where(div[:, None], hx('#b8bcc0'), out)
            mo = (X < 0.37) & (bd > 3) & (suave(X, Y, 0.06, 2) > 0.3)
            out = np.where(mo[:, None], hx('#a89e86'), out)
            out = np.where((mo & (np.floor(X / PH) % 4 == 0) & (np.floor(Y / PH) % 3 == 0))[:, None], hx('#7e745e'), out)
            amassa = np.hypot(X - 0.5, Y - 0.5) < 0.04
            out = np.where((amassa & (bd > 2))[:, None], hx('#6e7278'), out)
        return out
    caixa((x0, x1, y0, y1, zb, zt), {'cima': emissivo(bandeja), '*': liso('#7a7e84')})
    # o pão duro e o osso roído
    o = novo()
    C().elipsoide(np.array([0.48, 0.26, zt + 0.015]), np.array([0.06, 0.045, 0.03]), liso('#b8844a'), o)
    bloco((0.48, 0.44, zt + 0.015), (0.14, 0.025, 0.025), liso('#d8ccae'), yaw=30)
    for dx in (-0.065, 0.065):
        o = novo()
        C().elipsoide(np.array([0.48 + dx * 0.87, 0.44 + dx * 0.5, zt + 0.018]), np.array([0.022, 0.022, 0.02]), liso('#d8ccae'), o)
    # a colher
    bloco((0.25, 0.42, zt + 0.006), (0.16, 0.018, 0.008), liso('#c8ccd0'), yaw=-25)
    # a caneca de lata (esmaltada, lascada)
    o = novo()
    mx, my = 0.6, 0.62
    C().cilindro(mx, my, 0.05, 0.0, 0.11, vol(mx, my, '#e0dcd0', faixas=lambda P, b: np.where((P[:, 2] > 0.1)[:, None], hx('#2e4a6a'), b)), M, o, lados=14,
                 tampa_mat=liso('#3a3430'))
    bloco((mx + 0.06, my, 0.06), (0.02, 0.012, 0.06), liso('#c8c4b8'))
    CZ.itens_peq.append((x0, x1, y0, y1, zt))
    peg(x0, x1, y0, y1)


def trash_can():
    """
    A lixeira de metal (1 x 1, 0,6 m): o cesto redondo de chapa galvanizada com os frisos e um amassado, a tampa
    basculante em cúpula (a portinhola de vai e vem) e a ponta do saco preto escapando por baixo da tampa.
    """
    cx, cy = 0.375, 0.375
    zt = 0.98 / UN

    def chapa(P, b):
        z = P[:, 2]
        b = np.where(((np.abs(z - 0.12) < PZ) | (np.abs(z - 0.38) < PZ))[:, None], _tom(b, 0.7), b)
        b = np.where(((np.abs(z - 0.12 - PZ * 1.5) < PZ * 0.5) | (np.abs(z - 0.38 - PZ * 1.5) < PZ * 0.5))[:, None], _tom(b, 1.12), b)
        th = np.arctan2(P[:, 1] - cy, P[:, 0] - cx)
        am = (np.abs(th - 1.2) < 0.25) & (np.abs(z - 0.25) < 0.07)
        return np.where(am[:, None], _tom(b, 0.78), b)
    o = novo()
    C().cilindro(cx, cy, 0.2, 0.0, zt - 0.1, vol(cx, cy, '#9a9ea2', brilho=0.4, faixas=chapa), M, o, lados=22, tampa_mat=liso('#2a2a2a'), r1=0.22)
    o = novo()
    _poligono_rodado(cx, cy, [(zt - 0.1, 0.23), (zt - 0.08, 0.23), (zt - 0.04, 0.2), (zt, 0.13), (zt + 0.01, 0.05)], vol(cx, cy, '#a8acb0', brilho=0.5), o, lados=22)
    # a portinhola basculante (o retângulo escuro na frente da cúpula)
    bloco((cx, cy + 0.17, zt - 0.05), (0.18, 0.02, 0.07), {'*': liso('#3a3e42'), 'cima': liso('#5a5e62')}, pitch=-35)
    bloco((cx + 0.04, cy + 0.215, zt - 0.11), (0.08, 0.04, 0.03), liso('#1e1e22'), pitch=-20)
    peg(cx - 0.22, cx + 0.22, cy - 0.22, cy + 0.22)


def wet_sign():
    """
    A placa de piso molhado (1 x 1, 0,6 m): o cavalete amarelo de plástico (as duas abas inclinadas, a alça em cima),
    em cada aba o triângulo de alerta preto (sem letras) e a faixa preta embaixo.
    """
    cx, cy = 0.375, 0.375
    zt = 0.98 / UN
    ang = 13
    alt = zt / math.cos(math.radians(ang))

    def aba(L, n, P):
        X, Z = P[:, 0], P[:, 2]
        out = np.tile(hx('#e8c020'), (len(P), 1))
        if abs(n[2]) > 0.95:
            return out
        u = (X - cx) / 0.15
        v = (Z - 0.3) / 0.13
        tri = (v > -0.6) & (v < 0.8) & (np.abs(u) < (0.8 - v) * 0.75)
        dentro = (v > -0.35) & (v < 0.45) & (np.abs(u) < (0.45 - v) * 0.75 - 0.08)
        out = np.where((tri & ~dentro)[:, None], hx('#1e1e1e'), out)
        out = np.where(((np.abs(u) < 0.08) & (v > -0.2) & (v < 0.3) & dentro)[:, None], hx('#1e1e1e'), out)
        out = np.where(((np.abs(u) < 0.08) & (v > -0.32) & (v < -0.24))[:, None], hx('#1e1e1e'), out)
        out = np.where(((Z < 0.08) & (Z > 0.05))[:, None], hx('#1e1e1e'), out)
        return out
    for sg in (-1, 1):
        bloco((cx, cy + sg * math.sin(math.radians(ang)) * alt / 2, zt / 2), (0.3, 0.018, alt), {'*': emissivo(aba), 'cima': liso('#f0d040')},
              pitch=sg * ang)
    # a alça em cima (o vão vazado: a barra amarela)
    bloco((cx, cy, zt + 0.03), (0.16, 0.03, 0.025), {'*': liso('#d8b018'), 'cima': liso('#f0d040')})
    for dx in (-0.07, 0.07):
        bloco((cx + dx, cy, zt + 0.01), (0.025, 0.03, 0.04), liso('#d8b018'))
    peg(cx - 0.15, cx + 0.15, cy - 0.15, cy + 0.15)


def janitor_cart():
    """
    O carrinho de limpeza (1 x 1, 1,1 m): o carrinho cinza de plástico (a armação, a prateleira de baixo e a bandeja
    de cima com os borrifadores azul e verde), o balde amarelo com o espremedor na frente, o cabo do esfregão de pé,
    o saco de lixo preto pendurado atrás e as rodinhas.
    """
    x0, x1, y0, y1 = 0.1, 0.65, 0.08, 0.66
    zt = 1.8 / UN
    CINZ = {'*': liso('#5a5e64'), 'cima': liso('#7a7e84')}
    for (a, b) in ((x0, y0), (x1 - 0.035, y0), (x0, y0 + 0.3), (x1 - 0.035, y0 + 0.3)):
        caixa((a, a + 0.035, b, b + 0.035, 0.05, zt - 0.2), CINZ)
    for z in (0.08, 0.48, zt - 0.24):
        caixa((x0, x1, y0, y0 + 0.335, z, z + 0.035), CINZ)
    # a plataforma baixa da frente (onde vai o balde)
    caixa((x0, x1, y0 + 0.335, y1, 0.05, 0.08), {'*': liso('#4a4e54'), 'cima': liso('#6a6e74')})
    for (a, b) in ((x0 + 0.03, y0 + 0.03), (x1 - 0.03, y0 + 0.03), (x0 + 0.03, y1 - 0.06), (x1 - 0.03, y1 - 0.06)):
        o = novo()
        C().elipsoide(np.array([a, b, 0.028]), np.array([0.03, 0.03, 0.028]), liso('#1e1e22'), o)
    # a alça de empurrar
    caixa((x0, x0 + 0.025, y0 + 0.1, y0 + 0.125, zt - 0.2, zt - 0.02), CINZ)
    caixa((x1 - 0.025, x1, y0 + 0.1, y0 + 0.125, zt - 0.2, zt - 0.02), CINZ)
    caixa((x0, x1, y0 + 0.1, y0 + 0.125, zt - 0.045, zt - 0.02), CINZ)
    # o saco de lixo preto (pendurado atrás, no meio da armação)
    o = novo()
    _poligono_rodado((x0 + x1) / 2, y0 + 0.17, [(0.12, 0.1), (0.2, 0.15), (0.38, 0.14), (0.47, 0.11)], vol((x0 + x1) / 2, y0 + 0.17, '#222428', brilho=0.5), o, lados=14)
    # os borrifadores na bandeja de cima
    for (bx, by, cor) in ((x0 + 0.12, y0 + 0.17, '#3a7ac8'), (x0 + 0.26, y0 + 0.2, '#4ab06a'), (x1 - 0.12, y0 + 0.15, '#e8e4dc')):
        o = novo()
        z = zt - 0.205
        _poligono_rodado(bx, by, [(z, 0.04), (z + 0.14, 0.04), (z + 0.17, 0.02)], vol(bx, by, cor, brilho=0.3), o, lados=12)
        bloco((bx, by + 0.02, z + 0.2), (0.03, 0.06, 0.04), liso('#e0e0e0' if cor != '#e8e4dc' else '#3a7ac8'))
    # o balde amarelo na frente com o espremedor
    bx, by = (x0 + x1) / 2, y1 - 0.15
    o = novo()
    _poligono_rodado(bx, by, [(0.08, 0.13), (0.34, 0.16)], vol(bx, by, '#e8c020', brilho=0.3), o, lados=18, tampa_mat=liso('#4a5a5a'))
    caixa((bx - 0.12, bx + 0.12, by - 0.16, by - 0.02, 0.32, 0.42), {'*': liso('#8a8e94'), 'cima': liso('#aab0b4')})
    # o esfregão: o cabo saindo do balde, inclinado para trás
    bloco((bx + 0.08, by + 0.02, 0.72), (0.03, 0.03, 0.9), {'*': liso('#c8c4b8'), 'cima': liso('#e0dcd0')}, pitch=12)
    peg(x0, x1, y0, y1)


ITENS = {
    'blood_drops': (1, 1, (0.0, 0.0), blood_drops, {}),
    'blood_pool': (1, 1, (0.0, 0.0), blood_pool, {}),
    'fuligem': (1, 1, (0.0, 0.0), fuligem, {}),
    'cinzas': (1, 1, (0.0, 0.0), cinzas, {}),
    'dirt': (1, 1, (0.0, 0.0), dirt, {}),
    'puddle': (1, 1, (0.0, 0.0), puddle, {}),
    'oil_stain': (1, 1, (0.0, 0.0), oil_stain, {}),
    'drain': (1, 1, (0.0, 0.0), drain, {}),
    'vent': (1, 1, (0.0, 0.0), vent, {}),
    'wax_pool': (1, 1, (0.0, 0.0), wax_pool, {}),
    'sigil_floor': (3, 3, (0.0, 0.0), sigil_floor, {}),
    'sigil_gold': (3, 3, (0.0, 0.0), sigil_gold, {}),
    'cables_floor': (3, 1, (0.0, 0.0), cables_floor, {}),
    'cama_queimada': (1, 3, (0.0, 0.0), cama_queimada, {}),
    'catre': (1, 3, (0.0, 0.0), catre, {}),
    'colchao_chao': (1, 2, (0.0, 0.0), colchao_chao, {}),
    'viga_queimada': (1, 3, (0.0, 0.0), viga_queimada, {}),
    'escombros': (2, 2, (0.0, 0.0), escombros, {}),
    'rubble': (2, 2, (0.0, 0.0), rubble, {}),
    'fogueira': (2, 2, (0.0, 0.0), lambda: fogueira(True), {'1': lambda: fogueira(False)}),
    'altar': (2, 1, (0.0, 0.0), altar, {}),
    'estrado_altar': (5, 5, (0.0, 0.0), estrado_altar, {}),
    'pedra_sacrificio': (3, 2, (0.0, 0.0), pedra_sacrificio, {}),
    'pedestal': (1, 1, (0.0, 0.0), pedestal, {}),
    'pedestal_relic': (1, 1, (0.0, 0.0), pedestal_relic, {}),
    'skull': (1, 1, (0.0, 0.0), skull, {}),
    'pilha_cranios': (1, 1, (0.0, 0.0), pilha_cranios, {}),
    'books_stack': (1, 1, (0.0, 0.0), books_stack, {}),
    'table_tools': (2, 1, (0.0, 0.0), table_tools, {}),
    'vitrine_paranormal': (2, 1, (0.0, 0.0), vitrine_paranormal, {}),
    'armor_display': (1, 1, (0.0, 0.0), armor_display, {}),
    'corpo_lencol': (1, 3, (0.0, 0.0), corpo_lencol, {}),
    'corpo_saco': (1, 3, (0.0, 0.0), corpo_saco, {}),
    'gancho_carne': (1, 2, (0.0, 0.0), gancho_carne, {}),
    'monitor_energia': (1, 1, (0.0, 0.0), lambda: monitor_energia(True), {'1': lambda: monitor_energia(False)}),
    'food_tray': (1, 1, (0.0, 0.0), food_tray, {}),
    'trash_can': (1, 1, (0.0, 0.0), trash_can, {}),
    'wet_sign': (1, 1, (0.0, 0.0), wet_sign, {}),
    'janitor_cart': (1, 1, (0.0, 0.0), janitor_cart, {}),
}
