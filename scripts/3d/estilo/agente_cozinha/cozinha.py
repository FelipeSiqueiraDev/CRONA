"""
A COZINHA DO CASARÃO (Fazenda · Cozinha) em pixel art feito só por código, no estilo da sala de teste (sala4.py).

A planta é a do jogo (server/src/seedFazenda.ts, cena "cozinha"): 10 x 6 casas de 0,75 m (7,5 x 4,5 m), a porta na
parede da frente à direita (x = 10, que não aparece), piso "ladrilho". Cada móvel fica na casa e no giro do seed, no
tamanho de shared/src/furni.ts (largura e fundo em casas, altura em metros, `aumento` na mesa e nas cadeiras).

Câmera do jogo (2:1): x desce para a direita na tela, y desce para a esquerda, z sobe. ESC 0,75: 1 pixel da arte é
~0,032 m no chão e ~0,026 m na vertical. Só as paredes de trás aparecem: a da esquerda (x = 0) e a do fundo (y = 0).

Uso:
    python3 cozinha.py saida.png            # a imagem parada (3x)
    python3 cozinha.py saida.png 0.25       # o quadro do instante t (0..1) do loop
    FOGO_FORCA=0 python3 cozinha.py x.png   # o fogão apagado (a fumaça sai pela boca da fornalha)
    python3 gif_cozinha.py                  # o GIF do loop (o fogo e a cortina)
"""
import math
import os
import sys

os.environ['ESC'] = os.environ.get('ESC', '0.75')
AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'codigo'))
sys.path.insert(0, AQUI)
import numpy as np                          # noqa: E402
from PIL import Image                       # noqa: E402
from motor import Cena, MUNDO, tela, ruido, emissivo, KX, KY, KZ, VISTA   # noqa: E402
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
fades = []           # objetos que somem para o fundo acima de uma altura (a chaminé, os fios das lâmpadas)
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
    """O ladrilho hidráulico em xadrez suave: a junta de 1 px, a luz na beira de cima e a sombra na de baixo."""
    A = np.stack([hx(x) for x in LAD_A])
    B = np.stack([hx(x) for x in LAD_B])
    jc = hx(LAD_J)

    def f(L, n, P):
        X, Y = P[:, 0], P[:, 1]
        i, j = np.floor(X / TL), np.floor(Y / TL)
        gx, gy = X - i * TL, Y - j * TL
        k = (ruido(i, j, 3.0) * 3).astype(int) % 3
        out = np.where(((i + j) % 2 == 0)[:, None], A[k], B[k])
        # o desenho do ladrilho hidráulico: um losango pequeno no meio, 1 tom abaixo
        dx, dy = np.abs(gx - TL / 2), np.abs(gy - TL / 2)
        los = (dx + dy < TL * 0.2) & (dx + dy >= TL * 0.2 - 1.1 * PH)
        out = np.where(los[:, None], _tom(out, 0.94), out)
        out = np.where(((gx >= PH) & (gx < 2 * PH) | (gy >= PH) & (gy < 2 * PH))[:, None], _tom(out, 1.07), out)
        out = np.where(((gx >= TL - PH) | (gy >= TL - PH))[:, None], _tom(out, 0.9), out)
        return np.where(((gx < PH) | (gy < PH))[:, None], jc, out)
    return emissivo(f)


