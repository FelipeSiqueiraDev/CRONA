"""
A GALERIA da MANSÃO ALBUQUERQUE (23/10, o Felipe: "e se a gente concentrasse todos os quadros da família só no Hall
central, meio que começa do mais antigo e vai circulando a sala até os mais novos, e no resto da casa pinturas que parecem
custar milhões de reais").

- `retrato_familia` (~1 a ~9): os retratos da família, todos ruivos, um por época, do fundador aos filhos de Alexander.
  Quanto mais antigo, mais escuro, o verniz mais amarelado e o craquelê na tinta. Ficam todos no Salão Principal, em
  ordem, circulando as paredes.
- `pintura_mestre` (~1 a ~5): a tela de mestre a óleo (1,6 x 1,2 m) em moldura de museu dourada: a marinha na tempestade,
  a paisagem dourada, a natureza-morta de flores no escuro, o lago com as ninfeias, o canal ao entardecer. Telas inventadas,
  sem copiar obra nem artista de verdade. As de luz têm a luminária de latão em cima.
- `tela_abstrata` (~1 a ~3): a tela moderna grande (2,2 x 1,5 m) na moldura preta fina: os campos de cor, o geométrico
  e o gestual.

Pixel art 1:1 só por código, com a moldura e a sombra na parede do mansao_conforto.py e do parede_casa.py. O desenho
põe o item na parede de trás (o plano y = 0, saindo para +y), centrado em (xc, zc).
"""
import math

import numpy as np

import base_estilo as BE
import parede_casa as PC
import mansao_conforto as MC
from base_estilo import hx, liso, _tom, PH, PZ
from motor import ruido, KX, KZ

cx, C = MC.cx, MC.C
ouro, OURO, OURO_L = MC.ouro, MC.OURO, MC.OURO_L
hexn = MC.hexn


def _ruido(pl, sal, esc=1.0):
    return ruido(np.floor(pl.u / esc), np.floor(pl.w / esc), sal)


def _misturar(pl, m, cor, t):
    """Puxa os pixels de m para a cor, de t (0 a 1)."""
    m = m & pl.dentro
    pl.rgb[m] = pl.rgb[m] * (1 - t) + hx(cor)[None, :] * t


# =====================================================================================================================
# a idade da tela e a luz de quadro
# =====================================================================================================================
def envelhecido(pintor, idade, sal=0.0):
    """A tela antiga: o verniz amarelado, mais escura e com o craquelê (idade de 0, nova, a 1, a mais antiga)."""
    def p(pl, W, H):
        pintor(pl, W, H)
        if idade <= 0:
            return
        m = pl.dentro
        rgb = pl.rgb[m]
        amb = hx('#b08a48')[None, :]
        rgb = rgb * (1 - 0.22 * idade) + amb * 0.22 * idade
        pl.rgb[m] = rgb * (1 - 0.14 * idade)
        # o craquelê: as rachaduras finas, de leve, e só fora do rosto (o meio de cima da tela), para não sujar a cara
        a = _ruido(pl, 11.3 + sal, 2.0)
        rosto = (np.abs(pl.u - W / 2) < W * 0.24) & (pl.w > H * 0.12) & (pl.w < H * 0.6)
        rach = m & ~rosto & (a > 1 - 0.035 * idade)
        pl.rgb[rach] = pl.rgb[rach] * 0.86
    return p


def com_luz(pintor, forca=0.2):
    """A luz quente da luminária de quadro: o terço de cima da tela mais claro, se apagando para baixo."""
    def p(pl, W, H):
        pintor(pl, W, H)
        m = pl.dentro
        k = np.clip(1 - pl.w / (H * 0.7), 0, 1)[m]
        rgb = pl.rgb[m]
        quente = hx('#ffe0a0')[None, :]
        pl.rgb[m] = np.clip(rgb * (1 + forca * k[:, None]) * (1 - 0.06 * k[:, None]) + quente * 0.06 * k[:, None], 0, 255)
    return p


def luminaria(xc, z1, larg):
    """A luminária de latão em cima do quadro: o braço que sai da parede e a calha comprida virada para a tela."""
    zb = z1 + 0.05
    cx((xc - 0.035, xc + 0.035, 0.0, 0.03, zb, zb + 0.1), ouro(), ch=0.004)
    cx((xc - 0.012, xc + 0.012, 0.0, 0.08, zb + 0.06, zb + 0.085), ouro(), contorno=False)
    cx((xc - larg / 2, xc + larg / 2, 0.06, 0.11, zb + 0.03, zb + 0.075), {'*': ouro(), 'cima': liso(OURO_L), 'frente': liso('#e2c058')}, ch=0.006)


