"""A Cozinha do casarão (Fazenda Olhos de Águia), no estilo novo, com os móveis nas casas do jogo (seedFazenda.ts)."""
import math, sys
import numpy as np
from PIL import Image
from motor import Cena, Peca, MUNDO, CASA, KX, KY, KZ, tela, hexa, ruido, emissivo, suave, TEMPO, ESC
from materiais import *
import pecas
import enfeites as E
from pecas import fogao, pia, mesa, cadeira, caixote, barril, caneca, planta, lampada

# ---------- paleta ----------
CREME = '#e6d9b8'
CREME_ESC = '#bfae86'
CREME_TOPO = '#efe5c9'
MADEIRA = '#9a6a3f'
MADEIRA_ESC = '#6e4a2c'
MADEIRA_CLARA = '#b98552'
CADEIRA = '#8b5a33'
FERRO = '#3a3533'
FERRO_CLARO = '#5a5350'
REBOCO = '#e9dfc9'
TIJOLO = '#b56a4b'
PEDRA = '#cfc5b0'
VERDE_PAREDE = '#86a98e'
VERDE_ESC = '#3e6a52'
AZULEJO = '#e9e5d9'
REJUNTE = '#b7b0a1'
PISO = '#ddd2b8'
PISO_REJ = '#a39883'
VIGA = '#6b4a31'

ROOM_W, ROOM_D = 10, 6          # casas (planRight(10, 6, 3))
ALTURA = 2.7                    # metros
ESP = 0.22                      # espessura da parede (metros)


