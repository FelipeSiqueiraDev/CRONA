"""
GRUPO SANTA AMÁLIA (17/10): a cidade comum do interior de Minas onde a Hydra procura o Arantes, em pixel art 1:1
feita só por código, no acabamento dos prédios de Tiradentes (tiradentes.py) e dos móveis da cozinha e da casa.

Santa Amália é ATUAL (não colonial): o reboco pintado e gasto, a telha cerâmica, as janelas de alumínio e vidro com a
grade, a porta de madeira frisada, a calçada de cimento; por dentro, a geladeira, o fogão a gás, a máquina de lavar, o
rack com a TV, o posto de saúde (as cadeiras de espera, o balcão, a farmácia, a maca) e o cartório (o arquivo).
As referências do Felipe (plantas de cima): F:\\Dhellow\\CRONA\\arte\\santa-amalia\\ref\\ (casa-valenca, posto-saude,
cartorio).

Tudo desenhado no giro 4 (a frente para +y), a pegada começando em (0, 0), no tamanho do catálogo (shared/src/furni.ts,
o bloco "SANTA AMÁLIA (17/10)": width x depth em casas de 0,75 m; o `height` de lá está em METROS). A porta dos
prédios fica na face da frente, com o meio na casa floor(width / 2); os prédios são fechados dos quatro lados (o
interior é outra cena). Nenhum texto, número, logo ou símbolo oficial: a placa do posto tem só uma cruz azul (não a
cruz vermelha), a do cartório uma balança, a bandeira da prefeitura é lisa.

Estados: a janela de vidro (parede) 0 aberta (a folha de correr passada para o lado) / '1' fechada, como a janela da
cozinha.
"""
import math

import numpy as np

import cozinha as CZ
import base_estilo as BE
import fazenda_fora as FF
import vila_predios as VP
import tiradentes as TD
import parede_casa as PC
from base_estilo import hx, liso, mad2, tab2, vol, _tom, _poligono_rodado, _disco, PH, PZ
from motor import ruido, suave, emissivo, KX, KZ, MUNDO as M

CASA = 0.75
obj = FF.obj
caixa = FF.caixa
pegada = FF.pegada
pegada_redonda = FF.pegada_redonda
_bx = FF._bx
_hex = TD._hex
_escuro = TD._escuro

# o canvas do exportador reserva 4,6 m de alto: os prédios daqui usam o remendo do vila_predios
VP.ALTO_CANVAS.update({'casa_moderna': 5.0, 'casa_moderna~b': 5.0, 'casa_moderna~c': 5.0, 'casa_moderna~d': 5.0,
                       'casa_valenca': 5.2, 'posto_saude': 5.4, 'cartorio_predio': 5.6, 'prefeitura_predio': 9.6, 'lanchonete_predio': 5.0})

# ---------------------------------------------------------------- a paleta de Santa Amália
TELHA = ['#b85a32', '#c2643a', '#ac522e', '#c86e40']    # a telha cerâmica (mais nova que a de Tiradentes)
TELHA_J = '#5a2414'
CUMEEIRA = '#9e4628'
ALU = '#c4c8cc'            # o alumínio das janelas e das portas de vidro
ALU_C = '#e2e6e8'
GRANITO = '#b8b2a6'        # o peitoril e a soleira de granito claro
CIMENTO = ['#b4b0a6', '#aca89e', '#bab6ac']
CIMENTO_J = '#7e7a70'
BRANCO = '#f2f0ea'
PRETO = '#26262a'


# =====================================================================================================================
# os materiais
# =====================================================================================================================
def mat_parede(cor, seed=0, sujeira=0.5, descasca=0.0):
    """O reboco pintado e gasto: as manchas grandes da tinta, a sujeira que sobe do chão e, se gasto, o tijolo à mostra."""
    return FF.mat_reboco(cor, seed=seed, sujeira=sujeira, descasca=descasca, tijolo='#a8705a')


def mat_cimento(passo=1.0, eixo=0, seed=0):
    """A calçada de cimento: as placas com a junta de dilatação de 1 px."""
    return FF.mat_juntas(CIMENTO, lambda P: np.floor((P[:, eixo] + 50) / passo).astype(np.int64), CIMENTO_J, seed=seed)


def mat_ceramica(cores=('#b0603a', '#a85a36', '#b8683e'), passo=0.3, junta='#6a3a24', org=(0.0, 0.0)):
    """O piso de cerâmica quadrada (a varanda): a junta de 1 px nos dois sentidos e o lado claro de cada lajota."""
    cs = np.stack([hx(x) for x in cores])
    jc = hx(junta)

    def f(L, n, P):
        u, v = (P[:, 0] - org[0]) / passo, (P[:, 1] - org[1]) / passo
        iu, iv = np.floor(u), np.floor(v)
        out = cs[(ruido(iu * 31 + iv, 4.4) * len(cs)).astype(int) % len(cs)]
        gu, gv = (u - iu) * passo, (v - iv) * passo
        out = np.where(((gu >= PH) & (gu < 2 * PH))[:, None], _tom(out, 1.08), out)
        return np.where(((gu < PH) | (gv < PH))[:, None], jc, out)
    return emissivo(f)


def mat_cortina(cor, eixo_lat, a0, a1, z0, z1):
    """O vidro com a cortina fechada por trás: as pregas em faixas de 2 px e o reflexo do céu em diagonal."""
    c0 = hx(cor)

    def f(L, n, P):
        lat = P[:, 0] if eixo_lat == 0 else P[:, 1]
        u = (lat - a0) / (a1 - a0)
        v = (P[:, 2] - z0) / (z1 - z0)
        g = np.floor(lat / (2 * PH)) % 3
        out = np.where((g == 0)[:, None], _tom(c0, 0.82), np.where((g == 1)[:, None], c0, _tom(c0, 1.08)))
        out = np.where((v > 0.9)[:, None], _tom(c0, 0.7), out)
        d = v * 1.6 - u * 1.0
        out = np.where(((d > 0.55) & (d < 0.68))[:, None], out * 0.7 + 255 * 0.3, out)
        return out
    return emissivo(f)


def mat_vidro_azul(eixo_lat, a0, a1, z0, z1):
    """O vidro da porta e da janela de alumínio (por fora): o azul-escuro esverdeado e os dois reflexos em diagonal."""
    def f(L, n, P):
        lat = P[:, 0] if eixo_lat == 0 else P[:, 1]
        u = (lat - a0) / max(a1 - a0, 1e-6)
        v = (P[:, 2] - z0) / (z1 - z0)
        out = np.tile(hx('#2e4450'), (len(P), 1))
        out = np.where((v > 0.6)[:, None], hx('#38505c'), out)
        d = v * 1.5 - u * 1.2
        out = np.where(((d > 0.35) & (d < 0.52))[:, None], hx('#6a8a98'), out)
        out = np.where(((d > 0.66) & (d < 0.74))[:, None], hx('#56788a'), out)
        return out
    return emissivo(f)


# =====================================================================================================================
# o kit da fachada atual: a janela de alumínio com a grade, a porta frisada, a porta de vidro, o telhado de 4 águas
# =====================================================================================================================
def _ocupa_j(a, w, grade):
    return w / 2 + (0.1 if grade else 0.08)


def _conferir(vaos):
    """Nada em cima de nada na mesma fachada: ('j', a, z0, w, h) ou ('p', a, z0, w, h)."""
    erros = []
    for face, lista in vaos.items():
        cx = [(v, v[1] - v[3] / 2 - 0.1, v[1] + v[3] / 2 + 0.1, v[2] - 0.1, v[2] + v[4] + 0.1) for v in lista]
        for i in range(len(cx)):
            for k in range(i + 1, len(cx)):
                A, B_ = cx[i], cx[k]
                if A[1] < B_[2] and B_[1] < A[2] and A[3] < B_[4] and B_[3] < A[4]:
                    erros.append(f'{face}: {A[0][0]} em {A[0][1]:.2f} bate em {B_[0][0]} em {B_[0][1]:.2f}')
    if erros:
        raise ValueError('vãos encavalados na fachada: ' + '; '.join(erros))


def janela_alu(B, face, a, z0, w, h, vidro='azul', grade='#f0eee8', cortina=None, peitoril=True, basculante=False):
    """
    A janela de alumínio de correr: o vidro (azul, com cortina fechada ou escuro), o caixilho de alumínio, o trilho do
    meio (as duas folhas), o peitoril de granito e, por fora, a grade de ferro pintada (as barras de 1 px, o quadro).
    basculante: a janelinha alta do banheiro (o vidro canelado, sem grade, as três lâminas).
    """
    c = CZ.c
    p = FF._plano(B, face)
    bx = lambda l0, l1, e0, e1, za, zb: _bx(face, p, l0, l1, e0, e1, za, zb)
    a0, a1, z1 = a - w / 2, a + w / 2, z0 + h
    eixo_lat = 0 if face[1] == 'y' else 1
    if cortina:
        mv = mat_cortina(cortina, eixo_lat, a0, a1, z0, z1)
    elif basculante:
        def mv(L, n, P):
            lat = P[:, 0] if eixo_lat == 0 else P[:, 1]
            g = np.floor(lat / PH) % 3
            return np.where((g == 0)[:, None], hx('#9aaeb4'), np.where((g == 1)[:, None], hx('#b8cace'), hx('#a8bcc2')))
        mv = emissivo(mv)
    elif vidro == 'escuro':
        mv = FF.mat_vidro('escuro', eixo_lat, a0, a1, z0, z1)
    else:
        mv = mat_vidro_azul(eixo_lat, a0, a1, z0, z1)
    caixa(bx(a0, a1, -0.03, 0.004, z0, z1), mv)
    o = obj()
    m = {'*': liso(ALU), 'cima': liso(ALU_C)}
    e = 0.045
    for b in (bx(a0 - e, a0, 0, 0.04, z0 - e, z1 + e), bx(a1, a1 + e, 0, 0.04, z0 - e, z1 + e), bx(a0, a1, 0, 0.04, z1, z1 + e),
              bx(a0, a1, 0, 0.04, z0 - e, z0)):
        c.caixa(b, m, M, o)
    oc = obj(contorno=False)
    if basculante:
        for k in (1, 2):
            zz = z0 + h * k / 3
            c.caixa(bx(a0, a1, 0, 0.025, zz - PZ * 0.7, zz + PZ * 0.7), liso('#a8acb0'), M, oc)
    else:
        # o trilho do meio: as duas folhas de correr (uma na frente da outra)
        c.caixa(bx(a - 0.02, a + 0.02, 0, 0.03, z0, z1), liso('#aeb2b6'), M, oc)
    if peitoril:
        caixa(bx(a0 - 0.09, a1 + 0.09, 0, 0.08, z0 - e - 0.05, z0 - e), {'*': liso(_escuro(GRANITO, 0.9)), 'cima': liso(GRANITO)})
    if grade and not basculante:
        og = obj(contorno=False)
        g = liso(grade)
        gq = {'*': liso(grade), 'cima': liso(_hex(_tom(hx(grade), 1.1)))}
        ge0, ge1 = 0.06, 0.085
        # o quadro da grade (um pouco maior que o vão) e as barras
        caixa(bx(a0 - 0.06, a1 + 0.06, ge0, ge1, z1 + 0.02, z1 + 0.06), gq)
        caixa(bx(a0 - 0.06, a1 + 0.06, ge0, ge1, z0 - 0.04, z0), gq)
        for l in (a0 - 0.06, a1 + 0.02):
            caixa(bx(l, l + 0.04, ge0, ge1, z0 - 0.04, z1 + 0.06), gq)
        n = max(3, int(round(w / 0.12)))
        for k in range(1, n):
            l = a0 - 0.02 + (w + 0.04) * k / n
            c.caixa(bx(l - PH * 0.55, l + PH * 0.55, ge0 + 0.005, ge1 - 0.005, z0, z1 + 0.02), g, M, og)
        zm = z0 + h * 0.5
        c.caixa(bx(a0 - 0.02, a1 + 0.02, ge0 + 0.004, ge1 - 0.004, zm - PZ * 0.6, zm + PZ * 0.6), g, M, og)
        # as presilhas que prendem a grade na parede
        for l in (a0 - 0.04, a1 + 0.04):
            for zz in (z0 + 0.1, z1 - 0.06):
                caixa(bx(l - 0.015, l + 0.015, 0, ge0, zz - 0.015, zz + 0.015), liso(_escuro(grade, 0.8)), contorno=False)


def mat_porta_frisada(cor, a0, a1, z0, z1, eixo_lat=0):
    """A porta de madeira maciça: o veio em pé e os frisos horizontais de 1 px (a luz logo abaixo de cada friso)."""
    base = mad2(cor, eixo=1, seed=7, passo=0.06)
    c0 = hx(cor)

    def f(L, n, P):
        out = base(L, n, P)
        z = P[:, 2]
        k = (z - z0 - 0.3) / 0.22
        g = (k % 1) * 0.22
        fr = (z > z0 + 0.25) & (z < z1 - 0.2)
        out = np.where((fr & (g < PZ))[:, None], _tom(c0, 0.55), out)
        out = np.where((fr & (g >= PZ) & (g < 2 * PZ))[:, None], _tom(c0, 1.12), out)
        return out
    return emissivo(f)


def porta_frisada(B, face, a, z0, w, h, cor='#6a3e24', batente='#4a2a18'):
    """A porta de madeira frisada de uma folha, o batente, a soleira de granito e a maçaneta de alavanca."""
    p = FF._plano(B, face)
    bx = lambda l0, l1, e0, e1, za, zb: _bx(face, p, l0, l1, e0, e1, za, zb)
    a0, a1, z1 = a - w / 2, a + w / 2, z0 + h
    m = {'*': liso(batente), 'cima': liso(_hex(_tom(hx(batente), 1.15)))}
    caixa(bx(a0 - 0.06, a0, 0, 0.05, z0, z1 + 0.06), m)
    caixa(bx(a1, a1 + 0.06, 0, 0.05, z0, z1 + 0.06), m)
    caixa(bx(a0 - 0.06, a1 + 0.06, 0, 0.05, z1, z1 + 0.06), m)
    eixo_lat = 0 if face[1] == 'y' else 1
    caixa(bx(a0, a1, -0.03, 0.02, z0, z1), mat_porta_frisada(cor, a0, a1, z0, z1, eixo_lat))
    sg = 1 if face[0] == '+' else -1
    xm = a1 - 0.1 if sg > 0 else a0 + 0.1
    caixa(bx(xm - 0.02, xm + 0.02, 0.02, 0.05, z0 + 1.0, z0 + 1.08), liso('#c8ccd0'), contorno=False)
    caixa(bx(xm - 0.1 if sg > 0 else xm - 0.02, xm + 0.02 if sg > 0 else xm + 0.1, 0.04, 0.07, z0 + 1.02, z0 + 1.05), liso('#e0e4e6'), contorno=False)
    caixa(bx(a0 - 0.06, a1 + 0.06, 0, 0.1, z0 - 0.03, z0), {'*': liso(_escuro(GRANITO, 0.9)), 'cima': liso(GRANITO)})


def porta_vidro(B, face, a, z0, w, h):
    """A porta de vidro de duas folhas (o posto): o quadro de alumínio, os vidros, os puxadores de tubo e o rodapé."""
    c = CZ.c
    p = FF._plano(B, face)
    bx = lambda l0, l1, e0, e1, za, zb: _bx(face, p, l0, l1, e0, e1, za, zb)
    a0, a1, z1 = a - w / 2, a + w / 2, z0 + h
    eixo_lat = 0 if face[1] == 'y' else 1
    caixa(bx(a0, a1, -0.03, 0.005, z0, z1), mat_vidro_azul(eixo_lat, a0, a1, z0, z1))
    o = obj()
    m = {'*': liso(ALU), 'cima': liso(ALU_C)}
    e = 0.06
    for b in (bx(a0 - e, a0, 0, 0.05, z0, z1 + e), bx(a1, a1 + e, 0, 0.05, z0, z1 + e), bx(a0 - e, a1 + e, 0, 0.05, z1, z1 + e),
              bx(a - 0.025, a + 0.025, 0, 0.05, z0, z1), bx(a0, a1, 0, 0.05, z0, z0 + 0.12)):
        c.caixa(b, m, M, o)
    # a bandeira fixa em cima (a travessa) e os puxadores de tubo
    c.caixa(bx(a0, a1, 0, 0.05, z1 - 0.42, z1 - 0.38), m, M, o)
    for s in (-1, 1):
        l = a + s * 0.12
        caixa(bx(l - 0.015, l + 0.015, 0.07, 0.1, z0 + 0.75, z0 + 1.35), {'*': liso('#d8dcde'), 'cima': liso('#f2f4f4')})
        for zz in (z0 + 0.8, z0 + 1.3):
            caixa(bx(l - 0.012, l + 0.012, 0.04, 0.07, zz - 0.012, zz + 0.012), liso('#b4b8bc'), contorno=False)


