#!/usr/bin/env node
// Apply the "context diet" to a Claude Code settings.json (Node built-ins only).
//
// Appends tool-name deny rules (which drop the tool DEFINITIONS from every request)
// and sets feature disable flags. Backs up the target before writing, dedupes deny
// entries, and preserves existing keys and array order.
//
// Usage:
//   node scripts/apply-config.mjs                 # ~/.claude/settings.json (global)
//   node scripts/apply-config.mjs --project       # ./.claude/settings.json (this project)
//   node scripts/apply-config.mjs --template templates/settings.conservative.json
//   node scripts/apply-config.mjs --dry-run       # print the plan, write nothing

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const args = process.argv.slice(2);
const has = (f) => args.includes(f);
const val = (f) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : null; };

const DEFAULT_DENY = [
  'EnterPlanMode', 'ExitPlanMode', 'DesignSync', 'NotebookEdit', 'SendMessage',
  'PushNotification', 'RemoteTrigger', 'ReportFindings', 'ScheduleWakeup',
  'AskUserQuestion', 'CronCreate', 'CronDelete', 'CronList',
];
const DEFAULT_FLAGS = {
  disableBundledSkills: true,
  disableWorkflows: true,
  disableRemoteControl: true,
  disableClaudeAiConnectors: true,
  disableArtifact: true,
};

let deny = DEFAULT_DENY;
let flags = DEFAULT_FLAGS;
const tpl = val('--template');
if (tpl) {
  const t = JSON.parse(fs.readFileSync(tpl, 'utf8'));
  deny = t.permissions?.deny ?? deny;
  flags = Object.fromEntries(Object.entries(t).filter(([k]) => k.startsWith('disable')));
}

const target = has('--project')
  ? path.join(process.cwd(), '.claude', 'settings.json')
  : path.join(os.homedir(), '.claude', 'settings.json');

const settings = fs.existsSync(target) ? JSON.parse(fs.readFileSync(target, 'utf8')) : {};
settings.permissions ??= {};
const existing = settings.permissions.deny ?? [];
const added = deny.filter((d) => !existing.includes(d));
settings.permissions.deny = [...existing, ...added];

const changedFlags = [];
for (const [k, v] of Object.entries(flags)) {
  if (settings[k] !== v) changedFlags.push(k);
  settings[k] = v;
}

console.log(`target: ${target}`);
console.log(`deny added (${added.length}): ${added.join(', ') || '(none — all already present)'}`);
console.log(`flags set (${changedFlags.length}): ${changedFlags.join(', ') || '(none changed)'}`);

if (has('--dry-run')) { console.log('\n--dry-run: nothing written'); process.exit(0); }

fs.mkdirSync(path.dirname(target), { recursive: true });
if (fs.existsSync(target)) {
  const bak = `${target}.bak-${new Date().toISOString().replace(/[:.]/g, '-')}`;
  fs.copyFileSync(target, bak);
  console.log(`backup: ${bak}`);
}
fs.writeFileSync(target, JSON.stringify(settings, null, 2) + '\n');
console.log('written. Restart Claude Code to reload, then run /context to confirm the drop.');
