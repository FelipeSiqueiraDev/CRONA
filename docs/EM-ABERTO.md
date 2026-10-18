# Em aberto: onde paramos (17/10/2026)

O que está pela metade, o que falta e o que o Códex ainda vai entregar. Leia junto com o [`GUIA-DO-CLAUDE.md`](GUIA-DO-CLAUDE.md), que diz como trabalhar aqui. **Atualize este arquivo ao fim de cada bloco de trabalho.**

## Feito em 17/10, fim da tarde (branch `claude/tatica-codigo`): o jogo de verdade atualizado e a tela do COMBATE com respiro

- **O jogo de verdade (8080) subiu com tudo de 17/10** (backup `crona_2026-10-17_16-25-32.dump` antes; o `SEDE_REV`/`FAZENDA_REV` refizeram as salas: ajuste à mão no jogo que não estava no seed voltou ao seed). O "nome do NPC não salva" era o 8080 ainda no código velho: no código novo salva pelo Elenco, pelo lápis da aba NPCs e pela Identificação (conferido na prévia, também depois de recarregar).
- **COMBATE (o Felipe: "tudo apertado, tudo cortando"; o scroll de baixo tem que mudar):** a faixa da iniciativa com o selo "Sua vez" na fila, a foto dentro da carta e mais altura; a gaveta de baixo (Alvo / Efeitos / Registro) de 20 para 29 rem (o mapa cede 9 rem; a câmera se ajusta), a nota do alvo na largura toda e o scroll no padrão do jogo (cobre sobre azul-noite); os campos do bônus (+2) e da Luta sem corte. **Registro do combate: o mais novo em cima, o início embaixo.**
- **Manobra:** quando o alvo não tem Luta na ficha, o campo para digitar fica na página da Rolagem (antes só na página anterior, escondida: a tela dizia "digite a Luta" e não tinha onde). Conferido na prévia: Luta, d20s e o passo Efeito ("fica caído"), confirmar e o registro. O alvo que continua marcado ao passar o turno está no código (`combate.ts`, `ultimaVez`), mas não deu para ver numa luta de teste com os dois participantes em outra cena.
- **Poses deitadas conferidas:** as 14 (dormindo e caído) na mesma escala, sem defeito evidente.
- **Sentada em banco alto (o Felipe: "a Agatha tá sentada toda errada"):** o assento acima de 0,45 m (banco do bar, de laboratório) sobe a pose, e o quadril, não os pés, é o que fica em cima do assento (`meioDoQuadril`, em `sprites.ts`). Cadeira baixa não muda.
- **Arte dos portadores de relíquia e dos Existidos (Códex, 8 direções, na altura da Catarina):** chegaram e instalados os Existidos refeitos pelo retrato da lista (cinza, escrita preta, olhos brancos; os dourados de antes ficaram em `arte\PERSONAGENS-ANIMACAO	rabalho\_backup-existidos-dourados`), o Deus da Morte e o Diabo. A fila (`trabalho/fila_monstros.sh`, log em `fila_monstros.log`) segue com a Magistrada, o Anfitrião e as faces; cada um é cortado com `cortar_8.py --altura 470` e instalado com `monstros-tabuleiro/instalar_monstro.py <id> <v>`.
- **C.R.I.S (só leitura, o Felipe pediu):** as fichas dos Marcados no CRONA e no C.R.I.S batem em atributos, PV/PE/SAN e poderes (o +1 do NEX 20% está na progressão); mudam só alguns itens. Das fichas de NPC, o C.R.I.S só tem de verdade o Miguel; a Agatha é parcial e a Ivete e a Marcela são modelos em branco (tudo 1).

## Feito em 17/10, noite (branch `claude/tatica-codigo`): cenas de momento, combate sem trava para quem não luta, arte dos monstros

