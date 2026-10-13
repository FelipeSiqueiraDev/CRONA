# Guia do Claude: como tocar o CRONA com o Felipe

Este guia é para o Claude que pega o CRONA do zero, numa conversa nova ou noutra conta. O [`AGENTS.md`](../AGENTS.md) diz o que o projeto é e como rodar. Este diz **como trabalhar aqui**: os combinados com o Felipe, o caminho da arte com o Códex e como conferir o que se faz. O que está pela metade e o que falta fica no [`EM-ABERTO.md`](EM-ABERTO.md).

## Comece aqui

1. Leia o [`AGENTS.md`](../AGENTS.md) (ele já vem carregado), este guia e o [`EM-ABERTO.md`](EM-ABERTO.md).
2. Antes de mexer numa área, leia o documento dela:

   | Área | Documento |
   |---|---|
   | Tela MAPA | [`TELA-MAPA.md`](TELA-MAPA.md) |
   | Tela FICHAS | [`TELA-FICHAS.md`](TELA-FICHAS.md) |
   | Tela COMBATE | [`TELA-COMBATE.md`](TELA-COMBATE.md) |
   | Mecânica do combate | [`COMBATE.md`](COMBATE.md) |
   | Regras do jogo | [`REGRAS.md`](REGRAS.md) |
   | Sede da Ordem | [`SEDE-DA-ORDEM.md`](SEDE-DA-ORDEM.md) |
   | Fazenda | [`FAZENDA.md`](FAZENDA.md) |
   | Personagens no tabuleiro | [`PERSONAGENS-3D.md`](PERSONAGENS-3D.md) |
   | Ferramentas da mesa (apontar, desenhar, névoa, mapa improvisado) | [`FERRAMENTAS-DA-MESA.md`](FERRAMENTAS-DA-MESA.md) |
   | Tela de entrada (o fundo vivo) | [`TELA-ENTRADA.md`](TELA-ENTRADA.md) |
   | Formato da arte | [`ARTE.md`](ARTE.md) |
   | O que falta desenhar | [`CHECKLIST-ARTE.md`](CHECKLIST-ARTE.md) |
3. **A memória.** Se existir, leia `%USERPROFILE%\.claude\projects\F--Dhellow-CRONA-projeto\memory\MEMORY.md` (a pasta do projeto desde 05/10; a memória antiga, de quando o projeto ficava no OneDrive, foi copiada para lá) e os arquivos dela, que têm mais detalhes de cada combinado. As conversas antigas (`*.jsonl`) ficam na mesma pasta, e as imagens que o Felipe mandou no meio de uma resposta estão nelas em base64.
4. Veja o estado do git (`git status`, `git log --oneline -5`) e pergunte ao Felipe o que vem primeiro entre os itens do `EM-ABERTO.md`.

## Quem é quem

- **Felipe:**
  - é o mestre de Ordem Paranormal e usa o CRONA para jogar com o grupo dele;
  - decide o que entra e como fica;
  - escreve curto e em português, às vezes por voz (as palavras podem vir trocadas).
- **Claude, o construtor:** faz todo o código e encaixa a arte no jogo.
- **Códex, o artista:**
  - um chat de geração de imagem (GPT) onde o Felipe cola os pedidos;
  - lê os `PROMPT-*.txt` da pasta da arte e salva um zip ali;
  - entrega só imagens: código que ele deixar é para mostrar ao Felipe e sugerir descartar, guardando o diff antes.

## Combinados

**Conversa**
- Respostas curtas, em português. Código, comentários e commits em português normal.
- Mostre o resultado pronto (uma captura, o teste passando), não a depuração.
- Coisa grande se combina antes, e a decisão fica registrada no documento da área.
- Não proponha voltar atrás no que o Felipe já decidiu.
- **A lista de pendências só quando um assunto termina** (revisto em 13/10; antes, 12/10, era no fim de cada bloco): no meio de um assunto, nada de lista, a não ser que ele peça. Ao fechar o assunto, a lista na resposta e no `EM-ABERTO.md`.
- **Os arquivos (imagens, vídeos) sempre no fim da resposta, depois do resumo** (13/10). Animação vai em vídeo MP4 (os GIFs não animam para ele): `ffmpeg -i x.gif -vf "scale=trunc(iw/2)*2:trunc(ih/2)*2:flags=neighbor,format=yuv420p" -c:v libx264 x.mp4`.

**Visual**
- **As telas seguem as referências** de `docs/referencias/` exatamente: botões, bordas, fonte, espaçamento. Confira por recortes lado a lado.
  - Não mude a disposição sem ele pedir. Corte, sobreposição e feiura se corrigem.
  - Desde 03/10, o visual de papel envelhecido da Mansão Alvarez é a referência de estilo. A disposição continua a nossa.
