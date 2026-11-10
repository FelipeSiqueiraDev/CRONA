"""
Os móveis do Bar da Ordem (cena 33) em 3D, feitos por código no Blender e exportados em glTF binário, um por tipo
(`client/public/prototipo3d/modelos/<defId>.glb`), mais uma folha de contato para conferir
(`docs/prints-bar3d/moveis.png`: o sprite isométrico do jogo à esquerda e o modelo 3D à direita).

PROPORÇÃO REAL (10/11, o Felipe: "a gente deve mudar as proporções do mapa pra combinar com o novo estilo; tá tudo meio
chibi pelas pixel arts; agora ficaria mais 'real'"): cada móvel tem a medida de verdade (cadeira com o assento a 0,45 m
e o encosto a 0,90 m, mesa de bar a 0,75 m com o tampo de 0,70 m, balcão a 1,05 m, estante de 2 m, sinuca de 2,6 m,
garrafa de 0,23 m...). O móvel de verdade cabe DENTRO da pegada do jogo e fica centrado nela: não se engorda para encher
a casa. As cores seguem a paleta dos sprites isométricos do Bar (mesas e cadeiras amarelas, madeira escura, couro
vermelho, feltro verde), mas realistas e foscas.

Texturas pintadas por código, 128 px por metro, com filtro linear (o three.js faz os mipmaps): veio da madeira, tinta
lascada, couro com vincos, metal escovado, feltro, tecido, concreto, e os dois tapetes inteiros desenhados à parte.
A ocultação ambiente (AO) é assada em cor de vértice (raios contra a própria malha e contra o chão). Material fosco:
rugosidade 0,85 a 1, metal 0 (só o aço escovado e o latão têm um pouco).

CONTRATO com o desenho 3D do tabuleiro (protótipo do Bar):
  - unidades em metros; origem no centro da pegada, no chão (y = 0 no glTF, Y para cima);
  - a frente do móvel fica virada para +Z do glTF (-Y do Blender);
  - o móvel cabe dentro da pegada (largura × casas × 0,75 m e fundo × casas × 0,75 m), centrado nela;
  - objeto pequeno (caneca, copo, cinzeiro) é do tamanho de verdade, no meio da casa; o que é de chão (sujeira,
    poça, cabos, papéis) é chato, a poucos milímetros do chão;
  - materiais com nome fixo para o desenho ligar o que brilha: 'EMISSIVO' (lâmpada, tela, chama, neon) e
    'VIDRO' (vidro, translúcido); a poça se chama 'POCA';
  - a luminária de teto (`ceiling_lamp`) tem a origem no ponto onde prende no teto e pende para -Y (para baixo);
  - a escada para baixo (`stairs_down`) tem a borda rente ao chão e o poço com degraus para -Y (abaixo do chão).

Uso (precisa do Blender 5.2):
  "F:/Programas/Blender 5.2/blender.exe" -b --factory-startup -P scripts/3d/moveis_glb.py -- [--so a,b,c] [--sem-previa]
"""
import math
import os
import random
import subprocess
import sys
import zlib

import bmesh
import bpy
import numpy as np
from mathutils import Euler, Matrix, Vector
from mathutils.bvhtree import BVHTree

AQUI = os.path.dirname(os.path.abspath(__file__))
RAIZ = os.path.abspath(os.path.join(AQUI, "..", ".."))
SAIDA = os.path.join(RAIZ, "client", "public", "prototipo3d", "modelos")
PRINTS = os.path.join(RAIZ, "docs", "prints-bar3d")
PREVIAS = os.path.join(PRINTS, "moveis")
C = 0.75  # uma casa, em metros

args = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
SO = None
if "--so" in args:
    SO = set(args[args.index("--so") + 1].split(","))
PREVIA = "--sem-previa" not in args


# ------------------------------------------------------------------ materiais
def srgb(h):
    h = h.lstrip("#")
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return [(x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4) for x in c]


def rgb255(h):
    h = h.lstrip("#")
    return np.array([int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)])


# rampas [sombra, base, luz, brilho] da paleta dos sprites do Bar (client/public/arte/mobiliario/<id>/giro-4.png), um
# pouco dessaturadas: a textura anda por elas de forma contínua (sem os 4 degraus da pixel art)
RAMPAS = {
    "AMARELO": ("pintura", ["#7a5410", "#c99a22", "#e2b83a", "#f4dc86"]),
    "AMARELO_ESC": ("pintura", ["#5a3a0a", "#a67814", "#c99a22", "#e2b83a"]),
    "MADEIRA_ESC": ("madeira", ["#150a06", "#301810", "#4a2616", "#68402a"]),
    "MADEIRA": ("madeira", ["#22110a", "#44240f", "#62381c", "#80502c"]),
    "MADEIRA_CLARA": ("madeira", ["#52301a", "#80542a", "#a06e38", "#bf9058"]),
    "COURO_VERM": ("couro", ["#4a0a08", "#8c1c14", "#b03020", "#d05c46"]),
    "COURO_ESC": ("couro", ["#0a0605", "#1e120d", "#32211a", "#4a362e"]),
    "METAL": ("metal", ["#74747e", "#a4a4ae", "#c6c6ce", "#e8eaee"]),
    "METAL_ESC": ("metal", ["#0e0e12", "#202028", "#34343e", "#505060"]),
    "LATAO": ("metal", ["#5a4012", "#98702a", "#bc9440", "#e2c474"]),
    "FELTRO": ("feltro", ["#0e4220", "#18702f", "#269044", "#46b062"]),
    "PRETO": ("liso", ["#060505", "#141110", "#241f1c", "#3a3430"]),
    "GELADEIRA": ("pintura", ["#4a0a06", "#861710", "#ac2c22", "#d05a48"]),  # a vermelha (fridge_drinks)
    "GELADEIRA_VERM": ("pintura", ["#6a4a0c", "#b88a18", "#d4aa2c", "#ecce66"]),  # a de mostarda (beer_fridge)
    "PLASTICO_VERM": ("pintura", ["#540c08", "#962014", "#bc3624", "#dc664e"]),
    "PLASTICO_AZUL": ("pintura", ["#10286a", "#224a96", "#3a6cbc", "#6c98dc"]),
    "TERRACOTA": ("pedra", ["#64301a", "#a05a2c", "#c07a44", "#dc9e66"]),
    "FOLHA": ("liso", ["#0c2e14", "#1b4e20", "#2a6e2c", "#4a9042"]),
    "FOLHA_ESC": ("liso", ["#06200c", "#103a16", "#1b4e20", "#2a6e2c"]),
    "CONCRETO": ("pedra", ["#2e2c28", "#4c4a44", "#6a685f", "#8c8a80"]),
    "BEGE": ("pintura", ["#7c7258", "#b4a88a", "#d2c8aa", "#ece4cc"]),
    "BRANCO": ("pintura", ["#9a968a", "#c8c4b8", "#e0dccf", "#f6f2e6"]),
    "CINZA": ("pedra", ["#6c665a", "#988f80", "#b4ab9c", "#d2cabb"]),
    "ABAJUR": ("tecido", ["#a89468", "#d6c498", "#e8dab4", "#f6ecce"]),
    "PAPEL": ("liso", ["#aaa28c", "#d8d2be", "#e8e4d2", "#f8f4e6"]),
    "TERRA": ("pedra", ["#140a06", "#261710", "#382618", "#4c3826"]),
    "SUJEIRA": ("pedra", ["#160e0a", "#30221a", "#463626", "#5e4a34"]),
    "ESPUMA": ("liso", ["#bcb08e", "#e8dec4", "#f6efd8", "#ffffff"]),
    "LARANJA": ("liso", ["#8a3c06", "#d06e12", "#ec9626", "#fcc464"]),
}
# nome: (cor de reserva, emissivo (cor, força) ou None, alfa)
PALETA = {
    "VIDRO": ("#9ec4d8", None, 0.16),
    "CERVEJA": ("#c8821a", None, 0.94),
    "GARRAFA_VERDE": ("#1c5a2a", None, 0.96),
    "GARRAFA_AMBAR": ("#6e340c", None, 0.96),
    "GARRAFA_CLARA": ("#cfe6e0", None, 0.7),
    "GARRAFA_VERM": ("#7a1a1a", None, 0.97),
    "LATA_VERM": ("#b01c1c", None, 1),
    "LATA_AZUL": ("#1c4ab0", None, 1),
    "LATA_PRATA": ("#b4b8be", None, 1),
    "POCA": ("#203040", None, 0.62),
    "CABO": ("#0e0e10", None, 1),
    "TINTA": ("#4a463c", None, 1),
    "NEON_ROSA": ("#ff3fa4", ("#ff3fa4", 3), 1),
    "NEON_AZUL": ("#30c8ff", ("#30c8ff", 3), 1),
    "EMISSIVO": ("#ffd9a0", ("#ffcf8a", 4), 1),
    "EMISSIVO_FRIO": ("#d8f0ff", ("#cfe9ff", 1.6), 1),
    "EMISSIVO_VERDE": ("#7dff9a", ("#7dff9a", 1.6), 1),
    "EMISSIVO_AZUL": ("#3a9aff", ("#3a9aff", 1.8), 1),
    "CHAMA": ("#ffb347", ("#ffa530", 6), 1),
}
for _n, (_t, _r) in RAMPAS.items():
    PALETA[_n] = (_r[1], None, 1)
# materiais com a imagem inteira numa só textura (os tapetes): nome -> (largura, fundo) em metros
IMG_MAT = {"RUG_ORNATE": (2.11, 2.8), "RUG_WORN": (1.38, 2.05)}
for _n in IMG_MAT:
    PALETA[_n] = ("#7a2a20", None, 1)
# (rugosidade, metal): tudo fosco; só o aço escovado e o latão têm um pouco de metal
# (sem mapa de ambiente na cena, metal alto fica preto: o aço fica em 0,25 e a cor clara vem da textura)
ACABAMENTO = {"METAL": (0.5, 0.25), "METAL_ESC": (0.6, 0.2), "LATAO": (0.5, 0.3)}
_mats = {}
_tex = {}
TAM_TEX = 128  # pixels por ladrilho
LADRILHO = 1.0  # metros por ladrilho: 128 px por metro


def _ruido(n, rng, sx, sy):
    """Ruído de média 0 e desvio 1 que emenda sozinho (filtro gaussiano por FFT): sx e sy são os tamanhos em pixels."""
    r = rng.standard_normal((n, n))
    fx = np.fft.fftfreq(n)[None, :]
    fy = np.fft.fftfreq(n)[:, None]
    g = np.exp(-2 * (np.pi ** 2) * ((sx * fx) ** 2 + (sy * fy) ** 2))
    out = np.real(np.fft.ifft2(np.fft.fft2(r) * g))
    out -= out.mean()
    return out / (out.std() + 1e-9)


