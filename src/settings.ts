import { App, PluginSettingTab, Setting } from "obsidian";
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

		new Setting(containerEl)
			.setName('Show recent notes')
			.setDesc('Display the 5 most recently opened notes (excluding currently open ones) on the left side of the homepage.')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.showRecentNotes ?? false)
				.onChange(async (value) => {
					this.plugin.settings.showRecentNotes = value;
					await this.plugin.saveSettings();
				})
			);

		new Setting(containerEl)
			.setName('ASCII art')
			.setDesc('ASCII art to display on the new tab page. Use monospace-friendly characters.')
			.addTextArea(textarea => {
				textarea
					.setValue(this.plugin.settings.asciiArt ?? '')
					.setPlaceholder('Enter your ASCII art here...')
					.onChange(async (value) => {
						this.plugin.settings.asciiArt = value;
						await this.plugin.saveSettings();
					});
				textarea.inputEl.rows = 10;
				textarea.inputEl.cols = 50;
			});
	}
}
