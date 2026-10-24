"""
PEDRA SERENA (24/10), a cidade do Galpão do Fritz, em pixel art 1:1 só por código: o galpão visto de fora (o bloco de
concreto cru até 3 m, a chapa ondulada em cima, o telhado de duas águas de zinco, o portão de enrolar e a porta de
aço, a faixa de janelas altas encardidas, a ferrugem) e o pátio de concreto.

Tudo desenhado no giro 4 (a frente para +y), a pegada começando em (0, 0), no tamanho do catálogo (shared/src/furni.ts,
o bloco "PEDRA SERENA"). Nada de texto, número, logo ou símbolo.
"""
import math

import numpy as np

import cozinha as CZ
import fazenda_fora as FF
import vila_predios as VP
import tiradentes as TD
import santa_amalia as SA
from base_estilo import hx, liso, vol, _tom, PH, PZ
from motor import suave, emissivo, MUNDO as M

CASA = 0.75
obj = FF.obj
caixa = FF.caixa
pegada = FF.pegada
_bx = FF._bx

VP.ALTO_CANVAS.update({'galpao_fritz': 6.6})

BLOCO = ['#8a8a86', '#83837f', '#90908b', '#7d7d79']
ZINCO = ['#9aa0a4', '#8e9498', '#a3a9ad']


def mat_bloco(seed=0):
    """O bloco de concreto cru (39 x 19 cm), as juntas escuras, a sujeira subindo do chão."""
    def extra(L, n, P, out, i0):
        out = np.where((P[:, 2] < 0.35)[:, None], out * 0.86, out)
        q = suave(P[:, 0] - P[:, 1], P[:, 2], 0.9, 71 + seed)
        return np.where((q > 0.72)[:, None], out * 0.92, out)
    return FF.mat_juntas(BLOCO, FF.id_pedras_parede(0.2, 0.4, seed), '#5e5e5a', seed=seed, extra=extra)


def mat_zinco(eixo_lat, seed=0, ferrugem=0.22):
    """A chapa ondulada de aço galvanizado: a onda a cada 8 cm (crista clara, vale escuro) e a ferrugem escorrendo."""
    def f(L, n, P):
        lat = P[:, eixo_lat]
        a = ((lat + 50) / 0.08) % 1
        base = np.tile(hx(ZINCO[0]), (len(P), 1))
        q = suave(lat * 0.3, P[:, 2] * 0.3, 0.9, 41 + seed)
        base = np.where((q > 0.6)[:, None], hx(ZINCO[1]), np.where((q < 0.3)[:, None], hx(ZINCO[2]), base))
        out = np.where((a < 0.15)[:, None], _tom(base, 1.12), base)
        out = np.where(((a > 0.45) & (a < 0.62))[:, None], _tom(base, 0.78), out)
        fer = (suave(lat * 2.0, 0.0, 0.5, 47 + seed) > 1 - ferrugem) & (((a > 0.4) & (a < 0.7)))
        out = np.where(fer[:, None], hx('#7a5a3e'), out)
        return out
    return emissivo(f)


