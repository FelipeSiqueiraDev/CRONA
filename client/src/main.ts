import './style.css';
import './ui/shell.css';
import './ui/table.css';
import './ui/tema.css';
import './ui/iconesAnimados.css';
import './ui/mapa.css';
import './ui/fichas.css';
import './ui/combate.css';
import './ui/itens.css';
import './ui/teclado.css';
import './ui/requisicao.css';
import './ui/entrada.css';
import './ui/mapaMundi.css';
import './ui/kit.css';
import './ui/minimapa.css';
import './ui/jogador.css';
import './ui/fliperama.css';
import './ui/barJogos.css';
import './ui/retro-auto.css';
import './ui/retro.css';
import './ui/hud.css';
import './ui/combateRapido.css';
import './ui/cards.css';
import { anyFurniName, getFurni, getWallFurni, portraitState, vitalConditions, type ServerMsg } from '@crona/shared';
import { Net } from './net';
import { clearIconCache } from './render/bubbles';
import { breathMode } from './render/portrait';
import { sprites } from './render/sprites';
import { RoomView } from './room/RoomView';
import { App } from './ui/app';
import { CatalogWin, InventoryWin } from './ui/catalog';
import { CharactersWin } from './ui/characters';
import { closeTopWindow, fecharJanelas, h, toast } from './ui/dom';
import { FxWin } from './ui/fx';
import { HelpWin } from './ui/help';
import { HintViewer } from './ui/infostand';
import { Shell } from './ui/shell';
import { loadLogin, saveLogin } from './ui/login';
import { TableScreen } from './ui/table';
import { esquecerChaveFicha, guardarChaveFicha, lerChaveFicha, TelaFicha } from './ui/telaFicha';
import { Entrada } from './ui/entrada';
import { mostrarTelaViagem } from './ui/viagemTela';
import { BarJogos } from './ui/barJogos';
import { esquecerSessao, guardarSessao, lerSessao } from './session/conta';
import { janelaAberta } from './ui/fichaModal';
import { NavigatorWin } from './ui/navigator';
import { RoomSettingsWin } from './ui/roomSettings';
import { forgetGmKey, readGmKey, tableName, tableRequested } from './session/access';
import { montarTemas } from './ui/temaUi';
import { NEVOA_NA_TELA } from './ui/ferramentasMesa';
import { ligarMarcaOuro } from './ui/marcaOuro';

const LAST_ROOM = 'crona.lastRoom';
const HOME_SEEN = 'crona.homeSeen';
const net = new Net();
const app = new App(net);
// as peças do kit de interface viram variáveis de CSS, por tema
montarTemas();
/** chave do link do mestre (?mestre=...), para mestre em outro aparelho */
const gmKey = readGmKey();
/**
 * Duas telas: a do mestre (a interface completa, só ele vê) e a da mesa (só o
 * tabuleiro, no tablet que os jogadores veem). ?mesa pede a da mesa; sem isso,
 * quem o servidor disser que é mestre fica com a interface.
 */
const tableMode = tableRequested();
/** link da ficha do jogador (?ficha=CHAVE): só a ficha dele, no celular */
const fichaKey = tableMode ? null : lerChaveFicha();
const fichaMode = !!fichaKey;
/** a conta deste aparelho (a tela de entrada) */
let sessaoConta = lerSessao();
/** em desenvolvimento, ?auto entra direto, sem a tela de entrada */
const devAuto = import.meta.env.DEV && new URLSearchParams(location.search).has('auto');
/** quem entra pela conta: o mestre e o jogador sem link (a mesa e os links continuam como antes) */
const pedeConta = !tableMode && !fichaMode && !gmKey && !devAuto;
let entrada: Entrada | null = null;
const root = document.getElementById('app')!;
const canvas = h('canvas', { class: 'room-canvas', 'aria-label': 'Tabuleiro' });

const usedInv = new Set<number>();

function endPlacement() {
  app.view.cancelPlacement();
  shell?.setPlacement(null);
  usedInv.clear();
}

function startPlace(defId: string, invId?: number) {
  usedInv.clear();
  // colocando no tabuleiro: as janelas saem da frente
  fecharJanelas();
  const name = anyFurniName(defId);
  if (getWallFurni(defId)) app.view.startPlacement({ kind: 'wall', defId, invId });
  else {
    const def = getFurni(defId);
    if (!def) return;
    app.view.startPlacement({ kind: 'floor', defId, rot: def.rotations.includes(2) ? 2 : def.rotations[0], invId });
  }
  shell?.setPlacement(`Colocando ${name}: clique para colocar · R ou botão direito gira · Shift coloca vários · Esc cancela`);
}

