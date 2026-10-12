"""Os enfeites da cozinha: tudo no mundo (metros), cada um com a sombra pequena no que estiver embaixo."""
import math
import numpy as np
from motor import MUNDO, CASA, hexa, ruido, suave, emissivo, TEMPO
from materiais import *

M = MUNDO


def cor_fn(c):
    return lambda L, n, P: np.tile(hexa(c), (len(L), 1))


def brilhante(f, b=0.35, dureza=30):
    """O material com brilho de louça, vidro ou metal (o reflexo da luz)."""
    f.brilho, f.dureza = b, dureza
    return f


def anel(c, o, x, y, ra, za, rb, zb, mat, para_dentro=False, lados=36):
    """
    A superfície de revolução entre o círculo (ra, za) e o (rb, zb), com a normal lisa: para fora (a borda de
    fora do prato) ou para o eixo (a parede de dentro, que se vê por cima).
    """
    for i in range(lados):
        a0, a1 = 2 * math.pi * i / lados, 2 * math.pi * (i + 1) / lados
        am = (a0 + a1) / 2
        pts = [(x + ra * math.cos(a0), y + ra * math.sin(a0), za), (x + ra * math.cos(a1), y + ra * math.sin(a1), za),
               (x + rb * math.cos(a1), y + rb * math.sin(a1), zb), (x + rb * math.cos(a0), y + rb * math.sin(a0), zb)]
        dr, dz = rb - ra, zb - za
        # a normal da geratriz (perpendicular a ela, no plano radial)
        nr, nz = dz, -dr
        if para_dentro:
            nr, nz = -nr, -nz
        if nz < 0 and not para_dentro:
            nr, nz = -nr, -nz
        def normais(P, nr=nr, nz=nz):
            h = P[:, :2] - np.array([x, y])
            h = h / np.maximum(np.linalg.norm(h, axis=1, keepdims=True), 1e-9)
            return np.concatenate([h * nr, np.full((len(P), 1), nz)], 1)
        c.face_plana(pts, (math.cos(am) * nr, math.sin(am) * nr, nz), mat, M, o, dois_lados=True, normais=normais)


def pote(c, x, y, z, r=0.045, h=0.13, conteudo='#c98a3a', tampa='#8a5a34', rotulo=True, vidro=True):
    """Pote de vidro (com o que tem dentro aparecendo) ou de barro, tampa e rótulo."""
    o = c.novo_obj()
    def corpo(L, n, P):
        zz = L[:, 2] - z
        base = hexa(conteudo)[None, :] * np.ones((len(L), 1))
        if vidro:
            base = np.where((zz > h * 0.78)[:, None], hexa('#cfd8d4')[None, :] * 0.9, base)
            # o reflexo do vidro: uma faixa clara de um lado
            ang = np.arctan2(L[:, 1] - y, L[:, 0] - x)
            base = np.where((np.abs(ang - 2.0) < 0.35)[:, None], base * 0.6 + 110, base)
        if rotulo:
            base = np.where(((zz > h * 0.3) & (zz < h * 0.6))[:, None], hexa('#efe4c8')[None, :], base)
        return base
    c.cilindro(x, y, r, z, z + h, brilhante(corpo, 0.4 if vidro else 0.12, 40), M, o, lados=24, tampa=False)
    c.cilindro(x, y, r * 1.05, z + h, z + h + 0.022, cor_fn(tampa), M, o, lados=16)
    return (x - r, x + r, y - r, y + r)


