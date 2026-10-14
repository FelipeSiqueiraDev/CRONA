# Atualização de 14/10: o tabuleiro todo em pixel por código e Santo Berço

O guia do que mudou no dia 14/10 (branch `claude/tabuleiro-pixel`): as regras novas, as decisões do Felipe e onde
cada coisa mora. Quem for mexer no tabuleiro lê isto junto com o [GUIA-MAPAS-PIXEL.md](GUIA-MAPAS-PIXEL.md) e o
[LEIA-ME das peças](../scripts/3d/estilo/pecas_px/LEIA-ME.md).

## 1. A regra que manda em tudo: o tabuleiro é feito por código

- **Todo o tabuleiro é pixel art 1:1 desenhada por código** (`scripts/3d/estilo/`): móveis, itens de parede, pisos,
  paredes, prédios de fora. Sede, Fazenda, Orfanato e Santo Berço já estão assim.
- **Nada de arte pintada do Códex dentro do tabuleiro.** A chave é `client/src/render/arteCodex.ts`
  (`CODEX_NO_TABULEIRO = false`): o móvel sem pixel art cai no desenho de reserva, o item largado no chão e a vista
  tática não carregam as imagens pintadas, a névoa da mesa usa as nuvens desenhadas, e o teclado de senha não carrega
  mais a chapa amarela.
- **Ficam como estão (decisão do Felipe):** a viagem inteira (a van, o mundo que passa, as telas de partida e de
  chegada), as ilhas e o mapa-múndi, e os bonecos dos personagens.
- **Variantes:** uma peça feita por código só sorteia variante (`~b`, `!vazio`, `@metal`) que também seja pixel. As
  skins tortas do Códex não aparecem mais por sorteio.

## 2. Estados dos móveis (o clique duplo alterna)

| Peça | 0 (o padrão) | 1 | 2 |
|---|---|---|---|
| Porta (`portal`) | aberta, com o vão escuro | fechada | trancada |
| Móvel de abrir (baú, armário, cômoda, criado-mudo, guarda-roupa, aparador, geladeiras de vidro, armarinho, armário de remédio, vestiário, caixa de munição, caixote, armário de cozinha) | **fechado** | aberto | |
| Luz (lâmpada, lampião de cristal, forja, lareira, poste de cristal) | acesa | apagada / coberta | |
| Celeiro | portão da frente aberto | fechado | |
| Escotilha do Ferreiro | aberta | fechada | trancada (como começa) |

- Os móveis de abrir têm também a versão **aberta e vazia** quando têm a gêmea `!vazio` (o que foi saqueado).
- **A geladeira amarela do Bar não abre:** ela só serve para a senha da passagem secreta.

## 3. Portas, entradas e chegada

- **A porta de dentro fica do mesmo lado da de fora** (decidido na Sede em 05/10 e de novo hoje): se a porta do
  prédio olha para a frente da tela, a de dentro fica na parede da frente, a que não aparece (`planBottom`); se olha
  para o fundo, na parede do fundo (`planTop`); de lado, `planRight`.
- **Um clique no desenho de um prédio de fora (a porta inclusive) leva a peça até a Entrada encostada nele**, e ela
  entra. O clique duplo continua escolhendo o prédio.
- **Quem chega de outra cena fica de frente para a tela** (direção 3, o rosto para quem olha): viagem, porta, grupo
  levado pelo mestre. Escada e alçapão continuam como antes.
- **Girar:** se o giro de 90° não cabe, o móvel tenta o seguinte, e assim ao menos inverte o lado (180°).

## 4. A viagem

- Na janela de partida, **as bolinhas dos agentes se arrastam entre os bancos** (soltar em cima de alguém troca os
  dois; um clique escolhe e outro troca).
- **Sem ninguém ao volante, o Partir trava** e o banco do motorista fica marcado em vermelho.
- **O motorista senta à esquerda** (como no Brasil), do lado em que o painel tem o volante; a van de cima foi
  espelhada para o volante subir.

## 5. Painéis da tela do mestre

- **AGENTES (embaixo) mostra sempre todos os agentes do jogo**, em qualquer lugar, com o lugar onde estão; clicar
  em quem está longe leva a cena até ele. **PLAYERS (à direita) continua só com os do lugar aberto.**
- O aviso "Clique num personagem para comandá-lo" saiu (repetia a cada clique no chão).
- Minimapa: o título mostra o nome inteiro do lugar, com um ícone só. As casinhas comuns não têm rótulo.

