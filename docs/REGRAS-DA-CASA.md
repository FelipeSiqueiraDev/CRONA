# Regras da casa — Segredos do Outro Lado

O Felipe passou as regras da mesa num PDF (`Regras_da_Casa_Segredos_do_Outro_Lado.pdf`, guardado fora do git) em 06/11. Esta é a lista e o que cada regra faz no CRONA. As do livro continuam valendo onde a casa não muda nada.

## 01 · Prisão com corrente

- **A regra:** dá para Agarrar com a corrente e prender o alvo longe do corpo.
  - Agarrar: ação padrão e Luta contra Luta.
  - Desde o turno seguinte, no começo de cada turno de quem prende, Atletismo DT 10, +5 a cada manutenção seguida, sem gastar ação. Falhou, o alvo se liberta.
  - As duas mãos ficam na corrente.
  - Arrastar o alvo: metade do deslocamento e −5 no teste, declarado antes.
  - O alvo escapa na vez dele: ação padrão, vencendo Luta contra Luta.
  - Agarrado não é indefeso: não abre Golpe de Misericórdia.
  - A corrente não dá dano sozinha e não soma o bônus que ela dá em Derrubar e Desarmar.
- **No jogo:**
  - O Agarrar feito com uma arma chamada "Corrente" já é a prisão (`corrente` na manobra).
  - O Atletismo vira uma pendência no começo do turno (`correntes` no combate). O cartão tem a caixa "Arrastando (−5)" e os botões Manteve e Falhou.
  - Falhou: o alvo sai do agarrado.
  - O código está em `shared/src/combate/turnos.ts` e no `cartaoCorrente` de `client/src/ui/combate.ts`.

## 02 · Golpe de passagem

- **A regra:** ataque corpo a corpo no meio do movimento.
  - Gasta a ação padrão e a de movimento.
  - Anda só metade do deslocamento.
  - −1d20 e −5 no ataque; depois do golpe, anda o que sobrar.
  - Não tem os benefícios da Investida, não dá ataque a mais e não atravessa inimigos.
- **No jogo:**
  - É o botão "Golpe de passagem" no ataque corpo a corpo; antes, desde 20/10, só tirava −1d20.
  - O servidor marca também a ação de movimento e recusa o golpe se ela já foi usada.
  - A metade do deslocamento fica com o mestre, que move a peça.

## 03 · Olho do predador

- **A regra:** passar rodadas inteiras mirando num alvo.
  - Uma rodada: +5 no próximo disparo.
  - Duas: +5, +1d6 de dano balístico e a escolha da região do corpo.
  - A região é só narrativa: não dá condição nem mutilação.
  - Os bônus não somam (duas rodadas não dão +10).
  - Vale só para o primeiro disparo.
  - Perder o alvo de vista, mover-se ou fazer outra coisa encerra a mira.
- **No jogo:**
  - "Olho do predador" está nas ações, como ação completa com alvo.
  - A peça guarda a mira (`mira`: alvo e rodadas).
  - No disparo contra esse alvo, a situação entra sozinha, e o +1d6 vai no dano.
  - Mover-se ou declarar outra ação apaga a mira, e o disparo também.

## 04 · Disparo não letal

- **A regra:** declarado antes do disparo, −5 no ataque e o dano normal da arma.
  - O não letal não é garantido: pode sair letal.
- **No jogo:**
  - É a situação "Disparo não letal", só à distância, marcada à mão.
  - O dano entra como não letal.
  - O botão "Saiu letal" faz o dano contar como letal.

## 05 · Faro animal

- **A regra:** o Marcado treinado em Adestramento tem um animal que procura pistas pelo faro.
  - 1d12, uma tentativa por área investigada; o resultado é o mestre quem lê.
  - Não dá bônus em perícia.
  - Não acha o paranormal sozinho.
- **No jogo:** nada automático; o mestre rola o d12.
- **A Camarilla não participa de combates** (decisão de 06/11): não entra ao abrir o combate, nem pela montagem, nem por "Pôr no combate".

## Outras decisões da mesa ligadas ao combate (06/11)

- **A munição conta em todo disparo.** É a contagem de munição concreta do livro (regra opcional, LR p. 174):
  - pacote com 20 ataques (o foguete, 1);
  - cada arma de fogo tem um carregador: pistola 12, revólver 6, fuzil de caça 4, submetralhadora 20, espingarda 6, fuzil de assalto 30, fuzil de precisão 1, metralhadora 50. O revólver compacto (6), a pistola pesada (12) e a espingarda de cano duplo (2) não estão na lista do livro: ficam como o revólver, a pistola e os dois canos;
  - recarregar é ação de movimento e tira dos pacotes da mochila;
  - a rajada gasta 10 balas e dá +2 dados de dano;
  - a arma nova vem cheia;
  - arco, besta, lança-chamas e bazuca tiram direto do pacote;
  - sem bala, o servidor recusa o disparo;
  - as contas ficam em `shared/src/regras/municao.ts`.
- **Quebrar quebra de verdade:**
  - a manobra Quebrar acerta o item na mão do alvo, e o dano fica no item (`danoSofrido`);
  - chegando aos PV do objeto, o item fica quebrado: a arma não ataca, a proteção não protege e o equipamento não ajuda;
  - o nome dele ganha "(quebrado)";
  - na janela do item da ficha, Consertar tira a marca (a Manutenção do interlúdio).
- **A ficha do Porco:**
  - caseira, no tamanho da da Ovelha (VD 60, Criatura de Sangue), em `server/src/acougueiros.ts`;
  - entra no bestiário se o Porco ainda estiver com a ficha em branco de 21/10.
