"""
GRUPO: Igarapé (15/10), a cidadezinha do interior histórico de Minas cortada por um rio: as casas brancas de janelas
azuis e telhado de barro, a capelinha branca, a venda da beira do rio, as palafitas de madeira em cima das estacas na
água, a ponte de pedra em arco, as canoas e o ipê amarelo florido. Pixel art 1:1 feita só por código, no acabamento
dos prédios da fazenda (fazenda_fora.py) e de Santo Berço (vila_predios.py). A referência é a ilha do mapa-múndi
(client/public/arte/mapa/lugar-igarape-hd.png).

Tudo desenhado no giro 4 (a frente para +y), a pegada começando em (0, 0), no tamanho do catálogo (shared/src/furni.ts,
o bloco de Igarapé: width x depth em casas de 0,75 m; o `height` de lá em METROS). Os prédios têm a PORTA na face da
frente, com o meio na casa floor(width / 2): o seed põe a peça "entrada" na casa logo à frente dela.

As fachadas usam o `_andar` do vila_predios.py (as janelas, as portas e a moldura em volta delas, e a conferência de
que nada fica em cima de nada, `_conferir_vaos`). Só que lá ele faz o enxaimel medieval; aqui o mesmo `_andar` vira a
casa colonial mineira pelo `_colonial()`: a "viga" vira a moldura pintada (os cunhais nas quinas, as cercaduras em
volta dos vãos, o barrado embaixo e a cimalha em cima), sem escoras nem esteios no meio dos panos, as folhas das
janelas e as portas azuis, e a luz da janela acesa é a lâmpada amarela de dentro (não o cristal vermelho da vila).
"""
import contextlib
import math

import numpy as np

import cozinha as CZ
import base_estilo as BE
import fazenda_fora as FF
import vila_predios as VP
import vila_natureza as VN
from base_estilo import hx, liso, mad2, _tom, PZ, PH
from motor import emissivo, ruido, suave, MUNDO as M

CASA = 0.75

# ---------------------------------------------------------------- a paleta de Igarapé
CAL = '#efeae0'            # a parede caiada (branca, um pouco encardida embaixo)
AZUL = '#2c5a92'           # a moldura pintada: cunhais, cercaduras, barrado, cimalha
AZUL_J = '#21466f'         # o batente das janelas e das portas (um tom abaixo)
AZUL_FOLHA = ['#3a6aa6', '#34629c', '#4072ae']     # as folhas das janelas (as tábuas)
AZUL_PORTA = ['#33639e', '#2e5b94', '#386aa6']
OCRE = '#b8862e'           # a outra moldura (a casa ~b): o ocre das casas de Tiradentes
OCRE_J = '#8a6420'
VERDE_FOLHA = ['#3e6e4a', '#386644', '#447652']
# a lâmpada amarela de dentro, vista pela janela (do miolo para a borda)
LUZ_AMARELA = ['#fff0b8', '#ffd47a', '#f2b052', '#c88a3a']
TELHA = ['#b4562e', '#be6236', '#a84e2a', '#c46a3a']      # a telha de barro (capa e canal), queimada de sol
TELHA_J = '#5a2414'
CUMEEIRA = '#9c4426'
# a madeira das palafitas, das canoas e do deque: velha, cinza de chuva por fora
MAD = ['#7a5a3c', '#6e5034', '#846244']
MAD_E = '#4a3424'
PEDRA = ['#a8a090', '#9c9484', '#b2aa9a', '#928a7c']
PEDRA_J = '#5a5448'
AGUA = ['#2e5a5e', '#36686a', '#3e7474', '#5a8e88']

obj = FF.obj
caixa = FF.caixa
fp = FF.fp
pegada = FF.pegada
pegada_redonda = FF.pegada_redonda
_bx = FF._bx

# os prédios altos (a capela com a torre sineira) passam do alto que o exportador reserva: o mesmo jeito do
# vila_predios (a conta da caixa da imagem usa o alto do prédio)
VP.ALTO_CANVAS.update({'igarape_capela': 9.0, 'igarape_venda': 6.0, 'igarape_ipe': 6.8})


# =====================================================================================================================
# o _andar do vila_predios vestido de casa colonial mineira
# =====================================================================================================================
@contextlib.contextmanager
def _colonial(moldura=AZUL_J, folhas=AZUL_FOLHA, porta=AZUL_PORTA, luz=LUZ_AMARELA):
    """
    Enquanto dura, o `_andar` (e o `_janela`, o `_porta`) do vila_predios desenha a casa colonial: a moldura pintada
    só nas quinas e em volta dos vãos (sem esteio no meio do pano: `passo` enorme), as folhas e a porta na cor dada, o
    batente na cor da moldura e a luz amarela de lâmpada na janela acesa. Volta tudo como era no fim.
    """
    salvo = (VP.JANELA_TAB, VP.LUZ_JAN, VP._janela, VP._porta, VP._enxaimel)
    jan0, por0, enx0 = salvo[2], salvo[3], salvo[4]
    VP.JANELA_TAB = folhas
    VP.LUZ_JAN = luz
    VP._janela = lambda *a, **k: jan0(*a, **{'moldura': moldura, **k})
    VP._porta = lambda *a, **k: por0(*a, **{'moldura': moldura, 'cores': porta, **k})
    VP._enxaimel = lambda *a, **k: enx0(*a, **{**k, 'passo': 99.0})
    try:
        yield
    finally:
        VP.JANELA_TAB, VP.LUZ_JAN, VP._janela, VP._porta, VP._enxaimel = salvo


def mat_cal(seed=0, sujeira=0.4):
    """A parede caiada: as manchas grandes do reboco e a sujeira que sobe do chão (a umidade do rio)."""
    return FF.mat_reboco(CAL, seed=seed, sujeira=sujeira)


def _telhado_colonial(B, ZE, ZR, BEI=0.36, seed=0, eixo='x'):
    """O telhado de duas águas de telha de barro, a cumeeira ao longo da fachada (eixo 'x'): o beiral largo na frente."""
    X0, X1, Y0, Y1 = B
    if eixo == 'x':
        YM = (Y0 + Y1) / 2
        KT = (ZR - ZE) / (YM - Y0)
        perfil = [(Y1 + BEI, ZE - BEI * KT), (YM, ZR), (Y0 - BEI, ZE - BEI * KT)]
        FF.telhado(X0, X1, Y0, Y1, perfil, 'x', TELHA, TELHA_J, mat_cal(seed + 1), testeira='#e8e2d4', cumeeira=CUMEEIRA,
                   seed=seed, beiral_u=0.3, musgo=0.25)
    else:
        XM = (X0 + X1) / 2
        KT = (ZR - ZE) / (XM - X0)
        perfil = [(X0 - BEI, ZE - BEI * KT), (XM, ZR), (X1 + BEI, ZE - BEI * KT)]
        FF.telhado(Y0, Y1, X0, X1, perfil, 'y', TELHA, TELHA_J, mat_cal(seed + 1), testeira='#e8e2d4', cumeeira=CUMEEIRA,
                   seed=seed, beiral_u=0.3, musgo=0.25)
    return perfil


def _barrado(B, z1=0.32, cor=AZUL):
    """O barrado pintado embaixo da parede (a faixa que protege da lama da chuva), um tico para fora do reboco."""
    X0, X1, Y0, Y1 = B
    e = 0.012
    caixa((X0 - e, X1 + e, Y0 - e, Y1 + e, 0.0, z1), {'cima': liso(_hex(_tom(hx(cor), 1.12))), '*': liso(cor)})


