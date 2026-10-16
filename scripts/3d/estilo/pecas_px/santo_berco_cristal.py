"""
Santo Berço não tem fogo (16/10, o Felipe: "o fogo são os cristais vermelhos"): as peças de fogo da vila na versão de
cristal. Pixel art 1:1 só por código, nos desenhos de medieval.py, casa.py e da cozinha:

  - lareira_cristal: a lareira de pedra com os cristais vermelhos entre os cães de ferro (no lugar da lenha);
  - forja_cristal: a forja com as pedras escuras e o monte de cristais na cova (sem carvão em brasa nem chama);
  - fogao_cristal: o fogão a lenha frio com o cristal vermelho brilhando na fornalha (estado '1' aceso, como o fogão);
  - velas_cristal: o pratinho de ferro com três cristais pequenos (no lugar das velas).

Estado 0 aceso (o cristal brilha) e '1' apagado, menos o fogão (0 apagado, '1' aceso, como o fogao_lenha).
"""
import math

import numpy as np

import cozinha as CZ
import base_estilo as BE
import medieval as MD
from base_estilo import hx, vol, _poligono_rodado, _disco
from motor import emissivo


def _fogao(aceso):
    CZ.fogao(aceso=False, lenha=False)
    # a fornalha (a boca em x 2,6 ± 0,24, z 0,38 a 0,7, de y 0,26 a 0,7 na cena da cozinha): os cristais lá dentro
    MD.monte_cristais(2.6, 0.5, 0.39, 0.17, 0.12, n=4, aceso=aceso, seed=3.0, alto=0.27)
    # o nicho de baixo (x 1,66 a 2,2, z 0,05 a 0,33): os cristais de reserva, apagados
    MD.monte_cristais(1.93, 0.52, 0.05, 0.18, 0.1, n=4, aceso=False, seed=4.0, alto=0.2)


def _velas(aceso):
    cx, cy = 0.375, 0.375
    o = MD.novo()
    _poligono_rodado(cx, cy, [(0.0, 0.11), (0.012, 0.13), (0.022, 0.135)], vol(cx, cy, '#3a3634', brilho=0.3), o, lados=26)

    def prato(L, n, P):
        rr = np.hypot(P[:, 0] - cx, P[:, 1] - cy)
        return np.where((rr > 0.11)[:, None], hx('#5a5450'), hx('#2a2624'))
    _disco(cx, cy, 0.022, 0.135, emissivo(prato), o, lados=26)
    for (dx, dy, hh, f) in ((-0.05, -0.03, 0.17, 0.2), (0.05, -0.02, 0.12, 0.5), (-0.01, 0.06, 0.09, 0.8)):
        MD.cristal(cx + dx, cy + dy, 0.022, hh, hh * 0.24, aceso=aceso, fase=f)
    CZ.itens_peq.append((cx - 0.09, cx + 0.09, cy - 0.09, cy + 0.09, 0.022))
    MD.peg(cx - 0.14, cx + 0.14, cy - 0.14, cy + 0.14)


ITENS = {
    'lareira_cristal': (3, 1, (0.0, 0.0), lambda: MD.lareira(True, cristais=True), {'1': lambda: MD.lareira(False, cristais=True)}),
    'forja_cristal': (3, 2, (0.0, 0.0), lambda: MD.forja(True, cristais=True), {'1': lambda: MD.forja(False, cristais=True)}),
    'fogao_cristal': (2, 1, (1.5, 0.0), lambda: _fogao(False), {'1': lambda: _fogao(True)}),
    'velas_cristal': (1, 1, (0.0, 0.0), lambda: _velas(True), {'1': lambda: _velas(False)}),
}
