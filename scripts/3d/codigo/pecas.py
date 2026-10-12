"""As outras peças da cozinha (cada uma recebe a cena, a peça posta e devolve o retângulo que ocupa no chão)."""
import math
import numpy as np
from motor import Peca, MUNDO, CASA, hexa, ruido, suave, emissivo, TEMPO
from materiais import *

CREME = '#e6d9b8'
CREME_ESC = '#bfae86'
CREME_TOPO = '#efe5c9'


def chama(L, n, P):
    a, b = coord_face(L, n)
    k = suave(a + TEMPO['t'] * 0.3, b, 0.03, 4) * 0.6 + suave(a - TEMPO['t'] * 0.2, b, 0.02, 5) * 0.4
    return np.where((k > 0.5)[:, None], hexa('#ffd257')[None, :], hexa('#f0782a')[None, :])
chama = emissivo(chama)


def fogao(c, p, aceso=True):
    o = c.novo_obj()
    Wm, dm = p.Wm, 0.68
    def reboco(L, n, P):
        a, b = coord_face(L, n)
        cor = np.tile(hexa('#e6dcc6'), (len(L), 1))
        # o reboco caiu em umas partes e mostra o tijolo
        m = suave(a, b, 0.07, 31) * 0.5 + suave(a, b, 0.25, 33) * 0.5
        tij = (m > 0.76) & ((b < 0.3) | (a > 1.25) | (a < 0.1))
        ia = np.floor((a + np.floor(b / 0.06) % 2 * 0.06) / 0.12)
        ib = np.floor(b / 0.06)
        tc = hexa('#b4694a')[None, :] * (1 + (ruido(ia, ib, 3)[:, None] - 0.5) * 0.18)
        jun = (((a + np.floor(b / 0.06) % 2 * 0.06) / 0.12) % 1 < 0.12) | ((b / 0.06) % 1 < 0.18)
        tc = np.where(jun[:, None], hexa('#8e5a43')[None, :], tc)
        cor = np.where(tij[:, None], tc, cor)
        cor = np.where(((m > 0.73) & ~tij & ((b < 0.33) | (a > 1.22) | (a < 0.13)))[:, None], cor * 0.9, cor)
        # fuligem perto da boca do fogo
        return cor
    ferro = liso('#383331')
    # a base de tijolo rebocado
    frente = com_detalhe(reboco,
        # a porta da fornalha (ferro) com a fresta acesa
        (regiao(0.12, 0.58, 0.34, 0.70), '#4a4340'),
        (regiao(0.14, 0.56, 0.36, 0.68), '#2f2a28'),
        (regiao(0.17, 0.53, 0.60, 0.63), chama if aceso else '#3a3230'),
        (linha_h(0.52, 0.012, 0.14, 0.56), '#4a4340'),
        (regiao(0.30, 0.40, 0.44, 0.47), '#6d6360'),
        # a porta do cinzeiro
        (regiao(0.18, 0.52, 0.10, 0.28), '#2f2a28'),
        (linha_h(0.19, 0.012, 0.18, 0.52), '#4d4542'),
        # o forno
        (regiao(0.68, Wm - 0.12, 0.22, 0.72), '#4a4340'),
        (regiao(0.70, Wm - 0.14, 0.24, 0.70), '#312c2a'),
        (regiao(0.74, Wm - 0.18, 0.28, 0.66), '#3d3735'),
        (regiao(0.95, Wm - 0.39, 0.60, 0.63), '#8a7f78'),
        # a fuligem em cima da fornalha
        (lambda L, n: (lambda a, b: (b > 0.68) & (b < 0.80) & (a > 0.12) & (a < 0.6) & (suave(a, b, 0.04, 8) > 0.45))(*coord_face(L, n)), 0.7),
    )
    c.caixa((0, Wm, 0, dm, 0, 0.8), {'frente': frente, 'dir': reboco, 'esq': reboco, 'cima': reboco}, p, o)
    # a chapa de ferro com as bocas
    def chapa(L, n, P):
        u, v = L[:, 0], L[:, 1]
        cor = np.tile(hexa('#2c2826'), (len(L), 1))
        for cu in (0.38, 0.85):
            d = np.hypot(u - cu, (v - 0.34))
            for r, cc in ((0.16, '#4a4340'), (0.12, '#2c2826'), (0.09, '#433c39'), (0.05, '#2c2826')):
                anel = np.abs(d - r) < 0.012
                cor = np.where(anel[:, None], hexa(cc)[None, :], cor)
        # brilho na borda da frente
        cor = np.where((v > dm - 0.015)[:, None], hexa('#5d5552')[None, :], cor)
        return cor
    c.caixa((-0.03, Wm + 0.03, -0.0, dm + 0.03, 0.8, 0.86), {'cima': chapa, '*': liso('#4a4340')}, p, o)
    # a barra de pano na frente
    c.caixa((0.1, Wm - 0.1, dm + 0.03, dm + 0.05, 0.74, 0.76), {'*': liso('#b8954a')}, p, o)
    c.caixa((0.25, 0.55, dm + 0.035, dm + 0.05, 0.56, 0.75), {'*': liso('#e7dfcf'), 'frente': com_detalhe(liso('#e7dfcf'), (linha_h(0.62, 0.02), '#b54a3c'))}, p, o)
    # a chaminé (cano de ferro) subindo pela parede, e a panela
    ch = c.novo_obj()
    c.cilindro(Wm - 0.22, 0.14, 0.075, 0.86, 2.7, liso('#3b3533'), p, ch, lados=18, tampa=False)
    c.cilindro(Wm - 0.22, 0.14, 0.09, 1.55, 1.6, liso('#2c2826'), p, ch, lados=18)
    pan = c.novo_obj()
    c.cilindro(0.38, 0.34, 0.13, 0.86, 1.0, liso('#5a5552'), p, pan, lados=22, tampa_mat=liso('#3a3533'))
    c.caixa((0.36, 0.40, 0.32, 0.36, 1.0, 1.03), {'*': liso('#2a2523')}, p, pan)
    return (0, Wm, 0, dm)