# =====================================================================================================================
# as molduras
# =====================================================================================================================
def quadro_moderno(x0, x1, z0, z1, pintor, e=0.035, fundo=0.05):
    """O quadro moderno: a tela na moldura preta fina, sem enfeite (a caixa de galeria)."""
    n0 = len(C().objs)
    ez = e * KX / KZ
    pl = PC.Pl(x0 + e - PH, x1 - e + PH, z0 + ez - PZ, z1 - ez + PZ, 0.015)
    W, H = (x1 - x0 - 2 * e) * KX, (z1 - z0 - 2 * ez) * KZ
    pl.u, pl.w = pl.u - 1, pl.w - 1
    pintor(pl, W, H)
    m = pl.opaco()
    pl.rgb[m & (pl.w < 1)] = _tom(pl.rgb[m & (pl.w < 1)], 0.7)
    pl.rgb[m & (pl.u < 1)] = _tom(pl.rgb[m & (pl.u < 1)], 0.76)
    pl.grava()
    PC.moldura(x0, x1, z0, z1, e, fundo, PC.MOL_PRETA)
    PC.sombra_parede(n0, 1, 2)


# =====================================================================================================================
# os retratos da família (todos ruivos), do fundador aos netos
# =====================================================================================================================
def _roupa_terno_claro(pl, W, H, cu, hy, rx, ry, sh):
    """O terno claro de linho (o fundador): a camisa, a gravata escura e o lenço no bolso."""
    pl.pin(pl.poli([(cu - 4.6, sh - 1), (cu + 4.6, sh - 1), (cu, sh + 12)]), '#f4efe2')
    pl.pin(pl.poli([(cu - 11, sh + 1), (cu - 4.6, sh - 1), (cu - 1, sh + 12), (cu - 5, sh + 18), (cu - 12, sh + 6)]), '#d8ccae')
    pl.pin(pl.poli([(cu + 11, sh + 1), (cu + 4.6, sh - 1), (cu + 1, sh + 12), (cu + 5, sh + 18), (cu + 12, sh + 6)]), '#b8ac8e')
    pl.pin(pl.poli([(cu - 1.2, sh + 0.5), (cu + 1.2, sh + 0.5), (cu + 1.4, sh + 11), (cu, sh + 12.4), (cu - 1.4, sh + 11)]), '#2a2420')
    pl.pin(pl.ret(cu - 11, sh + 8, cu - 8, sh + 9.4), '#8a2a2a')


def _roupa_moca(pl, W, H, cu, hy, rx, ry, sh):
    """O blazer da moça de hoje: a blusa clara em V e o colarzinho de ouro."""
    pl.pin(pl.poli([(cu - 4.4, sh - 1), (cu + 4.4, sh - 1), (cu, sh + 9)]), '#f2ece2')
    pl.pin(pl.poli([(cu - 11, sh + 1), (cu - 4.4, sh - 1), (cu - 0.8, sh + 10), (cu - 5, sh + 16), (cu - 12, sh + 6)]), '#2a5a4a')
    pl.pin(pl.poli([(cu + 11, sh + 1), (cu + 4.4, sh - 1), (cu + 0.8, sh + 10), (cu + 5, sh + 16), (cu + 12, sh + 6)]), '#1c4436')
    for k in range(7):
        a = math.pi * (0.15 + 0.7 * k / 6)
        pl.pin(pl.ret(cu - 3.4 * math.cos(a) - 0.5, sh + 1.6 + 2.6 * math.sin(a) - 0.5, cu - 3.4 * math.cos(a) + 0.5, sh + 1.6 + 2.6 * math.sin(a) + 0.5), '#e8c860')


def _cabelo_moca(pl, W, H, cu, hy, rx, ry):
    """O cabelo ruivo longo e solto, caindo pelos ombros."""
    c, esc, cla = '#c4521e', '#8e3812', '#e8783a'
    m = pl.elipse(cu, hy - 1.0, rx + 1.4, ry + 1.0) & (pl.w < hy - ry * 0.2)
    lados = pl.poli([(cu - rx - 1.6, hy - ry * 0.3), (cu - rx + 1.0, hy - ry * 0.3), (cu - rx + 0.6, hy + ry * 2.4), (cu - rx - 3.4, hy + ry * 2.8)]) | \
        pl.poli([(cu + rx - 1.0, hy - ry * 0.3), (cu + rx + 1.6, hy - ry * 0.3), (cu + rx + 3.4, hy + ry * 2.8), (cu + rx - 0.6, hy + ry * 2.4)])
    pl.pin(m | lados, c)
    pl.pin((m | lados) & (pl.u > cu + rx * 0.3), esc)
    pl.pin(pl.seg((cu - rx + 0.4, hy - 2), (cu - 1.5, hy - ry + 0.6), 1.0), cla)
    pl.pin(pl.seg((cu - rx - 1.6, hy + 2), (cu - rx - 2.4, hy + ry * 2.2), 1.0), cla)


