# Project

- This is a Bun, TypeScript, ESM OpenCode plugin that routes direct subagents to models based on the root primary session's model.
- Match exact `provider/model` and agent IDs. Preserve route order: later matching routes win.
- If no route matches, leave model selection unchanged so OpenCode's normal agent configuration and model/variant inheritance apply.
- Nested subagents inherit the model selected for their parent subagent.

# Development

- Use Bun and follow the strict TypeScript and Biome configuration.
- Treat `src/schema.ts` as authoritative; never edit `schema.json` directly. Run `bun run generate-schema` after schema changes.
- Before finishing, run `bun run typecheck`, `bun run check`, and `bun run build`.
- For local testing, follow the README's Development section to load `src/index.ts` directly in OpenCode.
- Do not add tests yet; they are intentionally deferred while the pre-release API and configuration shape is established.
