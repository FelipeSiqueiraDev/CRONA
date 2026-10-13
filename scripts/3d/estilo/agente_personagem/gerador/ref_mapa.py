"""As referências para o gerador: um pedaço da cozinha 1:1 ampliado 4x (o pixel do mapa), com e sem o boneco de 93 px."""
import os, sys
AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(AQUI, '..', '..', 'agente_cozinha'))
sys.path.insert(0, os.path.join(AQUI, '..', '..', '..', 'codigo'))
os.environ['NOITE'] = '0'
import numpy as np
from PIL import Image
import cozinha
from motor import tela, VISTA, KZ

D = sys.argv[1]
img = np.array(cozinha.montar(0.0, 1.0)).astype(float)
c = cozinha.c
limpo = img.copy()
spr = np.asarray(Image.open(os.path.join(AQUI, 'alosi_gerador_v3_d_2.png')).convert('RGBA')).astype(float)
x, y = 8.5 * 0.75, 3.5 * 0.75
sx, sy = tela(np.array([x, y, 0.0]))
px, py = int(round(sx - c.x0)), int(round(sy - c.y0))
h, w = spr.shape[:2]
x0, y0 = px - w // 2, py - h + 2
z = (py - (y0 + np.arange(h))) / KZ
dprof = (np.array([x, y, 0.0]) @ VISTA) + z * VISTA[2] + 0.12
fr = dprof[:, None] >= c.prof[y0:y0 + h, x0:x0 + w] - 0.01
a = spr[..., 3:4] / 255 * fr[..., None]
img[y0:y0 + h, x0:x0 + w] = img[y0:y0 + h, x0:x0 + w] * (1 - a) + spr[..., :3] * a
# o recorte: a mesa, as cadeiras, o balcão e o boneco
cx0, cy0, cw, ch = px - 150, py - 160, 260, 200
for nome, im in (('5-mapa-com-tamanho-certo.png', img), ('6-mapa-estilo.png', limpo)):
    r = Image.fromarray(np.clip(im, 0, 255).astype(np.uint8)).crop((cx0, cy0, cx0 + cw, cy0 + ch))
    r.resize((cw * 4, ch * 4), Image.NEAREST).save(os.path.join(D, nome))
print('ok')
