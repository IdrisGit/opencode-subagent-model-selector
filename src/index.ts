import type { Plugin, PluginOptions } from "@opencode-ai/plugin";

type Model = Readonly<{
	providerID: string;
	modelID: string;
}>;

type Session = {
	parentID?: string;
	model?: {
		providerID: string;
		id: string;
	};
};

type Selection = Readonly<{
	from: string;
	providerID: string;
	modelID: string;
	variant?: string;
}>;

type InvalidSelection = Readonly<{
	from?: string;
}>;

type ParsedSelection =
	| Readonly<{ kind: "selection"; selection: Selection }>
	| Readonly<{ kind: "error"; error: InvalidSelection }>;

type ParsedSelections = Readonly<{
	selections: readonly Selection[];
	errors: readonly InvalidSelection[];
}>;

function parseModel(value: unknown, field: string): Model {
	if (typeof value !== "string") {
		throw new TypeError(`${field} must be a provider/model string`);
	}

	const separator = value.indexOf("/");
	if (separator <= 0 || separator === value.length - 1) {
		throw new TypeError(`${field} must be a provider/model string`);
	}

	return {
		providerID: value.slice(0, separator),
		modelID: value.slice(separator + 1),
	};
}

function parseVariant(value: unknown, field: string) {
	if (value === undefined) return;
	if (typeof value !== "string" || !value) {
		throw new TypeError(`${field} must be a non-empty string`);
	}
	return value;
}

function parseSelection(value: unknown, index: number): ParsedSelection {
	try {
		if (!value || typeof value !== "object" || Array.isArray(value)) {
			throw new TypeError(`selections[${index}] must be an object`);
		}

		const selection = value as Record<string, unknown>;
		const from = parseModel(selection.from, `selections[${index}].from`);
		try {
			const to = parseModel(selection.to, `selections[${index}].to`);
			const variant = parseVariant(selection.variant, `selections[${index}].variant`);
			return {
				kind: "selection",
				selection: {
					from: `${from.providerID}/${from.modelID}`,
					providerID: to.providerID,
					modelID: to.modelID,
					...(variant === undefined ? {} : { variant }),
				},
			};
		} catch {
			return {
				kind: "error",
				error: {
					from: `${from.providerID}/${from.modelID}`,
				},
			};
		}
	} catch {
		return { kind: "error", error: {} };
	}
}

function parseSelections(options?: PluginOptions): ParsedSelections {
	const values = options?.selections;
	if (!Array.isArray(values)) {
		return {
			selections: [],
			errors: [{}],
		};
	}

	const results = values.map(parseSelection);

	return {
		selections: results.flatMap((result) => (result.kind === "selection" ? [result.selection] : [])),
		errors: results.flatMap((result) => (result.kind === "error" ? [result.error] : [])),
	};
}

const server: Plugin = async ({ client }, options) => {
	const { selections, errors } = parseSelections(options);
	const reportedErrors = new Set<InvalidSelection>();

	return {
		"chat.message": async (_input, output) => {
			if (output.message.agent !== "explore") return;

			const child = (await client.session.get({ path: { id: output.message.sessionID } })).data as Session | undefined;
			if (!child?.parentID) return;

			const parent = (await client.session.get({ path: { id: child.parentID } })).data as Session | undefined;
			const parentModel = parent?.model;
			if (parent?.parentID || !parentModel) return;

			const model = `${parentModel.providerID}/${parentModel.id}`;
			const selection = selections.find((selection) => selection.from === model);
			if (selection) {
				// OpenCode persists this hook output object after all chat.message hooks run.
				output.message.model = {
					providerID: selection.providerID,
					modelID: selection.modelID,
					...(selection.variant === undefined ? {} : { variant: selection.variant }),
				};
				return;
			}

			const error = errors.find((error) => error.from === model) ?? errors.find((error) => error.from === undefined);
			if (error && !reportedErrors.has(error)) {
				reportedErrors.add(error);
				const message = error.from
					? `The Explore agent selection for ${model} isn't configured properly, so it will use its default model.`
					: "The Explore agent selection isn't configured properly, so it will use its default model.";
				void client.tui
					.showToast({ body: { title: "Explore agent selection", message, variant: "warning" } })
					.catch(() => {});
				void client.app
					.log({ body: { service: "opencode-subagent-model-selector", level: "warn", message } })
					.catch(() => {});
				return;
			}
		},
	};
};

export default {
	id: "opencode-subagent-model-selector",
	server,
};
