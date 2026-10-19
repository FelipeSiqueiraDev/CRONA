# Regras do CRONA (Ordem Paranormal RPG)

Mapa das regras que o CRONA segue e do que cada uma muda no personagem e no tabuleiro. Serve para construir item a item: cada parte nova de regra começa por aqui, e o que for decidido volta para cá.

## Como o CRONA usa as regras

- **Tudo do jogo fica no CRONA:** fichas, regras, dados e regras da casa. O C.R.I.S (o sistema do mestre) serviu só de referência para entender o sistema de RPG e como tratá-lo aqui. O CRONA não depende dele: não lê o banco de lá e não importa código nem arte (nem o tabuleiro CRONA nem as folhas de sprite).
- **Fontes, nesta ordem:**
  1. o livro de regras de Ordem Paranormal RPG (2022). As páginas citadas são o número impresso no rodapé. O PDF usado é a versão 1.0; se a edição impressa da mesa disser outra coisa, vale a da mesa;
  2. as regras da casa da mesa (seção 12);
  3. como o C.R.I.S resolveu cada conta (`src/systems/ordem-paranormal/`), só como referência.
  - *Sobrevivendo ao Horror* (origens, rituais e regras extras): o PDF é só imagem, sem texto. O que a mesa usar dele entra aos poucos, quando chegarmos lá.
  - Fica de fora, por decisão do mestre: a classe Sobrevivente do *Sobrevivendo ao Horror* (sobe por estágio, não por NEX).
- **Ninguém rola dado no CRONA.** Os jogadores rolam na mesa. Quando o CRONA precisa de um resultado (um ataque, um teste de resistência), o mestre digita o d20 que ficou, como no C.R.I.S.
- **O CRONA faz as contas e guarda o estado** (ficha, condições, turno, mochila). O tabuleiro mostra o efeito.
- **As regras ficam em código próprio:** `shared/src/regras/`, em TypeScript puro e sem tela, com testes em `server/test/`. O servidor aplica as regras; a interface mostra e pede.
- **Direitos autorais:** o texto do livro é protegido e este repositório é público. Aqui entram só resumos com nossas palavras, números e tabelas de regra. Descrições de poderes, rituais, itens e criaturas não entram no repositório: o CRONA guarda nome, números e a página do livro.

## O que muda no personagem e no tabuleiro

"Já tem" = funciona hoje. "Proposta" = entra na etapa indicada da ordem de construção.

| Regra | Personagem (retrato, carta, ficha) | Tabuleiro | Situação |
|---|---|---|---|
| Machucado: PV abaixo da metade | retrato machucado, respiração irregular e calma | — | já tem |
| 0 PV: inconsciente e morrendo | respiração de quem está morrendo, marca "Morrendo" | peça deitada, sem andar nem agir; no combate, 3 turnos até morrer | retrato já tem; o resto é proposta (2 e 6) |
| Perturbado: SAN abaixo da metade | respiração rápida | — | já tem |
| Enlouquecendo: SAN 0 | respiração rápida; 3 turnos até ficar insano (vira personagem do mestre) | — | retrato já tem; contagem é proposta (6) |
| PE abaixo da metade (regra só do CRONA: o livro não dá penalidade) | respiração lenta | — | já tem |
| Arma empunhada | retrato e sprite armados | peça armada | proposta (3): o botão Armado passa a vir da mochila |
| Sobrecarregado | Defesa −5, perícias de carga −5 | deslocamento −3 m | proposta (3) |
| Caído | Defesa −5 contra corpo a corpo e +5 contra ataque à distância | peça deitada; anda só 1,5 m; levantar gasta ação de movimento | proposta (2) |
| Imóvel, paralisado, agarrado, petrificado | — | não anda (quem agarra anda metade, arrastando o alvo) | proposta (2) |
| Lento (e enredado, exausto, cego) | — | metade do deslocamento, sem correr nem investida | proposta (2) |
| Sem ações: inconsciente, pasmo, atordoado, surpreendido, paralisado, petrificado | marca na carta | turno pulado no combate | proposta (2 e 6) |
| Apavorado, confuso | penalidades nos testes | o mestre move a peça (fuga, passo ao acaso) | proposta (2) |
| Em chamas, sangrando | dano a cada turno | fogo na peça, gotas no chão (partículas) | proposta (2) |
| Posição das peças | — | o CRONA pode ver sozinho: quem está adjacente (corpo a corpo), flanqueando (lados opostos), ao alcance da arma, atrás de cobertura (mobi ou parede no meio), em posição elevada (altura do piso ou do mobi) | proposta (6) |
| Escuridão total | — | camuflagem total (a escuridão da cena pode sugerir) | proposta (6) |
| Portas | — | no combate, abrir ou fechar porta gasta ação de movimento | proposta (6) |
| Membrana do cômodo (p. 97) | — | campo novo no clima da cena: intacta, estável, danificada ou arruinada. Muda o que os rituais e as criaturas podem fazer; arruinada dá 1d6 de dano mental por cena | proposta (7) |

## Ordem de construção (proposta)

Um item por vez, cada um com testes e com sua aprovação antes do próximo. O mapa continua em primeiro lugar.

