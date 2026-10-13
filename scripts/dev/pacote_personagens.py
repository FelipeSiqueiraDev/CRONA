"""
O pacote de referência dos personagens para o Códex das animações (07/10).

Monta, em F:/Dhellow/CRONA/arte/PERSONAGENS-ANIMACAO/:
- referencias/agentes/<nome>/: a base desarmada APROVADA de cada agente (as poses paradas do jogo,
  client/public/arte/personagens/<nome>/tabuleiro-32bits/idle-desarmado-<dir>.png) normalizada no
  formato novo: quadro 1024x768, 480 px de altura em pé, o meio entre as solas das duas botas em
  (512, 640), o centro do losango da casa. Uma imagem por direção (vistas/desarmado-<dir>.png), a
  folha 4x2 (4096x1536) e a folha com as guias. Mais o retrato e a folha pintada antiga.
- gabaritos/: o quadro (com o losango da casa e as réguas de porta, balcão, mesa e assento na
  mesma escala), a folha das 8 direções e as tiras (4, 5, 6 e 8 quadros), com as guias; a câmera
  dos móveis; e maos-por-direcao.png (de que lado fica a mão direita e qual braço fica perto da
  câmera em cada direção, com a Catarina de exemplo).
- referencias/estilo/ e referencias/rascunhos-reprovados/: cópias do que já existe.
- ferramentas/conferir_quadros.py: a conferência (cópia de scripts/dev/conferir_quadros.py).

Uso: python scripts/dev/pacote_personagens.py
"""
import os
import shutil

import fitz
import numpy as np

REPO = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
ARTE = os.path.join(REPO, 'client', 'public', 'arte', 'personagens')
BASE = r'F:\Dhellow\CRONA\arte\TEXTURAS MAPA\BASE - Ordo Realitas'
CODEX = r'C:\Users\felip\Documents\Codex\2026-10-04\leia-o-prompt-personagens-txt-na\outputs\continuacao-06-10'
SAIDA = r'F:\Dhellow\CRONA\arte\PERSONAGENS-ANIMACAO'

AGENTES = ['tepes', 'catarina', 'alosi', 'cora-falcao']
NOME = {'tepes': 'D. Tepes', 'catarina': 'Catarina Albuquerque', 'alosi': 'Alosi Walker', 'cora-falcao': 'Cora Falcão'}
ORDEM = [['n', 'ne', 'e', 'se'], ['s', 'sw', 'w', 'nw']]
ROTULO = {
    'n': 'N - de costas',
    'ne': 'NE - costas, virado p/ a direita',
    'e': 'E - perfil, olhando p/ a direita',
    'se': 'SE - frente, virado p/ a direita',
    's': 'S - de frente',
    'sw': 'SW - frente, virado p/ a esquerda',
    'w': 'W - perfil, olhando p/ a esquerda',
    'nw': 'NW - costas, virado p/ a esquerda',
}
# a mão direita DO PERSONAGEM: de que lado da imagem ela aparece, e qual braço fica perto da câmera
MAOS = {
    'n': ('D aparece do lado DIREITO da imagem', 'os dois braços à vista (nenhum na frente do corpo)'),
    'ne': ('D aparece do lado DIREITO da imagem', 'braço PERTO = DIREITO; o esquerdo fica atrás do corpo'),
    'e': ('D é o braço da frente (inteiro)', 'braço PERTO = DIREITO; o esquerdo fica atrás do corpo'),
    'se': ('D aparece do lado ESQUERDO da imagem', 'braço PERTO = DIREITO; o esquerdo fica atrás do corpo'),
    's': ('D aparece do lado ESQUERDO da imagem', 'os dois braços à vista (nenhum na frente do corpo)'),
    'sw': ('D aparece do lado ESQUERDO da imagem, atrás', 'braço PERTO = ESQUERDO; o direito fica atrás do corpo'),
    'w': ('E é o braço da frente (inteiro)', 'braço PERTO = ESQUERDO; o direito fica atrás do corpo'),
    'nw': ('D aparece do lado DIREITO da imagem, atrás', 'braço PERTO = ESQUERDO; o direito fica atrás do corpo'),
}

