"""
GRUPO H1, "parede da casa e do horror": os ITENS DE PAREDE em pixel art 1:1, só por código, no estilo da cozinha da
fazenda (o relógio, a natureza-morta, a prateleira e a tábua de colheres de agente_cozinha/cozinha.py).

Cada item é desenhado na parede de trás (o plano y = 0, saindo para +y), com o meio em (x, 0, z) metros; o exportador
(exportar_parede_px.py) põe na parede da direita e espelha na da esquerda. Tamanho: o def.w × def.h do catálogo em px do
tabuleiro (32 px = 0,75 m na horizontal; 32 px = 1 unidade = 1/1,633 m na vertical).

Duas maneiras de desenhar, juntas no mesmo item:
  - a peça de volume (moldura, prateleira, gaiola, cano, tocha): caixas e faces do motor (a luz e o contorno da cena);
  - o que é chapado na parede ou no pano (a pintura do quadro, o risco, a fuligem, o sangue, a corrente): pintado
    pixel a pixel num PLANO (Pl) já na grade da tela (cada pixel da pintura = 1 pixel do tabuleiro, sem pixel solto),
    com as cores finais (sem a luz da face) e o contorno feito à mão. O que é meio transparente (a fuligem, a sombra
    que o item faz na parede) sai em dois degraus (0,32 e 0,14 de escuro), pelo chão invisível do exportador.

Estados: 0 é o aceso (padrão), '1' o apagado. A janela gradeada: 0 o dia lá fora, '1' escura.
"""
import math

import numpy as np

import cozinha as CZ
import base_estilo as BE
import casa as CA
from base_estilo import (hx, liso, mad2, tab2, vol, _tom, _pau, _barra, _p1_mat_rampa, _p1_rampa, _poligono_rodado,
                         PH, PZ)
from motor import emissivo, ruido, suave, KX, KY, KZ, VISTA, tela

M = BE.M
UN = 1.633                      # unidades do jogo por metro


def mw(px):
    """px do def (na horizontal) em metros."""
    return px * 0.75 / 32


def mh(px):
    """px do def (na vertical) em metros."""
    return px / 32 / UN


def C():
    return CZ.c


def novo(contorno=True, sombra=True):
    return C().novo_obj(3, contorno=contorno, sombra=sombra)


def caixa(b, mat, ch=0.0, oid=None):
    o = novo() if oid is None else oid
    C().caixa(b, mat, M, o, ch=ch)
    return o


def fp(pts, n, mat, oid, dois_lados=False):
    C().face_plana(pts, n, mat, M, oid, dois_lados=dois_lados)


def _c(h):
    return hx(h) if isinstance(h, str) else np.asarray(h, float)


def escuro(cor):
    """O contorno de fora (o mesmo do acabamento: cor·0,28 + (26, 13, 11))."""
    return _c(cor) * 0.28 + np.array([26.0, 13.0, 11.0])


# =====================================================================================================================
# o plano pintado: a grade da tela num plano y = yp da parede (cada pixel = 1 pixel do tabuleiro)
# =====================================================================================================================
_NIVEL = {2: (1000.5, 1000.5), 1: (1999.99, 2000.5)}     # os pontos falsos que o chão invisível pinta de 0,32 e 0,14


def _niveis():
    """O chão invisível do exportador escurece (0,32 / 0,14) o que cai numa pegada: duas pegadas longe de tudo."""
    for peg in ((1000.0, 1001.0, 1000.0, 1001.0), (2000.0, 2001.0, 2000.0, 2001.0)):
        if peg not in CZ.pegadas:
            CZ.pegadas.append(peg)


class Pl:
    """
    Um retângulo (x0..x1, z0..z1) do plano y = yp, na grade da tela: as colunas são as da tela, e cada coluna desce
    pixel a pixel. u e w: a posição em px da parede (u para a direita a partir de x0, w para baixo a partir de z1),
    contínua e já com o 2:1 da câmera; i e v: a coluna e a linha da grade (inteiros). rgb: a cor final; nv: 0 nada,
    255 opaco, 2 sombra forte (0,32), 1 sombra leve (0,14).
    """

    def __init__(self, x0, x1, z0, z1, yp=0.0):
        self.x0, self.x1, self.z0, self.z1, self.yp = x0, x1, z0, z1, yp
        sxa, sxb = int(math.floor((x0 - yp) * KX)), int(math.ceil((x1 - yp) * KX))
        cols = np.arange(sxa, sxb)
        Xc = (cols + 0.5) / KX + yp
        top = np.floor((Xc + yp) * KY - z1 * KZ).astype(int)
        bot = np.ceil((Xc + yp) * KY - z0 * KZ).astype(int)
        H = int((bot - top).max()) + 1
        self.W, self.H = len(cols), H
        self.SX = np.tile(cols[None, :], (H, 1))
        self.SY = top[None, :] + np.arange(H)[:, None]
        self.X = np.tile(Xc[None, :], (H, 1))
        self.Z = ((self.X + yp) * KY - (self.SY + 0.5)) / KZ
        self.u = (self.X - x0) * KX
        self.w = (z1 - self.Z) * KZ
        self.i = np.tile(np.arange(self.W)[None, :], (H, 1))
        self.v = np.floor(self.w + 1e-6).astype(int)
        self.dentro = (self.Z >= z0) & (self.Z <= z1) & (self.X >= x0) & (self.X <= x1)
        self.rgb = np.zeros((H, self.W, 3))
        self.nv = np.zeros((H, self.W), np.uint8)

    # ------------------------------------------------------------------ formas (máscaras em u, w)
    def ret(self, u0, w0, u1, w1):
        return self.dentro & (self.u >= u0) & (self.u < u1) & (self.w >= w0) & (self.w < w1)

    def elipse(self, cu, cw, ru, rw):
        return self.dentro & (((self.u - cu) / ru) ** 2 + ((self.w - cw) / rw) ** 2 <= 1.0)

    def seg(self, a, b, larg=1.0):
        """O traço de a a b (em u, w) com a largura em px."""
        (ua, wa), (ub, wb) = a, b
        du, dw = ub - ua, wb - wa
        L2 = du * du + dw * dw or 1e-9
        t = np.clip(((self.u - ua) * du + (self.w - wa) * dw) / L2, 0, 1)
        d = np.hypot(self.u - (ua + t * du), self.w - (wa + t * dw))
        return self.dentro & (d <= larg / 2 + (0.06 if larg <= 1.0 else 0.21))

    def linha(self, pts, larg=1.0):
        m = np.zeros_like(self.dentro)
        for a, b in zip(pts[:-1], pts[1:]):
            m |= self.seg(a, b, larg)
        return m

    def poli(self, pts):
        """O polígono (u, w) cheio (par-ímpar)."""
        m = np.zeros_like(self.dentro)
        n = len(pts)
        for k in range(n):
            (ua, wa), (ub, wb) = pts[k], pts[(k + 1) % n]
            cruza = ((wa > self.w) != (wb > self.w))
            ux = ua + (self.w - wa) * (ub - ua) / ((wb - wa) if wb != wa else 1e-9)
            m ^= cruza & (self.u < ux)
        return self.dentro & m

    # ------------------------------------------------------------------ pintar
    def pin(self, m, cor, nv=255):
        m = m & self.dentro
        self.rgb[m] = _c(cor)
        self.nv[m] = nv
        return m

    def opaco(self):
        return self.nv == 255

    def borda(self, m=None):
        """Os pixels de m (padrão: o opaco) que encostam (4-viz.) em quem não é m."""
        m = self.opaco() if m is None else m
        p = np.pad(m, 1)
        fora = ~p[:-2, 1:-1] | ~p[2:, 1:-1] | ~p[1:-1, :-2] | ~p[1:-1, 2:]
        return m & fora

    def contorno(self, m=None):
        """O contorno de 1 px por fora, como o do acabamento (sobre o próprio pixel da borda)."""
        b = self.borda(m)
        self.rgb[b] = self.rgb[b] * 0.28 + np.array([26.0, 13.0, 11.0])
        return b

    def contorno_fora(self, m=None, cor='#1e1410'):
        """O contorno de 1 px por FORA da forma (para a peça fina, que sumiria com o contorno por dentro)."""
        m = self.opaco() if m is None else m
        p = np.pad(m, 1)
        fora = ~m & (p[:-2, 1:-1] | p[2:, 1:-1] | p[1:-1, :-2] | p[1:-1, 2:]) & self.dentro
        self.pin(fora, cor)
        return fora

    def tom(self, m, k):
        m = m & (self.nv == 255)
        self.rgb[m] = _tom(self.rgb[m], k)

    def limpa_soltos(self, nv=255):
        """Tira o pixel solto (sem vizinho 4 do mesmo nível)."""
        m = self.nv == nv
        p = np.pad(m, 1)
        viz = p[:-2, 1:-1] | p[2:, 1:-1] | p[1:-1, :-2] | p[1:-1, 2:]
        self.nv[m & ~viz] = 0

    def grava(self, luz=True):
        """Põe na cena: o opaco como objeto que já traz a cor (sem a luz da face, sem contorno automático)."""
        c = C()
        oid = c.novo_obj(3, contorno=False, sombra=False)
        if luz:
            CZ.luzes.add(oid)
        osom = c.novo_obj(1, contorno=False, sombra=False)
        for nv, ob in ((255, oid), (2, osom), (1, osom)):
            m = self.nv == nv
            if not m.any():
                continue
            if nv != 255:
                _niveis()
            sx, sy = self.SX[m], self.SY[m]
            P = np.stack([self.X[m], np.full(sx.shape, self.yp), self.Z[m]], 1)
            _escreve(sx, sy, P, self.rgb[m], ob, falso=None if nv == 255 else _NIVEL[nv])
            # a medida (o `real` do exportador) sai dos polígonos: o plano pintado entra com o retângulo dele
            c.polis.append((np.array([[self.x0, self.yp, self.z0], [self.x1, self.yp, self.z0], [self.x1, self.yp, self.z1],
                                      [self.x0, self.yp, self.z1]]), np.array([0.0, 1.0, 0.0])))
        return oid


def _escreve(sx, sy, P, cor, oid, falso=None, prof_extra=0.0):
    c = C()
    xx, yy = sx - c.x0, sy - c.y0
    ok = (xx >= 0) & (xx < c.w) & (yy >= 0) & (yy < c.h)
    xx, yy, P, cor = xx[ok], yy[ok], P[ok], np.asarray(cor, float)[ok]
    prof = P @ VISTA + prof_extra
    melhor = prof > c.prof[yy, xx] + 1e-7
    xx, yy, P, cor, prof = xx[melhor], yy[melhor], P[melhor], cor[melhor], prof[melhor]
    c.faces += 1
    c.cor[yy, xx] = cor
    c.prof[yy, xx] = prof
    c.obj[yy, xx] = oid
    c.face[yy, xx] = c.faces
    c.tipo[yy, xx] = c.objs[oid]
    c.nz[yy, xx] = 0.0
    c.nrm[yy, xx] = (0.0, 1.0, 0.0)
    if falso is None:
        c.mundoP[yy, xx] = P
    else:
        c.mundoP[yy, xx] = (falso[0], falso[1], 0.0)


def sombra_parede(n0, dx=1, dy=1, leve=True, sobre=()):
    """
    A sombra que o item faz na parede (a luz vem de cima e da esquerda): o que é do item (objetos >= n0), deslocado
    (dx, dy) px, onde não há nada vira sombra forte (0,32); mais 1 px em volta, a leve (0,14). sobre: objetos que
    recebem a sombra escurecendo a própria cor (a tábua atrás das ferramentas).
    """
    c = C()
    _niveis()
    meu = (c.obj >= n0) & (c.tipo == 3)
    if sobre:
        meu &= ~np.isin(c.obj, list(sobre))

    def mexe(a, dy_, dx_):
        out = np.zeros_like(a)
        h, w = a.shape
        out[max(0, dy_):h + min(0, dy_), max(0, dx_):w + min(0, dx_)] = a[max(0, -dy_):h - max(0, dy_), max(0, -dx_):w - max(0, dx_)]
        return out
    forte = mexe(meu, dy, dx)
    leve_m = np.zeros_like(meu)
    if leve:
        leve_m = mexe(forte, 1, 1) | mexe(forte, 1, 0) | mexe(forte, 0, 1)
    vazio = c.obj < 0
    for m, nv in ((forte & vazio, 2), (leve_m & ~forte & vazio, 1)):
        yy, xx = np.nonzero(m)
        if not len(yy):
            continue
        sx, sy = xx + c.x0, yy + c.y0
        X = (sx + 0.5) / KX
        Z = (X * KY - (sy + 0.5)) / KZ
        P = np.stack([X, np.zeros_like(X), Z], 1)
        o = c.novo_obj(1, contorno=False, sombra=False)
        _escreve(sx, sy, P, np.zeros((len(sx), 3)), o, falso=_NIVEL[nv])
    if sobre:
        alvo = forte & np.isin(c.obj, list(sobre)) & ~meu
        c.cor[alvo] = c.cor[alvo] * 0.72 + np.array([4.0, 0.0, 6.0])


def recorta_vao(n0, x0, x1, z0, z1):
    """O que fica atrás do plano da parede (y < 0) só aparece pelo vão (x0..x1, z0..z1): o resto a parede esconde."""
    c = C()
    P = c.mundoP
    m = (c.obj >= n0) & (P[..., 1] < -1e-4)
    t = -P[..., 1] / VISTA[1]
    X, Z = P[..., 0] + t * VISTA[0], P[..., 2] + t * VISTA[2]
    fora = m & ((X < x0 - 1e-4) | (X > x1 + 1e-4) | (Z < z0 - 1e-4) | (Z > z1 + 1e-4))
    c.obj[fora] = -1
    c.prof[fora] = -1e9
    c.tipo[fora] = 0


def _alarga(dw, dh):
    """Aumenta a tela da cena para a direita e para baixo (a escrita de 8 m não cabe na do exportador)."""
    c = C()
    h, w = c.h + dh, c.w + dw
    for nome, fill in (('cor', 0.0), ('prof', -1e9), ('obj', -1), ('face', -1), ('tipo', 0), ('nz', 0.0), ('mundoP', 0.0), ('nrm', 0.0)):
        a = getattr(c, nome)
        b = np.full((h, w) + a.shape[2:], fill, dtype=a.dtype)
        b[:c.h, :c.w] = a
        setattr(c, nome, b)
    c.w, c.h = w, h


