"""A logo do CRONA na tela de entrada.

    python3 scripts/entrada-logo.py

Lê a logo vertical dourada (client/public/arte/marca/crona-logo.png: o d20 em cima, CRONA embaixo, com a
estrelinha no O) e faz o que a tela precisa:

  client/public/arte/login/logo-ouro.webp   a logo dourada, recortada no conteúdo, SEM as estrelinhas em volta
  client/public/arte/login/logo-azul.webp   a variação azul-prateada da mesma logo (uma faixa dela passa por
                                            cima da dourada, de tempos em tempos)
  client/public/arte/login/brilhos/<tela>.png e client/src/ui/entradaMarca.json
                                            as estrelinhas em volta do emblema, recortadas da própria logo
                                            (cada uma pisca no seu ritmo), e onde a logo fica em cada tela

A cor azul-prateada vem das logos horizontais (dourada e azul, as duas que o Felipe mandou): cada pixel da
vertical dourada ganha a cor que, na horizontal azul, tem o mesmo lugar na ordem de claridade.

Precisa de: pip install pillow numpy
"""

import json
import pathlib

import numpy as np
from PIL import Image

RAIZ = pathlib.Path(__file__).resolve().parent.parent
MARCA = RAIZ / 'client/public/arte/marca'
LOGIN = RAIZ / 'client/public/arte/login'

# onde a logo fica em cada tela (as coordenadas são as da arte da tela):
#   escala: tamanho de um pixel da logo original na tela
#   centro: x do meio do painel
#   baixo:  y onde termina a base das letras do CRONA (abaixo delas ainda cabe o enfeite, antes da frase
#           "Suas histórias começam aqui.")
TELAS = {
    'computador': {'escala': 0.28, 'centro': 1118, 'baixo': 328},
    'celular': {'escala': 0.33, 'centro': 470, 'baixo': 640},
}
# a base das letras na logo original e o meio do conteúdo (medidos na imagem)
LETRAS_BAIXO = 1116
LARGURA_ARQUIVO = 640  # largura do conteúdo nos arquivos que vão para o jogo (o dobro do tamanho em tela)


def luz(rgb):
    return rgb[..., 0] * 0.3 + rgb[..., 1] * 0.59 + rgb[..., 2] * 0.11


def componentes(opaco):
    """As manchas ligadas (oito vizinhos): lista de (area, x0, y0, x1, y1, pontos)."""
    alt, larg = opaco.shape
    rotulo = np.zeros((alt, larg), np.int32)
    saida = []
    ys, xs = np.nonzero(opaco)
    for y0, x0 in zip(ys, xs):
        if rotulo[y0, x0]:
            continue
        n = len(saida) + 1
        pilha = [(y0, x0)]
        rotulo[y0, x0] = n
        pts = []
        while pilha:
            y, x = pilha.pop()
            pts.append((y, x))
            for dy in (-1, 0, 1):
                for dx in (-1, 0, 1):
                    yy, xx = y + dy, x + dx
                    if 0 <= yy < alt and 0 <= xx < larg and opaco[yy, xx] and not rotulo[yy, xx]:
                        rotulo[yy, xx] = n
                        pilha.append((yy, xx))
        p = np.array(pts)
        saida.append((len(pts), int(p[:, 1].min()), int(p[:, 0].min()), int(p[:, 1].max()), int(p[:, 0].max()), p))
    return sorted(saida, key=lambda c: -c[0])


def mapa_azul():
    """A tabela que leva a claridade do dourado à cor da logo azul (casamento de histogramas)."""
    ouro = np.asarray(Image.open(MARCA / 'crona-logo-horizontal.png').convert('RGBA')).astype(np.float32)
    azul = np.asarray(Image.open(MARCA / 'crona-logo-horizontal-azul.png').convert('RGBA')).astype(np.float32)
    lo = np.sort(luz(ouro[..., :3])[ouro[..., 3] > 250])
    ba = azul[azul[..., 3] > 250]
    ba = ba[np.argsort(luz(ba[:, :3]))]
    # 256 faixas de claridade igualmente cheias: a cor média do azul em cada uma
    cores = np.stack([c.mean(axis=0) for c in np.array_split(ba[:, :3], 256)])
    return lo, cores


