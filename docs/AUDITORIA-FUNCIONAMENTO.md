# Auditoria: o que já existe e não funciona direito (27/10/2026)

Só leitura do código (branch `claude/tatica-codigo`), por cinco frentes: MAPA, COMBATE, FICHAS, celular do jogador e mesa/protocolo. Nada foi mudado. Typecheck limpo e 515 de 515 testes passando: os defeitos abaixo não têm teste que os pegue. O log do jogo (`server/data/jogo.log`) não tem erro de servidor. Os principais foram conferidos de novo no código (✔).

## Grupo A — a ficha inteira por cima (perda de dados, o mais grave) — **consertado em 27/10**

**O conserto:** quem grava manda junto a cópia de onde partiu (`base`); o servidor fica só com o que mudou nela (`mesclarFicha`, em `shared/src/mesclarFicha.ts`: mescla de três vias, a mochila item a item pelo `uid`). No cliente, toda cópia de ficha para mexer sai de `clonarFicha` e se grava com `gravarFicha` (`client/src/fichaOrigem.ts`); o celular junta a ficha que chega com a mudança ainda não mandada (`rebasearFicha`) em vez de ignorar. A recusa reenvia a ficha a quem pediu. O que se faz com a conexão caída espera na fila até o `welcome` (`Net.entrou`). O "Pedir itens à Ordem" do celular põe só o que se pediu na mochila de agora. Testes em `server/test/fichaSegura.test.ts`.

O `fichaSalvar` troca a ficha inteira pela que o cliente mandou (`hotel.ts:1493`) e devolve o PV às peças (`fichaParaPecas`). Toda tela que guarda uma cópia antiga e manda depois apaga o que mudou nesse meio-tempo.

1. ✔ **Celular do jogador:** com um envio pendente (450 ms), o `setFicha` ignora o servidor; a nota grava a cada tecla, então enquanto o jogador digita o timer nunca vence. Ao parar, manda a ficha velha: o dano do combate some da ficha e da peça (`jogador.ts:205`, `:222-234`).
2. **Item duplicado:** o jogador toca PE −1 e em menos de 450 ms entrega, larga ou usa um item; o `fichaSalvar` atrasado chega com o inventário antigo e o item fica nos dois lugares (`jogador.ts:238`, `hotel.ts:1503`).
3. **FICHAS do mestre:** o rascunho da Evolução, Requisição, NEX ou Editar é uma cópia de quando abriu; ao confirmar, apaga dano, itens gastos e condições de enquanto estava aberto (`fichas.ts:369-404`, `:462-468`, `:1023`).
4. **Pedir itens à Ordem (celular):** fechar a janela regrava a mochila de quando abriu, sem o item que o colega entregou (`jogador.ts:535-543`, `fichaCelular.ts:205-215`).
5. **VOCÊ EVOLUIU** usa o `r` clonado quando a lista foi desenhada (`fichaCelular.ts:97-129`).
6. **Recusa do servidor trava o celular:** o servidor responde só `error`, a cópia local fica com a mudança recusada e cada toque seguinte é recusado de novo (`hotel.ts:1476/1480/1487`).
7. **Reconexão:** o que o jogador fez com o socket caído vai na fila antes do login e o servidor descarta (`net.ts:14-17`, `hotel.ts:2333`). Sem ping nem `visibilitychange`. O log mostra os celulares reconectando muitas vezes.

**Conserto de raiz:** o jogador e as janelas mandam só o que mudou (um patch por campo, ou `vitais`/`mochila` já existentes), não a ficha inteira; ou o servidor junta por campo com a versão (`atualizadaEm`).

## Grupo B — segredo do mestre vazando (segurança/spoiler) — **consertado em 27/10**

