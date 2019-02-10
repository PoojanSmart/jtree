const TreeNode = require("../base/TreeNode.js")

class AbstractGrammarBackedProgram extends TreeNode {
  getProgram() {
    return this
  }

  getProgramErrors() {
    const nodeErrors = this.getTopDownArray()
      .map(node => node.getErrors())
      .filter(arr => arr.length)
    return [].concat.apply([], nodeErrors)
  }

  getKeywordMap() {
    return this.getDefinition().getRunTimeKeywordMap()
  }

  getCatchAllNodeClass(line) {
    // todo: blank line
    // todo: restore didyoumean
    return this.getDefinition().getRunTimeCatchAllNodeClass()
  }

  getDefinition() {
    return this.getGrammarProgram()
  }

  getKeywordUsage(filepath = "") {
    const usage = new TreeNode()
    const grammarProgram = this.getGrammarProgram()
    const keywordDefinitions = grammarProgram.getKeywordDefinitions()
    keywordDefinitions.forEach(child => {
      usage.appendLine([child.getId(), "line-id", "keyword", child.getNodeColumnTypes().join(" ")].join(" "))
    })
    const programNodes = this.getTopDownArray()
    programNodes.forEach((programNode, lineNumber) => {
      const def = programNode.getDefinition()
      const keyword = def.getId()
      const stats = usage.getNode(keyword)
      stats.appendLine([filepath + "-" + lineNumber, programNode.getWords().join(" ")].join(" "))
    })
    return usage
  }

  getInPlaceSyntaxTree() {
    return this.getTopDownArray()
      .map(child => child.getIndentation() + child.getLineSyntax())
      .join("\n")
  }

  getInPlaceSyntaxTreeWithNodeTypes() {
    return this.getTopDownArray()
      .map(child => child.constructor.name + this.getZI() + child.getIndentation() + child.getLineSyntax())
      .join("\n")
  }

  getSyntaxTreeHtml() {
    const getColor = child => {
      if (child.getLineSyntax().includes("error")) return "red"
      return "black"
    }
    const zip = (a1, a2) => {
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
          `<div style="white-space: pre;">${
            child.constructor.name
          } ${this.getZI()} ${child.getIndentation()} <span style="color: ${getColor(child)};">${zip(
            child.getLineSyntax().split(" "),
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

  getWordTypeAtPosition(lineIndex, wordIndex) {
    this._initWordTypeCache()
    const typeNode = this._cache_typeTree.getTopDownArray()[lineIndex - 1]
    return typeNode ? typeNode.getWord(wordIndex - 1) : ""
  }

  _initWordTypeCache() {
    const treeMTime = this.getTreeMTime()
    if (this._cache_programWordTypeStringMTime === treeMTime) return undefined

    this._cache_typeTree = new TreeNode(this.getInPlaceSyntaxTree())
    this._cache_programWordTypeStringMTime = treeMTime
  }

  getCompiledProgramName(programPath) {
    const grammarProgram = this.getDefinition()
    return programPath.replace(`.${grammarProgram.getExtensionName()}`, `.${grammarProgram.getTargetExtension()}`)
  }
}

module.exports = AbstractGrammarBackedProgram
