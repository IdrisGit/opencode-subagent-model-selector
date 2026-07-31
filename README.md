# @idrisgit/opencode-subagent-model-selector

An OpenCode plugin that selects named subagent models from the effective model of the direct primary session.

## Installation

Add the package and its options to `opencode.json`:

```json
{
  "plugin": [
    [
      "@idrisgit/opencode-subagent-model-selector",
      {
        "routes": [
          {
            "primary": {
              "model": "openai/gpt-5.6-sol"
            },
            "subagents": {
              "explore": {
                "model": "openai/gpt-5.6-luna",
                "variant": "low"
              },
              "general": {
                "model": "openai/gpt-5.6-luna"
              },
              "code-review": {
                "model": "anthropic/claude-sonnet-4-6"
              }
            }
          },
          {
            "primary": {
              "model": "openai/gpt-5.6-sol",
              "variant": "high"
            },
            "subagents": {
              "explore": {
                "model": "openai/gpt-5.6-terra",
                "variant": "high"
              }
            }
          }
        ]
      }
    ]
  ]
}
```

`routes` is an ordered array. Every route requires a `primary` model descriptor and a non-empty `subagents` object. `primary` and every subagent assignment require `model` in `provider/model` form and accept an optional `variant`. Subagent object keys are exact OpenCode agent names, so built-in agents such as `explore` and `general` and user-defined agents such as `code-review` work identically.

An omitted `primary.variant` matches every variant of the primary model. Set `primary.variant` to match only that variant; `"default"` matches the normalized default variant. An omitted subagent `variant` uses the target model's default variant.

Routes are evaluated in declaration order and the final matching assignment for an agent wins. A later matching route is a partial override: it only changes the subagents it declares. In the example, Sol High sends `explore` to Terra High while `general` retains its Luna assignment from the earlier route.

If no route assigns a model, the plugin defers to OpenCode's normal agent model resolution. Configure an unconditional model with OpenCode's native `agent.<name>.model` setting rather than this plugin. Malformed routes show a warning and fall back without disabling valid, unrelated assignments.

Nested subagents are not routed: they inherit their caller's model normally.

## Development

For local development, use the source file instead of the npm package:

```json
{
  "plugin": [
    [
      "file:///path/to/opencode-subagent-model-selector/src/index.ts",
      { "routes": [] }
    ]
  ]
}
```

```bash
bun run typecheck
bun run check
npm pack --dry-run
```
