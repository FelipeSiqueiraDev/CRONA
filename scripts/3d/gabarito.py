"""
Gabaritos dos pedidos de arte: o contorno exato de cada peça na câmera do tabuleiro (2:1), em escala,
para o gerador desenhar por cima, no tamanho certo e seguindo o chão e a parede. Vão na pasta da arte
do GPT junto do pedido (gabaritos/pedidos/), e a conferência da entrega é a medida deles
(scripts/3d/conferir_arte.py).

  python scripts/3d/gabarito.py <pedido.json> <pasta de saída>

O pedido é uma lista de peças:
  {"nome": "carrinho-enfermagem", "titulo": "Carrinho de enfermagem", "casas": [1, 1], "real": [0.7, 0.45, 0.95]}
  {"nome": "porta", "titulo": "Porta", "parede": true, "real": [0.75, 0.06, 2.17], "vao": [0.65, 2.10]}
- Peça de chão: as 4 vistas na ordem das folhas (a frente em vermelho, as costas em azul), a pegada em
  casas (0,75 m cada) e a caixa de verdade (largura ao longo da frente × fundo × altura, em metros) no
  meio da pegada ou, com "encosta": true, no fundo dela.
- Peça de parede: as 2 vistas (na parede da direita e na da esquerda), a parede em casas e a peça no
  meio da casa do meio; "real" = [largura na parede, quanto sai dela, altura]; "vao" (a porta) = o
  buraco, embaixo e no meio. "alto": a altura do pé da peça na parede (o quadro), em metros.
Sempre com uma pessoa de 1,80 m ao lado, para a escala.
"""
import json
import os
import sys

import fitz

CASA = 0.75
# a câmera do tabuleiro (zoom 1): cada metro no chão anda 42,7 px de lado e 21,3 de altura (2 para 1);
# na vertical, 52,3 px por metro
PX_X = 32 / CASA
PX_Y = 16 / CASA
PX_Z = 52.3

FRENTE = (0.82, 0.16, 0.16)
COSTAS = (0.16, 0.32, 0.86)
LADO = (0.45, 0.45, 0.45)
CHAO = (0.62, 0.6, 0.55)
PAREDE = (0.78, 0.77, 0.74)
PESSOA = (0.5, 0.5, 0.5)
TEXTO = (0.12, 0.12, 0.12)
FUNDO = (0.96, 0.95, 0.93)

CEL_L, CEL_A = 760, 640
TOPO = 70


def ponto(o, s, x, y, z):
    return fitz.Point(o[0] + (x - y) * PX_X * s, o[1] + (x + y) * PX_Y * s - z * PX_Z * s)


def poli(sh, pts, cor, fundo=None, opac=0.0, larg=2.0, tracos=None):
    sh.draw_polyline(pts + [pts[0]])
    sh.finish(color=cor, fill=fundo, fill_opacity=opac, width=larg, dashes=tracos, closePath=True)


def linha(sh, a, b, cor, larg=1.0, tracos=None):
    sh.draw_line(a, b)
    sh.finish(color=cor, width=larg, dashes=tracos)


def caixa(sh, o, s, x0, x1, y0, y1, h, cor_x, cor_y):
    """A caixa vista pela câmera: as três faces que aparecem (cima, +x, +y) e as arestas de trás tracejadas."""
    P = lambda x, y, z: ponto(o, s, x, y, z)
    for a, b in ((P(x0, y0, 0), P(x0, y0, h)), (P(x0, y0, 0), P(x1, y0, 0)), (P(x0, y0, 0), P(x0, y1, 0))):
        linha(sh, a, b, LADO, 1.0, '[5 4] 0')
    poli(sh, [P(x1, y0, 0), P(x1, y1, 0), P(x1, y1, h), P(x1, y0, h)], cor_x, cor_x, 0.18, 2.5)
    poli(sh, [P(x0, y1, 0), P(x1, y1, 0), P(x1, y1, h), P(x0, y1, h)], cor_y, cor_y, 0.18, 2.5)
    poli(sh, [P(x0, y0, h), P(x1, y0, h), P(x1, y1, h), P(x0, y1, h)], LADO, LADO, 0.1, 2.0)


