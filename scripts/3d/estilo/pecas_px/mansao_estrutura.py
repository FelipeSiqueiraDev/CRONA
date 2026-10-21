"""
GRUPO B1, "Mansão Albuquerque: luz, lareira, colunas, escadas nobres, piano, relógio e tapetes" (21/10): as peças de
estrutura e de salão da mansão do Frigorífico Albuquerque, em pixel art 1:1 só por código (motor.py + os módulos de
pecas_px). Riqueza sóbria de dinheiro velho: nogueira escura, mármore creme veiado, ouro discreto, veludo vinho, latão
e cristal. Tudo no giro 4 (a frente para +y), a pegada começando em (0, 0), no tamanho do catálogo (as alturas em
METROS). Peça fechada nos quatro lados.

Decisões:
  - lustre_cristal (0 aceso, '1' apagado): pendurado no alto (z 2,10 a 2,80 m), o fio de corrente sobe e some em
    transparência; aceso, as velas e os pingentes brilham (sem contorno); a luz no chão é do cliente.
  - lareira_marmore (0 acesa, '1' apagada): a boca com a grade de latão, as lenhas e as brasas, SEM chama (o cliente
    põe a chama por cima); o fundo da fornalha vai de x 0,95 a 1,30 m e a boca de z 0,04 a 0,86 m.
  - piano_cauda: o corpo ocupa 1,75 x 1,4 m dentro das 3 x 2 casas (a cauda é mais comprida que larga); a tampa
    levantada passa de 1,05 m (vai até uns 2,2 m, no escorete).
  - escada_nobre / escada_nobre_desce: 6 degraus de 20 cm (1,2 m) em 1,5 m de fundo, o tapete vinho com varões de latão.
  - tapetes: decalques de 1 px, sem pegada, como o rug_ornate.
"""
import math

import numpy as np

import cozinha as CZ
import base_estilo as BE
import estrutura as ES
import casa as CA
import medieval as MD
import ocultismo as OC
from base_estilo import (hx, liso, mad2, tab2, vol, _tom, _pau, _barra, _p1_malha, _p1_mat_rampa, _poligono_rodado, _disco,
                         _fita, _cru, PH, PZ)
from motor import emissivo, ruido, suave, KX, KZ

M = BE.M
CASA = 0.75
LUZ = MD.LUZ
cx, novo, peg, luz_obj, fp, pau = MD.cx, MD.novo, MD.peg, MD.luz_obj, MD.fp, MD.pau


def C():
    return CZ.c


# =====================================================================================================================
# as cores e os materiais da casa
# =====================================================================================================================
MARM = '#e6dfd0'          # o mármore creme
MARM_V = '#bfb4a0'        # o veio do mármore creme
GRAF = '#34343a'          # o mármore grafite
GRAF_V = '#6e6e78'
LATAO = '#b8923a'
LATAO_T = '#e6c868'
OURO = '#b8902a'
NOGUEIRA = '#4a2c1a'
NOGUEIRA_T = '#6a4428'
VINHO = '#6a1a24'
VINHO_E = '#4e1219'


def marmore(cor=MARM, veio=MARM_V, seed=0, forte=1.0, escala=1.0):
    """
    O mármore veiado: a cor com as manchas largas de dois tons, as veias diagonais de 1 px em pedaços compridos (e uma
    segunda veia fina, mais clara, quebrada), tudo na grade do pixel. No topo e nas faces em pé.
    """
    c0, cv = hx(cor), hx(veio)

    def f(L, n, P):
        if abs(n[2]) > 0.5:
            qa, qb = np.floor(L[:, 0] / PH), np.floor(L[:, 1] / PH)
        else:
            a = L[:, 0] if abs(n[1]) > 0.5 else L[:, 1]
            qa, qb = np.floor(a / PH), np.floor(L[:, 2] / PZ)
        t = (qa * 0.55 + qb * 0.4) / (10 * escala) + suave(qa, qb, 16, seed) * 1.15
        fr = t - np.floor(t)
        along = np.floor((qa * 0.4 - qb * 0.55) / 9)
        linha = (np.abs(fr - 0.5) < 0.05 * forte) & (ruido(np.floor(t), along, seed + 3.0) < 0.6)
        t2 = (qa * 0.3 - qb * 0.5) / (13 * escala) + suave(qa + 40, qb, 12, seed + 1) * 1.3
        fr2 = t2 - np.floor(t2)
        l2 = (np.abs(fr2 - 0.5) < 0.035) & (ruido(np.floor(t2), np.floor(qb / 7), seed + 5.0) < 0.5)
        m = suave(qa, qb, 22, seed + 7)
        out = np.tile(c0, (len(L), 1))
        out = np.where((m > 0.62)[:, None], _tom(out, 1.025), np.where((m < 0.3)[:, None], _tom(out, 0.972), out))
        out = np.where(l2[:, None], _tom(out, 0.93), out)
        return np.where(linha[:, None], cv, out)
    return emissivo(f)


def faixa_marmore(cx_, cy_, cor=MARM, veio=MARM_V, seed=0, raio=0.2):
    """As veias do mármore para as peças redondas (vol): no ângulo e na altura, na grade do pixel."""
    cv = hx(veio)

    def f(P, b):
        th = np.arctan2(P[:, 1] - cy_, P[:, 0] - cx_)
        qa, qb = np.floor(th * raio / PH), np.floor(P[:, 2] / PZ)
        t = (qa * 0.55 + qb * 0.4) / 10 + suave(qa, qb, 16, seed) * 1.6
        fr = t - np.floor(t)
        along = np.floor((qa * 0.4 - qb * 0.55) / 9)
        linha = (np.abs(fr - 0.5) < 0.05) & (ruido(np.floor(t), along, seed + 3.0) < 0.7)
        m = suave(qa, qb, 22, seed + 7)
        b = np.where((m < 0.3)[:, None], _tom(b, 0.97), b)
        return np.where(linha[:, None], _tom(cv, 1.0), b)
    return f


def dourado(seed=0, eixo=0, passo=0.035):
    """A talha dourada: o ouro com riscas de luz e de sombra de 1 px."""
    return mad2(OURO, eixo=eixo, seed=seed, passo=passo, claro=1.3, escuro=0.7)


def laca(cor='#1f1e26', brilho=True, faixas=False):
    """
    A laca preta do piano: uma rampa curta de pretos pela normal de cada face (a luz em degraus), a risca de brilho
    do verniz nas facetas que miram a luz, a quina clara de cima e, na tampa (faixas), os reflexos em diagonal.
    Já compensada da luz do acabamento do exportador.
    """
    c0 = hx(cor)

    def f(L, n, P):
        nn = np.asarray(n, float) / np.linalg.norm(n)
        Nw = BE.n_mundo(nn)
        d = float(Nw @ BE._LUZ2)
        k = float(BE._luz_k(np.array(d)))
        tom = _tom(c0, k)
        if brilho:
            ang = math.atan2(Nw[1], Nw[0])
            if math.cos(ang - math.radians(112)) > 0.985 and abs(nn[2]) < 0.6:
                tom = _tom(c0, 1.7)
        out = np.tile(tom, (len(L), 1))
        if brilho and abs(nn[2]) < 0.5:
            out = np.where((L[:, 2] > 0.945)[:, None], _tom(c0, 1.6), out)
        if faixas:
            qa, qb = np.floor(L[:, 0] / PH), np.floor(L[:, 1] / PH)
            s_ = qa + qb
            out = np.where(((s_ % 44) < 4)[:, None], _tom(np.tile(c0, (len(L), 1)), 1.65), out)
            out = np.where((((s_ % 44) >= 4) & ((s_ % 44) < 7))[:, None], _tom(np.tile(c0, (len(L), 1)), 1.32), out)
            out = np.where((((s_ + 22) % 44) < 2)[:, None], _tom(np.tile(c0, (len(L), 1)), 1.15), out)
        return _cru(out, nn)
    return emissivo(f)


def _gota_cor(aceso, dourada, k):
    ICE = ['#6f86a0', '#9fb6cc', '#cfe2f0', '#f0f8ff', '#ffffff']
    GOL = ['#8a6a1c', '#b8902a', '#e0c060', '#f6e49a', '#fff6cc']
    return (GOL if dourada else ICE)[k]


def gota(x, y, zt, h, r, aceso, dourada=False, lados=4, fase=0.125):
    """O pingente de cristal (bipirâmide: o ponto em cima, a cintura a 1/3 e a ponta embaixo)."""
    zg = zt - 0.33 * h
    ang = [2 * math.pi * (i + fase) / lados for i in range(lados)]
    cint = [(x + r * math.cos(a), y + r * math.sin(a), zg) for a in ang]
    top, bot = (x, y, zt), (x, y, zt - h)
    o = luz_obj() if aceso else novo()
    for i in range(lados):
        j = (i + 1) % lados
        am = ang[i] + math.pi / lados
        for (pts, n, sobe) in (([cint[i], cint[j], top], (math.cos(am) * 0.55, math.sin(am) * 0.55, 0.83), 1),
                               ([cint[j], cint[i], bot], (math.cos(am) * 0.9, math.sin(am) * 0.9, -0.43), 0)):
            if aceso:
                d = float(BE.n_mundo(np.array(n)) @ LUZ)
                k = int(np.clip(np.round(1.3 + d * 2.0 + sobe * 0.7), 0, 4))
                m = liso(_gota_cor(True, dourada, k))
            else:
                m = liso('#b9a35a' if dourada else '#aebccb')
            fp(pts, n, m, o)
    return o


def _ring(xc, yc, z, R, w, mat, o, n=22, h=None):
    """Um aro horizontal feito de barras retas (seção w x h)."""
    h = w if h is None else h
    for i in range(n):
        a0, a1 = 2 * math.pi * i / n, 2 * math.pi * (i + 1) / n
        ES._prisma((xc + R * math.cos(a0), yc + R * math.sin(a0), z), (xc + R * math.cos(a1), yc + R * math.sin(a1), z), w, h, mat, o)


# =====================================================================================================================
# o lustre de cristal (1 x 1, pendurado entre 2,10 e 2,80 m)
# =====================================================================================================================
def _saia(xc, yc, R0, z0, R1, z1, aceso, n=24, seed=0, tons=None):
    """A saia de fios de cristal (um tronco de cone facetado, uma faceta por fio, claras e escuras alternadas)."""
    o = luz_obj() if aceso else novo()
    h = z1 - z0
    dr = R0 - R1
    for i in range(n):
        a0, a1 = 2 * math.pi * i / n, 2 * math.pi * (i + 1) / n
        am = (a0 + a1) / 2
        nn = (math.cos(am) * h, math.sin(am) * h, dr)
        L = math.sqrt(nn[0] ** 2 + nn[1] ** 2 + nn[2] ** 2)
        nn = (nn[0] / L, nn[1] / L, nn[2] / L)
        d = float(BE.n_mundo(np.array(nn)) @ LUZ)
        if aceso:
            k = int(np.clip(np.round(0.9 + d * 1.9 + (1.2 if i % 2 else 0.0) - (0.7 if (i % 6 == 4) else 0.0)), 0, 4))
            cor = _gota_cor(True, False, k)
        else:
            cor = '#a9b7c6' if i % 2 else '#8b9bae'
        pts = [(xc + R0 * math.cos(a0), yc + R0 * math.sin(a0), z0), (xc + R0 * math.cos(a1), yc + R0 * math.sin(a1), z0),
               (xc + R1 * math.cos(a1), yc + R1 * math.sin(a1), z1), (xc + R1 * math.cos(a0), yc + R1 * math.sin(a0), z1)]
        fp(pts, nn, liso(cor), o)
    return o