def chaleira(c, x, y, z):
    o = c.novo_obj()
    esmalte = '#c94d3c'
    c.cilindro(x, y, 0.1, z, z + 0.1, brilhante(cor_fn(esmalte), 0.5, 40), M, o, lados=30, tampa=False)
    c.cilindro(x, y, 0.1, z + 0.1, z + 0.15, brilhante(cor_fn(esmalte), 0.5, 40), M, o, lados=30, r1=0.055, tampa=False)
    c.cilindro(x, y, 0.055, z + 0.15, z + 0.165, cor_fn('#e9e2d2'), M, o, lados=16)
    c.cilindro(x, y, 0.016, z + 0.165, z + 0.19, cor_fn('#2a2523'), M, o, lados=8)
    # o bico, para a frente-direita
    c.caixa((x + 0.08, x + 0.17, y - 0.015, y + 0.015, z + 0.05, z + 0.08), {'*': cor_fn(esmalte)}, M, o)
    c.caixa((x + 0.15, x + 0.19, y - 0.013, y + 0.013, z + 0.07, z + 0.11), {'*': cor_fn(esmalte)}, M, o)
    # a alça
    c.caixa((x - 0.07, x + 0.07, y - 0.01, y + 0.01, z + 0.23, z + 0.25), {'*': cor_fn('#2a2523')}, M, o)
    for dx in (-0.07, 0.06):
        c.caixa((x + dx, x + dx + 0.012, y - 0.01, y + 0.01, z + 0.14, z + 0.25), {'*': cor_fn('#2a2523')}, M, o)
    return (x - 0.1, x + 0.1, y - 0.1, y + 0.1)


def pao(c, x, y, z, comprido=False):
    o = c.novo_obj()
    massa = lambda L, n, P: np.where((suave(P[:, 0], P[:, 1] + P[:, 2], 0.02, 3) > 0.62)[:, None], hexa('#e3b56a')[None, :], hexa('#c88a44')[None, :])
    R = (0.13, 0.06, 0.06) if comprido else (0.075, 0.075, 0.055)
    c.elipsoide((x, y, z), R, massa, o, corte_z=z + 0.005)
    return (x - R[0], x + R[0], y - R[1], y + R[1])


def tabua_de_corte(c, x, y, z, w=0.34, d=0.2, eixo='x'):
    o = c.novo_obj()
    if eixo == 'x':
        b = (x - w / 2, x + w / 2, y - d / 2, y + d / 2, z, z + 0.025)
    else:
        b = (x - d / 2, x + d / 2, y - w / 2, y + w / 2, z, z + 0.025)
    c.caixa(b, {'cima': tabuas('#c9965a', larg=0.06, eixo='a' if eixo == 'x' else 'b', var=0.05, veio=False, junta_escura=0.92), '*': cor_fn('#8f6236')}, M, o)
    return b[:4]


def tigela(c, x, y, z, r=0.11, cor='#d8cdb4', frutas=None):
    o = c.novo_obj()
    c.cilindro(x, y, r * 0.55, z, z + 0.06, cor_fn(cor), M, o, lados=22, r1=r, tampa_mat=cor_fn('#5e4c3a'))
    if frutas:
        cores = {'maca': ('#c8392e', 0.04), 'laranja': ('#e88a2a', 0.042), 'pera': ('#a8b84a', 0.04), 'limao': ('#d9d04a', 0.034)}
        for i, (fx, fy, tipo) in enumerate(frutas):
            cc, rr = cores[tipo]
            f = c.novo_obj()
            c.elipsoide((x + fx, y + fy, z + 0.055 + rr * 0.7), (rr, rr, rr * 0.95), cor_fn(cc), f, brilho=0.35)
    return (x - r, x + r, y - r, y + r)


def ovos(c, x, y, z):
    o = c.novo_obj()
    # a cestinha de arame
    def arame(L, n, P):
        a, b = coord_face(L, n)
        g = ((a / 0.02) % 1 < 0.3) | ((b / 0.02) % 1 < 0.3)
        return np.where(g[:, None], hexa('#4a4542')[None, :], hexa('#8a6a44')[None, :])
    c.cilindro(x, y, 0.085, z, z + 0.06, arame, M, o, lados=18, tampa_mat=cor_fn('#6a4a2e'))
    for i, (dx, dy) in enumerate(((-0.03, -0.02), (0.03, -0.015), (0.0, 0.03), (-0.035, 0.035), (0.035, 0.03))):
        e = c.novo_obj()
        c.elipsoide((x + dx, y + dy, z + 0.075), (0.026, 0.026, 0.033), cor_fn('#efe2c8' if i % 2 else '#d9b48a'), e)
    return (x - 0.085, x + 0.085, y - 0.085, y + 0.085)


