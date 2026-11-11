# Acabamento do isométrico: a lista até o domingo (10/11/2026)

**A decisão do Felipe (10/11):** primeiro o isométrico **100% e liso**, depois o 3D, aos poucos. O 3D está guardado e parado (`docs/BAR-3D.md`, `docs/BAR-3D-ESTADO.md`).

A lista está por ordem de importância para a sessão de domingo (15/11). **[F]** = precisa de uma decisão ou ação do Felipe; o resto é com o Claude.

## 1. Segurança da sessão (antes de tudo)

- [ ] **Backup + montagem + subida** do que estiver pronto, com um só supervisor (`jogo.mjs`), e o **túnel** conferido na véspera (o link muda a cada subida; o de agora fica em `server/data/link.txt`).
- [ ] **Branch própria para o 3D** (`claude/mesa-3d`), para a `claude/campanhas` ficar só com o isométrico. Os arquivos do 3D estão soltos: `client/proto3d.html`, `client/mesa3d.html`, `client/src/bar3d/`, `client/public/prototipo3d/`, `scripts/3d/moveis_glb.py`, `scripts/dev/exportar-bar3d.mts`, `client/package.json` (a dependência `three`) e os prints em `docs/prints-bar3d/`.
- [ ] **Commit e push** do que já foi feito e não subiu (o combate conferido, a auditoria, a ficha da Ovelha).
- [ ] Limpar o que sobrou solto na pasta (os dois `.mp4` em `docs/`, `elenco-homens.tmp.jpg`, `docs/mansao-reorganizacao-pausada/` se não for mais usada).

## 2. Combate conferido na tela (o que a mesa mais usa)

Conferido na prévia em 09/11: Dança das Lâminas, golpe de passagem, olho do predador, cartão da corrente, Recarregar, Quebrar e Consertar. **Falta conferir:**

- [ ] As janelas de **ritual**, **socorro** e **Área** (só passaram por typecheck e testes).
- [ ] A **Magistrada tomando dano** no COMBATE de verdade (PV 1200, machucado em 600).
- [ ] O passo **Rolagem** em tela de **1024 × 768**: o campo do d20 aparece cortado até rolar o painel do meio.
- [ ] A **Presença Perturbadora** (hoje só um lembrete): decidir se vira regra. **[F]**
- [ ] Rodar **uma luta de ponta a ponta** com as fichas de verdade (os 4 Marcados contra a Ovelha ou o Porco), do começo ao fim, anotando tudo que parecer estranho.

## 3. Fichas e jogadores **[F]**

- [ ] **Tepes:** escolher a perícia do −5 do 25% (Diplomacia, Enganação ou Intimidação) e o poder de combatente do 30%.
- [ ] **???:** a afinidade ("eu escolho depois").
- [ ] **Ômega-99 e ???:** as perícias que passam do livro (manter ou cortar).
- [ ] Os 4 jogadores **confirmam o equipamento** no primeiro login (a janela única de refazer a mochila).
- [ ] Fichas de combate dos **Açougueiros**, que o Felipe está montando.
- [ ] Conferir os números da **ficha do Porco** (caseira, VD 60).
- [ ] Decidir se a **modificação de arma** vale em qualquer lugar ou só na base.
- [ ] Confirmar os **nomes dos pacotes de calibre grosso** (são nossos, o livro não nomeia).

## 4. Celular e telas do jogador

- [ ] O painel **OBJETO em 375 px** e os outros tipos de item no chão (só o primeiro foi visto).
- [ ] A ficha do jogador em celulares estreitos (340 px foi visto, falta um aparelho de verdade).
- [ ] **Reconexão do celular** (ping de 20 s): conferir num celular real que dorme e volta.
- [ ] A **tela preta** de 04/11: confirmar num celular de jogador que a ficha abre.

## 5. Desempenho do tabuleiro

- [ ] A **travada de ~70 ms a cada ~5 s** com tudo parado: preciso de uma foto do medidor `?fps` (a linha "quadro longo") no PC do Felipe. **[F]**
- [ ] Se o `?fps` mostrar "desenhar em ordem" pesado, juntar os móveis parados numa camada só (já estudado, ficou de fora de propósito).

## 6. O que a auditoria deixou aberto

- [ ] **Nº 32:** a Identificação da FICHAS do mestre pode perder um toque (guardar o estado por seção, como o celular já faz).
- [ ] **Nº 22:** o zoom da vista tática na mesa que reconecta (conferir se chega; mandar o zoom junto de `camMestre`).
- [ ] Conferência jogando: **deitar, portas e objetos** interagindo certo.

## 7. Conteúdo e mapas

- [ ] A **granada do Bar** e a **mesa ritual da Fazenda** ("itens não encontrados"): preciso das duas linhas da tabela de auditoria. **[F]**
- [ ] A **Mansão**: a reorganização está pausada (os cômodos empilhados e confusos); o que foi feito está em `docs/mansao-reorganizacao-pausada/`. **[F]** quando for retomar.
- [ ] **Sentar** (pausado em 29/10): a pose da Alosi na poltrona.
- [ ] O **Miguel** na vista Stardew e a decisão de levar a câmera Stardew para outros cenários. **[F]**

## 8. Arte (Códex) — travado

O Códex de linha de comando está bloqueado (a conta Pro acabou). O que depende dele: as poses de corpo inteiro dos agentes (se o 3D voltar), o retrato do Pedro sem `-olhos-fechados` já foi feito, a pose sentada da Alosi, as poses agachadas e armadas pendentes. O pacote de pedidos para o ChatGPT comum está em `docs/PEDIDOS-STANDEES-GPT.md`.

## Como atacar (sugestão)

1. Terça e quarta: **1** (segurança e branch), **2** (combate conferido) e o que for do Claude em **4**, **5** e **6**.
2. Quinta: o Felipe decide o **3** e responde o **7**, e o Claude fecha o resto.
3. Sexta: rodar uma luta inteira e uma sessão de ensaio, montar, conferir o túnel e fazer o backup final.
4. Sábado: só correção do que o ensaio mostrar, sem novidade.