def pessoa(sh, o, s, x, y):
    """Uma pessoa de 1,80 m de pé no chão em (x, y): o corpo e a cabeça, cinza claro."""
    base = ponto(o, s, x, y, 0)
    larg = 0.45 * PX_X * s
    alto = 1.8 * PX_Z * s
    cab = 0.11 * PX_Z * s
    sh.draw_rect(fitz.Rect(base.x - larg / 2, base.y - alto + 2 * cab, base.x + larg / 2, base.y))
    sh.finish(color=PESSOA, fill=PESSOA, fill_opacity=0.35, width=1)
    sh.draw_circle(fitz.Point(base.x, base.y - alto + cab), cab)
    sh.finish(color=PESSOA, fill=PESSOA, fill_opacity=0.35, width=1)


def grade(sh, o, s, cx, cy, destaque=None):
    """O chão em casas de 0,75 m (a pegada da peça, mais forte)."""
    for i in range(cx + 1):
        linha(sh, ponto(o, s, i * CASA, 0, 0), ponto(o, s, i * CASA, cy * CASA, 0), CHAO, 1.0)
    for j in range(cy + 1):
        linha(sh, ponto(o, s, 0, j * CASA, 0), ponto(o, s, cx * CASA, j * CASA, 0), CHAO, 1.0)
    if destaque:
        (a0, a1), (b0, b1) = destaque
        pts = [ponto(o, s, a0, b0, 0), ponto(o, s, a1, b0, 0), ponto(o, s, a1, b1, 0), ponto(o, s, a0, b1, 0)]
        poli(sh, pts, CHAO, CHAO, 0.25, 2.0)


def texto(page, x, y, t, tam=15, negrito=False):
    page.insert_text(fitz.Point(x, y), t, fontsize=tam, fontname='hebo' if negrito else 'helv', color=TEXTO)


def m(v):
    return f'{v:.2f}'.replace('.', ',')


def peca_chao(p, saida):
    W, D = p['casas']
    w, d, h = p['real']
    encosta = p.get('encosta', False)
    doc = fitz.open()
    page = doc.new_page(width=CEL_L * 2, height=CEL_A * 2 + TOPO)
    page.draw_rect(page.rect, color=None, fill=FUNDO)
    texto(page, 30, 32, f"{p['titulo']}: {m(w)} x {m(d)} x {m(h)} m (largura na frente x fundo x altura), em {W} x {D} casa(s) de 0,75 m", 17, True)
    texto(page, 30, 56, 'Desenhe POR CIMA da caixa: a peça cabe nela e encosta nas bordas. Frente em vermelho, costas em azul. Linhas do chão: 2 para 1. Pessoa: 1,80 m.', 13)
    # (eixo da largura, de onde vem a frente): v1 frente +y, v2 frente -x, v3 frente -y, v4 frente +x
    vistas = [
        ('VISTA 1: a FRENTE para baixo-esquerda', 'x', '+y', 0, 0),
        ('VISTA 2: a frente para cima-esquerda (aparecem as COSTAS)', 'y', '-x', 1, 0),
        ('VISTA 3: a frente para cima-direita (aparecem as COSTAS)', 'x', '-y', 0, 1),
        ('VISTA 4: a FRENTE para baixo-direita', 'y', '+x', 1, 1),
    ]
    # uma escala só para as 4 (a maior que cabe na célula)
    cx_, cy_ = W, D
    larg_tela = (max(W, D) + min(W, D) + 2.4) * 32
    alt_tela = (W + D + 1) * 16 + max(h, 1.8) * PX_Z
    s = min((CEL_L - 80) / larg_tela, (CEL_A - 90) / alt_tela)
    sh = page.new_shape()
    for titulo, eixo, frente, col, lin in vistas:
        X, Y = (W, D) if eixo == 'x' else (D, W)
        Xm, Ym = X * CASA, Y * CASA
        bw, bd = (w, d) if eixo == 'x' else (d, w)
        # a caixa no meio da pegada, ou com o fundo no lado oposto à frente
        x0, x1 = (Xm - bw) / 2, (Xm + bw) / 2
        y0, y1 = (Ym - bd) / 2, (Ym + bd) / 2
        if encosta:
            if frente == '+y':
                y0, y1 = 0, bd
            elif frente == '-y':
                y0, y1 = Ym - bd, Ym
            elif frente == '+x':
                x0, x1 = 0, bw
            else:
                x0, x1 = Xm - bw, Xm
        # o meio da pegada no meio da célula, um pouco abaixo (a altura sobe)
        ox = col * CEL_L + CEL_L / 2 - (Xm - Ym) / 2 * PX_X * s
        oy = TOPO + lin * CEL_A + CEL_A * 0.62 - (Xm + Ym) / 2 * PX_Y * s + h * PX_Z * s * 0.35
        o = (ox, oy)
        page.draw_rect(fitz.Rect(col * CEL_L + 12, TOPO + lin * CEL_A + 8, (col + 1) * CEL_L - 12, TOPO + (lin + 1) * CEL_A - 8), color=(0.7, 0.7, 0.68), width=1)
        texto(page, col * CEL_L + 26, TOPO + lin * CEL_A + 32, titulo, 14, True)
        grade(sh, o, s, X, Y, ((x0, x1), (y0, y1)))
        pessoa(sh, o, s, Xm + 0.75, 0)
        cor_x = FRENTE if frente == '+x' else COSTAS if frente == '-x' else LADO
        cor_y = FRENTE if frente == '+y' else COSTAS if frente == '-y' else LADO
        caixa(sh, o, s, x0, x1, y0, y1, h, cor_x, cor_y)
    sh.commit()
    page.get_pixmap(dpi=72).save(saida)