**O conserto:** a mesa e o jogador recebem só o nome da campanha (`campanhaPublica`); a sessão deles vai sem a descrição das cenas e sem as ameaças das salas onde não há agente; a lista de salas só com a cena de agora; `peek` só do mestre; os móveis sem os testes (DT) e sem o `trancado`; o combate da mesa sem o `ciente` e os `massivos`. No `fichaSalvar` do jogador ficam as condições, os bônus do interlúdio, o "achado" e as melhorias de cada item como estavam, e item do catálogo que não estava na mochila (inclusive a troca de um por outro) só na base. O registro (`events`) continua indo para a mesa: é do contrato (`CONTRATO.md`) e fala do que aconteceu na frente dos jogadores.

8. ✔ **A mesa e qualquer jogador recebem o `campaign` do mestre:** as anotações da planta (`notas`), a descrição de todas as cenas, o registro (com DT e "senha certa") e todas as peças de todas as salas, inclusive ameaças em salas não visitadas. O JSON é um só por grupo de cenas, igual para mestre e jogador (`hotel.ts:1813-1832`, `:1687`). A mesa entra sem senha e o túnel da Cloudflare aponta para essa porta: quem tem o link lê tudo no DevTools.
9. **O jogador passa por cima do mestre pelo `fichaSalvar`** (mensagem montada à mão): `bonus` do interlúdio, tirar condições que o mestre marcou, `achado: true` para fugir da patente, trocar faca por fuzil fora da base, modificações sem checagem (`hotel.ts:1457-1486`).
10. **Móveis e combate:** os testes com DT, `trancado` e as peças dentro da névoa vão para o cliente da mesa (`roomInstance.ts:719-735`); a visão de combate da mesa leva nomes de ameaças ainda escondidas e quem será surpreendido (`turnos.ts:1188`); `peek` sem checagem de papel (`hotel.ts:2398`).

## Grupo C — COMBATE — **consertado em 27/10** (menos o 17)

**O conserto:** quem entra com a vez parada faz a rodada andar; a tela acha a ação nova pela última linha do registro, não pela contagem; atrasar empatado com o próximo aceita a mesma Iniciativa; a ação nova `lote` junta as que andam juntas (Levantar, Deitar, Apagar as chamas, Primeiros socorros, Acalmar, usar habilidade): passam todas ou nenhuma, e o Desfazer volta todas; Sacar e Guardar pela tela de Item vão pelo `declarar` (`sacar`, `guardar`), e o Desfazer devolve a mochila; a Investida pede o turno inteiro livre, como o servidor; o Desfazer devolve os PV pela diferença e a pilha zera ao abrir um combate novo; o texto do Desarmar não manda mais tirar o item à mão. **Ficou como está, o 17:** as fichas de NPC são da Ordem (Miguel, Agatha, Rosa...), que lutam do lado dos agentes; tratar como inimigo erraria mais vezes.

11. ✔ **Combate trava:** todos fora → "Pôr no combate" não chama `proximo()`; a vez fica nula e passar/atacar recusam para sempre (`turnos.ts:965-988`).
12. ✔ **Registro preso em 400 linhas:** depois disso, confirmar um ataque não volta ao menu nem limpa o alvo (`combate.ts:957-962`, `turnos.ts:28`).
13. **Duas mensagens soltas onde deveria ser uma:** Levantar tira o "caído" mesmo com a ação recusada; Primeiros socorros/Acalmar dão 1 PV/SAN mesmo recusados; Sacar/Guardar pela tela de Item não volta no Desfazer (`combate.ts:2137`, `:2786`, `:839-858`).
14. **Atrasar com Iniciativa empatada:** o valor sugerido é sempre recusado (`combate.ts:3944`, `turnos.ts:855`).
15. **Investida:** o Confirmar libera sem a ação de movimento, o servidor recusa, e o cartão já zerou o que foi digitado (`combateAtaque.ts:649`, `:714`).
16. **Desfazer** é por campanha e não limpa ao fechar o combate: pode voltar PV de um combate antigo por cima da cura (`hotel.ts:811-829`).
17. **NPC com ficha entra como Agente** (`hotel.ts:364`, não filtra `npc`).
18. **Desarmar:** o texto manda tirar o item à mão, mas o servidor já tira (`combateManobra.ts:450`).

