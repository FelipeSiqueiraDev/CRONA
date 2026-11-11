"""
Os 36 móveis do Bar da Ordem em LOW-POLY FACETADO (ver lib.py). Cada `fazer_<id>(m)` monta um `Modelo` em metros
(x direita, y cima, z frente; origem no centro da pegada, no chão).

Proporção real: cadeira com assento a 0,45 m e encosto a 0,90 m, mesa de bar a 0,75 m, balcão a 1,05 m, estante de 2 m,
sinuca de 2,6 m, garrafa de 0,23 m. O móvel de verdade cabe DENTRO da pegada (casa de 0,75 m). Móveis de parede
(estantes, geladeiras, aparador, armarinho, fliperama) encostam a traseira (-z) na borda da casa.
Nada de textura: só os materiais chapados da PALETA.
"""
import math
import random

from lib import Modelo

C = 0.75  # uma casa
ATRAS = -C / 2  # a borda de trás da casa


def fundo_z(d):
    """z do centro de um móvel de fundo `d` encostado na borda de trás da casa."""
    return ATRAS + d / 2


# ------------------------------------------------------------------ helpers de peças
def anel(m, mt, x, y, z, r, seg=8, esp=0.02, h=0.02):
    """Aro de `seg` caixinhas em volta de (x, z): um 'torus' de baixa resolução."""
    comp = 2 * r * math.sin(math.pi / seg) + esp
    for i in range(seg):
        a = 2 * math.pi * (i + 0.5) / seg
        m.caixa(mt, x + math.cos(a) * r, y, z + math.sin(a) * r, comp, h, esp, rot=(0, -math.degrees(a) + 90, 0))


def barra(m, mt, p0, p1, esp, h, y=0.0):
    """Caixa fina deitada entre dois pontos (x, z) do chão, de y a y+h."""
    dx, dz = p1[0] - p0[0], p1[1] - p0[1]
    comp = math.hypot(dx, dz)
    ang = math.degrees(math.atan2(-dz, dx))
    m.caixa(mt, (p0[0] + p1[0]) / 2, y, (p0[1] + p1[1]) / 2, comp, h, esp, rot=(0, ang, 0))


def garrafa(m, x, y, z, cor, h=0.23, r=0.032):
    """Garrafa de 3 peças (corpo reto de 6 lados, ombro, gargalo de 5): lê como garrafa de relance, poucos triângulos."""
    corpo = h * 0.55
    ombro = h * 0.17
    m.cil(cor, x, y, z, r, corpo, seg=6)
    m.cil(cor, x, y + corpo, z, r, ombro, seg=6, rtop=r * 0.38)
    m.cil(cor, x, y + corpo + ombro, z, r * 0.38, h - corpo - ombro, seg=5)


def lata(m, x, y, z, cor, h=0.122, r=0.033):
    m.cil(cor, x, y, z, r, h, seg=6)
    m.cil("LATA_PRATA", x, y + h, z, r * 0.85, 0.004, seg=6)


def cadeira(m, x, y, z, larg=0.42, fundo=0.42, assento=0.45, topo=0.90, mt="AMARELO", mt_perna="AMARELO_ESC"):
    """Cadeira de bar: assento chanfrado, 4 pernas afuniladas, pernas de trás sobem até o encosto, travessa e 2 ripas."""
    esp = 0.04
    m.caixa(mt, x, y + assento - 0.04, z, larg, 0.04, fundo, bisel=0.01)
    px = larg / 2 - esp / 2 - 0.005
    pf = fundo / 2 - esp / 2 - 0.005
    for sx in (-1, 1):
        m.caixa(mt_perna, x + sx * px, y, z + pf, esp, assento - 0.04, esp)  # frente
        m.caixa(mt_perna, x + sx * px, y, z - pf, esp, topo, esp)  # trás (sobe até o encosto)
    # travessas do encosto e as ripas
    m.caixa(mt, x, y + topo - 0.09, z - pf, larg - esp * 2 + 0.02, 0.09, 0.03)
    m.caixa(mt, x, y + topo - 0.26, z - pf, larg - esp * 2 + 0.02, 0.06, 0.025)
    # travessa lateral sob o assento


def mesa_redonda_ou_quadrada(m, x, y, z):
    pass


# ------------------------------------------------------------------ os móveis
def fazer_stairs_down(m):
    """Escada secreta: a moldura rente ao chão e o poço com degraus descendo (para -y)."""
    f = 0.07
    for sx in (-1, 1):
        m.caixa("MADEIRA_ESC", sx * (C / 2 - f / 2), 0, 0, f, 0.025, C)
    for sz in (-1, 1):
        m.caixa("MADEIRA_ESC", 0, 0, sz * (C / 2 - f / 2), C - 2 * f, 0.025, f)
    larg = C - 2 * f
    # paredes do poço
    m.caixa("PRETO", 0, -1.0, -larg / 2 - 0.01, larg + 0.04, 1.0, 0.02)
    m.caixa("PRETO", 0, -1.0, larg / 2 + 0.01, larg + 0.04, 1.0, 0.02)
    m.caixa("PRETO", -larg / 2 - 0.01, -1.0, 0, 0.02, 1.0, larg)
    m.caixa("PRETO", larg / 2 + 0.01, -1.0, 0, 0.02, 1.0, larg)
    # degraus (descem para o fundo, -z)
    for i in range(5):
        topo = -0.17 * (i + 1)
        zc = larg / 2 - 0.065 - i * 0.115
        m.caixa("CONCRETO" if i % 2 == 0 else "CINZA", 0, -1.0, zc, larg, topo + 1.0, 0.115)


