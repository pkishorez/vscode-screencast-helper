import * as vscode from "vscode";

export const ui = {
	createStatusBarItem: ({
		command,
		text,
		align = "left",
		priority = 0,
		show = false,
		color,
	}: {
		command?: string;
		text: string;
		align?: "left" | "right";
		priority?: number;
		show?: boolean;
		color?: string;
	}) => {
		const status = vscode.window.createStatusBarItem(
			align === "left"
				? vscode.StatusBarAlignment.Left
				: vscode.StatusBarAlignment.Right,
			priority
		);
		status.command = command;
		status.text = text;
		status.color = color;
		show && status.show();
		return status;
	},
};
