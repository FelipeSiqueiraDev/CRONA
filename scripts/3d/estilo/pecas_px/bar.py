"""
GRUPO D, "o bar e a sala": os móveis do Suvaco Seco (o bar velho de fachada da Ordem, marrom e acolhedor, com o
fliperama) e os da sala do subsolo (as poltronas pretas, a mesa de xadrez, a luminária, a rosa dos ventos), em pixel
art 1:1 no estilo da cozinha da fazenda (agente_cozinha/cozinha.py) e do grupo da casa (casa.py).

Cada peça é desenhada no giro 4 (a frente para +y), com a pegada começando em (0, 0), no tamanho final do catálogo
(def.height / 1,633 em metros; o `aumento` já entra). O exportador (exportar_px.py) gira e faz o acabamento.

Decisões (o que o catálogo deixava em aberto):
  - armchair_red, sofa_booth: o `height` é a altura do ASSENTO; o encosto passa dele (como a poltrona da casa).
  - poltrona_preta: o `height` (0,95 m) é o alto do encosto; o assento fica a 0,45 m.
  - chair_bar, stool_bar: o `height` é o assento (já com o aumento 1,2).
  - table_bar, table_chess, bar_counter, counter_wood, pool_table, bar_cabinet, minibar, keg, beer_crate: o tampo
    (ou o topo) na altura do `height` (o que vai em cima não flutua).
  - beer_glass, ashtray: desenhados no chão da casa (z = 0); o jogo empilha em cima do tampo.
  - as mesas e as cadeiras do bar seguem o "mesas amarelas" do seed (o boteco): o tampo amarelo e as cadeiras de
    plástico amarelo; a pilha de cadeiras é das mesmas cadeiras.
  - bar_counter e counter_wood: as pontas retas (o corpo, o tampo e o varão vão de x = 0 a x = 1,5): em fila, emendam.
  - estados: arcade 0 ligado / '1' desligado; floor_lamp 0 acesa / '1' apagada. As geladeiras não têm estado no
    catálogo: ficam sempre acesas.
"""
import math

import numpy as np

import cozinha as CZ
import base_estilo as BE
import casa as CA
from base_estilo import (hx, liso, mad2, tab2, vol, _tom, _pau, _barra, _p1_malha, _p1_mat_rampa, _p1_rampa,
                         _poligono_rodado, _disco, PH, PZ)
from motor import emissivo, ruido, KX

M = BE.M
UN = 1.633
C, caixa, peg, novo = CA.C, CA.caixa, CA.peg, CA.novo
almofadas, alca, botao = CA.almofadas, CA.alca, CA.botao
LATAO, LATAO_L = CA.LATAO, CA.LATAO_L

# ------------------------------------------------------------------ as cores do bar ------------------------------------------------------------------
NOG = CA.NOG                       # a nogueira do corpo
NOG_E = CA.NOG_E
NOG_TAB = CA.NOG_TAB
WAL = '#4e2616'                    # a nogueira escura do balcão do bar
TAMPO_BAR = ['#7c3a22', '#76371f', '#823e24']
CARVALHO = '#9a6236'               # o balcão de madeira (o carvalho mais claro)
CARV_TAB = ['#b47a46', '#ac7442', '#ba804a']
AMARELO = '#e2a823'                # o plástico amarelo do boteco
AMARELO_T = '#f4c84a'
CROMO = ('#9aa4aa', '#e2eaee')


def luz_obj(sombra=True):
    """Um objeto que brilha (sem a luz das faces e sem contorno): a tela, o vidro aceso."""
    o = C().novo_obj(3, contorno=False, sombra=sombra)
    CZ.luzes.add(o)
    return o


def fp(pts, n, mat, oid, dois=False):
    C().face_plana(pts, n, mat, M, oid, dois_lados=dois)


def extrudar_x(perfil, x0, x1, mats, oid, tampas=None, mat_tampa=None):
    """
    O perfil (y, z) no sentido anti-horário (y para a direita, z para cima) puxado de x0 a x1: uma face por aresta,
    com a normal para fora; mats[i] é o material da aresta i. tampas: os pedaços convexos do perfil para fechar os lados.
    """
    n = len(perfil)
    for i in range(n):
        (ya, za), (yb, zb) = perfil[i], perfil[(i + 1) % n]
        dy, dz = yb - ya, zb - za
        L = math.hypot(dy, dz)
        if L < 1e-9 or mats[i] is None:
            continue
        fp([(x0, ya, za), (x1, ya, za), (x1, yb, zb), (x0, yb, zb)], (0, dz / L, -dy / L), mats[i], oid)
    for poli in (tampas or ()):
        fp([(x0, y, z) for (y, z) in poli], (-1, 0, 0), mat_tampa, oid)
        fp([(x1, y, z) for (y, z) in poli], (1, 0, 0), mat_tampa, oid)


def garrafa(x, y, z, tipo=0, k=1.0, luz=False):
    """
    A garrafa de bar: 0 o vinho verde-escuro, 1 o uísque âmbar (o corpo largo), 2 a cachaça clara, 3 o licor
    vermelho, 4 a cerveja marrom (long neck), 5 a vodca transparente. O rótulo é uma faixa clara com um risco (sem letra).
    """
    cores = ('#2e4a34', '#a8641e', '#d8d8b0', '#8e2228', '#5a3014', '#c8dcdc')
    rot = ('#e6d8b4', '#1e1a16', '#e8c050', '#efe4c8', '#d8b040', '#c83a30')
    perf = (
        [(0.0, 0.034), (0.15, 0.034), (0.18, 0.024), (0.2, 0.013), (0.27, 0.013)],
        [(0.0, 0.04), (0.13, 0.04), (0.15, 0.03), (0.17, 0.014), (0.21, 0.014)],
        [(0.0, 0.032), (0.14, 0.032), (0.17, 0.02), (0.19, 0.012), (0.25, 0.012)],
        [(0.0, 0.036), (0.1, 0.036), (0.14, 0.02), (0.16, 0.012), (0.22, 0.012)],
        [(0.0, 0.028), (0.11, 0.028), (0.15, 0.014), (0.21, 0.011)],
        [(0.0, 0.033), (0.16, 0.033), (0.18, 0.02), (0.2, 0.012), (0.25, 0.012)],
    )[tipo]
    perf = [(z + a * k, r * k) for (a, r) in perf]
    hr0, hr1 = z + perf[1][0] * 0.0 + 0.04 * k, z + 0.04 * k + (perf[1][0] - z) * 0.55

    def faixas(P, b):
        zz = P[:, 2]
        lab = (zz > hr0) & (zz < hr1)
        b = np.where(lab[:, None], hx(rot[tipo]), b)
        meio = (hr0 + hr1) / 2
        b = np.where((lab & (np.abs(zz - meio) < 0.5 * PZ))[:, None], _tom(hx(rot[tipo]), 0.6), b)
        return b
    o = luz_obj() if luz else novo()
    _poligono_rodado(x, y, perf, vol(x, y, cores[tipo], brilho=0.5, faixas=faixas), o, lados=10)
    zt, rt = perf[-1]
    tampa = ('#c8a040', '#2a2018', '#b03a28', '#e8d8a0', '#d8b040', '#a8acb0')[tipo]
    C().cilindro(x, y, rt + 0.003, zt, zt + 0.02 * k, vol(x, y, tampa), M, o, lados=8, tampa_mat=liso(tampa))
    return zt + 0.02 * k


def copo(x, y, z, r=0.032, h=0.09, cheio=None, emborcado=False):
    """O copo de vidro (vazio, claro, ou com a bebida: cheio = a cor)."""
    def f(P, b):
        if cheio is None:
            return b
        zz = P[:, 2] - z
        return np.where((zz < h * 0.7)[:, None], hx(cheio), b)
    o = novo()
    C().cilindro(x, y, r * 0.86, z, z + h, vol(x, y, '#cfe0e0', brilho=0.5, faixas=f), M, o, lados=12, r1=r,
                 tampa_mat=liso('#a8c4c4' if not emborcado else '#dceaea'))


# =====================================================================================================================
# os balcões
# =====================================================================================================================
def bar_counter():
    """
    O balcão do bar (2 x 1 casas; o tampo a 1,10 m): o corpo de nogueira escura com as duas almofadas grandes, o
    rodapé recuado, o tampo grosso de tábuas que sai para a frente, o varão de latão para os pés. As pontas são retas
    (o corpo, o tampo e o varão vão de ponta a ponta da pegada): seis em fila fazem um balcão só. Atrás, a prateleira
    do atendente com os copos emborcados e duas garrafas.
    """
    x0, x1 = 0.0, 1.5
    y0, y1 = 0.12, 0.6
    h = 1.8 / UN
    tp = 0.07
    zm = h - tp - 0.06
    pain = [(0.07, 0.71, 0.2, zm - 0.06, 'p'), (0.79, 1.43, 0.2, zm - 0.06, 'p')]
    # o rodapé recuado e o corpo
    caixa((x0, x1, y0 + 0.02, y1 - 0.04, 0.0, 0.13), {'*': mad2('#2e160c', seed=201, passo=0.04)})
    caixa((x0, x1, y0, y1, 0.13, zm), {'frente': almofadas(WAL, pain, seed=202), 'costas': almofadas(WAL, [(0.06, 1.44, 0.2, zm - 0.06, 'g')], seed=203),
                                       '*': mad2(WAL, eixo=1, seed=204, passo=0.05)})
    # a moldura de cima (o friso entre o corpo e o tampo)
    caixa((x0, x1, y0 - 0.01, y1 + 0.02, zm, h - tp), _pau('#3a1c10', '#5a2e1a', quina=1.25, b=(0, 0, 0, 0, zm, h - tp)))
    # o tampo: as tábuas ao comprido, a quina da frente clara
    caixa((x0, x1, 0.03, 0.74, h - tp, h), {'cima': tab2(TAMPO_BAR, 0.236, '#3a1a0c', eixo=0, seed=205, org=0.03),
                                            '*': _pau('#6a3018', quina=1.25, b=(0, 0, 0, 0, h - tp, h))})
    # o varão de latão dos pés e as mãos-francesas que o seguram
    _barra((x0, x1, 0.66, 0.66 + 2 * PH, 0.19, 0.19 + 3 * PZ), '#a07428', LATAO_L, quina=False)
    for xx in (0.2, 1.3):
        _barra((xx - PH, xx + PH, y1, 0.66, 0.19, 0.19 + 3 * PZ), '#8a6420', quina=False)
    # atrás (o lado do atendente): a prateleira com os copos emborcados e as garrafas
    zp = 0.72
    caixa((x0 + 0.05, x1 - 0.05, 0.02, y0, zp - 0.03, zp), _pau('#5a2c18', quina=1.2, b=(0, 0, 0, 0, zp - 0.03, zp)))
    for k, xx in enumerate((0.18, 0.28, 0.38, 1.0)):
        copo(xx, 0.07, zp, emborcado=True)
    garrafa(1.2, 0.07, zp, 2, k=0.9)
    garrafa(1.32, 0.07, zp, 1, k=0.9)
    peg(x0, x1, 0.03, 0.74)