def _cabelo_grisalho(pl, W, H, cu, hy, rx, ry):
    """O ruivo já ralo e desbotado do avô, com a barba aparada."""
    c, esc = '#a8603a', '#7a4024'
    m = pl.elipse(cu, hy - 0.6, rx + 0.6, ry + 0.5) & (pl.w < hy - ry * 0.4)
    pl.pin(m, c)
    pl.pin(m & (pl.u > cu + rx * 0.4), esc)
    pl.pin(m & (pl.u < cu - rx * 0.3) & (pl.w < hy - ry * 0.65), '#d8a888')
    pl.pin(pl.ret(cu - rx - 0.6, hy - ry * 0.5, cu - rx + 0.8, hy + 0.6), c)
    pl.pin(pl.ret(cu + rx - 0.8, hy - ry * 0.5, cu + rx + 0.6, hy + 0.6), esc)
    b = pl.elipse(cu, hy + ry * 0.45, rx * 0.8, ry * 0.6) & (pl.w > hy + 2.6)
    pl.pin(b, c)
    pl.pin(b & (pl.u > cu + rx * 0.2), esc)
    pl.pin(pl.ret(cu - 1.6, hy + 4.6, cu + 1.6, hy + 5.4), '#7a3a32')


B = MC
# (a pintura, a idade da tela): do mais antigo ao mais novo
RETRATOS = {
    # 1. o fundador: o terno claro de linho, a barba, os olhos cansados
    1: (dict(fundo='#1e1a18', pele='#d8b08a', roupa='#d8ccae', cabelo='#b8704a', sobr='#9a5634', roupa_fn=_roupa_terno_claro,
             cabelo_fn=B._cabelo_homem_barba, boca_fn=B._boca_vazia), 1.0),
    # 2. a mulher do fundador: a gola alta e as pérolas
    2: (dict(fundo='#30282a', pele='#e4c0a0', roupa='#2a2228', cabelo='#a8481c', sobr='#8a3a16', roupa_fn=B._roupa_mulher,
             cabelo_fn=B._cabelo_mulher, boca_fn=B._boca('#9a4048', 1.7), rx=7.4), 0.9),
    # 3. o filho do fundador: o terno escuro e o bigode
    3: (dict(fundo='#2c3a30', pele='#dcb490', roupa='#202430', cabelo='#8a3418', sobr='#7a2e16', roupa_fn=B._roupa_homem30,
             cabelo_fn=B._cabelo_homem30, boca_fn=B._boca_bigode), 0.75),
    # 4. a mulher dele, de outra época
    4: (dict(fundo='#5a2a38', pele='#e8c4a4', roupa='#2c2a46', cabelo='#b84e1e', sobr='#9a4018', roupa_fn=B._roupa_mulher,
             cabelo_fn=B._cabelo_mulher, boca_fn=B._boca('#a8404a', 1.8), rx=7.4), 0.58),
    # 5. o avô: a casaca e a corrente do relógio, a barba cheia
    5: (dict(fundo='#4a3624', pele='#d4aa86', roupa='#16161c', cabelo='#a85a36', sobr='#94502e', roupa_fn=B._roupa_homem_barba,
             cabelo_fn=B._cabelo_homem_barba, boca_fn=B._boca_vazia), 0.45),
    # 6. a avó
    6: (dict(fundo='#2a4038', pele='#ecc8a8', roupa='#3a2a40', cabelo='#c0582a', sobr='#a04a20', roupa_fn=B._roupa_mulher,
             cabelo_fn=B._cabelo_mulher, boca_fn=B._boca('#b04a50', 1.8), rx=7.4), 0.3),
    # 7. o pai, já grisalho no ruivo (o terno escuro, a barba aparada)
    7: (dict(fundo='#344050', pele='#e0b894', roupa='#1c2440', cabelo='#a8603a', sobr='#8a4a2c', roupa_fn=B._roupa_homem30,
             cabelo_fn=_cabelo_grisalho, boca_fn=B._boca_vazia), 0.14),
    # 8. o menino (o paletó azul e a gravata vermelha)
    8: (dict(fundo='#344a60', pele='#ecc4a0', roupa='#2a3254', cabelo='#d0682a', sobr='#b05424', roupa_fn=B._roupa_menino,
             cabelo_fn=B._cabelo_menino, boca_fn=B._boca_menino, rx=7.8, ry=9.4), 0.03),
    # 9. a moça (o blazer verde, o cabelo solto)
    9: (dict(fundo='#5a4a5a', pele='#f0ccac', roupa='#2a5a4a', cabelo='#c4521e', sobr='#a04a20', roupa_fn=_roupa_moca,
             cabelo_fn=_cabelo_moca, boca_fn=B._boca('#c05a5a', 1.6), rx=7.4), 0.0),
}


