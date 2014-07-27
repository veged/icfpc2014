#!/usr/bin/env node
var phi = require('phi.js');
var linearscan = require('linearscan');
var ir = require('ssa-ir');

var Preparser = require('./preparser').Preparser;

var config = {
  registers: [ 'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h' ],

  instructions: {
    // Internals
    nop: { output: null },
    literal: { output: { type: 'any' }, inputs: [ { type: 'js' } ] },
    memset: { inputs: [ { type: 'js' }, { type: 'any' } ], output: null },
    memget: { inputs: [ { type: 'js' } ], output: { type: 'any' } },
    'goto': { output: null },

    // ASM
    hlt: { output: null },
    jgt: { output: null, inputs: [ { type: 'any' }, { type: 'any' } ] },
    jlt: { output: null, inputs: [ { type: 'any' }, { type: 'any' } ] },
    jeq: { output: null, inputs: [ { type: 'any' }, { type: 'any' } ] },
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
    dir: {
      inputs: [ { type: 'register', id: 'a' } ],
      output: null
    },

    lambda1Pos_0: {
      output: { type: 'register', id: 'a' }
    },
    lambda1Pos_1: {
      output: { type: 'register', id: 'b' }
    },

    lambda2Pos_0: {
      output: { type: 'register', id: 'a' }
    },
    lambda2Pos_1: {
      output: { type: 'register', id: 'b' }
    },

    ghostIndex: {
      output: { type: 'register', id: 'a' }
    },

    ghostStartPos_0: {
      inputs: [ { type: 'register', id: 'a' } ],
      output: { type: 'register', id: 'a' }
    },
    ghostStartPos_1: {
      output: { type: 'register', id: 'b' }
    },

    ghostPos_0: {
      inputs: [ { type: 'register', id: 'a' } ],
      output: { type: 'register', id: 'a' }
    },
    ghostPos_1: {
      output: { type: 'register', id: 'b' }
    },

    ghostState_0: {
      inputs: [ { type: 'register', id: 'a' } ],
      output: { type: 'register', id: 'a' }
    },
    ghostState_1: {
      output: { type: 'register', id: 'b' }
    },

    probeMap: {
      inputs: [ { type: 'register', id: 'a' }, { type: 'register', id: 'b' } ],
      output: { type: 'register', id: 'a' }
    },

    debug: {
      output: null
    }
  }
};

var ls = linearscan.create(config);

function Compiler(source) {
  this.source = source;

  this.labels = {};
  this.references = {};
}
exports.Compiler = Compiler;

Compiler.prototype.compile = function compile() {
  var p = new Preparser(this.source);

  var pressa = p.preparse();
  var ssa = phi.run(pressa);
  var reg = ls.run(ssa);
  var out = this.translate(reg);
  console.error(ir.stringify(reg));

  return out;
};