def _lustre(aceso):
    def d():
        xc = yc = CASA / 2
        LA = ES.latao()
        # o fio de corrente que sobe e some antes do teto
        of = C().novo_obj(3, sombra=False, contorno=False)
        for k in range(14):
            z = 2.82 + 0.05 * k
            cx((xc - 0.012, xc + 0.012, yc - 0.005, yc + 0.005, z, z + 0.034), liso('#a8862c' if k % 2 else '#7a5e1a'), o=of)
            cx((xc - 0.005, xc + 0.005, yc - 0.012, yc + 0.012, z + 0.025, z + 0.06), liso('#a8862c' if k % 2 else '#7a5e1a'), o=of)
        CZ.fades.append((of, 2.98, 0.5))
        # o miolo: a haste torneada de latão com as bolas
        o = novo()
        perfil = [(2.10, 0.0), (2.112, 0.02), (2.14, 0.034), (2.175, 0.04), (2.21, 0.026), (2.25, 0.02), (2.41, 0.02), (2.44, 0.034),
                  (2.47, 0.02), (2.62, 0.02), (2.65, 0.034), (2.68, 0.02), (2.72, 0.02), (2.74, 0.046), (2.775, 0.054), (2.8, 0.03),
                  (2.815, 0.014)]
        _poligono_rodado(xc, yc, perfil, vol(xc, yc, LATAO, brilho=0.55), o, lados=12)
        # os três andares em cascata: a saia de cristal, o aro de latão, as velas nos copinhos e os pingentes
        andares = ((2.34, 0.42, 2.49, 0.30, 8, 0.1), (2.49, 0.30, 2.62, 0.19, 6, 0.09), (2.62, 0.19, 2.735, 0.07, 5, 0.08))
        for i_, (zr, R, zt, Rt, nv, hp) in enumerate(andares):
            _saia(xc, yc, R - 0.01, zr + 0.01, Rt, zt, aceso, n=36 if i_ == 0 else (28 if i_ == 1 else 20))
            oa = novo()
            _ring(xc, yc, zr + 0.005, R, 0.03, LA, oa, n=24, h=0.028)
            # as velas elétricas nos copinhos (a vela cheia, clara, com a chama)
            for i in range(nv):
                a = 2 * math.pi * (i + 0.25) / nv
                vx, vy = xc + R * math.cos(a), yc + R * math.sin(a)
                ov = novo()
                C().cilindro(vx, vy, 0.03, zr + 0.016, zr + 0.052, vol(vx, vy, LATAO, brilho=0.4), M, ov, lados=8, r1=0.022,
                             tampa_mat=liso('#d2ac52'))
                zb = zr + 0.052 + hp
                if aceso:
                    ovela = luz_obj()
                    C().cilindro(vx, vy, 0.018, zr + 0.052, zb, vol(vx, vy, '#f4ecd6'), M, ovela, lados=8, tampa_mat=liso('#fffaea'))
                    ob = luz_obj()
                    C().elipsoide(np.array([vx, vy, zb + 0.035]), np.array([0.022, 0.022, 0.044]), liso('#ffd060'), ob)
                    ob2 = luz_obj()
                    C().elipsoide(np.array([vx + 0.002, vy + 0.002, zb + 0.03]), np.array([0.012, 0.012, 0.026]), liso('#fffbe0'), ob2)
                else:
                    C().cilindro(vx, vy, 0.018, zr + 0.052, zb, vol(vx, vy, '#e4dcc4'), M, ov, lados=8, tampa_mat=liso('#f4eedc'))
                    C().elipsoide(np.array([vx, vy, zb + 0.02]), np.array([0.013, 0.013, 0.022]), liso('#cbbf9c'), novo())
            # os pingentes pendurados no aro: o longo, o médio e o curto, repetidos; um em cada cinco é dourado
            npg = nv * 3
            for i in range(npg):
                a = 2 * math.pi * (i + 0.5) / npg
                px_, py_ = xc + (R - 0.012) * math.cos(a), yc + (R - 0.012) * math.sin(a)
                hh = (0.17, 0.11, 0.14, 0.09)[i % 4] * (1.0 if i_ == 0 else 0.8)
                gota(px_, py_, zr - 0.005, hh, 0.03, aceso, i % 5 == 3, lados=4)
        # o pingente grande do meio, embaixo da ponta
        gota(xc, yc, 2.24, 0.14, 0.038, aceso, False, lados=6)
    return d


# =====================================================================================================================
# a coluna de mármore (1 x 1, 2,8 m)
# =====================================================================================================================
def _coluna():
    xc = yc = CASA / 2
    MB = marmore(MARM, MARM_V, seed=21)
    # o plinto quadrado em dois degraus
    cx((0.11, 0.64, 0.11, 0.64, 0.0, 0.13), {'*': MB, 'cima': marmore(MARM, MARM_V, seed=22)}, ch=0.012)
    cx((0.15, 0.60, 0.15, 0.60, 0.13, 0.2), {'*': marmore(MARM, MARM_V, seed=23), 'cima': marmore(MARM, MARM_V, seed=24)}, ch=0.01)
    # a base ática: o toro grosso, o filete e o toro fino
    o = novo()
    perfil = [(0.2, 0.235), (0.215, 0.27), (0.245, 0.28), (0.27, 0.262), (0.278, 0.225), (0.292, 0.222), (0.305, 0.25), (0.325, 0.255),
              (0.34, 0.22), (0.35, 0.2)]
    _poligono_rodado(xc, yc, perfil, vol(xc, yc, MARM, faixas=faixa_marmore(xc, yc, seed=25, raio=0.26)), o, lados=26,
                     tampa_mat=liso(_hexa(_tom(hx(MARM), 1.0))))
    # o fuste caneluras (12 canais), um pouco mais fino em cima
    o = novo()
    C().cilindro(xc, yc, 0.2, 0.35, 2.2, vol(xc, yc, MARM, faixas=faixa_marmore(xc, yc, seed=26), costuras=(12, '#b6ab96', 0.2)), M, o,
                 lados=26, tampa=False, r1=0.18)
    # o colarinho (o astrágalo) e o pescoço
    o = novo()
    _poligono_rodado(xc, yc, [(2.2, 0.18), (2.21, 0.2), (2.235, 0.205), (2.26, 0.19), (2.28, 0.19)], vol(xc, yc, MARM, faixas=faixa_marmore(xc, yc, seed=27)),
                     o, lados=26)
    # o capitel jônico: o equino (cone que abre), a almofada entre as volutas e as quatro volutas (duas na frente, duas atrás)
    o = novo()
    C().cilindro(xc, yc, 0.19, 2.28, 2.4, vol(xc, yc, MARM, faixas=faixa_marmore(xc, yc, seed=28)), M, o, lados=26, tampa=False, r1=0.235)
    ov = novo()
    cx((xc - 0.25, xc + 0.25, yc - 0.15, yc + 0.15, 2.4, 2.54), {'*': marmore(MARM, MARM_V, seed=29), 'cima': marmore(MARM, MARM_V, seed=30)},
       o=ov, ch=0.01)
    pts = [(math.cos(2 * math.pi * i / 16), math.sin(2 * math.pi * i / 16)) for i in range(16)]

    def volut(zc, xcc, y0, y1):
        r = 0.085
        poly = [(xcc + r * a, zc + r * b) for (a, b) in pts]

        def f(L, n, P):
            if abs(n[1]) < 0.5:
                return marmore(MARM, MARM_V, seed=31)(L, n, P)
            d = np.hypot(L[:, 0] - xcc, L[:, 2] - zc)
            ang = np.arctan2(L[:, 2] - zc, L[:, 0] - xcc)
            out = np.tile(hx(MARM), (len(L), 1))
            esp = (d / r) * 2.6 + ang / (2 * math.pi) * 1.0
            out = np.where(((esp % 1) < 0.3)[:, None] & (d < r * 0.86)[:, None], hx('#a89d86'), out)
            out = np.where((d < r * 0.22)[:, None], hx('#8c8270'), out)
            out = np.where((d >= r * 0.86)[:, None], _tom(np.tile(hx(MARM), (len(L), 1)), 1.07), out)
            return out
        MD.placa_xz(poly, y0, y1, emissivo(f), o=ov)
    for xcc in (xc - 0.17, xc + 0.17):
        volut(2.47, xcc, yc + 0.15, yc + 0.2)
        volut(2.47, xcc, yc - 0.2, yc - 0.15)
    # o ábaco e o toco do entablamento (a coluna sobe até o teto: não termina no ar)
    cx((xc - 0.27, xc + 0.27, yc - 0.27, yc + 0.27, 2.54, 2.6), {'*': marmore(MARM, MARM_V, seed=32), 'cima': marmore(MARM, MARM_V, seed=33)}, ch=0.01)
    cx((xc - 0.235, xc + 0.235, yc - 0.235, yc + 0.235, 2.6, 2.74), {'*': marmore(MARM, MARM_V, seed=34), 'cima': marmore(MARM, MARM_V, seed=35)}, ch=0.008)
    cx((xc - 0.29, xc + 0.29, yc - 0.29, yc + 0.29, 2.74, 2.8), {'*': marmore(MARM, MARM_V, seed=36), 'cima': liso(_hexa(_tom(hx(MARM), 1.05)))}, ch=0.01)
    peg(0.1, 0.65, 0.1, 0.65)


def _hexa(c):
    c = np.clip(np.round(np.asarray(c, float)), 0, 255).astype(int)
    return '#%02x%02x%02x' % tuple(c)


# =====================================================================================================================
# o relógio de caixa alta (1 x 1, 2,4 m)
# =====================================================================================================================
def _relogio():
    xc = CASA / 2
    NOG = {'*': mad2('#4e2e1a', eixo=1, seed=41, passo=0.05), 'cima': liso('#6e4a2c')}
    # a base: dois degraus de moldura e a placa de cima
    cx((0.09, 0.66, 0.16, 0.64, 0.0, 0.07), {'*': mad2('#3e2416', seed=42, passo=0.04), 'cima': liso('#5a3a24')}, ch=0.008)
    cx((0.12, 0.63, 0.19, 0.61, 0.07, 0.19), {'*': mad2('#4e2e1a', seed=43, passo=0.04), 'cima': liso('#6a4428')}, ch=0.008)
    cx((0.1, 0.65, 0.17, 0.63, 0.19, 0.23), _pau('#4a2c1a', '#8a5a34', quina=1.25, b=(0, 0, 0, 0, 0, 0.23)))
    # o corpo: tronco com o painel de baixo, a porta de vidro em cima
    uo0, uo1, zo0, zo1 = 0.215, 0.535, 0.74, 1.56      # a janela da porta

    def frente_tronco(L, n, P):
        out = mad2('#4e2e1a', eixo=1, seed=44, passo=0.05)(L, n, P)
        u, z = L[:, 0], L[:, 2]
        # o painel rebaixado de baixo (a almofada)
        pu0, pu1, pz0, pz1 = 0.2, 0.55, 0.3, 0.64
        d = (u >= pu0) & (u < pu1) & (z >= pz0) & (z < pz1)
        bev = d & ((u < pu0 + 2 * PH) | (z >= pz1 - 2 * PZ))
        bev2 = d & ((u >= pu1 - 2 * PH) | (z < pz0 + 2 * PZ))
        out = np.where(d[:, None], _tom(out, 0.92), out)
        out = np.where(bev[:, None], _tom(hx('#4e2e1a'), 1.22), out)
        out = np.where(bev2[:, None], _tom(hx('#4e2e1a'), 0.66), out)
        out = np.where((d & ((u < pu0 + PH) | (u >= pu1 - PH) | (z < pz0 + PZ) | (z >= pz1 - PZ)))[:, None], hx('#241208'), out)
        # a janela da porta: o fundo escuro, o pêndulo de latão, os dois pesos, o reflexo do vidro
        j = (u >= uo0) & (u < uo1) & (z >= zo0) & (z < zo1)
        fundo = np.tile(hx('#1c1410'), (len(L), 1))
        fundo = np.where(((z > 1.4) & (z < 1.5))[:, None], hx('#241a14'), fundo)
        # os pesos (cilindros de latão pendurados) e as correntes
        for (pu, alto0, alto1) in ((0.29, 1.0, 1.38), (0.46, 0.86, 1.3)):
            w = j & (np.abs(u - pu) < 0.024) & (z > alto0) & (z < alto1)
            fundo = np.where(w[:, None], _tom(np.tile(hx(LATAO), (len(L), 1)), np.where(u < pu - 0.005, 1.15, 0.8)), fundo)
            fundo = np.where((w & (np.floor(z / PZ) % 5 == 0))[:, None], hx('#6a5018'), fundo)
            fundo = np.where((j & (np.abs(u - pu) < 0.5 * PH) & (z >= alto1))[:, None], hx('#6a5a30'), fundo)
        # o pêndulo: a haste e o disco
        hasta = j & (np.abs(u - xc) < 0.55 * PH) & (z > 0.88) & (z < 1.5)
        fundo = np.where(hasta[:, None], hx('#c8a248'), fundo)
        rr = np.hypot((u - xc) / 1.0, (z - 0.84) / 1.0)
        disco = j & (rr < 0.075)
        fundo = np.where(disco[:, None], _tom(np.tile(hx(LATAO_T), (len(L), 1)), np.where(u < xc - 0.02, 1.0, 0.82)), fundo)
        fundo = np.where((j & (rr < 0.03))[:, None], hx('#a88226'), fundo)
        fundo = np.where((j & (rr >= 0.075) & (rr < 0.075 + PH)).astype(bool)[:, None], hx('#6a5018'), fundo)
        out = np.where(j[:, None], fundo, out)
        # a moldura da janela (um friso de 1 px mais claro por fora e escuro por dentro)
        mj = (u >= uo0 - 0.028) & (u < uo1 + 0.028) & (z >= zo0 - 0.028) & (z < zo1 + 0.028) & ~j
        out = np.where(mj[:, None], _tom(hx('#4e2e1a'), 1.15), out)
        out = np.where((mj & ((u < uo0 - 0.028 + PH) | (z >= zo1 + 0.028 - PZ))).astype(bool)[:, None], _tom(hx('#4e2e1a'), 1.4), out)
        out = np.where((j & ((u < uo0 + PH) | (z >= zo1 - PZ))).astype(bool)[:, None], hx('#0e0a08'), out)
        return out
    cx((0.16, 0.59, 0.23, 0.58, 0.23, 1.66), {'frente': emissivo(frente_tronco), **NOG}, ch=0.006)
    CZ.vidros.append((uo0, uo1, 0.575, 0.585, zo0, zo1))
    # as colunetas de latão nos cantos do tronco e a moldura de cima
    for xx in (0.185, 0.565):
        o = novo()
        C().cilindro(xx, 0.555, 0.014, 0.7, 1.58, vol(xx, 0.555, LATAO, brilho=0.5), M, o, lados=8, tampa_mat=liso(LATAO_T))
    cx((0.14, 0.61, 0.21, 0.6, 1.66, 1.72), _pau('#3e2416', '#8a5a34', quina=1.25, b=(0, 0, 0, 0, 0, 1.72)))
    # o capelo (a caixa do mostrador) com o mostrador redondo e as colunas laterais
    def frente_capelo(L, n, P):
        out = mad2('#4e2e1a', eixo=1, seed=45, passo=0.05)(L, n, P)
        u, z = L[:, 0], L[:, 2]
        arco = (np.hypot(u - xc, z - 1.97) < 0.185)
        return np.where(arco[:, None], hx('#2e1a0e'), out)
    cx((0.15, 0.6, 0.22, 0.58, 1.72, 2.2), {'frente': emissivo(frente_capelo), **NOG}, ch=0.006)
    for xx in (0.19, 0.56):
        o = novo()
        C().cilindro(xx, 0.585, 0.016, 1.74, 2.18, vol(xx, 0.585, LATAO, brilho=0.5), M, o, lados=8, tampa_mat=liso(LATAO_T))
    # o mostrador: a aro de latão, o fundo marfim com os 12 traços, os ponteiros e o pino
    zc0, R0 = 1.97, 0.145
    n_ = 26
    poly = [(xc + R0 * math.cos(2 * math.pi * i / n_), 0.581, zc0 + R0 * math.sin(2 * math.pi * i / n_)) for i in range(n_)]

    def mostrador(L, n, P):
        u, z = L[:, 0] - xc, L[:, 2] - zc0
        r = np.hypot(u, z)
        out = np.tile(hx('#ece4cc'), (len(L), 1))
        out = np.where((r > R0 - 0.045)[:, None], hx('#e2d6b0'), out)
        out = np.where((r > R0 - 0.02)[:, None], hx('#c9a24a'), out)
        out = np.where((r > R0 - 0.01)[:, None] & (u + z > 0)[:, None], hx('#9a7a28'), out)
        ang = np.arctan2(u, z)
        for h in range(12):
            a = h * math.pi / 6
            along = u * math.sin(a) + z * math.cos(a)
            perp = np.abs(u * math.cos(a) - z * math.sin(a))
            mk = (along > R0 - 0.052) & (along < R0 - 0.026) & (perp < 0.017 if h % 3 == 0 else perp < 0.011)
            out = np.where(mk[:, None], hx('#1e1812'), out)

        def mano(a, comp, esp):
            along = u * math.sin(a) + z * math.cos(a)
            perp = np.abs(u * math.cos(a) - z * math.sin(a))
            return (along > -0.012) & (along < comp) & (perp < esp)
        out = np.where(mano(math.radians(-60), 0.082, 0.013)[:, None], hx('#1e1812'), out)
        out = np.where(mano(math.radians(60), 0.116, 0.011)[:, None], hx('#1e1812'), out)
        out = np.where((r < 0.016)[:, None], hx('#b88e30'), out)
        return out
    fp(poly, (0, 1, 0), emissivo(mostrador), novo())
    # o coroamento: a cornija que sai, o frontão de degraus e a bola de latão no alto
    cx((0.12, 0.63, 0.19, 0.61, 2.2, 2.26), _pau('#3e2416', '#8a5a34', quina=1.25, b=(0, 0, 0, 0, 0, 2.26)))
    cx((0.17, 0.58, 0.24, 0.56, 2.26, 2.31), {'*': mad2('#4e2e1a', seed=46, passo=0.04), 'cima': liso('#6a4428')})
    cx((0.26, 0.49, 0.3, 0.5, 2.31, 2.35), {'*': mad2('#4e2e1a', seed=47, passo=0.04), 'cima': liso('#6a4428')})
    o = novo()
    _poligono_rodado(xc, 0.4, [(2.35, 0.025), (2.365, 0.04), (2.39, 0.04), (2.41, 0.02), (2.43, 0.0)], vol(xc, 0.4, LATAO, brilho=0.6), o, lados=10)
    peg(0.09, 0.66, 0.16, 0.64)