QW, QH = 1024, 768  # o quadro
ALTURA = 480  # o personagem em pé, do alto do cabelo à sola
AX, AY = 512, 640  # a âncora: o meio entre as solas das duas botas = o centro da casa
CABECA = AY - ALTURA  # 160
# a casa do chão (0,75 m) na escala do personagem (1,80 m = 480 px): no tabuleiro a casa tem 64 px
# de largura e a pessoa 94 px de altura, então o losango tem 480 * 64 / 94 = 327 px de largura
CASA_L = 480 * 64 / 94
CASA_A = CASA_L / 2
PX_M = ALTURA / 1.80  # 266,7 px por metro
REGUAS = [('porta 2,15 m', 2.15), ('balcão 1,10 m', 1.10), ('mesa 0,78 m', 0.78), ('assento 0,46 m', 0.46)]


def ler(caminho):
    p = fitz.Pixmap(caminho)
    if p.n - p.alpha < 3:
        p = fitz.Pixmap(fitz.csRGB, p)
    if not p.alpha:
        p = fitz.Pixmap(p, 1)
    return p


def arr(p):
    return np.frombuffer(p.samples, dtype=np.uint8).reshape(p.height, p.width, p.n).copy()


def pix(a):
    a = np.ascontiguousarray(a)
    return fitz.Pixmap(fitz.csRGB, a.shape[1], a.shape[0], a.tobytes(), True)


def pes(a):
    """Os dois pés, como o jogo acha (pesPontos, em client/src/render/sprites.ts): as colunas com
    pixel nos 10% de baixo da figura, separadas no maior vão; de cada grupo, o meio e a sola (o
    pixel mais baixo). Devolve o meio entre as duas solas (x, y)."""
    m = a[..., 3] > 40
    ys, xs = np.nonzero(m)
    y1 = ys.max()
    h = y1 - ys.min() + 1
    baixo = m[y1 - int(h * 0.10):y1 + 1]
    cols = np.nonzero(baixo.any(axis=0))[0]
    if len(cols) < 2:
        return (xs.min() + xs.max()) / 2, float(y1)
    vaos = np.diff(cols)
    i = int(vaos.argmax())
    if vaos[i] <= 3:
        return (cols.min() + cols.max()) / 2, float(y1)
    px, py = [], []
    for g in (cols[:i + 1], cols[i + 1:]):
        px.append((g.min() + g.max()) / 2)
        col = m[:, g.min():g.max() + 1].any(axis=1)
        py.append(float(np.nonzero(col)[0].max()))
    return sum(px) / 2, sum(py) / 2


def normalizar(caminho):
    """A pose no quadro novo: 480 px de altura, o meio entre as solas em (512, 640)."""
    a = arr(ler(caminho))
    m = a[..., 3] > 40
    ys, xs = np.nonzero(m)
    y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
    k = ALTURA / (y1 - y0)
    w, h = max(1, round((x1 - x0) * k)), ALTURA
    esc = arr(fitz.Pixmap(pix(a[y0:y1, x0:x1]), w, h, None))
    fx, fy = pes(esc)
    q = np.zeros((QH, QW, 4), dtype=np.uint8)
    ox, oy = int(round(AX - fx)), int(round(AY - fy))
    xa, xb = max(0, ox), min(QW, ox + w)
    ya, yb = max(0, oy), min(QH, oy + h)
    q[ya:yb, xa:xb] = esc[ya - oy:yb - oy, xa - ox:xb - ox]
    return q, int(y1 - y0)


def folha(quadros, fundo=None):
    """A folha 4x2 (4096x1536) na ordem n, ne, e, se / s, sw, w, nw."""
    f = np.zeros((QH * 2, QW * 4, 4), dtype=np.uint8)
    if fundo is not None:
        f[...] = fundo
    for r, linha in enumerate(ORDEM):
        for c, d in enumerate(linha):
            q = quadros[d]
            y, x = r * QH, c * QW
            al = q[..., 3:4].astype(np.float32) / 255
            base = f[y:y + QH, x:x + QW].astype(np.float32)
            f[y:y + QH, x:x + QW, :3] = (q[..., :3] * al + base[..., :3] * (1 - al)).astype(np.uint8)
            f[y:y + QH, x:x + QW, 3] = np.maximum(f[y:y + QH, x:x + QW, 3], q[..., 3])
    return f