Compiler.prototype.translate = function translate(blocks) {
  var out = [];

  function val(v) {
    if (v.type === 'register')
      return v.id;
    else if (v.type === 'stack')
      return '[' + (254 - v.id) + ']';
    else if (v.type === 'js')
      return v.value;
    else
      throw new Error('Invalid value type: ' + v.type);
  }

  for (var i = 0; i < blocks.length; i++) {
    var block = blocks[i];
    var succ = block.successors[0];

    this.defLabel(block.id, out.length);

    for (var j = 0; j < block.instructions.length; j++) {
      var instr = block.instructions[j];
      if (instr.type === 'nop')
        continue;

      // Deffer moves to the second part of instruction
      if (/_0$/.test(instr.type)) {
        if (!instr.moves)
          instr.moves = [];

        for (var k = j + 1; k < block.instructions.length; k++) {
          var next = block.instructions[k];

          if (next.moves) {
            instr.moves = instr.moves.concat(next.moves);
            next.moves = null;
          }

          if (/_1$/.test(next.type))
            break;
        }
      }

      // Apply moves!
      if (instr.moves) {
        var moves = instr.moves;
        for (var k = 0; k < moves.length; k++) {
          var move = moves[k];
          if (move.type === 'move') {
            out.push([ 'mov', val(move.to), val(move.from) ]);
          } else {
            assert.equal(move.type, 'swap');
            out.push([ 'mov', '[255]', val(move.from) ]);
            out.push([ 'mov', val(move.to), '[255]' ]);
          }
        }
      }

      var output = instr.output;
      var inputs = instr.inputs;

      if (instr.type === 'literal') {
        out.push([ 'mov', val(output), val(inputs[0]) ]);
      } else if (instr.type === 'memset') {
        out.push([ 'mov', '[' + val(inputs[0]) + ']', val(inputs[1]) ]);
      } else if (instr.type === 'memget') {
        out.push([ 'mov', val(output), '[' + val(inputs[0]) + ']' ]);
      } else if (instr.type === 'goto') {
        out.push(this.refLabel(succ, [ 'jeq', null, 0, 0 ], 1));
      } else if (/^j(eq|gt|lt)$/.test(instr.type)) {
        out.push(this.refLabel(succ, [
          instr.type,
          null,
          val(inputs[0]),
          val(inputs[1])
        ], 1));
      } else if (instr.type === 'hlt') {
        out.push([ 'hlt' ]);
      } else if (instr.type === 'mov') {
        if (val(output) !== val(inputs[0]))
          out.push([ 'mov', val(output), val(inputs[0]) ]);
      } else if (instr.type === 'xor' || instr.type === 'or' ||
                 instr.type === 'and' || instr.type === 'div' ||
                 instr.type === 'mul' || instr.type === 'sub' ||
                 instr.type === 'add') {
        if (val(output) !== val(inputs[0]))
          out.push([ 'mov', val(output), val(inputs[0]) ]);
        out.push([ instr.type, val(output), val(inputs[1]) ]);
      } else if (instr.type === 'inc' || instr.type === 'dec') {
        if (val(output) !== val(inputs[0]))
          out.push([ 'mov', val(output), val(inputs[0]) ]);
        out.push([ instr.type, val(output) ]);

      // Interrupts
      } else if (instr.type === 'dir') {
        if (inputs[0].type === 'js')
          out.push([ 'mov', 'a', inputs[0].value ]);
        out.push([ 'int', 0 ]);
      } else if (instr.type === 'lambda1Pos_0') {
        out.push([ 'int', 1 ]);
      } else if (instr.type === 'lambda2Pos_0') {
        out.push([ 'int', 2 ]);
      } else if (instr.type === 'ghostIndex') {
        out.push([ 'int', 3 ]);
      } else if (instr.type === 'ghostStartPos_0') {
        if (inputs[0].type === 'js')
          out.push([ 'mov', 'a', inputs[0].value ]);
        out.push([ 'int', 4 ]);
      } else if (instr.type === 'ghostPos_0') {
        if (inputs[0].type === 'js')
          out.push([ 'mov', 'a', inputs[0].value ]);
        out.push([ 'int', 5 ]);
      } else if (instr.type === 'ghostState_0') {
        if (inputs[0].type === 'js')
          out.push([ 'mov', 'a', inputs[0].value ]);
        out.push([ 'int', 6 ]);
      } else if (instr.type === 'probeMap') {
        if (inputs[0].type === 'js')
          out.push([ 'mov', 'a', inputs[0].value ]);
        if (inputs[1].type === 'js')
          out.push([ 'mov', 'b', inputs[1].value ]);
        out.push([ 'int', 7 ]);
      } else if (instr.type === 'debug') {
        out.push([ 'int', 8 ]);
      }
    }

    var nextBlock = blocks[i + 1];

    if (block.successors.length > 1 &&
        (!nextBlock || block.successors[1] !== nextBlock.id)) {
      out.push(this.refLabel(block.successors[1], [ 'jeq', null, 0, 0 ], 1));
    } else if (block.successors.length === 1 && succ !== nextBlock.id) {
      out.push(this.refLabel(succ, [ 'jeq', null, 0, 0 ], 1));
    }
  }

  return out.map(function(instr) {
    if (instr.length === 1)
      return instr[0];
    else
      return instr[0] + ' ' + instr.slice(1).join(', ');
  }).join('\n');
};

Compiler.prototype.refLabel = function refLabel(label, instr, index) {
  var ex = this.labels[label];
  if (ex === undefined) {
    if (!this.references[label])
      this.references[label] = [];
    this.references[label].push({ instr: instr, index: index });
  } else {
    instr[index] = ex;
  }
  return instr;
};

Compiler.prototype.defLabel = function defLabel(label, pos) {
  this.labels[label] = pos;
  if (this.references[label]) {
    var ref = this.references[label];
    delete this.references[label];

    for (var i = 0; i < ref.length; i++) {
      var r = ref[i];
      r.instr[r.index] = pos;
    }
  }
};
