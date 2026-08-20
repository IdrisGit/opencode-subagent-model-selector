/** @jsxImportSource @opentui/solid */

import type { TuiPlugin, TuiPluginApi, TuiPluginModule } from "@opencode-ai/plugin/tui";
import { createSignal, For, Show } from "solid-js";
import { type Model, parseRoutes, resolveSubagents, type Selection } from "./routes.ts";

const id = "opencode-subagent-model-selector";

function rootModel(api: TuiPluginApi, sessionID: string): Model | undefined {
	let session = api.state.session.get(sessionID);
	while (session?.parentID) {
		const parent = api.state.session.get(session.parentID);
		if (!parent) break;
		session = parent;
	}

	const model = session?.model;
	if (!model) return;
	return {
		providerID: model.providerID,
		modelID: model.id,
		...(model.variant === undefined || model.variant === "default" ? {} : { variant: model.variant }),
	};
}

function modelName(api: TuiPluginApi, model: Model) {
	return (
		api.state.provider.find((provider) => provider.id === model.providerID)?.models[model.modelID]?.name ??
		model.modelID
	);
}

function targetName(api: TuiPluginApi, selection: Selection) {
	const target = modelName(api, selection.subagent);
	return `${target} · ${selection.subagent.variant ?? "default"}`;
}

function serverOptions(api: TuiPluginApi, spec: string) {
	const plugin = api.state.config.plugin?.find((item) => (Array.isArray(item) ? item[0] : item) === spec);
	return Array.isArray(plugin) ? plugin[1] : undefined;
}

function SidebarContent(props: { api: TuiPluginApi; sessionID: string; selections: readonly Selection[] }) {
	const [collapsed, setCollapsed] = createSignal(props.api.kv?.get("subagent-routing-sidebar-collapsed", true) ?? true);
	const model = () => rootModel(props.api, props.sessionID);
	const rows = () => {
		const primary = model();
		return primary ? resolveSubagents(props.selections, primary) : [];
	};
	const primaryName = () => {
		const primary = model();
		return primary ? `${modelName(props.api, primary)} · ${primary.variant ?? "default"}` : "";
	};
	const toggleCollapsed = () => {
		const next = !collapsed();
		setCollapsed(next);
		props.api.kv?.set("subagent-routing-sidebar-collapsed", next);
	};
	const toggleIcon = () => (collapsed() ? "▶" : "▼");

	return (
		<Show when={rows().length > 0 && model()}>
			<box gap={0}>
				<box flexDirection="row">
					{/* biome-ignore lint/a11y/noStaticElementInteractions: OpenTUI has no interactive text primitive. */}
					<text fg={props.api.theme.current.text} onMouseDown={toggleCollapsed}>
						<b>{toggleIcon()} Subagent routing</b>
					</text>
					<Show when={collapsed()}>
						<text fg={props.api.theme.current.textMuted}> ({rows().length} agents)</text>
					</Show>
				</box>
				<Show when={!collapsed()}>
					<box gap={0}>
						<text fg={props.api.theme.current.text}>default</text>
						<text fg={props.api.theme.current.textMuted} wrapMode="none">
							{primaryName()}
						</text>
						<For each={rows()}>
							{(selection) => (
								<box gap={0}>
									<text fg={props.api.theme.current.text}>{selection.agent}</text>
									<text fg={props.api.theme.current.textMuted} wrapMode="none">
										{targetName(props.api, selection)}
									</text>
								</box>
							)}
						</For>
					</box>
				</Show>
			</box>
		</Show>
	);
}

const tui: TuiPlugin = async (api, options, meta) => {
	const { selections } = parseRoutes(options ?? serverOptions(api, meta.spec));
	api.slots.register({
		order: 125,
		slots: {
			sidebar_content(_context, props) {
				return <SidebarContent api={api} sessionID={props.session_id} selections={selections} />;
			},
		},
	});
};

const plugin: TuiPluginModule & { id: string } = {
	id,
	tui,
};

export default plugin;
