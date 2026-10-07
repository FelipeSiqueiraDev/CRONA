"""
A conferência das entregas de personagem do CRONA (o Códex roda antes de entregar; o Claude roda
quando recebe). Mede o que dá para medir e lista, direção por direção, o que tem que ser conferido
de olho (a arma, a mão, o lado).

Uso:
    python conferir_quadros.py <pasta ou arquivos .png> [--referencias <pasta>] [--saida <pasta>]

--referencias: a pasta referencias/agentes do pacote (o padrão é ../referencias/agentes, ao lado
desta pasta de ferramentas). Dela saem as bases aprovadas, que aparecem como "fantasma" nas prévias.

Nomes que ele entende (ver LEIA-PRIMEIRO.md):
    <agente>-<estado>-8-direcoes.png             a folha das 8 direções (4096x1536, grade 4x2)
    <agente>-<animacao>-<estado>-<direcao>.png   uma tira (os quadros de 1024x768 lado a lado)
    agente: tepes, catarina, alosi, cora-falcao   estado: desarmado, armado
    direção: n, ne, e, se, s, sw, w, nw

Grava na pasta de saída (o padrão é a pasta conferida + /conferencia):
    conferencia.json   todas as medidas, quadro a quadro, e o veredito (ok / aviso / erro)
    conferencia.txt    o resumo e a lista do que conferir de olho
    previa-<arquivo>.png   os quadros sobre cinza, com as guias (o losango, a âncora, a linha da
                           cabeça) e a base aprovada daquela direção como fantasma, para comparar

Precisa de numpy e de Pillow (ou PyMuPDF).
"""
import argparse
import glob
import json
import os
import re
import sys

import numpy as np

QW, QH = 1024, 768
ALTURA = 480
AX, AY = 512, 640
CASA_L = 480 * 64 / 94
DIRECOES = ['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw']
GRADE = [['n', 'ne', 'e', 'se'], ['s', 'sw', 'w', 'nw']]
OPOSTA = {'ne': 'nw', 'nw': 'ne', 'e': 'w', 'w': 'e', 'se': 'sw', 'sw': 'se'}
AGENTES = ['tepes', 'catarina', 'alosi', 'cora-falcao']
# quantos quadros cada animação tem, e se o personagem fica em pé (a altura e os pés são medidos)
ANIMACOES = {
    'parado': (4, 'pe'),
    'piscar': (1, 'pe'),
    'andar': (8, 'andar'),
    'abrir': (6, 'pe'),
    'pegar': (6, 'livre'),
    'atacar': (6, 'pe'),
    'dano': (4, 'pe'),
    'sacar': (5, 'pe'),
    'guardar': (5, 'pe'),
    'cair': (5, 'livre'),
    'caido': (1, 'livre'),
}

# o que conferir de olho: a arma e a mão de cada agente, por estado e direção (D/E = do personagem)
PERTO = {'n': None, 's': None, 'ne': 'D', 'e': 'D', 'se': 'D', 'nw': 'E', 'w': 'E', 'sw': 'E'}
LADO_D = {'n': 'à DIREITA da imagem', 'ne': 'à DIREITA da imagem', 's': 'à ESQUERDA da imagem', 'se': 'à ESQUERDA da imagem',
          'sw': 'à ESQUERDA da imagem, atrás do corpo', 'nw': 'à DIREITA da imagem, atrás do corpo', 'e': 'na frente do corpo', 'w': 'atrás do corpo'}
ARMAS = {
    'catarina': {
        'desarmado': 'a katana NA BAINHA, nas costas: o cabo com a guarda dourada atrás do ombro D, a bainha em diagonal até o quadril E; as duas mãos vazias.',
        'armado': 'a katana desembainhada na mão D (lâmina abaixada, ponta perto do chão, à frente do pé D); a mão E vazia; a bainha VAZIA continua nas costas, na mesma diagonal (sem o cabo no ombro).',
        'mao': 'D',
    },
    'cora-falcao': {
        'desarmado': 'o fuzil nas costas, pendurado pela alça, na diagonal: o cano para cima atrás do ombro D, a coronha embaixo, perto do quadril E; as duas mãos vazias.',
        'armado': 'o fuzil nas DUAS mãos, cano abaixado para a frente: a mão D no punho (o gatilho), a mão E no guarda-mão, À FRENTE do carregador; a alça solta.',
        'mao': 'D',
    },
    'tepes': {
        'desarmado': 'NADA na mão nem guardado: sem escudo e sem corrente.',
        'armado': 'o escudo pequeno e redondo no ANTEBRAÇO E, na frente do corpo; a corrente grossa enrolada no ANTEBRAÇO D (4 voltas) e UMA só ponta solta caindo da mão D até perto do alto da bota, sem nada na ponta.',
        'mao': 'D',
    },
    'alosi': {
        'desarmado': 'o códex FECHADO, preso ao cinto do lado D por uma corrente curta (pendurado no quadril D); as duas mãos vazias.',
        'armado': 'o códex ABERTO na mão E, as páginas viradas para ele; a mão D livre (aberta, pronta para o ritual); a corrente continua presa ao cinto do lado D, VAZIA.',
        'mao': 'E',
    },
}