LATAO_T = '#e6c868'


# =====================================================================================================================
# o banco do piano (1 x 1, 0,5 m)
# =====================================================================================================================
def _banco_piano():
    x0, x1, y0, y1 = 0.075, 0.675, 0.17, 0.58
    LEA = _p1_rampa_couro()
    # as pernas torneadas (madeira escura com o pé de latão)
    for (px_, py_) in ((x0 + 0.05, y0 + 0.05), (x1 - 0.05, y0 + 0.05), (x0 + 0.05, y1 - 0.05), (x1 - 0.05, y1 - 0.05)):
        o = novo()
        _poligono_rodado(px_, py_, [(0.03, 0.032), (0.05, 0.04), (0.065, 0.03), (0.13, 0.026), (0.16, 0.038), (0.19, 0.026), (0.28, 0.03),
                                    (0.31, 0.04), (0.34, 0.034), (0.39, 0.042)], vol(px_, py_, '#4a2c1a', brilho=0.35), o, lados=10,
                         tampa_mat=liso('#6a4428'))
        o = novo()
        _poligono_rodado(px_, py_, [(0.0, 0.03), (0.012, 0.04), (0.03, 0.036)], vol(px_, py_, LATAO, brilho=0.55), o, lados=10, tampa_mat=liso(LATAO_T))
    # a cinta de madeira embaixo do assento, com o friso dourado
    cx((x0 + 0.015, x1 - 0.015, y0 + 0.01, y1 - 0.01, 0.34, 0.41), {'*': mad2('#4a2c1a', seed=51, passo=0.04), 'cima': liso('#4a2c1a')}, ch=0.006)
    cx((x0 + 0.01, x1 - 0.01, y0 + 0.005, y1 - 0.005, 0.405, 0.416), {'*': liso(LATAO), 'cima': liso(LATAO_T)})
    # o assento estofado de couro preto, alto e arredondado
    _p1_malha((x0 - 0.005, x1 + 0.005, y0 - 0.01, y1 + 0.01, 0.416, 0.5), (0.075, 0.075, 0.018, 0.05), LEA, seg=4)
    CZ.pegadas.append((x0, x1, y0, y1))


def _p1_rampa_couro():
    R = BE._p1_rampa(['#0a080a', '#161216', '#221d24', '#322b36', '#463e4c', '#5c5466'])
    return _p1_mat_rampa(R, 0.1, 3.3)


# =====================================================================================================================
# o console dourado (2 x 1, 0,88 m, empilhável)
# =====================================================================================================================
def _console():
    X0, X1, Y0, Y1 = 0.05, 1.45, 0.02, 0.46
    zt = 0.88
    G = dourado(seed=61)
    # o tampo de mármore saindo 2 cm, com a moldura de baixo dourada
    cx((X0, X1, Y0, Y1, zt - 0.04, zt), {'cima': marmore(MARM, MARM_V, seed=62), '*': marmore(MARM, MARM_V, seed=63)}, ch=0.006)
    cx((X0 + 0.01, X1 - 0.01, Y0 + 0.01, Y1 - 0.01, zt - 0.06, zt - 0.04), {'*': dourado(seed=64, passo=0.02), 'cima': liso(OURO)})

    def friso(eixo):
        def f(L, n, P):
            if abs(n[2]) > 0.5:
                return np.tile(hx(OURO), (len(P), 1))
            a = L[:, 0] if eixo == 'x' else L[:, 1]
            z = L[:, 2]
            out = np.tile(hx(OURO), (len(P), 1))
            qa = np.floor(a / PH)
            gad = (qa % 6)
            out = np.where((gad < 3)[:, None], _tom(out, 1.32), _tom(out, 0.64))
            out = np.where((z > zt - 0.06 - 0.0 - 2 * PZ)[:, None] & (z <= zt - 0.06 + 0.0 + 0.0)[:, None] | False, out, out)
            out = np.where((z < 0.735 + PZ)[:, None], _tom(hx(OURO), 0.62), out)
            out = np.where(((z >= 0.735 + PZ) & (z < 0.735 + 2 * PZ))[:, None], _tom(hx(OURO), 1.35), out)
            out = np.where((z > zt - 0.062 - PZ)[:, None], _tom(hx(OURO), 1.4), out)
            return out
        return emissivo(f)
    # o friso entalhado (gomos) nas quatro faces
    cx((X0 + 0.015, X1 - 0.015, Y0 + 0.015, Y1 - 0.015, 0.735, zt - 0.06), {'frente': friso('x'), 'costas': friso('x'), 'dir': friso('y'), 'esq': friso('y'), 'cima': liso(OURO)})
    # a concha dourada embaixo do meio do friso
    xm = (X0 + X1) / 2
    ang = [math.pi * i / 10 for i in range(11)]
    conc = [(xm + 0.09 * math.cos(a), 0.735 - 0.07 * math.sin(a)) for a in ang]

    def concha(L, n, P):
        d = np.hypot(L[:, 0] - xm, (L[:, 2] - 0.735) * 1.3)
        a = np.arctan2(L[:, 2] - 0.735, L[:, 0] - xm)
        out = np.tile(hx(OURO), (len(P), 1))
        rad = np.floor((np.pi + a) / math.pi * 7)
        out = np.where((rad % 2 == 0)[:, None], _tom(out, 1.25), _tom(out, 0.78))
        return np.where((d > 0.085)[:, None], _tom(hx(OURO), 0.6), out)
    MD.placa_xz([(x, z) for (x, z) in [(xm + 0.09 * math.cos(a), 0.735 - 0.08 * math.sin(a)) for a in ang]], Y1 - 0.045, Y1 - 0.01, emissivo(concha), o=novo(),
                mat_borda=liso('#7a5c18'))
    # as pernas cabriolé: o joelho com a folha de acanto, o tornozelo fino e o pé redondo (a curva em S, suave)
    zk = np.linspace(0.0, 0.74, 10)

    def raio(z):
        return float(np.interp(z, [0.0, 0.03, 0.06, 0.18, 0.4, 0.62, 0.72, 0.74], [0.04, 0.05, 0.042, 0.029, 0.035, 0.045, 0.056, 0.054]))

    def desl(z):
        return 0.0
    for (px_, py_, lado) in ((X0 + 0.07, Y1 - 0.07, 1), (X1 - 0.07, Y1 - 0.07, -1), (X0 + 0.07, Y0 + 0.07, 1), (X1 - 0.07, Y0 + 0.07, -1)):
        o = novo()
        for za, zb in zip(zk[:-1], zk[1:]):
            C().cilindro(px_ - lado * desl(za), py_, raio(za), za, zb, vol(px_, py_, OURO, brilho=0.55), M, o, lados=8, tampa=False, r1=raio(zb))
        # o pé: o disco com a voluta
        C().cilindro(px_, py_, 0.056, 0.0, 0.024, vol(px_, py_, OURO, brilho=0.5), M, o, lados=10, tampa_mat=liso(LATAO_T))
        # a folha de acanto no joelho
        C().elipsoide(np.array([px_ - lado * 0.01, py_ + (0.02 if py_ > 0.2 else -0.02), 0.7]), np.array([0.042, 0.032, 0.06]), liso(_hexa(_tom(hx(OURO), 1.2))), o)
    CZ.pegadas.append((X0, X1, Y0, Y1))


