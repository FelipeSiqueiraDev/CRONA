# Arte do CRONA — como entregar

Quem faz a arte entrega **só arquivos de imagem**. Todo o código (encaixar, animar, ligar aos botões) é feito por quem constrói o jogo. Este guia diz o formato, o tamanho, o nome e a pasta de cada arte.

- **O que falta desenhar, para todas as telas, está numa lista só: [`CHECKLIST-ARTE.md`](CHECKLIST-ARTE.md).** Este guia diz o formato de cada tipo de arte.
- A referência de estilo são as telas novas (`docs/referencias/`: `mapa.webp`, `fichas.webp`, `fichas-celular.webp` e `combate.webp`, com o emblema oficial coberto): pixel art pintada, isométrica, investigação paranormal, luz quente de velas e lamparinas, sombras fundas, papel envelhecido.
- A interface é desenhada para uma tela de **1536×1024**. Entregue as peças da interface no **dobro** do tamanho listado (ex.: 266×453 → 532×906), para ficarem nítidas em telas grandes.

## Regras que valem para tudo

- **Cada peça pedida tem um gabarito (04/10):** a caixa ou o contorno exato dela, em escala, na câmera do tabuleiro, com uma pessoa de 1,80 m (`scripts/3d/gabarito.py`; vão em `gabaritos/pedidos/` na pasta da arte). Desenha-se por cima dele: a peça cabe na caixa, a base nas casas dela (0,75 m cada), as bordas da parede a 2 para 1. A entrega é medida (`scripts/3d/conferir_arte.py`) e o que passar volta.

- **PNG com fundo transparente.** As exceções estão indicadas.
- **Sem texto, sem números e sem ícones pintados** nas peças da interface. O texto é colocado pelo jogo, para poder mudar e animar.
- **Sem sombra projetada** em volta da peça; o jogo aplica a sombra. Sombras internas (dobra, mancha, queimado) fazem parte da arte.
- **Mesma luz em tudo:** luz quente vinda de cima e do centro da tela.
- **Nomes em minúsculas, sem acento e sem espaço** (use hífen), exatamente como nas tabelas.
- Tudo vai em **`client/public/arte/`**, nas subpastas abaixo.

## Tabuleiro: o modelo e a grade (decidido em 30/09)

> **Revisto em 02/10.** Os agentes passam para a **proporção real** (cerca de 7 cabeças), em pixel art detalhada, como a Alosi de jaqueta creme que o Felipe mandou em 02/10 (quatro quadros parados, piscando). O tabuleiro anda com um boneco 3D que tira a pele da **folha das 8 direções** de cada agente nesse estilo (seção 1, "Folha das 8 direções"): o boneco faz o andar e as outras animações. Os **móveis** seguem a folha de objetos do Códex (`mobiliario/props-ordo-realitas.png`), em arte em dobro e desenhada suave (seção 5). A grade continua: casa de 64×32 no zoom normal.

> **Revisto em 03/10: a escala das regras.** A casa tem **0,75 m** (meio quadrado de 1,5 m do livro), nas regras e no desenho; antes o desenho usava 0,68 m e tudo ficava 10% grande demais perto da grade. Na tela, 1 m de altura tem 52 px. Os móveis foram refeitos nessa escala (`scripts/3d/moveis.py`). A arte das pessoas continua saindo na escala antiga (1 m = 57,6 px, a pessoa com 104) e o tabuleiro desenha com 91%: o formato dos pedidos de personagem não muda.

Vale para tudo o que fica no tabuleiro: os bonecos e o mapa (piso, paredes e móveis), que recebem a arte no mesmo estilo.

- **Modelo (revisto em 02/10):** proporção real, com cerca de 7 cabeças de altura, como o Tepes e a Alosi. É o padrão dos quatro agentes; a Catarina e a Cora ganham arte nova nesse estilo. O chibi de cabeça grande, de 30/09, ficou parecendo criança perto dos móveis em tamanho de verdade.
- **Grade 1:1 (revista em 01/10):** 1 pixel da arte = 1 pixel da tela no zoom normal; no zoom 2, cada pixel da arte vira 2. Tudo no tabuleiro usa o mesmo tamanho de pixel; pixel grosso ao lado de pixel fino não combina.
  - Em 30/09 a grade era 2:1, com a pessoa de 52 pixels. Ao encaixar a Alosi (01/10), na de 52 os óculos, a cruz e o rosto viravam uma faixa escura; na de 104 eles ficam. O mapa segue a mesma grade.

| Peça | Na arte (pixels) | Na tela, no zoom normal |
|---|---|---|
| Casa do chão (0,75 m) | losango de 64×32 | 64×32 |
| 1 m de altura | móveis: o construtor escala; pessoas: ~58 | 52,3 |
| Pessoa (1,80 m) | ~104 de altura | 94 |
| Porta (2,15 m) | o construtor escala | 112 |
| Mesa (0,8 m) | o construtor escala | 42 |

- **Pixel duro:** cores chapadas, sem anti-aliasing, sem desfoque e sem brilho em volta. Os bonecos têm contorno escuro; o cenário pode ter contorno mais suave, para os bonecos se destacarem.
- **Luz neutra em tudo:** a luz vem do jogo (escuridão, lamparinas, névoa e o brilho das telas e lâmpadas).
- **Proporção dos móveis:** no tamanho de verdade, em metros, perto da pessoa de 1,80 m (94 pixels no tabuleiro): a cadeira com o assento a 0,46 m, a mesa a 0,78 m e a porta com 2,1 m. O construtor escala cada peça pela altura de verdade (`scripts/3d/moveis.py`).
- **O que o jogo faz:** desenha a arte sem suavizar e com zoom em múltiplos do pixel (0,5×, 1×, 1,5×, 2×...), para cada pixel da arte ficar inteiro na tela.

## 1. Personagens

