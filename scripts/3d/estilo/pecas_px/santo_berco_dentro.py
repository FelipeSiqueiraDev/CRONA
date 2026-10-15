"""
GRUPO SB-D, "Santo Berço por dentro, segunda leva" (15/10): os móveis do Hotel (o balcão da recepção, os quatro
retratos dos Hoteleiros, o quadro das chaves), da Casa do Doutor (a maca, o armário de botica, a mesa do Doutor, os
frascos), dos celeiros da Fazenda (os olhos dos bichos escondidos no escuro) e as miudezas que enchem as mesas e as
lareiras de toda a vila (a lenha, a cesta de pão, a jarra com as canecas). Pixel art 1:1 só por código, no estilo de
medieval.py (que este módulo reaproveita: os materiais de carvalho, o estanho, a manta de lã, a caneca e a jarra).

Tudo no giro 4 (a frente para +y), a pegada começando em (0, 0), no tamanho do catálogo (shared/src/furni.ts, o bloco
"SANTO BERÇO (15/10)", a altura em METROS; nenhuma destas peças tem `aumento`).

Decisões:
  - balcao_hotel: o tampo a 1,05 m (o que vai em cima não flutua); a frente de almofadas; em cima, o livro dos
    hóspedes aberto, o tinteiro com a pena e a sineta de latão. Pontas retas (emenda em fila, como o da taverna).
  - mesa_doutor (desk, vao 'fundo'): o tampo a 0,8 m com o couro verde; os dois gaveteiros virados para +y (o lado da
    cadeira) e o vão no meio, onde a cadeira encaixa; nada em cima (os frascos e os livros são peças do seed).
  - armario_boticario: 0 FECHADO (as portinholas de vidro com os potes atrás), '1' ABERTO (as quatro portinholas
    giradas, duas gavetas puxadas), e a gêmea !vazio (aberta e vazia: as prateleiras nuas).
  - olhos_escuro (pisável): o vulto escuro do bicho encolhido e os dois pares de olhos, que brilham (para a tela).
  - quadro_hoteleiro (~2, ~3, ~4): o mesmo homem, o mesmo sorriso, em quatro idades (o jovem, o do bigode, o grisalho
    de barba, o velho de barba branca), na moldura dourada.
"""
import math

import numpy as np

import cozinha as CZ
import base_estilo as BE
import medieval as MD
import parede_casa as PC
import vila_natureza as VN
import vila_predios as VP
from base_estilo import hx, liso, mad2, tab2, vol, _tom, _pau, _p1_malha, _poligono_rodado, _disco, PH, PZ
from motor import emissivo, ruido, KX, KZ

M = BE.M
CASA = 0.75
cx, novo, peg, fp, luz_obj, pau = MD.cx, MD.novo, MD.peg, MD.fp, MD.luz_obj, MD.pau
CARV, CARV_E, CARV_T, CARV_TJ = MD.CARV, MD.CARV_E, MD.CARV_T, MD.CARV_TJ


def C():
    return CZ.c


def almofadas(cor, a0, a1, z0, z1, n, eixo='x', seed=0):
    """
    A frente de almofadas (o balcão, o gaveteiro): n almofadas lado a lado entre a0 e a1 (ao longo de x, ou de y), de z0
    a z1; o quadro em volta, a almofada rebaixada com a luz em cima e à esquerda e a sombra embaixo e à direita.
    """
    c0 = hx(cor)
    larg = (a1 - a0) / n

    def f(L, n_, P):
        out = np.tile(c0, (len(P), 1))
        if abs(n_[2]) > 0.5:
            return np.tile(_tom(c0, 1.15), (len(P), 1))
        a = P[:, 0] if eixo == 'x' else P[:, 1]
        z = P[:, 2]
        g = (a - a0) - np.floor((a - a0) / larg) * larg
        m = 0.06
        dentro = (g > m) & (g < larg - m) & (z > z0 + m) & (z < z1 - m)
        out = np.where(dentro[:, None], _tom(c0, 0.9), out)
        out = np.where((dentro & (z > z1 - m - 2 * PZ))[:, None], _tom(c0, 0.74), out)
        out = np.where((dentro & (z < z0 + m + PZ))[:, None], _tom(c0, 1.12), out)
        out = np.where((dentro & (g < m + PH))[:, None], _tom(c0, 0.8), out)
        out = np.where((dentro & (g > larg - m - PH))[:, None], _tom(c0, 1.08), out)
        # o veio na almofada (riscas compridas de 1 px)
        vv = dentro & (np.floor(z / (4 * PZ)) % 3 == 0) & (ruido(np.floor(z / (4 * PZ)), np.floor(a / 0.2), seed) > 0.6)
        return np.where(vv[:, None], _tom(c0, 0.84), out)
    return emissivo(f)


