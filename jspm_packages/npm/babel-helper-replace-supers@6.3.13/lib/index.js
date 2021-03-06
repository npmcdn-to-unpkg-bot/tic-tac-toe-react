/* */ 
"use strict";

var _classCallCheck = require("babel-runtime/helpers/class-call-check")["default"];

var _Symbol = require("babel-runtime/core-js/symbol")["default"];

var _interopRequireDefault = require("babel-runtime/helpers/interop-require-default")["default"];

var _interopRequireWildcard = require("babel-runtime/helpers/interop-require-wildcard")["default"];

exports.__esModule = true;

var _babelHelperOptimiseCallExpression = require("babel-helper-optimise-call-expression");

var _babelHelperOptimiseCallExpression2 = _interopRequireDefault(_babelHelperOptimiseCallExpression);

var _babelMessages = require("babel-messages");

var messages = _interopRequireWildcard(_babelMessages);

var _babelTypes = require("babel-types");

var t = _interopRequireWildcard(_babelTypes);

// ✌️

/*:: import type { NodePath, Scope } from "babel-traverse";*/var HARDCORE_THIS_REF = _Symbol();

function isIllegalBareSuper(node, parent) {
  if (!t.isSuper(node)) return false;
  if (t.isMemberExpression(parent, { computed: false })) return false;
  if (t.isCallExpression(parent, { callee: node })) return false;
  return true;
}

function isMemberExpressionSuper(node) {
  return t.isMemberExpression(node) && t.isSuper(node.object);
}

var visitor = {
  "ObjectMethod|ClassMethod": function ObjectMethodClassMethod(path) {
    path.skip();
  },

  "FunctionDeclaration|FunctionExpression": function FunctionDeclarationFunctionExpression(path) {
    if (!path.inShadow("this")) {
      path.skip();
    }
  },

  ReturnStatement: function ReturnStatement(path, state) {
    if (!path.inShadow("this")) {
      state.returns.push(path);
    }
  },

  ThisExpression: function ThisExpression(path, state) {
    if (!path.node[HARDCORE_THIS_REF]) {
      state.thises.push(path);
    }
  },

  enter: function enter(path, state) {
    var callback = state.specHandle;
    if (state.isLoose) callback = state.looseHandle;

    var isBareSuper = path.isCallExpression() && path.get("callee").isSuper();

    var result = callback.call(state, path);

    if (result) {
      state.hasSuper = true;
    }

    if (isBareSuper) {
      state.bareSupers.push(path);
    }

    if (result === true) {
      path.requeue();
    }

    if (result !== true && result) {
      if (Array.isArray(result)) {
        path.replaceWithMultiple(result);
      } else {
        path.replaceWith(result);
      }
    }
  }
};

