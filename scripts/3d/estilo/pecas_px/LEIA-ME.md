# pecas_px: a linha de produção do tabuleiro em pixel art (só código)

Desde 14/10 o tabuleiro inteiro (Sede, Fazenda, Orfanato) passa para o estilo da cozinha da fazenda: pixel art 1:1
desenhada por código, sem Códex. Cada grupo de peças fica num módulo daqui (`<grupo>.py`), para vários trabalharem
ao mesmo tempo sem mexer no arquivo dos outros. Os exportadores juntam todos os módulos sozinhos.

**Leia antes:** `docs/GUIA-MAPAS-PIXEL.md` (as regras de pixel art, a câmera, as medidas, os erros que já aconteceram)
e abra `docs/estilo/jogo-cozinha-px.png` e `docs/estilo/cozinha-final_cozinha.png`: é o alvo de qualidade.

## O que um módulo tem

```python
import cozinha as CZ          # as peças da cozinha (CZ.caixa, CZ.mesa, CZ.cadeira, CZ.armario, materiais...)
import base_estilo as BE      # os materiais e peças reaproveitáveis (BE.mad2, BE.tab2, BE.liso, BE._pau, BE.vol...)

ITENS = {          # móveis de chão: def -> (largura, fundo em casas, (ox, oy) a quina da pegada em m, desenho, {estado: desenho})
    'nightstand': (1, 1, (0.0, 0.0), _criado, {}),
}
ITENS_PAREDE = {   # itens de parede: def -> (desenho, (x, z) o meio do item na parede de trás, em m)
    'mirror': (_espelho, (1.5, 1.6)),
}
ESTILOS = {        # chão e parede de um estilo de piso: material do chão, da parede (eixo 'x' fundo / 'y' esquerda), rodapé
    'taco': {'piso': lambda: ..., 'parede': lambda eixo: ..., 'rodape': ('#6e4026', '#8a5434'), 'extra': None},
}
FOGO = {}          # opcional: {def: {estado: força}} para o fogo animado (veja o fogão)
```

- **Móvel:** desenhado no **giro 4** (a frente para +y), a pegada começando em (ox, oy), no **tamanho final** (já com o
  `aumento` do catálogo). Chame `CZ.pegadas.append((x0, x1, y0, y1))` com a base, para a sombra macia no chão.
  O exportador desenha os 4 giros sozinho. Peça fechada de todos os lados (o jogador vê as costas).
- **Item de parede:** na parede de trás (o plano y = 0; o item sai para +y), com o meio em (x, 0, z). Sai na parede
  da direita e espelhado na da esquerda.
- **Estados:** o desenho de cada estado (a porta aberta 0, fechada 1, trancada 2; a lâmpada acesa/apagada...).
- Itens pequenos em cima de tampo: `CZ.itens_peq.append((x0, x1, y0, y1, z))` (a sombrinha de contato).

## Medidas (o catálogo é `catalogo-lugares.json`, aqui)

- `def.width` × `def.depth` em casas (1 casa = 0,75 m), no giro 4.
- **`def.height` está em UNIDADES do jogo: metros = height / 1,633.** Ex.: a mesa de cozinha `1.54` = 0,94 m.
- `def.aumento` (1,2 nas mesas e cadeiras): a arte já sai com ele (a mesa de 3 × 2 casas é desenhada com 2,7 × 1,8 m).
- Itens de parede: `def.w` × `def.h` em px do tabuleiro (32 px = 1 casa = 0,75 m na horizontal; 32 px na vertical ≈
  0,61 m). Desenhe no tamanho de verdade que esses px dão.
- `salas`: onde a peça aparece (veja no seed: `server/src/seedSede.ts`, `seedFazenda.ts`, `seedOrfanato.ts`) para
  acertar o clima: a Sede é um prédio velho da Ordem (bar embaixo, laboratório e tecnologia), o casarão da fazenda é
  rural e acolhedor, o Orfanato está QUEIMADO (fuligem, madeira carbonizada, tudo velho).

## Rodar (Python com numpy e Pillow; sempre com `PYTHONIOENCODING=utf-8`)

```bash
cd scripts/3d/estilo
python exportar_px.py --grupo <modulo> --destino <SUA pasta de teste> --folha <pasta>/folha.png
python exportar_parede_px.py --grupo <modulo> --destino <SUA pasta de teste>
python texturas_px.py <estilo> --destino <SUA pasta de teste>
```

**Nunca** grave sem `--destino` (sem ele, vai direto para a arte do jogo, `client/public/arte/`). A folha mostra os
4 giros de cada móvel lado a lado: abra, amplie (recortes em NEAREST) e confira cada peça de perto.

## O que a primeira leva ensinou (14/10)

- **Estados:** luzes e portas: 0 é o "aceso/aberto" (o padrão) e `'1'` o outro (apagado, fechado); a porta tem 0
  aberta, 1 fechada, 2 trancada. **Móveis de abrir (baú, armário, cômoda, gaveteiro, geladeira de vidro, caixote):
  0 FECHADO (o padrão), `'1'` ABERTO** (14/10), e a gêmea `!vazio` também ganha o aberto vazio. Veja `states` no def
  e o quadro em `docs/ATUALIZACAO-14-10.md`.
- **Item de parede com estados:** `ITENS_PAREDE = {def: (desenho, (x, z), {'1': desenho_do_estado_1})}`.
- **Não refaça:** a lâmpada do teto (`ceiling_lamp`), a janela da cozinha, a teia e os móveis da cozinha já estão bons.
- **Exportar para o jogo é no fim, uma vez só:** quem desenha usa sempre `--destino`; e o `moveis.json` só é escrito
  pelos exportadores em Python (outra ferramenta reordena as chaves e vira um diff de milhares de linhas).
- **Clima de cada lugar:** a Fazenda está ABANDONADA há mais de um ano (sóbria, poeira, nada vivo); a Sede é o prédio
  da Ordem, em uso (bar embaixo, laboratório, tecnologia, arsenal, prisão); o Orfanato está QUEIMADO e virou covil.
- **Decalque de chão** (sangue, fuligem, poça, sigilo, sujeira): uma placa de 1 px de altura, sem pegada, sem contorno
  forte; formas irregulares e legíveis, sem pixel solto.
- **Telas e luzes:** a peça acesa precisa se diferenciar da apagada de longe (a tela clara e colorida, a lâmpada amarela).