# =====================================================================================================================
# o balcão do hotel (4 x 1, 1,05 m)
# =====================================================================================================================
def _livro_aberto(x, y, z, larg=0.36, prof=0.24):
    """O livro dos hóspedes aberto: a capa de couro, as duas páginas em leque com as linhas escritas e a fita."""
    cx((x - larg / 2 - 0.01, x + larg / 2 + 0.01, y - prof / 2 - 0.01, y + prof / 2 + 0.01, z, z + 0.012), {'*': liso('#4a2418'), 'cima': liso('#5a2c1c')})

    def pag(L, n, P):
        out = np.tile(hx('#e8dcc0'), (len(P), 1))
        if n[2] > 0.5:
            lin = (np.floor((P[:, 1] - (y - prof / 2)) / (2 * PH)) % 2 == 0) & (np.abs(P[:, 0] - x) > 0.03)
            lin &= (np.abs(P[:, 0] - x) < larg / 2 - 0.03) & (ruido(np.floor(P[:, 1] / (2 * PH)), np.floor(P[:, 0] / 0.05), 3.0) > 0.25)
            out = np.where(lin[:, None], hx('#8a7a64'), out)
        return out
    for s in (-1, 1):
        x0, x1 = (x - larg / 2, x - 0.004) if s < 0 else (x + 0.004, x + larg / 2)
        cx((x0, x1, y - prof / 2, y + prof / 2, z + 0.012, z + 0.032), {'*': emissivo(pag), 'frente': liso('#d8ccb0')}, o=novo())
    cx((x - 0.006, x + 0.006, y + prof / 2 - 0.01, y + prof / 2 + 0.05, z + 0.03, z + 0.034), liso('#8a1a14'))
    CZ.itens_peq.append((x - larg / 2, x + larg / 2, y - prof / 2, y + prof / 2, z))


def _tinteiro(x, y, z):
    o = novo()
    C().cilindro(x, y, 0.03, z, z + 0.045, vol(x, y, '#1e1a22', brilho=0.5), M, o, lados=10, tampa_mat=liso('#0e0c10'))
    # a pena: o cálamo inclinado e a pluma branca
    pau((x, y, z + 0.04), (x + 0.04, y - 0.03, z + 0.2), 0.008, liso('#c8b890'))
    of = novo()
    BE._fita([(0.0, z + 0.1), (0.018, z + 0.15), (0.02, z + 0.21), (0.0, z + 0.23), (-0.01, z + 0.16)], x + 0.025, y - 0.02, liso('#f0ece0'), of, 0.02)
    CZ.itens_peq.append((x - 0.03, x + 0.03, y - 0.03, y + 0.03, z))


def _sineta(x, y, z):
    o = novo()
    _poligono_rodado(x, y, [(z, 0.045), (z + 0.01, 0.045), (z + 0.035, 0.034), (z + 0.055, 0.02), (z + 0.06, 0.008)],
                     vol(x, y, '#b8902a', brilho=0.6), o, lados=12)
    C().cilindro(x, y, 0.006, z + 0.06, z + 0.08, liso('#8a6a1a'), M, novo(), lados=6)
    CZ.itens_peq.append((x - 0.045, x + 0.045, y - 0.045, y + 0.045, z))


def _balcao_hotel():
    x0, x1 = 0.0, 3.0
    y0, y1 = 0.1, 0.6
    h, tp = 1.05, 0.07
    cx((x0 + 0.02, x1 - 0.02, y0 + 0.03, y1 - 0.03, 0.0, 0.1), mad2('#2a180c', seed=301, passo=0.04))
    FR = almofadas('#5a3a24', x0, x1, 0.1, h - tp - 0.06, 5, seed=302)
    cx((x0, x1, y0, y1, 0.1, h - tp - 0.06), {'frente': FR, 'costas': mad2('#4a2e1c', seed=303, passo=0.05), '*': mad2('#4e3020', eixo=1, seed=304, passo=0.05)})
    # a faixa de cima (o friso) e o tampo de carvalho saindo para a frente
    cx((x0, x1, y0 - 0.01, y1 + 0.02, h - tp - 0.06, h - tp), _pau('#3e2416', '#5a3a24', quina=1.2, b=(0, 0, 0, 0, 0, h - tp)))
    cx((x0, x1, 0.04, 0.7, h - tp, h), {'cima': tab2(['#6a4428', '#644026', '#70482a'], 0.22, '#24140a', eixo=0, seed=305, comp=1.5, org=0.04),
                                        '*': _pau('#4a2c1a', quina=1.25, b=(0, 0, 0, 0, h - tp, h))})
    # em cima: o livro dos hóspedes, o tinteiro com a pena, a sineta
    _livro_aberto(1.3, 0.4, h)
    _tinteiro(1.68, 0.3, h)
    _sineta(2.35, 0.48, h)
    # atrás (o lado do Hoteleiro): a prateleira com as caixinhas e um castiçal
    zp = 0.6
    cx((x0 + 0.05, x1 - 0.05, 0.02, y0, zp - 0.04, zp), _pau('#4a2c1a', quina=1.2, b=(0, 0, 0, 0, zp - 0.04, zp)))
    for (xx, cor) in ((0.4, '#6a2a22'), (0.62, '#2a4a3a'), (2.1, '#4a3a6a')):
        cx((xx, xx + 0.16, 0.025, 0.095, zp, zp + 0.1), {'*': liso(cor), 'cima': liso(_hex(_tom(hx(cor), 1.2)))})
    peg(x0, x1, 0.04, 0.7)


