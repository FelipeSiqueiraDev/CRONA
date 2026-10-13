# Guia de construção de mapas em pixel art (só código)

Este guia é para quem continua a arte nova do tabuleiro, inclusive outro Claude noutro computador. Ele ensina a fazer um
cômodo inteiro do jogo no estilo novo, do mesmo jeito que foram feitos a sala de madeira, a cozinha e o casarão da
fazenda: pixel art "cozy", desenhada **só por código**, sem gerador de imagem nem Códex.

Antes de começar, abra as prévias em `docs/estilo/`. É o alvo. Os vídeos são `sala.mp4`, `cozinha.mp4` e `casarao.mp4`;
o resultado no jogo de verdade é `jogo-cozinha-px.png`.

---

## 1. As decisões já tomadas (não mude sem falar com o Felipe)

| O quê | Decisão |
|---|---|
| Estilo | Pixel art cozy, como as salas isométricas de referência. A primeira foi uma sala de madeira com lareira. |
| Feito como | Só código: um modelo 3D simples, pintado em pixel art pelo motor. Nada de Códex nem de gerador de imagem. |
| Escala | **1:1**: 1 pixel da imagem = 1 pixel do tabuleiro (`ESC = 1`). O Felipe comparou com 1:2 e com 1,33; o 1:1 ficou mais nítido e casa com a grade e com os personagens. |
| Câmera | A do tabuleiro, que não muda: isométrica 2:1, casa de 64 × 32 px, 0,75 m por casa, 52,26 px por metro na vertical. |
| Personagens | Chibi, no traço do cenário (combinado de 04/10). |
| Medidas | As do jogo: a planta e a posição vêm do seed, o tamanho de cada móvel vem do `shared/src/furni.ts`. |
| Contraste | O móvel não pode sumir no chão. A mesa laranja no chão laranja "camuflava", e o Felipe reclamou. Use tons bem diferentes. |
| O que sai da casa | A chaminé atravessa a viga e continua subindo, sumindo aos poucos (ela "termina lá fora"). A fumaça só aparece fora, no casarão. |

---

## 2. Onde está tudo

| Caminho | O que é |
|---|---|
| `scripts/3d/codigo/motor.py` | O motor: câmera, faces, cilindros, elipsoides, luz e contorno. |
| `scripts/3d/estilo/` | Os estudos e as ferramentas do estilo. Tem um `README.md` próprio. |
| `scripts/3d/estilo/agente_cozinha/cozinha.py` | **O modelo a seguir para um cômodo do jogo.** É a cozinha da fazenda, com a planta do seed. |
| `scripts/3d/estilo/agente_cozinha/base_estilo.py` | Os materiais e as peças reaproveitáveis: madeira, tábuas, rampas, cadeira, mesa, livros, potes, barril e outras. |
| `scripts/3d/estilo/agente_fogo/fogo_px2.py` | O fogo pixel a pixel: aceso, apagando e com fumaça. |
| `scripts/3d/estilo/agente_janela/janela_px.py` | A janela com a cortina no vento, o sol no chão e a poeira. |
| `scripts/3d/estilo/agente_casarao/casarao.py` | O casarão visto de fora: telhado, varanda, grama e árvores. |
| `scripts/3d/estilo/sala4.py` (gerado por `juntar.py`) | A sala de madeira inteira. |
| `scripts/3d/estilo/exportar_px.py` | Exporta os móveis para o jogo, nos 4 giros. |
| `scripts/3d/estilo/texturas_px.py` | Gera o chão e a parede para o jogo, no ângulo do tabuleiro. |
| `scripts/3d/estilo/ver_no_jogo.mjs` | Fotografa uma cena do jogo com a arte nova sem mexer no jogo. |
| `client/src/render/furniArte.ts` | O jogo desenhando o móvel com `pixel`: no pixel inteiro, sem suavizar e sem esticar. |
| `client/src/render/texturas.ts`, `roomStatic.ts` | O chão e a parede em pixel: o campo `px` do estilo em `texturas.json`. |

Para rodar precisa de Python 3 com numpy e Pillow. Para o teste no jogo, Node, `npm install` e `npm run dev`. Para o
vídeo, ffmpeg.

---

## 3. As medidas da câmera (decore)

- Uma casa tem 0,75 m. Na tela, +x anda (32, 16) px por casa e +y anda (−32, 16).
- Na vertical são 52,26 px por metro. Com `ESC = 1`, a projeção é `tela(P) = ((X − Y)·42,67, (X + Y)·21,33 − Z·52,26)`, em metros.
- **1 pixel em metros, no 1:1:** `PH = 0,75/32/ESC ≈ 0,0234 m` ao longo de x ou de y, e `PZ = 0,75/39,195/ESC ≈ 0,0191 m` na vertical.
  Toda linha de 1 px (junta, rejunte, friso) é medida com `PH` ou `PZ`. Nunca use um número solto como 0,03 para isso.
