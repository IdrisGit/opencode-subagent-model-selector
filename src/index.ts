import type { Plugin, PluginOptions } from "@opencode-ai/plugin";

type Model = {
	providerID: string;
	modelID: string;
	variant?: string;
};

type Session = {
	parentID?: string;
	model?: {
		providerID: string;
		id: string;
	};
};

type Selection = {
	from: string;
	providerID: string;
	modelID: string;
	variant?: string;
};

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

function parseSelections(options?: PluginOptions): Selection[] {
	const values = options?.selections;
	if (!Array.isArray(values)) {
		throw new TypeError("selections must be an array");
	}

	return values.map((value, index) => {
		if (!value || typeof value !== "object" || Array.isArray(value)) {
			throw new TypeError(`selections[${index}] must be an object`);
		}

		const selection = value as Record<string, unknown>;
		const from = parseModel(selection.from, `selections[${index}].from`);
		const to = parseModel(selection.to, `selections[${index}].to`);
		if (selection.variant !== undefined) {
			if (typeof selection.variant !== "string" || !selection.variant) {
				throw new TypeError(`selections[${index}].variant must be a non-empty string`);
			}
			to.variant = selection.variant;
		}

		return {
			from: `${from.providerID}/${from.modelID}`,
			providerID: to.providerID,
			modelID: to.modelID,
			variant: to.variant,
		};
	});
}

const server: Plugin = async ({ client }, options) => {
	const selections = parseSelections(options);

	return {
		"chat.message": async (_input, output) => {
			if (output.message.agent !== "explore") return;

			const child = (await client.session.get({ path: { id: output.message.sessionID } })).data as Session | undefined;
			if (!child?.parentID) return;

			const parent = (await client.session.get({ path: { id: child.parentID } })).data as Session | undefined;
			const parentModel = parent?.model;
			if (parent?.parentID || !parentModel) return;

			const selection = selections.find(
				(selection) => selection.from === `${parentModel.providerID}/${parentModel.id}`,
			);
			if (!selection) return;

			output.message.model = {
				providerID: selection.providerID,
				modelID: selection.modelID,
				...(selection.variant === undefined ? {} : { variant: selection.variant }),
			};
		},
	};
};

export default {
	id: "opencode-subagent-model-selector",
	server,
};
