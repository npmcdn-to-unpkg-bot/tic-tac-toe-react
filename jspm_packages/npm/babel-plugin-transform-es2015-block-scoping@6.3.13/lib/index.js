/* */ 
"use strict";
var _classCallCheck = require('babel-runtime/helpers/class-call-check')["default"];
var _Object$create = require('babel-runtime/core-js/object/create')["default"];
var _Symbol = require('babel-runtime/core-js/symbol')["default"];
var _interopRequireDefault = require('babel-runtime/helpers/interop-require-default')["default"];
var _interopRequireWildcard = require('babel-runtime/helpers/interop-require-wildcard')["default"];
exports.__esModule = true;
var _babelTraverse = require('babel-traverse');
var _babelTraverse2 = _interopRequireDefault(_babelTraverse);
var _tdz = require('./tdz');
var _babelTypes = require('babel-types');
var t = _interopRequireWildcard(_babelTypes);
var _lodashObjectValues = require('lodash/object/values');
var _lodashObjectValues2 = _interopRequireDefault(_lodashObjectValues);
var _lodashObjectExtend = require('lodash/object/extend');
var _lodashObjectExtend2 = _interopRequireDefault(_lodashObjectExtend);
var _babelTemplate = require('babel-template');
var _babelTemplate2 = _interopRequireDefault(_babelTemplate);
exports["default"] = function() {
  return {visitor: {
      VariableDeclaration: function VariableDeclaration(path, file) {
        var node = path.node;
        var parent = path.parent;
        var scope = path.scope;
        if (!isBlockScoped(node))
          return;
        convertBlockScopedToVar(node, parent, scope);
        if (node._tdzThis) {
          var nodes = [node];
          for (var i = 0; i < node.declarations.length; i++) {
            var decl = node.declarations[i];
            if (decl.init) {
              var assign = t.assignmentExpression("=", decl.id, decl.init);
              assign._ignoreBlockScopingTDZ = true;
              nodes.push(t.expressionStatement(assign));
            }
            decl.init = file.addHelper("temporalUndefined");
          }
          node._blockHoist = 2;
          if (path.isCompletionRecord()) {
            nodes.push(t.expressionStatement(scope.buildUndefinedNode()));
          }
          path.replaceWithMultiple(nodes);
        }
      },
      Loop: function Loop(path, file) {
        var node = path.node;
        var parent = path.parent;
        var scope = path.scope;
        t.ensureBlock(node);
        var blockScoping = new BlockScoping(path, path.get("body"), parent, scope, file);
        var replace = blockScoping.run();
        if (replace)
          path.replaceWith(replace);
      },
      "BlockStatement|Program": function BlockStatementProgram(path, file) {
        if (!t.isLoop(path.parent)) {
          var blockScoping = new BlockScoping(null, path, path.parent, path.scope, file);
          blockScoping.run();
        }
      }
    }};
};
var buildRetCheck = _babelTemplate2["default"]("\n  if (typeof RETURN === \"object\") return RETURN.v;\n");
function isBlockScoped(node) {
  if (!t.isVariableDeclaration(node))
    return false;
  if (node[t.BLOCK_SCOPED_SYMBOL])
    return true;
  if (node.kind !== "let" && node.kind !== "const")
    return false;
  return true;
}
function convertBlockScopedToVar(node, parent, scope) {
  if (!t.isFor(parent)) {
    for (var i = 0; i < node.declarations.length; i++) {
      var declar = node.declarations[i];
      declar.init = declar.init || scope.buildUndefinedNode();
    }
  }
  node[t.BLOCK_SCOPED_SYMBOL] = true;
  node.kind = "var";
}
function isVar(node) {
  return t.isVariableDeclaration(node, {kind: "var"}) && !isBlockScoped(node);
}
function replace(path, node, scope, remaps) {
  var remap = remaps[node.name];
  if (!remap)
    return;
  var ownBinding = scope.getBindingIdentifier(node.name);
  if (ownBinding === remap.binding) {
    node.name = remap.uid;
  } else {
    if (path)
      path.skip();
  }
}
var replaceVisitor = {
  ReferencedIdentifier: function ReferencedIdentifier(path, remaps) {
    replace(path, path.node, path.scope, remaps);
  },
  AssignmentExpression: function AssignmentExpression(path, remaps) {
    var ids = path.getBindingIdentifiers();
    for (var _name in ids) {
      replace(null, ids[_name], path.scope, remaps);
    }
  }
};
function traverseReplace(node, parent, scope, remaps) {
  if (t.isIdentifier(node)) {
    replace(node, parent, scope, remaps);
  }
  if (t.isAssignmentExpression(node)) {
    var ids = t.getBindingIdentifiers(node);
    for (var _name2 in ids) {
      replace(ids[_name2], parent, scope, remaps);
    }
  }
  scope.traverse(node, replaceVisitor, remaps);
}
var letReferenceBlockVisitor = _babelTraverse2["default"].visitors.merge([{Function: function Function(path, state) {
    path.traverse(letReferenceFunctionVisitor, state);
    return path.skip();
  }}, _tdz.visitor]);
