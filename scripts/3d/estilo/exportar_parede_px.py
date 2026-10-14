"""
Exporta ITENS DE PAREDE do estilo novo (pixel art 1:1, só código) para o jogo, a partir da cena de estudo inteira.

A cena (agente_cozinha/cozinha.py) é desenhada duas vezes, com e sem o item; ficam só os pixels que são do item
(os objetos criados por ele) e, em volta dele, o que ele muda NA PAREDE (o furo, a sombra do batente). A parede do
jogo é a mesma (texturas_px.py), então o recorte encaixa sem emenda. O sol que entra pela janela e cai no chão e nos
móveis NÃO vai junto (é luz da cena, não do item).

Grava client/public/arte/mobiliario/<def>/parede-r.png e parede-l.png (a da esquerda é o espelho) e a linha do
moveis.json: escala 1, pixel, e a âncora = o meio do item na parede (o ponto que o jogo usa:
iso(pos, plano, z + h/64)).

Uso: python exportar_parede_px.py [def ...] [--grupo modulo] [--destino pasta] [--t 0.0]
"""
import json
import os
import sys

os.environ['ESC'] = '1'
AQUI = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(AQUI, '..', '..', '..'))
sys.path.insert(0, os.path.join(AQUI, '..', 'codigo'))
sys.path.insert(0, os.path.join(AQUI, 'agente_cozinha'))
import numpy as np                     # noqa: E402
from PIL import Image                  # noqa: E402
import cozinha as CZ                   # noqa: E402
from motor import tela                 # noqa: E402
import janela_cozinha as JC            # noqa: E402

DESTINO = os.path.join(REPO, 'client', 'public', 'arte', 'mobiliario')
Z_PER_M = 1.633           # unidades de altura do jogo por metro (shared: Z_PER_M)
M_CASA = 0.75


def _janela_cozinha():
    """O item: a janela com a cortina, em cima da pia. Devolve a função que o põe na cena e o meio dele (m)."""
    meio = ((JC.YA + JC.YB) / 2, 0.0, (JC.ZA - 0.17 + JC.ZR + 0.03) / 2)
    return JC.janela, meio


# def do catálogo: (a função que constrói o item e o meio dele na parede de trás, em metros)
ITENS = {
    'janela_cozinha': _janela_cozinha,
}

# Os itens de parede dos outros cômodos, desenhados SOZINHOS (sem a cena inteira): nos módulos de pecas_px/,
# ITENS_PAREDE = {def: (desenho, (x, z))}. O desenho põe o item na parede de trás (o plano y = 0, saindo para +y),
# com o meio dele em (x, 0, z) metros da cena, usando as peças do cozinha.py (CZ) e do base_estilo.py (BE).
ITENS_PAREDE = {}


def _carregar_grupos():
    import importlib
    pasta = os.path.join(AQUI, 'pecas_px')
    if not os.path.isdir(pasta):
        return
    sys.path.insert(0, pasta)
    for arq in sorted(os.listdir(pasta)):
        if arq.endswith('.py') and not arq.startswith('_'):
            for k, v in getattr(importlib.import_module(arq[:-3]), 'ITENS_PAREDE', {}).items():
                if k in ITENS_PAREDE or k in ITENS:
                    raise SystemExit(f'{k} está em dois lugares (pecas_px/{arq} e outro)')
                ITENS_PAREDE[k] = v


_carregar_grupos()


def exportar_sozinho(nome, destino):
    """Um item de parede desenhado sozinho, pelo exportador dos móveis (a mesma luz, o mesmo contorno)."""
    import exportar_px as EP
    desenho, (X, Z) = ITENS_PAREDE[nome]
    ox, oy = X - 0.75, 0.0
    EP.ITENS['__parede'] = (2, 1, (ox, oy), desenho, {})
    img, (ax, ay), _ = EP.desenhar('__parede', 4, desenho)
    del EP.ITENS['__parede']
    # a âncora do exportador é a quina da frente da pegada; a do item de parede é o meio dele na parede
    q = tela(np.array([[ox + 2 * 0.75, oy + 0.75, 0.0]]))[0]
    m = tela(np.array([[X, 0.0, Z]]))[0]
    ax, ay = ax + (m[0] - q[0]), ay + (m[1] - q[1])
    pasta = os.path.join(destino, nome)
    os.makedirs(pasta, exist_ok=True)
    im = Image.fromarray(img, 'RGBA')
    im.save(os.path.join(pasta, 'parede-r.png'), optimize=True)
    im.transpose(Image.FLIP_LEFT_RIGHT).save(os.path.join(pasta, 'parede-l.png'), optimize=True)
    w, h = im.size
    print(f'{nome}: {w}x{h} px, âncora ({ax:.1f}, {ay:.1f})')
    return {
        'escala': 1, 'pixel': True, 'codigo': True,
        'parede': {
            'r': {'arquivo': f'{nome}/parede-r.png', 'ax': round(float(ax), 1), 'ay': round(float(ay), 1)},
            'l': {'arquivo': f'{nome}/parede-l.png', 'ax': round(float(w - ax), 1), 'ay': round(float(ay), 1)},
        },
    }