/**
 * O grupo anda junto (09/10, o Felipe): cada peça vai para uma casa livre perto do destino, sem empilhar. As casas saem
 * de uma busca a partir do destino (as mais perto primeiro); a peça mais perto do destino fica com a casa do clique, e
 * as outras, em ordem de distância, com as seguintes.
 */
function andarEmGrupo(x: number, y: number) {
  const map = app.view.map;
  if (!map) return;
  const ids = [...app.view.grupo].filter((id) => app.view.users.has(id));
  const doGrupo = new Set(ids);
  const ocupadas = new Set([...app.view.users.values()].filter((u) => !doGrupo.has(u.id)).map((u) => `${u.x},${u.y}`));
  const casas: { x: number; y: number }[] = [];
  const vistas = new Set([`${x},${y}`]);
  const fila = [{ x, y }];
  while (fila.length && casas.length < ids.length) {
    const c = fila.shift()!;
    if (map.walkState(c.x, c.y) === 'walk' && !ocupadas.has(`${c.x},${c.y}`)) casas.push(c);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]) {
      const n = { x: c.x + dx, y: c.y + dy };
      const k = `${n.x},${n.y}`;
      if (vistas.has(k) || map.floorHeight(n.x, n.y) === null) continue;
      vistas.add(k);
      // não atravessa parede nem móvel na busca (a casa do lado de lá de um armário não é "perto")
      if (map.walkState(n.x, n.y) === 'blocked') continue;
      fila.push(n);
    }
  }
  const dist = (id: number) => {
    const u = app.view.users.get(id)!;
    return Math.hypot(u.x - x, u.y - y);
  };
  ids.sort((a, b) => dist(a) - dist(b)).forEach((id, i) => {
    const c = casas[i] ?? { x, y };
    net.send({ t: 'tokenWalk', tokenId: id, x: c.x, y: c.y });
  });
}

const view = new RoomView(canvas, {
  walk: (x, y) => {
    // jogador só acompanha
    if (!app.isGm) return;
    const id = app.view.myId;
    if (app.view.grupo.size > 1) return andarEmGrupo(x, y);
    // sem peça escolhida o clique no chão não faz nada, e sem aviso (o Felipe, 14/10: o toast repetia a cada clique)
    if (id) net.send({ t: 'tokenWalk', tokenId: id, x, y });
  },
  grupoMudou: (n) => {
    if (n > 1) toast(`${n} peças andando juntas. Clique no chão para mandar o grupo; Shift + clique numa peça junta ou tira; clique sem Shift desfaz.`);
  },
  lookAt: () => {},
  placeFloor: (p, x, y, keep) => {
    const map = app.view.map;
    if (!map) return;
    const res = map.canPlace(p.defId, x, y, p.rot, p.moveId);
    if (!res.ok) return toast(res.reason ?? 'Não dá para colocar aí.', 'error');
    if (p.moveId) {
      net.send({ t: 'moveItem', id: p.moveId, x, y, rot: p.rot });
      return endPlacement();
    }
    net.send({ t: 'place', defId: p.invId ? undefined : p.defId, invId: p.invId, x, y, rot: p.rot });
    if (p.invId) {
      usedInv.add(p.invId);
      const next = app.state.inventory.find((i) => i.defId === p.defId && !usedInv.has(i.id));
      if (keep && next) p.invId = next.id;
      else endPlacement();
    } else if (!keep) endPlacement();
  },
  placeWall: (p, t, keep) => {
    if (!t.ok) return toast('Não dá para colocar aí.', 'error');
    if (p.moveId) {
      net.send({ t: 'moveWallItem', id: p.moveId, wall: t.wall, plane: t.plane, pos: t.pos, z: t.z });
      return endPlacement();
    }
    net.send({ t: 'placeWall', defId: p.invId ? undefined : p.defId, invId: p.invId, wall: t.wall, plane: t.plane, pos: t.pos, z: t.z });
    if (p.invId) {
      usedInv.add(p.invId);
      const next = app.state.inventory.find((i) => i.defId === p.defId && !usedInv.has(i.id));
      if (keep && next) p.invId = next.id;
      else endPlacement();
    } else if (!keep) endPlacement();
  },
  // clique duplo num mobi com senha (a geladeira do bar): o teclado grande no meio do tabuleiro;
  // sem senha (o feno do celeiro), o servidor empurra o mobi
  use: (id) => {
    const it = view.map?.getItem(id);
    if (it?.lock && !it.lock.open && !it.lock.semSenha && shell?.abrirTeclado(it)) return;
    net.send({ t: 'use', id });
  },
  select: () => app.emit('selection'),
  openHint: (kind, id) => hintViewer.open(kind, id),
  aviso: (texto) => toast(texto),
});
app.view = view;
// pose de cada peça no tabuleiro: Armado (no painel da peça) e machucado (menos da metade dos PV)
view.estadoDe = (id) => {
  const ch = app.session.session?.characters.find((c) => c.id === -id);
  return ch ? portraitState(ch.armed, vitalConditions(ch.vitals).machucado) : null;
};
// como cada peça respira parada no tabuleiro: pelas condições da ficha, como o retrato e o personagem grande
view.respiracaoDe = (id) => {
  const ch = app.session.session?.characters.find((c) => c.id === -id);
  return ch ? breathMode(vitalConditions(ch.vitals)) : null;
};
// os PV de cada peça (de 0 a 1), para o arco da ficha no mapa tático
view.pvDe = (id) => {
  const v = app.session.session?.characters.find((c) => c.id === -id)?.vitals;
  return v && v.pvMax > 0 ? Math.max(0, Math.min(1, v.pv / v.pvMax)) : null;
};
if (import.meta.env.DEV) (window as unknown as { __crona: App }).__crona = app;