def _hex(c):
    return '#%02x%02x%02x' % tuple(np.clip(np.round(np.asarray(c, float)), 0, 255).astype(int))


def _vaso_flor(x, y, cor='#d84a6a'):
    """O vaso de barro na soleira com a folhagem e as florzinhas (a casa mineira cuidada)."""
    o = obj()
    CZ.c.cilindro(x, y, 0.12, 0.0, 0.22, BE.vol(x, y, '#a85a34'), M, o, lados=12, r1=0.15)
    om = obj()
    rng = np.random.default_rng(int(x * 100 + y * 10))
    m = FF.mat_folha((x, y, 0.4), (0.3, 0.3, 0.25), FF.FOLHA_PAL, q=0.05, seed=int(x * 7) % 13, flores=(cor, '#f6e27a'))
    FF._cachos(om, x, y, 0.36, 0.17, 0.15, 10, 0.05, 0.08, rng, m)
    pegada_redonda(x, y, 0.16, 4)


# =====================================================================================================================
# a casa (7 x 5 casas, 4,6 m): a casinha térrea de parede caiada, as janelas azuis de folhas abertas, a porta azul no
# meio da casa floor(7/2), o telhado de barro de duas águas com o beiral largo na frente e a chaminé do fogão de lenha
# =====================================================================================================================
def _casa(moldura=AZUL, batente=AZUL_J, folhas=AZUL_FOLHA, porta=AZUL_PORTA, seed=0):
    W, D = 7 * CASA, 5 * CASA
    X0, X1, Y0, Y1 = 0.3, W - 0.3, 0.35, D - 0.55
    B = (X0, X1, Y0, Y1)
    XP = VP._porta_x(7)
    ZE, ZR = 2.75, 4.55
    YM = (Y0 + Y1) / 2
    caixa((X0, X1, Y0, Y1, 0, ZE), mat_cal(seed))
    _barrado(B)
    J = 1.0                          # o peitoril das janelas
    vaos = {
        '+y': [('p', XP, 0.9, 2.05, 1, False), ('j', X0 + 0.85, J, 0.62, 0.95, True, True), ('j', X1 - 0.8, J, 0.62, 0.95, False, True)],
        '-y': [('j', X0 + 1.5, J, 0.62, 0.95, False, True), ('j', X1 - 1.4, J, 0.62, 0.95, False, True)],
        '+x': [('j', YM, J, 0.62, 0.95, True, True)],
        '-x': [('j', YM, J, 0.62, 0.95, False, True)],
    }
    with _colonial(moldura=batente, folhas=folhas, porta=porta):
        # a cimalha (a moldura de cima) fica embaixo do beiral: o telhado na frente da parede já está abaixo de ZE
        VP._andar(B, 0.0, ZE - 0.16, vaos, cor=moldura, seed=seed + 3, soleira=False, escoras=False)
    # o degrau de pedra na porta
    VP._degraus('+y', Y1, XP, 1.1, 0.16, n=1, prof=0.2, seed=seed)
    _telhado_colonial(B, ZE, ZR, seed=seed + 5)
    # a chaminé do fogão de lenha (a cozinha fica nos fundos, à direita), com a fumacinha
    FF.chamine(X1 - 1.0, X1 - 0.6, Y0 + 0.25, Y0 + 0.65, ZE - 0.3, ZR + 0.15)
    VP._fumaca(X1 - 0.8, Y0 + 0.45, ZR + 0.2, n=3, seed=seed + 2, r=0.12, sobe=0.28)
    # os vasos de flor na frente
    _vaso_flor(X0 + 0.25, Y1 + 0.24)
    _vaso_flor(XP + 0.72, Y1 + 0.22, cor='#f0f0f0')
    pegada(X0, X1, Y0, Y1)




# =====================================================================================================================
# a venda da beira do rio (8 x 6 casas, 5,2 m): o armazém de parede caiada com as duas portas de comércio, a tábua
# azul com o peixe pintado em cima da porta (sem letreiro), as sacas e o barril na calçada
# =====================================================================================================================
def _peixe_placa(x0, x1, y, z0, z1):
    """A tábua da venda: azul com a borda clara e o peixe branco pintado (a cidade do rio); nada escrito."""
    def m(L, n, P):
        u = (P[:, 0] - x0) / (x1 - x0)
        v = (P[:, 2] - z0) / (z1 - z0)
        out = np.tile(hx('#2e5e96'), (len(P), 1))
        borda = (u < 0.035) | (u > 0.965) | (v < 0.12) | (v > 0.88)
        out = np.where(borda[:, None], hx('#e6dcc4'), out)
        # o peixe: o corpo (elipse), o rabo (triângulo) e o olho
        cu, cv = 0.46, 0.5
        corpo = ((u - cu) / 0.2) ** 2 + ((v - cv) / 0.27) ** 2 < 1
        du = u - (cu + 0.2)
        rabo = (du > -0.02) & (du < 0.12) & (np.abs(v - cv) < 0.06 + du * 2.2)
        olho = ((u - (cu - 0.12)) / 0.025) ** 2 + ((v - (cv + 0.05)) / 0.09) ** 2 < 1
        out = np.where((corpo | rabo)[:, None], hx('#f2eee4'), out)
        out = np.where(olho[:, None], hx('#2e5e96'), out)
        return out
    caixa((x0 - 0.03, x1 + 0.03, y, y + 0.05, z0 - 0.03, z1 + 0.03), liso('#6a4a30'))
    o = obj()
    CZ.c.caixa((x0, x1, y + 0.05, y + 0.07, z0, z1), {'frente': emissivo(m), '*': liso('#2e5e96')}, M, o)


def _venda():
    W, D = 8 * CASA, 6 * CASA
    X0, X1, Y0, Y1 = 0.3, W - 0.3, 0.35, D - 0.6
    B = (X0, X1, Y0, Y1)
    XP = VP._porta_x(8)
    ZE, ZR = 3.3, 5.15
    YM = (Y0 + Y1) / 2
    caixa((X0, X1, Y0, Y1, 0, ZE), mat_cal(7, sujeira=0.55))
    _barrado(B, 0.4)
    vaos = {
        '+y': [('p', XP, 1.25, 2.35, 2, False), ('p', X0 + 1.05, 0.9, 2.35, 1, False),
               ('j', X1 - 0.78, 1.05, 0.62, 0.95, True, True)],
        '-y': [('j', X0 + 1.6, 1.1, 0.62, 0.9, False, True), ('j', X1 - 1.6, 1.1, 0.62, 0.9, False, True)],
        '+x': [('j', YM, 1.05, 0.62, 0.95, True, True)],
        '-x': [('j', YM, 1.05, 0.62, 0.95, False, True)],
    }
    with _colonial():
        VP._andar(B, 0.0, ZE - 0.16, vaos, cor=AZUL, seed=31, soleira=False, escoras=False)
    VP._degraus('+y', Y1, XP, 1.6, 0.16, n=1, prof=0.22, seed=3)
    VP._degraus('+y', Y1, X0 + 1.05, 1.2, 0.16, n=1, prof=0.22, seed=4)
    _peixe_placa(XP - 0.9, XP + 0.9, Y1, 2.57, 2.87)
    _telhado_colonial(B, ZE, ZR, BEI=0.3, seed=33)
    # a calçada: as sacas de feijão e de farinha, o barril, o vaso
    FF._saco((X0 + 1.75, X0 + 2.15, Y1 + 0.08, Y1 + 0.62, 0.0, 0.3), '#c8ac7c', 1, boca='y+')
    FF._saco((X0 + 2.0, X0 + 2.38, Y1 + 0.12, Y1 + 0.6, 0.3, 0.55), '#d2b88a', 2, boca='y+')
    CZ.barril(X1 - 1.5, Y1 + 0.34, r=0.24, h=0.75)
    _vaso_flor(X1 - 0.2, Y1 + 0.25, cor='#e8b030')
    pegada(X0, X1, Y0, Y1)