def sprite(P0, linhas, paleta, dx=0, dy=0):
    """Um desenho de pixel de frente para a tela (a chama): linhas de letras, '.' vazio; o ponto P0 vai no (dx, dy)."""
    s = np.floor(tela(np.array([P0]))[0]).astype(int)
    pts, cores = [], []
    for v, ln in enumerate(linhas):
        for i, ch in enumerate(ln):
            if ch != '.':
                pts.append((s[0] + i - dx, s[1] + v - dy))
                cores.append(_c(paleta[ch]))
    if not pts:
        return None
    pts = np.array(pts)
    c = C()
    oid = c.novo_obj(3, contorno=False, sombra=False)
    CZ.luzes.add(oid)
    P = np.tile(np.array(P0, float), (len(pts), 1))
    _escreve(pts[:, 0], pts[:, 1], P, np.array(cores), oid, prof_extra=0.2)
    return oid


# =====================================================================================================================
# peças de volume reaproveitáveis
# =====================================================================================================================
def tubo_x(x0, x1, yc, zc, r, cor, lados=12, oid=None, brilho=True):
    """Um cilindro deitado ao longo de x (o cano, o bastão, a vara do estandarte): faixas de luz em degraus."""
    o = novo() if oid is None else oid
    c0 = _c(cor)
    for k in range(lados):
        a0, a1 = 2 * math.pi * k / lados, 2 * math.pi * (k + 1) / lados
        am = (a0 + a1) / 2
        ny, nz = math.cos(am), math.sin(am)
        d = -0.35 * 0 + 0.55 * ny + 1.0 * nz
        kk = float(np.interp(d, [-1.2, -0.3, 0.2, 0.7, 1.1], [0.62, 0.74, 0.92, 1.08, 1.18]))
        cc = _tom(c0, kk)
        if brilho and 0.75 < d < 1.0:
            cc = _tom(c0, 1.32)
        fp([(x0, yc + r * math.cos(a0), zc + r * math.sin(a0)), (x1, yc + r * math.cos(a0), zc + r * math.sin(a0)),
            (x1, yc + r * math.cos(a1), zc + r * math.sin(a1)), (x0, yc + r * math.cos(a1), zc + r * math.sin(a1))],
           (0, ny, nz), emissivo(lambda L, n, P, cc=cc: BE._cru(np.tile(cc, (len(P), 1)), n)), o)
    tampa = emissivo(lambda L, n, P: BE._cru(np.tile(_tom(c0, 0.86), (len(P), 1)), n))
    for xx, sx in ((x1, 1), (x0, -1)):
        fp([(xx, yc + r * math.cos(2 * math.pi * k / lados), zc + r * math.sin(2 * math.pi * k / lados)) for k in range(lados)],
           (sx, 0, 0), tampa, o)
    return o


def anel_y(xc, zc, rx, rz, y0, y1, cor, lados=28, oid=None):
    """A lateral de uma peça redonda (ou oval) que sai da parede (o aro do relógio, do espelho, do bastidor)."""
    o = novo() if oid is None else oid
    c0 = _c(cor)
    for i in range(lados):
        a0, a1 = 2 * math.pi * i / lados, 2 * math.pi * (i + 1) / lados
        am = (a0 + a1) / 2
        k = 0.8 + 0.35 * max(0.0, math.sin(am)) + 0.1 * math.cos(am)
        cc = np.clip(c0 * k, 0, 255).astype(int)
        fp([(xc + rx * math.cos(a0), y0, zc + rz * math.sin(a0)), (xc + rx * math.cos(a1), y0, zc + rz * math.sin(a1)),
            (xc + rx * math.cos(a1), y1, zc + rz * math.sin(a1)), (xc + rx * math.cos(a0), y1, zc + rz * math.sin(a0))],
           (math.cos(am), 0, math.sin(am)), liso('#%02x%02x%02x' % tuple(cc)), o)
    return o


def moldura(x0, x1, z0, z1, e, fundo, cores, ez=None, oid=None):
    """
    A moldura de quadro que sai da parede: quatro réguas (cima, baixo, os lados) num objeto só. A frente em faixas
    (de fora para dentro: o filete claro, o corpo, o filete escuro que dá a sombra para dentro); o topo claro; os lados
    de dentro (o vão até a tela) mais escuros. cores: (escuro, corpo, claro, brilho).
    """
    ez = e * KX / KZ if ez is None else ez
    esc, corpo, cla, bri = (_c(k) for k in cores)
    o = novo() if oid is None else oid

    def f(L, n, P):
        nn = np.asarray(n, float)
        out = np.tile(corpo, (len(P), 1))
        if nn[1] > 0.5:
            d = np.minimum.reduce([(P[:, 0] - x0) * KX, (x1 - P[:, 0]) * KX, (P[:, 2] - z0) * KZ, (z1 - P[:, 2]) * KZ])
            di = np.minimum.reduce([(P[:, 0] - (x0 + e)) * KX, ((x1 - e) - P[:, 0]) * KX, (P[:, 2] - (z0 + ez)) * KZ, ((z1 - ez) - P[:, 2]) * KZ])
            di = -di
            out = np.where(((d >= 1) & (d < 2))[:, None], cla, out)
            out = np.where(((d >= 1) & (d < 2) & (P[:, 2] > z1 - ez))[:, None], bri, out)
            out = np.where((di < 1)[:, None], esc, out)
            out = np.where(((di >= 1) & (di < 2))[:, None], _tom(corpo, 0.86), out)
        elif nn[2] > 0.5:
            out = np.tile(cla, (len(P), 1))
        else:
            out = np.tile(_tom(corpo, 0.9), (len(P), 1))
        return BE._cru(out, n)
    m = emissivo(f)
    caixa((x0, x1, 0.0, fundo, z1 - ez, z1), m, oid=o)
    caixa((x0, x1, 0.0, fundo, z0, z0 + ez), m, oid=o)
    caixa((x0, x0 + e, 0.0, fundo, z0 + ez, z1 - ez), m, oid=o)
    caixa((x1 - e, x1, 0.0, fundo, z0 + ez, z1 - ez), m, oid=o)
    return o


def prego(x, z, y=0.03):
    _barra((x - PH, x + PH, 0.0, y, z - PZ, z + PZ), '#3a3432', '#7a706a', quina=False)


# =====================================================================================================================
# o relógio e o espelho
# =====================================================================================================================
def relogio(xc=1.5, z=1.9, r=0.23):
    """
    O relógio redondo (o da cozinha, relogio_esq, trazido para a parede de trás): o aro de madeira que sai 7 cm da
    parede, a frente do aro com o filete claro em cima e escuro embaixo, o mostrador creme rebaixado com as quatro
    marcas e os ponteiros (parados: a casa está abandonada).
    """
    n0 = len(C().objs)
    y1 = 0.07
    o = anel_y(xc, z, r, r, 0.0, y1, '#7a4424')
    rm = r - 0.05
    pl = Pl(xc - r - 0.01, xc + r + 0.01, z - r - 0.01, z + r + 0.01, y1)
    du, dw = pl.u - r * KX - 0.01 * KX, pl.w - r * KZ - 0.01 * KZ
    rr = np.hypot(du / KX, dw / KZ)
    lado = (-du / KX * 0.6 - dw / KZ * 0.8) / np.maximum(rr, 1e-6)       # > 0: o lado de cima e da esquerda (a luz)
    aro = pl.dentro & (rr <= r) & (rr >= rm - 0.004)
    pl.pin(aro, '#8a4e2a')
    pl.pin(aro & (rr > r - 0.022) & (lado > 0.2), '#b06a3a')
    pl.pin(aro & (rr > r - 0.022) & (lado <= 0.2), '#6a3a1e')
    pl.pin(aro & (rr < rm + 0.02) & (lado > 0.2), '#5a3018')
    pl.pin(aro & (rr < rm + 0.02) & (lado <= 0.2), '#a8643a')
    pl.contorno(aro)
    gm = pl.grava(luz=True)
    # o mostrador, 1 cm para dentro do aro
    ym = y1 - 0.01
    pm = Pl(xc - rm, xc + rm, z - rm, z + rm, ym)
    cu, cw = rm * KX, rm * KZ
    du, dw = pm.u - cu, pm.w - cw
    rr = np.hypot(du / KX, dw / KZ)
    lado = (-du / KX * 0.6 - dw / KZ * 0.8) / np.maximum(rr, 1e-6)
    mo = pm.dentro & (rr <= rm)
    pm.pin(mo, '#efe6cc')
    pm.pin(mo & (rr > rm - 0.022) & (lado > 0.3), '#cfc2a2')          # a sombra do aro no mostrador
    for h in range(12):
        a = 2 * math.pi * h / 12
        pu, pw = cu + math.sin(a) * (rm - 0.03) * KX, cw - math.cos(a) * (rm - 0.03) * KZ
        if h % 3 == 0:
            pm.pin(pm.seg((pu, pw), (cu + math.sin(a) * (rm - 0.055) * KX, cw - math.cos(a) * (rm - 0.055) * KZ), 1.0), '#3a2a22')
    pm.pin(pm.seg((cu, cw), (cu + math.sin(2 * math.pi * 4 / 12) * rm * 0.5 * KX, cw - math.cos(2 * math.pi * 4 / 12) * rm * 0.5 * KZ), 1.2), '#2a1e1a')
    pm.pin(pm.seg((cu, cw), (cu + math.sin(2 * math.pi * 11.4 / 12) * rm * 0.78 * KX, cw - math.cos(2 * math.pi * 11.4 / 12) * rm * 0.78 * KZ), 1.0), '#2a1e1a')
    pm.pin(pm.elipse(cu, cw, 1.0, 1.0), '#8a2a20')
    pm.grava()
    sombra_parede(n0, 1, 2)


def espelho(xc=1.5, z=1.6, rx=0.31, rz=0.37, quebrado=False):
    """
    O espelho oval de banheiro e de quarto: a moldura de madeira escura com o filete de latão por dentro, que sai 5 cm
    da parede; o vidro azulado com dois reflexos em diagonal e as manchas da prata gasta na beira (é casa velha).
    """
    n0 = len(C().objs)
    y1 = 0.05
    anel_y(xc, z, rx, rz, 0.0, y1, '#5a2e1a')
    pl = Pl(xc - rx - 0.01, xc + rx + 0.01, z - rz - 0.01, z + rz + 0.01, y1)
    cu, cw = (rx + 0.01) * KX, (rz + 0.01) * KZ
    du, dw = (pl.u - cu) / (rx * KX), (pl.w - cw) / (rz * KZ)
    rr = np.hypot(du, dw)
    lado = (-du * 0.6 - dw * 0.8) / np.maximum(rr, 1e-6)
    e = 0.055 / rx
    tudo = pl.dentro & (rr <= 1.0)
    pl.pin(tudo, '#6a361e')
    pl.pin(tudo & (rr > 1 - 0.3 * e) & (lado > 0.1), '#9a5a32')
    pl.pin(tudo & (rr > 1 - 0.3 * e) & (lado <= -0.4), '#4a2414')
    pl.pin(tudo & (rr < 1 - e + 0.35 * e) & (rr >= 1 - e), '#c8a04a')            # o filete de latão
    pl.pin(tudo & (rr < 1 - e + 0.35 * e) & (rr >= 1 - e) & (lado < -0.2), '#8a6a2a')
    vidro = tudo & (rr < 1 - e)
    pl.pin(vidro, '#a9c2c4')
    # o reflexo: duas faixas em diagonal (uma larga, uma fina), o escuro embaixo à direita
    dd = pl.u * 0.9 + pl.w * 0.55
    d0 = (cu * 0.9 + cw * 0.55)
    pl.pin(vidro & (dd > d0 + 6), '#90aeb2')
    pl.pin(vidro & (dd > d0 - 9) & (dd < d0 - 5), '#d4e6e4')
    pl.pin(vidro & (dd > d0 - 2) & (dd < d0 - 0.5), '#c4dad8')
    pl.pin(vidro & (rr > 1 - e - 0.08) & (lado > 0.3), '#7e989a')                 # a sombra da moldura no vidro
    # a prata gasta: manchas escuras de 2 px na beira de baixo
    for (a, s) in ((2.2, 1.6), (2.9, 1.2), (4.3, 1.4), (0.6, 1.1)):
        mu, mw_ = cu + math.cos(a) * (rx - 0.075) * KX, cw + math.sin(a) * (rz - 0.075) * KZ
        pl.pin(vidro & pl.elipse(mu, mw_, s, s * 0.8), '#6e7e78')
    if quebrado:
        pl.pin(vidro & pl.linha([(cu - 4, cw - 10), (cu - 1, cw - 3), (cu + 3, cw + 1), (cu + 2, cw + 8)], 1.0), '#e8f2f0')
    pl.contorno(tudo)
    pl.grava()
    # o enfeite de cima: uma volutinha entalhada (a madeira saindo um pouco mais)
    caixa((xc - 0.06, xc + 0.06, 0.0, y1 + 0.01, z + rz - 0.02, z + rz + 0.035), mad2('#6a361e', seed=4), ch=0.01)
    sombra_parede(n0, 1, 2)


# =====================================================================================================================
# os quadros da fazenda (doze pinturas: uma por modelo do jogo, quadro_fazenda~NN)
# =====================================================================================================================
MOL_ESCURA = ('#341a0e', '#6a3a1e', '#9a5a30', '#c07a44')
MOL_DOURADA = ('#4a3216', '#9a7028', '#e2c058', '#f6e090')
MOL_CLARA = ('#5a3a1e', '#a87a48', '#d0a46a', '#e8c08a')
MOL_PRETA = ('#141010', '#2e2624', '#4a403c', '#6a5e58')


def _spr(pl, u0, w0, linhas, paleta, so=None):
    """Um desenho de letras na grade da pintura, com o canto em (u0, w0) px."""
    U, V = np.floor(pl.u + 1e-6).astype(int), np.floor(pl.w + 1e-6).astype(int)
    for v, ln in enumerate(linhas):
        for i, ch in enumerate(ln):
            if ch in paleta:
                m = (U == u0 + i) & (V == w0 + v)
                if so is not None:
                    m &= so
                pl.pin(m, paleta[ch])