# =====================================================================================================================
# o vaso chinês de porcelana azul e branca, com os galhos de cerejeira (1 x 1, 1,2 m)
# =====================================================================================================================
def _vaso_grande():
    xc = yc = CASA / 2
    BR, AZ, AZE, AZC = '#eef1f2', '#2e4f9a', '#1c3270', '#6f92d0'

    def pintura(P, b):
        th = np.arctan2(P[:, 1] - yc, P[:, 0] - xc)
        z = P[:, 2]
        qa = np.floor(th * 0.16 / PH)
        qz = np.floor(z / PZ)
        out = b
        # as faixas do pé e do ombro (duas linhas azuis) e os pingentes de ruyi no ombro
        for (z0, z1) in ((0.075, 0.075 + PZ), (0.098, 0.098 + PZ), (0.5, 0.5 + PZ), (0.395, 0.395 + PZ)):
            out = np.where(((z >= z0) & (z < z1))[:, None], hx(AZ), out)
        ruy = (z > 0.405) & (z < 0.49) & (np.abs(((th / (2 * math.pi) * 12) % 1) - 0.5) * 0.17 < (0.49 - z) * 0.8 + 0.001) & (np.abs(((th / (2 * math.pi) * 12) % 1) - 0.5) < 0.42)
        out = np.where(ruy[:, None], hx(AZC), out)
        out = np.where((ruy & (z < 0.43)).astype(bool)[:, None], hx(AZ), out)
        # as peônias do corpo: o círculo azul com as pétalas e o miolo branco, ligadas pela trepadeira sinuosa
        k = th / (2 * math.pi) * 5
        fr = (k % 1) - 0.5
        rr = np.hypot(fr * 0.19 * 2 * math.pi / 5, (z - 0.25))
        flor = (z > 0.1) & (z < 0.4) & (rr < 0.062)
        out = np.where(flor[:, None], hx(AZ), out)
        out = np.where((flor & (rr < 0.04) & (np.sin(np.arctan2(z - 0.25, fr) * 5) > 0.1)).astype(bool)[:, None], hx(AZC), out)
        out = np.where((flor & (rr < 0.018)).astype(bool)[:, None], hx(BR), out)
        vid = (z > 0.1) & (z < 0.4) & (np.abs(z - (0.17 + 0.03 * np.sin(k * 2 * math.pi * 2))) < 0.008) & (np.abs(fr) > 0.15)
        out = np.where(vid[:, None], hx(AZE), out)
        fol = (z > 0.1) & (z < 0.4) & (np.abs(fr) > 0.28) & (np.abs(fr) < 0.46) & (np.abs(z - 0.34 + 0.04 * np.abs(fr)) < 0.022 * (0.5 - np.abs(fr)) * 3)
        out = np.where(fol[:, None], hx(AZC), out)
        return out
    o = novo()
    perfil = [(0.0, 0.088), (0.03, 0.098), (0.045, 0.088), (0.12, 0.14), (0.24, 0.186), (0.3, 0.192), (0.38, 0.175), (0.45, 0.13), (0.5, 0.082),
              (0.54, 0.066), (0.6, 0.07), (0.625, 0.088)]
    _poligono_rodado(xc, yc, perfil, vol(xc, yc, BR, brilho=0.55, faixas=pintura), o, lados=28)

    def boca(L, n, P):
        rr = np.hypot(P[:, 0] - xc, P[:, 1] - yc)
        return np.where((rr > 0.088 - 0.016)[:, None], hx('#dfe5f0'), hx('#16120e'))
    _disco(xc, yc, 0.625, 0.088, emissivo(boca), o, lados=28)
    CZ.pegadas.append((xc - 0.2, xc + 0.2, yc - 0.2, yc + 0.2))
    # os galhos de cerejeira: finos, marrons, saindo da boca; e as flores em cachos
    hv, rv = BE.frente_tela()
    ramos = [
        [(0.0, 0.62), (-0.04, 0.78), (-0.12, 0.92), (-0.21, 1.02), (-0.28, 1.1)],
        [(0.0, 0.62), (0.03, 0.8), (0.1, 0.95), (0.19, 1.07), (0.25, 1.15)],
        [(0.0, 0.62), (0.0, 0.84), (-0.02, 1.02), (0.02, 1.14), (0.03, 1.22)],
        [(-0.04, 0.78), (-0.1, 0.86), (-0.17, 0.88)],
        [(0.1, 0.95), (0.06, 1.05), (0.0, 1.1)],
        [(-0.12, 0.92), (-0.1, 1.04), (-0.13, 1.12)],
    ]
    ob = novo()
    for r_ in ramos:
        _fita(r_, xc, yc, liso('#4a2c1c'), ob, 0.026)
    # os cachos de flor (esferas de 3 rosas) ao longo dos galhos
    rosas = ['#f6c4d0', '#ea9fb4', '#fbe4ea', '#f0b0c0']
    k = 0
    for r_ in ramos:
        for (s, z) in r_[2:]:
            for j in range(4):
                dx = (ruido(k, j, 4.0) - 0.5) * 0.09
                dz = (ruido(k, j, 5.0) - 0.5) * 0.09
                ofl = novo(contorno=False)
                C().elipsoide(np.array([xc + (s + dx) * rv[0] + hv[0] * 0.02, yc + (s + dx) * rv[1] + hv[1] * 0.02, z + dz]),
                              np.array([0.04, 0.04, 0.036]), liso(rosas[(k + j) % 4]), ofl)
            k += 1
    # as folhinhas verdes novas
    for (s, z) in ((-0.17, 0.9), (0.14, 1.0), (0.0, 1.1)):
        for sg in (-1, 1):
            C().elipsoide(np.array([xc + (s + sg * 0.03) * rv[0], yc + (s + sg * 0.03) * rv[1], z - 0.03]), np.array([0.018, 0.018, 0.012]), liso('#5a8a3a'), novo(contorno=False))


# =====================================================================================================================
# a lareira de mármore (3 x 1, 2,4 m)
# =====================================================================================================================
def _espelho_vidro(x0, x1, z0, z1, seed=0):
    """O vidro do espelho: o azul-acinzentado claro em degraus, as faixas de reflexo na diagonal e a beirada biselada."""
    def f(L, n, P):
        u, z = L[:, 0], L[:, 2]
        qa, qb = np.floor((u - x0) / PH), np.floor((z - z0) / PZ)
        W, H = (x1 - x0) / PH, (z1 - z0) / PZ
        t = qb / H
        out = np.where((t < 0.33)[:, None], hx('#8aa0ae'), np.where((t < 0.66)[:, None], hx('#9db2be'), hx('#b0c4ce')))
        s_ = qa + qb
        out = np.where(((s_ % 26) < 3)[:, None], hx('#d6e4ea'), out)
        out = np.where((((s_ % 26) == 7) | ((s_ % 26) == 9))[:, None], hx('#c4d4dc'), out)
        out = np.where(((qa > W * 0.1) & (qa < W * 0.16) & (qb > H * 0.1))[:, None], _tom(out, 0.86), out)
        out = np.where(((qa > W * 0.62) & (qa < W * 0.74) & (qb > H * 0.45) & (qb < H * 0.8))[:, None], _tom(out, 1.06), out)
        bd = np.minimum(np.minimum(qa, W - 1 - qa), np.minimum(qb, H - 1 - qb))
        out = np.where((bd < 1)[:, None], hx('#6a7e8a'), out)
        out = np.where(((bd >= 1) & (bd < 2))[:, None], hx('#dbe8ee'), out)
        return out
    return emissivo(f)


def _concha_mat(xc, zc, R, cor=OURO):
    """O leque de concha entalhado (listras que saem do centro de baixo): o coroamento do espelho e as ferragens."""
    c0 = hx(cor)

    def f(L, n, P):
        d = np.hypot(L[:, 0] - xc, (L[:, 2] - zc))
        a = np.arctan2(L[:, 2] - zc, L[:, 0] - xc)
        rad = np.floor((a % (2 * math.pi)) / math.pi * 8)
        t = np.tile(c0, (len(L), 1))
        out = np.where((rad % 2 == 0)[:, None], _tom(t, 1.28), _tom(t, 0.8))
        out = np.where((d < R * 0.22)[:, None], _tom(t, 0.62), out)
        return np.where((d > R * 0.9)[:, None], _tom(t, 1.3), out)
    return emissivo(f)