def cesto(c, x, y, z, r=0.16, h=0.15, cheio=None):
    o = c.novo_obj()
    def vime(L, n, P):
        ang = np.arctan2(L[:, 1] - y, L[:, 0] - x)
        zz = L[:, 2]
        tr = ((ang / (2 * math.pi / 22)) % 1 < 0.5) ^ (((zz - z) / 0.022) % 1 < 0.5)
        base = np.where(tr[:, None], hexa('#c9a062')[None, :], hexa('#a87c44')[None, :])
        return np.where(((zz - z) > h - 0.02)[:, None], hexa('#8a6234')[None, :], base)
    c.cilindro(x, y, r * 0.85, z, z + h, vime, M, o, lados=24, r1=r, tampa_mat=cor_fn('#5a3e26'))
    if cheio:
        for i in range(7):
            ang = i * 2.399
            rr = r * 0.55 * math.sqrt((i + 0.5) / 7)
            f = c.novo_obj()
            c.elipsoide((x + rr * math.cos(ang), y + rr * math.sin(ang), z + h - 0.01), (0.045, 0.045, 0.035), cor_fn(cheio[i % len(cheio)]), f)
    return (x - r, x + r, y - r, y + r)


def jarra(c, x, y, z, cor='#5d7fa1'):
    o = c.novo_obj()
    c.cilindro(x, y, 0.07, z, z + 0.16, cor_fn(cor), M, o, lados=18, r1=0.05, tampa=False)
    c.cilindro(x, y, 0.05, z + 0.16, z + 0.2, cor_fn(cor), M, o, lados=18, r1=0.06, tampa_mat=cor_fn('#2e3a46'))
    c.caixa((x - 0.1, x - 0.06, y - 0.01, y + 0.01, z + 0.06, z + 0.17), {'*': cor_fn(cor)}, M, o)
    return (x - 0.07, x + 0.07, y - 0.07, y + 0.07)


def colheres(c, x, y, z):
    """O pote de barro com as colheres de pau."""
    o = c.novo_obj()
    c.cilindro(x, y, 0.05, z, z + 0.12, cor_fn('#b5683e'), M, o, lados=16, r1=0.055, tampa_mat=cor_fn('#4a2e1e'))
    for i, (dx, dy, inc) in enumerate(((-0.02, 0, -0.04), (0.015, -0.01, 0.03), (0.0, 0.02, 0.0))):
        u = c.novo_obj()
        c.caixa((x + dx - 0.007, x + dx + 0.007, y + dy - 0.007, y + dy + 0.007, z + 0.1, z + 0.25), {'*': cor_fn('#d2a868')}, M, u)
        c.elipsoide((x + dx + inc, y + dy, z + 0.27), (0.02, 0.012, 0.03), cor_fn('#d2a868'), u)
    return (x - 0.055, x + 0.055, y - 0.055, y + 0.055)


def pratos(c, x, y, z, n=5):
    o = c.novo_obj()
    for i in range(n):
        c.cilindro(x, y, 0.1, z + i * 0.012, z + i * 0.012 + 0.011, cor_fn('#ece6d6' if i % 2 else '#dcd5c4'), M, o, lados=24)
    return (x - 0.1, x + 0.1, y - 0.1, y + 0.1)


