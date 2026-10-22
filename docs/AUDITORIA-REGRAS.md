# Conferência das regras com os livros (29/09/2026)

O motor de regras (`shared/src/regras/`) foi conferido entrada por entrada com o **Livro de Regras** (LR, pelo texto do PDF) e o **Sobrevivendo ao Horror** (SaH, página por página, pelas imagens: o PDF não tem texto). O C.R.I.S serviu só de guia: onde ele e o livro discordam, vale o livro. As páginas citadas são as impressas no rodapé.

Direitos autorais: aqui só há resumos com as nossas palavras; nada de texto do livro.

## O que foi conferido

| Frente | Entradas | Resultado |
|---|---|---|
| Classes, progressão de NEX, perícias, patentes | 4 classes, 28 perícias, 5 patentes, a tabela de cada NEX | Tudo certo. Só comentários ajustados |
| Origens | 46 (26 do LR, 20 do SaH) | LR certas. SaH: 40 páginas preenchidas (estavam em 0), Profetizado refeito (Vontade fixa + uma à escolha), o +2 de ataque em dobro tirado de 3 poderes, 3 textos corrigidos |
| Trilhas e poderes | 24 trilhas (96 habilidades), 114 poderes | LR certos, fora 2 poderes. SaH: 31 páginas corrigidas, Monstruoso, Possuído e Parapsicólogo corrigidos, o efeito repetido do Treinamento em Perícia tirado |
| Itens | 48 armas, 3 proteções, 96 equipamentos, 25 modificações, 54 itens amaldiçoados, 37 maldições | Nenhum número de tabela errado. Metralhadora, bateria potente e os trajes do SaH corrigidos; lente de revelação e Dedo Decepado (Medo) incluídos; efeitos passivos que faltavam em itens e maldições |
| Rituais e poderes paranormais | 97 rituais, 30 poderes | 3 dados corrigidos (uma resistência e duas páginas do SaH) |

## O que mudou no motor

- **Arma improvisada:** −1d20 no ataque (LR p. 57). Os três "pé de mesa" dos Marcados passam a ter a penalidade.
- **Ataque desarmado** sempre na lista de ataques; a soqueira soma +1 no dano.
- **Cão adestrado:** +2 em Investigação e Percepção sem condição, desde que o dono seja treinado em Adestramento (LR p. 170; SaH p. 42).
- **Equipamento em uso** passa a valer nas contas: resistências dos trajes (hazmat 10 a químico, mergulho, espacial), dano da soqueira; os efeitos condicionais aparecem como aviso.
- **Mochila militar:** duas não somam (uma nas costas).
- **Acessório guardado** (nem vestido nem empunhado) não dá bônus; mais de duas vestimentas vira aviso (LR p. 63).
- **Modificações conferidas:** no item certo, sem repetir, sem as que não combinam.
- **Sobrecarga** vira aviso com as penalidades (LR p. 53).
- **Preço da maldição:** item amaldiçoado mostra quanto de Sanidade custa falhar no teste do atributo do elemento (LR p. 145).
- **Dados a mais ou a menos nas perícias** (−1d20 da Mutação, Foco em Perícia) entram na conta.
- **Crédito:** poderes que sobem o crédito (Magnata) mudam o nível da patente.
- **Afinidade de Resistir a <Elemento>:** conta por elemento. Com Resistir a Sangue e a Morte e afinidade em Sangue: 20 em Sangue e 10 em Morte (antes somava 20 nos dois).
- **A mesma habilidade vinda de lugares diferentes** (origem Psicólogo e trilha Parapsicólogo) conta nas duas.
- **Custo e DT de cada ritual:** 1, 3, 6 e 10 PE pelo círculo (LR p. 117), com os poderes que baratinham e a DT por elemento.
- Textos: "1 perícia" no singular, "−1d20" com o sinal certo, espaços a mais.

Testes novos em `server/test/regras.test.ts` (90 testes passando).