def _geladeira(m, corpo, corpo_esc, h, w=0.68, d=0.68):
    z = fundo_z(d) + 0.0
    m.caixa("METAL_ESC", 0, 0, z, w - 0.1, 0.06, d - 0.1)  # rodapé
    m.caixa(corpo, 0, 0.06, z, w, h - 0.06, d, bisel=0.035)
    # porta de cima (freezer) e a de baixo: o vão entre elas
    m.caixa(corpo_esc, 0, h * 0.34, z + d / 2 - 0.004, w - 0.02, 0.014, 0.012)
    m.caixa(corpo_esc, 0, h * 0.34 + 0.014, z + d / 2 - 0.004, 0.0, 0.0, 0.0) if False else None
    # puxadores verticais
    m.caixa("METAL_CLARO", w / 2 - 0.08, h * 0.38, z + d / 2 + 0.018, 0.028, 0.46, 0.03, bisel=0.006)
    m.caixa("METAL_CLARO", w / 2 - 0.08, h * 0.80, z + d / 2 + 0.018, 0.028, 0.2, 0.03, bisel=0.006)
    # a cobertura do topo
    m.caixa(corpo_esc, 0, h - 0.02, z, w + 0.01, 0.03, d + 0.01, bisel=0.012)


def fazer_beer_fridge(m):
    """Geladeira amarela de dois corpos (a do canto, a do teclado numérico), retrô e gasta."""
    _geladeira(m, "GELADEIRA_AMARELA", "AMARELO_ESC", 2.0)
    z = fundo_z(0.68)
    # o teclado numérico (a senha 0413): placa preta com botões
    m.caixa("PRETO", -0.0, 1.22, z + 0.34 + 0.004, 0.2, 0.28, 0.02, bisel=0.004)
    for i in range(12):
        m.caixa("METAL_CLARO", -0.063 + (i % 3) * 0.063, 1.12 + (3 - i // 3) * 0.058 - 0.02, z + 0.34 + 0.016, 0.04, 0.036, 0.012)
    m.caixa("EMISSIVO_VERDE", 0, 1.33, z + 0.34 + 0.016, 0.14, 0.03, 0.01)


def fazer_fridge_drinks(m):
    """Expositor de bebidas: corpo vermelho, porta de vidro com garrafas, letreiro luminoso no topo."""
    w, d, h = 0.7, 0.7, 2.0
    z = fundo_z(d)
    m.caixa("METAL_ESC", 0, 0, z, w - 0.1, 0.07, d - 0.1)
    m.caixa("GELADEIRA_VERM", 0, 0.07, z - 0.02, w, h - 0.07, d - 0.04, bisel=0.03)
    # a boca com o vidro: moldura, vidro, luz de dentro e as prateleiras com garrafas
    m.caixa("GELADEIRA_VERM", 0, 0.28, z + d / 2 - 0.03, w - 0.1, 1.46, 0.05, bisel=0.01)
    m.caixa("EMISSIVO_FRIO" if False else "EMISSIVO", 0, 0.34, z + d / 2 - 0.1, w - 0.2, 1.34, 0.02)
    cores = ["GARRAFA_VERDE", "GARRAFA_AMBAR", "LATA_VERM", "GARRAFA_CLARA", "LATA_AZUL"]
    rng = random.Random(7)
    for k, y in enumerate((0.4, 0.9)):
        m.caixa("METAL_CLARO", 0, y - 0.015, z + d / 2 - 0.1, w - 0.2, 0.015, 0.16)
        for i in range(4):
            garrafa(m, -0.18 + i * 0.12, y, z + d / 2 - 0.1, cores[rng.randrange(len(cores))], h=0.4, r=0.045)
    m.caixa("VIDRO", 0, 0.33, z + d / 2 - 0.0, w - 0.14, 1.38, 0.012)
    m.caixa("METAL_CLARO", w / 2 - 0.09, 0.8, z + d / 2 + 0.03, 0.025, 0.5, 0.03, bisel=0.006)
    # o letreiro do topo
    m.caixa("EMISSIVO", 0, 1.78, z + d / 2 - 0.02, w - 0.12, 0.17, 0.03, bisel=0.006)
    m.caixa("GELADEIRA_VERM", 0, h - 0.04, z - 0.02, w + 0.02, 0.04, d - 0.02, bisel=0.01)


def fazer_bar_shelf(m):
    """Prateleira de garrafas (2 casas): armário embaixo, 4 prateleiras e 25 garrafas."""
    w, d, h = 1.46, 0.36, 2.0
    z = fundo_z(d)
    m.caixa("MADEIRA_ESC", 0, 0, z - 0.01, w, 0.42, d + 0.02, bisel=0.012)  # armário de baixo
    for sx in (-1, 1):
        m.caixa("MADEIRA", sx * 0.36, 0.05, z + d / 2 + 0.003, 0.66, 0.32, 0.018, bisel=0.004)  # portas
        m.caixa("LATAO", sx * 0.07 + 0, 0.22, z + d / 2 + 0.018, 0.02, 0.07, 0.014)
    m.caixa("MADEIRA_ESC", 0, 0.42, z, w + 0.04, 0.04, d + 0.04, bisel=0.01)  # tampo do armário
    for sx in (-1, 1):  # montantes
        m.caixa("MADEIRA_ESC", sx * (w / 2 - 0.025), 0.44, z, 0.05, h - 0.44, d, bisel=0.008)
    m.caixa("MADEIRA", 0, 0.46, z - d / 2 + 0.01, w - 0.1, h - 0.46, 0.02)  # fundo
    ys = (0.62, 0.95, 1.28, 1.61)
    for y in ys:
        m.caixa("MADEIRA_MEDIA", 0, y - 0.018, z, w - 0.08, 0.025, d - 0.02, bisel=0.005)
    m.caixa("MADEIRA_ESC", 0, h - 0.045, z, w + 0.03, 0.045, d + 0.03, bisel=0.01)  # coroa
    cores = ["GARRAFA_VERDE", "GARRAFA_AMBAR", "GARRAFA_CLARA", "GARRAFA_VERM", "GARRAFA_AMBAR", "GARRAFA_VERDE"]
    rng = random.Random(11)
    for y in ys:
        n = 6
        for i in range(n):
            if rng.random() < 0.12:
                continue
            gx = -w / 2 + 0.12 + i * (w - 0.24) / (n - 1)
            garrafa(m, gx, y, z + rng.uniform(-0.03, 0.03), cores[rng.randrange(len(cores))], h=rng.choice((0.28, 0.32, 0.25)), r=0.04)


def fazer_minibar(m):
    """Frigobar de balcão a 0,90 m: caixa de aço cinza, porta com puxador e luzinha."""
    w, d, h = 0.6, 0.6, 0.9
    z = fundo_z(d)
    m.caixa("METAL_ESC", 0, 0.0, z, w - 0.08, 0.05, d - 0.08)
    m.caixa("GELADEIRA_CINZA", 0, 0.05, z, w, h - 0.05, d, bisel=0.02)
    m.caixa("METAL_ESC", 0, h - 0.03, z, w + 0.015, 0.03, d + 0.015, bisel=0.008)
    m.caixa("METAL_CLARO", -w / 2 + 0.07, 0.4, z + d / 2 + 0.014, 0.025, 0.34, 0.028, bisel=0.006)
    m.caixa("EMISSIVO", w / 2 - 0.1, 0.78, z + d / 2 + 0.003, 0.06, 0.03, 0.01)
    m.caixa("PRETO", 0, 0.12, z + d / 2 + 0.002, w - 0.1, 0.02, 0.006)


def fazer_beer_crate(m):
    """Engradado de cerveja com 12 garrafas (os gargalos aparecem)."""
    w, d = 0.5, 0.34
    for sz in (-1, 1):
        m.caixa("PLASTICO_VERM", 0, 0.02, sz * (d / 2 - 0.0125), w, 0.23, 0.025, bisel=0.005)
    for sx in (-1, 1):
        m.caixa("PLASTICO_VERM", sx * (w / 2 - 0.0125), 0.02, 0, 0.025, 0.23, d - 0.05, bisel=0.005)
    m.caixa("PLASTICO_VERM", 0, 0, 0, w - 0.02, 0.025, d - 0.02)
    for k in range(3):  # divisórias baixas
        m.caixa("PLASTICO_AZUL", -0.125 + k * 0.125, 0.025, 0, 0.012, 0.18, d - 0.04)
    for i in range(4):
        for j in range(3):
            m.cil("GARRAFA_AMBAR", -0.185 + i * 0.123, 0.03, -0.1 + j * 0.1, 0.03, 0.3, seg=5, rtop=0.016)


def fazer_keg(m):
    """Barril de chope de aço: corpo de 8 lados, aros, topo com a torneira de entrada."""
    m.cil("METAL", 0, 0.0, 0, 0.215, 0.58, seg=8, giro=math.pi / 8)
    for y in (0.0, 0.2, 0.38):
        m.cil("METAL_ESC", 0, y, 0, 0.225, 0.035, seg=8, giro=math.pi / 8)
    m.cil("METAL_ESC", 0, 0.56, 0, 0.23, 0.04, seg=8, giro=math.pi / 8)
    m.cil("METAL_CLARO", 0, 0.6, 0, 0.12, 0.012, seg=8)
    m.cil("METAL_ESC", 0, 0.612, 0, 0.045, 0.04, seg=6)
    m.caixa("LATAO", 0.0, 0.62, 0, 0.1, 0.02, 0.025)


def fazer_bar_counter(m):
    """Balcão do bar (2 casas, 1,5 m): corpo escuro, frente com painéis vermelhos, tampo claro e a barra de latão no pé."""
    w, d = 1.5, 0.66
    m.caixa("MADEIRA_ESC", 0, 0, 0, w - 0.02, 0.08, d - 0.04)  # rodapé
    m.caixa("MADEIRA_ESC", 0, 0.08, -0.03, w, 0.94, d - 0.08, bisel=0.015)  # corpo
    z_frente = (d - 0.08) / 2 - 0.03
    for i in range(3):  # painéis vermelhos em relevo
        m.caixa("COURO_VERM", -0.48 + i * 0.48, 0.2, z_frente + 0.008, 0.4, 0.66, 0.02, bisel=0.012)
    m.caixa("MADEIRA_CLARA", 0, 1.02, 0.0, w + 0.04, 0.05, d + 0.04, bisel=0.012)  # tampo com a borda que avança
    m.caixa("LATAO", 0, 0.1, z_frente + 0.07, w - 0.06, 0.03, 0.03, bisel=0.006)  # a barra de apoio dos pés
    for sx in (-1, 1):
        m.caixa("LATAO", sx * (w / 2 - 0.06), 0.08, z_frente + 0.07, 0.03, 0.05, 0.03)
        m.caixa("LATAO", sx * (w / 2 - 0.06), 0.08, z_frente + 0.02, 0.025, 0.025, 0.06)
    # a canaleta de trás (lado de dentro) e a prateleira
    m.caixa("MADEIRA", 0, 0.0, -d / 2 + 0.02, w - 0.06, 0.04, 0.04)


def fazer_beer_glass(m):
    """Copo de chope de 14,7 cm: vidro, a cerveja dourada e a espuma."""
    m.cil("CERVEJA", 0, 0.004, 0, 0.032, 0.1, seg=8, rtop=0.036)
    m.cil("ESPUMA", 0, 0.104, 0, 0.036, 0.03, seg=8, rtop=0.038)
    m.cil("VIDRO", 0, 0.0, 0, 0.034, 0.147, seg=8, rtop=0.04)
    m.cil("VIDRO", 0, 0.0, 0, 0.034, 0.008, seg=8)  # fundo grosso


def fazer_stool_bar(m):
    """Banqueta de balcão a 0,75 m: assento redondo de couro vermelho, pernas de aço abertas e aro de pé."""
    m.cil("COURO_VERM", 0, 0.68, 0, 0.17, 0.07, seg=8, rtop=0.16, giro=math.pi / 8)
    m.cil("COURO_VERM_ESC", 0, 0.65, 0, 0.12, 0.03, seg=8, giro=math.pi / 8)
    for i in range(4):
        a = math.pi / 4 + i * math.pi / 2
        x, z = math.cos(a) * 0.115, math.sin(a) * 0.115
        # perna inclinada para fora (3-4°) até o assento
        m.cil("METAL_ESC", x * 1.2, 0.0, z * 1.2, 0.017, 0.66, seg=6, rtop=0.014, rot=(0, 0, 0))
    anel(m, "METAL_ESC", 0, 0.26, 0, 0.14, seg=8, esp=0.02, h=0.02)
    m.cil("METAL_ESC", 0, 0.0, 0, 0.0, 0.0, seg=6, rtop=0.0) if False else None
    m.cil("METAL_ESC", 0, 0.0, 0, 0.17, 0.015, seg=8, rtop=0.15)  # sapata das pernas (disco no chão, fino)


def fazer_armchair_red(m):
    """Poltrona vermelha: base de couro, almofada, encosto inclinado, braços e 4 pés de madeira."""
    for sx in (-1, 1):
        for sz in (-1, 1):
            m.caixa("MADEIRA_ESC", sx * 0.28, 0, sz * 0.26, 0.06, 0.12, 0.06, top=(0.04, 0.04))
    m.caixa("COURO_VERM_ESC", 0, 0.12, 0, 0.66, 0.2, 0.62, bisel=0.03)  # caixa do assento
    m.caixa("COURO_VERM", 0, 0.32, 0.05, 0.44, 0.12, 0.5, bisel=0.03)  # almofada do assento
    m.caixa("COURO_VERM", 0, 0.3, -0.26, 0.66, 0.62, 0.16, bisel=0.035, rot=(-8, 0, 0))  # encosto
    for sx in (-1, 1):
        m.caixa("COURO_VERM_ESC", sx * 0.29, 0.3, 0.02, 0.1, 0.24, 0.58, bisel=0.03)  # braços
    m.caixa("COURO_VERM", 0, 0.6, -0.285, 0.5, 0.1, 0.1, bisel=0.03, rot=(-8, 0, 0))  # almofada de cabeça


def fazer_plant(m):
    """Planta em vaso de terracota: copas de icosfera em três tons de verde."""
    m.cil("TERRACOTA", 0, 0.0, 0, 0.13, 0.28, seg=8, rtop=0.17, giro=math.pi / 8)
    m.cil("TERRACOTA", 0, 0.27, 0, 0.185, 0.045, seg=8, giro=math.pi / 8)
    m.cil("SUJEIRA", 0, 0.31, 0, 0.15, 0.012, seg=8)
    m.cil("MADEIRA", 0, 0.31, 0, 0.022, 0.5, seg=6, rtop=0.016, rot=(4, 0, 3))
    folhas = [
        ("FOLHA", 0.0, 0.78, 0.0, 0.26, (1.05, 0.9, 1.05)),
        ("FOLHA_ESC", 0.17, 0.62, 0.06, 0.2, (1, 0.85, 1)),
        ("FOLHA_CLARA", -0.16, 0.7, -0.06, 0.2, (1, 0.9, 1)),
        ("FOLHA", 0.05, 1.0, -0.04, 0.2, (1, 0.9, 1)),
        ("FOLHA_ESC", -0.06, 0.56, 0.15, 0.17, (1, 0.8, 1)),
        ("FOLHA_CLARA", 0.1, 1.12, 0.04, 0.12, (1, 0.9, 1)),
    ]
    for mt, x, y, z, r, esc in folhas:
        m.ico(mt, x, y, z, r, esc=esc, sub=1, rot=(10, 25 * x * 10, 0))


def fazer_arcade(m):
    """Fliperama ('Feliperama') de 1,8 m: gabinete azul, painel inclinado com botões, tela e letreiro que acendem."""
    w, d = 0.62, 0.7
    z = fundo_z(d)
    m.caixa("ARCADE_AZUL", 0, 0, z, w, 0.95, d, top=(w, d - 0.08), top_off=(0, -0.04), bisel=0.012)  # base afunilada
    for sx in (-1, 1):
        m.caixa("EMISSIVO_ROXO", sx * (w / 2 + 0.002), 0.08, z + d / 2 - 0.06, 0.012, 0.8, 0.03)  # faixas de led laterais
    # painel de controle inclinado, com joystick e botões
    m.caixa("PRETO", 0, 0.93, z + d / 2 - 0.1, w + 0.02, 0.05, 0.3, bisel=0.01, rot=(-14, 0, 0))
    m.cil("METAL_CLARO", -0.12, 0.99, z + d / 2 - 0.1, 0.012, 0.08, seg=6)
    m.ico("PLASTICO_VERM", -0.12, 1.07, z + d / 2 - 0.1, 0.03, sub=1)
    for i, c in enumerate(("PLASTICO_VERM", "LARANJA", "PLASTICO_AZUL", "AMARELO_CLARO")):
        m.cil(c, 0.03 + (i % 2) * 0.07, 0.96 + 0.005, z + d / 2 - 0.045 - (i // 2) * 0.07, 0.024, 0.014, seg=6, rot=(-14, 0, 0))
    # corpo da tela, tela e frisa
    m.caixa("ARCADE_AZUL", 0, 0.98, z - 0.02, w, 0.62, d - 0.2, top=(w, d - 0.34), top_off=(0, -0.02), bisel=0.01)
    m.caixa("PRETO", 0, 1.05, z + d / 2 - 0.1, w - 0.1, 0.45, 0.02, rot=(-12, 0, 0))
    m.caixa("EMISSIVO_AZUL", 0, 1.08, z + d / 2 - 0.094, w - 0.17, 0.38, 0.012, rot=(-12, 0, 0))
    # letreiro e coroa
    m.caixa("ARCADE_AZUL", 0, 1.6, z - 0.03, w, 0.2, d - 0.22, bisel=0.01)
    m.caixa("NEON_ROSA", 0, 1.62, z + d / 2 - 0.145, w - 0.1, 0.15, 0.015)
    m.caixa("ARCADE_AZUL", 0, 1.78, z - 0.03, w + 0.02, 0.025, d - 0.2, bisel=0.008)


def fazer_chair_stack(m):
    """Pilha de 5 cadeiras amarelas de bar encaixadas (1,30 m)."""
    for k in range(5):
        cadeira(m, 0, k * 0.1, 0.0, larg=0.4, fundo=0.4)


def fazer_table_bar(m):
    """Mesa de bar amarela, a 0,75 m: tampo quadrado chanfrado, travessas e 4 pernas afuniladas."""
    s = 0.70
    m.caixa("AMARELO", 0, 0.70, 0, s, 0.047, s, bisel=0.012)
    m.caixa("AMARELO_ESC", 0, 0.64, 0, s - 0.12, 0.06, s - 0.12, bisel=0.006)  # cinta
    for sx in (-1, 1):
        for sz in (-1, 1):
            m.caixa("AMARELO_ESC", sx * (s / 2 - 0.07), 0, sz * (s / 2 - 0.07), 0.06, 0.64, 0.06, top=(0.075, 0.075), bisel=0.005)
    for sx in (-1, 1):
        m.caixa("AMARELO_ESC", sx * (s / 2 - 0.07), 0.2, 0, 0.035, 0.035, s - 0.14)
    m.caixa("AMARELO_ESC", 0, 0.2, 0, s - 0.14, 0.035, 0.035)


def fazer_chair_bar(m):
    cadeira(m, 0, 0, 0.0)


def fazer_table_small(m):
    """Mesinha escura de apoio: tampo octogonal, coluna e pé em cruz (0,70 m)."""
    m.cil("MADEIRA_MEDIA", 0, 0.655, 0, 0.3, 0.045, seg=8, giro=math.pi / 8)
    m.cil("MADEIRA_ESC", 0, 0.1, 0, 0.045, 0.56, seg=6, rtop=0.055)
    m.cil("MADEIRA_ESC", 0, 0.0, 0, 0.14, 0.1, seg=8, rtop=0.05)
    for a in (0, 90):
        m.caixa("MADEIRA_ESC", 0, 0.0, 0, 0.34, 0.03, 0.045, rot=(0, a, 0), bisel=0.005)


def fazer_ashtray(m):
    """Cinzeiro de vidro grosso (4 cm) com bitucas."""
    m.cil("CINZA", 0, 0.0, 0, 0.065, 0.035, seg=8, rtop=0.07, giro=math.pi / 8)
    m.cil("PRETO", 0, 0.032, 0, 0.048, 0.004, seg=8)
    for i, (x, z, a) in enumerate(((-0.02, 0.005, 20), (0.018, -0.012, -35))):
        m.caixa("BRANCO", x, 0.036, z, 0.03, 0.009, 0.009, rot=(0, a, 0))
        m.caixa("LARANJA", x + 0.014 * math.cos(math.radians(a)), 0.036, z - 0.014 * math.sin(math.radians(a)), 0.01, 0.009, 0.009, rot=(0, a, 0))


def fazer_pool_table(m):
    """Mesa de sinuca (1,4 × 2,6 m, longa no eixo z): corpo de madeira escura, pano verde, tabelas, caçapas e bolas."""
    W, L = 1.42, 2.62
    for sx in (-1, 1):
        for sz in (-1, 1):
            m.caixa("MADEIRA_ESC", sx * (W / 2 - 0.12), 0, sz * (L / 2 - 0.14), 0.16, 0.62, 0.16, top=(0.2, 0.2), bisel=0.012)
    m.caixa("MADEIRA_ESC", 0, 0.58, 0, W - 0.1, 0.2, L - 0.1, bisel=0.015)  # caixa
    R = 0.13  # largura das tabelas de madeira
    pano_w, pano_l = W - 2 * R, L - 2 * R
    m.caixa("FELTRO", 0, 0.76, 0, W - 0.04, 0.06, L - 0.04)  # o pano (topo a 0,82 m)
    for sx in (-1, 1):  # tabelas de madeira nas laterais e nas cabeceiras (topo a 0,85 m)
        m.caixa("MADEIRA", sx * (W / 2 - R / 2), 0.76, 0, R, 0.09, L, bisel=0.012)
    for sz in (-1, 1):
        m.caixa("MADEIRA", 0, 0.76, sz * (L / 2 - R / 2), W - 2 * R + 0.01, 0.09, R, bisel=0.012)
    # almofadas de feltro escuro encostadas nas tabelas
    for sx in (-1, 1):
        m.caixa("FELTRO_ESC", sx * (pano_w / 2 - 0.02), 0.82, 0, 0.05, 0.03, pano_l - 0.3, top=(0.025, pano_l - 0.36))
    for sz in (-1, 1):
        for sx in (-1, 1):
            m.caixa("FELTRO_ESC", sx * (pano_w / 4 + 0.05), 0.82, sz * (pano_l / 2 - 0.02), pano_w / 2 - 0.2, 0.03, 0.05, top=(pano_w / 2 - 0.26, 0.025))
    # caçapas: 4 cantos + 2 do meio
    for sx in (-1, 1):
        for sz in (-1, 1):
            m.cil("PRETO", sx * (W / 2 - 0.075), 0.845, sz * (L / 2 - 0.075), 0.06, 0.012, seg=8)
        m.cil("PRETO", sx * (W / 2 - 0.065), 0.845, 0, 0.055, 0.012, seg=8)
    # trilho de latão com os 'diamantes' marcados
    for sx in (-1, 1):
        for k in range(-3, 4):
            if k != 0:
                m.caixa("LATAO", sx * (W / 2 - 0.045), 0.85, k * 0.3, 0.025, 0.006, 0.025, rot=(0, 45, 0))
    # as bolas em triângulo, a branca e uma chamando a jogada
    cores = ["BOLA_AMARELA", "BOLA_AZUL", "BOLA_VERM", "BOLA_ROXA", "BOLA_PRETA", "BOLA_AMARELA", "BOLA_AZUL", "BOLA_VERM", "BOLA_ROXA", "BOLA_AMARELA"]
    rng = random.Random(3)
    k = 0
    for linha in range(4):
        for j in range(linha + 1):
            x = (j - linha / 2) * 0.062
            z = -0.55 - linha * 0.054
            m.ico(cores[k % len(cores)], x, 0.82 + 0.0285, z, 0.0285, sub=1)
            k += 1
    m.ico("BOLA_BRANCA", 0.12, 0.82 + 0.0285, 0.62, 0.0285, sub=1)


def _tapete(m, camadas, comp_x, comp_z):
    """Camadas de caixas aninhadas (do maior ao menor), cada uma um pouco mais alta: um tapete facetado."""
    y = 0.0
    for i, (mt, ix, iz) in enumerate(camadas):
        m.caixa(mt, 0, 0, 0, ix, 0.008 + 0.004 * i, iz)


def fazer_rug_ornate(m):
    """Tapete persa (2,11 × 2,80 m): borda azul, faixa ouro, campo vermelho, medalhão em losango e franjas."""
    lm, dm = 2.11, 2.8
    _tapete(m, [("TAPETE_AZUL", lm, dm), ("TAPETE_OURO", lm - 0.22, dm - 0.22), ("TAPETE_VERM", lm - 0.26, dm - 0.26), ("TAPETE_OURO", lm - 0.62, dm - 0.62), ("TAPETE_VERM", lm - 0.66, dm - 0.66)], lm, dm)
    # medalhão: 3 losangos concêntricos
    for k, (mt, r) in enumerate((("TAPETE_AZUL", 0.62), ("TAPETE_OURO", 0.5), ("TAPETE_CREME", 0.36), ("TAPETE_VERM", 0.22))):
        m.prisma(mt, [(0, -r * 1.35), (r, 0), (0, r * 1.35), (-r, 0)][::-1], 0.0, 0.026 + k * 0.0015)
    for sz in (-1, 1):
        for i in range(-8, 9):
            m.caixa("TAPETE_CREME", i * 0.12, 0, sz * (dm / 2 + 0.03), 0.04, 0.008, 0.06)


def fazer_rug_worn(m):
    """Tapete gasto (1,38 × 2,05 m): campo vinho com borda ocre e manchas de desgaste."""
    lm, dm = 1.38, 2.05
    _tapete(m, [("TAPETE_GASTO2", lm, dm), ("TAPETE_GASTO", lm - 0.16, dm - 0.16), ("TAPETE_GASTO2", lm - 0.5, dm - 0.5), ("TAPETE_GASTO", lm - 0.56, dm - 0.56)], lm, dm)
    for x, z, w, d in ((0.3, -0.5, 0.3, 0.22), (-0.2, 0.6, 0.26, 0.3), (0.1, 0.1, 0.18, 0.14)):
        m.caixa("TAPETE_GASTO2", x, 0, z, w, 0.02, d, rot=(0, 20, 0))
    for sz in (-1, 1):
        for i in range(-5, 6):
            m.caixa("TAPETE_CREME", i * 0.12, 0, sz * (dm / 2 + 0.025), 0.04, 0.006, 0.05)


def fazer_sideboard(m):
    """Aparador de 2 casas (1,4 m): corpo escuro, tampo claro, 2 portas com puxadores de latão, 4 pés."""
    w, d = 1.42, 0.46
    z = fundo_z(d)
    for sx in (-1, 1):
        for sz in (-1, 1):
            m.caixa("MADEIRA_ESC", sx * (w / 2 - 0.06), 0, z + sz * (d / 2 - 0.06), 0.06, 0.12, 0.06, top=(0.04, 0.04))
    m.caixa("MADEIRA", 0, 0.12, z, w - 0.04, 0.72, d - 0.04, bisel=0.012)
    for sx in (-1, 1):
        m.caixa("MADEIRA_MEDIA", sx * 0.34, 0.2, z + d / 2 - 0.012, 0.6, 0.58, 0.02, bisel=0.01)
        m.caixa("LATAO", sx * 0.07, 0.5, z + d / 2 + 0.01, 0.03, 0.12, 0.022)
    m.caixa("MADEIRA_CLARA", 0, 0.84, z, w + 0.02, 0.05, d + 0.02, bisel=0.012)


def fazer_bar_cabinet(m):
    """Armarinho do bar (1,0 m): corpo escuro com a porta e o puxador de latão, tampo claro."""
    w, d = 0.56, 0.42
    z = fundo_z(d)
    m.caixa("MADEIRA_ESC", 0, 0, z, w - 0.04, 0.06, d - 0.04)
    m.caixa("MADEIRA", 0, 0.06, z, w, 0.88, d, bisel=0.012)
    m.caixa("MADEIRA_MEDIA", 0, 0.13, z + d / 2 - 0.006, w - 0.1, 0.5, 0.018, bisel=0.01)
    m.caixa("MADEIRA_MEDIA", 0, 0.68, z + d / 2 - 0.006, w - 0.1, 0.2, 0.018, bisel=0.01)  # gaveta
    m.caixa("LATAO", 0.0, 0.76, z + d / 2 + 0.012, 0.1, 0.02, 0.02)
    m.cil("LATAO", w / 2 - 0.12, 0.38, z + d / 2 + 0.012, 0.014, 0.025, seg=6, rot=(90, 0, 0), alinhar="centro")
    m.caixa("MADEIRA_CLARA", 0, 0.94, z, w + 0.03, 0.05, d + 0.03, bisel=0.01)


def fazer_sofa_booth(m):
    """Sofá de cabine (1,4 m): base de couro vermelho, almofada do assento, encosto alto e braços."""
    w, d = 1.44, 0.62
    z = fundo_z(d) + 0.04
    m.caixa("MADEIRA_ESC", 0, 0, z, w - 0.04, 0.1, d - 0.04)
    m.caixa("COURO_VERM_ESC", 0, 0.1, z, w, 0.28, d, bisel=0.035)
    m.caixa("COURO_VERM", 0, 0.37, z + 0.06, w - 0.22, 0.1, d - 0.18, bisel=0.03)  # almofada
    m.caixa("COURO_VERM", 0, 0.37, z - d / 2 + 0.1, w - 0.04, 0.58, 0.16, bisel=0.04, rot=(-6, 0, 0))  # encosto
    for sx in (-1, 1):
        m.caixa("COURO_VERM_ESC", sx * (w / 2 - 0.06), 0.38, z + 0.0, 0.12, 0.3, d, bisel=0.03)
    for k in range(-2, 3):  # botões do capitonê
        m.caixa("COURO_VERM_ESC", k * 0.26, 0.62, z - d / 2 + 0.185, 0.04, 0.04, 0.02, rot=(0, 45, 0))


def fazer_ceiling_lamp(m):
    """Lâmpada pendente: a origem é no ponto do teto; o fio, a cúpula de metal e a lâmpada que acende (-y é para baixo)."""
    m.cil("PRETO", 0, -0.42, 0, 0.007, 0.42, seg=6)
    m.cil("METAL_ESC", 0, -0.12, 0, 0.03, 0.04, seg=6, alinhar="base") if False else None
    m.cil("AMARELO_ESC", 0, -0.55, 0, 0.19, 0.13, seg=8, rtop=0.04, giro=math.pi / 8)
    m.cil("METAL_ESC", 0, -0.43, 0, 0.04, 0.03, seg=8)
    m.ico("EMISSIVO", 0, -0.545, 0, 0.055, sub=1)


def fazer_dirt(m):
    """Sujeira no chão: 3 manchas irregulares muito baixas."""
    for pts, y in (([(-0.18, -0.08), (-0.02, -0.2), (0.16, -0.1), (0.2, 0.06), (0.02, 0.16), (-0.16, 0.1)], 0.0), ([(0.1, 0.14), (0.26, 0.1), (0.3, 0.24), (0.16, 0.28)], 0.0)):
        m.prisma("SUJEIRA", pts, y, 0.006)
    m.prisma("CINZA", [(-0.28, 0.2), (-0.2, 0.17), (-0.15, 0.26), (-0.25, 0.3)], 0.0, 0.009)


def fazer_mug(m):
    """Caneca branca com alça (10 cm)."""
    m.cil("BRANCO", 0, 0.0, 0, 0.042, 0.1, seg=8, rtop=0.046, giro=math.pi / 8)
    m.cil("MADEIRA_ESC", 0, 0.088, 0, 0.037, 0.008, seg=8)  # o café
    m.caixa("BRANCO", 0.062, 0.025, 0, 0.026, 0.06, 0.012, bisel=0.003)
    m.caixa("BRANCO", 0.056, 0.025, 0, 0.04, 0.012, 0.012)
    m.caixa("BRANCO", 0.056, 0.073, 0, 0.04, 0.012, 0.012)


def fazer_papers(m):
    """Papéis soltos: 4 folhas A4 levemente giradas."""
    for i, (x, z, a) in enumerate(((0, 0, 0), (0.03, 0.02, 14), (-0.02, -0.03, -20), (0.0, 0.04, 33))):
        m.caixa("PAPEL" if i % 2 == 0 else "BEGE", x, i * 0.0045, z, 0.21, 0.0045, 0.297, rot=(0, a, 0))


def fazer_candles(m):
    """Castiçal de latão com 3 velas e chamas (35 cm)."""
    m.cil("LATAO", 0, 0.0, 0, 0.075, 0.03, seg=8, rtop=0.05)
    m.cil("LATAO", 0, 0.03, 0, 0.016, 0.14, seg=6)
    m.caixa("LATAO", 0, 0.17, 0, 0.2, 0.02, 0.03, bisel=0.004)
    for x, h in ((-0.09, 0.1), (0.0, 0.14), (0.09, 0.1)):
        m.cil("LATAO", x, 0.19, 0, 0.026, 0.015, seg=6)
        m.cil("ESPUMA", x, 0.205, 0, 0.018, h, seg=6)
        m.cil("CHAMA", x, 0.205 + h, 0, 0.012, 0.045, seg=6, rtop=0.0)


def fazer_jarra_canecas(m):
    """Jarra de aço com canecas (30 cm)."""
    m.cil("METAL", 0, 0.0, 0, 0.095, 0.2, seg=8, rtop=0.105, giro=math.pi / 8)
    m.cil("METAL_ESC", 0, 0.19, 0, 0.11, 0.015, seg=8, giro=math.pi / 8)
    for x, z, h, c, a in ((-0.04, 0.0, 0.3, "BRANCO", 0), (0.04, 0.03, 0.27, "AMARELO", 0), (0.0, -0.045, 0.285, "LATA_AZUL", 0)):
        m.cil(c, x, 0.12, z, 0.032, h - 0.12, seg=6)


def fazer_computer_old(m):
    """Computador antigo: monitor de tubo bege com tela azul, teclado e um pé."""
    m.caixa("BEGE", 0, 0.0, -0.1, 0.26, 0.035, 0.26, bisel=0.008)  # pé giratório
    m.caixa("BEGE", 0, 0.035, -0.12, 0.4, 0.34, 0.36, top=(0.3, 0.22), top_off=(0, -0.06), bisel=0.02)  # tubo
    m.caixa("BEGE", 0, 0.035, -0.12 + 0.18, 0.4, 0.34, 0.012, bisel=0.006)  # moldura frontal
    m.caixa("PRETO", 0, 0.075, -0.12 + 0.186, 0.34, 0.26, 0.008)
    m.caixa("EMISSIVO_AZUL", 0, 0.085, -0.12 + 0.19, 0.3, 0.22, 0.006)
    m.caixa("EMISSIVO_VERDE", 0.15, 0.05, -0.12 + 0.186, 0.015, 0.012, 0.006)
    m.caixa("BEGE", 0, 0.0, 0.22, 0.38, 0.025, 0.13, top=(0.38, 0.1), bisel=0.005)  # teclado
    for i in range(10):
        m.caixa("CINZA", -0.15 + i * 0.033, 0.026, 0.22, 0.025, 0.006, 0.025) if i < 10 else None


def fazer_trash_can(m):
    """Lixeira de aço de 8 lados com aro e o saco escuro dentro (60 cm)."""
    m.cil("METAL", 0, 0.0, 0, 0.17, 0.56, seg=8, rtop=0.21, giro=math.pi / 8)
    m.cil("METAL_ESC", 0, 0.54, 0, 0.225, 0.045, seg=8, giro=math.pi / 8)
    m.cil("PRETO", 0, 0.575, 0, 0.19, 0.012, seg=8, rtop=0.17)
    m.cil("METAL_ESC", 0, 0.0, 0, 0.18, 0.04, seg=8, giro=math.pi / 8)
    m.ico("CINZA", 0.04, 0.6, 0.03, 0.07, sub=1, esc=(1, 0.7, 1))
    for sx in (-1, 1):
        m.caixa("METAL_ESC", sx * 0.205, 0.38, 0, 0.03, 0.04, 0.09, bisel=0.005)


def fazer_crate_wood(m):
    """Caixote grande de madeira de 0,80 m: 4 postes de canto, ripas e um X de reforço na frente."""
    s = 0.64
    h = 0.8
    for sx in (-1, 1):
        for sz in (-1, 1):
            m.caixa("MADEIRA_ESC", sx * (s / 2 - 0.035), 0, sz * (s / 2 - 0.035), 0.07, h, 0.07, bisel=0.006)
    for y in (0.08, 0.3, 0.52):
        for sz in (-1, 1):
            m.caixa("MADEIRA", 0, y, sz * (s / 2 - 0.012), s - 0.1, 0.17, 0.024, bisel=0.004)
        for sx in (-1, 1):
            m.caixa("MADEIRA", sx * (s / 2 - 0.012), y, 0, 0.024, 0.17, s - 0.1, bisel=0.004)
    m.caixa("MADEIRA_MEDIA", 0, h - 0.05, 0, s, 0.05, s, bisel=0.008)  # tampa
    for a in (38, -38):
        m.caixa("MADEIRA_MEDIA", 0, 0.4, s / 2 + 0.004, 0.78, 0.05, 0.016, rot=(0, 0, a), alinhar="centro", bisel=0.004)


def fazer_floor_lamp(m):
    """Luminária de pé (1,90 m): base octogonal de aço, haste fina e cúpula que brilha."""
    m.cil("METAL_ESC", 0, 0.0, 0, 0.15, 0.035, seg=8, rtop=0.12, giro=math.pi / 8)
    m.cil("METAL_ESC", 0, 0.035, 0, 0.016, 1.55, seg=6)
    m.cil("LATAO", 0, 0.9, 0, 0.026, 0.04, seg=6)
    m.cil("EMISSIVO", 0, 1.58, 0, 0.23, 0.3, seg=8, rtop=0.14, giro=math.pi / 8)
    m.cil("METAL_ESC", 0, 1.88, 0, 0.14, 0.012, seg=8, giro=math.pi / 8)
    m.cil("METAL_ESC", 0, 1.58, 0, 0.23, 0.012, seg=8, giro=math.pi / 8)


def fazer_cables_floor(m):
    """Cabos no chão (3 casas): três cabos pretos em zigue-zague e um plugue."""
    rng = random.Random(5)
    for k, z0 in enumerate((-0.2, 0.0, 0.22)):
        pts = []
        for i in range(5):
            pts.append((-1.0 + i * 0.5, z0 + rng.uniform(-0.05, 0.05)))
        for a, b in zip(pts, pts[1:]):
            barra(m, "CABO", a, b, 0.022, 0.012)
    m.caixa("METAL_ESC", -1.02, 0.0, -0.2, 0.06, 0.02, 0.045, bisel=0.004)
    m.caixa("CINZA", 0.98, 0.0, 0.2, 0.08, 0.025, 0.06, bisel=0.004)


def fazer_puddle(m):
    """Poça d'água: um polígono baixo e translúcido, com uma gota de lado."""
    m.prisma("POCA", [(-0.22, -0.05), (-0.1, -0.2), (0.12, -0.17), (0.25, 0.0), (0.16, 0.18), (-0.06, 0.22), (-0.2, 0.12)], 0.0, 0.008)
    m.prisma("POCA", [(0.26, 0.2), (0.32, 0.17), (0.34, 0.25), (0.28, 0.27)], 0.0, 0.007)


MODELOS = {
    "stairs_down": fazer_stairs_down,
    "beer_fridge": fazer_beer_fridge,
    "bar_shelf": fazer_bar_shelf,
    "minibar": fazer_minibar,
    "beer_crate": fazer_beer_crate,
    "keg": fazer_keg,
    "fridge_drinks": fazer_fridge_drinks,
    "bar_counter": fazer_bar_counter,
    "beer_glass": fazer_beer_glass,
    "stool_bar": fazer_stool_bar,
    "armchair_red": fazer_armchair_red,
    "plant": fazer_plant,
    "arcade": fazer_arcade,
    "chair_stack": fazer_chair_stack,
    "table_bar": fazer_table_bar,
    "chair_bar": fazer_chair_bar,
    "ashtray": fazer_ashtray,
    "pool_table": fazer_pool_table,
    "rug_ornate": fazer_rug_ornate,
    "rug_worn": fazer_rug_worn,
    "sideboard": fazer_sideboard,
    "bar_cabinet": fazer_bar_cabinet,
    "sofa_booth": fazer_sofa_booth,
    "ceiling_lamp": fazer_ceiling_lamp,
    "dirt": fazer_dirt,
    "mug": fazer_mug,
    "papers": fazer_papers,
    "candles": fazer_candles,
    "jarra_canecas": fazer_jarra_canecas,
    "computer_old": fazer_computer_old,
    "trash_can": fazer_trash_can,
    "crate_wood": fazer_crate_wood,
    "table_small": fazer_table_small,
    "floor_lamp": fazer_floor_lamp,
    "cables_floor": fazer_cables_floor,
    "puddle": fazer_puddle,
}
