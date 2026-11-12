"""
Alosi Walker em 3D de verdade (malha), LOW-POLY FACETADO, 1,80 m, com esqueleto simples e quatro animações
(Idle, Walk, Armado_idle, Caido). Referência: docs/referencias-3d/alosi-lowpoly-folha.webp.

  "F:/Programas/Blender 5.2/blender.exe" -b --factory-startup -P scripts/3d/lowpoly/personagem_alosi.py -- [opções]

Opções:
  --previa PASTA     renderiza vistas de conferência (PNG) em PASTA e não exporta
  --pose NOME[@t]    pose da prévia: repouso | idle | walk@0.25 | armado | caido
  --sem-glb          não exporta o GLB

Convenção das coordenadas = a de lib.py (x direita do observador, y CIMA, z FRENTE do personagem = +Z; o lado ESQUERDO do
personagem é +X). Metros. Origem: no chão, entre os pés. Cada parte rígida vai presa a um osso (peso 1), e os ossos têm
orientação neutra (eixos do mundo), então girar um osso em X é inclinar para a frente ou para trás.
"""
import math
import os
import random
import sys

import bmesh
import bpy
from mathutils import Matrix, Vector

AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, AQUI)
import lib  # noqa: E402
from lib import Modelo  # noqa: E402

RAIZ = os.path.abspath(os.path.join(AQUI, "..", "..", ".."))
SAIDA = os.path.join(RAIZ, "client", "public", "prototipo3d", "lowpoly", "personagens", "alosi.glb")
args = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []


def opcao(nome, padrao=None):
    return args[args.index(nome) + 1] if nome in args else padrao


# ------------------------------------------------------------------ cores (chapadas, sem textura)
lib.PALETA.update({
    "CABELO": "#4f3427", "CABELO_ESC": "#35221a", "CABELO_CLARO": "#69442b",
    "PELE": "#eac49f", "PELE_ESC": "#d6a67f", "PELE_CLARA": "#f3d3b3",
    "OLHO": "#20150f", "OLHO_BRANCO": "#efe9e0", "BOCA": "#b3705e",
    "CAMISA": "#f1eee9", "CAMISA_SOMB": "#d4d0ca",
    "CASACO": "#e3d6bd", "CASACO_ESC": "#c3b499", "CASACO_CLARO": "#e9dfca",
    "OURO": "#cba43b", "OURO_CLARO": "#e6c25a",
    "CALCA": "#222128", "CALCA_CLARA": "#2d2c35",
    "SAPATO": "#141318", "SAPATO_CLARO": "#24222a", "SOLA": "#0b0a0d",
    "COURO_PRETO": "#19171c", "ARO": "#6a4220",
    "LIVRO": "#5b3519", "LIVRO_ESC": "#3b2210", "PAGINA": "#e6d8b2", "PAGINA_ESC": "#cdbd92", "TINTA": "#6a4f35",
})

SEMENTE = random.Random(11)
FRENTE_Z = 1.0


# ------------------------------------------------------------------ ferramentas de forma
def anel(y, rx, rz, cx=0.0, cz=0.0, n=8, giro=22.5):
    """Um anel de n pontos (octógono por padrão, com uma face reta para a frente e para os lados) na altura y."""
    pts = []
    for i in range(n):
        a = math.radians(giro + 360.0 * i / n)
        pts.append((cx + rx * math.cos(a), y, cz + rz * math.sin(a)))
    return pts


def loft(m, mt, aneis, base=True, topo=True, ruido=0.0, rng=None):
    """Malha fechada por anéis (cada um uma lista de pontos com o mesmo tamanho); `ruido` tira a planura das faces."""
    rng = rng or SEMENTE
    n = len(aneis[0])
    verts = []
    for a in aneis:
        for p in a:
            verts.append((p[0] + rng.uniform(-ruido, ruido), p[1] + rng.uniform(-ruido, ruido) * 0.5, p[2] + rng.uniform(-ruido, ruido)))
    faces = []
    for k in range(len(aneis) - 1):
        for i in range(n):
            j = (i + 1) % n
            faces.append((k * n + i, k * n + j, (k + 1) * n + j, (k + 1) * n + i))
    if base:
        faces.append(tuple(reversed(range(n))))
    if topo:
        faces.append(tuple(range((len(aneis) - 1) * n, len(aneis) * n)))
    m.poligono(mt, verts, faces, (0, 0, 0), (0, 0, 0))


def lofta(m, mt, niveis, cx=0.0, cz=0.0, n=8, giro=22.5, ruido=0.0, base=True, topo=True):
    """niveis = [(y, rx, rz)] ou [(y, rx, rz, dx, dz)] com deslocamento do centro."""
    aneis = []
    for nv in niveis:
        y, rx, rz = nv[:3]
        dx = nv[3] if len(nv) > 3 else 0.0
        dz = nv[4] if len(nv) > 4 else 0.0
        aneis.append(anel(y, rx, rz, cx + dx, cz + dz, n, giro))
    loft(m, mt, aneis, base, topo, ruido)


def tufo(m, mt, c, r, esc=(1, 1, 1), rot=(0, 0, 0), jit=0.2, rng=None):
    """Icosaedro irregular (20 faces, cada uma de um tamanho): o chumaço de cabelo."""
    rng = rng or SEMENTE
    tmp = bmesh.new()
    bmesh.ops.create_icosphere(tmp, subdivisions=1, radius=r)
    idx = {v: i for i, v in enumerate(tmp.verts)}
    verts = [(v.co.x * esc[0] * (1 + rng.uniform(-jit, jit)), v.co.y * esc[1] * (1 + rng.uniform(-jit, jit)), v.co.z * esc[2] * (1 + rng.uniform(-jit, jit))) for v in tmp.verts]
    faces = [tuple(idx[v] for v in f.verts) for f in tmp.faces]
    tmp.free()
    m.poligono(mt, verts, faces, c, rot)


def transformar(m, f):
    for bm in m.bms.values():
        for v in bm.verts:
            v.co = f(v.co)


def bl(p):
    return Vector((p[0], -p[2], p[1]))


def md(b):
    return Vector((b.x, b.z, -b.y))


