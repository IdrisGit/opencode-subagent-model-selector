import type { Plugin, PluginOptions } from "@opencode-ai/plugin";
import * as v from "valibot";

type Model = Readonly<{
	providerID: string;
	modelID: string;
	variant?: string;
}>;

type PrimaryModel = Readonly<{
	providerID: string;
	modelID: string;
	variants?: readonly string[];
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
	primary: PrimaryModel;
	subagent: Model;
}>;

type InvalidSelection = Readonly<{
	path: string;
	agent?: string;
	primary?: PrimaryModel;
}>;

type ParsedRoutes = Readonly<{
	selections: readonly Selection[];
	errors: readonly InvalidSelection[];
}>;

const NonEmptyString = v.pipe(v.string(), v.nonEmpty());
const ModelID = v.pipe(
	NonEmptyString,
	v.check((value) => {
		const separator = value.indexOf("/");
		return separator > 0 && separator < value.length - 1;
	}),
);
const SubagentDescriptor = v.object({
	model: ModelID,
	variant: v.optional(NonEmptyString),
});
const PrimaryDescriptor = v.object({
	model: ModelID,
	variant: v.optional(v.union([NonEmptyString, v.pipe(v.array(NonEmptyString), v.nonEmpty())])),
});
const Subagents = v.pipe(
	v.record(NonEmptyString, SubagentDescriptor),
	v.check((value) => Object.keys(value).length > 0),
);
const Route = v.pipe(
	v.object({
		primary: PrimaryDescriptor,
		subagents: Subagents,
	}),
	v.transform((value): { primary: PrimaryModel; subagents: Record<string, Model> } => {
		const primarySeparator = value.primary.model.indexOf("/");
		return {
			primary: {
				providerID: value.primary.model.slice(0, primarySeparator),
				modelID: value.primary.model.slice(primarySeparator + 1),
				...(value.primary.variant === undefined
					? {}
					: {
							variants: Array.isArray(value.primary.variant) ? value.primary.variant : [value.primary.variant],
						}),
			},
			subagents: Object.fromEntries(
				Object.entries(value.subagents).map(([agent, subagent]) => {
					const separator = subagent.model.indexOf("/");
					return [
						agent,
						{
							providerID: subagent.model.slice(0, separator),
							modelID: subagent.model.slice(separator + 1),
							...(subagent.variant === undefined ? {} : { variant: subagent.variant }),
						},
					];
				}),
			),
		};
	}),
);
const Options = v.strictObject({
	routes: v.optional(v.array(v.unknown())),
});

function parseRoute(value: unknown, index: number): ParsedRoutes {
	const path = `routes[${index}]`;
	const route = v.safeParse(Route, value);
	if (!route.success) {
		return {
			selections: [],
			errors: [{ path }],
		};
	}

	return {
		selections: Object.entries(route.output.subagents).map(([agent, subagent]) => ({
			agent,
			primary: route.output.primary,
			subagent,
		})),
		errors: [],
	};
}

function parseRoutes(options?: PluginOptions): ParsedRoutes {
	const parsedOptions = v.safeParse(Options, options ?? {});
	if (!parsedOptions.success) {
		return {
			selections: [],
			errors: [{ path: "options" }],
		};
	}

	if (parsedOptions.output.routes === undefined) {
		return {
			selections: [],
			errors: [],
		};
	}

	const parsed = parsedOptions.output.routes.map(parseRoute);
	return {
		selections: parsed.flatMap((route) => route.selections),
		errors: parsed.flatMap((route) => route.errors),
	};
}

function matchesPrimary(selection: { primary?: PrimaryModel }, model: Model) {
	return (
		selection.primary?.providerID === model.providerID &&
		selection.primary.modelID === model.modelID &&
		(selection.primary.variants === undefined || selection.primary.variants.includes(model.variant ?? "default"))
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
