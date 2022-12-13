/*
 * 额外测试 parser
 * @Author: lilonglong
 * @Date: 2022-12-07 22:21:57
 * @Last Modified by: lilonglong
 * @Last Modified time: 2022-12-09 15:44:50
 */

import { parse } from "../lib/index.js";

function getParser(code) {
  return () => parse(code, { sourceType: "module" });
}

describe("测试自定义语法 @@ parse -> ast", function () {
  it("should parse", function () {
    expect(getParser(`function @! foo() {}`)()).toMatchSnapshot();
  });
});

// BABEL_ENV=test node_modules/.bin/jest -u packages/babel-parser/test/test-parser.js
