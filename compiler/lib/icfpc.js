var assert = require('assert');
var esprima = require('esprima');
var estraverse = require('estraverse');

function Compiler(source) {
  this.source = source;
  this.ast = esprima.parse(source);
  this.out = [];

  this.fns = [];
}
exports.Compiler = Compiler;

Compiler.prototype.add = function add(instr) {
  return this.out.push(instr) - 1;
};

Compiler.prototype.compile = function compile() {
  this.evalScopes();

  var instr = [ 'ldf', null ];

  // Push-out first scope
  this.add(instr);
  this.add([ 'ap', 0 ]);
  this.add([ 'rtn' ]);

  this.queueFn(this.ast, instr, 1);

  while (this.fns.length) {
    var item = this.fns.shift();
    item.instr[item.index] = this.out.length;

    if (item.fn._scope.size != 0) {
      // Push-out scope
      this.add([ 'dum', item.fn._scope.size ]);
      this.add([ 'ldf', this.out.length + 3 ]);
      this.add([ 'rap', 0 ]);
      this.add([ 'rtn' ]);
    }

    var body = item.fn.body;
    while (body.body)
      body = body.body;
    body.forEach(function(stmt) {
      this.visitStmt(stmt);
    }, this);
    this.add([ 'rtn' ]);
  }

  return this.out.map(function(instr) {
    return instr.join(' ');
  }).join('\n');
};

Compiler.prototype.evalScopes = function evalScopes() {
  var scopes = [
    { fn: null, map: {}, size: 0 }
  ];

  function add(name) {
    var scope = scopes[scopes.length - 1];

    return {
      depth: 0,
      index: scope.map[name] = scope.size++
    };
  }

  function get(name) {
    for (var i = scopes.length - 1; i >= 0; i--) {
      if (scopes[i].map[name] === undefined)
        continue;

      return { depth: scopes.length - 1 - i, index: scopes[i].map[name] };
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
          size: 0
        });

        node.params.forEach(function(param) {
          param._scope = add(param.name);
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
    this.add([ 'st', stmt.id._scope.depth, stmt.id._scope.index ]);
  } else if (stmt.type === 'VariableDeclaration') {
    this.visitVar(stmt);
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
  this.add([ 'st', scope.depth, scope.index ]);
};

Compiler.prototype.visitCall = function visitCall(expr) {
  assert.equal(expr.callee.type, 'Identifier');
  assert(expr.callee._scope);

  var slot = expr.callee._scope;
  for (var i = 0; i < expr.arguments.length; i++)
    this.visitExpr(expr.arguments[0]);
  if (slot.depth === -1 && slot.index === '$$push')
    return;
  this.add([ 'lt', slot.depth, slot.index ]);
  this.add([ 'ap', expr.arguments.length ]);
};

Compiler.prototype.visitLiteral = function visitLiteral(expr) {
  assert(typeof expr.value === 'number');
  this.add([ 'ldc', expr.value ]);
};

Compiler.prototype.visitFn = function visitFn(expr) {
  var instr = [ 'ldf', null ];
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
  this.add([ 'ld', id._scope.depth, id._scope.index ]);
};

Compiler.prototype.visitVar = function visitVar(stmt) {
  var decls = stmt.declarations;
  for (var i = 0; i < decls.length; i++) {
    if (!decls[i].init)
      continue;

    var val = decls[i].init;
    var slot = decls[i].id._scope;
    this.visitExpr(val);
    this.add([ 'st', slot.depth, slot.index ]);
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
    op = 'add';
  else if (op === '-')
    op = 'sub';
  else if (op === '*')
    op = 'mul';
  else if (op === '/')
    op = 'div';
  else if (op === '==' || op === '===')
    op = 'ceq';
  else if (op === '>')
    op = 'cgt';
  else if (op === '>=')
    op = 'cgte';
  else
    throw new Error('Unsupported operation: ' + op);
  this.add([ op ]);
};
