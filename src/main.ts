import { Plugin, TFile, TFolder, WorkspaceLeaf, setIcon } from 'obsidian';
import { SampleSettingTab } from './settings';

interface BookmarkItem {
	type: 'file' | 'folder' | 'search' | 'url' | 'group' | 'graph';
	title?: string;
	path?: string;
	url?: string;
	query?: string;
	items?: BookmarkItem[];
}

interface BookmarksNewTabPluginSettings {
	asciiArt?: string;
}

const DEFAULT_SETTINGS: BookmarksNewTabPluginSettings = {
	asciiArt: '',
};

export default class BookmarksNewTabPlugin extends Plugin {
	//@ts-expect-error it will load using the onload constructor anyway.
	settings: BookmarksNewTabPluginSettings;

	async onload() {
		await this.loadSettings();
		this.addSettingTab(new SampleSettingTab(this.app, this));

		const injectAll = () => this.app.workspace.iterateAllLeaves((leaf) => {
			if (leaf.getViewState().type === 'empty') this.injectBookmarks(leaf);
		});

		injectAll();
		this.registerEvent(this.app.workspace.on('layout-change', injectAll));
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	rerenderOpenNewTabs() {
		this.app.workspace.iterateAllLeaves((leaf) => {
			if (leaf.getViewState().type !== 'empty') return;
			const container = leaf.view.containerEl;
			container
				.querySelectorAll('.new-tab-bookmarks-bookmarks, .new-tab-bookmarks-ascii-art')
				.forEach((el) => el.remove());
			container.querySelector('.empty-state-container')?.classList.remove('rendered');
			this.injectBookmarks(leaf);
		});
	}

	onunload() {
		document.querySelectorAll('.new-tab-bookmarks-bookmarks, .new-tab-bookmarks-ascii-art').forEach(el => el.remove());
	}

	private getBookmarks(): BookmarkItem[] {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const bp = (this.app as any).internalPlugins?.plugins?.['bookmarks'];
		return bp?.instance?.items ?? [];
	}

	private injectBookmarks(leaf: WorkspaceLeaf) {
		const container = leaf.view.containerEl;
		if (container.querySelector('.new-tab-bookmarks-bookmarks')) return;

		const rootEmptyState = container.querySelector('.empty-state-container');
		if (!rootEmptyState) return;

		const items = this.getBookmarks();
		if (items.length === 0 && !this.settings.asciiArt) return;

		if (this.settings.asciiArt) {
			const lines = this.settings.asciiArt.split('\n');
			const lengthObjects = lines.map(line => ({
					length: line.trim().length,
					leading: line.match(/^\s+/)?.[0]?.length || 0
			}));

			const nonEmptyLines = lengthObjects.filter(lo => lo.length > 0);
			const minLeading = nonEmptyLines.reduce((min, lo) => Math.min(min, lo.leading), Infinity);
			const maxLine = nonEmptyLines.reduce((acc, lo) => lo.length > acc.length ? lo : acc, { length: 0, leading: 0 });
			
			const trimmedAsciiArt = lines.map(line => line
				.padEnd(maxLine.length, " ")
				.slice(minLeading, minLeading + maxLine.length)
			).join('\n');

			const asciiArtEl = createEl('pre', { cls: 'new-tab-bookmarks-ascii-art' });
			asciiArtEl.createEl('code', { text: trimmedAsciiArt });
			rootEmptyState.prepend(asciiArtEl);
	}

		if (items.length === 0) return;

		const wrapper = createEl('div', { cls: 'new-tab-bookmarks-bookmarks' });
		this.renderItems(items, wrapper, leaf);
		rootEmptyState.appendChild(wrapper);
		rootEmptyState.classList.add('rendered');
	}

	/** Creates a sidebar-style tree-item row and returns the clickable `tree-item-self` element. */
	private createTreeItem(parent: HTMLElement, iconId: string, label: string, path?: string): HTMLElement {
		const treeItem = parent.createEl('div', { cls: 'tree-item', ...(path ? { attr: { 'data-path': path } } : {}) });
		const self = treeItem.createEl('div', { cls: 'tree-item-self bookmark is-clickable' });
		self.style.setProperty('margin-inline-start', '0px', 'important');
		self.style.setProperty('padding-inline-start', '24px', 'important');
		setIcon(self.createEl('div', { cls: 'tree-item-icon' }), iconId);
		const inner = self.createEl('div', { cls: 'tree-item-inner' });
		inner.createEl('span', { text: label, cls: 'tree-item-inner-text', attr: { title: label } });
		return self;
	}

	/**
	 * Resolves a display label for a file/folder bookmark.
	 * Prefers an explicit title, then the vault object name,
	 * then falls back to the last path segment.
	 */
	private resolveFileLabel(item: BookmarkItem): string {
		if (item.title) return item.title;
		if (!item.path) return '(untitled)';
		const vaultFile = this.app.vault.getAbstractFileByPath(item.path);
		if (vaultFile instanceof TFile) return vaultFile.basename;
		if (vaultFile instanceof TFolder) return vaultFile.name;
		return item.path.split('/').pop()?.replace(/\.md$/, '') ?? item.path;
	}

	private renderItem(item: BookmarkItem, parent: HTMLElement, leaf: WorkspaceLeaf) {
		switch (item.type) {
			case 'group': {
				const groupEl = parent.createEl('div', { cls: 'tree-item new-tab-bookmarks-group' });
				groupEl.createEl('div', {
					text: item.title || 'Group',
					cls: 'tree-item-self new-tab-bookmarks-group-header',
				});
				if (item.items?.length) {
					const subContainer = groupEl.createEl('div', { cls: 'new-tab-bookmarks-subgroup' });
					this.renderItems(item.items, subContainer, leaf);
				}
				break;
			}
			case 'file':
			case 'folder': {
				const self = this.createTreeItem(parent, item.type, this.resolveFileLabel(item), item.path);
				self.addEventListener('click', (e) => {
					e.preventDefault();
					if (!item.path) return;
					const tfile = this.app.vault.getFileByPath(item.path);
					if (tfile) {
						leaf.openFile(tfile);
					} else {
						this.app.workspace.openLinkText(item.path, '', false);
					}
				});
				break;
			}
			case 'url': {
				const self = this.createTreeItem(parent, 'link', item.title || item.url || '(no url)');
				self.addEventListener('click', () => {
					window.open(item.url ?? '#', '_blank', 'noopener,noreferrer');
				});
				break;
			}
			case 'search': {
				const self = this.createTreeItem(parent, 'search', item.title || `Search: ${item.query ?? ''}`);
				self.addEventListener('click', (e) => {
					e.preventDefault();
					// eslint-disable-next-line @typescript-eslint/no-explicit-any
					(this.app as any).internalPlugins?.plugins?.['global-search']
						?.instance?.openGlobalSearch(item.query ?? '');
				});
				break;
			}
			case 'graph': {
				const self = this.createTreeItem(parent, 'git-fork', item.title || 'Graph view');
				self.addEventListener('click', (e) => {
					e.preventDefault();
					// eslint-disable-next-line @typescript-eslint/no-explicit-any
					(this.app as any).commands?.executeCommandById('graph:open');
				});
				break;
			}
			default:
				parent.createEl('div', { text: item.title ?? item.type });
		}
	}

	private renderItems(items: BookmarkItem[], parent: HTMLElement, leaf: WorkspaceLeaf) {
		for (const item of items) this.renderItem(item, parent, leaf);
	}
}
