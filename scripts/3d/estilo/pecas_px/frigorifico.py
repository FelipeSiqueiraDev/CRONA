"""
GRUPO "frigorifico": o porco pendurado do Frigorífico Albuquerque (Área Gelada e Salão de Abate), em pixel art 1:1
desenhada por código, no estilo das outras peças.

Tudo no giro 4 (a frente para +y), a pegada de 1 x 1 casa começando em (0, 0). O exportador gira e faz o acabamento.

- porco_pendurado (1 x 1, ~2,75 m com o trilho): o trilho de teto (barra de aço ao longo de y, atravessando a casa
  inteira, com os dois tirantes que sobem), o carretel (a rodinha no trilho), a correntinha, o balancim (a barra com
  que o açougueiro prende as patas de trás) e a carcaça de porco pendurada pelas patas traseiras, de cabeça para
  baixo: os pernis (presunto) rosados no alto, o tronco aberto ao meio mostrando a costela vermelha com a beira de
  gordura branca e a espinha clara, as patas da frente caídas, as orelhas moles, o focinho para baixo com as narinas,
  e o pingo de sangue embaixo. De costas (os giros 0 e 6) o que se vê é o couro rosado.
"""
import math

import numpy as np

import cozinha as CZ
import base_estilo as BE
from base_estilo import hx, liso, PH, PZ
from motor import emissivo
import ocultismo as OC

M = BE.M
CX = CY = 0.375


def _c():
    return CZ.c


def _elip(cen, raios, mat, o=None, brilho=0.0):
    o = OC.novo() if o is None else o
    _c().elipsoide(np.array(cen, float), np.array(raios, float), mat, o, brilho=brilho)
    return o


def _pele(cor, escura=None):
    c0 = hx(cor)
    c1 = hx(escura or cor)

    def f(L, n, P):
        out = np.tile(c0, (len(P), 1))
        # o couro tem um pouco de tom: bandas macias, em degraus largos
        b = (np.floor((P[:, 2] + P[:, 0] * 0.6) / 0.06) % 3 == 0)
        return np.where(b[:, None], c1, out)
    return emissivo(f)


def _tronco(zc, rx, rz):
    """O tronco: o couro por fora e, na frente (+y), o corte aberto: a costela vermelha, a gordura na beira, a espinha."""
    pele = hx('#f7cbc0')
    pele2 = hx('#eab8ac')
    fat = hx('#f6e8de')
    verm = [hx('#a8262a'), hx('#8a1c22'), hx('#6a1218')]
    esp = hx('#efe0d2')

    def f(L, n, P):
        x, y, z = P[:, 0] - CX, P[:, 1] - CY, P[:, 2]
        out = np.tile(pele, (len(P), 1))
        out = np.where((np.floor((z + x * 0.6) / 0.06) % 3 == 0)[:, None], pele2, out)
        frente = y > 0.012
        q = (x / (rx * 0.62)) ** 2 + ((z - zc) / (rz * 0.92)) ** 2
        # a beira de gordura, depois o vermelho
        out = np.where((frente & (q < 1.28))[:, None], fat, out)
        dentro = frente & (q < 0.9)
        costela = (np.floor((z - zc) / 0.058).astype(int) % 2 == 0)
        out = np.where(dentro[:, None], np.where(costela[:, None], verm[0], verm[1]), out)
        # o fundo do corte (a barriga, mais escuro) e a espinha clara no meio
        out = np.where((dentro & (z < zc - rz * 0.55))[:, None], verm[2], out)
        out = np.where((dentro & (np.abs(x) < 0.011))[:, None], esp, out)
        return out
    return emissivo(f)