def _hex(c):
    c = np.clip(np.round(np.asarray(c, float)), 0, 255).astype(int)
    return '#%02x%02x%02x' % tuple(c)


# =====================================================================================================================
# a maca do Doutor (1 x 3, 0,7 m)
# =====================================================================================================================
def _maca():
    x0, x1, y0, y1 = 0.08, 0.67, 0.06, 2.18
    p = 0.06
    PE = {'*': mad2(CARV, eixo=1, seed=311, passo=0.04), 'cima': liso('#7a5232')}
    for (xx, yy) in ((x0, y0), (x1 - p, y0), (x0, y1 - p), (x1 - p, y1 - p)):
        cx((xx, xx + p, yy, yy + p, 0.0, 0.58), PE, ch=0.01)
    # as travessas embaixo (perto do chão, para os pés) e a moldura do estrado
    for (yy) in (y0 + 0.01, y1 - 0.05):
        cx((x0 + p, x1 - p, yy, yy + 0.04, 0.12, 0.17), mad2(CARV_E, seed=312, passo=0.04))
    for xx in (x0, x1 - 0.05):
        cx((xx, xx + 0.05, y0 + p, y1 - p, 0.46, 0.58), {'*': mad2(CARV, eixo=0, seed=313, passo=0.04), 'cima': liso('#7a5232')})
    cx((x0 + p, x1 - p, y0, y0 + 0.05, 0.46, 0.58), mad2(CARV, seed=314))
    cx((x0 + p, x1 - p, y1 - 0.05, y1, 0.46, 0.58), mad2(CARV, seed=314))
    # o colchão fino de linho, o lençol dobrado no pé e o rolo de couro na cabeceira
    _p1_malha((x0 + 0.02, x1 - 0.02, y0 + 0.03, y1 - 0.03, 0.56, 0.66), (0.04, 0.04, 0.015, 0.035),
              emissivo(lambda L, n, P: np.tile(hx('#e2dac6'), (len(P), 1))), seg=2)
    _p1_malha((x0 + 0.03, x1 - 0.03, y1 - 0.42, y1 - 0.08, 0.64, 0.7), (0.03, 0.03, 0.015, 0.02), MD.manta('#6a7a5a'), seg=2)
    _p1_malha((x0 + 0.06, x1 - 0.06, y0 + 0.06, y0 + 0.24, 0.64, 0.76), (0.05, 0.08, 0.04, 0.05),
              emissivo(lambda L, n, P: np.tile(hx('#7a4a2a'), (len(P), 1))), seg=2)
    peg(x0, x1, y0, y1)


# =====================================================================================================================
# o armário de botica (2 x 1, 1,9 m)
# =====================================================================================================================
VIDROS = [('#4a7a4a', '#7ab87a'), ('#8a5a2a', '#c89048'), ('#3a5a8a', '#6a9ad0'), ('#7a2a2a', '#b85a4a'), ('#d8d0b8', '#f0ead8')]


def _frasco(x, y, z, h, r, k, rolha=True):
    vc, vb = VIDROS[k % len(VIDROS)]

    def faixa(P, b):
        zz = P[:, 2] - z
        b = np.where((zz < h * 0.62)[:, None], hx(vc), b)
        return np.where(((zz > h * 0.3) & (zz < h * 0.42))[:, None], hx('#e8dcc0'), b)
    o = novo()
    _poligono_rodado(x, y, [(z, r), (z + h * 0.7, r), (z + h * 0.82, r * 0.5), (z + h * 0.92, r * 0.45)], vol(x, y, vb, brilho=0.7, faixas=faixa), o, lados=10)
    if rolha:
        C().cilindro(x, y, r * 0.5, z + h * 0.9, z + h, liso('#a8783a'), M, novo(), lados=8, tampa_mat=liso('#c89a5a'))
    CZ.itens_peq.append((x - r, x + r, y - r, y + r, z))


def _pote(x, y, z, h, r, cor):
    o = novo()
    C().cilindro(x, y, r, z, z + h, vol(x, y, cor, brilho=0.3), M, o, lados=12, tampa_mat=liso('#d8ccb0'))
    C().cilindro(x, y, r * 1.06, z + h, z + h + 0.015, liso('#c8b898'), M, novo(), lados=12)


