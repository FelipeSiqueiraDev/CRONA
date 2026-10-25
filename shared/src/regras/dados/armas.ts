// Armas (LR cap. 3): Tab. 3.3 nas pp. 56–57, descrições nas pp. 58–59 e o
// quadro de arma improvisada e ataque desarmado na p. 57. Mais as armas do
// Sobrevivendo ao Horror (Tab. 1.4, SaH p. 38; descrições na p. 37). A página
// de cada arma é a da tabela. Os números foram conferidos coluna a coluna na
// imagem das duas tabelas e com as descrições (o C.R.I.S só serviu de guia).
//
// - Sem crítico impresso, vale 20/x2. Arma corpo a corpo com alcance é
//   arremessável; sem alcance, arremessá-la é em alcance curto com −5 (p. 55).
// - Dano com as duas mãos (bastão, espada) fica em `especial` ("duas mãos: 1d8").
// - Sem proficiência: −2d20 no ataque (p. 54).
import type { Arma } from '../tipos';

const LR = (pagina: number) => ({ fonte: 'LR' as const, pagina });
const SAH = (pagina: number) => ({ fonte: 'SaH' as const, pagina });
/** crítico: margem de ameaça e multiplicador */
const crit = (margem: number, multiplicador: number) => ({ margem, multiplicador });

