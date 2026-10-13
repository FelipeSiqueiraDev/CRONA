"""
A ALOSI WALKER em pixel art 1:1, chibi, feita só por código (estudo, fora do jogo).

O boneco é 3D, de partes (cabeça, cabelo em mechas, óculos, tronco, jaqueta aberta com o capuz, camisa de gola
clerical, braços, punhos, calça, cinto, botas e o códex no cinto). As partes são campos de distância (SDF) em
coordenadas do corpo (a = direita dele, b = frente, z = cima, em metros). Cada pixel do tabuleiro lança o raio da
câmera do motor (scripts/3d/codigo/motor.py: a mesma projeção 2:1, `tela`, `VISTA`, KX/KY/KZ) e o que ele acha
vai para os buffers de uma `Cena` do motor (cor, profundidade, normal, objeto, ponto no mundo). Depois o
acabamento de pixel art: a luz pela normal em degraus de uma rampa de 5 tons por material (o tom quente na sombra),
a sombra que uma peça faz na outra, o pixel solto limpo, os detalhes desenhados no pixel (olhos, óculos, sobrancelha,
boca, cruz, corrente, fivela, zíper) projetados do 3D, e o contorno de 1 px (forte por fora, seletivo entre as peças).

Girando o corpo saem as 8 direções do jogo (se = frente virada para a direita, etc., ver docs/ARTE.md).

Uso:
    python3 alosi.py                 # tudo em saida/ (as 8 paradas, respiração, andar, folha, GIF, cozinha)
    python3 alosi.py --rapido        # só a folha das 8 direções (para iterar)
"""
import math
import os
import sys

os.environ['ESC'] = '1'
AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(AQUI, '..', '..', 'codigo'))
import numpy as np                                   # noqa: E402
from PIL import Image                                # noqa: E402
import motor as MT                                   # noqa: E402
from motor import Cena, tela, VISTA, KX, KY, KZ      # noqa: E402

SAIDA = os.path.join(AQUI, 'saida')
PZ = 1 / KZ            # 1 px na vertical (m)
PXT = 1 / (KX * math.sqrt(2))   # 1 px na horizontal da tela (m)

# as 8 direções do jogo: para onde o corpo olha, no chão do mundo (x desce para a direita, y para a esquerda)
DIRS = {'se': (1, 0), 's': (1, 1), 'sw': (0, 1), 'w': (-1, 1), 'nw': (-1, 0), 'n': (-1, -1), 'ne': (0, -1), 'e': (1, -1)}
ORDEM = ['s', 'se', 'e', 'ne', 'n', 'nw', 'w', 'sw']

# a luz do cenário (a de base_estilo: de cima, da esquerda da tela)
LUZ = np.array([-0.3, 0.55, 1.0]) / np.linalg.norm([-0.3, 0.55, 1.0])


def hx(h):
    h = h.lstrip('#')
    return np.array([int(h[i:i + 2], 16) for i in (0, 2, 4)], float)


def rampa(*cs):
    return np.stack([hx(c) for c in cs])


# rampas de 5 tons (fundo, sombra, meio, luz, brilho): a sombra puxa para o vermelho-roxo, a luz para o amarelo
RAMPAS = {
    'pele':    rampa('#8a4a3e', '#c47c60', '#e8aa84', '#f7c9a2', '#fde0c2'),
    'cabelo':  rampa('#1a0d0a', '#2e170e', '#45251a', '#603a24', '#845634'),
    'jaqueta': rampa('#8b7466', '#b5a08c', '#d6c6b0', '#ebe0cc', '#f8f1e2'),
    'forro':   rampa('#6e5a50', '#94806e', '#b4a28c', '#c9b8a0', '#dcccb4'),
    'camisa':  rampa('#7f7a86', '#aaa6b2', '#cdcad2', '#e6e4ea', '#f7f6f8'),
    'calca':   rampa('#140c0e', '#22171a', '#322527', '#433433', '#56453f'),
    'bota':    rampa('#26130c', '#3f2216', '#5c3520', '#7c4c2e', '#a26a44'),
    'sola':    rampa('#120a08', '#1e120c', '#2c1a12', '#3a2418', '#4a2e1e'),
    'cinto':   rampa('#0e0a0a', '#1a1414', '#2a2220', '#3a302c', '#4c403a'),
    'ouro':    rampa('#5a3412', '#8a5a1c', '#b8862e', '#deb352', '#f8de8a'),
    'livro':   rampa('#1e100c', '#33190f', '#4a2818', '#623822', '#7a4a2e'),
    'olho':    rampa('#1a0e0c', '#2a160e', '#4a2a16', '#6a4022', '#8a5a30'),
}

# ---------------------------------------------------------------------------------------------------------------
# campos de distância (em coordenadas do corpo, L: (N, 3))
# ---------------------------------------------------------------------------------------------------------------


def _gira_a(q, ang):
    """Gira em volta do eixo a (o 'pitch': a ponta do pé para cima ou para baixo)."""
    if not ang:
        return q
    c, s = math.cos(ang), math.sin(ang)
    return np.stack([q[:, 0], c * q[:, 1] + s * q[:, 2], -s * q[:, 1] + c * q[:, 2]], 1)


def _gira_z(q, ang):
    if not ang:
        return q
    c, s = math.cos(ang), math.sin(ang)
    return np.stack([c * q[:, 0] + s * q[:, 1], -s * q[:, 0] + c * q[:, 1], q[:, 2]], 1)


def ell(C, R, pitch=0.0, yaw=0.0):
    C, R = np.array(C, float), np.array(R, float)

    def d(L):
        q = _gira_a(_gira_z(L - C, yaw), pitch)
        k0 = np.linalg.norm(q / R, axis=1)
        k1 = np.linalg.norm(q / (R * R), axis=1)
        return k0 * (k0 - 1) / np.maximum(k1, 1e-9)
    return d


def cap(A, B, ra, rb=None):
    A, B = np.array(A, float), np.array(B, float)
    rb = ra if rb is None else rb
    ba = B - A
    bb = ba @ ba

    def d(L):
        pa = L - A
        h = np.clip(pa @ ba / bb, 0, 1)
        return np.linalg.norm(pa - h[:, None] * ba, axis=1) - (ra + (rb - ra) * h)
    return d


def rbox(C, half, r, pitch=0.0, yaw=0.0):
    C, half = np.array(C, float), np.array(half, float)

    def d(L):
        q = np.abs(_gira_a(_gira_z(L - C, yaw), pitch)) - half + r
        return np.linalg.norm(np.maximum(q, 0), axis=1) + np.minimum(q.max(1), 0) - r
    return d


def uniao(*fs):
    def d(L):
        return np.min(np.stack([f(L) for f in fs]), 0)
    return d


