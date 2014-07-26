var assert = require('assert');
var esprima = require('esprima');
var estraverse = require('estraverse');

function Compiler(source) {
  this.source = source;
  this.ast = esprima.parse(source, { range: true });
  this.out = [];

  this.fns = [];
  this.returns = [];
}
exports.Compiler = Compiler;

Compiler.prototype.add = function add(instr, comment) {
  return this.out.push({ instr: instr, comment: comment }) - 1;
};

Compiler.prototype.compile = function compile() {
  this.evalScopes();

  var instr = [ 'LDF', null ];
  this.queueFn(this.ast, instr, 1);

  while (this.fns.length) {
    var item = this.fns.shift();
    item.instr[item.index] = this.out.length;

    // Add adaptor frame
    if (item.fn._scope.context != 0) {
      // Push-out arguments
      for (var i = 0; i < item.fn._scope.size - item.fn._scope.context; i++)
        this.add([ 'LD' , 0, i ], 'adapt=' + i);

      // Stub-out scope
      for (; i < item.fn._scope.size; i++)
        this.add([ 'LDC' , 0 ], 'init_ctx=' + i);

      // Call adaptor function
      this.add([ 'LDF', this.out.length + 3 ]);
      this.add([ 'AP', item.fn._scope.size ]);
      this.add([ 'RTN' ]);
    }

    var body = item.fn.body;
    while (body.body)
      body = body.body;
    body.forEach(function(stmt) {
      this.visitStmt(stmt);
    }, this);

    var rtn = this.add([ 'RTN' ]);

    // Link-in all returns
    for (var i = 0; i < this.returns.length; i++) {
      var ret = this.returns[i];
      ret.instr[ret.index ] = rtn;
    }
  }

  return this.out.map(function(instr) {
    return instr.instr.join(' ') + (instr.comment ? '; ' + instr.comment : '');
  }).join('\n');
};

function Scope(fn, parent) {
  this.fn = fn;
  this.parent = parent || null;
  this.map = {};
  this.size = 0;
  this.context = 0;
}

Scope.prototype.set = function set(name, value, isArg) {
  // Already has an entry
  if (this.map[name] !== undefined)
    return this.map[name];

  if (!isArg)
    this.context++;

  var res = new ScopeEntry(this, 0, this.size++);
  this.map[name] = res;
  if (value)
    res.sets.push(value);
  return res;
};

Scope.prototype.get = function get(name) {
  var depth = 0;
  var cur = this;
  for (var cur = this; cur !== null; cur = cur.parent, depth++) {
    var entry = cur.map[name];
    if (entry === undefined) {
      // Skip adaptor frame
      if (cur.context !== 0)
        depth++;
      continue;
    }

    entry.gets++;
    return new ScopeEntry(cur, depth, entry);
  }

  return new ScopeEntry(this, -1, name);
};

function ScopeEntry(scope, depth, index) {
  this.scope = scope;
  this.depth = depth;
  if (index instanceof ScopeEntry) {
    this.parent = index;
    this.parent.context = true;
    this.index = index.index;
  } else {
    this.parent = null;
    this.index = index;
  }
  this.sets = [];
  this.gets = 0;
  this.context = false;
}

ScopeEntry.prototype.isConst = function isConst() {
  if (this.parent)
    return this.parent.isConst();

  if (this.sets.length !== 1)
    return false;

  var a = this.sets[0];
  return a.type === 'Literal' && typeof a.value === 'number';
};

ScopeEntry.prototype.constVal = function constVal() {
  if (this.parent)
    return this.parent.constVal();

  if (!this.isConst())
    throw new Error('ScopeEntry has no const value');

  return this.sets[0].value;
};

Compiler.prototype.evalScopes = function evalScopes() {
  var scopes = [ new Scope(null, null) ];
  var last = scopes[0];

  estraverse.traverse(this.ast, {
    enter: function(node) {
      if (/function/i.test(node.type)) {
        if (node.id)
          node.id._scope = last.set(node.id.name, node);

        last = new Scope(node, last);
        scopes.push(last);

        node.params.forEach(function(param) {
          param._scope = last.set(param.name, null, true);
        });
      } else if (node.type === 'VariableDeclarator') {
        last.set(node.id.name, node.init);
      } else if (node.type === 'Identifier') {
        if (!node._scope)
          node._scope = last.get(node.name);
      } else if (node.type === 'AssignmentExpression' &&
                 node.left.type === 'Identifier') {
        last.set(node.left.name, node.right);
      }
    },
    leave: function(node) {
      if (node === scopes[scopes.length - 1].fn) {
        node._scope = scopes.pop();
        last = scopes[scopes.length - 1];
      }
    }
  });

  this.ast._scope = scopes.pop();
};

