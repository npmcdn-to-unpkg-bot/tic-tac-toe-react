/* */ 
"use strict";
var _interopRequireWildcard = require('babel-runtime/helpers/interop-require-wildcard')["default"];
exports.__esModule = true;
exports.isCompatTag = isCompatTag;
exports.buildChildren = buildChildren;
var _index = require('./index');
var t = _interopRequireWildcard(_index);
var isReactComponent = t.buildMatchMemberExpression("React.Component");
exports.isReactComponent = isReactComponent;
function isCompatTag(tagName) {
  return !!tagName && /^[a-z]|\-/.test(tagName);
}
function cleanJSXElementLiteralChild(child, args) {
  var lines = child.value.split(/\r\n|\n|\r/);
  var lastNonEmptyLine = 0;
  for (var i = 0; i < lines.length; i++) {
    if (lines[i].match(/[^ \t]/)) {
      lastNonEmptyLine = i;
    }
  }
  var str = "";
  for (var i = 0; i < lines.length; i++) {
    var line = lines[i];
    var isFirstLine = i === 0;
    var isLastLine = i === lines.length - 1;
    var isLastNonEmptyLine = i === lastNonEmptyLine;
    var trimmedLine = line.replace(/\t/g, " ");
    if (!isFirstLine) {
      trimmedLine = trimmedLine.replace(/^[ ]+/, "");
    }
    if (!isLastLine) {
      trimmedLine = trimmedLine.replace(/[ ]+$/, "");
    }
    if (trimmedLine) {
      if (!isLastNonEmptyLine) {
        trimmedLine += " ";
      }
      str += trimmedLine;
    }
  }
  if (str)
    args.push(t.stringLiteral(str));
}
function buildChildren(node) {
  var elems = [];
  for (var i = 0; i < node.children.length; i++) {
    var child = node.children[i];
    if (t.isJSXText(child)) {
      cleanJSXElementLiteralChild(child, elems);
      continue;
    }
    if (t.isJSXExpressionContainer(child))
      child = child.expression;
    if (t.isJSXEmptyExpression(child))
      continue;
    elems.push(child);
  }
  return elems;
}
