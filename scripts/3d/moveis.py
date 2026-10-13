"""
Móveis do tabuleiro a partir de uma folha de objetos desenhados (fundo transparente,
cada objeto separado, vistos de cima e de lado).

Para cada objeto da folha (contados por linha, da esquerda para a direita), a ficha
diz qual móvel do jogo ele é, quantas casas ele ocupa (W de largura, ao longo da
frente; D de fundo) e de que lado do desenho está a frente. Cada móvel pode trazer a
própria folha ("folha" no móvel); senão vale a da ficha.

- Móvel de caixa (mesa, armário, estante, cama, sinuca...): o desenho nem sempre
  está no ângulo exato do tabuleiro. O script acha o ângulo dele (a caixa do móvel
  que melhor cobre a silhueta), projeta o desenho na caixa e redesenha a caixa na
  câmera do tabuleiro (45°, 30°): a base cai certinho nas casas. As costas saem da
  mesma caixa: a frente espelhada atrás ('frente', o normal) ou lisas, com a textura
  da lateral ('lado'). 'solido' fecha os buracos de um móvel maciço (armário, caixote).
- Planta, cadeira (ancora 'centro'): a imagem vai como está, pela altura, presa no
  centro da base.

- Móvel desenhado nos 4 giros (uma folha só com as vistas dele):
  "giros": {"4": pedaço, "2": pedaço, "0": pedaço, "6": pedaço}. Cada vista vai para
  o giro dela, sem espelho: o giro 4 é a frente virada para baixo à esquerda; o 2,
  para baixo à direita; o 0, de costas para cima à direita; o 6, de costas para cima
  à esquerda. A folha não trouxe um lado? {"pedaco": n, "espelho": true} usa outra
  vista espelhada (a frente para a esquerda vira a frente para a direita).
  - "real": [largura, fundo, altura] do móvel de verdade, em metros (a largura ao
    longo da frente). O móvel fica do tamanho certo perto das pessoas (1,80 m), no
    meio da casa, ou encostado no fundo dela ("encosta": a prateleira na parede).
    Sem "real", o móvel ocupa a casa inteira e a altura sai do desenho.
  - "como_esta": o desenho não é redesenhado (cadeira, planta: a caixa deformaria),
    só vai ao tamanho de verdade: a caixa de verdade que melhor cobre cada vista dá a
    escala do desenho (a mesma nas 4 vistas, a mediana), ou a altura da imagem inteira,
    presa no centro da base ("por": "imagem", a planta).
  - Sem "como_esta", a caixa de verdade é redesenhada na câmera do tabuleiro com o
    desenho por cima: o balcão que veio baixo fica com 1,1 m. "faixa": [de, até, vezes]
    (frações da altura do desenho) repete esse pedaço da altura
    em vez de esticar (as fileiras de garrafas da prateleira); a altura sai daí.
    Sem as vezes ("faixa": [de, até]), ela repete o quanto precisa para a altura de "real".
    "fatia": [de, até, vezes] (frações do comprimento): a frente e o tampo repetem essa
    fatia do meio do desenho, sem a moldura das pontas e sem a inclinação que o desenho
    tem de uma ponta à outra, para os módulos emendarem retos (o balcão: a fatia tem um
    número inteiro de frisos).
  - "endireitar": o desenho do gerador costuma ter as linhas da frente (tábuas, topo,
    rodapé) um pouco inclinadas em relação à caixa; dois móveis lado a lado ficavam em
    degrau. Mede a inclinação (a esquerda contra a direita da frente desdobrada) e
    corrige ao redesenhar.
  - "angulos": a câmera do desenho sai das bordas de cima da silhueta (o gerador às vezes
    desenha a 36° e 23° em vez de 45° e 30°); a caixa só ajusta o tamanho e o lugar.
  - "retificar": antes de tudo, endireita o desenho para as bordas da caixa ficarem
    exatamente na inclinação do isométrico (o gerador erra um pouco; lado a lado, dava
    degrau).
  - "pes": o móvel de pernas (cadeira, banqueta) que o gerador desenhou com a câmera um pouco
    girada: os três pés que aparecem não caem no losango do tabuleiro (um lado mais inclinado que
    o outro) e o pé da frente parecia flutuar. Endireita pelos pés, como o "retificar".
  - "pe": a caixa não cobre bem o desenho (fliperama, pilha de cadeiras): o ponto mais
    baixo dele (o pé da frente) fica no chão, na quina da frente do móvel.
  - "pisa": o móvel pisa na casa pelo desenho, não pela caixa (a caixa erra em quem não é
    caixa: escada, poltrona, biombo). O meio do desenho fica no meio do móvel e o ponto
    mais baixo, na quina da frente dele; com um número (o diâmetro do pé redondo, em
    metros: luminária, planta, suporte de soro), na frente desse pé, no meio da casa.
  - "largura": as 4 vistas ficam da largura do móvel de verdade na tela (o gerador
    desenha cada vista de um tamanho); "forma": "oval" ou "redonda" para o tampo que não
    é retângulo. Pisa como em "pisa".
  - "altura": o móvel fica da ALTURA de verdade (é o que conta perto das pessoas: o
    gerador desenha a poltrona achatada, e pela largura ela ficava baixa). As vistas da
    frente (giros 4 e 2) vão pela altura da caixa de verdade (a altura mais o tampo visto
    de cima); as costas, pela mesma largura da frente (de costas, o encosto fica na
    frente e a imagem é mais baixa). "todas": as 4 pela altura (mesa, banco, carrinho).
    "topo": [largura, fundo] do tampo, quando ele é menor que a base (o biombo: o painel
    fino em cima dos pés). Pisa como em "pisa", na largura que o desenho dá.
  - "tela": {"cores", "ms", "giros": {giro: [x, y, raio]}} (frações da imagem): a tela
    acesa que troca de cor, com o brilho em cada giro que a mostra (o fliperama).
  - "pendurado": [largura da cúpula, altura do teto] em metros (a lâmpada): a imagem
    vai pela largura, presa no teto no meio da casa; "brilho": [x, y, raio] (frações da
    imagem) é a luz em volta dela quando acesa; "pendulo": {"graus", "ms"} o balanço
    (quase parado) dela no fio.

- "limpar" (na ficha): o alfa abaixo desse valor vira transparente (o halo que o gerador
  deixa em volta das peças).

- Tapete ("chao": true): a folha é o tapete visto de cima, em pé (a largura dele na
  lateral do móvel, o comprimento na frente); vai a 128 px por casa e o jogo deita no chão.

- Item de parede ("parede"): desenhado em isométrico, preso na parede da direita ('r')
  e na da esquerda ('l'), e os outros estados ('r-1', 'l-1': a arandela apagada). Cada
  vista: [pedaço, x, y], o ponto onde ele encosta na parede (o meio da plaquinha), em
  frações do pedaço. "real": [largura na parede, quanto sai dela, altura] em metros.
  "tela": {"cores", "forca", paredes: {'r': [x, y, raio]}} (frações da imagem): a tela
  acesa, que treme como TV ligada.

- "chamas" (móvel ou item de parede): {giro ou parede: [[x, y, altura], ...]} em frações
  da imagem, a base de cada chama e a altura dela: o jogo desenha uma chama que mexe por
  cima da chama parada do desenho (vela, candelabro, tocha, fogueira). "chamas": "auto"
  acha sozinho as chamas do desenho (os pontos quentes e claros) em cada giro.
- "caixas": [[x0, y0, x1, y1], ...]: as caixas das vistas na folha, à mão, quando o desenho
  vem em pedaços soltos (as marcas de contagem). "caixa": [u0, u1, v0, v1, z0, z1] (z em
  metros): a caixa da ordem de quem fica na frente, no lugar da do jogo.
- "so_giros": só os giros da ficha têm arte; nos outros, o jogo desenha por código (a porta:
  nas paredes do fundo a arte, nas da frente, que não aparecem, a soleira). Um móvel com
  "def": "<id>@<material>" (portal@metal) é a arte daquele móvel nos cômodos desse material,
  e "<id>~<letra>" (gun_table~b) é outro modelo do mesmo móvel, que o jogo sorteia por peça. O outro
  modelo usa a câmera medida no modelo base (vem depois dele na ficha), para os módulos emendarem.
- "espelhar_estado": {"1": {"6": "2"}}: a vista de um estado que veio torta é a de outro giro
  espelhada (o baú aberto visto de costas).
- "estados": {"1": folha, ...} (móvel desenhado como está): o mesmo móvel em outro estado
  (o armário aberto, o candelabro apagado), numa folha com as vistas no mesmo lugar e no
  mesmo tamanho. Cada vista sai na escala e na âncora do estado 0, para o móvel não pular
  ao trocar de estado; vai em <móvel>/giro-<g>-<estado>.png e em "estados" no moveis.json.

A arte sai em dobro (2 pixels da imagem por pixel do tabuleiro no zoom 1), em
<destino>/<móvel>/<vista>.png, e o <destino>/moveis.json que o jogo lê.

Uso: python moveis.py <ficha.json> [--conferir saida.png]
"""
import json
import os
import sys

import fitz
import numpy as np

sys.stdout.reconfigure(encoding='utf-8')
REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
# a casa do tabuleiro: meio quadrado do livro (1,5 m), como M_POR_CASA em shared/src/constants.ts
CASA = 0.75
# o tabuleiro: casa de 64 x 32 pixels no zoom 1 = câmera a 45° e 30°, 60,3 px por metro no plano da imagem
PX_M_TABULEIRO = 32 / (CASA * np.cos(np.radians(45)))
# na vertical: 52,3 px por metro (Z_PER_M = 1,63 unidade de 32 px)
PX_M_VERTICAL = PX_M_TABULEIRO * np.cos(np.radians(30))


