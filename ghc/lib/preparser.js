var assert = require('assert');
var ssa = require('ssa-ir');

function Preparser(source) {
  this.source = source;

  this.blocks = [];
  this.current = null;
  this.labels = {};
  this.missingLabels = {};

  var root = new Block(this, '$root');
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
};

Preparser.prototype.visitLabel = function visitLabel(name) {
  var b = new Block(this, name);

  // Blocks follow each other
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

  // Split the block
  if (!this.current.ended)
    this.current = this.current.sub();
};

function Block(preparser, id) {
  this.preparser = preparser;

  this.id = id;
  this.successors = [];
  this.instructions = [];
  this.ended = false;

  this.parent = null;
  this.subs = [];
}

Block.prototype.go = function go(block) {
  assert(block);
  if (!this.ended)
    this.successors.push(block);
};

Block.prototype.sub = function sub() {
  if (this.parent)
    return this.parent.sub();

  var b = new Block(this.preparser, this.id);
  b.parent = this;
  b.id += '$' + this.subs.push(b);

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
  this.id = block.preparser.instructionId++;

  this.type = type;
  this.output = output;
  this.inputs = inputs;
  this.label = label;

  if (!this.output)
    this.output = { type: 'instruction', id: this.id };
}
