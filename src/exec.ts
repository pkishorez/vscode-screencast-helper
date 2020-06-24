import vscode from "vscode";
import { Machine, interpret, send, assign } from "xstate";
import { initStorage, Project, IProjectMap, IPlayFrame } from "./storage";
import _ from "lodash";
import { document, documentUtils } from "./utils/document";
import { showButtons, initCommands, statusButton } from "./setup";
import { initTree } from "./tree";

const sleep = (timeout: number) =>
	new Promise((resolve) => setTimeout(resolve, timeout));
export const execute = async (extcontext: vscode.ExtensionContext) => {
	const storage = await initStorage(extcontext);

	const machine = Machine<{
		project?: Project;
		status: string;
		playStatus: {
			progress: string;
			frames: IPlayFrame[];
			currentFrame: number;
		};
	}>(
		{
			id: "screencast",
			context: {
				status: "",
				playStatus: { currentFrame: 0, frames: [], progress: "" },
			},
			initial: "idle",
			states: {
				idle: {
					initial: "noProjectSelected",
					states: {
						creatingProject: {
							invoke: {
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
								src: "selectProject",
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
						deletingProject: {
							invoke: {
								src: "deleteProject",
								onDone: {
									target: "projectSelected",
								},
								onError: {
									target: "noProjectSelected",
								},
							},
						},
						noProjectSelected: {
							entry: assign((context) => ({
								...context,
								project: undefined,
							})),
							on: {
								CREATE_PROJECT: {
									target: "creatingProject",
								},
								SELECT_PROJECT: {
									target: "selectingProject",
									cond: () =>
										storage.getProjectList().length !== 0,
								},
								DELETE_PROJECT: {
									target: "deletingProject",
									cond: () =>
										storage.getProjectList().length !== 0,
								},
							},
						},

						projectSelected: {
							on: {
								CREATE_PROJECT: {
									target: "creatingProject",
								},
								SELECT_PROJECT: {
									target: "selectingProject",
									cond: () =>
										storage.getProjectList().length !== 0,
								},
								DELETE_PROJECT: {
									target: "deletingProject",
									cond: () =>
										storage.getProjectList().length !== 0,
								},
								PLAY: {
									target: "#screencast.play",
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
				play: {
					initial: "playing",
					entry: assign((context) => ({
						...context,
						playStatus: {
							...context.playStatus,
							currentFrame: 0,
							frames: context.project?.getPlayData().frames || [],
						},
					})),
					states: {
						playing: {
							invoke: {
								id: "playservice",
								src: "playService",
							},
							on: {
								TICK: {
									actions: assign((context, event) => ({
										...context,
										playStatus: {
											...context.playStatus,
											currentFrame: event.frameno,
										},
									})),
								},
								PAUSE: {
									actions: assign({
										status: (context, event) =>
											event.status
												? event.status
												: context.status,
									}),
									target: "paused",
								},
							},
						},
						paused: {
							on: {
								PLAY: {
									target: "playing",
								},
							},
						},
					},
					on: {
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
				playService: (context, event) => (callback, onReceive) => {
					const editor = vscode.window.activeTextEditor;
					const playData = context.project?.getPlayData();
					if (!editor || !playData) {
						vscode.window.showErrorMessage("No Editor Found!");
						return;
					}
					documentUtils.focus();
					let { currentFrame, frames } = context.playStatus;
					if (currentFrame === 0) {
						document(editor).setText(playData.initialContent);
					}

					const tick = async () => {
						const frame = frames[currentFrame++];
						if (!frame) {
							callback({
								type: "STOP_PLAYING",
							});
							return;
						}
						callback({
							type: "TICK",
							frameno: currentFrame,
						});
						if (frame.type === "BREAKPOINT") {
							callback({
								type: "PAUSE",
								status: `${frame.number}/${playData.nBreakpoints}`,
							});
						} else if (frame.type === "CHANGE") {
							await document(editor).applyChange(frame.change);
						}
					};

					const disableType = vscode.commands.registerCommand(
						"type",
						() => {
							// Ignore.
						}
					);
					const tickDispose = (() => {
						let cancelled = false;
						(async () => {
							while (true) {
								if (cancelled) {
									disableType.dispose();
									return;
								}
								await tick();
								await sleep(80);
							}
						})();
						return () => (cancelled = true);
					})();
					return () => {
						tickDispose();
					};
				},
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
						return context.project || Promise.reject("none");
					}
					if (storage.hasProject(newProject)) {
						vscode.window.showErrorMessage(
							`Project ${newProject} already exist`
						);
					}
					return storage.project(newProject);
				},
				deleteProject: async (context) => {
					const projectname = context.project?.projectid;
					const delProjects = await vscode.window.showQuickPick(
						storage.getProjectList().map((v) => v.id),
						{
							canPickMany: true,
						}
					);
					const existingProjectDeleted = delProjects.find(
						(v) => v === projectname
					);
					if (delProjects.length) {
						storage.delProject(delProjects);
					}
					if (existingProjectDeleted) {
						return Promise.reject("");
					}
					return Promise.resolve("");
				},
			},
			actions: {
				setProject: assign((context, event: any) => ({
					...context,
					project: event.project,
				})),
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
			activities: {
				record(context) {
					if (!context.project) {
						return;
					}
					let edits: vscode.TextDocumentContentChangeEvent[] = [];
					let selections: vscode.Selection[];
					const textchangeHandler = vscode.workspace.onDidChangeTextDocument(
						(e) => {
							if (edits.length) {
								context.project?.addChange({
									edits,
									selections,
								});
							}
							edits = _.cloneDeep(e.contentChanges as any);
							selections = _.cloneDeep(
								vscode.window.activeTextEditor.selections
							);
						}
					);
					const selectionHandler = vscode.window.onDidChangeTextEditorSelection(
						(e) => {
							context.project?.addChange({
								edits,
								selections: _.cloneDeep(e.selections) as any,
							});

							edits = [];
						}
					);
					return () => {
						textchangeHandler.dispose();
						selectionHandler.dispose();
					};
				},
			},
		}
	);
	initTree(storage);

	const run = interpret(machine);
	run.start();
	initCommands(extcontext, run);

	const onChange = (state: typeof run.state) => {
		const nextButtons = state.nextEvents.filter((nextEvent) => {
			return machine.transition(state, { type: nextEvent }).changed;
		});
		showButtons(nextButtons as any);
		const projectid = state.context.project?.projectid;
		statusButton.text = `${projectid ? projectid + " - " : ""} : ${
			state.context.status
		} : ${state.toStrings(state.value)}`;
	};
	run.onTransition((state) => {
		if (state.changed) {
			onChange(state);
		}
	});
	onChange(run.state);
};