**Decidido em 04/10:** todos os personagens do tabuleiro são **chibi** (umas 4 a 5 cabeças, 1,80 m de altura como todo mundo), **no traço do cenário**: contorno escuro fino na cor do material, sombreado suave com desgaste, a paleta dessaturada da Sede e a luz de cima, para parecerem parte da mesma cena dos móveis. O pedido e as referências estão no `PROMPT-PERSONAGENS.txt` (pasta da arte do GPT), e as animações, quadro a quadro, no `PROMPT-ANIMACOES.txt` (gabaritos das tiras em `scripts/3d/pedidos/animacoes.json`); o gabarito é o `gabarito-personagem-8-direcoes.png` (`scripts/3d/gabarito.py`, peça `"pessoa"`). **Desde 05/10, desarmado = mãos vazias com a arma guardada no corpo** (a katana da Catarina nas costas, o fuzil da Cora na alça, o códex do Alosi no cinto; o Tepes desarmado sem nada), no mesmo lugar nas 8 direções e nas animações; armado = a arma na mão (o Tepes com o escudo pequeno no braço esquerdo e a corrente enrolada no antebraço direito; o Alosi com o códex aberto) e a bainha ou a alça vazia. As decisões abaixo (realista, chibi de 01/10) são o histórico; o formato dos arquivos continua valendo.

Pasta: `client/public/arte/personagens/<nome>/`, com `<nome>` = `tepes`, `catarina`, `alosi`, `cora-falcao` (ou o nome de um personagem novo).

**Decidido em 30/09:** a folha de sprite de hoje de cada agente (`folha.webp`, pintada) é a **arte de referência** dele: aparece grande na FICHAS e vai para a Hand do jogador (tela que vem depois). O **tabuleiro** vai ganhar arte nova para cada agente, no modelo chibi e na grade 1:1 (seção acima), com todos os ângulos e as animações de andar. As poses paradas já têm formato ("Poses do tabuleiro", abaixo); o das animações entra aqui antes de ser feito.

### Folha das 8 direções (o boneco do tabuleiro) — decidido em 02/10

Uma imagem por agente com ele **parado nas 8 direções**, no estilo de proporção real (a Alosi de jaqueta creme de 02/10). Dela sai tudo o que o tabuleiro mostra: o construtor esculpe o boneco 3D que cabe nas 8 silhuetas, pinta cada direção com a vista do desenho e faz o andar (o ciclo inteiro), sentar, pegar, abrir, apanhar e cair com as animações da biblioteca (`scripts/3d/`, ver [`PERSONAGENS-3D.md`](PERSONAGENS-3D.md)). Parado, o boneco fica igual ao desenho.

- Grade **4×2**, cada direção numa casa do mesmo tamanho. Em cima: **costas**, costas-direita, perfil direita, frente-direita. Embaixo: **frente**, frente-esquerda, perfil esquerda, costas-esquerda. (No jogo: `n, ne, e, se` / `s, sw, w, nw`.)
- **A mesma pose em todas:** em pé, relaxado, braços soltos **um pouco afastados do corpo** (o vão entre o braço e o tronco separa as peças) e pernas um pouco abertas. Nada na mão.
- **O mesmo tamanho** do personagem em todas as casas, com os pés na mesma altura. A câmera um pouco de cima (como a folha chibi de 01/10).
- Fundo transparente, sem sombra no chão, luz neutra. Contorno escuro de 1 pixel, como na referência.
- Nome: `client/public/arte/personagens/<nome>/oito-direcoes.png`. Pode vir como saiu do gerador.
- Quadros extras da mesma direção (piscando, respirando, como os quatro da Alosi) entram no parado: `parado-<direção>.png`, os quadros lado a lado.

### Poses de referência do tabuleiro — Tepes, estilo 32 bits

Entrega de quatro imagens estáticas escolhidas por Felipe, com luz neutra e pose idle, em `client/public/arte/personagens/tepes/tabuleiro-32bits/`:

| Arquivo | Estado |
|---|---|
| `idle-desarmado.png` | Normal, mãos vazias |
| `idle-armado.png` | Normal, corrente e escudo |
| `idle-armado-machucado.png` | Machucado, corrente e escudo |
| `idle-desarmado-machucado.png` | Machucado, mãos vazias |

Formato: PNG RGBA, 1024×1536, corpo inteiro, frente em três quartos voltada para a direita. Os arquivos preservam as imagens escolhidas na conversa, com canal alfa; a limpeza final de eventuais halos e o alinhamento entre estados ficam para a montagem da folha. Luz neutra nas peças, conforme decisão de Felipe, para o ambiente do jogo aplicar sua iluminação.

Armado: corrente sem acessório na ponta, enrolada no antebraço e com trecho solto até o início da bota; escudo pequeno, redondo, de madeira, abaixado junto ao corpo. Machucado: cortes, hematoma e roupa rasgada/manchada, preservando a identidade.

Não substituem `folha.webp` nem os `retrato-*.png`. São do modelo realista, de antes da decisão do chibi: ficam no tabuleiro até chegarem as poses chibi do Tepes, e depois servem de referência (por exemplo, o corpo grande da FICHAS). **Desde 30/09 elas já estão no tabuleiro** (na tela do mestre e na mesa): a peça do Tepes usa a pose do estado dela e muda na hora. Ainda sem as outras direções, quadros de piscar ou caminhada: virado para outro lado, ele mostra a mesma pose; andando, ela desliza com um balanço.

### Poses do tabuleiro: uma imagem por estado e direção

É o formato das próximas entregas: os quatro agentes no modelo chibi, nas 8 direções e nos 4 estados. Cada imagem é o personagem parado, numa direção e num estado.

- **Pasta:** `client/public/arte/personagens/<nome>/tabuleiro-32bits/`.
- **Nome:** `idle-<estado>-<direção>.png`, com `<estado>` = `desarmado`, `armado`, `desarmado-machucado` ou `armado-machucado`. As quatro imagens sem direção no nome (as entregues) valem como `se`.
- **Direções** (na tela), as 4 primeiro:

| Direção | Pose |
|---|---|
| `se` | frente virada para a direita ↘ (a entregue) |
| `sw` | frente virada para a esquerda ↙ |
| `nw` | costas viradas para a esquerda ↖ |
| `ne` | costas viradas para a direita ↗ |
| `s` | de frente ↓ (só com 8 direções) |
| `e` | de lado, olhando para a direita → (só com 8) |
| `n` | de costas ↑ (só com 8) |
| `w` | de lado, olhando para a esquerda ← (só com 8) |

- **Tamanho:** na grade 1:1 (a pessoa com ~104 pixels de altura), corpo inteiro, **na mesma escala e com os pés no mesmo ponto** em todas as direções e estados. A âncora é o meio da faixa de baixo do corpo (entre os pés).
- **Arte grande, em alta definição (04/10):** a arte realista (a Catarina nova, ~470 px de altura) não vira pixel art: `npm run arte:poses -- <nome> --estado <estado> --hd` recorta com a borda suave e mantém a resolução. O tabuleiro acha os dois pés de cada pose (a sola mais baixa de cada bota) e põe a âncora **no meio deles**: é esse ponto que pisa no meio da casa, o anel passa embaixo de cada pé e cada pé tem a sombra de contato dele. Por isso as botas precisam aparecer **separadas**, cada uma com a sola à vista.
- **Como entregar:** a imagem do gerador como saiu, **um personagem por imagem**, com as 8 direções paradas numa grade 4×2, nesta ordem, e fundo transparente ou verde puro `#00FF00`:

| | 1 | 2 | 3 | 4 |
|---|---|---|---|---|
| **Em cima** | de costas `n` | costas virado para a direita `ne` | de lado para a direita `e` | frente virado para a direita `se` |
| **Embaixo** | de frente `s` | frente virado para a esquerda `sw` | de lado para a esquerda `w` | costas virado para a esquerda `nw` |

- **Fundo transparente de verdade (ou o verde chapado), sem chão, sem sombra, sem anel e sem texto.** Luz neutra.
- **O construtor monta tudo com um comando** (precisa de Python com PyMuPDF e numpy, os mesmos do Veríssimo):

```bash
npm run arte:poses -- caminho/da/imagem.png alosi --estado desarmado
```

  Ele recorta as 8 direções, reduz para a grade em pixel duro (a cor mais frequente de cada bloco, sem misturar), deixa o corpo opaco e grava `idle-<estado>-<direção>.png` (a pose parada) em `tabuleiro-32bits/`, todas as direções na mesma escala e com os pés no mesmo ponto. O `--altura` muda a altura da pessoa (104 por padrão); com `--passos`, grava também um passo simples (`andar-<estado>-<direção>-<1..8>.png`, só as pernas de baixo se mexem), de antes do boneco.
- **O boneco animado** (o personagem vivo no tabuleiro) sai das poses paradas, com um segundo comando:

```bash
npm run arte:boneco -- alosi
```

  Ele usa as marcações de `scripts/bonecos/<nome>.json`: em cada direção, as juntas (quadril, tornozelo, ombro, pulso, pescoço, cabeça; o joelho e o cotovelo são calculados), o chão embaixo do corpo, onde fica cada peça (polígonos), as pontas do cabelo, a barra do casaco, o que o tronco esconde atrás do braço, os membros do lado de longe (de lado), a ordem de desenho e os pixels dos olhos. Personagem novo precisa dessas marcações (o construtor faz). Com elas, o boneco é recortado em peças (cabeça, pontas do cabelo, tronco, barra, e de cada lado braço, antebraço, mão, coxa, canela e bota) e animado por um esqueleto 3D projetado na grade de cada direção:
  - **andando (provisório, até chegar o andar desenhado):** um ciclo (dois passos) por casa, em 16 quadros: o pé que apoia vai para trás no chão e o outro passa um pouco erguido; o quadril sobe e desce; os braços vão ao contrário das pernas. Peças giradas de um desenho de 104 pixels quebram as linhas do pixel art (joelho e cotovelo bem dobrados ficaram estranhos, 02/10), então o andar bom vem desenhado quadro a quadro (abaixo);
  - **parado:** a respiração em 24 quadros (3,6 s): peito, ombros, pescoço, cabeça e braços sobem um pouco, cada um um tempo depois do outro; o cabelo vai por último;
  - **piscando:** cada quadro tem também a versão de olhos fechados.

  As peças do tronco e da roupa deslizam linha a linha (como o pixel art faz nas inclinações pequenas); as dos membros giram em volta da junta, sem amassar; tudo em pixel duro. Grava em `tabuleiro-32bits/`: `parado-<estado>-<direção>.png` e `andar-<estado>-<direção>.png` (tiras com os quadros lado a lado; a segunda linha, quando a direção mostra os olhos, é a de olhos fechados) e `anim.json` (tamanho e âncora de cada direção, quantos quadros, o tempo do parado, a fase do andar no meio da casa e onde ficam os pés em cada quadro). Com o `anim.json`, o boneco vale no lugar das poses e dos passos.