def suave(k, *fs):
    def d(L):
        r = fs[0](L)
        for f in fs[1:]:
            b = f(L)
            h = np.clip(0.5 + 0.5 * (b - r) / k, 0, 1)
            r = b + (r - b) * h - k * h * (1 - h)
        return r
    return d


def menos(f, g):
    def d(L):
        return np.maximum(f(L), -g(L))
    return d


def corte_z(f, z0=None, z1=None):
    def d(L):
        r = f(L)
        if z0 is not None:
            r = np.maximum(r, z0 - L[:, 2])
        if z1 is not None:
            r = np.maximum(r, L[:, 2] - z1)
        return r
    return d


# ---------------------------------------------------------------------------------------------------------------
# a pose (as juntas, em coordenadas do corpo)
# ---------------------------------------------------------------------------------------------------------------
QUADRIL_Z = 0.47
COXA, CANELA = 0.19, 0.17
TORNOZELO_Z = 0.11


def pose(andar=None, resp=0.0):
    """
    andar: a fase do ciclo (0..1, começa no contato do pé direito) ou None (parado). resp: a respiração (0..1).
    Devolve as juntas e o quanto o corpo sobe.
    """
    J = {'resp': resp, 'olhos': True, 'incl': 0.0}
    pernas = {}
    if andar is None:
        for lado, s in (('d', 1), ('e', -1)):
            pernas[lado] = dict(coxa=0.0, joelho=0.0, pe=0.0, a=0.095 * s)
        J['braco'] = {'d': (0.0, 0.18), 'e': (0.0, 0.18)}
        J['sobe'] = 0.0
    else:
        p = andar
        A = 0.42                       # o quanto a coxa vai para a frente e para trás (rad)
        for lado, fase in (('d', 0.0), ('e', 0.5)):
            q = (p - fase) % 1.0
            th = A * math.cos(2 * math.pi * q)
            # a perna que passa (indo de trás para a frente) dobra o joelho; a que apoia fica quase reta
            balanco = q > 0.5
            if balanco:
                k = math.sin(math.pi * (q - 0.5) / 0.5)
                joelho = 0.95 * k
                pe = -0.35 * k
            else:
                # no 'baixo' (logo depois do contato) a perna de apoio dobra um pouco
                k = max(0.0, math.sin(math.pi * q / 0.5))
                joelho = 0.18 * k
                pe = 0.0
            pernas[lado] = dict(coxa=th, joelho=joelho, pe=pe, a=0.09 * (1 if lado == 'd' else -1))
            if lado == 'd':
                J['coxa_d'] = th
        # os braços ao contrário das pernas
        bd = -0.5 * math.cos(2 * math.pi * p)
        J['braco'] = {'d': (bd, 0.2 + 0.25 * max(0, bd)), 'e': (-bd, 0.2 + 0.25 * max(0, -bd))}
        J['incl'] = 0.06
    # cada perna: quadril -> joelho -> tornozelo, no plano b-z (a coxa gira para a frente com th > 0)
    pes = {}
    for lado, P in pernas.items():
        H = np.array([P['a'], 0.0, QUADRIL_Z])
        th, kj = P['coxa'], P['joelho']
        K = H + COXA * np.array([0, math.sin(th), -math.cos(th)])
        th2 = th - kj
        A_ = K + CANELA * np.array([0, math.sin(th2), -math.cos(th2)])
        pes[lado] = (H, K, A_, th2 + P['pe'])
    # o corpo desce até o pé mais baixo encostar no chão
    baixo = min(A_[2] for (_, _, A_, _) in pes.values())
    sobe = TORNOZELO_Z - baixo
    if andar is not None:
        sobe -= 0.012 * (0.5 + 0.5 * math.cos(4 * math.pi * (andar - 0.125)))
    J['sobe'] = sobe
    J['pernas'] = {k: tuple(v + np.array([0, 0, sobe]) if isinstance(v, np.ndarray) else v for v in t) for k, t in pes.items()}
    return J


# ---------------------------------------------------------------------------------------------------------------
# as partes
# ---------------------------------------------------------------------------------------------------------------
class Parte:
    def __init__(self, nome, mat, grupo, d, liso=None):
        # liso: um campo mais simples cuja normal entra na luz (o cabelo se ilumina como um volume, não como bolas)
        self.nome, self.mat, self.grupo, self.d, self.liso = nome, mat, grupo, d, liso


INCL_CAB = 0.26     # a cabeça inclinada para trás (a cara olha mais para a câmera de cima: a trapaça do chibi)


def cabeca_centro(J):
    return np.array([0.0, 0.02 + J['incl'] * 0.9, 1.31 + J['sobe'] + J['resp'] * PZ * 1.0])


def _pivo(J):
    return cabeca_centro(J) + np.array([0.0, 0.0, -0.2])


def rot_cab(J):
    """
    A cabeça inclina para trás na direção da câmera (o eixo é o horizontal perpendicular à vista), em qualquer
    giro: a cara olha mais para a câmera de cima, a trapaça do chibi. J['h'] = a câmera no chão, no quadro do corpo.
    """
    hv = np.array([J['h'][0], J['h'][1], 0.0])
    k = np.cross(hv, [0, 0, 1.0])
    k /= np.linalg.norm(k)
    th = INCL_CAB
    K = np.array([[0, -k[2], k[1]], [k[2], 0, -k[0]], [-k[1], k[0], 0]])
    return np.eye(3) + math.sin(th) * K + (1 - math.cos(th)) * K @ K


def cab(J, P):
    """Ponto da cabeça (como se ela estivesse reta) -> o corpo (com a cabeça inclinada)."""
    Pv = _pivo(J)
    return Pv + J['Rcab'] @ (np.asarray(P, float) - Pv)


def de_cab(J, L):
    """Pontos do corpo (N, 3) -> o quadro da cabeça reta."""
    Pv = _pivo(J)
    return Pv + (L - Pv) @ J['Rcab']


def na_cabeca(J, f):
    """O campo f (feito com a cabeça reta) visto no corpo."""
    def d(L):
        return f(de_cab(J, L))
    return d


