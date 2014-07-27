var assert = require('assert');

function Preparser(source) {
  this.source = source;

  this.blocks = [];
  this.current = null;
  this.labels = {};
  this.missingLabels = {};

  var root = new Block(this, '_root');
  this.current = root;
  this.blocks.push(root);

  this.instructionId = 0;
}
exports.Preparser = Preparser;

Preparser.prototype.preparse = function preparse() {
  var lines = this.source.split(/[\r\n]/g);

  // Remove comments and empty lines
  lines = lines.map(function(line) {
    return line.replace(/\s*;.*$/g, '').trim();
  }).filter(function(line) {
    return line.length !== 0;
  });

  for (var i = 0; i < lines.length; i++) {
    var line = lines[i];
    var match;

    // Only a label
    match = line.match(/^([\w\d]+)\s*:/i);
    if (match) {
      this.visitLabel(match[1]);

      // Remove label from line
      line = line.slice(match[0].length);
      if (line.length === 0)
        continue;
    }

    // Add instruction
    this.visitInstr(line);
  }

  return this.blocks.map(function(b) { return b.toJSON(); });
};

Preparser.prototype.visitLabel = function visitLabel(name) {
  var b = new Block(this, name);

  // Blocks follow each other
  if (this.current.instructions.length === 0)
    this.current.add('nop', null, [], null);
  this.current.go(b);
  this.current = b;
  this.blocks.push(b);
  this.labels[name] = b;

  if (this.missingLabels[name]) {
    var q = this.missingLabels[name];
    delete this.missingLabels[name];

    for (var i = 0; i < q.length; i++)
      q[i].from.go(b);
  }
};

Preparser.prototype.visitInstr = function visitInstr(instr) {
  var p = instr.match(/^(?:([\w\d_]+)\s*=\s*)?([\w\d]+)\s*([\.\w\d_,\s]*)/i);
  if (!p)
    return;

  var out = p[1];
  var type = p[2];
  var args = p[3].split(/\s*,\s*/g);

  if (p[3].length === 0) {
    args = [];
  } else {
    assert(args.every(function(arg) { return arg.length !== 0 }), 'empty arg');
  }

  // Just a literal
  if (type == (type | 0)) {
    args = [ type ];
    type = 'literal';
  }

  var label = null;
  args = args.filter(function(arg) {
    if (!/^\./.test(arg))
      return true;

    assert(label === null, 'multiple labels in single instruction');
    label = arg.slice(1);

    return false;
  });

  if (out)
    out = { type: 'variable', id: out };
  else
    out = null;

  args = args.map(function(arg) {
    if (/^\d+$/.test(arg))
      return { type: 'js', value: arg | 0 };

    return { type: 'variable', id: arg };
  });

  this.current.add(type, out, args, label);
  if (!label)
    return;

  // Add jump
  if (this.labels[label]) {
    this.current.go(this.labels[label]);
  } else {
    if (!this.missingLabels[label])
      this.missingLabels[label] = [];
    this.missingLabels[label].push({
      from: this.current
    });
  }

  if (!this.current.ended)
    this.current = this.current.after();
};

function Block(preparser, id) {
  this.preparser = preparser;

  this.id = id;
  this.predecessors = [];
  this.successors = [];
  this.instructions = [];
  this.ended = false;

  this.parent = null;
  this.befores = [];
  this.afters = [];
  this.splits = [];
}

Block.prototype.toJSON = function toJSON() {
  return {
    id: this.id,
    instructions: this.instructions.map(function(instr) {
      return instr.toJSON();
    }),
    successors: this.successors.map(function(s) {
      return s.id;
    })
  };
};

Block.prototype.go = function go(block) {
  assert(block);
  if (this.ended)
    return this;

  var from = block;
  var to = this;

  // Auto-split block to simplify graph
  if (from.predecessors.length === 2)
    from = from.before();

  from.predecessors.push(to);
  to.successors.push(from);
  assert(from.predecessors.length <= 2);
  assert(to.successors.length <= 2);

  // Create a junction
  if (to.predecessors.length === 2 && to.successors.length === 2)
    to = to.split();
};

Block.prototype.before = function before() {
  var p;
  if (this.parent)
    p = this.parent;
  else
    p = this;

  var b = new Block(this.preparser, p.id);
  b.parent = p;
  b.id = '_' + b.id + '_a' + p.befores.unshift(b);

  b.add('nop', null, [], null);

  this.preparser.blocks.push(b);
  b.go(this);

  // Re-link blocks
  b.predecessors = this.predecessors.slice(1);
  this.predecessors = this.predecessors.slice(0, 1);
  b.predecessors.forEach(function(pred) {
    pred.successors = pred.successors.map(function(succ) {
      if (succ === this)
        return b;
      else
        return succ;
    }, this);
  }, this);

  return b;
};

Block.prototype.after = function after() {
  var p;
  if (this.parent)
    p = this.parent;
  else
    p = this;

  var b = new Block(this.preparser, p.id);
  b.parent = p;
  b.id = '_' + b.id + '_a' + p.afters.push(b);

  // Re-link blocks
  b.successors = this.successors.slice(1);
  this.successors = this.successors.slice(0, 1);
  b.successors.forEach(function(succ) {
    succ.predecessors = succ.predecessors.map(function(pred) {
      if (pred === this)
        return b;
      else
        return pred;
    }, this);
  }, this);

  this.preparser.blocks.push(b);
  this.go(b);

  return b;
};

Block.prototype.split = function split() {
  var p;
  if (this.parent)
    p = this.parent;
  else
    p = this;

  var b = new Block(this.preparser, p.id);
  b.parent = p;
  b.id = '_' + b.id + '_s' + p.splits.push(b);

  b.add('nop', null, [], null);

  b.predecessors = this.predecessors;
  this.predecessors = [];
  b.predecessors.forEach(function(pred) {
    pred.successors = pred.successors.map(function(succ) {
      if (succ === this)
        return b;
      else
        return succ;
    }, this);
  }, this);

  this.preparser.blocks.push(b);
  b.go(this);

  return b;
};

Block.prototype.add = function add(type, out, inputs, label) {
  if (this.ended)
    return;

  this.instructions.push(new Instruction(this, type, out, inputs, label));
  if (type === 'hlt')
    this.ended = true;
};

function Instruction(block, type, output, inputs, label) {
  this.block = block;
  this.id = 'i' + block.preparser.instructionId++;

  this.type = type;
  this.output = output || { type: 'instruction', id: this.id };
  this.inputs = inputs;
  this.label = label;

  this.assign = this.output ? this.output.type === 'variable' : false;
}

Instruction.prototype.toJSON = function toJSON() {
  return {
    id: this.assign ? this.output.id : this.id,
    type: this.type,
    inputs: this.inputs,
    assign: this.assign
  };
};
