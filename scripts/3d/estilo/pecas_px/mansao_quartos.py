"""
GRUPO C da Mansão Albuquerque, "os quartos" (21/10): o quarto da Catarina (a cama com os dois ursos, a TV com o console de
movimento, o canto das espadas de esgrima, o painel de troféus e medalhas), a CAVERNA dela (o mezanino escuro: a mesa gamer
com os dois monitores, a parede de escalada, o pufe, a fita de LED) e a sala de jogos / treino do Miguel (a mesa de
carteado, o saco de pancada, os halteres, o tatame, as luvas de boxe com espinhos). Pixel art 1:1 só por código, no estilo
de casa.py e escritorio.py (que este módulo reaproveita: o estofado, a malha, as telas, o teclado, o gabinete).

Tudo no giro 4 (a frente para +y), a pegada começando em (0, 0), no tamanho do catálogo (a altura em METROS; a mesa de
carteado leva `aumento` 1,2 na largura e no fundo: a arte já sai com ele).

Decisões:
  - cama_catarina (3 x 3, 0,65 m = o alto do edredom): cabeceira estofada cinza-claro capitonê, base de carvalho claro,
    edredom branco com as costuras, dobra bege no alto, quatro travesseiros, três almofadas, manta de lã dobrada no pé e os
    DOIS URSOS sentados (coral e azul-turquesa), cada um com o focinho claro, o laço e as patas.
  - tv_gamer (3 x 1, 1,55 m): o móvel baixo preto, a TV de 65" com o jogo (estado 0 = ligada; '1' = desligada, o vidro preto
    com o reflexo), a barra de sensor, o console branco de pé e os dois controles de segurar com a dragona.
  - rack_esgrima (2 x 1, 1,75 m): o suporte de madeira, quatro armas (dois floretes, uma espada, um sabre; cada uma com a
    guarda e o punho diferentes), a máscara branca, a jaqueta no cabide e a bolsa no chão.
  - setup_gamer (3 x 1, 0,78 m o tampo, vao 'fundo'): 0 ligado, '1' desligado; nada embaixo do tampo (só o painel do fundo).
  - parede_escalada (3 x 1, portal): o painel de compensado com as agarras coloridas, o colchão no pé e a corda.
  - itens de parede: painel_trofeus, fita_led (0 acesa, '1' apagada; ~2 ciano, ~3 rosa), medalhas_cabide, poster_esgrima
    (e ~2), luvas_parede.
"""
import math

import numpy as np

import cozinha as CZ
import base_estilo as BE
import casa as CA
import escritorio as EO
import parede_casa as PC
from base_estilo import (hx, liso, mad2, tab2, vol, _tom, _pau, _barra, _p1_malha, _poligono_rodado, _disco, PH, PZ)
from motor import emissivo, ruido, suave, KX, KY, KZ

M = BE.M
Pl = PC.Pl
CASA = 0.75
UN = 1.633


# =====================================================================================================================
# ajudas
# =====================================================================================================================
def C():
    return CZ.c


def novo(contorno=True, sombra=True):
    return C().novo_obj(3, contorno=contorno, sombra=sombra)


def luz_obj(contorno=False):
    o = C().novo_obj(3, contorno=contorno, sombra=False)
    CZ.luzes.add(o)
    return o


def cx(b, mat, o=None, ch=0.0):
    o = novo() if o is None else o
    C().caixa(b, mat, M, o, ch=ch)
    return o


def peg(x0, x1, y0, y1):
    CZ.pegadas.append((x0, x1, y0, y1))


def peq(x0, x1, y0, y1, z):
    CZ.itens_peq.append((x0, x1, y0, y1, z))


def _hex(c):
    c = np.clip(np.round(np.asarray(c, float)), 0, 255).astype(int)
    return '#%02x%02x%02x' % tuple(c)


def rampa(cor, ks=(0.5, 0.58, 0.67, 0.76, 0.85, 0.94, 1.03, 1.12, 1.22, 1.34)):
    """Uma rampa de 10 tons de uma cor (do escuro ao claro) para o estofado."""
    c0 = hx(cor)
    return np.clip(np.stack([_tom(c0, k) for k in ks]), 0, 255)


def elip(c_, r, cor, o, corte_z=None):
    C().elipsoide(np.array(c_, float), np.array(r, float), liso(cor), o, corte_z=corte_z)


def elip_m(c_, r, mat, o, corte_z=None):
    C().elipsoide(np.array(c_, float), np.array(r, float), mat, o, corte_z=corte_z)


def prisma_pts(base, z0, z1, mat, o):
    EO.prisma(base, z0, z1, mat, o)


def octogono(cx_, cy_, r, off=math.pi / 8):
    """Os 8 cantos (anti-horário) do octógono de raio r (r = do centro ao canto)."""
    return [(cx_ + r * math.cos(off + k * math.pi / 4), cy_ + r * math.sin(off + k * math.pi / 4)) for k in range(8)]