def ler(p):
    pix = fitz.Pixmap(p)
    if not pix.alpha:
        pix = fitz.Pixmap(pix, 1)
    return np.frombuffer(pix.samples, dtype=np.uint8).reshape(pix.height, pix.width, 4).copy()


def gravar(a, p):
    h, w = a.shape[:2]
    fitz.Pixmap(fitz.csRGB, w, h, np.ascontiguousarray(a).tobytes(), True).save(p)


def rotular(alfa, red=4):
    """Os pedaços ligados numa grade reduzida (red x red pixels por célula): o rótulo de cada célula (-1 = vazia)."""
    h, w = alfa.shape[0] // red, alfa.shape[1] // red
    m = alfa[:h * red, :w * red].reshape(h, red, w, red).max(axis=(1, 3))
    rot = np.where(m, np.arange(h * w).reshape(h, w), -1)
    while True:
        novo = rot.copy()
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1), (1, 1), (-1, -1), (1, -1), (-1, 1)):
            viz = np.roll(np.roll(rot, dy, 0), dx, 1)
            ok = (novo >= 0) & (viz >= 0)
            novo = np.where(ok, np.minimum(novo, viz), novo)
        if (novo == rot).all():
            break
        rot = novo
    return rot


_ROTULOS = {}


def rotulos_da_folha(folha, red=4):
    """Os rótulos dos pedaços da folha e a caixa de cada um (guardados: a folha é a mesma em toda a ficha)."""
    chave = (id(folha), folha.shape)
    if chave not in _ROTULOS:
        rot = rotular(folha[:, :, 3] > 16, red)
        caixa_de = {}
        for r in np.unique(rot[rot >= 0]):
            ys, xs = np.nonzero(rot == r)
            caixa_de[(int(xs.min() * red), int(ys.min() * red), int((xs.max() + 1) * red), int((ys.max() + 1) * red))] = int(r)
        _ROTULOS[chave] = (rot, red, caixa_de)
    return _ROTULOS[chave]


