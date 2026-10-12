# Tela MAPA: o que é código e o que é arte

Análise da referência de 29/09 (`docs/referencias/mapa.webp`, 16:9), região por região. A lista para ir marcando está em [`CHECKLIST-TELA-MAPA.md`](CHECKLIST-TELA-MAPA.md). Para cada elemento: como o jogo faz e o que precisa vir de fora (arte, dado ou decisão). A tela é desenhada em **1920×1080**.

Resumo:
- **Código (fica igual à referência):** barras, botões, abas, etiquetas, molduras, listas, ícones, a moldura do tabuleiro, as barras de PV/PE/SAN, as fontes, o carimbo e a luz.
- **Arte (sem ela não fica igual):** os papéis envelhecidos, o clipe, as fitas, a rosa dos ventos, a pilha de papéis do canto e, no tabuleiro, os móveis e as texturas da sala.
- **Novo no jogo (dado que ainda não existe):** nome da operação, anotações na planta, etiqueta de área da sala e o painel de ações.

## 1. Barra do topo

| Elemento | Como faço | Precisa de você |
|---|---|---|
| Faixa escura com filete embaixo | CSS (gradiente, ruído fino, filete) | — |
| Emblema | imagem | o logo em `client/public/arte/local/logo-ordem.png` (fora do git) |
| "ORDO REALITAS / SEDE DA ORDEM" | texto em Cinzel, espaçado | — |
| Botões MAPA e COMBATE | CSS: fundo escuro, borda fina; o ativo com borda, fundo e brilho vermelhos. Ícones de mapa e espadas (Lucide) | — |
| Pena apagada | ícone de pena (Lucide) bem transparente | — |
| "OPERAÇÃO FULGOR" | texto | **novo:** nome da operação da campanha (o mestre digita) |
| "SEDE DA ORDEM / ANDAR SUBSOLO" | texto: campanha e andar da cena aberta | — |
| Botões quadrados: clima, configurações, notas, sair | CSS e ícones (Lucide). O de sair em vermelho | — |

## 2. Coluna da esquerda

### Planta do andar

> **Desde 12/10 a planta é o minimapa** (`client/src/ui/minimapa.ts`): níveis Terreno › Prédio › Andar › Cômodo, cartão com Entrar e Levar o grupo, visitado/não visitado, lista de lugares e a planta grande na tecla M, no visual do HUD (azul-noite, borda bege, ouro). A tabela abaixo é do tempo do papel. Ver `EM-ABERTO.md` (12/10).

| Elemento | Como faço | Precisa de você |
|---|---|---|
| Papel envelhecido, rasgado, com a folha de trás | imagem | **arte:** `papel-planta.png` |
| "SUBSOLO" e as etiquetas TÉRREO / SUBSOLO | texto e CSS (a ativa vermelha) | — |
| Rosa dos ventos com o "N" | posso fazer em traço (SVG), mas fica "de computador" | **arte:** `rosa-dos-ventos.png`, para ficar desenhada à mão |
| Salas: blocos cinza com textura de pedra, contorno grosso, portas | canvas, a partir das cenas (já existe; ganha textura e estilo) | — |
| Sala atual em vermelho com o alfinete | canvas e ícone | — |
| Etiquetas com o nome das salas | canvas | — |
| "Instalações Técnicas", "Acesso Restrito" | texto em Caveat, inclinado | **novo:** anotações do mestre na planta, por andar |
| Clipe prendendo a planta ao cartão | imagem | **arte:** `clipe.png` |
| Pedaço de fita no canto | imagem | **arte:** `fita-1.png` |

### Cartão da sala

| Elemento | Como faço | Precisa de você |
|---|---|---|
| Papel mais claro, torto | imagem | **arte:** `papel-sala.png` |
| Polaroid torta com a foto da sala | moldura em CSS; a foto sai da própria cena (já existe) | — |
| Fitas nos cantos da polaroid | imagem | **arte:** `fita-2.png`, `fita-3.png` |
| Traço vermelho e "SALA DE TECNOLOGIA" | CSS e texto | — |
| Descrição | texto da cena (já existe) | — |
| Plaquinhas SUBSOLO e ÁREA TÉCNICA | CSS e ícones | **novo:** etiqueta de área da cena (ex.: "Área técnica") |

### Objeto selecionado

| Elemento | Como faço | Precisa de você |
|---|---|---|
| Papel do painel | imagem | **arte:** `papel-objeto.png` |
| "OBJETO SELECIONADO" em vermelho, com o traço | texto e CSS | — |
| Foto do objeto na moldura | o jogo desenha o móvel num fundo escuro; moldura em CSS | a arte do móvel (seção 3) |
| "COMPUTADOR" e a descrição | texto do objeto (já existe) | — |
| "CONTÉM": linhas com ícone, faixa clara e divisória | CSS e ícones (documento, e-mail, banco de dados); os itens vêm do que está guardado no objeto (já existe) | — |
| Carimbo da Ordem apagado | desenho em código: o emblema no meio e "ORDO REALITAS" em volta | — (usa o logo) |
| Asas apagadas no canto | — | opcional: `asas-marca.png` |

### Cartas do grupo (embaixo)

| Elemento | Como faço | Precisa de você |
|---|---|---|
| Moldura clara gasta, retrato, faixa escura com o nome | CSS e o retrato (já existe) | — |

## 3. Tabuleiro

