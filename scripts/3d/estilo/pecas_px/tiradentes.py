"""
GRUPO TIRADENTES (15/10): a cidadezinha histórica de Minas Gerais da campanha "Segredos do Outro Lado", em pixel art
1:1 feita só por código, no acabamento dos prédios da fazenda (fazenda_fora.py) e da vila (vila_predios.py).

A referência são a ilha do mapa-múndi (client/public/arte/mapa/lugar-tiradentes-hd.png) e as duas chegadas
(client/public/arte/viagem/ilustracoes/chegada-tiradentes-1.png e -2.png): o casario colonial caiado de branco (e
alguns amarelos e rosados), as janelas e as portas pintadas (azul, verde, amarelo), os cunhais e as molduras
coloridas, o telhado de telha de barro, as ruas de pedra (o terreno de cascalho do jogo), o largo com o chafariz, o
coreto, os bancos e os postes de ferro, e a igreja barroca branca no alto, com as torres sineiras.

Tudo desenhado no giro 4 (a frente para +y), a pegada começando em (0, 0), no tamanho do catálogo (shared/src/furni.ts,
o bloco "TIRADENTES (15/10)": width x depth em casas de 0,75 m; o `height` de lá está em METROS). A porta dos prédios
fica na face da frente, com o meio na casa floor(width / 2) (o jogo põe a peça "entrada" na casa logo à frente).
Os prédios são fechados dos quatro lados. As fachadas conferem os vãos com o `_conferir_vaos` do vila_predios.py
(nenhuma janela com as folhas abertas em cima de porta ou de outra janela).

Estados: o poste de ferro 0 aceso / '1' apagado (a luz vem do cliente: kind luz_cristal).
"""
import math

import numpy as np

import cozinha as CZ
import base_estilo as BE
import fazenda_fora as FF
import vila_predios as VP
from base_estilo import hx, liso, mad2, tab2, vol, _tom, _poligono_rodado, _disco, PH, PZ
from motor import ruido, suave, emissivo, MUNDO as M

CASA = 0.75
obj = FF.obj
caixa = FF.caixa
pegada = FF.pegada
pegada_redonda = FF.pegada_redonda
_bx = FF._bx

# o canvas do exportador reserva 4,6 m de alto: os prédios altos daqui usam o mesmo remendo do vila_predios
VP.ALTO_CANVAS.update({'igreja_barroca': 10.2, 'pousada_predio': 8.0, 'venda_predio': 5.6, 'boteco_predio': 5.4,
                       'casa_colonial': 5.4, 'casa_colonial~b': 5.4, 'casa_colonial~c': 5.4, 'casa_colonial~d': 5.4,
                       'coreto': 5.0})

# ---------------------------------------------------------------- a paleta de Tiradentes
CAIADA = '#efe9dc'          # a parede caiada
AMARELA = '#ecd08a'
ROSADA = '#e9b9a6'
AZUL = '#2f6194'
VERDE = '#2f7452'
AMARELO = '#d6a532'
SANGUE = '#8e3426'          # o vermelho "sangue de boi" das portas antigas
BRANCO_M = '#f4f0e6'        # a moldura branca (nas casas coloridas)
TELHA = ['#b4562f', '#bd6038', '#a94e2b', '#c26a3e']
TELHA_J = '#5a2414'
CUMEEIRA = '#9a4428'
CANTARIA = ['#cfae72', '#c4a266', '#d6b77c', '#bc9a5e']   # a pedra-sabão / cantaria das igrejas (ocre)
CANTARIA_J = '#8a6a3c'
FERRO = '#1f2024'


def _hex(c):
    return '#%02x%02x%02x' % tuple(np.clip(np.round(np.asarray(c, float)), 0, 255).astype(int))


def _escuro(cor, k=0.72):
    return _hex(_tom(hx(cor), k))