def apagar_vizinhos(folha, caixas, i, rec, x0, y0):
    """
    Apaga do recorte só os pixels que são dos outros pedaços (e não tudo o que cai na caixa
    deles: a caixa do vizinho pode passar por cima de um pedaço deste, a ponta do esfregão).
    False quando as caixas não são as dos pedaços (caixas à mão): aí vale o jeito antigo.
    """
    rot, red, caixa_de = rotulos_da_folha(folha)
    chave = lambda c: tuple(int(v) for v in c)
    if chave(caixas[i]) not in caixa_de or any(chave(c) not in caixa_de for c in caixas):
        return False
    outros = [caixa_de[chave(c)] for j, c in enumerate(caixas) if j != i]
    h, w = rec.shape[:2]
    yy = (np.arange(y0, y0 + h) // red).clip(0, rot.shape[0] - 1)
    xx = (np.arange(x0, x0 + w) // red).clip(0, rot.shape[1] - 1)
    rec[np.isin(rot[np.ix_(yy, xx)], outros), 3] = 0
    return True


def pedacos(alfa, red=4):
    """Os objetos da folha: caixas dos pedaços ligados (numa grade reduzida), em ordem de leitura."""
    rot = rotular(alfa, red)
    caixas = []
    for r in np.unique(rot[rot >= 0]):
        ys, xs = np.nonzero(rot == r)
        if len(ys) < 40:
            continue
        caixas.append([xs.min() * red, ys.min() * red, (xs.max() + 1) * red, (ys.max() + 1) * red])
    caixas.sort(key=lambda c: (c[1] + c[3]) / 2)
    linhas, atual = [], []
    for c in caixas:
        if atual and (c[1] + c[3]) / 2 - np.mean([(a[1] + a[3]) / 2 for a in atual]) > 0.25 * (c[3] - c[1]):
            linhas.append(atual)
            atual = []
        atual.append(c)
    if atual:
        linhas.append(atual)
    return [c for ln in linhas for c in sorted(ln, key=lambda c: c[0])]


def recortar(folha, caixas, i):
    return recortar_origem(folha, caixas, i)[0]


def recortar_origem(folha, caixas, i):
    """O pedaço i da folha, sem os pixels dos outros pedaços, e onde o recorte começa na folha (x, y)."""
    x0, y0, x1, y1 = caixas[i]
    rec = folha[y0:y1, x0:x1].copy()
    if not apagar_vizinhos(folha, caixas, i, rec, x0, y0):
        for j, (a0, b0, a1, b1) in enumerate(caixas):
            if j == i:
                continue
            ix0, iy0, ix1, iy1 = max(a0, x0), max(b0, y0), min(a1, x1), min(b1, y1)
            if ix0 < ix1 and iy0 < iy1:
                rec[iy0 - y0:iy1 - y0, ix0 - x0:ix1 - x0, 3] = 0
    ys, xs = np.nonzero(rec[:, :, 3] > 16)
    return rec[ys.min():ys.max() + 1, xs.min():xs.max() + 1], (x0 + xs.min(), y0 + ys.min())


def achar_chamas(img, quente=None):
    """
    As chamas do desenho: os pedaços quentes e claros (ou os de quente, a máscara já
    pronta). [[x, y, altura], ...] em pixels da imagem (a base de cada uma).
    """
    f = img.astype(int)
    r, g, b, a = f[..., 0], f[..., 1], f[..., 2], f[..., 3]
    if quente is None:
        quente = (a > 150) & (r > 200) & (g > 120) & (r - b > 90)
    h, w = quente.shape
    vistos = np.zeros_like(quente)
    out = []
    for y0 in range(h):
        for x0 in np.nonzero(quente[y0] & ~vistos[y0])[0]:
            pilha = [(y0, x0)]
            vistos[y0, x0] = True
            pts = []
            while pilha:
                y, x = pilha.pop()
                pts.append((y, x))
                for dy in (-1, 0, 1):
                    for dx in (-1, 0, 1):
                        ny, nx = y + dy, x + dx
                        if 0 <= ny < h and 0 <= nx < w and quente[ny, nx] and not vistos[ny, nx]:
                            vistos[ny, nx] = True
                            pilha.append((ny, nx))
            if len(pts) < 3:
                continue
            ys = np.array([p[0] for p in pts])
            xs = np.array([p[1] for p in pts])
            out.append([xs.min(), xs.max(), ys.min(), ys.max(), ys, xs])
    # a chama partida em dois pedaços (o miolo claro no meio) vira uma só: juntos na coluna e quase encostados
    juntou = True
    while juntou:
        juntou = False
        for i in range(len(out)):
            for j in range(i + 1, len(out)):
                a, b = out[i], out[j]
                # na mesma coluna (os meios a até 4 px) e encostados na altura (até 2 px de vão)
                if abs((a[0] + a[1]) - (b[0] + b[1])) / 2 <= 4 and min(a[3], b[3]) - max(a[2], b[2]) >= -2:
                    out[i] = [min(a[0], b[0]), max(a[1], b[1]), min(a[2], b[2]), max(a[3], b[3]), np.concatenate([a[4], b[4]]), np.concatenate([a[5], b[5]])]
                    del out[j]
                    juntou = True
                    break
            if juntou:
                break
    chamas = []
    alturas = [c[3] - c[2] + 1 for c in out if c[3] - c[2] + 1 >= 6]
    if not alturas:
        return chamas
    tipica = float(np.median(alturas))
    for x0, x1, y0, y1, ys, xs in out:
        if y1 - y0 + 1 < 0.6 * tipica:
            continue
        # a chama grudada num brilho da cera embaixo: fica só a chama (a altura de uma chama, de cima)
        if y1 - y0 + 1 > 1.4 * tipica:
            y1 = int(y0 + tipica - 1)
            xs, ys = xs[ys <= y1], ys[ys <= y1]
        pe = xs[ys >= y1 - max(1, (y1 - y0) * 0.3)]
        chamas.append([round(float(pe.mean()) + 0.5, 1), round(float(y1) + 1, 1), round(float(y1 - y0 + 1), 1)])
    return chamas


def bordas_de_cima(rec):
    """A inclinação das duas bordas de cima da silhueta (a da esquerda e a da direita do canto de trás), ou None."""
    op = rec[:, :, 3] > 100
    xs = np.nonzero(op.any(axis=0))[0]
    if len(xs) < 40:
        return None
    ys = np.array([np.nonzero(op[:, x])[0].min() for x in xs], dtype=float)
    kc = xs[int(np.argmin(ys))]
    x0, x1 = xs.min(), xs.max()
    esq = (xs > x0 + 0.08 * (kc - x0)) & (xs < kc - 0.12 * (kc - x0))
    dir_ = (xs > kc + 0.12 * (x1 - kc)) & (xs < x1 - 0.08 * (x1 - kc))
    if esq.sum() < 10 or dir_.sum() < 10:
        return None
    return float(np.polyfit(xs[esq], ys[esq], 1)[0]), float(np.polyfit(xs[dir_], ys[dir_], 1)[0])


def angulos_do_desenho(rec):
    """
    A câmera em que a caixa foi desenhada, pelas bordas de cima: a de x desce st*tan(a)
    por pixel, a de y sobe st/tan(a). O gerador às vezes desenha a 36° e 23° em vez de 45°
    e 30°; com o ângulo dele, a frente sai amostrada do lugar certo. None se não deu para medir.
    """
    b = bordas_de_cima(rec)
    if not b:
        return None
    s_y, s_x = b
    if s_x <= 0.05 or s_y >= -0.05:
        return None
    st = float(np.sqrt(-s_x * s_y))
    if not 0.2 < st < 0.75:
        return None
    a = float(np.arctan(s_x / st))
    return a, float(np.arcsin(st))


def retificar(rec):
    """
    O gerador desenha a caixa com as bordas um pouco fora da inclinação do isométrico
    (2:1): dois móveis iguais lado a lado ficavam em degrau e a frente "escorregava".
    Mede a inclinação das duas bordas de cima da silhueta (a da esquerda deveria subir
    meio pixel por pixel, a da direita descer meio) e endireita a imagem com uma conta
    que mantém as verticais em pé (x' = a x; y' = y + c x). Devolve a imagem e (a, c),
    ou a imagem como está quando as bordas não dão para medir.
    """
    op = rec[:, :, 3] > 100
    h, w = op.shape
    xs = np.nonzero(op.any(axis=0))[0]
    if len(xs) < 40:
        return rec, None
    ys = np.array([np.nonzero(op[:, x])[0].min() for x in xs], dtype=float)
    kc = xs[int(np.argmin(ys))]
    x0, x1 = xs.min(), xs.max()
    esq = (xs > x0 + 0.08 * (kc - x0)) & (xs < kc - 0.12 * (kc - x0))
    dir_ = (xs > kc + 0.12 * (x1 - kc)) & (xs < x1 - 0.08 * (x1 - kc))
    if esq.sum() < 10 or dir_.sum() < 10:
        return rec, None
    s_esq = float(np.polyfit(xs[esq], ys[esq], 1)[0])
    s_dir = float(np.polyfit(xs[dir_], ys[dir_], 1)[0])
    if abs(s_esq + 0.5) > 0.35 or abs(s_dir - 0.5) > 0.35:
        return rec, None
    a = s_dir - s_esq
    c = 0.5 * a - s_dir
    W2 = int(np.ceil(w * a))
    dy0 = min(0.0, c * w)
    H2 = int(np.ceil(h + abs(c) * w))
    yy, xx = np.mgrid[0:H2, 0:W2].astype(float) + 0.5
    xs_ = xx / a
    ys_ = yy + dy0 - c * xs_
    out = amostrar(rec, xs_, ys_)
    return np.clip(out, 0, 255).round().astype(np.uint8), (a, c)


def pes_do_desenho(rec):
    """
    Os três pés que aparecem (o da esquerda, o da frente, o mais baixo, e o da direita), pelo fundo da
    silhueta de cada coluna: [(x, y)] ou None. O da frente é o ponto mais baixo; os dos lados, os mais
    baixos de cada lado dele (a borda do assento, mais para fora, fica mais alta que o pé).
    """
    op = rec[:, :, 3] > 100
    xs = np.nonzero(op.any(axis=0))[0]
    if len(xs) < 20:
        return None
    fundo = np.full(op.shape[1], -1)
    for x in xs:
        fundo[x] = np.nonzero(op[:, x])[0].max()
    yf = fundo.max()
    tol = max(1, round(0.004 * op.shape[0]))
    xf = float(np.nonzero(fundo >= yf - tol)[0].mean())
    x0, x1 = xs.min(), xs.max()

    def lado(cols):
        if not len(cols):
            return None
        y = fundo[cols].max()
        return float(cols[fundo[cols] >= y - tol].mean()), float(y)
    esq = lado(xs[xs < xf - 0.3 * (xf - x0)])
    dir_ = lado(xs[xs > xf + 0.3 * (x1 - xf)])
    if not esq or not dir_:
        return None
    return [esq, (xf, float(yf)), dir_]


def endireitar_pelos_pes(rec):
    """
    "pes": o gerador desenhou o móvel de pernas (a cadeira) com a câmera um pouco girada, e os pés não
    caem no losango do tabuleiro: um lado inclina mais que meio pixel por pixel e o outro menos, e o pé
    da frente parecia flutuar perto da mesa (12/10, o Felipe). Como o retificar, mas pelos pés: a conta
    (x' = a x; y' = y + c x) deixa as verticais em pé e põe os dois lados da base em 2:1.
    """
    pes = pes_do_desenho(rec)
    if not pes:
        return rec, None
    (xl, yl), (xf, yf), (xr, yr) = pes
    s1 = (yf - yl) / (xf - xl)
    s2 = (yr - yf) / (xr - xf)
    if abs(s1 - 0.5) > 0.4 or abs(s2 + 0.5) > 0.4:
        return rec, None
    a = s1 - s2
    c = 0.5 * a - s1
    h, w = rec.shape[:2]
    W2 = int(np.ceil(w * a))
    dy0 = min(0.0, c * w)
    H2 = int(np.ceil(h + abs(c) * w))
    yy, xx = np.mgrid[0:H2, 0:W2].astype(float) + 0.5
    xs_ = xx / a
    ys_ = yy + dy0 - c * xs_
    out = amostrar(rec, xs_, ys_)
    return np.clip(out, 0, 255).round().astype(np.uint8), (a, c, s1, s2)


def reamostrar(img, w2, h2):
    """Redimensiona pela média da área (alfa pré-multiplicado: a borda não escurece)."""
    h, w = img.shape[:2]

    def matriz(n_in, n_out):
        M = np.zeros((n_out, n_in))
        esc = n_in / n_out
        for i in range(n_out):
            a, b = i * esc, (i + 1) * esc
            for j in range(int(np.floor(a)), min(n_in, int(np.ceil(b)))):
                M[i, j] = min(b, j + 1) - max(a, j)
        return M / M.sum(axis=1, keepdims=True)
    Ry, Rx = matriz(h, h2), matriz(w, w2)
    f = img.astype(float) / 255.0
    pre = f[:, :, :3] * f[:, :, 3:4]
    al = Ry @ f[:, :, 3] @ Rx.T
    cor = np.stack([Ry @ pre[:, :, c] @ Rx.T for c in range(3)], axis=2)
    cor = cor / np.maximum(al[:, :, None], 1e-6)
    out = np.zeros((h2, w2, 4), dtype=np.uint8)
    out[:, :, :3] = np.clip(cor * 255, 0, 255).round()
    out[:, :, 3] = np.clip(al * 255, 0, 255).round()
    return out


def ancora_centro(img):
    """O centro da base (a elipse do pé, 2:1) de um objeto redondo: planta, cadeira."""
    op = img[:, :, 3] > 100
    ys = np.nonzero(op.any(axis=1))[0]
    baixo = ys.max()
    faixa = op[max(0, baixo - max(2, int(0.08 * (baixo - ys.min())))):baixo + 1]
    xs = np.nonzero(faixa.any(axis=0))[0]
    largura = xs.max() - xs.min() + 1
    return float((xs.min() + xs.max() + 1) / 2), float(baixo + 1 - largura / 4)


# ---------------------------------------------------------------- a caixa

def proj(p, c):
    """Câmera ortográfica: azimute a, elevação t, S px/m, centro (u0, v0). p em metros; z para cima."""
    ca, sa = np.cos(c['a']), np.sin(c['a'])
    ct, st = np.cos(c['t']), np.sin(c['t'])
    u = c['u0'] + c['S'] * (ca * p[..., 0] - sa * p[..., 1])
    v = c['v0'] + c['S'] * (st * (sa * p[..., 0] + ca * p[..., 1]) - ct * p[..., 2])
    return u, v


def cantos(Wm, Dm, H):
    return np.array([[x, y, z] for x in (0, Wm) for y in (0, Dm) for z in (0, H)], dtype=float)


def casco(pts):
    """Fecho convexo 2D."""
    pts = sorted(map(tuple, pts))

    def cruz(o, a, b):
        return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])
    inf, sup = [], []
    for q in pts:
        while len(inf) >= 2 and cruz(inf[-2], inf[-1], q) <= 0:
            inf.pop()
        inf.append(q)
    for q in reversed(pts):
        while len(sup) >= 2 and cruz(sup[-2], sup[-1], q) <= 0:
            sup.pop()
        sup.append(q)
    return np.array(inf[:-1] + sup[:-1])


def poligono(pol, H, W):
    yy, xx = np.mgrid[0:H, 0:W]
    m = np.ones((H, W), dtype=bool)
    for i in range(len(pol)):
        a, b = pol[i], pol[(i + 1) % len(pol)]
        m &= (b[0] - a[0]) * (yy + 0.5 - a[1]) - (b[1] - a[1]) * (xx + 0.5 - a[0]) >= 0
    return m