## 6. Passagem secreta e o teclado

- **A senha só abre no CONFIRMAR** (ou Enter): com as casas cheias o teclado espera, não confere sozinho.
- O teclado foi redesenhado em pixel por CSS (`client/src/ui/teclado.css`), no estilo da referência: corpo
  cinza-lilás, teclas brancas de numeral preto que afundam, visor escuro, LEDs quadrados.

## 7. Santo Berço (o lugar novo)

Fonte: [SANTO-BERCO.md](SANTO-BERCO.md). Código: `server/src/seedSantoBerco.ts` (`SANTO_BERCO_REV`; subiu, o lugar
é refeito), teste em `server/test/santoBerco.test.ts`.

- **A vila** em anel em volta do Labirinto Infinito, espalhada (`K = 1,45`: o Felipe achou espremida), com as
  estradas em anel e em raios, o portão a leste, postes de cristal, lodo preto e árvores roxas, amarelas e azuladas.
- **O labirinto** tem **quatro entradas, no meio de cada lado** (marcadas pelo Felipe no print), cada uma com uma
  **estátua de Guardião de costas para o labirinto**. Por dentro: duas paredes cortam o corredor e a sebe de dentro
  abre só em dois lados, então de cada entrada se dá a volta até o miolo.
- **A Neblina Densa** (peça nova, `neblina_densa`): desenhada casa a casa e ordenada junto com os móveis, enche os
  corredores **por dentro da sebe**, sem vazar, e é bem densa no miolo. O tamanho da peça é o raio do banco; serve em
  qualquer lugar.
- **Interiores:** Torre do Porteiro (dois andares, escada em caracol, o cristal-farol), Taverna, Ferraria e Quarto do
  Ferreiro (a escotilha trancada para o bunker), Hotel, Casa do Doutor, Celeiro da Fazendeira e as casinhas.
- **A casinha padrão:** toda casa sem interior planejado ganha a sala de enxaimel completa (lareira, mesa e bancos,
  cama, criado-mudo, prateleira, baú, barris, lampiões). **Sem nome** (a cena é só "Casa" e o minimapa não põe rótulo):
  só os lugares importantes têm nome.
- **Próximas levas:** o Hotel e a Casa do Doutor de verdade (hoje usam a casinha padrão), a Fazenda, o Bosque da
  Provação, as Minas, o Bunker, o Labirinto por dentro e a Caverna.

## 8. Fazenda e o resto do mapa

- A Fazenda está **abandonada há mais de um ano**: luzes apagadas, poeira, teias que tremem, a cortina da janela da
  cozinha mexendo (o clique duplo fecha a janela). Nada vivo, mas a cena tem movimento.
- **O celeiro tem o portão aberto e o fechado.**
- **A lareira** fecha numa cornija de pedra em vez de sumir em transparência.

## 9. Como produzimos a arte (para quem for continuar)

- Cada grupo de peças é um módulo em `scripts/3d/estilo/pecas_px/` (hoje também `vila_predios.py`,
  `vila_natureza.py` e `medieval.py`). Estado novo = 5º elemento da tupla em `ITENS` (`{'1': lambda: peca(True)}`),
  sem mexer no desenho do estado 0.
- Quem desenha exporta **sempre com `--destino`** numa pasta de teste e confere a folha; **a exportação para o jogo
  é uma só, no fim**, para ninguém pisar no `moveis.json` do outro.
- **Não reescreva o `moveis.json` com outra ferramenta** (o JavaScript reordena as chaves e troca `386.0` por `386`,
  e o diff vira milhares de linhas): só pelos exportadores em Python.
- O catálogo (`shared/src/furni.ts`) é de um dono só por vez (os `states`, os defs novos, `semNome`).

## 10. O que ficou em aberto

- **Puzzles no celular do jogador** (painel de senha, disjuntores, fios), no caminho do Feliperama e da Sinuca:
  proposta feita, falta o Felipe dizer se o efeito pode acender grupos de luzes e tocar alarme.
- **A Catarina** está no Bar da Sede e o grupo na Fazenda: o comando para levá-la está na conversa (precisa da
  permissão do Felipe, é o banco de verdade).
- **Fichas:** aqui a aba já está no visual novo; falta o print da tela que está estranha (celular do jogador, janela
  de editar ou versão antiga rodando).
- Tiradentes e Igarapé (os lugares que faltam).
