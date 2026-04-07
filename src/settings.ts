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
		containerEl.classList.add("new-tab-bookmarks-textarea-container")

		new Setting(containerEl)
			.setName('ASCII Art')
			.setDesc(
				'There is some post-processing done to center the ASCII art even if whitespace is not equal. ' +
				'This post-processing may break some ASCII art, so you may have to adjust it here until it looks correct.'
			)
			.addTextArea(textarea => {
				textarea
					.setValue(this.plugin.settings.asciiArt ?? '')
					.setPlaceholder('Enter your ASCII art here...')
					.onChange(async (value) => {
						this.plugin.settings.asciiArt = value;
						await this.plugin.saveSettings();
						this.plugin.rerenderOpenNewTabs();
					});
				textarea.inputEl.rows = 18;
				textarea.inputEl.cols = 50;
			});
	}
}
