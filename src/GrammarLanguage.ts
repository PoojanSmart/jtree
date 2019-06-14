import TreeNode from "./base/TreeNode"
import TreeUtils from "./base/TreeUtils"
import jTreeTypes from "./jTreeTypes"

interface AbstractRuntimeProgramConstructorInterface {
  new (code: string): AbstractRuntimeProgramRootNode
}

enum GrammarConstantsCompiler {
  sub = "sub", // replacement instructions
  indentCharacter = "indentCharacter",
  listDelimiter = "listDelimiter",
  openChildren = "openChildren",
  closeChildren = "closeChildren"
}

enum GrammarStandardCellTypeIds {
  any = "any",
  anyFirstWord = "anyFirstWord", // todo: remove
  extraWord = "extraWord",
  float = "float",
  number = "number",
  bit = "bit",
  bool = "bool",
  int = "int"
}

enum GrammarConstantsConstantTypes {
  boolean = "boolean",
  string = "string",
  int = "int",
  float = "float"
}

enum GrammarConstants {
  // node types
  grammar = "grammar",
  extensions = "extensions",
  toolingDirective = "tooling",
  version = "version",
  name = "name",
  nodeTypeOrder = "nodeTypeOrder",
  nodeType = "nodeType",
  cellType = "cellType",
  abstract = "abstract",

  // error check time
  regex = "regex", // temporary?
  enumFromGrammar = "enumFromGrammar", // temporary?
  enum = "enum", // temporary?

  // baseNodeTypes
  baseNodeType = "baseNodeType",
  blobNode = "blobNode",
  errorNode = "errorNode",
  terminalNode = "terminalNode",
  nonTerminalNode = "nonTerminalNode",

  // parse time
  inScope = "inScope",
  cells = "cells",
  catchAllCellType = "catchAllCellType",
  firstCellType = "firstCellType",
  catchAllNodeType = "catchAllNodeType",
  defaults = "defaults",
  constants = "constants",
  group = "group",
  required = "required", // Require this nodeType to be present in a node or program
  single = "single", // Have at most 1 of these
  tags = "tags",

  // code
  javascript = "javascript",

  // parse and interpret time
  constructors = "constructors",
  constructorNodeJs = "nodejs",
  constructorBrowser = "browser", // for browser

  // compile time
  compilerNodeType = "compiler",

  // develop time
  description = "description",
  example = "example",
  frequency = "frequency",
  highlightScope = "highlightScope"
}

abstract class GrammarBackedNode extends TreeNode {
  abstract getDefinition(): AbstractGrammarDefinitionNode

  getAutocompleteResults(partialWord: string, cellIndex: jTreeTypes.positiveInt) {
    return cellIndex === 0 ? this._getAutocompleteResultsForFirstWord(partialWord) : this._getAutocompleteResultsForCell(partialWord, cellIndex)
  }

  private _getAutocompleteResultsForFirstWord(partialWord: string) {
    let defs: NonRootNodeTypeDefinition[] = Object.values(this.getDefinition().getRunTimeFirstWordMapWithDefinitions())

    if (partialWord) defs = defs.filter(def => def.getNodeTypeIdFromDefinition().includes(partialWord))

    return defs.map(def => {
      const id = def.getNodeTypeIdFromDefinition()
      const description = def.getDescription()
      return {
        text: id,
        displayText: id + (description ? " " + description : "")
      }
    })
  }

  private _getAutocompleteResultsForCell(partialWord: string, cellIndex: jTreeTypes.positiveInt) {
    // todo: root should be [] correct?
    const cell = this._getGrammarBackedCellArray()[cellIndex]
    return cell ? cell.getAutoCompleteWords(partialWord) : []
  }

  // note: this is overwritten by the root node of a runtime grammar program.
  // some of the magic that makes this all work. but maybe there's a better way.
  getGrammarProgram(): GrammarProgram {
    return this.getProgram().getGrammarProgram()
  }

  getFirstWordMap() {
    return this.getDefinition().getRunTimeFirstWordMap()
  }

  getCatchAllNodeConstructor(line: string) {
    return this.getDefinition().getRunTimeCatchAllNodeConstructor()
  }

  // todo: rename to something better?
  getProgram(): GrammarBackedNode {
    return this
  }

  protected _getGrammarBackedCellArray(): AbstractGrammarBackedCell<any>[] {
    return []
  }

  getRunTimeEnumOptions(cell: AbstractGrammarBackedCell<any>): string[] {
    return undefined
  }

  protected _getNodeTypeDefinitionByFirstWordPath(path: string) {
    // todo: do we need a relative to with this firstWord path?
    return this.getProgram()
      .getGrammarProgram()
      .getNodeTypeDefinitionByFirstWordPath(path)
  }

  protected _getRequiredNodeErrors(errors: jTreeTypes.TreeError[] = []) {
    const firstWords = this.getDefinition().getRunTimeFirstWordMapWithDefinitions()
    Object.keys(firstWords).forEach(firstWord => {
      const def = firstWords[firstWord]
      if (def.isRequired() && !this.has(firstWord)) errors.push(new MissingRequiredNodeTypeError(this, firstWord))
    })
    return errors
  }
}

abstract class GrammarBackedRootNode extends GrammarBackedNode {}
abstract class GrammarBackedNonRootNode extends GrammarBackedNode {}

abstract class CompiledLanguageNonRootNode extends GrammarBackedNonRootNode {}
abstract class CompiledLanguageRootNode extends GrammarBackedRootNode {}

abstract class AbstractRuntimeNonRootNode extends GrammarBackedNonRootNode {
  getProgram() {
    return (<AbstractRuntimeProgramRootNode>this.getParent()).getProgram()
  }

  getGrammarProgram() {
    return this.getDefinition().getProgram()
  }

  getNodeTypeId(): jTreeTypes.nodeTypeId {
    return this.getDefinition().getNodeTypeIdFromDefinition()
  }

  getDefinition(): NonRootNodeTypeDefinition {
    // todo: do we need a relative to with this firstWord path?
    return <NonRootNodeTypeDefinition>this._getNodeTypeDefinitionByFirstWordPath(this.getFirstWordPath())
  }

  protected _getCompilerNode(targetLanguage: jTreeTypes.targetLanguageId): GrammarCompilerNode {
    return this.getDefinition().getDefinitionCompilerNode(targetLanguage, this)
  }

  protected _getCompiledIndentation(targetLanguage: jTreeTypes.targetLanguageId) {
    const compiler = this._getCompilerNode(targetLanguage)
    const indentCharacter = compiler.getIndentCharacter()
    const indent = this.getIndentation()
    return indentCharacter !== undefined ? indentCharacter.repeat(indent.length) : indent
  }

  protected _getCompiledLine(targetLanguage: jTreeTypes.targetLanguageId) {
    const compiler = this._getCompilerNode(targetLanguage)
    const listDelimiter = compiler.getListDelimiter()
    const str = compiler.getTransformation()
    return str ? TreeUtils.formatStr(str, listDelimiter, this.cells) : this.getLine()
  }

  compile(targetLanguage: jTreeTypes.targetLanguageId) {
    return this._getCompiledIndentation(targetLanguage) + this._getCompiledLine(targetLanguage)
  }

  getErrors() {
    const errors = this._getGrammarBackedCellArray()
      .map(check => check.getErrorIfAny())
      .filter(i => i)

    const firstWord = this.getFirstWord()
    if (this.getDefinition().has(GrammarConstants.single))
      this.getParent()
        .findNodes(firstWord)
        .forEach((node, index) => {
          if (index) errors.push(new NodeTypeUsedMultipleTimesError(node))
        })

    return this._getRequiredNodeErrors(errors)
  }

  // todo: improve layout (use bold?)
  getLineHints(): string {
    const def = this.getDefinition()
    const catchAllCellTypeId = def.getCatchAllCellTypeId()
    return `${this.getNodeTypeId()}: ${def.getRequiredCellTypeIds().join(" ")}${catchAllCellTypeId ? ` ${catchAllCellTypeId}...` : ""}`
  }

  // todo: remove?
  getParsedWords() {
    return this._getGrammarBackedCellArray().map(word => word.getParsed())
  }

  get cells() {
    const cells: jTreeTypes.stringMap = {}
    this._getGrammarBackedCellArray()
      .slice(1)
      .forEach(cell => {
        if (!cell.isCatchAll()) cells[cell.getCellTypeId()] = cell.getParsed()
        else {
          if (!cells[cell.getCellTypeId()]) cells[cell.getCellTypeId()] = []
          cells[cell.getCellTypeId()].push(cell.getParsed())
        }
      })
    return cells
  }

  protected _getGrammarBackedCellArray(): AbstractGrammarBackedCell<any>[] {
    const definition = this.getDefinition()
    const grammarProgram = definition.getProgram()
    const requiredCellTypeIds = definition.getRequiredCellTypeIds()
    const firstCellTypeId = definition.getFirstCellTypeId()
    const numberOfRequiredCells = requiredCellTypeIds.length + 1 // todo: assuming here first cell is required.

    const catchAllCellTypeId = definition.getCatchAllCellTypeId()

    const actualWordCountOrRequiredCellCount = Math.max(this.getWords().length, numberOfRequiredCells)
    const cells: AbstractGrammarBackedCell<any>[] = []

    // A for loop instead of map because "numberOfCellsToFill" can be longer than words.length
    for (let cellIndex = 0; cellIndex < actualWordCountOrRequiredCellCount; cellIndex++) {
      const isCatchAll = cellIndex >= numberOfRequiredCells

      let cellTypeId
      if (cellIndex === 0) cellTypeId = firstCellTypeId
      else if (isCatchAll) cellTypeId = catchAllCellTypeId
      else cellTypeId = requiredCellTypeIds[cellIndex - 1]

      let cellTypeDefinition = grammarProgram.getCellTypeDefinitionById(cellTypeId)

      let cellConstructor
      if (cellTypeDefinition) cellConstructor = cellTypeDefinition.getCellConstructor()
      else if (cellTypeId) cellConstructor = GrammarUnknownCellTypeCell
      else {
        cellConstructor = GrammarExtraWordCellTypeCell
        cellTypeId = GrammarStandardCellTypeIds.extraWord
        cellTypeDefinition = grammarProgram.getCellTypeDefinitionById(cellTypeId)
      }

      cells[cellIndex] = new cellConstructor(this, cellIndex, cellTypeDefinition, cellTypeId, isCatchAll)
    }
    return cells
  }