def retrato_familia(n=1, xc=1.5, zc=1.6):
    """O retrato da família (1,0 x 1,2 m na parede), na moldura dourada entalhada; envelhecido conforme a época."""
    cfg, idade = RETRATOS[n]
    w, h = 1.0, 1.2
    MC.quadro_ouro(xc - w / 2, xc + w / 2, zc - h / 2, zc + h / 2, envelhecido(MC._busto(cfg), idade, sal=n * 3.1), e=0.075, fundo=0.06,
                   coroa=idade >= 0.7)


# =====================================================================================================================
# as telas de mestre (1,6 x 1,2 m)
# =====================================================================================================================
def _bandas(pl, m, w0, w1, cores):
    n = len(cores)
    for k, c in enumerate(cores):
        a = w0 + (w1 - w0) * k / n
        b = w0 + (w1 - w0) * (k + 1) / n
        pl.pin(m & (pl.w >= a) & (pl.w < b), c)


def p_marinha(pl, W, H):
    """A marinha na tempestade: o céu de chumbo que se abre num rasgo de luz, o mar alto de espuma, o veleiro adernado."""
    t = pl.dentro
    hz = H * 0.52
    _bandas(pl, t, 0, hz + 1, ['#1c2228', '#232a32', '#2a333c', '#343e46', '#3e4a50', '#4c5a5a', '#5a6a66'])
    # o rasgo de luz no céu (à direita) e os raios descendo para o mar
    luz = pl.elipse(W * 0.72, H * 0.2, W * 0.2, H * 0.1)
    pl.pin(luz, '#8a8a70')
    pl.pin(pl.elipse(W * 0.74, H * 0.2, W * 0.11, H * 0.05), '#c8b886')
    pl.pin(pl.elipse(W * 0.75, H * 0.2, W * 0.05, H * 0.025), '#f0dca0')
    for k in range(3):
        pl.pin(pl.seg((W * (0.66 + 0.06 * k), H * 0.26), (W * (0.6 + 0.1 * k), hz), 1.0) & (_ruido(pl, 3 + k) > 0.35), '#7a7a64')
    # as nuvens escuras rolando
    for (a, b, r, s) in ((0.15, 0.12, 0.2, 0.09), (0.4, 0.08, 0.18, 0.07), (0.3, 0.3, 0.22, 0.08), (0.92, 0.36, 0.14, 0.07)):
        pl.pin(pl.elipse(W * a, H * b, W * r, H * s), '#161a20')
        pl.pin(pl.elipse(W * a - 1, H * b - 1.5, W * r * 0.8, H * s * 0.5), '#2e363e')
    # o mar: o verde-escuro em ondas, as cristas de espuma
    mar = t & (pl.w >= hz)
    pl.pin(mar, '#1a2a2a')
    ond = np.sin(pl.u * 0.45 + pl.w * 0.9) + np.sin(pl.u * 0.17 - pl.w * 0.5)
    pl.pin(mar & (ond > 0.9), '#2a4440')
    pl.pin(mar & (ond > 1.5), '#3e5e56')
    esp = mar & (ond > 1.75) & (_ruido(pl, 7.7) > 0.3)
    pl.pin(esp, '#c8d4c8')
    pl.pin(mar & (pl.w < hz + 2.5) & (pl.u > W * 0.55) & (pl.u < W * 0.9), '#6a7a68')
    # o veleiro adernado: o casco, os dois mastros, as velas
    xs, ys = W * 0.36, H * 0.66
    pl.pin(pl.poli([(xs - 9, ys - 2), (xs + 10, ys - 4.5), (xs + 7, ys + 1.5), (xs - 6, ys + 3)]), '#1a1210')
    pl.pin(pl.poli([(xs - 9, ys - 2), (xs + 10, ys - 4.5), (xs + 9.5, ys - 3.2), (xs - 8.5, ys - 0.8)]), '#5a3a22')
    for (dx, h) in ((-2, 19), (5, 15)):
        pl.pin(pl.seg((xs + dx, ys - 3), (xs + dx + 4, ys - 3 - h), 1.0), '#1a1210')
    pl.pin(pl.poli([(xs - 1, ys - 6), (xs + 3, ys - 21), (xs + 9, ys - 9)]), '#d8ccb0')
    pl.pin(pl.poli([(xs - 1, ys - 6), (xs + 3, ys - 21), (xs + 2, ys - 7)]), '#b0a488')
    pl.pin(pl.poli([(xs + 6, ys - 6), (xs + 9.5, ys - 17), (xs + 14, ys - 8)]), '#c8bc9e')
    pl.pin(t & (pl.w > ys + 1) & (pl.w < ys + 3.5) & (pl.u > xs - 12) & (pl.u < xs + 14) & (_ruido(pl, 9.1) > 0.4), '#e0e8dc')


