# Fichas do C.R.I.S no CRONA: o que entrou e no que difere

Feito em 18/10/2026. A fonte é o banco do C.R.I.S, só lido (`docs/fichas-cris/fichas-do-cris.json`). O código está em `server/src/seedFichasCris.ts` (dados já convertidos para o modelo de ficha do CRONA, só escolhas) e roda na subida do servidor, por `upgradeDb`: só **cria** o que falta, nunca sobrescreve uma ficha que já existe para o NPC, e o que o mestre apagar depois não volta. Os testes estão em `server/test/fichasCris.test.ts`.

Como ler a tabela: o que o C.R.I.S guarda é número pronto; o CRONA guarda as escolhas e calcula. "C.R.I.S / CRONA" são os máximos, lado a lado.

## Tabela

| Ficha do C.R.I.S | Personagem no CRONA | Situação | PV | PE | SAN | Defesa |
|---|---|---|---|---|---|---|
| D. Tepes | D.Tepes (ficha 1) | já existia, nada mudou | 48 / 44 | 12 / 12 | 21 / 21 | 20 / 20 |
| Catarina Albuquerque | Catarina Albuquerque (ficha 2) | já existia, nada mudou | 29 / 29 | 20 / 20 | 28 / 28 | 19 / 19 |
| Alosi Walker | Alosi Walker (ficha 3) | já existia, nada mudou | 22 / 22 | 32 / 32 | 35 / 35 | 11 / 6 |
| Cora Falcão | Cora Falcão (ficha 4) | já existia, nada mudou | 36 / 40 | 16 / 16 | 21 / 21 | 13 / 8 |
| Miguel Albuquerque | NPC `miguel-albuquerque` | **ligada** (personagem do tabuleiro) | 53 / 53 | 60 / 60 | 44 / 44 | 19 / 19 |
| Agatha Volkomenn | NPC `agata` | **ligada** | 74 / 74 | 112 / 112 | 111 / 111 | 11 / 11 |
| Ivete Beicur | NPC `ivete` | **ligada** (modelo em branco) | 53 / 53 | 40 / 40 | 52 / 52 | 11 / 11 |
| Marcela Geleerd | NPC novo `marcela-geleerd` | **nova, sem peça** (falta o personagem) | 53 / 53 | 40 / 40 | 52 / 52 | 11 / 11 |
| Nico Delagnore | NPC novo `nico-delagnore` | **nova, sem peça** | 62 / 62 | 117 / 117 | 63 / 68 | 12 / 12 |
| Sr. Veríssimo | NPC novo `sr-verissimo` ("Veríssimo") | **nova, sem peça** | 100 / 128 | 56 / 56 | 51 / 51 | 24 / 22 |
| Ômega-99 | NPC novo `omega-99` (grupo Lotus Branca) | **nova, sem peça** | 110 / 110 | 140 / 140 | 115 / 115 | 30 / 25 |
| ??? | NPC novo `interrogacao` (grupo Lotus Branca) | **nova, sem peça** | 107 / 107 | 52 / 52 | 48 / 48 | 14 / 12 |

Os 4 Marcados não foram tocados (as fichas deles já tinham sido conferidas escolha por escolha: `docs/AUDITORIA-REGRAS.md`). As diferenças abaixo são as que a conferência de hoje achou; nenhuma é "claramente defasada" a ponto de eu mexer sozinho (a que mais se aproxima, o aumento de atributo do Tepes, está nas dúvidas D2 da auditoria, à espera do jogador).

## Os 4 Marcados (já no CRONA): diferenças

- **D.Tepes:** PV 44 (C.R.I.S 48). Falta o aumento de atributo do NEX 20% na ficha (pendência já conhecida, dúvida D2); o 48 do C.R.I.S é o de Vigor 4, então provavelmente foi o Vigor. Atributos, perícias, poderes e Defesa batem. O C.R.I.S chama o poder de "Mutação Inicial" (no CRONA, Ser Amaldiçoado, Sangue) e tem a perícia "Faro", que não existe no livro. O estado de jogo é outro (CRONA PV 22, PE 3, SAN 12; C.R.I.S PV 34, PE 12, SAN 6): é o jogo, não toquei.
- **Catarina:** PV, PE, SAN, Defesa, atributos, perícias e poderes batem. O C.R.I.S tem 2 granadas (fumaça e fragmentação) e o Pé de Mesa, que a ficha do CRONA não tem (o CRONA tem o Diário Rasgado, achado em jogo): inventário, deixei como está. Faltam as 2 perícias do Perito (também no CRONA, pendência da auditoria). Deslocamento 9 m no CRONA, 6 m no C.R.I.S.
- **Alosi:** PV, PE, SAN, atributos, perícias, poderes e os 7 rituais batem. A Defesa 6 e o deslocamento 6 m do CRONA são de sobrecarga (8 de 7 espaços, com o Caderno de Anotações e a Lanterna achados em jogo); no C.R.I.S, Defesa 11 e 9 m. Falta uma perícia (Vontade veio da classe e da origem) e o Crânio Espiral é item amaldiçoado de operadora (dúvida D6): ambos já na auditoria.
- **Cora:** PV 40 no CRONA, 36 no C.R.I.S. A conta do livro com Vigor 2 dá 40; o 36 do C.R.I.S é de Vigor 1 (ficou sem recalcular depois do aumento do NEX 20%). Defesa 8 no CRONA contra 13: está sobrecarregada (17,5 de 10 espaços, com a Espingarda, a Munição e a Corda achadas em jogo). O resto bate.

