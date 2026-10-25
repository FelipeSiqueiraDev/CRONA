// Modificações de itens (LR cap. 3): armas e munições (p. 60; Tab. 3.5 na
// p. 61), proteções (p. 62, Tab. 3.7) e acessórios (p. 64, Tab. 3.9). Mais as
// do Sobrevivendo ao Horror (SaH pp. 38, 39 e 45), conferidas nas páginas do
// livro. Cada modificação sobe a categoria do item em I, e a mesma não entra
// duas vezes no mesmo item (fora Aprimorado num acessório com Função adicional).
//
// Convenções:
// - Efeito de modificação de arma ou de munição só vale nos ataques com aquele
//   item: escopo 'todos' = todo ataque feito com ele.
// - Efeito de modificação de proteção ou acessório vale enquanto o item está
//   em uso, somado aos números do próprio item.
// - "espaços −1" / "espaços +1" em `especial` mudam o espaço do próprio item.
// - A Tab. 3.5 separa as listas: corpo a corpo e disparo de um lado, armas de
//   fogo do outro (arma de fogo não recebe Certeira, Cruel nem Perigosa).
import type { Modificacao } from '../tipos';

const LR = (pagina: number) => ({ fonte: 'LR' as const, pagina });
const SAH = (pagina: number) => ({ fonte: 'SaH' as const, pagina });

const OCULTAR = 'o teste de Crime para ocultar o item pode ser feito sem treino';