def counter_wood():
    """
    O balcão de madeira (2 x 1 casas; o tampo a 0,90 m): o carvalho de tábuas em pé na frente, as duas colunas das
    pontas, o rodapé, o tampo de tábuas grossas. As pontas retas emendam em fila.
    """
    x0, x1 = 0.0, 1.5
    y0, y1 = 0.1, 0.62
    h = 1.47 / UN
    tp = 0.06
    caixa((x0, x1, y0 + 0.02, y1 - 0.03, 0.0, 0.1), mad2('#4a2a16', seed=211, passo=0.04))
    TAB = tab2(CARV_TAB, 0.125, '#4a2814', eixo=1, seed=212, org=0.0)
    caixa((x0, x1, y0, y1, 0.1, h - tp), {'frente': TAB, 'costas': tab2(CARV_TAB, 0.125, '#4a2814', eixo=1, seed=213), '*': mad2(CARVALHO, eixo=1, seed=214, passo=0.05)})
    # as travessas da frente (em cima e embaixo, por cima das tábuas)
    for (za, zb) in ((0.1, 0.17), (h - tp - 0.07, h - tp)):
        caixa((x0, x1, y1, y1 + 0.02, za, zb), _pau('#7a4826', quina=1.2, b=(0, 0, 0, 0, za, zb)))
    caixa((x0, x1, 0.04, 0.72, h - tp, h), {'cima': tab2(CARV_TAB, 0.17, '#4a2814', eixo=0, seed=215, comp=1.5, org=0.04),
                                            '*': _pau('#8a5430', quina=1.22, b=(0, 0, 0, 0, h - tp, h))})
    peg(x0, x1, 0.04, 0.72)


# =====================================================================================================================
# as prateleiras e os armários
# =====================================================================================================================
def bar_shelf():
    """
    A prateleira de garrafas de trás do balcão (2 x 1 casas, 2 m): o armário embaixo com as quatro portas, o tampo,
    o fundo espelhado (escuro, com o reflexo), as três prateleiras de garrafas de todo tipo, a cimalha.
    """
    x0, x1, y0, y1 = 0.03, 1.47, 0.04, 0.5
    h = 3.27 / UN
    zc = 0.82
    cols = np.linspace(x0 + 0.04, x1 - 0.04, 5)
    pain = [(cols[i] + 0.006, cols[i + 1] - 0.006, 0.14, zc - 0.06, 'p') for i in range(4)]
    caixa((x0 + 0.03, x1 - 0.03, y0 + 0.02, y1 - 0.03, 0.0, 0.1), mad2(NOG_E, seed=221, passo=0.04))
    caixa((x0, x1, y0, y1, 0.1, zc), {'frente': almofadas(WAL, pain, seed=222), 'costas': tab2(CA.PINHO, 0.14, '#6a4426', eixo=1, seed=223),
                                      '*': mad2(WAL, eixo=1, seed=224, passo=0.05)})
    for i in range(4):
        botao((cols[i] + cols[i + 1]) / 2 + (0.1 if i % 2 == 0 else -0.1), zc - 0.2, y1)
    caixa((x0 - 0.015, x1 + 0.015, y0, y1 + 0.03, zc, zc + 0.04), {'cima': tab2(TAMPO_BAR, 0.16, '#3a1a0c', seed=225, org=y0),
                                                                   '*': _pau('#6a3018', quina=1.25, b=(0, 0, 0, 0, zc, zc + 0.04))})
    # em cima: o fundo de espelho escuro com o reflexo, os lados e o meio
    zt = h - 0.09

    def espelho(L, n, P):
        g = np.floor(P[:, 0] / PH) + np.floor(P[:, 2] / PZ)
        out = np.tile(hx('#3e3a36'), (len(P), 1))
        out = np.where(((g % 37) < 3)[:, None], hx('#5e5850'), out)
        out = np.where(((g % 37) == 5)[:, None], hx('#55504a'), out)
        return BE._vao(out, P)
    caixa((x0, x1, y0, y0 + 0.03, zc + 0.04, zt), {'frente': emissivo(espelho), 'costas': tab2(CA.PINHO, 0.14, '#6a4426', eixo=1, seed=226),
                                                   '*': mad2(WAL, seed=227)})
    LADO = {'cima': liso('#6a3420'), 'frente': mad2('#7a3e22', eixo=1, seed=228, passo=0.03), '*': mad2(WAL, eixo=1, seed=229, passo=0.05)}
    meio = (x0 + x1) / 2
    for (a, b) in ((x0, x0 + 0.05), (meio - 0.025, meio + 0.025), (x1 - 0.05, x1)):
        caixa((a, b, y0, y1 - 0.06, zc + 0.04, zt), LADO)
    prat = (zc + 0.04, zc + 0.42, zc + 0.8)
    tipos = (0, 1, 2, 3, 5, 1, 0, 2, 4, 3, 5, 1, 2, 0, 3)
    for j, zp in enumerate(prat):
        if j > 0:
            caixa((x0 + 0.05, x1 - 0.05, y0 + 0.03, y1 - 0.06, zp - 0.03, zp), {'cima': liso('#8a4a2a'), '*': _pau('#6a3420', quina=1.2, b=(0, 0, 0, 0, zp - 0.03, zp))})
        BE._VAO['teto'] = prat[j + 1] - 0.03 if j + 1 < len(prat) else zt
        for lado in (0, 1):
            a = (x0 + 0.05) if lado == 0 else (meio + 0.025)
            b = (meio - 0.025) if lado == 0 else (x1 - 0.05)
            n = 6
            for k in range(n):
                xx = a + (b - a) * (k + 0.5) / n
                t = tipos[(j * 5 + lado * 3 + k) % len(tipos)]
                garrafa(xx, (y0 + y1) / 2 - 0.01 + 0.03 * ((k + j) % 2), zp, t, k=0.95 + 0.1 * ruido(j, k, lado))
        CZ.itens_peq.append((x0, x1, y0, y1, zp))
    BE._VAO['teto'] = None
    # a cimalha
    caixa((x0 - 0.02, x1 + 0.02, y0, y1 - 0.03, zt, zt + 0.05), mad2('#3a1c10', seed=230, passo=0.03))
    caixa((x0 - 0.035, x1 + 0.035, y0, y1 - 0.01, zt + 0.05, h), {'cima': tab2(TAMPO_BAR, 0.15, '#3a1a0c', seed=231, org=y0),
                                                                  '*': _pau('#6a3018', quina=1.25, b=(0, 0, 0, 0, zt + 0.05, h))})
    peg(x0, x1, y0, y1)


def bar_cabinet(aberto=False):
    """
    O armarinho (1 m): a gaveta com a alça, as duas portinhas almofadadas, o rodapé, o tampo de nogueira. Aberto: as
    duas portinhas giram a 90° para fora (o lado de dentro almofadado à vista), o vão escuro com uma prateleira, as
    garrafas e os copos; a gaveta e o tampo ficam como estão.
    """
    x0, x1, y0, y1 = 0.06, 0.69, 0.08, 0.6
    h = 1.63 / UN
    zg = h - 0.17
    meio = (x0 + x1) / 2
    pain = [(x0 + 0.03, x1 - 0.03, zg + 0.01, h - 0.05, 'g'), (x0 + 0.03, meio - 0.005, 0.14, zg - 0.01, 'p'), (meio + 0.005, x1 - 0.03, 0.14, zg - 0.01, 'p')]
    caixa((x0 + 0.02, x1 - 0.02, y0 + 0.02, y1 - 0.03, 0.0, 0.1), mad2(NOG_E, seed=241, passo=0.04))
    if not aberto:
        caixa((x0, x1, y0, y1, 0.1, h - 0.04), {'frente': almofadas(WAL, pain, seed=242), 'costas': tab2(CA.PINHO, 0.12, '#6a4426', eixo=1, seed=243),
                                                '*': mad2(WAL, eixo=1, seed=244, passo=0.05)})
    else:
        e = 0.03
        ESC = mad2('#4c2813', eixo=1, seed=246, passo=0.05)
        LAT = {'*': mad2(WAL, eixo=1, seed=244, passo=0.05), 'dir': ESC, 'esq': ESC}
        # a carcaça: o fundo, os lados, o teto (sob a gaveta), o piso do vão e os montantes da frente
        caixa((x0, x1, y0, y0 + e, 0.1, zg), {'frente': ESC, 'costas': tab2(CA.PINHO, 0.12, '#6a4426', eixo=1, seed=243), '*': ESC})
        caixa((x0, x0 + e, y0, y1, 0.1, zg), {'dir': ESC, '*': LAT['*']})
        caixa((x1 - e, x1, y0, y1, 0.1, zg), {'esq': ESC, '*': LAT['*']})
        caixa((x0 + e, x1 - e, y0 + e, y1, 0.1, 0.14), {'cima': liso('#5e3418'), '*': ESC})
        caixa((x0 + e, x1 - e, y0 + e, y1 - 0.02, zg - 0.02, zg), {'baixo': ESC, '*': ESC})
        # a prateleira do meio
        zp = 0.5
        caixa((x0 + e, x1 - e, y0 + e, y0 + 0.27, zp - 0.02, zp), {'cima': tab2(['#6a3a1e', '#643618'], 0.12, '#2a140a', seed=247, org=y0), '*': mad2('#5a2e16', seed=248, passo=0.04)})
        # a gaveta e o tampo
        caixa((x0, x1, y0, y1, zg, h - 0.04), {'frente': almofadas(WAL, [pain[0]], seed=242), 'costas': tab2(CA.PINHO, 0.12, '#6a4426', eixo=1, seed=243),
                                                '*': mad2(WAL, eixo=1, seed=244, passo=0.05)})
        # as garrafas e os copos (embaixo, na prateleira e um copo emborcado)
        ym = (y0 + y1) / 2 + 0.04
        for i, xx in enumerate((x0 + 0.1, x0 + 0.19, x0 + 0.28, x0 + 0.37, x0 + 0.46)):
            garrafa(xx, y1 - 0.2 + 0.07 * (i % 2), 0.14, (1, 3, 2, 1, 5)[i], k=1.0)
            garrafa(xx + 0.045, y1 - 0.34 + 0.07 * (i % 2), 0.14, (3, 5, 1, 2, 3)[i], k=0.9)
        for i, xx in enumerate((x0 + 0.12, x0 + 0.24, x0 + 0.36)):
            copo(xx, y0 + 0.17, zp, cheio=None, emborcado=(i == 1))
        garrafa(x0 + 0.45, y0 + 0.17, zp, 3, k=1.0)
        garrafa(x0 + 0.5, y0 + 0.2, zp, 1, k=0.9)
    # o rodapé do tampo
    caixa((x0 - 0.015, x1 + 0.015, y0 - 0.01, y1 + 0.02, h - 0.04, h), {'cima': tab2(TAMPO_BAR, 0.18, '#3a1a0c', seed=245, org=y0),
                                                                        '*': _pau('#6a3018', quina=1.25, b=(0, 0, 0, 0, h - 0.04, h))})
    alca(meio, zg + 0.065, y1)
    if not aberto:
        botao(meio - 0.06, zg - 0.2, y1)
        botao(meio + 0.06, zg - 0.2, y1)
    else:
        # as portinhas abertas de vez (180°): cada uma fica deitada rente à frente, para fora, com o lado de dentro
        # almofadado para a frente; assim não tapam o vão
        W = (x1 - x0) / 2 - 0.005
        zb0, zb1 = 0.14, zg - 0.01
        MAD = mad2(WAL, eixo=1, seed=249, passo=0.05)
        for (xa, xb) in ((x0 - W - 0.008, x0 - 0.008), (x1 + 0.008, x1 + W + 0.008)):
            pl = [(xa + 0.03, xb - 0.03, zb0 + 0.03, zb1 - 0.03, 'p')]
            caixa((xa, xb, y1, y1 + 0.028, zb0, zb1), {'frente': almofadas(WAL, pl, seed=250), '*': MAD})
        # as dobradiças e o puxador do lado de dentro
        for xx in (x0 - 0.016, x1 + 0.016):
            for zz in (zb0 + 0.1, zb1 - 0.1):
                _barra((xx - 0.012, xx + 0.012, y1 + 0.01, y1 + 0.032, zz, zz + 0.05), LATAO, LATAO_L, quina=False)
        botao(x0 - W + 0.05, 0.46, y1 + 0.028)
        botao(x1 + W - 0.05, 0.46, y1 + 0.028)
    peg(x0, x1, y0, y1)