const navigator = new NavigatorWin(app);
const catalog = new CatalogWin(app, startPlace);
const inventory = new InventoryWin(app, startPlace);
const characters = new CharactersWin(app);
const settings = new RoomSettingsWin(app);
const help = new HelpWin();
const fx = new FxWin(app);
const hintViewer = new HintViewer(app);
const shell = tableMode || fichaMode
  ? null
  : new Shell(app, {
      navigator: () => navigator.toggle(),
      catalog: () => catalog.toggle(),
      trocar: (id, defId) => catalog.trocar(id, defId),
      inventory: () => inventory.toggle(),
      characters: () => characters.toggle(),
      settings: () => settings.toggle(),
      fx: () => fx.toggle(),
      help: () => help.toggle(),
      logout: () => sairDaConta(),
    });
const params = new URLSearchParams(location.search);
const table = tableMode ? new TableScreen(app) : null;
const telaFicha = fichaMode
  ? new TelaFicha(app, () => sairDaConta())
  : null;
/** os jogos do bar em que o mestre joga por um NPC (janelinha no canto) */
const barMestre = shell ? new BarJogos(app, 'mestre') : null;
// a marca de ouro das abas desliza de uma aba para a outra (em toda tela)
ligarMarcaOuro();
if (shell) {
  shell.mountCanvas(canvas);
  root.append(shell.el);
}
if (table) {
  table.mountCanvas(canvas);
  root.append(table.el);
}
if (telaFicha) {
  document.documentElement.classList.add('modo-ficha');
  root.append(telaFicha.el);
}

app.on('placement', () => {
  const p = app.view.placement;
  if (p) shell?.setPlacement(`Movendo ${anyFurniName(p.defId)}: clique no destino · R gira · Esc cancela`);
});

/**
 * Entra no tabuleiro. Com a conta (tela de entrada), o nome e o papel saem dela; sem conta, o
 * mestre com o nome salvo (ou "Mestre") e a mesa com o nome dela, como antes.
 */
function login(fresh = false) {
  const saved = loadLogin();
  const dev = import.meta.env.DEV ? params.get('auto') : null;
  const sessao = sessaoConta && !tableMode ? { sessao: sessaoConta.sessao } : {};
  if (fichaMode) {
    // o nome da conexão sai da chave (o mesmo link em outro aparelho assume a sessão)
    net.send({ t: 'login', name: `Agente ${fichaKey!.replace(/[^\p{L}\p{N}]/gu, '').slice(0, 6)}`, look: saved.look, fichaKey: fichaKey!, ...sessao });
    return;
  }
  const name = tableMode ? tableName(fresh) : dev || saved.name || 'Mestre';
  net.send({ t: 'login', name, look: saved.look, gmKey, mesa: tableMode, ...sessao });
}