# ------------------------------------------------------------------ ossos (nome: (cabeça no sistema do modelo, pai))
OSSOS = {
    "hips": ((0, 0.88, 0), None),
    "spine": ((0, 0.95, 0), "hips"),
    "head": ((0, 1.47, -0.01), "spine"),
    "arm.L": ((0.215, 1.36, 0), "spine"),
    "forearm.L": ((0.241, 1.10, 0), "arm.L"),
    "arm.R": ((-0.215, 1.36, 0), "spine"),
    "forearm.R": ((-0.241, 1.10, 0), "arm.R"),
    "thigh.L": ((0.095, 0.88, 0), "hips"),
    "shin.L": ((0.095, 0.49, 0), "thigh.L"),
    "foot.L": ((0.095, 0.09, 0), "shin.L"),
    "thigh.R": ((-0.095, 0.88, 0), "hips"),
    "shin.R": ((-0.095, 0.49, 0), "thigh.R"),
    "foot.R": ((-0.095, 0.09, 0), "shin.R"),
    "livro_fechado": ((0.19, 1.0, 0.19), "spine"),
    "livro_aberto": ((-0.27, 1.2, 0.25), "forearm.R"),  # a cabeça é reposta depois (livro posto na mão)
}

PARTES = {}
HEAD_ESC = 1.2
LIVRO_OFF = (-0.05, 0.06, 0.03)
KG = 1.0


def P(osso):
    if osso not in PARTES:
        PARTES[osso] = Modelo("parte_" + osso.replace(".", "_"))
    return PARTES[osso]


def lado(s):
    return ".L" if s > 0 else ".R"


# ------------------------------------------------------------------ cabeça
def fazer_cabeca():
    h = P("head")
    # crânio e rosto: octógono com faces retas na frente e nos lados, queixo estreito
    lofta(h, "PELE", [
        (1.484, 0.040, 0.044, 0, 0.040),
        (1.506, 0.066, 0.066, 0, 0.030),
        (1.545, 0.088, 0.086, 0, 0.014),
        (1.600, 0.097, 0.097, 0, 0.005),
        (1.660, 0.099, 0.099, 0, 0.0),
        (1.720, 0.094, 0.096, 0, -0.004),
        (1.762, 0.070, 0.080, 0, -0.008),
    ], ruido=0.0018)
    zf = 0.094  # a face da frente na altura dos olhos
    # nariz, boca, olhos, sobrancelhas
    h.caixa("PELE_ESC", 0, 1.598, zf + 0.002, 0.022, 0.034, 0.030, top=(0.011, 0.020), bisel=0.002)
    h.caixa("BOCA", 0, 1.552, zf - 0.001, 0.040, 0.007, 0.006)
    for s in (1, -1):
        h.caixa("OLHO_BRANCO", s * 0.044, 1.620, zf - 0.001, 0.040, 0.026, 0.006)
        h.caixa("OLHO", s * 0.044, 1.618, zf + 0.001, 0.024, 0.030, 0.008, bisel=0.003)
        h.caixa("CABELO_ESC", s * 0.047, 1.664, zf + 0.001, 0.056, 0.015, 0.014, rot=(0, 0, s * 11), bisel=0.002)
        # orelha
        h.caixa("PELE_ESC", s * 0.100, 1.600, -0.006, 0.016, 0.046, 0.032, top=(0.012, 0.026), bisel=0.003)
        h.caixa("PELE", s * 0.108, 1.612, -0.003, 0.008, 0.024, 0.018)
    # óculos redondos de aro marrom
    for s in (1, -1):
        cx0, cy0, r = s * 0.047, 1.622, 0.036
        n = 10
        for i in range(n):
            a = 2 * math.pi * i / n
            seg = 2 * math.pi * r / n
            h.caixa("ARO", cx0 + r * math.cos(a), 1.0, 0, 0.0, 0.0, 0.0) if False else None
            h.caixa("ARO", cx0 + r * math.cos(a), cy0 + r * math.sin(a), zf + 0.006, seg * 1.15, 0.0065, 0.009,
                    rot=(0, 0, math.degrees(a) + 90), alinhar="centro")
        # haste até a orelha
        h.caixa("ARO", s * 0.0975, 1.628, 0.036, 0.006, 0.007, 0.128)
        h.caixa("ARO", s * 0.0905, 1.628, 0.094, 0.020, 0.007, 0.008, rot=(0, s * -10, 0))
    h.caixa("ARO", 0, 1.634, zf + 0.006, 0.026, 0.007, 0.008)

    # cabelo: base escura por baixo e chumaços facetados por cima
    rng = random.Random(5)
    tufo(h, "CABELO_ESC", (0, 1.672, -0.022), 0.118, esc=(1.0, 0.93, 1.07), jit=0.05, rng=rng)
    mats = ["CABELO"] * 5 + ["CABELO_ESC"] * 3 + ["CABELO_CLARO"] * 3
    c = (0.0, 1.668, -0.02)
    ndiv = {-25: 8, 5: 9, 30: 8, 55: 6, 78: 3}
    for el, qtd in ndiv.items():
        for k in range(qtd):
            az = 360.0 * (k + 0.5 * (el % 20 > 0)) / qtd + rng.uniform(-14, 14)
            a = math.radians(az)
            e = math.radians(el + rng.uniform(-6, 6))
            # az 0 = frente (+z)
            dx, dy, dz = math.sin(a) * math.cos(e), math.sin(e), math.cos(a) * math.cos(e)
            if dz > 0.35 and el < 50:  # a testa fica livre (a franja entra à parte)
                continue
            R = 0.108 + rng.uniform(-0.004, 0.012)
            r = rng.uniform(0.050, 0.068)
            esc = (rng.uniform(0.9, 1.25), rng.uniform(0.8, 1.15), rng.uniform(0.9, 1.25))
            tufo(h, rng.choice(mats), (c[0] + dx * R, c[1] + dy * R * 1.03, c[2] + dz * R), r, esc,
                 rot=(rng.uniform(0, 90), rng.uniform(0, 90), rng.uniform(0, 90)), jit=0.22, rng=rng)
    # topo volumoso e ondulado
    for (x, y, z, r) in [(0.0, 1.790, 0.0, 0.058), (-0.05, 1.782, -0.04, 0.056), (0.055, 1.78, -0.035, 0.055), (0.0, 1.78, -0.07, 0.056),
                         (-0.075, 1.755, 0.01, 0.052), (0.08, 1.757, 0.01, 0.052)]:
        tufo(h, rng.choice(mats), (x, y, z), r, (1.2, 0.9, 1.15), rot=(rng.uniform(0, 90), rng.uniform(0, 90), 0), jit=0.22, rng=rng)
    # franja: chumaços que caem na testa, repartidos para os lados
    for (x, y, z, rz, esc) in [(-0.075, 1.727, 0.078, 22, (0.9, 1.35, 0.8)), (-0.040, 1.737, 0.090, 12, (0.9, 1.3, 0.8)), (-0.005, 1.742, 0.093, 0, (0.85, 1.2, 0.75)),
                               (0.032, 1.740, 0.092, -12, (0.9, 1.3, 0.8)), (0.068, 1.734, 0.085, -20, (0.9, 1.35, 0.8)), (0.092, 1.700, 0.055, -10, (0.7, 1.4, 0.9))]:
        tufo(h, rng.choice(mats), (x, y, z), 0.036, esc, rot=(0, 0, rz), jit=0.2, rng=rng)
    # costeletas e nuca
    for s in (1, -1):
        tufo(h, "CABELO_ESC", (s * 0.097, 1.652, 0.018), 0.030, (0.55, 1.5, 0.85), jit=0.18, rng=rng)
        tufo(h, "CABELO", (s * 0.09, 1.605, -0.075), 0.040, (1.0, 1.0, 1.0), jit=0.2, rng=rng)
    for (x, y, z, r) in [(0, 1.585, -0.095, 0.046), (-0.045, 1.595, -0.082, 0.04), (0.045, 1.595, -0.082, 0.04)]:
        tufo(h, rng.choice(mats), (x, y, z), r, (1.1, 0.9, 1.0), jit=0.2, rng=rng)