# =====================================================================================================================
# as geladeiras (de porta de vidro, acesas por dentro)
# =====================================================================================================================
def geladeira(x0, x1, y0, y1, h, corpo, frisos, prats, painel=None, base=0.1, conteudo='garrafas', puxador='#d8dcdc', seed=0, aberto=False):
    """
    A geladeira de porta de vidro: a caixa (o fundo, os lados, o teto, a base), o forro claro aceso por dentro, as
    prateleiras de arame com as garrafas e latas, o vidro com o reflexo, o batente e o puxador. painel: (z0, cor, desenho)
    a placa acesa em cima da porta. Aberta: a porta de vidro gira a 90° pela dobradiça da esquerda (o vidro e o puxador
    ficam de lado, para fora) e o forro aceso fica branco-azulado, com as garrafas à mostra.
    """
    e = 0.05
    zt_vid = h - (0.26 if painel else 0.08)
    c0 = hx(corpo)

    def chapa(L, n, P):
        out = np.tile(c0, (len(P), 1))
        if n[1] < -0.5:      # as costas: a serpentina do motor (a grade escura)
            X, Z = P[:, 0], P[:, 2]
            g = (np.floor((Z - 0.3) / PZ) % 4 == 0) & (Z > 0.3) & (Z < h - 0.3) & (X > x0 + 0.08) & (X < x1 - 0.08)
            out = np.where(g[:, None], _tom(c0, 0.55), out)
            v = (np.abs(X - x0 - 0.08) < PH) | (np.abs(X - x1 + 0.08) < PH)
            out = np.where((v & (Z > 0.3) & (Z < h - 0.3))[:, None], _tom(c0, 0.55), out)
        return out
    COR = {'cima': liso(_hex(_tom(c0, 1.12))), '*': emissivo(chapa)}
    # o corpo: o fundo, os dois lados, o teto e a base
    caixa((x0, x1, y0, y0 + e, 0.0, h), COR)
    caixa((x0, x0 + e, y0, y1, 0.0, h), COR)
    caixa((x1 - e, x1, y0, y1, 0.0, h), COR)
    caixa((x0 + e, x1 - e, y0 + e, y1, zt_vid, h), COR)
    caixa((x0 + e, x1 - e, y0 + e, y1, 0.0, base), {'frente': liso('#2a2624'), '*': COR['*'], 'cima': liso('#d8d8cc')})
    # o forro aceso por dentro (o fundo e os lados), as prateleiras de arame
    ol = luz_obj()

    def forro(L, n, P):
        zz = P[:, 2]
        out = np.tile(hx('#e6f2fa' if aberto else '#f4f2e2'), (len(P), 1))
        out = np.where((zz > zt_vid - 0.12)[:, None], hx('#f6fcff' if aberto else '#fffbe8'), out)
        if abs(n[0]) > 0.5:
            out = _tom(out, 0.9)
        return out
    a0, a1, b0 = x0 + e, x1 - e, y0 + e
    fp([(a0, b0, base), (a1, b0, base), (a1, b0, zt_vid), (a0, b0, zt_vid)], (0, 1, 0), emissivo(forro), ol)
    fp([(a0, b0, base), (a0, y1 - 0.04, base), (a0, y1 - 0.04, zt_vid), (a0, b0, zt_vid)], (1, 0, 0), emissivo(forro), ol)
    fp([(a1, b0, base), (a1, y1 - 0.04, base), (a1, y1 - 0.04, zt_vid), (a1, b0, zt_vid)], (-1, 0, 0), emissivo(forro), ol)
    k = 0
    for j, zp in enumerate((base,) + tuple(prats)):
        if j > 0:
            _barra((a0, a1, b0, y1 - 0.05, zp - 2 * PZ, zp), '#7a8282', '#aab2b2', quina=False)
        nb = max(3, int((a1 - a0) / 0.08))
        for fila, yy in ((0, b0 + 0.11), (1, y1 - 0.13)):
            for i in range(nb - fila):
                xx = a0 + (a1 - a0) * (i + 0.5 + 0.5 * fila) / nb
                lata = conteudo == 'latas' or (conteudo == 'misto' and (i + j) % 3 == 0)
                if lata:
                    cor = ('#c8302a', '#3a6aa8', '#e8c040', '#3a8a4a', '#e8e4dc')[(i + j * 2 + fila) % 5]
                    o = novo()

                    def faixa(P, b, zp=zp):
                        zz = P[:, 2] - zp
                        b = np.where(((zz > 0.05) & (zz < 0.075))[:, None], hx('#f0ece0'), b)
                        return np.where((zz > 0.115)[:, None], hx('#c8ccd0'), b)
                    C().cilindro(xx, yy, 0.033, zp, zp + 0.125, vol(xx, yy, cor, brilho=0.6, faixas=faixa), M, o, lados=10,
                                 tampa_mat=liso('#d8dcdc'))
                    if fila == 0 and zp + 0.26 < zt_vid - 0.1:
                        o = novo()
                        C().cilindro(xx, yy, 0.033, zp + 0.125, zp + 0.25, vol(xx, yy, cor, brilho=0.6, faixas=lambda P, b, zp=zp: faixa(P, b, zp + 0.125)),
                                     M, o, lados=10, tampa_mat=liso('#d8dcdc'))
                else:
                    t = (4, 4, 2, 4, 5, 4, 0)[(i * 3 + j + fila * 2) % 7]
                    garrafa(xx, yy, zp, t, k=1.0)
        k += 1
    # o vidro (o reflexo e o tom) e o batente da porta com o puxador
    FR = _pau(frisos, quina=1.2)
    _barra((x0, x1, y1 - 0.02, y1 + 0.01, zt_vid - 0.03, zt_vid), frisos, quina=1.2)
    _barra((x0, x1, y1 - 0.02, y1 + 0.01, base, base + 0.04), frisos, quina=1.2)
    _barra((x0, x0 + e, y1 - 0.02, y1 + 0.01, base, zt_vid), frisos, quina=False)
    _barra((x1 - e, x1, y1 - 0.02, y1 + 0.01, base, zt_vid), frisos, quina=False)
    zm = base + (zt_vid - base) * 0.55
    if not aberto:
        CZ.vidros.append((a0, a1, b0, y1 + 0.01, base, zt_vid))
        _barra((x1 - e - 0.005, x1 - e + 0.02, y1 + 0.01, y1 + 0.035, zm - 0.18, zm + 0.18), puxador, '#ffffff', quina=False)
    else:
        # a porta aberta a 90°: o quadro (frisos) e o vidro no plano x = x0, saindo para a frente (+y)
        W = x1 - x0
        xd0, xd1 = x0 - 0.035, x0 - 0.005
        yd0, yd1 = y1 + 0.02, y1 + 0.02 + W
        _barra((xd0, xd1, yd0, yd1, zt_vid - 0.04, zt_vid), frisos, quina=1.2)
        _barra((xd0, xd1, yd0, yd1, base, base + 0.05), frisos, quina=1.2)
        _barra((xd0, xd1, yd0, yd0 + 0.045, base, zt_vid), frisos, quina=False)
        _barra((xd0, xd1, yd1 - 0.045, yd1, base, zt_vid), frisos, quina=False)
        CZ.vidros.append((xd0 + 0.008, xd1 - 0.008, yd0 + 0.045, yd1 - 0.045, base + 0.05, zt_vid - 0.04))
        # os brilhos do vidro (riscas em degraus, o resto fica vazado)
        for k in range(3):
            ya = yd0 + 0.07 + 0.11 * k
            za = base + 0.12 + (zt_vid - base - 0.3) * (0.15 + 0.25 * k)
            for j in range(4):
                _barra((xd0 + 0.01, xd1 - 0.01, ya + 0.025 * j, ya + 0.025 * j + 0.03, za + 0.035 * j, za + 0.035 * j + 0.04), '#cfe6f0', '#f0fbff', quina=False)
        _barra((xd0 - 0.022, xd0 + 0.005, yd1 - 0.07, yd1 - 0.03, zm - 0.18, zm + 0.18), puxador, '#ffffff', quina=False)
    if painel:
        z0p, corp, des = painel
        op = luz_obj()
        fp([(x0 + 0.02, y1 + 0.002, z0p), (x1 - 0.02, y1 + 0.002, z0p), (x1 - 0.02, y1 + 0.002, h - 0.04), (x0 + 0.02, y1 + 0.002, h - 0.04)],
           (0, 1, 0), emissivo(des), op)
    peg(x0, x1, y0, y1)
    return zt_vid


def _hex(c):
    c = np.clip(np.round(np.asarray(c, float)), 0, 255).astype(int)
    return '#%02x%02x%02x' % tuple(c)


def beer_fridge(aberto=False):
    """
    A geladeira amarela (2 m), a do canto: o corpo amarelo, a porta de vidro com as garrafas acesas, o teclado
    numérico do lado direito (a porta da Sede está atrás dela).
    """
    x0, x1, y0, y1 = 0.06, 0.69, 0.06, 0.68
    h = 3.27 / UN
    geladeira(x0, x1, y0, y1, h, '#d8a420', '#b88418', (0.62, 0.98, 1.34, 1.7), base=0.18, conteudo='misto', seed=251, aberto=aberto)
    # o teclado numérico na lateral direita (+x): a placa de metal, as 12 teclas, o visor verde
    xk = x1 + 0.004
    yc, zc = (y0 + y1) / 2 + 0.08, 1.12

    def tecl(L, n, P):
        Y, Z = P[:, 1], P[:, 2]
        out = np.tile(hx('#5a5e60'), (len(P), 1))
        u = np.floor((Y - (yc - 0.09)) / (3 * PH))
        v = np.floor(((zc + 0.06) - Z) / (3 * PZ))
        gu = (Y - (yc - 0.09)) - u * 3 * PH
        gv = ((zc + 0.06) - Z) - v * 3 * PZ
        tecla = (u >= 0) & (u < 3) & (v >= 0) & (v < 4) & (gu < 2 * PH) & (gv < 2 * PZ)
        out = np.where(tecla[:, None], hx('#d8dcd8'), out)
        vis = (Z > zc + 0.09) & (Z < zc + 0.13) & (np.abs(Y - yc + 0.005) < 0.07)
        out = np.where(vis[:, None], hx('#7ad88a'), out)
        out = np.where(((Z > zc + 0.06) & (Z <= zc + 0.06 + PZ))[:, None], hx('#3a3e40'), out)
        return out
    o = novo()
    C().caixa((x1, x1 + 0.012, yc - 0.12, yc + 0.11, zc - 0.17, zc + 0.16), {'dir': emissivo(tecl), '*': liso('#3a3e40')}, M, o)


def fridge_drinks(aberto=False):
    """O expositor de bebidas (2 m): o corpo vermelho, a placa acesa em cima (a onda branca, sem letra), a porta de vidro cheia."""
    x0, x1, y0, y1 = 0.06, 0.69, 0.06, 0.68
    h = 3.27 / UN

    def placa(L, n, P):
        X, Z = P[:, 0], P[:, 2]
        u = (X - x0) / (x1 - x0)
        out = np.tile(hx('#d8342a'), (len(P), 1))
        onda = 1.86 + 0.06 * np.sin(u * 7.0)
        out = np.where((np.abs(Z - onda) < 0.025)[:, None], hx('#fff4ea'), out)
        out = np.where((np.abs(Z - onda + 0.045) < 0.009)[:, None], hx('#f8c8b0'), out)
        out = np.where(((Z > h - 0.04 - PZ) | (Z < h - 0.22 + PZ))[:, None], hx('#a82420'), out)
        return out
    geladeira(x0, x1, y0, y1, h, '#b8261e', '#8e1c18', (0.52, 0.86, 1.2, 1.5), painel=(h - 0.22, '#d8342a', placa), base=0.14,
              conteudo='latas', seed=252, aberto=aberto)