- **GPT sempre.** Toda peça visual vira pedido de arte, com nome, tamanho e pasta no `.txt` da pasta da arte: papel, aba, botão, janela, ícone, móvel, textura.
  - No código fica o gancho (`arte()`, `/api/arte`) para o PNG entrar no lugar do desenho em código.
  - Nunca dê um visual por pronto só com CSS se a arte deixaria mais bonito. Diga quais peças faltam.
- **O tabuleiro é isométrico** (losango 2:1). A câmera de cima foi testada e recusada em 02/10; a **vista tática** (tecla T) é um modo à parte.
  - Nunca mude a câmera sem mostrar um teste antes.
- **A escala das regras:**
  - 1 casa = 0,75 m (meio quadrado do livro), e a pessoa tem 1,80 m.
  - Os móveis ficam no tamanho de verdade.
  - Os agentes são realistas, com umas 7 cabeças de altura: na arte, 1,80 m = 104 px, e o tabuleiro desenha a 91%. O chibi foi abandonado.
- **Arrumação de verdade:** móvel de parede vai nas paredes do fundo, porque as da frente não aparecem e mostrariam as costas dele.

**Regras do jogo**
- Seguem os livros à risca: o livro de regras e o *Sobrevivendo ao Horror*.
- O C.R.I.S (repositório SistemaDeMestragemRPG) é só referência de leitura. Não mexa nele, não rode e não toque no banco de lá.
- Cite a página. O texto dos livros é protegido: resuma com palavras próprias e nunca copie a marca d'água dos PDFs.
- Mexeu em regra, ou as fichas subiram de NEX? Rode `/verissimo`, que confere só o que mudou.

**Git e GitHub**
- O repositório é **público** (FelipeSiqueiraDev/CROMA).
  - Nunca escreva o e-mail da empresa do Felipe em nada.
  - Commite com `git -c user.name="Felipe Siqueira" -c user.email="106750790+FelipeSiqueiraDev@users.noreply.github.com" commit ...`.
- Trabalhe numa branch `claude/...`, com pull request para a `main`. Nada de push direto na `main`.
- **Pergunte antes de cada PR.**
  - Não há `gh` nesta máquina: o PR se abre pelo Chrome do Felipe, que já está logado, na página `.../compare/main...<branch>?expand=1`.
  - Juntar na `main` é outra pergunta.
- Antes do PR, rode `npm run typecheck`, `npm test` e `npm run build`, sem erros.
- **Nunca `git stash`:** o servidor de desenvolvimento reinicia no código velho no meio.
- Fica **fora do git**, de propósito:
  - imagem com o emblema ou os símbolos oficiais (`docs/ref-*.webp`, `client/public/arte/cenarios/`);
  - as plantas e referências da fazenda;
  - tudo de `server/data/`.

**O computador do Felipe**
- **Não roube o foco da tela.** Para ver o jogo, use o painel de navegador do app ("crona-visual", abaixo), não Chrome headless.
- "Desligar o PC" no fim da sessão é **hibernar**, depois do relatório final:

  ```powershell
  Start-Process powershell -WindowStyle Hidden -ArgumentList '-NoProfile','-Command','Start-Sleep -Seconds 120; shutdown /h'
  ```

**A interface não pode piscar (pedido do Felipe, 07/10: "que isso pare para sempre")**
- Mudou PV, PE, SAN, uma condição ou qualquer número que chega do servidor? **Acerte no lugar** (texto, largura da barra, classe); nunca refaça o painel nem recrie cartas, abas, retratos e ícones por causa de um número. Cada tela separa a **estrutura** (o que obriga a refazer: quem está na lista, nome, cor, arma, condições, máximos) dos **números** (PV, PE, SAN de agora): a assinatura da estrutura não leva os números, e um `atualizar()` guardado no elemento acerta os números.
- Já é assim em: PLAYERS e o cartão do personagem do MAPA (`vitaisCarta`, `vitalsPanel`, `.atualizar`), as cartas de baixo (`cardVitals`), a FICHAS (`renderJogo`, `soNumerosDeJogo`: fechada ela só marca para refazer ao abrir) e o COMBATE (`patchVitais`, `assinaturaPecas` sem PV e SAN crus).
- Troque o texto de um nó só se ele mudou (`if (el.textContent !== t) el.textContent = t`): trocar à toa recria o nó.
- Para conferir: um `MutationObserver` no `document.body` durante um clique em "+ Vida" não pode ver nós criados nos painéis (só trocas de texto).

## Rodar e conferir

O básico está no `AGENTS.md`. Além dele:

- **Testes visuais numa cópia do banco.**
  1. Com o servidor de verdade parado, rode `node scripts/dev/visual.mjs criar` (faz a `crona_visual`).
  2. Abra o preview "crona-visual" do `.claude/launch.json`.
  3. Ao terminar, pare o preview e rode `node scripts/dev/visual.mjs apagar`.

  O Felipe pode estar mexendo na cópia ao mesmo tempo.
