# Em aberto: onde paramos (06/10/2026)

O que está pela metade, o que falta e o que o Códex ainda vai entregar. Leia junto com o [`GUIA-DO-CLAUDE.md`](GUIA-DO-CLAUDE.md), que diz como trabalhar aqui. **Atualize este arquivo ao fim de cada bloco de trabalho.**

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

Ainda falta (pedido do Felipe):
- **Quando a arte chegar:**
  - montar a sala de tecnologia cheia e o posto da enfermaria (tirar as duas bancadas e a mesa do
    PC);
  - trocar os ícones;
  - escolher a logo.

## Esperando o Códex (07/10, manhã)

- **Armados dos quatro (tabuleiro):** só rascunhos em `C:\Users\felip\Documents\Codex\2026-10-04\leia-o-prompt-personagens-txt-na\outputs\continuacao-06-10\armados\` (`*-oito-direcoes-armad*-rascunho.png`), reprovados pelo próprio Códex por causa das mãos (a revisão está em `Personagens/revisao-maos-07-10/` na pasta da arte; NÃO importar). O gerador volta às 14h50 de 07/10. **Decidido pelo Felipe:** esperar a versão certa (`personagens-armados.zip`); quando chegar, importar com `npm run arte:poses -- <folha> <nome> --estado armado --hd` e conferir mão por mão (direita/esquerda de cada direção, como na revisão).
- **Catarina desarmada corrigida** (katana em S, SW e NW): importada em 07/10.
- **Tela de entrada temática** (outra sessão pediu; o prompt está na branch `claude/zen-ramanujan-ko8p7n`, que não está neste PC): salas fantasia, cyberpunk, horror e vazia (computador e celular), paisagem atrás das janelas magenta, mapa, miniaturas de heróis e monstros, dados de obsidiana e objetos da mesa, em `C:\Users\felip\Documents\Codex\2026-10-06\ami\outputs\` (`CRONA-entrada-lote-1-previa.zip`, `CRONA-salas-continuacao.zip`, `crona-entrada-background\`). Faltam 5 paisagens (depois das 14h50). **Decidido pelo Felipe:** só mexer na tela de login quando todas as imagens estiverem prontas.

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

Todos os pedidos estão na pasta da arte do GPT. O Felipe cola no Códex: *"Leia o arquivo PROMPT-<nome>.txt da pasta BASE - Ordo Realitas e faça o que ele pede, começando pela parte indicada"*.

**Pedidos**

| Pedido | Entrega | Como está (levantamento de 05/10) |
|---|---|---|
| ~~`PROMPT-ICONES-ITENS.txt`~~ (entregue; o pedido saiu da pasta em 06/10) | — | **Completo (05/10): 244 ícones no jogo**, as 5 partes (armas; proteções, munição e explosivos; equipamentos; paranormais e amaldiçoados; itens do cenário, por nome e por tipo). |
| `PROMPT-INTERFACE-GAME.txt` | `interface-teste.zip` primeiro; depois `interface-menus`, `-fichas`, `-combate`, `-modal-itens`, `-celular` e `retratos-agentes` | **O teste chegou em 05/10** (`interface-teste-revisado.zip`, na raiz da pasta da arte): 36 peças em Sangue e amostras dos outros temas, com uma prévia (só os PNGs entram; o CSS e o JS do Códex, não). **Decidido em 05/10: a interface tem tema por elemento, escolhido na criação do personagem** (Tepes Sangue, Catarina Morte, Alosi Conhecimento, Cora Energia; Medo não tem), mais o tema **Ordem**, neutro e padrão: telas gerais do mestre, a mesa, NPCs, ameaças e agente sem elemento escolhido. As peças que mudam com o tema vêm em `temas/<ordem|sangue|morte|conhecimento|energia>/interface/...`. No código falta: um campo `tema` no personagem (não é a `afinidade` do NEX 50%, que vem depois), a escolha na criação e na ficha, e a interface trocando as peças pelo tema do agente aberto. **Estilo aprovado em 05/10:** o Códex segue com as Partes 1 a 6 de uma vez, nos 5 temas (o Energia mais contido); o pedido diz o que muda e o que não muda com o tema. **06/10: o kit novo entrou** (`Interface game/01 - Kit para usar agora`; as Partes 1 a 3 completas, 302 de 379 peças): 68 peças retocadas (o tema Energia refeito, os papéis das fichas) e 34 novas. Os ícones pintados agora aparecem nos botões do combate (Passar turno, Desfazer, Alcance, Medir, Área, Tática, Centralizar), nos estados da ordem (caído, morrendo, ritual) e no ISO/TÁTICA do MAPA. Da Parte 4 (modal de itens) vieram só a aba de categoria, o contador da patente, a barra de carga e a casa grande do item: já vestem a requisição. **Falta do Códex (77 peças):** o resto da Parte 4 (moldura, cartões, selos, etiquetas, ícones das categorias), a Parte 5 (celular) e a 6 (retratos); a lista está em `Interface game/04 - Retomada/PENDENTES.txt`. |
| `PROMPT-PRISAO-CELAS.txt` | `prisao-celas.zip` | Nada entregue. |
| `PROMPT-FERRAMENTAS-MESA.txt` (06/10) | `ferramentas-mesa-teste.zip` (o ícone de Apontar) primeiro; depois `ferramentas-mesa-icones.zip` e `ferramentas-mesa-nevoa.zip` | Novo. Os 4 ícones dos botões e a textura da névoa (que repete). |
| `PROMPT-VISTA-DE-CIMA.txt` | Partes 2 a 12, um `vista-de-cima-<sala>.zip` por sala | **No jogo (05/10):** o Bar e as outras 10 salas (64 móveis, as 10 paredes por piso e os estados abertos do baú e do armário de munição), pelo `cima.py`. Falta só a Prisão (Parte 11), que vem com o lote da prisão. |
| ~~`PROMPT-VARIACOES-E-ARSENAL.txt`~~ (entregue; o pedido saiu da pasta em 06/10) | `variacoes-e-arsenal.zip` | **No jogo (05/10):** as 30 variações viraram `<id>~b`/`~c` em 13 móveis (gun_table, weapon_rack, locker_ammo, bar_shelf, plant, hospital_bed, lab_bench, cabinet_file, painting, tally_marks, table_work, board_investigation, console; cada peça sorteia o seu) e o teclado foi para `interface/teclado-geladeira/`. |
| `LISTA-REFAZER.txt` | `relogio.zip` | **No jogo (06/10):** o baú aberto, as variações b e c do leito e do quadro de paisagem (`hospital_bed~b/~c`, `painting~b/~c`), a luz de alarme nova (cúpula vermelha com gaiola, 0,26 × 0,16 × 0,30 m) e o ar-condicionado na inclinação da parede. **Volta:** o relógio, ainda quase de frente (bordas a 0,28; a parede é 0,5). |
| ~~`PROMPT-PORTAS-E-MEDIDAS.txt`~~ (entregue; o pedido saiu da pasta em 06/10) (04/10) | `portas-novas.zip` (as 6 portas, de 0,75 m) primeiro; depois `moveis-na-medida.zip` (13 móveis que vieram largos) e `parede-na-medida.zip` (6 itens de parede deitados). Cada peça com o gabarito em `gabaritos/pedidos/` e a folha de hoje em `gabaritos/pedidos/hoje/`. | **As 6 portas novas estão no jogo (05/10):** 0,75 m com o batente (`VAO_PORTA_M` 0,65, `BATENTE_PORTA_M` 0,05), `conferir_arte.py` sem nada fora da medida. **Os 13 móveis e os 6 itens de parede estão no jogo (05/10)** (`moveis-na-medida.zip`, `parede-na-medida.zip`). As fichas do fliperama, do armarinho, do sofá e do carrinho de enfermagem passaram para a ordem padrão das 4 vistas (as folhas antigas tinham 8 desenhos ou uma vista espelhada). O `conferir_arte.py` ainda aponta 9 peças: a cama da cela, o leito, a sinuca e o sofá passam de 3% a 8% da casa (o `encaixe` reduz, quase não se vê); o relógio e o ar-condicionado com as bordas fora da parede; a porta da cela fica para o lote da prisão. As variações b e c do leito e do quadro de paisagem saíram do jogo (feitas sobre as folhas antigas); o pedido de refazer está na `LISTA-REFAZER.txt`. A lista saiu do `conferir_arte.py` (30 fora da medida; a porta de grade da cela fica para o lote da prisão). |
| `PROMPT-VARIACOES-VISTA-DE-CIMA.txt` (05/10) | `variacoes-vista-de-cima.zip` | Novo: a vista de cima das 18 variações b e c (gabaritos em `gabaritos/variacoes-cima/`). **No código falta:** o mapa tático usar a vista de cima do modelo que a peça sorteou (hoje usa a do móvel base, `imagemDeCima(defId)`; a escolha é `chaveDaArte` em `furniArte.ts`). |
| `PROMPT-LOJA-AGATHA.txt` (05/10) | `agatha-teste.zip` (balcão, estante de frascos, piso e parede) primeiro; depois `agatha-moveis`, `-balcao`, `-parede`, `-cima` | Novo. A "Sala de Rituais" é, na série, a **Loja da Agatha** (Agatha Volkomenn): um antiquário ocultista de madeira escura, frascos, livros e névoa, com o balcão no meio, o símbolo triangular no chão atrás dele e a mesa de tatuagem. Saiu como um calabouço (pedra com musgo, pentagrama de sangue, caveiras). O Felipe pediu a sala refeita inteira, sem reaproveitar nada. Gabaritos em `gabaritos/pedidos/agatha/` (`scripts/3d/pedidos/loja-agatha.json`); a referência da série em `gabaritos/referencias/loja-agatha-serie.webp`. **Quando chegar:** renomear a cena para "Loja da Agatha", estilo de piso novo (`texturas.json`), ambiente quente, névoa e fumaça de incenso, os mobis novos em `furni.ts` e a arrumação do pedido (estantes nas paredes do fundo, o balcão de 4 módulos no meio, o símbolo atrás, a tatuagem e a poltrona na frente); subir `SEDE_REV`. |
| `PROMPT-TECNOLOGIA.txt` (05/10) | `tecnologia-teste.zip` (a mesa em U desenhada inteira e recortada em fundo e pernas; a cadeira gamer) primeiro; depois `tecnologia-moveis`, `-cima` | Novo: a metade moderna da Central de Tecnologia (a metade retrô de hoje fica). Gabaritos em `gabaritos/pedidos/tecnologia/` (`scripts/3d/pedidos/tecnologia.json`). **Quando chegar:** os mobis novos e a arrumação (a retrô à esquerda, o U na direita com as cadeiras dentro, o rack, o painel de telas, a bagunça e as polaroids). |
| `PROMPT-PECAS-INTEIRAS.txt` (05/10) | `pecas-inteiras.zip`, `pecas-inteiras-cima.zip` | Novo. O Felipe prefere peças grandes e inteiras a módulos (as emendas saem tortas): a estante que pega a parede do Veríssimo, uma mesa grande no Arsenal (no lugar das 4 bancadas) e a cortina do leito em U, uma peça inteira com dois estados (o Felipe, 05/10): **aberta, dá para entrar; fechada, ninguém entra; fechada com alguém dentro, fica transparente**. **No código, quando chegar:** a cortina como a porta da cela (`openState`: fechada bloqueia as casas dela, aberta deixa passar) e com `xray`; o leito fica dentro, separado (o `canPlace` precisa aceitar o leito nas casas da cortina, como aceita móvel em cima do tapete). Gabaritos em `gabaritos/pedidos/inteiras/`. O balcão da Agatha também passou a ser uma peça inteira. |
| `PROMPT-BANCADAS.txt` (05/10) | `bancadas.zip`, `bancadas-cima.zip` | Novo. As bancadas brancas do laboratório (as mesmas da enfermaria) refeitas inteiras: a de parede de 4 casas, a curta de 2 e a de ILHA com os dois lados de frente (as do meio da sala apareciam pelas costas lisas). Gabaritos em `gabaritos/pedidos/bancadas/` (`scripts/3d/pedidos/bancadas.json`). **Quando chegar:** mobis novos (`lab_bench_long`, `lab_bench_short`, `lab_bench_island`, com as fichas no `moveis-laboratorio.json`) e trocar no Laboratório e na Enfermaria; aí, com o tampo limpo, pôr de volta os microscópios, frascos e monitores em cima (saíram em 05/10 porque a bancada de hoje já vem desenhada com coisas em cima). **Regra (o Felipe, 05/10): tampo limpo ou desenhado, nunca os dois.** (Um pedido de armários feito por engano foi para `_substituidas/`: o Felipe falava das bancadas; os armários estão ótimos.) |
| `PROMPT-FAZENDA.txt` (03/10) | `fazenda-teste.zip` primeiro; depois `fazenda-texturas`, `-predios`, `-natureza`, `-casa` e `calabouco` | Novo. |
| `PROMPT-PERSONAGENS.txt` (refeito em 04/10, chibi no traço do cenário) | `personagens-teste.zip` (a Catarina) primeiro; depois `personagens-8-direcoes` e `personagens-armados` | **Os 4 desarmados estão no jogo (05/10).** Falta a Parte 2 (armados). O pedido realista de 03/10 está em `_substituidas/`. |
| `PROMPT-ANIMACOES.txt` (04/10) | Depois da folha das 8 direções de cada agente aprovada. Um agente por vez (Catarina, Cora, Tepes, Alosi) e, de cada um: `animacoes-<agente>-teste.zip` (o `andar-desarmado-se`, para aprovar), depois `-andar`, `-andar-armado`, `-abrir`, `-pegar`, `-atacar`, `-cair`. Quadro a quadro, cada um feito a partir do anterior, com os gabaritos das tiras (`gabaritos/pedidos/gabarito-tira-*.png`, de `scripts/3d/pedidos/animacoes.json`). | Novo. Animação é o que o Códex mais erra: confira cada tira inteira no tabuleiro antes de seguir. |

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
