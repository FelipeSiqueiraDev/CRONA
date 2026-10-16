"""
A COZINHA DO CASARÃO (Fazenda · Cozinha) em pixel art feito só por código, no estilo da sala de teste (sala4.py).

A planta é a do jogo (server/src/seedFazenda.ts, cena "cozinha"): 10 x 6 casas de 0,75 m (7,5 x 4,5 m), a porta na
parede da frente à direita (x = 10, que não aparece), piso "ladrilho". Cada móvel fica na casa e no giro do seed, no
tamanho de shared/src/furni.ts (largura e fundo em casas, altura em metros, `aumento` na mesa e nas cadeiras).

Câmera do jogo (2:1): x desce para a direita na tela, y desce para a esquerda, z sobe. ESC 1 (o padrão, o 1:1 do jogo):
1 pixel da arte é ~0,0234 m no chão e ~0,0191 m na vertical (PH e PZ, em base_estilo; ESC=0.75 ainda funciona). Só as paredes de trás aparecem: a da esquerda (x = 0) e a do fundo (y = 0).

Uso:
    python3 cozinha.py saida.png            # a imagem parada (3x)
    python3 cozinha.py saida.png 0.25       # o quadro do instante t (0..1) do loop
    FOGO_FORCA=0 python3 cozinha.py x.png   # o fogão apagado (a fumaça sai pela boca da fornalha)
    python3 gif_cozinha.py                  # o GIF do loop (o fogo e a cortina)
"""
import math
import os
import sys

os.environ['ESC'] = os.environ.get('ESC', '1')        # 1:1 (1 px da arte = 1 px do tabuleiro), o do jogo
AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'codigo'))
sys.path.insert(0, AQUI)
import numpy as np                          # noqa: E402
from PIL import Image                       # noqa: E402
from motor import Cena, MUNDO, tela, ruido, emissivo, suave, KX, KY, KZ, VISTA   # noqa: E402
import base_estilo as BE                    # noqa: E402
from base_estilo import (hx, coords, liso, madeira, tabuas, mad2, tab2, vol, _tom, _cru, _fac, _poligono_rodado,  # noqa: E402
                         _disco, _fita, _pau, _barra, _p1_malha, _p1_mat_rampa, _p1_rampa, _MAD, _ponta_tabuas,
                         caneca, pote_barro, barril_cesto, _garrafa, PZ, PH, _LUZ2)

M = MUNDO
CASA = 0.75
LX, LY = 10 * CASA, 6 * CASA       # a sala do seed: planRight(10, 6, 3)
ALTO = 2.85
ESP = 0.16

# o estado do quadro (montar() refaz tudo)
c = None
pegadas = []
luzes = set()
vidros = []          # o vidro dos armários: caixas no mundo (o que se vê por trás dele fica tingido)
fades = []           # objetos que somem para o fundo acima de uma altura (a chaminé)
fades_atras = []     # os que somem para o que está atrás deles (o fio das lâmpadas)
lampadas = []        # o meio da lâmpada (para a luz)
itens_peq = []       # objetos pequenos nos tampos (a sombrinha de contato)


def caixa(b, mat, tipo=3, sombra=True, ch=0.0):
    o = c.novo_obj(tipo)
    c.caixa(b, mat, M, o, ch=ch)
    if sombra and tipo == 3 and b[4] < 0.05:
        pegadas.append(b[:4])
    return o


def fp(pts, n, mat, oid):
    c.face_plana(pts, n, mat, M, oid)


def face_com_furos(eixo, plano, a0, a1, z0, z1, furos, mat, oid):
    """
    Uma face em pé com buracos retangulares (a frente do fogão com a boca da fornalha): eixo 'y' = a face olha
    para +y (no plano y = plano, ao longo de x); 'x' = olha para +x. furos: (a0, a1, z0, z1).
    """
    As = sorted({a0, a1, *[f[0] for f in furos], *[f[1] for f in furos]})
    Zs = sorted({z0, z1, *[f[2] for f in furos], *[f[3] for f in furos]})
    for (aa, ab) in zip(As[:-1], As[1:]):
        for (za, zb) in zip(Zs[:-1], Zs[1:]):
            am, zm = (aa + ab) / 2, (za + zb) / 2
            if not (a0 <= am <= a1 and z0 <= zm <= z1):
                continue
            if any(f[0] < am < f[1] and f[2] < zm < f[3] for f in furos):
                continue
            if eixo == 'y':
                fp([(aa, plano, za), (ab, plano, za), (ab, plano, zb), (aa, plano, zb)], (0, 1, 0), mat, oid)
            else:
                fp([(plano, aa, za), (plano, ab, za), (plano, ab, zb), (plano, aa, zb)], (1, 0, 0), mat, oid)


# =====================================================================================================================
# o piso e as paredes
# =====================================================================================================================
LAD_A = ['#cbc2b1', '#c6bdab', '#cfc6b6']       # o ladrilho claro (o "ladrilho" do jogo: #c2beb2, um pouco mais quente)
LAD_B = ['#b9ae9b', '#b4a996', '#bdb3a1']       # o escuro do xadrezinho
LAD_J = '#887e70'
TL = 0.375                                       # o ladrilho: meia casa


def ladrilho():
    """
    O ladrilho hidráulico em xadrez suave: a junta de 1 linha, a luz fina na beira de cima (a peça abaulada) e, no
    meio de cada peça, o desenho do hidráulico: um quadrado girado (na tela, um losango) de 1 linha e o miolo.
    """
    A = np.stack([hx(x) for x in LAD_A])
    B = np.stack([hx(x) for x in LAD_B])
    jc = hx(LAD_J)

    def f(L, n, P):
        X, Y = P[:, 0], P[:, 1]
        i, j = np.floor(X / TL), np.floor(Y / TL)
        gx, gy = X - i * TL, Y - j * TL
        k = (ruido(i, j, 3.0) * 3).astype(int) % 3
        claro = ((i + j) % 2 == 0)
        out = np.where(claro[:, None], A[k], B[k])
        # o desenho: o quadrado do meio (1 linha) e o miolo; no claro um tom abaixo, no escuro um tom acima
        dx, dy = np.abs(gx - TL / 2), np.abs(gy - TL / 2)
        q = np.maximum(dx, dy)
        lin = (q >= 0.24 * TL) & (q < 0.24 * TL + PH)
        mio = (dx + dy) < 0.075 * TL + PH
        des = np.where(claro[:, None], _tom(out, 0.93), _tom(out, 1.06))
        out = np.where((lin | mio)[:, None], des, out)
        # a luz fina na beira de cima e a da esquerda (1 linha)
        out = np.where(((gx >= PH) & (gx < 2 * PH) | (gy >= PH) & (gy < 2 * PH))[:, None], _tom(out, 1.05), out)
        return np.where(((gx < PH) | (gy < PH))[:, None], jc, out)
    return emissivo(f)


AZ = '#a7c7c0'          # o azulejo verde-água
AZ_J = '#7e9e98'
AZ_REJ = '#dbe3da'      # o rejunte claro
PINT = '#ece0c2'        # a parede pintada (creme de cal)
TA, TZ = 7 * PH, 8 * PZ   # o azulejo: 7 x 8 px
ZAZ = 7 * TZ              # o alto do azulejo (7 fiadas)
ZFX = ZAZ + 5 * PZ        # o alto da faixa decorada


def parede(eixo):
    """
    A parede da cozinha: o rodapé de ladrilho escuro, o azulejo verde-água (a junta de 1 px, a luz em cima à
    esquerda de cada peça), a faixa decorada azul com os losangos creme e a cal creme em cima, que clareia para o alto.
    eixo 'x': a parede do fundo (ao longo de x); 'y': a da esquerda.
    """
    az, azj, pint = hx(AZ), hx(AZ_J), hx(PINT)
    azul, azul_e, creme = hx('#3f6a8e'), hx('#2c4c6c'), hx('#e8dcc0')

    def f(L, n, P):
        a = P[:, 0] if eixo == 'x' else P[:, 1]
        z = P[:, 2]
        out = np.tile(pint, (len(P), 1))
        # a cal: clareia em 2 degraus para cima
        out = np.where((z > 2.0)[:, None], _tom(pint, 1.04), out)
        out = np.where((z < 1.75)[:, None], _tom(pint, 0.97), out)
        # a cal gasta: manchas grandes e suaves em dois degraus (pixel limpo: a borda segue a grade 1 px x 1 px)
        qa, qz = np.floor(a / PH) * PH, np.floor(z / PZ) * PZ
        s = suave(qa + (3.1 if eixo == 'x' else 11.7), qz * 1.6, 0.55, 9) * 0.65 + suave(qa, qz * 2.0, 0.22, 4) * 0.35
        out = np.where((s > 0.7)[:, None], _tom(out, 0.965), out)
        # a sujeira escura logo embaixo da viga (2 degraus)
        out = np.where(((z > ALTO - 4 * PZ))[:, None], _tom(out, 0.95), out)
        out = np.where(((z > ALTO - 2 * PZ))[:, None], _tom(out, 0.92), out)
        # o azulejo (7 x 8 px): o rejunte claro de 1 px; a peça abaulada: a fileira de cima e a coluna da esquerda
        # pegam luz, a de baixo e a da direita na sombra; três tons de esmalte; o brilho do esmalte em diagonal
        ia, iz = np.floor(a / TA), np.floor(z / TZ)
        ga, gz = a - ia * TA, z - iz * TZ
        ca, cz_ = np.floor(ga / PH + 1e-6), np.floor(gz / PZ + 1e-6)      # o pixel dentro da peça (0..6, 0..7)
        k = ruido(ia, iz, 7.0)
        t = np.where((k > 0.78)[:, None], _tom(az, 1.035), np.where((k < 0.2)[:, None], _tom(az, 0.965), az))
        t = np.where((cz_ == 7)[:, None], _tom(t, 1.1), t)                          # a beira de cima
        t = np.where(((ca == 1) & (cz_ < 7))[:, None], _tom(t, 1.045), t)           # a da esquerda
        t = np.where((cz_ == 1)[:, None], _tom(t, 0.92), t)                         # a de baixo
        t = np.where(((ca == 6) & (cz_ > 1))[:, None], _tom(t, 0.955), t)           # a da direita
        # o brilho: uma risquinha de 2 px em diagonal no alto à esquerda (em metade das peças), e o ponto de luz
        sh = (k > 0.35) & (((ca == 2) & (cz_ == 6)) | ((ca == 3) & (cz_ == 5)))
        t = np.where(sh[:, None], _tom(az, 1.2), t)
        t = np.where(((k > 0.35) & (ca == 2) & (cz_ == 5))[:, None], _tom(az, 1.1), t)
        t = np.where(((ga < PH) | (gz < PZ))[:, None], hx(AZ_REJ), t)
        out = np.where((z < ZAZ)[:, None], t, out)
        # o rodapé (a fiada de baixo mais escura)
        rod = np.where((cz_ == 7)[:, None], _tom(hx('#6f938c'), 1.1), np.where((cz_ == 1)[:, None], _tom(hx('#6f938c'), 0.9), hx('#6f938c')))
        rod = np.where(((ca == 1) & (cz_ > 1) & (cz_ < 7))[:, None], _tom(hx('#6f938c'), 1.04), rod)
        rod = np.where(((ga < PH) | (gz < PZ))[:, None], hx('#b8c4bc'), rod)
        out = np.where((z < TZ)[:, None], rod, out)
        # a faixa decorada: azul, com os losangos creme a cada 6 px e a linha escura em cima e embaixo
        fx = (z >= ZAZ) & (z < ZFX)
        v = np.floor((z - ZAZ) / PZ)          # 0 embaixo .. 4 em cima
        u = np.floor(a / PH) % 6
        # a florzinha em cruz (creme, o miolo amarelo) a cada 6 px, e um pontinho claro no meio do caminho
        pat = np.where((v == 0) | (v == 4), 0, 1)
        pat = np.where(((v == 2) & (u >= 1) & (u <= 3)) | (((v == 1) | (v == 3)) & (u == 2)), 2, pat)
        pat = np.where((v == 2) & (u == 2), 3, pat)
        pat = np.where((v == 2) & (u == 5), 4, pat)
        cor_fx = np.where((pat == 0)[:, None], azul_e, np.where((pat == 2)[:, None], creme, azul))
        cor_fx = np.where((pat == 3)[:, None], hx('#e8b84a'), cor_fx)
        cor_fx = np.where((pat == 4)[:, None], hx('#6a90b0'), cor_fx)
        out = np.where(fx[:, None], cor_fx, out)
        # o friso de cerâmica clara em cima da faixa (1 px) e a sombrinha dele na cal
        out = np.where(((z >= ZFX) & (z < ZFX + PZ))[:, None], hx('#f6eedc'), out)
        out = np.where(((z >= ZFX + PZ) & (z < ZFX + 2 * PZ))[:, None], _tom(pint, 0.9), out)
        return out
    return emissivo(f)


def sala():
    o = c.novo_obj(1)
    c.caixa((0, LX, 0, LY, -0.28, 0), {'cima': ladrilho(), '*': madeira('#94552c', veio=False)}, M, o)
    caixa((-ESP, LX, -ESP, 0, 0, ALTO), {'frente': parede('x'), '*': liso('#8a5230')}, tipo=2)
    caixa((-ESP, 0, 0, LY, 0, ALTO), {'dir': parede('y'), '*': liso('#8a5230')}, tipo=2)
    # o rodapé de madeira encerada nas duas paredes (a quina de cima clara)
    RDP = _pau('#6e4026', '#8a5434', quina=1.3, b=(0, 0, 0, 0, 0, 0.09))
    caixa((0, LX, 0, 0.018, 0, 0.09), RDP, tipo=2)
    caixa((0, 0.018, 0.018, LY, 0, 0.09), RDP, tipo=2)
    # a viga grossa em cima e os pilares (no canto de trás e nas duas pontas)
    MOLD = ['#b5733e', '#ad6c3a']
    VG = tabuas(MOLD, 0.6, 9, '#7a4222', ponta=False)
    VGy = tabuas(MOLD, 0.6, 9, '#7a4222', eixo=1, ponta=False)
    caixa((-ESP - 0.14, LX + 0.12, -ESP - 0.14, 0.16, ALTO, ALTO + 0.38), {'*': VG, 'cima': VG}, tipo=2)
    caixa((-ESP - 0.14, 0.16, 0.16, LY + 0.12, ALTO, ALTO + 0.38), {'*': VG, 'cima': VGy}, tipo=2)
    PIL = madeira('#a3633a', eixo=1)
    caixa((-ESP - 0.06, 0.12, -ESP - 0.06, 0.12, 0, ALTO), PIL, tipo=2)
    caixa((LX - 0.12, LX + 0.1, -ESP - 0.1, 0.12, -0.28, ALTO), PIL, tipo=2)
    caixa((-ESP - 0.1, 0.12, LY - 0.12, LY + 0.1, -0.28, ALTO), PIL, tipo=2)


# =====================================================================================================================
# materiais da cozinha
# =====================================================================================================================
def ferro(cor='#34302d', topo='#4a4541', quina=1.25):
    """O ferro fundido: a cor chapada, o topo um tom acima e a fileira de cima das faces em pé clara (a quina)."""
    c0, ct = hx(cor), hx(topo)

    def f(L, n, P):
        if n[2] > 0.5:
            return np.tile(ct, (len(P), 1))
        return np.tile(c0, (len(P), 1))
    return emissivo(f)


def azulejinho(cor='#ebe2cd', junta='#cbbfa6', ta=5 * PH, tz=6 * PZ, eixo='y', org=0.0):
    """Os azulejinhos do corpo do fogão (5 x 6 px): a junta de 1 px, a beira de cima clara e a de baixo escura."""
    c0, jc = hx(cor), hx(junta)

    def f(L, n, P):
        a = (P[:, 0] if eixo == 'y' else P[:, 1]) - org
        z = P[:, 2]
        ia, iz = np.floor(a / ta), np.floor(z / tz)
        ga, gz = a - ia * ta, z - iz * tz
        k = ruido(ia, iz, 17.0)
        out = np.where((k > 0.75)[:, None], _tom(c0, 0.97), np.tile(c0, (len(P), 1)))
        out = np.where((gz >= tz - PZ)[:, None], _tom(c0, 1.06), out)
        out = np.where(((gz >= PZ) & (gz < 2 * PZ))[:, None], _tom(out, 0.95), out)
        return np.where(((ga < PH) | (gz < PZ))[:, None], jc, out)
    return emissivo(f)


def tijolos(eixo='y', org=0.0, cores=('#b0573c', '#a54f37', '#b9603f', '#9c4a33'), junta='#c9b398'):
    """O tijolinho à vista: fiadas de 3 px com a junta de 1 px, os tijolos de 7 px desencontrados, a beira de cima clara."""
    cs = np.stack([hx(x) for x in cores])
    jc = hx(junta)
    bz, bl = 4 * PZ, 7 * PH

    def f(L, n, P):
        a = (P[:, 0] if eixo == 'y' else P[:, 1]) - org
        z = P[:, 2]
        fila = np.floor(z / bz)
        gz = z - fila * bz
        aa = a + (fila % 2) * bl * 0.5
        col = np.floor(aa / bl)
        ga = aa - col * bl
        out = cs[(ruido(fila, col, 23.0) * len(cs)).astype(int) % len(cs)]
        out = np.where((gz >= bz - PZ)[:, None], _tom(out, 1.12), out)
        out = np.where(((ga >= PH) & (ga < 2 * PH))[:, None], _tom(out, 1.05), out)
        out = np.where((ga >= bl - PH)[:, None], _tom(out, 0.88), out)
        return np.where(((gz < PZ) | (ga < PH))[:, None], jc, out)
    return emissivo(f)


def tora_y(cx, cz, r, y0, y1, casca='#5a3a22', miolo='#c89a62', lados=8, oid=None):
    """Uma tora deitada ao longo de y (a ponta de frente para +y): o prisma de casca e a ponta com os anéis."""
    o = c.novo_obj(3) if oid is None else oid
    cc, cm = hx(casca), hx(miolo)
    pts = [(cx + r * math.cos(2 * math.pi * (i + 0.5) / lados), cz + r * math.sin(2 * math.pi * (i + 0.5) / lados)) for i in range(lados)]
    for i in range(lados):
        (xa, za), (xb, zb) = pts[i], pts[(i + 1) % lados]
        am = 2 * math.pi * (i + 1) / lados
        nn = (math.cos(am), 0, math.sin(am))
        k = 1.0 + 0.12 * math.sin(am) - 0.05 * math.cos(am)
        fp([(xa, y0, za), (xb, y0, zb), (xb, y1, zb), (xa, y1, za)], nn, liso('#%02x%02x%02x' % tuple(np.clip(cc * k, 0, 255).astype(int))), o)

    def ponta(L, n, P):
        # no pixel: a casca (1 px), o alburno claro, o anel escuro no meio e o miolo
        rx = (P[:, 0] - cx) * KX
        rz = (P[:, 2] - cz) * KZ
        rr = np.hypot(rx, rz)
        R = r * KX
        out = np.tile(cm, (len(P), 1))
        out = np.where((rr < R * 0.62)[:, None], _tom(cm, 0.94), out)
        out = np.where((np.abs(rr - R * 0.5) < 0.55)[:, None], _tom(cm, 0.72), out)
        out = np.where((rr < 0.9)[:, None], _tom(cm, 0.66), out)
        out = np.where(((rr > R - 1.1) & (rx + rz > 0))[:, None], _tom(cm, 1.08), out)
        out = np.where((rr > R - 0.9)[:, None] & ~((rx + rz > 0)[:, None]), _tom(cc, 1.2), out)
        return out
    fp([(x, y1, z) for (x, z) in pts], (0, 1, 0), emissivo(ponta), o)
    return o


# =====================================================================================================================
# o fogão a lenha (2 x 1 casas, giro 4: a frente para +y, encostado no fundo; altura 0,85 m; aceso)
# =====================================================================================================================
FOG = dict(x0=1.5, x1=3.0, yb=0.70, zc=0.79, zt=0.85)
FORN = dict(m=2.6, bw=0.24, zp=0.38, bt=0.7, yb=0.70, yf=0.26)      # a boca da fornalha
CHAM = (1.55, 1.89, 0.0, 0.34)                                          # a chaminé (x0, x1, y0, y1)
BOCAS = ((2.62, 0.43), (2.12, 0.45))                                    # as bocas da chapa (a 1ª, em cima do fogo, aberta)
FURO = 0.095                                                            # o buraco da boca aberta