def p_paisagem_dourada(pl, W, H):
    """A paisagem dourada: o trigal ao fim da tarde, os bosques, o caminho de terra e a vila branca no morro distante."""
    t = pl.dentro
    hz = H * 0.42
    _bandas(pl, t, 0, hz + 1, ['#7a9cb8', '#8eaec4', '#a6bec8', '#c0ccc4', '#d8d4b8', '#ead8a8', '#f4dc9c'])
    for (a, b, r, s) in ((0.2, 0.12, 0.16, 0.04), (0.55, 0.18, 0.2, 0.035), (0.85, 0.1, 0.12, 0.03)):
        pl.pin(pl.elipse(W * a, H * b, W * r, H * s), '#eef0ec')
        pl.pin(pl.elipse(W * a + 1, H * b + 1.2, W * r * 0.8, H * s * 0.5), '#d0d8dc')
    # o morro distante azulado com a vila
    morro = t & (pl.w > hz - 6 + 4 * np.sin(pl.u * 0.08)) & (pl.w <= hz + 2)
    pl.pin(morro, '#8a9a9a')
    pl.pin(morro & (pl.u > W * 0.5), '#7a8c8e')
    for k in range(6):
        u = W * (0.58 + 0.05 * k)
        w = hz - 4 + 4 * math.sin(u * 0.08) + (k % 2)
        pl.pin(pl.ret(u, w, u + 2.2, w + 1.6), '#f4f0e6')
        pl.pin(pl.ret(u, w - 1, u + 2.2, w), '#b85a3a')
    # o trigal em faixas de pinceladas douradas
    campo = t & (pl.w > hz + 2)
    pl.pin(campo, '#c8962c')
    r = _ruido(pl, 4.2, 1.0)
    pl.pin(campo & (r > 0.55), '#dcae40')
    pl.pin(campo & (r > 0.82), '#f0cc66')
    pl.pin(campo & (r < 0.18), '#a87420')
    pl.pin(campo & (pl.w > H * 0.8) & (r < 0.45), '#8a5e1c')
    # o caminho de terra que serpenteia até o morro
    for k in range(12):
        a = k / 11
        u = W * (0.25 + 0.25 * a) + 6 * math.sin(a * 4)
        w = H - (H - hz - 3) * a
        pl.pin(pl.elipse(u, w, 3.4 * (1 - a) + 0.8, 1.6 * (1 - a) + 0.5), '#d8c49a')
    # o bosque à esquerda (copas escuras com o lado da luz) e a árvore solitária à direita
    for (a, b, r, s) in ((0.04, 0.5, 0.12, 0.14), (0.14, 0.46, 0.1, 0.16), (0.24, 0.52, 0.08, 0.1)):
        m = pl.elipse(W * a, H * b, W * r, H * s)
        pl.pin(m, '#2a3a1e')
        pl.pin(m & (pl.u > W * a) & (pl.w < H * b), '#4a5a28')
    pl.pin(pl.ret(W * 0.82 - 0.6, H * 0.4, W * 0.82 + 0.6, H * 0.56), '#3a2a1a')
    m = pl.elipse(W * 0.82, H * 0.36, W * 0.07, H * 0.09)
    pl.pin(m, '#34421e')
    pl.pin(m & (pl.u > W * 0.82), '#56602a')