def peca_parede(p, saida):
    w, sai, h = p['real']
    vao = p.get('vao')
    pe = p.get('alto', 0.0)
    doc = fitz.open()
    page = doc.new_page(width=CEL_L * 2, height=CEL_A + TOPO)
    page.draw_rect(page.rect, color=None, fill=FUNDO)
    extra = f", vão de {m(vao[0])} x {m(vao[1])} m" if vao else ''
    texto(page, 30, 32, f"{p['titulo']}: {m(w)} m de largura na parede x {m(h)} m de altura, saindo {m(sai)} m da parede{extra}", 17, True)
    # a porta larga (a de enrolar do bar, a dupla do celeiro) ocupa n casas; a parede mostra uma casa a mais de cada lado
    n = max(1, round(w / CASA)) if vao else 1
    if vao:
        casas = '1 casa' if n == 1 else f'{n} casas'
        texto(page, 30, 56, f'Desenhe POR CIMA do contorno (vermelho), sem passar dele: a largura é a de {casas} (o trecho escuro da parede). A parede NÃO entra no desenho. Bordas: 2 para 1.', 13)
    else:
        texto(page, 30, 56, 'Desenhe POR CIMA do contorno (vermelho), sem passar dele. A parede (em casas de 0,75 m) NÃO entra no desenho. As bordas de cima e de baixo seguem a parede: 2 para 1.', 13)
    nc = n + 2
    comp = nc * CASA
    meio = comp / 2
    s = min((CEL_L - 80) / ((nc + 0.6) * 32), (CEL_A - 110) / (nc * 16 + 2.7 * PX_Z))
    sh = page.new_shape()
    for col, titulo in ((0, 'VISTA 1: na PAREDE DA DIREITA (corre como \\), virada para baixo-esquerda'), (1, 'VISTA 2: na PAREDE DA ESQUERDA (corre como /), virada para baixo-direita')):
        ox = col * CEL_L + CEL_L / 2 - (comp / 2 if col == 0 else -comp / 2) * PX_X * s
        oy = TOPO + CEL_A * 0.86 - comp / 2 * PX_Y * s
        o = (ox, oy)
        page.draw_rect(fitz.Rect(col * CEL_L + 12, TOPO + 8, (col + 1) * CEL_L - 12, TOPO + CEL_A - 8), color=(0.7, 0.7, 0.68), width=1)
        texto(page, col * CEL_L + 26, TOPO + 32, titulo, 13, True)
        # a parede (as casas da peça e uma de cada lado) e as casas da peça, mais escuras
        if col == 0:
            P = lambda a, n, z: ponto(o, s, a, n, z)
        else:
            P = lambda a, n, z: ponto(o, s, n, a, z)
        poli(sh, [P(0, 0, 0), P(comp, 0, 0), P(comp, 0, 2.7), P(0, 0, 2.7)], PAREDE, PAREDE, 0.5, 1.0)
        poli(sh, [P(CASA, 0, 0), P((n + 1) * CASA, 0, 0), P((n + 1) * CASA, 0, 2.7), P(CASA, 0, 2.7)], (0.6, 0.6, 0.58), (0.6, 0.6, 0.58), 0.35, 1.0)
        for i in range(nc + 1):
            linha(sh, P(i * CASA, 0, 0), P(i * CASA, 0.35, 0), CHAO, 1.0)
        pessoa(sh, o, s, *((0.35, 0.55) if col == 0 else (0.55, 0.35)))
        a0, a1 = meio - w / 2, meio + w / 2
        z0, z1 = pe, pe + h
        # a peça: a face de frente (saindo "sai" da parede), o topo e o lado que aparecem
        frente = [P(a0, sai, z0), P(a1, sai, z0), P(a1, sai, z1), P(a0, sai, z1)]
        topo = [P(a0, 0, z1), P(a1, 0, z1), P(a1, sai, z1), P(a0, sai, z1)]
        # o lado que aparece: na vista 1, o da ponta de cá (a1); na vista 2, o da ponta de lá também (a1)
        lado = [P(a1, 0, z0), P(a1, sai, z0), P(a1, sai, z1), P(a1, 0, z1)]
        poli(sh, lado, LADO, LADO, 0.2, 2.0)
        poli(sh, topo, LADO, LADO, 0.15, 2.0)
        poli(sh, frente, FRENTE, FRENTE, 0.15, 2.5)
        if vao:
            v0, v1 = meio - vao[0] / 2, meio + vao[0] / 2
            poli(sh, [P(v0, sai, z0), P(v1, sai, z0), P(v1, sai, z0 + vao[1]), P(v0, sai, z0 + vao[1])], (0.1, 0.1, 0.1), (0.1, 0.1, 0.1), 0.55, 2.0)
    sh.commit()
    page.get_pixmap(dpi=72).save(saida)