def montar(J):
    S = J['sobe']
    r = J['resp']
    ch = r * PZ                         # o peito sobe 1 px no máximo
    inc = J['incl']
    partes = []

    def add(nome, mat, grupo, d, liso=None):
        partes.append(Parte(nome, mat, grupo, d, liso))

    # ---- pernas, botas
    for lado, (H, K, A_, ang) in J['pernas'].items():
        s = 1 if lado == 'd' else -1
        add('calca_' + lado, 'calca', 'perna_' + lado,
            suave(0.03, cap(H + [0, 0, 0.02], K, 0.085, 0.08), cap(K, A_ + [0, 0, 0.02], 0.08, 0.084)))
        # a bota: o cano em volta do tornozelo e o pé para a frente, gira com a canela
        Cb = A_ + np.array([0, 0.035 * math.cos(ang), -0.045 + 0.035 * math.sin(ang)])
        add('bota_' + lado, 'bota', 'perna_' + lado,
            suave(0.03, rbox(Cb, (0.078, 0.125, 0.064), 0.05, pitch=-ang),
                  cap(A_ - [0, 0, 0.03], A_ + [0, 0, 0.02], 0.074)))
    # ---- quadril, cinto
    Q0 = np.array([0, 0.0, 0.52 + S])
    add('quadril', 'calca', 'tronco', ell(Q0, (0.175, 0.125, 0.1)))
    add('cinto', 'cinto', 'tronco', corte_z(ell(Q0 + [0, 0, 0.02], (0.18, 0.13, 0.2)), 0.525 + S, 0.57 + S))
    # ---- camisa (o tronco) e a jaqueta aberta
    T0 = np.array([0, 0.0 + inc * 0.4, 0.76 + S + ch * 0.6])
    add('camisa', 'camisa', 'camisa', ell(T0, (0.15, 0.115, 0.25)))
    jaq = ell(T0 + [0, -0.01, 0.0], (0.19 + 0.004 * r, 0.14 + 0.004 * r, 0.255))
    jaq = corte_z(jaq, 0.54 + S)
    # o vão da frente (a jaqueta aberta): mais largo embaixo
    def vao(L):
        z = L[:, 2] - S
        w = 0.03 + 0.025 * np.clip((0.9 - z) / 0.35, 0, 1)
        return np.maximum(np.abs(L[:, 0]) - w, -(L[:, 1] - (T0[1] + 0.06)))
    add('jaqueta', 'jaqueta', 'tronco', menos(jaq, vao))
    # ombros (redondos, a jaqueta fofa)
    for s in (1, -1):
        add('ombro_' + ('d' if s > 0 else 'e'), 'jaqueta', 'tronco',
            ell(T0 + [0.15 * s, -0.01, 0.15], (0.1, 0.105, 0.085)))
    # o capuz: o rolo atrás do pescoço e as abas em volta
    Cz = np.array([0, -0.085 + inc * 0.5, 0.99 + S + ch])
    add('capuz', 'jaqueta', 'capuz', uniao(ell(Cz, (0.15, 0.085, 0.08)),
                                            ell(Cz + [0.1, 0.06, -0.01], (0.065, 0.075, 0.06)),
                                            ell(Cz + [-0.1, 0.06, -0.01], (0.065, 0.075, 0.06))))
    # pescoço e a gola clerical
    Hc = cabeca_centro(J)
    add('pescoco', 'pele', 'pele', cap([0, 0.0 + inc * 0.6, 0.94 + S], [0, 0.01 + inc * 0.8, 1.1 + S], 0.055))
    add('gola', 'camisa', 'camisa', corte_z(ell([0, 0.005 + inc * 0.6, 1.01 + S + ch], (0.072, 0.07, 0.2)), None, 1.045 + S + ch))
    # ---- braços (a manga da jaqueta, o punho canelado, a mão fechada)
    for lado, s in (('d', 1), ('e', -1)):
        bal, cot = J['braco'][lado]
        Ob = T0 + np.array([0.205 * s, -0.01, 0.12])
        # o braço sai um pouco do corpo (o vão entre o braço e o tronco)
        ab = 0.11
        Cv = Ob + 0.2 * np.array([math.sin(ab) * s, math.sin(bal), -math.cos(bal)])
        bal2 = bal + cot
        Pu = Cv + 0.16 * np.array([math.sin(0.04) * s, math.sin(bal2), -math.cos(bal2)])
        Mo = Pu + 0.074 * np.array([0.0, math.sin(bal2), -math.cos(bal2)])
        add('manga_' + lado, 'jaqueta', 'braco_' + lado,
            suave(0.035, cap(Ob, Cv, 0.085, 0.082), cap(Cv, Pu, 0.082, 0.072)))
        J['punho_' + lado] = (Pu, bal2)
        add('punho_' + lado, 'forro', 'braco_' + lado, cap(Pu - 0.03 * (Pu - Cv) / np.linalg.norm(Pu - Cv), Pu + 0.012 * (Pu - Cv) / np.linalg.norm(Pu - Cv), 0.066))
        add('mao_' + lado, 'pele', 'mao_' + lado, ell(Mo, (0.08, 0.082, 0.085), pitch=-bal2))
        J['mao_' + lado] = Mo
    # ---- o códex no cinto (lado direito), pendurado na corrente
    # (andando, ele balança com a coxa, um pouco atrasado)
    cx_ = J.get('coxa_d', 0.0) * 0.55
    Lb = np.array([0.215, 0.07 + 0.09 * math.sin(cx_), 0.38 + S + 0.03 * (1 - math.cos(cx_))])
    J['livro'] = Lb
    add('livro', 'livro', 'livro', rbox(Lb, (0.03, 0.075, 0.09), 0.012, pitch=-cx_, yaw=-0.5))
    # ---- a cabeça (feita reta e inclinada para trás em volta do pescoço)
    cabeca = suave(0.06, ell(Hc, (0.25, 0.23, 0.235)), ell(Hc + [0, 0.035, -0.11], (0.19, 0.17, 0.14)))
    add('cabeca', 'pele', 'pele', na_cabeca(J, cabeca))
    add('nariz', 'pele', 'pele', na_cabeca(J, ell(Hc + [0, 0.22, -0.07], (0.022, 0.03, 0.026))))
    add('orelha', 'pele', 'pele', na_cabeca(J, uniao(*[ell(Hc + [0.236 * s, -0.01, -0.06], (0.035, 0.05, 0.06)) for s in (1, -1)])))
    # ---- o cabelo: a calota, as mechas de cima e as da frente
    add('cabelo', 'cabelo', 'cabelo', na_cabeca(J, cabelo(Hc)),
        liso=na_cabeca(J, ell(Hc + [0, -0.03, 0.06], (0.3, 0.29, 0.27))))
    return partes


# as mechas grandes em volta da calota: (lon, lat, raio, quanto sai), lon 0 = a frente, lat 90 = o alto
MECHAS = [
    # o alto (a coroa, onde o cabelo fofo sobe)
    (0, 80, 0.1, 0.9), (120, 72, 0.1, 0.9), (-120, 72, 0.1, 0.9),
    (35, 55, 0.095, 0.92), (-35, 55, 0.095, 0.92), (95, 50, 0.1, 0.92), (-95, 50, 0.1, 0.92),
    (150, 45, 0.1, 0.92), (-150, 45, 0.1, 0.92), (180, 55, 0.095, 0.92),
    # o meio, dos lados e atrás (as ondas)
    (95, 25, 0.09, 0.9), (-95, 25, 0.09, 0.9), (122, 18, 0.1, 0.93), (-122, 18, 0.1, 0.93),
    (145, 15, 0.1, 0.93), (-145, 15, 0.1, 0.93), (180, 18, 0.1, 0.93),
    # embaixo: em cima das orelhas e a nuca
    (100, -12, 0.075, 0.88), (-100, -12, 0.075, 0.88), (130, -15, 0.09, 0.9), (-130, -15, 0.09, 0.9),
    (160, -20, 0.09, 0.88), (-160, -20, 0.09, 0.88),
    # a nuca (o cabelo desce até o pescoço atrás)
    (180, -42, 0.09, 0.86), (145, -40, 0.085, 0.86), (-145, -40, 0.085, 0.86), (115, -32, 0.075, 0.86), (-115, -32, 0.075, 0.86),
]