## Os que entraram agora: o que difere do C.R.I.S

- **Nico Delagnore:** SAN 68 (C.R.I.S 63). O C.R.I.S tem 6 Transcender (Potencial Aprimorado 2x, Surto Temporal, Visão do Oculto, Escapar da Morte e Expansão de Conhecimento, esta com Ninja Urbano) e até NEX 65% o livro dá 5 escolhas; ficaram de fora a Expansão e o Ninja Urbano. Ocultismo é expert no C.R.I.S, mas expert só vem a partir de NEX 70%: aqui é veterano. Faltam 1 ritual (NEX 20%) e 3 aumentos de grau (NEX 35%).
- **Sr. Veríssimo:** PV 128 (C.R.I.S 100): o 100 do C.R.I.S não soma Calejado nem Casca Grossa (14 + 14). Defesa 22 (24): o C.R.I.S soma o +2 do Tanque de Guerra, que no CRONA é bônus condicional (vestindo a armadura pesada). "Oficial Comandante" (NEX 99%) estava na lista do C.R.I.S, mas ele tem 70%: não entrou. Falta a afinidade do NEX 50%.
- **Ômega-99:** DT dos rituais 38 (C.R.I.S 33, sem o +5 de Rituais Eficientes). Defesa 25 e 6 m (C.R.I.S 30 e 9 m): pelas contas do livro ele está sobrecarregado (19 de 15 espaços). Aprende também Conhecendo o Medo (Graduado, NEX 99%), que a lista do C.R.I.S não tinha. Faltam como pendência os 5 rituais do Grimório Ritualístico e o poder de NEX 90%.
- **???:** Defesa 12 (C.R.I.S 14): o bônus de Reflexos Defensivos é condicional. Fortitude e Reflexos são expert no C.R.I.S, mas ele tem NEX 65%: ficaram veteranos. Faltam a arma do A Favorita (o C.R.I.S deixou em branco), a afinidade do NEX 50% e o poder de NEX 60%.
- **Miguel Albuquerque:** os números batem. O C.R.I.S estava incompleto: só Luta e Reflexos treinadas, sem o Perito, sem o aumento de atributo do NEX 50% e sem o poder escolhido na Expansão de Conhecimento e no Especialista Diletante (o C.R.I.S registra Ataque Especial e Escolhido pelo Outro Lado, que são habilidades de classe). Os 3 rituais dele (Amaldiçoar Arma, Perturbação, Terceiro Olho) ficaram só nas anotações da ficha.
- **Agatha Volkomenn:** ficha parcial no C.R.I.S (só atributos, origem, classe, trilha e NEX 80%). PV, PE, SAN e Defesa batem; todo o resto ficou como pendência do mestre (33). DT dos rituais 34 contra 29 (sem Rituais Eficientes).
- **Ivete Beicur e Marcela Geleerd:** modelos em branco no C.R.I.S (NEX 50%, Especialista, sem origem, trilha, atributos distribuídos, perícias ou inventário). A ficha tem só isso, e 13 pendências cada. A Marcela é a médica da Enfermaria da Sede e ainda não tem personagem no tabuleiro (falta arte e referência).

## O que é aproximado

- A **ordem** dos aumentos de atributo, dos poderes e dos rituais é inferida (o C.R.I.S só guarda o resultado). Os números finais conferem.
- Os C.R.I.S de **Nico, Veríssimo, Ômega-99 e ???** têm mais perícias treinadas (e mais graus) do que o livro permite: a ficha do CRONA guarda todas, e a janela de revisão mostra o aviso ("São 3 perícias à escolha (8 marcadas)"). É o C.R.I.S, não a conversão.
- Itens sem equivalente no catálogo: a Soqueira Ritualística do Miguel (maldição só vale em arma: ficou no apelido), o Bracelete e o Anel amaldiçoados do Ômega (base "Chaves", com a maldição Defesa e Pujança), o Dedo Decepado dele ("elemento varia": entrou o de Morte), o Grimório e o Kit de Perícia (Ocultismo), que são itens livres, e o "kit completo" de componentes ritualísticos, que virou um item só.
- Os retratos do C.R.I.S ficaram em `docs/fichas-cris/avatares/` (fora do git) e **não** foram para o CRONA: o personagem do tabuleiro é a arte do Elenco.

## Como o mestre vê

FICHAS → sub-aba **NPCs**: os 8 aparecem com NEX, classe e o número de pendências; abrir mostra a ficha completa, com as anotações do que veio do C.R.I.S na aba Anotações. Miguel, Agatha e Ivete estão ligadas ao personagem do tabuleiro (a peça pega PV, PE e SAN da ficha); os 5 novos entram no Elenco sem arte, sem peça.
