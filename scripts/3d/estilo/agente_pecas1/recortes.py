"""Recorta cada peça da imagem 1x (achada pela caixa no mundo) e amplia (NEAREST)."""
import os, sys
os.environ['ESC'] = '0.75'
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'codigo'))
import numpy as np
from PIL import Image
from motor import tela
SALA, ALTO = 5.25, 2.85
cantos = np.array([[x, y, z] for x in (-0.5, SALA + 0.3) for y in (-0.5, SALA + 0.3) for z in (-0.35, ALTO + 0.5)])
S = tela(cantos)
x0, y0 = int(S[:, 0].min()) - 4, int(S[:, 1].min()) - 4
PECAS = {
    'sofa': (0.0, 0.95, 0.55, 2.15, 0, 0.95),
    'piano': (3.9, 5.1, 0.0, 0.66, 0, 1.5),
    'relogio': (4.38, 4.98, 0.0, 0.14, 0.9, 1.5),
    'quadro': (0.0, 0.1, 0.95, 1.67, 1.35, 2.25),
    'porta': (0.0, 0.16, 2.1, 3.35, 0, 2.25),
}
img = Image.open(sys.argv[1])
pref = sys.argv[2] if len(sys.argv) > 2 else 'r'
Z = int(sys.argv[3]) if len(sys.argv) > 3 else 8
for nome, (a0, a1, b0, b1, c0, c1) in PECAS.items():
    P = np.array([[x, y, z] for x in (a0, a1) for y in (b0, b1) for z in (c0, c1)])
    T = tela(P)
    bx = (int(T[:, 0].min() - x0) - 3, int(T[:, 1].min() - y0) - 3, int(T[:, 0].max() - x0) + 4, int(T[:, 1].max() - y0) + 4)
    cr = img.crop(bx)
    cr.resize((cr.width * Z, cr.height * Z), Image.NEAREST).save(f'{pref}_{nome}.png')
    print(nome, bx)
