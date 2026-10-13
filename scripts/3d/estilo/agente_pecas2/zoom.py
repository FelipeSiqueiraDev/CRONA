"""zoom.py img.png saida.png x0 y0 x1 y1 [k]: recorte (pixels da arte) da imagem 3x, ampliado k vezes."""
import sys
from PIL import Image
im = Image.open(sys.argv[1]); x0, y0, x1, y1 = map(int, sys.argv[3:7]); k = int(sys.argv[7]) if len(sys.argv) > 7 else 12
im.crop((x0 * 3, y0 * 3, x1 * 3, y1 * 3)).resize(((x1 - x0) * k, (y1 - y0) * k), Image.NEAREST).save(sys.argv[2])