# ------------------------------------------------------------------ tronco, casaco, capuz
def facetas(rx, rz, n=8, giro=22.5):
    """O ponto médio e o giro (graus, em torno de y) de cada face lateral de um anel octogonal."""
    pts = [(rx * math.cos(math.radians(giro + 360.0 * i / n)), rz * math.sin(math.radians(giro + 360.0 * i / n))) for i in range(n)]
    out = []
    for i in range(n):
        a, b = pts[i], pts[(i + 1) % n]
        mid = ((a[0] + b[0]) / 2, (a[1] + b[1]) / 2)
        tx, tz = b[0] - a[0], b[1] - a[1]
        out.append((mid, -math.degrees(math.atan2(tz, tx)) % 360.0))
    return out


def fazer_tronco():
    t = P("spine")
    # camisa por baixo e gola alta de padre
    lofta(t, "CAMISA", [(0.94, 0.168, 0.098), (1.20, 0.172, 0.102), (1.38, 0.152, 0.092), (1.43, 0.085, 0.068)], ruido=0.0015)
    t.cil("CAMISA", 0, 1.395, 0, 0.066, 0.098, seg=8, rtop=0.058, giro=math.radians(22.5))
    t.caixa("CAMISA_SOMB", 0, 1.43, 0.058, 0.026, 0.040, 0.007)  # a pecinha da gola de clérigo
    # casaco
    niveis = [(0.945, 0.184, 0.113), (0.99, 0.192, 0.118), (1.12, 0.187, 0.114), (1.26, 0.198, 0.112), (1.355, 0.204, 0.100),
              (1.400, 0.158, 0.084), (1.432, 0.092, 0.068)]
    lofta(t, "CASACO", niveis, ruido=0.0035)
    lofta(t, "CASACO_ESC", [(0.940, 0.188, 0.118), (0.978, 0.194, 0.120)], ruido=0.001, topo=False, base=True)
    # faixa da camisa que aparece com o casaco aberto, e o zíper
    zf = 0.113 * math.cos(math.radians(22.5)) + 0.002
    t.caixa("CAMISA", 0, 0.948, zf, 0.098, 0.455, 0.006)
    for s in (1, -1):
        t.caixa("CASACO_CLARO", s * 0.0545, 0.948, zf + 0.001, 0.016, 0.455, 0.007)
        t.caixa("OURO", s * 0.047, 0.948, zf + 0.004, 0.0065, 0.455, 0.0055)
        t.caixa("OURO_CLARO", s * 0.047, 1.30, zf + 0.007, 0.014, 0.034, 0.007)  # o puxador
    # bolsos de zíper nas faces inclinadas do peito
    for s in (1, -1):
        for (mid, giro) in facetas(0.188, 0.115):
            if mid[1] > 0.05 and s * mid[0] > 0.09:
                t.caixa("CASACO_ESC", mid[0], 0.99, mid[1], 0.062, 0.17, 0.006, rot=(0, giro, 0), bisel=0.001)
                t.caixa("OURO", mid[0], 1.015, mid[1] + 0.005 * math.cos(math.radians(giro)), 0.0065, 0.13, 0.0065, rot=(0, giro, -s * 7), alinhar="base")
    # capuz caído nas costas e os lados que sobem em volta do pescoço
    t.caixa("CASACO", 0, 1.19, -0.138, 0.140, 0.27, 0.060, top=(0.270, 0.085), top_off=(0, 0.01), bisel=0.01, rot=(-3, 0, 0))
    t.caixa("CASACO_CLARO", 0, 1.37, -0.140, 0.20, 0.08, 0.05, top=(0.23, 0.07), bisel=0.008, rot=(-6, 0, 0))
    tufo(t, "CASACO", (0.0, 1.43, -0.11), 0.08, (1.6, 0.95, 0.95), jit=0.1)
    tufo(t, "CASACO_CLARO", (0.0, 1.45, -0.125), 0.05, (1.7, 0.9, 0.8), jit=0.1)
    for s in (1, -1):
        t.caixa("CASACO", s * 0.098, 1.385, -0.030, 0.040, 0.075, 0.150, top=(0.034, 0.13), bisel=0.007, rot=(0, 0, s * -12))
    # corrente com crucifixo dourado
    pts = lambda s: [(s * 0.058, 1.425, 0.056), (s * 0.046, 1.35, 0.110), (s * 0.022, 1.27, 0.117), (0.0, 1.222, 0.118)]
    for s in (1, -1):
        p = pts(s)
        for i in range(len(p) - 1):
            a, b = Vector(p[i]), Vector(p[i + 1])
            mid = (a + b) / 2
            d = b - a
            comp = d.length
            ang_z = math.degrees(math.atan2(d.x, d.y))  # inclinação no plano da frente
            ang_x = -math.degrees(math.atan2(d.z, math.hypot(d.x, d.y)))
            t.caixa("OURO", mid.x, mid.y, mid.z, 0.0055, comp + 0.004, 0.0055, rot=(ang_x, 0, -ang_z), alinhar="centro")
    t.caixa("OURO_CLARO", 0, 1.095, 0.121, 0.016, 0.130, 0.008, bisel=0.002)
    t.caixa("OURO_CLARO", 0, 1.168, 0.121, 0.060, 0.016, 0.008, bisel=0.002)
    t.caixa("OURO", 0, 1.216, 0.119, 0.014, 0.014, 0.008, rot=(0, 0, 45))