def ajustar_camera(mask, Wm, Dm, H0, livre=False, angulos=None):
    """
    O ângulo do desenho: a caixa do móvel que melhor cobre a silhueta. A altura sempre
    varia. livre: 'tudo' (a largura e o fundo também variam e a escala fica a do começo:
    sai a proporção do próprio desenho, em cam['W'], cam['D'], cam['H']), 'chao' (o
    chão cresce por igual, na proporção Wm x Dm) ou 'proporcao' (a caixa inteira cresce
    por igual, na proporção Wm x Dm x H0: o tamanho do desenho, para um móvel que não é
    caixa, como a cadeira e a mesa). Com livre, o ângulo é puxado de leve para o do
    tabuleiro (a caixa e o ângulo podem se compensar).
    """
    ys, xs = np.nonzero(mask)
    alvo = poligono(casco(np.stack([xs, ys], axis=1).astype(float) + 0.5), *mask.shape)
    area = alvo.sum()
    if livre is True:
        livre = 'tudo'
    a0, t0 = angulos if angulos else (np.radians(45), np.radians(30))
    c = {'a': a0, 't': t0, 'S': mask.shape[1] / ((Wm * np.cos(a0) + Dm * np.sin(a0))), 'u0': 0.0, 'v0': 0.0,
         'W': Wm, 'D': Dm, 'H': H0, 'F': 1.0}
    if livre and livre != 'proporcao':
        # a altura do começo sai da silhueta (a do chão, numa caixa a 45° e 30°, é metade da largura)
        c['H'] = H0 = max(0.05, ((ys.max() - ys.min() + 1) / c['S'] - np.sin(t0) * (Wm * np.sin(a0) + Dm * np.cos(a0))) / np.cos(t0))
    u, v = proj(cantos(Wm, Dm, H0), c)
    c['u0'] = (xs.min() + xs.max()) / 2 - (u.min() + u.max()) / 2
    c['v0'] = (ys.min() + ys.max()) / 2 - (v.min() + v.max()) / 2

    def nota(c):
        u, v = proj(cantos(c['W'] * c['F'], c['D'] * c['F'], c['H'] * (c['F'] if livre == 'proporcao' else 1.0)), c)
        m = poligono(casco(np.stack([u, v], axis=1)), *mask.shape)
        inter = (m & alvo).sum()
        n = inter / max(1, (m | alvo).sum()) - 2.0 * max(0.0, 0.97 - inter / area)
        if livre and not angulos:
            n -= 2.0 * ((c['a'] - np.radians(45)) ** 2 + (c['t'] - np.radians(30)) ** 2)
        return n
    base = nota(c)
    passos = {'a': np.radians(4), 't': np.radians(4), 'S': c['S'] * 0.04, 'u0': 4.0, 'v0': 4.0,
              'W': Wm * 0.06, 'D': Dm * 0.06, 'H': H0 * 0.06, 'F': 0.06}
    chaves = {False: ('a', 't', 'S', 'u0', 'v0', 'H'), 'tudo': ('a', 't', 'u0', 'v0', 'W', 'D', 'H'),
              'chao': ('a', 't', 'u0', 'v0', 'F', 'H'), 'proporcao': ('a', 't', 'u0', 'v0', 'F')}[livre]
    if angulos:
        # o ângulo já foi medido nas bordas: só o tamanho e o lugar da caixa variam
        chaves = tuple(k for k in chaves if k not in ('a', 't'))
    for _ in range(7):
        for k in chaves:
            for sinal in (1, -1):
                while True:
                    novo = dict(c)
                    novo[k] += sinal * passos[k]
                    novo['t'] = float(np.clip(novo['t'], np.radians(10), np.radians(70)))
                    novo['a'] = float(np.clip(novo['a'], np.radians(15), np.radians(75)))
                    for d in ('W', 'D', 'H', 'F'):
                        novo[d] = max(novo[d], 0.01)
                    n = nota(novo)
                    if n <= base + 1e-5:
                        break
                    c, base = novo, n
        passos = {k: v * 0.5 for k, v in passos.items()}
    if livre == 'proporcao':
        c['H'] *= c['F']
    c['W'], c['D'], c['F'] = c['W'] * c['F'], c['D'] * c['F'], 1.0
    return c, base


def amostrar(img, u, v):
    """Cor (RGBA) da imagem em (u, v), bilinear com alfa pré-multiplicado."""
    h, w = img.shape[:2]
    f = img.astype(float)
    pre = f.copy()
    pre[..., :3] *= f[..., 3:4] / 255.0
    fora = (u < 0) | (u > w) | (v < 0) | (v > h)
    u = np.clip(u - 0.5, 0, w - 1.001)
    v = np.clip(v - 0.5, 0, h - 1.001)
    u0, v0 = np.floor(u).astype(int), np.floor(v).astype(int)
    fu, fv = (u - u0)[..., None], (v - v0)[..., None]
    a = pre[v0, u0] * (1 - fu) + pre[v0, u0 + 1] * fu
    b = pre[v0 + 1, u0] * (1 - fu) + pre[v0 + 1, u0 + 1] * fu
    r = a * (1 - fv) + b * fv
    r[..., :3] = r[..., :3] / np.maximum(r[..., 3:4] / 255.0, 1e-6)
    r[fora] = 0
    return r


def raios(lo, hi, escala):
    """
    A caixa [lo, hi] vista pela câmera do tabuleiro, em dobro: para cada pixel da imagem,
    o ponto da caixa que aparece nele (o mais perto da câmera) e a face (0: x, 1: y, 2: z).
    """
    tab = {'a': np.radians(45), 't': np.radians(30), 'S': PX_M_TABULEIRO / escala, 'u0': 0.0, 'v0': 0.0}
    u, v = proj(np.array([[x, y, z] for x in (lo[0], hi[0]) for y in (lo[1], hi[1]) for z in (lo[2], hi[2])]), tab)
    x0, x1 = int(np.floor(u.min())) - 1, int(np.ceil(u.max())) + 1
    y0, y1 = int(np.floor(v.min())) - 1, int(np.ceil(v.max())) + 1
    tab['u0'], tab['v0'] = -x0, -y0
    Wi, Hi = x1 - x0, y1 - y0
    yy, xx = np.mgrid[0:Hi, 0:Wi].astype(float) + 0.5
    ca, sa, ct, st = np.cos(tab['a']), np.sin(tab['a']), np.cos(tab['t']), np.sin(tab['t'])
    # o ponto do chão (z = 0) de cada pixel; o raio sobe para a câmera na direção w
    inv = np.linalg.inv(np.array([[ca, -sa], [st * sa, st * ca]]) * tab['S'])
    du, dv = xx - tab['u0'], yy - tab['v0']
    chao = np.stack([inv[0, 0] * du + inv[0, 1] * dv, inv[1, 0] * du + inv[1, 1] * dv, np.zeros_like(du)], axis=-1)
    w = np.array([sa * ct, ca * ct, st])
    tmin = np.full(du.shape, -np.inf)
    tmax = np.full(du.shape, np.inf)
    face = np.zeros(du.shape, dtype=int)
    for k in range(3):
        t1 = (lo[k] - chao[..., k]) / w[k]
        t2 = (hi[k] - chao[..., k]) / w[k]
        tn, tf = np.minimum(t1, t2), np.maximum(t1, t2)
        tmin = np.maximum(tmin, tn)
        face = np.where(tf < tmax, k, face)
        tmax = np.minimum(tmax, tf)
    acerta = tmax >= tmin
    p = chao + np.where(acerta, tmax, 0)[..., None] * w
    return p, face, acerta, tab


def renderizar(desenho, cam, Wm, Dm, H, escala, costas=None, solido=False):
    """
    A caixa com o desenho projetado, vista pela câmera do tabuleiro, em dobro (1/escala px
    por px do tabuleiro). costas: None (a frente, como desenhada), 'lado' (as costas lisas,
    com a textura da lateral) ou 'frente' (a frente espelhada atrás). Devolve a imagem e a
    âncora (a quina de baixo da base).
    """
    p, face, acerta, tab = raios(np.zeros(3), np.array([Wm, Dm, H]), escala)
    q = p.copy()
    if costas:
        # de trás: a caixa girada 180°; o ponto de verdade é o do outro lado
        q[..., 0] = Wm - p[..., 0]
        q[..., 1] = Dm - p[..., 1]
        atras = face == 1
        outro = face == 0
        q2 = q.copy()
        if costas == 'lado':
            q2[..., 0] = Wm
            q2[..., 1] = (q[..., 0] / max(Wm, 1e-6)) * Dm
        else:
            q2[..., 1] = Dm
        q = np.where(atras[..., None], q2, q)
        q3 = q.copy()
        q3[..., 0] = Wm
        q = np.where(outro[..., None], q3, q)
    cor = amostrar(desenho, *proj(q, cam))
    if solido:
        # móvel maciço (armário, caixote): onde a caixa pegou fora do desenho, a cor média da face
        for k in range(3):
            m = acerta & (face == k)
            if not m.any():
                continue
            cheio = m & (cor[..., 3] > 200)
            media = cor[cheio][:, :3].mean(axis=0) if cheio.any() else cor[m][:, :3].mean(axis=0)
            a = cor[..., 3:4] / 255.0
            cor[..., :3] = np.where(m[..., None], cor[..., :3] * a + media * (1 - a), cor[..., :3])
            cor[..., 3] = np.where(m, 255, cor[..., 3])
    out = np.zeros(p.shape[:2] + (4,))
    out[acerta] = cor[acerta]
    ub, vb = proj(np.array([Wm, Dm, 0.0]), tab)
    return np.clip(out, 0, 255).round().astype(np.uint8), (float(ub), float(vb))


def frente_desdobrada(desenho, cam, troca, n=400):
    """A face da frente do desenho (a do comprimento), reta: x ao longo dela, z para cima."""
    W, Dd, H = cam['W'], cam['D'], cam['H']
    L = Dd if troca else W
    alt = max(8, int(n * H / L))
    zz, xx = np.mgrid[0:alt, 0:n].astype(float)
    if troca:
        pts = np.stack([np.full_like(xx, W), (n - xx - 0.5) / n * Dd, (alt - zz - 0.5) / alt * H], axis=-1)
    else:
        pts = np.stack([(xx + 0.5) / n * W, np.full_like(xx, Dd), (alt - zz - 0.5) / alt * H], axis=-1)
    return amostrar(desenho, *proj(pts, cam)), L