def montar():
    W, D = ROOM_W * CASA, ROOM_D * CASA
    # a tela: a sala inteira com folga
    cantos = np.array([[x, y, z] for x in (-ESP, W) for y in (-ESP, D) for z in (-0.2, ALTURA + 0.1)])
    S = tela(cantos)
    x0, y0 = int(S[:, 0].min()) - 24, int(S[:, 1].min()) - 24
    w, h = int(S[:, 0].max() - x0) + 24, int(S[:, 1].max() - y0) + 24
    c = Cena(x0, y0, w, h)
    ocup = []

    # ---------- a sala ----------
    chao = c.novo_obj(1)
    piso0 = ladrilho(PISO, PISO_REJ, tam=CASA, var=0.035, seed=1)
    def piso(L, n, P):
        cor = piso0(L, n, P)
        u, v = L[:, 0], L[:, 1]
        # o encardido: manchas largas mais escuras, mais forte perto do fogão e da pia (onde se pisa mais)
        m = suave(u, v, 0.4, 51) * 0.7 + suave(u, v, 0.08, 52) * 0.3
        uso = np.clip(1 - np.hypot(u - 2.8, (v - 1.0) * 1.4) / 2.2, 0, 1)
        cor = np.where((m + uso * 0.2 > 0.72)[:, None], cor * 0.94, cor)
        cor = np.where((m + uso * 0.2 > 0.84)[:, None], cor * 0.94, cor)
        # umas trincas finas em alguns ladrilhos
        iu, iv = np.floor(u / CASA), np.floor(v / CASA)
        fu, fv = (u / CASA) % 1, (v / CASA) % 1
        tr = (ruido(iu, iv, 61) > 0.9) & (np.abs(fv - (0.25 + 0.5 * fu)) < 0.008) & (fu > 0.15) & (fu < 0.6)
        return np.where(tr[:, None], cor * 0.86, cor)
    c.caixa((0, W, 0, D, -0.2, 0), {'cima': piso, 'frente': liso('#5c4632'), 'dir': liso('#5c4632')}, MUNDO, chao)

    def parede_mat(L, n, P):
        a, z = coord_face(L, n)
        cor = np.tile(hexa(VERDE_PAREDE), (len(L), 1))
        # a tinta descascando: manchas orgânicas mais claras (o reboco por baixo), com a borda mais escura
        m = suave(a, z, 0.22, 5) * 0.65 + suave(a, z, 0.07, 6) * 0.35
        desc = m > 0.83
        cor = np.where(desc[:, None], hexa('#c4d0bf')[None, :], cor)
        borda_desc = (m > 0.81) & ~desc
        cor = np.where(borda_desc[:, None], cor * 0.86, cor)
        # umas manchas de umidade escuras perto do chão do verde
        um = (suave(a, z, 0.35, 8) > 0.72) & (z < 1.7)
        cor = np.where((um & ~desc)[:, None], cor * 0.93, cor)
        # meia parede de azulejo branco (15 x 15 cm), a faixa verde e o rodapé
        az = z < 1.18
        ia, iz = np.floor(a / 0.15), np.floor(z / 0.15)
        ka = ruido(ia, iz, 3)
        azc = hexa(AZULEJO)[None, :] * (1 + (ka[:, None] - 0.5) * 0.06)
        rej = ((a / 0.15) % 1 < 0.11) | ((z / 0.15) % 1 < 0.11)
        azc = np.where(rej[:, None], hexa(REJUNTE)[None, :], azc)
        trinca = (ruido(ia, iz, 11) > 0.93) & (np.abs(((a / 0.15) % 1) - ((z / 0.15) % 1)) < 0.08)
        azc = np.where(trinca[:, None], azc * 0.8, azc)
        cor = np.where(az[:, None], azc, cor)
        faixa = (z >= 1.04) & (z < 1.18)
        fc = hexa(VERDE_ESC)[None, :] * np.where(((a / 0.15) % 1 < 0.1)[:, None], 0.8, 1.0)
        cor = np.where(faixa[:, None], fc, cor)
        # a parede escurece um pouco embaixo (a luz vem das lâmpadas lá de cima)
        cor = cor * np.clip(0.9 + 0.1 * np.round(z / 0.5) * 0.5, 0.9, 1.0)[:, None]
        # a janela em cima da pia (só na parede do fundo): o vidro claro, o caixilho em cruz e a moldura
        if abs(n[1]) >= abs(n[0]):
            jx0, jx1, jz0, jz1 = 3.25, 4.25, 1.2, 2.15
            jan = (a > jx0) & (a < jx1) & (z > jz0) & (z < jz1)
            ceu = hexa('#f7ebc2')[None, :] * (1 + 0.08 * np.clip((z - jz0) / (jz1 - jz0), 0, 1))[:, None] - np.array([[0, 6, 26]]) * ((z - jz0) / (jz1 - jz0))[:, None]
            # as folhas de fora, borradas, embaixo do vidro
            vento = TEMPO['t'] * 2 * math.pi
            fora = suave(a + 0.025 * np.sin(vento + z * 6), z + 0.012 * np.sin(vento * 2 + a * 8), 0.06, 77) > 0.58
            ceu = np.where((fora & (z < jz0 + 0.35))[:, None], hexa('#a9c27a')[None, :], ceu)
            cruz = (np.abs(a - (jx0 + jx1) / 2) < 0.02) | (np.abs(z - (jz0 + jz1) / 2 - 0.08) < 0.02)
            mold = (a < jx0 + 0.045) | (a > jx1 - 0.045) | (z < jz0 + 0.045) | (z > jz1 - 0.045)
            vid = np.where((cruz | mold)[:, None], hexa('#efe6cf')[None, :], ceu * 1.18)
            # aberta: a folha da direita foi para dentro (some do vão), só a da esquerda tem vidro (com o reflexo)
            meio = (jx0 + jx1) / 2
            refl = (np.abs(((a - z * 0.8) % 0.45) - 0.05) < 0.025) & ~cruz & ~mold & (a < meio)
            vid = np.where(refl[:, None], np.minimum(vid + 20, 255), vid)
            aberta = (a > meio + 0.02) & ~mold
            vid = np.where(aberta[:, None], ceu * 1.25, vid)
            cor = np.where(jan[:, None], vid, cor)
            borda_j = ((a > jx0 - 0.04) & (a < jx1 + 0.04) & (z > jz0 - 0.04) & (z < jz1 + 0.04)) & ~jan
            cor = np.where(borda_j[:, None], hexa('#8a6440')[None, :], cor)
        rod = z < 0.09
        cor = np.where(rod[:, None], hexa('#5a4130')[None, :], cor)
        cor = np.where(((z >= 0.09) & (z < 0.105))[:, None], hexa('#7a5a40')[None, :], cor)
        return cor
    tampa = liso(VIGA)
    lado_parede = liso('#4b382a')
    pa = c.novo_obj(2)
    c.caixa((-ESP, W, -ESP, 0, -0.2, ALTURA), {'frente': parede_mat, 'cima': tampa, 'dir': lado_parede}, MUNDO, pa)
    pb = c.novo_obj(2)
    c.caixa((-ESP, 0, 0, D, -0.2, ALTURA), {'dir': parede_mat, 'cima': tampa, 'frente': lado_parede}, MUNDO, pb)
    # a viga de madeira em volta da borda de cima (como as salas de referência)
    vg = c.novo_obj(2)
    c.caixa((-ESP - 0.03, W + 0.03, -ESP - 0.03, 0.0, ALTURA, ALTURA + 0.08), {'*': liso(VIGA)}, MUNDO, vg)
    c.caixa((-ESP - 0.03, 0.0, 0, D + 0.03, ALTURA, ALTURA + 0.08), {'*': liso(VIGA)}, MUNDO, vg)

    # ---------- os móveis ----------
    def pos(x, y, rot, Wc, Dc):
        return Peca(x, y, rot, Wc, Dc)

    def ocupa(p, u0, u1, v0, v1):
        A = p.mundo(np.array([[u0, v0, 0], [u1, v1, 0]]))
        ocup.append((min(A[:, 0]), max(A[:, 0]), min(A[:, 1]), max(A[:, 1]), 0))

    # armário de cozinha (2 x 1 casas): a parte de baixo fechada e a cristaleira em cima
    def armario(p):
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
        ocupa(p, 0, Wm, 0, dm)

    def armario_L(ate_x, ate_y):
        """
        O armário de canto em L (12/10, o Felipe: dois armários no canto, um com a porta na lateral do outro, não fazia
        sentido). Uma peça só: o braço do fundo (x de 0 a ate_x) e o da esquerda (y de 0 a ate_y), com o tampo, a
        cristaleira e a cornija dobrando o canto; o canto por dentro é cego, as portas ficam só onde abrem.
        """
        o = c.novo_obj()
        dm, dc = 0.5, 0.32
        madeira = liso(CREME)
        def gasto(base):
            def f(L, n, P):
                cor = base(L, n, P)
                a, b = coord_face(L, n)
                m = suave(a, b, 0.06, 21)
                return np.where((m > 0.86)[:, None], cor * 0.93, cor)
            return f
        def portas_de(a0, a1, larg=0.5):
            n = max(1, round((a1 - a0) / larg))
            w = (a1 - a0) / n
            return [(a0 + i * w + 0.02, a0 + (i + 1) * w - 0.02) for i in range(n)]
        def frente_baixo(portas):
            cam = []
            for a0, a1 in portas:
                d_, s_, l_ = painel(a0 + 0.05, a1 - 0.05, 0.17, 0.78, 0.022)
                cam += [(linha_v(a0, 0.014, 0.12, 0.84), 0.75), (linha_v(a1, 0.014, 0.12, 0.84), 0.75),
                        (linha_h(0.12, 0.014, a0, a1), 0.75), (linha_h(0.84, 0.014, a0, a1), 0.75), (s_, 0.86), (l_, 1.05)]
            return gasto(com_detalhe(madeira, *cam))
        def vidro_de(a0r, a1r):
            def vidro(L, n, P):
                a, b = coord_face(L, n)
                cor = np.tile(hexa('#33403d'), (len(L), 1))
                for zp in (1.22, 1.52):
                    cor = np.where((np.abs(b - zp) < 0.013)[:, None], hexa('#c8b991')[None, :], cor)
                k = max(2, int((a1r - a0r) / 0.17))
                for i in range(k):
                    ac = a0r + 0.09 + i * (a1r - a0r - 0.18) / max(1, k - 1)
                    for zp, r in ((1.22, 0.085), (1.52, 0.075)):
                        if ruido(i, zp * 10, a0r * 7) < 0.25:
                            continue
                        dd = ((a - ac) / (r * 0.75)) ** 2 + ((b - (zp + r + 0.01)) / r) ** 2
                        cor = np.where((dd < 1)[:, None], hexa('#ece7da')[None, :] * np.where((dd > 0.55)[:, None], 0.9, 1.0), cor)
                refl = (np.abs(((a * 1.2 + b) % 0.6) - 0.1) < 0.03)
                return np.where(refl[:, None], cor * 1.35 + 18, cor)
            return vidro
        def frente_cima(portas):
            cam = []
            for a0, a1 in portas:
                cam += [(regiao(a0 + 0.035, a1 - 0.035, 1.0, 1.79), vidro_de(a0, a1)),
                        (linha_v(a0, 0.014, 0.95, 1.84), 0.75), (linha_v(a1, 0.014, 0.95, 1.84), 0.75)]
            return gasto(com_detalhe(madeira, *cam))
        topo, borda = liso(CREME_TOPO), liso(CREME_ESC)
        # as portas: no fundo, de x = dm até a ponta; na esquerda, de y = dm até a ponta (o canto é cego)
        pf, pe = portas_de(dm + 0.02, ate_x - 0.04), portas_de(dm + 0.02, ate_y - 0.04)
        pfc, pec = portas_de(dc + 0.02, ate_x - 0.06), portas_de(dc + 0.02, ate_y - 0.06)
        # rodapé, corpo de baixo, tampo
        c.caixa((0, ate_x - 0.04, 0, dm - 0.04, 0, 0.08), {'*': borda}, MUNDO, o)
        c.caixa((0, dm - 0.04, 0, ate_y - 0.04, 0, 0.08), {'*': borda}, MUNDO, o)
        c.caixa((0, ate_x, 0, dm, 0.08, 0.88), {'frente': frente_baixo(pf), 'dir': gasto(madeira), 'cima': madeira}, MUNDO, o)
        c.caixa((0, dm, 0, ate_y, 0.08, 0.88), {'dir': frente_baixo(pe), 'frente': gasto(madeira), 'cima': madeira}, MUNDO, o)
        c.caixa((0, ate_x + 0.02, 0, dm + 0.03, 0.88, 0.93), {'cima': topo, '*': borda}, MUNDO, o)
        c.caixa((0, dm + 0.03, 0, ate_y + 0.02, 0.88, 0.93), {'cima': topo, '*': borda}, MUNDO, o)
        # puxadores
        for a0, a1 in pf:
            ax = (a0 + a1) / 2 + (0.18 if a1 > ate_x - 0.1 else -0.18 if a0 < dm + 0.1 else 0.0)
            c.caixa((ax - 0.015, ax + 0.015, dm, dm + 0.025, 0.66, 0.70), {'*': liso('#4a3a2c')}, MUNDO, o)
        for a0, a1 in pe:
            ay = (a0 + a1) / 2 + (0.18 if a1 > ate_y - 0.1 else -0.18 if a0 < dm + 0.1 else 0.0)
            c.caixa((dm, dm + 0.025, ay - 0.015, ay + 0.015, 0.66, 0.70), {'*': liso('#4a3a2c')}, MUNDO, o)
        # a cristaleira em L e a cornija
        c.caixa((0, ate_x - 0.04, 0, dc, 0.93, 1.86), {'frente': frente_cima(pfc), 'dir': gasto(madeira)}, MUNDO, o)
        c.caixa((0, dc, 0, ate_y - 0.04, 0.93, 1.86), {'dir': frente_cima(pec), 'frente': gasto(madeira)}, MUNDO, o)
        c.caixa((0, ate_x, 0, dc + 0.04, 1.86, 1.93), {'cima': topo, '*': borda}, MUNDO, o)
        c.caixa((0, dc + 0.04, 0, ate_y, 1.86, 1.93), {'cima': topo, '*': borda}, MUNDO, o)
        ocup.append((0, ate_x, 0, dm, 0))
        ocup.append((0, dm, 0, ate_y, 0))

    armario(pos(6, 0, 4, 2, 1))
    armario_L(2 * CASA, 3 * CASA)
    # (seedFazenda.ts, Cozinha) fogão, pia, caixote, barril, mesa e as seis cadeiras
    for f, (x, y, rot, Wc, Dc) in ((fogao, (2, 0, 4, 2, 1)), (pia, (4, 0, 4, 2, 1)), (caixote, (0, 4, 0, 1, 1)),
                                   (barril, (0, 5, 0, 1, 1)), (mesa, (4, 3, 0, 3, 2)), (planta, (9, 5, 0, 1, 1))):
        pp = pos(x, y, rot, Wc, Dc)
        ocupa(pp, *f(c, pp))
    # a mesa de 3 x 2 casas: duas cadeiras em cada lado comprido e uma em cada cabeceira (a da cabeceira no meio do lado)
    LUGARES = ((4, 2, 4), (6, 2, 4), (4, 5, 0), (6, 5, 0), (3, 3.5, 2), (7, 3.5, 6))
    for x, y, rot in LUGARES:
        pp = pos(x, y, rot, 1, 1)
        ocupa(pp, *cadeira(c, pp, recua=0.2))
    luzes = [lampada(c, 4, 2), lampada(c, 8, 2)]

    # ---------- a vida da cozinha ----------
    peq = []  # os objetos pequenos (a sombra no tampo)
    def p_(r, z):
        peq.append((r[0], r[1], r[2], r[3], z))
    # a janela: o peitoril, a cortina de babado e a varinha, e os vasinhos de tempero
    jn = c.novo_obj()
    c.caixa((3.18, 4.32, 0, 0.13, 1.13, 1.2), {'cima': liso('#efe6cf'), '*': liso('#cfc3a6')}, MUNDO, jn)
    c.caixa((3.1, 4.4, 0.0, 0.05, 2.2, 2.23), {'*': liso('#6b4a31')}, MUNDO, jn)
    def cortina_j(L, n, P):
        a, z = L[:, 0], L[:, 2]
        q = 0.04
        v1, v2 = np.floor(a / q) % 2 == 0, np.floor(z / q) % 2 == 0
        base = np.where((v1 & v2)[:, None], hexa('#b23f36')[None, :], np.where((v1 ^ v2)[:, None], hexa('#d98a7c')[None, :], hexa('#f0e4d2')[None, :]))
        return base * (0.86 + 0.14 * np.abs(np.sin(a / 0.05 * math.pi)))[:, None]
    # a cortina em tiras finas: o pé de cada tira vai para dentro com o vento, em onda
    vt = TEMPO['t'] * 2 * math.pi
    for x0_, x1_, fase in ((3.1, 3.4, 0.0), (4.1, 4.4, 1.3)):
        ct = c.novo_obj()
        n_ = 10
        for i in range(n_):
            xa, xb = x0_ + (x1_ - x0_) * i / n_, x0_ + (x1_ - x0_) * (i + 1) / n_
            onda = lambda xx: 0.06 + 0.07 * (0.5 + 0.5 * math.sin(vt + fase + xx * 9)) + 0.015 * math.sin(vt * 2 + xx * 23)
            ya, yb = onda(xa), onda(xb)
            pts = [(xa, 0.055, 2.2), (xb, 0.055, 2.2), (xb, yb, 1.5), (xa, ya, 1.5)]
            c.face_plana(pts, (0, 0.98, 0.15), cortina_j, MUNDO, ct, dois_lados=True)
    bab = c.novo_obj()
    nb = 16
    for i in range(nb):
        xa, xb = 3.1 + 1.3 * i / nb, 3.1 + 1.3 * (i + 1) / nb
        ya = 0.07 + 0.012 * math.sin(vt + xa * 7)
        yb = 0.07 + 0.012 * math.sin(vt + xb * 7)
        c.face_plana([(xa, 0.055, 2.2), (xb, 0.055, 2.2), (xb, yb, 2.04), (xa, ya, 2.04)], (0, 1, 0.1), cortina_j, MUNDO, bab, dois_lados=True)
    for xv, fl in ((3.42, '#4f9140'), (3.75, '#6b8a3a'), (4.08, '#3f7a35')):
        p_(E.vasinho(c, xv, 0.07, 1.2, fl), 1.2)
    # a bancada em L: potes, as colheres, a tábua com o pão, os ovos
    p_(E.pote(c, 0.72, 0.42, 0.93, conteudo='#d9a441'), 0.93)
    p_(E.pote(c, 0.86, 0.42, 0.93, r=0.04, h=0.11, conteudo='#8a3a2a', tampa='#5a3a24'), 0.93)
    p_(E.pote(c, 0.99, 0.43, 0.93, r=0.035, h=0.09, conteudo='#e8e0c8', tampa='#7a5a3a'), 0.93)
    p_(E.colheres(c, 1.3, 0.43, 0.93), 0.93)
    p_(E.tabua_de_corte(c, 0.42, 1.15, 0.93, w=0.34, d=0.15, eixo='y'), 0.93)
    E.pao(c, 0.42, 1.12, 0.955)
    p_(E.ovos(c, 0.42, 1.62, 0.93), 0.93)
    p_(E.pote(c, 0.42, 1.98, 0.93, r=0.05, h=0.15, conteudo='#c9b27a', vidro=True), 0.93)
    # o fogão: a panela já está; a chaleira na outra boca
    p_(E.chaleira(c, 2.35, 0.34, 0.86), 0.86)
    # a pia: a pilha de pratos e o pano
    p_(E.pratos(c, 3.17, 0.33, 0.92), 0.92)
    # a bancada do armário da direita: a fruteira, a jarra e um pote
    p_(E.tigela(c, 4.8, 0.43, 0.93, frutas=((-0.04, -0.02, 'maca'), (0.04, 0.0, 'laranja'), (0.0, 0.04, 'pera'), (0.0, -0.04, 'limao'), (0.02, 0.02, 'maca'))), 0.93)
    p_(E.jarra(c, 5.25, 0.42, 0.93), 0.93)
    p_(E.pote(c, 5.62, 0.42, 0.93, r=0.05, h=0.14, conteudo='#7a9a4a', tampa='#5a3a24'), 0.93)
    # em cima dos armários: cestos e jarros
    p_(E.cesto(c, 0.62, 0.17, 1.93, r=0.15, h=0.14), 1.93)
    p_(E.jarra(c, 0.18, 1.35, 1.93, cor='#8a6a44'), 1.93)
    p_(E.cesto(c, 0.18, 1.85, 1.93, r=0.13, h=0.12, cheio=['#c8392e', '#e88a2a']), 1.93)
    p_(E.cesto(c, 5.0, 0.17, 1.93, r=0.15, h=0.16), 1.93)
    p_(E.pote(c, 5.6, 0.17, 1.93, r=0.06, h=0.18, conteudo='#b5683e', vidro=False, rotulo=False), 1.93)
    # a mesa posta: o caminho xadrez, o pão, a fruteira, a vela e os pratos
    TZ = 0.78
    E.toalha_mesa(c, 3.45, 4.85, 3.0, 0.36, TZ)
    TZ2 = TZ + 0.006
    p_(E.tabua_de_corte(c, 3.75, 3.0, TZ2, w=0.36, d=0.18), TZ2)
    E.pao(c, 3.75, 3.0, TZ2 + 0.03, comprido=True)
    p_(E.tigela(c, 4.52, 3.0, TZ2, r=0.12, cor='#5d7fa1', frutas=((-0.05, -0.03, 'maca'), (0.05, -0.02, 'laranja'), (0.0, 0.05, 'pera'), (-0.03, 0.03, 'limao'), (0.04, 0.04, 'maca'), (0.0, -0.05, 'laranja'))), TZ2)
    chama_vela = E.vela(c, 4.15, 3.0, TZ2)
    # um lugar posto na frente de cada cadeira, a 0,2 m da borda, virado para quem senta
    for x, y, rot in LUGARES:
        cx_, cy_ = (x + 0.5) * CASA, (y + 0.5) * CASA
        if rot == 4:
            d, px, py = (0, 1), cx_, 2.25 + 0.2
        elif rot == 0:
            d, px, py = (0, -1), cx_, 3.75 - 0.2
        elif rot == 2:
            d, px, py = (1, 0), 3.0 + 0.2, cy_
        else:
            d, px, py = (-1, 0), 5.25 - 0.2, cy_
        E.prato_posto(c, px, py, TZ, d)
    # a parede da esquerda: o trilho com as panelas e as conchas
    E.trilho(c, 2.95, 4.35, 1.6)
    E.panela_pendurada(c, 0, 3.15, 1.38, r=0.1)
    E.panela_pendurada(c, 0, 3.55, 1.4, r=0.085, cor='#a8643a')
    E.concha(c, 3.85, 1.6)
    E.concha(c, 4.05, 1.6)
    # a parede do fundo, à direita: a lenha, as ervas secando, o alho e a vassoura
    ocup.append(E.lenha(c, 6.05, 0.0, comp=0.95, prof=0.42) + (0,))
    E.ervas_secando(c, 6.25, 0, 1.7)
    E.alho(c, 7.25, 0, 1.85)
    # o tapete trançado na frente do fogão e da pia, e o gato dormindo nele
    E.tapete_trancado(c, 2.75, 1.2, 0.95, 0.42)
    # (sem animais por enquanto: o gato saiu, 12/10)
    # o saco de batatas, o capacho na porta e o calendário
    ocup.append(E.saco_batatas(c, 1.15, 4.05) + (0,))
    E.capacho(c, 6.95, 7.45, 2.35, 3.15)
    E.calendario(c, 2.62, 1.38)

    # ---------- nas paredes ----------
    # o quadro das frutas (parede do fundo, x 3,0 casas, 1,56 m)
    q = c.novo_obj()
    xq = 3.0 * CASA
    def tela_frutas(L, n, P):
        a, b = L[:, 0], L[:, 2]
        cor = np.tile(hexa('#3b2c22'), (len(L), 1))
        cx, cz = xq, 1.72
        mesa_ = b < cz - 0.06
        cor = np.where(mesa_[:, None], hexa('#5a3f2a')[None, :], cor)
        for (dx, dz, r, cc) in ((-0.1, -0.03, 0.055, '#c4442f'), (0.0, -0.01, 0.06, '#e0a43a'), (0.1, -0.03, 0.05, '#7c9a3c'),
                                (-0.04, 0.05, 0.05, '#a8324a'), (0.06, 0.05, 0.045, '#d9c25a')):
            d = np.hypot(a - (cx + dx), (b - (cz + dz)) * 1.0)
            cor = np.where((d < r)[:, None], hexa(cc)[None, :] * np.where(((a - (cx + dx)) + (b - (cz + dz)) > r * 0.4)[:, None], 1.18, 1.0), cor)
        # a tigela
        tig = (np.abs(a - cx) < 0.17 - (cz - 0.04 - b) * 1.5) & (b < cz - 0.04) & (b > cz - 0.13)
        cor = np.where(tig[:, None], hexa('#d8cdb4')[None, :], cor)
        return cor
    moldura = liso('#7a5232')
    c.caixa((xq - 0.32, xq + 0.32, 0, 0.035, 1.5, 1.98), {'frente': com_detalhe(moldura, (regiao(xq - 0.26, xq + 0.26, 1.56, 1.92), tela_frutas)), '*': moldura}, MUNDO, q)
    # a prateleira com livros e o rádio (x 8,5 casas)
    pr = c.novo_obj()
    xs = 8.5 * CASA
    c.caixa((xs - 0.45, xs + 0.45, 0, 0.22, 1.72, 1.76), {'*': liso('#7a5232')}, MUNDO, pr)
    for dx in (-0.35, 0.35):
        c.caixa((xs + dx - 0.02, xs + dx + 0.02, 0, 0.16, 1.58, 1.72), {'*': liso('#3a3533')}, MUNDO, pr)
    livros = ['#7a2f2a', '#2f4f6a', '#6a5a2a', '#3e5a3a', '#8a6a3a', '#5a2f4a']
    xx = xs - 0.42
    for i, cc in enumerate(livros):
        lw = 0.045 + 0.02 * ruido(i, 7)
        lh = 0.2 + 0.08 * ruido(i, 8)
        lb = c.novo_obj()
        c.caixa((xx, xx + lw, 0.03, 0.19, 1.76, 1.76 + lh), {'*': liso(cc), 'frente': com_detalhe(liso(cc), (linha_h(1.76 + lh * 0.75, 0.012), '#d8c48a'))}, MUNDO, lb)
        xx += lw + 0.004
    rd = c.novo_obj()
    def radio(L, n, P):
        a, b = coord_face(L, n)
        cor = np.tile(hexa('#6a4a2e'), (len(L), 1))
        tela_ = (a > xs + 0.02) & (a < xs + 0.2) & (b > 1.8) & (b < 1.9)
        cor = np.where(tela_[:, None], hexa('#d9c38a')[None, :], cor)
        grade = (a > xs + 0.22) & (a < xs + 0.36) & (b > 1.79) & (b < 1.91) & ((a * 120).astype(int) % 2 == 0)
        cor = np.where(grade[:, None], cor * 0.7, cor)
        return cor
    c.caixa((xs + 0.0, xs + 0.38, 0.03, 0.2, 1.76, 1.95), {'frente': radio, '*': liso('#6a4a2e')}, MUNDO, rd)
    # o relógio redondo na parede da esquerda (y 4,5 casas, 2,1 m)
    rl = c.novo_obj()
    yc, zc, R = 4.5 * CASA, 2.05, 0.2
    def mostrador(L, n, P):
        y, z = L[:, 1], L[:, 2]
        d = np.hypot(y - yc, z - zc)
        cor = np.tile(hexa('#efe6cf'), (len(L), 1))
        cor = np.where((d > R - 0.035)[:, None], hexa('#6b4a31')[None, :], cor)
        ang = np.arctan2(z - zc, y - yc)
        marca = (d > R - 0.07) & (d < R - 0.04) & ((np.abs(((ang / (math.pi / 6)) + 0.5) % 1 - 0.5)) < 0.12)
        cor = np.where(marca[:, None], hexa('#3a2c22')[None, :], cor)
        # os ponteiros (10 e 10)
        for a_, L_ in ((math.radians(140), 0.09), (math.radians(40), 0.13)):
            t = (y - yc) * math.cos(a_) + (z - zc) * math.sin(a_)
            dist = np.abs(-(y - yc) * math.sin(a_) + (z - zc) * math.cos(a_))
            cor = np.where(((t > 0) & (t < L_) & (dist < 0.012))[:, None], hexa('#2a201a')[None, :], cor)
        return cor
    pts = [(0.025, yc + R * math.cos(2 * math.pi * i / 28), zc + R * math.sin(2 * math.pi * i / 28)) for i in range(28)]
    c.face_plana(pts, (1, 0, 0), mostrador, MUNDO, rl)
    return c, ocup, luzes + [chama_vela], peq