/** A tela de entrada (conta da plataforma), com um aviso se houver. */
function mostrarEntrada(aviso?: string) {
  entrada ??= new Entrada({
    enviar: (m) => net.send(m),
    verMesa: () => location.replace(`${location.pathname}?mesa`),
    sairDaConta: () => sairDaConta(),
  });
  entrada.mostrar(aviso);
}

/**
 * Desconectar: a sessão da conta deixa de valer e o aparelho esquece as chaves guardadas (a do link do mestre e a
 * da ficha), senão a recarga entrava direto de novo. Volta para a tela de entrada (o Felipe, 14/10: aparecia o
 * aviso "Sessão encerrada" para quem tinha entrado pelo link, e não a tela de login).
 */
function sairDaConta() {
  if (sessaoConta) net.send({ t: 'contaSair', sessao: sessaoConta.sessao });
  esquecerSessao();
  esquecerChaveFicha();
  forgetGmKey();
  sessaoConta = null;
  setTimeout(() => {
    net.close();
    location.replace(location.pathname);
  }, 250);
}

const temChaveFicha = () => {
  try {
    return !!localStorage.getItem('crona.fichaKey');
  } catch {
    return false;
  }
};
if (pedeConta && sessaoConta?.papel === 'jogador') {
  // o jogador com conta: a tela dele é a ficha que a conta lembra
  if (temChaveFicha()) location.replace(`${location.pathname}?ficha`);
  else {
    mostrarEntrada();
    entrada!.semFicha(sessaoConta.nome);
  }
} else if (pedeConta && !sessaoConta) mostrarEntrada();
else login();
let loginTries = 0;

let reconnecting = false;
let wantRoom: number | null = null;