def _faixas(pl, m, cortes, cores):
    """Faixas horizontais (o céu): cores[k] até o corte k (em w)."""
    for k, cor in enumerate(cores):
        lo = cortes[k - 1] if k else -1e9
        hi = cortes[k] if k < len(cortes) else 1e9
        pl.pin(m & (pl.w >= lo) & (pl.w < hi), cor)


def _onda(u, amp, per, fase):
    return amp * np.sin(u / per + fase)


def quadro(x0, x1, z0, z1, pintor, cores=MOL_ESCURA, e=0.05, fundo=0.045):
    """O quadro retangular: a moldura que sai da parede e a pintura rebaixada (com a sombra da moldura em cima e à esquerda)."""
    n0 = len(C().objs)
    ez = e * KX / KZ
    pl = Pl(x0 + e - PH, x1 - e + PH, z0 + ez - PZ, z1 - ez + PZ, 0.015)
    W, H = (x1 - x0 - 2 * e) * KX, (z1 - z0 - 2 * ez) * KZ
    pl.u, pl.w = pl.u - 1, pl.w - 1
    pintor(pl, W, H)
    m = pl.opaco()
    pl.rgb[m & (pl.w < 1)] = _tom(pl.rgb[m & (pl.w < 1)], 0.72)
    pl.rgb[m & (pl.u < 1)] = _tom(pl.rgb[m & (pl.u < 1)], 0.8)
    pl.grava()
    moldura(x0, x1, z0, z1, e, fundo, cores)
    sombra_parede(n0, 1, 2)


def quadro_oval(xc, zc, rx, rz, pintor, cor='#5a2e1a', filete='#c8a04a', e=0.05, fundo=0.04):
    """O quadro oval (o retrato, o bastidor): o aro que sai da parede, a frente com o filete e a pintura dentro."""
    n0 = len(C().objs)
    anel_y(xc, zc, rx, rz, 0.0, fundo, cor)
    pl = Pl(xc - rx - 0.01, xc + rx + 0.01, zc - rz - 0.01, zc + rz + 0.01, fundo)
    cu, cw = (rx + 0.01) * KX, (rz + 0.01) * KZ
    du, dw = (pl.u - cu) / (rx * KX), (pl.w - cw) / (rz * KZ)
    rr = np.hypot(du, dw)
    lado = (-du * 0.6 - dw * 0.8) / np.maximum(rr, 1e-6)
    k = e / rx
    tudo = pl.dentro & (rr <= 1.0)
    dentro = tudo & (rr < 1 - k)
    # a pintura numa grade própria (u, w a partir do canto de dentro)
    u_, w_ = pl.u.copy(), pl.w.copy()
    pl.u, pl.w = pl.u - (cu - (rx - e) * KX), pl.w - (cw - (rz - e) * KZ)
    pintor(pl, 2 * (rx - e) * KX, 2 * (rz - e) * KZ)
    pl.u, pl.w = u_, w_
    pl.nv[~tudo] = 0
    sel = dentro & (rr > 1 - k - 0.06) & (lado > 0.25)
    pl.rgb[sel] = _tom(pl.rgb[sel], 0.74)
    corpo = _c(cor)
    pl.pin(tudo & ~dentro, corpo)
    pl.pin(tudo & ~dentro & (rr > 1 - 0.35 * k) & (lado > 0.1), _tom(corpo, 1.35))
    pl.pin(tudo & ~dentro & (rr > 1 - 0.35 * k) & (lado <= -0.4), _tom(corpo, 0.7))
    if filete:
        fil = tudo & ~dentro & (rr < 1 - k + 0.3 * k)
        pl.pin(fil, filete)
        pl.pin(fil & (lado < -0.2), _tom(_c(filete), 0.72))
    pl.contorno(tudo)
    pl.grava()
    sombra_parede(n0, 1, 2)
    return pl


# ---------- as pinturas (cada uma recebe o plano e o tamanho W x H em px; u para a direita, w para baixo) ----------
def p_pasto(pl, W, H):
    """O pasto ao entardecer (o do hall): o céu em faixas, o sol baixo, os morros, o pasto, a árvore e a cerca."""
    t = pl.dentro
    hz = H * 0.46
    _faixas(pl, t, [hz * 0.3, hz * 0.6, hz * 0.85], ['#6e6a86', '#a8786e', '#d8925a', '#eeb46c'])
    pl.pin(pl.elipse(W * 0.66, hz, 3.2, 2.6) & (pl.w < hz), '#fbe2a0')
    morro = t & (pl.w >= hz - 1.5 + _onda(pl.u, 1.6, 4.0, 1.0))
    pl.pin(morro, '#6a7458')
    pasto = t & (pl.w >= hz + 2 + _onda(pl.u, 0.8, 6.0, 0.3))
    pl.pin(pasto, '#7a9442')
    pl.pin(pasto & (pl.w >= H * 0.72), '#66803a')
    for (a, b) in ((3, hz + 5), (12, hz + 4), (20, hz + 7), (6, H * 0.8), (17, H * 0.86)):
        pl.pin(pl.ret(a, b, a + 3, b + 1), '#8ea84e')
    # a árvore à esquerda (a copa redonda, o tronco)
    pl.pin(pl.ret(5, hz - 2, 6.5, hz + 4), '#3a2a1e')
    pl.pin(pl.elipse(5.5, hz - 4.5, 3.6, 3.0), '#3e5030')
    pl.pin(pl.elipse(4.6, hz - 5.6, 2.0, 1.6), '#52683c')
    # a cerca na frente (os mourões e as duas tábuas)
    for a in (2, 9, 16, 23):
        pl.pin(pl.ret(a, H - 7, a + 1.5, H - 1), '#5a3a22')
    pl.pin(pl.ret(0, H - 6, W, H - 5), '#7a5434')
    pl.pin(pl.ret(0, H - 3.5, W, H - 2.5), '#7a5434')


def p_familia(pl, W, H):
    """A família em sépia (o retrato oval): o fundo de estúdio, o pai e a mãe atrás, as duas crianças na frente."""
    t = pl.dentro
    cu = W / 2
    pl.pin(t, '#b4966c')
    pl.pin(t & (pl.w < H * 0.3), '#c2a67c')
    pl.pin(t & (np.hypot((pl.u - cu) / W, (pl.w - H / 2) / H) > 0.38), '#8a6c4c')
    S = {'p': '#2e2018', 'P': '#44322a', 'r': '#ecd4a8', 'R': '#d4b688', 'c': '#2a1e16', 'v': '#5a4030', 'V': '#6e5240',
         'b': '#f0e0bc', 'B': '#d8c49c'}
    fam = [
        "..ccc.....ccc..",
        ".ccccc...ccccc.",
        ".crrrc...crrrrc",
        ".rrrrr...crrrrc",
        ".rrrrr...crrrrc",
        ".rrrrr...crrrrc",
        "..rRr.....rrr..",
        "...r.......r...",
        ".ppbpp...vvBvv.",
        "pppbbpp.vvvbvvv",
        "ppPbPpp.vVvvvVv",
        "ppPpPpp.vvvvvvv",
        "ppppppp.vVvvvVv",
        "ppPpPpp.vvvvvvv",
    ]
    _spr(pl, int(cu - 7.5), int(H * 0.22), fam, S)


def p_gravura(pl, W, H):
    """A gravura em preto e branco do casarão, com o passe-partout creme largo."""
    t = pl.dentro
    pl.pin(t, '#e6dcc4')
    pl.pin(t & ((pl.u < 1) | (pl.w < 1)), '#cfc4aa')
    a0, b0, a1, b1 = 5, 4, W - 5, H - 4
    pin = pl.ret(a0, b0, a1, b1)
    pl.pin(pin, '#d6d2c4')
    pl.pin(pl.ret(a0 - 1, b0 - 1, a1 + 1, b0) | pl.ret(a0 - 1, b0, a0, b1 + 1), '#b8ae96')
    hz = b0 + (b1 - b0) * 0.62
    pl.pin(pin & (pl.w >= hz), '#a6a498')
    pl.pin(pin & (pl.w >= hz) & ((np.floor(pl.w) % 2) == 0) & (pl.u < a0 + 6), '#8e8c82')
    # a casa: o telhado, a parede branca, as janelas, a varanda
    cx = (a0 + a1) / 2
    pl.pin(pl.poli([(cx - 7, hz - 4), (cx - 4, hz - 7.5), (cx + 4, hz - 7.5), (cx + 7, hz - 4)]), '#4e4e4c')
    pl.pin(pl.ret(cx - 6, hz - 4, cx + 6, hz + 1), '#f2eee4')
    for k in (-4.5, 2.5):
        pl.pin(pl.ret(cx + k, hz - 2.5, cx + k + 1.5, hz - 1.5), '#5a5a58')
    pl.pin(pl.ret(cx - 1, hz - 2.5, cx + 1, hz + 1), '#3a3a38')
    # as árvores dos dois lados
    pl.pin(pl.elipse(a0 + 2.5, hz - 3, 2.6, 3.4), '#545450')
    pl.pin(pl.elipse(a1 - 2.5, hz - 2.5, 2.4, 3.0), '#5e5e5a')
    pl.pin(pl.ret(a0 + 2, hz - 1, a0 + 3, hz + 1), '#3a3a38')


def p_cavalo(pl, W, H):
    """O cavalo baio no pasto: o céu claro, os morros, a cerca branca atrás e o cavalo de perfil."""
    t = pl.dentro
    hz = H * 0.5
    _faixas(pl, t, [hz * 0.5, hz * 0.85], ['#8eaabc', '#a8bec4', '#c8d0c0'])
    pl.pin(t & (pl.w >= hz - 2 + _onda(pl.u, 1.4, 5.0, 0.5)), '#6e8456')
    pl.pin(t & (pl.w >= hz + 1), '#7e9a4a')
    pl.pin(t & (pl.w >= H * 0.8), '#6a8640')
    pl.pin(pl.ret(0, hz + 1, W, hz + 2), '#e4e0d4')
    pl.pin(pl.ret(0, hz + 3.5, W, hz + 4.5), '#d4d0c4')
    for a in range(1, int(W), 6):
        pl.pin(pl.ret(a, hz, a + 1, hz + 6), '#e4e0d4')
    S = {'b': '#8a4a26', 'B': '#a8622e', 'd': '#6a361c', 'm': '#2a1810', 'h': '#8a4a26', 'n': '#3a2014', 'k': '#2a1810'}
    cav = [
        "...............mm..",
        "..............mhhh.",
        ".............mmhBhh",
        "............mmhh.nh",
        "...........mmhh....",
        ".mbbbbbbbbbbbbh....",
        "mmBBBBBBBBBBbbb....",
        "m.bbbbbbbbbbbbb....",
        "m.bdbbbbbbbbbdb....",
        "m..d.d.....d.d.....",
        "...d..d....d..d....",
        "...k..k....k..k....",
    ]
    _spr(pl, int(W / 2 - 10), int(H - 14), cav, S)


def p_bordado(pl, W, H):
    """O bordado no bastidor: o linho creme e as flores em ponto cheio (lavanda, margarida, papoula)."""
    t = pl.dentro
    pl.pin(t, '#e8dcbe')
    pl.pin(t & ((np.floor(pl.u) + np.floor(pl.w)) % 6 == 0) & (np.floor(pl.w) % 3 == 0), '#ddd0b0')
    cu, b = W / 2, H - 4
    for (a, top) in ((-4, 5), (-1, 3), (3, 6), (5, 9), (-6, 9)):
        pl.pin(pl.seg((cu, b), (cu + a, top + 3), 1.0), '#5a7a3a')
    for (a, top) in ((-6, 9), (-4, 5)):
        for k in range(4):
            pl.pin(pl.ret(cu + a - 0.5 - (k % 2) * 0.5, top + k * 1.6 - 1, cu + a + 1, top + k * 1.6 + 0.6), '#8a6aaa')
    for (a, top) in ((-1, 3), (5, 9)):
        pl.pin(pl.elipse(cu + a + 0.4, top + 2.4, 2.6, 2.2), '#f6f2e6')
        pl.pin(pl.elipse(cu + a + 0.4, top + 2.4, 1.0, 1.0), '#e0a83a')
    pl.pin(pl.elipse(cu + 3.4, 8.2, 2.4, 2.0), '#c04434')
    pl.pin(pl.elipse(cu + 3.0, 7.6, 1.0, 0.8), '#e06a4a')
    pl.pin(pl.elipse(cu + 3.6, 9.0, 0.8, 0.8), '#3a2420')
    pl.pin(pl.seg((cu - 3, b + 1), (cu + 3, b + 1), 1.0), '#5a7a3a')


def p_galo(pl, W, H):
    """O galo no mourão ao pôr do sol: o céu laranja, o celeiro à esquerda e o galo de peito vermelho."""
    t = pl.dentro
    hz = H * 0.62
    _faixas(pl, t, [H * 0.18, H * 0.36, H * 0.52], ['#7a6478', '#c27a5a', '#e89a50', '#f4c06a'])
    pl.pin(t & (pl.w >= hz), '#6e7a40')
    pl.pin(t & (pl.w >= H * 0.82), '#5e6a36')
    pl.pin(pl.ret(0, H * 0.24, 7, hz + 1), '#7a3e2a')
    pl.pin(pl.poli([(-1, H * 0.25), (3.5, H * 0.1), (8, H * 0.25)]), '#4a2a1e')
    pl.pin(pl.ret(2, hz - 5, 5, hz - 1), '#3a201a')
    pl.pin(pl.ret(0, hz + 2, W, hz + 3), '#6a4a30')
    S = {'r': '#d43a22', 'R': '#a82a1a', 'b': '#a84a24', 'B': '#c8642e', 'o': '#e8a030', 'k': '#1e3a32', 'K': '#2e5244',
         'p': '#e0a032', 'w': '#f4e4b0'}
    galo = [
        "..........rr..",
        ".........rrr..",
        "........BBBBo.",
        "........BwBB..",
        "kk.....bBBBR..",
        "kKk....bbbRR..",
        "kKkk..bbbbb...",
        ".kKkkbbBbbb...",
        "..kkbbbBBbb...",
        "...kbbbbbb....",
        ".....bbbb.....",
        "......p.p.....",
        ".....pp.pp....",
    ]
    _spr(pl, int(W / 2 - 6), int(hz - 9), galo, S)
    pl.pin(pl.ret(W / 2 - 3, hz + 4, W / 2 + 4, hz + 5), '#5a3a22')


