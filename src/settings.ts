import { App, PluginSettingTab } from "obsidian";
import BookmarksNewTabPlugin from "./main";

export class SampleSettingTab extends PluginSettingTab {
	plugin: BookmarksNewTabPlugin;

	constructor(app: App, plugin: BookmarksNewTabPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();
	}
}