def porco_pendurado():
    ZR = 2.4          # o trilho
    ZB = 1.98         # o balancim
    aco = {'*': liso('#6c7076'), 'cima': liso('#a4a8ae')}
    ferro = {'*': liso('#3a3634'), 'cima': liso('#5a5652')}
    # o trilho de teto: a barra ao longo de y e os tirantes que sobem
    OC.bloco((CX, 0.375, ZR), (0.04, 0.75, 0.04), aco)
    for yy in (0.06, 0.69):
        OC.bloco((CX, yy, ZR + 0.17), (0.018, 0.018, 0.34), ferro)
    # o carretel: a rodinha no trilho e a trava
    OC.bloco((CX, CY, ZR - 0.045), (0.07, 0.06, 0.05), ferro)
    OC.bloco((CX - 0.045, CY, ZR + 0.0), (0.012, 0.05, 0.05), ferro)
    OC.bloco((CX + 0.045, CY, ZR + 0.0), (0.012, 0.05, 0.05), ferro)
    # a correntinha e o balancim
    OC.corrente((CX, CY, ZR - 0.07), (CX, CY, ZB + 0.02), elos=4)
    OC.bloco((CX, CY, ZB), (0.3, 0.025, 0.025), aco)
    for sx in (-1, 1):
        OC.bloco((CX + sx * 0.15, CY, ZB - 0.03), (0.02, 0.02, 0.05), ferro)
    # as patas de trás (o jarrete) e os pernis
    pele = _pele('#f6c8bc', '#e8b6aa')
    for sx in (-1, 1):
        _elip((CX + sx * 0.12, CY, 1.86), (0.03, 0.03, 0.14), pele)
        _elip((CX + sx * 0.09, CY, 1.6), (0.085, 0.1, 0.19), _pele('#f8cdc2', '#ebbaae'))
    # o tronco aberto ao meio
    zc, rx, rz = 1.18, 0.19, 0.44
    _elip((CX, CY, zc), (rx, 0.13, rz), _tronco(zc, rx, rz))
    # o pescoço, a cabeça de focinho para baixo
    _elip((CX, CY, 0.78), (0.1, 0.095, 0.1), _pele('#f3bfb3', '#e4aea2'))
    _elip((CX, CY, 0.6), (0.115, 0.125, 0.15), _pele('#f5c2b6', '#e6b0a4'))
    # o focinho (mais escuro, com as narinas) e a boca
    focinho = hx('#e8a59e')
    narina = hx('#5a2428')

    def foc(L, n, P):
        out = np.tile(focinho, (len(P), 1))
        x, y, z = P[:, 0] - CX, P[:, 1] - CY, P[:, 2]
        nar = (np.abs(np.abs(x) - 0.018) < 0.011) & (z < 0.5) & (y > 0.04)
        return np.where(nar[:, None], narina, out)
    _elip((CX, CY + 0.06, 0.44), (0.06, 0.07, 0.075), emissivo(foc))
    # as orelhas moles, caídas dos lados
    for sx in (-1, 1):
        _elip((CX + sx * 0.14, CY + 0.01, 0.66), (0.06, 0.025, 0.1), _pele('#e39d98', '#d48d88'))
    # os olhinhos fechados
    for sx in (-1, 1):
        _elip((CX + sx * 0.06, CY + 0.085, 0.64), (0.012, 0.01, 0.01), liso('#3a2024'))
    # as patas da frente, caídas, e os casquinhos
    for sx in (-1, 1):
        _elip((CX + sx * 0.15, CY + 0.03, 0.86), (0.032, 0.035, 0.17), _pele('#f4c0b4', '#e5afa3'))
        _elip((CX + sx * 0.15, CY + 0.03, 0.66), (0.026, 0.03, 0.04), liso('#4a3a36'))
    for sx in (-1, 1):
        _elip((CX + sx * 0.12, CY, 1.74), (0.026, 0.028, 0.04), liso('#4a3a36'))
    # o sangue: o pingo embaixo do focinho
    ms = [OC.Mancha(CX + 0.02, CY + 0.06, 0.07, seed=811, amp=0.2, ex=1.2, lobos=(2, 3)),
          OC.Mancha(CX - 0.1, CY + 0.12, 0.035, seed=812, amp=0.18, lobos=(2, 3))]
    ms += OC.gota(CX + 0.1, CY - 0.02, 0.03, seed=813, coroa=2)
    OC.manchas_decal(ms, OC.mat_mancha(ms, ['#3c0a0a', '#5e1210', '#7a1a14'], beira=1.3, miolo=3.5))
    OC.peg(CX - 0.18, CX + 0.18, CY - 0.12, CY + 0.16)



# ------------------------------------------------------------------------------------------------ o açougue ----
ACO = {'*': liso('#9aa2a8'), 'cima': liso('#c8d0d6')}
ACO_E = {'*': liso('#6e757b'), 'cima': liso('#8a9298')}
MAD = {'*': liso('#8a5a34'), 'cima': liso('#b07a48')}
MAD_E = {'*': liso('#6a4224'), 'cima': liso('#8a5a34')}
CARNE = [hx('#a8262a'), hx('#8a1c22'), hx('#6a1218')]
FACA_L = {'*': liso('#c4ccd2'), 'cima': liso('#e8eef2')}
CABO = {'*': liso('#3a2a20'), 'cima': liso('#5a4636')}