## O que ainda falta no motor (próximas etapas)

1. **Progressão de NEX do Monstruoso** (SaH p. 98–103): as alterações gerais de 25% e 35% entram nas contas desde 22/10; as de 50% em diante e as do elemento (60% em diante) ficam com o mestre (ajustes).
2. **Possuído:** os poderes de ocultista não são forçados a virar Transcender; "Ele Me Ensina" e Flashback são só texto.
3. **Expansão de Conhecimento** não entrega o poder de outra classe.
4. **Especialista Diletante** deixa pegar poder geral.
5. **Escolha dentro do item** (o elemento de "Arma (Elemento)", o ritual dos selos, a perícia do utensílio): falta um campo no item.
6. **Ferramentas Favoritas, Mochila de Utilidades, Ferramenta de Trabalho:** reduzem a categoria ou dão proficiência a um item escolhido; hoje ficam como aviso.
7. **Itens amaldiçoados que são armas** (Arcabuz, Coletora, Punhos Enraivecidos, Fuzil Alheio) ainda não viram ataque.
8. **Modificações de munição** (dum dum, explosiva) ainda não chegam ao ataque da arma.
9. **Selos:** a categoria é a do círculo do ritual; o catálogo usa I.
10. **Profissão** é uma perícia só (não separa armeiro, engenheiro, psicólogo).
11. **Kit exigido** pela perícia: a penalidade sem kit ainda não aparece.
12. **Amaldiçoar Arma** não guarda o elemento escolhido.

## As fichas dos Marcados (NEX 20%, 35 PP, operadores)

Reproduzidas escolha por escolha e conferidas com o livro: 68 pontos certos. O que a ficha de cada um precisa (aparece como pendência ou aviso na aba FICHAS):

- **D. Tepes:** falta o aumento de atributo do NEX 20% (LR p. 26). O PV 48 do C.R.I.S é o de Vigor 4: provavelmente o Vigor.
- **Catarina:** faltam as duas perícias do Perito (fora Luta e Pontaria, LR p. 28). Está sobrecarregada (8 de 7 espaços: −5 na Defesa e em Acrobacia, Crime e Furtividade, −3 m); tirando 1 espaço, fica com Defesa 19.
- **Alosi:** falta uma perícia (Vontade veio da classe e da origem, LR p. 22). O Crânio Espiral é item amaldiçoado (LR p. 149): a Ordem só libera para agente especial ou acima (LR p. 144), e ela é operadora.
- **Cora:** o fuzil com calibre grosso só usa munição de calibre grosso (LR p. 60): anotar as balas longas como de calibre grosso.

Conferidos e certos: atributos, perícias, trilhas e requisitos, poderes (Combate Defensivo pede Int 2, Tiro Certeiro pede Pontaria, Ninja Urbano, Ritual Potente pede Int 2), os 7 rituais de Alosi, categorias e limites de itens (com A Favorita e as modificações), proficiências, PV, PE, SAN, Defesa, deslocamento, limite de PE, reações e ataques (katana 4d20+5 / 1d10+8; fuzil 3d20+5 / 3d8+5 / 17/x3).

## Dúvidas para o mestre decidir