def p_flores_escuro(pl, W, H):
    """A natureza-morta de flores no escuro: o buquê farto num vaso de bronze, a mesa de pedra, o limão descascado."""
    t = pl.dentro
    pl.pin(t, '#100c0a')
    d = np.hypot((pl.u - W * 0.45) / W, (pl.w - H * 0.42) / H)
    pl.pin(t & (d < 0.32), '#1c1612')
    pl.pin(t & (d < 0.2), '#241c16')
    mesa = t & (pl.w > H * 0.78)
    pl.pin(mesa, '#3a2e24')
    pl.pin(mesa & (pl.w < H * 0.8), '#6a5a44')
    pl.pin(mesa & (pl.w > H * 0.9), '#22180e')
    # o vaso de bronze
    vu, vw = W * 0.46, H * 0.66
    pl.pin(pl.elipse(vu, vw, W * 0.08, H * 0.11), '#5a3e1c')
    pl.pin(pl.elipse(vu - 1.2, vw - 1.5, W * 0.04, H * 0.06), '#8a6a32')
    pl.pin(pl.ret(vu - W * 0.05, vw - H * 0.16, vu + W * 0.05, vw - H * 0.09), '#4a3216')
    pl.pin(pl.ret(vu - W * 0.06, vw + H * 0.09, vu + W * 0.06, H * 0.79), '#3a2810')
    # as folhas e as flores (as rosas, as tulipas listradas, as brancas), com a luz da esquerda
    for (a, b, rr, s) in ((0.28, 0.36, 0.08, 0.05), (0.62, 0.3, 0.09, 0.05), (0.36, 0.5, 0.07, 0.04), (0.58, 0.48, 0.07, 0.05), (0.46, 0.2, 0.05, 0.06)):
        pl.pin(pl.elipse(W * a, H * b, W * rr, H * s), '#1e2e16')
        pl.pin(pl.elipse(W * a - 1, H * b - 1, W * rr * 0.6, H * s * 0.5), '#34482a')
    flores = [(0.46, 0.28, '#e8e0d0'), (0.36, 0.32, '#c0283a'), (0.56, 0.36, '#e86a7a'), (0.42, 0.42, '#f4d070'), (0.5, 0.18, '#c0283a'),
              (0.3, 0.44, '#f0ece0'), (0.62, 0.42, '#a01e30'), (0.4, 0.24, '#e8a0a8'), (0.54, 0.26, '#f4e8d8'), (0.66, 0.3, '#f0b04a')]
    for (a, b, cor) in flores:
        MC._esfera(pl, W * a, H * b, W * 0.045, cor, rz=H * 0.05, spec=False)
    # a tulipa listrada caída, o limão com a casca em espiral
    pl.pin(pl.seg((W * 0.66, H * 0.76), (W * 0.8, H * 0.72), 1.0), '#2e4a24')
    MC._esfera(pl, W * 0.8, H * 0.71, W * 0.03, '#d84a5a', rz=H * 0.035, spec=False)
    MC._esfera(pl, W * 0.22, H * 0.75, W * 0.05, '#e8c43a', rz=H * 0.04)
    pl.pin(pl.seg((W * 0.26, H * 0.77), (W * 0.32, H * 0.84), 1.0), '#f0d870')


def p_ninfeias(pl, W, H):
    """O lago com as ninfeias, de pinceladas soltas: a água azul e violeta, as folhas redondas, as flores rosadas."""
    t = pl.dentro
    pl.pin(t, '#3a5a7a')
    r = _ruido(pl, 2.6, 1.0)
    r2 = _ruido(pl, 8.4, 2.0)
    pl.pin(t & (r > 0.5), '#4a6c8a')
    pl.pin(t & (r > 0.78), '#6a8aa4')
    pl.pin(t & (r2 > 0.7), '#5a5a8a')
    pl.pin(t & (r2 < 0.18), '#2a4460')
    # o reflexo do céu: as faixas claras na vertical
    for a in (0.18, 0.47, 0.8):
        pl.pin(t & (np.abs(pl.u - W * a) < 2.5) & (r > 0.4), '#a8c0cc')
    # as folhas (elipses deitadas, verdes) com as flores
    folhas = [(0.15, 0.25, 0.09), (0.4, 0.15, 0.07), (0.7, 0.22, 0.1), (0.25, 0.55, 0.11), (0.58, 0.5, 0.09), (0.85, 0.6, 0.08), (0.12, 0.82, 0.1),
              (0.45, 0.8, 0.12), (0.78, 0.86, 0.09)]
    for k, (a, b, s) in enumerate(folhas):
        m = pl.elipse(W * a, H * b, W * s, W * s * 0.4)
        pl.pin(m, '#3a6a3a')
        pl.pin(m & (pl.u < W * a), '#5a8a44')
        pl.pin(m & (_ruido(pl, 5 + k) > 0.8), '#2a4a2a')
        if k % 2 == 0:
            pl.pin(pl.elipse(W * a + 1, H * b - 1, 2.2, 1.4), '#f0a0b8')
            pl.pin(pl.elipse(W * a + 0.6, H * b - 1.4, 1.0, 0.7), '#fce0e8')