def main():
    ouro_orig = Image.open(MARCA / 'crona-logo.png').convert('RGBA')
    a = np.asarray(ouro_orig)
    opaco = a[..., 3] > 40
    comps = componentes(opaco)
    # o corpo (emblema com o enfeite) e as duas metades das letras são os três maiores; o resto são as
    # estrelinhas e os pontinhos
    brilhos = [c for c in comps[3:] if c[4] < 1120]
    ficam = comps[:3] + [c for c in comps[3:] if c[4] >= 1120]  # (as pontas do enfeite de baixo ficam)
    base = a.copy()
    for _, x0, y0, x1, y1, pts in brilhos:
        for y, x in pts:
            base[max(0, y - 1) : y + 2, max(0, x - 1) : x + 2, 3] = 0
    cx0, cy0, cx1, cy1 = 63, 78, 1184, 1207  # o conteúdo na logo original

    def para_arquivo(arr, nome):
        im = Image.fromarray(arr).crop((cx0, cy0, cx1 + 1, cy1 + 1))
        h = round(im.height * LARGURA_ARQUIVO / im.width)
        im = im.resize((LARGURA_ARQUIVO, h), Image.LANCZOS)
        destino = LOGIN / nome
        im.save(destino, quality=92, method=6)
        print(destino.relative_to(RAIZ), im.size, destino.stat().st_size // 1024, 'KB')

    para_arquivo(base, 'logo-ouro.webp')

    # a variação azul-prateada: a mesma imagem, a cor trocada pela do histograma da logo azul
    lo, cores = mapa_azul()
    rgb = base[..., :3].astype(np.float32)
    pos = np.searchsorted(lo, luz(rgb)) / len(lo)
    q = np.clip((pos * 256).astype(int), 0, 255)
    azul = base.copy()
    azul[..., :3] = np.clip(cores[q], 0, 255).astype(np.uint8)
    para_arquivo(azul, 'logo-azul.webp')

    # onde a logo fica em cada tela e as estrelinhas (recortadas da logo, no tamanho da tela)
    saida = {}
    for tela, T in TELAS.items():
        s = T['escala']
        w = round((cx1 - cx0 + 1) * s)
        h = round((cy1 - cy0 + 1) * s)
        x = round(T['centro'] - w / 2)  # o canto de cima, à esquerda, do conteúdo
        y = round(T['baixo'] - (LETRAS_BAIXO - cy0) * s)
        na_tela = ouro_orig.resize((round(ouro_orig.width * s), round(ouro_orig.height * s)), Image.LANCZOS)
        lista = []
        recortes = []
        for _, bx0, by0, bx1, by1, pts in brilhos:
            sx0, sy0 = int(bx0 * s) - 1, int(by0 * s) - 1
            sx1, sy1 = int(bx1 * s) + 2, int(by1 * s) + 2
            corte = na_tela.crop((sx0, sy0, sx1, sy1))
            tam = int((corte.split()[3].point(lambda v: 255 if v > 60 else 0)).histogram()[255])
            recortes.append(corte)
            lista.append({'x': round(x - cx0 * s + sx0), 'y': round(y - cy0 * s + sy0), 'w': corte.width, 'h': corte.height, 'tam': tam})
        larg_folha = sum(r.width + 1 for r in recortes)
        folha = Image.new('RGBA', (larg_folha, max(r.height for r in recortes)), (0, 0, 0, 0))
        sx = 0
        for r, item in zip(recortes, lista):
            folha.paste(r, (sx, 0))
            item['sx'] = sx
            sx += r.width + 1
        destino = LOGIN / 'brilhos' / f'{tela}.png'
        folha.save(destino, optimize=True)
        print(destino.relative_to(RAIZ), folha.size, len(lista), 'estrelinhas')
        # o meio do emblema (o d20 vai da linha 78 à 885 da logo original): o halo dourado fica atrás dele
        meio = [round(T['centro']), round(y + (480 - cy0) * s)]
        saida[tela] = {'x': x, 'y': y, 'w': w, 'h': h, 'emblema': meio, 'brilhos': lista}
    (RAIZ / 'client/src/ui/entradaMarca.json').write_text(json.dumps(saida, indent=1) + '\n')
    print('client/src/ui/entradaMarca.json', {t: (v['x'], v['y'], v['w'], v['h']) for t, v in saida.items()})
    print(len(ficam), 'partes fixas;', len(brilhos), 'estrelinhas animadas')


if __name__ == '__main__':
    main()