- **Andar desenhado quadro a quadro** (o que fica perfeito): **uma imagem por direção**, com os **8 quadros do ciclo lado a lado, numa fileira só**, todos na mesma escala, com os pés na mesma linha, fundo verde puro `#00FF00` (ou transparente), sem chão, sem sombra, sem texto e sem moldura. O ciclo começa no contato do pé direito: 1 contato (pé direito na frente, calcanhar no chão), 2 baixo (o peso na perna direita, joelhos dobrados), 3 passagem (a perna esquerda passa do lado da direita, com o joelho dobrado e o pé no ar), 4 alto (a esquerda vai à frente), 5 contato (pé esquerdo na frente), 6 baixo, 7 passagem (a direita passa), 8 alto. Os braços vão ao contrário das pernas, com o cotovelo um pouco dobrado; cabelo e casaco balançam um pouco a cada passo. Mesmo personagem, mesmas cores e proporções da imagem das 8 direções paradas. Nome: `andar-<estado>-<direção>.png` (ex.: `andar-desarmado-se.png`), numa pasta qualquer; o construtor roda `npm run arte:boneco -- alosi --andar-desenhado <pasta>`: os quadros são separados, reduzidos para a escala da pose parada, pintados com as cores dela, alinhados pelo meio do tronco e pelo pé mais baixo, e os pés de cada quadro são achados para a sombra de contato. Pode vir com outro número de quadros (`--quadros 6`). Faltando `sw`, `w` ou `nw`, entra `se`, `e` ou `ne` espelhado (a corrente troca de lado: o melhor é ter as 8). O parado continua respirando e piscando pelo boneco; andando, ele não pisca.
- **As interações do agente (pedidas em 04/10; o jogo ainda não toca, o construtor liga quando chegarem).**
  - **Formato:** o mesmo do andar desenhado: uma imagem por animação e direção, os quadros lado a lado numa fileira, na escala da folha das 8 direções do agente, pés na mesma linha (menos no cair e no caído), fundo verde `#00FF00` ou transparente. O primeiro e o último quadro de abrir, pegar e atacar são a pose parada.
  - **As animações:**

    | Animação | Arquivo | Direções | Quadros |
    |---|---|---|---|
    | Andar | `andar-<estado>-<direção>.png` | as 8 | 8 |
    | Abrir porta, armário, gaveta, baú | `abrir-<direção>.png` | as 4 diagonais (ne, se, sw, nw) | 6 |
    | Pegar item | `pegar-<direção>.png` | as 4 diagonais | 6 |
    | Atacar, com a arma de cada um | `atacar-<direção>.png` | as 4 diagonais | 6 |
    | Cair | `cair-<direção>.png` | as 4 diagonais | 5 |
    | Caído (morrendo, inconsciente) | `caido-<direção>.png` | as 4 diagonais | 1 |

  - **Como o jogo vai usar:** com 4 diagonais, as outras direções usam a mais perto.
    - **Abrir e pegar:** tocam quando o mestre usa a ação com a peça comandada, virada para o objeto.
    - **Atacar:** toca no ataque do combate.
    - **Cair e caído:** tocam quando os PV chegam a 0.
  - **Pedido pronto:** `PROMPT-PERSONAGENS.txt`, Parte 5, na pasta da arte do GPT.
- **Quadros de andar desenhados à mão** (para quem não tem boneco): `andar-<estado>-<direção>-<n>.png` com n = 1, 2, 3... em ordem, no mesmo tamanho da pose parada da direção e com os pés no mesmo ponto. Um ciclo são dois passos, e o jogo toca um ciclo por casa; pode ter de 4 a 16 quadros. Entram sozinhos.
- **Como o jogo escolhe:** o estado vem do botão **Armado** (no painel da peça) e dos PV (**menos da metade = machucado**, como no livro); a direção vem da peça (↺ ↻, Q e E) ou do caminho que ela anda. Faltando uma direção, usa a vizinha; faltando um estado, o mais parecido. No carregamento, o quase transparente em volta some e o corpo fica totalmente opaco.
- **Como o jogo toca o boneco:** andando, o quadro vem do quanto a peça já andou (e não do relógio): no meio de cada casa ela está na passagem, então para ali com os pés juntos, e virando no caminho o passo continua na direção nova. Parado, respira com a fase de cada peça (os agentes não respiram juntos) e pisca em hora aleatória, de 2,4 a 6 s, às vezes duas vezes seguidas. A sombra de contato vai embaixo de cada pé, menor e mais clara com o pé no ar.
- **Como o jogo desenha:** pose pequena (até 200 pixels de altura) é pixel art: vai numa escala inteira, sem suavizar quando aumenta e encaixada no pixel inteiro da tela (andando, não treme nem borra); diminuindo (zoom abaixo de 1), suaviza para não serrilhar. Andando, toca os quadros de andar num relógio que segue de casa em casa: dois passos por casa, como no Habbo (com um passo só, o pé que apoia escorregava no chão junto com o corpo). Para a peça pisar no chão, e não parecer colada por cima: o meio da pegada das botas fica no meio da casa (a arte desce 5% da altura); embaixo, a sombra de contato (na largura dos pés da direção) e o anel; os pés escurecem perto do piso; cada uma das duas luzes do cenário mais fortes por perto projeta no chão a silhueta do quadro que está na tela, do lado oposto a ela; e o corpo pega a cor dessas luzes (perto das velas, o branco fica creme). Sombras e anel ficam no chão: o que estiver na frente tapa. A luz, a escuridão e a névoa da sala caem por cima, como no chão. Valem também para a folha e para as poses grandes.
- **As poses realistas do Tepes** (1024×1536, ~1,5 MB cada) aparecem reduzidas no zoom normal e pesam no tablet. Na grade 1:1, cada pose tem poucos KB.

### Folha de sprite: `folha.png`

- **Grade de 4 colunas.** Cada linha é uma direção e cada coluna um quadro do personagem parado.
- **Quadros:** colunas 1, 2 e 4 são o personagem respirando, com variações pequenas. A **coluna 3 tem os olhos fechados** (o piscar).
- **Todas as células do mesmo tamanho** (ex.: 313×313), com o personagem na mesma escala e os **pés na mesma altura** em todas.
- **Sem chão, sem sombra, sem anel e sem texto.**
- **4 direções = 4 linhas, nesta ordem:**
  1. frente virada para a direita ↘
  2. frente virada para a esquerda ↙
  3. costas viradas para a esquerda ↖
  4. costas viradas para a direita ↗
- **8 direções = 8 linhas:** as 4 acima e mais estas, nesta ordem:
  5. de frente ↓
  6. de lado, olhando para a direita →
  7. de costas ↑
  8. de lado, olhando para a esquerda ←

  Com 8 direções, o personagem que anda na diagonal da grade (na tela, reto para cima, para baixo ou para o lado) usa a pose certa, em vez da diagonal mais próxima.

### Retratos das cartas: um por estado

As cartas do grupo (tela do mestre) mostram o personagem **de corpo inteiro, olhando para a direita**, recortado da cabeça até a cintura. São quatro estados:

| Arquivo | Quando aparece |
|---|---|
| `retrato-desarmado.png` | normal |
| `retrato-armado.png` | o mestre marcou "Armado" |
| `retrato-desarmado-machucado.png` | menos da metade dos PV (condição "machucado" do livro) |
| `retrato-armado-machucado.png` | armado e machucado |