def _armario(aberto=False, vazio=False):
    def d():
        x0, x1, y0, y1 = 0.05, 1.45, 0.12, 0.6
        # o corpo de baixo: as gavetinhas (3 fileiras de 4) com os puxadores de latão
        GAV = almofadas('#5e3c22', x0 + 0.04, x1 - 0.04, 0.08, 0.9, 4, seed=321)
        cx((x0, x1, y0, y1, 0.0, 0.92), {'frente': GAV, '*': mad2('#4e3020', eixo=1, seed=322, passo=0.05), 'cima': liso('#6a4428')})
        cx((x0 + 0.02, x1 - 0.02, y1, y1 + 0.01, 0.0, 0.08), liso('#2e1c10'))
        larg = (x1 - x0 - 0.08) / 4
        puxadas = (1, 2) if aberto else ()
        for fila, zf in enumerate((0.2, 0.47, 0.74)):
            for k in range(4):
                xa = x0 + 0.04 + k * larg
                if fila == 1 and k in puxadas:
                    # a gaveta puxada: a caixa saindo para a frente, com as ervas dentro (ou vazia)
                    cx((xa + 0.03, xa + larg - 0.03, y1, y1 + 0.2, zf - 0.09, zf + 0.09), {'*': mad2('#6a4428', seed=323 + k, passo=0.04), 'cima': liso('#3a2414')})
                    if not vazio:
                        _p1_malha((xa + 0.05, xa + larg - 0.05, y1 + 0.03, y1 + 0.18, zf, zf + 0.1), (0.02, 0.02, 0.02, 0.03),
                                  emissivo(lambda L, n, P: np.tile(hx('#7a8a4a' if k == 1 else '#8a6a3a'), (len(P), 1))), seg=2)
                    yk = y1 + 0.2
                else:
                    yk = y1
                xm = xa + larg / 2
                cx((xm - 0.02, xm + 0.02, yk, yk + 0.02, zf - 0.015, zf + 0.015), {'*': liso('#b8902a'), 'cima': liso('#e0c060')})
        # o balcãozinho entre os dois corpos e o corpo de cima (o armário de vidro), mais raso
        cx((x0 - 0.02, x1 + 0.02, y0 - 0.01, y1 + 0.04, 0.92, 0.96), _pau('#4a2c1a', '#6e4a2c', quina=1.2, b=(0, 0, 0, 0, 0, 0.96)))
        ya, yb = 0.16, 0.5
        zc0, zc1 = 0.96, 1.8
        cx((x0, x1, ya, ya + 0.03, zc0, zc1), mad2('#3a2416', seed=324, passo=0.05))
        for xx in (x0, x1 - 0.04):
            cx((xx, xx + 0.04, ya, yb, zc0, zc1), {'*': mad2('#5a3a22', eixo=1, seed=325, passo=0.05), 'cima': liso('#6a4428')})
        for zs in (1.24, 1.52):
            cx((x0 + 0.04, x1 - 0.04, ya + 0.03, yb, zs - 0.025, zs), _pau('#5e3c22', '#7a5232', quina=1.2, b=(0, 0, 0, 0, 0, zs)))
        cx((x0 + 0.04, x1 - 0.04, ya + 0.03, yb, zc0, zc0 + 0.02), liso('#4a2e1c'))
        # a cornija
        cx((x0 - 0.03, x1 + 0.03, ya - 0.02, yb + 0.05, zc1, 1.86), _pau('#4a2c1a', '#6e4a2c', quina=1.2, b=(0, 0, 0, 0, 0, 1.86)))
        cx((x0 - 0.05, x1 + 0.05, ya - 0.03, yb + 0.07, 1.86, 1.9), _pau('#5a3420', '#7a5232', quina=1.25, b=(0, 0, 0, 0, 0, 1.9)))
        # o que está nas prateleiras: os potes de barro, os frascos de cor, as ervas penduradas, o cristal verde
        if not vazio:
            k = 0
            for (zs, itens) in ((zc0 + 0.02, (0.16, 0.34, 0.55, 0.78, 1.0, 1.22)), (1.24, (0.2, 0.42, 0.66, 0.9, 1.15)), (1.52, (0.18, 0.4, 0.62, 0.86, 1.1, 1.28))):
                for xx in itens:
                    if k % 3 == 0:
                        _pote(x0 + xx, 0.32, zs, 0.13, 0.05, ['#8a5a3a', '#6a4a3a', '#a8784a'][k % 3])
                    else:
                        _frasco(x0 + xx, 0.32, zs, 0.16 + 0.04 * (k % 2), 0.035, k)
                    k += 1
            VN.cristal(luz_obj(), (x0 + 1.26, 0.3, 1.25), (0.1, 0.1, 1.0), 0.03, 0.12, 0.05, VN.CRISTAL['verde'][0], True, seed=7)
        # as portinholas de vidro (quatro): fechadas no plano da frente; abertas, giradas para a frente
        PT = {'*': mad2('#5a3a22', eixo=1, seed=326, passo=0.04), 'cima': liso('#6a4428')}
        lw = (x1 - x0 - 0.08) / 4
        for k in range(4):
            xa = x0 + 0.04 + k * lw
            hinge = xa if k % 2 == 0 else xa + lw
            if not aberto:
                for (b) in ((xa, xa + 0.035, yb, yb + 0.025, zc0 + 0.03, zc1 - 0.03), (xa + lw - 0.035, xa + lw, yb, yb + 0.025, zc0 + 0.03, zc1 - 0.03),
                            (xa, xa + lw, yb, yb + 0.025, zc0 + 0.03, zc0 + 0.07), (xa, xa + lw, yb, yb + 0.025, zc1 - 0.07, zc1 - 0.03),
                            (xa, xa + lw, yb, yb + 0.025, 1.36, 1.39)):
                    cx(b, PT)
                CZ.vidros.append((xa + 0.035, xa + lw - 0.035, yb - 0.01, yb + 0.03, zc0 + 0.07, zc1 - 0.07))
                if k in (1, 2):
                    xm = xa + (lw - 0.04 if k == 1 else 0.04)
                    cx((xm - 0.012, xm + 0.012, yb + 0.025, yb + 0.04, 1.3, 1.34), liso('#b8902a'))
            else:
                s = 1 if k % 2 == 0 else -1
                xh = hinge + (0.0 if s > 0 else -0.03)
                for b in ((xh, xh + 0.03, yb, yb + lw * 0.92, zc0 + 0.03, zc0 + 0.07), (xh, xh + 0.03, yb, yb + lw * 0.92, zc1 - 0.07, zc1 - 0.03),
                          (xh, xh + 0.03, yb, yb + 0.035, zc0 + 0.03, zc1 - 0.03), (xh, xh + 0.03, yb + lw * 0.92 - 0.035, yb + lw * 0.92, zc0 + 0.03, zc1 - 0.03)):
                    cx(b, PT)
        peg(x0, x1, y0, y1)
    return d