def _lareira(acesa):
    def d():
        FX0, FX1 = 0.69, 1.56            # a boca da fornalha (x)
        ZB = 0.8                         # o alto da boca
        cxf = (FX0 + FX1) / 2

        def perto(P):
            dd = np.hypot((P[:, 0] - cxf) / 0.85, (P[:, 1] - 0.3) / 0.7)
            return np.clip(1.15 - dd, 0, 1) * np.clip(1.25 - P[:, 2] / 0.6, 0, 1)
        T = MD._brilho_fogo(perto, 0.45, '#d8742a') if acesa else None

        def tinge_fuligem(L, n, P, out):
            k = np.clip((P[:, 2] - 0.1) / 0.7, 0, 1)
            kq = np.round(k * 3) / 3
            out = out * (1 - 0.5 * kq[:, None]) + np.array([12.0, 9.0, 9.0]) * 0.5 * kq[:, None]
            return T(L, n, P, out) if T is not None else out

        def piso(L, n, P):
            o_ = marmore(GRAF, GRAF_V, seed=71)(L, n, P)
            return T(L, n, P, o_) if T is not None else o_
        # o piso de mármore grafite (a laje da lareira, saindo para a frente) com o filete creme
        cx((0.1, 2.15, 0.0, 0.72, 0.0, 0.035), {'cima': emissivo(piso), '*': marmore(GRAF, GRAF_V, seed=72)}, ch=0.006)
        cx((0.06, 2.19, 0.0, 0.75, 0.0, 0.012), {'cima': marmore(MARM, MARM_V, seed=73), '*': marmore(MARM, MARM_V, seed=74)})
        # os batentes: o plinto, o fuste com a almofada de mármore mais escuro, o capitel de moldura
        for (a, b) in ((0.14, 0.62), (1.63, 2.11)):
            cx((a - 0.025, b + 0.025, 0.0, 0.5, 0.035, 0.2), {'*': marmore(MARM, MARM_V, seed=75), 'cima': marmore(MARM, MARM_V, seed=76)}, ch=0.01)
            cx((a, b, 0.02, 0.46, 0.2, 0.9), {'*': marmore(MARM, MARM_V, seed=77 + int(a)), 'cima': marmore(MARM, MARM_V, seed=78)}, ch=0.006)
            cx((a + 0.07, b - 0.07, 0.46, 0.475, 0.3, 0.8), {'*': marmore('#d6cdb8', '#a89d86', seed=79 + int(a)), 'cima': liso('#e6dfd0')}, ch=0.004)
            cx((a - 0.025, b + 0.025, 0.0, 0.5, 0.9, 1.0), {'*': marmore(MARM, MARM_V, seed=80), 'cima': marmore(MARM, MARM_V, seed=81)}, ch=0.01)
        # as paredes de dentro da fornalha (tijolo escuro com a fuligem) e o fundo
        FU = MD.cantaria('#4a4440', 4, 9, seed=82, tinge=tinge_fuligem)
        cx((FX0, FX1, 0.0, 0.12, 0.035, ZB + 0.07), {'*': FU, 'costas': marmore(MARM, MARM_V, seed=83)})
        cx((0.61, FX0, 0.0, 0.42, 0.035, ZB + 0.07), {'dir': FU, 'esq': marmore(MARM, MARM_V, seed=84), '*': marmore(MARM, MARM_V, seed=84)})
        cx((FX1, 1.64, 0.0, 0.42, 0.035, ZB + 0.07), {'esq': FU, 'dir': marmore(MARM, MARM_V, seed=85), '*': marmore(MARM, MARM_V, seed=85)})
        cx((FX0, FX1, 0.12, 0.42, 0.035, 0.04), {'cima': emissivo(lambda L, n, P: tinge_fuligem(L, n, P, np.tile(hx('#2e2a28'), (len(P), 1)))), '*': None}, o=novo(contorno=False))
        # a moldura de mármore grafite em volta da boca (saliente) e a verga de mármore creme com o escudo dourado
        GF = {'*': marmore(GRAF, GRAF_V, seed=86), 'cima': marmore(GRAF, GRAF_V, seed=87)}
        cx((0.61, 0.69, 0.4, 0.5, 0.035, ZB + 0.07), GF, ch=0.004)
        cx((1.56, 1.64, 0.4, 0.5, 0.035, ZB + 0.07), GF, ch=0.004)
        cx((0.61, 1.64, 0.4, 0.5, ZB, ZB + 0.07), GF, ch=0.004)
        cx((0.12, 2.13, 0.0, 0.46, ZB + 0.07, 0.96), {'*': marmore(MARM, MARM_V, seed=88), 'cima': marmore(MARM, MARM_V, seed=89)}, ch=0.006)
        cx((0.97, 1.28, 0.46, 0.475, 0.9, 0.99), {'*': dourado(seed=90), 'frente': _concha_mat(1.125, 0.9, 0.16)}, ch=0.004)
        for xx in (0.85, 1.4):
            cx((xx - 0.025, xx + 0.025, 0.46, 0.472, 0.93, 0.96), liso(LATAO_T))
        # o consolo: a moldura de baixo e o tampo de mármore saindo para a frente
        cx((0.05, 2.2, 0.0, 0.55, 0.96, 1.0), {'*': marmore(MARM, MARM_V, seed=91), 'cima': marmore(MARM, MARM_V, seed=92)}, ch=0.01)
        cx((0.02, 2.23, 0.0, 0.62, 1.0, 1.07), {'*': marmore(MARM, MARM_V, seed=93), 'cima': marmore(MARM, MARM_V, seed=94)}, ch=0.014)
        # o corpo da chaminé (o peito) acima do consolo, com a cornija de cima
        cx((0.3, 1.95, 0.0, 0.2, 1.07, 2.34), {'*': marmore(MARM, MARM_V, seed=95), 'cima': marmore(MARM, MARM_V, seed=96)}, ch=0.006)
        cx((0.38, 0.5, 0.2, 0.212, 1.14, 2.26), {'*': marmore('#d6cdb8', '#a89d86', seed=97), 'cima': liso('#e6dfd0')}, ch=0.003)
        cx((1.75, 1.87, 0.2, 0.212, 1.14, 2.26), {'*': marmore('#d6cdb8', '#a89d86', seed=98), 'cima': liso('#e6dfd0')}, ch=0.003)
        cx((0.24, 2.01, 0.0, 0.26, 2.34, 2.37), {'*': marmore(MARM, MARM_V, seed=99), 'cima': marmore(MARM, MARM_V, seed=100)}, ch=0.006)
        cx((0.18, 2.07, 0.0, 0.32, 2.37, 2.4), {'*': marmore(MARM, MARM_V, seed=101), 'cima': marmore(MARM, MARM_V, seed=102)}, ch=0.01)
        # o espelho de moldura dourada: a moldura larga, o filete interno, o vidro e o coroamento de concha
        mx0, mx1, mz0, mz1, mw = 0.53, 1.72, 1.2, 2.1, 0.1
        G = dourado(seed=103, passo=0.03)
        GT = dourado(seed=104, eixo=1, passo=0.03)
        og = novo()
        cx((mx0, mx1, 0.2, 0.26, mz0, mz0 + mw), {'*': G, 'cima': GT}, o=og, ch=0.008)
        cx((mx0, mx1, 0.2, 0.26, mz1 - mw, mz1), {'*': G, 'cima': GT}, o=og, ch=0.008)
        cx((mx0, mx0 + mw, 0.2, 0.26, mz0 + mw, mz1 - mw), {'*': G, 'cima': GT}, o=og, ch=0.008)
        cx((mx1 - mw, mx1, 0.2, 0.26, mz0 + mw, mz1 - mw), {'*': G, 'cima': GT}, o=og, ch=0.008)
        cx((mx0 + mw, mx1 - mw, 0.2, 0.215, mz0 + mw, mz1 - mw), _espelho_vidro(mx0 + mw, mx1 - mw, mz0 + mw, mz1 - mw))
        cx((mx0 + mw - 0.02, mx1 - mw + 0.02, 0.2, 0.268, mz0 + mw - 0.02, mz0 + mw), liso(LATAO_T))
        cx((mx0 + mw - 0.02, mx1 - mw + 0.02, 0.2, 0.268, mz1 - mw, mz1 - mw + 0.02), liso(LATAO_T))
        cx((mx0 + mw - 0.02, mx0 + mw, 0.2, 0.268, mz0 + mw, mz1 - mw), liso(LATAO_T))
        cx((mx1 - mw, mx1 - mw + 0.02, 0.2, 0.268, mz0 + mw, mz1 - mw), liso(LATAO_T))
        # os florões dos cantos
        for (xx, zz) in ((mx0, mz0), (mx1, mz0), (mx0, mz1), (mx1, mz1)):
            cx((xx - 0.07, xx + 0.07, 0.2, 0.28, zz - 0.07, zz + 0.07), {'*': G, 'frente': _concha_mat(xx, zz, 0.08)}, ch=0.01)
        # o coroamento: a concha grande no meio e as duas volutas
        xm = (mx0 + mx1) / 2
        ang = [math.pi * i / 12 for i in range(13)]
        MD.placa_xz([(xm + 0.2 * math.cos(a), mz1 + 0.01 + 0.13 * math.sin(a)) for a in ang], 0.2, 0.27, _concha_mat(xm, mz1 + 0.01, 0.2), o=novo(),
                    mat_borda=liso('#8a6a1c'))
        for sg in (-1, 1):
            MD.placa_xz([(xm + sg * (0.26 + 0.07 * math.cos(a)), mz1 + 0.04 + 0.05 * math.sin(a)) for a in ang], 0.2, 0.26, dourado(seed=108), o=novo(),
                        mat_borda=liso('#8a6a1c'))
        o = novo()
        _poligono_rodado(xm, 0.23, [(mz1 + 0.13, 0.0), (mz1 + 0.135, 0.022), (mz1 + 0.16, 0.026), (mz1 + 0.18, 0.012), (mz1 + 0.195, 0.0)], vol(xm, 0.23, OURO, brilho=0.6), o, lados=10)
        # em cima do consolo: o relógio de mesa dourado no meio e os dois castiçais de latão
        zc = 1.07
        og = novo()
        cx((1.0, 1.25, 0.3, 0.5, zc, zc + 0.04), {'*': dourado(seed=109), 'cima': liso(OURO)}, o=og, ch=0.004)
        cx((1.025, 1.225, 0.32, 0.48, zc + 0.04, zc + 0.3), {'*': dourado(seed=110, eixo=1), 'cima': liso(LATAO_T)}, o=og, ch=0.01)

        def mostr(L, n, P):
            u, z = L[:, 0] - 1.125, L[:, 2] - (zc + 0.17)
            r = np.hypot(u, z)
            out = np.tile(hx('#ece4cc'), (len(L), 1))
            out = np.where((r > 0.065)[:, None], hx('#c9a24a'), out)
            for h in (0, 3, 6, 9):
                a = h * math.pi / 6
                along = u * math.sin(a) + z * math.cos(a)
                perp = np.abs(u * math.cos(a) - z * math.sin(a))
                out = np.where(((along > 0.045) & (along < 0.062) & (perp < 0.01))[:, None], hx('#1e1812'), out)
            al = u * math.sin(-1.0) + z * math.cos(-1.0)
            pe = np.abs(u * math.cos(-1.0) - z * math.sin(-1.0))
            out = np.where(((al > 0) & (al < 0.05) & (pe < 0.008))[:, None], hx('#1e1812'), out)
            al = u * math.sin(1.1) + z * math.cos(1.1)
            pe = np.abs(u * math.cos(1.1) - z * math.sin(1.1))
            out = np.where(((al > 0) & (al < 0.058) & (pe < 0.007))[:, None], hx('#1e1812'), out)
            return out
        poly = [(1.125 + 0.078 * math.cos(2 * math.pi * i / 20), 0.482, zc + 0.17 + 0.078 * math.sin(2 * math.pi * i / 20)) for i in range(20)]
        fp(poly, (0, 1, 0), emissivo(mostr), novo())
        oc = novo()
        C().elipsoide(np.array([1.125, 0.4, zc + 0.3]), np.array([0.1, 0.08, 0.05]), liso('#d2aa44'), oc)
        o = novo()
        _poligono_rodado(1.125, 0.4, [(zc + 0.34, 0.0), (zc + 0.345, 0.015), (zc + 0.365, 0.018), (zc + 0.385, 0.008), (zc + 0.4, 0.0)], vol(1.125, 0.4, OURO, brilho=0.6), o, lados=8)
        CZ.itens_peq.append((1.0, 1.25, 0.3, 0.5, zc))
        for xx in (0.6, 1.66):
            o = novo()
            _poligono_rodado(xx, 0.4, [(zc, 0.055), (zc + 0.015, 0.055), (zc + 0.04, 0.026), (zc + 0.09, 0.015), (zc + 0.115, 0.03), (zc + 0.15, 0.014),
                                       (zc + 0.22, 0.014), (zc + 0.245, 0.034), (zc + 0.27, 0.024)], vol(xx, 0.4, LATAO, brilho=0.55), o, lados=10, tampa_mat=liso(LATAO_T))
            C().cilindro(xx, 0.4, 0.016, zc + 0.27, zc + 0.4, vol(xx, 0.4, '#f0e8d2'), M, o, lados=8, tampa_mat=liso('#faf4e2'))
            if acesa:
                ob = luz_obj()
                C().elipsoide(np.array([xx, 0.4, zc + 0.435]), np.array([0.02, 0.02, 0.04]), liso('#ffd060'), ob)
                ob2 = luz_obj()
                C().elipsoide(np.array([xx + 0.002, 0.4, zc + 0.43]), np.array([0.011, 0.011, 0.024]), liso('#fffbe0'), ob2)
            CZ.itens_peq.append((xx - 0.055, xx + 0.055, 0.345, 0.455, zc))
        # a grade de latão dentro da fornalha: o cesto com as barras da frente, os cães com a bola e as lenhas em cima
        yb0, yb1 = 0.14, 0.38
        LAT = ES.latao()
        ob = novo()
        cx((0.88, 1.38, yb1 - 0.012, yb1 + 0.012, 0.28, 0.305), LAT, o=ob)
        cx((0.88, 1.38, yb0, yb0 + 0.024, 0.28, 0.305), LAT, o=ob)
        for xx in (0.88, 1.38 - 0.024):
            cx((xx, xx + 0.024, yb0, yb1 + 0.012, 0.28, 0.305), LAT, o=ob)
        for k in range(12):
            xx = 0.9 + k * 0.0435
            cx((xx, xx + 0.012, yb1 - 0.006, yb1 + 0.006, 0.07, 0.28), LAT, o=ob)
        cx((0.88, 1.38, yb1 - 0.012, yb1 + 0.012, 0.055, 0.07), LAT, o=ob)
        for xx in (0.87, 1.37):
            o = novo()
            _poligono_rodado(xx + 0.012, yb1 + 0.01, [(0.035, 0.03), (0.06, 0.03), (0.08, 0.016), (0.25, 0.016), (0.28, 0.026), (0.31, 0.03), (0.34, 0.02), (0.36, 0.0)],
                             vol(xx + 0.012, yb1 + 0.01, LATAO, brilho=0.55), o, lados=8)
        # o leito de brasas (aceso: brilha) e as lenhas
        CV = OC.carvao('#2a2220' if acesa else '#1c1816', brasa=0.7 if acesa else 0.0, seed=7, celula=(5, 3))
        OC.bloco((cxf - 0.02, 0.26, 0.11), (0.5, 0.2, 0.09), {'*': CV}, yaw=0)
        if acesa:
            for (bx, by, bw, bh, cc) in ((cxf - 0.16, 0.34, 0.1, 0.012, '#ff9a3c'), (cxf + 0.1, 0.33, 0.12, 0.012, '#ffb04a'), (cxf - 0.02, 0.22, 0.14, 0.012, '#ff8a30'),
                                         (cxf + 0.2, 0.25, 0.07, 0.012, '#ffd070'), (cxf - 0.22, 0.24, 0.07, 0.012, '#ffd070')):
                ob = luz_obj()
                C().elipsoide(np.array([bx, by, 0.152]), np.array([bw / 2, bw / 3, bh * 2.0]), liso(cc), ob)
        MD.tora(cxf - 0.06, 0.24, 0.22, 0.52, 0.055, 0, acesa, seed=11)
        MD.tora(cxf + 0.05, 0.31, 0.21, 0.5, 0.05, 6, acesa, seed=12)
        MD.tora(cxf - 0.01, 0.275, 0.3, 0.44, 0.048, -8, acesa, seed=13)
        # o guarda-fogo de latão na frente da lareira (a grade baixa com as bolas nas pontas)
        og = novo()
        cx((0.64, 1.62, 0.64, 0.668, 0.17, 0.2), LAT, o=og)
        cx((0.64, 1.62, 0.64, 0.668, 0.04, 0.06), LAT, o=og)
        for k in range(20):
            xx = 0.67 + k * 0.047
            cx((xx, xx + 0.012, 0.646, 0.658, 0.06, 0.17), LAT, o=og)
        for xx in (0.64, 1.62 - 0.028):
            cx((xx, xx + 0.028, 0.42, 0.668, 0.17, 0.2), LAT, o=og)
            cx((xx, xx + 0.028, 0.42, 0.668, 0.04, 0.06), LAT, o=og)
        for xx in (0.654, 1.606):
            oo = novo()
            _poligono_rodado(xx, 0.654, [(0.04, 0.018), (0.2, 0.018), (0.215, 0.026), (0.24, 0.026), (0.255, 0.0)], vol(xx, 0.654, LATAO, brilho=0.55), oo, lados=8)
        # as ferramentas: o suporte com o atiçador, a pá e a pinça (de ferro com cabo de latão)
        sx, sy = 1.96, 0.56
        o = novo()
        C().cilindro(sx, sy, 0.075, 0.035, 0.058, vol(sx, sy, LATAO, brilho=0.55), M, o, lados=12, tampa_mat=liso(LATAO_T))
        C().cilindro(sx, sy, 0.014, 0.058, 0.66, vol(sx, sy, LATAO, brilho=0.55), M, o, lados=8, tampa_mat=liso(LATAO_T))
        cx((sx - 0.1, sx + 0.1, sy - 0.008, sy + 0.008, 0.64, 0.66), LAT)
        FER = MD.ferro('#2a2624', '#5a524c')
        for (dx, tipo) in ((-0.085, 'pa'), (0.0, 'poker'), (0.085, 'pinca')):
            xx = sx + dx
            of = novo()
            cx((xx - 0.007, xx + 0.007, sy - 0.007, sy + 0.007, 0.16, 0.62), FER, o=of)
            cx((xx - 0.01, xx + 0.01, sy - 0.01, sy + 0.01, 0.5, 0.62), LAT)
            if tipo == 'pa':
                cx((xx - 0.034, xx + 0.034, sy - 0.006, sy + 0.006, 0.07, 0.17), FER, o=of)
            elif tipo == 'poker':
                cx((xx - 0.02, xx + 0.02, sy - 0.006, sy + 0.006, 0.13, 0.16), FER, o=of)
            else:
                cx((xx - 0.026, xx + 0.026, sy - 0.006, sy + 0.006, 0.1, 0.16), FER, o=of)
        peg(0.06, 2.19, 0.0, 0.75)
    return d


# =====================================================================================================================
# as escadas nobres (3 x 2): a que sobe e a que desce
# =====================================================================================================================
def tapete_escada(u0, u1):
    """O tapete vinho da escada: a ourela escura de 1 px, a barra dourada de 2 px, o friso fino e o campo com o losango miúdo."""
    def f(L, n, P):
        u = L[:, 0]
        bd = np.minimum(u - u0, u1 - u) / PH
        a = L[:, 1] if abs(n[2]) > 0.5 else L[:, 2]
        qa = np.floor(a / (PH if abs(n[2]) > 0.5 else PZ))
        out = np.tile(hx(VINHO), (len(L), 1))
        qu = np.floor((u - u0) / PH)
        los = (np.abs((qu % 6) - 2.5) + np.abs((qa % 6) - 2.5)) < 1.6
        out = np.where((los & (bd > 6.5))[:, None], hx('#7e2430'), out)
        out = np.where(((bd >= 5) & (bd < 6.2))[:, None], hx('#a8842e'), out)
        out = np.where(((bd >= 3) & (bd < 5))[:, None], hx(VINHO_E), out)
        out = np.where(((bd >= 1) & (bd < 3))[:, None], hx('#c8963c'), out)
        out = np.where((bd < 1)[:, None], hx('#3a0e14'), out)
        return out
    return emissivo(f)