# =====================================================================================================================
# a capelinha (6 x 8 casas, 8,4 m): a nave caiada de frente para a rua (o frontão é a empena da frente), a porta azul
# de duas folhas, as duas janelas do coro, o óculo, a sineira com o sino em cima do frontão e a cruz; o adro de pedra
# =====================================================================================================================
SINO = '#b08a3a'


def _cor_eli(cor):
    """Material de elipsoide de uma cor só (já compensada da luz)."""
    return lambda L, N, P: FF._cru_eli(np.tile(hx(cor), (len(P), 1)), N)


def _sino(x, y, z, r=0.13, h=0.26):
    """O sino de bronze (o tronco de cone com a boca aberta) e o badalo."""
    o = obj()
    CZ.c.cilindro(x, y, r, z, z + h * 0.75, BE.vol(x, y, SINO, brilho=0.4), M, o, lados=16, r1=r * 0.55)
    CZ.c.elipsoide((x, y, z + h * 0.78), (r * 0.56, r * 0.56, h * 0.22), _cor_eli(SINO), o)
    caixa((x - 0.015, x + 0.015, y - 0.015, y + 0.015, z - 0.05, z + 0.1), liso('#3a2a1a'), contorno=False)


def _cruz(x, y, z, h=0.7, cor='#e8e2d4', esp=0.07):
    caixa((x - esp / 2, x + esp / 2, y - esp / 2, y + esp / 2, z, z + h), liso(cor))
    caixa((x - h * 0.3, x + h * 0.3, y - esp / 2, y + esp / 2, z + h * 0.6, z + h * 0.6 + esp), liso(cor))


def _arco_pintado(base, cx, z_mola, meia, alto, piso, fundo='#1e1a1c'):
    """Um vão em arco pintado na face (o vão da sineira): o escuro dentro do arco."""
    def f(L, n, P):
        out = base(L, n, P)
        u = (P[:, 0] - cx) / meia
        v = (P[:, 2] - z_mola) / alto
        dentro = (np.abs(u) < 1) & (P[:, 2] > piso) & ((v < 0) | (u * u + v * v < 1))
        return np.where(dentro[:, None], hx(fundo), out)
    return emissivo(f)


def _capela():
    D = 8 * CASA
    XP = VP._porta_x(6)
    X0, X1 = XP - 1.85, XP + 1.85
    Y0, Y1 = 0.45, D - 0.85
    B = (X0, X1, Y0, Y1)
    ZE, ZR = 4.3, 6.35
    XM = (X0 + X1) / 2
    caixa((X0, X1, Y0, Y1, 0, ZE), mat_cal(11, sujeira=0.35))
    _barrado(B, 0.36)
    vaos = {
        '+y': [('p', XP, 1.2, 2.6, 2, False), ('j', XM - 1.15, 2.95, 0.46, 0.8, True, False), ('j', XM + 1.15, 2.95, 0.46, 0.8, True, False)],
        '+x': [('j', Y0 + 1.3, 1.9, 0.5, 1.15, True, False), ('j', Y1 - 1.4, 1.9, 0.5, 1.15, True, False)],
        '-x': [('j', Y0 + 1.3, 1.9, 0.5, 1.15, True, False), ('j', Y1 - 1.4, 1.9, 0.5, 1.15, True, False)],
        '-y': [('j', XM, 2.2, 0.5, 0.9, False, False)],
    }
    # a luz de vela de dentro, mais quente que a das casas
    vela = ['#ffe2a0', '#f8b860', '#d8883a', '#a8602a']
    with _colonial(luz=vela):
        VP._andar(B, 0.0, ZE - 0.16, vaos, cor=AZUL, seed=41, soleira=False, escoras=False)
    # o adro: dois degraus largos de pedra
    VP._degraus('+y', Y1, XP, 2.4, 0.3, n=2, prof=0.24, seed=5)
    # o telhado de duas águas com a empena na frente (a cumeeira ao longo de y): o frontão
    _telhado_colonial(B, ZE, ZR, BEI=0.3, seed=43, eixo='y')
    # a cimalha do frontão: a moldura branca grossa que sobe pelas duas águas na frente da empena
    KT = (ZR - ZE) / (XM - X0)
    o = obj()
    e1 = Y1 + 0.3 + 0.04
    for sg in (-1, 1):
        xa, xb = (X0 - 0.3, XM) if sg < 0 else (XM, X1 + 0.3)
        za, zb = (ZE - 0.3 * KT, ZR) if sg < 0 else (ZR, ZE - 0.3 * KT)
        fp([(xa, e1, za - 0.02), (xb, e1, zb - 0.02), (xb, e1, zb + 0.14), (xa, e1, za + 0.14)], (0, 1, 0), liso('#f4f0e6'), o)
    # o óculo no meio do frontão
    FF.oculo(B, '+y', XM, ZE + 0.85, r=0.26)
    # a sineira: a parede de cal em cima da cumeeira da frente, com o vão em arco, o sino e a cruz no alto
    SY0, SY1 = Y1 - 0.25, Y1 + 0.05
    SX0, SX1 = XM - 0.42, XM + 0.42
    SZ0, SZ1 = ZR - 0.6, ZR + 1.05
    base = mat_cal(13, sujeira=0.0)
    arco = _arco_pintado(base, XM, ZR + 0.6, 0.22, 0.22, piso=ZR + 0.12)
    oc = obj()
    CZ.c.caixa((SX0, SX1, SY0, SY1, SZ0, SZ1), {'frente': arco, 'costas': arco, '*': base}, M, oc)
    caixa((SX0 - 0.05, SX1 + 0.05, SY0 - 0.05, SY1 + 0.05, SZ1, SZ1 + 0.08), liso('#d8d0c0'))
    _sino(XM, SY1 + 0.03, ZR + 0.3)
    _cruz(XM, (SY0 + SY1) / 2, SZ1 + 0.08, h=0.62, cor='#e0d8c4')
    for xx in (SX0, SX1 - 0.07):
        caixa((xx, xx + 0.07, SY1, SY1 + 0.02, SZ0 + 0.55, SZ1), liso(AZUL), contorno=False)
    _vaso_flor(XP - 1.25, Y1 + 0.3, cor='#f4f0e8')
    _vaso_flor(XP + 1.25, Y1 + 0.3, cor='#f4f0e8')
    pegada(X0, X1, Y0, Y1)


