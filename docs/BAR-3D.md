# O tabuleiro em 3D: o Bar da Ordem como protótipo (10/11/2026)

**O pedido do Felipe:** "me mostre o Bar da Ordem com os 4 agentes como temos hoje, e como a gente consegue fazer em 3D (Blender, Códex, o que precisar), da melhor forma, de um jeito que a gente consiga fazer tudo que temos e mais coisas, de acordo com as nossas regras. Só um tabuleiro: o combate é nas miniaturas, dado físico."

**A referência:** o Nexus Tabletop (sala 3D de poucos polígonos, luz quente, sombras, prédios com janelas acesas ao fundo, clima ao vivo, câmera que gira e personagens que são recortes ilustrados em pé, respirando). Os modelos 3D de personagem do Blender (Quaternius) foram **descartados** pelo Felipe em 09/11: o boneco continua sendo ilustração.

Os prints do antes e do depois estão em `docs/prints-bar3d/` (só neste computador, fora do git: 30 MB); o protótipo roda em `client/proto3d.html` (`cd client && npx vite --port 5199`, aba `/proto3d.html`).

## O que NÃO muda (é o que já temos e funciona)

O 3D troca **só o desenho no cliente**. Ficam como estão:

- o servidor autoritativo, o banco, as mensagens e a ordem dos turnos;
- a planta (`heightmap`), as casas de 0,75 m, os móveis com posição e giro, as peças e as fichas;
- todas as regras (`shared/src/regras`, o combate, a munição, as regras da casa), os dados **físicos** (o mestre digita o que saiu na mesa) e a tela do combate;
- o tamanho dos seres pelo livro (Tab. 7.1: pegada de 1, 2 × 2, 3 × 3, 6 × 6 casas) e a distância contada da borda da pegada;
- as contas, as campanhas, o celular do jogador, a mesa (o tablet).

## Um tabuleiro só

Hoje existem dois jeitos de ver a mesma cena: o isométrico e a vista tática (ISO | TÁTICA, a tecla T), com dois motores de desenho. No 3D a gente tem **uma cena só**, e a "tática" vira um estado dela:

| Hoje | No 3D |
|---|---|
| ISO | câmera de mesa, inclinada, com giro (a visão de jogo) |
| TÁTICA | a mesma cena vista de cima, **grade de 1,5 m ligada** e as miniaturas ocupando a pegada do livro |
| ficha redonda com retrato e arco de PV | a miniatura: recorte ilustrado em pé, sobre uma base de acrílico redonda com o anel da cor do lado |
| marcas do combate (alcance, cobertura, área) | decalques no chão da cena, projetados na grade |
| névoa por pincel | máscara de visão por casa (a mesma `NevoaCena`), com a sala escura e o brilho de luz de quem a vê |
| sombra do passo da Magistrada | casas marcadas, com o mesmo cálculo (`shared/src/sombras.ts`) |
| Ctrl + clique, arrastar a peça, clique duplo nas portas | o mesmo, por raio (picking) em vez de projeção 2D |

O que o 3D acrescenta: câmera livre e presets (visão geral, mesa, atrás do ombro, close), luzes de verdade com sombra projetada pelos móveis e pelas miniaturas, clima ao vivo (chuva, relâmpago, hora do dia) e o fundo da janela com a cidade.

## Como cada coisa é feita

- **Cenário (chão, parede, janelas):** gerado por código a partir do `heightmap`, com as texturas por código que já existem (`client/src/bar3d/texturas.ts`) e a janela da noite.
- **Móveis:** um modelo `.glb` por tipo, gerado **no Blender por código** (`scripts/3d/moveis_glb.py`), em metros, com a caixa exata do móvel (largura × 0,75, altura em metros, fundo × 0,75). Lâmpadas levam um material `EMISSIVO` que o cliente liga como luz; vidro leva `VIDRO`.
- **Personagens:** recorte ilustrado em pé (billboard, sempre virado para a câmera), respirando, com a base redonda, a sombra e o nome. A ilustração é a que o Códex já fez (a arte grande da FICHAS); poses de armado, machucado e caído trocam a imagem, como hoje.
- **Efeitos de combate e rituais:** partículas e decalques no mesmo estilo; nada disso decide regra.
- **Dados:** físicos. Não há dado 3D na tela.

