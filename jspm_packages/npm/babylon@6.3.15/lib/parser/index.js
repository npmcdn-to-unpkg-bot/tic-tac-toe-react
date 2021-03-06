/* */ 
"use strict";
var _inherits = require('babel-runtime/helpers/inherits')["default"];
var _classCallCheck = require('babel-runtime/helpers/class-call-check')["default"];
var _getIterator = require('babel-runtime/core-js/get-iterator')["default"];
var _interopRequireDefault = require('babel-runtime/helpers/interop-require-default')["default"];
exports.__esModule = true;
var _utilIdentifier = require('../util/identifier');
var _options = require('../options');
var _tokenizer = require('../tokenizer/index');
var _tokenizer2 = _interopRequireDefault(_tokenizer);
var plugins = {};
exports.plugins = plugins;
var Parser = (function(_Tokenizer) {
  _inherits(Parser, _Tokenizer);
  function Parser(options, input) {
    _classCallCheck(this, Parser);
    options = _options.getOptions(options);
    _Tokenizer.call(this, options, input);
    this.options = options;
    this.inModule = this.options.sourceType === "module";
    this.isReservedWord = _utilIdentifier.reservedWords[6];
    this.input = input;
    this.plugins = this.loadPlugins(this.options.plugins);
    if (this.state.pos === 0 && this.input[0] === "#" && this.input[1] === "!") {
      this.skipLineComment(2);
    }
  }
  Parser.prototype.hasPlugin = function hasPlugin(name) {
    return !!(this.plugins["*"] || this.plugins[name]);
  };
  Parser.prototype.extend = function extend(name, f) {
    this[name] = f(this[name]);
  };
  Parser.prototype.loadPlugins = function loadPlugins(plugins) {
    var pluginMap = {};
    if (plugins.indexOf("flow") >= 0) {
      plugins.splice(plugins.indexOf("flow"), 1);
      plugins.push("flow");
    }
    for (var _iterator = plugins,
        _isArray = Array.isArray(_iterator),
        _i = 0,
        _iterator = _isArray ? _iterator : _getIterator(_iterator); ; ) {
      var _ref;
      if (_isArray) {
        if (_i >= _iterator.length)
          break;
        _ref = _iterator[_i++];
      } else {
        _i = _iterator.next();
        if (_i.done)
          break;
        _ref = _i.value;
      }
      var _name = _ref;
      pluginMap[_name] = true;
      var plugin = exports.plugins[_name];
      if (plugin)
        plugin(this);
    }
    return pluginMap;
  };
  Parser.prototype.parse = function parse() {
    var file = this.startNode();
    var program = this.startNode();
    this.nextToken();
    return this.parseTopLevel(file, program);
  };
  return Parser;
})(_tokenizer2["default"]);
exports["default"] = Parser;