- **Giros do jogo** (o `rot` do seed e da `Peca`):
  - 4: frente para +y, a face da esquerda de baixo na tela;
  - 2: frente para +x;
  - 0: frente para −y, de costas;
  - 6: frente para −x.
  **Desenhe todo móvel no giro 4.**
- **Paredes:** o jogo mostra só duas, as de trás. A da esquerda é o plano x = 0 (no jogo, `'l'`). A do fundo é o plano y = 0 (no jogo, `'r'`).

---

## 4. As regras de pixel art (o que aprendemos errando)

1. **Desenhe direto no pixel.** Filtro por cima de render liso não vira pixel art; foi tentado e descartado (`estilo.py`).
2. **O material só dá a cor de base.** É uma função `emissivo(lambda L, n, P: cores)` que devolve a cor de cada pixel. A luz vem depois, no acabamento:
   - o topo fica com a cor cheia (1,0);
   - a face +y (esquerda) leva 0,84;
   - a face +x (direita) leva 0,66;
   - o que perde luz puxa para um tom quente (+16, +4, −10 no RGB);
   - parede (tipo 2): 1,04, 0,97 e 0,9.
3. **Rampas curtas e limpas.** Cada material tem de 4 a 6 tons, em degraus, sem dither e sem degradê liso.
4. **Nada de pixel solto.** Padrão (veio, mancha, trama) sai em riscas compridas ou em blocos de pelo menos 2 px.
5. **O contorno:**
   - por fora de cada peça, 1 px escuro (`cor·0,28 + (26, 12, 10)`);
   - a quina de dentro, onde muda de face na mesma peça, com `cor·0,8`;
   - a quina de cima, quando a face de cima encontra a de lado, com 1 px de brilho (`cor·1,15 + 10`).
6. **Volume em cada tábua e cada pedra.** 1 px claro logo depois da junta, 1 px mais escuro antes da próxima, e um veio discreto.
7. **Sombra macia no chão** embaixo de cada móvel, em dois degraus (0,74 e 0,88), um pouco para a frente e para a direita. Nos cantos, o chão perto da parede escurece.
8. **Contraste:** o móvel precisa se destacar do chão. Madeira escura sobre piso claro, ou o contrário.
9. **Detalhe pequeno some.** Abaixo de 1 a 2 px vira ruído: uma trança de alho, por exemplo, virou pontinhos. Prefira poucos objetos grandes e legíveis.
10. **Peça fechada de todos os lados.** O móvel vai para o jogo em 4 giros, e o jogador vê as costas. Toda caixa tem todas as faces, e o motor descarta sozinho as que estão de costas para a câmera. Polígono fino (folha, pano, papel) leva `dois_lados=True`.
11. **Nos padrões, use `L` (o ponto local), não `P`.** O exportador gira o móvel e passa o ponto da cena como `L`; padrão feito com `P` pode girar errado.
12. **Coisa que não tem onde apoiar** (a lâmpada do teto, que não existe no desenho) tem o fio subindo e sumindo aos poucos antes da viga.
13. **Não termine o que sai da casa.** A chaminé continua para cima, sumindo em 5 degraus. Ela não ganha tampa nem fica "cortada".

---

## 5. Passo a passo: um cômodo do jogo no estilo novo

Siga a cozinha (`agente_cozinha/cozinha.py`) como modelo. É o caminho completo.

1. **Leia a cena no seed** (`server/src/seedSede.ts`, `seedFazenda.ts`...):
   - o tamanho em casas;
   - o estilo do piso (`style` / `floorStyle`);
   - a porta;
   - cada móvel: `[def, casa x, casa y, giro, estado]`;
   - os itens de parede.
2. **Leia cada móvel no `shared/src/furni.ts`:** largura e fundo em casas, altura em metros e `aumento`. A mesa e as cadeiras crescem 1,2 vezes, e a arte já vem nesse tamanho.
3. **Monte a cena de estudo** (`cozinha.py`):
   - `sala()` faz o chão, as duas paredes de trás, o rodapé, a viga e os pilares;
   - `montar_moveis()` chama uma função por móvel;
   - `acabamento()` aplica a luz, as sombras, o contorno, os vidros, o fogo, as lâmpadas e a janela.
   Converta casa em metros com `casa × 0,75`.
4. **Uma função por móvel**, desenhada **no giro 4** (frente para +y), na posição da cena e no tamanho do catálogo:
   - use as peças do `base_estilo.py` quando servirem;
   - não mude o nome nem os argumentos depois que o exportador usar.
5. **Itere olhando.** Rode `python3 cozinha.py saida.png` (sai ampliada 3x) e faça recortes ampliados em `NEAREST`. Olhe cada peça de perto e compare com a referência. Seja exigente: o Felipe nota.
6. **Animações:**
   - o fogo vem do `fogo_px2.desenhar_fogo(cor, c, t, forca, fumaca, fumaca_t, geo, chamine, fumaca_chamine)`, chamado no fim do acabamento;
   - a janela usa `janela(c, t)` depois de montar, `luz_janela(cor, c, t)` antes do contorno e `poeira_janela(cor, c, t)` no fim;
   - o loop tem `t` de 0 a 1.
