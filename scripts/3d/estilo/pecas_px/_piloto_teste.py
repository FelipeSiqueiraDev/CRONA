"""Piloto da linha de produção (apagar depois): uma peça de chão, um item de parede e um estilo."""
import cozinha as CZ
import base_estilo as BE

CASA = 0.75


def _criado():
    # criado-mudo de 1 casa: caixa de madeira com tampo
    m = BE.mad2('#7a4a2a', eixo=0)
    CZ.caixa((0.12, 0.63, 0.15, 0.6, 0.0, 0.52), m)
    CZ.caixa((0.1, 0.65, 0.13, 0.62, 0.52, 0.56), BE.mad2('#946038', eixo=0))
    CZ.pegadas.append((0.1, 0.65, 0.13, 0.62))


def _espelho():
    # espelho oval na parede: moldura e o vidro, saindo 3 cm da parede (y > 0), meio em x = 1.5, z = 1.6
    CZ.caixa((1.3, 1.7, 0.0, 0.03, 1.3, 1.9), BE.mad2('#6e4026', eixo=2))
    CZ.caixa((1.34, 1.66, 0.03, 0.035, 1.34, 1.86), BE.liso('#b8d0d8'))


ITENS = {
    'piloto_criado': (1, 1, (0.0, 0.0), _criado, {}),
}
ITENS_PAREDE = {
    'piloto_espelho': (_espelho, (1.5, 1.6)),
}
ESTILOS = {
    'piloto_taco': {'piso': lambda: BE.tab2(['#7a4a2a', '#84522e'], 0.1, eixo=0), 'parede': lambda eixo: CZ.parede(eixo), 'rodape': ('#6e4026', '#8a5434')},
}