def fogao(aceso=True, lenha=True):
    x0, x1, yb, zc, zt = FOG['x0'], FOG['x1'], FOG['yb'], FOG['zc'], FOG['zt']
    m, bw, zp, bt, yf = FORN['m'], FORN['bw'], FORN['zp'], FORN['bt'], FORN['yf']
    # ---- o corpo de alvenaria: azulejinho creme, a barra vermelha embaixo ----
    nicho = (1.66, 2.2, 0.05, 0.33)                  # o nicho da lenha embaixo do forno
    corpo = c.novo_obj(3)
    AZF = azulejinho()
    face_com_furos('y', yb, x0 + 0.03, x1 - 0.03, 0.1, zc, [(m - bw, m + bw, zp, bt), (nicho[0], nicho[1], 0.1, nicho[3])], AZF, corpo)
    fp([(x1 - 0.03, 0, 0.1), (x1 - 0.03, yb, 0.1), (x1 - 0.03, yb, zc), (x1 - 0.03, 0, zc)], (1, 0, 0), azulejinho(eixo='x'), corpo)
    # o lado esquerdo e as costas (o móvel sozinho, girado, mostra todos os lados): o mesmo azulejinho
    fp([(x0 + 0.03, 0, 0.1), (x0 + 0.03, yb, 0.1), (x0 + 0.03, yb, zc), (x0 + 0.03, 0, zc)], (-1, 0, 0), azulejinho(eixo='x'), corpo)
    fp([(x0 + 0.03, 0, 0.1), (x1 - 0.03, 0, 0.1), (x1 - 0.03, 0, zc), (x0 + 0.03, 0, zc)], (0, -1, 0), azulejinho(org=x0 + 0.03), corpo)
    VERM = _pau('#a8432e', '#c0573c', quina=1.22, b=(0, 0, 0, 0, 0, 0.1))
    face_com_furos('y', yb + 0.012, x0 + 0.02, x1 - 0.02, 0.0, 0.1, [(nicho[0], nicho[1], nicho[2], 0.1)], VERM, corpo)
    fp([(x1 - 0.02, 0, 0), (x1 - 0.02, yb + 0.012, 0), (x1 - 0.02, yb + 0.012, 0.1), (x1 - 0.02, 0, 0.1)], (1, 0, 0), VERM, corpo)
    fp([(x0 + 0.02, 0, 0), (x0 + 0.02, yb + 0.012, 0), (x0 + 0.02, yb + 0.012, 0.1), (x0 + 0.02, 0, 0.1)], (-1, 0, 0), VERM, corpo)
    fp([(x0 + 0.02, 0, 0), (x1 - 0.02, 0, 0), (x1 - 0.02, 0, 0.1), (x0 + 0.02, 0, 0.1)], (0, -1, 0), VERM, corpo)
    fp([(x0 + 0.02, yb, 0.1), (x0 + 0.03, yb, 0.1), (x0 + 0.03, 0, 0.1), (x0 + 0.02, 0, 0.1)], (0, 0, 1), liso('#c0573c'), corpo)
    fp([(x0 + 0.02, yb, 0.1), (x1 - 0.02, yb, 0.1), (x1 - 0.02, yb + 0.012, 0.1), (x0 + 0.02, yb + 0.012, 0.1)], (0, 0, 1), liso('#c0573c'), corpo)
    pegadas.append((x0, x1, 0, yb + 0.02))

    # ---- a chapa de ferro com as bocas (os anéis; a de cima do fogo com a fresta em brasa) ----
    brasa = [hx('#ff9a3a'), hx('#d0481c')]

    def chapa_topo(L, n, P):
        out = np.tile(hx('#423d3a'), (len(P), 1))
        X, Y = P[:, 0], P[:, 1]
        # a borda da chapa (uma moldura 1 tom acima)
        bd = (X < x0 + 0.04) | (X > x1 - 0.04) | (Y > yb + 0.04 - 0.035)
        # o ferro polido pelo uso: faixas ao comprido um tom acima, mais largas perto da frente, e o risco de luz
        fr = (yb + 0.04 - 0.035) - Y
        pol = ((fr > 0.05) & (fr < 0.05 + 3 * PH)) | ((fr > 0.2) & (fr < 0.2 + 2 * PH)) | ((fr > 0.4) & (fr < 0.4 + PH))
        pol &= np.sin(X * 9.0 + 1.3) > -0.4
        out = np.where(pol[:, None], hx('#4e4844'), out)
        out = np.where(((fr > 0.05 + PH) & (fr < 0.05 + 2 * PH) & (np.sin(X * 9.0 + 1.3) > 0.3))[:, None], hx('#605954'), out)
        out = np.where(bd[:, None], hx('#4b4642'), out)
        # a moldura da chapa: a beira de dentro em sombra (1 px) e a de fora com a luz (1 px)
        bdi = ~bd & ((X < x0 + 0.04 + PH) | (X > x1 - 0.04 - PH) | (Y > yb + 0.005 - PH))
        out = np.where(bdi[:, None], hx('#35302e'), out)
        out = np.where(((Y > yb + 0.04 - PH) | (X < x0 + PH))[:, None], hx('#5e5752'), out)
        for k, (bx, by) in enumerate(BOCAS):
            r = np.hypot(X - bx, Y - by)
            # a boca: o disco um tom abaixo da chapa, os anéis (a fresta escura e o aro claro do lado da luz); a
            # boca do fogo está sem as argolas de dentro (o buraco é pintado pelo fogo)
            out = np.where((r < 0.135)[:, None], hx('#35312e'), out)
            for ra in ((0.135,) if k == 0 else (0.135, 0.095, 0.055)):
                fresta = np.abs(r - ra) < PH * 0.55
                aro = (r - ra > PH * 0.55) & (r - ra < PH * 1.6)
                out = np.where(aro[:, None], hx('#5c5550'), out)
                out = np.where(fresta[:, None], hx('#1c1918'), out)
            if aceso:
                # a fresta de fora da boca em cima do fogo fica em brasa; a outra, só um fio
                q = np.abs(r - 0.135) < PH * 0.55
                lado = (Y - by) - (X - bx)
                out = np.where((q & ((lado > -0.04) if k == 1 else (r > 0)))[:, None], brasa[0] if k == 0 else brasa[1], out)
        return out
    och = c.novo_obj(3)
    c.caixa((x0, x1, 0, yb + 0.04, zc, zt), {'cima': emissivo(chapa_topo), '*': _pau('#2e2a28', quina=1.35, b=(0, 0, 0, 0, zc, zt))}, M, och)

    # ---- a fornalha: a boca com o batente de ferro, o vão de tijolo escuro por dentro, a porta aberta ----
    dentro = c.novo_obj(3)
    fp([(m - bw, yf, zp), (m + bw, yf, zp), (m + bw, yb, zp), (m - bw, yb, zp)], (0, 0, 1), liso('#2a1a14'), dentro)
    TJE = tijolos(cores=('#3c2820', '#35231c', '#432d24'), junta='#1c120e')
    fp([(m - bw, yf, zp), (m + bw, yf, zp), (m + bw, yf, bt), (m - bw, yf, bt)], (0, 1, 0), TJE, dentro)
    fp([(m - bw, yf, zp), (m - bw, yb, zp), (m - bw, yb, bt), (m - bw, yf, bt)], (1, 0, 0), tijolos(eixo='x', cores=('#5a3e30', '#4e362a', '#624434'), junta='#2a1c16'), dentro)
    FE = ferro()
    e = 0.035
    for b in ((m - bw - e, m - bw, yb, yb + 0.022, zp - e, bt + e), (m + bw, m + bw + e, yb, yb + 0.022, zp - e, bt + e),
              (m - bw, m + bw, yb, yb + 0.022, bt, bt + e), (m - bw, m + bw, yb, yb + 0.022, zp - e, zp)):
        _barra(b, '#34302d', '#4a4541', quina=1.3)
    # a portinhola da fornalha aberta para baixo (presa embaixo): fica deitada na frente da boca, de ferro fundido
    # com a moldura em relevo, o losango e a tramela de latão; não tapa o fogo nem o forno
    dz0, dlen, desp = zp - e, 0.22, 0.022
    dx0, dx1 = m - bw - e + 0.008, m + bw + e - 0.008

    def portinhola(L, n, P):
        out = np.tile(hx('#3e3935'), (len(P), 1))
        if n[2] > 0.5:
            s = P[:, 1] - (yb + 0.022)                     # da dobradiça para a ponta
            X = P[:, 0]
            borda = (s > 0.035) & (s < dlen - 0.035) & (X > dx0 + 0.035) & (X < dx1 - 0.035)
            out = np.where(borda[:, None], hx('#2e2a28'), out)
            out = np.where((borda & ((np.abs(s - 0.035) < 1.3 * PH) | (np.abs(X - (dx0 + 0.035)) < PH)))[:, None], hx('#1c1918'), out)
            out = np.where((borda & ((np.abs(s - (dlen - 0.035)) < 1.3 * PH) | (np.abs(X - (dx1 - 0.035)) < PH)))[:, None], hx('#5c5550'), out)
            los = np.abs((X - m) / 0.08) + np.abs((s - dlen / 2) / 0.07) < 1
            out = np.where(los[:, None], hx('#4a4541'), out)
            out = np.where((los & (np.abs((X - m) / 0.08) + np.abs((s - dlen / 2) / 0.07) > 0.55))[:, None], hx('#5e5752'), out)
            out = np.where(((s > dlen - 0.03) & (np.abs(X - m) < 0.035))[:, None], hx('#d4a84a'), out)
        return out
    op = c.novo_obj(3)
    c.caixa((dx0, dx1, yb + 0.022, yb + 0.022 + dlen, dz0 - desp, dz0), {'cima': emissivo(portinhola), '*': _pau('#2a2624', '#4e4844', quina=1.2, b=(0, 0, 0, 0, dz0 - desp, dz0))}, M, op)
    for xx in (dx0 + 0.03, dx1 - 0.06):
        _barra((xx, xx + 0.03, yb, yb + 0.03, dz0 - desp - 0.004, dz0 + 0.004), '#2a2624', '#4a4541', quina=False)

    # ---- o cinzeiro embaixo da fornalha (as frestas em brasa) ----
    zc0, zc1 = 0.08, 0.3

    def cinzeiro(L, n, P):
        out = np.tile(hx('#36322f'), (len(P), 1))
        if n[1] > 0.5:
            z = P[:, 2]
            X = P[:, 0]
            # as três frestas em brasa (2 px: a de cima mais viva, pulsando com o fogo)
            pul = 0.5 + 0.5 * math.sin(2 * math.pi * FOGO_T['t'])
            for k in range(3):
                zz = zc0 + 0.02 + k * 0.042
                lar = np.abs(X - m) < bw - 0.06
                fr1 = (z > zz) & (z <= zz + PZ) & lar
                fr2 = (z > zz + PZ) & (z <= zz + 2 * PZ) & lar
                if aceso:
                    out = np.where(fr1[:, None], hx('#c8481c'), out)
                    out = np.where(fr2[:, None], hx('#ffb040') if (pul > 0.5) != (k == 1) else hx('#f08a2a'), out)
                else:
                    out = np.where((fr1 | fr2)[:, None], hx('#141210'), out)
                out = np.where(((z > zz + 2 * PZ) & (z <= zz + 3 * PZ) & lar)[:, None], hx('#4e4844'), out)
        return out
    o = c.novo_obj(3)
    c.caixa((m - bw + 0.01, m + bw - 0.01, yb, yb + 0.018, zc0, zc1), {'frente': emissivo(cinzeiro), '*': _pau('#2e2a28', '#4a4541', quina=1.3, b=(0, 0, 0, 0, zc0, zc1))}, M, o)

    # ---- o forno: a porta de ferro com a moldura, o puxador e o termômetro ----
    fx0, fx1, fz0, fz1 = 1.62, 2.24, 0.39, 0.72

    def forno(L, n, P):
        out = np.tile(hx('#3a3532'), (len(P), 1))
        if n[1] > 0.5:
            X, z = P[:, 0], P[:, 2]
            dentro_ = (X > fx0 + 0.04) & (X < fx1 - 0.04) & (z > fz0 + 0.04) & (z < fz1 - 0.1)
            out = np.where(dentro_[:, None], hx('#2e2a28'), out)
            out = np.where((dentro_ & ((np.abs(z - (fz1 - 0.1)) < 1.2 * PZ) | (np.abs(X - (fx0 + 0.04)) < PH)))[:, None], hx('#1c1918'), out)
            out = np.where((dentro_ & ((np.abs(z - (fz0 + 0.04)) < 1.2 * PZ) | (np.abs(X - (fx1 - 0.04)) < PH)))[:, None], hx('#565049'), out)
            # o termômetro (o mostrador redondo creme com o ponteiro)
            r = np.hypot((X - (fx0 + fx1) / 2) * KX, (z - (fz1 - 0.055)) * KZ)
            out = np.where((r < 2.6)[:, None], hx('#e8dcc0'), out)
            out = np.where(((r >= 2.6) & (r < 3.6))[:, None], hx('#b88a3a'), out)
            out = np.where(((r < 2.0) & (np.abs((X - (fx0 + fx1) / 2) * KX - (z - (fz1 - 0.055)) * KZ) < 0.6) & (X > (fx0 + fx1) / 2))[:, None], hx('#a8302a'), out)
        return out
    o = c.novo_obj(3)
    c.caixa((fx0, fx1, yb, yb + 0.02, fz0, fz1), {'frente': emissivo(forno), '*': _pau('#2e2a28', '#4a4541', quina=1.3, b=(0, 0, 0, 0, fz0, fz1))}, M, o)
    # o puxador do forno (a barra de latão nos dois suportes)
    _barra((fx0 + 0.1, fx1 - 0.1, yb + 0.045, yb + 0.06, fz1 - 0.15, fz1 - 0.13), '#c89a3e', '#e8c060', quina=False)
    for xx in (fx0 + 0.1, fx1 - 0.12):
        _barra((xx, xx + 0.02, yb + 0.02, yb + 0.06, fz1 - 0.15, fz1 - 0.13), '#8a6a2a', quina=False)

    # ---- o nicho da lenha embaixo do forno: o vão escuro e as toras empilhadas (as pontas para a frente) ----
    nx0, nx1, nz0, nz1 = nicho
    on = c.novo_obj(3)
    fp([(nx0, 0.32, nz0), (nx1, 0.32, nz0), (nx1, yb, nz0), (nx0, yb, nz0)], (0, 0, 1), liso('#2e2016'), on)
    fp([(nx0, 0.32, nz0), (nx1, 0.32, nz0), (nx1, 0.32, nz1), (nx0, 0.32, nz1)], (0, 1, 0), liso('#22170f'), on)
    fp([(nx0, 0.32, nz0), (nx0, yb, nz0), (nx0, yb, nz1), (nx0, 0.32, nz1)], (1, 0, 0), liso('#3a2a1e'), on)
    # três toras grandes embaixo e uma em cima, encaixada (as pontas claras com os anéis e a casca escura)
    r = 0.078
    # lenha=False: o nicho vazio (Santo Berço guarda ali os cristais de reserva; quem desenha é o santo_berco_cristal)
    for k, xx in enumerate((nx0 + 0.095, nx0 + 0.265, nx0 + 0.435) if lenha else ()):
        tora_y(xx, nz0 + r, r, 0.36, yb - 0.015 - 0.02 * (k % 2), casca=('#5e3c22', '#6a4428', '#553620')[k], miolo=('#e8c48c', '#dcb47a', '#e4be84')[k], lados=12)
    if lenha:
        tora_y(nx0 + 0.18, nz0 + r + 1.62 * r, r * 0.92, 0.36, yb - 0.035, casca='#6a4428', miolo='#eccb94', lados=12)

    # ---- o varão de latão na frente da chapa, com o pano de prato xadrez ----
    for xx in (x0 + 0.05, x1 - 0.07):
        _barra((xx, xx + 0.02, yb + 0.04, yb + 0.1, zc - 0.045, zc - 0.03), '#8a6a2a', quina=False)
    _barra((x0 + 0.04, x1 - 0.04, yb + 0.085, yb + 0.1, zc - 0.05, zc - 0.03), '#c89a3e', '#ecc868', quina=False)
    px0, px1, pz0 = 1.74, 1.96, 0.55
    yv = yb + 0.092

    def xadrez(L, n, P):
        X, z = P[:, 0], P[:, 2]
        i = np.floor((X - px0) / (3 * PH))
        j = np.floor((z - pz0) / (3 * PZ))
        k = (i % 2) + (j % 2)
        out = np.where((k == 0)[:, None], hx('#f2ece0'), np.where((k == 1)[:, None], hx('#d88a7c'), hx('#b8402e')))
        out = np.where((z < pz0 + 2 * PZ)[:, None], _tom(out, 0.86), out)      # a barra (a bainha)
        return out
    o = c.novo_obj(3)
    fp([(px0, yv + 0.02, pz0), (px1, yv + 0.02, pz0), (px1, yv + 0.02, zc - 0.03), (px0, yv + 0.02, zc - 0.03)], (0, 1, 0), emissivo(xadrez), o)
    fp([(px0, yv - 0.012, zc - 0.03), (px1, yv - 0.012, zc - 0.03), (px1, yv + 0.02, zc - 0.03), (px0, yv - 0.012, zc - 0.03)], (0, 0, 1), liso('#e8dccc'), o)
    fp([(px1, yv - 0.012, pz0 + 0.06), (px1, yv + 0.02, pz0), (px1, yv + 0.02, zc - 0.03), (px1, yv - 0.012, zc - 0.03)], (1, 0, 0), emissivo(xadrez), o)

    # ---- a chaleira esmaltada na outra boca e o bule de café no canto de trás da chapa ----
    chaleira(BOCAS[1][0], BOCAS[1][1] + 0.01, zt)
    bule(2.86, 0.15, zt)

    # ---- a chaminé de tijolinho: sai da chapa, sobe, atravessa a viga e some (sai pelo telhado: sem tampa) ----
    cx0, cx1, cy0, cy1 = CHAM
    zch = ALTO + 1.25
    oc = c.novo_obj(3, sombra=False)
    c.caixa((cx0, cx1, cy0, cy1, zt, zch), {'frente': tijolos('y', org=cx0), 'costas': tijolos('y', org=cx0), 'dir': tijolos('x', org=-cy1),
                                            'esq': tijolos('x', org=-cy1), 'cima': liso('#c9c8c2')}, M, oc)
    # o colarinho de ferro no pé da chaminé
    _barra((cx0 - 0.02, cx1 + 0.02, cy0, cy1 + 0.02, zt, zt + 0.05), '#34302d', '#4a4541', quina=1.3)
    fades.append((oc, ALTO + 0.45, 0.8))


def chaleira(x, y, z):
    """A chaleira de esmalte vermelho: o corpo, a tampa em cúpula com o pegador, o bico e a alça."""
    o = c.novo_obj(3)
    r = 0.095

    def faixa(P, base):
        zz = P[:, 2] - z
        return np.where(((zz > 0.008) & (zz <= 0.008 + PZ))[:, None], hx('#f0e8da'), base)
    _poligono_rodado(x, y, [(z, r * 0.94), (z + 0.03, r), (z + 0.1, r), (z + 0.13, r * 0.8), (z + 0.15, r * 0.42)],
                     vol(x, y, '#c03a2c', brilho=0.45, faixas=faixa), o, lados=22, tampa_mat=liso('#a83226'))
    c.cilindro(x, y, 0.018, z + 0.15, z + 0.17, vol(x, y, '#2a2420'), M, o, lados=10, tampa_mat=liso('#3a3430'))
    ob = c.novo_obj(3)
    _fita([(0.06, z + 0.05), (0.11, z + 0.09), (0.15, z + 0.135), (0.165, z + 0.15)], x, y, liso('#b23628'), ob, 0.028)
    oa = c.novo_obj(3)
    arco = [(-0.075 + 0.15 * i / 8, z + 0.16 + 0.085 * math.sin(math.pi * i / 8)) for i in range(9)]
    _fita(arco, x, y, liso('#2a2420'), oa, 0.02)
    itens_peq.append((x - r, x + r, y - r, y + r, z))


def bule(x, y, z):
    """O bule de café de ágata azul: o corpo em tronco de cone, a tampa, o bico e a asa."""
    o = c.novo_obj(3)
    r = 0.065

    def borda(P, base):
        zz = P[:, 2] - z
        return np.where((zz > 0.13 - PZ)[:, None], hx('#e8e4dc'), base)
    _poligono_rodado(x, y, [(z, r), (z + 0.09, r * 0.8), (z + 0.13, r * 0.62)], vol(x, y, '#3e6a9a', brilho=0.45, faixas=borda), o, lados=18,
                     tampa_mat=liso('#36608c'))
    c.cilindro(x, y, 0.014, z + 0.13, z + 0.15, vol(x, y, '#2a2420'), M, o, lados=8, tampa_mat=liso('#3a3430'))
    ob = c.novo_obj(3)
    _fita([(0.05, z + 0.06), (0.085, z + 0.1), (0.1, z + 0.125)], x, y, liso('#36608c'), ob, 0.024)
    _fita([(-0.05, z + 0.11), (-0.09, z + 0.1), (-0.095, z + 0.05), (-0.06, z + 0.03)], x, y, liso('#2c4e74'), ob, 0.018)
    itens_peq.append((x - r, x + r, y - r, y + r, z))


def panela(x, y, z):
    """A panela de ferro: o corpo baixo, as duas alças, a tampa abaulada e o pegador."""
    o = c.novo_obj(3)
    r = 0.115
    _poligono_rodado(x, y, [(z, r * 0.92), (z + 0.02, r), (z + 0.11, r)], vol(x, y, '#3a3a3e', brilho=0.5), o, lados=24)
    _poligono_rodado(x, y, [(z + 0.11, r + 0.008), (z + 0.125, r * 0.85), (z + 0.145, r * 0.4)], vol(x, y, '#4a4a50', brilho=0.5), o, lados=24,
                     tampa_mat=liso('#56565c'))
    c.cilindro(x, y, 0.02, z + 0.145, z + 0.165, vol(x, y, '#1e1c1c'), M, o, lados=10, tampa_mat=liso('#3a3634'))
    for s in (-1, 1):
        k = 1 / math.sqrt(2)
        _barra((x + s * (r + 0.005) * k - 0.02, x + s * (r + 0.005) * k + 0.02, y - s * (r + 0.005) * k - 0.02, y - s * (r + 0.005) * k + 0.02, z + 0.08, z + 0.1), '#2a2a2e', '#4a4a50', quina=False)
    itens_peq.append((x - r, x + r, y - r, y + r, z))


