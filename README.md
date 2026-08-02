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
              "variant": ["high", "xhigh"]
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

`routes` is an ordered array. Every route requires a `primary` model descriptor and a non-empty `subagents` object. `primary` and every subagent assignment require `model` in `provider/model` form. `primary.variant` accepts one string or a non-empty array of strings; a subagent `variant` is an optional string. Subagent object keys are exact OpenCode agent names, so built-in agents such as `explore` and `general` and user-defined agents such as `code-review` work identically.

The plugin options object is strict: `routes` is its only accepted key. Unknown fields inside routes, model descriptors, and subagent assignments are ignored. A malformed route is ignored as a whole, but does not disable valid routes elsewhere in the configuration.

## JSON Schema

OpenCode does not provide a way for plugins to register schemas for their own options. The plugin options position in OpenCode's configuration schema is an unrestricted object, so editors cannot validate this plugin's nested options automatically.

This package publishes its complete configuration schema as [schema.json](./schema.json), generated from the Valibot schemas used by the plugin. Use the moving latest URL by default: [`https://unpkg.com/@idrisgit/opencode-subagent-model-selector/schema.json`](https://unpkg.com/@idrisgit/opencode-subagent-model-selector/schema.json). To pin an immutable release, use `https://unpkg.com/@idrisgit/opencode-subagent-model-selector@<version>/schema.json`. Each generated schema has a versioned `$id` matching its published package version. The schema defines valid route configuration; at runtime, the plugin still ignores individual malformed routes so other valid routes keep working.

Regenerate it after changing the configuration schemas:

```bash
bun run generate-schema
```

An omitted `primary.variant` matches every variant of the primary model. A string matches that one variant, while an array matches any listed variant; `"default"` matches the normalized default variant. An omitted subagent `variant` uses the target model's default variant.

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
