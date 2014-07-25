//
// ARRAY
//

function array_alloc(n) {
  if (n === 0)
    throw new Error('Array is too small');
  if (n === 1)
    return 0;

  var i = 0;
  var res = 0;
  while (i < n) {
    res = [ 0, res ];
    i = i + 1;
  }
  return res;
}

function array_get(a, i) {
  while (i > 0) {
    if (typeof a === 'object')
      a = a[1];
    else
      a = 0;
    i = i - 1;
  }
  if (typeof a === 'object')
    return a[0];
  else
    return a;
}

//
// TREE
//

function tree_alloc(n) {
  if (n === 0)
    throw new Error('Tree is too small');
  if (n === 1)
    return 0;

  var half = n / 2;
  return [ tree_alloc(n - half), tree_alloc(half) ];
}

function tree_get(a, i) {
  if (i === 0 && typeof a === 'number')
    return a;

  var half = i / 2;
  var r = i - half * 2;
  if (r === 0)
    return tree_get(a[0], half);
  else
    return tree_get(a[1], half);
}

function tree_set(a, i, v) {
  if (i === 0 && typeof a === 'number')
    return v;

  var half = i / 2;
  var r = i - half * 2;

  // Grow tree automatically
  if (typeof a === 'number') {
    if (r === 0)
      return [ tree_set(0, half, v), a ];
    else
      return [ a, tree_set(0, half, v) ];
  }

  // Just a normal insertion
  if (r === 0)
    return [ tree_set(a[0], half, v), a[1] ];
  else
    return [ a[0], tree_set(a[1], half, v) ];
}