# =====================================================================================================================
# a pia (2 x 1 casas, giro 4, encostada no fundo, 0,9 m): a bancada de granito, a cuba, a torneira, o escorredor
# com os pratos e a cortininha de xadrez embaixo
# =====================================================================================================================
PIA = dict(x0=3.0, x1=4.5, d=0.62, zt=0.9, cx0=3.64, cx1=4.24, cy0=0.1, cy1=0.48, cz=0.7)


def granito(L, n, P):
    """
    O granito cinza-bege salpicado: grãos de 1 e de 2 px (deitados) em quatro tons (o preto, o cinza, o bege e o
    branco), sem formar risca; no tampo, a beira da frente polida (1 px de luz).
    """
    X, Y, Z = P[:, 0], P[:, 1], P[:, 2]
    a = np.floor(X / PH) if n[2] > 0.5 else np.floor((X if abs(n[1]) > 0.5 else Y) / PH)
    b = np.floor(Y / PH) if n[2] > 0.5 else np.floor(Z / PZ)
    r = ruido(a, b, 41.0)
    r2 = ruido(np.floor(a / 2), b, 43.0)             # os grãos de 2 px
    out = np.tile(hx('#9c958a'), (len(P), 1))
    out = np.where((ruido(np.floor(a / 3), np.floor(b / 2), 47.0) > 0.6)[:, None], hx('#948d82'), out)   # a nuvem do fundo
    out = np.where((r2 > 0.9)[:, None], hx('#6a645c'), out)
    out = np.where((r2 < 0.05)[:, None], hx('#b8ad9a'), out)
    out = np.where((r > 0.93)[:, None], hx('#4e4a45'), out)
    out = np.where((r < 0.06)[:, None], hx('#d4cec2'), out)
    out = np.where(((r > 0.45) & (r < 0.5))[:, None], hx('#a89c88'), out)
    return out


def pia():
    x0, x1, d, zt = PIA['x0'], PIA['x1'], PIA['d'], PIA['zt']
    cx0, cx1, cy0, cy1, cz = PIA['cx0'], PIA['cx1'], PIA['cy0'], PIA['cy1'], PIA['cz']
    zb = zt - 0.05
    G = emissivo(granito)
    # a bancada: o tampo em volta da cuba (4 pedaços), a frente e o lado
    o = c.novo_obj(3)
    for (a0, a1, b0, b1) in ((x0, cx0, 0, d), (cx1, x1, 0, d), (cx0, cx1, 0, cy0), (cx0, cx1, cy1, d)):
        fp([(a0, b0, zt), (a1, b0, zt), (a1, b1, zt), (a0, b1, zt)], (0, 0, 1), G, o)
    fp([(x0, d, zb), (x1, d, zb), (x1, d, zt), (x0, d, zt)], (0, 1, 0), G, o)
    fp([(x1, 0, zb), (x1, d, zb), (x1, d, zt), (x1, 0, zt)], (1, 0, 0), G, o)
    fp([(x0, 0, zb), (x0, d, zb), (x0, d, zt), (x0, 0, zt)], (-1, 0, 0), G, o)
    fp([(x0, 0, zb), (x1, 0, zb), (x1, 0, zt), (x0, 0, zt)], (0, -1, 0), G, o)
    # a cuba de inox (o fundo, a parede de trás e a da esquerda, que a câmera vê) e o ralo
    def inox(L, n, P):
        out = np.tile(hx('#a9b1b4'), (len(P), 1))
        if n[2] > 0.5:
            rr = np.hypot((P[:, 0] - (cx0 + cx1) / 2) * KX, (P[:, 1] - (cy0 + cy1) / 2) * KY)
            out = np.where((rr < 1.6)[:, None], hx('#4a5054'), out)
            out = np.where(((P[:, 0] + P[:, 1]) % 0.16 < 0.025)[:, None], hx('#c4cccf'), out)
        else:
            out = np.where((P[:, 2] > zt - 2 * PZ)[:, None], hx('#7e868a'), out)
        return out
    oc = c.novo_obj(3)
    fp([(cx0, cy0, cz), (cx1, cy0, cz), (cx1, cy1, cz), (cx0, cy1, cz)], (0, 0, 1), emissivo(inox), oc)
    fp([(cx0, cy0, cz), (cx1, cy0, cz), (cx1, cy0, zt), (cx0, cy0, zt)], (0, 1, 0), emissivo(inox), oc)
    fp([(cx0, cy0, cz), (cx0, cy1, cz), (cx0, cy1, zt), (cx0, cy0, zt)], (1, 0, 0), emissivo(inox), oc)
    # as outras duas paredes da cuba (de costas para a câmera da cena; o móvel girado as mostra)
    fp([(cx0, cy1, cz), (cx1, cy1, cz), (cx1, cy1, zt), (cx0, cy1, zt)], (0, -1, 0), emissivo(inox), oc)
    fp([(cx1, cy0, cz), (cx1, cy1, cz), (cx1, cy1, zt), (cx1, cy0, zt)], (-1, 0, 0), emissivo(inox), oc)
    # os pés de alvenaria nas pontas (creme, a barra vermelha embaixo)
    for (a0, a1) in ((x0, x0 + 0.07), (x1 - 0.07, x1)):
        caixa((a0, a1, 0, d - 0.03, 0.1, zb), {'*': _pau('#e2d8c2', '#ece4d2', quina=False), 'frente': _pau('#e2d8c2', quina=False)})
        caixa((a0, a1, 0, d - 0.02, 0, 0.1), _pau('#a8432e', '#c0573c', quina=1.2, b=(0, 0, 0, 0, 0, 0.1)))
    # o fundo embaixo da bancada (a parede de alvenaria entre os pés: as costas da pia girada), com a barra vermelha
    def reboco(L, n, P):
        out = np.tile(hx('#e2d8c2'), (len(P), 1))
        out = np.where((P[:, 2] < 0.1)[:, None], hx('#a8432e'), out)
        out = np.where(((P[:, 2] >= 0.1 - PZ) & (P[:, 2] < 0.1))[:, None], hx('#c0573c'), out)
        if n[1] > 0.5:                                   # por dentro (atrás da cortina): na sombra
            out = _tom(out, 0.62)
        return out
    caixa((x0 + 0.07, x1 - 0.07, 0.0, 0.03, 0.0, zb), {'*': emissivo(reboco), 'cima': liso('#c8bea8')}, sombra=False)
    pegadas.append((x0, x1, 0, d))
    # a cortininha de xadrez vermelho (franzida em pregas, duas folhas, presa embaixo da bancada)
    cortininha(x0 + 0.07, x1 - 0.07, d - 0.05, 0.03, zb - 0.005)
    # a torneira cromada saindo da parede
    xt = (cx0 + cx1) / 2 + 0.03
    CR = ('#a4aeb2', '#e8eef0')
    o = c.novo_obj(3)
    c.caixa((xt - 0.05, xt + 0.05, 0, 0.02, 1.0, 1.1), _pau('#8e989c', '#c8d0d4', quina=False), M, o)               # o espelho na parede
    c.caixa((xt - 0.025, xt + 0.025, 0.02, 0.26, 1.04, 1.085), _pau(CR[0], CR[1], quina=1.25, b=(0, 0, 0, 0, 1.04, 1.085)), M, o)  # o cano
    c.caixa((xt - 0.025, xt + 0.025, 0.21, 0.26, 0.97, 1.04), _pau(CR[0], CR[1], quina=False), M, o)              # o bico
    c.caixa((xt - 0.06, xt + 0.06, 0.06, 0.09, 1.085, 1.105), _pau('#b8343a', '#d85050', quina=False), M, o)       # a cruzeta (vermelha)
    c.caixa((xt - 0.015, xt + 0.015, 0.06, 0.09, 1.085, 1.13), _pau(CR[0], CR[1], quina=False), M, o)
    # o escorredor de arame com os pratos em pé e as canecas de boca para baixo
    escorredor(x0 + 0.08, cx0 - 0.08, 0.1, 0.5, zt)
    # a bucha amarela e o sabão em barra na beira da cuba
    _barra((cx1 + 0.05, cx1 + 0.15, 0.12, 0.2, zt, zt + 0.035), '#d8b83a', '#f0d860', quina=False)
    _barra((cx1 + 0.05, cx1 + 0.14, 0.26, 0.34, zt, zt + 0.03), '#6e9a5a', '#8ab874', quina=False)
    itens_peq.extend([(cx1 + 0.05, cx1 + 0.15, 0.12, 0.2, zt), (cx1 + 0.05, cx1 + 0.14, 0.26, 0.34, zt)])


def cortininha(x0, x1, yf, z0, z1):
    """A cortina franzida embaixo da pia: pregas em zigue-zague, o xadrez vermelho e creme, a bainha e a fresta do meio."""
    meio = (x0 + x1) / 2
    passo = 0.05
    fundo = 0.022

    def mat(lado):
        def f(L, n, P):
            X, Z = P[:, 0], P[:, 2]
            i = np.floor((X - x0) / (3 * PH))
            j = np.floor((Z - z0) / (3 * PZ))
            k = (i % 2) + (j % 2)
            out = np.where((k == 0)[:, None], hx('#f2e8d8'), np.where((k == 1)[:, None], hx('#d68a7a'), hx('#b43a2c')))
            if lado < 0:
                out = _tom(out, 0.86)
            out = np.where((Z < z0 + 2 * PZ)[:, None], _tom(out, 0.84), out)
            out = np.where((Z > z1 - PZ)[:, None], _tom(out, 0.8), out)
            return out
        return emissivo(f)
    claro, escuro = mat(1), mat(-1)
    o = c.novo_obj(3)
    for (a0, a1) in ((x0, meio - 0.008), (meio + 0.008, x1)):
        n = max(2, int(round((a1 - a0) / passo)))
        xs = np.linspace(a0, a1, n + 1)
        for i in range(n):
            ya = yf + (fundo if i % 2 else 0.0)
            yb_ = yf + (0.0 if i % 2 else fundo)
            # a bainha balança um tiquinho para fora embaixo
            pts = [(xs[i], ya, z0), (xs[i + 1], yb_, z0), (xs[i + 1], yb_, z1), (xs[i], ya, z1)]
            dx, dy = xs[i + 1] - xs[i], yb_ - ya
            nn = (-dy, dx, 0)
            fp(pts, nn, claro if i % 2 == 0 else escuro, o)
        # a fita de cima (o franzido) em cima da folha
    _barra((x0, x1, yf - 0.01, yf + fundo + 0.008, z1 - 0.025, z1), '#c04a3a', '#d06050', quina=False)


def escorredor(x0, x1, y0, y1, z):
    """O escorredor de arame: a bandeja, os arames de pé, os pratos (de frente) e as canecas emborcadas."""
    FIO = ('#9aa0a4', '#d0d6da')
    _barra((x0, x1, y0, y1, z, z + 0.015), FIO[0], FIO[1], quina=False)
    for (a, b) in ((x0, y0), (x1 - 0.012, y0), (x0, y1 - 0.012), (x1 - 0.012, y1 - 0.012)):
        _barra((a, a + 0.012, b, b + 0.012, z, z + 0.12), FIO[0], FIO[1], quina=False)
    _barra((x0, x1, y1 - 0.012, y1, z + 0.11, z + 0.12), FIO[0], FIO[1], quina=False)
    xm = x0 + (x1 - x0) * 0.4
    for k, yy in enumerate(np.linspace(y0 + 0.08, y1 - 0.06, 5)):
        prato_pe(xm, yy, z + 0.015 + 0.105, 0.105, ('#3e5f8e', '#a8442e')[k % 2])
    for (yy, cor) in ((y0 + 0.12, '#e8e2d4'), (y0 + 0.3, '#3e5f8e')):
        o = c.novo_obj(3)
        xx = x1 - 0.06
        c.cilindro(xx, yy, 0.04, z + 0.015, z + 0.1, vol(xx, yy, cor, brilho=0.3), M, o, lados=14, tampa_mat=liso(cor))


def prato_pe(cx, y, cz, r, aro='#3e5f8e', normal='y'):
    """Um prato em pé de frente para a câmera (no plano y, ou no plano x): a borda colorida, o fundo branco e a sombra."""
    def f(L, n, P):
        a = P[:, 0] - cx if normal == 'y' else P[:, 1] - cx
        rr = np.hypot(a / r, (P[:, 2] - cz) / r)
        out = np.tile(hx('#f2eee4'), (len(P), 1))
        out = np.where(((rr > 0.62) & (rr < 0.7))[:, None], hx('#d8d2c4'), out)
        out = np.where((rr > 0.84)[:, None], hx(aro), out)
        out = np.where(((rr > 0.72) & (rr < 0.84) & (P[:, 2] > cz + 0.2 * r))[:, None], hx('#ffffff'), out)
        return out
    o = c.novo_obj(3)
    lados = 20
    if normal == 'y':
        pts = [(cx + r * math.cos(2 * math.pi * i / lados), y, cz + r * math.sin(2 * math.pi * i / lados)) for i in range(lados)]
        c.face_plana(pts, (0, 1, 0), emissivo(f), M, o, dois_lados=True)
    else:
        pts = [(y, cx + r * math.cos(2 * math.pi * i / lados), cz + r * math.sin(2 * math.pi * i / lados)) for i in range(lados)]
        c.face_plana(pts, (1, 0, 0), emissivo(f), M, o, dois_lados=True)
    return o


# =====================================================================================================================
# o armário de cozinha (o louceiro: 2 x 1 casas, 1,9 m): embaixo as gavetas e as portas, a bancada, o vão aberto e
# em cima o guarda-louça com as portas de vidro, a louça nas prateleiras e a cimalha
# =====================================================================================================================
CREME, CREME_L, CREME_E = '#e2d6bc', '#efe6d2', '#c8b99a'


# ---- os móveis de abrir: o interior escuro e as folhas de porta que giram ----
def _dentro_cz(cor, z0, z1):
    """O interior de um armário aberto: escuro, com a sombra do alto (degraus) e um fio claro no chão do vão."""
    c0 = hx(cor)

    def f(L, n, P):
        z = P[:, 2]
        out = np.tile(c0, (len(P), 1))
        out = np.where((z > z1 - 5 * PZ)[:, None], _tom(c0, 0.82), out)
        out = np.where((z > z1 - 2 * PZ)[:, None], _tom(c0, 0.64), out)
        out = np.where((z < z0 + 1.5 * PZ)[:, None], _tom(c0, 1.15), out)
        return out
    return emissivo(f)


def _folha_cz(H, dd0, nrm, alfa, W, z0, z1, mat_f, mat_d, mat_b, esp=0.026):
    """
    A folha de porta aberta: dobradiça em H (x, y); fechada ela vai de H na direção dd0 e a frente olha para nrm;
    aberta de alfa graus. mat_f (o lado de fora, o que era a frente) e mat_d (o de dentro) são funções (d, H) -> material,
    que recebem a direção da folha para a almofada medir o u ao longo dela. Devolve (d, n_fora).
    """
    a = math.radians(alfa)
    d = (math.cos(a) * dd0[0] + math.sin(a) * nrm[0], math.cos(a) * dd0[1] + math.sin(a) * nrm[1])
    nf = (math.cos(a) * nrm[0] - math.sin(a) * dd0[0], math.cos(a) * nrm[1] - math.sin(a) * dd0[1])
    A, Bq = (H[0], H[1]), (H[0] + W * d[0], H[1] + W * d[1])
    A2, B2 = (A[0] - esp * nf[0], A[1] - esp * nf[1]), (Bq[0] - esp * nf[0], Bq[1] - esp * nf[1])
    o = c.novo_obj(3)

    def q(P, Q, nn, m):
        fp([(P[0], P[1], z0), (Q[0], Q[1], z0), (Q[0], Q[1], z1), (P[0], P[1], z1)], nn, m, o)
    q(A, Bq, (nf[0], nf[1], 0), mat_f(d, H))
    q(B2, A2, (-nf[0], -nf[1], 0), mat_d(d, H))
    q(A2, A, (-d[0], -d[1], 0), mat_b)
    q(Bq, B2, (d[0], d[1], 0), mat_b)
    fp([(A[0], A[1], z1), (Bq[0], Bq[1], z1), (B2[0], B2[1], z1), (A2[0], A2[1], z1)], (0, 0, 1), mat_b, o)
    return d, nf


def _puxador_folha(H, d, nf, u, z):
    """O puxador (botão escuro) na face de fora de uma folha aberta, a u da dobradiça."""
    px, py = H[0] + u * d[0] + nf[0] * 0.016, H[1] + u * d[1] + nf[1] * 0.016
    _barra((px - 0.018, px + 0.018, py - 0.018, py + 0.018, z - 0.015, z + 0.015), '#5a4a3a', '#8a7a62', quina=False)


def _vidro_folha(zu0, zu1, zp0, zp1, W):
    """A folha de porta de vidro aberta: o caixilho creme (a borda e a travessa) e o vidro com o brilho."""
    def mk(d, H):
        def f(L, n, P):
            u = (P[:, 0] - H[0]) * d[0] + (P[:, 1] - H[1]) * d[1]
            z = P[:, 2]
            out = np.tile(hx('#a8c0c4'), (len(P), 1))
            g = np.floor(u / PH) + np.floor(z / PZ)
            out = np.where(((g % 17) < 2)[:, None], hx('#d4e6e8'), out)
            borda = (u < 0.04) | (u > W - 0.04) | (z < zu0 + 0.04) | (z > zu1 - 0.04) | ((z > zp0) & (z < zp1))
            return np.where(borda[:, None], hx(CREME), out)
        return emissivo(f)
    return mk


def _balcao_aberto(B, o0, W, DL, ZB, meio, pain, pintado, COSTAS, vazio):
    """
    O balcão de baixo do armário de cozinha (face +y) com as duas portas abertas: o vão escuro (laterais, fundo, chão e
    uma prateleira), a faixa das duas gavetas fechada em cima e as folhas abertas pelas dobradiças de fora.
    """
    e = 0.03
    ZG = 0.66                                    # onde começam as gavetas (o vão vai do chão até aqui)
    IN = _dentro_cz('#4a3a2c', 0.07, ZG)
    caixa(B(0, W, 0, e, 0.07, ZG), {'frente': IN, 'costas': COSTAS, '*': pintado()})
    caixa(B(0, e, e, DL, 0.07, ZG), {'dir': IN, '*': pintado()})
    caixa(B(W - e, W, e, DL, 0.07, ZG), {'esq': IN, '*': pintado()})
    caixa(B(e, W - e, e, DL, 0.07, 0.07 + e), {'cima': liso('#5a4a3a'), '*': pintado()})
    caixa(B(0, W, 0, DL, ZG, ZB), {'frente': pintado(pain[:2]), 'costas': COSTAS, '*': pintado(), 'cima': liso(CREME)})
    # o que o armário guarda no chão do vão: as tigelas de ágata, a panela de ferro e os potes de barro
    zp = 0.07 + e
    if not vazio:
        for k in range(3):
            o = c.novo_obj(3)
            zz = zp + k * 0.03
            ux, uy = o0 + 0.2, 0.3
            _poligono_rodado(ux, uy, [(zz, 0.05), (zz + 0.03, 0.085)], vol(ux, uy, ('#ece6da', '#3e6a9a', '#ece6da')[k], brilho=0.3), o,
                             lados=16, tampa_mat=liso('#d8d0c0'))
        o = c.novo_obj(3)
        px, py = o0 + 0.45, 0.3
        c.cilindro(px, py, 0.13, zp, zp + 0.16, vol(px, py, '#2a2a2c', brilho=0.4), M, o, lados=18, tampa_mat=liso('#16161a'))
        BE.pote_barro(o0 + W - 0.2, 0.3, zp, r=0.1, h=0.26)
        BE.pote_barro(o0 + W - 0.4, 0.22, zp, r=0.07, h=0.18)
    # as folhas das portas (a esquerda pela dobradiça da esquerda; a direita pela da direita)
    Wd = meio - 0.02 - 0.05
    pf = [(0.0, Wd, 0.1, 0.62)]
    for (hu, dd0, alfa) in ((0.05, (1.0, 0.0), 100), (W - 0.05, (-1.0, 0.0), 106)):
        H = (o0 + hu, DL)

        def mk(d, H_):
            return _pintado_l(None, None, pf, u_fn=(lambda P: (P[:, 0] - H_[0]) * d[0] + (P[:, 1] - H_[1]) * d[1]))
        d, nf = _folha_cz(H, dd0, (0.0, 1.0), alfa, Wd, 0.1, 0.62, mk, mk, mad2('#8a5230', eixo=1, seed=63, passo=0.03))
        _puxador_folha(H, d, nf, Wd - 0.07, 0.4)


