var assert = require('assert');
var esprima = require('esprima');
var estraverse = require('estraverse');

var Scope = require('./scope').Scope;

function Compiler(source, options) {
  this.source = source;
  this.options = options || {};
  this.ast = esprima.parse(source, { range: true, loc: options.lines });
  this.current = null;
  this.out = [];

  this.fns = [];
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

    this.current = item.fn;

    // Add adaptor frame
    var scope = item.fn._scope;
    if (scope.contextSize() != 0)
      this.pushContextAdaptor(scope);

    if (this.options.lines && item.fn.loc) {
      this.add([ 'LDC', item.fn.loc.start.line ]);
      this.add([ 'LDC', item.fn.loc.end.line ]);
      this.add([ 'CONS' ]);
      this.add([ 'DBUG' ]);
    }

    if (item.fn.type !== 'Program')
      this.visitStmt(item.fn.body);
    else
      this.visitStmt(item.fn);

    this.add([ 'RTN' ]);

    this.current = null;
  }

  return this.out.map(function(instr) {
    return instr.instr.join(' ') + (instr.comment ? ' ; ' + instr.comment : '');
  }).join('\n');
};

Compiler.prototype.pushContextAdaptor = function pushContextAdaptor(scope) {
  // Stub-out scope
  var ctx = scope.contextSize();
  for (var i = 0; i < ctx; i++)
    this.add([ 'LDC' , 0 ], 'init_ctx=' + i);

  // Call adaptor function
  this.add([ 'LDF', this.out.length + 3 ]);
  this.add([ 'AP', ctx ]);
  this.add([ 'RTN' ]);
};

Compiler.prototype.evalScopes = function evalScopes() {
  var root = new Scope(null, null);
  var allScopes = [ root ];

  var queue = [ { ast: this.ast, current: root } ];
  while (queue.length) {
    var item = queue.shift();
    var current = item.current;

    // Declare functions at the top
    estraverse.traverse(item.ast, {
      enter: function(node) {
        // if (module) { ... node.js specific thing... }
        if (node.type === 'IfStatement' &&
            node.test.type === 'Identifier' &&
            node.test.name === 'module') {
          return this.skip();
        }

        if (/function/i.test(node.type)) {
          if (node.id && !node.id._scope)
            node.id._scope = current.set(node.id.name, node);

          var s = new Scope(node, current);
          allScopes.push(s);
          queue.push({
            current: s,
            ast: node.body
          });

          node.params.forEach(function(param) {
            param._scope = s.set(param.name, null, true);
          });

          node._scope = s;

          // Visit function later
          return this.skip();
        }
      }
    });

    estraverse.traverse(item.ast, {
      enter: function(node) {
        // Functions are already handled
        if (/function/i.test(node.type))
          return this.skip();

        // if (module) { ... node.js specific thing... }
        if (node.type === 'IfStatement' &&
            node.test.type === 'Identifier' &&
            node.test.name === 'module') {
          return this.skip();
        }

        if (node.type === 'VariableDeclarator') {
          current.set(node.id.name, node.init);
        } else if (node.type === 'Identifier') {
          if (!node._scope)
            node._scope = current.get(node.name);
        } else if (node.type === 'AssignmentExpression' &&
                   node.left.type === 'Identifier') {
          current.get(node.left.name).set(current, node.right);
        }
      }
    });
  }

  for (var i = 0; i < allScopes.length; i++)
    allScopes[i].buildContext();

  this.ast._scope = root;
};

Compiler.prototype.visitStmt = function visitStmt(stmt) {
  var pos = this.out.length;
  if (stmt.type === 'ExpressionStatement') {
    this.visitExpr(stmt.expression, stmt);
  } else if (stmt.type === 'FunctionDeclaration') {
    // Already visited, ignore
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
    this.add([ 'LDC', 0 ], 'jump-stmt');
    this.add([ 'TSEL', stmt.target, stmt.target ]);
  } else if (stmt.type === 'BlockStatement' || stmt.type === 'Program') {
    this.visitBlock(stmt);
  } else {
    throw new Error('Unsupported statement type: ' + stmt.type);
  }

  this.annotate(stmt, pos);
};

