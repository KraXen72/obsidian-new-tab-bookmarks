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
	showRecentNotes?: boolean;
}

const DEFAULT_SETTINGS: BookmarksNewTabPluginSettings = {
	asciiArt: '',
	showRecentNotes: false,
};

export default class BookmarksNewTabPlugin extends Plugin {
	settings: BookmarksNewTabPluginSettings;

	async onload() {
		await this.loadSettings();
		this.addSettingTab(new SampleSettingTab(this.app, this));

		this.app.workspace.iterateAllLeaves((leaf) => {
			if (leaf.getViewState().type === 'empty') this.injectHomepage(leaf);
		});

		this.registerEvent(
			this.app.workspace.on('layout-change', () => {
				this.app.workspace.iterateAllLeaves((leaf) => {
					if (leaf.getViewState().type === 'empty') this.injectHomepage(leaf);
				});
			})
		);
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	onunload() {
		document.querySelectorAll(
			'.new-tab-bookmarks-bookmarks, .new-tab-bookmarks-ascii-art, .new-tab-bookmarks-recent'
		).forEach(el => el.remove());
		document.querySelectorAll('[data-ntb-injected]').forEach(el => {
			el.classList.remove('show-recent', 'rendered');
			el.removeAttribute('data-ntb-injected');
		});
	}

	private getBookmarks(): BookmarkItem[] {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const bp = (this.app as any).internalPlugins?.plugins?.['bookmarks'];
		return bp?.instance?.items ?? [];
	}

	private getOpenFilePaths(): Set<string> {
		const paths = new Set<string>();
		this.app.workspace.iterateAllLeaves(leaf => {
			const file = leaf.getViewState().state?.file;
			if (typeof file === 'string') paths.add(file);
		});
		return paths;
	}

	private getRecentFiles(count: number): TFile[] {
		const openPaths = this.getOpenFilePaths();
		const recent: TFile[] = [];
		for (const path of this.app.workspace.getLastOpenFiles()) {
			if (recent.length >= count) break;
			if (openPaths.has(path)) continue;
			const file = this.app.vault.getFileByPath(path);
			if (file) recent.push(file);
		}
		return recent;
	}

	private injectHomepage(leaf: WorkspaceLeaf) {
		const container = leaf.view.containerEl;
		const rootEmptyState = container.querySelector('.empty-state-container');
		if (!rootEmptyState || rootEmptyState.hasAttribute('data-ntb-injected')) return;

		const { asciiArt, showRecentNotes } = this.settings;
		const bookmarkItems = this.getBookmarks();

		if (!asciiArt && !showRecentNotes && bookmarkItems.length === 0) return;

		rootEmptyState.setAttribute('data-ntb-injected', 'true');

		if (asciiArt) rootEmptyState.prepend(this.renderAsciiArt(asciiArt));

		if (showRecentNotes) {
			rootEmptyState.classList.add('show-recent');
			const recentEl = createEl('div', { cls: 'new-tab-bookmarks-recent' });
			for (const file of this.getRecentFiles(5)) {
				this.createTreeItem(recentEl, 'file', file.basename, file.path, (e) => {
					e.preventDefault();
					leaf.openFile(file);
				});
			}
			rootEmptyState.appendChild(recentEl);
		}

		if (bookmarkItems.length > 0) {
			const wrapper = createEl('div', { cls: 'new-tab-bookmarks-bookmarks' });
			this.renderItems(bookmarkItems, wrapper, leaf);
			rootEmptyState.appendChild(wrapper);
		}

		rootEmptyState.classList.add('rendered');
	}

	private renderAsciiArt(asciiArt: string): HTMLElement {
		const lines = asciiArt.split('\n');
		const props = lines.map(line => ({
			length: line.trim().length,
			leading: line.match(/^\s+/)?.[0]?.length ?? 0,
		}));
		const max = props.reduce((acc, p) => (p.length > acc.length ? p : acc), { length: 0, leading: 0 });
		const trimmed = lines.map(line => line.slice(max.leading, Math.min(line.length, max.length + max.leading)));
		const el = createEl('pre', { cls: 'new-tab-bookmarks-ascii-art' });
		el.createEl('code', { text: trimmed.join('\n') });
		return el;
	}

	private createTreeItem(parent: HTMLElement, iconId: string, label: string, path?: string, onClick?: (e: MouseEvent) => void): HTMLElement {
		const treeItem = parent.createEl('div', { cls: 'tree-item', ...(path ? { attr: { 'data-path': path } } : {}) });
		const self = treeItem.createEl('div', { cls: 'tree-item-self bookmark is-clickable' });
		self.style.setProperty('margin-inline-start', '0px', 'important');
		self.style.setProperty('padding-inline-start', '24px', 'important');
		setIcon(self.createEl('div', { cls: 'tree-item-icon' }), iconId);
		self.createEl('div', { cls: 'tree-item-inner' })
			.createEl('span', { text: label, cls: 'tree-item-inner-text' });
		if (onClick) self.addEventListener('click', onClick);
		return self;
	}

	private resolveFileLabel(item: BookmarkItem): string {
		if (item.title) return item.title;
		if (!item.path) return '(untitled)';
		const vaultFile = this.app.vault.getAbstractFileByPath(item.path);
		if (vaultFile instanceof TFile) return vaultFile.basename;
		if (vaultFile instanceof TFolder) return vaultFile.name;
		return item.path.split('/').pop()?.replace(/\.md$/, '') ?? item.path;
	}

	private renderItems(items: BookmarkItem[], parent: HTMLElement, leaf: WorkspaceLeaf) {
		for (const item of items) {
			switch (item.type) {
				case 'group': {
					const groupEl = parent.createEl('div', { cls: 'tree-item new-tab-bookmarks-group' });
					groupEl.createEl('div', { text: item.title || 'Group', cls: 'tree-item-self new-tab-bookmarks-group-header' });
					if (item.items?.length) {
						this.renderItems(item.items, groupEl.createEl('div', { cls: 'new-tab-bookmarks-subgroup' }), leaf);
					}
					break;
				}
				case 'file':
				case 'folder': {
					const label = this.resolveFileLabel(item);
					this.createTreeItem(parent, item.type === 'folder' ? 'folder' : 'file', label, item.path, (e) => {
						e.preventDefault();
						if (!item.path) return;
						const tfile = this.app.vault.getFileByPath(item.path);
						if (tfile) leaf.openFile(tfile);
						else this.app.workspace.openLinkText(item.path, '', false);
					});
					break;
				}
				case 'url':
					this.createTreeItem(parent, 'link', item.title || item.url || '(no url)', undefined, () => {
						window.open(item.url ?? '#', '_blank', 'noopener,noreferrer');
					});
					break;
				case 'search':
					this.createTreeItem(parent, 'search', item.title || `Search: ${item.query ?? ''}`, undefined, (e) => {
						e.preventDefault();
						// eslint-disable-next-line @typescript-eslint/no-explicit-any
						(this.app as any).internalPlugins?.plugins?.['global-search']?.instance?.openGlobalSearch(item.query ?? '');
					});
					break;
				case 'graph':
					this.createTreeItem(parent, 'git-fork', item.title || 'Graph view', undefined, (e) => {
						e.preventDefault();
						// eslint-disable-next-line @typescript-eslint/no-explicit-any
						(this.app as any).commands?.executeCommandById('graph:open');
					});
					break;
				default:
					parent.createEl('div', { text: item.title ?? item.type });
			}
		}
	}
}
