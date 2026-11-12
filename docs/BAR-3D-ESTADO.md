# O Bar em 3D: estado e como retomar (10/11/2026)

O Felipe vai primeiro deixar o isométrico 100% e só depois retomar o 3D aos poucos. Este arquivo deixa o 3D **parado em estado limpo**: o que funciona está descrito, o que não foi feito está listado. O plano e a conversa de fundo estão em [`BAR-3D.md`](BAR-3D.md); os pedidos de arte dos personagens, em [`PEDIDOS-STANDEES-GPT.md`](PEDIDOS-STANDEES-GPT.md).

## Estilo LOW-POLY FACETADO (11/11/2026): `?estilo=lowpoly`

Decisão do Felipe: o 3D anterior teve móveis feios e brilho bizonho; o caminho é um visual de **videogame**, bonitinho, claro, legível de relance, que **roda suave** (poucos polígonos, poucas luzes, sombra barata). Referência de estilo: Synty POLYGON (caixas, prismas, cilindros baixos, cor chapada por face); nenhum modelo copiado, tudo feito por código.

- **Abrir:** `http://127.0.0.1:5199/proto3d.html?estilo=lowpoly` (sem o parâmetro, vale o estilo anterior, intacto).
- **Gerador (Blender por código):** `scripts/3d/lowpoly/` (`lib.py` com os helpers: caixa chanfrada/afunilada, cilindro de 5-8 lados, prisma, icosfera, paleta por material sem textura, flat shading real; `moveis.py` com os 36 móveis do Bar; `gerar.py` exporta). Rodar: `"F:/Programas/Blender 5.2/blender.exe" -b --factory-startup -P scripts/3d/lowpoly/gerar.py` (`-- --so a,b` para alguns). Saída: `client/public/prototipo3d/lowpoly/<defId>.glb`. Mesmo contrato dos modelos antigos (metros, origem no centro da pegada no chão, frente +Z, materiais `EMISSIVO*`, `NEON_ROSA`, `CHAMA`, `VIDRO`, `POCA`). Móveis de parede encostam a traseira na borda da casa. Materiais: rugosidade 1, metal 0, sem especular, sem textura. A paleta mantém a identidade do bar (mesa e cadeira amarelas, balcão com painéis vermelhos, feltro verde, geladeiras amarela e vermelha).
- **No cliente:** `estilo.ts` (a chave), `lowpoly.ts` (piso de tábuas em cor chapada por vértice, paredes só nas bordas esquerda e fundo, lambri, friso, porta, janelas, itens de parede simples, laje de "maquete"; sem prédios, sem rua), `moveis.ts` (`prepararLowpoly`: flat shading, fosco, sem contorno; **zero luzes de ponto**: cada lâmpada ganha só um halo e uma poça de luz desenhada no chão), `clima.ts` (céu fixo e claro `CEU_LOWPOLY`), `cena.ts` (sem bloom nem posterização, sem tone mapping, sombra de uma direcional só 1024², `px=1`), `standee.ts` (malha do recorte com 110 células em vez de 220).
- **Medido (RTX 3060, painel do navegador, `cam=2`):** lowpoly **60 fps** (limite do monitor), 0 luzes de ponto, ~118 mil triângulos e ~890 chamadas de desenho **contando a passada da sombra** (os móveis têm ~29 mil triângulos e ~410 malhas); o estilo anterior, na mesma máquina, fez **~25 fps** com 23 luzes. **Não medido:** tablet e celular de verdade.
- **Prints:** `docs/prints-bar3d/lowpoly-*.png` (geral, mesa, balcão, mesa com itens, sinuca, comparação com o isométrico). Os itens (copos, canecas, cinzeiros, castiçal) pousam no tampo medido do modelo (`info().apoios`: todos com apoio, `y` = topo).
- **Falta / ideias:** reduzir as chamadas de desenho (mesclar as malhas de cada móvel por material ou usar `InstancedMesh` por tipo; hoje cada `.glb` vira uma malha por material), tecla para ligar e desligar a luz agora só mexe nos emissivos (não há luz de ponto), a escada secreta ainda é só o poço, o recorte ilustrado dos agentes fica serrilhado de perto (menos células), a sala escura do clima (noite) não existe no low-poly (céu fixo), conferir em tablet. O Alosi low-poly não está aqui: depende da imagem do GPT e do gerador image-to-3D.
- **Typecheck:** `tsc -p client` tem 1 erro que já existia e não é do 3D (`client/src/render/roomStatic.ts`: falta `camara_fria` no mapa de pisos); o código novo compila sem erro.

