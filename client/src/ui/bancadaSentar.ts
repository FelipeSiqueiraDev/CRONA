/**
 * A bancada de sentar (28/10, o Felipe: "Tá dando certo isso não viu"; a conta automática não acertava todo mundo):
 * só com ?sentar no endereço, e só na tela do mestre. A cena de agora vira, só neste navegador, uma fileira de assentos
 * (oito tipos, nas quatro direções) com um personagem sentado em cada. O mestre clica numa peça e acerta a pose com
 * Alt + setas (main.ts), e o ajuste fica salvo junto da arte do personagem (sentado.json). [ e ] trocam o personagem.
 * Nada disso vai para o servidor além do ajuste: recarregar a página volta a cena de verdade.
 */
import type { CharacterDef } from '@crona/shared';
import type { RoomView } from '../room/RoomView';
import { sprites } from '../render/sprites';
import { toast } from './dom';

const ASSENTOS = ['chair_office', 'chair_wood', 'cadeira_jantar_luxo', 'poltrona_preta', 'armchair', 'sofa_velvet', 'bench', 'banco_igreja'];
const GIROS = [0, 2, 4, 6];
const PASSO = 3;

export function ligarBancadaSentar(view: RoomView) {
  let i = 0;
  const personagens = (): CharacterDef[] => sprites.all().filter((d) => d.sentado && d.height >= 70).sort((a, b) => a.name.localeCompare(b.name));
  const montar = () => {
    const map = view.map;
    const lista = personagens();
    if (!map || !lista.length) return toast('Bancada de sentar: entre numa cena (e espere os personagens carregarem).');
    const def = lista[((i % lista.length) + lista.length) % lista.length];
    // um pedaço de chão livre do tamanho da bancada
    const larg = ASSENTOS.length * PASSO;
    const fundo = GIROS.length * PASSO;
    let origem: [number, number] | null = null;
    for (let y0 = 0; y0 + fundo <= map.height && !origem; y0++)
      for (let x0 = 0; x0 + larg <= map.width && !origem; x0++) {
        let ok = true;
        for (let y = y0; y < y0 + fundo && ok; y++) for (let x = x0; x < x0 + larg && ok; x++) ok = map.floorHeight(x, y) !== null;
        if (ok) origem = [x0, y0];
      }
    if (!origem) return toast('Bancada de sentar: esta cena não tem chão livre que chegue (24 × 12 casas).');
    for (const it of [...map.allItems()]) view.removeItem(it.id);
    for (const id of [...view.users.keys()]) view.removeUser(id);
    let id = 900000;
    let peca = -900000;
    ASSENTOS.forEach((assento, a) =>
      GIROS.forEach((rot, g) => {
        const x = origem![0] + a * PASSO;
        const y = origem![1] + g * PASSO;
        view.addItem({ id: id++, defId: assento, x, y, z: 0, rot, state: 0 });
        view.addUser({
          id: peca--,
          name: `${def.name} · ${assento} · ${rot}`,
          look: { skin: '#e8b98f', hair: '#3b2618', hairStyle: 0, top: '#2b2a30', pants: '#1c1b1f', shoes: '#3d3a40', outfit: 1, extra: 0, charId: def.id },
          x,
          y,
          z: map.standHeight(x, y),
          dir: rot,
          headDir: rot,
          sit: 1,
          dance: false,
        });
      }),
    );
    toast(`Bancada de sentar: ${def.name} (${(((i % lista.length) + lista.length) % lista.length) + 1} de ${lista.length}). [ ] troca; clique e Alt + setas acerta.`);
  };
  window.addEventListener('keydown', (e) => {
    const tgt = e.target as HTMLElement;
    if (tgt && (tgt.tagName === 'INPUT' || tgt.tagName === 'TEXTAREA')) return;
    if (e.key === '[' || e.key === ']') {
      i += e.key === ']' ? 1 : -1;
      montar();
    }
  });
  return montar;
}
