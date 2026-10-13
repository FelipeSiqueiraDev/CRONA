"""Teste: a cena por código passada para pixel art limpa (pixel 2x, paleta curta, contorno de 1 px, sem ruído)."""
import os, sys
os.environ['ESC'] = os.environ.get('ESC', '2')
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'codigo'))
import numpy as np
from PIL import Image, ImageFilter
import motor
import cozinha_teste as CZ

PX = int(os.environ.get('PX', '2'))      # pixels do tabuleiro por pixel da arte
CORES = int(os.environ.get('CORES', '40'))
guarda = {}
orig_img = motor.Cena.imagem
def img_spy(self, *a, **k):
    guarda['c'] = self
    return orig_img(self, *a, **k)
motor.Cena.imagem = img_spy
motor.Cena.contorno = lambda self, *a, **k: None   # o contorno vai depois, no tamanho do pixel da arte
if os.environ.get('SEMAR'):
    motor.Cena.feixe_no_ar = lambda self, *a, **k: None
    motor.Cena.particulas = lambda self, *a, **k: None

img = np.asarray(CZ.quadro(0.0)).astype(float)
c = guarda['c']
F = int(round(motor.ESC * PX))
h, w = img.shape[0] // F, img.shape[1] // F
img = img[:h * F, :w * F]
# a cor: a média do bloco (o pixel da arte)
cor = img.reshape(h, F, w, F, 3).mean((1, 3))
# o objeto e a profundidade: o do meio do bloco
obj = c.obj[F // 2:h * F:F, F // 2:w * F:F][:h, :w]
prof = c.prof[F // 2:h * F:F, F // 2:w * F:F][:h, :w]
tipo = c.tipo[F // 2:h * F:F, F // 2:w * F:F][:h, :w]
face = c.face[F // 2:h * F:F, F // 2:w * F:F][:h, :w]
nrm = c.nrm[F // 2:h * F:F, F // 2:w * F:F][:h, :w]
# as faces mais separadas (o topo claro, um lado médio, o outro escuro), como no pixel art desenhado
k = np.ones((h, w))
k = np.where(nrm[..., 2] > 0.7, 1.08, k)
k = np.where((np.abs(nrm[..., 2]) < 0.3) & (nrm[..., 0] > 0.5), 0.84, k)
cor = cor * np.where((tipo == 3)[..., None], k[..., None], 1.0)

# luz: mais clara e quente, saturada de leve (o estilo aconchegante)
lum = cor.mean(-1, keepdims=True)
cor = lum + (cor - lum) * 1.18
x = np.clip(cor, 0, 255) / 255
x = x ** 0.9
x = x + 0.12 * (x - 0.5) * (1 - np.abs(2 * x - 1))  # um S de contraste
cor = 255 * x
cor = cor * np.array([1.03, 1.0, 0.94])
cor = np.clip(cor, 0, 255)

# paleta curta, sem pontilhado
q = Image.fromarray(cor.astype(np.uint8)).quantize(colors=CORES, method=Image.Quantize.MEDIANCUT, kmeans=4, dither=Image.Dither.NONE)
# limpa o ruído: o pixel solto vira a cor da maioria em volta (só dentro do mesmo objeto)
idx = np.asarray(q).copy()
moda = np.asarray(q.filter(ImageFilter.ModeFilter(3)))
iguais = np.zeros_like(idx, dtype=int)
for dy in (-1, 0, 1):
    for dx in (-1, 0, 1):
        if dy or dx:
            iguais += (np.roll(np.roll(idx, dy, 0), dx, 1) == idx)
mesmo = np.ones_like(idx, bool)
for dy, dx in ((0, 1), (1, 0), (0, -1), (-1, 0)):
    mesmo &= np.roll(np.roll(obj, dy, 0), dx, 1) == obj
idx = np.where((iguais <= int(os.environ.get('LIMPA', '2'))) & mesmo, moda, idx)
pal = np.array(q.getpalette()[:CORES * 3]).reshape(-1, 3).astype(float)
out = pal[idx]

# contorno de 1 px da arte: na borda de cada objeto, do lado de quem está na frente
borda = np.zeros((h, w), bool)
for dy, dx in ((0, 1), (1, 0), (0, -1), (-1, 0)):
    On = np.roll(np.roll(obj, -dy, 0), -dx, 1)
    Pn = np.roll(np.roll(prof, -dy, 0), -dx, 1)
    borda |= (obj >= 0) & (On != obj) & ((Pn < prof - 0.05) | (On < 0))
borda &= tipo >= 2
# a quina de dentro (a mesma peça, outra face): um traço mais leve
quina = np.zeros((h, w), bool)
for dy, dx in ((0, 1), (1, 0)):
    On = np.roll(np.roll(obj, -dy, 0), -dx, 1)
    Fn = np.roll(np.roll(face, -dy, 0), -dx, 1)
    Nn = np.roll(np.roll(nrm, -dy, 0), -dx, 1)
    quina |= (obj >= 0) & (On == obj) & (Fn != face) & ((Nn * nrm).sum(-1) < 0.6)
quina &= (tipo == 3) & ~borda
escuro = out * 0.3 + np.array([24, 13, 6])
out = np.where(quina[..., None], out * 0.78, out)
out = np.where(borda[..., None], escuro, out)
out = np.where((obj >= 0)[..., None], out, np.array([214, 214, 210]))
res = Image.fromarray(np.clip(out, 0, 255).astype(np.uint8))
nome = sys.argv[1]
res.resize((w * PX * 2, h * PX * 2), Image.NEAREST).save(nome)
print('ok', w, h, len(np.unique(idx)))
