"""
A lâmpada pendurada e a caneca (14/10): as duas da cozinha do estudo (agente_cozinha/cozinha.py), no lugar da arte
antiga do Códex. A lâmpada de esmalte creme com a borda azul, acesa (0) ou apagada (1), com o fio subindo e sumindo
antes do teto; o jogo balança ela no fio (o `pendulo` do moveis.json continua o de antes).
"""
import cozinha as CZ

CASA = 0.75


def _lampada(acesa):
    def d():
        antes = set(CZ.luzes)
        liso = CZ.liso
        if not acesa:
            # apagada: o vidro da lâmpada fica cinza e recebe a luz da face como o resto (não brilha)
            CZ.liso = lambda cor: liso('#b9b2a2' if cor == '#fff4c8' else cor)
        try:
            CZ.lampada(CASA / 2, CASA / 2, zc=2.3)
        finally:
            CZ.liso = liso
        if not acesa:
            for o in set(CZ.luzes) - antes:
                CZ.luzes.discard(o)
        # o exportador some o que passa do teto pelo `fades` (o fio)
        CZ.fades.extend(CZ.fades_atras)
        CZ.fades_atras.clear()
        CZ.lampadas.clear()
    return d


def _caneca():
    CZ.caneca(CASA / 2 - 0.02, CASA / 2, 0.0)
    CZ.itens_peq.append((CASA / 2 - 0.09, CASA / 2 + 0.07, CASA / 2 - 0.07, CASA / 2 + 0.07, 0.0))


ITENS = {
    'ceiling_lamp': (1, 1, (0.0, 0.0), _lampada(True), {'1': _lampada(False)}),
    'mug': (1, 1, (0.0, 0.0), _caneca, {}),
}
