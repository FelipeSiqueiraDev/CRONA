# ---------- os móveis no desenho da referência ----------
MOV, MOV_ESC, MOV_CLA = '#8e5631', '#7a4628', '#a2663a'


def cadeira(x, y, costas, s=0.44):
    """A cadeira da referência: o assento escuro, os pés retos, o encosto com a travessa de cima larga e dois sarrafos."""
    hs = 0.47
    caixa((x, x + s, y, y + s, hs - 0.06, hs), {'cima': madeira(MOV_CLA), '*': madeira(MOV)}, sombra=False)
    for (a, b) in ((x + 0.02, y + 0.02), (x + s - 0.08, y + 0.02), (x + 0.02, y + s - 0.08), (x + s - 0.08, y + s - 0.08)):
        caixa((a, a + 0.06, b, b + 0.06, 0, hs - 0.06), madeira(MOV_ESC, eixo=1, veio=False), sombra=False)
    if costas in ('-y', '+y'):
        yy = y + 0.02 if costas == '-y' else y + s - 0.08
        for a in (x + 0.02, x + s - 0.08):
            caixa((a, a + 0.06, yy, yy + 0.06, hs, 1.0), madeira(MOV_ESC, eixo=1, veio=False), sombra=False)
        caixa((x + 0.02, x + s - 0.02, yy, yy + 0.06, 0.8, 0.97), madeira(MOV_CLA), sombra=False)
        for a in (x + 0.14, x + s - 0.19):
            caixa((a, a + 0.05, yy + 0.01, yy + 0.05, hs, 0.8), madeira(MOV), sombra=False)
    else:
        xx = x + 0.02 if costas == '-x' else x + s - 0.08
        for b in (y + 0.02, y + s - 0.08):
            caixa((xx, xx + 0.06, b, b + 0.06, hs, 1.0), madeira(MOV_ESC, eixo=1, veio=False), sombra=False)
        caixa((xx, xx + 0.06, y + 0.02, y + s - 0.02, 0.8, 0.97), madeira(MOV_CLA, eixo=1), sombra=False)
        for b in (y + 0.14, y + s - 0.19):
            caixa((xx + 0.01, xx + 0.05, b, b + 0.05, hs, 0.8), madeira(MOV), sombra=False)
    pegadas.append((x, x + s, y, y + s))


def mesa(x, y, w, d, h=0.78, tampo=0.09, perna=0.1, tabua=0.21):
    eixo = 0 if w >= d else 1
    caixa((x, x + w, y, y + d, h - tampo, h), {'cima': tabuas(['#a8693c', '#b0703f', '#a26438'], tabua, 0.8, '#5e3418', eixo=eixo),
                                              '*': madeira(MOV, eixo=eixo)}, sombra=False)
    caixa((x + 0.06, x + w - 0.06, y + 0.06, y + d - 0.06, h - tampo - 0.11, h - tampo), madeira(MOV_ESC, eixo=eixo), sombra=False)
    for (a, b) in ((x + 0.04, y + 0.04), (x + w - 0.04 - perna, y + 0.04), (x + 0.04, y + d - 0.04 - perna), (x + w - 0.04 - perna, y + d - 0.04 - perna)):
        caixa((a, a + perna, b, b + perna, 0, h - tampo), madeira(MOV, eixo=1), sombra=False)
    pegadas.append((x, x + w, y, y + d))


