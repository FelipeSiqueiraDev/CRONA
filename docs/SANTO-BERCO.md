# Santo Berço (o lugar novo, pedido do Felipe em 09/10)

Resumo com palavras próprias da página da wiki (ordemparanormal.fandom.com/wiki/Santo_Berço), para montar o lugar. Nada
copiado: só os fatos, os nomes e o que serve para o visual.

## O que é

- Uma vila anacrônica, isolada, que nasce em volta da Relíquia de Morte: o lugar drena o tempo e a energia dos vivos e
  vira uma vila com cara **medieval** (sem eletricidade, sem armas de fogo, sem internet). Fadada a se destruir e renascer.
- No **centro**, o **Labirinto Infinito**: circular, de plantas vivas que fazem os caminhos, coberto de neblina; em volta,
  as **estátuas dos Cinco Guardiões**. Só entra de verdade quem tem o **Símbolo Espiral** marcado no corpo. Dentro dele,
  a **Caverna**: escura, fria, **Lodo Preto** escorrendo, celas brancas dos Mananciais e, no fundo, o Parasita de Dimensões.
- O **Lodo Preto** de lá é hipnótico, atrai, e solta tentáculos se ameaçado.
- Vegetação de cores estranhas (roxo, amarelo, azulado) e **árvores retorcidas**; animais de anatomia esquisita.
- **A "Noite"**: quando a vila se sente ameaçada, uma onda de névoa sai do Labirinto e vêm criaturas (quase todas de Morte).
- O tempo corre muito mais rápido lá dentro (1 dia de fora = 1 ano lá).

## Os moradores

- **Luzidios**: menos de cem, roupas medievais, marcas físicas de Morte; vivem numa hipnose confortável. Cada um se chama
  pelo cargo: o Ferreiro (o líder), o Porteiro, o Doutor, o Taverneiro, o Hoteleiro, a Fazendeira, o Minerador, o
  Peregrino, o Coletor, o Guarda, a Artista, o Tecelão... Os filhos são "o Filho do Hoteleiro"; os trazidos de fora,
  "o Ajudante do Porteiro". Nada se paga (tudo é de graça).
- **Ignaros**: os de fora. Viram Luzidios na **Provação** (tocar o Cristal Preto).

## Os lugares (a vista de cima da wiki: a vila em anel em volta do Labirinto, estradas de terra em anel e em raios)

| Lugar | Onde | Como é |
|---|---|---|
| Portão de entrada | leste | arco de madeira no fim da estrada |
| Torre do Porteiro | entrada, à direita | torre redonda tipo farol, escada em espiral, 2º andar |
| Ferraria | noroeste | forja medieval (espadas, arcos, machados, escudos, armaduras); no quarto do Ferreiro, uma escotilha pesada que só abre por baixo (dá no bunker) |
| Taverna | nordeste | bar medieval, comida da vila ("Manteiga na Manteiga") |
| Hotel | leste | dois andares; no hall, 4 quadros dos Hoteleiros; coisas estranhas à noite (criaturas no corredor, música do nada) |
| Fazenda | norte | grande, com dois celeiros; os bichos escondidos toda noite |
| Casa do Doutor | sudoeste | casarão, consultório no térreo junto da sala |
| Bosque da Provação | sul | o tronco cortado de cada morador; os mortos enterrados cada um embaixo da sua árvore |
| Minas | oeste, numa caverna/montanha | seções por cor de cristal; bichos (Toupeiras de Lodo, Morcegosas, Labras, Succs); no fim, a porta do bunker dos Guardiões e a área dos Cristais Pretos |
| Labirinto Infinito | centro | ver acima |
| Caverna | dentro do Labirinto | ver acima |

## Os cristais (luz e cor da vila)

- **Verde**: cura (fecha ferida na hora); na boca, anestesia. Brilha menos conforme gasta.
- **Vermelho**: calor e luz (os grandes, quentes como lava). É a "lâmpada" da vila.
- **Azul**: frio extremo; a "geladeira" da vila.
- **Preto**: a hipnose (a Provação). Fica só nas minas.

## Como vamos montar (cada cômodo uma cena, como na Sede)

- **Vila** (ao ar livre): o anel em volta do Labirinto, as estradas, as casinhas de telhado vermelho, as árvores
  coloridas e retorcidas, poças de lodo preto, postes de cristal vermelho, as estátuas, o portão e a torre.
- **Por dentro**: Torre do Porteiro, Ferraria (+ quarto do Ferreiro com a escotilha), Taverna, Hotel (hall dos quadros e
  um corredor de quartos), Casa do Doutor, Fazenda (celeiros), Bosque da Provação, Minas (seções de cristal), Bunker,
  Labirinto Infinito (as sebes com névoa, a espiral), Caverna (lodo, celas brancas, o Parasita).
- Arte: pedir ao Códex (seção nova do pedido): as casas medievais, a torre, a ferraria, a taverna, o hotel, os cristais
  (4 cores, em pedra e "lampião"), o lodo, as árvores, as estátuas, o portão, a sebe do labirinto, a ilha do mapa e as
  duas chegadas. Até lá, desenho em código.

## Como montar no código (levantamento de 14/10, seguindo o Orfanato)

1. `server/src/seedSantoBerco.ts` no molde do `seedOrfanato.ts`: prefixo `SANTO_BERCO = "Santo Berço · "`,
   `SANTO_BERCO_REV`, a lista `CENAS: CenaSpec[]` (de `seedFazenda.ts`: `key`, `name`, `layout`, `andar`, `style`,
   luz, `floor`, `wall`, `links`, `plan`), `ligar`, `seed`, `rebuild` e `montarSantoBerco`. A **Vila ao ar livre vem
   primeiro** (vira a chave da campanha e a entrada): `aberto: true`, `terreno` feito com `new Terreno(w, h)`.
2. Portas: `portal` (ou `passagem_aberta`) dos DOIS lados, ligados por `links` (o teste confere a volta). Andares:
   `stairs_up` ↔ `escada_desce` com `andar` diferente. Escotilha do Ferreiro: `alcapao` + `escada_vertical`.
3. Prédios na Vila: uma peça grande não pisável (≥ 20 casas) com uma `entrada` encostada na porta, ligada ao interior;
   o servidor monta os marcos do minimapa sozinho.
4. `db.ts`: `santoBercoRev`. `seed.ts`: chamar `montarSantoBerco` nos dois caminhos do `upgradeDb` e pôr o prefixo
   no `limparSalasDeExemplo` (e no `limpeza.test.ts`). `shared/src/lugares.ts`: posição e ícone pelo nome (hoje não há
   ícone de vila: cai em `casa`).
5. Teste `server/test/santoBerco.test.ts` como o do Orfanato (cenas, título da campanha, portas de ida e volta, todas
   alcançáveis da entrada).
6. Peças que NÃO existem no catálogo (`shared/src/furni.ts`) e precisam ser criadas: cristais (4 cores), lodo preto,
   sebe do labirinto, estátuas dos Guardiões, forja e bigorna, poço, pedras, árvores retorcidas coloridas e os prédios
   da vila. Desde 14/10 o tabuleiro é desenhado por código ([`GUIA-MAPAS-PIXEL.md`](GUIA-MAPAS-PIXEL.md)).