def inclinacao(desenho, cam, troca):
    """Quanto as linhas da frente sobem por metro ao longo dela (metros do desenho): compara as bordas da esquerda com as da direita."""
    img, L = frente_desdobrada(desenho, cam, troca)
    lum = img[:, :, :3].mean(axis=2) * (img[:, :, 3] / 255.0)
    g = np.abs(np.diff(lum, axis=0))
    h, w = g.shape
    a = g[:, int(w * 0.1):int(w * 0.35)].mean(axis=1)
    b = g[:, int(w * 0.65):int(w * 0.9)].mean(axis=1)
    a = (a - a.mean()) / (a.std() + 1e-6)
    b = (b - b.mean()) / (b.std() + 1e-6)
    melhor, d = -1e9, 0
    for desl in range(-25, 26):
        c = (a[desl:] * b[:h - desl]).mean() if desl >= 0 else (a[:h + desl] * b[-desl:]).mean()
        if c > melhor:
            melhor, d = c, desl
    # d > 0: a direita está d px acima da esquerda; os centros das duas faixas ficam a 0,55 da largura
    return d / (0.55 * w), melhor


def renderizar_caixa(desenho, cam, caixa, casa, escala, faixa=None, troca=False, fatia=None, incl=0.0):
    """
    O desenho (ajustado na caixa cam['W'] x cam['D'] x cam['H']) redesenhado na caixa do
    móvel de verdade (ox, oy, largura, fundo, altura, em metros dentro da casa), na câmera
    do tabuleiro, em dobro. faixa (de, até, em metros do desenho): na caixa mais alta, esse
    pedaço da altura se repete, em vez de esticar; embaixo e em
    cima ficam como no desenho, na escala da frente. troca: a frente corre no eixo y
    (giros 2 e 6). Devolve a imagem e a âncora (a quina de baixo da casa).
    """
    ox, oy, bw, bd, bh = caixa
    Wd, Dd, Hd = cam['W'], cam['D'], cam['H']
    p, face, acerta, tab = raios(np.array([ox, oy, 0.0]), np.array([ox + bw, oy + bd, bh]), escala)
    q = p.copy()
    q[..., 0] = (p[..., 0] - ox) * (Wd / bw)
    q[..., 1] = (p[..., 1] - oy) * (Dd / bd)
    if fatia:
        # a frente e o tampo repetem uma fatia do meio do desenho; a ponta continua a do desenho
        f0, f1, voltas = fatia
        if troca:
            s_ = ((p[..., 1] - oy) / bd * voltas) % 1.0
            q[..., 1] = np.where(face != 1, (f0 + s_ * (f1 - f0)) * Dd, q[..., 1])
        else:
            s_ = ((p[..., 0] - ox) / bw * voltas) % 1.0
            q[..., 0] = np.where(face != 0, (f0 + s_ * (f1 - f0)) * Wd, q[..., 0])
    z = p[..., 2]
    if faixa:
        z0, z1 = faixa
        e = (Dd / bd) if troca else (Wd / bw)  # metros do desenho por metro de verdade, ao longo da frente
        baixo, alto = z0 / e, bh - (Hd - z1) / e
        meio = (z > baixo) & (z < alto)
        volta = np.where(meio, (z - baixo) / ((z1 - z0) / e), 0.0)
        n = np.floor(volta)
        # a faixa se repete igual: espelhada, a perspectiva das tábuas e do fundo da estante virava ao contrário
        zd = np.where(z <= baixo, z * e, np.where(z >= alto, Hd - (bh - z) * e, z0 + (volta - n) * (z1 - z0)))
        q[..., 2] = zd
    else:
        q[..., 2] = z * (Hd / bh)
    if incl:
        # na frente, as linhas do desenho sobem incl metros por metro: procura cada uma onde ela está (o tampo e a ponta ficam como estão)
        if troca:
            ao_longo = Dd - q[..., 1]
            q[..., 2] = np.where(face == 0, q[..., 2] + incl * (ao_longo - Dd / 2), q[..., 2])
        else:
            q[..., 2] = np.where(face == 1, q[..., 2] + incl * (q[..., 0] - Wd / 2), q[..., 2])
    cor = amostrar(desenho, *proj(q, cam))
    out = np.zeros(p.shape[:2] + (4,))
    out[acerta] = cor[acerta]
    ub, vb = proj(np.array([casa[0], casa[1], 0.0]), tab)
    return np.clip(out, 0, 255).round().astype(np.uint8), (float(ub), float(vb))


def posicao(giro, Wt, Dt, bw, bd, encosta):
    """Onde o móvel fica na casa (o canto de cima, em metros): no meio, ou encostado no fundo (a parede)."""
    ox, oy = (Wt - bw) / 2, (Dt - bd) / 2
    if encosta:
        # o fundo é o lado oposto à frente: giro 4 (frente +y) encosta no y = 0, e assim por diante
        if giro == '4':
            oy = 0.0
        elif giro == '0':
            oy = Dt - bd
        elif giro == '2':
            ox = 0.0
        else:
            ox = Wt - bw
    return ox, oy


def pisar(img, Wt, Dt, ox, oy, bw, bd, escala, base=None):
    """
    A âncora (a quina da frente da casa, na imagem) pelo desenho: o meio da imagem em x fica
    no meio do móvel; o ponto mais baixo, na quina da frente do móvel. base (diâmetro do pé
    redondo, em metros): o ponto mais baixo é a frente do pé, no meio do móvel, e o meio
    em x é o do pé (a faixa de baixo da imagem).
    """
    op = img[:, :, 3] > 100
    ys, xs = np.nonzero(op)
    baixo = ys.max() + 1
    if base:
        faixa = op[max(0, baixo - max(2, int(0.06 * (baixo - ys.min())))):baixo]
        fx = np.nonzero(faixa.any(axis=0))[0]
        xc = (fx.min() + fx.max() + 1) / 2
    else:
        xc = (xs.min() + xs.max() + 1) / 2
    # o meio do móvel e a quina da frente dele, em casas, contra a quina da frente da casa
    cx, cy = (ox + bw / 2 - Wt) / CASA, (oy + bd / 2 - Dt) / CASA
    sx = (cx - cy) * 32
    if base:
        sy = (cx + cy) * 16 + base / 2 / CASA * np.sqrt(2) * 16
    else:
        sy = ((ox + bw - Wt) + (oy + bd - Dt)) / CASA * 16
    return float(xc - sx / escala), float(baixo - sy / escala)


# ---------------------------------------------------------------- tudo

def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    cfg = json.load(open(args[0], encoding='utf-8'))
    destino = os.path.join(REPO, cfg['destino'])
    escala = cfg.get('escala', 0.5)
    folhas = {}

    def folha_de(m):
        nome = m.get('folha', cfg.get('folha'))
        if nome not in folhas:
            f = ler(os.path.join(REPO, nome))
            if cfg.get('limpar'):
                # o gerador deixa um halo quase transparente em volta: some
                f[:, :, 3] = np.where(f[:, :, 3] < cfg['limpar'], 0, f[:, :, 3])
            folhas[nome] = (f, pedacos(f[:, :, 3] > 16))
            print(nome, ':', len(folhas[nome][1]), 'objetos', flush=True)
        return folhas[nome]
    arq_lista = os.path.join(destino, 'moveis.json')
    lista = json.load(open(arq_lista, encoding='utf-8')) if os.path.exists(arq_lista) else {}
    conferir = []
    so = sys.argv[sys.argv.index('--so') + 1].split(',') if '--so' in sys.argv else None
    for m in cfg['moveis']:
        if so and m['def'] not in so:
            continue
        folha, caixas = folha_de(m)
        if m.get('caixas'):
            # a folha com pedaços soltos demais (riscos, marcas): as caixas de cada vista, à mão
            caixas = [list(map(int, c)) for c in m['caixas']]
        if m.get('chao'):
            ent, img = tapete(m, folha, destino)
            lista[m['def']] = ent
            conferir.append((m['def'], img, None))
            continue
        if m.get('parede'):
            ent, imgs = parede(m, folha, caixas, destino, escala)
            lista[m['def']] = ent
            for img in imgs:
                conferir.append((m['def'], img, None))
            continue
        if 'giros' in m:
            ent, imgs = quatro_giros(m, folha, caixas, destino, escala)
            if m.get('so_giros'):
                # só estes giros têm arte (a porta nas paredes do fundo): nos outros, o desenho por código
                ent['soGiros'] = True
            marcar_real(ent, m)
            manter_cima(ent, lista.get(m['def']))
            lista[m['def']] = ent
            for img in imgs:
                conferir.append((m['def'], img, None))
            continue
        rec = recortar(folha, caixas, m['pedaco'])
        if m.get('lado', 'esquerda') == 'direita':
            # tudo trabalha com a frente à esquerda; o jogo espelha quando precisa
            rec = rec[:, ::-1].copy()
        pasta = os.path.join(destino, m['def'])
        os.makedirs(pasta, exist_ok=True)
        ent = {'escala': escala}
        if m.get('ancora') == 'centro':
            k = m['altura'] * PX_M_VERTICAL / escala / rec.shape[0] * m.get('ajuste', 1.0)
            img = reamostrar(rec, max(1, round(rec.shape[1] * k)), max(1, round(rec.shape[0] * k)))
            ax, ay = ancora_centro(img)
            gravar(img, os.path.join(pasta, 'frente.png'))
            ent['frente'] = {'arquivo': f"{m['def']}/frente.png", 'ax': round(ax, 1), 'ay': round(ay, 1), 'lado': 'esquerda', 'ancora': 'centro'}
            conferir.append((m['def'], img, None))
            print(f"{m['def']}: {img.shape[1]}x{img.shape[0]} (pela altura, centro)", flush=True)
        else:
            Wm, Dm = m['W'] * CASA, m['D'] * CASA
            cam, nota = ajustar_camera(rec[:, :, 3] > 100, Wm, Dm, m['altura'])
            H = cam['H']
            solido = m.get('solido', False)
            vistas = {'frente': renderizar(rec, cam, Wm, Dm, H, escala, solido=solido)}
            if m.get('costas', 'frente') != 'nao':
                vistas['costas'] = renderizar(rec, cam, Wm, Dm, H, escala, costas=m.get('costas', 'frente'), solido=solido)
            for nome, (img, (ax, ay)) in vistas.items():
                gravar(img, os.path.join(pasta, f'{nome}.png'))
                ent[nome] = {'arquivo': f"{m['def']}/{nome}.png", 'ax': round(ax, 1), 'ay': round(ay, 1), 'lado': 'esquerda', 'ancora': 'quina'}
            conferir.append((m['def'], vistas['frente'][0], vistas.get('costas', (None,))[0]))
            print(f"{m['def']}: encaixe {nota:.3f}; desenho a {np.degrees(cam['a']):.0f}° e {np.degrees(cam['t']):.0f}°, "
                  f"altura {H:.2f} m (ficha {m['altura']:.2f})", flush=True)
        marcar_real(ent, m)
        manter_cima(ent, lista.get(m['def']))
        lista[m['def']] = ent
    with open(arq_lista, 'w', encoding='utf-8', newline='\n') as f:
        json.dump(lista, f, ensure_ascii=False, indent=1)
        f.write('\n')
    if '--conferir' in sys.argv:
        folha_conf(conferir, sys.argv[sys.argv.index('--conferir') + 1])


