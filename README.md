# context-diet

A Claude Code [agent skill](https://docs.claude.com/en/docs/claude-code/skills) that
cuts per-request **system-prompt bloat** — the tool definitions, bundled-skills
catalogue, and feature instructions that ship on every turn and get billed every turn.

Method adapted from aihero.dev,
[How to kill the bloat in Claude Code's system prompt](https://www.aihero.dev/how-to-kill-the-bloat-in-claude-codes-system-prompt).

**Live:** https://cskwork.github.io/context-diet-skill/

## What's inside

| File | Purpose |
| --- | --- |
| `SKILL.md` | the skill: the method, quick start, the menu |
| `REFERENCE.md` | full 6-step method + per-tool cost/benefit tables |
| `proxy.mjs` | logging proxy that ranks every tool by size (Node built-ins only) |
| `scripts/apply-config.mjs` | deterministic, backed-up settings merge |
| `templates/settings.aggressive.json` | the full menu — biggest savings |
| `templates/settings.conservative.json` | safe subset — keeps plan mode + AskUserQuestion |

## The core idea

A **bare** tool name in `permissions.deny` removes the tool's *definition* from the
payload. A **scoped** rule (`"Skill(dataviz)"`) only blocks the call but keeps the
definition. To shrink tokens: deny bare names, and flip `disable*` feature flags.

## Install

Copy into your skills directory:

```bash
git clone https://github.com/cskwork/context-diet-skill.git
cp -r context-diet-skill ~/.claude/skills/context-diet
```

Then invoke it in Claude Code with `/context-diet`, or just ask to "reduce Claude Code
token usage".

## Use

```bash
# 1. See the current split
/context

# 2. Rank every tool by size (optional; use PORT=9000 if 8787 is taken)
node proxy.mjs
ANTHROPIC_BASE_URL=http://localhost:8787 claude   # another terminal

# 3. Apply the diet (backs up first)
node scripts/apply-config.mjs                      # global ~/.claude/settings.json
node scripts/apply-config.mjs --project            # this project only
node scripts/apply-config.mjs --dry-run            # preview only

# 4. Restart Claude Code, then re-check
/context
```

Treat the config as **a menu, not a prescription** — keep any tool or feature you
actually use. See `REFERENCE.md` for what each deny entry costs you.

## Credit

Technique by [aihero.dev](https://www.aihero.dev/how-to-kill-the-bloat-in-claude-codes-system-prompt).
This repo packages it as a reusable skill with a measurement proxy and a safe,
idempotent config applier.

## License

MIT — see [LICENSE](LICENSE).