def quadro(t):
    TEMPO['t'] = t
    c, ocup, luzes, peq = montar()
    sol = (-0.15, 1.0, -1.3)
    if ESC > 1:
        # as sombras de verdade: a luz de cima (as lâmpadas e o teto, uma luz grande e macia) e o sol da janela
        cima = c.sombra_direcional((0.22, 0.3, -1.0), res=0.008, vies=0.01, raio=2, amostras=6, abertura=0.22)
        c.escurecer(cima, 0.42)
        c.sombra_de_contato(ocup, forca=0.25)
        aceso_sol = c.sombra_direcional(sol, res=0.008, vies=0.01, raio=1, amostras=3, abertura=0.04)
    else:
        c.sombra_de_contato(ocup)
        c.sombra_pequena(peq)
        aceso_sol = None
    c.oclusao(ROOM_W * CASA, ROOM_D * CASA, ALTURA)
    c.luz_janela(3.25, 4.25, 1.2, 2.15, sol, (255, 226, 160), 1.5, aceso=aceso_sol)
    tt = t * 2 * math.pi
    for L in luzes[:2]:
        c.luz((L[0], L[1], 0.0), 1.6, (255, 214, 140), 0.5)
    c.luz(luzes[2], 0.5, (255, 200, 120), 0.55 + 0.1 * math.sin(tt * 4) + 0.05 * math.sin(tt * 9))
    c.luz((2 * CASA + 0.35, 0.75, 0.4), 1.1, (255, 140, 60), 0.55 + 0.12 * math.sin(tt * 3) + 0.06 * math.sin(tt * 7 + 1))
    c.brilho_de_quina()
    c.contorno()
    # depois do contorno: o ar (o feixe, a poeira, o vapor) não ganha borda
    c.feixe_no_ar(3.25, 4.25, 1.2, 2.15, sol, (255, 236, 190), 4.0, t)
    Dv = np.array(sol); Dv /= np.linalg.norm(Dv)
    pts = []
    for k in range(26):
        u = ruido(k, 1); w_ = ruido(k, 2); f = ruido(k, 3)
        tt_ = (0.3 + 2.2 * f + 0.15 * math.sin(tt + k)) 
        base = np.array([3.3 + 0.9 * u, 0.0, 1.25 + 0.85 * w_])
        P = base + Dv * tt_ + np.array([0.04 * math.sin(tt + k * 1.7), 0.03 * math.cos(tt + k), 0.05 * math.sin(tt * 1 + k * 2.3)])
        if P[2] > 0.05:
            pts.append(P)
    c.particulas(pts, (255, 246, 214), 0.85)
    # o vapor da chaleira (bico em x 2.54, y 0.34, z 0.97)
    puffs = []
    for k in range(5):
        fase = (t + k / 5) % 1
        puffs.append(((2.56 + 0.05 * fase + 0.02 * math.sin(tt + k), 0.34, 0.99 + fase * 0.45), 0.025 + 0.05 * fase, 0.9 * (1 - fase)))
    c.fumaca(puffs)
    img = Image.fromarray(c.imagem())
    return colar_agente(c, img)


