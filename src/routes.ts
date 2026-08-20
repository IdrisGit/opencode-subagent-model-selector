import * as v from "valibot";
import { Options, Route } from "./schema.ts";

export type Model = Readonly<{
	providerID: string;
	modelID: string;
	variant?: string;
}>;

type PrimaryModel = Readonly<{
	providerID: string;
	modelID: string;
	variants?: readonly string[];
}>;

export type Selection = Readonly<{
	agent: string;
	primary: PrimaryModel;
	subagent: Model;
}>;

export type InvalidSelection = Readonly<{
	path: string;
	agent?: string;
	primary?: PrimaryModel;
}>;

export type ParsedRoutes = Readonly<{
	selections: readonly Selection[];
	errors: readonly InvalidSelection[];
}>;

const ParsedRoute = v.pipe(
	Route,
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

function parseRoute(value: unknown, index: number): ParsedRoutes {
	const path = `routes[${index}]`;
	const route = v.safeParse(ParsedRoute, value);
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

export function parseRoutes(options?: unknown): ParsedRoutes {
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

export function matchesPrimary(selection: { primary?: PrimaryModel }, model: Model) {
	return (
		selection.primary?.providerID === model.providerID &&
		selection.primary.modelID === model.modelID &&
		(selection.primary.variants === undefined || selection.primary.variants.includes(model.variant ?? "default"))
	);
}

export function resolveSubagents(selections: readonly Selection[], model: Model) {
	const resolved = new Map<string, Selection>();
	for (const selection of selections) {
		if (matchesPrimary(selection, model)) resolved.set(selection.agent, selection);
	}
	return [...resolved.values()];
}