# =====================================================================================================================
# a palafita (5 x 5 casas): a casa de tábuas em cima das estacas, metade na margem e a coluna da direita (u = 4) por
# cima da água (`vazio` no catálogo: o jogo não pede chão ali), a varanda de tábuas na frente com o guarda-corpo, a
# escadinha até o chão, a rede pendurada na varanda, as janelas azuis e o telhado de barro
# =====================================================================================================================
Z_PAL = 0.85               # o assoalho da palafita
X_AGUA = 3.0               # daqui para +x é água (a coluna u = 4)
Z_AGUA = -0.21             # a água do tabuleiro fica 0,35 unidade abaixo do chão


def _estaca(x, y, z1, r=0.065):
    """A estaca de pau roliço: na margem, sai do chão; na água, do fundo, com o anel de marola em volta."""
    z0 = Z_AGUA - 0.02 if x >= X_AGUA else 0.0
    o = obj()
    CZ.c.cilindro(x, y, r, z0, z1, BE.vol(x, y, '#5e4632'), M, o, lados=10, tampa=False)
    if x >= X_AGUA:
        om = obj(contorno=False, sombra=False)
        anel = [(x + 0.16 * math.cos(a), y + 0.1 * math.sin(a), Z_AGUA + 0.004) for a in np.linspace(0, 2 * math.pi, 14, endpoint=False)]
        fp(anel, (0, 0, 1), liso('#6a9a94'), om)
        dentro = [(x + 0.1 * math.cos(a), y + 0.065 * math.sin(a), Z_AGUA + 0.006) for a in np.linspace(0, 2 * math.pi, 12, endpoint=False)]
        fp(dentro, (0, 0, 1), liso(AGUA[1]), om)


def _rede_pano(x0, x1, ya, yb, za, zb, sag, cores, o, n=9):
    """O pano da rede: as faixas coloridas (ao longo de x) que caem em curva entre as duas pontas presas (em y)."""
    pal = np.stack([hx(c_) for c_ in cores])

    def m(L, nn, P):
        k = np.floor((P[:, 0] - x0) / ((x1 - x0) / 7)).astype(int) % len(cores)
        return pal[k]
    ys = np.linspace(ya, yb, n)
    xm = (x0 + x1) / 2
    for i in range(n - 1):
        y_0, y_1 = ys[i], ys[i + 1]
        t0, t1 = (y_0 - ya) / (yb - ya), (y_1 - ya) / (yb - ya)
        z_0 = za + (zb - za) * t0 - sag * 4 * t0 * (1 - t0)
        z_1 = za + (zb - za) * t1 - sag * 4 * t1 * (1 - t1)
        l0 = 0.35 + 0.65 * math.sin(math.pi * t0)
        l1 = 0.35 + 0.65 * math.sin(math.pi * t1)
        h0, h1 = (x1 - x0) / 2 * l0, (x1 - x0) / 2 * l1
        # duas metades: a rede faz uma calha (o meio mais baixo)
        for s in (-1, 1):
            q = [(xm, y_0, z_0 - 0.05 * l0), (xm + s * h0, y_0, z_0 + 0.04), (xm + s * h1, y_1, z_1 + 0.04), (xm, y_1, z_1 - 0.05 * l1)]
            nz = np.cross(np.subtract(q[1], q[0]), np.subtract(q[3], q[0]))
            if nz[2] < 0:
                nz = -nz
            fp(q, tuple(nz / np.linalg.norm(nz)), emissivo(m), o, dois_lados=True)


REDE_CORES = ['#c8402e', '#e8b838', '#2e6aa6', '#e8e0cc', '#3a8a5a', '#e8b838', '#c8402e']


def _palafita(variante='a'):
    """variante 'b': a outra palafita (sem nome): a janela da frente apagada, a de trás acesa, sem a rede."""
    b = variante == 'b'
    X0, X1, Y0, Y1 = 0.3, 3.4, 0.25, 2.05
    B = (X0, X1, Y0, Y1)
    XP = VP._porta_x(5)
    YV = 2.95                       # a beira da varanda
    ZE = Z_PAL + 2.15
    ZR = ZE + 1.15
    YM = (Y0 + Y1) / 2
    # as estacas (a grade de baixo) e as travessas que amarram
    xs = (0.36, 1.3, 2.3, 3.32)
    ys = (0.32, 1.15, 1.98, 2.88)
    for x in xs:
        for y in ys:
            _estaca(x, y, Z_PAL - 0.08)
    mv = mad2(MAD_E, eixo=0, seed=3, passo=0.05)
    for y in ys:
        caixa((xs[0] - 0.05, xs[-1] + 0.05, y - 0.05, y + 0.05, Z_PAL - 0.2, Z_PAL - 0.08), mv)
    # o assoalho (a casa e a varanda)
    tab = BE.tab2(MAD, 0.14, '#3a2818', eixo=1, seed=5)
    caixa((0.24, 3.48, 0.2, YV, Z_PAL - 0.08, Z_PAL), {'cima': tab, '*': mad2('#5a4230', eixo=0, seed=6, passo=0.05)})
    # a casa de tábuas em pé
    parede = FF.mat_tabua_v(MAD, 0.13, '#3a2818', seed=7)
    caixa((X0, X1, Y0, Y1, Z_PAL, ZE), parede)
    vaos = {
        '+y': [('p', XP, 0.82, 1.8, 1, False), ('j', X1 - 0.62, Z_PAL + 1.0, 0.56, 0.7, not b, False)],
        '+x': [('j', YM, Z_PAL + 1.0, 0.56, 0.7, True, True)],
        '-x': [('j', YM, Z_PAL + 1.0, 0.56, 0.7, b, True)],
        '-y': [('j', X0 + 1.2, Z_PAL + 1.0, 0.56, 0.7, b, True)],
    }
    with _colonial():
        VP._andar(B, Z_PAL, ZE - 0.14, vaos, cor='#5a4230', seed=51, soleira=False, escoras=False)
    _telhado_colonial(B, ZE, ZR, BEI=0.55, seed=53)
    # os esteios da varanda e o guarda-corpo
    for x in (X0 + 0.05, X1 - 0.05):
        caixa((x - 0.05, x + 0.05, YV - 0.13, YV - 0.03, Z_PAL, ZE - 0.18), mad2('#6a4c34', eixo=1, seed=8, passo=0.05))
    gc = mad2('#7a5a3e', eixo=0, seed=9, passo=0.05)
    for (a, b) in ((0.26, XP - 0.45), (XP + 0.45, 3.46)):
        caixa((a, b, YV - 0.1, YV - 0.04, Z_PAL + 0.82, Z_PAL + 0.88), gc)
        caixa((a, b, YV - 0.1, YV - 0.05, Z_PAL + 0.4, Z_PAL + 0.45), gc)
        for x in np.arange(a + 0.02, b - 0.02, 0.36):
            caixa((x, x + 0.05, YV - 0.1, YV - 0.05, Z_PAL, Z_PAL + 0.82), gc)
    # o lado da água também tem guarda-corpo
    gy = mad2('#7a5a3e', eixo=1, seed=10, passo=0.05)
    caixa((3.42, 3.47, Y1, YV - 0.04, Z_PAL + 0.82, Z_PAL + 0.88), gy)
    caixa((3.42, 3.47, Y1, YV - 0.04, Z_PAL + 0.4, Z_PAL + 0.45), gy)
    # a escadinha até o chão
    for k in range(3):
        zt = Z_PAL - (k + 1) * Z_PAL / 3.4
        y0 = YV + k * 0.2
        caixa((XP - 0.42, XP + 0.42, y0, y0 + 0.22, zt - 0.05, zt), {'cima': tab, '*': mad2('#5a4230', eixo=0, seed=10, passo=0.05)})
    for s in (-1, 1):
        o = obj()
        FF._viga(o, (XP + s * 0.44, YV, Z_PAL), (XP + s * 0.44, YV + 0.66, 0.0), 0.05, mad2(MAD_E, eixo=1, seed=11, passo=0.05))
    # a rede de dormir pendurada na varanda, da parede ao esteio
    if not b:
        _rede_pano(X1 - 0.85, X1 - 0.3, Y1 + 0.08, YV - 0.18, Z_PAL + 1.35, Z_PAL + 1.35, 0.6, REDE_CORES, obj())
    # o pote de barro e o remo encostado na parede
    CZ.c.cilindro(X0 + 0.3, Y1 + 0.3, 0.13, Z_PAL, Z_PAL + 0.3, BE.vol(X0 + 0.3, Y1 + 0.3, '#a8582e'), M, obj(), lados=12, r1=0.09)
    o = obj()
    FF._viga(o, (X0 + 0.7, Y1 + 0.06, Z_PAL), (X0 + 0.78, Y1 + 0.1, Z_PAL + 1.5), 0.035, mad2('#8a6a44', eixo=1, seed=12))
    caixa((X0 + 0.62, X0 + 0.86, Y1 + 0.04, Y1 + 0.1, Z_PAL + 0.02, Z_PAL + 0.42), liso('#8a6a44'))
    pegada(0.24, 3.48, 0.2, YV)