# ------------------------------------------------------------------ quadril: cinto, fivela, corrente, carteira
def fazer_quadril():
    q = P("hips")
    lofta(q, "COURO_PRETO", [(0.885, 0.176, 0.108), (0.948, 0.180, 0.111)], ruido=0.001, topo=True, base=True)
    zf = 0.111 * math.cos(math.radians(22.5)) + 0.001
    q.caixa("OURO_CLARO", 0, 0.893, zf, 0.058, 0.052, 0.010, bisel=0.003)
    q.caixa("COURO_PRETO", 0, 0.903, zf + 0.004, 0.032, 0.030, 0.008)
    q.caixa("OURO", 0, 0.912, zf + 0.007, 0.006, 0.020, 0.006, rot=(0, 0, 0))
    # entre-pernas e cós da calça
    lofta(q, "CALCA", [(0.78, 0.178, 0.104), (0.86, 0.188, 0.110), (0.895, 0.176, 0.108)], ruido=0.002)
    # corrente que pende do cinto, no lado esquerdo do personagem (+x)
    caminho = [(0.150, 0.918, 0.075), (0.186, 0.895, 0.108), (0.214, 0.850, 0.098), (0.232, 0.800, 0.060), (0.226, 0.750, 0.020)]
    return caminho


def fazer_corrente_e_carteira(caminho):
    q, c = P("hips"), P("thigh.L")
    # pontos suavizados por Catmull-Rom simples
    def interp(pts, n):
        out = []
        for i in range(len(pts) - 1):
            p0, p1, p2, p3 = pts[max(i - 1, 0)], pts[i], pts[i + 1], pts[min(i + 2, len(pts) - 1)]
            for k in range(n):
                t = k / n
                out.append(tuple(0.5 * ((2 * p1[j]) + (-p0[j] + p2[j]) * t + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * t * t + (-p0[j] + 3 * p1[j] - 3 * p2[j] + p3[j]) * t ** 3) for j in range(3)))
        out.append(pts[-1])
        return out
    pontos = interp(caminho, 4)
    for i in range(len(pontos) - 1):
        a, b = Vector(pontos[i]), Vector(pontos[i + 1])
        mid = (a + b) / 2
        d = b - a
        osso = q if mid.y > 0.82 else c
        ang_x = -math.degrees(math.atan2(d.z, math.hypot(d.x, d.y)))
        ang_z = -math.degrees(math.atan2(d.x, d.y))
        osso.caixa("OURO", mid.x, mid.y, mid.z, 0.012 if i % 2 else 0.008, d.length + 0.006, 0.010 if i % 2 == 0 else 0.007, rot=(ang_x, 0, ang_z), alinhar="centro")
    # a carteira (estojo) preta presa na ponta da corrente
    c.caixa("COURO_PRETO", 0.226, 0.640, 0.020, 0.058, 0.118, 0.032, bisel=0.004)
    c.caixa("SAPATO_CLARO", 0.226, 0.712, 0.020, 0.062, 0.012, 0.036, bisel=0.002)
    c.caixa("OURO", 0.226, 0.722, 0.038, 0.020, 0.012, 0.006)


# ------------------------------------------------------------------ braços e mãos
def fazer_braco(s):
    sx = lambda y: s * (0.215 + (1.36 - y) * 0.10)  # o braço pende um pouco aberto
    a = P("arm" + lado(s))
    f = P("forearm" + lado(s))
    # ombro e manga de cima
    tufo(a, "CASACO", (sx(1.335), 1.335, 0), 0.078, (1.0, 0.95, 1.0), jit=0.05)
    lofta(a, "CASACO", [(1.385, 0.072, 0.070, sx(1.385)), (1.30, 0.072, 0.068, sx(1.30)), (1.20, 0.067, 0.063, sx(1.20)), (1.10, 0.063, 0.060, sx(1.10))], ruido=0.003)
    # cotovelo e manga de baixo (larga), punho
    tufo(f, "CASACO", (sx(1.10), 1.10, 0), 0.066, (1.0, 0.9, 1.0), jit=0.05)
    lofta(f, "CASACO", [(1.10, 0.063, 0.060, sx(1.10)), (1.02, 0.064, 0.060, sx(1.02)), (0.945, 0.062, 0.058, sx(0.945))], ruido=0.003, base=False)
    lofta(f, "CASACO_ESC", [(0.945, 0.058, 0.056, sx(0.945)), (0.925, 0.056, 0.054, sx(0.925)), (0.872, 0.054, 0.052, sx(0.872))], ruido=0.001)
    # mão grossa: palma, dedos meio fechados e o polegar
    x = sx(0.84)
    f.caixa("PELE", x, 0.790, 0.0, 0.078, 0.070, 0.052, top=(0.082, 0.056), bisel=0.005)
    f.caixa("PELE", x, 0.722, 0.010, 0.074, 0.074, 0.046, top=(0.078, 0.050), bisel=0.005, rot=(-12, 0, 0))
    f.caixa("PELE_ESC", x, 0.700, 0.026, 0.066, 0.030, 0.026, bisel=0.004, rot=(-30, 0, 0))
    f.caixa("PELE", x - s * 0.046, 0.775, 0.018, 0.030, 0.062, 0.034, bisel=0.004, rot=(-14, 0, s * 12))
    f.caixa("PELE_ESC", x, 0.862, 0.0, 0.052, 0.014, 0.040)  # o pulso


