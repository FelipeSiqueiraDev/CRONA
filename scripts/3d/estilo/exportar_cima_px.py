"""
A vista de cima (mapa tático) de cada móvel, feita pelo motor de pixel: o mesmo desenho do exportar_px.py (as mesmas
peças, os mesmos materiais e o mesmo acabamento), mas com a câmera reta de cima (motor.camera('cima'), 32 px por
casa). Troca a vista de cima pintada pelo Códex: desde 15/10 o tabuleiro é todo feito por código.

Cada móvel sai com a frente para baixo (o giro 4 do jogo), numa imagem com a pegada inteira e uma margem; a `caixa`
diz onde o móvel está nela (o jogo põe esse recorte no tamanho de verdade, `real`). Os estados que mudam o que se vê
de cima (o baú aberto) vão para `cimaEstados`. A sombra no chão fica com o jogo (mapaTatico.ts), que faz a dele pela
altura do móvel.

No moveis.json: `cima` e `cimaEstados` (o resto do móvel não muda).

Uso: python exportar_cima_px.py [móvel ...] [--grupo modulo] [--destino pasta] [--folha saida.png]
     (sem nome: todos os de ITENS do exportar_px.py, inclusive os dos módulos de pecas_px/)
"""
import json
import os
import sys

import numpy as np
from PIL import Image

import exportar_px as EX
from exportar_px import ITENS, CZ, BE, motor, Cena, Peca, CASA, tela, PECA

MARGEM = 0.3   # metros em volta da pegada (o que passa um pouco dela: o encosto da cadeira, a toalha)


def desenhar_cima(nome, desenho):
    """O móvel visto de cima, frente para baixo: a imagem RGBA e a caixa do móvel nela (ou None se nada aparece)."""
    W, D, (ox, oy), _, _ = ITENS[nome]
    fx, fy = W * CASA, D * CASA
    p = Peca(ox / CASA, oy / CASA, 4, W, D, -ox, -oy)
    PECA['p'] = p
    cantos = np.array([[x, y, 0.0] for x in (ox - MARGEM, ox + fx + MARGEM) for y in (oy - MARGEM, oy + fy + MARGEM)])
    S = tela(cantos)
    x0, y0 = int(np.floor(S[:, 0].min())), int(np.floor(S[:, 1].min()))
    c = Cena(x0, y0, int(np.ceil(S[:, 0].max())) - x0, int(np.ceil(S[:, 1].max())) - y0)
    CZ.c = c
    CZ.pegadas, CZ.luzes, CZ.vidros, CZ.fades, CZ.fades_atras, CZ.lampadas, CZ.itens_peq = [], set(), [], [], [], [], []
    BE.ligar(vars(CZ))
    desenho()
    cor = c.cor.copy()
    nrm, obj, tipo, face, prof, P = c.nrm, c.obj, c.tipo, c.face, c.prof, c.mundoP
    h, w = obj.shape
    Ln = p.local(P)
    X, Y, Z = Ln[..., 0], Ln[..., 1], Ln[..., 2]
    movel = (obj >= 0) & (tipo != 1)
    if not movel.any():
        return None, None
    luz_m = np.isin(obj, list(CZ.luzes))
    # de cima, quase tudo é tampo (a luz chapada igual): a altura dá o volume. O que é alto clareia, o que é baixo
    # (o assento entre os braços, o fundo da gaveta aberta) escurece e puxa para o frio, como no tabuleiro
    alto = np.clip(Z / 1.6, 0, 1)
    f = 0.74 + 0.3 * alto
    f = np.round(f / 0.04) * 0.04
    frio = np.array([-10.0, -4.0, 14.0])
    cor = np.where(luz_m[..., None], cor, cor * f[..., None] + (1 - f[..., None]) * frio)
    # os objetos pequenos nos tampos: a sombrinha de contato (como no exportar_px)
    for (a0, a1, b0, b1, zz) in CZ.itens_peq:
        perto = (np.abs(Z - zz) < 0.012) & (tipo == 3)
        dx = np.maximum(np.maximum(a0 - X, X - a1), 0)
        dy = np.maximum(np.maximum(b0 - Y, Y - b1), 0)
        d = np.hypot(dx, dy)
        som = perto & (d > 0.002) & (d < 0.05) & (X > a0 - 0.01) & (Y > b0 - 0.01)
        cor = np.where(som[..., None], cor * 0.8, cor)
    # a sombra de uma peça na outra, de cima: o que está mais baixo que o vizinho de cima/da esquerda (a luz vem do
    # fundo à esquerda) escurece um degrau, na largura de 2 px
    Zm = np.where(movel, Z, -1.0)
    for dy_, dx_, k in ((-1, -1, 0.8), (-2, -2, 0.88), (-1, 0, 0.86), (0, -1, 0.86)):
        viz = EX._viz(Zm, dy_, dx_, -1.0)
        degrau = movel & (viz > Zm + 0.06)
        cor = np.where(degrau[..., None], cor * k, cor)
    sem_contorno = np.isin(obj, [o for o, v in c.contornos.items() if not v])
    cor = CZ.acabar_px(cor, obj, nrm, face, prof, tipo, luz_m, sem_contorno, movel)
    if CZ.vidros:
        sx = np.arange(w)[None, :] + c.x0
        sy = np.arange(h)[:, None] + c.y0
        reflexo = ((sx - sy) % 17 < 2) | ((sx - sy) % 17 == 4)
        for (a0, a1, b0, b1, z0, z1) in CZ.vidros:
            m = movel & (X > a0) & (X < a1) & (Y > b0) & (Y < b1) & (Z > z0) & (Z < z1)
            cor = np.where(m[..., None], cor * 0.86 + np.array([196.0, 222.0, 226.0]) * 0.14, cor)
            cor = np.where((m & reflexo)[..., None], cor * 0.8 + np.array([240.0, 250.0, 250.0]) * 0.2, cor)
    # a borda de fora do móvel um degrau mais escura: o recorte lê no chão escuro do mapa
    borda = movel & ~(EX._viz(movel, 1, 0, False) & EX._viz(movel, -1, 0, False) & EX._viz(movel, 0, 1, False) & EX._viz(movel, 0, -1, False))
    cor = np.where((borda & ~luz_m)[..., None], cor * 0.62, cor)
    alfa = np.where(movel, 1.0, 0.0)
    # o que passa da viga (a chaminé) some, como no tabuleiro
    for (oid, zf, alto_) in CZ.fades:
        m = (obj == oid) & (Z > zf)
        k = np.ceil(np.clip((Z - zf) / alto_, 0, 1) * 5) / 5
        alfa = np.where(m, alfa * (1 - k), alfa)
    img = np.zeros((h, w, 4))
    img[..., :3] = cor
    img[..., 3] = alfa * 255
    img = np.clip(img, 0, 255).round().astype(np.uint8)
    ys, xs = np.nonzero(img[..., 3] > 0)
    if not len(xs):
        return None, None
    return img, [int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1]