def _sangue(ms, z):
    OC.manchas_decal(ms, OC.mat_mancha(ms, ['#3c0a0a', '#5e1210', '#7a1a14'], beira=1.3, miolo=3.5), z=z)


def _meia_carcaca(cx, cy, cz, rx, ry, rz):
    """A meia carcaça deitada de lado (o corte para cima): couro rosado, o corte vermelho com costela e a beira de gordura."""
    pele = hx('#f4c4b8')
    fat = hx('#f8eae0')

    def f(L, n, P):
        x, y, z = (P[:, 0] - cx) / rx, (P[:, 1] - cy) / ry, P[:, 2] - cz
        out = np.tile(pele, (len(P), 1))
        topo = z > 0.012
        q = (x / 0.62) ** 2 + (y / 0.82) ** 2
        out = np.where((topo & (q < 1.25))[:, None], fat, out)
        d = topo & (q < 0.85)
        cost = (np.floor(P[:, 1] / 0.06).astype(int) % 2 == 0)
        out = np.where(d[:, None], np.where(cost[:, None], CARNE[0], CARNE[1]), out)
        out = np.where((d & (np.abs(x) < 0.06))[:, None], hx('#efe0d2'), out)
        return out
    _elip((cx, cy, cz), (rx, ry, rz), emissivo(f))


def _faca(x, y, z, comp=0.3, yaw=0.0):
    OC.bloco((x, y, z), (0.03, comp, 0.008), FACA_L, yaw=yaw)
    OC.bloco((x, y - comp / 2 - 0.05, z + 0.004), (0.03, 0.1, 0.02), CABO, yaw=yaw)


def mesa_corte():
    """A mesa de corte (1 x 3, 0,9 m): tampo grosso e pernas de madeira (1918), a meia carcaça aberta em cima, facas, cutelo, serra, poça."""
    y0, y1 = 0.02, 2.23
    x0, x1 = 0.1, 0.65
    for yy in (y0 + 0.06, y1 - 0.06):
        for xx in (x0 + 0.04, x1 - 0.04):
            OC.caixa((xx - 0.025, xx + 0.025, yy - 0.025, yy + 0.025, 0.0, 0.84), MAD_E)
    OC.caixa((x0 + 0.03, x1 - 0.03, y0 + 0.04, y1 - 0.04, 0.2, 0.235), MAD_E)
    OC.caixa((x0, x1, y0, y1, 0.84, 0.9), MAD)
    OC.caixa((x0 - 0.01, x0 + 0.01, y0, y1, 0.9, 0.925), MAD)
    OC.caixa((x1 - 0.01, x1 + 0.01, y0, y1, 0.9, 0.925), MAD)
    _meia_carcaca(CX - 0.02, 1.0, 0.99, 0.2, 0.62, 0.075)
    _elip((CX - 0.02, 1.72, 0.97), (0.1, 0.12, 0.07), _pele('#f3c1b5', '#e5b0a4'))
    _elip((CX - 0.02, 1.84, 0.95), (0.05, 0.06, 0.04), _pele('#e8a59e'))
    _faca(0.2, 0.3, 0.912, 0.32, yaw=8)
    _faca(0.55, 1.25, 0.912, 0.24, yaw=-6)
    OC.bloco((0.54, 0.45, 0.915), (0.16, 0.2, 0.012), FACA_L)
    OC.bloco((0.54, 0.3, 0.92), (0.03, 0.1, 0.022), CABO)
    OC.bloco((0.52, 1.95, 0.915), (0.04, 0.5, 0.01), FACA_L, yaw=4)
    OC.bloco((0.52, 2.2, 0.925), (0.04, 0.12, 0.03), CABO, yaw=4)
    for k in (0.0, 0.05):
        OC.bloco((0.18 + k, 1.9, 0.916), (0.012, 0.1, 0.012), {'*': liso('#4a4a4a')}, yaw=30)
    _sangue([OC.Mancha(0.3, 0.55, 0.1, seed=821, amp=0.2, ex=1.4, lobos=(2, 3)), OC.Mancha(0.55, 1.6, 0.07, seed=822, amp=0.2, lobos=(2, 3))], 0.93)
    _sangue([OC.Mancha(0.7, 1.2, 0.13, seed=823, amp=0.2, ex=1.3, lobos=(2, 3)), OC.Mancha(0.7, 0.4, 0.07, seed=824, amp=0.2, lobos=(2, 3))], 0.004)
    OC.peg(x0, x1, y0, y1)


