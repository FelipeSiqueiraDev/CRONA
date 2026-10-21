# Mansão Albuquerque (21/10)

O lar da família Albuquerque: o terreno murado no meio da mata, a mansão de pedra de dois andares, o anexo e o barracão.
Montada pelo `server/src/seedMansaoAlbuquerque.ts` (`MANSAO_REV`; subiu, o lugar é refeito no lugar), com arte de pixel por
código (`scripts/3d/estilo/pecas_px/mansao_*.py`). A planta do térreo é a do Felipe
(`campanha/referencias/mansao-albuquerque/mansao-primeiro-andar.webp`); o 2º andar é invenção minha, para o mestre
aprovar; o quarto da Catarina segue o áudio dela (`WhatsApp Ptt ... 14.57.26.txt` e `15.00.19.txt`).

## Quem é a família (só o que o jogo e a Bíblia da Campanha já dizem)

- **Frigorífico Albuquerque**: fundado em 1918 por Maximiliano Albuquerque; a dinastia é rica por causa dele. O pai é o
  **CEO de hoje**. (Bíblia, seção 7: o negócio é fachada logística para transportes clandestinos; Catarina não sabe.)
- **Catarina** (atleta, esgrimista, ruiva) nasceu e cresceu aqui. **Miguel**, irmão dela (ruivo, lutador de boxe, técnico),
  também. **Os pais dos Albuquerque estão desaparecidos** (Bíblia: ligados ao Anfitrião); a mansão pode estar vazia e em
  silêncio. [PLANEJADO na Bíblia] o **livro da família** no escritório do pai: está no cofre do escritório, aberto à parte.
- A Bíblia pede que o mesmo nome apareça em fotografias de épocas diferentes: a Galeria de quadros do 2º andar tem
  retratos que o mestre pode usar para isso (as pistas ocultas estão no seed, `visible: false`).
- Nada de NPC posto no mapa e nenhum enredo inventado: só os cenários, as pistas ocultas e o que está nesta lista.

## Escala

1 quadrado da planta = 1 casa (0,75 m). Cada cômodo é uma cena (regra do Felipe), com porta nos dois lados; a
posição de cada cena no minimapa (`plan`) é a do desenho (térreo) ou a do mesmo trecho da casa (2º andar). Porta de
dentro do mesmo lado da porta de fora (Pórtico, Anexo e Barracão: porta na frente, planBottom).

## O terreno (`Jardim`, 48 × 56, ao ar livre)

Muro de pedra em volta (pilar a cada 6 casas), o **portão** de ferro embaixo (casas 22 a 25), o caminho de pedra clara do
portão ao pórtico, a **fonte** (3×3) no caminho, canteiros, cipreste e topiária alinhados, estátuas, bancos, trilhas de
terra que contornam, o **anexo** (esquerda, 8×6) e o **barracão** (direita, 9×9), mata em volta. A mansão é um U de
quatro prédios (`mansao_central` no fundo, `mansao_ala_oeste` e `mansao_ala_leste` nos lados, `mansao_portico` colado na
frente do central). Entradas: pórtico (porta no meio da frente), anexo e barracão.

## Térreo (andar "Mansão Albuquerque") — cenas e ligações

Tamanho em casas (largura × fundo) e a posição na planta (x, y). `→` é a ligação (porta de ida e de volta).