def minibar(aberto=False):
    """O frigobar de trás do balcão (0,90 m): o corpo preto, a porta de vidro com as long necks e as latas acesas, o tampo."""
    x0, x1, y0, y1 = 0.08, 0.67, 0.08, 0.62
    h = 1.47 / UN
    geladeira(x0, x1, y0, y1, h - 0.03, '#2e2c2c', '#1e1c1c', (0.42,), base=0.1, conteudo='misto', puxador='#a8acb0', seed=253, aberto=aberto)
    caixa((x0 - 0.005, x1 + 0.005, y0, y1 + 0.01, h - 0.03, h), {'cima': liso('#3a3838'), '*': _pau('#262424', quina=1.3, b=(0, 0, 0, 0, h - 0.03, h))})


# =====================================================================================================================
# o barril, o engradado, o copo, o cinzeiro
# =====================================================================================================================
def keg():
    """O barril de chope de inox (0,60 m): os dois aros de rolar, a saia de cima com as alças vazadas, o domo e a válvula."""
    cx, cy = 0.375, 0.375
    r = 0.21
    h = 0.98 / UN
    zs = h - 0.07

    def aros(P, b):
        zz = P[:, 2]
        for za in (0.13, zs - 0.13):
            b = np.where((np.abs(zz - za) < 1.5 * PZ)[:, None], _tom(b, 1.12), b)
            b = np.where(((zz - za >= 1.5 * PZ) & (zz - za < 2.5 * PZ))[:, None], _tom(b, 0.78), b)
        return b
    o = novo()
    _poligono_rodado(cx, cy, [(0.0, r - 0.012), (0.04, r), (zs - 0.02, r), (zs, r - 0.02)], vol(cx, cy, '#a8b0b4', brilho=0.6, faixas=aros), o, lados=28)
    # a saia de cima com as duas alças vazadas (pintadas escuras)
    def saia(P, b):
        th = np.arctan2(P[:, 1] - cy, P[:, 0] - cx)
        zz = P[:, 2] - zs
        furo = (np.abs(np.sin(th)) > 0.88) & (zz > 0.02) & (zz < 0.05)
        return np.where(furo[:, None], hx('#2a2c2e'), b)
    o = novo()
    C().cilindro(cx, cy, r - 0.01, zs - 0.01, h, vol(cx, cy, '#b4bcc0', brilho=0.6, faixas=saia), M, o, lados=28, tampa=False)

    def domo(L, n, P):
        rr = np.hypot(P[:, 0] - cx, P[:, 1] - cy)
        out = np.tile(hx('#c4ccd0'), (len(P), 1))
        out = np.where((rr > r - 0.03)[:, None], hx('#7a8286'), out)
        out = np.where(((rr > r - 0.045) & (rr <= r - 0.03))[:, None], hx('#9aa2a6'), out)
        out = np.where((rr < 0.1)[:, None], hx('#d8e0e2'), out)
        return out
    _disco(cx, cy, zs + 0.012, r - 0.01, emissivo(domo), o, lados=28)
    # a válvula (o acoplador preto com a alavanca vermelha)
    o = novo()
    C().cilindro(cx, cy, 0.045, zs + 0.012, h - 0.005, vol(cx, cy, '#2a2a2c', brilho=0.4), M, o, lados=14, tampa_mat=liso('#3a3a3e'))
    _barra((cx - 0.012, cx + 0.012, cy - 0.12, cy, h - 0.03, h - 0.005), '#b82a22', '#e04a3a', quina=False)
    _barra((cx + 0.04, cx + 0.1, cy - 0.01, cy + 0.01, zs + 0.03, zs + 0.03 + 2 * PZ), '#3a3a3e', quina=False)
    peg(cx - r, cx + r, cy - r, cy + r)


def beer_crate():
    """
    O engradado de cerveja de plástico vermelho (0,35 m): as paredes com as nervuras e as alças vazadas, as 24
    long necks marrons com as tampinhas douradas aparecendo em cima.
    """
    x0, x1, y0, y1 = 0.12, 0.63, 0.18, 0.57
    h = 0.57 / UN
    zc = h - 0.06
    e = 0.02
    c0 = hx('#b8302a')

    def plast(L, n, P):
        out = np.tile(c0, (len(P), 1))
        if abs(n[2]) > 0.5:
            return np.tile(_tom(c0, 1.15), (len(P), 1))
        al = P[:, 0] if abs(n[1]) > 0.5 else P[:, 1]
        q0, q1 = (x0, x1) if abs(n[1]) > 0.5 else (y0, y1)
        zz = P[:, 2]
        # as nervuras em pé (a cada 4 px) e a faixa de cima
        nerv = (np.floor((al - q0) / PH) % 4 == 0) & (zz < zc - 0.05)
        out = np.where(nerv[:, None], _tom(c0, 0.82), out)
        out = np.where((zz > zc - 0.05)[:, None], _tom(c0, 1.06), out)
        out = np.where(((zz > zc - 0.05 - PZ) & (zz <= zc - 0.05))[:, None], _tom(c0, 0.7), out)
        # a alça vazada (nos lados curtos e no meio dos compridos)
        meio = (q0 + q1) / 2
        furo = (np.abs(al - meio) < 0.07) & (zz > zc - 0.045) & (zz < zc - 0.015)
        out = np.where(furo[:, None], hx('#2a1210'), out)
        return out
    o = novo()
    m = emissivo(plast)
    for bb in ((x0, x1, y0, y0 + e, 0, zc), (x0, x0 + e, y0, y1, 0, zc), (x1 - e, x1, y0, y1, 0, zc), (x0, x1, y1 - e, y1, 0, zc)):
        C().caixa(bb, m, M, o)
    fp([(x0 + e, y0 + e, 0.12), (x1 - e, y0 + e, 0.12), (x1 - e, y1 - e, 0.12), (x0 + e, y1 - e, 0.12)], (0, 0, 1), liso('#2a1410'), o)
    for i in range(6):
        for j in range(4):
            bx = x0 + (x1 - x0) * (i + 0.5) / 6
            by = y0 + (y1 - y0) * (j + 0.5) / 4
            o = novo()
            _poligono_rodado(bx, by, [(0.12, 0.026), (zc - 0.06, 0.026), (zc - 0.02, 0.014), (h - 0.012, 0.011)], vol(bx, by, '#3e1e0c', brilho=0.5), o, lados=8)
            C().cilindro(bx, by, 0.017, h - 0.014, h, vol(bx, by, '#d8b040', brilho=0.4), M, o, lados=8, tampa_mat=liso('#f4d870'))
    peg(x0, x1, y0, y1)


def beer_glass():
    """O copo de chope (0,15 m; no chão da casa, o jogo põe em cima do tampo): o chope dourado, o colarinho de espuma."""
    cx, cy = 0.375, 0.375
    h = 0.24 / UN
    zb = h - 0.035

    def chope(P, b):
        zz = P[:, 2]
        b = np.where((zz < 0.012)[:, None], _tom(hx('#e8ecd8'), 0.95), b)
        return np.where((zz > zb)[:, None], hx('#f6efdc'), b)
    o = novo()
    C().cilindro(cx, cy, 0.036, 0.0, zb + 0.022, vol(cx, cy, '#e09a28', brilho=0.6, faixas=chope), M, o, lados=16, r1=0.044, tampa=False)
    o = novo()
    _poligono_rodado(cx, cy, [(zb + 0.022, 0.045), (zb + 0.03, 0.04), (h, 0.022)], vol(cx, cy, '#f6efdc'), o, lados=16, tampa_mat=liso('#fffaf0'))
    peg(cx - 0.04, cx + 0.04, cy - 0.04, cy + 0.04)


def ashtray():
    """O cinzeiro de vidro grosso (5 cm): a borda com os três encaixes, a cinza, a bituca apoiada."""
    cx, cy = 0.375, 0.375
    r = 0.075
    h = 0.08 / UN
    o = novo()
    C().cilindro(cx, cy, r - 0.008, 0.0, h, vol(cx, cy, '#8aa4a4', brilho=0.5), M, o, lados=18, r1=r, tampa=False)

    def topo(L, n, P):
        dx, dy = P[:, 0] - cx, P[:, 1] - cy
        rr = np.hypot(dx, dy)
        th = np.arctan2(dy, dx)
        out = np.tile(hx('#bcd2d0'), (len(P), 1))
        out = np.where((rr < r - 0.022)[:, None], hx('#6a6a66'), out)
        out = np.where(((rr < r - 0.022) & (np.sin(dx * 90) + np.cos(dy * 70) > 0.9))[:, None], hx('#8a8884'), out)
        enc = (rr >= r - 0.022) & (np.cos(3 * th) > 0.93)
        return np.where(enc[:, None], hx('#7a9494'), out)
    _disco(cx, cy, h, r, emissivo(topo), o, lados=18)
    # a bituca apoiada num encaixe (o filtro laranja, o papel branco, a ponta queimada)
    _barra((cx + 0.01, cx + 0.06, cy - PH, cy + PH, h - 0.005, h + 0.012), '#ece6da', '#ffffff', quina=False)
    _barra((cx + 0.06, cx + 0.085, cy - PH, cy + PH, h - 0.005, h + 0.012), '#d88a3a', '#f0a850', quina=False)
    _barra((cx + 0.0, cx + 0.01, cy - PH, cy + PH, h - 0.005, h + 0.012), '#4a4440', quina=False)
    peg(cx - r, cx + r, cy - r, cy + r)


# =====================================================================================================================
# as cadeiras, a banqueta, as mesas do bar
# =====================================================================================================================
def _amarelo(b=None, quina=1.15):
    return _pau(AMARELO, AMARELO_T, quina=quina, b=b)


def cadeira_plastico(x, y, z=0.0, k=1.2, pernas=True, alto_perna=None):
    """
    A cadeira de plástico amarela do boteco (aumento 1,2; o assento a 0,55 m): o assento com a borda, as quatro
    pernas, o encosto de duas ripas com o vão entre elas. As costas para -y. z: onde ela começa (a pilha).
    """
    s = 0.44 * k
    hs = 0.9 / UN
    p = 3 * PH
    zs = z + hs
    if pernas:
        zp0 = z if alto_perna is None else zs - alto_perna
        for (a, b) in ((x + 0.01, y + 0.01), (x + s - 0.01 - p, y + 0.01), (x + 0.01, y + s - 0.01 - p), (x + s - 0.01 - p, y + s - 0.01 - p)):
            _barra((a, a + p, b, b + p, zp0, zs - 3 * PZ), AMARELO, AMARELO_T, quina=False)
    # o assento (a placa e a borda que desce)
    bs = (x, x + s, y, y + s, zs - 3 * PZ, zs)
    _barra(bs, AMARELO, AMARELO_T, quina=1.12)
    _barra((x + 0.02, x + s - 0.02, y + 0.02, y + s - 0.02, zs - 6 * PZ, zs - 3 * PZ), '#b8841a', quina=False)
    # o encosto: os dois montantes (um pouco para trás) e as duas ripas
    ze = zs + 0.36 * k
    for a in (x + 0.01, x + s - 0.01 - p):
        _barra((a, a + p, y - 0.02, y + p - 0.02, zs, ze), AMARELO, AMARELO_T, quina=False)
    for (za, zb) in ((ze - 8 * PZ, ze), (zs + 0.12 * k, zs + 0.12 * k + 6 * PZ)):
        _barra((x + 0.01, x + s - 0.01, y - 0.025, y + p - 0.025, za, zb), AMARELO, AMARELO_T, quina=1.12)
    return zs


def chair_bar():
    s = 0.44 * 1.2
    cadeira_plastico(0.375 - s / 2, 0.375 - s / 2)
    peg(0.375 - s / 2, 0.375 + s / 2, 0.375 - s / 2, 0.375 + s / 2)