# =====================================================================================================================
# a ponte de pedra em arco (6 x 2 casas, pisável): o tabuleiro de pé-de-moleque a 0,6 m, os dois parapeitos com o
# capeamento claro, as cabeceiras na margem (as casas 0 e 5) e o arco abatido por cima da água (as casas 1 a 4),
# com as aduelas em volta e o escuro de baixo do arco refletindo na água
# =====================================================================================================================
Z_PONTE = 0.6


def _id_pe_de_moleque(P):
    fila = np.floor(P[:, 1] / 0.16 + 50)
    col = np.floor(P[:, 0] / 0.2 + 0.5 * (fila % 2) + 0.35 * np.sin(fila * 2.1))
    return (fila * 1000 + col).astype(np.int64)


def _ponte():
    W = 6 * CASA
    A0, A1 = CASA, W - CASA              # o vão do rio
    AM = (A0 + A1) / 2
    meia = (A1 - A0) / 2 + 0.05
    z_mola = Z_AGUA - 0.02
    alto = 0.6
    pedra = FF.mat_juntas(PEDRA, FF.id_pedras_parede(0.13, 0.3, seed=4), PEDRA_J, seed=6)

    def face_arco(L, n, P):
        out = pedra(L, n, P)
        u = (P[:, 0] - AM) / meia
        v = (P[:, 2] - z_mola) / alto
        r = np.sqrt(u * u + np.maximum(v, 0) ** 2)
        dentro = r < 1
        aduela = (r >= 1) & (r < 1.0 + 0.2 / alto) & (v > -0.05)
        # as aduelas: as pedras em leque num tom mais claro, a junta entre elas
        ang = np.arctan2(np.maximum(v, 0), u)
        jun = np.floor(ang / 0.17) != np.floor((ang + 0.03) / 0.17)
        out = np.where(aduela[:, None], np.where(jun[:, None], hx(PEDRA_J), hx('#bab2a2')), out)
        # debaixo do arco: o escuro, com o reflexo da água embaixo
        agua = P[:, 2] < Z_AGUA + 0.07
        fundo = np.where(agua[:, None], hx('#24403e'), hx('#1a1c1e'))
        refl = agua & (((P[:, 0] * 7.3) % 1) < 0.22)
        fundo = np.where(refl[:, None], hx('#3e6a66'), fundo)
        return np.where(dentro[:, None], fundo, out)
    m_arco = emissivo(face_arco)
    y0, y1 = 0.04, 1.46
    pm = FF.mat_juntas(['#9a9282', '#a8a090', '#8e8676', '#b0a898'], _id_pe_de_moleque, '#4e483e', seed=8)
    degrau = {'cima': pm, '*': pedra}
    # o meio por cima da água (com o arco pintado) e o tabuleiro de pé-de-moleque
    o = obj()
    CZ.c.caixa((A0, A1, y0, y1, Z_AGUA - 0.02, Z_PONTE - 0.06), {'frente': m_arco, 'costas': m_arco, '*': pedra}, M, o)
    caixa((A0, A1, y0, y1, Z_PONTE - 0.06, Z_PONTE), degrau)
    # as cabeceiras (17/10, o Felipe: "se ela for mais altinha, que tenha uma escadinha"): em cada margem, quatro
    # degraus de pedra subindo da terra até o tabuleiro, ao longo da casa da ponta (o jogo põe a peça a 0,3 m nela)
    n = 4
    for i in range(n):
        z = Z_PONTE * (i + 1) / (n + 1)
        a = CASA * i / n
        caixa((a, A0, y0, y1, 0.0, z), degrau)
        caixa((W - A0, W - a, y0, y1, 0.0, z), degrau)
    # as muretas baixas dos lados da escadinha, acompanhando os degraus
    mureta = {'cima': liso('#c4bcac'), '*': pedra}
    for (a, b) in ((y0, 0.16), (1.34, y1)):
        for i in range(n):
            z = Z_PONTE * (i + 1) / (n + 1) + 0.12
            x0 = CASA * i / n
            caixa((x0, A0, a, b, 0.0, z), mureta)
            caixa((W - A0, W - x0, a, b, 0.0, z), mureta)
    # os parapeitos só por cima do vão (com o capeamento) e os pilaretes no alto da escadinha
    cap = {'cima': liso('#c4bcac'), '*': liso('#aaa292')}
    for (a, b) in ((y0, 0.2), (1.3, y1)):
        caixa((A0, A1, a, b, Z_PONTE, Z_PONTE + 0.42), pedra)
        caixa((A0, A1, a - 0.025, b + 0.025, Z_PONTE + 0.42, Z_PONTE + 0.5), cap)
        for x in (A0 - 0.15, A1 - 0.15):
            caixa((x, x + 0.3, a - 0.03, b + 0.03, 0.0, Z_PONTE + 0.62), pedra)
            caixa((x - 0.02, x + 0.32, a - 0.05, b + 0.05, Z_PONTE + 0.62, Z_PONTE + 0.7), cap)
    pegada(0.0, W, y0, y1)


# =====================================================================================================================
# a canoa (1 x 4 casas): a canoa de um pau só puxada para a beira, com o banco atravessado, o remo dentro e a corda
# amarrada na estaca fincada no barro
# =====================================================================================================================
def _secao(y, meia, fundo, borda, n=7):
    """A seção da canoa em y: o U do casco (da borda de um lado, pelo fundo, até a outra borda)."""
    pts = []
    for i in range(n):
        a = math.pi * i / (n - 1)
        pts.append((0.375 + meia * math.cos(a), y, borda - (borda - fundo) * math.sin(a)))
    return pts