def armario(o0, face, enfeite=0, vazio=False, aberto=False):
    """
    o0: onde começa ao longo da parede; face '+y' (encostado no fundo, de x0 a x0 + 1,5) ou '+x' (na esquerda).
    vazio: a gêmea esvaziada (armario_cozinha!vazio): o mesmo armário sem a louça e sem os enfeites (ficam os trilhos).
    aberto (só na face '+y'): as duas portas de baixo abertas (o vão escuro com a prateleira, as panelas e os potes) e a
    porta de vidro da esquerda de cima aberta, mostrando a louça.
    """
    W, DL, DU = 1.5, 0.56, 0.34
    ZB, ZN, ZU, ZT = 0.86, 0.91, 1.36, 1.84
    ZP = 1.6                       # a prateleira do meio
    fy = face == '+y'

    def B(u0, u1, v0, v1, z0, z1):
        return (o0 + u0, o0 + u1, v0, v1, z0, z1) if fy else (v0, v1, o0 + u0, o0 + u1, z0, z1)
    FR, LD = ('frente', 'dir') if fy else ('dir', 'frente')
    ex = 0 if fy else 1
    au = (lambda P: P[:, 0] - o0) if fy else (lambda P: P[:, 1] - o0)
    av = (lambda P: P[:, 1]) if fy else (lambda P: P[:, 0])

    def pintado(paineis=()):
        """O creme pintado; paineis: (u0, u1, z0, z1) com o rebaixo (a fresta escura, a luz em cima à esquerda)."""
        c0 = hx(CREME)

        def f(L, n, P):
            out = np.tile(c0, (len(P), 1))
            u, z = au(P), P[:, 2]
            nn = np.asarray(n, float)
            frente = (nn[1] > 0.5) if fy else (nn[0] > 0.5)
            if frente:
                for (u0, u1, z0, z1) in paineis:
                    dentro = (u >= u0) & (u < u1) & (z >= z0) & (z < z1)
                    fresta = dentro & ((u < u0 + PH) | (u >= u1 - PH) | (z < z0 + PZ) | (z >= z1 - PZ))
                    luz = dentro & ~fresta & ((z >= z1 - 2 * PZ) | (u < u0 + 2 * PH))
                    somb = dentro & ~fresta & ((z < z0 + 2 * PZ) | (u >= u1 - 2 * PH))
                    # o rebaixo do meio da almofada
                    mi = dentro & (u >= u0 + 0.06) & (u < u1 - 0.06) & (z >= z0 + 0.05) & (z < z1 - 0.05)
                    mib = mi & ((u < u0 + 0.06 + PH) | (z >= z1 - 0.05 - PZ))
                    mil = mi & ((u >= u1 - 0.06 - PH) | (z < z0 + 0.05 + PZ))
                    out = np.where(luz[:, None], hx(CREME_L), out)
                    out = np.where(somb[:, None], _tom(c0, 0.92), out)
                    out = np.where(mib[:, None], _tom(c0, 0.9), out)
                    out = np.where(mil[:, None], hx(CREME_L), out)
                    out = np.where(fresta[:, None], hx('#7a6a54'), out)
            return out
        return emissivo(f)

    # ---- embaixo: o rodapé, o corpo com as gavetas e as portas, os puxadores ----
    caixa(B(0.04, W - 0.04, 0, DL - 0.04, 0, 0.07), mad2('#5a3a24', eixo=ex, seed=61, passo=0.04))
    meio = W / 2
    pain = [(0.05, meio - 0.02, 0.66, 0.83), (meio + 0.02, W - 0.05, 0.66, 0.83),
            (0.05, meio - 0.02, 0.1, 0.62), (meio + 0.02, W - 0.05, 0.1, 0.62)]
    # as costas (o móvel girado mostra o de trás): tábuas de pinho cru em pé, a junta escura, o veio
    COSTAS = tab2(['#b88a58', '#b08254', '#bc8e5c'], 0.15, '#6a4426', eixo=1 if fy else 0, seed=66, org=o0)
    TRAS = 'costas' if fy else 'esq'
    if not aberto:
        caixa(B(0.0, W, 0, DL, 0.07, ZB), {FR: pintado(pain), TRAS: COSTAS, '*': pintado(), 'cima': liso(CREME)})
    else:
        _balcao_aberto(B, o0, W, DL, ZB, meio, pain, pintado, COSTAS, vazio)
    pegadas.append(B(0, W, 0, DL, 0, 0)[:4])
    for (u0, u1, z0, z1) in pain:
        if aberto and z0 < 0.6:
            continue
        um = (u0 + u1) / 2 if z0 > 0.6 else (u1 - 0.07 if u0 < meio else u0 + 0.07)
        zm = (z0 + z1) / 2 if z0 > 0.6 else z1 - 0.12
        bb = B(um - 0.018, um + 0.018, DL, DL + 0.025, zm - 0.015, zm + 0.015)
        _barra(bb, '#5a4a3a', '#8a7a62', quina=False)
    # a bancada de madeira
    caixa(B(-0.01, W + 0.01, 0, DL + 0.025, ZB, ZN), {'cima': tab2(['#b07440', '#a86e3c', '#b67a44'], 0.14, '#5a2c16', eixo=ex, seed=62, org=0.0),
                                                     '*': mad2('#8a5230', eixo=ex, seed=63, passo=0.03)})
    # ---- o guarda-louça: os lados descem até a bancada, o fundo azul por dentro, as prateleiras, a louça ----
    LADO = {'*': pintado(), 'cima': liso(CREME)}
    caixa(B(0, 0.035, 0, DU, ZN, ZT), LADO, sombra=False)
    caixa(B(W - 0.035, W, 0, DU, ZN, ZT), LADO, sombra=False)
    caixa(B(0.035, W - 0.035, 0.012, DU, ZU - 0.03, ZU), {'*': pintado(), 'cima': liso('#6a8794')}, sombra=False)

    def fundo_azul(L, n, P):
        """O fundo por dentro: em cima (o guarda-louça) azul, com a sombra das prateleiras; embaixo (o vão aberto) o
        lambri creme de réguas finas, com a sombra da prateleira de cima."""
        z = P[:, 2]
        u = au(P)
        out = np.tile(hx('#5e7e8c'), (len(P), 1))
        for zz in (ZP, ZT):
            out = np.where(((z < zz) & (z > zz - 0.06))[:, None], hx('#465f6c'), out)
        g = (u % (4 * PH))
        lam = np.where((g < PH)[:, None], hx('#b8a888'), np.where((g < 2 * PH)[:, None], hx('#eee4cc'), hx(CREME)))
        lam = np.where(((z > ZU - 0.03 - 0.07) & (z < ZU - 0.03))[:, None], _tom(lam, 0.86), lam)
        return np.where((z < ZU - 0.03)[:, None], lam, out)
    caixa(B(0.0, W, 0, 0.012, ZN, ZT), {FR: emissivo(fundo_azul), TRAS: COSTAS, '*': pintado(), 'cima': liso(CREME)}, sombra=False)
    caixa(B(0.035, W - 0.035, 0.012, DU - 0.03, ZP, ZP + 0.022), {'cima': liso('#6a8794'), '*': pintado()}, sombra=False)
    # a louça: os pratos em pé na frente (encostados no vidro, no trilho), as xícaras e as tigelas
    for zp, sem in ((ZU, 0 if enfeite != 1 else 2), (ZP + 0.022, 1)):
        louca(B, fy, o0, zp, W, DU, sem, so_trilho=vazio)
    # a cimalha em cima
    caixa(B(-0.025, W + 0.025, 0, DU + 0.03, ZT, ZT + 0.06), {'cima': tab2(['#b07440', '#a86e3c'], 0.12, '#5a2c16', eixo=ex, seed=64), '*': mad2('#8a5230', eixo=ex, seed=65, passo=0.03)}, sombra=False)
    # as portas de vidro: o caixilho creme (as duas folhas com a travessa e o pinázio) e o vidro
    vf = DU - 0.022
    quadros = ((0.035, 0.075, ZU, ZT), (W - 0.075, W - 0.035, ZU, ZT), (meio - 0.022, meio + 0.022, ZU, ZT),
               (0.035, W - 0.035, ZU, ZU + 0.04), (0.035, W - 0.035, ZT - 0.04, ZT),
               (0.075, meio - 0.022, ZP - 0.005, ZP + 0.03), (meio + 0.022, W - 0.075, ZP - 0.005, ZP + 0.03))
    if aberto:       # a folha da esquerda abre: ficam só os quadros da direita
        quadros = ((W - 0.075, W - 0.035, ZU, ZT), (meio - 0.022, meio + 0.022, ZU, ZT),
                   (meio - 0.022, W - 0.035, ZU, ZU + 0.04), (meio - 0.022, W - 0.035, ZT - 0.04, ZT),
                   (meio + 0.022, W - 0.075, ZP - 0.005, ZP + 0.03))
    for (u0, u1, z0, z1) in quadros:
        caixa(B(u0, u1, vf, DU, z0, z1), {'*': _pau(CREME, CREME_L, quina=False), FR: _pau(CREME, quina=False)}, sombra=False)
    for uk in (meio - 0.06, meio + 0.04):
        if aberto and uk < meio:
            continue
        caixa(B(uk, uk + 0.02, DU, DU + 0.02, ZP - 0.06, ZP), _pau('#5a4a3a', '#8a7a62', quina=False), sombra=False)
    vidros.append(B(meio if aberto else 0.036, W - 0.036, 0.014, vf - 0.002, ZU + 0.001, ZT - 0.001))   # (depois do fundo: as costas ficam sem o vidro)
    if aberto:
        Wv = meio - 0.022 - 0.035
        Hv = (o0 + 0.035, DU)
        vf_ = _vidro_folha(ZU, ZT, ZP - 0.005, ZP + 0.03, Wv)
        _folha_cz(Hv, (1.0, 0.0), (0.0, 1.0), 105, Wv, ZU, ZT, vf_, vf_, _pau(CREME, CREME_L, quina=False))
    # o vão aberto entre a bancada e o guarda-louça e em cima: os enfeites
    if not vazio:
        enfeites_armario(B, fy, o0, W, ZN, ZT + 0.06, enfeite)


def louca(B, fy, o0, z, W, DU, sem, so_trilho=False):
    """A louça de uma prateleira: os pratos em pé na frente (no trilho, de frente para o vidro), as xícaras e as tigelas."""
    r = 0.09 if sem != 1 else 0.08
    aro = ('#3e5f8e', '#a8442e', '#4e7a52')[sem]
    vp = DU - 0.075
    # o trilho de madeira que segura os pratos
    caixa(B(0.04, W - 0.04, vp + 0.015, vp + 0.03, z + 0.03, z + 0.045), _pau('#c8b896', quina=False), sombra=False)
    if so_trilho:
        return
    us = (0.14, 0.31, 0.48) if sem != 1 else (0.13, 0.28, 0.43, 0.58)
    for k, u in enumerate(us):
        bb = B(u, u, vp - 0.01 * (k % 2), 0, 0, 0)
        if fy:
            prato_pe(bb[0], bb[2], z + r + 0.004, r, aro if k % 2 == 0 else '#3e5f8e')
        else:
            prato_pe(bb[2], bb[0], z + r + 0.004, r, aro if k % 2 == 0 else '#3e5f8e', normal='x')
    # do outro lado: as xícaras penduradas na frente (ou a pilha de tigelas e o bule de louça)
    if sem == 1:
        for k in range(3):
            u = W - 0.15 - k * 0.13
            bb = B(u, u, DU * 0.55, DU * 0.55, 0, 0)
            xx, yy = bb[0], bb[2]
            o = c.novo_obj(3)
            c.cilindro(xx, yy, 0.036, z, z + 0.055, vol(xx, yy, ('#e8e2d4', '#c8a050', '#e8e2d4')[k], brilho=0.3), M, o, lados=14, r1=0.044, tampa_mat=liso('#7a6a54'))
    else:
        for k in range(3):
            bb = B(W - 0.22, W - 0.22, DU * 0.5, DU * 0.5, 0, 0)
            xx, yy = bb[0], bb[2]
            o = c.novo_obj(3)
            zz = z + k * 0.035
            _poligono_rodado(xx, yy, [(zz, 0.05), (zz + 0.035, 0.075)], vol(xx, yy, ('#e8e2d4', '#d8cdb4', '#e8e2d4')[k], brilho=0.25), o, lados=16,
                             tampa_mat=liso('#b8ac94'))
        bb = B(W - 0.45, W - 0.45, DU * 0.5, DU * 0.5, 0, 0)
        o = c.novo_obj(3)
        xx, yy = bb[0], bb[2]
        _poligono_rodado(xx, yy, [(z, 0.05), (z + 0.03, 0.065), (z + 0.1, 0.06), (z + 0.13, 0.035)], vol(xx, yy, '#f0ebe0', brilho=0.35,
                         faixas=lambda P, b: np.where((np.abs(P[:, 2] - z - 0.06) < PZ)[:, None], hx('#3e5f8e'), b)), o, lados=16, tampa_mat=liso('#e0dace'))


def enfeites_armario(B, fy, o0, W, zn, zt, qual):
    """O que fica na bancada do armário e em cima da cimalha (um arranjo por armário)."""
    def P(u, v):
        bb = B(u, u, v, v, 0, 0)
        return bb[0], bb[2]
    if qual == 0:
        # o filtro de barro (o São João) e o pote de açúcar
        x, y = P(0.36, 0.24)
        filtro_barro(x, y, zn)
        x, y = P(1.1, 0.26)
        pote_vidro(x, y, zn, '#f0ead8', h=0.14)
        x, y = P(1.26, 0.22)
        pote_vidro(x, y, zn, '#4a2a1a', h=0.12)
        x, y = P(0.75, 0.17)
        cesto(x, y, zt, r=0.15)
    elif qual == 1:
        # as latas de mantimento em escadinha e a moringa
        for k, (u, cor, hh) in enumerate(((0.22, '#b8402e', 0.17), (0.4, '#c88a2e', 0.14), (0.56, '#3e6a8e', 0.12))):
            x, y = P(u, 0.24)
            lata(x, y, zn, cor, hh)
        x, y = P(1.18, 0.24)
        moringa(x, y, zn)
        x, y = P(0.45, 0.17)
        pote_barro(x, y, zt, r=0.1, h=0.2)
        x, y = P(1.05, 0.17)
        abobora(x, y, zt)
    else:
        # o rádio de válvula e o vaso de flor
        x0, y0 = P(0.3, 0.1)
        x1, y1 = P(0.75, 0.38)
        radio(min(x0, x1), max(x0, x1), min(y0, y1), max(y0, y1), zn)
        x, y = P(1.15, 0.24)
        pote_vidro(x, y, zn, '#d8b048', h=0.15)
        x, y = P(0.75, 0.17)
        cesto(x, y, zt, r=0.14)


# =====================================================================================================================
# o armário de cozinha em L (armario_cozinha_l: 2 x 3 casas no giro 4, as casas [1,1] e [1,2] livres): o braço do
# fundo (x 0..1,5, encostado em y = 0) e o da esquerda (y 0..2,25, encostado em x = 0), um móvel só, dividindo o canto
# =====================================================================================================================
def _braco(eixo):
    """
    O quadro de um braço do L: u ao longo da parede (a partir do canto), v da parede para a frente. eixo 'x': o braço
    do fundo (a frente olha para +y); 'y': o da esquerda (a frente olha para +x). Devolve B, a face da frente, a de
    trás, a da ponta (a que fica longe do canto), au (u de cada ponto) e se a normal é a da frente.
    """
    if eixo == 'x':
        return ((lambda u0, u1, v0, v1, z0, z1: (u0, u1, v0, v1, z0, z1)), 'frente', 'costas', 'dir',
                (lambda P: P[:, 0]), (lambda n: n[1] > 0.5))
    return ((lambda u0, u1, v0, v1, z0, z1: (v0, v1, u0, u1, z0, z1)), 'dir', 'esq', 'frente',
            (lambda P: P[:, 1]), (lambda n: n[0] > 0.5))


def _pintado_l(au, e_frente, paineis=(), u_fn=None):
    """O creme pintado do armário; paineis (u0, u1, z0, z1): a almofada com a fresta, a luz e o rebaixo do meio."""
    c0 = hx(CREME)

    def f(L, n, P):
        out = np.tile(c0, (len(P), 1))
        if u_fn is None and not e_frente(np.asarray(n, float)):
            return out
        u, z = (au(P) if u_fn is None else u_fn(P)), P[:, 2]
        for (u0, u1, z0, z1) in paineis:
            dentro = (u >= u0) & (u < u1) & (z >= z0) & (z < z1)
            fresta = dentro & ((u < u0 + PH) | (u >= u1 - PH) | (z < z0 + PZ) | (z >= z1 - PZ))
            luz = dentro & ~fresta & ((z >= z1 - 2 * PZ) | (u < u0 + 2 * PH))
            somb = dentro & ~fresta & ((z < z0 + 2 * PZ) | (u >= u1 - 2 * PH))
            mi = dentro & (u >= u0 + 0.06) & (u < u1 - 0.06) & (z >= z0 + 0.05) & (z < z1 - 0.05)
            mib = mi & ((u < u0 + 0.06 + PH) | (z >= z1 - 0.05 - PZ))
            mil = mi & ((u >= u1 - 0.06 - PH) | (z < z0 + 0.05 + PZ))
            out = np.where(luz[:, None], hx(CREME_L), out)
            out = np.where(somb[:, None], _tom(c0, 0.92), out)
            out = np.where(mib[:, None], _tom(c0, 0.9), out)
            out = np.where(mil[:, None], hx(CREME_L), out)
            out = np.where(fresta[:, None], hx('#7a6a54'), out)
        return out
    return emissivo(f)


def _fundo_l(au, ZU, ZP, ZT):
    """O fundo por dentro: em cima azul (a sombra das prateleiras), embaixo, no vão, o lambri creme de réguas finas."""
    def f(L, n, P):
        z = P[:, 2]
        u = au(P)
        out = np.tile(hx('#5e7e8c'), (len(P), 1))
        for zz in (ZP, ZT):
            out = np.where(((z < zz) & (z > zz - 0.06))[:, None], hx('#465f6c'), out)
        g = (u % (4 * PH))
        lam = np.where((g < PH)[:, None], hx('#b8a888'), np.where((g < 2 * PH)[:, None], hx('#eee4cc'), hx(CREME)))
        lam = np.where(((z > ZU - 0.03 - 0.07) & (z < ZU - 0.03))[:, None], _tom(lam, 0.86), lam)
        return np.where((z < ZU - 0.03)[:, None], lam, out)
    return emissivo(f)


def _esquadria(mat, lado):
    """O tampo do braço com a emenda de meia-esquadria no canto (a diagonal x = y): a junta de 1 px e a luz dela."""
    def f(L, n, P):
        out = mat(L, n, P)
        d = (P[:, 0] - P[:, 1]) * lado            # > 0 do lado deste braço
        out = np.where((d < PH)[:, None], hx('#5a2c16'), out)
        return np.where(((d >= PH) & (d < 2 * PH))[:, None], _tom(out, 1.1), out)
    f.emissivo = True
    return f