def p_canal(pl, W, H):
    """O canal ao entardecer: o céu de pêssego e rosa, os palácios dos dois lados com as janelas acesas, a gôndola."""
    t = pl.dentro
    hz = H * 0.56
    _bandas(pl, t, 0, hz + 1, ['#4a3a6a', '#6a4a7a', '#9a5a7a', '#c8707a', '#e8907a', '#f4b07a', '#f8cc8a'])
    # os palácios: as fachadas em silhueta quente, as janelas acesas, as cúpulas ao fundo
    pl.pin(pl.elipse(W * 0.52, hz - H * 0.12, W * 0.06, H * 0.08) & (pl.w < hz - H * 0.1), '#6a4a5a')
    pl.pin(pl.ret(W * 0.52 - 0.6, hz - H * 0.24, W * 0.52 + 0.6, hz - H * 0.18), '#6a4a5a')
    for (u0, u1, top, cor) in ((0.0, 0.18, 0.18, '#5a3a3a'), (0.18, 0.32, 0.3, '#7a4a42'), (0.72, 0.84, 0.26, '#6a3e3a'), (0.84, 1.0, 0.14, '#4a2e30')):
        m = pl.ret(W * u0, H * top, W * u1, hz + 1)
        pl.pin(m, cor)
        for jw in np.arange(H * top + 3, hz - 2, 5):
            for ju in np.arange(W * u0 + 2, W * u1 - 2, 4):
                if ruido(np.array([ju]), np.array([jw]), 3.3)[0] > 0.35:
                    pl.pin(pl.ret(ju, jw, ju + 1.4, jw + 2.2), '#f8d880')
    # a água: o reflexo das cores do céu, quebrado em faixas
    agua = t & (pl.w > hz)
    pl.pin(agua, '#3a3048')
    r = _ruido(pl, 6.6, 1.0)
    pl.pin(agua & (pl.u > W * 0.32) & (pl.u < W * 0.72) & (r > 0.4), '#c87a7a')
    pl.pin(agua & (pl.u > W * 0.4) & (pl.u < W * 0.64) & (r > 0.7), '#f4b07a')
    pl.pin(agua & ((pl.u < W * 0.32) | (pl.u > W * 0.72)) & (r > 0.75), '#7a5a4a')
    # a gôndola com o gondoleiro
    gu, gw = W * 0.42, H * 0.76
    pl.pin(pl.poli([(gu - 10, gw - 2), (gu + 10, gw - 3), (gu + 7, gw + 0.6), (gu - 7, gw + 1)]), '#140e0e')
    pl.pin(pl.seg((gu + 4, gw - 3), (gu + 5, gw - 10), 1.0), '#140e0e')
    pl.pin(pl.elipse(gu + 5, gw - 11, 0.9, 0.9), '#140e0e')
    pl.pin(pl.seg((gu + 6, gw - 8), (gu + 1, gw + 1), 1.0), '#2a1e1a')


PINTURAS = {1: (p_marinha, True), 2: (p_paisagem_dourada, False), 3: (p_flores_escuro, True), 4: (p_ninfeias, False), 5: (p_canal, True)}


def pintura_mestre(n=1, xc=1.5, zc=1.6):
    """A tela de mestre (1,6 x 1,2 m) na moldura de museu dourada; as de luz, com a luminária de latão em cima."""
    pintor, luz = PINTURAS[n]
    w, h = 1.6, 1.2
    z1 = zc + h / 2
    MC.quadro_ouro(xc - w / 2, xc + w / 2, zc - h / 2, z1, envelhecido(com_luz(pintor) if luz else pintor, 0.12, sal=n), e=0.085, fundo=0.065,
                   coroa=not luz)
    if luz:
        luminaria(xc, z1, w * 0.62)


# =====================================================================================================================
# as telas abstratas (2,2 x 1,5 m)
# =====================================================================================================================
def p_campos(pl, W, H):
    """Os campos de cor: o azul-noite profundo e o ocre que se encontram numa borda macia na diagonal, e o fio de ouro."""
    t = pl.dentro
    diag = pl.u / W + pl.w / H * 0.6
    r = _ruido(pl, 1.9, 1.0)
    pl.pin(t, '#c88a2a')
    pl.pin(t & (diag < 0.78 + 0.05 * r), '#14204a')
    pl.pin(t & (diag >= 0.7) & (diag < 0.84) & (r > 0.5), '#3a3a50')
    pl.pin(t & (diag < 0.5) & (r > 0.7), '#1c2a5a')
    pl.pin(t & (diag > 1.1) & (r > 0.65), '#d89a38')
    pl.pin(t & (diag > 1.25) & (r < 0.3), '#a86a1c')
    pl.pin(t & (np.abs(pl.u - W * 0.8) < 0.6), '#f0d070')


