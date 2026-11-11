# O Bar em 3D: estado e como retomar (10/11/2026)

O Felipe vai primeiro deixar o isométrico 100% e só depois retomar o 3D aos poucos. Este arquivo deixa o 3D **parado em estado limpo**: o que funciona está descrito, o que não foi feito está listado. O plano e a conversa de fundo estão em [`BAR-3D.md`](BAR-3D.md); os pedidos de arte dos personagens, em [`PEDIDOS-STANDEES-GPT.md`](PEDIDOS-STANDEES-GPT.md).

## Não mexe no jogo principal

- O protótipo é uma **página à parte** (`client/proto3d.html`). O `vite build` só monta o `index.html`, então nada do 3D entra no jogo do 8080.
- Conferido em 10/11: `npm run typecheck` verde, `npm test` 601 testes verdes, e o build do cliente (feito numa pasta temporária, sem tocar no `client/dist` do jogo) saiu com o **mesmo** bundle principal de antes: `index-*.js` 37,17 kB (37.176 bytes, igual ao do 8080) e `index-*.css` 624,18 kB.
- Única mudança fora do 3D: `client/package.json` ganhou `three` (dependência) e `@types/three` (dev), e o `package-lock.json` acompanhou. Só o protótipo importa o `three`.

## O que existe

**Páginas e dados**
- `client/proto3d.html`: o Bar da Ordem em 3D, só no navegador, com dados fixos.
- `client/public/prototipo3d/bar.json`: a cena do Bar (planta, 111 móveis, 36 tipos, itens de parede, porta), exportada por `scripts/dev/exportar-bar3d.mts` (lê a cópia `crona_visual`, só leitura).
- `client/public/prototipo3d/modelos/*.glb`: os 36 modelos dos móveis do Bar, gerados no Blender por código (`scripts/3d/moveis_glb.py`, Blender em `F:\Programas\Blender 5.2\blender.exe`). Contrato: metros, origem no centro da pegada no chão, frente +Z, materiais `EMISSIVO` e `VIDRO`.
- `client/public/arte/personagens/{tepes,catarina,alosi,cora-falcao}/standee.png`: as fotos dos 4 agentes recortadas (o standee ilustrado).
- `docs/prints-bar3d/`: os prints (antes e depois, de perto, clima, grade, interação, standees, itens na mesa).

**Código** (`client/src/bar3d/`)
- `cena.ts` (a página: câmera, luzes, pós-processo, teclas), `ambiente.ts` (piso, paredes, janelas, itens de parede), `moveis.ts` (carrega os `.glb`, a reserva por tipo, o contorno, os itens pousando no tampo), `texturas.ts`, `clima.ts` (hora, chuva, relâmpago).
- `agentes.ts` e `standee.ts`: os agentes como miniaturas (boneco de pixel das 8 direções, ou standee ilustrado com espessura e relevo).
- `interacao.ts`, `painel.ts`, `caminho3d.ts`: andar, objetos e a senha do freezer.

**Como abrir**: `cd client && npx vite --port 5199 --host 127.0.0.1`, depois http://127.0.0.1:5199/proto3d.html.
- Opções na URL: `?px=1` sem pixelado (padrão `2`, metade da resolução), `cam=1..4`, `hora=0..1`, `clima=0..2`, `grade=1`, `personagem=pixel`, `virar=0`, `agente=0..3`, `cidade=1`, `foto` (sem interface, para print).
- Teclas: **1–4** câmeras (geral, mesa, atrás do ombro, porta), **T** grade de 1,5 m, **C** clima, **H** hora, **P** pixelado, **O** paleta posterizada, **K** pixel × standee ilustrado, **V** olhar para a câmera ou para onde anda, **G** girar os agentes, **Tab** trocar o agente, **WASD/setas** andar, **Esc** parar, **?** ajuda.
- Mouse: arrastar gira, roda dá zoom, clicar num agente seleciona, clicar no chão anda, clicar num móvel abre o painel (examinar, sentar, ligar luz, pegar item, abrir a porta, a geladeira com a senha 0413).

## O que foi testado e como

- Visual: screenshots do painel do navegador, olhados um a um (prints em `docs/prints-bar3d/`); móveis conferidos nas folhas de contato do Blender e na cena.
- Interação (andar, painel, freezer errado e certo, câmera 3 seguindo): por script (`window.proto`, cliques simulados) e por print. **Não** testada com mouse e teclado reais num monitor de verdade.
- Os itens pousam no tampo real (medido no modelo carregado), conferido por print de perto no balcão, nas mesas, no aparador, no armário, no minibar e nas caixas.

## Desempenho medido (e o que NÃO foi medido)