1. **Ficha no PLAYERS.** Classe, NEX, atributos, origem, trilha, patente e PP. PV, PE e SAN máximos, Defesa, deslocamento, limite de PE e DTs saem das fórmulas, com um ajuste manual como no C.R.I.S. Perícias com grau e bônus. Hoje os totais são digitados; passam a ser calculados.
2. **Condições.** As do livro, aplicadas pelo mestre, já trazendo as que vêm juntas (fatigado = fraco + vulnerável, e assim por diante). As que saem da ficha continuam automáticas. No tabuleiro: deitar, não andar, andar metade. O fim da cena limpa as que acabam.
3. **Mochila (aba ITENS).** Espaços, categorias, limite da patente e sobrecarga (Defesa e deslocamento). Arma empunhada deixa o personagem armado.
4. **Interlúdio (aba INTERLÚDIO).** Duas ações por personagem, recuperação pelas fórmulas e bônus de 1d6 guardados.
5. **Investigação.** Rodadas e urgência da cena, pista básica e pistas complementares (as pistas já existem nos mobis).
6. **Combate (aba COMBATE).** Iniciativa digitada, ordem, turnos e rodadas, ações do turno, PE por rodada, ataque com o d20 digitado, dano, reações, morrendo e enlouquecendo. No tabuleiro: casas ao alcance do movimento, corpo a corpo, flanquear, cobertura e alcance da arma.
7. **Rituais e poderes.** Custo, DT, Custo do Paranormal, elementos, rituais sustentados e a membrana do cômodo.
8. **Ameaças.** Fichas das criaturas, presença perturbadora e o turno do mestre.

## Decisões (com a proposta de cada uma)

1. **Ficha própria no CRONA.** Decidido: tudo do jogo fica no CRONA, e o mestre monta e edita a ficha aqui. O C.R.I.S foi só referência.
2. **Dados.** Decidido (30/09): sempre dados físicos na mesa, também os das ameaças, e só o mestre mexe na tela: ele digita o d20 que ficou e a soma dos dados de dano. Os jogadores assistem ao tabuleiro na mesa (`docs/COMBATE.md`, seção 2.2).
3. **Regras da casa.** Proposta: começar pelas que o C.R.I.S prevê (seção 12), por campanha, todas desligadas (= livro puro) até o mestre ligar. Falta saber quais a mesa usa.
4. **Conflitos do livro.** Proposta: seguir o que o C.R.I.S já decidiu (seção 13), com a chave da casa quando existir.
5. **Catálogos (itens, rituais, poderes, origens).** Proposta: nome, números e página no repositório; a descrição fica fora dele (ou o repositório passa a ser privado).
6. **Escala do combate.** Proposta: 1 quadrado do livro (1,5 m) = 2 casas do CRONA. Cada casa tem 0,75 m, também no desenho (03/10; antes ~0,68 m). Deslocamento de 9 m = 12 casas.

---

# Referência

## 1. Testes (p. 9–11, 75–78)

- Rola 1d20 por ponto do atributo e fica o maior. Com atributo 0, rola 2d20 e fica o menor.
- Soma o bônus da perícia: destreinado 0, treinado +5, veterano +10, expert +15.
- Passa com total ≥ DT. Escala (Tab. 4.1): fácil 5, média 10, difícil 15, muito difícil 20, formidável 25, heroica 30, quase impossível 35.
- Bônus em dados muda quantos d20 se rolam; bônus em número soma no total. Circunstância favorável ou ruim: ±1d20; extrema: ±2d20.
- Se uma penalidade deixaria menos de 1 dado, rola os dados que rolaria se ela fosse bônus e fica o pior (LR p. 11). Conta (`shared/src/regras/rolagem.ts`): n = atributo + dados ganhos − dados perdidos. Com n ≥ 1, rola n e fica o maior; com n < 1, rola atributo + dados ganhos + dados perdidos e fica o menor (Agi 2 com −3d20: 5d20, o pior). Com atributo 0 e nenhum dado ganho, 2d20 e fica o pior, e cada dado perdido soma mais um (COMBATE.md, DC-1). Por isso a ficha guarda os dados perdidos à parte (`penalidadeDados`).
- 20 natural no dado que ficou é sucesso automático. **Não existe falha automática no 1** (a chave `falhaNo1` muda isso só no ataque).
- Teste oposto: o maior vence; empate rola de novo. No C.R.I.S, se só um lado tirou 20, ele vence.
- Ajuda: cada ajudante testa contra DT 10 e dá +1, mais +1 a cada 10 acima. Teste estendido: juntar 3, 5 ou 7 sucessos antes de 3 falhas.
- Contas arredondam para baixo, e bônus da mesma fonte não somam (p. 312).

## 2. Ficha

### Atributos (p. 14–15)

- Agilidade, Força, Intelecto, Presença e Vigor. Escala de 0 a 5 (1 é a média humana).
- **Criação:** todos começam em 1, com 4 pontos para distribuir. Pode baixar um para 0 e ganhar 1 ponto. Máximo 3 na criação.
- **Depois:** +1 no aumento de atributo em NEX 20, 50, 80 e 95%. Máximo 5.
- Cada ponto de Intelecto dá +1 perícia treinada, inclusive os pontos ganhos depois.

### NEX (p. 23)

- De 5% a 99%, de 5 em 5 (99% é o 20º passo). Em geral, +5% por missão.
- A cada NEX novo, PV, PE e SAN máximos sobem, o personagem ganha as habilidades daquele NEX e o limite de PE sobe.