| | Dúvida | Leituras | Sugestão |
|---|---|---|---|
| D1 | Quando Vigor ou Presença sobem, os PV e PE dos NEX anteriores também sobem? | O livro não diz. (a) retroativo (o CRONA faz assim); (b) só a partir do NEX do aumento. Alosi PE 32 × 29; Cora PV 40 × 37 | **Decidido em 19/10 pelo Felipe: (b), só a partir do NEX do aumento** (Cora 37 PV, Alosi 29 PE); regra da mesa em REGRAS.md, seção 12 |
| D2 | Tepes: qual atributo subiu em NEX 20%? | O PV 48 do C.R.I.S aponta para Vigor | Confirmar com o jogador |
| D3 | Cora: o aumento de NEX 20% foi no Vigor? | Com D1 (a), os números são iguais | Só para o registro |
| D4 | O "pé de mesa" é arma improvisada ou bastão? | Improvisada: 1d6, −1d20 (LR p. 57). Bastão: 1d6/1d8, sem penalidade (LR p. 56 e 58) | Improvisada, pelo livro; o CRONA já aplica o −1d20 |
| D5 | Qual kit da Catarina? | Ladrão (Crime) ou eletrônica (Tecnologia) | Kit de ladrão |
| D6 | Como o Crânio Espiral chegou à Alosi? | Requisitado à Ordem: ilegal para operadora. Achado em missão: pode ficar e nem ocupa a vaga de categoria II | Decidir; o preço da maldição vale nos dois casos |
| D7 | Tepes a partir de NEX 25% | A progressão do Monstruoso muda perícias e PE (SaH p. 98–99) | **Feito em 22/10** para 25% e 35% (aba Evolução); o resto, nas próximas subidas de NEX |
| D8 | Forma Monstruosa: 2º ou 3º círculo? | A descrição diz 2º; a lista por círculo diz 3º | Ficou o 2º |
| D9 | Resistir a <Elemento> em outro elemento conta como outro poder? | A regra geral é escolher cada poder paranormal uma vez | Hoje o CRONA deixa em outro elemento |
| D10 | Cultista Arrependido que começa em NEX 0%: SAN 6 ou 8? | Depende de como a regra do treinamento conta | Decidir |

## O aviso de evolução dos Marcados (21/10/2026)

Conferido com o livro (LR p. 23 a 35, Tab. 1.3 a 1.5; SaH p. 17 e 98–99) o que o jogador vê ao subir de NEX (`resumoEvolucao`, `shared/src/regras/evolucao.ts`):

| Quem | NEX | Entra sozinho (livro) | O jogador escolhe | Bate com o livro |
|---|---|---|---|---|
| Cora (combatente, Aniquilador) | 25% | Ataque Especial: 3 PE, +10 (LR p. 24/25). A habilidade de trilha só vem em 10, 40, 65 e 99%. | nada | sim |
| Catarina (especialista, Infiltrador) | 25% | Perito: 3 PE, +1d8 (LR p. 28/29). | as 2 perícias do Perito (treinadas, exceto Luta e Pontaria; NEX 5%, pendente) | sim |
| Alosi (ocultista, Graduado) | 25% | Escolhido pelo Outro Lado libera o 2º círculo (LR p. 32/33). | um ritual de até 2º círculo; o ritual extra do Saber Ampliado, do 2º círculo (LR p. 35); uma perícia no lugar da Vontade repetida (LR p. 22, NEX 5%, pendente) | sim |
| D.Tepes (combatente, Monstruoso) | 25% e 30% | 25%: Ataque Especial 3 PE, +10 e a alteração do Monstruoso (SaH p. 99: Ocultismo sem treino/+2 e −5 numa de Diplomacia, Enganação ou Intimidação, com o mestre). 30%: nada. | 30%: um poder de combatente (ou geral, SaH p. 33, ou Transcender) | sim; a alteração do Monstruoso segue fora das contas |

Corrigido junto: o aviso de texto da primeira rodada dizia que a Catarina e a Cora ganhavam habilidade de trilha em 25%; o livro não dá (só 10, 40, 65 e 99%). Sai do banco no próximo início do servidor.

## Auditoria geral das fichas (22/10/2026)

Pedido do Felipe: "conferir, de uma forma geral, as escolhas que eles fizeram e as que têm pra fazer: TEM que estar TUDO de acordo com as regras". Foram conferidas as 14 fichas do banco (os 4 Marcados e os 10 NPCs com ficha), com o script `scripts/dev/auditar-fichas.mts` (lê o JSON das fichas salvas e roda o motor):

