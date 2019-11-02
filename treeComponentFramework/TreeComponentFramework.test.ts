#!/usr/bin/env ts-node

import { AbstractTreeComponent } from "./TreeComponentFramework"
const { jtree } = require("../index.js")

const testTree: any = {}

class TestApp extends AbstractTreeComponent {
  getDefaultStartState() {
    return "headerComponent"
  }

  createParser() {
    return new jtree.TreeNode.Parser(undefined, {
      headerComponent: headerComponent
    })
  }
}

class headerComponent extends AbstractTreeComponent {}

testTree.all = (equal: any) => {
  // Arrange
  const app = new TestApp()

  // Assert
  equal(!!app.getTheme(), true, "get theme")
  equal(!!app.getWillowProgram(), true, "get willow")
  equal(!!app.getDefaultStartState(), true, "headerComponent")

  equal(app.getWillowProgram().toPrettyDeepLink(`foo bar`, { filename: "bam.foo" }), "http://localhost:8000/index.html?filename=bam.foo&nodeBreakSymbol=%7E&edgeSymbol=_&data=foo_bar")
}

/*NODE_JS_ONLY*/ if (!module.parent) jtree.TestRacer.testSingleFile(__filename, testTree)

export { testTree }
