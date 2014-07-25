var assert = require('assert');
var esprima = require('esprima');
var estraverse = require('estraverse');

function Compiler(source) {
  this.source = source;
  this.ast = esprima.parse(source);
  this.out = [];

  this.fns = [];
  this.stmts = [];
  this.returns = [];
}
exports.Compiler = Compiler;

Compiler.prototype.add = function add(instr) {
  return this.out.push(instr) - 1;
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
        this.add([ 'LD' , 0, i, '; adapt=' + i ]);

      // Stub-out scope
      for (; i < item.fn._scope.size; i++)
        this.add([ 'LDC' , 0, ' ; init_ctx=' + i ]);

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

    // Visit all queued statements
    while (this.stmts.length) {
      var stmt = this.stmts.shift();
      if (stmt.index !== -1)
        stmt.instr[stmt.index] = this.out.length;
      this.visitStmt(stmt.stmt);
    }

    // Link-in all returns
    for (var i = 0; i < this.returns.length; i++) {
      var ret = this.returns[i];
      ret.instr[ret.index ] = rtn;
    }
  }

  return this.out.map(function(instr) {
    return instr.join(' ');
  }).join('\n');
};

Compiler.prototype.evalScopes = function evalScopes() {
  var scopes = [
    { fn: null, map: {}, size: 0, context: 0 }
  ];

  function add(name, arg) {
    var scope = scopes[scopes.length - 1];

    if (!arg)
      scope.context++;

    return {
      depth: 0,
      index: scope.map[name] = scope.size++
    };
  }

  function get(name) {
    var depth = 0;
    for (var i = scopes.length - 1; i >= 0; i--, depth++) {
      if (scopes[i].map[name] === undefined) {
        // Skip adaptor frame
        if (scopes[i].context != 0)
          depth++;
        continue;
      }

      return { depth: depth, index: scopes[i].map[name] };
    }
    return { depth: -1, index: name };
  }

  estraverse.traverse(this.ast, {
    enter: function(node) {
      if (/function/i.test(node.type)) {
        if (node.id)
          node.id._scope = add(node.id.name);

        scopes.push({
          fn: node,
          map: {},
          size: 0,
          context: 0
        });

        node.params.forEach(function(param) {
          param._scope = add(param.name, true);
        });
      } else if (node.type === 'VariableDeclarator') {
        add(node.id.name);
      } else if (node.type === 'Identifier') {
        if (!node._scope)
          node._scope = get(node.name);
      }
    },
    leave: function(node) {
      if (node === scopes[scopes.length - 1].fn)
        node._scope = scopes.pop();
    }
  });

  this.ast._scope = scopes.pop();
};

Compiler.prototype.visitStmt = function visitStmt(stmt) {
  if (stmt.type === 'ExpressionStatement') {
    return this.visitExpr(stmt.expression, true);
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
  } else if (stmt.type === 'JoinStatement') {
    // Artificial
    this.add([ 'JOIN' ]);
  } else if (stmt.type === 'JumpStatement') {
    // Artificial
    this.add([ 'LDC', 0 ]);
    this.add([ 'TSEL', stmt.target, stmt.target ]);
  } else if (stmt.type === 'BlockStatement') {
    this.visitBlock(stmt);
  } else {
    throw new Error('Unsupported statement type: ' + stmt.type);
  }
};

Compiler.prototype.visitExpr = function visitExpr(expr, stmt) {
  if (expr.type === 'AssignmentExpression')
    return this.visitAsgn(expr);
  else if (expr.type === 'CallExpression')
    return this.visitCall(expr);
  else if (expr.type === 'Literal')
    return this.visitLiteral(expr);
  else if (expr.type == 'Identifier')
    return this.visitIdentifier(expr, stmt);
  else if (expr.type == 'BinaryExpression')
    return this.visitBinop(expr, stmt);
};

Compiler.prototype.visitAsgn = function visitAsgn(expr) {
  var scope = expr.left._scope;
  assert(scope);
  this.visitExpr(expr.right);
  this.add([ 'ST', scope.depth, scope.index ]);
};

Compiler.prototype.visitCall = function visitCall(expr) {
  assert.equal(expr.callee.type, 'Identifier');
  assert(expr.callee._scope);

  var slot = expr.callee._scope;
  for (var i = 0; i < expr.arguments.length; i++)
    this.visitExpr(expr.arguments[0]);

  this.add([ 'LD', slot.depth, slot.index ]);
  this.add([ 'AP', expr.arguments.length ]);
};

Compiler.prototype.visitLiteral = function visitLiteral(expr) {
  assert(typeof expr.value === 'number');
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

Compiler.prototype.visitIdentifier = function visitIdentifier(id, stmt) {
  assert(id._scope && !stmt);
  this.add([ 'LD', id._scope.depth, id._scope.index ]);
};

Compiler.prototype.visitVar = function visitVar(stmt) {
  var decls = stmt.declarations;
  for (var i = 0; i < decls.length; i++) {
    if (!decls[i].init)
      continue;

    var val = decls[i].init;
    var slot = decls[i].id._scope;
    this.visitExpr(val);
    this.add([ 'ST', slot.depth, slot.index ]);
  }
};

Compiler.prototype.visitBinop = function visitBinop(expr, stmt) {
  assert(!stmt);

  var op = expr.operator;
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
  else if (op === '==' || op === '===')
    op = 'CEQ';
  else if (op === '>')
    op = 'CGT';
  else if (op === '>=')
    op = 'CGTE';
  else
    throw new Error('Unsupported operation: ' + op);
  this.add([ op ]);
};

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

  var instr = [ 'SEL', null, null, '; if test' ];
  this.add(instr);
  this.stmts.push({ stmt: stmt.consequent, instr: instr, index: 1 });
  if (stmt.alternate) {
    this.stmts.push({ stmt: stmt.alternate, instr: instr, index: 2 });
  } else {
    this.stmts.push({
      stmt: { type: 'JoinStatement' },
      instr: instr,
      index: 2
    });
  }
};

Compiler.prototype.visitWhile = function visitWhile(stmt) {
  var start = this.out.length;
  this.visitExpr(stmt.test);

  var instr = [ 'TSEL', null, this.out.length + 1, '; while test' ];
  this.add(instr);

  this.stmts.push({ stmt: stmt.body, instr: instr, index: 1 });
  this.stmts.push({
    stmt: { type: 'JumpStatement', target: start },
    instr: instr,
    index: -1
  });
};

Compiler.prototype.visitBlock = function visitBlock(stmt) {
  for (var i = 0; i < stmt.body.length; i++)
    this.visitStmt(stmt.body[i]);
};