def prato_posto(c, x, y, z, d=(0, 1)):
    """
    O lugar posto: o prato de louça (o pé, a borda levantada com o friso azul, o fundo afundado e o brilho), o
    guardanapo e o garfo à esquerda, a faca à direita e o copo na frente à direita. d: para onde quem senta olha.
    """
    dx, dy = d
    esq = (dy, -dx)                       # a esquerda de quem senta
    o = c.novo_obj()
    louca = brilhante(lambda L, n, P: np.tile(hexa('#f4f0e6'), (len(L), 1)), 0.45, 45)
    def borda(L, n, P):
        r = np.hypot(L[:, 0] - x, L[:, 1] - y)
        base = np.tile(hexa('#f4f0e6'), (len(L), 1))
        return np.where(((r > 0.09) & (r < 0.097))[:, None], hexa('#4f73a0')[None, :], base)
    borda = brilhante(borda, 0.45, 45)
    # o pé, a barriga de baixo, a borda (aba) e a parede de dentro até o fundo
    c.cilindro(x, y, 0.052, z, z + 0.005, louca, M, o, lados=28, tampa=False)
    anel(c, o, x, y, 0.06, z + 0.005, 0.106, z + 0.016, louca)
    anel(c, o, x, y, 0.106, z + 0.016, 0.073, z + 0.02, borda)
    anel(c, o, x, y, 0.073, z + 0.02, 0.06, z + 0.011, louca, para_dentro=True)
    def fundo(L, n, P):
        r = np.hypot(L[:, 0] - x, L[:, 1] - y)
        return np.tile(hexa('#f1ece0'), (len(L), 1)) * (0.97 + 0.03 * (r / 0.06))[:, None]
    c.face_plana([(x + 0.0601 * math.cos(2 * math.pi * k / 36), y + 0.0601 * math.sin(2 * math.pi * k / 36), z + 0.011) for k in range(36)],
                 (0, 0, 1), brilhante(fundo, 0.25, 30), M, o)
    def tira(cx, cy, comp, larg, cor, alto=0.004, z0=z):
        if dx:
            b = (cx - comp / 2, cx + comp / 2, cy - larg / 2, cy + larg / 2, z0, z0 + alto)
        else:
            b = (cx - larg / 2, cx + larg / 2, cy - comp / 2, cy + comp / 2, z0, z0 + alto)
        c.caixa(b, {'*': cor_fn(cor)}, M, o, ch=0.0005)
    # o guardanapo dobrado embaixo do garfo
    gx, gy = x + esq[0] * 0.15, y + esq[1] * 0.15
    tira(gx, gy, 0.15, 0.08, '#c96a5a', alto=0.004)
    # o garfo (o cabo e os dentes) e a faca
    tira(gx, gy, 0.16, 0.012, '#c9c5bd', alto=0.005, z0=z + 0.004)
    tira(gx + dx * 0.075, gy + dy * 0.075, 0.03, 0.026, '#c9c5bd', alto=0.004, z0=z + 0.004)
    fx, fy = x - esq[0] * 0.14, y - esq[1] * 0.14
    tira(fx, fy, 0.18, 0.014, '#d6d2ca', alto=0.004)
    # o copo de água
    cx_, cy_ = x - esq[0] * 0.13 + dx * 0.13, y - esq[1] * 0.13 + dy * 0.13
    co = c.novo_obj()
    def vidro(L, n, P):
        zz = L[:, 2] - z
        base = np.where((zz < 0.06)[:, None], hexa('#bcd7dc')[None, :], hexa('#e2eef0')[None, :])
        ang = np.arctan2(L[:, 1] - cy_, L[:, 0] - cx_)
        return np.where((np.abs(ang - 2.2) < 0.4)[:, None], np.minimum(base + 25, 255), base)
    c.cilindro(cx_, cy_, 0.028, z, z + 0.1, brilhante(vidro, 0.6, 60), M, co, lados=24, r1=0.033, tampa_mat=cor_fn('#9fc4cc'))
    return (x - 0.1, x + 0.1, y - 0.1, y + 0.1)