def bloco_de_corte():
    """O cepo (1 x 1, 0,75 m): o toco de madeira lascada, o cutelo cravado, os retalhos e o sangue."""
    o = OC.novo()
    _c().cilindro(CX, CY, 0.25, 0.0, 0.7, BE.vol(CX, CY, '#8a5a34'), M, o, lados=14, tampa_mat=liso('#b07a48'))
    OC.bloco((CX + 0.06, CY, 0.74), (0.02, 0.22, 0.16), FACA_L, pitch=-20)
    OC.bloco((CX + 0.06, CY - 0.14, 0.82), (0.03, 0.12, 0.03), CABO, pitch=-20)
    for (dx, dy, r) in ((-0.1, 0.05, 0.05), (0.0, 0.1, 0.04), (-0.05, -0.08, 0.045)):
        _elip((CX + dx, CY + dy, 0.71), (r, r * 1.2, 0.025), _pele('#c43a40', '#a8262a'))
    _sangue([OC.Mancha(CX + 0.3, CY + 0.2, 0.1, seed=831, amp=0.2, ex=1.3, lobos=(2, 3)), OC.Mancha(CX - 0.28, CY + 0.28, 0.06, seed=832, amp=0.2, lobos=(2, 3))], 0.004)
    OC.peg(CX - 0.26, CX + 0.26, CY - 0.26, CY + 0.26)


def carrinho_de_carne():
    """O carrinho de carne (1 x 1, 0,95 m): a caixa de aço sobre rodinhas, o puxador, costelas, uma pata e pedaços."""
    for (dx, dy) in ((-0.2, -0.2), (0.2, -0.2), (-0.2, 0.2), (0.2, 0.2)):
        _c().cilindro(CX + dx, CY + dy, 0.045, 0.0, 0.09, BE.vol(CX + dx, CY + dy, '#2a2a2a'), M, OC.novo(), lados=8, tampa_mat=liso('#3a3a3a'))
    OC.caixa((CX - 0.27, CX + 0.27, CY - 0.27, CY + 0.27, 0.1, 0.16), MAD_E)
    OC.caixa((CX - 0.27, CX + 0.27, CY - 0.27, CY - 0.24, 0.16, 0.6), MAD)
    OC.caixa((CX - 0.27, CX + 0.27, CY + 0.24, CY + 0.27, 0.16, 0.6), MAD)
    OC.caixa((CX - 0.27, CX - 0.24, CY - 0.24, CY + 0.24, 0.16, 0.6), MAD)
    OC.caixa((CX + 0.24, CX + 0.27, CY - 0.24, CY + 0.24, 0.16, 0.6), MAD)
    OC.caixa((CX - 0.24, CX + 0.24, CY - 0.24, CY + 0.24, 0.16, 0.5), {'*': liso('#8a1c22'), 'cima': liso('#a8262a')})
    OC.bloco((CX - 0.3, CY, 0.78), (0.02, 0.5, 0.02), MAD_E)
    for yy in (-0.24, 0.24):
        OC.bloco((CX - 0.3, CY + yy, 0.69), (0.02, 0.02, 0.2), MAD_E)
    for i in range(4):
        _elip((CX + 0.08, CY - 0.17 + i * 0.1, 0.58), (0.11, 0.035, 0.035), _pele('#f2c0b4', '#e2ad9f'))
    _elip((CX - 0.12, CY - 0.05, 0.57), (0.09, 0.14, 0.07), _pele('#d65a5a', '#b83e44'))
    _elip((CX - 0.1, CY + 0.15, 0.56), (0.07, 0.09, 0.06), _pele('#a8262a', '#8a1c22'))
    _elip((CX + 0.12, CY + 0.12, 0.59), (0.035, 0.1, 0.035), _pele('#f2c0b4'))
    _elip((CX + 0.12, CY + 0.2, 0.59), (0.03, 0.035, 0.03), liso('#4a3a36'))
    _sangue([OC.Mancha(CX + 0.25, CY + 0.3, 0.08, seed=841, amp=0.2, lobos=(2, 3))], 0.004)
    OC.peg(CX - 0.3, CX + 0.3, CY - 0.3, CY + 0.3)