def _baluster(x, y, z0, z1, cor='#4a2c1a'):
    """O balaústre torneado de madeira escura: o pé quadrado, o vaso, a haste comprida, o anel e o colarinho."""
    o = novo()
    perfil = [(z0, 0.017), (z0 + 0.035, 0.017), (z0 + 0.05, 0.011), (z0 + 0.09, 0.012), (z0 + 0.12, 0.023), (z0 + 0.15, 0.012), (z0 + 0.19, 0.011),
              (z1 - 0.1, 0.011), (z1 - 0.085, 0.018), (z1 - 0.07, 0.012), (z1 - 0.03, 0.012), (z1, 0.017)]
    _poligono_rodado(x, y, perfil, vol(x, y, cor, brilho=0.3), o, lados=8, tampa_mat=liso('#6a4428'))


def _newel(x, y, z0, z1, lado=0.1):
    """O pilar de ponta (newel): o fuste de nogueira com a moldura de latão, o capitel e a bola de latão."""
    h = lado / 2
    NG = {'*': mad2('#4a2c1a', eixo=1, seed=301, passo=0.04), 'cima': liso('#6a4428')}
    cx((x - h, x + h, y - h, y + h, z0, z1), NG, ch=0.006)
    cx((x - h - 0.012, x + h + 0.012, y - h - 0.012, y + h + 0.012, z0 + 0.14, z0 + 0.19), {'*': dourado(seed=302), 'cima': liso(LATAO_T)})
    cx((x - h - 0.012, x + h + 0.012, y - h - 0.012, y + h + 0.012, z1 - 0.07, z1), _pau('#3e2416', '#7a5232', quina=1.25, b=(0, 0, 0, 0, 0, z1)))
    cx((x - h * 0.7, x + h * 0.7, y - h * 0.7, y + h * 0.7, z1, z1 + 0.04), NG)
    o = novo()
    C().elipsoide(np.array([x, y, z1 + 0.09]), np.array([0.052, 0.052, 0.055]), liso(_hexa(_tom(hx(OURO), 1.05))), o, brilho=0.5)


def _escada_nobre():
    W, N, R, T, V = 2.25, 6, 0.2, 0.25, 1.5
    u0, u1 = (W - 1.25) / 2, (W + 1.25) / 2
    LAT = ES.latao()
    TAP = tapete_escada(u0, u1)

    def zh(v):
        return R + (R / T) * (V - v) + 0.92
    for k in range(N):
        vhi, vlo, zk = V - T * k, V - T * (k + 1), R * (k + 1)
        MR = marmore('#d8d0bc', '#a89d86', seed=210 + k)
        cx((0.0, W, vlo, vhi, 0.0, zk - 0.028), {'frente': MR, '*': marmore(MARM, MARM_V, seed=220 + k), 'cima': marmore(MARM, MARM_V, seed=230 + k)})
        cx((0.0, W, vlo, vhi, zk - 0.028, zk), {'*': marmore('#f0e9da', MARM_V, seed=240 + k), 'cima': marmore(MARM, MARM_V, seed=250 + k)}, ch=0.004)
    # o tapete vinho (cobre a quina do degrau) e os varões de latão na dobra de cada degrau
    for k in range(N):
        vhi, vlo, zk = V - T * k, V - T * (k + 1), R * (k + 1)
        zp = R * k + (0.012 if k else 0.0)
        cx((u0, u1, vlo, vhi, zk, zk + 0.012), {'cima': TAP, '*': liso(VINHO_E)}, o=novo(contorno=False))
        cx((u0, u1, vhi, vhi + 0.014, zp, zk + 0.012), {'frente': TAP, '*': liso(VINHO_E), 'cima': TAP}, o=novo(contorno=False))
        ov = novo()
        cx((u0 - 0.06, u1 + 0.06, vhi + 0.014, vhi + 0.036, zp, zp + 0.024), LAT, o=ov)
        for uu in (u0 - 0.08, u1 + 0.06):
            cx((uu, uu + 0.02, vhi + 0.012, vhi + 0.04, zp - 0.002, zp + 0.034), liso(LATAO_T), o=ov)
    # a balaustrada dos dois lados: o corrimão inclinado, os balaústres (dois por degrau) e os pilares de ponta
    for uc in (0.075, W - 0.075):
        ES._prisma((uc, V - 0.03, zh(V - 0.03)), (uc, 0.06, zh(0.06)), 0.06, 0.055, _pau('#4a2c1a', '#8a5a34', quina=False), novo())
        ES._prisma((uc, V - 0.03, zh(V - 0.03) - 0.04), (uc, 0.06, zh(0.06) - 0.04), 0.03, 0.02, _pau('#2e1a0e', '#4a2c1a', quina=False), novo())
        for k in range(N):
            vhi, zk = V - T * k, R * (k + 1)
            for dv in (0.14, 0.22):
                v = vhi - dv
                _baluster(uc, v, zk, zh(v) - 0.045)
        _newel(uc, V - 0.052, 0.0, zh(V - 0.05) + 0.06)
        _newel(uc, 0.052, R * N, zh(0.052) + 0.07)
    peg(0.0, W, 0.0, V)


def _escada_nobre_desce():
    W, V = 2.25, 1.5
    U0, U1, V0, V1 = 0.14, W - 0.14, 0.14, V - 0.06
    FUNDO, N, R = -1.1, 5, 0.15
    LAT = ES.latao()
    MP = marmore(MARM, MARM_V, seed=260)
    ES._poco(U0, U1, V0, V1, FUNDO, MP)
    t = (V1 - V0) / N
    u0, u1 = (W - 1.25) / 2, (W + 1.25) / 2
    TAP = tapete_escada(u0, u1)
    for k in range(N):
        va, vb = V1 - t * (k + 1), V1 - t * k
        top = -R * (k + 1)
        cx((U0, U1, va, vb, FUNDO, top), {'cima': ES.escuro_fundo(marmore(MARM, MARM_V, seed=270 + k), 0.0, FUNDO),
                                          '*': ES.escuro_fundo(marmore('#d8d0bc', '#a89d86', seed=280 + k), 0.0, FUNDO)}, o=novo(contorno=False))
        cx((u0, u1, va, vb, top, top + 0.012), {'cima': ES.escuro_fundo(TAP, 0.0, FUNDO), '*': ES.escuro_fundo(liso(VINHO_E), 0.0, FUNDO)}, o=novo(contorno=False))
        cx((u0 - 0.06, u1 + 0.06, vb - 0.03, vb - 0.008, top + 0.012, top + 0.032), ES.escuro_fundo(LAT, 0.0, FUNDO), o=novo(contorno=False))
    # o piso de mármore grafite em volta do vão (as margens) com o filete creme
    GR = {'cima': marmore(GRAF, GRAF_V, seed=261), '*': marmore(GRAF, GRAF_V, seed=262)}
    for b in ((0.0, U0, 0.0, V), (U1, W, 0.0, V), (U0, U1, 0.0, V0), (U0, U1, V1, V)):
        cx(b + (0.0, 0.018), GR, ch=0.004)
    for b in ((0.0, 0.03, 0.0, V), (W - 0.03, W, 0.0, V), (0.03, W - 0.03, 0.0, 0.03), (0.03, W - 0.03, V - 0.03, V)):
        cx(b + (0.0, 0.02), {'cima': marmore(MARM, MARM_V, seed=263), '*': marmore(MARM, MARM_V, seed=264)})
    # a balaustrada: nos dois lados e no fundo (a frente é a entrada), o corrimão reto, os balaústres e os pilares nos quatro cantos
    ZH = 0.92
    uL, uR = 0.075, W - 0.075
    vB = 0.075
    vF = V - 0.07
    NG = _pau('#4a2c1a', '#8a5a34', quina=False)
    cx((uL - 0.03, uL + 0.03, vB, vF, ZH, ZH + 0.055), NG, o=novo())
    cx((uR - 0.03, uR + 0.03, vB, vF, ZH, ZH + 0.055), NG, o=novo())
    cx((uL, uR, vB - 0.03, vB + 0.03, ZH, ZH + 0.055), NG, o=novo())
    for uc in (uL, uR):
        cx((uc - 0.015, uc + 0.015, vB, vF, 0.018, 0.05), _pau('#2e1a0e', '#4a2c1a', quina=False), o=novo())
    cx((uL, uR, vB - 0.015, vB + 0.015, 0.018, 0.05), _pau('#2e1a0e', '#4a2c1a', quina=False), o=novo())
    n_lado = 9
    for i in range(1, n_lado):
        v = vB + (vF - vB) * i / n_lado
        _baluster(uL, v, 0.05, ZH - 0.0)
        _baluster(uR, v, 0.05, ZH - 0.0)
    n_fundo = 15
    for i in range(1, n_fundo):
        u = uL + (uR - uL) * i / n_fundo
        _baluster(u, vB, 0.05, ZH - 0.0)
    for (x, y) in ((uL, vB), (uR, vB), (uL, vF), (uR, vF)):
        _newel(x, y, 0.0, ZH + 0.08)
    ES._por_cima_do_chao((U0, U1, V0, V1))
    peg(0.0, W, 0.0, V)


# =====================================================================================================================
# o piano de cauda (3 x 2, 1,05 m; a tampa levantada passa disso)
# =====================================================================================================================
def _norm3(v):
    v = np.asarray(v, float)
    return v / np.linalg.norm(v)


def placa_cordas(x0, W0, yF):
    """O interior do piano: a placa de ferro dourada com os feixes de cordas (riscas de 1 px ao longo de y), as travessas e o cavilhal."""
    def f(L, n, P):
        u, v = L[:, 0], L[:, 1]
        qa = np.floor((u - x0) / PH)
        out = np.tile(hx('#a67e34'), (len(L), 1))
        # a madeira do tampo harmônico aparece nas bordas
        out = np.where(((u - x0) < 0.1)[:, None], hx('#7a4e2c'), out)
        # as cordas: aço no agudo, cobre no grave
        cord = ((qa % 4) != 3) & (v > 0.14) & (v < yF - 0.3) & ((u - x0) > 0.1)
        out = np.where((cord & ((u - x0) < 0.45))[:, None], hx('#b8683a'), out)
        out = np.where((cord & ((u - x0) >= 0.45))[:, None], hx('#b2aea2'), out)
        out = np.where((cord & ((u - x0) >= 0.45) & ((qa % 4) == 0)).astype(bool)[:, None], hx('#c8c4b8'), out)
        # as travessas de ferro da placa (faixas largas entre as cordas)
        for yc in (0.5, 0.88, 1.08):
            fx = (np.abs(v - yc) < 0.035) & ((u - x0) > 0.1)
            out = np.where(fx[:, None], hx('#d4aa4c'), out)
            out = np.where((fx & (np.abs(v - yc) > 0.022)).astype(bool)[:, None], hx('#8a6420'), out)
        # o cavilhal na frente e os pinos
        cav = (v > yF - 0.3) & (v < yF - 0.12)
        out = np.where(cav[:, None], hx('#3a2418'), out)
        out = np.where((cav & ((qa % 3) == 0) & (np.floor(v / PH) % 2 == 0)).astype(bool)[:, None], hx('#c8c4b6'), out)
        out = np.where(((v >= yF - 0.12))[:, None], hx('#241810'), out)
        return out
    return emissivo(f)


def teclado(xk0, xk1, yk0, yk1):
    """O teclado visto de cima: as teclas brancas (2 px mais 1 px de fresta) e as pretas (grupos de 2 e de 3)."""
    def f(L, n, P):
        u, v = L[:, 0], L[:, 1]
        qa = np.floor((u - xk0) / PH).astype(int)
        k = qa % 3
        g = qa // 3
        out = np.tile(hx('#f2eee2'), (len(L), 1))
        out = np.where((k == 0)[:, None], hx('#fbf8ee'), out)
        out = np.where((k == 2)[:, None], hx('#6a6458'), out)
        out = np.where((v > yk1 - PH * 1.5)[:, None], hx('#d2cdbe'), out)
        pat = np.isin(g % 7, (0, 1, 3, 4, 5))
        negra = pat & (k >= 1) & (v < yk0 + 0.6 * (yk1 - yk0))
        out = np.where(negra[:, None], hx('#1a171c'), out)
        out = np.where((negra & (k == 1) & (v < yk0 + 0.56 * (yk1 - yk0))).astype(bool)[:, None], hx('#383440'), out)
        return out
    return emissivo(f)


def partitura(x0, x1, z0, z1):
    """A partitura aberta no atril: o papel creme, as pautas em riscas e as notas, a dobra do meio."""
    def f(L, n, P):
        u, z = L[:, 0], L[:, 2]
        qa, qb = np.floor((u - x0) / PH), np.floor((z - z0) / PZ)
        W = (x1 - x0) / PH
        out = np.tile(hx('#f0e9d6'), (len(L), 1))
        sis = qb % 9
        marg = (qa > 2) & (qa < W - 3) & (qb > 1)
        linha = marg & (sis >= 1) & (sis <= 5) & (sis % 2 == 1) & (np.floor(qb / 9) < 3)
        out = np.where(linha[:, None], hx('#8a8474'), out)
        nota = marg & (sis >= 1) & (sis <= 5) & (sis % 2 == 0) & (ruido(np.floor(qa / 3), np.floor(qb / 9), 5.0) > 0.6) & (qa % 3 == 1) & (np.floor(qb / 9) < 3)
        out = np.where(nota[:, None], hx('#1e1a16'), out)
        out = np.where((np.abs(qa - W / 2) < 0.6)[:, None], hx('#c4bca8'), out)
        out = np.where(((qa < 1) | (qa >= W - 1) | (qb < 1))[:, None], hx('#d2c9b2'), out)
        return out
    return emissivo(f)


