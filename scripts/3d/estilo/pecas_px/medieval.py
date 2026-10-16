"""
GRUPO SB, "Santo Berço por dentro": os móveis de dentro da vila (a ferraria, a taverna, os quartos, a torre), em pixel
art 1:1 no estilo da cozinha da fazenda (agente_cozinha/cozinha.py). A vila é medieval e anacrônica: sem eletricidade
(a luz vem dos cristais vermelhos), madeira grossa e escura, ferro forjado, pedra, estanho, lã e palha.

Cada peça é desenhada no giro 4 (a frente para +y), com a pegada começando em (0, 0), no tamanho final do catálogo
(shared/src/furni.ts, a lista FURNI_METERS: o `height` daqui já está em METROS; nenhuma destas peças tem `aumento`).
O exportador (exportar_px.py) gira e faz o acabamento; os itens de parede vão pelo exportar_parede_px.py.

Decisões (o que o catálogo deixava em aberto):
  - forja, lareira: estado 0 acesa, '1' apagada. O fogo e as brasas são peças que brilham (CZ.luzes, sem a luz de
    face e sem contorno), para aparecer nos 4 giros; o FOGO do exportador é o da fornalha da cozinha (não serve).
  - mesa_rustica (vao 'vazada'): só o tampo de tábuas grossas a 0,8 m, a saia recuada e as quatro pernas nas quinas
    (nada embaixo: a cadeira encaixa e a peça passa abaixada). Vazia e limpa.
  - balcao_taverna, barril_madeira, bau_madeira, bigorna: o topo na altura do `height` (o que vai em cima não flutua).
    As pontas do balcão são retas (o corpo e o tampo vão de x = 0 a x = 3): em fila, emendam.
  - banco_rustico: o `height` (0,45 m) é o assento.
  - cama_palha: o `height` (0,55 m) é o alto da manta; a cabeceira passa dele.
  - lareira: a coifa de pedra sobe até 2,0 m e some em transparência nos últimos 40 cm (ela "continua" pela parede).
  - escotilha (flat): 0 aberta (o poço escuro com a escadinha e a tampa de ferro em pé), '1' fechada, '2' trancada
    (a tranca atravessada no aro e o cadeado).
  - escada_espiral (walkable): o miolo de pedra com os degraus em cunha subindo em volta (somem no alto, perto da
    viga) e o vão redondo descendo para o escuro, com os degraus continuando para baixo.
  - itens de parede: lampiao_cristal 0 aceso / '1' coberto (o pano de lã por cima, só um fio de luz embaixo).
"""
import math

import numpy as np

import cozinha as CZ
import base_estilo as BE
import estrutura as ES
import ocultismo as OC
import parede_casa as PC
from base_estilo import (hx, liso, mad2, tab2, vol, _tom, _pau, _barra, _p1_malha, _poligono_rodado, _disco, _fita,
                         PH, PZ)
from motor import emissivo, ruido, suave, KX, KZ, VISTA
import estilos as EST
from estilos import (W as TW, HP as THP, _uv_chao, _uv_parede, _h, _ns, _mancha, _rampa, _w, Grade, g_tabuas, g_voronoi,
                     g_fiadas, g_bruta, vol_chao, vol_parede, cor_peca, veio, no_madeira)

M = BE.M
CASA = 0.75
LUZ = np.array([-0.35, 0.45, 1.0]) / np.linalg.norm([-0.35, 0.45, 1.0])


# =====================================================================================================================
# ajudas
# =====================================================================================================================
def C():
    return CZ.c


def novo(contorno=True, sombra=True):
    return C().novo_obj(3, contorno=contorno, sombra=sombra)


def luz_obj():
    """Um objeto que brilha (sem a luz das faces e sem contorno): a brasa, o fogo, o cristal aceso."""
    o = C().novo_obj(3, contorno=False, sombra=False)
    CZ.luzes.add(o)
    return o


def cx(b, mat, o=None, ch=0.0):
    """Uma caixa (x0, x1, y0, y1, z0, z1) num objeto novo (ou no o). Devolve o objeto."""
    o = novo() if o is None else o
    C().caixa(b, mat, M, o, ch=ch)
    return o


def fp(pts, n, mat, o, dois=False):
    C().face_plana(pts, n, mat, M, o, dois_lados=dois)


def peg(x0, x1, y0, y1):
    CZ.pegadas.append((x0, x1, y0, y1))


def _ccw(pts):
    """Os pontos (a, b) no sentido anti-horário."""
    k = len(pts)
    area = sum(pts[i][0] * pts[(i + 1) % k][1] - pts[(i + 1) % k][0] * pts[i][1] for i in range(k))
    return pts if area > 0 else pts[::-1]


def placa_xz(pts, y0, y1, mat, o=None, mat_borda=None):
    """Uma placa de polígono convexo no plano x-z (a lâmina, a cabeça do machado), de y0 a y1, fechada."""
    o = novo() if o is None else o
    pts = _ccw(pts)
    fp([(x, y1, z) for (x, z) in pts], (0, 1, 0), mat, o)
    fp([(x, y0, z) for (x, z) in pts], (0, -1, 0), mat, o)
    k = len(pts)
    for i in range(k):
        (xa, za), (xb, zb) = pts[i], pts[(i + 1) % k]
        dx, dz = xb - xa, zb - za
        L = math.hypot(dx, dz)
        if L < 1e-9:
            continue
        fp([(xa, y0, za), (xb, y0, zb), (xb, y1, zb), (xa, y1, za)], (dz / L, 0, -dx / L), mat_borda or mat, o)
    return o


def placa_yz(pts, x0, x1, mat, o=None, mat_borda=None, mat_tras=None):
    """Uma placa de polígono convexo no plano y-z (o escudo de lado), de x0 a x1, fechada."""
    o = novo() if o is None else o
    pts = _ccw(pts)
    fp([(x1, y, z) for (y, z) in pts], (1, 0, 0), mat, o)
    fp([(x0, y, z) for (y, z) in pts], (-1, 0, 0), mat_tras or mat, o)
    k = len(pts)
    for i in range(k):
        (ya, za), (yb, zb) = pts[i], pts[(i + 1) % k]
        dy, dz = yb - ya, zb - za
        L = math.hypot(dy, dz)
        if L < 1e-9:
            continue
        fp([(x0, ya, za), (x0, yb, zb), (x1, yb, zb), (x1, ya, za)], (0, dz / L, -dy / L), mat_borda or mat, o)
    return o


def pau(p0, p1, w, mat, o=None):
    """Uma barra reta inclinada de p0 a p1 (a perna aberta do banco, o cabo encostado), de seção w x w."""
    o = novo() if o is None else o
    ES._prisma(p0, p1, w, w, mat, o)
    return o


def _so_pela_boca(cx_, cy_, R):
    """
    O buraco redondo no chão (o vão da escada em caracol): o que fica abaixo de z = 0 só aparece pela boca (o raio
    até a câmera tem de passar dentro do círculo); o resto o chão do jogo tapa. Como o estrutura._por_cima_do_chao,
    empurra a profundidade do que ficou para o chão invisível do exportador não pintar por cima.
    """
    c = C()
    p = BE._peca()
    P = c.mundoP
    abaixo = (c.obj >= 0) & (P[..., 2] < -1e-4)
    Q = P - VISTA[None, None, :] * (P[..., 2:3] / VISTA[2])
    Lq = p.local(Q) if p is not None else Q
    fora = abaixo & (np.hypot(Lq[..., 0] - cx_, Lq[..., 1] - cy_) > R)
    c.obj = np.where(fora, -1, c.obj)
    c.tipo = np.where(fora, 0, c.tipo)
    c.prof = np.where(fora, -1e9, c.prof)
    c.prof = np.where(c.obj >= 0, c.prof + 1000.0, c.prof)


# =====================================================================================================================
# as cores e os materiais da vila
# =====================================================================================================================
CARV = '#5a3a24'                                  # o carvalho escuro (o corpo dos móveis)
CARV_E = '#3e2616'                                # o escuro (o rodapé, o vão)
CARV_T = ['#6e4628', '#68422a', '#74492b']        # as tábuas de cima
CARV_TJ = '#2e1a0e'
FERRO = '#34302e'                                 # o ferro forjado
FERRO_T = '#5e5650'
ESTANHO = '#8e908c'                               # as canecas e a jarra
ESTANHO_E = '#5e605e'
PEDRA = '#8a8278'                                 # a pedra das paredes da forja e da lareira
PEDRA_E = '#5e574e'
LA_VERM = '#7a2e24'                               # a lã tingida
PALHA = '#d2b366'
CRIS = ['#8e1a14', '#c82a1e', '#f04a30', '#ff8a62', '#ffd2b8']      # o cristal aceso, do escuro ao brilho
BRASA = ('#d8561c', '#ffa040', '#ffe08a')


def ferro(cor=FERRO, topo=FERRO_T):
    return ES.ferro(cor, topo)


def cantaria(cor=PEDRA, alt=6, comp=11, seed=0, junta=None, tinge=None):
    """
    A pedra aparelhada nas faces em pé (a forja, a lareira): fiadas de `alt` px, pedras de comprimento variado por
    fiada (`comp` px em média), a junta de 1 px, a fiada de cima de cada pedra clara e a de baixo escura, o tom de cada
    pedra sorteado. tinge(L, n, P, out) -> out: o que muda por cima (a fuligem, a luz do fogo).
    No topo: a cor lisa um tom acima (o topo de verdade leva um material próprio).
    """
    c0 = hx(cor)
    jc = hx(junta) if junta else _tom(c0, 0.55)
    tons = np.stack([c0, _tom(c0, 1.07), _tom(c0, 0.93), _tom(c0, 0.86)])

    def f(L, n, P):
        vert, a, z = ES._face_info(L, n)
        if not vert:
            out = np.tile(_tom(c0, 1.08), (len(P), 1))
        else:
            bz = alt * PZ
            fila = np.floor(z / bz + 1e-6)
            bl = comp * PH * (0.7 + 0.6 * ruido(fila, seed + 1.0))
            aa = a + ruido(fila, seed + 2.0) * bl
            col = np.floor(aa / bl)
            ga, gz = aa - col * bl, z - fila * bz
            k = (ruido(fila, col, seed + 3.0) * 4).astype(int) % 4
            out = tons[k]
            out = np.where((gz >= bz - 2 * PZ)[:, None], _tom(out, 1.1), out)
            out = np.where((gz < 2 * PZ)[:, None], _tom(out, 0.9), out)
            out = np.where(((ga >= PH) & (ga < 2 * PH))[:, None], _tom(out, 1.05), out)
            out = np.where(((gz < PZ) | (ga < PH))[:, None], jc, out)
        if tinge is not None:
            out = tinge(L, n, P, out)
        return out
    return emissivo(f)


def lajes(cor=PEDRA, la=0.22, lb=0.16, seed=0, tinge=None):
    """As lajes de pedra no topo (a borda da forja, o chão da lareira), com a luz do fogo se `tinge`."""
    base = ES.pedra(cor, la, lb, seed)

    def f(L, n, P):
        out = base(L, n, P)
        return tinge(L, n, P, out) if tinge is not None else out
    return emissivo(f)


def _brilho_fogo(dentro, k=0.3, cor='#e0682a'):
    """Um tingir que puxa para o laranja do fogo onde `dentro(P)` (um número de 0 a 1 por ponto, em degraus)."""
    c = hx(cor)

    def t(L, n, P, out):
        a = np.clip(dentro(P), 0, 1)
        a = np.round(a * 3) / 3 * k
        return out * (1 - a[:, None]) + c * a[:, None]
    return t


def couro(cor='#6a3a24', listra=3):
    """O couro do fole: a cor e as dobras (riscas escuras de 1 px a cada `listra` px na vertical, com a luz em cima)."""
    c0 = hx(cor)

    def f(L, n, P):
        out = np.tile(c0, (len(P), 1))
        if abs(n[2]) > 0.5:
            return np.tile(_tom(c0, 1.12), (len(P), 1))
        v = np.floor(P[:, 2] / PZ + 1e-6)
        out = np.where((v % listra == 0)[:, None], _tom(c0, 0.7), out)
        out = np.where((v % listra == listra - 1)[:, None], _tom(c0, 1.12), out)
        return out
    return emissivo(f)


def cristal(cx_, cy_, z0, h, r, aceso=True, lados=6, fase=0.3):
    """
    O cristal vermelho (a "lâmpada" da vila): o prisma de seis faces que alarga até 62% da altura e a ponta em
    pirâmide. Aceso: brilha (sem a luz do motor e sem contorno), cada face num tom pela posição dela em relação à
    luz no mundo (o giro do exportador conta), a ponta mais clara. Apagado: o vermelho escuro e fosco, com contorno.
    """
    zm = z0 + h * 0.62
    zt = z0 + h
    ang = [2 * math.pi * (i + fase) / lados for i in range(lados)]
    base = [(cx_ + r * 0.72 * math.cos(a), cy_ + r * 0.72 * math.sin(a), z0) for a in ang]
    meio = [(cx_ + r * math.cos(a), cy_ + r * math.sin(a), zm) for a in ang]
    topo = (cx_, cy_, zt)
    o = luz_obj() if aceso else novo()
    for i in range(lados):
        j = (i + 1) % lados
        am = (ang[i] + ang[j]) / 2 + (2 * math.pi if j == 0 else 0)
        am = (ang[i] + ang[i] + 2 * math.pi / lados) / 2
        n1 = (math.cos(am), math.sin(am), -0.12)
        n2 = (math.cos(am) * 0.7, math.sin(am) * 0.7, 0.7)
        for (pts, n, sobe) in (([base[i], base[j], meio[j], meio[i]], n1, 0), ([meio[i], meio[j], topo], n2, 1)):
            if aceso:
                d = float(BE.n_mundo(np.array(n)) @ LUZ)
                k = int(np.clip(np.round(1.2 + d * 2.2 + sobe * 0.8), 0, 4))
                m = liso(CRIS[k])
            else:
                m = liso('#6a2420' if sobe == 0 else '#82302a')
            fp(pts, n, m, o)
    fp(base[::-1], (0, 0, -1), liso(CRIS[0] if aceso else '#4a1814'), o)
    return o


def monte_cristais(cx_, cy_, z0, rx, ry, n=5, aceso=True, seed=0, alto=0.22):
    """
    Santo Berço não tem fogo (16/10, o Felipe): onde iria a lenha ou o carvão em brasa, um monte de cristais vermelhos
    sobre pedras escuras. n cristais de alturas diferentes, o maior no meio, os outros em volta inclinados para fora
    (pela ordem e pela semente); as pedras embaixo, sem brasa.
    """
    for k in range(7):
        a = 2 * math.pi * k / 7 + seed
        rr = 0.55 + 0.35 * ruido(k, seed + 5.0)
        s = 0.035 + 0.025 * ruido(k, seed + 6.0)
        OC.bloco((cx_ + rx * rr * math.cos(a), cy_ + ry * rr * math.sin(a), z0 + s * 0.35), (s * 1.3, s, s * 0.7),
                 OC.carvao('#3a3634', brasa=0.0, seed=int(seed * 10) + k, celula=(4, 3)), yaw=41 * k, pitch=6 * (k % 3))
    for k in range(n):
        if k == 0:
            x, y, h = cx_, cy_, alto
        else:
            a = 2 * math.pi * (k - 1) / max(1, n - 1) + 0.6 + seed
            rr = 0.45 + 0.3 * ruido(k, seed + 1.0)
            x, y = cx_ + rx * rr * math.cos(a), cy_ + ry * rr * math.sin(a)
            h = alto * (0.45 + 0.35 * ruido(k, seed + 2.0))
        cristal(x, y, z0, h, h * 0.26, aceso=aceso, fase=0.3 + 0.17 * k)


def chama(cx_, cy_, s, z0, larg, alto, cor, frente=0.0, torto=0.0, o=None):
    """A língua de fogo de frente para a câmera (a do ocultismo: a fogueira do bando)."""
    return OC.chama_corpo(cx_, cy_, s, z0, larg, alto, cor, frente, torto, o)