| NEX | O que ganha |
|---|---|
| 5% | habilidades iniciais da classe |
| 10% | trilha (1ª habilidade) |
| 15, 30, 45, 60, 75, 90% | poder de classe |
| 20, 50, 80, 95% | aumento de atributo |
| 25, 55, 85% | as habilidades fixas da classe sobem (Ataque Especial, Perito, círculo de ritual) |
| 35, 70% | grau de treinamento |
| 40, 65, 99% | 2ª, 3ª e 4ª habilidade da trilha |
| 50% | versatilidade (poder de classe ou 1º poder de outra trilha) e escolha da afinidade |

- **Grau de treinamento:** algumas perícias treinadas sobem um grau. São 1 + Int no combatente, 5 + Int no especialista e 3 + Int no ocultista.

### Classes (p. 22–35)

| | Combatente | Especialista | Ocultista |
|---|---|---|---|
| PV | 20 + Vig; +4 + Vig por NEX | 16 + Vig; +3 + Vig | 12 + Vig; +2 + Vig |
| PE | 2 + Pre; +2 + Pre por NEX | 3 + Pre; +3 + Pre | 4 + Pre; +4 + Pre |
| SAN | 12; +3 por NEX | 16; +4 | 20; +5 |
| Perícias treinadas | Luta ou Pontaria; Fortitude ou Reflexos; mais 1 + Int | 7 + Int | Ocultismo e Vontade; mais 3 + Int |
| Proficiências | armas simples e táticas, proteções leves | armas simples, proteções leves | armas simples |
| Habilidades fixas | Ataque Especial | Eclético, Perito; Engenhosidade em 40% | Escolhido pelo Outro Lado (rituais) |

- **Conta para o código** (a mesma do C.R.I.S, `ficha-rules.ts`): passo = índice do NEX (5% = 0 … 99% = 19).
  - PV máx = base + Vig + passo × (ganho + Vig).
  - PE máx = base + Pre + passo × (ganho + Pre).
  - SAN máx = base + ganho × (passo − vezes que usou Transcender).
  - Exemplo: combatente com Vig 2 tem 22 PV em 5% e 28 em 10%.
- O C.R.I.S soma um ajuste manual e tira perdas permanentes: total = máx(0, fórmula + ajuste − perda). O CRONA faz igual.
- **Trilhas:** 5 por classe no livro. Escolhe em 10%; as habilidades chegam em 10, 40, 65 e 99%.
  - Combatente: Aniquilador, Comandante de Campo, Guerreiro, Operações Especiais, Tropa de Choque.
  - Especialista: Atirador de Elite, Infiltrador, Médico de Campo, Negociador, Técnico.
  - Ocultista: Conduíte, Flagelador, Graduado, Intuitivo, Lâmina Paranormal.
  - Mudam números da ficha: Tropa de Choque (PV), Técnico (carga), Intuitivo (limite de PE para rituais), Operações Especiais (Iniciativa).

### Origens (p. 16–21)

- Cada origem dá 2 perícias treinadas e 1 poder. São 26 no livro, mais 20 do *Sobrevivendo ao Horror* no C.R.I.S.
- Se a classe der uma perícia que a origem já deu, escolhe outra.
- Poderes de origem que mudam números: Desgarrado (PV), Vítima (SAN), Universitário (PE e limite de PE), Policial (Defesa), Cultista Arrependido (metade da SAN base e um poder paranormal), Magnata (crédito), Criminoso e Engenheiro (itens).

### Perícias (p. 38–49)

São 28. ✱ = só treinada (sem treino não pode usar); (c) = sofre penalidade de carga.

| Atributo | Perícias |
|---|---|
| AGI | Acrobacia (c), Crime ✱ (c), Furtividade (c), Iniciativa, Pilotagem ✱, Pontaria, Reflexos |
| FOR | Atletismo, Luta |
| INT | Atualidades, Ciências ✱, Investigação, Medicina, Ocultismo ✱, Profissão ✱, Sobrevivência, Tática ✱, Tecnologia ✱ |
| PRE | Adestramento ✱, Artes ✱, Diplomacia, Enganação, Intimidação, Intuição, Percepção, Religião ✱, Vontade |
| VIG | Fortitude |

- Intuição é de Presença. A Tab. 2.1 imprime Intelecto por engano; o texto e a ficha dizem Presença.
- Veterano a partir de NEX 35%; expert a partir de 70%.
- Sem o kit que o uso exige: −5. Bônus de itens na mesma perícia não somam, e só 2 vestimentas valem ao mesmo tempo.

### Valores derivados (p. 36, 53, 78, 82, 88)

- **Defesa** = 10 + Agi + proteção + escudo + outros. Sobrecarregado: −5.
- **Deslocamento** = 9 m (6 quadrados). Sobrecarregado: −3 m.
- **Limite de PE por turno** = NEX ÷ 5 (5% = 1 … 99% = 20). Conta tudo o que se gasta no turno, mas sempre dá para usar uma habilidade no custo mínimo.
- **DT das habilidades** = 10 + limite de PE + o atributo indicado. **DT dos rituais** = 10 + limite de PE + Pre.
- **Resistência a dano** "X N": tira N de todo dano do tipo X. Tipos: balístico, corte, eletricidade, fogo, frio, impacto, mental (tira SAN), paranormal (Conhecimento, Energia, Medo, Morte, Sangue), perfuração e químico.
- **Defesas especiais** (só com a perícia treinada):
  - Esquiva = Defesa + bônus de Reflexos.
  - Bloqueio = RD igual ao bônus de Fortitude, só contra corpo a corpo.
  - Contra-ataque = ataque com Luta quando um golpe corpo a corpo erra.