def p_geometrico(pl, W, H):
    """O geométrico: o fundo marfim, os círculos e os arcos sobrepostos em preto, ouro, turquesa e coral."""
    t = pl.dentro
    pl.pin(t, '#ece6d8')
    pl.pin(pl.elipse(W * 0.34, H * 0.46, H * 0.36, H * 0.36), '#16161a')
    pl.pin(pl.elipse(W * 0.34, H * 0.46, H * 0.26, H * 0.26), '#ece6d8')
    pl.pin(pl.elipse(W * 0.62, H * 0.4, H * 0.3, H * 0.3), '#2a8a8a')
    pl.pin(pl.elipse(W * 0.62, H * 0.4, H * 0.3, H * 0.3) & pl.elipse(W * 0.34, H * 0.46, H * 0.36, H * 0.36), '#c89a2a')
    pl.pin(pl.elipse(W * 0.78, H * 0.72, H * 0.16, H * 0.16), '#e8705a')
    pl.pin(pl.ret(W * 0.08, H * 0.82, W * 0.6, H * 0.86), '#16161a')
    pl.pin(pl.ret(W * 0.86, H * 0.08, W * 0.9, H * 0.6), '#c89a2a')
    pl.pin(pl.elipse(W * 0.16, H * 0.18, H * 0.06, H * 0.06), '#e8705a')


def p_gestual(pl, W, H):
    """O gestual: o fundo creme, as pinceladas largas e pretas varrendo a tela, os respingos vermelhos e dourados."""
    t = pl.dentro
    pl.pin(t, '#eee4cc')
    r = _ruido(pl, 3.4, 1.0)
    pl.pin(t & (r > 0.86), '#e0d4b8')
    for k, (a, b, c, d, larg) in enumerate(((0.05, 0.7, 0.55, 0.2, 3.2), (0.3, 0.9, 0.9, 0.35, 2.6), (0.5, 0.1, 0.7, 0.85, 2.2), (0.1, 0.3, 0.4, 0.45, 1.6))):
        pts = []
        for j in range(9):
            s = j / 8
            pts.append((W * (a + (c - a) * s), H * (b + (d - b) * s) + 3 * math.sin(s * 5 + k)))
        pl.pin(pl.linha(pts, larg), '#141214')
    r2 = _ruido(pl, 12.2, 1.0)
    r3 = _ruido(pl, 15.5, 2.0)
    pl.pin(t & (r2 > 0.955), '#b8202a')
    pl.pin(t & (r3 > 0.94) & (r2 < 0.5), '#d4a02a')
    pl.pin(pl.elipse(W * 0.66, H * 0.3, 3.0, 2.4), '#b8202a')
    pl.pin(pl.seg((W * 0.66, H * 0.34), (W * 0.665, H * 0.52), 1.0), '#b8202a')


ABSTRATAS = {1: (p_campos, True), 2: (p_geometrico, False), 3: (p_gestual, False)}


def tela_abstrata(n=1, xc=1.5, zc=1.6):
    """A tela abstrata grande (2,2 x 1,5 m) na moldura preta fina de galeria; a de campos de cor com a luminária."""
    pintor, luz = ABSTRATAS[n]
    w, h = 2.2, 1.5
    z1 = zc + h / 2
    quadro_moderno(xc - w / 2, xc + w / 2, zc - h / 2, z1, com_luz(pintor, 0.14) if luz else pintor)
    if luz:
        luminaria(xc, z1, w * 0.5)


ITENS_PAREDE = {}
for _n in RETRATOS:
    ITENS_PAREDE['retrato_familia' + ('' if _n == 1 else f'~{_n}')] = ((lambda n=_n: retrato_familia(n)), (1.5, 1.6))
for _n in PINTURAS:
    ITENS_PAREDE['pintura_mestre' + ('' if _n == 1 else f'~{_n}')] = ((lambda n=_n: pintura_mestre(n)), (1.5, 1.6))
for _n in ABSTRATAS:
    ITENS_PAREDE['tela_abstrata' + ('' if _n == 1 else f'~{_n}')] = ((lambda n=_n: tela_abstrata(n)), (1.5, 1.6))
