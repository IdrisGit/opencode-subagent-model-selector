import { createSolidTransformPlugin } from "@opentui/solid/bun-plugin";

function formatSize(bytes: number) {
	return `${(bytes / 1024).toFixed(2)} KB`;
}

const result = await Bun.build({
	entrypoints: ["./src/index.ts", "./src/tui.tsx"],
	external: ["@opentui/*", "solid-js"],
	format: "esm",
	outdir: "./dist",
	plugins: [createSolidTransformPlugin()],
	target: "bun",
});

if (!result.success) {
	for (const log of result.logs) console.error(log);
	process.exit(1);
}

const entries = result.outputs.filter((output) => output.kind === "entry-point");
const names = entries.map((entry) => entry.path.split("/").at(-1) ?? entry.path);
const width = Math.max(...names.map((name) => name.length));

console.log(`Built ${entries.length} entry points\n`);
for (const [index, entry] of entries.entries()) {
	console.log(`  ${names[index]?.padEnd(width) ?? entry.path}  ${formatSize(entry.size)}`);
}
