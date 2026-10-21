# Combate no CRONA (mecânica)

> **Decisão do Felipe (21/10, vale sobre o que está escrito abaixo sobre o "turno do mestre"):** cada ser do mestre tem o PRÓPRIO turno; a Iniciativa pode ser igual para vários (os do mesmo tipo), mas cada tipo (um Existido, um Zumbi de Sangue, um NPC) tem a sua, e não existe mais uma Iniciativa "do grupo do mestre" (LR p. 83). Entre Iniciativas iguais, vale a ordem do preparo e o desempate. Código: `entradas()` e `migrar()` em `shared/src/combate/turnos.ts`.


Tudo o que a aba COMBATE precisa saber para uma luta andar sem travar: começo da cena de ação, surpresa, iniciativa, rodadas e turnos, cada ação do livro, ataque e dano, reações, manobras, rituais, condições, morrendo e enlouquecendo, as DTs que sobem, ameaças, aliados, itens, perigos e as regras opcionais. **Aqui é só mecânica.** O visual da tela vem depois, com a referência.

- **Fontes:** livro de regras (LR, PDF 1.0) e *Sobrevivendo ao Horror* (SaH). As páginas são as impressas no rodapé. Onde o livro se contradiz ou não diz nada, a seção 22 mostra o ponto e a proposta.
- **Onde fica o resumo:** `docs/REGRAS.md` (seções 4 a 7) é o resumo geral. Este documento é o detalhe para construir o combate. O que for decidido aqui volta para lá.
- **Direitos autorais:** só resumos com nossas palavras, números e tabelas de regra. Poderes, rituais, itens amaldiçoados e criaturas aparecem só pelo nome e pela página.
- **Marcas usadas no texto:**
  - **No CRONA:** o que o servidor e a tela fazem com a regra.
  - **Opção `chave`:** regra opcional do LR, do SaH ou da casa, ligada por campanha. Tudo desligado = livro puro.
  - **DC-n:** decisão aberta para o mestre, com a proposta (seção 23).

## Sumário