def tanque_de_escalda():
    """O tanque de escalda (1 x 2, 0,85 m): a banheira de aço com a água turva e um porco meio afundado."""
    x0, x1, y0, y1 = 0.06, 0.69, 0.04, 1.46
    for (xx, yy) in ((x0 + 0.03, y0 + 0.03), (x1 - 0.03, y0 + 0.03), (x0 + 0.03, y1 - 0.03), (x1 - 0.03, y1 - 0.03)):
        OC.caixa((xx - 0.025, xx + 0.025, yy - 0.025, yy + 0.025, 0.0, 0.3), ACO_E)
    OC.caixa((x0, x1, y0, y0 + 0.04, 0.3, 0.85), ACO)
    OC.caixa((x0, x1, y1 - 0.04, y1, 0.3, 0.85), ACO)
    OC.caixa((x0, x0 + 0.04, y0, y1, 0.3, 0.85), ACO)
    OC.caixa((x1 - 0.04, x1, y0, y1, 0.3, 0.85), ACO)
    OC.caixa((x0 + 0.04, x1 - 0.04, y0 + 0.04, y1 - 0.04, 0.3, 0.7), {'*': liso('#4a6068'), 'cima': liso('#6a8890')})
    _elip((CX, 0.75, 0.82), (0.2, 0.48, 0.1), _pele('#f2c0b4', '#e2ad9f'))
    _elip((CX, 1.28, 0.8), (0.1, 0.1, 0.08), _pele('#e8a59e'))
    OC.peg(x0, x1, y0, y1)


def serra_de_fita():
    """A serra de fita (1 x 1, 1,5 m): a mesa de aço, a coluna, a caixa das polias e a lâmina esticada no meio."""
    AZ = {'*': liso('#4a6a8a'), 'cima': liso('#6a8aaa')}
    OC.caixa((CX - 0.28, CX + 0.28, CY - 0.28, CY + 0.28, 0.0, 0.3), ACO_E)
    OC.caixa((CX - 0.3, CX + 0.3, CY - 0.3, CY + 0.3, 0.3, 0.38), ACO)
    OC.caixa((CX - 0.3, CX - 0.2, CY + 0.12, CY + 0.28, 0.38, 1.5), AZ)
    OC.caixa((CX - 0.3, CX + 0.1, CY + 0.1, CY + 0.28, 1.34, 1.5), AZ)
    OC.bloco((CX, CY + 0.12, 0.9), (0.006, 0.006, 0.9), {'*': liso('#d8e0e6')})
    _meia_carcaca(CX + 0.1, CY - 0.05, 0.44, 0.12, 0.2, 0.06)
    _sangue([OC.Mancha(CX + 0.35, CY + 0.32, 0.07, seed=851, amp=0.2, lobos=(2, 3))], 0.004)
    OC.peg(CX - 0.3, CX + 0.3, CY - 0.3, CY + 0.3)


def porco_morto():
    """O porco morto (1 x 1, 0,4 m): deitado de lado na palha, as patas esticadas, o focinho no chão, o sangue embaixo."""
    pele = _pele('#f3c1b5', '#e5b0a4')
    _elip((CX + 0.04, CY, 0.17), (0.28, 0.17, 0.16), pele)
    _elip((CX - 0.26, CY + 0.02, 0.14), (0.12, 0.1, 0.11), _pele('#f0b8ac', '#e2a79b'))
    _elip((CX - 0.36, CY + 0.03, 0.1), (0.05, 0.055, 0.05), _pele('#e8a59e'))
    _elip((CX - 0.24, CY + 0.12, 0.2), (0.05, 0.02, 0.07), _pele('#e39d98', '#d48d88'))
    for (dx, dy, l) in ((0.2, 0.15, 0.1), (0.04, 0.17, 0.09), (0.28, -0.12, 0.1), (0.1, -0.15, 0.09)):
        _elip((CX + dx, CY + dy, 0.08), (l, 0.03, 0.03), pele)
    _elip((CX + 0.34, CY, 0.2), (0.03, 0.04, 0.03), _pele('#e8a59e'))
    # a ferida no pescoço e o sangue escorrido
    _elip((CX - 0.2, CY + 0.12, 0.15), (0.04, 0.03, 0.04), liso('#7a1a1a'))
    _sangue([OC.Mancha(CX - 0.18, CY + 0.2, 0.14, seed=861, amp=0.2, ex=1.3, lobos=(2, 3)), OC.Mancha(CX - 0.34, CY + 0.12, 0.07, seed=862, amp=0.2, lobos=(2, 3))], 0.004)
    OC.peg(CX - 0.34, CX + 0.34, CY - 0.18, CY + 0.18)