def armario_l(aberto=False):
    """
    O armário de cozinha em L, no canto do fundo com a esquerda (giro 4: a pegada x 0..1,5, y 0..2,25; as casas
    [1,1] e [1,2] livres). Embaixo o balcão em L (o rodapé recuado, as gavetas e as portas almofadadas nos dois braços,
    a pilastra no canto de dentro) com o tampo de tábuas contínuo e a emenda em meia-esquadria; em cima, no braço do
    fundo, o louceiro com as portas de vidro e, no da esquerda, as prateleiras abertas com a louça; a cimalha em L.
    As costas (tábuas de pinho em pé) e as pontas fechadas: o móvel é visto nos 4 giros.
    aberto: as duas portas de baixo do braço do fundo abertas (o vão escuro com as tigelas, a panela e os potes) e a porta
    de vidro da esquerda do louceiro aberta; o braço da esquerda fica como está.
    """
    WX, WY = 1.5, 2.25             # o comprimento de cada braço (do canto)
    DL, DU = 0.56, 0.34            # o fundo do balcão e o do louceiro / das prateleiras
    ZB, ZN, ZU, ZT = 0.86, 0.91, 1.36, 1.84
    ZP = 1.6
    BX, FRX, TRX, PTX, aux, efx = _braco('x')
    BY, FRY, TRY, PTY, auy, efy = _braco('y')
    COSTAS_X = tab2(['#b88a58', '#b08254', '#bc8e5c'], 0.15, '#6a4426', eixo=1, seed=66)
    COSTAS_Y = tab2(['#b88a58', '#b08254', '#bc8e5c'], 0.15, '#6a4426', eixo=1, seed=67)

    # ---- o rodapé recuado (L) ----
    caixa(BX(0.0, WX - 0.04, 0, DL - 0.04, 0, 0.07), mad2('#5a3a24', eixo=0, seed=61, passo=0.04))
    caixa(BY(DL - 0.04, WY - 0.04, 0, DL - 0.04, 0, 0.07), mad2('#5a3a24', eixo=0, seed=62, passo=0.04))

    # ---- o balcão: o braço do fundo (com o canto) e o da esquerda; gavetas em cima, portas embaixo ----
    def colunas(u0, u1, n):
        xs = np.linspace(u0, u1, n + 1)
        return [(xs[i] + (0.01 if i else 0), xs[i + 1] - (0.01 if i < n - 1 else 0)) for i in range(n)]
    cx_ = colunas(DL + 0.05, WX - 0.05, 2)
    cy_ = colunas(DL + 0.05, WY - 0.05, 3)
    pain_x = [(a, b, 0.66, 0.83) for (a, b) in cx_] + [(a, b, 0.1, 0.62) for (a, b) in cx_]
    pain_y = [(a, b, 0.66, 0.83) for (a, b) in cy_] + [(a, b, 0.1, 0.62) for (a, b) in cy_]
    if not aberto:
        caixa(BX(0.0, WX, 0, DL, 0.07, ZB), {FRX: _pintado_l(aux, efx, pain_x), TRX: COSTAS_X, 'esq': COSTAS_Y,
                                            '*': _pintado_l(aux, efx), 'cima': liso(CREME)}, sombra=False)
    else:
        # o bloco do canto (fechado) e, daí até a ponta, o balcão aberto
        caixa(BX(0.0, DL, 0, DL, 0.07, ZB), {FRX: _pintado_l(aux, efx), TRX: COSTAS_X, 'esq': COSTAS_Y,
                                            '*': _pintado_l(aux, efx), 'cima': liso(CREME)}, sombra=False)
        Bd = (lambda u0, u1, v0, v1, z0, z1: (DL + u0, DL + u1, v0, v1, z0, z1))
        _balcao_aberto(Bd, DL, WX - DL, DL, ZB, (WX - DL) / 2, pain_x, (lambda pa=(): _pintado_l(aux, efx, pa)), COSTAS_X, False)
    caixa(BY(DL, WY, 0, DL, 0.07, ZB), {FRY: _pintado_l(auy, efy, pain_y), TRY: COSTAS_Y,
                                       '*': _pintado_l(auy, efy), 'cima': liso(CREME)}, sombra=False)
    # os puxadores (o botão das gavetas no meio, o das portas perto da junta do par)
    for (B_, pains, cols) in ((BX, pain_x, cx_), (BY, pain_y, cy_)):
        for k, (u0, u1, z0, z1) in enumerate(pains):
            if aberto and B_ is BX and z0 < 0.6:
                continue
            if z0 > 0.6:
                um, zm = (u0 + u1) / 2, (z0 + z1) / 2
            else:
                um = u1 - 0.07 if (k - len(cols)) % 2 == 0 else u0 + 0.07
                zm = z1 - 0.12
            _barra(B_(um - 0.018, um + 0.018, DL, DL + 0.025, zm - 0.015, zm + 0.015), '#5a4a3a', '#8a7a62', quina=False)
    # a pilastra no canto de dentro (a quina em pé arredondada, clara)
    caixa((DL - 0.005, DL + 0.03, DL - 0.005, DL + 0.03, 0.07, ZB), {'*': _pau(CREME_L, CREME_L, quina=False)}, sombra=False)
    pegadas.append((0.0, WX, 0.0, DL))
    pegadas.append((0.0, DL, DL, WY))

    # ---- o tampo de tábuas contínuo, com a meia-esquadria no canto (a diagonal de (0, 0) a (D, D)) ----
    D = DL + 0.025
    TX = _esquadria(tab2(['#b07440', '#a86e3c', '#b67a44'], 0.14, '#5a2c16', eixo=0, seed=62), +1)
    TY = _esquadria(tab2(['#b07440', '#a86e3c', '#b67a44'], 0.14, '#5a2c16', eixo=1, seed=63), -1)
    BORDA = mad2('#8a5230', eixo=0, seed=63, passo=0.03)
    ot = c.novo_obj(3)
    fp([(0, 0, ZN), (WX + 0.01, 0, ZN), (WX + 0.01, D, ZN), (D, D, ZN)], (0, 0, 1), TX, ot)
    fp([(0, 0, ZN), (D, D, ZN), (D, WY + 0.01, ZN), (0, WY + 0.01, ZN)], (0, 0, 1), TY, ot)
    for (pts, nn) in ((((D, D), (WX + 0.01, D)), (0, 1, 0)), (((WX + 0.01, 0), (WX + 0.01, D)), (1, 0, 0)),
                      (((0, 0), (WX + 0.01, 0)), (0, -1, 0)), (((D, D), (D, WY + 0.01)), (1, 0, 0)),
                      (((0, WY + 0.01), (D, WY + 0.01)), (0, 1, 0)), (((0, 0), (0, WY + 0.01)), (-1, 0, 0))):
        (a, b), (a2, b2) = pts
        fp([(a, b, ZB), (a2, b2, ZB), (a2, b2, ZN), (a, b, ZN)], nn, BORDA, ot)

    # ---- em cima, no braço do fundo: o louceiro (as portas de vidro só no que fica fora do canto) ----
    LADO = {TRX: COSTAS_X, '*': _pintado_l(aux, efx), 'cima': liso(CREME)}
    caixa(BX(WX - 0.035, WX, 0, DU, ZN, ZT), LADO, sombra=False)
    caixa(BX(0.0, 0.035, 0, DU, ZN, ZT), {'esq': COSTAS_Y, TRX: COSTAS_X, '*': _pintado_l(aux, efx), 'cima': liso(CREME)}, sombra=False)
    caixa(BX(0.0, WX, 0, 0.012, ZN, ZT), {FRX: _fundo_l(aux, ZU, ZP, ZT), TRX: COSTAS_X, '*': _pintado_l(aux, efx), 'cima': liso(CREME)}, sombra=False)
    caixa(BX(0.035, WX - 0.035, 0.012, DU, ZU - 0.03, ZU), {'*': _pintado_l(aux, efx), 'cima': liso('#6a8794')}, sombra=False)
    caixa(BX(0.035, WX - 0.035, 0.012, DU - 0.03, ZP, ZP + 0.022), {'cima': liso('#6a8794'), '*': _pintado_l(aux, efx)}, sombra=False)
    u0v = DU + 0.035                                 # onde começam as portas (o canto fica atrás das prateleiras)
    Wv = WX - u0v
    BXs = (lambda a, b, cc, d, e, f_: BX(a + u0v - 0.035, b + u0v - 0.035, cc, d, e, f_))
    louca(BXs, True, 0.0, ZU, Wv + 0.035, DU, 0)
    louca(BXs, True, 0.0, ZP + 0.022, Wv + 0.035, DU, 1)
    vf = DU - 0.022
    meio = (u0v + WX - 0.035) / 2
    quadros = ((u0v, u0v + 0.04, ZU, ZT), (WX - 0.075, WX - 0.035, ZU, ZT), (meio - 0.022, meio + 0.022, ZU, ZT),
               (u0v, WX - 0.035, ZU, ZU + 0.04), (u0v, WX - 0.035, ZT - 0.04, ZT),
               (u0v + 0.04, meio - 0.022, ZP - 0.005, ZP + 0.03), (meio + 0.022, WX - 0.075, ZP - 0.005, ZP + 0.03))
    if aberto:       # a folha da esquerda do louceiro abre: ficam só os quadros da direita
        quadros = ((WX - 0.075, WX - 0.035, ZU, ZT), (meio - 0.022, meio + 0.022, ZU, ZT),
                   (meio - 0.022, WX - 0.035, ZU, ZU + 0.04), (meio - 0.022, WX - 0.035, ZT - 0.04, ZT),
                   (meio + 0.022, WX - 0.075, ZP - 0.005, ZP + 0.03))
    for (a, b, z0, z1) in quadros:
        caixa(BX(a, b, vf, DU, z0, z1), {'*': _pau(CREME, CREME_L, quina=False), FRX: _pau(CREME, quina=False)}, sombra=False)
    for uk in (meio - 0.06, meio + 0.04):
        if aberto and uk < meio:
            continue
        caixa(BX(uk, uk + 0.02, DU, DU + 0.02, ZP - 0.06, ZP), _pau('#5a4a3a', '#8a7a62', quina=False), sombra=False)
    vidros.append(BX(meio if aberto else u0v + 0.001, WX - 0.036, 0.014, vf - 0.002, ZU + 0.001, ZT - 0.001))
    if aberto:
        Wvf = meio - 0.022 - u0v
        vf_ = _vidro_folha(ZU, ZT, ZP - 0.005, ZP + 0.03, Wvf)
        _folha_cz((u0v, DU), (1.0, 0.0), (0.0, 1.0), 105, Wvf, ZU, ZT, vf_, vf_, _pau(CREME, CREME_L, quina=False))

    # ---- em cima, no braço da esquerda: as prateleiras abertas (o lado do canto fecha a ponta do louceiro) ----
    caixa(BY(DU, DU + 0.035, 0, DU, ZN, ZT), {TRY: COSTAS_Y, '*': _pintado_l(auy, efy), 'cima': liso(CREME)}, sombra=False)
    caixa(BY(WY - 0.035, WY, 0, DU, ZN, ZT), {TRY: COSTAS_Y, '*': _pintado_l(auy, efy), 'cima': liso(CREME)}, sombra=False)
    caixa(BY(DU, WY, 0, 0.012, ZN, ZT), {FRY: _fundo_l(auy, ZU, ZP, ZT), TRY: COSTAS_Y, '*': _pintado_l(auy, efy), 'cima': liso(CREME)}, sombra=False)
    PRAT = {'cima': tab2(['#c08650', '#b88048'], 0.17, '#6a3a1e', eixo=1, seed=68), '*': _pintado_l(auy, efy)}
    u1p = DU + 0.035
    for zz in (ZU - 0.03, ZP):
        caixa(BY(u1p, WY - 0.035, 0.012, DU, zz, zz + 0.03), PRAT, sombra=False)
    # a barra recortada embaixo da prateleira de baixo (o lambrequim: bicos de 1 px a cada 6)
    def lambrequim(L, n, P):
        out = np.tile(hx(CREME), (len(P), 1))
        g = ((auy(P) - u1p) / PH) % 6
        out = np.where(((P[:, 2] < ZU - 0.03 - 2 * PZ) & ((g < 1) | (g >= 5)))[:, None], _tom(out, 0.84), out)
        return np.where((P[:, 2] >= ZU - 0.03 - PZ)[:, None], hx(CREME_L), out)
    caixa(BY(u1p, WY - 0.035, DU - 0.015, DU, ZU - 0.03 - 0.045, ZU - 0.03), {'*': emissivo(lambrequim)}, sombra=False)
    BYs = (lambda a, b, cc, d, e, f_: BY(a + u1p - 0.035, b + u1p - 0.035, cc, d, e, f_))
    Wy = WY - u1p
    louca(BYs, False, 0.0, ZU, Wy, DU, 2)
    louca(BYs, False, 0.0, ZP + 0.03, Wy, DU, 1)
    # o meio das prateleiras: os potes de mantimento, a lata, a pilha de tigelas de ágata
    for (u, cor, hh) in ((1.12, '#5a2a1e', 0.13), (1.24, '#e8c050', 0.15), (1.36, '#f0ead8', 0.12)):
        pote_vidro(0.17, u, ZU, cor, h=hh, r=0.045)
    lata(0.17, 1.55, ZP + 0.03, '#b8402e', 0.12)
    for k in range(3):
        o = c.novo_obj(3)
        zz = ZP + 0.03 + k * 0.03
        _poligono_rodado(0.17, 1.2, [(zz, 0.045), (zz + 0.03, 0.068)], vol(0.17, 1.2, ('#ece6da', '#3e6a9a', '#ece6da')[k], brilho=0.3), o,
                         lados=16, tampa_mat=liso('#d8d0c0'))

    # ---- a cimalha em L ----
    CIM_T = tab2(['#b07440', '#a86e3c'], 0.12, '#5a2c16', eixo=0, seed=64)
    CIM_T2 = tab2(['#b07440', '#a86e3c'], 0.12, '#5a2c16', eixo=1, seed=65)
    caixa((-0.0, WX + 0.025, 0, DU + 0.03, ZT, ZT + 0.06), {'cima': CIM_T, '*': mad2('#8a5230', eixo=0, seed=65, passo=0.03)}, sombra=False)
    caixa((0, DU + 0.03, DU + 0.03, WY + 0.025, ZT, ZT + 0.06), {'cima': CIM_T2, '*': mad2('#8a5230', eixo=0, seed=66, passo=0.03)}, sombra=False)

    # ---- o que fica no balcão e em cima ----
    filtro_barro(1.15, 0.26, ZN)
    pote_vidro(0.8, 0.22, ZN, '#f0ead8', h=0.14)
    pote_vidro(0.93, 0.2, ZN, '#4a2a1a', h=0.12)
    for k, (u, cor, hh) in enumerate(((0.75, '#b8402e', 0.17), (0.9, '#c88a2e', 0.14), (1.04, '#3e6a8e', 0.12))):
        lata(0.22, u, ZN, cor, hh)
    radio(0.1, 0.38, 1.45, 1.95, ZN)
    moringa(0.24, 2.08, ZN)
    cesto(1.05, 0.17, ZT + 0.06, r=0.14)
    pote_barro(0.17, 0.2, ZT + 0.06, r=0.1, h=0.2)
    abobora(0.17, 1.2, ZT + 0.06)


def pote_vidro(x, y, z, conteudo, h=0.14, r=0.055):
    """O pote de vidro com mantimento: o conteúdo até 3/4, o vidro claro em cima, a tampa de lata."""
    def faixas(P, base):
        zz = P[:, 2] - z
        return np.where((zz > h * 0.72)[:, None], hx('#cfe0e0'), base)
    o = c.novo_obj(3)
    c.cilindro(x, y, r, z, z + h, vol(x, y, conteudo, brilho=0.35, faixas=faixas), M, o, lados=16, tampa=False)
    c.cilindro(x, y, r + 0.004, z + h, z + h + 0.025, vol(x, y, '#9a9a9e', brilho=0.4), M, o, lados=16, tampa_mat=liso('#b0b0b4'))
    itens_peq.append((x - r, x + r, y - r, y + r, z))


def lata(x, y, z, cor, h):
    """A lata de mantimento pintada, com a faixa creme e a tampa."""
    def faixas(P, base):
        zz = P[:, 2] - z
        return np.where(((zz > h * 0.4) & (zz < h * 0.62))[:, None], hx('#efe4c8'), base)
    o = c.novo_obj(3)
    c.cilindro(x, y, 0.06, z, z + h, vol(x, y, cor, brilho=0.4, faixas=faixas), M, o, lados=16, tampa=False)
    c.cilindro(x, y, 0.064, z + h, z + h + 0.02, vol(x, y, cor, brilho=0.4), M, o, lados=16, tampa_mat=liso('#d0c8b8'))
    itens_peq.append((x - 0.06, x + 0.06, y - 0.06, y + 0.06, z))


def filtro_barro(x, y, z):
    """O filtro de barro: as duas talhas de barro empilhadas, a tampa e a torneirinha."""
    o = c.novo_obj(3)
    k_ = 0.82
    perfil = [(z + a * k_, r) for (a, r) in ((0, 0.1), (0.03, 0.125), (0.15, 0.135), (0.2, 0.12), (0.205, 0.13), (0.22, 0.13),
                                             (0.24, 0.125), (0.36, 0.135), (0.41, 0.12), (0.42, 0.1))]

    def faixas(P, base):
        zz = (P[:, 2] - z) / 0.82
        base = np.where(((zz > 0.2) & (zz < 0.225))[:, None], _tom(base, 0.78), base)
        return np.where((((zz > 0.08) & (zz < 0.08 + PZ)) | ((zz > 0.3) & (zz < 0.3 + PZ)))[:, None], _tom(base, 1.15), base)
    _poligono_rodado(x, y, perfil, vol(x, y, '#b0643c', brilho=0.15, faixas=faixas), o, lados=22, tampa_mat=liso('#9a5634'))
    c.cilindro(x, y, 0.025, z + 0.42 * k_, z + 0.45 * k_, vol(x, y, '#8a4a2c'), M, o, lados=10, tampa_mat=liso('#a65a36'))
    k = 1 / math.sqrt(2)
    _barra((x + 0.08 * k - 0.012, x + 0.08 * k + 0.012, y + 0.11 * k, y + 0.15 * k, z + 0.05, z + 0.07), '#c8c8cc', '#e8e8ec', quina=False)
    itens_peq.append((x - 0.12, x + 0.12, y - 0.12, y + 0.12, z))


def moringa(x, y, z):
    o = c.novo_obj(3)
    perfil = [(z, 0.06), (z + 0.05, 0.095), (z + 0.12, 0.1), (z + 0.18, 0.07), (z + 0.22, 0.03), (z + 0.26, 0.025), (z + 0.27, 0.03)]
    _poligono_rodado(x, y, perfil, vol(x, y, '#b86a40', brilho=0.15), o, lados=20, tampa_mat=liso('#3a2014'))
    itens_peq.append((x - 0.1, x + 0.1, y - 0.1, y + 0.1, z))


def cesto(x, y, z, r=0.15, hh=0.12):
    """O cesto de vime (a trama em fiadas desencontradas) com a borda enrolada."""
    def trama(P, base):
        th = np.arctan2(P[:, 1] - y, P[:, 0] - x)
        fila = np.floor((P[:, 2] - z) / (2 * PZ))
        col = np.floor((th * r) / 0.05 + fila * 0.5)
        alt = (col + fila) % 2 == 0
        return np.where(alt[:, None], _tom(base, 1.1), _tom(base, 0.9))
    o = c.novo_obj(3)
    _poligono_rodado(x, y, [(z, r * 0.8), (z + hh, r)], vol(x, y, '#c49a5c', faixas=trama), o, lados=20)
    c.cilindro(x, y, r + 0.008, z + hh - 0.03, z + hh, vol(x, y, '#a87a42'), M, o, lados=20, tampa=False)

    def miolo(L, n, P):
        rr = np.hypot(P[:, 0] - x, P[:, 1] - y)
        return np.where((rr > r - 0.02)[:, None], hx('#c8a062'), hx('#4a3020'))
    _disco(x, y, z + hh, r + 0.008, emissivo(miolo), o, lados=20)


def abobora(x, y, z):
    """A moranga laranja com os gomos e o cabinho."""
    o = c.novo_obj(3)
    c.elipsoide(np.array([x, y, z + 0.07]), np.array([0.12, 0.12, 0.075]),
                emissivo(lambda L, n, P: np.where(((np.arctan2(L[:, 1], L[:, 0]) * 8 / (2 * math.pi)) % 1 < 0.18)[:, None], hx('#b8601e'), hx('#e08a2e'))), o)
    c.cilindro(x, y, 0.015, z + 0.13, z + 0.17, vol(x, y, '#5a6a2a'), M, o, lados=8, tampa_mat=liso('#6a7a34'))


def radio(x0, x1, y0, y1, z):
    """O rádio de válvula de madeira: a caixa de quinas redondas, o tecido do alto-falante, o mostrador e os botões."""
    h = 0.24

    def f(L, n, P):
        out = np.tile(hx('#8a4a26'), (len(P), 1))
        nn = np.asarray(n, float)
        if nn[0] > 0.5 or nn[1] > 0.5:
            a = P[:, 1] if nn[0] > 0.5 else P[:, 0]
            a0, a1 = (y0, y1) if nn[0] > 0.5 else (x0, x1)
            zz = P[:, 2] - z
            # o alto-falante: o tecido creme atrás da grade de ripinhas (1 px escuro a cada 3), a moldura clara
            tela_ = (a > a0 + 0.04) & (a < a1 - 0.04) & (zz > 0.1) & (zz < h - 0.04)
            rip = (np.floor((a - a0) / PH) % 3) == 0
            pano = np.where(rip[:, None], hx('#6a3a1e'), hx('#d8c49a'))
            pano = np.where((zz > h - 0.04 - 2 * PZ)[:, None], _tom(pano, 0.85), pano)
            out = np.where(tela_[:, None], pano, out)
            mold = ~tela_ & (a > a0 + 0.04 - PH) & (a < a1 - 0.04 + PH) & (zz > 0.1 - PZ) & (zz < h - 0.04 + PZ)
            out = np.where(mold[:, None], hx('#b06a38'), out)
            # o mostrador aceso (o vidro amarelo, o ponteiro vermelho) e os dois botões
            mostr = (a > a0 + 0.05) & (a < a1 - 0.09) & (zz > 0.04) & (zz < 0.08)
            out = np.where(mostr[:, None], hx('#f4dc8c'), out)
            out = np.where((mostr & (np.abs(a - (a0 + a1) / 2 + 0.02) < PH * 0.6))[:, None], hx('#b8302a'), out)
            bot = (np.hypot((a - (a1 - 0.055)) * KX, (zz - 0.06) * KZ) < 1.6)
            out = np.where(bot[:, None], hx('#2a1a12'), out)
        return out
    o = c.novo_obj(3)
    c.caixa((x0, x1, y0, y1, z, z + h), emissivo(f), M, o, ch=0.03)
    itens_peq.append((x0, x1, y0, y1, z))


# =====================================================================================================================
# a mesa da cozinha (3 x 2 casas, aumento 1,2: a arte 2,7 x 1,8 m, 0,94 m) e as cadeiras (aumento 1,2)
# =====================================================================================================================
MESA_TAB = ['#8e4a2c', '#884629', '#924e2e', '#844428']


def mesa(x, y, w, d, h, tampo=0.1, perna=0.12, tabua=0.25):
    eixo = 0 if w >= d else 1
    org = y if eixo == 0 else x
    TOPO = tab2(MESA_TAB, tabua, '#3e1c0e', eixo=eixo, seed=31, comp=0.95, org=org)
    lado_long = _pau('#6c341c', '#7e4026', quina=1.22, b=(0, 0, 0, 0, h - tampo, h))
    ponta = _ponta_tabuas('#6c341c', tabua, org, junta='#3a1a0c')
    mats = {'cima': TOPO, 'frente': lado_long if eixo == 0 else ponta, 'dir': ponta if eixo == 0 else lado_long, '*': lado_long}
    caixa((x, x + w, y, y + d, h - tampo, h), mats, sombra=False)
    caixa((x + 0.07, x + w - 0.07, y + 0.07, y + d - 0.07, h - tampo - 0.13, h - tampo), mad2('#4a2412', eixo=0, seed=33, passo=0.05), sombra=False)
    PE = {'cima': mad2('#7e4026'), '*': mad2('#5e2e18', eixo=1, seed=34, passo=0.05)}
    for (a, b) in ((x + 0.05, y + 0.05), (x + w - 0.05 - perna, y + 0.05), (x + 0.05, y + d - 0.05 - perna), (x + w - 0.05 - perna, y + d - 0.05 - perna)):
        caixa((a, a + perna, b, b + perna, 0, h - tampo), PE, sombra=False)
    pegadas.append((x, x + w, y, y + d))


