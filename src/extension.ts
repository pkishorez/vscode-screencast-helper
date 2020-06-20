// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from "vscode";
import { newStatusbarItem } from "./utils/ui";

const commands = {
	hello: "hello-world.helloWorld",
};

export function activate(context: vscode.ExtensionContext) {
	console.log('Congratulations, your extension "hello-world" is now active!');

	const statusbar = newStatusbarItem({
		command: commands.hello,
		text: "hellooo",
	});
	const hello = vscode.commands.registerCommand(commands.hello, () => {
		vscode.window.showInformationMessage("Hello Screencast!!!!");
	});

	context.subscriptions.push(hello, statusbar);
}

// this method is called when your extension is deactivated
export function deactivate() {}