def pia(c, p):
    o = c.novo_obj()
    Wm, dm = p.Wm, 0.6
    # a cortina xadrez vermelho e branco, com as pregas
    def cortina(L, n, P):
        a, b = coord_face(L, n)
        q = 0.045
        ia, ib = np.floor(a / q), np.floor(b / q)
        v1, v2 = ia % 2 == 0, ib % 2 == 0
        base = np.where((v1 & v2)[:, None], hexa('#b23f36')[None, :],
               np.where((v1 ^ v2)[:, None], hexa('#d98a7c')[None, :], hexa('#f0e4d2')[None, :]))
        prega = 0.86 + 0.14 * np.abs(np.sin(a / 0.07 * math.pi))
        return base * prega[:, None]
    madeira = liso('#7a5638')
    c.caixa((0, Wm, 0, dm, 0, 0.86), {'frente': com_detalhe(cortina, (regiao(-1, 99, 0.8, 0.86), '#c9b994'), (regiao(-1, 99, 0, 0.05), '#6b4a31')),
                                      'dir': madeira, 'esq': madeira, 'cima': madeira}, p, o)
    # o tampo de pedra com a cuba
    def tampo(L, n, P):
        u, v = L[:, 0], L[:, 1]
        cor = np.tile(hexa('#d3cab6'), (len(L), 1))
        k = suave(u, v, 0.05, 41)
        cor = np.where((k > 0.7)[:, None], cor * 0.94, cor)
        cuba = (u > 0.42) & (u < Wm - 0.42) & (v > 0.12) & (v < dm - 0.1)
        cor = np.where(cuba[:, None], hexa('#9c9586')[None, :], cor)
        sombra = cuba & ((v < 0.17) | (u < 0.47))
        cor = np.where(sombra[:, None], hexa('#7b7466')[None, :], cor)
        ralo = np.hypot(u - Wm / 2, v - 0.38) < 0.022
        cor = np.where(ralo[:, None], hexa('#3e3a35')[None, :], cor)
        return cor
    c.caixa((-0.02, Wm + 0.02, 0, dm + 0.02, 0.86, 0.92), {'cima': tampo, '*': liso('#b9b09c')}, p, o)
    # a torneira
    t = c.novo_obj()
    c.cilindro(Wm / 2, 0.07, 0.022, 0.92, 1.12, liso('#c79a45'), p, t, lados=12)
    c.caixa((Wm / 2 - 0.018, Wm / 2 + 0.018, 0.05, 0.22, 1.09, 1.125), {'*': liso('#c79a45')}, p, t)
    c.caixa((Wm / 2 - 0.06, Wm / 2 + 0.06, 0.05, 0.085, 1.06, 1.08), {'*': liso('#a8823b')}, p, t)
    return (0, Wm, 0, dm)


