# opencode-subagent-model-selector

A local OpenCode plugin that selects the `explore` subagent model from the effective model of the direct primary session.

Configure it in `opencode.json`:

```json
{
  "plugin": [
    [
      "file:///home/idris/Dev/personal/opencode-subagent-model-selector/src/index.ts",
      {
        "selections": [
          {
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

Unmatched models use OpenCode's normal subagent resolution, including `agent.explore.model`. If `variant` is omitted, the target model uses its default variant.

If a selection for the active parent model is malformed, the plugin shows a warning and leaves the Explore agent on OpenCode's default model resolution. Other valid selections continue to apply.

Nested subagents are not routed: they inherit their caller's model normally.

```bash
bun run typecheck
```
