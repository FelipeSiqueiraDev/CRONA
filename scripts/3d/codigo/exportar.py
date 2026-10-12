"""
A arte dos móveis feita por código, no formato que o jogo lê (client/public/arte/mobiliario/moveis.json).

Cada móvel é um modelo em Python (pecas.py) no tamanho de verdade dele (o de base: o jogo aplica o
`aumento` do catálogo por cima). Para cada um dos 4 giros, o motor (motor.py) desenha o móvel sozinho na
câmera do tabuleiro, com a luz de cada face, a sombra macia da luz de cima (nele e no chão) e o
contorno, 4 vezes maior, e reduz para 2 pixels por pixel do tabuleiro (a `escala` 0,5 do jogo).

- O móvel vai centrado na pegada (o jogo encosta na parede quem tem as costas para ela).
- A sombra no chão vai dentro da imagem, semitransparente: gira junto com o móvel.
- A âncora é a quina da frente da base (a de baixo na tela), como na arte desenhada.
- `exato`: o jogo usa a medida `real` direto, sem medir o desenho (a sombra entraria na conta).

Uso: python exportar.py [móvel ...]   (sem nome: todos)
"""
import json
import math
import os
import sys

os.environ.setdefault('ESC', '4')
import numpy as np
from PIL import Image

import motor
from motor import Cena, Peca, CASA, tela, hexa
from materiais import liso
import pecas

REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
DESTINO = os.path.join(REPO, 'client', 'public', 'arte', 'mobiliario')
ESC = motor.ESC
SAIDA = 2.0  # pixels da imagem por pixel do tabuleiro (escala 0,5 do jogo)

# a luz de cima (a mesma da cena): a sombra cai para a frente e para a direita
LUZ_CIMA = (0.3, 0.4, -1.0)


def fogao_apagado(c, p):
    return pecas.fogao(c, p, aceso=False)


# def do catálogo: (largura e fundo em casas, o modelo, os outros estados)
MOVEIS = {
    'armario_cozinha': (2, 1, pecas.armario_cozinha, {}),
    'fogao_lenha': (2, 1, fogao_apagado, {'1': pecas.fogao}),  # como no catálogo: 0 apagado, 1 aceso
    'pia_cozinha': (2, 1, pecas.pia, {}),
    'mesa_cozinha': (3, 2, pecas.mesa, {}),
    'chair_wood': (1, 1, pecas.cadeira, {}),
    'crate_wood': (1, 1, pecas.caixote, {}),
    'barrel': (1, 1, pecas.barril, {}),
    'plant': (1, 1, pecas.planta, {}),
}


class Medidor(Cena):
    """Uma cena que só anota onde fica cada polígono do modelo (para centrar e medir), sem desenhar."""

    def __init__(self):
        super().__init__(0, 0, 1, 1)


def medir(W, D, modelo):
    c = Medidor()
    p = Peca(0, 0, 4, W, D)
    modelo(c, p)
    pts = np.concatenate([Pw for Pw, _ in c.polis] + [np.array([C - R, C + R]) for C, R, _ in c.elips])
    L = p.local(pts)
    return L[:, 0].min(), L[:, 0].max(), L[:, 1].min(), L[:, 1].max(), L[:, 2].max()


