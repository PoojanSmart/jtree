class TreeUtils {
  static getPathWithoutFileName(path) {
    const parts = path.split("/") // todo: change for windows?
    parts.pop()
    return parts.join("/")
  }

  static getClassNameFromFilePath(filename) {
    return filename
      .replace(/\.[^\.]+$/, "")
      .split("/")
      .pop()
  }

  static getLineIndexAtCharacterPosition(str: string, index: number): number {
    const lines = str.split("\n")
    const len = lines.length
    let position = 0
    for (let lineNumber = 0; lineNumber < len; lineNumber++) {
      position += lines[lineNumber].length
      if (position >= index) return lineNumber
    }
  }

  static resolvePath(filePath: string, programFilepath: string) {
    // For use in Node.js only
    if (!filePath.startsWith(".")) return filePath
    const path = require("path")
    const folder = this.getPathWithoutFileName(programFilepath)
    return path.resolve(folder + "/" + filePath)
  }

  static getFileExtension(url = "") {
    const match = url.match(/\.([^\.]+)$/)
    return (match && match[1]) || ""
  }

  static resolveProperty(obj: Object, path: string | string[], separator = ".") {
    const properties = Array.isArray(path) ? path : path.split(separator)
    return properties.reduce((prev, curr) => prev && prev[curr], obj)
  }

  static formatStr(str, listDelimiter = " ", parameterMap) {
    return str.replace(/{([^\}]+)}/g, (match, path) => {
      const isList = path.endsWith("*")
      const typePath = path.replace("*", "")
      const arr = parameterMap[typePath]
      if (!arr) return ""
      const word = isList ? arr.join(listDelimiter) : arr.shift()
      return word
    })
  }

  static stripHtml(text) {
    return text && text.replace ? text.replace(/<(?:.|\n)*?>/gm, "") : text
  }

  static getUniqueWordsArray(allWords: string) {
    const words = allWords.replace(/\n/g, " ").split(" ")
    const index = {}
    words.forEach(word => {
      if (!index[word]) index[word] = 0
      index[word]++
    })
    return Object.keys(index).map(key => {
      return {
        word: key,
        count: index[key]
      }
    })
  }

  static getRandomString(
    length = 30,
    letters = "abcdefghijklmnopqrstuvwxyz0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("")
  ) {
    let str = ""
    while (length) {
      str += letters[Math.round(Math.min(Math.random() * letters.length, letters.length - 1))]
      length--
    }
    return str
  }

  static makeRandomTree(lines = 1000) {
    let str = ""
    let letters = " 123abc".split("")
    while (lines) {
      let indent = " ".repeat(Math.round(Math.random() * 6))
      let bit = indent
      let rand = Math.floor(Math.random() * 30)

      while (rand) {
        bit += letters[Math.round(Math.min(Math.random() * letters.length, letters.length - 1))]
        rand--
      }

      bit += "\n"
      str += bit
      lines--
    }
    return str
  }

  static arrayToMap(arr) {
    const map = {}
    arr.forEach(val => (map[val] = true))
    return map
  }

  static mapValues(object, fn) {
    const result = {}
    Object.keys(object).forEach(key => {
      result[key] = fn(key)
    })
    return result
  }

  static sortByAccessor(accessor) {
    return (objectA, objectB) => {
      const av = accessor(objectA)
      const bv = accessor(objectB)
      let result = av < bv ? -1 : av > bv ? 1 : 0
      if (av === undefined && bv !== undefined) result = -1
      else if (bv === undefined && av !== undefined) result = 1
      return result
    }
  }

  static makeGraphSortFunction(thisColumnIndex: number, extendsColumnIndex: number) {
    return (nodeA, nodeB) => {
      // -1 === a before b
      const nodeAUniqueId = nodeA.getWord(thisColumnIndex)
      const nodeAExtends = nodeA.getWord(extendsColumnIndex)
      const nodeBUniqueId = nodeB.getWord(thisColumnIndex)
      const nodeBExtends = nodeB.getWord(extendsColumnIndex)
      const nodeAExtendsNodeB = nodeAExtends && nodeAExtends === nodeBUniqueId
      const nodeBExtendsNodeA = nodeBExtends && nodeBExtends === nodeAUniqueId

      if (!nodeAExtends && !nodeBExtends) {
        // If neither extends, sort by keyword
        if (nodeAUniqueId > nodeBUniqueId) return 1
        else if (nodeAUniqueId < nodeBUniqueId) return -1
        return 0
      }
      // If only one extends, the other comes first
      else if (!nodeAExtends) return -1
      else if (!nodeBExtends) return 1

      // If A extends B, B should come first
      if (nodeAExtendsNodeB) return 1
      else if (nodeBExtendsNodeA) return -1

      // Sort by what they extend
      if (nodeAExtends > nodeBExtends) return 1
      else if (nodeAExtends < nodeBExtends) return -1

      // Finally sort by keyword
      if (nodeAUniqueId > nodeBUniqueId) return 1
      else if (nodeAUniqueId < nodeBUniqueId) return -1

      // Should never hit this, unless we have a duplicate line.
      return 0
    }
  }

  public static BrowserScript = class {
    // todo: fix
    public _str: string

    constructor(fileStr: string) {
      this._str = fileStr
    }

    addUseStrict() {
      this._str = `"use strict";\n` + this._str
      return this
    }

    removeRequires() {
      this._str = this._str.replace(/(\n|^)const .* \= require\(.*/g, "$1")
      return this
    }

    _removeAllLinesStartingWith(prefix: string) {
      this._str = this._str
        .split("\n")
        .filter(line => !line.startsWith(prefix))
        .join("\n")
      return this
    }

    removeNodeJsOnlyLines() {
      return this._removeAllLinesStartingWith("/*NODE_JS_ONLY*/")
    }

    removeHashBang() {
      this._str = this._str.replace(/^\#\![^\n]+\n/, "")
      return this
    }

    removeImports() {
      // todo: what if this spans multiple lines?
      this._str = this._str.replace(/(\n|^)import .* from .*/g, "$1")
      this._str = this._str.replace(/(\n|^)\/\*FOR_TYPES_ONLY\*\/ import .* from .*/g, "$1")
      return this
    }

    removeExports() {
      this._str = this._str.replace(/(\n|^)export default .*/g, "$1")
      this._str = this._str.replace(/(\n|^)export { [^\}]+ }/g, "$1")
      return this
    }

    changeDefaultExportsToWindowExports() {
      this._str = this._str.replace(/\nexport default ([^;]*)/g, "\nwindow.$1 = $1")

      // todo: should we just switch to some bundler?
      const matches = this._str.match(/\nexport { ([^\}]+) }/g)
      if (matches)
        this._str.replace(
          /\nexport { ([^\}]+) }/g,
          matches[1]
            .split(/ /g)
            .map(mod => `\nwindow.${mod} = ${mod}`)
            .join("\n")
        )
      return this
    }

    changeNodeExportsToWindowExports() {
      this._str = this._str.replace(/\nmodule\.exports \= ([^;]*)/g, "\nwindow.$1 = $1")
      return this
    }

    getString() {
      return this._str
    }
  }
}

export default TreeUtils