# =====================================================================================================================
# a cena do jogo e do código nas telas (cada pixel da tela = 1 px do tabuleiro)
# =====================================================================================================================
def _cena_jogo(i, j, W, H, noite=False):
    """
    O jogo de plataforma da TV: o céu em degraus, as nuvens, os morros, o chão de tijolos, os blocos amarelos, as moedas,
    o boneco (boné vermelho, macacão azul) pulando e o bichinho roxo. noite: o mesmo cenário em roxo e rosa (o monitor).
    """
    if noite:
        ceu = ['#1a1040', '#2a1458', '#4a1c6e', '#7a2a7e']
        nuvem, morro1, morro2 = '#6a3a8a', '#1c1a4a', '#2a2260'
        chao_t, chao_b, grama = '#2a2060', '#1a1444', '#40e0d0'
        bloco, bloco_s = '#ff5ac8', '#a02a80'
    else:
        ceu = ['#5aa8f0', '#78bcf8', '#9ad0fc', '#c4e6fc']
        nuvem, morro1, morro2 = '#ffffff', '#4aa850', '#2e8a40'
        chao_t, chao_b, grama = '#b86a38', '#8a4a28', '#58c850'
        bloco, bloco_s = '#f8c830', '#b88418'
    out = np.zeros(i.shape + (3,))
    hz = H * 0.62
    cor = np.empty(i.shape, dtype=object)
    tom = np.floor(np.clip(j / max(1.0, hz), 0, 0.999) * 4).astype(int)

    def pinta(m, c):
        out[m] = hx(c)
    for k in range(4):
        pinta(tom == k, ceu[k])
    # os morros (dois degraus de verde)
    m1 = (j > hz - 5 - 4 * np.sin(i / 6.0 + 1.0)) & (j <= hz)
    pinta(m1, morro2)
    m2 = (j > hz - 3 - 3 * np.sin(i / 4.5 + 3.0)) & (j <= hz) & (i > W * 0.45)
    pinta(m2, morro1)
    # as nuvens
    for (cu, cj, rw, rh) in ((W * 0.2, H * 0.2, 6.5, 2.4), (W * 0.62, H * 0.13, 5.5, 2.0), (W * 0.86, H * 0.3, 4.5, 1.8)):
        m = ((i - cu) / rw) ** 2 + ((j - cj) / rh) ** 2 <= 1
        m |= ((i - cu - rw * 0.4) / (rw * 0.6)) ** 2 + ((j - cj + rh * 0.5) / (rh * 0.9)) ** 2 <= 1
        pinta(m, nuvem)
    # o chão: a grama, a terra de tijolos
    gj = H - 7
    pinta(j >= gj, chao_t)
    pinta((j >= gj) & (j < gj + 2), grama)
    tij = (j >= gj + 2) & ((((j - gj) // 3) % 2 == 0) & (i % 8 == 0) | (((j - gj) // 3) % 2 == 1) & (i % 8 == 4) | ((j - gj) % 3 == 0))
    pinta(tij, chao_b)
    # os blocos e as moedas
    for (bu, bj) in ((W * 0.58, H * 0.42), (W * 0.58 + 5, H * 0.42), (W * 0.58 + 10, H * 0.42)):
        bu, bj = int(bu), int(bj)
        m = (i >= bu) & (i < bu + 5) & (j >= bj) & (j < bj + 5)
        pinta(m, bloco)
        pinta(m & ((i == bu + 4) | (j == bj + 4)), bloco_s)
        pinta(m & ((i == bu) | (j == bj)) & ~((i == bu + 4) | (j == bj + 4)), '#fff0a0')
    for (mu, mj) in ((W * 0.62, H * 0.3), (W * 0.74, H * 0.2), (W * 0.31, H * 0.34)):
        m = ((i - mu) / 1.4) ** 2 + ((j - mj) / 2.0) <= 1
        m = ((i - mu) / 1.5) ** 2 + ((j - mj) / 2.2) ** 2 <= 1
        pinta(m, '#ffd820')
        pinta(m & (i < mu), '#fff2a0')
    # o bichinho roxo andando no chão
    eu, ej = int(W * 0.78), gj - 4
    m = ((i - eu - 2) / 3.2) ** 2 + ((j - ej - 1.5) / 2.6) ** 2 <= 1
    pinta(m, '#a040d0')
    pinta((i >= eu) & (i <= eu + 1) & (j >= ej) & (j <= ej + 1), '#ffffff')
    pinta((i >= eu + 3) & (i <= eu + 4) & (j >= ej) & (j <= ej + 1), '#ffffff')
    pinta((i >= eu - 1) & (i <= eu + 5) & (j == ej + 4), '#401060')
    # o boneco pulando: cabelo ruivo, rosto, camisa verde, calça marrom, botas
    hu, hj = int(W * 0.34), int(H * 0.5)
    pinta((i >= hu + 1) & (i <= hu + 5) & (j == hj), '#e8602a')
    pinta((i >= hu) & (i <= hu + 6) & (j >= hj + 1) & (j <= hj + 2), '#e8602a')
    pinta((i >= hu + 2) & (i <= hu + 5) & (j >= hj + 2) & (j <= hj + 3), '#f8c898')
    pinta((i == hu + 4) & (j == hj + 3), '#202020')
    pinta((i >= hu + 1) & (i <= hu + 5) & (j >= hj + 4) & (j <= hj + 5), '#30b058')
    pinta((i >= hu + 1) & (i <= hu + 5) & (j >= hj + 6) & (j <= hj + 8), '#7a4a28')
    pinta((i >= hu + 6) & (i <= hu + 8) & (j >= hj + 3) & (j <= hj + 4), '#f8c898')
    pinta((i >= hu + 7) & (i <= hu + 8) & (j >= hj + 1) & (j <= hj + 2), '#d8e0e8')
    pinta((i >= hu - 1) & (i <= hu) & (j >= hj + 4) & (j <= hj + 5), '#f8c898')
    pinta((i >= hu - 1) & (i <= hu + 2) & (j == hj + 9), '#3a2418')
    pinta((i >= hu + 4) & (i <= hu + 7) & (j == hj + 8), '#3a2418')
    # o placar: faixa em cima, quatro blocos brancos e os corações
    pinta((j >= 1) & (j <= 2) & (i >= 2) & (i < 2 + 12), '#ffffff')
    pinta((j >= 1) & (j <= 2) & (i >= W - 14) & (i < W - 11), '#e83030')
    pinta((j >= 1) & (j <= 2) & (i >= W - 9) & (i < W - 6), '#e83030')
    pinta((j >= 1) & (j <= 2) & (i >= W - 4) & (i < W - 1), '#e83030')
    return out


def _cena_codigo(i, j, W, H):
    """O editor de código escuro: a margem com os números, as linhas coloridas recuadas em blocos, o cursor."""
    out = np.tile(hx('#161a2c'), i.shape + (1,))
    out[(j < 3)] = hx('#242a44')
    out[(i < 6)] = hx('#1e2238')
    # a margem: um tracinho claro por linha
    lin = (j >= 5) & ((j - 5) % 3 == 0)
    out[lin & (i >= 2) & (i < 4)] = hx('#5a6290')
    cores = ['#f06ab4', '#58d8e8', '#f0d060', '#e8ecf8', '#80e090', '#b08af0']
    for ln in range(int((H - 6) / 3)):
        jj = 5 + ln * 3
        if jj >= H - 2:
            break
        ind = int(ruido(ln, 4.4) * 3) * 4
        u = 8 + ind
        k = 0
        while u < W - 3:
            ancho = 3 + int(ruido(ln, k, 9.1) * 12)
            c = cores[int(ruido(ln, k, 2.2) * len(cores)) % len(cores)]
            if ruido(ln, 7.7) > 0.88 and k == 0:
                break
            m = (j == jj) & (i >= u) & (i < min(W - 3, u + ancho))
            out[m] = hx(c)
            u += ancho + 2
            k += 1
            if k > 4:
                break
    # a linha atual: um fundo mais claro e o cursor
    cj = 5 + 3 * 5
    out[(j >= cj - 1) & (j <= cj + 1) & (i >= 6)] = hx('#242c4c')
    out[(j == cj) & (i >= 8) & (i < 8 + 9)] = hx('#e8ecf8')
    out[(j >= cj - 1) & (j <= cj + 1) & (i == 19)] = hx('#ffffff')
    return out


def tela_cena(a0, a1, z0, z1, cena, ligada=True, **kw):
    """O material da tela pixel a pixel (a face +y): acesa, a cena; apagada, o vidro escuro com o reflexo."""
    W = max(1, int(round((a1 - a0) / PH)))
    H = max(1, int(round((z1 - z0) / PZ)))
    n_ref = (0.0, 1.0, 0.0)
    apagada = EO.tela_mat(n_ref, a0, a1, z0, z1, 'azul', False)

    def f(L, n, P):
        if not ligada:
            return apagada(L, n, P)
        i = np.clip(np.floor((P[:, 0] - a0) / PH), 0, W - 1)
        j = np.clip(np.floor((z1 - P[:, 2]) / PZ), 0, H - 1)
        out = cena(i, j, W, H, **kw)
        # o brilho do vidro na quina de cima à esquerda
        out = np.where(((i + j) < 2)[:, None], _tom(out, 1.15), out)
        return out
    return emissivo(f)


# =====================================================================================================================
# os ursos de pelúcia
# =====================================================================================================================
def urso(x, y, z, cor, claro, laco, k=1.0, vira=0.0):
    """
    O urso sentado (0,36 m com k = 1): o corpo, a cabeça com as orelhas e o focinho claro, os braços, as pernas com a sola
    clara e o laço no pescoço. Elipsoides, cada parte do seu objeto (o contorno fraco separa a cabeça do corpo e os braços).
    """
    r = lambda a, b, c_: (a * k, b * k, c_ * k)
    # o corpo e a barriga
    o = novo()
    elip((x, y, z + 0.125 * k), r(0.125, 0.11, 0.14), cor, o, corte_z=z)
    elip((x, y + 0.075 * k, z + 0.115 * k), r(0.076, 0.04, 0.1), claro, o, corte_z=z)
    # as pernas (esticadas para a frente) e as solas
    for s in (-1, 1):
        o = novo()
        elip((x + s * 0.082 * k, y + 0.1 * k, z + 0.055 * k), r(0.06, 0.09, 0.055), cor, o, corte_z=z)
        elip((x + s * 0.082 * k, y + 0.175 * k, z + 0.06 * k), r(0.04, 0.025, 0.042), claro, o)
    # os braços, caídos dos lados e um pouco para a frente
    for s in (-1, 1):
        o = novo()
        elip((x + s * 0.14 * k, y + 0.045 * k, z + 0.175 * k), r(0.046, 0.05, 0.085), cor, o)
    # o laço no pescoço
    ol = novo()
    for s in (-1, 1):
        elip((x + s * 0.046 * k, y + 0.072 * k, z + 0.2 * k), r(0.04, 0.02, 0.026), laco, ol)
    elip((x, y + 0.082 * k, z + 0.2 * k), r(0.017, 0.015, 0.019), _hex(_tom(hx(laco), 0.78)), ol)
    # a cabeça: orelhas, focinho
    oh = novo()
    hz = z + 0.32 * k
    elip((x, y + 0.015 * k, hz), r(0.105, 0.095, 0.092), cor, oh)
    for s in (-1, 1):
        elip((x + s * 0.078 * k, y - 0.005 * k, hz + 0.08 * k), r(0.04, 0.03, 0.04), cor, oh)
    elip((x, y + 0.088 * k, hz - 0.024 * k), r(0.06, 0.05, 0.046), claro, oh)
    # as orelhas por dentro e o rosto
    of = novo(contorno=False)
    for s in (-1, 1):
        elip((x + s * 0.078 * k, y + 0.026 * k, hz + 0.08 * k), r(0.024, 0.012, 0.024), claro, of)
    elip((x, y + 0.133 * k, hz - 0.004 * k), r(0.024, 0.015, 0.018), '#261418', of)
    for s in (-1, 1):
        elip((x + s * 0.04 * k, y + 0.093 * k, hz + 0.034 * k), r(0.018, 0.013, 0.021), '#241216', of)


# =====================================================================================================================
# a cama da Catarina (3 x 3, 0,65 m)
# =====================================================================================================================
OAK, OAK_T = '#c8a36e', ['#d2ae78', '#ccaa74', '#d8b480']
OAK_E = '#8e6a3c'


def edredom(cor, passo=0.3, org=0.12, costura=True):
    """O edredom: o branco-creme com as costuras de canal (1 px escuro e 1 px claro) e as dobras suaves."""
    c0 = hx(cor)

    def f(L, n, P):
        out = np.tile(c0, (len(P), 1))
        if n[2] > 0.5:
            s = suave(np.floor(P[:, 0] / PH) * PH, np.floor(P[:, 1] / PH) * PH, 0.14, 5)
            out = np.where((s > 0.66)[:, None], _tom(c0, 0.95), out)
            out = np.where((s < 0.26)[:, None], _tom(c0, 1.03), out)
            if costura:
                g = (P[:, 0] - org) % passo
                out = np.where((g < PH)[:, None], _tom(c0, 0.8), out)
                out = np.where(((g >= PH) & (g < 2 * PH))[:, None], _tom(c0, 1.04), out)
        else:
            a = P[:, 0] if abs(n[1]) >= abs(n[0]) else P[:, 1]
            g = (a + 0.05 * ruido(np.floor(a / 0.2), 3.3)) % 0.21
            out = np.where((g < PH)[:, None], _tom(c0, 0.9), out)
            out = np.where(((g >= PH) & (g < 2 * PH))[:, None], _tom(c0, 1.04), out)
        return out
    return emissivo(f)


def manta_la(c1, c2, passo=0.1):
    """A manta de lã dobrada: o tricô em riscas de través (duas cores) e o ponto miúdo em degraus."""
    a, b = hx(c1), hx(c2)

    def f(L, n, P):
        faixa = np.floor(P[:, 1] / passo) % 3 == 0
        out = np.where(faixa[:, None], b, a)
        ponto = (np.floor(P[:, 0] / PH) + np.floor(P[:, 1] / PH)) % 4 == 0
        out = np.where((ponto & (n[2] > 0.5))[:, None], _tom(out, 0.93), out)
        # a ponta da manta: franjinha escura de 1 px na quina do pé
        return out
    return emissivo(f)


def _cama_catarina():
    x0, x1 = 0.02, 2.23
    y0, y1 = 0.0, 2.25
    zt = 0.65
    # a base de carvalho claro com o pé recuado (a sombra embaixo)
    cx((x0 + 0.1, x1 - 0.1, y0 + 0.1, y1 - 0.08, 0.0, 0.08), liso('#3a3028'))
    cx((x0, x1, y0 + 0.02, y1, 0.08, 0.34), {'*': mad2(OAK, eixo=0, seed=51, passo=0.05), 'cima': liso('#a88458'),
                                             'frente': tab2(OAK_T, 0.12, '#7a5a30', eixo=0, seed=52)}, ch=0.012)
    # o colchão e o lençol
    _p1_malha((x0 + 0.04, x1 - 0.04, y0 + 0.12, y1 - 0.04, 0.34, 0.52), (0.05, 0.05, 0.02, 0.05), CA.lencol('#f4f0e8'), seg=2)
    # o edredom: do meio até o pé, caindo dos lados e do pé
    ys = 0.74
    _p1_malha((x0 - 0.01, x1 + 0.01, ys, y1 + 0.03, 0.27, zt), (0.06, 0.06, 0.02, 0.07), edredom('#efe9de'), seg=2)
    # a dobra do lençol bege em cima do edredom (a faixa de baixo do travesseiro até o alto)
    _p1_malha((x0 - 0.0, x1 + 0.0, ys - 0.03, ys + 0.3, zt - 0.06, zt + 0.03), (0.04, 0.05, 0.02, 0.05), CA.lencol('#d4c4a6'), seg=2)
    # a cabeceira: a tábua de madeira e o estofado capitonê cinza-claro por cima
    cx((x0, x1, y0, y0 + 0.05, 0.0, 1.34), {'*': mad2(OAK, eixo=1, seed=53, passo=0.05), 'costas': tab2(OAK_T, 0.2, '#7a5a30', eixo=1, seed=54), 'cima': liso('#a88458')})
    for xx in (x0, x1 - 0.06):
        cx((xx, xx + 0.06, y0, y0 + 0.12, 0.0, 0.5), {'*': mad2(OAK, eixo=1, seed=55, passo=0.05), 'cima': liso('#a88458')})
    b = (x0 + 0.06, x1 - 0.06, y0 + 0.05, y0 + 0.16, 0.3, 1.3)
    _p1_malha(b, (0.05, 0.03, 0.04, 0.1), EO.estofado(rampa('#b7b3ac'), b, 2.4, 6.8, cupula=0.4, grad=0.3, capi=(0.19, 0.17)), seg=2)
    # os travesseiros de trás: cinza, branco, branco, cinza
    pil = ((0.06, 0.56, '#b4b0a8'), (0.6, 1.1, '#f4f0e8'), (1.14, 1.64, '#f4f0e8'), (1.68, 2.18, '#b4b0a8'))
    for k, (a0, a1, cor) in enumerate(pil):
        _p1_malha((a0, a1, y0 + 0.17, y0 + 0.56, 0.5, 0.78), (0.11, 0.1, 0.06, 0.15), CA.lencol(cor), seg=3, inclina=0.0)
    # as almofadas da frente: bege, branca listrada, cinza
    alm = ((0.1, 0.44, '#cdb99a', 0.6, 0.0), (0.9, 1.3, '#e6e1d6', 0.58, 0.0), (1.8, 2.14, '#9a9690', 0.6, 0.0))
    for (a0, a1, cor, zb, _) in alm:
        _p1_malha((a0, a1, y0 + 0.6, y0 + 0.9, zb, zb + 0.2), (0.09, 0.09, 0.04, 0.1), CA.lencol(cor), seg=3)
    # a manta de lã dobrada no pé
    _p1_malha((x0 + 0.04, x1 - 0.04, y1 - 0.58, y1 - 0.14, zt - 0.05, zt + 0.1), (0.04, 0.05, 0.03, 0.05), manta_la('#bfb4a2', '#8e8678'), seg=2)
    # os dois ursos (o coral e o azul-turquesa) sentados na frente dos travesseiros
    urso(0.66, 1.0, zt - 0.03, '#f58a66', '#fcd8b8', '#fff4e6', k=1.5)
    urso(1.56, 1.12, zt - 0.03, '#38c0c0', '#c4f4f0', '#fff4e6', k=1.4)
    peg(x0, x1, y0, y1)


# =====================================================================================================================
# a TV gamer (3 x 1, 1,55 m)
# =====================================================================================================================
PRETO_M = '#1c1b20'


def _controle(x, y, z, ang=0.0, cor='#f4f4f2'):
    """O controle de segurar (0,04 x 0,15 m): o corpo branco, o botão azul, a base cinza e a dragona."""
    o = novo()
    pts = EO.ret_girado(x, y, ang, 0.021, 0.075)

    def m(L, n, P):
        if n[2] > 0.5:
            u = -(P[:, 0] - x) * math.sin(ang) + (P[:, 1] - y) * math.cos(ang)
            out = np.tile(hx(cor), (len(P), 1))
            out = np.where((np.abs(u + 0.03) < 0.012)[:, None], hx('#4a9ae8'), out)
            out = np.where((np.abs(u - 0.0) < 0.007)[:, None], hx('#c8ccd0'), out)
            out = np.where((u > 0.05)[:, None], hx('#2a2a30'), out)
            return out
        return np.tile(_tom(hx(cor), 0.92), (len(P), 1))
    EO.prisma(pts, z, z + 0.026, emissivo(m), o)
    CZ.itens_peq.append((x - 0.025, x + 0.025, y - 0.08, y + 0.08, z))


def _console_branco(x, y, z):
    """O console de movimento (0,045 x 0,2 x 0,16 m), em pé: branco, a fenda do disco e o led azul."""
    o = novo()

    def lado(L, n, P):
        out = np.tile(hx('#f4f4f2'), (len(P), 1))
        return out
    cx((x - 0.024, x + 0.024, y - 0.1, y + 0.1, z, z + 0.16), {'*': liso('#f2f2ee'), 'cima': liso('#fcfcf8'),
                                                             'dir': liso('#dcdcd6')}, o)
    # a frente (o lado +y): a fenda do disco e o botão
    placa = EO.placa
    placa('+y', y + 0.1005, x - 0.017, x + 0.017, z + 0.07, z + 0.07 + 2 * PZ, liso('#8a8e96'))
    placa('+y', y + 0.1005, x - 0.006, x + 0.006, z + 0.12, z + 0.12 + 2 * PZ, liso('#3a9af0'), acesa=True)
    # o pezinho cinza (a base) e o led azul do lado
    cx((x - 0.03, x + 0.03, y - 0.1, y + 0.1, z, z + 0.01), liso('#b8bcc4'))
    peq(x - 0.03, x + 0.03, y - 0.1, y + 0.1, z)


def _tv_gamer(ligada):
    def d():
        W = 2.25
        # o móvel baixo preto: os pezinhos, o corpo, o tampo e as três bocas
        for xx in (0.1, W - 0.16):
            for yy in (0.16, 0.5):
                cx((xx, xx + 0.06, yy, yy + 0.06, 0.0, 0.12), {'*': liso('#16151a'), 'cima': liso('#2a2930')})
        corpo = ('#25242b', '#17161b')
        x0, x1, y0, y1 = 0.03, W - 0.03, 0.12, 0.62
        F = EO.frente_metal('#26252c', [(x0 + 0.04, x0 + 0.72, 0.16, 0.46), (x0 + 0.78, x1 - 0.78, 0.16, 0.46), (x1 - 0.72, x1 - 0.04, 0.16, 0.46)],
                            b=(0, 0, 0, 0, 0.12, 0.5), etiqueta=False)
        cx((x0, x1, y0, y1, 0.12, 0.5), {'frente': F, '*': EO.metal('#1e1d23', (0, 0, 0, 0, 0.12, 0.5), topo='#2e2d35')})
        cx((x0 - 0.01, x1 + 0.01, y0 - 0.01, y1 + 0.02, 0.5, 0.54), EO.metal('#2a2930', (0, 0, 0, 0, 0.5, 0.54), topo='#3c3b44', quina=1.5))
        # os puxadores (botõezinhos de latão escuro)
        for xm in (x0 + 0.38, W / 2, x1 - 0.38):
            cx((xm - 0.02, xm + 0.02, y1, y1 + 0.012, 0.42, 0.44), liso('#8a7440'))
        # a TV: o pé em V, o painel, a moldura, as costas
        tx0, tx1 = 0.375, 1.875
        tz0, tz1 = 0.7, 1.55
        XC = (tx0 + tx1) / 2
        cx((XC - 0.2, XC + 0.2, 0.3, 0.45, 0.54, 0.56), EO.metal('#18171c', topo='#2c2b32'))
        cx((XC - 0.04, XC + 0.04, 0.34, 0.4, 0.56, 0.7), EO.metal('#18171c', topo='#2c2b32'))
        cx((tx0 + 0.3, tx1 - 0.3, 0.26, 0.32, tz0 + 0.1, tz1 - 0.12), EO.metal('#1c1b20', topo='#2e2d35'))
        MOL = EO.metal('#141318', (0, 0, 0, 0, tz0, tz1), topo='#34333c', quina=1.7)
        cx((tx0, tx1, 0.32, 0.37, tz0, tz1), MOL)
        mm = 0.016
        EO.placa('+y', 0.371, tx0 + mm, tx1 - mm, tz0 + mm, tz1 - mm, tela_cena(tx0 + mm, tx1 - mm, tz0 + mm, tz1 - mm, _cena_jogo, ligada), acesa=ligada)
        # o ledzinho do canto
        EO.placa('+y', 0.372, tx1 - 0.05, tx1 - 0.05 + PH, tz0 + 0.004, tz0 + 0.004 + PZ, liso('#e8f0f8' if ligada else '#e04020'), acesa=True)
        # a barra de sensor na frente do pé
        cx((XC - 0.17, XC + 0.17, 0.46, 0.5, 0.54, 0.565), EO.metal('#101014', topo='#2a2a30'))
        # o console branco (à direita da TV) e os dois controles (à esquerda)
        _console_branco(2.02, 0.36, 0.54)
        _controle(0.14, 0.34, 0.54, ang=0.1)
        _controle(0.25, 0.4, 0.54, ang=-0.12)
        peg(x0, x1, y0, y1)
    return d


# =====================================================================================================================
# o canto das espadas (2 x 1, 1,75 m)
# =====================================================================================================================
MAD_R = '#b08a56'          # o carvalho do suporte
MAD_R_E = '#7a5c36'


def _arma(x, y, zg, tipo):
    """
    Uma arma de esgrima em pé (a guarda em zg, a lâmina para cima, o punho para baixo): o florete (guarda de concha
    pequena, punho preto), a espada (concha grande, punho vermelho com fita), o sabre (guarda de copo, couro e fio de latão).
    """
    top = zg + (0.86 if tipo != 'sabre' else 0.8)
    ol = novo(contorno=False)
    larg = 0.017 if tipo != 'espada' else 0.021
    cx((x - larg, x + larg, y - 0.011, y + 0.011, zg, top), {'frente': liso('#eef2f8'), 'dir': liso('#98a0ac'), 'cima': liso('#ffffff'), '*': liso('#c4ccd8')}, ol)
    # o botão da ponta
    elip((x, y, top + 0.004), (0.014, 0.014, 0.014), '#d8dee8', ol)
    # a guarda e o punho
    o = novo()
    if tipo == 'florete':
        _poligono_rodado(x, y, [(zg - 0.045, 0.058), (zg - 0.035, 0.062), (zg - 0.01, 0.05), (zg + 0.006, 0.022), (zg + 0.012, 0.012)],
                         vol(x, y, '#b0b6c0', brilho=0.7), o, lados=12)
        cx((x - 0.017, x + 0.017, y - 0.022, y + 0.026, zg - 0.215, zg - 0.045), {'*': liso('#1c1c22'), 'cima': liso('#34343c'), 'dir': liso('#101014')}, novo())
        cx((x - 0.014, x + 0.014, y + 0.026, y + 0.034, zg - 0.19, zg - 0.1), liso('#1c1c22'), novo())
        pom = '#7a7e88'
    elif tipo == 'espada':
        _poligono_rodado(x, y, [(zg - 0.07, 0.08), (zg - 0.055, 0.085), (zg - 0.015, 0.068), (zg + 0.006, 0.03), (zg + 0.012, 0.014)],
                         vol(x, y, '#c4a050', brilho=0.7), o, lados=14)
        C().cilindro(x, y, 0.021, zg - 0.23, zg - 0.07, vol(x, y, '#c83a30', faixas=lambda P, b: np.where((np.floor((P[:, 2] - zg) / (3 * PZ)) % 3 == 0)[:, None], hx('#f2e6d0'), b)),
                     M, novo(), lados=10, tampa=False)
        pom = '#c4a050'
    else:
        # o sabre: a guarda de copo com a alça que sobe até o punho, o couro com o fio de latão
        cx((x - 0.04, x + 0.04, y - 0.02, y + 0.02, zg - 0.04, zg), EO.metal('#b8bec8', topo='#e8ecf2'), o)
        cx((x + 0.03, x + 0.052, y - 0.012, y + 0.012, zg - 0.24, zg - 0.01), EO.metal('#b8bec8', topo='#e8ecf2'), novo())
        cx((x - 0.018, x + 0.018, y - 0.018, y + 0.018, zg - 0.215, zg - 0.04),
           {'*': liso('#4a2a18'), 'frente': liso('#5a3420'), 'cima': liso('#6a4228')}, novo())
        for kk in range(4):
            zz = zg - 0.2 + kk * 0.04
            cx((x - 0.02, x + 0.02, y - 0.02, y + 0.02, zz, zz + PZ), liso('#e0c060'), novo(contorno=False))
        pom = '#e0c060'
    elip((x, y, zg - (0.225 if tipo != 'espada' else 0.24)), (0.024, 0.024, 0.024), pom, novo())


def _mascara_esgrima(x, y, z):
    """A máscara branca pendurada (0,32 m): a calota, a tela de aço escura na frente com as barras claras, o aro, o babador e o pino."""
    o = novo()
    elip((x, y, z + 0.17), (0.115, 0.125, 0.15), '#f6f6f2', o, corte_z=z + 0.03)
    # o aro de couro escuro em volta da tela e a tela de aço (barras de 1 px claras sobre o escuro)
    def tela_(L, n, P):
        out = np.tile(hx('#2e323a'), (len(P), 1))
        barra = (np.floor(P[:, 2] / (2 * PZ)) % 2 == 0)
        out = np.where(barra[:, None], hx('#a8aeba'), out)
        return out
    elip_m((x, y + 0.06, z + 0.17), (0.094, 0.075, 0.115), emissivo(tela_), novo())
    ob = novo(contorno=False)
    elip((x, y + 0.045, z + 0.275), (0.098, 0.05, 0.016), '#2a2a30', ob)
    # o babador (o pano de baixo)
    cx((x - 0.1, x + 0.1, y - 0.06, y + 0.075, z - 0.05, z + 0.04), {'*': liso('#e8e8e4'), 'cima': liso('#fafaf6'), 'frente': liso('#d4d4d0')}, ch=0.012)
    cx((x - 0.012, x + 0.012, y - 0.13, y - 0.1, z + 0.17, z + 0.3), liso('#2a2a30'), novo())


def _jaqueta_esgrima(xc, y, zt):
    """A jaqueta branca no cabide (0,6 m): o cabide, o corpo acolchoado com a gola cinza, o zíper, as mangas, a tira entre as pernas."""
    cx((xc - 0.19, xc + 0.19, y - 0.012, y + 0.012, zt - 0.03, zt), {'*': mad2(MAD_R_E, seed=61), 'cima': liso('#c8a468')}, novo())
    cx((xc - 0.008, xc + 0.008, y - 0.008, y + 0.008, zt, zt + 0.07), liso('#3a3a42'), novo())

    def pano(L, n, P):
        out = np.tile(hx('#eceef0'), (len(P), 1))
        if abs(n[1]) > 0.5:
            zip_ = (np.abs(P[:, 0] - xc) < PH * 0.6)
            out = np.where(zip_[:, None], hx('#6a707c'), out)
            lin = (np.floor(P[:, 2] / (5 * PZ)) % 2 == 0) & ~zip_
            out = np.where(lin[:, None], hx('#d4d8de'), out)
            gola = (P[:, 2] > zt - 0.1)
            out = np.where(gola[:, None], hx('#a8aeb8'), out)
            peito = (np.abs(P[:, 0] - (xc - 0.09)) < 0.03) & (np.abs(P[:, 2] - (zt - 0.22)) < 0.025)
            out = np.where(peito[:, None], hx('#2a56c8'), out)
        return out
    _p1_malha((xc - 0.13, xc + 0.13, y - 0.05, y + 0.05, zt - 0.62, zt - 0.06), (0.06, 0.04, 0.05, 0.1), emissivo(pano), seg=2)
    for s in (-1, 1):
        _p1_malha((xc + s * 0.17 - 0.04, xc + s * 0.17 + 0.04, y - 0.045, y + 0.045, zt - 0.52, zt - 0.06), (0.045, 0.04, 0.04, 0.07),
                  emissivo(lambda L, n, P: np.where((P[:, 2] < zt - 0.46)[:, None], hx('#a8aeb8'), np.tile(hx('#dfe2e6'), (len(P), 1)))), seg=2)
    cx((xc - 0.02, xc + 0.02, y - 0.01, y + 0.07, zt - 0.7, zt - 0.58), liso('#d8dade'), novo())


def _bolsa_esporte(x0, x1, y0, y1):
    """A bolsa esportiva no chão (0,3 m): o corpo azul-marinho arredondado, a faixa vermelha, o zíper e as alças."""
    def lona(L, n, P):
        out = np.tile(hx('#2c3a5c'), (len(P), 1))
        a = P[:, 0]
        out = np.where(((a < x0 + 0.1) | (a > x1 - 0.1))[:, None], hx('#c83a34'), out)
        if n[2] > 0.5:
            out = np.where((np.abs(P[:, 1] - (y0 + y1) / 2) < PH * 0.7)[:, None], hx('#c8ccd4'), out)
            out = np.where((np.floor(P[:, 0] / (2 * PH)) % 2 == 0)[:, None] & (np.abs(P[:, 1] - (y0 + y1) / 2) < PH * 0.7)[:, None], hx('#7a808c'), out)
        else:
            out = np.where((np.abs(P[:, 2] - 0.1) < PZ)[:, None], _tom(hx('#2c3a5c'), 0.78), out)
        return out
    _p1_malha((x0, x1, y0, y1, 0.0, 0.25), (0.09, 0.07, 0.02, 0.09), emissivo(lona), seg=3)
    xm, ym = (x0 + x1) / 2, (y0 + y1) / 2
    for dx in (-0.1, 0.1):
        BE._fita([(-0.0, 0.24), (0.02, 0.29), (0.06, 0.32), (0.1, 0.29), (0.12, 0.24)] if dx < 0 else
                 [(-0.12, 0.24), (-0.1, 0.29), (-0.06, 0.32), (-0.02, 0.29), (0.0, 0.24)], xm + dx * 0.6, ym, liso('#161a28'), novo(), 0.022)
    peq(x0, x1, y0, y1, 0.0)


def _rack_esgrima():
    x0, x1 = 0.04, 1.46
    # os pés (barras no chão) e os dois montantes com a bola no alto
    for xa in (x0 + 0.0, x1 - 0.14):
        cx((xa, xa + 0.14, 0.08, 0.5, 0.0, 0.07), {'*': mad2(MAD_R, eixo=1, seed=62, passo=0.05), 'cima': liso('#c8a468')}, ch=0.01)
        cx((xa + 0.03, xa + 0.11, 0.16, 0.32, 0.07, 1.68), {'*': mad2(MAD_R, eixo=1, seed=63, passo=0.04), 'cima': liso('#c8a468')}, ch=0.012)
        o = novo()
        _poligono_rodado(xa + 0.07, 0.24, [(1.68, 0.04), (1.7, 0.056), (1.74, 0.05), (1.77, 0.02)], vol(xa + 0.07, 0.24, '#a07a46', brilho=0.2), o, lados=12)
    # o painel de fundo (tábuas escuras) entre os montantes, as travessas
    cx((x0 + 0.1, x1 - 0.1, 0.2, 0.235, 0.14, 1.62), {'*': mad2('#6a4a2a', eixo=1, seed=64, passo=0.05),
                                                       'frente': tab2(['#7a5632', '#765230', '#80583a'], 0.14, '#3a2414', eixo=1, seed=65)})
    cx((x0 + 0.03, x1 - 0.03, 0.17, 0.3, 1.62, 1.7), _pau('#8a6a3c', '#c8a468', quina=1.2, b=(0, 0, 0, 0, 0, 1.7)), ch=0.01)
    cx((x0 + 0.1, x1 - 0.1, 0.18, 0.31, 0.34, 0.41), _pau('#8a6a3c', '#c8a468', quina=1.2, b=(0, 0, 0, 0, 0, 0.41)))
    cx((x0 + 0.1, x1 - 0.1, 0.18, 0.29, 1.28, 1.34), _pau('#8a6a3c', '#c8a468', quina=1.2, b=(0, 0, 0, 0, 0, 1.34)))
    # as quatro armas, com a guarda em 0,66 m e os grampinhos nas duas travessas
    for (x, tipo) in ((0.24, 'florete'), (0.36, 'espada'), (0.48, 'florete'), (0.6, 'sabre')):
        _arma(x, 0.34, 0.66, tipo)
        for zz in (0.34, 1.26):
            cx((x - 0.03, x + 0.03, 0.29, 0.31, zz, zz + 0.07), liso('#4a3420'), novo(contorno=False))
    # a máscara na parede (num pino), a jaqueta no cabide
    cx((0.8 - 0.012, 0.8 + 0.012, 0.235, 0.33, 1.44, 1.47), liso('#3a3a42'), novo())
    cx((0.8 - 0.006, 0.8 + 0.006, 0.3, 0.33, 1.36, 1.45), liso('#2a2a30'), novo(contorno=False))
    _mascara_esgrima(0.8, 0.3, 1.1)
    _jaqueta_esgrima(1.13, 0.31, 1.58)
    _bolsa_esporte(0.14, 0.86, 0.42, 0.7)
    peg(x0, x1, 0.08, 0.7)


# =====================================================================================================================
# a mesa gamer da caverna (3 x 1, 0,78 m)
# =====================================================================================================================
RGB = ['#a050ff', '#7a68ff', '#4a98ff', '#40e0f0', '#e050d0']


def _teclado_rgb(x0, x1, y0, y1, z, ligado):
    """O teclado gamer: a caixa preta, as teclas escuras em fileiras e a luz que vaza entre elas, roxa de um lado e ciano do outro."""
    def tec(L, n, P):
        if n[2] < 0.5:
            return np.tile(hx('#17161b'), (len(P), 1))
        i = np.floor((P[:, 0] - x0) / PH)
        j = np.floor((P[:, 1] - y0) / PH)
        W, D = (x1 - x0) / PH, (y1 - y0) / PH
        t = np.clip(i / max(1, W - 1), 0, 0.999)
        k = (t * (len(RGB) - 1))
        c0 = np.stack([hx(c) for c in RGB])
        a = np.floor(k).astype(int)
        f = (k - a)[:, None]
        luz_ = c0[a] * (1 - f) + c0[np.minimum(a + 1, len(RGB) - 1)] * f
        out = luz_ if ligado else np.tile(hx('#121116'), (len(P), 1))
        tecla = (i % 3 != 2) & (j % 3 != 2) & (i > 0) & (i < W - 1) & (j > 0) & (j < D - 1)
        base = hx('#2a2930')
        topo = hx('#3a3942')
        out = np.where(tecla[:, None], base, out)
        out = np.where((tecla & (j % 3 == 0))[:, None], topo, out)
        if ligado:
            out = np.where((tecla & (j % 3 == 0) & (i % 6 == 0))[:, None], _tom(luz_, 0.9), out)
        return out
    o = novo()
    cx((x0, x1, y0, y1, z, z + 0.022), emissivo(tec), o)
    if ligado:
        CZ.luzes.add(o)
    peq(x0, x1, y0, y1, z)


def _tapete_mouse(x0, x1, y0, y1, z, ligado):
    """O mousepad grande (0,6 x 0,34 m): o tecido escuro com a costura roxa na borda e as ondas claras do meio."""
    def f(L, n, P):
        i = np.floor((P[:, 0] - x0) / PH)
        j = np.floor((P[:, 1] - y0) / PH)
        W, D = (x1 - x0) / PH, (y1 - y0) / PH
        bd = np.minimum(np.minimum(i, W - 1 - i), np.minimum(j, D - 1 - j))
        out = np.tile(hx('#1c1c24'), (len(P), 1))
        out = np.where((bd == 1)[:, None], hx('#a050ff') if ligado else hx('#3a3446'), out)
        out = np.where((bd == 0)[:, None], hx('#101016'), out)
        onda = ((i + 2 * np.sin(j / 3.0)) % 14 < 1) & (bd > 4)
        out = np.where(onda[:, None], hx('#2c2c3a'), out)
        return out
    cx((x0, x1, y0, y1, z, z + PZ), emissivo(f), novo(contorno=False, sombra=False))


def _monitor_g(x, y, z, larg, alto, cena, ligado, pe=0.1, notas=(), **kw):
    """O monitor gamer (a tela pixel a pixel, a base em V, as costas com o anel de luz) e os post-its colados na moldura."""
    cx((x - 0.14, x + 0.14, y - 0.1, y + 0.08, z, z + 0.016), EO.metal('#1e1d22', (0, 0, 0, 0, z, z + 0.016), topo='#34333a'))
    cx((x - 0.03, x + 0.03, y - 0.06, y - 0.02, z + 0.016, z + pe + 0.08), EO.metal('#1a191e', topo='#34333a'))
    z0, z1 = z + pe, z + pe + alto
    cx((x - larg / 2, x + larg / 2, y, y + 0.028, z0, z1), EO.metal('#16151a', (0, 0, 0, 0, z0, z1), topo='#3a3940', quina=1.6))
    cx((x - larg / 2 + 0.07, x + larg / 2 - 0.07, y - 0.05, y, z0 + 0.05, z1 - 0.05), EO.metal('#202026', (0, 0, 0, 0, z0 + 0.05, z1 - 0.05), topo='#38373e'))
    m = 0.012
    EO.placa('+y', y + 0.029, x - larg / 2 + m, x + larg / 2 - m, z0 + m, z1 - m * 0.8,
             tela_cena(x - larg / 2 + m, x + larg / 2 - m, z0 + m, z1 - m * 0.8, cena, ligado, **kw), acesa=ligado)
    # o anel de luz atrás (roxo) e o ledzinho da frente
    zc = (z0 + z1) / 2
    EO.placa('-y', y - 0.0505, x - 0.05, x + 0.05, zc - 0.04, zc + 0.04, liso('#a050ff' if ligado else '#2a2830'), acesa=ligado)
    EO.placa('-y', y - 0.0515, x - 0.03, x + 0.03, zc - 0.02, zc + 0.02, liso('#e8d0ff' if ligado else '#1e1c24'), acesa=ligado)
    EO.placa('+y', y + 0.0295, x + larg / 2 - 0.05, x + larg / 2 - 0.05 + PH, z0 + 0.002, z0 + 0.002 + PZ, liso('#7af08a' if ligado else '#e0a030'), acesa=True)
    # os post-its na moldura (u, z em relação ao canto de baixo à esquerda)
    for (u, zz, cor) in notas:
        EO.placa('+y', y + 0.0305, x - larg / 2 + u, x - larg / 2 + u + 0.06, z0 + zz, z0 + zz + 0.055, liso(cor))
        EO.placa('+y', y + 0.031, x - larg / 2 + u + 0.008, x - larg / 2 + u + 0.04, z0 + zz + 0.03, z0 + zz + 0.03 + PZ, liso(_hex(_tom(hx(cor), 0.7))))
    peq(x - 0.14, x + 0.14, y - 0.1, y + 0.08, z)


def _torre_pc(x0, x1, y0, y1, z0, z1, ligado):
    """A torre de PC (0,34 x 0,5 x 0,5 m): a frente de tela com três ventoinhas RGB, a lateral de vidro mostrando a placa de vídeo e as ventoinhas."""
    cores = ['#40e8f0', '#a050ff', '#f060d0']
    xm = (x0 + x1) / 2

    def frente(L, n, P):
        a, z = P[:, 0], P[:, 2]
        out = np.tile(hx('#17171c'), (len(P), 1))
        out = np.where(((a < x0 + 0.02) | (a > x1 - 0.02) | (z < z0 + 0.03) | (z > z1 - 0.025))[:, None], hx('#26252c'), out)
        for k in range(3):
            zc = z0 + 0.1 + k * 0.145
            r = np.hypot(a - xm, z - zc)
            out = np.where(((r < 0.056) & (r >= 0.036))[:, None], hx(cores[k]) if ligado else hx('#2c2c34'), out)
            out = np.where(((r < 0.056) & (r >= 0.036) & (a < xm))[:, None], _tom(hx(cores[k]), 1.25) if ligado else hx('#34343c'), out)
            out = np.where((r < 0.016)[:, None], hx('#e6eaf6') if ligado else hx('#202028'), out)
            asp = (r < 0.036) & (r >= 0.016) & ((np.abs(a - xm) < PH * 0.8) | (np.abs(z - zc) < PZ * 0.8))
            out = np.where(asp[:, None], hx('#2a2a32'), out)
        return out

    def vidro(L, n, P):
        a, z = P[:, 1], P[:, 2]
        out = np.tile(hx('#0e1118'), (len(P), 1))
        out = np.where(((a < y0 + 0.025) | (a > y1 - 0.02) | (z < z0 + 0.03) | (z > z1 - 0.025))[:, None], hx('#26252c'), out)
        # a fonte (a caixa de baixo)
        out = np.where(((z < z0 + 0.1) & (a > y0 + 0.025) & (a < y1 - 0.02) & (z >= z0 + 0.03))[:, None], hx('#1c1c22'), out)
        # as três ventoinhas na frente (y alto)
        for k in range(3):
            zc = z0 + 0.15 + k * 0.115
            ya = y1 - 0.075
            r = np.hypot(a - ya, z - zc)
            out = np.where(((r < 0.05) & (r >= 0.032))[:, None], hx(cores[k]) if ligado else hx('#2c2c34'), out)
            out = np.where((r < 0.014)[:, None], hx('#e6eaf6') if ligado else hx('#202028'), out)
        # a placa de vídeo (a laje horizontal com a luz de cima) e a memória
        gm = (a > y0 + 0.06) & (a < y1 - 0.15) & (z > z0 + 0.19) & (z < z0 + 0.255)
        out = np.where(gm[:, None], hx('#2c2e38'), out)
        out = np.where((gm & (z > z0 + 0.235))[:, None], hx('#40e8f0') if ligado else hx('#3a3c44'), out)
        out = np.where((gm & (np.hypot(a - (y0 + 0.13), z - (z0 + 0.21)) < 0.022))[:, None], hx('#101014'), out)
        for yy in (y0 + 0.06, y0 + 0.085):
            rm = (np.abs(a - yy) < PH * 0.8) & (z > z0 + 0.32) & (z < z1 - 0.05)
            out = np.where(rm[:, None], hx('#e050d0') if ligado else hx('#3a3a44'), out)
        # o reflexo do vidro (a faixa diagonal)
        d = (a * 1.0 + z * 0.55) % 0.9
        out = np.where(((d > 0.42) & (d < 0.46) & (z > z0 + 0.06))[:, None], _tom(out, 1.55) if ligado else hx('#2a2e38'), out)
        return out
    metal = EO.metal('#1d1c22', (0, 0, 0, 0, z0, z1), topo='#34333a')
    o = cx((x0, x1, y0, y1, z0, z1), {'frente': emissivo(frente), 'dir': emissivo(vidro), '*': metal})
    # o pezinho e a tira de LED no topo
    cx((x0 + 0.02, x1 - 0.02, y0 + 0.03, y1 - 0.03, z0 - 0.0, z0 + 0.012), liso('#101014'))
    peq(x0, x1, y0, y1, z0)


def _papeis(x, y, z):
    """Duas folhas e um caderno com a caneta, espalhados (nada de letra: as linhas de texto)."""
    def folha(cx_, cy_, ang, w, d, cor='#f2eee2', z_=z):
        pts = EO.ret_girado(cx_, cy_, ang, w / 2, d / 2)
        ca, sa = math.cos(ang), math.sin(ang)

        def m(L, n, P):
            if n[2] < 0.5:
                return np.tile(_tom(hx(cor), 0.8), (len(P), 1))
            v = -(P[:, 0] - cx_) * sa + (P[:, 1] - cy_) * ca
            u = (P[:, 0] - cx_) * ca + (P[:, 1] - cy_) * sa
            out = np.tile(hx(cor), (len(P), 1))
            lin = (np.floor(v / (2 * PH)) % 2 == 0) & (np.abs(u) < w / 2 - 0.03) & (ruido(np.floor(v / (2 * PH)), 2.2) > 0.2)
            return np.where(lin[:, None], hx('#7a8aa0'), out)
        EO.prisma(pts, z_, z_ + 0.004, emissivo(m), novo(contorno=False))
    folha(x, y, 0.2, 0.2, 0.28)
    folha(x + 0.04, y + 0.03, -0.1, 0.2, 0.28, '#e8f0f4', z + 0.004)
    # o caderno pequeno com a caneta
    pts = EO.ret_girado(x + 0.0, y - 0.0, 0.0, 0.0, 0.0)
    peq(x - 0.15, x + 0.15, y - 0.17, y + 0.17, z)


def _setup_gamer(ligado):
    def d():
        W = 2.25
        x0, x1, y0, y1 = 0.04, W - 0.04, 0.04, 0.74
        zt = 0.78
        # as pernas: dois painéis de aço nas pontas, o painel do fundo (nada embaixo do tampo)
        for xa in (x0 + 0.04, x1 - 0.1):
            cx((xa, xa + 0.06, y0 + 0.06, y1 - 0.06, 0.0, zt - 0.04), EO.metal('#4a4c5a', (0, 0, 0, 0, 0, zt), topo='#7a7c8c'))
            cx((xa - 0.03, xa + 0.09, y0 + 0.04, y1 - 0.04, 0.0, 0.03), EO.metal('#3c3e4a', topo='#6a6c7c'))
        cx((x0 + 0.1, x1 - 0.1, y0 + 0.04, y0 + 0.08, 0.28, zt - 0.04), EO.metal('#32343e', (0, 0, 0, 0, 0.28, zt), topo='#5a5c6a'))
        # o tampo escuro com a borda de baixo iluminada de roxo
        def tampo(L, n, P):
            out = np.tile(hx('#464856'), (len(P), 1))
            if n[2] > 0.5:
                bd = np.minimum(np.minimum((P[:, 0] - x0) / PH, (x1 - P[:, 0]) / PH), np.minimum((P[:, 1] - y0) / PH, (y1 - P[:, 1]) / PH))
                out = np.where((bd < 1)[:, None], hx('#6a6c7e'), out)
                fib = ((np.floor((P[:, 0] + P[:, 1]) / (2 * PH)) % 5) == 0)
                out = np.where(fib[:, None], hx('#3e4050'), out)
            return out
        cx((x0, x1, y0, y1, zt - 0.04, zt), {'cima': emissivo(tampo), '*': EO.metal('#3a3c48', (0, 0, 0, 0, zt - 0.04, zt), topo='#6a6c7c', quina=1.4)})
        # a luz de LED roxa: a fita sob a borda da frente e a de trás, atrás dos monitores
        for (ya, yb, za, zb) in ((y1 - 0.04, y1 - 0.015, zt - 0.075, zt - 0.045), (y0 + 0.01, y0 + 0.035, zt, zt + 0.012)):
            ol = cx((x0 + 0.06, x1 - 0.06, ya, yb, za, zb), liso('#c070ff' if ligado else '#2e2a34'))
            if ligado:
                CZ.luzes.add(ol)
        # o mousepad e o teclado, o mouse
        _tapete_mouse(0.5, 1.5, 0.38, 0.7, zt, ligado)
        _teclado_rgb(0.72, 1.22, 0.5, 0.65, zt + PZ, ligado)
        EO.mouse(1.36, 0.56, zt + PZ, ligado)
        # os dois monitores
        _monitor_g(0.64, 0.3, zt, 0.62, 0.36, _cena_jogo, ligado, notas=((0.01, 0.06, '#f8e060'), (0.03, 0.2, '#f890b8'), (0.5, 0.3, '#90e8a0')), noite=True)
        _monitor_g(1.3, 0.3, zt, 0.62, 0.36, lambda i, j, W, H: _cena_codigo(i, j, W, H), ligado, notas=((0.54, 0.05, '#f8e060'),))
        # a torre com o vidro e as ventoinhas, ao lado
        _torre_pc(1.74, 2.08, 0.16, 0.66, zt, zt + 0.5, ligado)
        # os fones, a lata e os papéis
        EO._fone(0.32, 0.58, zt)
        EO._lata(1.6, 0.6, zt, cor='#2ad0ff' if ligado else '#2ad0ff')
        _papeis(0.22, 0.34, zt)
        peg(x0, x1, y0, y1)
    return d


# =====================================================================================================================
# a parede de escalada (3 x 1, portal; 2,7 m)
# =====================================================================================================================
AGARRAS = [   # (x, z, cor, rx, rz)
    (0.25, 0.42, '#f08a28', 0.07, 0.05), (0.62, 0.3, '#3a7ae8', 0.06, 0.05), (0.98, 0.5, '#38b858', 0.08, 0.06),
    (1.4, 0.36, '#f4d030', 0.06, 0.05), (1.82, 0.52, '#e03a34', 0.07, 0.05), (2.04, 0.34, '#3a7ae8', 0.06, 0.04),
    (0.42, 0.82, '#e03a34', 0.06, 0.06), (0.8, 0.9, '#f4d030', 0.07, 0.05), (1.22, 0.86, '#f08a28', 0.08, 0.06),
    (1.62, 0.98, '#38b858', 0.06, 0.05), (1.96, 0.9, '#f08a28', 0.07, 0.05), (0.3, 1.3, '#38b858', 0.07, 0.06),
    (0.7, 1.38, '#3a7ae8', 0.08, 0.06), (1.1, 1.28, '#e03a34', 0.06, 0.05), (1.5, 1.42, '#f4d030', 0.07, 0.06),
    (1.9, 1.34, '#3a7ae8', 0.06, 0.05), (0.5, 1.78, '#f08a28', 0.07, 0.05), (0.9, 1.86, '#e03a34', 0.08, 0.06),
    (1.32, 1.8, '#38b858', 0.07, 0.05), (1.72, 1.9, '#f4d030', 0.06, 0.06), (2.06, 1.82, '#f08a28', 0.06, 0.05),
    (0.34, 2.2, '#3a7ae8', 0.06, 0.05), (0.78, 2.3, '#f4d030', 0.07, 0.05), (1.18, 2.22, '#38b858', 0.08, 0.06),
    (1.6, 2.34, '#e03a34', 0.06, 0.05), (1.98, 2.26, '#3a7ae8', 0.07, 0.05), (0.6, 2.58, '#e03a34', 0.06, 0.04),
    (1.5, 2.6, '#f08a28', 0.07, 0.04),
]


def _parede_escalada():
    x0, x1 = 0.02, 2.23
    zt = 2.7
    yp = 0.12

    def compensado(L, n, P):
        out = np.tile(hx('#d9b886'), (len(P), 1))
        a, z = P[:, 0], P[:, 2]
        if n[1] > 0.5:
            # as chapas: emendas a cada 1,2 m na vertical e 1,125 m na horizontal, a tinta azul-acinzentada nas laterais baixas
            out = np.where(((a - x0) % 1.125 < PH)[:, None], hx('#8a6a40'), out)
            out = np.where((z % 1.2 < PZ)[:, None], hx('#8a6a40'), out)
            out = np.where((((a - x0) % 1.125 >= PH) & ((a - x0) % 1.125 < 2 * PH))[:, None], hx('#e8cc9c'), out)
            # a porca-garra: a grade de furos de 15 cm (1 px escuro, discreto)
            furo = (np.abs(((a - x0 + 0.075) % 0.15) - 0.075) < PH * 0.55) & (np.abs(((z + 0.075) % 0.15) - 0.075) < PZ * 0.55)
            out = np.where(furo[:, None], hx('#b8946a'), out)
            # o veio do compensado: manchas compridas
            s = suave(a * 2.0, z * 0.5, 0.5, 4)
            out = np.where((s > 0.7)[:, None], hx('#d0ae7c'), out)
            # o rodapé do painel (a faixa de baixo mais escura onde a mão não chega)
            out = np.where((z < 0.1)[:, None], hx('#a8845a'), out)
        return out
    cx((x0, x1, 0.0, yp, 0.0, zt), {'frente': emissivo(compensado), 'costas': tab2(['#b8946a', '#b08c62', '#bc9a70'], 0.16, '#6a4a2a', eixo=1, seed=71),
                                    '*': mad2('#b8946a', eixo=1, seed=72, passo=0.04), 'cima': liso('#e0c08c')}, ch=0.008)
    # a viga de cima (a borda do mezanino) e a de baixo (o rodapé)
    cx((x0 - 0.03, x1 + 0.03, 0.0, 0.22, zt - 0.02, zt + 0.1), {'*': mad2('#6a4a2a', seed=73), 'cima': liso('#8a6a42'), 'frente': mad2('#5e4024', seed=74)}, ch=0.01)
    # o colchão azul no pé
    def colchao(L, n, P):
        out = np.tile(hx('#2e4a8a'), (len(P), 1))
        if n[2] > 0.5:
            i = np.floor((P[:, 0] - x0) / PH)
            j = np.floor(P[:, 1] / PH)
            out = np.where(((P[:, 0] - x0) % 0.5 < PH)[:, None], hx('#243a70'), out)
            out = np.where((j % 18 == 0)[:, None], hx('#243a70'), out)
            out = np.where((np.minimum(i, (x1 - x0) / PH - 1 - i) < 1)[:, None], hx('#4a6ab0'), out)
        return out
    _p1_malha((x0, x1, yp + 0.02, 0.78, 0.0, 0.1), (0.04, 0.04, 0.01, 0.03), emissivo(colchao), seg=1)
    # as agarras: elipsoides meio enterradas no painel, cada uma de uma cor
    for (x, z, cor, rx, rz) in AGARRAS:
        o = novo()
        elip((x, yp + 0.005, z), (rx, 0.06, rz), cor, o)
        elip((x - rx * 0.2, yp + 0.045, z + rz * 0.15), (rx * 0.5, 0.03, rz * 0.5), _hex(_tom(hx(cor), 1.25)), o)
    # a corda com o mosquetão no alto e a argola de segurança, e a rodilha no colchão
    def corda(L, n, P):
        k = np.floor(P[:, 2] / (3 * PZ)) % 2
        return np.where((k == 0)[:, None], hx('#e8e0d0'), hx('#c83a30'))
    cx((0.34, 0.37, yp + 0.04, yp + 0.07, 0.3, zt - 0.1), emissivo(corda), novo())
    cx((0.31, 0.4, yp + 0.025, yp + 0.085, zt - 0.14, zt - 0.08), EO.metal('#a4aab2', topo='#e8ecf2'), novo())
    elip((0.62, 0.45, 0.13), (0.1, 0.1, 0.035), '#e8e0d0', novo())
    elip((0.62, 0.45, 0.15), (0.06, 0.06, 0.03), '#c83a30', novo())
    peg(x0, x1, 0.0, 0.78)


# =====================================================================================================================
# o pufe-saco (1 x 1, 0,45 m)
# =====================================================================================================================
def _puff_gamer():
    cor = '#2aa0ac'

    def pano(Pc, N, P):
        out = np.tile(hx(cor), (len(P), 1))
        # a costura de brim em volta (uma faixa mais clara) e as dobras (riscas escuras que descem)
        out = np.where((np.abs(Pc[:, 2] - 0.02) < PZ * 0.8)[:, None], hx('#6ac4cc'), out)
        ang = np.arctan2(Pc[:, 1], Pc[:, 0])
        dob = (np.floor(ang * 2.5 + 0.4 * np.sin(Pc[:, 2] * 9)) % 3 == 0) & (P[:, 2] > 0.07) & (P[:, 2] < 0.36) & (np.abs(Pc[:, 2]) > 0.03)
        out = np.where(dob[:, None], _tom(hx(cor), 0.8), out)
        cova = (np.hypot(Pc[:, 0], Pc[:, 1]) < 0.12) & (N[:, 2] > 0.85) & (P[:, 2] > 0.3)
        out = np.where(cova[:, None], _tom(hx(cor), 0.78), out)
        return out
    mat = emissivo(pano)
    o = novo()
    elip_m((0.375, 0.4, 0.2), (0.33, 0.31, 0.2), mat, o, corte_z=0.0)
    elip_m((0.375, 0.24, 0.26), (0.27, 0.2, 0.2), mat, o, corte_z=0.0)
    elip_m((0.375, 0.58, 0.1), (0.22, 0.14, 0.1), mat, o, corte_z=0.0)
    # a alça de pegar atrás
    BE._fita([(-0.06, 0.4), (-0.06, 0.46), (0.0, 0.49), (0.06, 0.46), (0.06, 0.4)], 0.375, 0.1, liso('#1e5a62'), novo(), 0.03)
    peg(0.05, 0.7, 0.05, 0.7)


# =====================================================================================================================
# a mesa de carteado (2 x 2, 0,78 m, aumento 1,2: a arte de 1,8 m)
# =====================================================================================================================
def _oct_d(P, cx_, cy_):
    """A distância 'octogonal' ao centro (o que vale para o contorno de um octógono de lados nos eixos)."""
    dx, dy = np.abs(P[:, 0] - cx_), np.abs(P[:, 1] - cy_)
    return np.maximum(np.maximum(dx, dy), (dx + dy) * 0.70711)


def _carta(x, y, z, ang, verso=False):
    pts = EO.ret_girado(x, y, ang, 0.034, 0.048)
    ca, sa = math.cos(ang), math.sin(ang)

    def m(L, n, P):
        if n[2] < 0.5:
            return np.tile(hx('#d8d4c8'), (len(P), 1))
        u = (P[:, 0] - x) * ca + (P[:, 1] - y) * sa
        v = -(P[:, 0] - x) * sa + (P[:, 1] - y) * ca
        if verso:
            out = np.tile(hx('#2a4a9a'), (len(P), 1))
            return np.where(((np.abs(u) > 0.026) | (np.abs(v) > 0.04))[:, None], hx('#f0ece0'), out)
        out = np.tile(hx('#f4f0e6'), (len(P), 1))
        return np.where(((np.abs(u) < 0.018) & (np.abs(v) < 0.024))[:, None], hx('#c83030') if (int(x * 100) % 2 == 0) else hx('#202020'), out)
    EO.prisma(pts, z, z + 0.004, emissivo(m), novo(contorno=False, sombra=False))


def _ficha(x, y, z, cor, n):
    for k in range(n):
        C().cilindro(x, y, 0.036, z + k * 0.014, z + (k + 1) * 0.014, vol(x, y, cor, brilho=0.25,
                     faixas=lambda P, b, cor=cor: np.where((np.floor(np.arctan2(P[:, 1] - y, P[:, 0] - x) * 2.5) % 2 == 0)[:, None], hx('#f4f0e6'), b)),
                     M, novo(), lados=10, tampa_mat=liso(_hex(_tom(hx(cor), 1.12))))
    peq(x - 0.037, x + 0.037, y - 0.037, y + 0.037, z)


def _mesa_carteado():
    cxm, cym = 0.75, 0.75
    zr, zf = 0.78, 0.745
    Ro, Ri = 0.974, 0.844           # os cantos (a 1,8 m de lado a lado fora e 1,56 m dentro)
    O, I = octogono(cxm, cym, Ro), octogono(cxm, cym, Ri)

    def couro_alto(L, n, P):
        d = _oct_d(P, cxm, cym)
        t = (d - 0.78) / 0.12
        out = np.tile(hx('#2a262c'), (len(P), 1))
        out = np.where(((t > 0.3) & (t < 0.7))[:, None], hx('#46414a'), out)
        out = np.where(((t > 0.4) & (t < 0.55))[:, None], hx('#5a5560'), out)
        # o pesponto: traços de 3 px a 1 px da borda de dentro
        along = (P[:, 0] + P[:, 1]) / PH
        pes = (np.abs(t - 0.82) < 0.05) & (np.floor(along / 3) % 2 == 0)
        out = np.where(pes[:, None], hx('#8a8490'), out)
        out = np.where((t < 0.06)[:, None], hx('#18161a'), out)
        return out
    couro_lado = emissivo(lambda L, n, P: np.tile(hx('#222025'), (len(P), 1)))

    def feltro(L, n, P):
        d = _oct_d(P, cxm, cym)
        out = np.tile(hx('#2f8050'), (len(P), 1))
        out = np.where((d > 0.5)[:, None], hx('#2a7448'), out)
        out = np.where((d > 0.7)[:, None], hx('#246a42'), out)
        # a linha de aposta (um octógono fino)
        out = np.where((np.abs(d - 0.52) < PH * 0.55)[:, None], hx('#4aa670'), out)
        out = np.where((np.abs(d - 0.2) < PH * 0.55)[:, None], hx('#3c9060'), out)
        # a sombra do couro na beira de cima e à esquerda
        out = np.where(((d > Ri * 0.92 - 0.03) & ((P[:, 0] - cxm) + (P[:, 1] - cym) < 0.0))[:, None], hx('#1c5434'), out)
        return out
    o = novo()
    C().face_plana([(x, y, zf) for (x, y) in I], (0, 0, 1), emissivo(feltro), M, o)
    for k in range(8):
        a, b = O[k], O[(k + 1) % 8]
        c_, d_ = I[(k + 1) % 8], I[k]
        am = math.pi / 8 + k * math.pi / 4 + math.pi / 8
        # o topo almofadado do couro
        C().face_plana([(a[0], a[1], zr), (b[0], b[1], zr), (c_[0], c_[1], zr), (d_[0], d_[1], zr)], (0, 0, 1), emissivo(couro_alto), M, o)
        # a parede de dentro do couro (do feltro até o topo), virada para o centro
        C().face_plana([(d_[0], d_[1], zf), (c_[0], c_[1], zf), (c_[0], c_[1], zr), (d_[0], d_[1], zr)], (-math.cos(am), -math.sin(am), 0),
                       liso('#14121a'), M, o)
        # a saia de couro por fora (a borda funda)
        C().face_plana([(a[0], a[1], 0.64), (b[0], b[1], 0.64), (b[0], b[1], zr), (a[0], a[1], zr)], (math.cos(am), math.sin(am), 0), couro_lado, M, o)
    # a faixa de latão em volta da saia (o friso) e as quatro pernas torneadas
    for k in range(8):
        a, b = O[k], O[(k + 1) % 8]
        am = math.pi / 8 + k * math.pi / 4 + math.pi / 8
        C().face_plana([(a[0], a[1], 0.655), (b[0], b[1], 0.655), (b[0], b[1], 0.675), (a[0], a[1], 0.675)], (math.cos(am), math.sin(am), 0),
                       liso('#c8a050' if k % 2 == 0 else '#b89040'), M, o)
    for (dx, dy) in ((0.66, 0), (-0.66, 0), (0, 0.66), (0, -0.66)):
        lx, ly = cxm + dx, cym + dy
        CA.perna_torneada(lx, ly, 0.0, 0.66, 0.075, '#6a3a1c')
    # o que está na mesa: as cartas da mesa, as duas mãos viradas, o baralho, as fichas
    for k in range(5):
        _carta(cxm - 0.14 + k * 0.07, cym + 0.02, zf, 0.04 * (k - 2))
    _carta(0.46, 1.0, zf, 0.4, verso=True)
    _carta(0.52, 1.02, zf, 0.2, verso=True)
    _carta(1.06, 0.46, zf, -0.5, verso=True)
    _carta(1.0, 0.43, zf, -0.7, verso=True)
    cx((0.98, 1.04, 0.95, 1.03, zf, zf + 0.025), {'*': liso('#f0ece0'), 'cima': liso('#2a4a9a')}, novo(contorno=False))
    _ficha(0.62, 0.55, zf, '#c83030', 5)
    _ficha(0.7, 0.5, zf, '#2a4aa8', 4)
    _ficha(0.78, 0.57, zf, '#1c1c20', 6)
    _ficha(1.05, 1.1, zf, '#2a9a4a', 4)
    _ficha(1.13, 1.04, zf, '#f4f0e6', 3)
    _ficha(0.4, 0.82, zf, '#c83030', 3)
    # o cinzeiro de cristal em cima do couro
    xa, ya = 1.59, 0.5
    _poligono_rodado(xa, ya, [(zr, 0.05), (zr + 0.012, 0.055), (zr + 0.034, 0.052)], vol(xa, ya, '#d4e4ec', brilho=0.8), novo(), lados=10)
    _disco(xa, ya, zr + 0.026, 0.038, liso('#8aa0ac'), novo(contorno=False), lados=10)
    peq(xa - 0.055, xa + 0.055, ya - 0.055, ya + 0.055, zr)
    peg(0.0, 1.5, 0.0, 1.5)


# =====================================================================================================================
# o saco de pancada (1 x 1, 1,7 m)
# =====================================================================================================================
def _luva_pendurada(x, y, z, k=1.0):
    """A luva de boxe vermelha pendurada (0,2 m): o punho, o polegar e o punho de fita branca."""
    o = novo()
    elip((x, y, z + 0.1 * k), (0.062 * k, 0.07 * k, 0.1 * k), '#d83030', o)
    elip((x + 0.045 * k, y + 0.05 * k, z + 0.1 * k), (0.026 * k, 0.04 * k, 0.045 * k), '#e04040', o)
    cx((x - 0.044 * k, x + 0.044 * k, y - 0.04 * k, y + 0.04 * k, z + 0.17 * k, z + 0.23 * k), {'*': liso('#f0ece0'), 'cima': liso('#fafaf4')}, novo())


def _saco_pancada():
    xb, yb = 0.47, 0.375
    # a base de aço e o mastro com o braço e a escora
    cx((0.05, 0.7, 0.07, 0.68, 0.0, 0.05), EO.metal('#34363e', (0, 0, 0, 0, 0, 0.05), topo='#5a5d68'), ch=0.01)
    for (a, b) in ((0.1, 0.12), (0.62, 0.12), (0.1, 0.6), (0.62, 0.6)):
        cx((a - 0.02, a + 0.04, b - 0.02, b + 0.04, 0.05, 0.065), EO.metal('#1c1d22', topo='#34363e'))
    cx((0.075, 0.135, 0.345, 0.405, 0.05, 1.72), EO.metal('#3c3f4a', (0, 0, 0, 0, 0.05, 1.72), topo='#7a7e8a', quina=1.3))
    cx((0.075, 0.5, 0.35, 0.4, 1.64, 1.72), EO.metal('#3c3f4a', (0, 0, 0, 0, 1.64, 1.72), topo='#7a7e8a', quina=1.3))
    EO.haste((0.105, 0.375, 1.2), (0.3, 0.375, 1.64), 0.034, EO.metal('#34363e', topo='#6a6e7a'), novo())
    # a corrente (elos de cima para baixo, alternando de lado) e o anel
    for k in range(5):
        zz = 1.64 - 0.04 * (k + 1)
        if k % 2 == 0:
            cx((xb - 0.014, xb + 0.014, yb - 0.01, yb + 0.01, zz, zz + 0.045), EO.metal('#8a8e98', topo='#c8ccd4'), novo(contorno=False))
        else:
            cx((xb - 0.01, xb + 0.01, yb - 0.014, yb + 0.014, zz, zz + 0.045), EO.metal('#6a6e78', topo='#b0b4bc'), novo(contorno=False))
    cx((xb - 0.04, xb + 0.04, yb - 0.04, yb + 0.04, 1.5, 1.545), EO.metal('#5a5d68', topo='#a0a4ae'))
    # o saco: couro vermelho com as cintas e as costuras
    def cintas(P, b):
        z = P[:, 2]
        for zc in (0.72, 1.0, 1.28):
            b = np.where((np.abs(z - zc) < 0.034)[:, None], _tom(hx('#c02a2a'), 0.78), b)
            b = np.where((np.abs(z - (zc + 0.034)) < PZ * 0.8)[:, None], hx('#e86a5a'), b)
        return b
    _poligono_rodado(xb, yb, [(0.58, 0.1), (0.62, 0.15), (0.68, 0.17), (1.38, 0.17), (1.46, 0.15), (1.5, 0.11)],
                     vol(xb, yb, '#d03232', brilho=0.5, faixas=cintas, costuras=(8, '#8a1c1c', 0.17)), novo(), lados=24, tampa_mat=liso('#a02424'))
    # as luvas penduradas no gancho do mastro
    cx((0.095, 0.115, 0.4, 0.52, 1.28, 1.3), EO.metal('#3c3f4a', topo='#7a7e8a'), novo(contorno=False))
    _luva_pendurada(0.09, 0.5, 1.02, 1.0)
    _luva_pendurada(0.17, 0.5, 1.0, 1.0)
    peg(0.05, 0.7, 0.07, 0.68)


# =====================================================================================================================
# o rack de halteres (2 x 1, 1,05 m) com o banco
# =====================================================================================================================
def _haltere(x, y0, z, r, cabeca='#40404c', alca='#c8ced8'):
    """O haltere com o eixo ao longo de y (as cabeças hexagonais pretas, a barra cromada): z = o centro."""
    CA_ = hx(cabeca)
    EO.cil_eixo((x, y0 + 0.11, z), (x, y0 + 0.23, z), 0.016, EO.metal(alca, topo='#f0f4f8', quina=1.1), novo(), lados=8, tampa_mat=EO.metal(alca))
    for (ya, yb) in ((y0, y0 + 0.11), (y0 + 0.23, y0 + 0.34)):
        EO.cil_eixo((x, ya, z), (x, yb, z), r, EO.metal(cabeca, topo='#7a7a8a', quina=1.3), novo(), lados=6, tampa_mat=EO.metal('#5e5e6c', topo='#8a8a9a'))


def _rack_halteres():
    # os quatro montantes de aço preto
    for xa in (0.04, 0.96):
        for ya in (0.04, 0.4):
            cx((xa, xa + 0.05, ya, ya + 0.05, 0.0, 0.96), EO.metal('#6a6e7c', (0, 0, 0, 0, 0, 0.96), topo='#a4a8b4', quina=1.3))
    # as duas prateleiras (barras de apoio na frente e atrás) e as barras de cima
    for z in (0.4, 0.78):
        for ya in (0.04, 0.4):
            cx((0.04, 1.01, ya, ya + 0.05, z, z + 0.04), EO.metal('#80848f', (0, 0, 0, 0, z, z + 0.04), topo='#b4b8c4', quina=1.3))
    for ya in (0.04, 0.4):
        cx((0.04, 1.01, ya, ya + 0.05, 0.93, 0.97), EO.metal('#80848f', (0, 0, 0, 0, 0.93, 0.97), topo='#b4b8c4'))
    # os halteres: cinco por prateleira, crescendo da esquerda para a direita
    for z, rs in ((0.78, (0.052, 0.058, 0.064, 0.07, 0.076)), (0.4, (0.064, 0.07, 0.076, 0.082, 0.088))):
        for k, r in enumerate(rs):
            _haltere(0.16 + k * 0.18, 0.06, z + 0.04 + r, r)
    # o banco regulável ao lado: o assento, o encosto inclinado, as pernas
    xb0, xb1 = 1.1, 1.44
    PAD = {'*': liso('#1c1c20'), 'cima': liso('#2c2c32')}
    cx((xb0 + 0.04, xb1 - 0.04, 0.12, 0.66, 0.26, 0.31), EO.metal('#6a6e7c', topo='#a4a8b4'), novo())
    for ya in (0.12, 0.58):
        cx((xb0, xb1, ya, ya + 0.07, 0.0, 0.06), EO.metal('#6a6e7c', topo='#a4a8b4'))
        cx((xb0 + 0.14, xb1 - 0.14, ya + 0.01, ya + 0.05, 0.06, 0.28), EO.metal('#6a6e7c', topo='#a4a8b4'))
    # o assento acolchoado e o encosto inclinado (um prisma de lado)
    _p1_malha((xb0 + 0.02, xb1 - 0.02, 0.4, 0.68, 0.31, 0.4), (0.04, 0.04, 0.02, 0.04), emissivo(lambda L, n, P: np.where((np.abs(P[:, 0] - (xb0 + xb1) / 2) < PH * 0.6)[:, None], hx('#4a1418'), np.tile(hx('#7a2a30'), (len(P), 1)))), seg=2)
    import medieval as MD
    MD.placa_yz([(0.4, 0.34), (0.4, 0.42), (0.1, 0.72), (0.06, 0.64)], xb0 + 0.02, xb1 - 0.02, liso('#8a3038'), novo(), mat_borda=liso('#5a1c22'))
    peq(xb0, xb1, 0.1, 0.7, 0.0)
    peg(0.04, 1.44, 0.04, 0.7)


# =====================================================================================================================
# o tatame (3 x 3, 0,04 m, flat)
# =====================================================================================================================
def _tatame():
    x0, x1, y0, y1 = 0.03, 2.22, 0.03, 2.22
    U, V = (x1 - x0) / PH, (y1 - y0) / PH

    def f(L, n, P):
        u, v = np.floor((P[:, 0] - x0) / PH), np.floor((P[:, 1] - y0) / PH)
        bd = np.minimum(np.minimum(u, U - 1 - u), np.minimum(v, V - 1 - v))
        t = 0.375 / PH
        ti, tj = np.floor(u / t), np.floor(v / t)
        out = np.where(((ti + tj) % 2 == 0)[:, None], hx('#243e78'), hx('#2a4684'))
        # as emendas das placas de EVA (1 px escuro, 1 px claro depois)
        out = np.where(((u % t < 1) | (v % t < 1))[:, None], hx('#1a2c5a'), out)
        out = np.where((((u % t >= 1) & (u % t < 2)) | ((v % t >= 1) & (v % t < 2)))[:, None], hx('#3a5a9a'), out)
        # a faixa preta em volta (a área de luta)
        out = np.where((bd < 8)[:, None], hx('#1a1a20'), out)
        out = np.where(((bd >= 8) & (bd < 9))[:, None], hx('#c8ccd4'), out)
        out = np.where(((bd >= 1) & (bd < 3))[:, None], hx('#2a2a32'), out)
        out = np.where((bd == 0)[:, None], hx('#101014'), out)
        # o círculo/quadrado central mais claro (a marca de início)
        q = np.maximum(np.abs(u - U / 2), np.abs(v - V / 2))
        out = np.where(((q > U * 0.2) & (q < U * 0.2 + 1.5))[:, None], hx('#5a7ac0'), out)
        return out
    o = novo(sombra=True)
    C().caixa((x0, x1, y0, y1, 0.0, PZ * 2), {'cima': emissivo(f), '*': liso('#10182c')}, M, o)


# =====================================================================================================================
# os itens de parede
# =====================================================================================================================
METAIS = {
    'ouro': ('#6a4608', '#d09a22', '#f6cc4c', '#fff4b0'),
    'prata': ('#4e545e', '#a4acb8', '#d8dee8', '#ffffff'),
    'bronze': ('#52280c', '#a8662c', '#da8e46', '#f4bc7c'),
}
FITAS = [('#d03030', '#f4f0e6'), ('#2a56c8', '#f4f0e6'), ('#2aa050', '#f0d030'), ('#f0b020', '#2a3a8a'),
         ('#8a30c0', '#f4f0e6'), ('#e06a20', '#f4f0e6'), ('#20a0c0', '#f4f0e6'), ('#d03060', '#f4f0e6')]
CONTORNO = '#1e1410'


def _conv(xi0, zi1):
    """(u, w) px da pintura -> (x, z) metros."""
    return (lambda u: xi0 + u / KX), (lambda w: zi1 - w / KZ)


def _copa(pl, u, wb, h, metal, forma=0):
    """
    A taça (h px de altura, a base em wb): o pedestal de madeira com a plaquinha, o pé, a haste com o nó, o corpo em
    degraus de luz (claro na esquerda, escuro na direita, a risca de brilho), a borda e as duas alças. Devolve a máscara.
    """
    esc, mei, cla, bri = METAIS[metal]
    m = np.zeros_like(pl.dentro)
    ph = max(2, int(round(h * 0.15)))
    pw = (int(round(h * 0.54)) // 2) * 2 + 1
    b = pl.ret(u - pw / 2, wb - ph, u + pw / 2, wb)
    pl.pin(b, '#6a4426')
    pl.pin(pl.ret(u - pw / 2, wb - ph, u + pw / 2, wb - ph + 1), '#a8784a')
    pl.pin(pl.ret(u + pw / 2 - 1.5, wb - ph + 1, u + pw / 2, wb), '#4a2c16')
    if ph >= 3:
        pl.pin(pl.ret(u - 2, wb - ph + 1.2, u + 2, wb - 0.6), cla)
    m |= b
    hs = max(3, int(round(h * 0.2)))
    wf = wb - ph
    foot = pl.ret(u - h * 0.2, wf - 1.5, u + h * 0.2, wf)
    pl.pin(foot, mei)
    pl.pin(pl.ret(u - h * 0.2, wf - 1.5, u, wf), cla)
    m |= foot
    stem = pl.ret(u - 1.1, wf - hs, u + 1.1, wf - 1.5)
    pl.pin(stem, mei)
    pl.pin(pl.ret(u - 1.1, wf - hs, u, wf - 1.5), cla)
    m |= stem
    nodo = pl.elipse(u, wf - hs * 0.55, 2.0, 1.2)
    pl.pin(nodo, cla)
    m |= nodo
    wbo = wf - hs
    wt = wb - h
    hb = wbo - wt
    a = h * 0.34
    pts = [(u - a, wt), (u + a, wt), (u + a * 0.86, wt + hb * 0.4), (u + a * 0.5, wt + hb * 0.78), (u + 1.3, wbo), (u - 1.3, wbo),
           (u - a * 0.5, wt + hb * 0.78), (u - a * 0.86, wt + hb * 0.4)]
    bowl = pl.poli(pts)
    pl.pin(bowl, mei)
    pl.pin(bowl & (pl.u < u - a * 0.25), cla)
    pl.pin(bowl & (pl.u > u + a * 0.38), esc)
    pl.pin(bowl & (pl.u >= u - a * 0.7) & (pl.u < u - a * 0.5) & (pl.w > wt + 1.5) & (pl.w < wt + hb * 0.62), bri)
    pl.pin(pl.ret(u - a, wt, u + a, wt + 1.2), cla)
    pl.pin(pl.ret(u - a, wt, u - a * 0.2, wt + 1.2), bri)
    m |= bowl
    for s in (-1, 1):
        cu = u + s * (a + 0.8)
        ext = pl.elipse(cu, wt + hb * 0.34, 2.4, max(2.2, hb * 0.3))
        itn = pl.elipse(cu, wt + hb * 0.34, 1.1, max(1.0, hb * 0.17))
        al = ext & ~itn & ~bowl
        pl.pin(al, esc if s > 0 else mei)
        m |= al
    return m


ESG_LINHAS = [
    "....hgg.......",
    "...hgggg......",
    "...ggGgg......",
    "....GGg.......",
    "...hggggg.....",
    "..hggggggg.ss.",
    "..hgggggGgsss.",
    "...gggggG.....",
    "...gggGG......",
    "...ggGGg......",
    "..ggg..ggg....",
    ".ggg....ggg...",
    ".gG......gG...",
    "gG........Gg..",
]


def _estatueta(pl, u, wb, metal='ouro'):
    """A estatueta de esgrimista dourada em guarda, com a lâmina prateada, sobre o pedestal escuro com a plaquinha."""
    esc, mei, cla, bri = METAIS[metal]
    ph = 3
    b = pl.ret(u - 8, wb - ph, u + 8, wb)
    pl.pin(b, '#2a2a30')
    pl.pin(pl.ret(u - 8, wb - ph, u + 8, wb - ph + 1), '#5a5a64')
    pl.pin(pl.ret(u - 3, wb - ph + 1, u + 3, wb - 0.5), '#e0b040')
    pal = {'g': mei, 'G': esc, 'h': cla, 's': '#e8edf4'}
    u0 = int(round(u - 7))
    w0 = int(round(wb - ph - len(ESG_LINHAS)))
    PC._spr(pl, u0, w0, ESG_LINHAS, pal)
    U, V = np.floor(pl.u + 1e-6).astype(int), np.floor(pl.w + 1e-6).astype(int)
    m = b.copy()
    for v, ln in enumerate(ESG_LINHAS):
        for i, ch in enumerate(ln):
            if ch != '.':
                m |= pl.dentro & (U == u0 + i) & (V == w0 + v)
    return m


def _fita_medalha(pl, u, wt, comp, k, metal):
    """A fita pendurada (3 px, a faixa do meio de outra cor) com a medalha redonda na ponta."""
    f1, f2 = FITAS[k % len(FITAS)]
    esc, mei, cla, bri = METAIS[metal]
    m = pl.ret(u - 2, wt, u + 2, wt + comp)
    pl.pin(m, f1)
    pl.pin(pl.ret(u - 0.5, wt, u + 0.5, wt + comp), f2)
    pl.pin(pl.ret(u - 2, wt, u - 1, wt + comp), _hex(_tom(hx(f1), 1.2)))
    med = pl.elipse(u, wt + comp + 3.2, 3.4, 3.4)
    pl.pin(med, mei)
    pl.pin(med & (pl.u < u - 0.5) & (pl.w < wt + comp + 3.2), cla)
    pl.pin(med & (pl.u > u + 1) & (pl.w > wt + comp + 3.6), esc)
    pl.pin(pl.elipse(u, wt + comp + 3.2, 1.5, 1.5), cla)
    pl.pin(pl.elipse(u - 0.6, wt + comp + 2.6, 0.7, 0.7), bri)
    return m | med


def _pessoa(pl, u, wb, h, corpo, braco=False):
    pl.pin(pl.ret(u - 2, wb - h, u + 2, wb), corpo)
    pl.pin(pl.ret(u - 2, wb - h, u - 1, wb), _tom(hx(corpo), 1.15))
    pl.pin(pl.elipse(u, wb - h - 1.6, 1.7, 1.8), '#e8c098')
    if braco:
        pl.pin(pl.seg((u - 2, wb - h + 1), (u - 4, wb - h - 3), 1.3), corpo)
        pl.pin(pl.seg((u + 2, wb - h + 1), (u + 4, wb - h - 3), 1.3), corpo)


def _foto_podio(pl, u0, w0, u1, w1):
    """O porta-retrato com a foto do pódio (três em pé, o do meio com os braços para cima) e o céu azul."""
    m = pl.ret(u0, w0, u1, w1)
    pl.pin(m, '#3a2616')
    pl.pin(pl.ret(u0 + 1, w0 + 1, u1 - 1, w1 - 1), '#f0e8d4')
    ia, ib, ja, jb = u0 + 2.5, u1 - 2.5, w0 + 2.5, w1 - 2.5
    pl.pin(pl.ret(ia, ja, ib, jb), '#86b4e4')
    pl.pin(pl.ret(ia, ja, ib, ja + (jb - ja) * 0.4), '#a8cdf0')
    pl.pin(pl.ret(ia, jb - (jb - ja) * 0.28, ib, jb), '#4a4a58')       # a arquibancada atrás
    um = (ia + ib) / 2
    bw = (ib - ia) / 3
    for k, (alt, cor) in enumerate(((5, '#c8ccd4'), (8, '#e8c040'), (3, '#c48a50'))):
        a0 = ia + k * bw
        pl.pin(pl.ret(a0, jb - alt, a0 + bw, jb), cor)
        pl.pin(pl.ret(a0, jb - alt, a0 + bw, jb - alt + 1), _tom(hx(cor), 1.2))
        pl.pin(pl.ret(a0 + bw - 1, jb - alt + 1, a0 + bw, jb), _tom(hx(cor), 0.75))
    for k, (alt, cor, br) in enumerate(((5, '#f4f4f0', False), (8, '#f4f4f0', True), (3, '#e8e8e4', False))):
        _pessoa(pl, ia + k * bw + bw / 2, jb - alt, 5 if k != 1 else 6, cor, br)
    return m


def _diploma(pl, u0, w0, u1, w1):
    m = pl.ret(u0, w0, u1, w1)
    pl.pin(m, '#3a2616')
    pl.pin(pl.ret(u0 + 1, w0 + 1, u1 - 1, w1 - 1), '#f2ead4')
    pl.pin(pl.ret(u0 + 2.5, w0 + 3, u1 - 2.5, w0 + 4), '#8a7a5a')
    pl.pin(pl.ret(u0 + 3.5, w0 + 5.5, u1 - 3.5, w0 + 6.5), '#b8a880')
    pl.pin(pl.elipse((u0 + u1) / 2, w1 - 3.5, 1.6, 1.6), '#c03028')
    return m


def _fundo_madeira(pl, seed=3):
    """O fundo do painel: tábuas verticais de carvalho claro (6 px), a junta escura de 1 px e a luz do lado."""
    t = pl.dentro
    col = np.floor(pl.u / 6).astype(int)
    cores = ['#d3aa74', '#cca06a', '#d8b07c', '#c89c66']
    k = (ruido(col, seed) * 4).astype(int) % 4
    for i, c in enumerate(cores):
        pl.pin(t & (k == i), c)
    g = pl.u - col * 6
    pl.pin(t & (g < 1), '#8e6a3c')
    pl.pin(t & (g >= 1) & (g < 2), '#e0bc88')
    pl.pin(t & (g >= 5), _hex(_tom(hx('#cca06a'), 0.94)))
    # o veio: risquinhas compridas
    for c in range(0, 40):
        pass
    v = t & (np.floor(pl.w / 7) % 2 == 0) & (ruido(col, np.floor(pl.w / 14), 8.8) > 0.7) & (g > 2) & (g < 4)
    pl.pin(v, '#b98e58')


def painel_trofeus(xc=2.25, zc=1.5):
    """
    O painel de troféus e medalhas da Catarina (192 x 104 px): a moldura de nogueira, o fundo de carvalho claro, três
    prateleiras de cada lado com as taças de ouro, prata e bronze (e as estatuetas de esgrima), no meio as fotos do pódio,
    duas barras de ganchos com as medalhas penduradas pelas fitas e os diplomas; a luz e a sombra vêm das peças em relevo.
    """
    Wm, Hm = 4.5, 1.99
    x0, x1, z0, z1 = xc - Wm / 2, xc + Wm / 2, zc - Hm / 2, zc + Hm / 2
    e = 0.09
    ez = e * KX / KZ
    n0 = len(C().objs)
    xi0, xi1, zi0, zi1 = x0 + e, x1 - e, z0 + ez, z1 - ez
    pl = Pl(xi0, xi1, zi0, zi1, 0.02)
    W, H = (xi1 - xi0) * KX, (zi1 - zi0) * KZ
    fx, fz = _conv(xi0, zi1)
    _fundo_madeira(pl)
    masc = np.zeros_like(pl.dentro)
    # o recuo escuro atrás de cada prateleira (a sombra da tábua nas costas do painel)
    sh = [(34, 'P'), (62, 'P'), (90, 'P')]
    ESQ, DIR = (6, 62), (128, 184)
    taças_e = [
        [(15, 22, 'ouro'), (33, 17, 'prata'), (48, 12, 'bronze')],
        [('E', 14, 'ouro'), (35, 21, 'prata'), (50, 14, 'ouro')],
        [(13, 13, 'bronze'), (26, 13, 'prata'), (39, 13, 'ouro'), (52, 12, 'bronze')],
    ]
    taças_d = [
        [(138, 13, 'bronze'), (154, 22, 'ouro'), (173, 16, 'prata')],
        [(138, 20, 'prata'), (156, 14, 'bronze'), ('E', 173, 'prata')],
        [(135, 13, 'ouro'), (148, 13, 'bronze'), (161, 13, 'prata'), (174, 13, 'ouro')],
    ]
    for (wsh, _), le, ld in zip(sh, taças_e, taças_d):
        for lista in (le, ld):
            for it in lista:
                if it[0] == 'E':
                    masc |= _estatueta(pl, it[1], wsh, it[2])
                else:
                    masc |= _copa(pl, it[0], wsh, it[1], it[2])
    # o meio: as fotos, as barras de ganchos com as medalhas e os diplomas
    masc |= _foto_podio(pl, 68, 6, 94, 28)
    masc |= _foto_podio(pl, 98, 6, 124, 28)
    for (wr, comp, lista) in ((36, 8, range(10)), (58, 6, range(3, 13))):
        pl.pin(pl.ret(65, wr - 2, 127, wr), '#7a5230')
        pl.pin(pl.ret(65, wr - 2, 127, wr - 1), '#a8784a')
        for i, kk in enumerate(lista):
            u = 69 + i * 6.0
            masc |= _fita_medalha(pl, u, wr, comp + (kk * 3) % 5, kk, ('ouro', 'prata', 'bronze')[kk % 3])
            pl.pin(pl.ret(u - 0.5, wr - 2.2, u + 0.5, wr + 1), '#2a1a10')
    masc |= _diploma(pl, 68, 80, 86, 93)
    masc |= _diploma(pl, 89, 80, 107, 93)
    masc |= _diploma(pl, 110, 80, 124, 93)
    masc |= _copa(pl, 76, 100, 13, 'prata') if False else np.zeros_like(masc)
    pl.contorno_fora(masc, CONTORNO)
    # a luz do canto de cima do painel (um brilho suave em cima à esquerda)
    pl.tom(pl.dentro & (pl.w < 2), 0.9)
    pl.tom(pl.dentro & (pl.u < 2), 0.92)
    pl.grava()
    # as prateleiras em relevo (tábua de carvalho com a quina de luz) e as barras do meio
    TAB = {'*': mad2('#a47a48', eixo=0, seed=81, passo=0.04), 'cima': liso('#d0a870'), 'frente': mad2('#b08652', eixo=0, seed=82, passo=0.04)}
    for (wsh, _) in sh:
        for (ua, ub) in (ESQ, DIR):
            cx((fx(ua), fx(ub), 0.0, 0.085, fz(wsh + 3), fz(wsh)), TAB, ch=0.006)
    PC.moldura(x0, x1, z0, z1, e, 0.05, ('#2a160a', '#5a3a1e', '#8a5a30', '#c08a50'))
    PC.sombra_parede(n0, 1, 2)


def _led(cor, aceso, xc=2.25, zc=1.5):
    """
    A fita de LED (96 x 10 px): o perfil de alumínio fino com a luz de 2 px no meio e o brilho em volta, em quatro degraus
    (a cor do LED). Apagada: o difusor fosco cinza, sem brilho.
    """
    Wm = 96 / KX
    x0, x1 = xc - Wm / 2, xc + Wm / 2
    zh = 5 / KZ
    n0 = len(C().objs)
    cx((x0 - 0.01, x1 + 0.01, 0.0, 0.02, zc - 0.012, zc + 0.012), EO.metal('#8e929c', (0, 0, 0, 0, 0, zc + 0.012), topo='#d0d4dc'))
    pl = Pl(x0, x1, zc - zh, zc + zh, 0.021)
    t = pl.dentro
    c0 = hx(cor)
    if aceso:
        for dw, (k, a) in ((0, (1.0, 0.0)),):
            pass
        pl.pin(t & (pl.w >= 1), _hex(_tom(c0, 0.38)))
        pl.pin(t & (pl.w >= 2) & (pl.w < 8), _hex(_tom(c0, 0.62)))
        pl.pin(t & (pl.w >= 3) & (pl.w < 7), _hex(_tom(c0, 0.95)))
        pl.pin(t & (pl.w >= 4) & (pl.w < 6), _hex(np.clip(c0 * 0.4 + 255 * 0.6, 0, 255)))
        pl.pin(t & (pl.w >= 4.4) & (pl.w < 5.6) & (pl.u > 3) & (pl.u < pl.W - 3), '#ffffff')
        pl.pin(t & (pl.w < 1), '#000000', nv=0)
        pl.nv[t & (pl.w < 1)] = 0
        pl.nv[t & (pl.w >= 9)] = 0
        # as pontas do perfil (a tampa escura nas duas pontas)
        pl.pin(t & ((pl.u < 2) | (pl.u > pl.W - 2)) & (pl.w >= 3) & (pl.w < 7), '#32343c')
        pl.grava(luz=True)
    else:
        pl.pin(t & (pl.w >= 3) & (pl.w < 7), '#a8aab2')
        pl.pin(t & (pl.w >= 3) & (pl.w < 4), '#ced0d6')
        pl.pin(t & (pl.w >= 6) & (pl.w < 7), '#7e8088')
        pl.pin(t & ((pl.u < 2) | (pl.u > pl.W - 2)) & (pl.w >= 3) & (pl.w < 7), '#32343c')
        pl.contorno_fora(pl.opaco(), CONTORNO)
        pl.grava(luz=False)
    PC.sombra_parede(n0, 1, 1, leve=False)


def fita_led(cor='#a060ff', aceso=True):
    return lambda: _led(cor, aceso)


def medalhas_cabide(xc=2.25, zc=1.5):
    """A barra de madeira com os ganchos e as medalhas penduradas pelas fitas (44 x 34 px): seis, de comprimentos e cores diferentes."""
    Wm = 44 / KX
    x0, x1 = xc - Wm / 2, xc + Wm / 2
    z1 = zc + 17 / KZ
    z0 = zc - 17 / KZ
    n0 = len(C().objs)
    pl = Pl(x0, x1, z0, z1, 0.02)
    masc = np.zeros_like(pl.dentro)
    ms = ('ouro', 'prata', 'bronze', 'ouro', 'prata', 'bronze')
    for i in range(6):
        u = 6 + i * 6.4
        masc |= _fita_medalha(pl, u, 5, 8 + (i * 5) % 12, i, ms[i])
    pl.contorno_fora(masc, CONTORNO)
    pl.grava()
    # a barra (madeira) com as duas pontas torneadas e os parafusos
    cx((x0 + 0.01, x1 - 0.01, 0.0, 0.05, z1 - 5 / KZ - 0.01, z1 - 1 / KZ), {'*': mad2('#8a5a30', eixo=0, seed=83, passo=0.04), 'cima': liso('#c08a50'),
                                                                        'frente': mad2('#9a6a3c', eixo=0, seed=84, passo=0.03)}, ch=0.008)
    for xx in (x0 + 0.03, x1 - 0.03):
        cx((xx - 0.012, xx + 0.012, 0.05, 0.065, z1 - 4 / KZ - 0.012, z1 - 2 / KZ), liso('#5a5258'), novo(contorno=False))
    PC.sombra_parede(n0, 1, 2)


def _esgrimista(pl, u, wb, h, corpo, dir_=1, cor_det='#d03030'):
    """Um esgrimista em guarda (de lado, virado para dir_): máscara, jaqueta branca, pernas abertas, braço com a lâmina."""
    s = dir_
    m = np.zeros_like(pl.dentro)
    w0 = wb
    ps = [
        pl.seg((u, w0 - h * 0.46), (u - 2.6 * s, w0 - h * 0.2), 1.8), pl.seg((u - 2.6 * s, w0 - h * 0.2), (u - 3.4 * s, w0 - 0.5), 1.6),
        pl.seg((u, w0 - h * 0.46), (u + 3 * s, w0 - h * 0.22), 1.8), pl.seg((u + 3 * s, w0 - h * 0.22), (u + 3.4 * s, w0 - 0.5), 1.6),
        pl.seg((u, w0 - h * 0.44), (u + 0.3 * s, w0 - h * 0.74), 3.4),
        pl.elipse(u + 0.3 * s, w0 - h * 0.86, 1.8, 2.0),
    ]
    for p_ in ps:
        pl.pin(p_, corpo)
        m |= p_
    pl.pin(ps[4] & ((pl.u - u) * s > 0.4), '#c4c8d0')
    pl.pin(ps[5], '#8a90a0')
    pl.pin(ps[5] & ((pl.u - u) * s > 0.3), '#4a5060')
    pl.pin(pl.ret(u - 1.7, w0 - h * 0.6, u + 1.7, w0 - h * 0.58), cor_det)
    br = pl.seg((u + 0.6 * s, w0 - h * 0.7), (u + 4.5 * s, w0 - h * 0.62), 1.3)
    pl.pin(br, corpo)
    m |= br
    lam = pl.seg((u + 4.5 * s, w0 - h * 0.62), (u + 10 * s, w0 - h * 0.58), 1.0)
    pl.pin(lam, '#f0f4fa')
    m |= lam
    return m


def _pintor_poster(modelo):
    def p(pl, W, H):
        t = pl.dentro
        if modelo == 1:
            for k, c in enumerate(('#1e3a7a', '#284a98', '#3a62b4', '#e8a040')):
                pl.pin(t & (pl.w >= k * H * 0.18) & (pl.w < (k + 1) * H * 0.18 + (1 if k == 3 else 0)), c)
            pl.pin(t & (pl.w >= H * 0.72), '#d8c8a0')                                  # a pista
            pl.pin(t & (pl.w >= H * 0.72) & (pl.w < H * 0.72 + 1), '#8a7a5a')
            pl.pin(t & (pl.w >= H * 0.72 + 6) & (pl.w < H * 0.72 + 7), '#c04030')
            m = _esgrimista(pl, W * 0.22, H * 0.9, H * 0.56, '#f0f0ec', 1)
            m |= _esgrimista(pl, W * 0.78, H * 0.9, H * 0.56, '#e8e8e4', -1, '#2a56c8')
            pl.contorno_fora(m, '#1a1a2a')
            # a faixa do título (blocos sem letra)
            pl.pin(t & (pl.w >= H * 0.07) & (pl.w < H * 0.07 + 3), '#f4f0e6')
            pl.pin(pl.ret(W * 0.25, H * 0.07 + 5, W * 0.75, H * 0.07 + 6), '#f0b840')
        else:
            for k, c in enumerate(('#d83a30', '#c82a28', '#9a1c28', '#5a1428')):
                pl.pin(t & (pl.w >= k * H * 0.25) & (pl.w < (k + 1) * H * 0.25 + 1), c)
            # a máscara grande no meio e o florete cruzado
            cu, cw = W * 0.5, H * 0.46
            cab = pl.elipse(cu, cw, W * 0.3, H * 0.27)
            pl.pin(cab, '#eeeeea')
            pl.pin(cab & (pl.u > cu + W * 0.12), '#c8ccd4')
            pl.pin(cab & (pl.u < cu - W * 0.2) & (pl.w < cw), '#ffffff')
            tela = pl.elipse(cu + 1, cw + 2, W * 0.22, H * 0.17)
            pl.pin(tela, '#3a3e48')
            for k in range(int(H * 0.34)):
                if k % 2 == 0:
                    pl.pin(tela & (pl.w >= cw + 2 - H * 0.17 + k) & (pl.w < cw + 2 - H * 0.17 + k + 1), '#8a909c')
            pl.pin(pl.ret(cu - W * 0.2, cw + H * 0.2, cu + W * 0.2, cw + H * 0.3) & pl.elipse(cu, cw, W * 0.34, H * 0.4), '#eeeeea')
            lam = pl.seg((W * 0.08, H * 0.92), (W * 0.92, H * 0.1), 1.2)
            pl.pin(lam, '#f4f8fc')
            pl.pin(pl.seg((W * 0.08, H * 0.92), (W * 0.2, H * 0.8), 2.4), '#2a2a30')
            pl.contorno_fora(cab | tela | lam, '#1a0c10')
    return p


def poster_esgrima(modelo=1, xc=2.25, zc=1.5):
    """O pôster de esgrima (30 x 46 px): a folha com a margem branca, a arte (dois esgrimistas em guarda; ~2: a máscara e o florete) e os pregos."""
    x0, x1 = xc - 15 / KX, xc + 15 / KX
    z0, z1 = zc - 23 / KZ, zc + 23 / KZ
    n0 = len(C().objs)
    pl = Pl(x0, x1, z0, z1, 0.012)
    t = pl.dentro
    pl.pin(t, '#f4efe2')
    pl.pin(t & (pl.w < 1), '#fffaf0')
    pl.pin(t & ((pl.u >= pl.W - 1) | (pl.w >= pl.H - 1)), '#cfc8b4')
    inner = pl.ret(2, 2, pl.W - 2, pl.H - 2)
    sub = pl.W - 4, pl.H - 4
    uo, wo = pl.u.copy(), pl.w.copy()
    pl.u, pl.w = pl.u - 2, pl.w - 2
    nv0 = pl.nv.copy()
    pl.dentro = pl.dentro & inner
    _pintor_poster(modelo)(pl, sub[0], sub[1])
    pl.dentro = t
    pl.u, pl.w = uo, wo
    pl.contorno(pl.opaco())
    pl.grava()
    # os pregos nos cantos de cima
    for xx in (x0 + 0.02, x1 - 0.02):
        cx((xx - PH, xx + PH, 0.012, 0.03, z1 - 0.03 - PZ, z1 - 0.03 + PZ), liso('#6a6068'), novo(contorno=False))
    PC.sombra_parede(n0, 1, 2)


def luvas_parede(xc=2.25, zc=1.5):
    """
    O par de luvas de boxe vermelhas (32 x 32 px) penduradas num prego pelas fitas dos punhos; a da direita é a do Miguel,
    com as pontas de metal nos nós dos dedos.
    """
    n0 = len(C().objs)
    zp = zc + 0.27
    cx((xc - 0.012, xc + 0.012, 0.0, 0.05, zp - 0.012, zp + 0.012), EO.metal('#4a4448', topo='#8a8288'), novo(contorno=False))
    for k, s in enumerate((-1, 1)):
        gx = xc + s * 0.17
        zf = zc - 0.06
        # as duas fitas do punho até o prego
        for dx in (-0.025, 0.025):
            EO.haste((xc, 0.045, zp), (gx + dx, 0.09, zf + 0.2), 0.014, liso('#f0ece0'), novo(contorno=False), h=0.008)
        o = novo()
        elip((gx, 0.1, zf), (0.098, 0.088, 0.14), '#d83030', o)
        elip((gx, 0.14, zf - 0.02), (0.072, 0.05, 0.1), '#e85a52', o)
        elip((gx - s * 0.1, 0.12, zf + 0.02), (0.045, 0.05, 0.07), '#e04444', o)
        elip((gx, 0.105, zf - 0.12), (0.08, 0.075, 0.05), '#b82424', o)
        cx((gx - 0.07, gx + 0.07, 0.04, 0.15, zf + 0.12, zf + 0.2), {'*': liso('#f2eee4'), 'cima': liso('#fbf8f0'), 'frente': liso('#e0dcd0')}, novo())
        if s > 0:
            for (dx, dz) in ((-0.05, -0.02), (0.0, -0.02), (0.05, -0.02), (-0.025, 0.04), (0.025, 0.04)):
                EO.cil_eixo((gx + dx, 0.17, zf + dz), (gx + dx, 0.235, zf + dz), 0.02, EO.metal('#9aa0aa', topo='#e8ecf2', quina=1.2),
                            novo(), lados=6, tampa_mat=EO.metal('#d8dce4'), r1=0.003)
    PC.sombra_parede(n0, 1, 2)


# =====================================================================================================================
ITENS = {
    'cama_catarina': (3, 3, (0.0, 0.0), _cama_catarina, {}),
    'tv_gamer': (3, 1, (0.0, 0.0), _tv_gamer(True), {'1': _tv_gamer(False)}),
    'rack_esgrima': (2, 1, (0.0, 0.0), _rack_esgrima, {}),
    'setup_gamer': (3, 1, (0.0, 0.0), _setup_gamer(True), {'1': _setup_gamer(False)}),
    'parede_escalada': (3, 1, (0.0, 0.0), _parede_escalada, {}),
    'puff_gamer': (1, 1, (0.0, 0.0), _puff_gamer, {}),
    'mesa_carteado': (2, 2, (0.0, 0.0), _mesa_carteado, {}),
    'saco_pancada': (1, 1, (0.0, 0.0), _saco_pancada, {}),
    'rack_halteres': (2, 1, (0.0, 0.0), _rack_halteres, {}),
    'tatame': (3, 3, (0.0, 0.0), _tatame, {}),
}

ITENS_PAREDE = {
    'painel_trofeus': (painel_trofeus, (2.25, 1.5)),
    'fita_led': (fita_led('#a060ff', True), (2.25, 1.5), {'1': fita_led('#a060ff', False)}),
    'fita_led~2': (fita_led('#40e0f0', True), (2.25, 1.5), {'1': fita_led('#40e0f0', False)}),
    'fita_led~3': (fita_led('#ff50c0', True), (2.25, 1.5), {'1': fita_led('#ff50c0', False)}),
    'medalhas_cabide': (medalhas_cabide, (2.25, 1.5)),
    'poster_esgrima': (lambda: poster_esgrima(1), (2.25, 1.5)),
    'poster_esgrima~2': (lambda: poster_esgrima(2), (2.25, 1.5)),
    'luvas_parede': (luvas_parede, (2.25, 1.5)),
}
