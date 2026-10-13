import sys
from PIL import Image
# recorte da lareira na imagem 3x: caixa em px da arte
src, out = sys.argv[1], sys.argv[2]
x0, y0, x1, y1 = [int(v) for v in (sys.argv[3:7] if len(sys.argv) > 6 else (150, 20, 290, 200))]
z = int(sys.argv[7]) if len(sys.argv) > 7 else 5
im = Image.open(src)
im = im.resize((im.width // 3, im.height // 3), Image.NEAREST)
im.crop((x0, y0, x1, y1)).resize(((x1 - x0) * z, (y1 - y0) * z), Image.NEAREST).save(out)