def p_milharal(pl, W, H):
    """O milharal com o espantalho (o quadro baixo e largo): o céu do fim de tarde e as fileiras de milho."""
    t = pl.dentro
    hz = H * 0.42
    _faixas(pl, t, [hz * 0.4, hz * 0.75], ['#8a7a8a', '#d6905a', '#f0bc6a'])
    pl.pin(pl.elipse(W * 0.25, hz, 2.6, 2.2) & (pl.w < hz), '#fbe0a0')
    pl.pin(t & (pl.w >= hz - 1), '#8a8a3a')
    U = np.floor(pl.u)
    pe = t & (pl.w >= hz)
    pl.pin(pe & (U % 3 == 0), '#6a7428')
    pl.pin(pe & (U % 3 == 1) & (pl.w >= hz + 2), '#a8a44a')
    pl.pin(pe & (pl.w >= H - 4) & (U % 3 != 2), '#5a6224')
    pl.pin(t & (pl.w >= hz - 2) & (pl.w < hz - 0.5) & (U % 3 == 0), '#d8b84a')
    cx = W * 0.62
    pl.pin(pl.ret(cx, hz - 5, cx + 1, H - 1), '#3a2a1e')
    pl.pin(pl.ret(cx - 4, hz - 3, cx + 5, hz - 2), '#3a2a1e')
    pl.pin(pl.ret(cx - 1.5, hz - 3, cx + 2.5, hz + 2), '#5a4a6a')
    pl.pin(pl.elipse(cx + 0.5, hz - 5, 1.5, 1.4), '#d8c08a')
    pl.pin(pl.ret(cx - 2, hz - 7.5, cx + 3, hz - 6.5), '#4a3a22')
    pl.pin(pl.ret(cx - 1, hz - 9, cx + 2, hz - 7), '#4a3a22')


def p_mapa(pl, W, H):
    """O mapa da fazenda a pena: o papel amarelado, as roças, o rio, a estrada tracejada, a casa e a rosa dos ventos."""
    t = pl.dentro
    pl.pin(t, '#dccaa0')
    pl.pin(t & ((pl.u < 2) | (pl.w < 2) | (pl.u > W - 2) | (pl.w > H - 2)), '#c4ac7c')
    for (a, b, c_, d, cor) in ((4, 4, 11, 9, '#a4ac6a'), (13, 3, 20, 8, '#b4b478'), (5, 12, 12, 17, '#b4b478'),
                               (22, 12, 28, 18, '#a4ac6a'), (15, 14, 20, 19, '#c0a870')):
        pl.pin(pl.ret(a, b, c_, d), cor)
        pl.pin(pl.ret(a, b, c_, d) & ((np.floor(pl.u) - a) % 3 == 0), _tom(_c(cor), 0.9))
    pl.pin(pl.linha([(W * 0.75, 0), (W * 0.62, H * 0.3), (W * 0.7, H * 0.55), (W * 0.5, H * 0.8), (W * 0.42, H)], 2.0), '#5a7a8e')
    est = pl.linha([(0, H * 0.45), (W * 0.3, H * 0.5), (W * 0.55, H * 0.4), (W, H * 0.35)], 1.0)
    pl.pin(est & ((np.floor(pl.u) % 4) < 2), '#7a5434')
    pl.pin(pl.ret(W * 0.3 - 1, H * 0.5 - 4, W * 0.3 + 2, H * 0.5 - 1), '#8a3a2a')
    cx, cw = W - 5, 5
    pl.pin(pl.seg((cx, cw - 3), (cx, cw + 3), 1.0) | pl.seg((cx - 3, cw), (cx + 3, cw), 1.0), '#4a3a2a')
    pl.pin(pl.seg((cx, cw - 3), (cx, cw - 1), 1.0), '#9a2a1e')


def p_renda(pl, W, H):
    """O fundo de veludo vinho com a renda branca em volta (a cruz de madeira vai por cima, em volume)."""
    t = pl.dentro
    pl.pin(t, '#5a2a26')
    cu, cw = W / 2, H / 2
    du, dw = (pl.u - cu) / (W * 0.42), (pl.w - cw) / (H * 0.44)
    rr = np.hypot(du, dw)
    ang = np.arctan2(dw, du)
    borda = 1.0 + 0.07 * np.cos(ang * 12)
    renda = t & (rr <= borda)
    pl.pin(renda, '#eee6d2')
    fur = renda & (rr > 0.55) & (rr < 0.85) & (np.cos(ang * 12) > 0.4)
    pl.pin(fur, '#c8b898')
    pl.pin(renda & (rr > 0.4) & (rr < 0.48), '#d8ccb0')
    pl.pin(renda & (rr > borda - 0.1), '#dcd0b4')


def p_rio(pl, W, H):
    """O rio na neblina: os morros que somem no branco, a faixa de névoa, as árvores escuras das margens e a ponte de pedra."""
    t = pl.dentro
    pl.pin(t, '#cdd0c6')
    pl.pin(t & (pl.w >= H * 0.22 + _onda(pl.u, 1.5, 4.5, 0.4)), '#b0b6ae')
    pl.pin(t & (pl.w >= H * 0.34 + _onda(pl.u, 1.3, 3.5, 2.0)), '#949e96')
    pl.pin(t & (pl.w >= H * 0.44) & (pl.w < H * 0.5), '#d6d8d0')
    pl.pin(t & (pl.w >= H * 0.5), '#5a6a58')
    pl.pin(t & (pl.w >= H * 0.5) & (pl.w < H * 0.5 + 3 + _onda(pl.u, 1.0, 2.0, 0.0)), '#465444')
    rio = pl.poli([(W * 0.45, H * 0.5), (W * 0.55, H * 0.5), (W * 0.74, H), (W * 0.26, H)])
    pl.pin(rio, '#8a9ca4')
    pl.pin(rio & (np.abs(pl.u - (W * 0.5 + (pl.w - H * 0.5) * 0.12)) < 0.8), '#b8c8cc')
    for (a, b, r) in ((W * 0.12, H * 0.56, 3.2), (W * 0.28, H * 0.62, 2.6), (W * 0.82, H * 0.58, 3.4), (W * 0.95, H * 0.7, 2.8)):
        pl.pin(pl.elipse(a, b, r, r * 1.3), '#34402e')
        pl.pin(pl.elipse(a - 0.8, b - 1.2, r * 0.5, r * 0.5), '#4a5a40')
    br = W * 0.5
    ponte = pl.ret(br - 6, H * 0.66, br + 6, H * 0.66 + 3) & ~pl.elipse(br, H * 0.66 + 3.6, 3.5, 2.6)
    pl.pin(ponte, '#4e4a46')
    pl.pin(ponte & (pl.w < H * 0.66 + 1), '#7a7670')


def p_crianca(pl, W, H):
    """O desenho de criança de giz de cera: o sol de raios, a casa vermelha, a família de palitinho e a grama."""
    t = pl.dentro
    pl.pin(t, '#f2eee2')
    pl.pin(pl.elipse(5, 5, 2.6, 2.4), '#f0c020')
    for a in range(8):
        an = a * math.pi / 4
        pl.pin(pl.seg((5 + math.cos(an) * 3.6, 5 + math.sin(an) * 3.3), (5 + math.cos(an) * 5.0, 5 + math.sin(an) * 4.6), 1.0), '#e8a818')
    pl.pin(pl.ret(0, H - 3, W, H), '#4aa040')
    pl.pin(pl.ret(0, H - 3, W, H - 2) & (np.floor(pl.u) % 2 == 0), '#6ac050')
    hx0 = W * 0.45
    casa = pl.ret(hx0, H - 11, hx0 + 9, H - 3)
    pl.pin(pl.borda(casa), '#c83a2a')
    teto = pl.poli([(hx0 - 1, H - 10.5), (hx0 + 4.5, H - 16), (hx0 + 10, H - 10.5)])
    pl.pin(pl.borda(teto), '#8a4a2a')
    pl.pin(pl.ret(hx0 + 3.5, H - 7, hx0 + 5.5, H - 3), '#5a3a8a')
    pl.pin(pl.ret(hx0 + 6, H - 9, hx0 + 8, H - 7), '#3a8ad0')
    for (a, cor, alto) in ((3, '#2a5ab0', 8), (7, '#c83a8a', 7), (W - 6, '#e07a1a', 5)):
        b = H - 3
        pl.pin(pl.elipse(a, b - alto, 1.3, 1.2), cor)
        pl.pin(pl.seg((a, b - alto + 1), (a, b - 2), 1.0), cor)
        pl.pin(pl.seg((a - 2, b - alto + 3), (a + 2, b - alto + 3), 1.0), cor)
        pl.pin(pl.seg((a, b - 2), (a - 1.5, b), 1.0) | pl.seg((a, b - 2), (a + 1.5, b), 1.0), cor)
    pl.pin(pl.linha([(13, 2), (17, 3), (21, 2), (25, 3)], 1.0), '#7aa8e0')


def _cruz(xc, zc, fundo=0.045):
    """A cruz de madeira em volume na frente da renda."""
    m = mad2('#5a2e1a', seed=11, passo=0.05)
    caixa((xc - 0.022, xc + 0.022, fundo * 0.3, fundo, zc - 0.17, zc + 0.15), m, ch=0.006)
    caixa((xc - 0.09, xc + 0.09, fundo * 0.3, fundo, zc + 0.04, zc + 0.085), m, ch=0.006)


QUADROS = {
    # modelo: (pintura, largura, altura em m, moldura); 'nm' / 'oval' / 'bastidor' / 'cruz' são os de outro feitio
    'quadro_fazenda': (p_pasto, 0.84, 0.58, MOL_ESCURA),
    'quadro_fazenda~02': ('nm', 0.84, 0.58, None),
    'quadro_fazenda~03': ('oval', 0.27, 0.34, p_familia),
    'quadro_fazenda~04': (p_gravura, 0.84, 0.6, MOL_PRETA),
    'quadro_fazenda~05': (p_cavalo, 0.84, 0.58, MOL_ESCURA),
    'quadro_fazenda~06': ('bastidor', 0.24, 0.26, p_bordado),
    'quadro_fazenda~07': (p_galo, 0.84, 0.58, MOL_CLARA),
    'quadro_fazenda~08': (p_milharal, 0.94, 0.44, MOL_ESCURA),
    'quadro_fazenda~09': (p_mapa, 0.84, 0.6, MOL_CLARA),
    'quadro_fazenda~10': ('cruz', 0.66, 0.62, p_renda),
    'quadro_fazenda~11': (p_rio, 0.84, 0.58, MOL_DOURADA),
    'quadro_fazenda~12': (p_crianca, 0.8, 0.56, MOL_CLARA),
}


def quadro_fazenda(modelo='quadro_fazenda', xc=1.5, zc=1.6):
    pint, a, b, extra = QUADROS[modelo]
    if pint == 'nm':
        n0 = len(C().objs)
        CZ.natureza_morta(xc - a / 2, xc + a / 2, zc - b / 2, zc + b / 2)
        sombra_parede(n0, 1, 2)
    elif pint == 'oval':
        quadro_oval(xc, zc, a, b, extra)
    elif pint == 'bastidor':
        quadro_oval(xc, zc, a, b, extra, cor='#b88a52', filete=None, e=0.03, fundo=0.025)
        # o parafuso de latão do bastidor, em cima
        caixa((xc - 0.025, xc + 0.025, 0.0, 0.04, zc + b - 0.01, zc + b + 0.04), liso('#b8862e'))
        caixa((xc - 0.01, xc + 0.01, 0.0, 0.05, zc + b + 0.04, zc + b + 0.075), liso('#d8a848'))
    elif pint == 'cruz':
        quadro(xc - a / 2, xc + a / 2, zc - b / 2, zc + b / 2, extra, MOL_ESCURA)
        _cruz(xc, zc)
    else:
        quadro(xc - a / 2, xc + a / 2, zc - b / 2, zc + b / 2, pint, extra)


# =====================================================================================================================
# a prateleira de parede (manuais, o rádio e o telefone velho)
# =====================================================================================================================
def telefone(x0, y0, z):
    """O telefone de mesa de baquelite preta: a base com a frente inclinada, o disco de discar e o fone deitado em cima."""
    w, d, h = 0.17, 0.14, 0.075
    caixa((x0, x0 + w, y0, y0 + d, z, z + h), {'cima': liso('#3a3432'), '*': liso('#24201e')}, ch=0.012)
    # o disco (pintado na frente) e o gancho
    pl = Pl(x0 + 0.03, x0 + w - 0.03, z + 0.008, z + h - 0.008, y0 + d + 0.001)
    cu, cw = pl.W / 2 - 0.5, (h - 0.016) * KZ / 2
    disco = pl.elipse(cu, cw, 2.6, 1.9)
    pl.pin(disco, '#c8c2b4')
    pl.pin(disco & pl.elipse(cu, cw, 1.0, 0.8), '#5a5250')
    pl.pin(disco & (pl.w < cw - 0.6) & (pl.u < cu), '#e8e2d4')
    pl.grava()
    for xx in (x0 + 0.025, x0 + w - 0.045):
        caixa((xx, xx + 0.02, y0 + 0.04, y0 + 0.09, z + h, z + h + 0.025), liso('#2a2624'))
    # o fone: a haste e as duas conchas
    tubo_x(x0 - 0.005, x0 + w + 0.005, y0 + 0.065, z + h + 0.045, 0.016, '#2e2a28', lados=8)
    for xx in (x0 - 0.02, x0 + w - 0.035):
        caixa((xx, xx + 0.055, y0 + 0.035, y0 + 0.095, z + h + 0.025, z + h + 0.06), {'cima': liso('#4a4442'), '*': liso('#2a2624')}, ch=0.01)
    CZ.itens_peq.append((x0, x0 + w, y0, y0 + d, z))