## Grupo D — MAPA

19. ✔ **Guardar móvel (Delete, sem confirmação) apaga o que ele tinha:** itens dentro, pista, senha, destino da passagem, fechadura. Volta um móvel novo (`roomInstance.ts:1345-1362`).
20. **Atalhos do tabuleiro valem em qualquer aba:** na FICHAS, Delete guarda o móvel ainda escolhido, T troca a câmera da mesa, 1-9 troca a peça (`main.ts:708-761`).
21. ✔ **AMPLIAR e ESCONDER acendem e apagam a cada atualização** (`shell.ts:768`: os dois têm a classe `bv` sem `data-tatico`).
22. **ESCONDER a mesa não sobrevive a recarregar** (mesa nem mestre): o estado não vai no `roomEnter`. Igual para a câmera do mestre (`camMestre`) e o zoom da tática, que não chegam à mesa que reconecta.
23. **Agachar, subir no beliche, Editar ou trocar aparência fecha o painel da peça** (o servidor manda sair/entrar; `RoomView.ts:889`).
24. ✔ **Item posto num móvel nunca é revelado:** nasce escondido e nenhuma tela manda `lootReveal` (o servidor trata); no COMBATE o "Pegar" também não aparece.
25. Menores: a dica do Abrir invertida na porteira (`shell.ts:2662`); objetivo recusado sem aviso (`hotel.ts:1908`); o mapa-múndi deixa um ouvinte a cada vez que abre (`mapaMundi.ts:299`).

## Grupo E — FICHAS

26. ✔ **Componentes ritualísticos sem escolha de elemento** desde a troca de nomes de 25/10: `/\(Elemento\)/` não tem `i` (`requisicao.ts:142`). O item entra sem elemento.
27. **"Adicionar mesmo assim" por carga:** o servidor recusa (`naoCabe`), a janela mostra como adicionado (`hotel.ts:1243`).
28. **"Na mão" na ficha** não passa pelo limite das duas mãos (`fichas.ts:1878`).
29. **Ficha nova duplicada** com dois cliques em Salvar (`fichas.ts:462-478`); criar ficha num aparelho de mestre apaga o rascunho de ficha nova do outro.
30. **Item largado antes de 25/10** volta com o nome antigo como apelido (`itens.ts:53`, comparação sensível a maiúsculas).

## Grupo F — celular do jogador (tela)

31. **A janela EQUIPAMENTO reabre e se empilha** a cada `fichas` (no combate, a cada 300 ms) enquanto `refazerEquipamento` estiver ligado (`fichaCelular.ts:197-218`).
32. **Não-piscar:** PV, PE, SAN e a ficha inteira do celular são refeitos a cada `fichas` (`jogador.ts:342-389`, `fichaCelular.ts:234`); o toque pode se perder. A Identificação da FICHAS do mestre também (`fichas.ts:297`).
33. **"Pedir itens à Ordem"** não acompanha a peça entre cenas (`naBase` só no envio de fichas).
34. **Páginas em imagem dos documentos** pequenas (`jogador.css:1992`, 40vh sem ampliar).
35. **O mestre não abre a tela do jogador no mesmo navegador** (o nome da conta já está em uso): é o motivo do "não conferido" de 24/10, não um defeito da aba Docs.

## Código morto (sem efeito na tela)

`chat`/`action` (o `hud.ts` e o `infostand.ts` não são criados), `walk`, `lookAt`, `tokenFace`, `layoutSet`, `capacitySet`, `scenes`, `userLook`, `client/src/ui/minimap.ts`. O registro do combate "na ordem trocada" (EM-ABERTO, 09/10) já foi feito em 17/10: o mais novo em cima, linha por linha.