def telhado4(B, ZE, ZR, BEI=0.4, eixo='x', seed=0, cores=TELHA, junta=TELHA_J, cumeeira=CUMEEIRA, testeira='#efe8da', esp=0.1):
    """
    O telhado de quatro águas de telha cerâmica: as duas águas compridas (trapézios), as duas pontas (triângulos), os
    espigões e a cumeeira com as telhas de capa, e a testeira em volta com a boca das telhas. ZE: a altura do telhado
    na linha da parede; ZR: a cumeeira. BEI: o beiral (negativo: o telhado cabe dentro da platibanda).
    """
    c = CZ.c
    X0, X1, Y0, Y1 = B
    if eixo == 'x':
        hd = (Y1 - Y0) / 2
    else:
        hd = (X1 - X0) / 2
    k = (ZR - ZE) / hd
    ZB = ZE - BEI * k
    EX0, EX1, EY0, EY1 = X0 - BEI, X1 + BEI, Y0 - BEI, Y1 + BEI
    nn = math.hypot(1.0, k)
    sin_t = k / nn
    o = obj()
    if eixo == 'x':
        hdE = (EY1 - EY0) / 2
        YR = (EY0 + EY1) / 2
        RX0, RX1 = EX0 + hdE, EX1 - hdE
        ridge = ((RX0, YR, ZR), (RX1, YR, ZR))
        faces = [
            ([(EX0, EY1, ZB), (EX1, EY1, ZB), (RX1, YR, ZR), (RX0, YR, ZR)], (0, k / nn, 1 / nn), (1, 0, 0), (0, -1 / nn, k / nn), 0),
            ([(EX1, EY0, ZB), (EX0, EY0, ZB), (RX0, YR, ZR), (RX1, YR, ZR)], (0, -k / nn, 1 / nn), (1, 0, 0), (0, 1 / nn, k / nn), 0),
            ([(EX1, EY1, ZB), (EX1, EY0, ZB), (RX1, YR, ZR)], (k / nn, 0, 1 / nn), (0, 1, 0), (-1 / nn, 0, k / nn), 1),
            ([(EX0, EY0, ZB), (EX0, EY1, ZB), (RX0, YR, ZR)], (-k / nn, 0, 1 / nn), (0, 1, 0), (1 / nn, 0, k / nn), 1),
        ]
        hips = [((EX0, EY0, ZB), ridge[0]), ((EX0, EY1, ZB), ridge[0]), ((EX1, EY0, ZB), ridge[1]), ((EX1, EY1, ZB), ridge[1])]
    else:
        hdE = (EX1 - EX0) / 2
        XR = (EX0 + EX1) / 2
        RY0, RY1 = EY0 + hdE, EY1 - hdE
        ridge = ((XR, RY0, ZR), (XR, RY1, ZR))
        faces = [
            ([(EX1, EY0, ZB), (EX1, EY1, ZB), (XR, RY1, ZR), (XR, RY0, ZR)], (k / nn, 0, 1 / nn), (0, 1, 0), (-1 / nn, 0, k / nn), 1),
            ([(EX0, EY1, ZB), (EX0, EY0, ZB), (XR, RY0, ZR), (XR, RY1, ZR)], (-k / nn, 0, 1 / nn), (0, 1, 0), (1 / nn, 0, k / nn), 1),
            ([(EX0, EY1, ZB), (EX1, EY1, ZB), (XR, RY1, ZR)], (0, k / nn, 1 / nn), (1, 0, 0), (0, -1 / nn, k / nn), 0),
            ([(EX1, EY0, ZB), (EX0, EY0, ZB), (XR, RY0, ZR)], (0, -k / nn, 1 / nn), (1, 0, 0), (0, 1 / nn, k / nn), 0),
        ]
        hips = [((EX0, EY0, ZB), ridge[0]), ((EX1, EY0, ZB), ridge[0]), ((EX0, EY1, ZB), ridge[1]), ((EX1, EY1, ZB), ridge[1])]
    for pts, n, a_dir, s_dir, ax in faces:
        m = FF.mat_telha(cores, junta, ZB, sin_t, np.array(a_dir, float), np.array(s_dir, float), ax, seed=seed)
        c.face_plana(pts, n, m, M, o)
    # a testeira (a tábua do beiral) com a boca das telhas, nas quatro beiradas
    if BEI > 0:
        ot = obj()
        for (p0, p1, nrm, ax) in (((EX0, EY1), (EX1, EY1), (0, 1, 0), 0), ((EX1, EY0), (EX0, EY0), (0, -1, 0), 0),
                                  ((EX1, EY1), (EX1, EY0), (1, 0, 0), 1), ((EX0, EY0), (EX0, EY1), (-1, 0, 0), 1)):
            def mt(L, n_, P, ax=ax):
                out = np.tile(hx(testeira), (len(P), 1))
                u = P[:, ax] + 50
                capa = (np.floor(u / 0.15) % 2) == 0
                gx = (u / 0.15) % 1
                boca = capa & (gx > 0.15) & (gx < 0.85) & (P[:, 2] > ZB - 0.04)
                return np.where(boca[:, None], hx('#4a2418'), out)
            c.face_plana([(p0[0], p0[1], ZB - esp), (p1[0], p1[1], ZB - esp), (p1[0], p1[1], ZB), (p0[0], p0[1], ZB)], nrm, emissivo(mt), M, ot)
        c.face_plana([(EX0, EY0, ZB - esp), (EX1, EY0, ZB - esp), (EX1, EY1, ZB - esp), (EX0, EY1, ZB - esp)], (0, 0, -1), liso('#d8d0c0'), M, ot)
    # os espigões e a cumeeira: as telhas de capa por cima das emendas
    mc = FF.mat_cor([cumeeira, _hex(_tom(hx(cumeeira), 1.1))], lambda L, n: np.floor((L[:, 0] + L[:, 1] + 100) / 0.3).astype(np.int64))
    ocu = obj()
    for p0, p1 in hips + [ridge]:
        a_ = np.array(p0) + (0, 0, 0.035)
        b_ = np.array(p1) + (0, 0, 0.035)
        FF._viga(ocu, a_, b_, 0.11, mc)
    return ZB


def platibanda(B, ZE, ZP, cor_mat, rufo='#e6e0d4', esp=0.14, cortes=()):
    """A platibanda: a mureta em volta do teto (o reboco da parede subindo) e o rufo claro em cima."""
    X0, X1, Y0, Y1 = B
    for b in ((X0, X1, Y1 - esp, Y1), (X0, X1, Y0, Y0 + esp), (X0, X0 + esp, Y0, Y1), (X1 - esp, X1, Y0, Y1)):
        caixa((b[0], b[1], b[2], b[3], ZE, ZP), cor_mat)
    m = {'*': liso(_escuro(rufo, 0.88)), 'cima': liso(rufo)}
    for b in ((X0 - 0.04, X1 + 0.04, Y1 - esp - 0.02, Y1 + 0.04), (X0 - 0.04, X1 + 0.04, Y0 - 0.04, Y0 + esp + 0.02),
              (X0 - 0.04, X0 + esp + 0.02, Y0 - 0.04, Y1 + 0.04), (X1 - esp - 0.02, X1 + 0.04, Y0 - 0.04, Y1 + 0.04)):
        caixa((b[0], b[1], b[2], b[3], ZP, ZP + 0.06), m)


def calcada(x0, x1, y0, y1, z=0.05, passo=1.0):
    """A calçada de cimento (a placa baixa com as juntas)."""
    caixa((x0, x1, y0, y1, 0.0, z), {'cima': mat_cimento(passo, 0, seed=int(x0 * 10)), '*': liso('#9a968c')})


def faixa(B, z0, z1, cor, e=0.02, cortes=None):
    TD._faixa(B, z0, z1, {'*': liso(cor), 'cima': liso(_hex(_tom(hx(cor), 1.12)))}, e=e, cortes=cortes)


def degrau(face, plano, a, w, z_alto, n=1, prof=0.26, cor=GRANITO):
    """Os degraus de cimento queimado ou granito na frente da porta."""
    eixo = 0 if face[1] == 'y' else 1
    fnd = lambda P: np.floor((P[:, eixo] + 50) / 0.6).astype(np.int64)
    mat = FF.mat_juntas([cor, _escuro(cor, 0.96), _hex(_tom(hx(cor), 1.04))], fnd, _escuro(cor, 0.6))
    for k in range(n):
        zt = z_alto * (n - k) / n
        caixa(_bx(face, plano, a - w / 2, a + w / 2, 0.0, prof * (k + 1), 0.0, zt), mat)


def arandela(face, plano, a, z):
    """A luminária de parede da porta (o globo de vidro leitoso apagado na caixinha)."""
    caixa(_bx(face, plano, a - 0.06, a + 0.06, 0, 0.04, z - 0.08, z + 0.08), liso('#3a3a3a'))
    bxp = VP._P(face, plano, a, 0.1, z)
    CZ.c.elipsoide(bxp, (0.07, 0.07, 0.09), lambda Pc, N, P: FF._cru_eli(np.tile(hx('#ece6d6'), (len(P), 1)), N), obj())


def moita(x, y, r=0.24, h=0.5, seed=0, flores=None, pal=None):
    """A moita do canteiro (verde de jardim, com ou sem flor)."""
    VP._moita(x, y, r=r, h=h, seed=seed, pal=pal or FF.FOLHA_PAL, flores=flores)


def caixa_luz(face, plano, a, z):
    """A caixa do medidor de luz na fachada (cinza, com o visor escuro), a do padrão de energia das casas atuais."""
    caixa(_bx(face, plano, a - 0.16, a + 0.16, 0, 0.12, z, z + 0.42), {'*': liso('#9aa0a4'), 'cima': liso('#b8bcc0')})
    caixa(_bx(face, plano, a - 0.08, a + 0.08, 0.12, 0.125, z + 0.22, z + 0.33), liso('#3a4a50'), contorno=False)
    caixa(_bx(face, plano, a - 0.015, a + 0.015, 0, 0.04, 0.05, z), liso('#4a4a4a'), contorno=False)


def moita_z(x, y, z, r=0.24, h=0.5, seed=0, flores=None, pal=None):
    """A moita plantada num canteiro (a base em z)."""
    o = obj()
    rng = np.random.default_rng(seed + 90)
    pal = pal or FF.FOLHA_PAL
    m = FF.mat_folha((x, y, z + h * 0.45), (r * 1.3, r * 1.3, h * 0.6), pal, q=0.06, seed=seed + 7, flores=flores)
    FF._cachos(o, x, y, z + h * 0.4, r, h * 0.42, 12, r * 0.25, r * 0.42, rng, m, corte=z)


def canteiro(x0, x1, y0, y1, z=0.38, cor='#c8c2b6'):
    """O canteiro de alvenaria (a mureta rebocada e a terra escura em cima)."""
    caixa((x0, x1, y0, y1, 0.0, z), {'*': liso(cor), 'cima': liso(_hex(_tom(hx(cor), 1.08)))})
    CZ.c.caixa((x0 + 0.07, x1 - 0.07, y0 + 0.07, y1 - 0.07, z - 0.04, z + 0.004), FF.mat_terra(seed=int(x0 * 7)), M, obj(contorno=False))
    pegada(x0, x1, y0, y1)


# =====================================================================================================================
# a casa atual (9 x 8 casas, 4,6 m): a casinha térrea de reboco pintado, o oitão na frente, a porta frisada e as duas
# janelas de alumínio com a grade, a calçada de cimento
# =====================================================================================================================
PAL_MODERNA = {
    'a': {'parede': '#ece8de', 'barrado': '#a8a296', 'porta': '#6a3e24', 'grade': '#f2f0ea', 'cortina': '#d8c4a0', 'flores': ('#d42a36', '#f8d060')},
    'b': {'parede': '#a6d2c2', 'barrado': '#6a9a8a', 'porta': '#7a4a2a', 'grade': '#f2f0ea', 'cortina': '#e8e0cc', 'flores': ('#f07ab0', '#f8e070')},
    'c': {'parede': '#eed894', 'barrado': '#a8925a', 'porta': '#5a3420', 'grade': '#34363a', 'cortina': '#c8a0a8', 'flores': ('#f2f0e8', '#f0c850')},
    'd': {'parede': '#e8a68a', 'barrado': '#a8705c', 'porta': '#6e4430', 'grade': '#f2f0ea', 'cortina': '#a8bcc8', 'flores': ('#d42a36', '#f8d060')},
}


def _casa_moderna(v='a'):
    pal = PAL_MODERNA[v]
    W, D = 9 * CASA, 8 * CASA
    X0, X1, Y0, Y1 = 0.25, W - 0.25, 0.3, D - 0.6
    B = (X0, X1, Y0, Y1)
    XP = TD._porta_x(9)
    ZE, ZR, BEI = 3.05, 4.55, 0.34
    PAR = mat_parede(pal['parede'], seed=ord(v), sujeira=0.5, descasca=0.1)
    caixa((X0, X1, Y0, Y1, 0.0, ZE), PAR)
    YA, YB = Y0 + 1.25, Y1 - 1.25
    XJ0, XJ1 = X0 + 1.2, X1 - 1.2              # as duas janelas da frente, no meio de cada lado da porta
    vaos = {
        '+y': [('p', XP, 0.12, 0.82, 2.1), ('j', XJ0, 1.0, 1.2, 1.1), ('j', XJ1, 1.0, 1.2, 1.1)],
        '-y': [('j', X0 + 1.2, 1.0, 1.1, 1.1), ('p', XP, 0.1, 0.8, 2.1), ('j', X1 - 1.6, 1.0, 1.0, 1.1), ('j', X1 - 0.6, 1.6, 0.5, 0.45)],
        '+x': [('j', YA, 1.0, 0.9, 1.1), ('j', YB, 1.0, 0.9, 1.1)],
        '-x': [('j', YA, 1.6, 0.6, 0.45), ('j', YB, 1.0, 0.9, 1.1)],
    }
    _conferir(vaos)
    faixa(B, 0.0, 0.42, pal['barrado'], cortes={'+y': [(XP - 0.5, XP + 0.5)], '-y': [(XP - 0.5, XP + 0.5)]})
    porta_frisada(B, '+y', XP, 0.12, 0.82, 2.1, pal['porta'])
    porta_frisada(B, '-y', XP, 0.1, 0.8, 2.1, _escuro(pal['porta'], 1.1))
    degrau('-y', Y0, XP, 1.0, 0.1, prof=0.22)
    janela_alu(B, '+y', XJ0, 1.0, 1.2, 1.1, grade=pal['grade'], cortina=pal['cortina'] if v in ('a', 'c') else None)
    janela_alu(B, '+y', XJ1, 1.0, 1.2, 1.1, grade=pal['grade'])
    janela_alu(B, '-y', X0 + 1.2, 1.0, 1.1, 1.1, grade=pal['grade'])
    janela_alu(B, '-y', X1 - 1.6, 1.0, 1.0, 1.1, grade=pal['grade'], cortina=pal['cortina'] if v in ('b', 'd') else None)
    janela_alu(B, '-y', X1 - 0.6, 1.6, 0.5, 0.45, basculante=True)
    janela_alu(B, '+x', YA, 1.0, 0.9, 1.1, grade=pal['grade'])
    janela_alu(B, '+x', YB, 1.0, 0.9, 1.1, grade=pal['grade'], cortina=pal['cortina'] if v in ('b', 'd') else None)
    janela_alu(B, '-x', YA, 1.6, 0.6, 0.45, basculante=True)
    janela_alu(B, '-x', YB, 1.0, 0.9, 1.1, grade=pal['grade'], cortina=pal['cortina'])
    # o telhado de duas águas com o oitão na frente (a cumeeira ao longo de y) e a veneziana do sótão no oitão
    XR = (X0 + X1) / 2
    KT = (ZR - ZE) / (XR - X0)
    FF.telhado(Y0, Y1, X0, X1, [(X0 - BEI, ZE - BEI * KT), (XR, ZR), (X1 + BEI, ZE - BEI * KT)], 'y', TELHA, TELHA_J, PAR,
               testeira='#ece6da', cumeeira=CUMEEIRA, seed=ord(v), beiral_u=0.28)
    for (yy, sg) in ((Y1, 1), (Y0, -1)):
        y0_, y1_ = (yy, yy + 0.03) if sg > 0 else (yy - 0.03, yy)
        caixa((XR - 0.3, XR + 0.3, y0_, y1_, 3.4, 3.76), {'*': FF.mat_veneziana(ALU), 'cima': liso(ALU_C)})
    # a calçada, o degrau da porta, a luminária, o medidor de luz e o vaso
    calcada(X0 - 0.15, X1 + 0.15, Y1, D - 0.04)
    degrau('+y', Y1, XP, 1.0, 0.12, prof=0.24)
    arandela('+y', Y1, XP + 0.62, 1.95)
    caixa_luz('+x', X1, Y1 - 0.4, 1.05)
    TD._vaso(XP - 0.72, Y1 + 0.26, 0.05, r=0.15, h=0.28, flores=pal['flores'], seed=ord(v))
    pegada(X0, X1, Y0, Y1)


# =====================================================================================================================
# a casa dos Valença (14 x 11 casas, 4,7 m): a casa térrea de reboco creme manchado, a varanda coberta embutida no meio da
# frente (o piso de cerâmica, os dois pilares, os vasos), as janelas de vidro com as cortinas fechadas, o telhado de
# quatro águas
# =====================================================================================================================
def _casa_valenca():
    W, D = 14 * CASA, 11 * CASA
    X0, X1, Y0, Y1 = 0.25, W - 0.25, 0.3, D - 0.55
    XP = TD._porta_x(14)
    PX0, PX1 = XP - 1.8, XP + 1.8
    YV = Y1 - 1.1                        # a parede do fundo da varanda
    ZE, ZR = 3.0, 4.65
    PAR = mat_parede('#e6d6b6', seed=71, sujeira=0.65, descasca=0.22)
    BAR = '#8a5a40'
    MBAR = {'*': liso(BAR), 'cima': liso(_hex(_tom(hx(BAR), 1.12)))}
    GR = '#f2f0ea'
    CORT = ['#c8a8a0', '#b8bca0', '#d8c8a8', '#a8a0b8']
    # o corpo: o fundo inteiro e as duas alas da frente (a sala e o quarto), a varanda no meio
    for (a0, a1, b0, b1) in ((X0, X1, Y0, YV), (X0, PX0, YV - 0.01, Y1), (PX1, X1, YV - 0.01, Y1)):
        caixa((a0, a1, b0, b1, 0.0, ZE), PAR)
    BF = (X0, X1, Y0, YV)                # a fachada do fundo da varanda (y = YV)
    BL = (X0, PX0, Y0, Y1)
    BR = (PX1, X1, Y0, Y1)
    B = (X0, X1, Y0, Y1)
    _conferir({'+y': [('p', XP, 0.15, 0.85, 2.1), ('j', XP - 1.2, 1.0, 0.7, 1.1), ('j', XP + 1.2, 1.0, 0.7, 1.1)]})
    # o barrado marrom (nas alas e em volta da casa)
    TD._faixa(BL, 0.0, 0.4, MBAR, e=0.02, cortes={'-y': [(-9, 99)], '-x': [(-9, 99)]})
    TD._faixa(BR, 0.0, 0.4, MBAR, e=0.02, cortes={'-y': [(-9, 99)], '+x': [(-9, 99)]})
    XD = X1 - 1.0                        # a porta dos fundos
    TD._faixa(B, 0.0, 0.4, MBAR, e=0.02, cortes={'+y': [(-9, 99)], '-y': [(XD - 0.5, XD + 0.5)]})
    # a varanda: o piso de cerâmica (um pouco acima do chão), o degrau, a porta e as janelas da sala
    caixa((PX0, PX1, YV, Y1 + 0.02, 0.0, 0.15), {'cima': mat_ceramica(org=(PX0, YV)), '*': liso(BAR)})
    degrau('+y', Y1 + 0.02, XP, 1.3, 0.15, prof=0.26, cor='#b8a898')
    porta_frisada(BF, '+y', XP, 0.15, 0.85, 2.1, '#5a3420')
    janela_alu(BF, '+y', XP - 1.2, 1.0, 0.7, 1.1, grade=GR, cortina=CORT[0])
    janela_alu(BF, '+y', XP + 1.2, 1.0, 0.7, 1.1, grade=GR, cortina=CORT[2])
    # a verga da varanda (a parede que desce do telhado entre as alas) e os dois pilares
    caixa((PX0, PX1, Y1 - 0.16, Y1, 2.55, ZE), PAR)
    for x in (XP - 0.68, XP + 0.68):
        caixa((x - 0.1, x + 0.1, Y1 - 0.2, Y1, 0.15, 2.55), {'*': liso('#e8dcc0'), 'cima': liso('#f2e8d0')})
        caixa((x - 0.13, x + 0.13, Y1 - 0.23, Y1 + 0.03, 0.15, 0.4), MBAR)
    # as janelas das alas (as cortinas fechadas), as de trás e as dos lados
    janela_alu(BL, '+y', (X0 + PX0) / 2, 1.0, 1.4, 1.1, grade=GR, cortina=CORT[1])
    janela_alu(BR, '+y', (PX1 + X1) / 2, 1.0, 1.3, 1.1, grade=GR, cortina=CORT[3])
    ys = list(np.linspace(Y0 + 1.1, Y1 - 1.3, 4))
    traz = [('j', 1.3, 1.0, 1.0, 1.1), ('j', 3.0, 1.6, 0.6, 0.45), ('j', 4.7, 1.0, 1.0, 1.1), ('j', 6.4, 1.0, 1.0, 1.1),
            ('j', 7.95, 1.0, 1.0, 1.1), ('p', XD, 0.1, 0.8, 2.1)]
    _conferir({'-y': traz, '+x': [('j', y, 1.0, 0.9, 1.1) for y in ys], '-x': [('j', y, 1.0, 0.9, 1.1) for y in ys]})
    for k, (t, a, z0, w, h) in enumerate(traz):
        if t == 'p':
            porta_frisada(B, '-y', a, z0, w, h, '#6a4428')
            degrau('-y', Y0, a, 1.0, 0.1, prof=0.22)
        elif w < 0.7:
            janela_alu(B, '-y', a, z0, w, h, basculante=True)
        else:
            janela_alu(B, '-y', a, z0, w, h, grade=GR, cortina=CORT[k % 4])
    for face in ('+x', '-x'):
        for k, y in enumerate(ys):
            if face == '+x' and k == 1:
                janela_alu(B, face, y, 1.6, 0.6, 0.45, basculante=True)
            else:
                janela_alu(B, face, y, 1.0, 0.9, 1.1, grade=GR, cortina=CORT[(k + len(face)) % 4])
    telhado4(B, ZE, ZR, BEI=0.4, eixo='x', seed=72)
    # na varanda: o capacho, os vasos (a samambaia, as flores) e a luminária
    caixa((XP - 0.35, XP + 0.35, YV + 0.08, YV + 0.48, 0.15, 0.162), liso('#7a5a3a'), contorno=False)
    TD._vaso(PX0 + 0.3, YV + 0.3, 0.15, r=0.18, h=0.34, flores=None, seed=11)
    TD._vaso(PX1 - 0.3, YV + 0.3, 0.15, r=0.16, h=0.3, flores=('#d42a36', '#f8d060'), seed=12)
    TD._vaso(PX1 - 0.3, Y1 - 0.4, 0.15, r=0.14, h=0.26, flores=('#f07ab0', '#f8e070'), seed=13)
    TD._vaso(PX0 + 0.3, Y1 - 0.4, 0.15, r=0.14, h=0.26, flores=None, seed=14)
    arandela('+y', YV, XP + 0.62, 1.95)
    caixa_luz('-x', X0, Y1 - 0.5, 1.05)
    calcada(X0 - 0.12, PX0, Y1, D - 0.04)
    calcada(PX1, X1 + 0.12, Y1, D - 0.04)
    pegada(X0, X1, Y0, Y1)


