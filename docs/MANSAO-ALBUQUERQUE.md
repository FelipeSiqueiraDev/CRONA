# Mansão Albuquerque (21/10)

O lar da família Albuquerque: o terreno murado no meio da mata, a mansão de pedra de dois andares e o anexo.
Montada pelo `server/src/seedMansaoAlbuquerque.ts` (`MANSAO_REV`; subiu, o lugar é refeito no lugar), com arte de pixel por
código (`scripts/3d/estilo/pecas_px/mansao_*.py`). A planta do térreo é a do Felipe
(`campanha/referencias/mansao-albuquerque/mansao-primeiro-andar.webp`); o 2º andar é invenção minha, para o mestre
aprovar; o quarto da Catarina segue o áudio dela (`WhatsApp Ptt ... 14.57.26.txt` e `15.00.19.txt`).

## Quem é a família

- **Frigorífico Albuquerque**, fundado em 1918: a dinastia é rica por causa dele. O pai é o **CEO de hoje**.
- **Catarina** (atleta, esgrimista, ruiva) nasceu e cresceu aqui. **Miguel**, irmão dela (ruivo, lutador de boxe, técnico),
  também.
- O enredo da casa (quem mora, o que as pistas dizem) fica com o mestre, fora deste repositório, que é público.
- Nada de NPC posto no mapa e nenhum enredo inventado: só os cenários, as pistas ocultas e o que está nesta lista.

**Pistas ocultas:** o texto de verdade fica em `server/data/segredos-mansao.json` (fora do git, `{ chave: { title, text } }`);
o seed só tem um texto neutro e a chave (`segredo(...)` em `seedMansaoAlbuquerque.ts`). Sem o arquivo, a pista entra neutra.

## Escala

1 quadrado da planta = 1 casa (0,75 m). Cada cômodo é uma cena (regra do Felipe), com porta nos dois lados; a
posição de cada cena no minimapa (`plan`) é a do desenho (térreo) ou a do mesmo trecho da casa (2º andar). Porta de
dentro do mesmo lado da porta de fora (Salão Principal e Anexo: porta na frente, planBottom).

## O terreno (`Jardim`, 48 × 56, ao ar livre)

Muro de pedra em volta (pilar a cada 6 casas), o **portão** de ferro embaixo (casas 22 a 25), o caminho de pedra clara do
portão ao pórtico, a **fonte** (3×3) no caminho, canteiros, cipreste e topiária alinhados, estátuas, bancos, trilhas de
terra que contornam, o **anexo** (esquerda, 8×6), mata em volta. A mansão é um U de
quatro prédios (`mansao_central` no fundo, `mansao_ala_oeste` e `mansao_ala_leste` nos lados, `mansao_portico` colado na
frente do central). Entradas: o pórtico (porta no meio da frente, que leva ao Salão Principal) e o anexo.

## A planta de 23/10 (menos cômodos, maiores)

O Felipe trouxe a planta ilustrada ("tem muito espacinho pequeno só cheio de porta"): a mansão passou de 49 para 28 cenas
(`MANSAO_REV` 2). Decisões dele: os banheiros das suítes são cenas à parte, os seis quartos dos funcionários também, o
anexo fica e o barracão saiu. A planta não precisa ser 100% igual: o lavabo pequeno entre a suíte e a sala de jogos ficou de fora.

## Térreo (andar "Mansão Albuquerque") — cenas e ligações

Tamanho em casas (largura × fundo) e a posição na planta (x, y). `→` é a ligação (porta de ida e de volta).

| Cena | Tam. | Planta | Liga com | O que há |
|---|---|---|---|---|
| Salão Principal | 15×17 | 16,7 | S: jardim (a entrada principal); N: Cozinha; O: Área de Serviço e Biblioteca; L: Sala de Jantar e Escritório; duas escadarias para o Hall Superior | mármore xadrez, tapete vermelho da porta, colunas, a escultura sob o lustre, tapete redondo, relógio, poltronas vermelhas |
| Biblioteca | 14×10 | 2,14 | L: Salão | estantes do chão ao teto, mesa de leitura com 8 cadeiras, escada de rodízio, poltronas, globo |
| Escritório de Alexander | 10×11 | 31,13 | O: Salão | mesa do CEO virada para a cadeira, estantes, cofre (pista oculta), bar, sofá, globo, touro de bronze, retrato do fundador (pista oculta), mapa do frigorífico, prêmios |
| Sala de Jantar | 10×12 | 31,0 | O: Salão | mesa comprida de 20 lugares, lareira, aparador, armadura, quadros |
| Cozinha | 10×7 | 16,0 | S: Salão; O: Corredor dos Funcionários; L: Despensa | armários, fogão, pia, geladeira, a ilha no meio |
| Despensa | 5×5 | 26,0 | O: Cozinha | prateleira, adega, barris, sacas |
| Corredor dos Funcionários | 16×3 | 0,4 | N: quartos 1 a 4; S: quartos 5 e 6 e Lavanderia; L: Cozinha | bancos, quadro de chaves |
| Quartos de Funcionário 1 a 6 | 4×4 | 0..12,0 e 0..4,7 | o Corredor | cama de solteiro, criado-mudo, guarda-roupa ou cadeira |
| Lavanderia | 8×4 | 8,7 | N: Corredor; S: Área de Serviço | tanques, máquinas, cestos |
| Área de Serviço | 16×3 | 0,11 | N: Lavanderia; L: Salão | banco, aparador, vaso |

## 2º andar (andar "Mansão Albuquerque 2º")

