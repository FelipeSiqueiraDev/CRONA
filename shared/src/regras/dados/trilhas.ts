// Trilhas de Ordem Paranormal RPG: cinco por classe no livro de regras (LR
// p. 26–27, 30–31 e 34–35) e três por classe no Sobrevivendo ao Horror (SaH
// p. 15–29). Cada trilha tem quatro habilidades, em NEX 10%, 40%, 65% e 99%.
// O SaH veio do C.R.I.S e foi conferido nas imagens das páginas do livro
// (nomes, NEX, custos, escolhas, efeitos e páginas). As trilhas da classe
// Sobrevivente (SaH p. 31–32) ficam de fora: não são de classe de agente e
// sobem por estágio, não por NEX.
//
// Resumos com nossas palavras só no LR (conteúdo aberto). O SaH fica com nome,
// números, página e notas curtas do que muda na ficha. O que depende do
// elemento leva `soElemento` (uma nota ou efeito por elemento; vale só o da
// ficha): no Monstruoso, o escolhido em Ser Amaldiçoado; em Tornamo-nos Um, o
// da afinidade.
import type { Trilha } from '../tipos';

const LR = (pagina: number) => ({ fonte: 'LR' as const, pagina });
const SAH = (pagina: number) => ({ fonte: 'SaH' as const, pagina });

const ESTUDADO = 'contra o ser estudado: +1 por pista estudada, até o fim da missão';
const PRESA = 'contra seres do tipo escolhido como presa';
const SOMBRAS = 'por uma rodada, pagando 2 PE';

