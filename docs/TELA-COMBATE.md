# Tela COMBATE

Referência: `docs/referencias/combate.webp` (1672×941, a mesma escala das telas MAPA e FICHAS: 1rem = 10 px). No git, com o emblema oficial coberto (a original fica só na máquina). A imagem é guia de **layout**: personagens e números vêm do motor e das nossas fichas.

A regra de cada coisa está em [`COMBATE.md`](COMBATE.md). A arte que falta está em [`CHECKLIST-TELA-COMBATE.md`](CHECKLIST-TELA-COMBATE.md).

## Quem usa (decidido em 30/09)

- **Só o mestre mexe nesta tela.** Escolhe as ações, move as peças e digita as rolagens: o d20 que ficou e a soma dos dados de dano.
- **Os jogadores só assistem**, na mesa (o tablet), ao tabuleiro acontecendo. Eles rolam os dados físicos e dizem o resultado.
- **Inimigos:** agem num turno só do mestre, com uma Iniciativa para o grupo, como no livro (LR p. 83 e 169).

## As regiões

Posições em pixels da referência (x e y do canto de cima à esquerda até o de baixo à direita).

| Região | Posição | O que tem |
|---|---|---|
| Barra do topo | 0,0 – 1672,80 | a mesma das outras telas, com COMBATE ativo |
| Ordem de iniciativa | 8,88 – 348,592 | rodada, uma linha por turno, e os botões Atrasar, Preparar e Passar turno |
| Efeitos e pendências | 8,602 – 348,932 | o que acontece sozinho no começo do turno e os efeitos com duração |
| Tabuleiro | 360,88 – 1338,460 | o cômodo da vez, com as marcações do combate |
| Resolução da ação | 360,468 – 1338,932 | quem age, as ações, os passos, arma, situação, rolagem e dano |
| Alvo | 1350,88 – 1664,530 | a ficha do alvo escolhido |
| Registro do combate | 1350,540 – 1664,932 | o que aconteceu, por rodada, e o botão de desfazer |

### Ordem de iniciativa

- **Cabeçalho:** "ORDEM DE INICIATIVA" e a etiqueta da rodada.
- **Uma linha por turno** (pitch de ~75 px): o valor da Iniciativa num quadradinho, o retrato, o nome e a etiqueta ("Agente" ou "Turno do mestre").
  - A vez de quem age fica destacada em vermelho, com "Sua vez" e a seta.
  - Ícones de estado, que saem sozinhos das condições: caído, morrendo 1/3, enlouquecendo 1/3, ritual sustentado, atordoado, inconsciente.
  - **Turno do mestre:** uma linha só, com os retratos dos seres do mestre lado a lado. Na vez dele, o mestre escolhe qual age, e cada um tem as próprias ações.
  - Quem chega depois entra marcado "a partir da rodada N+1".
- **Botões:** Atrasar, Preparar e Passar turno.
- **Menu do cabeçalho** (falta na referência): Encerrar combate e Pôr no combate (quem chega no meio).

### Efeitos e pendências

- **Começo do turno de quem age:** a lista da seção 4.3 do COMBATE.md: fim de efeitos, contadores (morrendo, enlouquecendo), ritual sustentado, dano e testes que se repetem (em chamas, sangrando, veneno, fumaça), cura acelerada, confuso.
- **Efeitos ativos de todos**, com quem, o quê e até quando: investida (−5 na Defesa até o próximo turno), finta, mira, ação preparada, condições com duração.
- Cada linha que pede algo tem o botão da ação: "Pagar 1 PE", "Rolar Vigor", "Primeiros socorros".

### Tabuleiro

- **O mesmo tabuleiro da tela MAPA**, no cômodo de quem age. Quando a vez passa para alguém em outro cômodo, a câmera vai junto.
- **Peças** com a base na cor do lado: agentes em ciano, inimigos em vermelho, neutros em cinza.
- **Marcações do combate:**
  - **anel de alcance da arma escolhida** (o alcance e, mais fraco, o dobro, com −5). Na referência o anel diz "curto 9 m"; o certo é o alcance da arma;
  - **casas ao alcance do movimento**, com a diagonal e o terreno difícil contando em dobro, quando a aba MOVIMENTO está aberta;
  - **linha até o alvo**, com a distância e a categoria ("7,5 m · curto");
  - **escudo** no ponto em que a linha passa por mobi ou parede (cobertura +5), e o aviso de cobertura total;
  - **mira** no alvo, e marcas de flanqueando e de alvo em corpo a corpo;
  - **área** de ritual ou granada (esfera, cone, linha, cubo), com os seres dentro destacados;
  - **estados na peça:** deitada (caído, inconsciente), caveira (morrendo), círculo de símbolos (ritual sustentado ou em conjuração).