export const ARMAS: Arma[] = [
  // ===== Armas simples (p. 56) =====
  // corpo a corpo, leves. Coronhada: a tabela não dá categoria nem espaço (é a própria arma de fogo).
  { id: 'coronhada', nome: 'Coronhada', ref: LR(56), categoria: 0, proficiencia: 'simples', tipo: 'corpoACorpo', empunhadura: 'leve', dano: '1d4', critico: crit(20, 2), tipoDano: ['impacto'], espacos: 0,
    especial: ['usa a arma de fogo empunhada (sem categoria nem espaço próprios)', 'arma de fogo de duas mãos: 1d6'],
    resumo: 'Golpe dado com a própria arma de fogo: 1d4 com arma leve ou de uma mão, 1d6 com arma de duas mãos.' },
  { id: 'faca', nome: 'Faca', ref: LR(56), categoria: 0, proficiencia: 'simples', tipo: 'corpoACorpo', empunhadura: 'leve', dano: '1d4', critico: crit(19, 2), alcance: 'curto', tipoDano: ['corte'], espacos: 1, agil: true,
    especial: ['arremessável', 'faca de cozinha pequena: 1d3'],
    resumo: 'De navalha a faca de combate. Ágil e pode ser arremessada; uma faquinha de cozinha causa só 1d3.' },
  { id: 'martelo', nome: 'Martelo', ref: LR(56), categoria: 0, proficiencia: 'simples', tipo: 'corpoACorpo', empunhadura: 'leve', dano: '1d6', critico: crit(20, 2), tipoDano: ['impacto'], espacos: 1,
    resumo: 'Ferramenta de casa que serve de arma quando não há coisa melhor.' },
  { id: 'punhal', nome: 'Punhal', ref: LR(56), categoria: 0, proficiencia: 'simples', tipo: 'corpoACorpo', empunhadura: 'leve', dano: '1d4', critico: crit(20, 3), tipoDano: ['perfuracao'], espacos: 1, agil: true,
    resumo: 'Faca de lâmina longa e pontuda, a preferida dos cultistas em rituais. Ágil.' },
  // corpo a corpo, uma mão
  { id: 'bastao', nome: 'Bastão', ref: LR(56), categoria: 0, proficiencia: 'simples', tipo: 'corpoACorpo', empunhadura: 'umaMao', dano: '1d6', critico: crit(20, 2), tipoDano: ['impacto'], espacos: 1,
    especial: ['duas mãos: 1d8'],
    resumo: 'Taco, cassetete, tonfa ou clava com pregos. 1d6 com uma mão; 1d8 segurando com as duas.' },
  { id: 'machete', nome: 'Machete', ref: LR(56), categoria: 0, proficiencia: 'simples', tipo: 'corpoACorpo', empunhadura: 'umaMao', dano: '1d6', critico: crit(19, 2), tipoDano: ['corte'], espacos: 1,
    resumo: 'O facão de abrir trilha no mato.' },
  { id: 'lanca', nome: 'Lança', ref: LR(56), categoria: 0, proficiencia: 'simples', tipo: 'corpoACorpo', empunhadura: 'umaMao', dano: '1d6', critico: crit(20, 2), alcance: 'curto', tipoDano: ['perfuracao'], espacos: 1,
    especial: ['arremessável'],
    resumo: 'Haste com ponta de metal, arma antiga que artistas marciais ainda usam. Pode ser arremessada.' },
  // corpo a corpo, duas mãos. A tabela imprime 1d6/1d6: as duas pontas.
  { id: 'cajado', nome: 'Cajado', ref: LR(56), categoria: 0, proficiencia: 'simples', tipo: 'corpoACorpo', empunhadura: 'duasMaos', dano: '1d6', critico: crit(20, 2), tipoDano: ['impacto'], espacos: 2, agil: true,
    especial: ['Combater com Duas Armas (e poderes parecidos): conta como uma arma de uma mão e uma arma leve (1d6/1d6)'],
    resumo: 'Vara longa de madeira ou barra de ferro, como o bo. Ágil; com Combater com Duas Armas, cada ponta conta como uma arma.' },
  // disparo, duas mãos
  { id: 'arco', nome: 'Arco', ref: LR(56), categoria: 0, proficiencia: 'simples', tipo: 'disparo', empunhadura: 'duasMaos', dano: '1d6', critico: crit(20, 3), alcance: 'medio', tipoDano: ['perfuracao'], espacos: 2, municao: 'flechas',
    resumo: 'O arco e flecha comum, de tiro ao alvo.' },
  { id: 'besta', nome: 'Besta', ref: LR(56), categoria: 0, proficiencia: 'simples', tipo: 'disparo', empunhadura: 'duasMaos', dano: '1d8', critico: crit(19, 2), alcance: 'medio', tipoDano: ['perfuracao'], espacos: 2, municao: 'flechas',
    especial: ['recarga: ação de movimento a cada disparo'],
    resumo: 'Arma de disparo antiga; recarregar a cada tiro custa uma ação de movimento.' },
  // fogo, leves
  { id: 'pistola', nome: 'Pistola', ref: LR(56), categoria: 1, proficiencia: 'simples', tipo: 'fogo', empunhadura: 'leve', dano: '1d12', critico: crit(18, 2), alcance: 'curto', tipoDano: ['balistico'], espacos: 1, municao: 'balas-curtas',
    especial: ['capacidade 12 (contagem de munição, p. 174)'],
    resumo: 'Arma curta de polícia e de militares; recarrega com rapidez.' },
  { id: 'revolver', nome: 'Revólver', ref: LR(56), categoria: 1, proficiencia: 'simples', tipo: 'fogo', empunhadura: 'leve', dano: '2d6', critico: crit(19, 3), alcance: 'curto', tipoDano: ['balistico'], espacos: 1, municao: 'balas-curtas',
    especial: ['capacidade 6 (contagem de munição, p. 174)'],
    resumo: 'Arma de fogo muito comum e de grande confiança.' },
  // fogo, duas mãos
  { id: 'fuzil-de-caca', nome: 'Fuzil de caça', ref: LR(56), categoria: 1, proficiencia: 'simples', tipo: 'fogo', empunhadura: 'duasMaos', dano: '2d8', critico: crit(19, 3), alcance: 'medio', tipoDano: ['balistico'], espacos: 2, municao: 'balas-longas',
    especial: ['capacidade 4 (contagem de munição, p. 174)'],
    resumo: 'Fuzil comum no campo, na caça e no tiro esportivo.' },

  // ===== Armas táticas (pp. 56–57) =====
  // corpo a corpo, leves
  { id: 'machadinha', nome: 'Machadinha', ref: LR(56), categoria: 0, proficiencia: 'tatica', tipo: 'corpoACorpo', empunhadura: 'leve', dano: '1d6', critico: crit(20, 3), alcance: 'curto', tipoDano: ['corte'], espacos: 1,
    especial: ['arremessável'],
    resumo: 'Machado pequeno de rachar lenha, fácil de achar em obras e fazendas. Pode ser arremessada.' },
  { id: 'nunchaku', nome: 'Nunchaku', ref: LR(56), categoria: 0, proficiencia: 'tatica', tipo: 'corpoACorpo', empunhadura: 'leve', dano: '1d8', critico: crit(20, 2), tipoDano: ['impacto'], espacos: 1, agil: true,
    resumo: 'Par de bastões curtos unidos por corrente, de artes marciais. Ágil.' },
  // corpo a corpo, uma mão
  { id: 'corrente', nome: 'Corrente', ref: LR(56), categoria: 0, proficiencia: 'tatica', tipo: 'corpoACorpo', empunhadura: 'umaMao', dano: '1d8', critico: crit(20, 2), tipoDano: ['impacto'], espacos: 1,
    especial: ['+2 nos testes para desarmar e derrubar'],
    resumo: 'Um trecho de corrente pesada. Dá +2 nos testes para desarmar e derrubar.' },
  { id: 'espada', nome: 'Espada', ref: LR(56), categoria: 1, proficiencia: 'tatica', tipo: 'corpoACorpo', empunhadura: 'umaMao', dano: '1d8', critico: crit(19, 2), tipoDano: ['corte'], espacos: 1,
    especial: ['duas mãos: 1d10'],
    resumo: 'Espada medieval, da espada longa à cimitarra. 1d8 com uma mão; 1d10 com as duas.' },
  // tipo C como na tabela (não perfuração)
  { id: 'florete', nome: 'Florete', ref: LR(56), categoria: 1, proficiencia: 'tatica', tipo: 'corpoACorpo', empunhadura: 'umaMao', dano: '1d6', critico: crit(18, 2), tipoDano: ['corte'], espacos: 1, agil: true,
    resumo: 'Espada fina e comprida, de esgrima. Ágil.' },
  { id: 'machado', nome: 'Machado', ref: LR(56), categoria: 1, proficiencia: 'tatica', tipo: 'corpoACorpo', empunhadura: 'umaMao', dano: '1d8', critico: crit(20, 3), tipoDano: ['corte'], espacos: 1,
    resumo: 'Ferramenta de lenhador e de bombeiro que abre feridas feias.' },
  { id: 'maca', nome: 'Maça', ref: LR(56), categoria: 1, proficiencia: 'tatica', tipo: 'corpoACorpo', empunhadura: 'umaMao', dano: '2d4', critico: crit(20, 2), tipoDano: ['impacto'], espacos: 1,
    resumo: 'Clava com cabeça de metal cravejada.' },
  // corpo a corpo, duas mãos
  { id: 'acha', nome: 'Acha', ref: LR(57), categoria: 1, proficiencia: 'tatica', tipo: 'corpoACorpo', empunhadura: 'duasMaos', dano: '1d12', critico: crit(20, 3), tipoDano: ['corte'], espacos: 2,
    resumo: 'Machadão de lenhador, para árvores de tronco grosso.' },
  { id: 'gadanho', nome: 'Gadanho', ref: LR(57), categoria: 1, proficiencia: 'tatica', tipo: 'corpoACorpo', empunhadura: 'duasMaos', dano: '2d4', critico: crit(20, 4), tipoDano: ['corte'], espacos: 2,
    resumo: 'Foice grande de duas mãos, feita para ceifar a colheita.' },
  { id: 'katana', nome: 'Katana', ref: LR(57), categoria: 1, proficiencia: 'tatica', tipo: 'corpoACorpo', empunhadura: 'duasMaos', dano: '1d10', critico: crit(19, 2), tipoDano: ['corte'], espacos: 2, agil: true,
    especial: ['veterano em Luta: pode usar com uma mão'],
    resumo: 'Espada longa japonesa de lâmina um pouco curva. Ágil; quem é veterano em Luta pode usá-la com uma mão.' },
  { id: 'marreta', nome: 'Marreta', ref: LR(57), categoria: 1, proficiencia: 'tatica', tipo: 'corpoACorpo', empunhadura: 'duasMaos', dano: '3d4', critico: crit(20, 2), tipoDano: ['impacto'], espacos: 2,
    especial: ['mesmos números para picaretas e outras ferramentas de obra'],
    resumo: 'Ferramenta de demolição. Os mesmos números valem para picaretas e outras ferramentas de obra.' },
  { id: 'montante', nome: 'Montante', ref: LR(57), categoria: 1, proficiencia: 'tatica', tipo: 'corpoACorpo', empunhadura: 'duasMaos', dano: '2d6', critico: crit(19, 2), tipoDano: ['corte'], espacos: 2,
    resumo: 'Espadão de cerca de 1,5 m, das armas mais fortes de sua época.' },
  // nome da tabela; a descrição escreve "Motoserra" e o texto, "motosserra"
  { id: 'moto-serra', nome: 'Moto-serra', ref: LR(57), categoria: 1, proficiencia: 'tatica', tipo: 'corpoACorpo', empunhadura: 'duasMaos', dano: '3d6', critico: crit(20, 2), tipoDano: ['corte'], espacos: 2, bonusAtaque: -2,
    especial: ['−2 nos testes de ataque', 'cada 6 num dado de dano: role mais um dado', 'ligar: ação de movimento'],
    resumo: 'Ferramenta motorizada e desajeitada: −2 no ataque, e cada 6 no dano rola mais um dado. Ligá-la custa uma ação de movimento.' },
  // disparo, duas mãos
  { id: 'arco-composto', nome: 'Arco composto', ref: LR(57), categoria: 1, proficiencia: 'tatica', tipo: 'disparo', empunhadura: 'duasMaos', dano: '1d10', critico: crit(20, 3), alcance: 'medio', tipoDano: ['perfuracao'], espacos: 2, municao: 'flechas', somaForca: true,
    especial: ['soma Força no dano'],
    resumo: 'Arco moderno de roldanas e materiais de alta tensão. Diferente das outras armas de disparo, soma a Força no dano.' },
  { id: 'balestra', nome: 'Balestra', ref: LR(57), categoria: 1, proficiencia: 'tatica', tipo: 'disparo', empunhadura: 'duasMaos', dano: '1d12', critico: crit(19, 2), alcance: 'medio', tipoDano: ['perfuracao'], espacos: 2, municao: 'flechas',
    especial: ['recarga: ação de movimento a cada disparo'],
    resumo: 'Besta pesada, de tiro potente; recarregar a cada disparo custa uma ação de movimento.' },
  // fogo, uma mão
  { id: 'submetralhadora', nome: 'Submetralhadora', ref: LR(57), categoria: 1, proficiencia: 'tatica', tipo: 'fogo', empunhadura: 'umaMao', dano: '2d6', critico: crit(19, 3), alcance: 'curto', tipoDano: ['balistico'], espacos: 1, automatica: true, municao: 'balas-curtas',
    especial: ['rajada', 'capacidade 20 (contagem de munição, p. 174)'],
    resumo: 'Arma de fogo automática que dá para usar com uma só mão.' },
  // fogo, duas mãos
  { id: 'espingarda', nome: 'Espingarda', ref: LR(57), categoria: 1, proficiencia: 'tatica', tipo: 'fogo', empunhadura: 'duasMaos', dano: '4d6', critico: crit(20, 3), alcance: 'curto', tipoDano: ['balistico'], espacos: 2, municao: 'cartuchos',
    especial: ['metade do dano em alcance médio ou maior', 'capacidade 6 (contagem de munição, p. 174)'],
    resumo: 'Arma de fogo longa de cano liso. Em alcance médio ou além, o dano cai pela metade.' },
  { id: 'fuzil-de-assalto', nome: 'Fuzil de assalto', ref: LR(57), categoria: 2, proficiencia: 'tatica', tipo: 'fogo', empunhadura: 'duasMaos', dano: '2d10', critico: crit(19, 3), alcance: 'medio', tipoDano: ['balistico'], espacos: 2, automatica: true, municao: 'balas-longas',
    especial: ['rajada', 'capacidade 30 (contagem de munição, p. 174)'],
    resumo: 'O fuzil padrão da maioria dos exércitos atuais. Automático.' },
  { id: 'fuzil-de-precisao', nome: 'Fuzil de precisão', ref: LR(57), categoria: 3, proficiencia: 'tatica', tipo: 'fogo', empunhadura: 'duasMaos', dano: '2d10', critico: crit(19, 3), alcance: 'longo', tipoDano: ['balistico'], espacos: 2, municao: 'balas-longas',
    especial: ['veterano em Pontaria que mira (ação mirar, p. 87): +5 na margem de ameaça', 'capacidade 1 (contagem de munição, p. 174)'],
    resumo: 'Fuzil militar para tiros longos. Veterano em Pontaria que usa a ação mirar ganha +5 na margem de ameaça.' },

  // ===== Armas pesadas (p. 57): à distância, duas mãos =====
  // a tabela só diz "à distância"; ficam como armas de fogo (usam munição e não somam atributo)
  { id: 'bazuca', nome: 'Bazuca', ref: LR(57), categoria: 3, proficiencia: 'pesada', tipo: 'fogo', empunhadura: 'duasMaos', dano: '10d8', critico: crit(20, 2), alcance: 'medio', tipoDano: ['impacto'], espacos: 2, municao: 'foguete',
    especial: ['atinge também todos a até 3 m do alvo; esses fazem Reflexos (DT Agi) para metade', 'pode mirar um ponto em alcance médio: não rola ataque nem erra, mas não acerta ninguém em cheio', 'recarga: ação de movimento a cada disparo'],
    resumo: 'Lança-foguetes antitanque que também funciona contra criaturas: fere o alvo e quem estiver a até 3 m dele.' },
  { id: 'lanca-chamas', nome: 'Lança-chamas', ref: LR(57), categoria: 3, proficiencia: 'pesada', tipo: 'fogo', empunhadura: 'duasMaos', dano: '6d6', critico: crit(20, 2), alcance: 'curto', tipoDano: ['fogo'], espacos: 2, municao: 'combustivel',
    especial: ['linha de 1,5 m de largura até o alcance curto (não passa dele)', 'um só teste de ataque contra a Defesa de cada ser na linha', 'quem é atingido fica em chamas'],
    resumo: 'Esguicha líquido inflamável numa linha até alcance curto: um só ataque contra todos na linha, e quem é atingido pega fogo.' },
  { id: 'metralhadora', nome: 'Metralhadora', ref: LR(57), categoria: 2, proficiencia: 'pesada', tipo: 'fogo', empunhadura: 'duasMaos', dano: '2d12', critico: crit(19, 3), alcance: 'medio', tipoDano: ['balistico'], espacos: 2, automatica: true, municao: 'balas-longas', forcaMinima: { forca: 4, bonus: -5, nota: 'apoiada no tripé (ação de movimento), sem o −5' },
    especial: ['rajada', '−5 nos ataques, a menos que tenha Força 4 ou mais ou a apoie no tripé (ação de movimento)', 'capacidade 50 (contagem de munição, p. 174)'],
    resumo: 'Arma de fogo pesada e automática, de uso militar. Sem Força 4 nem apoio no tripé, −5 nos ataques.' },

  // ===== Quadro da p. 57 =====
  // O livro não dá o tipo de dano destes dois; fica impacto (como no C.R.I.S).
  { id: 'ataque-desarmado', nome: 'Ataque desarmado', ref: LR(57), categoria: 0, proficiencia: 'simples', tipo: 'corpoACorpo', empunhadura: 'leve', dano: '1d3', critico: crit(20, 2), tipoDano: ['impacto'], espacos: 0,
    especial: ['não letal', 'letal com −5 no ataque (p. 88)', 'efeitos que falam de objetos ou armas não valem nele'],
    resumo: 'Soco, chute ou outro golpe: conta como arma leve de 1d3, não letal. Efeitos que falam de armas ou objetos não valem nele.' },
  { id: 'arma-improvisada', nome: 'Arma improvisada', ref: LR(57), categoria: 0, proficiencia: 'simples', tipo: 'corpoACorpo', empunhadura: 'umaMao', dano: '1d6', critico: crit(20, 2), tipoDano: ['impacto'], espacos: 1, penalidadeAtaque: -1,
    especial: ['−1d20 no teste de ataque', 'o mestre pode mudar os números e o tipo de dano'],
    resumo: 'Objeto que não foi feito para lutar, como cadeira ou panela: arma de uma mão de 1d6, com −1d20 no ataque.' },

  // ===== Sobrevivendo ao Horror (Tab. 1.4, SaH p. 38; descrições na p. 37) =====
  // Capacidade na contagem de munição: quadro "Sobrevivência e munição" (SaH p. 38).
  // simples
  { id: 'pregador-pneumatico', nome: 'Pregador pneumático', ref: SAH(38), categoria: 0, proficiencia: 'simples', tipo: 'disparo', empunhadura: 'umaMao', dano: '1d4', critico: crit(20, 4), alcance: 'curto', tipoDano: ['perfuracao'], espacos: 1,
    especial: ['conta como arma de fogo para poderes', 'rolo de 300 pregos dura a missão'] },
  { id: 'estilingue', nome: 'Estilingue', ref: SAH(38), categoria: 0, proficiencia: 'simples', tipo: 'disparo', empunhadura: 'duasMaos', dano: '1d4', critico: crit(20, 2), alcance: 'curto', tipoDano: ['impacto'], espacos: 1, municao: 'bolinhas', somaForca: true,
    especial: ['soma Força no dano', 'lança granadas em alcance longo'] },
  // tipo P como impresso na Tab. 1.4 (conferido na página; não é B)
  { id: 'revolver-compacto', nome: 'Revólver compacto', ref: SAH(38), categoria: 1, proficiencia: 'simples', tipo: 'fogo', empunhadura: 'leve', dano: '2d4', critico: crit(19, 3), alcance: 'curto', tipoDano: ['perfuracao'], espacos: 1, municao: 'balas-curtas',
    especial: ['treinado em Crime: não ocupa espaço', 'capacidade 5 (contagem de munição, LR p. 174)'] },
  // táticas. Baioneta: números dela solta; acoplada, muda (ver especial).
  { id: 'baioneta', nome: 'Baioneta', ref: SAH(38), categoria: 0, proficiencia: 'tatica', tipo: 'corpoACorpo', empunhadura: 'leve', dano: '1d4', critico: crit(19, 2), tipoDano: ['perfuracao'], espacos: 1,
    especial: ['acoplada a arma de fogo de duas mãos (ação de movimento): duas mãos, ágil, 1d6', 'acoplada: −1d20 nos disparos da arma de fogo'] },
  { id: 'faca-tatica', nome: 'Faca tática', ref: SAH(38), categoria: 1, proficiencia: 'tatica', tipo: 'corpoACorpo', empunhadura: 'leve', dano: '1d6', critico: crit(19, 2), alcance: 'curto', tipoDano: ['corte'], espacos: 1, agil: true,
    especial: ['arremessável', 'contra-ataque: +2 no ataque', 'bloqueio: 2 PE e sacrifica a faca para +20 na RD'] },
  { id: 'gancho-de-carne', nome: 'Gancho de carne', ref: SAH(38), categoria: 0, proficiencia: 'tatica', tipo: 'corpoACorpo', empunhadura: 'leve', dano: '1d4', critico: crit(20, 4), tipoDano: ['perfuracao'], espacos: 1,
    especial: ['preso a corda ou corrente: alcance 4,5 m e 2 espaços'] },
  // a Tab. 1.4 imprime alcance curto (conferido; o C.R.I.S tira, porque o texto não fala em arremesso)
  { id: 'bastao-policial', nome: 'Bastão policial', ref: SAH(38), categoria: 1, proficiencia: 'tatica', tipo: 'corpoACorpo', empunhadura: 'umaMao', dano: '1d6', critico: crit(20, 2), alcance: 'curto', tipoDano: ['impacto'], espacos: 1, agil: true,
    especial: ['esquiva empunhando: +1 no bônus de Defesa', 'alcance curto impresso na tabela; o texto não fala em arremesso'] },
  { id: 'picareta', nome: 'Picareta', ref: SAH(38), categoria: 0, proficiencia: 'tatica', tipo: 'corpoACorpo', empunhadura: 'umaMao', dano: '1d6', critico: crit(20, 4), tipoDano: ['perfuracao'], espacos: 1,
    especial: ['sem o SaH, a picareta usa os números da marreta (LR p. 59)'] },
  // a tabela não dá empunhadura; lançada com uma mão
  { id: 'shuriken', nome: 'Shuriken', ref: SAH(38), categoria: 1, proficiencia: 'tatica', tipo: 'arremesso', empunhadura: 'leve', dano: '1d4', critico: crit(20, 2), alcance: 'curto', tipoDano: ['perfuracao'], espacos: 0.5,
    especial: ['cada shuriken é um pacote para 2 cenas', 'com a contagem de munição (LR p. 174), cada shuriken vale 10', 'veterano em Pontaria: 1x/rodada, 1 PE para outro ataque de shuriken no mesmo alvo'] },
  { id: 'pistola-pesada', nome: 'Pistola pesada', ref: SAH(38), categoria: 1, proficiencia: 'tatica', tipo: 'fogo', empunhadura: 'umaMao', dano: '2d8', critico: crit(18, 2), alcance: 'curto', tipoDano: ['balistico'], espacos: 1, municao: 'balas-curtas', penalidadeAtaque: -1,
    especial: ['−1d20 no ataque, anulado empunhando com as duas mãos', 'capacidade 10 (contagem de munição, LR p. 174)'] },
  { id: 'espingarda-cano-duplo', nome: 'Espingarda de cano duplo', ref: SAH(38), categoria: 2, proficiencia: 'tatica', tipo: 'fogo', empunhadura: 'duasMaos', dano: '4d6', critico: crit(20, 3), alcance: 'curto', tipoDano: ['balistico'], espacos: 2, municao: 'cartuchos',
    especial: ['1 cartucho por cano; recarregar os dois: ação de movimento', 'os dois canos no mesmo alvo: −1d20 no ataque e dano 6d6', 'capacidade 2 (contagem de munição, LR p. 174)'] },
];