def peca_pessoa(p, saida):
    """
    O personagem nas 8 direções, na ordem da folha (em cima: n, ne, e, se; embaixo: s, sw, w, nw): em
    cada casa, o losango do chão (1 casa), a caixa de 1,80 m de altura onde ele cabe em pé e a seta
    para onde ele olha. Os pés no meio do losango, na mesma linha em todas.
    """
    alto = p.get('altura', 1.8)
    larg, fundo = p.get('corpo', [0.5, 0.3])
    doc = fitz.open()
    L, A = 380, 560
    page = doc.new_page(width=L * 4, height=A * 2 + TOPO)
    page.draw_rect(page.rect, color=None, fill=FUNDO)
    texto(page, 30, 32, f"{p['titulo']}: {m(alto)} m de altura, em pé no meio da casa (0,75 m), nas 8 direções", 17, True)
    texto(page, 30, 56, 'Desenhe o personagem DENTRO da caixa: a cabeça encosta no topo, os pés no meio do losango, todos na mesma linha. A seta é para onde ele olha.', 13)
    # a direção na tela (para onde ele olha) -> o vetor no chão (x, y); n = para cima na tela
    dirs = [('n', (-1, -1)), ('ne', (0, -1)), ('e', (1, -1)), ('se', (1, 0)), ('s', (1, 1)), ('sw', (0, 1)), ('w', (-1, 1)), ('nw', (-1, 0))]
    nomes = {'n': 'de costas', 'ne': 'costas para a direita', 'e': 'de lado, para a direita', 'se': 'frente para a direita',
             's': 'de frente', 'sw': 'frente para a esquerda', 'w': 'de lado, para a esquerda', 'nw': 'costas para a esquerda'}
    s = (A - 140) / (alto * PX_Z + 32)
    sh = page.new_shape()
    for k, (d, (vx, vy)) in enumerate(dirs):
        col, lin = k % 4, k // 4
        o = (col * L + L / 2, TOPO + lin * A + A - 70 - 16 * s)
        page.draw_rect(fitz.Rect(col * L + 8, TOPO + lin * A + 8, (col + 1) * L - 8, TOPO + (lin + 1) * A - 8), color=(0.7, 0.7, 0.68), width=1)
        texto(page, col * L + 22, TOPO + lin * A + 30, f'{d.upper()}: {nomes[d]}', 13, True)
        # a casa e a caixa do corpo, no meio dela
        P = lambda x, y, z: ponto(o, s, x, y, z)
        poli(sh, [P(0, 0, 0), P(CASA, 0, 0), P(CASA, CASA, 0), P(0, CASA, 0)], CHAO, CHAO, 0.25, 1.5)
        c = CASA / 2
        caixa(sh, o, s, c - larg / 2, c + larg / 2, c - fundo / 2, c + fundo / 2, alto, LADO, LADO)
        # a seta no chão, do meio para a frente
        n = (vx * vx + vy * vy) ** 0.5
        ax, ay = vx / n * 0.45, vy / n * 0.45
        linha(sh, P(c, c, 0), P(c + ax, c + ay, 0), FRENTE, 3.0)
        sh.draw_circle(P(c + ax, c + ay, 0), 4)
        sh.finish(color=FRENTE, fill=FRENTE, width=1)
    sh.commit()
    page.get_pixmap(dpi=72).save(saida)