export const TRILHAS: Trilha[] = [
  // ================= combatente (LR p. 26–27) =================
  {
    id: 'aniquilador',
    nome: 'Aniquilador',
    ref: LR(26),
    classe: 'combatente',
    resumo: 'Dedica-se a uma arma favorita, que fica mais fácil de levar e ganha técnicas pagas em PE para ferir mais e melhor.',
    habilidades: [
      { id: 'a-favorita', nome: 'A Favorita', ref: LR(26), nex: 10, escolha: { tipo: 'arma' }, resumo: 'Você elege uma arma como favorita; para você, ela conta uma categoria abaixo (−I).', efeitos: [{ alvo: 'categoria', item: 'favorita', valor: 1 }] },
      {
        id: 'tecnica-secreta', nome: 'Técnica Secreta', ref: LR(26), nex: 40, custoPe: 2,
        resumo: 'A favorita vai a −II. Atacando com ela, 2 PE por efeito: Amplo (atinge também um alvo adjacente ao original) ou Destruidor (+1 no multiplicador).',
        efeitos: [{ alvo: 'categoria', item: 'favorita', valor: 2 }, { alvo: 'multiplicador', escopo: 'favorita', valor: 1, condicional: 'efeito Destruidor da Técnica Secreta (2 PE)' }],
      },
      {
        id: 'tecnica-sublime', nome: 'Técnica Sublime', ref: LR(26), nex: 65,
        resumo: 'A favorita vai a −III e a Técnica Secreta ganha Letal (+2 na margem; escolhido duas vezes, +5) e Perfurante (ignora até 5 de RD).',
        efeitos: [{ alvo: 'categoria', item: 'favorita', valor: 3 }, { alvo: 'margem', escopo: 'favorita', valor: 2, condicional: 'efeito Letal da Técnica Secreta (2 PE); escolhido duas vezes, +5' }],
      },
      {
        id: 'maquina-de-matar', nome: 'Máquina de Matar', ref: LR(26), nex: 99,
        resumo: 'A favorita vai a −IV, ganha +2 na margem de ameaça e seu dano sobe um passo.',
        efeitos: [{ alvo: 'categoria', item: 'favorita', valor: 4 }, { alvo: 'margem', escopo: 'favorita', valor: 2 }, { alvo: 'nota', texto: 'O dano da arma favorita sobe um passo.' }],
      },
    ],
  },
  {
    id: 'comandante-de-campo',
    nome: 'Comandante de Campo',
    ref: LR(26),
    classe: 'combatente',
    resumo: 'Coordena o grupo em combate: dá novas rolagens e ações extras aos aliados e abre brechas para ataques combinados.',
    habilidades: [
      { id: 'inspirar-confianca', nome: 'Inspirar Confiança', ref: LR(27), nex: 10, custoPe: 2, resumo: 'Reação e 2 PE: um aliado em alcance curto rola de novo um teste que acabou de fazer.' },
      { id: 'estrategista', nome: 'Estrategista', ref: LR(27), nex: 40, custoPe: 1, resumo: 'Ação padrão e 1 PE por aliado em alcance curto (até seu Intelecto): no próximo turno, cada um tem uma ação de movimento a mais.' },
      { id: 'brecha-na-guarda', nome: 'Brecha na Guarda', ref: LR(27), nex: 65, custoPe: 2, resumo: 'Aliado fere inimigo no seu alcance curto (1×/rodada): reação e 2 PE para você ou outro aliado atacá-lo. Inspirar Confiança e Estrategista passam a médio.' },
      { id: 'oficial-comandante', nome: 'Oficial Comandante', ref: LR(27), nex: 99, custoPe: 5, resumo: 'Ação padrão e 5 PE: cada aliado que você vê em alcance médio ganha uma ação padrão extra no próximo turno dele.' },
    ],
  },
  {
    id: 'guerreiro',
    nome: 'Guerreiro',
    ref: LR(27),
    classe: 'combatente',
    resumo: 'Luta corpo a corpo: amplia a margem de ameaça, contra-ataca ao bloquear, derruba ou empurra e dobra o Ataque Especial.',
    habilidades: [
      { id: 'tecnica-letal', nome: 'Técnica Letal', ref: LR(27), nex: 10, resumo: '+2 na margem de ameaça de todos os seus ataques corpo a corpo.', efeitos: [{ alvo: 'margem', escopo: 'corpoACorpo', valor: 2 }] },
      { id: 'revidar', nome: 'Revidar', ref: LR(27), nex: 40, custoPe: 2, resumo: 'Depois de bloquear, reação e 2 PE para atacar corpo a corpo quem o atacou.' },
      { id: 'forca-opressora', nome: 'Força Opressora', ref: LR(27), nex: 65, custoPe: 1, resumo: 'Ao acertar corpo a corpo, 1 PE: derrubar ou empurrar como ação livre (+5 no empurrão por 10 de dano; derrubando, +1 PE dá outro ataque).' },
      { id: 'potencia-maxima', nome: 'Potência Máxima', ref: LR(27), nex: 99, resumo: 'Com arma corpo a corpo, todos os bônus numéricos do seu Ataque Especial dobram.', efeitos: [{ alvo: 'nota', texto: 'Ataque Especial com arma corpo a corpo: bônus numéricos dobrados.' }] },
    ],
  },
  {
    id: 'operacoes-especiais',
    nome: 'Operações Especiais',
    ref: LR(27),
    classe: 'combatente',
    resumo: 'Age cedo e mais vezes: bônus em Iniciativa, ataques e ações adicionais pagos em PE e ação padrão extra no começo do combate.',
    habilidades: [
      { id: 'iniciativa-aprimorada', nome: 'Iniciativa Aprimorada', ref: LR(27), nex: 10, resumo: '+5 em Iniciativa e uma ação de movimento extra na primeira rodada.', efeitos: [{ alvo: 'pericia', pericia: 'iniciativa', valor: 5 }] },
      { id: 'ataque-extra', nome: 'Ataque Extra', ref: LR(27), nex: 40, custoPe: 2, resumo: '1×/rodada, ao atacar, gasta 2 PE para fazer mais um ataque.' },
      { id: 'surto-de-adrenalina', nome: 'Surto de Adrenalina', ref: LR(27), nex: 65, custoPe: 5, resumo: '1×/rodada, 5 PE compram uma ação padrão ou de movimento a mais.' },
      { id: 'sempre-alerta', nome: 'Sempre Alerta', ref: LR(27), nex: 99, resumo: 'No início de toda cena de combate, ganha uma ação padrão extra.' },
    ],
  },
  {
    id: 'tropa-de-choque',
    nome: 'Tropa de Choque',
    ref: LR(27),
    classe: 'combatente',
    resumo: 'Aguenta pancada: mais PV, obriga inimigos a atacá-lo, reduz dano à metade e fica mais resistente quando ferido.',
    habilidades: [
      {
        id: 'casca-grossa', nome: 'Casca Grossa', ref: LR(27), nex: 10,
        resumo: '+1 PV a cada 5% de NEX; ao bloquear, soma seu Vigor à RD do bloqueio.',
        efeitos: [{ alvo: 'pv', porNex: 1 }, { alvo: 'resistencia', dano: 'todos', valor: 'vig', condicional: 'ao bloquear (soma na RD do bloqueio)' }],
      },
      { id: 'cai-dentro', nome: 'Cai Dentro', ref: LR(27), nex: 40, custoPe: 1, resumo: 'Inimigo em alcance curto ataca aliado: reação e 1 PE para Vontade (DT Vig); falhando, ele ataca você, se puder. Passando, fica imune na cena.' },
      { id: 'duro-de-matar', nome: 'Duro de Matar', ref: LR(27), nex: 65, custoPe: 2, resumo: 'Reação e 2 PE para reduzir à metade um dano não paranormal; a partir de NEX 85%, também dano paranormal.' },
      {
        id: 'inquebravel', nome: 'Inquebrável', ref: LR(27), nex: 99,
        resumo: 'Machucado: +10 na Defesa e RD 5. Morrendo: não fica indefeso e continua agindo, mas as regras de morte seguem valendo.',
        efeitos: [{ alvo: 'defesa', valor: 10, condicional: 'enquanto machucado' }, { alvo: 'resistencia', dano: 'todos', valor: 5, condicional: 'enquanto machucado' }],
      },
    ],
  },

  // ================= combatente (SaH p. 15–21) =================
  {
    id: 'agente-secreto',
    nome: 'Agente Secreto',
    ref: SAH(15),
    classe: 'combatente',
    habilidades: [
      {
        id: 'carteirada', nome: 'Carteirada', ref: SAH(15), nex: 10, escolha: { tipo: 'pericia', de: ['diplomacia', 'enganacao'] },
        efeitos: [{ alvo: 'treino', pericia: 'escolhida', seJa: 2 }, { alvo: 'nota', texto: 'Documentos com privilégios a cada missão: itens operacionais que não ocupam espaço.' }],
      },
      { id: 'o-sorriso', nome: 'O Sorriso', ref: SAH(16), nex: 40, custoPe: 2, efeitos: [{ alvo: 'pericia', pericia: 'diplomacia', valor: 2 }, { alvo: 'pericia', pericia: 'enganacao', valor: 2 }] },
      { id: 'metodo-investigativo', nome: 'Método Investigativo', ref: SAH(16), nex: 65, custoPe: 2, efeitos: [{ alvo: 'nota', texto: 'Urgência das cenas de investigação +1 rodada.' }] },
      { id: 'multifacetado', nome: 'Multifacetado', ref: SAH(16), nex: 99, efeitos: [{ alvo: 'nota', texto: 'Custa 5 SAN, que só voltam no fim da missão.' }] },
    ],
  },
  {
    id: 'cacador',
    nome: 'Caçador',
    ref: SAH(16),
    classe: 'combatente',
    habilidades: [
      {
        id: 'rastrear-o-paranormal', nome: 'Rastrear o Paranormal', ref: SAH(16), nex: 10,
        efeitos: [
          { alvo: 'treino', pericia: 'sobrevivencia', seJa: 2 },
          { alvo: 'nota', texto: 'Sobrevivência no lugar de Ocultismo para identificar criaturas e de Investigação e Percepção para rastros, pistas e criaturas paranormais.' },
        ],
      },
      { id: 'estudar-fraquezas', nome: 'Estudar Fraquezas', ref: SAH(16), nex: 40, efeitos: [{ alvo: 'pericia', pericia: 'todas', valor: 1, condicional: ESTUDADO }, { alvo: 'ataque', escopo: 'todos', valor: 1, condicional: ESTUDADO }] },
      { id: 'atacar-das-sombras', nome: 'Atacar das Sombras', ref: SAH(17), nex: 65, efeitos: [{ alvo: 'nota', texto: 'Furtividade: sem −1d20 por mover no deslocamento normal; com arma silenciosa, atacar dá só −1d20; visibilidade inicial 1 abaixo.' }] },
      {
        id: 'estudar-a-presa', nome: 'Estudar a Presa', ref: SAH(17), nex: 99,
        efeitos: [
          { alvo: 'pericia', pericia: 'todas', dados: 1, condicional: PRESA },
          { alvo: 'ataque', escopo: 'todos', dados: 1, condicional: PRESA },
          { alvo: 'margem', escopo: 'todos', valor: 1, condicional: PRESA },
          { alvo: 'multiplicador', escopo: 'todos', valor: 1, condicional: PRESA },
          { alvo: 'resistencia', dano: 'todos', valor: 5, condicional: PRESA },
        ],
      },
    ],
  },
  {
    id: 'monstruoso',
    nome: 'Monstruoso',
    ref: SAH(17),
    classe: 'combatente',
    // A Progressão de NEX (SaH p. 99): o Monstruoso recebe as alterações gerais do NEX que tem (SaH p. 17). Sem trilha, sem alteração.
    alteracoes: [
      {
        id: 'alteracao-nex-25', nome: 'Alteração de NEX 25%', ref: SAH(99), nex: 25,
        escolha: { tipo: 'pericia', qtd: 1, de: ['diplomacia', 'enganacao', 'intimidacao'] },
        efeitos: [
          { alvo: 'treino', pericia: 'ocultismo', seJa: 2 },
          { alvo: 'pericia', pericia: 'escolhida', valor: -5 },
          { alvo: 'nota', texto: 'Testa Ocultismo mesmo sem treino; se treinado, +2. Em troca, −5 numa perícia à escolha entre Diplomacia, Enganação ou Intimidação (alteração física ou mental da exposição).' },
        ],
      },
      {
        id: 'alteracao-nex-35-pe', nome: 'Alteração de NEX 35% (PE)', ref: SAH(99), nex: 35,
        escolha: { tipo: 'atributo', de: ['agi', 'for', 'int', 'vig'] },
        efeitos: [
          { alvo: 'pe', atributoEscolhido: true },
          { alvo: 'nota', texto: 'Soma um atributo à escolha (menos Presença) no total de PE; o corpo resiste aos comandos do cérebro (o −5 numa perícia vem na outra alteração de NEX 35%).' },
        ],
      },
      {
        id: 'alteracao-nex-35-pericia', nome: 'Alteração de NEX 35% (perícia)', ref: SAH(99), nex: 35,
        escolha: { tipo: 'pericia', qtd: 1, de: ['atletismo', 'fortitude', 'reflexos'] },
        efeitos: [
          { alvo: 'pericia', pericia: 'escolhida', valor: -5 },
          { alvo: 'nota', texto: 'Em troca do atributo nos PE, −5 numa perícia à escolha entre Atletismo, Fortitude ou Reflexos.' },
        ],
      },
    ],
    habilidades: [
      {
        id: 'ser-amaldicoado', nome: 'Ser Amaldiçoado', ref: SAH(17), nex: 10, escolha: { tipo: 'elemento', de: ['sangue', 'morte', 'conhecimento', 'energia'] },
        efeitos: [
          { alvo: 'treino', pericia: 'ocultismo', seJa: 2 },
          { alvo: 'nota', texto: 'Especial: a trilha usa a Progressão de NEX da regra opcional Nível de Experiência (SaH p. 98; alterações nas p. 99–103), mesmo sem essa regra. As alterações gerais de NEX 25% e 35% entram nas contas (aba Evolução); as de 50% em diante, e as do elemento (60% em diante), ficam com o mestre. Afinidade, se tiver, com o elemento escolhido.' },
          { alvo: 'nota', texto: 'Etapa ritualística do elemento 1×/dia (o mestre marca "Cumpriu" no painel PLAYERS); sem ela, fome e sede no dia. Cumprida, vale até o fim do dia o efeito do elemento.' },
          { alvo: 'nota', etapa: 'sem', texto: 'Sem a etapa ritualística hoje: fome e sede (SaH p. 17), e nada do efeito do elemento.' },
          // com a etapa cumprida (19/10: os números entram nas contas; o resto fica escrito)
          { alvo: 'resistencia', dano: 'balistico', valor: 5, soElemento: 'sangue', etapa: 'com' },
          { alvo: 'resistencia', dano: 'sangue', valor: 5, soElemento: 'sangue', etapa: 'com' },
          { alvo: 'pericia', pericia: 'ciencias', dados: -1, soElemento: 'sangue', etapa: 'com' },
          { alvo: 'pericia', pericia: 'intuicao', dados: -1, soElemento: 'sangue', etapa: 'com' },
          { alvo: 'nota', soElemento: 'sangue', etapa: 'com', texto: 'Sangue, com a etapa: faro e +Vigor no dano do contra-ataque (RD 5 a balístico e Sangue e −1d20 em Ciências e Intuição já nas contas).' },
          { alvo: 'resistencia', dano: 'perfuracao', valor: 5, soElemento: 'morte', etapa: 'com' },
          { alvo: 'resistencia', dano: 'morte', valor: 5, soElemento: 'morte', etapa: 'com' },
          { alvo: 'pv', valor: 'for', soElemento: 'morte', etapa: 'com' },
          { alvo: 'pericia', pericia: 'diplomacia', dados: -1, soElemento: 'morte', etapa: 'com' },
          { alvo: 'pericia', pericia: 'enganacao', dados: -1, soElemento: 'morte', etapa: 'com' },
          { alvo: 'nota', soElemento: 'morte', etapa: 'com', texto: 'Morte, com a etapa: imune a fadiga (RD 5 a perfuração e Morte, +Força nos PV e −1d20 em Diplomacia e Enganação já nas contas).' },
          { alvo: 'resistencia', dano: 'balistico', valor: 5, soElemento: 'conhecimento', etapa: 'com' },
          { alvo: 'resistencia', dano: 'conhecimento', valor: 5, soElemento: 'conhecimento', etapa: 'com' },
          { alvo: 'defesa', valor: 'int', soElemento: 'conhecimento', etapa: 'com' },
          { alvo: 'pericia', pericia: 'atletismo', dados: -1, soElemento: 'conhecimento', etapa: 'com' },
          { alvo: 'pericia', pericia: 'acrobacia', dados: -1, soElemento: 'conhecimento', etapa: 'com' },
          { alvo: 'nota', soElemento: 'conhecimento', etapa: 'com', texto: 'Conhecimento, com a etapa: visão no escuro (RD 5 a balístico e Conhecimento, +Intelecto na Defesa e −1d20 em Atletismo e Acrobacia já nas contas).' },
          { alvo: 'resistencia', dano: 'corte', valor: 5, soElemento: 'energia', etapa: 'com' },
          { alvo: 'resistencia', dano: 'eletricidade', valor: 5, soElemento: 'energia', etapa: 'com' },
          { alvo: 'resistencia', dano: 'fogo', valor: 5, soElemento: 'energia', etapa: 'com' },
          { alvo: 'resistencia', dano: 'energia', valor: 5, soElemento: 'energia', etapa: 'com' },
          { alvo: 'pericia', pericia: 'investigacao', dados: -1, soElemento: 'energia', etapa: 'com' },
          { alvo: 'pericia', pericia: 'percepcao', dados: -1, soElemento: 'energia', etapa: 'com' },
          { alvo: 'nota', soElemento: 'energia', etapa: 'com', texto: 'Energia, com a etapa: +Agilidade na RD do bloqueio (RD 5 a corte, eletricidade, fogo e Energia e −1d20 em Investigação e Percepção já nas contas).' },
        ],
      },
      {
        id: 'ser-macabro', nome: 'Ser Macabro', ref: SAH(18), nex: 40,
        efeitos: [
          { alvo: 'nota', texto: 'Com a etapa, a RD do elemento sobe para 10 e a penalidade para −2d20.' },
          { alvo: 'nota', soElemento: 'sangue', texto: 'Sangue, com a etapa: Força no lugar de Presença para os PE; ação de movimento e até Força PE para curar 1d8 PV por PE.' },
          { alvo: 'nota', soElemento: 'morte', texto: 'Morte, com a etapa: +1d20 em Intimidação; Vigor no lugar de Presença para os PE; só morre ao iniciar 4 turnos morrendo na cena; não precisa comer nem beber.' },
          { alvo: 'nota', soElemento: 'conhecimento', texto: 'Conhecimento, com a etapa: Intelecto +1; Intelecto no lugar de Presença em Enganação e nos PE.' },
          { alvo: 'nota', soElemento: 'energia', texto: 'Energia, com a etapa: Agilidade no lugar de Presença para os PE; ao acertar corpo a corpo, até Agilidade PE para +1d6 de dano de Energia por PE.' },
        ],
      },
      {
        id: 'ser-assustador', nome: 'Ser Assustador', ref: SAH(19), nex: 65,
        efeitos: [
          { alvo: 'atributo', atributo: 'pre', valor: -1 },
          { alvo: 'nota', texto: 'Com a etapa, a RD do elemento sobe para 15. Em NEX 75%: perturbado para sempre e banido pela Ordem (SaH p. 21).' },
          { alvo: 'nota', soElemento: 'sangue', texto: 'Sangue, com a etapa: 50% de chance de ignorar o dano extra de crítico ou ataque furtivo; mordida (1d8, x2, perfuração) e, 1×/rodada ao agredir, 1 PE para atacar com ela.' },
          { alvo: 'nota', soElemento: 'morte', texto: 'Morte, com a etapa: morrendo, Vigor DT 15 no início do turno para acordar com 1 PV; +2 PE ao fazer crítico ou levar inimigo a 0 PV.' },
          { alvo: 'nota', soElemento: 'conhecimento', texto: 'Conhecimento, com a etapa: pode perder o treino de uma perícia por dados de bônus iguais ao Intelecto (+1d20 num teste cada, até o fim da cena).' },
          { alvo: 'nota', soElemento: 'energia', texto: 'Energia, com a etapa: a RD vale também contra químico; ação de movimento tocando fonte elétrica: 1d4, 2d4 ou 4d4 PE.' },
        ],
      },
      {
        id: 'ser-aterrorizante', nome: 'Ser Aterrorizante', ref: SAH(20), nex: 99,
        // o ritual depende do elemento (ver as notas); Conhecimento escolhe um de 4º círculo
        concedeRituais: { escolha: { tipo: 'ritual', qtd: 1, circuloMax: 4 } },
        efeitos: [
          { alvo: 'nota', texto: 'Os efeitos da etapa ficam permanentes (ela ainda evita fome e sede); conta como criatura paranormal; RD do elemento 20. O que dá para calcular (RD, atributos, Defesa, PV, atributo dos PE) já entra nas contas; bônus e penalidades em d20 seguem nas notas.' },
          // a etapa (NEX 10, 40 e 65%) vira permanente: o que o Efeito calcula entra nas contas
          { alvo: 'resistencia', soElemento: 'sangue', dano: 'balistico', valor: 20 },
          { alvo: 'resistencia', soElemento: 'sangue', dano: 'sangue', valor: 20 },
          { alvo: 'atributoPe', soElemento: 'sangue', atributo: 'for' },
          // Morte: a RD a Morte fica sem uso (imune a dano de Morte, ver a nota)
          { alvo: 'resistencia', soElemento: 'morte', dano: 'perfuracao', valor: 20 },
          { alvo: 'pv', soElemento: 'morte', valor: 'for' },
          { alvo: 'atributoPe', soElemento: 'morte', atributo: 'vig' },
          { alvo: 'resistencia', soElemento: 'conhecimento', dano: 'balistico', valor: 20 },
          { alvo: 'resistencia', soElemento: 'conhecimento', dano: 'conhecimento', valor: 20 },
          { alvo: 'defesa', soElemento: 'conhecimento', valor: 'int' },
          // o Intelecto +1 de Ser Macabro (com a etapa) fica permanente, além do +1 abaixo
          { alvo: 'atributo', soElemento: 'conhecimento', atributo: 'int', valor: 1 },
          { alvo: 'atributoPericia', soElemento: 'conhecimento', pericia: 'enganacao', atributo: 'int' },
          { alvo: 'atributoPe', soElemento: 'conhecimento', atributo: 'int' },
          // Energia: químico entra em Ser Assustador
          { alvo: 'resistencia', soElemento: 'energia', dano: 'corte', valor: 20 },
          { alvo: 'resistencia', soElemento: 'energia', dano: 'eletricidade', valor: 20 },
          { alvo: 'resistencia', soElemento: 'energia', dano: 'fogo', valor: 20 },
          { alvo: 'resistencia', soElemento: 'energia', dano: 'energia', valor: 20 },
          { alvo: 'resistencia', soElemento: 'energia', dano: 'quimico', valor: 20 },
          { alvo: 'atributoPe', soElemento: 'energia', atributo: 'agi' },
          { alvo: 'nota', texto: 'Monstruosa Transformação (SaH p. 21): Sanidade reduzida a 1; enlouquecendo, fica confuso em vez de sofrer insanidade; se enlouquecer, vira criatura do Outro Lado.' },
          { alvo: 'nota', soElemento: 'sangue', texto: 'Sangue: Intelecto −1 e Força +1; mordida cura 5 PV; ritual Forma Monstruosa (ao sofrer dano, Vontade DT 10 + dano).' },
          { alvo: 'nota', soElemento: 'morte', texto: 'Morte: Presença −1 e Vigor +1; imune a dano de Morte; volta à vida no dia seguinte, salvo se levado a 0 PV por fogo ou Energia; ritual Fim Inevitável.' },
          { alvo: 'nota', soElemento: 'conhecimento', texto: 'Conhecimento: Força −1 e Intelecto +1; Percepção às Cegas; um ritual de Conhecimento de 4º círculo à escolha.' },
          { alvo: 'nota', soElemento: 'energia', texto: 'Energia: Força −1 e Agilidade +1; paira com deslocamento 12 m; imune a paralisia física; ritual Deflagração de Energia; sem bônus de itens vestidos.' },
          { alvo: 'atributo', soElemento: 'sangue', atributo: 'int', valor: -1 },
          { alvo: 'atributo', soElemento: 'sangue', atributo: 'for', valor: 1 },
          { alvo: 'atributo', soElemento: 'morte', atributo: 'pre', valor: -1 },
          { alvo: 'atributo', soElemento: 'morte', atributo: 'vig', valor: 1 },
          { alvo: 'atributo', soElemento: 'conhecimento', atributo: 'for', valor: -1 },
          { alvo: 'atributo', soElemento: 'conhecimento', atributo: 'int', valor: 1 },
          { alvo: 'atributo', soElemento: 'energia', atributo: 'for', valor: -1 },
          { alvo: 'atributo', soElemento: 'energia', atributo: 'agi', valor: 1 },
        ],
      },
    ],
  },

  // ================= especialista (LR p. 30–31) =================
  {
    id: 'atirador-de-elite',
    nome: 'Atirador de Elite',
    ref: LR(30),
    classe: 'especialista',
    resumo: 'Atira de longe com armas de balas longas: Intelecto no dano, crítico mais fácil ao mirar, manobras à distância e dano máximo no crítico.',
    habilidades: [
      {
        id: 'mira-de-elite', nome: 'Mira de Elite', ref: LR(30), nex: 10,
        resumo: 'Proficiência com armas de fogo de balas longas e Intelecto somado ao dano delas.',
        efeitos: [{ alvo: 'proficiencia', proficiencia: 'armasFogoBalasLongas' }, { alvo: 'dano', escopo: 'balasLongas', valor: 'int' }],
      },
      {
        id: 'disparo-letal', nome: 'Disparo Letal', ref: LR(30), nex: 40, custoPe: 1,
        resumo: 'Ao mirar, 1 PE dá +2 na margem de ameaça do próximo ataque até o fim do seu próximo turno.',
        efeitos: [{ alvo: 'margem', escopo: 'todos', valor: 2, condicional: 'próximo ataque depois de mirar (1 PE), até o fim do seu próximo turno' }],
      },
      { id: 'disparo-impactante', nome: 'Disparo Impactante', ref: LR(30), nex: 65, custoPe: 2, resumo: 'Com arma de fogo de calibre grosso, 2 PE permitem derrubar, desarmar, empurrar ou quebrar com um ataque à distância.' },
      { id: 'atirar-para-matar', nome: 'Atirar para Matar', ref: LR(30), nex: 99, resumo: 'Crítico com arma de fogo causa o dano máximo, sem rolar os dados.' },
    ],
  },
  {
    id: 'infiltrador',
    nome: 'Infiltrador',
    ref: LR(30),
    classe: 'especialista',
    resumo: 'Ataca sem ser visto: dano extra contra alvos desprevenidos, bônus em Atletismo e Crime, golpes que incapacitam e furtividade mesmo depois de atacar.',
    habilidades: [
      { id: 'ataque-furtivo', nome: 'Ataque Furtivo', ref: LR(30), nex: 10, custoPe: 1, resumo: '1×/rodada, 1 PE: +1d6 de dano contra alvo desprevenido (corpo a corpo ou alcance curto) ou flanqueado; 2d6 em NEX 40%, 3d6 em 65%, 4d6 em 99%.' },
      {
        id: 'gatuno', nome: 'Gatuno', ref: LR(30), nex: 40,
        resumo: '+5 em Atletismo e Crime; pode se esconder andando o deslocamento normal, sem penalidade.',
        efeitos: [{ alvo: 'pericia', pericia: 'atletismo', valor: 5 }, { alvo: 'pericia', pericia: 'crime', valor: 5 }],
      },
      { id: 'assassinar', nome: 'Assassinar', ref: LR(30), nex: 65, custoPe: 3, resumo: 'Movimento e 3 PE: o próximo Ataque Furtivo num alvo em alcance curto dobra os dados extras e o deixa inconsciente ou morrendo (Fortitude DT Agi evita).' },
      { id: 'sombra-fugaz', nome: 'Sombra Fugaz', ref: LR(30), nex: 99, custoPe: 3, resumo: '3 PE evitam o −15 em Furtividade depois de atacar ou fazer algo chamativo.' },
    ],
  },
  {
    id: 'medico-de-campo',
    nome: 'Médico de Campo',
    ref: LR(31),
    classe: 'especialista',
    requisitos: [{ tipo: 'pericia', pericia: 'medicina' }],
    resumo: 'Socorrista do grupo (exige Medicina treinada): cura PV, remove condições, protege quem atende e reanima quem morreu na cena.',
    habilidades: [
      { id: 'paramedico', nome: 'Paramédico', ref: LR(31), nex: 10, custoPe: 2, resumo: 'Ação padrão e 2 PE curam 2d10 PV de aliado adjacente; NEX 40%, 65% e 99% liberam, cada um, +1d10 por +1 PE.' },
      { id: 'equipe-de-trauma', nome: 'Equipe de Trauma', ref: LR(31), nex: 40, custoPe: 2, resumo: 'Ação padrão e 2 PE tiram uma condição negativa (menos morrendo) de um aliado adjacente.' },
      {
        id: 'resgate', nome: 'Resgate', ref: LR(31), nex: 65,
        resumo: '1×/rodada, alcança com ação livre um aliado machucado ou morrendo em alcance curto; ao tratá-lo, ambos ganham +5 na Defesa. Carregar alguém pesa metade.',
        efeitos: [{ alvo: 'defesa', valor: 5, condicional: 'depois de curar PV ou remover condição de um aliado (você e ele, até o início do seu próximo turno)' }],
      },
      { id: 'reanimacao', nome: 'Reanimação', ref: LR(31), nex: 99, custoPe: 10, resumo: '1×/cena, ação completa e 10 PE trazem de volta à vida quem morreu nesta cena (exceto por dano massivo).' },
    ],
  },
  {
    id: 'negociador',
    nome: 'Negociador',
    ref: LR(31),
    classe: 'especialista',
    resumo: 'Resolve pela palavra: fascina ouvintes, motiva o grupo, recorre a contatos e imita habilidades que viu aliados usarem.',
    habilidades: [
      { id: 'eloquencia', nome: 'Eloquência', ref: LR(31), nex: 10, custoPe: 1, resumo: 'Ação completa e 1 PE por alvo em alcance curto: Diplomacia, Enganação ou Intimidação contra Vontade; quem perde fica fascinado enquanto você se concentra.' },
      {
        id: 'discurso-motivador', nome: 'Discurso Motivador', ref: LR(31), nex: 40, custoPe: 4,
        resumo: 'Ação padrão e 4 PE: você e aliados em alcance curto têm +1d20 em perícias na cena; a partir de NEX 65%, 8 PE dão +2d20.',
        efeitos: [{ alvo: 'pericia', pericia: 'todas', dados: 1, condicional: 'Discurso Motivador ativo, até o fim da cena (NEX 65%: 8 PE para +2d20)' }],
      },
      { id: 'eu-conheco-um-cara', nome: 'Eu Conheço um Cara', ref: LR(31), nex: 65, resumo: '1×/missão, recorre aos contatos por um favor (reequipar o grupo, abrigo, resgate); o mestre decide o que dá para conseguir.' },
      { id: 'truque-de-mestre', nome: 'Truque de Mestre', ref: LR(31), nex: 99, custoPe: 5, resumo: '5 PE para reproduzir uma habilidade que viu um aliado usar na cena, ignorando pré-requisitos mas pagando todos os custos.' },
    ],
  },
  {
    id: 'tecnico',
    nome: 'Técnico',
    ref: LR(31),
    classe: 'especialista',
    resumo: 'Cuida do equipamento: carrega mais somando o Intelecto, conserta e improvisa itens e sempre acha o que precisa na bolsa.',
    habilidades: [
      { id: 'inventario-otimizado', nome: 'Inventário Otimizado', ref: LR(31), nex: 10, resumo: 'Seu inventário é calculado com Força + Intelecto (Força 1 e Intelecto 3 dão 20 espaços).', efeitos: [{ alvo: 'cargaAtributos', atributos: ['for', 'int'] }] },
      {
        id: 'remendao', nome: 'Remendão', ref: LR(31), nex: 40, custoPe: 1,
        resumo: 'Ação completa e 1 PE: um equipamento adjacente deixa de estar quebrado até o fim da cena. Equipamentos de investigação contam −I de categoria para você.',
        efeitos: [{ alvo: 'nota', texto: 'Equipamentos de investigação contam uma categoria abaixo (−I).' }],
      },
      { id: 'improvisar', nome: 'Improvisar', ref: LR(31), nex: 65, custoPe: 2, resumo: 'Ação completa e 2 PE, mais 2 PE por categoria: monta com o que houver um equipamento de investigação que funciona até o fim da cena.' },
      { id: 'preparado-para-tudo', nome: 'Preparado para Tudo', ref: LR(31), nex: 99, custoPe: 3, resumo: 'Ação de movimento e 3 PE por categoria: você acha na bolsa o item de que precisa (exceto armas).' },
    ],
  },

  // ================= especialista (SaH p. 23–25) =================
  {
    id: 'bibliotecario',
    nome: 'Bibliotecário',
    ref: SAH(23),
    classe: 'especialista',
    habilidades: [
      { id: 'conhecimento-pratico', nome: 'Conhecimento Prático', ref: SAH(23), nex: 10, custoPe: 2, efeitos: [{ alvo: 'nota', texto: 'Com o poder Conhecimento Aplicado: em vez disso, o custo dele cai 1 PE.' }] },
      { id: 'leitor-contumaz', nome: 'Leitor Contumaz', ref: SAH(23), nex: 40, custoPe: 2, efeitos: [{ alvo: 'nota', texto: 'Dados de bônus da ação ler: 1d8 cada, em testes de qualquer perícia.' }] },
      { id: 'rato-de-biblioteca', nome: 'Rato de Biblioteca', ref: SAH(23), nex: 65 },
      {
        id: 'a-forca-do-saber', nome: 'A Força do Saber', ref: SAH(23), nex: 99, escolha: { tipo: 'pericia' },
        efeitos: [{ alvo: 'atributo', atributo: 'int', valor: 1 }, { alvo: 'pe', valor: 'int' }, { alvo: 'nota', texto: 'A perícia escolhida passa a usar Intelecto.' }],
      },
    ],
  },
  {
    id: 'perseverante',
    nome: 'Perseverante',
    ref: SAH(24),
    classe: 'especialista',
    habilidades: [
      { id: 'solucoes-improvisadas', nome: 'Soluções Improvisadas', ref: SAH(24), nex: 10, custoPe: 2 },
      {
        id: 'fuga-obstinada', nome: 'Fuga Obstinada', ref: SAH(24), nex: 40,
        efeitos: [{ alvo: 'pericia', pericia: 'todas', dados: 1, condicional: 'testes para fugir de um inimigo' }, { alvo: 'nota', texto: 'Em perseguição, como presa, aguenta até 4 falhas.' }],
      },
      { id: 'determinacao-inquestionavel', nome: 'Determinação Inquestionável', ref: SAH(24), nex: 65, custoPe: 5 },
      { id: 'so-mais-um-passo', nome: 'Só Mais um Passo...', ref: SAH(24), nex: 99, custoPe: 5 },
    ],
  },
  {
    id: 'muambeiro',
    nome: 'Muambeiro',
    ref: SAH(25),
    classe: 'especialista',
    habilidades: [
      {
        id: 'mascate', nome: 'Mascate', ref: SAH(25), nex: 10, escolha: { tipo: 'texto', rotulo: 'Profissão: armeiro, engenheiro ou químico' },
        efeitos: [{ alvo: 'treino', pericia: 'profissao' }, { alvo: 'espacos', valor: 5 }, { alvo: 'nota', texto: 'Item improvisado: DT de fabricação −10 (em vez de −5).' }],
      },
      { id: 'fabricacao-propria', nome: 'Fabricação Própria', ref: SAH(25), nex: 40, efeitos: [{ alvo: 'nota', texto: 'Fabrica itens mundanos na metade do tempo.' }] },
      {
        id: 'laboratorio-de-campo', nome: 'Laboratório de Campo', ref: SAH(25), nex: 65, escolha: { tipo: 'texto', rotulo: 'Profissão: armeiro, engenheiro ou químico' },
        efeitos: [{ alvo: 'treino', pericia: 'profissao', seJa: 5 }, { alvo: 'nota', texto: 'Fabricação em campo também de itens paranormais.' }],
      },
      { id: 'achado-conveniente', nome: 'Achado Conveniente', ref: SAH(25), nex: 99, custoPe: 5 },
    ],
  },

  // ================= ocultista (LR p. 34–35) =================
  {
    id: 'conduite',
    nome: 'Conduíte',
    ref: LR(34),
    classe: 'ocultista',
    resumo: 'Aperfeiçoa a conjuração: mais alcance ou área, rituais como ação livre, anulação de rituais inimigos e o ritual Canalizar o Medo.',
    habilidades: [
      { id: 'ampliar-ritual', nome: 'Ampliar Ritual', ref: LR(34), nex: 10, custoPe: 2, resumo: '+2 PE ao conjurar: o alcance sobe um passo (até extremo) ou a área dobra.' },
      { id: 'acelerar-ritual', nome: 'Acelerar Ritual', ref: LR(34), nex: 40, custoPe: 4, resumo: '1×/rodada, pague +4 PE para conjurar um ritual como ação livre.' },
      { id: 'anular-ritual', nome: 'Anular Ritual', ref: LR(34), nex: 65, resumo: 'Alvo de um ritual, paga os mesmos PE do conjurador e disputa Ocultismo com ele; vencendo, o ritual é anulado.' },
      { id: 'canalizar-o-medo', nome: 'Canalizar o Medo', ref: LR(34), nex: 99, resumo: 'Passa a conhecer o ritual Canalizar o Medo.', concedeRituais: ['canalizar-o-medo'] },
    ],
  },
  {
    id: 'flagelador',
    nome: 'Flagelador',
    ref: LR(34),
    classe: 'ocultista',
    resumo: 'Converte dor em poder: paga rituais com PV, reduz dano sofrido, ganha PE ao derrubar inimigos com rituais e aprende Medo Tangível.',
    habilidades: [
      { id: 'poder-do-flagelo', nome: 'Poder do Flagelo', ref: LR(34), nex: 10, resumo: 'Pode pagar rituais com PV, 2 PV por PE; esses PV só voltam com descanso.' },
      { id: 'abracar-a-dor', nome: 'Abraçar a Dor', ref: LR(34), nex: 40, custoPe: 2, resumo: 'Reação e 2 PE para reduzir à metade um dano não paranormal sofrido.' },
      { id: 'absorver-agonia', nome: 'Absorver Agonia', ref: LR(34), nex: 65, resumo: 'Levar inimigos a 0 PV com um ritual dá PE temporários iguais ao círculo dele.' },
      { id: 'medo-tangivel', nome: 'Medo Tangível', ref: LR(35), nex: 99, resumo: 'Passa a conhecer o ritual Medo Tangível.', concedeRituais: ['medo-tangivel'] },
    ],
  },
  {
    id: 'graduado',
    nome: 'Graduado',
    ref: LR(35),
    classe: 'ocultista',
    resumo: 'Estudioso de rituais: aprende rituais extras, mantém um grimório, dificulta a resistência aos seus rituais e aprende Conhecendo o Medo.',
    habilidades: [
      {
        id: 'saber-ampliado', nome: 'Saber Ampliado', ref: LR(35), nex: 10,
        resumo: 'Aprende um ritual de 1º círculo e mais um de cada círculo novo que liberar; eles ficam fora do limite de rituais.',
        rituaisExtras: { qtd: 1, circuloMax: 1, porCirculoNovo: true },
      },
      {
        id: 'grimorio-ritualistico', nome: 'Grimório Ritualístico', ref: LR(35), nex: 40,
        resumo: 'Grimório (1 espaço) com rituais de 1º ou 2º círculo em número igual ao Intelecto, mais um por círculo novo; conjurá-los pede antes uma ação completa.',
        rituaisExtras: { qtd: 'int', circuloMax: 2, porCirculoNovo: true },
        efeitos: [{ alvo: 'nota', texto: 'Conjurar um ritual do grimório pede antes uma ação completa; o grimório ocupa 1 espaço.' }],
      },
      { id: 'rituais-eficientes', nome: 'Rituais Eficientes', ref: LR(35), nex: 65, resumo: '+5 na DT para resistir a todos os seus rituais.', efeitos: [{ alvo: 'dtRituais', valor: 5 }] },
      { id: 'conhecendo-o-medo', nome: 'Conhecendo o Medo', ref: LR(35), nex: 99, resumo: 'Passa a conhecer o ritual Conhecendo o Medo.', concedeRituais: ['conhecendo-o-medo'] },
    ],
  },
  {
    id: 'intuitivo',
    nome: 'Intuitivo',
    ref: LR(35),
    classe: 'ocultista',
    resumo: 'Mente preparada contra o Outro Lado: bônus contra efeitos paranormais, Presença no limite de PE para rituais, resistência mental e Presença do Medo.',
    habilidades: [
      { id: 'mente-sa', nome: 'Mente Sã', ref: LR(35), nex: 10, resumo: 'Resistência paranormal +5: soma 5 nos testes de resistência contra efeitos paranormais.', efeitos: [{ alvo: 'resistenciaTeste', valor: 5, condicional: 'contra efeitos paranormais' }] },
      { id: 'presenca-poderosa', nome: 'Presença Poderosa', ref: LR(35), nex: 40, resumo: 'Soma a Presença ao limite de PE por turno, só para conjurar rituais.', efeitos: [{ alvo: 'limitePeRituais', valor: 'pre' }] },
      {
        id: 'inabalavel', nome: 'Inabalável', ref: LR(35), nex: 65,
        resumo: 'Resistência a dano mental e paranormal 10; passando na Vontade contra efeito paranormal que corta o dano à metade, não sofre nenhum.',
        efeitos: [{ alvo: 'resistencia', dano: 'mental', valor: 10 }, { alvo: 'resistencia', dano: 'paranormal', valor: 10 }],
      },
      { id: 'presenca-do-medo', nome: 'Presença do Medo', ref: LR(35), nex: 99, resumo: 'Passa a conhecer o ritual Presença do Medo.', concedeRituais: ['presenca-do-medo'] },
    ],
  },
  {
    id: 'lamina-paranormal',
    nome: 'Lâmina Paranormal',
    ref: LR(35),
    classe: 'ocultista',
    resumo: 'Une rituais e armas: aprende Amaldiçoar Arma e ataca com Ocultismo, ganha PE ao acertar, ataca ao conjurar e aprende Lâmina do Medo.',
    habilidades: [
      {
        id: 'lamina-maldita', nome: 'Lâmina Maldita', ref: LR(35), nex: 10,
        resumo: 'Aprende Amaldiçoar Arma (se já sabia, custa −1 PE); com ele, pode atacar usando Ocultismo no lugar de Luta ou Pontaria.',
        concedeRituais: ['amaldicoar-arma'],
        efeitos: [
          { alvo: 'custoRitual', valor: -1, condicional: 'só Amaldiçoar Arma, se você já o conhecia' },
          { alvo: 'nota', texto: 'Com Amaldiçoar Arma, ataques com a arma amaldiçoada podem usar Ocultismo no lugar de Luta ou Pontaria.' },
        ],
      },
      { id: 'gladiador-paranormal', nome: 'Gladiador Paranormal', ref: LR(35), nex: 40, resumo: 'Cada acerto corpo a corpo num inimigo dá 2 PE temporários, até seu limite de PE por cena; somem no fim da cena.' },
      { id: 'conjuracao-marcial', nome: 'Conjuração Marcial', ref: LR(35), nex: 65, custoPe: 2, resumo: '1×/rodada, ao conjurar ritual de ação padrão, 2 PE para um ataque corpo a corpo como ação livre.' },
      { id: 'lamina-do-medo', nome: 'Lâmina do Medo', ref: LR(35), nex: 99, resumo: 'Passa a conhecer o ritual Lâmina do Medo.', concedeRituais: ['lamina-do-medo'] },
    ],
  },

  // ================= ocultista (SaH p. 27–29) =================
  {
    id: 'exorcista',
    nome: 'Exorcista',
    ref: SAH(27),
    classe: 'ocultista',
    habilidades: [
      {
        id: 'revelacao-do-mal', nome: 'Revelação do Mal', ref: SAH(27), nex: 10,
        efeitos: [
          { alvo: 'treino', pericia: 'religiao', seJa: 2 },
          { alvo: 'nota', texto: 'Religião no lugar de Ocultismo e, para notar seres, rastros e pistas paranormais, de Investigação e Percepção.' },
        ],
      },
      {
        id: 'poder-da-fe', nome: 'Poder da Fé', ref: SAH(27), nex: 40, custoPe: 2,
        efeitos: [{ alvo: 'treino', pericia: 'religiao', grau: 'veterano' }, { alvo: 'pericia', pericia: 'religiao', dados: 1, condicional: 'se já era veterano em Religião' }],
      },
      { id: 'parareligiosidade', nome: 'Parareligiosidade', ref: SAH(27), nex: 65, custoPe: 2 },
      { id: 'chagas-da-resistencia', nome: 'Chagas da Resistência', ref: SAH(28), nex: 99, efeitos: [{ alvo: 'nota', texto: 'Custa 10 PV.' }] },
    ],
  },
  {
    id: 'possuido',
    nome: 'Possuído',
    ref: SAH(28),
    classe: 'ocultista',
    habilidades: [
      {
        id: 'poder-nao-desejado', nome: 'Poder Não Desejado', ref: SAH(28), nex: 10,
        efeitos: [
          { alvo: 'nota', texto: 'Todo novo poder de ocultista vira Transcender.' },
          { alvo: 'nota', texto: 'Pontos de possessão: 3 + 2 por Transcender; por turno, até a Presença; cada um recupera 10 PV ou 2 PE; +1 por ação dormir.' },
        ],
      },
      {
        id: 'as-sombras-dentro-de-mim', nome: 'As Sombras Dentro de Mim', ref: SAH(28), nex: 40, custoPe: 2,
        efeitos: [
          { alvo: 'nota', texto: 'Pontos de possessão: +2 por ação dormir.' },
          { alvo: 'pericia', pericia: 'acrobacia', dados: 1, condicional: SOMBRAS },
          { alvo: 'pericia', pericia: 'atletismo', dados: 1, condicional: SOMBRAS },
          { alvo: 'pericia', pericia: 'furtividade', dados: 1, condicional: SOMBRAS },
        ],
      },
      { id: 'ele-me-ensina', nome: 'Ele Me Ensina', ref: SAH(28), nex: 65, escolha: { tipo: 'texto', rotulo: 'um poder paranormal (transcender) ou o 1º poder de outra trilha de ocultista' } },
      {
        // sem escolha: o presente é o do elemento da afinidade (SaH p. 28), e as notas
        // com soElemento seguem a afinidade da ficha
        id: 'tornamo-nos-um', nome: 'Tornamo-nos Um', ref: SAH(28), nex: 99, custoPe: 6,
        efeitos: [
          { alvo: 'nota', texto: 'Vale o presente do elemento da sua afinidade (6 PE cada).' },
          { alvo: 'nota', soElemento: 'sangue', texto: 'Sangue, Presente da Obsessão: 1×/rodada, recupera 50 PV; até seu próximo turno, treino 35 nas perícias de Força e Vigor e em Intimidação, −10 nas outras de Presença.' },
          { alvo: 'nota', soElemento: 'morte', texto: 'Morte, Presente do Tempo: 1×/rodada, um turno extra na última contagem de iniciativa.' },
          { alvo: 'nota', soElemento: 'conhecimento', texto: 'Conhecimento, Presente do Saber: 1×/cena, um poder até o fim da cena (nenhum de trilha de NEX 99%); Vontade DT 15 + 5 por uso na missão, ou perde 1d6 SAN por uso.' },
          { alvo: 'nota', soElemento: 'energia', texto: 'Energia, Presente do Espaço: 1×/rodada, teleporte para um ponto em alcance médio.' },
        ],
      },
    ],
  },
  {
    id: 'parapsicologo',
    nome: 'Parapsicólogo',
    ref: SAH(29),
    classe: 'ocultista',
    requisitos: [{ tipo: 'pericia', pericia: 'profissao' }, { tipo: 'texto', texto: 'a Profissão treinada precisa ser psicólogo' }],
    habilidades: [
      {
        id: 'terapia', nome: 'Terapia', ref: SAH(29), nex: 10, custoPe: 2,
        efeitos: [
          { alvo: 'nota', texto: 'Profissão (psicólogo) no lugar de Diplomacia.' },
          { alvo: 'pericia', pericia: 'profissao', valor: 2, condicional: 'se já tinha Terapia pela origem Psicólogo (o custo também cai 1 PE)' },
        ],
      },
      { id: 'palavras-chave', nome: 'Palavras-chave', ref: SAH(29), nex: 40 },
      { id: 'reprogramacao-mental', nome: 'Reprogramação Mental', ref: SAH(29), nex: 65, custoPe: 5 },
      { id: 'a-sanidade-esta-la-fora', nome: 'A Sanidade Está Lá Fora', ref: SAH(29), nex: 99, custoPe: 5 },
    ],
  },
];