def prateleira_parede(xc=1.5, zc=1.6):
    """
    A prateleira de parede (Sala de Tecnologia da Sede e a cozinha): a tábua grossa em duas mãos-francesas (as da
    prateleira da cozinha), os manuais em pé e um deitado, o rádio de válvula (CZ.radio) e o telefone preto.
    """
    n0 = len(C().objs)
    larg, fundo = 0.96, 0.24
    x0, x1 = xc - larg / 2, xc + larg / 2
    zb = zc - 0.08
    caixa((x0, x1, 0.0, fundo, zb, zb + 0.035), {'cima': tab2(['#b07440', '#a86e3c'], 0.12, '#5a2c16', eixo=0, seed=71),
                                                  '*': mad2('#8a5230', seed=72, passo=0.03)})
    for xx in (x0 + 0.1, x1 - 0.13):
        o = novo()
        fp([(xx, 0.0, zb), (xx, fundo - 0.04, zb), (xx, 0.0, zb - 0.16)], (-1, 0, 0), liso('#7a4628'), o)
        fp([(xx + 0.03, 0.0, zb), (xx + 0.03, fundo - 0.04, zb), (xx + 0.03, 0.0, zb - 0.16)], (1, 0, 0), liso('#6a3c22'), o)
        fp([(xx, fundo - 0.04, zb), (xx + 0.03, fundo - 0.04, zb), (xx + 0.03, 0.0, zb - 0.16), (xx, 0.0, zb - 0.16)], (0, 0.97, -0.25), liso('#8a5230'), o)
    z = zb + 0.035
    xa = CA._fileira(x0 + 0.03, x0 + 0.33, 0.03, fundo - 0.03, z, 0.24, 5, 5)
    CA._livro_deitado(xa + 0.01, xa + 0.06, 0.04, fundo - 0.04, z, z + 0.035, '#3e5266')
    CZ.radio(xc - 0.1, xc + 0.18, 0.04, fundo - 0.02, z)
    telefone(x1 - 0.22, 0.05, z)
    sombra_parede(n0, 1, 2)


# =====================================================================================================================
# as luzes de parede: a arandela de velas, a luminária de gaiola e a tocha (0 aceso, '1' apagado)
# =====================================================================================================================
LATAO_E, LATAO, LATAO_L = '#7a5420', '#b0843a', '#e0b860'
FERRO, FERRO_L = '#2e2a28', '#5a524c'

CHAMA_TOCHA = [
    "....a....",
    "....aa...",
    "...aba...",
    "...abaa..",
    "..abba...",
    "..abbba..",
    ".abbcba..",
    ".abccbba.",
    "abbccbba.",
    "abccdcba.",
    "abccdcbba",
    "abcddcba.",
    ".abccba..",
    "..abba...",
]
CHAMA_VELA = [
    ".a.",
    ".a.",
    "aba",
    "acb",
    "bdb",
    ".c.",
]
FOGO_PAL = {'a': '#d8501e', 'b': '#f08a28', 'c': '#ffc850', 'd': '#fff4c0'}


def arandela(xc=1.5, zc=1.6, acesa=True):
    """A arandela de latão: o espelho oval na parede, o braço que sai e abre em dois, os copinhos, os pratos e as velas."""
    n0 = len(C().objs)
    anel_y(xc, zc - 0.02, 0.06, 0.13, 0.0, 0.018, LATAO_E, lados=20)
    pl = Pl(xc - 0.07, xc + 0.07, zc - 0.16, zc + 0.12, 0.018)
    du, dw = (pl.u - 0.07 * KX) / (0.06 * KX), (pl.w - 0.14 * KZ) / (0.13 * KZ)
    rr = np.hypot(du, dw)
    oval = pl.dentro & (rr <= 1)
    pl.pin(oval, LATAO)
    pl.pin(oval & (rr > 0.62) & (du + dw < 0), LATAO_L)
    pl.pin(oval & (rr > 0.62) & (du + dw > 0.6), LATAO_E)
    pl.pin(oval & (rr < 0.3), LATAO_E)
    pl.contorno(oval)
    pl.grava()
    zb = zc - 0.09
    _barra((xc - 0.012, xc + 0.012, 0.015, 0.13, zb, zb + 0.022), LATAO, LATAO_L)
    _barra((xc - 0.13, xc + 0.13, 0.11, 0.135, zb, zb + 0.022), LATAO, LATAO_L)
    for dx in (-0.12, 0.12):
        x = xc + dx
        _barra((x - 0.01, x + 0.01, 0.112, 0.133, zb + 0.02, zb + 0.06), LATAO, LATAO_L)
        o = novo()
        _poligono_rodado(x, 0.122, [(zb + 0.06, 0.05), (zb + 0.07, 0.055), (zb + 0.075, 0.05)], vol(x, 0.122, LATAO, brilho=0.5), o, lados=16,
                         tampa_mat=liso(LATAO_L))
        CA.vela(x, 0.122, zb + 0.075, 0.12, 0.022, False)
        if acesa:
            sprite((x, 0.122, zb + 0.075 + 0.14), CHAMA_VELA, FOGO_PAL, dx=1, dy=len(CHAMA_VELA) - 1)
    sombra_parede(n0, 1, 2)


def gaiola(xc=1.5, zc=1.6, acesa=True):
    """A luminária de grade: a chapa e o braço de ferro, o soquete, a lâmpada (acesa: amarela clara) e a gaiola de arame."""
    n0 = len(C().objs)
    caixa((xc - 0.06, xc + 0.06, 0.0, 0.02, zc - 0.13, zc + 0.03), {'*': _pau(FERRO, FERRO_L)}, ch=0.008)
    _barra((xc - 0.015, xc + 0.015, 0.02, 0.15, zc - 0.11, zc - 0.08), FERRO, FERRO_L)
    yc = 0.16
    o = novo()
    C().cilindro(xc, yc, 0.045, zc - 0.13, zc - 0.07, vol(xc, yc, '#3a3432', brilho=0.3), M, o, lados=14, tampa_mat=liso('#4a4440'))
    z0, z1 = zc - 0.07, zc + 0.1
    h = z1 - z0
    ob = C().novo_obj(3, contorno=not acesa, sombra=False)
    if acesa:
        CZ.luzes.add(ob)
    cor = '#fff2b8' if acesa else '#b8b4a8'
    m = liso(cor) if acesa else vol(xc, yc, cor, brilho=0.4)
    _poligono_rodado(xc, yc, [(z0, 0.025), (z0 + h * 0.3, 0.045), (z0 + h * 0.6, 0.056), (z0 + h * 0.85, 0.042), (z1 - 0.01, 0.0)], m, ob, lados=14)
    if acesa:
        ol = C().novo_obj(3, contorno=False, sombra=False)
        CZ.luzes.add(ol)
        C().elipsoide(np.array([xc - 0.008, yc + 0.012, z0 + h * 0.55]), np.array([0.018, 0.018, 0.03]), liso('#ffffe8'), ol)
    # a gaiola: os arames e os aros pintados na frente da lâmpada (1 px, ferro), o de trás meio escondido
    r = 0.068
    pg = Pl(xc - r, xc + r, zc - 0.075, zc + 0.095, yc + r)
    Wg, Hg = pg.W, (0.17) * KZ
    fio = np.zeros_like(pg.dentro)
    for u in (0, Wg / 2 - 0.5, Wg - 1):
        fio |= pg.ret(u, 0, u + 1, Hg)
    for w in (0, Hg * 0.48, Hg - 1):
        fio |= pg.ret(0, w, Wg, w + 1)
    pg.pin(fio & pg.dentro, FERRO)
    pg.pin(fio & pg.dentro & (pg.u < 1), FERRO_L)
    pg.grava()
    o = novo()
    _poligono_rodado(xc, yc, [(zc + 0.095, 0.03), (zc + 0.11, 0.022), (zc + 0.12, 0.01)], vol(xc, yc, '#3a3432', brilho=0.4), o, lados=16,
                     tampa_mat=liso('#4a4440'))
    sombra_parede(n0, 1, 2)


def tocha(xc=1.5, zc=1.6, acesa=True):
    """A tocha de parede: a chapa e o aro de ferro que a seguram, o cabo de madeira, a cabeça de pano com piche e o fogo."""
    n0 = len(C().objs)
    caixa((xc - 0.045, xc + 0.045, 0.0, 0.018, zc - 0.28, zc - 0.06), {'*': _pau(FERRO, FERRO_L)}, ch=0.006)
    for zz in (zc - 0.25, zc - 0.09):
        caixa((xc - 0.012, xc + 0.012, 0.018, 0.026, zz - 0.012, zz + 0.012), liso('#6a625c'))
    _barra((xc - 0.012, xc + 0.012, 0.018, 0.1, zc - 0.17, zc - 0.145), FERRO, FERRO_L)
    yc = 0.11
    o = novo()
    C().cilindro(xc, yc, 0.036, zc - 0.18, zc - 0.135, vol(xc, yc, FERRO, brilho=0.4), M, o, lados=14, tampa=False)
    o = novo()
    C().cilindro(xc, yc, 0.022, zc - 0.34, zc + 0.03, vol(xc, yc, '#6a4226'), M, o, lados=10, tampa_mat=liso('#4a2a18'))
    # a cabeça: o pano enrolado em faixas (aceso: brasa por cima; apagado: carvão)
    def pano(P, b):
        zz = P[:, 2] - (zc + 0.02)
        b = np.where((np.floor(zz / (3 * PZ)) % 2 == 0)[:, None], _tom(b, 0.82), b)
        return b
    o = novo()
    cab = '#4a3a2e' if acesa else '#2a2420'
    _poligono_rodado(xc, yc, [(zc + 0.02, 0.026), (zc + 0.04, 0.042), (zc + 0.12, 0.044), (zc + 0.135, 0.032)],
                     vol(xc, yc, cab, faixas=pano), o, lados=14, tampa_mat=liso('#c8501e' if acesa else '#1e1a18'))
    if acesa:
        sprite((xc, yc, zc + 0.135), CHAMA_TOCHA, FOGO_PAL, dx=4, dy=len(CHAMA_TOCHA) - 1)
    sombra_parede(n0, 1, 2)


# =====================================================================================================================
# a janela gradeada do orfanato (0 o dia lá fora, '1' escura)
# =====================================================================================================================
def janela_gradeada(xc=1.5, zc=1.5, dia=True):
    """
    A janela do orfanato queimado: o vão fundo na parede (o vidro 10 cm para dentro, a ombreira da esquerda e o
    peitoril de dentro à mostra), o caixilho de madeira carbonizada com os vidros sujos (um quebrado), a moldura de
    fora, o peitoril que sai, as cinco barras de ferro enferrujado e a fuligem que subiu pela parede.
    """
    n0 = len(C().objs)
    a, h = 0.42, 0.44
    x0, x1, z0, z1 = xc - a, xc + a, zc - h, zc + h
    fun = 0.12
    # o fundo: o céu (dia) ou o escuro, com os vidros
    pl = Pl(x0, x1, z0, z1, -fun)
    W, H = pl.W, (z1 - z0) * KZ
    if dia:
        _faixas(pl, pl.dentro, [H * 0.3, H * 0.6], ['#b8d0dc', '#cfdee2', '#e2e8dc'])
        pl.pin(pl.dentro & (pl.w >= H * 0.72 + _onda(pl.u, 1.5, 3.0, 0.7)), '#7e8a6a')
        pl.pin(pl.dentro & (pl.w >= H * 0.8 + _onda(pl.u, 1.2, 2.2, 2.0)), '#5e6a50')
        suj = pl.dentro & (suave(pl.u, pl.w, 6.0, 3) > 0.62)
        pl.rgb[suj] = _tom(pl.rgb[suj], 0.86)
    else:
        _faixas(pl, pl.dentro, [H * 0.5], ['#141a26', '#1a2230'])
        pl.pin(pl.dentro & (pl.w >= H * 0.75 + _onda(pl.u, 1.5, 3.0, 0.7)), '#0e1218')
        ref = pl.dentro & (np.abs((pl.u + pl.w * 0.7) % 14 - 3) < 1.0)
        pl.pin(ref, '#26304a')
    # o vidro quebrado (o de baixo à esquerda): o buraco escuro em ponta
    quebra = pl.poli([(W * 0.08, H * 0.58), (W * 0.3, H * 0.62), (W * 0.2, H * 0.72), (W * 0.33, H * 0.9), (W * 0.06, H * 0.93)])
    pl.pin(quebra, '#0c0a0a' if not dia else '#3a3a34')
    pl.grava()
    # o caixilho (dentro do vão): as travessas e o pinázio
    MC = _pau('#3a2a22', '#5a4434')
    caixa((x0, x1, -fun, -fun + 0.03, zc + 0.08, zc + 0.12), MC)
    caixa((xc - 0.02, xc + 0.02, -fun, -fun + 0.03, z0, z1), MC)
    # o vão: a ombreira da esquerda (olha para +x) e o peitoril de dentro (olha para cima)
    o = novo()
    fp([(x0, -fun, z0), (x0, 0.0, z0), (x0, 0.0, z1), (x0, -fun, z1)], (1, 0, 0), mad2('#8a8478', seed=3, eixo=1), o)
    fp([(x0, -fun, z0), (x1, -fun, z0), (x1, 0.0, z0), (x0, 0.0, z0)], (0, 0, 1), liso('#9a9488'), o)
    recorta_vao(n0, x0, x1, z0, z1)
    # a moldura de fora (madeira queimada) e o peitoril que sai
    moldura(x0 - 0.06, x1 + 0.06, z0 - 0.02, z1 + 0.06, 0.06, 0.035, ('#120c0a', '#2e221c', '#4a3a30', '#6a5444'))
    caixa((x0 - 0.1, x1 + 0.1, 0.0, 0.09, z0 - 0.07, z0 - 0.02), {'cima': tab2(['#4a3a30', '#44342a'], 0.09, '#1a1210', eixo=0, seed=8),
                                                                     '*': _pau('#2e221c', '#4a3a30')})
    # as barras de ferro (enferrujadas: manchas de 2 px)
    def ferrugem(L, n, P):
        out = np.tile(hx('#3a3430'), (len(P), 1))
        r = suave(P[:, 0] * 40, P[:, 2] * 30, 1.6, 11) > 0.62
        out = np.where(r[:, None], hx('#7a4a2a'), out)
        if np.asarray(n)[0] > 0.5:
            out = _tom(out, 0.8)
        return BE._cru(out, n) if np.asarray(n)[2] < 0.5 else _tom(out, 1.3)
    mf = emissivo(ferrugem)
    for k in range(4):
        xx = x0 + 0.1 + k * (2 * a - 0.2) / 3
        caixa((xx - 0.012, xx + 0.012, 0.05, 0.075, z0 - 0.02, z1 + 0.02), mf)
    for zz in (z0 + 0.2, z1 - 0.2):
        caixa((x0 - 0.02, x1 + 0.02, 0.075, 0.09, zz - 0.016, zz + 0.016), mf)
    for xx in (x0 - 0.035, x1 + 0.035):
        for zz in (z0 + 0.2, z1 - 0.2):
            caixa((xx - 0.015, xx + 0.015, 0.0, 0.09, zz - 0.016, zz + 0.016), mf)
    sombra_parede(n0, 1, 2)
    # a fuligem que saiu pela janela e subiu (o fogo): meio transparente, por cima da moldura
    fu = Pl(x0 - 0.12, x1 + 0.12, z1 + 0.06, z1 + 0.5, 0.0)
    larg = (x1 - x0 + 0.24) * KX
    alto = (0.44 - 0.0) * KZ * (0.55 + 0.45 * suave(fu.u, 0, 5.0, 4)) * np.clip(1 - np.abs(fu.u - larg / 2) / (larg * 0.62), 0, 1)
    d = 1 - (0.44 * KZ - fu.w) / np.maximum(alto, 1e-3)
    d = d + (suave(fu.u, fu.w, 4.0, 9) - 0.5) * 0.5
    fu.pin(fu.dentro & (d > 0.15), '#000000', 1)
    fu.pin(fu.dentro & (d > 0.45), '#000000', 2)
    fu.pin(fu.dentro & (d > 0.85), '#2a201c')
    fu.limpa_soltos(255)
    fu.limpa_soltos(2)
    fu.grava()


