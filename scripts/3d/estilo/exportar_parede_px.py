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


def _janela_fechada(ok):
    JC.FECHADA['ok'] = ok


def _janela_cortina(ok):
    JC.FECHADA['ok'] = ok
    JC.CORTINA['ok'] = ok


# def do catálogo: (a função que constrói o item e o meio dele na parede de trás, em metros)
ITENS = {
    'janela_cozinha': _janela_cozinha,
}
# animação do estado 0: quantos quadros (o loop inteiro, t de 0 a 1) e quanto tempo cada um fica (ms)
QUADROS = {'janela_cozinha': (12, 140)}
# os outros estados: estado -> a função que liga (True) e desliga (False) o jeito daquele estado
ESTADOS = {'janela_cozinha': {'1': _janela_fechada, '2': _janela_cortina}}

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
    """
    Um item de parede desenhado sozinho, pelo exportador dos móveis (a mesma luz, o mesmo contorno). O valor em
    ITENS_PAREDE é (desenho, (x, z)) ou (desenho, (x, z), {estado: desenho}); os estados saem como 'r-1', 'l-1'...
    """
    import exportar_px as EP
    ent = ITENS_PAREDE[nome]
    desenho, (X, Z) = ent[0], ent[1]
    estados = ent[2] if len(ent) > 2 else {}
    ox, oy = X - 0.75, 0.0
    q = tela(np.array([[ox + 2 * 0.75, oy + 0.75, 0.0]]))[0]
    m = tela(np.array([[X, 0.0, Z]]))[0]
    pasta = os.path.join(destino, nome)
    os.makedirs(pasta, exist_ok=True)
    parede = {}
    for est, des in [('0', desenho)] + list(estados.items()):
        EP.ITENS['__parede'] = (2, 1, (ox, oy), des, {})
        img, (ax, ay), _ = EP.desenhar('__parede', 4, des)
        del EP.ITENS['__parede']
        # a âncora do exportador é a quina da frente da pegada; a do item de parede é o meio dele na parede
        ax, ay = ax + (m[0] - q[0]), ay + (m[1] - q[1])
        suf = '' if est == '0' else f'-{est}'
        im = Image.fromarray(img, 'RGBA')
        im.save(os.path.join(pasta, f'parede-r{suf}.png'), optimize=True)
        im.transpose(Image.FLIP_LEFT_RIGHT).save(os.path.join(pasta, f'parede-l{suf}.png'), optimize=True)
        w, h = im.size
        parede['r' + suf] = {'arquivo': f'{nome}/parede-r{suf}.png', 'ax': round(float(ax), 1), 'ay': round(float(ay), 1)}
        parede['l' + suf] = {'arquivo': f'{nome}/parede-l{suf}.png', 'ax': round(float(w - ax), 1), 'ay': round(float(ay), 1)}
        print(f'{nome} estado {est}: {w}x{h} px, âncora ({ax:.1f}, {ay:.1f})')
    return {'escala': 1, 'pixel': True, 'codigo': True, 'parede': parede}


def _dilatar(m, r):
    out = m.copy()
    for dy in range(-r, r + 1):
        for dx in range(-r, r + 1):
            out |= np.roll(np.roll(m, dy, 0), dx, 1)
    return out


def _render_item(construir, tj, sem):
    """O item no instante tj (a cortina), com o fogo parado: os pixels dele e o que ele muda na parede."""
    cor_a, obj_a, tipo_a, n0, (x0, y0) = _desenhar_t(tj, True, construir)
    do_item = obj_a >= n0
    mudou = np.abs(cor_a - sem).max(axis=-1) > 0
    m = do_item | (_dilatar(do_item, 3) & mudou & (tipo_a == 2))
    return cor_a, m, (x0, y0)


def _desenhar_t(tj, com_item, construir):
    marca = {'n0': None}
    original = JC.janela

    def com(c, tt):
        marca['n0'] = len(c.objs)
        construir(c, tt)

    JC.janela = com if com_item else (lambda c, tt: None)
    CZ.JANELA['ok'] = com_item
    try:
        img = CZ.montar(0.0, 0.0, tj)        # o fogo apagado e parado: só o item mexe
    finally:
        JC.janela = original
        CZ.JANELA['ok'] = True
    c = CZ.c
    return np.asarray(img).astype(np.int16), c.obj.copy(), c.tipo.copy(), marca['n0'], (c.x0, c.y0)


