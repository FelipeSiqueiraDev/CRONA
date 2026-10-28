"""A arte original e o sprite lado a lado, na mesma grade de blocos, para desenhar o retoque (28/10). Uso: grade_rosto.py <dir> <saida.png>"""
import sys
import numpy as np
from PIL import Image, ImageDraw
import px2
D = r'C:\Users\felip\AppData\Local\Temp\claude\C--Users-felip-OneDrive--rea-de-Trabalho-Dhellow-MEUS-PROJETOS-CRONA\5f376f34-94c3-473c-9804-406d6d6ea3b3\scratchpad\px2'
k = sys.argv[1]
x0, y0, x1, y1 = (int(v) for v in sys.argv[3:7])
a = px2.abrir(r'F:/Dhellow/CRONA/projeto/client/public/arte/personagens/agata/tabuleiro-32bits/idle-desarmado-%s.png' % k, 5)
sp = Image.open(D + '/%s.png' % k).convert('RGBA')
Z = 20; B = 5
art = Image.fromarray(a).crop((x0 * B, y0 * B, x1 * B, y1 * B)).resize(((x1 - x0) * Z, (y1 - y0) * Z), Image.LANCZOS).convert('RGBA')
spr = sp.crop((x0, y0, x1, y1)).resize(((x1 - x0) * Z, (y1 - y0) * Z), Image.NEAREST)
W = art.width * 2 + 40
c = Image.new('RGBA', (W + 20, art.height + 30), (70, 72, 76, 255))
for ox, im in ((30, art), (50 + art.width, spr)):
    c.alpha_composite(im, (ox, 30)); d = ImageDraw.Draw(c)
    for i in range(x1 - x0 + 1):
        d.line([(ox + i * Z, 30), (ox + i * Z, 30 + art.height)], fill=(255, 255, 255, 60))
        d.text((ox + i * Z + 2, 14), str(i + x0), fill=(255, 255, 0, 255))
    for j in range(y1 - y0 + 1):
        d.line([(ox, 30 + j * Z), (ox + art.width, 30 + j * Z)], fill=(255, 255, 255, 60))
    if ox == 30:
        for j in range(y1 - y0):
            d.text((2, 30 + j * Z + 3), str(j + y0), fill=(255, 255, 0, 255))
c.save(sys.argv[2])