- **Barra do canto:** Alcance (liga o anel), Medir (dois pontos, dá metros e categoria), Área (escolhe o formato), Tática (a vista de cima) e Centralizar (câmera em quem age).
- **Vista tática (03/10):** o botão Tática (ou a tecla T) leva a câmera do isométrico até em cima: ela gira e sobe, a sala vira maquete no caminho e chega num mapa de batalha visto de cima, com a grade de 1,5 m (2×2 casas), os móveis no tamanho de verdade e mais escuros quanto mais cobrem (0,8 m dá cobertura, 1,8 m tapa como parede), e as peças como fichas redondas: o retrato, o anel na cor do lado, o PV em arco, quem está na vez brilhando, a mira no alvo. Todas as marcações acima valem lá em cima, e o clique também (escolher a peça, andar, as ferramentas). A escolha fica na cena e a mesa acompanha. O desenho fica em `client/src/render/mapaTatico.ts`.
- **Faixa de baixo:** o clima da cena que pesa na regra (iluminação e camuflagem, névoa, terreno difícil, clima). Clicar abre o ☀ Clima da cena.
- **Mexer:** clicar numa peça escolhe o alvo; arrastar a peça de quem age gasta o movimento (as casas contam no turno).

### Resolução da ação

- **Faixa de quem age:** retrato, nome, classe e NEX; barras de PV, PE e SAN; Defesa; deslocamento; "Limite de PE: 4 · gasto: 0"; etiquetas do turno: Padrão, Movimento, Completa e Reação (livre, usado ou disponível).
- **Abas de ação:** Atacar, Manobra, Ritual, Habilidade, Item, Movimento e Outras (as ações das seções 5.2 a 5.5 do COMBATE.md).
- **Passos:** mudam com a ação.
  - Atacar: Ação, Arma, Alvo, Reação do alvo, Rolagem, Dano, Confirmar. "Reação do alvo" só aparece quando o alvo é agente com a perícia treinada e a defesa da rodada livre (ameaças não usam esquiva nem bloqueio).
  - Manobra: Ação, Manobra, Alvo, Teste oposto (dois resultados), Efeito, Confirmar.
  - Ritual: Ação, Ritual e forma, Alvo ou área, Resistências (uma por alvo), Dano ou efeito, Custo do Paranormal, Confirmar.
  - Movimento: Ação, Caminho no tabuleiro, Confirmar.
- **Cartões do ataque:**
  1. **Arma:** os ataques que o motor calcula para a ficha (teste, dano, crítico, alcance, notas e penalidades), com o ataque desarmado sempre na lista.
  2. **Situação:** as situações da Tab. 4.4 e as outras da seção 7.1 do COMBATE.md, cada uma com a chave liga/desliga e o ícone de "visto no tabuleiro". O CRONA liga sozinho o que detecta (cobertura, alcance, flanqueando, alvo em corpo a corpo, alvo desprevenido por conjurar ritual longo, camuflagem pela iluminação), e o mestre corrige.
  3. **Rolagem:** "Role Nd20, fique com o maior, +B", o campo "d20 que ficou", "Total contra Defesa" e o carimbo do resultado: ERROU, ACERTO ou ACERTO CRÍTICO ×N (20 natural sempre acerta). A chance de falha (camuflagem) aparece quando existe.
- **Dano:** "Role XdY (crítico ×N) e some +Z", o campo "soma dos dados", a conta (metade pela resistência, vulnerável, RD), "PV a → b" e o que vem junto: concentração de quem conjura, dano massivo, machucado, morrendo.
- **Botões:** Desfazer (volta um passo) e Confirmar ação (aplica e escreve no registro).

### Alvo