# ------------------------------------------------------------------ pernas e sapatos
def fazer_perna(s):
    cx = s * 0.095
    th = P("thigh" + lado(s))
    sh = P("shin" + lado(s))
    ft = P("foot" + lado(s))
    lofta(th, "CALCA", [(0.955, 0.100, 0.108, cx), (0.80, 0.099, 0.104, cx), (0.65, 0.096, 0.099, cx), (0.50, 0.093, 0.094, cx)], ruido=0.0028)
    tufo(sh, "CALCA", (cx, 0.495, 0.0), 0.088, (1.0, 0.85, 1.0), jit=0.05)
    lofta(sh, "CALCA", [(0.50, 0.093, 0.094, cx), (0.30, 0.092, 0.095, cx), (0.15, 0.094, 0.099, cx), (0.098, 0.097, 0.104, cx)], ruido=0.0028)
    lofta(sh, "CALCA_CLARA", [(0.112, 0.097, 0.101, cx), (0.098, 0.099, 0.106, cx)], ruido=0.001, topo=False)
    # sapato grosso: sola, corpo, bico, cano
    ft.caixa("SOLA", cx, 0.0, 0.058, 0.124, 0.030, 0.272, bisel=0.008, rot=(0, s * -4, 0))
    ft.caixa("SAPATO", cx, 0.026, 0.050, 0.116, 0.066, 0.246, top=(0.100, 0.200), top_off=(0, 0.012), bisel=0.011, rot=(0, s * -4, 0))
    ft.caixa("SAPATO_CLARO", cx + s * 0.003, 0.050, 0.152, 0.108, 0.046, 0.092, top=(0.088, 0.070), top_off=(0, -0.004), bisel=0.012, rot=(0, s * -4, 0))
    ft.caixa("SAPATO", cx, 0.072, -0.012, 0.100, 0.052, 0.092, top=(0.092, 0.084), bisel=0.008)
    ft.caixa("COURO_PRETO", cx, 0.094, 0.075, 0.046, 0.007, 0.090, bisel=0.002, rot=(-12, 0, 0))
    ft.caixa("SAPATO_CLARO", cx, 0.060, -0.060, 0.102, 0.050, 0.020, bisel=0.004)  # o calcanhar


# ------------------------------------------------------------------ livros
def lombada_sol(lv, z, raio=0.026, escala=1.0):
    """O sol dourado da capa: disco de 8 lados e oito raios triangulares."""
    lv.cil("OURO", 0, z, 0, raio * escala, 0.004, seg=8, rot=(90, 0, 0), alinhar="centro")
    lv.cil("LIVRO_ESC", 0, z + 0.0005, 0, raio * 0.55 * escala, 0.0047, seg=8, rot=(90, 0, 0), alinhar="centro")
    for i in range(8):
        a = math.radians(45 * i + 22.5)
        rr = raio * 1.32 * escala
        lv.cil("OURO_CLARO", rr * math.cos(a), z, rr * math.sin(a), raio * 0.30 * escala, raio * 0.95 * escala, seg=3, rtop=0.0,
               rot=(90, 0, math.degrees(a) + 90 - 90), alinhar="centro") if False else None
    for i in range(8):
        a = i * math.pi / 4
        rr = raio * 1.40 * escala
        # raio: um cone achatado apontando para fora; colocado no plano da capa (xy)
        x, y = rr * math.cos(a), rr * math.sin(a)
        lv.caixa("OURO_CLARO", x, y, z, raio * 0.34 * escala, raio * 0.90 * escala, 0.004, rot=(0, 0, math.degrees(a) - 90), top=(raio * 0.05, 0.004), alinhar="centro")


def livro_fechado():
    lv = Modelo("livro_fechado")
    # no sistema do livro: x largura, y altura, z para fora da capa
    W, H, D = 0.150, 0.215, 0.046
    lv.caixa("LIVRO", 0, 0, 0, W, H, D, bisel=0.004, alinhar="centro")
    lv.caixa("PAGINA", W * 0.02, 0, 0.0, W * 0.94, H * 0.94, D * 0.78, alinhar="centro")  # miolo aparece na borda
    lv.caixa("LIVRO", 0, 0, 0, W, H, D * 0.62, bisel=0.004, alinhar="centro")
    lv.caixa("LIVRO", 0, 0, 0, W, H, D, bisel=0.004, alinhar="centro") if False else None
    lv.caixa("LIVRO_ESC", -W / 2, 0, 0, 0.014, H, D * 1.04, bisel=0.003, alinhar="centro")  # lombada
    for i, (sx, sy) in enumerate([(1, 1), (1, -1), (-1, 1), (-1, -1)]):
        lv.caixa("OURO", sx * (W / 2 - 0.012), sy * (H / 2 - 0.012), D / 2, 0.020, 0.020, 0.004, alinhar="centro")
    lv.caixa("OURO", 0, H / 2 - 0.014, D / 2, W * 0.78, 0.004, 0.003, alinhar="centro")
    lv.caixa("OURO", 0, -H / 2 + 0.014, D / 2, W * 0.78, 0.004, 0.003, alinhar="centro")
    lombada_sol(lv, D / 2 + 0.001, escala=1.0)
    return lv