def pilha_carvao():
    """A pilha de carvão (3 x 3, 1,3 m): um monte baixo e largo de pedaços angulares (preto e cinza-azulado) com lascas claras, pedaços soltos no chão e a pá cravada."""
    rng = np.random.default_rng(881)
    tons = [({'*': liso('#1a1c20'), 'cima': liso('#2c2f36')}), ({'*': liso('#262930'), 'cima': liso('#3c4048')}),
            ({'*': liso('#30343c'), 'cima': liso('#4a505a')})]
    brilho = {'*': liso('#6a7280'), 'cima': liso('#9aa4b2')}
    cx, cy = 1.1, 1.1
    # o miolo: uma base escura baixa para não ter vão
    OC.bloco((cx, cy, 0.12), (1.3, 1.25, 0.24), tons[0], yaw=20)
    OC.bloco((cx + 0.05, cy - 0.05, 0.3), (0.9, 0.85, 0.3), tons[0], yaw=-15)
    blocos = []
    for k in range(190):
        a = rng.uniform(0, 2 * math.pi)
        r = rng.uniform(0, 1) ** 0.75
        x, y = cx + math.cos(a) * 0.95 * r, cy + math.sin(a) * 0.9 * r
        alt = 0.78 * (1 - r) ** 0.9 + 0.1
        s = rng.uniform(0.09, 0.19) * (1.0 - 0.25 * r)
        blocos.append((alt, x, y, s))
    blocos.sort()
    for k, (alt, x, y, s) in enumerate(blocos):
        z = alt + rng.uniform(-0.05, 0.07)
        mat = brilho if rng.random() < 0.06 else tons[k % 3]
        OC.bloco((x, y, z), (s * rng.uniform(0.8, 1.3), s * rng.uniform(0.8, 1.3), s * rng.uniform(0.6, 1.0)), mat,
                 yaw=rng.uniform(0, 90), pitch=rng.uniform(-30, 30), roll=rng.uniform(-30, 30))
    # os pedaços soltos pelo chão em volta
    for k in range(26):
        a = rng.uniform(0, 2 * math.pi)
        r = rng.uniform(1.0, 1.35)
        x, y = cx + math.cos(a) * 0.95 * r, cy + math.sin(a) * 0.9 * r
        if 0.1 < x < 2.15 and 0.1 < y < 2.15:
            s = rng.uniform(0.05, 0.1)
            OC.bloco((x, y, s * 0.4), (s * 1.2, s, s * 0.7), tons[k % 3], yaw=rng.uniform(0, 90), pitch=rng.uniform(-20, 20))
    # a pá cravada no monte
    OC.bloco((1.55, 1.7, 0.95), (0.025, 0.025, 0.85), {'*': liso('#7a4a2a')}, pitch=-25)
    OC.bloco((1.55, 1.55, 0.58), (0.2, 0.25, 0.015), {'*': liso('#5a5e64'), 'cima': liso('#8a9096')}, pitch=-25)
    OC.peg(0.2, 2.05, 0.2, 2.05)



