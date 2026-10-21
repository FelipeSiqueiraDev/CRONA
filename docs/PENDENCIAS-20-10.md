# Pendências do CRONA (20/10/2026, noite; atualizada em 21/10)

**Feito em 21/10:** Mansão Albuquerque montada (49 cenas, `docs/MANSAO-ALBUQUERQUE.md`); Max no estilo novo em todos os estados; armado de Catarina, Cora, Alosi, Miguel e Pedro corrigido (Pedro oeste e a bota da Catarina por código, olhar no tabuleiro); erros claros e detalhes dos cenários (`server/src/retoquesCasas.ts`, sem Santo Berço nos detalhes); a tela de partida usa a arte de saída do lugar (`saida-<lugar>`, hoje só a da Mansão). Abaixo, o que continua em aberto.

Estado: o jogo de verdade (8080) está na versão do último commit (`0319b516`, subiu às 16:38 de hoje); a árvore está limpa na branch `claude/tatica-codigo`; nada foi para o GitHub (sem push, sem PR). O Códex está logado na conta `dhellinhocreycrey` (Plus).

## 1. Arte (Códex)
- **Armado no estilo novo, ainda reprovado** (o jogo usa o antigo nesses cinco; Tepes, Joaquin e Rosa já têm o novo):
  - Catarina: botas de cadarço dourado em X em 5 direções (o em pé tem fivelas); cabelo e botas mais vivos. Voltar ao Códex.
  - Cora: botas mais claras, pele apagada (acerto por código, paleta do em pé).
  - Alosi: aro dos óculos cobre em vez de marrom; cabelo e botas mais avermelhados (por código).
  - Miguel: cabelo saturado, botas claras com cadarço dourado, emblema do ombro azul-ciano (por código).
  - Pedro: direção oeste, a pistola sai do quadril e o punho não a segura. Voltar ao Códex.
  - Alosi agachado: haste dourada brilhando, cabelo claro, livro só de lombada em algumas direções.
- **Agachado armado** (Tepes, Catarina, Cora, Alosi, Miguel, Pedro, Joaquin, Rosa): não existe.
- **Camarilla:** sentada (hoje senta pelo agachado) e deitada.
- **Monstros** (Existidos, Diabo, Deus da Morte, Magistrada, Anfitrião e faces): só têm em pé; faltam agachado, sentado, deitado.
- **Chamas por código no Anfitrião e nas faces:** a sessão que ia fazer caiu no limite; não há resultado.
- **Ressalvas aceitas nos deitados/agachados:** cabeça e botas maiores nos deitados (o jogo desenha pela largura; olhar no tabuleiro), óculos do Herman de frente um tom mais laranja, Samuel deitado com o antebraço mais alaranjado. Se não gostar, voltam os antigos (backup em `trabalho\backup-pre-estilo-novo`).
- **Alvos de olho no tabuleiro:** ver no jogo, em tamanho de verdade, em pé / agachado / sentado / deitado / armado.

## 2. Fichas e regras
- **Pendências de escolha (C.R.I.S estava em branco):** Agatha 33, Ivete 13, Marcela 13, Miguel 6 (perícias, Perito, atributo do NEX 50, poder da Expansão de Conhecimento e do Especialista Diletante), Ômega-99 4 (rituais do Grimório, poder do NEX 90), "???" 3, Nico 2. Rosa: poder do NEX 15, versatilidade do 50 e afinidade. Veríssimo: afinidade e a regra da Jaqueta. Catarina: as 2 perícias do Perito.
- **Tepes:** PV 44 no CRONA contra 48 no C.R.I.S (falta o atributo do NEX 20%, parece Vigor; dúvida D2 da auditoria, espera o jogador).
- **Poderes que pedem teste de perícia** (110% e Eclético da Catarina, Perito): gastam PE e escrevem no registro, mas não há tela de teste; o mestre aplica à mão. O Ataque Especial e o Ataque Furtivo já aplicam sozinhos no Atacar.
- **Decisão sua:** o alvo marcado continua marcado entre turnos (deixei como está); a manobra e o ritual agora abrem na escolha.
- **Itens sem equivalente no catálogo:** Soqueira Ritualística (Miguel), Bracelete e Anel do Ômega, Grimório, Kit de Perícia.
- **Marcela:** sem referência de personagem (foto e boneco existem; conferir se é o que você quer).

## 3. Combate (conferir ao vivo)
- O dano massivo, os empates pelo livro, o ataque de passagem, o arremesso e a Evolução dos NPCs foram vistos só na prévia/testes.
- Investida leva a peça até o alvo (testado). Ataque de passagem e "Liberar o ataque" são regra da mesa (LR p. 86 não deixa ação padrão no meio do movimento).
- O cartão do passo pelas sombras no COMBATE e a mesa de verdade não foram vistos ao vivo.
- Falta, se quiser: a peça sair de uma sombra de outra cena.

## 4. Cenas, mesa e telas
- **Música** das cenas: você sobe o mp3 na própria cena (nenhuma tem música ainda).
- **Mostrar imagem** (janela Cenas): testado no caminho do servidor; o seletor de arquivo do celular não foi usado de verdade.
- **Mesa (tablet):** conferir ao vivo o que ela mostra (cenas, imagem solta, falso C.R.I.S não aparece na mesa).
- **Celular do mestre:** a tela vira o desktop espremido em 3 colunas (só dá para olhar). O desktop x celular que você notou não foi redesenhado.
- **Falso C.R.I.S:** conferir se as contas dos jogadores (`importar-cris.mts`) foram aplicadas no jogo de verdade e decidir quando desligar a opção.
- **Mansão Albuquerque:** montada; falta você aprovar o 2º andar, o mezanino como cena à parte e decidir pais, cofre, salas secretas, NPCs e objetivos. Peças fracas: touro, foto aérea, diplomas, cama do casal, adega, camas dos hóspedes e fogão da cozinha; fachada limpa demais.
- **Cela do Geraldo:** a imagem do Códex é pequena (~300 px); pedir uma maior, se der.

## 5. Casa em ordem
- **`docs/EM-ABERTO.md`** (1.600 linhas) está com blocos antigos que dizem "pendente" para coisas já feitas (tabela do armado de 18/10, "Herman pendente"); consolidar e podar.
- **PDF das fichas** e scripts de apoio (`resumo-fichas.mts`, `fichas-pdf.mts`) existem; conferir o PDF antes de entregar a alguém.
- **Backups do banco:** os dumps do dia estão em `server/data/backups`; apagar os de teste quando quiser.
- **Git:** tudo na branch `claude/tatica-codigo`, sem PR. Decidir quando e como levar para a `main`.