AZ = '#a7c7c0'          # o azulejo verde-água
AZ_J = '#7e9e98'
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
        # o azulejo
        ia, iz = np.floor(a / TA), np.floor(z / TZ)
        ga, gz = a - ia * TA, z - iz * TZ
        k = ruido(ia, iz, 7.0)
        t = np.where((k > 0.8)[:, None], _tom(az, 1.04), np.where((k < 0.15)[:, None], _tom(az, 0.96), az))
        t = np.where((gz >= TZ - PZ)[:, None], _tom(az, 1.12), t)              # a beira de cima pega luz
        t = np.where(((ga >= PH) & (ga < 2 * PH))[:, None], _tom(t, 1.05), t)   # e a da esquerda
        t = np.where(((gz >= PZ) & (gz < 2 * PZ))[:, None], _tom(t, 0.93), t)   # a de baixo, sombra
        # o brilho do esmalte: uma risquinha diagonal em algumas peças
        sh = (k > 0.55) & (k < 0.7) & (np.abs((ga / PH) - (TZ - gz) / PZ * 0.5 - 3) < 0.6) & (gz > 3 * PZ)
        t = np.where(sh[:, None], _tom(az, 1.2), t)
        t = np.where(((ga < PH) | (gz < PZ))[:, None], azj, t)
        out = np.where((z < ZAZ)[:, None], t, out)
        # o rodapé (a fiada de baixo mais escura)
        out = np.where((z < TZ)[:, None], np.where((gz >= TZ - PZ)[:, None], _tom(hx('#6f938c'), 1.1), np.where((ga < PH)[:, None], azj * 0.8, hx('#6f938c'))), out)
        # a faixa decorada: azul, com os losangos creme a cada 6 px e a linha escura em cima e embaixo
        fx = (z >= ZAZ) & (z < ZFX)
        v = np.floor((z - ZAZ) / PZ)          # 0 embaixo .. 4 em cima
        u = np.floor(a / PH) % 6
        pat = np.where((v == 0) | (v == 4), 0, np.where(v == 2, np.where(u < 3, 2, 1), np.where((u >= 1) & (u <= 1), 2, 1)))
        cor_fx = np.where((pat == 0)[:, None], azul_e, np.where((pat == 2)[:, None], creme, azul))
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
        rr = np.hypot(P[:, 0] - cx, P[:, 2] - cz) / r
        out = np.tile(cm, (len(P), 1))
        out = np.where(((rr > 0.42) & (rr < 0.56))[:, None], _tom(cm, 0.86), out)
        out = np.where((rr > 0.78)[:, None], _tom(cc, 1.1), out)
        return out
    fp([(x, y1, z) for (x, z) in pts], (0, 1, 0), emissivo(ponta), o)
    return o


# =====================================================================================================================
# o fogão a lenha (2 x 1 casas, giro 4: a frente para +y, encostado no fundo; altura 0,85 m; aceso)
# =====================================================================================================================
FOG = dict(x0=1.5, x1=3.0, yb=0.70, zc=0.79, zt=0.85)
FORN = dict(m=2.6, bw=0.2, zp=0.36, bt=0.66, yb=0.70, yf=0.28)      # a boca da fornalha
CHAM = (1.55, 1.89, 0.0, 0.34)                                          # a chaminé (x0, x1, y0, y1)
BOCAS = ((2.62, 0.43), (2.12, 0.45))                                    # as bocas da chapa (a 1ª, em cima do fogo, aberta)
FURO = 0.095                                                            # o buraco da boca aberta


