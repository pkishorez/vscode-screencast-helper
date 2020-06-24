import * as vscode from "vscode";
import { rehydrateChangeEvent, rehydrateSelection } from "./rehydrate";

export interface IChange {
	edits: vscode.TextDocumentContentChangeEvent[];
	selections: vscode.Selection[];
}
(Object as any).deepExtend = function testFunction(
	destination: any,
	source: any
) {
	for (var property in source) {
		if (
			source[property] &&
			source[property].constructor &&
			source[property].constructor === Object
		) {
			destination[property] = destination[property] || {};
			testFunction(destination[property], source[property]);
		} else {
			destination[property] = source[property];
		}
	}
	return destination;
};
export const document = (editor: vscode.TextEditor) => {
	const obj = {
		clear() {
			editor.edit((builder) => {
				builder.delete(
					new vscode.Range(
						new vscode.Position(0, 0),
						new vscode.Position(Number.MAX_VALUE, Number.MAX_VALUE)
					)
				);
			});
		},
		rehydrate(change: IChange): IChange {
			return {
				edits: change.edits.map((v) => rehydrateChangeEvent(v as any)),
				selections: change.selections.map((v) => rehydrateSelection(v)),
			};
		},
		setText(text: string) {
			editor.edit((builder) => {
				obj.clear();
				builder.insert(new vscode.Position(0, 0), text);
			});
		},
		focus() {
			vscode.commands.executeCommand(
				"workbench.action.focusActiveEditorGroup"
			);
		},
		async _applyEdits(edits: IChange["edits"]) {
			edits.length &&
				(await editor.edit((builder) => {
					for (const edit of edits) {
						if (edit.text === "") {
							builder.delete(edit.range);
						} else if (edit.rangeLength === 0) {
							builder.insert(edit.range.start, edit.text);
						} else {
							builder.replace(edit.range, edit.text);
						}
					}
				}));
		},
		_applySelections(selections: IChange["selections"]) {
			// reveal if required.
			selections.length &&
				editor.revealRange(
					new vscode.Range(selections[0].start, selections[0].end)
				);
			editor.selections = selections;
		},
		async applyChange(change: IChange, focus = true) {
			focus && obj.focus();
			try {
				await obj._applyEdits(change.edits);
			} catch (err) {
				console.log("ERROR :", err.message);
			}

			try {
				obj._applySelections(change.selections);
			} catch (err) {
				console.error(
					"ERROR: APPLYCHANGE",
					JSON.stringify(change.selections, null, "  "),
					err
				);
			}
		},
	};
	return obj;
};