def mesa(c, p):
    o = c.novo_obj()
    Wm, Dm = p.Wm, p.Dm
    tab = tabuas('#a2703f', larg=0.25, eixo='b', var=0.08, seed=5)
    def tampo(L, n, P):
        cor = tab(L, n, P)
        u, v = L[:, 0], L[:, 1]
        # nós e manchas na madeira
        k = suave(u, v, 0.12, 12)
        cor = np.where((k > 0.8)[:, None], cor * 0.95, cor)
        # os nós: elipses alongadas na direção da tábua, com o anel mais escuro
        for kx, ky in ((0.55, 0.37), (1.6, 0.9), (1.1, 1.2), (1.9, 0.2)):
            dn = np.hypot((u - kx) / 0.035, (v - ky) / 0.018)
            cor = np.where((dn < 1)[:, None], cor * np.where((dn < 0.55)[:, None], 0.72, 0.84), cor)
        # os pregos redondos nas pontas das tábuas
        for uu in (0.1, Wm - 0.1):
            pr = np.hypot(u - uu, ((v / 0.25) % 1 - 0.5) * 0.25) < 0.009
            cor = np.where(pr[:, None], hexa('#3a332e')[None, :], cor)
        return cor
    lado = tabuas('#7d5330', larg=0.06, eixo='b', var=0.04, veio=False, junta_escura=0.85, seed=6)
    # o tampo grosso (7 cm) e só as quatro pernas nas quinas: nada embaixo, para a cadeira entrar livre por baixo
    c.caixa((0, Wm, 0, Dm, 0.71, 0.78), {'cima': tampo, '*': lado}, p, o)
    pernas = liso('#7a4f2d')
    ins, lp = 0.05, 0.09
    for uu in (ins, Wm - ins - lp):
        for vv in (ins, Dm - ins - lp):
            c.caixa((uu, uu + lp, vv, vv + lp, 0, 0.71), {'*': pernas}, p, o)
    return (0, Wm, 0, Dm)


def cadeira(c, p, recua=0.0):
    """Cadeira de ripas: a frente para +v (a mesa); recua: quanto o assento entra para a frente da casa (metros)."""
    o = c.novo_obj()
    m = liso(CADEIRA_COR)
    esc = liso('#6c4426')
    s = 0.43
    u0 = (p.Wm - s) / 2
    v0 = (p.Dm - s) / 2 + recua
    hs = 0.46
    # as pernas
    for uu in (u0 + 0.01, u0 + s - 0.045):
        for vv in (v0 + 0.01, v0 + s - 0.045):
            alto = 0.95 if vv < v0 + 0.1 else hs
            c.caixa((uu, uu + 0.035, vv, vv + 0.035, 0, alto), {'*': m}, p, o)
    # as travessas baixas
    c.caixa((u0 + 0.03, u0 + s - 0.03, v0 + 0.015, v0 + 0.04, 0.16, 0.19), {'*': esc}, p, o)
    c.caixa((u0 + 0.015, u0 + 0.04, v0 + 0.03, v0 + s - 0.03, 0.12, 0.15), {'*': esc}, p, o)
    c.caixa((u0 + s - 0.04, u0 + s - 0.015, v0 + 0.03, v0 + s - 0.03, 0.12, 0.15), {'*': esc}, p, o)
    # o assento de tábuas
    ass = tabuas('#9a663b', larg=0.085, eixo='a', var=0.07, veio=False, seed=8)
    c.caixa((u0, u0 + s, v0, v0 + s, hs - 0.035, hs), {'cima': ass, '*': liso('#7a4f2d')}, p, o)
    # o encosto: travessa de cima, a do meio e as ripas
    c.caixa((u0 + 0.01, u0 + s - 0.01, v0 + 0.008, v0 + 0.04, 0.86, 0.93), {'*': m}, p, o)
    c.caixa((u0 + 0.01, u0 + s - 0.01, v0 + 0.01, v0 + 0.035, 0.62, 0.66), {'*': esc}, p, o)
    for i in range(3):
        uu = u0 + 0.1 + i * 0.1
        c.caixa((uu, uu + 0.035, v0 + 0.012, v0 + 0.033, 0.66, 0.86), {'*': m}, p, o)
    return (u0, u0 + s, v0, v0 + s)