def _tijolo(L, n, P):
    """O tijolo vermelho-escuro com junta: fiadas de 7,5 cm, juntas alternadas, três tons."""
    X, Y, Z = P[:, 0], P[:, 1], P[:, 2]
    fiada = np.floor(Z / 0.075).astype(int)
    s = (X + Y) / 0.16 + (fiada % 2) * 0.5
    col = np.floor(s).astype(int)
    tons = np.array([hx('#7c2a22'), hx('#6a231e'), hx('#8c372a'), hx('#5a1e1a')])
    out = tons[(fiada * 7 + col * 3 + (fiada // 3)) % 4]
    junta = ((Z / 0.075 - fiada) < 0.12) | ((s - np.floor(s)) < 0.07)
    out = np.where(junta[:, None], hx('#3a2a26'), out)
    # a fuligem sobe do chão e escurece embaixo da boca
    return out


def fornalha():
    """
    A fornalha industrial de tijolo (2 x 2, 3,3 m): o corpo largo de tijolo vermelho-escuro com junta, as cintas de ferro
    negro com rebites, a boca em arco com o fogo laranja e a grelha com carvão embaixo, a chaminé afunilada.
    """
    TIJ = emissivo(_tijolo)
    FER = {'*': liso('#1c1c20'), 'cima': liso('#34343a')}
    RIV = {'*': liso('#4a4a52'), 'cima': liso('#6a6a74')}
    # o corpo e os dois degraus de cima, que afunilam até a chaminé
    OC.caixa((0.1, 1.4, 0.1, 1.4, 0.0, 1.75), {'*': TIJ, 'cima': TIJ})
    OC.caixa((0.22, 1.28, 0.22, 1.28, 1.75, 2.3), {'*': TIJ, 'cima': TIJ})
    OC.caixa((0.42, 1.08, 0.42, 1.08, 2.3, 2.8), {'*': TIJ, 'cima': TIJ})
    OC.caixa((0.56, 0.94, 0.56, 0.94, 2.8, 3.35), {'*': TIJ, 'cima': TIJ})
    OC.caixa((0.52, 0.98, 0.52, 0.98, 3.3, 3.4), FER)
    # as cintas de ferro (aros) em volta do corpo, com rebites nas quinas
    for z in (0.3, 0.85, 1.5):
        OC.caixa((0.08, 1.42, 0.08, 1.42, z, z + 0.08), FER)
        for (x, y) in ((0.08, 0.08), (1.42, 0.08), (0.08, 1.42), (1.42, 1.42)):
            OC.caixa((x - 0.025, x + 0.025, y - 0.025, y + 0.025, z + 0.1, z + 0.14), RIV)
    for z in (2.0, 2.55):
        w = 0.2 if z < 2.3 else 0.4
        OC.caixa((w - 0.02, 1.5 - w + 0.02, w - 0.02, 1.5 - w + 0.02, z, z + 0.06), FER)
    # as quinas verticais de ferro
    for (x, y) in ((0.1, 0.1), (1.4, 0.1), (0.1, 1.4), (1.4, 1.4)):
        OC.caixa((x - 0.03, x + 0.03, y - 0.03, y + 0.03, 0.0, 1.75), FER)
    # a boca em arco (na frente, +y): o vão escuro, o arco de ferro, o fogo e a grelha com carvão
    OC.caixa((0.38, 1.12, 1.38, 1.43, 0.22, 0.95), {'*': liso('#140a08'), 'cima': liso('#140a08')})
    _elip((0.75, 1.4, 0.95), (0.37, 0.03, 0.2), liso('#140a08'))
    OC.caixa((0.33, 0.4, 1.4, 1.46, 0.2, 1.0), FER)
    OC.caixa((1.1, 1.17, 1.4, 1.46, 0.2, 1.0), FER)
    OC.caixa((0.33, 1.17, 1.4, 1.46, 0.98, 1.06), FER)
    # o fogo (emissivo, laranja forte): línguas e brasa
    fogo = [(0.62, 0.42, 0.18, 0.26, '#ff8a22'), (0.88, 0.45, 0.16, 0.32, '#ffb030'), (0.75, 0.55, 0.12, 0.3, '#ffe070'), (0.7, 0.3, 0.3, 0.14, '#e8501a'),
            (0.82, 0.3, 0.28, 0.12, '#ff6a1c')]
    for (x, z, rx, rz, c) in fogo:
        _elip((x, 1.45, z + 0.2), (rx, 0.03, rz), liso(c))
    # a grelha e o carvão embaixo
    for xx in (0.45, 0.58, 0.71, 0.84, 0.97, 1.05):
        OC.caixa((xx - 0.012, xx + 0.012, 1.3, 1.5, 0.2, 0.235), FER)
    for k, (x, z) in enumerate(((0.5, 0.11), (0.62, 0.1), (0.75, 0.12), (0.88, 0.1), (1.0, 0.11), (0.7, 0.07), (0.9, 0.06))):
        _elip((x, 1.47, z), (0.06, 0.05, 0.05), liso('#2a2a2e') if k % 2 else liso('#c24a18'), brilho=0.4)
    # o brilho laranja projetado no chão, na frente da boca, e o pó de carvão
    lz = [OC.Mancha(0.75, 1.85, 0.45, seed=891, amp=0.2, ex=1.6, lobos=(2, 3)), OC.Mancha(0.75, 1.75, 0.3, seed=892, amp=0.2, ex=1.4, lobos=(2, 3))]
    OC.manchas_decal(lz[:1], OC.mat_mancha(lz[:1], ['#a8481a', '#c4601e'], beira=1.3), z=0.004)
    OC.manchas_decal(lz[1:], OC.mat_mancha(lz[1:], ['#e0802a', '#ffb050'], beira=1.3), z=0.006)
    OC.peg(0.08, 1.45, 0.08, 1.45)


def fole():
    """O fole de forja (1 x 1, 0,8 m): a base de madeira, as duas tábuas com o couro marrom dobrado no meio, o cabo atrás e o bico de ferro para +y."""
    MD = {'*': liso('#6a4228'), 'cima': liso('#8a5a38')}
    CO = {'*': liso('#4a2e1c'), 'cima': liso('#6a4228')}
    FER = {'*': liso('#26262a'), 'cima': liso('#4a4a52')}
    for (dx, dy) in ((-0.14, -0.2), (0.14, -0.2), (-0.14, 0.18), (0.14, 0.18)):
        OC.caixa((CX + dx - 0.025, CX + dx + 0.025, CY + dy - 0.025, CY + dy + 0.025, 0.0, 0.3), MD)
    OC.bloco((CX, CY, 0.32), (0.36, 0.62, 0.04), MD)
    OC.bloco((CX, CY - 0.02, 0.56), (0.34, 0.6, 0.04), MD, pitch=-16)
    for sx in (-1, 1):
        OC.bloco((CX + sx * 0.16, CY, 0.44), (0.025, 0.56, 0.2), CO, pitch=-8)
    for yy in (-0.1, 0.05, 0.18):
        OC.bloco((CX, CY + yy, 0.46), (0.37, 0.025, 0.2), CO, pitch=-8)
    OC.bloco((CX, CY - 0.42, 0.62), (0.04, 0.4, 0.04), MD, pitch=14)
    OC.bloco((CX, CY + 0.42, 0.36), (0.05, 0.3, 0.05), FER)
    OC.bloco((CX, CY + 0.58, 0.36), (0.03, 0.08, 0.03), FER)
    OC.peg(CX - 0.2, CX + 0.2, CY - 0.34, CY + 0.34)


def _escada(tons, aresta, fundo):
    """A escada que desce, camuflada (1 x 2): sem corrimão; só o vão no piso e os degraus, cada um um pouco mais escuro que o de cima."""
    x0, x1 = 0.03, 0.72
    y0, y1 = 0.03, 1.47
    OC.decal([[(x0, y0), (x1, y0), (x1, y1), (x0, y1)]], liso(fundo), z=0.004)
    n = len(tons)
    # os degraus: do pé da escada (+y) até a parede (y = 0), cada faixa mais funda e mais escura
    passo = (y1 - y0 - 0.1) / n
    for k, cor in enumerate(tons):
        ya = y1 - 0.05 - (k + 1) * passo
        yb = y1 - 0.05 - k * passo
        OC.decal([[(x0 + 0.04, ya + 0.01), (x1 - 0.04, ya + 0.01), (x1 - 0.04, yb), (x0 + 0.04, yb)]], liso(cor), z=0.006 + 0.001 * k)
        OC.decal([[(x0 + 0.04, yb - 0.025), (x1 - 0.04, yb - 0.025), (x1 - 0.04, yb)]], liso(aresta), z=0.0065 + 0.001 * k) if False else None
        OC.decal([[(x0 + 0.04, yb - 0.03), (x1 - 0.04, yb - 0.03), (x1 - 0.04, yb), (x0 + 0.04, yb)]], liso(aresta), z=0.0068 + 0.001 * k)


def escada_simples():
    _escada(['#aab4b6', '#9aa4a6', '#8a9496', '#7a8486', '#6a7476', '#5a6466'], '#d8dedf', '#38423f')


def escada_simples_fria():
    _escada(['#3a6a90', '#325e84', '#2a5278', '#22466c', '#1a3a60', '#122e52'], '#5a8cb4', '#081a2a')


ITENS = {
    'porco_pendurado': (1, 1, (0.0, 0.0), porco_pendurado, {}),
    'mesa_corte': (1, 3, (0.0, 0.0), mesa_corte, {}),
    'bloco_de_corte': (1, 1, (0.0, 0.0), bloco_de_corte, {}),
    'carrinho_de_carne': (1, 1, (0.0, 0.0), carrinho_de_carne, {}),
    'tanque_de_escalda': (1, 2, (0.0, 0.0), tanque_de_escalda, {}),
    'porco_morto': (1, 1, (0.0, 0.0), porco_morto, {}),
    'pilha_carvao': (3, 3, (0.0, 0.0), pilha_carvao, {}),
    'fornalha': (2, 2, (0.0, 0.0), fornalha, {}),
    'fole': (1, 1, (0.0, 0.0), fole, {}),
    'escada_simples': (1, 2, (0.0, 0.0), escada_simples, {}),
    'escada_simples_fria': (1, 2, (0.0, 0.0), escada_simples_fria, {}),
    'serra_de_fita': (1, 1, (0.0, 0.0), serra_de_fita, {}),
}
