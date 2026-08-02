import * as v from "valibot";

const NonEmptyString = v.pipe(v.string(), v.nonEmpty());
const ModelID = v.pipe(
	NonEmptyString,
	v.regex(/^[^/]+\/[\s\S]+$/),
	v.description("A model identifier in provider/model form."),
);

const SubagentDescriptor = v.object({
	model: ModelID,
	variant: v.optional(v.pipe(NonEmptyString, v.description("The target model variant."))),
});

const PrimaryDescriptor = v.object({
	model: ModelID,
	variant: v.optional(
		v.union([
			v.pipe(NonEmptyString, v.description("A primary model variant to match.")),
			v.pipe(v.array(NonEmptyString), v.minLength(1), v.description("Primary model variants to match.")),
		]),
	),
});

const Subagents = v.pipe(
	v.record(NonEmptyString, SubagentDescriptor),
	v.minEntries(1),
	v.description("Non-empty subagent assignments keyed by exact OpenCode agent name."),
);

export const Route = v.object({
	primary: PrimaryDescriptor,
	subagents: Subagents,
});

// Runtime parsing accepts unknown route values so one malformed route cannot disable valid routes.
export const Options = v.strictObject({
	routes: v.optional(v.array(v.unknown())),
});

export const Configuration = v.pipe(
	v.strictObject({
		routes: v.optional(v.array(Route)),
	}),
	v.metadata({
		title: "OpenCode Subagent Model Selector Configuration",
		description: "Configuration options for @idrisgit/opencode-subagent-model-selector.",
	}),
);