# =====================================================================================================================
# a mesa do Doutor (2 x 1, 0,8 m) e os frascos
# =====================================================================================================================
def _mesa_doutor():
    x0, x1, y0, y1 = 0.03, 1.47, 0.08, 0.68
    h, tp = 0.8, 0.05

    def couro(L, n, P):
        out = np.tile(hx('#5a3a24'), (len(P), 1))
        if n[2] > 0.5:
            dentro = (P[:, 0] > x0 + 0.08) & (P[:, 0] < x1 - 0.08) & (P[:, 1] > y0 + 0.07) & (P[:, 1] < y1 - 0.07)
            out = np.where(dentro[:, None], hx('#3e5a3a'), out)
            borda = dentro & ((P[:, 0] < x0 + 0.08 + PH) | (P[:, 1] < y0 + 0.07 + PH))
            out = np.where(borda[:, None], hx('#2a3e28'), out)
            fio = dentro & ((np.abs(P[:, 0] - (x0 + 0.1)) < PH * 0.5) | (np.abs(P[:, 0] - (x1 - 0.1)) < PH * 0.5))
            out = np.where(fio[:, None], hx('#b8902a'), out)
            gasto = dentro & (ruido(np.floor(P[:, 0] / (3 * PH)), np.floor(P[:, 1] / (2 * PH)), 5.0) > 0.86)
            out = np.where(gasto[:, None], hx('#4a6a46'), out)
        return out
    cx((x0, x1, y0, y1, h - tp, h), {'cima': emissivo(couro), '*': _pau('#4a2c1a', quina=1.22, b=(0, 0, 0, 0, h - tp, h))})
    # os dois gaveteiros (as gavetas para +y, o lado da cadeira) e o vão do meio
    for (a0, a1) in ((x0 + 0.03, x0 + 0.45), (x1 - 0.45, x1 - 0.03)):
        GV = almofadas('#5e3c22', a0, a1, 0.06, h - tp, 1, seed=331)
        cx((a0, a1, y0 + 0.03, y1 - 0.02, 0.04, h - tp), {'frente': GV, '*': mad2('#4e3020', eixo=1, seed=332, passo=0.05)})
        for z in (0.2, 0.42, 0.62):
            cx((a0 + 0.04, a1 - 0.04, y1 - 0.02, y1 - 0.01, z - 0.005, z), liso('#2e1c10'))
            xm = (a0 + a1) / 2
            cx((xm - 0.025, xm + 0.025, y1 - 0.01, y1 + 0.01, z + 0.06, z + 0.08), {'*': liso('#b8902a'), 'cima': liso('#e0c060')})
        cx((a0, a1, y0 + 0.03, y1 - 0.02, 0.0, 0.04), liso('#2a180c'))
    # o painel do fundo (entre os gaveteiros) e a gaveta fina do meio, embaixo do tampo
    cx((x0 + 0.45, x1 - 0.45, y0 + 0.03, y0 + 0.06, 0.2, h - tp), mad2('#4a2e1c', seed=333, passo=0.05))
    cx((x0 + 0.45, x1 - 0.45, y0 + 0.06, y1 - 0.02, h - tp - 0.09, h - tp), {'frente': almofadas('#5e3c22', x0 + 0.45, x1 - 0.45, h - tp - 0.09, h - tp, 1, seed=334),
                                                                              '*': mad2('#4e3020', seed=335, passo=0.05)})
    peg(x0, x1, y0, y1)


