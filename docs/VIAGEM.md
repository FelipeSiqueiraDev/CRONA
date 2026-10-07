# A Viagem (07/10/2026)

Pedido do Felipe: uma opção **VIAGEM** para levar os agentes de um lugar a outro (da Sede à Fazenda, a qualquer cena) numa
**van preta** numa estradinha. O mestre escolhe em que banco cada um senta; a van fica **parada** na tela e o **mundo de fora
se mexe**; fica nessa tela até o mestre decidir chegar. Dá para fazer cenas de viagem ilustradas.

## Como usa o mestre

1. No MAPA, o botão **VIAGEM** (ao lado de Apontar, Desenhar e Mapa) abre a janela de partir:
   - à esquerda, os agentes; no meio, a van vista de cima (a frente à direita) com os 8 bancos: toque num agente e depois no banco
     (ou toque num banco ocupado para pegar o agente e pôr em outro); "Preencher na ordem" põe todos de uma vez;
   - à direita, o cenário (rodovia ou estrada de terra), a hora (dia, entardecer, noite), a velocidade e o texto do destino.
2. **Partir:** os agentes vão para os bancos, o mestre e a mesa entram na cena da viagem.
3. Dentro da viagem, o painel no alto do tabuleiro muda a **velocidade** (parada, devagar, normal, correndo), a **hora**, o
   **cenário** e o **destino** (o texto aparece numa faixa no alto, para a mesa também). Os agentes são peças comuns: dá para
   trocar de banco clicando em outro, falar, ter o combate dentro da van.
4. **Chegamos…** escolhe a cena de chegada: todos descem na porta dela e a viagem acaba; a van fica pronta para a próxima.

## Como funciona

- A viagem é uma **cena** (`RoomData.viagem`, `ViagemInfo` em `shared/src/viagem.ts`): ao ar livre (`aberto`), o chão é só o piso
  da van (8 × 3 casas), com os bancos (`van_seat`, 8), o console e o painel (`van_console`, `van_dash`) como móveis. Ela pertence à
  campanha de onde partiu (`origem`; `sceneGroup` liga as duas) e **fica fora da planta** (`SceneInfo.viagem`).
- **Servidor** (`hotel.ts`: `viagemIniciar`, `viagemAjustar`, `viagemChegar`; só o mestre):
  - `iniciar` cria a cena (uma por campanha, reaproveitada) e leva cada peça para o banco escolhido (`BANCOS_VAN`);
  - `ajustar` muda cenário, hora, velocidade e destino (a hora muda o escuro e a cor do ambiente da cena);
  - `chegar` leva todos à cena de destino. **Se a cena é de outra campanha** (a Fazenda), as peças de lá com o mesmo personagem
    saem e o grupo da viagem toma o lugar (sem Tepes repetido).
- **Cliente:** `render/viagemMundo.ts` desenha o mundo em três passadas (o chão, a estrada e o que passa lá no fundo; o casco da
  van atrás das peças; a beirada e o que passa de perto na frente). O mundo anda pela `velocidade` (suavizada: a van arranca e
  para devagar) e a van balança de leve. `ui/viagem.ts` tem a janela de partir, a de chegada e o painel. A câmera abre mais longe
  nas cenas de viagem (o mundo precisa aparecer em volta).
- Tudo é desenhado **em código** por enquanto; a arte do Códex entra pelo `PROMPT-VIAGEM.txt` (a van cortada com as janelas
  vazadas, o banco, o painel, o asfalto, as árvores, os carros e 10 ilustrações).

## O que vem depois

- A arte da van, do asfalto e dos veículos (pedido feito); trocar o desenho em código por ela.
- O botão **Ilustração** (mostrar à mesa uma das 10 pinturas de cena por cima da tela) e a chuva.
- O combate dentro da van (as celas e a cobertura já valem; falta o mapa tático dela).
- Outros veículos e cenários (cidade, túnel).