| Cena | Tam. | Planta | Liga com | Piso/parede | O que há |
|---|---|---|---|---|---|
| Pórtico | 9×8 | 20,21 | S: jardim; N: Saguão; O: Corredor Oeste; L: Corredor Leste | mármore | tapete vermelho longo, 4 colunas de mármore, lustres, vasos, consoles, quadros, relógio |
| Saguão | 10×5 | 19,15 | S: Pórtico; N: Salão; O: Sala de Chá; L: Sala de Música; duas escadas nobres para a Galeria (2º) | mármore | tapete redondo, relógio de caixa, palmeiras, vasos, lustre, retratos, escultura |
| Grande Salão | 13×8 | 18,7 | S: Saguão; N: suíte oeste e suíte leste; O: Sala Roxa e Cozinha; L: Sala do Café e Sala do Tapete Vinho | nobre | duas mesas compridas com 10 cadeiras cada, tapetes vinho, lareira de mármore ao fundo, lustres, colunas, quadros grandes, armaduras |
| Suíte de Hóspedes Oeste / Leste | 5×4 | 18,3 / 26,3 | S: Salão; banheiro no meio | claro | cama de casal, criados-mudos, cômoda, poltrona, quadro, janela |
| Banheiro dos Hóspedes | 3×4 | 23,3 | O: suíte oeste; L: suíte leste | banho | banheira de luxo, pia dupla, vaso, espelho |
| Sala Roxa | 6×4 | 11,7 | L: Salão; O: Estufa | nobre | tapete roxo, sofá, poltronas, mesa de centro, estante, lareira |
| Estufa (jardim de inverno) | 6×7 | 5,7 | L: Sala Roxa; S: Lavanderia | estufa | canteiros, palmeiras, vasos, bancada de plantas, fonte, banco, vidraças |
| Cozinha | 7×6 | 10,12 | L: Salão; O: Lavanderia; S: Escadaria de Serviço | serviço | fogões, pia, ilha, geladeira, armários, panelas, mesa de trabalho |
| Lavanderia | 5×3 | 5,15 | L: Cozinha; N: Estufa; S: Despensa e Depósito | serviço | tanques, máquina de lavar, cestos, tábua |
| Despensa | 4×3 | 7,18 | N: Lavanderia; L: Escadaria de Serviço | serviço | prateleiras, barris, sacas, adega, caixotes |
| Depósito | 3×3 | 4,18 | N: Lavanderia | rústico | ferramentas de jardim, caixotes |
| Escadaria de Serviço | 4×3 | 11,18 | N: Cozinha; O: Despensa; S: Corredor Oeste; escada para o Corredor Oeste do 2º | serviço | escada de serviço, quadro de chaves, bancos |
| Sala de Chá | 4×5 | 15,16 | L: Saguão; S: Corredor Oeste | claro | mesa de chá, poltronas, aparador, tapete, janela |
| Corredor Oeste | 11×3 | 9,21 | L: Pórtico; O: Banheiro dos Empregados; N: Despensa, Escadaria, Sala de Chá; S: Sala de Estar Oeste | mármore | passadeira, consoles, vasos, quadros |
| Banheiro dos Empregados | 4×3 | 5,21 | L: Corredor Oeste | serviço | vaso, pia, box, tanque |
| Sala de Estar Oeste | 7×7 | 9,24 | N: Corredor Oeste; O: dois quartos de empregados | nobre | tapete vinho, mesa redonda com cadeiras, duas poltronas, lareira, estante |
| Quartos dos Empregados 1 e 2 | 4×4 / 4×3 | 5,24 / 5,28 | L: Sala de Estar Oeste | serviço | cama, criado-mudo, guarda-roupa, cadeira |
| Sala do Café | 4×4 | 31,7 | O: Salão; L: Quarto Duplo | nobre | mesa redonda, cabeça de cervo, aparador |
| Quarto Duplo (hóspedes) | 5×4 | 35,7 | O: Sala do Café; L: Banheiro Leste | claro | duas camas de solteiro, criados-mudos |
| Banheiro Leste | 3×4 | 40,7 | O: Quarto Duplo | banho | banheira, pia, vaso |
| Sala do Tapete Vinho | 5×4 | 31,11 | O: Salão; L: Biblioteca | nobre | tapete grande, sofás, mesa de centro, lareira, xadrez |
| Biblioteca (térreo) | 7×10 | 36,11 | O: Tapete Vinho; S: Lounge | nobre | estantes, mesa central de leitura, escada de rodízio, poltronas, globo |
| Sala de Música | 6×6 | 29,15 | S: Corredor Leste; O: Saguão | claro | piano de cauda, banco, harpa/poltronas, cortinas |
| Corredor Leste | 7×3 | 29,21 | O: Pórtico; L: Lounge; N: Sala de Música; S: Escada Leste | mármore | passadeira, consoles, quadros |
| Lounge (sala de estar das poltronas) | 7×3 | 36,21 | O: Corredor Leste; N: Biblioteca; S: Gabinete | nobre | poltronas vermelhas, banco, aparadores |
| Escada Leste (caracol) | 4×3 | 32,24 | N: Corredor Leste; S: Quarto; escada em caracol para o Corredor Leste do 2º | nobre | escada espiral, tapete |
| Quarto (cama) Leste | 4×4 | 32,27 | N: Escada Leste | claro | cama de casal, tapete, guarda-roupa |
| Gabinete (o escritório clássico) | 7×6 | 36,25 | N: Lounge; O: Escada Leste | nobre | tapete vinho, mesa grande, globo, estante, lareira, retrato do fundador |
| Anexo (sala de armas e depósito) | 8×6 | – | S: Jardim | rústico | rack de armas, caixotes, barris, peles |
| Barracão (empregados) | 9×9 | – | S: Jardim | tábuas | seis baias com camas de solteiro, corredor, caixotes |