- **Escolhas feitas:** cada escolha, NEX a NEX, passa pelo motor (requisito, grau, lista de opções, círculo do ritual, limite de itens da patente). Erro do motor aparece como "ERRO"; os que dependem de decisão do mestre estão na tabela abaixo.
- **Pendências:** as que o jogador vê na aba Evolução, com a janela de escolha real (`escolherPendencia` da interface, rodada sem navegador) e a lista de opções liberadas e travadas com o motivo.
- **PV, PE, SAN e Defesa refeitos à parte, só pelas tabelas do livro** (LR p. 25, 29 e 33: PV 20/16/12 + Vigor e +4/+3/+2 + Vigor por NEX; PE 2/3/4 + Presença e +2/+3/+4 + Presença; SAN 12/16/20 e +3/+4/+5), com a regra da mesa de 19/10 (o aumento de Vigor ou Presença só vale do NEX do aumento em diante). **Os quatro Marcados batem com o livro, número por número:** Tepes 61/18/27, Catarina 33/25/32, Alosi 25/37/40, Cora 43/20/24. As diferenças dos NPCs são todas de poder, nunca de conta: Cicatrizes Psicológicas (+1 SAN por 5% de NEX, LR p. 21; Vítima), Transcender (não ganha SAN no NEX, LR p. 26) e Potencial Aprimorado (+1 PE por NEX, LR p. 115).
- **Tabelas de classe reconferidas** (LR p. 22–35): progressão de NEX das três classes, Perito (Tab. 1.4), Eclético (2 PE para ter o treino; **não dá +5**), Engenhosidade, Grau de Treinamento (1, 5 ou 3 + Intelecto), Escolhido pelo Outro Lado, Saber Ampliado, 110% (Atleta, LR p. 17: +5 por 2 PE em Força ou Agilidade, fora Luta e Pontaria). Nada a corrigir.

### O que mudou no motor

- **Monstruoso (SaH p. 17 e 99):** a trilha recebe "todas as alterações apropriadas ao seu NEX". As gerais de **25%** e **35%** agora entram nas contas e viram escolha na aba Evolução, com as opções do livro:
  - 25%: Ocultismo +2 (a trilha já o deixou treinado) e −5 numa perícia à escolha entre Diplomacia, Enganação e Intimidação;
  - 35%: um atributo (menos Presença) soma no total de PE e −5 numa perícia à escolha entre Atletismo, Fortitude e Reflexos (o livro diz "soma o atributo em seu total de PE": contado uma vez, com o atributo do momento).
  - As de 50% (afinidade, que o NEX 50% já pede) e as do elemento, a partir de 60% (SaH p. 100–103), seguem com o mestre. **O Tepes tem a de 25% para escolher.**
- Escolha de atributo fora das opções da habilidade passa a ser erro.

### Os quatro Marcados

| | Já escolheu | Falta escolher (opções) | Contas |
|---|---|---|---|
| **D. Tepes** (combatente, Monstruoso, NEX 30, Policial) | Ser Amaldiçoado: Sangue (10%), Combate Defensivo (15%), +1 Vigor (20%) | **25%:** a perícia do −5 (Diplomacia, Enganação ou Intimidação). **30%:** um poder de combatente (39 liberados, 29 travados com o motivo; Transcender e Treinamento em Perícia entram na lista) | batem com o livro |
| **Catarina** (especialista, Infiltrador, NEX 25, Atleta) | Ninja Urbano (15%), +1 Agilidade (20%) | **Perito:** duas perícias treinadas, fora Luta e Pontaria (10 liberadas: Acrobacia, Atletismo, Crime, Furtividade, Iniciativa, Investigação, Percepção, Reflexos, Tecnologia, Vontade) | batem |
| **Alosi** (ocultista, Graduado, NEX 25, Religioso) | 3 rituais de 1º círculo (5%), Cicatrização e Cinerária pelo Saber Ampliado (10%), Ritual Potente e Embaralhar (15%), Espirais da Perdição e +1 Presença (20%) | uma perícia no lugar da Vontade repetida (LR p. 22); **25%:** o ritual do Saber Ampliado (só 2º círculo, 26 opções) e um ritual de qualquer círculo que já conjura (1º ou 2º, 49 opções) | batem |
| **Cora** (combatente, Aniquilador, NEX 25, Militar) | A Favorita: fuzil de caça (10%), Tiro Certeiro (15%), +1 Vigor (20%) | nada | batem; fuzil de caça com mira laser e calibre grosso é categoria II com A Favorita (cabe no limite do Operador) |

