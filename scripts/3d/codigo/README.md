# Arte feita por código

Os móveis do tabuleiro desenhados por código, sem gerador de imagem: cada móvel é um modelo
(caixas chanfradas, cilindros, elipsoides e polígonos, em metros) e o motor desenha na câmera do
tabuleiro, com a luz de cada face, a sombra macia da luz de cima (no móvel e no chão), o brilho de
louça, vidro e metal, e o contorno. Desenha 4 vezes maior e reduz (as bordas ficam lisas).

| Arquivo | O que tem |
|---|---|
| `motor.py` | a câmera do tabuleiro, as faces, os elipsoides, o mapa de sombra, a luz, o contorno |
| `materiais.py` | os materiais (tábuas, ladrilho, painéis, regiões) |
| `pecas.py` | os modelos dos móveis (armário de cozinha, fogão, pia, mesa, cadeira, caixote, barril, planta, lâmpada) |
| `enfeites.py` | os objetos pequenos (pratos postos, potes, chaleira, pão, frutas, cestos, lenha, tapete) |
| `exportar.py` | gera a arte no formato do jogo (`client/public/arte/mobiliario/<móvel>/giro-N.png` e o `moveis.json`) |
| `cozinha_teste.py` | a Cozinha inteira montada por código, para ver e animar (fora do jogo) |

Gerar: `python exportar.py [móvel ...]` (precisa de numpy e Pillow; sem nome, todos os da lista `MOVEIS`).

No `moveis.json`, a arte por código vem com `exato: true` (o jogo usa a medida `real` direto, sem medir o
desenho, que tem a sombra no chão dentro) e `codigo: true`. O modelo é feito no tamanho de base: o jogo
aplica o `aumento` do catálogo por cima, centra na pegada e encosta na parede como faz com a arte desenhada.

## Moldar a arte do Códex (`--codex --caixa`)

A arte do gerador vem com a câmera um pouco girada ou alta (o móvel sai torto no tabuleiro). Moldar põe a pintura
dele na geometria exata:

- **Molde caixa** (`--caixa`): o molde é a caixa da medida de verdade (`real` da ficha em `scripts/3d/fichas/`). Para
  cada giro, acha a câmera com que o desenho foi feito (`ajustar_camera` do `moveis.py`) e, para cada pixel da caixa
  desenhada na câmera do tabuleiro, leva o ponto para a câmera do desenho e pega a cor. O que o desenho não tem vira
  vazio (o vão entre os pés, a quina da cornija). A sombra vem da caixa (móvel maciço) ou do modelo do código
  esticado para a caixa (mesa e cadeira: `MOLDES`, o terceiro campo).
- **Molde do modelo** (só `--codex`): o mesmo, com o modelo do código no lugar da caixa. Só serve quando o modelo tem
  a forma do desenho; onde não tem, sobra a cor do modelo.

`python exportar.py armario_cozinha --codex --caixa --destino <pasta>` gera numa pasta à parte (com uma cópia do
`moveis.json`), para comparar antes de trocar a arte do jogo. As folhas e a ficha de cada um ficam em `MOLDES`.