1. [Como o combate funciona no CRONA](#1-como-o-combate-funciona-no-crona)
2. [Dados e testes](#2-dados-e-testes)
3. [Começo do combate](#3-começo-do-combate)
4. [Rodada, turno e duração](#4-rodada-turno-e-duração)
5. [Ações do turno](#5-ações-do-turno)
6. [Ataque, passo a passo](#6-ataque-passo-a-passo)
7. [Situações, modificadores e o tabuleiro](#7-situações-modificadores-e-o-tabuleiro)
8. [Dano e cura](#8-dano-e-cura)
9. [Manobras de combate](#9-manobras-de-combate)
10. [PV, morrendo e morte](#10-pv-morrendo-e-morte)
11. [SAN, enlouquecendo e insanidade](#11-san-enlouquecendo-e-insanidade)
12. [Condições no combate](#12-condições-no-combate)
13. [DTs que sobem e contadores](#13-dts-que-sobem-e-contadores)
14. [Habilidades, poderes e PE](#14-habilidades-poderes-e-pe)
15. [Rituais no combate](#15-rituais-no-combate)
16. [Itens de combate e munição](#16-itens-de-combate-e-munição)
17. [Ameaças: NPCs e criaturas](#17-ameaças-npcs-e-criaturas)
18. [Aliados](#18-aliados)
19. [Perigos da cena](#19-perigos-da-cena)
20. [Fim do combate](#20-fim-do-combate)
21. [Regras opcionais](#21-regras-opcionais)
22. [Conflitos do livro](#22-conflitos-do-livro)
23. [Decisões para o mestre](#23-decisões-para-o-mestre)
24. [O que o CRONA guarda](#24-o-que-o-crona-guarda)
25. [Ordem de construção](#25-ordem-de-construção)
26. [Exemplo de duas rodadas](#26-exemplo-de-duas-rodadas)

---

## 1. Como o combate funciona no CRONA

- **Quem faz o quê:** o servidor guarda o combate e aplica as regras. A tela do mestre mostra e pede. O celular do jogador (`?ficha=`) mostra a ficha dele.
- **Só o mestre mexe no combate** (decidido em 30/09): escolhe as ações, move as peças e digita as rolagens. Os jogadores rolam os dados físicos, dizem o resultado e assistem ao tabuleiro acontecendo na mesa (tablet). A tela está em `docs/TELA-COMBATE.md`.
- **Cinco regras de fluidez:**
  1. **O CRONA monta cada teste sozinho:** quantos d20, qual bônus, contra qual DT ou Defesa, e de onde vem cada modificador (ficha, condição, tabuleiro, arma). O mestre só confirma ou corrige.
  2. **Uma entrada por rolagem:** o d20 que ficou, ou a soma dos dados de dano. Ninguém faz conta de cabeça.
  3. **O que acontece sozinho vira pendência:** começo e fim de turno, fim de efeito, contadores. Cada turno começa com uma lista curta do que vai acontecer.
  4. **Tudo se desfaz:** cada passo do combate é um evento no registro, e o mestre volta o último.
  5. **O mestre manda:** qualquer modificador automático pode ser ligado, desligado ou trocado na hora, e qualquer regra pode ser ignorada naquele momento. Fica anotado no registro.
- **Nomes usados aqui:**
  - **ser:** qualquer participante;
  - **agente:** personagem de jogador;
  - **NPC:** pessoa do mestre, com ficha de ameaça;
  - **criatura:** ameaça paranormal;
  - **aliado:** NPC ajudante, sem turno (seção 18).

## 2. Dados e testes

### 2.1 Como se rola (LR p. 75–78)

- **Teste:** rola um d20 por ponto do atributo e fica o maior. Soma o bônus da perícia (treinado +5, veterano +10, expert +15) e os bônus em número. Com atributo 0, rola 2d20 e fica o menor.
- **Dois tipos de modificador:**
  - em dados (+1d20, −1d20): mudam quantos d20 se rolam;
  - em número (+2, −5): somam no total.
- **Menos de 1 dado** (p. 11): se uma penalidade deixaria menos de 1 dado, rola os dados que rolaria se ela fosse bônus e fica o pior. O CRONA guarda os dados ganhos e os perdidos separados (`shared/src/regras/rolagem.ts`):
  - n = atributo + dados ganhos − dados perdidos;
  - com n ≥ 1, rola n e fica o maior;
  - com n < 1, rola atributo + dados ganhos + dados perdidos e fica o menor (Agi 2 com −3d20: 5d20, o pior);
  - com atributo 0 e nenhum dado ganho, rola 2d20 e fica o pior, e cada dado perdido soma mais um (DC-1).
- **20 natural** no dado que ficou: passa sempre (p. 76). O 1 não é falha automática; a chave `falhaNo1` muda isso só no ataque.
- **Teste oposto:** o maior total vence. No empate, os dois rolam de novo (p. 75). Se só um lado tirou 20 natural, ele vence (decisão do REGRAS.md, seção 12).
- **DT das habilidades e itens:** 10 + limite de PE + o atributo indicado (p. 78). **DT dos rituais:** 10 + limite de PE + Presença (p. 121).
- **Testes de resistência:** Fortitude, Reflexos ou Vontade contra a DT do efeito (p. 77).
- **Hora de declarar:**
  - bônus e dados extras de habilidades: antes de rolar;
  - rolar de novo: antes de o mestre anunciar o resultado (p. 78).
- **Escolher 10 ou 20:** não se usa em combate; os dois pedem calma (p. 76–77).
- **Contas:**
  - arredonda para baixo;
  - o resultado do teste de resistência entra primeiro;
  - multiplicadores se juntam: ×2 com ×2 dá ×3 (p. 312).
- **O que soma com o quê:**
  - bônus de fontes diferentes somam; da mesma fonte, não;
  - penalidades seguem a mesma regra (p. 312);
  - condições com o mesmo efeito não somam: vale a pior (p. 313).
- **Ajuda:** cada ajudante testa contra DT 10 e dá +1 ao líder, com +1 a cada 10 acima (p. 76). Em combate, o livro não diz que ação isso gasta (DC-2).

### 2.2 Como se rola (DC-3, decidido em 30/09)

**Sempre com dados físicos, na mesa, por enquanto.** Os jogadores e o mestre rolam os próprios dados, inclusive os das ameaças e os sorteios pequenos (d10 da camuflagem, d6 do confuso). O mestre digita o resultado na tela; o CRONA não sorteia nada.

| O que se rola | O que se digita |
|---|---|
| teste (ataque, perícia, resistência) | o d20 que ficou (1 a 20) |
| dano | a soma dos dados |
| Iniciativa | o total (cada agente o seu; o mestre, o do grupo dele) |

Os outros modos ficam guardados para depois, se um dia fizerem falta: **CRONA** (o servidor sorteia tudo) e **misto** (os jogadores com dado físico, o CRONA rola as ameaças).

- **Por que o d20 que ficou, e não o total:** o CRONA precisa dele para o 20 natural, para a margem de ameaça e para o empate. Quem preferir digita o total e marca "20 natural" ou "crítico".
- **Dano:** a tela já diz o que rolar, com o crítico incluído (ex.: "crítico ×2: role 2d8 e some 3"). Digita-se a soma dos dados. O CRONA soma o fixo e aplica resistência, vulnerabilidade e RD.
- **Rolagem do mestre:** fica só na tela do mestre. O jogador vê o que o mestre anunciar (DC-4 decide o que aparece para os jogadores).

## 3. Começo do combate

### 3.1 Passo a passo (LR p. 83–84, 169)

1. **Abrir a cena de ação.** O mestre abre o combate na cena atual. Entram as peças que ele escolher: agentes, NPCs e criaturas. Cada ser tem um lado: agentes (com os aliados), inimigos ou neutro.
2. **Quem percebeu quem.** O mestre diz quem está ciente dos inimigos.
   - Se os inimigos estavam sendo cautelosos, ele pode pedir Percepção dos agentes contra a Furtividade deles (p. 83).
   - Quem não percebeu fica **surpreendido** na 1ª rodada: desprevenido e sem ações (p. 84, 311).
   - Se nenhum lado percebeu o outro, não há combate.
   - Alguns poderes impedem a surpresa: quem os tem age mesmo tendo falhado na Percepção.
3. **Iniciativa.** Todos rolam no começo, até os surpreendidos (p. 83).
   - Cada agente rola a sua (dados de Agilidade + bônus de Iniciativa).
   - O mestre rola **uma vez** por todos os inimigos, usando o **menor** bônus de Iniciativa entre eles.
   - No empate, os empatados rolam de novo entre si.
   - A ordem vale o combate todo; ninguém rola de novo.
   - Surdo: −2d20 na Iniciativa (p. 311).
4. **Um turno só para o mestre** (p. 169). Todos os seres do mestre agem num único turno, na Iniciativa do grupo. Dentro desse turno, o mestre escolhe a ordem, e cada ser tem as próprias ações.
5. **Rodada 1.** Começa no maior resultado. Os surpreendidos ficam de fora até o fim da rodada 1; da rodada 2 em diante, todos agem (p. 84).

**No CRONA:**
- Abrir o combate traz as peças da cena (o mestre tira ou põe), sugere o lado pelo tipo e pergunta quem está ciente.
- Pede a Iniciativa de cada agente e a do grupo do mestre (ou rola, conforme o modo), já mostrando o menor bônus do grupo. No empate, aponta os empatados e pede o desempate.
- Guarda a ordem com o total e o desempate, e mostra de quem é a vez.
- **Opção `iniciativaFixa`** (SaH p. 119):
  - ninguém rola; o valor é o bônus + 3 por d20 (ex.: 1d20 dá 3; 3d20+10 dá 19);
  - empate entre agentes: um d20 oposto uma vez, e o vencedor fica na frente em todas as cenas;
  - empate entre agente e criatura: o agente age antes.

### 3.2 Quem chega depois (LR p. 83)

- Rola Iniciativa ao entrar e age na sua vez **na rodada seguinte**.
- **No CRONA:** entra na ordem já marcado "age a partir da rodada N+1".
- Um ser do mestre que chega depois passa a agir no turno do mestre da rodada seguinte (DC-5).

### 3.3 Mudar a ordem durante o combate

- **Atrasar** (ação livre, p. 87): age mais tarde. É o mesmo que baixar a própria Iniciativa pelo resto do combate.
  - Pode dizer o novo valor, ou esperar e agir quando quiser, e a Iniciativa fica ali.
  - **Limite:** até 0 − bônus de Iniciativa. Chegando lá, age ou perde o turno.
  - **Vários atrasando:** quem tem o maior bônus (ou a maior Agilidade, no empate) leva vantagem.
    - Se dois querem agir na mesma contagem, o de maior bônus age antes.
    - Se cada um quer agir depois do outro, o de maior bônus age depois.
- **Preparar** (ação padrão, p. 86): ver 5.2. Quando a ação preparada acontece, a Iniciativa fica logo acima daquela contagem pelo resto do combate.
- **Plano de Ação** (Tática veterana, DT 20, ação padrão, p. 48): +5 na Iniciativa de um aliado em alcance médio.
  - Se ele ainda não agiu e fica à sua frente, age logo depois de você.
  - Nas rodadas seguintes, vale a nova ordem.

**No CRONA:** botões "atrasar" (com valor, ou "vou agir agora" depois) e "preparar" (com o gatilho escrito). A ordem se reorganiza sozinha e o registro anota.
- Atrasar é agir mais tarde: só antes de usar a ação padrão, a de movimento ou a completa (pagar o sustentado e outras ações livres não impedem). Quando a vez volta, o turno não começa de novo: os contadores de morrendo e enlouquecendo, o sustentado e as condições do começo do turno não contam duas vezes, e o PE já gasto continua contando no limite do turno.

## 4. Rodada, turno e duração

### 4.1 Rodada e turno (LR p. 84, 169)

- A rodada tem uns 6 segundos. Começa no turno de maior Iniciativa e acaba depois do de menor.
- A rodada também mede o tempo entre uma contagem de Iniciativa e a mesma contagem na rodada seguinte. Um efeito de N rodadas acaba logo antes da contagem em que começou, N rodadas depois.

### 4.2 Durações que o CRONA precisa entender

| Duração no texto | Quando acaba |
|---|---|
| instantânea | na hora (as consequências ficam) |
| N rodadas | logo antes da mesma contagem de Iniciativa, N rodadas depois (p. 84) |
| até o seu próximo turno / até o início do seu próximo turno | quando o turno do dono começa de novo (ex.: a Defesa −5 da investida) |
| até o fim do seu próximo turno | no fim do próximo turno do dono (ex.: fintar) |
| enquanto X | quando X acaba (agarrado, se equilibrando, conjurando) |
| cena | no fim da cena. Condição sem duração escrita dura a cena (p. 311) |
| sustentada | enquanto o conjurador paga 1 PE no começo de cada turno dele (p. 120) |
| até sair (morrendo, efeitos de medo do SaH) | quando a condição de saída acontece |
| permanente | não acaba sozinha |

**No CRONA:** cada efeito guarda quem o criou, a rodada e a contagem em que começou, e a regra de fim. O servidor tira o efeito na hora certa e escreve no registro.

### 4.3 Começo do turno

O livro não diz em que ordem as coisas do começo do turno acontecem. Proposta (DC-6):

1. **Acabam** os efeitos que vencem agora (investida, "até o seu próximo turno", N rodadas).
2. **Contadores:** morrendo e enlouquecendo sobem 1. No 3º, morte ou insanidade (seções 10 e 11).
   - Opção `lesoes`: no 2º começo de turno morrendo, Vigor DT 10 (p. 174).
3. **Ritual sustentado:** paga 1 PE (ação livre) ou o ritual acaba (p. 120).
4. **Dano e testes que se repetem:**
   - em chamas: 1d6 de fogo (p. 310);
   - sangrando: Vigor DT 20; se passar, estabiliza e a condição sai; se falhar, perde 1d6 PV (p. 311);
   - veneno com dano por rodada (p. 293);
   - fumaça densa: Fortitude DT 10 +1 por teste já feito (p. 292);
   - ácido e lava (p. 290, 292).
5. **Cura acelerada** das ameaças (p. 179).
6. **Sorteios de comportamento:** confuso, 1d6 (p. 310).
7. **Quem não pode agir** (inconsciente, morrendo, atordoado, pasmo): o turno começa, para contar tudo acima, e passa sozinho. O paralisado só faz ações puramente mentais.
   - O surpreendido não tem turno na rodada 1 (p. 84): nada do começo do turno acontece para ele nessa rodada.

**No CRONA:** a lista aparece no começo do turno com o que vai acontecer. O mestre confirma e digita os dados que rolaram na mesa.

### 4.4 Fim do turno

- Esconder-se: Furtividade, ação livre só no fim do turno (p. 45).
- Efeitos "até o fim do seu (próximo) turno".
- Asfixiado: no fim do turno da última rodada de fôlego, fica morrendo (p. 310).

### 4.5 Começo e fim da rodada

- **Começo da rodada:**
  - clima (p. 290–291): granizo dá 1 de dano de impacto; tempestade tem 10% de chance de raio (8d10); vento forte tem 50% de chance de apagar chamas e dissipar névoa; furacão e tornado derrubam e arrastam;
  - tosse, desvantagem de idade: 1d6, e no 1 perde o turno (p. 174);
  - opção `inspiracaoResoluta`: o jogador do agente morto rola 1d10 (p. 174);
  - SaH: os eventos de furtividade e de perseguição (seção 21).
- **Fim da rodada:**
  - SaH, visibilidade da furtividade (seção 21);
  - opção `conjuracaoComplexa`: teste de concentração de quem está conjurando em condição ruim ou terrível (SaH p. 114).
- **Defesas especiais:** uma por rodada (seção 5.6), contando do começo do turno do próprio ser (DC-7).

## 5. Ações do turno

### 5.1 O que cabe num turno (LR p. 84–85)

- **Combinações possíveis:**
  - uma **padrão** e uma de **movimento**, em qualquer ordem;
  - ou **duas de movimento** (a padrão vira movimento; nunca o contrário);
  - ou uma **completa** (gasta as duas).
- **Livres:** quantas quiser, só no próprio turno. O mestre pode limitar o que for complexo demais ou valer "uma vez por rodada".
- **Reações:** quantas quiser, até fora do turno e até quando não pode agir (atordoado). Exceções:
  - as defesas especiais: uma por rodada, e nenhuma com atordoado;
  - quem está inconsciente não reage.
- **Ações extras** (de poderes, itens e regras opcionais) somam ao que cabe naquele turno.
- **Condições que mudam o turno:**

| Condição | O turno fica |
|---|---|
| enjoado | só uma padrão **ou** uma de movimento |
| atordoado, pasmo | sem ações |
| surpreendido | sem turno na rodada 1 |
| inconsciente | sem ações nem reações |
| paralisado | só ações puramente mentais |
| fascinado | só observar o que o fascinou. Qualquer ação hostil contra ele acaba a condição, e alguém pode sacudi-lo com uma ação padrão |
| apavorado | foge da fonte do medo do jeito mais eficiente. Se não puder fugir, age, mas não se aproxima dela |
| confuso | 1d6 no começo do turno (seção 12) |

- **Movimento em partes:** uma ação de movimento é um deslocamento contínuo. Na tela, a peça pode parar e seguir enquanto nenhuma outra ação acontecer no meio (proposta).

**No CRONA:** a tela mostra o que ainda cabe no turno e desconta ao escolher a ação. Se só sobra movimento, só oferece movimento. "Passar o turno" encerra.

### 5.2 Ações padrão

| Ação | Regra | Página |
|---|---|---|
| **Agredir** | um ataque corpo a corpo (alvo adjacente) ou à distância (alvo visível e no alcance; até o dobro, com −5). Pode virar manobra | p. 85 |
| **Manobra de combate** | no lugar de um ataque corpo a corpo (seção 9) | p. 85 |
| **Atropelar** | no meio do movimento (seção 9); livre durante a investida | p. 85–86 |
| **Conjurar ritual** | a maioria é padrão (seção 15) | p. 86, 119 |
| **Fintar** | Enganação (treinada) contra Reflexos de um ser em alcance curto. Se vencer, ele fica desprevenido contra o seu próximo ataque, se for feito até o fim do seu próximo turno | p. 44, 86 |
| **Preparar** | escolhe uma ação padrão, de movimento ou livre e o gatilho ("atiro no primeiro que passar pela porta"). Até o seu próximo turno, ela acontece como reação quando o gatilho vier. A Iniciativa passa a ficar logo acima de onde ela aconteceu. Não usou até o seu turno: perdeu | p. 86 |
| **Usar habilidade ou item** | quando a descrição pede ação padrão | p. 86 |
| **Primeiros socorros** | Medicina DT 20 (+5 por vez na cena) num adjacente morrendo (seção 10) | p. 46 |
| **Acalmar** | Diplomacia ou Religião (treinadas) DT 20 (+5 por vez na cena) num adjacente enlouquecendo (seção 11) | p. 44, 48 |
| **Assustar** | Intimidação (treinada) contra Vontade de um ser em alcance curto. Se vencer, abalado pela cena (não cumulativo); vencendo por 10 ou mais, apavorado por 1 rodada e depois abalado | p. 45 |
| **Plano de ação** | Tática (veterana) DT 20 (seção 3.3) | p. 48 |
| **Apagar as chamas** | tira o em chamas (entrar na água também tira) | p. 310 |
| **Sacudir** | acorda quem está inconsciente sem estar a 0 PV, ou tira o fascinado | p. 311 |
| **Soltar-se** | quem está agarrado vence um teste de manobra oposto | p. 85 |
| **Jogar um item para acertar algo** | largar é livre; jogar para acertar é padrão | p. 87 |
| **Furtar / Ocultar** | Crime DT 20 / Crime contra a Percepção de quem vê | p. 43–44 |

### 5.3 Ações de movimento

| Ação | Regra | Página |
|---|---|---|
| **Movimentar-se** | até o deslocamento (9 m = 12 casas). Nadar e escalar também usam esta ação | p. 87 |
| **Levantar-se** | sai do caído. Com Acrobacia treinada, pode testar DT 20 para levantar como ação livre (precisa ter a ação de movimento disponível; se falhar, gasta a ação e continua caído) | p. 41, 87 |
| **Manipular item** | pegar da mochila, abrir ou fechar porta, jogar uma corda, jogar um item para alguém pegar | p. 87 |
| **Mirar** | só com Pontaria treinada: tira o −5 de atirar em quem está em corpo a corpo, contra aquele alvo. Com fuzil de precisão e Pontaria veterana, +5 na margem de ameaça | p. 58, 87 |
| **Sacar ou guardar** | um item. Sacar arma de arremesso também gasta esta ação. A bandoleira (uma vez por rodada) e a modificação tática deixam livre. No CRONA, o "Sacar" da arma da mochila gasta a ação e põe a arma na mão | p. 54, 60, 65, 87 |
| **Recarregar** | besta, balestra e bazuca, a cada disparo. Na contagem de munição, qualquer arma quando esvazia | p. 58, 174 |
| **Reempunhar arma de duas mãos** | apoiar no chão para soltar uma mão é livre | p. 54 |
| **Apoiar a metralhadora** | no tripé; sem isso e sem Força 4, −5 no ataque | p. 59 |
| **Ligar a motosserra** | — | p. 59 |
| **Lanterna tática nos olhos** | um ser em alcance curto fica ofuscado por 1 rodada; depois, imune à lanterna pela cena | p. 65 |
| **Escalar, equilibrar-se** | Atletismo ou Acrobacia, um teste por ação; passando, anda metade do deslocamento (com −5 no teste, o deslocamento todo); falhando por 5 ou mais, cai. Enquanto isso fica desprevenido, e sofrer dano pede novo teste (falhou, cai) | p. 41–42 |
| **Nadar** | Atletismo por rodada; passando, anda metade do deslocamento; pode gastar a outra ação de movimento num segundo teste para andar mais; falhando por 5 ou mais, afunda | p. 42 |
| **Analisar terreno** | Tática DT 20: descobre uma vantagem (cobertura, camuflagem, lugar elevado) | p. 48 |
| **Pilotar** | uma ação de movimento por turno; teste em situação ruim ou terrível | p. 47 |
| **Montar** | Adestramento (DT 20 para montar como ação livre) | p. 42 |

### 5.4 Ações completas

| Ação | Regra | Página |
|---|---|---|
| **Corrida** | Atletismo: avança deslocamento + resultado do teste em quadrados (1 quadrado = 2 casas), em linha reta e fora de terreno difícil. Aguenta rodadas iguais ao Vigor; depois, Fortitude a cada rodada (DT 5 +5 por teste anterior). Falhou: fatigado | p. 42, 87 |
| **Investida** | até o dobro do deslocamento (mínimo 3 m), em linha reta, com um ataque corpo a corpo no fim: +1d20 no ataque e −5 na Defesa até o seu próximo turno. Não vale em terreno difícil. Atropelar vira livre, mas não no mesmo alvo do ataque | p. 87 |
| **Golpe de misericórdia** | alvo adjacente e indefeso: crítico automático e chance de morte na hora. Agentes e NPCs importantes morrem com 1 no 1d4; NPCs secundários, com 1 a 3 | p. 87 |
| **Conjurar ritual longo** | execução maior que completa: gasta uma completa por rodada, e fica desprevenido enquanto conjura | p. 87, 119 |
| **Usos de perícia** | escapar de amarras (Acrobacia), passar por espaço apertado (Acrobacia DT 25), identificar criatura (Ocultismo DT 20), tratamento (Medicina), instalar mina (Tática DT 15), arrombar (Crime), vestir ou tirar vestimenta, mudar atitude às pressas (Diplomacia com −10) | p. 41–49, 63–64 |

### 5.5 Ações livres

| Ação | Regra | Página |
|---|---|---|
| **Atrasar** | seção 3.3 | p. 87 |
| **Falar** | frases curtas (umas 20 palavras). Ritual e habilidade que dependem da voz não são livres | p. 87 |
| **Jogar-se no chão** | fica caído, sem dano | p. 87 |
| **Largar item** | largar é livre. Jogar para acertar algo é padrão; para alguém pegar, movimento | p. 87 |
| **Soltar quem está agarrando** | — | p. 85 |
| **Esconder-se** | Furtividade contra a Percepção de quem pode notar; só no fim do turno e num lugar que esconda. Quem falhar não o vê (camuflagem total). Quem andou no turno sofre −5 (andando só metade do deslocamento, não sofre); quem atacou ou fez algo chamativo sofre −15 (o silenciador tira 10 disso) | p. 45, 60 |
| **Pagar o ritual sustentado** | 1 PE no começo do turno | p. 120 |
| **Encerrar um ritual seu** | precisa estar no alcance | p. 120–121 |
| **Ritual de execução livre** | só um por rodada | p. 119 |
| **Habilidade sem ação escrita** | é livre | p. 78 |
| **Habilidade de aliado** | uma vez por rodada | p. 170 |

### 5.6 Reações e defesas especiais (LR p. 85, 88)

**Reações comuns:**
- testes de resistência e Percepção para notar algo;
- amortecer queda: Acrobacia veterana DT 15; reduz 1d6 do dano, mais 1d6 a cada 5 acima da DT; zerou, cai de pé (p. 41);
- identificar ritual: Ocultismo DT 10 + 5 por círculo (p. 47);
- a ação preparada;
- poderes de reação (ex.: Ataque de Oportunidade, p. 25) e rituais de execução "reação";
- as reações das ameaças.

**Defesas especiais:**
- só uma das três por rodada;
- nenhuma com atordoado;
- ameaças não usam (p. 179).

| Defesa | Precisa de | Quando | Efeito |
|---|---|---|---|
| **Bloqueio** | Fortitude treinada | é alvo de um ataque corpo a corpo; declara antes de o atacante rolar | RD igual ao bônus de Fortitude contra esse ataque |
| **Esquiva** | Reflexos treinada | é alvo de qualquer ataque; declara antes de o atacante rolar | soma o bônus de Reflexos na Defesa contra esse ataque |
| **Contra-ataque** | Luta treinada | um ataque corpo a corpo contra você errou | faz um ataque contra quem atacou |

- O bônus da perícia é o número dela (grau + bônus fixos), como no REGRAS.md.
- Desvantagem de idade gota: esquivar causa 1d6 de dano no próprio personagem (p. 173).

**No CRONA:**
- Quando um ataque é declarado contra um agente, a tela oferece bloqueio ou esquiva **antes** da rolagem, se ele tem a perícia treinada e ainda não usou a defesa da rodada.
- Se o golpe corpo a corpo errar, oferece o contra-ataque.
- O uso fica marcado até o começo do próximo turno dele (DC-7).

## 6. Ataque, passo a passo

(LR p. 54–60, 82, 85, 89–90)

1. **Quem ataca, com o quê, em quem.** Com a arma empunhada (da mochila), um ataque desarmado, uma arma improvisada ou o ataque da ficha da ameaça. O CRONA confere o alvo:
   - corpo a corpo: alvo adjacente, ou dentro do alcance natural dos seres grandes;
   - à distância: alvo visível, até o alcance da arma sem penalidade, ou até o dobro com −5; além disso, não dá;
   - arma sem alcance pode ser arremessada em alcance curto, com −5 (p. 55);
   - cobertura total: não pode ser alvo.
2. **Teste de ataque** (p. 82): Luta no corpo a corpo (dados de Força) e Pontaria à distância, arremesso incluído (dados de Agilidade). Armas ágeis podem usar Agilidade no ataque e no dano (p. 59). O CRONA soma:
   - o bônus da perícia e o da arma (certeira ou alongada, +2; p. 60–61);
   - habilidades declaradas antes de rolar (ex.: Ataque Especial, pagando PE);
   - situações e condições (seção 7);
   - penalidades de arma: sem proficiência −2d20 (p. 54); improvisada −1d20 (p. 57); rajada −1d20, que o compensador anula (p. 59–60); motosserra −2; metralhadora sem Força 4 e sem tripé −5 (p. 59);
   - dano não letal (só com arma corpo a corpo), ou letal com ataque desarmado e armas não letais: −5 (p. 88).
3. **Defesa do alvo:** a da ficha, mais os modificadores (seção 7), mais a esquiva, se ele usou.
4. **Chance de falha:** camuflagem, atacante cego, alvo agarrado por outro. Rola 1d10 junto (7.3).
5. **Resultado:**
   - total ≥ Defesa acerta; 20 natural acerta sempre;
   - **crítico:** acertou e o d20 que ficou é igual ou maior que a margem de ameaça da arma. A margem padrão é 20; mira laser e perigosa dão +2 na margem (p. 54, 60–61).
6. **Dano:** seção 8.
7. **Depois do ataque:**
   - acertou: efeitos da arma (lança-chamas deixa em chamas; veneno na lâmina; pistola de dardos; taser), concentração de quem estava conjurando (seção 15) e dano massivo (8.5);
   - errou um golpe corpo a corpo: o alvo pode contra-atacar.

- **Vários ataques** (Combater com Duas Armas, ameaça com "Corpo a corpo x2"): cada ataque tem seu teste e seu dano. A defesa especial da rodada vale para um só.
- **Ataques em área:**
  - lança-chamas: um teste só, comparado com a Defesa de cada ser na linha;
  - granadas e bazuca: os seres na área fazem o teste de resistência do item (seção 16).

## 7. Situações, modificadores e o tabuleiro

### 7.1 Tabela 4.4 e o que o tabuleiro vê (LR p. 89–90, 310–311)

| Situação | Efeito | O CRONA descobre sozinho? |
|---|---|---|
| atacante caído | −2d20 no ataque corpo a corpo (seção 22) | sim, pela condição |
| atacante cego | 50% de chance de falha | sim, pela condição ou pela escuridão total |
| atacante em posição elevada | +1d20 | sim: piso ou mobi mais alto que o alvo (DC-9) |
| flanqueando o alvo | +1d20, só corpo a corpo (o texto diz +2; chave `flanquearNumerico`) | sim (7.2) |
| atacante invisível | +2d20 (não contra alvo cego) | sim, pela condição ou efeito |
| atacante ofuscado | −1d20 | sim |
| alvo caído | Defesa −5 contra corpo a corpo e +5 contra ataque à distância | sim |
| alvo cego ou desprevenido | Defesa −5 | sim |
| alvo que não percebe o atacante | desprevenido contra ele (Defesa −5), p. 310. Perceber um ser que não se vê: Percepção DT 20, ou a Furtividade dele + 10, o que for maior; mesmo percebendo, valem as penalidades de lutar sem ver (p. 47) | em parte: escondido, invisível, escuridão |
| alvo vulnerável | Defesa −5 (não soma com o desprevenido) | sim |
| alvo indefeso | Defesa −10 (já inclui o desprevenido) | sim |
| alvo sob camuflagem | 20% de falha; camuflagem total, 50% | em parte: escuridão e névoa da cena (7.2) |
| alvo sob cobertura | Defesa +5; cobertura total: não pode ser alvo | sim (7.2), com ajuste do mestre |
| atirar em quem está em corpo a corpo | −5 (mirar anula contra aquele alvo) | sim: o alvo está adjacente a algum inimigo dele (você incluído) |
| alvo além do alcance, até o dobro | −5 | sim |
| investida | +1d20 no ataque; −5 na própria Defesa até o próximo turno | sim |
| vento forte / vendaval | −2 / −5 no ataque à distância; furacão ou tornado: sem ataque à distância | pelo clima da cena (seção 19) |
| sobrecarregado (mochila) | Defesa −5, −5 nas perícias com penalidade de carga, deslocamento −3 m (p. 53, 89) | sim, pela mochila |

### 7.2 Medidas do tabuleiro (DC-8 a DC-12)

**Escala:**
- 1 quadrado do livro (1,5 m) = 2 casas do CRONA (REGRAS.md, decisão 6).
- 1 casa vale 0,75 m, nas regras e no desenho (desde 03/10 a arte segue essa escala: os móveis no tamanho de verdade e a pessoa com 1,80 m).

| Metros | 1,5 | 3 | 4,5 | 6 | 9 (curto, deslocamento) | 18 (médio) | 36 (longo) | 90 (extremo) |
|---|---|---|---|---|---|---|---|---|
| Casas | 2 | 4 | 6 | 8 | 12 | 24 | 48 | 120 |

**Espaço de cada ser:**
- Médios e menores ocupam 1 quadrado. No CRONA, a peça fica numa casa, e em combate nenhuma outra peça para a menos de 2 casas dela (sobra uma casa livre entre duas peças).
- Assim cabem no máximo 8 seres Médios em volta de outro, como no livro.
- Grande ocupa 4×4 casas; Enorme, 6×6; Colossal, 12×12 (p. 179).
- Alternativa: uma grade de combate com quadrados de 2×2 casas (DC-8).

**Adjacente:**
- Até 2 casas em qualquer direção, diagonal incluída (a maior das duas diferenças ≤ 2).
- Com alcance natural maior (Grande 3 m, Enorme 4,5 m, Colossal 9 m; p. 179), alcança 4, 6 ou 12 casas a partir da borda do espaço.

**Movimento** (p. 89):
- conta casas: a diagonal vale 2, e terreno difícil vale o dobro;
- passa por aliado, mas não para na casa dele;
- só passa por inimigo se ele estiver indefeso, se tiverem 3 categorias de tamanho de diferença, com Acrobacia (passar por inimigo) ou atropelando. Inimigo caído conta como uma categoria de tamanho menor para isso;
- voando ou nadando, subir custa o dobro (o triplo na diagonal) e descer custa metade (o normal na diagonal);
- sobrecarregado: −3 m (4 casas).

**Alcance e área:** o livro só manda dobrar a diagonal no movimento. Para alcance e áreas (esfera, cone), o CRONA mede em linha reta entre os centros, como um raio de verdade (DC-10).

**Flanquear** (p. 90):
- você e um aliado estão adjacentes ao alvo, em lados opostos: a reta entre os centros de vocês dois passa pelo espaço dele;
- os dois precisam estar lutando: conscientes e capazes de atacar corpo a corpo;
- nunca à distância.

**Cobertura** (p. 89):
- o atacante escolhe o canto da casa dele que for melhor para ele;
- se alguma reta desse canto até um canto da casa do alvo passa por parede, mobi alto ou outro ser, o alvo tem cobertura (+5);
- a reta que só encosta na ponta ou corre ao longo do obstáculo não conta;
- se todas as retas de todos os cantos batem em parede, porta fechada ou mobi que tape o corpo todo, é **cobertura total**;
- proposta para os mobis (DC-11, revista em 07/10 como DC-24, aprovada pelo Felipe): a altura do móvel contra a do corpo do alvo. O corpo tem **1,8 m em pé** e **1,0 m agachado** (o botão Agachado, no combate e no painel do personagem). O móvel ou escombro com **44% do corpo ou mais** (0,8 m em pé, 0,45 m agachado) dá cobertura (+5); com **o corpo inteiro ou mais** (1,8 m em pé, 1,0 m agachado) tapa tudo, e é cobertura total. O nome do móvel e a altura dele aparecem na chave e no tabuleiro. O mestre corrige na hora.

**Linha de visão e linha de efeito** (p. 85, 120):
- paredes, portas fechadas e mobis altos cortam as duas;
- ataque à distância precisa ver o alvo; ritual com alvo precisa percebê-lo;
- todo ritual precisa de linha de efeito até o alvo, a área ou o ponto do efeito.

**Posição elevada:** o piso da peça (ou o mobi em que ela está) está pelo menos 1 m acima do alvo, umas 2 unidades de altura da planta (DC-9).

**Terreno difícil:**
- mobis marcados como tal (sofá, entulho, arame farpado), neve e água rasa;
- a casa de um inimigo que se atravessa com Acrobacia (p. 41, 89).

**Portas:** abrir ou fechar é ação de movimento. Fechada, bloqueia passagem, visão e linha de efeito.

**Escuridão** (p. 89, 310):
- a escuridão da cena dá camuflagem (penumbra) ou camuflagem total (escuridão total);
- quem está em escuridão total sem visão no escuro fica cego;
- a faixa de cada nível de escuridão é a DC-12.

**Névoa:** neblina dá camuflagem. Neblina espessa dá camuflagem a 1,5 m e camuflagem total além disso (p. 290). O campo névoa da cena pode sugerir.

**O que o tabuleiro já tem e ajuda:** caminho em casas, portas com estado aberto ou fechado, altura do piso, altura dos mobis em metros, escuridão e névoa por cena.

### 7.3 Chance de falha (LR p. 85, 89, 313)

- **Valores:**
  - camuflagem: 20% (1 ou 2 no d10);
  - camuflagem total: 50% (1 a 5 no d10);
  - atacante cego, contra qualquer alvo: 50%;
  - ataque à distância contra quem está agarrado (ou agarrando): 50% de acertar o outro.
- **Somando:** de fontes diferentes, as chances somam até 75%. Sempre sobra 1 chance em 4 de acertar.
- **O que tira a chance de falha:**
  - visão de calor, na arma, ignora a camuflagem;
  - óculos de visão térmica tiram a penalidade da camuflagem (p. 60, 66);
  - faro, visão na penumbra, visão no escuro e percepção às cegas das ameaças (seção 17).

**No CRONA:** rola (ou pede) o d10 junto do ataque e só depois mostra acerto ou erro. Os 75% (o teto da soma) não cabem no d10: pede o d4, e falha de 1 a 3.

## 8. Dano e cura

### 8.1 Quanto dano (LR p. 54–59, 82)

- **Dados da arma**, somando:
  - Força no corpo a corpo e no arremesso (Agilidade, se a arma for ágil);
  - nada nas armas de disparo e de fogo, exceto o arco composto, que soma Força.
- **Bônus fixos:** cruel +2, soqueira +1 no desarmado, habilidades (ex.: Ataque Especial no dano).
- **Dados a mais:**
  - rajada: +1 dado da arma;
  - munição explosiva: +2d6;
  - calibre grosso: +1 dado, que passa a fazer parte do dano da arma (revólver 3d6);
  - Ataque Furtivo e parecidos.
- **Casos de arma:**
  - desarmado: 1d3 não letal, conta como arma leve (p. 57);
  - improvisada: 1d6, uma mão (p. 57);
  - espingarda: metade do dano em alcance médio ou mais (p. 58);
  - motosserra: cada 6 no dado de dano rola mais um dado (p. 59).
- **Tipos:** cada parte do dano tem seu tipo.
  - armas: corte, impacto, perfuração, balístico;
  - rituais, criaturas e perigos: fogo, frio, eletricidade, químico, mental e paranormal com elemento (p. 82).

### 8.2 Crítico (LR p. 54, 82, 313)

- Multiplica **só os dados da arma** (×2 padrão; ×3; ×4; Dum Dum dá +2 no multiplicador).
- Bônus fixos e dados extras não multiplicam. Exemplos de extra: Ataque Furtivo, munição explosiva, rajada (DC-13).
- Alvo imune a crítico sofre o dano normal.
- **Fortificação:** chance de ignorar o extra do crítico e do ataque furtivo. Soma sempre, de qualquer fonte; com 100%, é imune.
- O golpe de misericórdia é crítico automático.

### 8.3 Ordem para aplicar (LR p. 312–313)

1. Rola e soma cada parte.
2. Imune ao tipo: a parte vira 0.
3. Teste de resistência: metade (arredonda para baixo). Sempre primeiro.
4. Outras reduções à metade (ex.: Casca Grossa).
5. Vulnerável: dobra. Multiplicadores se juntam (dois ×2 dão ×3).
6. Tira a RD do tipo e a RD geral. De fontes diferentes, as duas somam.
7. Tira dos PV (ou da SAN, se for mental). Nunca fica abaixo de 0.

- Com a opção `medoEmJogo`, o dano mental que vem do medo é sempre no mínimo 1 (seção 21.1). Não confundir com o dano de Medo, o subtipo paranormal do item seguinte.
- **Grupos:** a RD, a imunidade e a vulnerabilidade a "físico" valem nos quatro tipos das armas, e as a "paranormal" nos cinco elementos (o dano paranormal sempre tem o subtipo de um, p. 82). O mental não é paranormal.
- **Dano de Medo** é paranormal e tira PV; o dano mental é outro tipo e tira SAN (p. 82). Nos rituais de Medo que ferem: Conhecendo o Medo é mental (p. 127); a Lâmina do Medo é de Medo e ignora as resistências (p. 135); a Presença do Medo dá os dois, mental e de Medo (p. 139). A tela do ritual já vem com o tipo de cada um, marca "Ignora a RD" na Lâmina e tem um segundo dano, de outro tipo, para a Presença.
- **Dano a mais de outro tipo** ("3d6 de Morte e 1d8 mental", p. 221): a ficha rápida guarda à parte, a tela pede a soma de cada um e cada parte vai para o seu lugar.

### 8.4 Dano não letal (LR p. 88)

- Soma com o letal para desmaiar, mas não para morrendo.
- A cura tira primeiro o não letal.

**No CRONA:**
- o combate guarda o dano não letal de cada ser à parte (`naoLetal`); os PV da peça só caem com o letal;
- PV atual − não letal ≤ 0: inconsciente e caído, sem morrendo;
- PV 0 por dano letal: morrendo;
- dano massivo com o não letal: Fortitude como sempre; se falhar, fica inconsciente, sem morrendo (o não letal não deixa morrendo);
- a cura tira primeiro o não letal: o mestre muda o número no cartão do alvo ("Dano não letal · Mudar"), e quem estava desmaiado acorda (continua caído);
- ao encerrar o combate, o registro lembra quem ainda tem dano não letal.

### 8.5 Dano massivo (LR p. 88)

- Um único dano maior ou igual à metade dos PV totais, que não zera os PV, pede Fortitude DT 15 + 2 a cada 10 pontos de dano (ex.: 23 de dano, DT 19).
- Falhou: vai a 0 PV (inconsciente e morrendo).
- Opção `ferimentosDebilitantes` (SaH p. 105): em vez de ir a 0 PV, sofre um ferimento debilitante (21.2).

**No CRONA:** o teste aparece sozinho logo depois do dano.

### 8.6 Cura e pontos temporários

- A cura nunca passa do máximo.
- Pontos temporários passam do máximo, são gastos primeiro e somem: os de PV e PE no fim do dia, e os PE de Gladiador Paranormal no fim da cena.
- Cura de 1 PV ou mais tira o inconsciente. Morrendo: seção 10.2.
- **Fontes comuns no combate:**
  - primeiros socorros: deixa com 1 PV;
  - cicatrizante: 2d8+2, ação padrão, em você ou num adjacente (p. 65);
  - aliado socorrista: 1 PE, 1d8+1 (p. 171);
  - rituais e poderes.

## 9. Manobras de combate

(LR p. 85–86, 90, 179)

- Trocam um ataque corpo a corpo; nunca à distância.
- **Teste oposto de manobra:** Luta contra Luta. O alvo usa Luta mesmo segurando arma à distância. Empate: repete.
- **Modificadores:**
  - tamanho (Tab. 7.1, p. 179): Minúsculo −5, Pequeno −2, Médio 0, Grande +2, Enorme +5, Colossal +10;
  - criança (Tampinha) −5 e a desvantagem de idade definhamento −5 (p. 172–173);
  - a corrente dá +2 para desarmar e derrubar (p. 58).

| Manobra | Se vencer | Detalhes |
|---|---|---|
| **Agarrar** | o alvo fica agarrado | ver o quadro abaixo |
| **Derrubar** | o alvo fica caído | vencendo por 5 ou mais, também o empurra 1 quadrado (2 casas) para onde você escolher. Se isso o jogar de uma beirada, ele faz Reflexos DT 20 para se segurar |
| **Desarmar** | o item cai na casa do alvo | vencendo por 5 ou mais, o item vai 1 quadrado adiante, na direção que você escolher |
| **Empurrar** | o alvo vai 1,5 m (2 casas) | mais 1,5 m a cada 5 de diferença. Gastando uma ação de movimento, você pode ir junto |
| **Quebrar** | acerta um item que o ser segura | Defesa, RD e PV do objeto (Tab. 4.5 abaixo) |
| **Atropelar** | o alvo cai e você passa | ação padrão no meio do movimento (livre na investida, sem atacar o mesmo alvo). O alvo pode deixar passar, sem teste. Perdendo, o avanço para |

**Agarrar, em detalhe:**
- Só com ataque desarmado, usando uma mão.
- **O agarrado:** fica desprevenido e imóvel, só ataca com arma leve e sofre −1d20 no ataque (−2 no capítulo 4; chave `agarradoNumerico`). Para se soltar, gasta uma ação padrão e vence um teste de manobra oposto.
- **Quem agarra:**
  - fica com uma mão ocupada e anda à metade, arrastando o alvo;
  - solta com ação livre;
  - ataca com a mão livre, ou troca um ataque por um teste de manobra para causar o dano desarmado (impacto).
- Ataque à distância contra qualquer um dos dois tem 50% de chance de acertar o outro.
- **Algemar:** com a algema na mão, agarra e vence um novo teste de agarrar (p. 64).

**Tab. 4.5, objetos comuns** (p. 90). Objeto solto: ataque contra a Defesa dele (+5 se estiver em movimento).

| Objeto | Tamanho | Defesa | RD | PV |
|---|---|---|---|---|
| folha de papel | Minúsculo | 15 | 0 | 1 |
| corda | Minúsculo | 15 | 0 | 2 |
| corrente | Minúsculo | 15 | 10 | 2 |
| cadeira | Pequeno | 12 | 5 | 5 |
| caixote | Médio | 10 | 5 | 10 |
| porta de madeira | Grande | 8 | 5 | 20 |
| porta de metal | Grande | 8 | 8 | 50 |
| portão de grades | Grande | 8 | 10 | 50 |
| carro | Enorme | 5 | 10 | 100 |

- **Armas:**
  - de madeira: RD 5; PV 2 (leve), 5 (uma mão), 10 (duas mãos);
  - de metal: RD 10; PV 5, 10, 20.
- Objeto a 0 PV quebra, e só volta a funcionar depois de consertado no interlúdio.

**No CRONA:**
- empurrão e derrubada mexem na peça sozinhos, em linha reta, até a primeira casa bloqueada ou ocupada; o mestre ajusta o resto;
- caído deita a peça;
- o item desarmado vai para o registro (onde caiu); o mestre tira da mão na ficha. Item no chão da cena fica para depois;
- quebrar usa a Tab. 4.5 (o mestre escolhe o objeto). Defesa, RD e PV nos mobis do tabuleiro ficam para depois.

## 10. PV, morrendo e morte

(LR p. 46, 87–88, 174–175, 311)

### 10.1 Faixas

- **Machucado:** PV abaixo da metade do total. Não tem efeito próprio; é pré-requisito de poderes e criaturas.
- **0 PV:** inconsciente e morrendo. PV nunca fica negativo.

### 10.2 Morrendo

- **Contagem:** conta cada turno que o personagem **começa** morrendo, na mesma cena (não precisa ser seguido). No 3º, morre (p. 88).
- **Saídas:**
  - o inconsciente sai com qualquer cura de 1 PV ou mais;
  - o morrendo sai com Medicina DT 20 ou com um efeito específico (p. 88); pelo apêndice, sai ao voltar a 1 PV (p. 311);
  - o CRONA usa "ao voltar a 1 PV"; a chave `morrendoEstrito` exige a Medicina.
- **Primeiros socorros** (p. 46):
  - Medicina DT 20, ação padrão, num alvo adjacente;
  - +5 na DT a cada vez que ele já foi estabilizado nesta cena;
  - sem kit de medicina, −5;
  - tira morrendo e inconsciente e deixa com 1 PV.
- **Golpe de misericórdia** (5.4): pode matar na hora, pelo d4.
- **Opção `lesoes`** (p. 174): no 2º começo de turno morrendo na cena, Vigor DT 10. Se falhar, perde 1 ponto de atributo para sempre (1d6: Agi, For, Int, Pre, Vig; no 6, nada).
- **Opção `inspiracaoResoluta`** (p. 174–175): o jogador do agente morto rola 1d10 no começo de cada rodada, até o fim da cena, e dá o efeito a outro agente.

**No CRONA:**
- contador de morrendo por personagem e por cena, à vista na ordem e na carta ("morrendo 1/3");
- o turno de quem está morrendo começa (conta e aplica o começo do turno) e passa sozinho;
- no 3º turno, o CRONA marca "morto" e o mestre confirma (dá para desfazer);
- guarda quantas vezes cada personagem foi estabilizado na cena, para a DT subir;
- NPCs e criaturas a 0 PV: seção 17.4.

## 11. SAN, enlouquecendo e insanidade

(LR p. 44, 48, 88, 111–113, 175)

- **Dano mental:** tira SAN em vez de PV. A resistência mental reduz (p. 111).
- **Perturbado:** SAN abaixo da metade. Sem penalidade.
  - Opção `efeitosInsanidade`: na 1ª vez na cena, 1d20 na Tab. 5.1 (p. 113), um efeito de interpretação.
- **Enlouquecendo:** SAN 0.
  - Conta cada turno começado assim, na mesma cena. No 3º, fica **insano**: o personagem passa para o mestre (p. 88).
  - Mesmo estabilizado, o efeito de insanidade passa a durar até o fim da missão (p. 111).
- **Saídas:**
  - **acalmar:** Diplomacia ou Religião (treinadas), DT 20 +5 a cada vez que ele já foi acalmado na cena, ação padrão, alvo adjacente; deixa com SAN 1 (p. 44, 48);
  - qualquer cura de 1 SAN ou mais (p. 88).
- **Perdas permanentes:** o Custo do Paranormal e os rituais de Medo tiram SAN máxima (seção 15).
- **Opção `loucuraNaoLetal`** (p. 175): o insano fica com o jogador e rola 1d6 na tabela de efeitos de insanidade.
- **Opção `medoEmJogo`** (SaH): troca estas regras (21.1).

**No CRONA:** igual ao morrendo. Contador "enlouquecendo 1/3", acalmadas da cena contadas por personagem, e o insano passa a ficha para o mestre, com confirmação.

## 12. Condições no combate

(LR p. 310–311, 313)

- **Regras gerais:**
  - duram a cena, salvo indicação;
  - várias condições valem juntas, mas efeitos iguais não somam: vale o mais severo;
  - as condições que "incluem" outras (exausto inclui lento) já vêm com elas (`shared/src/regras/dados/condicoes.ts`).
- **Escadas:**
  - abalado de novo vira apavorado;
  - fraco de novo vira debilitado, e debilitado de novo vira inconsciente;
  - fatigado de novo vira exausto, e exausto de novo vira inconsciente;
  - frustrado de novo vira esmorecido.
- **Imunidades:** criaturas são imunes às condições mentais e de medo (p. 180).

| Condição | O que o combate aplica sozinho | Como acaba |
|---|---|---|
| abalado | −1d20 em todos os testes | cena |
| agarrado | desprevenido e imóvel; −1d20 no ataque; só arma leve | soltar-se ou ser solto |
| alquebrado | +1 PE no custo de habilidades e rituais | cena |
| apavorado | −2d20 em perícias; foge da fonte do medo (a peça se afasta; pode parar ao perdê-la de vista ou passar do alcance médio) | cena ou o que o causou |
| asfixiado | aguenta Vigor + 1 rodadas; cada dano sofrido tira 1; no fim do turno da última, morrendo | quando volta a respirar |
| atordoado | desprevenido; sem ações; sem defesas especiais | pela duração |
| caído | −2d20 no ataque corpo a corpo; Defesa −5 contra corpo a corpo e +5 contra distância; anda 1,5 m; conta como condição ruim para rituais | levantar-se |
| cego | desprevenido e lento; −2d20 em perícias de Agilidade e Força; sem Percepção pela visão; os alvos dele têm camuflagem total | pela causa |
| confuso | 1d6 no começo do turno: 1, anda numa direção sorteada no 1d8; 2–3, não age; 4–5, ataca o ser mais perto com a arma que tiver (sozinho, a si mesmo: só rola o dano); 6, a condição acaba | no 6, ou na cena |
| debilitado | −2d20 em testes de Agilidade, Força e Vigor | cena |
| desprevenido | Defesa −5; −1d20 em Reflexos | pela causa |
| doente | conforme a doença (p. 291–292) | curar |
| em chamas | 1d6 de fogo no começo do turno | ação padrão para apagar, ou água |
| enjoado | só uma padrão ou uma de movimento por turno | cena |
| enredado | lento e vulnerável; −1d20 no ataque | pela causa |
| envenenado | conforme o veneno (p. 293); o dano por rodada de venenos sempre soma | pela duração do veneno (sem duração: cena) |
| esmorecido | −2d20 em testes de Intelecto e Presença | cena |
| exausto | debilitado, lento e vulnerável | cena, ou conforme a causa |
| fascinado | −2d20 em Percepção; só observa | ação hostil contra ele, ou alguém o sacode (ação padrão) |
| fatigado | fraco e vulnerável | cena, ou conforme a causa |
| fraco | −1d20 em testes de Agilidade, Força e Vigor | cena |
| frustrado | −1d20 em testes de Intelecto e Presença | cena |
| imóvel | deslocamento 0 | pela causa |
| inconsciente | indefeso; sem ações nem reações; a peça deita | cura de 1 PV ou mais; quem não está a 0 PV acorda sacudido (ação padrão) |
| indefeso | desprevenido com Defesa −10; falha em Reflexos; pode sofrer golpe de misericórdia | pela causa |
| lento | metade do deslocamento (para baixo, em passos de 1,5 m); sem corrida nem investida | pela causa |
| morrendo | seção 10 | seção 10 |
| ofuscado | −1d20 no ataque e em Percepção | pela duração |
| paralisado | imóvel e indefeso; só ações mentais | pela duração |
| pasmo | sem ações | pela duração |
| petrificado | inconsciente, com RD 10 | pela causa |
| sangrando | Vigor DT 20 no começo do turno; passou, estabiliza e a condição sai; falhou, perde 1d6 PV | passar no teste, ou fim da cena |
| surdo | −2d20 na Iniciativa; sem Percepção pela audição; conta como condição ruim para rituais | pela causa |
| surpreendido | desprevenido; sem ações | fim da rodada 1 |
| vulnerável | Defesa −5 | pela causa |

- **Assustar** (p. 45) diz que o abalado dele "não é cumulativo": assustar de novo não leva a apavorado. Outra fonte de medo leva (seção 22).
- **0 PV e caído:** o livro não diz que quem cai inconsciente fica caído. Proposta: a peça deita, e ao acordar está caída (DC-19).

## 13. DTs que sobem e contadores

Cada contador tem dono, escopo (turno, cena, combate, dia, sessão) e zera sozinho.

| O quê | Teste e DT base | Como sobe | Zera | Página |
|---|---|---|---|---|
| Primeiros socorros | Medicina 20 | +5 por vez que o alvo já foi estabilizado na cena | fim da cena | LR p. 46 |
| Acalmar | Diplomacia ou Religião 20 | +5 por vez que o alvo já foi acalmado na cena | fim da cena | LR p. 44, 48 |
| Acalmar (medo em jogo) | Diplomacia, Profissão (psicólogo) ou Religião; DT base não escrita (DC-21) | +5 por vez na cena | fim da cena | SaH p. 88 |
| Corrida | Fortitude 5, depois das rodadas iguais ao Vigor | +5 por teste anterior | quando para de correr | LR p. 42 |
| Prender a respiração (natação) | Fortitude 5, depois das rodadas iguais ao Vigor | +5 por teste anterior | quando respira | LR p. 42 |
| Sufocamento | Fortitude 5, depois das rodadas iguais ao Vigor | +5 por teste anterior | quando respira | LR p. 293 |
| Fumaça densa | Fortitude 10, no começo de cada turno | +1 por teste | quando sai da fumaça | LR p. 292 |
| Dano massivo | Fortitude 15 | +2 a cada 10 pontos de dano | — | LR p. 88 |
| Alucinações, loucura homicida (loucura não letal) | Vontade 20, no começo de cada cena | +5 por teste já feito | — | LR p. 175 |
| Calor ou frio extremo | Fortitude 5 | +5 por teste anterior (por dia ou por minuto) | ao sair do clima | LR p. 290 |
| Fome, sede, sono | Fortitude 15 | +1 por teste anterior (por dia) | ao comer, beber ou dormir | LR p. 292–293 |
| Testes estendidos difíceis | a do teste | +2 a cada teste | fim do teste | LR p. 78 |
| Efeitos do medo | 2d10 na tabela | +1 por efeito anterior na cena | fim da cena | SaH p. 88 |
| Distrair (furtividade) | Enganação 15 | +5 por uso na cena | fim da cena | SaH p. 93 |
| Esforço extra (perseguição) | — | perde 1d4 PV por vez que usou na cena, contando esta (1d4, depois 2d4...) | fim da cena | SaH p. 90 |
| Presença perturbadora de várias criaturas | a DT da de maior VD | +1d6 no dano por criatura a mais | — | LR p. 180 |

**Outros contadores do combate:**
- turnos morrendo e enlouquecendo;
- rodadas de fôlego (asfixiado, prender a respiração) e de corrida;
- vezes estabilizado e acalmado na cena;
- defesa especial da rodada e PE gasto no turno;
- usos "uma vez por rodada" e "uma vez por cena" de habilidades e itens;
- recarga das ameaças (SaH);
- cargas de itens (taser, spray, dardos, granadas);
- cenas de munição.

## 14. Habilidades, poderes e PE

(LR p. 23, 78, 310, 312)

- **Ação:** vem na descrição. Sem ação escrita, é livre.
- **Gatilho:** habilidade que dispara por um evento (ex.: ao atacar) vale uma vez por evento.
- **PE:** é gasto mesmo se a habilidade falhar.
- **Limite de PE por turno:** o da Tab. 1.2 (p. 23): 1 em NEX 5%, mais 1 a cada NEX, até 20 em 99%. É a soma de tudo o que se gasta no turno.
  - Exceção: sempre dá para usar uma habilidade no custo mínimo por turno, mesmo acima do limite (ex.: Ataque Especial a 2 PE em NEX 5%).
  - O C.R.I.S deixa o primeiro gasto passar inteiro; o CRONA segue o livro, só no custo mínimo (seção 22).
  - Reações fora do turno: o livro não diz em qual turno o gasto conta. Proposta: o limite vale do começo do seu turno até o começo do próximo (DC-14).
- **Reduções de custo:** não somam; o custo mínimo é 1 PE (p. 78). Alquebrado: +1 PE (p. 310).
- **DT de resistência:** 10 + limite de PE + atributo (p. 78).

**O que o combate precisa saber de cada poder** (campos novos no catálogo):
- ação: livre, reação, movimento, padrão ou completa;
- gatilho: ao atacar, ao acertar, ao ser atacado, no começo do turno;
- custo em PE, fixo ou variável;
- limite de usos: por rodada, por cena;
- efeito em termos de combate: bônus no ataque ou no dano, dados extras, margem ou multiplicador, ataque extra, DT, condição no alvo, RD, cura, PE temporários, movimento extra.

Poderes que mexem direto no combate (só nome e página): Ataque Especial (p. 24), Ataque de Oportunidade, Combate Defensivo e Combater com Duas Armas (p. 25), Ataque Extra, Cai Dentro e Casca Grossa (p. 27), Ataque Furtivo, Assassinar e Atirar para Matar (p. 30), Conjuração Marcial (p. 35).

**A automação vai por partes:**
1. os poderes que só somam número (bônus, dados, DT, RD): um botão "usar" que já desconta o PE;
2. os poderes com gatilho: viram lembrete na hora certa;
3. o resto: anotação livre no registro.

## 15. Rituais no combate

### 15.1 Conjurar (LR p. 47, 64, 97, 117–121, 171)

- **Custo:**
  - ação do ritual + PE do círculo (1, 3, 6 ou 10; Tab. 5.2, p. 119);
  - + a forma discente ou verdadeira, se usar (uma por conjuração);
  - o custo total não passa do limite de PE (p. 121).
- **Mãos e componentes:**
  - precisa de uma mão livre para gesticular e de componentes do elemento;
  - Medo não usa componentes; a afinidade e o aliado acólito dispensam (p. 171);
  - algemas nos dois pulsos impedem conjurar (p. 64).
- **É chamativo:** todos à volta percebem (p. 119). Identificar o ritual: reação, Ocultismo DT 10 + 5 por círculo (p. 47).
- **Concentração** (Vontade; se falhar, o ritual não sai e os PE se perdem):
  - sofreu dano durante a conjuração: DT igual ao dano. Em ritual de ação padrão ou menos, isso só acontece com dano de reação ou dano contínuo;
  - condição ruim: DT 15 + custo (caído, veículo em movimento, tempestade; surdo conta como ruim, p. 311);
  - condição terrível: DT 20 + custo (agarrado, veículo em alta velocidade, terremoto).
- **Execução:**
  - livre (só um por rodada, contando os acelerados), reação, movimento, padrão ou completa;
  - mais longa que completa: uma completa por rodada, desprevenido enquanto conjura.
- **Alcance:** pessoal, toque (tocar faz parte da ação, sem teste), curto, médio, longo, extremo, ilimitado. Área que passe do alcance é afetada inteira (p. 119).
- **Alvo, área, efeito** (p. 120):
  - **alvo:** precisa percebê-lo; alvo do tipo errado faz o ritual falhar;
  - **área:** num ponto que perceba (sem perceber, Ocultismo DT 20 + custo, se o mestre deixar); pega todos dentro, você incluído;
    - cone: sai de você, e a largura final é igual ao comprimento;
    - cubo;
    - esfera: centro num cruzamento de quadrados;
    - linha: 1,5 m de largura;
    - barreiras cortam a área;
  - **efeito:** criado num ponto com linha de efeito.
- **Duração** (p. 120–121):
  - instantânea, cena, definida, permanente ou descarregar;
  - sustentada: 1 PE, ação livre, no começo de cada turno. Um sustentado por vez; a morte do conjurador acaba com ele;
  - encerrar um ritual seu é livre, estando no alcance. Redirecionar é ação padrão.
- **Resistência:** DT 10 + limite de PE + Presença. O ritual diz o que o teste faz: anula, parcial, reduz à metade (antes da RD) ou desacredita (p. 121).
- **Elemento contra criatura** (p. 118):
  - Sangue vence Conhecimento, que vence Energia, que vence Morte, que vence Sangue; Medo é neutro;
  - elemento que vence o da criatura: −2d20 no teste de resistência dela, e ela fica vulnerável ao dano do ritual;
  - mesmo elemento: +2d20 no teste dela.
- **Custo do Paranormal** (p. 121): todo ritual que não seja de Medo pede Ocultismo DT 15 + custo.
  - falhou: dano mental igual ao custo;
  - falhou por 5 ou mais: além disso, perde 1 SAN para sempre.
- **Rituais de Medo** (p. 121): dano mental igual ao custo, e perde SAN para sempre: 1 na forma básica, 2 na discente, 3 na verdadeira.
- **Aliado acólito:** +1d20 em Ocultismo; 1 PE para +2 na DT do ritual (p. 171).
- **Membrana do local:** muda o que o ritual pode fazer (p. 97; REGRAS.md, seção 6).

**No CRONA:**
- a tela do ritual mostra o custo com a forma e confere o limite, a mão livre e os componentes;
- desenha a área no tabuleiro, em casas, e lista quem está dentro;
- pede os testes de resistência (um por alvo; o mestre digita o d20 de cada um, também o das ameaças);
- aplica dano e condições, e em seguida pede o Custo do Paranormal;
- o ritual sustentado entra na lista do começo do turno.

### 15.2 Conjuração complexa: opção `conjuracaoComplexa` (SaH p. 114–117)

- **Tempo:** todo ritual leva 3 rodadas seguidas, uma etapa por rodada.
  - cada ação padrão extra nessas rodadas dá +2 no teste final (não acelera);
  - o conjurador fica desprevenido;
  - faz Vontade ao sofrer dano e no fim de cada rodada em condição ruim ou terrível;
  - se ficar sem poder agir numa das rodadas, recomeça do zero.
- **Etapa 1, o símbolo:** pode desenhar com material de um elemento. Custa −1d20 no teste final e dá um dos efeitos do elemento:

| Elemento | Um destes efeitos |
|---|---|
| Sangue | recupera 2d6 PV se passar no teste; ou +1 dado no dano de Sangue; ou quem falhar na resistência fica sangrando |
| Morte | +2 na DT; ou +1 dado no dano de Morte; ou quem falhar na resistência sofre −2 nos testes até o fim da cena |
| Conhecimento | +2 no limite de PE; ou +1 dado no dano de Conhecimento; ou ignora um requisito de forma avançada |
| Energia | ação de movimento extra no próximo turno se passar; ou +1 dado no dano de Energia; ou quem falhar na resistência fica ofuscado |

- **Etapa 2, os componentes:** consumir o componente inteiro dá +1d20 no teste; um catalisador (SaH p. 44) pode tomar o lugar. Afinidade e Medo dispensam o componente, mas a etapa continua. Com afinidade, o conjurador ainda pode consumir um componente ou catalisador pelo +1d20; em ritual de Medo, não.
- **Etapa 3, invocar:** aqui se decide PE, forma e alvos. Teste de Ocultismo DT 20 + custo:
  - passou: o ritual funciona;
  - falhou: não funciona, e os custos são pagos assim mesmo;
  - fora de Medo, este mesmo teste serve para o Custo do Paranormal.
- **Extrapolar os limites:** soma a Presença no limite de PE daquele ritual e usa as formas como se tivesse um círculo a mais.
- **Poderes de ocultista que mudam:**
  - Acelerar Ritual: 4 PE, e o ritual sai em 2 rodadas;
  - Anular Ritual vira Mesclar Elemento;
  - Camuflar Ocultismo fica sem efeito;
  - Conjuração Marcial: prepara rituais de ação padrão ou menos e guarda cada um numa arma (um por arma). Uma vez por rodada, ao atacar corpo a corpo com a arma, conjura o ritual guardado como ação livre;
  - Tatuagem Ritualística: vale para um ritual específico, tatuado. Custa −1 PE, e essa redução soma com outras (exceção à regra da seção 14). Pode pular a etapa 1, mas aí fica sem efeito de elemento.
- **Preparar ritual:** só os de execução de reação (exceto pela Conjuração Marcial). Faz as etapas, guarda o efeito no corpo e libera depois com uma reação. Os PE só voltam depois de liberar.

### 15.3 Ritual desconhecido e desastre paranormal (SaH p. 117–118)

- Quem é treinado em Ocultismo e tem informação suficiente sobre o ritual pode tentar, pelas etapas da conjuração complexa, com +5 na DT.
- Se falhar, além de tudo, sofre um desastre paranormal (1d8):

| 1d8 | Desastre |
|---|---|
| 1 | consumido: morre e vira uma criatura do elemento do ritual, de VD 4 × NEX (ou o mais próximo acima), que age pelo mestre a partir da rodada seguinte |
| 2 | surto elemental: 3d12 por círculo, do tipo do elemento, no conjurador e em todos num raio de 9 m; os outros fazem Reflexos (DT do ritual + 5) para metade |
| 3 | assalto psíquico: 2d10 de dano mental por círculo |
| 4 | perde 1 de Agilidade para sempre; desprevenido até o fim da cena |
| 5 | perde 1 de Força para sempre; debilitado até o fim da cena |
| 6 | perde 1 de Intelecto para sempre; esmorecido até o fim da cena |
| 7 | perde 1 de Presença para sempre; alquebrado até o fim da cena |
| 8 | perde 1 de Vigor para sempre; enjoado até o fim da cena |

## 16. Itens de combate e munição

(LR p. 58–66, 78, 174)

- **DT dos itens:** "DT Agi" ou "DT Int" = 10 + limite de PE de quem usa + o atributo (p. 78).
- **Raios em casas:** 3 m = 4 casas; 6 m = 8 casas.

| Item | Ação | Efeito |
|---|---|---|
| Granada de atordoamento | padrão; num ponto em alcance médio; raio 6 m | atordoado por 1 rodada. Fortitude (DT Agi): em vez disso, ofuscado e surdo por 1 rodada |
| Granada de fragmentação | igual | 8d6 de perfuração; Reflexos (DT Agi) para metade |
| Granada de fumaça | igual | cegos e com camuflagem total na área, por 2 rodadas |
| Granada incendiária | igual | 6d6 de fogo e em chamas; Reflexos (DT Agi) para metade e sem chamas |
| Mina antipessoal | instalar: completa + Tática DT 15 (falhou, a mina se perde); detonar: padrão, estando a até alcance longo | cone de 6 m, direção escolhida ao instalar; 12d6 de perfuração; Reflexos (DT Int) para metade. Achar a mina: Percepção contra o resultado da instalação |
| Bazuca | ataque; recarga: ação de movimento | dano cheio no alvo atingido. Os outros num raio de 3 m fazem Reflexos (DT Agi) para metade. Mirando num ponto em alcance médio, não rola ataque e não erra (mas não acerta ninguém em cheio) |
| Lança-chamas | ataque | linha de 1,5 m de largura até alcance curto; um teste contra a Defesa de cada ser na linha; quem é atingido fica em chamas |
| Cicatrizante | padrão | 2d8+2 PV em você ou num adjacente; o item se gasta |
| Lanterna tática | movimento | ofuscado por 1 rodada (seção 5.3) |
| Pistola de dardos | ataque à distância | inconsciente até o fim da cena. Fortitude (DT Agi): em vez disso, desprevenido e lento por 1 rodada. Vem com 2 dardos |
| Pistola sinalizadora | ataque, uma vez | arma leve de disparo, alcance curto, 2d6 de fogo |
| Spray de pimenta | padrão; alvo adjacente | cego por 1d4 rodadas; Fortitude (DT Agi) evita; 2 usos |
| Taser | padrão; alvo adjacente | 1d6 de eletricidade e atordoado por 1 rodada; Fortitude (DT Agi) evita o atordoado; 2 usos |
| Algemas | agarrar + vencer outro agarrar | dois pulsos: −5 em testes que usem as mãos e não conjura; um pulso preso a algo: não se move. Escapar: Acrobacia DT 30 |
| Soqueira | — | +1 no dano desarmado; aceita modificações de arma corpo a corpo |
| Máscara de gás | — | +10 em Fortitude contra efeitos que dependem da respiração |
| Traje hazmat | — | +5 nos testes de resistência contra efeitos do ambiente; resistência a químico 10 |
| Amarras de (elemento) | armadilha: completa + 2 PE; laçar: padrão + 1 PE | armadilha de 3×3 m: a criatura que entra faz Reflexos (DT Int) ou fica imóvel até o fim da cena, e o espaço é terreno difícil. Laçar, alcance curto: Vontade (DT Agi) ou paralisada até o começo do próximo turno dela, quando repete o teste; manter custa 1 PE por rodada |

- **Proteções** (p. 62):
  - Defesa da proteção;
  - pesada: RD 2 contra balístico, corte, impacto e perfuração, e −5 nas perícias com penalidade de carga;
  - escudo: +2 na Defesa, numa mão;
  - antibombas: +5 nos testes de resistência contra área;
  - blindada: RD 5;
  - reforçada: +2 na Defesa (e +1 espaço);
  - sem proficiência: −2d20 nos testes de Força e Agilidade.
- **Itens amaldiçoados:** tratados como poderes (seção 14).
- **Munição** (p. 59): pacotes que duram cenas.
  - balas curtas: 2 cenas;
  - balas longas, cartuchos e combustível: 1 cena;
  - flechas: a missão toda;
  - foguete: 1 disparo.
  - **No CRONA:** no fim do combate, cada arma de fogo usada gasta uma cena do seu pacote.
- **Opção `contagemMunicao`** (p. 174):
  - cada pacote tem 20 ataques;
  - capacidade da arma: pistola 12, revólver 6, fuzil de caça 4, submetralhadora 20, espingarda 6, fuzil de assalto 30, fuzil de precisão 1, metralhadora 50;
  - recarregar é ação de movimento;
  - a rajada gasta 10 balas e dá +2 dados em vez de +1.

## 17. Ameaças: NPCs e criaturas

(LR p. 83, 169, 177–181, 313; SaH p. 125)

### 17.1 A ficha da ameaça (p. 178–179)

**Campos:**
- nome e VD;
- descritores e tamanho;
- presença perturbadora: NEX que dá imunidade, DT e dano mental;
- sentidos: Percepção e Iniciativa (em dados + bônus) e sentidos especiais;
- Defesa; Fortitude, Reflexos e Vontade (dados + bônus);
- PV e o valor de machucado;
- resistências, imunidades e vulnerabilidades;
- atributos, perícias e deslocamento;
- habilidades passivas;
- ações: tipo de ação, nome, corpo a corpo ou à distância (×N), alcance, teste, crítico, dano e tipo, e limites como "uma vez por cena" ou a recarga;
- enigma de medo.

As estatísticas já trazem os modificadores de tamanho e equipamento.

**No CRONA:**
- catálogo de fichas de ameaça (nome, números e página, sem o texto: as 74 do livro de regras, em `shared/src/combate/ameacasLivro.ts`) e ficha avulsa, criada pelo mestre;
- "imune a dano" na ficha do livro vale para todo dano; nas criaturas de Medo, cai quando o enigma é resolvido (o mestre desmarca "todo dano" nas imunidades da ficha);
- teste impresso como "–2O" no lugar dos dados: atributo 0, rola 2d20 e fica o pior (p. 75); na ficha rápida, d20 = 0;
- cada ameaça no combate é uma instância, com PV, condições e usos gastos.

### 17.2 Regras das ameaças

- **Turno:** Iniciativa em grupo (com o menor bônus) e um turno só para o mestre (p. 83, 169).
- **Defesas especiais:** as ameaças não usam bloqueio, esquiva nem contra-ataque (p. 179).
- **"×2" na ação:** dois ataques por ação.
- **Origem paranormal** (criaturas, p. 180): sem SAN; imunes a dano mental, a condições mentais e de medo, e a rituais de Medo.
  - **No CRONA:** a ameaça com elemento é criatura. A conta do dano soma o mental às imunidades dela, o combate recusa as condições de medo e mentais nela, e o ritual de Medo não a afeta (o registro diz que é imune).
- **Presença perturbadora** (p. 180):
  - quando o personagem vê a criatura, faz Vontade contra a DT dela; se falhar, sofre o dano mental cheio; se passar, metade;
  - com o NEX indicado ou mais, é imune;
  - com várias criaturas, vale a de maior VD, com +1d6 por criatura a mais;
  - o livro diz "assim que enxerga". Proposta: uma vez por cena por personagem, quando a criatura aparece para ele (DC-15).
- **Habilidades comuns** (p. 179–180):
  - cura acelerada: recupera PV no começo do turno; não cura os tipos listados depois da barra, nem fome, sede ou sufocamento;
  - faro: não fica desprevenida contra quem não vê; em alcance curto, camuflagem total vira só 20%;
  - imunidade a um tipo de dano ou condição;
  - incorpóreo: só itens amaldiçoados, rituais e outros incorpóreos o afetam; atravessa sólidos, mas não os manipula; ataca com Agilidade;
  - percepção às cegas: escuridão e invisibilidade não a afetam, em alcance curto;
  - RD, com exceções depois da barra (ex.: "RD 10/morte");
  - visão na penumbra: ignora a camuflagem por escuridão (não a total), em alcance curto; não vale contra escuridão paranormal;
  - visão no escuro: ignora as duas, em alcance médio; também não vale contra escuridão paranormal;
  - vulnerabilidade: dobro do dano daquele tipo;
  - fortificação (p. 313).
- **SaH** (p. 125):
  - **invisibilidade:**
    - dá camuflagem total contra a visão e +15 em Furtividade contra quem tenta ouvir;
    - quem não a vê fica desprevenido contra ela;
    - +2d20 nos ataques contra quem não está cego; o alvo cego, em vez disso, sofre −5 na Defesa;
  - **recarga:** depois de usar a habilidade, a ameaça precisa gastar a ação indicada, ou cumprir a condição, antes de usar de novo.
- **Enigma de medo:** o mestre marca "resolvido", e a ficha perde o que o enigma diz.
- **Reações com gatilho no tabuleiro** (ex.: "quando alguém anda perto dela"): o CRONA avisa o mestre quando o gatilho acontece.

### 17.3 Equilíbrio do combate (p. 177)

- Soma o VD das ameaças e compara com a soma do NEX dos agentes:
  - metade: fácil;
  - igual: equilibrado;
  - uma vez e meia: difícil.
- Com jogadores veteranos, o difícil é o dobro.
- O CRONA pode mostrar esse medidor ao montar o combate.

### 17.4 Ameaça a 0 PV

- O livro não diz: as regras de morrendo são escritas para o personagem, e o golpe de misericórdia fala de NPCs importantes e secundários.
- Proposta (DC-16):
  - criatura e NPC secundário a 0 PV saem do combate, mortos ou fora de combate, à escolha do mestre;
  - NPC importante pode seguir o morrendo dos agentes.

## 18. Aliados

(LR p. 170–171, 312)

- **O que é:** NPC sem turno, sem PV e sem PE, que ajuda um agente por vez.
  - dá um bônus automático;
  - dá uma habilidade que o agente usa uma vez por rodada, como ação livre, ou uma ação pequena no lugar dela (abrir uma porta, pegar um item).
- **Troca de agente:** na rodada da troca, não ajuda ninguém.
- **Dano:** não sofre, salvo por narração.
- Efeitos de aliados não somam entre si (p. 312).

| Tipo | Bônus | Habilidade (1 PE) |
|---|---|---|
| Acólito | +1d20 em Ocultismo; dispensa componentes | +2 na DT do ritual |
| Faz-Tudo | treinado em 2 perícias (não Luta nem Pontaria) | +1d6 num teste de uma delas |
| Guerrilheiro | +1d20 nos ataques | +1d8 de dano, se acertar |
| Socorrista | treinado em Medicina | cura 1d8+1 PV (você ou um aliado adjacente) |

**No CRONA:** o aliado fica ligado a um agente, com peça opcional no tabuleiro. O bônus entra sozinho nos testes, e a habilidade é um botão por rodada.

## 19. Perigos da cena

(LR p. 290–293)

- **Fogo:** quem fica exposto às chamas faz Reflexos DT 15 ou fica em chamas. Fogo de efeito instantâneo (ritual, explosivo) não incendeia, salvo se a descrição disser.
- **Fumaça densa:**
  - Fortitude DT 10 (+1 por teste) no começo do turno; se falhar, perde o turno tossindo;
  - duas falhas seguidas: perde 1d6 PV;
  - dá camuflagem; quem não respira é imune.
- **Queda:**
  - 1d6 de impacto a cada 1,5 m, até 40d6 (60 m); caindo na água, −4d6;
  - objeto pesado caindo em alguém: 1d6 a cada 1,5 m, e o dobro se for muito pesado;
  - amortecer queda: 5.6.
- **Eletricidade:** Fortitude para metade, a cada rodada de contato.

| Fonte | DT | Dano |
|---|---|---|
| mínima (bateria, soquete de lâmpada) | 10 | 1d6 |
| baixa (caixa de fusíveis) | 15 | 2d8 |
| média (cerca elétrica, transformador) | 20 | 4d8 |
| alta (raio) | 25 | 8d8 |

- **Ácido:** 1d6 por rodada; imersão, 10d6 por rodada, e o dano dura mais uma rodada depois de sair.
- **Lava:** 2d6 de fogo por rodada; imersão, 20d6, com a mesma rodada a mais.
- **Clima:**
  - neblina: camuflagem; espessa, camuflagem total além de 1,5 m;
  - chuva: −5 em Percepção e os efeitos de vento forte;
  - granizo: como chuva, mais 1 de impacto no começo de cada rodada;
  - neve: como chuva, e terreno difícil;
  - tempestade: −10 em Percepção, os efeitos de vendaval e 10% de chance de raio (8d10) por rodada;
  - vento forte: −2 no ataque à distância, e 50% por rodada de apagar chamas e dissipar névoa;
  - vendaval: −5 no ataque à distância; apaga chamas e dissipa névoa;
  - furacão e tornado: sem ataque à distância; Fortitude (DT 15 e 25) ou cai, é arrastado e sofre 1d6 a cada 1,5 m.
- **Armadilhas:** alarme, arame farpado, armadilha de caça, fosso camuflado e descarga elétrica, cada uma com a DT de Investigação ou Crime para achar e desarmar.
- **Venenos** (tabela da p. 293) e **doenças** (p. 291–292).
- **Falta de ar:** ver a seção 22.

**No CRONA:**
- os perigos viram marcas nas casas da cena (fogo, fumaça, água, gelo, arame, fosso) ou entram no clima da cena;
- o CRONA lembra no começo do turno de quem está dentro, e quando alguém entra;
- as partículas de fumaça e brasas de hoje são só visual; a regra entra quando o mestre liga o perigo.

## 20. Fim do combate

- O mestre encerra a cena de ação.
- **Acaba:**
  - as condições sem duração escrita (fim da cena) e os efeitos de cena;
  - os PE temporários de cena;
  - os contadores da cena: estabilizações, acalmadas, usos "por cena";
  - os rituais de duração cena.
- **Continua:** PV, PE, SAN e o que for permanente. Machucado e perturbado vêm da ficha.
- **Morrendo ou enlouquecendo em aberto:** o CRONA não fecha o combate sem o mestre resolver: continuar contando em rodadas, estabilizar ou decidir.
- **Munição:** gasta uma cena do pacote de cada arma de fogo usada.
- **Ritual sustentado:** acaba com o combate, salvo se o mestre mantiver (DC-17).
- O registro guarda o resumo. Depois vem o interlúdio (REGRAS.md, seção 8).

## 21. Regras opcionais

### 21.1 Medo em jogo: `medoEmJogo` (SaH p. 87–89)

Troca as regras de insanidade e loucura do LR (p. 88, 111–113).

**Fontes de medo** (o mestre escolhe a que combina com a cena):

| Visão | Dano mental | Vontade |
|---|---|---|
| inquietante | 1d4 | DT 15, anula |
| perturbadora | 1d6 | DT 20, metade |
| assustadora | 2d6 | DT 25, metade |
| sinistra | 4d4 | DT 30, metade |
| macabra | 4d8 | DT 35, metade |
| aterrorizante | 4d12 | DT 40, metade |
| ambiente horripilante | 1 por rodada (2, ou até 5, nos piores lugares); fora de rodadas, a cada ação ou intervalo | — |

- O dano mental de medo é sempre no mínimo 1, mesmo com resistência.
- A presença perturbadora e o dano mental das criaturas de Medo contam como dano de medo.

**Efeitos do medo:**
- **Quando:** a SAN chega a 0 por dano mental, ou o personagem sofre dano mental já em SAN 0.
- **Rolagem:** 2d10 na Tab. 2.2, com +1 por efeito de medo que ele já sofreu na cena. Se tirar um efeito que já tem, fica com o seguinte da tabela.
- **Duração:** até recuperar 1 SAN, salvo indicação.

| 2d10 | Efeito (resumo) |
|---|---|
| 2 | encorajamento: recupera 1 SAN a cada 5% de NEX e ganha +1d20 num teste à escolha até o fim da cena |
| 3 | surto de adrenalina: +5 no ataque e no dano até o fim da cena; para fazer qualquer coisa que não seja atacar, Vontade DT 20, ou perde a ação |
| 4 | hesitação: atordoado por 1 rodada |
| 5 | fraqueza: fraco |
| 6 | lapso: frustrado |
| 7 | ansiedade: falha no próximo teste (pode gastar uma ação padrão num teste inútil para se livrar) |
| 8 | desorientação: desprevenido |
| 9 | desespero: falha em todo teste de Vontade |
| 10 | histeria: por 1d4 rodadas, −1d20 em todos os testes |
| 11 | abalo: abalado |
| 12 | alucinação: em todo teste, se o maior d20 for ímpar, falha |
| 13 | susto: apavorado |
| 14 | confusão: confuso |
| 15 | paralisia: paralisado por 1d4 rodadas e depois abalado |
| 16 | pavor: gasta todas as ações fugindo. Ações de concentração (como ritual) têm 50% de falha (dado ímpar: falha e perde o turno). Sem como fugir, fica encolhido sem agir; se conseguir fugir, volta a agir, abalado |
| 17 | desmaio: inconsciente |
| 18 | trauma: paralisado (como o 15) e 1d6. De 1 a 5, perde 1 ponto para sempre (Agi, For, Int, Pre, Vig); no 6, nada |
| 19 | loucura: enlouquecendo (LR p. 88) |
| 20+ | choque sistêmico: morrendo |

**Ações contra o medo:**
- **Acalmar:** Diplomacia, Profissão (psicólogo) ou Religião, treinada.
  - ação padrão, num adjacente em SAN 0; ele recupera 1 SAN;
  - +5 na DT a cada vez na cena; a DT base não está escrita (DC-21).
- **Entregar-se ao medo:** uma vez por sessão, para quem foi reduzido a SAN 0 por dano mental.
  - rola um segundo efeito, com +5 sobre o modificador da rolagem que acabou de fazer: 2d10+5 na primeira vez que chega a SAN 0 na cena, 2d10+6 na segunda, e assim por diante;
  - na rodada seguinte, recupera 1d4 SAN "por nível" (DC-18) e sai de paralisado ou inconsciente.

**No CRONA:** a SAN 0 dispara a rolagem da tabela (ou pede o 2d10). O efeito entra como condição, com a saída "recuperar 1 SAN".

### 21.2 Ferimentos debilitantes: `ferimentosDebilitantes` (SaH p. 105)

- **Quando:** falhou na Fortitude do dano massivo. Em vez de ir a 0 PV, sofre um ferimento debilitante.
- **Qual:** 1d6 escolhe o atributo (1 Agi, 2 For, 3 Int, 4 Pre, 5 Vig; 6, ferimento superficial, sem atributo).
- **Efeito:**
  - −1d20 nos testes daquele atributo;
  - no Vigor, também −1 PV máximo a cada 5% de NEX;
  - os ferimentos somam.
- **Cura:** no interlúdio, alguém treinado em Medicina gasta uma ação e passa em DT 20; o ferimento sai no próximo dormir.

### 21.3 Jogando sem Sanidade (SaH p. 104–105)

- Junta PE e SAN em Pontos de Determinação (PD).
- Muda a ficha toda, não só o combate. Fica fora por enquanto; só entra se o mestre pedir.

### 21.4 Perseguição (SaH p. 90–91)

- **Como se vence:** teste estendido de Atletismo; quem juntar 3 sucessos antes de 3 falhas vence.
  - o caçador alcança a presa; os outros caçadores chegam uma rodada depois por sucesso que faltava;
  - a presa escapa.
- **DT pela velocidade dos adversários** (quando os agentes fogem, vale a velocidade de quem os persegue): pessoas comuns 15; pessoas velozes, animais e criaturas comuns 20; animais e criaturas velozes 25 ou mais.
- **Outras perícias:** o mestre pode aceitar outra perícia bem justificada; cada uma, fora o Atletismo, só uma vez por perseguição.
- **De veículo:** Pilotagem (ou Adestramento, numa montaria).
- **Ações:**

| Ação | Quem | Efeito |
|---|---|---|
| cortar caminho | qualquer um | −2d20 no Atletismo; passando, conta 2 sucessos (o mestre pode proibir) |
| esforço extra | qualquer um | +1d20 no Atletismo; perde 1d4 PV por vez que já usou na cena (1d4, depois 2d4...) |
| criar obstáculo | presa | −1d20 no Atletismo e Força DT 15 (ou outro atributo que faça sentido). Passando, o texto diz que a DT do Atletismo daquela rodada "diminui em −5 para todos, inclusive ele" (DC-20). Um por rodada |
| despistar | presa, com 1 sucesso ou mais | troca o Atletismo por Furtividade: passou, 2 sucessos; falhou, 2 falhas |
| sacrifício | qualquer um | falha automática no próprio teste; dá +1d20 no teste dos outros |
| atrapalhar | presa contra outra presa com o mesmo número de sucessos | −1d20 no próprio teste e Luta contra Luta ou Reflexos da vítima; vencendo, ela sofre −2d20 no Atletismo |

- **Variações:**
  - testes opostos no lugar da DT fixa;
  - perseguição curta: 2 sucessos antes de 2 falhas;
  - perseguição longa: 5 ou 7 sucessos antes de 3 falhas.
- **Eventos:** o mestre decide a cada rodada se há um evento, ou rola na Tab. 2.3.
  - **obstáculo:** todos fazem o teste no começo da rodada; quem falha sofre −2d20 no Atletismo daquela rodada;
  - **atalho:** o teste é opcional, no começo da rodada; quem passa ganha +2d20; quem tenta e falha sofre −2d20.
  - Tab. 2.3, no d20:
    - 1–8: nada;
    - obstáculos:
      - 9–10: entulho no caminho (Força DT 15);
      - 11–12: piso escorregadio (Acrobacia DT 20);
      - 13–14: entulho rolando (Reflexos DT 20);
      - 15: multidão (Intimidação DT 20);
    - atalhos:
      - 16–17: caminho mais curto, bloqueado por algo pesado (Força DT 15);
      - 18: vias labirínticas (Percepção DT 20);
      - 19: porta trancada (Crime DT 25);
      - 20: caminho escondido na vegetação (Sobrevivência DT 20).

**No CRONA:** um modo "perseguição" com a contagem de sucessos e falhas de cada um, as ações acima e o sorteio de eventos. O tabuleiro fica opcional.

### 21.5 Furtividade por visibilidade (SaH p. 92–93)

- **Visibilidade:** todos começam em 0. No fim da rodada, quem tem 3 ou mais é visto pelo algoz.
- **Opção de grupo:** soma a visibilidade de todos. Com 5 ou mais no fim da rodada, todos com 1 ou mais são vistos.
- **Ações:**
  - ação comum: +1 (anda normal; teste sem modificador);
  - ação discreta: +0 (anda à metade; −1d20 nos testes);
  - ação chamativa: +2 (corre, grita, ataca, conjura);
  - esconder-se: Furtividade DT 15 (+1d20 com uma boa ideia); passou, −1;
  - distrair: Enganação DT 15, +5 por uso na cena, um por rodada; passou, −1 (você ou um aliado perto); falhou, +1;
  - chamar atenção: você +2, e um aliado perto −1.
  - Se o algoz for mais perceptivo ou astuto, o mestre pode subir a DT de esconder-se e distrair.
- **Eventos:** no começo de cada rodada, um jogador rola 1d20, ou o mestre escolhe o evento. O alvo de cada evento é sorteado.
  - 1–2: o algoz chega muito perto de alguém. Só não é descoberto quem fica imóvel e em silêncio, e isso custa 1d6 de dano mental (ou metade do dano da presença perturbadora, o que for maior);
  - 3–5: todos +2;
  - 6–8: um +2;
  - 9–15: todos +1;
  - 16–17: um +1;
  - 18–19: nada;
  - 20: um −1.

**No CRONA:** marcadores de visibilidade nas peças (o SaH sugere marcadores físicos; aqui, eles ficam no tabuleiro) e o sorteio de eventos no começo da rodada.

### 21.6 Modo rápido do combate narrativo (SaH p. 119–123)

- **`iniciativaFixa`:** seção 3.1.
- **`danoMedio`:** nada de rolar dano.
  - cada dado vale a média, arredondada para baixo: d3 = 2, d4 = 2, d6 = 3, d8 = 4, d10 = 5, d12 = 6;
  - no crítico ×2, o dado multiplicado vale o máximo; no ×3, 1,5 vez o máximo;
  - habilidades que dão dano máximo no crítico somam +1 no multiplicador;
  - ex.: 1d6+1 dá 4; no crítico ×2, 7. 2d10+25 no crítico ×3 dá 55.
- **O resto fica de fora:** ações narrativas (simples, complexa com −1d20, extrema com −2d20), coreografia de luta (dano dobrado ou triplicado) e o combate sem mapa (categorias de distância). Não combinam com um tabuleiro tático.

### 21.7 Opcionais do livro de regras (LR p. 171–175)

- `lesoes` (10.2), `inspiracaoResoluta` (10.2), `loucuraNaoLetal` (11) e `contagemMunicao` (16).
- **Personagens de NEX 0%:** a classe mundano muda só a ficha.
- **Idade variada:** desvantagens que mexem no combate.

| Desvantagem | Efeito |
|---|---|
| distraído | surpreendido na 1ª rodada de toda cena de ação |
| gota | 1d6 de dano a cada teste de Agilidade ou de perícia de Agilidade (Pontaria, Reflexos, Iniciativa...) e ao esquivar |
| pulmão ruim | 1d6 de dano a cada teste de Força ou de perícia de Força (Luta, Atletismo); sem as rodadas de fôlego; investida deixa fatigado até o fim da cena |
| tosse | 1d6 no começo de cada rodada; no 1, perde o turno |
| "Devagar, jovem!" | −3 m no deslocamento; sem investida |
| catarata | −5 em Percepção e Pontaria |
| definhamento | −5 em Fortitude e nas manobras |
| juntas duras | −5 em Acrobacia e Reflexos |
| recurvado | conta como Pequeno, igual à Tampinha da criança, mas sem o bônus de Furtividade |
| teimoso | não recebe nem dá bônus de ajuda |

- **Criança** (p. 172):
  - Tampinha: deslocamento 6 m e tamanho Pequeno (+5 em Furtividade, −5 nas manobras); usa arma leve como se fosse de uma mão e arma de uma mão como se fosse de duas; não usa arma de duas mãos;
  - Sorte de Principiante: +2 na Defesa e +5 nos testes de resistência.

## 22. Conflitos do livro

Os seis primeiros já estão no REGRAS.md (seção 13). Os outros são do combate. O livro não resolve nenhum deles; a proposta é a escolha do CRONA até o mestre decidir.

| Ponto | O livro diz | Proposta |
|---|---|---|
| Flanquear | +2 no texto (p. 90); +1d20 na Tab. 4.4 (p. 89) | +1d20; `flanquearNumerico` troca |
| Agarrado | −2 (p. 85); −1d20 (p. 310) | −1d20; `agarradoNumerico` troca |
| Fim do morrendo | só com Medicina DT 20 (p. 88); ao voltar a 1 PV (p. 311) | ao voltar a 1 PV; `morrendoEstrito` troca |
| Até morrer | começar 3 turnos morrendo na cena (p. 88); terminar mais de 3 rodadas (p. 311) | 3 turnos |
| 0 PV | morrendo (p. 88); sangrando (p. 36) | morrendo |
| Machucado | menos da metade (p. 88, 311); um poder conta a metade exata (p. 116) | menos da metade |
| Atacante caído | a Tab. 4.4 não restringe (p. 89); o apêndice diz corpo a corpo (p. 310) | só corpo a corpo |
| Fintar | pede Enganação treinada (p. 44); a ação no capítulo 4 não pede (p. 86) | treinada |
| Acalmar | Diplomacia DT 20, sem treino e sem a DT subir (p. 88); treinada, +5 na DT a cada vez na cena (p. 44) | o da perícia (p. 44) |
| Reações | quantas quiser; só as defesas especiais são uma por rodada (p. 85, 88). O REGRAS.md dizia "uma reação por rodada" | o livro; o REGRAS.md foi corrigido |
| Limite de PE | garante uma habilidade no custo mínimo por turno (p. 23); o C.R.I.S deixa o primeiro gasto da rodada passar inteiro | o livro |
| Falta de ar | três regras: a condição asfixiado (Vigor + 1 rodadas e depois morrendo; p. 310), o sufocamento (Vigor rodadas, depois Fortitude DT 5 +5; falhou, inconsciente e 1d6 PV por rodada; p. 293) e o afogamento (Vigor rodadas, depois Fortitude; falhou, 0 PV; p. 42) | cada uma onde o livro a usa: asfixiado quando um efeito diz "asfixiado"; sufocamento sem ar no ambiente; afogamento embaixo d'água |
| Enlouquecendo | "estabilizado em três rodadas" (p. 111); começar 3 turnos (p. 88) | 3 turnos (p. 88) |
| Assustar | abalado "não cumulativo" (p. 45); abalado de novo vira apavorado (p. 310) | assustar de novo não piora; outra fonte de medo piora |
| Pequeno | Tab. 7.1: +2 em Furtividade e −2 nas manobras (p. 179); a criança Tampinha: +5 e −5 (p. 172) | na criança, vale o texto dela |
| Crítico | "20 natural" (p. 54); margem de ameaça (p. 82) | é a mesma regra: a margem padrão é 20 |
| Arremessar arma sem alcance | em alcance curto com −5 (p. 55); não diz se vale o dobro | só até o curto |

## 23. Decisões para o mestre

| # | Decisão | Proposta |
|---|---|---|
| DC-1 | Atributo 0 com dados perdidos | o livro dá 2d20, o pior, para o atributo 0 (p. 14, 75) e, para o resto, a conta da p. 11 (seção 2.1); com atributo 0, cada dado perdido soma mais um ao 2d20 |
| DC-2 | Ajudar alguém em combate | ação padrão do ajudante, com o teste de ajuda (DT 10) |
| DC-3 | Modo de rolar | decidido (30/09): sempre dados físicos na mesa, também os das ameaças e os sorteios pequenos; só o mestre digita (seção 2.2) |
| DC-4 | O que os jogadores veem | nada de Defesa, DT e PV das ameaças; só "machucada" e "fora de combate", e o resultado que o mestre anunciar |
| DC-5 | Ser do mestre que chega depois | entra no turno do mestre da rodada seguinte |
| DC-6 | Ordem do começo do turno | a da seção 4.3 |
| DC-7 | Quando a defesa especial volta | no começo do turno do próprio ser |
| DC-8 | Escala e espaço | 2 casas = 1 quadrado, uma casa livre entre peças, seres grandes em bloco de casas (a outra opção: uma grade de combate de 2×2 casas) |
| DC-9 | Posição elevada | 1 m ou mais acima do alvo |
| DC-10 | Medida de alcance e área | em linha reta entre os centros (a outra opção: contar como no movimento, com a diagonal dobrada) |
| DC-11 | Cobertura dos mobis | 0,8 m ou mais dá cobertura; 1,8 m ou mais conta como parede |
| DC-24 | Cobertura pela altura e a postura | corpo de 1,8 m em pé e 1,0 m agachado; o móvel com 44% do corpo dá cobertura (+5) e com o corpo inteiro, cobertura total (aprovada pelo Felipe em 07/10; o animar de agachar e proteger-se vem com as animações) |
| DC-12 | Escuridão da cena | até 0,5 nada; de 0,5 a 0,8, camuflagem; acima de 0,8, escuridão total (camuflagem total e cego sem visão no escuro) |
| DC-13 | Dados extras no crítico | rajada, munição explosiva e os dados do SaH não multiplicam; o calibre grosso multiplica, porque vira dano da arma |
| DC-14 | Limite de PE e reações fora do turno | vale do começo do seu turno até o começo do próximo |
| DC-15 | Presença perturbadora | uma vez por cena por personagem, quando ele vê a criatura |
| DC-16 | Ameaça a 0 PV | criatura e NPC secundário saem do combate; NPC importante pode usar o morrendo |
| DC-17 | Ritual sustentado depois do combate | acaba junto, salvo se o mestre mantiver |
| DC-18 | "1d4 SAN por nível" do entregar-se ao medo | por nível = a cada 5% de NEX, como no encorajamento |
| DC-19 | Quem cai a 0 PV fica caído? | sim: a peça deita e, ao acordar, precisa levantar |
| DC-20 | Criar obstáculo, na perseguição | o texto diz "diminui a DT em −5 para todos"; o que parece fazer sentido é −5 no Atletismo de todos naquela rodada, inclusive de quem criou |
| DC-21 | DT base do acalmar do SaH | 20, como no livro de regras |
| DC-22 | Jogador age pelo celular? | decidido (30/09): não. Só o mestre mexe na tela; os jogadores assistem ao tabuleiro na mesa |
| DC-23 | Regras da casa e opções ligadas | tudo desligado (livro puro) até o mestre escolher |

## 24. O que o CRONA guarda

Esboço do que o servidor precisa guardar. O contrato de verdade entra no `docs/CONTRATO.md` quando o código chegar.

- **Combate** (um por cena de ação; fica no banco, para aguentar queda do servidor):
  - campanha e cena em que começou; estado (montando, andamento, encerrado);
  - rodada e turno atual;
  - as chaves de regra ligadas no começo.
  - Pode ter peças em mais de uma cena: a tela acompanha a peça da vez, como já faz quando uma peça atravessa uma porta.
- **Participante:**
  - tipo (agente, NPC, criatura), personagem ou instância de ameaça, peça e lado;
  - ciente ou surpreendido;
  - Iniciativa: total, d20, bônus e desempate; rodada em que entra; se é do grupo do mestre;
  - atraso ou ação preparada (com o gatilho);
  - o que cabe no turno: padrão, movimento, completa, extras e casas andadas;
  - defesa especial usada e PE gastos no turno;
  - contadores (seção 13) e dano não letal;
  - usos por rodada e por cena; munição usada.
- **Efeito ativo** (condições e o resto):
  - alvo e tipo: condição, modificador, ritual sustentado, ação preparada, conjuração em andamento, mira, finta;
  - origem, começo (rodada e contagem) e regra de fim;
  - números (ex.: +1d20 no ataque, −5 na Defesa);
  - se os jogadores veem.
- **Instância de ameaça:** ficha (do catálogo ou avulsa), nome na cena, PV atual e máximo, condições, usos por cena, recarga e enigma resolvido.
- **Rolagem:**
  - quem rola e o quê (perícia, ataque, dano, resistência);
  - a fórmula (quantos d20, fica o maior ou o menor, bônus) e a lista de modificadores, com a fonte;
  - o dado digitado ou sorteado, o total, o alvo (DT ou Defesa) e o resultado;
  - o modo (mesa ou CRONA).
- **Evento do combate:** alimenta o registro e o desfazer. Tem tipo, autor, dados, e o antes e o depois de cada mudança.
- **Ações novas para a interface pedir** (nomes provisórios):
  - `combat.start`, `combat.join`, `combat.initiative`, `combat.nextTurn`, `combat.delay`, `combat.ready`;
  - `combat.act`, `combat.roll`, `combat.damage`, `combat.heal`, `combat.condition`, `combat.reaction`;
  - `combat.undo`, `combat.end`.

## 25. Ordem de construção

Casa com a ordem do REGRAS.md: as etapas A a F são o item 6 (combate), G é o 7 (rituais e poderes) e H é o 8 (ameaças). As condições (item 2) e a mochila (item 3) entram antes, ou junto das etapas D e C. Uma etapa por vez, com testes e com a aprovação do mestre antes da próxima.

| Etapa | O que entra |
|---|---|
| A. Esqueleto | abrir e fechar o combate, participantes e lados, surpresa, Iniciativa digitada ou rolada, ordem, rodada e turno, atrasar, preparar, quem chega depois, durações, pendências de começo e fim de turno, registro e desfazer |
| B. Turno e movimento | o que cabe no turno, deslocamento em casas no tabuleiro (diagonal, terreno difícil, condições), portas, levantar e jogar-se no chão |
| C. Ataque e dano | arma da mochila, teste com os modificadores das condições e os manuais, Defesa, 20 natural, crítico, dano com tipos, RD, vulnerabilidade e imunidade, não letal, dano massivo, defesas especiais |
| D. Estados | morrendo e enlouquecendo com contadores, primeiros socorros e acalmar com a DT que sobe, morte e insanidade, condições com duração e efeito automático |
| E. Tabuleiro | adjacência, flanquear, alcance, cobertura, linha de visão, escuridão e névoa, posição elevada |
| F. Manobras e ações especiais | agarrar, derrubar, desarmar, empurrar, quebrar, atropelar, investida, corrida, fintar, mirar, golpe de misericórdia |
| G. Habilidades e rituais | limite de PE, custos, DTs, concentração, Custo do Paranormal, sustentados, áreas no tabuleiro, resistência de vários alvos |
| H. Ameaças e aliados | fichas, turno do mestre, ataques múltiplos, presença perturbadora, habilidades comuns, medidor de VD, aliados |
| I. Itens e perigos | granadas, mina, cicatrizante e outros itens, munição, perigos da cena |
| J. Opções | medo em jogo, ferimentos debilitantes, conjuração complexa, perseguição, furtividade, modo rápido, lesões, inspiração resoluta, loucura não letal, contagem de munição, idade |

**Estado em 30/09:** A, C e E prontas, e parte de B (sem casas contadas nem terreno difícil) e de D. F pronta. G pronta sem a conjuração complexa (J) e o desastre paranormal. H com o catálogo do livro, os ataques ×N e a presença perturbadora; faltam as habilidades comuns no automático, o medidor de VD e os aliados.

## 26. Exemplo de duas rodadas

Números inventados, só para mostrar o fluxo. No subsolo da Sede, dois cultistas esperam escondidos. Alosi e Catarina descem a escada.

1. **Abertura.** Os cultistas estão cientes. Alosi vence a Percepção contra a Furtividade deles; Catarina perde e fica surpreendida na rodada 1.
2. **Iniciativa.**
   - Alosi tira 17 e Catarina 12.
   - O mestre rola uma vez pelos dois cultistas, com o menor bônus deles, e tira 14.
   - Ordem: Alosi 17, turno do mestre 14, Catarina 12 (pula a rodada 1).
3. **Rodada 1, Alosi.**
   - Anda 6 casas (ação de movimento) até ficar adjacente ao cultista A.
   - Ataca com o machado (ação padrão). A tela diz: Luta, 2d20 +5, contra Defesa 14. Ele digita 19: total 24, acerta. Margem do machado é 20: sem crítico.
   - Dano: 1d8 + 2 (Força). Digita 6: 8 de dano.
   - O cultista A vai de 12 a 4 PV (machucado).
4. **Rodada 1, turno do mestre.**
   - O cultista A ataca Alosi. Antes da rolagem, a tela oferece a esquiva (Reflexos treinada, +5), e Alosi aceita: Defesa 16 + 5 = 21. O mestre rola 18: erra. A defesa especial de Alosi fica gasta até o começo do próximo turno dele.
   - O cultista B atira com o revólver em Catarina, surpreendida: desprevenida, Defesa 15 − 5 = 10.
     - O mestre rola 19 no d20, total 23: acerta. A margem do revólver é 19: crítico ×3, 6d6 de dano.
     - Sai 21: Catarina vai de 18 a 0 PV. Não há dano massivo, porque zerou.
     - Ela fica inconsciente e morrendo, e a peça deita.
5. **Rodada 1, Catarina:** surpreendida, não tem turno nesta rodada; por isso o contador de morrendo ainda não conta.
6. **Rodada 2, Alosi.**
   - Anda até Catarina (movimento) e faz primeiros socorros (padrão).
   - A tela diz: Medicina, DT 20, 1ª estabilização da cena; sem kit de medicina, −5. Ele passa.
   - Catarina fica com 1 PV, sem morrendo nem inconsciente, mas caída (DC-19). A próxima estabilização dela nesta cena terá DT 25.
7. **Rodada 2, Catarina.**
   - O começo do turno não tem pendências: ela nunca começou um turno morrendo, e o contador ficou em 0/3.
   - Levanta (movimento) e age normalmente.