  // todo: just make a fn that computes proper spacing and then is given a node to print
  getLineCellTypes() {
    return this._getGrammarBackedCellArray()
      .map(slot => slot.getCellTypeId())
      .join(" ")
  }

  getLineHighlightScopes(defaultScope = "source") {
    return this._getGrammarBackedCellArray()
      .map(slot => slot.getHighlightScope() || defaultScope)
      .join(" ")
  }
}

abstract class AbstractRuntimeProgramRootNode extends GrammarBackedRootNode {
  getAllErrors(): jTreeTypes.TreeError[] {
    return this._getRequiredNodeErrors(super.getAllErrors())
  }

  // Helper method for selecting potential nodeTypes needed to update grammar file.
  getInvalidNodeTypes() {
    return Array.from(
      new Set(
        this.getAllErrors()
          .filter(err => err instanceof UnknownNodeTypeError)
          .map(err => err.getNode().getFirstWord())
      )
    )
  }

  updateNodeTypeIds(nodeTypeMap: TreeNode | string | jTreeTypes.nodeIdRenameMap) {
    if (typeof nodeTypeMap === "string") nodeTypeMap = new TreeNode(nodeTypeMap)
    if (nodeTypeMap instanceof TreeNode) nodeTypeMap = <jTreeTypes.nodeIdRenameMap>nodeTypeMap.toObject()
    const renames = []
    for (let node of this.getTopDownArrayIterator()) {
      const nodeTypeId = (<AbstractRuntimeNonRootNode>node).getNodeTypeId()
      const newId = nodeTypeMap[nodeTypeId]
      if (newId) renames.push([node, newId])
    }
    renames.forEach(pair => pair[0].setFirstWord(pair[1]))
    return this
  }

  getAllSuggestions() {
    return new TreeNode(
      this.getAllWordBoundaryCoordinates().map(coordinate => {
        const results = this.getAutocompleteResultsAt(coordinate.y, coordinate.x)
        return {
          line: coordinate.y,
          char: coordinate.x,
          word: results.word,
          suggestions: results.matches.map(m => m.text).join(" ")
        }
      })
    ).toTable()
  }

  getAutocompleteResultsAt(lineIndex: jTreeTypes.positiveInt, charIndex: jTreeTypes.positiveInt) {
    const lineNode = this.nodeAtLine(lineIndex) || this
    const nodeInScope = <GrammarBackedNode>lineNode.getNodeInScopeAtCharIndex(charIndex)

    // todo: add more tests
    // todo: second param this.childrenToString()
    // todo: change to getAutocomplete definitions

    const wordIndex = lineNode.getWordIndexAtCharacterIndex(charIndex)
    const wordProperties = lineNode.getWordProperties(wordIndex)
    return {
      startCharIndex: wordProperties.startCharIndex,
      endCharIndex: wordProperties.endCharIndex,
      word: wordProperties.word,
      matches: nodeInScope.getAutocompleteResults(wordProperties.word, wordIndex)
    }
  }

  getPrettified() {
    const nodeTypeOrder = this.getGrammarProgram().getNodeTypeOrder()
    const clone = this.clone()
    const isCondensed = this.getGrammarProgram().getGrammarName() === "grammar" // todo: generalize?
    clone._firstWordSort(nodeTypeOrder.split(" "), isCondensed ? TreeUtils.makeGraphSortFunction(1, 2) : undefined)

    return clone.toString()
  }

  getProgramErrorMessages() {
    return this.getAllErrors().map(err => err.getMessage())
  }

  getDefinition(): GrammarProgram {
    return this.getGrammarProgram()
  }

  getNodeTypeUsage(filepath = "") {
    // returns a report on what nodeTypes from its language the program uses
    const usage = new TreeNode()
    const grammarProgram = this.getGrammarProgram()
    grammarProgram.getNodeTypeDefinitions().forEach(def => {
      usage.appendLine([def.getNodeTypeIdFromDefinition(), "line-id", GrammarConstants.nodeType, def.getRequiredCellTypeIds().join(" ")].join(" "))
    })
    this.getTopDownArray().forEach((node, lineNumber) => {
      const stats = <TreeNode>usage.getNode(node.getNodeTypeId())
      stats.appendLine([filepath + "-" + lineNumber, node.getWords().join(" ")].join(" "))
    })
    return usage
  }

  getInPlaceCellTypeTree() {
    return this.getTopDownArray()
      .map(child => child.getIndentation() + child.getLineCellTypes())
      .join("\n")
  }

  getInPlaceHighlightScopeTree() {
    return this.getTopDownArray()
      .map(child => child.getIndentation() + child.getLineHighlightScopes())
      .join("\n")
  }

  getInPlaceCellTypeTreeWithNodeConstructorNames() {
    return this.getTopDownArray()
      .map(child => child.constructor.name + this.getZI() + child.getIndentation() + child.getLineCellTypes())
      .join("\n")
  }

  // todo: refine and make public
  protected _getInPlaceCellTypeTreeHtml() {
    const getColor = (child: GrammarBackedNode) => {
      if (child.getLineCellTypes().includes("error")) return "red"
      return "black"
    }
    const zip = (a1: string[], a2: string[]) => {
      let last = a1.length > a2.length ? a1.length : a2.length
      let parts = []
      for (let index = 0; index < last; index++) {
        parts.push(`${a1[index]}:${a2[index]}`)
      }
      return parts.join(" ")
    }
    return this.getTopDownArray()
      .map(
        child =>
          `<div style="white-space: pre;">${child.constructor.name} ${this.getZI()} ${child.getIndentation()} <span style="color: ${getColor(child)};">${zip(
            child.getLineCellTypes().split(" "),
            child.getLine().split(" ")
          )}</span></div>`
      )
      .join("")
  }

  getTreeWithNodeTypes() {
    return this.getTopDownArray()
      .map(child => child.constructor.name + this.getZI() + child.getIndentation() + child.getLine())
      .join("\n")
  }

  getCellHighlightScopeAtPosition(lineIndex: number, wordIndex: number): jTreeTypes.highlightScope | undefined {
    this._initCellTypeCache()
    const typeNode = this._cache_highlightScopeTree.getTopDownArray()[lineIndex - 1]
    return typeNode ? typeNode.getWord(wordIndex - 1) : undefined
  }

  private _cache_programCellTypeStringMTime: number
  private _cache_highlightScopeTree: TreeNode
  private _cache_typeTree: TreeNode

  protected _initCellTypeCache(): void {
    const treeMTime = this.getTreeMTime()
    if (this._cache_programCellTypeStringMTime === treeMTime) return undefined

    this._cache_typeTree = new TreeNode(this.getInPlaceCellTypeTree())
    this._cache_highlightScopeTree = new TreeNode(this.getInPlaceHighlightScopeTree())
    this._cache_programCellTypeStringMTime = treeMTime
  }
}

class GrammarBackedTerminalNode extends AbstractRuntimeNonRootNode {}

class GrammarBackedErrorNode extends AbstractRuntimeNonRootNode {
  // todo: is this correct?
  getLineCellTypes() {
    return "error ".repeat(this.getWords().length).trim()
  }

  getErrors(): UnknownNodeTypeError[] {
    return [this.getFirstWord() ? new UnknownNodeTypeError(this) : new BlankLineError(this)]
  }
}

class GrammarBackedNonTerminalNode extends AbstractRuntimeNonRootNode {
  // todo: implement
  protected _getNodeJoinCharacter() {
    return "\n"
  }

  compile(targetExtension: jTreeTypes.targetLanguageId) {
    const compiler = this._getCompilerNode(targetExtension)
    const openChildrenString = compiler.getOpenChildrenString()
    const closeChildrenString = compiler.getCloseChildrenString()

    const compiledLine = this._getCompiledLine(targetExtension)
    const indent = this._getCompiledIndentation(targetExtension)

    const compiledChildren = this.map(child => child.compile(targetExtension)).join(this._getNodeJoinCharacter())

    return `${indent}${compiledLine}${openChildrenString}
${compiledChildren}
${indent}${closeChildrenString}`
  }

  private static _backupConstructorEnabled = false

  public static useAsBackupConstructor() {
    return GrammarBackedNonTerminalNode._backupConstructorEnabled
  }

  public static setAsBackupConstructor(value: boolean) {
    GrammarBackedNonTerminalNode._backupConstructorEnabled = value
    return GrammarBackedNonTerminalNode
  }
}

class GrammarBackedBlobNode extends AbstractRuntimeNonRootNode {
  getFirstWordMap() {
    return {}
  }

  getErrors(): jTreeTypes.TreeError[] {
    return []
  }

  getCatchAllNodeConstructor(line: string) {
    return GrammarBackedBlobNode
  }
}

/*
A cell contains a word but also the type information for that word.
*/
abstract class AbstractGrammarBackedCell<T> {
  constructor(node: AbstractRuntimeNonRootNode, index: jTreeTypes.int, typeDef: GrammarCellTypeDefinitionNode, cellTypeId: string, isCatchAll: boolean) {
    this._typeDef = typeDef
    this._node = node
    this._isCatchAll = isCatchAll
    this._index = index
    this._cellTypeId = cellTypeId

    this._word = node.getWord(index)
  }

  private _node: any
  protected _index: jTreeTypes.int
  protected _word: string
  private _typeDef: GrammarCellTypeDefinitionNode
  private _isCatchAll: boolean
  private _cellTypeId: string

  getCellTypeId() {
    return this._cellTypeId
  }

  static parserFunctionName = ""

  getNode() {
    return this._node
  }

  getCellIndex() {
    return this._index
  }

  private _getProgram() {
    return <AbstractRuntimeProgramRootNode>this.getNode().getProgram()
  }

  isCatchAll() {
    return this._isCatchAll
  }

  abstract getParsed(): T

  getHighlightScope(): string | undefined {
    const definition = this._getCellTypeDefinition()
    if (definition) return definition.getHighlightScope()
  }

  getAutoCompleteWords(partialWord: string = "") {
    const definition = this._getCellTypeDefinition()
    let words = definition ? definition.getAutocompleteWordOptions(this._getProgram()) : []

    const runTimeOptions = this.getNode().getRunTimeEnumOptions(this)
    if (runTimeOptions) words = runTimeOptions.concat(words)

    if (partialWord) words = words.filter(word => word.includes(partialWord))
    return words.map(word => {
      return {
        text: word,
        displayText: word
      }
    })
  }

  getWord() {
    return this._word
  }