- Medido no painel do navegador do app, que desenha por software e em segundo plano: **~5 quadros por segundo** com `px=1`, e ~37 com a página no painel em primeiro plano. **Não representa** uma placa de vídeo nem um tablet.
- Cena do Bar: 111 móveis, todos com `.glb` (0 na reserva), 23 luzes, memória JS ~48 MB.
- Falta medir de verdade: fps, chamadas de desenho e memória num computador com placa de vídeo e no tablet. Isso é o **primeiro ponto de parada** para decidir se o 3D segue.

## O que falta (e a ordem que eu sugiro para retomar)

1. **Medir** num PC com GPU e no tablet (a decisão de seguir depende disso).
2. **Mesa 3D ao vivo (só ver), não começada.** Estudei como a mesa isométrica recebe o estado; o desenho a seguir está pronto para quem retomar:
   - Entrar como mesa (`login` com `mesa: true`, nome de `tableName()`), receber `hello`/`characters` (as poses de cada personagem), `roomEnter {room, items, wallItems, users}`, `roomUpdate`, `itemAdd/Update/Remove`, `wallAdd/Update/Remove`, `userJoin/Leave`, `status` (movimento: `x,y,dir` e `mv` com o passo seguinte e `ms`), `userLook`, `session` (armed, hurt, vitals por peça), `combate` (a vez e os caídos, ids das peças em `participantes`), `telaEscondida`.
   - Montar `DadosBar` a partir disso (os `defs` saem de `FURNI`/`WALL_FURNI` de `@crona/shared`, como em `exportar-bar3d.mts`; `lock`/`link`/`state` vêm no item) e reaproveitar `montarCasca` e `montarMoveis` (refazer só os móveis, com um pequeno atraso, quando um item mudar).
   - Peças: os 4 agentes com `Agente` (standee); as outras com os sprites de `characters[].poses` (8 direções, estados armado e machucado), tamanho pelo livro (`shared/src/tamanho.ts`); caído deitado; anel pulsante na vez.
   - Névoa: `room.nevoa.vista` (uma letra por casa, '1' vista, '0' escondida): uma tampa escura no teto sobre as casas escondidas (opaca na mesa, translúcida para o mestre), com borda suave.
   - Câmera automática seguindo o grupo e a peça da vez. O `camMestre` do servidor vem em coordenadas de tela do isométrico (`cx, cy, w, h` em pixels), então não mapeia direto para o 3D: ignorar na fase 1.
   - Para o servidor aceitar uma segunda conexão ao mesmo tempo, entrar **como mesa** (a mesa segue a cena do mestre sozinha e não derruba a aba do isométrico); entrar como mestre com o mesmo nome derrubaria a outra (regra `variasAbas`). O servidor não manda nada extra ao mestre sobre a névoa: o "mestre vê tudo" se faz no cliente.
   - Build: acrescentar `mesa3d.html` como segunda página em `client/vite.config.ts` (o `three` fica num chunk à parte) e conferir que o bundle principal não mexe.
3. **Modo mestre da página** (`mesa3d.html` com a câmera livre, os presets 1–4, escurecido translúcido no que a mesa não vê) e o botão discreto "3D" perto de ISO | TÁTICA no `shell.ts`/`topbar.ts`, que abre a página numa janela de nome fixo.
4. **Fase 2 (o mestre interagir em 3D)**: a base de andar, objetos e a senha já existe no protótipo, só com dados locais; falta ligar tudo às mensagens do servidor (`tokenWalk`, `use`, `unlock`).
5. **Móveis por categoria**: o jogo tem 451 tipos de móvel; só os 36 do Bar têm `.glb`. Os outros caem numa reserva por tipo, mas falta um gerador por categoria (mesa, cadeira, balcão, estante, cama, planta, luminária) a partir das medidas do `FURNI`. A casca (paredes) assume a porta na coluna 0 e a planta com 'x' nas bordas; cenas ao ar livre (`aberto`, `terreno`) não estão cobertas.
6. **Arte dos personagens**: o Códex de linha de comando está parado (a conta Pro acabou; "modelo não suportado com conta ChatGPT" para qualquer modelo). O pacote para o GPT comum ou o Gemini está em `PEDIDOS-STANDEES-GPT.md` (2 folhas por agente: desarmado, armado, machucado, agachado, caído; fundo magenta para recorte). Hoje o standee tem uma única pose de frente por agente.

## Limites conhecidos do protótipo

- A escada secreta aparece como um buraco claro, sem os degraus; "Descer" é só um aviso.
- Sentar é um truque (o recorte desce até o assento).
- A visão geral (câmera 1) ainda é mais escura que o Bar de hoje.
- Chuva e relâmpago não foram conferidos de novo depois do ajuste de proporções.