def marcar_real(ent, m):
    """O tamanho de verdade vai junto no moveis.json: o mapa tático (visto de cima) desenha o móvel nele, e não na casa inteira."""
    if m.get('real'):
        ent['real'] = m['real']
        if m.get('encosta'):
            ent['encosta'] = True


def manter_cima(ent, antigo):
    """A vista de cima (scripts/3d/cima.py) fica: refazer as vistas isométricas não apaga."""
    for k in ('cima', 'cimaEstados'):
        if antigo and k in antigo:
            ent[k] = antigo[k]


# a câmera de cada giro de cada móvel base, para os outros modelos dele ("<id>~b") usarem a mesma
CAMERAS = {}


def quatro_giros(m, folha, caixas, destino, escala):
    """
    O móvel desenhado nos 4 giros: cada vista no tamanho de verdade, no ângulo do tabuleiro.
    Como está (com "real"): as 4 vistas usam a mesma escala (a mediana das caixas), para o
    móvel não mudar de tamanho ao girar.
    """
    pasta = os.path.join(destino, m['def'])
    os.makedirs(pasta, exist_ok=True)
    W, D = m.get('W', 1), m.get('D', 1)
    real = m.get('real')
    ent = {'escala': escala, 'giros': {}}
    imgs = []
    vistas = []
    origens = {}
    for giro, qual in m['giros'].items():
        pedaco, espelho = (qual, False) if isinstance(qual, int) else (qual['pedaco'], qual.get('espelho', False))
        rec, origem = recortar_origem(folha, caixas, pedaco)
        origens[giro] = (pedaco, origem, rec.shape[1], rec.shape[0], espelho)
        if espelho:
            rec = rec[:, ::-1].copy()
        if m.get('retificar'):
            rec, conta = retificar(rec)
            if conta:
                print(f"{m['def']} giro {giro}: endireitado (x {conta[0]:.3f}, inclinação {conta[1]:+.3f})", flush=True)
        if m.get('pes'):
            rec, conta = endireitar_pelos_pes(rec)
            if conta:
                print(f"{m['def']} giro {giro}: os pés em 2:1 (eram {conta[2]:+.2f} e {conta[3]:+.2f}; x {conta[0]:.3f}, inclinação {conta[1]:+.3f})", flush=True)
        nome = f'giro-{giro}.png'
        if m.get('pendurado'):
            img, (ax, ay), caixa = pendurar(rec, m['pendurado'], escala)
            ent['caixa'] = m.get('caixa', caixa)
            if m.get('pendulo'):
                ent['pendulo'] = m['pendulo']
            if m.get('falha'):
                ent['falha'] = True
            if m.get('brilho'):
                bx, by, br = m['brilho']
                ent['brilho'] = {'x': round(bx * img.shape[1], 1), 'y': round(by * img.shape[0], 1), 'r': round(br * img.shape[1], 1)}
            gravar(img, os.path.join(pasta, nome))
            ent['giros'][giro] = {'arquivo': f"{m['def']}/{nome}", 'ax': round(ax, 1), 'ay': round(ay, 1)}
            imgs.append(img)
            print(f"{m['def']} giro {giro}: pendurado, {img.shape[1]}x{img.shape[0]}", flush=True)
            continue
        # nos giros 2 e 6 a largura do móvel corre no eixo y
        troca = giro in ('2', '6')
        Wt, Dt = (D * CASA, W * CASA) if troca else (W * CASA, D * CASA)
        if real:
            wr, dr, hr = (real[1], real[0], real[2]) if troca else (real[0], real[1], real[2])
        else:
            wr, dr, hr = Wt, Dt, m['altura']
        if m.get('como_esta') and m.get('por') == 'imagem':
            # pela altura da imagem inteira, presa no centro da base (planta)
            k = hr * PX_M_VERTICAL / escala / rec.shape[0]
            img = reamostrar(rec, max(1, round(rec.shape[1] * k)), max(1, round(rec.shape[0] * k)))
            gravar(img, os.path.join(pasta, nome))
            if m.get('pisa'):
                ax, ay = pisar(img, Wt, Dt, 0.0, 0.0, Wt, Dt, escala, base=m['pisa'])
                ent['giros'][giro] = {'arquivo': f"{m['def']}/{nome}", 'ax': round(ax, 1), 'ay': round(ay, 1)}
            else:
                ax, ay = ancora_centro(img)
                ent['giros'][giro] = {'arquivo': f"{m['def']}/{nome}", 'ax': round(ax, 1), 'ay': round(ay, 1), 'ancora': 'centro'}
            if m.get('chamas') == 'auto':
                ent.setdefault('chamas', {})[giro] = achar_chamas(img)
            if m.get('brilho'):
                # a luz acesa em volta da cúpula (a luminária de pé), em frações da imagem
                bx, by, br = m['brilho']
                ent['brilho'] = {'x': round(bx * img.shape[1], 1), 'y': round(by * img.shape[0], 1), 'r': round(br * img.shape[1], 1)}
                if m.get('brilho_cor'):
                    ent['brilho']['cor'] = m['brilho_cor']
            imgs.append(img)
            print(f"{m['def']} giro {giro}: pela imagem, {img.shape[1]}x{img.shape[0]}", flush=True)
            continue
        livre = ('proporcao' if m.get('como_esta') else 'tudo') if real else False
        base_cam = CAMERAS.get((m['def'].split('~')[0], giro)) if '~' in m['def'] and not espelho and not m.get('retificar') else None
        if base_cam:
            # outro modelo do mesmo móvel (gun_table~b): o desenho é o do modelo base com outra coisa em
            # cima, no mesmo lugar da folha; medido sozinho, a câmera saía um pouco diferente e os módulos
            # lado a lado ficavam em degrau. Usa a câmera do base, só deslocada pelo recorte.
            cam = dict(base_cam['cam'])
            cam['u0'] += base_cam['origem'][0] - origem[0]
            cam['v0'] += base_cam['origem'][1] - origem[1]
            nota = base_cam['nota']
            print(f"{m['def']} giro {giro}: a câmera do {m['def'].split('~')[0]}", flush=True)
        else:
            ang = angulos_do_desenho(rec) if m.get('angulos') else None
            cam, nota = ajustar_camera(rec[:, :, 3] > 100, wr, dr, hr, livre=livre, angulos=ang)
            if '~' not in m['def'] and not espelho and not m.get('retificar'):
                CAMERAS[(m['def'], giro)] = {'cam': cam, 'origem': origem, 'nota': nota}
        ys_, xs_ = np.nonzero(rec[:, :, 3] > 100)
        vistas.append({'giro': giro, 'nome': nome, 'rec': rec, 'troca': troca, 'Wt': Wt, 'Dt': Dt,
                       'wr': wr, 'dr': dr, 'hr': hr, 'cam': cam, 'nota': nota,
                       # pixels do desenho por metro de verdade
                       'pm': cam['S'] * cam['W'] / wr,
                       'hrec': ys_.max() - ys_.min() + 1, 'wrec': xs_.max() - xs_.min() + 1})
    pm = float(np.median([v['pm'] for v in vistas])) if vistas else 0.0
    if m.get('altura') and real and vistas:
        # a escala de cada vista pela altura de verdade (a frente) ou pela largura da frente (as costas)
        tw, td = m.get('topo', real[:2])
        alvo = (real[2] * PX_M_VERTICAL + (tw + td) / CASA * 16) / escala
        frente = vistas if m['altura'] == 'todas' else [v for v in vistas if v['giro'] in ('4', '2')] or vistas
        for v in frente:
            v['k'] = alvo / v['hrec']
        larg = float(np.mean([v['wrec'] * v['k'] for v in frente]))
        for v in vistas:
            v.setdefault('k', larg / v['wrec'])
    for v in vistas:
        giro, nome, rec, cam, nota = v['giro'], v['nome'], v['rec'], v['cam'], v['nota']
        Wt, Dt, wr, dr, hr = v['Wt'], v['Dt'], v['wr'], v['dr'], v['hr']
        Wd, Dd, Hd = cam['W'], cam['D'], cam['H']
        if m.get('como_esta'):
            if real:
                # o móvel, na escala comum: metros de verdade = unidades da caixa x S / pm
                q = cam['S'] / pm
                bw, bd, bh = Wd * q, Dd * q, Hd * q
            else:
                q, bw, bd, bh = 1.0, Wd, Dd, Hd
            ox, oy = posicao(giro, Wt, Dt, bw, bd, m.get('encosta', False))
            k = (PX_M_TABULEIRO / escala) / (cam['S'] / q)
            img = reamostrar(rec, max(1, round(rec.shape[1] * k)), max(1, round(rec.shape[0] * k)))
            u, vv = proj(np.array([(Wt - ox) / q, (Dt - oy) / q, 0.0]), cam)
            ax, ay = float(u) * k, float(vv) * k
            if m.get('altura'):
                # pela altura de verdade; o fundo e a largura saem do desenho, na proporção da ficha
                k2 = v['k']
                img = reamostrar(rec, max(1, round(rec.shape[1] * k2)), max(1, round(rec.shape[0] * k2)))
                f = (v['wrec'] * k2 * escala / 32 * CASA) / (wr + dr)
                bw, bd, bh = wr * f, dr * f, hr
                ox, oy = posicao(giro, Wt, Dt, bw, bd, m.get('encosta', False))
            elif m.get('largura'):
                # a largura do móvel de verdade na tela, igual nas 4 vistas
                xs_ = np.nonzero((rec[:, :, 3] > 100).any(axis=0))[0]
                if m.get('forma') in ('oval', 'redonda'):
                    alvo = 2 * np.hypot(wr / 2, dr / 2) / CASA * 32 / escala
                else:
                    alvo = (wr + dr) / CASA * 32 / escala
                k2 = alvo / (xs_.max() - xs_.min() + 1)
                img = reamostrar(rec, max(1, round(rec.shape[1] * k2)), max(1, round(rec.shape[0] * k2)))
                bw, bd, bh = wr, dr, bh * k2 / k
                ox, oy = posicao(giro, Wt, Dt, bw, bd, m.get('encosta', False))
            if m.get('pisa') or m.get('largura') or m.get('altura'):
                base = m['pisa'] if isinstance(m.get('pisa'), (int, float)) and not isinstance(m.get('pisa'), bool) else None
                ax, ay = pisar(img, Wt, Dt, ox, oy, bw, bd, escala, base=base)
            elif m.get('pe'):
                # preso pelo pé: o ponto mais baixo do desenho é a quina da frente do móvel, no chão
                op = img[:, :, 3] > 100
                baixo = int(np.nonzero(op.any(axis=1))[0].max())
                xs = np.nonzero(op[baixo])[0]
                dx, dy = (Wt - ox - bw) / CASA, (Dt - oy - bd) / CASA
                ax = (xs.min() + xs.max() + 1) / 2 + (dx - dy) * 32 / escala
                ay = baixo + 1 + (dx + dy) * 16 / escala
            tam = f'{bw:.2f} x {bd:.2f} x {bh:.2f} m'
        else:
            bh = hr if real else Hd
            faixa = None
            if m.get('faixa'):
                f0, f1 = m['faixa'][:2]
                e = (Dd / dr) if v['troca'] else (Wd / wr)
                faixa = (f0 * Hd, f1 * Hd)
                if len(m['faixa']) > 2:
                    n = m['faixa'][2]
                else:
                    # sem o número de vezes: a faixa repete o quanto precisa para o móvel ter a altura de verdade
                    n = max(1.0, (hr * e - f0 * Hd - (1 - f1) * Hd) / ((f1 - f0) * Hd))
                bh = (f0 * Hd + n * (f1 - f0) * Hd + (1 - f1) * Hd) / e
            ox, oy = posicao(giro, Wt, Dt, wr, dr, m.get('encosta', False))
            incl = 0.0
            if m.get('endireitar'):
                incl, conf = inclinacao(rec, cam, v['troca'])
                if conf < 0.3:
                    incl = 0.0
            img, (ax, ay) = renderizar_caixa(rec, cam, (ox, oy, wr, dr, bh), (Wt, Dt), escala, faixa=faixa, troca=v['troca'], fatia=m.get('fatia'), incl=incl)
            tam = f'{wr:.2f} x {dr:.2f} x {bh:.2f} m (o desenho: {Wd:.2f} x {Dd:.2f} x {Hd:.2f})' + (f'; endireitado {incl:+.3f}' if incl else '')
        gravar(img, os.path.join(pasta, nome))
        ent['giros'][giro] = {'arquivo': f"{m['def']}/{nome}", 'ax': round(ax, 1), 'ay': round(ay, 1)}
        if m.get('chamas') == 'auto':
            ent.setdefault('chamas', {})[giro] = achar_chamas(img)
        elif giro in m.get('chamas', {}):
            ent.setdefault('chamas', {})[giro] = [[round(cx * img.shape[1], 1), round(cy * img.shape[0], 1), round(ca * img.shape[0], 1)] for cx, cy, ca in m['chamas'][giro]]
        tela = m.get('tela')
        if tela and giro in tela['giros']:
            fx, fy, fr = tela['giros'][giro]
            t = ent.setdefault('tela', {k: tela[k] for k in ('cores', 'ms', 'modo', 'forca') if k in tela} | {'giros': {}})
            t['giros'][giro] = {'x': round(fx * img.shape[1], 1), 'y': round(fy * img.shape[0], 1), 'r': round(fr * img.shape[1], 1)}
        imgs.append(img)
        print(f"{m['def']} giro {giro}: encaixe {nota:.3f}; desenho a {np.degrees(cam['a']):.0f}° e {np.degrees(cam['t']):.0f}°; {tam}", flush=True)
    if m.get('estados'):
        outros_estados(m, ent, origens, caixas, pasta, imgs)
    if m.get('caixa') and 'caixa' not in ent:
        # a caixa para a ordem de quem fica na frente, quando a do jogo não serve (a porta de cela tem altura 0)
        ent['caixa'] = m['caixa']
    return ent, imgs