  protected _getCellTypeDefinition() {
    return this._typeDef
  }

  protected _getLineNumber() {
    return this.getNode().getPoint().y
  }

  protected _getFullLine() {
    return this.getNode().getLine()
  }

  protected _getErrorContext() {
    return this._getFullLine().split(" ")[0] // todo: XI
  }

  protected abstract _isValid(): boolean

  isValid(): boolean {
    const runTimeOptions = this.getNode().getRunTimeEnumOptions(this)
    if (runTimeOptions) return runTimeOptions.includes(this._word)
    return this._getCellTypeDefinition().isValid(this._word, this._getProgram()) && this._isValid()
  }

  getErrorIfAny(): jTreeTypes.TreeError {
    if (this._word !== undefined && this.isValid()) return undefined

    return this._word === undefined ? new MissingWordError(this) : new InvalidWordError(this)
  }
}

class GrammarIntCell extends AbstractGrammarBackedCell<number> {
  _isValid() {
    const num = parseInt(this._word)
    if (isNaN(num)) return false
    return num.toString() === this._word
  }

  getRegexString() {
    return "\-?[0-9]+"
  }

  getParsed() {
    return parseInt(this._word)
  }

  static parserFunctionName = "parseInt"
}

class GrammarBitCell extends AbstractGrammarBackedCell<boolean> {
  _isValid() {
    const str = this._word
    return str === "0" || str === "1"
  }

  getRegexString() {
    return "[01]"
  }

  getParsed() {
    return !!parseInt(this._word)
  }
}

class GrammarFloatCell extends AbstractGrammarBackedCell<number> {
  _isValid() {
    const num = parseFloat(this._word)
    return !isNaN(num) && /^-?\d*(\.\d+)?$/.test(this._word)
  }

  getRegexString() {
    return "-?\d*(\.\d+)?"
  }

  getParsed() {
    return parseFloat(this._word)
  }

  static parserFunctionName = "parseFloat"
}

// ErrorCellType => grammar asks for a '' cell type here but the grammar does not specify a '' cell type. (todo: bring in didyoumean?)

class GrammarBoolCell extends AbstractGrammarBackedCell<boolean> {
  private _trues = new Set(["1", "true", "t", "yes"])
  private _falses = new Set(["0", "false", "f", "no"])

  _isValid() {
    const str = this._word.toLowerCase()
    return this._trues.has(str) || this._falses.has(str)
  }

  private _getOptions() {
    return Array.from(this._trues).concat(Array.from(this._falses))
  }

  getRegexString() {
    return "(?:" + this._getOptions().join("|") + ")"
  }

  getParsed() {
    return this._trues.has(this._word.toLowerCase())
  }
}

class GrammarAnyCell extends AbstractGrammarBackedCell<string> {
  _isValid() {
    return true
  }

  getRegexString() {
    return "[^ ]+"
  }

  getParsed() {
    return this._word
  }
}

class GrammarExtraWordCellTypeCell extends AbstractGrammarBackedCell<string> {
  _isValid() {
    return false
  }

  getParsed() {
    return this._word
  }

  getErrorIfAny(): jTreeTypes.TreeError {
    return new ExtraWordError(this)
  }
}

class GrammarUnknownCellTypeCell extends AbstractGrammarBackedCell<string> {
  _isValid() {
    return false
  }

  getParsed() {
    return this._word
  }

  getErrorIfAny(): jTreeTypes.TreeError {
    return new UnknownCellTypeError(this)
  }
}

abstract class AbstractTreeError implements jTreeTypes.TreeError {
  constructor(node: GrammarBackedNode | TreeNode) {
    this._node = node
  }
  private _node: GrammarBackedNode | TreeNode

  getLineIndex(): jTreeTypes.positiveInt {
    return this.getLineNumber() - 1
  }

  getLineNumber(): jTreeTypes.positiveInt {
    return this.getNode().getPoint().y
  }

  isCursorOnWord(lineIndex: jTreeTypes.positiveInt, characterIndex: jTreeTypes.positiveInt) {
    return lineIndex === this.getLineIndex() && this._doesCharacterIndexFallOnWord(characterIndex)
  }

  private _doesCharacterIndexFallOnWord(characterIndex: jTreeTypes.positiveInt) {
    return this.getCellIndex() === this.getNode().getWordIndexAtCharacterIndex(characterIndex)
  }

  // convenience method. may be removed.
  isBlankLineError() {
    return false
  }

  // convenience method. may be removed.
  isMissingWordError() {
    return false
  }

  getIndent() {
    return this.getNode().getIndentation()
  }

  getCodeMirrorLineWidgetElement(onApplySuggestionCallBack = () => {}) {
    const suggestion = this.getSuggestionMessage()
    if (this.isMissingWordError()) return this._getCodeMirrorLineWidgetElementCellTypeHints()
    if (suggestion) return this._getCodeMirrorLineWidgetElementWithSuggestion(onApplySuggestionCallBack, suggestion)
    return this._getCodeMirrorLineWidgetElementWithoutSuggestion()
  }

  private _getCodeMirrorLineWidgetElementCellTypeHints() {
    const el = document.createElement("div")
    el.appendChild(document.createTextNode(this.getIndent() + (<AbstractRuntimeNonRootNode>this.getNode()).getLineHints()))
    el.className = "LintCellTypeHints"
    return el
  }

  private _getCodeMirrorLineWidgetElementWithoutSuggestion() {
    const el = document.createElement("div")
    el.appendChild(document.createTextNode(this.getIndent() + this.getMessage()))
    el.className = "LintError"
    return el
  }

  private _getCodeMirrorLineWidgetElementWithSuggestion(onApplySuggestionCallBack: Function, suggestion: string) {
    const el = document.createElement("div")
    el.appendChild(document.createTextNode(this.getIndent() + `${this.getErrorTypeName()}. Suggestion: ${suggestion}`))
    el.className = "LintErrorWithSuggestion"
    el.onclick = () => {
      this.applySuggestion()
      onApplySuggestionCallBack()
    }
    return el
  }

  getLine() {
    return this.getNode().getLine()
  }

  getExtension() {
    return (<GrammarBackedNode>this.getNode()).getGrammarProgram().getExtensionName()
  }

  getNode() {
    return this._node
  }

  getErrorTypeName() {
    return this.constructor.name.replace("Error", "")
  }

  getCellIndex() {
    return 0
  }

  toObject() {
    return {
      type: this.getErrorTypeName(),
      line: this.getLineNumber(),
      cell: this.getCellIndex(),
      suggestion: this.getSuggestionMessage(),
      path: this.getNode().getFirstWordPath(),
      message: this.getMessage()
    }
  }

  hasSuggestion() {
    return this.getSuggestionMessage() !== ""
  }

  getSuggestionMessage() {
    return ""
  }

  applySuggestion() {}

  getMessage(): string {
    return `${this.getErrorTypeName()} at line ${this.getLineNumber()} cell ${this.getCellIndex()}.`
  }
}

abstract class AbstractCellError extends AbstractTreeError {
  constructor(cell: AbstractGrammarBackedCell<any>) {
    super(cell.getNode())
    this._cell = cell
  }

  getCell() {
    return this._cell
  }

  getCellIndex() {
    return this._cell.getCellIndex()
  }

  protected _getWordSuggestion() {
    return TreeUtils.didYouMean(
      this.getCell().getWord(),
      this.getCell()
        .getAutoCompleteWords()
        .map(option => option.text)
    )
  }

  private _cell: AbstractGrammarBackedCell<any>
}

class UnknownNodeTypeError extends AbstractTreeError {
  getMessage(): string {
    return super.getMessage() + ` Invalid nodeType "${this.getNode().getFirstWord()}".`
  }

  protected _getWordSuggestion() {
    const node = this.getNode()
    const parentNode = node.getParent()
    return TreeUtils.didYouMean(node.getFirstWord(), (<GrammarBackedNode>parentNode).getAutocompleteResults("", 0).map(option => option.text))
  }

  getSuggestionMessage() {
    const suggestion = this._getWordSuggestion()
    const node = this.getNode()

    if (suggestion) return `Change "${node.getFirstWord()}" to "${suggestion}"`

    return ""
  }

  applySuggestion() {
    const suggestion = this._getWordSuggestion()
    if (suggestion) this.getNode().setWord(this.getCellIndex(), suggestion)
    return this
  }
}

class BlankLineError extends UnknownNodeTypeError {
  getMessage(): string {
    return super.getMessage() + ` Blank lines are errors.`
  }

  // convenience method
  isBlankLineError() {
    return true
  }

  getSuggestionMessage() {
    return `Delete line ${this.getLineNumber()}`
  }

  applySuggestion() {
    this.getNode().destroy()
    return this
  }
}

class InvalidConstructorPathError extends AbstractTreeError {
  getMessage(): string {
    return super.getMessage() + ` No constructor "${this.getLine()}" found. Language grammar "${this.getExtension()}" may need to be fixed.`
  }
}

class MissingRequiredNodeTypeError extends AbstractTreeError {
  constructor(node: GrammarBackedNode | TreeNode, missingWord: jTreeTypes.firstWord) {
    super(node)
    this._missingWord = missingWord
  }

  getMessage(): string {
    return super.getMessage() + ` Missing "${this._missingWord}" found.`
  }

  getSuggestionMessage() {
    return `Insert "${this._missingWord}" on line ${this.getLineNumber() + 1}`
  }

  applySuggestion() {
    return this.getNode().prependLine(this._missingWord)
  }

  private _missingWord: string
}

class NodeTypeUsedMultipleTimesError extends AbstractTreeError {
  getMessage(): string {
    return super.getMessage() + ` Multiple "${this.getNode().getFirstWord()}" found.`
  }

  getSuggestionMessage() {
    return `Delete line ${this.getLineNumber()}`
  }

  applySuggestion() {
    return this.getNode().destroy()
  }
}

class UnknownCellTypeError extends AbstractCellError {
  getMessage(): string {
    return super.getMessage() + ` No cellType "${this.getCell().getCellTypeId()}" found. Language grammar for "${this.getExtension()}" may need to be fixed.`
  }
}

class InvalidWordError extends AbstractCellError {
  getMessage(): string {
    return super.getMessage() + ` "${this.getCell().getWord()}" does not fit in cellType "${this.getCell().getCellTypeId()}".`
  }

  getSuggestionMessage() {
    const suggestion = this._getWordSuggestion()

    if (suggestion) return `Change "${this.getCell().getWord()}" to "${suggestion}"`

    return ""
  }

