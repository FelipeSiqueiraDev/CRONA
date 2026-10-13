# Personagens: gerador de imagem + limpeza por código (estudo de 13/10)

O caminho que deu certo para os bonecos do tabuleiro no estilo novo (pixel art 1:1 da cozinha, `docs/GUIA-MAPAS-PIXEL.md`).
Desenhar o boneco só por código não chegou na qualidade (as tentativas estão em `scripts/3d/estilo/agente_personagem/`:
`alosi.py` 3D, `px.py`, `sprite/`, `sprite2/`, `boneco_1..4/` dos agentes). O que funciona:

1. **O gerador de imagem desenha** (o Felipe pede num chat novo, com as imagens de referência e o prompt abaixo).
2. **O código limpa e harmoniza** (`scripts/3d/estilo/agente_personagem/gerador/`): acha a grade do pixel do gerador,
   reduz para o pixel do mapa, deixa o alfa só 0/255, limita a paleta, troca o contorno pelo dos móveis, põe a sombra dos
   móveis no chão e, à noite, a luz da cena.

Personagem pronto até aqui: **a Alosi** (8 direções paradas aprovadas; o andar com 2 de 8 direções feitas).

## Decisões

- **Altura:** 90 px do pé ao topo do cabelo (a pessoa do tabuleiro tem 94 px = 1,80 m). Todas as poses com a mesma altura.
- **Proporção:** entre chibi e real (a cabeça ~35-38% da altura). A chibi (40%+) parecia criança; a de 3,5 cabeças, pernuda.
- **Móveis em tamanho real:** o "aumento" de 1,2 das cadeiras, mesas e banquetas deixava o boneco pequeno (o encosto da
  cadeira com 1,24 m batia no ombro). Com 1,0 (`AUMENTO=1.0` na cozinha de estudo) ficou certo. **Aprovado pelo Felipe;
  falta passar para o jogo** (`aumento` em `shared/src/furni.ts` e a arte exportada).
- **8 direções desenhadas** (não espelhadas): o livro fica sempre no quadril direito dele. Ordem das folhas:
  linha 1 `n, ne, e, se`; linha 2 `s, sw, w, nw` (n = costas, subindo na tela; se = 3/4 frente para baixo-direita).
- **Guia de ângulo:** o gerador errava os pés e a câmera (desenhava na altura dos olhos). O boneco 3D antigo (`alosi.py`),
  desenhado na câmera exata do jogo, vira o guia: o gerador copia a pose, o ângulo e os pés de cada quadro.
- **Chat novo no gerador a cada pedido novo** (o chat antigo arrasta os erros); dentro de uma mesma série (as direções do
  andar), o mesmo chat, para o boneco não mudar.

## Arquivos

Em `scripts/3d/estilo/agente_personagem/gerador/`:

| Arquivo | O que é |
|---|---|
| `limpar.py` | A limpeza: `limpar_grade(folha, altura=90)` separa os bonecos (linhas e colunas), reduz cada um para 90 px, limpa e redesenha os óculos (acha o brilho da lente) |
| `cena.py` | `harmonizar()` (contorno e linhas de dentro dos móveis) e a cozinha de dia e de noite com os bonecos, sombra e luz da cena; âncora no meio dos pés |
| `gira.py` | Vídeo do boneco girando no lugar (as 8 direções) |
| `andar.py` | Limpa uma folha do andar (mesma escala e mesma janela em todos os quadros de uma linha, âncora no meio do tronco) e faz o vídeo andando pela cozinha |
| `ref_mapa.py` | As referências do mapa para o gerador (um pedaço da cozinha ampliado 4x, com e sem o boneco no tamanho certo) |
| `../guia_andar.py` | Os guias do andar (o boneco 3D, 6 quadros por direção; por folha de 2 direções ou uma por folha) |
| `entrada/` | O que vai para o gerador: `6-mapa-estilo.png`, `8-alosi-aprovado.png`, `9-guia-angulos.png`; `entrada/andar/` os guias do andar e a folha do andar aprovada |
| `alosi_gerador_*.png` | O que o gerador devolveu (v1 chibi, v2 pernuda, v3/v4 3 cabeças, `8dir` sem guia, `guia` = a aprovada com guia) |
| `alosi_gerador_guia_90_<1..8>.png` | **As 8 direções paradas aprovadas**, limpas (90 px), na ordem da folha (1 n ... 8 nw); a 1 (costas) foi espelhada porque o gerador pôs o livro do lado errado |
| `andar_1_n_ne.png`, `andar_1_n_ne_<n|ne>_<0..5>.png` | A folha do andar das costas e 3/4 costas direita, e os 12 quadros limpos |

