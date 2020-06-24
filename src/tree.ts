import { IStorageType } from "./storage";
import vscode from "vscode";

export const initTree = (storage: IStorageType) => {
	const triggerChange = new vscode.EventEmitter<any>();
	storage.onChange((data) => {
		triggerChange.fire(0);
	});

	vscode.window.registerTreeDataProvider<{
		id: string;
		isProject: boolean;
		name: string;
		length: number;
		children: {
			id: string;
			name: string;
			isProject: boolean;
			length: number;
			children: any[];
		}[];
	}>("screencastHelper", {
		getChildren(key) {
			if (!key) {
				return storage.getProjectList();
			}
			if (key.isProject) {
				return key.children;
			} else {
				return [];
			}
		},
		getTreeItem(item) {
			if (item.isProject) {
				return {
					id: item.id,
					label: `${item.name} ${item.length}`,
					collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
				} as vscode.TreeItem;
			} else {
				return {
					id: item.id,
					label: `${item.name} ${item.length}`,
					collapsibleState: vscode.TreeItemCollapsibleState.None,
				} as vscode.TreeItem;
			}
		},
		onDidChangeTreeData: triggerChange.event,
	});
};