def _frascos():
    """Os frascos de remédio (1 x 1, 0,28 m), para pôr em cima da mesa: os vidrinhos, o pilão de pedra e o maço de ervas."""
    for (x, y, h, r, k) in ((0.2, 0.25, 0.2, 0.04, 0), (0.31, 0.2, 0.26, 0.045, 2), (0.27, 0.35, 0.16, 0.035, 3), (0.42, 0.28, 0.22, 0.04, 1)):
        _frasco(x, y, 0.0, h, r, k)
    # o pilão de pedra com a mão de pilão
    o = novo()
    _poligono_rodado(0.52, 0.5, [(0.0, 0.05), (0.03, 0.065), (0.08, 0.075), (0.09, 0.07)], vol(0.52, 0.5, '#8a8478', brilho=0.2), o, lados=12)
    _disco(0.52, 0.5, 0.09, 0.06, liso('#3a3630'), o, lados=12)
    pau((0.5, 0.5, 0.05), (0.58, 0.44, 0.18), 0.022, liso('#a8a094'))
    # o maço de ervas secas amarrado
    for k in range(5):
        pau((0.2 + 0.015 * k, 0.52, 0.01), (0.34 + 0.02 * k, 0.6 - 0.01 * k, 0.03), 0.014, liso(['#7a8a4a', '#6a7a3a', '#8a9a5a'][k % 3]), o=novo(contorno=False))
    cx((0.26, 0.3, 0.53, 0.6, 0.005, 0.04), liso('#a87a4a'))
    CZ.itens_peq.append((0.15, 0.6, 0.15, 0.6, 0.0))


# =====================================================================================================================
# os olhos no escuro (os bichos escondidos), a lenha, a cesta de pão, a jarra com as canecas
# =====================================================================================================================
def _olhos():
    """O vulto do bicho encolhido (quase preto, sem contorno forte) e os dois pares de olhos amarelos (para a tela)."""
    ob = novo()
    C().elipsoide(np.array([0.36, 0.34, 0.0]), np.array([0.2, 0.17, 0.3]), lambda Pc, N, P: np.tile(hx('#2e241c'), (len(P), 1)), ob, corte_z=0.0)
    C().elipsoide(np.array([0.5, 0.5, 0.0]), np.array([0.12, 0.11, 0.18]), lambda Pc, N, P: np.tile(hx('#28201a'), (len(P), 1)), ob, corte_z=0.0)
    hv, rv = BE.frente_tela()
    oe = luz_obj()
    for (x, y, z, sep, ka) in ((0.36, 0.34, 0.42, 0.045, 0.22), (0.5, 0.5, 0.24, 0.032, 0.14)):
        # os olhos ficam na frente do vulto (para a câmera), um de cada lado
        px, py = x + hv[0] * ka, y + hv[1] * ka
        for s in (-1, 1):
            ex, ey = px + s * sep * rv[0], py + s * sep * rv[1]
            P4 = [(ex, ey, z), (ex + 0.02 * rv[0], ey + 0.02 * rv[1], z), (ex + 0.02 * rv[0], ey + 0.02 * rv[1], z + 0.016), (ex, ey, z + 0.016)]
            fp(P4, (hv[0], hv[1], 0), liso('#f0e04a'), oe, dois=True)
    VP.pegada_redonda(0.4, 0.4, 0.3, 8)


def _lenha():
    """A lenha empilhada (1 x 1, 0,5 m): as achas deitadas em três camadas cruzadas e a machadinha cravada em cima."""
    k = 0
    for (z, eixo, n) in ((0.0, 'x', 3), (0.13, 'y', 3), (0.26, 'x', 3), (0.39, 'y', 2)):
        for i in range(n):
            r = 0.06
            s = 0.15 + i * 0.16 + (0.08 if n == 2 else 0.0)
            if eixo == 'x':
                VP._tora_x(0.1, 0.65, s + 0.06, z + r, r, lados=8, seed=k)
            else:
                pts = [(s + 0.06 + r * math.cos(2 * math.pi * j / 8), z + r + r * math.sin(2 * math.pi * j / 8)) for j in range(8)]
                MD.placa_xz(pts, 0.1, 0.65, VP._redondo(VP.mat_casca('x', 0.375, z + r, r, k), VP._n_tora_x(0.375, z + r)) if False else
                            mad2('#6a4a2c', eixo=1, seed=k, passo=0.04), mat_borda=liso('#5a3e26'))
            k += 1
    # a machadinha: o cabo inclinado e a cabeça de ferro cravada na acha de cima
    pau((0.3, 0.42, 0.52), (0.52, 0.5, 0.78), 0.025, liso('#8a6a42'))
    cx((0.24, 0.34, 0.4, 0.44, 0.47, 0.56), MD.ferro())
    peg(0.08, 0.67, 0.08, 0.67)


