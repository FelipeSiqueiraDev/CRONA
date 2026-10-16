# Movimento dos bonecos: o que faz o passo parecer vivo

Notas de estudo (16/10) dos tutoriais do Slynyrd (slynyrd.com/blog: Pixelblog 50 "Human Walk Cycle", 55 "Top Down
Character Animation", 56 "Top Down Character Attack Animation"). É o que cobrar de qualquer animação do tabuleiro,
venha do PixelLab, do SpriteForge ou de código. As imagens de referência (arte dele, só para estudo) ficam fora do
git, em `F:\Dhellow\CRONA\arte\PERSONAGENS-ANIMACAO\referencias\movimento\`.

## Andar (walk)

- **As 4 poses de cada passo**, e o outro passo repete espelhado:
  1. **Contato:** o calcanhar da frente toca o chão; braços e pernas no máximo da abertura; o corpo no ponto mais baixo.
  2. **Descida:** o pé da frente assenta, o peso vem para o meio, o pé de trás sai do chão.
  3. **Passagem:** as pernas se cruzam embaixo do corpo; o corpo no ponto mais alto.
  4. **Balanço:** a perna que vai à frente se estica, ainda no ar.
- **Quadros:** 8 é o fluido; 6 é o meio-termo (o nosso padrão); 4 fica só nas poses-chave.
- **Um pé sempre no chão** (na corrida há um instante com os dois no ar).
- **O sobe e desce da cabeça** forma um triângulo, não uma senoide: desce devagar e sobe rápido. Na caminhada, 1 px.
- **Braço oposto à perna**, com o mesmo impulso: a abertura do braço acompanha a da passada. O ombro é o pivô e
  o alcance máximo tem que ser o mesmo nos dois lados.
- **Roupa:** as dobras poucas, presas sempre nos mesmos pontos de tensão; roupa assimétrica (o casaco aberto, a
  fenda) não se espelha: cada lado tem o seu.

## Corrida (run), na vista de cima

- 6 quadros; a cabeça desce 1 px, desce mais 1 px e sobe 2 px por passada (a subida é mais rápida que a descida).
- Ordem de desenho: frente, costas (traduzida da frente), lado, e por último as diagonais.
- O boneco simétrico desenha 5 direções e espelha as outras 3; o personagem com cabelo ou equipamento de um lado
  só precisa das 8.

## Golpe (ataque com arma)

Cinco fases, um quadro cada (ou mais nas que seguram): **antecipação** (puxa para trás), **smear** (o rastro do golpe,
a arma "esticada" no quadro mais rápido), **rebote** (o martelo que bate e volta), **follow-through** (o corpo segue o
golpe) e **recuperação** (volta à pose). O tempo é irregular: os extremos ficam mais tempo na tela que os
intermediários.

## Onde os nossos estão (16/10)

- **Alosi:** o andar foi montado das peças da pose parada (`scripts/boneco.py`); o pé só desliza, os braços não
  balançam, o corpo não sobe e desce.
- **Tepes (PixelLab, `walking`):** passos curtos, sem braço; de frente vinha só meio passo (completado por
  `ciclo.py`, espelhando da cintura para baixo).
- Os dois precisam das poses refeitas com as 4 poses do passo, o braço oposto e o sobe e desce de 1 px.
