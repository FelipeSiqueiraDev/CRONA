import os, sys
saida = sys.argv[1]
sys.argv=['x','/dev/null']
exec(open('sala_janela.py').read().split("if __name__ == '__main__':")[0])
ks = [0, 2, 4, 6, 8, 10, 12, 14]
ims = []
for k in ks:
    im = quadro(k / 16)
    ims.append(Image.fromarray(im[95:185, 35:105]).resize((70*5, 90*5), Image.NEAREST))
W = sum(i.width for i in ims) + 6 * len(ims)
fol = Image.new('RGB', (W, ims[0].height), (40, 40, 40))
x = 0
for i in ims:
    fol.paste(i, (x, 0)); x += i.width + 6
fol.save(saida)
a, b = quadro(0.25), quadro(0.75)
print('diff q4 q12', (a != b).any(-1).sum())
