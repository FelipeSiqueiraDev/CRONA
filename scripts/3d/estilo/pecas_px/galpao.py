"""
O Galpão do Fritz em Pedra Serena (23/10), em pixel art 1:1, só código: o estilo `galpao` (o piso de concreto alisado
em placas grandes, com as juntas de dilatação e as manchas de óleo; a parede de bloco de concreto cru até 1,8 m, a
cinta de concreto e a chapa ondulada de aço galvanizado em cima) e a estante vazia (o Felipe: "essa prateleira tá
vazia"): a estante de aço do anexo, sem nada, só a poeira nas chapas.

Mesmo formato do estilos.py: tudo no TEXEL (32 texels = 1 casa; na parede, o jogo corta em 2,8 m = 146 texels),
periódico em 128 texels (4 casas). A estante no giro 4 (a frente para +y), a pegada começando em (0, 0).
"""
import numpy as np

import casa as CA
import escritorio as ES
from estilos import W, HP, _uv_chao, _uv_parede, _h, _ns, _rampa, _w, _g, g_grade, vol_parede, _mancha, _concreto, com_rodape
from base_estilo import hx, liso, _tom, PH
from motor import emissivo

caixa, peg = CA.caixa, CA.peg


# =====================================================================================================================
# o estilo
# =====================================================================================================================
GAL_P = _rampa(['#7e7f7d', '#787977', '#838481'])


def piso_galpao():
    """O concreto alisado: placas de 4 casas (3 m) com a junta serrada, a sujeira e as manchas de óleo dos carros."""
    def f(L, n, P):
        u, v = _uv_chao(P)
        out = _concreto(u, v, GAL_P, hx('#4e4f4d'), 13.0, placa=128, sujo=0.22)
        # as manchas de óleo: poças largas e escuras, com a borda um tom mais clara (uma a cada 4 casas, no máximo)
        uu, vv = u % (W * 2), v % (W * 2)
        o = _ns(uu, vv, 32, 61) * 0.7 + _ns(uu, vv, 16, 62) * 0.3
        out = _w(o > 0.78, _tom(out, 0.9), out)
        out = _w(o > 0.83, _tom(out, 0.8), out)
        return out
    return emissivo(f)


ZINCO = _rampa(['#9aa0a4', '#8e9498', '#a3a9ad'])


def parede_galpao(eixo):
    """
    O bloco de concreto cru (sem pintura) até v 92 (1,76 m), a cinta de concreto (v 92..99) e a chapa ondulada em
    cima: a onda a cada 8 texels (crista clara, vale escuro), os parafusos na terça, a ferrugem escorrendo.
    """
    def f(L, n, P):
        u, v = _uv_parede(P, eixo)
        uu = u % W
        g = _g('gal_par', lambda: g_grade(32, 11, H=HP, desloc=16)).at(u, v)
        pal = _rampa(['#8a8a86', '#83837f', '#90908b', '#7d7d79'])[(_h(g.ids * 0.37, 2.0) * 4).astype(int) % 4]
        pnt = _h((uu // 2) % 64, v, 9.3)
        pal = _w(pnt < 0.06, _tom(pal, 0.86), pal)
        m = _mancha(uu, v, 71, per_v=False)
        pal = _w(m > 0.68, _tom(pal, 0.94), pal)
        out = vol_parede(pal, g, hx('#5e5e5a'), 1.07, 1.03, 0.9, 0.96)
        # a sujeira subindo do chão (mais escura embaixo, em degrau)
        out = _w(v < 8, _tom(out, 0.84), out)
        out = _w((v >= 8) & (v < 16) & (_h(uu // 4, 3.1) < 0.5), _tom(out, 0.9), out)
        # a cinta de concreto: lisa, com a quina de cima clara e a de baixo escura
        cinta = (v >= 92) & (v < 100)
        out = _w(cinta, np.tile(hx('#93938e'), (len(P), 1)), out)
        out = _w(v == 99, hx('#a8a8a2'), out)
        out = _w(v == 92, hx('#5a5a56'), out)
        # a chapa ondulada: a onda de 8 texels em quatro tons, a ferrugem escorrendo das emendas
        a = uu % 8
        z = ZINCO[(_h(uu // 32, 4.4) * 3).astype(int) % 3]
        z = _w(a == 0, _tom(z, 1.14), z)
        z = _w((a == 1) | (a == 7), _tom(z, 1.05), z)
        z = _w((a == 4), _tom(z, 0.8), z)
        z = _w((a == 3) | (a == 5), _tom(z, 0.9), z)
        fer = (_h(uu // 8, 5.7) < 0.22) & (v < 100 + (_h(uu // 8, 6.1) * 30).astype(int)) & ((a == 3) | (a == 4))
        z = _w(fer, hx('#7a5a3e'), z)
        z = _w((uu % 32 == 31), _tom(z, 0.72), z)
        # a terça (v 120) com os parafusos
        z = _w(v == 120, _tom(z, 0.82), z)
        z = _w((v == 121) & (a == 4), hx('#5a5e60'), z)
        out = _w(v >= 100, z, out)
        out = _w(v > 138, _tom(out, 0.86), out)
        return out
    return emissivo(f)


ESTILOS = {
    'galpao': {'piso': piso_galpao, 'parede': com_rodape(parede_galpao, ('#5a5a56', '#6e6e69')), 'rodape': None, 'extra': None},
}


# =====================================================================================================================
# a estante vazia
# =====================================================================================================================
def estante_vazia():
    """A estante de aço vazia (2 x 1, 2,2 m): os quatro montantes de cantoneira furada e as cinco chapas, só a poeira."""
    x0, x1, y0, y1 = 0.04, 1.46, 0.06, 0.6
    h = 2.2
    AC = '#5a6068'
    for xx in (x0, x1 - 0.04):
        for yy in (y0, y1 - 0.04):
            caixa((xx, xx + 0.04, yy, yy + 0.04, 0.0, h), {'frente': emissivo(lambda L, n, P: np.where((np.floor(P[:, 2] / PH) % 4 == 0)[:, None], hx('#2a2e34'), np.tile(hx(AC), (len(P), 1)))), '*': ES.metal(AC)})
    for z in (0.08, 0.56, 1.04, 1.52, 2.0, h - 0.03):
        # a chapa de cima empoeirada (o cinza mais claro e fosco) e as marcas limpas de onde ficavam as caixas
        def poeira(L, n, P, z=z):
            out = np.tile(hx('#8a8e92'), (len(P), 1))
            limpo = (np.floor((P[:, 0] - x0) / 0.36) % 2 == 0) & (P[:, 1] > y0 + 0.08) & (P[:, 1] < y1 - 0.08) & (_h(np.floor((P[:, 0] - x0) / 0.36), z * 10, 3.3) < 0.5)
            return np.where(limpo[:, None], hx('#6e7378'), out)
        caixa((x0, x1, y0, y1, z, z + 0.03), {'cima': emissivo(poeira), '*': ES.metal('#6a7078')})
    peg(x0, x1, y0, y1)


ITENS = {
    'estante_vazia': (2, 1, (0.0, 0.0), estante_vazia, {}),
    # a escrivaninha sem os papéis e o tinteiro (o Felipe: "tira o papel da mesa")
    'mesa_vazia': (2, 1, (0.0, 0.0), lambda: CA.desk_wood(vazia=True), {}),
}