As mochilas de Tepes, Catarina e Alosi estão vazias e com a marca "refazer equipamento": na próxima entrada eles refazem o equipamento no Sede. Os três veem o aviso "você evoluiu" no login (o NEX visto de cada um é 20%).

### Os NPCs com ficha (só o que o motor acusou; nada foi inventado)

Tudo aqui depende do Felipe: o motor mostra o erro, mas qual escolha tirar ou pôr é decisão dele (são NPCs montados a partir de fichas do C.R.I.S, do site ou de PDF).

| NPC | O que falta (pendência) | O que está fora do livro |
|---|---|---|
| **Miguel** (especialista, Técnico, 50) | 10 perícias da criação (7 + Int 3); as 2 do Perito; grau do 35% (8 perícias); Expansão de Conhecimento (qual poder); +1 atributo do 50%; Especialista Diletante (qual poder) | mochila com 4 itens de categoria I; o limite do Agente especial é 3 |
| **Agatha** (ocultista, Graduado, 80) | 33: quase tudo (perícias, rituais, poderes, grau, afinidade, versatilidade e os 3+1+1 do Grimório). Só o +1 Presença do 20% está feito | 0 PP: ficha de Recruta (limite de 2 itens de categoria I e nenhum de II) |
| **Ivete** (combatente, Aniquilador, 10) | nada | nada |
| **Marcela** (especialista, 5) | nada | nada |
| **Nico** (ocultista, Lâmina Paranormal, 65) | 1 ritual do NEX 20%; grau do 35% (faltam 3 das 6) | **11 perícias livres no NEX 5%; o livro dá 7** (3 + Int 3 + a Vontade repetida) |
| **Veríssimo** (combatente, Aniquilador, 70) | o elemento da afinidade (50%) | nada |
| **Ômega-99** (ocultista, Graduado, 99) | Grimório (3 + 1 + 1 rituais); poder do 90% | **17 perícias livres no NEX 5%; o livro dá 7**; grau do 35% com 9 perícias (são 3 + Int = 6); mochila com 5 itens de categoria I e 6 de II (limite 3 e 3), sobrecarregada (19 de 15) e com Proteção pesada sem proficiência |
| **???** (combatente, Guerreiro, 65) | afinidade (50%); a arma de A Favorita (versatilidade); poder do 60% | grau do 35% com 4 perícias (são 1 + Int = 2); mochila com 4 itens de categoria I |
| **Rosa** (especialista, Atirador de Elite, 50) | poder do 15%; afinidade e versatilidade (50%) | nada |
| **Pedro** (combatente, Comandante de Campo, 40) | nada | nada |

### Dúvidas novas para o mestre

| | Dúvida | Sugestão |
|---|---|---|
| D11 | Tepes, alteração do Monstruoso de 25%: qual das três perícias (Diplomacia, Enganação ou Intimidação) leva o −5? | Escolha dele e do jogador; a janela já está na aba Evolução |
| D12 | NPCs com mais perícias ou mais itens do que o livro permite (Nico, Ômega, ???, Miguel): tirar, ou deixar como exceção do enredo? | Para NPC de enredo, deixar e marcar os itens achados como "achado" (não ocupam a vaga da patente, LR p. 53); para as perícias, dizer quais saem |
| D13 | Agatha com 0 PP (Recruta) no NEX 80%: qual a patente dela? | A de uma agente de elite (200 PP), como Ômega e Veríssimo |