- **Pontos temporários:** podem passar do máximo, são gastos primeiro e somem no fim do dia. (O C.R.I.S só guarda; não gasta primeiro.)
- PV e SAN nunca ficam negativos. PE 0 não dá penalidade: só impede o que custa PE.

### Patente e prestígio (p. 51–53)

| PP | Patente | Crédito | Itens cat. I | II | III | IV |
|---|---|---|---|---|---|---|
| 0 | Recruta | baixo | 2 | — | — | — |
| 20 | Operador | médio | 3 | 1 | — | — |
| 50 | Agente especial | médio | 3 | 2 | 1 | — |
| 100 | Oficial de operações | alto | 3 | 3 | 2 | 1 |
| 200 | Agente de elite | ilimitado | 3 | 3 | 3 | 2 |

- Itens de categoria 0 não têm limite de quantidade, só de carga.
- Profissão treinada, veterana ou expert dá +1 item de categoria I, II ou III por missão (LR p. 48).
- PP por missão (Tab. 3.2): caso resolvido +10, cada pista extra +2, inocente morto −2, agente do grupo morto −5.
- Promoção e rebaixamento valem a partir da missão seguinte.

### Poderes (p. 22, 78, 114)

- **Três tipos:**
  - de origem: um só, fixo;
  - de classe: em NEX 15, 30, 45, 60, 75 e 90%, mais a versatilidade em 50%;
  - paranormal: vem pelo poder de classe Transcender, e nesse NEX o personagem não ganha SAN.
- Pré-requisitos podem ser atributo, perícia treinada, NEX ou outro poder. Nenhum se repete, salvo Transcender, Treinamento em Perícia e Aprender Ritual.
- Poder paranormal de nível N exige N outros poderes do mesmo elemento.
- **Afinidade:** o elemento é escolhido em 50% e se firma na primeira vez que o personagem usa Transcender depois disso. Com afinidade, um poder paranormal pode ser escolhido de novo para ganhar a versão "Afinidade".
- Usar uma habilidade gasta a ação indicada (sem indicação, é livre). O PE é gasto mesmo se falhar.
- O C.R.I.S automatiza os efeitos dos poderes pelo nome (`power-effects.ts`): PV, PE, SAN, limite de PE, Defesa, RD, perícias, ataque, dano, margem, multiplicador, deslocamento, carga, atributo, categoria e treino. Efeito condicional vira só aviso.

## 3. Mochila (p. 53–66)

- **Espaços** = 5 × Força (Força 0: 2 espaços). Máximo absoluto: o dobro.
- **Sobrecarregado** (passar do limite; igualar não conta): Defesa −5, perícias de carga −5, deslocamento −3 m.
- **Quanto ocupa:** 1 espaço é o padrão; 2 para arma de duas mãos, proteção leve ou item volumoso; 5 para proteção pesada; 10 para uma pessoa carregada; 0 para coisa desprezível. A mochila e recipientes simples (coldre) não contam; a mochila militar dá +2 espaços.
- **Mãos:** até 2 itens empunhados. Sacar ou guardar é ação de movimento; largar é livre; vestir é padrão; tirar é movimento.
- **Categoria do item** = base + 1 por modificação (e mais pelas maldições). Precisa caber no limite da patente.
- **Armas:** categoria, dano, crítico (margem e multiplicador; padrão 20/×2), alcance, tipo de dano (corte, impacto, perfuração, balístico) e espaços. Simples, táticas ou pesadas; sem proficiência, −2d20 no ataque.
- **Alcance:** curto 9 m, médio 18 m, longo 36 m, extremo 90 m. Dá para atacar até o dobro com −5.
- **Proteções:** leve +5 na Defesa (cat. I, 2 espaços); pesada +10 (cat. II, 5 espaços, RD 2 contra balístico, corte, impacto e perfuração, −5 nas perícias de carga); escudo +2 (cat. 0, 2 espaços, numa mão). Proteção sem proficiência: −2d20 em testes de For e Agi.
- **Munição:** abstrata, por cena. Balas curtas duram 2 cenas; balas longas, cartuchos e combustível, 1 cena; flechas, a missão inteira; foguete, 1 tiro. Contar tiro a tiro é regra opcional.
- Itens amaldiçoados só para agente especial ou acima, a partir de 50 PP (LR p. 144; patentes na p. 52).
- **No CRONA (30/09):** um inventário só. O item achado no cenário entra na mochila da ficha ao ser pego (achado na missão: não ocupa vaga da patente, que limita o que a Ordem fornece), e o do livro vira o item de verdade (a faca da gaveta ataca). Os itens do cenário ocupam espaços, como os da ficha. Cada item está na mão, vestido ou na mochila (`shared/src/regras/mochila.ts`); o que se veste, pego no cenário, entra guardado, porque vestir é uma ação (LR p. 53, 63). Duas mãos no máximo (a arma de duas mãos ocupa as duas; escudo e itens "empunhado", uma); o escudo vale na mão; o item que se empunha só faz efeito na mão (a soqueira). Arma na mão deixa a peça armada (retrato, pose e mesa). Passar do dobro da carga não deixa; o limite da patente avisa e o mestre decide. Largar deixa o item no chão do cômodo, numa pilha. No combate, a arma da mochila aparece com "Sacar" (ação de movimento) e o Desarmar faz o item cair na casa do alvo; o Desfazer volta os dois.

## 4. Combate (p. 82–91)

Resumo. O detalhe de cada regra do combate, com o que a tela faz, está em `docs/COMBATE.md`.

### Iniciativa e rodada