var letReferenceFunctionVisitor = _babelTraverse2["default"].visitors.merge([{ReferencedIdentifier: function ReferencedIdentifier(path, state) {
    var ref = state.letReferences[path.node.name];
    if (!ref)
      return;
    var localBinding = path.scope.getBindingIdentifier(path.node.name);
    if (localBinding && localBinding !== ref)
      return;
    state.closurify = true;
  }}, _tdz.visitor]);
var hoistVarDeclarationsVisitor = {enter: function enter(path, self) {
    var node = path.node;
    var parent = path.parent;
    if (path.isForStatement()) {
      if (isVar(node.init, node)) {
        var nodes = self.pushDeclar(node.init);
        if (nodes.length === 1) {
          node.init = nodes[0];
        } else {
          node.init = t.sequenceExpression(nodes);
        }
      }
    } else if (path.isFor()) {
      if (isVar(node.left, node)) {
        self.pushDeclar(node.left);
        node.left = node.left.declarations[0].id;
      }
    } else if (isVar(node, parent)) {
      path.replaceWithMultiple(self.pushDeclar(node).map(function(expr) {
        return t.expressionStatement(expr);
      }));
    } else if (path.isFunction()) {
      return path.skip();
    }
  }};
var loopLabelVisitor = {LabeledStatement: function LabeledStatement(_ref, state) {
    var node = _ref.node;
    state.innerLabels.push(node.label.name);
  }};
var continuationVisitor = {enter: function enter(path, state) {
    if (path.isAssignmentExpression() || path.isUpdateExpression()) {
      var bindings = path.getBindingIdentifiers();
      for (var _name3 in bindings) {
        if (state.outsideReferences[_name3] !== path.scope.getBindingIdentifier(_name3))
          continue;
        state.reassignments[_name3] = true;
      }
    }
  }};