- **Capturar o tabuleiro em tamanho real.**
  1. Rode `node scripts/dev/salvar.mjs <pasta>` em segundo plano.
  2. No painel, dê `resize_window` para 1672×941 (escondido, o canvas fica 300×150 e sai em branco).
  3. Na página (`javascript_tool`):

  ```js
  const v = window.__crona.view; v.frame();
  fetch('http://127.0.0.1:5999/?nome=sala.png', { method: 'POST', body: v.canvas.toDataURL('image/png') });
  ```

  Comandos úteis na página:
  - **Olhar uma cena:** `__crona.net.send({ t: 'peek', roomId })` (os ids estão em `__crona.state.rooms`). **Não use `join`:** ele leva junto a peça que o mestre comanda (o agente sai da sala onde o Felipe o deixou; para devolver, `join` na sala onde ele está e `{ t: 'tokenScene', tokenId, roomId }`).
  - **Andar com uma peça:** `view.myId = id; view.events.walk(x, y)`.
  - **Antes de capturar:** `v.autoFit = true; v.needFit = true`, ou trave a câmera com `autoFit = false; needFit = false; camAnim = null`.
- **Mudou a montagem da Sede ou da Fazenda?** Suba `SEDE_REV` / `FAZENDA_REV` **a cada edição**: a versão que o banco já aplicou não refaz nada. Confira em memória antes com `npx tsx`, montando `seedDb()` e `upgradeDb()`; o `console.warn` diz o que não coube.
- **Manhas desta máquina:**
  - **OneDrive:** o Vite usa polling.
  - **Heredoc no Bash:** com `${...}` dentro, ele quebra. Escreva o script com a ferramenta Write e rode o arquivo.
  - **`docker exec` no Git Bash:** precisa de `MSYS_NO_PATHCONV=1`.
- **Conferir o celular:** no painel, `resize_window` para 470×836. A captura do painel vem reduzida: meça pelo JavaScript (retângulos, `scrollHeight`).

## A arte nova (pixel art só por código)

Desde 12/10 o caminho é outro: o tabuleiro em pixel art 1:1 feita pelo motor, sem o Códex. O passo a passo, as medidas, as regras e os erros que já aconteceram estão no [`GUIA-MAPAS-PIXEL.md`](GUIA-MAPAS-PIXEL.md).

## A arte (o caminho do Códex)