def fogo(cx_, cy_, larg=0.42, alto=0.42, z0=0.0, frente=0.0):
    """
    O fogo (como a fogueira do ocultismo, mas em línguas separadas): cada língua em três camadas (o vermelho de fora,
    o laranja e o miolo amarelo), a mais alta no meio, a base baixa juntando todas, e as fagulhas. Centrado em
    (cx, cy), com a base em z0.
    """
    if not OC.CHAMA_ASSADA:
        return  # a chama é viva no cliente (particles.ts); o desenho fica só com a lenha e a brasa
    linguas = ((-0.34, 0.3, 0.55, -0.06), (-0.1, 0.34, 0.85, -0.03), (0.13, 0.36, 1.0, 0.05), (0.36, 0.28, 0.62, 0.07))
    o1, o2, o3 = luz_obj(), luz_obj(), luz_obj()
    chama(cx_, cy_, 0.0, z0, larg * 1.05, alto * 0.3, '#c8401a', frente, 0.0, o1)
    chama(cx_, cy_, 0.0, z0 + 0.005, larg * 0.8, alto * 0.24, '#f08a2a', frente + 0.03, 0.0, o2)
    for (s, lg, al, tt) in linguas:
        x = s * larg
        chama(cx_, cy_, x, z0 + alto * 0.05, lg * larg, al * alto, '#c8401a', frente, tt * larg, o1)
        chama(cx_, cy_, x + 0.01, z0 + alto * 0.06, lg * larg * 0.66, al * alto * 0.72, '#f08a2a', frente + 0.03, tt * larg * 0.8, o2)
        if al > 0.6:
            chama(cx_, cy_, x + 0.015, z0 + alto * 0.07, lg * larg * 0.34, al * alto * 0.45, '#ffd468', frente + 0.06, tt * larg * 0.5, o3)
    hv, rv = BE.frente_tela()
    of = luz_obj()
    for (s, z) in ((-0.28, 1.1), (0.3, 1.28), (0.02, 1.42)):
        zz = z0 + z * alto
        ss = s * larg
        P = [(cx_ + (ss + a) * rv[0] + (frente + 0.08) * hv[0], cy_ + (ss + a) * rv[1] + (frente + 0.08) * hv[1], zz + b)
             for (a, b) in ((0, 0), (0.033, 0), (0.033, 0.04), (0, 0.04))]
        fp(P, (hv[0], hv[1], 0.0), liso('#ffb040'), of, dois=True)


def tora(cx_, cy_, z, comp, r, yaw, acesa=True, seed=0):
    """A lenha deitada (a tora queimando): o prisma de casca com a ponta clara, em carvão com brasa se acesa."""
    a = math.radians(yaw)
    dx, dy = math.cos(a), math.sin(a)
    CV = OC.carvao('#3a2c22' if acesa else '#262020', brasa=0.35 if acesa else 0.0, seed=seed, celula=(5, 3))
    OC.bloco((cx_, cy_, z), (r * 2, comp, r * 2), {'*': CV, 'frente': liso('#c8a070'), 'costas': liso('#b08a5a')},
             yaw=yaw - 90)


def estanho(x, y, z, r, h, o=None, faixas=None):
    """Um corpo de estanho (a caneca, a jarra): o cinza fosco com a risca de brilho."""
    o = novo() if o is None else o
    C().cilindro(x, y, r, z, z + h, vol(x, y, ESTANHO, brilho=0.4, faixas=faixas), M, o, lados=14, tampa_mat=liso('#a8aaa6'))
    return o


def caneca(x, y, z, h=0.12, r=0.042, emborcada=False):
    """
    A caneca de estanho com tampa: o corpo com os dois aros (a faixa escura), a tampa um pouco mais larga com o
    botão de dedão, e a asa do lado (a fita de frente para a câmera).
    """
    def aros(P, b):
        zz = P[:, 2] - z
        b = np.where(((zz > 0.018) & (zz <= 0.018 + PZ))[:, None], _tom(b, 0.7), b)
        return np.where(((zz > h - 0.03) & (zz <= h - 0.03 + PZ))[:, None], _tom(b, 0.7), b)
    o = novo()
    C().cilindro(x, y, r, z, z + h, vol(x, y, ESTANHO, brilho=0.45, faixas=aros), M, o, lados=14, r1=r * 0.9,
                 tampa_mat=liso('#3a3a38') if not emborcada else liso('#a8aaa6'))
    if not emborcada:
        o2 = novo()
        C().cilindro(x, y, r * 0.98, z + h, z + h + 0.014, vol(x, y, '#9a9c98', brilho=0.4), M, o2, lados=14, tampa_mat=liso('#b8bab4'))
        _barra((x - PH, x + PH, y - r - 0.012, y - r + 0.01, z + h + 0.01, z + h + 0.03), '#7a7c78', '#b0b2ac', quina=False)
    o3 = novo()
    _fita([(r * 0.8, z + h * 0.85), (r + 0.04, z + h * 0.8), (r + 0.045, z + h * 0.45), (r + 0.03, z + h * 0.2), (r * 0.8, z + h * 0.18)],
          x, y, liso('#7e807c'), o3, 0.016)
    CZ.itens_peq.append((x - r, x + r, y - r, y + r, z))


def jarra(x, y, z, h=0.26, r=0.075):
    """A jarra de estanho: a barriga, o pescoço, a boca com o bico e a asa grande."""
    def aros(P, b):
        zz = P[:, 2] - z
        return np.where(((zz > h * 0.52) & (zz <= h * 0.52 + PZ))[:, None], _tom(b, 0.72), b)
    perfil = [(z, r * 0.7), (z + h * 0.1, r * 0.92), (z + h * 0.35, r), (z + h * 0.58, r * 0.86), (z + h * 0.74, r * 0.56),
              (z + h * 0.86, r * 0.52), (z + h, r * 0.66)]
    o = novo()
    _poligono_rodado(x, y, perfil, vol(x, y, ESTANHO, brilho=0.45, faixas=aros), o, lados=16)

    def boca(L, n, P):
        rr = np.hypot(P[:, 0] - x, P[:, 1] - y)
        return np.where((rr > r * 0.66 - 0.014)[:, None], hx('#b0b2ac'), hx('#2a2624'))
    _disco(x, y, z + h, r * 0.66, emissivo(boca), o, lados=16)
    o3 = novo()
    _fita([(r * 0.6, z + h * 0.92), (r + 0.06, z + h * 0.88), (r + 0.07, z + h * 0.6), (r + 0.04, z + h * 0.3), (r * 0.9, z + h * 0.25)],
          x, y, liso('#7e807c'), o3, 0.02)
    CZ.itens_peq.append((x - r, x + r, y - r, y + r, z))


# =====================================================================================================================
# a ferraria: a forja, a bigorna, o suporte de armas, a armadura, a tina
# =====================================================================================================================
def forja(acesa=True, cristais=False):
    """
    A forja (3 x 2 casas, 1,4 m): o fogão de pedra aparelhada com a borda de lajes e a cova do carvão, a parede de
    trás com a boca da chaminé (a fuligem por cima), o fole de couro do lado esquerdo no cavalete com o bico de ferro
    entrando na pedra, e a tenaz em cima da borda. Acesa: as brasas laranja vivas, umas chamas baixas e o cristal
    vermelho no meio do carvão; a luz do fogo pega na borda e na parede. Apagada ('1'): o carvão cinza e frio.
    """
    X0, X1, Y0, Y1 = 0.6, 2.2, 0.1, 1.4
    ZB = 0.7                              # o alto do corpo (a cova)
    ZR = 0.8                              # o alto da borda
    PX0, PX1, PY0, PY1 = 1.02, 1.82, 0.62, 1.14      # a cova
    cxp, cyp = (PX0 + PX1) / 2, (PY0 + PY1) / 2

    def perto(P):
        dx = np.maximum(np.maximum(PX0 - P[:, 0], P[:, 0] - PX1), 0)
        dy = np.maximum(np.maximum(PY0 - P[:, 1], P[:, 1] - PY1), 0)
        d = np.hypot(dx, dy)
        return np.clip(1.0 - d / 0.2, 0, 1) * np.clip(1.25 - (P[:, 2] - ZB) / 0.5, 0, 1)
    T = (_brilho_fogo(perto, 0.42, '#d8402a') if cristais else _brilho_fogo(perto, 0.42)) if acesa else None
    PD = cantaria(PEDRA, 6, 11, seed=11)
    # o corpo de pedra (com o rodapé um pouco mais largo)
    cx((X0 - 0.03, X1 + 0.03, Y0 - 0.03, Y1 + 0.03, 0.0, 0.08), {'*': cantaria(PEDRA_E, 4, 9, seed=12), 'cima': lajes(PEDRA_E, seed=13)})
    cx((X0, X1, Y0, Y1, 0.08, ZB), {'*': PD, 'cima': lajes(PEDRA, seed=14)})
    # a borda de lajes em volta da cova (sai 3 cm para fora)
    BD = {'cima': lajes('#958d82', 0.2, 0.15, seed=15, tinge=T), '*': cantaria('#857d72', 4, 9, seed=16, tinge=T)}
    for b in ((X0 - 0.03, X1 + 0.03, PY1, Y1 + 0.03), (X0 - 0.03, X1 + 0.03, Y0 - 0.03, PY0),
              (X0 - 0.03, PX0, PY0, PY1), (PX1, X1 + 0.03, PY0, PY1)):
        cx(b + (ZB, ZR), BD)
    # a cova: o carvão (com as brasas, se acesa) e os pedaços soltos; em Santo Berço, as pedras e os cristais
    if cristais:
        cx((PX0, PX1, PY0, PY1, ZB - 0.02, ZB + 0.01), {'cima': OC.carvao('#2e2a28', brasa=0.0, seed=21, celula=(5, 3)), '*': liso('#2e2a28')})
        monte_cristais(cxp, cyp, ZB + 0.01, 0.34, 0.2, n=5, aceso=acesa, seed=2.0, alto=0.26)
    elif acesa:
        CV = OC.carvao('#4a2e20', brasa=0.55, seed=21, celula=(5, 3))
        o = luz_obj()
    else:
        CV = OC.carvao('#6a6660', brasa=0.0, seed=21, celula=(5, 3))
        o = novo()
    if not cristais:
        cx((PX0, PX1, PY0, PY1, ZB - 0.02, ZB + 0.03), {'cima': CV, '*': CV}, o=o)
    for k in range(0 if cristais else 9):
        a = 2 * math.pi * k / 9 + 0.4
        rr = 0.12 + 0.16 * ruido(k, 3.0)
        xk, yk = cxp + rr * math.cos(a) * 1.5, cyp + rr * math.sin(a)
        if not (PX0 + 0.06 < xk < PX1 - 0.06 and PY0 + 0.06 < yk < PY1 - 0.06):
            continue
        s = 0.05 + 0.03 * ruido(k, 5.0)
        CVk = OC.carvao('#3a2a22' if acesa else '#76726a', brasa=0.5 if acesa else 0.0, seed=30 + k, celula=(4, 3))
        OC.bloco((xk, yk, ZB + 0.04), (s, s * 1.2, s * 0.7), CVk, yaw=37 * k, pitch=8 * (k % 3), o=(luz_obj() if acesa else None))
    # o cristal vermelho no meio do carvão
    if not cristais:
        cristal(cxp + 0.02, cyp, ZB + 0.02, 0.22, 0.055, aceso=acesa)
    if acesa and not cristais:
        for (dx, s, al) in ((-0.2, 0.09, 0.1), (0.17, 0.08, 0.12), (0.0, 0.07, 0.08)):
            o1 = luz_obj()
            chama(cxp + dx, cyp + 0.12, 0.0, ZB + 0.02, s, al, '#f08a2a', 0.0, 0.01, o1)
            chama(cxp + dx, cyp + 0.12, 0.0, ZB + 0.025, s * 0.5, al * 0.6, '#ffd468', 0.02, 0.0, o1)
    # a parede de trás da forja, com a boca da chaminé e a fuligem
    YH = Y0 + 0.3
    bx0, bx1, bz0, bz1 = cxp - 0.24, cxp + 0.24, ZR + 0.04, 1.2

    def fuligem(L, n, P, out):
        if n[1] > 0.5:
            X, Z = P[:, 0], P[:, 2]
            d = np.abs(X - cxp) / 0.55 + np.clip((1.3 - Z) / 0.6, 0, 1) * 0.3
            out = np.where((d < 0.9)[:, None], _tom(out, 0.78), out)
            out = np.where((d < 0.6)[:, None], _tom(out, 0.66), out)
            # a boca: o escuro com o arco em cima
            u = (X - (bx0 + bx1) / 2) / ((bx1 - bx0) / 2)
            topo = bz1 - 0.1 + 0.1 * np.sqrt(np.clip(1 - u * u, 0, 1))
            boca = (np.abs(u) < 1) & (Z > bz0) & (Z < topo)
            out = np.where(boca[:, None], hx('#140e0c'), out)
            out = np.where((boca & (Z < bz0 + 0.06))[:, None], hx('#2a1c16'), out)
            arco = (np.abs(u) < 1.18) & (Z >= topo) & (Z < topo + 2 * PZ) & ~boca
            out = np.where(arco[:, None], _tom(hx('#5a524a'), 0.8), out)
        if T is not None:
            out = T(L, n, P, out)
        return out
    cx((X0, X1, Y0, YH, ZR, 1.34), {'*': cantaria('#7e766c', 6, 10, seed=17, tinge=fuligem), 'cima': lajes('#6e675e', seed=18)})
    cx((X0 - 0.04, X1 + 0.04, Y0 - 0.02, YH + 0.04, 1.34, 1.4), {'*': cantaria('#6e665c', 3, 14, seed=19), 'cima': lajes('#5e584f', 0.26, 0.2, seed=20)})
    # o fole: o cavalete de madeira, as duas tábuas em gota e o couro pregueado, o bico de ferro e o puxador
    for (x, y) in ((0.12, 0.48), (0.46, 0.48), (0.12, 1.02), (0.46, 1.02)):
        cx((x - 0.03, x + 0.03, y - 0.03, y + 0.03, 0.0, 0.5), {'*': mad2(CARV, eixo=1, seed=40, passo=0.04), 'cima': liso('#7a5232')})
    cx((0.06, 0.52, 0.45, 1.05, 0.44, 0.5), {'*': mad2(CARV, seed=41, passo=0.04), 'cima': tab2(CARV_T, 0.15, CARV_TJ, eixo=1, seed=42)})
    fole(0.04, 0.6, 0.75, 0.5, X0 + 0.02)
    # a tenaz em cima da borda da frente
    zt = ZR + 0.005
    for (a, b) in (((1.3, 1.29), (1.86, 1.25)), ((1.3, 1.31), (1.86, 1.33))):
        cx((a[0], b[0], min(a[1], b[1]) - 0.01, max(a[1], b[1]) + 0.01, zt, zt + 0.018), ferro('#2a2624', '#5a524c'))
    cx((1.26, 1.32, 1.27, 1.35, zt, zt + 0.025), ferro('#2a2624', '#6a625c'))
    peg(X0 - 0.03, X1 + 0.03, Y0 - 0.03, Y1 + 0.03)
    peg(0.06, 0.56, 0.45, 1.05)


