# Briefing dos agentes de mapa (15/10)

Três agentes trabalham AO MESMO TEMPO no mesmo repositório (`F:\Dhellow\CRONA\projeto`, branch `claude/tabuleiro-pixel`):
**Santo Berço** (o resto), **Tiradentes** e **Igarapé**. O coordenador (o Claude da conversa com o Felipe) faz a
exportação final da arte para o jogo, confere no navegador e faz o commit. Leia tudo antes de começar.

## Leia antes (nesta ordem)

1. `CLAUDE.md` e `AGENTS.md` da raiz, `docs/GUIA-DO-CLAUDE.md`.
2. `docs/GUIA-MAPAS-PIXEL.md` (as regras da pixel art do tabuleiro, a câmera, as medidas, os erros que já aconteceram)
   e abra as imagens-alvo que ele aponta (`docs/estilo/jogo-cozinha-px.png`, `docs/estilo/cozinha-final_cozinha.png`).
3. `scripts/3d/estilo/pecas_px/LEIA-ME.md` (como um módulo de peças é feito e exportado).
4. Os seeds prontos como molde: `server/src/seedSantoBerco.ts` (vila ao ar livre + interiores, `casaPadrao`),
   `server/src/seedFazenda.ts`, `server/src/seedOrfanato.ts`; e `docs/SANTO-BERCO.md`.
5. `docs/ATUALIZACAO-14-10.md` (as regras novas de 14/10).

## Regras do Felipe que NÃO podem ser quebradas

- **O tabuleiro é só código** (pixel art 1:1 desenhada pelo motor `scripts/3d/codigo/motor.py` via os módulos de
  `scripts/3d/estilo/pecas_px/`). Nada de arte do Códex dentro do tabuleiro, nada de imagem pintada.
- **Porta de dentro do MESMO lado da de fora**: se a porta do prédio está na frente, a porta no interior também fica na
  parede da frente (`planBottom`), e assim por diante (`planTop`, `planRight`, `plan`). Ele já reclamou disso duas vezes.
- **Móveis de abrir** (baú, armário, cômoda, gaveteiro, geladeira de vidro, caixote): estado 0 FECHADO, 1 ABERTO, sempre
  as duas versões (e a variante `!vazio` com o aberto vazio). Luzes e portas: 0 aceso/aberto.
- **Casas comuns sem nome**: use o modelo `casaPadrao` / `semNome`; só os lugares importantes têm nome no mapa.
- **Mesa de escritório sempre virada para a cadeira** (`server/test/mesas.test.ts`) e **nada de item embaixo da mesa**
  (papéis e itens pequenos ficam EM CIMA: não marque como `flat`).
- **Nenhum item de parede em cima de porta ou passagem** (`server/test/paredes.test.ts`) e, nas fachadas desenhadas por
  código, nenhuma janela (com as folhas abertas) em cima de porta ou de outra janela: use `_andar` de
  `pecas_px/vila_predios.py`, que confere os vãos sozinho (`_conferir_vaos`).
- **Cada cômodo é uma cena**; paredes inteiras; para ir de um cômodo a outro, porta/passagem ligada nos dois lados.
- **Quem chega de outra cena fica virado para a tela** (já é automático).
- **Fogo, luz e janela trazem vida** (já é automático no cliente: toda luz `kind: 'fire'` ganha a chama animada e as
  brasas, toda janela com luz `natural` ganha o feixe). Ponha lareiras, velas, tochas e janelas onde fizer sentido.
- **Camas são de deitar** (já é automático para `kind: 'bed'`, `'hospital_bed'`, `'beliche'`).

## Como trabalhar sem atropelar os outros dois

- **Seus arquivos são só seus** (a lista está no seu pedido). Arquivos compartilhados (`shared/src/furni.ts`,
  `shared/src/lugares.ts`, `server/src/seed.ts`, `server/src/db.ts`, `scripts/3d/estilo/pecas_px/catalogo-lugares.json`)
  você só mexe com a ferramenta **Edit**, com trechos pequenos e ancorados (NUNCA `Write` no arquivo inteiro), relendo
  antes de cada edição: outro agente pode ter mudado. Em `furni.ts`, ponha as suas peças num bloco com um comentário
  `// ---------- <SEU LUGAR> (15/10) ----------` no fim da lista `FURNI_METERS` (antes do `];` dela) e nada fora dele.
- **Arte: SEMPRE com `--destino`** numa pasta de teste sua (por exemplo
  `C:\Users\felip\AppData\Local\Temp\crona-agentes\<seu-lugar>\`). NUNCA exporte direto para `client/public/arte/`
  e NUNCA reescreva o `moveis.json` com outra ferramenta além dos exportadores em Python. O coordenador exporta no fim.
  Rode o exportador com `PYTHONIOENCODING=utf-8` e confira a folha (`--folha`), ampliando os recortes, peça por peça.
- **Banco de dados: não mexa em nenhum.** O seed monta as cenas sozinho. Se mudar um seed que já existe, aumente a
  revisão dele (`SANTO_BERCO_REV` etc.) para a mudança chegar aos bancos já criados.
- **Não faça commit, nem push, nem stash.** Não mexa no cliente (`client/src`) a não ser que o seu pedido diga.
- **Sem erros no fim:** `npx tsc --noEmit -p shared`, `-p server` e `-p client` limpos e `npm test` (em `server/`)
  passando inteiro. Escreva um teste do seu lugar no molde de `server/test/santoBerco.test.ts` (cenas, portas de ida e
  volta, tudo alcançável da entrada).
- O Felipe fala português e escreve "você" com sotaque; comentários e textos de cena em português, no estilo do código.

## O que entregar no fim (a sua resposta)

1. As cenas criadas (nome, tamanho, o que tem) e como ligam umas nas outras.
2. As peças novas (def, módulo, estados) e a pasta de teste da arte (com a folha).
3. Os arquivos que você mexeu, um por um (para o coordenador conferir e exportar).
4. O resultado do `tsc` e do `npm test`.
5. O que ficou faltando ou o que precisa do Felipe decidir.