def _loft(o, secoes, mat, centro_fn, fora=True):
    """As faces entre seções seguidas, com a normal para fora (ou para dentro) do eixo dado por centro_fn(y)."""
    for s0, s1 in zip(secoes[:-1], secoes[1:]):
        for i in range(len(s0) - 1):
            q = [s0[i], s0[i + 1], s1[i + 1], s1[i]]
            nrm = np.cross(np.subtract(q[1], q[0]), np.subtract(q[3], q[0]))
            if np.linalg.norm(nrm) < 1e-9:
                nrm = np.cross(np.subtract(q[2], q[1]), np.subtract(q[3], q[1]))
            if np.linalg.norm(nrm) < 1e-9:
                continue
            nrm = nrm / np.linalg.norm(nrm)
            mid = np.mean(q, axis=0)
            dirc = mid - np.asarray(centro_fn(mid[1]))
            if (nrm @ dirc < 0) == fora:
                nrm = -nrm
            fp(q, tuple(nrm), mat, o)


def _canoa():
    y0, y1 = 0.12, 2.88
    ym = (y0 + y1) / 2
    borda = 0.36
    ys = np.linspace(y0, y1, 13)

    def meia_de(y):
        t = (y - ym) / ((y1 - y0) / 2)
        return 0.02 + 0.29 * max(0.0, 1 - t * t) ** 0.55, t

    fora, dentro = [], []
    for y in ys:
        meia, t = meia_de(y)
        k = (meia - 0.02) / 0.29
        fundo = borda - (0.02 + 0.32 * k)
        fora.append(_secao(y, meia, max(0.02, fundo), borda + 0.05 * t * t))
        dentro.append(_secao(y, max(0.005, meia - 0.04), max(0.08, fundo + 0.06), borda + 0.05 * t * t - 0.01))
    o = obj()
    _loft(o, fora, mad2('#7e5c40', eixo=1, seed=2, passo=0.06), lambda y: (0.375, y, borda + 0.2), fora=True)
    oi = obj(contorno=False)
    _loft(oi, dentro, mad2('#54402e', eixo=1, seed=4, passo=0.06), lambda y: (0.375, y, borda + 0.2), fora=False)
    # o friso claro da borda
    for s in (-1, 1):
        pts = []
        for y in ys:
            meia, t = meia_de(y)
            pts.append((0.375 + s * meia, y, borda + 0.05 * t * t))
        for (a, b) in zip(pts[:-1], pts[1:]):
            q = [a, b, (b[0] - s * 0.035, b[1], b[2]), (a[0] - s * 0.035, a[1], a[2])]
            fp(q, (0, 0, 1), liso('#8a6a4c'), o)
    # o banco atravessado e o remo dentro
    caixa((0.375 - 0.26, 0.375 + 0.26, ym - 0.35, ym - 0.2, borda - 0.1, borda - 0.05), liso('#7a5a3e'))
    orm = obj()
    FF._viga(orm, (0.35, ym + 0.15, 0.16), (0.41, y1 - 0.3, 0.3), 0.035, mad2('#c0a070', eixo=1, seed=5))
    caixa((0.3, 0.44, ym - 0.05, ym + 0.3, 0.12, 0.15), liso('#c0a070'))
    # a estaca na proa e a corda até ela
    CZ.c.cilindro(0.62, 2.84, 0.035, 0.0, 0.62, BE.vol(0.62, 2.84, '#6a5038'), M, obj(), lados=8)
    oc = obj(contorno=False)
    FF._viga(oc, (0.4, y1 - 0.05, borda + 0.04), (0.62, 2.84, 0.5), 0.018, liso('#c8b080'))
    pegada(0.375 - 0.31, 0.375 + 0.31, y0 + 0.1, y1 - 0.1)


# =====================================================================================================================
# o ipê amarelo (1 x 1, 6,2 m): o tronco escuro e torto, os galhos abertos e a copa toda de flor amarela, sem folha
# (o ipê floresce pelado), e as flores caídas no chão em volta
# =====================================================================================================================
IPE_PAL = [hx(x) for x in ('#6a4a0c', '#94660e', '#bc8a14', '#dcae22', '#f2cc3a', '#ffe680')]


def _ipe():
    cx = cy = 0.375
    mc = VN.mat_casca('#4a3a2e', seed=4)
    VN._tubo3(obj(), [(cx, cy, 0.0), (cx + 0.04, cy - 0.02, 0.9), (cx - 0.06, cy + 0.02, 1.8), (cx + 0.02, cy, 2.6)],
              [0.19, 0.15, 0.13, 0.11], mc, lados=9)
    galhos = [
        [(cx + 0.02, cy, 2.5), (cx - 0.5, cy + 0.15, 3.2), (cx - 0.95, cy + 0.2, 3.7)],
        [(cx + 0.02, cy, 2.5), (cx + 0.55, cy - 0.15, 3.25), (cx + 1.0, cy - 0.1, 3.75)],
        [(cx, cy, 2.55), (cx + 0.05, cy + 0.4, 3.4), (cx - 0.1, cy + 0.55, 4.1)],
        [(cx, cy, 2.55), (cx - 0.05, cy - 0.35, 3.5), (cx + 0.05, cy - 0.5, 4.3)],
    ]
    o = obj()
    for g in galhos:
        VN._tubo3(o, g, [0.09, 0.06, 0.03], mc, lados=7)
    oc = obj()
    rng = np.random.default_rng(23)
    mat = FF.mat_folha((cx, cy, 4.3), (1.6, 1.6, 1.2), IPE_PAL, q=0.08, seed=23)
    massas = [(cx - 0.95, cy + 0.2, 4.0, 0.85, 0.62), (cx + 1.0, cy - 0.1, 4.05, 0.85, 0.62), (cx - 0.1, cy + 0.55, 4.5, 0.8, 0.6),
              (cx + 0.05, cy - 0.5, 4.75, 0.8, 0.6), (cx, cy, 5.1, 0.8, 0.62)]
    for (x, y, z, R, Rz) in massas:
        FF._cachos(oc, x, y, z, R, Rz, int(54 * R), R * 0.14, R * 0.24, rng, mat, achata=0.8)
    # as flores caídas: manchinhas amarelas no chão em volta do pé
    of = obj(contorno=False, sombra=False)
    rf = np.random.default_rng(7)
    for i in range(26):
        a = rf.random() * 2 * math.pi
        d = 0.25 + rf.random() * 1.25
        px, py = cx + math.cos(a) * d, cy + math.sin(a) * d * 0.9
        r = 0.05 + 0.06 * rf.random()
        pts = [(px + r * math.cos(t) * (0.8 + 0.4 * rf.random()), py + r * math.sin(t) * (0.8 + 0.4 * rf.random()), 0.004)
               for t in np.linspace(0, 2 * math.pi, 7, endpoint=False)]
        fp(pts, (0, 0, 1), liso(['#f2cc3a', '#e8b828', '#ffe070'][i % 3]), of)
    pegada(cx - 0.22, cx + 0.22, cy - 0.22, cy + 0.22)
    pegada_redonda(cx + 0.05, cy + 0.05, 1.2)


# =====================================================================================================================
# por dentro: a rede, o banco de igreja, o altar da capela e a imagem da santa
# =====================================================================================================================
def _rede():
    """A rede de dormir (1 x 3 casas) entre os dois esteios, com os punhos de corda e as faixas coloridas."""
    cx = 0.375
    ya, yb = 0.1, 2.15
    for y in (ya, yb):
        caixa((cx - 0.06, cx + 0.06, y - 0.06, y + 0.06, 0.0, 1.75), mad2('#6a4c34', eixo=1, seed=int(y * 10), passo=0.05))
    oc = obj(contorno=False)
    for (y, y2) in ((ya + 0.06, 0.42), (yb - 0.06, 1.83)):
        for dx in (-0.12, 0.0, 0.12):
            FF._viga(oc, (cx, y, 1.5), (cx + dx, y2, 0.92), 0.012, liso('#d8c8a0'))
    _rede_pano(cx - 0.3, cx + 0.3, 0.42, 1.83, 0.92, 0.92, 0.42, REDE_CORES, obj())
    pegada(cx - 0.3, cx + 0.3, 0.4, 1.85)


