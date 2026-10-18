"""A cela do Geraldo, v3: ele atrás da grade (a grade do fundo vira a camada da frente), as mãos agarrando as barras."""
import sys
import numpy as np
from PIL import Image, ImageFilter

ARTE = 'F:/Dhellow/CRONA/projeto/client/public/arte'
OUT = ARTE + '/cena-cela'
PREV = sys.argv[1]
K = 2  # as camadas vão em 3840 x 2160: a câmera chega perto sem borrar
W, H = 1920 * K, 1080 * K

fundo = Image.open(OUT + '/cela-fundo.jpg').convert('RGB')
fundo2 = fundo.resize((W, H), Image.LANCZOS)
L = np.asarray(fundo2.convert('L')).astype(float)

# ---------------------------------------------------------------- a grade da frente
VERT = [(527, 557), (682, 712), (838, 867), (988, 1016), (1139, 1167), (1286, 1313), (1431, 1458)]
HORI = [(199, 222), (714, 738)]
mask = np.zeros((H, W))
X0, X1, Y0, Y1 = 465 * K, 1490 * K, 22 * K, 930 * K
for a, b in VERT:
    lo, hi = (a - 12) * K, (b + 12) * K
    for y in range(Y0, Y1):
        p = L[y, lo:hi]
        esc = np.percentile(L[y, lo - 30 * K:lo], 50)
        lim = esc + 0.3 * (p.max() - esc)
        xs = np.where(p > lim)[0]
        if len(xs) > 4:
            mask[y, lo + xs.min():lo + xs.max() + 1] = 1
for a, b in HORI:
    lo, hi = (a - 10) * K, (b + 10) * K
    for x in range(X0, X1):
        p = L[lo:hi, x]
        esc = np.percentile(L[hi:hi + 30 * K, x], 50)
        lim = esc + 0.3 * (p.max() - esc)
        ys = np.where(p > lim)[0]
        if len(ys) > 4:
            mask[lo + ys.min():lo + ys.max() + 1, x] = 1
m = Image.fromarray((mask * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(3)).filter(ImageFilter.GaussianBlur(1.2))
ga = np.asarray(fundo2).copy()
ga[np.asarray(m) == 0] = 0
grade = Image.fromarray(ga).convert('RGBA')
grade.putalpha(m)
grade.save(OUT + '/cela-grade-frente.png', optimize=True)
gm = np.asarray(m).astype(float) / 255

# ---------------------------------------------------------------- o Geraldo
ret = Image.open(ARTE + '/personagens/geraldo-ribeiro/retrato-desarmado.png').convert('RGBA')
OLHO_RET = (620, 265)       # entre os olhos, no retrato
OLHO = (935, 322)           # entre os olhos, na cena (entre as barras do meio, a de cima cruzando o cabelo)
S = 0.88                    # rosto de ~195 px de largura na cena
s = S * K
r2 = ret.resize((round(ret.width * s), round(ret.height * s)), Image.LANCZOS)
ger = Image.new('RGBA', (W, H))
ger.alpha_composite(r2, (round(OLHO[0] * K - OLHO_RET[0] * s), round(OLHO[1] * K - OLHO_RET[1] * s)))
g = np.asarray(ger).astype(float)
rgb, al = g[..., :3], g[..., 3]
yy, xx = np.mgrid[0:H, 0:W].astype(float) / K
# a cor da cadeia: menos saturada, fria e escura
lum = rgb @ [0.299, 0.587, 0.114]
rgb = rgb * 0.55 + lum[..., None] * 0.45
rgb *= [0.88, 0.92, 1.0]
rgb = (rgb - 110) * 1.12 + 110
# a luz: a lâmpada do corredor fica no alto à esquerda; o lado de lá do rosto cai no escuro
luz = np.clip(1.12 - (xx - 860) / 300, 0.5, 1.12) * np.clip(1.15 - (yy - 320) / 420, 0.3, 1.0)
# a sombra das barras no rosto (a luz vem da esquerda: a sombra cai um tiquinho à direita de cada barra)
somb = np.zeros((H, W))
for a, b in VERT:
    somb = np.maximum(somb, ((xx >= a + 10) & (xx <= b + 16)).astype(float))
for a, b in HORI:
    somb = np.maximum(somb, ((yy >= a + 8) & (yy <= b + 12)).astype(float))
somb = np.asarray(Image.fromarray((somb * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(7 * K))).astype(float) / 255
rgb *= (luz * (1 - 0.45 * somb) * 0.93)[..., None]
# o corpo some no escuro: o rosto inteiro, os ombros se desfazendo
fade_v = np.clip(1 - (yy - 470) / 190, 0, 1)
dx, dy = (xx - 927) / 250, (yy - 360) / 300
fade_r = np.clip(1.6 - np.sqrt(dx * dx + dy * dy) * 1.25, 0, 1)
al = al * np.minimum(fade_v, fade_r) ** 1.3
# o grão da foto
rng = np.random.default_rng(7)
rgb += rng.normal(0, 4.5, rgb.shape)
rgb[al < 1] = 0
out = np.dstack([np.clip(rgb, 0, 255), al]).astype(np.uint8)
ger = Image.fromarray(out, 'RGBA')
ger.save(OUT + '/cela-geraldo-v3.png', optimize=True)

# ---------------------------------------------------------------- as mãos
mao = Image.open(OUT + '/cela-mao-grade.png').convert('RGBA')
mao = mao.crop(mao.getbbox())
ma = np.asarray(mao).astype(float)
# o pedaço de barra que a mão trouxe desenhado, fora do punho: sai (fica a barra de verdade)
ma[:60, 100:, 3] = 0
ma[147:, 103:, 3] = 0
ma[..., :3] *= [0.88, 0.9, 0.97]
mao = Image.fromarray(ma.astype(np.uint8), 'RGBA')
BARRA_MAO = 124.5           # o meio da barra, na mão
# uma mão só (18/10, o Felipe: "foca em um braço só, do jeito certo, no tamanho certo"): a direita dele, na barra à
# esquerda do rosto, com o braço descendo para o lado do ombro direito (a mão da arte vem de baixo e da esquerda)
SM = 1.75 * K


def mao_na(barra_x, topo_y, nome, luz=1.0):
    im = mao.resize((round(mao.width * SM), round(mao.height * SM)), Image.LANCZOS).filter(ImageFilter.UnsharpMask(3, 60, 2))
    if luz != 1.0:
        a = np.asarray(im).astype(float)
        a[..., :3] *= luz
        im = Image.fromarray(a.astype(np.uint8), 'RGBA')
    c = Image.new('RGBA', (W, H))
    c.alpha_composite(im, (round(barra_x * K - BARRA_MAO * SM), round(topo_y * K)))
    c.save(OUT + f'/{nome}.png', optimize=True)
    return c


mE = mao_na((682 + 712) / 2, 368, 'cela-mao-v4', 0.95)

# ---------------------------------------------------------------- as prévias
def previa(camadas, nome, foco=None):
    c = fundo2.convert('RGBA')
    for k in camadas:
        c.alpha_composite(k)
    if foco:
        x, y, z = foco
        w, h = W / z, H / z
        c = c.crop((round(x * K - w / 2), round(y * K - h / 2), round(x * K + w / 2), round(y * K + h / 2)))
    c.convert('RGB').resize((1280, 720), Image.LANCZOS).save(PREV + '/' + nome + '.jpg', quality=90)


previa([ger, grade], 'v3_a_inteira')
previa([ger, grade, mE], 'v4_b_mao')
previa([ger, grade, mE], 'v4_c_perto', (900, 400, 1.7))