def chair_stack():
    """A pilha de cadeiras de plástico (1,30 m): cinco cadeiras amarelas encaixadas, cada uma um palmo acima da de baixo."""
    s = 0.44 * 1.2
    x, y = 0.375 - s / 2, 0.375 - s / 2 + 0.03
    passo = 0.09
    for i in range(5):
        cadeira_plastico(x, y - 0.012 * i, z=i * passo, pernas=True, alto_perna=None if i == 0 else 0.9 / UN - 0.02)
    peg(x, x + s, y - 0.06, y + s)


def stool_bar():
    """
    A banqueta de balcão (aumento 1,2; o assento a 0,90 m): as quatro pernas de nogueira, o aro de apoio dos pés,
    a saia, o assento redondo estofado de couro vermelho com a costura.
    """
    cx, cy = 0.375, 0.375
    k = 1.2
    h = 1.47 / UN
    r = 0.17 * k
    a = 0.11 * k
    zs = h - 0.08
    for (sx, sy) in ((-1, -1), (1, -1), (-1, 1), (1, 1)):
        _barra((cx + sx * a - PH * 1.5, cx + sx * a + PH * 1.5, cy + sy * a - PH * 1.5, cy + sy * a + PH * 1.5, 0.0, zs), '#4a2412', '#6e3a20', quina=False)
    for zr in (0.3,):
        for bb in ((cx - a, cx + a, cy + a - PH, cy + a + PH), (cx + a - PH, cx + a + PH, cy - a, cy + a),
                   (cx - a, cx + a, cy - a - PH, cy - a + PH), (cx - a - PH, cx - a + PH, cy - a, cy + a)):
            _barra((bb[0], bb[1], bb[2], bb[3], zr, zr + 2 * PZ), LATAO, LATAO_L, quina=False)
    caixa((cx - a - 0.02, cx + a + 0.02, cy - a - 0.02, cy + a + 0.02, zs - 0.06, zs), mad2('#5a2c18', seed=261, passo=0.04))
    # o assento: a base de madeira e o estofado vermelho (a cúpula e a costura)
    o = novo()
    C().cilindro(cx, cy, r, zs, zs + 0.025, vol(cx, cy, '#5a2c18'), M, o, lados=24, tampa=False)
    o = novo()

    def costura(P, b):
        zz = P[:, 2] - (zs + 0.025)
        return np.where(((zz > 0.022) & (zz <= 0.022 + PZ))[:, None], _tom(b, 0.7), b)
    _poligono_rodado(cx, cy, [(zs + 0.025, r + 0.005), (h - 0.02, r + 0.005), (h, r - 0.03)], vol(cx, cy, '#b02a22', brilho=0.3, faixas=costura), o, lados=24)

    def topo(L, n, P):
        dx, dy = P[:, 0] - cx, P[:, 1] - cy
        rr = np.hypot(dx, dy)
        out = np.tile(hx('#c2382c'), (len(P), 1))
        out = np.where((rr < r * 0.62)[:, None], hx('#d04636'), out)
        bri = np.hypot(dx + r * 0.3, dy - r * 0.3) < r * 0.2
        return np.where(bri[:, None], hx('#e8705a'), out)
    _disco(cx, cy, h, r - 0.03, emissivo(topo), o, lados=24)
    peg(cx - a - 0.02, cx + a + 0.02, cy - a - 0.02, cy + a + 0.02)


def table_bar():
    """
    A mesa de bar redonda e alta (aumento 1,2; o tampo a 0,90 m): o tampo amarelo esmaltado com a beira de alumínio e
    o friso vermelho, a coluna de ferro e os quatro pés baixos. Nada embaixo do tampo: a cadeira encaixa.
    """
    cx, cy = 0.375, 0.375
    r = 0.3 * 1.2
    h = 1.47 / UN
    tp = 0.035

    def topo(L, n, P):
        dx, dy = P[:, 0] - cx, P[:, 1] - cy
        rr = np.hypot(dx, dy)
        out = np.tile(hx('#eab42a'), (len(P), 1))
        out = np.where((rr > r - 0.07)[:, None], hx('#e2a822'), out)
        out = np.where((np.abs(rr - (r - 0.075)) < PH * 0.6)[:, None], hx('#b8302a'), out)
        out = np.where((rr > r - 0.018)[:, None], hx('#c8ccc8'), out)
        # o desgaste do uso e as marcas de copo (aros)
        for (ax, ay) in ((-0.1, 0.06), (0.12, -0.08)):
            d = np.hypot(dx - ax, dy - ay)
            out = np.where((np.abs(d - 0.045) < PH * 0.6)[:, None], hx('#d29a20'), out)
        bri = np.hypot(dx + r * 0.35, dy - r * 0.35) < r * 0.16
        return np.where(bri[:, None], hx('#f6d466'), out)
    o = novo()
    C().cilindro(cx, cy, r, h - tp, h, vol(cx, cy, '#b0b4b0', brilho=0.5), M, o, lados=40, tampa_mat=emissivo(topo))
    o = novo()
    C().cilindro(cx, cy, 0.09, h - tp - 0.025, h - tp, vol(cx, cy, '#2a2626'), M, o, lados=16, tampa=False)
    o = novo()
    C().cilindro(cx, cy, 0.03, 0.06, h - tp - 0.025, vol(cx, cy, '#34302e', brilho=0.4), M, o, lados=12, tampa=False)
    # os quatro pés em cruz
    PE = {'cima': liso('#4a4440'), '*': liso('#2a2624')}
    caixa((cx - 0.26, cx + 0.26, cy - 0.025, cy + 0.025, 0.02, 0.07), PE)
    caixa((cx - 0.025, cx + 0.025, cy - 0.26, cy + 0.26, 0.02, 0.07), PE)
    for (a, b) in ((cx - 0.25, cy), (cx + 0.25, cy), (cx, cy - 0.25), (cx, cy + 0.25)):
        _barra((a - 0.02, a + 0.02, b - 0.02, b + 0.02, 0.0, 0.02), '#1e1a1a', quina=False)
    peg(cx - 0.27, cx + 0.27, cy - 0.27, cy + 0.27)


def table_chess():
    """
    A mesa de xadrez (aumento 1,2; o tampo a 0,86 m): o tampo de nogueira com o tabuleiro de marchetaria (8 x 8 casas
    de 3 px, a moldura clara), a saia fininha, as quatro pernas torneadas, e as peças no meio do jogo.
    """
    w = 0.6 * 1.2
    x, y = 0.375 - w / 2, 0.375 - w / 2
    h = 1.4 / UN
    tp = 0.05
    q = 3 * PH
    bx0 = 0.375 - 4 * q
    by0 = 0.375 - 4 * q
    T = tab2(NOG_TAB, 0.18, '#3e1c0e', eixo=0, seed=271, org=y)

    def topo(L, n, P):
        X, Y = P[:, 0], P[:, 1]
        out = T(L, n, P)
        i, j = np.floor((X - bx0) / q), np.floor((Y - by0) / q)
        dentro = (i >= 0) & (i < 8) & (j >= 0) & (j < 8)
        casa = np.where(((i + j) % 2 == 0)[:, None], hx('#e2c894'), hx('#6a3018'))
        out = np.where(dentro[:, None], casa, out)
        mold = ~dentro & (X > bx0 - 2 * PH) & (X < bx0 + 8 * q + 2 * PH) & (Y > by0 - 2 * PH) & (Y < by0 + 8 * q + 2 * PH)
        return np.where(mold[:, None], hx('#c08a4a'), out)
    caixa((x, x + w, y, y + w, h - tp, h), {'cima': emissivo(topo), '*': _pau(NOG, '#7e4026', quina=1.22, b=(0, 0, 0, 0, h - tp, h))})
    caixa((x + 0.06, x + w - 0.06, y + 0.06, y + w - 0.06, h - tp - 0.06, h - tp), mad2('#4a2412', seed=272, passo=0.05))
    for (a, b) in ((x + 0.09, y + 0.09), (x + w - 0.09, y + 0.09), (x + 0.09, y + w - 0.09), (x + w - 0.09, y + w - 0.09)):
        CA.perna_torneada(a, b, 0.0, h - tp - 0.05, 0.045, '#5e2e18')
    # as peças (brancas e pretas, no meio da partida): o peão baixo, a torre, o rei alto com a cruz
    def peca(i, j, alto, branca):
        px_, py_ = bx0 + (i + 0.5) * q, by0 + (j + 0.5) * q
        cor = '#f2ead4' if branca else '#2a201c'
        o = novo()
        _poligono_rodado(px_, py_, [(h, 0.024), (h + 0.012, 0.02), (h + alto * 0.7, 0.012), (h + alto, 0.018)], vol(px_, py_, cor, brilho=0.4), o, lados=10,
                         tampa_mat=liso(cor))
    for (i, j, a, b) in ((1, 6, 0.05, True), (2, 5, 0.05, True), (5, 6, 0.05, True), (4, 7, 0.1, True), (0, 7, 0.07, True),
                         (2, 1, 0.05, False), (4, 2, 0.05, False), (6, 1, 0.05, False), (3, 0, 0.1, False), (5, 3, 0.07, False)):
        peca(i, j, a, b)
    CZ.itens_peq.append((bx0, bx0 + 8 * q, by0, by0 + 8 * q, h))
    peg(x, x + w, y, y + w)