7. **Vídeo para o Felipe** (o GIF não anima para ele):
   `ffmpeg -i x.gif -vf "scale=trunc(iw/2)*2:trunc(ih/2)*2:flags=neighbor,format=yuv420p" -c:v libx264 -crf 18 x.mp4`

## 6. Levar para o jogo

1. **Os móveis:** em `exportar_px.py`, ponha uma linha em `ITENS`:
   `'def': (largura, fundo, (x, y da quina da pegada na cena, em m), lambda: CZ.funcao(...), {estado: lambda: ...})`.
   Depois rode:
   `python3 scripts/3d/estilo/exportar_px.py <def> --destino /tmp/exp`
   - Ele desenha o móvel sozinho, girado em volta da pegada, nos 4 giros.
   - O fundo é transparente. A sombra fica dentro da imagem, num chão invisível. A chaminé some em transparência.
   - Ele grava `<def>/giro-N.png` e a linha do `moveis.json`: `escala` 1, `pixel` true, `exato` true, `real` (a medida já com o `aumento`), `giros` e `estados`.
   - **Confira os 4 giros lado a lado.** Peça aberta por trás aparece aqui.
   - Sem `--destino`, ele grava direto em `client/public/arte/mobiliario/`, a arte do jogo.
2. **O chão e a parede:** `python3 scripts/3d/estilo/texturas_px.py <nome>` gera, em `client/public/arte/texturas/px/<nome>/`:
   - 4 × 4 casas de chão, losangos de 64 × 32;
   - 4 trechos de cada parede, com uma casa de largura, do chão até 3,6 m;
   - o `px.json` com as âncoras.
   O jogo cola uma imagem por casa sem esticar. Para ligar, ponha `"px": "<nome>"` no estilo de piso em `client/public/arte/texturas/texturas.json`. Se o estilo for usado por outra cena que não deve mudar, crie um estilo novo (`FloorStyle` em `shared`) e troque o `style` da cena no seed. Lá, suba o `FAZENDA_REV` ou o `SEDE_REV`.
3. **Ver no jogo sem mexer nele** (com o `npm run dev` no ar):
   `ARTE=/tmp/exp/ PX=<nome> ESTILO=<floorStyle> node scripts/3d/estilo/ver_no_jogo.mjs saida.png "Fazenda · Cozinha"`
4. **Antes de commitar o que muda o jogo:** rode `npm run typecheck`, `npm test` e `npm run build`. Faça o commit em português, na branch `claude/...`.

## 7. Trabalhar com agentes (como fizemos)

Quando o trabalho é grande, divida em agentes em paralelo, cada um com:
- uma parte bem definida: o fogo, a lareira, as peças, a janela;
- **uma pasta e uma cópia da cena só dele** (`agente_<parte>/`);
- a referência e as regras deste guia no pedido;
- a ordem de olhar as próprias imagens e iterar;
- a entrega das funções num arquivo separado, para juntar depois.

Depois, um script junta tudo (`juntar.py` monta o `sala4.py`). Os nomes que se repetem entre os arquivos precisam ser
renomeados ao juntar (por exemplo, `_LUZ` virou `_LUZ2`).

## 8. Erros que já aconteceram (confira antes de entregar)

- [ ] **Faltam pedaços de costas ou de lado.** O fogão sumia de costas, a pia não tinha fundo, a planta só tinha folha de um lado.
- [ ] **Algo flutua ou atravessa outra peça.** O pote encostava na cortina, o friso da parede passava pela porta.
- [ ] **O móvel some no chão** por ter o mesmo tom.
- [ ] **A chaminé ou o pilar parecem "cortados"** em vez de continuarem.
- [ ] **A lâmpada solta no ar,** sem o fio sumindo.
- [ ] **Pixel solto, xadrez ou pontilhado** num padrão. Isso vem de linha mais fina que 1 px ou de padrão fora da grade.
- [ ] **Pixel desigual no jogo.** Acontece com escala que não é inteira; o 1:1 resolve.
- [ ] **A sombra do móvel cai fora da imagem** ou some com a luz do jogo, que soma por cima. Ela precisa ter força.
- [ ] **A medida errada.** Confira com o `furni.ts` e o seed. O tamanho do móvel é o do catálogo, e a arte já vem com o `aumento`.

## 9. O que falta (13/10)

Ver `docs/EM-ABERTO.md`. Em resumo:
- fechar os móveis da cozinha de todos os lados;
- os itens de parede (relógio, quadro, prateleira);
- o fogo animado no tabuleiro, em todos os giros;
- o estilo de piso próprio da cozinha no seed;
- o personagem chibi (a Alosi, em andamento);
- depois, os outros cômodos: Fazenda, Sede e Orfanato.
