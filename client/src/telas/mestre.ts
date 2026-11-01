/**
 * A tela do mestre num pedaço só (01/11): a interface inteira (MAPA, COMBATE, FICHAS, as janelas do mestre e os jogos
 * do bar). O main.ts baixa este pedaço só quando quem abre não é a mesa nem o celular do jogador.
 */
import type { App } from '../ui/app';
import { BarJogos } from '../ui/barJogos';
import { CatalogWin, InventoryWin, type StartPlace } from '../ui/catalog';
import { CharactersWin } from '../ui/characters';
import { FxWin } from '../ui/fx';
import { HelpWin } from '../ui/help';
import { NavigatorWin } from '../ui/navigator';
import { RoomSettingsWin } from '../ui/roomSettings';
import { Shell } from '../ui/shell';

export function montarMestre(app: App, startPlace: StartPlace, sairDaConta: () => void) {
  const navigator = new NavigatorWin(app);
  const catalog = new CatalogWin(app, startPlace);
  const inventory = new InventoryWin(app, startPlace);
  const characters = new CharactersWin(app);
  const settings = new RoomSettingsWin(app);
  const help = new HelpWin();
  const fx = new FxWin(app);
  const shell = new Shell(app, {
    navigator: () => navigator.toggle(),
    catalog: () => catalog.toggle(),
    trocar: (id, defId) => catalog.trocar(id, defId),
    inventory: () => inventory.toggle(),
    characters: () => characters.toggle(),
    settings: () => settings.toggle(),
    fx: () => fx.toggle(),
    help: () => help.toggle(),
    logout: sairDaConta,
  });
  /** os jogos do bar em que o mestre joga por um NPC (janelinha no canto) */
  const bar = new BarJogos(app, 'mestre');
  return { shell, bar };
}