def cabelo(Hc, cachos=None):
    """O campo do cabelo. cachos: se for uma lista, recebe os campos de cada cacho (para achar as divisas)."""
    Ccap = Hc + np.array([0, -0.03, 0.06])
    R = np.array([0.27, 0.262, 0.235])
    fs = [ell(Ccap, R), ell(Hc + [0, -0.11, -0.07], (0.215, 0.15, 0.17))]
    for lon, lat, rr, k in MECHAS:
        lo, la = math.radians(lon), math.radians(lat)
        dirv = np.array([math.sin(lo) * math.cos(la), math.cos(lo) * math.cos(la), math.sin(la)])
        fs.append(ell(Ccap + dirv * R * k, (rr, rr, rr * 0.82)))
    # a franja: duas mechas largas caindo da esquerda (dele) para a direita na testa, e as pontas nas têmporas
    fs.append(ell(Hc + [-0.05, 0.19, 0.15], (0.14, 0.075, 0.07), yaw=0.3))
    fs.append(ell(Hc + [0.1, 0.19, 0.13], (0.11, 0.07, 0.065), yaw=-0.25))
    fs.append(ell(Hc + [0.215, 0.0, 0.03], (0.05, 0.07, 0.1)))
    fs.append(ell(Hc + [-0.22, 0.0, 0.04], (0.05, 0.07, 0.1)))
    if cachos is not None:
        cachos.extend(fs)
    tudo = uniao(*fs)
    # a janela da cara (o que o cabelo não cobre)
    cara = ell(Hc + [0, 0.19, -0.085], (0.25, 0.25, 0.205))
    return menos(tudo, cara)


# ---------------------------------------------------------------------------------------------------------------
# o raio de cada pixel
# ---------------------------------------------------------------------------------------------------------------
V_RAIO = np.array([1.0, 1.0, 2 * KY / KZ])


class Quadro:
    """Um quadro desenhado: os buffers da Cena do motor e o que o acabamento precisa."""


def render(direcao, J, T=(0.0, 0.0), caixa=None, sombra_chao=True):
    """
    Desenha o boneco virado para `direcao`, com os pés no ponto T (metros no mundo). caixa: (x0, y0, w, h) da tela
    (px da projeção); padrão: um quadro de 76 x 118 com os pés no pixel (38, 106).
    """
    f2 = np.array(DIRS[direcao], float)
    f2 /= np.linalg.norm(f2)
    fw = np.array([f2[0], f2[1], 0.0])
    rw = np.array([-f2[1], f2[0], 0.0])
    Mw = np.stack([rw, fw, [0, 0, 1.0]], 1)       # local -> mundo: Mw @ l
    T3 = np.array([T[0], T[1], 0.0])
    if caixa is None:
        sx0, sy0 = tela(T3)
        caixa = (int(round(sx0)) - 38, int(round(sy0)) - 106, 76, 118)
    x0, y0, w, h = caixa
    c = Cena(x0, y0, w, h)
    Vl0 = VISTA @ Mw
    J['h'] = np.array([Vl0[0], Vl0[1]]) / math.hypot(Vl0[0], Vl0[1])
    J['Rcab'] = rot_cab(J)
    partes = montar(J)
    oids = []
    for p in partes:
        oids.append(c.novo_obj(3))
    ys, xs = np.mgrid[0:h, 0:w]
    sx = xs.ravel() + 0.5 + x0
    sy = ys.ravel() + 0.5 + y0
    B = np.stack([(sx / KX + sy / KY) / 2, (sy / KY - sx / KX) / 2, np.zeros_like(sx)], 1)
    Bl = (B - T3) @ Mw
    Vl = V_RAIO @ Mw
    nV = np.linalg.norm(V_RAIO)

    def campo(L):
        ds = np.stack([p.d(L) for p in partes])
        return ds.min(0), ds.argmin(0)

    n = len(sx)
    t = np.full(n, 2.7)
    ativo = np.ones(n, bool)
    acerto = np.full(n, -1)
    for _ in range(140):
        idx = np.nonzero(ativo)[0]
        if not len(idx):
            break
        L = Bl[idx] + t[idx, None] * Vl
        d, k = campo(L)
        ok = d < 0.0015
        acerto[idx[ok]] = k[ok]
        ativo[idx[ok]] = False
        t[idx[~ok]] -= np.maximum(d[~ok], 0.0015) * 0.9 / nV
        fim = (t < -0.4)
        ativo &= ~fim
    hit = acerto >= 0
    L = Bl + t[:, None] * Vl
    # a normal de cada pixel: o gradiente da própria parte (cada peça se ilumina como um volume só)
    N = np.zeros((n, 3))
    e = 0.004
    for i, p in enumerate(partes):
        m = hit & (acerto == i)
        if not m.any():
            continue
        Lm = L[m]
        g = np.stack([p.d(Lm + dv) - p.d(Lm - dv) for dv in (np.array([e, 0, 0]), np.array([0, e, 0]), np.array([0, 0, e]))], 1)
        g = g / np.maximum(np.linalg.norm(g, axis=1, keepdims=True), 1e-9)
        if p.liso is not None:
            g2 = np.stack([p.liso(Lm + dv) - p.liso(Lm - dv) for dv in (np.array([e, 0, 0]), np.array([0, e, 0]), np.array([0, 0, e]))], 1)
            g2 = g2 / np.maximum(np.linalg.norm(g2, axis=1, keepdims=True), 1e-9)
            g = g * 0.45 + g2 * 0.55
            g = g / np.maximum(np.linalg.norm(g, axis=1, keepdims=True), 1e-9)
        N[m] = g
    Pw = L @ Mw.T + T3
    Nw = N @ Mw.T
    prof = Pw @ VISTA
    # para os buffers da Cena do motor
    hh = hit.reshape(h, w)
    c.obj[hh] = np.array(oids)[acerto[hit]]
    c.prof[hh] = prof[hit]
    c.nrm[hh] = Nw[hit]
    c.mundoP[hh] = Pw[hit]
    c.tipo[hh] = 3
    c.nz[hh] = Nw[hit, 2]
    q = Quadro()
    q.c, q.partes, q.J, q.Mw, q.T3, q.caixa = c, partes, J, Mw, T3, caixa
    q.L = L.reshape(h, w, 3)
    q.Nl = N.reshape(h, w, 3)
    q.parte = np.where(hit, acerto, -1).reshape(h, w)
    q.campo = campo
    q.direcao = direcao
    return acabar(q, sombra_chao)


