"""
Os estilos de CHÃO e PAREDE da MANSÃO ALBUQUERQUE (grupo E), em pixel art 1:1, só código: mansao_marmore (saguão e
corredores), mansao_nobre (salão, biblioteca, gabinete), mansao_claro (quartos), mansao_servico (cozinha e empregados),
mansao_estufa (jardim de inverno), mansao_banho (banheiros), mansao_jogos (sala de jogos), mansao_caverna (o mezanino da
Catarina), mansao_rustico (o anexo de pedra) e mansao_tabuas (o barracão: mesmo piso, parede de tábuas).

Mesmo formato do estilos.py: tudo no TEXEL (1 texel = 1 px da arte; 32 texels = 1 casa = 0,75 m; na parede 52,26 texels
por metro, o jogo corta a parede em 2,8 m = 146 texels), tudo PERIÓDICO em 128 texels (4 casas): a casa 3 emenda com a
casa 0. Rampas curtas, junta de 1 px, 1 px claro depois da junta e 1 px escuro antes da próxima, sem dither, sem
pixel solto. Os itens de parede (quadro, janela, espelho, lareira) vão por cima: a parede é calma, o detalhe é de
moldura, de listra e de friso, nunca de mancha miúda.
"""
import numpy as np

from estilos import (W, HP, _uv_chao, _uv_parede, _h, _ns, _rampa, _w, _g, g_tabuas, g_grade, g_espinha, g_fiadas,
                     g_bruta, vol_chao, vol_parede, cor_peca, veio, no_madeira, _mancha, moldura)
from base_estilo import hx, _tom
from motor import emissivo

TOPO = 146          # o alto da parede no jogo: 2,8 m


# =====================================================================================================================
# ferramentas
# =====================================================================================================================
def _colunas_rgb(lista, n=HP):
    """Uma tabela (altura -> cor) a partir de [(v0, cor_rgb), ...]: cada cor vale até o v0 da próxima."""
    tab = np.zeros((n, 3))
    for i, (v0, c) in enumerate(lista):
        v1 = lista[i + 1][0] if i + 1 < len(lista) else n
        tab[v0:v1] = c
    return tab


def _tab(tab, v):
    return tab[np.clip(v, 0, len(tab) - 1)]


def _fundo(n, cor):
    return np.tile(hx(cor), (n, 1))


def _veios(u, v, seed, fino=0.04, per_v=True, desl=0, per=32, gate=2, fase=0, amp=18):
    """
    Veios de mármore: linhas de 1 px que seguem as curvas de nível de (u + v + ruído): longas, finas e tortas, sem anel
    gordo. Periódico em 128 (per divide 128 e gate divide 128 / per). `desl` (número ou imagem) muda o veio de cada placa.
    """
    def d(a, b):
        return a + b + desl + amp * 2 * (_ns(a, b, 32, seed) * 0.7 + _ns(a, b, 16, seed + 5) * 0.3 - 0.5)
    l0, l1, l2 = np.floor(d(u, v) / per), np.floor(d(u - 1, v) / per), np.floor(d(u, v - 1) / per)
    lvl = np.maximum(l0, np.maximum(l1, l2))
    return ((l0 != l1) | (l0 != l2)) & ((lvl + fase) % gate == 0)


def _veios2(u, v, seed, fino=0.04, per_v=True, desl=0):
    """O veio secundário: outro campo, mais fino e mais curto (curvas de 16 em 16)."""
    return _veios(u, v, seed + 31, fino, per_v, desl + 40, per=16, gate=4, fase=1, amp=9)


def _cornija(base, v0):
    """A cornija de gesso (15 linhas a partir de v0): sombra embaixo, gola, filete, topo claro."""
    c = hx(base)
    k = [0.80, 0.92, 0.98, 1.04, 1.09, 0.86, 1.0, 1.05, 1.08, 1.12, 0.9, 1.06, 1.14, 1.2, 1.2]
    return [(v0 + i, _tom(c, x)) for i, x in enumerate(k)]


def _mottle(out, uu, v, seed, forca=0.03, limite=0.66):
    """Manchas de reboco em degraus (um degrau só, bem sutil)."""
    m = _mancha(uu, v, seed, per_v=False, grande=64, pequena=16, mix=0.7)
    out = _w(m > limite, _tom(out, 1 - forca), out)
    return _w(m < 0.28, _tom(out, 1 + forca * 0.8), out)


# =====================================================================================================================
# 1. MARMORE: o xadrez de mármore creme e grafite (a casa = uma lajota de 0,75 m)
# =====================================================================================================================
CR_P = _rampa(['#e2dac8', '#e6dfd0', '#ddd4c1'])
GF_P = _rampa(['#34343a', '#3b3b41', '#303036'])


def piso_marmore():
    def f(L, n, P):
        u, v = _uv_chao(P)
        u, v = u % W, v % W
        T = 32
        tu, tv = u // T, v // T
        claro = (tu + tv) % 2 == 0
        ids = tu * 4 + tv
        k = (_h(ids * 0.37, 1.3) * 3).astype(int) % 3
        out = np.where(claro[:, None], CR_P[k], GF_P[k])
        du = (_h(ids, 3.1) * 128).astype(int)
        dv = (_h(ids, 4.7) * 128).astype(int)
        # manchas grandes (um degrau) e os veios finos: cinza-acastanhado no creme, branco-azulado no grafite
        m = _mancha(u + du, v + dv, 61, grande=32, pequena=16)
        out = _w(m > 0.64, _tom(out, np.where(claro, 0.97, 1.16)), out)
        out = _w(m < 0.3, _tom(out, np.where(claro, 1.025, 0.9)), out)
        v1 = _veios(u, v, 71, desl=du) & (_h(ids, 5.5) < 0.85)
        v2 = _veios2(u, v, 81, desl=dv) & (_h(ids, 6.6) < 0.6)
        out = _w(v2 & claro, hx('#c2b8a2'), out)
        out = _w(v2 & ~claro, hx('#575963'), out)
        out = _w(v1 & claro, hx('#a89e88'), out)
        out = _w(v1 & ~claro, hx('#80838d'), out)
        gu, gv = u % T, v % T
        # o brilho do polimento: um risquinho diagonal de 3 px, em metade das lajotas
        br = (_h(ids, 7.7) > 0.45) & (gu + gv == 11) & (gu >= 5) & (gu <= 7)
        out = _w(br & claro, hx('#f7f2e6'), out)
        out = _w(br & ~claro, hx('#6a6c78'), out)
        # o volume da lajota: junta fina escura, o px claro depois, o escuro antes da próxima
        out = _w(((gu == 1) | (gv == 1)), _tom(out, np.where(claro, 1.045, 1.3)), out)
        out = _w(((gu == T - 1) | (gv == T - 1)), _tom(out, np.where(claro, 0.95, 0.8)), out)
        return _w((gu == 0) | (gv == 0), hx('#6e685b'), out)
    return emissivo(f)


MAR_CORN = _colunas_rgb(_cornija('#e9e1cd', 131))