CADEIRA_COR = '#8e5c34'


def caixote(c, p):
    o = c.novo_obj()
    a = 0.6
    alt = 0.8
    u0, v0 = (p.Wm - a) / 2, (p.Dm - a) / 2
    tab = tabuas('#a87645', larg=0.1, eixo='b', var=0.09, seed=17)
    def lado(L, n, P):
        cor = tab(L, n, P)
        aa, b = coord_face(L, n)
        rel = aa - (u0 if abs(n[1]) >= abs(n[0]) else v0)
        moldura = (rel < 0.06) | (rel > a - 0.06) | (b < 0.06) | (b > alt - 0.06) | (np.abs(b - alt / 2) < 0.03)
        diag = np.abs((rel / a) - ((b % (alt / 2)) / (alt / 2))) < 0.07
        cor = np.where((moldura | diag)[:, None], hexa('#8a5c33')[None, :], cor)
        canto = ((rel < 0.05) | (rel > a - 0.05)) & ((b < 0.05) | (b > alt - 0.05))
        cor = np.where(canto[:, None], hexa('#4a4542')[None, :], cor)
        return cor
    c.caixa((u0, u0 + a, v0, v0 + a, 0, alt), {'*': lado, 'cima': tabuas('#b07d4b', larg=0.1, eixo='a', var=0.09, seed=18)}, p, o)
    return (u0, u0 + a, v0, v0 + a)


def barril(c, p):
    o = c.novo_obj()
    r, h = 0.29, 1.0
    cu, cv = p.Wm / 2, p.Dm / 2
    def aduelas(L, n, P):
        ang = np.arctan2(L[:, 1] - cv, L[:, 0] - cu)
        i = np.floor(ang / (2 * math.pi / 16))
        cor = hexa('#9a643a')[None, :] * (1 + (ruido(i, 4)[:, None] - 0.5) * 0.16)
        jun = ((ang / (2 * math.pi / 16)) % 1) < 0.12
        cor = np.where(jun[:, None], cor * 0.78, cor)
        z = L[:, 2]
        aro = (np.abs(z - 0.14) < 0.03) | (np.abs(z - h + 0.14) < 0.03) | (np.abs(z - h * 0.38) < 0.02) | (np.abs(z - h * 0.62) < 0.02)
        cor = np.where(aro[:, None], hexa('#3c3735')[None, :], cor)
        return cor
    def tampa(L, n, P):
        d = np.hypot(L[:, 0] - cu, L[:, 1] - cv)
        cor = tabuas('#a87244', larg=0.09, eixo='a', var=0.07, veio=False, seed=2)(L, n, P)
        cor = np.where((d > r - 0.03)[:, None], hexa('#7a4d2c')[None, :], cor)
        return cor
    # a barriga: dois troncos de cone
    c.cilindro(cu, cv, r * 0.9, 0, h / 2, aduelas, p, o, lados=26, tampa=False, r1=r)
    c.cilindro(cu, cv, r, h / 2, h, aduelas, p, o, lados=26, r1=r * 0.9, tampa_mat=tampa)
    return (cu - r, cu + r, cv - r, cv + r)


def caneca(c, p, du=0.0, dv=0.0, z=0.78):
    o = c.novo_obj()
    cu, cv = p.Wm / 2 + du, p.Dm / 2 + dv
    c.cilindro(cu, cv, 0.06, z, z + 0.12, liso('#e6e0d2'), p, o, lados=16, tampa_mat=liso('#5b3a24'))
    c.caixa((cu + 0.055, cu + 0.09, cv - 0.01, cv + 0.01, z + 0.03, z + 0.095), {'*': liso('#e6e0d2')}, p, o)