# ---------------------------------------------------------------------------------------------------------------
# o acabamento de pixel art
# ---------------------------------------------------------------------------------------------------------------
def _viz(a, dy, dx, fill):
    h, w = a.shape[:2]
    out = np.full_like(a, fill)
    ys = slice(max(0, dy), h + min(0, dy))
    yd = slice(max(0, -dy), h + min(0, -dy))
    xs = slice(max(0, dx), w + min(0, dx))
    xd = slice(max(0, -dx), w + min(0, -dx))
    out[yd, xd] = a[ys, xs]
    return out


def acabar(q, sombra_chao):
    c = q.c
    h, w = c.obj.shape
    parte = q.parte
    hit = parte >= 0
    partes = q.partes
    mats = np.array([p.mat for p in partes] + ['-'])
    grupos = np.array([p.grupo for p in partes] + ['-'])
    nomes = np.array([p.nome for p in partes] + ['-'])
    mat = np.where(hit, mats[parte], '-')
    grupo = np.where(hit, grupos[parte], '-')
    nome = np.where(hit, nomes[parte], '-')
    Nw = c.nrm
    L = q.L
    S = q.J['sobe']
    # a luz pela normal
    s = Nw @ LUZ
    nivel = np.where(s < -0.25, 1, np.where(s < 0.12, 1, np.where(s < 0.5, 2, 3)))
    nivel = np.where(s < -0.55, 0, nivel)
    # a sombra que uma peça faz na outra (o raio até a luz bate em outra coisa) e o fundo dos vãos
    Ll = LUZ @ q.Mw
    ids = np.nonzero(hit.ravel() & (s.ravel() > 0.0))[0]
    if len(ids):
        P0 = L.reshape(-1, 3)[ids] + q.Nl.reshape(-1, 3)[ids] * 0.02
        tt = np.full(len(ids), 0.0)
        som = np.zeros(len(ids), bool)
        for _ in range(28):
            d, _k = q.campo(P0 + tt[:, None] * Ll)
            som |= d < 0.004
            tt += np.maximum(d, 0.01)
            if (tt > 0.7).all():
                break
        sh = np.zeros(h * w, bool)
        sh[ids] = som
        sh = sh.reshape(h, w)
        nivel = np.where(sh, np.minimum(nivel, 1), nivel)
    # o canto apertado (outra peça logo na frente da normal): um tom abaixo
    P1 = (L + q.Nl * 0.035).reshape(-1, 3)
    ds = np.stack([p.d(P1) for p in partes])
    pr = parte.ravel()
    ds[pr[pr >= 0], np.nonzero(pr >= 0)[0]] = 9.0
    gp = np.array([p.grupo for p in partes])
    # peças do mesmo grupo (a cabeça e o nariz, a calça e a bota) não fazem canto
    for i in range(len(partes)):
        m = (pr >= 0) & (gp[np.maximum(pr, 0)] == gp[i])
        ds[i, m] = 9.0
    apertado = (ds.min(0).reshape(h, w) < 0.018) & hit
    nivel = np.where(apertado, nivel - 1, nivel)
    # o brilho (a quina de cima que pega mais luz) em quem brilha: cabelo, bota, ouro, a jaqueta clara
    forte = s > 0.8
    nivel = np.where(forte & np.isin(mat, ['bota', 'jaqueta', 'ouro', 'pele', 'camisa']), 4, nivel)
    # ---- os detalhes que vêm do lugar no corpo (cinto, sola, barra canelada)
    z = L[..., 2] - S
    mat = np.where((mat == 'bota') & (z < 0.022 + np.maximum(0, L[..., 2] - S) * 0), 'sola', mat)
    mat = np.where((nome == 'jaqueta') & (z < 0.645), 'forro', mat)
    # o cabelo: mechas (riscas mais escuras que seguem a volta da cabeça)
    Hc = cabeca_centro(q.J)
    rel = L - Hc
    lon = np.arctan2(rel[..., 0], rel[..., 1])
    lat = rel[..., 2]
    capelo = mat == 'cabelo'
    if capelo.any():
        cachos = []
        cabelo(Hc, cachos)
        Lh = de_cab(q.J, L[capelo])
        dc = np.stack([f(Lh) for f in cachos])
        cid = np.full((h, w), -1)
        cid[capelo] = dc.argmin(0)
        # a divisa entre dois cachos (o de baixo dela fica escuro: a sombra que o cacho de cima faz)
        div = np.zeros((h, w), bool)
        for dy, dx in ((-1, 0), (0, 1), (0, -1), (1, 0)):
            cn = _viz(cid, dy, dx, -1)
            pn = _viz(c.prof, dy, dx, -1e9)
            # o pixel que fica atrás do cacho vizinho (ou logo embaixo dele) escurece
            div |= capelo & (cn >= 0) & (cn != cid) & ((pn > c.prof + 0.004) | ((dy == -1) & (pn > c.prof - 0.002)))
        nivel = np.where(div, np.maximum(np.minimum(nivel - 1, 2), 1), nivel)
        # o brilho: o alto de cada cacho que vira para a luz (a normal do próprio cacho)
        e_ = 0.004
        k = np.argmin(dc, 0)
        g = np.zeros((len(Lh), 3))
        for i in np.unique(k):
            m = k == i
            for j in range(3):
                dv = np.zeros(3); dv[j] = e_
                g[m, j] = cachos[i](Lh[m] + dv) - cachos[i](Lh[m] - dv)
        g /= np.maximum(np.linalg.norm(g, axis=1, keepdims=True), 1e-9)
        gw = (g @ q.J['Rcab'].T) @ q.Mw.T
        sl = gw @ LUZ
        nh = nivel[capelo]
        nh = np.where((sl > 0.74) & (nh >= 2), nh + 1, nh)
        nh = np.where((sl < 0.1) & (nh >= 2), nh - 1, nh)
        nivel[capelo] = np.minimum(nh, 4)
    nivel = np.clip(nivel, 0, 4)
    # ---- o pixel solto: quem não tem vizinho igual (no mesmo material) vira a maioria dos vizinhos
    for _ in range(2):
        nv = nivel.copy()
        iguais = np.zeros((h, w), int)
        viz = []
        for dy, dx in ((0, 1), (1, 0), (0, -1), (-1, 0)):
            vn = _viz(nivel, dy, dx, -9)
            vm = _viz(mat, dy, dx, '-')
            viz.append((vn, vm))
            iguais += (vn == nivel) & (vm == mat)
        solto = hit & (iguais == 0)
        # a moda dos vizinhos do mesmo material
        cont = np.zeros((h, w, 5), int)
        for vn, vm in viz:
            for k in range(5):
                cont[..., k] += (vn == k) & (vm == mat)
        moda = cont.argmax(-1)
        temviz = cont.max(-1) > 0
        nv = np.where(solto & temviz, moda, nivel)
        nivel = nv
    # ---- a cor
    cor = np.zeros((h, w, 3))
    for m_, R in RAMPAS.items():
        mm = mat == m_
        if mm.any():
            cor[mm] = R[np.clip(nivel[mm], 0, len(R) - 1)]
    q.mat, q.nivel, q.grupo, q.nome = mat, nivel, grupo, nome
    # ---- o zíper: a jaqueta que encosta na camisa (de lado) vira a linha de ouro
    jaq = (mat == 'jaqueta') | (mat == 'forro')
    cam = (mat == 'camisa') | (mat == 'cinto')
    ziper = np.zeros((h, w), bool)
    for dx in (1, -1):
        ziper |= jaq & _viz(cam, 0, dx, False) & ~(_viz(nome, 0, dx, '-') == 'gola')
    ziper &= (z > 0.62) & (z < 1.02)
    cor = np.where(ziper[..., None], RAMPAS['ouro'][np.clip(nivel + 1, 1, 4)], cor)
    # ---- o contorno (forte por fora, seletivo entre as peças: a cor da própria peça escurecida)
    prof = c.prof
    gr = np.where(hit, grupo, '-')
    forte = np.zeros((h, w), bool)
    fraco = np.zeros((h, w), bool)
    for dy, dx in ((0, 1), (1, 0), (0, -1), (-1, 0)):
        Gn = _viz(gr, dy, dx, '-')
        Pn = _viz(prof, dy, dx, -1e9)
        forte |= hit & (Gn == '-')
        fraco |= hit & (Gn != '-') & (Gn != gr) & (Pn < prof - 0.03)
    fraco &= ~forte
    cor = np.where(fraco[..., None], cor * 0.62 + np.array([6.0, 1.0, 4.0]), cor)
    cor = np.where(forte[..., None], cor * 0.3 + np.array([24.0, 12.0, 12.0]), cor)
    alfa = hit.astype(float)
    q.cor, q.alfa, q.forte = cor, alfa, forte
    detalhes(q)
    if sombra_chao:
        sombra(q)
    return q