# =====================================================================================================================
# o posto de saúde (18 x 12 casas, 4,8 m): o prédio branco com o barrado azul, o telhado de quatro águas, a marquise da
# entrada com a placa da cruz, as portas de vidro, o patamar com a rampa e o corrimão, a escadinha e os canteiros
# =====================================================================================================================
def _desenho_cruz(u, v, out):
    """A placa do posto: o branco com a borda azul e a cruz azul grossa no meio (não é a cruz vermelha)."""
    azul = hx('#2f6194')
    cruz = ((np.abs(u - 0.5) < 0.09) & (np.abs(v - 0.5) < 0.32)) | ((np.abs(v - 0.5) < 0.13) & (np.abs(u - 0.5) < 0.24))
    return np.where(cruz[:, None], azul, out)


def _placa(face_plano, x0, x1, z0, z1, desenho, cor, borda, e=0.05):
    """A placa presa na frente (+y): a chapa com a borda de 1 px e o desenho (sem letras)."""
    def m(L, n, P):
        u = (P[:, 0] - x0) / (x1 - x0)
        v = (P[:, 2] - z0) / (z1 - z0)
        out = np.tile(hx(cor), (len(P), 1))
        bu, bv = 1.5 * PH / (x1 - x0), 1.5 * PZ / (z1 - z0)
        out = np.where(((u < bu) | (u > 1 - bu) | (v < bv) | (v > 1 - bv))[:, None], hx(borda), out)
        return desenho(u, v, out)
    caixa((x0, x1, face_plano, face_plano + e, z0, z1), {'*': liso(borda), 'frente': emissivo(m), 'cima': liso(_hex(_tom(hx(borda), 1.1)))})


def _rampa(x_alto, x_baixo, y0, y1, z, mat_cima, mat_lado):
    """A rampa (sobe de x_baixo, no chão, até x_alto, na altura z): o piso inclinado e os lados."""
    c = CZ.c
    o = obj()
    sg = 1 if x_baixo > x_alto else -1
    k = z / abs(x_baixo - x_alto)
    nn = math.hypot(1, k)
    c.face_plana([(x_alto, y1, z), (x_baixo, y1, 0.0), (x_baixo, y0, 0.0), (x_alto, y0, z)], (sg * k / nn, 0, 1 / nn), mat_cima, M, o)
    c.face_plana([(x_alto, y1, 0.0), (x_baixo, y1, 0.0), (x_alto, y1, z)], (0, 1, 0), mat_lado, M, o)
    c.face_plana([(x_alto, y0, 0.0), (x_alto, y0, z), (x_baixo, y0, 0.0)], (0, -1, 0), mat_lado, M, o)
    c.face_plana([(x_alto, y0, 0.0), (x_alto, y1, 0.0), (x_alto, y1, z), (x_alto, y0, z)], (-sg, 0, 0), mat_lado, M, o)


def _corrimao(pts, cor='#c8ccd0', alto=0.9):
    """O corrimão de tubo: os montantes em cada ponto e o tubo de cima seguindo o chão (pts = [(x, y, z do chão)])."""
    o = obj()
    m = liso(cor)
    for (x, y, z) in pts:
        caixa((x - 0.022, x + 0.022, y - 0.022, y + 0.022, z, z + alto), {'*': m, 'cima': liso('#eef0f2')})
    for p0, p1 in zip(pts[:-1], pts[1:]):
        FF._viga(o, (p0[0], p0[1], p0[2] + alto), (p1[0], p1[1], p1[2] + alto), 0.045, m, cima=liso('#eef0f2'))
        FF._viga(o, (p0[0], p0[1], p0[2] + alto * 0.5), (p1[0], p1[1], p1[2] + alto * 0.5), 0.03, m)


def _posto():
    W, D = 18 * CASA, 12 * CASA
    X0, X1, Y0, Y1 = 0.25, W - 0.25, 0.3, D - 1.65
    B = (X0, X1, Y0, Y1)
    XP = TD._porta_x(18)
    ZP, ZE, ZR = 0.3, 3.45, 4.75
    AZUL = '#2f6194'
    PAR = mat_parede('#f2f0ea', seed=81, sujeira=0.0, descasca=0.06)
    caixa((X0, X1, Y0, Y1, 0.0, ZE), PAR)
    ys = list(np.linspace(Y0 + 1.0, Y1 - 1.0, 4))
    vaos = {
        # a frente: três janelas de cada lado da marquise (a da esquerda longe dela: a marquise avança por cima)
        '+y': [('p', XP, ZP, 1.6, 2.3)] + [('j', x, 1.25, 1.0, 1.1) for x in (1.3, 2.8, 4.3, XP + 2.05, XP + 3.5, XP + 4.95)],
        '-y': [('j', x, 1.45, 1.0, 0.9) for x in (1.2, 3.1, 5.0, 6.9, 8.8, 10.7)] + [('j', 12.25, 1.7, 0.6, 0.45)],
        '+x': [('j', y, 1.25, 0.9, 1.1) for y in ys],
        '-x': [('j', y, 1.25, 0.9, 1.1) for y in ys[:3]] + [('j', ys[3], 1.7, 0.6, 0.45)],
    }
    _conferir(vaos)
    # o barrado azul (aberto na porta), o filete branco em cima dele e a faixa azul embaixo do beiral
    faixa(B, 0.0, 1.0, AZUL, cortes={'+y': [(XP - 0.86, XP + 0.86)]})
    faixa(B, 1.0, 1.06, '#f8f6f0', e=0.03, cortes={'+y': [(XP - 0.86, XP + 0.86)]})
    faixa(B, ZE - 0.34, ZE - 0.2, AZUL, e=0.02)
    for face, lista in vaos.items():
        for v in lista:
            if v[0] == 'p':
                porta_vidro(B, face, v[1], v[2], v[3], v[4])
            elif v[3] < 0.7:
                janela_alu(B, face, v[1], v[2], v[3], v[4], basculante=True)
            else:
                janela_alu(B, face, v[1], v[2], v[3], v[4], grade='#f2f0ea', vidro='azul' if face != '-y' else 'escuro')
    telhado4(B, ZE, ZR, BEI=0.45, eixo='x', seed=82)
    # a caixa d'água de fibra em cima do telhado, no fundo
    CZ.c.cilindro(X1 - 2.2, Y0 + 1.6, 0.55, 3.9, 4.55, vol(X1 - 2.2, Y0 + 1.6, '#4a7aa8'), M, obj(), lados=18, r1=0.6,
                  tampa_mat=liso('#3a6a98'))
    # o patamar da entrada (com o piso tátil amarelo), a escadinha, a rampa e os corrimãos
    LX0, LX1, LY1 = XP - 1.3, XP + 1.3, Y1 + 1.3
    GRAN = FF.mat_juntas(['#c4beb2', '#bcb6aa', '#c8c2b6'], lambda P: np.floor((P[:, 0] + 50) / 0.6).astype(np.int64) * 7 +
                         np.floor((P[:, 1] + 50) / 0.6).astype(np.int64), '#8a8478')

    def tatil(L, n, P):
        out = GRAN(L, n, P)
        bol = ((np.floor(P[:, 0] / (2 * PH)) + np.floor(P[:, 1] / (2 * PH))) % 2 == 0)
        faixa_ = (P[:, 1] > LY1 - 0.32) & (P[:, 1] < LY1 - 0.1) & (P[:, 0] < LX1 - 0.02)
        out = np.where(faixa_[:, None], np.where(bol[:, None], hx('#e8c030'), hx('#d4a824')), out)
        return out
    caixa((LX0, LX1, Y1, LY1, 0.0, ZP), {'cima': emissivo(tatil), '*': liso('#a8a296')})
    for (yb, zt) in ((LY1 + 0.32, 0.1), (LY1 + 0.16, 0.2)):
        caixa((LX0 + 0.25, LX1 - 1.1, LY1 - 0.01, yb, 0.0, zt), {'cima': liso('#c8c2b6'), '*': liso('#a8a296')})
    RX0, RX1 = LX1, LX1 + 2.35
    RY0, RY1 = Y1 + 0.55, LY1
    _rampa(RX0, RX1, RY0, RY1, ZP, GRAN, liso('#a8a296'))
    zm = ZP * (1 - 1.15 / 2.35)
    _corrimao([(RX0 + 0.05, RY1 - 0.06, ZP), (RX0 + 1.2, RY1 - 0.06, zm), (RX1 - 0.05, RY1 - 0.06, 0.0)])
    _corrimao([(RX0 + 0.05, RY0 + 0.06, ZP), (RX0 + 1.2, RY0 + 0.06, zm), (RX1 - 0.05, RY0 + 0.06, 0.0)])
    _corrimao([(LX1 - 1.05, LY1 - 0.06, ZP), (LX1 - 0.05, LY1 - 0.06, ZP)])
    # a marquise de concreto em cima da porta, as duas colunas redondas e a placa com a cruz
    MY1 = Y1 + 1.05
    caixa((XP - 1.25, XP + 1.25, Y1, MY1, 2.85, 3.0), {'*': liso('#f4f2ec'), 'cima': liso('#d8d4cc')})
    faixa((XP - 1.25, XP + 1.25, Y1, MY1), 2.85, 3.0, AZUL, e=0.015)
    for x in (XP - 1.1, XP + 1.1):
        CZ.c.cilindro(x, MY1 - 0.15, 0.07, ZP, 2.85, vol(x, MY1 - 0.15, '#f2f0ea'), M, obj(), lados=12, tampa=False)
    _placa(MY1, XP - 0.42, XP + 0.42, 3.0, 3.5, _desenho_cruz, '#f8f8f4', AZUL)
    # os canteiros com as moitas floridas (e o banco no da esquerda)
    canteiro(X0 + 0.05, LX0 - 0.12, Y1 + 0.18, Y1 + 1.35)
    canteiro(RX0 + 0.05, X1 - 0.05, Y1 + 0.06, RY0 - 0.06)
    canteiro(RX1 + 0.12, X1 - 0.05, RY0 + 0.05, Y1 + 1.35)
    for k, x in enumerate(np.arange(X0 + 0.45, LX0 - 0.4, 0.72)):
        moita_z(x, Y1 + 0.75, 0.38, r=0.26, h=0.55, seed=20 + k, flores=(('#d42a36', '#f8d060'), None, ('#f07ab0', '#f8e070'))[k % 3])
    for k, x in enumerate(np.arange(RX0 + 0.35, X1 - 0.2, 0.62)):
        moita_z(x, Y1 + 0.3, 0.38, r=0.17, h=0.36, seed=40 + k, flores=('#d42a36', '#f8d060') if k % 2 else None)
    for k, x in enumerate(np.arange(RX1 + 0.45, X1 - 0.3, 0.7)):
        moita_z(x, Y1 + 0.98, 0.38, r=0.24, h=0.5, seed=60 + k, flores=('#f07ab0', '#f8e070') if k % 2 == 0 else None)
    pegada(X0, X1, Y0, Y1)
    pegada(LX0, RX1, Y1, LY1)


# =====================================================================================================================
# o cartório (15 x 12 casas, 5,0 m): o prédio sóbrio de reboco bege com a platibanda e a cornija, o embasamento de
# granito, o pórtico de duas colunas na entrada com a placa da balança, a porta de madeira de duas folhas e as janelas
# com a grade preta
# =====================================================================================================================
def _desenho_balanca(u, v, out):
    """A balança dourada na chapa escura: o pé, a haste, o travessão e os dois pratos pendurados (sem letras)."""
    ouro, ouro_c = hx('#d8b058'), hx('#f0d488')
    pe = (np.abs(u - 0.5) < 0.14) & (v > 0.12) & (v < 0.2)
    haste = (np.abs(u - 0.5) < 0.03) & (v >= 0.12) & (v < 0.84)
    trav = (np.abs(u - 0.5) < 0.34) & (np.abs(v - 0.76) < 0.045)
    topo = ((u - 0.5) ** 2 / 0.04 ** 2 + (v - 0.86) ** 2 / 0.07 ** 2) < 1
    m = pe | haste | trav | topo
    for xc in (0.2, 0.8):
        fio = (np.abs(np.abs(u - xc) - (0.76 - v) * 0.3) < 0.025) & (v > 0.42) & (v < 0.76)
        prato = (np.abs(u - xc) < 0.15 - (0.42 - v) * 0.6) & (v > 0.33) & (v <= 0.42)
        m |= fio | prato
    out = np.where(m[:, None], ouro, out)
    return np.where((m & (u < 0.5) & (v > 0.7))[:, None], ouro_c, out)


def _coluna(x, y, z0, z1, r=0.12, cor='#efe8d8'):
    """A coluna redonda lisa com a base e o capitel quadrados."""
    CZ.c.cilindro(x, y, r, z0 + 0.12, z1 - 0.12, vol(x, y, cor), M, obj(), lados=14, tampa=False)
    m = {'*': liso(_escuro(cor, 0.94)), 'cima': liso(cor)}
    caixa((x - r - 0.05, x + r + 0.05, y - r - 0.05, y + r + 0.05, z0, z0 + 0.12), m)
    caixa((x - r - 0.06, x + r + 0.06, y - r - 0.06, y + r + 0.06, z1 - 0.12, z1), m)


def _cartorio():
    W, D = 15 * CASA, 12 * CASA
    X0, X1, Y0, Y1 = 0.25, W - 0.25, 0.3, D - 1.55
    B = (X0, X1, Y0, Y1)
    XP = TD._porta_x(15)
    YM = (Y0 + Y1) / 2
    ZP, ZE, ZPL = 0.3, 3.9, 4.45
    BEGE = '#d8ccb4'
    PAR = mat_parede(BEGE, seed=91, sujeira=0.55, descasca=0.08)
    GRADE = '#2c2c30'
    caixa((X0, X1, Y0, Y1, 0.0, ZE), PAR)
    # o embasamento de granito cinza e a cornija clara embaixo da platibanda
    GRN = FF.mat_juntas(['#8a867c', '#827e74', '#908c82'], lambda P: np.floor((P[:, 0] + P[:, 1] + 50) / 0.6).astype(np.int64), '#5a5850')
    TD._faixa(B, 0.0, 0.62, {'*': GRN, 'cima': liso('#a8a49a')}, e=0.03, cortes={'+y': [(XP - 0.82, XP + 0.82)]})
    faixa(B, ZE - 0.22, ZE - 0.06, '#ece4d2', e=0.07)
    faixa(B, ZE - 0.3, ZE - 0.22, '#e2d8c2', e=0.04)
    platibanda(B, ZE, ZPL, PAR, rufo='#e6dcc8')
    # o telhado de quatro águas escondido atrás da platibanda (só a parte de cima aparece)
    BI = (X0 + 0.14, X1 - 0.14, Y0 + 0.14, Y1 - 0.14)
    telhado4(BI, ZE - 0.05, 4.98, BEI=0.0, eixo='x', seed=92)
    vaos = {
        # a frente simétrica: três janelas de cada lado do pórtico
        '+y': [('p', XP, ZP, 1.3, 2.4)] + [('j', XP + s * d, 1.1, 0.9, 1.4) for s in (-1, 1) for d in (1.875, 3.175, 4.475)],
        '-y': [('j', x, 1.1, 1.0, 1.4) for x in np.linspace(1.2, X1 - 0.95, 7)],
        '+x': [('j', y, 1.1, 0.9, 1.4) for y in np.linspace(Y0 + 1.0, Y1 - 1.25, 4)],
        '-x': [('j', y, 1.1, 0.9, 1.4) for y in np.linspace(Y0 + 1.0, Y1 - 1.25, 4)],
    }
    _conferir(vaos)
    for face, lista in vaos.items():
        for v in lista:
            if v[0] == 'p':
                FF.porta(B, face, v[1], v[2], v[3], v[4], '#5a3a22', folhas=2, moldura='#ece4d2')
            else:
                janela_alu(B, face, v[1], v[2], v[3], v[4], grade=GRADE, vidro='escuro')
                # a moldura de reboco em volta da janela (o requadro claro)
                p = FF._plano(B, face)
                a0, a1 = v[1] - v[3] / 2 - 0.12, v[1] + v[3] / 2 + 0.12
                caixa(_bx(face, p, a0, a1, 0, 0.025, v[2] + v[4] + 0.05, v[2] + v[4] + 0.15), {'*': liso('#ece4d2'), 'cima': liso('#f6f0e2')})
    # o pórtico: o patamar de granito, os degraus, as duas colunas, o entablamento e a placa da balança
    PX0, PX1, PY1 = XP - 1.3, XP + 1.3, Y1 + 1.05
    GR2 = FF.mat_juntas(['#b0aca2', '#a8a49a', '#b6b2a8'], lambda P: np.floor((P[:, 0] + 50) / 0.65).astype(np.int64) * 5 +
                        np.floor((P[:, 1] + 50) / 0.5).astype(np.int64), '#6e6a62')
    caixa((PX0, PX1, Y1, PY1, 0.0, ZP), {'cima': GR2, '*': liso('#8e8a80')})
    for (yb, zt, enc) in ((PY1 + 0.36, 0.1, 0.0), (PY1 + 0.18, 0.2, 0.1)):
        caixa((PX0 + 0.2 + enc, PX1 - 0.2 - enc, PY1 - 0.01, yb, 0.0, zt), {'cima': liso('#b8b4aa'), '*': liso('#8e8a80')})
    for x in (XP - 1.02, XP + 1.02):
        _coluna(x, PY1 - 0.2, ZP, 2.95)
    caixa((PX0, PX1, Y1, PY1 + 0.04, 2.95, 3.5), {'*': liso('#ece4d2'), 'cima': liso('#c8bea8')})
    caixa((PX0 - 0.05, PX1 + 0.05, Y1, PY1 + 0.09, 3.5, 3.6), {'*': liso('#e2d8c2'), 'cima': liso('#f2ecde')})
    _placa(PY1 + 0.04, XP - 0.34, XP + 0.34, 3.0, 3.44, _desenho_balanca, '#3a3a34', '#8a7a4a', e=0.03)
    # a calçada dos dois lados do pórtico, os vasos e a luminária
    calcada(X0 - 0.12, PX0, Y1, Y1 + 0.95)
    calcada(PX1, X1 + 0.12, Y1, Y1 + 0.95)
    TD._vaso(PX0 + 0.25, PY1 - 0.25, ZP, r=0.17, h=0.32, flores=None, seed=31)
    TD._vaso(PX1 - 0.25, PY1 - 0.25, ZP, r=0.17, h=0.32, flores=None, seed=32)
    arandela('+y', Y1, XP - 0.95, 2.3)
    arandela('+y', Y1, XP + 0.95, 2.3)
    caixa_luz('+x', X1, Y1 - 0.45, 1.0)
    pegada(X0, X1, Y0, Y1)
    pegada(PX0, PX1, Y1, PY1)


