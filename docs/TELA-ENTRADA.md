# Tela de entrada: o fundo vivo

A tela de entrada (`client/src/ui/entrada.ts`) é a arte do Felipe: a mesa de RPG à luz de vela, com o painel do CRONA. Desde 06/10 o fundo é **uma cena sorteada a cada visita**, sempre no estilo da arte de hoje e sempre **genérica**: nada dos agentes da campanha aparece aqui (decisão do Felipe em 06/10).

Desde 07/10 são **três temas, cada um uma imagem inteira**: **fantasia**, **horror** e **cyberpunk**. É a mesma sala, o mesmo enquadramento e o mesmo painel; muda o que está na mesa (o mapa, as miniaturas, os dados, a vela, a caneca), a luz e a vista da janela. Por cima de qualquer uma, o código faz a hora, o clima, os brilhos e a música.

O código da cena fica em `client/src/ui/entradaCena.ts`; a trilha, em `client/src/ui/entradaTrilha.ts`. O pedido de arte é o [`PROMPT-ENTRADA.txt`](PROMPT-ENTRADA.txt).

## O que varia

| O quê | Como | Quem faz |
|---|---|---|
| **O tema** | Fantasia, horror ou cyberpunk (não repete o da última visita). Cada um tem a sua imagem (`client/public/arte/login/fundo-<tela>-<tema>.webp`); enquanto ela não chega, fica a de hoje. Muda também a cor da chama (verde no horror; no cyberpunk a luz é um abajur de neon, sempre aceso), o clima mais provável (neblina no horror, chuva no cyberpunk), a aurora verde e a névoa na sala do horror, o horizonte rosado e a chuva com reflexo de neon do cyberpunk, e o que brilha no ar (faíscas de magia, faíscas digitais). | código; as imagens, do Códex |
| **A hora** | A do relógio. De dia o céu da janela fica azul, com sol e nuvens, a sala clareia e entram raios de sol; no amanhecer e no entardecer, dourado; de noite, a arte como foi desenhada (lua e estrelas). As janelas acesas lá fora apagam de dia. | código |
| **O clima** | Limpo, nuvens, chuva, neblina, neve ou tempestade (com relâmpago, que clareia a sala). Estrela cadente na noite limpa; pássaros de dia (em bando no sol), morcegos de noite. | código |
| **A vela** | Acesa ou apagada (de noite quase sempre acesa; de dia, quase sempre apagada). Apagada de noite, a sala fica no luar azul e sobe um fio de fumaça do pavio. No cyberpunk, o abajur de neon fica sempre aceso. | código |
| **O monstro** | Nas imagens dos temas, o monstro fica no tabuleiro, encarando os heróis (o dragão, a criatura de tentáculos, o robô). Às vezes, também olhos que brilham no escuro, lá fora e num canto da sala. | Códex; os olhos, código |
| **A trilha e o som** | Cada universo tem uma lista de músicas, compostas no código e tocadas na hora (Web Audio, sem arquivo de áudio), e uma é sorteada a cada visita: fantasia com a **Taverna** (alaúde e flauta) e a **Marcha dos Heróis** (synthwave de aventura, que nasceu como a música do cyberpunk e foi para a fantasia), horror com a **Maré Negra** (coro grave e zumbido) e cyberpunk com o **Neon Noir** (techno sombrio: mi frígio, 112 BPM, bumbo em todo tempo, baixo rolando em semicolcheias "bombeado" pelo bumbo, riff cortado de serrote com eco, subida de ruído e glitch no fim da frase) e o **Overclock** (hi-tech agressivo: drum & bass a 172 BPM, baixo "reese" com wobble e distorção, arpejos de bipes em semicolcheias com saltos de oitava ao acaso, bipes de dados, estacas e lasers, riff distorcido em fá menor, rufo de caixa e glitch no fim da frase). Música nova entra no fim da lista do universo (, em ). Oito compassos que se repetem com variação (a segunda volta sobe uma oitava, a terceira só acompanha). De noite o som fica mais abafado; de dia, mais aberto. Por baixo, o ambiente: a chuva, o trovão em cada relâmpago (o estalo quando é perto, o ronco que rola descendo do médio para o grave, a música abaixando enquanto ele ressoa; o médio é o que a caixinha do celular toca), o vento na neve e na neblina, o estalar da vela (no cyberpunk, o zumbido do neon) e os passarinhos nos dias de sol. | código |

**O som:** a música começa sozinha ao abrir a tela (decisão do Felipe em 07/10), subindo devagar. Os navegadores podem segurar o som até a pessoa tocar na página (o Chrome libera nos sites que a pessoa já usa muito, como o CRONA no computador do mestre); quando seguram, o botão de som pulsa com "toque para ouvir" (no computador, "clique para ouvir") e a música começa no primeiro toque, clique ou tecla, em qualquer lugar da tela. O botão no canto de cima, à direita, liga e desliga (as barrinhas dançam enquanto toca). O volume abre ao passar o mouse no botão; no celular, o primeiro toque abre o volume e o segundo liga e desliga (um toque fora fecha). A escolha e o volume ficam no aparelho (`crona.entrada.musica`, `crona.entrada.volume`). Ao entrar, a música some junto com a tela.