**A pasta da arte**
- Fica em `F:\Dhellow\CRONA\arte\TEXTURAS MAPA\BASE - Ordo Realitas\`.
- Desde 07/10 (noite), TUDO o que falta para o Códex está num arquivo só, o `PEDIDO-UNICO-CODEX.txt` (o que já chegou, a fila
  e o pedido completo de cada parte); o `00-COMECE-AQUI.txt` tem a mensagem para colar. Pedido novo entra nele (numa seção
  nova da fila), e não num PROMPT solto. Os pedidos antigos estão em `_arquivo/prompts/`.
- **Regra da casa (Felipe, 07/10): todo LUGAR novo** (o Orfanato Filhos do Dragão, Santo Berço...) ganha, além das salas, a
  **ilha no mapa-múndi** (`lugar-<slug>.png`) e **duas artes de chegada** (`chegada-<slug>-1.png` e `-2.png`, pinturas
  1920 × 1080 como as 10 da viagem, em `client/public/arte/viagem/ilustracoes/`). A tela de chegada usa as do lugar quando
  existem (`artesDeChegada` em `shared/src/viagem.ts`).
- O mapa da pasta:
  - o pedido único `PEDIDO-UNICO-CODEX.txt`;
  - `gabaritos/`: câmera, estilo, telas, agentes e "como está hoje";
  - `Sede da Ordem/<cômodo>/`: as folhas certas de cada cômodo;
  - `_entregas-originais/`: os zips como chegaram;
  - `_substituidas/`: as folhas antigas trocadas;
  - `LISTA-REFAZER.txt`: as peças que voltaram com problema.

**O ciclo de um lote**
1. O Claude escreve o pedido em `.txt` na pasta, autocontido, com teste primeiro.
2. Na conversa, o Claude manda a frase pronta para colar no Códex.
3. Enquanto espera, o Claude roda `bash scripts/dev/vigia-zips.sh` em segundo plano, para ser avisado quando o zip chegar.
4. O zip chega na raiz da pasta. O Claude importa, confere no tabuleiro e mostra ao Felipe.
5. As folhas vão para a pasta do cômodo e o zip vai para `_entregas-originais/`.
6. O Claude marca o `CHECKLIST-ARTE.md` e atualiza o `EM-ABERTO.md`.

**Regras de todo pedido**
- **Câmera:** "um quadrado no chão vira losango 2:1, um círculo vira elipse 2 por 1, nem mais de cima, nem mais de lado, nem de frente".
- **Vistas:** as 4 vistas na ordem do `gabarito-camera-4-vistas.png`, no mesmo tamanho, com o objeto inteiro.
- **Medidas:** o tamanho de verdade em metros, perto de uma pessoa de 1,80 m, e **que caiba nas casas da peça** (a casa tem 0,75 m: um móvel de 1 casa tem no máximo 0,75 × 0,75 m de base; a porta, 0,75 m na parede).
- **Gabarito por peça (04/10):** só a regra da câmera não basta, o gerador desenha largo e deitado. Cada peça pedida leva um gabarito em escala: `python scripts/3d/gabarito.py <pedido.json> "<pasta da arte>/gabaritos/pedidos"` desenha a caixa exata (chão: as 4 vistas, frente em vermelho e costas em azul, a pegada em casas; parede: as 2 vistas, o contorno na parede) com a pessoa de 1,80 m. O pedido diz "desenhe por cima da caixa, sem passar dela" e põe a folha de hoje ao lado como referência de estilo. Exemplo: `scripts/3d/pedidos/portas-e-medidas.json`.
- **Tolerância escrita no pedido:** o que o Claude vai medir (a base cabe nas casas, a porta tem 0,75 m, as bordas da parede a 0,5 ± 0,06). O que passar volta.
- **Imagem:** fundo transparente de verdade, nada escrito, nenhum símbolo oficial.
- **Entrega:**
  - teste primeiro;
  - um zip por parte, com LEIA-ME;
  - "outros chats estão na pasta, trabalhe numa pasta sua".

**Importar**

| O que chegou | Como entra no jogo |
|---|---|
| Móvel (4 vistas) | Uma ficha em `scripts/3d/fichas/moveis-<lugar>.json` e `python scripts/3d/moveis.py <ficha>`. As opções estão no topo do `moveis.py`: `real`, `como_esta`, `pisa`, `angulos`, `fatia`, `faixa`, `estados`, `"def": "<id>~b"` para outro modelo e `"<id>@<piso>"` para o material. |
| Vista de cima | `python scripts/3d/folha_cima.py <pasta> <saida.png>` para olhar tudo de uma vez, depois `python scripts/3d/cima.py <pasta>`. |
| Ícones dos itens | `python scripts/icones.py <zip>`, que manda para `itens/pintados/`. |
| Textura de chão e parede | O PNG em `client/public/arte/texturas/` e a entrada no `texturas.json` (estilo → piso e parede; `casas` = quantas casas uma volta cobre). |
| Personagem | `npm run arte:poses` e `npm run arte:boneco` (ver `ARTE.md`); o 3D está em `scripts/3d/README.md`. |
| Interface | Pelos ganchos `arte()` e `existeArte`, nos caminhos do `PROMPT-INTERFACE-GAME.txt`. |

**Conferir um móvel antes de dar por pronto**
- **Nunca pela imagem solta.**
  - `python scripts/3d/conferir_arte.py [--so <ids>]` mede o que chegou contra o pedido: a base cabe nas casas, a porta tem 1 casa, as bordas do item de parede seguem a parede. Diz o que volta.
  - `python scripts/3d/auditoria.py <saída>` acha ângulo errado, pedaço cortado e desenho fora da caixa.
  - `python scripts/3d/eixos.py` acha comprimento no giro trocado (vale para móvel em caixa; nos outros, confira no olho).
  - `python scripts/3d/fila.py <móvel> <giro> <passo> <saida.png>` emenda três módulos.
  - `scripts/dev/conferir-giros.js` (na página, com o `salvar.mjs` no ar) mostra a pegada, a caixa em arame e a pessoa de 1,80 m.
  - Por fim, uma captura do tabuleiro.
- **O GPT desenha cada vista num ângulo** (de 36° a 55°).
  - Módulos que ficam lado a lado (balcão, bancada, prateleira) vão redesenhados na caixa exata (`"angulos": true`).
  - O `como_esta` serve só para peça solta (cadeira, planta, mesa), que pisa no chão por `"pisa"`.
- **Vista desenhada alto demais:** não tem conserto. Peça para refazer (`LISTA-REFAZER.txt`) e diga claramente ao Felipe qual peça é; ele prefere refazer a ficar errado.
- **Peça simétrica** (mesa, banco): o espelho da vista boa vale mais que uma vista ruim. O GPT costuma trocar as duas vistas de costas.

## Ao terminar um bloco de trabalho

- Atualize o [`EM-ABERTO.md`](EM-ABERTO.md) com o que ficou pronto, o que ficou pela metade e o que chegou de arte.
- Mudou algo grande? Atualize o "Estado" do `AGENTS.md` e o documento da área.
- Rode typecheck, testes e build e faça o commit. Antes do PR, pergunte.