def fogao(aceso=True):
    x0, x1, yb, zc, zt = FOG['x0'], FOG['x1'], FOG['yb'], FOG['zc'], FOG['zt']
    m, bw, zp, bt, yf = FORN['m'], FORN['bw'], FORN['zp'], FORN['bt'], FORN['yf']
    # ---- o corpo de alvenaria: azulejinho creme, a barra vermelha embaixo ----
    nicho = (1.68, 2.2, 0.06, 0.25)                  # o nicho da lenha embaixo do forno
    corpo = c.novo_obj(3)
    AZF = azulejinho()
    face_com_furos('y', yb, x0 + 0.03, x1 - 0.03, 0.1, zc, [(m - bw, m + bw, zp, bt), (nicho[0], nicho[1], 0.1, nicho[3])], AZF, corpo)
    fp([(x1 - 0.03, 0, 0.1), (x1 - 0.03, yb, 0.1), (x1 - 0.03, yb, zc), (x1 - 0.03, 0, zc)], (1, 0, 0), azulejinho(eixo='x'), corpo)
    VERM = _pau('#a8432e', '#c0573c', quina=1.22, b=(0, 0, 0, 0, 0, 0.1))
    face_com_furos('y', yb + 0.012, x0 + 0.02, x1 - 0.02, 0.0, 0.1, [(nicho[0], nicho[1], nicho[2], 0.1)], VERM, corpo)
    fp([(x1 - 0.02, 0, 0), (x1 - 0.02, yb + 0.012, 0), (x1 - 0.02, yb + 0.012, 0.1), (x1 - 0.02, 0, 0.1)], (1, 0, 0), VERM, corpo)
    fp([(x0 + 0.02, yb, 0.1), (x1 - 0.02, yb, 0.1), (x1 - 0.02, yb + 0.012, 0.1), (x0 + 0.02, yb + 0.012, 0.1)], (0, 0, 1), liso('#c0573c'), corpo)
    pegadas.append((x0, x1, 0, yb + 0.02))

    # ---- a chapa de ferro com as bocas (os anéis; a de cima do fogo com a fresta em brasa) ----
    brasa = [hx('#ff9a3a'), hx('#d0481c')]

    def chapa_topo(L, n, P):
        out = np.tile(hx('#423d3a'), (len(P), 1))
        X, Y = P[:, 0], P[:, 1]
        # a borda da chapa (uma moldura 1 tom acima)
        bd = (X < x0 + 0.04) | (X > x1 - 0.04) | (Y > yb + 0.04 - 0.035)
        out = np.where(bd[:, None], hx('#47423e'), out)
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
    dz0, dlen, desp = zp - e, 0.3, 0.022
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
    zc0, zc1 = 0.1, 0.28

    def cinzeiro(L, n, P):
        out = np.tile(hx('#36322f'), (len(P), 1))
        if n[1] > 0.5:
            z = P[:, 2]
            X = P[:, 0]
            for k in range(2):
                zz = zc0 + 0.06 + k * 0.05
                fr = (z > zz) & (z <= zz + PZ) & (np.abs(X - m) < bw - 0.07)
                out = np.where(fr[:, None], hx('#b8481e') if aceso else hx('#141210'), out)
                out = np.where(((z > zz + PZ) & (z <= zz + 2 * PZ) & (np.abs(X - m) < bw - 0.06))[:, None], hx('#4e4844'), out)
            out = np.where((np.abs(X - m) < 0.02)[:, None] & (z > zc1 - 0.045)[:, None] & (z < zc1 - 0.02)[:, None], hx('#c89a3e'), out)
        return out
    o = c.novo_obj(3)
    c.caixa((m - bw + 0.01, m + bw - 0.01, yb, yb + 0.018, zc0, zc1), {'frente': emissivo(cinzeiro), '*': _pau('#2e2a28', '#4a4541', quina=1.3, b=(0, 0, 0, 0, zc0, zc1))}, M, o)

    # ---- o forno: a porta de ferro com a moldura, o puxador e o termômetro ----
    fx0, fx1, fz0, fz1 = 1.62, 2.2, 0.33, 0.68

    def forno(L, n, P):
        out = np.tile(hx('#3a3532'), (len(P), 1))
        if n[1] > 0.5:
            X, z = P[:, 0], P[:, 2]
            dentro_ = (X > fx0 + 0.04) & (X < fx1 - 0.04) & (z > fz0 + 0.04) & (z < fz1 - 0.1)
            out = np.where(dentro_[:, None], hx('#2e2a28'), out)
            out = np.where((dentro_ & ((np.abs(z - (fz1 - 0.1)) < 1.2 * PZ) | (np.abs(X - (fx0 + 0.04)) < PH)))[:, None], hx('#1c1918'), out)
            out = np.where((dentro_ & ((np.abs(z - (fz0 + 0.04)) < 1.2 * PZ) | (np.abs(X - (fx1 - 0.04)) < PH)))[:, None], hx('#565049'), out)
            # o termômetro (o mostrador redondo creme com o ponteiro)
            r = np.hypot((X - (fx0 + fx1) / 2) * 32, (z - (fz1 - 0.055)) * 39.2)
            out = np.where((r < 2.6)[:, None], hx('#e8dcc0'), out)
            out = np.where(((r >= 2.6) & (r < 3.6))[:, None], hx('#b88a3a'), out)
            out = np.where(((r < 2.0) & (np.abs((X - (fx0 + fx1) / 2) * 32 - (z - (fz1 - 0.055)) * 39.2) < 0.6) & (X > (fx0 + fx1) / 2))[:, None], hx('#a8302a'), out)
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
    r = 0.043
    for k, xx in enumerate((nx0 + 0.06, nx0 + 0.155, nx0 + 0.25, nx0 + 0.345, nx0 + 0.44)):
        tora_y(xx, nz0 + r, r, 0.36, yb - 0.02 - 0.012 * (k % 2), casca=('#5a3a22', '#4e3220')[k % 2], miolo=('#c89a62', '#bc8e58')[k % 2])
    for k, xx in enumerate((nx0 + 0.105, nx0 + 0.2, nx0 + 0.295, nx0 + 0.39)):
        tora_y(xx, nz0 + 2.75 * r, r * 0.95, 0.36, yb - 0.03 - 0.015 * (k % 2), casca=('#4e3220', '#5a3a22')[k % 2], miolo=('#c4945c', '#d0a46a')[k % 2])

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
    c.caixa((cx0, cx1, cy0, cy1, zt, zch), {'frente': tijolos('y', org=cx0), 'dir': tijolos('x', org=-cy1), 'cima': liso('#c9c8c2')}, M, oc)
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
# a montagem de um quadro
# =====================================================================================================================
def nova_cena():
    global c, pegadas, luzes, vidros, fades, lampadas, itens_peq
    cantos = np.array([[x, y, z] for x in (-0.5, LX + 0.3) for y in (-0.5, LY + 0.3) for z in (-0.35, ALTO + 1.2)])
    S = tela(cantos)
    x0, y0 = int(S[:, 0].min()) - 4, int(S[:, 1].min()) - 4
    c = Cena(x0, y0, int(S[:, 0].max() - x0) + 4, int(S[:, 1].max() - y0) + 4)
    pegadas, luzes, vidros, fades, lampadas, itens_peq = [], set(), [], [], [], []
    BE.ligar(globals())