  applySuggestion() {
    const suggestion = this._getWordSuggestion()
    if (suggestion) this.getNode().setWord(this.getCellIndex(), suggestion)
    return this
  }
}

class ExtraWordError extends AbstractCellError {
  getMessage(): string {
    return super.getMessage() + ` Extra word "${this.getCell().getWord()}".`
  }

  getSuggestionMessage() {
    return `Delete word "${this.getCell().getWord()}" at cell ${this.getCellIndex()}`
  }

  applySuggestion() {
    return this.getNode().deleteWordAt(this.getCellIndex())
  }
}

class MissingWordError extends AbstractCellError {
  // todo: autocomplete suggestion

  getMessage(): string {
    return super.getMessage() + ` Missing word for cell "${this.getCell().getCellTypeId()}".`
  }

  isMissingWordError() {
    return true
  }
}

// todo: add standard types, enum types, from disk types

abstract class AbstractGrammarWordTestNode extends TreeNode {
  abstract isValid(str: string, program?: any): boolean
}

class GrammarRegexTestNode extends AbstractGrammarWordTestNode {
  private _regex: RegExp

  isValid(str: string) {
    if (!this._regex) this._regex = new RegExp("^" + this.getContent() + "$")
    return !!str.match(this._regex)
  }
}

// todo: remove in favor of custom word type constructors
class EnumFromGrammarTestNode extends AbstractGrammarWordTestNode {
  _getEnumFromGrammar(runTimeGrammarBackedProgram: AbstractRuntimeProgramRootNode): jTreeTypes.stringMap {
    const nodeTypes = this.getWordsFrom(1)
    const enumGroup = nodeTypes.join(" ")
    // note: hack where we store it on the program. otherwise has global effects.
    if (!(<any>runTimeGrammarBackedProgram)._enumMaps) (<any>runTimeGrammarBackedProgram)._enumMaps = {}
    if ((<any>runTimeGrammarBackedProgram)._enumMaps[enumGroup]) return (<any>runTimeGrammarBackedProgram)._enumMaps[enumGroup]

    const wordIndex = 1
    const map: jTreeTypes.stringMap = {}
    runTimeGrammarBackedProgram.findNodes(nodeTypes).forEach(node => {
      map[node.getWord(wordIndex)] = true
    })
    ;(<any>runTimeGrammarBackedProgram)._enumMaps[enumGroup] = map
    return map
  }

  // todo: remove
  isValid(str: string, runTimeGrammarBackedProgram: AbstractRuntimeProgramRootNode) {
    return this._getEnumFromGrammar(runTimeGrammarBackedProgram)[str] === true
  }
}

class GrammarEnumTestNode extends AbstractGrammarWordTestNode {
  private _map: jTreeTypes.stringMap

  isValid(str: string) {
    // enum c c++ java
    return !!this.getOptions()[str]
  }

  getOptions() {
    if (!this._map) this._map = TreeUtils.arrayToMap(this.getWordsFrom(1))
    return this._map
  }
}

class GrammarCellTypeDefinitionNode extends TreeNode {
  getFirstWordMap() {
    const types: jTreeTypes.stringMap = {}
    types[GrammarConstants.regex] = GrammarRegexTestNode
    types[GrammarConstants.enumFromGrammar] = EnumFromGrammarTestNode
    types[GrammarConstants.enum] = GrammarEnumTestNode
    types[GrammarConstants.highlightScope] = TreeNode
    return types
  }

  getGetter(wordIndex: number) {
    const wordToNativeJavascriptTypeParser = this.getCellConstructor().parserFunctionName
    return `get ${this.getCellTypeId()}() {
      return ${wordToNativeJavascriptTypeParser ? wordToNativeJavascriptTypeParser + `(this.getWord(${wordIndex}))` : `this.getWord(${wordIndex})`}
    }`
  }

  getCatchAllGetter(wordIndex: number) {
    const wordToNativeJavascriptTypeParser = this.getCellConstructor().parserFunctionName
    return `get ${this.getCellTypeId()}() {
      return ${
        wordToNativeJavascriptTypeParser
          ? `this.getWordsFrom(${wordIndex}).map(val => ${wordToNativeJavascriptTypeParser}(val))`
          : `this.getWordsFrom(${wordIndex})`
      }
    }`
  }

  // `this.getWordsFrom(${requireds.length + 1})`

  // todo: cleanup typings. todo: remove this hidden logic. have a "baseType" property?
  getCellConstructor(): typeof AbstractGrammarBackedCell {
    const kinds: jTreeTypes.stringMap = {}
    kinds[GrammarStandardCellTypeIds.any] = GrammarAnyCell
    kinds[GrammarStandardCellTypeIds.anyFirstWord] = GrammarAnyCell
    kinds[GrammarStandardCellTypeIds.float] = GrammarFloatCell
    kinds[GrammarStandardCellTypeIds.number] = GrammarFloatCell
    kinds[GrammarStandardCellTypeIds.bit] = GrammarBitCell
    kinds[GrammarStandardCellTypeIds.bool] = GrammarBoolCell
    kinds[GrammarStandardCellTypeIds.int] = GrammarIntCell
    return kinds[this.getWord(1)] || kinds[this.getWord(2)] || GrammarAnyCell
  }

  getHighlightScope(): string | undefined {
    return this.get(GrammarConstants.highlightScope)
  }

  private _getEnumOptions() {
    const enumNode = this.getChildrenByNodeConstructor(GrammarEnumTestNode)[0]
    if (!enumNode) return undefined

    // we sort by longest first to capture longest match first. todo: add test
    const options = Object.keys(enumNode.getOptions())
    options.sort((a, b) => b.length - a.length)

    return options
  }

  private _getEnumFromGrammarOptions(runTimeProgram: AbstractRuntimeProgramRootNode) {
    const node = <EnumFromGrammarTestNode>this.getNode(GrammarConstants.enumFromGrammar)
    return node ? Object.keys(node._getEnumFromGrammar(runTimeProgram)) : undefined
  }

  getAutocompleteWordOptions(runTimeProgram: AbstractRuntimeProgramRootNode): string[] {
    return this._getEnumOptions() || this._getEnumFromGrammarOptions(runTimeProgram) || []
  }

  getRegexString() {
    // todo: enum
    const enumOptions = this._getEnumOptions()
    return this.get(GrammarConstants.regex) || (enumOptions ? "(?:" + enumOptions.join("|") + ")" : "[^ ]*")
  }

  isValid(str: string, runTimeGrammarBackedProgram: AbstractRuntimeProgramRootNode) {
    return this.getChildrenByNodeConstructor(AbstractGrammarWordTestNode).every(node =>
      (<AbstractGrammarWordTestNode>node).isValid(str, runTimeGrammarBackedProgram)
    )
  }

  getCellTypeId(): jTreeTypes.cellTypeId {
    return this.getWord(1)
  }

  public static types: any
}

class GrammarDefinitionErrorNode extends TreeNode {
  getErrors(): jTreeTypes.TreeError[] {
    return [this.getFirstWord() ? new UnknownNodeTypeError(this) : new BlankLineError(this)]
  }

  getLineCellTypes() {
    return [<string>GrammarConstants.nodeType].concat(this.getWordsFrom(1).map(word => GrammarStandardCellTypeIds.any)).join(" ")
  }
}

class GrammarExampleNode extends TreeNode {}

class GrammarCompilerNode extends TreeNode {
  getFirstWordMap() {
    const types = [
      GrammarConstantsCompiler.sub,
      GrammarConstantsCompiler.indentCharacter,
      GrammarConstantsCompiler.listDelimiter,
      GrammarConstantsCompiler.openChildren,
      GrammarConstantsCompiler.closeChildren
    ]
    const map: jTreeTypes.firstWordToNodeConstructorMap = {}
    types.forEach(type => {
      map[type] = TreeNode
    })
    return map
  }

  getTargetExtension() {
    return this.getWord(1)
  }

  getListDelimiter() {
    return this.get(GrammarConstantsCompiler.listDelimiter)
  }

  getTransformation() {
    return this.get(GrammarConstantsCompiler.sub)
  }

  getIndentCharacter() {
    return this.get(GrammarConstantsCompiler.indentCharacter)
  }

  getOpenChildrenString() {
    return this.get(GrammarConstantsCompiler.openChildren) || ""
  }

  getCloseChildrenString() {
    return this.get(GrammarConstantsCompiler.closeChildren) || ""
  }
}

abstract class AbstractCustomConstructorNode extends TreeNode {
  protected isAppropriateEnvironment() {
    return true
  }

  abstract _getCustomConstructor(): jTreeTypes.RunTimeNodeConstructor

  getErrors(): InvalidConstructorPathError[] {
    // todo: should this be a try/catch?
    if (!this.isAppropriateEnvironment() || this._getCustomConstructor()) return []
    return [new InvalidConstructorPathError(this)]
  }

  _getDef() {
    const def = <AbstractGrammarDefinitionNode>this.getParent().getParent()

    if (def instanceof NonRootNodeTypeDefinition) return def
    return def.getProgram()
  }
}

class CustomNodeJsConstructorNode extends AbstractCustomConstructorNode {
  _getCustomConstructor(): jTreeTypes.RunTimeNodeConstructor {
    const filepath = this._getNodeConstructorFilePath()
    const rootPath = (<GrammarProgram>this.getRootNode()).getTheGrammarFilePath()
    const basePath = TreeUtils.getPathWithoutFileName(rootPath) + "/"
    const fullPath = filepath.startsWith("/") ? filepath : basePath + filepath

    const theModule = require(fullPath)
    const constructorSubModuleName = this._getSubModulePath()
    return constructorSubModuleName ? TreeUtils.resolveProperty(theModule, constructorSubModuleName) : theModule
  }

  _getSubModulePath() {
    return this.getWord(2) || this._getDef()._getGeneratedClassName()
  }

  // todo: does this support spaces in filepaths?
  private _getNodeConstructorFilePath() {
    return this.getWord(1)
  }

  protected isAppropriateEnvironment() {
    return this.isNodeJs()
  }
}

class CustomBrowserConstructorNode extends AbstractCustomConstructorNode {
  _getCustomConstructor(): jTreeTypes.RunTimeNodeConstructor {
    // todo: bad idea to have browser and node have reverse ordering for submodulename
    const constructorSubModuleName = this._getSubModulePath()
    const constructor = TreeUtils.resolveProperty(window, constructorSubModuleName)
    if (GrammarBackedNonTerminalNode.useAsBackupConstructor()) return GrammarBackedNonTerminalNode
    if (!constructor) throw new Error(`constructor window.${constructorSubModuleName} not found.`)

    return constructor
  }