def exportar(nome, destino):
    """Escreve <móvel>/cima.png (e cima-<estado>.png) e devolve o que entra no moveis.json."""
    _, _, _, desenho, estados = ITENS[nome]
    pasta = os.path.join(destino, nome)
    os.makedirs(pasta, exist_ok=True)
    out = {}
    img, caixa = desenhar_cima(nome, desenho)
    if img is None:
        print(f'{nome}: nada visto de cima', flush=True)
        return out
    Image.fromarray(img, 'RGBA').save(os.path.join(pasta, 'cima.png'), optimize=True)
    out['cima'] = {'arquivo': f'{nome}/cima.png', 'caixa': caixa}
    print(f'{nome} cima: {img.shape[1]}x{img.shape[0]}', flush=True)
    ce = {}
    for k, d in (estados or {}).items():
        img_e, caixa_e = desenhar_cima(nome, d)
        if img_e is None or np.array_equal(img_e, img):
            continue
        arq = f'cima-{k}.png'
        Image.fromarray(img_e, 'RGBA').save(os.path.join(pasta, arq), optimize=True)
        ce[k] = {'arquivo': f'{nome}/{arq}', 'caixa': caixa_e}
    if ce:
        out['cimaEstados'] = ce
    return out


def folha(nomes, destino, saida):
    """As vistas de cima em fileiras num chão escuro (para conferir de olho), ampliadas 2x; muitas viram várias folhas."""
    from PIL import ImageDraw
    imgs = []
    for n in nomes:
        arq = os.path.join(destino, n, 'cima.png')
        if os.path.exists(arq):
            imgs.append((n, Image.open(arq)))
    if not imgs:
        return
    LARG, ALT = 1400, 900
    folhas, fileiras, fila, x = [], [], [], 0
    for n, i in imgs:
        cw = max(i.width, 70) + 8
        if x + cw > LARG and fila:
            fileiras.append(fila)
            fila, x = [], 0
        fila.append((n, i, x))
        x += cw
    if fila:
        fileiras.append(fila)
    atual, y = [], 0
    for f in fileiras:
        hf = max(i.height for _, i, _ in f) + 16
        if y + hf > ALT and atual:
            folhas.append(atual)
            atual, y = [], 0
        atual.append((f, y, hf))
        y += hf
    if atual:
        folhas.append(atual)
    base, ext = os.path.splitext(saida)
    for k, fl in enumerate(folhas):
        F = Image.new('RGBA', (LARG, sum(hf for _, _, hf in fl)), (40, 32, 26, 255))
        d = ImageDraw.Draw(F)
        for f, y, hf in fl:
            for n, i, x in f:
                F.alpha_composite(i, (x, y + 14))
                d.text((x, y + 2), n[:14], fill=(230, 215, 190, 255))
        arq = saida if len(folhas) == 1 else f'{base}-{k + 1}{ext}'
        F.resize((F.width * 2, F.height * 2), Image.NEAREST).save(arq)
        print('folha', arq)


def main():
    args = sys.argv[1:]
    saida_folha = None
    if '--folha' in args:
        i = args.index('--folha')
        saida_folha = args[i + 1]
        del args[i:i + 2]
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
    motor.camera('cima')
    arq = os.path.join(destino, 'moveis.json')
    lista = json.load(open(arq, encoding='utf-8')) if os.path.exists(arq) else {}
    falhas = []
    for n in nomes:
        try:
            novo = exportar(n, destino)
        except Exception as e:      # um móvel que o desenho de cima não aguenta não derruba os outros
            falhas.append((n, repr(e)))
            print(f'{n}: FALHOU {e!r}', flush=True)
            continue
        ent = lista.setdefault(n, {})
        ent.pop('cima', None)
        ent.pop('cimaEstados', None)
        ent.update(novo)
    json.dump(lista, open(arq, 'w', encoding='utf-8'), ensure_ascii=False, indent=2)
    print('ok', len(nomes) - len(falhas), 'falhas', len(falhas))
    for n, e in falhas:
        print('  ', n, e)
    if saida_folha:
        folha(nomes, destino, saida_folha)


if __name__ == '__main__':
    main()