- **Ameaça:** retrato, nome, "Ameaça · tipo · VD", PV com a marca do machucado, Defesa, Fortitude, Reflexos e Vontade, RD, imunidades e vulnerabilidades, presença perturbadora e as condições com duração.
- **Agente como alvo:** PV, PE e SAN, Defesa, esquiva e bloqueio (disponíveis ou usados na rodada) e as condições.

### Registro do combate

- Filtro (Todos, Ataques, Dano, Condições, Turnos), separador de rodada e linhas curtas com a hora.
- "Desfazer último" volta a última ação confirmada, com tudo o que ela mudou.

## Estados da tela (sem referência: mesmo estilo)

1. **Sem combate:** o botão "Abrir combate nesta cena" e as peças do cômodo.
2. **Montar o combate:** participantes e lado de cada um, quem está ciente (os outros ficam surpreendidos), a Iniciativa de cada agente e a do grupo do mestre (já com o menor bônus), e o desempate.
3. **Em combate:** a referência.
4. **Fim:** o resumo (quem caiu, o que acabou com a cena, a munição gasta) e o aviso do que está em aberto (morrendo ou enlouquecendo).

## Ajustes sobre a referência

- O anel de alcance é o da arma escolhida, com o dobro mais fraco.
- A Situação detecta também o alvo desprevenido (ritual longo, surpreendido, não percebe o atacante) e o alvo em corpo a corpo com qualquer inimigo, mesmo caído.
- O passo "Reação do alvo" some quando o alvo é ameaça.
- Pôr no combate, tirar do combate e encerrar ficam no menu que abre no botão da rodada (cabeçalho da iniciativa); tirar e pôr aparecem também no painel Alvo.
- O painel Alvo mostra presença perturbadora e vulnerabilidades (criatura) ou esquiva e bloqueio (agente).

## A mesa durante o combate (proposta)

O tablet continua só com o tabuleiro, e mostra o que é público: de quem é a vez, a linha do ataque, a área do ritual, as peças caídas e o carimbo do resultado (ERROU, ACERTO, CRÍTICO). Números e fichas das ameaças não aparecem (COMBATE.md, DC-4).

## Ordem de construção

A das etapas do COMBATE.md (seção 25). A tela nasce na etapa A, com a iniciativa, os turnos, o registro e o desfazer, e cada etapa acende a sua parte da tela.

### O que a tela já faz (30/09)

- **Montar:** as peças da campanha (as da cena primeiro), com incluir, lado, "Percebeu"/"Surpreendido" e a Iniciativa de cada agente (com o que ele rola, pela ficha). O grupo do mestre tem uma Iniciativa só. Empate que sobrou pede quem vai antes.
- **Ordem de iniciativa:** a vez em vermelho, quem já agiu mais apagado, o estado mais importante de cada um (morrendo n/3, enlouquecendo n/3, surpreendido, chega na rodada n, ritual sustentado, caído, outras condições, ação preparada, machucado). Atrasar, Preparar e Passar turno; o botão da rodada abre o menu (pôr e tirar do combate, encerrar).
- **Efeitos e pendências:** o que aconteceu sozinho no começo do turno, o que a última ação pediu (dano massivo), morrendo e enlouquecendo (com a DT do socorro), ritual sustentado (Pagar 1 PE, Encerrar), caído (Levantar), em chamas, sangrando, surpresa, quem chega e as ações preparadas (Usar agora).
- **Resolução da ação:** a faixa de quem age (PV, PE, SAN, Defesa, deslocamento, "Limite de PE · gasto", padrão, movimento e reação) e as abas.
  - **Atacar:** os passos acendem conforme a resolução. 1. Arma (da ficha do agente ou da ficha da ameaça): ataca só a que está na mão; a da mochila aparece apagada, com "Sacar" (ação de movimento). 2. Situação, com o que o tabuleiro viu ligado (olho): alcance, cobertura, camuflagem pela escuridão e pela névoa, alvo em corpo a corpo, flanquear, posição elevada e as condições do alvo e de quem ataca; o mestre corrige nas chaves. 3. Rolagem: a defesa especial do alvo (esquiva, bloqueio), "Role Nd20…", o d20 que ficou, o total contra a Defesa, o d10 da camuflagem e o carimbo (ERROU, ACERTO, ACERTO CRÍTICO ×N). 4. Dano: "Role XdY (crítico ×N) e some +Z", a soma dos dados, RD, imunidade e vulnerabilidade, PV a → b, dano massivo. Desfazer volta um passo; Confirmar ação aplica o dano na peça e escreve no registro.
  - **Manobra:** 1. Manobra (agarrar, derrubar, desarmar, empurrar, quebrar, atropelar; soltar-se para quem está agarrado; esmagar e soltar para quem agarra). 2. Teste oposto: a arma corpo a corpo de quem faz contra a Luta do alvo, com tamanho, corrente, condições, flanquear e posição elevada nas chaves. 3. Rolagem: os dois d20 e o carimbo (VENCEU POR N, RESISTIU, EMPATE). 4. Efeito: a condição, o empurrão (a peça anda em linha reta até a primeira casa bloqueada), o dano do esmagar e o dano no objeto (Tab. 4.5).
  - **Ritual:** 1. Ritual e forma (as travadas dizem por quê; "Outro ritual" à mão, para ameaças). 2. Alvos (o escolhido, a área desenhada ou nenhum) e a resistência de cada um, com o elemento contra o da criatura. 3. Efeito: os dados do dano, a soma, a conta de cada alvo e a condição de quem falhou. 4. Concentração e Custo do Paranormal (Ocultismo; Medo sem teste). Confirmar gasta a execução e o PE.
  - **Habilidade:** gasta o PE (com o limite do turno) e escreve no registro. **Outras:** primeiros socorros e acalmar perguntam se passou e deixam com 1 PV ou 1 de SAN; jogar-se no chão e apagar as chamas mexem na condição. **Movimento:** levantar tira o caído. As outras ações declaram e gastam a ação.