def livro_aberto():
    lv = Modelo("livro_aberto")
    W, H = 0.135, 0.205
    ang = 17.0
    for s in (1, -1):  # s=+1: metade da direita (em x positivo)
        rotY = -s * ang
        cx = s * W / 2
        # capa por trás, miolo de páginas e a folha de cima
        pecas = [
            ("LIVRO", cx, 0, -0.018, W + 0.010, H + 0.012, 0.008),
            ("PAGINA_ESC", cx, 0, -0.004, W - 0.004, H - 0.008, 0.020),
            ("PAGINA", cx, 0, 0.008, W - 0.010, H - 0.014, 0.004),
        ]
        for (mt, x, y, z, w, h, d) in pecas:
            lv.caixa(mt, x, y, z, w, h, d, bisel=0.002, alinhar="centro", rot=(0, rotY, 0))
        # linhas de texto e o sol de uma folha
        for i in range(6):
            yy = H * 0.32 - i * 0.034
            wl = (W - 0.040) * (0.85 if i % 3 else 0.6)
            xl = cx - s * (W - 0.040 - wl) / 2 * 0 + (-s * 0.0 if s > 0 else 0)
            lv.caixa("TINTA", cx + (0 if s < 0 else 0.0), yy, 0.0115, wl, 0.0045, 0.002, alinhar="centro", rot=(0, rotY, 0))
    # sol dourado sobre a folha da direita, no lugar de linhas
    sol = Modelo("tmp_sol")
    lombada_sol(sol, 0.0, raio=0.020, escala=1.0)
    # (o sol vai para o livro, girado como a folha da direita)
    R = Matrix.Rotation(math.radians(-17.0), 3, "Y") if False else None
    for mt, bm in sol.bms.items():
        for f in bm.faces:
            pass
    _anexar(lv, sol, (W / 2, -0.015, 0.0125), (0, -ang, 0))
    # os cantos dourados
    for s in (1, -1):
        for sy in (1, -1):
            lv.caixa("OURO", s * (W + 0.002), sy * (H / 2 - 0.004), -0.017, 0.018, 0.018, 0.005, alinhar="centro", rot=(0, -s * ang, 0))
    return lv


def _anexar(destino, origem, centro, rot):
    """Copia as peças de `origem` para `destino`, girando (graus, XYZ) e movendo."""
    from mathutils import Euler
    R = Euler([math.radians(a) for a in rot], "XYZ").to_matrix()
    for mt, bm in origem.bms.items():
        alvo = destino._bm(mt)
        mapa = {}
        for v in bm.verts:
            mapa[v] = alvo.verts.new(R @ v.co + Vector(centro))
        for f in bm.faces:
            try:
                alvo.faces.new([mapa[v] for v in f.verts])
            except ValueError:
                pass


# ------------------------------------------------------------------ poses
D = math.radians
POSE_ARMADO = {  # rotações em graus (rx, ry, rz) por osso
    "arm.R": (-24, 0, -4), "forearm.R": (-92, 0, 0),
    "arm.L": (3, 0, 2), "forearm.L": (-8, 0, 0), "head": (6, 0, 0),
}
POSE_IDLE_BASE = {"arm.L": (-4, 0, 0), "forearm.L": (-52, 0, 0), "arm.R": (2, 0, 0), "forearm.R": (-9, 0, 0)}


def fk_antebraco_direito(th1, th2):
    """Matriz (espaço Blender) que a pose leva o antebraço direito: serve para pôr o livro aberto na mão já em pé."""
    def gira(p, th):
        piv = bl(p)
        return Matrix.Translation(piv) @ Matrix.Rotation(D(th), 4, "X") @ Matrix.Translation(-piv)
    return gira(OSSOS["arm.R"][0], th1) @ gira(OSSOS["forearm.R"][0], th2)


def montar_livros():
    fechado = livro_fechado()
    # pousa o livro fechado no flanco esquerdo à frente (mão esquerda segura a borda), virado para fora e um pouco para a frente
    from mathutils import Euler
    Rf = Euler((D(-8), D(34), D(-4)), "XYZ").to_matrix()
    transformar(fechado, lambda v: Rf @ v + Vector((0.185, 1.015, 0.185)))
    # livro aberto já como ficará na pose Armado; depois volta ao repouso pela inversa da pose
    aberto = livro_aberto()
    th1, th2 = POSE_ARMADO["arm.R"][0], POSE_ARMADO["forearm.R"][0]
    Ra = Euler((D(-12), D(20), D(0)), "XYZ").to_matrix()
    M = fk_antebraco_direito(th1, th2)
    mao = md(M @ bl((-0.268, 0.78, 0.0)))
    print("MAO NA POSE ARMADO:", tuple(round(c, 3) for c in mao))
    centro = mao + Vector(LIVRO_OFF)
    Minv = M.inverted()
    transformar(aberto, lambda v: md(Minv @ bl(Ra @ v + centro)))
    OSSOS["livro_aberto"] = (tuple(md(Minv @ bl(centro))), "forearm.R")
    return fechado, aberto


# ------------------------------------------------------------------ montagem
def construir_malhas():
    fazer_cabeca()
    fazer_tronco()
    cam = fazer_quadril()
    fazer_corrente_e_carteira(cam)
    for s in (1, -1):
        fazer_braco(s)
        fazer_perna(s)
    fechado, aberto = montar_livros()
    # proporção levemente chibi: cabeça maior e sapatos grossos; depois tudo é reescalado para 1,80 m
    piv = Vector(OSSOS["head"][0])
    transformar(P("head"), lambda v: piv + (v - piv) * HEAD_ESC)
    for s_ in (1, -1):
        pf = Vector((s_ * 0.095, 0.0, 0.05))
        transformar(P("foot" + lado(s_)), lambda v, pf=pf: Vector((pf.x + (v.x - pf.x) * 1.18, v.y * 1.12, pf.z + (v.z - pf.z) * 1.14)))
    todos = list(PARTES.values()) + [fechado, aberto]
    topo = max(v.co.y for m in todos for bm in m.bms.values() for v in bm.verts)
    global KG
    KG = 1.80 / topo
    for m in todos:
        transformar(m, lambda v: v * KG)
    objs = []
    for osso, m in list(PARTES.items()):
        objs.append((osso, m.objeto()))
    objs.append(("livro_fechado", fechado.objeto()))
    objs.append(("livro_aberto", aberto.objeto()))
    return objs


def unir(objs):
    """Um objeto só, com um grupo de vértices por osso (peso 1)."""
    for osso, ob in objs:
        g = ob.vertex_groups.new(name=osso)
        g.add([v.index for v in ob.data.vertices], 1.0, "REPLACE")
    bpy.ops.object.select_all(action="DESELECT")
    for _, ob in objs:
        ob.select_set(True)
    bpy.context.view_layer.objects.active = objs[0][1]
    bpy.ops.object.join()
    ob = bpy.context.view_layer.objects.active
    ob.name = "Alosi"
    ob.data.name = "Alosi"
    for p in ob.data.polygons:
        p.use_smooth = False
    return ob


