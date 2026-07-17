# context-diet — reference

Full method and cost/benefit tables. Source: aihero.dev,
"How to kill the bloat in Claude Code's system prompt."

## The six-step method

1. **Measure baseline** — run `/context`. Record system / tools / MCP / memory /
   message token counts. Limitation: one combined "tools" number.
2. **Find the biggest offenders** — run `proxy.mjs`, then
   `ANTHROPIC_BASE_URL=http://localhost:8787 claude`. Requests are logged to `./logs/`
   as Markdown and a ranked tool-size table prints live, so you deny exact tools
   instead of guessing.
3. **Disable whole features with `disable*` flags** — one flag removes a feature plus
   its bundled tools and instructions.
4. **Remove individual tools with `deny` rules** — a **bare** tool name in
   `permissions.deny` removes the definition; a **scoped** rule (`"Skill(dataviz)"`)
   only blocks the call and keeps the definition.
5. **Apply the full configuration** — into `~/.claude/settings.json` (all projects) or
   `.claude/settings.json` (one project).
6. **Re-measure** — restart Claude Code, run `/context`, confirm the drop.

## Bare name vs scoped rule

| Rule | Blocks the call | Removes the definition (saves tokens) |
| --- | :---: | :---: |
| `"NotebookEdit"` (bare) | yes | **yes** |
| `"Skill(dataviz)"` (scoped) | yes | no |

For payload savings, always deny the **bare** name.

## Disable flags

| Flag | Removes |
| --- | --- |
| `disableBundledSkills` | all Anthropic-bundled skills at once (your `~/.claude/skills` and plugin skills stay; bundled slash commands stay typable) |
| `disableWorkflows` | the multi-agent `Workflow` tool — usually the single largest line in the table |
| `disableRemoteControl` | remote-control / mobile push surface |
| `disableClaudeAiConnectors` | claude.ai MCP connector surface |
| `disableArtifact` | the `Artifact` publishing tool |

Selective skills without nuking all: `skillOverrides` with per-skill `"off"` or
`"user-invocable-only"`.

## What each denied tool costs you

| Denied tool | You lose |
| --- | --- |
| `EnterPlanMode` / `ExitPlanMode` | plan mode (research-then-approve workflow) |
| `AskUserQuestion` | structured clarifying questions mid-task |
| `NotebookEdit` | editing Jupyter `.ipynb` cells |
| `DesignSync` | claude.ai design-system push/pull |
| `SendMessage` | agent-to-agent messaging in multi-agent runs |
| `ScheduleWakeup` | self-paced `/loop` dynamic mode |
| `PushNotification` | desktop/phone notifications |
| `RemoteTrigger` | claude.ai remote routines |
| `ReportFindings` | structured code-review finding output |
| `CronCreate` / `CronDelete` / `CronList` | in-session scheduled prompts |

Keep task/worktree tools (`Task`, `Agent`) — background jobs and multi-agent runs
depend on them; they are **not** in the deny list.

## Gotchas

- Settings changes need a **restart** to reload — the running session is unaffected.
- If `ANTHROPIC_BASE_URL` is already set (e.g. an existing token proxy on :8787),
  run the measurement proxy on a different port and point the base URL there, or the
  two proxies will fight over the port.
- `disableBundledSkills` hides bundled skills from the auto-catalogue but you can
  still invoke them by typing the slash command.
- Deny by bare name only — a scoped rule keeps the (token-costing) definition.

## Source

https://www.aihero.dev/how-to-kill-the-bloat-in-claude-codes-system-prompt