# ---------------------------------------------------------------------------------------------------------------
# os detalhes desenhados no pixel (projetados do 3D: andam com a cabeça e o corpo em todas as direções)
# ---------------------------------------------------------------------------------------------------------------
def _px(q, Pl):
    """Ponto do corpo (local) -> (coluna, linha) no quadro e a profundidade."""
    Pw = q.Mw @ np.asarray(Pl, float) + q.T3
    sx, sy = tela(Pw)
    return sx - q.caixa[0], sy - q.caixa[1], Pw @ VISTA


def _visivel(q, Pl, folga=0.03):
    x, y, d = _px(q, Pl)
    i, j = int(math.floor(y)), int(math.floor(x))
    h, w = q.c.obj.shape
    if not (0 <= i < h and 0 <= j < w):
        return False
    return q.alfa[i, j] == 0 or d >= q.c.prof[i, j] - folga


def _ponto(q, x, y, cor, d=None, forca=True):
    i, j = int(math.floor(y)), int(math.floor(x))
    h, w = q.c.obj.shape
    if 0 <= i < h and 0 <= j < w:
        if d is not None and q.alfa[i, j] > 0 and d < q.c.prof[i, j] - 0.03:
            return
        q.cor[i, j] = cor
        if q.alfa[i, j] == 0:
            q.alfa[i, j] = 1
            q.c.prof[i, j] = d if d is not None else q.c.prof[i, j]


def _linha3d(q, A, B, cor, folga=0.03, passos=None, fora=True):
    """Uma linha de 1 px entre dois pontos do corpo, com o teste de profundidade em cada pixel."""
    xa, ya, da = _px(q, A)
    xb, yb, db = _px(q, B)
    n = passos or int(max(abs(xb - xa), abs(yb - ya)) * 2) + 2
    feitos = set()
    for k in range(n + 1):
        u = k / n
        P = np.asarray(A) * (1 - u) + np.asarray(B) * u
        x, y, d = _px(q, P)
        key = (int(math.floor(x)), int(math.floor(y)))
        if key in feitos:
            continue
        feitos.add(key)
        _ponto_d(q, x, y, cor, d, folga, fora)


def _ponto_d(q, x, y, cor, d, folga, fora=True):
    i, j = int(math.floor(y)), int(math.floor(x))
    h, w = q.c.obj.shape
    if 0 <= i < h and 0 <= j < w:
        if fora is False and q.alfa[i, j] == 0:
            return
        if fora == 'junto' and q.alfa[i, j] == 0:
            # só encostado na figura (o óculos sai 1 px da cara de perfil)
            viz = q.alfa[max(0, i - 1):i + 2, max(0, j - 1):j + 2]
            if viz.sum() < 3:
                return
        if q.alfa[i, j] > 0 and d < q.c.prof[i, j] - folga:
            return
        q.cor[i, j] = cor
        if q.alfa[i, j] == 0:
            q.alfa[i, j] = 1
            q.c.prof[i, j] = d


def _vista_cab(q):
    """O sentido da câmera no quadro da cabeça reta (o corpo e a inclinação desfeitos)."""
    return q.J['Rcab'].T @ (VISTA @ q.Mw)


