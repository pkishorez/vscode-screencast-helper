import { ui } from "./utils/ui";
import vscode from "vscode";
import { Interpreter, AnyEventObject } from "xstate";

export const commands = {
	DEBUG: "screencastHelper.DEBUG",
	selectProject: "screencastHelper.selectProject",
	createProject: "screencastHelper.createProject",
	delProject: "screencastHelper.delProject",

	record: "screencastHelper.record",
	addBreakPoint: "screencastHelper.addBreakPoint",
	stopRecording: "screencastHelper.stopRecording",

	play: "screencastHelper.play",
	pause: "screencastHelper.pause",
	stopPlaying: "screencastHelper.playStop",
};
export const initCommands = (
	context: vscode.ExtensionContext,
	run: Interpreter<any, any, AnyEventObject, any>
) => {
	const disposals = {
		createProject: vscode.commands.registerCommand(
			commands.createProject,
			() => run.send({ type: "CREATE_PROJECT" })
		),
		selectProject: vscode.commands.registerCommand(
			commands.selectProject,
			() => run.send({ type: "SELECT_PROJECT" })
		),
		delProject: vscode.commands.registerCommand(commands.delProject, () =>
			run.send({ type: "DELETE_PROJECT" })
		),
		play: vscode.commands.registerCommand(commands.play, () =>
			run.send({
				type: "PLAY",
			})
		),
		stopPlaying: vscode.commands.registerCommand(commands.stopPlaying, () =>
			run.send({
				type: "STOP_PLAYING",
			})
		),
		pause: vscode.commands.registerCommand(commands.pause, () =>
			run.send({ type: "PAUSE" })
		),
		record: vscode.commands.registerCommand(commands.record, () =>
			run.send({
				type: "RECORD",
			})
		),
		addBreakPoint: vscode.commands.registerCommand(
			commands.addBreakPoint,
			() =>
				run.send({
					type: "ADD_BREAKPOINT",
				})
		),
		stopRecording: vscode.commands.registerCommand(
			commands.stopRecording,
			() =>
				run.send({
					type: "STOP_RECORDING",
				})
		),
	};
	Object.keys(disposals).forEach((v) => {
		context.subscriptions.push(disposals[v]);
	});
};

const buttonMap = {
	// PROJECT MANAGEMENT
	CREATE_PROJECT: ui.createStatusBarItem({
		command: commands.createProject,
		text: "$(add)",
		priority: 0,
	}),
	SELECT_PROJECT: ui.createStatusBarItem({
		command: commands.selectProject,
		text: "$(list-flat)",
		priority: -1,
	}),
	DELETE_PROJECT: ui.createStatusBarItem({
		command: commands.delProject,
		text: "$(trash)",
		priority: -2,
		color: "red",
	}),

	// PLAY
	PLAY: ui.createStatusBarItem({
		command: commands.play,
		text: "$(debug-start)",
		priority: -10,
	}),
	PAUSE: ui.createStatusBarItem({
		command: commands.pause,
		text: "$(pause)",
		priority: -11,
		color: "yellow",
	}),
	STOP_PLAYING: ui.createStatusBarItem({
		command: commands.stopPlaying,
		text: "$(debug-stop)",
		priority: -12,
	}),

	// RECORD
	RECORD: ui.createStatusBarItem({
		command: commands.record,
		text: "$(close-dirty)",
		priority: -20,
		color: "yellow",
	}),
	ADD_BREAKPOINT: ui.createStatusBarItem({
		command: commands.addBreakPoint,
		text: "$(star-add)",
		priority: -21,
	}),
	STOP_RECORDING: ui.createStatusBarItem({
		command: commands.stopRecording,
		text: "$(debug-stop)",
		priority: -22,
	}),
};
ui.createStatusBarItem({ text: "$(gripper)", priority: 0, show: true });
ui.createStatusBarItem({ text: "$(gripper)", priority: -200, show: true });

export const statusButton = ui.createStatusBarItem({
	text: "",
	priority: -199,
	show: true,
});
type IButtonNames = keyof typeof buttonMap;
export const showButtons = (buttons: IButtonNames[]) => {
	Object.keys(buttonMap).forEach((button) => {
		const show = !!buttons.find((v) => v === button);
		const statusBar = (buttonMap as any)[button];
		show && statusBar ? statusBar.show() : statusBar.hide();
	});
};