def criar_esqueleto():
    ad = bpy.data.armatures.new("Alosi_rig")
    ao = bpy.data.objects.new("Alosi_rig", ad)
    bpy.context.scene.collection.objects.link(ao)
    bpy.context.view_layer.objects.active = ao
    ao.select_set(True)
    bpy.ops.object.mode_set(mode="EDIT")
    for nome, (cab, pai) in OSSOS.items():
        eb = ad.edit_bones.new(nome)
        cab = tuple(c * KG for c in cab)
        eb.head = bl(cab)
        eb.tail = bl(cab) + Vector((0, 0.06, 0))
        eb.matrix = Matrix.Translation(bl(cab))
        if pai:
            eb.parent = ad.edit_bones[pai]
    bpy.ops.object.mode_set(mode="OBJECT")
    return ao


def ligar(ob, ao):
    mod = ob.modifiers.new("Esqueleto", "ARMATURE")
    mod.object = ao
    ob.parent = ao


def pose(ao, rot=None, loc=None, escala=None):
    """Zera o esqueleto e aplica o que veio: rot[osso]=(rx,ry,rz) em graus, loc[osso]=(x,y,z) em metros (espaço Blender), escala."""
    for pb in ao.pose.bones:
        pb.rotation_mode = "XYZ"
        pb.rotation_euler = (0, 0, 0)
        pb.location = (0, 0, 0)
        pb.scale = (1, 1, 1)
    for o, r in (rot or {}).items():
        ao.pose.bones[o].rotation_euler = tuple(D(a) for a in r)
    for o, l in (loc or {}).items():
        ao.pose.bones[o].location = l
    for o, e in (escala or {}).items():
        ao.pose.bones[o].scale = e


ESC0 = 0.0001
OCULTO = {"livro_aberto": (ESC0, ESC0, ESC0)}
OCULTO_F = {"livro_fechado": (ESC0, ESC0, ESC0)}


def quadro_idle(t):
    """t em 0..1 (laço de 2 s): respira, balança de leve, a mão esquerda segura o livro."""
    r = {k: list(v) for k, v in POSE_IDLE_BASE.items()}
    resp = math.sin(2 * math.pi * t)
    r["spine"] = [0.8 * resp, 0, 0.6 * math.sin(2 * math.pi * t + 1.0)]
    r["head"] = [-0.8 * resp + 1.0, 1.4 * math.sin(2 * math.pi * t + 0.5), 0]
    r["arm.R"][0] += 1.2 * resp
    r["arm.R"][2] += 0.8 * resp
    r["forearm.R"][0] += 1.4 * resp
    r["arm.L"][2] += 0.5 * resp
    r["hips"] = [0, 0, 0.5 * math.sin(2 * math.pi * t + 1.4)]
    return r, {"hips": (0, 0, 0.003 * resp)}, OCULTO


def quadro_walk(t):
    """t em 0..1 (laço de 1 s): braços e pernas alternando, o corpo sobe e desce duas vezes."""
    w = 2 * math.pi * t
    A, B = 27, 36
    def perna(fase):
        th = A * math.sin(w + fase)
        # o joelho dobra quando a perna sobe e passa para a frente
        dobra = B * max(0.0, math.sin(w + fase + 1.25)) ** 1.3 + 4
        return th, dobra
    thL, joL = perna(0.0)
    thR, joR = perna(math.pi)
    r = {
        "thigh.L": (-thL, 0, 0), "shin.L": (joL, 0, 0), "foot.L": (-(-thL + joL) * 0.55 + 4 * math.sin(w), 0, 0),
        "thigh.R": (-thR, 0, 0), "shin.R": (joR, 0, 0), "foot.R": (-(-thR + joR) * 0.55 + 4 * math.sin(w + math.pi), 0, 0),
        "arm.L": (-4 + 7 * math.sin(w + math.pi), 0, 1), "forearm.L": (-54 - 3 * math.sin(w + math.pi), 0, 0),
        "arm.R": (-26 * math.sin(w + math.pi) * -1 * -1 if False else 26 * math.sin(w), 0, 3), "forearm.R": (-12 - 14 * max(0, math.sin(w + 0.4)), 0, 0),
        "spine": (2.0, 0, 4.0 * math.sin(w)), "hips": (0, 0, -4.0 * math.sin(w)), "head": (-1.0, 0, -2.5 * math.sin(w)),
    }
    # braço direito oposto à perna direita = acompanha a perna esquerda
    bob = 0.020 * math.cos(2 * w) - 0.012
    return r, {"hips": (0, 0.0, bob + 0.012), "spine": (0.006 * math.sin(w), 0, 0)}, OCULTO


def quadro_armado(t):
    resp = math.sin(2 * math.pi * t)
    r = {k: list(v) for k, v in POSE_ARMADO.items()}
    r["spine"] = [0.8 * resp, 0, 0.4 * math.sin(2 * math.pi * t + 1.0)]
    r["head"][0] += -0.8 * resp
    r["head"][1] = 3.0 + 1.5 * math.sin(2 * math.pi * t + 0.7)
    r["arm.L"][0] += 1.2 * resp
    r["forearm.R"][0] += 1.0 * resp
    r["forearm.L"][0] += 1.2 * resp
    r["hips"] = [0, 0, 0.5 * math.sin(2 * math.pi * t + 1.4)]
    return r, {"hips": (0, 0, 0.003 * resp)}, OCULTO_F


def quadro_caido(t):
    """Deitado de costas, braços abertos, uma perna dobrada. Fica quase parado (respira um fio)."""
    resp = math.sin(2 * math.pi * t)
    r = {
        "hips": (-90, 0, 6), "spine": (-3 + 0.6 * resp, 0, 0), "head": (-14, 0, 12),
        "arm.L": (-8, 0, 62), "forearm.L": (-12, 0, 0),
        "arm.R": (6, 0, -48), "forearm.R": (-32, 0, 0),
        "thigh.L": (-6, 0, 8), "shin.L": (5, 0, 0), "foot.L": (0, 0, 0),
        "thigh.R": (-38, 0, -14), "shin.R": (62, 0, 0), "foot.R": (12, 0, 0),
    }
    return r, {"hips": (0, 0, -0.76 + 0.002 * resp)}, {**OCULTO, **OCULTO_F}