  _getSubModulePath() {
    return this.getWord(1) || this._getDef()._getGeneratedClassName()
  }

  protected isAppropriateEnvironment() {
    return !this.isNodeJs()
  }
}

// todo: this should be mutually exclusive with custom constructors (if we keep those?)
class CustomJavascriptNode extends TreeNode {
  private _cached: any
  static cache: { [code: string]: jTreeTypes.RunTimeNodeConstructor } = {}

  private _getNodeJsConstructor(def: AbstractGrammarDefinitionNode, compiled: boolean): jTreeTypes.RunTimeNodeConstructor {
    return this._loadJavascriptCode(def, this._getCode(def, compiled))
  }

  // todo: can I ditch this? can I use the same code from the grammar definition?
  private _getCode(def: AbstractGrammarDefinitionNode, isCompiled: boolean) {
    const jtreePath = __dirname + "/jtree.node.js"
    //return def._nodeDefToJavascriptClass(isCompiled, jtreePath)
    return `const jtree = require('${jtreePath}').default
/* INDENT FOR BUILD REASONS */  module.exports = class ${def._getGeneratedClassName()} extends ${def._getExtendsClassName(isCompiled)} {
      ${def._getGetters()}
      ${this.childrenToString()}
}`
  }

  private _loadJavascriptCode(def: AbstractGrammarDefinitionNode, code: string): jTreeTypes.RunTimeNodeConstructor {
    if (CustomJavascriptNode.cache[code]) return CustomJavascriptNode.cache[code]
    const tempFilePath = `${__dirname}/${def._getGeneratedClassName()}-${TreeUtils.getRandomString(30)}-temp.js`
    const fs = require("fs")
    try {
      fs.writeFileSync(tempFilePath, code, "utf8")
      CustomJavascriptNode.cache[code] = require(tempFilePath)
    } catch (err) {
      console.error(err)
    } finally {
      fs.unlinkSync(tempFilePath)
    }

    return CustomJavascriptNode.cache[code]
  }

  private _getBrowserConstructor(def: AbstractGrammarDefinitionNode): jTreeTypes.RunTimeNodeConstructor {
    const definedCode = this._getCode(def, false)
    const tempClassName = "tempConstructor" + TreeUtils.getRandomString(30)
    if (CustomJavascriptNode.cache[definedCode]) return CustomJavascriptNode.cache[definedCode]

    const script = document.createElement("script")
    script.innerHTML = `window.${tempClassName} = ${definedCode}`
    document.head.appendChild(script)
    CustomJavascriptNode.cache[definedCode] = (<any>window)[tempClassName]
  }

  _getCustomJavascriptConstructor(def: AbstractGrammarDefinitionNode, compiled = false): jTreeTypes.RunTimeNodeConstructor {
    return this.isNodeJs() ? this._getNodeJsConstructor(def, compiled) : this._getBrowserConstructor(def)
  }

  getCatchAllNodeConstructor() {
    return TreeNode
  }
}

class GrammarCustomConstructorsNode extends TreeNode {
  getFirstWordMap() {
    const map: jTreeTypes.firstWordToNodeConstructorMap = {}
    map[GrammarConstants.constructorNodeJs] = CustomNodeJsConstructorNode
    map[GrammarConstants.constructorBrowser] = CustomBrowserConstructorNode
    return map
  }

  getConstructorForEnvironment(): AbstractCustomConstructorNode {
    return <AbstractCustomConstructorNode>this.getNode(this.isNodeJs() ? GrammarConstants.constructorNodeJs : GrammarConstants.constructorBrowser)
  }
}

abstract class GrammarNodeTypeConstant extends TreeNode {
  getGetter() {
    const identifier = this.getWord(1)
    return `get ${identifier}() { return ${this._getValue()} }`
  }

  protected _getValue() {
    const words = this.getWordsFrom(2)
    return words.length > 1 ? `[${words.join(",")}]` : words[0]
  }
}

class GrammarNodeTypeConstantInt extends GrammarNodeTypeConstant {}
class GrammarNodeTypeConstantString extends GrammarNodeTypeConstant {
  protected _getValue() {
    return `"${this.getWordsFrom(2).join(" ")}"`
  }
}
class GrammarNodeTypeConstantFloat extends GrammarNodeTypeConstant {}
class GrammarNodeTypeConstantBoolean extends GrammarNodeTypeConstant {}

abstract class AbstractGrammarDefinitionNode extends TreeNode {
  getFirstWordMap(): jTreeTypes.firstWordToNodeConstructorMap {
    const types = [
      GrammarConstants.frequency,
      GrammarConstants.inScope,
      GrammarConstants.cells,
      GrammarConstants.description,
      GrammarConstants.catchAllNodeType,
      GrammarConstants.catchAllCellType,
      GrammarConstants.firstCellType,
      GrammarConstants.defaults,
      GrammarConstants.tags,
      GrammarConstants.baseNodeType,
      GrammarConstants.group,
      GrammarConstants.required,
      GrammarConstants.single
    ]

    const map: jTreeTypes.firstWordToNodeConstructorMap = {}
    types.forEach(type => {
      map[type] = TreeNode
    })
    map[GrammarConstantsConstantTypes.boolean] = GrammarNodeTypeConstantBoolean
    map[GrammarConstantsConstantTypes.int] = GrammarNodeTypeConstantInt
    map[GrammarConstantsConstantTypes.string] = GrammarNodeTypeConstantString
    map[GrammarConstantsConstantTypes.float] = GrammarNodeTypeConstantFloat
    map[GrammarConstants.compilerNodeType] = GrammarCompilerNode
    map[GrammarConstants.constructors] = GrammarCustomConstructorsNode
    map[GrammarConstants.example] = GrammarExampleNode
    map[GrammarConstants.javascript] = CustomJavascriptNode
    return map
  }

  getExamples(): GrammarExampleNode[] {
    return this.getChildrenByNodeConstructor(GrammarExampleNode)
  }

  getNodeTypeIdFromDefinition(): jTreeTypes.nodeTypeId {
    return this.getWord(1)
  }

  abstract _nodeDefToJavascriptClass(isCompiled: boolean, jTreePath?: string, forNodeJs?: boolean): jTreeTypes.javascriptCode

  abstract _getExtendsClassName(isCompiled: boolean): jTreeTypes.javascriptClassPath

