import vscode from "vscode";
import { IChange, documentUtils } from "./utils/document";
import { v4 } from "uuid";
import _ from "lodash";

interface IBreakPoint {
	id: string;
	name: string;
	content: string;
	changes: IChange[];
}
interface IProject {
	initialContent: string;
	breakpoints: IBreakPoint[];
}
export interface IProjectMap {
	[id: string]: IProject;
}

type ThenArg<T> = T extends PromiseLike<infer U> ? U : T;
export type IStorageType = ThenArg<ReturnType<typeof initStorage>>;

export const initStorage = async (context: vscode.ExtensionContext) => {
	const projectsKey = "projects";
	// context.globalState.update(projectsKey, undefined);
	const projectData =
		(context.globalState.get<IProjectMap>(projectsKey) as IProjectMap) ||
		{};
	const changehandlers: any[] = [];
	const onProjectDataChange = () => {
		changehandlers.forEach((func) => func(projectData));
	};
	const saveProjectData = async () => {
		await context.globalState.update(projectsKey, projectData);
	};

	let cache: { [id: string]: any } = {};
	return {
		data: projectData,
		hasProject(projectid: string) {
			return !!projectData[projectid];
		},
		getProjectList() {
			return Object.keys(projectData).map((v) => {
				return {
					isProject: true,
					name: v,
					id: v,
					length: projectData[v].breakpoints.reduce(
						(acc, v) => acc + v.changes.length,
						0
					),
					children: projectData[v].breakpoints.map((v) => {
						return {
							isProject: false,
							name: v.name,
							id: v.id,
							length: v.changes.length,
							children: [],
						};
					}),
				};
			});
		},
		async delProject(ids: string[]) {
			ids.forEach((id) => {
				delete cache[id];
				delete projectData[id];
			});
			await saveProjectData();
			onProjectDataChange();
		},
		project(id: string) {
			if (cache[id]) {
				return cache[id];
			}
			const onchange = _.debounce(
				async (data: IProject) => {
					projectData[id] = data;
					await saveProjectData();
					onProjectDataChange();
				},
				500,
				{ trailing: true }
			);
			cache[id] = new Project(id, projectData, onchange);
			return cache[id];
		},
		onChange(func: (data: IProjectMap) => void) {
			changehandlers.push(func);
		},
	};
};

export type IPlayFrame =
	| {
			type: "BREAKPOINT";
			name: string;
			id: string;
			number: number;
			content: string;
	  }
	| {
			type: "CHANGE";
			change: IChange;
	  };
export class Project {
	data: IProject;
	public projectid: string;
	onChange: (data: IProject) => void;
	constructor(
		projectid: string,
		projectData: IProjectMap,
		onChange: (data: IProject) => void
	) {
		this.projectid = projectid;
		const data = projectData[projectid];

		this.save = _.debounce(this.save, 500, { trailing: true });
		if (data) {
			this.data = data;
			// REHYDRATE DATA.
			this.data.breakpoints = this.data.breakpoints.map((breakpoint) => ({
				...breakpoint,
				changes: breakpoint.changes.map((change) =>
					documentUtils.rehydrate(change)
				),
			}));
			// REHYDRATE DATA DONE.
		} else {
			this.data = {
				initialContent: "",
				breakpoints: [
					{
						id: v4(),
						name: "RECORD START",
						changes: [],
						content: "",
					},
				],
			};
			this.save();
		}
		this.onChange = onChange;
	}
	getPlayData() {
		return {
			initialContent: this.data.initialContent,
			nBreakpoints: this.data.breakpoints.length,
			frames: _.flatMap(
				this.data.breakpoints.map((v, i) => {
					return [
						{
							type: "BREAKPOINT",
							number: i + 1,
							name: v.name,
							id: v.id,
							content: v.content,
						},
						...v.changes.map((v) => ({
							type: "CHANGE",
							change: v,
						})),
					] as IPlayFrame[];
				})
			),
		};
	}
	addBreakPoint = (name: string) => {
		this.data.breakpoints.push({
			id: v4(),
			name,
			content: vscode.window.activeTextEditor.document.getText(),
			changes: [],
		});
		this.save();
	};
	renameBreakPoint = (id: string, name: string) => {
		this.data.breakpoints = this.data.breakpoints.map((v) =>
			id === v.id
				? {
						...v,
						name,
				  }
				: v
		);
	};
	deleteBreakPoint = (id: string) => {
		const { breakpoints } = this.data;
		const index = breakpoints.findIndex((v) => v.id === id);
		if (index >= 0) {
			breakpoints.splice(index, breakpoints.length - index);
		}
	};
	addChange = (change: IChange, interpolate = true) => {
		try {
			const lastBreakPoint = this.data.breakpoints[
				this.data.breakpoints.length - 1
			];
			const { edits, selections } = change;
			if (edits.length === 1 && selections.length === 1 && interpolate) {
				const edit = edits[0];
				const selection = selections[0];
				if (
					edit.text.length > 1 &&
					edit.text.length < 50 &&
					edit.range.isEmpty &&
					selection.isEmpty &&
					edit.range.isSingleLine &&
					selection.isSingleLine &&
					!edit.text.split("").find((v) => v === "\n")
				) {
					// Divide them!
					for (let i = 0; i < edit.text.length; i++) {
						const change: IChange = {
							edits: [
								{
									range: new vscode.Range(
										edit.range.start.translate(0, i),
										edit.range.end.translate(0, i)
									),
									rangeLength: edit.rangeLength,
									rangeOffset: edit.rangeOffset + i,
									text: edit.text[i],
								},
							],
							selections: [
								new vscode.Selection(
									selection.anchor.translate(
										0,
										-edit.text.length + 1 + i
									),
									selection.active.translate(
										0,
										-edit.text.length + 1 + i
									)
								),
							],
						};
						lastBreakPoint.changes.push(change);
					}
				} else {
					lastBreakPoint.changes.push(change);
				}
			} else {
				lastBreakPoint.changes.push(change);
			}
			this.save();
		} catch (e) {
			console.error("ERROR: ", e);
		}
	};
	save = () => {
		this.onChange(this.data);
	};
	getData = () => {
		return this.data;
	};
}
