// Os PV, PE, SAN e Defesa das fichas do C.R.I.S (seedFichasCris) pelo motor, ao lado dos do C.R.I.S.
//   npx tsx scripts/dev/npcs-cris-numeros.mts
import fs from 'node:fs';
import { regras } from '@crona/shared';
import { FICHAS_CRIS } from '../../server/src/seedFichasCris';

const cris = JSON.parse(fs.readFileSync(new URL('../../docs/fichas-cris/fichas-do-cris.json', import.meta.url), 'utf8')).agent_sheets as Record<string, number | string>[];
for (const e of FICHAS_CRIS) {
  const s = cris.find((x) => x.character_name === e.nomeCris)!;
  const c = regras.calcular(e.ficha);
  console.log(e.chave.padEnd(14), `pv ${c.pv}/${s.pv_max}`, `pe ${c.pe}/${s.pe_max}`, `san ${c.san}/${s.san_max}`, `def ${c.defesa}/${s.defesa}`);
}