Compiler.prototype.visitStmt = function visitStmt(stmt) {
  var pos = this.out.length;
  if (stmt.type === 'ExpressionStatement') {
    this.visitExpr(stmt.expression, stmt);
  } else if (stmt.type === 'FunctionDeclaration') {
    this.visitFn(stmt);
    this.add([ 'ST', stmt.id._scope.depth, stmt.id._scope.index ]);
  } else if (stmt.type === 'VariableDeclaration') {
    this.visitVar(stmt);
  } else if (stmt.type === 'ReturnStatement') {
    this.visitRet(stmt);
  } else if (stmt.type === 'IfStatement') {
    this.visitIf(stmt);
  } else if (stmt.type === 'WhileStatement') {
    this.visitWhile(stmt);
  } else if (stmt.type === 'ThrowStatement') {
    this.visitThrow(stmt);
  } else if (stmt.type === 'DebuggerStatement') {
    this.visitDebugger(stmt);
  } else if (stmt.type === 'JumpStatement') {
    // Artificial
    this.add([ 'LDC', 0 ]);
    this.add([ 'TSEL', stmt.target, stmt.target ]);
  } else if (stmt.type === 'BlockStatement') {
    this.visitBlock(stmt);
  } else {
    throw new Error('Unsupported statement type: ' + stmt.type);
  }

  // Add comment
  if (stmt.range && this.out.length > pos) {
    var src = this.source.slice(stmt.range[0], stmt.range[1])
        .replace(/[\r\n]+/g, '');
    if (src.length > 20)
      src = src.slice(0, 17) + '...';

    if (!this.out[pos].comment)
      this.out[pos].comment = '';
    this.out[pos].comment += ' (js: `' + src + '`)';
  }
};

Compiler.prototype.visitExpr = function visitExpr(expr, stmt) {
  if (expr.type === 'AssignmentExpression')
    this.visitAsgn(expr, stmt);
  else if (expr.type === 'CallExpression')
    this.visitCall(expr, stmt);
  else if (expr.type === 'Literal')
    this.visitLiteral(expr);
  else if (expr.type === 'Identifier')
    this.visitIdentifier(expr);
  else if (expr.type === 'BinaryExpression')
    this.visitBinop(expr);
  else if (expr.type === 'LogicalExpression')
    this.visitLogic(expr);
  else if (expr.type === 'MemberExpression')
    this.visitMember(expr);
  else if (expr.type === 'ArrayExpression')
    this.visitArray(expr);
  else
    throw new Error('Unsupported expression type: ' + expr.type);

  if (!stmt || expr.type === 'AssignmentExpression')
    return;

  if (stmt === this.ast.body[this.ast.body.length - 1])
    return;

  if (stmt._dbug)
    return;

  // Auto-Consume returned value
  this.add([ 'ATOM' ], 'cleanup');
};

Compiler.prototype.visitAsgn = function visitAsgn(expr, stmt) {
  var scope = expr.left._scope;
  assert(scope, 'lhs of assignment should have a scope');

  // No point in assigning the const value
  if (scope.isConst())
    return;

  this.visitExpr(expr.right);
  this.add([ 'ST', scope.depth, scope.index ]);

  // Load the result of the assignment
  if (!stmt)
    this.add([ 'LD', scope.depth, scope.index ]);
};

Compiler.prototype.visitCall = function visitCall(expr, stmt) {
  if (expr.callee.type === 'MemberExpression') {
    var obj = expr.callee.object;
    var prop = expr.callee.property;

    // console.log()
    if (obj.type === 'Identifier' &&
        obj.name === 'console' &&
        expr.callee.computed === false &&
        prop.type === 'Identifier' &&
        prop.name === 'log') {
      assert.equal(expr.arguments.length, 1);
      this.visitExpr(expr.arguments[0]);
      this.add([ 'DBUG' ]);
      stmt._dbug = true;
      return;
    }
  }

  for (var i = 0; i < expr.arguments.length; i++)
    this.visitExpr(expr.arguments[i]);

  this.visitExpr(expr.callee);
  this.add([ 'AP', expr.arguments.length ]);
};

Compiler.prototype.visitLiteral = function visitLiteral(expr) {
  assert(typeof expr.value === 'number', 'only number literals are supported');
  this.add([ 'LDC', expr.value ]);
};

Compiler.prototype.visitFn = function visitFn(expr) {
  var instr = [ 'LDF', null ];
  this.add(instr);
  this.queueFn(expr, instr, 1);
};

Compiler.prototype.queueFn = function queueFn(fn, instr, index) {
  this.fns.push({
    fn: fn,
    instr: instr,
    index: index
  });
};

Compiler.prototype.visitIdentifier = function visitIdentifier(id) {
  var scope = id._scope;
  assert(scope, 'unknown identifier');
  assert(scope.depth !== -1, 'unknown global: ' + scope.name);
  if (scope.isConst())
    this.add([ 'LDC', scope.constVal() ]);
  else
    this.add([ 'LD', scope.depth, scope.index ]);
};

Compiler.prototype.visitVar = function visitVar(stmt) {
  var decls = stmt.declarations;
  for (var i = 0; i < decls.length; i++) {
    if (!decls[i].init)
      continue;

    var val = decls[i].init;
    var slot = decls[i].id._scope;

    // No point in assigning the const value
    if (slot.isConst())
      continue;

    this.visitExpr(val);
    this.add([ 'ST', slot.depth, slot.index ]);
  }
};