def fole(x0, x1, yc, z0, x_bico):
    """
    O fole de couro de ferreiro, deitado no cavalete: a tábua de baixo em gota (o bico para +x), a de cima em cunha
    (aberta atrás, fechando no bico), o couro pregueado entre as duas, o bico de ferro até a forja e o puxador de trás.
    """
    L = x1 - x0
    gota = [(0.0, 0.0), (0.03, -0.12), (0.12, -0.25), (0.3, -0.29), (0.6, -0.17), (0.9, -0.05), (0.9, 0.05), (0.6, 0.17),
            (0.3, 0.29), (0.12, 0.25), (0.03, 0.12)]
    pts = [(x0 + a * L, yc + b * L * 1.6) for (a, b) in gota]
    za, zb = z0 + 0.04, z0 + 0.06

    def ztopo(x):
        return zb + 0.04 + 0.2 * (1 - (x - x0) / (0.9 * L))
    TB = {'cima': mad2('#7a5232', seed=43, passo=0.05), '*': liso('#4a2e1a')}
    OC.prisma(pts, z0, za, TB['*'], topo=TB['cima'])
    # o couro: as faces em pé entre a tábua de baixo e a de cima (inclinada), num pouco para dentro
    o = novo()
    cxm = sum(p[0] for p in pts) / len(pts)
    dentro = [(cxm + (x - cxm) * 0.93, yc + (y - yc) * 0.93) for (x, y) in pts]
    dentro = _ccw(dentro)
    CO = couro('#6e3a22', 3)
    k = len(dentro)
    for i in range(k):
        (xa, ya), (xb, yb) = dentro[i], dentro[(i + 1) % k]
        dx, dy = xb - xa, yb - ya
        ll = math.hypot(dx, dy)
        if ll < 1e-9:
            continue
        fp([(xa, ya, za), (xb, yb, za), (xb, yb, ztopo(xb)), (xa, ya, ztopo(xa))], (dy / ll, -dx / ll, 0), CO, o)
    # a tábua de cima, inclinada (a frente, mais baixa, no bico), com os cravos
    o2 = novo()
    e = 0.03
    sl = 0.2 / (0.9 * L)
    nn = np.array([sl, 0.0, 1.0]) / math.hypot(sl, 1.0)
    fp([(x, y, ztopo(x) + e) for (x, y) in _ccw(pts)], tuple(nn), mad2('#7a5232', seed=44, passo=0.05), o2)
    for i in range(len(pts)):
        (xa, ya), (xb, yb) = _ccw(pts)[i], _ccw(pts)[(i + 1) % len(pts)]
        dx, dy = xb - xa, yb - ya
        ll = math.hypot(dx, dy)
        fp([(xa, ya, ztopo(xa)), (xb, yb, ztopo(xb)), (xb, yb, ztopo(xb) + e), (xa, ya, ztopo(xa) + e)], (dy / ll, -dx / ll, 0),
           liso('#4a2e1a'), o2)
    for (a, b) in ((0.22, -0.12), (0.22, 0.12), (0.5, 0.0)):
        x, y = x0 + a * L, yc + b * L
        cx((x - PH, x + PH, y - PH, y + PH, ztopo(x) + e - 0.004, ztopo(x) + e + 0.006), liso('#2a2624'), o=novo(contorno=False))
    # o bico de ferro e o puxador (a alça de trás, na tábua de cima)
    xb0 = x0 + 0.88 * L
    cx((xb0, x_bico, yc - 0.025, yc + 0.025, za + 0.01, za + 0.06), ferro('#2e2a28', '#5a524c'))
    zp = ztopo(x0) + e
    cx((x0 - 0.06, x0 + 0.06, yc - 0.018, yc + 0.018, zp, zp + 0.03), _pau('#6a4426', '#9a6a40', quina=False))
    cx((x0 - 0.06, x0 - 0.03, yc - 0.07, yc + 0.07, zp + 0.02, zp + 0.045), _pau('#6a4426', '#9a6a40', quina=False))


def bigorna():
    """
    A bigorna (1 x 1, a mesa a 0,85 m) num toco de árvore: o toco com a casca em riscas e os anéis em cima; a
    bigorna de ferro (o pé largo, a cintura, a mesa polida com o furo quadrado, o chifre afinando para a direita); o
    martelo deitado na mesa e a tenaz encostada no toco.
    """
    x, y = 0.375, 0.39
    rt = 0.25
    zt = 0.5

    def casca(P, b):
        th = np.arctan2(P[:, 1] - y, P[:, 0] - x)
        k = np.floor(((th / (2 * math.pi)) * 22 + 22) % 22)
        return np.where((k % 3 == 0)[:, None], _tom(b, 0.82), np.where((k % 3 == 1)[:, None], _tom(b, 1.06), b))
    o = novo()
    _poligono_rodado(x, y, [(0.0, rt * 1.12), (0.06, rt * 1.03), (zt, rt)], vol(x, y, '#5a3e2a', faixas=casca), o, lados=22)
    for k in range(5):
        a = 2 * math.pi * k / 5 + 0.5
        OC.bloco((x + math.cos(a) * (rt + 0.02), y + math.sin(a) * (rt + 0.02), 0.04), (0.08, 0.16, 0.07),
                 {'*': liso('#4e3424'), 'cima': liso('#6a4a32')}, yaw=math.degrees(a) - 90, pitch=-25)

    def aneis(L, n, P):
        rr = np.hypot(P[:, 0] - x, P[:, 1] - y) / PH
        out = np.tile(hx('#c49a66'), (len(P), 1))
        out = np.where((np.floor(rr) % 3 == 0)[:, None], hx('#a87e50'), out)
        out = np.where((rr > rt / PH - 1.5)[:, None], hx('#4a3020'), out)
        out = np.where((rr < 1.0)[:, None], hx('#8a6040'), out)
        return out
    _disco(x, y, zt, rt, emissivo(aneis), o, lados=22)
    # a bigorna
    FE = {'*': liso('#3a3a40'), 'cima': liso('#55565e')}
    cx((x - 0.17, x + 0.15, y - 0.11, y + 0.11, zt, zt + 0.05), FE)
    cx((x - 0.11, x + 0.09, y - 0.075, y + 0.075, zt + 0.05, 0.71), FE)
    cx((x - 0.13, x + 0.11, y - 0.1, y + 0.1, 0.71, 0.75), FE)

    def mesa(L, n, P):
        if n[2] > 0.5:
            out = np.tile(hx('#8a8c94'), (len(P), 1))
            X, Y = P[:, 0], P[:, 1]
            out = np.where(((X > x - 0.17) & (X < x - 0.17 + 3 * PH) & (np.abs(Y - y) < 1.2 * PH))[:, None], hx('#1a1a1e'), out)
            out = np.where((np.abs(Y - (y - 0.02)) < 0.5 * PH)[:, None], hx('#a8aab0'), out)
            return out
        return np.tile(hx('#44454c'), (len(P), 1))
    cx((x - 0.22, x + 0.16, y - 0.1, y + 0.1, 0.75, 0.85), emissivo(mesa))
    # o chifre (o cone deitado: dois prismas afinando)
    placa_xz([(x + 0.16, 0.85), (x + 0.16, 0.76), (x + 0.33, 0.815)], y - 0.075, y + 0.075, liso('#44454c'))
    OC.prisma([(x + 0.16, y - 0.1), (x + 0.16, y + 0.1), (x + 0.34, y + 0.004), (x + 0.34, y - 0.004)], 0.83, 0.85,
              liso('#44454c'), topo=liso('#8a8c94'))
    # o martelo deitado na mesa
    zm = 0.85
    cx((x - 0.12, x + 0.12, y + 0.04, y + 0.065, zm, zm + 0.025), {'*': liso('#7a5232'), 'cima': liso('#a8784a')})
    cx((x + 0.1, x + 0.15, y + 0.01, y + 0.1, zm, zm + 0.05), {'*': liso('#2e2e34'), 'cima': liso('#6a6c74')})
    CZ.itens_peq.append((x - 0.12, x + 0.15, y + 0.01, y + 0.1, zm))
    # a tenaz encostada no toco (os dois braços de ferro, abertos na ponta)
    for dx in (-0.02, 0.02):
        pau((x + 0.16 + dx * 2, y + 0.33, 0.0), (x + 0.1 + dx * 0.5, y + rt - 0.02, 0.4), 0.026, ferro('#2a2624', '#6a625c'))
    cx((x + 0.07, x + 0.13, y + rt - 0.05, y + rt, 0.38, 0.48), ferro('#24201e', '#5a524c'))
    peg(x - rt * 1.12, x + rt * 1.12, y - rt * 1.12, y + rt * 1.12)


def _espada(x, y, z0, comp=0.86, larg=0.07):
    """A espada em pé, de ponta para baixo: a lâmina (o fio claro e o sulco), a guarda de latão, o cabo de couro e o pomo."""
    zg = z0 + comp
    LAM = emissivo(lambda L, n, P: np.where((np.abs(P[:, 0] - x) < 0.5 * PH)[:, None], hx('#7a7e86'),
                                            np.where((P[:, 0] < x)[:, None], hx('#d4d8de'), hx('#a8acb4'))))
    placa_xz([(x - larg / 2, zg), (x + larg / 2, zg), (x + larg / 2, z0 + 0.14), (x, z0), (x - larg / 2, z0 + 0.14)],
             y - 0.01, y + 0.01, LAM, mat_borda=liso('#e0e4e8'))
    cx((x - 0.13, x + 0.13, y - 0.022, y + 0.022, zg, zg + 0.04), {'*': liso('#a8823a'), 'cima': liso('#e0b860')})
    cx((x - 0.022, x + 0.022, y - 0.022, y + 0.022, zg + 0.04, zg + 0.24), {'*': liso('#4a2a1a'), 'cima': liso('#6a3a22')})
    o = novo()
    C().elipsoide(np.array([x, y, zg + 0.27]), np.array([0.04, 0.04, 0.035]), liso('#c8a048'), o)


def _machado(x, y, z0, comp=1.12, barba=False):
    """O machado em pé: o cabo comprido de freixo e a cabeça larga de ferro em cima (o gume claro para a esquerda)."""
    zt = z0 + comp
    cx((x - 0.024, x + 0.024, y - 0.024, y + 0.024, z0, zt), {'*': mad2('#9a6a3c', eixo=1, seed=51, passo=0.03), 'cima': liso('#b8844e')})
    if barba:
        cab = [(x + 0.04, zt - 0.03), (x + 0.04, zt - 0.14), (x - 0.08, zt - 0.17), (x - 0.22, zt - 0.34), (x - 0.25, zt - 0.02)]
    else:
        cab = [(x + 0.04, zt - 0.02), (x + 0.04, zt - 0.13), (x - 0.1, zt - 0.15), (x - 0.22, zt - 0.24), (x - 0.22, zt + 0.1),
               (x - 0.1, zt - 0.0)]
    GUME = emissivo(lambda L, n, P: np.where((P[:, 0] < x - 0.18)[:, None], hx('#dce0e4'), hx('#6e727a')))
    placa_xz(cab, y - 0.02, y + 0.02, GUME, mat_borda=liso('#9a9ea6'))
    cx((x + 0.03, x + 0.08, y - 0.026, y + 0.026, zt - 0.12, zt - 0.03), liso('#4a4c52'))


def _lanca(x, y, z0, comp):
    """A lança: a haste comprida e a ponta de folha em cima."""
    zt = z0 + comp
    cx((x - 0.018, x + 0.018, y - 0.018, y + 0.018, z0, zt), {'*': mad2('#8a5a32', eixo=1, seed=52, passo=0.03), 'cima': liso('#a87a4a')})
    placa_xz([(x, zt + 0.24), (x + 0.045, zt + 0.08), (x + 0.02, zt), (x - 0.02, zt), (x - 0.045, zt + 0.08)], y - 0.012, y + 0.012,
             emissivo(lambda L, n, P: np.where((P[:, 0] < x)[:, None], hx('#d8dce0'), hx('#9a9ea6'))), mat_borda=liso('#c8ccd0'))
    cx((x - 0.026, x + 0.026, y - 0.026, y + 0.026, zt - 0.04, zt + 0.01), liso('#3a3a40'))


def _arco(xc, y, z0, z1, o=None):
    """O arco pendurado: a madeira curva (gomos no plano x-z, mais grossa no meio, o punho de couro) e a corda reta."""
    o = novo() if o is None else o
    n = 14
    zm, hz = (z0 + z1) / 2, (z1 - z0) / 2
    pts = []
    for i in range(n + 1):
        t = -1 + 2 * i / n
        pts.append((xc + 0.15 * (1 - t * t) - 0.03 * t * t, zm + hz * t))
    for i in range(n):
        (xa, za), (xb, zb) = pts[i], pts[i + 1]
        t = -1 + 2 * (i + 0.5) / n
        w = 0.034 if abs(t) < 0.2 else 0.026
        dx, dz = xb - xa, zb - za
        L = math.hypot(dx, dz)
        nx, nz = -dz / L * w / 2, dx / L * w / 2
        quad = [(xa + nx, za + nz), (xb + nx, zb + nz), (xb - nx, zb - nz), (xa - nx, za - nz)]
        cor = '#3a2416' if abs(t) < 0.2 else '#8a5428'
        placa_xz(quad, y - 0.014, y + 0.014, liso(cor), o=o)
    xs = pts[0][0] - 0.006
    cx((xs - 0.5 * PH, xs + 0.5 * PH, y - 0.004, y + 0.004, z0, z1), liso('#e8dcb8'), o=novo(contorno=False))


def rack_medieval():
    """
    O suporte de armas (2 x 1 casas, 1,9 m): os dois montantes de carvalho com os pés, a travessa de cima com os
    tarugos, a do meio onde as armas encostam e o cocho embaixo onde as pontas descansam. Duas espadas, dois machados
    (um barbado), a lança e o arco pendurado nos tarugos.
    """
    MT = {'*': mad2(CARV, eixo=1, seed=61, passo=0.04), 'cima': liso('#7a5232')}
    for x in (0.04, 1.37):
        cx((x, x + 0.09, 0.3, 0.42, 0.06, 1.9), MT)
        cx((x - 0.02, x + 0.11, 0.1, 0.62, 0.0, 0.07), {'*': mad2(CARV_E, seed=62, passo=0.03), 'cima': mad2('#6a4628', eixo=1, seed=63, passo=0.03)})
    TR = {'*': mad2(CARV, seed=64, passo=0.04), 'cima': mad2('#6e4a2c', seed=65, passo=0.03)}
    cx((0.04, 1.46, 0.29, 0.43, 1.78, 1.88), TR)
    cx((0.13, 1.37, 0.31, 0.41, 0.98, 1.05), TR)
    cx((0.13, 1.37, 0.28, 0.6, 0.07, 0.11), TR)
    cx((0.13, 1.37, 0.57, 0.6, 0.11, 0.18), TR)
    for x in (1.1, 1.36):
        cx((x - 0.015, x + 0.015, 0.43, 0.5, 1.8, 1.83), liso('#4a2e1a'))
    yv = 0.48
    _espada(0.26, yv, 0.11, 0.92)
    _machado(0.52, yv, 0.11, 1.22)
    _lanca(0.7, yv, 0.11, 1.44)
    _espada(0.9, yv, 0.11, 0.98, 0.075)
    _machado(1.27, yv - 0.02, 0.11, 1.12, barba=True)
    _arco(1.12, 0.52, 0.66, 1.8)
    peg(0.02, 1.48, 0.1, 0.62)