def montar_moveis(t):
    fogao(aceso=FOGO_ACESO['v'])


FOGO_ACESO = {'v': True}


def _fogo(cor, t, forca):
    from fogo_cozinha import desenhar_fogo
    g = dict(FORN)
    g.update(esc=0.5, r_tora=0.03, raio_luz=1.7)
    g.update(luz_y0=0.05)
    cor = desenhar_fogo(cor, c, t=t, forca=forca, geo=g, fumaca_chamine=0.0)
    from fogo_cozinha import chamas_boca
    return chamas_boca(cor, c, t, forca, BOCAS[0], FURO, FOG['zt'], luz=(0.85, 0.45))


def acabamento(t, forca):
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
    dentro = np.zeros((h, w), bool)
    volta = np.zeros((h, w), bool)
    for (a0, a1, b0, b1) in pegadas:
        dentro |= chao & (X > a0 + 0.02) & (X < a1 + 0.08) & (Y > b0 + 0.02) & (Y < b1 + 0.1)
        volta |= chao & (X > a0 - 0.05) & (X < a1 + 0.16) & (Y > b0 - 0.05) & (Y < b1 + 0.2)
    cor = np.where(dentro[..., None], cor * 0.74, np.where(volta[..., None], cor * 0.88, cor))
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
        cor = JANELA['luz'](cor, c, t)
    emb_obj, emb_nz = viz(obj, 1, 0, -1), viz(nz, 1, 0, 0.0)
    brilho = topo & (obj >= 0) & (emb_obj == obj) & (emb_nz < 0.5) & ~luz_m & (tipo != 1)
    cor = np.where(brilho[..., None], np.minimum(255, cor * 1.15 + 10), cor)
    borda = np.zeros((h, w), bool)
    for dy, dx in ((0, 1), (1, 0), (0, -1), (-1, 0)):
        On, Pn = viz(obj, dy, dx, -1), viz(prof, dy, dx, -1e9)
        borda |= (obj >= 0) & (On != obj) & ((Pn < prof - 0.04) | (On < 0))
    sem_contorno = np.isin(obj, [o for o, v in c.contornos.items() if not v])
    borda &= ~luz_m & ~sem_contorno
    quina = np.zeros((h, w), bool)
    for dy, dx in ((0, 1), (1, 0)):
        On, Fn, Nn = viz(obj, dy, dx, -1), viz(face, dy, dx, -1), viz(nrm, dy, dx, 0.0)
        quina |= (obj >= 0) & (On == obj) & (Fn != face) & ((Nn * nrm).sum(-1) < 0.5)
    quina &= (tipo == 3) & ~borda & ~luz_m & ~brilho & ~sem_contorno
    cor = np.where(quina[..., None], cor * 0.8, cor)
    cor = np.where(borda[..., None], cor * 0.28 + np.array([26.0, 12.0, 10.0]), cor)

    # o vidro dos armários: o que se vê por trás dele fica um pouco azulado, com os reflexos em diagonal
    if vidros:
        sx = np.arange(w)[None, :] + c.x0
        sy = np.arange(h)[:, None] + c.y0
        reflexo = ((sx + sy) % 17 < 2) | ((sx + sy) % 17 == 4)
        for (a0, a1, b0, b1, z0, z1) in vidros:
            m = (obj >= 0) & (X > a0) & (X < a1) & (Y > b0) & (Y < b1) & (Z > z0) & (Z < z1)
            cor = np.where(m[..., None], cor * 0.86 + np.array([196.0, 222.0, 226.0]) * 0.14, cor)
            cor = np.where((m & reflexo)[..., None], cor * 0.8 + np.array([240.0, 250.0, 250.0]) * 0.2, cor)

    # o fundo; o que passa da viga (a chaminé, os fios) some para ele aos poucos
    fundo = np.array([214.0, 214.0, 210.0])
    cor = np.where((obj >= 0)[..., None], cor, fundo)
    for (oid, zf, alto) in fades:
        m = (obj == oid) & (Z > zf)
        k = np.ceil(np.clip((Z - zf) / alto, 0, 1) * 5) / 5
        cor = np.where(m[..., None], cor * (1 - k[..., None]) + fundo * k[..., None], cor)
    if FOGO['ok']:
        cor = FOGO['f'](cor, t, forca)
    for (L0, raio, forca_l) in lampadas:
        cor = luz_lampada(cor, L0, raio, forca_l)
    if JANELA['ok']:
        cor = JANELA['poeira'](cor, c, t)
    return cor