def vela(c, x, y, z):
    o = c.novo_obj()
    c.cilindro(x, y, 0.045, z, z + 0.02, cor_fn('#b08a3a'), M, o, lados=16)
    c.cilindro(x, y, 0.018, z + 0.02, z + 0.12, cor_fn('#efe6d0'), M, o, lados=10)
    ch = c.novo_obj(contorno=False)
    t = TEMPO['t'] * 2 * math.pi
    alto = 0.022 + 0.006 * math.sin(t * 4) + 0.004 * math.sin(t * 9 + 1)
    lado = 0.004 * math.sin(t * 3)
    c.elipsoide((x + lado, y, z + 0.13 + alto * 0.6), (0.011, 0.011, alto), emissivo(lambda L, n, P: np.where((L[:, 2] > 0.0)[:, None], hexa('#ffe48a')[None, :], hexa('#f08a2a')[None, :])), ch)
    return (x, y, z + 0.14)


def toalha_mesa(c, x0, x1, yc, larg, z):
    """O caminho de mesa xadrez (em cima do tampo, caindo um pouco nas pontas)."""
    o = c.novo_obj()
    def xadrez(L, n, P):
        a, b = L[:, 0], L[:, 1] + L[:, 2]
        q = 0.05
        v1, v2 = np.floor(a / q) % 2 == 0, np.floor(b / q) % 2 == 0
        return np.where((v1 & v2)[:, None], hexa('#3d6a8a')[None, :], np.where((v1 ^ v2)[:, None], hexa('#9db8c9')[None, :], hexa('#efe8d8')[None, :]))
    c.caixa((x0, x1, yc - larg / 2, yc + larg / 2, z, z + 0.006), {'cima': xadrez, '*': xadrez}, M, o)
    c.caixa((x1, x1 + 0.006, yc - larg / 2, yc + larg / 2, z - 0.12, z + 0.006), {'*': xadrez}, M, o)


def panela_pendurada(c, x, y, z, r=0.09, cor='#5a5552', cabo='#2a2523', parede='l'):
    """Panela pendurada no gancho, encostada na parede da esquerda (x = 0)."""
    o = c.novo_obj()
    # o fundo da panela, de frente (um disco no plano da parede, afastado um pouco)
    pts = [(0.03, y + r * math.cos(2 * math.pi * i / 20), z + r * math.sin(2 * math.pi * i / 20)) for i in range(20)]
    def fundo(L, n, P):
        d = np.hypot(L[:, 1] - y, L[:, 2] - z)
        base = hexa(cor)[None, :] * np.ones((len(L), 1))
        base = np.where((d > r - 0.018)[:, None], base * 1.2, base)
        return np.where(((d > r * 0.45) & (d < r * 0.5))[:, None], base * 0.85, base)
    c.face_plana(pts, (1, 0, 0), fundo, M, o)
    c.caixa((0.0, 0.025, y - 0.012, y + 0.012, z + r - 0.01, z + r + 0.12), {'*': cor_fn(cabo)}, M, o)


def concha(c, y, z):
    o = c.novo_obj()
    c.caixa((0.0, 0.02, y - 0.008, y + 0.008, z - 0.22, z), {'*': cor_fn('#9a948c')}, M, o)
    c.elipsoide((0.04, y, z - 0.25), (0.035, 0.04, 0.03), cor_fn('#9a948c'), o)


def trilho(c, y0, y1, z):
    o = c.novo_obj()
    c.caixa((0.0, 0.025, y0, y1, z - 0.012, z + 0.012), {'*': cor_fn('#3a3533')}, M, o)
    for yy in (y0 + 0.02, y1 - 0.02):
        c.caixa((0.0, 0.03, yy - 0.01, yy + 0.01, z - 0.03, z + 0.03), {'*': cor_fn('#2a2523')}, M, o)


def alho(c, x, y, z):
    """A trança de alho pendurada (parede do fundo)."""
    o = c.novo_obj()
    c.caixa((x - 0.008, x + 0.008, 0.0, 0.02, z - 0.45, z), {'*': cor_fn('#c9b27a')}, M, o)
    for i in range(8):
        e = c.novo_obj()
        c.elipsoide((x + (0.035 if i % 2 else -0.035), 0.05, z - 0.07 - i * 0.05), (0.04, 0.035, 0.042), cor_fn('#eee3d0' if i % 3 else '#e2c9b8'), e)


