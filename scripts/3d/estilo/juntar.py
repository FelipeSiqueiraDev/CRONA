"""Junta o trabalho dos agentes numa cena só (sala4.py): a lareira e o fogo, as peças 1 e 2 e (se houver) a janela."""
import os, re


def troca(t, a, b):
    assert t.count(a) == 1, a
    return t.replace(a, b)


E = os.path.dirname(os.path.abspath(__file__))
base = open(f'{E}/agente_fogo/sala_fogo2.py').read()
p1 = open(f'{E}/agente_pecas1/pecas1.py').read()
p2 = open(f'{E}/agente_pecas2/pecas2.py').read()
# o _LUZ das peças 2 é outro: não pode trocar o das peças 1
p2 = re.sub(r'\b_LUZ\b', '_LUZ2', p2)
# a mesa num nogueira avermelhado, bem mais escuro que o chão laranja (o Felipe: "a mesa se camufla no chão")
for x, y in (("MESA_TAB = ['#c8844a', '#c07c44', '#cd8b50', '#bb7840']", "MESA_TAB = ['#8e4a2c', '#86442a', '#965230', '#7e4026']"),
             ("lado_long = mad2('#94542e', eixo=0, seed=32, passo=0.045)", "lado_long = mad2('#6c341c', eixo=0, seed=32, passo=0.045)"),
             ("ponta = _ponta_tabuas('#94542e', tabua, org)", "ponta = _ponta_tabuas('#6c341c', tabua, org, junta='#3a1a0c')"),
             ("TOPO = tab2(MESA_TAB, tabua, '#4e2614',", "TOPO = tab2(MESA_TAB, tabua, '#3e1c0e',"),
             ("caixa((x + 0.06, x + w - 0.06, y + 0.06, y + d - 0.06, h - tampo - 0.11, h - tampo), mad2('#6a3820'", "caixa((x + 0.06, x + w - 0.06, y + 0.06, y + d - 0.06, h - tampo - 0.11, h - tampo), mad2('#4a2412'"),
             ("PE = {'cima': mad2('#a8643a'), '*': mad2('#86492a', eixo=1, seed=34, passo=0.05)}", "PE = {'cima': mad2('#7e4026'), '*': mad2('#5e2e18', eixo=1, seed=34, passo=0.05)}"),
             ("TR = {'cima': mad2('#a8643a', eixo=0), '*': mad2('#7a4226', eixo=0, seed=35, passo=0.04)}", "TR = {'cima': mad2('#7e4026', eixo=0), '*': mad2('#5a2c16', eixo=0, seed=35, passo=0.04)}"),
             ("TRy = {'cima': mad2('#a8643a', eixo=1), '*': mad2('#7a4226', eixo=0, seed=35, passo=0.04)}", "TRy = {'cima': mad2('#7e4026', eixo=1), '*': mad2('#5a2c16', eixo=0, seed=35, passo=0.04)}")):
    assert p2.count(x) == 1, x
    p2 = p2.replace(x, y)
# o assento da cadeira no mesmo nogueira da mesa (o laranja também sumia no chão)
x = "tab2(['#c88248', '#c07c44'], s / 2, '#5a2c16'"
assert p2.count(x) == 1
p2 = p2.replace(x, "tab2(['#9a5432', '#92502e'], s / 2, '#3e1c0e'")
i_m = base.index('# ---------- a montagem')
cab, resto = base[:i_m], base[i_m:]
# a chaminé não termina: atravessa a viga e continua para fora da casa, sumindo aos poucos (a fumaça sai lá fora)
cab = troca(cab, "    zch = ALTO + 0.38\n", "    zch = ALTO + 1.6\n")
cab = troca(cab, "    caixa((m - mc, m + mc, 0, fc, zt, zch), {'*': Pch, 'cima': emissivo(topo_chamine)}, sombra=False)",
            "    c.chamine_oid = caixa((m - mc, m + mc, 0, fc, zt, zch), {'*': Pch, 'cima': liso('#c9c8c2')}, sombra=False)")
cab = troca(cab, "for z in (-0.35, ALTO + 0.5)])", "for z in (-0.35, ALTO + 1.75)])")
cab = cab.replace("sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))",
                  "AQUI = os.path.dirname(os.path.abspath(__file__))\n"
                  "sys.path.insert(0, os.path.join(AQUI, 'agente_fogo'))\nsys.path.insert(0, os.path.join(AQUI, 'agente_janela'))")
# o motor fica em scripts/3d/codigo (a cena junta mora um nível acima das pastas dos agentes)
cab = re.sub(r"sys\.path\.insert\(0, [^\n]*'codigo'\)\)|sys\.path\.insert\(0, '/home/user/CRONA/scripts/3d/codigo'\)",
             "sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'codigo'))", cab)
vas = """o = c.novo_obj(3)
c.cilindro(0.66, 5.0, 0.1, 0, 0.26, liso('#8a5230'), M, o, lados=12, tampa_mat=liso('#3a2010'))
for (dx, dy, hh) in ((-0.03, 0.0, 0.62), (0.02, 0.02, 0.55), (0.0, -0.03, 0.5)):
    caixa((0.65 + dx, 0.675 + dx, 4.99 + dy, 5.015 + dy, 0.26, hh), liso('#5a3a22'), sombra=False)
pegadas.append((0.56, 0.76, 4.9, 5.1))
"""
assert resto.count(vas) == 1
resto = resto.replace(vas, 'vasinho_galhos(0.66, 5.0)\n')
# a janela com a cortina (no lugar da plaquinha da esquerda), o sol no chão e a poeira
resto = troca(resto, "placa('x', 3.95, 4.5, 1.85, 2.05)\n", "")
resto = troca(resto, "FOGO = (2.92, 1.1)", "FOGO = (2.92, 1.1)\nfrom janela_px import janela, luz_janela, poeira_janela\nJANELA_T = float(os.environ.get('JANELA_T', '0'))\njanela(c, JANELA_T)")
resto = troca(resto, "brilho = topo & (obj >= 0)", "cor = luz_janela(cor, c, JANELA_T)\nbrilho = topo & (obj >= 0)")
resto = troca(resto, "img = cor\n", "cor = poeira_janela(cor, c, JANELA_T)\nimg = cor\n")
# a chaminé some aos poucos acima da viga (em 4 degraus, para o fundo)
resto = troca(resto, "cor = np.where((obj >= 0)[..., None], cor, fundo)\n",
              "cor = np.where((obj >= 0)[..., None], cor, fundo)\n"
              "_ch = (obj == c.chamine_oid) & (P[..., 2] > ALTO + 0.5)\n"
              "_k = np.ceil(np.clip((P[..., 2] - ALTO - 0.5) / 1.0, 0, 1) * 5) / 5\n"
              "cor = np.where(_ch[..., None], cor * (1 - _k[..., None]) + fundo * _k[..., None], cor)\n")
# a fumaça sai da tampa da chaminé nova
resto = troca(resto, "fumaca_t=float(_amb('FOGO_FUMACA_T')) if _amb('FOGO_FUMACA_T') else None,",
              "fumaca_t=float(_amb('FOGO_FUMACA_T')) if _amb('FOGO_FUMACA_T') else None, fumaca_chamine=0.0,")
txt = cab + '\n' + p1 + '\n\n' + p2 + '\n\n' + resto
open(f'{E}/sala4.py', 'w').write(txt)
print('sala4.py', len(txt.splitlines()), 'linhas')
