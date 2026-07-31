import type { Plugin, PluginOptions } from "@opencode-ai/plugin";

type Model = Readonly<{
	providerID: string;
	modelID: string;
	variant?: string;
}>;

type Session = {
	parentID?: string;
	model?: {
		providerID: string;
		id: string;
		variant?: string;
	};
};

type Selection = Readonly<{
	agent: string;
	primary: Model;
	subagent: Model;
}>;

type InvalidSelection = Readonly<{
	path: string;
	agent?: string;
	primary?: Model;
}>;

type ParsedRoutes = Readonly<{
	selections: readonly Selection[];
	errors: readonly InvalidSelection[];
}>;

function parseModelID(value: unknown, field: string): Omit<Model, "variant"> {
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

function parseModel(value: unknown, field: string): Model {
	if (!value || typeof value !== "object" || Array.isArray(value)) {
		throw new TypeError(`${field} must be an object`);
	}

	const model = value as Record<string, unknown>;
	const id = parseModelID(model.model, `${field}.model`);
	const variant = parseVariant(model.variant, `${field}.variant`);
	return {
		...id,
		...(variant === undefined ? {} : { variant }),
	};
}

function parseAgent(value: unknown, field: string) {
	if (typeof value !== "string" || !value) {
		throw new TypeError(`${field} must be a non-empty string`);
	}
	return value;
}

function isObject(value: unknown): value is Record<string, unknown> {
	return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function parseRoute(value: unknown, index: number): ParsedRoutes {
	const path = `routes[${index}]`;
	if (!isObject(value)) {
		return {
			selections: [],
			errors: [{ path }],
		};
	}

	const primaryResult = (() => {
		try {
			return { kind: "primary" as const, primary: parseModel(value.primary, `${path}.primary`) };
		} catch {
			return { kind: "error" as const, error: { path: `${path}.primary` } };
		}
	})();
	if (primaryResult.kind === "error") {
		return {
			selections: [],
			errors: [primaryResult.error],
		};
	}

	const subagents = value.subagents;
	if (!isObject(subagents)) {
		return {
			selections: [],
			errors: [{ path: `${path}.subagents`, primary: primaryResult.primary }],
		};
	}

	const assignments = Object.entries(subagents);
	if (assignments.length === 0) {
		return {
			selections: [],
			errors: [{ path: `${path}.subagents`, primary: primaryResult.primary }],
		};
	}

	const results = assignments.map(([agent, subagent]) => {
		const assignmentPath = `${path}.subagents.${agent || "<empty>"}`;
		try {
			const name = parseAgent(agent, assignmentPath);
			try {
				return {
					kind: "selection" as const,
					selection: {
						agent: name,
						primary: primaryResult.primary,
						subagent: parseModel(subagent, assignmentPath),
					},
				};
			} catch {
				return {
					kind: "error" as const,
					error: { path: assignmentPath, agent: name, primary: primaryResult.primary },
				};
			}
		} catch {
			return {
				kind: "error" as const,
				error: { path: assignmentPath, primary: primaryResult.primary },
			};
		}
	});

	return {
		selections: results.flatMap((result) => (result.kind === "selection" ? [result.selection] : [])),
		errors: results.flatMap((result) => (result.kind === "error" ? [result.error] : [])),
	};
}

function parseRoutes(options?: PluginOptions): ParsedRoutes {
	const routes = options?.routes;
	if (routes === undefined) {
		return {
			selections: [],
			errors: [],
		};
	}

	if (!Array.isArray(routes)) {
		return {
			selections: [],
			errors: [{ path: "routes" }],
		};
	}

	const parsed = routes.map(parseRoute);
	return {
		selections: parsed.flatMap((route) => route.selections),
		errors: parsed.flatMap((route) => route.errors),
	};
}

function matchesPrimary(selection: { primary?: Model }, model: Model) {
	return (
		selection.primary?.providerID === model.providerID &&
		selection.primary.modelID === model.modelID &&
		(selection.primary.variant === undefined || selection.primary.variant === (model.variant ?? "default"))
	);
}

const server: Plugin = async ({ client }, options) => {
	const { selections, errors } = parseRoutes(options);
	const reportedErrors = new Set<InvalidSelection>();

	return {
		"chat.message": async (input, output) => {
			if (!input.agent) return;

			const child = (await client.session.get({ path: { id: output.message.sessionID } })).data as Session | undefined;
			if (!child?.parentID) return;

			const parent = (await client.session.get({ path: { id: child.parentID } })).data as Session | undefined;
			const parentModel = parent?.model;
			if (parent?.parentID || !parentModel) return;

			const model = {
				providerID: parentModel.providerID,
				modelID: parentModel.id,
				...(parentModel.variant === undefined || parentModel.variant === "default"
					? {}
					: { variant: parentModel.variant }),
			};
			const modelName = `${model.providerID}/${model.modelID}`;
			const selection = selections.findLast(
				(selection) => selection.agent === input.agent && matchesPrimary(selection, model),
			);
			if (selection) {
				// OpenCode persists this hook output object after all chat.message hooks run.
				output.message.model = {
					providerID: selection.subagent.providerID,
					modelID: selection.subagent.modelID,
					...(selection.subagent.variant === undefined ? {} : { variant: selection.subagent.variant }),
				};
				return;
			}

			const error =
				errors.findLast((error) => error.agent === input.agent && matchesPrimary(error, model)) ??
				errors.findLast((error) => error.agent === input.agent && error.primary === undefined) ??
				errors.findLast((error) => error.agent === undefined && matchesPrimary(error, model)) ??
				errors.findLast((error) => error.agent === undefined && error.primary === undefined);
			if (error && !reportedErrors.has(error)) {
				reportedErrors.add(error);
				const message = `The ${error.agent ? `${input.agent} subagent route` : "subagent routes"}${
					error.primary ? ` for primary model ${modelName}` : ""
				} at ${error.path} isn't configured properly, so it will use its default model.`;
				void client.tui
					.showToast({ body: { title: "Subagent model selection", message, variant: "warning" } })
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