def _risco(f, rng, n, qtd, comp, dv, horizontal=True):
    """Arranhões e lascas: `qtd` riscos curtos somando `dv` ao campo."""
    for _ in range(qtd):
        y, x = rng.integers(0, n), rng.integers(0, n)
        L = int(rng.integers(comp // 2, comp))
        ang = rng.uniform(-0.25, 0.25) if horizontal else rng.uniform(1.3, 1.8)
        for k in range(L):
            yy = int(y + math.sin(ang) * k) % n
            xx = int(x + math.cos(ang) * k) % n
            f[yy, xx] += dv


def _campo(tipo, n, rng):
    """O campo 0..1 de cada tipo de material (0 = sombra da rampa, 1 = brilho)."""
    if tipo == "madeira":
        # tábuas de 16 px (12,5 cm), com veio na horizontal, tom por tábua, juntas escuras e alguns nós
        f = 0.5 + 0.1 * _ruido(n, rng, 40, 1.0) + 0.06 * _ruido(n, rng, 12, 2.0) + 0.05 * _ruido(n, rng, 60, 10)
        for b in range(n // 16):
            f[b * 16:(b + 1) * 16, :] += rng.uniform(-0.1, 0.1)
            f[b * 16, :] -= 0.3
            f[b * 16 + 1, :] -= 0.1
        yy, xx = np.mgrid[0:n, 0:n]
        for _ in range(3):
            cy, cx = rng.integers(0, n), rng.integers(0, n)
            f -= 0.28 * np.exp(-(((yy - cy) ** 2) / 5.0 + ((xx - cx) ** 2) / 22.0))
        _risco(f, rng, n, 18, 24, -0.06)
    elif tipo == "pintura":
        # tinta laqueada gasta: pouca variação, arranhões claros, lascas fundas e as quinas gastas
        f = 0.55 + 0.05 * _ruido(n, rng, 10, 10) + 0.03 * _ruido(n, rng, 1.5, 1.5)
        f += 0.12 * np.clip(_ruido(n, rng, 5, 5) - 1.2, 0, 2)
        _risco(f, rng, n, 26, 20, 0.16)
        lasca = _ruido(n, rng, 3, 3) > 1.9
        f[lasca] = 0.08
        _risco(f, rng, n, 8, 10, -0.3)
    elif tipo == "couro":
        # couro com a trama de poros e vincos: veios escuros curtos e brilho de uso
        base = _ruido(n, rng, 2.5, 2.5)
        f = 0.55 + 0.05 * base + 0.08 * _ruido(n, rng, 14, 14)
        veio = 1.0 - np.abs(_ruido(n, rng, 3.5, 3.5))
        f -= 0.22 * np.clip((veio - 0.85) / 0.15, 0, 1)
        f += 0.1 * np.clip(_ruido(n, rng, 9, 9) - 1.0, 0, 2)
        _risco(f, rng, n, 5, 18, -0.2, horizontal=False)
    elif tipo == "metal":
        # aço escovado: fios longos na horizontal
        f = 0.55 + 0.1 * _ruido(n, rng, 60, 0.6) + 0.04 * _ruido(n, rng, 20, 1.2) + 0.03 * _ruido(n, rng, 8, 8)
        _risco(f, rng, n, 10, 40, 0.08)
    elif tipo == "pedra":
        f = 0.5 + 0.11 * _ruido(n, rng, 1.2, 1.2) + 0.12 * _ruido(n, rng, 5, 5) + 0.1 * _ruido(n, rng, 18, 18)
    elif tipo == "feltro":
        f = 0.5 + 0.1 * _ruido(n, rng, 0.8, 0.8) + 0.06 * _ruido(n, rng, 6, 6) + 0.04 * _ruido(n, rng, 20, 20)
    elif tipo == "tecido":
        yy, xx = np.mgrid[0:n, 0:n]
        trama = np.sin(2 * np.pi * xx / 4.0) * np.sin(2 * np.pi * yy / 4.0)
        f = 0.5 + 0.08 * trama + 0.08 * _ruido(n, rng, 1.2, 1.2) + 0.05 * _ruido(n, rng, 9, 9)
    else:  # liso: quase um tom só, com um pouco de poeira
        f = 0.5 + 0.04 * _ruido(n, rng, 1.0, 1.0) + 0.05 * _ruido(n, rng, 12, 12)
    return np.clip(f, 0.0, 1.0)


def _rampa(f, cores):
    t = np.clip(f, 0, 1) * (len(cores) - 1)
    i = np.minimum(t.astype(int), len(cores) - 2)
    fr = (t - i)[..., None]
    c = np.array(cores)
    return c[i] * (1 - fr) + c[i + 1] * fr


def _empacotar(nome, rgb):
    h, w = rgb.shape[:2]
    px = np.ones((h, w, 4), dtype=np.float32)
    px[:, :, :3] = rgb
    img = bpy.data.images.new("tex_" + nome, w, h, alpha=False)
    img.colorspace_settings.name = "sRGB"
    img.pixels.foreach_set(px[::-1].ravel())  # a linha 0 do Blender é a de baixo
    img.pack()
    return img


def _img_tapete(nome):
    """Os tapetes inteiros, desenhados em metros numa imagem só."""
    lm, dm = IMG_MAT[nome]
    W = 512
    H = int(round(W * dm / lm))
    rng = np.random.default_rng(zlib.crc32(nome.encode()))
    ys, xs = np.mgrid[0:H, 0:W]
    X = (xs + 0.5) / W * lm - lm / 2  # metros, da esquerda para a direita
    Y = (ys + 0.5) / H * dm - dm / 2  # metros, de trás para a frente
    lã = 0.5 + 0.1 * rng.standard_normal((H, W))
    ao = np.zeros((H, W, 3))

    def cor(h):
        return rgb255(h)

    def por(mask, c):
        ao[mask] = c

    if nome == "RUG_ORNATE":
        vermelho, vermelho2, azul, ouro, creme, escuro = cor("#8a1e18"), cor("#a42a20"), cor("#18306c"), cor("#c89a2c"), cor("#d8c89a"), cor("#220e0e")
        ao[:] = vermelho
        d = np.minimum(np.minimum(X + lm / 2, lm / 2 - X), np.minimum(Y + dm / 2, dm / 2 - Y))  # distância à borda
        por(d < 0.11, azul)
        por((d >= 0.11) & (d < 0.125), ouro)
        faixa = (d >= 0.125) & (d < 0.32)
        por(faixa, vermelho2)
        # losangos pequenos ao longo da faixa
        per = 0.18
        ox = (np.abs(((X + lm / 2) % per) - per / 2) + np.abs(((d - 0.2) % 1e9) * 0.0 + (d - 0.2))) < 0.07
        por(faixa & ox, ouro)
        por((d >= 0.32) & (d < 0.335), ouro)
        por((d >= 0.335) & (d < 0.42), escuro)
        por((d >= 0.42) & (d < 0.435), ouro)
        campo = d >= 0.435
        # o medalhão: losangos concentrados no centro
        L1 = np.abs(X) / 0.5 + np.abs(Y) / 0.78
        por(campo & (L1 < 1.0), azul)
        por(campo & (L1 < 0.88), ouro)
        por(campo & (L1 < 0.8), vermelho)
        por(campo & (L1 < 0.56), azul)
        por(campo & (L1 < 0.46), ouro)
        por(campo & (L1 < 0.34), vermelho2)
        por(campo & (np.hypot(X, Y * 0.64) < 0.1), ouro)
        # losangos pequenos nos cantos do campo
        for sx in (-1, 1):
            for sy in (-1, 1):
                cx, cy = sx * (lm / 2 - 0.62), sy * (dm / 2 - 0.62)
                por(campo & ((np.abs(X - cx) + np.abs(Y - cy)) < 0.14), ouro)
                por(campo & ((np.abs(X - cx) + np.abs(Y - cy)) < 0.08), escuro)
        # o desgaste: manchas claras e uns trechos puídos
        gasto = _ruido_img(H, W, rng, 28)
        ao = ao * (1 - 0.14 * np.clip(gasto, 0, 3)[..., None]) + 0.05 * np.clip(gasto - 1.6, 0, 2)[..., None]
    else:  # RUG_WORN
        base, azul, claro, escuro = cor("#7e3524"), cor("#1e3a78"), cor("#a85a3c"), cor("#3a1a12")
        ao[:] = base
        d = np.minimum(np.minimum(X + lm / 2, lm / 2 - X), np.minimum(Y + dm / 2, dm / 2 - Y))
        por((d >= 0.07) & (d < 0.1), azul)
        por((d >= 0.1) & (d < 0.12), claro)
        por((d >= 0.17) & (d < 0.19), azul)
        # losangos repetidos no campo
        per = 0.38
        gx = np.abs(((X + lm / 2) % per) - per / 2)
        gy = np.abs(((Y + dm / 2) % per) - per / 2)
        por((d >= 0.26) & ((gx + gy) < 0.1), claro)
        por((d >= 0.26) & ((gx + gy) < 0.05), base)
        gasto = _ruido_img(H, W, rng, 22)
        por(gasto > 1.1, claro)
        por(gasto > 2.0, cor("#c8946c"))
        mancha = _ruido_img(H, W, rng, 40)
        ao = ao * (1 - 0.35 * np.clip(mancha - 1.3, 0, 1.5)[..., None])
    ao = ao * (0.9 + 0.2 * lã[..., None])
    return _empacotar(nome, np.clip(ao, 0, 1))


def _ruido_img(h, w, rng, s):
    r = rng.standard_normal((h, w))
    fy = np.fft.fftfreq(h)[:, None]
    fx = np.fft.fftfreq(w)[None, :]
    g = np.exp(-2 * (np.pi ** 2) * ((s * fx) ** 2 + (s * fy) ** 2))
    out = np.real(np.fft.ifft2(np.fft.fft2(r) * g))
    out -= out.mean()
    return out / (out.std() + 1e-9)


def textura(nome):
    if nome in _tex:
        return _tex[nome]
    if nome in IMG_MAT:
        img = _img_tapete(nome)
    else:
        tipo, rampa = RAMPAS[nome]
        rng = np.random.default_rng(zlib.crc32(nome.encode()))
        f = _campo(tipo, TAM_TEX, rng)
        img = _empacotar(nome, _rampa(f, [rgb255(c) for c in rampa]))
    _tex[nome] = img
    return img


def mat(nome):
    if nome in _mats:
        return _mats[nome]
    cor, emi, alfa = PALETA[nome]
    m = bpy.data.materials.new(nome)
    try:
        m.use_nodes = True
    except Exception:
        pass
    nt = m.node_tree
    n = nt.nodes["Principled BSDF"]
    n.inputs["Base Color"].default_value = srgb(cor) + [1]
    ru, me = ACABAMENTO.get(nome, (0.92, 0.0))
    n.inputs["Roughness"].default_value = ru
    n.inputs["Metallic"].default_value = me
    for k, v in (("Specular IOR Level", 0.1), ("IOR", 1.45)):
        if k in n.inputs:
            n.inputs[k].default_value = v
    if emi:
        n.inputs["Emission Color"].default_value = srgb(emi[0]) + [1]
        n.inputs["Emission Strength"].default_value = emi[1]
    n.inputs["Alpha"].default_value = alfa
    if alfa < 1:
        for atr, val in (("surface_render_method", "BLENDED"), ("blend_method", "BLEND")):
            try:
                setattr(m, atr, val)
            except Exception:
                pass
    # cor: textura (se tem) × cor por vértice (tom da peça × ocultação ambiente assada)
    if nome in RAMPAS or nome in IMG_MAT:
        tx = nt.nodes.new("ShaderNodeTexImage")
        tx.image = textura(nome)
        tx.interpolation = "Linear"  # filtro linear (o three.js faz os mipmaps)
        tx.extension = "EXTEND" if nome in IMG_MAT else "REPEAT"
        va = nt.nodes.new("ShaderNodeVertexColor")
        va.layer_name = "Col"
        mx = nt.nodes.new("ShaderNodeMix")
        mx.data_type = "RGBA"
        mx.blend_type = "MULTIPLY"
        mx.inputs[0].default_value = 1.0
        nt.links.new(tx.outputs["Color"], mx.inputs[6])
        nt.links.new(va.outputs["Color"], mx.inputs[7])
        nt.links.new(mx.outputs[2], n.inputs["Base Color"])
    _mats[nome] = m
    return m


# ------------------------------------------------------------------ construção (x = lado, f = frente, z = altura)
class Modelo:
    def __init__(s, nome):
        s.nome = nome
        s.bm = bmesh.new()
        s.slots = []
        s.rng = random.Random(zlib.crc32(nome.encode()))
        s.tint = s.bm.faces.layers.float.new("tint")

    def _slot(s, nome):
        if nome not in s.slots:
            s.slots.append(nome)
        return s.slots.index(nome)

    def _junta(s, bmp, m, pos, rot, suave):
        mt = Matrix.Translation(pos) @ Euler([math.radians(a) for a in rot], "XYZ").to_matrix().to_4x4()
        bmesh.ops.transform(bmp, matrix=mt, verts=bmp.verts)
        i = s._slot(m)
        vm = {v: s.bm.verts.new(v.co) for v in bmp.verts}
        # cada peça sai com um tom um pouco diferente (uma tábua mais clara, outra mais gasta)
        tom = s.rng.uniform(0.94, 1.06)
        for f in bmp.faces:
            nf = s.bm.faces.new([vm[v] for v in f.verts])
            nf.material_index = i
            nf.smooth = suave
            nf[s.tint] = tom
        bmp.free()

    def caixa(s, m, x, f, z0, sx, sf, sz, rot=(0, 0, 0), bisel=0.006):
        b = bmesh.new()
        bmesh.ops.create_cube(b, size=1.0)
        bmesh.ops.scale(b, vec=(sx, sf, sz), verts=b.verts)
        bis = min(bisel, min(sx, sf, sz) / 3.2)
        if bis > 0.0004:
            bmesh.ops.bevel(b, geom=list(b.edges), offset=bis, segments=2 if bis >= 0.008 else 1, affect="EDGES", profile=0.5)
        s._junta(b, m, (x, f, z0 + sz / 2), rot, False)

    def cil(s, m, x, f, z0, r, h, r2=None, seg=20, rot=(0, 0, 0), ex=1.0, ef=1.0, tampa=True):
        """Cilindro (ou cone): lado liso, tampas retas. `rot` gira em torno do centro."""
        r2 = r if r2 is None else r2
        b = bmesh.new()
        bmesh.ops.create_cone(b, cap_ends=False, segments=seg, radius1=r, radius2=r2, depth=h)
        for f_ in b.faces:
            f_.smooth = True
        s._junta_cilindro(b, m, (x, f, z0 + h / 2), rot, ex, ef)
        if tampa:
            for z, rr in ((-h / 2, r), (h / 2, r2)):
                if rr <= 0.0005:
                    continue
                t = bmesh.new()
                bmesh.ops.create_circle(t, cap_ends=True, cap_tris=False, segments=seg, radius=rr)
                bmesh.ops.translate(t, vec=(0, 0, z), verts=t.verts)
                if z < 0:
                    bmesh.ops.reverse_faces(t, faces=t.faces)
                s._junta_cilindro(t, m, (x, f, z0 + h / 2), rot, ex, ef)

    def _junta_cilindro(s, b, m, pos, rot, ex, ef):
        if ex != 1.0 or ef != 1.0:
            bmesh.ops.scale(b, vec=(ex, ef, 1.0), verts=b.verts)
        suave = all(f.smooth for f in b.faces) if b.faces else False
        s._junta(b, m, pos, rot, suave)

    def esf(s, m, x, f, z, r, ex=1.0, ef=1.0, ez=1.0, seg=14, rot=(0, 0, 0)):
        b = bmesh.new()
        bmesh.ops.create_uvsphere(b, u_segments=seg, v_segments=max(6, seg // 2), radius=r)
        bmesh.ops.scale(b, vec=(ex, ef, ez), verts=b.verts)
        for f_ in b.faces:
            f_.smooth = True
        s._junta(b, m, (x, f, z), rot, True)

    def tubo(s, m, p0, p1, r0, r1=None, seg=8, ef=1.0, ex=1.0, tampa=True):
        """Cone entre dois pontos (x, f, z): pernas inclinadas, folhas, aros."""
        r1 = r0 if r1 is None else r1
        p0, p1 = Vector(p0), Vector(p1)
        d = p1 - p0
        L = d.length
        if L < 1e-5:
            return
        q = Vector((0, 0, 1)).rotation_difference(d.normalized())
        rot = [math.degrees(a) for a in q.to_euler("XYZ")]
        c = (p0 + p1) / 2
        b = bmesh.new()
        bmesh.ops.create_cone(b, cap_ends=False, segments=seg, radius1=r0, radius2=r1, depth=L)
        for f_ in b.faces:
            f_.smooth = True
        if ex != 1.0 or ef != 1.0:
            bmesh.ops.scale(b, vec=(ex, ef, 1.0), verts=b.verts)
        s._junta(b, m, (c.x, c.y, c.z), rot, True)
        if tampa:
            for z, rr in ((-L / 2, r0), (L / 2, r1)):
                if rr <= 0.0005:
                    continue
                t = bmesh.new()
                bmesh.ops.create_circle(t, cap_ends=True, cap_tris=False, segments=seg, radius=rr)
                bmesh.ops.translate(t, vec=(0, 0, z), verts=t.verts)
                if z < 0:
                    bmesh.ops.reverse_faces(t, faces=t.faces)
                if ex != 1.0 or ef != 1.0:
                    bmesh.ops.scale(t, vec=(ex, ef, 1.0), verts=t.verts)
                s._junta(t, m, (c.x, c.y, c.z), rot, False)

    def anel(s, m, x, f, z, R, r, seg=28, ex=1.0, ef=1.0):
        """Aro horizontal (argola, trilho): uma volta de tubos pequenos."""
        pts = [(x + math.cos(2 * math.pi * i / seg) * R * ex, f + math.sin(2 * math.pi * i / seg) * R * ef, z) for i in range(seg + 1)]
        for a, b in zip(pts, pts[1:]):
            s.tubo(m, a, b, r, seg=6, tampa=False)

    def prisma(s, m, pontos, z0, h, bisel=0.0):
        """Polígono extrudado: `pontos` = [(x, f), ...] em sentido anti-horário, visto de cima."""
        b = bmesh.new()
        vs = [b.verts.new((px, pf, 0)) for px, pf in pontos]
        fa = b.faces.new(vs)
        r = bmesh.ops.extrude_face_region(b, geom=[fa])
        top = [e for e in r["geom"] if isinstance(e, bmesh.types.BMVert)]
        bmesh.ops.translate(b, vec=(0, 0, h), verts=top)
        s._junta(b, m, (0, 0, z0), (0, 0, 0), False)

    def _uv_e_cor(s):
        """UV em metros (projeção em caixa, pelo eixo da normal; o veio corre no lado maior) e a cor por canto: tom da
        peça × ocultação ambiente (AO) assada por raios contra a própria malha e contra o chão."""
        bm = s.bm
        uv = bm.loops.layers.uv.new("UVMap")
        col = bm.loops.layers.float_color.new("Col")
        # o tamanho do móvel decide o alcance da sombra de contato
        xs = [v.co.x for v in bm.verts]
        ys = [v.co.y for v in bm.verts]
        zs = [v.co.z for v in bm.verts]
        tam = max(max(xs) - min(xs), max(ys) - min(ys), max(zs) - min(zs))
        dist = min(0.4, max(0.06, tam * 0.28))
        bvh = BVHTree.FromBMesh(bm)
        raios = []
        N = 14
        for i in range(N):  # hemisfério com densidade pelo cosseno (espiral de Fibonacci)
            r2 = (i + 0.5) / N
            u = math.sqrt(r2)
            ang = i * 2.399963
            raios.append((u * math.cos(ang), u * math.sin(ang), math.sqrt(max(0.0, 1 - r2))))
        chao = s.nome != "ceiling_lamp"
        cache = {}

        def aberto(p, n):
            chave = (round(p.x, 3), round(p.y, 3), round(p.z, 3), round(n.x, 1), round(n.y, 1), round(n.z, 1))
            if chave in cache:
                return cache[chave]
            o = p + n * 0.004
            t = n.cross(Vector((0, 0, 1)) if abs(n.z) < 0.9 else Vector((1, 0, 0)))
            t.normalize()
            b = n.cross(t)
            oc = 0
            for u, v, w in raios:
                d = t * u + b * v + n * w
                hit = bvh.ray_cast(o, d, dist)
                if hit[0] is not None:
                    oc += 1
                elif chao and d.z < -0.02 and o.z > -0.02:
                    if -o.z / d.z < dist:
                        oc += 1
            cache[chave] = 1.0 - oc / N
            return cache[chave]

        for f in bm.faces:
            n = f.normal
            nome = s.slots[f.material_index]
            ax = max(range(3), key=lambda i: abs(n[i]))
            tom = f[s.tint]
            pts = []
            for lp in f.loops:
                p = lp.vert.co
                if ax == 0:
                    pts.append((p.y, p.z))
                elif ax == 1:
                    pts.append((p.x, p.z))
                else:
                    pts.append((p.x, p.y))
            if nome in IMG_MAT:
                lm, dm = IMG_MAT[nome]
                for lp, (u, v) in zip(f.loops, pts):
                    p = lp.vert.co
                    lp[uv].uv = ((p.x + lm / 2) / lm, 1.0 - (p.y + dm / 2) / dm if ax == 2 else 0.5)
            else:
                du = max(q[0] for q in pts) - min(q[0] for q in pts)
                dv = max(q[1] for q in pts) - min(q[1] for q in pts)
                troca = dv > du * 1.4  # o veio corre no lado maior da face
                for lp, (u, v) in zip(f.loops, pts):
                    if troca:
                        u, v = v, u
                    lp[uv].uv = (u / LADRILHO, v / LADRILHO)
            for lp in f.loops:
                p = lp.vert.co
                ao = aberto(p, n)
                luz = 0.9 + 0.1 * max(-1.0, min(1.0, n.z))  # o de cima um pouco mais claro
                v_ = max(0.0, min(1.25, tom * luz * (0.42 + 0.58 * ao ** 1.15)))
                lp[col] = (v_, v_, v_, 1.0)

    def objeto(s):
        for v in s.bm.verts:
            v.co.y = -v.co.y  # a frente (+f) vira -Y no Blender, que o glTF leva para +Z
        bmesh.ops.recalc_face_normals(s.bm, faces=s.bm.faces[:])
        s._uv_e_cor()
        me = bpy.data.meshes.new(s.nome)
        s.bm.to_mesh(me)
        s.bm.free()
        for nome in s.slots:
            me.materials.append(mat(nome))
        ob = bpy.data.objects.new(s.nome, me)
        bpy.context.scene.collection.objects.link(ob)
        return ob


# ------------------------------------------------------------------ peças reaproveitadas
def cadeira(m, x, f, z, larg=0.42, fundo=0.42, assento=0.45, topo=0.90, mt_assento="AMARELO", mt_perna="AMARELO_ESC", mt_ripa=None, ripas=3, incl=7):
    """Cadeira de verdade: assento a 0,45 m, pernas finas, as de trás sobem inclinadas até 0,90 m e três ripas finas."""
    mt_ripa = mt_ripa or mt_assento
    esp = 0.036
    m.caixa(mt_assento, x, f, z + assento - 0.035, larg, fundo, 0.035, bisel=0.012)
    # a trave sob o assento (a "cintura" que enrijece as pernas)
    for sx in (-1, 1):
        m.caixa(mt_perna, x + sx * (larg / 2 - 0.03), f, z + assento - 0.095, 0.022, fundo - 0.06, 0.05, bisel=0.004)
    m.caixa(mt_perna, x, f + fundo / 2 - 0.03, z + assento - 0.095, larg - 0.06, 0.022, 0.05, bisel=0.004)
    a = math.radians(incl)
    for sx in (-1, 1):
        px = x + sx * (larg / 2 - esp / 2 - 0.006)
        # frente: reta, um pouco afunilada para baixo
        pf = f + fundo / 2 - esp / 2 - 0.006
        m.tubo(mt_perna, (px, pf, z), (px, pf, z + assento - 0.035), 0.013, 0.0165, seg=8)
        # trás: reta até o assento e depois inclinada até o topo
        pb = f - fundo / 2 + esp / 2 + 0.006
        m.tubo(mt_perna, (px, pb, z), (px, pb, z + assento - 0.035), 0.013, 0.0165, seg=8)
        hu = topo - (assento - 0.035)
        m.caixa(mt_perna, px, pb - math.sin(a) * hu / 2, z + assento - 0.035 + math.cos(a) * hu / 2 - hu / 2, esp - 0.004, esp - 0.004, hu, rot=(incl, 0, 0), bisel=0.006)
    for k in range(ripas):
        zs = (topo - 0.07) - k * (0.085 if ripas > 2 else 0.12) - 0.03
        hh = zs - (assento - 0.035)
        fs = f - fundo / 2 + esp / 2 + 0.006 - math.tan(a) * hh
        m.caixa(mt_ripa, x, fs, z + zs - 0.03, larg - esp * 2 + 0.01, 0.016, 0.062, rot=(incl, 0, 0), bisel=0.005)


def garrafa(m, x, f, z, cor, h=0.23, r=0.0335):
    """Garrafa long neck: corpo cilíndrico, ombro que afina e gargalo, com a tampa."""
    m.cil(cor, x, f, z, r, h * 0.55, r2=r, seg=14)
    m.cil(cor, x, f, z + h * 0.55, r, h * 0.17, r2=r * 0.38, seg=14, tampa=False)
    m.cil(cor, x, f, z + h * 0.72, r * 0.38, h * 0.26, r2=r * 0.34, seg=10)
    m.cil("LATAO", x, f, z + h - 0.008, r * 0.42, 0.008, seg=10)


def lata(m, x, f, z, cor, h=0.122, r=0.033):
    m.cil(cor, x, f, z, r, h, seg=12)
    m.cil("LATA_PRATA", x, f, z + h - 0.004, r * 0.92, 0.004, seg=12)


def prateleiras(m, x0, w, f, d, z_lista, mt="MADEIRA", gar=None, rng=None):
    for z in z_lista:
        m.caixa(mt, x0, f, z, w, d, 0.02, bisel=0.003)
        if gar:
            n = int(w / 0.1)
            for i in range(n):
                if rng.random() < 0.8:
                    garrafa(m, x0 - w / 2 + 0.07 + i * (w - 0.14) / max(1, n - 1), f + rng.uniform(-0.04, 0.04), z + 0.02, rng.choice(gar), h=rng.choice((0.22, 0.25, 0.3)))


def ret(x, f, w, d):
    return [(x - w / 2, f - d / 2), (x + w / 2, f - d / 2), (x + w / 2, f + d / 2), (x - w / 2, f + d / 2)]


# ------------------------------------------------------------------ os móveis (medidas reais, centrados na pegada)
def fazer_stairs_down(m):
    # a boca da escada no chão (0,75 × 0,75 como o corte do piso da cena) e a escada íngreme de madeira que desce
    w = C
    for sx in (-1, 1):
        m.caixa("CONCRETO", sx * (w / 2 - 0.03), 0, 0, 0.06, w, 0.018, bisel=0.004)
    for sf in (-1, 1):
        m.caixa("CONCRETO", 0, sf * (w / 2 - 0.03), 0, w - 0.12, 0.06, 0.018, bisel=0.004)
    for sx in (-1, 1):  # as paredes do poço e as vigas que seguram os degraus
        m.caixa("CONCRETO", sx * (w / 2 - 0.065), -0.05, -1.3, 0.02, w - 0.14, 1.3, bisel=0.001)
        m.caixa("MADEIRA_ESC", sx * (w / 2 - 0.1), 0.0, -1.2, 0.04, w - 0.14, 0.04, rot=(-47, 0, 0), bisel=0.004)
    m.caixa("CONCRETO", 0, -(w / 2 - 0.07), -1.3, w - 0.14, 0.02, 1.3, bisel=0.001)
    for i in range(6):  # os degraus descem para trás: piso de madeira e espelho
        m.caixa("MADEIRA", 0, 0.24 - i * 0.1, -0.2 * (i + 1) + 0.0, w - 0.18, 0.12, 0.035, bisel=0.004)
        m.caixa("MADEIRA_ESC", 0, 0.24 - i * 0.1 + 0.06, -0.2 * (i + 1) - 0.15, w - 0.18, 0.015, 0.17, bisel=0.002)
    m.caixa("LATAO", w / 2 - 0.1, 0.0, -0.1, 0.022, 0.55, 0.022, rot=(-30, 0, 0), bisel=0.002)
    m.tubo("LATAO", (w / 2 - 0.1, 0.27, 0.0), (w / 2 - 0.1, 0.27, 0.8), 0.012, seg=8)


def _geladeira(m, corpo, luz, bebida, topo):
    """Geladeira de vitrine de bar: 0,62 × 0,65 × 1,95 m, com a luz de dentro, prateleiras, grade do motor e letreiro."""
    w, d, h = 0.62, 0.65, 1.95
    m.caixa("PRETO", 0, 0, 0.0, w - 0.02, d - 0.04, 0.1, bisel=0.004)  # o rodapé
    for k in range(5):  # a grade do motor
        m.caixa("METAL_ESC", 0, d / 2 - 0.02, 0.025 + k * 0.016, w - 0.18, 0.012, 0.008, bisel=0.001)
    m.caixa(corpo, 0, 0, 0.1, w, d, h - 0.1 - 0.3, bisel=0.012)  # o corpo, até o letreiro
    # a abertura da vitrine: moldura preta, fundo aceso, prateleiras, vidro na frente
    y0, y1 = 0.2, h - 0.34
    prof = 0.07
    for sx in (-1, 1):
        m.caixa("PRETO", sx * (w / 2 - 0.035), d / 2 - prof / 2, y0, 0.07, prof, y1 - y0, bisel=0.003)
    m.caixa("PRETO", 0, d / 2 - prof / 2, y0 - 0.05, w, prof, 0.06, bisel=0.003)
    m.caixa("PRETO", 0, d / 2 - prof / 2, y1 - 0.01, w, prof, 0.06, bisel=0.003)
    m.caixa("PRETO", 0, d / 2 - prof - 0.01, y0, w - 0.14, 0.012, y1 - y0, bisel=0.001)
    m.caixa(luz, 0, d / 2 - prof - 0.02, y0 + 0.01, w - 0.18, 0.006, y1 - y0 - 0.02, bisel=0.001)
    rng = random.Random(7)
    for k in range(5):
        z = y0 + 0.05 + k * 0.275
        m.caixa("METAL", 0, d / 2 - prof / 2 - 0.01, z, w - 0.16, prof - 0.03, 0.01, bisel=0.002)
        for i in range(4):
            xx = -0.195 + i * 0.13
            ff = d / 2 - prof / 2 - 0.012 + rng.uniform(-0.01, 0.01)
            if bebida == "cerveja":
                garrafa(m, xx, ff, z + 0.01, rng.choice(["GARRAFA_AMBAR", "GARRAFA_AMBAR", "GARRAFA_VERDE"]), h=0.23, r=0.0335)
            else:
                lata(m, xx - 0.03, ff, z + 0.01, rng.choice(["LATA_VERM", "LATA_AZUL", "LATA_PRATA"]))
                lata(m, xx + 0.035, ff, z + 0.01, rng.choice(["LATA_VERM", "LATA_AZUL", "LATA_PRATA"]))
    m.caixa("VIDRO", 0, d / 2 - 0.004, y0, w - 0.14, 0.006, y1 - y0, bisel=0.001)
    m.cil("METAL", w / 2 - 0.05, d / 2 + 0.012, 0.75, 0.012, 0.7, seg=8)  # a puxada vertical
    for z in (0.78, 1.38):
        m.caixa("METAL_ESC", w / 2 - 0.05, d / 2 + 0.002, z, 0.02, 0.022, 0.025, bisel=0.002)
    # o letreiro aceso de cima e a tampa
    m.caixa(topo, 0, d / 2 - 0.03, h - 0.27, w - 0.08, 0.05, 0.22, bisel=0.006)
    m.caixa("PRETO", 0, d / 2 - 0.02, h - 0.33, w - 0.04, 0.07, 0.04, bisel=0.004)
    m.caixa("METAL_ESC", 0, -0.02, h - 0.03, w, d - 0.04, 0.03, bisel=0.006)
    # as rodinhas e o cabo atrás
    for sx in (-1, 1):
        m.cil("PRETO", sx * (w / 2 - 0.06), d / 2 - 0.08, 0.0, 0.025, 0.03, seg=10)


def fazer_beer_fridge(m):
    _geladeira(m, "GELADEIRA_VERM", "EMISSIVO_FRIO", "cerveja", "EMISSIVO")
    m.caixa("PRETO", -0.2, 0.33, 0.9, 0.08, 0.012, 0.16, bisel=0.002)  # o painel do termostato
    for r in range(3):
        m.caixa("LATAO", -0.2, 0.34, 0.93 + r * 0.04, 0.05, 0.006, 0.012, bisel=0.001)


def fazer_fridge_drinks(m):
    _geladeira(m, "GELADEIRA", "EMISSIVO_FRIO", "lata", "EMISSIVO_FRIO")


def fazer_bar_shelf(m):
    # o armário-estante do fundo do balcão: embaixo, duas portas de painel; em cima, o nicho de garrafas atrás de vidro
    w, h = 1.5, 2.0
    rng = random.Random(3)
    dl = 0.55  # o armário baixo: 55 cm de fundo, encostado na parede (atrás)
    fl = -C / 2 + dl / 2
    m.caixa("MADEIRA_ESC", 0, fl, 0.06, w - 0.02, dl, 0.82, bisel=0.012)
    m.caixa("PRETO", 0, fl, 0.0, w - 0.08, dl - 0.06, 0.06, bisel=0.004)
    for sx in (-1, 1):
        px = sx * (w / 4)
        m.caixa("MADEIRA", px, fl + dl / 2 - 0.005, 0.1, w / 2 - 0.06, 0.022, 0.74, bisel=0.008)
        m.caixa("MADEIRA_ESC", px, fl + dl / 2 + 0.008, 0.18, w / 2 - 0.2, 0.012, 0.58, bisel=0.006)  # o painel em relevo
        m.cil("LATAO", sx * 0.06, fl + dl / 2 + 0.02, 0.5, 0.009, 0.1, seg=8)
    m.caixa("MADEIRA", 0, fl + 0.02, 0.88, w, dl + 0.06, 0.04, bisel=0.01)  # o tampo, com beiral
    du = 0.28  # o nicho de cima: 28 cm de fundo
    fu = -C / 2 + du / 2
    zu = 0.92
    for sx in (-1, 1):
        m.caixa("MADEIRA_ESC", sx * (w / 2 - 0.03), fu, zu, 0.06, du, h - zu - 0.07, bisel=0.008)
    m.caixa("MADEIRA_ESC", 0, fu - du / 2 + 0.01, zu, w - 0.1, 0.02, h - zu - 0.07, bisel=0.004)
    m.caixa("MADEIRA", 0, fu + 0.02, h - 0.07, w, du + 0.06, 0.07, bisel=0.012)  # a cornija
    gar = ["GARRAFA_VERDE", "GARRAFA_AMBAR", "GARRAFA_CLARA", "GARRAFA_VERM"]
    for k in range(3):
        z = zu + 0.03 + k * 0.33
        m.caixa("MADEIRA", 0, fu, z, w - 0.12, du - 0.04, 0.02, bisel=0.003)
        n = 13
        for i in range(n):
            if rng.random() < 0.82:
                garrafa(m, -w / 2 + 0.1 + i * (w - 0.2) / (n - 1), fu + rng.uniform(-0.04, 0.04), z + 0.02, rng.choice(gar), h=rng.choice((0.2, 0.23, 0.26, 0.29)))
    m.caixa("VIDRO", 0, fu + du / 2 + 0.004, zu + 0.02, w - 0.12, 0.006, h - zu - 0.12, bisel=0.001)
    m.caixa("MADEIRA", 0, fu + du / 2 + 0.006, zu + 0.02, 0.03, 0.014, h - zu - 0.12, bisel=0.003)
    m.caixa("EMISSIVO", 0, fu + du / 2 - 0.04, h - 0.1, w - 0.2, 0.014, 0.02, bisel=0.002)


def fazer_minibar(m):
    # o frigobar preto de balcão: 0,5 × 0,5 × 0,9 m, frente de vidro e as garrafas deitadas
    w, d, h = 0.5, 0.5, 0.9
    m.caixa("PRETO", 0, 0, 0.0, w, d, h - 0.04, bisel=0.01)
    m.caixa("MADEIRA_ESC", 0, 0, h - 0.04, w + 0.02, d + 0.02, 0.04, bisel=0.008)
    m.caixa("PRETO", 0, d / 2 - 0.02, 0.1, w - 0.06, 0.02, h - 0.22, bisel=0.003)
    m.caixa("EMISSIVO_FRIO", 0, d / 2 - 0.036, 0.12, w - 0.1, 0.006, h - 0.26, bisel=0.001)
    for k in range(3):
        z = 0.15 + k * 0.22
        m.caixa("METAL", 0, d / 2 - 0.09, z, w - 0.12, 0.12, 0.01, bisel=0.002)
        for i, cor in enumerate((["GARRAFA_AMBAR", "GARRAFA_VERDE", "GARRAFA_CLARA"], ["GARRAFA_VERM", "GARRAFA_AMBAR", "GARRAFA_VERDE"], ["GARRAFA_CLARA", "GARRAFA_VERM", "GARRAFA_AMBAR"])[k]):
            garrafa(m, -0.13 + i * 0.13, d / 2 - 0.09, z + 0.01, cor, h=0.2, r=0.028)
    m.caixa("VIDRO", 0, d / 2 - 0.004, 0.1, w - 0.06, 0.006, h - 0.22, bisel=0.001)
    m.cil("LATAO", w / 2 - 0.04, d / 2 + 0.01, 0.32, 0.01, 0.26, seg=8)
    garrafa(m, -0.12, 0.0, h, "GARRAFA_AMBAR", h=0.25)
    garrafa(m, 0.05, 0.08, h, "GARRAFA_VERDE", h=0.23)


def fazer_beer_crate(m):
    # o engradado plástico de cerveja: 0,44 × 0,33, paredes vazadas e doze garrafas em pé de 0,23 m
    w, d = 0.44, 0.33
    m.caixa("PLASTICO_VERM", 0, 0, 0.0, w, d, 0.02, bisel=0.004)
    m.caixa("PLASTICO_VERM", 0, 0, 0.0, w, d, 0.04, bisel=0.004)
    for sx in (-1, 1):
        m.caixa("PLASTICO_VERM", sx * (w / 2 - 0.012), 0, 0.0, 0.024, d, 0.04, bisel=0.004)
        for j in range(4):  # as ripas verticais das paredes menores
            m.caixa("PLASTICO_VERM", sx * (w / 2 - 0.012), -0.12 + j * 0.08, 0.04, 0.022, 0.03, 0.19, bisel=0.004)
        m.caixa("PLASTICO_VERM", sx * (w / 2 - 0.012), 0, 0.23, 0.026, d, 0.03, bisel=0.005)
    for sf in (-1, 1):
        m.caixa("PLASTICO_VERM", 0, sf * (d / 2 - 0.012), 0.0, w - 0.05, 0.024, 0.04, bisel=0.004)
        for j in range(5):
            m.caixa("PLASTICO_VERM", -0.16 + j * 0.08, sf * (d / 2 - 0.012), 0.04, 0.03, 0.022, 0.19, bisel=0.004)
        m.caixa("PLASTICO_VERM", 0, sf * (d / 2 - 0.012), 0.23, w - 0.05, 0.026, 0.03, bisel=0.005)
    for i in range(4):
        for k in range(3):
            garrafa(m, -0.13 + i * 0.087, -0.085 + k * 0.085, 0.02, "GARRAFA_AMBAR", h=0.25, r=0.0335 if k == 1 else 0.0335)


def fazer_keg(m):
    # o barril de chope de aço de 50 L: 0,40 de diâmetro e 0,55 de altura, com aros e a válvula
    r, h = 0.2, 0.55
    m.cil("METAL", 0, 0, 0.03, r, h - 0.06, seg=32)
    for z in (0.0, h - 0.05):  # as bordas dobradas de cima e de baixo
        m.cil("METAL_ESC", 0, 0, z, r + 0.008, 0.05, seg=32)
    for z in (0.17, 0.33):  # os dois vincos
        m.cil("METAL_ESC", 0, 0, z, r + 0.004, 0.018, seg=32)
    m.cil("METAL_ESC", 0, 0, h, r - 0.02, 0.012, seg=32)
    m.cil("METAL", 0, 0, h + 0.012, 0.07, 0.05, seg=20)
    m.cil("LATAO", 0, 0, h + 0.062, 0.045, 0.035, seg=16)
    m.tubo("LATAO", (0.0, 0.0, h + 0.097), (0.0, 0.07, h + 0.12), 0.014, seg=10)
    m.anel("METAL_ESC", 0, 0, h + 0.02, 0.14, 0.008, seg=20)


def fazer_bar_counter(m):
    # o balcão de 1,5 m a 1,05 m: tampo de madeira com beiral, frente de tábuas verticais, rodapé escuro e o pé de latão
    w, h = 1.5, 1.05
    dc = 0.5  # o corpo
    fc = -0.04
    m.caixa("PRETO", 0, fc, 0, w - 0.02, dc - 0.06, 0.1, bisel=0.004)  # o rodapé
    m.caixa("MADEIRA_ESC", 0, fc, 0.1, w - 0.02, dc, h - 0.1 - 0.05, bisel=0.01)
    nt = 10
    for i in range(nt):  # a frente: tábuas verticais com a junta escura
        x = -(w - 0.1) / 2 + (i + 0.5) * (w - 0.1) / nt
        m.caixa("MADEIRA" if i % 2 else "MADEIRA_ESC", x, fc + dc / 2 + 0.006, 0.12, (w - 0.1) / nt - 0.012, 0.016, h - 0.34, bisel=0.004)
    m.caixa("MADEIRA_ESC", 0, fc + dc / 2 + 0.01, h - 0.2, w - 0.04, 0.022, 0.05, bisel=0.006)  # a travessa de cima
    m.caixa("MADEIRA", 0, 0, h - 0.05, w, 0.72, 0.05, bisel=0.014)  # o tampo
    m.caixa("MADEIRA_ESC", 0, 0.34, h - 0.07, w - 0.02, 0.04, 0.03, bisel=0.008)  # o frisado do beiral
    m.tubo("LATAO", (-w / 2 + 0.05, 0.3, 0.17), (w / 2 - 0.05, 0.3, 0.17), 0.022, seg=12)  # o pé de latão
    for sx in (-1, 0, 1):
        m.tubo("LATAO", (sx * (w / 2 - 0.1), 0.3, 0.17), (sx * (w / 2 - 0.1), fc + dc / 2, 0.13), 0.01, seg=8)


def fazer_beer_glass(m):
    # o copo americano de chope: 14,7 cm, base grossa, cerveja e colarinho
    m.cil("VIDRO", 0, 0, 0.0, 0.034, 0.147, r2=0.041, seg=20)
    m.cil("VIDRO", 0, 0, 0.0, 0.032, 0.012, seg=20)
    m.cil("CERVEJA", 0, 0, 0.012, 0.031, 0.104, r2=0.038, seg=20)
    m.cil("ESPUMA", 0, 0, 0.115, 0.0375, 0.026, r2=0.039, seg=20)


def fazer_stool_bar(m):
    # o banco de balcão: assento de couro vermelho a 0,75 m com 0,36 m, quatro pernas de madeira escura e o aro de latão
    h = 0.75
    for sx in (-1, 1):
        for sf in (-1, 1):
            m.tubo("MADEIRA_ESC", (sx * 0.15, sf * 0.15, 0.0), (sx * 0.115, sf * 0.115, h - 0.07), 0.015, 0.02, seg=8)
    z = 0.28
    pts = [(sx * 0.14, sf * 0.14) for sx, sf in ((-1, -1), (1, -1), (1, 1), (-1, 1), (-1, -1))]
    for a, b in zip(pts, pts[1:]):
        m.tubo("LATAO", (a[0], a[1], z), (b[0], b[1], z), 0.009, seg=8)
    m.caixa("MADEIRA_ESC", 0, 0, h - 0.075, 0.26, 0.26, 0.02, bisel=0.004)
    m.cil("COURO_ESC", 0, 0, h - 0.06, 0.18, 0.02, seg=24)
    m.cil("COURO_VERM", 0, 0, h - 0.045, 0.185, 0.045, r2=0.172, seg=24)
    m.cil("COURO_VERM", 0, 0, h - 0.003, 0.165, 0.003, seg=24)
    m.anel("LATAO", 0, 0, h - 0.047, 0.182, 0.005, seg=28)


def fazer_armchair_red(m):
    # a poltrona de couro vermelho: 0,72 × 0,70 m, assento a 0,42 m, encosto a 0,90 m, braços rolados e botões de latão
    w, d = 0.72, 0.70
    for sx in (-1, 1):
        for sf in (-1, 1):
            m.tubo("MADEIRA_ESC", (sx * (w / 2 - 0.06), sf * (d / 2 - 0.06), 0.0), (sx * (w / 2 - 0.06), sf * (d / 2 - 0.06), 0.14), 0.026, 0.034, seg=8)
    m.caixa("MADEIRA_ESC", 0, 0, 0.12, w - 0.04, d - 0.04, 0.04, bisel=0.006)
    m.caixa("COURO_VERM", 0, 0.02, 0.16, w - 0.04, d - 0.1, 0.15, bisel=0.04)  # a base do assento
    m.caixa("COURO_VERM", 0, 0.06, 0.31, w - 0.3, d - 0.2, 0.11, bisel=0.045)  # a almofada
    m.caixa("COURO_VERM", 0, -d / 2 + 0.1, 0.16, w - 0.04, 0.2, 0.74, rot=(-6, 0, 0), bisel=0.06)  # o encosto
    for sx in (-1, 1):
        m.caixa("COURO_VERM", sx * (w / 2 - 0.08), 0.03, 0.16, 0.15, d - 0.1, 0.42, bisel=0.06)  # o braço
        m.cil("COURO_VERM", sx * (w / 2 - 0.08), 0.03, 0.58 - (d - 0.12) / 2, 0.07, d - 0.12, rot=(90, 0, 0), seg=14)  # o rolo
    for r in range(3):  # os botões do capitonê
        for c in range(3):
            m.esf("LATAO", -0.16 + c * 0.16, -d / 2 + 0.2 - r * 0.012, 0.54 + r * 0.12, 0.012, ez=0.7, seg=8)
    for c in range(2):
        m.caixa("COURO_ESC", -0.08 + c * 0.16, -d / 2 + 0.205, 0.5, 0.006, 0.006, 0.34, rot=(-6, 0, 0), bisel=0.001)


def _caminho_folha(x, f, z, az, comp, curva, n):
    px, pf, pz = x, f, z
    t = math.radians(6 + curva * 0.15)
    pts = [(px, pf, pz)]
    for i in range(n):
        L = comp / n
        t += math.radians(curva) / n * (1 + i * 0.4)
        px += math.cos(az) * math.sin(t) * L
        pf += math.sin(az) * math.sin(t) * L
        pz += math.cos(t) * L
        pts.append((px, pf, pz))
    return pts


def _folha(m, mt, x, f, z, az, comp, larg, curva, n=5, alcance=0.3):
    """Uma folha de dracena: espada comprida que sobe e tomba para fora do vaso, em n pedaços que afinam. O tombo é
    reduzido até a ponta não passar de `alcance` do centro (a planta cabe na pegada de 0,75 m)."""
    c = curva
    pts = _caminho_folha(x, f, z, az, comp, c, n)
    while math.hypot(pts[-1][0], pts[-1][1]) > alcance and c > 2:
        c *= 0.88
        pts = _caminho_folha(x, f, z, az, comp, c, n)
    for i in range(n):
        r0 = larg * (1 - i / (n + 1) * 0.5)
        r1 = larg * (1 - (i + 1) / (n + 1) * 0.5) if i < n - 1 else 0.003
        m.tubo(mt, pts[i], pts[i + 1], r0, r1, seg=4, ef=0.26, tampa=False)


def fazer_plant(m):
    # o vaso de terracota (0,28 m) com uma dracena de 1,1 m: folhas em espada que caem para fora
    m.cil("TERRACOTA", 0, 0, 0, 0.12, 0.26, r2=0.17, seg=16)
    m.cil("TERRACOTA", 0, 0, 0.26, 0.19, 0.04, seg=16)
    m.cil("TERRA", 0, 0, 0.295, 0.16, 0.012, seg=16)
    rng = random.Random(11)
    for i in range(24):
        az = math.radians(i * 137.5)
        comp = rng.uniform(0.5, 0.78) if i > 3 else rng.uniform(0.78, 0.86)
        curva = rng.uniform(30, 90) if i > 3 else rng.uniform(4, 20)
        r0 = rng.uniform(0.03, 0.08) * (0.2 if i < 5 else 1.0)
        _folha(m, "FOLHA" if i % 2 else "FOLHA_ESC", math.cos(az) * r0, math.sin(az) * r0, 0.3, az, comp, 0.03, curva, alcance=0.31)
    m.cil("MADEIRA", 0, 0, 0.3, 0.012, 0.18, seg=6)


def fazer_arcade(m):
    # o fliperama: 0,62 × 0,72 × 1,8 m. Caixa de baixo, painel de botões inclinado, tela, cabeça e letreiro acesos
    w, d, h = 0.62, 0.72, 1.8
    m.caixa("PRETO", 0, 0.0, 0.0, w, d - 0.08, 0.9, bisel=0.012)
    for sx in (-1, 1):  # as faixas de neon nas laterais
        m.caixa("NEON_AZUL", sx * (w / 2 + 0.002), 0.0, 0.1, 0.008, d - 0.2, 0.025, bisel=0.001)
        m.caixa("NEON_ROSA", sx * (w / 2 + 0.002), 0.0, 0.7, 0.008, d - 0.2, 0.025, bisel=0.001)
    m.caixa("PRETO", 0, d / 2 - 0.11, 0.02, w - 0.12, 0.02, 0.5, bisel=0.002)  # a gaveta de moedas
    m.caixa("PLASTICO_VERM", 0.0, d / 2 - 0.097, 0.62, 0.12, 0.01, 0.1, bisel=0.002)
    m.caixa("METAL_ESC", 0, d / 2 - 0.2, 0.9, w - 0.04, 0.4, 0.06, rot=(-12, 0, 0), bisel=0.01)  # o painel inclinado
    for i in range(3):
        m.cil(["PLASTICO_VERM", "PLASTICO_AZUL", "LATAO"][i], 0.05 + i * 0.075, d / 2 - 0.17, 0.955, 0.02, 0.014, seg=14)
    m.cil("PLASTICO_VERM", -0.12, d / 2 - 0.17, 0.955, 0.012, 0.075, seg=10)
    m.esf("PLASTICO_VERM", -0.12, d / 2 - 0.17, 1.04, 0.026, seg=12)
    m.caixa("PRETO", 0, -0.1, 0.9, w, d - 0.34, 0.9, bisel=0.012)
    m.caixa("PRETO", 0, 0.1, 1.04, w - 0.06, 0.05, 0.56, rot=(14, 0, 0), bisel=0.006)
    m.caixa("EMISSIVO_AZUL", 0, 0.125, 1.08, w - 0.14, 0.012, 0.46, rot=(14, 0, 0), bisel=0.001)
    for i, cor in enumerate(("NEON_ROSA", "EMISSIVO", "NEON_AZUL", "EMISSIVO_VERDE", "NEON_ROSA")):
        m.caixa(cor, -0.2 + i * 0.1, 0.133, 1.1 + (i % 2) * 0.12, 0.07, 0.004, 0.1 + (i % 3) * 0.06, rot=(14, 0, 0), bisel=0.0005)
    m.caixa("NEON_ROSA", 0, 0.1, 1.6, w - 0.04, 0.14, 0.16, bisel=0.008)
    m.caixa("PRETO", 0, -0.1, 1.78, w, d - 0.34, 0.02, bisel=0.005)
    for sx in (-1, 1):  # as caixas de som
        for k in range(4):
            m.caixa("METAL_ESC", sx * (w / 2 - 0.1), 0.1, 1.5 + k * 0.012 - 0.04, 0.1, 0.012, 0.006, rot=(14, 0, 0), bisel=0.001)


def fazer_chair_stack(m):
    # cinco cadeiras de plástico azul empilhadas, cada uma 9 cm mais alta e 6 cm mais para trás
    for i in range(5):
        cadeira(m, 0.0, 0.1 - 0.06 * i, 0.09 * i, larg=0.42, fundo=0.42, assento=0.45, topo=0.88, mt_assento="PLASTICO_AZUL", mt_perna="PRETO", ripas=2)


def fazer_table_bar(m):
    # a mesa de bar: tampo redondo de 0,70 m a 0,75 m, laqueado amarelo com a borda vermelha, poste preto fino e pé em cruz
    h = 0.75
    for ang in (0, 90):
        m.caixa("PRETO", 0, 0, 0.0, 0.46, 0.04, 0.03, rot=(0, 0, ang), bisel=0.006)
        for s in (-1, 1):
            m.cil("PRETO", math.cos(math.radians(ang)) * s * 0.225, math.sin(math.radians(ang)) * s * 0.225, 0.0, 0.025, 0.012, seg=10)
    m.cil("PRETO", 0, 0, 0.03, 0.026, h - 0.095, seg=12)
    m.cil("PRETO", 0, 0, 0.03, 0.045, 0.03, r2=0.026, seg=12)
    m.cil("PRETO", 0, 0, h - 0.07, 0.1, 0.03, seg=16)
    m.cil("PLASTICO_VERM", 0, 0, h - 0.04, 0.356, 0.04, seg=44)
    m.cil("AMARELO", 0, 0, h - 0.0395, 0.32, 0.0405, seg=44)


def fazer_chair_bar(m):
    cadeira(m, 0, 0, 0)


def fazer_table_small(m):
    # a mesinha quadrada de madeira escura: 0,55 m de lado, 0,62 m de altura, pernas finas e uma cintura
    s, h = 0.55, 0.62
    m.caixa("MADEIRA_ESC", 0, 0, h - 0.035, s, s, 0.035, bisel=0.012)
    m.caixa("MADEIRA", 0, 0, h - 0.032, s - 0.06, s - 0.06, 0.033, bisel=0.003)
    m.caixa("MADEIRA_ESC", 0, 0, h - 0.1, s - 0.08, s - 0.08, 0.065, bisel=0.004)
    for sx in (-1, 1):
        for sf in (-1, 1):
            m.tubo("MADEIRA_ESC", (sx * (s / 2 - 0.04), sf * (s / 2 - 0.04), 0.0), (sx * (s / 2 - 0.04), sf * (s / 2 - 0.04), h - 0.1), 0.017, 0.024, seg=8)


def fazer_ashtray(m):
    # o cinzeiro de vidro de 12 cm, com cinzas, uma guimba e um cigarro aceso
    m.cil("VIDRO", 0, 0, 0, 0.055, 0.026, r2=0.062, seg=24)
    m.cil("CINZA", 0, 0, 0.008, 0.047, 0.014, seg=18)
    for a in (0, 90, 180, 270):
        r = math.radians(a)
        m.caixa("VIDRO", math.cos(r) * 0.058, math.sin(r) * 0.058, 0.02, 0.014, 0.014, 0.016, bisel=0.002)
    m.caixa("BRANCO", 0.012, 0.01, 0.022, 0.05, 0.007, 0.007, rot=(0, 0, 25), bisel=0.002)
    m.caixa("CHAMA", 0.04, 0.02, 0.022, 0.01, 0.007, 0.007, rot=(0, 0, 25), bisel=0.001)
    m.caixa("BEGE", -0.02, -0.015, 0.022, 0.035, 0.007, 0.007, rot=(0, 0, -30), bisel=0.002)


def fazer_pool_table(m):
    # a mesa de sinuca de 1,35 × 2,55 m (cabe com folga na pegada de 1,5 × 3,0), trilho de madeira a 0,83 m, feltro,
    # seis caçapas, pernas torneadas, as bolas no triângulo, a branca e o taco
    W, D = 1.35, 2.55
    for sx in (-1, 1):
        for sf in (-1, 1):
            x, f = sx * (W / 2 - 0.1), sf * (D / 2 - 0.1)
            m.cil("MADEIRA_ESC", x, f, 0, 0.055, 0.06, r2=0.075, seg=12)
            m.cil("MADEIRA_ESC", x, f, 0.06, 0.075, 0.1, r2=0.058, seg=12)
            m.cil("MADEIRA_ESC", x, f, 0.16, 0.058, 0.36, r2=0.07, seg=12)
            m.cil("MADEIRA_ESC", x, f, 0.52, 0.07, 0.2, r2=0.09, seg=12)
    m.caixa("MADEIRA_ESC", 0, 0, 0.6, W - 0.12, D - 0.12, 0.17, bisel=0.012)  # a saia sob o trilho
    m.caixa("PRETO", 0, 0, 0.77, W - 0.28, D - 0.28, 0.02, bisel=0.004)  # a base de ardósia
    m.caixa("FELTRO", 0, 0, 0.785, W - 0.3, D - 0.3, 0.012, bisel=0.002)
    for sx in (-1, 1):  # os trilhos
        m.caixa("MADEIRA", sx * (W / 2 - 0.08), 0, 0.74, 0.16, D, 0.09, bisel=0.012)
        m.caixa("FELTRO", sx * (W / 2 - 0.175), 0, 0.797, 0.045, D - 0.38, 0.035, bisel=0.012)
    for sf in (-1, 1):
        m.caixa("MADEIRA", 0, sf * (D / 2 - 0.08), 0.74, W - 0.02, 0.16, 0.09, bisel=0.012)
        m.caixa("FELTRO", 0, sf * (D / 2 - 0.175), 0.797, W - 0.38, 0.045, 0.035, bisel=0.012)
    # as caçapas: um disco escuro no canto e no meio de cada lado maior
    for sx in (-1, 1):
        for sf in (-1, 1):
            m.cil("PRETO", sx * (W / 2 - 0.115), sf * (D / 2 - 0.115), 0.79, 0.058, 0.012, seg=16)
        m.cil("PRETO", sx * (W / 2 - 0.1), 0, 0.79, 0.05, 0.012, seg=16)
    for sx in (-1, 1):  # os losangos de latão do trilho
        for k in (-0.9, -0.6, -0.3, 0.3, 0.6, 0.9):
            m.cil("LATAO", sx * (W / 2 - 0.08), k, 0.83, 0.009, 0.004, seg=8)
    for sf in (-1, 1):
        for k in (-0.3, 0.0, 0.3):
            m.cil("LATAO", k, sf * (D / 2 - 0.08), 0.83, 0.009, 0.004, seg=8)
    cores = ["#e8c42a", "#2c4fb3", "#c32b2b", "#5b2a8a", "#e07a1f", "#1f7a3c", "#7a1f1f", "#101010"]
    r = 0.0286
    n = 0
    z = 0.797 + r
    for lin in range(5):
        for k in range(lin + 1):
            nome = f"BOLA{n % 8}"
            if nome not in PALETA:
                PALETA[nome] = (cores[n % 8], None, 1)
            m.esf(nome, (k - lin / 2) * (2 * r + 0.002), -D / 4 - lin * (2 * r * 0.866 + 0.002), z, r, seg=10)
            n += 1
    PALETA.setdefault("BOLA_BRANCA", ("#f1efe6", None, 1))
    m.esf("BOLA_BRANCA", 0.04, D / 4, z, r, seg=10)
    # o taco, deitado no trilho
    m.tubo("MADEIRA_CLARA", (-W / 2 + 0.2, -0.5, 0.855), (-W / 2 + 0.25, 0.95, 0.855), 0.015, 0.007, seg=8)


def fazer_rug_ornate(m):
    w, d = 2.11, 2.8
    m.caixa("RUG_ORNATE", 0, 0, 0, w, d, 0.012, bisel=0.003)
    for sf in (-1, 1):
        for i in range(48):
            m.caixa("BEGE", -w / 2 + 0.04 + i * (w - 0.08) / 47, sf * (d / 2 + 0.02), 0, 0.016, 0.07, 0.006, bisel=0.001)


def fazer_rug_worn(m):
    w, d = 1.38, 2.05
    m.caixa("RUG_WORN", 0, 0, 0, w, d, 0.01, bisel=0.003)
    for sf in (-1, 1):
        for i in range(32):
            m.caixa("BEGE", -w / 2 + 0.04 + i * (w - 0.08) / 31, sf * (d / 2 + 0.02), 0, 0.014, 0.06, 0.005, bisel=0.001)


def fazer_sideboard(m):
    # o aparador de madeira: 1,5 × 0,48 m, pés afunilados de 12 cm, tampo claro e três portas com pegador de latão
    w, d, h = 1.5, 0.48, 0.88
    m.caixa("MADEIRA_ESC", 0, 0, 0.12, w - 0.02, d - 0.02, h - 0.12 - 0.04, bisel=0.008)
    for sx in (-1, 1):
        for sf in (-1, 1):
            m.tubo("MADEIRA_ESC", (sx * (w / 2 - 0.08), sf * (d / 2 - 0.06), 0.0), (sx * (w / 2 - 0.07), sf * (d / 2 - 0.05), 0.13), 0.02, 0.03, seg=8)
    m.caixa("MADEIRA_CLARA", 0, 0, h - 0.04, w, d + 0.03, 0.04, bisel=0.01)
    for i in range(3):
        x = -w / 3 + i * w / 3
        m.caixa("MADEIRA", x, d / 2 - 0.008, 0.16, w / 3 - 0.05, 0.02, h - 0.28, bisel=0.006)
        m.caixa("MADEIRA_ESC", x, d / 2 + 0.003, 0.2, w / 3 - 0.13, 0.008, h - 0.36, bisel=0.004)
        m.cil("LATAO", x + (0.1 if i % 2 else -0.1), d / 2 + 0.012, h * 0.55, 0.009, 0.012, rot=(90, 0, 0), seg=10)
        m.caixa("LATAO", x + (0.1 if i % 2 else -0.1), d / 2 + 0.02, h * 0.55 - 0.04, 0.008, 0.008, 0.08, bisel=0.001)


def fazer_bar_cabinet(m):
    # o armário de bebidas: 0,6 × 0,48 × 1,0 m, duas portas de painel, tampo claro e duas garrafas em cima
    w, d, h = 0.6, 0.48, 1.0
    m.caixa("PRETO", 0, 0, 0, w - 0.06, d - 0.06, 0.08, bisel=0.004)
    m.caixa("MADEIRA_ESC", 0, 0, 0.08, w - 0.01, d - 0.01, h - 0.08 - 0.04, bisel=0.008)
    m.caixa("MADEIRA_CLARA", 0, 0, h - 0.04, w + 0.02, d + 0.02, 0.04, bisel=0.01)
    for sx in (-1, 1):
        m.caixa("MADEIRA", sx * (w / 4), d / 2 - 0.006, 0.12, w / 2 - 0.04, 0.02, h - 0.24, bisel=0.006)
        m.caixa("MADEIRA_ESC", sx * (w / 4), d / 2 + 0.004, 0.2, w / 2 - 0.14, 0.008, h - 0.4, bisel=0.004)
        m.esf("LATAO", sx * 0.04, d / 2 + 0.018, h * 0.55, 0.014, ez=0.7, seg=10)
    garrafa(m, -0.14, 0.0, h, "GARRAFA_AMBAR", h=0.3)
    garrafa(m, 0.0, 0.07, h, "GARRAFA_CLARA", h=0.27)


def fazer_sofa_booth(m):
    # o sofá de bar de dois lugares: 1,46 × 0,70 m, assento a 0,42 m, encosto a 0,95 m com gomos, base e braços de madeira
    w, d = 1.46, 0.70
    m.caixa("MADEIRA_ESC", 0, 0, 0.0, w, d, 0.13, bisel=0.01)
    for sx in (-1, 1):
        m.caixa("COURO_VERM", sx * (w / 4 - 0.01), 0.05, 0.13, w / 2 - 0.2, d - 0.18, 0.17, bisel=0.04)  # as duas almofadas
        m.caixa("MADEIRA_ESC", sx * (w / 2 - 0.05), 0, 0.13, 0.1, d, 0.5, bisel=0.012)  # os braços
        m.caixa("COURO_VERM", sx * (w / 2 - 0.05), 0, 0.63, 0.12, d - 0.04, 0.05, bisel=0.02)
    n = 7
    for i in range(n):  # os gomos do encosto, com costura escura entre eles
        x = -w / 2 + 0.16 + i * (w - 0.32) / (n - 1)
        m.caixa("COURO_VERM", x, -d / 2 + 0.1, 0.13, (w - 0.32) / (n - 1) - 0.008, 0.18, 0.78, bisel=0.025)
        m.esf("LATAO", x, -d / 2 + 0.2, 0.6, 0.011, ez=0.7, seg=8)
        m.esf("LATAO", x, -d / 2 + 0.2, 0.8, 0.011, ez=0.7, seg=8)
    m.caixa("MADEIRA_ESC", 0, -d / 2 + 0.1, 0.9, w - 0.1, 0.2, 0.05, bisel=0.008)


def fazer_ceiling_lamp(m):
    # a pendente: canopla no teto, fio fino, cúpula esmaltada de 0,38 m (branca com a borda azul) e a lâmpada acesa
    m.cil("PRETO", 0, 0, -0.025, 0.05, 0.025, seg=14)
    m.cil("PRETO", 0, 0, -0.5, 0.005, 0.475, seg=6)
    m.cil("PRETO", 0, 0, -0.545, 0.03, 0.045, seg=12)
    m.cil("BRANCO", 0, 0, -0.715, 0.19, 0.17, r2=0.035, seg=24, tampa=False)
    m.cil("PLASTICO_AZUL", 0, 0, -0.72, 0.193, 0.02, r2=0.19, seg=24)
    m.cil("BRANCO", 0, 0, -0.72, 0.18, 0.004, seg=24)
    m.esf("EMISSIVO", 0, 0, -0.69, 0.045, seg=12)


def fazer_dirt(m):
    rng = random.Random(21)
    for i in range(7):
        r = rng.uniform(0.05, 0.14)
        m.esf("SUJEIRA", rng.uniform(-0.28, 0.28), rng.uniform(-0.28, 0.28), 0.0025, r, ez=0.015, seg=12)
    for _ in range(14):
        m.esf("SUJEIRA", rng.uniform(-0.3, 0.3), rng.uniform(-0.3, 0.3), 0.002, rng.uniform(0.012, 0.03), ez=0.1, seg=6)


def fazer_mug(m):
    # a caneca de cerâmica de 12 cm com a alça e duas listras azuis
    m.cil("BEGE", 0, 0, 0, 0.046, 0.12, r2=0.05, seg=18)
    m.cil("PLASTICO_AZUL", 0, 0, 0.035, 0.0475, 0.02, r2=0.0485, seg=18)
    m.cil("PLASTICO_AZUL", 0, 0, 0.075, 0.049, 0.02, r2=0.0495, seg=18)
    m.cil("COURO_ESC", 0, 0, 0.112, 0.044, 0.01, seg=18)
    m.tubo("BEGE", (0.05, 0, 0.1), (0.08, 0, 0.085), 0.008, seg=8)
    m.tubo("BEGE", (0.08, 0, 0.085), (0.08, 0, 0.045), 0.008, seg=8)
    m.tubo("BEGE", (0.08, 0, 0.045), (0.048, 0, 0.032), 0.008, seg=8)


def fazer_papers(m):
    rng = random.Random(4)
    for i in range(5):
        z = 0.0015 + i * 0.0018
        m.caixa("PAPEL", rng.uniform(-0.05, 0.05), rng.uniform(-0.05, 0.05), z, 0.21, 0.297, 0.0016, rot=(0, 0, rng.uniform(-20, 20)), bisel=0.0004)
    for k in range(3):
        m.caixa("TINTA", 0.0, -0.04 + k * 0.04, 0.0105, 0.15 - k * 0.03, 0.008, 0.0006, rot=(0, 0, 8), bisel=0.0002)
    m.tubo("TINTA", (0.12, -0.1, 0.013), (0.0, -0.06, 0.013), 0.006, seg=8)


def fazer_candles(m):
    m.cil("LATAO", 0, 0, 0, 0.12, 0.012, r2=0.1, seg=28)
    m.anel("LATAO", 0, 0, 0.012, 0.115, 0.005, seg=28)
    for i, (x, f, h, r) in enumerate(((-0.05, 0.0, 0.25, 0.024), (0.05, -0.03, 0.18, 0.021), (0.0, 0.06, 0.29, 0.027))):
        m.cil("BEGE", x, f, 0.012, r, h)
        m.cil("ESPUMA", x, f, 0.012 + h - 0.006, r * 1.15, 0.012, r2=r * 0.7, seg=14)
        m.cil("PRETO", x, f, 0.012 + h, 0.003, 0.014, seg=6)
        m.esf("CHAMA", x, f, 0.012 + h + 0.03, 0.012, ex=0.8, ef=0.8, ez=1.9, seg=8)


def fazer_jarra_canecas(m):
    m.cil("METAL", -0.05, 0.0, 0.0, 0.055, 0.22, r2=0.062, seg=16)
    m.cil("METAL_ESC", -0.05, 0.0, 0.22, 0.062, 0.016, seg=16)
    m.cil("METAL_ESC", -0.05, 0.0, 0.0, 0.058, 0.02, seg=16)
    m.caixa("METAL_ESC", -0.125, 0.0, 0.07, 0.018, 0.02, 0.14, bisel=0.003)
    m.caixa("METAL_ESC", -0.11, 0.0, 0.2, 0.05, 0.02, 0.018, bisel=0.003)
    for x, f in ((0.09, 0.07), (0.12, -0.07)):
        m.cil("METAL", x, f, 0, 0.034, 0.1, r2=0.038, seg=14)
        m.cil("CERVEJA", x, f, 0.098, 0.03, 0.004, seg=14)
        m.caixa("METAL_ESC", x + 0.047, f, 0.03, 0.014, 0.014, 0.05, bisel=0.002)


def fazer_computer_old(m):
    # o micro com monitor de tubo: tela de vidro abaulada, gabinete afunilado atrás, teclado de teclas separadas
    m.caixa("BEGE", 0, 0.08, 0.04, 0.38, 0.06, 0.32, bisel=0.014)  # a moldura da frente
    m.caixa("BEGE", 0, -0.06, 0.07, 0.3, 0.2, 0.26, bisel=0.02)  # o corpo de tubo
    m.caixa("BEGE", 0, -0.18, 0.1, 0.2, 0.08, 0.2, bisel=0.025)
    m.caixa("PRETO", 0, 0.112, 0.075, 0.31, 0.008, 0.27, bisel=0.006)
    m.caixa("EMISSIVO_AZUL", 0, 0.118, 0.085, 0.28, 0.004, 0.23, bisel=0.002)
    m.caixa("BEGE", 0, 0.0, 0.0, 0.22, 0.2, 0.045, bisel=0.01)  # a base giratória
    m.caixa("PLASTICO_VERM", 0.15, 0.113, 0.062, 0.014, 0.006, 0.007, bisel=0.001)
    m.caixa("BEGE", 0, 0.27, 0.0, 0.42, 0.15, 0.018, rot=(-4, 0, 0), bisel=0.005)
    for r in range(4):
        for c in range(12):
            m.caixa("COURO_ESC", -0.19 + c * 0.0345, 0.225 + r * 0.032, 0.02, 0.026, 0.024, 0.01, rot=(-4, 0, 0), bisel=0.002)
    m.caixa("COURO_ESC", 0, 0.225 + 3.5 * 0.032 + 0.0, 0.018, 0.2, 0.014, 0.008, bisel=0.001)


def fazer_trash_can(m):
    # a lixeira de aço: 0,6 m de altura, 0,38 de boca, aros, tampa de vaivém e uma lata amassada de fora
    m.cil("METAL", 0, 0, 0.0, 0.15, 0.57, r2=0.19, seg=28)
    for z in (0.07, 0.3):
        m.cil("METAL_ESC", 0, 0, z, 0.16 + (z - 0.07) * 0.1, 0.016, seg=28)
    m.cil("METAL_ESC", 0, 0, 0.56, 0.205, 0.03, seg=28)
    m.cil("PRETO", 0, 0, 0.585, 0.17, 0.012, seg=24)
    m.caixa("METAL_ESC", 0.19, 0.0, 0.49, 0.016, 0.08, 0.05, bisel=0.004)
    m.cil("LATA_VERM", 0.1, 0.0, 0.6, 0.033, 0.12, rot=(0, 75, 25), seg=12)


def fazer_crate_wood(m):
    # o engradado de madeira de feira: 0,56 × 0,56 × 0,42 m, ripas com vão, cantoneiras e laranjas amontoadas
    s, h = 0.56, 0.4
    for sx in (-1, 1):
        for sf in (-1, 1):
            m.caixa("MADEIRA_ESC", sx * (s / 2 - 0.025), sf * (s / 2 - 0.025), 0, 0.05, 0.05, h, bisel=0.005)
    for k in range(5):
        z = 0.03 + k * 0.077
        for sx in (-1, 1):
            m.caixa("MADEIRA_CLARA" if k % 2 else "MADEIRA", sx * (s / 2 - 0.008), 0, z, 0.016, s - 0.1, 0.06, bisel=0.003)
        for sf in (-1, 1):
            m.caixa("MADEIRA" if k % 2 else "MADEIRA_CLARA", 0, sf * (s / 2 - 0.008), z, s - 0.1, 0.016, 0.06, bisel=0.003)
    m.caixa("MADEIRA_ESC", 0, 0, 0.0, s - 0.06, s - 0.06, 0.025, bisel=0.003)
    for i in range(14):
        a = i * 2.4
        r = 0.04 + 0.19 * (i % 5) / 4
        m.esf("LARANJA", math.cos(a) * r, math.sin(a) * r, h - 0.01 + (0.045 if i % 3 == 0 else 0.0), 0.04, seg=10)


def fazer_floor_lamp(m):
    # o abajur de pé: base de 0,26 m, haste de latão e cúpula de pano de 0,36 m; 1,65 m de altura
    m.cil("PRETO", 0, 0, 0, 0.13, 0.025, r2=0.11, seg=20)
    m.cil("LATAO", 0, 0, 0.025, 0.012, 1.35, seg=10)
    m.cil("LATAO", 0, 0, 0.8, 0.02, 0.035, seg=10)
    m.cil("ABAJUR", 0, 0, 1.38, 0.18, 0.27, r2=0.13, seg=24, tampa=False)
    m.anel("LATAO", 0, 0, 1.65, 0.131, 0.004, seg=24)
    m.anel("LATAO", 0, 0, 1.38, 0.181, 0.004, seg=24)
    m.esf("EMISSIVO", 0, 0, 1.52, 0.06, seg=12)
    m.cil("EMISSIVO", 0, 0, 1.385, 0.165, 0.004, seg=20)


def fazer_cables_floor(m):
    # três cabos que serpenteiam pelo chão, feitos de pedaços de cilindro
    rng = random.Random(6)
    for k in range(3):
        f0 = -0.18 + k * 0.18
        ph = rng.uniform(0, 6)
        n = 40
        pts = [(-1.05 + i * 2.1 / (n - 1), f0 + 0.07 * math.sin(i * 0.4 + ph)) for i in range(n)]
        for a, b in zip(pts, pts[1:]):
            m.tubo("CABO", (a[0], a[1], 0.005), (b[0], b[1], 0.005), 0.006, seg=6, tampa=False)
    m.caixa("METAL_ESC", -1.07, -0.0, 0.0, 0.06, 0.1, 0.02, bisel=0.004)
    m.caixa("BRANCO", 1.07, 0.0, 0.0, 0.05, 0.08, 0.02, bisel=0.004)


def fazer_puddle(m):
    rng = random.Random(8)
    n = 26
    pts = []
    for i in range(n):
        a = i * 2 * math.pi / n
        r = 0.27 + 0.07 * math.sin(a * 2 + 1) + 0.04 * math.sin(a * 3 + 2) + rng.uniform(-0.01, 0.01)
        pts.append((math.cos(a) * r * 1.1, math.sin(a) * r * 0.85))
    m.prisma("POCA", pts, 0.0015, 0.005)


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


# ------------------------------------------------------------------ exportar e fotografar
def limpar_cena():
    for o in list(bpy.data.objects):
        bpy.data.objects.remove(o, do_unlink=True)
    for me in list(bpy.data.meshes):
        bpy.data.meshes.remove(me)
    for cv in list(bpy.data.curves):
        bpy.data.curves.remove(cv)


def exportar(ob, caminho):
    bpy.ops.object.select_all(action="DESELECT")
    ob.select_set(True)
    bpy.context.view_layer.objects.active = ob
    bpy.ops.export_scene.gltf(filepath=caminho, export_format="GLB", use_selection=True, export_apply=True, export_yup=True, export_materials="EXPORT", export_cameras=False, export_lights=False, export_vertex_color="MATERIAL", export_image_format="AUTO")


def cena_de_previa():
    sc = bpy.context.scene
    for nome in ("BLENDER_EEVEE", "BLENDER_EEVEE_NEXT"):
        try:
            sc.render.engine = nome
            break
        except Exception:
            continue
    sc.render.resolution_x = sc.render.resolution_y = 480
    sc.render.film_transparent = False
    sc.render.image_settings.file_format = "PNG"
    try:
        sc.eevee.taa_render_samples = 24
    except Exception:
        pass
    w = bpy.data.worlds.new("mundo")
    w.use_nodes = True
    nt = w.node_tree
    nt.nodes.clear()
    saida = nt.nodes.new("ShaderNodeOutputWorld")
    mix = nt.nodes.new("ShaderNodeMixShader")
    lp = nt.nodes.new("ShaderNodeLightPath")
    fundo = nt.nodes.new("ShaderNodeBackground")  # o que a câmera vê: cinza-escuro
    fundo.inputs[0].default_value = (0.045, 0.047, 0.055, 1)
    ambiente = nt.nodes.new("ShaderNodeBackground")  # o que ilumina e reflete: um céu de estúdio
    ambiente.inputs[0].default_value = (0.3, 0.34, 0.5, 1)
    ambiente.inputs[1].default_value = 0.8
    nt.links.new(lp.outputs["Is Camera Ray"], mix.inputs[0])
    nt.links.new(ambiente.outputs[0], mix.inputs[1])
    nt.links.new(fundo.outputs[0], mix.inputs[2])
    nt.links.new(mix.outputs[0], saida.inputs[0])
    sc.world = w
    for vt in ("AgX", "Filmic", "Standard"):
        try:
            sc.view_settings.view_transform = vt
            break
        except Exception:
            continue


def fotografar(ob, nome, caminho):
    sc = bpy.context.scene
    elevar = 1.5 if nome == "ceiling_lamp" else 0.0  # a lâmpada pende do teto: na prévia, a 1,5 m do chão
    ob.location.z += elevar
    bpy.context.view_layer.update()
    corners = [ob.matrix_world @ Vector(c) for c in ob.bound_box]
    mn = Vector((min(c.x for c in corners), min(c.y for c in corners), min(c.z for c in corners)))
    mx = Vector((max(c.x for c in corners), max(c.y for c in corners), max(c.z for c in corners)))
    cen = (mn + mx) / 2
    raio = max((mx - mn).length / 2, 0.12)
    ajudas = []

    def novo(o):
        ajudas.append(o)
        return o

    # o chão da prévia (não vai para o .glb); a escada para baixo ganha um chão com o buraco
    ch = None
    if ob.name == "stairs_down":
        for px, py, sx, sy in ((-3.375, 0, 6, 12), (3.375, 0, 6, 12), (0, -3.375, 0.75, 6), (0, 3.375, 0.75, 6)):
            bpy.ops.mesh.primitive_plane_add(size=1, location=(px, py, 0))
            pl = novo(bpy.context.active_object)
            pl.scale = (sx, sy, 1)
    else:
        bpy.ops.mesh.primitive_plane_add(size=12, location=(cen.x, cen.y, 0))
        ch = novo(bpy.context.active_object)
    mc = bpy.data.materials.new("chao")
    mc.use_nodes = True
    mc.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = (0.12, 0.11, 0.1, 1)
    mc.node_tree.nodes["Principled BSDF"].inputs["Roughness"].default_value = 0.85
    for o in ajudas:
        if o.type == "MESH":
            o.data.materials.append(mc)
    # a câmera do sprite isométrico do tabuleiro: ortográfica, 45 graus de lado e 30 de altura, a frente para baixo à esquerda
    az, el = math.radians(45), math.radians(30)
    dist = raio * 6
    pos = cen + Vector((math.sin(az) * math.cos(el), -math.cos(az) * math.cos(el), math.sin(el))) * dist
    cd = bpy.data.cameras.new("cam")
    cd.type = "ORTHO"
    cd.ortho_scale = raio * 2.5
    cam = novo(bpy.data.objects.new("cam", cd))
    sc.collection.objects.link(cam)
    cam.location = pos
    cam.rotation_euler = (cen - pos).to_track_quat("-Z", "Y").to_euler()
    sc.camera = cam
    # a luz do bar: uma lâmpada quente (pontual, com sombra) em cima e à esquerda, e um ar frio fraquinho da janela
    sol = bpy.data.lights.new("sol", "POINT")
    sol.energy = 260 * (raio * 2) ** 2 + 40
    sol.color = (1.0, 0.72, 0.42)
    sol.shadow_soft_size = max(0.08, raio * 0.12)
    so = novo(bpy.data.objects.new("sol", sol))
    sc.collection.objects.link(so)
    so.location = cen + Vector((-raio * 2.2, -raio * 1.6, raio * 3.4))
    fil = bpy.data.lights.new("fil", "AREA")
    fil.energy = 10 * (raio * 2) ** 2
    fil.color = (0.5, 0.62, 1.0)
    fil.size = raio * 4
    fo = novo(bpy.data.objects.new("fil", fil))
    sc.collection.objects.link(fo)
    fo.location = cen + Vector((raio * 3, raio * 2, raio * 1.6))
    fo.rotation_euler = (cen - fo.location).to_track_quat("-Z", "Y").to_euler()
    # o rótulo, virado para a câmera, embaixo
    tc = bpy.data.curves.new("rot", "FONT")
    tc.body = nome
    tc.size = max(raio * 0.2, 0.05)
    tc.align_x = "CENTER"
    to = novo(bpy.data.objects.new("rot", tc))
    sc.collection.objects.link(to)
    tpos = Vector((cen.x, mn.y - raio * 0.55, 0.0))
    to.location = tpos
    to.rotation_euler = (pos - tpos).to_track_quat("Z", "Y").to_euler()
    tm = bpy.data.materials.new("rotm")
    tm.use_nodes = True
    tm.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = (1, 1, 1, 1)
    tm.node_tree.nodes["Principled BSDF"].inputs["Emission Color"].default_value = (1, 0.93, 0.78, 1)
    tm.node_tree.nodes["Principled BSDF"].inputs["Emission Strength"].default_value = 1.4
    to.data.materials.append(tm)
    sc.render.filepath = caminho
    bpy.ops.render.render(write_still=True)
    for o in ajudas:
        bpy.data.objects.remove(o, do_unlink=True)
    ob.location.z -= elevar


def medidas(ob):
    c = [Vector(v) for v in ob.bound_box]
    x = [v.x for v in c]
    y = [v.y for v in c]
    z = [v.z for v in c]
    return (round(max(x) - min(x), 3), round(max(z) - min(z), 3), round(max(y) - min(y), 3), round(min(z), 3))


def main():
    os.makedirs(SAIDA, exist_ok=True)
    os.makedirs(PREVIAS, exist_ok=True)
    cena_de_previa() if PREVIA else None
    nomes = [n for n in MODELOS if not SO or n in SO]
    relatorio = []
    for i, nome in enumerate(nomes):
        limpar_cena()
        m = Modelo(nome)
        MODELOS[nome](m)
        ob = m.objeto()
        exportar(ob, os.path.join(SAIDA, nome + ".glb"))
        relatorio.append((nome, medidas(ob)))
        if PREVIA:
            fotografar(ob, nome, os.path.join(PREVIAS, f"{i + 1:02d}.png" if not SO else f"so_{nome}.png"))
    print("RELATORIO (largura x altura x fundo, base em z):")
    for nome, md in relatorio:
        print(f"  {nome}: {md[0]} x {md[1]} x {md[2]} (base {md[3]})")
    if PREVIA and not SO:
        # a folha: em cada par, o sprite isométrico do jogo (giro 4) à esquerda e o modelo 3D à direita
        try:
            args, fl, lay = [], "", ""
            k = 0
            for i, nome in enumerate(nomes):
                spr = os.path.join(RAIZ, "client", "public", "arte", "mobiliario", nome, "giro-4.png")
                if not os.path.exists(spr):
                    spr = os.path.join(RAIZ, "client", "public", "arte", "mobiliario", nome, "giro-0.png")
                args += ["-i", spr, "-i", os.path.join(PREVIAS, f"{i + 1:02d}.png")]
                fl += f"[{2 * i}:v]scale=240:240:force_original_aspect_ratio=decrease:flags=neighbor,pad=240:240:(ow-iw)/2:(oh-ih)/2:color=0x46464c[s{i}];"
                fl += f"[{2 * i + 1}:v]scale=240:240[m{i}];"
                lay += f"{(i % 3) * 480}_{(i // 3) * 240}|{(i % 3) * 480 + 240}_{(i // 3) * 240}|"
                k += 2
            ins = "".join(f"[s{i}][m{i}]" for i in range(len(nomes)))
            fl += f"{ins}xstack=inputs={k}:layout={lay.rstrip('|')}"
            subprocess.run(["ffmpeg", "-y", "-v", "error", *args, "-filter_complex", fl, os.path.join(PRINTS, "moveis.png")], check=True)
            print("folha:", os.path.join(PRINTS, "moveis.png"))
        except Exception as e:  # noqa: BLE001
            print("sem ffmpeg para a folha:", e)


main()
