import vscode from "vscode";
import { Machine, interpret, send, assign } from "xstate";
import { initStorage, Project, IProjectMap } from "./storage";
import { ui } from "./utils/ui";
import { commands } from "./extension";
import _ from "lodash";
import { document, IChange } from "./utils/document";

export const execute = async (extcontext: vscode.ExtensionContext) => {
	const buttonMap = {
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
		STOP_PLAYING: ui.createStatusBarItem({
			command: commands.stopPlaying,
			text: "$(debug-stop)",
			priority: -2,
		}),
		PLAY: ui.createStatusBarItem({
			command: commands.play,
			text: "$(debug-start)",
			priority: -2,
		}),
		PAUSE: ui.createStatusBarItem({
			command: commands.pause,
			text: "$(debug-pause)",
			priority: -3,
		}),
		RECORD: ui.createStatusBarItem({
			command: commands.record,
			text: "$(close-dirty)",
			priority: -21,
		}),
		STOP_RECORDING: ui.createStatusBarItem({
			command: commands.stopRecording,
			text: "$(debug-stop)",
			priority: -22,
		}),
		ADD_BREAKPOINT: ui.createStatusBarItem({
			command: commands.addBreakPoint,
			text: "$(star-add)",
			priority: -23,
		}),
	};
	ui.createStatusBarItem({ text: "$(gripper)", priority: 0, show: true });
	ui.createStatusBarItem({ text: "$(gripper)", priority: -200, show: true });
	ui.createStatusBarItem({
		text: "DEBUG",
		command: commands.DEBUG,
		priority: -201,
		show: true,
	});
	const statusButton = ui.createStatusBarItem({
		text: "",
		priority: -199,
		show: true,
	});
	type IButtonNames = keyof typeof buttonMap;
	const showButtons = (buttons: IButtonNames[]) => {
		Object.keys(buttonMap).forEach((button) => {
			const show = !!buttons.find((v) => v === button);
			const statusBar = (buttonMap as any)[button];
			show && statusBar ? statusBar.show() : statusBar.hide();
		});
	};
	const commandReg = {
		debug: vscode.commands.registerCommand(commands.DEBUG, () => {
			console.log(JSON.stringify({ stored: storage.data }, null, "  "));
		}),
		createProject: vscode.commands.registerCommand(
			commands.createProject,
			() => run.send({ type: "CREATE_PROJECT" })
		),
		selectProject: vscode.commands.registerCommand(
			commands.selectProject,
			() => run.send({ type: "SELECT_PROJECT" })
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

	const storage = await initStorage(extcontext);

	const machine = Machine<{
		project?: Project;
		playStatus: {
			paused: boolean;
			currentFrame: number;
		};
	}>(
		{
			id: "screencast",
			context: { playStatus: { paused: false, currentFrame: 0 } },
			initial: "idle",
			states: {
				idle: {
					initial: "noProjectSelected",
					states: {
						noProjectSelected: {
							on: {
								CREATE_PROJECT: {
									target: "creatingProject",
								},
								SELECT_PROJECT: {
									target: "selectingProject",
								},
							},
						},
						creatingProject: {
							invoke: {
								id: "createProject",
								src: "createProject",
								onDone: {
									target: "projectSelected",
									actions: assign((context, event) => ({
										...context,
										project: event.data,
									})),
								},
								onError: {
									target: "noProjectSelected",
								},
							},
						},
						selectingProject: {
							invoke: {
								id: "selectProject",
								src: "selectProject",
								onDone: {
									target: "projectSelected",
									actions: [
										assign((context, event) => ({
											...context,
											project: event.data,
										})),
									],
								},
								onError: {
									target: "noProjectSelected",
								},
							},
						},
						projectSelected: {
							on: {
								SELECT_PROJECT: {
									target: "selectingProject",
								},
								CREATE_PROJECT: {
									target: "creatingProject",
								},
								PLAY: {
									target: "#screencast.playing",
									cond: (context) => !!context.project,
								},
								RECORD: {
									target: "#screencast.recording",
									cond: (context) => !!context.project,
								},
							},
						},
					},
				},
				playing: {
					entry: assign((context) => ({
						...context,
						playStatus: { ...context.playStatus, currentFrame: 0 },
					})),
					activities: ["play"],
					on: {
						PLAY: {
							actions: (context) => {
								context.playStatus.paused = false;
							},
						},
						PAUSE: {
							actions: (context) => {
								context.playStatus.paused = true;
							},
						},
						STOP_PLAYING: {
							target: "#screencast.idle.projectSelected",
						},
					},
				},
				recording: {
					activities: "record",
					states: {},
					on: {
						ADD_BREAKPOINT: {
							actions: ["addBreakPoint"],
						},
						STOP_RECORDING: {
							target: "#screencast.idle.projectSelected",
						},
					},
				},
			},
		},
		{
			services: {
				selectProject: async (context, event) => {
					const selectedOption = await vscode.window.showQuickPick([
						...Object.keys(storage.data),
					]);
					if (!selectedOption) {
						if (context.project) {
							return context.project;
						}
						return Promise.reject("");
					}
					return storage.project(selectedOption);
				},
				createProject: async (context) => {
					const newProject = await vscode.window.showInputBox({
						prompt: "Name the project.",
						value: "Newone",
					});
					if (!newProject) {
						return;
					}
					if (storage.hasProject(newProject)) {
						vscode.window.showErrorMessage(
							`Project ${newProject} already exist`
						);
						if (!context.project) {
							return Promise.reject("");
						}
					}
					return storage.project(newProject);
				},
			},
			actions: {
				addBreakPoint: async (context) => {
					if (!context.project) {
						return;
					}
					const name = await vscode.window.showInputBox({
						prompt: "Name the breakpoint.",
					});
					name && context.project.addBreakPoint(name);
				},
			},
			guards: {
				ensureProjectSelected: (context) => !!context.project,
			},
			activities: {
				play(context) {
					const editor = vscode.window.activeTextEditor;
					const playData = context.project?.getPlayData();
					if (!editor || !playData) {
						vscode.window.showErrorMessage("No Editor Found!");
						return;
					}
					document(editor).focus();
					document(editor).setText(playData.initialContent);

					// REHYDRATE LOGIC GOES HERE V.V Important!!!
					playData.frames = playData.frames.map((frame) => {
						if (frame.type === "CHANGE") {
							return {
								type: "CHANGE",
								change: document(editor).rehydrate(
									frame.change
								),
							};
						}
						return frame;
					});
					// IMPORTANT PART.

					let currentFrame = 0;
					const interval = setInterval(() => {
						try {
							if (context.playStatus.paused) {
								return;
							}
							const frame = playData.frames[currentFrame++];
							if (!frame) {
								// It's done!
								dispose();
								return;
							}
							if (frame.type === "BREAKPOINT") {
								context.playStatus.paused = true;
							} else if (frame.type === "CHANGE") {
								document(editor)
									.applyChange(frame.change)
									.catch((err) => {
										console.error(
											"ERROR IN APPLY EDIT",
											frame.change,
											err.message
										);
									});
							}
						} catch (e) {
							console.log("ERROR : ", e.message);
						}
					}, 30);
					const disableType = vscode.commands.registerCommand(
						"type",
						() => {
							// Ignore.
						}
					);
					const dispose = () => {
						clearInterval(interval);
						buttonMap.PLAY.hide();
						disableType.dispose();
					};
					return dispose;
				},
				record(context) {
					if (!context.project) {
						return;
					}
					let edits: vscode.TextDocumentContentChangeEvent[] = [];
					const textchangeHandler = vscode.workspace.onDidChangeTextDocument(
						(e) => {
							edits = _.cloneDeep(e.contentChanges) as any;
						}
					);
					const selectionHandler = vscode.window.onDidChangeTextEditorSelection(
						(e) => {
							context.project?.addChange({
								edits: edits,
								selections: _.cloneDeep(e.selections) as any,
							});

							edits = [];
						}
					);
					extcontext.subscriptions.push(
						textchangeHandler,
						selectionHandler
					);
					return () => {
						textchangeHandler.dispose();
						selectionHandler.dispose();
					};
				},
			},
		}
	);
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

	const run = interpret(machine);
	run.start();
	const onChange = (state: typeof run.state) => {
		const nextButtons = state.nextEvents.filter((nextEvent) => {
			return machine.transition(state, { type: nextEvent }).changed;
		});
		showButtons(nextButtons as any);

		const projectName = state.context.project?.projectid;

		statusButton.text = `${
			projectName ? ` - ${projectName}` : ""
		} ${state.toStrings(state.value)}`;
	};
	run.onTransition((state) => {
		if (state.changed) {
			onChange(state);
		}
	});
	onChange(run.state);
};