def ervas_secando(c, x, y, z):
    o = c.novo_obj()
    for i, dx in enumerate((-0.06, 0.0, 0.06)):
        c.caixa((x + dx - 0.004, x + dx + 0.004, 0.0, 0.02, z - 0.06, z), {'*': cor_fn('#c9b27a')}, M, o)
        cc = ('#6b7a3a', '#7d8a46', '#8a6a3a')[i]
        e = c.novo_obj()
        c.cilindro(x + dx, 0.035, 0.012, z - 0.22, z - 0.06, cor_fn(cc), M, e, lados=8, r1=0.035)


def vasinho(c, x, y, z, folha='#4f9140'):
    o = c.novo_obj()
    c.cilindro(x, y, 0.035, z, z + 0.07, cor_fn('#b8623c'), M, o, lados=14, r1=0.045, tampa_mat=cor_fn('#4a3424'))
    for i in range(5):
        f = c.novo_obj()
        ang = i * 2.4
        c.elipsoide((x + 0.022 * math.cos(ang), y + 0.022 * math.sin(ang), z + 0.1 + 0.015 * (i % 2)), (0.025, 0.025, 0.035), cor_fn(folha if i % 2 else '#6bb556'), f)
    return (x - 0.045, x + 0.045, y - 0.045, y + 0.045)


def lenha(c, x0, y0, comp=0.9, prof=0.4, camadas=4):
    """A pilha de lenha encostada na parede do fundo: toras deitadas ao longo de x, a ponta clara."""
    for k in range(camadas):
        n = 4 - (k % 2)
        for i in range(n):
            o = c.novo_obj()
            r = 0.055 + 0.01 * ruido(i, k)
            yc = y0 + 0.06 + (i + (0.5 if k % 2 else 0)) * (prof - 0.12) / 3
            zc = 0.06 + k * 0.1
            x1 = x0 + comp - 0.03 * ruido(k, i, 2)
            def casca(L, n_, P, r=r):
                zz = L[:, 0]
                k_ = suave(L[:, 0] * 3, L[:, 2] + L[:, 1], 0.03, 7)
                return np.where((k_ > 0.55)[:, None], hexa('#5e4330')[None, :], hexa('#7a5a3e')[None, :])
            # a tora: um prisma de 8 lados ao longo de x
            L_ = 8
            for j in range(L_):
                a0, a1 = 2 * math.pi * j / L_, 2 * math.pi * (j + 1) / L_
                am = (a0 + a1) / 2
                pts = [(x0, yc + r * math.cos(a0), zc + r * math.sin(a0)), (x1, yc + r * math.cos(a0), zc + r * math.sin(a0)),
                       (x1, yc + r * math.cos(a1), zc + r * math.sin(a1)), (x0, yc + r * math.cos(a1), zc + r * math.sin(a1))]
                c.face_plana(pts, (0, math.cos(am), math.sin(am)), casca, M, o)
            ponta = [(x1, yc + r * math.cos(2 * math.pi * j / 12), zc + r * math.sin(2 * math.pi * j / 12)) for j in range(12)]
            def anel(L, n_, P, yc=yc, zc=zc, r=r):
                d = np.hypot(L[:, 1] - yc, L[:, 2] - zc)
                base = np.where((((d / r) * 3) % 1 < 0.35)[:, None], hexa('#c9a06a')[None, :], hexa('#e0bd86')[None, :])
                return np.where((d > r * 0.85)[:, None], hexa('#5e4330')[None, :], base)
            c.face_plana(ponta, (1, 0, 0), anel, M, o)
    return (x0, x0 + comp, y0, y0 + prof)