def armadura_medieval():
    """
    A armadura de placas (1 x 1, 1,9 m) num cavalete de madeira: as pernas (as grevas, as joelheiras, os sapatos), a
    saia de lâminas, o peito com a quilha, as ombreiras, os braços caídos com as manoplas, o elmo com a viseira e o
    penacho vermelho. O escudo (o de bico, pintado de vermelho com a faixa creme) encostado do lado direito.
    """
    x, y = 0.36, 0.38
    AC = '#9ea2a8'
    cx((0.1, 0.62, y - 0.035, y + 0.035, 0.0, 0.06), {'*': mad2(CARV, seed=71, passo=0.03), 'cima': liso('#7a5232')})
    cx((x - 0.035, x + 0.035, 0.12, 0.64, 0.0, 0.06), {'*': mad2(CARV, eixo=1, seed=72, passo=0.03), 'cima': liso('#7a5232')})
    cx((x - 0.025, x + 0.025, y - 0.025, y + 0.025, 0.06, 0.25), {'*': mad2(CARV, eixo=1, seed=73, passo=0.03), 'cima': liso('#7a5232')})

    def faixas_h(z0, passo):
        def f(P, b):
            zz = (P[:, 2] - z0) / PZ
            return np.where((np.floor(zz) % passo == 0)[:, None], _tom(b, 0.68), b)
        return f
    # as pernas
    for dx in (-0.075, 0.075):
        xx = x + dx
        cx((xx - 0.05, xx + 0.05, y - 0.04, y + 0.09, 0.06, 0.11), {'*': liso('#7e8288'), 'cima': liso('#a8acb2')})
        o = novo()
        _poligono_rodado(xx, y, [(0.11, 0.042), (0.3, 0.05), (0.45, 0.046)], vol(xx, y, AC, brilho=0.5), o, lados=12)
        o = novo()
        C().elipsoide(np.array([xx, y + 0.01, 0.5]), np.array([0.055, 0.055, 0.05]), liso('#b8bcc2'), o)
        o = novo()
        _poligono_rodado(xx, y, [(0.53, 0.05), (0.72, 0.058), (0.84, 0.062)], vol(xx, y, AC, brilho=0.5), o, lados=12)
    # a saia de lâminas e o peito
    o = novo()
    _poligono_rodado(x, y, [(0.8, 0.165), (0.86, 0.155), (0.92, 0.15), (0.99, 0.14), (1.03, 0.135)],
                     vol(x, y, '#8e9298', brilho=0.4, faixas=faixas_h(0.8, 3)), o, lados=16)

    def peito(L, n, P):
        out = np.tile(hx('#b4b8be'), (len(P), 1))
        dxl = P[:, 0] - x
        out = np.where(((np.abs(dxl) < 0.6 * PH) & (P[:, 1] > y))[:, None], hx('#e2e6ea'), out)
        out = np.where(((dxl > 0.6 * PH) & (dxl < 1.6 * PH) & (P[:, 1] > y))[:, None], hx('#8a8e94'), out)
        out = np.where((P[:, 2] < 1.07)[:, None], hx('#8a8e94'), out)
        return out
    o = novo()
    C().elipsoide(np.array([x, y, 1.2]), np.array([0.17, 0.12, 0.24]), emissivo(peito), o, brilho=0.25, corte_z=0.98)
    # o gorjal, as ombreiras e os braços com as manoplas
    o = novo()
    _poligono_rodado(x, y, [(1.38, 0.08), (1.44, 0.075), (1.5, 0.06)], vol(x, y, '#8e9298', brilho=0.4, faixas=faixas_h(1.38, 3)), o, lados=12)
    for s in (-1, 1):
        xa = x + s * 0.19
        o = novo()
        _poligono_rodado(xa, y, [(0.98, 0.034), (1.1, 0.04), (1.2, 0.042), (1.32, 0.046)], vol(xa, y, AC, brilho=0.5), o, lados=10)
        o = novo()
        C().elipsoide(np.array([xa, y, 0.95]), np.array([0.045, 0.05, 0.055]), liso('#6a6e74'), o)
        o = novo()
        C().elipsoide(np.array([x + s * 0.17, y, 1.36]), np.array([0.09, 0.1, 0.075]), liso('#a8acb2'), o, brilho=0.2)
    # o elmo: a cúpula, a viseira com a fresta, o penacho
    def elmo(L, n, P):
        out = np.tile(hx('#a8acb2'), (len(P), 1))
        fr = (np.abs(P[:, 2] - 1.62) < 0.012) & (P[:, 1] > y + 0.03)
        out = np.where(fr[:, None], hx('#16161a'), out)
        out = np.where(((P[:, 2] < 1.6) & (P[:, 1] > y))[:, None], hx('#8a8e94'), out)
        out = np.where(((np.abs(P[:, 0] - x) < 0.6 * PH) & (P[:, 2] > 1.64))[:, None], hx('#d8dce0'), out)
        return out
    o = novo()
    C().elipsoide(np.array([x, y, 1.62]), np.array([0.1, 0.11, 0.13]), emissivo(elmo), o, brilho=0.2, corte_z=1.5)
    o = novo()
    C().elipsoide(np.array([x, y - 0.03, 1.8]), np.array([0.03, 0.08, 0.08]), liso('#9a2a20'), o)
    # o escudo de bico encostado do lado direito (de pé no chão, de frente para +x)
    def pintura(L, n, P):
        Y, Z = P[:, 1], P[:, 2]
        out = np.tile(hx('#8e2a20'), (len(P), 1))
        out = np.where((np.abs(Y - 0.38) < 0.045)[:, None], hx('#e2d6b4'), out)
        out = np.where((np.abs(Z - 0.46) < 0.035)[:, None], hx('#e2d6b4'), out)
        return out
    esc = [(0.2, 0.62), (0.56, 0.62), (0.56, 0.36), (0.48, 0.16), (0.38, 0.05), (0.28, 0.16), (0.2, 0.36)]
    placa_yz(esc, 0.6, 0.63, emissivo(pintura), mat_borda=liso('#5a5c60'), mat_tras=mad2(CARV, eixo=1, seed=74))
    peg(0.1, 0.63, 0.12, 0.64)


def tina_agua():
    """
    A tina de têmpera (1 x 1, 0,7 m): as aduelas abrindo para cima, os dois aros de ferro, as duas orelhas mais
    altas com o furo, e em cima a borda (a ponta das aduelas), a parede de dentro do lado de lá e a água escura com o
    brilho.
    """
    x, y = 0.375, 0.375
    r0, r1, h = 0.27, 0.32, 0.62
    perfil = [(0.0, r0), (h, r1)]
    o = novo()
    _poligono_rodado(x, y, perfil, vol(x, y, '#6e4628', costuras=(14, '#3a2414', r1)), o, lados=26)
    hv, _ = BE.frente_tela()

    def topo(L, n, P):
        dx, dy = P[:, 0] - x, P[:, 1] - y
        rr = np.hypot(dx, dy)
        lado = -(dx * hv[0] + dy * hv[1]) / np.maximum(rr, 1e-6)
        out = np.tile(hx('#2e4652'), (len(P), 1))
        g = np.floor(P[:, 0] / PH) - np.floor(P[:, 1] / PH)
        gy = np.floor((P[:, 0] + P[:, 1]) / (2 * PH))
        br = (gy % 5 == 0) & (np.floor((P[:, 0] - P[:, 1]) / (3 * PH)) % 4 == ruido(gy, 3.0).round() * 2) & (rr < r1 - 0.09)
        out = np.where(br[:, None], hx('#6a8a96'), out)
        par = rr > r1 - 0.035 - 0.07 * np.clip(lado, 0, 1)
        out = np.where(par[:, None], np.where((lado > 0.1)[:, None], hx('#5a3a22'), hx('#3e2616')), out)
        out = np.where((rr > r1 - 0.03)[:, None], hx('#9a6a40'), out)
        th = np.arctan2(dy, dx)
        k = np.floor(((th / (2 * math.pi)) * 14 + 14) % 14)
        out = np.where(((rr > r1 - 0.03) & (k % 2 == 0))[:, None], hx('#8a5c36'), out)
        return out
    _disco(x, y, h, r1, emissivo(topo), o, lados=26)
    for (a, b) in ((0.08, 0.13), (h - 0.14, h - 0.09)):
        o2 = novo()
        ra, rb = r0 + (r1 - r0) * a / h + 0.01, r0 + (r1 - r0) * b / h + 0.01

        def aro(P, base, b=b):
            return np.where((P[:, 2] > b - PZ)[:, None], hx('#6a6c74'), base)
        C().cilindro(x, y, ra, a, b, vol(x, y, FERRO, brilho=0.5, faixas=aro), M, o2, lados=26, tampa=False, r1=rb)
    # as orelhas (duas aduelas mais altas, nos lados x, com o furo de pegar)
    for s in (-1, 1):
        xo = x + s * (r1 - 0.015)
        OR = emissivo(lambda L, n, P: np.where((np.abs(P[:, 2] - (h + 0.06)) < 0.018)[:, None] & (np.abs(P[:, 1] - y) < 0.022)[:, None],
                                               hx('#1e1410'), hx('#6e4628')))
        cx((xo - 0.02, xo + 0.02, y - 0.05, y + 0.05, h - 0.02, h + 0.1), {'*': OR, 'cima': liso('#9a6a40')})
    peg(x - r1, x + r1, y - r1, y + r1)


# =====================================================================================================================
# a taverna: a mesa, o banco, o balcão, o barril
# =====================================================================================================================
def mesa_rustica():
    """
    A mesa rústica (3 x 2 casas, o tampo a 0,8 m, vazada): o tampo grosso de três tábuas largas ao comprido, com
    as pontas aparentes; a saia recuada; as quatro pernas quadradas e grossas nas quinas. Nada embaixo (o banco e a
    cadeira encaixam, a peça passa abaixada). Vazia e limpa.
    """
    x0, x1, y0, y1 = 0.04, 2.21, 0.06, 1.44
    h, tp = 0.8, 0.09
    cx((x0, x1, y0, y1, h - tp, h), {'cima': tab2(CARV_T, (y1 - y0) / 3, CARV_TJ, eixo=0, seed=81, org=y0),
                                     'esq': BE._ponta_tabuas('#5e3c22', (y1 - y0) / 3, y0, CARV_TJ),
                                     'dir': BE._ponta_tabuas('#5e3c22', (y1 - y0) / 3, y0, CARV_TJ),
                                     '*': _pau('#5e3c22', quina=1.2, b=(0, 0, 0, 0, h - tp, h))})
    m = 0.13
    cx((x0 + m, x1 - m, y0 + m, y1 - m, h - tp - 0.1, h - tp), mad2(CARV_E, seed=82, passo=0.05))
    p = 0.12
    for (a, b) in ((x0 + 0.06, y0 + 0.06), (x1 - 0.06 - p, y0 + 0.06), (x0 + 0.06, y1 - 0.06 - p), (x1 - 0.06 - p, y1 - 0.06 - p)):
        cx((a, a + p, b, b + p, 0.0, h - tp), {'*': mad2(CARV, eixo=1, seed=83, passo=0.04), 'cima': liso('#6e4a2c')}, ch=0.012)
    peg(x0, x1, y0, y1)


def banco_rustico():
    """O banco de tábua (2 x 1, o assento a 0,45 m): a tábua grossa e as quatro pernas redondas abertas, presas por cunha."""
    x0, x1, y0, y1 = 0.06, 1.44, 0.2, 0.56
    h, tp = 0.45, 0.07
    cx((x0, x1, y0, y1, h - tp, h), {'cima': tab2(CARV_T, (y1 - y0) / 2, CARV_TJ, eixo=0, seed=91, org=y0),
                                     'esq': BE._ponta_tabuas('#5e3c22', (y1 - y0) / 2, y0, CARV_TJ),
                                     'dir': BE._ponta_tabuas('#5e3c22', (y1 - y0) / 2, y0, CARV_TJ),
                                     '*': _pau('#5e3c22', quina=1.2, b=(0, 0, 0, 0, h - tp, h))})
    PE = {'*': mad2(CARV, eixo=1, seed=92, passo=0.03)}
    for (a, sa) in ((0.24, -1), (1.26, 1)):
        for (b, sb) in ((0.29, -1), (0.47, 1)):
            pau((a + sa * 0.08, b + sb * 0.07, 0.0), (a, b, h - tp + 0.005), 0.05, PE['*'])
            # a ponta da perna aparecendo no tampo (a cunha)
            cx((a - 0.02, a + 0.02, b - 0.02, b + 0.02, h, h + 0.004), liso('#3a2414'), o=novo(contorno=False))
    peg(x0, x1, y0, y1)


def balcao_taverna():
    """
    O balcão da taverna (4 x 1 casas, o tampo a 1,05 m): as tábuas grossas em pé na frente, as duas travessas e os
    cravos de ferro, o rodapé recuado, o tampo de carvalho escuro saindo para a frente. Em cima, três canecas de
    estanho e a jarra; atrás (o lado do taverneiro), a prateleira com as canecas emborcadas. Pontas retas: emenda.
    """
    x0, x1 = 0.0, 3.0
    y0, y1 = 0.1, 0.58
    h, tp = 1.05, 0.08
    cx((x0, x1, y0 + 0.03, y1 - 0.04, 0.0, 0.1), mad2('#2e1a0e', seed=101, passo=0.04))
    FR = tab2(['#4e3020', '#4a2c1c', '#543422'], 0.15, '#22140a', eixo=1, seed=102, org=0.0)
    cx((x0, x1, y0, y1, 0.1, h - tp), {'frente': FR, 'costas': tab2(['#4e3020', '#4a2c1c'], 0.15, '#22140a', eixo=1, seed=103),
                                       '*': mad2('#4a2e1e', eixo=1, seed=104, passo=0.05)})
    for (za, zb) in ((0.2, 0.28), (h - tp - 0.14, h - tp - 0.06)):
        cx((x0, x1, y1, y1 + 0.025, za, zb), _pau('#3e2416', quina=1.22, b=(0, 0, 0, 0, za, zb)))
        for xx in np.arange(0.075, x1, 0.15):
            cx((xx - PH, xx + PH, y1 + 0.025, y1 + 0.03, (za + zb) / 2 - PZ, (za + zb) / 2 + PZ), liso('#1e1a18'), o=novo(contorno=False))
    cx((x0, x1, 0.03, 0.72, h - tp, h), {'cima': tab2(['#5e3a22', '#583620', '#643e24'], 0.23, '#24140a', eixo=0, seed=105, comp=1.5, org=0.03),
                                         '*': _pau('#4a2c1a', quina=1.25, b=(0, 0, 0, 0, h - tp, h))})
    # em cima: as canecas e a jarra
    for (xx, yy) in ((0.42, 0.42), (0.6, 0.5), (2.35, 0.4)):
        caneca(xx, yy, h)
    jarra(1.55, 0.4, h)
    # atrás: a prateleira com as canecas emborcadas
    zp = 0.62
    cx((x0 + 0.05, x1 - 0.05, 0.02, y0, zp - 0.04, zp), _pau('#4a2c1a', quina=1.2, b=(0, 0, 0, 0, zp - 0.04, zp)))
    for xx in (0.3, 0.42, 0.54, 1.9, 2.02, 2.6):
        caneca(xx, 0.06, zp, h=0.11, r=0.036, emborcada=True)
    peg(x0, x1, 0.03, 0.72)


def barril_madeira():
    """
    O barril de aduelas (1 x 1, 1,0 m): a barriga, as aduelas com a risca entre elas, os quatro aros de ferro (dois
    pares) com o rebite, a tampa de tábuas com o batoque, e a torneira de madeira na frente, embaixo.
    """
    x, y, r, h = 0.375, 0.375, 0.3, 1.0
    perfil = [(0.0, r * 0.86), (h * 0.2, r * 0.96), (h * 0.5, r), (h * 0.8, r * 0.96), (h, r * 0.86)]
    aros = ((0.05, 0.09), (0.15, 0.19), (h - 0.19, h - 0.15), (h - 0.09, h - 0.05))

    def rr_em(z):
        zs, rs = zip(*perfil)
        return float(np.interp(z, zs, rs))

    def aduela(P, base):
        th = np.arctan2(P[:, 1] - y, P[:, 0] - x)
        k = np.floor(((th / (2 * math.pi)) * 16 + 16) % 16)
        base = np.where((k % 2 == 0)[:, None], _tom(base, 1.05), base)
        zz = P[:, 2]
        for (a, b) in aros:
            base = np.where(((zz < a) & (zz >= a - PZ))[:, None], _tom(base, 0.7), base)
        return base
    o = novo()
    _poligono_rodado(x, y, perfil, vol(x, y, '#7a4a2a', faixas=aduela, costuras=(16, '#3a2014', r)), o, lados=28)

    def tampa(L, n, P):
        dx, dy = P[:, 0] - x, P[:, 1] - y
        rr = np.hypot(dx, dy)
        ri = r * 0.86 - 0.04
        larg = 4 * PH
        fila = np.floor((dy + 0.4) / larg)
        g = (dy + 0.4) - fila * larg
        cores = np.stack([hx('#a87444'), hx('#9c6a3e'), hx('#b07c4a')])
        out = cores[(fila % 3).astype(int)]
        out = np.where((g >= larg - PH)[:, None], _tom(out, 0.9), out)
        out = np.where((g < PH)[:, None], hx('#4a2a16'), out)
        out = np.where((rr > ri)[:, None], hx('#7a4a2a'), out)
        out = np.where(((rr > ri - 0.02) & (rr <= ri) & (dy < 0.02))[:, None], _tom(out, 0.8), out)
        bat = np.hypot(dx - 0.08, dy + 0.06) < 0.035
        out = np.where(bat[:, None], hx('#5a3a22'), out)
        out = np.where((bat & (np.hypot(dx - 0.08, dy + 0.06) > 0.025))[:, None], hx('#3a2414'), out)
        return out
    _disco(x, y, h, r * 0.86, emissivo(tampa), o, lados=28)
    for (a, b) in aros:
        o2 = novo()

        def fer(P, base, a=a, b=b):
            zz = P[:, 2]
            base = np.where((zz > b - PZ)[:, None], hx('#7a7e88'), base)
            th = np.arctan2(P[:, 1] - y, P[:, 0] - x)
            reb = ((((th / (2 * math.pi)) * 8 + 8.25) % 1) < 0.04) & (zz > a + PZ) & (zz <= a + 2 * PZ)
            return np.where(reb[:, None], hx('#a8acb4'), base)
        C().cilindro(x, y, rr_em(a) + 0.01, a, b, vol(x, y, '#3a3c44', brilho=0.5, faixas=fer), M, o2, lados=28, tampa=False,
                     r1=rr_em(b) + 0.01)
    # a torneira de madeira (o cano saindo da frente e a chave em cima)
    zt = 0.26
    yb = y + rr_em(zt)
    cx((x - 0.035, x + 0.035, yb - 0.02, yb + 0.09, zt - 0.035, zt + 0.035), {'*': liso('#b88a52'), 'cima': liso('#d8a868')})
    cx((x - 0.025, x + 0.025, yb + 0.06, yb + 0.09, zt - 0.08, zt - 0.03), liso('#9a6a3c'))
    cx((x - 0.012, x + 0.012, yb + 0.015, yb + 0.04, zt + 0.025, zt + 0.07), {'*': liso('#8a5a32'), 'cima': liso('#c08a54')})
    cx((x - 0.04, x + 0.04, yb + 0.015, yb + 0.04, zt + 0.06, zt + 0.08), {'*': liso('#8a5a32'), 'cima': liso('#c08a54')})
    peg(x - r, x + r, y - r, y + r)