IGREJA_MAD = '#5a3a24'


def _banco_igreja():
    """O banco comprido de igreja (3 x 1): o assento de tábua, o encosto alto atrás e as cabeceiras."""
    W = 3 * CASA
    m = mad2(IGREJA_MAD, eixo=0, seed=3, passo=0.05)
    tab = BE.tab2(['#6a4428', '#62402a', '#704a2c'], 0.12, '#3a2414', eixo=0, seed=4)
    caixa((0.1, W - 0.1, 0.12, 0.6, 0.4, 0.45), {'cima': tab, '*': m})
    caixa((0.1, W - 0.1, 0.08, 0.14, 0.45, 0.95), {'*': mad2('#62402a', eixo=0, seed=5, passo=0.05), 'cima': liso('#7a5232')})
    caixa((0.1, W - 0.1, 0.5, 0.56, 0.1, 0.4), m)
    for x in (0.04, W - 0.12):
        caixa((x, x + 0.08, 0.06, 0.64, 0.0, 0.62), m)
        caixa((x, x + 0.08, 0.06, 0.2, 0.62, 0.98), m)
    pegada(0.04, W - 0.04, 0.06, 0.64)


def _altar():
    """O altar da capela (3 x 1, 1 m): a mesa de madeira pintada de branco com a moldura dourada e a cruz azul, a
    toalha de renda caindo na frente, o crucifixo no meio e os dois castiçais."""
    W = 3 * CASA
    x0, x1, y0, y1 = 0.08, W - 0.08, 0.1, 0.66

    def frente(L, n, P):
        u = (P[:, 0] - x0) / (x1 - x0)
        v = P[:, 2] / 0.9
        out = np.tile(hx('#ece6d8'), (len(P), 1))
        q = (np.abs(u - 0.5) < 0.42) & (v > 0.12) & (v < 0.78)
        borda = q & ~((np.abs(u - 0.5) < 0.405) & (v > 0.15) & (v < 0.75))
        out = np.where(q[:, None], hx('#dcd4c2'), out)
        out = np.where(borda[:, None], hx('#c8a040'), out)
        cruz = ((np.abs(u - 0.5) < 0.012) & (v > 0.3) & (v < 0.66)) | ((np.abs(u - 0.5) < 0.06) & (np.abs(v - 0.54) < 0.025))
        return np.where(cruz[:, None], hx('#2c5a92'), out)
    o = obj()
    CZ.c.caixa((x0, x1, y0, y1, 0.0, 0.92), {'frente': emissivo(frente), 'cima': liso('#e8e2d4'), '*': liso('#d8d0c0')}, M, o)
    caixa((x0 - 0.04, x1 + 0.04, y0 - 0.02, y1 + 0.08, 0.0, 0.08), liso('#b8b0a0'))

    def renda(L, n, P):
        out = np.tile(hx('#fbf8f0'), (len(P), 1))
        bico = ((P[:, 0] * 30) % 1 < 0.5) & (P[:, 2] < 0.8)
        return np.where(bico[:, None], hx('#e6e0d2'), out)
    caixa((x0 - 0.03, x1 + 0.03, y0 - 0.02, y1 + 0.03, 0.92, 1.0), {'cima': liso('#fbf8f0'), '*': emissivo(renda)})
    CZ.c.caixa((x0 - 0.03, x1 + 0.03, y1 + 0.03, y1 + 0.045, 0.76, 0.92), emissivo(renda), M, obj(contorno=False))
    # o crucifixo e os castiçais
    xm = (x0 + x1) / 2
    caixa((xm - 0.08, xm + 0.08, 0.2, 0.32, 1.0, 1.05), liso('#8a6a30'))
    caixa((xm - 0.015, xm + 0.015, 0.25, 0.28, 1.05, 1.48), liso('#6a4a24'))
    caixa((xm - 0.11, xm + 0.11, 0.25, 0.28, 1.34, 1.37), liso('#6a4a24'))
    caixa((xm - 0.012, xm + 0.012, 0.28, 0.29, 1.2, 1.34), liso('#d8c8a8'), contorno=False)
    for x in (x0 + 0.3, x1 - 0.3):
        CZ.c.cilindro(x, 0.35, 0.05, 1.0, 1.04, BE.vol(x, 0.35, '#c8a040', brilho=0.4), M, obj(), lados=12)
        CZ.c.cilindro(x, 0.35, 0.015, 1.04, 1.24, BE.vol(x, 0.35, '#c8a040', brilho=0.4), M, obj(), lados=8)
        CZ.c.cilindro(x, 0.35, 0.022, 1.24, 1.42, BE.vol(x, 0.35, '#f4eee0'), M, obj(), lados=10)
    CZ.itens_peq.append((xm - 0.08, xm + 0.08, 0.2, 0.32, 1.0))
    pegada(x0, x1, y0, y1)


def _santa():
    """A imagem de Nossa Senhora (1 x 1, 1,7 m) na peanha de madeira: o manto azul, o vestido branco, a coroa."""
    cx = cy = 0.375
    caixa((cx - 0.24, cx + 0.24, cy - 0.24, cy + 0.24, 0.0, 0.12), mad2('#6a4428', eixo=1, seed=3, passo=0.05))
    caixa((cx - 0.17, cx + 0.17, cy - 0.17, cy + 0.17, 0.12, 0.82), {'*': mad2('#7a5232', eixo=1, seed=4, passo=0.05), 'cima': liso('#8a6a40')})
    caixa((cx - 0.22, cx + 0.22, cy - 0.22, cy + 0.22, 0.82, 0.9), liso('#c8a040'))
    # o manto azul atrás e dos lados, aberto na frente, e o vestido branco aparecendo no meio
    om = obj()
    CZ.c.cilindro(cx, cy - 0.04, 0.16, 0.9, 1.5, BE.vol(cx, cy - 0.04, '#2e5a9a'), M, om, lados=16, r1=0.075, tampa=False)
    o = obj()
    CZ.c.cilindro(cx, cy + 0.035, 0.12, 0.9, 1.42, BE.vol(cx, cy + 0.035, '#ece6dc'), M, o, lados=16, r1=0.06)
    # o véu, o rosto, a coroa e as mãos postas
    CZ.c.elipsoide((cx, cy - 0.025, 1.57), (0.08, 0.075, 0.1), _cor_eli('#2e5a9a'), om, corte_z=1.48)
    CZ.c.elipsoide((cx, cy + 0.03, 1.555), (0.058, 0.058, 0.075), _cor_eli('#e8c8a4'), obj())
    CZ.c.cilindro(cx, cy - 0.01, 0.05, 1.64, 1.7, BE.vol(cx, cy, '#e0b840', brilho=0.5), M, obj(), lados=10, r1=0.062)
    caixa((cx - 0.03, cx + 0.03, cy + 0.1, cy + 0.135, 1.27, 1.35), liso('#e8c8a4'))
    pegada(cx - 0.24, cx + 0.24, cy - 0.24, cy + 0.24)