def parede_marmore(eixo):
    ouro_tab = {128: '#7d5f1c', 129: '#b8902a', 130: '#e0c060'}

    def f(L, n, P):
        u, v = _uv_parede(P, eixo)
        uu = u % W
        out = _fundo(len(P), '#e3dac6')
        out = _mottle(out, uu, v, 41, 0.025)
        # as almofadas de moldura branca: um quadro de 2 px em relevo, o campo de dentro um tom abaixo
        a = uu % 32
        b = v
        x0, x1, y0, y1 = 3, 28, 25, 121
        dentro = (a >= x0) & (a <= x1) & (b >= y0) & (b <= y1)
        anel = dentro & ((a <= x0 + 1) | (a >= x1 - 1) | (b <= y0 + 1) | (b >= y1 - 1))
        campo = dentro & ~anel
        out = _w(campo, _tom(out, 0.955), out)
        out = _w(campo & ((b == y1 - 2) | (a == x0 + 2)), _tom(out, 0.86), out)
        out = _w(campo & ((b == y0 + 2) | (a == x1 - 2)), _tom(out, 1.06), out)
        br = _fundo(len(P), '#f1ecdf')
        br = _w(anel & ((b >= y1 - 1) | (a <= x0 + 1)), _fundo(len(P), '#fbf8ef'), br)
        br = _w(anel & ((b <= y0 + 1) | (a >= x1 - 1)) & ~((b >= y1 - 1) | (a <= x0 + 1)), _fundo(len(P), '#d6cdb7'), br)
        out = _w(anel, br, out)
        fora = ~dentro & (((a == x1 + 1) & (b >= y0) & (b <= y1 + 1)) | ((b == y0 - 1) & (a >= x0) & (a <= x1 + 1)))
        out = _w(fora, _tom(out, 0.88), out)
        # o rodapé alto de mármore creme (v < 17) com a capa
        mar = _fundo(len(P), '#dcd2bc')
        mm = _mancha(uu, v, 55, per_v=False, grande=32, pequena=16)
        mar = _w(mm > 0.62, _tom(mar, 0.97), mar)
        mar = _w(_veios(uu, v, 91, desl=(uu // 32) * 37), hx('#b9af96'), mar)
        mar = _w((uu % 32 == 0), _tom(mar, 0.86), mar)
        mar = _w((uu % 32 == 1), _tom(mar, 1.05), mar)
        out = _w(v < 17, mar, out)
        out = _w(v == 0, _tom(hx('#dcd2bc'), 0.7), out)
        out = _w(v == 14, _fundo(len(P), '#f1eadb'), out)
        out = _w(v == 15, _fundo(len(P), '#f8f3e6'), out)
        out = _w(v == 16, _tom(hx('#e3dac6'), 0.8), out)
        # o friso dourado e a cornija de gesso
        out = _w((v == 126) | (v == 127), _tom(hx('#e3dac6'), 0.84), out)
        for z, c in ouro_tab.items():
            out = _w(v == z, hx(c), out)
        out = _w(v >= 131, _tab(MAR_CORN, v), out)
        return out
    return emissivo(f)


# =====================================================================================================================
# 2. NOBRE: parquet de nogueira em espinha de peixe; lambri escuro e damasco vinho
# =====================================================================================================================
NOB_P = _rampa(['#76503a', '#684631', '#815a42', '#5f3f2b', '#75503a', '#8a6046'])
NOB_J = hx('#2b1a10')


def piso_nobre():
    def f(L, n, P):
        u, v = _uv_chao(P)
        u, v = u % W, v % W
        G = _g('nob', lambda: g_espinha(8, 32))
        g = G.at(u, v)
        out = cor_peca(g, NOB_P, 4.1)
        ori = g.ori
        t = np.where(ori == 0, u, v)
        s = np.where(ori == 0, v, u) % 8
        lin = (s == 2 + (_h(g.ids % 997, 1.5) * 3).astype(int))
        seg = (t // 9) % 14
        out = _w(lin & (_h(g.ids % 997, seg, 2.5) < 0.6), _tom(out, 0.9), out)
        lin2 = (s == 6) & (_h(g.ids % 997, (t + 3) // 6 % 21, 3.5) < 0.4)
        out = _w(lin2, _tom(out, 1.07), out)
        # o brilho do verniz: faixas largas (um degrau), mais claras, que passam por várias peças
        m = _ns(u, v, 32, 17) * 0.6 + _ns(u, v, 64, 19) * 0.4
        out = _w(m > 0.6, _tom(out, 1.1), out)
        out = _w(m < 0.34, _tom(out, 0.94), out)
        return vol_chao(out, g, NOB_J, 1.1, 0.86)
    return emissivo(f)


NOB_CORN = _colunas_rgb(_cornija('#dcd2bd', 131))
LAMB = hx('#4a2c1c')
LAMB_Z = 62
LAMB_ALM = 40


def _damasco(uu, v):
    """O damasco: o ogee em coluna (o losango com o miolo vazado, folhas dos lados e o botão entre eles), meio-passo."""
    col = uu // 32
    cu = uu % 32
    cv = (v + 16 * (col % 2)) % 32
    x = np.abs(cu - 15.5)
    y = np.abs(cv - 15.5)
    corpo = (x / 6.5 + y / 12.5) <= 1
    furo = (x / 2.3 + y / 5.8) <= 1
    folha = (((x - 10.5) ** 2) / 9.0 + ((y - 4.5) ** 2) / 14.0) <= 1
    botao = ((x / 3.4) + ((15.5 - y) / 3.0)) <= 1
    haste = (x <= 0.6) & (y > 11.5)
    return (corpo & ~furo) | folha | botao | haste


def parede_nobre(eixo):
    def f(L, n, P):
        u, v = _uv_parede(P, eixo)
        uu = u % W
        base = hx('#5a1a24')
        alto = hx('#6e2431')
        fino = hx('#7c2c3a')
        pad = _damasco(uu, v)
        out = _w(pad, alto, np.tile(base, (len(P), 1)))
        cima = pad & ~_damasco(uu, v + 1)
        out = _w(cima, fino, out)
        out = _w((v > 120), _tom(out, 0.96), out)
        out = _w((v > 126), _tom(out, 0.95), out)
        # o lambri: quadro de 3 px, almofada com chanfro claro e escuro
        pw = 32
        a = uu % pw
        b = v - 8
        quadro = np.tile(LAMB, (len(P), 1))
        dentro = (a >= 4) & (a < pw - 3) & (b >= 4) & (b < LAMB_ALM)
        alm = _tom(LAMB, 1.1)
        lam = _w(dentro, alm, quadro)
        lam = _w(dentro & ((b == LAMB_ALM - 1) | (a == 4)), _tom(LAMB, 0.78), lam)
        lam = _w(dentro & ((b == 4) | (a == pw - 4)), _tom(LAMB, 1.28), lam)
        lam = _w(~dentro & (a == 1) & ((v // 6) % 3 != 0), _tom(LAMB, 0.9), lam)
        lam = _w(~dentro & (a >= 4) & ((b == 1) | (b == LAMB_ALM + 2)) & (((uu + v) // 7) % 3 != 0), _tom(LAMB, 0.9), lam)
        lam = _w(dentro & (b % 7 == 3) & (((uu // 5) + (b // 7)) % 3 != 0), _tom(alm, 0.93), lam)
        lam = _w(a == 0, _tom(LAMB, 0.7), lam)
        lam = _w(a == pw - 1, _tom(LAMB, 1.1), lam)
        rod = np.tile(_tom(LAMB, 0.82), (len(P), 1))
        rod = _w(v == 7, _tom(LAMB, 1.2), rod)
        rod = _w(v == 0, _tom(LAMB, 0.6), rod)
        lam = _w(v < 8, rod, lam)
        out = _w(v < LAMB_Z, lam, out)
        out = moldura(out, v, LAMB_Z, '#5a3520', 4)
        out = _w(v == 128, _fundo(len(P), '#a07a24'), out)
        out = _w(v == 129, _fundo(len(P), '#c9a23c'), out)
        out = _w(v == 130, _fundo(len(P), '#e0c060'), out)
        out = _w(v >= 131, _tab(NOB_CORN, v), out)
        return out
    return emissivo(f)


# =====================================================================================================================
# 3. CLARO: carvalho claro em tábuas largas; papel de listras finas marfim, rodapé branco alto
# =====================================================================================================================
CLA_P = _rampa(['#bda583', '#b69d7b', '#c4ad8c', '#af9674', '#c0a888'])
CLA_J = hx('#6a5238')


def piso_claro():
    def f(L, n, P):
        u, v = _uv_chao(P)
        u, v = u % W, v % W
        larg = 16
        g = _g('cla', lambda: g_tabuas(larg, 64, 29)).at(u, v)
        out = cor_peca(g, CLA_P, 6.2)
        out = veio(out, u, v, g, larg, 33, None, 0.92, 1.05)
        fila = (v // larg) % (W // larg)
        gs = v % larg
        seg = ((u + (_h(fila, 3.3) * 20).astype(int)) // 20) % 7
        out = _w((gs == 11) & (_h(fila, seg, 4.4) < 0.5) & ~g.j, _tom(out, 0.94), out)
        out = _w((gs == 5) & (_h(fila, seg, 5.5) < 0.35) & ~g.j, _tom(out, 1.05), out)
        out = no_madeira(out, u, v, g, larg, 37, 0.13)
        m = _mancha(u, v, 83)
        out = _w(m > 0.66, _tom(out, 0.965), out)
        out = _w(m < 0.3, _tom(out, 1.03), out)
        out = _w((g.pos >= 4) & (g.pos <= 6) & (gs == 3) & (_h(g.ids * 0.31, 8.8) > 0.55) & ~g.j, _tom(out, 1.1), out)
        return vol_chao(out, g, CLA_J, 1.06, 0.92)
    return emissivo(f)


CLA_CORN = _colunas_rgb(_cornija('#ece5d3', 131))


def parede_claro(eixo):
    def f(L, n, P):
        u, v = _uv_parede(P, eixo)
        uu = u % W
        out = _fundo(len(P), '#ddd5c3')
        out = _mottle(out, uu, v, 47, 0.02, 0.7)
        # as listras finas: a risca de 1 px mais escura, o px claro ao lado; a listra larga a cada 32 px
        s = uu % 8
        out = _w(s == 0, _fundo(len(P), '#c9bfa8'), out)
        out = _w(s == 1, _tom(out, 1.03), out)
        larga = (uu % 32 >= 14) & (uu % 32 <= 17)
        out = _w(larga & (s != 0), _tom(out, 1.025), out)
        out = _w((v > 118), _tom(out, 0.97), out)
        rod = _fundo(len(P), '#f1ede2')
        a = uu % 32
        alm = (a >= 4) & (a <= 27) & (v >= 3) & (v <= 9)
        rod = _w(alm, _tom(hx('#f1ede2'), 0.96), rod)
        rod = _w(alm & ((v == 9) | (a == 4)), _tom(hx('#f1ede2'), 0.84), rod)
        rod = _w(alm & ((v == 3) | (a == 27)), _fundo(len(P), '#fbf9f2'), rod)
        out = _w(v < 15, rod, out)
        out = _w(v == 0, _fundo(len(P), '#b8b2a2'), out)
        out = _w(v == 14, _fundo(len(P), '#fdfbf5'), out)
        out = _w(v == 15, _fundo(len(P), '#e8e2d2'), out)
        out = _w(v == 16, _tom(hx('#ddd5c3'), 0.8), out)
        out = _w(v == 17, _tom(hx('#ddd5c3'), 0.92), out)
        out = _w((v >= 124) & (v <= 126), _fundo(len(P), '#f1ede2'), out)
        out = _w(v == 124, _fundo(len(P), '#c4bcaa'), out)
        out = _w(v == 126, _fundo(len(P), '#fdfbf5'), out)
        out = _w(v == 127, _tom(hx('#ddd5c3'), 0.8), out)
        out = _w(v >= 131, _tab(CLA_CORN, v), out)
        return out
    return emissivo(f)


# =====================================================================================================================
# 4. SERVICO: ladrilho hidráulico branco e verde-água; azulejo metrô até 1,5 m, faixa azul-petróleo, reboco caiado
# =====================================================================================================================
SB_P = _rampa(['#e6e2d6', '#e1ddd0', '#eae6da'])
SA_P = _rampa(['#76a09c', '#6e9894', '#7eaaa5'])


def piso_servico():
    def f(L, n, P):
        u, v = _uv_chao(P)
        u, v = u % W, v % W
        T = 16
        g = _g('ser', lambda: g_grade(T, T)).at(u, v)
        gu, gv = u % T, v % T
        claro = ((u // T) + (v // T)) % 2 == 0
        k = (_h(g.ids * 0.37, 2.3) * 3).astype(int) % 3
        out = np.where(claro[:, None], SB_P[k], SA_P[k])
        # o desenho de cada ladrilho: o filete 2 px para dentro e o losango no meio, na cor do vizinho
        dd = np.maximum(np.abs(gu - 7.5), np.abs(gv - 7.5))
        fil = (dd >= 5.5) & (dd <= 5.5)
        out = _w(fil & claro, SA_P[k], out)
        out = _w(fil & ~claro, SB_P[k], out)
        los = (np.abs(gu - 7.5) + np.abs(gv - 7.5)) <= 3.5
        out = _w(los & claro, SA_P[k], out)
        out = _w(los & ~claro, SB_P[k], out)
        m = _mancha(u, v, 91, grande=32, pequena=16)
        out = _w(m > 0.7, _tom(out, 0.97), out)
        return vol_chao(out, g, hx('#8f9d98'), 1.05, 0.94)
    return emissivo(f)


SER_CORN = _colunas_rgb([(138, _tom(hx('#e9e4d6'), 0.78)), (139, _tom(hx('#e9e4d6'), 0.94)), (140, hx('#2f5f68')),
                         (141, hx('#f6f4ec')), (142, _tom(hx('#e9e4d6'), 0.86)), (143, _tom(hx('#e9e4d6'), 1.0)),
                         (144, _tom(hx('#e9e4d6'), 1.06)), (145, hx('#f6f4ec'))])


def parede_servico(eixo):
    def f(L, n, P):
        u, v = _uv_parede(P, eixo)
        uu = u % W
        g = _g('sv_az', lambda: g_grade(16, 8, H=HP, desloc=8)).at(uu, v)
        pal = _rampa(['#eceae2', '#e6e4db', '#f0eee6'])
        out = cor_peca(g, pal, 2.7)
        gv = v % 8
        meio = (uu + (v // 8 % 2) * 8) % 16
        sh = (_h(g.ids * 0.37, 3.1) > 0.5) & (gv == 5) & ((meio == 3) | (meio == 4))
        out = vol_parede(out, g, hx('#a6aaa1'), 1.05, 1.03, 0.93, 0.97)
        out = _w(sh, _tom(out, 1.1), out)
        # a faixa azul-petróleo: uma fiada (v 72..79), com o filete claro em cima e a capa de azulejo
        faixa = _rampa(['#2f5f68', '#2b5961', '#33656e'])
        fb = cor_peca(g, faixa, 4.4)
        fb = vol_parede(fb, g, hx('#1d3f46'), 1.12, 1.06, 0.88, 0.94)
        out = _w((v >= 72) & (v < 80), fb, out)
        out = _w((v == 80) | (v == 81), _fundo(len(P), '#f6f4ec'), out)
        out = _w(v == 82, _fundo(len(P), '#bdb9ac'), out)
        # o reboco caiado acima
        cal = _fundo(len(P), '#e9e4d6')
        cal = _mottle(cal, uu, v, 53, 0.02, 0.72)
        cal = _w(v > 120, _tom(cal, 0.97), cal)
        out = _w(v > 82, cal, out)
        out = _w(v == 83, _tom(hx('#e9e4d6'), 0.8), out)
        out = _w(v == 84, _tom(hx('#e9e4d6'), 0.92), out)
        out = _w(v >= 138, _tab(SER_CORN, v), out)
        return out
    return emissivo(f)


# =====================================================================================================================
# 5. ESTUFA: lajota de ardósia cinza-esverdeada com musgo nas juntas; reboco verde-claro e vidraças de ferro branco
# =====================================================================================================================
ES_P = _rampa(['#707a72', '#67716a', '#788278', '#5e6862', '#6c776d'])
MUSGO = _rampa(['#43603a', '#587a45', '#6f9250'])
ES_ALTS = [16, 24, 16, 16, 24, 16, 16]          # soma 128: as fiadas das lajotas


def piso_estufa():
    def f(L, n, P):
        u, v = _uv_chao(P)
        u, v = u % W, v % W
        g = _g('est', lambda: g_fiadas(16, 20, 40, 9, H=W, alts=ES_ALTS)).at(u, v)
        out = cor_peca(g, ES_P, 5.5)
        # os estratos da ardósia: riscas curtas ao longo da lajota
        est = (((v + (_h(g.ids * 0.17, 1.2) * 6).astype(int)) % 6) == 2) & (_h(g.ids * 0.31, 2.2) < 0.55) & ((u // 7 + g.ids) % 3 != 0)
        out = _w(est & ~g.j, _tom(out, 0.94), out)
        m = _mancha(u, v, 33, grande=32, pequena=16)
        out = _w(m > 0.66, _tom(out, 0.95), out)
        out = _w(m < 0.3, _tom(out, 1.04), out)
        out = vol_chao(out, g, hx('#1f2a22'), 1.09, 0.88)
        # o musgo: nas juntas e um texel para dentro, onde o ruído deixa (degraus, sem dither)
        mm = _ns(u, v, 16, 91) * 0.6 + _ns(u, v, 8, 93) * 0.4
        forte = g.j & (mm > 0.48)
        medio = (g.jl | g.jr | g.jd | g.ju) & (mm > 0.58)
        out = _w(forte, MUSGO[0], out)
        out = _w(medio & ~forte, MUSGO[1], out)
        out = _w((g.jl | g.jd) & (mm > 0.66) & ~forte, MUSGO[2], out)
        return out
    return emissivo(f)


FERRO = '#e6ebe4'


def parede_estufa(eixo):
    def f(L, n, P):
        u, v = _uv_parede(P, eixo)
        uu = u % W
        reb = hx('#d3dcd0')
        out = _fundo(len(P), '#d3dcd0')
        out = _mottle(out, uu, v, 59, 0.025, 0.62)
        out = _w(v < 8, _tom(reb, 0.86), out)
        out = _w(v == 8, _tom(reb, 1.12), out)
        out = _w(v == 7, _tom(reb, 0.7), out)
        # a vidraça: v 73..131, painéis de 32 x 28 com o caixilho de 2 px
        vid = (v >= 73) & (v <= 131)
        rel = v - 73
        cores = ['#17282a', '#1b2f31', '#203639', '#263e41', '#2c4749']
        k = np.clip(rel // 12, 0, 4)
        vidro = np.array([hx(c) for c in cores])[k]
        a = uu % 32
        b = (v - 73) % 28
        # o reflexo: uma diagonal larga e uma fina por painel (em coordenadas do painel), só no miolo
        miolo = (b >= 3) & (b <= 24) & (a >= 4) & (a <= 28)
        vidro = _w(miolo & ((a - b == 8) | (a - b == 9)), hx('#5f8a8b'), vidro)
        vidro = _w(miolo & (a - b == 13) & (b <= 16), hx('#42696a'), vidro)
        vidro = _w((a == 2) | (b == 1), _tom(vidro, 1.15), vidro)
        out = _w(vid, vidro, out)
        montante = vid & ((a == 0) | (a == 1))
        travessa = (((v - 73) % 28 == 0) | ((v - 73) % 28 == 27)) & vid
        ferro = _fundo(len(P), FERRO)
        ferro = _w((a == 0), _tom(hx(FERRO), 0.82), ferro)
        ferro = _w((a == 1), _tom(hx(FERRO), 1.06), ferro)
        out = _w(montante | travessa, ferro, out)
        out = _w(travessa & ~montante & ((v - 73) % 28 == 27), _tom(hx(FERRO), 0.86), out)
        out = _w(travessa & ~montante & ((v - 73) % 28 == 0), _tom(hx(FERRO), 1.1), out)
        # peitoril
        out = _w((v >= 69) & (v <= 72), _fundo(len(P), '#eef2ea'), out)
        out = _w(v == 69, _tom(reb, 0.7), out)
        out = _w(v == 70, _tom(hx(FERRO), 0.88), out)
        out = _w(v == 72, _fundo(len(P), '#fbfdf8'), out)
        # a verga e o reboco de cima
        topo = _fundo(len(P), '#d3dcd0')
        topo = _mottle(topo, uu, v, 61, 0.02, 0.64)
        out = _w(v > 133, topo, out)
        out = _w((v >= 132) & (v <= 133), _fundo(len(P), '#eef2ea'), out)
        out = _w(v == 132, _tom(hx(FERRO), 0.82), out)
        out = _w(v == 133, _fundo(len(P), '#fbfdf8'), out)
        out = _w(v == 134, _tom(reb, 0.8), out)
        out = _w(v == 135, _tom(reb, 0.92), out)
        out = _w(v >= 144, _tom(reb, 1.08), out)
        return out
    return emissivo(f)


# =====================================================================================================================
# 6. BANHO: mármore branco com veios cinza em lajotas grandes; parede de mármore claro com faixa verde-garrafa e ouro
# =====================================================================================================================
BA_P = _rampa(['#dedcd4', '#e3e1d9', '#d8d6ce'])
BB_P = _rampa(['#c6c8c6', '#cbcdca', '#c1c3c1'])


def piso_banho():
    def f(L, n, P):
        u, v = _uv_chao(P)
        u, v = u % W, v % W
        T = 32
        tu, tv = u // T, v // T
        claro = (tu + tv) % 2 == 0
        ids = tu * 4 + tv
        k = (_h(ids * 0.37, 2.8) * 3).astype(int) % 3
        out = np.where(claro[:, None], BA_P[k], BB_P[k])
        du = (_h(ids, 3.9) * 128).astype(int)
        dv = (_h(ids, 4.1) * 128).astype(int)
        m = _mancha(u + du, v + dv, 63, grande=32, pequena=16)
        out = _w(m > 0.68, _tom(out, 0.98), out)
        out = _w(m < 0.28, _tom(out, 1.02), out)
        v1 = _veios(u, v, 73, desl=du) & (_h(ids, 5.5) < 0.85)
        v2 = _veios2(u, v, 83, desl=dv) & (_h(ids, 6.6) < 0.6)
        out = _w(v2, hx('#a9aeac'), out)
        out = _w(v1, hx('#848b8c'), out)
        gu, gv = u % T, v % T
        # o inserto dourado no cruzamento das lajotas (um quadradinho nos cantos de trás)
        out = _w((gu < 2) & (gv < 2), hx('#b8902a'), out)
        br = (_h(ids, 7.7) > 0.45) & (gu + gv == 11) & (gu >= 5) & (gu <= 7)
        out = _w(br, hx('#fbfaf5'), out)
        out = _w(((gu == 1) | (gv == 1)) & ~((gu < 2) & (gv < 2)), _tom(out, 1.05), out)
        out = _w(((gu == T - 1) | (gv == T - 1)), _tom(out, 0.93), out)
        return _w(((gu == 0) | (gv == 0)) & ~((gu < 2) & (gv < 2)), hx('#8d8e88'), out)
    return emissivo(f)


BANHO_CORN = _colunas_rgb(_cornija('#ece9df', 131))


def parede_banho(eixo):
    def f(L, n, P):
        u, v = _uv_parede(P, eixo)
        uu = u % W
        # lajotas grandes de mármore: 32 de largura; 31 de altura embaixo, 36 em cima
        id_u = uu // 32
        base_v = np.where(v < 62, v // 31, 2 + (v - 62) // 36)
        ids = id_u * 7 + base_v
        k = (_h(ids * 0.37, 1.7) * 3).astype(int) % 3
        pal = _rampa(['#e6e3d9', '#ebe8de', '#e0ddd3'])
        out = pal[k]
        du = (_h(ids, 3.3) * 128).astype(int)
        vv = _veios(uu, v, 95, desl=du) & (_h(ids, 5.1) < 0.85)
        vv2 = _veios2(uu, v, 97, desl=du + 17) & (_h(ids, 5.9) < 0.55)
        out = _w(vv2, hx('#c6c8c3'), out)
        out = _w(vv, hx('#9a9e9a'), out)
        m = _mancha(uu, v, 65, per_v=False, grande=64, pequena=16, mix=0.7)
        out = _w(m > 0.66, _tom(out, 0.97), out)
        jv = (uu % 32 == 0)
        jh = (v == 31) | (v == 62 + 36) | (v == 62 + 72)
        out = _w(jv | jh, hx('#aeb0a8'), out)
        out = _w((((uu % 32 == 1) & ~jh) | (((v == 32) | (v == 99)) & ~jv)), _tom(out, 1.05), out)
        out = _w((v == 30) | (v == 97), _tom(out, 0.95), out)
        # a faixa verde-garrafa com os filetes de ouro (v 62..69)
        fx = (v >= 62) & (v <= 69)
        verde = _fundo(len(P), '#1f3a2a')
        verde = _w((v == 69), _fundo(len(P), '#2d5640'), verde)
        verde = _w((v == 63) | (v == 62), _fundo(len(P), '#17291e'), verde)
        verde = _w(((uu % 16) == 0) & (v >= 64) & (v <= 67), _tom(hx('#1f3a2a'), 0.8), verde)
        verde = _w(((uu % 16) == 1) & (v >= 64) & (v <= 67), _tom(hx('#1f3a2a'), 1.25), verde)
        out = _w(fx, verde, out)
        out = _w(v == 61, _fundo(len(P), '#b8902a'), out)
        out = _w(v == 70, _fundo(len(P), '#e0c060'), out)
        out = _w(v == 71, _tom(hx('#e7e4da'), 0.78), out)
        # o rodapé de mármore mais fundo e a cornija
        out = _w(v < 12, _tom(out, 0.94), out)
        out = _w(v == 11, _fundo(len(P), '#f4f2ea'), out)
        out = _w(v == 12, _tom(hx('#e7e4da'), 0.8), out)
        out = _w(v == 0, _tom(hx('#e7e4da'), 0.7), out)
        out = _w(v == 126, _tom(hx('#e7e4da'), 0.84), out)
        out = _w(v == 127, _fundo(len(P), '#7d5f1c'), out)
        out = _w(v == 128, _fundo(len(P), '#b8902a'), out)
        out = _w(v == 129, _fundo(len(P), '#e0c060'), out)
        out = _w(v == 130, _tom(hx('#7d5f1c'), 0.9), out)
        out = _w(v >= 131, _tab(BANHO_CORN, v), out)
        return out
    return emissivo(f)


# =====================================================================================================================
# 7. JOGOS: tábuas de cerejeira com rodapé alto; parede verde-garrafa e lambri escuro de salão de bilhar
# =====================================================================================================================
CE_P = _rampa(['#8f5238', '#9c5f44', '#844a33', '#a56a4b', '#8a4e36'])
CE_J = hx('#3c2016')


def piso_jogos():
    def f(L, n, P):
        u, v = _uv_chao(P)
        u, v = u % W, v % W
        larg = 8
        g = _g('jog', lambda: g_tabuas(larg, 32, 43)).at(u, v)
        out = cor_peca(g, CE_P, 8.1)
        out = veio(out, u, v, g, larg, 45, None, 0.88, 1.07)
        out = no_madeira(out, u, v, g, larg, 47, 0.1)
        m = _ns(u, v, 32, 13) * 0.6 + _ns(u, v, 64, 15) * 0.4
        out = _w(m > 0.62, _tom(out, 1.07), out)
        out = _w(m < 0.34, _tom(out, 0.94), out)
        pr = ((g.pos == 3) | (g.pos == 4)) & ((v % 8) == 4) & (_h(g.ids * 0.31, 9.1) > 0.6)
        out = _w(pr & ~g.j, hx('#4a2a1c'), out)
        return vol_chao(out, g, CE_J, 1.09, 0.88)
    return emissivo(f)


JOG_CORN = _colunas_rgb(_cornija('#3d2517', 131))


def parede_jogos(eixo):
    def f(L, n, P):
        u, v = _uv_parede(P, eixo)
        uu = u % W
        out = _fundo(len(P), '#1f3a2a')
        out = _w(uu % 16 == 0, _fundo(len(P), '#1a3224'), out)
        out = _w(uu % 16 == 1, _fundo(len(P), '#26463a'), out)
        out = _w((uu % 16 >= 6) & (uu % 16 <= 9), _tom(out, 1.04), out)
        out = _mottle(out, uu, v, 71, 0.03, 0.64)
        out = _w(v > 118, _tom(out, 0.94), out)
        L0 = hx('#4d2a1c')
        pw = 32
        a = uu % pw
        b = v - 10
        lam = np.tile(L0, (len(P), 1))
        dentro = (a >= 4) & (a < pw - 3) & (b >= 4) & (b < 38)
        alm = _tom(L0, 1.1)
        lam = _w(dentro, alm, lam)
        lam = _w(dentro & ((b == 37) | (a == 4)), _tom(L0, 0.78), lam)
        lam = _w(dentro & ((b == 4) | (a == pw - 4)), _tom(L0, 1.28), lam)
        lam = _w(~dentro & (a == 1) & ((v // 6) % 3 != 0), _tom(L0, 0.9), lam)
        lam = _w(dentro & (b % 7 == 3) & (((uu // 5) + (b // 7)) % 3 != 0), _tom(alm, 0.93), lam)
        lam = _w(a == 0, _tom(L0, 0.7), lam)
        lam = _w(a == pw - 1, _tom(L0, 1.1), lam)
        rod = np.tile(_tom(L0, 0.84), (len(P), 1))
        rod = _w((uu % 32 >= 4) & (uu % 32 <= 27) & (v >= 3) & (v <= 11), _tom(L0, 0.93), rod)
        rod = _w((uu % 32 >= 4) & (uu % 32 <= 27) & (v == 3), _tom(L0, 0.7), rod)
        rod = _w((uu % 32 >= 4) & (uu % 32 <= 27) & (v == 11), _tom(L0, 1.2), rod)
        rod = _w(v == 15, _tom(L0, 1.3), rod)
        rod = _w(v == 14, _tom(L0, 1.05), rod)
        rod = _w(v == 0, _tom(L0, 0.6), rod)
        lam = _w(v < 16, rod, lam)
        out = _w(v < 58, lam, out)
        out = moldura(out, v, 58, '#5c3422', 4)
        out = _w(v == 128, _fundo(len(P), '#8a6a22'), out)
        out = _w(v == 129, _fundo(len(P), '#c9a23c'), out)
        out = _w(v == 130, _tom(hx('#8a6a22'), 0.8), out)
        out = _w(v >= 131, _tab(JOG_CORN, v), out)
        return out
    return emissivo(f)


# =====================================================================================================================
# 8. CAVERNA: carpete grafite em placas de trama alternada; parede grafite com espuma acústica e a fita de LED a 1 m
# =====================================================================================================================
CAV_P = _rampa(['#4b4d55', '#474952', '#50525a'])


def piso_caverna():
    def f(L, n, P):
        u, v = _uv_chao(P)
        u, v = u % W, v % W
        T = 32
        tu, tv = u // T, v // T
        ids = tu * 4 + tv
        k = (_h(ids * 0.37, 1.9) * 3).astype(int) % 3
        out = CAV_P[k]
        gu, gv = u % T, v % T
        horiz = ((tu + tv) % 2 == 0)
        fio = np.where(horiz, (gv % 2 == 1), (gu % 2 == 1))
        out = _w(fio, _tom(out, 0.93), out)
        bl = _h(u // 2, v // 2, 5.5)
        out = _w(bl > 0.86, _tom(out, 1.06), out)
        out = _w(bl < 0.10, _tom(out, 0.92), out)
        m = _mancha(u, v, 93, grande=32, pequena=16)
        out = _w(m > 0.66, _tom(out, 0.95), out)
        out = _w(m < 0.3, _tom(out, 1.04), out)
        out = _w((gu == 1) | (gv == 1), _tom(out, 1.05), out)
        out = _w((gu == T - 1) | (gv == T - 1), _tom(out, 0.93), out)
        return _w((gu == 0) | (gv == 0), hx('#17181c'), out)
    return emissivo(f)


def _cor_led(uu):
    """Roxo -> ciano -> roxo ao longo de 128 px, em 8 degraus (periódico)."""
    t = (uu // 16) % 8
    s = np.abs(t - 4) / 4.0          # 1 = roxo, 0 = ciano
    roxo, ciano = hx('#a35cff'), hx('#38d6e8')
    return ciano[None, :] * (1 - s)[:, None] + roxo[None, :] * s[:, None]


CAV_CORN = _colunas_rgb([(v0, hx(c)) for v0, c in
                         [(131, '#16171b'), (132, '#1f2024'), (133, '#2a2b31'), (134, '#383a41'), (135, '#4a4c54'),
                          (136, '#1b1c20'), (137, '#2a2b30'), (138, '#34363c'), (139, '#3e4047'), (140, '#16171b'),
                          (141, '#26272c'), (142, '#303238'), (143, '#3b3d44'), (144, '#4a4c54'), (145, '#5a5c65')]])


def parede_caverna(eixo):
    def f(L, n, P):
        u, v = _uv_parede(P, eixo)
        uu = u % W
        out = _fundo(len(P), '#2d2e34')
        cu, cv = uu % 16, v % 16
        du, dv = cu - 7.5, cv - 7.5
        cima = (dv > 0) & (np.abs(du) < dv)
        baixo = (dv < 0) & (np.abs(du) < -dv)
        esq = (du < 0) & (np.abs(dv) <= -du)
        dire = (du > 0) & (np.abs(dv) <= du)
        base = hx('#34353b')
        espuma = np.tile(_tom(base, 0.98), (len(P), 1))
        espuma = _w(cima, _tom(base, 1.14), espuma)
        espuma = _w(esq, _tom(base, 1.03), espuma)
        espuma = _w(dire, _tom(base, 0.88), espuma)
        espuma = _w(baixo, _tom(base, 0.74), espuma)
        espuma = _w((np.abs(du) < 1.2) & (np.abs(dv) < 1.2), _tom(base, 1.22), espuma)
        espuma = _w((cu == 0) | (cv == 0), _tom(base, 0.58), espuma)
        espuma = _w((uu % 32 == 0), _tom(base, 0.45), espuma)
        out = _w((v >= 12) & (v < 130), espuma, out)
        rod = _fundo(len(P), '#1b1c20')
        rod = _w(v == 11, _fundo(len(P), '#3c3e46'), rod)
        rod = _w(v == 10, _fundo(len(P), '#26272c'), rod)
        out = _w(v < 12, rod, out)
        out = _w(v == 12, _fundo(len(P), '#15161a'), out)
        cor = _cor_led(uu)
        out = _w((v == 49) | (v == 56), _fundo(len(P), '#121316'), out)
        out = _w((v == 50) | (v == 55), _fundo(len(P), '#1a1b20'), out)
        halo = (v >= 45) & (v <= 60) & ~((v >= 49) & (v <= 56))
        out = _w(halo, out * 0.85 + cor * 0.15, out)
        out = _w(((v == 51) | (v == 54)), cor * 0.55, out)
        out = _w(((v == 52) | (v == 53)), np.clip(cor * 0.35 + 255 * 0.65, 0, 255), out)
        out = _w(v == 52, np.clip(cor * 0.6 + 255 * 0.4, 0, 255), out)
        out = _w(v >= 130, _tab(CAV_CORN, v), out)
        return out
    return emissivo(f)


# =====================================================================================================================
# 9. RUSTICO: tábuas largas gastas cinza-marrom e parede de pedra irregular escura (o anexo); TABUAS: o barracão
# =====================================================================================================================
RU_P = _rampa(['#80745f', '#756a58', '#8b7e68', '#6e6453', '#7b6f5c'])
RU_J = hx('#2c261d')


def piso_rustico():
    def f(L, n, P):
        u, v = _uv_chao(P)
        u, v = u % W, v % W
        larg = 16
        g = _g('rus', lambda: g_tabuas(larg, 64, 53)).at(u, v)
        out = cor_peca(g, RU_P, 9.3)
        out = veio(out, u, v, g, larg, 55, None, 0.9, 1.05)
        fila = (v // larg) % (W // larg)
        gs = v % larg
        seg = ((u + (_h(fila, 6.3) * 24).astype(int)) // 24) % 5
        out = _w((gs == 11) & (_h(fila, seg, 7.4) < 0.5) & ~g.j, _tom(out, 0.92), out)
        out = no_madeira(out, u, v, g, larg, 57, 0.16)
        m = _mancha(u, v, 87, grande=32, pequena=16)
        out = _w(m > 0.64, _tom(out, 0.93), out)
        out = _w(m < 0.3, _tom(out, 1.05), out)
        rach = (_h(g.ids * 0.29, 11.1) > 0.8) & (g.pos >= 20) & (g.pos <= 40) & (gs == (3 + (g.ids % 7) // 2)) & (g.pos % 7 != 0)
        out = _w(rach & ~g.j, _tom(out, 0.7), out)
        pr = ((g.pos == 3) | (g.pos == 4)) & ((v % larg == 3) | (v % larg == 12))
        out = _w(pr & ~g.j, hx('#40362a'), out)
        return vol_chao(out, g, RU_J, 1.08, 0.88)
    return emissivo(f)


PE_P = _rampa(['#4d4944', '#57524c', '#443f3b', '#5e5852', '#4a4540', '#524d48', '#504740'])


def parede_rustico(eixo):
    def f(L, n, P):
        u, v = _uv_parede(P, eixo)
        uu = u % W
        g = _g('rus_p', lambda: g_bruta(18, 22, 48, 5, H=HP, salto=5)).at(uu, v)
        mix = (g.ids % 1000) * 0.37 + (g.ids // 1000) * 7.31
        out = PE_P[(_h(mix, 3.7) * len(PE_P)).astype(int) % len(PE_P)]
        m = _mancha(uu, v, 77, per_v=False, grande=32, pequena=16)
        out = _w(m > 0.66, _tom(out, 0.94), out)
        out = _w(m < 0.32, _tom(out, 1.06), out)
        out = vol_parede(out, g, hx('#1e1b19'), 1.13, 1.07, 0.84, 0.92)
        out = _w(v >= 144, _tom(out, 0.86), out)
        return out
    return emissivo(f)


TB_P = _rampa(['#7a6f5f', '#6f6556', '#85796a', '#675d4f', '#76695b'])


def parede_tabuas(eixo):
    def f(L, n, P):
        u, v = _uv_parede(P, eixo)
        uu = u % W
        bw = 8
        ids = uu // bw
        a = uu % bw
        out = TB_P[(_h(ids * 0.37, 2.9) * len(TB_P)).astype(int) % len(TB_P)]
        seg = ((v + (_h(ids, 3.9) * 18).astype(int)) // 18) % 9
        out = _w((a == 3) & (_h(ids, seg, 4.9) < 0.6), _tom(out, 0.9), out)
        out = _w((a == 6) & (_h(ids, seg, 5.9) < 0.35), _tom(out, 1.07), out)
        m = _mancha(uu, v, 99, per_v=False, grande=32, pequena=16)
        out = _w(m > 0.64, _tom(out, 0.92), out)
        out = _w(m < 0.3, _tom(out, 1.05), out)
        out = _w(v < 24, _tom(out, 0.9), out)
        out = _w(a == 0, _fundo(len(P), '#2a241b'), out)
        out = _w(a == 1, _tom(out, 1.1), out)
        out = _w(a == bw - 1, _tom(out, 0.9), out)
        # as travessas (caibros) em v 22..27 e 100..105, mais escuras e salientes, com os pregos
        for z in (22, 100):
            cr = _fundo(len(P), '#5b5043')
            cr = _w(((v - z) == 0), _fundo(len(P), '#8a7d6b'), cr)
            cr = _w(((v - z) == 5), _fundo(len(P), '#2f2820'), cr)
            cr = _w((v - z == 2) & (uu % 16 == 4), _fundo(len(P), '#2a241b'), cr)
            out = _w((v >= z) & (v <= z + 5), cr, out)
            out = _w(v == z + 6, _tom(out, 0.8), out)
        out = _w(v == 138, _tom(out, 0.72), out)
        out = _w((v >= 139) & (v <= 145), _fundo(len(P), '#5e5446'), out)
        out = _w(v == 139, _fundo(len(P), '#2d2720'), out)
        out = _w(v == 145, _fundo(len(P), '#948773'), out)
        return out
    return emissivo(f)


# =====================================================================================================================
# 11. O LUXO (23/10, o Felipe: "trocar esse piso de madeira por um porcelanato branco e as paredes com pinturas
# perfeitas e um rodapé e a parte de cima toda cheia de detalhes... é casa de gente MILIONÁRIA"): o porcelanato branco
# polido em placas grandes e a parede de pintura lisa com boiserie, rodapé laqueado e a sanca de gesso com ouro
# =====================================================================================================================
POR_P = _rampa(['#f2f0ec', '#efede8', '#f4f2ee'])


def piso_porcelanato():
    """O porcelanato branco polido: a placa de 2 x 2 casas (1,5 m), o veio cinza-claro bem raro, a junta fina, o reflexo."""
    def f(L, n, P):
        u, v = _uv_chao(P)
        u, v = u % W, v % W
        T = 64
        tu, tv = u // T, v // T
        ids = tu * 2 + tv
        k = (_h(ids * 0.53, 2.1) * 3).astype(int) % 3
        out = POR_P[k]
        du = (_h(ids, 3.7) * 128).astype(int)
        # o veio: só a linha fina e clara-acinzentada, em metade das placas (o porcelanato imita mármore, de leve)
        v1 = _veios(u, v, 91, desl=du, per=64, gate=2, amp=22) & (_h(ids, 5.1) < 0.5)
        out = _w(v1, hx('#dcd8d0'), out)
        gu, gv = u % T, v % T
        # o reflexo do polimento: a faixa diagonal larga, um degrau mais claro
        refl = ((gu + gv) >= 30) & ((gu + gv) <= 33) & (gu >= 12) & (gu <= 24) & (_h(ids, 7.3) > 0.35)
        out = _w(refl, hx('#fdfcfa'), out)
        # a junta fina (1 px cinza-claro) e o volume da placa
        out = _w((gu == 1) | (gv == 1), hx('#fdfcfa'), out)
        out = _w((gu == T - 1) | (gv == T - 1), _tom(out, 0.97), out)
        return _w((gu == 0) | (gv == 0), hx('#c8c4bc'), out)
    return emissivo(f)


def _sanca(v, uu, cor_parede):
    """A sanca de gesso do alto (v de 116 a 145): o friso, a fileira de óvalos, os dentículos, o filete de ouro, a cornija."""
    base = hx('#f4f0e6')
    out = np.tile(base, (len(v), 1))
    # de baixo para cima: a sombra no encontro com a parede, o filete de ouro, os dentículos, os óvalos, a cornija
    out = _w(v == 116, _tom(hx(cor_parede), 0.82), out)
    out = _w(v == 117, hx('#b8902a'), out)
    out = _w(v == 118, hx('#e0c060'), out)
    den = (v >= 120) & (v <= 124)
    out = _w(den & (uu % 6 < 3), hx('#fbf8f0'), out)
    out = _w(den & (uu % 6 >= 3), _tom(base, 0.86), out)
    out = _w(v == 125, _tom(base, 0.8), out)
    ov = (v >= 127) & (v <= 132)
    cx_ = (uu % 10) - 4.5
    cy_ = (v - 129.5)
    dentro = (cx_ * cx_) / 12 + (cy_ * cy_) / 7 <= 1
    out = _w(ov & dentro, hx('#fdfbf6'), out)
    out = _w(ov & dentro & (cx_ > 1), _tom(base, 0.9), out)
    out = _w(ov & ~dentro, _tom(base, 0.93), out)
    out = _w(v == 133, hx('#d8b050'), out)
    out = _w(v == 134, _tom(base, 0.84), out)
    corn = v >= 135
    k = np.clip(v - 135, 0, 10)
    tons = np.array([1.08, 1.12, 1.0, 0.9, 1.05, 1.1, 1.14, 1.16, 0.95, 1.18, 1.2])
    out = _w(corn, np.clip(base[None, :] * tons[k][:, None], 0, 255), out)
    return out


def _parede_luxo(cor, painel=True):
    """A parede de pintura lisa na cor `cor`, com a boiserie (os quadros de moldura fina), o rodapé alto e a sanca."""
    def fabrica(eixo):
        def f(L, n, P):
            u, v = _uv_parede(P, eixo)
            uu = u % W
            out = _fundo(len(P), cor)
            if painel:
                # a boiserie: dois painéis por 4 casas (64 texels cada), a moldura de 2 px (luz em cima/esquerda, sombra embaixo/direita)
                a = uu % 64
                dentro = (a >= 6) & (a <= 57) & (v >= 30) & (v <= 104)
                borda = dentro & ((a <= 7) | (a >= 56) | (v <= 31) | (v >= 103))
                out = _w(borda & ((a <= 7) | (v >= 103)), _tom(hx(cor), 1.1), out)
                out = _w(borda & ((a >= 56) | (v <= 31)), _tom(hx(cor), 0.84), out)
                # a meia-cana (chair rail) a 0,9 m e o painel baixo
                out = _w((v >= 22) & (v <= 24), hx('#f6f2e8'), out)
                out = _w(v == 21, _tom(hx(cor), 0.86), out)
                out = _w(v == 25, _tom(hx(cor), 0.9), out)
            # o rodapé laqueado branco (15 cm) com o filete de ouro e a moldura
            rod = (v < 9)
            out = _w(rod, hx('#f8f6f0'), out)
            out = _w(v == 0, hx('#c8c2b4'), out)
            out = _w((v >= 2) & (v <= 3), _tom(hx('#f8f6f0'), 0.92), out)
            out = _w(v == 7, hx('#d8b050'), out)
            out = _w(v == 8, hx('#fdfcf8'), out)
            out = _w(v == 9, _tom(hx(cor), 0.8), out)
            out = _w(v == 10, _tom(hx(cor), 0.92), out)
            # a sanca
            alto = v >= 116
            return _w(alto, _sanca(v, uu, cor), out)
        return emissivo(f)
    return fabrica


parede_nobre_luxo = _parede_luxo('#d8ccb2')
parede_claro_luxo = _parede_luxo('#ece6da')


# =====================================================================================================================
# 12. O MODERNO (23/10, o Felipe: "cheio de madeira e coisas com aparência velha... é tudo mármore, coisas chiques"): a
# área de serviço sem o ladrilho hidráulico (o porcelanato branco e a parede lisa com o rodapé e a sanca) e a sala de
# jogos sem a madeira (o Nero Marquina com os veios dourados no chão e a parede grafite com a boiserie)
# =====================================================================================================================
NERO_P = _rampa(['#1c1b20', '#1f1e23', '#1a191e'])


def piso_nero():
    """O Nero Marquina polido: a placa de 2 x 2 casas, o preto com os veios dourados longos, a junta fina, o reflexo."""
    def f(L, n, P):
        u, v = _uv_chao(P)
        u, v = u % W, v % W
        T = 64
        tu, tv = u // T, v // T
        ids = tu * 2 + tv
        k = (_h(ids * 0.41, 2.7) * 3).astype(int) % 3
        out = NERO_P[k]
        du = (_h(ids, 3.3) * 128).astype(int)
        v1 = _veios(u, v, 93, desl=du, per=48, gate=2, amp=26) & (_h(ids, 5.3) < 0.8)
        v2 = _veios2(u, v, 97, desl=du) & (_h(ids, 6.1) < 0.5)
        out = _w(v2, hx('#5a5040'), out)
        out = _w(v1, hx('#b89850'), out)
        gu, gv = u % T, v % T
        refl = ((gu + gv) % 64 >= 20) & ((gu + gv) % 64 <= 25)
        out = _w(refl, _tom(out, 1.35), out)
        out = _w((gu == 1) | (gv == 1), _tom(out, 1.25), out)
        return _w((gu == 0) | (gv == 0), hx('#0c0b0e'), out)
    return emissivo(f)


parede_servico_luxo = _parede_luxo('#ebe7df', painel=False)
parede_jogos_luxo = _parede_luxo('#2c2a32')


ESTILOS = {
    'mansao_marmore': {'piso': piso_marmore, 'parede': parede_marmore, 'rodape': None, 'extra': None},
    # 23/10: o salão nobre e os quartos trocaram a madeira pelo porcelanato branco e a parede pelo luxo pintado
    'mansao_nobre': {'piso': piso_porcelanato, 'parede': parede_nobre_luxo, 'rodape': None, 'extra': None},
    'mansao_claro': {'piso': piso_porcelanato, 'parede': parede_claro_luxo, 'rodape': None, 'extra': None},
    # 23/10: a cozinha, a despensa, a lavanderia e o corredor dos funcionários sem o ladrilho hidráulico; a sala de jogos sem a madeira
    'mansao_servico': {'piso': piso_porcelanato, 'parede': parede_servico_luxo, 'rodape': None, 'extra': None},
    'mansao_estufa': {'piso': piso_estufa, 'parede': parede_estufa, 'rodape': None, 'extra': None},
    'mansao_banho': {'piso': piso_banho, 'parede': parede_banho, 'rodape': None, 'extra': None},
    'mansao_jogos': {'piso': piso_nero, 'parede': parede_jogos_luxo, 'rodape': None, 'extra': None},
    'mansao_caverna': {'piso': piso_caverna, 'parede': parede_caverna, 'rodape': None, 'extra': None},
    'mansao_rustico': {'piso': piso_rustico, 'parede': parede_rustico, 'rodape': None, 'extra': None},
    'mansao_tabuas': {'piso': piso_rustico, 'parede': parede_tabuas, 'rodape': None, 'extra': None},
}
