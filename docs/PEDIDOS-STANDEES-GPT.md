# Pedidos de arte dos standees dos agentes (para o ChatGPT comum ou o Gemini)

O Códex de linha de comando parou (a conta Pro acabou). Estes pedidos são para colar à mão no **ChatGPT comum** (ou no **Gemini**, que também gera imagem e costuma ter mais cota grátis). Cada pedido é uma **folha de poses** do mesmo personagem, para a identidade sair igual em todas, e eu recorto as poses depois.

## Como usar (por agente)

1. Abra um chat **novo** (um por agente; fique no mesmo chat para as duas folhas dele).
2. Anexe a **foto do agente** (o caminho está em cada bloco abaixo) e cole o **texto de estilo** + o **bloco do agente** + o **bloco da folha**.
3. Peça uma folha por vez. Se vier errada (rosto diferente, fundo com cenário, pose faltando), responda dizendo só o que corrigir ("o rosto está diferente da foto", "tire a sombra do chão") sem recomeçar.
4. Salve cada resultado, sem editar, em `F:\Dhellow\CRONA\arte\PERSONAGENS-ANIMACAO\trabalho\standee-nexus\entregas\` com o nome `<agente>-folha-A.png` e `<agente>-folha-B.png` (agente = `tepes`, `catarina`, `alosi`, `cora`).
5. Me avise: eu recorto cada pose (fundo magenta sai limpo), confiro, instalo `standee-<pose>.png` na pasta do personagem e ligo no protótipo 3D.

## Texto de estilo (cole sempre, no começo)

> Ilustração de personagem de RPG de terror investigativo, pintura digital semi-realista de **corpo inteiro**, no estilo de personagens de **Ordem Paranormal** e de miniaturas ilustradas (standee) de mesa virtual: proporção de pessoa real (cerca de 7,5 cabeças), nada de chibi nem cabeçudo, traço firme, cores quentes um pouco dessaturadas, sombra suave pintada na própria roupa. **O personagem é EXATAMENTE o da foto anexada** (rosto, cabelo, roupa, cores, acessórios). Luz uniforme de frente e de cima, **sem sombra projetada no chão, sem reflexo de chão, sem brilho estourado**, sem cenário, sem moldura, **sem nenhum texto**, sem símbolo oficial. **Fundo magenta puro #FF00FF liso**, sem degradê. Cada pose inteira, da cabeça aos pés, sem cortar nada, com folga entre elas, todas na mesma escala e viradas de frente (levemente em três quartos).

## Os quatro agentes

### D.Tepes — foto: `client/public/arte/personagens/tepes/foto-ficha.webp`
Homem alto de barba, cabelo castanho comprido e despenteado, trench coat de couro marrom, camisa escura, calça escura, sapato oxford preto. Arma: **a corrente** (corrente de aço pesada enrolada na mão).

### Catarina Albuquerque — foto: `client/public/arte/personagens/catarina/foto-ficha.webp`
Mulher de cabelo ruivo preso em rabo de cavalo, olhos verdes, jaqueta escura sobre camisa preta, cinto com coldres de coxa, calça escura, botas de combate. Arma: **a katana** (na bainha às costas quando desarmada; empunhada, desembainhada, quando armada).

### Alosi Walker — foto: `client/public/arte/personagens/alosi/foto-ficha.webp`
Rapaz de cabelo castanho ondulado, óculos redondos de aro marrom, crucifixo dourado, camisa branca de colarinho clerical, casaco branco com capuz e zíper dourado, cinto com corrente, calça preta, sapato preto. Objeto de combate: **o grimório** (livro marrom com um símbolo de sol dourado na capa; fechado debaixo do braço quando desarmado; aberto numa mão, com um brilho dourado fraco, quando "armado").

### Cora Falcão — foto: `client/public/arte/personagens/cora-falcao/foto-ficha.webp` (se não existir, use `folha.webp` da mesma pasta ou a imagem do Cora do `_marcados_fotos.jpg`)
Mulher de cabelo curto branco-prateado, camisa preta justa, plaquetas de identificação no peito, mochila com o **fuzil de caça** às costas, calça cargo escura com bolsos, botas de combate. Arma: **o fuzil de caça** (nas costas quando desarmada; nas mãos, em posição de tiro, quando armada).

## Folha A (três poses altas, lado a lado)

> Uma folha com **TRÊS poses** do personagem, lado a lado, da esquerda para a direita:
> 1. **DESARMADO**, em pé, relaxado e atento, peso numa perna, mãos soltas ou uma no bolso;
> 2. **ARMADO**, em pé, em guarda, com a arma dele na mão (conforme o bloco do personagem), olhar firme;
> 3. **MACHUCADO**, em pé mas ferido: curvado, uma mão no abdômen, roupa rasgada e manchada de sangue, cabelo bagunçado, expressão de dor.
> Formato horizontal 1536x1024. Todas do mesmo tamanho, com folga entre elas.

## Folha B (duas poses baixas, lado a lado)

> Uma folha com **DUAS poses** do personagem, lado a lado:
> 1. **AGACHADO** (de cócoras, furtivo, atrás de cobertura), com a arma na mão, olhando à frente;
> 2. **CAÍDO**, deitado no chão de costas ou de lado, desacordado (morrendo), um braço estendido, roupa manchada de sangue, **visto de cima em três quartos** (como a cena é vista na mesa, câmera 45° acima).
> Formato horizontal 1536x1024. As duas na mesma escala das da Folha A.

## Depois (eu)

- Recorte por cor (magenta), contorno limpo, escala igual entre as poses, pés alinhados na base, `standee-desarmado.png`, `standee-armado.png`, `standee-machucado.png`, `standee-agachado.png` e `standee-caido.png` em cada pasta do personagem.
- Ligar a troca de pose no protótipo 3D (armado, machucado pela vida, caído no chão) e conferir nos prints.
- O Blender fica para os guias de pose, se a pose sair torta em alguma folha: um boneco cinza na pose certa, anexado ao pedido.