def desenhar(W, D, rot, modelo, du, dv, alto, pintura=None, sombra_de=None):
    Wm, Dm = W * CASA, D * CASA
    fx, fy = (Wm, Dm) if rot in (0, 4) else (Dm, Wm)
    folga = 0.9
    cantos = np.array([[x, y, z] for x in (-folga, fx + folga) for y in (-folga, fy + folga) for z in (0, alto + 0.1)])
    S = tela(cantos)
    x0, y0 = int(S[:, 0].min()) - 8, int(S[:, 1].min()) - 8
    w, h = int(S[:, 0].max() - x0) + 8, int(S[:, 1].max() - y0) + 8
    c = Cena(x0, y0, w, h)
    p = Peca(0, 0, rot, W, D, du, dv)
    modelo(c, p)
    if pintura:
        pintura(c, rot)
    if sombra_de:
        # quem faz a sombra é o modelo do código (com os pés e os vãos), não a caixa
        # (esticado para caber na caixa, para a sombra sair dos pés que o desenho mostra)
        m = Medidor()
        sombra_de(m, p)
        cx = np.concatenate([Pw for Pw, _ in c.polis])
        mx = np.concatenate([Pw for Pw, _ in m.polis])
        a0, a1, b0, b1 = cx.min(0), cx.max(0), mx.min(0), mx.max(0)
        k = (a1 - a0) / np.maximum(b1 - b0, 1e-6)
        c.polis = [(a0 + (Pw - b0) * k, n) for Pw, n in m.polis]
    # o chão invisível que recebe a sombra
    chao = c.novo_obj(1, contorno=False, sombra=False)
    c.face_plana([(-folga, -folga, 0), (fx + folga, -folga, 0), (fx + folga, fy + folga, 0), (-folga, fy + folga, 0)], (0, 0, 1), liso('#000000'), motor.MUNDO, chao)
    aceso = c.sombra_direcional(LUZ_CIMA, res=0.005, vies=0.008, raio=2, amostras=6, abertura=0.22)
    movel = c.tipo == 3
    if not sombra_de:
        c.escurecer(aceso, 0.3 if pintura else 0.42, so=movel)
    if not pintura:
        c.brilho_de_quina()
    c.contorno()
    # a sombra no chão: a da luz de cima e a de contato (a luz que vem de todo lado, bem embaixo e em volta do pé)
    no_chao = c.tipo == 1
    contato = c.sombra_direcional((0.0, 0.01, -1.0), res=0.01, vies=0.008, raio=4, amostras=8, abertura=0.55)
    A = np.where(no_chao, np.maximum((1 - aceso) * 0.6, (1 - contato) * 0.55), 0.0)
    img = np.zeros((h, w, 4))
    img[..., :3] = np.where(movel[..., None], c.cor, np.array([22.0, 16.0, 14.0]))
    img[..., 3] = np.where(movel, 255.0, A * 255.0)
    img = np.clip(img, 0, 255)
    # a quina da frente da base (a âncora), em pixels desta imagem
    qx, qy = tela(np.array([fx, fy, 0.0]))
    return img, (qx - x0, qy - y0)


def reduzir(img, fator):
    """Reduz com o alfa pré-multiplicado (a borda não escurece)."""
    pre = img.copy()
    pre[..., :3] *= pre[..., 3:4] / 255.0
    h, w = img.shape[:2]
    nw, nh = max(1, round(w / fator)), max(1, round(h / fator))
    canais = [np.asarray(Image.fromarray(pre[..., k].astype(np.float32), 'F').resize((nw, nh), Image.BOX)) for k in range(4)]
    out = np.stack(canais, -1)
    a = np.maximum(out[..., 3:4], 1e-6)
    out[..., :3] = np.where(out[..., 3:4] > 0.5, out[..., :3] * 255.0 / a, 0)
    return np.clip(out, 0, 255).round().astype(np.uint8)


# a arte do Códex vestida no molde exato: a folha de cada estado e a ficha (scripts/3d/fichas) de onde vêm os pedaços
MOLDES = {
    'armario_cozinha': ('moveis-fazenda-casa.json', {'0': 'armario-cozinha.png'}, 'caixa'),
    'fogao_lenha': ('moveis-fazenda-casa.json', {'0': 'fogao-lenha-apagado.png', '1': 'fogao-lenha-aceso.png'}, 'caixa'),
    'pia_cozinha': ('moveis-fazenda-casa.json', {'0': 'pia-cozinha.png'}, 'caixa'),
    'mesa_cozinha': ('moveis-fazenda-casa.json', {'0': 'mesa-cozinha.png'}, 'modelo'),
    'chair_wood': ('moveis-rituais.json', {'0': 'cadeira-madeira.png'}, 'modelo'),
}


