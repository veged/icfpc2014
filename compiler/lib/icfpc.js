var assert = require('assert');
var esprima = require('esprima');
var estraverse = require('estraverse');

function Compiler(source) {
  this.source = source;
  this.ast = esprima.parse(source);
  this.out = [];
  this.scopes = [];
  this.scope = null;
}
exports.Compiler = Compiler;

Compiler.prototype.add = function add(instr) {
  this.out.push(instr);
};

Compiler.prototype.compile = function compile() {
  this.evalScopes();

  // Push-out first scope
  this.add([ 'dum', this.scope.size ]);
  this.add([ 'ldf', 4 ]);
  this.add([ 'rap', 0 ]);
  this.add([ 'rtn' ]);

  this.ast.body.forEach(function(stmt) {
    this.visitStmt(stmt);
  }, this);

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
          add(node.id.name);

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
        node._scope = get(node.name);
      }
    },
    leave: function(node) {
      if (node === scopes[scopes.length - 1].fn)
        node._scope = scopes.pop();
    }
  });

  this.scope = scopes.pop();
  this.scopes.push(this.scope);
};

Compiler.prototype.visitStmt = function visitStmt(stmt) {
  if (stmt.type === 'ExpressionStatement')
    return this.visitExpr(stmt.expression);

};

Compiler.prototype.visitExpr = function visitExpr(expr) {
  if (expr.type === 'AssignmentExpression')
    return this.visitAsgn(expr);
  else if (expr.type === 'Literal')
    return this.visitLiteral(expr);
};

Compiler.prototype.visitAsgn = function visitAsgn(expr) {
  var scope = expr.left._scope;
  assert(scope);
  this.visitExpr(expr.right);
  this.add([ 'st', scope.depth, scope.index ]);
};

Compiler.prototype.visitLiteral = function visitLiteral(expr) {
  assert(typeof expr.value === 'number');
  this.add([ 'ldc', expr.value ]);
};