def _cesta_pao():
    """A cesta de pão (1 x 1, 0,2 m), para a mesa: o vime trançado, os pães redondos e o pano de linho por cima."""
    xc, yc = 0.375, 0.375

    def vime(P, b):
        th = np.arctan2(P[:, 1] - yc, P[:, 0] - xc)
        k = (np.floor(th / (2 * math.pi) * 24) + np.floor(P[:, 2] / (2 * PZ))) % 2
        return np.where((k == 0)[:, None], _tom(b, 0.82), b)
    o = novo()
    _poligono_rodado(xc, yc, [(0.0, 0.15), (0.03, 0.17), (0.1, 0.2), (0.11, 0.205)], vol(xc, yc, '#a8783a', faixas=vime), o, lados=16)
    _disco(xc, yc, 0.095, 0.19, liso('#5a3a1c'), o, lados=16)
    op = novo()
    for (x, y) in ((xc - 0.07, yc - 0.03), (xc + 0.06, yc - 0.05), (xc, yc + 0.07)):
        C().elipsoide(np.array([x, y, 0.1]), np.array([0.075, 0.07, 0.06]), lambda Pc, N, P: np.tile(hx('#c88a48'), (len(P), 1)), op)
    _p1_malha((xc - 0.02, xc + 0.18, yc - 0.12, yc + 0.08, 0.1, 0.15), (0.03, 0.03, 0.02, 0.02),
              emissivo(lambda L, n, P: np.tile(hx('#e8e0cc'), (len(P), 1))), seg=2)
    CZ.itens_peq.append((xc - 0.2, xc + 0.2, yc - 0.2, yc + 0.2, 0.0))


def _jarra_canecas():
    """A jarra de estanho e duas canecas (1 x 1, 0,3 m), para a mesa e o balcão: uma em pé, a outra emborcada."""
    MD.jarra(0.32, 0.3, 0.0)
    MD.caneca(0.52, 0.42, 0.0)
    MD.caneca(0.24, 0.52, 0.0, emborcada=True)


# =====================================================================================================================
# os itens de parede: os retratos dos Hoteleiros e o quadro das chaves
# =====================================================================================================================
RETRATO = [
    "hhhhhh",
    "hhhhhhhhhh",
    "hhhhhhhhhhhh",
    "hhsssssssshh",
    "hssssssssssh",
    "sseesssseess",
    "ssssssssssss",
    "sssssSSsssss",
    "ssbbbbbbbbss",
    "smttttttttms",
    "ssmmmmmmmmss",
    "BSssssssSB",
    "BBSSSSBB",
    "ccwwwwwwcc",
    "cccCwwwwwwCccc",
    "cccccCwwwwCccccc",
    "ccccccCwwCcccccc",
    "cccccccCCccccccc",
    "cccccccccccccccc",
    "cccccccccccccccc",
    "cccccccccccccccc",
]
# os quatro Hoteleiros: (cabelo, pele, casaco, fundo, bigode?, barba?, careca?)
HOTELEIROS = {
    1: ('#2a1a12', '#e8c8a0', '#2e3a5a', '#3a4a2a', False, False, False),
    2: ('#6a4428', '#e0bc94', '#5a2420', '#2a2a3a', True, False, False),
    3: ('#8a8680', '#d8b48c', '#2a3a2a', '#4a3020', True, True, False),
    4: ('#e8e4dc', '#d0aa84', '#3a2a3a', '#1e2a3a', True, True, True),
}


def _pintor_hoteleiro(n):
    cabelo, pele, casaco, fundo, bigode, barba, careca = HOTELEIROS[n]

    def p(pl, W, H):
        t = pl.dentro
        pl.pin(t, fundo)
        pl.pin(t & (np.hypot((pl.u - W / 2) / W, (pl.w - H * 0.45) / H) > 0.42), _hex(_tom(hx(fundo), 0.72)))
        pl.pin(t & (pl.w < H * 0.25) & (np.hypot((pl.u - W / 2) / W, (pl.w - H * 0.45) / H) < 0.3), _hex(_tom(hx(fundo), 1.15)))
        sh = _hex(_tom(hx(pele), 0.8))
        pal = {'h': cabelo, 's': pele, 'S': sh, 'e': '#1a1410', 'm': '#6a1a14', 't': '#f4ecdc', 'c': casaco,
               'C': _hex(_tom(hx(casaco), 1.3)), 'w': '#ece4d0',
               'b': cabelo if bigode else pele, 'B': cabelo if barba else fundo}
        linhas = list(RETRATO)
        if careca:
            linhas[0] = "ssssss"
            linhas[1] = "hsssssssssh"[:10]
        if barba:
            linhas[11] = "BBBBBBBBBB"
            linhas[12] = "BBBBBBBB"
        w0 = int(H * 0.12)
        for v, ln in enumerate(linhas):
            u0 = int(round(W / 2 - len(ln) / 2))
            PC._spr(pl, u0, w0 + v, [ln], {k: c for k, c in pal.items() if k != 'B' or barba})
    return p


