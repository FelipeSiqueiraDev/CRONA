// Traz as contas dos jogadores do C.R.I.S para o CRONA (18/10), cada uma ligada à ficha do personagem dela, para eles
// entrarem com a mesma senha de sempre (o bcrypt de lá vira scrypt no primeiro login; server/src/importarCris.ts).
//
//   npx tsx scripts/dev/importar-cris.mts [--sim] [--visual | --banco <nome>]
//
// --sim: só mostra o que faria, sem gravar.
// --visual: na cópia dos testes visuais (crona_visual); --banco <nome>: em outro banco do crona-postgres. Sem isso, no
// banco do server/.env (o jogo de verdade).
//
// O banco do C.R.I.S (o container cris-postgres) é só lido, numa transação somente leitura. A senha nunca aparece: o
// hash vai direto do C.R.I.S para a conta. Rodar de novo não duplica (a conta guarda o id de lá). O servidor que usa o
// banco do CRONA precisa estar parado (ele guarda tudo na memória e gravaria por cima); se estiver no ar, o banco
// está travado e o script para sem gravar nada.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const args = process.argv.slice(2);
const opcao = (nome: string) => {
  const i = args.indexOf(nome);
  if (i < 0) return undefined;
  const v = args[i + 1];
  args.splice(i, 2);
  return v;
};
const marcado = (nome: string) => {
  const i = args.indexOf(nome);
  if (i >= 0) args.splice(i, 1);
  return i >= 0;
};
const sim = marcado('--sim');
const visual = marcado('--visual');
const outroBanco = visual ? 'crona_visual' : opcao('--banco');
const container = opcao('--cris') ?? 'cris-postgres';
if (args.length || (outroBanco && !/^crona_\w+$/.test(outroBanco))) {
  console.log('uso: npx tsx scripts/dev/importar-cris.mts [--sim] [--visual | --banco crona_<nome>] [--cris <container>]');
  process.exit(1);
}

// os jogadores do C.R.I.S ligados a um personagem (só leitura: a transação nem deixa gravar)
const SQL = `select coalesce(json_agg(json_build_object(
  'id', u.id, 'username', u.username, 'nome', u.name, 'email', u.email, 'hash', u.password_hash, 'personagem', a.character_name
) order by u.username), '[]')
from users u
join campaign_members cm on cm.user_id = u.id and cm.role = 'jogador'
join agent_sheets a on a.id = cm.agent_sheet_id`;
const saida = execFileSync('docker', ['exec', '-e', 'PGOPTIONS=-c default_transaction_read_only=on', container, 'psql', '-U', 'cris', '-d', 'cris', '-tAc', SQL], {
  encoding: 'utf8',
  stdio: ['ignore', 'pipe', 'inherit'],
});
const usuarios = JSON.parse(saida.trim() || '[]');

// o banco do server/.env; sem ele, o db.json
const envPath = path.join(REPO, 'server', '.env');
const env = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';
let url = /^CRONA_DB_URL=(.*)$/m.exec(env)?.[1]?.trim();
if (outroBanco) {
  if (!url) throw new Error('--visual e --banco precisam do CRONA_DB_URL no server/.env');
  url = url.replace(/\/crona(\?|$)/, `/${outroBanco}$1`);
  if (!url.includes(`/${outroBanco}`)) throw new Error(`não consegui apontar para ${outroBanco}`);
}
if (url) process.env.CRONA_DB_URL = url;

const modulo = (p: string) => import(pathToFileURL(path.join(REPO, p)).href);
const { abrirBanco } = await modulo('server/src/banco/index.ts');
const { importarContasCris } = await modulo('server/src/importarCris.ts');

const banco = await abrirBanco();
const db = await banco.carregar();
if (!db) throw new Error('o banco está vazio (suba o servidor uma vez antes)');
const feitos = importarContasCris(db, usuarios);
for (const r of feitos) console.log(`  ${r.nome.padEnd(16)} ${r.personagem.padEnd(22)} ficha ${String(r.fichaId ?? '-').padEnd(3)} ${r.feito}`);
if (sim) console.log('(--sim: nada gravado)');
else {
  await banco.salvar(db);
  console.log(`Gravado em ${url ? url.replace(/\/\/[^@]*@/, '//') : 'server/data/db.json'}.`);
}
await banco.fechar();
