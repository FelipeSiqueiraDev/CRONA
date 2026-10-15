// Fala com o Códex pela linha de comando (15/10, o Felipe: "eu mando os prompts só para você e você manda nele").
// Acha o codex.exe do aplicativo do Códex (a pasta com o código muda a cada atualização: vale o mais novo), roda um
// pedido sem janela (`codex exec`) e grava a última resposta dele num arquivo.
//
//   node scripts/dev/codex.mjs [opções] <arquivo-do-pedido.txt | "pedido">
//
// Opções:
//   --pasta <dir>      onde o Códex trabalha (padrão: a pasta de arte, F:\Dhellow\CRONA\arte\TEXTURAS MAPA\BASE - Ordo Realitas)
//   --imagem <png>     imagem de referência anexada ao pedido (pode repetir)
//   --saida <arquivo>  onde gravar a última resposta (padrão: <pasta>\_codex-trabalho\resposta-<data>.txt)
//   --ler              só leitura (o Códex não grava nada; para perguntas e conferências)
//   --modelo <nome>    o modelo (padrão: o da configuração do Códex)
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const ARTE = 'F:\\Dhellow\\CRONA\\arte\\TEXTURAS MAPA\\BASE - Ordo Realitas';

function acharCodex() {
  const base = path.join(process.env.LOCALAPPDATA ?? path.join(os.homedir(), 'AppData', 'Local'), 'OpenAI', 'Codex', 'bin');
  const achados = (fs.existsSync(base) ? fs.readdirSync(base) : [])
    .map((d) => path.join(base, d, 'codex.exe'))
    .filter((f) => fs.existsSync(f))
    .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
  if (!achados.length) throw new Error(`não achei o codex.exe em ${base} (o aplicativo do Códex está instalado?)`);
  return achados[0];
}

const args = process.argv.slice(2);
let pasta = ARTE;
let saida = null;
let ler = false;
let modelo = null;
const imagens = [];
const resto = [];
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === '--pasta') pasta = args[++i];
  else if (a === '--imagem') imagens.push(path.resolve(args[++i]));
  else if (a === '--saida') saida = path.resolve(args[++i]);
  else if (a === '--ler') ler = true;
  else if (a === '--modelo') modelo = args[++i];
  else resto.push(a);
}
if (!resto.length) {
  console.error('uso: node scripts/dev/codex.mjs [--pasta dir] [--imagem png] [--saida arq] [--ler] <pedido.txt | "pedido">');
  process.exit(2);
}
const alvo = resto.join(' ');
const pedido = fs.existsSync(alvo) ? fs.readFileSync(alvo, 'utf8') : alvo;
if (!saida) {
  const dir = path.join(pasta, '_codex-trabalho');
  fs.mkdirSync(dir, { recursive: true });
  saida = path.join(dir, `resposta-${new Date().toISOString().replace(/[:.]/g, '-')}.txt`);
}

const exe = acharCodex();
const cmd = ['exec', '--skip-git-repo-check', '--color', 'never', '-C', pasta, '-s', ler ? 'read-only' : 'workspace-write', '-o', saida];
if (modelo) cmd.push('-m', modelo);
for (const im of imagens) cmd.push('--image', im);
cmd.push('-'); // o pedido vai pela entrada (sem limite de tamanho nem problema de aspas)

console.error(`[codex] ${exe}`);
console.error(`[codex] pasta: ${pasta} (${ler ? 'só leitura' : 'pode gravar'})`);
console.error(`[codex] resposta em: ${saida}`);
const p = spawn(exe, cmd, { stdio: ['pipe', 'inherit', 'inherit'] });
p.stdin.end(pedido);
p.on('exit', (code) => {
  console.error(`[codex] terminou (código ${code})`);
  process.exit(code ?? 1);
});
