# opencode-subagent-model-selector

A local OpenCode plugin that selects named subagent models from the effective model of the direct primary session.

Configure it in `opencode.json`:

```json
{
  "plugin": [
    [
      "file:///home/idris/Dev/personal/opencode-subagent-model-selector/src/index.ts",
      {
        "selections": [
          {
            "agent": "explore",
            "from": "openai/gpt-5.6-sol",
            "to": "openai/gpt-5.6-luna",
            "variant": "high"
          }
        ]
      }
    ]
  ]
}
```

Each rule requires an exact OpenCode subagent name, such as `explore`, `general`, or a user-defined agent. Unmatched rules use OpenCode's normal subagent resolution, including `agent.<name>.model`. If `variant` is omitted, the target model uses its default variant.

Rules are evaluated in declaration order. When multiple rules have the same `agent` and `from` pair, the final rule takes precedence.

If a selection for the active subagent and parent model is malformed, the plugin shows a warning and leaves that subagent on OpenCode's default model resolution. Other valid selections continue to apply.

Nested subagents are not routed: they inherit their caller's model normally.

```bash
bun run typecheck
```