# =====================================================================================================================
# as correntes com as algemas
# =====================================================================================================================
def _corrente(pl, u, w0, w1, seed=0):
    """Uma corrente pendurada (em u, de w0 a w1): elos de frente (o anel com o furo) e de lado (a barrinha), alternados."""
    w = w0
    k = 0
    while w < w1 - 2:
        if k % 2 == 0:
            anel = pl.elipse(u, w + 2.5, 1.9, 3.0)
            furo = pl.elipse(u, w + 2.5, 0.7, 1.6)
            pl.pin(anel & ~furo, '#5e5650')
            pl.pin(anel & ~furo & (pl.u < u - 0.4) & (pl.w < w + 2.5), '#9a9088')
            pl.pin(anel & ~furo & (pl.u > u + 0.4) & (pl.w > w + 2.5), '#3a3430')
            if ruido(k, seed) > 0.6:
                pl.pin(anel & ~furo & (pl.w > w + 3.2) & (pl.u < u), '#7a4a2a')
            pl.nv[furo & pl.dentro] = 0
        else:
            barra = pl.ret(u - 0.5, w + 0.5, u + 0.5, w + 5)
            pl.pin(barra, '#8a8078')
        w += 3.6
        k += 1
    return w


def _algema(pl, u, w, lado=1):
    """A algema aberta: o aro grosso em C (aberto para o lado), com o brilho em cima e a sombra embaixo."""
    aro = pl.elipse(u, w + 4, 3.6, 4.2) & ~pl.elipse(u, w + 4, 2.0, 2.6)
    aberto = (pl.u - u) * lado > 1.0
    aberto &= (pl.w > w + 3)
    m = aro & ~aberto
    pl.pin(m, '#5e5650')
    pl.pin(m & (pl.w < w + 3), '#9a9088')
    pl.pin(m & (pl.w > w + 5.5), '#3a3430')
    pl.pin(pl.ret(u - 1.0, w - 1, u + 1.0, w + 1), '#4a4440')
    pl.nv[pl.elipse(u, w + 4, 1.9, 2.5) & pl.dentro & (pl.nv == 255) & ~m] = 0


def correntes(xc=1.5, zc=1.4):
    """As correntes enferrujadas presas em duas argolas com chapa, cada uma terminando numa algema aberta."""
    n0 = len(C().objs)
    a, h = 0.3, 0.49
    for dx in (-0.16, 0.16):
        x = xc + dx
        caixa((x - 0.045, x + 0.045, 0.0, 0.02, zc + h - 0.11, zc + h - 0.02), {'*': _pau(FERRO, FERRO_L)}, ch=0.008)
        caixa((x - 0.012, x + 0.012, 0.02, 0.045, zc + h - 0.075, zc + h - 0.055), liso('#4a4440'))
    pl = Pl(xc - a, xc + a, zc - h, zc + h - 0.05, 0.04)
    for (dx, comp, sd, lado) in ((-0.16, 0.7, 1, -1), (0.16, 0.55, 2, 1)):
        u = (dx + a) * KX
        w0 = 0.04 * KZ
        wf = _corrente(pl, u, w0, w0 + comp * KZ, sd)
        _algema(pl, u, wf - 1, lado)
    m = pl.opaco()
    pl.contorno(m)
    pl.grava()
    sombra_parede(n0, 2, 2)


# =====================================================================================================================
# os riscos na parede (o sigilo à unha e a contagem dos dias): sulco escuro e a beirada clara do reboco
# =====================================================================================================================
def _riscado(pl, m):
    """O risco fundo: o sulco escuro, a beira de baixo e da direita clara (o reboco arrancado), sem pixel solto."""
    p = np.pad(m, 1)
    beira = ~m & (p[:-2, 1:-1] | p[1:-1, :-2]) & pl.dentro
    pl.pin(beira, '#d6cab2')
    pl.pin(m, '#2a1e1a')
    som = ~m & ~beira & (p[2:, 1:-1] | p[1:-1, 2:]) & pl.dentro
    pl.pin(som, '#000000', 1)


def sigilo_riscado(xc=1.5, zc=1.5):
    """O sigilo riscado à unha (inventado): a espiral de duas voltas, o círculo quebrado, os raios curtos e três garradas."""
    a, h = 0.32, 0.33
    pl = Pl(xc - a, xc + a, zc - h, zc + h, 0.002)
    W, H = pl.W, 2 * h * KZ
    cu, cw = W / 2, H / 2
    m = np.zeros_like(pl.dentro)
    pts = []
    for k in range(60):
        t = k / 59 * 1.6 * 2 * math.pi
        r = 2.0 + k / 59 * 8.5
        pts.append((cu + math.cos(t) * r, cw + math.sin(t) * r * 1.05))
    m |= pl.linha(pts, 1.0)
    ang = np.arctan2(pl.w - cw, pl.u - cu)
    rr = np.hypot(pl.u - cu, (pl.w - cw) / 1.05)
    m |= (np.abs(rr - 13) < 0.6) & ~((ang > 0.4) & (ang < 1.1)) & ~((ang > -2.4) & (ang < -2.0))
    for k in range(5):
        t = k * 2 * math.pi / 5 + 0.3
        m |= pl.seg((cu + math.cos(t) * 14.5, cw + math.sin(t) * 15), (cu + math.cos(t) * 17.5, cw + math.sin(t) * 18.5), 1.0)
    for k in range(3):
        m |= pl.seg((cu + 4 + k * 4, cw - 17 + k * 1.5), (cu + 11 + k * 4, cw - 4 + k * 1.5), 1.0)
    _riscado(pl, m & pl.dentro)
    pl.grava()


def contagem(xc=1.5, zc=1.2):  # noqa: C901
    """As marcas de contagem: grupos de quatro risquinhos cortados por um quinto, em duas fileiras, e o grupo pela metade."""
    a, h = 0.33, 0.21
    pl = Pl(xc - a, xc + a, zc - h, zc + h, 0.002)
    m = np.zeros_like(pl.dentro)
    grupos = ((2, 2, 5), (12, 2, 5), (22, 2, 5), (3, 13, 5), (13, 13, 3))
    for (u0, w0, n) in grupos:
        for k in range(min(n, 4)):
            jit = int(round((ruido(u0, k, 3) - 0.5) * 2))
            m |= pl.ret(u0 + k * 2, w0 + jit, u0 + k * 2 + 1, w0 + 7 + jit)
        if n == 5:
            m |= pl.seg((u0 - 1, w0 + 5), (u0 + 7.5, w0 + 2), 1.0)
    _riscado(pl, m & pl.dentro)
    pl.grava()


# =====================================================================================================================
# a fuligem subindo pela parede (meio transparente, em três degraus)
# =====================================================================================================================
def fuligem(xc=1.5, zc=1.1):
    """As línguas pretas que o fogo deixou: escuras e opacas embaixo, abrindo e clareando para cima (0,32 e 0,14)."""
    a, h = 0.82, 1.05
    pl = Pl(xc - a, xc + a, zc - h, zc + h, 0.002)
    W, H = pl.W, 2 * h * KZ
    du = (pl.u - W / 2) / (W / 2)
    sobe = H - pl.w                                          # de baixo para cima, em px
    lingua = 0.45 + 0.55 * (0.5 + 0.5 * np.cos(pl.u / W * 2 * math.pi * 2.3 + 0.7)) * (0.6 + 0.4 * suave(pl.u, 0, 7.0, 5))
    alto = H * lingua * np.clip(1.15 - du ** 2, 0, 1)
    d = 1 - sobe / np.maximum(alto, 1e-3)
    d = d + (suave(pl.u, pl.w, 5.0, 2) - 0.5) * 0.45 + (suave(pl.u, pl.w, 11.0, 6) - 0.5) * 0.3
    base = np.clip(1 - np.abs(du) * 1.05, 0, 1)
    pl.pin(pl.dentro & (d > 0.12) & (base > 0), '#000000', 1)
    pl.pin(pl.dentro & (d > 0.42) & (base > 0.05), '#000000', 2)
    nucleo = pl.dentro & (d > 0.85) & (base > 0.25) & (pl.w > H - 14)
    pl.pin(nucleo, '#2a201c')
    for nv in (255, 2, 1):
        pl.limpa_soltos(nv)
    pl.grava()


# =====================================================================================================================
# a escrita de sangue (8 m de parede): rabiscos que parecem letras, mas não se leem
# =====================================================================================================================
def _glifo(rng, u0, w0, alto, larg):
    """Os traços de uma 'letra' inventada: 2 a 4 traços entre retas, curvas, ganchos e laços, inclinada."""
    tr = []
    inc = rng.uniform(0.1, 0.35)

    def P(x, y):
        return (u0 + x * larg + (1 - y) * alto * inc, w0 + y * alto)
    for _ in range(rng.integers(2, 5)):
        tipo = rng.integers(0, 5)
        if tipo == 0:       # a haste
            x = rng.uniform(0, 1)
            tr.append([P(x, rng.uniform(0, 0.2)), P(x + rng.uniform(-0.2, 0.2), rng.uniform(0.8, 1.0))])
        elif tipo == 1:     # a diagonal
            tr.append([P(rng.uniform(0, 0.3), rng.uniform(0.0, 0.4)), P(rng.uniform(0.6, 1.0), rng.uniform(0.6, 1.0))])
        elif tipo == 2:     # a curva aberta
            c0, r0 = rng.uniform(0.3, 0.7), rng.uniform(0.25, 0.45)
            a0 = rng.uniform(0, 2 * math.pi)
            tr.append([P(c0 + r0 * math.cos(a0 + t), 0.5 + r0 * 1.2 * math.sin(a0 + t)) for t in np.linspace(0, rng.uniform(2.5, 4.2), 7)])
        elif tipo == 3:     # o gancho
            x = rng.uniform(0.2, 0.8)
            tr.append([P(x, 0.1), P(x, 0.75), P(x - 0.25, 0.95), P(x - 0.45, 0.8)])
        else:               # a travessa curta
            y = rng.uniform(0.3, 0.6)
            tr.append([P(rng.uniform(-0.1, 0.3), y), P(rng.uniform(0.6, 1.1), y + rng.uniform(-0.15, 0.15))])
    return tr


def escrita_sangue(xc=1.5, zc=1.45):
    """
    A frase escrita com sangue, à mão, em três linhas que descem tortas: cada 'letra' é um rabisco inventado (não se lê),
    com o traço de 2 px (o claro em cima, o escuro embaixo) e os escorridos com a gota na ponta.
    """
    _alarga(150, 60)
    a, h = 3.9, 1.28
    pl = Pl(xc - a, xc + a, zc - h, zc + h, 0.002)
    W, H = pl.W, 2 * h * KZ
    rng = np.random.default_rng(7)
    m = np.zeros_like(pl.dentro)
    pontas = []
    linhas = ((22, 12, 30, 0.04), (30, 48, 26, -0.03), (50, 86, 24, 0.05))
    for (u_ini, w_ini, alto, desce) in linhas:
        u = u_ini + rng.uniform(0, 6)
        while u < W - 34:
            for _ in range(rng.integers(2, 6)):
                larg = rng.uniform(alto * 0.35, alto * 0.6)
                ww = w_ini + u * desce + rng.uniform(-2, 2)
                al = alto * rng.uniform(0.75, 1.1)
                for tr in _glifo(rng, u, ww, al, larg):
                    m |= pl.linha(tr, 2.0 if rng.uniform() < 0.8 else 2.6)
                    fim = max(tr, key=lambda p: p[1])
                    if rng.uniform() < 0.3:
                        pontas.append(fim)
                u += larg + rng.uniform(2, 4)
                if u > W - 34:
                    break
            u += rng.uniform(8, 14)
    esc = np.zeros_like(m)
    for (pu, pw) in pontas:
        comp = rng.uniform(5, 22)
        esc |= pl.ret(pu - 0.5, pw, pu + 0.5 + (rng.uniform() < 0.3), pw + comp)
        esc |= pl.elipse(pu, pw + comp + 0.5, 1.0, 1.4)
    m &= pl.dentro
    esc &= pl.dentro
    tudo = m | esc
    pl.pin(tudo, '#7a1410')
    p = np.pad(tudo, 1)
    pl.pin(tudo & ~p[:-2, 1:-1], '#a2261a')                        # a beira de cima pega luz
    pl.pin(tudo & ~p[2:, 1:-1], '#4a0a08')                          # a de baixo escurece
    pl.pin(esc & ~m & ~p[1:-1, :-2], '#5a0e0a')
    pl.limpa_soltos(255)
    pl.grava()


