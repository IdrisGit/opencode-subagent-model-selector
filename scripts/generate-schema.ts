import { toJsonSchema } from "@valibot/to-json-schema";
import { Configuration } from "../src/schema.ts";

const { version } = (await Bun.file("package.json").json()) as { version: string };
const schema = {
	$id: `https://unpkg.com/@idrisgit/opencode-subagent-model-selector@${version}/schema.json`,
	...toJsonSchema(Configuration, { target: "draft-2020-12" }),
};

await Bun.write("schema.json", `${JSON.stringify(schema, null, 2)}\n`);