CLIPES = [("Idle", 2.0, quadro_idle), ("Walk", 1.0, quadro_walk), ("Armado_idle", 2.0, quadro_armado), ("Caido", 2.0, quadro_caido)]
FPS = 24


def criar_animacoes(ao):
    ao.animation_data_create()
    ad = ao.animation_data
    for nome, dur, fn in CLIPES:
        act = bpy.data.actions.new(nome)
        ad.action = act
        n = int(dur * FPS)
        for f in range(n + 1):
            t = (f % n) / n
            r, l, esc = fn(t)
            pose(ao, r, l, esc)
            for pb in ao.pose.bones:
                pb.keyframe_insert("rotation_euler", frame=f + 1)
                pb.keyframe_insert("location", frame=f + 1)
                pb.keyframe_insert("scale", frame=f + 1)
        for fc in _fcurves(act):
            for kp in fc.keyframe_points:
                kp.interpolation = "LINEAR" if nome != "Caido" else "BEZIER"
        # empurra para uma faixa NLA com o nome do clipe (o exportador usa o nome da faixa)
        tr = ad.nla_tracks.new()
        tr.name = nome
        st = tr.strips.new(nome, 1, act)
        st.name = nome
        ad.action = None
    pose(ao)


def _fcurves(act):
    try:
        return list(act.fcurves)
    except Exception:
        out = []
        for lay in act.layers:
            for strip in lay.strips:
                for cb in strip.channelbags:
                    out.extend(cb.fcurves)
        return out


# ------------------------------------------------------------------ exportar e prévia
def exportar(ob, ao, caminho):
    os.makedirs(os.path.dirname(caminho), exist_ok=True)
    bpy.ops.object.select_all(action="DESELECT")
    ob.select_set(True)
    ao.select_set(True)
    bpy.context.view_layer.objects.active = ao
    kw = dict(filepath=caminho, export_format="GLB", use_selection=True, export_apply=False, export_yup=True, export_materials="EXPORT",
              export_cameras=False, export_lights=False, export_normals=True, export_texcoords=False, export_vertex_color="NONE",
              export_image_format="NONE", export_skins=True, export_animations=True, export_animation_mode="NLA_TRACKS",
              export_force_sampling=True, export_optimize_animation_size=False)
    try:
        bpy.ops.export_scene.gltf(**kw)
    except TypeError as e:
        print("AVISO export:", e)
        for k in ("export_optimize_animation_size", "export_force_sampling"):
            kw.pop(k, None)
        bpy.ops.export_scene.gltf(**kw)


def previa(pasta, nome_pose):
    from math import radians as R
    import mathutils
    os.makedirs(pasta, exist_ok=True)
    sc = bpy.context.scene
    sc.render.engine = "BLENDER_WORKBENCH"
    sh = sc.display.shading
    sh.light = "STUDIO"
    sh.color_type = "MATERIAL"
    sh.show_cavity = False
    sh.show_shadows = False
    sh.show_specular_highlight = False
    sh.studio_light = "Default" if False else sh.studio_light
    for mt in bpy.data.materials:
        if mt.use_nodes and "Principled BSDF" in mt.node_tree.nodes:
            mt.diffuse_color = mt.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value
    w = bpy.data.worlds.new("w")
    w.color = (0.92, 0.92, 0.92)
    sc.world = w
    sc.render.resolution_x, sc.render.resolution_y = 520, 860
    sc.render.film_transparent = False
    sc.render.image_settings.file_format = "PNG"
    cam = bpy.data.objects.new("cam", bpy.data.cameras.new("cam"))
    sc.collection.objects.link(cam)
    sc.camera = cam
    cam.data.type = "ORTHO"
    ao = bpy.data.objects["Alosi_rig"]
    if nome_pose and nome_pose != "repouso":
        nome, _, tt = nome_pose.partition("@")
        t = float(tt) if tt else 0.0
        fn = {"idle": quadro_idle, "walk": quadro_walk, "armado": quadro_armado, "caido": quadro_caido}[nome]
        r, l, esc = fn(t)
        pose(ao, r, l, esc)
    bpy.context.view_layer.update()
    vistas = {"frente": 0, "tres_quartos": 35, "lado": 90, "costas": 180}
    caidos = nome_pose and nome_pose.startswith("caido")
    for nome, ang in vistas.items():
        # a câmera gira em torno do personagem; a frente do modelo é -Y no Blender
        a = R(ang)
        dist = 8
        alvo = Vector((0, 0, 0.45 if caidos else 0.90))
        cam.location = alvo + Vector((math.sin(-a) * -dist * -1 * -1 * -1 * 1, -math.cos(a) * dist, 0.0)) if False else alvo + Vector((dist * math.sin(a), -dist * math.cos(a), 0.0))
        d = alvo - cam.location
        cam.rotation_euler = d.to_track_quat("-Z", "Y").to_euler()
        cam.data.ortho_scale = 2.9 if caidos else 2.15
        sc.render.filepath = os.path.join(pasta, f"{nome}.png")
        bpy.ops.render.render(write_still=True)
    # cabeça de perto
    cam.data.ortho_scale = 0.62
    for nome, ang in (("rosto", 0), ("rosto_34", 32)):
        a = R(ang)
        alvo = Vector((0, 0, 1.63))
        cam.location = alvo + Vector((8 * math.sin(a), -8 * math.cos(a), 0.0))
        cam.rotation_euler = (alvo - cam.location).to_track_quat("-Z", "Y").to_euler()
        sc.render.filepath = os.path.join(pasta, f"{nome}.png")
        bpy.ops.render.render(write_still=True)


# ------------------------------------------------------------------ principal
def main():
    lib.limpar_cena()
    objs = construir_malhas()
    ob = unir(objs)
    ao = criar_esqueleto()
    ligar(ob, ao)
    ob.data.calc_loop_triangles()
    print(f"ALOSI: {len(ob.data.polygons)} faces, {len(ob.data.loop_triangles)} triangulos, {len(ob.material_slots)} materiais")
    ao_pasta = opcao("--previa")
    if ao_pasta:
        previa(ao_pasta, opcao("--pose"))
        return
    criar_animacoes(ao)
    if "--sem-glb" not in args:
        exportar(ob, ao, SAIDA)
        print("GLB:", SAIDA)


main()
