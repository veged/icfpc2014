#!/usr/bin/env node
var phi = require('phi.js');
var linearscan = require('linearscan');
var ir = require('ssa-ir');

var Preparser = require('./preparser').Preparser;

var config = {
  registers: [ 'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h' ],

  instructions: {
    nop: { output: null },
    literal: { output: { type: 'any' }, inputs: [ { type: 'js' } ] },
    hlt: { output: null },
    jgt: { inputs: [ { type: 'any' }, { type: 'any' } ] },
    jlt: { inputs: [ { type: 'any' }, { type: 'any' } ] },
    jeq: { inputs: [ { type: 'any' }, { type: 'any' } ] },
    mov: {
      inputs: [ { type: 'any' } ],
      output: { type: 'any' }
    },
    xor: {
      inputs: [ { type: 'any' }, { type: 'any' } ],
      output: { type: 'any' }
    },
    or: {
      inputs: [ { type: 'any' }, { type: 'any' } ],
      output: { type: 'any' }
    },
    and: {
      inputs: [ { type: 'any' }, { type: 'any' } ],
      output: { type: 'any' }
    },
    div: {
      inputs: [ { type: 'any' }, { type: 'any' } ],
      output: { type: 'any' }
    },
    mul: {
      inputs: [ { type: 'any' }, { type: 'any' } ],
      output: { type: 'any' }
    },
    sub: {
      inputs: [ { type: 'any' }, { type: 'any' } ],
      output: { type: 'any' }
    },
    add: {
      inputs: [ { type: 'any' }, { type: 'any' } ],
      output: { type: 'any' }
    },
    dec: {
      inputs: [ { type: 'any' } ],
      output: { type: 'any' }
    },
    inc: {
      inputs: [ { type: 'any' } ],
      output: { type: 'any' }
    },

    // Interrupts
    setDirection: {
      inputs: [ { type: 'register', id: 'a' } ],
      output: null
    },

    getLambda1_x: {
      output: { type: 'register', id: 'a' }
    },
    getLambda1_y: {
      output: { type: 'register', id: 'b' }
    }
  }
};

var ls = linearscan.create(config);

function Compiler(source) {
  this.source = source;
}
exports.Compiler = Compiler;

Compiler.prototype.compile = function compile() {
  var p = new Preparser(this.source);

  var pressa = p.preparse();
  var ssa = phi.run(pressa);

  return ir.stringify(ls.run(ssa));
};