def tapete_trancado(c, xc, yc, rx, ry):
    """O tapete oval trançado: anéis de cores (chão, sem contorno)."""
    o = c.novo_obj(1, contorno=False)
    cores = ['#9a4a3a', '#c9a062', '#4f6a7a', '#b8784a', '#e0cfa8', '#7a3a32']
    def mat(L, n, P):
        d = np.sqrt(((L[:, 0] - xc) / rx) ** 2 + ((L[:, 1] - yc) / ry) ** 2)
        i = np.floor(d * 7).astype(int)
        base = np.array([hexa(cores[k % len(cores)]) for k in range(8)])[np.clip(i, 0, 7)]
        # a trança: um pontilhado ao longo de cada anel
        ang = np.arctan2((L[:, 1] - yc) / ry, (L[:, 0] - xc) / rx)
        tr = ((ang * 30 + i * 0.5) % 1) < 0.4
        return np.where(tr[:, None], base * 0.86, base)
    pts = [(xc + rx * math.cos(2 * math.pi * k / 40), yc + ry * math.sin(2 * math.pi * k / 40), 0.006) for k in range(40)]
    c.face_plana(pts, (0, 0, 1), mat, M, o)


def gato(c, x, y):
    """O gato laranja dormindo enrolado: o corpo comprido, a cabeça deitada na frente, as orelhas, o rabo em volta."""
    t = TEMPO['t'] * 2 * math.pi
    resp = 1 + 0.05 * math.sin(t * 2)
    def pelo(L, n, P):
        # listras finas atravessando o corpo; a barriga e o focinho mais claros
        lst = np.sin(P[:, 0] * 55 + P[:, 1] * 20) > 0.55
        base = np.where(lst[:, None], hexa('#cf7432')[None, :], hexa('#eea25a')[None, :])
        return np.where((n[:, 2] < -0.2)[:, None] if n.ndim == 2 else False, hexa('#f6dcb6')[None, :], base)
    o = c.novo_obj()
    # o corpo
    c.elipsoide((x, y, 0.075 * resp), (0.2, 0.12, 0.075 * resp), pelo, o, corte_z=0.006)
    # o rabo enrolado na frente do corpo
    for i in range(9):
        a = math.pi * 0.15 + i * 0.13
        c.elipsoide((x - 0.02 + 0.2 * math.cos(a + math.pi * 0.35), y + 0.13 * math.sin(a + math.pi * 0.35) + 0.02, 0.03),
                    (0.03, 0.03, 0.026), pelo, o)
    # a cabeça deitada na ponta da frente, virada para a câmera
    hx, hy, hz = x + 0.17, y + 0.06, 0.07
    c.elipsoide((hx, hy, hz), (0.075, 0.08, 0.065), pelo, o)
    # o focinho claro e as orelhas
    c.elipsoide((hx + 0.04, hy + 0.05, hz - 0.012), (0.03, 0.03, 0.022), lambda L, n, P: np.tile(hexa('#f6dcb6'), (len(L), 1)), o)
    for dy in (-0.04, 0.035):
        c.face_plana([(hx - 0.01, hy + dy - 0.03, hz + 0.045), (hx + 0.02, hy + dy + 0.025, hz + 0.045), (hx + 0.01, hy + dy, hz + 0.11)],
                     (0.6, 0.6, 0.4), lambda L, n, P: np.tile(hexa('#cf7432'), (len(L), 1)), M, o, dois_lados=True)
    # os olhos fechados (dois tracinhos escuros)
    for dy in (-0.022, 0.028):
        c.caixa((hx + 0.055, hx + 0.06, hy + dy + 0.02, hy + dy + 0.045, hz + 0.012, hz + 0.017), {'*': cor_fn('#5a3020')}, M, o, ch=0.0)
    return (x - 0.2, x + 0.25, y - 0.12, y + 0.16)