# =====================================================================================================================
# a prefeitura (15 x 12 casas, 8,0 m): o sobrado neoclássico de dois andares, o embasamento alto de pedra, as pilastras
# brancas, o corpo central saliente com o frontão triangular e o óculo, a sacada de ferro, as janelas altas com as
# sobrevergas, a platibanda com os pináculos, a escadaria e o mastro com a bandeira lisa
# =====================================================================================================================
def _frontao_tri(x0, x1, y0, y1, z0, alto, mat, borda, o):
    """O frontão triangular (o tímpano liso e as duas águas da moldura), com espessura."""
    c = CZ.c
    xc = (x0 + x1) / 2
    zt = z0 + alto
    c.face_plana([(x0, y1, z0), (x1, y1, z0), (xc, y1, zt)], (0, 1, 0), mat, M, o)
    c.face_plana([(x1, y0, z0), (x0, y0, z0), (xc, y0, zt)], (0, -1, 0), mat, M, o)
    L = math.hypot(xc - x0, alto)
    for (xa, za, xb, zb, sx) in ((x0, z0, xc, zt, -1), (xc, zt, x1, z0, 1)):
        n = (sx * alto / L, 0, (xc - x0) / L)
        c.face_plana([(xa, y0, za), (xb, y0, zb), (xb, y1, zb), (xa, y1, za)], n, mat, M, o)
    # a moldura: as duas réguas inclinadas por cima, saindo um pouco para a frente
    ob = obj()
    e = 0.12
    for (xa, za, xb, zb) in ((x0 - 0.12, z0 - 0.02, xc, zt + 0.1), (xc, zt + 0.1, x1 + 0.12, z0 - 0.02)):
        FF._viga(ob, (xa, y1 - 0.05, za + 0.04), (xb, y1 - 0.05, zb + 0.04), e, liso(_escuro(borda, 0.92)), cima=liso(borda))
    caixa((x0 - 0.12, x1 + 0.12, y0, y1 + 0.06, z0 - 0.08, z0 + 0.04), {'*': liso(_escuro(borda, 0.92)), 'cima': liso(borda)})


def _pinaculo(x, y, z):
    """O pináculo (a urna de pedra) na quina da platibanda."""
    caixa((x - 0.12, x + 0.12, y - 0.12, y + 0.12, z, z + 0.14), {'*': liso('#e6e0d2'), 'cima': liso('#f4f0e6')})
    _poligono_rodado(x, y, [(z + 0.14, 0.06), (z + 0.2, 0.12), (z + 0.32, 0.12), (z + 0.38, 0.06), (z + 0.42, 0.04)], vol(x, y, '#ece6d8'), obj(), lados=12)
    CZ.c.elipsoide((x, y, z + 0.47), (0.05, 0.05, 0.06), lambda Pc, N, P: FF._cru_eli(np.tile(hx('#efe9dc'), (len(P), 1)), N), obj())


def _mastro(x, y, alto=7.0, cor_bandeira='#2f6a5a'):
    """O mastro de metal branco (a base de concreto, a bola dourada em cima) e a bandeira lisa ondulando para +x."""
    caixa((x - 0.22, x + 0.22, y - 0.22, y + 0.22, 0.0, 0.28), {'*': liso('#b8b4aa'), 'cima': liso('#cac6bc')})
    CZ.c.cilindro(x, y, 0.045, 0.28, alto, vol(x, y, '#e2e4e6', brilho=0.3), M, obj(), lados=10, r1=0.032, tampa=False)
    CZ.c.elipsoide((x, y, alto + 0.05), (0.06, 0.06, 0.06), lambda Pc, N, P: FF._cru_eli(np.tile(hx('#d8b058'), (len(P), 1)), N), obj())
    # a bandeira em 4 tiras, cada uma um pouco mais para a frente ou para trás (a onda)
    zt, zb = alto - 0.15, alto - 0.95
    ys = [0.0, 0.07, 0.0, -0.06, -0.02]
    xs = [x + 0.03 + 1.25 * k / 4 for k in range(5)]
    cb = hx(cor_bandeira)
    o = obj()
    for k in range(4):
        cor = _tom(cb, 1.0 if k % 2 == 0 else 0.86)
        dz = 0.03 * k
        CZ.c.face_plana([(xs[k], y + ys[k], zb - dz), (xs[k + 1], y + ys[k + 1], zb - dz - 0.03), (xs[k + 1], y + ys[k + 1], zt - dz - 0.03),
                         (xs[k], y + ys[k], zt - dz)], (0, 1, 0), liso(_hex(cor)), M, o, dois_lados=True)
    pegada(x - 0.22, x + 0.22, y - 0.22, y + 0.22)


def _prefeitura():
    W, D = 15 * CASA, 12 * CASA
    X0, X1, Y0, Y1 = 0.3, W - 0.3, 0.3, D - 1.75
    B = (X0, X1, Y0, Y1)
    XP = TD._porta_x(15)
    YM = (Y0 + Y1) / 2
    ZB_, ZF, ZE, ZPL = 0.7, 3.75, 6.75, 7.3
    CREME = '#ece4d2'
    BR = '#f6f2e8'
    VERDE = '#2f6a5a'
    PAR = mat_parede(CREME, seed=101, sujeira=0.3, descasca=0.05)
    mb = {'*': liso(_escuro(BR, 0.95)), 'cima': liso(BR)}
    caixa((X0, X1, Y0, Y1, 0.0, ZE), PAR)
    # o corpo central saliente (o avant-corps) e o embasamento de pedra em volta de tudo
    CX0, CX1, CY1 = XP - 1.65, XP + 1.65, Y1 + 0.3
    BC = (CX0, CX1, Y1 - 0.01, CY1)
    caixa((CX0, CX1, Y1 - 0.01, CY1, 0.0, ZE), PAR)
    PED = TD.mat_cantaria(seed=5, alt=0.233, comp=0.5)
    TD._faixa(B, 0.0, ZB_, {'*': PED, 'cima': liso('#d0c6b0')}, e=0.04, cortes={'+y': [(CX0, CX1)]})
    TD._faixa(BC, 0.0, ZB_, {'*': PED, 'cima': liso('#d0c6b0')}, e=0.04, cortes={'+y': [(XP - 0.95, XP + 0.95)], '-y': [(-9, 99)]})
    # as pilastras brancas (nas quinas e as do corpo central) e as faixas entre os andares e da cornija
    for (x, yy, face) in ((X0 + 0.16, Y1, '+y'), (CX0 - 0.16, Y1, '+y'), (CX1 + 0.16, Y1, '+y'), (X1 - 0.16, Y1, '+y'),
                          (CX0 + 0.16, CY1, '+y'), (CX1 - 0.16, CY1, '+y')):
        caixa((x - 0.16, x + 0.16, yy, yy + 0.05, ZB_, ZE - 0.3), mb)
    for (xa, ya, face) in ((X0, Y0 + 0.16, '-x'), (X0, Y1 - 0.16, '-x'), (X1, Y0 + 0.16, '+x'), (X1, Y1 - 0.16, '+x')):
        sx = -1 if face == '-x' else 1
        caixa((min(xa, xa + sx * 0.05), max(xa, xa + sx * 0.05), ya - 0.16, ya + 0.16, ZB_, ZE - 0.3), mb)
    faixa(B, ZF - 0.1, ZF + 0.08, BR, e=0.05, cortes={'+y': [(CX0, CX1)]})
    faixa(BC, ZF - 0.1, ZF + 0.08, BR, e=0.05, cortes={'-y': [(-9, 99)]})
    for bb, cc in ((B, {'+y': [(CX0, CX1)]}), (BC, {'-y': [(-9, 99)]})):
        TD._faixa(bb, ZE - 0.32, ZE - 0.12, {'*': liso('#e8e2d4'), 'cima': liso(BR)}, e=0.06, cortes=cc)
        TD._faixa(bb, ZE - 0.12, ZE, {'*': liso(_escuro(BR, 0.94)), 'cima': liso(BR)}, e=0.1, cortes=cc)
    # a platibanda, os pináculos nas quinas e o telhado escondido atrás
    platibanda(B, ZE, ZPL, PAR, rufo='#f2ece0', esp=0.16)
    for (x, y) in ((X0 + 0.1, Y0 + 0.1), (X1 - 0.1, Y0 + 0.1), (X0 + 0.1, Y1 - 0.1), (X1 - 0.1, Y1 - 0.1)):
        _pinaculo(x, y, ZPL + 0.06)
    telhado4((X0 + 0.16, X1 - 0.16, Y0 + 0.16, Y1 - 0.16), ZE - 0.05, 7.75, BEI=0.0, eixo='x', seed=102)
    # o frontão em cima do corpo central (o óculo no tímpano)
    _frontao_tri(CX0 + 0.04, CX1 - 0.04, Y1 + 0.04, CY1, ZE, 1.15, PAR, BR, obj())
    TD._disco_fachada('+y', CY1, XP, ZE + 0.42, 0.24, 0.03, liso(BR), obj())
    TD._disco_fachada('+y', CY1, XP, ZE + 0.42, 0.15, 0.035, liso('#2c3c48'), obj(contorno=False))
    # as janelas: o térreo (com o peitoril) e o andar de cima (mais altas, com a sobreverga), verdes
    xs = (1.3, 2.75, 2 * XP - 2.75, 2 * XP - 1.3)
    ys = list(np.linspace(Y0 + 1.1, Y1 - 1.1, 4))
    vaos1 = {'+y': [('j', x, 1.35, 0.85, 1.7) for x in xs], '-y': [('j', x, 1.35, 0.85, 1.7) for x in np.linspace(1.3, 2 * XP - 1.3, 7)],
             '+x': [('j', y, 1.35, 0.85, 1.7) for y in ys], '-x': [('j', y, 1.35, 0.85, 1.7) for y in ys]}
    vaos2 = {f: [(t, a, 4.3, w, 1.85) for (t, a, _, w, _) in l] for f, l in vaos1.items()}
    for vv in (vaos1, vaos2):
        _conferir(vv)
        for face, lista in vv.items():
            for (_, a, z0, w, h) in lista:
                FF.janela(B, face, a, z0, w, h, kind='escuro', venez=None, moldura=VERDE, cruz=True, peitoril=False)
                p = FF._plano(B, face)
                caixa(_bx(face, p, a - w / 2 - 0.14, a + w / 2 + 0.14, 0, 0.04, z0 - 0.12, z0 - 0.02), mb)
                caixa(_bx(face, p, a - w / 2 - 0.18, a + w / 2 + 0.18, 0, 0.09, z0 + h + 0.08, z0 + h + 0.2), mb)
    # o corpo central: a porta grande de duas folhas com a bandeira, e em cima as três portas-janelas com a sacada
    FF.porta(BC, '+y', XP, ZB_, 1.5, 2.6, '#5a3a22', folhas=2, moldura=BR)
    for a in (XP - 1.05, XP, XP + 1.05):
        FF.janela(BC, '+y', a, ZF + 0.25, 0.7, 2.3, kind='escuro', venez=None, moldura=VERDE, cruz=True, peitoril=False)
        caixa(_bx('+y', CY1, a - 0.5, a + 0.5, 0, 0.09, ZF + 2.62, ZF + 2.74), mb)
    TD._sacada(BC, '+y', XP, ZF + 0.22, 3.0, fundo=0.4)
    # a escadaria de granito até a porta
    nd = 4
    for k in range(nd):
        zt = ZB_ * (nd - k) / nd
        caixa((XP - 1.25 - 0.1 * k, XP + 1.25 + 0.1 * k, CY1 - 0.02, CY1 + 0.24 * (k + 1), 0.0, zt),
              {'cima': liso('#c8c2b4'), '*': liso('#9a968a')})
    # a calçada, os vasos da escadaria e o mastro com a bandeira
    calcada(X0 - 0.15, CX0, Y1, D - 0.1)
    calcada(CX1, X1 + 0.15, Y1, D - 0.1)
    for x in (XP - 1.55, XP + 1.55):
        TD._vaso(x, CY1 + 0.55, 0.05, r=0.2, h=0.4, flores=None, seed=int(x * 10))
    _mastro(X0 + 0.55, D - 0.55)
    pegada(X0, X1, Y0, Y1)
    pegada(CX0, CX1, Y1, CY1 + 0.96)


# =====================================================================================================================
# os móveis da casa: a geladeira, o fogão a gás com o botijão, a máquina de lavar, o tanque, o box, o rack com a TV,
# a mesa de centro e o pufe
# =====================================================================================================================
ESMALTE = '#ecece6'


def _esmalte(cor=ESMALTE):
    return {'*': liso(cor), 'cima': liso(_hex(_tom(hx(cor), 1.06)))}


def _geladeira():
    """A geladeira branca de duas portas (o freezer em cima), os puxadores, os ímãs e os bilhetes na porta."""
    x0, x1, y0, y1 = 0.1, 0.65, 0.1, 0.68
    zt, zd = 1.75, 1.3
    c0 = hx(ESMALTE)

    def frente(L, n, P):
        z, x = P[:, 2], P[:, 0]
        out = np.tile(c0, (len(P), 1))
        out = np.where((x < x0 + 1.5 * PH)[:, None], _tom(c0, 1.04), out)
        out = np.where((np.abs(z - zd) < PZ * 0.55)[:, None], hx('#6e6e6a'), out)
        out = np.where(((z > zd + PZ * 0.55) & (z < zd + PZ * 1.6))[:, None], _tom(c0, 0.86), out)
        out = np.where((z > zt - 1.5 * PZ)[:, None], _tom(c0, 0.92), out)
        return out

    def costas(L, n, P):
        g = np.floor(P[:, 2] / (2 * PZ)) % 2
        return np.where((g == 0)[:, None], hx('#2e2e30'), hx('#4a4a4c'))
    caixa((x0 + 0.03, x1 - 0.03, y0 + 0.03, y1 - 0.03, 0.0, 0.07), liso('#3a3a3c'))
    caixa((x0, x1, y0, y1, 0.07, zt), {'*': liso(_hex(_tom(c0, 0.97))), 'frente': emissivo(frente), 'costas': emissivo(costas),
                                       'cima': liso('#f6f6f2')})
    for (za, zb) in ((zd + 0.07, zd + 0.33), (zd - 0.6, zd - 0.08)):
        caixa((x1 - 0.1, x1 - 0.065, y1, y1 + 0.04, za, zb), {'*': liso('#a8acb0'), 'cima': liso('#e2e6e8')})
    # os ímãs (as bolinhas coloridas), o bilhete amarelo, a folha branca presa e o desenho de criança
    o = obj(contorno=False)
    for (xa, xb, za, zb, cor) in ((x0 + 0.06, x0 + 0.2, 0.92, 1.1, '#f2e47a'), (x0 + 0.16, x0 + 0.32, 0.56, 0.84, '#f4f2ea'),
                                  (x0 + 0.08, x0 + 0.26, 1.42, 1.62, '#bfe0f0')):
        CZ.c.caixa((xa, xb, y1, y1 + 0.006, za, zb), liso(cor), M, o)
        CZ.c.caixa((xa, xb, y1, y1 + 0.007, zb - PZ, zb), liso(_hex(_tom(hx(cor), 0.86))), M, o)
    for (x, z, cor) in ((x0 + 0.13, 1.08, '#d43a2a'), (x0 + 0.24, 0.82, '#3a7ac8'), (x0 + 0.17, 1.6, '#4aa04a'), (x0 + 0.34, 1.2, '#e8a030'),
                        (x0 + 0.3, 0.42, '#d43a2a')):
        caixa((x - 0.022, x + 0.022, y1, y1 + 0.02, z - 0.02, z + 0.02), liso(cor), contorno=False)
    pegada(x0, x1, y0, y1)


def _fogao_gas():
    """
    O fogão de quatro bocas branco (0,9 m): as grades de ferro e os queimadores apagados (nada aceso), o painel com os
    botões, a porta do forno com o visor e o puxador; do lado, o botijão de gás com a mangueira.
    """
    x0, x1, y0, y1 = 0.03, 0.52, 0.1, 0.68
    zt = 0.86
    c0 = hx(ESMALTE)

    def frente(L, n, P):
        z, x = P[:, 2], P[:, 0]
        out = np.tile(c0, (len(P), 1))
        painel = z > 0.74
        out = np.where(painel[:, None], hx('#d8d8d2'), out)
        out = np.where((np.abs(z - 0.74) < PZ * 0.55)[:, None], hx('#9a9a94'), out)
        visor = (x > x0 + 0.08) & (x < x1 - 0.08) & (z > 0.3) & (z < 0.56)
        out = np.where(visor[:, None], hx('#2a2a2e'), out)
        d = (z - 0.3) / 0.26 * 1.4 - (x - x0 - 0.08) / (x1 - x0 - 0.16)
        out = np.where((visor & (d > 0.3) & (d < 0.48))[:, None], hx('#4a4e56'), out)
        borda = (x > x0 + 0.05) & (x < x1 - 0.05) & (z > 0.12) & (z < 0.68) & ~visor
        out = np.where((borda & ((z < 0.12 + PZ * 1.2) | (z > 0.68 - PZ * 1.2)))[:, None], _tom(c0, 0.84), out)
        return out

    def tampo(L, n, P):
        x, y = P[:, 0], P[:, 1]
        out = np.tile(hx('#f4f4ee'), (len(P), 1))
        mesa = (x > x0 + 0.03) & (x < x1 - 0.03) & (y > y0 + 0.04) & (y < y1 - 0.03)
        out = np.where(mesa[:, None], hx('#e2e2dc'), out)
        for (bx_, by_, r) in ((0.15, 0.25, 0.06), (0.4, 0.25, 0.05), (0.15, 0.52, 0.05), (0.4, 0.52, 0.065)):
            d = np.hypot(x - bx_, y - by_)
            out = np.where((d < r)[:, None], hx('#4a4a4e'), out)
            out = np.where((d < r * 0.6)[:, None], hx('#26262a'), out)
            out = np.where((d < r * 0.25)[:, None], hx('#5a5a5e'), out)
            # a trempe de ferro (a cruz em cima da boca)
            cruz = (d < r * 1.25) & ((np.abs(x - bx_) < PH * 0.6) | (np.abs(y - by_) < PH * 0.6))
            out = np.where(cruz[:, None], hx('#141416'), out)
        return out
    caixa((x0 + 0.03, x1 - 0.03, y0 + 0.03, y1 - 0.04, 0.0, 0.04), liso('#2a2a2c'))
    caixa((x0, x1, y0, y1, 0.04, zt), {'*': liso(_hex(_tom(c0, 0.97))), 'frente': emissivo(frente), 'cima': emissivo(tampo)})
    # os botões do painel e o puxador do forno
    for k in range(4):
        x = x0 + 0.08 + k * (x1 - x0 - 0.16) / 3
        caixa((x - 0.022, x + 0.022, y1, y1 + 0.03, 0.775, 0.815), {'*': liso('#2a2a2c'), 'cima': liso('#5a5a5e')})
    caixa((x0 + 0.07, x1 - 0.07, y1 + 0.02, y1 + 0.045, 0.6, 0.63), {'*': liso('#b8bcc0'), 'cima': liso('#e8eaec')})
    for x in (x0 + 0.08, x1 - 0.08):
        caixa((x - 0.012, x + 0.012, y1, y1 + 0.03, 0.6, 0.63), liso('#a0a4a8'), contorno=False)
    # o botijão de gás (o casco azul-acinzentado, a alça, o registro) e a mangueira até o fogão
    bx_, by_ = 0.64, 0.4
    _poligono_rodado(bx_, by_, [(0.0, 0.085), (0.03, 0.1), (0.06, 0.105), (0.34, 0.105), (0.39, 0.09), (0.43, 0.05)],
                     vol(bx_, by_, '#4a6e8a', brilho=0.3), obj(), lados=18, tampa_mat=liso('#3a5a72'))
    CZ.c.cilindro(bx_, by_, 0.07, 0.4, 0.48, vol(bx_, by_, '#4a6e8a'), M, obj(), lados=14, tampa=False)
    CZ.c.cilindro(bx_, by_, 0.022, 0.43, 0.5, vol(bx_, by_, '#b8a040', brilho=0.4), M, obj(), lados=8, tampa_mat=liso('#d8c060'))
    FF._viga(obj(contorno=False), (bx_ - 0.02, by_, 0.49), (x1 + 0.005, by_ - 0.08, 0.3), 0.02, liso('#3a3a3a'))
    pegada(x0, x1, y0, y1)
    pegada_redonda(bx_, by_, 0.1, 5)