# =====================================================================================================================
# a lareira
# =====================================================================================================================
def lareira(acesa=True, cristais=False):
    """
    A lareira de pedra (3 x 1 casas, encostada na parede de trás, 2,0 m): o chão de lajes saindo para a frente, os
    dois batentes de pedra aparelhada, a fornalha escura com a fuligem, a verga de pedra e a viga do console de
    carvalho (com a jarrinha e o castiçal), a coifa subindo e sumindo nos últimos 40 cm. Dentro: os dois cães de
    ferro com a lenha, a cremalheira com a corrente e o caldeirão preto pendurado. Acesa: o fogo em três camadas
    lambendo o caldeirão, a brasa na lenha e a luz laranja na fornalha e no chão. Apagada ('1'): a lenha preta e a cinza.
    """
    FX0, FX1 = 0.62, 1.63            # a boca da fornalha
    YF = 0.6                         # a frente dos batentes
    ZV = 0.98                        # o alto da boca (a verga começa aqui)
    cxf = (FX0 + FX1) / 2

    def perto(P):
        d = np.hypot((P[:, 0] - cxf) / 0.7, (P[:, 1] - 0.36) / 0.8)
        return np.clip(1.15 - d, 0, 1) * np.clip(1.2 - P[:, 2] / 0.7, 0, 1)
    T = (_brilho_fogo(perto, 0.5, '#d8402a') if cristais else _brilho_fogo(perto, 0.5)) if acesa else None

    def fuligem(L, n, P, out):
        k = np.clip((P[:, 2] - 0.15) / 0.8, 0, 1)
        out = out * (1 - 0.55 * np.round(k * 3)[:, None] / 3) + np.array([14.0, 10.0, 10.0]) * 0.55 * np.round(k * 3)[:, None] / 3
        return T(L, n, P, out) if T is not None else out
    # o chão de lajes (sai 12 cm para a frente) e o fundo da fornalha
    cx((0.04, 2.21, 0.0, 0.73, 0.0, 0.05), {'cima': lajes('#8a8278', 0.26, 0.18, seed=111, tinge=T), '*': cantaria('#6e675e', 3, 12, seed=112)})
    PD = cantaria('#8e867a', 7, 12, seed=113)
    for (a, b) in ((0.12, FX0), (FX1, 2.13)):
        cx((a, b, 0.0, YF, 0.05, ZV), {'*': PD, 'cima': liso('#8e867a')})
    # a fornalha: o fundo e os lados de dentro (pintados por cima dos batentes) com a fuligem
    FU = cantaria('#5e574e', 5, 9, seed=114, tinge=fuligem)
    cx((FX0, FX1, 0.0, 0.1, 0.05, ZV), {'*': FU, 'costas': PD})
    for (a, b, nn) in ((FX0, FX0 + 0.004, 'dir'), (FX1 - 0.004, FX1, 'esq')):
        cx((a, b, 0.1, YF, 0.05, ZV), {nn: FU, '*': None})
    cx((FX0, FX1, 0.1, YF, 0.05, 0.055), {'cima': emissivo(lambda L, n, P: fuligem(L, n, P, np.tile(hx('#4a443e'), (len(P), 1)))),
                                          '*': None}, o=novo(contorno=False))
    # a verga de pedra e o console de carvalho (com o que fica em cima)
    cx((0.12, 2.13, 0.0, YF, ZV, 1.14), {'*': cantaria('#8e867a', 8, 18, seed=115), 'cima': liso('#8e867a')})
    cx((0.06, 2.19, 0.0, 0.7, 1.14, 1.26), {'cima': tab2(['#5e3a22', '#583620'], 0.35, CARV_TJ, eixo=0, seed=116, org=0.0),
                                            '*': mad2('#4a2c1a', seed=117, passo=0.04)})
    jarra(0.42, 0.42, 1.26, h=0.2, r=0.06)
    o = novo()
    _poligono_rodado(1.86, 0.4, [(1.26, 0.06), (1.28, 0.055), (1.29, 0.02), (1.42, 0.016), (1.44, 0.03)], vol(1.86, 0.4, ESTANHO, brilho=0.4), o,
                     lados=12, tampa_mat=liso('#b0b2ac'))
    o = novo()
    C().cilindro(1.86, 0.4, 0.018, 1.44, 1.56, _pau('#eadcbc', quina=False), M, o, lados=10, tampa_mat=liso('#f8f0dc'))
    # a coifa: sobe inteira até 2,0 m e fecha numa cornija de pedra (o Felipe, 14/10: sumindo em transparência ela
    # parecia um fantasma)
    cx((0.3, 1.95, 0.0, 0.46, 1.26, 1.9), {'*': cantaria('#867e72', 7, 12, seed=118), 'cima': liso('#867e72')})
    cx((0.24, 2.01, 0.0, 0.52, 1.9, 2.0), {'*': cantaria('#7a7368', 4, 18, seed=119), 'cima': liso('#8e867a')})
    # os cães de ferro e a lenha
    for xx in (cxf - 0.28, cxf + 0.28):
        cx((xx - 0.02, xx + 0.02, 0.18, 0.5, 0.05, 0.09), ferro('#2a2624', '#4a4440'))
        cx((xx - 0.02, xx + 0.02, 0.46, 0.5, 0.05, 0.22), ferro('#2a2624', '#4a4440'))
    if cristais:
        # Santo Berço: no lugar da lenha, os cristais vermelhos entre os cães de ferro
        monte_cristais(cxf, 0.32, 0.05, 0.22, 0.12, n=5, aceso=acesa, seed=1.0, alto=0.24)
    else:
        tora(cxf - 0.04, 0.3, 0.13, 0.7, 0.05, 0, acesa, seed=1)
        tora(cxf + 0.03, 0.4, 0.13, 0.66, 0.048, 4, acesa, seed=2)
        tora(cxf, 0.34, 0.21, 0.55, 0.045, -6, acesa, seed=3)
    if not acesa and not cristais:
        ms = [OC.Mancha(cxf, 0.34, 0.3, seed=7, amp=0.12, ex=1.4, ey=0.7)]
        OC.manchas_decal(ms, OC.mat_mancha(ms, ['#6a645e', '#8a847c', '#9e978e'], beira=1.5, miolo=3), z=0.056)
    # a cremalheira: a barra presa no fundo, o gancho, a corrente e o caldeirão
    yc = 0.33
    cx((cxf - 0.015, cxf + 0.015, 0.06, yc + 0.015, ZV - 0.06, ZV - 0.03), ferro('#24201e', '#4a4440'))
    for k in range(6):
        z = ZV - 0.06 - 0.045 * (k + 1)
        w = 0.012 if k % 2 == 0 else 0.006
        cx((cxf - w, cxf + w, yc - 0.012 + (0.006 if k % 2 else 0), yc + 0.012 - (0.006 if k % 2 else 0), z, z + 0.04),
           ferro('#24201e', '#4a4440'))
    zc0, zc1 = 0.36, 0.62
    perfil = [(zc0, 0.08), (zc0 + 0.04, 0.15), (zc0 + 0.13, 0.19), (zc0 + 0.21, 0.175), (zc1 - 0.02, 0.15), (zc1, 0.16)]
    o = novo()
    _poligono_rodado(cxf, yc, perfil, vol(cxf, yc, '#2e2c2c', brilho=0.3), o, lados=18)

    def boca(L, n, P):
        rr = np.hypot(P[:, 0] - cxf, P[:, 1] - yc)
        return np.where((rr > 0.16 - 0.02)[:, None], hx('#4a4644'), hx('#1a1614'))
    _disco(cxf, yc, zc1, 0.16, emissivo(boca), o, lados=18)
    ob = novo()
    _fita([(-0.15, zc1), (-0.12, zc1 + 0.1), (0.0, zc1 + 0.15), (0.12, zc1 + 0.1), (0.15, zc1)], cxf, yc, liso('#3a3634'), ob, 0.014)
    if acesa and not cristais:
        fogo(cxf, 0.36, larg=0.5, alto=0.5, z0=0.1, frente=0.05)
    peg(0.04, 2.21, 0.0, 0.73)


# =====================================================================================================================
# o quarto: a cama de palha e o baú
# =====================================================================================================================
def palhoca():
    """O saco de pano do colchão de palha: o linho cru com a trama, os calombos (manchas em degraus) e a costura."""
    c0 = hx('#c8b48a')

    def f(L, n, P):
        X, Y, Z = P[:, 0], P[:, 1], P[:, 2]
        out = np.tile(c0, (len(P), 1))
        if n[2] > 0.6:
            s = suave(np.floor(X / (2 * PH)) * 2 * PH, np.floor(Y / (2 * PH)) * 2 * PH, 0.16, 11)
            out = np.where((s > 0.62)[:, None], _tom(c0, 1.06), out)
            out = np.where((s < 0.34)[:, None], _tom(c0, 0.9), out)
            # as costuras de amarrar (os pontinhos em fila, 2 px)
            gy = np.floor(Y / PH) % 18
            gx = np.floor(X / PH) % 14
            out = np.where(((gy == 9) & (gx < 2))[:, None], hx('#8a7650'), out)
        else:
            out = np.where((np.floor(Z / PZ) % 4 == 0)[:, None], _tom(c0, 0.92), out)
        return out
    return emissivo(f)


def manta(cor=LA_VERM):
    """A manta de lã grossa: a trama em riscas de 2 px, as duas listras creme perto da ponta e as dobras."""
    c0 = hx(cor)

    def f(L, n, P):
        X, Y, Z = P[:, 0], P[:, 1], P[:, 2]
        top = n[2] > 0.6
        b = Y / PH if (top or abs(n[0]) > 0.5) else -Z / PZ
        a = X / PH if (top or abs(n[1]) > 0.5) else Y / PH
        out = np.tile(c0, (len(P), 1))
        out = np.where((np.floor(a / 2) % 2 == 0)[:, None], _tom(c0, 0.94), out)
        yy = Y / PH
        for (y0, y1) in ((80, 84), (87, 89)):
            out = np.where(((yy >= y0) & (yy < y1))[:, None], hx('#d8c8a0'), out)
        if top:
            for (yf, ph) in ((1.2, 0.0), (1.7, 1.9)):
                w = Y - yf - 0.03 * np.sin(X * 6 + ph)
                q = np.sin(X * 4.1 + ph) > -0.4
                out = np.where(((w >= 0) & (w < PH) & q)[:, None], _tom(out, 0.78), out)
                out = np.where(((w >= PH) & (w < 2 * PH) & q)[:, None], _tom(out, 1.1), out)
        return out
    return emissivo(f)


def cama_palha():
    """
    A cama de palha (2 x 3 casas, a manta a 0,55 m): os quatro postes de carvalho (os da cabeceira mais altos), a
    cabeceira de tábuas, as laterais e o pé do estrado, o colchão de saco de linho cheio de palha (com os fiapos
    saindo), o travesseiro de linho e a manta de lã vermelha com as listras creme, cobrindo do meio para o pé.
    """
    x0, x1, y0, y1 = 0.05, 1.45, 0.03, 2.22
    p = 0.09
    PO = {'*': mad2(CARV, eixo=1, seed=121, passo=0.04), 'cima': liso('#7a5232')}
    for (xx, yy, z) in ((x0, y0, 0.92), (x1 - p, y0, 0.92), (x0, y1 - p, 0.5), (x1 - p, y1 - p, 0.5)):
        cx((xx, xx + p, yy, yy + p, 0.0, z), PO, ch=0.012)
    CAB = tab2(CARV_T, 0.15, CARV_TJ, eixo=0, seed=122, org=0.36)
    cx((x0 + p, x1 - p, y0 + 0.02, y0 + 0.07, 0.36, 0.82), {'frente': CAB, 'costas': CAB, 'cima': liso('#7a5232'), '*': mad2(CARV, seed=123)})
    cx((x0 + p, x1 - p, y0 + 0.01, y0 + 0.08, 0.82, 0.87), _pau('#5e3c22', quina=1.22, b=(0, 0, 0, 0, 0.82, 0.87)))
    LAT = {'*': mad2(CARV, seed=124, passo=0.04), 'cima': liso('#7a5232')}
    for xx in (x0, x1 - 0.06):
        cx((xx, xx + 0.06, y0 + p, y1 - p, 0.16, 0.32), {'*': mad2(CARV, eixo=0, seed=125, passo=0.04), 'cima': liso('#7a5232')})
    cx((x0 + p, x1 - p, y1 - 0.07, y1 - 0.01, 0.16, 0.36), LAT)
    # o colchão de palha, os fiapos, o travesseiro
    _p1_malha((x0 + 0.06, x1 - 0.06, y0 + 0.08, y1 - 0.07, 0.28, 0.5), (0.07, 0.07, 0.03, 0.07), palhoca(), seg=2)
    for k in range(14):
        a = ruido(k, 1.0)
        if k % 2 == 0:
            xx, yy = x0 + 0.07 + a * (x1 - x0 - 0.14), (y1 - 0.06 if k % 4 == 0 else y0 + 0.08)
        else:
            xx, yy = (x0 + 0.06 if k % 4 == 1 else x1 - 0.06), y0 + 0.5 + a * (y1 - y0 - 0.7)
        zz = 0.33 + 0.1 * ruido(k, 2.0)
        cor = PALHA if k % 3 else '#a8873f'
        pau((xx - 0.03, yy - 0.01, zz), (xx + 0.04, yy + 0.02, zz + 0.03), 0.012, liso(cor), o=novo(contorno=False))
    _p1_malha((x0 + 0.2, x1 - 0.2, y0 + 0.12, y0 + 0.46, 0.46, 0.58), (0.08, 0.08, 0.04, 0.07), BE.liso('#d8c8a4') if False else
              emissivo(lambda L, n, P: np.tile(hx('#dccca8'), (len(P), 1))), seg=2)
    _p1_malha((x0 + 0.03, x1 - 0.03, y0 + 0.78, y1 - 0.04, 0.3, 0.55), (0.05, 0.05, 0.015, 0.06), manta(), seg=2)
    _p1_malha((x0 + 0.04, x1 - 0.04, y0 + 0.74, y0 + 0.9, 0.5, 0.565), (0.03, 0.04, 0.02, 0.03), manta('#8a3a2c'), seg=2)
    peg(x0, x1, y0, y1)


