#!/usr/bin/env node
/**
 * Sonda do spike #3: autentica na API Olho Vivo e grava respostas brutas para análise.
 *
 * Uso (o token vem do ambiente; nunca passe por argumento):
 *   node --env-file=.env scripts/sptrans-probe.mjs <dir-de-saida-fora-do-repo> [termoParada] [termoLinha]
 *
 * Segurança: o token e o cookie de sessão nunca são impressos nem gravados.
 * As respostas brutas podem conter coordenadas; sanitize antes de versionar (scripts/sptrans-sanitize.mjs).
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

const BASE_URL = 'https://api.olhovivo.sptrans.com.br/v2.1';
const [outDir, stopTerm = 'Paulista', lineTerm = '875A'] = process.argv.slice(2);
const token = process.env.SPTRANS_API_TOKEN;

if (!outDir) throw new Error('Informe o diretório de saída.');
if (!token) throw new Error('SPTRANS_API_TOKEN ausente no ambiente.');
// Respostas brutas não são versionáveis: exige diretório fora do repositório.
const fromRepo = relative(resolve(import.meta.dirname, '..'), resolve(outDir));
if (!fromRepo.startsWith('..') && !/^[a-zA-Z]:/.test(fromRepo)) throw new Error('Use um diretório de saída fora do repositório.');
mkdirSync(outDir, { recursive: true });

let cookie = '';

/** Executa uma chamada e grava status, duração, cabeçalhos relevantes e corpo. */
async function call(name, method, path, { auth = true } = {}) {
  const started = Date.now();
  const response = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: auth && cookie ? { cookie } : {},
  });
  const elapsedMs = Date.now() - started;
  const text = await response.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = text.slice(0, 500);
  }
  const record = {
    name,
    request: { method, path: path.replace(/token=[^&]+/, 'token=<redacted>') },
    status: response.status,
    elapsedMs,
    headers: {
      date: response.headers.get('date'),
      'content-type': response.headers.get('content-type'),
    },
    body,
  };
  writeFileSync(join(outDir, `${name}.json`), JSON.stringify(record, null, 2));
  console.log(`${name}: HTTP ${response.status} em ${elapsedMs} ms`);
  return { response, body };
}

// 1. Sem autenticação: como a API responde?
await call('00-previsao-sem-auth', 'GET', '/Previsao/Parada?codigoParada=1');

// 2. Token inválido
await call('01-login-token-invalido', 'POST', '/Login/Autenticar?token=invalido', { auth: false });

// 3. Login real: o cookie fica só em memória
const login = await fetch(`${BASE_URL}/Login/Autenticar?token=${encodeURIComponent(token)}`, { method: 'POST' });
const loginBody = await login.text();
cookie = (login.headers.getSetCookie?.() ?? [])
  .map((c) => c.split(';')[0])
  .join('; ');
const authenticated = loginBody === 'true';
// Só o resultado booleano é registrado: o corpo do login nunca é impresso nem gravado.
console.log(`02-login: HTTP ${login.status}, autenticado=${authenticated}, cookie=${cookie ? 'recebido' : 'ausente'}`);
writeFileSync(join(outDir, '02-login.json'), JSON.stringify({ status: login.status, authenticated, cookieReceived: Boolean(cookie) }, null, 2));
if (!authenticated) throw new Error('Autenticação falhou; abortando.');

// 4. Descoberta de linha e paradas
const { body: lines } = await call('03-linha-buscar', 'GET', `/Linha/Buscar?termosBusca=${encodeURIComponent(lineTerm)}`);
const { body: stops } = await call('04-parada-buscar', 'GET', `/Parada/Buscar?termosBusca=${encodeURIComponent(stopTerm)}`);

const line = Array.isArray(lines) ? lines[0] : undefined;
const oppositeLine = Array.isArray(lines) ? lines.find((l) => l.lt === line?.lt && l.sl !== line?.sl) : undefined;
const lineStops = line
  ? (await call('05-paradas-por-linha', 'GET', `/Parada/BuscarParadasPorLinha?codigoLinha=${line.cl}`)).body
  : undefined;

// 5. Previsões
const stop = Array.isArray(stops) ? stops[0] : undefined;
if (stop) await call('06-previsao-parada', 'GET', `/Previsao/Parada?codigoParada=${stop.cp}`);
// Parada no trajeto da linha (meio da lista), para a consulta combinada ter chance de retornar dados
const routeStop = Array.isArray(lineStops) ? lineStops[Math.floor(lineStops.length / 2)] : undefined;
if (routeStop && line) {
  await call('07-previsao-parada-linha', 'GET', `/Previsao?codigoParada=${routeStop.cp}&codigoLinha=${line.cl}`);
  await call('07b-previsao-parada-do-trajeto', 'GET', `/Previsao/Parada?codigoParada=${routeStop.cp}`);
}
if (routeStop && oppositeLine) {
  await call('07c-previsao-parada-linha-sentido-oposto', 'GET', `/Previsao?codigoParada=${routeStop.cp}&codigoLinha=${oppositeLine.cl}`);
}
if (line) await call('08-previsao-linha', 'GET', `/Previsao/Linha?codigoLinha=${line.cl}`);

// 6. Casos de borda
await call('09-previsao-parada-inexistente', 'GET', '/Previsao/Parada?codigoParada=999999999');
await call('10-previsao-parada-invalida', 'GET', '/Previsao/Parada?codigoParada=abc');
