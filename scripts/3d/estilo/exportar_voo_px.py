"""
Os quadros do caminho da câmera (isométrico -> tático) de cada móvel, feitos pelo motor de pixel: o mesmo desenho e o
mesmo acabamento do exportar_px.py, com a câmera em 3 pontos do caminho do jogo (s = 0,25, 0,5 e 0,75; poseDaCamera em
mapaTatico.ts), nos 4 giros. No voo, o jogo mistura o quadro de antes com o de depois (e, nas pontas, o isométrico e
a vista de cima): o móvel continua com a arte dele o caminho todo, sem virar caixa.

No moveis.json: `voo` = {"25": {"4": {arquivo, ax, ay}, ...}, "50": ..., "75": ...} e `vooKv` (px por metro da
imagem). (ax, ay) é o meio da pegada no chão, na imagem.

Uso: python exportar_voo_px.py [móvel ...] [--grupo modulo] [--destino pasta]
     (sem nome: todos os de ITENS do exportar_px.py)
"""
import json
import os
import sys

import numpy as np
from PIL import Image

import exportar_px as EX
from exportar_px import ITENS, motor, CASA, tela

PONTOS = (25, 50, 75)


def quadro(nome, rot, desenho):
    """O móvel num giro, na câmera de agora: a imagem e o meio da pegada (no chão) nela."""
    W, D, (ox, oy), _, _ = ITENS[nome]
    fx, fy = (W * CASA, D * CASA) if rot in (0, 4) else (D * CASA, W * CASA)
    img, (ax, ay), _ = EX.desenhar(nome, rot, desenho)
    q = tela(np.array([[ox + fx, oy + fy, 0.0], [ox + fx / 2, oy + fy / 2, 0.0]]))
    return img, (ax + q[1, 0] - q[0, 0], ay + q[1, 1] - q[0, 1])


def exportar(nome, destino):
    _, _, _, desenho, _ = ITENS[nome]
    pasta = os.path.join(destino, nome)
    os.makedirs(pasta, exist_ok=True)
    voo = {}
    for s in PONTOS:
        motor.camera('voo', s / 100)
        giros = {}
        for rot in EX.SO_GIROS.get(nome, (4, 2, 0, 6)):
            img, (ax, ay) = quadro(nome, rot, desenho)
            arq = f'voo-{s}-giro-{rot}.png'
            Image.fromarray(img, 'RGBA').save(os.path.join(pasta, arq), optimize=True)
            giros[str(rot)] = {'arquivo': f'{nome}/{arq}', 'ax': round(float(ax), 1), 'ay': round(float(ay), 1)}
        voo[str(s)] = giros
    motor.camera('iso')
    print(f'{nome}: voo ok', flush=True)
    return voo


def main():
    args = sys.argv[1:]
    while '--grupo' in args:
        i = args.index('--grupo')
        mod = __import__(args[i + 1])
        del args[i:i + 2]
        args += list(mod.ITENS)
    destino = EX.DESTINO
    if '--destino' in args:
        i = args.index('--destino')
        destino = os.path.abspath(args[i + 1])
        del args[i:i + 2]
    nomes = args or list(ITENS)
    arq = os.path.join(destino, 'moveis.json')
    lista = json.load(open(arq, encoding='utf-8')) if os.path.exists(arq) else {}
    falhas = []
    for n in nomes:
        try:
            voo = exportar(n, destino)
        except Exception as e:      # um móvel que não aguenta a câmera do meio não derruba os outros
            motor.camera('iso')
            falhas.append((n, repr(e)))
            print(f'{n}: FALHOU {e!r}', flush=True)
            continue
        ent = lista.setdefault(n, {})
        ent['voo'] = voo
        ent['vooKv'] = motor.KV
    json.dump(lista, open(arq, 'w', encoding='utf-8'), ensure_ascii=False, indent=2)
    print('ok', len(nomes) - len(falhas), 'falhas', len(falhas))
    for n, e in falhas:
        print('  ', n, e)


if __name__ == '__main__':
    main()