| Elemento | Como faço | Precisa de você |
|---|---|---|
| Moldura: filete, cantos de mira, riscos no topo, fundo azul-escuro com pontinhos | SVG e CSS | — |
| Botão de centralizar (losango com mira) | SVG | — |
| Piso: carpete roxo com a grade | hoje é desenhado em código (tem o estilo "carpete") | **arte:** textura do carpete roxo, uma casa (64×32) que repete |
| Paredes de tijolo escuro | hoje, cor lisa | **arte:** textura de tijolo para parede, que repete |
| Porta de madeira escura com brilho em volta | hoje, desenho em código | **arte:** porta fechada e aberta |
| Bancadas com monitores azuis e a luz roxa embaixo | hoje, desenho em código | **arte:** bancada com 1, 2 e 3 monitores, de frente e de costas. A luz roxa e o brilho das telas o jogo faz |
| Cadeiras de escritório | hoje, desenho em código | **arte:** cadeira nas 4 direções |
| Lâmpadas fluorescentes | hoje, desenho em código | **arte:** tubo apagado e aceso. O brilho o jogo faz |
| Personagem | folha de sprite (já existe) | — |
| Luz das telas, das lâmpadas e da fita roxa | código (já existe) | — |

Formato dos móveis: `docs/SEDE-DA-ORDEM.md` (casa de 64×32 px = 0,75 m, 1 m de altura = 52,3 px, imagem de frente e de costas).

## 4. Coluna da direita (PLAYERS)

| Elemento | Como faço | Precisa de você |
|---|---|---|
| Folha grande envelhecida | imagem | **arte:** `papel-rpg.png` |
| Abas PLAYERS / INTERLÚDIO / ITENS; a ativa com contorno e traço vermelhos | CSS | — |
| Cartão de cada personagem (papel mais claro) | imagem que estica | **arte:** `carta-player.png` |
| Retrato na moldura escura | CSS e o retrato (já existe) | — |
| Nome, botão "…", alfinete e a sala onde está | texto, CSS, ícones (já existe a sala) | — |
| Barras de PV, PE e SAN com o valor dentro, − e + | CSS (já existem; ganham o estilo da referência) | decidido: − e + nas três barras |

### Aba ITENS (a mochila; referência `docs/ref-itens.jpg`, fora do git)

A mochila de cada agente pela ficha (um inventário só: `docs/REGRAS.md`, Mochila). No topo, a escolha do agente; o cartão com Carga (espaços) e Mãos; os contadores Consumíveis, Chaves e Ritualísticos; EQUIPADO (as duas mãos e o que está vestido); a MOCHILA em grade, com o "+" que abre o catálogo do livro; e o ITEM SELECIONADO, com quatro botões:

- **o vermelho**, o que o item pede: Empunhar ou Guardar (arma, escudo, lanterna; com as mãos cheias, troca), Abrir (documento, carta ou mídia achados: o texto do mestre, no papel da inspeção), Usar (o consumível gasta um), Vestir ou Tirar, ou Inspecionar;
- **Entregar para…** outro agente; **Mover** (para a mão, a roupa ou a mochila); **Descartar**, que larga no chão do cômodo, numa pilha "Itens no Chão" que qualquer um pode pegar.

Clicar na arte do item inspeciona: tipo, categoria, espaços, onde está, ataque ou proteção, as regras curtas e a página do livro. No objeto do tabuleiro (CONTÉM), clicar no item inspeciona (ou lê o documento), e "Pegar" leva o item para a mochila de quem está sob comando.

## 5. Rodapé

| Elemento | Como faço | Precisa de você |
|---|---|---|
| Papel do "Inventário rápido (cenário)" | imagem | **arte:** `papel-inventario.png` |
| Losango vermelho e título | CSS e texto | — |
| Seis espaços escuros com borda | CSS | — |
| Ícones dos itens (documento, pendrive, crachá) | ícones (Lucide) | — |
| Placa escura "AÇÕES" com o traço vermelho | CSS | — |
| Botões Examinar, Abrir, Usar e Entregar; o ativo em vermelho | CSS e ícones (lupa, caixa, mão, setas) | **novo:** o painel de ações sobre o objeto ou item escolhido |
| Pilha de papéis carimbados no canto | imagem | **arte:** `pilha-papeis.png` |
| Fundo quase preto | CSS com ruído | opcional: `fundo-mesa.jpg` |

## A lista de arte, enxuta

Pasta: `client/public/arte/interface/` (o logo em `client/public/arte/local/`). Tamanho em 1920×1080; entregue no dobro.

| Arquivo | Tamanho (1×) | O que é |
|---|---|---|
| `papel-planta.png` | 540×320 | Folha envelhecida da planta, rasgada, com a folha de trás aparecendo no canto |
| `papel-sala.png` | 540×185 | Folha mais clara do cartão da sala |
| `papel-objeto.png` | 540×290 | Folha do objeto selecionado |
| `papel-rpg.png` | 390×790 | Folha grande do painel da direita |
| `papel-inventario.png` | 585×150 | Folha do inventário rápido |
| `carta-player.png` | 370×160 | Cartão claro de cada personagem, com borda de 24 px sem detalhe único (estica) |
| `clipe.png` | 26×62 | Clipe de metal |
| `fita-1.png` a `fita-3.png` | ~80×22 | Fita crepe translúcida |
| `rosa-dos-ventos.png` | 90×90 | Rosa dos ventos a nanquim com o "N" |
| `pilha-papeis.png` | 300×260 | Pilha de fichas e papéis carimbados (sai pela borda da tela) |
| `logo-ordem.png` | 72×72 | O emblema (fica fora do git) |

Na sala (seção 3): carpete roxo, parede de tijolo, porta, bancada de 1, 2 e 3 monitores, cadeira de escritório e lâmpada fluorescente.

Os papéis vêm sem texto e sem ícones pintados. Sombra projetada não vai na arte; sombras internas (dobra, mancha, queimado) vão.