def estante_parede_tras(x0, x1, fundo=0.36, h=1.45, prat=(0.05, 0.4, 0.75, 1.1), seed=1):
    """A estante de livros encostada na parede de trás (y = 0), com o tampo e as prateleiras cheias."""
    lado, topo = madeira(MOV, eixo=1), madeira(MOV_CLA)
    caixa((x0, x0 + 0.06, 0, fundo, 0, h), {'*': lado, 'cima': topo})
    caixa((x1 - 0.06, x1, 0, fundo, 0, h), {'*': lado, 'cima': topo})
    caixa((x0, x1, 0, 0.03, 0, h), liso('#4e2a16'))
    caixa((x0 - 0.02, x1 + 0.02, 0, fundo + 0.02, h - 0.05, h), {'cima': topo, '*': madeira(MOV)})
    for i, z in enumerate(prat):
        caixa((x0 + 0.06, x1 - 0.06, 0, fundo, z, z + 0.04), {'cima': topo, '*': madeira(MOV)})
        livros(x0 + 0.06, x1 - 0.06, 0, z + 0.04, fundo, seed + i, alto=0.3 if i < 3 else 0.26)
    # em cima: dois potes e uma garrafa
    for (xx, r, hh, cor) in ((x0 + 0.15, 0.06, 0.12, '#8a5a34'), (x0 + 0.32, 0.05, 0.09, '#a06a40')):
        o = c.novo_obj(3)
        c.cilindro(xx, fundo / 2, r, h, h + hh, liso(cor), M, o, lados=12, tampa_mat=liso('#5a3420'))
    o = c.novo_obj(3)
    c.cilindro(x0 + 0.46, fundo / 2, 0.035, h, h + 0.22, liso('#6e4028'), M, o, lados=10)


def livros(x0, x1, y, z, fundo, seed, alto=0.3):
    x = x0 + 0.03
    i = 0
    cores = ['#7a3a2e', '#5a3a26', '#6e4a2e', '#3e4a52', '#8a5a34', '#5e3a3a']
    while x < x1 - 0.06:
        r = ruido(i, seed)
        if r < 0.55:
            n = 2 + int(ruido(i, seed + 1) * 4)
            for k in range(n):
                if x > x1 - 0.06:
                    break
                cor = cores[int(ruido(i, k, seed) * len(cores))]
                hh = alto * (0.72 + 0.22 * ruido(k, i, seed + 2))
                ww = 0.045 + 0.02 * ruido(k, i, seed + 3)
                caixa((x, x + ww, y + 0.05, y + fundo - 0.05, z, z + hh), {'*': liso(cor), 'cima': liso('#d8ccb0')}, sombra=False)
                x += ww + 0.003
        elif r < 0.8:
            # a pilha de livros deitados
            for k in range(3):
                cor = cores[int(ruido(i, k, seed + 7) * len(cores))]
                caixa((x, x + 0.2, y + 0.06, y + fundo - 0.06, z + k * 0.045, z + (k + 1) * 0.045), {'*': liso(cor), 'cima': liso(cor)}, sombra=False)
            x += 0.21
        else:
            o = c.novo_obj(3)
            c.cilindro(x + 0.09, y + fundo / 2, 0.09, z, z + 0.08, liso('#5a6a74'), M, o, lados=14, r1=0.1, tampa_mat=liso('#3a4248'))
            x += 0.2
        x += 0.025
        i += 1


