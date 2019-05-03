import types from "../types";
import GrammarProgram from "./GrammarProgram";
declare class GrammarBackedCell {
    constructor(word: string, type: string, node: any, index: types.int, isCatchAll: boolean, expectedLinePattern: string, grammarProgram: GrammarProgram);
    private _node;
    private _grammarProgram;
    private _expectedLinePattern;
    private _index;
    private _word;
    private _type;
    private _isCatchAll;
    getType(): string;
    isCatchAll(): boolean;
    getHighlightScope(): string | undefined;
    getAutoCompleteWords(partialWord: string): {
        text: string;
        displayText: string;
    }[];
    getWord(): string;
    getParsed(): any;
    protected _getCellTypeClass(): import("./GrammarCellTypeNode").default;
    protected _getLineNumber(): any;
    getErrorIfAny(): types.ParseError;
}
export default GrammarBackedCell;