def pintura_do_codex(nome, estado, recorta=False):
    """
    Veste o molde com a pintura do Códex: para cada giro, acha a câmera com que o desenho foi feito (a do
    moveis.py: a caixa da medida de verdade que melhor cobre a silhueta) e, para cada pixel do móvel no molde,
    leva o ponto dele para essa caixa e de lá para o desenho, e pega a cor. Onde o desenho não tem nada (uma face
    que o Códex não mostrou), fica a cor do modelo.
    """
    sys.path.insert(0, os.path.join(REPO, 'scripts', '3d'))
    import moveis as MV
    ficha, folhas, _ = MOLDES[nome]
    fj = json.load(open(os.path.join(REPO, 'scripts', '3d', 'fichas', ficha), encoding='utf-8'))
    m = next(x for x in fj['moveis'] if x['def'] == nome)
    folha = MV.ler(os.path.join(DESTINO, 'folhas', folhas.get(estado, folhas['0'])))
    if fj.get('limpar'):
        folha[:, :, 3] = np.where(folha[:, :, 3] < fj['limpar'], 0, folha[:, :, 3])
    caixas = MV.pedacos(folha[:, :, 3] > 16)
    real = m['real']
    cache = {}
    pintura_do_codex.real = real

    def camera(rot):
        if rot not in cache:
            qual = m['giros'][str(rot)]
            pedaco, espelho = (qual, False) if isinstance(qual, int) else (qual['pedaco'], qual.get('espelho', False))
            rec, _ = MV.recortar_origem(folha, caixas, pedaco)
            if espelho:
                rec = rec[:, ::-1].copy()
            troca = rot in (2, 6)
            wr, dr, hr = (real[1], real[0], real[2]) if troca else tuple(real)
            cam, _ = MV.ajustar_camera(rec[:, :, 3] > 100, wr, dr, hr, livre='proporcao')
            cache[rot] = (rec, cam)
        return cache[rot]

    def pintar(c, rot):
        rec, cam = camera(rot)
        todos = np.concatenate([Pw for Pw, _ in c.polis] + [np.array([C - R, C + R]) for C, R, _ in c.elips])
        X0, Y0 = todos[:, 0].min(), todos[:, 1].min()
        X1, Y1, Z1 = todos[:, 0].max(), todos[:, 1].max(), todos[:, 2].max()
        mov = c.tipo == 3
        P = c.mundoP[mov]
        q = np.stack([(P[:, 0] - X0) / (X1 - X0) * cam['W'], (P[:, 1] - Y0) / (Y1 - Y0) * cam['D'], P[:, 2] / Z1 * cam['H']], 1)
        u, v = MV.proj(q, cam)
        cor = MV.amostrar(rec, u, v)
        tem = cor[:, 3] > 150
        novo = c.cor[mov].copy()
        novo[tem] = cor[tem, :3]
        c.cor[mov] = novo
        if recorta:
            # no molde de caixa, o que o desenho não tem vira vazio (o vão entre os pés, a quina da cornija)
            fora = np.zeros(c.tipo.shape, bool)
            fora[mov] = cor[:, 3] < 128
            c.tipo[fora] = 0
            c.prof[fora] = -1e9
            c.obj[fora] = -1
    return pintar


def caixa_de(real):
    """O molde mais simples: a caixa da medida de verdade (a mesma com que o moveis.py acha a câmera do desenho)."""
    def modelo(c, p):
        o = c.novo_obj()
        c.caixa((0, real[0], 0, real[1], 0, real[2]), liso('#808080'), p, o, ch=0.0001)
    return modelo