- Para piscar: a **mesma imagem** com os olhos fechados, `retrato-<estado>-olhos-fechados.png` (mesmo tamanho e pose).
- Fundo transparente ou branco liso (o jogo tira o branco). Tamanho livre; ~1024×1536 funciona bem.
- O jogo acha os arquivos sozinho, sem reiniciar. Enquanto não houver retrato, a carta recorta o rosto da folha de sprite.
- A respiração é feita pelo jogo, pela ficha: normal, irregular e calma (machucado), rápida (sanidade abaixo da metade) e bem devagar (PE abaixo da metade).

## 2. Itens

Pasta: `client/public/arte/itens/`.

| Arquivo | Tamanho | O que é |
|---|---|---|
| `<nome-do-item>.png` | 128×128 | Ícone de um item específico. Ex.: `faca-de-cozinha.png`, `diario-rasgado.png`, `chave-da-escrivaninha.png` |
| `tipo-<tipo>.png` | 128×128 | Ícone genérico do tipo, usado quando o item não tem ícone próprio. Tipos: `arma`, `documento`, `chave`, `carta`, `consumivel`, `midia`, `caixa`, `item` |

Os ícones são objetos soltos, sem moldura e sem o quadrado do inventário (o jogo desenha o quadrado).

### Arte pintada dos itens (aba ITENS do MAPA)

A aba ITENS (referência `docs/ref-itens.jpg`, fora do git) mostra cada item como uma **ilustração pintada**: o fuzil, a faca, o colete, o amuleto, o kit médico, o pendrive, a munição, o livro, a chave, a lanterna, o frasco. É outro estilo do ícone de traço da FICHAS, então tem pasta própria:

| Arquivo | Tamanho | O que é |
|---|---|---|
| `pintados/<id>.png` | 256×256 | Item do livro, pelo id do catálogo (ex.: `pintados/fuzil-de-caca.png`, `pintados/protecao-leve.png`) |
| `pintados/<nome-do-item>.png` | 256×256 | Item achado no cenário, pelo nome em minúsculas e com hífen (ex.: `pintados/chave-do-arsenal.png`, `pintados/diario-do-maluco.png`) |
| `pintados/tipo-<tipo>.png` | 256×256 | O item do cenário sem desenho próprio, pelo tipo: `arma`, `documento`, `chave`, `carta`, `consumivel`, `midia`, `caixa`, `item` |

- Fundo transparente, sem moldura e sem a casa escura (o jogo põe a casa). O objeto sozinho, em três quartos, ocupando ~80% do quadro, com luz quente vinda de cima, como na referência.
- O jogo procura nesta ordem: a pintada, o ícone de traço (`itens/<id>.png`) e, sem nenhum, o desenho de linha. Entram sozinhos.

## 3. Interface (a tela MAPA) — referência nova, 16:9

A referência de 29/09 (`docs/referencias/mapa.webp`) é **16:9**: a tela passa a ser desenhada em **1920×1080**. Os tamanhos abaixo são em 1920×1080; entregue no **dobro** as peças que ficam na frente (papéis, botões, molduras). Os números são aproximados, medidos na referência: o construtor ajusta no encaixe.

### O que é código e o que é arte

A análise completa, elemento por elemento, está em [`TELA-MAPA.md`](TELA-MAPA.md), e a lista para ir marcando, em [`CHECKLIST-TELA-MAPA.md`](CHECKLIST-TELA-MAPA.md). Em resumo:
- **Não precisa desenhar:** textos e números, ícones de linha (o jogo usa a biblioteca Lucide, licença ISC), botões, abas, etiquetas, molduras (polaroid, retrato, miniatura), barras de PV/PE/SAN, espaços do inventário, a moldura do tabuleiro, o carimbo da Ordem (desenhado com o logo) e a luz.
- **Precisa de arte:** os papéis envelhecidos, o clipe, as fitas, a rosa dos ventos, a pilha de papéis e, na sala, os móveis e as texturas.

### Fontes (decidido em 29/09; o jogo carrega)

| Uso | Fonte | Onde aparece |
|---|---|---|
| Marca | Cinzel | "ORDO REALITAS / SEDE DA ORDEM" |
| Títulos e botões | Special Elite (e Courier Prime Bold onde precisar de negrito) | SUBSOLO, SALA DE TECNOLOGIA, MAPA, AÇÕES |
| Texto corrido | Courier Prime | descrições, lista "Contém", nomes nas cartas |
| Anotações à mão | Caveat | "Instalações Técnicas", "Acesso Restrito" na planta |
| Títulos e números da FICHA | Roboto Serif, condensada | IDENTIFICAÇÃO, ATRIBUTOS, os valores dos atributos e derivados, as abas do topo |
| Texto da FICHA | Roboto Condensed | nomes, perícias, tabelas, botões |

### Peças a desenhar

Pasta: `client/public/arte/interface/`; o logo em `client/public/arte/local/` (fora do git: é o símbolo oficial de Ordem Paranormal e o repositório é público). Tamanho em 1920×1080; entregue no dobro. PNG transparente, sem texto e sem ícone pintado.

| Arquivo | Tamanho (1×) | O que é |
|---|---|---|
| `papel-planta.png` | 540×320 | Folha envelhecida da planta, rasgada, com a folha de trás aparecendo no canto |
| `papel-sala.png` | 540×185 | Folha mais clara do cartão da sala |
| `papel-objeto.png` | 540×290 | Folha do objeto selecionado |
| `papel-rpg.png` | 390×790 | Folha grande do painel da direita |
| `papel-inventario.png` | 585×150 | Folha do inventário rápido |
| `carta-player.png` | 370×160 | Cartão claro de cada personagem; borda de 24 px sem detalhe único, para o jogo esticar o meio |
| `clipe.png` | 26×62 | Clipe de metal (prende a planta ao cartão da sala) |
| `fita-1.png` a `fita-3.png` | ~80×22 | Fita crepe translúcida |
| `rosa-dos-ventos.png` | 90×90 | Rosa dos ventos a nanquim com o "N" |
| `pilha-papeis.png` | 300×260 | Pilha de fichas e papéis carimbados, no canto de baixo à direita (sai pela borda) |
| `logo-ordem.png` | 72×72 | O emblema. Pode ser branco sobre preto: o jogo usa o branco como forma. Sem o arquivo, o topo mostra só o texto |
| opcional: `fundo-mesa.jpg` | 1920×1080 | Fundo quase preto com textura suave (JPG opaco); sem ele, o jogo usa um ruído |
| opcional: `asas-marca.png` | 80×60 | Asas bem apagadas no canto do painel do objeto |