def _piano_perfil():
    return [(0.0, 1.0), (0.09, 1.0), (0.2, 0.94), (0.32, 0.9), (0.45, 0.93), (0.58, 0.9), (0.7, 0.78), (0.8, 0.62), (0.89, 0.43), (0.95, 0.25),
            (0.985, 0.1), (1.0, 0.0)]


def _piano():
    x0, W0, yF, Lc = 0.2, 1.75, 1.38, 1.32
    zb, zr, zp = 0.62, 0.98, 0.9          # o fundo da caixa, a beira, a placa
    pts = [(x0, yF)] + [(x0 + wf * W0, yF - s * Lc) for (s, wf) in _piano_perfil()]
    n = len(pts)
    O = np.array([x0 + 0.34 * W0, yF - 0.45 * Lc])
    # a normal para fora de cada aresta e de cada vértice
    def n_aresta(a, b):
        d = np.array(b) - np.array(a)
        nn = np.array([d[1], -d[0]])
        nn = nn / np.linalg.norm(nn)
        m = (np.array(a) + np.array(b)) / 2
        return nn if (m - O) @ nn > 0 else -nn
    ne = [n_aresta(pts[i], pts[(i + 1) % n]) for i in range(n)]
    nv = []
    for i in range(n):
        s = ne[i - 1] + ne[i]
        nv.append(s / np.linalg.norm(s))
    th = 0.05
    ins = [(pts[i][0] - th * nv[i][0], pts[i][1] - th * nv[i][1]) for i in range(n)]
    LC = laca()
    LT = laca('#26252e', brilho=False)
    LTAMPA = laca('#26252e', faixas=True)
    o = novo()
    for i in range(n):
        j = (i + 1) % n
        a, b = pts[i], pts[j]
        q, r = ins[i], ins[j]
        nn = ne[i]
        # a parede de fora, a beira de cima, a parede de dentro
        fp([(a[0], a[1], zb), (b[0], b[1], zb), (b[0], b[1], zr), (a[0], a[1], zr)], (nn[0], nn[1], 0.0), LC, o)
        fp([(a[0], a[1], zr), (b[0], b[1], zr), (r[0], r[1], zr), (q[0], q[1], zr)], (0, 0, 1), LT, o)
        fp([(q[0], q[1], zp), (r[0], r[1], zp), (r[0], r[1], zr), (q[0], q[1], zr)], (-nn[0], -nn[1], 0.0), LC, o)
        fp([(a[0], a[1], zb), (b[0], b[1], zb), (r[0], r[1], zb), (q[0], q[1], zb)], (0, 0, -1), LT, o)
    # a placa de ferro com as cordas
    op = novo(contorno=False)
    PLC = placa_cordas(x0, W0, yF)
    for i in range(n):
        j = (i + 1) % n
        fp([(O[0], O[1], zp), (ins[i][0], ins[i][1], zp), (ins[j][0], ins[j][1], zp)], (0, 0, 1), PLC, op)
    # o teclado: o fundo do teclado, as duas bochechas, as teclas e a tabuleta do nome
    xk0, xk1 = x0 + 0.14, x0 + W0 - 0.14
    yk1 = 1.52
    cx((xk0, xk1, yF - 0.02, yk1, 0.63, 0.74), {'*': LC, 'cima': LT})
    for (a, b) in ((x0, xk0), (xk1, x0 + W0)):
        cx((a, b, yF - 0.1, yk1, 0.62, 0.92), {'*': LC, 'cima': LT}, ch=0.008)
    cx((xk0, xk1, yF - 0.2 + 0.18, yk1 - 0.02, 0.74, 0.762), {'cima': teclado(xk0, xk1, yF - 0.02, yk1 - 0.02), 'frente': liso('#e8e4d6'), '*': liso('#2a2626')}, o=novo(contorno=False))
    cx((xk0, xk1, yF - 0.04, yF + 0.02, 0.762, 0.95), {'*': LC, 'cima': LT})
    cx((x0 + W0 / 2 - 0.2, x0 + W0 / 2 + 0.2, yF + 0.02, yF + 0.028, 0.84, 0.856), liso(LATAO_T))
    # o atril com a partitura aberta
    xa0, xa1 = x0 + W0 / 2 - 0.42, x0 + W0 / 2 + 0.42
    cx((xa0, xa1, yF + 0.0, yF + 0.07, 0.95, 0.975), {'*': LC, 'cima': LT})
    oa = novo()
    fp([(xa0, yF + 0.06, 0.96), (xa1, yF + 0.06, 0.96), (xa1, yF - 0.04, 1.3), (xa0, yF - 0.04, 1.3)], (0, 0.96, 0.29), LC, oa, dois=True)
    zs0, zs1 = 0.99, 1.26
    pg = partitura(xa0 + 0.05, xa1 - 0.05, zs0, zs1)
    fp([(xa0 + 0.05, yF + 0.052, zs0), (xa1 - 0.05, yF + 0.052, zs0), (xa1 - 0.05, yF - 0.028, zs1), (xa0 + 0.05, yF - 0.028, zs1)], (0, 0.96, 0.29), pg, novo(), dois=True)
    # a tampa levantada: presa na lombada (a lateral reta) e erguida no escorete
    ang = math.radians(48)
    ca, sa = math.cos(ang), math.sin(ang)

    def lid(x, y, esp=0.0):
        sx = x - x0
        return (x0 + sx * ca + esp * sa, y, zr + 0.012 + sx * sa - esp * ca)
    nin = (sa, 0.0, -ca)
    ol = novo()
    for i in range(n):
        j = (i + 1) % n
        a, b = pts[i], pts[j]
        # a face de dentro (virada para baixo e para o lado da câmera) e a de fora (escura, polida)
        fp([lid(O[0], O[1]), lid(a[0], a[1]), lid(b[0], b[1])], nin, LTAMPA, ol, dois=True)
        fp([lid(O[0], O[1], -0.034), lid(b[0], b[1], -0.034), lid(a[0], a[1], -0.034)], (-sa, 0.0, ca), LTAMPA, ol, dois=True)
        nn = ne[i]
        fp([lid(a[0], a[1]), lid(b[0], b[1]), lid(b[0], b[1], -0.034), lid(a[0], a[1], -0.034)], (nn[0] * ca, nn[1], nn[0] * sa), LC, ol, dois=True)
    # o escorete (a haste de apoio) e o pé dele na beira
    xb = 1.72
    ES._prisma((xb, 0.72, zr), lid(x0 + 1.5, 0.72, -0.034), 0.028, 0.028, _pau('#14131a', '#2e2c36', quina=False), novo())
    # as dobradiças de latão na lombada
    for yy in (0.3, 0.7, 1.1):
        cx((x0 - 0.012, x0 + 0.04, yy - 0.05, yy + 0.05, zr, zr + 0.03), liso(LATAO_T))
    # as pernas torneadas de laca (duas na frente, uma na cauda) com a rodinha de latão
    for (px_, py_, rr) in ((x0 + 0.1, yF + 0.0, 0.056), (x0 + W0 - 0.1, yF + 0.0, 0.056), (x0 + 0.42, 0.2, 0.052)):
        cx((px_ - 0.1, px_ + 0.1, py_ - 0.1, py_ + 0.1, zb - 0.07, zb), {'*': LC, 'cima': LT}, ch=0.01)
        o2 = novo()
        _poligono_rodado(px_, py_, [(0.06, 0.03), (0.09, 0.034), (0.13, 0.04), (0.45, rr), (0.5, rr * 1.1), (zb - 0.07, rr * 1.2)], laca_vol(px_, py_), o2, lados=10, tampa_mat=LT)
        ow = novo()
        _poligono_rodado(px_, py_, [(0.0, 0.022), (0.01, 0.034), (0.045, 0.034), (0.06, 0.03)], vol(px_, py_, LATAO, brilho=0.6), ow, lados=10, tampa_mat=liso(LATAO_T))
    # o pedaleiro: os dois montantes e a barra, com os três pedais de latão
    xm = x0 + W0 / 2
    cx((xm - 0.16, xm + 0.16, yF - 0.06, yF + 0.02, 0.1, 0.62), {'*': LC, 'cima': LT})
    for dx in (-0.09, 0.0, 0.09):
        cx((xm + dx - 0.025, xm + dx + 0.025, yF + 0.02, yF + 0.16, 0.06, 0.085), {'*': liso(LATAO), 'cima': liso(LATAO_T)})
    peg(x0, x0 + W0, 0.06, yk1)


def laca_vol(cx_, cy_):
    """A laca preta das peças redondas (pernas): a mesma rampa de pretos do vol, com o brilho."""
    return vol(cx_, cy_, '#26252e', brilho=0.85)


# =====================================================================================================================
# a palmeira areca no vaso de latão (1 x 1, 2,4 m)
# =====================================================================================================================
def _palmeira():
    xc = yc = CASA / 2
    zt = 0.42
    # o vaso de latão polido: o pé, a barriga, a faixa em relevo e a borda
    def faixas(P, b):
        z = P[:, 2]
        b = np.where(((z > 0.19) & (z <= 0.19 + PZ))[:, None], _tom(b, 0.66), b)
        b = np.where(((z > 0.19 + PZ) & (z <= 0.19 + 2 * PZ))[:, None], _tom(b, 1.3), b)
        b = np.where(((z > 0.25) & (z <= 0.25 + PZ))[:, None], _tom(b, 0.66), b)
        b = np.where(((z > 0.25 + PZ) & (z <= 0.25 + 2 * PZ))[:, None], _tom(b, 1.3), b)
        b = np.where(((z > zt - 0.04) & (z <= zt - 0.04 + PZ))[:, None], _tom(b, 0.7), b)
        b = np.where(((z > zt - 0.04 + PZ))[:, None], _tom(b, 1.12), b)
        return b
    o = novo()
    perfil = [(0.0, 0.15), (0.025, 0.19), (0.06, 0.2), (0.09, 0.185), (0.12, 0.2), (0.36, 0.25), (0.385, 0.268), (zt, 0.268)]
    _poligono_rodado(xc, yc, perfil, vol(xc, yc, LATAO, brilho=0.7, faixas=faixas), o, lados=26)

    def terra(L, n, P):
        rr = np.hypot(P[:, 0] - xc, P[:, 1] - yc)
        out = np.where((rr > 0.245)[:, None], hx(LATAO_T), hx('#3a281c'))
        pont = (rr < 0.24) & (ruido(np.floor(P[:, 0] / (2 * PH)), np.floor(P[:, 1] / (2 * PH)), 9.0) > 0.86)
        out = np.where(pont[:, None], hx('#5a4230'), out)
        return out
    _disco(xc, yc, zt, 0.268, emissivo(terra), o, lados=26)
    CZ.pegadas.append((xc - 0.27, xc + 0.27, yc - 0.27, yc + 0.27))
    # as hastes (os caules verdes-amarelados, com os nós) e as frondes arqueadas
    CAULE = _pau('#8a9a3e', '#aab85a', quina=False)
    NO = _pau('#5a6a26', '#7a8a3a', quina=False)
    fr = [(1.5, 20, 0.62, 0.7, 1.15, 0.3), (1.4, 80, 0.6, 0.72, 1.2, 0.3), (1.65, 140, 0.62, 0.78, 1.2, 0.3), (1.45, 200, 0.6, 0.7, 1.15, 0.3),
          (1.6, 260, 0.62, 0.74, 1.2, 0.3), (1.35, 320, 0.58, 0.64, 1.1, 0.28), (1.85, 50, 0.4, 0.9, 1.1, 0.27), (1.8, 190, 0.4, 0.9, 1.1, 0.27),
          (1.95, 300, 0.32, 0.95, 1.1, 0.25), (1.2, 110, 0.5, 0.5, 1.0, 0.27), (1.15, 230, 0.5, 0.5, 1.0, 0.27), (1.1, 350, 0.48, 0.5, 1.0, 0.26)]
    VERDES = ['#3a8040', '#2f6c36', '#46904c', '#2a5e30', '#3a7a3a']
    k = 0
    for (hT, yaw, Hr, Vr, Dr, Lmax) in fr:
        Hr, Lmax = Hr * 0.72, Lmax * 0.85
        a = math.radians(yaw)
        dh = np.array([math.cos(a), math.sin(a), 0.0])
        b0 = np.array([xc + 0.045 * dh[0], yc + 0.045 * dh[1], zt])
        T = np.array([xc + 0.11 * dh[0], yc + 0.11 * dh[1], hT])
        oc = novo()
        nseg = max(3, int((hT - zt) / 0.28))
        for i in range(nseg):
            p0 = b0 + (T - b0) * i / nseg
            p1 = b0 + (T - b0) * (i + 1) / nseg
            ES._prisma(tuple(p0), tuple(p1), 0.022, 0.022, CAULE, oc)
            if i:
                C().cilindro(float(p0[0]), float(p0[1]), 0.02, float(p0[2]) - 0.012, float(p0[2]) + 0.012, vol(float(p0[0]), float(p0[1]), '#5a6a26'), M, oc, lados=6)

        def P_(s, T=T, dh=dh, Hr=Hr, Vr=Vr, Dr=Dr):
            return T + dh * (Hr * s) + np.array([0.0, 0.0, Vr * s - Dr * s * s])
        of = novo()
        ns = 12
        for i in range(ns):
            ES._prisma(tuple(P_(i / ns)), tuple(P_((i + 1) / ns)), 0.018, 0.018, _pau('#5a7a2c', '#7a9a3c', quina=False), of)
        # os folíolos: dois por estação, abertos para os lados e caídos, a ponta voltada para a ponta da fronde
        nj = 12
        for j in range(nj):
            s = 0.16 + 0.78 * j / (nj - 1)
            Pp = P_(s)
            t = P_(s + 0.01) - P_(s - 0.01)
            t = t / np.linalg.norm(t)
            h = np.cross(t, [0, 0, 1.0])
            if np.linalg.norm(h) < 1e-3:
                h = np.array([-dh[1], dh[0], 0.0])
            h = h / np.linalg.norm(h)
            ll = Lmax * (math.sin(math.pi * min(1.0, max(0.0, (s - 0.04) * 1.08))) ** 0.55)
            for sg in (-1, 1):
                ang = math.radians(28 + 18 * ruido(j, k, 3.0 + sg))
                d = sg * h * math.cos(ang) - np.array([0, 0, 1.0]) * math.sin(ang) + t * 0.45
                d = d / np.linalg.norm(d)
                w0 = 0.052
                q0, q1 = Pp - t * w0, Pp + t * w0
                q2, q3 = Pp + d * ll + t * 0.012, Pp + d * ll - t * 0.01
                nn = np.cross(q1 - q0, q3 - q0)
                if np.linalg.norm(nn) < 1e-9:
                    continue
                nn = nn / np.linalg.norm(nn)
                cor = VERDES[int(ruido(j * 3 + sg, k, 5.0) * 5) % 5]
                fp([tuple(q0), tuple(q1), tuple(q2), tuple(q3)], tuple(nn), liso(cor), of, dois=True)
        k += 1