# =====================================================================================================================
# a sinuca
# =====================================================================================================================
def pool_table():
    """
    A mesa de sinuca (2 x 4 casas; o aro a 0,85 m): a caixa de nogueira com as almofadas, as seis pernas torneadas
    grossas, o pano verde com a luz no meio, as tabelas verdes, o aro de madeira com os losangos de madrepérola, as
    seis caçapas de couro, as bolas no triângulo, a branca e o taco deitado.
    """
    x0, x1, y0, y1 = 0.07, 1.43, 0.08, 2.92
    h = 1.39 / UN
    ar = 0.11
    zf = h - 0.04
    zb = h - 0.3
    # as pernas (seis, torneadas grossas)
    for (a, b) in ((x0 + 0.1, y0 + 0.12), (x1 - 0.1, y0 + 0.12), (x0 + 0.1, y1 - 0.12), (x1 - 0.1, y1 - 0.12), (x0 + 0.1, 1.5), (x1 - 0.1, 1.5)):
        CA.perna_torneada(a, b, 0.0, zb + 0.01, 0.075, '#3e1c0e')
    # a caixa (a saia com as almofadas) e o pano
    pain_l = [(y0 + 0.08 + k * 0.7, y0 + 0.08 + k * 0.7 + 0.62, zb + 0.05, zf - 0.07, 'p') for k in range(4)]
    pain_f = [(x0 + 0.08, x1 - 0.08, zb + 0.05, zf - 0.07, 'p')]
    cx_, cy_ = (x0 + x1) / 2, (y0 + y1) / 2

    def pano(L, n, P):
        X, Y = P[:, 0], P[:, 1]
        out = np.tile(hx('#2e7a4a'), (len(P), 1))
        d = np.hypot((X - cx_) / 0.55, (Y - cy_) / 1.2)
        out = np.where((d < 0.8)[:, None], hx('#348654'), out)
        out = np.where((d < 0.45)[:, None], hx('#3a8e5a'), out)
        # a linha de saída (o risco claro de través) e a marca da branca
        out = np.where((np.abs(Y - (y1 - 0.75)) < PH * 0.5)[:, None], hx('#5aa476'), out)
        return out
    caixa((x0 + 0.04, x1 - 0.04, y0 + 0.04, y1 - 0.04, zb, zf), {'cima': emissivo(pano), 'frente': almofadas(WAL, pain_f, seed=281),
                                                                 'costas': almofadas(WAL, pain_f, seed=282), 'dir': _alm_y(WAL, pain_l, 283),
                                                                 'esq': _alm_y(WAL, pain_l, 284)})
    caixa((x0 + 0.03, x1 - 0.03, y0 + 0.03, y1 - 0.03, zb - 0.04, zb), _pau('#2e160c', quina=1.2, b=(0, 0, 0, 0, zb - 0.04, zb)))
    # o aro de madeira com os losangos e as tabelas verdes
    def aro(eixo, org):
        base = tab2(['#6a3018', '#64301a'], ar, '#3a1a0c', eixo=eixo, seed=285, org=org, veio=True)

        def f(L, n, P):
            out = base(L, n, P)
            al = P[:, 1] if eixo == 1 else P[:, 0]
            tr = P[:, 0] if eixo == 1 else P[:, 1]
            meio_t = org + ar / 2
            comp = (y1 - y0) if eixo == 1 else (x1 - x0)
            st = comp / (8 if eixo == 1 else 4)
            o0 = y0 if eixo == 1 else x0
            g = ((al - o0) % st) - st / 2
            los = (np.abs(g) / (1.6 * PH) + np.abs(tr - meio_t) / (1.6 * PH)) < 1.0
            return np.where(los[:, None], hx('#efe6d0'), out)
        return {'cima': emissivo(f), '*': _pau('#5a2814', quina=1.25, b=(0, 0, 0, 0, zf, h))}
    caixa((x0, x0 + ar, y0, y1, zf, h), aro(1, x0))
    caixa((x1 - ar, x1, y0, y1, zf, h), aro(1, x1 - ar))
    caixa((x0 + ar, x1 - ar, y0, y0 + ar, zf, h), aro(0, y0))
    caixa((x0 + ar, x1 - ar, y1 - ar, y1, zf, h), aro(0, y1 - ar))
    TAB = {'cima': liso('#2a6e42'), '*': liso('#24603a')}
    tb = 0.035
    caixa((x0 + ar, x0 + ar + tb, y0 + ar, y1 - ar, zf, h - 0.012), TAB)
    caixa((x1 - ar - tb, x1 - ar, y0 + ar, y1 - ar, zf, h - 0.012), TAB)
    caixa((x0 + ar + tb, x1 - ar - tb, y0 + ar, y0 + ar + tb, zf, h - 0.012), TAB)
    caixa((x0 + ar + tb, x1 - ar - tb, y1 - ar - tb, y1 - ar, zf, h - 0.012), TAB)
    # as caçapas (o buraco preto no canto e no meio dos lados compridos, o couro em volta)
    for (px_, py_) in ((x0 + 0.075, y0 + 0.075), (x1 - 0.075, y0 + 0.075), (x0 + 0.075, y1 - 0.075), (x1 - 0.075, y1 - 0.075),
                       (x0 + 0.06, cy_), (x1 - 0.06, cy_)):
        def cac(L, n, P, px_=px_, py_=py_):
            rr = np.hypot(P[:, 0] - px_, P[:, 1] - py_)
            out = np.where((rr < 0.05)[:, None], hx('#120c0a'), hx('#3a2418'))
            return np.where(((rr >= 0.05) & (rr < 0.05 + PH))[:, None], hx('#6a4a30'), out)
        o = novo()
        _disco(px_, py_, h + 0.002, 0.075, emissivo(cac), o, lados=18)
    # as bolas: o triângulo do lado de lá, a branca do lado de cá
    rb = 0.042
    cores = ('#e8c030', '#2a52a8', '#c8302a', '#6a2a8a', '#e8782a', '#2a8a4a', '#8a2a1a', '#1e1a1a', '#e8c030', '#2a52a8')
    k = 0
    for fila in range(4):
        for i in range(fila + 1):
            bx = cx_ + (i - fila / 2) * rb * 2.1
            by = y0 + 0.95 - fila * rb * 1.85
            o = novo()
            C().elipsoide(np.array([bx, by, zf + rb]), np.array([rb, rb, rb]), liso(cores[k % len(cores)]), o, brilho=0.6)
            k += 1
    o = novo()
    C().elipsoide(np.array([cx_ - 0.12, y1 - 0.72, zf + rb]), np.array([rb, rb, rb]), liso('#f4f0e4'), o, brilho=0.6)
    # o taco deitado em diagonal-reta (ao comprido): a ponteira, a madeira clara, o cabo escuro
    tx = x1 - ar - 0.18
    _barra((tx - PH, tx + PH, y1 - ar - 1.6, y1 - ar - 1.58, zf, zf + 2 * PZ), '#3a7ab8', quina=False)
    _barra((tx - PH, tx + PH, y1 - ar - 1.58, y1 - ar - 0.7, zf, zf + 2 * PZ), '#e4c890', '#f4dca8', quina=False)
    _barra((tx - PH * 1.5, tx + PH * 1.5, y1 - ar - 0.7, y1 - ar - 0.1, zf, zf + 3 * PZ), '#3a1a10', '#5a2c18', quina=False)
    peg(x0, x1, y0, y1)


def _alm_y(cor, paineis, seed):
    """As almofadas na face de lado (normal ±x): o mesmo da almofadas(), com u = y."""
    base = mad2(cor, eixo=0, seed=seed, passo=0.06)
    c0 = hx(cor)
    fr_c = _tom(c0, 0.42)

    def f(L, n, P):
        out = base(L, n, P)
        if abs(n[0]) <= 0.5:
            return out
        u, z = P[:, 1], P[:, 2]
        for (u0, u1, z0, z1, k) in paineis:
            d = (u >= u0) & (u < u1) & (z >= z0) & (z < z1)
            fr = d & ((u < u0 + PH) | (u >= u1 - PH) | (z < z0 + PZ) | (z >= z1 - PZ))
            luz = d & ~fr & ((z >= z1 - 2 * PZ) | (u < u0 + 2 * PH))
            som = d & ~fr & ((z < z0 + 2 * PZ) | (u >= u1 - 2 * PH))
            out = np.where(luz[:, None], _tom(out, 1.13), out)
            out = np.where(som[:, None], _tom(out, 0.84), out)
            m, mz = 0.055, min(0.05, (z1 - z0) * 0.25)
            mi = d & (u >= u0 + m) & (u < u1 - m) & (z >= z0 + mz) & (z < z1 - mz)
            out = np.where((mi & ((u < u0 + m + PH) | (z >= z1 - mz - PZ)))[:, None], _tom(c0, 0.7), out)
            out = np.where((mi & ((u >= u1 - m - PH) | (z < z0 + mz + PZ)))[:, None], _tom(c0, 1.18), out)
            out = np.where(fr[:, None], fr_c, out)
        return out
    return emissivo(f)


# =====================================================================================================================
# os estofados: a poltrona vermelha, a poltrona preta, o sofá do bar
# =====================================================================================================================
_VERMELHO = _p1_rampa(['#3a0e0c', '#4e1410', '#641a14', '#7a2018', '#8e281e', '#a23024', '#b23a2a', '#c24a34', '#d05c40', '#dc7050'])
_PRETO = _p1_rampa(['#141012', '#1c1618', '#241e1e', '#2e2626', '#383030', '#443a38', '#504644', '#5e5250', '#6e6260', '#827674'])


def estofo(R, b, lo=2.4, hi=6.6, cupula=1.0, brilho=True, grad=1.0, canais=None, botoes=None):
    """
    O couro do estofado (o da poltrona da casa) numa rampa qualquer: a cúpula clara no topo, o reflexo, os lados que
    escurecem embaixo. canais: (passo, x0) os gomos em pé na frente (o sofá do bar); botoes: (passo_x, passo_z, x0, z0)
    os botões do capitonê na frente.
    """
    x0, x1, y0, y1, z0, z1 = b

    def extra(L, n, P):
        e = np.zeros(len(L))
        if n[2] > 0.8:
            u = (P[:, 0] - (x0 + x1) / 2) / ((x1 - x0) / 2)
            v = (P[:, 1] - (y0 + y1) / 2) / ((y1 - y0) / 2)
            d = (np.abs(u) ** 3 + np.abs(v) ** 3) ** (1 / 3)
            e += np.where(d < 0.42, cupula, np.where(d < 0.72, cupula * 0.55, 0))
            if brilho:
                bu, bv = (u + 0.3) * 1.3, v - 0.3
                e += np.where((np.abs(bu) ** 3 + np.abs(bv) ** 3) < 0.03, 1.0, 0)
        elif n[2] < 0.6:
            t = np.clip((P[:, 2] - z0) / max(1e-6, z1 - z0), 0, 1)
            e += np.where(t < 0.4, -grad, 0)
        if canais is not None and n[1] > 0.3:
            ps, xa = canais
            g = (P[:, 0] - xa) % ps
            e += np.where(g < PH, -2.5, 0) + np.where((g >= PH) & (g < 2 * PH), 0.8, 0) + np.where(g > ps - 2 * PH, -0.8, 0)
        if botoes is not None and n[1] > 0.3:
            px_, pz_, xa, za = botoes
            gx = ((P[:, 0] - xa) % px_) - px_ / 2
            gz = ((P[:, 2] - za) % pz_) - pz_ / 2
            meio = np.floor((P[:, 2] - za) / pz_) % 2 == 1
            gx = np.where(meio, ((P[:, 0] - xa + px_ / 2) % px_) - px_ / 2, gx)
            bt = (np.abs(gx) < 1.0 * PH) & (np.abs(gz) < 1.0 * PZ)
            e += np.where(bt, -3.0, 0)
            # as dobras em diagonal até o botão
            e += np.where(~bt & (np.abs(np.abs(gx) / PH - np.abs(gz) / PZ) < 0.6) & (np.abs(gx) < 4 * PH), -1.0, 0)
        return e
    return _p1_mat_rampa(R, lo, hi, extra=extra)


def poltrona(R, zs, zt, pes='madeira', botoes=False):
    """A poltrona (a da casa, na rampa R): os braços com o rolo, o encosto até zt, a almofada do assento, os pés."""
    x0, x1 = 0.02, 0.73
    y0, y1 = 0.03, 0.72
    br = 0.15
    if pes == 'madeira':
        MAD = _p1_mat_rampa(BE._MAD, 2.0, 6.0)
        for a in (x0 + 0.05, x1 - 0.11):
            for b_ in (y0 + 0.04, y1 - 0.1):
                _p1_malha((a, a + 0.06, b_, b_ + 0.06, 0.0, 0.1), (0.012, 0.012, 0.0, 0.0), MAD, seg=1)
    else:
        for a in (x0 + 0.06, x1 - 0.09):
            for b_ in (y0 + 0.05, y1 - 0.08):
                _barra((a, a + 0.03, b_, b_ + 0.03, 0.0, 0.1), CROMO[0], CROMO[1], quina=False)
    b = (x0 + 0.04, x1 - 0.04, y0 + 0.05, y1 - 0.03, 0.08, zs - 0.12)
    _p1_malha(b, (0.03, 0.03, 0.02, 0.03), estofo(R, b, lo=1.2, hi=4.6, cupula=0, brilho=False, grad=0.8), seg=2)
    b = (x0 + 0.04, x1 - 0.04, y0, y0 + 0.22, zs - 0.15, zt)
    _p1_malha(b, (0.07, 0.07, 0.02, 0.1), estofo(R, b, lo=2.0, hi=6.0, cupula=0.4, brilho=False, grad=0.6), seg=2)
    b = (x0 + br - 0.01, x1 - br + 0.01, y0 + 0.14, y0 + 0.36, zs - 0.04, zt - 0.06)
    cn = (0.11, x0 + br + 0.04) if botoes else None
    _p1_malha(b, (0.09, 0.08, 0.06, 0.13), estofo(R, b, lo=2.2, hi=7.4, cupula=0.8, grad=1.6, canais=cn), seg=2)
    b = (x0 + br - 0.005, x1 - br + 0.005, y0 + 0.28, y1, zs - 0.15, zs)
    _p1_malha(b, (0.07, 0.06, 0.035, 0.07), estofo(R, b, lo=2.0, hi=7.2, cupula=1.2, grad=1.0), seg=2)
    for (a0, a1) in ((x0, x0 + br), (x1 - br, x1)):
        b = (a0 + 0.02, a1 - 0.02, y0 + 0.04, y1 - 0.02, 0.08, zs + 0.08)
        _p1_malha(b, (0.04, 0.05, 0.02, 0.03), estofo(R, b, lo=1.8, hi=5.6, cupula=0, brilho=False, grad=1.0), seg=2)
        b = (a0, a1, y0 + 0.02, y1, zs, zs + 0.23)
        _p1_malha(b, (0.07, 0.08, 0.08, 0.1), estofo(R, b, lo=2.2, hi=7.6, cupula=0.8, grad=1.0), seg=2)
    peg(x0, x1, y0, y1)