- **Livro:** cada jogador rola Iniciativa; o mestre rola uma vez por todos os inimigos, com o menor bônus entre eles. Empate rola de novo. A ordem vale o combate inteiro, e todos os seres do mestre agem num turno só (p. 169).
- **C.R.I.S:** o mestre digita a iniciativa de cada um; empate vai pela ordem de entrada; quem entra no meio age na hora.
- **Surpresa:** quem não percebeu o outro lado fica desprevenido e não age na 1ª rodada.
- Rodada ≈ 6 s. Um efeito de N rodadas acaba logo antes da mesma iniciativa em que começou.

### Ações do turno (p. 84–87)

- Por turno: uma padrão + uma de movimento, ou duas de movimento, ou uma completa. Ações livres e reações à vontade; só as defesas especiais são uma por rodada (p. 85, 88).
- **Padrão:** atacar, manobra, atropelar, conjurar ritual, fintar, preparar, usar habilidade ou item.
- **Movimento:** andar, levantar-se, sacar ou guardar, manipular item (inclui abrir e fechar porta), mirar.
- **Completa:** corrida; investida (até 2× o deslocamento em linha reta, +1d20 no ataque e −5 na Defesa até o próximo turno); golpe de misericórdia.
- **Livre:** atrasar, falar (umas 20 palavras), jogar-se no chão, largar item.

### Movimento no mapa (p. 89–91)

- Quadrado de 1,5 m; deslocamento de 9 m = 6 quadrados.
- **Diagonal custa o dobro** (1 quadrado na diagonal conta 2). Terreno difícil também custa o dobro. Nem corrida nem investida em terreno difícil.
- Pode passar por aliado. Por inimigo, só se ele estiver indefeso, tiver 3 categorias de tamanho de diferença, com Acrobacia ou atropelando.
- Tamanhos: Médio (e menores) 1×1, Grande 2×2, Enorme 3×3, Colossal 6×6 quadrados.
- **No CRONA** (proposta): 1 quadrado = 2 casas. Deslocamento de 9 m = 12 casas; alcance curto = 12 casas, médio 24, longo 48. A diagonal conta dobrado do mesmo jeito, em casas.

### Ataque, dano e crítico (p. 54–55, 82, 89–90)

- **Corpo a corpo:** Luta (dados de Força) contra a Defesa de um alvo adjacente (1,5 m). **À distância:** Pontaria (dados de Agilidade).
- Acerta se o total for ≥ Defesa, ou com 20 natural.
- **Dano:** dados da arma, somando Força em corpo a corpo e arremesso (armas de disparo e de fogo não somam atributo). Armas ágeis podem usar Agilidade.
- **Crítico:** acertou e o d20 ≥ margem. Multiplica só os dados da arma; bônus fixos e dados extras não.
- **Ordem do dano** (a do C.R.I.S): para cada parte do dano, rolado + bônus → imune vira 0 → metade se passou na resistência → vulnerável dobra → menos a RD daquele tipo. Depois, a RD geral sai uma vez só do total.
- **Situações (Tab. 4.4):**
  - atacante caído −2d20 (só corpo a corpo, p. 310); cego tem 50% de falha; em posição elevada +1d20; flanqueando +1d20; invisível +2d20; ofuscado −1d20;
  - alvo caído: −5 na Defesa contra corpo a corpo, +5 contra ataque à distância; alvo cego ou desprevenido: −5;
  - cobertura: +5 na Defesa (total: não pode ser alvo). Passa uma reta de um canto do quadrado do atacante a um canto do quadrado do alvo; se ela cruza obstáculo ou ser, há cobertura;
  - camuflagem: 20% de falha (total 50%; escuridão total dá camuflagem total). Chances de falha de fontes diferentes somam até 75%;
  - atirar em alvo que está em corpo a corpo com outro: −5 (mirar anula).

### Defesas especiais (p. 88)

Usam a reação (uma por rodada) e não custam PE. Bloqueio e esquiva são declarados antes de o atacante rolar. Ameaças do mestre não usam.
- **Bloqueio** (Fortitude treinada; só contra corpo a corpo): RD igual ao bônus de Fortitude contra aquele ataque.
- **Esquiva** (Reflexos treinada): soma o bônus de Reflexos na Defesa contra aquele ataque.
- **Contra-ataque** (Luta treinada): se o golpe corpo a corpo errar, ataca de volta.

### Manobras (p. 44, 85–86)

Trocam um ataque corpo a corpo por um teste oposto contra a Luta do alvo. Nunca à distância. Empate repete.
- **Agarrar** (desarmado): o alvo fica desprevenido e imóvel e só ataca com arma leve. Quem agarra anda à metade, arrastando o alvo.
- **Derrubar:** o alvo fica caído; vencendo por 5 ou mais, também é empurrado 1 quadrado.
- **Desarmar:** o item cai; vencendo por 5 ou mais, vai 1 quadrado adiante.
- **Empurrar:** 1,5 m, mais 1,5 m a cada 5 pontos de diferença.
- **Quebrar:** ataca um item empunhado. **Atropelar:** no meio do movimento; vencendo, o alvo cai e você passa.
- **Fintar** (Enganação contra Reflexos): o alvo fica desprevenido contra o seu próximo ataque.

### 0 PV e morte (p. 36, 46, 87–88, 311)

