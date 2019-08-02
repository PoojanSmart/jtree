#!/usr/bin/env ts-node

// todo: make isomorphic

import { readFileSync } from "fs"
import jTreeTypes from "../core/jTreeTypes"
import { UnknownGrammarProgram } from "./UnknownGrammarProgram"
import { TestTreeRunner } from "../builder/TestTreeRunner"

const testTree: jTreeTypes.testTree = {}

testTree.predictGrammarFile = equal => {
  // Arrange
  const input = `file rain
 size 28
 digits 321 4324
 open true
 temp 32.1
 description Lorem ipsum, unless ipsum lorem.
 edits
  0
   data Test
  1
   data Test2
 account
  balance 24
  transactions 32
  source no http://www.foo.foo 32
file test
 digits 321 435
 size 3
 description None.
 open false
 temp 32.0
 account
  balance 32.12
  transactions 321
  source yes http://to.to.to 31`

  // Act
  const types = new UnknownGrammarProgram(input).getPredictedGrammarFile("foobar")

  // Assert
  equal(types, readFileSync(__dirname + "/unknownGrammar.expected.grammar", "utf8"), "predicted grammar correct")
}

/*NODE_JS_ONLY*/ if (!module.parent) new TestTreeRunner().run(testTree)

export { testTree }