- **Alvo:** clique numa peça ou num nome da ordem. Agente: PV com a marca de machucado, Defesa, esquiva e bloqueio, resistências e RD. Ameaça: a ficha rápida (lápis do cabeçalho): "Do livro" escolhe uma das 74 ameaças do livro de regras e preenche tudo, PV incluídos; ou preenche à mão tipo, VD, tamanho, elemento, presença perturbadora, Defesa, Fortitude, Reflexos, Vontade, RD, imunidades, vulnerabilidades e ataques (com os ×N). O painel mostra a página do livro e a RD numa linha, como no livro; o PV marca-se clicando na barra. Condições com "+ Condição" e ×.
- **Tabuleiro:** base na cor do lado, peça caída deitada, caveira em quem está morrendo, círculo de quem sustenta ritual, anel de alcance da arma (com a etiqueta no pé de quem ataca), linha até o alvo com a distância, escudo da cobertura e mira. Medir (dois pontos) e Área (esfera, cone, linha, cubo, com quem está dentro). O clima traduzido para a regra.
- **Registro:** filtro, destaque em vermelho (acerto, crítico, machucado), notas (lápis) e Desfazer último, que devolve também o dano.
- **Mesa:** a rodada, a vez e a ordem; bases por lado, caídos e morrendo; e, a cada ataque, a linha até o alvo e o carimbo por alguns segundos.
- **Ainda não:** movimento contado em casas e terreno difícil (etapa B), as habilidades comuns das ameaças no automático e os aliados (resto da etapa H), itens e perigos (etapa I), a conjuração complexa (etapa J).

## A tela nova (cards, 21/10)

Pedido do Felipe: "para batalhas ainda vamos usar as miniaturas". A aba COMBATE perde o tabuleiro (a mesa e o tablet continuam mostrando o tabuleiro como antes) e vira **cards**, na mesma escala 1672x941. A chave **Tela de hoje / Tela nova** fica na ponta da barra de baixo; a tela nova é a padrão e a de hoje segue inteira.