def gravar(a, caminho):
    os.makedirs(os.path.dirname(caminho), exist_ok=True)
    pix(a).save(caminho)


def guias_pdf(largura, altura, celulas, titulo, rotulos=None, imagem=None, reguas=False):
    """Uma página com as guias de cada célula: o quadro, o losango da casa com a âncora no meio, a
    linha do alto da cabeça, o eixo do meio e (no gabarito do quadro) as réguas dos móveis na mesma
    escala; e os rótulos. Devolve o PNG renderizado (fundo cinza, para ver as linhas e o personagem)."""
    doc = fitz.open()
    faixa = 46 if titulo else 0
    pg = doc.new_page(width=largura, height=altura + faixa)
    pg.draw_rect(pg.rect, color=None, fill=(0.29, 0.30, 0.33))
    if imagem is not None:
        pg.insert_image(fitz.Rect(0, 0, largura, altura), pixmap=pix(imagem))
    for i, (x, y) in enumerate(celulas):
        pg.draw_rect(fitz.Rect(x, y, x + QW, y + QH), color=(0.85, 0.8, 0.7), width=2)
        cx, cy = x + AX, y + AY
        losango = [(cx - CASA_L / 2, cy), (cx, cy - CASA_A / 2), (cx + CASA_L / 2, cy), (cx, cy + CASA_A / 2)]
        pg.draw_polyline(losango + [losango[0]], color=(0.95, 0.75, 0.3), width=2)
        pg.draw_circle((cx, cy), 6, color=(0.9, 0.15, 0.1), fill=(0.9, 0.15, 0.1))
        pg.draw_line((x, y + CABECA), (x + QW, y + CABECA), color=(0.2, 0.55, 1), width=1.5, dashes='[10 8] 0')
        pg.draw_line((cx, y + 40), (cx, y + QH - 20), color=(0.25, 0.85, 0.35), width=1, dashes='[5 8] 0')
        pg.insert_text((x + 14, y + 32), (rotulos[i] if rotulos else f'quadro {i + 1}'), fontsize=26, color=(1, 0.86, 0.5), fontname='helv')
        pg.insert_text((x + 14, y + CABECA - 10), 'alto da cabeça: y = 160 (480 px de altura)', fontsize=18, color=(0.55, 0.75, 1), fontname='helv')
        pg.insert_text((cx + 14, cy + 6), 'âncora (512, 640): o meio entre as duas solas', fontsize=18, color=(1, 0.5, 0.45), fontname='helv')
        pg.insert_text((cx - CASA_L / 2, cy + CASA_A / 2 + 30), 'a casa do chão (0,75 m), vista do tabuleiro', fontsize=18, color=(0.95, 0.75, 0.3), fontname='helv')
        if reguas:
            for j, (nome, m) in enumerate(REGUAS):
                rx = x + 50 + j * 78
                topo = cy - m * PX_M
                pg.draw_line((rx, cy), (rx, topo), color=(0.85, 0.85, 0.85), width=6)
                pg.draw_line((rx - 14, topo), (rx + 14, topo), color=(0.85, 0.85, 0.85), width=3)
                pg.insert_text((rx - 30, topo - 12), nome, fontsize=15, color=(0.92, 0.92, 0.92), fontname='helv')
            px = x + QW - 70
            pg.draw_line((px, cy), (px, cy - ALTURA), color=(1, 0.86, 0.5), width=6)
            pg.insert_text((px - 84, cy - ALTURA - 12), 'pessoa 1,80 m', fontsize=15, color=(1, 0.86, 0.5), fontname='helv')
    if titulo:
        pg.insert_text((16, altura + 31), titulo, fontsize=22, color=(1, 1, 1), fontname='helv')
    out = arr(pg.get_pixmap(alpha=False))
    if out.shape[2] == 3:
        out = np.concatenate([out, np.full(out.shape[:2] + (1,), 255, np.uint8)], axis=2)
    return out


