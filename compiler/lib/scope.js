function Scope(fn, parent) {
  this.fn = fn;
  this.parent = parent || null;
  this.map = {};
  this.args = 0;
  this.entries = [];
  this.uses = [];
  this.context = 0;
}
exports.Scope = Scope;

Scope.prototype.size = function size() {
  return this.entries.length;
};

Scope.prototype.contextSize = function contextSize() {
  return this.context;
};

Scope.prototype.buildContext = function buildContext() {
  var s = 0;
  for (var i = 0; i < this.entries.length; i++)
    if (!this.entries[i].isArg() && !this.entries[i].isConst())
      s++;
  this.context = s;

  // No context variables
  if (s === 0 || !this.parent)
    return;

  // Increase depth for crossing uses
  for (var i = 0; i < this.uses.length; i++)
    this.uses[i].depth++;
};

Scope.prototype.set = function set(name, value, isArg) {
  // Already has an entry
  if (this.map[name] !== undefined)
    return this.map[name];

  var index;
  if (isArg)
    index = this.args++;
  else
    index = this.entries.length - this.args;

  var res = new ScopeEntry(this, index, name);
  this.entries.push(res);
  this.map[name] = res;

  var use;
  if (!value)
    use = res.use(this);
  else
    use = res.set(this, value);

  if (isArg)
    use.markArg();

  return use;
};

Scope.prototype.get = function get(name) {
  var cur = this;
  for (var cur = this; cur !== null; cur = cur.parent) {
    var entry = cur.map[name];
    if (entry === undefined)
      continue;

    return entry.use(this);
  }

  var r = new ScopeEntry(this, 0, name);
  r.markGlobal();
  return r;
};

function ScopeEntry(scope, index, name) {
  this.scope = scope;
  this.depth = 0;
  this.context = false;
  if (index instanceof ScopeEntry) {
    this.parent = index;
    this.index = index.index;

    this.calculateDepth();
    this.name = this.parent.name;
  } else {
    this.parent = null;
    this.index = index;
    this.name = name;
  }
  this.arg = false;
  this.sets = [];
  this.uses = [];
}

ScopeEntry.prototype.markArg = function markArg() {
  this.arg = true;
  if (this.parent)
    return this.parent.markArg();
};

ScopeEntry.prototype.use = function use(scope) {
  if (this.parent)
    return this.parent.use(scope);

  var r = new ScopeEntry(scope, this);
  this.uses.push(r);

  var start = scope;
  var end = this.parentScope();

  // In case of adding context - args should increase their depth
  if (this.arg)
    end = end.parent;
  for (; start !== end; start = start.parent)
    start.uses.push(r);

  return r;
};

ScopeEntry.prototype.set = function set(scope, value) {
  var use = this.use(scope);
  this.sets.push({ use: use, value: value });
  return use;
};

ScopeEntry.prototype.isConst = function isConst() {
  if (this.arg)
    return false;

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

ScopeEntry.prototype.parentScope = function parentScope() {
  if (this.parent)
    return this.parent.parentScope();

  return this.scope;
};

ScopeEntry.prototype.markGlobal = function markGlobal() {
  this.depth = -1;
};

ScopeEntry.prototype.isGlobal = function isGlobal() {
  return this.depth === -1;
};

ScopeEntry.prototype.calculateDepth = function calculateDepth() {
  var start = this.scope;
  var end = this.parentScope();

  for (; start !== end; start = start.parent)
    this.depth++;
};

ScopeEntry.prototype.isArg = function isArg() {
  return this.arg;
};
