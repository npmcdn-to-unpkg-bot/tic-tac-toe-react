/* */ 
"use strict";
var _interopRequireDefault = require('babel-runtime/helpers/interop-require-default')["default"];
exports.__esModule = true;
var _xhtml = require('./xhtml');
var _xhtml2 = _interopRequireDefault(_xhtml);
var _tokenizerTypes = require('../../tokenizer/types');
var _tokenizerContext = require('../../tokenizer/context');
var _parser = require('../../parser/index');
var _parser2 = _interopRequireDefault(_parser);
var _utilIdentifier = require('../../util/identifier');
var _utilWhitespace = require('../../util/whitespace');
var HEX_NUMBER = /^[\da-fA-F]+$/;
var DECIMAL_NUMBER = /^\d+$/;
_tokenizerContext.types.j_oTag = new _tokenizerContext.TokContext("<tag", false);
_tokenizerContext.types.j_cTag = new _tokenizerContext.TokContext("</tag", false);
_tokenizerContext.types.j_expr = new _tokenizerContext.TokContext("<tag>...</tag>", true, true);
_tokenizerTypes.types.jsxName = new _tokenizerTypes.TokenType("jsxName");
_tokenizerTypes.types.jsxText = new _tokenizerTypes.TokenType("jsxText", {beforeExpr: true});
_tokenizerTypes.types.jsxTagStart = new _tokenizerTypes.TokenType("jsxTagStart");
_tokenizerTypes.types.jsxTagEnd = new _tokenizerTypes.TokenType("jsxTagEnd");
_tokenizerTypes.types.jsxTagStart.updateContext = function() {
  this.state.context.push(_tokenizerContext.types.j_expr);
  this.state.context.push(_tokenizerContext.types.j_oTag);
  this.state.exprAllowed = false;
};
_tokenizerTypes.types.jsxTagEnd.updateContext = function(prevType) {
  var out = this.state.context.pop();
  if (out === _tokenizerContext.types.j_oTag && prevType === _tokenizerTypes.types.slash || out === _tokenizerContext.types.j_cTag) {
    this.state.context.pop();
    this.state.exprAllowed = this.curContext() === _tokenizerContext.types.j_expr;
  } else {
    this.state.exprAllowed = true;
  }
};
var pp = _parser2["default"].prototype;
pp.jsxReadToken = function() {
  var out = "";
  var chunkStart = this.state.pos;
  for (; ; ) {
    if (this.state.pos >= this.input.length) {
      this.raise(this.state.start, "Unterminated JSX contents");
    }
    var ch = this.input.charCodeAt(this.state.pos);
    switch (ch) {
      case 60:
      case 123:
        if (this.state.pos === this.state.start) {
          if (ch === 60 && this.state.exprAllowed) {
            ++this.state.pos;
            return this.finishToken(_tokenizerTypes.types.jsxTagStart);
          }
          return this.getTokenFromCode(ch);
        }
        out += this.input.slice(chunkStart, this.state.pos);
        return this.finishToken(_tokenizerTypes.types.jsxText, out);
      case 38:
        out += this.input.slice(chunkStart, this.state.pos);
        out += this.jsxReadEntity();
        chunkStart = this.state.pos;
        break;
      default:
        if (_utilWhitespace.isNewLine(ch)) {
          out += this.input.slice(chunkStart, this.state.pos);
          out += this.jsxReadNewLine(true);
          chunkStart = this.state.pos;
        } else {
          ++this.state.pos;
        }
    }
  }
};
pp.jsxReadNewLine = function(normalizeCRLF) {
  var ch = this.input.charCodeAt(this.state.pos);
  var out = undefined;
  ++this.state.pos;
  if (ch === 13 && this.input.charCodeAt(this.state.pos) === 10) {
    ++this.state.pos;
    out = normalizeCRLF ? "\n" : "\r\n";
  } else {
    out = String.fromCharCode(ch);
  }
  ++this.state.curLine;
  this.state.lineStart = this.state.pos;
  return out;
};
pp.jsxReadString = function(quote) {
  var out = "";
  var chunkStart = ++this.state.pos;
  for (; ; ) {
    if (this.state.pos >= this.input.length) {
      this.raise(this.state.start, "Unterminated string constant");
    }
    var ch = this.input.charCodeAt(this.state.pos);
    if (ch === quote)
      break;
    if (ch === 38) {
      out += this.input.slice(chunkStart, this.state.pos);
      out += this.jsxReadEntity();
      chunkStart = this.state.pos;
    } else if (_utilWhitespace.isNewLine(ch)) {
      out += this.input.slice(chunkStart, this.state.pos);
      out += this.jsxReadNewLine(false);
      chunkStart = this.state.pos;
    } else {
      ++this.state.pos;
    }
  }
  out += this.input.slice(chunkStart, this.state.pos++);
  return this.finishToken(_tokenizerTypes.types.string, out);
};
pp.jsxReadEntity = function() {
  var str = "";
  var count = 0;
  var entity = undefined;
  var ch = this.input[this.state.pos];
  var startPos = ++this.state.pos;
  while (this.state.pos < this.input.length && count++ < 10) {
    ch = this.input[this.state.pos++];
    if (ch === ";") {
      if (str[0] === "#") {
        if (str[1] === "x") {
          str = str.substr(2);
          if (HEX_NUMBER.test(str))
            entity = String.fromCharCode(parseInt(str, 16));
        } else {
          str = str.substr(1);
          if (DECIMAL_NUMBER.test(str))
            entity = String.fromCharCode(parseInt(str, 10));
        }
      } else {
        entity = _xhtml2["default"][str];
      }
      break;
    }
    str += ch;
  }
  if (!entity) {
    this.state.pos = startPos;
    return "&";
  }
  return entity;
};
pp.jsxReadWord = function() {
  var ch = undefined;
  var start = this.state.pos;
  do {
    ch = this.input.charCodeAt(++this.state.pos);
  } while (_utilIdentifier.isIdentifierChar(ch) || ch === 45);
  return this.finishToken(_tokenizerTypes.types.jsxName, this.input.slice(start, this.state.pos));
};
function getQualifiedJSXName(object) {
  if (object.type === "JSXIdentifier") {
    return object.name;
  }
  if (object.type === "JSXNamespacedName") {
    return object.namespace.name + ":" + object.name.name;
  }
  if (object.type === "JSXMemberExpression") {
    return getQualifiedJSXName(object.object) + "." + getQualifiedJSXName(object.property);
  }
}
pp.jsxParseIdentifier = function() {
  var node = this.startNode();
  if (this.match(_tokenizerTypes.types.jsxName)) {
    node.name = this.state.value;
  } else if (this.state.type.keyword) {
    node.name = this.state.type.keyword;
  } else {
    this.unexpected();
  }
  this.next();
  return this.finishNode(node, "JSXIdentifier");
};
pp.jsxParseNamespacedName = function() {
  var startPos = this.state.start,
      startLoc = this.state.startLoc;
  var name = this.jsxParseIdentifier();
  if (!this.eat(_tokenizerTypes.types.colon))
    return name;
  var node = this.startNodeAt(startPos, startLoc);
  node.namespace = name;
  node.name = this.jsxParseIdentifier();
  return this.finishNode(node, "JSXNamespacedName");
};
pp.jsxParseElementName = function() {
  var startPos = this.state.start,
      startLoc = this.state.startLoc;
  var node = this.jsxParseNamespacedName();
  while (this.eat(_tokenizerTypes.types.dot)) {
    var newNode = this.startNodeAt(startPos, startLoc);
    newNode.object = node;
    newNode.property = this.jsxParseIdentifier();
    node = this.finishNode(newNode, "JSXMemberExpression");
  }
  return node;
};
pp.jsxParseAttributeValue = function() {
  var node = undefined;
  switch (this.state.type) {
    case _tokenizerTypes.types.braceL:
      node = this.jsxParseExpressionContainer();
      if (node.expression.type === "JSXEmptyExpression") {
        this.raise(node.start, "JSX attributes must only be assigned a non-empty expression");
      } else {
        return node;
      }
    case _tokenizerTypes.types.jsxTagStart:
    case _tokenizerTypes.types.string:
      node = this.parseExprAtom();
      node.extra = null;
      return node;
    default:
      this.raise(this.state.start, "JSX value should be either an expression or a quoted JSX text");
  }
};
pp.jsxParseEmptyExpression = function() {
  var node = this.startNodeAt(this.lastTokEnd, this.lastTokEndLoc);
  return this.finishNodeAt(node, "JSXEmptyExpression", this.start, this.startLoc);
};
pp.jsxParseExpressionContainer = function() {
  var node = this.startNode();
  this.next();
  if (this.match(_tokenizerTypes.types.braceR)) {
    node.expression = this.jsxParseEmptyExpression();
  } else {
    node.expression = this.parseExpression();
  }
  this.expect(_tokenizerTypes.types.braceR);
  return this.finishNode(node, "JSXExpressionContainer");
};
pp.jsxParseAttribute = function() {
  var node = this.startNode();
  if (this.eat(_tokenizerTypes.types.braceL)) {
    this.expect(_tokenizerTypes.types.ellipsis);
    node.argument = this.parseMaybeAssign();
    this.expect(_tokenizerTypes.types.braceR);
    return this.finishNode(node, "JSXSpreadAttribute");
  }
  node.name = this.jsxParseNamespacedName();
  node.value = this.eat(_tokenizerTypes.types.eq) ? this.jsxParseAttributeValue() : null;
  return this.finishNode(node, "JSXAttribute");
};
pp.jsxParseOpeningElementAt = function(startPos, startLoc) {
  var node = this.startNodeAt(startPos, startLoc);
  node.attributes = [];
  node.name = this.jsxParseElementName();
  while (!this.match(_tokenizerTypes.types.slash) && !this.match(_tokenizerTypes.types.jsxTagEnd)) {
    node.attributes.push(this.jsxParseAttribute());
  }
  node.selfClosing = this.eat(_tokenizerTypes.types.slash);
  this.expect(_tokenizerTypes.types.jsxTagEnd);
  return this.finishNode(node, "JSXOpeningElement");
};
pp.jsxParseClosingElementAt = function(startPos, startLoc) {
  var node = this.startNodeAt(startPos, startLoc);
  node.name = this.jsxParseElementName();
  this.expect(_tokenizerTypes.types.jsxTagEnd);
  return this.finishNode(node, "JSXClosingElement");
};
pp.jsxParseElementAt = function(startPos, startLoc) {
  var node = this.startNodeAt(startPos, startLoc);
  var children = [];
  var openingElement = this.jsxParseOpeningElementAt(startPos, startLoc);
  var closingElement = null;
  if (!openingElement.selfClosing) {
    contents: for (; ; ) {
      switch (this.state.type) {
        case _tokenizerTypes.types.jsxTagStart:
          startPos = this.state.start;
          startLoc = this.state.startLoc;
          this.next();
          if (this.eat(_tokenizerTypes.types.slash)) {
            closingElement = this.jsxParseClosingElementAt(startPos, startLoc);
            break contents;
          }
          children.push(this.jsxParseElementAt(startPos, startLoc));
          break;
        case _tokenizerTypes.types.jsxText:
          children.push(this.parseExprAtom());
          break;
        case _tokenizerTypes.types.braceL:
          children.push(this.jsxParseExpressionContainer());
          break;
        default:
          this.unexpected();
      }
    }
    if (getQualifiedJSXName(closingElement.name) !== getQualifiedJSXName(openingElement.name)) {
      this.raise(closingElement.start, "Expected corresponding JSX closing tag for <" + getQualifiedJSXName(openingElement.name) + ">");
    }
  }
  node.openingElement = openingElement;
  node.closingElement = closingElement;
  node.children = children;
  if (this.match(_tokenizerTypes.types.relational) && this.state.value === "<") {
    this.raise(this.state.start, "Adjacent JSX elements must be wrapped in an enclosing tag");
  }
  return this.finishNode(node, "JSXElement");
};
pp.jsxParseElement = function() {
  var startPos = this.state.start,
      startLoc = this.state.startLoc;
  this.next();
  return this.jsxParseElementAt(startPos, startLoc);
};
exports["default"] = function(instance) {
  instance.extend("parseExprAtom", function(inner) {
    return function(refShortHandDefaultPos) {
      if (this.match(_tokenizerTypes.types.jsxText)) {
        var node = this.parseLiteral(this.state.value, "JSXText");
        node.extra = null;
        return node;
      } else if (this.match(_tokenizerTypes.types.jsxTagStart)) {
        return this.jsxParseElement();
      } else {
        return inner.call(this, refShortHandDefaultPos);
      }
    };
  });
  instance.extend("readToken", function(inner) {
    return function(code) {
      var context = this.curContext();
      if (context === _tokenizerContext.types.j_expr) {
        return this.jsxReadToken();
      }
      if (context === _tokenizerContext.types.j_oTag || context === _tokenizerContext.types.j_cTag) {
        if (_utilIdentifier.isIdentifierStart(code)) {
          return this.jsxReadWord();
        }
        if (code === 62) {
          ++this.state.pos;
          return this.finishToken(_tokenizerTypes.types.jsxTagEnd);
        }
        if ((code === 34 || code === 39) && context === _tokenizerContext.types.j_oTag) {
          return this.jsxReadString(code);
        }
      }
      if (code === 60 && this.state.exprAllowed) {
        ++this.state.pos;
        return this.finishToken(_tokenizerTypes.types.jsxTagStart);
      }
      return inner.call(this, code);
    };
  });
  instance.extend("updateContext", function(inner) {
    return function(prevType) {
      if (this.match(_tokenizerTypes.types.braceL)) {
        var curContext = this.curContext();
        if (curContext === _tokenizerContext.types.j_oTag) {
          this.state.context.push(_tokenizerContext.types.b_expr);
        } else if (curContext === _tokenizerContext.types.j_expr) {
          this.state.context.push(_tokenizerContext.types.b_tmpl);
        } else {
          inner.call(this, prevType);
        }
        this.state.exprAllowed = true;
      } else if (this.match(_tokenizerTypes.types.slash) && prevType === _tokenizerTypes.types.jsxTagStart) {
        this.state.context.length -= 2;
        this.state.context.push(_tokenizerContext.types.j_cTag);
        this.state.exprAllowed = false;
      } else {
        return inner.call(this, prevType);
      }
    };
  });
};
module.exports = exports["default"];