def _maquina_lavar():
    """A máquina de lavar de abrir em cima: o corpo branco, a tampa de vidro fumê, o painel de trás com o botão e as luzes."""
    x0, x1, y0, y1 = 0.08, 0.67, 0.07, 0.68
    zt = 0.92
    c0 = hx(ESMALTE)

    def tampo(L, n, P):
        x, y = P[:, 0], P[:, 1]
        out = np.tile(_tom(c0, 1.04), (len(P), 1))
        tampa = (x > x0 + 0.06) & (x < x1 - 0.06) & (y > y0 + 0.2) & (y < y1 - 0.05)
        out = np.where(tampa[:, None], hx('#d8dcdc'), out)
        vid = (x > x0 + 0.1) & (x < x1 - 0.1) & (y > y0 + 0.24) & (y < y1 - 0.09)
        out = np.where(vid[:, None], hx('#4a6670'), out)
        d = (x - x0) * 1.2 - (y - y0)
        out = np.where((vid & (np.abs(d + 0.05) < 0.025))[:, None], hx('#7a96a0'), out)
        return out

    def frente(L, n, P):
        z = P[:, 2]
        out = np.tile(c0, (len(P), 1))
        out = np.where(((z > 0.74) & (z < 0.78))[:, None], hx('#7a9aaa'), out)
        out = np.where((z < 0.09)[:, None], hx('#c8c8c2'), out)
        return out
    caixa((x0, x1, y0, y1, 0.0, zt), {'*': liso(_hex(_tom(c0, 0.97))), 'frente': emissivo(frente), 'cima': emissivo(tampo)})
    # o painel de trás (o botão grande e as luzinhas, sem número)
    def painel(L, n, P):
        x, z = P[:, 0], P[:, 2]
        out = np.tile(hx('#e2e2dc'), (len(P), 1))
        for k, cor in enumerate(('#e04a3a', '#4ac06a', '#e8c030')):
            xl = x0 + 0.1 + k * 0.05
            out = np.where(((np.abs(x - xl) < 0.012) & (np.abs(z - (zt + 0.06)) < 0.015))[:, None], hx(cor), out)
        out = np.where(((x > x0 + 0.27) & (x < x0 + 0.4) & (np.abs(z - (zt + 0.06)) < 0.03))[:, None], hx('#3a4a40'), out)
        return out
    caixa((x0, x1, y0, y0 + 0.14, zt, zt + 0.1), {'*': liso('#d8d8d2'), 'frente': emissivo(painel), 'cima': liso('#f2f2ee')})
    caixa((x1 - 0.16, x1 - 0.08, y0 + 0.14, y0 + 0.165, zt + 0.02, zt + 0.09), {'*': liso('#9aa0a6'), 'cima': liso('#c8ccd0')})
    pegada(x0, x1, y0, y1)


def _tanque():
    """O tanque de cimento: a cuba com o esfregador de frisos na frente, a coluna, a torneira, o sabão azul e a escova."""
    x0, x1, y0, y1 = 0.05, 0.7, 0.06, 0.64
    zb, zt = 0.62, 0.9
    CIM = '#b8b4aa'
    c0 = hx(CIM)

    def borda(L, n, P):
        x, y = P[:, 0], P[:, 1]
        out = np.tile(_tom(c0, 1.06), (len(P), 1))
        dentro = (x > x0 + 0.05) & (x < x1 - 0.05) & (y > y0 + 0.05) & (y < y1 - 0.05)
        cuba = dentro & (y < y0 + 0.32)
        esf = dentro & ~cuba
        out = np.where(cuba[:, None], hx('#8a867c'), out)
        out = np.where((cuba & (y < y0 + 0.05 + 1.5 * PH))[:, None], hx('#6e6a62'), out)
        out = np.where((cuba & (x < x0 + 0.05 + PH * 1.5))[:, None], hx('#7a766c'), out)
        ralo = np.hypot(x - (x0 + x1) / 2, y - (y0 + 0.2)) < 0.025
        out = np.where(ralo[:, None], hx('#4a4842'), out)
        frisos = (np.floor((y - y0) / (2 * PH)) % 2 == 0)
        out = np.where((esf & frisos)[:, None], hx('#a29e94'), out)
        out = np.where((esf & ~frisos)[:, None], hx('#c4c0b6'), out)
        return out
    caixa((x0, x1, y0, y1, zb, zt), {'*': liso(CIM), 'cima': emissivo(borda)})
    caixa((x0 + 0.03, x1 - 0.03, y0 + 0.02, y1 - 0.03, zb - 0.06, zb), liso(_escuro(CIM, 0.85)))
    caixa((0.25, 0.5, y0 + 0.14, y0 + 0.44, 0.0, zb - 0.06), {'*': liso(_escuro(CIM, 0.93)), 'cima': liso(CIM)})
    # a torneira (o cano que sobe atrás e o bico) e o sabão em barra e a escova
    xm = (x0 + x1) / 2
    caixa((xm - 0.018, xm + 0.018, y0 - 0.02, y0 + 0.016, zt, zt + 0.2), {'*': liso('#a8aeb2'), 'cima': liso('#e2e6e8')})
    caixa((xm - 0.018, xm + 0.018, y0 - 0.02, y0 + 0.13, zt + 0.17, zt + 0.2), {'*': liso('#a8aeb2'), 'cima': liso('#e2e6e8')})
    caixa((xm - 0.04, xm + 0.04, y0 - 0.01, y0 + 0.03, zt + 0.21, zt + 0.235), liso('#e8e0c0'))
    caixa((x0 + 0.12, x0 + 0.22, y1 - 0.2, y1 - 0.12, zt - 0.02, zt + 0.02), {'*': liso('#3a6ac0'), 'cima': liso('#6a9ae0')})
    caixa((x1 - 0.2, x1 - 0.07, y1 - 0.13, y1 - 0.07, zt, zt + 0.03), {'*': liso('#c87a3a'), 'cima': liso('#e09a50')})
    caixa((x1 - 0.19, x1 - 0.08, y1 - 0.125, y1 - 0.075, zt + 0.03, zt + 0.05), liso('#f0e8c8'), contorno=False)
    pegada(x0, x1, y0, y1)


AZULEJO = ['#f2f2ee', '#eaeae4', '#f6f6f2']


def mat_azulejo(passo=0.15, cores=AZULEJO, junta='#b8bcbc', eixo='parede'):
    cs = np.stack([hx(x) for x in cores])
    jc = hx(junta)

    def f(L, n, P):
        n = np.asarray(n, float)
        a, b = BE.coords(P, n)
        ia, ib = np.floor(a / passo), np.floor(b / passo)
        out = cs[(ruido(ia * 17 + ib, 2.2) * len(cs)).astype(int) % len(cs)]
        ga, gb = (a / passo - ia) * passo, (b / passo - ib) * passo
        ep = PZ if abs(n[2]) < 0.5 else PH
        return np.where(((ga < PH) | (gb < ep))[:, None], jc, out)
    return emissivo(f)


def _box_chuveiro():
    """
    O box (2,1 m): o piso de azulejo com o ralo, a parede de azulejo de trás com o registro, o chuveiro elétrico branco
    e o cano, e o vidro (os perfis de alumínio, o puxador e os reflexos em diagonal; o que está atrás fica azulado).
    """
    x0, x1, y0, y1 = 0.04, 0.71, 0.04, 0.71
    H = 2.1
    caixa((x0, x1, y0, y1, 0.0, 0.05), {'cima': mat_azulejo(0.165), '*': liso('#d8d8d2')})
    caixa(((x0 + x1) / 2 - 0.05, (x0 + x1) / 2 + 0.05, 0.42, 0.52, 0.05, 0.054), liso('#8a8e90'), contorno=False)
    caixa((x0, x1, y0, y0 + 0.05, 0.05, H), {'*': mat_azulejo(0.165), 'cima': liso('#e8e8e2')})
    xm = (x0 + x1) / 2
    # o cano, o chuveiro elétrico (a caixa branca e o crivo), o fio e o registro
    caixa((xm - 0.015, xm + 0.015, y0 + 0.05, y0 + 0.08, 1.9, H - 0.05), {'*': liso('#e8e8e4'), 'cima': liso('#f6f6f2')})
    caixa((xm - 0.015, xm + 0.015, y0 + 0.05, y0 + 0.2, 1.9, 1.93), {'*': liso('#e8e8e4'), 'cima': liso('#f6f6f2')})
    caixa((xm - 0.07, xm + 0.07, y0 + 0.16, y0 + 0.3, 1.74, 1.92), {'*': liso('#f0f0ec'), 'cima': liso('#fafaf6')})
    caixa((xm - 0.06, xm + 0.06, y0 + 0.17, y0 + 0.29, 1.72, 1.74), liso('#b8bcbe'))
    caixa((xm + 0.06, xm + 0.075, y0 + 0.05, y0 + 0.07, 1.82, H - 0.05), liso('#2a2a2a'), contorno=False)
    caixa((xm - 0.03, xm + 0.03, y0 + 0.05, y0 + 0.08, 1.1, 1.16), {'*': liso('#b8bcc0'), 'cima': liso('#e8eaec')})
    CZ.vidros.append((x0 + 0.02, x1 - 0.02, y0 - 0.01, y1 - 0.02, 0.05, H - 0.06))
    # os perfis de alumínio (as quinas, o trilho de cima e o de baixo) e o puxador
    m = {'*': liso(ALU), 'cima': liso(ALU_C)}
    o = obj()
    e = 0.025
    for (a, b) in ((x1 - e, y1 - e), (x0, y1 - e), (x1 - e, y0), (x0, y0)):
        CZ.c.caixa((a, a + e, b, b + e, 0.05, H - 0.04), m, M, o)
    for (b) in ((x0, x1, y1 - e, y1), (x1 - e, x1, y0, y1), (x0, x0 + e, y0, y1)):
        CZ.c.caixa((b[0], b[1], b[2], b[3], H - 0.07, H - 0.03), m, M, o)
        CZ.c.caixa((b[0], b[1], b[2], b[3], 0.05, 0.08), m, M, o)
    caixa((xm + 0.05, xm + 0.075, y1, y1 + 0.03, 0.85, 1.25), {'*': liso('#d8dcde'), 'cima': liso('#f2f4f4')})
    # os reflexos no vidro: as riscas claras em diagonal (na frente e do lado)
    orf = obj(contorno=False, sombra=False)
    CZ.luzes.add(orf)
    for (xa, za, xb, zb, w) in ((x0 + 0.1, 0.5, x0 + 0.3, 1.5, 0.03), (x0 + 0.18, 0.4, x0 + 0.33, 1.15, 0.015)):
        CZ.c.face_plana([(xa, y1 - 0.01, za), (xa + w, y1 - 0.01, za), (xb + w, y1 - 0.01, zb), (xb, y1 - 0.01, zb)], (0, 1, 0),
                        liso('#e4f0f2'), M, orf)
    for (ya, za, yb, zb, w) in ((y1 - 0.14, 0.6, y1 - 0.36, 1.6, 0.03),):
        CZ.c.face_plana([(x1 - 0.01, ya, za), (x1 - 0.01, ya - w, za), (x1 - 0.01, yb - w, zb), (x1 - 0.01, yb, zb)], (1, 0, 0),
                        liso('#d0e2e6'), M, orf)
    pegada(x0, x1, y0, y1)


def _rack_tv():
    """O rack de madeira (o armário, o nicho com o aparelho de DVD, as gavetas) com a TV de tela plana desligada e os enfeites."""
    import casa as CA
    W = 2 * CASA
    x0, x1, y0, y1 = 0.06, W - 0.06, 0.16, 0.6
    MAD = '#6a4a30'
    md = mad2(MAD, eixo=0, seed=3, passo=0.05)
    topo = {'*': md, 'cima': mad2('#7e5a3a', eixo=0, seed=4, passo=0.05)}
    caixa((x0 + 0.04, x1 - 0.04, y0 + 0.03, y1 - 0.03, 0.0, 0.06), liso('#2e2016'))
    caixa((x0, x1, y0, y1, 0.44, 0.5), topo)
    caixa((x0, x1, y0, y1, 0.06, 0.12), topo)
    caixa((x0 + 0.42, x1 - 0.42, y0, y0 + 0.03, 0.12, 0.44), liso('#3a2618'))
    pain_e = [(x0 + 0.03, x0 + 0.4, 0.14, 0.42, 'p')]
    caixa((x0, x0 + 0.42, y0, y1, 0.12, 0.44), {'*': md, 'frente': CA.almofadas(MAD, pain_e, eixo=0, seed=5)})
    pain_d = [(x1 - 0.4, x1 - 0.03, 0.29, 0.42, 'g'), (x1 - 0.4, x1 - 0.03, 0.14, 0.28, 'g')]
    caixa((x1 - 0.42, x1, y0, y1, 0.12, 0.44), {'*': md, 'frente': CA.almofadas(MAD, pain_d, eixo=0, seed=6)})
    for (x, z) in ((x0 + 0.36, 0.28), (x1 - 0.21, 0.36), (x1 - 0.21, 0.21)):
        caixa((x - 0.02, x + 0.02, y1, y1 + 0.025, z - 0.012, z + 0.012), liso('#c8b070'), contorno=False)
    # o nicho: o aparelho de DVD e os DVDs em pé
    caixa((x0 + 0.5, x0 + 0.86, y0 + 0.08, y1 - 0.06, 0.12, 0.19), {'*': liso('#1e1e22'), 'cima': liso('#2e2e34')})
    caixa((x0 + 0.53, x0 + 0.56, y1 - 0.06, y1 - 0.055, 0.15, 0.16), liso('#4ac0f0'), contorno=False)
    for k in range(5):
        xx = x0 + 0.9 + k * 0.025
        caixa((xx, xx + 0.02, y0 + 0.1, y1 - 0.08, 0.12, 0.3), liso(['#2a3a6a', '#8a2a2a', '#2a2a2a', '#4a6a3a', '#c8a040'][k]))
    # a TV: o pé, a tela preta com o reflexo, a moldura fina
    XC = W / 2
    caixa((XC - 0.16, XC + 0.16, 0.28, 0.46, 0.5, 0.52), liso('#1a1a1e'))
    caixa((XC - 0.03, XC + 0.03, 0.34, 0.39, 0.52, 0.62), liso('#1a1a1e'))
    tx0, tx1, tz0, tz1 = XC - 0.5, XC + 0.5, 0.6, 1.18

    def tela(L, n, P):
        x, z = P[:, 0], P[:, 2]
        out = np.tile(hx('#1c1e24'), (len(P), 1))
        ff = (x < tx0 + 0.02) | (x > tx1 - 0.02) | (z < tz0 + 0.025) | (z > tz1 - 0.02)
        d = (z - tz0) / (tz1 - tz0) * 1.6 - (x - tx0) / (tx1 - tx0)
        out = np.where(((d > 0.45) & (d < 0.62))[:, None], hx('#2c323c'), out)
        out = np.where(((d > 0.75) & (d < 0.8))[:, None], hx('#262a32'), out)
        return np.where(ff[:, None], hx('#0e0e10'), out)
    caixa((tx0, tx1, 0.36, 0.4, tz0, tz1), {'*': liso('#2a2a2e'), 'frente': emissivo(tela), 'cima': liso('#3a3a40')})
    # os enfeites: o vaso com a planta, o porta-retrato e a tigela
    TD._vaso(x0 + 0.17, 0.4, 0.5, r=0.07, h=0.12, flores=None, seed=3)
    caixa((x1 - 0.26, x1 - 0.12, 0.4, 0.43, 0.5, 0.66), {'*': liso('#c8a868'), 'frente': liso('#a8c0c8'), 'cima': liso('#d8b878')})
    _poligono_rodado(x1 - 0.12, 0.28, [(0.5, 0.04), (0.53, 0.07), (0.55, 0.075)], vol(x1 - 0.12, 0.28, '#3a7a8a'), obj(), lados=12,
                     tampa_mat=liso('#2a5a68'))
    CZ.itens_peq.append((x1 - 0.26, x1 - 0.12, 0.4, 0.43, 0.5))
    pegada(x0, x1, y0, y1)


def _mesa_centro():
    """A mesinha de centro (0,42 m, só as pernas embaixo): o tampo de madeira, a revista e o vasinho de flor."""
    x0, x1, y0, y1 = 0.08, 0.67, 0.14, 0.61
    zt = 0.42
    MAD = '#7a5232'
    caixa((x0, x1, y0, y1, zt - 0.04, zt), {'*': mad2('#5a3a22', eixo=0, seed=8, passo=0.05),
                                           'cima': tab2(['#8a5e3a', '#845a38', '#90623e'], 0.12, '#4a2e1c', eixo=0, seed=9)})
    for (a, b) in ((x0 + 0.03, y0 + 0.03), (x1 - 0.08, y0 + 0.03), (x0 + 0.03, y1 - 0.08), (x1 - 0.08, y1 - 0.08)):
        caixa((a, a + 0.05, b, b + 0.05, 0.0, zt - 0.04), mad2(MAD, eixo=1, seed=10, passo=0.04))
    # a revista (a capa com os blocos de cor, sem letra)
    def capa(L, n, P):
        x, y = P[:, 0], P[:, 1]
        out = np.tile(hx('#f0ece4'), (len(P), 1))
        out = np.where(((y - 0.36) < 0.05)[:, None], hx('#c83a2a'), out)
        out = np.where(((x > 0.2) & (x < 0.32) & (y > 0.42) & (y < 0.52))[:, None], hx('#4a7a9a'), out)
        return out
    caixa((0.14, 0.36, 0.36, 0.54, zt, zt + 0.01), {'*': liso('#e0dcd4'), 'cima': emissivo(capa)}, contorno=False)
    CZ.itens_peq.append((0.14, 0.36, 0.36, 0.54, zt))
    TD._vaso(0.52, 0.3, zt, r=0.05, h=0.09, flores=('#f2f0e8', '#f0c850'), seed=21)
    pegada(x0, x1, y0, y1)