| Região | O que tem |
|---|---|
| Faixa da iniciativa (topo) | A mesma de hoje: cartas baixinhas e compridas, arrastar para o lado, Atrasar, Preparar, Passar turno e o menu da rodada. Com fotos. |
| **Esquerda: quem age** | Foto grande, nome, classe e NEX (ou criatura e VD), lado, PV, PE e SAN, Defesa e de que ela é feita, deslocamento e as condições (sempre à vista). Seções que abrem e fecham, uma por vez: Neste turno (padrão, movimento, reação, postura, limite de PE e gasto), Ataques, Poderes e rituais que gastam PE, Resistências. |
| **Meio: o menu da vez** | Um passo por tela, com a trilha no topo (os passos feitos voltam): 1 O que vai fazer?, 2 Com o quê? (armas, jogadas, Investida, Manobra, Ritual), 3 Contra quem? (cartões grandes: foto, nome, PV com barra, Defesa; no ritual, um alvo, uma área ou sem alvo), 4 Rolagem (d20, d10 da camuflagem, distância opcional, reação do alvo, "Situação e ajustes" numa gaveta fechada) e 5 Resultado (o dano, a conta, PV de antes e depois, Confirmar). No turno do mestre com vários seres, o seletor de quem age fica no topo. |
| **Direita: o alvo** | Aparece com o alvo (e acende ao passar o mouse nos cartões do passo 3): foto, nome, PV com a marca de machucado (clicar muda), PE e SAN do agente, Defesa e como é feita, Esquiva e Bloqueio, condições, Resistências (Fortitude, Reflexos, Vontade), RD, imunidades, vulnerabilidades, presença perturbadora e, na ameaça, os ataques e a ficha rápida (lápis). Sem alvo: o convite "Escolha o alvo no menu". |
| Barra de baixo | Efeitos e pendências (com o número), Registro (uma página por vez), Desfazer e a chave. As abas abrem uma gaveta por cima das colunas. |
| Preparo | Dois cards grandes: **Marcados** (os agentes, com ficha) e **NPCs e ameaças**, com a caixa de marcar, o lado, Percebeu ou Surpreendido e a Iniciativa de cada um (a do grupo do mestre em destaque), e o botão "Confirmar e começar". As peças da cena já vêm marcadas. |

- **Abinha "O que é isso?"** (botão "i"): ataques, rituais, poderes e manobras abrem o detalhe no padrão da tela do jogador.
- **Alvo:** persiste entre os turnos (decisão do Felipe) e se troca pelo passo 3. Não se clica mais no mapa.
- **Movimento:** só se declara (com os metros, se quiser); a miniatura anda na mesa. A Investida continua (a conta é a mesma), mas a peça não anda; **empurrão, "andar até o alvo", o chão perto e o passo pelas sombras** dependiam do mapa e não existem na tela nova.
- **O mapa fica livre:** com a tela nova o combate não trava peça nenhuma no MAPA e na mesa.
- **Sem rolagem:** tudo cabe na escala (que encolhe com a janela); o excesso vira página ou seção. No tablet em pé (561 a 820 px) a tela aparece encolhida; no celular continua o aviso.
- Código: `combate.ts` (modo `modoCards`), `combateCards.ts`, `combateCards.css`; os assistentes (`combateAtaque.ts`, `combateManobra.ts`, `combateRitual.ts`) ganharam só a opção `semMapa`, a abinha e a gaveta de situações.

## Tela antiga arquivada (21/10)

A tela de hoje (o tabuleiro no meio, a gaveta Alvo, Efeitos e Registro, a trava de peças) **saiu do site, mas o código ficou**, para voltar melhorada: o Felipe pediu "tira do site, mas guarda no código".
- **Onde está:** `client/src/ui/combate.ts` (todos os ramos `modoCards ? ... : ...`, `renderAlvo`, `faixaAtor`, `montagem`, `atualizarMarcas`, `trocarTela`, `retratoDeCanvas`), e o CSS em `combateRapido.css`, `combate.css`, `hud.css` (que não foi mexido). A tela nova vive em `combateCards.ts` e `combateCards.css`, sob `.cb-modo-cards`.
- **Como religar:** no topo do `combate.ts`, `TELA_ANTIGA_DISPONIVEL = true`. A chave "Tela de hoje / Tela nova" volta à barra de baixo e a escolha fica no `localStorage` (`crona.combate.tela`). Lembrar: a tela antiga ainda mostra o "turno do mestre" no desenho da ordem; com o turno individual (21/10) cada ser do mestre já é uma carta da ordem, então o que for revivido da faixa precisa seguir isso.
- **Turno individual:** vale para as duas (é regra compartilhada em `shared/src/combate/turnos.ts`): cada ser do mestre tem o próprio turno, a Iniciativa pode ser igual e não há mais Iniciativa "do grupo". Combate salvo no formato antigo migra ao abrir.
