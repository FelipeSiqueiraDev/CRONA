# Estudos do estilo pixel art (só código)

Os estudos de outubro de 2026 para trocar a arte do tabuleiro (a do Códex) por pixel art feita só por código, no
jeito das salas isométricas "cozy". Ainda fora do jogo: é tudo cena de teste. As prévias ficam em `docs/estilo/`.

Usa o motor de `scripts/3d/codigo/motor.py` com `ESC` abaixo de 1 (desenho direto no pixel: 1 pixel da arte = 2 do
tabuleiro com ESC 0,5, ou 1,33 com 0,75). Os materiais devolvem só a cor de base; o acabamento no fim põe a luz de
cada face (topo 1, face +y 0,84, face +x 0,66, com um tom quente), a sombra macia embaixo dos móveis, o contorno de
1 px e o brilho na quina de cima.

| Arquivo | O que é |
|---|---|
| `estilo.py` | 1ª tentativa, descartada: um filtro de pixel art por cima do render liso (não vira pixel art de verdade) |
| `sala.py` | a sala de madeira desenhada no pixel, chapada (`docs/estilo/1-sala-primeira.png`) |
| `sala2.py` | a sala menor, com volume (luz e sombra em cada tábua e pedra) e a lareira em degraus |
| `sala3.py` | a sala com as posições e as proporções medidas na referência (7 x 7 casas, parede de ~3 m) |
| `agente_fogo/` | o fogo pixel a pixel (`fogo_px2.py`: chamas, toras, brasas, a luz em volta, o apagar e a fumaça) |
| `agente_lareira/` | a lareira de pedra (capelo em rampa, arco de aduelas, o vão de verdade) |
| `agente_pecas1/` | sofá, relógio, escrivaninha com o teclado, quadro e porta (`pecas1.py`) |
| `agente_pecas2/` | cadeira, mesa, mesinha, estantes com livros, barril, pote, pinheirinho e vasos (`pecas2.py`) |
| `agente_janela/` | a janela aberta com a cortina no vento, o sol no chão e a poeira (`janela_px.py`) |
| `juntar.py` | junta tudo em `sala4.py` (a sala final): a lareira e o fogo, as peças, a janela, a mesa em nogueira, a chaminé que sai da casa |
| `gif_sala.py`, `gif_paleta.py` | o GIF da sala viva (o fogo aceso, apagando, a fumaça; a cortina) |

Rodar: `python sala4.py saida.png` (a imagem sai ampliada 3x). Variáveis: `FOGO_T` (o instante do loop, 0..1),
`FOGO_FORCA` (1 aceso .. 0 apagado), `FOGO_FUMACA`, `FOGO_FUMACA_T`, `JANELA_T`. O GIF: `python gif_sala.py` e
`python gif_paleta.py`.

A sala de madeira pode virar um cenário padrão (uma casa na cidade). Falta levar o estilo para o jogo (exportador dos
móveis nos 4 giros, chão, parede e as animações): ver `docs/EM-ABERTO.md`.