def _pufe():
    """O pufe redondo estofado (0,4 m): a costura em volta, o capitonê em cima."""
    cx = cy = 0.375
    R = 0.25
    COR = '#9a6a9a'
    c0 = hx(COR)

    def faixas(P, base):
        z = P[:, 2]
        return np.where((np.abs(z - 0.22) < PZ * 0.6)[:, None], _tom(c0, 0.72), base)
    _poligono_rodado(cx, cy, [(0.0, R - 0.05), (0.03, R - 0.015), (0.07, R), (0.33, R), (0.37, R - 0.015), (0.4, R - 0.05)],
                     vol(cx, cy, COR, faixas=faixas), obj(), lados=22)

    def topo(L, n, P):
        x, y = P[:, 0] - cx, P[:, 1] - cy
        r = np.hypot(x, y)
        out = np.tile(_tom(c0, 1.06), (len(P), 1))
        out = np.where((r > R - 0.07)[:, None], c0, out)
        bot = r < 0.018
        for k in range(6):
            a = k * math.pi / 3
            bot |= np.hypot(x - 0.12 * math.cos(a), y - 0.12 * math.sin(a)) < 0.016
        return np.where(bot[:, None], _tom(c0, 0.6), out)
    _disco(cx, cy, 0.4, R - 0.05, emissivo(topo), obj(contorno=False), lados=22)
    pegada_redonda(cx, cy, R, 7)


# =====================================================================================================================
# os desenhos de espiral: as folhas no chão (decalque) e as presas com fita na parede
# =====================================================================================================================
def espiral(u, v, R, voltas, larg):
    """A espiral (de Arquimedes) em volta de (0, 0), em metros: devolve a máscara do traço."""
    r = np.hypot(u, v)
    th = np.arctan2(v, u) % (2 * math.pi)
    b = R / (voltas * 2 * math.pi)
    t = (r / b - th) / (2 * math.pi)
    d = np.abs(t - np.round(t)) * 2 * math.pi * b
    return (d < larg / 2) & (r < R)


def _desenhos_espiral():
    """As folhas espalhadas no chão (decalque de 1 px), cada uma com a mesma espiral preta riscada com força."""
    folhas = ((0.2, 0.22, 0.35, '#f2eee2', 1), (0.55, 0.3, -0.4, '#ece6d6', 2), (0.24, 0.58, 1.25, '#f4f0e6', 3))
    W_, D_ = 0.28, 0.36
    for k, (x, y, a, cor, sd) in enumerate(folhas):
        o = obj(contorno=False)
        ca, sa = math.cos(a), math.sin(a)
        pts = [(x + ca * du - sa * dv, y + sa * du + ca * dv) for (du, dv) in ((-W_ / 2, -D_ / 2), (W_ / 2, -D_ / 2), (W_ / 2, D_ / 2), (-W_ / 2, D_ / 2))]

        def folha(L, n, P, x=x, y=y, ca=ca, sa=sa, cor=cor, sd=sd):
            du = (P[:, 0] - x) * ca + (P[:, 1] - y) * sa
            dv = -(P[:, 0] - x) * sa + (P[:, 1] - y) * ca
            out = np.tile(hx(cor), (len(P), 1))
            borda = (np.abs(du) > W_ / 2 - PH) | (np.abs(dv) > D_ / 2 - PH)
            out = np.where(borda[:, None], _tom(hx(cor), 0.78), out)
            esp = espiral(du, dv + 0.01 * (sd % 2), 0.12, 1.6, 0.032)
            out = np.where(esp[:, None], hx('#161616'), out)
            # o furo no meio (riscado até rasgar): o escuro do chão aparecendo
            return np.where((np.hypot(du, dv) < 0.018)[:, None], hx('#2a2420'), out)
        CZ.c.face_plana([(px_, py_, PZ * 0.5 + k * 0.0006) for (px_, py_) in pts], (0, 0, 1), emissivo(folha), M, o)


# =====================================================================================================================
# o posto de saúde e o cartório por dentro: as cadeiras de espera, o balcão, as estantes, a maca e a garrafa de café
# =====================================================================================================================
def _cadeira_espera():
    """A fileira de três cadeiras de plástico azul (uma por casa) presas na barra de metal com os dois pés em T."""
    W = 3 * CASA
    AZ = '#2f5a8a'
    MET = '#9aa0a8'
    mm = {'*': liso(MET), 'cima': liso('#c8ccd2')}
    caixa((0.1, W - 0.1, 0.3, 0.36, 0.32, 0.37), mm)
    for x in (0.4, W - 0.4):
        caixa((x - 0.03, x + 0.03, 0.3, 0.36, 0.03, 0.32), mm)
        caixa((x - 0.04, x + 0.04, 0.1, 0.6, 0.0, 0.03), mm)
    for k in range(3):
        xc = (k + 0.5) * CASA
        a0, a1 = xc - 0.23, xc + 0.23
        caixa((xc - 0.05, xc + 0.05, 0.25, 0.4, 0.37, 0.4), mm)
        # o assento (a concha de plástico: a borda um pouco mais alta) e o encosto inclinado
        caixa((a0, a1, 0.18, 0.62, 0.4, 0.45), {'*': liso(_escuro(AZ, 0.85)), 'cima': liso(AZ)})
        caixa((a0 + 0.03, a1 - 0.03, 0.22, 0.58, 0.45, 0.452), liso(_hex(_tom(hx(AZ), 0.9))), contorno=False)
        o = obj()
        c = CZ.c
        yb0, yb1, zb0, zb1 = 0.18, 0.1, 0.48, 0.88
        nrm = (0, 0.995, 0.1)
        for (pts, n) in (([(a0, yb0 + 0.04, zb0), (a1, yb0 + 0.04, zb0), (a1, yb1 + 0.04, zb1), (a0, yb1 + 0.04, zb1)], (0, 0.98, 0.2)),
                         ([(a1, yb0, zb0), (a0, yb0, zb0), (a0, yb1, zb1), (a1, yb1, zb1)], (0, -0.98, -0.2)),
                         ([(a0, yb1, zb1), (a1, yb1, zb1), (a1, yb1 + 0.04, zb1), (a0, yb1 + 0.04, zb1)], (0, 0, 1)),
                         ([(a1, yb0, zb0), (a1, yb0 + 0.04, zb0), (a1, yb1 + 0.04, zb1), (a1, yb1, zb1)], (1, 0, 0)),
                         ([(a0, yb0 + 0.04, zb0), (a0, yb0, zb0), (a0, yb1, zb1), (a0, yb1 + 0.04, zb1)], (-1, 0, 0))):
            c.face_plana(pts, n, liso(AZ) if n[1] > 0.5 or n[2] > 0.5 else liso(_escuro(AZ, 0.8)), M, o)
        caixa((xc - 0.04, xc + 0.04, 0.14, 0.2, 0.4, 0.5), liso(_escuro(AZ, 0.7)))
    pegada(0.1, W - 0.1, 0.1, 0.62)


def _balcao_recepcao():
    """O balcão de atendimento (1,1 m): a frente branca com o rodapé, o tampo de madeira clara, o monitor (de costas),
    a impressora, a campainha e a prancheta."""
    W = 3 * CASA
    x0, x1, y0, y1 = 0.06, W - 0.06, 0.12, 0.66
    zt = 1.1

    def frente(L, n, P):
        z = P[:, 2]
        out = np.tile(hx('#f0ece4'), (len(P), 1))
        out = np.where((z < 0.1)[:, None], hx('#8a8a86'), out)
        out = np.where((np.abs(z - 0.7) < 0.03)[:, None], hx('#2f6194'), out)
        g = ((P[:, 0] - x0) / 0.71) % 1
        out = np.where(((g < 0.02) & (z > 0.1))[:, None], hx('#d6d2ca'), out)
        return out
    caixa((x0, x1, y0, y1 - 0.04, 0.0, zt - 0.04), {'*': liso('#e6e2da'), 'frente': emissivo(frente), 'costas': liso('#d8d2c6')})
    caixa((x0 - 0.03, x1 + 0.03, y0 - 0.02, y1 + 0.02, zt - 0.04, zt),
          {'*': liso('#a07a4e'), 'cima': tab2(['#c49a64', '#bc9460', '#c8a06a'], 0.18, '#8a6a40', eixo=0, seed=4, comp=1.2)})
    # o monitor (virado para quem atende: daqui se vê a costas), o teclado não aparece
    mx = 0.75
    caixa((mx - 0.1, mx + 0.1, 0.3, 0.42, zt, zt + 0.015), liso('#2a2a2e'))
    caixa((mx - 0.025, mx + 0.025, 0.34, 0.38, zt, zt + 0.14), liso('#2a2a2e'))
    caixa((mx - 0.26, mx + 0.26, 0.38, 0.43, zt + 0.1, zt + 0.42), {'*': liso('#34343a'), 'cima': liso('#4a4a50'), 'costas': liso('#1a1a1e')})
    # a impressora (cinza clara, a bandeja e a folha), a campainha e a prancheta com o papel
    caixa((1.42, 1.82, 0.2, 0.52, zt, zt + 0.18), {'*': liso('#c8cac8'), 'cima': liso('#dcdedc')})
    caixa((1.48, 1.76, 0.5, 0.6, zt + 0.06, zt + 0.08), liso('#9a9c9a'))
    caixa((1.5, 1.74, 0.3, 0.46, zt + 0.18, zt + 0.185), liso('#f6f6f2'), contorno=False)
    _poligono_rodado(1.98, 0.56, [(zt, 0.045), (zt + 0.01, 0.045), (zt + 0.04, 0.035), (zt + 0.055, 0.015)], vol(1.98, 0.56, '#c8ccd0', brilho=0.5), obj(), lados=12)
    caixa((1.97, 1.99, 0.55, 0.57, zt + 0.055, zt + 0.07), liso('#e8eaec'), contorno=False)
    caixa((0.18, 0.4, 0.4, 0.64, zt, zt + 0.012), {'*': liso('#8a6a40'), 'cima': liso('#a8804e')})
    caixa((0.2, 0.38, 0.42, 0.6, zt + 0.012, zt + 0.016), liso('#f4f2ea'), contorno=False)
    caixa((0.26, 0.32, 0.58, 0.62, zt + 0.012, zt + 0.025), liso('#c8ccd0'), contorno=False)
    CZ.itens_peq.extend([(1.42, 1.82, 0.2, 0.52, zt), (0.18, 0.4, 0.4, 0.64, zt)])
    pegada(x0, x1, y0, y1)


def _estante_aco(W, H, n, cor):
    """A estante de aço: os quatro montantes de cantoneira furada e as prateleiras de chapa (devolve as alturas)."""
    x0, x1, y0, y1 = 0.05, W - 0.05, 0.14, 0.6
    c0 = hx(cor)

    def montante(L, n_, P):
        z = P[:, 2]
        furo = (np.floor(z / (3 * PZ)) % 2 == 0) & (np.abs(np.asarray(n_)[2]) < 0.5)
        return np.where(furo[:, None], _tom(c0, 0.62), np.tile(c0, (len(P), 1)))
    for (a, b) in ((x0, y0), (x1 - 0.035, y0), (x0, y1 - 0.035), (x1 - 0.035, y1 - 0.035)):
        caixa((a, a + 0.035, b, b + 0.035, 0.0, H), {'*': emissivo(montante), 'cima': liso(_hex(_tom(c0, 1.2)))})
    zs = [0.08 + (H - 0.12) * k / (n - 1) for k in range(n)]
    for z in zs:
        caixa((x0, x1, y0, y1, z - 0.03, z), {'*': liso(_hex(_tom(c0, 0.9))), 'cima': liso(_hex(_tom(c0, 1.08)))})
    return x0, x1, y0, y1, zs


def _estante_arquivo():
    """A estante de aço com as caixas-arquivo de papelão em pé (a etiqueta branca sem nada escrito, o furo de puxar)."""
    W = 2 * CASA
    x0, x1, y0, y1, zs = _estante_aco(W, 2.1, 5, '#4a4e54')
    PAP = ['#c8a878', '#bea070', '#d0b080', '#b8986a']
    for i, z in enumerate(zs[:-1]):
        x = x0 + 0.05
        k = 0
        while x < x1 - 0.17:
            cor = PAP[int(ruido(i * 13 + k, 3.1) * 4) % 4]
            h = 0.26 + 0.02 * (k % 2)
            larg = 0.12

            def frente(L, n, P, x=x, z=z, h=h, larg=larg, cor=cor):
                u = (P[:, 0] - x) / larg
                v = (P[:, 2] - z) / h
                out = np.tile(hx(cor), (len(P), 1))
                out = np.where(((u > 0.15) & (u < 0.85) & (v > 0.5) & (v < 0.78))[:, None], hx('#f2efe6'), out)
                out = np.where(((np.abs(u - 0.5) < 0.18) & (np.abs(v - 0.3) < 0.07))[:, None], hx('#4a3a28'), out)
                return out
            if ruido(i * 7 + k, 9.9) < 0.12:
                x += larg + 0.03
                k += 1
                continue
            caixa((x, x + larg, y0 + 0.06, y1 - 0.04, z, z + h), {'*': liso(_escuro(cor, 0.94)), 'frente': emissivo(frente), 'cima': liso(_hex(_tom(hx(cor), 1.06)))})
            x += larg + 0.008
            k += 1
    # em cima, duas caixas deitadas
    caixa((x0 + 0.1, x0 + 0.55, y0 + 0.05, y1 - 0.05, zs[-1], zs[-1] + 0.14), {'*': liso('#bea070'), 'cima': liso('#d0b282')})
    caixa((x0 + 0.62, x0 + 1.0, y0 + 0.08, y1 - 0.08, zs[-1], zs[-1] + 0.12), {'*': liso('#c8a878'), 'cima': liso('#dabe8c')})
    pegada(x0, x1, y0, y1)


def _estante_remedios():
    """A estante de aço clara da farmácia, cheia de caixinhas de remédio coloridas (as faixas de cor, sem letra) e frascos."""
    W = 2 * CASA
    x0, x1, y0, y1, zs = _estante_aco(W, 2.0, 5, '#d8dcdf')
    CORES = [('#f4f2ec', '#3a8a5a'), ('#f4f2ec', '#c83a3a'), ('#f4f2ec', '#2f6194'), ('#e8c040', '#f4f2ec'), ('#4a8a5a', '#f4f2ec'),
             ('#f4f2ec', '#e88a30'), ('#6a4a9a', '#f4f2ec'), ('#c83a3a', '#f4f2ec')]
    for i, z in enumerate(zs[:-1]):
        x = x0 + 0.05
        k = 0
        while x < x1 - 0.12:
            r = ruido(i * 31 + k, 5.3)
            base, fx = CORES[int(r * len(CORES)) % len(CORES)]
            larg = 0.08 + 0.05 * ruido(i * 3 + k, 1.7)
            h = 0.1 + 0.07 * ruido(i * 5 + k, 2.9)
            if ruido(i * 11 + k, 7.7) < 0.18:
                # o frasco de xarope (o vidro âmbar com a tampa branca)
                xc_ = x + 0.04
                CZ.c.cilindro(xc_, 0.36, 0.035, z, z + 0.15, vol(xc_, 0.36, '#9a5a20', brilho=0.5), M, obj(), lados=10, tampa=False)
                CZ.c.cilindro(xc_, 0.36, 0.022, z + 0.15, z + 0.19, vol(xc_, 0.36, '#f2f0ea'), M, obj(), lados=8)
                x += 0.09
                k += 1
                continue

            def frente(L, n, P, x=x, z=z, h=h, base=base, fx=fx):
                v = (P[:, 2] - z) / h
                out = np.tile(hx(base), (len(P), 1))
                return np.where(((v > 0.55) & (v < 0.8))[:, None], hx(fx), out)
            # em pilha de duas, às vezes
            for j in range(1 + (ruido(i * 17 + k, 4.4) < 0.3)):
                zz = z + j * h
                caixa((x, x + larg, y0 + 0.08, y1 - 0.06, zz, zz + h), {'*': liso(_escuro(base, 0.9)), 'frente': emissivo(frente), 'cima': liso(base)})
            x += larg + 0.01
            k += 1
    pegada(x0, x1, y0, y1)


def _maca_exame():
    """
    A maca de consultório (2 casas, 0,8 m): a estrutura de tubo branco, o estofado preto com a cabeceira um pouco
    levantada, o papel lençol do rolo e a escadinha de dois degraus do lado.
    """
    x0, x1, y0, y1 = 0.06, 0.6, 0.06, 1.44
    zt = 0.8
    TUBO = {'*': liso('#d8dad8'), 'cima': liso('#f2f2f0')}
    for (a, b) in ((x0 + 0.03, y0 + 0.06), (x1 - 0.07, y0 + 0.06), (x0 + 0.03, y1 - 0.1), (x1 - 0.07, y1 - 0.1)):
        caixa((a, a + 0.04, b, b + 0.04, 0.0, zt - 0.1), TUBO)
    for (a0, a1, b0, b1) in ((x0 + 0.03, x0 + 0.07, y0 + 0.06, y1 - 0.06), (x1 - 0.07, x1 - 0.03, y0 + 0.06, y1 - 0.06)):
        caixa((a0, a1, b0, b1, 0.18, 0.22), TUBO)
    caixa((x0 + 0.03, x1 - 0.03, y0 + 0.04, y1 - 0.04, zt - 0.14, zt - 0.1), TUBO)
    PRETO_E = '#2a2a2e'

    def estofado(L, n, P):
        y = P[:, 1]
        out = np.tile(hx('#3a3a40'), (len(P), 1))
        out = np.where((np.abs(y - 0.5) < PH * 0.6)[:, None], hx('#1a1a1e'), out)
        return out
    caixa((x0, x1, 0.5, y1, zt - 0.1, zt), {'*': liso(PRETO_E), 'cima': emissivo(estofado)})
    # a cabeceira (a parte de trás, um pouco inclinada para cima)
    o = obj()
    c = CZ.c
    za, zb = zt, zt + 0.12
    nn = math.hypot(0.44, 0.12)
    c.face_plana([(x0, 0.5, za), (x1, 0.5, za), (x1, y0, zb), (x0, y0, zb)], (0, 0.12 / nn, 0.44 / nn), liso('#3a3a40'), M, o)
    c.face_plana([(x1, y0, zt - 0.1), (x0, y0, zt - 0.1), (x0, y0, zb), (x1, y0, zb)], (0, -1, 0), liso(PRETO_E), M, o)
    c.face_plana([(x1, 0.5, zt - 0.1), (x1, y0, zt - 0.1), (x1, y0, zb), (x1, 0.5, za)], (1, 0, 0), liso(PRETO_E), M, o)
    c.face_plana([(x0, y0, zt - 0.1), (x0, 0.5, zt - 0.1), (x0, 0.5, za), (x0, y0, zb)], (-1, 0, 0), liso(PRETO_E), M, o)
    # o papel lençol: a faixa branca ao comprido (seguindo a cabeceira) e o rolo pendurado na cabeceira
    xp0, xp1 = x0 + 0.13, x1 - 0.13
    op = obj(contorno=False)
    c.face_plana([(xp0, 0.5, zt + 0.004), (xp1, 0.5, zt + 0.004), (xp1, y1 - 0.02, zt + 0.004), (xp0, y1 - 0.02, zt + 0.004)], (0, 0, 1), liso('#f4f4f0'), M, op)
    c.face_plana([(xp0, 0.5, za + 0.004), (xp1, 0.5, za + 0.004), (xp1, y0 + 0.08, zb - 0.02 + 0.004), (xp0, y0 + 0.08, zb - 0.02 + 0.004)],
                 (0, 0.12 / nn, 0.44 / nn), liso('#ececE6'), M, op)
    caixa((xp0 - 0.03, xp1 + 0.03, y0 - 0.02, y0 + 0.08, zt - 0.06, zt + 0.02), {'*': liso('#f0f0ec'), 'cima': liso('#f8f8f4')})
    caixa((xp0, xp1, y1 - 0.02, y1 + 0.005, zt - 0.12, zt + 0.004), liso('#e8e8e2'), contorno=False)
    # a escadinha de dois degraus do lado (+x)
    ex0, ex1, ey0, ey1 = x1 - 0.04, 0.74, 0.62, 1.02
    DEG = {'*': liso('#c8cac8'), 'cima': liso('#3a3a40')}
    caixa((ex0, ex1, ey0, ey1, 0.0, 0.03), liso('#9a9c9a'))
    caixa((ex0, ex0 + 0.1, ey0, ey1, 0.03, 0.42), DEG)
    caixa((ex0 + 0.1, ex1, ey0, ey1, 0.03, 0.21), DEG)
    pegada(x0, x1, y0, y1)
    pegada(ex0, ex1, ey0, ey1)