# =====================================================================================================================
# a vida da beira do rio: a rede de pesca amontoada, o cesto de peixe e o varal com os panos
# =====================================================================================================================
def mat_malha(cor='#8a8a6a', fundo='#5e5a44', passo=0.05):
    """A malha da rede de pesca: os fios em losango (riscas de 1 px nas duas diagonais) por cima do monte."""
    c0, c1 = hx(cor), hx(fundo)

    def f(L, N, P):
        a = (P[:, 0] + P[:, 1]) / passo
        b = (P[:, 0] - P[:, 1] + P[:, 2] * 0.7) / passo
        fio = ((a % 1) < 0.28) | ((b % 1) < 0.28)
        out = np.where(fio[:, None], c0, c1)
        return FF._cru_eli(out, N)
    return f


def _rede_pesca():
    """A rede de pesca amontoada no chão (1 x 1): o monte de malha, as boias de cortiça e a corda enrolada."""
    cx = cy = 0.375
    o = obj()
    m = mat_malha()
    CZ.c.elipsoide((cx - 0.04, cy + 0.02, 0.0), (0.27, 0.22, 0.2), m, o, corte_z=0.0)
    CZ.c.elipsoide((cx + 0.12, cy - 0.06, 0.0), (0.17, 0.15, 0.14), m, o, corte_z=0.0)
    # as boias de cortiça na borda da rede
    for (bx, by, bz) in ((cx - 0.22, cy + 0.12, 0.06), (cx - 0.05, cy + 0.2, 0.12), (cx + 0.16, cy + 0.06, 0.1), (cx + 0.02, cy - 0.12, 0.16)):
        CZ.c.elipsoide((bx, by, bz), (0.045, 0.045, 0.035), _cor_eli('#d89a3a'), obj())
    # a corda enrolada do lado
    oc = obj()
    for k in range(3):
        CZ.c.cilindro(cx + 0.2, cy + 0.2, 0.11 - k * 0.015, k * 0.025, k * 0.025 + 0.025, BE.vol(cx + 0.2, cy + 0.2, '#c8b080'), M, oc, lados=14,
                      tampa_mat=liso('#a89060'))
    pegada_redonda(cx, cy, 0.28, 5)


def _cesto():
    """O cesto de palha trançada (1 x 1) com os peixes do dia por cima, prateados."""
    cx = cy = 0.375

    def trama(P, base):
        k = (np.floor(P[:, 2] / 0.04) + np.floor((np.arctan2(P[:, 1] - cy, P[:, 0] - cx) + 4) / 0.3)) % 2
        return np.where((k == 0)[:, None], _tom(base, 0.86), base)
    o = obj()
    CZ.c.cilindro(cx, cy, 0.2, 0.0, 0.32, BE.vol(cx, cy, '#b8925a', faixas=trama), M, o, lados=18, r1=0.24,
                  tampa_mat=liso('#3a2a1a'))
    CZ.c.cilindro(cx, cy, 0.25, 0.3, 0.34, BE.vol(cx, cy, '#8a6a3a'), M, obj(), lados=18, tampa_mat=liso('#3a2a1a'))
    # os peixes: elipsoides compridos prateados com o rabo
    for (px, py, ang) in ((cx - 0.06, cy + 0.02, 0.5), (cx + 0.07, cy - 0.04, -0.4), (cx, cy + 0.08, 1.9)):
        dx, dy = math.cos(ang), math.sin(ang)
        R = (abs(dx) * 0.13 + abs(dy) * 0.04, abs(dy) * 0.13 + abs(dx) * 0.04, 0.035)
        of = obj()
        CZ.c.elipsoide((px, py, 0.36), R, _cor_eli('#a8b4b8'), of)
        CZ.c.elipsoide((px + dx * 0.14, py + dy * 0.14, 0.36), (0.035, 0.035, 0.03), _cor_eli('#7a888c'), of)
    pegada_redonda(cx, cy, 0.25, 5)


VARAL_PANOS = [('#e8e0cc', 0.42), ('#c8402e', 0.5), ('#2e6aa6', 0.36), ('#e8b838', 0.46)]


def _varal():
    """O varal (1 x 3): os dois paus fincados, a corda e os panos coloridos pendurados secando (de pano duplo)."""
    cx = 0.375
    ya, yb = 0.12, 2.13
    for y in (ya, yb):
        caixa((cx - 0.04, cx + 0.04, y - 0.04, y + 0.04, 0.0, 1.62), mad2('#6a4c34', eixo=1, seed=int(y * 10), passo=0.05))
    oc = obj(contorno=False)
    FF._viga(oc, (cx, ya, 1.55), (cx, yb, 1.55), 0.012, liso('#d8c8a0'))
    y = ya + 0.18
    for i, (cor, larg) in enumerate(VARAL_PANOS):
        o = obj()
        alto = 0.55 + 0.12 * (i % 2)
        fp([(cx, y, 1.55), (cx, y + larg, 1.55), (cx, y + larg, 1.55 - alto), (cx, y, 1.55 - alto)], (1, 0, 0), liso(cor), o, dois_lados=True)
        # a barra mais escura embaixo (o pano molhado)
        fp([(cx + 0.002, y, 1.55 - alto + 0.06), (cx + 0.002, y + larg, 1.55 - alto + 0.06), (cx + 0.002, y + larg, 1.55 - alto),
            (cx + 0.002, y, 1.55 - alto)], (1, 0, 0), liso(_hex(_tom(hx(cor), 0.82))), obj(contorno=False), dois_lados=True)
        y += larg + 0.04
    pegada(cx - 0.05, cx + 0.05, ya, yb)


# =====================================================================================================================
# os itens
# =====================================================================================================================
ITENS = {
    'igarape_casa': (7, 5, (0.0, 0.0), lambda: _casa(), {}),
    'igarape_casa~b': (7, 5, (0.0, 0.0), lambda: _casa(moldura=OCRE, batente=OCRE_J, folhas=VERDE_FOLHA,
                                                      porta=['#3e6e4a', '#386644', '#447652'], seed=20), {}),
    'igarape_venda': (8, 6, (0.0, 0.0), _venda, {}),
    'igarape_capela': (6, 8, (0.0, 0.0), _capela, {}),
    'igarape_palafita': (5, 5, (0.0, 0.0), _palafita, {}),
    'igarape_palafita_b': (5, 5, (0.0, 0.0), lambda: _palafita('b'), {}),
    'igarape_ponte': (6, 2, (0.0, 0.0), _ponte, {}),
    'igarape_canoa': (1, 4, (0.0, 0.0), _canoa, {}),
    'igarape_ipe': (1, 1, (0.0, 0.0), _ipe, {}),
    'igarape_rede': (1, 3, (0.0, 0.0), _rede, {}),
    'igarape_banco_igreja': (3, 1, (0.0, 0.0), _banco_igreja, {}),
    'igarape_altar': (3, 1, (0.0, 0.0), _altar, {}),
    'igarape_santa': (1, 1, (0.0, 0.0), _santa, {}),
    'igarape_rede_pesca': (1, 1, (0.0, 0.0), _rede_pesca, {}),
    'igarape_cesto': (1, 1, (0.0, 0.0), _cesto, {}),
    'igarape_varal': (1, 3, (0.0, 0.0), _varal, {}),
}