# =====================================================================================================================
# os tapetes (decalques de 1 px, sem pegada): o longo do pórtico, o redondo e a passadeira do corredor
# =====================================================================================================================
def _tapete_longo():
    """O tapete vermelho comprido (2 x 8): vinho profundo, a barra dourada com o friso de losangos, o campo com os medalhões, franjas."""
    x0, x1, y0, y1 = 0.06, 1.44, 0.14, 5.86
    U, V = (x1 - x0) / PH, (y1 - y0) / PH
    vin, vin2 = hx('#6a1a24'), hx('#7c2230')
    esc, ouro, ouro2, crem = hx('#4a1018'), hx('#d4a844'), hx('#a8842e'), hx('#e6d4a8')

    def f(L, n, P):
        u, v = np.floor((P[:, 0] - x0) / PH), np.floor((P[:, 1] - y0) / PH)
        out = np.tile(vin, (len(P), 1))
        bd = np.minimum(np.minimum(u, U - 1 - u), np.minimum(v, V - 1 - v))
        # o campo: as cruzinhas miúdas e os medalhões em fila no meio (losango dourado com o miolo escuro)
        cu, cv = (u % 10) - 5, (v % 10) - 5
        cruz = ((np.abs(cu) < 1) & (np.abs(cv) < 2)) | ((np.abs(cv) < 1) & (np.abs(cu) < 2))
        out = np.where((cruz & (bd > 20))[:, None], vin2, out)
        P_ = 74.0
        vm = (v % P_) - P_ / 2
        du = u - U / 2
        q = np.abs(du) / 15.0 + np.abs(vm) / 24.0
        med = (bd > 18) & (q < 1.0) & (np.floor(v / P_) < 3)
        out = np.where(med[:, None], esc, out)
        out = np.where((med & (q > 0.8)).astype(bool)[:, None], ouro, out)
        q2 = np.abs(du) / 7.0 + np.abs(vm) / 11.0
        out = np.where((med & (q2 < 1.0))[:, None], vin, out)
        out = np.where((med & (np.abs(du) + np.abs(vm) < 3.5)).astype(bool)[:, None], ouro, out)
        out = np.where((med & (np.abs(du) + np.abs(vm) < 1.5)).astype(bool)[:, None], crem, out)
        # a barra: o friso de losangos dourados entre as linhas
        al = np.where((np.minimum(v, V - 1 - v) < 18) & (np.minimum(u, U - 1 - u) >= 18), u, v)
        barra = (bd >= 5) & (bd < 17)
        out = np.where(barra[:, None], esc, out)
        lb = (al % 12) - 5.5
        los = barra & (np.abs(lb) + np.abs(bd - 10.5) < 4.6)
        out = np.where(los[:, None], ouro, out)
        out = np.where((barra & (np.abs(lb) + np.abs(bd - 10.5) < 2.0)).astype(bool)[:, None], vin, out)
        out = np.where((bd == 17)[:, None], ouro2, out)
        out = np.where((bd == 18)[:, None], vin2, out)
        out = np.where(((bd >= 3) & (bd < 5))[:, None], vin2, out)
        out = np.where(((bd >= 1) & (bd < 3))[:, None], ouro, out)
        out = np.where((bd < 1)[:, None], hx('#2a0a10'), out)
        return out
    CA._tapete(x0, x1, y0, y1, f, franja='y', borda='#2a0a10')


def _tapete_redondo():
    """O tapete redondo (3 x 3): vinho com o medalhão dourado no meio e o anel de arabescos (pétalas) na beira."""
    xc = yc = 1.125
    R = 1.08
    RP = R / PH
    vin, vin2 = hx('#6a1a24'), hx('#7c2230')
    esc, ouro, ouro2, crem, verde = hx('#4a1018'), hx('#d4a844'), hx('#a8842e'), hx('#e6d4a8'), hx('#1f3a2a')

    def f(L, n, P):
        dx, dy = (P[:, 0] - xc) / PH, (P[:, 1] - yc) / PH
        r = np.hypot(dx, dy)
        th = np.arctan2(dy, dx)
        e = RP - r
        out = np.tile(vin, (len(P), 1))
        # o campo: os pontinhos em anéis
        pt = (r > 22) & (r < RP - 16) & (np.floor(th / (2 * math.pi) * 36) % 2 == 0) & (np.abs((r % 8) - 4) < 0.8)
        out = np.where(pt[:, None], vin2, out)
        # o anel de arabescos: as pétalas alternadas (douradas e creme) entre filetes
        ring = (e >= 6) & (e < 14)
        out = np.where(ring[:, None], esc, out)
        k = th / (2 * math.pi) * 28
        fr = (k % 1) - 0.5
        rr = e - 10
        pet = ring & (((fr * 4.2) ** 2 + (rr / 3.6) ** 2) < 1)
        out = np.where((pet & (np.floor(k) % 2 == 0))[:, None], ouro, out)
        out = np.where((pet & (np.floor(k) % 2 == 1))[:, None], crem, out)
        out = np.where((pet & (((fr * 4.2) ** 2 + (rr / 3.6) ** 2) < 0.25)).astype(bool)[:, None], vin, out)
        out = np.where((ring & (np.abs(fr) > 0.46) & (np.abs(rr) < 1.2)).astype(bool)[:, None], verde, out)
        out = np.where((np.abs(e - 14.5) < 0.6)[:, None], ouro2, out)
        out = np.where((np.abs(e - 5.5) < 0.6)[:, None], ouro2, out)
        out = np.where(((e >= 3) & (e < 5))[:, None], vin2, out)
        out = np.where(((e >= 1) & (e < 3))[:, None], ouro, out)
        out = np.where((e < 1)[:, None], hx('#2a0a10'), out)
        # o medalhão central: o anel dourado, o fundo escuro com a estrela de 8 pontas e o miolo
        med = r < 21
        out = np.where(med[:, None], esc, out)
        out = np.where((med & (r > 19)).astype(bool)[:, None], ouro, out)
        out = np.where((med & (r > 17) & (r <= 19)).astype(bool)[:, None], vin, out)
        pet2 = np.floor(th / (2 * math.pi) * 16) % 2
        out = np.where((med & (r > 10) & (r <= 17) & (pet2 == 0)).astype(bool)[:, None], vin2, out)
        out = np.where((med & (r > 10) & (r <= 17) & (pet2 == 1) & (np.abs((r % 3.5)) < 1.2)).astype(bool)[:, None], ouro2, out)
        est = r < (6.5 + 4.2 * np.cos(8 * th))
        out = np.where(((r < 12) & est)[:, None], ouro, np.where((r < 12)[:, None], vin, out))
        out = np.where((r < 4.2)[:, None], esc, out)
        out = np.where((r < 2.6)[:, None], crem, out)
        return out
    o = C().novo_obj(3)
    _disco(xc, yc, PZ * 0.9, R, emissivo(f), o, lados=96)
    # a beirada escura de 1 px em volta
    CZ.itens_peq.append((xc - 0.01, xc + 0.01, yc - 0.01, yc + 0.01, PZ * 0.9))
    CZ.itens_peq.pop()


# a grega (meandro): 8 linhas x 10 colunas, 1 = linha clara
GREGA = ["########.#",
         "#......#.#",
         "#.####.#.#",
         "#.#..#.#.#",
         "#.#.##.#.#",
         "#.#....#.#",
         "#.######.#",
         "#........#"]


def _tapete_corredor():
    """A passadeira do corredor (2 x 6): azul-petróleo e creme, a barra com a grega, o campo com o losango, franjas."""
    x0, x1, y0, y1 = 0.06, 1.44, 0.12, 4.38
    U, V = (x1 - x0) / PH, (y1 - y0) / PH
    teal, teal2, teal3 = hx('#1f4a52'), hx('#2a5a64'), hx('#16363e')
    crem, crem2 = hx('#e6dcc0'), hx('#b8ad90')
    G = np.array([[1 if ch == '#' else 0 for ch in row] for row in GREGA])

    def f(L, n, P):
        u, v = np.floor((P[:, 0] - x0) / PH).astype(int), np.floor((P[:, 1] - y0) / PH).astype(int)
        out = np.tile(teal, (len(P), 1))
        bd = np.minimum(np.minimum(u, U - 1 - u), np.minimum(v, V - 1 - v)).astype(int)
        # o campo: a rede de pontinhos e os losangos em fila no meio
        cu, cv = (u % 8) - 4, (v % 8) - 4
        out = np.where(((np.abs(cu) + np.abs(cv)) < 1.5)[:, None] & (bd > 16)[:, None], teal2, out)
        P_ = 46
        vm = (v % P_) - P_ / 2
        du = u - U / 2
        q = np.abs(du) / 15.0 + np.abs(vm) / 18.0
        med = (bd > 15) & (q < 1.0)
        out = np.where(med[:, None], teal3, out)
        out = np.where((med & (q > 0.84)).astype(bool)[:, None], crem, out)
        out = np.where((med & (np.abs(du) + np.abs(vm) < 5.5) & (np.abs(du) + np.abs(vm) > 3.5)).astype(bool)[:, None], crem2, out)
        out = np.where((med & (np.abs(du) + np.abs(vm) < 2.0)).astype(bool)[:, None], crem, out)
        # a barra com a grega: a linha de fora, a faixa de 8 px com o meandro, a linha de dentro
        barra = (bd >= 4) & (bd < 14)
        out = np.where(barra[:, None], teal3, out)
        along = np.where((np.minimum(v, V - 1 - v) < 14) & (np.minimum(u, U - 1 - u) >= 14), u, v)
        row = np.clip(bd - 5, 0, 7)
        col = along % 10
        quad = (col >= 1) & (col <= 8) & (row >= 1) & (row <= 6)
        anel = quad & ((col <= 2) | (col >= 7) | (row <= 2) | (row >= 5))
        liga = ((col == 0) | (col == 9)) & (row >= 3) & (row <= 4)
        gk = barra & (bd >= 5) & (bd < 13) & (anel | liga)
        out = np.where(gk[:, None], crem, out)
        out = np.where((bd == 14)[:, None], crem2, out)
        out = np.where(((bd >= 2) & (bd < 4))[:, None], teal2, out)
        out = np.where((bd == 1)[:, None], crem, out)
        out = np.where((bd == 0)[:, None], hx('#0e2228'), out)
        return out
    CA._tapete(x0, x1, y0, y1, f, franja='y', borda='#0e2228', franja_cor='#e6dcc0')


# =====================================================================================================================
ITENS = {
    'lustre_cristal': (1, 1, (0.0, 0.0), _lustre(True), {'1': _lustre(False)}),
    'coluna_marmore': (1, 1, (0.0, 0.0), _coluna, {}),
    'relogio_carrilhao': (1, 1, (0.0, 0.0), _relogio, {}),
    'banco_piano': (1, 1, (0.0, 0.0), _banco_piano, {}),
    'console_dourado': (2, 1, (0.0, 0.0), _console, {}),
    'vaso_grande': (1, 1, (0.0, 0.0), _vaso_grande, {}),
    'lareira_marmore': (3, 1, (0.0, 0.0), _lareira(True), {'1': _lareira(False)}),
    'escada_nobre': (3, 2, (0.0, 0.0), _escada_nobre, {}),
    'escada_nobre_desce': (3, 2, (0.0, 0.0), _escada_nobre_desce, {}),
    'piano_cauda': (3, 2, (0.0, 0.0), _piano, {}),
    'palmeira_vaso': (1, 1, (0.0, 0.0), _palmeira, {}),
    'tapete_longo': (2, 8, (0.0, 0.0), _tapete_longo, {}),
    'tapete_redondo': (3, 3, (0.0, 0.0), _tapete_redondo, {}),
    'tapete_corredor': (2, 6, (0.0, 0.0), _tapete_corredor, {}),
}