def planta(c, p):
    o = c.novo_obj()
    cu, cv = p.Wm / 2, p.Dm / 2
    def vaso(L, n, P):
        z = L[:, 2]
        cor = np.tile(hexa('#b8623c'), (len(L), 1))
        cor = np.where((z > 0.27)[:, None], hexa('#c97a4f')[None, :], cor)
        return cor
    c.cilindro(cu, cv, 0.15, 0, 0.27, vaso, p, o, lados=20, r1=0.19, tampa=False)
    c.cilindro(cu, cv, 0.2, 0.27, 0.33, vaso, p, o, lados=20, tampa_mat=liso('#4a3424'))
    folhas = c.novo_obj()
    verdes = ['#3f7a35', '#4f9140', '#5ea84c', '#367030', '#6bb556']
    for i in range(26):
        ang = i * 2.399 + 0.3
        incl = 0.25 + 0.75 * ruido(i, 1)
        comp = 0.3 + 0.22 * ruido(i, 2)
        larg = 0.075 + 0.05 * ruido(i, 3)
        b = np.array([cu, cv, 0.32])
        a = np.array([math.cos(ang) * math.cos(incl), math.sin(ang) * math.cos(incl), math.sin(incl)]) * comp
        pp = np.array([-math.sin(ang), math.cos(ang), 0]) * larg
        nn = np.cross(a, pp)
        nn = nn / np.linalg.norm(nn)
        if nn[2] < 0:
            nn = -nn
        cor = verdes[i % len(verdes)]
        def folha(L, n, P, cor=cor, b=b, a=a):
            t = ((L - b) @ a) / (a @ a)
            base = hexa(cor)[None, :] * np.ones((len(L), 1))
            veia = np.abs(((L - b) @ np.cross(a, [0, 0, 1])) / (np.linalg.norm(np.cross(a, [0, 0, 1])) + 1e-9)) < 0.008
            return np.where(veia[:, None], base * 1.18, base)
        pts = [b, b + 0.45 * a + pp, b + a, b + 0.45 * a - pp]
        c.face_plana([tuple(x) for x in pts], tuple(nn), folha, p, folhas, dois_lados=True)
    return (cu - 0.2, cu + 0.2, cv - 0.2, cv + 0.2)


def lampada(c, x, y, z_fio=2.7, z_cupula=1.95):
    """Lâmpada pendurada no teto no meio da casa (x, y)."""
    p = Peca(x, y, 4, 1, 1)
    cu, cv = CASA / 2, CASA / 2
    o = c.novo_obj(sombra=False)
    c.caixa((cu - 0.008, cu + 0.008, cv - 0.008, cv + 0.008, z_cupula + 0.12, z_fio), {'*': liso('#2a2523')}, p, o)
    def cupula(L, n, P):
        z = L[:, 2]
        cor = np.tile(hexa('#3e6b52'), (len(L), 1))
        return np.where((z < z_cupula + 0.012)[:, None], hexa('#c9a24a')[None, :], cor)
    c.cilindro(cu, cv, 0.2, z_cupula, z_cupula + 0.12, cupula, p, o, lados=24, r1=0.05, tampa_mat=liso('#c9a24a'))
    c.cilindro(cu, cv, 0.035, z_cupula + 0.12, z_cupula + 0.16, liso('#c9a24a'), p, o, lados=12)
    lp = c.novo_obj(contorno=False, sombra=False)
    luzm = emissivo(lambda L, n, P: np.tile(hexa('#fff2c2'), (len(L), 1)))
    c.cilindro(cu, cv, 0.06, z_cupula - 0.04, z_cupula + 0.005, luzm, p, lp, lados=12, tampa=False)
    return (x * CASA + cu, y * CASA + cv, z_cupula - 0.05)