Compiler.prototype.annotate = function annotate(node, pos) {
  // Add comment
  if (node.range && this.out.length > pos) {
    var src = this.source.slice(node.range[0], node.range[1])
        .replace(/[\r\n]+/g, '');
    if (src.length > 20)
      src = src.slice(0, 17) + '...';

    if (!this.out[pos].comment)
      this.out[pos].comment = '(js: `' + src + '`)';
    else
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
  else if (expr.type === 'UnaryExpression')
    this.visitUnop(expr);
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
  this.add([ 'ATOM' ]);
  this.add([ 'TSEL', this.out.length + 1, this.out.length + 1], 'cleanup');
};

Compiler.prototype.visitAsgn = function visitAsgn(expr, stmt) {
  var scope = expr.left._scope;
  assert(scope, 'lhs of assignment should have a scope');
  assert.equal(expr.operator, '=',
               'Unsupport assignment operator: ' + expr.operator);

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
  this.add([ 'LDC', expr.value ], 'literal');
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
  var slot = id._scope;
  assert(slot, 'unknown identifier');
  assert(!slot.isGlobal(), 'unknown global: ' + slot.name);
  if (slot.isConst())
    this.add([ 'LDC', slot.constVal() ], 'const-id');
  else
    this.add([ 'LD', slot.depth, slot.index ]);
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

  // a | 0
  if (op === '|') {
    assert.equal(expr.right.type, 'Literal');
    assert.equal(expr.right.value, 0);
    return this.visitExpr(expr.left);
  }

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
      if (value.value === 'object') {
        this.add([ 'LDC', 0 ]);
        this.add([ 'CEQ' ]);
      }
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

  this.add([ op ]);
  if (neq)
    this.add([ 'SUB' ]);
};

Compiler.prototype.visitUnop = function visitUnop(expr) {
  var op = expr.operator;
  if (op === '-') {
    this.add([ 'LDC', 0 ]);
    this.visitExpr(expr.argument);
    this.add([ 'SUB' ]);
  } else if (op === '!') {
    this.visitExpr(expr.argument);
    this.add([ 'LDC', 0 ]);
    this.add([ 'CEQ' ]);
  } else {
    throw new Error('Unsupported unary: ' + op);
  }
}

Compiler.prototype.visitLogic = function visitLogic(expr) {
  var op = expr.operator;

  this.visitExpr(expr.left);
  this.visitExpr(expr.right);
  if (op === '&&') {
    this.add([ 'MUL' ]);
  } else {
    this.add([ 'ADD' ]);
  }
}

Compiler.prototype.visitRet = function visitRet(stmt) {
  if (stmt.argument)
    this.visitExpr(stmt.argument);

  var body = this.current.body;
  while (body.body)
    body = body.body;
  if (stmt !== body[body.length - 1])
    this.add([ 'RTN' ]);
};

Compiler.prototype.visitIf = function visitIf(stmt) {
  // if (module) { ... node.js specific thing... }
  if (stmt.test.type === 'Identifier' &&
      stmt.test.name === 'module') {
    return;
  }

  this.visitExpr(stmt.test);

  var instr = [ 'TSEL', this.out.length + 1, null ];

  this.add(instr, 'if test');
  this.visitStmt(stmt.consequent);
  if (stmt.alternate) {
    var jmp = [ 'TSEL', null, null ];

    this.add([ 'LDC', 0 ], 'if-cons-jump');
    this.add(jmp);
    instr[2] = this.out.length;

    this.visitStmt(stmt.alternate);

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
  // Visit functions first
  for (var i = 0; i < stmt.body.length; i++) {
    var s = stmt.body[i];
    if (s.type !== 'FunctionDeclaration')
      continue;

    var pos = this.out.length;
    this.visitFn(s);
    this.annotate(s, pos);
    this.add([ 'ST', s.id._scope.depth, s.id._scope.index ]);
  }

  // Visit rest later
  for (var i = 0; i < stmt.body.length; i++)
    this.visitStmt(stmt.body[i]);
};

Compiler.prototype.visitMember = function visitMember(stmt) {
  assert(stmt.computed, '`obj.prop` not supported');
  assert.equal(stmt.property.type, 'Literal', 'property not literal');
  assert.equal(typeof stmt.property.value, 'number', 'property not number');

  var obj = stmt.object;
  if (obj.type === 'Identifier' && obj.name === 'global') {
    var slot = obj._scope;
    assert(slot);
    if (slot.isGlobal()) {
      var root = slot.parentScope();
      this.add([
        'LD', slot.depth + root.context ? 1 : 0, stmt.property.value
      ]);
      return;
    }
  }

  var idx = stmt.property.value;
  assert(0 <= idx && idx < 2, 'property index OOB');
  this.visitExpr(obj);
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