Prévias em `docs/estilo/`: `alosi-8-direcoes-guia.png`, `alosi-gira-guia.mp4`, `alosi-andar-n-ne*.{mp4,png}`,
`alosi-harmonizada*.png`, `alosi-moveis-12-vs-10.png`.

O retrato e a folha antiga da Alosi (referências da personagem) estão em `client/public/arte/personagens/alosi/`.

## Os prompts

### Parado, 8 direções (com o guia)

Anexar: `9-guia-angulos.png`, `8-alosi-aprovado.png`, `6-mapa-estilo.png`.

```
The FIRST reference image is a POSE AND CAMERA GUIDE: 8 views of a figure, drawn with the exact isometric camera of the game (seen from above at about 30 degrees), in this order: row 1: back, three-quarter back facing up-right, side facing right, three-quarter front facing down-right; row 2: front, three-quarter front facing down-left, side facing left, three-quarter back facing up-left.

Redraw EACH of the 8 views as the character from the SECOND reference image (same young man: messy dark-brown wavy hair, round thin brown glasses, white clerical shirt with high white collar, gold chain with small gold cross, open off-white hooded jacket with gold zipper, black belt with silver buckle and small gold chain, dark charcoal trousers, dark brown boots, small dark-red book on HIS RIGHT HIP; same proportions, about 3 heads tall; same colors and pixel art style), in the pixel art style of the room in the THIRD reference image.

FOR EACH VIEW, COPY FROM THE GUIDE EXACTLY: the body direction, the camera angle (seen from above: we see the top of the head and the shoulders, the feet slightly foreshortened), the stance, and where the FEET POINT. In the back views the toes point away from the viewer (we see the heels); in the three-quarter back views the toes point diagonally away. Do NOT draw the boots pointing at the viewer unless the guide does.

Keep the same layout (2 rows x 4 columns, same order as the guide), every figure the same height, feet on the same baseline in each row. Do not mirror: the book is always on his right hip (hidden behind the body in the left-facing views).

Pixel art rules: crisp square pixels on a regular grid, 1-pixel dark warm-brown outline, flat 3-5 tone shading, light from the top-left. NO anti-aliasing, NO blur, NO stray pixels.
BACKGROUND: fully transparent (or solid flat pure magenta #FF00FF). No floor, no shadow, no text, no numbers.
```

### Andar, uma direção por imagem (com o guia)

Primeira mensagem: `entrada/andar/0-andar-aprovado.png`, `8-alosi-aprovado.png` (as 8 paradas) e o guia da direção.

```
Image 1 is your previous walk sheet, which is APPROVED: keep exactly that character, size, pixel style, outline, colors and walk motion.
Image 2 is the character model in 8 standing directions.
Image 3 is a WALK GUIDE for ONE new direction: 1 row x 6 frames of a looping walk cycle, drawn with the exact isometric camera of the game.

Draw the same walk cycle for this new direction: 1 row x 6 frames, same order as the guide. For EACH frame copy EXACTLY from the guide: the body direction, the camera angle, the position of each leg and foot, the arm swing and the body bob. Copy ONLY pose and angle from the guide; the hair, face and clothes come from images 1 and 2 (ignore the guide's helmet-like hair and its purple ground shadow).

All 6 frames the same height and the same size as the frames in image 1, feet on the same baseline. The character must be identical in all frames; only legs, arms, a slight bounce of the hair and the book, and the 1-pixel body bob change. The book is always on HIS RIGHT HIP (do not mirror): when he faces left, it is on the far side, mostly hidden by his body; when he faces right or toward the viewer, it is visible.

Same pixel art rules as image 1: crisp square pixels on a regular grid, 1-pixel dark warm-brown outline, flat 3-5 tone shading, light from the top-left. NO anti-aliasing, NO blur, NO stray pixels.
BACKGROUND: fully transparent (or solid flat pure magenta #FF00FF). No floor, no shadow, no text, no numbers.
```