def lareira(m, largura=1.3):
    """
    A lareira da referência: a base de pedra com a boca (o fogo e a lenha), a laje de pedra clara na frente, o
    consolo, o capelo que afina em degraus e a chaminé estreita até a viga.
    """
    P = pedras(PEDRA, PEDRA_J, alt=0.15, comp=0.27)
    PC = pedras(['#cfcec8', '#c4c3bd', '#d8d7d1'], PEDRA_J, alt=0.1, comp=0.3)
    meia = largura / 2
    fundo = 0.62
    # a laje da frente (a pedra do pé), mais larga
    caixa((m - meia - 0.1, m + meia + 0.1, 0, fundo + 0.34, 0, 0.1), {'*': PC, 'cima': PC})
    # a base, com a boca
    caixa((m - meia, m + meia, 0, fundo, 0.1, 0.78), {'*': P, 'cima': P})
    yb = fundo + 0.002
    o = c.novo_obj(3)
    c.face_plana([(m - 0.34, yb, 0.1), (m + 0.34, yb, 0.1), (m + 0.34, yb, 0.62), (m - 0.34, yb, 0.62)], (0, 1, 0), liso('#22140f'), M, o)
    # a verga de pedra clara em cima da boca
    caixa((m - 0.42, m + 0.42, fundo - 0.01, fundo + 0.04, 0.6, 0.72), {'*': PC})
    fogo = c.novo_obj(3, contorno=False)
    luzes.add(fogo)
    yf = yb + 0.004
    for (a, w_, hh, cor) in ((-0.24, 0.18, 0.26, '#d0582a'), (-0.12, 0.22, 0.38, '#ec8a2c'), (0.04, 0.2, 0.3, '#d0582a'),
                             (-0.07, 0.15, 0.27, '#f6bc3e'), (-0.02, 0.07, 0.16, '#fff1a6')):
        c.face_plana([(m + a, yf, 0.18), (m + a + w_, yf, 0.18), (m + a + w_ * 0.55, yf, 0.18 + hh)], (0, 1, 0), liso(cor), M, fogo)
    for k in range(3):
        caixa((m - 0.26 + k * 0.17, m - 0.12 + k * 0.17, fundo - 0.06, fundo + 0.12, 0.1, 0.18), {'*': liso('#5e3820'), 'cima': liso('#a06a40')}, sombra=False)
    # o consolo (a laje clara) e o capelo em degraus
    caixa((m - meia - 0.05, m + meia + 0.05, 0, fundo + 0.06, 0.78, 0.88), {'*': PC, 'cima': PC})
    degraus = ((meia - 0.08, fundo - 0.06, 0.88, 1.12), (meia - 0.2, fundo - 0.14, 1.12, 1.34), (meia - 0.32, fundo - 0.22, 1.34, 1.52))
    for (mm, ff, z0, z1) in degraus:
        caixa((m - mm, m + mm, 0, ff, z0, z1), {'*': P, 'cima': PC})
    caixa((m - 0.27, m + 0.27, 0, 0.42, 1.52, ALTO + 0.3), {'*': P, 'cima': PC})
    pegadas.append((m - meia - 0.1, m + meia + 0.1, 0, fundo + 0.34))


def sofa(x, y0, y1):
    """O sofá de couro de dois lugares encostado na parede da esquerda (x = 0), virado para +x."""
    C, Cc = liso(COURO), liso(COURO_C)
    prof = 0.82
    caixa((x + 0.03, x + prof, y0 + 0.03, y1 - 0.03, 0.0, 0.08), liso('#4a2a18'))
    caixa((x, x + prof, y0, y1, 0.08, 0.4), {'*': C, 'cima': Cc}, ch=0.05)
    caixa((x, x + 0.26, y0 + 0.02, y1 - 0.02, 0.36, 0.86), {'*': C, 'cima': Cc}, ch=0.09)
    caixa((x, x + prof, y0, y0 + 0.22, 0.36, 0.64), {'*': C, 'cima': Cc}, ch=0.1)
    caixa((x, x + prof, y1 - 0.22, y1, 0.36, 0.64), {'*': C, 'cima': Cc}, ch=0.1)
    mm = (y0 + y1) / 2
    caixa((x + 0.24, x + prof - 0.02, y0 + 0.22, mm - 0.01, 0.38, 0.52), {'*': C, 'cima': Cc}, sombra=False, ch=0.05)
    caixa((x + 0.24, x + prof - 0.02, mm + 0.01, y1 - 0.22, 0.38, 0.52), {'*': C, 'cima': Cc}, sombra=False, ch=0.05)
    caixa((x + 0.06, x + 0.26, y0 + 0.22, mm - 0.01, 0.5, 0.82), {'*': C, 'cima': Cc}, sombra=False, ch=0.06)
    caixa((x + 0.06, x + 0.26, mm + 0.01, y1 - 0.22, 0.5, 0.82), {'*': C, 'cima': Cc}, sombra=False, ch=0.06)
    pegadas.append((x, x + prof, y0, y1))