def detalhes(q):
    J = q.J
    Hc = cabeca_centro(J)
    Vl = VISTA @ q.Mw
    Vc = _vista_cab(q)
    S = J['sobe']
    ouro = RAMPAS['ouro']
    aro = np.array([52.0, 26.0, 18.0])
    # os traços do rosto giram um pouco em volta da cabeça na direção da câmera (a trapaça do desenho: de lado
    # o olho não cai na beirada)
    az = math.atan2(Vc[0], Vc[1])
    g = float(np.clip(az * 0.32, -0.45, 0.45)) if abs(az) < math.radians(110) else 0.0
    cg, sg = math.cos(g), math.sin(g)

    def C(P):
        r = np.asarray(P, float) - Hc
        r = np.array([cg * r[0] + sg * r[1], -sg * r[0] + cg * r[1], r[2]])
        return cab(J, Hc + r)
    # ---- a corrente e a cruz no peito (por cima da camisa)
    cruz = np.array([0.0, 0.122, 0.8 + S])
    if _visivel(q, cruz, 0.02) and Vl[1] > 0.1:
        for s in (1, -1):
            _linha3d(q, [0.045 * s, 0.08, 0.985 + S], cruz + [0.004 * s, 0, 0.06], ouro[1], 0.02)
        x, y, d = _px(q, cruz)
        cx, cy = int(math.floor(x)), int(math.floor(y))
        for (dx, dy) in ((0, -3), (-1, -2), (1, -2), (0, -1), (0, 0), (0, 1)):
            _ponto(q, cx + dx + 0.5, cy + dy + 0.5, np.array([60.0, 34.0, 14.0]))
        for (dx, dy, k) in ((0, -2, 4), (-1, -2, 3), (1, -2, 2), (0, -1, 3), (0, 0, 2)):
            _ponto(q, cx + dx + 0.5, cy + dy + 0.5, ouro[k])
    # ---- a fivela do cinto
    fiv = np.array([0.0, 0.135, 0.545 + S])
    if _visivel(q, fiv, 0.02) and Vl[1] > 0.0:
        x, y, d = _px(q, fiv)
        cx, cy = int(math.floor(x)), int(math.floor(y))
        for dx in (-1, 0, 1):
            _ponto(q, cx + dx + 0.5, cy + 0.5, ouro[3] if dx < 1 else ouro[2])
    # ---- a corrente do cinto até o códex e o sol na capa
    Lb = J['livro']
    _linha3d(q, [0.165, 0.09, 0.54 + S], Lb + [0.0, 0.0, 0.09], ouro[3], 0.03)
    sol = Lb + np.array([0.035, 0.03, 0.005])
    if _visivel(q, sol, 0.03):
        x, y, d = _px(q, sol)
        _ponto(q, x, y, ouro[3])
    # ---- o rosto (no quadro da cabeça reta; cada ponto vai para o corpo por C)
    nV = np.linalg.norm(Vc)
    olhos_ab = J.get('olhos', True)
    olhar = (sg * Vc[0] + cg * Vc[1]) / nV
    for s in (1, -1):
        ex, ez = 0.095, -0.055
        Pe = Hc + np.array([ex * s, 0.23 * math.sqrt(max(0.0, 1 - (ex / 0.25) ** 2 - (ez / 0.235) ** 2)) + 0.003, ez])
        n_olho = np.array([ex * s / 0.25 ** 2, (Pe[1] - Hc[1]) / 0.23 ** 2, ez / 0.235 ** 2])
        n_olho /= np.linalg.norm(n_olho)
        n_g = np.array([cg * n_olho[0] + sg * n_olho[1], -sg * n_olho[0] + cg * n_olho[1], n_olho[2]])
        vis = n_g @ Vc / nV
        if vis < 0.1:
            continue
        lado = abs(n_g[0] * Vc[1] - n_g[1] * Vc[0]) / max(1e-6, math.hypot(Vc[0], Vc[1]))
        Cl = Pe + np.array([0.006 * s, 0.03, 0.0])
        rl = 0.06
        # a lente: o vidro clareia um tom (e o reflexo no canto de cima)
        x, y, d = _px(q, C(Pe))
        cx, cy = int(math.floor(x)), int(math.floor(y))
        if olhos_ab:
            larg = 2 if lado < 0.5 else 1
            for dy in (-1, 0, 1):
                for dx in range(larg):
                    _ponto(q, cx + dx - (larg // 2) + 0.5, cy + dy + 0.5, RAMPAS['olho'][0 if dy == 1 else (1 if dx == 0 else 2)])
            _ponto(q, cx - (larg // 2) + 0.5, cy - 1 + 0.5, np.array([248.0, 242.0, 228.0]))
        else:
            for dx in (-1, 0, 1):
                _ponto(q, cx + dx + 0.5, cy + 0.5, RAMPAS['olho'][1])
        feitos = set()
        for a in np.linspace(0, 2 * math.pi, 48):
            P = C(Cl + rl * np.array([math.cos(a), 0.0, math.sin(a) * 0.92]))
            x2, y2, d2 = _px(q, P)
            k = (int(math.floor(x2)), int(math.floor(y2)))
            if k in feitos:
                continue
            feitos.add(k)
            _ponto_d(q, x2, y2, aro, d2, 0.05, fora='junto' if vis > 0.3 else False)
        # a perna dos óculos até a orelha
        _linha3d(q, C(Cl + [rl * s, 0, 0.01]), C(Hc + [0.24 * s, 0.0, -0.035]), aro, 0.02, fora=False)
        # a sobrancelha (grossa, descendo para o meio: o jeito sério dele)
        _linha3d(q, C(Pe + [0.06 * s, 0.0, 0.095]), C(Pe + [-0.015 * s, 0.012, 0.08]), np.array([44.0, 22.0, 14.0]), 0.04)
        # a bochecha corada embaixo da lente
        if olhos_ab is not None and vis > 0.5:
            P = C(Pe + np.array([0.03 * s, -0.012, -0.085]))
            if _visivel(q, P, 0.03):
                x, y, d = _px(q, P)
                _ponto(q, x, y, np.array([236.0, 150.0, 126.0]))
    # a ponte dos óculos e a boca
    if olhar > 0.25:
        _linha3d(q, C(Hc + [-0.04, 0.25, -0.05]), C(Hc + [0.04, 0.25, -0.05]), aro, 0.03)
        b0 = C(Hc + np.array([0.0, 0.205, -0.15]))
        if _visivel(q, b0, 0.04):
            x, y, d = _px(q, b0)
            cx, cy = int(math.floor(x)), int(math.floor(y))
            for dx in ((-1, 0) if olhar > 0.6 else (0,)):
                _ponto(q, cx + dx + 0.5, cy + 0.5, np.array([156.0, 80.0, 66.0]))


def sombra(q):
    """A sombra de contato no chão: a elipse escura semitransparente embaixo dos pés (dois tons)."""
    h, w = q.c.obj.shape
    ys, xs = np.mgrid[0:h, 0:w]
    sx = xs + 0.5 + q.caixa[0]
    sy = ys + 0.5 + q.caixa[1]
    X = (sx / KX + sy / KY) / 2 - q.T3[0]
    Y = (sy / KY - sx / KX) / 2 - q.T3[1]
    r = np.hypot(X, Y)
    a = np.where(r < 0.2, 0.42, np.where(r < 0.27, 0.24, 0.0))
    q.sombra_a = a


def rgba(q, fundo=None):
    h, w = q.alfa.shape
    out = np.zeros((h, w, 4))
    a_s = getattr(q, 'sombra_a', np.zeros((h, w)))
    sc = np.array([34.0, 22.0, 30.0])
    out[..., :3] = sc
    out[..., 3] = a_s * 255
    m = q.alfa > 0
    out[m, :3] = q.cor[m]
    out[m, 3] = 255
    return Image.fromarray(np.clip(out, 0, 255).astype(np.uint8), 'RGBA')


# ---------------------------------------------------------------------------------------------------------------
def folha(imgs, fundo=(96, 92, 104), esc=4, cols=8):
    w, h = imgs[0].size
    rows = (len(imgs) + cols - 1) // cols
    out = Image.new('RGBA', (w * cols, h * rows), fundo + (255,))
    for k, im in enumerate(imgs):
        out.alpha_composite(im, ((k % cols) * w, (k // cols) * h))
    return out.resize((out.width * esc, out.height * esc), Image.NEAREST)


RESP = [0.0, 0.5, 1.0, 0.5]          # a respiração: 4 quadros (o peito e a cabeça sobem até 1 px)
COM_CARA = ('s', 'se', 'sw', 'e', 'w')   # as direções que mostram os olhos (ganham a linha do piscar)


def _quadro(args):
    d, kind, k = args
    if kind == 'parado':
        J = pose(resp=RESP[k % 4])
        if k >= 4:
            J['olhos'] = False
    else:
        J = pose(andar=k / 8)
    q = render(d, J)
    return np.array(rgba(q))


def tudo():
    from multiprocessing import Pool
    os.makedirs(SAIDA, exist_ok=True)
    pasta = os.path.join(SAIDA, 'tabuleiro-32bits')
    os.makedirs(pasta, exist_ok=True)
    tarefas = []
    for d in ORDEM:
        tarefas += [(d, 'parado', k) for k in range(8 if d in COM_CARA else 4)]
        tarefas += [(d, 'andar', k) for k in range(8)]
    with Pool(min(8, os.cpu_count() or 2)) as pool:
        res = pool.map(_quadro, tarefas)
    Q = {t: Image.fromarray(r, 'RGBA') for t, r in zip(tarefas, res)}
    w, h = Q[('s', 'parado', 0)].size
    for d in ORDEM:
        Q[(d, 'parado', 0)].save(os.path.join(pasta, f'idle-desarmado-{d}.png'))
        linhas = 2 if d in COM_CARA else 1
        tira = Image.new('RGBA', (w * 4, h * linhas))
        for k in range(4 * linhas):
            tira.paste(Q[(d, 'parado', k)], ((k % 4) * w, (k // 4) * h))
        tira.save(os.path.join(pasta, f'parado-desarmado-{d}.png'))
        tira = Image.new('RGBA', (w * 8, h))
        for k in range(8):
            tira.paste(Q[(d, 'andar', k)], (k * w, 0))
        tira.save(os.path.join(pasta, f'andar-desarmado-{d}.png'))
    # a folha das 8 direções, na ordem do docs/ARTE.md (em cima n ne e se, embaixo s sw w nw)
    grade = ['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw']
    fl = Image.new('RGBA', (w * 4, h * 2))
    for i, d in enumerate(grade):
        fl.paste(Q[(d, 'parado', 0)], ((i % 4) * w, (i // 4) * h))
    fl.save(os.path.join(SAIDA, 'oito-direcoes.png'))
    folha([Q[(d, 'parado', 0)] for d in grade], cols=4, esc=4).save(os.path.join(SAIDA, 'oito-direcoes_4x.png'))
    # o GIF do andar (as 8 direções andando juntas) e o da respiração com a piscada
    fundo = (96, 92, 104)
    def gif(nome, quadros, dur):
        fr = [folha(qs, fundo=fundo, cols=4, esc=3).convert('RGB') for qs in quadros]
        pal = fr[0].quantize(colors=255, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
        fr = [f.quantize(palette=pal, dither=Image.Dither.NONE) for f in fr]
        fr[0].save(os.path.join(SAIDA, nome), save_all=True, append_images=fr[1:], duration=dur, loop=0, disposal=1)
    gif('andar.gif', [[Q[(d, 'andar', k)] for d in grade] for k in range(8)], 110)
    seq = [0, 0, 1, 1, 2, 2, 3, 3, 0, 0, 1, 1, 2, 2, 3, 3, 0, 4, 0, 0]
    gif('parado.gif', [[Q[(d, 'parado', k if (k < 4 or d in COM_CARA) else k - 4)] for d in grade] for k in seq], 150)
    folha([Q[(d, 'andar', k)] for d in ('se', 'sw') for k in range(8)], cols=8, esc=4).save(os.path.join(SAIDA, 'andar_se_sw_4x.png'))
    print('ok', len(tarefas), 'quadros', (w, h))


def na_cozinha(saida=None, lugares=(((2.15, 1.25), 'sw'), ((6.5, 2.35), 's'), ((3.05, 4.35), 'se'))):
    """
    A Alosi em pé dentro da cozinha 1:1 (agente_cozinha/cozinha.py), no z-buffer dela: o que está na frente (a mesa,
    as cadeiras) tapa o que está atrás; a sombra de contato pousa no ladrilho.
    """
    sys.path.insert(0, os.path.join(AQUI, '..', 'agente_cozinha'))
    import cozinha as K
    img = np.array(K.montar(0.0, 1.0)).astype(float)
    ck = K.c
    H, W = ck.prof.shape
    for (T, d) in lugares:
        q = render(d, pose(), T=T, sombra_chao=False)
        # a sombra no chão da cozinha (onde o que se vê é o chão, perto dos pés)
        P = ck.mundoP
        r = np.hypot(P[..., 0] - T[0], P[..., 1] - T[1])
        chao = (ck.tipo == 1) & (ck.nz > 0.6)
        a = np.where(chao & (r < 0.19), 0.42, np.where(chao & (r < 0.26), 0.24, 0.0))
        img = img * (1 - a[..., None]) + np.array([34.0, 22.0, 30.0]) * a[..., None]
        x0, y0, w, h = q.caixa
        for i in range(h):
            for j in range(w):
                if q.alfa[i, j] == 0:
                    continue
                I, Jx = i + y0 - ck.y0, j + x0 - ck.x0
                if 0 <= I < H and 0 <= Jx < W and q.c.prof[i, j] > ck.prof[I, Jx] - 0.01:
                    img[I, Jx] = q.cor[i, j]
    im = Image.fromarray(np.clip(img, 0, 255).astype(np.uint8))
    saida = saida or os.path.join(SAIDA, 'cozinha_teste.png')
    im.save(saida.replace('.png', '_1x.png'))
    im.resize((im.width * 3, im.height * 3), Image.NEAREST).save(saida)
    return im


if __name__ == '__main__':
    if '--rapido' in sys.argv:
        os.makedirs(SAIDA, exist_ok=True)
        imgs = [rgba(render(d, pose())) for d in ORDEM]
        folha(imgs).save(os.path.join(SAIDA, 'previa.png'))
    elif '--cozinha' in sys.argv:
        na_cozinha()
    else:
        tudo()
        na_cozinha()
    print('ok')