  _getGeneratedClassName() {
    let javascriptSyntaxSafeId = this.getNodeTypeIdFromDefinition()
    javascriptSyntaxSafeId = javascriptSyntaxSafeId.replace(/(\..)/g, letter => letter[1].toUpperCase())
    // todo: remove this? switch to allowing nodeTypeDefs to have a match attribute or something?
    javascriptSyntaxSafeId = javascriptSyntaxSafeId.replace(/\+/g, "plus")
    javascriptSyntaxSafeId = javascriptSyntaxSafeId.replace(/\-/g, "minus")
    javascriptSyntaxSafeId = javascriptSyntaxSafeId.replace(/\%/g, "mod")
    javascriptSyntaxSafeId = javascriptSyntaxSafeId.replace(/\//g, "div")
    javascriptSyntaxSafeId = javascriptSyntaxSafeId.replace(/\*/g, "mult")
    javascriptSyntaxSafeId = javascriptSyntaxSafeId.replace(/\#/g, "hash")
    javascriptSyntaxSafeId = javascriptSyntaxSafeId.replace(/\!/g, "bang")

    javascriptSyntaxSafeId = javascriptSyntaxSafeId.replace(/\~/g, "tilda")
    javascriptSyntaxSafeId = javascriptSyntaxSafeId.replace(/\=/g, "equal")
    javascriptSyntaxSafeId = javascriptSyntaxSafeId.replace(/\$/g, "dollar")
    javascriptSyntaxSafeId = javascriptSyntaxSafeId.replace(/\</g, "lt")
    javascriptSyntaxSafeId = javascriptSyntaxSafeId.replace(/\>/g, "gt")
    javascriptSyntaxSafeId = javascriptSyntaxSafeId.replace(/\?/g, "questionMark")
    javascriptSyntaxSafeId = javascriptSyntaxSafeId.replace(/\[/g, "openBracket")
    javascriptSyntaxSafeId = javascriptSyntaxSafeId.replace(/\]/g, "closeBracket")

    javascriptSyntaxSafeId = javascriptSyntaxSafeId.substr(0, 1).toUpperCase() + javascriptSyntaxSafeId.substr(1)
    return `${javascriptSyntaxSafeId}Node`
  }

  getNodeConstructorToJavascript(): string {
    const nodeMap = this.getRunTimeFirstWordMapWithDefinitions()

    // if THIS node defines a catch all constructor, use that
    // IF IT DOES NOT, ADD NOTHING
    // if THIS node defines a keyword map, use that first
    // IF IT DOES NOT, ADD NOTHING
    // CHECK PARENTS TOO
    const firstWordMap = this._createRunTimeFirstWordToNodeConstructorMap(this._getMyInScopeNodeTypeIds())

    // todo: use constants in first word maps
    if (Object.keys(firstWordMap).length)
      return `getFirstWordMap() {
  return {${Object.keys(firstWordMap).map(firstWord => `"${firstWord}" : ${nodeMap[firstWord]._getGeneratedClassName()}`)}}
  }`
    return ""
  }

  _isAbstract() {
    return false
  }

  private _cache_definedNodeConstructor: jTreeTypes.RunTimeNodeConstructor

  getConstructorDefinedInGrammar() {
    if (!this._cache_definedNodeConstructor) this._cache_definedNodeConstructor = this._getDefinedNodeConstructor()
    return this._cache_definedNodeConstructor
  }

  private _getBaseNodeType(): jTreeTypes.RunTimeNodeConstructor {
    const baseTypes: any = {}
    baseTypes[GrammarConstants.blobNode] = GrammarBackedBlobNode
    baseTypes[GrammarConstants.errorNode] = GrammarBackedErrorNode
    baseTypes[GrammarConstants.terminalNode] = GrammarBackedTerminalNode
    baseTypes[GrammarConstants.nonTerminalNode] = GrammarBackedNonTerminalNode
    return baseTypes[this.get(GrammarConstants.baseNodeType)]
  }

  protected _getDefaultNodeConstructor(): jTreeTypes.RunTimeNodeConstructor {
    const specifiedBaseNodeType = this._getBaseNodeType()
    if (specifiedBaseNodeType) return specifiedBaseNodeType

    // todo: I understand inScope but does catchAll logic checkout? Should we require specifying basetype?
    const isNonTerminal = this.has(GrammarConstants.inScope) || this.has(GrammarConstants.catchAllNodeType)

    return isNonTerminal ? GrammarBackedNonTerminalNode : GrammarBackedTerminalNode
  }

  /* Node constructor is the actual JS class being initiated, different than the Node type. */
  protected _getDefinedNodeConstructor(): jTreeTypes.RunTimeNodeConstructor {
    const customConstructorsDefinition = <GrammarCustomConstructorsNode>this.getChildrenByNodeConstructor(GrammarCustomConstructorsNode)[0]
    if (customConstructorsDefinition) {
      const envConstructor = customConstructorsDefinition.getConstructorForEnvironment()
      if (envConstructor) return envConstructor._getCustomConstructor()
    }

    return this._getDefinedCustomJSConstructor() || this._getDefaultNodeConstructor()
  }

  protected _getDefinedCustomJSConstructor(): jTreeTypes.RunTimeNodeConstructor {
    const customJavascriptNode = <CustomJavascriptNode>this.getNode(GrammarConstants.javascript)
    // todo: this is not catching if we dont have that but we do have constants.
    if (customJavascriptNode) return customJavascriptNode._getCustomJavascriptConstructor(this)
  }

  getCatchAllNodeConstructor(line: string) {
    return GrammarDefinitionErrorNode
  }

  getProgram(): GrammarProgram {
    return <GrammarProgram>this.getParent()
  }

  getDefinitionCompilerNode(targetLanguage: jTreeTypes.targetLanguageId, node: TreeNode) {
    const compilerNode = this._getCompilerNodes().find(node => (<any>node).getTargetExtension() === targetLanguage)
    if (!compilerNode) throw new Error(`No compiler for language "${targetLanguage}" for line "${node.getLine()}"`)
    return compilerNode
  }

  protected _getCompilerNodes() {
    return <GrammarCompilerNode[]>this.getChildrenByNodeConstructor(GrammarCompilerNode) || []
  }

  // todo: remove?
  // for now by convention first compiler is "target extension"
  getTargetExtension() {
    const firstNode = this._getCompilerNodes()[0]
    return firstNode ? firstNode.getTargetExtension() : ""
  }

  private _cache_runTimeFirstWordToNodeConstructorMap: jTreeTypes.firstWordToNodeConstructorMap

  getRunTimeFirstWordMap() {
    if (!this._cache_runTimeFirstWordToNodeConstructorMap)
      this._cache_runTimeFirstWordToNodeConstructorMap = this._createRunTimeFirstWordToNodeConstructorMap(this._getInScopeNodeTypeIds())
    return this._cache_runTimeFirstWordToNodeConstructorMap
  }

  getRunTimeFirstWordsInScope(): jTreeTypes.nodeTypeId[] {
    return Object.keys(this.getRunTimeFirstWordMap())
  }

  getRunTimeFirstWordMapWithDefinitions() {
    const defs = this._getProgramNodeTypeDefinitionCache()
    return TreeUtils.mapValues<NonRootNodeTypeDefinition>(this.getRunTimeFirstWordMap(), key => defs[key])
  }

  getRequiredCellTypeIds(): jTreeTypes.cellTypeId[] {
    const parameters = this.get(GrammarConstants.cells)
    return parameters ? parameters.split(" ") : []
  }

  _getDefNode() {
    return this
  }

  _getGetters() {
    // todo: add cellType parsings
    const grammarProgram = this.getProgram()
    const getters = this.getRequiredCellTypeIds().map((cellTypeId, index) => grammarProgram.getCellTypeDefinitionById(cellTypeId).getGetter(index + 1))

    const catchAllCellTypeId = this.getCatchAllCellTypeId()
    if (catchAllCellTypeId) getters.push(grammarProgram.getCellTypeDefinitionById(catchAllCellTypeId).getCatchAllGetter(getters.length + 1))

    // Constants
    this._getDefNode()
      .getChildrenByNodeConstructor(GrammarNodeTypeConstant)
      .forEach(node => {
        getters.push((<GrammarNodeTypeConstant>node).getGetter())
      })

    return getters.join("\n")
  }

  getCatchAllCellTypeId(): jTreeTypes.cellTypeId | undefined {
    return this.get(GrammarConstants.catchAllCellType)
  }

  protected _createRunTimeFirstWordToNodeConstructorMap(nodeTypeIdsInScope: jTreeTypes.nodeTypeId[]): jTreeTypes.firstWordToNodeConstructorMap {
    if (!nodeTypeIdsInScope.length) return {}

    const result: jTreeTypes.firstWordToNodeConstructorMap = {}

    const allProgramNodeTypeDefinitionsMap = this._getProgramNodeTypeDefinitionCache()
    Object.keys(allProgramNodeTypeDefinitionsMap)
      .filter(nodeTypeId => allProgramNodeTypeDefinitionsMap[nodeTypeId].isOrExtendsANodeTypeInScope(nodeTypeIdsInScope))
      .filter(nodeTypeId => !allProgramNodeTypeDefinitionsMap[nodeTypeId]._isAbstract())
      .forEach(nodeTypeId => {
        result[nodeTypeId] = allProgramNodeTypeDefinitionsMap[nodeTypeId].getConstructorDefinedInGrammar()
      })
    return result
  }

  getTopNodeTypeIds(): jTreeTypes.nodeTypeId[] {
    const definitions = this._getProgramNodeTypeDefinitionCache()
    const firstWords = this.getRunTimeFirstWordMap()
    const arr = Object.keys(firstWords).map(firstWord => definitions[firstWord])
    arr.sort(TreeUtils.sortByAccessor((definition: NonRootNodeTypeDefinition) => definition.getFrequency()))
    arr.reverse()
    return arr.map(definition => definition.getNodeTypeIdFromDefinition())
  }

  protected _getParentDefinition(): AbstractGrammarDefinitionNode {
    return undefined
  }

  protected _getMyInScopeNodeTypeIds(): jTreeTypes.nodeTypeId[] {
    const nodeTypesNode = this.getNode(GrammarConstants.inScope)
    return nodeTypesNode ? nodeTypesNode.getWordsFrom(1) : []
  }

  protected _getInScopeNodeTypeIds(): jTreeTypes.nodeTypeId[] {
    // todo: allow multiple of these if we allow mixins?
    const ids = this._getMyInScopeNodeTypeIds()
    const parentDef = this._getParentDefinition()
    return parentDef ? ids.concat(parentDef._getInScopeNodeTypeIds()) : ids
  }

  isRequired(): boolean {
    return this.has(GrammarConstants.required)
  }

  // todo: protected?
  _getRunTimeCatchAllNodeTypeId(): jTreeTypes.nodeTypeId {
    return ""
  }

  getNodeTypeDefinitionByNodeTypeId(nodeTypeId: jTreeTypes.nodeTypeId): AbstractGrammarDefinitionNode {
    const definitions = this._getProgramNodeTypeDefinitionCache()
    return definitions[nodeTypeId] || this._getCatchAllNodeTypeDefinition() // todo: this is where we might do some type of firstWord lookup for user defined fns.
  }

  _getCatchAllNodeTypeDefinition(): AbstractGrammarDefinitionNode {
    const catchAllNodeTypeId = this._getRunTimeCatchAllNodeTypeId()
    const definitions = this._getProgramNodeTypeDefinitionCache()
    const def = definitions[catchAllNodeTypeId]
    if (def) return def

    // todo: implement contraints like a grammar file MUST have a catch all.
    if (this.isRoot()) throw new Error(`This grammar language "${this.getProgram().getGrammarName()}" lacks a root catch all definition`)
    else return (<AbstractGrammarDefinitionNode>this.getParent())._getCatchAllNodeTypeDefinition()
  }

  private _cache_catchAllConstructor: jTreeTypes.RunTimeNodeConstructor

  protected _initCatchAllNodeConstructorCache(): void {
    if (this._cache_catchAllConstructor) return undefined

    this._cache_catchAllConstructor = this._getCatchAllNodeTypeDefinition().getConstructorDefinedInGrammar()
  }

  getFirstCellTypeId(): jTreeTypes.cellTypeId {
    return this.get(GrammarConstants.firstCellType) || GrammarStandardCellTypeIds.anyFirstWord
  }

  isDefined(nodeTypeId: string) {
    return !!this._getProgramNodeTypeDefinitionCache()[nodeTypeId.toLowerCase()]
  }

  protected _getProgramNodeTypeDefinitionCache(): { [nodeTypeId: string]: NonRootNodeTypeDefinition } {
    return this.getProgram()._getProgramNodeTypeDefinitionCache()
  }

  getRunTimeCatchAllNodeConstructor() {
    this._initCatchAllNodeConstructorCache()
    return this._cache_catchAllConstructor
  }
}

class NonRootNodeTypeDefinition extends AbstractGrammarDefinitionNode {
  // todo: protected?
  _getRunTimeCatchAllNodeTypeId(): string {
    return this.get(GrammarConstants.catchAllNodeType) || (<AbstractGrammarDefinitionNode>this.getParent())._getRunTimeCatchAllNodeTypeId()
  }

  isOrExtendsANodeTypeInScope(firstWordsInScope: string[]): boolean {
    const chain = this.getNodeTypeInheritanceSet()
    return firstWordsInScope.some(firstWord => chain.has(firstWord))
  }

  getSublimeSyntaxContextId() {
    return this.getNodeTypeIdFromDefinition().replace(/\#/g, "HASH") // # is not allowed in sublime context names
  }

  private _getFirstCellHighlightScope() {
    const program = this.getProgram()
    const cellTypeDefinition = program.getCellTypeDefinitionById(this.getFirstCellTypeId())
    // todo: standardize error/capture error at grammar time
    if (!cellTypeDefinition) throw new Error(`No ${GrammarConstants.cellType} ${this.getFirstCellTypeId()} found`)
    return cellTypeDefinition.getHighlightScope()
  }

  protected _getParentDefinition(): AbstractGrammarDefinitionNode {
    const extendsId = this._getExtendedNodeTypeId()
    return extendsId ? this.getNodeTypeDefinitionByNodeTypeId(extendsId) : undefined
  }

  getMatchBlock() {
    const defaultHighlightScope = "source"
    const program = this.getProgram()
    const escapeRegExp = (str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    const firstWordHighlightScope = (this._getFirstCellHighlightScope() || defaultHighlightScope) + "." + this.getNodeTypeIdFromDefinition()
    const match = `'^ *${escapeRegExp(this.getNodeTypeIdFromDefinition())}(?: |$)'`
    const topHalf = ` '${this.getSublimeSyntaxContextId()}':
  - match: ${match}
    scope: ${firstWordHighlightScope}`
    const requiredCellTypeIds = this.getRequiredCellTypeIds()
    const catchAllCellTypeId = this.getCatchAllCellTypeId()
    if (catchAllCellTypeId) requiredCellTypeIds.push(catchAllCellTypeId)
    if (!requiredCellTypeIds.length) return topHalf
    const captures = requiredCellTypeIds
      .map((cellTypeId, index) => {
        const cellTypeDefinition = program.getCellTypeDefinitionById(cellTypeId) // todo: cleanup
        if (!cellTypeDefinition) throw new Error(`No ${GrammarConstants.cellType} ${cellTypeId} found`) // todo: standardize error/capture error at grammar time
        return `        ${index + 1}: ${(cellTypeDefinition.getHighlightScope() || defaultHighlightScope) + "." + cellTypeDefinition.getCellTypeId()}`
      })
      .join("\n")

    const cellTypesToRegex = (cellTypeIds: string[]) => cellTypeIds.map((cellTypeId: string) => `({{${cellTypeId}}})?`).join(" ?")

    return `${topHalf}
    push:
     - match: ${cellTypesToRegex(requiredCellTypeIds)}
       captures:
${captures}
     - match: $
       pop: true`
  }

  private _cache_nodeTypeInheritanceSet: Set<jTreeTypes.nodeTypeId>
  private _cache_ancestorNodeTypeIdsArray: jTreeTypes.nodeTypeId[]

  getNodeTypeInheritanceSet() {
    this._initNodeTypeInheritanceCache()
    return this._cache_nodeTypeInheritanceSet
  }

  private _getIdOfNodeTypeThatThisExtends() {
    return this.getWord(2)
  }

  getAncestorNodeTypeIdsArray(): jTreeTypes.nodeTypeId[] {
    this._initNodeTypeInheritanceCache()
    return this._cache_ancestorNodeTypeIdsArray
  }

  protected _initNodeTypeInheritanceCache(): void {
    if (this._cache_nodeTypeInheritanceSet) return undefined
    let nodeTypeIds: jTreeTypes.nodeTypeId[] = []
    const extendedNodeTypeId = this._getIdOfNodeTypeThatThisExtends()
    if (extendedNodeTypeId) {
      const defs = this._getProgramNodeTypeDefinitionCache()
      const parentDef = defs[extendedNodeTypeId]
      if (!parentDef) throw new Error(`${extendedNodeTypeId} not found`)

      nodeTypeIds = nodeTypeIds.concat(parentDef.getAncestorNodeTypeIdsArray())
    }
    nodeTypeIds.push(this.getNodeTypeIdFromDefinition())
    this._cache_nodeTypeInheritanceSet = new Set(nodeTypeIds)
    this._cache_ancestorNodeTypeIdsArray = nodeTypeIds
  }

  // todo: protected?
  _getProgramNodeTypeDefinitionCache() {
    return this.getProgram()._getProgramNodeTypeDefinitionCache()
  }

  getDoc() {
    return this.getNodeTypeIdFromDefinition()
  }

  private _getDefaultsNode() {
    return this.getNode(GrammarConstants.defaults)
  }

  // todo: deprecate?
  getDefaultFor(name: string) {
    const defaults = this._getDefaultsNode()
    return defaults ? defaults.get(name) : undefined
  }

  getDescription(): string {
    return this.get(GrammarConstants.description) || ""
  }

  getFrequency() {
    const val = this.get(GrammarConstants.frequency)
    return val ? parseFloat(val) : 0
  }

  private _getExtendedNodeTypeId(): jTreeTypes.nodeTypeId {
    const ancestorIds = this.getAncestorNodeTypeIdsArray()
    if (ancestorIds.length > 1) return ancestorIds[ancestorIds.length - 2]
  }

  private _getCustomJavascriptMethods(): jTreeTypes.javascriptCode {
    const jsCode = this.getNode(GrammarConstants.javascript)
    return jsCode ? jsCode.childrenToString() : ""
  }

  _getExtendsClassName(isCompiled = false) {
    if (!isCompiled) return "jtree.NonTerminalNode" // todo: this is incorrect but works for legacy stuff.
    const extendedNodeTypeId = this._getExtendedNodeTypeId()
    return extendedNodeTypeId
      ? this.getNodeTypeDefinitionByNodeTypeId(extendedNodeTypeId)._getGeneratedClassName()
      : isCompiled
      ? "jtree.CompiledLanguageNonRootNode"
      : "jtree.NonTerminalNode"
  }

  _nodeDefToJavascriptClass(isCompiled = true): jTreeTypes.javascriptCode {
    const ancestorIds = this.getAncestorNodeTypeIdsArray()

    const components = [this.getNodeConstructorToJavascript(), this._getGetters(), this._getCustomJavascriptMethods()].filter(code => code)

    return `class ${this._getGeneratedClassName()} extends ${this._getExtendsClassName(isCompiled)} {
      ${components.join("\n")}
    }`
  }
}

// todo: is this extending the correct class? Should it just be extending TreeNode?
class GrammarRootNode extends AbstractGrammarDefinitionNode {
  protected _getDefaultNodeConstructor(): jTreeTypes.RunTimeNodeConstructor {
    return undefined
  }

  _nodeDefToJavascriptClass() {
    return ""
  }

  // todo: I think this may be a sign we dont want this class.
  _getExtendsClassName() {
    return ""
  }

  getProgram() {
    return <GrammarProgram>this.getParent()
  }

  protected _getDefinedCustomJSConstructor(): jTreeTypes.RunTimeNodeConstructor {
    const customJavascriptNode = <CustomJavascriptNode>this.getNode(GrammarConstants.javascript)
    if (customJavascriptNode) return customJavascriptNode._getCustomJavascriptConstructor(this.getProgram())
  }

  getFirstWordMap() {
    // todo: this isn't quite correct. we are allowing too many firstWords.
    const map = super.getFirstWordMap()
    map[GrammarConstants.extensions] = TreeNode
    map[GrammarConstants.version] = TreeNode
    map[GrammarConstants.name] = TreeNode
    map[GrammarConstants.nodeTypeOrder] = TreeNode
    return map
  }
}

class GrammarAbstractNodeTypeDefinitionNode extends NonRootNodeTypeDefinition {
  _isAbstract() {
    return true
  }
}

// GrammarProgram is a constructor that takes a grammar file, and builds a new
// constructor for new language that takes files in that language to execute, compile, etc.
class GrammarProgram extends AbstractGrammarDefinitionNode {
  getFirstWordMap() {
    const map: jTreeTypes.stringMap = {}
    map[GrammarConstants.grammar] = GrammarRootNode
    map[GrammarConstants.cellType] = GrammarCellTypeDefinitionNode
    map[GrammarConstants.nodeType] = NonRootNodeTypeDefinition
    map[GrammarConstants.abstract] = GrammarAbstractNodeTypeDefinitionNode
    map[GrammarConstants.javascript] = CustomJavascriptNode
    map[GrammarConstants.toolingDirective] = TreeNode
    return map
  }

  _getExtendsClassName(isCompiled = false) {
    return isCompiled ? "jtree.CompiledLanguageRootNode" : "jtree.programRoot"
  }

  private _getCustomJavascriptMethods(): jTreeTypes.javascriptCode {
    const jsCode = this._getGrammarRootNode().getNode(GrammarConstants.javascript)
    return jsCode ? jsCode.childrenToString() : ""
  }

  getErrorsInGrammarExamples() {
    const programConstructor = this.getRootConstructor()
    const errors: jTreeTypes.TreeError[] = []
    this.getNodeTypeDefinitions().forEach(def =>
      def.getExamples().forEach(example => {
        const exampleProgram = new programConstructor(example.childrenToString())
        exampleProgram.getAllErrors().forEach(err => {
          errors.push(err)
        })
      })
    )
    return errors
  }

  getTargetExtension() {
    return this._getGrammarRootNode().getTargetExtension()
  }

  getNodeTypeOrder() {
    return this._getGrammarRootNode().get(GrammarConstants.nodeTypeOrder)
  }

  private _cache_cellTypes: {
    [name: string]: GrammarCellTypeDefinitionNode
  }

  getCellTypeDefinitions() {
    if (!this._cache_cellTypes) this._cache_cellTypes = this._getCellTypeDefinitions()
    return this._cache_cellTypes
  }

  getCellTypeDefinitionById(cellTypeId: jTreeTypes.cellTypeId) {
    // todo: return unknownCellTypeDefinition? or is that handled somewhere else?
    return this.getCellTypeDefinitions()[cellTypeId]
  }

  getNodeTypeFamilyTree() {
    const tree = new TreeNode()
    Object.values(this.getNodeTypeDefinitions()).forEach(node => {
      const path = node.getAncestorNodeTypeIdsArray().join(" ")
      tree.touchNode(path)
    })
    return tree
  }

  protected _getCellTypeDefinitions() {
    const types: { [typeName: string]: GrammarCellTypeDefinitionNode } = {}
    // todo: add built in word types?
    this.getChildrenByNodeConstructor(GrammarCellTypeDefinitionNode).forEach(type => (types[(<GrammarCellTypeDefinitionNode>type).getCellTypeId()] = type))
    return types
  }

  getProgram() {
    return this
  }

  getNodeTypeDefinitions() {
    return <NonRootNodeTypeDefinition[]>this.getChildrenByNodeConstructor(NonRootNodeTypeDefinition)
  }

  // todo: remove?
  getTheGrammarFilePath() {
    return this.getLine()
  }

  protected _getGrammarRootNode() {
    return <GrammarRootNode>this.getNodeByType(GrammarRootNode)
  }

  getExtensionName() {
    return this.getGrammarName()
  }

  getGrammarName(): string | undefined {
    return this._getGrammarRootNode().get(GrammarConstants.name)
  }

  protected _getMyInScopeNodeTypeIds(): jTreeTypes.nodeTypeId[] {
    const nodeTypesNode = this._getGrammarRootNode().getNode(GrammarConstants.inScope)
    return nodeTypesNode ? nodeTypesNode.getWordsFrom(1) : []
  }

  protected _getInScopeNodeTypeIds(): jTreeTypes.nodeTypeId[] {
    const nodeTypesNode = this._getGrammarRootNode().getNode(GrammarConstants.inScope)
    return nodeTypesNode ? nodeTypesNode.getWordsFrom(1) : []
  }

  private _cachedDefinitions: {
    [firstWord: string]: AbstractGrammarDefinitionNode
  }

  getNodeTypeDefinitionByFirstWordPath(firstWordPath: string): AbstractGrammarDefinitionNode {
    if (!this._cachedDefinitions) this._cachedDefinitions = {}
    if (this._cachedDefinitions[firstWordPath]) return this._cachedDefinitions[firstWordPath]

    const parts = firstWordPath.split(" ")
    let subject: AbstractGrammarDefinitionNode = this
    let def
    for (let index = 0; index < parts.length; index++) {
      const part = parts[index]
      def = subject.getRunTimeFirstWordMapWithDefinitions()[part]
      if (!def) def = <AbstractGrammarDefinitionNode>subject._getCatchAllNodeTypeDefinition()
      subject = def
    }

    this._cachedDefinitions[firstWordPath] = def
    return def
  }

  getDocs() {
    return this.toString()
  }

  // At present we only have global nodeType definitions (you cannot have scoped nodeType definitions right now).
  private _cache_nodeTypeDefinitions: { [nodeTypeId: string]: NonRootNodeTypeDefinition }

  protected _initProgramNodeTypeDefinitionCache(): void {
    if (this._cache_nodeTypeDefinitions) return undefined

    this._cache_nodeTypeDefinitions = {}

    this.getChildrenByNodeConstructor(NonRootNodeTypeDefinition).forEach(nodeTypeDefinitionNode => {
      this._cache_nodeTypeDefinitions[(<NonRootNodeTypeDefinition>nodeTypeDefinitionNode).getNodeTypeIdFromDefinition()] = nodeTypeDefinitionNode
    })
  }

  _getProgramNodeTypeDefinitionCache() {
    this._initProgramNodeTypeDefinitionCache()
    return this._cache_nodeTypeDefinitions
  }

  _getRunTimeCatchAllNodeTypeId(): string {
    return this._getGrammarRootNode().get(GrammarConstants.catchAllNodeType)
  }

  private _getRootConstructor(): AbstractRuntimeProgramConstructorInterface {
    const extendedConstructor: any = this._getGrammarRootNode().getConstructorDefinedInGrammar() || AbstractRuntimeProgramRootNode
    const grammarProgram = this

    // Note: this is some of the most unorthodox code in this repo. We create a class on the fly for your
    // new language.
    return <AbstractRuntimeProgramConstructorInterface>(<any>class extends extendedConstructor {
      getGrammarProgram(): GrammarProgram {
        return grammarProgram
      }
    })
  }

  private _cache_rootConstructorClass: AbstractRuntimeProgramConstructorInterface

  getRootConstructor() {
    if (!this._cache_rootConstructorClass) this._cache_rootConstructorClass = this._getRootConstructor()
    return this._cache_rootConstructorClass
  }

  private _getFileExtensions(): string {
    return this._getGrammarRootNode().get(GrammarConstants.extensions)
      ? this._getGrammarRootNode()
          .get(GrammarConstants.extensions)
          .split(" ")
          .join(",")
      : this.getExtensionName()
  }

  toNodeJsJavascript(jtreePath = "jtree"): jTreeTypes.javascriptCode {
    return this._nodeDefToJavascriptClass(true, jtreePath, true)
  }

  // todo: have this here or not?
  toNodeJsJavascriptPrettier(jtreePath = "jtree"): jTreeTypes.javascriptCode {
    return require("prettier").format(this._nodeDefToJavascriptClass(true, jtreePath, true), { semi: false, parser: "babel" })
  }

  toBrowserJavascript(): jTreeTypes.javascriptCode {
    return this._nodeDefToJavascriptClass(true, "", false)
  }

  private _getProperName() {
    const name = this.getExtensionName()
    return name.substr(0, 1).toUpperCase() + name.substr(1)
  }

  _getGeneratedClassName() {
    return this._getProperName() + "ProgramRoot"
  }

  private _getCatchAllNodeConstructorToJavascript() {
    const nodeTypeId = this._getRunTimeCatchAllNodeTypeId()
    if (!nodeTypeId) return ""
    const className = this.getNodeTypeDefinitionByNodeTypeId(nodeTypeId)._getGeneratedClassName()
    return `getCatchAllNodeConstructor() { return ${className}}`
  }

  _nodeDefToJavascriptClass(isCompiled: boolean, jtreePath: string, forNodeJs = true): jTreeTypes.javascriptCode {
    const defs = this.getNodeTypeDefinitions()
    const nodeTypeClasses = defs.map(def => def._nodeDefToJavascriptClass()).join("\n\n")

    const constantsName = this._getProperName() + "Constants"
    const nodeTypeConstants = defs
      .map(def => {
        const id = def.getNodeTypeIdFromDefinition()
        return `"${id}": "${id}"`
      })
      .join(",\n")
    const cellTypeConstants = Object.keys(this.getCellTypeDefinitions())
      .map(id => `"${id}" : "${id}"`)
      .join(",\n")

    const rootClassMethods = [this.getNodeConstructorToJavascript(), this._getCatchAllNodeConstructorToJavascript(), this._getCustomJavascriptMethods()].filter(
      code => code
    )
    const rootClass = `class ${this._getGeneratedClassName()} extends ${this._getExtendsClassName(isCompiled)} {
  ${rootClassMethods.join("\n")}
    }`

    return `${forNodeJs ? `const jtree = require("${jtreePath}")` : ""}

const ${constantsName} = {
  nodeTypes: {
    ${nodeTypeConstants}
  },
  cellTypes: {
    ${cellTypeConstants}
  }
}

${nodeTypeClasses}

${rootClass}

${forNodeJs ? `module.exports = {${constantsName}, ` + this._getGeneratedClassName() + "}" : ""}
`
  }

  toSublimeSyntaxFile() {
    const cellTypeDefs = this.getCellTypeDefinitions()
    const variables = Object.keys(cellTypeDefs)
      .map(name => ` ${name}: '${cellTypeDefs[name].getRegexString()}'`)
      .join("\n")

    const defs = this.getNodeTypeDefinitions().filter(kw => !kw._isAbstract())
    const nodeTypeContexts = defs.map(def => def.getMatchBlock()).join("\n\n")
    const includes = defs.map(nodeTypeDef => `  - include: '${nodeTypeDef.getSublimeSyntaxContextId()}'`).join("\n")

    return `%YAML 1.2
---
name: ${this.getExtensionName()}
file_extensions: [${this._getFileExtensions()}]
scope: source.${this.getExtensionName()}

variables:
${variables}

contexts:
 main:
${includes}

${nodeTypeContexts}`
  }

  // A language where anything goes.
  static getTheAnyLanguageRootConstructor() {
    return this.newFromCondensed(
      `${GrammarConstants.grammar}
 ${GrammarConstants.name} any
 ${GrammarConstants.catchAllNodeType} anyNode
${GrammarConstants.nodeType} anyNode
 ${GrammarConstants.catchAllCellType} anyWord
 ${GrammarConstants.firstCellType} anyWord
${GrammarConstants.cellType} anyWord`
    ).getRootConstructor()
  }

  static _condensedToExpanded(grammarCode: string) {
    // todo: handle imports
    const tree = new TreeNode(grammarCode)

    // Expand groups
    // todo: rename? maybe change this to something like "makeNodeTypes"?
    // todo: where is this used? if we had imports, would that be a better solution?
    const xi = tree.getXI()
    tree.findNodes(`${GrammarConstants.abstract}${xi}${GrammarConstants.group}`).forEach(group => {
      const abstractName = group.getParent().getWord(1)
      group
        .getContent()
        .split(xi)
        .forEach(word => tree.appendLine(`${GrammarConstants.nodeType}${xi}${word}${xi}${abstractName}`))
    })

    // todo: only expand certain types.
    // inScope should be a set.
    tree._expandChildren(1, 2, tree.filter(node => node.getFirstWord() !== GrammarConstants.toolingDirective))
    return tree
  }

  static newFromCondensed(grammarCode: string, grammarPath?: jTreeTypes.filepath) {
    return new GrammarProgram(this._condensedToExpanded(grammarCode), grammarPath)
  }

  async loadAllConstructorScripts(baseUrlPath: string): Promise<string[]> {
    if (!this.isBrowser()) return undefined
    const uniqueScriptsSet = new Set(
      this.getNodesByGlobPath(`* ${GrammarConstants.constructors} ${GrammarConstants.constructorBrowser}`)
        .filter(node => node.getWord(2))
        .map(node => baseUrlPath + node.getWord(2))
    )

    return Promise.all(Array.from(uniqueScriptsSet).map(script => GrammarProgram._appendScriptOnce(script)))
  }

  private static _scriptLoadingPromises: { [url: string]: Promise<string> } = {}

  private static async _appendScriptOnce(url: string) {
    // if (this.isNodeJs()) return undefined
    if (!url) return undefined
    if (this._scriptLoadingPromises[url]) return this._scriptLoadingPromises[url]

    this._scriptLoadingPromises[url] = this._appendScript(url)
    return this._scriptLoadingPromises[url]
  }

  private static _appendScript(url: string) {
    //https://bradb.net/blog/promise-based-js-script-loader/
    return new Promise<string>(function(resolve, reject) {
      let resolved = false
      const scriptEl = document.createElement("script")

      scriptEl.type = "text/javascript"
      scriptEl.src = url
      scriptEl.async = true
      scriptEl.onload = (<any>scriptEl).onreadystatechange = function() {
        if (!resolved && (!this.readyState || this.readyState == "complete")) {
          resolved = true
          resolve(url)
        }
      }
      scriptEl.onerror = scriptEl.onabort = reject
      document.head.appendChild(scriptEl)
    })
  }
}

export {
  GrammarConstants,
  GrammarStandardCellTypeIds,
  GrammarProgram,
  AbstractRuntimeProgramRootNode,
  GrammarBackedTerminalNode,
  GrammarBackedNonTerminalNode,
  CompiledLanguageNonRootNode,
  CompiledLanguageRootNode
}