def peca_tira(p, saida):
    """
    A tira de uma animação: os quadros lado a lado, cada um com a caixa de 1,80 m em pé no meio da
    casa e a LINHA DOS PÉS (a mesma em todos), com o número e o nome da pose de cada quadro.
    """
    quadros = p['quadros']
    alto = p.get('altura', 1.8)
    L, A = 250, 520
    doc = fitz.open()
    page = doc.new_page(width=L * len(quadros), height=A + TOPO)
    page.draw_rect(page.rect, color=None, fill=FUNDO)
    texto(page, 24, 32, f"{p['titulo']}: {len(quadros)} quadros lado a lado, todos do mesmo tamanho", 17, True)
    texto(page, 24, 56, 'A linha vermelha é o chão: os pés pisam nela em todos os quadros (menos onde o quadro diz). O personagem não anda para o lado: fica no lugar.', 13)
    s = (A - 150) / (alto * PX_Z + 32)
    pe = TOPO + A - 60
    sh = page.new_shape()
    for k, nome in enumerate(quadros):
        x0 = k * L
        page.draw_rect(fitz.Rect(x0 + 6, TOPO + 6, x0 + L - 6, TOPO + A - 6), color=(0.7, 0.7, 0.68), width=1)
        texto(page, x0 + 16, TOPO + 28, f'{k + 1}', 22, True)
        texto(page, x0 + 16, TOPO + 50, nome, 11)
        o = (x0 + L / 2, pe - CASA * PX_Y * s)
        P = lambda x, y, z: ponto(o, s, x, y, z)
        poli(sh, [P(0, 0, 0), P(CASA, 0, 0), P(CASA, CASA, 0), P(0, CASA, 0)], CHAO, CHAO, 0.2, 1.0)
        c = CASA / 2
        caixa(sh, o, s, c - 0.25, c + 0.25, c - 0.15, c + 0.15, alto, LADO, LADO)
    linha(sh, fitz.Point(0, pe), fitz.Point(L * len(quadros), pe), FRENTE, 2.0)
    sh.commit()
    page.get_pixmap(dpi=72).save(saida)


def main():
    pedido = json.load(open(sys.argv[1], encoding='utf-8'))
    pasta = sys.argv[2]
    os.makedirs(pasta, exist_ok=True)
    for p in pedido:
        saida = os.path.join(pasta, f"gabarito-{p['nome']}.png")
        (peca_tira if p.get('quadros') else peca_pessoa if p.get('pessoa') else peca_parede if p.get('parede') else peca_chao)(p, saida)
        print(saida)


if __name__ == '__main__':
    main()