## 2º andar (andar "Mansão Albuquerque 2º"; invenção minha, ligado ao térreo pelas duas escadas do Saguão, pela de serviço e pelo caracol)

| Cena | Tam. | Planta | Liga com | O que há |
|---|---|---|---|---|
| Galeria | 10×5 | 19,15 | duas escadas nobres para o Saguão; N: Hall Superior; S: Terraço; O/L: corredores | balaústres, retratos, lustre, banco, vasos |
| Terraço | 9×8 | 20,20 | N: Galeria | balaústres, bancos, vasos, vista do jardim, mesa e cadeiras de ferro |
| Hall Superior (Galeria de Quadros) | 13×5 | 18,10 | S: Galeria; N: Suíte, Closet e Banheiro | quadros a óleo, retratos de época, passadeira, consoles, relógio |
| Suíte do Casal | 8×8 | 23,2 | S: Hall Superior | cama master, lareira, chaise, poltronas, penteadeira, criados-mudos, tapete, lustre |
| Closet | 5×4 | 18,2 | L: Suíte | armários abertos, espelho de corpo, penteadeira, pufe |
| Banheiro da Suíte | 5×4 | 18,6 | N: Hall Superior | banheira de luxo, pia dupla, box, vaso, espelho |
| Corredor Oeste (2º) | 14×3 | 5,15 | L: Galeria; N: Sala de Jogos e Hóspedes 1; S: Biblioteca; escada de serviço | passadeira, quadros |
| Sala de Jogos | 9×8 | 5,7 | S: Corredor Oeste | sinuca, fliperama, pôquer, TV grande, bar com banquetas, dardos, sofás |
| Quarto de Hóspedes 1 | 5×8 | 14,7 | S: Corredor Oeste | cama de casal, criados-mudos, poltrona, mesa |
| Biblioteca Superior | 14×10 | 5,18 | N: Corredor Oeste | estantes de parede a parede, escada, mesas de leitura, poltronas, lareira |
| Corredor Leste (2º) | 14×3 | 29,15 | O: Galeria; N: quartos; S: Escritório e Hóspedes 2; escada em caracol | passadeira, quadros |
| Quarto do Miguel | 6×8 | 29,7 | S: Corredor Leste | cama, bancada de eletrônica, saco de pancada, halteres, tatame, luvas, mapa |
| Quarto da Catarina | 8×8 | 35,7 | S: Corredor Leste; parede de escalada para o Mezanino | ver abaixo |
| Mezanino da Catarina (a caverna) | 6×5 | 35,7 (andar "Mezanino") | parede de escalada de volta | ver abaixo |
| Escritório do Pai | 8×8 | 35,18 | N: Corredor Leste | ver abaixo |
| Quarto de Hóspedes 2 | 6×8 | 29,18 | N: Corredor Leste | cama, escrivaninha, poltrona |

### Quarto da Catarina (o áudio, ponto por ponto)

Tom neutro (`mansao_claro`), **uma parede destacada** com o **painel de troféus e medalhas**; **cama de casal grande** com
travesseiros e **dois ursos de pelúcia** coloridos; **TV grande com console de movimento** na frente; o **canto das espadas de
esgrima** (rack); e, perto da cama, a **parede de escalada** que sobe ao **mezanino**.