### A sala do tabuleiro (Sala de Tecnologia)

Formato em [`SEDE-DA-ORDEM.md`](SEDE-DA-ORDEM.md), na grade 1:1 do tabuleiro (casa de 64×32 pixels de arte, 1 m de altura ≈ 58 pixels de arte, imagem de frente e de costas):
- **Piso:** carpete roxo, uma casa que repete.
- **Parede:** tijolo escuro, que repete.
- **Móveis:** porta de madeira escura (fechada e aberta); bancada com 1, 2 e 3 monitores; cadeira de escritório nas 4 direções; lâmpada fluorescente (apagada e acesa).
- O brilho das telas, das lâmpadas e da fita roxa embaixo das bancadas é feito pelo jogo.

### A tela antiga (1536×1024)

As peças abaixo eram da primeira referência (`docs/ref-mapa.webp`). As que servem na tela nova foram repetidas acima; o resto não precisa mais.

Pasta: `client/public/arte/interface/`. Tamanhos em 1×; entregue no dobro.

### Fundo e barra do topo

| Arquivo | Tamanho | O que é |
|---|---|---|
| `fundo-mesa.jpg` | 1536×1024 | Superfície escura com sujeira (pode ser JPG opaco). O centro (x 290–1020, y 75–850) fica neutro, porque o mapa entra ali |
| `barra-topo.png` | 1536×75 | Faixa escura do topo com a borda de baixo |
| `sigilo.png` | 70×70 | Sigilo vermelho do logo, sem quadrado atrás |
| `placa-direita.png` | 513×762 | Placa escura atrás do painel da direita |

### Abas do topo (normal e ativa)

Papel rasgado com os pregos nos cantos; na versão ativa o papel é mais claro.

| Arquivo | Tamanho |
|---|---|
| `aba-mapa.png` e `aba-mapa-ativa.png` | 122×58 |
| `aba-combate.png` e `-ativa` | 144×52 |
| `aba-interludio.png` e `-ativa` | 130×46 |
| `aba-personagens.png` e `-ativa` | 153×47 |
| `aba-itens.png` e `-ativa` | 95×50 |
| `aba-notas.png` e `-ativa` | 107×47 |
| `traco-aba-ativa.png` | 70×8, traço de tinta vermelha sob o nome da aba ativa |
| `fio-vermelho.png` | 300×90, o fio que sai do sigilo e amarra a aba ativa |

### Papéis dos painéis (em branco)

| Arquivo | Tamanho | Detalhes |
|---|---|---|
| `papel-cenario.png` | 266×453 | Canto de baixo à direita dobrado |
| `papel-cenario-tras.png` | 266×453 | A folha que aparece atrás |
| `papel-andar.png` | 265×244 | Papel quadriculado (grade azul-acinzentada de 11 px) |
| `papel-objetivos.png` | 186×160 | Formato de pasta, com a aba de cima de 113×36 |
| `papel-inspetor.png` | 483×448 | Folha grande do painel da direita |
| `papel-entrega.png` | 477×294 | Painel "Entregar ... para" |
| `papel-inventario.png` | 487×137 | — |
| `papel-log.png` | 431×155 | Com a aba de pasta em cima e o canto dobrado |
| `carta-1.png` a `carta-4.png` | 125×150 | Cartas dos personagens, com rasgos diferentes |
| `carta-tras-1.png` a `carta-tras-4.png` | 125×150 | As folhas atrás de cada carta |
| `nota-g.png`, `nota-m.png`, `nota-p.png` | 290×178, 262×150, 230×128 | Bilhetes para janelas e confirmações |

### Peças pequenas

| Arquivo | Tamanho |
|---|---|
| `fita-1.png` a `fita-3.png` | ~70×18, fita crepe translúcida |
| `clipe.png` e `clipe-pequeno.png` | 22×54 e 14×26 |
| `alfinete.png` | 20×20, alfinete vermelho com a agulha |
| `pincel-selecao.png` | 252×57, pincelada vermelha com ponta de seta (cena atual) |
| `polaroid.png` | 151×143, moldura com o furo transparente |
| `aba-pasta.png` e `aba-pasta-ativa.png` | 119×33, abas DESCRIÇÃO / INTERAÇÕES / ITENS |
| `contorno-aba-ativa.png` | 119×33, contorno vermelho feito à mão por cima da aba ativa |
| `card-item.png` e `card-item-selecionado.png` | 452×75 |
| `botao-escuro.png` | 96×38, botão "Entregar" sem texto; três quadros lado a lado (normal, passando o mouse, apertado) |
| `slot-inventario.png` | 56×58 |
| `moldura-miniatura.png` | 72×47, moldura com rebites e furo transparente |
| `checkbox.png` e `check-vermelho.png` | 14×14 e 18×16 |
| `barra-trilho.png`, `barra-verde.png`, `barra-amarela.png`, `barra-vermelha.png` | 84×12 |
| `carimbo-sucesso.png` e `carimbo-falha.png` | ~160×60, carimbo de tinta para o resultado de um teste |

## 4. Efeitos

Pasta: `client/public/arte/efeitos/`.

- Cada efeito é uma **tira horizontal** de quadros do mesmo tamanho: `<nome>.png`.
- Informe o **número de quadros** e a **velocidade** (quadros por segundo) no nome, assim: `chama-vela_8q_12fps.png`.
- Fundo transparente. Se o efeito for luz (brilho, chama), pinte em cores claras sobre transparente: o jogo soma a luz por cima do mapa.