| Cena | Tam. | Planta | Liga com | O que há |
|---|---|---|---|---|
| Hall Superior | 36×5 | 0,8 | duas escadarias para o Salão; N: Suíte e Sala de Jogos; S: quartos do Miguel, da Catarina e de hóspedes | passadeiras, consoles, relógio, retratos de família (dois são pistas ocultas) |
| Suíte do Casal | 12×8 | 6,0 | S: Hall; O: Banheiro do Casal | cama master, lareira, closet aberto, penteadeira, divã, poltronas |
| Banheiro do Casal | 6×7 | 0,0 | L: Suíte | banheira de pés dourados, pia dupla, box, vaso |
| Sala de Jogos | 14×8 | 22,0 | S: Hall | sinuca, fliperamas, jukebox, pôquer, bar com banquetas, TV e sofá, dardos |
| Quarto do Miguel | 11×8 | 0,13 | N: Hall; S: Banheiro do Miguel | cama, bancada de eletrônica, tatame, saco de pancada, halteres, luvas, mapa |
| Quarto da Catarina | 13×8 | 11,13 | N: Hall; S: Banheiro da Catarina; parede de escalada para o Mezanino | ver abaixo |
| Mezanino da Catarina (a caverna) | 6×5 | 11,13 (andar "Mezanino") | parede de escalada de volta | ver abaixo |
| Quarto de Hóspedes | 12×8 | 24,13 | N: Hall; S: Banheiro dos Hóspedes | cama de casal, guarda-roupa, cômoda, escrivaninha, poltrona |
| Banheiros do Miguel, da Catarina e dos Hóspedes | 6×4 | 2,21 / 11,21 / 27,21 | o quarto de cada um | pia, vaso, box |

### Quarto da Catarina (o áudio, ponto por ponto)

Tom neutro (`mansao_claro`), **uma parede destacada** com o **painel de troféus e medalhas**, e no canto a **estante de
troféus** (`estante_trofeus`, 23/10, o Felipe: "mais uma prateleira no canto da parede"); **cama de casal grande** com
travesseiros e **dois ursos de pelúcia** coloridos; **TV grande com console de movimento** de frente para a cama, com dois
pufes; o **canto das espadas de esgrima** (rack); e, perto da porta, a **parede de escalada** que sobe ao **mezanino**.

O mezanino é **uma cena à parte** (como o calabouço): o motor só sobe degrau de até 0,9 m, então a "segunda altura" virou a cena
"Mezanino" no andar de mesmo nome, mais escura, com a faixa de LED roxa/ciana, a cadeira gamer, o teclado que brilha, os dois
monitores, o computador, os pufes e as anotações.

### Fora

O **pórtico** de colunas (a entrada principal) ganhou telhado de duas águas com frontão e óculo no lugar do terraço com
balaústres (23/10: o terraço saiu do 2º andar e o alto do pórtico parecia uma varanda solta).

## O que o mestre ainda precisa decidir

- Os pais estão em casa, sumidos ou nunca existiram à mesa? O estado da mansão (limpa e silenciosa, ou com o que a Bíblia pede).
- O que o cofre guarda além do livro, qual a senha, e se o livro é um achado.
- Salas secretas (sugestões: atrás de uma estante da Biblioteca; um porão sob o anexo; a adega da despensa).
- Itens achados (há poucos, de enfeite: o resto é com o mestre) e objetivos.
- O que dizem as plaquinhas dos retratos do Hall Superior.
- Quem mora aqui (NPCs): nenhum posto; o mestre põe pelo Elenco.

## Arte nova (todas por código, módulos em `scripts/3d/estilo/pecas_px/`)

`mansao_predios` (4 blocos), `mansao_jardim` (anexo, barracão, muro, pilar, portão, estátua, topiaria, canteiro, cipreste,
lampião), `mansao_estrutura` (lustre, lareira, coluna, piano, escadas nobres, relógio, vasos, console, tapetes),
`mansao_conforto` (cama master, chaise, penteadeira, espelho, banheira, pia, adega, poltrona, carrinho de bar, closet, quadros,
retratos, janela com cortina), `mansao_quartos` (quarto da Catarina e do Miguel, sala de jogos), `mansao_escritorio` (escritório,
biblioteca), `mansao_estilos` (os dez pisos e paredes). A exportação para `client/public/arte/` é feita uma vez, no fim,
pelo coordenador.

## Como ver e o estado de hoje (23/10)

- **No jogo:** a campanha "Mansão Albuquerque" aparece no mapa-múndi (posição inicial no interior de São Paulo, perto da Sede; o mestre
  arrasta) com as telas de chegada e de saída que já existiam. O terreno (Jardim) é a cena de entrada; o minimapa mostra o térreo na planta do
  Felipe e as abas "2º andar" e "Mezanino". São 28 cenas (`server/test/mansaoAlbuquerque.test.ts`).
- **Arte:** exportada para `client/public/arte/mobiliario/` e `arte/texturas/px/mansao_*` (o `moveis.json` só pelos exportadores em Python; antes, ela entrava numa
  exportação única, com os comandos no `docs/EM-ABERTO.md`).
- **TV do quarto da Catarina:** a `tv_gamer` tem o tipo próprio (`tv_gamer`) e não o de rack de parede, para ficar de frente para a cama (a
  regra dos móveis de parede, `moveisNaParede.test.ts`, só vale para o resto).
- **Mezanino:** cena à parte (ver acima), ligada pela parede de escalada nos dois lados.
- **Itens achados** (pilhas no chão, todos de enfeite): cartão de visita no Salão Principal, abridor de cartas no Escritório de Alexander,
  medalha de ouro no quarto da Catarina e o caderno de anotações dela no mezanino.
- **Pistas ocultas** (só o mestre vê até mostrar): o retrato do fundador e o cofre no Escritório de Alexander, dois retratos do Hall Superior.
