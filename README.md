# @idrisgit/opencode-subagent-model-selector

An OpenCode plugin that routes direct subagent tasks to models based on the primary session's selected model and variant.

Use it to give the same subagent a different speed, cost, or capability profile for each primary model you use.

## Compatibility

Use OpenCode `v1.18.9` or later. Earlier versions might work but have not been tested.

## Install And Configure

Before you begin, make sure OpenCode is installed, the providers you need are configured, and the target subagents are available.

1. Choose your models on [Models.dev](https://models.dev/), then run `opencode models` to confirm the exact `provider/model` IDs available in your OpenCode installation.
2. Add the plugin to your project `opencode.json` or global `~/.config/opencode/opencode.json`. See the [OpenCode configuration documentation](https://opencode.ai/docs/config/) for configuration locations and precedence.

```json
{
  "$schema": "https://opencode.ai/config.json",
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
                "variant": "medium"
              },
              "general": {
                "model": "openai/gpt-5.6-terra",
                "variant": "medium"
              }
            }
          }
        ]
      }
    ]
  ]
}
```

3. Restart OpenCode. This route sends direct `explore` tasks from `openai/gpt-5.6-sol` to Luna Medium and direct `general` tasks to Terra Medium.

For a complete, real-world routing setup, see the maintainer's [personal `opencode.jsonc`](./opencode.jsonc).

OpenCode installs npm plugins automatically when it starts. See the [OpenCode plugin documentation](https://opencode.ai/docs/plugins/) for other plugin-loading options.

## Use This Plugin When

- A primary model should delegate exploration or research to a faster, lower-cost model.
- A high-reasoning primary variant should use a stronger subagent model.
- Built-in or custom subagents need different models without changing their prompts or permissions.

For a fixed model that never depends on the primary session, use OpenCode's native [agent model configuration](https://opencode.ai/docs/agents/#model).

## Routing Rules

- A route matches an exact primary `provider/model` ID and, optionally, its variant.
- Subagent keys are exact OpenCode agent IDs, such as `explore`, `general`, or `code-review`.
- Routes are evaluated in order. The last matching assignment for an agent wins. A route without `primary.variant` is a wildcard that matches every variant.
- If no route matches, OpenCode resolves the subagent model normally.
- Only subagents launched directly by a primary session are routed. Nested subagents are unchanged.

## Configuration Reference

`routes` is an ordered array. Every route needs a `primary` descriptor and a non-empty `subagents` object.

| Field | Required | Description |
| --- | --- | --- |
| `routes` | No | Array of routing rules. Omit it or use `[]` to make no changes. |
| `routes[].primary.model` | Yes | Primary model ID in `provider/model` form. |
| `routes[].primary.variant` | No | A variant string or non-empty array of variants to match. Omit it to match every variant. |
| `routes[].subagents` | Yes | Non-empty object keyed by exact OpenCode subagent ID. |
| `routes[].subagents.<agent>.model` | Yes | Target model ID in `provider/model` form. |
| `routes[].subagents.<agent>.variant` | No | Target model variant. Omit it to use the target model's default variant. |

### Models And Variants

Use `provider/model` for every model value. Find model names on [Models.dev](https://models.dev/), but use the output of `opencode models` as the final source of truth for your OpenCode installation.

Use the separate `variant` field rather than adding a variant to a model ID. An omitted `primary.variant` matches every variant; a string matches one variant; an array matches any listed variant. Use `"default"` to match the default primary variant.

Put a wildcard base route before variant-specific overrides for the same primary model and subagent. The later variant-specific route then overrides the base assignment. Reversing the order makes the wildcard route win for every variant.

## Examples

### Override A Base Route For High-Reasoning Sessions

Add this as a second item in `routes` after the wildcard base route. It routes `explore` to Terra Medium and `general` to Terra High for `high`, `xhigh`, and `max`. Other variants continue to use the wildcard route.

```json
{
  "primary": {
    "model": "openai/gpt-5.6-sol",
    "variant": ["high", "xhigh", "max"]
  },
  "subagents": {
    "explore": {
      "model": "openai/gpt-5.6-terra",
      "variant": "medium"
    },
    "general": {
      "model": "openai/gpt-5.6-terra",
      "variant": "high"
    }
  }
}
```

### Override A Terra Session

Place a wildcard route before the `xhigh` and `max` override:

```json
[
  {
    "primary": {
      "model": "openai/gpt-5.6-terra"
    },
    "subagents": {
      "explore": {
        "model": "openai/gpt-5.6-luna",
        "variant": "low"
      }
    }
  },
  {
    "primary": {
      "model": "openai/gpt-5.6-terra",
      "variant": ["xhigh", "max"]
    },
    "subagents": {
      "explore": {
        "model": "openai/gpt-5.6-terra",
        "variant": "medium"
      }
    }
  }
]
```

The later route upgrades direct `explore` tasks to Terra Medium for `xhigh` and `max`; other Terra variants use Luna Low.

### Route A Custom Subagent

Use the custom agent ID as a subagent key:

```json
{
  "primary": {
    "model": "openai/gpt-5.6-sol"
  },
  "subagents": {
    "code-review": {
      "model": "anthropic/claude-sonnet-4-6"
    }
  }
}
```

Configure the agent itself with [OpenCode agent configuration](https://opencode.ai/docs/agents/).

## Schema Validation

Use this JSON Schema to validate the plugin options object:

- Latest release: [`https://unpkg.com/@idrisgit/opencode-subagent-model-selector/schema.json`](https://unpkg.com/@idrisgit/opencode-subagent-model-selector/schema.json)
- Pinned release: `https://unpkg.com/@idrisgit/opencode-subagent-model-selector@<version>/schema.json`

OpenCode cannot validate nested plugin options through its main configuration schema. Use this schema in your editor or validation tooling for `routes`.

Only `routes` is accepted at the top level. Invalid individual routes are ignored so valid routes can still apply. Invalid top-level options disable all plugin routes.

## Troubleshooting

If a subagent is not using the expected model:

1. Run `opencode models` and verify the primary and target model IDs.
2. Confirm the selected primary variant matches the route, if one is configured.
3. Confirm the subagent ID matches the route key exactly.
4. Check that wildcard base routes appear before variant-specific overrides and that no later matching route overrides the assignment.
5. Confirm the subagent was launched directly by a primary session.
6. Restart OpenCode after changing configuration.
7. If a newly published version is still not loading, quit OpenCode, run `rm -rf ~/.cache/opencode/packages/@idrisgit/opencode-subagent-model-selector@latest`, then restart. This clears only this plugin's stale npm cache.

The plugin warns in the TUI and OpenCode application log when malformed configuration leaves a subagent without a selected route. For more detail, run `opencode --log-level DEBUG` and consult the [OpenCode troubleshooting guide](https://opencode.ai/docs/troubleshooting/).

## Star The Repository

If this plugin is useful, please [star the repository](https://github.com/IdrisGit/opencode-subagent-model-selector) to help others find it.

## Report Bugs And Request Features

[Open a GitHub issue](https://github.com/IdrisGit/opencode-subagent-model-selector/issues) for bugs or feature requests. Include your OpenCode version, plugin version, redacted configuration, selected primary model and variant, expected result, actual result, and relevant logs.

## Development

Clone the repository and install dependencies:

```bash
git clone https://github.com/IdrisGit/opencode-subagent-model-selector.git
cd opencode-subagent-model-selector
bun install
```

Use the local source file in your OpenCode configuration while developing:

```json
{
  "plugin": [
    [
      "file:///path/to/opencode-subagent-model-selector/src/index.ts",
      {
        "routes": []
      }
    ]
  ]
}
```

Run these checks before publishing:

```bash
bun run typecheck
bun run generate-schema
bun run check
bun run build
npm pack --dry-run
```

## License

Licensed under the [Apache License 2.0](./LICENSE).