def _galpao():
    """
    O Galpão do Fritz por fora (18 x 9 casas, 6,0 m): o corpo de bloco cru até 3,2 m, a chapa ondulada até 4,4 m, o
    telhado de duas águas de zinco (a cumeeira em x), o oitão de chapa nos lados, o portão de enrolar e a porta de aço na
    frente, a faixa de janelas altas encardidas, a calha enferrujada e o pátio de concreto na frente.
    """
    W, D = 18 * CASA, 9 * CASA
    X0, X1, Y0, Y1 = 0.25, W - 0.25, 0.3, D - 0.9
    XM = (X0 + X1) / 2
    ZB, ZE, ZR = 3.2, 4.4, 6.0
    caixa((X0, X1, Y0, Y1, 0.0, ZB), mat_bloco(seed=3))
    # a chapa ondulada de cima (frente e fundo com a onda em x, os lados com a onda em y)
    for (b, ax) in (((X0, X1, Y1 - 0.06, Y1 + 0.02), 0), ((X0, X1, Y0 - 0.02, Y0 + 0.06), 0),
                    ((X0 - 0.02, X0 + 0.06, Y0, Y1), 1), ((X1 - 0.06, X1 + 0.02, Y0, Y1), 1)):
        caixa((b[0], b[1], b[2], b[3], ZB, ZE), {'*': mat_zinco(ax, seed=ax)})
    caixa((X0, X1, Y0 + 0.06, Y1 - 0.06, ZB, ZE), liso('#5a5e60'), contorno=False)
    # a cinta de concreto entre o bloco e a chapa
    caixa((X0 - 0.03, X1 + 0.03, Y0 - 0.03, Y1 + 0.03, ZB - 0.18, ZB), {'*': liso('#9a9a94'), 'cima': liso('#a8a8a2')})
    # a faixa de janelas altas (o vidro aramado encardido, o caixilho de ferro)
    def vidro(L, n, P):
        lat = P[:, 0] if abs(np.asarray(n)[1]) > 0.5 else P[:, 1]
        out = np.tile(hx('#6a7470'), (len(P), 1))
        q = suave(lat * 1.5, P[:, 2] * 3, 0.5, 9)
        out = np.where((q > 0.6)[:, None], hx('#7e8a84'), out)
        fr = (((lat + 50) / 0.5) % 1 < 0.06) | (((P[:, 2] + 50) / 0.3) % 1 < 0.08)
        return np.where(fr[:, None], hx('#3a3e3e'), out)
    for face, plano, lo, hi in (('+y', Y1 + 0.02, X0 + 0.4, X1 - 0.4), ('-x', X0 - 0.02, Y0 + 0.4, Y1 - 0.4)):
        caixa(_bx(face, plano, lo, hi, 0.0, 0.02, ZB + 0.25, ZB + 0.85), {'*': emissivo(vidro)})
    # o telhado de duas águas de zinco (a cumeeira ao longo de x) e os oitões de chapa
    o = obj()
    k = (ZR - ZE) / ((Y1 - Y0) / 2)
    nn = math.hypot(1, k)
    YM = (Y0 + Y1) / 2
    B = 0.3
    CZ.c.face_plana([(X0 - B, Y1 + B, ZE - B * k), (X1 + B, Y1 + B, ZE - B * k), (X1 + B, YM, ZR), (X0 - B, YM, ZR)], (0, k / nn, 1 / nn), mat_zinco(0, seed=5, ferrugem=0.3), M, o)
    CZ.c.face_plana([(X1 + B, Y0 - B, ZE - B * k), (X0 - B, Y0 - B, ZE - B * k), (X0 - B, YM, ZR), (X1 + B, YM, ZR)], (0, -k / nn, 1 / nn), mat_zinco(0, seed=6, ferrugem=0.3), M, o)
    for (x, sg) in ((X1, 1), (X0, -1)):
        pts = [(x, Y1, ZE), (x, Y0, ZE), (x, YM, ZR - 0.05)] if sg > 0 else [(x, Y0, ZE), (x, Y1, ZE), (x, YM, ZR - 0.05)]
        CZ.c.face_plana(pts, (sg, 0, 0), mat_zinco(1, seed=7 + sg), M, obj())
    FF._viga(obj(), (X0 - B, YM, ZR + 0.03), (X1 + B, YM, ZR + 0.03), 0.14, liso('#7a8084'))
    # a calha enferrujada na beira da frente e o cano que desce no canto
    caixa((X0 - B, X1 + B, Y1 + B - 0.1, Y1 + B + 0.04, ZE - B * k - 0.14, ZE - B * k), {'*': liso('#7a5a3e'), 'cima': liso('#5a3e2a')})
    CZ.c.cilindro(X1 - 0.15, Y1 + 0.15, 0.05, 0.0, ZE - B * k - 0.1, liso('#6a4e36'), M, obj(), lados=8, tampa=True)
    # o portão de enrolar (as lâminas de aço) com a caixa em cima, e a porta de aço do lado
    ga, gb = XM - 2.4, XM + 0.6

    def lam(L, n, P):
        z = P[:, 2]
        out = np.tile(hx('#7e8488'), (len(P), 1))
        out = np.where((((z + 50) / 0.1) % 1 < 0.25)[:, None], hx('#5e6468'), out)
        out = np.where((z < 0.3)[:, None], hx('#4e5254'), out)
        q = suave(P[:, 0] * 2, z * 2, 0.5, 13)
        return np.where((q > 0.88)[:, None], hx('#7a5a3e'), out)
    caixa(_bx('+y', Y1, ga, gb, -0.02, 0.04, 0.0, 2.8), {'*': emissivo(lam)})
    caixa(_bx('+y', Y1, ga - 0.12, gb + 0.12, 0.0, 0.2, 2.8, 3.15), {'*': liso('#6a7074'), 'cima': liso('#8a9094')})
    for a in (ga - 0.06, gb + 0.06):
        caixa(_bx('+y', Y1, a - 0.05, a + 0.05, 0.0, 0.08, 0.0, 2.8), liso('#4a4e50'))

    def aco(L, n, P):
        out = np.tile(hx('#4e5458'), (len(P), 1))
        return np.where((np.abs(P[:, 2] - 1.0) < 0.03)[:, None], hx('#2e3236'), out)
    pa = XM + 2.3
    caixa(_bx('+y', Y1, pa - 0.45, pa + 0.45, -0.02, 0.04, 0.0, 2.1), {'*': emissivo(aco)})
    caixa(_bx('+y', Y1, pa + 0.25, pa + 0.33, 0.04, 0.08, 0.95, 1.05), liso('#b8bcc0'), contorno=False)
    # a placa em branco sobre a porta, desbotada, e a lâmpada de rua apagada no braço
    caixa(_bx('+y', Y1, XM - 1.0, XM + 1.0, 0.06, 0.1, ZB - 0.15 - 0.6, ZB - 0.2), {'*': liso('#c8c0a8'), 'cima': liso('#d8d0b8')})
    caixa(_bx('+y', Y1, pa - 0.03, pa + 0.03, 0.0, 0.5, 2.45, 2.5), liso('#3a3a3a'))
    caixa(_bx('+y', Y1, pa - 0.1, pa + 0.1, 0.4, 0.6, 2.38, 2.48), {'*': liso('#4a4a4a'), 'cima': liso('#3a3a3a')})
    # o pátio de concreto rachado na frente e as manchas de óleo
    def patio(L, n, P):
        out = np.tile(hx('#8e8e88'), (len(P), 1))
        q = suave(P[:, 0] * 1.2, P[:, 1] * 1.2, 0.6, 21)
        out = np.where((q > 0.75)[:, None], hx('#6a6a66'), out)
        return np.where(((((P[:, 0] + 50) / 1.5) % 1) < 0.02)[:, None], hx('#5a5a56'), out)
    caixa((X0 - 0.15, X1 + 0.15, Y1, D - 0.04, 0.0, 0.04), {'*': liso('#7a7a74'), 'cima': emissivo(patio)}, contorno=False)
    # os tambores e as paletes encostados no canto
    for k2, x in enumerate((X1 - 0.6, X1 - 0.95)):
        CZ.c.cilindro(x, Y1 + 0.35, 0.2, 0.04, 0.9, vol(x, Y1 + 0.35, ['#2f4a6a', '#5a3a2a'][k2], brilho=0.3), M, obj(), lados=12, tampa=True, tampa_mat=liso('#3a3a3a'))
    for k2 in range(3):
        caixa((X0 + 0.2, X0 + 1.4, Y1 + 0.1, Y1 + 0.9, 0.04 + 0.13 * k2, 0.15 + 0.13 * k2), {'*': liso('#9a7a4a'), 'cima': liso('#b0905a')})
    pegada(X0, X1, Y0, Y1)


ITENS = {
    'galpao_fritz': (18, 9, (0.0, 0.0), _galpao, {}),
}