def armario_cozinha(c, p):
    """O armário de cozinha (2 x 1): embaixo fechado, a cristaleira de vidro em cima com os pratos em pé."""
    o = c.novo_obj()
    Wm = p.Wm
    dm = 0.5
    madeira = liso(CREME)
    # desgaste: umas lascas mais escuras nas bordas
    def gasto(base):
        def f(L, n, P):
            cor = base(L, n, P)
            a, b = coord_face(L, n)
            k = ruido(np.floor(a / 0.035), np.floor(b / 0.035), 21)
            m = suave(a, b, 0.06, 21)
            return np.where((m > 0.86)[:, None], cor * 0.93, cor)
        return f
    c.caixa((0.05, Wm - 0.05, 0.03, dm - 0.05, 0, 0.08), {'*': liso(CREME_ESC)}, p, o)
    portas = [(0.07, Wm / 2 - 0.03), (Wm / 2 + 0.03, Wm - 0.07)]
    camadas = []
    for a0, a1 in portas:
        d_, s_, l_ = painel(a0 + 0.05, a1 - 0.05, 0.17, 0.78, 0.022)
        camadas += [(linha_v(a0, 0.014, 0.12, 0.84), 0.75), (linha_v(a1, 0.014, 0.12, 0.84), 0.75),
                    (linha_h(0.12, 0.014, a0, a1), 0.75), (linha_h(0.84, 0.014, a0, a1), 0.75),
                    (s_, 0.86), (l_, 1.05)]
    frente_baixo = gasto(com_detalhe(madeira, *camadas))
    c.caixa((0, Wm, 0, dm, 0.08, 0.88), {'frente': frente_baixo, 'dir': gasto(madeira), 'esq': madeira, 'cima': madeira}, p, o)
    # puxadores
    for a0, a1 in portas:
        ax = a1 - 0.06 if a0 < Wm / 2 else a0 + 0.06
        c.caixa((ax - 0.015, ax + 0.015, dm, dm + 0.025, 0.66, 0.70), {'*': liso('#4a3a2c')}, p, o)
    # o tampo
    c.caixa((-0.02, Wm + 0.02, 0, dm + 0.03, 0.88, 0.93), {'*': liso(CREME_TOPO), 'frente': liso(CREME_ESC), 'dir': liso(CREME_ESC)}, p, o)
    # a cristaleira
    dc = 0.32
    def vidro(L, n, P):
        a, b = coord_face(L, n)
        cor = np.tile(hexa('#33403d'), (len(L), 1))
        # prateleiras
        for zp in (1.22, 1.52):
            cor = np.where((np.abs(b - zp) < 0.013)[:, None], hexa('#c8b991')[None, :], cor)
        # pratos em pé (elipses claras) e xícaras
        for i in range(9):
            ac = 0.12 + i * (Wm - 0.24) / 8
            for zp, r in ((1.22, 0.085), (1.52, 0.075)):
                if ruido(i, zp * 10, 2) < 0.25:
                    continue
                dd = ((a - ac) / (r * 0.75)) ** 2 + ((b - (zp + r + 0.01)) / r) ** 2
                prato = dd < 1
                cor = np.where(prato[:, None], hexa('#ece7da')[None, :] * np.where((dd > 0.55)[:, None], 0.9, 1.0), cor)
        for i in range(5):
            ac = 0.2 + i * 0.27
            xic = (np.abs(a - ac) < 0.035) & (b > 1.62) & (b < 1.69)
            cor = np.where(xic[:, None], hexa('#d9d2c2')[None, :], cor)
        # reflexo diagonal no vidro
        refl = (np.abs(((a * 1.2 + b) % 0.6) - 0.1) < 0.03)
        cor = np.where(refl[:, None], cor * 1.35 + 18, cor)
        return cor
    vidro = emissivo(vidro) if False else vidro
    caixilho = []
    for a0, a1 in portas:
        caixilho += [(regiao(a0 + 0.035, a1 - 0.035, 1.0, 1.79), vidro)]
        caixilho += [(linha_v(a0, 0.014, 0.95, 1.84), 0.75), (linha_v(a1, 0.014, 0.95, 1.84), 0.75)]
    c.caixa((0.04, Wm - 0.04, 0, dc, 0.93, 1.86), {'frente': gasto(com_detalhe(madeira, *caixilho)), 'dir': gasto(madeira), 'esq': madeira}, p, o)
    for a0, a1 in portas:
        ax = a1 - 0.05 if a0 < Wm / 2 else a0 + 0.05
        c.caixa((ax - 0.012, ax + 0.012, dc, dc + 0.02, 1.36, 1.40), {'*': liso('#4a3a2c')}, p, o)
    # a cornija
    c.caixa((0.0, Wm, 0, dc + 0.04, 1.86, 1.93), {'*': liso(CREME_TOPO), 'frente': liso(CREME_ESC), 'dir': liso(CREME_ESC)}, p, o)
    return (0, Wm, 0, dm)