O mezanino é **uma cena à parte** (como o calabouço): o motor só sobe degrau de até 0,9 m, então a "segunda altura" virou a cena
"Mezanino" no andar de mesmo nome, mais escura, com a faixa de LED roxa/ciana, a cadeira gamer, o teclado que brilha, os dois
monitores, o computador, os pufes e as anotações. Decisão a confirmar com o Felipe (se quiser outra solução, é só pedir).

### Escritório do Pai (CEO do Frigorífico)

Mesa enorme virada para a cadeira, estante, vitrine de troféus da empresa, mapa do Brasil com as unidades, foto aérea de
uma unidade, a placa do frigorífico (1918), diplomas, touro de bronze, cofre (com o livro da família, oculto), bar, poltronas e
sofá, globo, lareira. O primeiro andar tem o Gabinete (o escritório clássico da planta, com o retrato do fundador).

## O que o mestre ainda precisa decidir

- Os pais estão em casa, sumidos ou nunca existiram à mesa? O estado da mansão (limpa e silenciosa, ou com o que a Bíblia pede).
- O que o cofre guarda além do livro, qual a senha, e se o livro é um achado.
- Salas secretas (sugestões: atrás da estante da Biblioteca Superior; o porão sob o barracão; a adega).
- Itens achados (há poucos, de enfeite: o resto é com o mestre) e objetivos.
- Se a Galeria de Quadros mostra o mesmo nome em épocas diferentes (o gancho da Bíblia sobre Maximiliano).
- Quem mora aqui (NPCs): nenhum posto; o mestre põe pelo Elenco.

## Arte nova (todas por código, módulos em `scripts/3d/estilo/pecas_px/`)

`mansao_predios` (4 blocos), `mansao_jardim` (anexo, barracão, muro, pilar, portão, estátua, topiaria, canteiro, cipreste,
lampião), `mansao_estrutura` (lustre, lareira, coluna, piano, escadas nobres, relógio, vasos, console, tapetes),
`mansao_conforto` (cama master, chaise, penteadeira, espelho, banheira, pia, adega, poltrona, carrinho de bar, closet, quadros,
retratos, janela com cortina), `mansao_quartos` (quarto da Catarina e do Miguel, sala de jogos), `mansao_escritorio` (escritório,
biblioteca), `mansao_estilos` (os dez pisos e paredes). A exportação para `client/public/arte/` é feita uma vez, no fim,
pelo coordenador.

## Como ver e o estado de hoje (21/10)

- **No jogo:** a campanha "Mansão Albuquerque" aparece no mapa-múndi (posição inicial no interior de São Paulo, perto da Sede; o mestre
  arrasta) com as telas de chegada e de saída que já existiam. O terreno (Jardim) é a cena de entrada; o minimapa mostra o térreo na planta do
  Felipe e as abas "2º andar" e "Mezanino". São 49 cenas (`server/test/mansaoAlbuquerque.test.ts`).
- **Arte:** os módulos estão no repositório, mas a arte exportada (`client/public/arte/mobiliario/` e `arte/texturas/px/mansao_*`) entra numa
  exportação única, a do coordenador (comandos no `docs/EM-ABERTO.md`). Sem ela, o jogo desenha as peças novas com a caixa de reserva.
- **TV do quarto da Catarina:** a `tv_gamer` tem o tipo próprio (`tv_gamer`) e não o de rack de parede, para ficar de frente para a cama (a
  regra dos móveis de parede, `moveisNaParede.test.ts`, só vale para o resto).
- **Mezanino:** cena à parte (ver acima), ligada pela parede de escalada nos dois lados.
- **Itens achados** (pilhas no chão, todos de enfeite): cartão de visita no Saguão, tesoura de poda na Estufa, abridor de cartas no Gabinete,
  medalha de ouro no quarto da Catarina e o caderno de anotações dela no mezanino.
- **Pistas ocultas** (só o mestre vê até mostrar): o retrato do fundador no Gabinete, os dois retratos de Maximiliano na Galeria de Quadros, o cofre
  do escritório do pai.