As seguintes, no mesmo chat, só com o guia: `Same thing for this new direction guide: 1 row x 6 frames, same character, same size, same style, copy pose, angle and feet from the guide. Book always on his right hip.`

Ordem dos guias que faltam: `guia-1-e`, `guia-2-se`, `guia-3-s`, `guia-4-sw`, `guia-5-w`, `guia-6-nw`.

### Sentado (ainda não pedido)

Só as duas 3/4 (as cadeiras do jogo ficam sempre na diagonal; as outras duas por espelho ou pedidas também), sem a
cadeira, como se num assento de 45 cm. Fazer um guia com o boneco 3D sentado antes de pedir.

## Como rodar

```bash
cd scripts/3d/estilo/agente_personagem/gerador
python3 -c "import limpar; print(limpar.limpar_grade('alosi_gerador_guia.png', 6, sufixo='_90', altura=90))"
python3 cena.py "$PWD/alosi_gerador_guia_90" saida.png         # cozinha de dia e de noite (usa os _1.._5)
python3 gira.py "$PWD/alosi_gerador_guia_90" giro.mp4           # o giro nas 8 direções
python3 andar.py andar_1_n_ne.png n ne andar.mp4                # o andar de uma folha (2 linhas = 2 direções)
python3 ../guia_andar.py <pasta>                                # os guias do andar
```

## Onde parou (13/10, fim da conversa)

- **Andar das costas (`n`, `ne`): pronto, 6 quadros, aprovado** ("ficou ótimo").
- **Tentativas que não serviram para as outras 6 direções:** uma direção por imagem (saíam diferentes entre si), todas
  juntas (o gerador achata para caber) e o "passo de 2 quadros" editando a pose parada (`passo_s*.png`: o Felipe achou
  duro; 4 quadros com o parado no meio não convenceram). **Vale o andar de 6 quadros.**
- **Pedido em andamento:** a mesma receita da folha das costas, 2 direções por pedido, chat novo cada um, com a folha
  aprovada como 4ª imagem. O pacote (`alosi-andar-6-quadros.zip`) tem 3 pastas `1-e-se`, `2-s-sw`, `3-w-nw`, cada uma
  com `1-modelo.png` (= `alosi_gerador_guia.png`), `2-mapa-estilo.png` (= `entrada/6-mapa-estilo.png`),
  `3-guia.png` (= `entrada/andar/guia-andar-<n>-<dir>-<dir>.png`) e `4-andar-aprovado.png`
  (= `entrada/andar/0-andar-aprovado.png`). O LEIA-ME com o prompt: `gerador/pedidos/andar-6-quadros-LEIA-ME.txt`.
- **Quando as folhas chegarem:** `python3 andar.py <folha.png> <dir1> <dir2> saida.mp4` (limpa, harmoniza e faz o
  vídeo). Se vier achatada, corrigir a proporção pela pose parada da mesma direção (`alosi_gerador_guia_90_<n>.png`:
  comparar a largura do tronco e a altura da cabeça, e reduzir com passos diferentes em x e em y). Depois, o vídeo nas
  8 direções pela cozinha.
- `cena.harmonizar` agora só clareia a linha escura fina (o cinto e a calça ficam).

## O andar nas 8 direções (13/10, depois)