def luz_lampada(cor, L0, raio, forca_l):
    """A luz morna da lâmpada pendurada: clareia em anéis (em degraus) o que está embaixo dela."""
    P = c.mundoP
    d = np.linalg.norm(P - np.array(L0), axis=-1)
    s = np.clip(1 - d / raio, 0, 1) ** 1.3 * forca_l
    s = np.where(c.obj >= 0, np.floor(s * 4) / 4, 0)
    return cor + (np.array([255.0, 214.0, 150.0]) - cor * 0.3) * s[..., None] * 0.22


JANELA = {'ok': False}
FOGO = {'ok': True, 'f': lambda cor, t, forca: _fogo(cor, t, forca)}


def montar(t=0.0, forca=1.0):
    FOGO_ACESO['v'] = forca > 0.3
    nova_cena()
    sala()
    montar_moveis(t)
    cor = acabamento(t, forca)
    return Image.fromarray(np.clip(cor, 0, 255).astype(np.uint8))


if __name__ == '__main__':
    saida = sys.argv[1] if len(sys.argv) > 1 else os.path.join(AQUI, 'cozinha.png')
    t = float(sys.argv[2]) if len(sys.argv) > 2 else 0.0
    forca = float(os.environ.get('FOGO_FORCA', '1'))
    img = montar(t, forca)
    img.save(saida.replace('.png', '_1x.png'))
    img.resize((img.width * 3, img.height * 3), Image.NEAREST).save(saida)
    print('ok', img.size)
