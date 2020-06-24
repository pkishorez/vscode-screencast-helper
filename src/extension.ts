// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import vscode from "vscode";
import _ from "lodash";
import { execute } from "./exec";

export function activate(context: vscode.ExtensionContext) {
	console.log(
		'Congratulations, your extension "screencast-helper" is now active!'
	);
	vscode.window.showInformationMessage("Hello Screencast!!!!");
	execute(context);
}

// this method is called when your extension is deactivated
export function deactivate() {}