def quadro_hoteleiro(n=1, xc=1.5, zc=1.6):
    PC.quadro(xc - 0.4, xc + 0.4, zc - 0.42, zc + 0.42, _pintor_hoteleiro(n), PC.MOL_DOURADA)


def quadro_chaves(xc=1.5, zc=1.6):
    """
    O quadro das chaves (48 x 34 px): a tábua com o telhadinho de moldura, as duas fileiras de ganchos com as chaves de
    ferro e as plaquetas do número; o gancho do terceiro quarto vazio (a chave nunca está lá).
    """
    n0 = len(C().objs)
    a, h = 0.54, 0.3
    tab = cx((xc - a, xc + a, 0.0, 0.03, zc - h, zc + h - 0.05), {'*': tab2(['#6a4428', '#644026', '#70482a'], 0.12, '#2a1810', eixo=0, seed=341)})
    cx((xc - a - 0.03, xc + a + 0.03, 0.0, 0.06, zc + h - 0.05, zc + h), _pau('#4a2c1a', '#7a5232', quina=1.25, b=(0, 0, 0, 0, 0, zc + h)))
    pl = PC.Pl(xc - a + 0.03, xc + a - 0.03, zc - h + 0.02, zc + h - 0.08, 0.04)
    Wp, Hp = pl.W, (2 * h - 0.1) * KZ
    ganchos = []
    for fila, w0 in enumerate((3, Hp / 2 + 2)):
        for k in range(4):
            u = 4 + k * (Wp - 8) / 3.4
            ganchos.append((u, w0))
            if fila == 0 and k == 2:
                # o gancho vazio, só a plaqueta do número
                pl.pin(pl.ret(u - 2, w0 + 7, u + 3, w0 + 10), '#e8dcc0')
                pl.pin(pl.ret(u, w0 + 8, u + 1, w0 + 9), '#3a2a1a')
                continue
            anel = pl.elipse(u + 0.5, w0 + 2.5, 2.0, 2.0) & ~pl.elipse(u + 0.5, w0 + 2.5, 0.9, 0.9)
            haste = pl.ret(u, w0 + 4, u + 1.2, w0 + 11)
            pal = pl.ret(u + 1, w0 + 8, u + 3, w0 + 9) | pl.ret(u + 1, w0 + 10, u + 2.5, w0 + 11)
            pl.pin(anel | haste | pal, '#4a4644')
            pl.pin(anel & (pl.u < u + 0.5), '#8a8680')
            pl.pin(pl.ret(u - 3.5, w0 + 5, u - 0.5, w0 + 8), '#e8dcc0')
            pl.pin(pl.ret(u - 2.5, w0 + 6, u - 1.5, w0 + 7), '#3a2a1a')
    pl.contorno_fora(pl.opaco())
    pl.grava()
    for (u, w0) in ganchos:
        x = xc - a + 0.03 + (u + 0.5) / KX
        z = zc + h - 0.08 - (w0 + 1) / KZ
        cx((x - 0.01, x + 0.01, 0.03, 0.06, z - 0.01, z + 0.01), liso('#2e2a28'))
    PC.sombra_parede(n0, 1, 2, sobre=(tab,))


# =====================================================================================================================
ITENS = {
    'balcao_hotel': (4, 1, (0.0, 0.0), _balcao_hotel, {}),
    'maca_doutor': (1, 3, (0.0, 0.0), _maca, {}),
    'armario_boticario': (2, 1, (0.0, 0.0), _armario(False), {'1': _armario(True)}),
    'armario_boticario!vazio': (2, 1, (0.0, 0.0), _armario(False), {'1': _armario(True, True)}),
    'mesa_doutor': (2, 1, (0.0, 0.0), _mesa_doutor, {}),
    'frascos_boticario': (1, 1, (0.0, 0.0), _frascos, {}),
    'olhos_escuro': (1, 1, (0.0, 0.0), _olhos, {}),
    'lenha': (1, 1, (0.0, 0.0), _lenha, {}),
    'cesta_pao': (1, 1, (0.0, 0.0), _cesta_pao, {}),
    'jarra_canecas': (1, 1, (0.0, 0.0), _jarra_canecas, {}),
}

ITENS_PAREDE = {
    'quadro_hoteleiro': (lambda: quadro_hoteleiro(1), (1.5, 1.6)),
    'quadro_hoteleiro~2': (lambda: quadro_hoteleiro(2), (1.5, 1.6)),
    'quadro_hoteleiro~3': (lambda: quadro_hoteleiro(3), (1.5, 1.6)),
    'quadro_hoteleiro~4': (lambda: quadro_hoteleiro(4), (1.5, 1.6)),
    'quadro_chaves': (lambda: quadro_chaves(1.5, 1.6), (1.5, 1.6)),
}