- **CENAS (botão CENAS na barra do tabuleiro, só o mestre):** o mestre monta uma sequência de quadros e solta na tela de todos (mestre, mesa e
  celulares). Cada quadro tem a ilustração de fundo, as **camadas da colagem** (PNGs transparentes do mesmo tamanho, que entram por cima, cada uma
  no seu tempo e do seu lado), a **câmera** (movimento pronto ou à mão: foco e zoom do começo e do fim, para passear por uma ilustração larga), a
  transição (dissolver, corte, clarão, pelo preto), o tempo (a cena passa sozinha, com pausa; sem tempo, espera o mestre; o último quadro congela
  até ele fechar), um som de efeito e a legenda (digitada), mais a **fala só do mestre** (nunca vai para a mesa). Música em loop, faixas de cinema
  (opcional). Teclas: → ou espaço avança, ← volta, P pausa, Esc fecha ("Voltar ao tabuleiro"). **A cena pode ser ligada a uma sala** ("Ligar à sala
  de agora"): quando o mestre entra nela, um aviso discreto oferece soltar (nunca solta sozinha). Código: `shared/src/cenas.ts`, `server/src/hotel.ts`
  (`cenaMsg`, relógio `cenaPasso`), `client/src/ui/cenas.ts` (editor), `cenaTela.ts` (a tela), `cenaSugestao.ts`, `cenas.css`; upload de música em
  `/api/cenas-audio`; 15 testes em `server/test/cenas.test.ts`. A referência foi o vídeo da Ceia dos Vampiros do Hexatombe (o mp3 e o mp4 estão em Downloads; não vão para o git).
  **A cena da cela do Geraldo** está pedida ao Códex (seção 4 do `PEDIDO-UNICO-CODEX.txt`: fundo + mão chegando + mão na grade + rosto, tudo
  1920 × 1080 no mesmo lugar). Falta: o Felipe subir a música e as imagens e montar a cena no editor.
- **Combate:** a trava de combate (nada de andar livre nem trocar de comando) agora vale **só para quem está no combate** (`pecaEmCombate`); quem não
  participa, ou está em outra cena, anda e se escolhe como sempre; clicar numa peça em combate a seleciona. O servidor manda ao mestre os personagens
  dos participantes que estão em outro grupo de cenas (foto, PV e ficha na aba COMBATE não somem mais). A faixa da iniciativa: cartas baixinhas e
  compridas com rolagem para o lado, nome em todas, × no canto para **tirar do combate** e o card **+ Pôr no combate** no fim. As etapas
  Habilidade, Item, Movimento e Outras usam o mesmo card do menu; a Rolagem da manobra é feita de dois cartões grandes; "Com o quê?" só lista o que
  dá para usar; a etiqueta "Alvo" fica colada em cima do texto do rodapé. (Sobra de teste: a campanha "Sede da Ordem" tem um combate aberto, rodada 1.)
- **Elenco:** fita vermelha "sem peça" nas criaturas sem as 8 direções na pasta da arte (os NPCs já têm todos).
- **Arte dos monstros no tabuleiro** (8 direções, altura da Catarina): no jogo, o Diabo, a Magistrada, o Anfitrião e as 5 faces, o Deus da Morte em
  **lodo preto**, só o crânio claro, sem braçadeiras (v2), e os Existidos **dourados** no estilo dos outros bonecos (v5: marcas, olhos e boca brilhando
  em dourado, cabelo desgrenhado). Os de antes ficam em `arte\PERSONAGENS-ANIMACAO\trabalho\_backup-existidos-dourados`. O Deus da Morte no livro é
  Médio (LR p. 230); o Felipe acha que ele é bem maior: decidir se ganha o tamanho Grande ou só a escala do desenho.
- **O Alosi no estilo dos monstros** foi desenhado só para comparar (`docs/alosi-antigo-e-novo.png`); não entrou no jogo. O Felipe decide se os
  Marcados e os NPCs vão para esse estilo ou se os monstros voltam ao dos NPCs.
- **Ideia do Felipe, ainda não feita:** o passo pelas sombras da Magistrada (ao se mover, uma sombra se abre no chão, ela entra pintada de preto e sai
  de outra sombra que o mestre escolhe).

## Feito em 17/10, madrugada
- ATRAVESSA anda para os lados (alavanca em x; dedo: para onde aponta); em dupla o outro aparece na posição real.
- Feliperama: a notinha da música não cobre mais o canto do letreiro pintado (era o "quadrado feio").
- Cenas: até 40 quadros e quadros de 0,2 s; **modelos quadradões** guardados no jogo: "MODELO · Pesadelo da Cora" (23 quadros, calmo → cortes rápidos/flash → olhos rosa) e "MODELO · Geraldo nas grades" (grades, mão, dedos, rosto). Imagens-bloco em `client/public/arte/modelo-cenas/`; gerador em `scratchpad/modelo_cora.py` (rascunho).
- Fila dos NPCs no estilo dos monstros TERMINOU (10 de 10 folhas v1 em `trabalho/estilo-monstro/<id>/`); comparação em `docs/npcs-estilo-novo-v1.png`. Falta o Felipe aprovar.
- Sessão "passo pelas sombras" ficou pela metade na árvore (hotel.ts, roomInstance.ts, seed.ts, RoomView.ts, db.ts, protocol.ts + test/passoSombras.test.ts, 2 testes falhando): NÃO foi para o jogo.

## COMEÇOU, FALTA CONTINUAR (17/10, noite): os NPCs refeitos no estilo dos monstros

O Felipe viu o Alosi no estilo das peças dos monstros (contorno, sombreado e acabamento do Anfitrião e do Existido) ao lado do de hoje e mandou: **"vamos
refazer nossos NPCs todos para esse estilo, em todas as posições e formatos"** (os Marcados e os NPCs; os monstros ficam como estão).

- **Já rodando no Códex (processo independente, começou sozinho):** `trabalho/fila_estilo_npcs.sh` (log: `trabalho/fila_estilo_npcs.log`) pede, para
  cada NPC (Miguel, Ivete, Geraldo, Camisa Rosa/Pedro, Ruivo, Agatha, Samuel, Herman, Cabelo Rosa/Rosa, Jaleco/Rebecca), as 8 direções em pé, no estilo novo.
  Chega em `trabalho/estilo-monstro/<id>/<id>-8-direcoes-v1.png` (fundo transparente ou magenta). O Alosi (v1) está em `trabalho/alosi-estilo-monstro/`.
  Se o Códex dá "modelo lotado", a fila espera 2 min e repete (até 12 vezes). Nada disso entrou no jogo.
- **Quando o Felipe voltar, em ordem:** (1) olhar cada folha (cortar com `python trabalho/miguel/cortar_8.py <folha> <pasta>/saida-v1 --altura 470`,
  que também limpa o fundo magenta; se sobrar franja rosa, `trabalho/despill_magenta.py <folha.png>`, ou `scripts/contorno_rosa.py
  --corrigir`); (2) ele aprova ou pede ajuste (a referência é o retrato do Elenco e as poses de hoje); (3) instalar com `monstros-tabuleiro/instalar_monstro.py <id> 1`
  (serve para qualquer id); (4) **as outras posições, de cada personagem, a partir da folha nova** (a identidade passa a ser a folha nova): agachado
  (8 direções, `agachado/pedir_agachado.py`), sentado (4 diagonais, `agachado/pedir_sentado.py`), deitado dormindo e caído (`npcs-17-10/pedir_deitado.py`),
  e o armado dos Marcados; o retrato do Elenco/ficha fica como está. (5) depois, os Marcados (Tepes, Catarina, Cora; o Alosi já está feito) pelo mesmo caminho;
  a Camarilla (cachorro, escala 0,8 m) e o Existido ficam de fora por enquanto.
- Conferir sempre: altura (470 px, a da Catarina), contorno rosa (`scripts/contorno_rosa.py`), e o quadro no tabuleiro (a pose sentada em banco alto e baixo).

## PARA A SESSÃO DE 18/10 (Sede / Fazenda): o que falta

- **Atualizar o jogo de verdade (8080) de manhã**, antes da sessão: backup do banco (`npm run banco:backup`) e
  `npm run crona`. Nada de 17/10 está nele ainda (o Felipe escolheu atualizar só de manhã).
- **Sprites, na ordem que o Felipe pediu** (fila do Códex, conta nova dhellinho…, Plus): os dois Existidos refeitos
  pelo retrato do Elenco; as poses que faltam dos NPCs da Ordem (Agatha, Samuel, Miguel, Ivete, Rebecca, Geraldo): o
  Samuel agachado com a cabeça do tamanho da em pé (estava ~25% maior), o Geraldo agachado e o sentado de todos; a
  **Marcela Geleerd** (a médica da ala médica da Sede) ainda não existe no Elenco nem tem arte. Depois: o agachado
  armado dos Marcados, Pedro, Rosa, Joaquin, Herman e os portadores de relíquia.
- **Sem resposta ainda:** onde o nome do NPC não salva (Elenco, lápis da aba NPCs ou Identificação).
- **Os Existidos ficam com a arte de antes** (dourada, a que o Felipe gostou; restaurada em f75c1261): não refazer.
- **A fila do Códex** (sessão "Sprite Agachado", conta dhellinhocreycrey, Plus; cota de imagem curta, ~9 por vez):
  segue sozinha (Geraldo agachado, depois o sentado dos NPCs da Ordem e dos Marcados, o agachado armado e os
  portadores de relíquia). Cada peça é conferida (altura, cabeça, cor, contorno rosa) antes de instalar.
- **Andar e atacar: conferido pelo Felipe em 17/10, "deu certinho".**
- **Existidos (17/10, esclarecido):** o retrato do Elenco fica como está (dourado, brilhos, olhos dourados); o
  BONECO do tabuleiro é que vai ser refeito, no chibi dos outros personagens mas no estilo dourado dos retratos. Está
  na fila do Códex; os de agora ficam até os novos serem aprovados.
- **Feito em 17/10, fim do dia, sem conferir no jogo:** em combate o clique no chão não anda e clicar noutra peça não
  passa o comando (`RoomView.emCombate`); a manobra longe do alvo tem "Andar e tentar" e não confirma de longe;
  deitado: ferido usa a pose de caído, inteiro usa a de dormindo.
- **Pedidos do Felipe ainda não feitos:** o registro do combate está com a ordem trocada (ele diz que o início fica
  embaixo; no código o mais antigo está em cima e rola para o fim: ver se ele quer o mais novo em cima); conferir no combate o passo Efeito da manobra e o alvo que não zera ao
  passar o turno; Marcela Geleerd (precisa de referência dele); a Camarilla deitada.
- Visto só na prévia (conferir no 8080): a tranca, apagar as luzes, o chuveiro, as TVs, a fumaça da chaminé.

## Feito em 17/10, tarde e noite (branch `claude/tatica-codigo`, sessão principal)

- A coberta da cama (Ctrl + clique), sem duplicar a cama e abaixo do queixo. O fogão a lenha sem a chama solta na
  chapa. A janela da cozinha refeita só com a janela e as cortinas (sem a pia na cena e sem pixel de parede).
- As casas comuns (`server/src/casaComum.ts`): a de cidade (Santa Amália) e a mineira (Tiradentes, Igarapé), sem a
  cara de roça (fogão a gás, geladeira, TV), com o oratório e os quadros, e o **banheirinho** em todas. A pousada e as
  palafitas com fogão a gás. Os **apartamentos** dos prédios do Igarapé (cada porta do corredor leva ao seu).
- O banho: entrar no box, o chuveiro (som, água, vapor com a porta fechada), o vidro embaçado do pescoço para baixo
  e a peça de frente; no vaso, o mosaico do The Sims.
- As TVs ligam e desligam (clique duplo), a do rack passa o jornal, as de parede mexem (`quadrosGiros` nos móveis de
  chão). A chaminé só nas casas do Igarapé com fogão a lenha (casa 1 e 4, modelos `~c`/`~d`), com a pluma contínua
  saindo de dentro do buraco quando o fogão está aceso (`fumaca` no item, o servidor marca).
- A aba PLAYERS com os agentes sempre primeiro (− e + valem em qualquer campanha); o ⋯ do card abre um menu (tirar
  da cena). A rolagem dos painéis não volta ao topo ao refazer (`manterRolagem`, em `ui/dom.ts`). Sem o nome em cima
  das peças. O clique atravessa prédio e árvore transparentes. A Camarilla (o cachorro do Tepes) no meio da casa
  (patas da frente e de trás) e girando nas 8 direções. A cadeira sem entrar demais embaixo da mesinha.

## A FILA DE AGORA (09/10, noite: o que o Felipe pediu e ainda falta)

Feito em 09/10 (noite): o Orfanato pela planta (corredor da frente → salão sem porta desenhada, `passagem_aberta`;
salão com mesinhas e o balcão no canto oposto às frases); móvel **quebrado** (`FloorItem.quebrado`, botão
Destruir/Consertar no painel do objeto); as frases com letra de dedo; **andar em grupo** (Shift + clique); o
**mapa-múndi** sem o Brasil, ilhas maiores; a arte da cidadezinha virou **Tiradentes**.

Falta, na ordem:
1. ~~**Mesas do tamanho certo** e **o vão embaixo da mesa**.~~ **Feito em 12/10** (branch `claude/mesas`, abaixo).
2. **Igarapé**: outra cidadezinha parecida com Tiradentes (cenas + pedir ao Códex a ilha e as duas chegadas).
3. **Santo Berço**: o lugar de Morte, medieval, espiral, lodo, cristais. A pesquisa e o plano estão em
   [`SANTO-BERCO.md`](SANTO-BERCO.md). Cada cômodo uma cena.
4. **Monstros: FEITO o bestiário (10/10).** Botão CRIATURAS na barra do tabuleiro (`client/src/ui/bestiario.ts`):
   cada criatura (`shared/src/bestiario.ts`, `db.bestiario`) tem uma ficha (do livro ou adaptada), os PV, as
   aparências e a marca `flutua`. "Colocar em campo" põe N peças (aparência escolhida ou "variadas"), cada uma com os
   próprios PV e condições; a ficha do combate é a da criatura (`fichasDasAmeacas` no `hotel.ts`), salvo a peça que
   o mestre editou no combate. No painel da peça, o grupo "Aparência" troca a cara. O Existido (LR p. 238) já vem no
   bestiário, masculino e feminino, flutuando. **Falta a arte** (pedida ao Códex, seção 0H: `personagens/existido-
   masculino` e `-feminino`, 8 direções e retrato; e o ícone `mesa-criaturas.png`). Quando chegar: registrar o
   personagem (CharacterDef com a folha na pasta) para o `charDaArte` achar e montar as poses (`arte:poses`).
5. **Ilustrações de momento** (a Agatha na loja, a Ivete na loja de armas, o começo de um combate): a imagem toma a
   tela (mestre e mesa), como as da viagem. O Felipe quer primeiro pensar o USO no tabuleiro (proposta na conversa).
6. A escrita de sangue: o Felipe quer ela bem rústica; se a letra de código não bastar, pedir ao Códex uma imagem.

## Para a conversa nova (06/10)

O Felipe trocou de conta do Claude em 06/10. Tudo do CRONA está em `F:\Dhellow\CRONA` (a tabela "Onde está cada coisa", abaixo); abra a conversa na pasta `F:\Dhellow\CRONA\projeto`. O jogo de verdade roda no Docker (`npm run crona`, `http://localhost:8080`); o banco `crona` fica preso a ele, e a prévia do Claude usa o `crona_visual` (preset `crona-visual` do `.claude/launch.json`).

Na primeira conversa nova:
1. ~~Teste a lista vazia das condições.~~ **Visto em 06/10 na prévia:** no cartão do agente (PLAYERS do MAPA), "+ Condição" marca, e tirar a última e Gravar deixa a lista vazia (o Gravar fica liberado com 0 de 40); depois de recarregar, continua vazia.
2. ~~Apague a pasta antiga `MEUS PROJETOS\CROMA`.~~ **Feito em 06/10:** conferida (o commit `74b39e6`, mais velho que o daqui; nada faltava no F:) e mandada para a Lixeira, a pedido do Felipe.
3. ~~Pergunte o que vem primeiro.~~ O Felipe escolheu as **ferramentas da mesa** (feitas em 06/10, abaixo). Continuam esperando: o PR para a `main` e o nome do repositório (o login no GitHub), as entregas do Códex e a parte do jogador.

A conversa de 06/10 abriu na pasta `F:\Dhellow\CRONA` (não na `projeto`): o painel do navegador procura o `.claude/launch.json` na pasta da conversa, e por isso existe um `F:\Dhellow\CRONA\.claude\launch.json` com o `crona-visual` apontando para `projeto/scripts/dev/visual.mjs`.

## O git agora

- **Branch de 06/10:** `claude/ferramentas-mesa`, aberta a partir da `claude/personagens-3d` (que ainda não entrou na `main`): as ferramentas da mesa. Quando a `personagens-3d` entrar, esta vai junto ou logo depois.
- **Branch:** `claude/personagens-3d`, com tudo de 30/09 a 03/10. Em 03/10 o Felipe mandou abrir o PR e juntar na `main`.
  - Confira no GitHub se o PR entrou.
  - Se entrou, a próxima branch sai da `main` atualizada. Se não, continue nesta branch ou abra a próxima a partir dela. Nunca parta da `main` velha.
  - Em 04/10 isso ficou parado só porque o Chrome do PC estava sem login no GitHub (o Claude não digita senha).
- **O nome do repositório no GitHub:** ainda é `CROMA`. A troca para `CRONA` está autorizada pelo Felipe, que pediu o nome novo em todos os lugares.
  - Com ele logado no Chrome: Settings → General → Repository name.
  - Depois: `git remote set-url origin https://github.com/FelipeSiqueiraDev/CRONA.git`.
  - Os links antigos continuam funcionando: o GitHub redireciona.
- **As branches antigas já estão dentro desta.** A `main` está toda nela (o PR entra sem conflito). As branches enviadas desde 29/09 também:
  - `claude/combate-completo`, `mapa-sem-arte`, `mochila-itens`, `tepes-32bits`, `verissimo-erros`;
  - `codex/arte-telas-checklist`, `arte-tepes-32bits`;
  - `claude/celular-fichas`, trazida em 03/10.

  O PR aberto `FelipeSiqueiraDev/CROMA#2` (`codex/arte-tepes-32bits`) fica sobrando quando esta entrar: dá para fechar.
- **Fora do git, de propósito.** Não faça commit sem perguntar:

| Arquivo | O que é |
|---|---|
| `client/public/arte/cenarios/` | A ilustração da Sede do Códex, alvo de estilo. Só neste computador. |
| `client/public/arte/mobiliario/bar-128/`, `bar-chair/`, `bar/` | Arte antiga do Códex, guardada como referência. O jogo não usa. |

(A sobra da câmera de cima, em `client/src/render/iso.ts`, foi descartada em 03/10 a pedido do Felipe.)

## Onde está cada coisa (desde 05/10, tudo no F:)

O C: encheu em 05/10 (0 bytes livres, o Docker parou). A pedido do Felipe, tudo o que é do CRONA foi para **`F:\Dhellow\CRONA`**, e as cópias do C: foram apagadas depois de conferidas (mesmo número de arquivos e de bytes).

| O que | Onde |
|---|---|
| O projeto (o repositório) | `F:\Dhellow\CRONA\projeto` (até 05/10: `...\OneDrive\Área de Trabalho\Dhellow\MEUS PROJETOS\CRONA`) |
| A pasta da arte do GPT (os `PROMPT-*.txt`, os gabaritos, as entregas) | `F:\Dhellow\CRONA\arte\TEXTURAS MAPA\BASE - Ordo Realitas` |
| O Blender (personagens 3D) | `F:\Dhellow\CRONA\3d` |
| O disco do Docker (o jogo, o banco e os volumes) | `F:\Dhellow\CRONA\docker\DockerDesktopWSL` (movido pelo Felipe em 05/10, pela tela do Docker). Guarda também os containers dos outros projetos dele (o C.R.I.S e outros). |
| As entregas do Códex | Ainda em `C:\Users\felip\Documents\Codex` (2,3 GB): o Códex retoma a interface lá em 06/10. Depois da entrega, mover para `F:\Dhellow\CRONA\arte`. |
| A pasta antiga `MEUS PROJETOS\CROMA` (cópia de antes da troca de nome) | Na Lixeira desde 06/10 (conferida antes: nada faltava no F:). |

**O nome:** é CRONA em todo lugar. Em 05/10 saíram a compatibilidade com o nome antigo (as variáveis `CROMA_*`, a migração das chaves `croma.*` do navegador e dos nomes das salas no banco), a pasta `CROMA-3D` e o banco antigo (`croma-postgres` e o volume `croma_croma-dados`; a cópia dele fica em `server/data/backups/croma_2026-10-03_20-00-07.dump`). Falta só o nome do repositório no GitHub (`FelipeSiqueiraDev/CROMA`), que espera o login. O `filmar.py` ainda lê `croma_vistas` nos `.blend` antigos.

## O que a branch tem (de 30/09 a 03/10)

- **Tabuleiro e Sede:**
  - todos os cômodos da Sede com arte e arrumados em tamanho de verdade;
  - portas com arte;
  - a prisão sem grade: celas de concreto, escuras fechadas e transparentes abertas (`client/src/room/celas.ts`);
  - a Câmara do Selo;
  - a senha da geladeira num teclado grande.
- **Personagens:**
  - a Alosi em boneco animado (respira, pisca, anda);
  - o pipeline 3D (`scripts/3d/`);
  - os bonecos na proporção real.
- **Vista tática (tecla T):**
  - a câmera sobe e mostra a sala de cima, como mapa de batalha;
  - a mesa acompanha;
  - o Bar já tem a arte de cima (`client/src/render/mapaTatico.ts`).
- **Escala das regras:** a casa tem 0,75 m em tudo, nos móveis, nas pessoas e nas casas.
- **Fazenda Olhos de Águia:**
  - mundo aberto, os interiores e os arredores;
  - em 03/10, **o calabouço embaixo do feno do celeiro**: alçapão sem senha, escada de mão, Calabouço, Corredor Escuro e Sala de Sangue (`docs/FAZENDA.md`).
- **Itens:**
  - 87 ícones pintados;
  - a **requisição de equipamento** (`shared/src/regras/requisicao.ts` e `client/src/ui/requisicao.ts`): a janela de escolher os itens da ficha por categoria, patente, carga, proficiência e munição, também no celular.
- **Telas:** MAPA quase 16:9; FICHAS e COMBATE sem cortes.
- **Regras:** as conferências do Veríssimo (V-1 a V-117) corrigidas.
- **Ferramentas no repositório** (antes ficavam no rascunho de uma sessão):
  - `scripts/dev/`: banco de teste, captura, vigia de zips, folha dos giros;
  - `scripts/3d/`: auditoria, eixos, fila, folha de cima, pedido da vista de cima.
- **A tela de entrada e as contas (04/10).**
  - **A tela:** é a arte do Felipe, em `client/public/arte/login/`: a mesa de RPG à luz de vela, uma versão para o computador e uma para o celular. Os campos de verdade ficam em cima dos desenhados (`client/src/ui/entrada.ts` e `entrada.css`).
  - **As animações:** a vela tremula e ilumina a mesa, o céu pisca, a lua pulsa, sai fumaça da caneca, o emblema brilha com faíscas, a poeira flutua na luz e um brilho passa pelo botão.
  - **O fundo vivo (06/10, revisto em 07/10):** cada visita sorteia a cena: o tema (fantasia, horror ou cyberpunk), a hora do relógio (dia, dourado, noite), o clima, a vela e, às vezes, olhos de monstro no escuro (`client/src/ui/entradaCena.ts`), com uma lista de músicas sintetizadas por tema, sorteada a cada visita (o cyberpunk em techno sombria; a synthwave de aventura foi para a fantasia), e o som do ambiente (`client/src/ui/entradaTrilha.ts`). Genérico: nada dos agentes da campanha. Cada tema é uma imagem inteira, a de hoje editada pelo Códex (o kit em camadas foi testado e recusado em 07/10). Tudo em [`TELA-ENTRADA.md`](TELA-ENTRADA.md). As seis salas (três temas, computador e celular) e as seis cidades (normal e com neve) chegaram em 07/10 e estão no jogo: os vidros da janela são magenta, lá fora entra a cidade do tema com o céu e o clima do código (a cidade com neve aparece aos poucos quando nevar). O painel é recortado pela forma exata (`client/src/ui/entradaPainel.json`, o mesmo contorno no encaixe e na luz) e assenta na mesa com uma sombra suave, sem caixa em volta. O encaixe é `node scripts/entrada-fundos.mjs encaixar` (sala) e `paisagem` (cidade). **Para o Felipe ver:** a prévia publicada (Entrada Viva do CRONA) passeia pelos momentos nos três temas. A logo nova que o Felipe mandou (o d20 dourado com as letras e a estrelinha no O) é a logo da tela de entrada, por cima do painel; a variação azul-prateada dela passa como um brilho (`scripts/entrada-logo.py` gera tudo; o emblema e as letras antigos são apagados do painel no encaixe).
  - **As contas** ficam no servidor (`server/src/contas.ts`, guardadas na tabela `config`):
    - e-mail e senha, com a senha em scrypt;
    - uma sessão por aparelho, que vale 180 dias;
    - depois de 5 senhas erradas, a conexão espera 30 s.
  - **Os papéis:**
    - a primeira conta, ou a criada no computador do servidor, é de **mestre**; as outras são de **jogador**;
    - o jogador abre o link `?ficha=` com a conta e a ficha fica ligada a ela; nas próximas vezes, entra direto na ficha.
  - **Continua como antes:**
    - a mesa (`?mesa`), os links `?ficha=` e `?mestre=`;
    - o `?auto` do desenvolvimento, que pula a entrada.
  - **"Encerrar sessão"** sai da conta e volta à entrada.
  - **Testes:** 6 em `server/test/contas.test.ts`.
- **A marca CRONA (04/10):**
  - os logos estão em `client/public/arte/marca/`;
  - o ícone do CRONA aparece na aba do navegador e no celular.
- **Proporções do tabuleiro (04/10)**, pedidas pelo Felipe ("os objetos estão maiores que deveriam", "o personagem não está no mapa de verdade"):
  - **Pés no chão:** a pose em alta definição (`npm run arte:poses -- <nome> --hd`) não vira pixel art. O tabuleiro acha os dois pés na imagem e põe a âncora no meio deles (`pesPontos` em `sprites.ts`): o anel passa embaixo de cada pé e cada pé tem a sombra de contato dele (`RoomView.ts`).
  - **Portas:** ficam do tamanho da arte (vão de 0,8 m, `VAO_PORTA_M` em `furniKit.ts`). Na ordem de desenho, a moldura é parede (`naParede`): a estante e a pia encostadas vêm na frente dela. O buraco da parede na porta principal fica embaixo da moldura. Tentei estreitar a porta (apertando, e depois cortando uma faixa da imagem): entortava o batente e cortava o cadeado, e o Felipe preferiu a arte como está.
  - **Quadros de parede:** o gerador desenhou alguns mais deitados que a parede (o quadro com 0,35 em vez de 0,5, a TV com 0,24, o relógio, o painel de ferramentas, o bilhete). O jogo mede as bordas da arte e inclina na vertical até seguirem a parede (`inclinacaoDoDesenho` em `furniArte.ts`); o que não é retângulo (a câmera, o extintor) fica como está.
  - **Móveis que passavam da casa:** o gerador desenha largo e o `moveis.py` acerta pela altura. Agora a peça cuja base passa da casa encolhe por igual até caber (`encaixe` em `furniArte.ts`, medido na própria imagem: vale para a arte nova também). Foram 17 de 95; os que mais encolheram: carrinho (77%), biombo (80%), fliperama (84%), carrinho do zelador (85%) e poltronas (91%). Eles ficaram mais baixos que o tamanho de verdade: ver "Arte em aberto".
  - **Vista de cima:** a ficha da peça tem 1 casa (0,75 m), o tamanho de uma pessoa vista de cima, na proporção dos móveis (antes, 1 quadrado de 1,5 m). Os móveis usam a mesma base do isométrico.
  - **Passagem secreta:** o mestre abre a qualquer hora (antes, a senha era recusada com a sala sem peça); ela se fecha sozinha quando não sobra peça e o mestre sai da cena (`temAlguem` em `roomInstance.ts`). Vale para a geladeira e para o feno do alçapão.
  - **Vista tática:** "Mover" um móvel funciona lá em cima (antes o clique ignorava): o fantasma verde ou vermelho na casa do mouse, com a frente marcada, e o móvel escolhido com o contorno tracejado.
  - **Entrada:** entra com o e-mail ou com o nome da conta; a regra dos 6 caracteres vale só para criar. `scripts/dev/conta.mts` cria uma conta direto no banco (servidor parado). A prévia (`crona_visual`) tem a conta `admin`, de mestre, para o Felipe ver a tela.

## Feito em 10/10: o minimapa (na nuvem, branch `claude/nuvem-continuacao`)

Conversa aberta na nuvem (claude.ai/code), num clone limpo do GitHub: **o que estava sem commit no PC do Felipe não está nesta branch.** Ao juntar, cuidado com conflito no `shell.ts` e no `mapa.css`.

- **A planta virou o minimapa** (`client/src/ui/minimapa.ts`), em níveis: **Terreno › Prédio › Andar › Cômodo**.
  - **Terreno** (a cena ao ar livre): o mapa gerado das cenas: o chão (`terreno`), as árvores, a cerca, as plantações, a fonte, os prédios com telhado de quatro águas e a plaquinha (que não tampa outra), "Plantações", "Lago" e "Rio" achados sozinhos, a saída para o outro terreno ("← Arredores"), a rosa dos ventos, a régua em metros e as peças. O prédio onde o grupo está fica vermelho com o alfinete; o selo no telhado mostra quem está lá dentro.
  - **Clicar num prédio desce até ele** (zoom no telhado, a planta nasce dele); a escada (▲ ▼) troca o andar; o botão ‹, o botão direito ou a roda para trás sobem. O título diz onde se está ("Casarão › Térreo"). **Sem abas em cima do mapa** (pedido do Felipe em 10/10): navega-se pelo próprio mapa.
  - **O botão das camadas** (no canto) abre a janela com todos os lugares: cada terreno, os prédios dele (abrem os andares e os cômodos), as bolinhas de quem está em cada um e o "Aqui" do grupo. Clicar num nome mostra no minimapa com o cartão; o Entrar (aparece no mouse em cima) leva a cena.
  - **Espiar é diferente de ir:** clicar num cômodo só abre o cartão (nome, andar, prédio, quem está). **Entrar** (ou o clique duplo) leva só a cena: o tabuleiro e a mesa vão para lá e as peças ficam onde estão. **Levar o grupo** (dourado, aparece quando há agente fora dela; também na lista de lugares) leva as peças dos agentes de todas as cenas da campanha para lá e abre a cena (mensagem `grupoPara`, só o mestre; agente = peça de personagem com ficha, como no mapa improvisado; NPCs e ameaças ficam). O ◎ volta para onde o grupo está.
  - **Grupo dividido (10/10):** no cartão, os agentes de fora aparecem como etiquetas ("Vão:"); clicar num deixa ele (riscado) e o botão vira "Levar 3". Arrastar a peça (o quadradinho) de um lugar para outro no minimapa leva só ela, sem trocar a cena (`grupoPara` com `tokens` e `entrar: false`); soltar num prédio do terreno leva para a entrada dele.
  - **Visitado / não visitado (10/10):** a campanha guarda `visitadas` (as cenas onde já houve agente; o servidor marca sozinho em `marcarVisitas`). O não visitado fica apagado: o cômodo escuro, o prédio do terreno escurecido, o terreno inteiro mais escuro, a linha da lista apagada. O mestre troca no cartão ("visitado" / "não visitado") e, na lista de lugares, "Tudo visitado" ou "Limpar visitas" (mensagem `visitada`). **Campanha antiga começa sem visitas** (só onde o grupo está agora): na Sede, use "Tudo visitado".
  - **Nada é preenchido à mão:** a hierarquia sai das passagens (`shared/src/locais.ts`, `montarLocais`, teste em `server/test/locais.test.ts`). O servidor manda, nas cenas ao ar livre, a cena que cada prédio abre (`marcos[].entra`, pela passagem encostada nele) e o que está no chão (`simbolos`). Mapa novo (o map building, no futuro) ganha minimapa sozinho.
  - A Sede (sem terreno) continua como planta do prédio, com as abas Térreo e Subsolo, agora com o nome de cada cômodo e as escadas (▲ ▼).
  - O Alt + arrastar do mestre continua mudando o cômodo de lugar na planta.
  - **Visual de game antigo (10/10, pedido do Felipe: "abandonamos o papel"):** o painel é um HUD com a moldura azul do tabuleiro (`--ui-tabuleiro-moldura-tabuleiro-fonte`), os botões do HUD e a fonte Pixelify Sans, como a plaquinha do tabuleiro. O terreno é pixel art (4 pixels por casa, ampliado sem suavizar: grama pontilhada, estrada com beira, água com marola, copas redondas com sombra, telhado de quatro águas com telhas e cumeeira, milho em fileira, cerca com mourão). A planta do andar é como o mapa de masmorra: piso em ladrilhos escuros, parede clara por fora e apagada por dentro, portas douradas, escadas ▲ ▼ douradas; o cômodo do grupo em vermelho, que acende com uma varredura quando o grupo entra. A lista de lugares abre numa janela do HUD (Esc fecha). O CSS fica em `client/src/ui/minimapa.css`. **O resto da coluna da esquerda (o cartão da sala, "Nesta cena") ainda é papel.**
- **Falta / ideias:** abrir o minimapa grande por cima do tabuleiro (tecla M); o painel "Local selecionado" da referência do Códex (foto da cena, descrição, conexões); dar nome às áreas do terreno (hoje "Plantações", "Lago" e "Rio" saem pelo chão); a mesa mostrar só o que o mestre revelou; ver o tablet de verdade.

## Feito em 17/10, noite (branch `claude/tatica-codigo`): mesas, cadeiras e banquetas na altura de verdade

O Felipe, na Sala dos Valença: "Mesa alta né menino?! Catarina quase sumiu atrás dela". O `aumento` de 12/10 crescia a arte em pixel também na altura (a mesa da cozinha saía com 0,94 m, o tampo no peito de quem está em pé).

- **Agora o `aumento` vale só para a largura e o fundo** (o tampo continua cobrindo as casas). A altura é a de verdade: mesa de jantar, cozinha, escritório, trabalho, redonda e de reunião 0,76 m; mesinha 0,70; xadrez 0,74; mesa das ferramentas 0,78; mesa de bar 0,75 (a das cadeiras de plástico); mesas de laboratório, contenção, arsenal e bancada de armas 0,90; assento das cadeiras 0,45 (encosto a 0,92), escritório 0,47; banqueta 0,45; banqueta de laboratório e giratória 0,70; banqueta de balcão 0,75 (balcão de 1,1 m); cadeira gamer 1,32.
- **A arte foi redesenhada nessa altura** (pernas mais curtas, nada esticado): `h` de cada função em `pecas_px/` (casa, escritório, laboratório, ocultismo, bar), `CZ.cadeira(..., hs=, he=)` e a mesa da cozinha no `exportar_px.py`; a coluna da mesa redonda segue o tampo. Exportado com `exportar_px`, `exportar_cima_px` e `exportar_voo_px` só dessas 24 peças. O `contorno_rosa.py` só acusa a cadeira gamer: são as asas roxas dela, as mesmas da arte de antes.
- **`height` no `furni.ts`** na altura nova (os itens pousam no tampo novo; quem senta fica a 0,45 m; a cadeira continua entrando embaixo da mesa).
- **O banco desce o que estava em cima** (uma vez, `db.mesasReais`, em `mesasMaisAltas` do `seed.ts`, com a tabela `ALTURA_AUMENTADA`): o vaso, as canecas e os papéis acompanham o tampo. A `crona_visual` já desceu; o jogo de verdade desce quando subir de novo (`npm run crona`). Teste: `server/test/alturaReal.test.ts`.
- Conferido de perto na Sala dos Valença (Catarina em pé ao lado da mesa: o tampo no quadril), no Bar e no Laboratório, e numa folha peça a peça com a Catarina ao lado. A pose sentada não deu para conferir: os bonecos de hoje não têm o quadro de sentar (ficam em pé na cadeira).
- **Falta:** as peças sem pixel art (`table_meeting`, `chair_red`, `gun_table`) seguem no desenho por código, que já usa a `height` nova.

## Feito em 17/10, tarde (branch `claude/tatica-codigo`, commit 8ba05c2a): a FICHAS mais arrumada e a ficha dos NPCs

- FICHAS: o personagem com a mesma altura em todo giro e na pose do tabuleiro (armado/machucado); Identificação sem
  texto encavalado; nenhum número colado na borda (`caberNumaLinha` com prioridade); PV, PE e SAN embaixo das caixas;
  o modal do item com os números nomeados e os efeitos em pares; OBS dos itens virou o ícone da regra; Rituais vazia
  com aviso; a Evolução em cartões por NEX.
- **Aba NPCS** (só o mestre): a ficha de cada NPC do Elenco (`FichaSalva.npc`), com o nome editável (vale no
  Elenco). O mestre muda os atributos a qualquer hora dentro dos limites; o ponto tirado vira a pendência
  "Distribua 1 ponto" e o jogador só põe o pendente (fora isso, o jogador só muda quando evolui).
- Retratos dos 6 NPCs antigos a partir das fotos do Felipe (`scripts/retrato_npc.py`, rembg `isnet-anime`); os 4
  novos ficaram com os retratos da sessão de arte.
- Contorno rosa: `scripts/contorno_rosa.py` acha e corrige a linha de contorno magenta (só pixel escuro da borda,
  com a cor do contorno de uma pose certa). Corrigidos o Tepes armado e as poses deitadas. Regra: nunca contorno
  rosa em lugar nenhum; conferir antes de instalar arte.
- Falta: conferir de perto a ficha de um NPC criada do zero (a prévia estava ocupada por outra sessão).

## Feito em 17/10 (branch `claude/tatica-codigo`): apagar as luzes, a vela soprada e a chama que treme

O Felipe: "um jeito ali onde eu controlo a iluminação que eu apago todas as fontes de luz, mas não é pra ficar tudo
PRETÃO... Vela tem que soprar, então suave. E as janelas também não se fecham com isso" e "a iluminação da vela podia
trepidar, igual na vida real... dar vida!!!".
- **Apagar as luzes / Acender tudo** no ☀ Clima da cena (`client/src/ui/fx.ts`), com "Fontes de luz: N de M acesas".
  Cada fonte vai para o estado apagado de verdade, como no clique duplo (dá para religar uma a uma); a escuridão da
  cena, o modo (Normal, Piscando, Apagão) e as janelas não mudam. As fontes saem do desenho de cada móvel
  (`client/src/room/fontesDeLuz.ts`: o estado com luz e o sem; a luz `natural` da janela não conta; porta, fechadura,
  quebrado e móvel sem estados ficam de fora), então a TV e as telas entram sozinhas quando o desenho delas der luz no
  estado ligado (hoje o `rack_tv` não tem). O servidor recebe tudo numa mensagem só (`luzes`, só o mestre; teste em
  `server/test/luzes.test.ts`).
- **A chama viva** (`fogoVivo`, em `client/src/render/lighting.ts`): a luz do fogo balança devagar, treme miúdo e, a
  cada uns 10 s, engasga e baixa um instante; a poça de luz respira junto e anda um tiquinho para o lado. A vela (o
  `flicker` pequeno) mexe menos que a lareira. O brilho e a chama em pixel (`particles.ts`) seguem a mesma conta.
- **A vela soprada** (`client/src/render/sopro.ts` e `soproMovel.ts`): o fogo que apaga continua desenhado aceso por
  0,65 s, e nesse tempo as chamas desenhadas encolhem até o pavio (`painter.flame`, a arandela), a luz cai e, no fim,
  sobe um fio de fumaça fino, enrolando (`particles.ts`). A lâmpada elétrica apaga na hora.
- O `RoomView.ts` desenha o estado soprado (`estadoDoMovel` no `addFurni`, `estadoDaParede` no `drawWallItem`; commit
  f55d9a20). O `luzes` avisa a chaminé quando apaga ou acende o fogão a lenha, como o clique duplo.
- **Falta:** o Felipe ver no jogo (foi conferido numa bancada sem conexão). A quarta chama que flutua acima das velas
  (`candles`: a chama em pixel no ponto da luz) é de antes e ficou para depois.

## Feito em 17/10 (branch `claude/tatica-codigo`): as miniaturas respiram no tabuleiro

O Felipe: "deixar um movimento fluido e natural das miniaturas respirando no campo", "ninguém respira pela perna, o
peito sobe e desce, acabou", "não estraga os bonecos".
- **Só a pose parada em pé** (`drawPose` com `respira`, em `client/src/render/sprites.ts`): andando, deitada, sentada,
  de cócoras, embaixo da mesa e flutuando, nada muda.
- **Três faixas da mesma imagem** (`paintRespirando`): da cintura para baixo (`CINTURA` = 0,47 da altura, o cinto) como
  é; o tronco, da cintura ao pescoço (`PESCOCO` = 0,64), estica na altura; a cabeça sobe inteira o tanto que o pescoço
  subiu, sem esticar (a primeira versão esticava tudo da cintura para cima e a cabeça "enchia como um balão"). As
  linhas caem em pixel inteiro da tela: sem emenda. No fôlego fundo, a cabeça sobe 0,9 px da arte (`PEITO_SOBE`; ~1 px
  na tela no zoom 1,5, ~2 no zoom 3). Conferido nos quadros: topo e queixo sobem o mesmo tanto, pernas com zero pixel
  mudado, no máximo 0,3 px por quadro.
- **O jeito de respirar sai da ficha**, os mesmos modos do retrato e do personagem grande (`breathMode`, agora também em
  números por `breathPoints` no `portrait.ts`): machucado irregular, SAN baixa ofegante, PE baixo devagar, morrendo
  fraco. Com a arma na mão, mais firme (um pouco mais curto e raso). Cada peça tem a sua volta de fôlegos e começa num
  ponto dela; trocando de estado, emenda em 0,9 s (`client/src/render/folego.ts`). Movimento reduzido: parado.
- `view.respiracaoDe` (no `main.ts`) dá o modo de cada peça; a mesa usa o mesmo tabuleiro.
- **Aprovado pelo Felipe** (versão 2, 17/10: "ficou boa a respiração, pode deixar assim"). O boneco animado
  (`tabuleiro-3d`) e a folha antiga não usam isso.

## Feito em 17/10, tarde (branch `claude/tatica-codigo`): a FICHAS arrumada

O Felipe: "a Mochila não tem título, tá feinha e apertada"; "a Identificação tá tudo torto". (A sessão principal
liberou os arquivos da FICHAS para esta.) O bloco novo fica no fim do `fichas.css` ("A FICHAS ARRUMADA").
- **Identificação** em duas linhas de cinco casas iguais (Nome em duas; Jogador, NEX, Patente / Origem, Classe, Trilha,
  Tema, Local), cada casa uma caixinha com o rótulo em cima e o valor embaixo, e a barra do NEX inteira (estava com 2
  px). A campanha, igual para todos, foi para o título no computador; no celular continua uma casa.
- **Títulos dos Derivados e da Mochila**: nos grupos da tela grande só o primeiro painel tinha título; os Derivados
  ficavam com uma faixa vazia de 4 rem em cima, e a Mochila (antes "Inventário") sem nome.
- **Mochila**: só as linhas que os itens ocupam (os itens e a casa do "+"; antes completava até 15 casas ou até a carga
  livre); no computador as setas ficam em pé ao lado das casas, com "1/2" e "+3" entre elas (a frase inteira na dica),
  e a faixa de baixo saiu: as casas ficaram maiores (80 px). Na casa de cada item, o selo amarelo redondo da categoria
  (I a IV); o peso aparece ao abrir o item.

## Feito em 17/10, tarde (branch `claude/tatica-codigo`): o Elenco em sub-abas e as fotos dos NPCs

- **Sub-abas que abrem e fecham** (pedido do Felipe): os NPCs por grupo e as ameaças por elemento (no lugar das
  pílulas), cada elemento da ameaça de VD mais baixo para a mais alta (a família vai pelo menor VD dela). O que fica
  aberto é lembrado no navegador; na busca, tudo o que bate fica aberto.
- **Grupo do NPC** (`Npc.grupo`, `grupoDoNpc` em `shared/src/npcs.ts`): o mestre escolhe numa lista no visual do HUD
  (no detalhe e ao criar), com "Criar novo grupo" no fim (mensagem `npcGrupoCriar`). Os grupos ficam no banco, na ordem
  (`npcGrupos`), mesmo vazios: Ordo Realitas (no lugar da antiga "Sede da Ordem": Miguel, Agatha, Ivete, Samuel), Lotus
  Branca, Panacea (Arantes), Tiradentes, Igarapé (Geraldo), Santo Berço, Santa Amália e Fazenda Olhos de Águia; depois os
  usados que não estão guardados (Novos (sem nome), os 4 de 17/10) e "Do mestre". O grupo vazio aparece fechado e mais
  apagado. **Excluir grupo (17/10):** só os criados pelo mestre (os que o jogo traz não): a lixeira ao lado do número da
  sub-aba, com a confirmação; os NPCs dele voltam para o grupo de antes (ou "Do mestre"), nenhum é apagado (mensagem
  `npcGrupoApagar`). Ainda não dá para renomear nem reordenar grupo.
  **A moldura das cartas:** a dourada (foco e escolhida) fica sempre carregada por cima e só aparece; antes a imagem da
  moldura era trocada, e na primeira vez a carta ficava sem moldura, só o brilho maior que a foto (o "vãozinho").
- **A foto de cada NPC** (as imagens do Felipe que deram origem a eles) em `arte/personagens/<id>/foto.jpg`, os 10: é
  ela que aparece no card do Elenco, no lugar do bonequinho (o Felipe: "ao invés dos bonequinhos ali pra fazer escolha, a
  foto deles"); o detalhe ao lado continua com a pose do tabuleiro. NPC sem foto mostra a pose.
  O card usa o recorte do rosto (`rosto.jpg`, os olhos no meio, o rosto do mesmo tamanho em todos), feito por
  `trabalho/npcs-17-10/rosto_card.py` (o ponto entre os olhos e o zoom de cada foto, à mão). NPC novo com foto: pôr a
  linha dele no script e rodar.
- **O visual (o Felipe: "tá feia, fundo liso, nem parece que é o CRONA"; "odeio assimetria"):** a moldura pintada do
  tabuleiro em volta da janela, o fundo azul-noite com grão, vinheta e brilho de ouro, os cards na carta pintada dos
  agentes (a figura na janela com o nome por cima, num degradê preto que some para cima; a plaquinha de couro inteira
  é o botão Usar, com a palavra gravada em ouro que acende com o mouse; sem linha embaixo do card; a carta de foco ao
  passar o mouse e na escolhida), a rolagem pintada do kit, as sub-abas com a linha de ouro. Os NPCs com o nome em cima e o
  sobrenome embaixo. As ameaças sem setas nem caixa tracejada: cada versão é um card igual, em seguida da primeira, numa
  grade de colunas iguais.
- **Todo NPC é único (o Felipe, 17/10):** sem etiqueta; o NPC que já está em alguma cena da campanha (a peça com a arte
  dele ou com o nome dele) fica com a carta apagada e "Em cena" no lugar do Usar, e o servidor recusa o segundo
  (`npcsEmCampo` no `hotel.ts`, mandado junto do elenco; a lista se refaz ao abrir o Elenco e a cada Usar).
  Os portadores de relíquia ficaram iguais (o Felipe: "só ficarem apagadas e não com aquele rótulo feio"): sem a
  etiqueta "Único"; em campo, a carta apagada e "Em cena" (`reliquiasEmCampo`).
- **O nome do NPC no Elenco:** o detalhe ganhou o campo Nome. O Felipe escrevia os nomes no "Quem é" (era o único campo):
  os NPCs novos com o nome provisório e um nome próprio no "Quem é" passam a ter esse nome (Pedro Cavalcante, Rosa
  Pimenta, Rebecca Zarkov na prévia; no `upgradeDb`).
- **A Camarilla (o Felipe, 17/10):** a foto dela (`arte/companheiros/camarilla.jpg` e o recorte do rosto
  `camarilla-rosto.jpg`) na aba Companheiro do Tepes: o companheiro "Cão de guarda" sem imagem virou "Camarilla" com a
  foto (no `upgradeDb`, só se ainda tiver o nome antigo). E ela no Elenco (Ordo Realitas) como peça, com `Npc.altura`
  0,8 m (o boneco sai na escala de um cachorro de porte médio: `height` = 104 × 0,8 / 1,8). **A arte entrou (17/10,
  Códex):** as 8 em pé (`oito-direcoes.png` e `tabuleiro-32bits/idle-desarmado-<dir>.png`) e as 8 sentada, instaladas
  como a pose agachada dela (`idle-desarmado-agachado-<dir>.png`: o botão Agachar a senta), na mesma escala da em pé
  (a cabeça bate). A sentada veio com um brilho laranja em volta, de alfa baixo; saiu cortando o alfa em 240.
- **O detalhe da ameaça refeito (o Felipe: "espação em branco ... muito mal distribuído"):** o retrato sempre à vista em
  cima, com o fundo vivo do elemento (`client/src/ui/elencoFundo.ts`, um canvas por código: Sangue escorrendo, Morte com
  espirais se desenhando, Conhecimento com sigilos inventados passando, Energia com raios e plasma colorido, Medo com
  névoa e estática, mundanas com poeira; parado com "menos movimento"); a página do livro num cantinho do retrato
  ("LR p. 217"); no meio, rolando, a ficha: VD, PV, Defesa e Deslocamento, os testes (Fortitude, Reflexos, Vontade em
  cima; Percepção e Iniciativa embaixo), os ataques, as ações, as defesas (RD, imunidades, vulnerabilidades, sentidos,
  presença perturbadora), as habilidades e as caras; embaixo, fixos, Quantas e Usar. A frase "Ainda não foi usada..."
  saiu (o Felipe achou que o bicho estava sem ficha): a ficha do livro aparece inteira, e a explicação do Usar foi
  para a dica dele.
- **Ícones nas sub-abas (o Felipe, 17/10):** cada elemento das ameaças e cada grupo de NPC com um ícone de linha do jogo
  num losango da cor do grupo (nunca o símbolo oficial do elemento): Sangue a gota, Morte a espiral, Conhecimento o
  olho, Energia o raio, Medo o fantasma, Mundanas a pata, Do mestre a pena (Morte: a espiral, pedido do Felipe); Ordo Realitas o escudo, Lotus Branca a lua,
  Panacea o frasco, as cidades o alfinete, a Fazenda o mapa, Novos a pessoa, grupo novo a bandeira. Peça para o Códex:
  os ícones pintados no lugar destes, quando houver cota.
- **Os botões de criar no alto (o Felipe, 17/10):** à direita das abas, em cima do detalhe: "Novo grupo" (o campo do nome
  desce embaixo) e "Novo NPC" na aba dos NPCs; "Nova ameaça" na das ameaças (abre o bestiário, que cria a partir do
  livro). A carta "Novo NPC" saiu da lista.
- **Portadores de relíquia, únicos (o Felipe: "só existe um deles"):** o Diabo, o Deus da Morte, a Magistrada (a antiga
  "Máscara do Desespero", renomeada a pedido dele; o id continua `mascara-do-desespero`) e o Anfitrião com as 5
  variações (`PORTADORES_RELIQUIA` em `shared/src/combate/ameacasLivro.ts`). No Elenco, o selo "Único" e o detalhe sem
  "Quantas"; no servidor, entra um só e o segundo igual é recusado enquanto houver um em alguma cena da MESMA CAMPANHA
  (e não só da cena: ele é um ser só na história; em outra campanha, outra história, pode aparecer). As variações do
  Anfitrião contam cada uma por si (todas juntas, uma de cada). Teste: `server/test/reliquias.test.ts`.
- **A arte deles no tabuleiro: na fila do Códex** (a cota volta às 18:47 de 17/10; `trabalho/monstros-tabuleiro/
  depois_da_cota.sh` começa às 18:55 sozinho): as 8 direções em pé dos 9 portadores, no estilo do Miguel, com a
  identidade do retrato da lista do Elenco (`arte/ameacas/<id>.png`; o Felipe: "a aparência que tá ali na lista, e não a
  do livro original"; a Bíblia não descreve a aparência deles), e os 2 Existidos refeitos nesse estilo a partir do
  retrato da lista (`existido.png`: careca, pele coberta de escrita, olhos brancos, calça verde rasgada; os bonecos de
  hoje estão no traço antigo, realista, dourado e comprido). A criatura do livro já aponta para `arte/personagens/<id do
  livro>/` (`criaturaDoLivro`, e as já criadas no banco), então a arte entra sozinha quando instalada; o retrato é o do
  bestiário. Falta, quando chegar: conferir (altura contra o Miguel, `scripts/contorno_rosa.py`), instalar e mostrar.
- **Várias abas na prévia (o Felipe: "pra eu ver e você também e mexer junto"):** fora do jogo de verdade (o servidor sem
  `--prod`, a prévia do `npm run dev`), o mestre pode ter várias abas abertas ao mesmo tempo; no jogo (8080, `--prod`)
  a aba nova continua derrubando a velha (`hotel.ts`, no `hello`).
- **Os monstros do tabuleiro (o Felipe, 17/10):** quando forem feitos, a referência de cada criatura é o retrato dela no
  bestiário (`arte/ameacas/<id>.png`), respeitando o tamanho (o do livro) e as particularidades de cada uma, para
  encaixar no tabuleiro.
- **Os sobrenomes (o Felipe, 17/10):** Agatha Volkomenn (ocultista da Ordo Realitas), Ivete Beicur (responsável pelo
  arsenal da Ordem) e Samuel Norte (hacker e pesquisador da Ordem). O banco que ainda tem o nome antigo troca sozinho ao
  subir o servidor (`renomearNpcs`); o que o mestre já mudou à mão fica. O jogo de verdade troca quando subir o código novo.

## Feito em 17/10, tarde (branch `claude/tatica-codigo`): arte pelo Códex da conta nova (NPCs novos, agachado, Santa Amália)

O Códex voltou pela conta nova do ChatGPT; tudo pelo `scripts/dev/codex.mjs`, cada imagem conferida antes de entrar. Os
scripts e as tentativas ficam fora do git, em `F:\Dhellow\CRONA\arte\PERSONAGENS-ANIMACAO\trabalho\npcs-17-10\` e
`...\trabalho\agachado\`, e em `...\TEXTURAS MAPA\BASE - Ordo Realitas\_codex-trabalho\2026-10-17-santa-amalia\`.

- **Os 4 NPCs novos, ainda sem nome** (o Felipe dá depois, no Elenco): `npc-camisa-rosa` ("Camisa Rosa"), `npc-ruivo`
  ("Ruivo"), `npc-cabelo-rosa` ("Cabelo Rosa") e `npc-jaleco` ("Jaleco"), na leva nova de `npcsPorLeva`
  (`shared/src/npcs.ts`; o banco recebe uma vez, como as outras levas). No estilo do Miguel e da Catarina, sem mão no
  bolso (braços soltos, mãos à vista). Cada um com as 8 direções paradas, o retrato (`retrato-desarmado.png`, no traço
  dos retratos dos agentes) e o deitado (dormindo e caído). O Camisa Rosa foi refeito uma vez (a tatuagem trocava de
  braço entre as direções; agora tatuagem, braçadeira e relógio ficam no braço esquerdo em todas). Defeitos pequenos que
  ficaram: as mãos em punho (como no Miguel; pedi relaxadas e o gerador manteve), as botas do Jaleco saíram marrons no
  deitado (de pé são pretas). Teste: `server/test/npcs.test.ts` confere a leva, as 8 direções, o retrato e o deitado.
  **Altura (o Felipe: "muito cuidado para não sair com altura errada"):** medida em todas as direções, os 4 ficam entre
  0,97 e 1,01 da altura do Miguel (470 a 488 px), a mesma faixa dos NPCs aprovados (Ágata 468, Samuel 482). A largura da
  cabeça não compara personagens diferentes (o cabelo entra na medida); ela vale dentro do mesmo personagem (agachado).
  **Contorno rosa:** a limpeza de 17/10 (`scripts/contorno_rosa.py --limpar`) tinha passado na Cabelo Rosa (o cabelo é
  rosa de verdade) antes do commit dela; reinstalada das fontes. O que o script ainda aponta nos 4 é rosa de verdade
  (o cabelo dela, a camisa dele), não franja. Conferido no Elenco da prévia (17/10).
- **A pose AGACHADO** (`tabuleiro-32bits/idle-desarmado-agachado-<dir>.png`, formato no `docs/ARTE.md`): o Códex
  desenha as 8 direções a partir das poses de pé do jogo e de um guia de pose (`agachado/guia-agachado-8-direcoes.png`,
  o boneco 3D antigo agachado); `agachado/normalizar_agachado.py` corta e deixa a cabeça do tamanho da pose de pé (a
  faixa medida é a da altura em pé, não a do agachado). A cor por histograma (a do `normalizar.py`) avermelhava o
  rosto (a área de cada cor muda com a pose): quando o gerador satura, `--cor` casa cada tom com o tom parecido da pose
  de pé (`casar_paleta`). O agachado tem ~70% da altura de pé.
  **Feitos (7 de 14):** Miguel, Tepes, Catarina (com `--cor`), Cora (refeita: o rosto e o cabelo saíram diferentes),
  Alosi (com `--cor`; as lentes saíram levemente rosadas), Ivete (com `--cor`) e o Jaleco. **Faltam 7, a cota do Códex
  acabou às 11h de 17/10 e volta às 18:47:** Ágata, Samuel, Geraldo, Arantes, Ruivo, Cabelo Rosa e Camisa Rosa. A fila retoma
  sozinha (`agachado/depois_da_cota.sh`, em segundo plano); se não rodar, `./fila.sh <ids>` e depois, para cada um,
  `python normalizar_agachado.py <id> <id>-agachado-8-direcoes-v1.png` (conferir `conf-<id>.png`) e `--instalar`.
  **Ligado no tabuleiro (17/10):** `findAgachado` (`server/src/portraits.ts`) acha `idle-<desarmado|armado>-agachado-<dir>`
  e manda em `CharacterDef.agachado`; `processPoses` carrega na mesma escala da pose de pé, e o `RoomView` usa a pose
  agachada (`agachadoFor`: a armada quando a peça está armada e houver, senão a desarmada) sem o achatamento de 72%,
  que continua para quem não tem a pose. Agachado não respira nem anda com passos. Visto na prévia com o Miguel.
- **A pose SENTADO (o Felipe, 17/10: "só as 4 direções que os móveis podem ficar"):** o código já está pronto
  (`CharacterDef.sentado`, `findAgachado(..., 'sentado')`, `agachadoFor(..., 'sentado')` no `RoomView`, que desenha a peça
  sentada no piso da casa da cadeira, inteira, sem o corte das pernas; na cama não). A arte está na fila do Códex
  (`trabalho/agachado/depois_da_cota_sentado.sh`, depois do agachado armado): os 4 agentes e o Miguel, as 4 diagonais
  (`pedir_sentado.py`, guia `guia-sentado-4-direcoes.png`). Ao chegar: `normalizar_agachado.py <id> <folha> --sentado`,
  conferir (altura, contorno rosa), `--instalar`, e ver no tabuleiro se o quadril bate no assento (talvez um ajuste de
  altura por cadeira). **Revisto (o Felipe, 17/10):** o sentado de todos os NPCs também, além dos Marcados (os
  personagens dos jogadores: o Felipe passou a chamá-los assim).
- **A fila reordenada para a sessão de 18/10** (`trabalho/fila_sessao.sh`, no lugar da `fila_unica.sh`; revista às
  15:55 pela ordem do Felipe: "Eu preciso dos Existidos, eu preciso dos NPC's da Ordem"): 1) o Geraldo agachado e o sentado da Agatha, do Samuel, do Miguel, da Ivete, da Rebecca
  (npc-jaleco) e do Geraldo; 2) depois, o resto (o agachado armado e o sentado dos Marcados; Pedro, Rosa e Joaquin; o
  armado do Miguel; o Herman; os portadores de relíquia). A cota de imagem da conta nova acabou às 15:52 (9 imagens) e
  volta por volta das 18:47; a fila tenta de novo a cada 5 min. A **Marcela Geleerd** (a médica da ala médica) também
  foi pedida, mas não existe no Elenco: falta a referência de aparência.
  Entraram: o **Geraldo agachado** (a cabeça igualada direção por direção, `normalizar_agachado.py --por-direcao`: o
  gerador desenhou a cabeça até 10% maior em algumas direções) e a **Agatha sentada** (4 diagonais). O quadril no
  assento ainda não foi conferido no tabuleiro.
  **Os Existidos ficam como estavam** (os dourados e alaranjados do commit bc414989, restaurados): o Felipe gostava
  deles e o pedido de refazer foi um mal-entendido. A v1 e a v2 feitas aqui pelo retrato da lista saíram da fila e do
  jogo (as imagens ficam em `trabalho/monstros-tabuleiro/existido-*`, fora do jogo).
- **A fila única da arte** (`trabalho/fila_unica.sh`, a partir das 18:48, um pedido por vez, tentando de novo a cada 5
  min se ainda der o limite de imagem): Camarilla em pé e sentada; Pedro (npc-camisa-rosa, pistola grossa) e Rosa
  (npc-cabelo-rosa, uma submetralhadora em cada mão) armados em pé; os agachados que faltam; o sentado dos Marcados e de
  todos os NPCs; o agachado armado (agentes, Miguel, Pedro, Rosa, Joaquin); os portadores de relíquia; os Existidos.
  O Joaquin é o npc-ruivo (machado de uma mão e escudo de choque), também na fila. Já entraram: a Camarilla (em pé e
  sentada), o Pedro armado (pistola grossa na mão direita), a Rosa armada (uma submetralhadora em cada mão) e o Joaquin armado
  (machado na direita, escudo de choque no braço esquerdo). Agachados novos: Agatha, Samuel. Os agachados vão sempre com `--cor`: sem ela,
  a pele do Samuel saía mais clara e a Agatha mais vermelha. O tamanho conferido pelo fone do Samuel (peça rígida: 120 px
  de orelha a orelha em pé, 119 agachado); a cabeça agachada só parece maior porque os dreads abrem menos. O Códex
  agora põe um brilho em volta com alfa baixo: corta-se o alfa em 240 antes do `cortar_8`. A Rosa casou pela altura
  (`normalizar.py --pela-altura`): o cabelo armado veio mais cheio e, pela cabeça, ela ficava 7% mais baixa.
  **Para o futuro (o Felipe, 17/10):** variar a postura de cada personagem (nem todo mundo agacha, cai ou dorme do mesmo
  jeito), junto com as animações. Por ora, todos na mesma postura.
- **Santa Amália no mapa-múndi e na chegada:** a ilha `arte/mapa/lugar-santa-amalia-hd.png` (praça com coreto,
  prefeitura caiada, casas coloridas, posto branco e azul, avenida, mata atrás; refeita uma vez porque o bloco de terra
  saiu fino) e `santa-amalia` no `CENTRO_HD` do `lugarSprites.ts`; as chegadas `chegada-santa-amalia-1.png` (dia) e
  `-2.png` (noite), refeitas uma vez (o asfalto saiu com uma estampa repetida, como filtro, e o céu da -1 em degraus).

## Feito em 17/10, noite (branch `claude/tatica-codigo`): a tranca sem nada à vista

- **Ctrl + clique do mestre tranca e destranca** o que abre e fecha (porta, armário, escotilha; a cama continua com a
  coberta). `FloorItem.trancado`, separado do aberto e fechado; trancar uma porta aberta fecha. O cadeado e a tranca
  de ferro saíram do desenho e o vermelho da vista tática também; só o painel do objeto lembra o mestre. As passagens
  que estavam no estado 2 (trancada) viraram fechadas e trancadas (`trancasSemCadeado` no `seed.ts`).
- **A peça vai até lá e tenta abrir** (o Felipe: "ele tem que ir abrir pra descobrir que tá fechada"): clicar na porta
  trancada, o clique duplo e o Abrir (com a peça comandada, `use.tokenId`) levam a peça até a frente; lá ela vira para
  a coisa e o servidor manda `trancado` com o id. Em todas as telas a coisa mexe um tiquinho duas vezes e chacoalha
  (`client/src/render/forcar.ts`, por dentro do `N` do `furniKit.ts`) e toca a maçaneta e o trinco
  (`sfx.trancado`: estalos de madeira e ferro, sem tom de jogo). Sem peça, só trava onde está.
- Testes: `server/test/tranca.test.ts`, `sede.test.ts`, `santoBerco.test.ts`.
- **Falta:** ouvir o som no jogo; a arte da porta mexe inteira (folha e batente juntos, 1 a 2 px).

## Feito em 17/10, noite (branch `claude/tatica-codigo`): móveis na parede e caminho livre em todas as cenas

- **A regra do Felipe, para todas as cenas e as próximas** (no `GUIA-DO-CLAUDE.md`, em "Rodar e conferir"): é um
  tabuleiro, a peça anda pela cena e chega em todo móvel. O `server/test/moveisNaParede.test.ts` confere o jogo
  inteiro: (1) móvel de parede (TV, guarda-roupa, fogão, geladeira, pia, estante, arquivo, cômoda, lareira, cama...)
  encostado numa parede que aparece, de frente para a sala (giro 4 com a parede do fundo atrás, giro 2 com a da
  esquerda, ou encostado numa divisória); (2) todo chão livre se alcança da porta; (3) todo móvel tem uma casa do
  lado aonde se chega. O Orfanato, bagunçado de propósito, fica de fora das regras 2 e 3.
- `npx tsx scripts/dev/sala.mts "Lugar · Sala"` desenha a planta em texto (a letra de cada móvel, `!` no chão preso).
- **Arrumado:** Santa Amália (cômodos no tamanho de verdade, a recepção do posto com 47 m², a casa comum com a TV na
  parede, a praça 14 x 10; `SANTA_AMALIA_REV` 11), Sede (celas, posto do carcereiro, Câmara do Selo, laboratório,
  gabinete, banheiro, enfermaria, bar; `SEDE_REV` 60), Fazenda (quartos 2, 3 e das crianças, escritório do capataz,
  sala de sangue; `FAZENDA_REV` 40; os "bolsos" que o `fazendaDecor.test.ts` aceitava foram abertos), Igarapé (as
  casas, a dos Ribeiro, a capela, a palafita; `IGARAPE_REV` 4), Santo Berço (bunker, caverna, celeiro velho com uma
  tábua caída para entrar nas baias, consultório, ferraria, galeria azul, taverna; `SANTO_BERCO_REV` 16),
  Tiradentes (boteco, quartos da pousada, sala do café, venda; `TIRADENTES_REV` 3), Orfanato (os armários, os catres,
  a prateleira, a pia, o armário da cirurgia; `ORFANATO_REV` 23) e a Mansão Alvarez (`seed.ts`: só vale em banco
  novo, ela não tem REV).
- **A ponte do Igarapé** com o parapeito da frente desenhado por cima de quem passa (`FurniDef.parapeito`,
  `parapeitoDaFrente` em `furniArte.ts`) e a altura mudando perto da borda da casa (`userPos` no `RoomView.ts`): a
  peça anda dentro da ponte, não em cima da mureta.
- **Falta:** levar ao jogo de verdade (`npm run crona`, com backup antes, quando o Felipe pedir).

## Feito em 17/10 (branch `claude/tatica-codigo`): Santa Amália e, no Igarapé, a lanchonete, a casa dos Ribeiro e a ponte

- **Santa Amália** (`server/src/seedSantaAmalia.ts`, `SANTA_AMALIA_REV` 4; arte em `scripts/3d/estilo/pecas_px/santa_amalia.py`):
  a cidade (68×56: a avenida, a rua de cima, as duas laterais, a praça com o coreto, a prefeitura no alto, a estrada
  de terra da van no leste e o caminho da casa dos Valença para a mata) e três prédios da história, pelas plantas do
  Felipe: a **Casa dos Valença** (sala, cozinha, área de serviço, banheiro, quarto do casal e o quarto da filha com os
  desenhos de espiral e o lodo), o **Posto de Saúde** (recepção, consultório, procedimentos, triagem, farmácia,
  banheiro e administração) e o **Cartório** (atendimento, sala do oficial, arquivo, depósito, banheiro e copa), mais
  seis casas comuns. A prefeitura ainda não tem interior.
- **O tamanho de fora é o de dentro** (pedido do Felipe): os prédios ficaram mais fundos (casa 8×7, Valença 12×10,
  posto 16×12, cartório 14×11, prefeitura 15×12) e os cômodos cabem na pegada de fora. A porta de dentro fica do
  mesmo lado da de fora.
- As pistas escondidas da Bíblia (a ficha do Arantes com a rubrica, o índice de 2003, a matrícula 1.847 e a
  averbação AV-2, os diários do Augusto) estão nos móveis, só para o mestre. Nada de spoiler na tela dos jogadores.
- **Igarapé** (`IGARAPE_REV` 2): a lanchonete **Big Dog Hot Dogs - Lanches e Açaí** perto da praça e a **Casa dos
  Ribeiro** (a casa da Cora, abandonada, com as cartas do Geraldo e a foto rasgada) no lugar de uma das casas.
- **A ponte do Igarapé** mais alta, com quatro degraus em cada cabeceira, muretas e o parapeito só por cima do vão.
  A altura agora é por casa (`FurniDef.alturas`, `alturaNaCasa` em `shared/src/furni.ts`): 0,3 m na ponta, 0,6 m no
  meio, e a peça sobe e desce em vez de flutuar. Conferida na prévia com peças em cima, no degrau e atrás.
- Testes: `santaAmalia.test.ts` (portas de ida e volta, tudo alcançável a pé, sem fogo dentro) e a ponte no
  `igarape.test.ts`.
- **Falta:** as artes de chegada `chegada-santa-amalia-1/-2` e a ilha no mapa-múndi (Códex, a cota acabou em 17/10;
  até lá entra a ilustração genérica); o interior da prefeitura; levar ao jogo de verdade (`npm run crona`, com
  backup antes); os prédios fundos também em Tiradentes e nas outras cidades.

## Feito em 17/10 (branch `claude/tatica-codigo`): armados, machucados, deitados, retratos e Santo Berço sem fogo

- **Armados** (`idle-armado-<dir>.png`) dos 4 agentes e do Miguel, com a arma padrão de cada um (a arte não muda com a
  arma da ficha): Catarina com a katana em guarda (lâmina para cima), Cora com o fuzil de caça, Tepes com a corrente
  comprida pendurada e o escudo redondo de madeira, Alosi com o livro aberto, Miguel com a luva de boxe com espinhos
  amaldiçoada de Conhecimento. **Machucados** (`idle-desarmado-machucado-<dir>.png`) dos 4 agentes.
- **Tamanho e cor idênticos ao desarmado:** `F:\Dhellow\CRONArte\PERSONAGENS-ANIMACAO	rabalhormado
ormalizar.py`
  (a cabeça igual à da pose desarmada; a cor por histograma). O tabuleiro mede o personagem só pelas poses desarmadas
  (`processPoses` em `sprites.ts`): a armada e a machucada não mudam mais o tamanho dele.
- **Deitados** (`deitado-dormindo.png`, `deitado-caido.png`) dos 10 personagens: o tabuleiro usa no lugar de girar a
  pose de pé (`CharacterDef.deitado`, `findDeitado`); na cama a peça ocupa a cama, em cima do colchão, a cabeça na
  cabeceira (de cabeça para baixo nos leitos da frente). O caído foi refeito seguindo a diagonal do piso.
- **Retratos das 74 ameaças** em `client/public/arte/ameacas/<id>.png` (o Códex pinta a partir de descrições escritas
  das páginas do livro, no estilo do Existido); os cultistas refeitos como vilões. Aparecem no Elenco.
- **Santo Berço sem fogo:** o lampião é luz de cristal (`kind: 'cristal'`), a arandela do Quarto 2 do Hotel virou
  lampião (`SANTO_BERCO_REV` 15) e `santoBerco.test.ts` proíbe peça de fogo lá.
- NPCs Ágata, Ivete, Samuel, Geraldo e Arantes refeitos no estilo do Miguel; falta uma 3ª versão que acerte expressão,
  cabelo, idade e altura de cada um (esperando o Felipe).
- O pacote de estudo para o SpriteForge: `F:\Dhellow\CRONArte\PERSONAGENS-ANIMACAO\estudo-para-spriteforge\`.

## Feito em 16/10, noite (branch `claude/tatica-codigo`): o ELENCO (NPCs e ameaças) e o Miguel Albuquerque

- O botão CRIATURAS do tabuleiro virou **ELENCO** (`client/src/ui/elenco.ts`, `elenco.css`), uma janela do HUD em
  forma de pokédex: a aba **NPCs** e a aba **Ameaças**, com as 74 do livro por elemento (Sangue, Morte,
  Conhecimento, Energia, Medo, Mundanas = animais e pessoas, e "Do mestre" para as criadas à mão), na ordem do livro e
  com as versões juntas (Zumbi de Sangue › Bestial › Colossal; a Degolificada e as 4 versões, em Medo). Cada card tem
  **Usar** (põe uma peça na porta da cena e fecha; com Shift, fica aberta); clicar mostra o detalhe ao lado (VD, PV,
  Defesa, página, a aparência, quantas). A ameaça do livro entra no bestiário sozinha no primeiro Usar. O lápis abre o
  bestiário antigo (`bestiario.ts`) para editar caras, PV e ficha. A busca acha em todas as abas.
- **NPCs** (`shared/src/npcs.ts`, `db.npcs`): nome, "quem é", a pasta da arte; sem ficha (a peça sem ficha é NPC).
  Mensagens `npcSalvar`, `npcApagar`, `npcColocar` (`hotel.ts`). A arte vira personagem sozinha, como a das criaturas.
  O elenco começa com o **Miguel Albuquerque** (`npcsIniciais`; apagar não traz de volta). Teste: `server/test/npcs.test.ts`.
- **Miguel:** desenhado pelo Códex (a imagem do Felipe + a Catarina como modelo de estilo e ângulo), cortado por
  `F:\Dhellow\CRONArte\PERSONAGENS-ANIMACAO	rabalho\miguel\cortar_8.py`: as 8 direções em
  `client/public/arte/personagens/miguel-albuquerque/` (`oito-direcoes.png` e `tabuleiro-32bits/`), um pouco mais alto
  que a Catarina. Ainda sem retrato.

## Feito em 16/10, noite (branch `claude/tatica-codigo`): os agentes deslizam com a pose parada

- O andar animado não ficou bom por nenhum caminho que temos (PixelLab acabou; o 3D do Blender perde rosto e cabelo; o
  andar desenhado pelo Códex treme entre os quadros; o boneco de papel em peças deu aberração). O Felipe escolheu
  (caminho 1): **jogar já com os bonecos parados das 8 direções** (`tabuleiro-32bits/idle-desarmado-<dir>.png`, os 4
  agentes e os 2 Existidos) e o andar fica para depois (artista pago em real, ou um mês de PixelLab). Aprovado no vídeo:
  "tá ótimo na real".
- `DESLIZA_COM_A_POSE` (`client/src/render/sprites.ts`): com as poses, o boneco animado (`tabuleiro-3d/anim.json`, o
  do PixelLab e os de 64 px do Códex) e o `anim.json` antigo ficam guardados e não são usados. Para voltar a um andar
  desenhado, é só desligar a constante.
- Andando: a peça desliza de casa em casa virada para onde vai (o giro de quando vira parada continua); o corpo abaixa
  1,6% da altura no contato a partir dos pés (os pés não saem do chão, a sombra fica no piso; `contatoDoPasso`, 1,3
  passo por casa, sobe rápido e desce devagar como no MOVIMENTO.md); cada contato solta um sopro de poeira em pixel
  embaixo do pé que pisou, um de cada vez (`desenharPoeira` em `RoomView.ts`, 520 ms).
- **Falta conferir:** sentar e deitar com a pose parada (sem o boneco não há pose sentada: a peça fica de pé junto do
  assento, como antes de 15/10); a mesa (tablet); o jogo de verdade (`npm run crona`) ainda não foi atualizado.
- Testes do andar (fora do git): `F:\Dhellow\CRONA\arte\PERSONAGENS-ANIMACAO\trabalho\codex-andar\` (o andar do Códex,
  o boneco de papel e os scripts `andar_desenhado.py` e `boneco_papel.py`); o teste 3D está na pasta do SpriteForge.

## Feito em 16/10 (branch `claude/tatica-codigo`): a mesinha (`table_small`) em pixel

- O Felipe: "essa marrom do lado da sinuca e na frente da poltrona, nada a ver". A `table_small` não tinha arte e saía
  como a caixa de reserva (no Bar, no Hall do Casarão e em mais 14 lugares). Agora `casa.table_small`: o tampo
  quadrado de nogueira com o friso, a saia e as quatro pernas, vazada embaixo (0,74 m). Exportada nos giros, na
  vista de cima e no voo.
- As mesas amarelas do Bar estavam boas (o Felipe: era a mesinha marrom): voltaram para a posição de antes
  (`SEDE_REV` 55); a arrumação de 54 (abaixo) foi desfeita, só os frascos continuam fora.

## Feito em 16/10 (branch `claude/tatica-codigo`): o Bar da Sede rearrumado (`SEDE_REV` 54)

- O Felipe: "esses itens de química no bar, essas mesas fora de posição". Os frascos tinham saído do seed em 15/10
  (`4389304`) sem subir o `SEDE_REV`; o banco de verdade já estava sem eles, a cópia de teste não. Com o 54, a cópia
  também ficou certa.
- As mesas: a porta entra pela esquerda na fileira 11 e a mesa (5,10) ficava no caminho. Agora os corredores da porta
  (y 11) e da frente dos banquinhos (y 5) ficam livres; duas mesas lado a lado entre o balcão e a sinuca (4,7) e (8,7),
  uma no canto de baixo à esquerda (5,13) e a do sofá de canto na frente dele (13–14,13), com duas cadeiras.

## Feito em 16/10 (branch `claude/tatica-codigo`): os itens em cima dos móveis sem "cair"

- O Felipe: "não pode parecer que eles estão prestes a cair; não necessariamente centralizado, mas sem bordas caindo".
- `RoomView.ajusteDoMovel`: o item em cima de um móvel fica com 7 cm de folga até a borda do tampo (o contorno e a
  sombrinha do desenho passam da medida); se não couber, vai para o meio do tampo.
- `RoomView.tampo`: vale também para o balcão alto (até 2,2 m; o do bar tem 1,1) e para a peça encostada pela arte (o
  frigobar, o aparador, as bancadas: o tampo fica no fundo da casa, onde ela é desenhada). Para puxar a cadeira até a
  mesa, as regras de antes (`paraCadeira`). Dos 406 itens em cima de móveis do seed, sobram sem ajuste só as pilhas
  (caixa em cima de caixa) e o que está em cima de chão pisável.

## Feito em 16/10 (branch `claude/tatica-codigo`): Santo Berço sem fogo

- O Felipe: "em Santo Berço não tem fogo; o fogo são os cristais vermelhos" (como já diz o `SANTO-BERCO.md`).
- `RoomData`/`RoomInfo.luzDeCristal` (posto pelo seed em todas as cenas de Santo Berço, `SANTO_BERCO_REV` 12): lá, toda
  luz de fogo vira `kind: 'cristal'` (`RoomView.semFogo`): brilho vermelho, sem a chama animada, sem fumaça e sem brasa.
- O poste de cristal é luz de cristal em qualquer lugar (`furniVila.ts`); as 4 tochas de parede viraram lampiões de
  cristal.
- **As peças de cristal (16/10):** `pecas_px/santo_berco_cristal.py` (lareira_cristal, forja_cristal, fogao_cristal,
  velas_cristal; no catálogo, categoria vila): os cristais vermelhos sobre pedras escuras no lugar da lenha e da brasa
  (`medieval.monte_cristais`; `lareira`/`forja` com `cristais=True`, `cozinha.fogao(lenha=False)`). O seed de Santo
  Berço usa só elas (`SANTO_BERCO_REV` 14). Exportadas: giros, vista de cima, voo e profundidade.
- **As lareiras (16/10, o Felipe: encostadas na parede e nada colado na frente):** `server/test/lareiras.test.ts`
  confere em todas as cenas que toda lareira (pelo tipo) tem o fundo na parede e a fileira da frente livre. Corrigidos
  o Quarto 1 do Hotel (a lenha colada) e o Quarto 4 (a poltrona colada; agora a uma casa, virada para a lareira).

## Feito em 16/10 (branch `claude/tatica-codigo`): o fogo dentro do móvel

- O Felipe: "o fogo só tá por cima do poste e não dentro dele". A chama animada (`particles.chama`) entra na ordem de
  desenho num ponto dentro do móvel, então saía por cima dele inteiro (a grade da lanterna, as pedras da fogueira).
- `scripts/3d/estilo/exportar_frente_px.py` grava a profundidade de cada pixel dos móveis com fogo (`prof-<giro>.png`,
  16 bits em R e G, metros a partir da âncora; `prof` em cada vista do `moveis.json`): poste_ferro, poste_cristal,
  lareira, fogueira, forja, fogao_lenha, candles, candelabra. O `exportar_px.py` guarda a profundidade em `ULTIMA`.
- No jogo: depois da chama, `frenteDoFogo` (furniArte.ts) repõe só os pixels do móvel que estão mais perto da câmera
  que a chama (a profundidade dela sai do `mundo` da luz, `Light.movel` = o item dono). Visto no poste de cristal de
  Santo Berço e na fogueira do Orfanato.
- **Revisto (16/10, o Felipe: "tá errado", a chama da fogueira atrás das pedras):** cada móvel tem a folga dele
  (`folgaFogo`: 0,3 m na fogueira, para só o anel de pedras da frente tapar, e não as lenhas); a luz da fogueira desceu
  de 0,6 para 0,2 m (`furniSede.ts`, a chama nascia acima e atrás das lenhas); e a chama de um móvel entra na ordem logo
  depois dele (na quina da frente), senão a repintura das faces da frente do próprio móvel a cobria.
- **Ao mudar um móvel com fogo:** `exportar_px.py` e depois `exportar_frente_px.py <móvel>`.
- **Falta:** as tochas e arandelas de parede (itens de parede) ainda têm a chama por cima; um móvel novo com fogo entra
  na lista `FOGO_PADRAO` do script.

## Feito em 16/10 (branch `claude/tatica-codigo`): o Tepes pelo PixelLab

- O Felipe escolheu o Tepes feito no PixelLab (API v2, `create-character-v3`, referência: a vista `desarmado-s` reduzida
  a 64×64) no lugar do Tepes do Códex de 15/10. As 8 direções e o script `pl.mjs` estão em
  `F:\Dhellow\CRONA\arte\PERSONAGENS-ANIMACAO\pixellab\` (quadros prontos em `tepes/quadros/`), montados com
  `scripts/dev/personagem_pixel.py <pasta> tepes --escala 1.8`.
- **Em 128 (16/10, o Felipe: "muito pequeno, sem detalhe, ele não tem olho"):** refeito no PixelLab em 128×128 (a
  mesma referência em 128; 2 gerações), no jogo com `--escala 0.9` (o mesmo tamanho na tela, o dobro de detalhe).
  `personagem_pixel.py` agora aceita quadro de qualquer tamanho (a âncora e os pés pelo tamanho). Quadros em
  `arte/PERSONAGENS-ANIMACAO/pixellab/tepes-128/`. Restam 6 gerações na conta.
- **O andar (16/10):** `walking` do PixelLab em 128 (2 gerações por direção, uma direção por pedido no plano de teste):
  sul, leste e norte; o oeste espelha o leste; as diagonais andam com o da frente (SE, SW) ou de costas (NE, NW),
  paradas ficam com a pose delas. Montagem: `pixellab/montar.py` (os quadros de cada direção descem juntos).
  **Firmado (16/10, o Felipe: "andando duro, travadão"):** a vista de frente encolhia de 119 a 112 px e tirava os
  pés do chão (`pixellab/firmar.py` volta cada quadro à altura do primeiro e assenta os pés), e o PixelLab tinha dado
  só meio passo (o mesmo pé levantava); `pixellab/ciclo.py` monta o ciclo inteiro: apoio, passo direito, apoio e o
  mesmo passo espelhado da cintura para baixo (o esquerdo).
  **Falta:** o andar das 4 diagonais (8 gerações) e uma respiração no parado.
- **Antes (64px):** a animação de andar e a de parado faltavam (ele andava deslizando com a pose parada). No PixelLab,
  `POST /characters/animations` custa 1 geração por direção (8 no total); a conta está no plano de teste com 8
  gerações. O Tepes animado do Códex continua no git (`bc414989`).
- **Ao chamar a API pelo Git Bash:** `MSYS_NO_PATHCONV=1` (o `/caminho` vira caminho do Windows e dá 404).

## Feito em 16/10 (branch `claude/tatica-codigo`): quartos de hospedagem com a condição do descanso

- O Felipe: "pelo menos 4 quartos em todo lugar que for hotel ou pousada" (os agentes pagam mais pelo quarto deles), e
  quartos variados (bons, médios, ruins) para pesar na escolha.
- `RoomData.descanso` / `RoomInfo.descanso` / `SceneInfo.descanso` (a condição do LR p. 92: precária, normal,
  confortável, luxuosa), posta pelo seed (`CenaSpec.descanso`, `estilo`).
- **Interlúdio:** cada agente usa a condição do quarto onde a peça dele está (`NoInterludio.lugar`,
  `Hotel.descansoDaFicha`); sem quarto, a do grupo, que o mestre escolhe. A aba mostra "No quarto: condição ..." no
  cartão do agente; o cartão da sala tem o selo "CONDIÇÃO ...".
- **Tiradentes (`TIRADENTES_REV` 2):** o Corredor da Pousada (a escada no meio, dois quartos de cada lado); o Quarto da
  Pousada (o 1) perdeu a escada e ganhou porta; Quarto 2 (confortável), 3 (normal, com o caderno do "ainda não") e 4
  (precária, o dos fundos).
- **Santo Berço (`SANTO_BERCO_REV` 11):** o corredor do hotel com 28 casas e o Quarto 4 (confortável, o dente de leite);
  o Quarto 1 é o normal; 2, 3 e 4 confortáveis.
- **Hall do Casarão (`FAZENDA_REV` 38):** banco, mesinha, aparador e poltrona encostados nas paredes, entre as portas
  (o Felipe: "encostado na parede como é de costume").
- **Falta / ideia:** o preço de cada quarto (o livro não tem tabela de hospedagem; o mestre combina); a arte de pixel da
  `table_small` (ainda caixa).

## Feito em 16/10 (branch `claude/tatica-codigo`): a vista tática toda por código

- O Felipe aprovou o visual da vista tática do Bar e pediu "tática pra tudo nesse estilo, por código". Até aqui, as
  vistas de cima eram do Códex (03/10 a 09/10) e ficavam presas aos móveis de pixel: o `exportar_px.py` guarda a `cima`
  antiga, e a regra de 15/10 (nada do Códex no tabuleiro) filtra o móvel, não a vista de cima dele.
- O motor ganhou a câmera de cima (`motor.camera('cima')`, em `scripts/3d/codigo/motor.py`): reta de cima, 32 px por casa,
  a face em pé some. Na câmera de sempre (`'iso'`) nada muda; o isométrico sai idêntico, pixel a pixel.
- `scripts/3d/estilo/exportar_cima_px.py`: desenha cada móvel do `exportar_px.py` (os mesmos desenhos de `pecas_px/`) de cima,
  frente para baixo, com a luz pela altura, a sombra de uma peça na outra, o contorno e a borda escura. Escreve
  `<móvel>/cima.png` (e `cima-<estado>.png`) e troca `cima`/`cimaEstados` no `moveis.json`. Os 306 móveis de chão já saíram
  (os 71 de parede não entram na tática). `--folha saida.png` faz as folhas para conferir de olho.
- No jogo: a vista de cima de pixel sai sem suavizar (`desenharDeCima`, `mapaTatico.ts`).
- **Ao mexer num móvel:** rodar o `exportar_px.py` e depois o `exportar_cima_px.py` com o mesmo nome (ou `--grupo`).
- **Fracos de cima:** a planta (as folhas são lâminas em pé: vira um pontinho) e a cortina do leito (só o trilho). Ideia:
  um desenho próprio de cima para quem tem folha (a copa vista de cima) no módulo da peça.
- As cópias em WebP (`arte-leve/`, fora do git) precisam do `node scripts/jogo.mjs atualizar` no computador do jogo.
- **A troca de câmera com a arte (16/10):** antes, no caminho do isométrico até o tático, o móvel virava uma caixa (a
  cadeira um bloco cheio, a mesa redonda um quadrado com o tampo em cima). Agora o motor desenha cada móvel em 3 pontos
  do caminho (`motor.camera('voo', s)`, s = 0,25, 0,5 e 0,75, a mesma pose do `poseDaCamera`), nos 4 giros:
  `scripts/3d/estilo/exportar_voo_px.py` escreve `<móvel>/voo-<s>-giro-<g>.png` e `voo`/`vooKv` no `moveis.json` (306
  móveis, uns 35 MB, ~25 min). No jogo (`desenharNoVoo`, `mapaTatico.ts`), o quadro de antes e o de depois se misturam;
  até 0,25 a foto do isométrico se desfaz por cima (`RoomView.frameTatico`); depois de 0,75 a vista de cima aparece.
  O móvel sem os quadros (ou enquanto eles carregam) cai na maquete de antes.
- **Ao mexer num móvel:** `exportar_px.py`, `exportar_cima_px.py` e `exportar_voo_px.py`, com o mesmo nome.
- **A sala inteira no caminho (16/10):** o quadro do móvel vai do ângulo dele para o de agora pelo chão (afim do plano
  z = 0, `desenharNoVoo`) e assenta na grade. O fundo do isométrico (a camada estática, chão e paredes, com os itens
  de parede por cima: `RoomView.fundoDoVoo`, feito na saída de cada ponta) vai plano a plano para o ângulo de agora
  (`planoDoFundo` em `mapaTatico.ts`): o chão até s = 0,55-1 e cada trecho de parede (`map.walls.segs`) até 0,7-1, por
  cima da parede de caixa. Visto no Bar, na Fazenda ao ar livre e no Hall do Casarão.
- **Ainda vira caixa:** `table_small`, `microscope`, `computer_old` e `gun_table` (não têm arte de pixel em lugar nenhum;
  52 de 4.427 móveis nas 119 salas, contando a van e os marcadores escondidos). O fundo do isométrico não tem a luz
  da sala (a foto do começo tem): no voo a sala fica um pouco mais clara que no isométrico.

## Feito em 14/10 (branch `claude/existidos`): Existidos, rituais e o Códex sem tabuleiro

- **O Códex não desenha mais nada do tabuleiro** (decisão do Felipe, 14/10): móveis, chão, paredes, cenários, prédios,
  decalques e personagens/monstros do tabuleiro saíram do `PEDIDO-UNICO-CODEX.txt` (o tabuleiro segue o
  [`GUIA-MAPAS-PIXEL.md`](GUIA-MAPAS-PIXEL.md): pixel art 1:1 por código). O pedido antigo inteiro ficou em
  `_arquivo\prompts\PEDIDO-UNICO-CODEX-ate-14-10.txt`. Ficam com o Códex: interface, ilustrações, retratos e telas do
  celular. **A fila nova:** (1) os ícones das modificações das armas e da munição, 16 (`icones/mod-<id>.png`, teste
  primeiro: Cruel, Mira laser, Silenciador e Dum dum); (2) os joguinhos do bar no celular.
- **Rituais:** os 97 do livro têm arte (`arte/rituais/<id>.png`; chegaram Conhecimento, Energia, Morte e Medo). Nenhum
  ritual do catálogo ficou sem imagem. Aparecem na aba Rituais do celular do jogador.
- **Ícones das modificações:** o selo da arma e a janela do item já procuram `icones/mod-<id>.png`; até a arte chegar,
  fica a engrenagem.
- **Existidos:** a arte chegou (`existido.zip`): as 8 direções (poses HD por `arte:poses --hd`), o retrato e o ícone
  CRIATURAS. A arte de uma aparência do bestiário que chega na pasta `arte/personagens/<arte>/` vira personagem sozinha
  (`criaturasComArte` no `hotel.ts`); a janela CRIATURAS mostra o retrato. Criatura não tem PE nem SAN: o máximo pode
  ser 0 (antes era forçado a 1 e o monstro aparecia "Enlouquecendo").
- **Chegaram e ainda não estão no jogo:** `escrita-sangue.zip`, `mapa-hd.zip` (as ilhas do mapa-múndi) e
  `orfanato-queimado-teste.zip` (do tabuleiro: parado).

## Em andamento em 13/10 (na nuvem, branch `claude/arte-codigo`): a Alosi nova (gerador + limpeza por código) e a cozinha à noite

Tudo em `docs/PERSONAGEM-GERADOR.md` (o caminho, os prompts, os arquivos e o que falta).

- **Personagem:** desenhar só por código não chegou na qualidade (4 agentes tentaram; estudos em
  `scripts/3d/estilo/agente_personagem/`). O caminho é **o gerador de imagem desenha, o código limpa e harmoniza**
  (`scripts/3d/estilo/agente_personagem/gerador/`). A Alosi: **as 8 direções paradas aprovadas** (90 px, feitas com o
  guia de ângulo do boneco 3D) e **o andar nas 8 direções**, já **no jogo** (`tabuleiro-3d/`, vídeo
  `docs/estilo/alosi-no-jogo.mp4`), pisando no chão (pegada em degraus e o pé afundado 3 px, desde 13/10).
  **Aguardando o Felipe** mandar as imagens do gerador de sentado, abrir o armário e andar agachado
  (`alosi-acoes.zip`); depois falta o código do agachado e do abrir.
- **Personagem por código (teste de 13/10): recusado pelo Felipe ("terrível de ruim").** O corpo do 3D com a cabeça
  da arte aprovada (`projecao/hibrido.py`) não chega na qualidade. O personagem fica no gerador; o código só multiplica
  (arma na mão, machucado, dano, respirar, piscar).
- **Plano de todas as ações (13/10):** em `docs/PERSONAGEM-GERADOR.md` ("Plano de todas as ações"): cada agente só
  com a arma de assinatura, o códex aberto conta como armado, escondido = agachado encolhido. **Próximo passo:** o
  Felipe instala o Códex de linha de comando no PC e chama o Claude Code de lá; o primeiro teste é a pose mais
  difícil (atacar armado, 2 direções).
- **Móveis em tamanho real:** o `aumento` 1,2 das cadeiras/mesas deixava o boneco pequeno; o Felipe aprovou 1,0
  (`docs/estilo/alosi-moveis-12-vs-10.png`). Falta passar para o jogo.
- **A cozinha à noite** (`scripts/3d/estilo/agente_cozinha/noite.py`, `NOITE=1`): a cena multiplicada pela luz que
  chega em cada ponto (ambiente roxo-vinho, o sol do fim da tarde pela janela com as sombras, as lâmpadas em cone com a
  sombra de cima, o fogo tremendo), em degraus. Estudo; no jogo a luz teria de ser calculada na hora.
- **Por que as referências "têm borogodó":** contraste claro/escuro (chão escuro, móveis claros), luz que conta história,
  cores de destaque, muitas coisinhas, formas exageradas, chão calmo, cômodo pequeno e emoldurado.

## Feito em 12/10 (na nuvem, branch `claude/arte-codigo`): estudos do estilo pixel art só por código

O Felipe mandou salas isométricas em pixel art "cozy" (uma de madeira com lareira) e quer o tabuleiro nesse jeito, sem
o Códex. Os estudos estão em `scripts/3d/estilo/` (ver o README de lá) e as prévias em `docs/estilo/`.

- **O caminho que deu certo:** desenhar direto no pixel (ESC abaixo de 1), cada material com a cor de base e a luz de
  cada face no acabamento, contorno de 1 px, brilho na quina, sombra macia embaixo dos móveis; as peças desenhadas
  com cuidado (pixel limpo, sem pixel solto). Filtro por cima do render liso não serve (`estilo.py`, descartado).
- **A sala de madeira** (`sala4.py`, 7 x 7 casas): lareira de pedra com o capelo em rampa e o fogo animado (aceso,
  apagando, a fumaça), a chaminé que atravessa a viga e some (sai da casa), sofá, estantes, mesa em nogueira com 6
  cadeiras, porta, quadro, relógio, teclado, a janela com a cortina no vento e o sol no chão. GIF em
  `docs/estilo/4-sala-viva.gif`. Pode virar cenário padrão (uma casa na cidade).
- **Comparação com o Códex moldado:** o molde (`scripts/3d/codigo/exportar.py --codex --caixa`) acerta o ângulo, mas
  não as proporções que o gerador desenhou erradas; o estilo por código fica certo em tudo.
- **Em andamento:** o casarão da fazenda visto de fora e a cozinha da fazenda no estilo novo (com a planta do seed).
- **Falta:** levar ao jogo (exportador nos 4 giros, chão, parede, animações no tabuleiro); a mancha do sol longe da
  janela, as pregas da cortina, as últimas brasas em pontinhos, a cortina encostando na porta.

## Feito em 12/10 (na nuvem, branch `claude/arte-codigo`): a arte dos móveis feita por código

O Felipe quer o tabuleiro "perfeito e completo pelo código". A auditoria dos ângulos achou 42 móveis tortos (a arte
do gerador vem com a câmera girada ou alta), e endireitar distorce. Em vez de pedir arte nova, os móveis passam a ser
modelos em código (`scripts/3d/codigo/`, ver o README de lá): o motor desenha na câmera exata do tabuleiro, com a luz
de cada face, a sombra macia da luz de cima (no móvel e no chão, dentro da imagem), redondos lisos, brilho de louça,
vidro e metal, chanfro nas quinas e contorno; desenha 4 vezes maior e reduz.

- **Primeiro lote (a Cozinha do casarão):** armário de cozinha, fogão a lenha (aceso e apagado), pia, mesa da cozinha,
  cadeira de madeira, caixote, barril e planta. `python scripts/3d/codigo/exportar.py` escreve os giros e o
  `moveis.json` (com `exato: true` e `codigo: true`; a vista de cima do mapa tático continua a antiga).
- **No jogo (`furniArte.ts`):** `exato` faz o encaixe usar a medida `real` direto, sem medir o desenho (a sombra no
  chão entraria na conta e encolheria o móvel).
- **Conferido no jogo:** as 4 posições de giro (a mesa assenta nas casas e a sombra gira junto), mover pelo botão
  Mover (a prévia segue o mouse, o R gira, o clique solta), a caneca pousa no tampo novo (0,94 m), a pessoa atrás da
  mesa fica atrás e embaixo dela fica abaixada e escondida. A sombra no chão é forte o bastante para aparecer com a
  luz somada do jogo (`lighting.ts` soma a luz das lâmpadas por cima de tudo, o que clareia as sombras).
- **Fogão:** o estado estava trocado (o catálogo e a Sede usam 0 apagado, 1 aceso); refeito.
- **Moldar o Códex (teste, ainda fora do jogo):** a pintura do Códex vestida na caixa da medida de verdade, na câmera
  exata (`exportar.py --codex --caixa`, ver o README). Testado na Cozinha (armário, fogão, pia, mesa, cadeira): no
  jogo, tudo assenta no ângulo do tabuleiro e mantém o desenho do Códex. Esperando o Felipe escolher: Códex moldado
  ou só código. Se for o moldado, dá para passar os 42 tortos da auditoria do mesmo jeito (os redondos, a árvore e
  os de parede precisam de outro molde).
- **Falta:** os outros ~210 móveis (por cômodo); a vista de cima (mapa tático) feita pelo motor; os itens de parede;
  a lâmpada do teto; o que está em cima da mesa não acompanha quando ela sai do lugar (já era assim); a luz do jogo
  ser multiplicada em vez de somada (as sombras ficariam mais fiéis).

## Feito em 12/10 (na nuvem, branch `claude/piso-e-andar`): o piso na grade, o móvel na parede e o andar

O Felipe mandou duas salas de referência (a padaria e o banheiro isométricos, `cozy`): o ladrilho do chão é a casa do
tabuleiro, o rejunte segue as paredes, e cada móvel ocupa as casas dele encostado na parede. Aqui, a textura cobria
3,53 casas por volta (o ladrilho de 33 cm cortava as casas e passava torto pelos móveis), o armário de 0,5 m de fundo
ficava no meio da casa de 0,75 m (um palmo longe da parede) e a peça acelerava na diagonal e andava em zigue-zague.

- **Piso na grade:** `texturas.json` ganhou `origem` (o pixel onde cruzam os rejuntes) e a volta passou a um número
  inteiro de casas: ladrilho, azulejo e xadrez com **um ladrilho por casa** (8 por volta, `casas: 8`), o concreto com
  uma placa por casa, a madeira com duas tábuas por casa e a loja com uma (`casas: 4`). O rejunte cai nas quinas das
  casas e nas paredes (`pintorPiso`, `roomStatic.ts`). Taco, carpete, metal, musgo, pedra e o chão de fora ficaram
  como estavam (não têm grade). Textura nova com grade: medir quantos ladrilhos tem a volta e onde cai o rejunte.
- **Móvel encostado na parede** (`encostoNaParede`, `RoomView.ts`): o móvel com a medida de verdade menor que as
  casas dele, com as costas para a parede (nenhuma casa de chão atrás), vai até ela; no canto, vai também para a
  parede do lado. Só o desenho (a casa é a mesma); o tampo da mesa encostada vai junto (o que está em cima e a cadeira
  acompanham). Fora: cadeira, a mesa vazada, a porta e as peças da linha da parede.
- **O andar:** o relógio do servidor bate a cada meio passo (`MEIO_PASSO_MS`); o passo reto leva 2 batidas (500 ms)
  e a diagonal 3 (750 ms): a peça anda sempre a ~2 casas por segundo (antes, 2,8 na diagonal). O status manda quanto
  o passo leva (`mv.ms`) e o tabuleiro anima nesse tempo. O caminho (`findPath`) desempata pelo que vira menos (o
  estado é a casa e a direção da chegada) e continua na direção em que a peça já vinha (`dirInicial`).
  `step()` sem argumento (os testes) continua dando o passo inteiro.
- **Os feixes de luz macios (o Felipe: "muito duros, queria mais um aspecto de luz"):** o feixe da lâmpada (`feixe`,
  `furniArte.ts`) era um trapézio recortado; agora são 6 camadas do cone, cada uma mais estreita (a borda se desfaz),
  a luz pousa no chão numa mancha redonda e o ar em volta da lâmpada acende. O brilho na lâmpada (`brilhar`) cai em
  degraus suaves, sem o disco recortado. As forças ficam nos números do `feixe` (cone 0,5, mancha 0,34).
- **Mesa e cadeira em harmonia (o Felipe: "mais encaixadinho, mais bonito"):** com a mesa 1,2× maior e a cadeira na
  medida antiga, o encosto ficava abaixo do tampo e a cadeira parecia de criança, solta a meio palmo da mesa. As
  cadeiras e banquetas ganharam o mesmo `aumento` (1,2; a `height` do assento junto: cadeira 0,55 m, banqueta de
  balcão 0,9). O encaixe da cadeira (`tampo` e o ramo da cadeira em `ajusteDoMovel`) vale também para a mesa maior
  que as casas: a cadeira vai para a borda do tampo (para frente ou para trás) e o assento entra ~19 cm embaixo dele.
- **A cadeira com os pés no ângulo do tabuleiro (o Felipe: "o ângulo não tá batendo, as pernas da frente voando"):**
  o gerador desenhou a cadeira de madeira com a câmera um pouco girada; no giro 6 (a da ponta da mesa), os três pés
  que aparecem inclinavam +0,66 e −0,40 em vez de ±0,5, e a base não seguia as linhas do piso. O `moveis.py` ganhou a
  opção `"pes"`: mede os pés (`pes_do_desenho`) e endireita o desenho como o `retificar` (as verticais ficam em pé),
  até a base cair no losango 2:1. Refeita a `chair_wood` (`moveis-rituais.json`). Medidor e folha de conferência:
  os pés achados e a linha 2:1 certa por cima de cada giro (feitos na conversa; a conta está no `moveis.py`).
  Medi as outras cadeiras e banquetas: as redondas não têm esse problema; a de plástico do bar (giros 4 e 2) é um
  pouco torta, mas endireitada ela alargava e ficava apertada na mesinha, e ficou como estava. O medidor engana nas
  mesas (tampo e travessas), então elas não foram medidas assim.
- As bancadas novas do Laboratório não tinham a 3ª cor (o desenho por código, enquanto a arte carrega, quebrava).
- Testes: `server/test/andar.test.ts`.
- **Falta / para conferir com o Felipe:** o tamanho do ladrilho (um por casa ficou como nas referências; o de 37 cm
  é `casas: 4`); o cartão do agente balança enquanto anda e, na diagonal, para de balançar no fim do passo
  (`markWalking` em `shell.ts` conta 620 ms; não mexi na interface, ver a regra do Felipe); as camas e móveis no
  meio da sala continuam no meio das casas; sofás e poltronas não cresceram (só as cadeiras e banquetas, que ficam
  junto das mesas).

## Feito em 12/10 (na nuvem, branch `claude/mesas`): as mesas maiores e o vão embaixo

- **Maiores (o Felipe: "todas um pouco maiores, e a altura"):** no catálogo, `aumento` (1,2; a mesinha baixa, 1,35) faz a arte crescer por igual em volta do meio da pegada (`encaixe` em `furniArte.ts`), e a `height` já vem multiplicada (o que vai em cima fica no tampo novo). A pegada no chão não muda: a borda passa um pouco por cima das casas vizinhas. A caixa da ordem de desenho e do clique cresce junto (`RoomView.ts`).
- **O vão (`vao` no catálogo):** `'vazada'` (só pernas: mesa de trabalho, de reunião, de jantar, da cozinha, de bar, redonda, de xadrez, a mesinha, a de contenção) e `'fundo'` (gaveteiro, painel ou caixas embaixo: as escrivaninhas, a do Veríssimo, a das ferramentas, a do arsenal, a bancada de armas, a mesa de vidro). A mesa em U ficou como estava (monitores nas bordas).
  - A cadeira e a banqueta **encaixam embaixo** das duas (`canPlace`: no chão, uma por casa); o que vai para a mesa continua indo para o tampo, mesmo com a cadeira embaixo.
  - Na **vazada** se passa por baixo (`walkState` = `walk`; o caminho custa mais, `sobMesa` em `pathfinding.ts`: só passa por baixo quando é o que sobra) e se para ali, **escondido**: a peça fica no chão (`standHeight`), abaixada (0,62 da altura) e desenhada antes da mesa (`sob` na ordenação, `render/sort.ts`). Clicar na mesa vazada leva a peça comandada para baixo dela, como a cadeira. Na **com fundo**, ninguém atravessa.
- **A ordem de desenho vem das pegadas (12/10, pedido do Felipe: "arrumar o mecanismo, não a cadeira"):** a cadeira de trás aparecia por cima da mesa de jantar porque a caixa da ordem era a do desenho (a cadeira que desliza para baixo do tampo e a mesa com `aumento` se cruzavam, e o desempate errava). Agora a caixa da ordem é sempre a casa de verdade de cada móvel (`ordens` em `addFurni`, `RoomView.ts`); o desenho continua deslizando e crescendo, e o contorno (clique, quem se cruza na tela) é o do desenho. Quem está embaixo de uma mesa (`sob`) vem antes dela e de tudo que está acima do tampo. Vale ao montar e ao mudar de lugar. Teste: `server/test/ordem.test.ts` (a caixa `WBox` foi para `client/src/render/caixa.ts` para o teste não puxar o canvas).
- **Banco antigo:** o que estava em cima de uma mesa na altura antiga sobe junto (`mesasMaisAltas`, uma vez só, `db.mesasAltas`).
- Testes: `server/test/mesas.test.ts`.
- **Falta / para conferir com o Felipe:** se 1,2 ficou bom (é um número só por mesa no `furni.ts`); as cadeiras não cresceram (a mesa a 0,96 m perto do assento de 0,46 m); a cadeira encaixada embaixo da escrivaninha não deixa sentar (a mesa com fundo bloqueia a casa); a vista tática desenha a peça embaixo da mesa por cima dela (sem esconder).

## Feito em 12/10 (na nuvem, branch `claude/artes-no-lugar`): a arte nova nas salas

O que tinha chegado do Códex em 09/10 e ainda não estava em sala nenhuma (o Felipe confirmou que não tinha mexido à mão nessas salas):

- **Laboratório (Sede):** as bancadas inteiras (a de canto no fundo, a de parede na esquerda, as duas ilhas no meio), a mesa de vidro com os tubos na parede da direita, a impressora 3D ao lado do quadro branco e o leitor de digital na parede perto da porta.
- **Arsenal:** a mesa grande no meio, no lugar da bancada em U de bancadas pequenas (que saíam tortas), com quatro banquetas.
- **Salão:** as poltronas pretas no canto de conversa e duas TVs grandes na parede do fundo (uma no lugar da tela de projeção).
- **Casarão da Fazenda:** os 12 quadros, cada um o seu: pôr do sol (Hall), natureza-morta (Cozinha), retrato da família (Sala de Jantar), gravura do casarão e mapa da fazenda (Escritório), cavalo e rio na neblina (Corredor de Cima), bordado de flores (Quarto Principal), galo (Quarto 1), pôr do sol comprido (Quarto 2), bordado da cruz (Quarto 3) e desenho de criança (Quarto das Crianças).
- **Modelo escolhido:** a montagem agora escolhe o desenho entre os modelos de um móvel (`"quadro_fazenda~05"` no seed vira `defId` + `modelo: "05"`, no `FloorItem` e no `WallItem`; `chaveDaArte` usa o modelo antes do sorteio pelo id). Sem isso, os 12 quadros saíam repetidos.
- `SEDE_REV` 51 (refaz só Laboratório, Arsenal e Salão) e `FAZENDA_REV` 21 (refaz a fazenda inteira).
- **Ficaram de fora:** os 3 tanques com corpo (o calabouço não tem mais tanque, decisão de 08/10; se quiser em outro lugar, é só dizer) e as variações `~b`/`~c`/`~d` de beliche, camas e cadeira gamer (entram sozinhas no sorteio).

## Feito em 12/10: o minimapa entrou na branch, no visual do HUD

A branch `claude/nuvem-continuacao` (PR #4) foi juntada na `claude/ferramentas-mesa`. **Conflitos e como ficaram:**

| Arquivo | Conflito | Decisão |
|---|---|---|
| `shared/src/index.ts`, `shared/src/protocol.ts`, `server/src/db.ts` | viagem, lugares e bestiário (daqui) × `locais`, `grupoPara`, `visitada`, `visitadas` (do minimapa) | os dois lados |
| `server/src/hotel.ts` | a lista de cenas (`estilo`, `viagem`) × `simbolos`; as mensagens novas dos dois lados | os dois lados, juntos na mesma linha |
| `client/src/ui/shell.ts` | a planta daqui (`drawPlan`, a planta grande da tecla M, o AMPLIAR do tabuleiro) × o minimapa | o **minimapa** no lugar da planta; ficam o AMPLIAR e a **planta grande (M)**, que agora é o mesmo minimapa em tamanho de ler (`new Minimapa(host, { grande: true })`) |

**O visual:** o funcionamento é o do PR (níveis, cartão, Entrar, Levar o grupo, grupo dividido, arrastar a peça, visitado, lista de lugares); o desenho voltou para o HUD daqui (azul-noite, borda bege, ouro). O cômodo do grupo é de **ouro** (não vermelho), cada cômodo na cor do piso (`COR_PISO`, que saiu do `shell.ts`), parede bege grossa por fora e fina por dentro, nomes em plaquinha arredondada, peças como pontos de luz (na grande, com a inicial), o escolhido em azul. O terreno continua em pixel art, mas na paleta da noite. O `minimapa.css` usa os tokens `--r-*` e `--h-*`; a moldura azul e os botões de borda-imagem saíram. A Viagem (a van) não entra no minimapa.

**Usabilidade (o Felipe, 12/10: "ficando pequenininho quando clica"):**
- o mapa **não encolhe mais** quando o cartão abre (antes ele se espremia acima do cartão); o cartão fica por cima, numa faixa, com X para fechar, e o mapa sobe se o cômodo escolhido ficaria atrás dele;
- a letra acompanha o tamanho do painel; no mapa pequeno, os enfeites (régua, rosa, nomes do chão) somem;
- cômodo pequeno tenta o nome curto e a letra um pouco menor antes de ficar sem nome;
- o título mostra o caminho com o último nível em ouro e o de cima encurtado.

Conferido clicando (crona_visual): Entrar, Levar o grupo, grupo dividido (Levar 2), subir ao terreno, entrar no Celeiro, a escada para o Calabouço, a lista de lugares, Tudo visitado, arrastar a peça e a planta grande (M, Esc). `npm run typecheck`, `npm test` (302) e `npm run build` sem erros.

**Falta:** o cômodo muito estreito (o Corredor Escuro) fica com a plaquinha maior que ele; o layout de alguns andares (o Térreo do Casarão) tem os cômodos soltos, longe um do outro (é o `layout` da campanha: o mestre arruma com Alt + arrastar).

## Feito em 06/10: as ferramentas da mesa

Tudo em [`FERRAMENTAS-DA-MESA.md`](FERRAMENTAS-DA-MESA.md). No canto de cima do tabuleiro do MAPA (e Apontar e Desenhar no COMBATE), só o mestre:
- **Apontar (P, ou Alt + clique):** a mesa pisca no lugar (anéis dourados, feixe de luz).
- **Desenhar (D):** giz à mão livre, seta ou círculo, em três cores; some em 9 s.
- **Névoa (N), guardada:** pronta no código, fora da tela a pedido do Felipe (salas pequenas: não faz sentido por enquanto; `NEVOA_NA_TELA`). Cobrir a sala; o pincel mostra e esconde; abre sozinha em volta dos agentes que andam (decisão do Felipe: pincel e automática). Na mesa, o escondido some debaixo de uma fumaça; o mestre vê riscado.
- **Mapa:** a imagem vira uma cena vista de cima (decisão do Felipe: na vista tática), do tamanho em quadrados de 1,5 m, ligada à cena de agora por uma Entrada, levando os agentes.
- Testes em `server/test/mesa.test.ts` (9). Visto no navegador, na prévia, com a mesa aberta ao lado.
- **Falta:** a arte (`PROMPT-FERRAMENTAS-MESA.txt`: os 4 ícones e a textura da névoa); apagar o mapa improvisado pela tela; ver no tablet de verdade. Na prévia (`crona_visual`) ficou a cena de teste "Sede · armazem do porto".

## Feito em 06/10: o link de qualquer lugar

`npm run crona:link` (`scripts/link.mjs`): túnel da Cloudflare até a porta da rede do jogo, como o do C.R.I.S. Testado: a página abre pelo link e quem entra por lá é jogador (o mestre entra pela conta). O link muda a cada vez que o túnel sobe (fixo é pago). **Falta:** o Felipe decidir se sobe a cada login (`node scripts/link.mjs instalar`).

## Feito em 06/10: requisição, Interlúdio e criação

- **Requisição (item 4):** a perícia do utensílio e da vestimenta e o elemento dos itens "de (Elemento)" escolhidos ao pedir; modificações e maldições pela conta do motor (onde vão, requisitos, as que não combinam, elementos que se oprimem, agente especial, a categoria nova contra a patente), na FICHAS e no "Modificar" da aba ITENS, com o mestre passando por cima; munição empilhada em pacotes; o servidor recusa a ficha do jogador que passa da patente.
- **Aba INTERLÚDIO (LR p. 92–93, conferido no livro):** o lugar do descanso e até duas ações por agente; Concluir aplica nas fichas e nas peças; os +1d6 de exercício e leitura ficam guardados (`FichaSalva.bonus`), com gastar e "Fim da missão".
- **Criação passo a passo:** `client/src/ui/criacao.ts`, aberta pelo + Novo Agente e pelo Editar (decisão do Felipe: o mesmo caminho).
- Testes em `server/test/requisicao.test.ts` (8).
- **Feito em 06/10 (era o próximo):** o MAPA reorganizado pela `docs/ref-mapa-3.webp` (bloco "DISPOSIÇÃO DE 06/10" no fim do `mapa.css`; a plaquinha e a faixa de estado em `renderEstado`, `shell.ts`). O COMBATE já seguia a `ref-combate-2` (as seis caixas, os estados na iniciativa, os chips de ação). Os menus e as janelas antigas viraram janelas de papel no meio, com a tela desfocada (`note.ts`, `Win` em `dom.ts`). O plano original, para referência: reorganizar MAPA e COMBATE pelas referências novas (`docs/ref-mapa-3.webp`, `docs/ref-combate-2.webp`, fora do git): ferramentas do tabuleiro numa fileira no canto de cima à direita, plaquinha do cômodo, faixa de estado embaixo do tabuleiro (Iluminação, Névoa, Terreno), "Agentes no local", inventário rápido 3 × 2, ações em lista, cena e objeto à esquerda com foto; no COMBATE, os estados na iniciativa, os chips de ação e o alvo com as resistências. Os nomes das peças continuam só com o mouse (decisão do Felipe).

## Feito em 06/10: o jogo leve, de qualquer lugar

- O jogo saiu do Docker: roda direto no Windows (`scripts/jogo.mjs`, sobe a cada login e volta se cair), e só o banco fica no Docker. Atualizar é `npm run crona` (segundos, sem montar imagem). O container `crona-app` ficou parado (sem reiniciar sozinho); `npm run crona:docker` o monta de novo, se precisar.
- A arte em WebP (338 MB → 55 MB) na própria pasta da arte; o túnel (`scripts/link.mjs`) também sobe a cada login.
- O Docker com teto de 3 GB e devolvendo a memória (`%USERPROFILE%\.wslconfig`): vale depois de reiniciar o PC ou o Docker.
- Testado: pelo link e pela rede entra como jogador; neste PC, como mestre; de fora, o mestre entra pela conta "Felipe".

## Fila do Felipe (07/10, tarde): o que ainda falta da lista grande

Feito em 07/10 (commits 2130f57, 360264c e 03da242):
- **Painel PLAYERS:** o + e o − valem para o agente de outra cena.
- **Enfermaria:** a cortina do leito tem o lado de dentro todo de chão (dá para andar em volta do
  leito); o soro ficou do outro lado da cama (SEDE_REV 47).
- **Peças vazadas:** o clique dentro anda até a casa; o braço da mesa em U fica na frente da cadeira.
- **Item no chão:** deitado no piso, com a sombra colada nele.
- **Mapa improvisado:** dá para apagar ("Apagar este mapa", no cartão da sala).
- **Retratos:** centrados no rosto.
- **Cartas e seletor da ITENS:** a cor e o sigilo do elemento de cada agente.
- **Casas de item:** uma moldura só.
- **Ícones:** os contadores da mochila pintados; o lápis e o Apontar pintados.
- **ITEM SELECIONADO:** os nomes inteiros nos botões.
- **Combate:** passo a passo.
- **Interlúdio:** redesenhado.

Os pedidos de arte novos (na pasta BASE):
- `PROMPT-TECNOLOGIA-CHEIA-E-ENFERMARIA.txt`: o posto da enfermaria inteiro em L; a sala de
  tecnologia cheia (cadeira gamer roxa, telão do C.R.I.S, TV com DERROTA, torre de tubos, bancada de
  eletrônica, mesa holográfica, frigobar e as peças antigas que não chegaram).
- `PROMPT-ICONES-E-LOGO.txt`: as situações do ataque, agachar e cobertura, mão livre, chave, os
  modos do objeto, o Interlúdio e a logo do CRONA.
- Os gabaritos estão em `gabaritos/pedidos/lote-07-10/`.

Feito depois (commit 9f756c0):
- **Planta:** a cor do piso em cada cômodo, os nomes em plaquinhas e a planta grande (lupa ou M).
- **Tabuleiro mais alto:** a fileira de baixo mais baixa, e o AMPLIAR esconde a fileira.
- **Painel do objeto em três momentos:** Jogar, Configurar e Mexer.

Feito ainda em 07/10 (commits 6cee4a4 e 926c976):
- **Alvo do combate** folgado; a **foto do agente no celular** grande, no elemento dele e viva
  (respira e pisca no ritmo da ficha).
- **Cobertura pela altura (DC-24, aprovada pelo Felipe):** corpo de 1,8 m em pé e 1,0 m agachado; o
  botão Agachado no combate e no painel do personagem. As animações de agachar, abaixado, furtivo e
  cobertura entraram no pacote do Códex dos personagens (etapa 9).
- **Bug do Descartar:** corrigido (o item cai na cena da peça, na campanha de quem pediu).

Feito ainda em 07/10 (tarde):
- **A Viagem** (`docs/VIAGEM.md`): o botão VIAGEM leva os agentes para a van preta (o mestre escolhe o banco de cada um, o
  cenário, a hora e a velocidade); a van fica parada e o mundo passa; fica até o mestre escolher onde chegar. Tudo em código; a
  arte do Códex é o `PROMPT-VIAGEM.txt` (Lote 3B). **Falta:** a arte entrar, o botão Ilustração, a chuva, o mapa tático da van.
- **Fazenda:** os 7 pisos do Códex no jogo (isométrico e tático).
- A pasta da arte reorganizada (`00-COMECE-AQUI.txt`), com os pedidos novos (rituais, prisão inteira, viagem).

Ainda falta (pedido do Felipe):
- **Quando a arte chegar:**
  - montar a sala de tecnologia cheia e o posto da enfermaria (tirar as duas bancadas e a mesa do
    PC);
  - trocar os ícones;
  - escolher a logo.

## Noite de 07/10: a viagem, o mapa-múndi, os lugares e o combate novo (o Felipe foi dormir; "amanhã corrigimos")

- **Lugares e mapa-múndi** (`shared/src/lugares.ts`, `ui/mapaMundi.ts`, `render/mapaBrasil.ts`, `render/lugarSprites.ts`): cada conjunto
  de salas é um LUGAR (a Sede inteira entra pelo Bar; a Fazenda pela vista de fora). O botão do globo no topo abre o Brasil em pixel
  art com uma ilha por lugar; o mestre arrasta as ilhas (`lugarMover`, guardado em `CampaignData.lugar`). Para o Felipe, a campanha é
  uma só e os lugares moram dentro dela: quando as contas e as campanhas existirem, isso muda de lugar (ele avisou).
- **Viagem = tela de carregamento** (`ui/telaDeViagem.ts`, `render/dioramaViagem.ts`): VIAGEM → marca quem vai (a van de cima mostra
  cada um sentado) → Partir abre o mapa ("Para onde vamos?") → o lugar clicado é o destino. No lugar do tabuleiro (mestre e mesa), o
  dioraminha: a ilha flutuando com a estrada, a van aberta com os bonecos sentados, árvores, postes e carros passando; 5 momentos do
  dia (amanhecer, dia, entardecer, noite, madrugada) e 5 climas (limpo, nublado, chuva, tempestade, neblina) em pixel. O painel do
  mestre: hora, clima, estrada e Chegamos (desce na entrada do lugar). Partida e chegada: a pintura para todos com o som do carro
  (chave, arranque, motor). **Regra da casa:** todo lugar novo ganha a ilha do mapa e duas artes de chegada (`artesDeChegada`).
- **Combate** (só CSS, no fim do `hud.css`): o mapa 84 × 84 rem à esquerda; no meio o Alvo rápido e a Resolução numa coluna (abas em
  ladrilhos com ícone, como no celular); à direita a Ordem de iniciativa, os Efeitos e o Registro pequeno. Conferido no preview:
  montagem, ataque (arma, rolagem), manobra, ritual e "outras". Falta o Felipe usar e dizer o que apertar.
- **Arte:** tudo o que falta para o Códex está no `PEDIDO-UNICO-CODEX.txt` (os textos antigos foram para `_arquivo/prompts/`). A van
  pixel art que chegou veio fechada: a correção está no `CORRECAO-VAN.txt` (aberta, 6 bancos vazios). Os zips da fazenda (texturas,
  prédios, natureza, casa, calabouço, escada, camas de cima), as peças inteiras e as bancadas estão na raiz da pasta da arte,
  ESPERANDO ENTRAR NO JOGO (próximo trabalho do Claude).
- **Pendente da viagem:** a arte do Códex (van aberta com as rodas à parte, carros, beira da estrada, as ilhas e as artes de chegada)
  entra no lugar do desenho em código; os ícones da barra (velocidade saiu do painel; a van anda sempre na mesma).

## Fazenda: o casarão do desenho, beliches e móveis vazios (07/10, noite)

- **Portas na parede do desenho:** `plan.r` em `seedFazenda.ts` agora ESPELHA a sala (r 1 e 3 giram um quarto): a porta
  cai na parede oposta, como no desenho, mas o que estava no fundo (a parede de cima) continua no fundo, sem móvel alto na
  frente. Hall, Cozinha e Sala de Jantar foram refeitos no quadro do desenho (cozinha a oeste do hall, jantar a leste,
  corredor de cima: Q1 e Q2 a oeste, Q3 e principal a leste). FAZENDA_REV 16. A escala (2 a 3 casas por quadradinho da
  régua da cama) o Felipe não respondeu: ficou o meio-termo (a sala pelo móvel + 1 casa de folga).
- **Escrivaninha** (`desk_wood`, 2 × 1, com abajur) no lugar da mesinha de 1 casa nos Quartos 1 e 3.
- **Beliche** (`beliche`, 1 × 3, 1,85 m; só desenho por código até a arte): os 3 do Quarto das Crianças. A cama de cima é um
  degrau mais alta e os postes passam só um pouco dela. **Escalada:** o painel do personagem ganhou "Na cama de cima" (só
  aparece em cima de um beliche); a peça sobe de 0,55 m para 1,52 m (`leitos` no `furni.ts`, `standHeight(x, y, alto)`,
  `tokenEdit.alto`) e sai sozinha da cama de cima ao andar. **Falta:** a animação `escalada` (pedida no pacote do Códex dos
  personagens: etapa 10, `LEIA-PRIMEIRO.md` 9.9) e o jogo tocá-la (hoje é o andar parado), e o personagem DEITADO na cama de baixo
  (hoje senta; o pedido de arte já exige o colchão livre).
- **Brinquedos do Quarto das Crianças:** 6 pilhas "Itens no Chão" (Ursinho, Boneca de Pano, Blocos de Montar, Cavalinho de
  Balanço, Carrinho, Casinha de Brinquedo) que os jogadores pegam (`chao` no `CenaSpec`). Sem ícone próprio: cai no ícone do
  tipo até o Códex entregar (`arte/itens/pintados/<slug do nome>.png`, Parte D do `PROMPT-MOVEIS-VAZIOS.txt`, com variações).
- **Móvel vazio (só para lugares abandonados):** o item tem o campo `vazio` e a arte procura `<defId>!vazio` (`chaveDaArte`,
  isométrico, parede e vista de cima), mas NADA liga isso sozinho (decisão do Felipe, 07/10: não trocar quando levam os itens).
  Falta o botão do mestre "Abandonado/Vazio" no painel do objeto e a arte (Parte A do `PROMPT-MOVEIS-VAZIOS.txt`, baixa prioridade).
- **Pedidos novos de arte (Lote 3C, `PROMPT-MOVEIS-VAZIOS.txt`):** o beliche + cores das camas, as gêmeas vazias, 12 quadros
  genéricos de fazenda (viram `painting~d`... pelo sorteio) e os ícones dos brinquedos.

## Manhã de 08/10 (o Felipe acordou e foi testando)

- **Viagem:** o "Partir para cá" não clicava (a camada dos pinos tampava), o painel da viagem não clicava (herdava
  pointer-events: none) e a chegada empilhava todo mundo numa casa. Corrigido e no ar.
- **Lupinhas de pista** desligadas (`MOSTRAR_LUPAS` em RoomView); a pista continua no painel do objeto.
- **Item de parede atrás de móvel:** `server/src/paredes.ts` conserta em toda sala (sobe ou escorrega) e o
  `paredes.test.ts` reprova sala montada com o defeito. Regra para sempre: nada de quadro/TV atrás de móvel encostado.
- **Calabouço (história do Felipe):** ritual de troca de mente à força; ninguém ficava lá (sem leitos). Central de
  monitoramento na parede, computadores, máquinas e monitores (um tomado pela Energia) em volta do altar, gravador,
  câmera, a mesa do chefe. A Sala de Sangue guarda os corpos que viraram **Existidos** (primeiro combate oficial;
  a ameaça está no catálogo, p. 238). Falta: a arte (lote 4) e, quem sabe, um "acordar" dos corpos.
- **Operação Pede Mesa:** item em cima de mesa escorrega para o tampo desenhado; cadeira virada para mesa entra
  embaixo dela (`ajusteDoMovel`). Falta: pedir ao Códex mesas com pé aberto e tampo do tamanho das casas.
- **Fazenda abandonada:** plantação meio morta, árvores e arbustos sorteando vivos e meio mortos.
- **Entrada larga** (um capacho só por prédio).
- **Códex, lote 4** (`PEDIDO-UNICO-CODEX.txt`, SEÇÃO 0, gabaritos em `gabaritos/pedidos/lote-4/`, conferência
  `gabaritos/conferir_camera.py`): refazer celeiro, casa de mantimentos e casarão (tortos; versões de porta aberta),
  porta de enrolar do bar, passagem de caverna, o altar (estrado + pedra do sacrifício), monitores (normal e
  Energia), eletroencefalógrafo, gravador, câmera, corpos. Existido no pacote dos personagens (seção 14).
- **Falta fazer (código):** portas de várias casas (a de enrolar tem 3, a caverna 2) e passagem sem folha; o altar
  pisável quando a arte chegar; "Nesta cena" sem rolagem (não reproduzi: esperando o Felipe dizer onde).
- **Item no chão menor:** 44 px (um) e 34 (vários); eram 72 e 58, do tamanho de gente.
- **Os jogos do bar (ideia do Felipe): fliperama, dardos e sinuca.** O mestre escolhe o agente, escolhe o móvel
  (o fliperama, o alvo na parede, a sinuca) e usa: a peça anda até lá e vira para o jogo, e o jogo abre no celular de
  quem joga com ela (a ficha se desfaz em pixels). Usar de novo com a mesma peça chama de volta.
  - **Mesas** (`server/src/hotel.ts`, "os jogos do bar"): cada móvel é uma mesa com lugares (fliperama 2, sinuca 2,
    dardos 4). O servidor só repassa as jogadas (`barJogo`) e guarda as que pedem (`registrar`), para quem reconecta
    refazer a partida. Entrou ou saiu alguém: a partida recomeça. Peça sem ficha = **NPC**: o mestre joga por ele numa
    janelinha do tamanho de um celular no canto da tela dele (`BarJogos` em modo 'mestre').
  - **As contas iguais em todo celular** (`shared/src/bar/`): o sorteio com semente, o alvo e o 301, a física e a regra
    da sinuca (bola 8 simplificada). Só soma, divisão e raiz: a tacada dá a mesma mesa em todo aparelho (conferido na
    prévia com dois celulares).
  - **Fliperama** (`fliperama.ts`, `fliperamaJogos.ts`): sozinho como antes, ou em **dupla** (o A chama, o outro
    aceita): PONG um contra o outro (quem convidou faz as contas, o outro manda a raquete; cada um se vê à direita),
    ATRAVESSA lado a lado como no Freeway, PULA-PULA na corrida (as mesmas plataformas).
  - **Dardos** (`dardos.ts`): o dedo mira (a mira treme; menos com Agilidade alta, mais se demorar), soltar arremessa.
    301, três por vez, estoura e zera.
  - **Sinuca** (`sinuca.ts`): o dedo mira o taco (linha até a primeira bola e para onde ela vai), segurar Tacada carrega
    a força. Os outros veem o taco de quem mira.
  - **O fliperama ganhou vida (o Felipe pediu "bastante animação"):** a tela passa por um tubo antigo (`compor` em
    `fliperama.ts`: o jogo em 160 × 192 ampliado 4x, o rastro do fósforo, o brilho, o tremor quando o jogo pede e uma
    falha rara que arrasta faixas), mais o CSS (as linhas, a faixa clara descendo, a cintilação, o granulado em
    overlay, o reflexo do vidro, a TV desligando em linha e ponto). Liga com o boot (o teste do sistema e a ficha caindo
    no cofre), o menu tem estrelas, o título ondulando com brilho, a prévia de cada jogo e o letreiro correndo; a
    persiana entre as telas; as lâmpadas do letreiro piscando em fila. Nos jogos, `fx` (faíscas, confete, "+1",
    tremor e clarão). Música por chiptune (`chiptune.ts`: pulso, quadrada, triângulo e bateria de ruído; o menu, um
    tema por jogo, a fanfarra do recorde e as vinhetas de vitória e derrota), com o botão ♪ no letreiro.
  - **Dardos e sinuca com vida de bar** (`barFx.ts`: faíscas, confete, o número subindo, tremor, clarão e a faixa
    "SUA VEZ" / "ESTOUROU!" / "VENCEU!"): nos dardos, a luminária, o dardo em arco com rastro, o alvo balançando, o pó
    do sisal; na sinuca, o lustre balançando, o taco avançando com o pó de giz, o estalo pela força da batida e o baque
    na tabela (a física agora conta as `batidas` e as `quedas`, sem mudar o resultado), a bola sumindo na caçapa e a
    bandeja das encaçapadas. Música de jukebox (a bossinha "bar" do chiptune), com o ♪ no topo.
  - Testes: `server/test/bar.test.ts`. Arte pedida ao Códex: SEÇÃO 0C (o alvo, os dardos, a parede, a mesa, as bolas, o
    taco; gabaritos em `gabaritos/pedidos/bar-jogos/`). Ideias: recordes da mesa inteira, o mestre ver quem está jogando.
- **A arte do gabinete do fliperama** foi para o Códex (SEÇÃO 0B do pedido, gabarito em
  `gabaritos/pedidos/fliperama/`): 13 PNGs, a mesma máquina da folha do tabuleiro, de frente. **O encaixe já está
  pronto (08/10, noite):** as peças vão em `client/public/arte/bar/` e entram sozinhas, uma por uma (`arteBar.ts`;
  o CSS no fim de `fliperama.css`): a alavanca vira o direcional (as setas viram zonas de toque invisíveis e a imagem
  segue a direção apertada), o botão grande vira o A. Dardos e sinuca também (o alvo, os dardos, a parede, a mesa,
  as bolas e o taco): só copiar os PNGs com os nomes do pedido. Conferir na prévia quando chegar.
- **O fliperama do mapa refeito (F0, mesma seção):** o Felipe achou magrelo (0,62 m e ainda encolhido pelo `encaixe`).
  O novo enche a casa: 0,74 × 0,74 × 1,85 m (`scripts/3d/pedidos/fliperama.json`). Ao importar: trocar o `real` e o
  ponto da tela (`tela.giros`) na ficha de `moveis-bar.json`. Regra 12 nova no pedido: a referência de posição e
  ângulo (`gabaritos/referencias/referencia-isometrico-moveis.webp`), para nada sair espichado ou magrelo.

## Tarde de 08/10: a fila do Códex

- **Ícones do combate no jogo:** as 18 situações do ataque (`arte/icones/sit-*.png`, entram sozinhas pelo `icSit`), a
  cobertura total na linha e na chave de cobertura, e o botão de postura com o "agachar" (em pé) e o "protegido"
  (agachado).
- **COMBATE refeito ("não tá muito boa"):** (1) o combate perdia o agente quando a peça era recriada (a viagem entre
  campanhas troca o id): sem retrato, sem PV, "sem ataques". Agora o servidor religa pelo nome (`religarCombate`, com a
  ficha da ameaça junto; teste `combate-religar.test.ts`). (2) O arranjo novo (fim do `hud.css`): a ORDEM DE INICIATIVA
  numa faixa de cartas em cima, a RESOLUÇÃO mais larga e alta, e a coluna com ALVO, EFEITOS e REGISTRO (o registro estava
  com 16 px de altura); as situações uma por linha, com o texto inteiro e o ícone pintado maior; o alvo vazio sem a
  coluna espremida.
- **COMBATE, segunda volta ("tudo torto apertadin"; o Felipe pediu o ataque rápido):** o ataque virou um cartão só
  (`montarRapido` em `combateAtaque.ts`): com o quê (etiquetas, a arma da mão já escolhida), em quem (clicar no mapa; a
  Defesa e o alcance), o que vale (só as situações que o mapa achou, em etiquetas que se tiram com um toque; as de marcar
  à mão atrás do "+ situação"), o d20 (e o d10 da camuflagem), a soma do dano com o que acontece com o alvo, e Desfazer
  / Confirmar sempre à vista. Os dados continuam físicos: a tela só faz a conta. Manobra e ritual seguem no passo a
  passo. O arranjo (`combateRapido.css`): o mapa com a GAVETA embaixo (abas Alvo, Efeitos e pendências com o número,
  Registro), a faixa da iniciativa e a resolução na altura toda à direita.
- **MAPA:** as cartas dos agentes sem o sigilo do elemento e sem os botões de girar (o girar fica no painel do
  personagem, à esquerda); PV, PE e SAN com − e + alinhados (tudo com a mesma altura, os sinais no meio).
- **Ícones do celular, do interlúdio e da mochila/objeto no jogo** (o interlúdio ganhou os da condição do descanso e
  dos bônus). `obj-documento` e `obj-tranca` estão na pasta, sem botão onde entrar ainda.
- **A logo continua a de hoje** (o Felipe gosta dela): as duas propostas do Códex (`logo-crona-propostas.zip`) ficam
  de fora.
- **Esperando o Felipe conferir em casa:** o teste dos rituais, os ícones da mesa (Apontar, Desenhar, Mapa) e a viagem em
  pixel. **Chegou e falta entrar:** a tecnologia cheia (com a
  vista de cima) e o posto da enfermaria; a vista de cima da fazenda; o refazer do celeiro, da casa de mantimentos e do
  casarão (com as portas abertas); os quadros, os beliches e a cama D; o altar e a sala dos corpos do calabouço.
- **Som no celular:** o navegador só libera o som quando o dedo solta (`audioCelular.ts`); no iPhone, o modo reprodução
  (o silencioso não cala mais).

## 09/10 (tarde): o Orfanato Filhos do Dragão (no ar)

- `server/src/seedOrfanato.ts`, no molde da Fazenda (usa `Terreno`, `montar`, `estilo`, `naPlanta`, `CenaSpec`
  exportados de `seedFazenda.ts`); `ORFANATO_REV` refaz no lugar; `db.orfanatoRev`. Montado no `upgradeDb` e protegido
  da limpeza das salas de exemplo. Teste: `server/test/orfanato.test.ts`.
- Oito cenas, a partir da planta que o Felipe mandou (pequenas e cheias, o pedido dele): Pátio (ao ar livre: fachada de
  `iwall` com janelas e a porta, a estradinha de terra, árvores, o anexo como bloco de parede), Salão, Refeitório, Sala de
  Estudos, Quarto da Diretora, Banheiros, Ala dos Dormitórios (12 quartinhos com divisória baixa `iwall_low`; as de 2,4 m
  viravam labirinto) e o Anexo.
- **O orfanato queimou e virou o Ninho dos transtornados (09/10, noite; `ORFANATO_REV` 12).** "Ninho" é como eles chamam
  a base (não é ninho de bicho). Pelo livro (LR p. 303): culto desorganizado, invade lugar abandonado para MORAR e faz
  dele casa de tortura; canibalismo, tortura e mutilação no dia a dia. Então: tudo escuro, fumaça e cinza no ar, sem luz
  elétrica (velas, tochas, a fogueira); escombros do teto, vigas caídas, fuligem no chão e nas paredes; sangue por todo
  lado; o salão é a sala comum (fogueira no chão, colchões em volta, crânios de troféu); o refeitório é o açougue
  (ganchos de carne, corpo na mesa); a sala de estudos é a sala de tortura (mesa de contenção, ferramentas, correntes);
  os dormitórios têm camas queimadas, colchões no chão e um quartinho-jaula com grade; o anexo é o abatedouro.
  - **Refeito pela planta do Felipe (09/10, noite; `ORFANATO_REV` 14):** cada cômodo é uma cena (regra geral, como na
    Sede) e a planta do andar segue o desenho: Refeitório em cima; Salão (a área aberta, balcão em L, fogueira, as
    FRASES na parede comprida) e Cozinha; Depósito e Quarto da Diretora; Sanitários e Banheiro; Sala de Banho; a Ala
    (corredor de 6 casas) com os 12 quartos ("Orfanato · Quarto 1" a 12, o 10 é a jaula). O Pátio tem o prédio comprido
    (paredes de fora, o miolo queimado), o anexo no canto de cima à direita, a estradinha pela direita e a porta no fim
    da ala. A "sala de estudos" (inventada) e os "Banheiros" de antes são apagados no rebuild.
  - **Revisto em 10/10 (o Felipe):** o Salão é o **refeitório grande das crianças** (14 × 16, duas fileiras de mesas
    compridas com bancos, o balcão da comida no canto, a fogueira e os colchões do bando no fundo; na planta, vaza
    para a esquerda do prédio). Cada **quarto** é de duas crianças: duas camas de ferro, o criado-mudo e o armário. A
    sala de cima é a **Enfermaria** (caminhas de lona, `catre`, onde as crianças se recuperavam dos rituais), e o
    anexo é a **Sala de Cirurgia** dos rituais (o círculo no chão, a mesa de contenção, macas tombadas, aparelhos
    quebrados). Sem saco de cadáver. O pátio tem o prédio inteiro desenhado em código (`orfanato_predio`).
  - **A escrita**: pedida ao Códex (0G, urgente: `arte/paredes/escrita-sangue-orfanato.png`, de frente, transparente);
    o gancho já existe em `furniWall.ts` (com a imagem, sai a letra de código).
  - **As frases** (`FRASES`) estão escritas com sangue na parede comprida do Salão, a área aberta onde o corredor dos
    quartos termina: `escrita_sangue` (340 × 136, desenhada em código; o texto inteiro vai na pista Examinar).
  - **Peças novas em código:** `fogueira` (acende/apaga, luz de fogo), `colchao_chao`, `gancho_carne`, `cama_queimada`,
    `escombros` (monte com telhas e tábuas), `viga_queimada`, `fuligem`, `cinzas`, `fuligem_parede` (mancha: pode
    ficar atrás de móvel, `eManchaNaParede` em `paredes.ts`).
  - **Pedido ao Códex (09/10, noite):** seção 0E do `PEDIDO-UNICO-CODEX.txt` (piso e parede queimados, fogueira,
    colchão, escombros, viga, ganchos, cama queimada e os móveis da casa queimados; gabaritos de
    `scripts/3d/pedidos/orfanato-queimado.json`) e a 0D agora pede a fachada queimada. Quando chegar: fichas com
    `def` novos (`*_queimado`) ou trocar os ids no `seedOrfanato.ts`, e o estilo de piso/parede "queimado".
  - O alvo de dardos de parede voltou ao desenho em código (a arte do Códex saiu de perfil); o pedido diz para não refazer.
- Falta: o andar de cima (se a história pedir), a arte de fora do casarão (hoje a fachada é parede interna) e os
  detalhes de história (o Felipe ajeita depois; ele disse para não se preocupar com a aventura).
- **Ainda não posicionado nas salas da Sede** (a arte e as defs estão no catálogo): a tecnologia cheia (torre de CRTs,
  mesa holográfica, telas do C.R.I.S e de DERROTA...) e o posto de enfermagem. Fazer subindo `SEDE_REV`.

## 09/10: a arte do Códex entrando (no ar)

- **Ícones:** abas do painel (`painel-*`) e ferramentas da mesa com a Viagem (`mesa-*`).
- **Apontar:** o cristal ficou em código, lapidado e girando (o Felipe gostou e NÃO quer arte do Códex nele).
- **Fliperama:** o gabinete pintado no celular (`arte/bar/`, entra pelo `arteBar.ts`); a alavanca virou um joystick
  visto de cima (a bola vermelha, recortada da arte, segue o dedão; diagonal vale), setas de ouro acendem, A e
  Menu/Sair maiores. O do mapa refeito encorpado (0,74 × 0,74 × 1,85 m, `moveis-bar.json`).
- **Itens no chão:** contorno fino no ouro do Apontar (`itemNoChao.ts`).
- **Viagem:** as 8 artes de chegada; o dioraminha com a arte em pixel (`arte/viagem/pixel/`: a van com rodas e os
  agentes nos bancos, carros da outra mão, árvores de dia/noite, postes, cercas, arbustos, placa, pedras, flores); a
  van de cima na janela de quem vai; as ilhas de cada lugar no mapa-múndi (`arte/mapa/lugar-<lugar>.png`, por nome).
- **Rituais:** 25 artes (`arte/rituais/`), no celular.
- **Móveis importados (09/10, tarde; arte no jogo e defs novas no catálogo, NADA posicionado nas salas):**
  - beliches (4 modelos), camas novas e as vistas de cima (`moveis-camas.json`);
  - calabouço: `estrado_altar`, `pedra_sacrificio`, `tanque_corpo` (3), `mesa_contencao`, `pilha_cranios`,
    `estandarte_sangue`, `tocha_parede`; a arte do alçapão aberto, da escada de mão e dos corpos (`moveis-calabouco.json`);
  - as gêmeas vazias da fazenda (`!vazio`, `moveis-fazenda-vazios.json`) e as 46 vistas de cima da fazenda;
  - tecnologia cheia e posto da enfermaria (`moveis-tecnologia-cheia.json`), com vazias e vistas de cima;
  - bancadas inteiras do laboratório, mesa de vidro, impressora 3D, mesa do arsenal, poltrona preta, leitor de digital,
    TV grande, alvo de dardos (`moveis-lab-inteiras.json`) e as vistas de cima que esperavam em `_aguardando-importar`;
  - os 12 quadros da fazenda (`quadro_fazenda`, um modelo por peça) e os 23 brinquedos (ícones de item, pelo nome);
  - os prédios da fazenda REFEITOS (os tortos foram para `_substituidas/predios-tortos-ate-09-10`), com a porta aberta
    como estado 1 (clique duplo);
  - paredes pintadas do calabouço e do celeiro; o teste da Agatha (balcão e estante de frascos, cheios e vazios, e o
    estilo `loja`).
- **Falta (código):** posicionar nas salas (sobe SEDE_REV/FAZENDA_REV: antes, levar os ajustes à mão do Felipe para o
  seed); o estrado do altar pisável (a peça subir 0,61 m em cima dele); a porteira (a arte tem a área de 2,25 × 2,25 m
  com a folha aberta; a def é 3 × 1) segue em código; itens de parede com inclinação um pouco diferente (o jogo endireita
  na hora: quadros da fazenda, estandarte, telas).
- `van-mapa.png` está em `arte/mapa/`, sem uso ainda (a barra do trajeto não existe).

## Noite de 08/10: o MAPA mais limpo (no ar, `e5e89cd`)

- **PERSONAGEM (esquerda) só com comandos do tabuleiro**, em grupos (Mover, Postura, Peça, Cena). PV, PE, SAN e a
  mochila saíram de lá (ficam em PLAYERS e ITENS).
- **Abas da direita:** PLAYERS, ITENS, INTERLÚDIO, com ícone (`painel-*.png` pedido ao Códex, seção 3 (D); até lá, um
  do kit) e cada aba da largura do nome (o INTERLÚDIO não espreme mais).
- **A marca de ouro desliza** entre as abas (`marcaOuro.ts`, um observador só para todas as barras: topo, painel da
  direita, planta, mochila, gaveta do combate). Barra nova? Pôr o seletor na lista `BARRAS`.
- **Respiro:** o Felipe achou tudo colado nas bordas. Fim do `hud.css`: `--h-respiro` (1,8rem) em toda janela do MAPA
  e do COMBATE, `--h-respiro-card` nos cartões; as ferramentas do tabuleiro do combate longe da moldura.
- **Pedido ao Códex:** seção 3 com o status certo (combate, mochila, interlúdio e celular chegaram; a logo saiu: o
  Felipe fica com a dele), (D) novo com os 3 ícones das abas, e o `mesa-viagem.png` nas ferramentas da mesa.
- **Esperando o Felipe:** exemplos de cartas para o visual "game retro" (ele quer **mais vertical e mais
  minimalista**; ainda não é o que ele quer). Depois: o painel do Alvo em duas colunas com os valores explicados e a
  ficha da ameaça (o lápis) em abas.

## Fazenda: a arte do Códex entrando (08/10, madrugada)

- **Já no jogo:** a casa por dentro (`moveis-fazenda-casa.json`, 17 peças); a natureza de fora
  (`moveis-fazenda-natureza.json`: mangueira, ipê e a árvore menor como `arvore`, `~b`, `~c`; dois arbustos; milharal,
  canteiro, sacas, fardo de feno, cerca e carroça); os prédios de fora (`moveis-fazenda-predios.json`: casarão, celeiro,
  casa de mantimentos, fonte e placa). As folhas do Códex vêm na escala certa (0,75 m = 168 px, 1,80 m = 247 px): a
  árvore e o arbusto vão "por imagem" com a altura medida na folha, o resto pela largura de verdade.
- **A copa passa da casa:** árvore e arbusto não encolhem para caber na casa (`COPA` em `furniArte.ts`); antes ficavam do
  tamanho de gente.
- **Falta entrar:**
  - a porteira (fechada e aberta: a aberta tem o mourão solto, outra largura em cada vista; precisa de `estados` com cuidado);
  - o calabouço inteiro (`tanque-corpo` a/b/c, `mesa-contencao`, `pilha-cranios`, `alcapao-aberto`, `escada-mao`, e de parede
    `tocha-parede` e `estandarte-sangue`): precisa de defs novas (o `tank` da Sede é 2 × 2 com luz; o do Códex tem ~1 m) e de
    pôr no `seedFazenda.ts` no lugar dos racks e consoles (subir `FAZENDA_REV`). Combinar com o Felipe;
  - as texturas `parede-calabouco` e `parede-celeiro` (1024 × 512, outro caminho, o das paredes);
  - as variações meio mortas (árvores, arbustos, milho, canteiro): ficam para os lugares abandonados.
  Os zips desempacotados estão em `%TEMP%\fz\` (some ao reiniciar; o original está na pasta da arte).

## Esperando o Códex (07/10, manhã)

- **Armados dos quatro (tabuleiro):** só rascunhos em `C:\Users\felip\Documents\Codex\2026-10-04\leia-o-prompt-personagens-txt-na\outputs\continuacao-06-10\armados\` (`*-oito-direcoes-armad*-rascunho.png`), reprovados pelo próprio Códex por causa das mãos (a revisão está em `Personagens/revisao-maos-07-10/` na pasta da arte; NÃO importar). O gerador volta às 14h50 de 07/10. **Decidido pelo Felipe:** esperar a versão certa (`personagens-armados.zip`); quando chegar, importar com `npm run arte:poses -- <folha> <nome> --estado armado --hd` e conferir mão por mão (direita/esquerda de cada direção, como na revisão).
- **Catarina desarmada corrigida** (katana em S, SW e NW): importada em 07/10.
- **Catarina ARMADA, rascunho novo (07/10, outro Códex):** `F:\Dhellow\CRONA\arte\PERSONAGENS-ANIMACAO\trabalho\catarina-armada-07-10\entrega\catarina-armado-8-direcoes.png` (4096×1536, 8 quadros de 1024×768, katana na mão direita, bainha vazia nas costas, alpha limpo). Aguarda o "aprovado" do Felipe (a katana em NE e NW é mais curta pelo escorço) antes de virar `1-armados-catarina.zip`. O erro de NW do conferidor era do próprio `conferir_quadros.py` (a ponta da lâmina contava como um pé); corrigido em 07/10 (`pes()` ignora grupo de colunas com menos de 20% da massa da maior bota) e a folha dá 0 erro. A escala do "laboratório" que o Códex questionou não vale: a medida é a do jogo (94 px = 1,80 m; o Códex entrega a pessoa com 480 px e o jogo reduz). **Não importar ainda:** falta o importador/tocador do formato novo 1024×768.
- **Sem piscar, COMBATE mais usável, planta e viagem (07/10, tarde):**
  - **Sem piscar:** PV, PE e SAN se acertam no lugar no MAPA (PLAYERS, cartão do personagem, cartas), na FICHAS e no COMBATE (a regra está no `docs/GUIA-DO-CLAUDE.md`). Falta o celular do jogador (`telaFicha`) ser medido com o mesmo teste do MutationObserver.
  - **COMBATE:** a escolha da ação (arma, alvo, rolagem) tinha só 12 rem de altura; agora 20 (tabuleiro 46,4 → 40,6 rem, resolução 37,2 → 43). Sem corte em nenhuma aba nem nos passos 2 a 5 do ataque. Passos 6 (Dano) e 7 (Confirmar) ainda não conferidos no tamanho novo; "menu torto": o Felipe não disse qual, perguntar com um print.
  - **Planta (MAPA):** clique e passar do mouse valem pela casa do cômodo (`hitPlanta`, antes pelo retângulo que o cerca e pegava o vizinho); saíram o lápis animado, a varredura de luz e a moldura pulsante do retângulo (o contorno dourado das paredes já marca o cômodo). Plaquinhas dos nomes ainda se sobrepõem em cômodos pequenos (Banheiro/Corredor).
  - **Viagem:** o Felipe achou "gigante" (não ficou claro se o jogo ou o pedido ao Códex). O `PROMPT-VIAGEM.txt` foi enxugado (sem pisos de asfalto, guard-rail, placa, arbusto, caminhonete, cores extras, faróis e vista de cima: ficam a van, banco, painel, 1 árvore, 1 poste, sedan, caminhão e as 10 ilustrações). Se ele quis dizer o jogo, a câmera da viagem (`k = 2,2` no `fit()` de `RoomView.ts`) é o que diminui.
- **Limpeza das salas (07/10, pedido do Felipe: "exclui tudo que não seja a base da Ordem, o bar e o subsolo completo, e a Fazenda"):** `limparSalasDeExemplo` (`server/src/seed.ts`, chamada no `Hotel` só com banco guardado, uma vez, marca `db.limpezaExemplos`) tira a Base da Ordem antiga, o Saguão, a Sala de Interrogatório, a Casa Abandonada, a Mansão Alvarez e a Viagem delas, com as campanhas; repõe os 4 agentes no Bar e na porteira se faltarem; não mexe nas fichas. Backup antes: `server/data/backups/crona_2026-10-07_15-41-21.dump`. A causa de "cadê meus personagens" na tela do preview (5173, banco `crona_visual`) foi o meu teste da Viagem, que deixou os 4 na van; a limpeza também os repôs.
- **Arte de parede trocada (07/10):** a lâmpada de grade (`cage_lamp`) tinha `parede-l` e `parede-r` trocadas (o corpo e o vidro ficavam do lado contrário ao da parede); corrigido em `moveis.json` e em `scripts/3d/fichas/moveis-prisao.json`. A conta de conferir: parede `l` (plano x, a face aponta para a direita-baixo) tem o corpo atrás à ESQUERDA e as barras inclinadas "/"; parede `r`, o corpo atrás à DIREITA e as barras "\\". Pelas medidas, `fan_wall`, `cctv`, `extinguisher`, `crack_glow` e talvez `ac_wall`, `power_box`, `towel_dispenser` parecem trocados do mesmo jeito: conferir com o Felipe antes de trocar. Portas "invertidas": o Felipe falou da Base da Ordem e eu não achei o que foi dito nas conversas; perguntar.
- **Tamanho das salas e da Viagem (07/10):** o Felipe achou a Fazenda com quartos "enormes" para três móveis (13×8 casas para cama, criado-mudo e guarda-roupa). Refeitos à mão (`FAZENDA_REV` 11): Banheiro de Baixo 5×3, Quartos 1/2/3 8×6, Quarto das Crianças 8×6, Escritório 9×8 e Quarto Principal 9×7 (a conta é o piso útil; antes até 13×8). Cortar colunas vazias por código não adianta, porque os móveis ficam nas paredes: tem que reposicionar. Regra do Felipe: **a sala tem o tamanho do que tem dentro**. Ainda grandes e para conferir com ele: Hall (9×13), Cozinha (14×8), Sala de Jantar (8×14), Corredor de Cima (5×12). A cena da Viagem enquadra só a van (`k` 1,3 no `fit()`; era 2,2). A planta do casarão ficou com vãos entre os cômodos menores (reposicionar `plan` se incomodar).
- **Item largado no chão (07/10, feito junto com o Felipe):** `client/src/render/itemNoChao.ts`, usado pelo isométrico (`RoomView.ts`) e pela vista de cima (`mapaTatico.ts`). O ícone pintado fica de pé e levemente inclinado, balança de leve, tem um brilho quente no chão que pulsa e uma sombra que é a silhueta dele **na mesma direção** (cópia paralela logo embaixo, por cima do brilho; espelhar ou inclinar a silhueta virava o sentido). O Felipe aprovou o resultado. Ajustes finos que ele pode pedir: distância da sombra, força do brilho, tamanho (`lado`: 72 px sozinho, 58 se há mais de um).
- **Planta e HUD do jogador (07/10):** o nome de cada cômodo não troca mais de lugar quando muda o cômodo atual (a ordem de colocação dava prioridade ao atual e empurrava os outros para o cômodo do lado); e PV, PE e SAN do celular ficam numa linha só, com a largura dos dígitos reservada (antes quebrava a partir de 10). Regra do Felipe: nada pode mudar de lugar quando um número muda.
- **Retratos (07/10):** o retrato do Alosi (aberto e fechado) foi girado 9° (o corpo e a cabeça pendiam para "\"); a medida por centroide não pegava isso porque o braço esquerdo compensava. Cisalhar deformou o rosto, então foi rotação. O recorte do retrato (`loadArt`, `render/portrait.ts`) abre mais (64% da altura) e começa acima do topo da cabeça. Se o Códex refizer o retrato do Alosi, não girar de novo.
- **Tela de entrada temática** (outra sessão pediu; o prompt está na branch `claude/zen-ramanujan-ko8p7n`, que não está neste PC): salas fantasia, cyberpunk, horror e vazia (computador e celular), paisagem atrás das janelas magenta, mapa, miniaturas de heróis e monstros, dados de obsidiana e objetos da mesa, em `C:\Users\felip\Documents\Codex\2026-10-06\ami\outputs\` (`CRONA-entrada-lote-1-previa.zip`, `CRONA-salas-continuacao.zip`, `crona-entrada-background\`). Faltam 5 paisagens (depois das 14h50). **Decidido pelo Felipe:** só mexer na tela de login quando todas as imagens estiverem prontas. **07/10:** em `crona-entrada-continuacao\` chegaram 5 fundos (cyberpunk PC e celular, fantasia celular, horror PC e celular) e com o `fantasia-computador.png` já são os 6 (3 temas × PC/celular): perguntar ao Felipe se a tela de login temática pode ser feita.

## Feito em 06/10 (noite): o visual do HUD no site inteiro e as peças inteiras

- **O visual do celular nas telas do mestre** (`client/src/ui/hud.css`, carregado por último em `main.ts`; por baixo ficam `retro-auto.css`, gerado por `scripts/dev/retro-gerar.mjs`, e `retro.css`). As molduras pintadas do kit (metal, couro, placas) saíram; ficaram os ícones pintados, as casas do inventário e os retratos. Janela azul-noite com borda bege, título com ícone e a linha de ouro, botão de borda e o de ouro com o brilho, barras com riscos e reflexo, linhas com o cursor ▶, abas com o ícone grande. Animações: os painéis sobem ao trocar de tela, a vez no combate pulsa, o passo atual tem o anel, o carimbo bate. Nada mais é girado (as fotos "polaroide" acabaram).
- **PLANTA = minimapa** (`drawPlan`, `shell.ts`): grade, cômodos azul-escuro, paredes beges, o de agora aceso de ouro com a varredura ao entrar, portas de ouro, nomes em pixel, peças como pontos de luz.
- **Combate com os ícones pintados**: abas de ação, Defesa/Deslocamento, números do alvo, Atrasar/Preparar, clima, pendências, opções e situações.
- **Peças inteiras do Códex**: o Gabinete do Veríssimo remontado com as 11 peças; a mesa em U na Sala de Tecnologia; a cortina em cada leito da Enfermaria (fechada não se entra; aberta, sim). `FurniDef.vazio` (casas livres dentro da pegada) e `aberto` (o lado sem parede): o grid, o canPlace e o tilesFor respeitam; o tabuleiro desenha a peça vazada em duas camadas (inteira atrás do que está dentro, as faces de perto por cima). SEDE_REV 46.
- **Auditoria dos móveis novos** (ângulo de cada vista, o certo é 45°/30°): vitrine, mesa e estante do Veríssimo vão "como estão" (o redesenho na caixa entortava).
- **WebP numa pasta à parte**: `client/public/arte-leve/` (o mesmo caminho, `.webp`), fora do git.
- **Falta**: as vistas isométricas da loja da Agatha, das bancadas do laboratório, da mesa do arsenal, da mesa de vidro, da impressora 3D e da poltrona preta (só chegaram as de cima: os zips `agatha-cima`, `bancadas-cima`, `pecas-inteiras-cima`, `tecnologia-cima` continuam na pasta da arte); a cortina ainda não fica transparente com alguém dentro; os pisos de cima da fazenda (`fazenda-pisos-cima.zip`) ainda não têm onde entrar (a vista tática da fazenda usa cor por casa).

## Pela metade

- **Ferramentas do mestre para arrumar as salas (05/10):** o botão **Trocar** no painel do móvel (aba Descrição: o catálogo abre na categoria dele e troca no mesmo lugar e giro; `swapItem`); o catálogo mostra a **arte** de cada móvel (`arteDaMiniatura`); **Maior/Menor** nos quadros e tapetes (`resizeItem`, `escala` no item, de 0,5 a 3: o quadro cresce em volta do meio, o tapete em volta do meio da pegada, no tabuleiro e no mapa tático); e o **tapete** (todo móvel `flat`) vai para baixo dos móveis (`canPlace`).
- **As salas da Sede não seguem a série (05/10).** O Felipe adorou o visual das peças, mas a arrumação não bate com a série. O levantamento da wiki, sala por sala, está em `docs/SEDE-NA-SERIE.md` (as imagens em `docs/referencias/sede-serie/`, fora do git). **O que o Felipe decidiu (05/10):**
  - **Feito (05/10, `SEDE_REV` 32): as salas desviradas.** Laboratório, Tecnologia, Gabinete, Banheiro e Prisão estavam girados meia volta na planta (`plan.r: 2`); agora a sala é como na planta e a porta fica na parede da frente, a que não aparece (`planBottom` e `planRight` em `seedSede.ts`: o vão do lado de fora e a passagem na última fileira ou coluna). O Banheiro ficou como na série (três vasos e as duas pias). A **Câmara do Selo não tem mais porta** (lugar secreto; a Prisão perdeu a passagem para ela). **As cores dos agentes** são as do elemento (`COR_DO_AGENTE`: Tepes vermelho, Catarina preto, Alosi dourado, Cora roxo), aplicadas em todas as cenas a cada vez que o servidor sobe (`coresDosAgentes`).
  - **Salão:** gosta como está; discutir o que acrescentar (TVs, alvo de dardos, o canto de conversa da entrada com o tapete redondo preto e branco e duas poltronas pretas) e o que tirar (a mesa redonda das cadeiras vermelhas, a mesa oval).
  - **Enfermaria (feito em 05/10, `SEDE_REV` 33):** seis cubículos fechados pelas divisórias (os lados inteiros e um pedaço na frente), os armários de remédio ao lado da porta e o posto da enfermagem em L no canto de baixo. A divisória (`divider`) ganhou o raio-x: fica transparente com alguém atrás, e o clique atravessa para a casa livre (o clique novo).
  - **Gabinete (refeito em 05/10, `SEDE_REV` 36):** o Felipe quer um escritório IMPONENTE ("pra você entrar e pensar: o Veríssimo é muito foda"): a sala cresceu para 12 × 10 (a porta no mesmo lugar); estantes grandes no fundo com o sofá vermelho embaixo da pintura do Coliseu; a mesa grande com a cadeira dele; as quatro poltronas vermelhas no tapete; o armário de metal ao lado; o quadro de detetive; e o canto de exibição (pedestais por enquanto). A arte nova está no `PROMPT-PECAS-INTEIRAS.txt`: a estante da parede inteira, a cadeira imponente do Veríssimo, a mesa, o sofá, as poltronas, a pintura do Coliseu, o quadro de detetive enorme, o tapete aubusson, as armaduras, a vitrine de itens paranormais e os pedestais com relíquia.
  - **Laboratório (feito em 05/10):** como a planta da série: bancadas no fundo e na parede da esquerda, duas bancadas compridas no meio, o quadro branco no fundo. Pedidos: a mesa de vidro, a impressora 3D e o leitor de digital.
  - **Arsenal:** as bancadas pequenas foram desenhadas tortas (42° a 49°); fica como está até chegar a mesa grande inteira (`PROMPT-PECAS-INTEIRAS.txt`).
  - **Tecnologia:** AMOU a temática retrô (PC de tubo, servidor): fica numa metade; a outra metade moderna, com a mesa de várias telas finas (OLED), como na planta oficial. Pedido de arte para a metade moderna.
  - **Laboratório do Renan:** ajustar. **Prisão:** depois. **Banheiro:** bom. **Câmara do Selo:** lugar secreto, SEM porta por enquanto.
  - **Loja da Agatha:** refeita do zero (`PROMPT-LOJA-AGATHA.txt`).
  - **Salão (feito em 05/10, `SEDE_REV` 38):** como na série: a fileira de quatro mesas de trabalho (a quarta no lugar da mesa redonda), os armários de ferro, a rosa dos ventos, e na frente da escada o canto de conversa (duas poltronas frente a frente e a mesinha). Saíram a mesa redonda das cadeiras vermelhas, a mesa oval e o xadrez. Pedidos (`PROMPT-PECAS-INTEIRAS.txt`): as TVs grandes de tela fina, o alvo de dardos (na parede do banheiro), as poltronas pretas e o tapete redondo geométrico preto e branco. **Quando chegar:** pôr as TVs nas paredes, trocar as poltronas e pôr o tapete no canto de conversa (o alvo de dardos foi para o Bar).
  - **Bar e Corredor (05/10, `SEDE_REV` 39):** o Felipe gosta dos dois como estão. O Bar ganhou só o **alvo de dardos** na parede esquerda (o `dartboard`, entre as arandelas); quando chegar o `alvo-dardos` do `PROMPT-PECAS-INTEIRAS.txt`, a arte entra no lugar dele.
  - **As condições no PLAYERS (05/10):** saíram da FICHAS do mestre e foram para o cartão de cada agente no PLAYERS do MAPA: as que saem sozinhas pelo PV e pela SAN e as que o mestre marca no botão "+ Condição". A janela de escolha grava a lista vazia (`podeVazio`), para tirar a última; isso ainda falta ver no navegador.
  - **FICHAS repaginada (05/10, aprovada pelo Felipe):** na tela grande, oito papéis em vez de catorze e cada coisa uma vez só: os agentes só com os retratos; o personagem; a **Vida** (PV, PE e SAN e as condições embaixo); a **Identificação** numa faixa de três colunas; **Atributos** com os números do combate do lado (derivados e o antigo painel tático juntos); **Itens e ataques** (os ataques em cima, a mochila embaixo); as **Perícias** em duas colunas, sem rolar; e um painel de **abas** (Poderes, Rituais, Companheiro, Anotações, Evolução). Os painéis se juntam em grupos (`fx-grupo`, `fichas.ts`); no celular os grupos somem (`display: contents`) e a ficha continua como era. O CSS está no fim do `fichas.css`. **A FICHAS do mestre é a das regras** (pedido do Felipe): só os máximos (PV, PE e SAN máx. em placas) e nada de condições; o que acontece em jogo fica na lateral do MAPA e no celular do jogador, que continua com as barras e as condições (`this.o.jogador`). O papel do kit perdeu o "quadrado" da emenda (moldura ajustada, `*-fonte-ajustada.png`).
  - **O CRONA inteiro no Docker (05/10):** `Dockerfile`, o serviço `jogo` (container `crona-app`) no `docker-compose.yml`, `npm run crona` / `crona:parar` / `crona:logs` (`scripts/crona.mjs`). Porta 8080: localhost = mestre, IP da rede = mesa e celulares. O banco oficial `crona` agora é o de hoje (cópia do `crona_visual`); o antigo, de 29/09, ficou como `crona_antes_docker`, e os dois têm backup em `server/data/backups/` (19h00 de 05/10). Trava de um servidor por banco. O `banco:restaurar` recusa com o jogo ligado.
  - **Kit de interface do Códex no jogo (05/10):** as Partes 1 (menus, 133 peças) e 2 (fichas, 72) inteiras e a 3 (combate, 62 de 80) em `client/public/arte/interface/` (as peças neutras), `temas/<tema>/interface/` (as que têm a cor do tema), `icones/` e `combate/`; os manifestos do Códex em `temas/_manifestos/`. O Códex não conseguiu gravar na pasta BASE (acesso negado): a entrega ficou em `Documents\Codex6-10-04\leia-o-prompt-interface-game-txt\outputs\Interface game`. Falta: a Energia caótica (24 arquivos, mesmos nomes), 18 ícones da Parte 3 e as Partes 4 a 6 (o gerador volta em 06/10, 10h12).
  - **Tema da interface (05/10):** `tema` na ficha (`FichaSalva.tema`: ordem, sangue, morte, conhecimento, energia; sem tema = Ordem), escolhido na Identificação (modo editar). Os quatro agentes ganharam o do elemento uma vez (`temasDosAgentes`). O tema veste só a tela do agente (`data-tema` na FICHAS, na tela do jogador e na requisição); MAPA, COMBATE e mesa ficam Ordem. Cada peça do kit vira uma variável de CSS, `--ui-<grupo>-<peça>` (`client/src/ui/temaUi.ts`, a partir de `/api/arte`), e cada tema tem `--destaque` e `--destaque-2` (`tema.css`). **Telas vestidas (05/10, `client/src/ui/kit.css`):** a barra do topo (fundo, abas nos estados com o brilho pulsando, botões de ícone, ícones pintados), todos os papéis (`paperize` usa o papel do kit, moldura de 48 e miolo de 256; `kit: false` fica com o desenhado, nos recortes e bilhetes), a moldura azul do tabuleiro e os botões do HUD, as casas do inventário, os botões de AÇÕES e de baixo da FICHAS (o botão grande num `::before`), as cartas da lista de agentes (carta do kit por cima do retrato, brilho na ativa), as barras de PV/PE/SAN com moldura de metal, as placas dos derivados, os ladrilhos dos atributos e dos títulos (ícones pintados), as linhas dos equipamentos e o personagem grande (fundo pintado e moldura). **COMBATE e peças gerais (05/10):** as cartas da iniciativa (normal, a vez com brilho, quem agiu), as abas das ações com ícones pintados (`combate-<aba>.png`; manobra, item e outras entram sozinhas quando chegarem), a barra de passos, os cartões das armas, a caixa do dado, o carimbo, os chips das ações, a moldura do alvo, os botões (o grande do kit; o forte na cor do tema), as ferramentas do tabuleiro (botões do HUD) e a moldura azul; os campos de texto e número, os seletores, os marcadores e as opções (checkbox e rádio), os chips, a dica e a rolagem. Os destaques vermelhos fixos da FICHAS e da requisição viraram `--destaque`. **Falta:** o interruptor e o ornamento-linha (sem lugar na tela ainda), os efeitos (faísca, fumaça, brasas) e a `mira` (as bases do agente e do inimigo e o círculo do ritual já estão no tabuleiro, em `combateMarcas.ts`; a base da arte é mais achatada que o chão e vai com a altura a 0,85 da largura); e conferir peça por peça com as prévias do Códex.
  - **Prisão (refeita em 05/10, `SEDE_REV` 41):** 24 × 16 (era 24 × 20). Todas as celas nas duas paredes do fundo, com a frente para a câmera (antes, a fileira da frente aparecia pelas costas): quatro no fundo, uma na esquerda e, no canto, a **cela de contenção**, maior, para o que não é gente (sigilo no chão, correntes, sigilo riscado, sangue e entulho). No pátio, a mesa de metal do interrogatório debaixo da lâmpada; perto da porta, o posto do carcereiro (armários, mesa com monitor, painel das câmeras). **A parede de cela voltou a ser desenhada por código:** a arte (a divisória antiga esticada) ficava num plano diferente da porta e mais grossa, passava na frente dela e as quinas não fechavam. A arte nova entra quando o Códex fizer a prisão (o `PROMPT-PRISAO-CELAS.txt` ainda pede módulos; refazer como peças inteiras, a cela desenhada inteira e cortada).
  - **A Sede refeita cômodo por cômodo (05/10):** cada cômodo guarda o resumo da montagem dele (`montagem`, de `resumo()` em `seedSede.ts`). Subir `SEDE_REV` agora só refaz os cômodos cuja montagem mudou; os outros ficam como o mestre arrumou pelo jogo. Cômodo de antes do resumo fica como está e só ganha as peças de parede novas da lista `NOVAS_NA_PAREDE`. **Cuidado:** mexeu no seed de um cômodo, ele é refeito inteiro e perde o que o Felipe mexeu nele pelo jogo; passe antes as mudanças dele para o seed.
  - **Todas as salas da Sede revistas em 05/10**, e a Prisão refeita em seguida; falta a Loja da Agatha (espera a arte).
- **Personagens em chibi (decidido em 04/10).** O Felipe escolheu o chibi para todos os personagens do tabuleiro (agentes, NPCs e ameaças): no tablet, ele se reconhece de longe e fica bem atrás dos móveis (prévia no Laboratório, ao lado da Catarina realista e atrás da bancada). Mas no **traço do cenário**: a referência de corpo que ele trouxe destoava (contorno preto grosso, cores vivas chapadas); o personagem tem que parecer parte da mesma cena dos móveis.
  - **O pedido:** `PROMPT-PERSONAGENS.txt` foi refeito para os 4 agentes em chibi (teste com a Catarina, as 8 direções dos outros, os armados e as animações), com o gabarito `gabaritos/pedidos/gabarito-personagem-8-direcoes.png` (`scripts/3d/pedidos/personagens.json`) e as referências em `gabaritos/agentes/` (`chibi-referencia-corpo.png` = o corpo, `cena-referencia-laboratorio.png` = o traço). Os NPCs e as ameaças ficam para um pedido depois dos agentes aprovados.
  - **A Catarina realista em alta definição** (a entrega de 03/10, convertida com `--hd`) saiu do jogo: está guardada na pasta da arte em `_substituidas/catarina-realista-hd-04-10/` e o zip em `_entregas-originais/personagens-teste-realista-03-10.zip`. O código de alta definição (`--hd`, os pés achados na imagem, a sombra em cada pé) fica e serve para o chibi.
  - **As animações** têm pedido próprio, quadro a quadro: `PROMPT-ANIMACOES.txt` (o Felipe pediu instrução imagem a imagem, um personagem por vez, cada quadro a partir do anterior).
  - **O teste da Catarina chegou (05/10), só como imagem no chat** (o zip ainda não está na pasta). O Felipe aprovou o traço, as cores, a pose e a katana embainhada nas costas: "é exatamente assim que eu imagino os personagens desarmados". Virou regra (5b do `PROMPT-PERSONAGENS.txt`): **desarmado = mãos vazias e a arma guardada no corpo**, no mesmo lugar em todas as direções (Catarina: katana nas costas; Cora: fuzil na alça nas costas; Alosi: o códex preso ao cinto por uma corrente; **Tepes: desarmado sem nada**); **armado = a arma na mão e a bainha/alça vazia**. As armas de cada um vêm da imagem da equipe que o Felipe mandou (`gabaritos/agentes/equipe-hydra-referencia.webp`): o Tepes luta com um **escudo pequeno redondo** no braço esquerdo e uma **corrente enrolada no antebraço direito, com a ponta caída**, para atacar e para manobras como agarrar (não é revólver); o **Alosi** (ele) usa muitos rituais e leva um **códex** na mão. O ataque do Tepes é o golpe de corrente e o do Alosi é o ritual com o códex. Vale também nas animações desarmadas (`PROMPT-ANIMACOES.txt`). Pedida a correção (item 0.2, `personagens-teste-correcao.zip`): a katana sumiu no SW, o fundo veio branco, o volume do cabelo muda entre direções e no NE o rosto aparece demais.
  - **Os 4 no tabuleiro (05/10):** o `personagens-8-direcoes.zip` trouxe a Catarina corrigida (item 0.2) e a Cora, o Tepes e o Alosi desarmados nas 8 direções. Entraram com `python scripts/poses.py <folha> <nome> --estado desarmado --hd` (o recorte agora acha o vão entre as duas linhas coluna por coluna: o cabelo da Catarina passava da linha da grade). As artes antigas do tabuleiro saíram para a pasta da arte (`_substituidas/tepes-tabuleiro-antigo-05-10`, `alosi-tabuleiro-antigo-05-10` e `alosi-tabuleiro-3d-05-10`), porque o jogo dava preferência a elas. O Felipe gostou do Alosi com cara de novinho. Pendências: na Catarina de frente (S) o cabo da katana não aparece; a altura varia até 4% entre as direções (o Códex avisou); na NW a bainha da katana desce reta (pedido o item 0.3, com o cabo na S); falta a Parte 2 (armados) e as animações. **Respirar e piscar agora vêm desenhados pelo Códex** (item 0 do `PROMPT-ANIMACOES.txt`: `respirar-<estado>-<dir>.png`, 4 quadros em laço, e `olhos-fechados-<estado>-<dir>.png`, só nas direções com rosto); o `boneco.py` era para pixel art. **No código falta** ler essas tiras (como o `anim.json` do boneco) e tocar no parado. **O sinal branco da arma junto da mão saiu (05/10, pedido do Felipe):** a arma aparece só pela folha armada.
  - **Quando o teste corrigido chegar (feito em 05/10, fica de receita):** `npm run arte:poses -- catarina --estado desarmado --hd`, conferir no tabuleiro (a altura pela caixa, os pés, o traço perto dos móveis) e mostrar ao Felipe. Aprovado: as marcações em `scripts/bonecos/catarina.json` para respirar e piscar (o `boneco.py` foi feito para pixel art; talvez precise de ajuste para a arte maior) e seguir as Partes 1 a 3.
- **As interações dos agentes no tabuleiro** (pedidas em 04/10). Quando a arte da Parte 5 chegar (formato no `ARTE.md`, "As interações do agente"), o `RoomView` precisa tocar cada uma:
  - **Abrir e pegar:** quando o mestre usa a ação com a peça comandada, virada para o objeto.
  - **Atacar:** no ataque do combate.
  - **Cair e caído:** quando os PV chegam a 0.

  O andar já toca (o `anim.json` do boneco).
- **Contas:**
  - **Senha esquecida:** ainda não tem "esqueci a senha" (sem e-mail no servidor). O jeito é o mestre apagar a conta, que fica em `config.contas` no banco, e criar de novo.
  - **Lista de contas:** falta uma lista na interface do mestre, para ver as contas, trocar o papel e desligar a ficha.

- **Requisição de equipamento** (`shared/src/regras/requisicao.ts`):
  - modificações e maldições dentro da requisição;
  - quantidade na munição;
  - o servidor conferir o limite da patente quando o jogador salva a própria ficha (`fichaSalvar`);
  - as escolhas de dentro do item (a perícia do utensílio, o elemento, o ritual da vestimenta e do catalisador, os selos);
  - as conferências das maldições (`ELEMENTO_OPRIME`, PP) e os requisitos das modificações.
- **FICHAS mais bonita:**
  - ícones coloridos de PV/PE/SAN e dos atributos, letra maior;
  - comparar com `docs/referencias/fichas.webp`.

  O grosso espera o kit de interface do GPT (abaixo).
- **Ícones pintados no COMBATE** (a escolha da arma) **e no inventário rápido do MAPA:** espera o OK do Felipe.
- **Vista tática:**
  - testar no tablet de verdade, com as fichas de 1 casa (04/10);
  - a arte de cima e as paredes das outras 11 salas quando chegarem.
- **Bonecos:** conferir o pixel depois da escala de 91%. Talvez refazer as tiras pelo `scripts/boneco.py`.
- **Calabouço:**
  - Mobis novos quando a arte chegar:
    - a mesa de contenção (hoje é a mesa metálica);
    - a pilha de crânios;
    - a tocha de parede;
    - o estandarte (hoje é o pôster de sigilo).
  - Um estilo de piso próprio (`piso-calabouco.png`); hoje usa o `selo`.
  - O tanque apagado (estado 1) não tem arte.
- **O chão do píer e da ponte:** o terreno `m` usa os tacos de sala (`taco`). Precisa de um estilo de tábuas (`piso-pier.png`).

## Feito em 06/10: a tela do jogador no celular

- **Modo jogo** (`client/src/ui/jogador.ts`, `jogador.css`; referências `docs/ref-jogador-*.webp`, fora do git): o jogador entra pela conta (ou o link `?ficha=`) e cai nas abas Agente, Mochila, Poderes, Rituais, Docs e Notas; a ficha inteira fica na engrenagem.
  - **Agente:** os cinco atributos no pentagrama da ficha, em volta do personagem; o Desarmado/Armado empunha a primeira arma ou guarda (a peça no tabuleiro acompanha).
  - **PV, PE, SAN:** − e + do próprio jogador; as barras correm, o que saiu fica um instante claro e desce, e pulsam com pouco sobrando. Chega na hora ao painel do mestre, à FICHAS e à mesa (`server/test/jogador.test.ts`).
  - **Mochila:** as casas da FICHAS só com a arte; o toque abre o item (tipo, peso, categoria, onde está, efeito, texto) com empunhar, vestir, usar e entregar à equipe. O jogador mexe só na própria mochila e não larga no chão.
  - **Docs:** o mestre cria em Configurações → Documentos (título, tipo, filtro, origem, imagem, páginas) e entrega a agentes ou à equipe; o jogador lê, marca e passa para a equipe (`shared/src/documentos.ts`).
  - **Notas** (fixadas e recentes) e **rituais favoritos** ficam na ficha (`diario`, `favoritos`).
  - **Combate:** habilidade (`gastarPe`), dano, SAN e ritual já descontavam na peça; o teste confirma que chega ao celular e à mesa.
- **Ícones pintados que faltam:** `PROMPT-ICONES-CELULAR.txt` (armado, desarmado, docs-todos, docs-evidencias, docs-pistas, notas-recentes, notas-fixadas, carga). Até chegar, cada um usa o mais parecido do kit; os nomes já estão no código e entram sozinhos.
- **Conta de teste:** `teste` / `teste`, jogador, ligada à ficha da Catarina (a ficha ganhou o link de jogador).
- **Falta:** a arte de cada ritual (`arte/rituais/<id>.png`); o jogador que entrou na conta antes de ter ficha fica no aviso "sem ficha" até sair e entrar de novo.

## A fazer (não depende de arte)

- **A parte do jogador** (ainda não começou): o celular com a ficha dele (já existe o link `?ficha=`), o inventário, os rituais e as condições; a jogada continua na mesa, com dados de verdade. Planejar antes de construir (o que ele vê, o que pode fazer e o que fica só com o mestre).

- **Aba INTERLÚDIO** do MAPA.
- **Fazenda:**
  - Santo Berço, a mata e a rodovia (hoje só placas);
  - andar mais rápido ao ar livre;
  - ligar a Sede aos arredores, que ainda é decisão do Felipe: junta as duas campanhas numa só.
- **FICHAS:** a criação passo a passo (`CHECKLIST-TELA-FICHAS.md`).
- **Bilhetes de confirmação** (`client/src/ui/note.ts`): sem estilo.
- **A tela MAPA** ainda usa parte das mensagens antigas (`docs/CONTRATO.md`).
- **Depois:** login e escolha de campanha; a tela do jogador ("modo jogo").

## Arte em aberto (a fila do Códex)

**Pedidos do Felipe (17/10) para quando a cota do Códex voltar:**
- A pose **agachado** de todos os personagens (agentes, NPCs e ameaças), no formato das poses do tabuleiro.
- Os **4 NPCs novos** (17/10), no estilo do Miguel, com as referências em `F:\Dhellow\CRONA\campanha\npcs-novos-17-10\`
  (`npc-a-camisa-rosa.jpg`, `npc-b-ruivo-barba.jpg`, `npc-c-cabelo-rosa.jpg`, `npc-d-jaleco.jpg`). O Felipe: "faça eles
  sem mão no bolso". Os nomes ele dá depois (a ficha dos NPCs, com o nome editável, está sendo feita no FICHAS).


**A fila vive na pasta da arte: `00-COMECE-AQUI.txt`** (em `F:\Dhellow\CRONA\arte\TEXTURAS MAPA\BASE - Ordo Realitas`), com os lotes na ordem e a mensagem pronta para colar no Códex. Reorganizada em 07/10: na raiz ficam só os pedidos que ainda faltam; o que já entrou no jogo foi para `_entregas-originais` e `_arquivo`; as vistas de cima que esperam a peça isométrica ficam em `_aguardando-importar`.

**Conferido em 07/10 (o que está no jogo e o que não está)**
- **No jogo, completo:** a interface (497 arquivos idênticos ao inventário do Códex, partes 1 a 6, com os retratos e as piscadas), os ícones dos itens (244), as variações b e c (20 vistas de cima), as portas, os móveis e os itens de parede na medida, o escritório do Veríssimo, a cortina do leito, a mesa em U.
- **A vista de cima chegou, falta a peça isométrica** (por isso não entram): Loja da Agatha (18 peças), as 3 bancadas do laboratório, a mesa do Arsenal, a mesa de vidro, a impressora 3D, a poltrona preta, a cadeira gamer, o rack moderno, a lixeira.
- **Os 7 pisos da fazenda** (grama, estrada, lavoura, cascalho, terra, píer, calabouço) **entraram no jogo em 07/10:** as texturas em `client/public/arte/texturas/` (registradas no `texturas.json`, 4 casas cada), os estilos novos `pier` (o terreno `m`) e `calabouco` (as 3 cenas do calabouço; a troca é uma migração leve, `pisosDoCalabouco`, que não refaz a fazenda), e o mapa tático agora pinta cada casa com o chão do terreno dela e a água.

**Os lotes (na ordem)**

| Lote | Pedido | Situação |
|---|---|---|
| 1 | `PROMPT-TECNOLOGIA-CHEIA-E-ENFERMARIA.txt` (07/10): o posto da enfermaria em L inteiro; a Sala de Tecnologia cheia (cadeira gamer roxa, telão do C.R.I.S, TV com DERROTA, torre de tubos, bancada de eletrônica, mesa holográfica, frigobar, rack, painel, mural, lixeira) | Novo; gabaritos em `gabaritos/pedidos/lote-07-10/` |
| 2 | `PROMPT-ICONES-E-LOGO.txt` (07/10): as situações do combate, agachar e cobertura, mão livre, chave, os 3 modos do objeto, o Interlúdio e a LOGO do CRONA; `PROMPT-ICONES-CELULAR.txt` (7 ícones); `PROMPT-FERRAMENTAS-MESA.txt` (Apontar, Desenhar, Mapa) | Novos; o código já procura os nomes (`sit-*`, `il-*`, `obj-*`, `mao-livre`, `chave`, `armado`...) |
| 3 | `PROMPT-PECAS-INTEIRAS.txt` (mesa do Arsenal, mesa de vidro, impressora 3D, leitor de digital, TV grande, alvo de dardos, poltrona preta), `PROMPT-BANCADAS.txt` (3 bancadas), `LISTA-REFAZER.txt` (relógio) | Só as vistas isométricas; as de cima chegaram |
| 4 | `PROMPT-LOJA-AGATHA.txt` | Falta tudo menos a vista de cima |
| 5 | `PROMPT-RITUAIS.txt` (07/10): 97 pinturas, uma por ritual (`arte/rituais/<id>.png`, que a aba de Rituais do celular já procura) | Novo; gerado da lista do catálogo (`scripts/dev/lista-rituais.ts`) |
| 6 | `PROMPT-PRISAO.txt` (refeito em 07/10): cada cela como UMA peça inteira (fechada e aberta), a cela de contenção e a vista de cima | Substitui o `PROMPT-PRISAO-CELAS.txt` (módulos), que foi para `_arquivo/prompts`; gabaritos em `gabaritos/pedidos/prisao/`. **No código, quando chegar:** a cela inteira como peça com `vazio`/`aberto` e `openState` (como a cortina), e o `cela` achando o dentro dela |
| 7 | `PROMPT-FAZENDA.txt` | O último; só os pisos de cima chegaram |

**Não é com este Códex:** os personagens e as animações (`F:\Dhellow\CRONA\arte\PERSONAGENS-ANIMACAO`, outro Códex; as armadas da Catarina já em andamento) e a tela de entrada temática (em `C:\Users\felip\Documents\Codex\2026-10-06\ami\outputs`, faltam 5 paisagens).

**No código (Claude), enquanto isso:** o mapa tático usar a vista de cima da variação sorteada (`chaveDaArte`); montar o importador e o tocador do formato novo dos personagens (1024×768).

**O que fazer quando cada zip chegar**

| Zip | Como entra |
|---|---|
| `icones-*.zip` | `python scripts/icones.py <zip>` |
| `interface-*.zip` | Ligar os ganchos de cada peça (só o alfinete e o teclado da geladeira já têm). |
| `retratos-agentes.zip` | Entram sozinhos. |
| `ferramentas-mesa-*.zip` | Entram sozinhos: os ícones em `client/public/arte/icones/mesa-*.png`, a névoa em `client/public/arte/texturas/nevoa-mesa.png`. Conferir a emenda da névoa (2×2) e a leitura dos ícones a 20 px. |
| `prisao-celas.zip` | Fichas no `moveis-prisao.json`: `cell_front`, `cell_front~b`/`~c` e o `cell_door_steel` com estados. A parte de cima vai pelo `cima.py`. |
| `vista-de-cima-<sala>.zip` | `python scripts/3d/cima.py <pasta>` |
| `variacoes-e-arsenal.zip` | As variações como `"def": "<id>~b"`; o teclado em `interface/teclado-geladeira/`. |
| `bau-militar-aberto.png` | Trocar na ficha do arsenal (estado 1 do `chest_army`). |
| Zips da Fazenda | Fichas novas (`moveis-fazenda-*.json`); as texturas no `texturas.json` (`grama`, `estrada`, `lavoura`, `cascalho`, `terra`, a parede do celeiro); estilos novos para o píer e o calabouço; os mobis novos do calabouço. |
| `portas-novas.zip` | As folhas no lugar das de hoje em `client/public/arte/mobiliario/folhas/porta-*.png`. Na `scripts/3d/fichas/moveis-portas.json`: `"real": [0.75, 0.08, 2.17]`, `"topo": [0.75, 0.08]`, `"caixa": [0, 0.24, 0, 1, 0, 2.17]`; `python scripts/3d/moveis.py scripts/3d/fichas/moveis-portas.json`. No `furniKit.ts`: `VAO_PORTA_M = 0.65` e `BATENTE_PORTA_M = 0.05`. Confira com `python scripts/3d/conferir_arte.py --so portal,portal@metal` e no tabuleiro (Laboratório: a estante encostada; Banheiro: a pia). |
| `moveis-na-medida.zip` | As folhas no lugar das de hoje (mesmo nome) e `moveis.py` com a ficha de cada uma (a do cômodo); `conferir_arte.py --so <ids>`. Com a peça cabendo na casa, o `encaixe` não encolhe mais nada. |
| `parede-na-medida.zip` | Idem; o `conferir_arte.py` mede as bordas (0,5 ± 0,06). |
| Zips dos personagens | `npm run arte:poses -- <nome> --estado <estado> --hd` e `npm run arte:boneco`. Cada personagem novo precisa das marcações em `scripts/bonecos/<nome>.json`. |

Os zips que entraram ficam em `_entregas-originais/`, na pasta da arte.

## Decisões que são do Felipe

- ~~Aprovar o estilo da vista de cima do Bar.~~ **Aprovado em 16/10** (o Felipe: "tá bem bonito"): a vista tática feita por código, sem arte do Códex, fica como está.
- Ícones pintados no COMBATE e no inventário rápido do MAPA.
- O que vem primeiro: as modificações na requisição ou a FICHAS bonita.
- Fechar o PR `#2` do Códex (`codex/arte-tepes-32bits`), que ficou sobrando.
- Ligar a Sede aos arredores da Fazenda.

## Problemas conhecidos

- **`scripts/3d/eixos.py`:** marca o aparador e o armarinho do Bar como "TROCADO". Os dois não são caixa, então a conta não vale; no tabuleiro estão certos.
- **Corredor Escuro:** é bem escuro de propósito. O mestre clareia no ☀ Clima da cena se o tablet não mostrar.
- **Passagem secreta no teste do servidor:** o teste "toda passagem tem caminho" pula a passagem escondida enquanto ela está coberta (o alçapão embaixo do feno).
