#!/usr/bin/env node
// Minimal logging proxy for Claude Code -> Anthropic API (Node built-ins only).
//
// Forwards every request untouched to the real API, logs a per-request token/byte
// breakdown of the payload (system prompt, tools, messages), and prints a ranked
// table of the largest tool definitions so you can see exactly which tools to deny.
//
// Usage:
//   node proxy.mjs                              # listen on :8787, forward to api.anthropic.com
//   PORT=9000 node proxy.mjs                    # custom port (if 8787 is taken)
//   UPSTREAM=https://api.anthropic.com node proxy.mjs
// Then, in another terminal:
//   ANTHROPIC_BASE_URL=http://localhost:8787 claude
//
// Note: token counts are a rough ~4-bytes/token estimate for ranking, not exact billing.

import http from 'node:http';
import https from 'node:https';
import fs from 'node:fs';
import path from 'node:path';

const PORT = Number(process.env.PORT || 8787);
const UPSTREAM = new URL(process.env.UPSTREAM || 'https://api.anthropic.com');
const LOG_DIR = process.env.LOG_DIR || path.join(process.cwd(), 'logs');

fs.mkdirSync(LOG_DIR, { recursive: true });

const approxTokens = (b) => Math.round(b / 4);
const bytes = (s) => Buffer.byteLength(typeof s === 'string' ? s : JSON.stringify(s ?? ''), 'utf8');
const fmt = (n) => n.toLocaleString('en-US');

function analyze(body) {
  let payload;
  try { payload = JSON.parse(body); } catch { return null; }
  const tools = Array.isArray(payload.tools) ? payload.tools : [];
  const rows = tools
    .map((t) => { const b = bytes(t); return { name: t.name || '(unnamed)', bytes: b, tokens: approxTokens(b) }; })
    .sort((a, b) => b.bytes - a.bytes);
  const systemBytes = bytes(payload.system);
  const messagesBytes = bytes(payload.messages);
  const toolsBytes = rows.reduce((s, r) => s + r.bytes, 0);
  return { model: payload.model, rows, systemBytes, messagesBytes, toolsBytes, total: bytes(body) };
}

function printTable(a) {
  if (!a || !a.rows.length) return;
  const top = a.rows.slice(0, 25);
  const nameW = Math.max(4, ...top.map((r) => r.name.length));
  const width = nameW + 24;
  console.log('\n' + '='.repeat(width));
  console.log(`model=${a.model}  tools=${a.rows.length}  ~${fmt(approxTokens(a.total))} tok total`);
  console.log(`  system ~${fmt(approxTokens(a.systemBytes))} | tools ~${fmt(approxTokens(a.toolsBytes))} | messages ~${fmt(approxTokens(a.messagesBytes))} tok`);
  console.log('-'.repeat(width));
  console.log(`${'TOOL'.padEnd(nameW)}  ${'~TOK'.padStart(8)}  ${'BYTES'.padStart(9)}`);
  for (const r of top) {
    console.log(`${r.name.padEnd(nameW)}  ${fmt(r.tokens).padStart(8)}  ${fmt(r.bytes).padStart(9)}`);
  }
  if (a.rows.length > top.length) console.log(`... and ${a.rows.length - top.length} more`);
  console.log('='.repeat(width) + '\n');
}

function writeLog(a) {
  if (!a || !a.rows.length) return;
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const lines = [
    `# Request ${ts}`, '',
    `- model: \`${a.model}\``,
    `- total: ~${fmt(approxTokens(a.total))} tok (${fmt(a.total)} bytes)`,
    `- system: ~${fmt(approxTokens(a.systemBytes))} tok`,
    `- tools: ${a.rows.length} defs, ~${fmt(approxTokens(a.toolsBytes))} tok`,
    `- messages: ~${fmt(approxTokens(a.messagesBytes))} tok`, '',
    '## Tools by size', '', '| tool | ~tok | bytes |', '| --- | ---: | ---: |',
    ...a.rows.map((r) => `| ${r.name} | ${fmt(r.tokens)} | ${fmt(r.bytes)} |`),
  ];
  fs.writeFileSync(path.join(LOG_DIR, `${ts}.md`), lines.join('\n'));
}

const server = http.createServer((req, res) => {
  const chunks = [];
  req.on('data', (c) => chunks.push(c));
  req.on('end', () => {
    const body = Buffer.concat(chunks);
    if (req.method === 'POST' && req.url.includes('/messages')) {
      const a = analyze(body.toString('utf8'));
      printTable(a);
      writeLog(a);
    }
    const upstreamReq = https.request({
      protocol: UPSTREAM.protocol,
      hostname: UPSTREAM.hostname,
      port: UPSTREAM.port || 443,
      method: req.method,
      path: req.url,
      headers: { ...req.headers, host: UPSTREAM.host },
    }, (upstreamRes) => {
      res.writeHead(upstreamRes.statusCode || 502, upstreamRes.headers);
      upstreamRes.pipe(res);
    });
    upstreamReq.on('error', (e) => {
      res.writeHead(502, { 'content-type': 'text/plain' });
      res.end(`proxy upstream error: ${e.message}`);
    });
    if (body.length) upstreamReq.write(body);
    upstreamReq.end();
  });
});

server.listen(PORT, () => {
  console.log(`context-diet proxy on http://localhost:${PORT} -> ${UPSTREAM.origin}`);
  console.log(`logs:  ${LOG_DIR}`);
  console.log(`run:   ANTHROPIC_BASE_URL=http://localhost:${PORT} claude`);
});