def _cafeteira():
    """A garrafa térmica de café (desenhada no chão da casa: o jogo põe em cima da mesa), os copinhos e o açucareiro."""
    gx, gy = 0.33, 0.33
    _poligono_rodado(gx, gy, [(0.0, 0.07), (0.02, 0.075), (0.24, 0.075), (0.27, 0.06)], vol(gx, gy, '#3a3a3e', brilho=0.4), obj(), lados=16)
    _poligono_rodado(gx, gy, [(0.27, 0.06), (0.29, 0.055), (0.31, 0.04), (0.33, 0.03)], vol(gx, gy, '#c0c0c0', brilho=0.6), obj(), lados=14,
                     tampa_mat=liso('#d8d8d8'))
    caixa((gx + 0.07, gx + 0.1, gy - 0.015, gy + 0.015, 0.08, 0.24), {'*': liso('#2a2a2e'), 'cima': liso('#4a4a50')})
    caixa((gx + 0.04, gx + 0.1, gy - 0.015, gy + 0.015, 0.2, 0.235), liso('#2a2a2e'))
    # a pilha de copinhos de plástico e um solto com café, o açucareiro com a colherzinha
    _poligono_rodado(0.5, 0.42, [(0.0, 0.032), (0.14, 0.042)], vol(0.5, 0.42, '#f2f2ee'), obj(), lados=12, tampa_mat=liso('#d8d8d2'))
    _poligono_rodado(0.46, 0.55, [(0.0, 0.03), (0.07, 0.04)], vol(0.46, 0.55, '#f2f2ee'), obj(), lados=12, tampa_mat=liso('#4a2c18'))
    _poligono_rodado(0.27, 0.52, [(0.0, 0.045), (0.07, 0.058), (0.09, 0.052)], vol(0.27, 0.52, '#e8e2d4', brilho=0.3), obj(), lados=14,
                     tampa_mat=liso('#c83a2a'))
    caixa((0.26, 0.28, 0.51, 0.53, 0.09, 0.115), liso('#c83a2a'), contorno=False)
    pegada_redonda(gx, gy, 0.08, 5)
    pegada_redonda(0.5, 0.42, 0.04, 3)
    pegada_redonda(0.27, 0.52, 0.055, 3)


# =====================================================================================================================
# a lanchonete (9 x 8 casas, 4,6 m): a fachada amarela com a platibanda, a placa com o cachorro-quente e o copo de açaí
# desenhados, o toldo listrado de vermelho e branco, a porta de enrolar aberta (a luz de dentro) e as duas mesinhas de
# plástico vermelhas na calçada
# =====================================================================================================================
def _desenho_lanche(u, v, out):
    """A placa da lanchonete: o cachorro-quente (o pão, a salsicha, a mostarda) e o copo de açaí com a colher, sem letra."""
    # o cachorro-quente à esquerda
    du, dv = (u - 0.3) / 0.22, (v - 0.42) / 0.2
    pao = du * du + dv * dv < 1.0
    out = np.where(pao[:, None], hx('#d89a4a'), out)
    out = np.where((pao & (dv > 0.35))[:, None], hx('#e8b464'), out)
    du2, dv2 = (u - 0.3) / 0.25, (v - 0.5) / 0.08
    sal = du2 * du2 + dv2 * dv2 < 1.0
    out = np.where(sal[:, None], hx('#a8402a'), out)
    mos = sal & (np.abs(((u - 0.1) / 0.06) % 1 - 0.5) < 0.3) & (np.abs(v - 0.52 - 0.03 * np.sign(((u - 0.1) / 0.06) % 2 - 1)) < 0.03)
    out = np.where(mos[:, None], hx('#f0d030'), out)
    # o copo de açaí à direita (o copo roxo, o creme por cima, a colher)
    copo = (np.abs(u - 0.74) < 0.1 - (0.66 - v) * 0.06) & (v > 0.18) & (v < 0.66)
    out = np.where(copo[:, None], hx('#5a2a6a'), out)
    out = np.where((copo & (u < 0.71))[:, None], hx('#7a3a8a'), out)
    du3, dv3 = (u - 0.74) / 0.12, (v - 0.7) / 0.08
    out = np.where((du3 * du3 + dv3 * dv3 < 1.0)[:, None], hx('#f2ece0'), out)
    colher = (np.abs(u - 0.8 - (v - 0.7) * 0.4) < 0.015) & (v > 0.68) & (v < 0.9)
    return np.where(colher[:, None], hx('#e04a3a'), out)



# =====================================================================================================================
# as letras de placa pintada (17/10, o Felipe: "na Big Dog eu quero o texto na fachada"; a placa é "BIG DOG HOT DOGS" em
# cima e "Lanches e Açaí" embaixo): a letra de pixel 5 x 7, a do nome esticada na altura (letra de placa, estreita e
# alta) e a de baixo com uma fileira em cima para o acento e uma embaixo para a cedilha. Cada letra é uma lista de
# fileiras de cima para baixo; "1" é tinta.
# =====================================================================================================================
LETRA_5X7 = {
    'A': ['01110', '10001', '10001', '11111', '10001', '10001', '10001'],
    'B': ['11110', '10001', '10001', '11110', '10001', '10001', '11110'],
    'C': ['01111', '10000', '10000', '10000', '10000', '10000', '01111'],
    'D': ['11110', '10001', '10001', '10001', '10001', '10001', '11110'],
    'E': ['11111', '10000', '10000', '11110', '10000', '10000', '11111'],
    'G': ['01111', '10000', '10000', '10011', '10001', '10001', '01111'],
    'H': ['10001', '10001', '10001', '11111', '10001', '10001', '10001'],
    'I': ['11111', '00100', '00100', '00100', '00100', '00100', '11111'],
    'L': ['10000', '10000', '10000', '10000', '10000', '10000', '11111'],
    'N': ['10001', '11001', '10101', '10011', '10001', '10001', '10001'],
    'O': ['01110', '10001', '10001', '10001', '10001', '10001', '01110'],
    'S': ['01111', '10000', '10000', '01110', '00001', '00001', '11110'],
    'T': ['11111', '00100', '00100', '00100', '00100', '00100', '00100'],
    ' ': ['000', '000', '000', '000', '000', '000', '000'],
}
# a de baixo: a 5 x 7 com a fileira do acento em cima e a da cedilha embaixo
# (uma fileira de folga entre o acento e a letra, e a cedilha com o rabinho em duas fileiras: grudados, no tabuleiro o
# Ç e o Í viravam C e I)
LETRA_ACENTO = {k: ['0' * len(v[0])] + v + ['0' * len(v[0])] * 2 for k, v in LETRA_5X7.items()}
LETRA_ACENTO['Ç'] = ['00000'] + LETRA_5X7['C'] + ['00100', '01100']
LETRA_ACENTO['Í'] = ['00110', '00000', '00100', '00100', '00100', '00100', '00100', '01110', '00000', '00000']


def _linha_de_texto(texto, fonte, ex=1, ey=1, espaco=1):
    """O texto numa matriz de 0 e 1 (fileiras de cima para baixo): cada px da letra vira ex x ey px, com `espaco` px
    (vezes ex) entre as letras."""
    cols = []
    for i, ch in enumerate(texto):
        g = np.array([[int(c) for c in fila] for fila in fonte[ch]], dtype=np.uint8)
        g = np.kron(g, np.ones((ey, ex), dtype=np.uint8))
        if i:
            cols.append(np.zeros((g.shape[0], espaco * ex), dtype=np.uint8))
        cols.append(g)
    return np.hstack(cols)


def _letreiro_big_dog(largura_px, altura_px):
    """O letreiro da Big Dog em pixels (0 = fundo, 1 = o nome, 2 = a sombra dele, 3 = a linha de baixo)."""
    m = np.zeros((altura_px, largura_px), dtype=np.uint8)
    nome = _linha_de_texto('BIG DOG HOT DOGS', LETRA_5X7, ex=1, ey=2)
    baixo = _linha_de_texto('LANCHES E AÇAÍ', LETRA_ACENTO)
    yn = 3
    xn = (largura_px - nome.shape[1]) // 2
    # a sombra de 1 px para baixo e para a direita, depois a letra por cima
    m[yn + 1:yn + 1 + nome.shape[0], xn + 1:xn + 1 + nome.shape[1]][nome == 1] = 2
    m[yn:yn + nome.shape[0], xn:xn + nome.shape[1]][nome == 1] = 1
    # a linha de baixo começa junto com a de cima: na fachada inclinada, centralizada ela parecia cruzar o nome
    yb = yn + nome.shape[0] + 5
    xb = xn
    m[yb:yb + baixo.shape[0], xb:xb + baixo.shape[1]][baixo == 1] = 3
    return m


def _desenho_letreiro(x0, x1, z0, z1):
    """A placa inteira da fachada: o texto no meio, o cachorro-quente na ponta da esquerda e o açaí na da direita."""
    larg = int(round((x1 - x0) / PH))
    alt = int(round((z1 - z0) / PZ))
    letreiro = _letreiro_big_dog(larg, alt)
    cores = np.array([[0, 0, 0], hx('#c43a2a'), hx('#6a1a14'), hx('#5a2a6a')], dtype=float)

    def desenho(u, v, out):
        # as duas pontas: os desenhos de antes, cada um esticado na sua ponta
        esq = u < 0.17
        dir_ = u > 0.83
        out = np.where(esq[:, None], _desenho_lanche(0.04 + u / 0.17 * 0.52, v, out.copy()), out)
        out = np.where(dir_[:, None], _desenho_lanche(0.6 + (u - 0.83) / 0.17 * 0.3, v, out.copy()), out)
        col = np.clip((u * larg).astype(int), 0, larg - 1)
        fil = np.clip(((1 - v) * alt).astype(int), 0, alt - 1)
        k = letreiro[fil, col]
        return np.where((k > 0)[:, None], cores[k], out)
    return desenho


def _toldo(x0, x1, y_parede, y_frente, z_alto, z_baixo):
    """O toldo de lona listrado (vermelho e branco) inclinado, com a franja recortada na frente."""
    c = CZ.c
    o = obj()
    larg = 0.24

    def lona(L, n, P):
        k = np.floor((P[:, 0] - x0) / larg) % 2
        return np.where((k == 0)[:, None], hx('#c43a2a'), hx('#f2eee4'))
    dy, dz = y_frente - y_parede, z_baixo - z_alto
    ln = math.hypot(dy, dz)
    nrm = (0, -dz / ln, dy / ln)
    c.face_plana([(x0, y_parede, z_alto), (x1, y_parede, z_alto), (x1, y_frente, z_baixo), (x0, y_frente, z_baixo)], nrm, emissivo(lona), M, o, dois_lados=True)
    # a franja: a faixa que cai na frente, com a ponta de cada listra recortada em bico (2 px)

    def franja(L, n, P):
        out = lona(L, n, P)
        g = ((P[:, 0] - x0) / larg) % 1
        bico = (P[:, 2] < z_baixo - 0.16 + np.abs(g - 0.5) * 0.12)
        return np.where(bico[:, None], hx('#7a2418'), out)
    of = obj()
    for (xa, xb) in [(x0 + k * larg, min(x0 + (k + 1) * larg, x1)) for k in range(int(math.ceil((x1 - x0) / larg)))]:
        pts = [(xa, y_frente, z_baixo), (xb, y_frente, z_baixo), (xb, y_frente, z_baixo - 0.14), ((xa + xb) / 2, y_frente, z_baixo - 0.2),
               (xa, y_frente, z_baixo - 0.14)]
        c.face_plana(pts, (0, 1, 0), emissivo(lona), M, of, dois_lados=True)
    for xx in (x0, x1):
        c.face_plana([(xx, y_parede, z_alto), (xx, y_frente, z_baixo), (xx, y_frente, z_baixo - 0.14)], (1 if xx == x1 else -1, 0, 0),
                     liso('#c43a2a'), M, o, dois_lados=True)
    # os braços de ferro que seguram o toldo
    for xx in (x0 + 0.06, x1 - 0.06):
        FF._viga(obj(contorno=False), (xx, y_parede, z_alto - 0.55), (xx, y_frente - 0.03, z_baixo - 0.02), 0.025, liso('#3a3a3a'))


def _mesa_plastico(x, y, cadeiras=((0, -1), (0, 1))):
    """A mesinha de bar de plástico vermelha (quadrada) e as cadeiras de plástico iguais."""
    VERM = '#c43a2a'
    mv = {'*': liso(_escuro(VERM, 0.84)), 'cima': liso(VERM)}
    s = 0.3
    caixa((x - s, x + s, y - s, y + s, 0.68, 0.72), {'*': liso(_escuro(VERM, 0.84)), 'cima': liso('#d44a38')})
    for (dx, dy) in ((-1, -1), (1, -1), (-1, 1), (1, 1)):
        caixa((x + dx * (s - 0.04) - 0.025, x + dx * (s - 0.04) + 0.025, y + dy * (s - 0.04) - 0.025, y + dy * (s - 0.04) + 0.025, 0.0, 0.68), mv)
    for (dx, dy) in cadeiras:
        cx, cy = x + dx * 0.48, y + dy * 0.48
        caixa((cx - 0.2, cx + 0.2, cy - 0.19, cy + 0.19, 0.4, 0.44), mv)
        for (ax, ay) in ((-1, -1), (1, -1), (-1, 1), (1, 1)):
            caixa((cx + ax * 0.17 - 0.02, cx + ax * 0.17 + 0.02, cy + ay * 0.16 - 0.02, cy + ay * 0.16 + 0.02, 0.0, 0.4), mv)
        # o encosto do lado de fora da mesa
        yb = cy + dy * 0.17
        caixa((cx - 0.2, cx + 0.2, min(yb, yb + dy * 0.04), max(yb, yb + dy * 0.04), 0.44, 0.82), mv)
        pegada(cx - 0.2, cx + 0.2, cy - 0.19, cy + 0.19)
    pegada(x - s, x + s, y - s, y + s)


def _lanchonete():
    W, D = 9 * CASA, 8 * CASA
    X0, X1, Y0, Y1 = 0.25, W - 0.25, 0.3, D - 1.1
    B = (X0, X1, Y0, Y1)
    XP = TD._porta_x(9)
    YM = (Y0 + Y1) / 2
    ZE, ZR, ZPL = 3.1, 4.55, 3.95
    AMARELO = '#ecc85a'
    PAR = mat_parede(AMARELO, seed=111, sujeira=0.6, descasca=0.12)
    caixa((X0, X1, Y0, Y1, 0.0, ZE), PAR)
    # a platibanda da frente (a fachada sobe e esconde a água da frente) com o rufo
    caixa((X0, X1, Y1 - 0.15, Y1, ZE, ZPL), PAR)
    caixa((X0 - 0.04, X1 + 0.04, Y1 - 0.19, Y1 + 0.04, ZPL, ZPL + 0.06), {'*': liso('#d8d0be'), 'cima': liso('#ece6d6')})
    YR = (Y0 + Y1 - 0.15) / 2
    KT = (ZR - ZE) / (YR - Y0)
    FF.telhado(X0, X1, Y0, Y1 - 0.15, [(Y0 - 0.3, ZE - 0.3 * KT), (YR, ZR), (Y1 - 0.15, ZE)], 'x', TELHA, TELHA_J, PAR,
               testeira='#ece6da', cumeeira=CUMEEIRA, seed=112, beiral_u=0.25)
    YA, YB = Y0 + 1.1, Y1 - 1.1
    XJ0, XJ1 = (X0 + XP - 0.9) / 2, (XP + 0.9 + X1) / 2     # as janelas da frente, no meio de cada lado da porta
    XD = X1 - 1.2                                         # a porta dos fundos
    vaos = {'+y': [('p', XP, 0.05, 1.8, 2.3), ('j', XJ0, 1.0, 1.0, 1.1), ('j', XJ1, 1.0, 1.0, 1.1)],
            '-y': [('j', X0 + 1.2, 1.4, 0.9, 0.8), ('j', X0 + 2.9, 1.4, 0.9, 0.8), ('p', XD, 0.05, 0.8, 2.1)],
            '+x': [('j', YA, 1.2, 0.6, 0.9), ('j', YB, 1.1, 0.8, 1.0)], '-x': [('j', YA, 1.1, 0.8, 1.0), ('j', YB, 1.1, 0.8, 1.0)]}
    _conferir(vaos)
    faixa(B, 0.0, 0.45, '#c43a2a', cortes={'+y': [(XP - 0.95, XP + 0.95)], '-y': [(XD - 0.45, XD + 0.45)]})
    # a porta de enrolar aberta: o vão com a luz de dentro, a lâmina enrolada em cima e as guias de ferro dos lados
    TD._porta_aberta(B, '+y', XP, 0.05, 1.8, 2.3, {'moldura': '#8a8e92', 'porta': '#9aa0a6'})
    def lamina(L, n, P):
        g = np.floor(P[:, 2] / (2 * PZ)) % 2
        return np.where((g == 0)[:, None], hx('#9aa0a6'), hx('#b8bec4'))
    caixa((XP - 0.98, XP + 0.98, Y1, Y1 + 0.16, 2.45, 2.7), {'*': emissivo(lamina), 'cima': liso('#c8ccd0')})
    janela_alu(B, '+y', XJ1, 1.0, 1.0, 1.1, grade=None)
    janela_alu(B, '+y', XJ0, 1.0, 1.0, 1.1, grade=None)
    janela_alu(B, '-y', X0 + 1.2, 1.4, 0.9, 0.8, grade='#2c2c30', vidro='escuro')
    janela_alu(B, '-y', X0 + 2.9, 1.4, 0.9, 0.8, grade='#2c2c30', vidro='escuro')
    porta_frisada(B, '-y', XD, 0.05, 0.8, 2.1, '#8a2a20')
    janela_alu(B, '+x', YA, 1.2, 0.6, 0.9, basculante=True)
    janela_alu(B, '+x', YB, 1.1, 0.8, 1.0, grade='#2c2c30', vidro='escuro')
    for y in (YA, YB):
        janela_alu(B, '-x', y, 1.1, 0.8, 1.0, grade='#2c2c30', vidro='escuro')
    # a placa na platibanda, o toldo e a calçada com as duas mesas
    # o letreiro da fachada, de ponta a ponta da platibanda: BIG DOG grande e, embaixo, HOT DOGS · LANCHES E AÇAÍ
    LX0, LX1, LZ0, LZ1 = X0 + 0.15, X1 - 0.15, 3.02, 3.9
    _placa(Y1 + 0.005, LX0, LX1, LZ0, LZ1, _desenho_letreiro(LX0, LX1, LZ0, LZ1), '#f6f2e6', '#c43a2a', e=0.05)
    _toldo(X0 + 0.3, X1 - 0.3, Y1, Y1 + 0.85, 2.82, 2.42)
    calcada(X0 - 0.15, X1 + 0.15, Y1, D - 0.04)
    _mesa_plastico(X0 + 0.7, Y1 + 0.52, cadeiras=((-1, 0), (1, 0)))
    _mesa_plastico(X1 - 0.7, Y1 + 0.52, cadeiras=((-1, 0), (1, 0)))
    pegada(X0, X1, Y0, Y1)