def bau_madeira(aberto=False):
    """
    O baú de madeira (1 x 1, a tampa a 0,6 m): o corpo de tábuas deitadas com os pezinhos, a tampa reta e grossa,
    as duas cintas de ferro dando a volta (frente, tampa e costas), as cantoneiras, o espelho da fechadura com a
    aldraba e as alças de argola nos lados. Aberto: a tampa em pé atrás (as cintas na face de fora, o forro de lã
    vermelha por dentro), o corpo vazado com o forro de lã, as moedas, um pano dobrado e uma adaga.
    """
    x0, x1, y0, y1 = 0.08, 0.67, 0.16, 0.6
    zb, zt = 0.42, 0.6
    for (a, b) in ((x0 + 0.02, y0 + 0.02), (x1 - 0.07, y0 + 0.02), (x0 + 0.02, y1 - 0.07), (x1 - 0.07, y1 - 0.07)):
        cx((a, a + 0.05, b, b + 0.05, 0.0, 0.04), {'*': liso('#3a2414'), 'cima': liso('#5a3a22')})
    TB = tab2(['#5e3c22', '#583820', '#643f24'], 0.127, CARV_TJ, eixo=0, seed=131, org=0.04)
    LA = manta('#8a2a22')
    if not aberto:
        cx((x0, x1, y0, y1, 0.04, zb), {'frente': TB, 'costas': TB, 'esq': TB, 'dir': TB, 'cima': liso('#3a2414')})
        cx((x0 - 0.02, x1 + 0.02, y0 - 0.02, y1 + 0.025, zb, zt), {'cima': tab2(['#7a5232', '#74502f'], 0.11, CARV_TJ, eixo=0, seed=132, org=y0),
                                                                      '*': mad2('#5e3c22', seed=133, passo=0.04)})
    else:
        e = 0.035
        TC = {'cima': tab2(['#6a4428', '#664226'], 0.11, CARV_TJ, eixo=0, seed=134, org=y0)}
        cx((x0, x1, y0, y0 + e, 0.04, zb), {'*': TB, 'frente': LA, 'cima': TC['cima']})
        cx((x0, x1, y1 - e, y1, 0.04, zb), {'*': TB, 'costas': LA, 'cima': TC['cima']})
        cx((x0, x0 + e, y0, y1, 0.04, zb), {'*': TB, 'dir': LA, 'cima': TC['cima']})
        cx((x1 - e, x1, y0, y1, 0.04, zb), {'*': TB, 'esq': LA, 'cima': TC['cima']})
        cx((x0 + e, x1 - e, y0 + e, y1 - e, 0.04, zb - 0.055), {'cima': LA, '*': LA})
        # o monte de lã fofa por baixo do conteúdo, o pano dobrado, as moedas e a adaga
        _p1_malha((x0 + e + 0.005, x1 - e - 0.005, y0 + e + 0.005, y1 - e - 0.005, zb - 0.07, zb - 0.03), (0.04, 0.04, 0.02, 0.03), LA, seg=2)
        _p1_malha((x0 + 0.07, x0 + 0.25, y0 + 0.25, y0 + 0.4, zb - 0.045, zb + 0.01), (0.03, 0.03, 0.02, 0.025),
                  emissivo(lambda L, n, P: np.tile(hx('#d8cdb0'), (len(P), 1))), seg=2)
        OURO, OURO_T = liso('#d8a826'), liso('#f6dc6a')
        for (mx, my, n) in ((0.5, 0.25, 4), (0.58, 0.33, 3), (0.5, 0.47, 2), (0.36, 0.52, 2), (0.57, 0.42, 1)):
            for k in range(n):
                C().cilindro(mx, my, 0.032, zb - 0.045 + 0.011 * k, zb - 0.034 + 0.011 * k, OURO, M, novo(), lados=8, tampa_mat=OURO_T)
        # a adaga deitada: a lâmina clara, a guarda, o cabo de couro e o pomo
        cx((x0 + 0.1, x0 + 0.3, y0 + 0.18, y0 + 0.21, zb - 0.045, zb - 0.03), {'cima': liso('#d4dadc'), '*': liso('#8a9094')})
        cx((x0 + 0.3, x0 + 0.325, y0 + 0.165, y0 + 0.225, zb - 0.045, zb - 0.025), liso('#a8823a'))
        cx((x0 + 0.325, x0 + 0.4, y0 + 0.18, y0 + 0.21, zb - 0.045, zb - 0.028), {'cima': liso('#5a3420'), '*': liso('#3a2014')})
        cx((x0 + 0.4, x0 + 0.42, y0 + 0.17, y0 + 0.22, zb - 0.045, zb - 0.024), liso('#c8a040'))
    FE = ferro('#2e2a28', '#5a524c')
    for xa in (x0 + 0.08, x1 - 0.12):
        cx((xa, xa + 0.04, y1, y1 + 0.012, 0.04, zb), FE)
        if not aberto:
            cx((xa, xa + 0.04, y1 + 0.015, y1 + 0.027, zb, zt), FE)
        if not aberto:
            cx((xa, xa + 0.04, y0 - 0.025, y1 + 0.027, zt, zt + 0.008), FE)
            cx((xa, xa + 0.04, y0 - 0.024, y0 - 0.012, zb, zt), FE)
        cx((xa, xa + 0.04, y0 - 0.012, y0, 0.04, zb), FE)
    # as cantoneiras em pé nas quatro quinas (a chapa dobrada em L)
    for (xa, ya, sx, sy) in ((x0, y1, 1, -1), (x1, y1, -1, -1), (x0, y0, 1, 1), (x1, y0, -1, 1)):
        e = 0.012
        cx((min(xa, xa + sx * 0.06), max(xa, xa + sx * 0.06), min(ya, ya - sy * e), max(ya, ya - sy * e), 0.04, zb), FE)
        cx((min(xa, xa - sx * e), max(xa, xa - sx * e), min(ya, ya + sy * 0.06), max(ya, ya + sy * 0.06), 0.04, zb), FE)
    if not aberto:
        cx((x0 - 0.004, x1 + 0.004, y0 - 0.004, y1 + 0.004, zb - 0.012, zb), liso('#1e140c'), o=novo(contorno=False))
    # a fechadura: o espelho com o buraco e a aldraba descendo da tampa
    xm = (x0 + x1) / 2

    def esp(L, n, P):
        out = np.tile(hx('#a8823a'), (len(P), 1))
        if n[1] > 0.5:
            fur = (np.abs(P[:, 0] - xm) < 0.6 * PH) & (P[:, 2] > zb - 0.09) & (P[:, 2] < zb - 0.05)
            out = np.where(fur[:, None], hx('#0e0c0a'), out)
            out = np.where((P[:, 2] > zb - 0.015 - PZ)[:, None], hx('#d8b060'), out)
        return out
    cx((xm - 0.05, xm + 0.05, y1, y1 + 0.014, zb - 0.12, zb - 0.015), {'*': emissivo(esp)})
    if not aberto:
        cx((xm - 0.018, xm + 0.018, y1 + 0.015, y1 + 0.03, zb - 0.06, zt - 0.02), FE)
    else:
        # a tampa em pé atrás: a face de fora (tábuas, cintas) para trás, o forro de lã para a frente; as dobradiças
        yt1, yt0 = y0 - 0.02, y0 - 0.12
        alt = (y1 - y0) + 0.045
        cx((x0 - 0.02, x1 + 0.02, yt0, yt1, zb, zb + alt),
           {'frente': LA, 'costas': mad2('#5e3c22', eixo=0, seed=135, passo=0.04), 'cima': liso('#4a2e1a'), '*': mad2('#5e3c22', seed=133, passo=0.04)})
        for xa in (x0 + 0.08, x1 - 0.12):
            cx((xa, xa + 0.04, yt0 - 0.012, yt0, zb, zb + alt), FE)
            cx((xa, xa + 0.04, yt0 - 0.012, yt1 + 0.0, zb + alt - 0.008, zb + alt), FE)
            cx((xa, xa + 0.04, yt1 - 0.04, yt1 + 0.012, zb - 0.02, zb + 0.07), FE)
        cx((xm - 0.045, xm + 0.045, yt0 - 0.014, yt0, zb + alt - 0.14, zb + alt - 0.04), {'*': emissivo(esp)})
    # as alças de argola nos lados
    for (xs, s) in ((x0 - 0.01, -1), (x1 + 0.01, 1)):
        cx((min(xs, xs + s * 0.012), max(xs, xs + s * 0.012), 0.34, 0.42, 0.3, 0.32), FE)
        cx((min(xs, xs + s * 0.012), max(xs, xs + s * 0.012), 0.34, 0.352, 0.24, 0.32), FE)
        cx((min(xs, xs + s * 0.012), max(xs, xs + s * 0.012), 0.408, 0.42, 0.24, 0.32), FE)
        cx((min(xs, xs + s * 0.012), max(xs, xs + s * 0.012), 0.34, 0.42, 0.24, 0.252), FE)
    peg(x0, x1, y0, y1)


# =====================================================================================================================
# a escotilha e a escada em caracol
# =====================================================================================================================
def _chapa_ferro(cor='#4a4a50', seed=0, rebites=None):
    """A chapa de ferro: o cinza-azulado com as manchas de ferrugem (blocos de 2 px) e os rebites (2 x 2, claro em cima)."""
    c0 = hx(cor)

    def f(L, n, P):
        X, Y = P[:, 0], P[:, 1]
        out = np.tile(c0, (len(P), 1))
        s = suave(np.floor(X / (2 * PH)) * 2 * PH, np.floor(Y / (2 * PH)) * 2 * PH, 0.08, seed)
        out = np.where((s > 0.7)[:, None], hx('#6a4a36'), out)
        out = np.where((s < 0.25)[:, None], _tom(c0, 0.88), out)
        if rebites is not None and n[2] > 0.5:
            for (rx, ry) in rebites:
                d = np.maximum(np.abs(X - rx) / PH, np.abs(Y - ry) / PH)
                out = np.where((d < 1.0)[:, None], hx('#7a7a80'), out)
                out = np.where(((d < 1.0) & (X - rx + Y - ry > 0))[:, None], hx('#2a2a2e'), out)
        return out
    return emissivo(f)


def escotilha(estado):
    """A escotilha pesada no estado (0 aberta, 1 fechada, 2 trancada)."""
    def d():
        A0, A1 = 0.14, 0.61                  # o buraco
        FE = {'cima': _chapa_ferro('#3e3e44', 3), '*': liso('#2a2a2e')}
        FEy = FE
        # o aro de ferro rente ao chão
        for b in ((0.06, 0.69, 0.06, A0), (0.06, 0.69, A1, 0.69), (0.06, A0, A0, A1), (A1, 0.69, A0, A1)):
            cx(b + (0.0, 0.025), FEy)
        for (x, y) in ((0.1, 0.1), (0.65, 0.1), (0.1, 0.65), (0.65, 0.65), (0.375, 0.1), (0.375, 0.65), (0.1, 0.375), (0.65, 0.375)):
            cx((x - PH, x + PH, y - PH, y + PH, 0.025, 0.03), {'cima': liso('#7a7a80'), '*': liso('#2a2a2e')}, o=novo(contorno=False))
        if estado == 0:
            FUNDO = -1.1
            ES._poco(A0, A1, A0, A1, FUNDO, cantaria('#6a645a', 5, 9, seed=141))
            o = novo(contorno=False)
            EF = ES.escuro_fundo(ferro('#3a3632', '#5a524c'), 0.0, FUNDO)
            for u in (0.22, 0.51):
                C().caixa((u, u + 0.03, A0, A0 + 0.035, FUNDO, 0.0), EF, M, o)
            for k in range(4):
                z = -0.16 - 0.24 * k
                C().caixa((0.22, 0.54, A0 + 0.006, A0 + 0.03, z - 0.022, z), EF, M, o)
            # a tampa em pé, presa nas dobradiças de trás
            TP = {'frente': _chapa_ferro('#4a4a50', 4), 'costas': _chapa_ferro('#4a4a50', 5), '*': liso('#2a2a2e')}
            hz = A1 - A0 + 0.02
            cx((A0 - 0.01, A1 + 0.01, 0.03, 0.065, 0.025, 0.025 + hz), TP)
            for z in (0.12, 0.38):
                cx((A0, A1, 0.065, 0.075, z, z + 0.035), ferro('#2a2624', '#5a524c'))
            for x in (A0 + 0.04, A1 - 0.06):
                cx((x, x + 0.03, 0.06, 0.08, 0.0, 0.06), ferro('#2a2624', '#5a524c'))
            ES._por_cima_do_chao((A0, A1, A0, A1))
            return
        # fechada: a tampa grossa de chapa, as duas cintas cruzadas, a argola e as dobradiças
        reb = [(a, b) for a in (A0 + 0.03, A1 - 0.03) for b in np.linspace(A0 + 0.03, A1 - 0.03, 5)]
        reb += [(a, b) for b in (A0 + 0.03, A1 - 0.03) for a in np.linspace(A0 + 0.09, A1 - 0.09, 3)]
        cx((A0, A1, A0, A1, 0.0, 0.03), {'cima': _chapa_ferro('#62626a', 6, reb), '*': liso('#2a2a2e')})
        for (b) in ((A0 + 0.02, A1 - 0.02, 0.36, 0.39), (0.36, 0.39, A0 + 0.02, A1 - 0.02)):
            cx(b + (0.03, 0.04), {'cima': liso('#3a3a40'), '*': liso('#1e1e22')})
        for x in (A0 + 0.05, A1 - 0.1):
            cx((x, x + 0.05, 0.08, A0 + 0.06, 0.025, 0.04), {'cima': liso('#5e5e64'), '*': liso('#2a2a2e')})
        # a argola deitada (o anel de ferro) presa no meio
        anel = OC.anel(0.375, 0.5, 0.045, 0.062, n=16)
        o = novo()
        for q in anel:
            P = [(x, y, 0.045) for (x, y) in q]
            fp(P, (0, 0, 1), liso('#a8a8b0'), o)
        cx((0.36, 0.39, 0.43, 0.45, 0.04, 0.05), liso('#3a3a40'))
        if estado == 2:
            # a tranca: a barra de ferro atravessada de um lado a outro do aro, nas presilhas, e o cadeado
            zb = 0.045
            cx((0.04, 0.71, 0.27, 0.31, zb, zb + 0.035), {'cima': liso('#5a524c'), '*': liso('#24201e')})
            for x in (0.06, 0.64):
                cx((x, x + 0.05, 0.25, 0.33, 0.0, zb + 0.05), {'cima': liso('#4a4440'), '*': liso('#1e1a18')})
            cad = '#b48a3c'
            cx((0.33, 0.42, 0.31, 0.39, zb - 0.01, zb + 0.04), {'cima': liso('#d8ac56'), '*': liso(cad)})
            cx((0.355, 0.395, 0.25, 0.32, zb + 0.035, zb + 0.05), {'cima': liso('#c8c2b8'), '*': liso('#8a8480')})
    return d


def escada_espiral():
    """
    A escada de pedra em caracol (2 x 2 casas, pisável): o vão redondo no chão com a borda de pedra, o miolo de
    pedra subindo, os degraus em cunha subindo em volta dele (uma volta, 20 cm cada) e sumindo no alto, e embaixo
    os degraus continuando para o escuro do poço.
    """
    cx_, cy_ = 0.75, 0.75
    R = 0.66                    # o vão
    r0 = 0.1                    # o miolo
    passo = math.radians(30)
    a0 = math.radians(100)      # o primeiro degrau (o da frente, que sai do chão)
    FUNDO = -1.3
    # o poço: a parede de dentro (as faces viradas para o centro) e o fundo
    lados = 28
    PP = ES.escuro_fundo(cantaria('#7a7268', 6, 10, seed=151), 0.0, FUNDO)
    o = novo(contorno=False)
    for i in range(lados):
        t0, t1 = 2 * math.pi * i / lados, 2 * math.pi * (i + 1) / lados
        tm = (t0 + t1) / 2
        fp([(cx_ + R * math.cos(t0), cy_ + R * math.sin(t0), FUNDO), (cx_ + R * math.cos(t1), cy_ + R * math.sin(t1), FUNDO),
            (cx_ + R * math.cos(t1), cy_ + R * math.sin(t1), 0.0), (cx_ + R * math.cos(t0), cy_ + R * math.sin(t0), 0.0)],
           (-math.cos(tm), -math.sin(tm), 0), PP, o)
    _disco(cx_, cy_, FUNDO, R, liso('#0e0a0b'), o, lados=lados)
    # a borda de pedra em volta do vão (rente ao chão)
    ob = novo()
    BOR = lajes('#8e877a', 0.16, 0.12, seed=152)
    for i in range(lados):
        t0, t1 = 2 * math.pi * i / lados, 2 * math.pi * (i + 1) / lados
        q = [(cx_ + R * math.cos(t0), cy_ + R * math.sin(t0)), (cx_ + (R + 0.07) * math.cos(t0), cy_ + (R + 0.07) * math.sin(t0)),
             (cx_ + (R + 0.07) * math.cos(t1), cy_ + (R + 0.07) * math.sin(t1)), (cx_ + R * math.cos(t1), cy_ + R * math.sin(t1))]
        OC.prisma(q, 0.0, 0.03, liso('#5e584e'), o=ob, topo=BOR)

    def degrau(k, top, escuro):
        a = a0 + k * passo
        n = 4
        pts = [(cx_ + r0 * math.cos(a), cy_ + r0 * math.sin(a))]
        for i in range(n + 1):
            t = a + passo * 1.06 * i / n
            pts.append((cx_ + (R - 0.01) * math.cos(t), cy_ + (R - 0.01) * math.sin(t)))
        pts.append((cx_ + r0 * math.cos(a + passo * 1.06), cy_ + r0 * math.sin(a + passo * 1.06)))
        cima = lajes('#9a9286', 0.2, 0.13, seed=160 + k)
        lado = cantaria('#7a7268', 4, 9, seed=170 + k)
        if escuro:
            cima, lado = ES.escuro_fundo(cima, 0.0, FUNDO), ES.escuro_fundo(lado, 0.0, FUNDO)
        o = novo(contorno=not escuro)
        OC.prisma(pts, top - 0.09, top, lado, o=o, topo=cima)
        return o
    oids = []
    for k in range(0, 13):
        oids.append(degrau(k, 0.2 * (k + 1), False))
    for k in range(1, 6):
        degrau(-k, -0.2 * (k - 1) - 0.0, True)
    om = novo()
    C().cilindro(cx_, cy_, r0, FUNDO, 2.7, cantaria('#867e72', 6, 6, seed=180), M, om, lados=12, tampa_mat=liso('#867e72'))
    oids.append(om)
    for oid in oids:
        CZ.fades.append((oid, 2.0, 0.6))
    _so_pela_boca(cx_, cy_, R)


