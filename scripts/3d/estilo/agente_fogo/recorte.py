"""Recorte ampliado da lareira (NEAREST). uso: python3 recorte.py entrada.png saida.png [zoom]"""
import sys
from PIL import Image
im = Image.open(sys.argv[1])
k = 3  # a imagem da sala já vem 3x
x0, y0, x1, y1 = 222, 120, 318, 248
z = int(sys.argv[3]) if len(sys.argv) > 3 else 7
cr = im.crop((x0 * k, y0 * k, x1 * k, y1 * k)).resize(((x1 - x0) * z, (y1 - y0) * z), Image.NEAREST)
cr.save(sys.argv[2])