def vassoura(c, x, y):
    """A vassoura de palha encostada no canto (parede do fundo)."""
    o = c.novo_obj()
    # o cabo, inclinado contra a parede
    c.face_plana([(x - 0.012, y, 0.3), (x + 0.012, y, 0.3), (x + 0.012, 0.02, 1.45), (x - 0.012, 0.02, 1.45)], (0, 1, 0.2), cor_fn('#b98a52'), M, o, dois_lados=True)
    def palha(L, n, P):
        a, b = coord_face(L, n)
        return np.where(((a * 90).astype(int) % 2 == 0)[:, None], hexa('#d8b45a')[None, :], hexa('#b8913c')[None, :])
    c.face_plana([(x - 0.06, y + 0.04, 0.0), (x + 0.06, y + 0.04, 0.0), (x + 0.03, y, 0.32), (x - 0.03, y, 0.32)], (0, 1, 0.15), palha, M, o, dois_lados=True)
    c.caixa((x - 0.035, x + 0.035, y - 0.005, y + 0.015, 0.28, 0.33), {'*': cor_fn('#8a3a2a')}, M, o)


def saco_batatas(c, x, y):
    o = c.novo_obj()
    def juta(L, n, P):
        a, b = P[:, 0] + P[:, 1], P[:, 2]
        g = ((a / 0.018) % 1 < 0.5) ^ ((b / 0.018) % 1 < 0.5)
        return np.where(g[:, None], hexa('#b89566')[None, :], hexa('#a38257')[None, :])
    c.elipsoide((x, y, 0.16), (0.2, 0.18, 0.2), juta, o, corte_z=0.0)
    # a boca aberta dobrada e as batatas
    c.cilindro(x, y, 0.15, 0.3, 0.34, juta, M, o, lados=18, tampa_mat=cor_fn('#4a3424'))
    for i in range(5):
        b_ = c.novo_obj()
        ang = i * 2.4
        c.elipsoide((x + 0.07 * math.cos(ang), y + 0.07 * math.sin(ang), 0.35), (0.04, 0.032, 0.03), cor_fn('#b98a52'), b_)
    # umas batatas caídas no chão
    for dx, dy in ((0.24, 0.1), (0.2, 0.2)):
        b_ = c.novo_obj()
        c.elipsoide((x + dx, y + dy, 0.03), (0.04, 0.032, 0.03), cor_fn('#b98a52'), b_)
    return (x - 0.2, x + 0.2, y - 0.18, y + 0.18)


def capacho(c, x0, x1, y0, y1):
    o = c.novo_obj(1, contorno=False)
    def mat(L, n, P):
        a, b = L[:, 0], L[:, 1]
        base = np.where((((a + b) / 0.03) % 1 < 0.5)[:, None], hexa('#8a6a3e')[None, :], hexa('#a07c48')[None, :])
        borda = (a < x0 + 0.04) | (a > x1 - 0.04) | (b < y0 + 0.04) | (b > y1 - 0.04)
        return np.where(borda[:, None], hexa('#5e4630')[None, :], base)
    c.caixa((x0, x1, y0, y1, 0, 0.012), {'cima': mat, '*': cor_fn('#5e4630')}, M, o)


def calendario(c, y, z):
    o = c.novo_obj()
    def folha(L, n, P):
        yy, zz = L[:, 1], L[:, 2]
        cor = np.tile(hexa('#efe6cf'), (len(L), 1))
        # a gravura em cima e a grade dos dias embaixo
        img = zz > z + 0.17
        cor = np.where(img[:, None], np.where((suave(yy, zz, 0.03, 9) > 0.5)[:, None], hexa('#7a9a5a')[None, :], hexa('#a8c27a')[None, :]), cor)
        grade = (zz < z + 0.15) & (zz > z + 0.03) & ((((yy - y) / 0.04) % 1 < 0.25) | (((zz - z) / 0.03) % 1 < 0.25))
        cor = np.where(grade[:, None], hexa('#9a8f7a')[None, :], cor)
        topo = zz > z + 0.31
        return np.where(topo[:, None], hexa('#b23f36')[None, :], cor)
    c.caixa((0.0, 0.012, y - 0.15, y + 0.15, z, z + 0.34), {'dir': folha, '*': cor_fn('#d8cdb4')}, M, o)
    c.caixa((0.0, 0.02, y - 0.01, y + 0.01, z + 0.34, z + 0.37), {'*': cor_fn('#2a2523')}, M, o)
