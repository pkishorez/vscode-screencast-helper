import vscode from "vscode";
import { IChange } from "./utils/document";
import { v4 } from "uuid";
import _ from "lodash";

interface IBreakPoint {
	id: string;
	name: string;
	changes: IChange[];
}
interface IProject {
	initialContent: string;
	breakpoints: IBreakPoint[];
}
export interface IProjectMap {
	[id: string]: IProject;
}
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
		async delProject(id: string) {
			delete projectData[id];
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
		} else {
			this.data = {
				initialContent: "",
				breakpoints: [{ id: v4(), name: "RECORD START", changes: [] }],
			};
			this.save();
		}
		this.onChange = onChange;
	}
	getPlayData() {
		return {
			initialContent: this.data.initialContent,
			frames: _.flatMap(
				this.data.breakpoints.map((v) => {
					const changes = v.changes.map(
						(v) =>
							({
								type: "CHANGE",
								change: v,
							} as {
								type: "CHANGE";
								change: IChange;
							})
					);
					return [
						{ type: "BREAKPOINT", name: v.name, id: v.id } as {
							type: "BREAKPOINT";
							name: string;
							id: string;
						},
						...changes,
					];
				})
			),
		};
	}
	addBreakPoint = (name: string) => {
		this.data.breakpoints.push({
			id: v4(),
			name,
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
	addChange = (change: IChange) => {
		try {
			console.log("CHANGE : ", change, this.data);
			const lastBreakPoint = this.data.breakpoints[
				this.data.breakpoints.length - 1
			];
			lastBreakPoint.changes.push(change);
			console.log("PROJECT: ", this.data);
			this.save();
		} catch (e) {
			console.log("ERROR: ", e);
		}
	};
	save = () => {
		this.onChange(this.data);
	};
	getData = () => {
		return this.data;
	};
}