def chamas_pela_diferenca(acesa, ax, ay, apagada, bx, by):
    """As chamas: o que é claro e quente no desenho aceso e some no apagado (as duas vistas alinhadas pela âncora)."""
    h, w = acesa.shape[:2]
    dx, dy = int(round(ax - bx)), int(round(ay - by))
    b = np.zeros_like(acesa)
    ys0, ys1 = max(0, dy), min(h, dy + apagada.shape[0])
    xs0, xs1 = max(0, dx), min(w, dx + apagada.shape[1])
    if ys1 > ys0 and xs1 > xs0:
        b[ys0:ys1, xs0:xs1] = apagada[ys0 - dy:ys1 - dy, xs0 - dx:xs1 - dx]
    a = acesa.astype(int)
    dif = np.abs(a[..., :3] - b[..., :3].astype(int)).sum(axis=2)
    quente = (a[..., 3] > 120) & (dif > 150) & (a[..., 0] > 200) & (a[..., 0] - a[..., 2] > 40)
    return achar_chamas(acesa, quente)


def alinhar_estado(base, bax, bay, outra, oax, oay, busca=14, topo=False):
    """
    O deslocamento (em pixels da vista) que põe o desenho do outro estado em cima do estado 0: o que
    tem a menor diferença de cor nos pixels do corpo do estado 0 (a porta aberta muda um pedaço, mas o
    resto do móvel bate). (0, 0) quando a folha já estava no lugar. topo ("alinhar_estado": "topo" na
    ficha, o armário que abre a porta): compara só o tampo (o quinto de cima), que não muda ao abrir, com
    uma busca maior; não serve para o baú, em que é o tampo que abre.
    """
    B = base.astype(np.float32)
    O = outra.astype(np.float32)
    corpo = B[..., 3] > 200
    ys, xs = np.nonzero(corpo)
    if topo:
        alto = ys.max() - ys.min()
        sel = ys < ys.min() + 0.22 * alto
        ys, xs = ys[sel], xs[sel]
        busca = 40
    if len(ys) < 50:
        return 0, 0
    # na tela, o pixel (x, y) do estado 0 cai no pixel (x + ox - bx, y + oy - by) do outro
    dx0, dy0 = int(round(oax - bax)), int(round(oay - bay))
    melhor, achado, zero = None, (0, 0), None
    for sy in range(-busca, busca + 1):
        for sx in range(-busca, busca + 1):
            u, v = xs + dx0 + sx, ys + dy0 + sy
            ok = (u >= 0) & (v >= 0) & (u < O.shape[1]) & (v < O.shape[0])
            dif = np.full(len(ys), 3 * 255.0, dtype=np.float32)
            dif[ok] = np.abs(O[v[ok], u[ok], :3] - B[ys[ok], xs[ok], :3]).sum(axis=1) + (O[v[ok], u[ok], 3] < 128) * 3 * 255.0
            # a mediana: a parte que mudou (a porta aberta) não decide; no tampo, que não muda, a média
            nota = float(dif.mean()) if topo else float(np.median(dif))
            if sx == 0 and sy == 0:
                zero = nota
            if melhor is None or nota < melhor - 1e-3 or (abs(nota - melhor) <= 1e-3 and abs(sx) + abs(sy) < abs(achado[0]) + abs(achado[1])):
                melhor, achado = nota, (sx, sy)
    # só mexe quando o desenho bate claramente melhor (a porta aberta, que muda quase tudo, fica onde está)
    return achado if zero is not None and melhor < 0.6 * zero else (0, 0)


