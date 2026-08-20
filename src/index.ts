import type { Plugin } from "@opencode-ai/plugin";
import { matchesPrimary, parseRoutes } from "./routes.ts";

type Session = {
	parentID?: string;
	model?: {
		providerID: string;
		id: string;
		variant?: string;
	};
};

const server: Plugin = async ({ client }, options) => {
	const { selections, errors } = parseRoutes(options);
	const reportedErrors = new Set<(typeof errors)[number]>();

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