CAD_LADO, CAD_TOPO, CAD_ESC = '#743c22', '#c07c44', '#542a16'


def cadeira(x, y, costas, k=None):
    k = float(os.environ.get('AUMENTO', '1.2')) if k is None else k
    """A cadeira rústica da sala (sala4), crescida pelo aumento do jogo (1,2): o encosto de três travessas, o assento de tábuas."""
    s = 0.44 * k
    hs = 0.47 * k

    def B(u0, u1, v0, v1, z0, z1):
        if costas == '-y':
            return (x + u0, x + u1, y + v0, y + v1, z0, z1)
        if costas == '+y':
            return (x + u0, x + u1, y + s - v1, y + s - v0, z0, z1)
        if costas == '-x':
            return (x + v0, x + v1, y + u0, y + u1, z0, z1)
        return (x + s - v1, x + s - v0, y + u0, y + u1, z0, z1)
    eu = 0 if costas in ('-y', '+y') else 1
    p = 2 * PH
    fr = 2 * PH
    o = c.novo_obj(3)
    for u0 in (0.015, s - 0.015 - p):
        _barra(B(u0, u0 + p, 0.015, 0.015 + p, 0, 1.03 * k), CAD_LADO, CAD_TOPO, o, quina=False)
    zt = 1.0 * k
    for (h_, gap) in ((6, 0), (3, 3), (3, 3)):
        z1 = zt - gap * PZ
        z0 = z1 - h_ * PZ
        _barra(B(0.015 + p, s - 0.015 - p, 0.015 + (p - fr) / 2, 0.015 + (p + fr) / 2, z0, z1), CAD_LADO, CAD_TOPO, o, quina=False)
        zt = z0
    o = c.novo_obj(3)
    bs = B(0.0, s, 0.0, s, hs - 3 * PZ, hs)
    c.caixa(bs, {'cima': tab2(['#9a5432', '#92502e'], s / 2, '#3e1c0e', eixo=eu, seed=25, org=(y if eu == 0 else x), veio=False),
                 '*': _pau(CAD_LADO, quina=False, b=bs)}, M, o)
    _barra(B(0.03, s - 0.03, 0.03, s - 0.03, hs - 6 * PZ, hs - 3 * PZ), CAD_ESC, oid=o, quina=False)
    for u0 in (0.015, s - 0.015 - p):
        _barra(B(u0, u0 + p, s - 0.015 - p, s - 0.015, 0, hs - 3 * PZ), CAD_LADO, CAD_TOPO, quina=False)
    _barra(B(0.015 + p, s - 0.015 - p, s - 0.015 - p / 2 - PH / 2, s - 0.015 - p / 2 + PH / 2, 0.14, 0.14 + 2 * PZ), CAD_LADO, quina=False)
    pegadas.append((x, x + s, y, y + s))


def fruteira(x, y, z):
    """A fruteira de barro com as laranjas, a maçã e as bananas."""
    o = c.novo_obj(3)
    _poligono_rodado(x, y, [(z, 0.07), (z + 0.03, 0.12), (z + 0.07, 0.17)], vol(x, y, '#ece4d2', brilho=0.3,
                     faixas=lambda P, b: np.where((P[:, 2] > z + 0.07 - PZ)[:, None], hx('#3e5f8e'), b)), o, lados=24)

    def dentro(L, n, P):
        return np.where((np.hypot(P[:, 0] - x, P[:, 1] - y) > 0.15)[:, None], hx('#3e5f8e'), hx('#c8bea8'))
    _disco(x, y, z + 0.07, 0.17, emissivo(dentro), o, lados=24)
    for (dx, dy, cor, r) in ((-0.07, -0.04, '#f0962c', 0.055), (0.05, -0.06, '#e88a28', 0.055), (0.0, 0.07, '#c8342a', 0.052),
                             (0.08, 0.04, '#f0962c', 0.052), (-0.07, 0.06, '#8aac3a', 0.05), (0.0, 0.0, '#f4a234', 0.058)):
        o = c.novo_obj(3)
        c.elipsoide(np.array([x + dx, y + dy, z + 0.06 + r * 0.8]), np.array([r, r, r * 0.92]), liso(cor), o, brilho=0.5)
    itens_peq.append((x - 0.15, x + 0.15, y - 0.15, y + 0.15, z))


def toalhinha(x0, x1, y0, y1, z):
    """
    O caminho de mesa de crochê: creme, a barra de bicos (os buraquinhos em fileira e a linha de ponto) e, no meio,
    o miolo das florzinhas de crochê.
    """
    def f(L, n, P):
        X, Y = P[:, 0], P[:, 1]
        u, v = (X - x0) / PH, (Y - y0) / PH            # em px (ao comprido, de través)
        U, V = (x1 - x0) / PH, (y1 - y0) / PH
        out = np.tile(hx('#efe6d0'), (len(P), 1))
        bv = np.minimum(v, V - v)                    # a distância até a beira comprida
        bu = np.minimum(u, U - u)
        borda = (bv < 2) | (bu < 2)
        out = np.where(borda[:, None], hx('#f6efdc'), out)
        # os bicos: um buraquinho a cada 4 px na fileira de fora; a linha de ponto por dentro da barra
        fur = ((bv < 1) & (np.floor(u) % 4 == 1)) | ((bu < 1) & (np.floor(v) % 4 == 1))
        out = np.where(fur[:, None], hx('#c4b28e'), out)
        lin = ~borda & (((bv >= 2) & (bv < 3)) | ((bu >= 2) & (bu < 3)))
        out = np.where(lin[:, None], hx('#dccfae'), out)
        # o miolo das florzinhas no meio, a cada 16 px (na tela, um losanguinho)
        cu = (u - 8) % 16 - 8
        q = np.abs(cu) + np.abs(v - V / 2)
        out = np.where((~borda & (q < 1.6) & (bu > 6))[:, None], hx('#d2bf94'), out)
        return out
    o = c.novo_obj(3, contorno=False)
    fp([(x0, y0, z), (x1, y0, z), (x1, y1, z), (x0, y1, z)], (0, 0, 1), emissivo(f), o)


# =====================================================================================================================
# o caixote, o barril, a planta
# =====================================================================================================================
def ripado(cor, x0, x1, y0, y1, z0, z1):
    """As ripas do caixote: fiadas de 4 px com a fresta escura de 1 px e as quinas mais escuras."""
    c0 = hx(cor)

    def f(L, n, P):
        out = np.tile(c0, (len(P), 1))
        if abs(n[2]) < 0.5:
            fr = np.floor((P[:, 2] - z0) / PZ + 1e-6) % 5
            out = np.where((fr == 4)[:, None], _tom(c0, 0.55), out)
            out = np.where((fr == 3)[:, None], _tom(c0, 1.1), out)
            al = P[:, 0] if abs(n[1]) > 0.5 else P[:, 1]
            q0, q1 = (x0, x1) if abs(n[1]) > 0.5 else (y0, y1)
            out = np.where(((al - q0 < 0.04) | (q1 - al < 0.04))[:, None], _tom(c0, 0.8), out)
        else:
            out = _tom(c0, 1.15)
        return out
    return emissivo(f)


