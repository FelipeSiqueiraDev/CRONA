# Em aberto: onde paramos (10/10/2026)

O que está pela metade, o que falta e o que o Códex ainda vai entregar. Leia junto com o [`GUIA-DO-CLAUDE.md`](GUIA-DO-CLAUDE.md), que diz como trabalhar aqui. **Atualize este arquivo ao fim de cada bloco de trabalho.**

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

## Feito em 12/10 (na nuvem, branch `claude/mesas`): as mesas maiores e o vão embaixo

- **Maiores (o Felipe: "todas um pouco maiores, e a altura"):** no catálogo, `aumento` (1,2; a mesinha baixa, 1,35) faz a arte crescer por igual em volta do meio da pegada (`encaixe` em `furniArte.ts`), e a `height` já vem multiplicada (o que vai em cima fica no tampo novo). A pegada no chão não muda: a borda passa um pouco por cima das casas vizinhas. A caixa da ordem de desenho e do clique cresce junto (`RoomView.ts`).
- **O vão (`vao` no catálogo):** `'vazada'` (só pernas: mesa de trabalho, de reunião, de jantar, da cozinha, de bar, redonda, de xadrez, a mesinha, a de contenção) e `'fundo'` (gaveteiro, painel ou caixas embaixo: as escrivaninhas, a do Veríssimo, a das ferramentas, a do arsenal, a bancada de armas, a mesa de vidro). A mesa em U ficou como estava (monitores nas bordas).
  - A cadeira e a banqueta **encaixam embaixo** das duas (`canPlace`: no chão, uma por casa); o que vai para a mesa continua indo para o tampo, mesmo com a cadeira embaixo.
  - Na **vazada** se passa por baixo (`walkState` = `walk`; o caminho custa mais, `sobMesa` em `pathfinding.ts`: só passa por baixo quando é o que sobra) e se para ali, **escondido**: a peça fica no chão (`standHeight`), abaixada (0,62 da altura) e desenhada antes da mesa (`sob` na ordenação, `render/sort.ts`). Clicar na mesa vazada leva a peça comandada para baixo dela, como a cadeira. Na **com fundo**, ninguém atravessa.
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

- Aprovar o estilo da vista de cima do Bar, que libera as outras salas.
- Ícones pintados no COMBATE e no inventário rápido do MAPA.
- O que vem primeiro: as modificações na requisição ou a FICHAS bonita.
- Fechar o PR `#2` do Códex (`codex/arte-tepes-32bits`), que ficou sobrando.
- Ligar a Sede aos arredores da Fazenda.

## Problemas conhecidos

- **`scripts/3d/eixos.py`:** marca o aparador e o armarinho do Bar como "TROCADO". Os dois não são caixa, então a conta não vale; no tabuleiro estão certos.
- **Corredor Escuro:** é bem escuro de propósito. O mestre clareia no ☀ Clima da cena se o tablet não mostrar.
- **Passagem secreta no teste do servidor:** o teste "toda passagem tem caminho" pula a passagem escondida enquanto ela está coberta (o alçapão embaixo do feno).