def porta(y0, y1, alto=1.92):
    """A porta na parede da esquerda (x = 0): o batente, as tábuas, a janelinha de 4 vidros em cima e a maçaneta."""
    caixa((0, 0.07, y0 - 0.09, y1 + 0.09, 0, alto + 0.1), madeira('#8a5232', eixo=1), tipo=2)
    caixa((0, 0.08, y0 - 0.12, y1 + 0.12, alto + 0.02, alto + 0.14), madeira('#9a5e36', eixo=1), tipo=2)
    caixa((0, 0.05, y0, y1, 0, alto), {'dir': tabuas(['#7e4a2c', '#86502f', '#7a462a'], 0.16, 9, '#4e2a16', eixo=1, ponta=False), '*': liso('#6e3e22')}, tipo=2)
    caixa((0, 0.07, y0 + 0.08, y1 - 0.08, 1.12, 1.78), madeira('#6e3e22', eixo=1), tipo=2)
    vidro = emissivo(lambda L, n, P: np.where(((L[:, 2] + L[:, 1] * 0.9) % 0.5 < 0.06)[:, None], hx('#eef8fc'), hx('#a8d6ea')))
    ym = (y0 + y1) / 2
    for (a0, a1, b0, b1) in ((y0 + 0.12, ym - 0.025, 1.47, 1.74), (ym + 0.025, y1 - 0.12, 1.47, 1.74),
                             (y0 + 0.12, ym - 0.025, 1.16, 1.42), (ym + 0.025, y1 - 0.12, 1.16, 1.42)):
        caixa((0, 0.072, a0, a1, b0, b1), {'dir': vidro, '*': liso('#6e3e22')}, tipo=2)
    caixa((0.05, 0.12, y0 + 0.08, y0 + 0.15, 0.92, 1.0), liso('#3a3a3e'), tipo=2)


def barril_cesto(x, y, r=0.24, h=0.4):
    """O barril baixo da frente: o corpo de aduelas, a tampa de madeira clara e as duas cintas escuras."""
    o = c.novo_obj(3)
    adu = emissivo(lambda L, n, P: np.where(((np.arctan2(P[:, 1] - y, P[:, 0] - x) / (2 * math.pi) * 14) % 1 < 0.12)[:, None], hx('#5a3018'), hx('#8a5230')))
    c.cilindro(x, y, r, 0, h, adu, M, o, lados=18, tampa_mat=tabuas(['#c08a52', '#b47e48'], 0.08, 9, '#6a3a1e', ponta=False))
    for z in (0.05, h - 0.11):
        o2 = c.novo_obj(3)
        c.cilindro(x, y, r + 0.012, z, z + 0.07, liso('#3e3e44'), M, o2, lados=18, tampa=False)
    pegadas.append((x - r, x + r, y - r, y + r))


def pote_barro(x, y, z, r=0.09, h=0.16):
    o = c.novo_obj(3)
    c.cilindro(x, y, r, z, z + h, liso('#8a5230'), M, o, lados=14, tampa_mat=liso('#5a3018'))
    o = c.novo_obj(3)
    c.cilindro(x, y, r + 0.01, z + h * 0.35, z + h * 0.5, liso('#6a3a1e'), M, o, lados=14, tampa=False)


def pinheirinho(x, y, z):
    o = c.novo_obj(3)
    c.cilindro(x, y, 0.08, z, z + 0.11, liso('#9a5434'), M, o, lados=12, tampa_mat=liso('#4a3020'))
    for k, (r, a) in enumerate(((0.15, 0.09), (0.12, 0.2), (0.085, 0.31), (0.05, 0.4))):
        o = c.novo_obj(3)
        c.cilindro(x, y, r, z + a, z + a + 0.15, liso(['#2f6440', '#367048', '#3e7a50', '#468458'][k]), M, o, lados=14, r1=0.012)


