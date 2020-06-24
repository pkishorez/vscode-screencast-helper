import vscode from "vscode";

type SerializedPosition = {
	line: number;
	character: number;
};

type SerializedRange = SerializedPosition[];

interface SerializedChangeEvent {
	range: SerializedRange;
	rangeOffset: number;
	rangeLength: number;
	text: string;
}

interface SerializedSelection {
	start: SerializedPosition;
	end: SerializedPosition;
	active: SerializedPosition;
	anchor: SerializedPosition;
}

function rehydratePosition(serialized: SerializedPosition): vscode.Position {
	return new vscode.Position(serialized.line, serialized.character);
}

function rehydrateRange([start, stop]: SerializedRange): vscode.Range {
	return new vscode.Range(rehydratePosition(start), rehydratePosition(stop));
}

export function rehydrateSelection(
	serialized: SerializedSelection
): vscode.Selection {
	return new vscode.Selection(
		rehydratePosition(serialized.anchor),
		rehydratePosition(serialized.active)
	);
}

export function rehydrateChangeEvent(
	serialized: SerializedChangeEvent
): vscode.TextDocumentContentChangeEvent {
	return {
		...serialized,
		range: rehydrateRange(serialized.range),
	};
}
