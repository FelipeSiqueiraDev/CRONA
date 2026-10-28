/**
 * A bancada de sentar (28/10, o Felipe: "vamos criar um mapa limpo, sem outras salas, sem outros itens... coloca só um
 * tipo de cadeira lá; a gente resolve esse tipo de cadeira, vai pra próxima"): só com ?sentar no endereço, e só na tela
 * do mestre. Troca a cena, só neste navegador, por um quadrado de chão sem paredes com UM tipo de assento nas quatro
 * direções e UM personagem sentado em cada. O mestre clica numa peça e acerta com Alt + setas (o personagem) ou
 * Ctrl + setas (o assento) (main.ts). [ e ] trocam o personagem; , e . trocam o assento. ?sentar=poltrona_preta começa
 * por ele. Recarregar a página volta a cena de verdade.
 */
import type { CharacterDef, RoomInfo } from '@crona/shared';
import { iso } from '../render/iso';
import type { RoomView } from '../room/RoomView';
import { sprites } from '../render/sprites';
import { toast } from './dom';

const ASSENTOS = ['chair_wood', 'chair_office', 'cadeira_jantar_luxo', 'poltrona_preta', 'armchair', 'sofa_velvet', 'bench', 'banco_igreja', 'stool_bar'];
// as quatro direções em dois por dois, com folga para o banco comprido
const LUGARES: [number, number, number][] = [
  [1, 1, 0],
  [5, 1, 2],
  [1, 5, 4],
  [5, 5, 6],
];

export function ligarBancadaSentar(view: RoomView) {
  const pedido = new URLSearchParams(location.search).get('sentar');
  let a = Math.max(0, ASSENTOS.indexOf(pedido ?? ''));
  let p = 0;
  const personagens = (): CharacterDef[] => sprites.all().filter((d) => d.sentado && d.height >= 70).sort((x, y) => x.name.localeCompare(y.name));
  const roda = (i: number, n: number) => ((i % n) + n) % n;
  const montar = () => {
    const lista = personagens();
    if (!lista.length) return toast('Bancada de sentar: espere os personagens carregarem.');
    const def = lista[roda(p, lista.length)];
    const assento = ASSENTOS[roda(a, ASSENTOS.length)];
    const info: RoomInfo = {
      id: -1,
      name: 'Bancada de sentar',
      description: '',
      owner: '',
      heightmap: Array.from({ length: 9 }, () => '0'.repeat(9)).join('\n'),
      door: { x: 0, y: 0, dir: 2 },
      darkness: 0,
      lightMode: 'day',
      fog: 0,
      publicBuild: false,
      aberto: true,
      canBuild: true,
      isOwner: true,
    } as unknown as RoomInfo;
    const itens = LUGARES.map(([x, y, rot], i) => ({ id: 900000 + i, defId: assento, x, y, z: 0, rot, state: 0 }));
    view.enter(info, itens, [], [], 0);
    LUGARES.forEach(([x, y, rot], i) =>
      view.addUser({
        id: -900000 - i,
        name: `${def.name} · ${rot}`,
        look: { skin: '#e8b98f', hair: '#3b2618', hairStyle: 0, top: '#2b2a30', pants: '#1c1b1f', shoes: '#3d3a40', outfit: 1, extra: 0, charId: def.id },
        x,
        y,
        z: view.map?.standHeight(x, y) ?? 0,
        dir: rot,
        headDir: rot,
        sit: 1,
        dance: false,
      }),
    );
    // a câmera no meio das quatro, de perto
    view.setZoom(2);
    const [mx, my] = iso(3.5, 3.5, 0);
    view.panTo(mx, my, false);
    document.title = `Sentar: ${assento} · ${def.name}`;
  };
  window.addEventListener('keydown', (e) => {
    const tgt = e.target as HTMLElement;
    if (tgt && (tgt.tagName === 'INPUT' || tgt.tagName === 'TEXTAREA')) return;
    if (e.ctrlKey || e.altKey || e.metaKey) return;
    if (e.key === '[' || e.key === ']') p += e.key === ']' ? 1 : -1;
    else if (e.key === ',' || e.key === '.') a += e.key === '.' ? 1 : -1;
    else return;
    montar();
  });
  return montar;
}