As 3 folhas que faltavam chegaram (ChatGPT, um chat só, uma folha por mensagem, fundo branco): `andar_2_e_se.png`,
`andar_3_s_sw.png`, `andar_4_w_nw.png` (o fundo branco ligado à borda virou transparente). `andar8.py` limpa as 4
folhas juntas: os 48 quadros em `andar8/andar-<dir>-<0..5>.png` (90 px, harmonizados), a folha de conferência, o
vídeo das 8 direções no lugar e o vídeo pela cozinha. As alturas no gerador variam só ~5% entre as folhas. O
gerador fechou os olhos no 5º quadro da frente (`s`): os olhos voltam do 4º (`olhos_de`).

## No jogo (13/10)

A Alosi nova está no tabuleiro: `client/public/arte/personagens/alosi/tabuleiro-3d/` (o formato do boneco v2, `anim.json`
lido por `findBoneco`), gravado por `gerador/exportar_jogo.py`: `parado` (a pose aprovada respirando, 4 quadros, 420 ms)
e `andar` (os 6 quadros de `andar8/`) nas 8 direções, `escala` = 1/0,91 (pixel 1:1 no zoom 1), os pés de cada quadro
achados na imagem. Vale no lugar das poses antigas (`tabuleiro-32bits/`, que ficaram). Vídeo: `docs/estilo/alosi-no-jogo.mp4`.

**Pisar no chão (13/10):** sem sombra forte ele parecia flutuar. Agora o pé passa 3 px do ponto do chão (`AFUNDA` no
`exportar_jogo.py`), o boneco em pixel art ganha a pegada em degraus embaixo (`desenharPegada` no `RoomView.ts`, o miolo
mais escuro e um anel mais claro, como a sombra dos móveis) e a sombra de cada pé sobe 1 px (a bota tapa a metade de
cima). Antes e depois: `docs/estilo/alosi-pes-antes-depois.png`.

**Pedidos em andamento** (pacote `alosi-acoes.zip`; LEIA-ME em `gerador/pedidos/acoes-LEIA-ME.txt`; os guias em
`gerador/entrada/acoes/`, feitos por `../guia_acoes.py`): **sentado** (4 diagonais), **abrir o armário** (4 diagonais x
3 quadros) e **andar agachado** (8 direções x 6, 4 folhas). No jogo: `sentado` já é tocado quando a peça está na
cadeira (`sentadoReal` no RoomView); `agachado` e `abrir` ainda precisam de código (o tabuleiro hoje achata a peça
agachada em 72%; o `abrir` precisa de um gatilho quando o mobi ao lado abre).

## Teste: o corpo pelo código, a cabeça da arte aprovada (13/10)

Fazer cada ação no gerador não fecha a conta: ações x 8 direções x quadros x armado/desarmado x machucado passa de mil
quadros por personagem. Teste em `scripts/3d/estilo/agente_personagem/projecao/`:
- `textura.py`: o 3D inteiro pintado com a arte aprovada (cada ponto do corpo posado volta para a pose parada e pega a
  cor da direção que o vê melhor). Refaz bem a pose parada, mas borra quando o corpo dobra (o 3D e a arte não batem
  pixel a pixel). Abandonado.
- `hibrido.py` (o caminho): **o corpo vem do 3D** (`alosi.py`, qualquer pose, com a luz, a rampa e o contorno do
  cenário; as cores de cada material tiradas da arte aprovada) e **a cabeça é recortada da própria arte aprovada**
  daquela direção (ela é rígida: em qualquer pose é a mesma, só muda de lugar), presa no pescoço do 3D.
  Prévias: `docs/estilo/alosi-hibrido-vs-aprovada.png` (em cima o híbrido, embaixo a aprovada) e
  `docs/estilo/alosi-hibrido-andar-agachado.mp4` (andar e agachado nas 8 direções, tudo por código).


1. Sentado, abrir o armário e andar agachado: esperando as imagens do gerador (pacote `alosi-acoes.zip`).
2. Piscar por código em cima das 8 paradas.
3. Passar o `aumento` 1,0 das cadeiras/mesas/banquetas para o jogo.
4. Os outros agentes (Catarina, Cora, Tepes) pelo mesmo caminho.
