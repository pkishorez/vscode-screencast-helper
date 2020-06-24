// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import vscode from "vscode";
import { ui } from "./utils/ui";
import _ from "lodash";
import { IChange, document } from "./utils/document";
import { initStorage } from "./storage";
import { execute } from "./exec";

export const commands = {
	DEBUG: "screencastHelper.DEBUG",
	selectProject: "screencastHelper.selectProject",
	createProject: "screencastHelper.createProject",

	record: "screencastHelper.record",
	addBreakPoint: "screencastHelper.addBreakPoint",
	stopRecording: "screencastHelper.stopRecording",

	play: "screencastHelper.play",
	pause: "screencastHelper.pause",
	stopPlaying: "screencastHelper.playStop",
};

export function activate(context: vscode.ExtensionContext) {
	console.log(
		'Congratulations, your extension "screencast-helper" is now active!'
	);
	vscode.window.showInformationMessage("Hello Screencast!!!!");
	execute(context);
}

// this method is called when your extension is deactivated
export function deactivate() {}