# =====================================================================================================================
# os itens de parede
# =====================================================================================================================
def lampiao_cristal(xc=1.5, zc=1.6, aceso=True):
    """
    O lampião de cristal (18 x 30 px): a chapinha e o braço de ferro com a voluta saindo da parede, a argola, o
    chapéu em pirâmide, a gaiola de quatro hastes com os vidros e, dentro, o cristal vermelho. Aceso: os vidros
    brilham em vermelho-laranja (o cristal desenhado neles, claro no meio). Coberto ('1'): um pano de lã escuro
    jogado por cima, só um fio de luz vermelha escapando embaixo.
    """
    n0 = len(C().objs)
    FE = {'*': liso('#2e2a28'), 'cima': liso('#5a524c')}
    cx((xc - 0.03, xc + 0.03, 0.0, 0.016, zc + 0.04, zc + 0.2), FE, ch=0.005)
    cx((xc - 0.011, xc + 0.011, 0.016, 0.2, zc + 0.15, zc + 0.172), FE)
    # a voluta embaixo do braço (a fita de ferro do braço até a chapinha)
    pau((xc, 0.02, zc + 0.07), (xc, 0.13, zc + 0.155), 0.014, liso('#2e2a28'))
    yl = 0.17
    cx((xc - 0.006, xc + 0.006, yl - 0.006, yl + 0.006, zc + 0.08, zc + 0.155), FE)
    a = 0.065                           # a meia largura da gaiola
    z0, z1 = zc - 0.2, zc + 0.02
    # o chapéu e a base
    o = novo()
    _poligono_rodado(xc, yl, [(z1, a + 0.022), (z1 + 0.025, a + 0.018), (z1 + 0.06, 0.012), (z1 + 0.08, 0.01)],
                     vol(xc, yl, '#3a3432', brilho=0.3), o, lados=4)
    o = novo()
    _poligono_rodado(xc, yl, [(z0 - 0.05, 0.012), (z0 - 0.02, a * 0.6), (z0, a + 0.015)], vol(xc, yl, '#3a3432', brilho=0.3), o, lados=4,
                     tampa_mat=liso('#4a4440'))
    if aceso:
        ov = luz_obj()

        def vidro(eixo):
            def f(L, n, P):
                u = (P[:, 0] - xc) if eixo == 'x' else (P[:, 1] - yl)
                z = P[:, 2] - (z0 + z1) / 2
                d = np.abs(u) / 0.035 + np.abs(z) / 0.09
                out = np.tile(hx('#c8402a'), (len(P), 1))
                out = np.where((np.hypot(u / a, z / ((z1 - z0) / 2)) < 0.85)[:, None], hx('#e8603a'), out)
                out = np.where((d < 1.0)[:, None], hx('#ff8a5a'), out)
                out = np.where((d < 0.55)[:, None], hx('#ffd8b8'), out)
                out = np.where(((d < 1.0) & (u > 0.004) & (z < 0))[:, None], hx('#f04a30'), out)
                return out
            return emissivo(f)
        r = a * math.sqrt(2)
        for i in range(4):
            t0, t1 = math.radians(45 + 90 * i), math.radians(135 + 90 * i)
            tm = (t0 + t1) / 2
            pts = [(xc + r * math.cos(t0), yl + r * math.sin(t0), z0), (xc + r * math.cos(t1), yl + r * math.sin(t1), z0),
                   (xc + r * math.cos(t1), yl + r * math.sin(t1), z1), (xc + r * math.cos(t0), yl + r * math.sin(t0), z1)]
            fp(pts, (round(math.cos(tm)), round(math.sin(tm)), 0), vidro('x' if abs(math.sin(tm)) > 0.5 else 'y'), ov)
    else:
        o = novo()
        r = a * math.sqrt(2)
        for i in range(4):
            t0, t1 = math.radians(45 + 90 * i), math.radians(135 + 90 * i)
            tm = (t0 + t1) / 2
            pts = [(xc + r * math.cos(t0), yl + r * math.sin(t0), z0), (xc + r * math.cos(t1), yl + r * math.sin(t1), z0),
                   (xc + r * math.cos(t1), yl + r * math.sin(t1), z1), (xc + r * math.cos(t0), yl + r * math.sin(t0), z1)]
            fp(pts, (round(math.cos(tm)), round(math.sin(tm)), 0), liso('#3a2a26'), o)
    # as quatro hastes da gaiola
    for (sx, sy) in ((-1, -1), (1, -1), (1, 1), (-1, 1)):
        x, y = xc + sx * a, yl + sy * a
        cx((x - 0.007, x + 0.007, y - 0.007, y + 0.007, z0, z1), FE)
    cx((xc - a, xc + a, yl + a - 0.004, yl + a + 0.004, (z0 + z1) / 2 - 0.004, (z0 + z1) / 2 + 0.004), FE)
    if not aceso:
        # o pano de lã jogado por cima, caindo pelos lados; o fio de luz embaixo
        _p1_malha((xc - a - 0.03, xc + a + 0.03, yl - a - 0.03, yl + a + 0.03, z0 + 0.03, z1 + 0.1), (0.04, 0.04, 0.02, 0.06),
                  manta('#4a3428'), seg=2)
        ol = luz_obj()
        fp([(xc - a + 0.01, yl + a + 0.035, z0 + 0.015), (xc + a - 0.01, yl + a + 0.035, z0 + 0.015),
            (xc + a - 0.01, yl + a + 0.035, z0 + 0.03), (xc - a + 0.01, yl + a + 0.035, z0 + 0.03)], (0, 1, 0), liso('#e8503a'), ol)
    PC.sombra_parede(n0, 1, 2)


def armas_parede(xc=1.5, zc=1.6):
    """
    O escudo e as espadas (60 x 46 px): duas espadas cruzadas atrás (pintadas na parede, com o fio claro, a guarda de
    latão, o cabo de couro e o pomo) e o escudo redondo de tábuas em volume (o aro de ferro saindo da parede), pintado
    em quatro quartos vermelho e creme, com o umbo de ferro no meio.
    """
    n0 = len(C().objs)
    pl = PC.Pl(xc - 0.7, xc + 0.7, zc - 0.44, zc + 0.44, 0.012)
    Wp, Hp = pl.W, 0.88 * KZ
    # as espadas: da ponta (embaixo) ao pomo (em cima), em X
    for s in (-1, 1):
        cu0, cu1 = (Wp * 0.5 - s * Wp * 0.3), (Wp * 0.5 + s * Wp * 0.3)
        p_ponta, p_guarda, p_pomo = (cu0, Hp - 3), None, (cu1, 3)
        du, dw = p_pomo[0] - p_ponta[0], p_pomo[1] - p_ponta[1]
        L = math.hypot(du, dw)
        eu, ew = du / L, dw / L
        nu, nw = -ew, eu
        g = (p_ponta[0] + eu * L * 0.74, p_ponta[1] + ew * L * 0.74)
        lam = pl.poli([(p_ponta[0], p_ponta[1]), (g[0] + nu * 1.6, g[1] + nw * 1.6), (g[0] - nu * 1.6, g[1] - nw * 1.6)])
        lam |= pl.linha([(p_ponta[0] + eu * 4, p_ponta[1] + ew * 4), g], 2.4)
        pl.pin(lam, PC.ACO['a'])
        pl.pin(lam & pl.linha([(p_ponta[0] + eu * 3, p_ponta[1] + ew * 3), g], 1.0), PC.ACO['c'])
        pl.pin(pl.linha([(g[0] + nu * 5, g[1] + nw * 5), (g[0] - nu * 5, g[1] - nw * 5)], 2.0), '#a8823a')
        cab = pl.linha([(g[0] + eu * 1.5, g[1] + ew * 1.5), (g[0] + eu * 8, g[1] + ew * 8)], 2.0)
        pl.pin(cab, '#4a2a1a')
        pl.pin(pl.elipse(g[0] + eu * 9.5, g[1] + ew * 9.5, 1.6, 1.6), '#c8a048')
    pl.contorno_fora(pl.opaco())
    pl.grava()
    # o escudo: o aro saindo da parede e a frente pintada
    r = 0.27
    PC.anel_y(xc, zc, r, r, 0.012, 0.06, '#4a4a50', lados=28)
    pf = PC.Pl(xc - r, xc + r, zc - r, zc + r, 0.06)
    ru, rw = r * KX, r * KZ
    cu, cw = ru, rw
    du, dw = (pf.u - cu) / ru, (pf.w - cw) / rw
    rr = np.hypot(du, dw)
    disco = pf.dentro & (rr <= 1.0)
    q = ((du > 0) ^ (dw > 0))
    pf.pin(disco, '#8e2a20')
    pf.pin(disco & q, '#dccfae')
    # as tábuas (as juntas em pé, 1 px um tom abaixo) e o gasto
    jun = disco & (np.floor(pf.u) % 6 == 0)
    pf.tom(jun, 0.82)
    pf.pin(disco & (rr > 0.9), '#5a5a60')
    pf.pin(disco & (rr > 0.9) & (du + dw < -0.4), '#8a8a92')
    pf.pin(disco & (rr < 0.24), '#4a4a50')
    pf.pin(disco & (rr < 0.24) & (du + dw < -0.1), '#8e9098')
    pf.pin(disco & (rr < 0.1) & (du + dw < 0), '#c8cacc')
    pf.contorno(disco)
    pf.grava()
    PC.sombra_parede(n0, 1, 2)


def ferramentas_parede(xc=1.5, zc=1.5):
    """
    A tábua das ferramentas da forja (64 x 36 px): a tábua de carvalho com os pinos; penduradas, as duas tenazes
    (os braços compridos e a mordente), os dois martelos (o cabo e a cabeça), as três ferraduras e a lima.
    """
    n0 = len(C().objs)
    a, h = 0.7, 0.3
    tab = cx((xc - a, xc + a, 0.0, 0.03, zc - h, zc + h), {'*': tab2(['#6a4428', '#644026', '#70482a'], 0.15, '#2a1810', eixo=0, seed=191)})
    pl = PC.Pl(xc - a + 0.04, xc + a - 0.04, zc - h + 0.02, zc + h - 0.02, 0.05)
    Wp, Hp = pl.W, (2 * h - 0.04) * KZ
    FE = {'c': '#8a8a90', 'a': '#5a5a60', 's': '#3a3a40'}
    pinos = []
    # as tenazes: penduradas pela mordente (em cima, curva), o pino redondo e os dois braços finos abrindo para baixo
    for u in (4, 12):
        pinos.append(u + 2)
        jaw = pl.linha([(u + 0.5, 1), (u + 1.5, 4), (u + 2.5, 1)], 1.0) | pl.linha([(u + 0.5, 1), (u + 4.5, 1)], 1.0)
        pl.pin(jaw, FE['s'])
        for (ua, ub) in ((u + 2, u + 0.5), (u + 3, u + 4.5)):
            br = pl.linha([(ua, 5), (ub, Hp - 3)], 1.0)
            pl.pin(br, FE['a'])
        pl.pin(pl.linha([(u + 2, 5), (u + 0.5, Hp - 3)], 1.0) & (pl.w < Hp * 0.5), FE['c'])
        pl.pin(pl.elipse(u + 2.5, 5, 1.2, 1.2), '#2a2a2e')
    # os martelos (o cabo para baixo, a cabeça em cima)
    for (u, larg) in ((22, 8), (32, 6)):
        pinos.append(u + 1)
        cab = pl.ret(u, 4, u + 2, Hp - 2)
        pl.pin(cab, '#8a5a32')
        pl.pin(cab & (pl.u < u + 1), '#b07a48')
        cabeca = pl.ret(u + 1 - larg / 2, 1, u + 1 + larg / 2, 5)
        pl.pin(cabeca, FE['a'])
        pl.pin(cabeca & (pl.w < 2), FE['c'])
        pl.pin(cabeca & (pl.u >= u + larg / 2), FE['s'])
    # as ferraduras (o U de ponta para baixo) em fila
    for (u, w) in ((40, 3), (47, 3), (41, 12), (48, 12)):
        pinos.append(u + 2.5)
        fer = pl.elipse(u + 2.5, w + 3, 3.0, 3.4) & ~pl.elipse(u + 2.5, w + 3, 1.6, 2.0) & (pl.w < w + 5.5)
        fer |= (pl.ret(u - 0.5, w + 3, u + 1.2, w + 7) | pl.ret(u + 3.8, w + 3, u + 5.5, w + 7))
        pl.pin(fer, FE['a'])
        pl.pin(fer & (pl.u < u + 1.2), FE['c'])
        for ww in (w + 4, w + 6):
            pl.pin(pl.ret(u - 0.5, ww, u + 0.5, ww + 1) | pl.ret(u + 4.5, ww, u + 5.5, ww + 1), FE['s'])
    # a lima (a haste riscada e o cabo)
    u = Wp - 6
    pinos.append(u + 1)
    lima = pl.ret(u, 2, u + 2, Hp * 0.62)
    pl.pin(lima, FE['a'])
    pl.pin(lima & (np.floor(pl.w) % 2 == 0), FE['s'])
    pl.pin(pl.ret(u - 0.5, Hp * 0.62, u + 2.5, Hp - 2), '#6a3a22')
    pl.contorno_fora(pl.opaco())
    pl.grava()
    for u in pinos:
        x = xc - a + 0.04 + (u + 0.5) / KX
        cx((x - 0.012, x + 0.012, 0.03, 0.07, zc + h - 0.07, zc + h - 0.045), liso('#2e2a28'))
    PC.sombra_parede(n0, 1, 2, sobre=(tab,))


def placa_taverna(xc=1.5, zc=1.6):
    """
    O cardápio da taverna (40 x 34 px): a moldura de madeira grossa, a lousa escura com o gasto do giz apagado e
    as linhas de rabisco a giz (ilegíveis, sem letra de verdade), o desenhinho de uma caneca e de um pão; pendurada
    num prego pelo cordão.
    """
    n0 = len(C().objs)
    a, h = 0.44, 0.27
    zt = zc + h
    # o cordão (pintado na parede, do prego às duas pontas da moldura)
    pc = PC.Pl(xc - a, xc + a, zt - 0.04, zc + h + 0.2, 0.004)
    Wc = pc.W
    topo_w = 0.2 * KZ
    pc.pin(pc.linha([(Wc * 0.5, 1), (Wc * 0.12, topo_w + 2)], 1.0) | pc.linha([(Wc * 0.5, 1), (Wc * 0.88, topo_w + 2)], 1.0), '#8a7a5a')
    pc.grava()
    PC.prego(xc, zc + h + 0.17)
    PC.moldura(xc - a, xc + a, zc - h, zc + h, 0.05, 0.045, ('#2a1a0e', '#5a3a22', '#7a5434', '#9a6a40'))
    pl = PC.Pl(xc - a + 0.05, xc + a - 0.05, zc - h + 0.045, zc + h - 0.045, 0.02)
    Wp, Hp = pl.W, (2 * h - 0.09) * KZ
    lousa = pl.ret(0, 0, Wp, Hp + 1)
    pl.pin(lousa, '#2c302c')
    m = suave(np.floor(pl.u / 2) * 2, np.floor(pl.w / 2) * 2, 5.0, 3)
    pl.pin(lousa & (m > 0.62), '#363a35')
    GIZ = '#e4e0d0'
    rng = np.random.default_rng(7)
    # o título (um rabisco mais grosso no alto) e as linhas
    pl.pin(pl.linha([(Wp * 0.2, 3), (Wp * 0.35, 2), (Wp * 0.5, 3.5), (Wp * 0.65, 2), (Wp * 0.8, 3)], 1.0), GIZ)
    for k, w in enumerate((7, 10, 13)):
        u0 = 3 + (2 if k == 1 else 0)
        u1 = Wp - 12 - rng.integers(0, 6)
        pts = [(u, w + (1 if (i % 2) else 0) * (0.6 + 0.5 * rng.random())) for i, u in enumerate(np.arange(u0, u1, 2.2))]
        pl.pin(pl.linha(pts, 1.0), GIZ if k != 1 else '#d8d0b8')
        pl.pin(pl.ret(Wp - 8, w - 0.5, Wp - 5, w + 0.5), GIZ)
    # a caneca e o pão
    cu, cw = 6, Hp - 5
    pl.pin(pl.ret(cu, cw - 3, cu + 4, cw - 2) | pl.ret(cu, cw - 3, cu + 1, cw + 2) | pl.ret(cu + 3, cw - 3, cu + 4, cw + 2) |
           pl.ret(cu, cw + 1, cu + 4, cw + 2) | pl.ret(cu + 4, cw - 2, cu + 6, cw - 1) | pl.ret(cu + 5, cw - 2, cu + 6, cw + 1), GIZ)
    pao = pl.elipse(Wp - 9, Hp - 4, 4.2, 2.2) & ~pl.elipse(Wp - 9, Hp - 4, 3.2, 1.2)
    pl.pin(pao, GIZ)
    pl.pin(pl.ret(Wp - 10, Hp - 5.5, Wp - 9, Hp - 3.5) | pl.ret(Wp - 8, Hp - 5.5, Wp - 7, Hp - 3.5), GIZ)
    pl.grava()
    PC.sombra_parede(n0, 1, 2)


