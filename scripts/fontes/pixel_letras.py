"""
Pixel Letras: o "c" da Pixelify Sans com a boca aberta (14/10): a fonte desenha o c/C como um o/O com um dente de menos de 1 pixel do
grid à direita, que some no tamanho da interface ("Orime", "FIOHA"). Aqui as pontas da direita (os dois tocos) ficam
mais curtas, a boca cresce, e o resto do desenho e a largura ficam iguais. Sai só c, C, ç, Ç e o H (a barra reta, sem o dente do meio que o fazia parecer um W), em 4 pesos, servidos
como a família 'Pixel Letras' na frente da Pixelify (client/src/ui/tema.css). Feita com 0.5 0.5.
A Pixelify variável vem de github.com/google/fonts (ofl/pixelifysans/PixelifySans[wght].ttf); licença OFL em
client/public/fontes/OFL-pixelify-sans.txt.

Uso: python scripts/fontes/pixel_letras.py <PixelifySans[wght].ttf> <pasta de saída> <fração do toco minúsculo> <fração do toco maiúsculo> [prefixo]
     fração 1 = o original, 0.5 = metade, 0 = sem toco
"""
import os
import sys

from fontTools import subset
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer

SRC, OUT, F_MIN, F_MAI = sys.argv[1], sys.argv[2], float(sys.argv[3]), float(sys.argv[4])
PREFIXO = sys.argv[5] if len(sys.argv) > 5 else 'pixel-letras'
os.makedirs(OUT, exist_ok=True)
PESOS = (400, 500, 600, 700)
LETRAS = {'c': F_MIN, 'C': F_MAI}


def abrir_boca(glyf, nome, fracao):
    """Encurta os dois tocos da direita do c/C (as pontas que fecham a boca)."""
    g = glyf[nome]
    coords = g.coordinates
    ends = g.endPtsOfContours
    # o contorno do c é o primeiro (o da cedilha, no ç, vem depois)
    fim = ends[0] + 1
    pts = [tuple(coords[i]) for i in range(fim)]
    xmax = max(x for x, _ in pts)
    # na borda de fora da direita: [base, topo do toco de baixo, pé do toco de cima, topo]
    ys_dir = sorted({y for x, y in pts if x == xmax})
    assert len(ys_dir) == 4, (nome, ys_dir)
    _, toco_baixo, toco_cima, _ = ys_dir
    # o buraco de dentro: o y de baixo e o de cima
    xs = sorted({x for x, _ in pts})
    x_dentro = xs[-2]
    ys_dentro = sorted({y for x, y in pts if x == x_dentro})
    furo_baixo, furo_cima = ys_dentro[1], ys_dentro[-2]
    novo_baixo = round(furo_baixo + fracao * (toco_baixo - furo_baixo))
    novo_cima = round(furo_cima - fracao * (furo_cima - toco_cima))
    for i in range(fim):
        x, y = coords[i]
        if y == toco_baixo:
            coords[i] = (x, novo_baixo)
        elif y == toco_cima:
            coords[i] = (x, novo_cima)
    return (toco_baixo, toco_cima, '->', novo_baixo, novo_cima)


def achatar_h(glyf, nome):
    """O H da Pixelify tem um dente de 1 pixel subindo no meio da barra: com as duas hastes, parece um W
    ("MOOWILA"). A barra fica reta: o dente desce até o topo da barra."""
    g = glyf[nome]
    coords = g.coordinates
    pts = [tuple(coords[i]) for i in range(len(coords))]
    xs = sorted({x for x, _ in pts})
    # entre as hastes (de dentro da esquerda à de dentro da direita)
    dentro = [(x, y) for x, y in pts if xs[1] < x < xs[-2]]
    ys = sorted({y for _, y in dentro})
    topo_barra, topo_dente = ys[-2], ys[-1]
    for i, (x, y) in enumerate(pts):
        if y == topo_dente and xs[1] < x < xs[-2]:
            coords[i] = (x, topo_barra)
    return (topo_dente, '->', topo_barra)


for peso in PESOS:
    f = instancer.instantiateVariableFont(TTFont(SRC), {'wght': peso})
    glyf = f['glyf']
    cmap = f.getBestCmap()
    for letra, fracao in LETRAS.items():
        for ch in (letra, 'ç' if letra == 'c' else 'Ç'):
            nome = cmap[ord(ch)]
            g = glyf[nome]
            if g.isComposite():
                continue  # a cedilha monta em cima do c já mexido
            print(peso, ch, abrir_boca(glyf, nome, fracao))
    print(peso, 'H', achatar_h(glyf, cmap[ord('H')]))
    # só essas letras, sem as regras de layout (a fonte é só o desenho delas)
    opts = subset.Options()
    opts.layout_features = []
    opts.name_IDs = ['*']
    opts.notdef_outline = True
    sub = subset.Subsetter(opts)
    sub.populate(unicodes=[ord(c) for c in 'cCçÇH'])
    sub.subset(f)
    # derivada da Pixelify Sans (OFL, sem nome reservado): leva outro nome, como a licença pede para versões mexidas
    nomes = f['name']
    for rec in list(nomes.names):
        if rec.nameID in (1, 3, 4, 6, 16, 17, 21, 22):
            nomes.removeNames(nameID=rec.nameID)
    for nid, valor in ((1, 'Pixel Letras'), (3, f'Pixel Letras {peso}'), (4, f'Pixel Letras {peso}'), (6, f'PixelLetras-{peso}'), (16, 'Pixel Letras'), (17, str(peso))):
        nomes.setName(valor, nid, 3, 1, 0x409)
        nomes.setName(valor, nid, 1, 0, 0)
    f.save(os.path.join(OUT, f'{PREFIXO}-{peso}.ttf'))
    f.flavor = 'woff2'
    f.save(os.path.join(OUT, f'{PREFIXO}-{peso}.woff2'))
print('ok', OUT)