def exportar(nome, codex=False, caixa=False):
    W, D, modelo, estados = MOVEIS[nome]
    sombra_de = None
    if caixa:
        sys.path.insert(0, os.path.join(REPO, 'scripts', '3d'))
        ficha = json.load(open(os.path.join(REPO, 'scripts', '3d', 'fichas', MOLDES[nome][0]), encoding='utf-8'))
        real = next(x for x in ficha['moveis'] if x['def'] == nome)['real']
        caixa_m = caixa_de(real)
        # o maciço faz a sombra da própria caixa; o vazado (mesa, cadeira), a do modelo do código
        sombra_de, modelo = (modelo if MOLDES[nome][2] == 'modelo' else caixa_m), caixa_m
        estados = {k: modelo for k in estados}
    u0, u1, v0, v1, alto = medir(W, D, modelo)
    Wm, Dm = W * CASA, D * CASA
    du, dv = Wm / 2 - (u0 + u1) / 2, Dm / 2 - (v0 + v1) / 2
    pasta = os.path.join(DESTINO, nome)
    os.makedirs(pasta, exist_ok=True)
    fator = ESC / SAIDA

    def vistas(mod, sufixo='', estado='0'):
        out = {}
        pint = pintura_do_codex(nome, estado, caixa) if codex and nome in MOLDES else None
        for rot in (4, 2, 0, 6):
            img, (ax, ay) = desenhar(W, D, rot, mod, du, dv, alto, pint, sombra_de)
            red = reduzir(img, fator)
            ax, ay = ax / fator, ay / fator
            # recorta o que tem alguma coisa
            ys, xs = np.nonzero(red[..., 3] > 0)
            x0, x1, y0, y1 = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1
            red = red[y0:y1, x0:x1]
            arq = f'giro-{rot}{sufixo}.png'
            Image.fromarray(red, 'RGBA').save(os.path.join(pasta, arq), optimize=True)
            out[str(rot)] = {'arquivo': f'{nome}/{arq}', 'ax': round(ax - x0, 1), 'ay': round(ay - y0, 1)}
            print(f'{nome} giro {rot}{sufixo}: {red.shape[1]}x{red.shape[0]}', flush=True)
        return out

    ent = {'escala': 1 / SAIDA, 'giros': vistas(modelo), 'real': [round(u1 - u0, 3), round(v1 - v0, 3), round(alto, 3)], 'exato': True, 'codigo': True}
    if estados:
        ent['estados'] = {k: {'giros': vistas(m, f'-{k}', k)} for k, m in estados.items()}
    return ent


def main():
    global DESTINO
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    codex = '--codex' in sys.argv
    if '--destino' in sys.argv:
        # gerar noutra pasta (para comparar), com uma cópia do moveis.json
        alvo = os.path.abspath(sys.argv[sys.argv.index('--destino') + 1])
        os.makedirs(alvo, exist_ok=True)
        if not os.path.exists(os.path.join(alvo, 'moveis.json')):
            import shutil
            shutil.copy(os.path.join(DESTINO, 'moveis.json'), os.path.join(alvo, 'moveis.json'))
        FOLHAS = os.path.join(DESTINO, 'folhas')
        DESTINO = alvo
        if not os.path.exists(os.path.join(alvo, 'folhas')):
            os.symlink(FOLHAS, os.path.join(alvo, 'folhas'))
    nomes = [a for a in args if a != sys.argv[sys.argv.index('--destino') + 1]] if '--destino' in sys.argv else args
    nomes = nomes or list(MOVEIS)
    arq = os.path.join(DESTINO, 'moveis.json')
    lista = json.load(open(arq, encoding='utf-8'))
    for n in nomes:
        novo = exportar(n, codex, '--caixa' in sys.argv)
        # a vista de cima (mapa tático) que já existia continua até termos a nossa
        if n in lista and 'cima' in lista[n]:
            novo['cima'] = lista[n]['cima']
        lista[n] = novo
    with open(arq, 'w', encoding='utf-8') as f:
        json.dump(lista, f, ensure_ascii=False, indent=1)
        f.write('\n')


if __name__ == '__main__':
    main()