## 5. Cenários e móveis

**Decidido:** os cenários são montados no jogo (planta, paredes e móveis na grade isométrica), e a arte dos móveis vem depois, para deixar cada cômodo parecido com a referência. Luz, névoa e fumaça são feitas pelo jogo.

### Folha de objetos (decidido em 02/10)

Os móveis vêm em **folhas de objetos** como a primeira do Códex (`mobiliario/props-ordo-realitas.png`, 12 objetos): é esse o visual do mapa.

- Até **12 objetos por folha**, em 3 linhas de 4, **separados** (nenhum encosta no outro), fundo transparente de verdade.
- Cada objeto **visto de cima e de lado** (3/4), com a **frente virada para baixo à esquerda**, como o arquivo verde e a estante da primeira folha. O ângulo não precisa ser exato: o construtor acha o ângulo de cada desenho e redesenha na grade do tabuleiro.
- **Proporção certa** pelo tamanho do móvel no jogo (casas de 0,75 m: largura × fundo, e a altura em metros), da lista do [`CHECKLIST-ARTE.md`](CHECKLIST-ARTE.md). Detalhe à vontade: cada objeto com uns 300 a 400 pixels de largura.
- Luz neutra, sem sombra no chão, sem texto, sem número e sem símbolo oficial (sigilos e marcas sempre próprios).
- **Costas:** quem senta (cadeiras, poltronas, sofás) precisa também das costas, o mesmo objeto girado de meia-volta, numa folha à parte na mesma ordem. O resto o construtor faz: as costas saem da própria frente.
- Nome: `client/public/arte/mobiliario/folha-<n>.png` (as costas: `folha-<n>-costas.png`).

O construtor converte com `scripts/3d/moveis.py` (a ficha diz qual objeto é qual móvel): sai `mobiliario/<id>/frente.png` e `costas.png`, em arte em dobro (2 pixels da imagem por pixel do tabuleiro no zoom 1), e a lista `mobiliario/moveis.json` que o jogo lê. O jogo espelha as imagens para os outros dois giros e mantém as luzes e os estados do móvel.

### Móvel nos 4 giros (decidido em 02/10)

O jeito certo de cada móvel: **uma folha por móvel, com ele girando**, para virar no tabuleiro sem espelho (o primeiro foi a cadeira do bar, `mobiliario/folhas/cadeira-bar.png`).

- **Linha de cima, isométrica** (2:1, de cima a uns 30°, girada 45°), **no sentido horário, começando pela frente**: 1) frente virada para baixo à esquerda; 2) de costas, virada para cima à esquerda; 3) de costas, virada para cima à direita; 4) frente virada para baixo à direita. É a mesma ordem do botão Girar do jogo.
- **Linha de baixo, vista de cima** (de cima e de frente, a uns 55°, para o combate), **também no sentido horário**: 5) virada para baixo; 6) para a esquerda; 7) para cima; 8) para a direita.
- O mesmo objeto em todas: mesmo tamanho, pés na mesma altura, separadas, fundo transparente, sem chão, sem sombra, sem texto. Estilo da folha de objetos do Códex (pixel art detalhada, contorno escuro fino, cores quentes).
- Nome: `client/public/arte/mobiliario/folhas/<nome-do-movel>.png`. O construtor recorta, acerta tamanho e âncora e grava `mobiliario/<id>/giro-<0|2|4|6>.png`.
- **O tamanho é o de verdade** (revisto em 02/10): o pedido diz as medidas do móvel em metros, perto de uma pessoa de 1,80 m (no tabuleiro, 94 px). O construtor dá a cada móvel as medidas de verdade (`"real"` na ficha `scripts/3d/fichas/moveis-bar.json`), com a mesma escala nas 4 vistas, e o põe no meio da casa ou encostado na parede. Móvel que é uma caixa e veio baixo ou comprido demais (o balcão) é redesenhado na caixa de verdade; a prateleira repete as fileiras de garrafas até a altura certa, em vez de esticar.
- Faltou um lado na folha? O construtor espelha outra vista (a frente para a esquerda vira a frente para a direita).
- **Cabe na casa (04/10):** a base do móvel não pode passar das casas dele (largura × fundo). O gerador costuma desenhar largo e o construtor acerta pela altura; quando a base passa da casa, o jogo encolhe a peça por igual até caber (`encaixe`, em `client/src/render/furniArte.ts`), e ela fica mais baixa que o tamanho de verdade. A peça da parede (a porta) fica como a arte. O certo é pedir o desenho já na proporção de verdade (as medidas na lista do pedido).

### Outros modelos do mesmo móvel (decidido em 03/10)

Móvel que se repete muito no mesmo cômodo (as bancadas de armas, as mesas de trabalho, os leitos) ganha **mais dois modelos**, B e C: o mesmo corpo, as mesmas medidas e as vistas no mesmo lugar da folha de hoje, mudando só o que está em cima, dentro ou pendurado. As folhas vêm com `-b` e `-c` no nome (`bancada-armas-b.png`; com estado, `bancada-computadores-ligada-b.png`). Na ficha, o modelo é outro móvel com o mesmo id e a letra: `"def": "gun_table~b"`. O jogo sorteia o modelo de cada peça pelo número dela (o mesmo sempre); enquanto o B e o C não chegam, todas usam o de hoje. O pedido da vez está na pasta da arte do GPT (`PROMPT-VARIACOES-E-ARSENAL.txt`).

### Portas dos cômodos (decidido em 03/10)

As portas das passagens têm arte de madeira (`porta-madeira-aberta.png`, `-fechada`, `-trancada`) e de metal (`porta-metal-*`), cada folha com 2 vistas: a porta na parede da direita e na da esquerda (ficha `scripts/3d/fichas/moveis-portas.json`). A de metal vale nos cômodos de piso de metal e de cela (o arsenal e a prisão): na ficha, `"def": "portal@metal"`. Nas paredes da frente, que não aparecem, a porta continua desenhada por código (a soleira e o contorno do vão): `"so_giros": true`. **O jogo segue a arte (04/10):** vão de 0,8 m e batente de 7,5 cm (`VAO_PORTA_M`), o buraco da parede embaixo da moldura e, na ordem de desenho, a moldura atrás do que fica encostado nela. Encolher ou cortar a imagem entortava a moldura e cortava o cadeado: não faça.