# ------------------------------------------------------------------ imagens
def abrir(caminho):
    try:
        from PIL import Image

        return np.array(Image.open(caminho).convert('RGBA'))
    except ImportError:
        import fitz

        p = fitz.Pixmap(caminho)
        if p.n - p.alpha < 3:
            p = fitz.Pixmap(fitz.csRGB, p)
        if not p.alpha:
            p = fitz.Pixmap(p, 1)
        return np.frombuffer(p.samples, dtype=np.uint8).reshape(p.height, p.width, 4).copy()


def salvar(a, caminho):
    a = np.ascontiguousarray(a.astype(np.uint8))
    try:
        from PIL import Image

        Image.fromarray(a, 'RGBA').save(caminho)
    except ImportError:
        import fitz

        fitz.Pixmap(fitz.csRGB, a.shape[1], a.shape[0], a.tobytes(), True).save(caminho)


def linha(img, x0, y0, x1, y1, cor, esp=2):
    n = int(max(abs(x1 - x0), abs(y1 - y0))) + 1
    for t in np.linspace(0, 1, n):
        x, y = int(round(x0 + (x1 - x0) * t)), int(round(y0 + (y1 - y0) * t))
        img[max(0, y - esp // 2):y + esp // 2 + 1, max(0, x - esp // 2):x + esp // 2 + 1] = cor


def ponto(img, x, y, r, cor):
    yy, xx = np.ogrid[:img.shape[0], :img.shape[1]]
    img[(xx - x) ** 2 + (yy - y) ** 2 <= r * r] = cor


def sobre(fundo, q, opacidade=1.0):
    al = q[..., 3:4].astype(np.float32) / 255 * opacidade
    fundo[..., :3] = (q[..., :3] * al + fundo[..., :3] * (1 - al)).astype(np.uint8)


# ------------------------------------------------------------------ medidas
def pes(m):
    """O meio entre as solas das duas botas (como o jogo acha)."""
    ys, xs = np.nonzero(m)
    y1 = ys.max()
    h = y1 - ys.min() + 1
    cols = np.nonzero(m[y1 - int(h * 0.10):y1 + 1].any(axis=0))[0]
    if len(cols) < 2:
        return float((xs.min() + xs.max()) / 2), float(y1), False
    vaos = np.diff(cols)
    i = int(vaos.argmax())
    if vaos[i] <= 3:
        return float((cols.min() + cols.max()) / 2), float(y1), False
    px, py = [], []
    for g in (cols[:i + 1], cols[i + 1:]):
        px.append((g.min() + g.max()) / 2)
        py.append(float(np.nonzero(m[:, g.min():g.max() + 1].any(axis=1))[0].max()))
    return sum(px) / 2, sum(py) / 2, True


def medir(q, modo, direcao=None):
    """As medidas de um quadro e os problemas achados."""
    al = q[..., 3]
    m = al > 40
    r = {'vazio': not m.any()}
    problemas = []
    if r['vazio']:
        return r, ['quadro vazio']
    ys, xs = np.nonzero(m)
    r.update(x0=int(xs.min()), y0=int(ys.min()), x1=int(xs.max()), y1=int(ys.max()), altura=int(ys.max() - ys.min() + 1))
    fx, fy, dois = pes(m)
    r.update(pes_x=round(fx, 1), pes_y=round(fy, 1), dois_pes_separados=dois)
    # o fundo e a borda
    if (al[0, 0] or al[0, -1] or al[-1, 0] or al[-1, -1]) > 10:
        problemas.append('ERRO: o fundo não é transparente (os cantos do quadro têm cor)')
    borda = np.concatenate([al[0, :], al[-1, :], al[:, 0], al[:, -1]])
    if (borda > 40).any():
        problemas.append('ERRO: o personagem encosta na borda do quadro (cortado)')
    # halo claro em volta (o fundo branco que sobrou)
    semi = (al > 8) & (al < 200)
    claro = semi & (q[..., :3].min(axis=2) > 200)
    if semi.sum() and claro.sum() / max(1, semi.sum()) > 0.15:
        problemas.append(f'AVISO: halo claro em volta ({int(claro.sum())} pixels quase transparentes e claros); limpe a borda')
    if modo in ('pe', 'andar'):
        tol_h = 0.02 if modo == 'pe' else 0.03
        if abs(r['altura'] - ALTURA) > ALTURA * tol_h:
            problemas.append(f"ERRO: altura {r['altura']} px (o certo é {ALTURA} ± {int(ALTURA * tol_h)})")
        if abs(fx - AX) > 10:
            problemas.append(f'ERRO: o meio dos pés está em x={fx:.0f} (o certo é {AX} ± 10)')
        if modo == 'pe' and abs(fy - AY) > 8:
            problemas.append(f'ERRO: o meio das solas está em y={fy:.0f} (o certo é {AY} ± 8)')
        if modo == 'andar' and not (AY - 12 <= r['y1'] <= AY + 30):
            problemas.append(f"ERRO: a sola mais baixa está em y={r['y1']} (o pé de apoio pisa perto de y={AY})")
        if modo == 'pe' and not dois and direcao not in ('e', 'w'):
            problemas.append('AVISO: não achei os dois pés separados (as botas precisam aparecer separadas, cada sola à vista)')
    return r, problemas


def quadros_da_tira(img):
    h, w = img.shape[:2]
    if h != QH or w % QW:
        return None, f'ERRO: a tira tem {w}x{h}; o certo é N x 1024 de largura por 768 de altura'
    return [img[:, i * QW:(i + 1) * QW] for i in range(w // QW)], None


def quadros_da_folha(img):
    h, w = img.shape[:2]
    if (w, h) != (QW * 4, QH * 2):
        return None, f'ERRO: a folha tem {w}x{h}; o certo é 4096x1536 (4x2 quadros de 1024x768)'
    return {d: img[r * QH:(r + 1) * QH, c * QW:(c + 1) * QW] for r, lin in enumerate(GRADE) for c, d in enumerate(lin)}, None


def parecido(a, b):
    """0 = igual, 1 = nada a ver: a diferença média nos pixels do corpo (para achar espelho)."""
    m = (a[..., 3] > 40) | (b[..., 3] > 40)
    if not m.any():
        return 1.0
    return float(np.abs(a[m].astype(np.int16) - b[m].astype(np.int16)).mean() / 255)


def previa(quadros, fantasmas):
    """Os quadros lado a lado, sobre cinza, com o fantasma da base e as guias."""
    n = len(quadros)
    img = np.zeros((QH, QW * n, 4), dtype=np.uint8)
    img[...] = (74, 76, 83, 255)
    for i, q in enumerate(quadros):
        cel = img[:, i * QW:(i + 1) * QW]
        if fantasmas and fantasmas[i] is not None:
            sobre(cel, fantasmas[i], 0.28)
        sobre(cel, q)
        cx, cy = AX, AY
        l, a = CASA_L / 2, CASA_L / 4
        for (xa, ya), (xb, yb) in [((cx - l, cy), (cx, cy - a)), ((cx, cy - a), (cx + l, cy)), ((cx + l, cy), (cx, cy + a)), ((cx, cy + a), (cx - l, cy))]:
            linha(cel, xa, ya, xb, yb, (242, 190, 76, 255))
        linha(cel, 0, AY - ALTURA, QW - 1, AY - ALTURA, (70, 140, 255, 255), 1)
        ponto(cel, cx, cy, 6, (230, 40, 30, 255))
        linha(cel, 0, 0, 0, QH - 1, (220, 205, 180, 255), 2)
    return img


def base_do_agente(refs, agente, direcao):
    for estado in ('armado', 'desarmado'):
        f = os.path.join(refs, agente, 'vistas', f'{estado}-{direcao}.png')
        if os.path.exists(f):
            return abrir(f)
    return None


def main():
    ap = argparse.ArgumentParser(description='Confere as entregas de personagem do CRONA.')
    ap.add_argument('alvos', nargs='+')
    ap.add_argument('--referencias', default=os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'referencias', 'agentes'))
    ap.add_argument('--saida')
    a = ap.parse_args()
    arquivos = []
    for alvo in a.alvos:
        arquivos += sorted(glob.glob(os.path.join(alvo, '**', '*.png'), recursive=True)) if os.path.isdir(alvo) else [alvo]
    arquivos = [f for f in arquivos if not os.path.basename(f).startswith('previa-')]
    if not arquivos:
        sys.exit('nenhuma PNG para conferir')
    saida = a.saida or os.path.join(os.path.dirname(arquivos[0]) if not os.path.isdir(a.alvos[0]) else a.alvos[0], 'conferencia')
    os.makedirs(saida, exist_ok=True)
    rel = {'arquivos': []}
    olho = []
    primeiros = {}
    for f in arquivos:
        nome = os.path.basename(f)
        item = {'arquivo': nome, 'problemas': [], 'quadros': []}
        rel['arquivos'].append(item)
        mf = re.fullmatch(r'(tepes|catarina|alosi|cora-falcao)-(desarmado|armado)-8-direcoes\.png', nome)
        mt = re.fullmatch(r'(tepes|catarina|alosi|cora-falcao)-([a-z]+)-(desarmado|armado)-(n|ne|e|se|s|sw|w|nw)\.png', nome)
        img = abrir(f)
        if mf:
            agente, estado = mf.groups()
            qs, erro = quadros_da_folha(img)
            if erro:
                item['problemas'].append(erro)
                continue
            fant = []
            for d in DIRECOES:
                med, probs = medir(qs[d], 'pe', d)
                item['quadros'].append({'direcao': d, **med, 'problemas': probs})
                primeiros[(agente, 'folha', estado, d)] = qs[d]
                fant.append(base_do_agente(a.referencias, agente, d))
                olho.append(f'[ ] {agente} {estado} {d.upper()}: {ARMAS[agente][estado]} (aqui a mão D aparece {LADO_D[d]}; braço de perto: {PERTO[d] or "nenhum"})')
            salvar(previa([qs[d] for d in DIRECOES], fant), os.path.join(saida, f'previa-{nome}'))
        elif mt:
            agente, anim, estado, d = mt.groups()
            if anim not in ANIMACOES:
                item['problemas'].append(f'ERRO: animação "{anim}" desconhecida; as que existem: {", ".join(ANIMACOES)}')
                continue
            esperado, modo = ANIMACOES[anim]
            qs, erro = quadros_da_tira(img)
            if erro:
                item['problemas'].append(erro)
                continue
            if len(qs) != esperado:
                item['problemas'].append(f'ERRO: {len(qs)} quadros; {anim} tem {esperado}')
            alturas = []
            for i, q in enumerate(qs):
                med, probs = medir(q, modo, d)
                item['quadros'].append({'quadro': i + 1, **med, 'problemas': probs})
                if not med.get('vazio'):
                    alturas.append(med['altura'])
            if modo == 'pe' and alturas and max(alturas) - min(alturas) > ALTURA * 0.03 and anim not in ('atacar', 'dano'):
                item['problemas'].append(f'AVISO: a altura varia {max(alturas) - min(alturas)} px entre os quadros (o corpo "pula")')
            primeiros[(agente, anim, estado, d)] = qs[0]
            base = base_do_agente(a.referencias, agente, d)
            salvar(previa(qs, [base] * len(qs)), os.path.join(saida, f'previa-{nome}'))
            olho.append(f'[ ] {agente} {anim} {estado} {d.upper()}: {ARMAS[agente][estado]} (a mão D aparece {LADO_D[d]}; braço de perto: {PERTO[d] or "nenhum"}); a arma do MESMO tamanho em todos os quadros')
        else:
            item['problemas'].append('ERRO: nome fora do padrão (veja LEIA-PRIMEIRO.md, "Os nomes")')
    # espelho: a direção oposta não pode ser a outra virada
    for (agente, anim, estado, d), q in primeiros.items():
        o = OPOSTA.get(d)
        if o and (agente, anim, estado, o) in primeiros and d < o:
            dif = parecido(q, primeiros[(agente, anim, estado, o)][:, ::-1])
            if dif < 0.04:
                rel['arquivos'].append({'arquivo': f'{agente} {anim} {estado} {d}/{o}', 'problemas': [f'ERRO: {d.upper()} parece {o.upper()} espelhada (diferença {dif:.3f}); desenhe cada direção de verdade'], 'quadros': []})
    # o veredito
    erros = avisos = 0
    linhas = []
    for item in rel['arquivos']:
        todos = item['problemas'] + [f"quadro {q.get('quadro', q.get('direcao'))}: {p}" for q in item['quadros'] for p in q['problemas']]
        e = sum(1 for p in todos if 'ERRO' in p)
        v = sum(1 for p in todos if 'AVISO' in p)
        erros += e
        avisos += v
        item['veredito'] = 'erro' if e else 'aviso' if v else 'ok'
        linhas.append(f"{item['veredito'].upper():6s} {item['arquivo']}")
        linhas += [f'       - {p}' for p in todos]
    rel['erros'], rel['avisos'] = erros, avisos
    rel['conferir_de_olho'] = olho
    with open(os.path.join(saida, 'conferencia.json'), 'w', encoding='utf-8') as fp:
        json.dump(rel, fp, ensure_ascii=False, indent=1)
    texto = '\n'.join(linhas) + f'\n\n{erros} erro(s), {avisos} aviso(s).\n\nCONFIRA DE OLHO (marque cada um no LEIA-ME da entrega):\n' + '\n'.join(olho) + '\n'
    with open(os.path.join(saida, 'conferencia.txt'), 'w', encoding='utf-8') as fp:
        fp.write(texto)
    sys.stdout.reconfigure(encoding='utf-8')
    print(texto)
    print('gravado em', saida)
    sys.exit(1 if erros else 0)


if __name__ == '__main__':
    main()