## A conta do trabalho (ser honesto)

- O jogo tem **284 cenas, 7.339 móveis e 451 tipos de móvel** (mais 73 tipos de parede). O Bar usa 36 tipos.
- Um `.glb` bonito por tipo, à mão, é inviável. O caminho é um **gerador por categoria** (mesa, cadeira, balcão, estante, cama, planta, luminária…) a partir das medidas que o `FURNI` já tem, com variações de material, e só os móveis de destaque feitos à mão (ou pelo Códex como referência).
- O celular e o tablet precisam aguentar WebGL: o protótipo mede o custo (quadros por segundo) antes de prometer.
- O estilo pixel art que decidimos em 04/10 deixa de ser o do tabuleiro. O Felipe precisa aprovar isso olhando o protótipo.

## Fases

0. **Protótipo do Bar** (feito agora): só leitura, dados do `bar.json`, 4 agentes de exemplo.
1. **Mesa (tablet) em 3D:** liga a cena de verdade pelo websocket, só ver. Menor risco, porque a mesa não tem toque.
2. **Mestre:** escolher peça, andar, abrir porta, usar objeto, as ferramentas da mesa (apontar, desenhar, névoa) e as marcas do combate.
3. **Todos os cenários:** o gerador por categoria, os móveis de destaque e a conversão das 284 cenas.
4. **Clima, hora do dia e presets de câmera ao vivo,** que também podem entrar no 2D antes, se o Felipe quiser.

## As referências do Felipe (10/11)

Quatro vídeos (fora do git, em Downloads): `showcase_tokens`, `camera-imersiva`, `clima-e-naoseioque` e `editor-maps`. Pela interface do editor, parecem feitos na Unity (com o ProBuilder); o mapa é a "Base da Ordem Suvaco Seco".

- **Tokens:** a ilustração em pé, sem base, escurecida pela luz e pela névoa da cena; quando a pessoa gira, a imagem troca (frente, três-quartos, perfil, costas). **Feito (10/11):** o standee troca de ilustração pela direção que a câmera vê, como o boneco de pixel já fazia.
  - Cada direção é um arquivo `standee-<dir>.png` na pasta do agente (`s`, `se`, `e`, `ne`, `n`, `nw`, `w`, `sw`, com o mesmo sentido do `tabuleiro-32bits/`); o `standee.png` vale como `s`.
  - Falta uma direção? A do outro lado, espelhada, entra no lugar (`e` ↔ `w`, `se` ↔ `sw`, `ne` ↔ `nw`).
  - Hoje só existe a de frente: os 4 aparecem de frente de qualquer ângulo. **Falta a arte das outras 7 direções**, na pintura do `standee.png` (as 8 poses que temos são chibi).
  - `?standee=chibi` usa as 8 poses chibi no standee, só para conferir a troca; a tecla **G** faz os agentes girarem no lugar.
- **Câmera imersiva:** baixa, seguindo a peça, atrás do ombro, girando livre. Falta.
- **Clima:** o prédio de fora, a rua, o céu passando de nuvens para chuva, névoa e flocos. Falta.
- **Editor:** a árvore da cena, posição, giro e escala, as setas de arrastar e as luzes com o alcance. Falta (é o maior).

## Perguntas para o Felipe

- O visual do protótipo é o caminho (recorte ilustrado numa sala 3D de poucos polígonos)?
- A mesa (tablet) vira 3D primeiro, como a fase 1 propõe?
- O que fica do 2D enquanto o 3D não cobre as 284 cenas: os dois motores convivem por cena?