def _porta_x(W):
    return (W // 2 + 0.5) * CASA


def mat_cal(cor=CAIADA, seed=0, sujeira=0.32):
    """A parede caiada (as manchas grandes do reboco e a sujeira que sobe do chão), do kit da fazenda."""
    return FF.mat_reboco(cor, seed=seed, sujeira=sujeira)


def mat_cantaria(seed=0, alt=0.3, comp=0.45):
    return FF.mat_juntas(list(CANTARIA), FF.id_pedras_parede(alt, comp, seed=seed), CANTARIA_J, seed=seed + 3)


# =====================================================================================================================
# a fachada colonial: o barrado, os cunhais, a cimalha, as janelas de veneziana e as portas de almofada
# =====================================================================================================================
def _conferir(vaos, z0):
    """Os vãos de um andar pelo conferir do vila_predios (a porta com a moldura larga: 0,1 m a mais de cada lado)."""
    VP._conferir_vaos({f: [v if v[0] == 'j' else ('p', v[1], v[2] + 0.2, v[3], v[4], v[5]) for v in l] for f, l in vaos.items()}, z0)


def _cortes(vaos):
    """Onde o barrado se abre: as portas de cada face."""
    out = {}
    for f, l in vaos.items():
        out[f] = [(v[1] - v[2] / 2 - 0.09, v[1] + v[2] / 2 + 0.09) for v in l if v[0] == 'p']
    return out


def _faixa(B, z0, z1, mat, e=0.025, cortes=None, o=None):
    """Uma faixa em volta do corpo (o barrado, a cimalha), aberta nas portas."""
    X0, X1, Y0, Y1 = B
    cortes = cortes or {}
    o = obj() if o is None else o
    for face, (plano, l0, l1) in {'+y': (Y1, X0 - e, X1 + e), '-y': (Y0, X0 - e, X1 + e), '+x': (X1, Y0, Y1), '-x': (X0, Y0, Y1)}.items():
        x = l0
        for (a0, a1) in sorted(cortes.get(face, [])):
            if a0 - x > 1e-3:
                CZ.c.caixa(_bx(face, plano, x, a0, 0.0, e, z0, z1), mat, M, o)
            x = a1
        if l1 - x > 1e-3:
            CZ.c.caixa(_bx(face, plano, x, l1, 0.0, e, z0, z1), mat, M, o)
    return o


def _cunhais(B, z0, z1, cor, larg=0.17, e=0.03):
    """Os cunhais: a pilastra lisa e colorida nas quatro quinas (as duas faces de cada quina)."""
    X0, X1, Y0, Y1 = B
    XM, YM = (X0 + X1) / 2, (Y0 + Y1) / 2
    m = {'*': liso(cor), 'cima': liso(_hex(_tom(hx(cor), 1.1)))}
    for (xa, ya) in ((X0, Y0), (X1, Y0), (X0, Y1), (X1, Y1)):
        sx = 1 if xa > XM else -1
        sy = 1 if ya > YM else -1
        caixa((min(xa, xa - sx * larg), max(xa, xa - sx * larg), min(ya, ya + sy * e), max(ya, ya + sy * e), z0, z1), m)
        caixa((min(xa, xa + sx * e), max(xa, xa + sx * e), min(ya, ya - sy * larg), max(ya, ya - sy * larg), z0, z1), m)


def _vaos(B, z0, vaos, pal):
    """
    As janelas e as portas de um andar (o formato do vila_predios: ('j', a, zj, w, h, acesa, folhas) e
    ('p', a, w, h, folhas, postigo)), no jeito colonial: a veneziana e a moldura pintadas, o vidro escuro ou aceso.
    """
    _conferir(vaos, z0)
    for face, lista in vaos.items():
        for v in lista:
            if v[0] == 'j':
                _, a, zj, w, h, acesa, folhas = v
                FF.janela(B, face, a, zj, w, h, kind='aceso' if acesa else 'escuro', venez=pal['venez'] if folhas else None,
                          moldura=pal['moldura'], cruz=True, peitoril=True)
            else:
                _, a, w, h, folhas, aberta = v
                if aberta:
                    _porta_aberta(B, face, a, z0, w, h, pal)
                else:
                    FF.porta(B, face, a, z0, w, h, pal['porta'], folhas=folhas, moldura=pal['moldura'])


def _porta_aberta(B, face, a, z0, w, h, pal):
    """A porta aberta para dentro (a venda, o boteco): o batente, a verga e o vão com a luz morna de dentro."""
    p = FF._plano(B, face)
    bx = lambda l0, l1, e0, e1, za, zb: _bx(face, p, l0, l1, e0, e1, za, zb)
    a0, a1 = a - w / 2, a + w / 2
    z1 = z0 + h
    m = liso(pal['moldura'])
    caixa(bx(a0 - 0.08, a0, 0, 0.06, z0, z1 + 0.1), m)
    caixa(bx(a1, a1 + 0.08, 0, 0.06, z0, z1 + 0.1), m)
    caixa(bx(a0 - 0.14, a1 + 0.14, 0, 0.1, z1 + 0.1, z1 + 0.2), m)
    ov = obj(contorno=False)
    CZ.luzes.add(ov)
    lat = 0 if face[1] == 'y' else 1

    def vao(L, n, P):
        u = (P[:, lat] - a0) / w
        v = (P[:, 2] - z0) / h
        # o escuro de dentro: o chão de tábua, o balcão lá no fundo, as garrafas na prateleira e a lâmpada acesa
        out = np.tile(hx('#22180f'), (len(P), 1))
        out = np.where((v < 0.12)[:, None], hx('#4a3422'), out)
        balcao = (v >= 0.12) & (v < 0.42) & (u > 0.18) & (u < 0.82)
        out = np.where(balcao[:, None], hx('#5e4026'), out)
        out = np.where((balcao & (v >= 0.39))[:, None], hx('#86603a'), out)
        garrafa = (v > 0.54) & (v < 0.67) & ((np.floor(u / 0.07) % 2) == 0) & (u > 0.2) & (u < 0.8)
        out = np.where(garrafa[:, None], hx('#3e5a40'), out)
        out = np.where(((v > 0.5) & (v < 0.53) & (u > 0.18) & (u < 0.82))[:, None], hx('#4a3220'), out)
        out = np.where(((np.abs(u - 0.5) < 0.12) & (np.abs(v - 0.84) < 0.07))[:, None], hx('#4a3018'), out)
        out = np.where(((np.abs(u - 0.5) < 0.05) & (np.abs(v - 0.84) < 0.03))[:, None], hx('#f2c878'), out)
        # as folhas abertas para dentro: as duas faixas da cor da porta nos lados do vão
        lado = (u < 0.13) | (u > 0.87)
        out = np.where(lado[:, None], hx(_escuro(pal['porta'], 0.62)), out)
        out = np.where((((u >= 0.1) & (u < 0.13)) | ((u > 0.87) & (u <= 0.9)))[:, None], hx(_escuro(pal['porta'], 0.42)), out)
        return out
    CZ.c.caixa(bx(a0, a1, -0.03, 0.005, z0, z1), emissivo(vao), M, ov)


def _corpo(B, z0, z1, mat_parede, pal, vaos, barrado=0.45, cimalha=True):
    """O corpo caiado de um andar térreo, o barrado (aberto nas portas), os cunhais e a cimalha embaixo do beiral."""
    X0, X1, Y0, Y1 = B
    caixa((X0, X1, Y0, Y1, z0, z1), mat_parede)
    if barrado:
        _faixa(B, 0.0, barrado, {'*': liso(pal['barrado']), 'cima': liso(_hex(_tom(hx(pal['barrado']), 1.12)))}, e=0.02, cortes=_cortes(vaos))
    _cunhais(B, barrado or 0.0, z1 - 0.3, pal['cunhal'])
    if cimalha:
        # a cimalha fica embaixo do beiral (a ponta dela não pode furar a telha)
        _faixa(B, z1 - 0.3, z1 - 0.12, {'*': liso(BRANCO_M), 'cima': liso('#fbf8f0')}, e=0.06)


def _telhado(B, ZE, ZR, BEI=0.36, eixo='x', seed=0, parede=None):
    """O telhado de duas águas de telha de barro (capa e canal), com o beiral largo do colonial."""
    X0, X1, Y0, Y1 = B
    if eixo == 'x':
        YR = (Y0 + Y1) / 2
        KT = (ZR - ZE) / (YR - Y0)
        perfil = [(Y0 - BEI, ZE - BEI * KT), (YR, ZR), (Y1 + BEI, ZE - BEI * KT)]
        FF.telhado(X0, X1, Y0, Y1, perfil, 'x', TELHA, TELHA_J, parede, testeira='#efe8da', cumeeira=CUMEEIRA, seed=seed,
                   beiral_u=0.3)
    else:
        XR = (X0 + X1) / 2
        KT = (ZR - ZE) / (XR - X0)
        perfil = [(X0 - BEI, ZE - BEI * KT), (XR, ZR), (X1 + BEI, ZE - BEI * KT)]
        FF.telhado(Y0, Y1, X0, X1, perfil, 'y', TELHA, TELHA_J, parede, testeira='#efe8da', cumeeira=CUMEEIRA, seed=seed,
                   beiral_u=0.3)
    return perfil


def _vaso(x, y, z=0.0, r=0.17, h=0.3, flores=('#d42a36', '#f8d060'), seed=0, pal=None):
    """O vaso de barro com a planta florida (a buganvília vermelha das calçadas de Tiradentes)."""
    o = obj()
    _poligono_rodado(x, y, [(z, r * 0.74), (z + h - 0.05, r), (z + h - 0.05, r * 1.1), (z + h, r * 1.1)], vol(x, y, '#b0623e'), o, lados=16)
    _disco(x, y, z + h, r * 1.02, liso('#4a2e1c'), o, lados=16)
    ob = obj()
    rr = r * 1.45
    m = FF.mat_folha((x, y, z + h + rr * 0.7), (rr * 1.3, rr * 1.3, rr * 1.1), pal or FF.FOLHA_PAL, q=0.055, seed=seed + 3, flores=flores)
    rng = np.random.default_rng(seed + 40)
    FF._cachos(ob, x, y, z + h + rr * 0.55, rr * 0.9, rr * 0.7, 16, rr * 0.22, rr * 0.36, rng, m, corte=z + h - 0.02)
    pegada_redonda(x, y, r * 1.2, 5)


# ---------------------------------------------------------------- as cores de cada casa
PAL_CASA = {
    'a': {'parede': CAIADA, 'venez': AZUL, 'moldura': AZUL, 'porta': AZUL, 'barrado': '#3a5f86', 'cunhal': AZUL},
    'b': {'parede': CAIADA, 'venez': VERDE, 'moldura': VERDE, 'porta': VERDE, 'barrado': '#3a6a50', 'cunhal': VERDE},
    'c': {'parede': AMARELA, 'venez': AZUL, 'moldura': BRANCO_M, 'porta': AZUL, 'barrado': '#9a7a3a', 'cunhal': BRANCO_M},
    'd': {'parede': ROSADA, 'venez': VERDE, 'moldura': BRANCO_M, 'porta': VERDE, 'barrado': '#8a5a4a', 'cunhal': BRANCO_M},
}


# =====================================================================================================================
# a casa colonial (7 x 5 casas, 4,6 m): a casinha térrea do casario, a porta e duas janelas na frente
# =====================================================================================================================
def _casa_colonial(v='a'):
    pal = PAL_CASA[v]
    W, D = 7 * CASA, 5 * CASA
    X0, X1, Y0, Y1 = 0.25, W - 0.25, 0.3, D - 0.45
    B = (X0, X1, Y0, Y1)
    XP = _porta_x(7)
    YM = (Y0 + Y1) / 2
    ZE, ZR = 3.35, 4.55
    PAR = mat_cal(pal['parede'], seed=ord(v))
    acesa = v in ('a', 'c')
    vaos = {
        '+y': [('p', XP, 0.95, 2.15, 2, False), ('j', X0 + 0.95, 0.95, 0.62, 1.2, acesa, True), ('j', X1 - 0.95, 0.95, 0.62, 1.2, False, True)],
        '-y': [('j', X0 + 1.2, 1.0, 0.6, 1.1, False, True), ('j', X1 - 1.2, 1.0, 0.6, 1.1, v == 'b', True)],
        '+x': [('j', YM, 1.0, 0.56, 1.1, False, v != 'd')],
        '-x': [('j', YM, 1.0, 0.56, 1.1, v == 'd', True)],
    }
    _corpo(B, 0.0, ZE, PAR, pal, vaos)
    _vaos(B, 0.12, vaos, pal)
    VP._degraus('+y', Y1, XP, 1.25, 0.12, n=1, prof=0.2)
    _telhado(B, ZE, ZR, seed=ord(v), parede=PAR)
    # o vaso de flor do lado da porta (nas casas a e c) e a planta encostada na outra
    if v in ('a', 'c'):
        _vaso(XP + 0.85, Y1 + 0.22, seed=ord(v))
    else:
        _vaso(X0 + 0.25, Y1 + 0.22, r=0.14, h=0.26, flores=('#f2f0e8', '#f0c850'), seed=ord(v))
    pegada(X0, X1, Y0, Y1)


# =====================================================================================================================
# a pousada (9 x 6 casas, 7,4 m): o sobrado colonial de dois andares, as portas-janelas com as sacadas de ferro em cima
# e a tábua da chave pendurada embaixo da sacada do meio
# =====================================================================================================================
def _sacada(B, face, a, z, w, fundo=0.34):
    """A sacada de ferro de uma porta-janela: a laje fina de pedra com a mísula e o guarda-corpo de barras."""
    p = FF._plano(B, face)
    bx = lambda l0, l1, e0, e1, za, zb: _bx(face, p, l0, l1, e0, e1, za, zb)
    a0, a1 = a - w / 2, a + w / 2
    caixa(bx(a0, a1, 0, fundo, z - 0.08, z), {'*': liso('#c8bca4'), 'cima': liso('#d6ccb6')})
    caixa(bx(a0 + 0.12, a1 - 0.12, 0, fundo * 0.6, z - 0.2, z - 0.08), liso('#b8ac94'))
    o = obj()
    zc = z + 0.92
    fe = liso(FERRO)
    CZ.c.caixa(bx(a0, a1, fundo - 0.04, fundo, zc - 0.04, zc), fe, M, o)
    CZ.c.caixa(bx(a0, a1, fundo - 0.03, fundo - 0.01, z + 0.12, z + 0.15), fe, M, o)
    for (l0, l1) in ((a0, a0 + 0.04), (a1 - 0.04, a1)):
        CZ.c.caixa(bx(l0, l1, 0.0, fundo, zc - 0.04, zc), fe, M, o)
        CZ.c.caixa(bx(l0, l1, 0.0, 0.04, z, zc), fe, M, o)
    ob = obj(contorno=False)
    for l in np.arange(a0 + 0.07, a1 - 0.05, 0.095):
        CZ.c.caixa(bx(l, l + PH * 1.2, fundo - 0.03, fundo - 0.01, z, zc - 0.04), fe, M, ob)
    for k in range(1, 3):
        e = fundo * k / 3
        for (l0, l1) in ((a0, a0 + PH * 1.2), (a1 - PH * 1.2, a1)):
            CZ.c.caixa(bx(l0, l1, e, e + 0.02, z, zc - 0.04), fe, M, ob)


def _pousada():
    pal = {'parede': CAIADA, 'venez': AZUL, 'moldura': AZUL, 'porta': AZUL, 'barrado': '#3a5f86', 'cunhal': AZUL}
    W, D = 9 * CASA, 6 * CASA
    X0, X1, Y0, Y1 = 0.25, W - 0.25, 0.3, D - 0.6
    B = (X0, X1, Y0, Y1)
    XP = _porta_x(9)
    YM = (Y0 + Y1) / 2
    ZF, ZE, ZR = 3.2, 6.15, 7.35
    PAR = mat_cal(seed=21)
    xs = (X0 + 0.95, X1 - 0.95)
    vaos1 = {
        '+y': [('p', XP, 1.15, 2.3, 2, False)] + [('j', x, 0.95, 0.64, 1.25, k == 0, True) for k, x in enumerate(xs)],
        '-y': [('j', x, 1.0, 0.62, 1.15, k == 1, True) for k, x in enumerate((X0 + 1.2, XP, X1 - 1.2))],
        '+x': [('j', YM, 1.0, 0.6, 1.15, True, True)],
        '-x': [('j', YM, 1.0, 0.6, 1.15, False, True)],
    }
    _corpo(B, 0.0, ZF, PAR, pal, vaos1, cimalha=False)
    _vaos(B, 0.12, vaos1, pal)
    # a faixa branca entre os andares
    _faixa(B, ZF - 0.08, ZF + 0.1, {'*': liso(BRANCO_M), 'cima': liso('#fbf8f0')}, e=0.05)
    # o andar de cima: as três portas-janelas da frente com a sacada, as janelas dos lados e de trás
    z2 = ZF + 0.32
    vaos2 = {
        '+y': [('j', x, z2, 0.64, 1.75, k != 1, True) for k, x in enumerate((xs[0], XP, xs[1]))],
        '-y': [('j', x, z2 + 0.25, 0.62, 1.2, k == 0, True) for k, x in enumerate((X0 + 1.2, XP, X1 - 1.2))],
        '+x': [('j', YM, z2 + 0.25, 0.6, 1.2, False, True)],
        '-x': [('j', YM, z2 + 0.25, 0.6, 1.2, True, True)],
    }
    caixa((X0, X1, Y0, Y1, ZF + 0.1, ZE), PAR)
    _cunhais(B, ZF + 0.1, ZE - 0.3, pal['cunhal'])
    _faixa(B, ZE - 0.3, ZE - 0.12, {'*': liso(BRANCO_M), 'cima': liso('#fbf8f0')}, e=0.06)
    _vaos(B, ZF, vaos2, pal)
    for x in (xs[0], XP, xs[1]):
        _sacada(B, '+y', x, z2 - 0.06, 0.95)
    VP._degraus('+y', Y1, XP, 1.5, 0.12, n=1, prof=0.22)
    _telhado(B, ZE, ZR, seed=22, parede=PAR)
    # a tábua da pousada (a chave dourada pintada) pendurada embaixo da sacada do meio, e o lampião da porta
    VP._placa_chave(XP, Y1 + 0.26, z2 - 0.16)
    FF._lampiao(XP + 0.95, Y1, 1.6)
    _vaso(X0 + 0.3, Y1 + 0.22, seed=5)
    _vaso(X1 - 0.3, Y1 + 0.22, seed=6, flores=('#f07ab0', '#f8e070'))
    pegada(X0, X1, Y0, Y1)


# =====================================================================================================================
# a venda (9 x 5 casas, 4,8 m): o armazém de secos e molhados, as duas portas largas abertas, a tabuleta pintada em
# cima e as sacas e o caixote na calçada
# =====================================================================================================================
def _tabuleta(face_plano, x0, x1, z0, z1, desenho, cor='#e8dcc0', borda='#6a3a22'):
    """A tabuleta pintada presa na fachada da frente (+y): a tábua clara com a borda e o desenho (sem letras)."""
    def m(L, n, P):
        u = (P[:, 0] - x0) / (x1 - x0)
        v = (P[:, 2] - z0) / (z1 - z0)
        out = np.tile(hx(cor), (len(P), 1))
        out = np.where(((u < 0.035) | (u > 0.965) | (v < 0.12) | (v > 0.88))[:, None], hx(borda), out)
        return desenho(u, v, out)
    caixa((x0, x1, face_plano, face_plano + 0.04, z0, z1), {'*': emissivo(m), 'cima': liso(borda)})


def _desenho_venda(u, v, out):
    """O pão, a garrafa e a saca (o "secos e molhados" sem letra nenhuma), em cores chapadas."""
    # a saca de juta à esquerda (com a boca amarrada)
    du, dv = (u - 0.2) / 0.1, (v - 0.44) / 0.28
    saca = (du * du + dv * dv < 1.0) | ((np.abs(u - 0.2) < 0.03) & (v > 0.68) & (v < 0.76))
    out = np.where(saca[:, None], hx('#b89458'), out)
    out = np.where((saca & (u < 0.17))[:, None], hx('#caa868'), out)
    # a garrafa no meio (o corpo, o ombro, o gargalo)
    gar = ((np.abs(u - 0.5) < 0.045) & (v > 0.2) & (v < 0.58)) | ((np.abs(u - 0.5) < 0.018) & (v >= 0.58) & (v < 0.8))
    out = np.where(gar[:, None], hx('#3e6a46'), out)
    out = np.where((gar & (u < 0.485))[:, None], hx('#5e8a62'), out)
    # o pão (o filão) à direita, com os cortes
    du, dv = (u - 0.79) / 0.13, (v - 0.42) / 0.17
    pao = du * du + dv * dv < 1.0
    out = np.where(pao[:, None], hx('#c8843e'), out)
    cortes = pao & (np.abs(((u - 0.72) / 0.05) % 1 - 0.5) < 0.12) & (v > 0.42)
    return np.where(cortes[:, None], hx('#8a5428'), out)


def _desenho_boteco(u, v, out):
    """A garrafa de cachaça e o copo americano (sem letra nenhuma)."""
    gar = ((np.abs(u - 0.36) < 0.07) & (v > 0.18) & (v < 0.6)) | ((np.abs(u - 0.36) < 0.025) & (v >= 0.6) & (v < 0.84))
    out = np.where(gar[:, None], hx('#c08a3a'), out)
    out = np.where((gar & (u < 0.33))[:, None], hx('#e0b05a'), out)
    rot = (np.abs(u - 0.36) < 0.07) & (v > 0.3) & (v < 0.44)
    out = np.where(rot[:, None], hx('#f0e6d0'), out)
    copo = (np.abs(u - 0.64) < 0.07 - (0.6 - v) * 0.04) & (v > 0.2) & (v < 0.56)
    out = np.where(copo[:, None], hx('#c8d8d8'), out)
    out = np.where((copo & (v < 0.42))[:, None], hx('#d8a040'), out)
    out = np.where((copo & (np.abs(((v - 0.2) / 0.06) % 1 - 0.5) < 0.12))[:, None], hx('#a8b8b8'), out)
    return out


def _venda():
    pal = {'parede': CAIADA, 'venez': VERDE, 'moldura': VERDE, 'porta': VERDE, 'barrado': '#3a6a50', 'cunhal': VERDE}
    W, D = 9 * CASA, 5 * CASA
    X0, X1, Y0, Y1 = 0.25, W - 0.25, 0.3, D - 0.5
    B = (X0, X1, Y0, Y1)
    XP = _porta_x(9)
    YM = (Y0 + Y1) / 2
    ZE, ZR = 3.8, 4.75
    PAR = mat_cal(seed=31)
    X2 = X1 - 1.2
    vaos = {
        '+y': [('p', XP, 1.1, 2.15, 2, True), ('p', X2, 1.0, 2.15, 2, True), ('j', X0 + 1.05, 0.95, 0.6, 1.25, True, True)],
        '-y': [('j', X0 + 1.3, 1.0, 0.6, 1.1, False, True), ('j', X1 - 1.3, 1.0, 0.6, 1.1, False, True), ('p', XP, 0.9, 2.1, 1, False)],
        '+x': [('j', YM, 1.0, 0.56, 1.1, False, True)],
        '-x': [('j', YM, 1.0, 0.56, 1.1, True, True)],
    }
    _corpo(B, 0.0, ZE, PAR, pal, vaos)
    _vaos(B, 0.12, vaos, pal)
    for x in (XP, X2):
        VP._degraus('+y', Y1, x, 1.35, 0.12, n=1, prof=0.2)
    _telhado(B, ZE, ZR, seed=32, parede=PAR)
    # a tabuleta comprida em cima das portas
    _tabuleta(Y1 + 0.06, XP - 0.9, X2 + 0.75, 2.54, 3.12, _desenho_venda, cor='#2f5a40', borda='#e8dcc0')
    # as sacas, o caixote de frutas e a vassoura de piaçava na calçada
    FF._saco((X0 + 1.9, X0 + 2.25, Y1 + 0.06, Y1 + 0.38, 0.0, 0.5), seed=1)
    FF._saco((X0 + 2.25, X0 + 2.58, Y1 + 0.08, Y1 + 0.38, 0.0, 0.44), cor='#d0b886', seed=2)
    caixa((X1 - 0.45, X1 - 0.05, Y1 + 0.06, Y1 + 0.38, 0.0, 0.3), {'*': FF.mat_tabua_v(['#a87c4c', '#9a7044'], 0.08, '#4a3020', seed=3), 'cima': liso('#5a3a24')})
    o = obj()
    for k in range(5):
        BE.c.elipsoide((X1 - 0.38 + 0.07 * (k % 3), Y1 + 0.14 + 0.08 * (k // 3), 0.33), (0.045, 0.045, 0.04),
                       lambda Pc, N, P: FF._cru_eli(np.tile(hx('#e07a2a'), (len(P), 1)), N), o)
    pegada(X0, X1, Y0, Y1)


# =====================================================================================================================
# o boteco (7 x 5 casas, 4,6 m): a porta larga aberta (a luz de dentro), as janelas, a tabuleta da cachaça, o
# engradado de garrafas na calçada
# =====================================================================================================================
def _boteco():
    pal = {'parede': AMARELA, 'venez': SANGUE, 'moldura': BRANCO_M, 'porta': SANGUE, 'barrado': '#8a4a2e', 'cunhal': BRANCO_M}
    W, D = 7 * CASA, 5 * CASA
    X0, X1, Y0, Y1 = 0.25, W - 0.25, 0.3, D - 0.45
    B = (X0, X1, Y0, Y1)
    XP = _porta_x(7)
    YM = (Y0 + Y1) / 2
    ZE, ZR = 3.7, 4.55
    PAR = mat_cal(AMARELA, seed=41)
    vaos = {
        '+y': [('p', XP, 1.25, 2.15, 2, True), ('j', X0 + 0.85, 0.95, 0.55, 1.2, True, True), ('j', X1 - 0.85, 0.95, 0.55, 1.2, True, True)],
        '-y': [('j', X0 + 1.2, 1.0, 0.56, 1.1, False, True), ('j', X1 - 1.2, 1.0, 0.56, 1.1, True, True)],
        '+x': [('j', YM, 1.0, 0.56, 1.1, True, True)],
        '-x': [('j', YM, 1.0, 0.56, 1.1, False, True)],
    }
    _corpo(B, 0.0, ZE, PAR, pal, vaos)
    _vaos(B, 0.12, vaos, pal)
    VP._degraus('+y', Y1, XP, 1.55, 0.12, n=1, prof=0.2)
    _telhado(B, ZE, ZR, seed=42, parede=PAR)
    _tabuleta(Y1 + 0.06, XP - 0.68, XP + 0.68, 2.54, 3.06, _desenho_boteco, cor='#7a2a1e', borda='#f0e4c8')
    # o engradado de garrafas na calçada e o lampião da porta
    ex0, ey0 = X1 - 0.75, Y1 + 0.05
    caixa((ex0, ex0 + 0.42, ey0, ey0 + 0.32, 0.0, 0.26), {'*': liso('#c8302a'), 'cima': liso('#a82820')})
    for i in range(3):
        for j in range(2):
            gx, gy = ex0 + 0.08 + i * 0.13, ey0 + 0.09 + j * 0.14
            o = obj()
            BE.c.cilindro(gx, gy, 0.035, 0.26, 0.44, vol(gx, gy, '#5a3a1e', brilho=0.4), M, o, lados=12, tampa_mat=liso('#d8b060'))
    pegada(X0, X1, Y0, Y1)


# =====================================================================================================================
# a igreja barroca (13 x 10 casas, 9,6 m): a nave caiada, o frontispício com as duas torres sineiras, o frontão de
# curva com o óculo, a portada de cantaria em arco, as cúpulas de gomos, as cruzes e o adro de três degraus
# =====================================================================================================================
def _arco(face, plano, a, zc, r0, r1, e0, e1, mat, o, n=12):
    """O arco (meio anel) na fachada: os gomos entre os raios r0 e r1 em volta de (a, zc), saindo de e0 a e1."""
    for k in range(n):
        t0 = math.pi * k / n
        t1 = math.pi * (k + 1) / n
        q = [(a + r0 * math.cos(t0), zc + r0 * math.sin(t0)), (a + r1 * math.cos(t0), zc + r1 * math.sin(t0)),
             (a + r1 * math.cos(t1), zc + r1 * math.sin(t1)), (a + r0 * math.cos(t1), zc + r0 * math.sin(t1))]
        CZ.c.face_plana([VP._P(face, plano, l, e1, z) for (l, z) in q], VP._N(face), mat, M, o)
        # a espessura de cima do gomo (a face que olha para fora do arco)
        tm = (t0 + t1) / 2
        sg = 1.0 if face[0] == '+' else -1.0
        nrm = (math.cos(tm) * (1 if face[1] == 'y' else 0), 0.0 if face[1] == 'y' else math.cos(tm), math.sin(tm))
        pts = [VP._P(face, plano, a + r1 * math.cos(t0), e0, zc + r1 * math.sin(t0)), VP._P(face, plano, a + r1 * math.cos(t1), e0, zc + r1 * math.sin(t1)),
               VP._P(face, plano, a + r1 * math.cos(t1), e1, zc + r1 * math.sin(t1)), VP._P(face, plano, a + r1 * math.cos(t0), e1, zc + r1 * math.sin(t0))]
        CZ.c.face_plana(pts, nrm, mat, M, o)


def _meio_disco(face, plano, a, zc, r, e, mat, o, n=14):
    pts = [VP._P(face, plano, a + r * math.cos(math.pi * k / n), e, zc + r * math.sin(math.pi * k / n)) for k in range(n + 1)]
    CZ.c.face_plana(pts, VP._N(face), mat, M, o)


def _disco_fachada(face, plano, a, zc, r, e, mat, o, n=18):
    pts = [VP._P(face, plano, a + r * math.cos(2 * math.pi * k / n), e, zc + r * math.sin(2 * math.pi * k / n)) for k in range(n)]
    CZ.c.face_plana(pts, VP._N(face), mat, M, o)


def _sino(cx, cy, z, r=0.2):
    """O sino de bronze pendurado na sineira (o corpo em sino, a boca mais larga, a alça)."""
    o = obj()
    _poligono_rodado(cx, cy, [(z, r), (z + 0.06, r * 0.92), (z + 0.2, r * 0.66), (z + 0.32, r * 0.55), (z + 0.36, r * 0.3)],
                     vol(cx, cy, '#a8802e', brilho=0.5), o, lados=16, tampa_mat=liso('#8a6626'))
    caixa((cx - 0.02, cx + 0.02, cy - 0.02, cy + 0.02, z + 0.36, z + 0.5), liso('#3a3028'))


def _cupula(cx, cy, z0, R, H, cor='#d6ae5e', gomos=8):
    """A cúpula de gomos (o coruchéu da torre): o bulbo cortado no pé, as nervuras, o lanternim e a cruz de ferro."""
    base = hx(cor)

    def m(Pc, N, P):
        th = np.arctan2(P[:, 1] - cy, P[:, 0] - cx)
        g = (th / (2 * math.pi) * gomos) % 1
        out = np.tile(base, (len(P), 1))
        out = np.where((g < 0.12)[:, None], _tom(base, 0.78), out)
        out = np.where(((g >= 0.12) & (g < 0.3))[:, None], _tom(base, 1.06), out)
        return FF._cru_eli(out, N)
    CZ.c.elipsoide((cx, cy, z0 + H * 0.2), (R, R, H * 0.8), m, obj(), corte_z=z0)
    zt = z0 + H
    CZ.c.cilindro(cx, cy, 0.08, zt - 0.08, zt + 0.16, vol(cx, cy, cor), M, obj(), lados=8, tampa_mat=liso(cor))
    CZ.c.elipsoide((cx, cy, zt + 0.21), (0.065, 0.065, 0.06), lambda Pc, N, P: FF._cru_eli(np.tile(hx('#b89040'), (len(P), 1)), N), obj())
    fe = liso(FERRO)
    caixa((cx - 0.02, cx + 0.02, cy - 0.02, cy + 0.02, zt + 0.24, zt + 0.78), fe)
    caixa((cx - 0.16, cx + 0.16, cy - 0.02, cy + 0.02, zt + 0.55, zt + 0.59), fe)


def _torre_sineira(X0, X1, Y0, Y1, ZC, ZS, seed=0):
    """
    Uma torre: o corpo caiado com o embasamento e os cunhais de cantaria, a janelinha em arco, a cornija na altura da
    da nave (ZC), a sineira (o vão em arco nas quatro faces, o sino), a cornija de cima (ZS) e a cúpula.
    """
    B = (X0, X1, Y0, Y1)
    PAR = mat_cal(seed=seed + 50, sujeira=0.0)
    caixa((X0, X1, Y0, Y1, 0.6, ZS), PAR)
    caixa((X0 - 0.04, X1 + 0.04, Y0 - 0.04, Y1 + 0.04, 0.0, 0.6), mat_cantaria(seed=seed + 1, alt=0.3, comp=0.5))
    _cunhais(B, 0.6, ZS, CANTARIA[0], larg=0.2, e=0.04)
    for (za, zb, e) in ((ZC - 0.3, ZC - 0.06, 0.1), (ZS - 0.2, ZS, 0.12)):
        caixa((X0 - e, X1 + e, Y0 - e, Y1 + e, za, zb), {'*': liso(CANTARIA[0]), 'cima': liso(CANTARIA[2])})
    XM, YM = (X0 + X1) / 2, (Y0 + Y1) / 2
    escuro = liso('#2a2224')
    for face in ('+y', '+x', '-x', '-y'):
        plano = FF._plano(B, face)
        a = XM if face[1] == 'y' else YM
        bx = lambda l0, l1, e0, e1, za, zb, face=face, plano=plano: _bx(face, plano, l0, l1, e0, e1, za, zb)
        # a janelinha do corpo, com a verga em arco
        if face != '-y':
            ov = obj(contorno=False)
            CZ.c.caixa(bx(a - 0.2, a + 0.2, -0.02, 0.006, 3.1, 3.8), liso('#2a2e36'), M, ov)
            _meio_disco(face, plano, a, 3.8, 0.2, 0.006, liso('#2a2e36'), ov)
            o = obj()
            for (l0, l1) in ((a - 0.3, a - 0.2), (a + 0.2, a + 0.3)):
                CZ.c.caixa(bx(l0, l1, 0, 0.05, 3.1, 3.8), liso(CANTARIA[0]), M, o)
            CZ.c.caixa(bx(a - 0.34, a + 0.34, 0, 0.07, 3.0, 3.1), liso(CANTARIA[1]), M, o)
            _arco(face, plano, a, 3.8, 0.2, 0.3, 0.0, 0.05, liso(CANTARIA[0]), o)
        # a sineira: o vão em arco (o escuro de dentro) com a moldura de cantaria e o gradil baixo
        za, zr = ZC + 0.1, ZS - 0.55
        w = ((X1 - X0) if face[1] == 'y' else (Y1 - Y0)) * 0.26
        ov = obj(contorno=False)
        CZ.c.caixa(bx(a - w, a + w, -0.02, 0.006, za, zr), escuro, M, ov)
        _meio_disco(face, plano, a, zr, w, 0.006, escuro, ov)
        o2 = obj()
        for (l0, l1) in ((a - w - 0.1, a - w), (a + w, a + w + 0.1)):
            CZ.c.caixa(bx(l0, l1, 0, 0.05, za, zr), liso(CANTARIA[0]), M, o2)
        _arco(face, plano, a, zr, w, w + 0.1, 0.0, 0.05, liso(CANTARIA[0]), o2)
        fe = liso(FERRO)
        og = obj(contorno=False)
        CZ.c.caixa(bx(a - w, a + w, 0.01, 0.03, za + 0.4, za + 0.44), fe, M, og)
        for l in np.arange(a - w + 0.06, a + w - 0.02, 0.1):
            CZ.c.caixa(bx(l, l + PH * 1.2, 0.01, 0.03, za, za + 0.4), fe, M, og)
        # o sino pendurado no vão (meio para fora da parede: o vão é desenhado na face)
        bxp, byp, _ = VP._P(face, plano, a, -0.02, 0.0)
        _sino(bxp, byp, zr - 0.62, r=0.17)
    _cupula(XM, YM, ZS, (X1 - X0) * 0.44, 1.05)


def _frontao(XC, Y0, Y1, z0, larg, alto, mat, o):
    """O frontão de curva: o recorte (z = z0 + alto · (1 − t²)^0,6), a frente, as costas e a espessura de cima."""
    n = 16
    pts = [(XC + larg * (2 * k / n - 1), z0 + alto * max(0.0, 1 - (2 * k / n - 1) ** 2) ** 0.6) for k in range(n + 1)]
    c = CZ.c
    c.face_plana([(x, Y1, z) for (x, z) in pts], (0, 1, 0), mat, M, o)
    c.face_plana([(x, Y0, z) for (x, z) in pts[::-1]], (0, -1, 0), mat, M, o)
    for (xa, za), (xb, zb) in zip(pts[:-1], pts[1:]):
        dx, dz = xb - xa, zb - za
        ln = math.hypot(dx, dz)
        c.face_plana([(xa, Y0, za), (xb, Y0, zb), (xb, Y1, zb), (xa, Y1, za)], (-dz / ln, 0.0, dx / ln), mat, M, o)
    return pts


def _janela_arco(face, plano, a, z0, z1, w, acesa=False, eixo_lat=0):
    """A janela alta da igreja: o vidro com a verga em arco, as ombreiras, o peitoril e o arco de cantaria."""
    ov = obj(contorno=not acesa)
    if acesa:
        CZ.luzes.add(ov)
    CZ.c.caixa(_bx(face, plano, a - w / 2, a + w / 2, -0.02, 0.006, z0, z1), FF.mat_vidro('aceso' if acesa else 'escuro', eixo_lat, a - w / 2, a + w / 2, z0, z1), M, ov)
    _meio_disco(face, plano, a, z1, w / 2, 0.006, liso('#f6a94e' if acesa else '#2c3c48'), ov)
    o = obj()
    for (l0, l1) in ((a - w / 2 - 0.12, a - w / 2), (a + w / 2, a + w / 2 + 0.12)):
        CZ.c.caixa(_bx(face, plano, l0, l1, 0, 0.05, z0 - 0.08, z1), liso(CANTARIA[0]), M, o)
    CZ.c.caixa(_bx(face, plano, a - w / 2 - 0.18, a + w / 2 + 0.18, 0, 0.09, z0 - 0.18, z0 - 0.08), liso(CANTARIA[1]), M, o)
    _arco(face, plano, a, z1, w / 2, w / 2 + 0.12, 0.0, 0.05, liso(CANTARIA[0]), o)


def _igreja():
    W, D = 13 * CASA, 10 * CASA
    XC = _porta_x(13)
    # a nave
    NX0, NX1, NY0, NY1 = XC - 2.75, XC + 2.75, 0.25, 5.35
    ZE, ZR = 5.6, 7.35
    PAR = mat_cal(seed=61, sujeira=0.0)
    BN = (NX0, NX1, NY0, NY1)
    caixa((NX0, NX1, NY0, NY1, 0.6, ZE), PAR)
    caixa((NX0 - 0.04, NX1 + 0.04, NY0 - 0.04, NY1, 0.0, 0.6), mat_cantaria(seed=2, alt=0.3, comp=0.5))
    _cunhais(BN, 0.6, ZE - 0.3, CANTARIA[0], larg=0.22, e=0.04)
    caixa((NX0 - 0.08, NX1 + 0.08, NY0 - 0.08, NY1, ZE - 0.3, ZE - 0.1), {'*': liso(CANTARIA[0]), 'cima': liso(CANTARIA[2])})
    # as janelas altas da nave (duas de cada lado e a do fundo)
    for face in ('+x', '-x', '-y'):
        plano = FF._plano(BN, face)
        lista = (1.3, 2.95) if face[1] == 'x' else (XC,)
        for k, a in enumerate(lista):
            _janela_arco(face, plano, a, 2.7, 4.2, 0.62, acesa=(face == '-x' and k == 0), eixo_lat=1 if face[1] == 'x' else 0)
    # o telhado da nave (a cumeeira ao longo de y; o oitão da frente fica atrás do frontispício)
    KT = (ZR - ZE) / (XC - NX0)
    BEI = 0.38
    FF.telhado(NY0, NY1, NX0, NX1, [(NX0 - BEI, ZE - BEI * KT), (XC, ZR), (NX1 + BEI, ZE - BEI * KT)], 'y', TELHA, TELHA_J, PAR,
               testeira='#efe8da', cumeeira=CUMEEIRA, seed=62, beiral_u=0.3)
    # ---- o frontispício (o corpo da frente, entre as torres)
    FY0, FY1 = NY1 - 0.02, NY1 + 0.8
    FX0, FX1 = XC - 2.75, XC + 2.75
    caixa((FX0, FX1, FY0, FY1, 0.6, ZE), PAR)
    caixa((FX0, FX1, FY0, FY1 + 0.04, 0.0, 0.6), mat_cantaria(seed=4, alt=0.3, comp=0.5))
    # as pilastras de cantaria (nas pontas e as duas que emolduram a portada) e o entablamento
    for x in (FX0 + 0.14, XC - 1.12, XC + 1.12, FX1 - 0.14):
        caixa((x - 0.13, x + 0.13, FY1, FY1 + 0.06, 0.6, ZE - 0.3), {'*': liso(CANTARIA[0]), 'cima': liso(CANTARIA[2])})
        caixa((x - 0.17, x + 0.17, FY1, FY1 + 0.1, 0.6, 0.85), liso(CANTARIA[1]))
    caixa((FX0 - 0.02, FX1 + 0.02, FY1, FY1 + 0.12, ZE - 0.36, ZE - 0.1), {'*': liso(CANTARIA[0]), 'cima': liso(CANTARIA[2])})
    # a portada: a porta de duas folhas com a bandeira em arco, as ombreiras e o arco de cantaria, a cartela em cima
    PCOR = '#2f6a5a'
    PW, Z0, ZA = 1.4, 0.6, 3.05
    CZ.c.caixa((XC - PW / 2, XC + PW / 2, FY1 - 0.03, FY1 + 0.02, Z0, ZA), FF.mat_porta(PCOR, XC - PW / 2, XC + PW / 2, Z0, ZA, 2, 0), M, obj())
    _meio_disco('+y', FY1, XC, ZA, PW / 2, 0.02, liso(_escuro(PCOR, 0.86)), obj())
    for xm in (XC - 0.07, XC + 0.07):
        caixa((xm - 0.02, xm + 0.02, FY1 + 0.02, FY1 + 0.06, Z0 + 1.15, Z0 + 1.21), liso('#d8b060'), contorno=False)
    om = obj()
    for (l0, l1) in ((XC - PW / 2 - 0.2, XC - PW / 2), (XC + PW / 2, XC + PW / 2 + 0.2)):
        CZ.c.caixa((l0, l1, FY1, FY1 + 0.08, Z0, ZA), mat_cantaria(seed=7, alt=0.36, comp=0.2), M, om)
    _arco('+y', FY1, XC, ZA, PW / 2, PW / 2 + 0.2, 0.0, 0.08, liso(CANTARIA[0]), om, n=14)
    zc = ZA + PW / 2 + 0.5
    _disco_fachada('+y', FY1, XC, zc, 0.26, 0.07, liso(CANTARIA[2]), obj())
    _disco_fachada('+y', FY1, XC, zc, 0.17, 0.075, liso(CANTARIA[3]), obj(contorno=False))
    caixa((XC - 0.03, XC + 0.03, FY1 + 0.075, FY1 + 0.085, zc - 0.12, zc + 0.12), liso('#8a6a3c'), contorno=False)
    caixa((XC - 0.09, XC + 0.09, FY1 + 0.075, FY1 + 0.085, zc + 0.02, zc + 0.06), liso('#8a6a3c'), contorno=False)
    # as janelas do coro (dos dois lados da cartela), com a sacadinha de ferro
    BF = (FX0, FX1, FY0, FY1)
    for a in (XC - 1.75, XC + 1.75):
        _janela_arco('+y', FY1, a, 3.6, 4.55, 0.56)
        _sacada(BF, '+y', a, 3.44, 0.8, fundo=0.2)
    # o frontão de curva (com a borda de cantaria), as volutas, o óculo e a cruz de pedra
    FB = FY1 - 0.3
    pts = _frontao(XC, FB, FY1, ZE - 0.1, 2.2, 1.75, PAR, obj())
    of = obj()
    for (xa, za), (xb, zb) in zip(pts[:-1], pts[1:]):
        dx, dz = xb - xa, zb - za
        ln = math.hypot(dx, dz)
        nx_, nz_ = -dz / ln, dx / ln
        q = [(xa, za), (xb, zb), (xb + nx_ * 0.13, zb + nz_ * 0.13), (xa + nx_ * 0.13, za + nz_ * 0.13)]
        CZ.c.face_plana([(x, FY1 + 0.05, z) for (x, z) in q], (0, 1, 0), liso(CANTARIA[0]), M, of)
        CZ.c.face_plana([(q[3][0], FB, q[3][1]), (q[2][0], FB, q[2][1]), (q[2][0], FY1 + 0.05, q[2][1]), (q[3][0], FY1 + 0.05, q[3][1])],
                        (nx_, 0.0, nz_), liso(CANTARIA[2]), M, of)
    for s_ in (-1, 1):
        xv = XC + s_ * 2.05
        _disco_fachada('+y', FY1, xv, ZE + 0.08, 0.2, 0.07, liso(CANTARIA[0]), obj())
        _disco_fachada('+y', FY1, xv, ZE + 0.08, 0.1, 0.075, liso(CANTARIA[3]), obj(contorno=False))
    zo = ZE + 0.8
    _disco_fachada('+y', FY1, XC, zo, 0.4, 0.04, liso(CANTARIA[0]), obj())
    _disco_fachada('+y', FY1, XC, zo, 0.28, 0.045, liso('#2a3440'), obj(contorno=False))
    zt = ZE - 0.1 + 1.75
    caixa((XC - 0.2, XC + 0.2, FB - 0.02, FY1 + 0.02, zt - 0.06, zt + 0.12), {'*': liso(CANTARIA[1]), 'cima': liso(CANTARIA[2])})
    caixa((XC - 0.06, XC + 0.06, FB + 0.04, FY1 - 0.04, zt + 0.12, zt + 0.95), liso(CANTARIA[0]))
    caixa((XC - 0.26, XC + 0.26, FB + 0.04, FY1 - 0.04, zt + 0.6, zt + 0.72), liso(CANTARIA[0]))
    # ---- as torres
    TY0, TY1 = NY1 - 1.3, FY1 + 0.08
    _torre_sineira(0.3, FX0, TY0, TY1, ZE, 7.35, seed=1)
    _torre_sineira(FX1, W - 0.3, TY0, TY1, ZE, 7.35, seed=2)
    # ---- o adro: os três degraus de cantaria na frente
    fnd = lambda P: np.floor((P[:, 0] + 50) / 0.5).astype(np.int64)
    for k, (yb, zt_) in enumerate(((TY1 + 0.95, 0.2), (TY1 + 0.62, 0.4), (TY1 + 0.32, 0.6))):
        caixa((XC - 2.0 + k * 0.15, XC + 2.0 - k * 0.15, TY1 - 0.02, yb, 0.0, zt_), FF.mat_juntas(['#c8c0ae', '#bcb4a2', '#d0c8b6'], fnd, '#7a7262', seed=k))
    pegada(NX0, NX1, NY0, NY1)
    pegada(0.3, W - 0.3, TY0, TY1)


# =====================================================================================================================
# as peças do largo: o chafariz, o coreto, o poste de ferro, o banco de praça, o vaso, o cruzeiro e o lajeado
# =====================================================================================================================
AGUA = ['#5a8a9a', '#4a7a8c', '#6a9cac', '#8abcc8']


def mat_agua(cx, cy):
    """A água parada: os anéis de onda em degraus (claros e escuros) e o reflexo claro no lado da luz."""
    cs = [hx(x) for x in AGUA]

    def f(L, n, P):
        d = np.hypot(P[:, 0] - cx, P[:, 1] - cy)
        k = np.floor(d / 0.11 + 0.3 * np.sin(np.arctan2(P[:, 1] - cy, P[:, 0] - cx) * 3))
        out = np.where((k % 3 == 0)[:, None], cs[1], cs[0])
        out = np.where((k % 5 == 2)[:, None], cs[2], out)
        brilho = ((P[:, 0] - cx) < -0.2) & ((P[:, 1] - cy) > 0.1) & (k % 2 == 0)
        return np.where(brilho[:, None], cs[3], out)
    return emissivo(f)


def _anel_oct(cx, cy, r_in, r_out, z, mat, o, lados=8, giro=math.pi / 8):
    for i in range(lados):
        a0 = giro + 2 * math.pi * i / lados
        a1 = giro + 2 * math.pi * (i + 1) / lados
        CZ.c.face_plana([(cx + r_in * math.cos(a0), cy + r_in * math.sin(a0), z), (cx + r_out * math.cos(a0), cy + r_out * math.sin(a0), z),
                         (cx + r_out * math.cos(a1), cy + r_out * math.sin(a1), z), (cx + r_in * math.cos(a1), cy + r_in * math.sin(a1), z)],
                        (0, 0, 1), mat, M, o)


def _prisma_oct(cx, cy, r, z0, z1, mat, o, lados=8, giro=math.pi / 8, dentro=False, topo=None):
    """O prisma de 8 lados (a borda do tanque, o estrado): as faces de fora ou (dentro) as de dentro."""
    for i in range(lados):
        a0 = giro + 2 * math.pi * i / lados
        a1 = giro + 2 * math.pi * (i + 1) / lados
        am = (a0 + a1) / 2
        p0 = (cx + r * math.cos(a0), cy + r * math.sin(a0))
        p1 = (cx + r * math.cos(a1), cy + r * math.sin(a1))
        n = (-math.cos(am), -math.sin(am), 0.0) if dentro else (math.cos(am), math.sin(am), 0.0)
        CZ.c.face_plana([(p0[0], p0[1], z0), (p1[0], p1[1], z0), (p1[0], p1[1], z1), (p0[0], p0[1], z1)], n, mat, M, o)
    if topo is not None:
        CZ.c.face_plana([(cx + r * math.cos(giro + 2 * math.pi * i / lados), cy + r * math.sin(giro + 2 * math.pi * i / lados), z1) for i in range(lados)],
                        (0, 0, 1), topo, M, o)


def _chafariz():
    cx = cy = 1.125
    PED = FF.mat_juntas(['#b8b0a0', '#aca494', '#c2baaa', '#a29a8a'], FF.id_pedras_parede(0.2, 0.42, seed=3), '#6a6456', seed=2)
    o = obj()
    _prisma_oct(cx, cy, 1.04, 0.0, 0.55, PED, o)
    # a borda (o parapeito largo, mais claro), a parede de dentro e a água
    _prisma_oct(cx, cy, 1.09, 0.55, 0.64, liso('#c8c0b0'), o)
    _anel_oct(cx, cy, 0.88, 1.09, 0.64, liso('#d2cabb'), o)
    oi = obj(contorno=False)
    _prisma_oct(cx, cy, 0.88, 0.42, 0.64, liso('#8e877a'), oi, dentro=True)
    CZ.c.face_plana([(cx + 0.88 * math.cos(math.pi / 8 + 2 * math.pi * i / 8), cy + 0.88 * math.sin(math.pi / 8 + 2 * math.pi * i / 8), 0.44) for i in range(8)],
                    (0, 0, 1), mat_agua(cx, cy), M, obj(contorno=False))
    # a coluna do meio: o pedestal quadrado, as quatro bicas, o fuste, a taça de cima e a pinha
    caixa((cx - 0.22, cx + 0.22, cy - 0.22, cy + 0.22, 0.44, 1.0), {'*': PED, 'cima': liso('#c8c0b0')})
    caixa((cx - 0.27, cx + 0.27, cy - 0.27, cy + 0.27, 0.98, 1.06), liso('#ccc4b4'))
    CZ.c.cilindro(cx, cy, 0.12, 1.06, 1.55, vol(cx, cy, '#bdb5a5'), M, obj(), lados=14, tampa=False)
    _poligono_rodado(cx, cy, [(1.55, 0.1), (1.62, 0.3), (1.68, 0.42), (1.72, 0.44)], vol(cx, cy, '#c4bcac'), obj(), lados=18)
    _disco(cx, cy, 1.71, 0.38, mat_agua(cx, cy), obj(contorno=False), lados=18)
    CZ.c.cilindro(cx, cy, 0.05, 1.68, 1.86, vol(cx, cy, '#bdb5a5'), M, obj(), lados=10)
    CZ.c.elipsoide((cx, cy, 1.96), (0.09, 0.09, 0.13), lambda Pc, N, P: FF._cru_eli(np.tile(hx('#c8c0b0'), (len(P), 1)), N), obj())
    # as bicas de bronze e os fios d'água caindo no tanque
    for (dx, dy) in ((0, 1), (1, 0), (0, -1), (-1, 0)):
        bx0, by0 = cx + dx * 0.22, cy + dy * 0.22
        ex, ey = (0.025 if dx == 0 else 0), (0.025 if dy == 0 else 0)
        caixa((min(bx0, bx0 + dx * 0.16) - ex, max(bx0, bx0 + dx * 0.16) + ex, min(by0, by0 + dy * 0.16) - ey, max(by0, by0 + dy * 0.16) + ey, 0.8, 0.85),
              liso('#8a6a2e'))
        fx, fy = bx0 + dx * 0.18, by0 + dy * 0.18
        ow = obj(contorno=False, sombra=False)
        CZ.luzes.add(ow)
        CZ.c.caixa((fx - 0.015, fx + 0.015, fy - 0.015, fy + 0.015, 0.45, 0.8), liso('#bfe0ea'), M, ow)
    pegada_redonda(cx, cy, 1.1, 15)


def _coreto():
    cx = cy = 1.5
    R = 1.32
    PAR = mat_cal(seed=71, sujeira=0.0)
    _prisma_oct(cx, cy, R, 0.0, 0.5, PAR, obj())
    _prisma_oct(cx, cy, R + 0.05, 0.5, 0.6, liso(CANTARIA[0]), obj(), topo=tab2(['#8a6040', '#946a46', '#7e5838'], 0.12, '#4a3020', eixo=0, seed=2))
    # a escadinha na frente (+y)
    for k, (yb, zt) in enumerate(((cy + R + 0.36, 0.2), (cy + R + 0.18, 0.4))):
        caixa((cx - 0.45, cx + 0.45, cy + R - 0.15, yb, 0.0, zt), FF.mat_juntas(['#c8c0ae', '#bcb4a2'], lambda P: np.floor((P[:, 0] + 50) / 0.3).astype(np.int64), '#7a7262', seed=k))
    # as oito colunas de ferro, o gradil (aberto na frente) e o lambrequim de madeira embaixo do beiral
    fe = liso('#2c3a30')
    ZT = 2.65
    angs = [math.pi / 8 + 2 * math.pi * i / 8 for i in range(8)]
    rc = R - 0.1
    for a in angs:
        px, py = cx + rc * math.cos(a), cy + rc * math.sin(a)
        caixa((px - 0.035, px + 0.035, py - 0.035, py + 0.035, 0.6, ZT), fe)
        caixa((px - 0.06, px + 0.06, py - 0.06, py + 0.06, 0.6, 0.7), fe)
    og = obj(contorno=False)
    for i in range(8):
        a0, a1 = angs[i], angs[(i + 1) % 8]
        am = (a0 + a1) / 2
        if abs(math.cos(am)) < 0.3 and math.sin(am) > 0:
            continue                       # a frente fica aberta (a escadinha)
        p0 = np.array([cx + rc * math.cos(a0), cy + rc * math.sin(a0)])
        p1 = np.array([cx + rc * math.cos(a1), cy + rc * math.sin(a1)])
        for zz in (0.68, 1.5):
            for t in np.linspace(0, 1, 9)[:-1]:
                q0 = p0 + (p1 - p0) * t
                q1 = p0 + (p1 - p0) * (t + 1 / 8)
                CZ.c.caixa((min(q0[0], q1[0]) - 0.015, max(q0[0], q1[0]) + 0.015, min(q0[1], q1[1]) - 0.015, max(q0[1], q1[1]) + 0.015, zz, zz + 0.04), fe, M, og)
        for t in np.linspace(0.08, 0.92, 7):
            q = p0 + (p1 - p0) * t
            CZ.c.caixa((q[0] - 0.012, q[0] + 0.012, q[1] - 0.012, q[1] + 0.012, 0.7, 1.5), fe, M, og)
    _prisma_oct(cx, cy, R + 0.12, ZT - 0.18, ZT, liso('#f2ede2'), obj())
    # o telhado de oito águas de telha (as fiadas em degraus) e o pináculo
    ZR = 3.75
    cs = np.stack([hx(x) for x in TELHA])

    def telha(L, n, P):
        g = (P[:, 2] - ZT) / 0.11
        f_ = np.floor(g)
        th = np.arctan2(P[:, 1] - cy, P[:, 0] - cx)
        col = np.floor(th / (2 * math.pi) * 40 + 0.5 * (f_ % 2))
        out = cs[(ruido(f_ * 37 + col, 3.3) * 4).astype(int) % 4]
        return np.where(((g % 1) < 0.18)[:, None], hx(TELHA_J), out)
    ot = obj()
    rr = R + 0.3
    for i in range(8):
        a0, a1 = angs[i], angs[(i + 1) % 8]
        q = np.array([(cx + rr * math.cos(a0), cy + rr * math.sin(a0), ZT), (cx + rr * math.cos(a1), cy + rr * math.sin(a1), ZT), (cx, cy, ZR)])
        nn = np.cross(q[1] - q[0], q[2] - q[0])
        nn = nn / np.linalg.norm(nn) * (1 if nn[2] > 0 else -1)
        CZ.c.face_plana([tuple(v) for v in q], tuple(nn), emissivo(telha), M, ot)
    CZ.c.face_plana([(cx + rr * math.cos(a), cy + rr * math.sin(a), ZT) for a in angs[::-1]], (0, 0, -1), liso('#e8e2d4'), M, ot)
    CZ.c.cilindro(cx, cy, 0.05, ZR - 0.05, ZR + 0.15, vol(cx, cy, '#2c3a30'), M, obj(), lados=8)
    CZ.c.elipsoide((cx, cy, ZR + 0.2), (0.07, 0.07, 0.07), lambda Pc, N, P: FF._cru_eli(np.tile(hx('#b89040'), (len(P), 1)), N), obj())
    pegada_redonda(cx, cy, R + 0.1, 15)


def _poste_ferro(aceso=True):
    cx = cy = 0.375
    fe = '#24262c'
    _poligono_rodado(cx, cy, [(0.0, 0.13), (0.08, 0.13), (0.12, 0.09), (0.32, 0.075), (0.36, 0.055)], vol(cx, cy, fe, brilho=0.3), obj(), lados=12,
                     tampa_mat=liso(fe))
    CZ.c.cilindro(cx, cy, 0.045, 0.36, 2.72, vol(cx, cy, fe, brilho=0.35), M, obj(), lados=10, r1=0.035, tampa=False)
    for z in (1.0, 2.2):
        CZ.c.cilindro(cx, cy, 0.06, z, z + 0.05, vol(cx, cy, fe, brilho=0.3), M, obj(), lados=10)
    _poligono_rodado(cx, cy, [(2.72, 0.04), (2.82, 0.1), (2.86, 0.1)], vol(cx, cy, fe), obj(), lados=4, tampa_mat=liso(fe))
    # a lanterna: os quatro vidros (acesos, a luz amarela clara no meio), as hastes, o chapéu e o pináculo
    s = 0.12
    z0, z1 = 2.86, 3.2
    ov = obj(contorno=not aceso)
    if aceso:
        CZ.luzes.add(ov)

    def vidro(L, n, P):
        u = (P[:, 0] - cx) if abs(n[1]) > 0.5 else (P[:, 1] - cy)
        v = (P[:, 2] - z0) / (z1 - z0)
        if not aceso:
            out = np.where((v > 0.6)[:, None], hx('#3a3e42'), hx('#2c3034'))
            return np.where((np.abs(v * 1.4 - u * 3 - 0.6) < 0.1)[:, None], hx('#5a6268'), out)
        r = np.maximum(np.abs(u) / s, np.abs(v - 0.45) * 2)
        return np.where((r < 0.45)[:, None], hx('#fff6d6'), np.where((r < 0.8)[:, None], hx('#ffe08a'), hx('#f2b850')))
    CZ.c.caixa((cx - s, cx + s, cy - s, cy + s, z0, z1), emissivo(vidro), M, ov)
    og = obj()
    for (px, py) in ((cx - s, cy - s), (cx + s, cy - s), (cx - s, cy + s), (cx + s, cy + s)):
        CZ.c.caixa((px - 0.014, px + 0.014, py - 0.014, py + 0.014, z0 - 0.02, z1 + 0.02), liso(fe), M, og)
    _poligono_rodado(cx, cy, [(z1, s + 0.05), (z1 + 0.04, s + 0.05), (z1 + 0.16, 0.03)], vol(cx, cy, fe, brilho=0.3), obj(), lados=4)
    CZ.c.cilindro(cx, cy, 0.012, z1 + 0.15, z1 + 0.27, liso(fe), M, obj(), lados=6)
    pegada_redonda(cx, cy, 0.13, 5)


def _banco_praca():
    """O banco de praça: as ripas de madeira do assento e do encosto e os pés de ferro fundido (a frente para +y)."""
    x0, x1 = 0.08, 1.42
    fe = liso('#26282c')
    ripa = ['#8a5a34', '#946238', '#82542f']
    for k, y in enumerate(np.arange(0.2, 0.56, 0.09)):
        caixa((x0, x1, y, y + 0.075, 0.41, 0.45), {'*': liso(_escuro(ripa[k % 3], 0.8)), 'cima': liso(ripa[k % 3])})
    for k, z in enumerate(np.arange(0.52, 0.86, 0.1)):
        y = 0.12 - (z - 0.52) * 0.08
        caixa((x0, x1, y, y + 0.05, z, z + 0.075), {'*': liso(ripa[k % 3]), 'cima': liso(_escuro(ripa[k % 3], 1.08))})
    for xx in (x0 + 0.1, x1 - 0.14):
        caixa((xx, xx + 0.04, 0.5, 0.56, 0.0, 0.41), fe)
        caixa((xx, xx + 0.04, 0.12, 0.17, 0.0, 0.9), fe)
        caixa((xx, xx + 0.04, 0.14, 0.58, 0.36, 0.41), fe)
        caixa((xx - 0.02, xx + 0.06, 0.46, 0.6, 0.0, 0.04), fe)
        caixa((xx - 0.02, xx + 0.06, 0.08, 0.2, 0.0, 0.04), fe)
    pegada(x0, x1, 0.12, 0.6)


def _vaso_flores():
    _vaso(0.375, 0.375, 0.0, r=0.24, h=0.42, seed=8)


def _cruzeiro():
    """O cruzeiro do adro: a base de cantaria em dois degraus e a cruz alta de madeira escura."""
    cx = cy = 0.375
    caixa((cx - 0.33, cx + 0.33, cy - 0.33, cy + 0.33, 0.0, 0.3), mat_cantaria(seed=9, alt=0.15, comp=0.3))
    caixa((cx - 0.22, cx + 0.22, cy - 0.22, cy + 0.22, 0.3, 0.62), {'*': mat_cantaria(seed=10, alt=0.16, comp=0.22), 'cima': liso(CANTARIA[2])})
    caixa((cx - 0.065, cx + 0.065, cy - 0.065, cy + 0.065, 0.62, 3.25), mad2('#4a3020', eixo=1, seed=3, passo=0.05))
    caixa((cx - 0.5, cx + 0.5, cy - 0.06, cy + 0.06, 2.42, 2.56), mad2('#4a3020', eixo=0, seed=4, passo=0.05))
    pegada(cx - 0.33, cx + 0.33, cy - 0.33, cy + 0.33)


LAJE = ['#c4baa6', '#bab09c', '#cec4b0', '#b2a894']


def _lajeado():
    """O lajeado do largo (decalque de chão, 2 x 2 casas): as lajes de pedra em fiadas desencontradas, a junta de 1 px."""
    cs = np.stack([hx(x) for x in LAJE])
    jc = hx('#7e7462')

    def f(L, n, P):
        fila = np.floor(L[:, 1] / 0.375)
        u = L[:, 0] / 0.5 + 0.5 * (fila % 2)
        col = np.floor(u)
        out = cs[(ruido(fila * 31 + col, 5.5) * 4).astype(int) % 4]
        gy = L[:, 1] - fila * 0.375
        gx = (u - col) * 0.5
        out = np.where((gy < PH)[:, None], jc, out)
        out = np.where((gx < PH)[:, None], jc, out)
        return np.where(((gy >= PH) & (gy < 2 * PH))[:, None], np.minimum(out * 1.06, 255), out)
    CZ.c.face_plana([(0.0, 0.0, 0.012), (1.5, 0.0, 0.012), (1.5, 1.5, 0.012), (0.0, 1.5, 0.012)], (0, 0, 1), emissivo(f), M, obj(contorno=False))


# =====================================================================================================================
# por dentro: o banco da igreja, o altar barroco, a prateleira da venda e o oratório (item de parede)
# =====================================================================================================================
OURO = ['#e2b24a', '#c89434', '#f0cc6a', '#a87a28']
MAD_IGREJA = '#5a3420'


def _vela(x, y, z, h=0.16, r=0.018, acesa=True):
    """A vela branca com a chaminha (a chama é peça que brilha, sem contorno)."""
    CZ.c.cilindro(x, y, r, z, z + h, vol(x, y, '#f2ead6'), M, obj(), lados=8, tampa_mat=liso('#fbf6ea'))
    if acesa:
        o = obj(contorno=False, sombra=False)
        CZ.luzes.add(o)
        CZ.c.elipsoide((x, y, z + h + 0.03), (0.012, 0.012, 0.03), lambda Pc, N, P: np.tile(hx('#ffd27a'), (len(P), 1)), o)


def _castical(x, y, z, alto=0.22, acesa=True):
    """O castiçal de ouro (o pé, a haste e o prato) com a vela."""
    _poligono_rodado(x, y, [(z, 0.05), (z + 0.02, 0.05), (z + 0.04, 0.018), (z + alto - 0.03, 0.014), (z + alto - 0.02, 0.04), (z + alto, 0.04)],
                     vol(x, y, OURO[0], brilho=0.5), obj(), lados=12)
    _vela(x, y, z + alto, acesa=acesa)


def _banco_igreja():
    """O banco comprido da nave (3 casas): o assento, o encosto alto de tábua e as cabeceiras recortadas (a frente para +y)."""
    m_h = mad2(MAD_IGREJA, eixo=0, seed=3, passo=0.05)
    m_v = mad2(_escuro(MAD_IGREJA, 0.9), eixo=1, seed=4, passo=0.05)
    W = 3 * CASA
    caixa((0.1, W - 0.1, 0.22, 0.62, 0.41, 0.46), {'*': m_h, 'cima': mad2('#6e4228', eixo=0, seed=5, passo=0.05)})
    caixa((0.1, W - 0.1, 0.12, 0.19, 0.46, 0.98), {'*': m_h, 'cima': liso('#7a4c2e')})
    caixa((0.1, W - 0.1, 0.11, 0.2, 0.95, 1.0), {'*': liso('#4a2a1a'), 'cima': liso('#6e4228')})
    # a tábua de baixo do assento (a frente) e as cabeceiras
    caixa((0.1, W - 0.1, 0.56, 0.6, 0.18, 0.41), m_h)
    for (x0, x1) in ((0.03, 0.1), (W - 0.1, W - 0.03)):
        caixa((x0, x1, 0.1, 0.66, 0.0, 0.62), {'*': m_v, 'cima': liso('#7a4c2e')})
        caixa((x0, x1, 0.1, 0.32, 0.62, 1.02), {'*': m_v, 'cima': liso('#7a4c2e')})
        caixa((x0 - 0.01, x1 + 0.01, 0.6, 0.68, 0.58, 0.66), liso('#6e4228'))
    pegada(0.03, W - 0.03, 0.1, 0.66)


def _altar_barroco():
    """
    O altar-mor (4 casas, 2,7 m, encostado na parede do fundo): o retábulo vermelho e dourado com as colunas, o
    nicho com a santa de manto azul e a auréola, o arco de coroa com a cruz; na frente, a mesa do altar com a toalha
    de renda, o crucifixo e os dois castiçais acesos.
    """
    W = 4 * CASA
    XC = W / 2
    ouro = {'*': liso(OURO[0]), 'cima': liso(OURO[2])}
    VERM = '#7a2420'

    def fundo(L, n, P):
        u = P[:, 0]
        z = P[:, 2]
        out = np.tile(hx(VERM), (len(P), 1))
        # os frisos dourados (a talha) em losango no vermelho
        lz = ((u * 6 + z * 6) % 1 < 0.08) | ((u * 6 - z * 6) % 1 < 0.08)
        out = np.where(lz[:, None], hx('#9a3a24'), out)
        return out
    caixa((0.1, W - 0.1, 0.02, 0.18, 0.0, 2.22), {'*': emissivo(fundo), 'cima': liso(OURO[1]), 'costas': FF.mat_tabua_v(['#5a3a24', '#62402a'], 0.16, '#2a1a10', seed=6)})
    # a moldura dourada do retábulo
    for b in ((0.06, 0.18, 0.02, 0.22, 0.0, 2.22), (W - 0.18, W - 0.06, 0.02, 0.22, 0.0, 2.22)):
        caixa(b, ouro)
    # as quatro colunas douradas (o fuste, a base e o capitel)
    for x in (0.42, 0.82, W - 0.82, W - 0.42):
        CZ.c.cilindro(x, 0.28, 0.06, 1.02, 2.06, vol(x, 0.28, OURO[0], brilho=0.5), M, obj(), lados=12, tampa=False)
        caixa((x - 0.09, x + 0.09, 0.19, 0.37, 0.96, 1.04), ouro)
        caixa((x - 0.1, x + 0.1, 0.18, 0.38, 2.04, 2.14), ouro)
    # o entablamento e o arco de coroa com a cruz
    caixa((0.06, W - 0.06, 0.02, 0.4, 2.12, 2.28), {'*': liso(OURO[1]), 'cima': liso(OURO[2])})
    _meio_disco('+y', 0.2, XC, 2.28, 0.36, 0.0, liso(OURO[1]), obj(), n=16)
    _meio_disco('+y', 0.2, XC, 2.28, 0.24, 0.005, liso(VERM), obj(contorno=False), n=16)
    caixa((XC - 0.025, XC + 0.025, 0.19, 0.24, 2.28, 2.5), ouro, contorno=False)
    caixa((XC - 0.08, XC + 0.08, 0.19, 0.24, 2.4, 2.44), ouro, contorno=False)
    # o nicho (o fundo azul com o arco) e a santa: o manto azul, a túnica, o rosto e a auréola
    _meio_disco('+y', 0.18, XC, 1.86, 0.27, 0.004, liso('#22304a'), obj(contorno=False), n=14)
    CZ.c.caixa((XC - 0.27, XC + 0.27, 0.03, 0.184, 1.1, 1.86), liso('#22304a'), M, obj(contorno=False))
    _arco('+y', 0.18, XC, 1.86, 0.27, 0.35, 0.0, 0.04, liso(OURO[0]), obj())
    for (x0, x1) in ((XC - 0.35, XC - 0.27), (XC + 0.27, XC + 0.35)):
        caixa((x0, x1, 0.18, 0.22, 1.1, 1.86), ouro)
    caixa((XC - 0.32, XC + 0.32, 0.18, 0.34, 1.04, 1.12), ouro)
    o = obj()
    m_manto = lambda Pc, N, P: FF._cru_eli(np.where((np.abs(P[:, 0] - XC) < 0.035)[:, None], hx('#e8e0d0'), hx('#3a5a9a')), N)
    CZ.c.elipsoide((XC, 0.26, 1.42), (0.12, 0.07, 0.3), m_manto, o, corte_z=1.12)
    CZ.c.elipsoide((XC, 0.27, 1.77), (0.055, 0.05, 0.065), lambda Pc, N, P: FF._cru_eli(np.tile(hx('#e2bc96'), (len(P), 1)), N), obj())
    _disco_fachada('+y', 0.2, XC, 1.8, 0.1, 0.0, liso(OURO[2]), obj(contorno=False))
    # a mesa do altar: a frente dourada com o painel claro e a cruz, a toalha de renda caindo na frente
    def frente(L, n, P):
        u = (P[:, 0] - 0.62) / (W - 1.24)
        v = P[:, 2] / 0.98
        out = np.tile(hx(OURO[1]), (len(P), 1))
        dentro = (u > 0.06) & (u < 0.94) & (v > 0.1) & (v < 0.86)
        out = np.where(dentro[:, None], hx('#efe4c8'), out)
        cruz = dentro & (((np.abs(u - 0.5) < 0.025) & (v > 0.25) & (v < 0.75)) | ((np.abs(v - 0.58) < 0.04) & (np.abs(u - 0.5) < 0.09)))
        return np.where(cruz[:, None], hx(OURO[3]), out)
    caixa((0.62, W - 0.62, 0.3, 0.72, 0.0, 0.98), {'*': emissivo(frente), 'cima': liso('#f4eedf')})
    def renda(L, n, P):
        g = (P[:, 0] / (3 * PH)) % 1
        return np.where(((P[:, 2] < 0.86) & (g < 0.4))[:, None], hx('#d8cfbc'), hx('#f6f1e4'))
    caixa((0.6, W - 0.6, 0.29, 0.74, 0.82, 0.99), {'*': emissivo(renda), 'cima': liso('#f6f1e4')})
    # o crucifixo e os castiçais em cima da toalha
    caixa((XC - 0.06, XC + 0.06, 0.46, 0.56, 0.99, 1.03), ouro)
    caixa((XC - 0.012, XC + 0.012, 0.5, 0.52, 1.03, 1.3), ouro, contorno=False)
    caixa((XC - 0.07, XC + 0.07, 0.5, 0.52, 1.2, 1.225), ouro, contorno=False)
    for x in (0.85, W - 0.85):
        _castical(x, 0.52, 0.99)
    CZ.itens_peq.append((XC - 0.06, XC + 0.06, 0.46, 0.56, 0.99))
    pegada(0.06, W - 0.06, 0.02, 0.74)


def _prateleira_venda():
    """A prateleira da venda (2 casas, 2,2 m): as tábuas e, nelas, as sacas, os potes de barro, as latas, as garrafas de
    cachaça, os rolos de pano e as caixas."""
    W = 2 * CASA
    md = mad2('#7a5232', eixo=0, seed=7, passo=0.05)
    mv = mad2('#6a4628', eixo=1, seed=8, passo=0.05)
    caixa((0.04, W - 0.04, 0.06, 0.1, 0.0, 2.2), FF.mat_tabua_v(['#6a4628', '#704a2c', '#64422a'], 0.14, '#3a2414', seed=2))
    for (x0, x1) in ((0.04, 0.1), (W - 0.1, W - 0.04)):
        caixa((x0, x1, 0.06, 0.62, 0.0, 2.2), {'*': mv, 'cima': liso('#8a6040')})
    zs = (0.06, 0.52, 0.98, 1.44, 1.9)
    for z in zs:
        caixa((0.1, W - 0.1, 0.1, 0.6, z - 0.04, z), {'*': md, 'cima': mad2('#8a6040', eixo=0, seed=int(z * 10), passo=0.05)})
    caixa((0.04, W - 0.04, 0.06, 0.62, 2.16, 2.2), {'*': md, 'cima': liso('#8a6040')})
    # embaixo: as sacas de feijão e de arroz
    FF._saco((0.14, 0.62, 0.16, 0.56, zs[0], zs[0] + 0.32), seed=4)
    FF._saco((0.68, 1.12, 0.18, 0.56, zs[0], zs[0] + 0.28), cor='#e0d2b0', seed=5)
    caixa((1.16, 1.38, 0.2, 0.52, zs[0], zs[0] + 0.24), {'*': FF.mat_tabua_v(['#a87c4c', '#9a7044'], 0.07, '#4a3020', seed=3), 'cima': liso('#3a2414')})
    # os potes de barro e as latas
    for k, x in enumerate((0.24, 0.5, 0.78)):
        BE.pote_barro(x, 0.36, zs[1], r=0.1, h=0.22 + 0.03 * (k % 2))
    for k, x in enumerate((1.02, 1.16, 1.3)):
        cor = ['#b8302a', '#d8a832', '#3a6a9a'][k]
        CZ.c.cilindro(x, 0.34, 0.055, zs[1], zs[1] + 0.16, vol(x, 0.34, cor, brilho=0.4), M, obj(), lados=12, tampa_mat=liso('#a8aab0'))
    # as garrafas de cachaça (âmbar e transparente) e o garrafão de palha
    for k, x in enumerate(np.arange(0.2, 1.0, 0.13)):
        cor = '#b07a2a' if k % 2 == 0 else '#c8d0c8'
        o = obj()
        _poligono_rodado(x, 0.34, [(zs[2], 0.04), (zs[2] + 0.16, 0.04), (zs[2] + 0.2, 0.018), (zs[2] + 0.28, 0.016)], vol(x, 0.34, cor, brilho=0.5), o, lados=12)
        CZ.c.cilindro(x, 0.34, 0.017, zs[2] + 0.28, zs[2] + 0.31, vol(x, 0.34, '#8a5a34'), M, o, lados=8)
    _poligono_rodado(1.2, 0.36, [(zs[2], 0.1), (zs[2] + 0.06, 0.13), (zs[2] + 0.2, 0.13), (zs[2] + 0.28, 0.06), (zs[2] + 0.34, 0.03)],
                     vol(1.2, 0.36, '#b89a5e'), obj(), lados=14)
    # os rolos de pano e as caixas de sabão
    for k, (x0, cor) in enumerate(((0.14, '#a83a3a'), (0.4, '#3a5a8a'), (0.66, '#e0d6bc'))):
        caixa((x0, x0 + 0.22, 0.14, 0.58, zs[3], zs[3] + 0.18), {'*': liso(cor), 'cima': liso(_escuro(cor, 1.1))})
    for k, x0 in enumerate((0.98, 1.16)):
        caixa((x0, x0 + 0.16, 0.2, 0.5, zs[3], zs[3] + 0.12 + 0.04 * k), {'*': liso('#d8c890'), 'cima': liso('#5a9a6a')})
    # em cima: as latas de biscoito e o lampião velho
    for k, x in enumerate((0.25, 0.55, 0.85, 1.15)):
        cor = ['#5a8a5a', '#b8302a', '#d8a832', '#5a8a5a'][k]
        CZ.c.cilindro(x, 0.34, 0.09, zs[4], zs[4] + 0.18, vol(x, 0.34, cor, brilho=0.4), M, obj(), lados=14, tampa_mat=liso('#c0c2c8'))
    pegada(0.04, W - 0.04, 0.06, 0.62)


def _oratorio(xc=1.5, zc=1.6):
    """
    O oratório mineiro na parede (24 x 36 px): a caixinha de madeira azul com o frontão dourado e a cruz, as duas
    portinholas abertas, o nicho com a santinha de manto azul e a auréola, a prateleira de baixo com a vela.
    """
    AZ = '#2f5a8a'
    m = {'*': mad2(AZ, eixo=1, seed=2, passo=0.05), 'cima': liso('#4a74a4')}
    ouro = {'*': liso(OURO[0]), 'cima': liso(OURO[2])}
    # a caixinha aberta: o fundo, os lados, o teto e o piso (o nicho fica fundo, com a santa dentro)
    caixa((xc - 0.17, xc + 0.17, 0.0, 0.04, zc - 0.26, zc + 0.2), m)
    CZ.c.caixa((xc - 0.13, xc + 0.13, 0.04, 0.045, zc - 0.2, zc + 0.14), liso('#5a1c1a'), M, obj(contorno=False))
    for (x0, x1) in ((xc - 0.17, xc - 0.13), (xc + 0.13, xc + 0.17)):
        caixa((x0, x1, 0.0, 0.15, zc - 0.26, zc + 0.2), m)
    caixa((xc - 0.17, xc + 0.17, 0.0, 0.15, zc + 0.14, zc + 0.2), m)
    caixa((xc - 0.17, xc + 0.17, 0.0, 0.15, zc - 0.26, zc - 0.2), m)
    # o filete dourado em volta da boca do nicho
    of = obj(contorno=False)
    for b_ in ((xc - 0.13, xc - 0.115, 0.15, 0.154, zc - 0.2, zc + 0.14), (xc + 0.115, xc + 0.13, 0.15, 0.154, zc - 0.2, zc + 0.14),
               (xc - 0.13, xc + 0.13, 0.15, 0.154, zc + 0.125, zc + 0.14)):
        CZ.c.caixa(b_, liso(OURO[0]), M, of)
    # o frontão triangular dourado e a cruz
    CZ.c.face_plana([(xc - 0.2, 0.152, zc + 0.2), (xc + 0.2, 0.152, zc + 0.2), (xc, 0.152, zc + 0.34)], (0, 1, 0), liso(OURO[1]), M, obj())
    caixa((xc - 0.2, xc + 0.2, 0.0, 0.17, zc + 0.18, zc + 0.22), ouro)
    caixa((xc - 0.012, xc + 0.012, 0.12, 0.14, zc + 0.33, zc + 0.44), ouro, contorno=False)
    caixa((xc - 0.04, xc + 0.04, 0.12, 0.14, zc + 0.39, zc + 0.41), ouro, contorno=False)
    # as portinholas abertas (pintadas, com o filete dourado)
    for (x0, x1) in ((xc - 0.31, xc - 0.17), (xc + 0.17, xc + 0.31)):
        def porta(L, n, P, x0=x0, x1=x1):
            u = (P[:, 0] - x0) / (x1 - x0)
            v = (P[:, 2] - (zc - 0.24)) / 0.42
            out = np.tile(hx(AZ), (len(P), 1))
            return np.where(((u < 0.14) | (u > 0.86) | (v < 0.08) | (v > 0.92))[:, None], hx(OURO[1]), out)
        caixa((x0, x1, 0.13, 0.15, zc - 0.24, zc + 0.18), {'*': emissivo(porta), 'cima': liso(OURO[1])})
    # a santinha: o manto azul, o rosto e a auréola
    _disco_fachada('+y', 0.046, xc, zc + 0.05, 0.055, 0.0, liso(OURO[2]), obj(contorno=False), n=12)
    CZ.c.elipsoide((xc, 0.09, zc - 0.08), (0.055, 0.035, 0.12), lambda Pc, N, P: FF._cru_eli(np.tile(hx('#4a72b0'), (len(P), 1)), N), obj(), corte_z=zc - 0.2)
    CZ.c.elipsoide((xc, 0.095, zc + 0.05), (0.03, 0.026, 0.034), lambda Pc, N, P: FF._cru_eli(np.tile(hx('#e2bc96'), (len(P), 1)), N), obj())
    # a prateleira de baixo (a mísula) com a vela acesa
    caixa((xc - 0.2, xc + 0.2, 0.0, 0.2, zc - 0.32, zc - 0.26), {'*': liso('#244a72'), 'cima': liso('#3a6494')})
    _vela(xc + 0.12, 0.13, zc - 0.26, h=0.07, r=0.014)


# =====================================================================================================================
ITENS = {
    'casa_colonial': (7, 5, (0.0, 0.0), lambda: _casa_colonial('a'), {}),
    'casa_colonial~b': (7, 5, (0.0, 0.0), lambda: _casa_colonial('b'), {}),
    'casa_colonial~c': (7, 5, (0.0, 0.0), lambda: _casa_colonial('c'), {}),
    'casa_colonial~d': (7, 5, (0.0, 0.0), lambda: _casa_colonial('d'), {}),
    'pousada_predio': (9, 6, (0.0, 0.0), _pousada, {}),
    'venda_predio': (9, 5, (0.0, 0.0), _venda, {}),
    'boteco_predio': (7, 5, (0.0, 0.0), _boteco, {}),
    'igreja_barroca': (13, 10, (0.0, 0.0), _igreja, {}),
    'chafariz': (3, 3, (0.0, 0.0), _chafariz, {}),
    'coreto': (4, 4, (0.0, 0.0), _coreto, {}),
    # o poste: 0 aceso (o padrão), '1' apagado
    'poste_ferro': (1, 1, (0.0, 0.0), _poste_ferro, {'1': lambda: _poste_ferro(False)}),
    'banco_praca': (2, 1, (0.0, 0.0), _banco_praca, {}),
    'vaso_flores': (1, 1, (0.0, 0.0), _vaso_flores, {}),
    'cruzeiro': (1, 1, (0.0, 0.0), _cruzeiro, {}),
    'lajeado': (2, 2, (0.0, 0.0), _lajeado, {}),
    'banco_igreja': (3, 1, (0.0, 0.0), _banco_igreja, {}),
    'altar_barroco': (4, 1, (0.0, 0.0), _altar_barroco, {}),
    'prateleira_venda': (2, 1, (0.0, 0.0), _prateleira_venda, {}),
}
ITENS_PAREDE = {
    'oratorio': (lambda: _oratorio(1.5, 1.6), (1.5, 1.6)),
}
# o lajeado é decalque de chão de um giro só (rotations [0] no catálogo; o desenho é igual nos quatro)
SO_GIROS = {'lajeado': (0,)}
