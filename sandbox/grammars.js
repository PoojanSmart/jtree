const main = grammarSourceCode => {
  const grammarConsole = $("#grammarConsole")
  const codeConsole = $("#codeConsole")
  const codeErrorsConsole = $("#codeErrorsConsole")
  const grammarErrorsConsole = $("#grammarErrorsConsole")

  const init = () => {
    if (localStorage.getItem("grammarConsole")) grammarConsole.val(localStorage.getItem("grammarConsole"))
    if (localStorage.getItem("codeConsole")) codeConsole.val(localStorage.getItem("codeConsole"))
    $("#version").html("Version: " + jtree.getVersion())
  }

  init()

  const GrammarConstructor = jtree.GrammarProgram.newFromCondensed(grammarSourceCode, "").getRootConstructor()
  const grammarInstance = new jtree.TreeNotationCodeMirrorMode(
    "grammar",
    () => GrammarConstructor,
    undefined,
    CodeMirror
  )
    .register()
    .fromTextAreaWithAutocomplete(grammarConsole[0], { lineWrapping: true })

  const grammarOnUpdate = () => {
    const grammarCode = grammarInstance.getValue()
    localStorage.setItem("grammarConsole", grammarCode)
    window.grammarProgram = new GrammarConstructor(grammarCode)
    const errs = window.grammarProgram.getProgramErrors()
    grammarErrorsConsole.html(errs.length ? new TreeNode(errs).toFormattedTable(200) : "0 errors")
  }

  let grammarConstructor
  let cachedGrammarCode

  const getGrammarConstructor = () => {
    const currentGrammarCode = grammarInstance.getValue()
    if (!grammarConstructor || currentGrammarCode !== cachedGrammarCode) {
      try {
        const grammarProgram = jtree.GrammarProgram.newFromCondensed(currentGrammarCode, "")
        grammarConstructor = grammarProgram.getRootConstructor()
        cachedGrammarCode = currentGrammarCode
      } catch (err) {
        debugger
      }
    }
    return grammarConstructor
  }

  const codeInstance = new jtree.TreeNotationCodeMirrorMode("custom", getGrammarConstructor, undefined, CodeMirror)
    .register()
    .fromTextAreaWithAutocomplete(codeConsole[0], { lineWrapping: true })

  const codeOnUpdate = () => {
    const code = codeInstance.getValue()
    localStorage.setItem("codeConsole", code)
    window.program = new (getGrammarConstructor())(code)
    const errs = window.program.getProgramErrors()
    codeErrorsConsole.html(errs.length ? new TreeNode(errs).toFormattedTable(200) : "0 errors")
  }

  grammarInstance.on("keyup", grammarOnUpdate)
  grammarInstance.on("keyup", () => {
    codeOnUpdate()
    // Hack to break CM cache:
    if (true) {
      const val = codeInstance.getValue()
      codeInstance.setValue("\n" + val)
      codeInstance.setValue(val)
    }
  })
  codeInstance.on("keyup", codeOnUpdate)

  if (grammarInstance.getValue()) {
    grammarOnUpdate()
    codeOnUpdate()
  }

  const fetchGrammar = name => {
    $.get(`/langs/${name}/${name}.grammar`).then(grammar => {
      $.get(`/langs/${name}/sample.${name}`).then(sample => {
        grammarInstance.setValue(grammar)
        grammarOnUpdate()
        codeInstance.setValue(sample)
        codeOnUpdate()
      })
    })
  }

  $("#samples").on("click", "a", function() {
    const name = $(this)
      .text()
      .toLowerCase()
    fetchGrammar(name)
  })
}

$(document).ready(function() {
  $.get("/grammar.grammar").then(main)
})