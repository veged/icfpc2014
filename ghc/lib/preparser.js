var assert = require('assert');

function Preparser(source) {
  this.source = source;

  this.blocks = [];
  this.current = null;
  this.labels = {};

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

  var subid = this.current.subid;

  console.log(label);
  // Add jump
  this.current.go(this.labels[label]);

  // Split the block
  this.visitLabel(this.current.id);
  this.current.subid = subid + 1;
};

function Block(preparser, id) {
  this.preparser = preparser;

  this.id = id;
  this.subid = 0;
  this.successors = [];
  this.instructions = [];
}

Block.prototype.go = function go(block) {
  this.successors.push(block);
};

Block.prototype.add = function add(type, out, inputs, label) {
  this.instructions.push(new Instruction(this, type, out, inputs, label));
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