def exportar(nome, destino, t):
    """O item no estado 0 (com os quadros da animação, se tiver) e nos outros estados, todos no MESMO recorte."""
    construir, meio = ITENS[nome]()
    sem = _desenhar_t(0.0, False, construir)[0]
    n, ms = QUADROS.get(nome, (1, 0))
    vistas = []          # (chave, quadro, cor, máscara)
    for k in range(n):
        cor, m, org = _render_item(construir, (t + k / n) % 1.0 if n > 1 else t, sem)
        vistas.append(('0', k, cor, m))
    for est, liga in ESTADOS.get(nome, {}).items():
        liga(True)
        try:
            cor, m, org = _render_item(construir, 0.0, sem)
        finally:
            liga(False)
        vistas.append((est, 0, cor, m))
    x0, y0 = org
    uniao = np.zeros_like(vistas[0][3])
    for _, _, _, m in vistas:
        uniao |= m
    ys, xs = np.nonzero(uniao)
    a0, a1, b0, b1 = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1
    X, Y, Z = meio
    sx, sy = tela(np.array([[X, Y, Z]]))[0][:2]
    ax, ay = float(sx - x0 - a0), float(sy - y0 - b0)
    w = int(a1 - a0)
    pasta = os.path.join(destino, nome)
    os.makedirs(pasta, exist_ok=True)

    def grava(cor, m, arq):
        rgba = np.zeros((b1 - b0, a1 - a0, 4), np.uint8)
        rgba[..., :3] = np.clip(cor[b0:b1, a0:a1], 0, 255)
        rgba[..., 3] = np.where(m[b0:b1, a0:a1], 255, 0)
        im = Image.fromarray(rgba, 'RGBA')
        im.save(os.path.join(pasta, f'parede-r{arq}.png'), optimize=True)
        im.transpose(Image.FLIP_LEFT_RIGHT).save(os.path.join(pasta, f'parede-l{arq}.png'), optimize=True)

    def vista(lado, arq):
        return {'arquivo': f'{nome}/parede-{lado}{arq}.png', 'ax': round(ax if lado == 'r' else w - ax, 1), 'ay': round(ay, 1)}

    parede = {}
    quadros = {'r': [], 'l': []}
    for est, k, cor, m in vistas:
        if est == '0':
            arq = '' if k == 0 else f'-q{k}'
            grava(cor, m, arq)
            if k == 0:
                parede['r'], parede['l'] = vista('r', ''), vista('l', '')
            if n > 1:
                quadros['r'].append(vista('r', arq))
                quadros['l'].append(vista('l', arq))
        else:
            grava(cor, m, f'-{est}')
            parede[f'r-{est}'], parede[f'l-{est}'] = vista('r', f'-{est}'), vista('l', f'-{est}')
    linha = {'escala': 1, 'pixel': True, 'codigo': True, 'parede': parede}
    if n > 1:
        linha['quadros'] = quadros
        linha['ms'] = ms
    print(f'{nome}: {w}x{int(b1 - b0)} px, âncora ({ax:.1f}, {ay:.1f}), {n} quadro(s), estados {["0"] + list(ESTADOS.get(nome, {}))}')
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
        novo = exportar_sozinho(n, destino) if n in ITENS_PAREDE else exportar(n, destino, t)
        velho = lista.get(n, {})
        # a tela acesa (a TV): as cores que piscam na luz continuam; o ponto do brilho era da imagem antiga e sai
        if 'tela' in velho and 'tela' not in novo:
            novo['tela'] = {**velho['tela'], 'paredes': {}}
        lista[n] = novo
    with open(jpath, 'w', encoding='utf-8') as f:
        json.dump(lista, f, ensure_ascii=False, indent=2)
        f.write('\n')


if __name__ == '__main__':
    main()