def armchair_red():
    """A poltrona vermelha do bar (o assento a 0,45 m): a de couro da casa, em couro vermelho gasto, pés de madeira."""
    poltrona(_VERMELHO, 0.73 / UN, 0.98)


def poltrona_preta():
    """A poltrona preta da sala (o encosto a 0,95 m): couro preto com o capitonê no encosto e os pés de metal."""
    poltrona(_PRETO, 0.45, 1.55 / UN, pes='metal', botoes=True)


def sofa_booth():
    """
    O sofá vermelho de bar (2 x 1 casas; o assento a 0,45 m): o encosto alto em gomos em pé (o estofado de lanchonete),
    o assento inteiriço, as cabeceiras de nogueira dos lados e o rodapé.
    """
    x0, x1 = 0.03, 1.47
    y0, y1 = 0.06, 0.72
    zs = 0.73 / UN
    zt = 1.0
    ca = 0.07
    caixa((x0 + ca, x1 - ca, y0 + 0.04, y1 - 0.05, 0.0, 0.12), mad2('#2e160c', seed=291, passo=0.04))
    b = (x0 + ca, x1 - ca, y0 + 0.2, y1 - 0.02, 0.1, zs)
    _p1_malha(b, (0.03, 0.06, 0.02, 0.06), estofo(_VERMELHO, b, lo=2.0, hi=7.0, cupula=0.9, grad=1.2), seg=2)
    b = (x0 + ca, x1 - ca, y0, y0 + 0.24, zs - 0.06, zt)
    _p1_malha(b, (0.02, 0.08, 0.02, 0.1), estofo(_VERMELHO, b, lo=2.2, hi=7.2, cupula=0.5, grad=0.4, canais=(0.17, x0 + ca + 0.02)), seg=2)
    # as cabeceiras de madeira dos lados (o braço baixo na frente, alto atrás)
    LAT = {'frente': almofadas(WAL, [], seed=292), 'cima': liso('#6a3420'), '*': mad2(WAL, eixo=1, seed=293, passo=0.05)}
    for xx in (x0, x1 - ca):
        caixa((xx, xx + ca, y0, y0 + 0.26, 0.0, zt + 0.03), LAT)
        caixa((xx, xx + ca, y0 + 0.26, y1, 0.0, zs + 0.2), LAT)
        caixa((xx - 0.008, xx + ca + 0.008, y0 + 0.26, y1 + 0.01, zs + 0.2, zs + 0.24), _pau('#6a3018', quina=1.25, b=(0, 0, 0, 0, zs + 0.2, zs + 0.24)))
    # as costas de madeira (o booth encostado, fechado atrás)
    caixa((x0 + ca, x1 - ca, y0 - 0.01, y0 + 0.02, 0.1, zt - 0.02), {'costas': tab2(CA.PINHO, 0.14, '#6a4426', eixo=1, seed=294), '*': liso('#3a1c10')})
    peg(x0, x1, y0, y1)


# =====================================================================================================================
# o fliperama
# =====================================================================================================================
_FLIP_FORA = [(0.08, 0.0), (0.62, 0.0), (0.62, 0.86), (0.7, 0.92), (0.7, 1.0), (0.55, 1.06), (0.44, 1.48), (0.6, 1.52), (0.62, 1.74),
              (0.52, 1.8), (0.08, 1.8)]
_FLIP_PEDACOS = ([(0.08, 0.0), (0.62, 0.0), (0.62, 0.86), (0.08, 0.86)],
                 [(0.08, 0.86), (0.62, 0.86), (0.7, 0.92), (0.7, 1.0), (0.55, 1.06), (0.08, 1.06)],
                 [(0.08, 1.06), (0.55, 1.06), (0.44, 1.48), (0.08, 1.48)],
                 [(0.08, 1.48), (0.44, 1.48), (0.6, 1.52), (0.62, 1.74), (0.52, 1.8), (0.08, 1.8)])
_FLIP_DENTRO = [(0.1, 0.0), (0.6, 0.0), (0.6, 0.86), (0.685, 0.915), (0.685, 0.99), (0.53, 1.05), (0.42, 1.47), (0.58, 1.515), (0.6, 1.72),
                (0.5, 1.78), (0.1, 1.78)]


def arcade(ligado=True):
    """
    O fliperama do bar (1,80 m): o gabinete preto com a arte de faixas nos lados e o friso vermelho, o painel com a
    alavanca e os botões, o moedeiro com as fendas acesas, a tela inclinada (ligado: o jogo de blocos colorido; desligado:
    o vidro escuro), o letreiro aceso em cima (formas coloridas, sem letra).
    """
    x0, x1 = 0.065, 0.685
    t = 0.03
    zh = 2.94 / UN

    def esc(p):
        return [(y, z * zh / 1.8) for (y, z) in p]
    FORA, DENTRO = esc(_FLIP_FORA), esc(_FLIP_DENTRO)
    PED = [esc(p) for p in _FLIP_PEDACOS]

    # os lados: o preto com as faixas em diagonal (vermelho, laranja, amarelo) e o friso vermelho na borda
    def lado(L, n, P):
        Y, Z = P[:, 1], P[:, 2]
        out = np.tile(hx('#1e1c26'), (len(P), 1))
        s = (Z - 0.5) - (Y - 0.1) * 1.3
        for (a, cor) in ((0.0, '#c8302a'), (0.07, '#e8782a'), (0.14, '#e8c030')):
            out = np.where(((s > a) & (s < a + 0.045))[:, None], hx(cor), out)
        return out
    FRISO = liso('#b8302a')
    for (a, b) in ((x0, x0 + t), (x1 - t, x1)):
        o = novo()
        extrudar_x(FORA, a, b, [FRISO] * len(FORA), o, PED, emissivo(lado))
    # o miolo: a frente de baixo com o moedeiro, o painel, a moldura da tela, o letreiro, o teto, as costas
    PRETO = mad2('#24222a', eixo=1, seed=301, passo=0.2, claro=1.06, escuro=0.95)

    def frente_baixo(L, n, P):
        X, Z = P[:, 0], P[:, 2]
        out = np.tile(hx('#24222a'), (len(P), 1))
        mx = (x0 + x1) / 2
        porta = (np.abs(X - mx) < 0.15) & (Z > 0.3) & (Z < 0.68)
        out = np.where(porta[:, None], hx('#3a3842'), out)
        out = np.where((porta & ((np.abs(np.abs(X - mx) - 0.15) < PH) | (np.abs(Z - 0.68) < PZ)))[:, None], hx('#4e4c58'), out)
        out = np.where(((Z < 0.1))[:, None], hx('#141218'), out)
        return out
    PAINEL = liso('#2e2c36')
    MOLD = liso('#141218')
    mats = [liso('#141218'), emissivo(frente_baixo), PAINEL, liso('#3a3842'), PAINEL, MOLD, liso('#1a1820'), MOLD, liso('#2a2832'), PRETO,
            mad2('#2a2226', eixo=1, seed=302, passo=0.15)]
    o = novo()
    extrudar_x(DENTRO, x0 + t, x1 - t, mats, o)
    # as fendas do moedeiro (acesas, laranja; desligado, apagadas)
    mx = (x0 + x1) / 2
    yf = DENTRO[1][0]
    for dx in (-0.06, 0.06):
        if ligado:
            ol = luz_obj()
            fp([(mx + dx - 0.025, yf + 0.004, 0.5), (mx + dx + 0.025, yf + 0.004, 0.5), (mx + dx + 0.025, yf + 0.004, 0.56), (mx + dx - 0.025, yf + 0.004, 0.56)],
               (0, 1, 0), liso('#ff9a3a'), ol)
        else:
            _barra((mx + dx - 0.025, mx + dx + 0.025, yf, yf + 0.006, 0.5, 0.56), '#5a3a20', quina=False)
    # o painel: a alavanca (a bola vermelha) e os botões
    (ya, za), (yb, zb) = DENTRO[4], DENTRO[5]

    def no_painel(f):
        return ya + (yb - ya) * f, za + (zb - za) * f
    yj, zj = no_painel(0.45)
    _barra((mx - 0.13 - PH, mx - 0.13 + PH, yj - PH, yj + PH, zj, zj + 0.07), '#1a1a1a', quina=False)
    o = novo()
    C().elipsoide(np.array([mx - 0.13, yj, zj + 0.085]), np.array([0.028, 0.028, 0.026]), liso('#d0302a'), o, brilho=0.6)
    for k, (dx, cor) in enumerate(((0.0, '#e8c030'), (0.07, '#2a8ad8'), (0.14, '#3ab84a'))):
        yb_, zb_ = no_painel(0.5 if k != 1 else 0.35)
        o = novo()
        C().cilindro(mx + dx, yb_, 0.022, zb_ - 0.005, zb_ + 0.018, vol(mx + dx, yb_, cor, brilho=0.4), M, o, lados=12, tampa_mat=liso(_hex(_tom(hx(cor), 1.2))))
    # a tela (inclinada, recuada na moldura)
    (yf0, zf0), (yg, zg) = DENTRO[5], DENTRO[6]
    dy, dz = yg - yf0, zg - zf0
    Ls = math.hypot(dy, dz)
    ey, ez = dy / Ls, dz / Ls
    ny, nz = ez, -ey
    m = 0.045
    sx0, sx1 = x0 + t + m, x1 - t - m
    s0, s1 = 0.04, Ls - 0.05

    def pt(x, s, off=0.003):
        return (x, yf0 + ey * s + ny * off, zf0 + ez * s + nz * off)
    bloco_u = 2 * PH
    bloco_v = 3 / 56.0

    def tela(L, n, P):
        X = P[:, 0]
        s = (P[:, 1] - yf0) * ey + (P[:, 2] - zf0) * ez
        u = np.floor((X - sx0) / bloco_u)
        v = np.floor((s - s0) / bloco_v)
        nu = int(round((sx1 - sx0) / bloco_u))
        if not ligado:
            out = np.tile(hx('#1e2a28'), (len(P), 1))
            ref = (np.floor(X / PH) - np.floor(s / (1 / 56.0))) % 19 < 2
            return np.where(ref[:, None], hx('#34403c'), out)
        out = np.tile(hx('#141a3a'), (len(P), 1))
        # a pilha de blocos (embaixo) e a peça caindo, cada cor um tom
        cores = np.stack([hx(x) for x in ('#e83a3a', '#3ad8e8', '#f0d040', '#5ae05a', '#b05ae8', '#f08a2a')])
        alturas = np.array([3, 3, 2, 4, 3, 1, 2, 3, 3, 2, 4, 3])
        col = np.clip(u, 0, len(alturas) - 1).astype(int)
        cheio = (v < alturas[col]) & (u >= 0) & (u < nu) & (v >= 0)
        buraco = (u == 5) & (v < 2)
        cheio &= ~buraco
        k = ((u * 3 + v * 5) % 6).astype(int)
        out = np.where(cheio[:, None], cores[k], out)
        # a peça em T caindo
        tpc = ((v == 6) & (u >= 3) & (u <= 5)) | ((v == 5) & (u == 4))
        out = np.where(tpc[:, None], hx('#b05ae8'), out)
        # a grade de fundo apagada e o placar (barrinhas, sem número)
        out = np.where((~cheio & ~tpc & (u == nu - 1))[:, None], hx('#22285a'), out)
        out = np.where(((u == nu - 1) & ((v == 7) | (v == 6)))[:, None], hx('#e8e8f0'), out)
        # o reflexo do vidro em diagonal
        ref = ((np.floor(X / PH) + np.floor(s / (1 / 56.0))) % 23) < 2
        return np.where(ref[:, None], _tom(out, 1.35), out)
    o = luz_obj() if ligado else novo()
    fp([pt(sx0, s0), pt(sx1, s0), pt(sx1, s1), pt(sx0, s1)], (0, ny, nz), emissivo(tela), o)
    # o letreiro (a frente do alto): as formas coloridas acesas
    (yh, zh_), (yi, zi) = DENTRO[7], DENTRO[8]
    dy, dz = yi - yh, zi - zh_
    Lm = math.hypot(dy, dz)
    my, mz = dy / Lm, dz / Lm
    nmy, nmz = mz, -my

    def letreiro(L, n, P):
        X = P[:, 0]
        s = (P[:, 1] - yh) * my + (P[:, 2] - zh_) * mz
        u = (X - (x0 + t)) / (x1 - x0 - 2 * t)
        v = s / Lm
        if ligado:
            out = np.tile(hx('#2a1a5a'), (len(P), 1))
            out = np.where((v < 0.18)[:, None], hx('#e83a8a'), out)
            out = np.where((v > 0.86)[:, None], hx('#e83a8a'), out)
            for (cu, cor) in ((0.2, '#f0d040'), (0.42, '#3ad8e8'), (0.62, '#5ae05a'), (0.82, '#f08a2a')):
                bl = (np.abs(u - cu) < 0.07) & (np.abs(v - 0.52) < 0.2)
                out = np.where(bl[:, None], hx(cor), out)
                out = np.where((bl & (v > 0.6))[:, None], _tom(hx(cor), 1.3), out)
            return out
        out = np.tile(hx('#2a2440'), (len(P), 1))
        for cu in (0.2, 0.42, 0.62, 0.82):
            out = np.where(((np.abs(u - cu) < 0.07) & (np.abs(v - 0.52) < 0.2))[:, None], hx('#4a4458'), out)
        return out
    o = luz_obj() if ligado else novo()
    off = 0.003
    fp([(x0 + t + 0.01, yh + nmy * off, zh_ + nmz * off), (x1 - t - 0.01, yh + nmy * off, zh_ + nmz * off),
        (x1 - t - 0.01, yi + nmy * off, zi + nmz * off), (x0 + t + 0.01, yi + nmy * off, zi + nmz * off)], (0, nmy, nmz), emissivo(letreiro), o)
    peg(x0, x1, 0.08, 0.7)


