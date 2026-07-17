---
name: context-diet
description: Cut Claude Code's per-request system-prompt bloat by measuring and disabling unused tools, bundled skills, and features via settings.json. Use when the user wants to reduce Claude Code token usage or context size, shrink the system prompt, make requests cheaper or faster, run a logging proxy to rank tools by size, or asks about /context, disableBundledSkills, disableWorkflows, or permissions.deny for tool definitions.
---

# context-diet

Every Claude Code request ships tool definitions, a bundled-skills catalogue, and
feature instructions you may never use — tens of thousands of tokens per turn,
billed every turn, that the model reads before reaching your actual problem. This
skill measures that overhead and trims it.

Method adapted from aihero.dev, "How to kill the bloat in Claude Code's system prompt."

## The idea in one line

A **bare tool name** in `permissions.deny` (e.g. `"NotebookEdit"`) removes the tool's
*definition* from the payload. A **scoped rule** (e.g. `"Skill(dataviz)"`) only blocks
the call but keeps the definition. To shrink tokens, deny bare names and flip `disable*` flags.

## Quick start — apply the diet

```bash
node scripts/apply-config.mjs            # merge into ~/.claude/settings.json (global)
node scripts/apply-config.mjs --project  # into ./.claude/settings.json (this project)
node scripts/apply-config.mjs --dry-run  # preview, write nothing
```

The script **backs up** the target first, then appends deny rules (deduped, existing
order preserved) and sets the disable flags. Then **restart Claude Code** and run
`/context` to confirm the drop. Pass `--template templates/settings.conservative.json`
for the safe subset.

## Measure — before and after

1. `/context` in a session prints the system / tools / MCP / memory / message token
   split. It reports one combined "tools" number, not a per-tool ranking.
2. For a per-tool ranking, run the logging proxy:
   ```bash
   node proxy.mjs                                   # :8787, forwards to api.anthropic.com
   ANTHROPIC_BASE_URL=http://localhost:8787 claude  # in another terminal
   ```
   Each request is logged to `./logs/*.md` and a ranked tool-size table prints live.
   If port 8787 is already taken (e.g. an existing token proxy), use `PORT=9000 node proxy.mjs`
   and point `ANTHROPIC_BASE_URL` at the same port.

## What the config does

- `permissions.deny: [bare tool names]` — drops those tool definitions from every request.
- `disableBundledSkills` — drops all Anthropic-bundled skills at once. Your own
  `~/.claude/skills` and plugin skills stay; bundled slash commands stay typable.
- `disableWorkflows` — drops the multi-agent `Workflow` tool (typically the single
  largest line in the table).
- `disableRemoteControl`, `disableClaudeAiConnectors`, `disableArtifact` — drop those
  feature surfaces and their instructions.
- Trim skills selectively instead of all-or-nothing: `skillOverrides` → `"off"` or
  `"user-invocable-only"` per skill.

## Menu, not prescription

Keep anything you use. Denying `EnterPlanMode`/`ExitPlanMode` removes plan mode;
`AskUserQuestion` removes clarifying questions; `NotebookEdit` breaks notebook edits;
`SendMessage`/`ScheduleWakeup` are used by multi-agent and `/loop` runs. See
[REFERENCE.md](REFERENCE.md) for the full 6-step method and the per-item cost table.

## Templates

- `templates/settings.aggressive.json` — the full menu, biggest savings.
- `templates/settings.conservative.json` — keeps plan mode + AskUserQuestion + bundled skills.
