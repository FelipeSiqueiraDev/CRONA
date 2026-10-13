"""Remonta o GIF dos quadros já gerados com uma paleta só (fica leve)."""
import os
from PIL import Image
E = os.path.dirname(os.path.abspath(__file__))
imgs = []
for i in range(72):
    im = Image.open(f'{E}/gif/q{i:03d}.png').convert('RGB')
    imgs.append(im.resize((im.width // 3, im.height // 3), Image.NEAREST))
w, h = imgs[0].size
mont = Image.new('RGB', (w * 4, h))
for k, i in enumerate((0, 30, 45, 60)):
    mont.paste(imgs[i], (k * w, 0))
pal = mont.quantize(colors=255, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
fr = [im.quantize(palette=pal, dither=Image.Dither.NONE).resize((w * 2, h * 2), Image.NEAREST) for im in imgs]
fr[0].save(f'{E}/sala_viva.gif', save_all=True, append_images=fr[1:], duration=110, loop=0, optimize=True, disposal=1)
print(os.path.getsize(f'{E}/sala_viva.gif') // 1024, 'KB', fr[0].size)