def colar_agente(c, img):
    ag = Image.open('/home/user/CRONA/client/public/arte/personagens/alosi/tabuleiro-32bits/idle-desarmado-se.png').convert('RGBA')
    a = np.asarray(ag)[:, :, 3] > 60
    ys = np.nonzero(a.any(axis=1))[0]
    alto = ys.max() - ys.min() + 1
    k = (1.8 * KZ) / alto
    ag2 = ag.crop((0, ys.min(), ag.width, ys.max() + 1)).resize((max(1, round(ag.width * k)), round(alto * k)), Image.LANCZOS)
    sx, sy = tela(np.array([8.5 * CASA, 3.5 * CASA, 0.0]))
    sx, sy = sx - c.x0, sy - c.y0
    from PIL import ImageDraw
    sombra = Image.new('RGBA', img.size, (0, 0, 0, 0))
    ImageDraw.Draw(sombra).ellipse([sx - 15 * ESC, sy - 6 * ESC, sx + 15 * ESC, sy + 6 * ESC], fill=(30, 20, 10, 90))
    img = Image.alpha_composite(img.convert('RGBA'), sombra)
    img.alpha_composite(ag2, (round(sx - ag2.width / 2), round(sy - ag2.height + 2)))
    return img.convert('RGB')


if __name__ == '__main__':
    import os
    saida = sys.argv[1] if len(sys.argv) > 1 else 'cozinha-anim'
    n = int(sys.argv[2]) if len(sys.argv) > 2 else 32
    quadros = [quadro(i / n) for i in range(n)]
    if os.environ.get('CRU'):
        quadros[0].save(saida + '-cru.png')
    if ESC > 2:
        # desenhado maior e reduzido para 2 px por pixel do tabuleiro: as bordas ficam lisas
        k = 2 / ESC
        quadros = [q.resize((round(q.width * k), round(q.height * k)), Image.LANCZOS) for q in quadros]
        big = quadros
    else:
        big = [q.resize((q.width * 2, q.height * 2), Image.NEAREST) for q in quadros]
    quadros[0].save(saida + '-q0.png')
    big[0].save(saida + '.gif', save_all=True, append_images=big[1:], duration=110, loop=0, optimize=False, disposal=1)
    big[0].save(saida + '.webp', save_all=True, append_images=big[1:], duration=110, loop=0, lossless=True)
    print(len(quadros), 'quadros', quadros[0].size)