- **0 PV:** inconsciente e morrendo. Morre ao começar 3 turnos morrendo na mesma cena.
- **Sair:** qualquer cura tira o inconsciente. Pela p. 88, morrendo só sai com Medicina DT 20 (primeiros socorros: ação padrão, alvo adjacente, +5 na DT a cada vez na cena; deixa com 1 PV). A p. 311 diz que sai ao voltar a 1 PV. Ver seção 13.
- **Dano massivo:** dano de uma vez ≥ metade dos PV totais, sem zerar, pede Fortitude DT 15 + 2 a cada 10 de dano. Se falhar, cai a 0 PV.
- **Golpe de misericórdia:** ação completa contra alvo adjacente e indefeso. É crítico automático, com 25% de chance de morte para personagens e NPCs importantes e 75% para NPCs secundários.
- **Dano não letal:** conta para desmaiar, não para morrendo.
- **Queda:** 1d6 a cada 1,5 m, até 40d6 (p. 292).
- **C.R.I.S:** o turno de quem está morrendo é pulado e um contador de 3 desce; chegando a 0, morre. Aliados, NPCs e ameaças a 0 PV saem da fila.

## 5. Condições (p. 310–311)

Acabam no fim da cena, salvo indicação. Efeitos iguais não somam: vale o pior. No C.R.I.S, machucado, morrendo, perturbado e enlouquecendo continuam depois da cena.

| Condição | Efeito | No tabuleiro |
|---|---|---|
| Abalado | −1d20 em testes; abalado de novo = apavorado | — |
| Agarrado | desprevenido e imóvel; só arma leve; −1d20 no ataque | não anda |
| Alquebrado | +1 PE no custo de habilidades e rituais | — |
| Apavorado | −2d20 em perícias; foge da fonte do medo | o mestre afasta a peça |
| Asfixiado | aguenta Vigor + 1 rodadas; depois, morrendo | — |
| Atordoado | desprevenido e sem ações | turno pulado |
| Caído | −2d20 no ataque corpo a corpo; Defesa −5 contra corpo a corpo e +5 contra distância; anda 1,5 m | peça deitada |
| Cego | desprevenido e lento; −2d20 em perícias de Agi e For; os alvos dele têm camuflagem total | metade do deslocamento |
| Confuso | 1d6 por turno: anda ao acaso, fica parado, ataca o mais próximo ou a condição acaba | o mestre move |
| Debilitado | −2d20 em Agi, For e Vig; de novo = inconsciente | — |
| Desprevenido | Defesa −5; −1d20 em Reflexos | — |
| Doente | efeito da doença | — |
| Em chamas | 1d6 de fogo por turno; apaga com ação padrão ou água | fogo na peça |
| Enjoado | só uma ação padrão ou uma de movimento por rodada | — |
| Enredado | lento e vulnerável; −1d20 no ataque | metade do deslocamento |
| Envenenado | efeito do veneno | — |
| Esmorecido | −2d20 em Int e Pre | — |
| Exausto | debilitado, lento e vulnerável; de novo = inconsciente | metade do deslocamento |
| Fascinado | −2d20 em Percepção; só observa | — |
| Fatigado | fraco e vulnerável; de novo = exausto | — |
| Fraco | −1d20 em Agi, For e Vig; de novo = debilitado | — |
| Frustrado | −1d20 em Int e Pre; de novo = esmorecido | — |
| Imóvel | deslocamento 0 | não anda |
| Inconsciente | indefeso, sem ações nem reações | peça deitada; turno pulado |
| Indefeso | desprevenido com Defesa −10; falha em Reflexos; pode sofrer golpe de misericórdia | — |
| Lento | metade do deslocamento; sem correr nem investida | metade do deslocamento |
| Machucado | PV abaixo da metade; sem efeito próprio (pré-requisito de poderes e criaturas) | — |
| Morrendo | 0 PV; morre ao começar 3 turnos assim na cena | peça deitada; turno pulado |
| Ofuscado | −1d20 no ataque e em Percepção | — |
| Paralisado | imóvel e indefeso; só ações mentais | não anda |
| Pasmo | sem ações | turno pulado |
| Petrificado | inconsciente, com RD 10 | não anda |
| Sangrando | Vigor DT 20 no começo do turno; se falhar, perde 1d6 PV | gotas no chão |
| Surdo | −2d20 em Iniciativa; sem Percepção pela audição | — |
| Surpreendido | desprevenido e sem ações | turno pulado |
| Vulnerável | Defesa −5 | — |

- Perturbado, enlouquecendo e insano ficam fora do apêndice (seção 6).
- Grupos do livro, que importam para imunidades: medo (abalado, apavorado); mental (alquebrado, atordoado, confuso, esmorecido, fascinado, frustrado, pasmo); paralisia (agarrado, enredado, imóvel, lento, paralisado); sentidos (cego, ofuscado, surdo); fadiga (fatigado, exausto).

## 6. Sanidade, esforço e o Outro Lado (p. 88, 97, 110–116, 180)