def vaso(x, y, z):
    o = c.novo_obj(3)
    c.cilindro(x, y, 0.06, z, z + 0.09, liso('#a85a36'), M, o, lados=12, tampa_mat=liso('#4a3020'))
    for (dx, dy, dz, r) in ((0, 0, 0.13, 0.06), (0.04, 0.02, 0.11, 0.045), (-0.035, 0.03, 0.115, 0.045), (0.01, -0.035, 0.12, 0.045)):
        o = c.novo_obj(3)
        c.elipsoide(np.array([x + dx, y + dy, z + dz]), np.array([r, r, r * 0.9]), liso('#4e8a4e'), o)


def piano(x0, x1, fundo=0.55):
    """A escrivaninha com o teclado, encostada na parede de trás (y = 0), e o caixote embaixo."""
    h = 0.8
    caixa((x0, x1, 0, fundo, h - 0.06, h), {'cima': madeira(MOV_CLA), '*': madeira(MOV)}, sombra=False)
    for (a, b) in ((x0 + 0.03, 0.03), (x1 - 0.1, 0.03), (x0 + 0.03, fundo - 0.1), (x1 - 0.1, fundo - 0.1)):
        caixa((a, a + 0.07, b, b + 0.07, 0, h - 0.06), madeira(MOV_ESC, eixo=1, veio=False), sombra=False)
    caixa((x0 + 0.05, x1 - 0.05, 0.05, fundo - 0.05, 0.1, 0.14), madeira(MOV_ESC), sombra=False)
    # o teclado: o corpo escuro, a fileira de botões e as teclas
    caixa((x0 + 0.04, x1 - 0.04, 0.04, fundo - 0.06, h, h + 0.08), {'*': liso('#2e2a2e'), 'cima': liso('#3a353a')}, sombra=False)
    caixa((x0 + 0.04, x1 - 0.04, 0.04, 0.16, h + 0.08, h + 0.2), {'*': liso('#2e2a2e'), 'cima': liso('#46404a')}, sombra=False)
    tecla = emissivo(lambda L, n, P: np.where(((L[:, 0] / 0.04) % 1 < 0.3)[:, None] & (L[:, 1] < 0.32)[:, None], hx('#2a2628'), hx('#f2eee6')))
    caixa((x0 + 0.08, x1 - 0.08, 0.18, fundo - 0.09, h + 0.08, h + 0.095), {'cima': tecla, '*': liso('#cfcac2')}, sombra=False)
    # o caixote embaixo
    caixa((x0 + 0.12, x0 + 0.42, 0.08, 0.4, 0.14, 0.36), {'*': madeira('#9a6238'), 'cima': madeira('#a8703f')}, sombra=False)
    pegadas.append((x0, x1, 0, fundo))


def relogio_parede(xc, z, r=0.2):
    """O relógio redondo na parede de trás (y = 0)."""
    disco_de_pe(xc, 0.04, z, r, liso('#4a2a18'), lados=24)
    disco_de_pe(xc, 0.045, z, r - 0.04, liso('#f0ead8'), lados=24)
    o = c.novo_obj(3, contorno=False)
    c.face_plana([(xc - 0.01, 0.05, z), (xc + 0.01, 0.05, z), (xc + 0.01, 0.05, z + 0.12), (xc - 0.01, 0.05, z + 0.12)], (0, 1, 0), liso('#2a2020'), M, o)
    c.face_plana([(xc, 0.05, z - 0.01), (xc + 0.09, 0.05, z - 0.01), (xc + 0.09, 0.05, z + 0.01), (xc, 0.05, z + 0.01)], (0, 1, 0), liso('#2a2020'), M, o)


def quadro_esq(y0, y1, z0, z1):
    """O quadro na parede da esquerda (x = 0): a moldura, o céu, a montanha e o campo."""
    caixa((0, 0.05, y0, y1, z0, z1), madeira('#6e3e22', eixo=1), tipo=2)
    paisagem = emissivo(lambda L, n, P: np.where((L[:, 2] < z0 + 0.12 + 0.1 * np.abs(np.sin((L[:, 1] - y0) * 6)))[:, None],
                                                 np.where((L[:, 2] < z0 + 0.14)[:, None], hx('#6a6a3e'), hx('#7e8a8a')), hx('#d8d0b8')))
    caixa((0, 0.055, y0 + 0.05, y1 - 0.05, z0 + 0.05, z1 - 0.05), {'dir': paisagem, '*': liso('#6e3e22')}, tipo=2)


