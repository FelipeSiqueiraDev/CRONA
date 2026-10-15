# Atualização de 15/10: as três cidades, personagens em pixel animado, o acabamento e o Códex pelo terminal

Continuação do [ATUALIZACAO-14-10.md](ATUALIZACAO-14-10.md) (branch `claude/tabuleiro-pixel`). O que ficou pronto de madrugada,
onde cada coisa mora e o que ainda falta.

## 1. Os lugares novos (todos em pixel por código)

| Lugar | Cenas | Seed | Peças | Arte |
|---|---|---|---|---|
| Igarapé (rio, ponte, palafitas, capela, venda, 7 casas) | 12 | `server/src/seedIgarape.ts` (`IGARAPE_REV`) | `pecas_px/igarape.py` | `exportar_px.py --grupo igarape` |
| Tiradentes (largo com chafariz e coreto, Igreja Matriz, pousada, venda, boteco, 9 casas) | 17 | `seedTiradentes.ts` | `pecas_px/tiradentes.py` | `--grupo tiradentes` e `exportar_parede_px.py --grupo tiradentes` |
| Santo Berço, o resto (hotel, casa do Doutor, fazenda, bosque, minas, bunker, labirinto, caverna) | 21 novas | `seedSantoBerco.ts` | `santo_berco_dentro/fora/minas.py` | `--grupo santo_berco_*` |

- A regra da porta ("de dentro do mesmo lado da de fora") está testada para todos os prédios; em 6 cenas de Santo Berço a
  porta de dentro trocou de parede para casar com a fachada (o prédio virado para o fundo tem a porta no fundo).
- Cada um tem teste de ida e volta das portas e de alcance a pé (`server/test/igarape.test.ts`, `tiradentes.test.ts`,
  `santoBerco.test.ts`). `npm test` em `server/`: 334 de 334.
- **Falta:** as artes de chegada da viagem (Igarapé, Santo Berço, Sede refeita) e os joguinhos do bar estão no pedido do
  Códex (seções 2 e 3 do `PEDIDO-UNICO-CODEX.txt`).
- **Para conferir no jogo:** a `boca_tunel` é peça nova e talvez precise do `caixa`/`encosta` de `portal` à mão no
  `moveis.json`; o Labirinto sempre devolve à mesma entrada da vila (o servidor escolhe a primeira passagem de volta);
  o piso das minas usa `calabouco` (um estilo de rocha próprio mexeria em `room.ts`).

## 2. Cenas mais densas (a "coisa" das referências)

O Códex analisou as duas cenas de referência do Felipe (`docs/estilo/analise-beleza-codex.txt`, meta visual em
`alvo-taverna-codex.png`). A conclusão: **volume com peso**, ou seja, laje grossa, sombra de contato, luz que revela o
volume, densidade em três escalas e desgaste com causa. O que entrou:

- `client/src/render/acabamentoSala.ts`: chão gasto (sujeira em manchas, lascas, rachaduras, pedrinhas e papéis), sombra
  de encontro parede/chão e parede/teto, parede com umidade escorrendo, mofo e pó, e a laje do piso em blocos de pedra.
  Chamado no fim de `buildStatic` (`roomStatic.ts`); `FLOOR_THICK` foi de 0,35 para 0,55 (também em `shared/src/session.ts`).
- `lighting.ts`: a luz baixa (lareira, fogueira, vela) cai no chão como elipse, o núcleo é mais quente, e o escuro puxa
  para o azul-violeta (sombra fria contra luz quente).
- Orfanato: três estilos de textura queimada (`queimado_madeira`, `queimado_xadrez`, `queimado_concreto`).
- Fogo e vida (`particles.ts`): chama em pixel (grade de calor), feixe da janela, poeira e brasas em todas as cenas.
  Fogueira, lareira e forja saem sem a chama desenhada (`CHAMA_ASSADA = False` em `ocultismo.py`).
- Fazenda (`FAZENDA_REV` 37) e Sede (`SEDE_REV` 53) ganharam conjuntos médios e objetinhos em cima de mesas e balcões, só com
  peças do catálogo (nada de puzzle mexido).
- **Visão tática limpa (sem Códex):** `pisoTatico.ts` desenha o piso por estilo e `mapaTatico.ts` desenha o móvel visto de
  cima (cama, baú, barril, caixote, armário, fogão, fogueira, pia).

## 3. Personagens em pixel art animada (o Códex pinta, o script monta)

Alosi, Catarina e Cora Falcão estão prontas nas 8 direções (andar de 6 quadros, parado respirando). Como funciona:
O método, em resumo:

1. O Códex pinta cada direção em 64x64 a partir das poses de `tabuleiro-32bits/idle-desarmado-<dir>.png` e do guia de
   movimento (`docs/estilo/walk-cycle-alosi.zip`), montando por peças para a cabeça ser idêntica em todos os quadros.
2. `python scripts/dev/personagem_pixel.py <pasta> <id> --escala 1.8` escreve `tabuleiro-3d/anim.json` (formato do boneco do
   tabuleiro, o mesmo do 3D antigo) e as tiras. O jogo já lê.
3. **Faltam** Tepes e os dois Existidos (o Códex bateu o limite de uso; a retomada está agendada para depois das 3h).

## 4. O Códex pelo terminal

`node scripts/dev/codex.mjs [--pasta dir] [--imagem png] [--saida arq] [--ler] <pedido.txt>` acha o `codex.exe` do app e
roda o pedido (`codex exec`, a ferramenta de imagem vem junto). O Felipe manda os pedidos para o Claude e o Claude aciona
o Códex. Limite de uso: vários pedidos em paralelo estouram a cota; no limite, ele avisa a hora da volta.

## 5. Ícones das modificações das armas

Os 16 `client/public/arte/icones/mod-<id>.png` (Certeira, Cruel, ..., Carregador rápido) já estão no jogo; a tela do
jogador os usa no lugar da engrenagem.