# =====================================================================================================================
# os estilos de piso: 'enxaimel' (a taverna, as casas) e 'ferraria'
# =====================================================================================================================
ENX_P = _rampa(['#9a7c5a', '#917456', '#a38463', '#8a6c4f', '#9c8060'])     # as tábuas largas, gastas e acinzentadas
ENX_J = hx('#3e2c1e')


def piso_enxaimel():
    """As tábuas largas (16 texels = 37,5 cm) e gastas: o veio, os nós, o caminho mais claro do uso e os pregos nas pontas."""
    def f(L, n, P):
        u, v = _uv_chao(P)
        g = EST._g('enx', lambda: g_tabuas(16, 64, 211)).at(u, v)
        out = cor_peca(g, ENX_P, 4.3)
        out = veio(out, u, v, g, 16, 6.0, escuro=0.9, claro=1.05)
        # o segundo veio (a tábua é larga): mais uma risca comprida no meio
        gs = v % 16
        seg = ((u + (_h((v // 16) % 8, 9.0) * 20).astype(int)) // 20) % 32
        r3 = (gs == 8 + (_h((v // 16) % 8, 3.0) * 3).astype(int)) & (_h((v // 16) % 8, seg, 5.0) < 0.5)
        out = _w(r3 & ~g.j, _tom(out, 0.92), out)
        out = no_madeira(out, u, v, g, 16, 12.0, 0.18)
        # o gasto: manchas grandes mais claras (o caminho) e as mais escuras (a sujeira)
        m = _mancha(u, v, 217, grande=64, pequena=16, mix=0.7)
        out = _w(m > 0.66, _tom(out, 1.05), out)
        out = _w(m < 0.28, _tom(out, 0.93), out)
        # os pregos: 2 texels escuros perto da ponta de cada tábua, um par por tábua
        pr = ((g.pos == 2) | (g.pos == 3)) & ((v % 16 == 4) | (v % 16 == 11))
        out = _w(pr & ~g.j, hx('#3a2e24'), out)
        return vol_chao(out, g, ENX_J, 1.07, 0.9)
    return emissivo(f)


TAIPA = _rampa(['#d1c5aa', '#d6cab0', '#dbd0b6'])
VIGA = hx('#4a3020')
ENX_V0 = 12          # o alto do rodapé de pedra
ENX_SOL = (12, 18)   # a soleira (a viga deitada de baixo)
ENX_TRV = (70, 76)   # a travessa do meio
ENX_TOP = (136, 143)  # a viga de cima (a parede do jogo tem 2,8 m = 146 texels)
ENX_POSTE = 7        # a largura dos montantes


def _enx_madeira(u, v, uu):
    """As vigas do enxaimel (no texel da parede): devolve (é madeira?, ao longo, de través, a peça) por tipo."""
    sol = (v >= ENX_SOL[0]) & (v < ENX_SOL[1])
    trv = (v >= ENX_TRV[0]) & (v < ENX_TRV[1])
    top = (v >= ENX_TOP[0]) & (v < ENX_TOP[1])
    deitada = sol | trv | top
    poste = ((uu % 64) < ENX_POSTE) & (v >= ENX_SOL[0])
    # as diagonais (só nos painéis de baixo): '/' no primeiro painel, '\' no segundo
    pan = uu // 64
    a = (uu % 64) - ENX_POSTE
    larg_p = 64 - ENX_POSTE
    t = (v - ENX_SOL[1]) / float(ENX_TRV[0] - ENX_SOL[1])
    linha = np.where(pan == 0, t * larg_p, (1 - t) * larg_p)
    diag = (np.abs(a - linha) < 3.2) & (v >= ENX_SOL[1]) & (v < ENX_TRV[0]) & (a >= 0)
    # em cima, as escoras curtas saindo do montante (as "pernas" do enxaimel), espelhadas das de baixo
    t2 = (v - ENX_TRV[1]) / 30.0
    linha2 = np.where(pan == 0, (1 - t2) * 26, larg_p - (1 - t2) * 26)
    diag |= (np.abs(a - linha2) < 3.0) & (v >= ENX_TRV[1]) & (v < ENX_TRV[1] + 30) & (a >= 0)
    return deitada, poste, diag


def parede_enxaimel(eixo):
    """
    A parede de enxaimel: a taipa clara (creme sujo, com as manchas e as rachinhas) entre as vigas de madeira escura
    (os montantes a cada 1,5 m, a soleira, a travessa do meio, a viga de cima e as diagonais nos painéis de baixo),
    o rodapé de pedra embaixo. A viga sai um pouco da taipa: 1 px claro em cima dela e 2 px de sombra embaixo.
    """
    def f(L, n, P):
        u, v = _uv_parede(P, eixo)
        uu = u % TW
        # a taipa
        out = TAIPA[np.clip(np.digitize(_mancha(uu, v, 223, per_v=False, grande=32, pequena=8), [0.3, 0.7]), 0, 2)]
        m = _mancha(uu, v, 227, per_v=False, grande=16, pequena=8, mix=0.5)
        # as rachinhas (riscas de 1 px tortas, curtas)
        rc = (_h((uu // 9) % 15, (v // 7) % 40, 5.0) < 0.05) & ((uu + v // 2) % 9 == 0)
        out = _w(rc, _tom(out, 0.8), out)
        # a sujeira de baixo (perto do rodapé) e o encardido de cima
        out = _w(v < ENX_SOL[1] + 6 + (m * 6).astype(int), _tom(out, 0.92), out)
        out = _w(v > 150, _tom(out, 0.93), out)
        deitada, poste, diag = _enx_madeira(u, v, uu)
        # a sombra que a viga faz na taipa (2 px embaixo da deitada e da diagonal, 1 px à direita do montante)
        d1, p1, g1 = _enx_madeira(u, v + 1, uu)
        d2, _, g2 = _enx_madeira(u, v + 2, uu)
        _, p3, _ = _enx_madeira(u - 1, v, (uu - 1) % TW)
        som = ((d1 | g1 | d2 | g2) | p3)
        out = _w(som, _tom(out, 0.82), out)
        # a madeira: o veio ao comprido e o volume (a quina de cima clara, a de baixo escura)
        mad = deitada | poste | diag
        cor = np.tile(VIGA, (len(P), 1))
        idp = np.where(poste & ~deitada, uu // 64, 10 + v // 8)
        cor = _w(_h(idp % 31, 2.0) > 0.6, _tom(VIGA, 1.08), cor)
        vd = deitada & (((v + uu // 23) % 3 == 0) & (_h((uu // 11) % 12, v % 6, 4.0) < 0.5))
        vp = poste & ~deitada & ((uu % 64 == 3) & (_h(uu // 64, (v // 13) % 15, 6.0) < 0.6))
        vg = diag & (((uu + v) % 5 == 0) & (_h((uu // 6) % 22, 7.0) < 0.5))
        cor = _w(vd | vp | vg, _tom(VIGA, 0.82), cor)
        cima = mad & ~(_enx_madeira(u, v + 1, uu)[0] | _enx_madeira(u, v + 1, uu)[1] | _enx_madeira(u, v + 1, uu)[2])
        baixo = mad & ~(_enx_madeira(u, v - 1, uu)[0] | _enx_madeira(u, v - 1, uu)[1] | _enx_madeira(u, v - 1, uu)[2])
        esq = poste & ~deitada & (uu % 64 == 0)
        dir_ = poste & ~deitada & (uu % 64 == ENX_POSTE - 1)
        cor = _w(cima | esq, _tom(VIGA, 1.25), cor)
        cor = _w(baixo | dir_, _tom(VIGA, 0.7), cor)
        # as cavilhas (o pino de madeira nas emendas: 2 x 2 claro com a sombra)
        cav = poste & (((v - ENX_TRV[0]) // 1 >= 2) & ((v - ENX_TRV[0]) < 4)) & ((uu % 64) >= 2) & ((uu % 64) < 4)
        cor = _w(cav, _tom(VIGA, 1.4), cor)
        out = _w(mad, cor, out)
        # o rodapé de pedra
        g = EST._g('enx_rdp', lambda: g_fiadas(6, 10, 22, 229, H=THP)).at(u, v)
        pd = cor_peca(g, _rampa(['#8a8478', '#7e786c', '#948e82', '#76706a']), 3.3)
        pd = vol_parede(pd, g, hx('#3e3a34'), 1.12, 1.05, 0.86, 0.93)
        out = _w(v < ENX_V0, pd, out)
        out = _w(v == ENX_V0 - 1, _tom(hx('#948e82'), 1.12), out)
        return out
    return emissivo(f)


FERR_TERRA = _rampa(['#4e4036', '#463a31', '#55463a', '#3e332b'])
FERR_LAJE = _rampa(['#77726a', '#6e6a62', '#807a71', '#67635c'])


def piso_ferraria():
    """
    O chão da ferraria: a terra batida escura com as lajes de pedra soltas (metade das pedras de um Voronoi), a
    junta escura em volta de cada laje, o pó de carvão (blocos de 2 px pretos) e a fuligem em manchas.
    """
    def f(L, n, P):
        u, v = _uv_chao(P)
        G = EST._g('ferr', lambda: g_voronoi(7, 241, jit=0.85))
        g = G.at(u, v)
        laje = _h(g.ids * 0.37, 2.0) < 0.55
        # a terra
        q = _ns(u, v, 16, 243) * 0.6 + _ns(u, v, 8, 244) * 0.4
        terra = FERR_TERRA[np.digitize(q, [0.36, 0.5, 0.64])]
        pc = (_h((u // 2) % 64, (v // 2) % 64, 245.0) < 0.035)
        terra = _w(pc, hx('#241e1a'), terra)
        terra = _w((_h((u // 2) % 64, (v // 2) % 64, 246.0) < 0.03), hx('#6a5a4a'), terra)
        # a laje: a cor sorteada, o volume e a borda escura (a junta com a terra é a própria terra mais escura)
        pd = cor_peca(g, FERR_LAJE, 7.7)
        pd = vol_chao(pd, g, hx('#2a2420'), 1.12, 0.86)
        mm = _mancha(u, v, 247, grande=32, pequena=8, mix=0.6)
        pd = _w(mm > 0.66, _tom(pd, 0.9), pd)
        # a laje recua 1 texel da borda da célula (fica a terra em volta)
        borda = g.j | g.jl | g.jr | g.jd | g.ju
        out = _w(laje & ~borda, pd, terra)
        out = _w(laje & borda & ~g.j, _tom(terra, 0.7), out)
        # a fuligem em manchas grandes
        fu = _mancha(u, v, 249, grande=64, pequena=32, mix=0.7)
        out = _w(fu > 0.64, _tom(out, 0.86), out)
        return out
    return emissivo(f)


def parede_ferraria(eixo):
    """
    A parede da ferraria: a pedra bruta escura (as pedras sem fiada certa, a junta funda), a fuligem que sobe e
    escurece tudo para cima, os escorridos de fuligem e o rodapé um pouco mais claro de pó.
    """
    def f(L, n, P):
        u, v = _uv_parede(P, eixo)
        uu = u % TW
        g = EST._g('ferr_par', lambda: g_bruta(13, 14, 30, 251)).at(u, v)
        out = cor_peca(g, _rampa(['#5a554e', '#524d47', '#615b54', '#4a4641', '#66605a']), 5.3)
        m = _mancha(uu, v, 253, per_v=False, grande=16, pequena=8, mix=0.5)
        out = _w(m > 0.64, _tom(out, 0.9), out)
        out = vol_parede(out, g, hx('#171412'), 1.16, 1.06, 0.8, 0.9)
        # a fuligem: escurece por faixas para cima (e mais nas manchas)
        fu = np.clip((v - 40) / 100.0, 0, 1) + (m - 0.5) * 0.4
        k = np.digitize(fu, [0.25, 0.5, 0.75])
        fac = np.array([1.0, 0.88, 0.76, 0.64])[k]
        out = out * fac[:, None] + (1 - fac[:, None]) * hx('#141010')
        # os escorridos de fuligem (riscas de 2 px descendo do alto)
        col = uu // 2
        tem = _h(col % 64, 3.1) < 0.18
        ini = 189 - (_h(col % 64, 3.7) * 40).astype(int)
        comp = 30 + (_h(col % 64, 4.3) * 70).astype(int)
        out = _w(tem & (v < ini) & (v > ini - comp) & ~g.j, _tom(out, 0.8), out)
        # embaixo, o pó claro
        out = _w(v < 5 + (m * 6).astype(int), out * 0.8 + hx('#6a5e50') * 0.2, out)
        return out
    return emissivo(f)


# =====================================================================================================================
# o catálogo deste grupo
# =====================================================================================================================
ITENS = {
    'forja': (3, 2, (0.0, 0.0), lambda: forja(True), {'1': lambda: forja(False)}),
    'bigorna': (1, 1, (0.0, 0.0), bigorna, {}),
    'rack_medieval': (2, 1, (0.0, 0.0), rack_medieval, {}),
    'armadura_medieval': (1, 1, (0.0, 0.0), armadura_medieval, {}),
    'tina_agua': (1, 1, (0.0, 0.0), tina_agua, {}),
    'mesa_rustica': (3, 2, (0.0, 0.0), mesa_rustica, {}),
    'banco_rustico': (2, 1, (0.0, 0.0), banco_rustico, {}),
    'balcao_taverna': (4, 1, (0.0, 0.0), balcao_taverna, {}),
    'barril_madeira': (1, 1, (0.0, 0.0), barril_madeira, {}),
    'lareira': (3, 1, (0.0, 0.0), lambda: lareira(True), {'1': lambda: lareira(False)}),
    'cama_palha': (2, 3, (0.0, 0.0), cama_palha, {}),
    'bau_madeira': (1, 1, (0.0, 0.0), bau_madeira, {'1': lambda: bau_madeira(True)}),
    'escotilha': (1, 1, (0.0, 0.0), escotilha(0), {'1': escotilha(1), '2': escotilha(2)}),
    'escada_espiral': (2, 2, (0.0, 0.0), escada_espiral, {}),
}

ITENS_PAREDE = {
    'lampiao_cristal': (lambda: lampiao_cristal(1.5, 1.6, True), (1.5, 1.6), {'1': lambda: lampiao_cristal(1.5, 1.6, False)}),
    'armas_parede': (lambda: armas_parede(1.5, 1.6), (1.5, 1.6)),
    'ferramentas_parede': (lambda: ferramentas_parede(1.5, 1.5), (1.5, 1.5)),
    'placa_taverna': (lambda: placa_taverna(1.5, 1.6), (1.5, 1.6)),
}

ESTILOS = {
    'enxaimel': {'piso': piso_enxaimel, 'parede': parede_enxaimel, 'rodape': None, 'extra': None},
    'ferraria': {'piso': piso_ferraria, 'parede': parede_ferraria, 'rodape': None, 'extra': None},
}
