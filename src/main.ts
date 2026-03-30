import { Plugin, WorkspaceLeaf } from 'obsidian';

interface BookmarkItem {
	type: 'file' | 'folder' | 'search' | 'url' | 'group' | 'graph';
	title?: string;
	path?: string;
	url?: string;
	query?: string;
	items?: BookmarkItem[];
}

export default class BookmarksNewTabPlugin extends Plugin {
	async onload() {
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

	onunload() {
		document.querySelectorAll('.new-tab-bookmarks-bookmarks').forEach(el => el.remove());
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

		const emptyState = container.querySelector('.empty-state');
		if (!emptyState) return;

		const items = this.getBookmarks();
		if (items.length === 0) return;

		const wrapper = createEl('div', { cls: 'new-tab-bookmarks-bookmarks' });
		createEl('p', { text: 'Bookmarks', cls: 'new-tab-bookmarks-bookmarks-heading' }, el => wrapper.appendChild(el));
		const list = createEl('ul', { cls: 'new-tab-bookmarks-bookmarks-list' });
		wrapper.appendChild(list);

		this.renderItems(items, list);

		emptyState.insertBefore(wrapper, emptyState.firstChild);
	}

	private renderItems(items: BookmarkItem[], parent: HTMLElement) {
		for (const item of items) {
			const li = parent.createEl('li', { cls: 'new-tab-bookmarks-bookmark-item' });

			switch (item.type) {
				case 'group': {
					li.createEl('span', {
						text: item.title ?? 'Group',
						cls: 'new-tab-bookmarks-bookmark-group-label',
					});
					if (item.items?.length) {
						const subList = li.createEl('ul', { cls: 'new-tab-bookmarks-bookmarks-list new-tab-bookmarks-bookmarks-sublist' });
						this.renderItems(item.items, subList);
					}
					break;
				}
				case 'file':
				case 'folder': {
					const label = item.title ?? item.path ?? '(untitled)';
					const link = li.createEl('a', { text: label, cls: 'new-tab-bookmarks-bookmark-link' });
					link.addEventListener('click', (e) => {
						e.preventDefault();
						if (item.path) {
							this.app.workspace.openLinkText(item.path, '', false);
						}
					});
					break;
				}
				case 'url': {
					const label = item.title ?? item.url ?? '(no url)';
					const link = li.createEl('a', { text: label, cls: 'new-tab-bookmarks-bookmark-link new-tab-bookmarks-bookmark-url' });
					link.href = item.url ?? '#';
					link.setAttribute('target', '_blank');
					link.setAttribute('rel', 'noopener noreferrer');
					break;
				}
				case 'search': {
					const label = item.title ?? `Search: ${item.query ?? ''}`;
					const link = li.createEl('a', { text: label, cls: 'new-tab-bookmarks-bookmark-link new-tab-bookmarks-bookmark-search' });
					link.addEventListener('click', (e) => {
						e.preventDefault();
						// eslint-disable-next-line @typescript-eslint/no-explicit-any
						(this.app as any).internalPlugins?.plugins?.['global-search']
							?.instance?.openGlobalSearch(item.query ?? '');
					});
					break;
				}
				case 'graph': {
					const label = item.title ?? 'Graph view';
					const link = li.createEl('a', { text: label, cls: 'new-tab-bookmarks-bookmark-link new-tab-bookmarks-bookmark-graph' });
					link.addEventListener('click', (e) => {
						e.preventDefault();
						this.app.commands.executeCommandById('graph:open');
					});
					break;
				}
				default:
					li.createEl('span', { text: item.title ?? item.type });
			}
		}
	}
}