def _chapa_lanche():
    """O balcão de inox (2 casas): a chapa preta com a espátula, a panela das salsichas e a estufa de vidro com os salgados."""
    W = 2 * CASA
    x0, x1, y0, y1 = 0.04, W - 0.04, 0.1, 0.66
    zt = 0.9

    def inox(L, n, P):
        n = np.asarray(n, float)
        a, b = BE.coords(P, n)
        g = np.floor(a / (3 * PH) + 0.5 * np.floor(b / 0.3)) % 4
        return np.where((g == 0)[:, None], hx('#b8bec4'), hx('#a4aab0'))
    MI = {'*': emissivo(inox), 'cima': liso('#c8ced2')}

    def frente(L, n, P):
        x, z = P[:, 0], P[:, 2]
        out = inox(L, n, P)
        for (a0, a1) in ((x0 + 0.04, 0.72), (0.76, x1 - 0.04)):
            fr = (x > a0) & (x < a1) & (z > 0.1) & (z < zt - 0.1)
            bord = fr & ((x < a0 + PH) | (x > a1 - PH) | (z < 0.1 + PZ) | (z > zt - 0.1 - PZ))
            out = np.where(bord[:, None], hx('#7e8488'), out)
        return out
    caixa((x0, x1, y0, y1, 0.0, zt), {'*': emissivo(inox), 'frente': emissivo(frente), 'cima': liso('#c8ced2')})
    for xm in (0.62, 0.86):
        caixa((xm - 0.04, xm + 0.04, y1, y1 + 0.03, 0.55, 0.58), {'*': liso('#8a9094'), 'cima': liso('#dce0e2')})
    # a chapa (o ferro preto engordurado, a borda de inox atrás e dos lados) e a espátula
    def ferro(L, n, P):
        g = suave(P[:, 0], P[:, 1], 0.08, 5) > 0.62
        return np.where(g[:, None], hx('#3a3634'), hx('#242224'))
    caixa((x0 + 0.06, 0.66, y0 + 0.06, y1 - 0.04, zt, zt + 0.025), {'*': liso('#3a3a3c'), 'cima': emissivo(ferro)})
    caixa((x0 + 0.04, 0.68, y0 + 0.03, y0 + 0.06, zt, zt + 0.1), MI)
    caixa((0.25, 0.4, 0.42, 0.5, zt + 0.025, zt + 0.032), liso('#c8ccd0'), contorno=False)
    caixa((0.4, 0.52, 0.44, 0.48, zt + 0.025, zt + 0.045), liso('#3a2a1a'))
    # a panela de alumínio das salsichas (a tampa meio aberta, o caldo vermelho)
    px_, py_ = 0.78, 0.4
    _poligono_rodado(px_, py_, [(zt, 0.11), (zt + 0.18, 0.11)], vol(px_, py_, '#c0c4c8', brilho=0.5), obj(), lados=18)
    _disco(px_, py_, zt + 0.16, 0.1, liso('#a8402a'), obj(contorno=False), lados=18)
    for k in range(3):
        CZ.c.elipsoide((px_ - 0.04 + 0.04 * k, py_ + 0.02 * (k - 1), zt + 0.17), (0.02, 0.06, 0.015),
                       lambda Pc, N, P: FF._cru_eli(np.tile(hx('#c8603a'), (len(P), 1)), N), obj())
    # a estufa de vidro: a base, os quatro cantos de inox, a tampa, a prateleira e os salgados
    ex0, ex1, ey0, ey1 = 0.94, x1 - 0.03, y0 + 0.05, y1 - 0.03
    caixa((ex0, ex1, ey0, ey1, zt, zt + 0.03), MI)
    caixa((ex0, ex1, ey0, ey1, 1.17, 1.2), MI)
    for (a, b) in ((ex0, ey0), (ex1 - 0.025, ey0), (ex0, ey1 - 0.025), (ex1 - 0.025, ey1 - 0.025)):
        caixa((a, a + 0.025, b, b + 0.025, zt + 0.03, 1.17), MI)
    caixa((ex0 + 0.03, ex1 - 0.03, ey0 + 0.03, ey1 - 0.03, 1.04, 1.05), liso('#d8dcde'), contorno=False)

    def salgado(x, y, z, k):
        if k % 3 == 0:     # a coxinha (a gota dourada)
            CZ.c.elipsoide((x, y, z + 0.035), (0.03, 0.03, 0.04), lambda Pc, N, P: FF._cru_eli(np.tile(hx('#c8803a'), (len(P), 1)), N), obj())
        elif k % 3 == 1:   # o pastel (a meia-lua achatada)
            CZ.c.elipsoide((x, y, z + 0.015), (0.05, 0.035, 0.018), lambda Pc, N, P: FF._cru_eli(np.tile(hx('#e0b058'), (len(P), 1)), N), obj())
        else:              # o pão de queijo
            CZ.c.elipsoide((x, y, z + 0.02), (0.028, 0.028, 0.022), lambda Pc, N, P: FF._cru_eli(np.tile(hx('#e8c070'), (len(P), 1)), N), obj())
    for j, z in enumerate((zt + 0.03, 1.05)):
        for i in range(4):
            for r in range(2):
                salgado(ex0 + 0.08 + i * 0.105, ey0 + 0.12 + r * 0.2, z, i + r + j)
    CZ.vidros.append((ex0 + 0.02, ex1 - 0.02, ey0 + 0.02, ey1 - 0.02, zt + 0.03, 1.17))
    orf = obj(contorno=False, sombra=False)
    CZ.luzes.add(orf)
    CZ.c.face_plana([(ex0 + 0.08, ey1 + 0.002, zt + 0.05), (ex0 + 0.1, ey1 + 0.002, zt + 0.05), (ex0 + 0.2, ey1 + 0.002, 1.15),
                     (ex0 + 0.18, ey1 + 0.002, 1.15)], (0, 1, 0), liso('#e4f0f2'), M, orf)
    pegada(x0, x1, y0, y1)


def _freezer_acai():
    """O freezer horizontal branco (2 casas): a tampa de vidro de correr e, por baixo dela, as cubas de açaí e os potes."""
    W = 2 * CASA
    x0, x1, y0, y1 = 0.05, W - 0.05, 0.1, 0.68
    zt = 0.96
    c0 = hx(ESMALTE)

    def frente(L, n, P):
        z = P[:, 2]
        out = np.tile(c0, (len(P), 1))
        out = np.where((z < 0.1)[:, None], hx('#8a8e90'), out)
        out = np.where(((z > 0.12) & (z < 0.2) & ((np.floor(P[:, 0] / (2 * PH)) % 2) == 0))[:, None], hx('#6a6e70'), out)
        out = np.where((np.abs(z - 0.62) < 0.035)[:, None], hx('#5a2a6a'), out)
        return out
    e = 0.06
    m = {'*': liso(_hex(_tom(c0, 0.97))), 'frente': emissivo(frente), 'cima': liso('#f6f6f2')}
    caixa((x0, x1, y0, y1, 0.0, 0.7), m)
    for b in ((x0, x1, y0, y0 + e), (x0, x1, y1 - e, y1), (x0, x0 + e, y0, y1), (x1 - e, x1, y0, y1)):
        caixa((b[0], b[1], b[2], b[3], 0.7, zt), m)
    # dentro: as cubas roxas de açaí (o creme com a colher marcada) e os potes de granola, leite em pó e banana
    CZ.c.caixa((x0 + e, x1 - e, y0 + e, y1 - e, 0.7, 0.72), liso('#d8dcdc'), M, obj(contorno=False))
    cubas = [(x0 + 0.1, x0 + 0.38, '#5a2a6a'), (x0 + 0.42, x0 + 0.7, '#6a3278'), (x0 + 0.74, x0 + 1.02, '#5a2a6a')]
    for (a0, a1, cor) in cubas:
        def creme(L, n, P, a0=a0, cor=cor):
            r = suave(P[:, 0] * 3, P[:, 1] * 3, 0.5, int(a0 * 10)) > 0.6
            return np.where(r[:, None], _tom(hx(cor), 1.18), hx(cor))
        caixa((a0, a1, y0 + 0.12, y1 - 0.12, 0.72, 0.86), {'*': liso('#c8ccd0'), 'cima': emissivo(creme)})
    for k, (cor, cor2) in enumerate((('#c8a060', '#a07838'), ('#f4f2ea', '#dcdad2'), ('#f0d050', '#d8b030'))):
        y = y0 + 0.16 + k * 0.14
        caixa((x1 - 0.32, x1 - 0.12, y, y + 0.12, 0.72, 0.84), {'*': liso('#e8e8e4'), 'cima': liso(cor)})
        caixa((x1 - 0.29, x1 - 0.15, y + 0.03, y + 0.09, 0.84, 0.845), liso(cor2), contorno=False)
    # a tampa: o vidro (o que está embaixo fica azulado), o trilho do meio e os puxadores
    CZ.vidros.append((x0 + e, x1 - e, y0 + e, y1 - e, 0.7, zt))
    caixa(((x0 + x1) / 2 - 0.02, (x0 + x1) / 2 + 0.02, y0 + e, y1 - e, zt - 0.03, zt), {'*': liso('#c8ccd0'), 'cima': liso('#e8eaec')})
    for xm in ((x0 + x1) / 2 - 0.12, (x0 + x1) / 2 + 0.12):
        caixa((xm - 0.05, xm + 0.05, y1 - e - 0.03, y1 - e, zt - 0.02, zt), liso('#8a8e90'), contorno=False)
    orf = obj(contorno=False, sombra=False)
    CZ.luzes.add(orf)
    for xa in (x0 + 0.25, x0 + 0.95):
        CZ.c.face_plana([(xa, y1 - e, zt - 0.005), (xa + 0.04, y1 - e, zt - 0.005), (xa + 0.16, y0 + e, zt - 0.005), (xa + 0.12, y0 + e, zt - 0.005)],
                        (0, 0, 1), liso('#e8f2f4'), M, orf)
    pegada(x0, x1, y0, y1)


# =====================================================================================================================
# os itens de parede: os desenhos de espiral presos com fita e a janela de alumínio e vidro com a grade
# =====================================================================================================================
def _desenhos_parede(xc=1.5, zc=1.5):
    """As três folhas presas com fita na parede, um pouco tortas, cada uma com a mesma espiral preta riscada."""
    n0 = len(PC.C().objs)
    a, h = PC.mw(40) / 2, PC.mh(34) / 2
    pl = PC.Pl(xc - a, xc + a, zc - h, zc + h, 0.004)
    W, H = pl.W, pl.H
    folhas = [(W * 0.18, H * 0.5, 11.0, 18.0, -0.08, '#f2eee2'), (W * 0.5, H * 0.46, 11.0, 18.0, 0.05, '#f4f0e6'),
              (W * 0.82, H * 0.52, 11.0, 18.0, -0.03, '#ece6d6')]
    papel = np.zeros_like(pl.dentro)
    for (cu, cw, fw, fh, ang, cor) in folhas:
        ca, sa = math.cos(ang), math.sin(ang)
        pts = [(cu + ca * du - sa * dw, cw + sa * du + ca * dw) for (du, dw) in ((-fw / 2, -fh / 2), (fw / 2, -fh / 2), (fw / 2, fh / 2), (-fw / 2, fh / 2))]
        m = pl.poli(pts)
        pl.pin(m, cor)
        pl.rgb[pl.borda(m)] = _tom(hx(cor), 0.72)
        du = (pl.u - cu) * ca + (pl.w - cw) * sa
        dw = -(pl.u - cu) * sa + (pl.w - cw) * ca
        esp = m & espiral(du, dw, 5.2, 2.0, 1.0)
        pl.pin(esp, '#161616')
        papel |= m
        # a fita crepe nos dois cantos de cima
        for s in (-1, 1):
            tu, tw = cu + ca * s * fw / 2 - sa * (-fh / 2), cw + sa * s * fw / 2 + ca * (-fh / 2)
            pl.pin(pl.elipse(tu, tw, 2.2, 1.2), '#e2d4a4')
    pl.contorno(papel)
    pl.grava()
    PC.sombra_parede(n0, 1, 1)


def _janela_vidro(xc=1.5, zc=1.5, aberta=True):
    """
    A janela de alumínio de correr (56 x 50 px): o vão na parede, lá fora o céu, as copas e a grade branca; as duas
    folhas de vidro (os reflexos em diagonal) no caixilho de alumínio, a moldura e o peitoril de granito. Aberta (o
    estado 0), a folha da direita correu para trás da da esquerda: a metade da direita fica sem vidro, o vento entra.
    """
    n0 = len(PC.C().objs)
    a, h = PC.mw(56) / 2 - 0.06, PC.mh(50) / 2 - 0.07
    x0, x1, z0, z1 = xc - a, xc + a, zc - h + 0.03, zc + h
    fun = 0.1
    pl = PC.Pl(x0, x1, z0, z1, -fun)
    W, H = pl.W, pl.H
    PC._faixas(pl, pl.dentro, [H * 0.3, H * 0.6], ['#9cc4dc', '#b2d2e2', '#c8e0e8'])
    pl.pin(pl.dentro & (pl.w >= H * 0.66 + PC._onda(pl.u, 1.6, 3.2, 0.4)), '#86a46e')
    pl.pin(pl.dentro & (pl.w >= H * 0.76 + PC._onda(pl.u, 1.3, 2.4, 2.0)), '#6a8a56')
    pl.pin(pl.dentro & (pl.w >= H * 0.9), '#5a7a48')
    # a grade branca lá fora (as barras e a travessa do meio)
    nb = 7
    for k in range(1, nb):
        pl.pin(pl.dentro & (np.abs(pl.u - W * k / nb) < 0.5), '#f0eee8')
    pl.pin(pl.dentro & (np.abs(pl.w - H * 0.5) < 0.5), '#f0eee8')
    # o vidro: a cor um pouco azulada e os reflexos em diagonal (na folha da esquerda; na da direita só fechada)
    vidro = pl.dentro & ((pl.u < W / 2) | (not aberta))
    pl.rgb[vidro] = pl.rgb[vidro] * 0.74 + np.array([120.0, 150.0, 166.0]) * 0.26
    for u0 in ((W * 0.12, W * 0.62) if not aberta else (W * 0.12,)):
        d = (pl.u - u0) + pl.w * 0.55
        pl.pin(vidro & (d > 0) & (d < 2.2), '#e6f2f4')
        pl.pin(vidro & (d > 3.4) & (d < 4.4), '#d4e6ec')
    pl.grava()
    # o vão: a ombreira da esquerda e o peitoril de dentro (o reboco), e o recorte do que fica atrás da parede
    o = PC.novo()
    PC.fp([(x0, -fun, z0), (x0, 0.0, z0), (x0, 0.0, z1), (x0, -fun, z1)], (1, 0, 0), liso('#d8d2c4'), o)
    PC.fp([(x0, -fun, z0), (x1, -fun, z0), (x1, 0.0, z0), (x0, 0.0, z0)], (0, 0, 1), liso('#e2dcce'), o)
    PC.recorta_vao(n0, x0, x1, z0, z1)
    # o caixilho de alumínio dentro do vão: o quadro, os montantes das folhas (aberta: os dois juntos na esquerda)
    m = {'*': liso(ALU), 'cima': liso(ALU_C)}
    yf = -fun + 0.02
    for b in ((x0, x1, yf, yf + 0.03, z1 - 0.035, z1), (x0, x1, yf, yf + 0.03, z0, z0 + 0.035), (x0, x0 + 0.035, yf, yf + 0.03, z0, z1),
              (x1 - 0.035, x1, yf, yf + 0.03, z0, z1)):
        PC.caixa(b, m)
    xm = (x0 + x1) / 2
    for xx in ((xm - 0.03, xm) if aberta else (xm - 0.03, xm)):
        PC.caixa((xx, xx + 0.03, yf + 0.03, yf + 0.06, z0, z1), m)
    if aberta:
        PC.caixa((x0 + 0.035, x0 + 0.065, yf + 0.03, yf + 0.06, z0, z1), m)
    # o fecho (o puxador) no montante do meio
    PC.caixa((xm - 0.022, xm + 0.005, yf + 0.06, yf + 0.08, (z0 + z1) / 2 - 0.05, (z0 + z1) / 2 + 0.05), liso('#2a2a2e'))
    # a moldura de alumínio por fora (rente à parede) e o peitoril de granito
    PC.moldura(x0 - 0.05, x1 + 0.05, z0 - 0.05, z1 + 0.05, 0.05, 0.03, ('#7e8488', ALU, ALU_C, '#f4f6f6'))
    PC.caixa((x0 - 0.09, x1 + 0.09, 0.0, 0.08, z0 - 0.1, z0 - 0.05), {'*': liso(_escuro(GRANITO, 0.9)), 'cima': liso(GRANITO)})
    PC.sombra_parede(n0, 1, 2)


# =====================================================================================================================
ITENS = {
    'casa_moderna': (9, 8, (0.0, 0.0), lambda: _casa_moderna('a'), {}),
    'casa_moderna~b': (9, 8, (0.0, 0.0), lambda: _casa_moderna('b'), {}),
    'casa_moderna~c': (9, 8, (0.0, 0.0), lambda: _casa_moderna('c'), {}),
    'casa_moderna~d': (9, 8, (0.0, 0.0), lambda: _casa_moderna('d'), {}),
    'casa_valenca': (14, 11, (0.0, 0.0), _casa_valenca, {}),
    'posto_saude': (18, 12, (0.0, 0.0), _posto, {}),
    'cartorio_predio': (15, 12, (0.0, 0.0), _cartorio, {}),
    'prefeitura_predio': (15, 12, (0.0, 0.0), _prefeitura, {}),
    'lanchonete_predio': (9, 8, (0.0, 0.0), _lanchonete, {}),
    'geladeira': (1, 1, (0.0, 0.0), _geladeira, {}),
    'fogao_gas': (1, 1, (0.0, 0.0), _fogao_gas, {}),
    'maquina_lavar': (1, 1, (0.0, 0.0), _maquina_lavar, {}),
    'tanque': (1, 1, (0.0, 0.0), _tanque, {}),
    'box_chuveiro': (1, 1, (0.0, 0.0), _box_chuveiro, {}),
    'rack_tv': (2, 1, (0.0, 0.0), _rack_tv, {}),
    'mesa_centro': (1, 1, (0.0, 0.0), _mesa_centro, {}),
    'pufe': (1, 1, (0.0, 0.0), _pufe, {}),
    'desenhos_espiral': (1, 1, (0.0, 0.0), _desenhos_espiral, {}),
    'cadeira_espera': (3, 1, (0.0, 0.0), _cadeira_espera, {}),
    'balcao_recepcao': (3, 1, (0.0, 0.0), _balcao_recepcao, {}),
    'estante_arquivo': (2, 1, (0.0, 0.0), _estante_arquivo, {}),
    'estante_remedios': (2, 1, (0.0, 0.0), _estante_remedios, {}),
    'maca_exame': (1, 2, (0.0, 0.0), _maca_exame, {}),
    'cafeteira': (1, 1, (0.0, 0.0), _cafeteira, {}),
    'chapa_lanche': (2, 1, (0.0, 0.0), _chapa_lanche, {}),
    'freezer_acai': (2, 1, (0.0, 0.0), _freezer_acai, {}),
}
ITENS_PAREDE = {
    'desenho_espiral_parede': (lambda: _desenhos_parede(1.5, 1.5), (1.5, 1.5)),
    # a janela: 0 aberta (o padrão, como a janela da cozinha), '1' fechada
    'janela_vidro': (lambda: _janela_vidro(1.5, 1.5, True), (1.5, 1.5), {'1': lambda: _janela_vidro(1.5, 1.5, False)}),
}