net.onMessage = (m: ServerMsg) => {
  // sessão compartilhada: estado, passos das peças e recusas
  if (app.session.receive(m)) {
    if (m.t === 'denied') toast(m.reason, 'error');
    return;
  }
  const me = app.state.me;
  switch (m.t) {
    case 'hello':
      app.state.characters = m.characters;
      sprites.setDefs(m.characters);
      app.emit('characters');
      if (me && reconnecting) {
        const sessao = sessaoConta && !tableMode ? { sessao: sessaoConta.sessao } : {};
        if (fichaMode) net.send({ t: 'login', name: me.name, look: me.look, fichaKey: fichaKey!, ...sessao });
        else net.send({ t: 'login', name: me.name, look: me.look, gmKey, mesa: tableMode, ...sessao });
      }
      break;
    case 'conta':
      if (m.ok) {
        sessaoConta = { sessao: m.sessao, nome: m.nome, papel: m.papel };
        guardarSessao(sessaoConta);
        if (m.papel === 'jogador') {
          // o jogador vai para a ficha dele; sem ficha ligada, o aviso
          if (m.fichaKey) {
            guardarChaveFicha(m.fichaKey);
            entrada?.sucesso(m.nome);
            setTimeout(() => location.replace(`${location.pathname}?ficha`), 600);
          } else entrada?.semFicha(m.nome);
        } else {
          entrada?.sucesso(m.nome);
          login();
        }
      } else if (m.expirou) {
        esquecerSessao();
        sessaoConta = null;
        // o link (da ficha ou do mestre) continua valendo sem a conta
        if (pedeConta) mostrarEntrada(m.erro);
        else login();
      } else if (entrada) entrada.erro(m.erro);
      else toast(m.erro, 'error');
      break;
    case 'welcome': {
      app.state.me = { id: m.id, name: m.name, look: m.look, token: m.token };
      app.state.inventory = m.inventory;
      app.state.role = m.role;
      if (fichaMode) {
        loginTries = 0;
        telaFicha?.show();
        app.emit('me');
        reconnecting = false;
        break;
      }
      if (!tableMode && m.role !== 'gm') {
        // não é o mestre: esta tela vira a da mesa
        if (gmKey) forgetGmKey();
        location.replace(`${location.pathname}?mesa`);
        return;
      }
      if (!tableMode) saveLogin(m.name, m.look);
      loginTries = 0;
      shell?.show();
      table?.show();
      // o tabuleiro abriu: a tela de entrada some devagar por cima dele
      entrada?.sair();
      entrada = null;
      app.emit('me');
      app.emit('inventory');
      if (reconnecting && app.state.room) wantRoom = app.state.room.id;
      else {
        let last: number | null = null;
        try {
          last = Number(localStorage.getItem(LAST_ROOM)) || null;
          // cena de abertura nova (demonstração): abre uma vez
          if (m.home && localStorage.getItem(HOME_SEEN) !== String(m.home)) {
            localStorage.setItem(HOME_SEEN, String(m.home));
            last = m.home;
          }
        } catch {
          /* sem storage */
        }
        wantRoom = last ?? m.home ?? 1;
      }
      reconnecting = false;
      break;
    }
    case 'error':
      // a mesa não escolhe nome: se o dela estiver em uso, tenta outro
      if (!app.state.me && tableMode && loginTries++ < 3) login(true);
      else if (!app.state.me && fichaMode) {
        if (/inválido/.test(m.msg)) esquecerChaveFicha();
        telaFicha?.erro(m.msg);
      } else if (!app.state.me && entrada) entrada.erro(m.msg);
      else toast(m.msg, 'error');
      break;
    case 'notice':
      toast(m.msg);
      break;
    case 'fichas':
      shell?.fichas.setFichas(m.fichas, m.nova);
      shell?.setFichasMapa(m.fichas);
      shell?.combate.setFichas(m.fichas);
      telaFicha?.setFichas(m.fichas, m.nova, m.equipe);
      break;
    case 'docs':
      telaFicha?.jogo.setDocs(m.docs);
      shell?.setDocs(m.docs);
      break;
    case 'combate':
      shell?.combate.setCombate(m.combate, m.podeDesfazer, m.ameacas);
      table?.setCombate(m.combate);
      break;
    case 'bar':
    case 'barFechar':
    case 'barJogo':
      // os jogos do bar: no celular do jogador, ou na janelinha do mestre (o NPC)
      (telaFicha?.bar ?? barMestre)?.receber(m);
      break;
    case 'viagemTela':
      mostrarTelaViagem(m.fase, m.ilustracao, m.texto, m.reserva);
      break;
    case 'lugares':
      app.state.lugares = m.lugares;
      app.emit('lugares');
      break;
    case 'bestiario':
      app.state.bestiario = m.criaturas;
      app.state.npcs = m.npcs ?? [];
      app.emit('bestiario');
      break;
    case 'roomList':
      app.state.rooms = m.rooms;
      // a ficha do jogador não abre o tabuleiro
      if (fichaMode) break;
      if (wantRoom !== null) {
        const target = m.rooms.find((r) => r.id === wantRoom) ?? m.rooms.find((r) => r.id === 1) ?? m.rooms[0];
        wantRoom = null;
        if (target) net.send({ t: 'join', roomId: target.id });
      }
      app.emit('rooms');
      break;
    case 'roomCreated':
      net.send({ t: 'join', roomId: m.id });
      break;
    case 'roomEnter':
      app.state.room = m.room;
      endPlacement();
      view.enter(m.room, m.items, m.wallItems, m.users, app.pendingActive ?? view.myId);
      if (app.pendingActive && view.users.has(app.pendingActive)) {
        view.setActive(app.pendingActive);
        view.focusUser(app.pendingActive);
      }
      app.pendingActive = null;
      try {
        localStorage.setItem(LAST_ROOM, String(m.room.id));
      } catch {
        /* sem storage */
      }
      app.emit('room');
      app.emit('selection');
      table?.onRoom();
      break;
    case 'roomUpdate':
      app.state.room = m.room;
      view.updateInfo(m.room);
      app.emit('room');
      break;
    case 'marca':
      view.receberMarca(m.marca);
      break;
    case 'userJoin':
      view.addUser(m.user);
      break;
    case 'userLeave':
      view.removeUser(m.id);
      break;
    case 'tokenTravel':
      // a peça comandada atravessou uma passagem: a câmera vai junto para o cômodo novo
      // (a mesa segue o mestre sozinha)
      if (!tableMode && m.tokenId === view.myId && m.roomId !== app.state.room?.id) {
        app.pendingActive = m.tokenId;
        net.send({ t: 'join', roomId: m.roomId });
      }
      break;
    case 'userLook':
      view.setLook(m.id, m.look);
      clearIconCache();
      if (me && m.id === me.id) me.look = m.look;
      app.emit('selection');
      break;
    case 'status':
      for (const s of m.updates) view.applyStatus(s);
      break;
    case 'chat':
      break;
    case 'action':
      view.wave(m.id);
      break;
    case 'itemAdd':
      view.addItem(m.item);
      app.emit('items');
      break;
    case 'itemUpdate':
      view.updateItem(m.item);
      app.emit('items');
      break;
    case 'itemRemove':
      view.removeItem(m.id);
      app.emit('items');
      break;
    case 'wallAdd':
    case 'wallUpdate':
      view.setWallItem(m.item);
      app.emit('items');
      break;
    case 'wallRemove':
      view.removeWallItem(m.id);
      app.emit('items');
      break;
    case 'inventory':
      app.state.inventory = m.items;
      app.emit('inventory');
      break;
    case 'campaign':
      shell?.setCampaign(m.state);
      table?.setCampaign(m.state);
      break;
    case 'peek':
      shell?.onPeek(m.room, m.items, m.wallItems);
      break;
    case 'lockResult':
      shell?.onLockResult(m);
      break;
    case 'characters':
      app.state.characters = m.list;
      sprites.setDefs(m.list);
      clearIconCache();
      app.emit('characters');
      break;
  }
};