export const MODIFICACOES: Modificacao[] = [
  // ===== Armas corpo a corpo e de disparo (p. 60) =====
  { id: 'certeira', nome: 'Certeira', ref: LR(60), para: ['armaCorpoACorpo', 'armaDisparo'],
    efeitos: [{ alvo: 'ataque', escopo: 'todos', valor: 2 }],
    resumo: 'Arma fabricada para ser mais precisa e equilibrada: +2 nos testes de ataque.' },
  { id: 'cruel', nome: 'Cruel', ref: LR(60), para: ['armaCorpoACorpo', 'armaDisparo'],
    efeitos: [{ alvo: 'dano', escopo: 'todos', valor: 2 }],
    resumo: 'Lâmina especialmente afiada ou material mais denso: +2 nas rolagens de dano.' },
  { id: 'perigosa', nome: 'Perigosa', ref: LR(60), para: ['armaCorpoACorpo', 'armaDisparo'],
    efeitos: [{ alvo: 'margem', escopo: 'todos', valor: 2 }],
    resumo: 'Fio de navalha ou material maciço deixam os golpes terríveis: +2 na margem de ameaça.' },
  // ===== Qualquer arma (aparecem nas duas listas da Tab. 3.5) =====
  // Segue a descrição (p. 60), que vale para toda arma. A tabela dá outra coisa
  // para corpo a corpo e disparo: +10 para ocultar, sem mudar o espaço.
  { id: 'discreta-arma', nome: 'Discreta (arma)', ref: LR(60), para: ['armaCorpoACorpo', 'armaDisparo', 'armaFogo'],
    efeitos: [{ alvo: 'pericia', pericia: 'crime', valor: 5, condicional: 'para ocultar a arma' }, { alvo: 'nota', texto: OCULTAR }],
    especial: ['espaços −1', 'Tab. 3.5, corpo a corpo e disparo: +10 para ocultar, sem −1 espaço'],
    resumo: 'Arma desmontável, retrátil ou dobrável: ocupa 1 espaço a menos e dá +5 em Crime para escondê-la, mesmo sem treino.' },
  { id: 'tatica', nome: 'Tática', ref: LR(60), para: ['armaCorpoACorpo', 'armaDisparo', 'armaFogo'],
    especial: ['saca como ação livre'],
    resumo: 'Empunhadura texturizada e alça para carregar: a arma é sacada como ação livre.' },
  // ===== Armas de fogo (p. 60) =====
  { id: 'alongada', nome: 'Alongada', ref: LR(60), para: ['armaFogo'],
    efeitos: [{ alvo: 'ataque', escopo: 'todos', valor: 2 }],
    resumo: 'Cano mais comprido, que melhora a pontaria: +2 nos testes de ataque.' },
  { id: 'calibre-grosso', nome: 'Calibre Grosso', ref: LR(60), para: ['armaFogo'],
    efeitos: [{ alvo: 'dano', escopo: 'todos', dadoExtra: 1 }],
    especial: ['exige munição de calibre grosso (mesma categoria da normal; não serve em arma comum)'],
    resumo: 'Dispara munição de calibre maior: +1 dado de dano do mesmo tipo (revólver 3d6). Só usa munição de calibre grosso.' },
  { id: 'compensador', nome: 'Compensador', ref: LR(60), para: ['armaFogo'],
    requisitos: [{ tipo: 'texto', texto: 'só em arma automática' }],
    efeitos: [{ alvo: 'ataque', escopo: 'todos', dados: 1, condicional: 'ao disparar rajada: anula o −1d20' }],
    resumo: 'Amortece o coice de uma arma automática e anula a penalidade no ataque ao disparar rajadas.' },
  { id: 'ferrolho-automatico', nome: 'Ferrolho Automático', ref: LR(60), para: ['armaFogo'],
    especial: ['torna a arma automática (rajada, p. 59)'],
    resumo: 'Mecanismo que dispara várias vezes seguidas: a arma passa a ser automática.' },
  { id: 'mira-laser', nome: 'Mira Laser', ref: LR(60), para: ['armaFogo'],
    efeitos: [{ alvo: 'margem', escopo: 'todos', valor: 2 }],
    resumo: 'Ponto de laser que ajuda a acertar pontos vitais: +2 na margem de ameaça.' },
  { id: 'mira-telescopica', nome: 'Mira Telescópica', ref: LR(60), para: ['armaFogo'],
    especial: ['alcance +1 categoria (curto → médio → longo → extremo)', 'Ataque Furtivo em qualquer alcance'],
    resumo: 'Luneta com marcações: o alcance sobe uma categoria e o Ataque Furtivo passa a valer em qualquer distância.' },
  // esconder-se depois de atacar: −15 em Furtividade (p. 45); com silenciador, −5
  { id: 'silenciador', nome: 'Silenciador', ref: LR(60), para: ['armaFogo'],
    efeitos: [{ alvo: 'pericia', pericia: 'furtividade', valor: 10, condicional: 'para se esconder no turno em que atacou com a arma' }],
    resumo: 'Abafa os disparos: a penalidade em Furtividade para se esconder no turno em que atirou diminui em 10.' },
  { id: 'visao-de-calor', nome: 'Visão de Calor', ref: LR(60), para: ['armaFogo'],
    especial: ['ignora camuflagem do alvo ao disparar'],
    resumo: 'Mira térmica que destaca o calor dos corpos: ao disparar, você ignora qualquer camuflagem do alvo.' },
  // ===== Munições (p. 60): sobem a categoria do pacote de munição =====
  { id: 'dum-dum', nome: 'Dum dum', ref: LR(60), para: ['municao'],
    requisitos: [{ tipo: 'texto', texto: 'só em balas curtas ou balas longas' }],
    efeitos: [{ alvo: 'multiplicador', escopo: 'todos', valor: 2 }],
    resumo: 'Balas que se deformam ao entrar no alvo: +2 no multiplicador de crítico. Só em balas curtas e longas.' },
  { id: 'explosiva', nome: 'Explosiva', ref: LR(60), para: ['municao'],
    requisitos: [{ tipo: 'texto', texto: 'só em balas curtas ou balas longas' }],
    especial: ['+2d6 de dano (dados extras: não multiplicam no crítico)'],
    resumo: 'Balas que explodem ao atingir o alvo: +2d6 de dano. Só em balas curtas e longas.' },

  // ===== Proteções (p. 62) =====
  { id: 'antibombas', nome: 'Antibombas', ref: LR(62), para: ['protecao'],
    requisitos: [{ tipo: 'texto', texto: 'só em proteção pesada' }],
    efeitos: [{ alvo: 'resistenciaTeste', valor: 5, condicional: 'contra efeitos de área' }],
    resumo: 'Resiste a calor e estilhaços e vem com capacete de viseira: +5 em testes de resistência contra efeitos de área.' },
  // "aumenta a RD para 5": a proteção pesada tem RD 2, então +3
  { id: 'blindada', nome: 'Blindada', ref: LR(62), para: ['protecao'],
    requisitos: [{ tipo: 'texto', texto: 'só em proteção pesada' }],
    efeitos: [{ alvo: 'resistencia', dano: 'fisico', valor: 3 }],
    especial: ['RD da proteção: 2 → 5', 'espaços +1'],
    resumo: 'Leva placas de aço e cerâmica entre as camadas: a RD da proteção pesada sobe para 5, mas ela ocupa 1 espaço a mais.' },
  { id: 'discreta-protecao', nome: 'Discreta (proteção)', ref: LR(62), para: ['protecao'],
    requisitos: [{ tipo: 'texto', texto: 'só em proteção leve' }],
    incompativel: ['reforcada'],
    efeitos: [{ alvo: 'pericia', pericia: 'crime', valor: 5, condicional: 'para ocultar a proteção' }, { alvo: 'nota', texto: OCULTAR }],
    especial: ['espaços −1'],
    resumo: 'Colete compacto de kevlar denso: ocupa 1 espaço a menos e dá +5 em Crime para escondê-lo, mesmo sem treino.' },
  // o livro não restringe: vale em proteção leve, pesada ou escudo
  { id: 'reforcada', nome: 'Reforçada', ref: LR(62), para: ['protecao'],
    incompativel: ['discreta-protecao'],
    efeitos: [{ alvo: 'defesa', valor: 2 }],
    especial: ['espaços +1'],
    resumo: '+2 na Defesa dada pela proteção, que passa a ocupar 1 espaço a mais. Não se junta com discreta.' },

  // ===== Acessórios (p. 64): kit de perícia, utensílio e vestimenta =====
  // +3 no bônus de +2 do próprio acessório = +5 ('escolhida' = a perícia do item)
  { id: 'aprimorado', nome: 'Aprimorado', ref: LR(64), para: ['acessorio'],
    efeitos: [{ alvo: 'pericia', pericia: 'escolhida', valor: 3 }],
    especial: ['bônus de perícia do acessório: +2 → +5', 'com função adicional, pode entrar uma 2ª vez, para a outra perícia'],
    resumo: 'O bônus de perícia do acessório sobe para +5. Se ele tiver função adicional, dá para aprimorar também a outra perícia.' },
  { id: 'discreto', nome: 'Discreto', ref: LR(64), para: ['acessorio'],
    efeitos: [{ alvo: 'pericia', pericia: 'crime', valor: 5, condicional: 'para ocultar o item' }, { alvo: 'nota', texto: OCULTAR }],
    especial: ['espaços −1'],
    resumo: 'Item miniaturizado ou disfarçado, como um relógio: ocupa 1 espaço a menos e dá +5 em Crime para escondê-lo, mesmo sem treino.' },
  { id: 'funcao-adicional', nome: 'Função adicional', ref: LR(64), para: ['acessorio'],
    efeitos: [{ alvo: 'nota', texto: '+2 em mais uma perícia, escolhida ao aplicar e aprovada pelo mestre' }],
    resumo: 'O acessório passa a dar +2 também em outra perícia, à escolha, com aprovação do mestre.' },
  { id: 'instrumental', nome: 'Instrumental', ref: LR(64), para: ['acessorio'],
    efeitos: [{ alvo: 'nota', texto: 'funciona como kit de uma perícia, escolhida ao aplicar' }],
    resumo: 'O acessório também funciona como o kit de uma perícia, escolhida ao aplicar a modificação.' },

  // ===== Sobrevivendo ao Horror =====
  { id: 'carregador-rapido', nome: 'Carregador rápido', ref: SAH(38), para: ['armaFogo', 'armaDisparo'],
    requisitos: [{ tipo: 'texto', texto: 'arma de fogo, besta ou balestra' }, { tipo: 'texto', texto: 'só com a regra opcional de contagem de munição (LR p. 174)' }],
    especial: ['arma de fogo: recarga como ação livre 1x/rodada', 'besta ou balestra: até 5 recargas como ação livre com uma mão; depois, 1 virote por ação de movimento'] },
  // Objetos elétricos. O livro a põe entre as modificações para acessórios, mas
  // cita também a lanterna e o taser (itens operacionais). O C.R.I.S só a
  // mostrava no taser.
  { id: 'bateria-potente', nome: 'Bateria potente', ref: SAH(39), para: ['acessorio'],
    requisitos: [{ tipo: 'texto', texto: 'só em objeto elétrico (lanterna, celular, notebook, taser; outros a critério do mestre)' }],
    especial: ['lanterna, celular ou notebook: dobra a duração da bateria e o alcance da luz', 'taser: dobra os usos (4), dano 1d8 e DT +5', 'com a opção de duração de baterias (SaH p. 39): o dado da bateria cai um passo a cada dois usos'] },
  // Modificação paranormal. O tipo não tem alvo para item paranormal: fica
  // como acessório, com o requisito em texto.
  { id: 'lente-de-revelacao', nome: 'Lente de revelação', ref: SAH(45), para: ['acessorio'],
    requisitos: [{ tipo: 'texto', texto: 'só em câmera de aura paranormal' }],
    especial: ['vê seres invisíveis e incorpóreos e ignora a camuflagem deles', 'foto de uma criatura em alcance curto: ação padrão e 1 PE; até o fim da cena, ela perde camuflagem e invisibilidade e fica corpórea (Vontade DT Pre evita)'] },
];