def _desenhar(t, com_item, construir):
    """A cena inteira em 1:1. Com o item: anota o primeiro objeto dele."""
    marca = {'n0': None}
    original = JC.janela

    def com(c, tt):
        marca['n0'] = len(c.objs)
        construir(c, tt)

    def sem(c, tt):
        return None

    JC.janela = com if com_item else sem
    CZ.JANELA['ok'] = com_item
    try:
        img = CZ.montar(t, 1.0, t)
    finally:
        JC.janela = original
        CZ.JANELA['ok'] = True
    c = CZ.c
    return np.asarray(img).astype(np.int16), c.obj.copy(), c.tipo.copy(), marca['n0'], (c.x0, c.y0)


def _dilatar(m, r):
    out = m.copy()
    for dy in range(-r, r + 1):
        for dx in range(-r, r + 1):
            out |= np.roll(np.roll(m, dy, 0), dx, 1)
    return out


def exportar(nome, destino, t):
    construir, meio = ITENS[nome]()
    cor_a, obj_a, tipo_a, n0, (x0, y0) = _desenhar(t, True, construir)
    cor_b, _, _, _, _ = _desenhar(t, False, construir)
    do_item = obj_a >= n0
    mudou = np.abs(cor_a - cor_b).max(axis=-1) > 0
    # na parede, em volta do item, o que ele muda (o contorno de 1 px, a sombra do batente e da cortina)
    em_volta = _dilatar(do_item, 3) & mudou & (tipo_a == 2)
    m = do_item | em_volta
    ys, xs = np.nonzero(m)
    if not len(xs):
        raise SystemExit(f'{nome}: nada desenhado')
    a0, a1, b0, b1 = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1
    rgba = np.zeros((b1 - b0, a1 - a0, 4), np.uint8)
    rgba[..., :3] = np.clip(cor_a[b0:b1, a0:a1], 0, 255)
    rgba[..., 3] = np.where(m[b0:b1, a0:a1], 255, 0)
    # a âncora: o meio do item na parede, na tela (a mesma conta do motor e do jogo), dentro do recorte
    X, Y, Z = meio
    sx, sy = tela(np.array([[X, Y, Z]]))[0][:2]
    ax = sx - x0 - a0
    ay = sy - y0 - b0
    pasta = os.path.join(destino, nome)
    os.makedirs(pasta, exist_ok=True)
    img = Image.fromarray(rgba, 'RGBA')
    img.save(os.path.join(pasta, 'parede-r.png'))
    img.transpose(Image.FLIP_LEFT_RIGHT).save(os.path.join(pasta, 'parede-l.png'))
    w, h = img.size
    linha = {
        'escala': 1, 'pixel': True, 'codigo': True,
        'parede': {
            'r': {'arquivo': f'{nome}/parede-r.png', 'ax': round(float(ax), 1), 'ay': round(float(ay), 1)},
            'l': {'arquivo': f'{nome}/parede-l.png', 'ax': round(float(w - ax), 1), 'ay': round(float(ay), 1)},
        },
    }
    altura_m = (JC.ZR + 0.03) - (JC.ZA - 0.17)
    largura_m = (JC.YB - JC.YA) + 0.72
    print(f'{nome}: {w}x{h} px, âncora ({ax:.1f}, {ay:.1f}); meio a {X / M_CASA:.2f} casas e {Z * Z_PER_M:.2f} unidades;'
          f' no catálogo, w ≈ {largura_m / M_CASA * 32:.0f} px e h ≈ {altura_m * Z_PER_M * 32:.0f} px')
    return linha


def main():
    args = sys.argv[1:]
    destino = DESTINO
    t = 0.0
    if '--destino' in args:
        i = args.index('--destino')
        destino = args[i + 1]
        del args[i:i + 2]
    if '--t' in args:
        i = args.index('--t')
        t = float(args[i + 1])
        del args[i:i + 2]
    if '--grupo' in args:
        i = args.index('--grupo')
        mod = __import__(args[i + 1])
        del args[i:i + 2]
        args += list(getattr(mod, 'ITENS_PAREDE', {}))
    nomes = args or list(ITENS) + list(ITENS_PAREDE)
    jpath = os.path.join(destino, 'moveis.json')
    lista = {}
    if os.path.exists(jpath):
        with open(jpath, encoding='utf-8') as f:
            lista = json.load(f)
    os.makedirs(destino, exist_ok=True)
    for n in nomes:
        lista[n] = exportar_sozinho(n, destino) if n in ITENS_PAREDE else exportar(n, destino, t)
    with open(jpath, 'w', encoding='utf-8') as f:
        json.dump(lista, f, ensure_ascii=False, indent=2)
        f.write('\n')


if __name__ == '__main__':
    main()
