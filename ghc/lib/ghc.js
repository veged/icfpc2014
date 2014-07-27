#!/usr/bin/env node
var phi = require('phi.js');
var linearscan = require('linearscan');

var Preparser = require('./preparser').Preparser;

function Compiler(source) {
  this.source = source;
  this.blocks = null;
}
exports.Compiler = Compiler;

Compiler.prototype.compile = function compile() {
  var p = new Preparser(this.source);
  this.blocks = p.preparse();

  console.log(this.blocks);
  return null;
};