def outros_estados(m, ent, origens, caixas, pasta, imgs):
    """
    As vistas dos outros estados (o armário aberto): cada uma recortada na folha dela, no pedaço
    que cai no mesmo lugar do estado 0, e levada na mesma escala, com a âncora no mesmo ponto
    da folha. Assim o móvel não muda de tamanho nem pula ao trocar de estado.
    """
    assert m.get('como_esta') and not m.get('retificar'), 'estados: só para o móvel desenhado como está'
    for estado, arq in m['estados'].items():
        f = ler(os.path.join(REPO, arq))
        f[:, :, 3] = np.where(f[:, :, 3] < 56, 0, f[:, :, 3])
        cx = pedacos(f[:, :, 3] > 16)
        dest = ent.setdefault('estados', {}).setdefault(estado, {'giros': {}})
        for giro, vista in ent['giros'].items():
            pedaco, (x0, y0), w0, h0, espelho = origens[giro]
            assert not espelho, 'estados: a vista espelhada não tem par na outra folha'
            # o pedaço da outra folha que mais se sobrepõe ao do estado 0
            a0, b0, a1, b1 = caixas[pedaco]

            def sobra(c):
                ix = max(0, min(a1, c[2]) - max(a0, c[0]))
                iy = max(0, min(b1, c[3]) - max(b0, c[1]))
                return ix * iy / ((a1 - a0) * (b1 - b0) + (c[2] - c[0]) * (c[3] - c[1]) - ix * iy)
            j = int(np.argmax([sobra(c) for c in cx]))
            rec, (vx, vy) = recortar_origem(f, cx, j)
            base = ler(os.path.join(pasta, os.path.basename(vista['arquivo'])))
            kx, ky = base.shape[1] / w0, base.shape[0] / h0
            img = reamostrar(rec, max(1, round(rec.shape[1] * kx)), max(1, round(rec.shape[0] * ky)))
            # o ponto da âncora na folha, e na vista nova
            X, Y = x0 + vista['ax'] / kx, y0 + vista['ay'] / ky
            nome = f'giro-{giro}-{estado}.png'
            gravar(img, os.path.join(pasta, nome))
            oax, oay = (X - vx) * kx, (Y - vy) * ky
            # o gerador nem sempre desenha o outro estado no mesmo lugar da folha: acerta pelo desenho
            # (o corpo do móvel, que não muda, cai em cima do corpo do estado 0)
            sx, sy = alinhar_estado(base, vista['ax'], vista['ay'], img, oax, oay, topo=m.get('alinhar_estado') == 'topo')
            if sx or sy:
                print(f"{m['def']} giro {giro}, estado {estado}: alinhado pelo desenho ({sx:+d}, {sy:+d} px)", flush=True)
            dest['giros'][giro] = {'arquivo': f"{m['def']}/{nome}", 'ax': round(oax + sx, 1), 'ay': round(oay + sy, 1)}
            if 'ancora' in vista:
                dest['giros'][giro]['ancora'] = vista['ancora']
            imgs.append(img)
            print(f"{m['def']} giro {giro}, estado {estado}: {img.shape[1]}x{img.shape[0]} (sobreposição {sobra(cx[j]):.2f})", flush=True)
            if m.get('chamas') == 'auto' and estado == '1':
                # aceso no 0 e apagado no 1: as chamas são o que muda de um para o outro
                ent.setdefault('chamas', {})[giro] = chamas_pela_diferenca(base, vista['ax'], vista['ay'], img, dest['giros'][giro]['ax'], dest['giros'][giro]['ay'])
        # "espelhar_estado": {"1": {"6": "2", "0": "4"}}: a vista deste estado que veio torta (o baú
        # aberto visto de costas) é a de outro giro espelhada; a silhueta é a mesma
        for giro, outro in (m.get('espelhar_estado') or {}).get(estado, {}).items():
            v = dest['giros'][outro]
            img = ler(os.path.join(pasta, os.path.basename(v['arquivo'])))[:, ::-1].copy()
            nome = f'giro-{giro}-{estado}.png'
            gravar(img, os.path.join(pasta, nome))
            dest['giros'][giro] = {**v, 'arquivo': f"{m['def']}/{nome}", 'ax': round(img.shape[1] - v['ax'], 1)}
            imgs.append(img)
            print(f"{m['def']} giro {giro}, estado {estado}: o giro {outro} espelhado", flush=True)


def pendurar(rec, pendurado, escala):
    """
    A lâmpada: a imagem pela largura da cúpula, presa no teto no meio da casa. Devolve a
    imagem, a âncora (a quina de baixo da casa, no chão) e a caixa dela no cômodo
    ([x0, x1, y0, y1, z0, z1], z em metros), para a ordem de quem fica na frente.
    """
    largura, teto = pendurado
    k = (PX_M_TABULEIRO / escala) * largura / rec.shape[1]
    img = reamostrar(rec, max(1, round(rec.shape[1] * k)), max(1, round(rec.shape[0] * k)))
    # o topo da imagem (o canopla) fica no teto, no meio da casa; a quina de baixo da casa,
    # no chão, fica 16 px abaixo do meio e mais a altura do teto
    ax = img.shape[1] / 2
    ay = (16 + teto * PX_M_VERTICAL) / escala
    alto = img.shape[0] * escala / PX_M_VERTICAL
    return img, (ax, ay), [0.4, 0.6, 0.4, 0.6, round(teto - alto, 2), teto]


def tapete(m, folha, destino):
    """O tapete: a imagem vista de cima, em pé, a 128 px por casa (o jogo deita no chão)."""
    ys, xs = np.nonzero(folha[:, :, 3] > 16)
    rec = folha[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
    img = reamostrar(rec, m['W'] * 128, m['D'] * 128)
    pasta = os.path.join(destino, m['def'])
    os.makedirs(pasta, exist_ok=True)
    gravar(img, os.path.join(pasta, 'chao.png'))
    print(f"{m['def']}: tapete {img.shape[1]}x{img.shape[0]}", flush=True)
    return {'escala': 1, 'chao': {'arquivo': f"{m['def']}/chao.png"}}, img


def parede(m, folha, caixas, destino, escala):
    """O item de parede: cada vista pela largura que ocupa na tela (na parede e para fora dela), presa no ponto de encosto."""
    pasta = os.path.join(destino, m['def'])
    os.makedirs(pasta, exist_ok=True)
    w, d, _ = m['real']
    ent = {'escala': escala, 'parede': {}}
    if m.get('inclina'):
        # a inclinação das bordas que a arte trouxe, por parede: o jogo inclina a diferença até a da parede (o relógio redondo)
        ent['inclina'] = m['inclina']
    imgs = []
    for chave, (pedaco, fx, fy) in m['parede'].items():
        rec = recortar(folha, caixas, pedaco)
        k = (PX_M_TABULEIRO * 0.7071 * (w + d) / escala) / rec.shape[1]
        img = reamostrar(rec, max(1, round(rec.shape[1] * k)), max(1, round(rec.shape[0] * k)))
        nome = f'parede-{chave}.png'
        gravar(img, os.path.join(pasta, nome))
        ent['parede'][chave] = {'arquivo': f"{m['def']}/{nome}", 'ax': round(fx * img.shape[1], 1), 'ay': round(fy * img.shape[0], 1)}
        if chave in m.get('chamas', {}):
            ent.setdefault('chamas', {})[chave] = [[round(cx * img.shape[1], 1), round(cy * img.shape[0], 1), round(ca * img.shape[0], 1)] for cx, cy, ca in m['chamas'][chave]]
        tela = m.get('tela')
        if tela and chave in tela['paredes']:
            tx, ty, tr = tela['paredes'][chave]
            t = ent.setdefault('tela', {'cores': tela['cores'], 'forca': tela['forca'], 'paredes': {}})
            t['paredes'][chave] = {'x': round(tx * img.shape[1], 1), 'y': round(ty * img.shape[0], 1), 'r': round(tr * img.shape[1], 1)}
        imgs.append(img)
        print(f"{m['def']} {chave}: {img.shape[1]}x{img.shape[0]}", flush=True)
    return ent, imgs


def folha_conf(itens, saida):
    blocos = []
    for _, a, b in itens:
        for img in (a, b):
            if img is None:
                continue
            c = np.zeros(img.shape[:2] + (3,))
            c[:] = (40, 40, 48)
            al = img[:, :, 3:4] / 255.0
            c = img[:, :, :3] * al + c * (1 - al)
            blocos.append(c.astype(np.uint8))
    H = max(b.shape[0] for b in blocos)
    linha = np.concatenate([np.pad(b, ((H - b.shape[0], 0), (0, 6), (0, 0)), constant_values=24) for b in blocos], axis=1)
    gravar(np.concatenate([linha, np.full(linha.shape[:2] + (1,), 255, np.uint8)], axis=2), saida)


if __name__ == '__main__':
    main()