## Alosi em 3D de verdade (11/11/2026): malha low-poly animada

O Alosi Walker deixou de ser recorte: é uma **malha 3D modelada no Blender por código**, low-poly facetado, flat shading, cor chapada por material (27 materiais, sem textura), 1,80 m, proporção levemente chibi (cabeça 20% maior, mãos e sapatos grossos). Referência: `docs/referencias-3d/alosi-lowpoly-folha.webp`; comparação lado a lado em `docs/prints-bar3d/alosi3d-vs-referencia.png`.

- **Gerador:** `scripts/3d/lowpoly/personagem_alosi.py` (reaproveita `lib.py`: materiais e primitivas; acrescenta lofts por anéis, chumaços de cabelo irregulares e o esqueleto). Rodar: `"F:/Programas/Blender 5.2/blender.exe" -b --factory-startup -P scripts/3d/lowpoly/personagem_alosi.py` (`-- --previa PASTA --pose idle@0.25|walk@0.2|armado|caido|repouso` renderiza vistas de conferência em vez de exportar). Saída: `client/public/prototipo3d/lowpoly/personagens/alosi.glb` (~700 kB, 5.470 triângulos).
- **Modelo:** cabelo castanho em ~70 chumaços facetados, rosto simples (sobrancelhas grossas, olhos escuros, óculos redondos de aro marrom, orelhas), camisa branca com gola alta de clérigo, crucifixo dourado em corrente, casaco creme com capuz caído, zíper dourado aberto, bolsos de zíper e punhos, cinto preto com fivela dourada, corrente dourada com carteira preta, calça social larga e sapatos pretos grossos. O **grimório** (capa marrom com sol dourado) são dois objetos separados: fechado preso ao flanco esquerdo (poses normais) e aberto na mão direita (pose armada); o que não está em uso fica com escala ~0 no clipe.
- **Esqueleto:** 15 ossos (hips, spine, head, braço e antebraço, coxa, canela e pé de cada lado, e os dois livros), ossos com orientação neutra (eixos do mundo), cada peça rígida com peso 1 no osso certo; juntas cobertas por bolas (ombro, cotovelo, joelho). **Clipes** (nomes exatos): `Idle` (2 s, laço, respira), `Walk` (1 s, laço, pernas e braços alternando, corpo sobe e desce), `Armado_idle` (2 s, grimório aberto na mão direita), `Caido` (deitado de costas).
- **No cliente (`agentes.ts`):** no estilo lowpoly o agente Alosi usa o GLB (`GLTFLoader`, `AnimationMixer`, mistura de 0,25 s entre clipes) no lugar do standee; os outros agentes seguem como estavam. `?agente3d=0` volta ao standee, `?agente3d=1` liga o 3D fora do lowpoly. Idle parado, Walk andando (velocidade do clipe acompanha `CASAS_POR_SEGUNDO`), Armado_idle com `?armado=1` ou a tecla **F**, Caido por `proto.caido(2, true)`. O modelo olha para onde anda; anel, cartão do nome, escala (1,80 m) e interação (andar, clicar, câmera atrás do ombro) ficam como antes; sentar ainda não tem pose (só desce a altura).
- **Prints:** `docs/prints-bar3d/alosi3d-*.png` (parado de frente, 3/4, costas, de perto, armado, caído, andando 1 a 6, no bar ao lado dos outros agentes, na câmera 2, e a comparação com a referência). Console sem erros.
- **Limites:** peças rígidas (sem pesos suaves): o joelho e o cotovelo dobram com a bola da junta cobrindo, mas de muito perto aparece o recorte; o rosto é simples (sem boca expressiva nem piscar); o livro fechado fica preso ao tronco (não balança com a mão); o corpo caído não encosta exatamente no chão em todos os ângulos; sentado sem pose; só o Alosi tem malha (os outros três continuam standee); sem teste em tablet. O GLB tem uma amostra por quadro (24/s) nos 15 ossos: se pesar, reduzir a amostragem no exportador.

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