def caixotes(x0, y0):
    """Dois caixotes de feira empilhados (0,8 m): o de baixo fechado, o de cima aberto com a moranga, o milho e as batatas."""
    x1, y1 = x0 + 0.66, y0 + 0.62
    caixa((x0, x1, y0, y1, 0, 0.4), ripado('#a8743e', x0, x1, y0, y1, 0, 0.4))
    a0, a1, b0, b1 = x0 + 0.02, x1 - 0.02, y0 + 0.02, y1 - 0.02
    zb, zt = 0.4, 0.74
    esp = 0.025
    oc = c.novo_obj(3)
    m = ripado('#b8824a', a0, a1, b0, b1, zb, zt)
    for bb in ((a0, a1, b0, b0 + esp, zb, zt), (a0, a0 + esp, b0, b1, zb, zt), (a1 - esp, a1, b0, b1, zb, zt), (a0, a1, b1 - esp, b1, zb, zt)):
        c.caixa(bb, m, M, oc)
    fp([(a0, b0, zb + 0.24), (a1, b0, zb + 0.24), (a1, b1, zb + 0.24), (a0, b1, zb + 0.24)], (0, 0, 1), liso('#3a2414'), oc)
    # a feira dentro, amontoada acima da borda: as batatas, a moranga e as espigas de milho
    zf = zb + 0.24
    for k in range(12):
        bx = a0 + 0.09 + (k % 4) * 0.14 + 0.025 * ruido(k, 1.0)
        by = b0 + 0.09 + (k // 4) * 0.17 + 0.025 * ruido(k, 2.0)
        meio = 1 - (abs(bx - (a0 + a1) / 2) / 0.35 + abs(by - (b0 + b1) / 2) / 0.35) * 0.5
        o = c.novo_obj(3)
        c.elipsoide(np.array([bx, by, zf + 0.06 + 0.05 * meio]), np.array([0.065, 0.055, 0.05]), liso(('#c49a64', '#b88e58', '#cca46e')[k % 3]), o, brilho=0.15)
    abobora(a0 + 0.2, b0 + 0.22, zf + 0.06)
    for k, (bx, by) in enumerate(((a1 - 0.16, b0 + 0.13), (a1 - 0.1, b0 + 0.3), (a1 - 0.2, b0 + 0.42))):
        espiga(bx, by, zf + 0.12, k)
    pegadas.append((x0, x1, y0, y1))


def caixote_aberto(x0, y0):
    """
    O caixote de feira ABERTO (o estado 1 do crate_wood): só o de baixo, sem o de cima, com a tampa erguida e inclinada para
    trás (presa pelas dobradiças do fundo) e o feno com as ferramentas à vista: um martelo, o rolo de corda e a serra.
    """
    x1, y1 = x0 + 0.66, y0 + 0.62
    zt = 0.4
    esp = 0.03
    m = ripado('#a8743e', x0, x1, y0, y1, 0, zt)
    oc = c.novo_obj(3)
    for bb in ((x0, x1, y0, y0 + esp, 0, zt), (x0, x0 + esp, y0, y1, 0, zt), (x1 - esp, x1, y0, y1, 0, zt), (x0, x1, y1 - esp, y1, 0, zt)):
        c.caixa(bb, m, M, oc)
    # o vão: o fundo escuro e as paredes de dentro um pouco mais claras que o fundo, para as coisas se destacarem
    fp([(x0 + esp, y0 + esp, 0.03), (x1 - esp, y0 + esp, 0.03), (x1 - esp, y1 - esp, 0.03), (x0 + esp, y1 - esp, 0.03)], (0, 0, 1), liso('#3a2414'), oc)
    fp([(x0 + esp, y0 + esp, 0.03), (x1 - esp, y0 + esp, 0.03), (x1 - esp, y0 + esp, zt), (x0 + esp, y0 + esp, zt)], (0, 1, 0), liso('#4a2e1a'), oc)
    fp([(x0 + esp, y0 + esp, 0.03), (x0 + esp, y1 - esp, 0.03), (x0 + esp, y1 - esp, zt), (x0 + esp, y0 + esp, zt)], (1, 0, 0), liso('#3a2414'), oc)
    # o feno: um monte de palha em tufos, até um pouco abaixo da boca
    a0, a1, b0, b1 = x0 + esp + 0.01, x1 - esp - 0.01, y0 + esp + 0.01, y1 - esp - 0.01
    for k in range(18):
        bx = a0 + 0.06 + (k % 5) * 0.115 + 0.03 * ruido(k, 3.0)
        by = b0 + 0.07 + (k // 5) * 0.14 + 0.03 * ruido(k, 4.0)
        o = c.novo_obj(3)
        c.elipsoide(np.array([bx, by, 0.3 + 0.03 * ruido(k, 5.0)]), np.array([0.085, 0.075, 0.07]),
                    liso(('#d8b458', '#c8a444', '#e0c068')[k % 3]), o, brilho=0.1)
    # as ferramentas por cima: o martelo, o rolo de corda e a serra
    _barra((a0 + 0.05, a0 + 0.3, b0 + 0.22, b0 + 0.245, 0.37, 0.395), '#7a5230', '#9a6a40', quina=False)
    _barra((a0 + 0.3, a0 + 0.36, b0 + 0.2, b0 + 0.265, 0.36, 0.42), '#4a4e52', '#8a9094', quina=False)
    o = c.novo_obj(3)
    c.cilindro(a1 - 0.14, b1 - 0.16, 0.1, 0.34, 0.4, vol(a1 - 0.14, b1 - 0.16, '#b89860', brilho=0.1), M, o, lados=14, tampa_mat=liso('#8a6c3c'))
    _barra((a0 + 0.08, a0 + 0.36, b1 - 0.09, b1 - 0.07, 0.37, 0.4), '#9aa0a4', '#d0d4d8', quina=False)
    _barra((a0 + 0.02, a0 + 0.1, b1 - 0.11, b1 - 0.05, 0.37, 0.41), '#7a5230', quina=False)
    # a tampa erguida: inclinada uns 10 graus para trás da vertical, presa na borda do fundo
    ty, tz = -0.17, 0.985
    ny, nz = 0.985, 0.17
    L = 0.62
    P0 = (y0, zt)
    P1 = (y0 + L * ty, zt + L * tz)

    def pt(x, P, off):
        return (x, P[0] + off * ny, P[1] + off * nz)
    ot = c.novo_obj(3)
    mt = ripado('#b8824a', x0, x1, y0 - 0.1, y1, 0, 1.0)
    fp([pt(x0, P0, esp), pt(x1, P0, esp), pt(x1, P1, esp), pt(x0, P1, esp)], (0, ny, nz), mt, ot)
    fp([pt(x1, P0, 0), pt(x0, P0, 0), pt(x0, P1, 0), pt(x1, P1, 0)], (0, -ny, -nz), mt, ot)
    fp([pt(x0, P1, 0), pt(x1, P1, 0), pt(x1, P1, esp), pt(x0, P1, esp)], (0, ty, tz), liso('#d0985c'), ot)
    fp([pt(x1, P0, 0), pt(x1, P1, 0), pt(x1, P1, esp), pt(x1, P0, esp)], (1, 0, 0), mt, ot)
    fp([pt(x0, P1, 0), pt(x0, P0, 0), pt(x0, P0, esp), pt(x0, P1, esp)], (-1, 0, 0), mt, ot)
    pegadas.append((x0, x1, y0, y1))


def espiga(x, y, z, k):
    """A espiga de milho deitada: os grãos amarelos em fileiras e a palha verde-clara aberta."""
    o = c.novo_obj(3)
    ang = (0.3, -0.5, 1.0)[k]
    d = np.array([math.cos(ang), math.sin(ang), 0.25])
    d /= np.linalg.norm(d)
    C = np.array([x, y, z])
    for i in range(3):
        o2 = c.novo_obj(3)
        c.elipsoide(C + d * (i - 1) * 0.05, np.array([0.045, 0.045, 0.04]),
                    emissivo(lambda L, n, P: np.where(((np.floor(P[:, 0] / PH) + np.floor(P[:, 2] / PZ)) % 2 == 0)[:, None], hx('#f0c040'), hx('#d8a02a'))), o2)
    c.elipsoide(C - d * 0.11, np.array([0.035, 0.035, 0.03]), liso('#b8c878'), o)


def barril(x, y, r=0.3, h=0.95):
    """O barril de água (1 m): o de aduelas da sala, mais alto, com a caneca de lata em cima da tampa."""
    barril_cesto(x, y, r=r, h=h)
    # a caneca de lata (o caneco de tirar água) em cima
    o = c.novo_obj(3)
    c.cilindro(x + 0.06, y + 0.04, 0.05, h, h + 0.09, vol(x + 0.06, y + 0.04, '#a8acb0', brilho=0.5), M, o, lados=14, tampa_mat=liso('#5a5e62'))
    o = c.novo_obj(3)
    _fita([(0.045, h + 0.075), (0.09, h + 0.07), (0.1, h + 0.045), (0.09, h + 0.02), (0.045, h + 0.018)], x + 0.06, y + 0.04, liso('#8a8e92'), o, 0.018)
    itens_peq.append((x + 0.01, x + 0.11, y - 0.01, y + 0.09, h))


def espada_sao_jorge(x, y):
    """A espada-de-são-jorge no vaso de barro (1,2 m): as folhas em lâmina, verde-escuro com a faixa e a borda amarela."""
    perfil = [(0.0, 0.14), (0.04, 0.17), (0.3, 0.19), (0.3, 0.205), (0.34, 0.205)]

    def aro(P, base):
        zz = P[:, 2]
        base = np.where((zz > 0.3 + PZ * 0.5)[:, None], _tom(base, 1.1), base)
        return np.where(((zz > 0.3 - PZ) & (zz <= 0.3))[:, None], _tom(base, 0.7), base)
    o = c.novo_obj(3)
    _poligono_rodado(x, y, perfil, vol(x, y, '#b0623a', brilho=0.15, faixas=aro), o, lados=22)

    def terra(L, n, P):
        rr = np.hypot(P[:, 0] - x, P[:, 1] - y)
        return np.where((rr > 0.18)[:, None], hx('#9a5432'), hx('#3e2a1c'))
    _disco(x, y, 0.33, 0.205, emissivo(terra), o, lados=22)
    pegadas.append((x - 0.2, x + 0.2, y - 0.2, y + 0.2))
    # as folhas: lâminas de frente para a câmera (no plano que passa pelo meio), cada uma inclinada e torcida; com
    # os dois lados (o móvel girado sozinho: a câmera do giro, BE.GIRO)
    hv, rv = BE.frente_tela()
    nf = (float(hv[0]), float(hv[1]), 0.0)
    folhas = ((-0.09, 0.0, -0.12, 0.98, 0.07), (-0.03, -0.04, -0.05, 1.18, 0.08), (0.04, 0.03, 0.07, 1.1, 0.075),
              (0.1, -0.02, 0.17, 0.86, 0.065), (0.0, 0.06, 0.0, 0.92, 0.07), (-0.13, 0.05, -0.24, 0.72, 0.06), (0.13, 0.06, 0.25, 0.7, 0.06))
    for (s0, dv, s1, alto, larg) in folhas:
        of = c.novo_obj(3)
        cx_, cy_ = x + dv * hv[0], y + dv * hv[1]
        ns = 8
        pts_e, pts_d = [], []
        for i in range(ns + 1):
            q = i / ns
            s = s0 + (s1 - s0) * q ** 1.4
            zz = 0.3 + (alto - 0.3) * q
            w = larg * (0.55 + 0.6 * math.sin(math.pi * min(1.0, q * 1.15)) ** 0.7) * (1 - q ** 3)
            pts_e.append((s - w / 2, zz))
            pts_d.append((s + w / 2, zz))

        def f(L, n, P, cx_=cx_, cy_=cy_, s0=s0, s1=s1, alto=alto):
            sp = (P[:, 0] - cx_) * rv[0] + (P[:, 1] - cy_) * rv[1]
            q = np.clip((P[:, 2] - 0.3) / (alto - 0.3), 0, 1)
            meio = s0 + (s1 - s0) * q ** 1.4
            lado = sp - meio
            out = np.tile(hx('#2f5a34'), (len(P), 1))
            faixa = (np.floor(P[:, 2] / (3 * PZ)) % 3 == 0)
            out = np.where(faixa[:, None], hx('#3e7044'), out)
            out = np.where((lado < -0.004)[:, None] & ~faixa[:, None], hx('#3a6a3e'), out)
            borda = np.abs(lado) > 0.026
            out = np.where(borda[:, None], hx('#c8c050'), out)
            return _cru(out, nf)
        for i in range(ns):
            (a0, z0), (a1, z1) = pts_e[i], pts_e[i + 1]
            (b0, _), (b1, _) = pts_d[i], pts_d[i + 1]
            quad = [(a0, z0), (b0, z0), (b1, z1), (a1, z1)]
            c.face_plana([(cx_ + s * rv[0], cy_ + s * rv[1], zz) for (s, zz) in quad], nf, emissivo(f), M, of, dois_lados=True)


def tapete_tranca(xc, yc, r=0.6):
    """O tapete redondo de trança de retalhos: os anéis de cores, cada um com a trança em diagonal, a borda escura."""
    cores = np.stack([hx(x) for x in ('#a8443a', '#c89a48', '#4e6a8a', '#e2d2ae', '#6e7c4a', '#b8604a', '#d8b878')])
    pa = 3 * PH                                   # a largura de cada anel (3 px)

    def f(L, n, P):
        dx, dy = P[:, 0] - xc, P[:, 1] - yc
        rr = np.hypot(dx, dy)
        anel = np.floor(rr / pa)
        ang = np.arctan2(dy, dx)
        out = cores[(anel.astype(int) * 3) % len(cores)]
        # a trança: os gomos em diagonal, um claro e um escuro, desencontrados de anel para anel
        g = np.floor(ang * rr / (3 * PH) + anel * 0.5 + (rr % pa) / pa)
        out = np.where((g % 2 == 0)[:, None], _tom(out, 1.08), _tom(out, 0.9))
        out = np.where((rr % pa < PH * 0.8)[:, None], _tom(out, 0.78), out)
        out = np.where((rr > r - 1.6 * PH)[:, None], hx('#5a2e22'), out)
        return out
    o = c.novo_obj(3)
    c.cilindro(xc, yc, r, 0.0, 0.014, liso('#4a2620'), M, o, lados=40, tampa_mat=emissivo(f))


def banquinho(x, y, cor='#8a5230'):
    """O banquinho de madeira encostado na parede, com a bacia de ágata em cima."""
    s, d, h = 0.36, 0.3, 0.4
    caixa((x, x + s, y, y + d, h - 0.04, h), {'cima': tab2(['#b07440', '#a86e3c'], d / 2, '#5a2c16', eixo=0, seed=81, org=y), '*': _pau(cor, quina=False)}, sombra=False)
    for (a, b) in ((x + 0.03, y + 0.03), (x + s - 0.07, y + 0.03), (x + 0.03, y + d - 0.07), (x + s - 0.07, y + d - 0.07)):
        _barra((a, a + 0.04, b, b + 0.04, 0, h - 0.04), '#6a3c22', '#8a5230', quina=False)
    _barra((x + 0.05, x + s - 0.05, y + d - 0.06, y + d - 0.04, 0.12, 0.15), '#6a3c22', quina=False)
    pegadas.append((x, x + s, y, y + d))
    # a bacia esmaltada (branca com a borda azul) e o pano dobrado dentro
    bx, by = x + s / 2, y + d / 2
    o = c.novo_obj(3)
    _poligono_rodado(bx, by, [(h, 0.1), (h + 0.05, 0.15), (h + 0.07, 0.17)], vol(bx, by, '#ece6da', brilho=0.4,
                     faixas=lambda P, b: np.where((P[:, 2] > h + 0.07 - 1.2 * PZ)[:, None], hx('#3e5f8e'), b)), o, lados=24)

    def dentro(L, n, P):
        rr = np.hypot(P[:, 0] - bx, P[:, 1] - by)
        out = np.where((rr > 0.15)[:, None], hx('#3e5f8e'), hx('#c8c2b6'))
        pano = (np.abs(P[:, 0] - bx - 0.02) < 0.06) & (np.abs(P[:, 1] - by + 0.01) < 0.05)
        return np.where(pano[:, None], np.where(((np.floor(P[:, 0] / (2 * PH)) + np.floor(P[:, 1] / (2 * PH))) % 2 == 0)[:, None], hx('#b8402e'), hx('#f0e6d6')), out)
    _disco(bx, by, h + 0.07, 0.17, emissivo(dentro), o, lados=24)
    itens_peq.append((bx - 0.17, bx + 0.17, by - 0.17, by + 0.17, h))


# =====================================================================================================================
# as coisas de parede: a prateleira com os potes e as panelas penduradas, a natureza-morta, o relógio, o alho
# =====================================================================================================================
def prateleira(xc, zb, larg=0.72, fundo=0.24):
    """A prateleira de parede (no fundo): a tábua nas mãos-francesas, os potes e, embaixo, o trilho com as panelas."""
    x0, x1 = xc - larg / 2, xc + larg / 2
    caixa((x0, x1, 0, fundo, zb, zb + 0.035), {'cima': tab2(['#b07440', '#a86e3c'], 0.12, '#5a2c16', eixo=0, seed=71), '*': mad2('#8a5230', seed=72, passo=0.03)}, tipo=3, sombra=False)
    for xx in (x0 + 0.08, x1 - 0.11):
        o = c.novo_obj(3)
        fp([(xx, 0.0, zb), (xx, fundo - 0.04, zb), (xx, 0.0, zb - 0.2)], (-1, 0, 0), liso('#7a4628'), o)
        fp([(xx + 0.03, 0.0, zb), (xx + 0.03, fundo - 0.04, zb), (xx + 0.03, 0.0, zb - 0.2)], (1, 0, 0), liso('#6a3c22'), o)
        fp([(xx, fundo - 0.04, zb), (xx + 0.03, fundo - 0.04, zb), (xx + 0.03, 0.0, zb - 0.2), (xx, 0.0, zb - 0.2)], (0, 0.98, -0.2), liso('#8a5230'), o)
    # os potes de vidro (feijão, arroz, café, fubá) e a lata de biscoito
    for k, (cor, hh) in enumerate((('#5a2a1e', 0.15), ('#f0ead8', 0.17), ('#e8c050', 0.14))):
        pote_vidro(x0 + 0.09 + k * 0.135, fundo / 2, zb + 0.035, cor, h=hh, r=0.05)
    lata(x1 - 0.12, fundo / 2, zb + 0.035, '#3e6a8e', 0.13)
    # o trilho com os ganchos e as panelas penduradas
    zr = zb - 0.26
    _barra((x0 + 0.04, x1 - 0.04, 0.02, 0.045, zr, zr + 0.022), '#3a3634', '#5a5450', quina=False)
    for (xx, w) in ((x0 + 0.04, 0.03), (x1 - 0.07, 0.03)):
        _barra((xx, xx + w, 0.0, 0.03, zr - 0.01, zr + 0.032), '#2a2624', quina=False)
    frigideira(x0 + 0.17, zr, 0.12)
    panela_pend(x0 + 0.42, zr, 0.09)
    concha(x1 - 0.15, zr)
    escumadeira(x1 - 0.07, zr)


def _pend(xc, zr, oid, comp=0.04):
    """O gancho em S de onde a coisa pende."""
    _barra((xc - 0.006, xc + 0.006, 0.03, 0.045, zr - comp, zr), '#2a2624', quina=False)


def frigideira(xc, zr, r):
    """A frigideira de ferro pendurada de pé (o fundo para a sala): o disco escuro com o brilho e o cabo para cima."""
    _pend(xc, zr, None)
    zc = zr - 0.04 - 0.22 - r
    o = c.novo_obj(3)
    lados = 22

    def f(L, n, P):
        rr = np.hypot(P[:, 0] - xc, P[:, 2] - zc) / r
        out = np.tile(hx('#2e2c2c'), (len(P), 1))
        out = np.where((rr > 0.86)[:, None], hx('#4a4644'), out)
        out = np.where(((rr > 0.45) & (rr < 0.55) & (P[:, 2] > zc) & (P[:, 0] < xc))[:, None], hx('#5e5a58'), out)
        return out
    fp([(xc + r * math.cos(2 * math.pi * i / lados), 0.05, zc + r * math.sin(2 * math.pi * i / lados)) for i in range(lados)], (0, 1, 0), emissivo(f), o)
    _barra((xc - 0.012, xc + 0.012, 0.035, 0.05, zc + r - 0.01, zr - 0.04), '#3a2a1e', '#5a4030', quina=False)


def panela_pend(xc, zr, r):
    """A panela de alumínio pendurada pela alça (de lado: o corpo, a boca para cima, o brilho)."""
    _pend(xc, zr, None)
    z1 = zr - 0.07
    z0 = z1 - 0.12
    o = c.novo_obj(3)
    yc = 0.05 + r
    c.cilindro(xc, yc, r, z0, z1, vol(xc, yc, '#b4b8bc', brilho=0.55), M, o, lados=18, tampa_mat=emissivo(
        lambda L, n, P: np.where((np.hypot(P[:, 0] - xc, P[:, 1] - yc) > r - 0.015)[:, None], hx('#d8dce0'), hx('#6a6e72'))))
    _barra((xc - 0.008, xc + 0.008, 0.03, yc - r + 0.01, z1 - 0.01, zr - 0.04), '#8a8e92', quina=False)
    itens_peq.append((xc - r, xc + r, yc - r, yc + r, z0))


def concha(xc, zr):
    """A concha de servir (o cabo comprido e a cuia embaixo)."""
    _pend(xc, zr, None)
    _barra((xc - 0.009, xc + 0.009, 0.035, 0.05, zr - 0.3, zr - 0.04), '#9a9ea2', '#d0d4d8', quina=False)
    o = c.novo_obj(3)
    c.elipsoide(np.array([xc, 0.06, zr - 0.33]), np.array([0.045, 0.03, 0.04]), liso('#a8acb0'), o, brilho=0.5, corte_z=None)


def escumadeira(xc, zr):
    _pend(xc, zr, None)
    _barra((xc - 0.008, xc + 0.008, 0.035, 0.05, zr - 0.27, zr - 0.04), '#9a9ea2', '#d0d4d8', quina=False)
    o = c.novo_obj(3)
    lados = 14
    r = 0.05
    zc = zr - 0.3

    def f(L, n, P):
        out = np.tile(hx('#a8acb0'), (len(P), 1))
        fur = ((np.floor(P[:, 0] / PH) + np.floor(P[:, 2] / PZ)) % 2 == 0) & (np.hypot(P[:, 0] - xc, P[:, 2] - zc) < r * 0.7)
        return np.where(fur[:, None], hx('#5a5e62'), out)
    fp([(xc + r * math.cos(2 * math.pi * i / lados), 0.052, zc + r * math.sin(2 * math.pi * i / lados)) for i in range(lados)], (0, 1, 0), emissivo(f), o)


def natureza_morta(x0, x1, z0, z1):
    """O quadro da natureza-morta (no fundo, em cima do fogão): a moldura dourada e a fruteira pintada no pixel."""
    e = 0.06
    o = c.novo_obj(3)
    MOL = _p1_mat_rampa(_p1_rampa(['#4a3216', '#6e4c1e', '#9a7028', '#c49a38', '#e2c058', '#f6e090']), 2.0, 4.6)
    yf = 0.05
    fp([(x0, yf, z0), (x1, yf, z0), (x1, yf, z1), (x0, yf, z1)], (0, 1, 0), MOL, o)
    fp([(x0, 0, z1), (x1, 0, z1), (x1, yf, z1), (x0, yf, z1)], (0, 0, 1), _p1_mat_rampa(_p1_rampa(['#6e4c1e', '#c49a38', '#f6e090']), 2.0, 2.0), o)
    fp([(x1, 0, z0), (x1, yf, z0), (x1, yf, z1), (x1, 0, z1)], (1, 0, 0), _p1_mat_rampa(_p1_rampa(['#4a3216', '#6e4c1e', '#9a7028']), 1.0, 1.0), o)
    a0, a1, b0, b1 = x0 + e, x1 - e, z0 + e, z1 - e
    W = (a1 - a0)
    Hh = (b1 - b0)
    C = {k: hx(v) for k, v in dict(fu='#2e2a22', fu2='#3a3428', mesa='#6a4428', mesa2='#54341e', pano='#e8dcc0', pano2='#c4b494',
                                    tig='#8a5a3a', tig2='#a8704a', lar='#e8902a', lar2='#f6b44a', mac='#b8302a', mac2='#d85040',
                                    uva='#5a3a6a', uva2='#7a5a8a', per='#c8b840', per2='#e0d060', fol='#4a6a2a').items()}

    def pintura(L, n, P):
        i = np.floor((P[:, 0] - a0) * KX + 1e-4).astype(int)
        v = np.floor((b1 - P[:, 2]) * KZ + 1e-4).astype(int)
        S = np.floor(tela(P) + 1e-4).astype(int)
        rs = S[:, 1] - int(math.floor(tela(np.array([a0, yf, b1]))[1]))
        out = np.tile(C['fu'], (len(P), 1))
        out[(v % 7 == 3) & (i % 5 == 1)] = C['fu2']
        Wp = int(W * KX)
        Hp = int(Hh * KZ)
        mesa_ = v >= Hp - 5
        out[mesa_] = C['mesa']
        out[v == Hp - 5] = C['mesa2']
        # a fruteira (a tigela) no meio, as frutas em cima, a pera e a uva do lado (desenhadas na tela)
        cx_, base = Wp // 2, Hp - 6
        def bola(ci, cr, rad, a, b):
            d2 = (i - ci) ** 2 + ((rs - (cr + (ci // 2))) * 1.0) ** 2
            out[d2 <= rad * rad] = C[a]
            out[(d2 <= rad * rad) & (i < ci) & (rs - (cr + (ci // 2)) < 0)] = C[b]
        tig = (np.abs(i - cx_) <= 5) & (v >= base - 3) & (v <= base)
        out[tig] = C['tig']
        out[tig & (v == base - 3)] = C['tig2']
        r0 = base - 3 - (cx_ // 2) - int(math.floor(0))
        rb = int(np.median(rs[v == base - 3])) if np.any(v == base - 3) else 0
        for (di, dr, rad, a, b) in ((-3, -2, 2.6, 'lar', 'lar2'), (2, -2, 2.6, 'lar', 'lar2'), (0, -5, 2.4, 'mac', 'mac2')):
            ci = cx_ + di
            d2 = (i - ci) ** 2 + (rs - (rb + dr - (ci - cx_) // 2)) ** 2
            out[d2 <= rad * rad] = C[a]
            out[(d2 <= rad * rad * 0.35) & (i < ci)] = C[b]
        # a uva (bolinhas) à esquerda e a pera à direita
        for (di, dv) in ((-8, 0), (-9, -2), (-7, -2), (-8, -4), (-10, 0), (-6, 0)):
            out[((i - (cx_ + di)) ** 2 + (v - (base + dv)) ** 2) <= 1] = C['uva']
        out[((i - (cx_ - 8)) ** 2 + (v - (base - 2)) ** 2) == 0] = C['uva2']
        pera = ((i - (cx_ + 8)) ** 2 / 4.0 + (v - (base - 2)) ** 2 / 9.0) <= 1
        out[pera] = C['per']
        out[pera & (i < cx_ + 8)] = C['per2']
        out[(i == cx_ + 8) & (v == base - 6)] = C['fol']
        # a sombra da moldura na tela
        out[v == 0] *= 0.6
        out[i == 0] *= 0.7
        return out
    o2 = c.novo_obj(3, contorno=False)
    fp([(a0, yf + 0.002, b0), (a1, yf + 0.002, b0), (a1, yf + 0.002, b1), (a0, yf + 0.002, b1)], (0, 1, 0), emissivo(pintura), o2)


def relogio_esq(yc, z, r=0.19):
    """O relógio redondo na parede da esquerda (x = 0): o aro de madeira, o mostrador creme, as marcas e os ponteiros."""
    lados = 28
    x0, x1 = 0.02, 0.09
    o = c.novo_obj(3)
    for i in range(lados):
        a0, a1 = 2 * math.pi * i / lados, 2 * math.pi * (i + 1) / lados
        am = (a0 + a1) / 2
        nn = (0.0, math.cos(am), math.sin(am))
        k = 0.8 + 0.35 * max(0.0, math.sin(am)) + 0.1 * math.cos(am)
        cc = np.clip(hx('#7a4424') * k, 0, 255).astype(int)
        fp([(x0, yc + r * math.cos(a0), z + r * math.sin(a0)), (x0, yc + r * math.cos(a1), z + r * math.sin(a1)),
            (x1, yc + r * math.cos(a1), z + r * math.sin(a1)), (x1, yc + r * math.cos(a0), z + r * math.sin(a0))], nn, liso('#%02x%02x%02x' % tuple(cc)), o)
    rm = r - 0.05

    def aro(L, n, P):
        dy, dz = P[:, 1] - yc, P[:, 2] - z
        rr = np.hypot(dy, dz)
        lado = (dy * 0.6 + dz * 0.8) / np.maximum(rr, 1e-6)
        out = np.tile(hx('#8a4e2a'), (len(P), 1))
        out = np.where((rr > r - 0.02)[:, None], np.where((lado > 0.2)[:, None], hx('#b06a3a'), hx('#6a3a1e')), out)
        out = np.where((rr < rm + 0.018)[:, None], np.where((lado > 0.2)[:, None], hx('#5a3018'), hx('#a8643a')), out)
        return out
    fp([(x1, yc + r * math.cos(2 * math.pi * i / lados), z + r * math.sin(2 * math.pi * i / lados)) for i in range(lados)], (1, 0, 0), emissivo(aro), o)
    xd = x1 + 0.004
    cen = np.floor(tela(np.array([xd, yc, z]))).astype(int)

    def ponto(a, dd):
        return tuple(np.floor(tela(np.array([xd, yc - dd * math.sin(a), z + dd * math.cos(a)]))).astype(int))

    def linha(p0, p1):
        (xa, ya), (xb, yb) = p0, p1
        n = max(abs(xb - xa), abs(yb - ya), 1)
        return {(int(round(xa + (xb - xa) * t / n)), int(round(ya + (yb - ya) * t / n))) for t in range(n + 1)}
    marcas = {ponto(2 * math.pi * h / 12, rm - 0.025) for h in range(0, 12, 3)}
    pont = linha(tuple(cen), ponto(2 * math.pi * 4 / 12, rm * 0.55)) | linha(tuple(cen), ponto(2 * math.pi * 11.6 / 12, rm * 0.8))

    def most(L, n, P):
        S = np.floor(tela(P)).astype(int)
        ch = S[:, 0] * 100000 + S[:, 1]
        dy, dz = P[:, 1] - yc, P[:, 2] - z
        rr = np.hypot(dy, dz)
        lado = (dy * 0.6 + dz * 0.8) / np.maximum(rr, 1e-6)
        out = np.tile(hx('#efe6cc'), (len(P), 1))
        out = np.where(((rr > rm - 0.025) & (lado > 0.35))[:, None], hx('#d2c6a6'), out)
        out = np.where(np.isin(ch, [a * 100000 + b for (a, b) in marcas])[:, None], hx('#3a2a22'), out)
        out = np.where(np.isin(ch, [a * 100000 + b for (a, b) in pont])[:, None], hx('#2a1e1a'), out)
        return out
    o2 = c.novo_obj(3, contorno=False)
    fp([(xd, yc + rm * math.cos(2 * math.pi * i / lados), z + rm * math.sin(2 * math.pi * i / lados)) for i in range(lados)], (1, 0, 0), emissivo(most), o2)


def tabua_colheres(yc, zt):
    """Na parede da esquerda, num prego: a tábua de carne de pá (com o furo do cabo) e duas colheres de pau."""
    _barra((0.0, 0.035, yc - 0.012, yc + 0.012, zt, zt + 0.025), '#3a3634', quina=False)
    o = c.novo_obj(3)
    x = 0.03
    corpo = [(yc - 0.15, zt - 0.5), (yc + 0.15, zt - 0.5), (yc + 0.16, zt - 0.47), (yc + 0.16, zt - 0.17), (yc + 0.14, zt - 0.14),
             (yc + 0.05, zt - 0.12), (yc + 0.05, zt - 0.02), (yc - 0.05, zt - 0.02), (yc - 0.05, zt - 0.12), (yc - 0.14, zt - 0.14),
             (yc - 0.16, zt - 0.17), (yc - 0.16, zt - 0.47)]

    def mad(L, n, P):
        out = np.tile(hx('#dcaa6c'), (len(P), 1))
        g = np.floor(P[:, 2] / PZ)
        out = np.where(((g % 5 == 0) & (ruido(np.floor(P[:, 1] / 0.2), g, 3.0) > 0.4))[:, None], hx('#c8945a'), out)
        furo = np.hypot((P[:, 1] - yc) * KX, (P[:, 2] - (zt - 0.07)) * KZ) < 1.3
        return np.where(furo[:, None], hx('#5a4a3a'), out)
    # a face (com o contorno de quina) e a grossura de lado (a de +y, que a câmera vê)
    # (o polígono é côncavo: vai em dois pedaços convexos, a pá e o cabo)
    pa = corpo[:5] + corpo[9:]
    cabo = [corpo[5], corpo[6], corpo[7], corpo[8]]
    fp([(x, a, b) for (a, b) in pa], (1, 0, 0), emissivo(mad), o)
    fp([(x, a, b) for (a, b) in cabo], (1, 0, 0), emissivo(mad), o)
    fp([(0.0, yc + 0.15, zt - 0.5), (x, yc + 0.15, zt - 0.5), (x, yc + 0.16, zt - 0.47), (0.0, yc + 0.16, zt - 0.47)], (0, 0.95, -0.3), liso('#9a6a3a'), o)
    fp([(0.0, yc + 0.16, zt - 0.47), (x, yc + 0.16, zt - 0.47), (x, yc + 0.16, zt - 0.17), (0.0, yc + 0.16, zt - 0.17)], (0, 1, 0), liso('#a8763e'), o)
    # as colheres de pau (o cabo e a concha oval)
    for k, yy in enumerate((yc + 0.26, yc + 0.38)):
        _barra((0.0, 0.035, yy - 0.01, yy + 0.01, zt - 0.02, zt + 0.005), '#3a3634', quina=False)
        oc_ = c.novo_obj(3)
        fp([(0.03, yy - 0.025, zt - 0.36 + 0.03 * k), (0.03, yy + 0.025, zt - 0.36 + 0.03 * k), (0.03, yy + 0.025, zt - 0.01), (0.03, yy - 0.025, zt - 0.01)],
           (1, 0, 0), liso('#b8844e'), oc_)
        cz_ = zt - 0.4 + 0.03 * k
        fp([(0.03, yy + 0.06 * math.cos(a), cz_ + 0.075 * math.sin(a)) for a in np.linspace(0, 2 * math.pi, 16, endpoint=False)], (1, 0, 0),
           liso('#c8925a'), oc_)


def lampada(x, y, zc=2.3):
    """
    A lâmpada pendurada de esmalte: a cúpula branca com a borda azul, a lâmpada acesa, o soquete preto e o fio que
    sobe e some aos poucos (em degraus, para o que está atrás dele) antes da viga.
    """
    o = c.novo_obj(3)
    perfil = [(zc, 0.2), (zc + 0.03, 0.18), (zc + 0.08, 0.12), (zc + 0.13, 0.055), (zc + 0.15, 0.04)]

    def esmalte(P, b):
        zz = P[:, 2] - zc
        b = np.where((zz < 1.5 * PZ)[:, None], hx('#3e5f8e'), b)
        return np.where(((zz > 0.115) & (zz < 0.115 + PZ))[:, None], hx('#3e5f8e'), b)
    _poligono_rodado(x, y, perfil, vol(x, y, '#ece6d6', brilho=0.35, faixas=esmalte), o, lados=26, tampa_mat=liso('#d8d2c2'))
    c.cilindro(x, y, 0.025, zc + 0.15, zc + 0.2, vol(x, y, '#2a2624', brilho=0.3), M, o, lados=10, tampa_mat=liso('#3a3634'))
    ob = c.novo_obj(3, contorno=False)
    luzes.add(ob)
    c.elipsoide(np.array([x, y, zc - 0.012]), np.array([0.05, 0.05, 0.04]), liso('#fff4c8'), ob)
    of = c.novo_obj(3, sombra=False, contorno=False)
    c.caixa((x - 0.012, x + 0.012, y - 0.012, y + 0.012, zc + 0.2, ALTO - 0.01), liso('#2a2420'), M, of)
    fades_atras.append((of, ALTO - 0.16, 0.15))
    lampadas.append(((x, y, zc - 0.02), 0.62, 0.55))


# =====================================================================================================================
# a montagem de um quadro
# =====================================================================================================================
def nova_cena():
    global c, pegadas, luzes, vidros, fades, fades_atras, lampadas, itens_peq
    cantos = np.array([[x, y, z] for x in (-0.5, LX + 0.3) for y in (-0.5, LY + 0.3) for z in (-0.35, ALTO + 1.2)])
    S = tela(cantos)
    x0, y0 = int(S[:, 0].min()) - 4, int(S[:, 1].min()) - 4
    c = Cena(x0, y0, int(S[:, 0].max() - x0) + 4, int(S[:, 1].max() - y0) + 4)
    pegadas, luzes, vidros, fades, fades_atras, lampadas, itens_peq = [], set(), [], [], [], [], []
    BE.ligar(globals())


def montar_moveis(t):
    """Cada móvel na casa e no giro do seed (casa x 0,75 m). Ver MOVEIS_SEED no fim do arquivo."""
    # o canto do fundo com a esquerda: o armário em L (0,0) giro 4 (x 0..1,5 no fundo, y 0..2,25 na esquerda)
    armario_l()
    # parede do fundo (y = 0), da esquerda para a direita: fogão (2,0), pia (4,0), armário (6,0)
    fogao(aceso=FOGO_ACESO['v'])
    pia()
    armario(4.5, '+y', enfeite=1)
    # parede da esquerda (x = 0): os caixotes (0,4) e o barril (0,5)
    caixotes(0.05, 3.06)
    barril(0.37, 4.12)
    # a mesa (4,3) giro 0 com as seis cadeiras, a caneca (5,3) e a fruteira
    am = float(os.environ.get('AUMENTO', '1.2'))
    mesa(2.775, 2.1, 2.7, 1.8, 0.94 * am / 1.2)
    s = 0.44 * float(os.environ.get('AUMENTO', '1.2'))
    for (cx, cy, costas) in ((3, 3, '-x'), (3, 4, '-x'), (7, 3, '+x'), (7, 4, '+x'), (5, 2, '-y'), (5, 5, '+y')):
        cadeira((cx + 0.5) * CASA - s / 2, (cy + 0.5) * CASA - s / 2, costas)
    toalhinha(3.25, 5.0, 2.84, 3.16, 0.9405)
    caneca(4.125, 2.625, 0.94)
    fruteira(4.62, 3.0, 0.9405)
    # a planta (9,5) no canto da frente
    espada_sao_jorge(7.12, 4.12)
    # enfeites que não são móveis do seed (o chão livre da metade da direita): o tapete de trança na frente da porta
    # (casas 8..9 x 2..3, longe das cadeiras) e o banquinho com a bacia encostado no fundo, embaixo das panelas
    tapete_tranca(6.86, 2.5, 0.6)
    banquinho(6.88, 0.05)
    # as lâmpadas do teto (4,2) e (8,2)
    lampada(4.5 * CASA, 2.5 * CASA)
    lampada(8.5 * CASA, 2.5 * CASA)
    # na parede: a prateleira (fundo, 8,5), a natureza-morta (fundo, 3,0, em cima do fogão), o relógio (esquerda, 4,5)
    prateleira(8.5 * CASA, 1.78)
    natureza_morta(1.98, 2.56, 1.33, 1.8)
    relogio_esq(4.5 * CASA, 2.11)
    tabua_colheres(2.55, 1.72)
    # a janela com a cortina em cima da pia (por último: fura a parede)
    from janela_cozinha import janela
    janela(c, t)


FOGO_ACESO = {'v': True}
FOGO_T = {'t': 0.0}


def _fogo(cor, t, forca):
    from fogo_cozinha import desenhar_fogo
    g = dict(FORN)
    g.update(esc=0.75, r_tora=0.036, raio_luz=2.0, chama_dx=0.03, chama_y=0.32)
    g.update(luz_y0=0.0, luz_fora=(1.45, 3.05, 0.0, 1.1, 0.03), luz_fora_k=0.5)
    cor = desenhar_fogo(cor, c, t=t, forca=forca, geo=g, fumaca_chamine=0.0)
    from fogo_cozinha import chamas_boca
    return chamas_boca(cor, c, t, forca, BOCAS[0], FURO, FOG['zt'], luz=(0.85, 0.45))


def _viz(a, dy, dx, fill):
    """O vizinho (dy, dx) de cada pixel (fill fora da imagem)."""
    h, w = a.shape[:2]
    out = np.full_like(a, fill)
    ys = slice(max(0, dy), h + min(0, dy))
    yd = slice(max(0, -dy), h + min(0, -dy))
    xs = slice(max(0, dx), w + min(0, dx))
    xd = slice(max(0, -dx), w + min(0, -dx))
    out[yd, xd] = a[ys, xs]
    return out


def acabar_px(cor, obj, nrm, face, prof, tipo, luz_m, sem_contorno, movel=None):
    """
    O acabamento de pixel de cada peça (a cena e o móvel exportado sozinho usam o mesmo): depois da luz das faces.
      - a quina de cima (o topo que encontra a face em pé embaixo dele): 1 px de brilho;
      - a quina em pé da frente (a face da esquerda que encontra a da direita): 1 px de brilho mais leve;
      - as arestas de dentro (duas faces da mesma peça): 1 px um pouco mais escuro, suave;
      - o contorno de 1 px: forte e escuro por fora (contra o fundo, o chão, a parede); contra outra peça, só a
        cor da própria peça escurecida (o contorno seletivo: as peças se separam sem riscar de preto).
    movel: os pixels que contam como peça (padrão: obj >= 0); tipo: 1 chão, 2 parede, 3 móvel.
    """
    if movel is None:
        movel = obj >= 0
    obj_m = np.where(movel, obj, -1)
    prof_m = np.where(movel, prof, -1e9)
    nz, nx, ny = nrm[..., 2], nrm[..., 0], nrm[..., 1]
    topo = nz > 0.6
    livre = movel & ~luz_m & ~sem_contorno
    # o brilho da quina de cima
    emb_obj, emb_nz = _viz(obj_m, 1, 0, -1), _viz(nz, 1, 0, 0.0)
    brilho = topo & livre & (emb_obj == obj_m) & (emb_nz < 0.5) & (tipo != 1)
    cor = np.where(brilho[..., None], np.minimum(255, cor * 1.13 + 9), cor)
    # o brilho da quina em pé da frente (na face da esquerda, o último pixel antes da face da direita)
    dir_obj, dir_n = _viz(obj_m, 0, 1, -1), _viz(nrm, 0, 1, 0.0)
    esq = ~topo & (ny > 0.35) & (ny >= nx)
    vira = (dir_obj == obj_m) & (dir_n[..., 0] > 0.35) & (dir_n[..., 0] > dir_n[..., 1]) & (np.abs(dir_n[..., 2]) < 0.6)
    canto = esq & vira & livre & (tipo == 3) & ~brilho
    cor = np.where(canto[..., None], np.minimum(255, cor * 1.08 + 6), cor)
    # o contorno (forte por fora, seletivo entre peças)
    forte = np.zeros(obj.shape, bool)
    fraco = np.zeros(obj.shape, bool)
    for dy, dx in ((0, 1), (1, 0), (0, -1), (-1, 0)):
        On, Pn, Tn = _viz(obj_m, dy, dx, -1), _viz(prof_m, dy, dx, -1e9), _viz(np.where(movel, tipo, 0), dy, dx, 0)
        atras = movel & (On != obj_m) & ((Pn < prof_m - 0.04) | (On < 0))
        forte |= atras & ((On < 0) | (Tn != 3) | (tipo != 3))
        fraco |= atras & (On >= 0) & (Tn == 3) & (tipo == 3)
    forte &= ~luz_m & ~sem_contorno
    fraco &= ~luz_m & ~sem_contorno & ~forte
    # as arestas de dentro
    quina = np.zeros(obj.shape, bool)
    for dy, dx in ((0, 1), (1, 0)):
        On, Fn, Nn = _viz(obj_m, dy, dx, -1), _viz(face, dy, dx, -1), _viz(nrm, dy, dx, 0.0)
        quina |= movel & (On == obj_m) & (Fn != face) & ((Nn * nrm).sum(-1) < 0.5)
    quina &= (tipo == 3) & ~forte & ~fraco & ~luz_m & ~brilho & ~canto & ~sem_contorno
    cor = np.where(quina[..., None], cor * 0.86 + np.array([2.0, 0.0, 2.0]), cor)
    cor = np.where(fraco[..., None], cor * 0.52 + np.array([10.0, 3.0, 5.0]), cor)
    cor = np.where(forte[..., None], cor * 0.28 + np.array([26.0, 13.0, 11.0]), cor)
    return cor


def acabamento(t, forca, tj=None):
    tj = t if tj is None else tj
    cor = c.cor.copy()
    nrm, obj, tipo, face, prof, P = c.nrm, c.obj, c.tipo, c.face, c.prof, c.mundoP
    h, w = obj.shape
    nz, nx, ny = nrm[..., 2], nrm[..., 0], nrm[..., 1]
    topo = nz > 0.6
    esq = ~topo & (ny >= nx)
    f = np.where(topo, 1.0, np.where(esq, 0.84, 0.66))
    f = np.where(tipo == 2, np.where(topo, 1.04, np.where(esq, 0.97, 0.9)), f)
    quente = np.array([16.0, 4.0, -10.0])
    luz_m = np.isin(obj, list(luzes))
    cor = np.where(luz_m[..., None], cor, cor * f[..., None] + (1 - f[..., None]) * quente)

    def viz(a, dy, dx, fill):
        out = np.full_like(a, fill)
        ys = slice(max(0, dy), h + min(0, dy))
        yd = slice(max(0, -dy), h + min(0, -dy))
        xs = slice(max(0, dx), w + min(0, dx))
        xd = slice(max(0, -dx), w + min(0, -dx))
        out[yd, xd] = a[ys, xs]
        return out

    chao = (tipo == 1) & topo
    # a sombra macia (dois degraus) embaixo dos móveis, um pouco para a frente e a direita
    X, Y, Z = P[..., 0], P[..., 1], P[..., 2]
    # (a distância de cada pixel do chão até a pegada, empurrada um pouco para a frente; em 4 degraus que somem
    # para fora: a sombra macia, sem pontilhado; a sombra puxa para o roxo-quente)
    dmin = np.full((h, w), 9.0)
    for (a0, a1, b0, b1) in pegadas:
        ddx = np.maximum(np.maximum((a0 + 0.02) - X, X - (a1 + 0.08)), 0)
        ddy = np.maximum(np.maximum((b0 + 0.02) - Y, Y - (b1 + 0.1)), 0)
        dmin = np.minimum(dmin, np.hypot(ddx, ddy))
    ks = np.where(dmin <= 0, 0.74, np.where(dmin < 0.045, 0.8, np.where(dmin < 0.1, 0.87, np.where(dmin < 0.17, 0.94, 1.0))))
    ks = np.where(chao, ks, 1.0)
    cor = cor * ks[..., None] + (1 - ks[..., None]) * np.array([14.0, 2.0, 12.0])
    # os cantos
    dp = np.minimum(X, Y)
    cor = np.where((chao & (dp < 0.1))[..., None], cor * 0.86, np.where((chao & (dp < 0.22))[..., None], cor * 0.94, cor))
    parede_m = (tipo == 2) & ~topo
    cor = np.where((parede_m & (Z < 0.3) & (Z > 0.13))[..., None], cor * 0.94, cor)
    # a sombrinha de contato dos objetos pequenos nos tampos
    for (x0, x1, y0, y1, zz) in itens_peq:
        perto = (np.abs(Z - zz) < 0.012) & (tipo == 3) & topo
        dx = np.maximum(np.maximum(x0 - X, X - x1), 0)
        dy = np.maximum(np.maximum(y0 - Y, Y - y1), 0)
        d = np.hypot(dx, dy)
        som = perto & (d > 0.002) & (d < 0.05) & (X > x0 - 0.01) & (Y > y0 - 0.01)
        cor = np.where(som[..., None], cor * 0.8, cor)

    if JANELA['ok']:
        cor = JANELA['luz'](cor, c, tj)
    sem_contorno = np.isin(obj, [o for o, v in c.contornos.items() if not v])
    cor = acabar_px(cor, obj, nrm, face, prof, tipo, luz_m, sem_contorno)

    # o vidro dos armários: o que se vê por trás dele fica um pouco azulado, com os reflexos em diagonal
    if vidros:
        sx = np.arange(w)[None, :] + c.x0
        sy = np.arange(h)[:, None] + c.y0
        # os reflexos: duas riscas em diagonal (2 px e 1 px) a cada 26 px, leves (a louça atrás continua legível)
        reflexo = ((sx + sy) % 26 < 2) | ((sx + sy) % 26 == 4)
        for (a0, a1, b0, b1, z0, z1) in vidros:
            m = (obj >= 0) & (X > a0) & (X < a1) & (Y > b0) & (Y < b1) & (Z > z0) & (Z < z1)
            cor = np.where(m[..., None], cor * 0.92 + np.array([196.0, 222.0, 226.0]) * 0.08, cor)
            cor = np.where((m & reflexo)[..., None], cor * 0.84 + np.array([240.0, 250.0, 250.0]) * 0.16, cor)

    # o fundo; o que passa da viga (a chaminé, os fios) some para ele aos poucos
    fundo = np.array([26.0, 20.0, 28.0]) if NOITE['ok'] else np.array([214.0, 214.0, 210.0])
    cor = np.where((obj >= 0)[..., None], cor, fundo)
    for (oid, zf, alto) in fades:
        m = (obj == oid) & (Z > zf)
        k = np.ceil(np.clip((Z - zf) / alto, 0, 1) * 5) / 5
        cor = np.where(m[..., None], cor * (1 - k[..., None]) + fundo * k[..., None], cor)
    # o fio da lâmpada some em degraus para o que está atrás dele (a cor do vizinho de lado, que não é o fio)
    for (oid, zf, alto) in fades_atras:
        m = (obj == oid)
        if not m.any():
            continue
        atras = cor.copy()
        for dx in (3, -3, 4, -4):
            vz = np.roll(cor, dx, axis=1)
            vo = np.roll(obj, dx, axis=1)
            atras = np.where((m & (vo != oid) & (np.roll(m, dx, axis=1) == False) & (atras == cor).all(-1))[..., None], vz, atras)
        k = np.ceil(np.clip((Z - zf) / alto, 0, 1) * 4) / 4
        cor = np.where((m & (Z > zf))[..., None], cor * (1 - k[..., None]) + atras * k[..., None], cor)
    if NOITE['ok']:
        import noite
        sol = _JC._ULTIMO.get('sol') if JANELA['ok'] else None
        feixe = _JC._ULTIMO.get('feixe') if JANELA['ok'] else None
        cor = noite.iluminar(cor, c, t, lampadas, fogo=((FORN['m'], 0.62, 0.32), forca), sol=sol, feixe=feixe, luzes=luzes,
                            janela=((_JC.YA + _JC.YB) / 2, 0.25, 1.75) if JANELA['ok'] else None)
    if FOGO['ok']:
        cor = FOGO['f'](cor, t, forca)
    for (L0, raio, forca_l) in ([] if NOITE['ok'] else lampadas):
        cor = luz_lampada(cor, L0, raio, forca_l)
    if JANELA['ok']:
        cor = JANELA['poeira'](cor, c, tj)
    return cor


def luz_lampada(cor, L0, tg, forca_l):
    """
    O cone de luz morna da lâmpada: o que está embaixo dela e voltado para cima (o tampo, o chão) clareia numa mancha
    redonda que abre com a distância (tg = a abertura do cone), em 3 degraus; e um halo fraco em volta da cúpula.
    """
    P = c.mundoP
    L0 = np.array(L0)
    dz = L0[2] - P[..., 2]
    rh = np.hypot(P[..., 0] - L0[0], P[..., 1] - L0[1])
    raio = np.maximum(dz, 0.05) * tg + 0.12
    s = np.clip(1 - rh / raio, 0, 1) ** 0.9 * np.clip(1.3 - dz / 3.0, 0, 1) * forca_l
    # em 5 degraus suaves (o primeiro bem fraco: a borda do cone some aos poucos)
    s = np.where((c.obj >= 0) & (c.nz > 0.6) & (dz > 0.3), np.floor(s * 5 + 0.35) / 5, 0)
    cor = cor + (np.array([255.0, 222.0, 160.0]) - cor * 0.3) * s[..., None] * 0.27
    # o halo morno em volta da lâmpada (no que está perto dela: a cúpula por dentro, o fio), em 2 degraus
    d3 = np.linalg.norm(P - L0, axis=-1)
    hal = np.where(d3 < 0.12, 0.3, np.where(d3 < 0.22, 0.14, 0.0)) * forca_l / 0.62
    hal = np.where((c.obj >= 0) & ~np.isin(c.obj, list(luzes)), hal, 0)
    return cor + (np.array([255.0, 232.0, 180.0]) - cor) * hal[..., None]


import janela_cozinha as _JC  # noqa: E402
JANELA = {'ok': True, 'luz': _JC.luz_janela, 'poeira': _JC.poeira_janela}
FOGO = {'ok': True, 'f': lambda cor, t, forca: _fogo(cor, t, forca)}
NOITE = {'ok': os.environ.get('NOITE') == '1'}


def montar(t=0.0, forca=1.0, tj=None):
    """Um quadro: t = o instante do fogo (0..1, loop), tj = o da cortina (padrão: t), forca = o fogo (1 aceso, 0 apagado)."""
    tj = t if tj is None else tj
    FOGO_ACESO['v'] = forca > 0.3
    FOGO_T['t'] = t
    nova_cena()
    sala()
    montar_moveis(tj)
    cor = acabamento(t, forca, tj)
    return Image.fromarray(np.clip(cor, 0, 255).astype(np.uint8))


# o que o seed põe na cozinha (server/src/seedFazenda.ts) e onde ficou aqui: [id, casa x, casa y, giro, estado]
MOVEIS_SEED = (
    ('portal', 9, 3, 6, None, 'a porta para o hall, na parede da frente (x = 10), que não aparece'),
    ('armario_cozinha_l', 0, 0, 4, None, 'armario_l(): 2 x 3 casas, x 0..1,5 no fundo e y 0..2,25 na esquerda (casas [1,1] e [1,2] livres)'),
    ('fogao_lenha', 2, 0, 4, 1, 'fogao(): x 1,5..3,0 no fundo, aceso'),
    ('pia_cozinha', 4, 0, 4, None, 'pia(): x 3,0..4,5 no fundo, com a janela em cima'),
    ('armario_cozinha', 6, 0, 4, None, 'armario(4.5, +y): x 4,5..6,0 no fundo'),
    ('crate_wood', 0, 4, 0, None, 'caixotes(): y 3,0..3,75 na esquerda, 0,8 m'),
    ('barrel', 0, 5, 0, None, 'barril(): y 3,75..4,5 na esquerda, 1 m'),
    ('mesa_cozinha', 4, 3, 0, None, 'mesa(): casas 4..6 x 3..4, arte 2,7 x 1,8 m (aumento 1,2), 0,94 m'),
    ('chair_wood', 3, 3, 2, None, 'encosto em -x'), ('chair_wood', 3, 4, 2, None, 'encosto em -x'),
    ('chair_wood', 7, 3, 6, None, 'encosto em +x'), ('chair_wood', 7, 4, 6, None, 'encosto em +x'),
    ('chair_wood', 5, 2, 4, None, 'encosto em -y'), ('chair_wood', 5, 5, 0, None, 'encosto em +y'),
    ('mug', 5, 3, 0, None, 'a caneca no tampo'),
    ('plant', 9, 5, 0, None, 'a espada-de-são-jorge no canto da frente, 1,2 m'),
    ('ceiling_lamp', 4, 2, 0, None, 'lâmpada pendurada'), ('ceiling_lamp', 8, 2, 0, None, 'lâmpada pendurada'),
    ('shelf_wall', 'r', 8.5, 3.22, None, 'prateleira no fundo, centro x = 6,375'),
    ('quadro_fazenda~02', 'r', 3.0, 2.54, None, 'a natureza-morta em cima do fogão'),
    ('clock', 'l', 4.5, 3.45, None, 'o relógio na esquerda, y = 3,375'),
)


if __name__ == '__main__':
    saida = sys.argv[1] if len(sys.argv) > 1 else os.path.join(AQUI, 'cozinha.png')
    t = float(sys.argv[2]) if len(sys.argv) > 2 else 0.0
    tj = float(sys.argv[3]) if len(sys.argv) > 3 else None
    forca = float(os.environ.get('FOGO_FORCA', '1'))
    img = montar(t, forca, tj)
    img.save(saida.replace('.png', '_1x.png'))
    img.resize((img.width * 3, img.height * 3), Image.NEAREST).save(saida)
    print('ok', img.size)
