"""Recorte bem perto da boca da lareira. uso: python3 boca.py entrada.png saida.png"""
import sys
from PIL import Image
im = Image.open(sys.argv[1])
x0, y0, x1, y1 = 244, 158, 292, 222
z = 12
im.crop((x0 * 3, y0 * 3, x1 * 3, y1 * 3)).resize(((x1 - x0) * z, (y1 - y0) * z), Image.NEAREST).save(sys.argv[2])