def placa(eixo, a0, a1, z0, z1):
    """A plaquinha de madeira na parede."""
    if eixo == 'x':
        caixa((0, 0.04, a0, a1, z0, z1), madeira('#7a4424', eixo=1), tipo=2)
        caixa((0, 0.045, a0 + 0.03, a1 - 0.03, z0 + 0.03, z1 - 0.03), liso('#a06a3e'), tipo=2)
    else:
        caixa((a0, a1, 0, 0.04, z0, z1), madeira('#7a4424'), tipo=2)
        caixa((a0 + 0.03, a1 - 0.03, 0, 0.045, z0 + 0.03, z1 - 0.03), liso('#a06a3e'), tipo=2)


def estante_baixa(y0, y1, fundo=0.4, h=0.92):
    """A estante baixa encostada na parede da esquerda (x = 0), na ponta da frente: duas prateleiras com coisas."""
    lado, topo = madeira(MOV), madeira(MOV_CLA, eixo=1)
    caixa((0, fundo, y0, y0 + 0.06, 0, h), {'*': lado, 'cima': topo})
    caixa((0, fundo, y1 - 0.06, y1, 0, h), {'*': lado, 'cima': topo})
    caixa((0, 0.03, y0, y1, 0, h), liso('#4e2a16'))
    for z in (0.04, 0.44):
        caixa((0, fundo, y0 + 0.06, y1 - 0.06, z, z + 0.04), {'cima': topo, '*': madeira(MOV, eixo=1)})
    caixa((0, fundo + 0.02, y0 - 0.02, y1 + 0.02, h - 0.05, h), {'cima': topo, '*': madeira(MOV, eixo=1)})
    # nas prateleiras: os livros deitados, a cesta e os potes
    for k, cor in enumerate(('#5a3a26', '#6e4a2e', '#3e4a52')):
        caixa((0.06, fundo - 0.06, y0 + 0.12, y0 + 0.42, 0.08 + k * 0.05, 0.13 + k * 0.05), liso(cor), sombra=False)
    o = c.novo_obj(3)
    c.cilindro(fundo / 2, y1 - 0.25, 0.12, 0.08, 0.2, liso('#4e5a62'), M, o, lados=14, r1=0.14, tampa_mat=liso('#2e363c'))
    caixa((0.06, fundo - 0.06, y0 + 0.14, y0 + 0.5, 0.48, 0.64), {'*': madeira('#8a5a34'), 'cima': madeira('#9a6a3e')}, sombra=False)
    o = c.novo_obj(3)
    c.cilindro(fundo / 2, y1 - 0.24, 0.1, 0.48, 0.56, liso('#6a6a6e'), M, o, lados=14, r1=0.12, tampa_mat=liso('#3a3a3e'))
    # em cima: o pote de barro e o pinheirinho
    pote_barro(fundo / 2, y0 + 0.3, h, r=0.11, h=0.2)
    pinheirinho(fundo / 2, y1 - 0.3, h)
    pegadas.append((0, fundo, y0, y1))


def mesinha(x, y, w=0.62, d=0.5):
    """A mesinha da frente do sofá, com a bolsa e a caixinha em cima."""
    mesa(x, y, w, d, h=0.55, tampo=0.07, perna=0.08, tabua=0.16)
    caixa((x + 0.1, x + 0.34, y + 0.12, y + 0.26, 0.55, 0.68), {'*': liso('#7a4a2c'), 'cima': liso('#8a5634')}, sombra=False, ch=0.03)
    caixa((x + 0.38, x + 0.52, y + 0.22, y + 0.36, 0.55, 0.62), {'*': liso('#5a4a40'), 'cima': liso('#6e5e52')}, sombra=False)
