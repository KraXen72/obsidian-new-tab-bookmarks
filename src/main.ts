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
	settings: BookmarksNewTabPluginSettings;

	async onload() {
		await this.loadSettings();
		this.addSettingTab(new SampleSettingTab(this.app, this));
		// Inject into any already-open empty leaves on load
		this.app.workspace.iterateAllLeaves((leaf) => {
			if (leaf.getViewState().type === 'empty') {
				this.injectBookmarks(leaf);
			}
		});

		// Re-run on every layout change (new tab opened, leaf switched, etc.)
		this.registerEvent(
			this.app.workspace.on('layout-change', () => {
				this.app.workspace.iterateAllLeaves((leaf) => {
					if (leaf.getViewState().type === 'empty') {
						this.injectBookmarks(leaf);
					}
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
		document.querySelectorAll('.new-tab-bookmarks-bookmarks').forEach(el => el.remove());
		document.querySelectorAll('.new-tab-bookmarks-divider').forEach(el => el.remove());
		document.querySelectorAll('.new-tab-bookmarks-ascii-art').forEach(el => el.remove());
	}

	private getBookmarks(): BookmarkItem[] {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const bp = (this.app as any).internalPlugins?.plugins?.['bookmarks'];
		return bp?.instance?.items ?? [];
	}

	private injectBookmarks(leaf: WorkspaceLeaf) {
		const container = leaf.view.containerEl;

		// Don't inject twice into the same leaf
		if (container.querySelector('.new-tab-bookmarks-bookmarks')) return;

		const rootEmptyState = container.querySelector('.empty-state-container');
		if (!rootEmptyState) return;

		const items = this.getBookmarks();
		if (items.length === 0 && !this.settings.asciiArt) return;

		// Render ASCII art if it exists (above the default actions)
		if (this.settings.asciiArt) {
			const lines = this.settings.asciiArt.split('\n');
			const lengthObjects = lines.map(line => ({ 
				length: line.trim().length, 
				leading: line.match(/^\s+/)?.[0]?.length || 0
			}))
			const maxLineLength = lengthObjects.reduce((acc, lo) => {
				return (lo.length > acc.length) ? lo : acc
			}, { length: 0, leading: 0 });

			const trimmedLines = lines.map(line => line.slice(
				maxLineLength.leading, 
				Math.min(line.length, maxLineLength.length + maxLineLength.leading)
			));
			const trimmedAsciiArt = trimmedLines.join('\n');

			const asciiArtEl = createEl('pre', { cls: 'new-tab-bookmarks-ascii-art' });
			asciiArtEl.createEl('code', { text: trimmedAsciiArt });
			rootEmptyState.prepend(asciiArtEl);
		}

		if (items.length === 0) return;

		// Divider between existing actions and bookmarks
		const divider = createEl('div', { cls: 'new-tab-bookmarks-divider', text: " " });
		rootEmptyState.appendChild(divider);

		const wrapper = createEl('div', { cls: 'new-tab-bookmarks-bookmarks' });

		this.renderItems(items, wrapper, leaf);

		rootEmptyState.appendChild(wrapper);
		rootEmptyState.classList.add("rendered");
	}

	/** Creates a sidebar-style tree-item row and returns the clickable `tree-item-self` element. */
	private createTreeItem(parent: HTMLElement, iconId: string, label: string, path?: string): HTMLElement {
		const treeItem = parent.createEl('div', { cls: 'tree-item', ...(path ? { attr: { 'data-path': path } } : {}) });
		const self = treeItem.createEl('div', { cls: 'tree-item-self bookmark is-clickable', attr: { draggable: 'true' } });
		self.style.setProperty('margin-inline-start', '0px', 'important');
		self.style.setProperty('padding-inline-start', '24px', 'important');
		const iconEl = self.createEl('div', { cls: 'tree-item-icon' });
		setIcon(iconEl, iconId);
		const inner = self.createEl('div', { cls: 'tree-item-inner' });
		inner.createEl('span', { text: label, cls: 'tree-item-inner-text' });
		return self;
	}

	/** Resolves a display label for a file/folder bookmark.
	 *  Prefers an explicit title, then falls back to the vault object's name
	 *  (TFile.basename strips the extension; TFolder.name is just the folder name).
	 *  If the path isn't in the vault yet, takes the last path segment as a last resort.
	 */
	private resolveFileLabel(item: BookmarkItem): string {
		if (item.title) return item.title;
		if (!item.path) return '(untitled)';
		const vaultFile = this.app.vault.getAbstractFileByPath(item.path);
		if (vaultFile instanceof TFile) return vaultFile.basename;
		if (vaultFile instanceof TFolder) return vaultFile.name;
		// Fallback for paths not currently in the vault
		return item.path.split('/').pop()?.replace(/\.md$/, '') ?? item.path;
	}

	private renderItems(items: BookmarkItem[], parent: HTMLElement, leaf: WorkspaceLeaf) {
		for (const item of items) {
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
					const label = this.resolveFileLabel(item);
					const icon = item.type === 'folder' ? 'folder' : 'file';
					const self = this.createTreeItem(parent, icon, label, item.path);
					self.addEventListener('click', (e) => {
						e.preventDefault();
						if (!item.path) return;
						const tfile = this.app.vault.getFileByPath(item.path);
						if (tfile) {
							leaf.openFile(tfile);
						} else {
							// Folder or file not found: fall back to openLinkText
							this.app.workspace.openLinkText(item.path, '', false);
						}
					});
					break;
				}
				case 'url': {
					const label = item.title || item.url || '(no url)';
					const self = this.createTreeItem(parent, 'link', label);
					self.addEventListener('click', () => {
						window.open(item.url ?? '#', '_blank', 'noopener,noreferrer');
					});
					break;
				}
				case 'search': {
					const label = item.title || `Search: ${item.query ?? ''}`;
					const self = this.createTreeItem(parent, 'search', label);
					self.addEventListener('click', (e) => {
						e.preventDefault();
						// eslint-disable-next-line @typescript-eslint/no-explicit-any
						(this.app as any).internalPlugins?.plugins?.['global-search']
							?.instance?.openGlobalSearch(item.query ?? '');
					});
					break;
				}
				case 'graph': {
					const label = item.title || 'Graph view';
					const self = this.createTreeItem(parent, 'git-fork', label);
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
	}
}