- **Dano mental** tira SAN no lugar de PV. Resistência mental reduz.
- **Perturbado:** SAN abaixo da metade da total. Não tem penalidade própria. Opcional: na 1ª vez na cena, 1d20 na Tab. 5.1 para um efeito de interpretação (chave `efeitosInsanidade`).
- **Enlouquecendo:** SAN 0. Ao começar 3 turnos assim na mesma cena, fica **insano** e vira personagem do mestre (a chave `loucuraNaoLetal` muda isso). Sai com acalmar (Diplomacia DT 20, ação padrão, alvo adjacente, +5 na DT a cada vez na cena; Religião também serve) ou com qualquer cura de SAN.
- **Medo:** assustar (Intimidação contra Vontade) deixa abalado pela cena; vencendo por 10 ou mais, apavorado por 1 rodada e depois abalado.
- **Presença perturbadora** (criaturas): ao ver a criatura, Vontade contra a DT dela. Falhou, sofre o dano mental cheio; passou, metade. Quem tem o NEX indicado é imune. Com várias criaturas, vale a de maior VD, +1d6 por criatura extra.
- **Pontos de Esforço:** pagam habilidades e rituais, dentro do limite por turno. Reduções de custo não somam; o custo mínimo é 1 PE. PE 0 não dá penalidade. Recupera dormindo no interlúdio.
- **Membrana do local** (p. 97):
  - intacta: nada paranormal funciona;
  - estável: só rituais de 1º círculo;
  - danificada: regras normais;
  - arruinada: rituais saem na forma verdadeira sem custo extra; criaturas ganham +10 no ataque, +2 dados de dano e RD 10; todos sofrem 1d6 de dano mental a cada cena.
- **Exposição paranormal** é o próprio NEX; a afinidade com um elemento vem em 50%.

## 7. Rituais (p. 117–122)

- **Círculos:** 1º a 4º, com custo de 1, 3, 6 e 10 PE.
- **Quem aprende:** o ocultista libera o 2º círculo em NEX 25%, o 3º em 55% e o 4º em 85%; começa com 3 rituais e aprende 1 a cada NEX. As outras classes aprendem pelo poder Aprender Ritual, até um número de rituais igual ao Intelecto (no C.R.I.S: 2º círculo em 45%, 3º em 75%, nunca o 4º).
- **Elementos:** Sangue vence Conhecimento, que vence Energia, que vence Morte, que vence Sangue. Medo é neutro. Contra o elemento vencido: −2d20 na resistência e vulnerável ao dano. Mesmo elemento: +2d20.
- **Conjurar:** gasta a ação do ritual e os PE; exige uma mão livre e componentes do elemento (Medo não usa; a afinidade dispensa). Só um ritual de ação livre por rodada.
- **Concentração:** sofrer dano ou estar em situação ruim durante a conjuração pede Vontade (DT = o dano; situação ruim 15 + custo; terrível 20 + custo). Se falhar, perde o ritual e os PE.
- **Alcance:** pessoal, toque, curto, médio, longo, extremo ou ilimitado. **Áreas:** cone, cubo, esfera (centro no cruzamento de 4 quadrados) e linha (1,5 m de largura), sempre com linha de efeito livre.
- **Duração:** instantânea, cena, sustentada (1 PE por turno, uma de cada vez), definida, permanente ou descarregar.
- **Resistência:** DT = 10 + limite de PE + Pre.
- **Formas discente e verdadeira:** custam PE extra e às vezes pedem círculo ou afinidade; uma por conjuração.
- **Custo do Paranormal:** todo ritual que não seja de Medo pede Ocultismo DT 15 + custo. Falhou, dano mental igual ao custo; falhou por 5 ou mais, perde também 1 SAN permanente.
- **Rituais de Medo:** só Marcados conjuram (todo agente é). Sempre causam dano mental igual ao custo e tiram SAN permanente: 1 (2 na forma discente, 3 na verdadeira).
- **Identificar um ritual:** Ocultismo DT 10 + 5 por círculo, como reação.

## 8. Interlúdio (p. 92–93)

Cena de descanso em lugar seguro. Cada personagem faz até **duas ações**:
- **Dormir** (1×): recupera PV e PE iguais ao limite de PE, vezes o lugar: precário ½, normal 1, confortável 2, luxuoso 3.
- **Relaxar** (1×): o mesmo, para SAN; cada participante dá +1 SAN a todos (o C.R.I.S conta o próprio personagem).
- **Alimentar-se:** +2 SAN no relaxar, ou sobe um nível a recuperação de PV ou de PE, ou +5 no revisar caso.
- **Exercitar-se:** +1d6 guardado para um teste de Agi, For ou Vig até o fim da missão (acumula até o Vigor). **Ler:** o mesmo para Int ou Pre (acumula até o Intelecto).
- **Manutenção:** conserta um item quebrado. **Revisar caso:** procurar pistas de uma cena já feita.
- A recuperação nunca passa do máximo. Forçar muitos interlúdios pode aumentar a urgência da investigação.

## 9. Investigação (p. 79–81, 169)

- Toda cena de investigação começa com uma **pista básica** dada pelo mestre. As **pistas complementares** dependem de testes.
- **Rodadas:** cada personagem faz uma ação por rodada:
  - procurar pistas: DT 15 para algo simples, 20 para plausível e complexo, 25 ou mais para vago;
  - facilitar: DT 15 a 25; se passar, os aliados ganham +2 no próximo procurar pistas;
  - usar habilidade ou item;
  - ajudar.
- **Urgência (Tab. 4.3):** muito baixa 6 rodadas, baixa 5, média 4, alta 3, muito alta 2. Quando acaba, a cena termina e pode haver penalidade. Opcional: a cada 3 falhas, −1 rodada.
- **Ficha do grupo:** resumo do caso, objetivo, perguntas e pistas anotadas.
- No CRONA as pistas já ficam nos mobis e os objetivos no painel; falta contar as rodadas de urgência da cena.

## 10. Ameaças (p. 176–181)

- A ficha traz VD, Defesa, PV, ataques, resistências e presença perturbadora. No C.R.I.S, criatura sem PV no bestiário fica com PV = máx(10, VD × 8).
- Todas agem no turno do mestre e não usam defesas especiais.
- São imunes a dano mental e às condições mentais e de medo.