net.onClose = (code) => {
  if (code === 4000) {
    // a sessão foi aberta em outra aba
    document.body.append(
      h('div', { class: 'replaced' }, h('div', { class: 'paper' }, h('h3', { class: 'paper-title' }, 'TABULEIRO ABERTO EM OUTRA ABA'), h('p', null, 'Esta aba foi desconectada.'), h('button', { class: 'pbtn primary', onclick: () => location.reload() }, 'Usar esta aba'))),
    );
    return;
  }
  if (app.state.me) {
    toast('Conexão perdida. Reconectando…', 'error');
    reconnecting = true;
  }
  setTimeout(() => net.connect(), 1500);
};
net.connect();

sprites.onLoad = () => {
  clearIconCache();
  app.emit('characters');
};

// ---------- teclado ----------
window.addEventListener('keydown', (e) => {
  const tgt = e.target as HTMLElement;
  if (tgt && (tgt.tagName === 'INPUT' || tgt.tagName === 'TEXTAREA' || tgt.tagName === 'SELECT')) return;
  // a tela da mesa é só para ver
  if (!app.state.me || !shell) return;
  // com uma janela da ficha aberta (a requisição, uma escolha), os atalhos do tabuleiro ficam quietos; o Esc fecha a janela
  if (janelaAberta()) return;
  const v = app.view;
  if (e.key === 'Escape') {
    if (v.placement) endPlacement();
    else if (shell.ferramentas.desligar()) return;
    else if (!closeTopWindow()) v.select(null);
    return;
  }
  if (v.placement && (e.key === 'r' || e.key === 'R')) {
    v.rotatePlacement();
    return;
  }
  if (e.key === 'Delete' && app.canBuild && v.selection && v.selection.kind !== 'user') {
    net.send({ t: 'pickup', id: v.selection.id });
    return;
  }
  // Q e E giram o personagem selecionado (ou o comandado)
  if ((e.key === 'q' || e.key === 'Q' || e.key === 'e' || e.key === 'E') && !v.placement && !e.ctrlKey && !e.metaKey && !e.altKey) {
    const target = v.selection?.kind === 'user' ? v.selection.id : v.myId;
    if (target) shell.turnToken(target, e.key.toLowerCase() === 'e');
    return;
  }
  // P, D e N: as ferramentas da mesa (apontar, desenhar, névoa)
  const ferr = { p: 'ponto', d: 'traco', n: 'nevoa' } as const;
  const k = e.key.toLowerCase();
  if (k in ferr && (k !== 'n' || NEVOA_NA_TELA) && !v.placement && !e.ctrlKey && !e.metaKey && !e.altKey) {
    shell.ferramentas.alternar(ferr[k as keyof typeof ferr]);
    return;
  }
  // T troca a câmera do tabuleiro: isométrica ou tática (a sala de cima)
  if ((e.key === 't' || e.key === 'T') && !v.placement && !e.ctrlKey && !e.metaKey && !e.altKey) {
    shell.trocarVista();
    return;
  }
  // 1-9: comanda o personagem da barra
  if (/^[1-9]$/.test(e.key) && !v.placement) {
    const id = shell.partyIds()[Number(e.key) - 1];
    if (id && v.users.has(id)) {
      v.setActive(id);
      v.focusUser(id);
    }
  }
});