function isTypeof(expr) {
  return expr.type === 'UnaryExpression' && expr.operator === 'typeof';
}

Compiler.prototype.visitBinop = function visitBinop(expr) {
  var op = expr.operator;

  // typeof a === '...'
  if (op === '===') {
    if (isTypeof(expr.left) || isTypeof(expr.right)) {
      var check;
      var value;
      if (isTypeof(expr.left)) {
        check = expr.left.argument;
        value = expr.right;
      } else {
        check = expr.right.argument;
        value = expr.left;
      }

      assert.equal(value.type, 'Literal');
      assert(value.value === 'number' || value.value === 'object',
             'typeof, but the rhs is not `number` and nor `object`');

      this.visitExpr(check);
      this.add([ 'ATOM' ]);
      this.add([ 'LDC', value.value === 'number' ? 1 : 0 ]);
      this.add([ 'CEQ' ]);
      return;
    }
  }

  var neq = op === '!=' || op === '!==';
  if (neq)
    this.add([ 'LDC', 1 ]);

  if (op === '<' || op === '<=') {
    if (op === '<')
      op = '>';
    else
      op = '>=';
    this.visitExpr(expr.right);
    this.visitExpr(expr.left);
  } else {
    this.visitExpr(expr.left);
    this.visitExpr(expr.right);
  }

  if (op === '+')
    op = 'ADD';
  else if (op === '-')
    op = 'SUB';
  else if (op === '*')
    op = 'MUL';
  else if (op === '/')
    op = 'DIV';
  else if (op === '==' || op === '===' || op === '!=' || op === '!==')
    op = 'CEQ';
  else if (op === '>')
    op = 'CGT';
  else if (op === '>=')
    op = 'CGTE';
  else
    throw new Error('Unsupported operation: ' + op);

  if (neq)
    this.add([ 'SUB' ]);
  this.add([ op ]);
};

Compiler.prototype.visitLogic = function visitLogic(expr) {
  var op = expr.operator;

  this.visitExpr(expr.left);
  this.visitExpr(expr.right);
  if (op === '&&') {
    this.add([ 'MUL' ]);
    this.add([ 'LDC', 1 ]);
    this.add([ 'CEQ' ]);
  } else {
    this.add([ 'ADD' ]);
    this.add([ 'LDC', 0 ]);
    this.add([ 'CGT' ]);
  }
}

Compiler.prototype.visitRet = function visitRet(stmt) {
  if (stmt.argument)
    this.visitExpr(stmt.argument);

  var instr = [ 'TSEL', null, null ];
  this.returns.push({ instr: instr, index: 1 });
  this.returns.push({ instr: instr, index: 2 });
  this.add([ 'LDC', 0 ]);
  this.add(instr);
};

Compiler.prototype.visitIf = function visitIf(stmt) {
  this.visitExpr(stmt.test);

  var instr = [ 'TSEL', this.out.length + 1, null ];

  this.add(instr, 'if test');
  this.visitStmt(stmt.consequent);
  if (stmt.alternate) {
    var jmp = [ 'TSEL', null, null ];

    this.add([ 'LDC', 0 ]);
    this.add(jmp);
    instr[2] = this.out.length;

    this.visitStmt(stmt.alternate);
    this.add([ 'LDC', 0 ]);

    jmp[1] = this.out.length;
    jmp[2] = this.out.length;
  } else {
    instr[2] = this.out.length;
  }
};

Compiler.prototype.visitWhile = function visitWhile(stmt) {
  var start = this.out.length;
  this.visitExpr(stmt.test);

  var instr = [ 'TSEL', this.out.length + 1, null ];
  this.add(instr, 'while test');
  this.visitStmt(stmt.body);
  this.add([ 'LDC' , 0 ]);
  this.add([ 'TSEL', start, start ]);

  instr[2] = this.out.length;
};

Compiler.prototype.visitBlock = function visitBlock(stmt) {
  for (var i = 0; i < stmt.body.length; i++)
    this.visitStmt(stmt.body[i]);
};

Compiler.prototype.visitMember = function visitMember(stmt) {
  assert(stmt.computed, '`obj.prop` not supported');
  assert.equal(stmt.property.type, 'Literal', 'property not literal');
  assert.equal(typeof stmt.property.value, 'number', 'property not number');

  var idx = stmt.property.value;
  assert(0 <= idx && idx < 2, 'property index OOB');
  this.visitExpr(stmt.object);
  if (idx === 0)
    this.add([ 'CAR' ]);
  else
    this.add([ 'CDR' ]);
};

Compiler.prototype.visitArray = function visitArray(stmt) {
  var elems = stmt.elements;
  assert.equal(elems.length, 2);

  this.visitExpr(elems[0]);
  this.visitExpr(elems[1]);
  this.add([ 'CONS' ]);
};

Compiler.prototype.visitThrow = function visitThrow() {
  this.add([ 'STOP' ]);
};

Compiler.prototype.visitDebugger = function visitDebugger() {
  this.add([ 'BRK' ]);
};