def main():
    os.makedirs(SAIDA, exist_ok=True)
    alturas = {}
    exemplo = None
    for nome in AGENTES:
        dst = os.path.join(SAIDA, 'referencias', 'agentes', nome)
        if os.path.isdir(os.path.join(dst, 'vistas')):
            shutil.rmtree(os.path.join(dst, 'vistas'))
        quadros = {}
        alturas[nome] = {}
        for linha in ORDEM:
            for d in linha:
                q, h = normalizar(os.path.join(ARTE, nome, 'tabuleiro-32bits', f'idle-desarmado-{d}.png'))
                quadros[d] = q
                alturas[nome][d] = h
                gravar(q, os.path.join(dst, 'vistas', f'desarmado-{d}.png'))
        gravar(folha(quadros), os.path.join(dst, f'{nome}-base-desarmado-8-direcoes.png'))
        cel = [(c * QW, r * QH) for r in range(2) for c in range(4)]
        rot = [ROTULO[d] for linha in ORDEM for d in linha]
        titulo = f'{NOME[nome]}: a base desarmada APROVADA, no quadro novo (1024x768, 480 px de altura, âncora em 512, 640)'
        gravar(guias_pdf(QW * 4, QH * 2, cel, titulo, rot, folha(quadros, fundo=(75, 77, 84, 255))), os.path.join(dst, f'{nome}-base-desarmado-com-guias.png'))
        shutil.copyfile(os.path.join(ARTE, nome, 'retrato-desarmado.png'), os.path.join(dst, f'{nome}-retrato.png'))
        folha_antiga = os.path.join(BASE, 'gabaritos', 'agentes', f'{nome}-folha.webp')
        if os.path.exists(folha_antiga):
            shutil.copyfile(folha_antiga, os.path.join(dst, f'{nome}-folha-pintada-antiga.webp'))
        if nome == 'catarina':
            exemplo = quadros
    # os gabaritos
    gab = os.path.join(SAIDA, 'gabaritos')
    if os.path.isdir(gab):
        shutil.rmtree(gab)
    os.makedirs(gab)
    fundo_cinza = np.zeros((QH, QW, 4), np.uint8)
    q = exemplo['se']
    al = q[..., 3:4].astype(np.float32) / 255
    fundo_cinza[..., :3] = (q[..., :3] * al + np.array([75, 77, 84]) * (1 - al)).astype(np.uint8)
    fundo_cinza[..., 3] = 255
    gravar(guias_pdf(QW, QH, [(0, 0)], 'o quadro: 1024 x 768 (a Catarina de exemplo, na escala dos móveis)', ['o quadro: 1024 x 768'], fundo_cinza, reguas=True), os.path.join(gab, 'gabarito-quadro-1024x768.png'))
    cel = [(c * QW, r * QH) for r in range(2) for c in range(4)]
    gravar(guias_pdf(QW * 4, QH * 2, cel, 'a folha das 8 direções: 4096 x 1536, nesta ordem', [ROTULO[d] for linha in ORDEM for d in linha]), os.path.join(gab, 'gabarito-folha-8-direcoes-4096x1536.png'))
    for n in (4, 5, 6, 8):
        gravar(guias_pdf(QW * n, QH, [(i * QW, 0) for i in range(n)], f'a tira de {n} quadros: {QW * n} x {QH}, os quadros lado a lado, na ordem', [f'quadro {i + 1}' for i in range(n)]), os.path.join(gab, f'gabarito-tira-{n}-quadros.png'))
    camera = os.path.join(BASE, 'gabaritos', 'gabarito-camera-4-vistas.png')
    if os.path.exists(camera):
        shutil.copyfile(camera, os.path.join(gab, 'gabarito-camera-dos-moveis.png'))
    # as mãos em cada direção, com a Catarina
    doc = fitz.open()
    W, H = QW * 4, QH * 2 + 220
    pg = doc.new_page(width=W, height=H)
    pg.draw_rect(pg.rect, color=None, fill=(0.29, 0.30, 0.33))
    pg.insert_image(fitz.Rect(0, 0, QW * 4, QH * 2), pixmap=pix(folha(exemplo, fundo=(75, 77, 84, 255))))
    for r, linha in enumerate(ORDEM):
        for c, d in enumerate(linha):
            x, y = c * QW, r * QH
            pg.draw_rect(fitz.Rect(x, y, x + QW, y + QH), color=(0.85, 0.8, 0.7), width=2)
            pg.insert_text((x + 14, y + 34), ROTULO[d], fontsize=26, color=(1, 0.86, 0.5), fontname='helv')
            lado, perto = MAOS[d]
            pg.insert_text((x + 14, y + QH - 44), lado, fontsize=21, color=(1, 1, 1), fontname='helv')
            pg.insert_text((x + 14, y + QH - 16), perto, fontsize=21, color=(0.6, 1, 0.65), fontname='helv')
    pg.insert_textbox(fitz.Rect(18, QH * 2 + 18, W - 18, H - 10),
                      'DIREITA (D) e ESQUERDA (E) são SEMPRE do personagem, nunca da imagem. A câmera fica embaixo da tela, olhando um pouco de cima. '
                      'De frente (S) é como num espelho: a mão D do personagem aparece do lado ESQUERDO da imagem. De costas (N), do lado DIREITO. '
                      'Virado para a direita da tela (NE, E, SE), o braço DIREITO é o de perto da câmera (inteiro, na frente do corpo). '
                      'Virado para a esquerda da tela (NW, W, SW), o de perto é o ESQUERDO, e o direito fica atrás do corpo, meio escondido. '
                      'NUNCA espelhe uma direção para fazer outra: a arma troca de mão no espelho.',
                      fontsize=24, color=(1, 1, 1), fontname='helv')
    out = arr(pg.get_pixmap(alpha=False))
    gravar(np.concatenate([out, np.full(out.shape[:2] + (1,), 255, np.uint8)], axis=2), os.path.join(gab, 'maos-por-direcao.png'))
    # o estilo e o que já existe
    est = os.path.join(SAIDA, 'referencias', 'estilo')
    os.makedirs(est, exist_ok=True)
    for arq in ('cena-referencia-laboratorio.png', 'chibi-referencia-corpo.png', 'equipe-hydra-referencia.webp'):
        o = os.path.join(BASE, 'gabaritos', 'agentes', arq)
        if os.path.exists(o):
            shutil.copyfile(o, os.path.join(est, arq))
    rasc = os.path.join(SAIDA, 'referencias', 'rascunhos-reprovados')
    os.makedirs(rasc, exist_ok=True)
    if os.path.isdir(os.path.join(CODEX, 'armados')):
        for arq in os.listdir(os.path.join(CODEX, 'armados')):
            if arq.endswith('.png'):
                shutil.copyfile(os.path.join(CODEX, 'armados', arq), os.path.join(rasc, arq))
    rev = os.path.join(BASE, 'Personagens', 'revisao-maos-07-10', 'LEIA-ME-REVISAO.txt')
    if os.path.exists(rev):
        shutil.copyfile(rev, os.path.join(rasc, 'REVISAO-DAS-MAOS.txt'))
    fer = os.path.join(SAIDA, 'ferramentas')
    os.makedirs(fer, exist_ok=True)
    conf = os.path.join(REPO, 'scripts', 'dev', 'conferir_quadros.py')
    if os.path.exists(conf):
        shutil.copyfile(conf, os.path.join(fer, 'conferir_quadros.py'))
    os.makedirs(os.path.join(SAIDA, 'entregas'), exist_ok=True)
    for nome, hs in alturas.items():
        print(nome, 'altura de origem por direção:', hs)
    print('pronto:', SAIDA)


if __name__ == '__main__':
    main()
