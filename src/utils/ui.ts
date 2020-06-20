import * as vscode from "vscode";

export const newStatusbarItem = ({
	command,
	text,
}: {
	command: string;
	text: string;
}) => {
	const status = vscode.window.createStatusBarItem(
		vscode.StatusBarAlignment.Left,
		100
	);
	status.command = command;
	status.text = text;
	status.show();
	return status;
};