# =====================================================================================================================
# o estandarte de pano com o sigilo de sangue
# =====================================================================================================================
def estandarte(xc=1.5, zc=1.5):
    """O estandarte velho: a vara de madeira com as ponteiras, o cordão no prego, o pano de rabo de andorinha rasgado,
    manchado, com as dobras em pé e um sigilo inventado pintado em sangue."""
    n0 = len(C().objs)
    a, h = 0.36, 0.7
    zt = zc + h - 0.08
    pr = Pl(xc - 0.46, xc + 0.46, zt, zc + h + 0.08, 0.02)
    cord = pr.linha([(0.06 * KX, (zc + h + 0.08 - zt - 0.0) * KZ), (0.46 * KX, 1.0), (0.86 * KX, (zc + h + 0.08 - zt) * KZ)], 1.0)
    pr.pin(cord, '#8a7a5a')
    pr.contorno(cord)
    pr.grava()
    prego(xc, zc + h + 0.065)
    tubo_x(xc - 0.44, xc + 0.44, 0.055, zt, 0.018, '#5a3420', lados=8)
    for x in (xc - 0.46, xc + 0.44):
        caixa((x, x + 0.025, 0.035, 0.075, zt - 0.025, zt + 0.025), {'*': _pau(LATAO, LATAO_L)}, ch=0.006)
    pl = Pl(xc - a - 0.02, xc + a + 0.02, zc - h, zt, 0.045)
    W, H = pl.W, (zt - zc + h) * KZ
    x0u, x1u = 0.02 * KX, W - 0.02 * KX
    borda = 1.2 * (suave(pl.w, 0, 3.0, 2) - 0.5)
    corte = H - 9 - np.abs(pl.u - W / 2) * (-0.55) - 9
    fundo_v = H - 2 - (1 - np.abs(pl.u - W / 2) / (W / 2)) * 13 + (suave(pl.u, 0, 2.5, 4) - 0.5) * 3
    pano = pl.dentro & (pl.u >= x0u + borda) & (pl.u <= x1u - borda) & (pl.w <= fundo_v)
    furos = pl.elipse(W * 0.72, H * 0.62, 1.6, 2.2) | pl.elipse(W * 0.2, H * 0.3, 1.1, 1.5)
    pano &= ~furos
    pl.pin(pano, '#b6a684')
    dob = np.sin(pl.u / W * 2 * math.pi * 3.0)
    pl.pin(pano & (dob > 0.55), '#c8b894')
    pl.pin(pano & (dob < -0.55), '#9a8a6c')
    pl.pin(pano & (pl.w < 3), '#8a7a5c')
    manch = pano & (suave(pl.u, pl.w, 5.0, 13) > 0.66)
    pl.pin(manch, '#8a7458')
    pl.pin(pano & (pl.w > fundo_v - 4) & (suave(pl.u, pl.w, 2.0, 21) > 0.5), '#6e5a44')
    # o sigilo: o círculo, a lua virada, as três hastes que descem e escorrem
    cu, cw = W / 2, H * 0.4
    s = (np.abs(np.hypot(pl.u - cu, (pl.w - cw) * 0.95) - 8) < 1.0)
    s |= (np.abs(np.hypot(pl.u - cu, pl.w - cw + 3) - 4.5) < 0.9) & (pl.w > cw - 3)
    for dx in (-4, 0, 4):
        s |= pl.seg((cu + dx, cw + 6), (cu + dx * 1.3, cw + 18 + abs(dx) * 0.6), 1.5)
    s |= pl.elipse(cu, cw - 2, 1.2, 1.2)
    s &= pano
    pl.pin(s, '#7a1410')
    p = np.pad(s, 1)
    pl.pin(s & ~p[:-2, 1:-1], '#9a2018')
    pl.contorno(pano | s)
    pl.limpa_soltos(255)
    pl.grava()
    sombra_parede(n0, 2, 2)


# =====================================================================================================================
# a rachadura com a luz dourada
# =====================================================================================================================
def rachadura(xc=1.5, zc=0.95):
    """A rachadura funda na parede (Câmara do Selo): o caminho em zigue-zague, a borda escura, a luz dourada lá dentro
    (o miolo quase branco onde abre mais), os galhos finos, o reboco lascado claro na beira e a sombra em volta."""
    a, h = 0.44, 0.88
    pl = Pl(xc - a, xc + a, zc - h, zc + h, 0.002)
    W, H = pl.W, 2 * h * KZ
    rng = np.random.default_rng(3)
    pts = []
    for k in range(17):
        w = 2 + k * (H - 4) / 16
        pts.append((W / 2 + rng.uniform(-5, 5) + 3 * math.sin(k * 0.9), w))
    larg = [1.0 + 3.2 * math.sin(math.pi * k / 16) ** 1.5 for k in range(17)]
    rim = np.zeros_like(pl.dentro)
    ouro = np.zeros_like(pl.dentro)
    miolo = np.zeros_like(pl.dentro)
    for k in range(16):
        L = (larg[k] + larg[k + 1]) / 2
        rim |= pl.seg(pts[k], pts[k + 1], L + 2)
        if L > 1.6:
            ouro |= pl.seg(pts[k], pts[k + 1], L)
        if L > 3.0:
            miolo |= pl.seg(pts[k], pts[k + 1], L - 2.0)
    for (k, dx, dw) in ((4, -9, -4), (7, 8, 3), (10, -7, 6), (12, 9, -2), (5, 6, 8)):
        u0, w0 = pts[k]
        meio = (u0 + dx * 0.55, w0 + dw * 0.4 + 2)
        rim |= pl.linha([(u0, w0), meio, (u0 + dx, w0 + dw + 3)], 1.0)
        ouro |= pl.seg((u0, w0), meio, 0.6) & (k in (7, 10))
    rim &= pl.dentro
    p = np.pad(rim, 1)
    lasca = ~rim & (p[2:, 1:-1] | p[1:-1, 2:]) & pl.dentro & (suave(pl.u, pl.w, 2.0, 5) > 0.4)
    sombra = ~rim & ~lasca & pl.dentro
    viz = np.zeros_like(rim)
    for dy in (-2, -1, 0, 1, 2):
        for dx in (-2, -1, 0, 1, 2):
            viz |= np.roll(np.roll(rim, dy, 0), dx, 1)
    pl.pin(sombra & viz, '#000000', 1)
    pl.pin(lasca, '#d8ccb4')
    pl.pin(rim, '#1a1210')
    pl.pin(ouro & rim, '#e8a838')
    pl.pin(miolo & rim, '#fff0a8')
    pl.limpa_soltos(255)
    pl.grava()


# =====================================================================================================================
# o pôster do sigilo (Sala de Rituais)
# =====================================================================================================================
def poster(xc=1.5, zc=1.6):
    """O pôster de papel amarelado preso com alfinetes: o círculo duplo, a estrela de sete pontas, as marquinhas em volta
    (não são letras), o miolo em tinta vermelha, a ponta de baixo enrolada e a de cima rasgada."""
    n0 = len(C().objs)
    a, h = 0.42, 0.46
    pl = Pl(xc - a, xc + a, zc - h, zc + h, 0.006)
    W, H = pl.W, 2 * h * KZ
    papel = pl.dentro & ~pl.poli([(W - 7, H + 1), (W + 1, H - 8), (W + 1, H + 1)]) & ~pl.poli([(-1, -1), (4, -1), (-1, 4)])
    pl.pin(papel, '#e2d4b0')
    pl.pin(papel & ((pl.u < 2) | (pl.w < 2) | (pl.u > W - 2) | (pl.w > H - 2)), '#cdbb92')
    pl.pin(papel & (suave(pl.u, pl.w, 6.0, 31) > 0.68), '#d2c098')
    cu, cw = W / 2, H / 2
    R = min(W, H) * 0.4
    rr = np.hypot(pl.u - cu, pl.w - cw)
    tinta = (np.abs(rr - R) < 0.6) | (np.abs(rr - (R - 2.5)) < 0.55)
    pts = [(cu + (R - 2.5) * math.sin(2 * math.pi * k / 7), cw - (R - 2.5) * math.cos(2 * math.pi * k / 7)) for k in range(7)]
    for k in range(7):
        tinta |= pl.seg(pts[k], pts[(k + 3) % 7], 1.0)
    for k in range(14):
        t = 2 * math.pi * (k + 0.5) / 14
        tinta |= pl.seg((cu + (R + 2) * math.sin(t), cw - (R + 2) * math.cos(t)), (cu + (R + 3.5) * math.sin(t), cw - (R + 3.5) * math.cos(t)), 1.0)
    tinta &= papel
    pl.pin(tinta, '#2a1e1a')
    ver = (np.abs(rr - 3.5) < 0.6) | (rr < 1.5)
    pl.pin(ver & papel, '#8a2018')
    # a ponta enrolada (o verso do papel, mais escuro)
    dobra = pl.poli([(W - 7, H + 0.5), (W + 0.5, H - 8), (W - 6, H - 6)])
    pl.pin(dobra, '#b8a478')
    pl.pin(dobra & (pl.u + pl.w > W + H - 9.5), '#d0bc90')
    pl.contorno(papel | dobra)
    pl.grava()
    for (u, w) in ((2.5, 2.5), (W - 3, 3), (3, H - 3)):
        x, z = xc - a + u / KX, zc + h - w / KZ
        caixa((x - PH, x + PH, 0.006, 0.02, z - PZ, z + PZ), liso('#a02a20'))
    sombra_parede(n0, 1, 1)


# =====================================================================================================================
# a pintura grande do Coliseu (Gabinete)
# =====================================================================================================================
def p_coliseu(pl, W, H):
    """O Coliseu ao entardecer: o céu em faixas com as nuvens compridas, o sol, a arena em ruína (três andares de arcos,
    a beira de cima quebrada à direita, o anel de trás aparecendo), os ciprestes e o chão de terra."""
    t = pl.dentro
    hz = H * 0.72
    _faixas(pl, t, [H * 0.12, H * 0.26, H * 0.4, H * 0.55], ['#5a5a7e', '#8a6a7a', '#c07a62', '#e09858', '#f2c27a'])
    for (u, w, L) in ((10, 6, 18), (40, 9, 26), (66, 4, 14), (20, 15, 12), (70, 13, 20)):
        pl.pin(pl.ret(u, w, u + L, w + 1), '#d8a48a')
        pl.pin(pl.ret(u + 3, w + 1, u + L - 2, w + 2), '#b88478')
    pl.pin(pl.elipse(W * 0.82, H * 0.5, 4.0, 3.6), '#fbe2a0')
    pl.pin(t & (pl.w >= hz), '#9a7e50')
    pl.pin(t & (pl.w >= hz + 4), '#86703f')
    pl.pin(pl.linha([(W * 0.1, H), (W * 0.42, hz + 1)], 2.0), '#b8a070')
    # a arena: o anel de fora em curva (as pontas descem), três andares de arcos, a beira quebrada em degraus à direita,
    # o anel de dentro aparecendo por cima da quebra
    a0, a1 = W * 0.16, W * 0.76
    meio, meia = (a0 + a1) / 2, (a1 - a0) / 2
    cur = ((pl.u - meio) / meia) ** 2 * 6
    topo = hz - 30 + cur
    base = hz + cur * 0.4
    q = np.clip(pl.u - (a0 + meia * 1.15), 0, 99)
    quebra = topo + np.minimum(np.floor(q / 4) * 4 * 0.9, 16)
    dentro_ = (pl.u >= a0 + 6) & (pl.u <= a1 - 3) & (pl.w >= topo - 4 - cur * 0.3) & (pl.w < base)
    pl.pin(t & dentro_, '#8a6a4e')
    ad = (np.floor(pl.u) % 4 == 1) & (pl.w >= topo - 2 - cur * 0.3) & (pl.w < topo + 1)
    pl.pin(t & dentro_ & ad, '#5a4434')
    corpo = t & (pl.u >= a0) & (pl.u <= a1) & (pl.w >= quebra) & (pl.w < base)
    pl.pin(corpo, '#cca878')
    lado = np.abs(pl.u - meio) / meia
    pl.pin(corpo & (lado > 0.7), '#b49066')
    pl.pin(corpo & (lado > 0.88), '#9a7850')
    U = np.floor(pl.u - a0)
    for (k0, alto) in ((2, 6), (10, 7), (19, 6)):
        w0 = topo + k0
        pl.pin(corpo & (pl.w >= w0 - 1) & (pl.w < w0), '#e4c896')
        arco = (U % 4 >= 1) & (U % 4 < 3) & (pl.w >= w0 + 1) & (pl.w < w0 + alto)
        pl.pin(corpo & arco, '#4a3428')
        pl.pin(corpo & arco & (pl.w >= w0 + alto - 2), '#6a4e3a')
        pl.pin(corpo & arco & (pl.w < w0 + 2) & (U % 4 == 2), '#a88a62')
    pl.pin(corpo & (pl.w >= base - 1), '#7e6446')
    # os ciprestes
    for (u, alto) in ((W * 0.08, 20), (W * 0.12, 15), (W * 0.88, 18), (W * 0.93, 13)):
        cip = pl.elipse(u, hz - alto / 2, 1.8, alto / 2)
        pl.pin(cip, '#2e3a24')
        pl.pin(cip & (pl.u < u - 0.4), '#44522e')


def coliseu(xc=1.5, zc=1.6):
    quadro(xc - 1.17, xc + 1.17, zc - 0.58, zc + 0.58, p_coliseu, MOL_DOURADA, e=0.08, fundo=0.06)


# =====================================================================================================================
# o suporte de armas brancas e o painel de ferramentas (Arsenal da Sede, Casa de Mantimentos e Celeiro da fazenda)
# =====================================================================================================================
ACO = {'c': '#d8dce0', 'a': '#a4aab0', 's': '#6e747a', 'e': '#3e4248'}


def _lamina(pl, pts, larg_fio=1.0):
    """Uma lâmina de aço: o corpo, o fio claro de um lado e a lombada escura do outro."""
    m = pl.poli(pts)
    pl.pin(m, ACO['a'])
    p = np.pad(m, 1)
    pl.pin(m & ~p[1:-1, :-2], ACO['c'])
    pl.pin(m & ~p[1:-1, 2:], ACO['s'])
    return m


def _cabo(pl, u0, w0, u1, w1, cor='#6a3a1e', rebite=True):
    m = pl.ret(u0, w0, u1, w1)
    pl.pin(m, cor)
    pl.pin(m & (pl.u < u0 + 1), _tom(_c(cor), 1.3))
    pl.pin(m & (pl.u >= u1 - 1), _tom(_c(cor), 0.7))
    if rebite:
        for ww in (w0 + 1.5, w1 - 2.5):
            pl.pin(pl.ret((u0 + u1) / 2 - 0.5, ww, (u0 + u1) / 2 + 0.5, ww + 1), '#d8c080')
    return m