var ReplaceSupers = (function () {
  function ReplaceSupers(opts /*: Object*/) {
    var inClass /*:: ?: boolean*/ = arguments.length <= 1 || arguments[1] === undefined ? false : arguments[1];

    _classCallCheck(this, ReplaceSupers);

    this.forceSuperMemoisation = opts.forceSuperMemoisation;
    this.methodPath = opts.methodPath;
    this.methodNode = opts.methodNode;
    this.superRef = opts.superRef;
    this.isStatic = opts.isStatic;
    this.hasSuper = false;
    this.inClass = inClass;
    this.isLoose = opts.isLoose;
    this.scope = this.methodPath.scope;
    this.file = opts.file;
    this.opts = opts;

    this.bareSupers = [];
    this.returns = [];
    this.thises = [];
  }

  ReplaceSupers.prototype.getObjectRef = function getObjectRef() {
    return this.opts.objectRef || this.opts.getObjectRef();
  };

  /**
   * Sets a super class value of the named property.
   *
   * @example
   *
   *   _set(Object.getPrototypeOf(CLASS.prototype), "METHOD", "VALUE", this)
   *
   */

  ReplaceSupers.prototype.setSuperProperty = function setSuperProperty(property /*: Object*/, value /*: Object*/, isComputed /*: boolean*/) /*: Object*/ {
    return t.callExpression(this.file.addHelper("set"), [t.callExpression(t.memberExpression(t.identifier("Object"), t.identifier("getPrototypeOf")), [this.isStatic ? this.getObjectRef() : t.memberExpression(this.getObjectRef(), t.identifier("prototype"))]), isComputed ? property : t.stringLiteral(property.name), value, t.thisExpression()]);
  };

  /**
   * Gets a node representing the super class value of the named property.
   *
   * @example
   *
   *   _get(Object.getPrototypeOf(CLASS.prototype), "METHOD", this)
   *
   */

  ReplaceSupers.prototype.getSuperProperty = function getSuperProperty(property /*: Object*/, isComputed /*: boolean*/) /*: Object*/ {
    return t.callExpression(this.file.addHelper("get"), [t.callExpression(t.memberExpression(t.identifier("Object"), t.identifier("getPrototypeOf")), [this.isStatic ? this.getObjectRef() : t.memberExpression(this.getObjectRef(), t.identifier("prototype"))]), isComputed ? property : t.stringLiteral(property.name), t.thisExpression()]);
  };

  ReplaceSupers.prototype.replace = function replace() {
    this.methodPath.traverse(visitor, this);
  };

  ReplaceSupers.prototype.getLooseSuperProperty = function getLooseSuperProperty(id /*: Object*/, parent /*: Object*/) {
    var methodNode = this.methodNode;
    var superRef = this.superRef || t.identifier("Function");

    if (parent.property === id) {
      return;
    } else if (t.isCallExpression(parent, { callee: id })) {
      return;
    } else if (t.isMemberExpression(parent) && !methodNode["static"]) {
      // super.test -> objectRef.prototype.test
      return t.memberExpression(superRef, t.identifier("prototype"));
    } else {
      return superRef;
    }
  };

  ReplaceSupers.prototype.looseHandle = function looseHandle(path /*: NodePath*/) {
    var node = path.node;
    if (path.isSuper()) {
      return this.getLooseSuperProperty(node, path.parent);
    } else if (path.isCallExpression()) {
      var callee = node.callee;
      if (!t.isMemberExpression(callee)) return;
      if (!t.isSuper(callee.object)) return;

      // super.test(); -> objectRef.prototype.MethodName.call(this);
      t.appendToMemberExpression(callee, t.identifier("call"));
      node.arguments.unshift(t.thisExpression());
      return true;
    }
  };

  ReplaceSupers.prototype.specHandleAssignmentExpression = function specHandleAssignmentExpression(ref, path, node) {
    if (node.operator === "=") {
      // super.name = "val"; -> _set(Object.getPrototypeOf(objectRef.prototype), "name", this);
      return this.setSuperProperty(node.left.property, node.right, node.left.computed);
    } else {
      // super.age += 2; -> let _ref = super.age; super.age = _ref + 2;
      ref = ref || path.scope.generateUidIdentifier("ref");
      return [t.variableDeclaration("var", [t.variableDeclarator(ref, node.left)]), t.expressionStatement(t.assignmentExpression("=", node.left, t.binaryExpression(node.operator[0], ref, node.right)))];
    }
  };

  ReplaceSupers.prototype.specHandle = function specHandle(path /*: NodePath*/) {
    var property = undefined;
    var computed = undefined;
    var args = undefined;
    var thisReference = undefined;

    var parent = path.parent;
    var node = path.node;

    if (isIllegalBareSuper(node, parent)) {
      throw path.buildCodeFrameError(messages.get("classesIllegalBareSuper"));
    }

    if (t.isCallExpression(node)) {
      var callee = node.callee;
      if (t.isSuper(callee)) {
        return;
      } else if (isMemberExpressionSuper(callee)) {
        // super.test(); -> _get(Object.getPrototypeOf(objectRef.prototype), "test", this).call(this);
        property = callee.property;
        computed = callee.computed;
        args = node.arguments;
      }
    } else if (t.isMemberExpression(node) && t.isSuper(node.object)) {
      // super.name; -> _get(Object.getPrototypeOf(objectRef.prototype), "name", this);
      property = node.property;
      computed = node.computed;
    } else if (t.isUpdateExpression(node) && isMemberExpressionSuper(node.argument)) {
      var binary = t.binaryExpression(node.operator[0], node.argument, t.numericLiteral(1));
      if (node.prefix) {
        // ++super.foo; -> super.foo += 1;
        return this.specHandleAssignmentExpression(null, path, binary);
      } else {
        // super.foo++; -> let _ref = super.foo; super.foo = _ref + 1;
        var ref = path.scope.generateUidIdentifier("ref");
        return this.specHandleAssignmentExpression(ref, path, binary).concat(t.expressionStatement(ref));
      }
    } else if (t.isAssignmentExpression(node) && isMemberExpressionSuper(node.left)) {
      return this.specHandleAssignmentExpression(null, path, node);
    }

    if (!property) return;

    var superProperty = this.getSuperProperty(property, computed, thisReference);

    if (args) {
      return this.optimiseCall(superProperty, args);
    } else {
      return superProperty;
    }
  };

  ReplaceSupers.prototype.optimiseCall = function optimiseCall(callee, args) {
    var thisNode = t.thisExpression();
    thisNode[HARDCORE_THIS_REF] = true;
    return _babelHelperOptimiseCallExpression2["default"](callee, thisNode, args);
  };

  return ReplaceSupers;
})();

exports["default"] = ReplaceSupers;
module.exports = exports["default"];