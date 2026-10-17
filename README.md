# pi-advisor-goal

A local, **patched** pair of [pi](https://github.com/badlogic/pi-mono) packages that together
form a persistent advisor + goal system for the agent. This repo is a self-contained snapshot of
the two extensions as they are actually run on this machine — upstream sources plus the local
patches — so the custom behavior survives a reinstall without re-deriving it by hand.

## What's here

| Package | Upstream | What it does |
|---|---|---|
| `pi-goal` | [Michaelliv/pi-goal](https://github.com/Michaelliv/pi-goal) | `/goal` — a persistent, thread-scoped objective the agent keeps working toward until complete, paused, cleared, or token-budget-limited. Adds `create_goal` / `get_goal` / `update_goal` tools, a continuation loop, a live status line, and strong completion-audit guidance. |
| `pi-omplike-advisor` | [pasky/pi-omplike-advisor](https://github.com/pasky/pi-omplike-advisor) | A long-lived **second model** that reviews the primary agent's work each turn and injects concise advice inline (`nit` / `concern` / `blocker`). It is read-only (it cannot edit or execute), self-compacts its context, and never hard-interrupts the primary. |

## The local patches

These are the deltas from upstream that make the pair work together and survive provider
outages. They are called out by name so they can be re-applied after an upstream reinstall
(upstream upgrades are expected to clobber them).

### `pi-goal` — external goal-state sync (`.pi/extensions/pi-goal/index.ts`)

The extension now re-reads the persisted goal state on `turn_start`
(`latestStateFromSession(ctx)`), so a goal created or corrected by **another** extension — the
advisor, via `appendEntry` with `customType: "pi-goal"` — is picked up at the start of the next
turn instead of being silently ignored by the in-memory copy.

### `pi-omplike-advisor` — cross-upstream fallback chain (`extensions/advisor.ts` + `extensions/lib/mode-utils.ts`)

Upstream's advisor silently dies when the configured model is unreachable. Locally the advisor
resolves its model from `modes.json` and, on failure, walks an ordered fallback chain that can
cross **different** providers/upstreams (different API keys and endpoints), degrading instead of
stopping. The chain is configured as `modes.advisor.fallbackModels` (see `modes.example.json`).
`mode-utils.ts` was extended with `loadModeSpec` / `resolveModelAndThinking` to carry
`fallbackModels`.

### `pi-omplike-advisor` — goal-status correction (`extensions/advisor.ts`)

Adds two tools scoped to the advisor (`set_goal`, `update_goal_status`) that read and write the
`pi-goal` state (`customType: "pi-goal"`) through the primary session's `sessionManager`. Because
the advisor agent's tools run with `ctx === undefined`, it cannot re-use pi-goal's own tools, so it
implements its own read/write. This lets the advisor fix a wrongly-marked goal (e.g.
`complete` → `active`) without waiting for a human.

## Layout

```text
pi-goal/
  package.json  README.md  LICENSE
  .pi/extensions/pi-goal/   # the actual extension (index.ts, goal-state.ts, usage.ts)
  skills/pi-goal-writer/    # /goal objective authoring skill
pi-omplike-advisor/
  package.json  README.md
  extensions/advisor.ts     # the extension
  extensions/lib/mode-utils.ts
modes.example.json          # sanitized advisor config, incl. the fallback chain
```

## Install

`pi-goal` and `pi-omplike-advisor` are installed as pi packages, e.g. from a local checkout:

```bash
pi install <path-to>/pi-goal
pi install <path-to>/pi-omplike-advisor
```

or add them to `~/.pi/agent/settings.json`:

```json
{
  "packages": ["pi-goal", "pi-omplike-advisor"]
}
```

See each package's own `README.md` for the `/goal` and `/advisor` commands, configuration, and
environment variables.

## Re-applying the patches after an upgrade

1. `pi-goal/.pi/extensions/pi-goal/index.ts` → add the `turn_start` re-sync handler.
2. `pi-omplike-advisor/extensions/advisor.ts` → add the fallback chain + `set_goal` /
   `update_goal_status` tools.
3. `pi-omplike-advisor/extensions/lib/mode-utils.ts` → add the `fallbackModels`-aware
   `loadModeSpec` / `resolveModelAndThinking`.

## License

MIT (see `pi-goal/LICENSE`; `pi-omplike-advisor` declares MIT in its `package.json`).
