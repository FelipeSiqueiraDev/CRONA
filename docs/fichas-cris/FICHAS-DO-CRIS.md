# Fichas do C.R.I.S

Cópia de leitura das fichas que estavam no banco do C.R.I.S (exportado em 18/10/2026, só leitura). O dado completo e cru está em [`fichas-do-cris.json`](fichas-do-cris.json); este arquivo é a versão legível. A ficha de teste ("Agente Teste") foi deixada de fora. Os números abaixo são os que o C.R.I.S guarda prontos (o CRONA recalcula tudo a partir das escolhas; as diferenças entre os dois estão no relatório da importação, `docs/fichas-cris/COMPARACAO-CRONA.md`).

Os retratos (base64 no banco) foram salvos em `avatares/` e ficam fora do git.

## Índice

- [???](#sem-nome)
- [Agatha Volkomenn](#agatha-volkomenn)
- [Alosi Walker](#alosi-walker)
- [Catarina Albuquerque](#catarina-albuquerque)
- [Cora Falcão](#cora-falcao)
- [D. Tepes](#d-tepes)
- [Ivete Beicur](#ivete-beicur)
- [Marcela Geleerd](#marcela-geleerd)
- [Miguel Albuquerque](#miguel-albuquerque)
- [Nico Delagnore](#nico-delagnore)
- [Sr. Veríssimo](#sr-verissimo)
- [Ômega-99](#omega-99)
- [Personagens de história](#personagens-de-história-npcs-do-cris)
- [Criaturas](#criaturas-monstros-do-cris)

## Tabela-resumo

| Ficha | Classe | Trilha | NEX | Origem | Patente | AGI | FOR | INT | PRE | VIG | PV | PE | SAN | Defesa | Situação |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| ??? | Combatente | Guerreiro | 65% | Atleta | Agente de Elite | 2 | 3 | 1 | 2 | 3 | 107 | 52 | 48 | 14 | completa |
| Agatha Volkomenn | Ocultista | Graduado | 80% | Vítima | Recruta | 1 | 1 | 3 | 3 | 2 | 74 | 112 | 111 | 11 | ficha PARCIAL |
| Alosi Walker | Ocultista | Graduado | 20% | Religioso | Operador | 1 | 1 | 3 | 4 | 1 | 22 | 32 | 35 | 11 | completa |
| Catarina Albuquerque | Especialista | Infiltrador | 20% | Atleta | Operador | 4 | 1 | 2 | 2 | 1 | 29 | 20 | 28 | 19 | completa |
| Cora Falcão | Combatente | Aniquilador | 20% | Militar | Operador | 3 | 2 | 1 | 2 | 2 | 36 | 16 | 21 | 13 | completa |
| D. Tepes | Combatente | Monstruoso | 20% | Policial | Operador | 1 | 2 | 2 | 1 | 3 | 48 | 12 | 21 | 20 | completa |
| Ivete Beicur | Especialista | — | 50% | — | Recruta | 1 | 1 | 1 | 1 | 1 | 53 | 40 | 52 | 11 | modelo quase em branco |
| Marcela Geleerd | Especialista | — | 50% | — | Recruta | 1 | 1 | 1 | 1 | 1 | 53 | 40 | 52 | 11 | modelo quase em branco |
| Miguel Albuquerque | Especialista | Técnico | 50% | Lutador | Agente Especial | 2 | 1 | 3 | 3 | 1 | 53 | 60 | 44 | 19 | completa |
| Nico Delagnore | Ocultista | Lâmina Paranormal | 65% | Vítima | Agente Especial | 2 | 1 | 3 | 3 | 2 | 62 | 117 | 63 | 12 | completa |
| Sr. Veríssimo | Combatente | Comandante De Campo | 70% | Desgarrado | Agente de Elite | 2 | 3 | 2 | 2 | 2 | 100 | 56 | 51 | 24 | completa |
| Ômega-99 | Ocultista | Graduado | 99% | Religioso | Agente de Elite | 3 | 2 | 3 | 3 | 3 | 110 | 140 | 115 | 30 | completa |

## ???

> Ficha de nome "???" (personagem misterioso do mestre); sem textos.

- **Classe:** Combatente · **Trilha:** Guerreiro · **NEX:** 65% · **Origem:** Atleta
- **Patente:** Agente de Elite (200 PP) · **Crédito:** Ilimitado · **Facção:** lotus_branca · **Jogador:** (sem jogador)
- **Atributos:** AGI 2 · FOR 3 · INT 1 · PRE 2 · VIG 3
- **PV** 107/107 · **PE** 52/52 (por rodada 13) · **SAN** 48/48
- **Defesa:** 14 · **Deslocamento:** 9 m · **Esquiva** 29 · **Bloqueio** 15 · **Contra-ataque** 10
- **Resistências:** nenhuma
- **Afinidade:** nenhuma · **DT de rituais:** 25 · **Arma favorita:** — · **Pet:** —

**Perícias treinadas:** Acrobacia (treinado), Atletismo (treinado), Fortitude (expert), Luta (veterano), Reflexos (expert), Vontade (veterano)

**Ataques**

- Soco/Chute: teste 3d20 (fica com o maior) +10 (Luta), dano 1d3, crítico x2, alcance Curto, tipo Impacto
- Katana: teste 3d20 (fica com o maior) +10 (Luta), dano 1d10 + FOR, crítico 19, alcance Curto, tipo Corte

**Poderes e habilidades**

- **Ataque Especial**: Ao realizar um ataque, pode gastar 2 PE para receber +5 no teste de ataque ou na rolagem de dano. Mesmo com limite de PE por turno menor, sempre pode pagar o custo mínimo de uma habilidade.
- **Técnica Letal**: +2 na margem de ameaça em ataques corpo a corpo.
- **Revidar**: Reação de 2 PE: ataca imediatamente após bloquear com sucesso um golpe.
- **Força Opressora**: Por 1 PE, realiza as manobras Derrubar ou Empurrar como ação livre ao acertar um ataque corpo a corpo.
- **110%**: Gasta 2 PE para +5 em um teste de Força ou Agilidade (exceto Luta e Pontaria).
- **Golpe Pesado**: O dano de armas corpo a corpo aumenta em um dado do mesmo tipo.
- **Proteção Pesada**: Recebe proficiência com proteções pesadas.
- **Reflexos Defensivos**: +5 na Defesa e em testes de resistência contra inimigos em alcance curto.
- **Versatilidade**: Escolha entre receber um poder de combatente ou o primeiro poder de uma trilha de combatente que não a sua.
- **A Favorita**: Escolha uma arma favorita; sua categoria é reduzida em I. (via Versatilidade, trilha Aniquilador)

**Rituais**

- (nenhum)

**Inventário**

- Mochila Militar (cat. I, 0 esp.) — +2 espaços de carga
- Bandoleira (cat. I, 1 esp.) — Sacar/guardar como ação livre (1/rodada)
- Vestimenta (cat. I, 1 esp.) [perícia: Fortitude] — +2 em uma perícia à escolha (exceto Luta/Pontaria); máx. 2 vestimentas ativas ao mesmo tempo
- Katana (cat. I, 2 esp.) — Dano 1d10 (Corte) · Crítico 19 · Ágil; 2 Mãos (veterano Luta = 1 mão)

**Textos**

- **Aparência:** (em branco)
- **Personalidade:** (em branco)
- **Histórico:** (em branco)
- **Objetivo:** (em branco)

**Notas:** nenhuma anotação gravada no C.R.I.S para esta ficha. Retrato: (sem retrato).

## Agatha Volkomenn

> **Atenção:** ficha PARCIAL (NEX 80%, mas só 2 perícias treinadas, sem rituais, sem inventário, sem textos; ataques só o soco).

- **Classe:** Ocultista · **Trilha:** Graduado · **NEX:** 80% · **Origem:** Vítima
- **Patente:** Recruta (0 PP) · **Crédito:** Baixo · **Facção:** ordo_realitas · **Jogador:** (sem jogador)
- **Atributos:** AGI 1 · FOR 1 · INT 3 · PRE 3 · VIG 2
- **PV** 74/74 · **PE** 112/112 (por rodada 16) · **SAN** 111/111
- **Defesa:** 11 · **Deslocamento:** 9 m · **Esquiva** 16 · **Bloqueio** 0 · **Contra-ataque** 0
- **Resistências:** nenhuma
- **Afinidade:** nenhuma · **DT de rituais:** 29 · **Arma favorita:** — · **Pet:** —

**Perícias treinadas:** Reflexos (treinado), Vontade (treinado)

**Ataques**

- Soco/Chute: teste 1d20 (fica com o maior) +0 (Luta), dano 1d3, crítico x2, alcance Curto, tipo Impacto

**Poderes e habilidades**

- **Saber Ampliado**: Aprende rituais adicionais por círculo além do normal.
- **Grimório Ritualístico**: Possui um grimório com rituais extras; número de rituais no livro é baseado em Intelecto.
- **Rituais Eficientes**: A DT para resistir aos seus rituais aumenta em +5.
- **Cicatrizes Psicológicas**: +1 de Sanidade para cada 5% de NEX.
- **Escolhido pelo Outro Lado**: Permite aprender e conjurar rituais. Começa conhecendo 3 rituais de 1º círculo; a cada novo NEX aprende +1 ritual de qualquer círculo que já possa lançar.

**Rituais**

- (nenhum)

**Inventário**

- (vazio)

**Textos**

- **Aparência:** (em branco)
- **Personalidade:** (em branco)
- **Histórico:** (em branco)
- **Objetivo:** (em branco)

**Notas:** nenhuma anotação gravada no C.R.I.S para esta ficha. Retrato: [imagem em avatares/agatha-volkomenn.jpg].

## Alosi Walker

- **Classe:** Ocultista · **Trilha:** Graduado · **NEX:** 20% · **Origem:** Religioso
- **Patente:** Operador (35 PP) · **Crédito:** Médio · **Facção:** ordo_realitas · **Jogador:** (sem jogador)
- **Atributos:** AGI 1 · FOR 1 · INT 3 · PRE 4 · VIG 1
- **PV** 9/22 · **PE** 23/32 (por rodada 4) · **SAN** 28/35
- **Defesa:** 11 · **Deslocamento:** 9 m · **Esquiva** 0 · **Bloqueio** 0 · **Contra-ataque** 0
- **Resistências:** nenhuma
- **Afinidade:** nenhuma · **DT de rituais:** 18 · **Arma favorita:** — · **Pet:** —

**Perícias treinadas:** Diplomacia (treinado), Intuição (treinado), Investigação (treinado), Medicina (treinado), Ocultismo (treinado), Percepção (treinado), Religião (treinado), Vontade (treinado), Profissão (Históriador) (treinado)

**Ataques**

- Soco/Chute: teste 1d20 (fica com o maior) +0 (Luta), dano 1d3, crítico x2, alcance Curto, tipo Impacto

**Poderes e habilidades**

- **Saber Ampliado**: Aprende rituais adicionais por círculo além do normal.
- **Acalentar**: +5 em Religião para acalmar; alvo recupera 1d6 + Presença de Sanidade.
- **Escolhido pelo Outro Lado**: Permite aprender e conjurar rituais. Começa conhecendo 3 rituais de 1º círculo; a cada novo NEX aprende +1 ritual de qualquer círculo que já possa lançar.
- **Ritual Potente**: Soma Intelecto no dano ou cura de rituais.

**Rituais**

- Perturbação (1º círculo, Conhecimento)
- Eletrocussão (1º círculo, Energia)
- Decadência (1º círculo, Morte)
- Cicatrização (1º círculo, Morte)
- Cinerária (1º círculo, Medo)
- Embaralhar (1º círculo, Energia)
- Espirais da Perdição (1º círculo, Morte)

**Inventário**

- Componentes Ritualísticos de Conhecimento (cat. 0, 1 esp.)
- Componentes Ritualísticos de Morte (cat. 0, 1 esp.)
- Componentes Ritualísticos de Energia (cat. 0, 1 esp.)
- Bandoleira (cat. I, 1 esp.) — Sacar/guardar como ação livre (1/rodada)
- Crânio Espiral (cat. II, 1 esp.) — 1x/rodada, ação livre pra ganhar uma ação padrão extra na rodada. Cada uso exige Vontade (DT 15 +5 por uso no dia); falha envelhece 1d4 anos e trava o item pro resto do dia.
- Mochila Militar (cat. I, 0 esp.) — +2 espaços de carga
- Amuleto Sagrado (cat. 0, 1 esp.) — +2 em Religião e Vontade; ocupa espaço de um item vestido

**Textos**

- **Aparência:** (em branco)
- **Personalidade:** (em branco)
- **Histórico:** (em branco)
- **Objetivo:** (em branco)

**Notas:** nenhuma anotação gravada no C.R.I.S para esta ficha. Retrato: /api/agent-avatar/f8b647b5-beb5-43f7-b49c-4466b87699a7.

## Catarina Albuquerque

- **Classe:** Especialista · **Trilha:** Infiltrador · **NEX:** 20% · **Origem:** Atleta
- **Patente:** Operador (35 PP) · **Crédito:** Médio · **Facção:** ordo_realitas · **Jogador:** (sem jogador)
- **Atributos:** AGI 4 · FOR 1 · INT 2 · PRE 2 · VIG 1
- **PV** 29/29 · **PE** 20/20 (por rodada 4) · **SAN** 23/28
- **Defesa:** 19 · **Deslocamento:** 6 m · **Esquiva** 24 · **Bloqueio** 0 · **Contra-ataque** 5
- **Resistências:** nenhuma
- **Afinidade:** nenhuma · **DT de rituais:** 16 · **Arma favorita:** — · **Pet:** —

**Perícias treinadas:** Acrobacia (treinado), Atletismo (treinado), Crime (treinado), Furtividade (treinado), Iniciativa (treinado), Investigação (treinado), Luta (treinado), Percepção (treinado), Reflexos (treinado), Tecnologia (treinado), Vontade (treinado)

**Ataques**

- Soco/Chute: teste 1d20 (fica com o maior) +5 (Luta), dano 1d3, crítico x2, alcance Curto, tipo Impacto
- Katana: teste 1d20 (fica com o maior) +5 (Luta), dano 1d10 + FOR +2 +2 (Ninja Urbano), crítico 19, alcance Curto, tipo Corte
- Pé de Mesa: teste 1d20 (fica com o maior) +5 (Luta), dano 1d6 + FOR, crítico x2, alcance Curto, tipo Impacto

**Poderes e habilidades**

- **Eclético**: Gasta 2 PE para receber o bônus de treinamento (+5) em uma perícia na qual não é treinado, para um teste específico.
- **Perito**: Escolha duas perícias treinadas (exceto Luta e Pontaria). Ao testá-las, pode gastar 2 PE para somar +1d6 ao resultado.
- **110%**: Gasta 2pe 
Ganha +5 em um teste de perícia
- **Ataque Furtivo**: Por 1 PE, causa +1d6 de dano em alvos desprevenidos ou flanqueados (evolui até +4d6 em NEXs mais altos). (via Versatilidade, trilha Infiltrador)
- **Ninja Urbano**: Proficiência com armas táticas corpo a corpo e de disparo, e +2 no dano com elas.

**Rituais**

- (nenhum)

**Inventário**

- Armadura Leve (cat. I, 2 esp.)
- Katana (cat. II, 2 esp.) [mods: Cruel] — Dano 1d10 (Corte) · Crítico 19 · Ágil; 2 Mãos (veterano Luta = 1 mão)
- Mochila Militar (cat. I, 0 esp.) — +2 espaços de carga
- Granada de Fumaça (cat. 0, 1 esp.) — Área 6m: cegos e camuflagem total por 2 rodadas
- Granada de Fragmentação (cat. I, 1 esp.) — Área 6m: 8d6 perfuração (Reflexos DT Agi reduz à metade)
- Kit de Perícia (cat. 0, 1 esp.) — Evita penalidade de –5 em testes técnicos
- Pé de Mesa (cat. 0, 1 esp.)

**Textos**

- **Aparência:** (em branco)
- **Personalidade:** (em branco)
- **Histórico:** (em branco)
- **Objetivo:** (em branco)

**Notas:** nenhuma anotação gravada no C.R.I.S para esta ficha. Retrato: [imagem em avatares/catarina-albuquerque.jpg].

## Cora Falcão

- **Classe:** Combatente · **Trilha:** Aniquilador · **NEX:** 20% · **Origem:** Militar
- **Patente:** Operador (35 PP) · **Crédito:** Médio · **Facção:** ordo_realitas · **Jogador:** (sem jogador)
- **Atributos:** AGI 3 · FOR 2 · INT 1 · PRE 2 · VIG 2
- **PV** 27/36 · **PE** 12/16 (por rodada 4) · **SAN** 11/21
- **Defesa:** 13 · **Deslocamento:** 9 m · **Esquiva** 18 · **Bloqueio** 0 · **Contra-ataque** 5
- **Resistências:** nenhuma
- **Afinidade:** nenhuma · **DT de rituais:** 16 · **Arma favorita:** Fuzil de Caça · **Pet:** —

**Perícias treinadas:** Luta (treinado), Tática (treinado), Pontaria (treinado), Reflexos (treinado), Iniciativa (treinado), Percepção (treinado)

**Ataques**

- Soco/Chute: teste 2d20 (fica com o maior) +5 (Luta), dano 1d3, crítico x2, alcance Curto, tipo Impacto
- Faca: teste 3d20 (fica com o maior) +5 (Pontaria), dano 1d4, crítico 19, alcance Curto, tipo Corte
- Fuzil de Caça: teste 3d20 (fica com o maior) +5 (Pontaria), dano 3d8, crítico 17/x3, alcance Médio, tipo Balístico

**Poderes e habilidades**

- **Ataque Especial**: Ao realizar um ataque, pode gastar 2 PE para receber +5 no teste de ataque ou na rolagem de dano. Mesmo com limite de PE por turno menor, sempre pode pagar o custo mínimo de uma habilidade.
- **A Favorita**: Escolha uma arma favorita; sua categoria é reduzida em I.
- **Para Bellum**: +2 em rolagens de dano com armas de fogo.
- **Tiro Certeiro**: Soma Agilidade no dano de armas de disparo e ignora penalidade contra alvos em combate corpo a corpo com aliados.

**Rituais**

- (nenhum)

**Inventário**

- Celular (cat. 0, 1 esp.)
- Alarme de Movimento (cat. 0, 1 esp.)
- Fuzil de Caça (cat. II, 2 esp.) [mods: Calibre Grosso, Mira Laser] — Dano 2d8 (Balístico) · Crítico 19/x3 · Alcance Médio · 2 Mãos; balas longas
- Munição (Balas Longas) (cat. I, 1 esp.) — Repõe cargas de Fuzil de Caça, Fuzil de Assalto, Fuzil de Precisão, Metralhadora (1 cena/pacote)
- Coagulante (cat. I, 0.5 esp.) — +5 em testes para estabilizar sangrando e para remover a condição morrendo
- Pé de Mesa (cat. 0, 1 esp.)
- Faca (cat. 0, 1 esp.)

**Textos**

- **Aparência:** (em branco)
- **Personalidade:** (em branco)
- **Histórico:** (em branco)
- **Objetivo:** (em branco)

**Notas:** nenhuma anotação gravada no C.R.I.S para esta ficha. Retrato: [imagem em avatares/cora-falcao.jpg].

## D. Tepes

- **Classe:** Combatente · **Trilha:** Monstruoso · **NEX:** 20% · **Origem:** Policial
- **Patente:** Operador (35 PP) · **Crédito:** Médio · **Facção:** ordo_realitas · **Jogador:** (sem jogador)
- **Atributos:** AGI 1 · FOR 2 · INT 2 · PRE 1 · VIG 3
- **PV** 34/48 · **PE** 12/12 (por rodada 4) · **SAN** 6/21
- **Defesa:** 20 · **Deslocamento:** 9 m · **Esquiva** 0 · **Bloqueio** 8 · **Contra-ataque** 5
- **Resistências:** sangue 5
- **Afinidade:** nenhuma · **DT de rituais:** 15 · **Arma favorita:** — · **Pet:** —

**Perícias treinadas:** Adestramento (treinado), Fortitude (treinado), Investigação (treinado), Luta (treinado), Ocultismo (treinado), Percepção (treinado), Pontaria (treinado), Vontade (treinado), Faro (treinado)

**Ataques**

- Soco/Chute: teste 2d20 (fica com o maior) +5 (Luta), dano 1d3, crítico x2, alcance Curto, tipo Impacto
- Pé de Mesa: teste 2d20 (fica com o maior) +5 (Luta), dano 1d6 + FOR, crítico x2, alcance Curto, tipo Impacto
- Corrente: teste 2d20 (fica com o maior) +5 (Luta), dano 1d8 + FOR, crítico x2, alcance Curto, tipo Impacto

**Poderes e habilidades**

- **Ataque Especial**: Ao realizar um ataque, pode gastar 2 PE para receber +5 no teste de ataque ou na rolagem de dano. Mesmo com limite de PE por turno menor, sempre pode pagar o custo mínimo de uma habilidade.
- **Mutação Inicial**: Escolhe um elemento (Sangue, Morte, Conhecimento ou Energia) e desenvolve uma mutação física paranormal inicial. [Sangue: Resistência a Balístico e Sangue 5; soma Vigor no dano de contra-ataques; penalidade em Ciências/Intuição — Sobrevivendo ao Horror, Ser Amaldiçoado NEX 10%]
- **Patrulha**: +2 na Defesa.
- **Combate Defensivo**: Ao agredir, pode sofrer –1d20 nos testes de ataque para receber +5 na Defesa até o próximo turno.

**Rituais**

- (nenhum)

**Inventário**

- Cão Adestrado (cat. I, 0 esp.)
- Isqueiro (cat. 0, 0.5 esp.)
- Algemas (cat. 0, 1 esp.)
- Corda (cat. 0, 1 esp.) — 10m; +5 em Atletismo em descidas ou para amarrar alvos
- Mochila Militar (cat. I, 0 esp.) — +2 espaços de carga
- Cão de Guarda (cat. 0, 0 esp.)
- Celular (cat. 0, 1 esp.) — +2 em perícias p/ obter informação (se houver sinal); lanterna fraca (cone 4,5m)
- Pé de Mesa (cat. 0, 1 esp.)
- Armadura Leve (cat. II, 2 esp.) [mods: Reforçada]
- Corrente (cat. I, 1 esp.) — Dano 1d8 (Impacto) · +2 em desarmar e derrubar

**Textos**

- **Aparência:** (em branco)
- **Personalidade:** (em branco)
- **Histórico:** (em branco)
- **Objetivo:** (em branco)

**Notas:** nenhuma anotação gravada no C.R.I.S para esta ficha. Retrato: [imagem em avatares/d-tepes.jpg].

## Ivete Beicur

> **Atenção:** modelo quase em branco (só nome, NEX 50%, classe e números de modelo; sem origem, trilha, atributos distribuídos, perícias, inventário nem textos).

- **Classe:** Especialista · **Trilha:** (em branco) · **NEX:** 50% · **Origem:** (em branco)
- **Patente:** Recruta (0 PP) · **Crédito:** Baixo · **Facção:** ordo_realitas · **Jogador:** (sem jogador)
- **Atributos:** AGI 1 · FOR 1 · INT 1 · PRE 1 · VIG 1
- **PV** 53/53 · **PE** 40/40 (por rodada 10) · **SAN** 52/52
- **Defesa:** 11 · **Deslocamento:** 9 m · **Esquiva** 0 · **Bloqueio** 0 · **Contra-ataque** 0
- **Resistências:** nenhuma
- **Afinidade:** nenhuma · **DT de rituais:** 21 · **Arma favorita:** — · **Pet:** —

**Perícias treinadas:** —

**Ataques**

- Soco/Chute: teste 1d20 (fica com o maior) +0 (Luta), dano 1d3, crítico x2, alcance Curto, tipo Impacto

**Poderes e habilidades**

- **Eclético**: Gasta 2 PE para receber o bônus de treinamento (+5) em uma perícia na qual não é treinado, para um teste específico.
- **Perito**: Escolha duas perícias treinadas (exceto Luta e Pontaria). Ao testá-las, pode gastar 2 PE para somar +1d6 ao resultado.

**Rituais**

- (nenhum)

**Inventário**

- (vazio)

**Textos**

- **Aparência:** (em branco)
- **Personalidade:** (em branco)
- **Histórico:** (em branco)
- **Objetivo:** (em branco)

**Notas:** nenhuma anotação gravada no C.R.I.S para esta ficha. Retrato: [imagem em avatares/ivete-beicur.jpg].

## Marcela Geleerd

> **Atenção:** modelo quase em branco (só nome, NEX 50%, classe e números de modelo; sem origem, trilha, atributos distribuídos, perícias, inventário nem textos).

- **Classe:** Especialista · **Trilha:** (em branco) · **NEX:** 50% · **Origem:** (em branco)
- **Patente:** Recruta (0 PP) · **Crédito:** Baixo · **Facção:** ordo_realitas · **Jogador:** (sem jogador)
- **Atributos:** AGI 1 · FOR 1 · INT 1 · PRE 1 · VIG 1
- **PV** 53/53 · **PE** 40/40 (por rodada 10) · **SAN** 52/52
- **Defesa:** 11 · **Deslocamento:** 9 m · **Esquiva** 0 · **Bloqueio** 0 · **Contra-ataque** 0
- **Resistências:** nenhuma
- **Afinidade:** nenhuma · **DT de rituais:** 21 · **Arma favorita:** — · **Pet:** —

**Perícias treinadas:** —

**Ataques**

- Soco/Chute: teste 1d20 (fica com o maior) +0 (Luta), dano 1d3, crítico x2, alcance Curto, tipo Impacto

**Poderes e habilidades**

- **Eclético**: Gasta 2 PE para receber o bônus de treinamento (+5) em uma perícia na qual não é treinado, para um teste específico.
- **Perito**: Escolha duas perícias treinadas (exceto Luta e Pontaria). Ao testá-las, pode gastar 2 PE para somar +1d6 ao resultado.

**Rituais**

- (nenhum)

**Inventário**

- (vazio)

**Textos**

- **Aparência:** (em branco)
- **Personalidade:** (em branco)
- **Histórico:** (em branco)
- **Objetivo:** (em branco)

**Notas:** nenhuma anotação gravada no C.R.I.S para esta ficha. Retrato: [imagem em avatares/marcela-geleerd.webp].

## Miguel Albuquerque

- **Classe:** Especialista · **Trilha:** Técnico · **NEX:** 50% · **Origem:** Lutador
- **Patente:** Agente Especial (75 PP) · **Crédito:** Médio · **Facção:** ordo_realitas · **Jogador:** (sem jogador)
- **Atributos:** AGI 2 · FOR 1 · INT 3 · PRE 3 · VIG 1
- **PV** 53/53 · **PE** 60/60 (por rodada 10) · **SAN** 44/44
- **Defesa:** 19 · **Deslocamento:** 9 m · **Esquiva** 24 · **Bloqueio** 0 · **Contra-ataque** 5
- **Resistências:** nenhuma
- **Afinidade:** conhecimento · **DT de rituais:** 23 · **Arma favorita:** — · **Pet:** —

**Perícias treinadas:** Luta (treinado), Reflexos (treinado)

**Ataques**

- Soco/Chute: teste 1d20 (fica com o maior) +5 (Luta), dano 1d8 +1 +2 (Mão Pesada), crítico x2, alcance Curto, tipo Impacto
- Fuzil de Assalto: teste 2d20 (fica com o maior) +2 (Pontaria), dano 2d10, crítico 19/x3, alcance Médio, tipo Balístico

**Poderes e habilidades**

- **Eclético**: Gasta 2 PE para receber o bônus de treinamento (+5) em uma perícia na qual não é treinado, para um teste específico.
- **Perito**: Escolha duas perícias treinadas (exceto Luta e Pontaria). Ao testá-las, pode gastar 2 PE para somar +1d6 ao resultado.
- **Inventário Otimizado**: Soma Intelecto à Força para calcular os espaços de carga.
- **Remendão**: Conserta itens danificados e reduz em I a categoria de itens de investigação.
- **Mão Pesada**: +2 em rolagens de dano com ataques corpo a corpo.
- **Artista Marcial ✦**: Ataques desarmados causam 1d6 (→ 1d8 NEX 35% → 1d10 NEX 70%), podem causar dano letal e contam como armas ágeis.
- **Sensitivo**: +5 em testes de Diplomacia, Intimidação e Intuição. (NEX 50%.)
- **Expansão de Conhecimento**: Aprende um poder de outra classe. (NEX 50%.)
- **Ataque Especial**: Ao realizar um ataque, pode gastar 2 PE para receber +5 no teste de ataque ou na rolagem de dano. Mesmo com limite de PE por turno menor, sempre pode pagar o custo mínimo de uma habilidade. (via Expansão de Conhecimento)
- **Especialista Diletante**: Aprende um poder de outra classe cujos pré-requisitos possa cumprir (exceto trilha ou paranormal).
- **Escolhido pelo Outro Lado**: Permite aprender e conjurar rituais. Começa conhecendo 3 rituais de 1º círculo; a cada novo NEX aprende +1 ritual de qualquer círculo que já possa lançar. (via Especialista Diletante)

**Rituais**

- Amaldiçoar Arma (1º círculo, Conhecimento)
- Perturbação (1º círculo, Conhecimento)
- Terceiro Olho (1º círculo, Conhecimento)

**Inventário**

- Soqueira (cat. II, 1 esp.) [maldições: Ritualística] — +1 no dano desarmado; aceita modificações de arma corpo a corpo
- Fuzil de Assalto (cat. III, 2 esp.) [mods: Alongada] — Dano 2d10 (Balístico) · Crítico 19/x3 · Alcance Médio · 2 Mãos; arma automática
- Munição (Balas Longas) (cat. I, 1 esp.) — Repõe cargas de Fuzil de Caça, Fuzil de Assalto, Fuzil de Precisão, Metralhadora (1 cena/pacote)
- Armadura Leve (cat. II, 2 esp.) [mods: Reforçada] — Defesa +5
- Bandoleira (cat. I, 1 esp.) — Sacar/guardar como ação livre (1/rodada)
- Mochila Militar (cat. I, 0 esp.) — +2 espaços de carga
- Componentes Ritualísticos de Conhecimento (cat. 0, 1 esp.)
- Kit de Tecnologia (cat. 0, 1 esp.) — Evita penalidade de –5 em testes de Tecnologia
- Kit de Perícia (Ocultismo) (cat. 0, 1 esp.) — Evita penalidade de –5 em testes técnicos
- Lanterna Tática (cat. I, 1 esp.) — Ilumina; pode ofuscar inimigos
- Corda (cat. 0, 1 esp.) — 10m; +5 em Atletismo em descidas ou para amarrar alvos
- Algemas (cat. 0, 1 esp.) — Exige agarrar o alvo; –5 em testes que usam as mãos e impede conjuração

**Textos**

- **Aparência:** (em branco)
- **Personalidade:** (em branco)
- **Histórico:** (em branco)
- **Objetivo:** (em branco)

**Notas:** nenhuma anotação gravada no C.R.I.S para esta ficha. Retrato: [imagem em avatares/miguel-albuquerque.png].

## Nico Delagnore

- **Classe:** Ocultista · **Trilha:** Lâmina Paranormal · **NEX:** 65% · **Origem:** Vítima
- **Patente:** Agente Especial (75 PP) · **Crédito:** Médio · **Facção:** ordo_realitas · **Jogador:** (sem jogador)
- **Atributos:** AGI 2 · FOR 1 · INT 3 · PRE 3 · VIG 2
- **PV** 62/62 · **PE** 117/117 (por rodada 13) · **SAN** 63/63
- **Defesa:** 12 · **Deslocamento:** 9 m · **Esquiva** 22 · **Bloqueio** 0 · **Contra-ataque** 5
- **Resistências:** nenhuma
- **Afinidade:** morte · **DT de rituais:** 26 · **Arma favorita:** — · **Pet:** —

**Perícias treinadas:** Atualidades (treinado), Ciências (treinado), Enganação (treinado), Furtividade (treinado), Iniciativa (treinado), Intuição (treinado), Investigação (treinado), Luta (treinado), Medicina (treinado), Ocultismo (expert), Percepção (treinado), Reflexos (veterano), Sobrevivência (treinado), Vontade (veterano)

**Ataques**

- Soco/Chute: teste 1d20 (fica com o maior) +5 (Luta), dano 1d3, crítico x2, alcance Curto, tipo Impacto
- Espada: teste 3d20 (fica com o maior) +15 (Ocultismo), dano 1d8/1d10 + FOR +1d8 (Morte) +2 (Ninja Urbano), crítico 19, alcance Curto, tipo Corte

**Poderes e habilidades**

- **Lâmina Maldita**: Usa Ocultismo para testes de ataque com armas amaldiçoadas.
- **Gladiador Paranormal**: Ganha PE temporários ao acertar golpes corpo a corpo.
- **Conjuração Marcial**: Após um ritual (ação padrão), gasta 2 PE para um ataque corpo a corpo (ação livre).
- **Escolhido pelo Outro Lado**: Permite aprender e conjurar rituais. Começa conhecendo 3 rituais de 1º círculo; a cada novo NEX aprende +1 ritual de qualquer círculo que já possa lançar.
- **Cicatrizes Psicológicas**: +1 de Sanidade para cada 5% de NEX.
- **Potencial Aprimorado**: +1 PE adicional por NEX. (NEX 65%.)
- **Surto Temporal**: Uma vez por cena, ação padrão adicional gastando 3 PE. (NEX 65%.)
- **Visão do Oculto**: +5 em Percepção e enxerga no escuro. (NEX 65%.)
- **Escapar da Morte**: Uma vez por cena, se cair para 0 PV, fica com 1 PV. (NEX 65%.)
- **Expansão de Conhecimento**: Aprende um poder de outra classe. (NEX 65%.)
- **Ninja Urbano**: Proficiência com armas táticas corpo a corpo e de disparo, e +2 no dano com elas. (via Expansão de Conhecimento)

**Rituais**

- Amaldiçoar Arma (1º círculo, Morte)
- Decadência (1º círculo, Morte)
- Definhar (1º círculo, Morte)
- Cicatrização (1º círculo, Morte)
- Desacelerar Impacto (2º círculo, Morte)
- Miasma Entrópico (2º círculo, Morte)
- Paradoxo (2º círculo, Morte)
- Poeira da Podridão (3º círculo, Morte)
- Compreensão Paranormal (1º círculo, Conhecimento)
- Terceiro Olho (1º círculo, Conhecimento)
- Localização (2º círculo, Conhecimento)
- Detecção de Ameaças (2º círculo, Conhecimento)
- Invadir Mente (2º círculo, Conhecimento)
- Vidência (3º círculo, Conhecimento)
- Mergulho Mental (3º círculo, Conhecimento)

**Inventário**

- Espada (cat. III, 1 esp.) [maldições: Erosiva] — Dano 1d8/1d10 (Corte) · Crítico 19 · 1 ou 2 Mãos
- Máscara das Pessoas nas Sombras (cat. II, 1 esp.) — Item amaldiçoado de Conhecimento (marca da Seita das Máscaras). Concede Resistência a Conhecimento 10. Teleporte: ação de movimento + 2 PE p/ entrar numa sombra adjacente e sair em outra que você veja em alcance médio. Preço da maldição: falhar teste de Intelecto custa 2 SAN por portar o item
- Vestimenta (cat. II, 1 esp.) [mods: Aprimorado; perícia: Reflexos] — +2 em uma perícia à escolha (exceto Luta/Pontaria); máx. 2 vestimentas ativas ao mesmo tempo; não cumulativo com outro item na mesma perícia

**Textos**

- **Aparência:** (em branco)
- **Personalidade:** (em branco)
- **Histórico:** (em branco)
- **Objetivo:** (em branco)

**Notas:** nenhuma anotação gravada no C.R.I.S para esta ficha. Retrato: (sem retrato).

## Sr. Veríssimo

- **Classe:** Combatente · **Trilha:** Comandante De Campo · **NEX:** 70% · **Origem:** Desgarrado
- **Patente:** Agente de Elite (200 PP) · **Crédito:** Ilimitado · **Facção:** ordo_realitas · **Jogador:** (sem jogador)
- **Atributos:** AGI 2 · FOR 3 · INT 2 · PRE 2 · VIG 2
- **PV** 100/100 · **PE** 56/56 (por rodada 14) · **SAN** 51/51
- **Defesa:** 24 · **Deslocamento:** 9 m · **Esquiva** 22 · **Bloqueio** 10 · **Contra-ataque** 15
- **Resistências:** nenhuma
- **Afinidade:** nenhuma · **DT de rituais:** 26 · **Arma favorita:** — · **Pet:** —

**Perícias treinadas:** Diplomacia (treinado), Fortitude (expert), Iniciativa (treinado), Investigação (treinado), Luta (expert), Medicina (treinado), Percepção (treinado), Pilotagem (treinado), Reflexos (veterano), Sobrevivência (treinado), Tática (veterano), Vontade (expert)

**Ataques**

- Soco/Chute: teste 3d20 (fica com o maior) +15 (Luta), dano 1d3, crítico x2, alcance Curto, tipo Impacto

**Poderes e habilidades**

- **Inspirar Confiança**: Reação de 2 PE: faça um aliado em alcance curto rolar novamente um teste recém-realizado.
- **Estrategista**: Gasta 1 PE por aliado para conceder uma ação de movimento adicional no próximo turno deles.
- **Brecha na Guarda**: Reação de 2 PE: você ou um aliado faz um ataque adicional contra um alvo que acabou de sofrer dano.
- **Oficial Comandante**: Por 5 PE, concede uma ação padrão adicional para todos os aliados em alcance médio.
- **Calejado**: +1 PV para cada 5% de NEX.
- **Ataque Especial**: Ao realizar um ataque, pode gastar 2 PE para receber +5 no teste de ataque ou na rolagem de dano. Mesmo com limite de PE por turno menor, sempre pode pagar o custo mínimo de uma habilidade.
- **Casca Grossa**: +1 PV para cada 5% de NEX e soma Vigor na resistência do bloqueio. (via Versatilidade, trilha Tropa de Choque)
- **Golpe Pesado**: O dano de armas corpo a corpo aumenta em um dado do mesmo tipo.
- **Proteção Pesada**: Recebe proficiência com proteções pesadas.
- **Ataque de Oportunidade**: Reação (1 PE): ataca corpo a corpo um ser que saia voluntariamente de um espaço adjacente ao seu.
- **Tanque de Guerra**: Aumenta Defesa e RD de proteções pesadas em +2.

**Rituais**

- (nenhum)

**Inventário**

- Armadura Pesada (cat. II, 5 esp.) — Defesa +10 · RD 2 (Físicos)

**Textos**

- **Aparência:** (em branco)
- **Personalidade:** (em branco)
- **Histórico:** (em branco)
- **Objetivo:** (em branco)

**Notas:** nenhuma anotação gravada no C.R.I.S para esta ficha. Retrato: [imagem em avatares/sr-verissimo.webp].

## Ômega-99

- **Classe:** Ocultista · **Trilha:** Graduado · **NEX:** 99% · **Origem:** Religioso
- **Patente:** Agente de Elite (200 PP) · **Crédito:** Ilimitado · **Facção:** lotus_branca · **Jogador:** (sem jogador)
- **Atributos:** AGI 3 · FOR 2 · INT 3 · PRE 3 · VIG 3
- **PV** 110/110 · **PE** 140/140 (por rodada 20) · **SAN** 115/115
- **Defesa:** 30 · **Deslocamento:** 9 m · **Esquiva** 32 · **Bloqueio** 5 · **Contra-ataque** 8
- **Resistências:** elemental 10
- **Afinidade:** morte · **DT de rituais:** 33 · **Arma favorita:** — · **Pet:** —

**Perícias treinadas:** Artes (veterano), Atualidades (treinado), Ciências (expert), Diplomacia (treinado), Enganação (veterano), Fortitude (treinado), Furtividade (treinado), Iniciativa (veterano), Intimidação (treinado), Intuição (veterano), Investigação (expert), Luta (treinado), Medicina (treinado), Ocultismo (expert), Percepção (veterano), Reflexos (treinado), Religião (veterano), Tática (treinado), Tecnologia (veterano), Vontade (expert)

**Ataques**

- Soco/Chute: teste 2d20 (fica com o maior) +5 (Luta), dano 1d3, crítico x2, alcance Curto, tipo Impacto
- Espada Amaldiçoada — Sanguinária: teste +8 (Luta), dano 1d8+1d8 (Corte + Sangue), crítico 19-20/x2, alcance Corpo a corpo, tipo Corte — Maldição Sanguinária: dano de Sangue extra multiplicado em críticos. Em crítico: 2d10 PV temporários e alvo fica Fraco.

**Poderes e habilidades**

- **Rituais Eficientes**: A DT para resistir aos seus rituais aumenta em +5.
- **Conhecendo o Medo**: Aprende automaticamente o ritual Conhecendo o Medo.
- **Acalentar**: +5 em Religião para acalmar; alvo recupera 1d6 + Presença de Sanidade.
- **Escolhido pelo Outro Lado**: Permite aprender e conjurar rituais. Começa conhecendo 3 rituais de 1º círculo; a cada novo NEX aprende +1 ritual de qualquer círculo que já possa lançar.
- **Saber Ampliado**: Trilha Graduado — ganha +1 ritual (não conta no limite) a cada círculo desbloqueado: NEX 10/25/55/85%.
- **Grimório Ritualístico**: Possui um grimório com rituais extras; número de rituais no livro é baseado em Intelecto.
- **Inventário Organizado**: Soma Intelecto ao limite de carga; itens de peso 0,5 ocupam só 0,25. Pré-requisito: Int 2.
- **Ritual Potente**: Soma Intelecto nas rolagens de dano ou efeitos de cura de seus rituais. Pré-requisito: Int 2.
- **Mestre em Elemento (Morte)**: Custo para lançar rituais de Morte diminui em -1 PE. Pré-requisitos: Especialista em Elemento (Morte), NEX 45%.
- **Especialista em Elemento (Morte)**: A DT para resistir aos seus rituais de Morte aumenta em +2.
- **Criar Selo**: Sabe fabricar selos amaldiçoados. Máximo de selos ativos igual à Presença.
- **Fluxo de Poder**: Mantém dois efeitos sustentados de rituais simultaneamente com uma ação livre. Pré-requisito: NEX 60%.

**Rituais**

- Amaldiçoar Arma (1º círculo, Sangue)
- Armadura de Sangue (1º círculo, Sangue)
- Corpo Adaptado (1º círculo, Sangue)
- Aprimorar Físico (2º círculo, Sangue)
- Forma Monstruosa (2º círculo, Sangue)
- Purgatório (3º círculo, Sangue)
- Martírio de Sangue (4º círculo, Sangue)
- Eletrocussão (1º círculo, Energia)
- Overclock (1º círculo, Energia)
- Chamas do Caos (2º círculo, Energia)
- Salto Fantasma (3º círculo, Energia)
- Teletransporte (4º círculo, Energia)
- Decadência (1º círculo, Morte)
- Cicatrização (1º círculo, Morte)
- Definhar (1º círculo, Morte)
- Miasma Entrópico (2º círculo, Morte)
- Paradoxo (2º círculo, Morte)
- Poeira da Podridão (3º círculo, Morte)
- Fim Inevitável (4º círculo, Morte)
- Terceiro Olho (1º círculo, Conhecimento)
- Compreensão Paranormal (1º círculo, Conhecimento)
- Localização (2º círculo, Conhecimento)
- Invadir Mente (2º círculo, Conhecimento)
- Vidência (3º círculo, Conhecimento)
- Controle Mental (4º círculo, Conhecimento)
- Presença do Medo (4º círculo, Medo)

**Inventário**

- Espada Amaldiçoada — Sanguinária (cat. II, 1 esp.) — Maldição de arma (Sangue): +1d8 dano de Sangue extra, multiplicado em críticos.
- Armadura Pesada Amaldiçoada — Cinética (cat. III, 5 esp.) — Base: Defesa +10, RD 2 (Físicos). Maldição Cinética (Energia): +2 Defesa e RD 5 (proteção pesada).
- Bracelete Amaldiçoado — Defesa (cat. 0, 0.5 esp.) — Maldição de acessório (Energia): +5 na Defesa.
- Anel Amaldiçoado — Pujança (cat. 0, 0.5 esp.) — Maldição de acessório (Sangue): +1 em Força.
- Coração Pulsante (cat. II, 1 esp.) — Item Amaldiçoado Especial. Empunhando, ao sofrer dano pode gastar reação pra reduzi-lo à metade. Cada uso exige Fortitude (DT 15 +5 por uso adicional no dia); falha destrói o item.
- Talismã da Sorte (cat. II, 1 esp.) — Item Amaldiçoado Especial. Vestindo e sofrendo dano: reação + 3 PE, rola 1d4. 2-3 evita o dano; 4 evita mas destrói o talismã; 1 dobra o dano e destrói.
- Jaqueta de Veríssimo (cat. II, 1 esp.) — Item Amaldiçoado Especial. Resistência a dano paranormal 15. Aliado adjacente ia sofrer dano: reação + 2 PE pra virar o alvo no seu lugar.
- Dedo Decepado (cat. II, 1 esp.) — Item Amaldiçoado Especial. Concede um poder paranormal aleatório do antigo dono. 1d4=1 ao descansar: não recupera PV/PE/SAN. Visto com o item: -10 em Diplomacia.
- Grimório Pessoal (cat. I, 1 esp.) — Registra os rituais conhecidos — Grimório Ritualístico: número de rituais extras no livro baseado em Intelecto.
- Selos Paranormais (Terceiro Olho) (cat. I, 1 esp.) — Selo gravado com o ritual Terceiro Olho — empunhar e ler em voz alta ativa e desfaz o selo.
- Selos Paranormais (Fim Inevitável) (cat. IV, 1 esp.) — Selo gravado com o ritual Fim Inevitável (4º círculo) — categoria = círculo do ritual.
- Componentes Ritualísticos — (todos elementos) (cat. 0, 1 esp.) — Kit completo: cinzas (Morte), circuitos (Energia), sal (Conhecimento), agulhas (Sangue). Essenciais p/ conjurar rituais (exceto Medo).
- Cicatrizante (cat. I, 1 esp.) — Cura 2d8+2 PV
- Cicatrizante (cat. I, 1 esp.) — Cura 2d8+2 PV
- Mochila Militar (cat. I, 0 esp.) — +2 espaços de carga
- Kit de Perícia - (Ocultismo) (cat. 0, 1 esp.)

**Textos**

- **Aparência:** (em branco)
- **Personalidade:** (em branco)
- **Histórico:** (em branco)
- **Objetivo:** (em branco)

**Notas:** nenhuma anotação gravada no C.R.I.S para esta ficha. Retrato: (sem retrato).

## Personagens de história (NPCs do C.R.I.S)

Registros curtos da tabela `characters` (não são fichas de agente: só situação, sanidade, exposição e ameaça).

### A Voz que Conta Nomes
- Tipo: npc · Situação: missing · Sanidade 0 · Exposição 100 · Ameaça 5 · Elemento: conhecimento
- Segredo: Entidade do Conhecimento. Alimenta-se de ser ouvida.
- Notas: (em branco)

### Det. Marina Couto
- Tipo: player · Situação: alive · Sanidade 72 · Exposição 30 · Ameaça 2 · Elemento: —
- Segredo: Ouve a voz desde a infância, mas nunca contou à equipe.
- Notas: (em branco)

### Dr. Aílton Vega
- Tipo: player · Situação: alive · Sanidade 55 · Exposição 45 · Ameaça 3 · Elemento: —
- Segredo: Falsificou laudos para encobrir a causa de morte das vítimas.
- Notas: (em branco)

### Padre Eustáquio
- Tipo: npc · Situação: alive · Sanidade 64 · Exposição 20 · Ameaça 2 · Elemento: —
- Segredo: Sabe o ritual de selamento, mas teme o preço de usá-lo.
- Notas: (em branco)

### Tomás, o Sobrevivente
- Tipo: npc · Situação: corrupted · Sanidade 18 · Exposição 88 · Ameaça 5 · Elemento: conhecimento
- Segredo: Voltou do Casarão repetindo um nome que não é o seu. É o vetor da entidade.
- Notas: (em branco)

## Criaturas (monstros do C.R.I.S)

### Zumbi de Sangue
- Ameaça 2 · Elemento: sangue · PV 18/18 · PE 0/0 · Defesa 12 · Iniciativa 8
- Poderes:
  - Garras: +6, 1d8+2 de corte
  - Frenesi: ao reduzir um alvo a 0 PV, recebe ação extra

### Sussurro do Conhecimento
- Ameaça 4 · Elemento: conhecimento · PV 12/12 · PE 6/6 · Defesa 16 · Iniciativa 15
- Poderes:
  - Nome Verdadeiro: alvo faz teste de Sanidade DT 18 ou perde 1d6 SAN
  - Intangível: resistência a dano físico 5

### Tomás Possesso
- Ameaça 5 · Elemento: conhecimento · PV 32/32 · PE 0/0 · Defesa 14 · Iniciativa 11
- Poderes:
  - Investida Desesperada: +9, 2d6+4
  - Colapso Mental (1/cena): todos em 9m testam Sanidade DT 20

### Bicho-Papão
- Ameaça 5 · Elemento: conhecimento · PV 600/600 · PE 0/0 · Defesa 27 · Iniciativa 15
- Poderes:
  - Garras Atormentadoras (corpo a corpo, x2)
  - Destruir Mente: pode trocar o dano por dano mental contra alvo enlouquecendo
  - Tamanho Adaptável: encolhe e se esconde
  - Tormento Infantil (fraqueza): fica desprevenido ao ouvir cantiga/choro de criança
- Notas:
  - Atributos: AGI 5 · FOR 4 · INT 3 · PRE 5 · VIG 4 · VD 320
  - Elemento Conhecimento (criatura do Medo) · Imune mental/medo e dano · Resist. 10, Conhecimento 15 · Vuln. Sangue · Presença Perturbadora (NEX 90%, DT 25, 6d6 mental)

### Zumbi de Sangue Bestial
- Ameaça 4 · Elemento: sangue · PV 112/112 · PE 0/0 · Defesa 19 · Iniciativa 12
- Poderes:
  - Mordida de Sangue: 2d10+4 Sangue
  - Garras: 2d8+2 Sangue
  - Ataque Furtivo: bônus ao atacar alvos desprevenidos
- Notas:
  - Atributos: AGI 3 · FOR 3 · INT 0 · PRE 1 · VIG 2 · VD 80
  - Resist. balístico/impacto/perfuração 5 · Sangue 10 · Age de forma predatória e estratégica

