import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pal import desenhar, ampliar
from PIL import Image
nome = sys.argv[1]
img = desenhar(open(nome).read())
a = ampliar(img, 12)
ref = Image.open('/tmp/claude-0/-home-user-CRONA/65db675f-ba05-5f24-a910-ad8d18d74f3d/scratchpad/ref/padre12.png')
m = Image.new('RGB', (a.width + ref.width + 20, max(a.height, ref.height)), (205, 200, 190))
m.paste(a, (0, 0)); m.paste(ref, (a.width + 20, 0))
m.save(nome.replace('.txt', '.png'))