# =====================================================================================================================
# a luminária de chão e a rosa dos ventos
# =====================================================================================================================
def floor_lamp(acesa=True):
    """
    A luminária de chão (1,90 m): o pé redondo de ferro, a haste de latão com o anel, a cúpula de pano creme em tronco
    de cone (acesa: o pano claro e quente, a boca de baixo brilhando, a lâmpada à mostra; apagada: o pano fosco).
    """
    cx, cy = 0.375, 0.375
    h = 3.1 / UN
    o = novo()
    _poligono_rodado(cx, cy, [(0.0, 0.17), (0.02, 0.17), (0.04, 0.13), (0.06, 0.05), (0.09, 0.03)], vol(cx, cy, '#2a2624', brilho=0.4), o, lados=26,
                     tampa_mat=liso('#3a3634'))
    zb, zt = h - 0.34, h
    o = novo()
    C().cilindro(cx, cy, 0.016, 0.09, zb + 0.06, vol(cx, cy, '#b0843a', brilho=0.5), M, o, lados=10, tampa=False)
    o = novo()
    _poligono_rodado(cx, cy, [(0.95, 0.016), (0.97, 0.03), (1.0, 0.03), (1.02, 0.016)], vol(cx, cy, '#b0843a', brilho=0.5), o, lados=12)

    def pano(P, b):
        zz = P[:, 2]
        b = np.where((zz < zb + 1.5 * PZ)[:, None], _tom(b, 0.8), b)
        b = np.where((zz > zt - 1.5 * PZ)[:, None], _tom(b, 0.84), b)
        if acesa:
            b = np.where(((zz >= zb + 1.5 * PZ) & (zz < zb + 0.1))[:, None], _tom(b, 1.1), b)
        return b
    cor = '#f6dca0' if acesa else '#bfb298'
    o = luz_obj() if acesa else novo()
    if acesa:
        C().contornos[o] = True
    C().cilindro(cx, cy, 0.25, zb, zt, vol(cx, cy, cor, faixas=pano), M, o, lados=28, tampa=False, r1=0.17)

    def boca(L, n, P):
        rr = np.hypot(P[:, 0] - cx, P[:, 1] - cy)
        dentro = hx('#fff2c4') if acesa else hx('#5a4e3a')
        return np.where((rr > 0.17 - 0.014)[:, None], hx(cor) * 0.88, dentro)
    od = luz_obj() if acesa else novo()
    _disco(cx, cy, zt + 0.001, 0.17 - 0.014, emissivo(boca), od, lados=28)
    _disco(cx, cy, zt, 0.17, liso('#e8d090' if acesa else '#a89c84'), o, lados=28)
    ob = luz_obj() if acesa else novo()
    CA.lampadinha(cx, cy, zb - 0.02, zb + 0.08, acesa, ob)
    peg(cx - 0.17, cx + 0.17, cy - 0.17, cy + 0.17)


def compass_floor():
    """
    A rosa dos ventos de bronze no chão (3 x 3 casas; decalque de 1 px): o disco de pedra escura, o aro de bronze com
    as marcas, a estrela de oito pontas (as quatro grandes e as quatro menores) com as metades clara e escura, a ponta
    do norte com o esmalte vermelho, o miolo. Sem letras.
    """
    cx = cy = 1.125
    R = 1.06

    def f(L, n, P):
        X, Y = P[:, 0], P[:, 1]
        u, v = np.floor((X - cx) / PH) + 0.5, np.floor((Y - cy) / PH) + 0.5
        rr = np.hypot(u, v) * PH
        th = np.arctan2(v, u)
        bz, bz_c, bz_e = hx('#b0843a'), hx('#d8ac58'), hx('#7a5624')
        out = np.tile(hx('#3a3c3a'), (len(P), 1))
        # a pedra: o anel de dentro um tom mais claro
        out = np.where((rr < 0.62)[:, None], hx('#444644'), out)
        # o aro de bronze (dois filetes) e as marcas a cada 10 graus
        aro = (rr > R - 0.13) & (rr < R - 0.03)
        out = np.where(aro[:, None], bz, out)
        out = np.where(((rr > R - 0.13) & (rr < R - 0.13 + PH * 1.2))[:, None], bz_e, out)
        out = np.where(((rr >= R - 0.03 - PH * 1.2) & (rr < R - 0.03))[:, None], bz_c, out)
        marca = aro & (np.abs(((th / (2 * math.pi) * 36) + 0.5) % 1 - 0.5) * 2 * math.pi / 36 * rr < PH * 0.7) & (rr > R - 0.1)
        out = np.where(marca[:, None], bz_e, out)
        out = np.where(((rr >= R - 0.03) & (rr < R))[:, None], hx('#2a2a28'), out)
        out = np.where(((rr > 0.6) & (rr < 0.6 + PH * 1.2))[:, None], bz, out)
        # a estrela: para cada ponta (ângulo a, comprimento c, meia largura w), as duas metades
        for (k, c, w) in [(i, R - 0.15, 0.17) for i in range(4)] + [(i + 0.5, 0.62, 0.11) for i in range(4)]:
            a = k * math.pi / 2
            al = u * PH * math.cos(a) + v * PH * math.sin(a)
            tr = -u * PH * math.sin(a) + v * PH * math.cos(a)
            dentro = (al >= 0) & (np.abs(tr) < w * (1 - al / c))
            meia = tr > 0
            clara, escura = (bz_c, bz) if k == int(k) else (bz, bz_e)
            if k == 3:          # o norte (-y na tela é a ponta de cima): metade em vermelho esmaltado
                clara, escura = hx('#c8302a'), hx('#8e1e1a')
            out = np.where((dentro & meia)[:, None], clara, out)
            out = np.where((dentro & ~meia)[:, None], escura, out)
            # o filete da beira da ponta
            beira = dentro & (np.abs(tr) > w * (1 - al / c) - PH * 1.1)
            out = np.where(beira[:, None], bz_e if k != 3 else hx('#5e1210'), out)
        # o miolo
        out = np.where((rr < 0.07)[:, None], bz_c, out)
        out = np.where((rr < 0.035)[:, None], bz_e, out)
        return out
    o = C().novo_obj(3, contorno=False)
    C().cilindro(cx, cy, R, 0.0, PZ * 0.9, liso('#2a2a28'), M, o, lados=64, tampa_mat=emissivo(f))


# =====================================================================================================================
# o catálogo deste grupo: def -> (largura, fundo em casas, a quina da pegada, o desenho, {estado: desenho})
# =====================================================================================================================
ITENS = {
    'bar_counter': (2, 1, (0.0, 0.0), bar_counter, {}),
    'counter_wood': (2, 1, (0.0, 0.0), counter_wood, {}),
    'bar_shelf': (2, 1, (0.0, 0.0), bar_shelf, {}),
    'bar_cabinet': (1, 1, (0.0, 0.0), bar_cabinet, {'1': lambda: bar_cabinet(True)}),
    'beer_fridge': (1, 1, (0.0, 0.0), beer_fridge, {}),   # só serve à senha da passagem do bar: não abre (o Felipe, 14/10)
    'fridge_drinks': (1, 1, (0.0, 0.0), fridge_drinks, {'1': lambda: fridge_drinks(True)}),
    'minibar': (1, 1, (0.0, 0.0), minibar, {'1': lambda: minibar(True)}),
    'keg': (1, 1, (0.0, 0.0), keg, {}),
    'beer_crate': (1, 1, (0.0, 0.0), beer_crate, {}),
    'beer_glass': (1, 1, (0.0, 0.0), beer_glass, {}),
    'ashtray': (1, 1, (0.0, 0.0), ashtray, {}),
    'chair_bar': (1, 1, (0.0, 0.0), chair_bar, {}),
    'chair_stack': (1, 1, (0.0, 0.0), chair_stack, {}),
    'stool_bar': (1, 1, (0.0, 0.0), stool_bar, {}),
    'table_bar': (1, 1, (0.0, 0.0), table_bar, {}),
    'table_chess': (1, 1, (0.0, 0.0), table_chess, {}),
    'pool_table': (2, 4, (0.0, 0.0), pool_table, {}),
    'armchair_red': (1, 1, (0.0, 0.0), armchair_red, {}),
    'poltrona_preta': (1, 1, (0.0, 0.0), poltrona_preta, {}),
    'sofa_booth': (2, 1, (0.0, 0.0), sofa_booth, {}),
    'arcade': (1, 1, (0.0, 0.0), lambda: arcade(True), {'1': lambda: arcade(False)}),
    'floor_lamp': (1, 1, (0.0, 0.0), lambda: floor_lamp(True), {'1': lambda: floor_lamp(False)}),
    'compass_floor': (3, 3, (0.0, 0.0), compass_floor, {}),
}