def suporte_laminas(xc=1.5, zc=1.5):
    """
    O suporte de armas brancas: a tábua escura com os tarugos; penduradas, o machado (o cabo comprido e a cabeça em
    cima), o facão, duas facas e o bastão preto. O aço com o fio claro e a lombada escura; a sombra cai na tábua.
    """
    n0 = len(C().objs)
    a, h = 0.66, 0.31
    tabua = caixa((xc - a, xc + a, 0.0, 0.03, zc - h, zc + h), {'*': tab2(['#6e4428', '#684026', '#74482a'], 0.155, '#2e1810', eixo=0, seed=33)})
    pl = Pl(xc - a + 0.04, xc + a - 0.04, zc - h + 0.02, zc + h - 0.02, 0.05)
    W, H = pl.W, (2 * h - 0.04) * KZ
    # o machado: o cabo em pé e a cabeça com a lâmina para a esquerda
    u = 7
    _cabo(pl, u, 3, u + 2, H - 1, '#b8844a', rebite=False)
    _lamina(pl, [(u - 6, 0.5), (u, 2.5), (u, 9), (u - 6, 11.5), (u - 7.5, 6)])
    pl.pin(pl.ret(u, 3, u + 3, 8), ACO['e'])
    # o facão: o cabo em cima e a lâmina larga que alarga na ponta
    u = 15
    _cabo(pl, u, 1, u + 3, 8, '#7a4426')
    pl.pin(pl.ret(u - 1, 8, u + 4, 9), '#4a4440')
    _lamina(pl, [(u - 0.2, 9), (u + 3.2, 9), (u + 4.6, H - 5), (u + 2.5, H - 1), (u - 0.2, H - 4)])
    # as duas facas
    for (u, comp) in ((25, 0.6), (31, 0.46)):
        _cabo(pl, u, 2, u + 2, 9, '#5a3a2a')
        pl.pin(pl.ret(u - 0.5, 9, u + 2.5, 10), '#8a8078')
        _lamina(pl, [(u - 0.2, 10), (u + 2.6, 10), (u + 2.6, 10 + comp * (H - 12)), (u + 0.3, 12.5 + comp * (H - 12))])
    # o bastão: o cilindro preto com a empunhadura de lado
    u = 38
    bast = pl.ret(u, 2, u + 3, H - 1)
    pl.pin(bast, '#3a3634')
    pl.pin(bast & (pl.u < u + 1), '#6a6460')
    pl.pin(bast & (pl.u >= u + 2), '#24201e')
    pl.pin(pl.ret(u + 3, 7, u + 6, 9), '#3a3634')
    pl.pin(pl.ret(u, 2, u + 3, 3), '#5a5450')
    # o martelo de unha à direita
    u = 48
    _cabo(pl, u, 6, u + 2, H - 1, '#b8844a', rebite=False)
    pl.pin(pl.ret(u - 3, 3, u + 5, 6), ACO['s'])
    pl.pin(pl.ret(u - 3, 3, u + 5, 4), ACO['c'])
    pl.contorno_fora(pl.opaco())
    pl.grava()
    for u in (7, 15.5, 25, 31, 38.5, 48):
        x = xc - a + 0.04 + (u + 1) / KX
        caixa((x - 0.012, x + 0.012, 0.03, 0.075, zc + h - 0.07, zc + h - 0.045), liso('#3a2216'))
    sombra_parede(n0, 1, 2, sobre=(tabua,))


def painel_ferramentas(xc=1.5, zc=1.5):
    """
    O painel de ferramentas: a placa de eucatex com a moldura e os furos (riscas de 2 px), as chaves de boca em
    tamanhos, os dois alicates de cabo vermelho, a lanterna (em volume, deitada num suporte) e o rolo de fita.
    """
    n0 = len(C().objs)
    a, h = 0.64, 0.36

    def placa(L, n, P):
        out = np.tile(hx('#9a7a52'), (len(P), 1))
        if np.asarray(n)[1] > 0.5:
            i = np.floor((P[:, 0] - (xc - a)) * KX + 1e-4)
            v = np.floor((zc + h - P[:, 2]) * KZ + 1e-4)
            furo = (i % 4 < 2) & (v % 4 == 1) & (i > 2) & (v > 2)
            out = np.where(furo[:, None], hx('#5a4430'), out)
        return BE._cru(out, n)
    tab = caixa((xc - a, xc + a, 0.0, 0.025, zc - h, zc + h), emissivo(placa))
    moldura(xc - a - 0.02, xc + a + 0.02, zc - h - 0.02, zc + h + 0.02, 0.035, 0.04, ('#2e1a0e', '#5a3a22', '#7a5434', '#9a6a40'))
    pl = Pl(xc - a + 0.05, xc + a - 0.05, zc - h + 0.04, zc + h - 0.04, 0.04)
    W, H = pl.W, (2 * h - 0.08) * KZ
    # as chaves de boca (três, em tamanhos)
    for k, (u, comp) in enumerate(((3, 0.8), (7, 0.68), (11, 0.56))):
        haste = pl.ret(u, 3, u + 1.6, 3 + comp * (H - 6))
        boca = pl.elipse(u + 0.8, 2.5, 1.9, 1.7) & ~pl.ret(u + 0.1, 0, u + 1.5, 2.3)
        anel = pl.elipse(u + 0.8, 3 + comp * (H - 6), 1.8, 1.6) & ~pl.elipse(u + 0.8, 3 + comp * (H - 6), 0.6, 0.6)
        m = haste | boca | anel
        pl.pin(m, ACO['a'])
        pl.pin(m & (pl.u < u + 0.5), ACO['c'])
        pl.nv[pl.elipse(u + 0.8, 3 + comp * (H - 6), 0.6, 0.6) & pl.dentro] = 0
    # os alicates (o bico de aço em cima, os cabos vermelhos abrindo em V)
    for u in (18, 25):
        pl.pin(pl.poli([(u + 1, 1), (u + 3, 1), (u + 3.2, 7), (u + 0.8, 7)]), ACO['s'])
        pl.pin(pl.ret(u + 1, 1, u + 2, 6), ACO['c'])
        pl.pin(pl.elipse(u + 2, 7.5, 1.4, 1.2), '#4a4440')
        pl.pin(pl.linha([(u + 1.4, 8.5), (u - 0.8, 20)], 2.0), '#b02a20')
        pl.pin(pl.linha([(u + 2.6, 8.5), (u + 4.8, 20)], 2.0), '#8a1e18')
    # o rolo de fita (o anel prateado com o miolo de papelão)
    cu, cw = W - 7, H - 7
    rolo = pl.elipse(cu, cw, 5.0, 4.6) & ~pl.elipse(cu, cw, 2.2, 2.0)
    pl.pin(rolo, '#8e9294')
    pl.pin(rolo & (pl.u + pl.w < cu + cw - 2), '#b4b8ba')
    pl.pin(pl.elipse(cu, cw, 2.2, 2.0) & ~pl.elipse(cu, cw, 1.4, 1.2), '#b89a6a')
    pl.nv[pl.elipse(cu, cw, 1.4, 1.2) & pl.dentro] = 0
    pl.contorno_fora(pl.opaco())
    pl.grava()
    # a lanterna em volume, deitada em dois ganchos
    xl0, xl1 = xc + 0.08, xc + 0.42
    zl = zc + h - 0.12
    for x in (xl0 + 0.05, xl1 - 0.1):
        caixa((x - 0.01, x + 0.01, 0.025, 0.09, zl - 0.05, zl - 0.03), liso('#3a3432'))
    tubo_x(xl0, xl1 - 0.06, 0.06, zl, 0.03, '#2e4a6a', lados=10)
    tubo_x(xl1 - 0.06, xl1, 0.06, zl, 0.042, '#8a8e92', lados=10)
    o = novo(contorno=False)
    CZ.luzes.add(o)
    fp([(xl1 + 0.001, 0.06 + 0.032 * math.cos(2 * math.pi * k / 10), zl + 0.032 * math.sin(2 * math.pi * k / 10)) for k in range(10)],
       (1, 0, 0), liso('#e8e4c8'), o)
    caixa((xl0 + 0.12, xl0 + 0.15, 0.085, 0.095, zl + 0.02, zl + 0.034), liso('#c8c2b4'))
    sombra_parede(n0, 1, 2, sobre=(tab,))


# =====================================================================================================================
# a tubulação
# =====================================================================================================================
def tubulacao(xc=1.5, zc=1.9):
    """
    Os canos na parede: o de aço em cima (com o registro de volante vermelho e as juntas de flange) e o de ferro
    enferrujado embaixo (com o manômetro), presos por abraçadeiras; as pontas com o flange de emenda.
    """
    n0 = len(C().objs)
    a = 0.75
    zs, zf = zc + 0.07, zc - 0.1
    tubo_x(xc - a + 0.02, xc + a - 0.02, 0.07, zs, 0.05, '#7a827c', lados=14)
    tubo_x(xc - a + 0.02, xc + a - 0.02, 0.05, zf, 0.034, '#7a5640', lados=12)
    for x in (xc - a, xc + a - 0.035, xc - 0.2):
        tubo_x(x, x + 0.035, 0.07, zs, 0.064, '#8a928c', lados=14)
    for x in (xc - a, xc + a - 0.03):
        tubo_x(x, x + 0.03, 0.05, zf, 0.046, '#8a6650', lados=12)
    for x in (xc - 0.5, xc + 0.42):
        caixa((x, x + 0.03, 0.0, 0.13, zs + 0.045, zs + 0.065), {'*': _pau('#3a3432', '#5a524c')})
        caixa((x, x + 0.03, 0.0, 0.09, zf + 0.03, zf + 0.045), {'*': _pau('#3a3432', '#5a524c')})
    # o registro: o corpo, a haste e o volante
    xr = xc + 0.15
    caixa((xr - 0.06, xr + 0.06, 0.01, 0.13, zs - 0.06, zs + 0.06), {'*': _pau('#5a625c', '#8a928c')}, ch=0.015)
    _barra((xr - 0.01, xr + 0.01, 0.06, 0.08, zs + 0.06, zs + 0.13), '#4a4440')
    o = novo()
    C().cilindro(xr, 0.07, 0.07, zs + 0.13, zs + 0.15, vol(xr, 0.07, '#a82a20', brilho=0.4), M, o, lados=18,
                 tampa_mat=emissivo(lambda L, n, P: np.where((np.hypot(P[:, 0] - xr, P[:, 1] - 0.07) > 0.05)[:, None], hx('#c83a2a'),
                                                              np.where((np.hypot(P[:, 0] - xr, P[:, 1] - 0.07) < 0.015)[:, None], hx('#6a1a14'), hx('#4a3a36')))))
    # o manômetro no cano de baixo: a haste e o mostrador redondo
    xm = xc - 0.4
    _barra((xm - 0.008, xm + 0.008, 0.045, 0.06, zf + 0.03, zf + 0.09), '#8a6a3a')
    anel_y(xm, zf + 0.14, 0.055, 0.055, 0.03, 0.07, '#9a7a3a', lados=18)
    pm = Pl(xm - 0.06, xm + 0.06, zf + 0.08, zf + 0.2, 0.07)
    cu, cw = 0.06 * KX, 0.06 * KZ
    mo = pm.elipse(cu, cw, 0.055 * KX, 0.055 * KZ)
    pm.pin(mo, '#b8902e')
    pm.pin(mo & pm.elipse(cu, cw, 0.04 * KX, 0.04 * KZ), '#ece6d4')
    pm.pin(pm.seg((cu, cw), (cu + 1.2, cw - 1.6), 1.0) & mo, '#a02a20')
    pm.contorno(mo)
    pm.grava()
    sombra_parede(n0, 1, 2)


# =====================================================================================================================
# o catálogo deste grupo: def -> (desenho, (x, z) o meio na parede de trás, em m[, {estado: desenho}])
# =====================================================================================================================
ITENS_PAREDE = {
    'clock': (lambda: relogio(1.5, 1.9), (1.5, 1.9)),
    'mirror': (lambda: espelho(1.5, 1.6), (1.5, 1.6)),
    'shelf_wall': (lambda: prateleira_parede(1.5, 1.6), (1.5, 1.6)),
    'sconce': (lambda: arandela(1.5, 1.6, True), (1.5, 1.6), {'1': lambda: arandela(1.5, 1.6, False)}),
    'cage_lamp': (lambda: gaiola(1.5, 1.6, True), (1.5, 1.6), {'1': lambda: gaiola(1.5, 1.6, False)}),
    'tocha_parede': (lambda: tocha(1.5, 1.6, True), (1.5, 1.6), {'1': lambda: tocha(1.5, 1.6, False)}),
    'window_barred': (lambda: janela_gradeada(1.5, 1.5, True), (1.5, 1.5), {'1': lambda: janela_gradeada(1.5, 1.5, False)}),
    'chains_wall': (lambda: correntes(1.5, 1.4), (1.5, 1.4)),
    'sigil_scratch': (lambda: sigilo_riscado(1.5, 1.5), (1.5, 1.5)),
    'tally_marks': (lambda: contagem(1.5, 1.2), (1.5, 1.2)),
    'fuligem_parede': (lambda: fuligem(1.5, 1.1), (1.5, 1.1)),
    'escrita_sangue': (lambda: escrita_sangue(1.5, 1.45), (1.5, 1.45)),
    'estandarte_sangue': (lambda: estandarte(1.5, 1.5), (1.5, 1.5)),
    'crack_glow': (lambda: rachadura(1.5, 0.95), (1.5, 0.95)),
    'poster_sigil': (lambda: poster(1.5, 1.6), (1.5, 1.6)),
    'painting_coliseu': (lambda: coliseu(1.5, 1.6), (1.5, 1.6)),
    'blade_rack': (lambda: suporte_laminas(1.5, 1.5), (1.5, 1.5)),
    'tool_board': (lambda: painel_ferramentas(1.5, 1.5), (1.5, 1.5)),
    'pipes': (lambda: tubulacao(1.5, 1.9), (1.5, 1.9)),
}
for _m in QUADROS:
    ITENS_PAREDE[_m] = ((lambda m=_m: quadro_fazenda(m, 1.5, 1.6)), (1.5, 1.6))
