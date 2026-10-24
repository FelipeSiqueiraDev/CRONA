"""
As peças que ainda estavam no desenho de reserva no jogo (23/10, o Felipe: "tirar todas as pendências do tabuleiro"): o
sofá de couro (29 nos apartamentos do Igarapé), a estante de metal (o anexo da mansão), o carpete roxo (o quarto da
filha em Santa Amália e a Sala de Tecnologia) e a prateleira de parede (a pousada de Tiradentes). Pixel art 1:1 só por
código, com o estofado, o couro e o metal dos outros grupos.

Tudo no giro 4 (a frente para +y), a pegada começando em (0, 0), no tamanho do catálogo.
"""
import numpy as np

import casa as CA
import escritorio as ES
import mansao_luxo as ML
import parede_casa as PC
from base_estilo import hx, liso, mad2, tab2, _tom, _p1_rampa, PH
from motor import emissivo

CASA = 0.75
caixa, peg, novo = CA.caixa, CA.peg, CA.novo

# o couro marrom-café do sofá (do escuro ao reflexo)
_COURO = _p1_rampa(['#1c0e0a', '#26130e', '#321a12', '#3e2116', '#4a281a', '#56301f', '#643a25', '#72452c', '#825236', '#966444'])


def sofa_leather():
    """O sofá de couro (2 x 1, o assento a 0,45 m): o Chesterfield de dois lugares, capitonê, braços em rolo, os pés de latão."""
    ML._sofa(_COURO, 2)


def shelf_metal():
    """
    A estante de aço (2 x 1, 2,2 m): os quatro montantes de cantoneira furada, cinco prateleiras de chapa, as caixas de
    papelão, as caixas plásticas, as latas e um rolo de fio.
    """
    x0, x1, y0, y1 = 0.04, 1.46, 0.06, 0.6
    h = 2.2
    AC = '#5a6068'
    for xx in (x0, x1 - 0.04):
        for yy in (y0, y1 - 0.04):
            caixa((xx, xx + 0.04, yy, yy + 0.04, 0.0, h), {'frente': emissivo(lambda L, n, P: np.where((np.floor(P[:, 2] / PH) % 4 == 0)[:, None], hx('#2a2e34'), np.tile(hx(AC), (len(P), 1)))), '*': ES.metal(AC)})
    zs = (0.08, 0.56, 1.04, 1.52, 2.0, h - 0.03)
    for z in zs:
        caixa((x0, x1, y0, y1, z, z + 0.03), {'cima': liso('#7a8088'), '*': ES.metal('#6a7078')})
    # o que fica em cada prateleira: as caixas de papelão, as caixas azuis de plástico, as latas, o rolo de fio
    papelao, plastico = '#a8804a', '#2e5a8a'
    for k, z in enumerate(zs[:-1]):
        z += 0.03
        if k % 2 == 0:
            caixa((x0 + 0.08, x0 + 0.5, y0 + 0.06, y1 - 0.06, z, z + 0.32), {'cima': liso('#c09a62'), 'frente': liso('#9a7442'), '*': liso(papelao)})
            caixa((x0 + 0.54, x0 + 0.92, y0 + 0.08, y1 - 0.08, z, z + 0.26), {'cima': liso('#3e72a8'), '*': liso(plastico)})
            for i in range(3):
                CA.C().cilindro(x1 - 0.12 - i * 0.12, y1 - 0.18, 0.045, z, z + 0.13, liso(['#8a3a2a', '#c8c8c0', '#3a6a3a'][i]), CA.M, novo(), lados=10)
        else:
            caixa((x0 + 0.06, x0 + 0.62, y0 + 0.08, y1 - 0.08, z, z + 0.24), {'cima': liso('#3e72a8'), '*': liso(plastico)})
            caixa((x0 + 0.68, x1 - 0.1, y0 + 0.06, y1 - 0.06, z, z + 0.36), {'cima': liso('#c09a62'), 'frente': liso('#9a7442'), '*': liso(papelao)})
    CA.C().cilindro(x1 - 0.28, y0 + 0.3, 0.11, zs[4] + 0.03, zs[4] + 0.12, liso('#c87a2a'), CA.M, novo(), lados=14, tampa_mat=liso('#a85a1a'))
    peg(x0, x1, y0, y1)


def rug_purple():
    """O carpete roxo (3 x 4): o campo roxo de veludo curto, a barra lilás com o filete."""
    x0, x1, y0, y1 = 0.06, 2.19, 0.08, 2.92
    U, V = (x1 - x0) / PH, (y1 - y0) / PH
    campo, campo2 = hx('#3a1f5a'), hx('#34194f')
    lilas, lilas2 = hx('#9a7ad0'), hx('#6a4c96')

    def f(L, n, P):
        u, v = np.floor((P[:, 0] - x0) / PH), np.floor((P[:, 1] - y0) / PH)
        out = np.tile(campo, (len(P), 1))
        # o pelo do veludo: a trama bem leve em diagonal
        out = np.where((((u + v) % 6) == 0)[:, None], campo2, out)
        bd = np.minimum(np.minimum(u, U - 1 - u), np.minimum(v, V - 1 - v))
        out = np.where((bd < 6)[:, None], lilas2, out)
        out = np.where(((bd == 2) | (bd == 3))[:, None], lilas, out)
        out = np.where((bd == 7)[:, None], lilas2, out)
        return out
    CA._tapete(x0, x1, y0, y1, f, borda='#24123a')


def prateleira_parede_pequena(xc=1.5, zc=1.6):
    """A prateleira de parede pequena (0,72 m): a tábua em duas mãos-francesas, os livros em pé, o pote e a vela."""
    n0 = len(CA.C().objs)
    larg, fundo = 0.72, 0.2
    x0, x1 = xc - larg / 2, xc + larg / 2
    zb = zc - 0.06
    caixa((x0, x1, 0.0, fundo, zb, zb + 0.03), {'cima': tab2(['#6a4428', '#62402a'], 0.1, '#2a180c', eixo=0, seed=81), '*': mad2('#4a2c18', seed=82, passo=0.03)})
    for xx in (x0 + 0.08, x1 - 0.11):
        caixa((xx, xx + 0.03, 0.0, fundo - 0.06, zb - 0.12, zb), {'*': liso('#3a2414')})
    z = zb + 0.03
    xa = CA._fileira(x0 + 0.04, x0 + 0.3, 0.03, fundo - 0.03, z, 0.2, 5, 4)
    CA.C().cilindro(xc + 0.1, fundo / 2, 0.04, z, z + 0.1, liso('#a85a2a'), CA.M, novo(), lados=10, tampa_mat=liso('#7a3a1a'))
    CA.C().cilindro(x1 - 0.1, fundo / 2, 0.022, z, z + 0.09, liso('#efe6d0'), CA.M, novo(), lados=8)
    PC.sombra_parede(n0, 1, 2)


ITENS = {
    'sofa_leather': (2, 1, (0.0, 0.0), sofa_leather, {}),
    'shelf_metal': (2, 1, (0.0, 0.0), shelf_metal, {}),
    'rug_purple': (3, 4, (0.0, 0.0), rug_purple, {}),
}

ITENS_PAREDE = {
    'wall_shelf': (lambda: prateleira_parede_pequena(1.5, 1.6), (1.5, 1.6)),
}