function loopNodeTo(node) {
  if (t.isBreakStatement(node)) {
    return "break";
  } else if (t.isContinueStatement(node)) {
    return "continue";
  }
}
var loopVisitor = {
  Loop: function Loop(path, state) {
    var oldIgnoreLabeless = state.ignoreLabeless;
    state.ignoreLabeless = true;
    path.traverse(loopVisitor, state);
    state.ignoreLabeless = oldIgnoreLabeless;
    path.skip();
  },
  Function: function Function(path) {
    path.skip();
  },
  SwitchCase: function SwitchCase(path, state) {
    var oldInSwitchCase = state.inSwitchCase;
    state.inSwitchCase = true;
    path.traverse(loopVisitor, state);
    state.inSwitchCase = oldInSwitchCase;
    path.skip();
  },
  "BreakStatement|ContinueStatement|ReturnStatement": function BreakStatementContinueStatementReturnStatement(path, state) {
    var node = path.node;
    var parent = path.parent;
    var scope = path.scope;
    if (node[this.LOOP_IGNORE])
      return;
    var replace = undefined;
    var loopText = loopNodeTo(node);
    if (loopText) {
      if (node.label) {
        if (state.innerLabels.indexOf(node.label.name) >= 0) {
          return;
        }
        loopText = loopText + "|" + node.label.name;
      } else {
        if (state.ignoreLabeless)
          return;
        if (state.inSwitchCase)
          return;
        if (t.isBreakStatement(node) && t.isSwitchCase(parent))
          return;
      }
      state.hasBreakContinue = true;
      state.map[loopText] = node;
      replace = t.stringLiteral(loopText);
    }
    if (path.isReturnStatement()) {
      state.hasReturn = true;
      replace = t.objectExpression([t.objectProperty(t.identifier("v"), node.argument || scope.buildUndefinedNode())]);
    }
    if (replace) {
      replace = t.returnStatement(replace);
      replace[this.LOOP_IGNORE] = true;
      path.skip();
      path.replaceWith(t.inherits(replace, node));
    }
  }
};
var BlockScoping = (function() {
  function BlockScoping(loopPath, blockPath, parent, scope, file) {
    _classCallCheck(this, BlockScoping);
    this.parent = parent;
    this.scope = scope;
    this.file = file;
    this.blockPath = blockPath;
    this.block = blockPath.node;
    this.outsideLetReferences = _Object$create(null);
    this.hasLetReferences = false;
    this.letReferences = _Object$create(null);
    this.body = [];
    if (loopPath) {
      this.loopParent = loopPath.parent;
      this.loopLabel = t.isLabeledStatement(this.loopParent) && this.loopParent.label;
      this.loopPath = loopPath;
      this.loop = loopPath.node;
    }
  }
  BlockScoping.prototype.run = function run() {
    var block = this.block;
    if (block._letDone)
      return;
    block._letDone = true;
    var needsClosure = this.getLetReferences();
    if (t.isFunction(this.parent) || t.isProgram(this.block))
      return;
    if (!this.hasLetReferences)
      return;
    if (needsClosure) {
      this.wrapClosure();
    } else {
      this.remap();
    }
    if (this.loopLabel && !t.isLabeledStatement(this.loopParent)) {
      return t.labeledStatement(this.loopLabel, this.loop);
    }
  };
  BlockScoping.prototype.remap = function remap() {
    var hasRemaps = false;
    var letRefs = this.letReferences;
    var scope = this.scope;
    var remaps = _Object$create(null);
    for (var key in letRefs) {
      var ref = letRefs[key];
      if (scope.parentHasBinding(key) || scope.hasGlobal(key)) {
        var uid = scope.generateUidIdentifier(ref.name).name;
        ref.name = uid;
        hasRemaps = true;
        remaps[key] = remaps[uid] = {
          binding: ref,
          uid: uid
        };
      }
    }
    if (!hasRemaps)
      return;
    var loop = this.loop;
    if (loop) {
      traverseReplace(loop.right, loop, scope, remaps);
      traverseReplace(loop.test, loop, scope, remaps);
      traverseReplace(loop.update, loop, scope, remaps);
    }
    this.blockPath.traverse(replaceVisitor, remaps);
  };
  BlockScoping.prototype.wrapClosure = function wrapClosure() {
    var block = this.block;
    var outsideRefs = this.outsideLetReferences;
    if (this.loop) {
      for (var _name4 in outsideRefs) {
        var id = outsideRefs[_name4];
        if (this.scope.hasGlobal(id.name) || this.scope.parentHasBinding(id.name)) {
          delete outsideRefs[id.name];
          delete this.letReferences[id.name];
          this.scope.rename(id.name);
          this.letReferences[id.name] = id;
          outsideRefs[id.name] = id;
        }
      }
    }
    this.has = this.checkLoop();
    this.hoistVarDeclarations();
    var params = _lodashObjectValues2["default"](outsideRefs);
    var args = _lodashObjectValues2["default"](outsideRefs);
    var fn = t.functionExpression(null, params, t.blockStatement(block.body));
    fn.shadow = true;
    this.addContinuations(fn);
    block.body = this.body;
    var ref = fn;
    if (this.loop) {
      ref = this.scope.generateUidIdentifier("loop");
      this.loopPath.insertBefore(t.variableDeclaration("var", [t.variableDeclarator(ref, fn)]));
    }
    var call = t.callExpression(ref, args);
    var ret = this.scope.generateUidIdentifier("ret");
    var hasYield = _babelTraverse2["default"].hasType(fn.body, this.scope, "YieldExpression", t.FUNCTION_TYPES);
    if (hasYield) {
      fn.generator = true;
      call = t.yieldExpression(call, true);
    }
    var hasAsync = _babelTraverse2["default"].hasType(fn.body, this.scope, "AwaitExpression", t.FUNCTION_TYPES);
    if (hasAsync) {
      fn.async = true;
      call = t.awaitExpression(call);
    }
    this.buildClosure(ret, call);
  };
  BlockScoping.prototype.buildClosure = function buildClosure(ret, call) {
    var has = this.has;
    if (has.hasReturn || has.hasBreakContinue) {
      this.buildHas(ret, call);
    } else {
      this.body.push(t.expressionStatement(call));
    }
  };
  BlockScoping.prototype.addContinuations = function addContinuations(fn) {
    var state = {
      reassignments: {},
      outsideReferences: this.outsideLetReferences
    };
    this.scope.traverse(fn, continuationVisitor, state);
    for (var i = 0; i < fn.params.length; i++) {
      var param = fn.params[i];
      if (!state.reassignments[param.name])
        continue;
      var newParam = this.scope.generateUidIdentifier(param.name);
      fn.params[i] = newParam;
      this.scope.rename(param.name, newParam.name, fn);
      fn.body.body.push(t.expressionStatement(t.assignmentExpression("=", param, newParam)));
    }
  };
  BlockScoping.prototype.getLetReferences = function getLetReferences() {
    var block = this.block;
    var declarators = [];
    if (this.loop) {
      var init = this.loop.left || this.loop.init;
      if (isBlockScoped(init)) {
        declarators.push(init);
        _lodashObjectExtend2["default"](this.outsideLetReferences, t.getBindingIdentifiers(init));
      }
    }
    if (block.body) {
      for (var i = 0; i < block.body.length; i++) {
        var declar = block.body[i];
        if (t.isClassDeclaration(declar) || t.isFunctionDeclaration(declar) || isBlockScoped(declar)) {
          if (isBlockScoped(declar))
            convertBlockScopedToVar(declar, block, this.scope);
          declarators = declarators.concat(declar.declarations || declar);
        }
      }
    }
    for (var i = 0; i < declarators.length; i++) {
      var declar = declarators[i];
      var keys = t.getBindingIdentifiers(declar);
      _lodashObjectExtend2["default"](this.letReferences, keys);
      this.hasLetReferences = true;
    }
    if (!this.hasLetReferences)
      return;
    var state = {
      letReferences: this.letReferences,
      closurify: false,
      file: this.file
    };
    this.blockPath.traverse(letReferenceBlockVisitor, state);
    return state.closurify;
  };
  BlockScoping.prototype.checkLoop = function checkLoop() {
    var state = {
      hasBreakContinue: false,
      ignoreLabeless: false,
      inSwitchCase: false,
      innerLabels: [],
      hasReturn: false,
      isLoop: !!this.loop,
      map: {},
      LOOP_IGNORE: _Symbol()
    };
    this.blockPath.traverse(loopLabelVisitor, state);
    this.blockPath.traverse(loopVisitor, state);
    return state;
  };
  BlockScoping.prototype.hoistVarDeclarations = function hoistVarDeclarations() {
    this.blockPath.traverse(hoistVarDeclarationsVisitor, this);
  };
  BlockScoping.prototype.pushDeclar = function pushDeclar(node) {
    var declars = [];
    var names = t.getBindingIdentifiers(node);
    for (var _name5 in names) {
      declars.push(t.variableDeclarator(names[_name5]));
    }
    this.body.push(t.variableDeclaration(node.kind, declars));
    var replace = [];
    for (var i = 0; i < node.declarations.length; i++) {
      var declar = node.declarations[i];
      if (!declar.init)
        continue;
      var expr = t.assignmentExpression("=", declar.id, declar.init);
      replace.push(t.inherits(expr, declar));
    }
    return replace;
  };
  BlockScoping.prototype.buildHas = function buildHas(ret, call) {
    var body = this.body;
    body.push(t.variableDeclaration("var", [t.variableDeclarator(ret, call)]));
    var retCheck = undefined;
    var has = this.has;
    var cases = [];
    if (has.hasReturn) {
      retCheck = buildRetCheck({RETURN: ret});
    }
    if (has.hasBreakContinue) {
      for (var key in has.map) {
        cases.push(t.switchCase(t.stringLiteral(key), [has.map[key]]));
      }
      if (has.hasReturn) {
        cases.push(t.switchCase(null, [retCheck]));
      }
      if (cases.length === 1) {
        var single = cases[0];
        body.push(t.ifStatement(t.binaryExpression("===", ret, single.test), single.consequent[0]));
      } else {
        for (var i = 0; i < cases.length; i++) {
          var caseConsequent = cases[i].consequent[0];
          if (t.isBreakStatement(caseConsequent) && !caseConsequent.label) {
            caseConsequent.label = this.loopLabel = this.loopLabel || this.scope.generateUidIdentifier("loop");
          }
        }
        body.push(t.switchStatement(ret, cases));
      }
    } else {
      if (has.hasReturn) {
        body.push(retCheck);
      }
    }
  };
  return BlockScoping;
})();
module.exports = exports["default"];