## Ver uma cena de propósito

No endereço da tela de entrada:

- `?hora=14.5` (qualquer hora) ou `?hora=ciclo` (o dia inteiro em um minuto);
- `?universo=fantasia` | `horror` | `cyberpunk`;
- `?clima=limpo` | `nuvens` | `chuva` | `neblina` | `tempestade` | `neve`;
- `?vela=apagada` (ou `acesa`);
- `?monstro=sim` (ou `nao`);
- `?musica=1` | `2` (qual música do universo toca; sem isso, sorteia).

Ex.: `http://localhost:5173/?hora=23&universo=cyberpunk&clima=chuva`. Quem pede menos movimento no sistema vê a cena parada, com a hora e o clima certos.

## As imagens dos temas

O Códex **edita a imagem de hoje** (não desenha do zero): assim o enquadramento, a câmera e o painel ficam no lugar. As miniaturas do lote 1 de 07/10 (`miniaturas-herois-fantasia.png`, `miniaturas-monstros-fantasia.png`, na pasta da arte) são a referência de estilo delas, mas pintadas dentro da cena, no ângulo da mesa, com a sombra e a luz da vela.

```bash
npm i --no-save sharp
node scripts/entrada-fundos.mjs bases <pasta>                                   # base-computador.png e base-celular.png, para anexar no pedido
node scripts/entrada-fundos.mjs encaixar <imagem.png> <tema> <computador|celular>
```

O encaixe tira a faixa de sobra da base (o gerador devolve 1536×1024 ou 1024×1536; a tela é 1672×941 ou 941×1672), volta ao tamanho da tela e recoloca **o painel da arte de hoje** por cima (os campos de verdade ficam exatamente sobre os desenhados: o painel tem que bater no pixel). Grava `client/public/arte/login/fundo-<tela>-<tema>.webp`, que a tela usa sozinha, e uma prévia ao lado da imagem. A chama é achada na imagem (o miolo mais claro perto de onde ela fica hoje), então a vela pode ter mudado um pouco de lugar.

- [x] fantasia (computador e celular) · [x] horror (computador e celular) · [x] cyberpunk (computador e celular) — todas em 07/10

O encaixe recorta o gerador de um jeito que mostra mais vidro (alinhado ao topo no computador e à direita no celular) e recoloca o painel pela **forma exata** (`client/src/ui/entradaPainel.json`: a moldura com os cantos cortados e o enfeite de baixo; o emblema e as letras desenhados nele são apagados, porque a logo nova vai por cima), com uma **sombra suave** em volta, que tira o ar de caixa colada. O jogo usa o mesmo contorno para não iluminar o painel (a luz do dia, o véu do tempo fechado e o clarão do relâmpago saem por ele, com 2 px de borda macia).

### A cidade lá fora

Nas imagens dos temas, os **vidros da janela vêm em magenta** (pedido do Felipe): o código põe ali o céu da hora e do clima (o sol, a lua e as estrelas, as nuvens, a chuva, a neve caindo, os relâmpagos, os pássaros) e, atrás dele, a **cidade do tema** (`client/public/arte/login/paisagem-<tema>.webp`). A cidade vem com luz neutra e céu em magenta; o código a escurece de noite, doura no fim da tarde e usa as cores marcadas na pintura:

- **verde puro** (#00FF00): as janelas das casas, acesas de noite e vidro escuro de dia;
- **ciano puro** (#00FFFF): os letreiros de neon do cyberpunk, acesos em rosa e ciano, com brilho, piscando de vez em quando;
- **amarelo puro** (#FFFF00): a lâmpada do farol do horror, acesa de noite, com o facho girando.

Neve parada nos telhados o código não faz: cada cidade tem também a versão com neve (`paisagem-<tema>-neve.webp`), usada quando o clima sorteado é neve. Encaixe: `node scripts/entrada-fundos.mjs paisagem <imagem> <tema> [neve]` (vai sem perda, em 1024×683, o tamanho em que aparece).

- [x] fantasia · [x] fantasia com neve
- [x] horror · [x] horror com neve
- [x] cyberpunk · [x] cyberpunk com neve

**O enquadramento:** o vidro vai de 834 a 1672 por 240 de altura no computador (o painel cobre parte) e de 421 a 940 por 314 no celular. A cidade entra grande, encostada à direita (o castelo, o farol e os arranha-céus ficam à vista); em tela mais estreita que a arte, ela anda para o que a tela mostra, e a ponta que sobra esmaece no céu. O sol atravessa a janela de um lado ao outro; a lua é posta sozinha num pedaço de céu livre, longe da cidade, do painel e do botão do som; os olhos de fora aparecem em céu livre e os de dentro, nos cantos escuros que o jogo acha na própria imagem. O letreiro de neon só acende no cyberpunk e o farol só gira no horror. Com neve, a cidade dos telhados brancos aparece aos poucos por cima da outra.

## A prévia

A prévia publicada (artefato "Entrada Viva do CRONA") tem o **Passeio pelos momentos**: roda sozinho ao abrir e atravessa a madrugada, o amanhecer, a manhã, o meio-dia com nuvens, a chuva, a tempestade (com relâmpago e trovão), o entardecer, a noite com a lua e algo no escuro, a neblina e a neve, com uma legenda de cada momento. Clima, vela e monstro mudam **ao vivo** (`Entrada.mudarCena`, `Cena.mudar`, `Trilha.mudarClima`), sem reiniciar a música: a chuva e o vento sobem e descem sozinhos no som. Qualquer botão manual para o passeio.

## Decisões

- **06/10:** a tela de entrada não usa nada dos agentes da campanha; é genérica, em vários universos de RPG, no estilo da arte de hoje, variando os elementos, a hora e o clima.
- **07/10:** três temas: fantasia, horror e cyberpunk (paranormal e Tormenta saíram). Cada tema é **uma imagem inteira**, igual à de hoje, editada pelo Códex a partir dela; o kit em camadas (peças separadas montadas pelo jogo) foi testado e recusado: "parecia um monte de PNG jogado um em cima do outro". As miniaturas do teste ficaram como referência do estilo.
- **07/10:** o monstro (ou o sossego) fica no tabuleiro, nas miniaturas pintadas em cima do mapa.
- **07/10:** o tempo fechado apaga a luz do dia (um véu frio e escuro sobre a sala, fora do painel), a tempestade tem céu cinza-chumbo, nuvens pesadas, chuva densa e inclinada e o relâmpago pisca duas vezes; as mariposas rodeiam a vela acesa de noite; o dia clareia a sala (o laranja da vela pintada sai).
- **07/10:** nas imagens dos temas, os vidros da janela vêm em magenta e lá fora entra a cidade do tema, com luz neutra, numa versão normal e numa com neve (sol, chuva e neblina são efeito do código). A primeira é a paisagem do lote 1.
- **07/10:** as estrelinhas em volta do emblema são animadas: cada uma pisca no seu ritmo, as grandes respiram e de vez em quando faíscam (`client/public/arte/login/brilhos/`, posições em `client/src/ui/entradaMarca.json`). Desde 07/10 elas são as da logo nova, recortadas dela. Um brilho passa pelas letras do CRONA de tempos em tempos.
- **07/10:** o botão ENTRAR fica sem ícones; só o brilho que corre pelo ouro.
- **07/10:** a logo do CRONA da tela de entrada é a que o Felipe mandou (o d20 dourado com as letras e a estrelinha no O; `client/public/arte/marca/crona-logo.png`): ela é uma imagem por cima do painel (`logo-ouro.webp`), e o emblema e as letras desenhados no painel de hoje são apagados no encaixe (`apagar`, em `client/src/ui/entradaPainel.json`). De tempos em tempos uma faixa varre a logo da esquerda para a direita e revela a variação azul-prateada dela (`logo-azul.webp`, a mesma imagem na cor da logo azul), com um clarão azul em volta e um fio de luz branca no meio (`.ent-marca-*`, em `entrada.css`). Tudo sai de `python3 scripts/entrada-logo.py`, que também recorta as estrelinhas da logo e escreve onde ela fica em cada tela (`entradaMarca.json`). Trocou a logo em `arte/marca/`? Rode o script de novo.
- **07/10:** o painel não tem mais caixa em volta: recorte pela forma exata e sombra suave (ver "As imagens dos temas"), no encaixe e no jogo.
- **07/10:** a tela tem trilha, sintetizada na hora, e o som do ambiente. A música começa sozinha; se o navegador segurar, no primeiro toque.
- **07/10:** cada universo tem uma LISTA de músicas, sorteada a cada visita (o Felipe vai criar outras com o tempo). A synthwave de aventura, que não soava a cyberpunk, foi para a fantasia (Marcha dos Heróis); o cyberpunk ganhou uma techno sombria (Neon Noir, que o Felipe gostou e fica) e um drum & bass hi-tech agressivo (Overclock), nenhuma substitui a outra.
- **07/10:** o celular vale tanto quanto o computador: os olhos, o sol e os pássaros ficam no pedaço da arte que a tela mostra (o celular estreito corta as laterais), e cada tema vem nas duas telas.

## O que falta

- Ideias para depois: os dados rolando ao abrir a página, as miniaturas se mexendo de leve (com as imagens prontas, dá para animar recortes delas no lugar), o livro da mesa trocando de capa.