## 11. Regras opcionais do livro (p. 170–175)

- NEX 0% (classe Mundano: PV 8 + Vig, PE 1 + Pre, SAN 8), idade variada, contagem de munição, lesões, inspiração resoluta e loucura não letal.
- **Aliados:** NPCs sem turno nem PV; dão um bônus e uma habilidade uma vez por rodada.
- Não existe regra de "Determinação" neste livro.

## 12. Regras da casa

**Regra da mesa, sempre ligada (19/10, decidida pelo Felipe):** o aumento de atributo só vale do NEX dele em diante. Os PV de cada NEX somam o Vigor daquele NEX, e os PE, a Presença daquele NEX (ou o atributo que a substitui): "antes era 1, soma-se como 1; upou e aumentou, aí soma-se como 2". O livro não diz (AUDITORIA-REGRAS.md, D1). Os itens que dão atributo valem em todos os NEX enquanto estão com a pessoa. Conta em `shared/src/regras/calcular.ts` (`atributosNoNex`, guardado NEX a NEX por `montarEstado`).

Por campanha, guardadas no CRONA. Tudo desligado = livro puro. Só o mestre liga e desliga. A lista começa pelas que o C.R.I.S prevê:

| Chave | O que muda |
|---|---|
| `falhaNo1` | 1 no d20 que ficou erra o ataque |
| `flanquearNumerico` | flanquear dá +2 em vez de +1d20 |
| `agarradoNumerico` | agarrado ataca com −2 em vez de −1d20 |
| `morrendoEstrito` | morrendo só sai com Medicina DT 20 (como a p. 88) |
| `efeitosInsanidade` | ao ficar perturbado, efeito da Tab. 5.1 |
| `loucuraNaoLetal` | o personagem insano continua com o jogador |
| `lesoes` | Vigor DT 10 no 2º turno morrendo, ou perde 1 ponto de atributo |
| `medoEmJogo` | SAN 0 rola 2d10 na tabela de medo (*Sobrevivendo ao Horror*) |

No C.R.I.S só as três primeiras funcionam de fato; as outras cinco têm a chave, mas nada no código usa.

Decisões do C.R.I.S que não têm chave e que o CRONA segue (proposta, decisão 4):
- atributo ≤ 0 com penalidade soma dados no grupo em que fica o pior;
- no teste oposto, um único 20 vence;
- os contadores de morrendo e enlouquecendo valem o combate inteiro, e o turno de quem está morrendo é pulado;
- esquiva e bloqueio usam o bônus total da perícia;
- relaxar conta o próprio personagem no bônus;
- Transcender exige NEX 15%;
- proteção pesada só reduz dano físico.

Uma decisão do C.R.I.S que o CRONA não segue: deixar o primeiro gasto de PE da rodada passar inteiro, mesmo acima do limite. O livro só garante uma habilidade no custo mínimo por turno (p. 23; ver `docs/COMBATE.md`, seção 14).

## 13. Conflitos do livro e a escolha do CRONA

| Ponto | O livro diz | Escolha (proposta) |
|---|---|---|
| Machucado | "menos da metade" dos PV (p. 88, 311); o poder Sangue Vivo trata a metade exata como machucado (p. 116) | menos da metade (`2 × pv < pvMax`), como já está |
| Flanquear | +2 no texto (p. 90); +1d20 na Tab. 4.4 | +1d20; `flanquearNumerico` troca |
| Agarrado | −2 (p. 85); −1d20 (p. 310) | −1d20; `agarradoNumerico` troca |
| Fim do morrendo | só com Medicina DT 20 (p. 88); ao voltar a 1 PV (p. 311) | ao voltar a 1 PV; `morrendoEstrito` troca |
| Até morrer | começar 3 turnos morrendo na cena (p. 88); mais de 3 rodadas (p. 311) | 3 turnos, como no C.R.I.S |
| 0 PV | morrendo (p. 88); sangrando (p. 36) | morrendo |

Os conflitos do combate (atacante caído, fintar, falta de ar, limite de PE e outros) estão em `docs/COMBATE.md`, seção 22.

## 14. O que o CRONA já tem

- **Motor de criação de personagem** (`shared/src/regras/`, sem tela ainda): classes, origens, trilhas, poderes de classe e gerais, poderes paranormais, rituais, armas, proteções, modificações, equipamentos, itens amaldiçoados e maldições, do livro e do *Sobrevivendo ao Horror*. A ficha guarda as escolhas NEX a NEX (de 0% a 99%); `calcular()` dá os números, as pendências e os problemas; `opcoes*()` dão cada opção liberada ou travada com o motivo. Testes em `server/test/regras.test.ts`. O passo a passo das telas está em `docs/CRIACAO-DE-PERSONAGEM.md`.

- PV, PE e SAN (atual e total) por personagem; o mestre sobe e desce no PLAYERS (Shift = ±5). Nunca ficam negativos.
- Condições tiradas da ficha (`shared/src/vitals.ts`): machucado, morrendo, perturbado e enlouquecendo, com os mesmos limites do livro e do C.R.I.S.
- PE abaixo da metade: só visual (respiração lenta).
- Retrato em 4 estados (armado ou desarmado, machucado ou não) e respiração conforme a ficha.
- Pistas nos mobis, objetivos e registro: a base da investigação.
- Portas que bloqueiam o caminho e a passagem secreta: o tabuleiro já sabe o que impede o movimento.
