# Arte que falta: o que deixa a tela diferente da referência

As telas do CRONA foram montadas a partir das imagens de referência. A disposição, os textos, as barras, os botões, as molduras e a luz já estão no código. O que ainda deixa a tela diferente da referência é o que o código não desenha igual: **o retrato de um personagem, um ícone, o clipe, o papel manchado**. Esta é a lista dessas imagens, para produzir no GPT/Codex. Marque com `x` o que ficar pronto (`- [x]`).

**Foco agora: a tela** (painéis, menus, botões, ícones e retratos). O tabuleiro (móveis, pisos, peças) fica para depois, no fim da lista. **✱ = o que mais muda a tela: comece por esses.**

**Codex:** o passo a passo está no [`AGENTS.md`](../AGENTS.md#para-o-codex-comece-aqui).

## As referências

Estão no repositório, em [`docs/referencias/`](referencias/): são as imagens com que as telas foram montadas, e a lista abaixo foi feita comparando cada uma com a tela de 30/09.

| Tela | Arquivo | Tamanho |
|---|---|---|
| MAPA | [`referencias/mapa.webp`](referencias/mapa.webp) | 1672×941 |
| FICHAS | [`referencias/fichas.webp`](referencias/fichas.webp) | 1672×941 |
| FICHAS no celular | [`referencias/fichas-celular.webp`](referencias/fichas-celular.webp) | 941×1672 |
| COMBATE | [`referencias/combate.webp`](referencias/combate.webp) | 1672×941 |

Onde aparece a caixa tracejada **"emblema oficial (coberto)"**, ou uma mancha quadriculada, a imagem tinha o emblema ou um símbolo oficial de Ordem Paranormal. Ficou coberto porque o repositório é público: não tente reproduzir o que estava ali. Quando a lista pedir uma marca nesse lugar (a marca d'água do papel, o selo, o sigilo), crie uma própria no mesmo clima.

## Como entregar

- Tudo em `client/public/arte/`, com **o nome exato** da lista (minúsculas, sem acento, hífen no lugar do espaço). "Entra sozinho" = o jogo já procura o arquivo e usa na hora; o resto o Claude encaixa quando chegar.
- **PNG com fundo transparente de verdade** (sem xadrez pintado, sem fundo branco), **sem texto e sem números**, **sem sombra em volta** (o jogo faz a sombra). Tamanhos já no dobro.
- **Ícones:** 128×128, traço branco (ou branco com a cor indicada), o mesmo peso de traço em todos, sem quadrado atrás (o jogo desenha o quadrado escuro).
- Branch `codex/arte-<assunto>`, commit das imagens (e do `- [x]` nesta lista), pull request para `main`. Formatos em [`ARTE.md`](ARTE.md).
- Símbolos: crie os seus. O emblema e os símbolos oficiais de Ordem Paranormal não entram (o repositório é público).

**Estilo para pedir ao GPT, em tudo:** pixel art pintada de alta qualidade, clima de investigação paranormal, escuro, luz quente vinda de cima; papel envelhecido e rasgado; vermelho de destaque `#d8322f`; o mesmo traço das referências.

**As folhas de sprite de hoje** (`personagens/<nome>/folha.webp`) são a **arte de referência** de cada agente (decidido em 30/09): aparecem grandes na FICHAS e vão para a Hand do jogador. Não precisam de desenho novo.

---

## 1. Em todas as telas

- [ ] ✱ **Retrato de cada agente** (a maior diferença). Na referência é um busto pintado, olhando para a direita; hoje é um recorte pixelado da folha. Aparece nas cartas da MAPA, na lista PLAYERS, na lista de agentes da FICHAS e na ordem de iniciativa e no alvo do COMBATE. O mesmo personagem da folha de hoje, no mesmo estilo, ~1024×1536, **entra sozinho**:
  - `personagens/tepes/retrato-desarmado.png`, `personagens/catarina/retrato-desarmado.png`, `personagens/alosi/retrato-desarmado.png`, `personagens/cora-falcao/retrato-desarmado.png`
  - a mesma imagem de olhos fechados, `retrato-desarmado-olhos-fechados.png` (é o que faz piscar)
  - depois, se quiser: `retrato-armado.png`, `retrato-desarmado-machucado.png`, `retrato-armado-machucado.png` (e os de olhos fechados)
  - **Atenção:** nas referências, os nomes embaixo dos retratos às vezes estão trocados (na MAPA, D. Tepes e Alosi). Vale a folha de cada um: **D. Tepes** tem cabelo castanho comprido, barba e sobretudo marrom; **Alosi**, óculos redondos, cabelo castanho curto e jaqueta clara de capuz com cruz dourada; **Catarina**, cabelo ruivo preso, casaco preto comprido e katana nas costas; **Cora Falcão**, cabelo branco arrepiado, roupa tática preta e fuzil nas costas.
- [ ] ✱ **Papel dos painéis**: na referência tem manchas, rasgos, dobras e marca d'água; hoje é desenhado em código, mais liso. `interface/papel-painel.png`, 600×440, com 48 px de borda sem detalhe único (o jogo estica o meio). Serve para a FICHAS e o COMBATE.
- [ ] **Ícones da barra do topo** (hoje ícones de linha parecidos): `icones/topo-mapa.png` (mapa dobrado), `topo-combate.png` (espadas cruzadas), `topo-fichas.png` (crachá), `topo-clima.png` (sol), `topo-config.png` (engrenagem), `topo-registro.png` (documento), `topo-sair.png` (porta com seta, vermelho) e `topo-operacao.png` (a pena apagada ao lado de "Operação")

## 2. Tela MAPA

Pasta `interface/`:
- [ ] ✱ **Papéis de cada painel**: `papel-planta.png` 1080×640 (com a folha de trás aparecendo no canto), `papel-sala.png` 1080×370, `papel-objeto.png` 1080×580, `papel-rpg.png` 780×1580 (a folha grande da direita), `papel-inventario.png` 1170×300 e `carta-player.png` 740×320 (o cartão de cada personagem da lista PLAYERS)
- [ ] **Rosa dos ventos** a nanquim, com o "N": hoje é um desenho simples. `rosa-dos-ventos.png`, 180×180
- [ ] **Clipe de papel** de metal, prendendo a polaroid na planta: hoje é um traço. `clipe.png`, 52×124
- [ ] **Fita crepe** nos cantos dos papéis: hoje não tem. `fita-1.png`, `fita-2.png`, `fita-3.png`, ~160×44
- [ ] **Alfinete vermelho** de mapa, espetado na sala atual da planta: hoje não tem. `alfinete.png`, 40×56
- [ ] **Asas apagadas**, marca d'água no canto do painel do objeto: hoje não tem. `asas-marca.png`, 160×120
- [ ] **Pilha de papéis** no canto de baixo à direita (fichas velhas, fotos, carimbos próprios): hoje são três folhas lisas. `pilha-papeis.png`, 600×520

Ícones (pasta `icones/`):
- [ ] **AÇÕES**: `acao-examinar.png` (lupa), `acao-abrir.png` (caixa aberta), `acao-usar.png` (mão), `acao-entregar.png` (setas trocando)
- [ ] **Cartões da sala e dos players**: `local.png` (marcador de lugar), `andar.png` (camadas), `mais-opcoes.png` (os três pontos)
- [ ] **Lista "Contém" do objeto**: `conteudo-documento.png`, `conteudo-email.png`, `conteudo-banco-de-dados.png`
- [ ] **Ferramentas da mesa** (06/10, `PROMPT-FERRAMENTAS-MESA.txt`, [FERRAMENTAS-DA-MESA.md](FERRAMENTAS-DA-MESA.md)): `icones/mesa-apontar.png`, `mesa-desenhar.png`, `mesa-nevoa.png`, `mesa-mapa.png`, 128×128 · entram sozinhos; e a fumaça da névoa, `texturas/nevoa-mesa.png`, 512×512, que repete · entra sozinha

### Aba ITENS (a mochila de cada agente, referência `docs/ref-itens.jpg`)

Formato em [ARTE.md](ARTE.md) (Itens, "Arte pintada dos itens"). O que está marcado "entra sozinho" aparece na hora; o resto o Claude encaixa quando chegar.
- [ ] ✱ **Arte pintada de cada item** (a casa escura de EQUIPADO, MOCHILA e ITEM SELECIONADO): `itens/pintados/<id>.png`, 256×256 · entram sozinhos. Comece pelos que os agentes carregam: `corrente`, `katana`, `fuzil-de-caca`, `faca`, `arma-improvisada` (o pé de mesa), `protecao-leve`, `mochila-militar`, `celular`, `algemas`, `corda`, `isqueiro`, `cao-adestrado`, `granada-de-fumaca`, `granada-de-fragmentacao`, `kit-de-ladrao`, `componentes-ritualisticos-de-elemento`, `bandoleira`, `cranio-espiral`, `amuleto-sagrado`, `alarme-de-movimento`, `balas-longas`, `coagulante`
- [ ] ✱ **Itens do cenário pelo tipo**: `itens/pintados/tipo-documento.png`, `tipo-chave.png`, `tipo-carta.png`, `tipo-consumivel.png`, `tipo-midia.png` (pendrive, fita), `tipo-caixa.png`, `tipo-arma.png`, `tipo-item.png`, 256×256 · entram sozinhos. Os que têm desenho próprio vão pelo nome (`itens/pintados/chave-do-arsenal.png`)
- [ ] **Ícones dos contadores** do topo: `icones/tipo-consumiveis.png` (frasco escuro), `icones/tipo-chaves.png` (chave dourada), `icones/tipo-ritualisticos.png` (um sigilo próprio, vermelho: nunca um símbolo oficial), 64×64
- [ ] **Ícones dos botões**: `icones/item-usar.png` (engrenagem), `item-entregar.png` (pessoa), `item-mover.png` (quatro setas), `item-descartar.png` (lixeira), `item-empunhar.png` (mão), `item-guardar.png` (mochila), `item-abrir.png` (documento), `item-inspecionar.png` (lupa), `item-peso.png` (o peso do campo Espaços), 64×64, traço claro
- [ ] **Textura da casa do item**: `interface/casa-item.png` (o quadrado escuro com vinheta e borda gasta, 160×160) e `interface/casa-item-vazia.png` (a casa tracejada da mão livre e do "+")
- [ ] **Botões**: `interface/botao-item.png` (escuro) e `interface/botao-item-forte.png` (vermelho, o do Usar), 220×80, borda gasta; 24 px de borda sem detalhe único (o jogo estica o meio)
- [ ] **Chip de cada agente** na escolha do topo: `interface/chip-agente.png` (escuro) e `interface/chip-agente-on.png` (vermelho, o escolhido), 200×100
- [ ] **Marca d'água** bem apagada no fundo da aba, atrás das grades: `interface/marca-itens.png`, 300×300, um símbolo próprio (nunca o emblema oficial: o repositório é público)
- [ ] **Pilha no chão**, no tabuleiro, quando alguém larga um item: `moveis/pilha_chao.png`, a bolsa largada, pixel art na grade 1:1 (1 casa)
- [ ] **Retrato armado** de cada agente (`personagens/<nome>/retrato-armado.png`, formato na seção 1 do ARTE.md): sem ele, o retrato do PLAYERS mostra só um sinal da arma no canto

## 3. Tela FICHAS

- [ ] **O fundo atrás do personagem grande**: na referência é uma sala escura com caixas e luz fria de cima; hoje é azul liso. `interface/fundo-personagem.jpg`, 620×1140, bem desfocado
- [ ] ✱ **Ícones de PV, PE e SAN**: na referência são pintados e brilhantes; hoje são ícones de linha. `icones/pv.png` (coração vermelho), `icones/pe.png` (cérebro azul-claro), `icones/san.png` (espiral azul) · entram sozinhos
- [ ] **Atributos**: `icones/agi.png` (correndo), `for.png` (punho), `int.png` (cérebro com engrenagem), `pre.png` (olho), `vig.png` (escudo), brancos · entram sozinhos
- [ ] **Derivados**: `icones/defesa.png` (escudo com estrela), `deslocamento.png` (bota), `protecao.png` (colete), `resistencias.png` (escudo) · entram sozinhos
- [ ] **Títulos dos painéis** (o glifo no quadradinho escuro de cada título): `icones/titulo-identificacao.png`, `titulo-atributos.png`, `titulo-recursos.png`, `titulo-derivados.png`, `titulo-condicoes.png`, `titulo-pericias.png`, `titulo-poderes.png`, `titulo-rituais.png`, `titulo-equipamentos.png`, `titulo-inventario.png`, `titulo-companheiro.png`, `titulo-anotacoes.png`
- [ ] **Condições**: `icones/cond-normal.png`, `cond-machucado.png`, `cond-sangrando.png`, `cond-atordoado.png`, `cond-amedrontado.png`, `cond-envenenado.png`, `cond-inconsciente.png`, `cond-outro.png`
- [ ] **Poderes** (na referência, cada poder tem um glifo; hoje é uma estrela em todos): `icones/poder-origem.png`, `poder-classe.png`, `poder-trilha.png`, `poder-paranormal.png`
- [ ] **Sigilo de cada elemento**, no círculo do ritual aprendido (hoje só há o "+"): `icones/sigilo-sangue.png`, `sigilo-morte.png`, `sigilo-conhecimento.png`, `sigilo-energia.png`, `sigilo-medo.png`, sigilos próprios na cor do elemento · entram sozinhos
- [ ] **Botões de baixo**: `icones/botao-editar.png` (lápis), `botao-adicionar-item.png` (caixa), `botao-adicionar-ritual.png` (pentagrama próprio), `botao-salvar.png` (disquete), `botao-novo-agente.png` (mais)
- [ ] ✱ **Foto do companheiro**: na referência é o retrato do cão; hoje é uma pata. `companheiros/cao-de-guarda.png`, 300×360 · entra sozinho
- [ ] ✱ **Ícone de cada item**, na tabela de equipamentos e nos espaços do inventário: na referência cada item tem o seu desenho. Desde 03/10 a FICHAS usa a mesma arte pintada da aba ITENS (`itens/pintados/<id>.png`, 87 de 202 prontos; o resto no pedido de ícones do GPT) · entram sozinhos. Os que os agentes carregam:
  - armas: `fuzil-de-caca`, `katana`, `faca`, `corrente`, `arma-improvisada`, `granada-de-fragmentacao`, `granada-de-fumaca`, `balas-longas`, `bandoleira`
  - equipamento: `protecao-leve`, `mochila-militar`, `kit-de-ladrao`, `algemas`, `corda`, `celular`, `isqueiro`, `alarme-de-movimento`, `coagulante`, `cao-adestrado`
  - paranormal: `componentes-ritualisticos-de-elemento`, `amuleto-sagrado`, `cranio-espiral`
  - e `desarmado` (punho fechado, o ataque desarmado)
- [ ] **Pilha de papéis** do canto de baixo à esquerda: `interface/pilha-papeis-2.png`, 600×520

## 4. FICHAS no celular

Nada novo: usa os retratos, os ícones e as folhas da FICHAS. Os cartões de resumo ilustrados da referência (dados, grimório, maleta, fotos) só entram se um dia a tela do celular for por cartões.

## 5. Tela COMBATE

- [ ] ✱ **Retrato das ameaças**: na referência o Ocultista é um retrato pintado, de capuz; hoje é o avatar padrão. `personagens/<id>/retrato-desarmado.png`, no estilo dos retratos dos agentes (o Claude cadastra cada ameaça que chegar)
  - `ocultista`: encapuzado, rosto pálido e marcado
  - `acolito`: encapuzado mais jovem, capa escura
  - e as outras ameaças da Operação Fulgor (Felipe diz quais)
- [ ] ✱ **Carimbo do resultado**: na referência é um carimbo de borracha de verdade, com a tinta falhada e um selo redondo atrás; hoje é uma borda desenhada. `combate/carimbo.png`, 520×280, moldura vermelha **sem texto** (o jogo escreve ERROU, ACERTO ou ACERTO CRÍTICO ×3), e `combate/selo.png`, 200×200, o selo redondo de tinta (símbolo próprio)

Ícones (pasta `icones/`):
- [ ] **Turno**: `combate-atrasar.png` (ampulheta), `combate-preparar.png` (escudo), `combate-passar-turno.png` (avançar)
- [ ] **Abas das ações**: `combate-atacar.png` (espadas cruzadas), `combate-manobra.png` (mãos agarrando), `combate-ritual.png` (pentagrama próprio), `combate-habilidade.png` (engrenagem), `combate-item.png` (bolsa), `combate-movimento.png` (bota), `combate-outras.png` (três pontos)
- [ ] **Situação**: `situacao-cobertura.png` (mesa ou muro), `situacao-alcance.png` (seta tracejada), `situacao-iluminacao.png` (sol), `situacao-corpo-a-corpo.png` (punho)
- [ ] **Rolagem e dano**: `combate-dado.png` (um d20), `combate-desfazer.png` (seta voltando), `combate-confirmar.png` (visto)
- [ ] **Barra do tabuleiro**: `tabuleiro-alcance.png` (mira), `tabuleiro-medir.png` (régua), `tabuleiro-area.png` (quadrado tracejado), `tabuleiro-centralizar.png` (alvo)
- [ ] **Clima**: `clima-iluminacao.png` (sol), `clima-nevoa.png` (vento), `clima-terreno.png` (montanha)
- [ ] **Estados na ordem e nas pendências**: `estado-ok.png` (visto verde), `estado-morrendo.png` (caveira no escudo, vermelha), `estado-ritual.png` (pentagrama próprio, âmbar), `estado-caido.png` (pessoa deitada)
- [ ] **Ícone da arma** nos cartões da coluna ARMA: os mesmos `itens/<id>.png` da FICHAS (o fuzil de caça da referência é `itens/fuzil-de-caca.png`)

---

## 6. Tela de entrada (07/10)

Três imagens inteiras, uma por tema (fantasia, horror, cyberpunk), cada uma no computador e no celular: a tela de hoje editada, com outra mesa, outra luz e outra vista na janela, e as miniaturas pintadas na cena. O pedido pronto é o [`PROMPT-ENTRADA.txt`](PROMPT-ENTRADA.txt); como a tela usa, em [`TELA-ENTRADA.md`](TELA-ENTRADA.md#as-imagens-dos-temas).

- [x] ✱ fantasia (computador / celular), entregue em 07/10
- [x] ✱ horror (computador / celular), entregue em 07/10
- [x] ✱ cyberpunk (computador / celular), entregue em 07/10
- [x] as seis cidades da janela (normal e com neve), entregues em 07/10

## O tabuleiro (revisto em 02/10)

- [ ] ✱ **Catarina nas 8 direções** (`PROMPT-PERSONAGENS.txt`, Parte 0): entregue em 04/10 (`personagens-teste.zip`) e já convertida para o tabuleiro (`personagens/catarina/tabuleiro-32bits/`). **Esperando a aprovação do Felipe** (perto da Alosi, ela ficou com umas 6 cabeças de altura em vez de 7).
- [ ] ✱ **As interações de cada agente** (`PROMPT-PERSONAGENS.txt`, Parte 5; formato no [ARTE.md](ARTE.md), "As interações do agente"):
  - andar, nas 8 direções;
  - abrir porta e armário;
  - pegar item;
  - atacar com a arma de cada um;
  - cair e caído.

  Um zip por agente.

- [ ] ✱ **A folha das 8 direções de cada agente, no estilo de proporção real** (a Alosi de jaqueta creme de 02/10): `personagens/<nome>/oito-direcoes.png`, grade 4×2, parado, braços um pouco afastados do corpo, mesmo tamanho em todas as casas, fundo transparente. O formato está no [ARTE.md](ARTE.md) ("Folha das 8 direções"). Dela sai o boneco que anda no tabuleiro. **Primeiro a Alosi**, depois Tepes, Catarina e Cora.
- [x] **Folha de objetos 1** (`mobiliario/props-ordo-realitas.png`, Códex): 11 móveis no jogo (a lista está no [SEDE-DA-ORDEM.md](SEDE-DA-ORDEM.md)).
- [x] ✱ **O bar, um móvel por folha, nos 4 giros** (`mobiliario/folhas/<nome>.png`, formato no [ARTE.md](ARTE.md), "Móvel nos 4 giros"; a lista no [SEDE-DA-ORDEM.md](SEDE-DA-ORDEM.md), "Bar"): todos os móveis, os itens de parede (relógio, arandela, TV, ventilador), o tapete gasto e as texturas de chão e parede. **Falta:** o tapete persa (`rug_ornate`, visto de cima) e as costas da geladeira amarela, do expositor e do frigobar.
- [ ] ✱ **A Enfermaria, um móvel por folha, nos 4 giros** (a lista no [SEDE-DA-ORDEM.md](SEDE-DA-ORDEM.md), "Enfermaria"): leito, divisória, armário de remédios, suporte de soro, pia, bancada, carrinho, mesa do posto, cadeira de escritório, arquivo de aço, monitor de sinais vitais, bandeja de remédios, monitor de computador, luminária fluorescente; a luz de emergência (parede); o chão de lajotas e a parede de azulejo.
- [ ] ✱ **Folha de objetos 2: Salão** (`mobiliario/folha-2.png`; os do bar saíram daqui, vêm um por folha), no estilo da folha 1, frente para baixo à esquerda. Largura × fundo em casas de 0,75 m, altura em metros:
  mesa de reunião (`table_meeting`, 3×2, 0,8), cadeira estofada vermelha (`chair_red`, 1×1, 0,46 de assento), poltrona de couro (`armchair_leather`, 1×1), poltrona (`armchair`, 1×1), banqueta (`stool`, 1×1, 0,55), mesa redonda (`table_round`, 2×2, 0,76), banco de madeira (`bench`, 2×1)
- [ ] ✱ **Folha de objetos 3: Laboratório e Enfermaria** (`mobiliario/folha-3.png`): bancada de laboratório (`lab_bench`, 2×1, 0,8), frascos (`flasks`, 1×1, 0,4), suporte de soro (`iv_stand`, 1×1, 1,9), divisória hospitalar (`divider`, 1×1, 1,6), armário de remédios (`medical_cabinet`, 2×1, 1,9), pia (`sink`, 1×1, 0,9), vaso sanitário (`toilet`, 1×1), carrinho de laboratório (`trolley`, 1×1, 0,95), mesa metálica (`desk_metal`, 2×1, 0,8), monitor (`monitor`, 1×1, 0,55), microscópio (`microscope`, 1×1), tanque de contenção (`tank`, 2×2, 2,2)
- [ ] **Folha de objetos 4: Arsenal, Prisão e Rituais** (`mobiliario/folha-4.png`): armário de metal (`locker`, 1×1, 2,1), armário de armas (`weapon_rack`, 2×1, 2,0), caixa metálica (`crate_metal`, 1×1, 0,8), baú militar (`chest_military`, 2×1, 0,7), barril (`barrel`, 1×1, 1,0), velas (`candles`, 1×1, 0,35), candelabro (`candelabra`, 1×1, 1,6), altar de pedra (`altar`, 2×1, 1,0, sigilos próprios), mesa de trabalho (`table_work`, 3×2, 0,78), balcão de madeira (`counter_wood`, 2×1, 0,9), mesinha (`table_small`, 1×1, 0,7)
- [ ] **Costas dos assentos** (`mobiliario/folha-1-costas.png` e `folha-2-costas.png`): as cadeiras, poltronas e sofás das folhas 1 e 2 girados de meia-volta, na mesma ordem
- [ ] Pisos e paredes no mesmo estilo: o formato entra no [ARTE.md](ARTE.md) quando o jogo aceitar textura de piso
- [x] **Vista de cima do Bar** (teste do mapa tático, 03/10): os 19 móveis, a parede de madeira e as duas fichas, no formato do [ARTE.md](ARTE.md) ("Vista de cima").
- [ ] **Vista de cima das outras 11 salas da Sede**, uma parte por sala, com a parede do piso de cada uma (o pedido completo está na pasta da arte do GPT).
- [ ] **Prisão: a porta de aço da cela** (`mobiliario/folhas/porta-cela-aco-fechada.png` e `-aberta.png`, "Móvel nos 4 giros"): 0,75 × 0,12 × 2,2 m, chapa de aço com visor gradeado e portinhola; aberta, a folha gira 90° e encosta no batente. Hoje é desenhada por código.

## Fazenda Olhos de Águia e o calabouço (03/10)

O pedido completo, peça por peça, com as medidas, está na pasta da arte do GPT, em `PROMPT-FAZENDA.txt`. As referências ficam em `gabaritos/fazenda-hoje/` (a fazenda no jogo hoje) e `gabaritos/referencia-calabouco-filmagem.png`. Os móveis seguem o formato "Móvel nos 4 giros" do [ARTE.md](ARTE.md), e as texturas, o formato "Chão e parede". O Claude encaixa tudo (fichas do `scripts/3d/moveis.py` e o `texturas.json`).

- [ ] ✱ **Teste** (`fazenda-teste.zip`): `piso-grama.png`, `cerca-madeira.png`, `fardo-feno.png`, `arvore.png`
- [ ] **Texturas** (`fazenda-texturas.zip`): estrada, terra arada, pedra clara, terra do celeiro, parede do celeiro, tábuas do píer, chão e parede do calabouço
- [ ] **Prédios e pátio** (`fazenda-predios.zip`): casarão, celeiro, casa de mantimentos, porteira (fechada e aberta), chafariz, placa
- [ ] **Natureza e lavoura** (`fazenda-natureza.zip`): mais duas árvores, dois arbustos, milharal, canteiro, sacas de grão, carroça
- [ ] **A casa e os galpões por dentro** (`fazenda-casa.zip`):
  - **cozinha e sala de jantar:** fogão a lenha (apagado e aceso), pia, guarda-louça, mesa da cozinha, mesa de jantar;
  - **quartos:** camas de casal e de solteiro (três colchas), guarda-roupa, cômoda, criado-mudo;
  - **banheiro:** banheira;
  - **galpões:** estante do depósito, cerca da baia, meia parede de madeira;
  - **casarão:** o vão da escada.
- [ ] ✱ **O calabouço** (`calabouco.zip`): alçapão aberto, escada de mão, tanque com corpo (três modelos), mesa de contenção, pilha de crânios, tocha de parede, estandarte

## Para depois: o tabuleiro

- [x] **Tepes — quatro poses idle de referência em estilo 32 bits, com luz neutra:** `personagens/tepes/tabuleiro-32bits/idle-desarmado.png`, `idle-armado.png`, `idle-armado-machucado.png`, `idle-desarmado-machucado.png` (PNG RGBA, 1024×1536). Imagens estáticas escolhidas por Felipe, no modelo realista; ficam no tabuleiro (a pose muda com o Armado e com os PV) até chegarem as chibi. Formato em [ARTE.md](ARTE.md).
- [ ] **Os quatro agentes no modelo chibi** (decidido em 30/09): as 8 direções nos 4 estados, `personagens/<nome>/tabuleiro-32bits/idle-<estado>-<direção>.png`, na grade 1:1 do [ARTE.md](ARTE.md). Uma imagem por agente e estado, com as 8 direções numa grade 4×2 (a ordem está no ARTE.md, "Poses do tabuleiro"); pode vir como saiu do gerador: o construtor recorta, reduz e monta os quadros de andar com `npm run arte:poses`. **Feito:** Alosi, desarmado (01/10). **Falta:** Alosi armado e machucada; Catarina, Cora e Tepes.

- [ ] ✱ **O andar desenhado da Alosi, quadro a quadro:** 8 imagens, uma por direção (`andar-desarmado-<direção>.png`), cada uma com os 8 quadros do ciclo lado a lado, no formato do [`ARTE.md`](ARTE.md) ("Andar desenhado quadro a quadro"). Pode vir como saiu do gerador; o construtor recorta, reduz e encaixa.
- **Animações de cada agente para o tabuleiro:** modelo chibi, grade 1:1. O boneco (`npm run arte:boneco`, `scripts/boneco.py`) faz o parado respirar e piscar a partir das 8 direções paradas, e encaixa o andar desenhado quando ele chega (até lá, um andar provisório montado das peças). **Feito:** Alosi desarmada, parada (02/10). Faltam o andar desenhado de cada agente e as poses de caído e atacando que a referência do COMBATE mostra; o formato delas entra no [`ARTE.md`](ARTE.md) antes de ser feito.
- **Folha das ameaças para o tabuleiro** (`ocultista`, `acolito`...), no mesmo formato novo.
- **A Sala de Tecnologia** (o cômodo das referências), pasta `moveis/`, pixel art chibi na grade 1:1 (casa de 64×32 pixels de arte, 1 m ≈ 58), frente e `_costas`: `console` (e desligado), `chair_office`, `fluorescent` (e aceso), `portal`; e as texturas `pisos/carpete.png` (64×32) e `paredes/tijolo-escuro.png` (128×128). Formato em [`SEDE-DA-ORDEM.md`](SEDE-DA-ORDEM.md).
- **As marcações do combate no chão:** `combate/base-agente.png` e `base-inimigo.png` (256×128, o anel de luz embaixo da peça) e `combate/circulo-ritual.png` (512×256, o círculo de quem sustenta ritual).
- **Os outros cômodos da Sede** (bar, prisão, laboratório...): lista em [`SEDE-DA-ORDEM.md`](SEDE-DA-ORDEM.md).