### Itens de parede, tapetes, chão e parede (decidido em 02/10)

- **Item de parede** (relógio, arandela, TV, ventilador): isométrico, já preso numa parede do fundo, **com as bordas na inclinação da parede** (2 para 1: sobe 1 pixel a cada 2 de lado; o jogo endireita o que vier mais deitado, mas só o que é retângulo), em 2 vistas do mesmo tamanho: 1) na parede da direita, frente virada para baixo à esquerda; 2) na parede da esquerda, frente virada para baixo à direita. Com estados (a arandela acesa e apagada), as 2 vistas de cada estado. A parede em si não aparece. O construtor acha o ponto onde ele encosta e grava `mobiliario/<id>/parede-<r|l>.png` (`parede-r-1.png` o outro estado).
- **Tapete**: visto exatamente de cima, reto, preenchendo a imagem na proporção dele (o tapete gasto, 2×3 casas, em pé). O jogo deita no chão: `mobiliario/<id>/chao.png`.
- **Chão e parede**: texturas planas, sem perspectiva e sem emenda. O chão visto de cima (quadrado, repete nos dois sentidos); a parede vista de frente, do rodapé ao topo (deitada, 2 por 1, repete na horizontal). O jogo entorta cada uma para o isométrico. Ficam em `client/public/arte/texturas/`, ligadas ao estilo de piso do cômodo em `texturas.json` (o bar: `madeira`).

### Vista de cima: o mapa tático (decidido em 03/10)

Na vista tática a câmera sobe e mostra a sala de cima, como um mapa de batalha. Cada móvel ganha uma imagem vista **exatamente de cima** (ortográfica, sem nenhuma lateral), no mesmo estilo das folhas isométricas:

- **Móvel:** `<folha isométrica>-cima.png` (ex.: `mesa-sinuca-cima.png`), **128 px por casa** na pegada inteira do móvel (largura × fundo em casas: a mesa de sinuca, 2×4, tem 256×512; a casa tem 0,75 m, então 1 m = 171 px). O jogo mede onde o móvel está na imagem e o põe no tamanho de verdade dele, então uma imagem desenhada em outra escala também serve. A **frente para baixo** (o lado de sentar, as portas, a frente do balcão); o jogo gira para os outros giros. O objeto no tamanho de verdade, no meio, e o resto transparente. Sem sombra (o jogo faz pela altura), sem chão, sem texto. O estado que muda o que se vê de cima vem como `<folha>-cima-<estado>.png` (o baú aberto).
- **Parede:** `parede-cima-<piso>.png`, 512×80, o topo da parede visto de cima, emendando dos dois lados; a beira de baixo (o lambri, o rodapé) fica para dentro da sala. Uma por estilo de piso (`madeira`, `concreto`, `cela`...).
- **Fichas das peças:** do tamanho de uma pessoa vista de cima, 1 casa (0,75 m) de largura (revisto em 04/10). `ficha-agente.png` e `ficha-ameaca.png`, 256×256, o aro visto de cima com o **meio transparente** (o retrato entra no furo; o furo do agente vai até 0,78 do raio do aro). O jogo pinta o aro do agente na cor dele; o da ameaça fica como veio.

Para pôr no jogo: `python scripts/3d/cima.py <pasta com as PNGs>`. Cada móvel vai para `mobiliario/<móvel>/cima.png` (pela ficha que usa aquela folha) e entra no `moveis.json` (`cima`); a parede e as fichas vão para `client/public/arte/tatico/`. Sem a imagem, o jogo desenha o móvel por código. O pedido da vez está na pasta da arte do GPT (`PROMPT-VISTA-DE-CIMA.txt`). **Feito:** o Bar (teste, 03/10).

A lista dos cômodos e dos móveis de cada um está em [`SEDE-DA-ORDEM.md`](SEDE-DA-ORDEM.md); o que falta desenhar, folha por folha, no [`CHECKLIST-ARTE.md`](CHECKLIST-ARTE.md).

## 6. Tela de entrada: os três temas (decidido em 07/10)

A tela de entrada tem três imagens inteiras, uma por tema (fantasia, horror, cyberpunk), no computador (1672×941) e no celular (941×1672). O Códex **edita a imagem de hoje** a partir das bases (`node scripts/entrada-fundos.mjs bases <pasta>`, 1536×1024 e 1024×1536): mesmo enquadramento, mesma câmera, mesmo painel; muda o que está na mesa, a luz e a vista da janela. Todas de noite, com o céu limpo (o jogo faz o dia e o clima). As miniaturas são pintadas na cena, no ângulo da mesa, com a sombra e a luz da vela, no estilo das do lote 1 de 07/10. O script encaixa (`encaixar <imagem> <tema> <tela>`) em `client/public/arte/login/fundo-<tela>-<tema>.webp`, recolocando o painel de hoje por cima. O pedido pronto é o [`PROMPT-ENTRADA.txt`](PROMPT-ENTRADA.txt); como a tela usa as imagens, em [`TELA-ENTRADA.md`](TELA-ENTRADA.md). Genérico sempre: nada dos agentes da campanha, nada de marcas de jogos reais.

(Testados e recusados em 07/10: os remendos e o kit em camadas, com peças separadas montadas pelo jogo.)

## Como entregar

1. Trabalhe numa branch `codex/arte-<assunto>` (ex.: `codex/arte-personagens`).
2. Faça commit só de arquivos dentro de `client/public/arte/`, sem mexer em código.
3. Abra um pull request para `main` listando o que entregou.

O construtor encaixa a arte no jogo e ajusta o que precisar.

> **Atenção:** o repositório `FelipeSiqueiraDev/CROMA` é **público**. Tudo o que entra nele, inclusive a arte, fica visível para qualquer pessoa.
