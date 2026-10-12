"""Recortes ampliados (NEAREST) das peças. Uso: python3 recorte.py sala.png prefixo  (sala.png é a imagem 3x)."""
import sys
from PIL import Image
im = Image.open(sys.argv[1])
pre = sys.argv[2]
k = 3  # a imagem vem ampliada 3x
# caixas em pixels da arte (1x): x0, y0, x1, y1
R = {
    'estbaixa': (30, 160, 110, 252),
    'estante': (182, 80, 245, 182),
    'mesa': (152, 200, 248, 290),
    'mesinha': (100, 190, 158, 245),
    'barril': (45, 210, 102, 252),
}
sel = sys.argv[3:] or list(R)
for nome in sel:
    x0, y0, x1, y1 = R[nome]
    cr = im.crop((x0 * k, y0 * k, x1 * k, y1 * k)).resize(((x1 - x0) * 6, (y1 - y0) * 6), Image.NEAREST)
    cr.save(f'{pre}_{nome}.png')
print('ok')
