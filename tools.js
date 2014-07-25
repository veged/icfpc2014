function tree_alloc(n) {
  if (n === 0)
    throw new Error('Array too small');
  if (n === 1)
    return 0;

  var half = n / 2;
  return [ alloc(n - half), alloc(half) ];
}

function tree_get(a, i) {
  if (i === 0 && typeof a === 'number')
    return a;

  var half = i / 2;
  var r = i - half * 2;
  if (r === 0)
    return get(a[0], half);
  else
    return get(a[1], half);
}

function tree_set(a, i, v) {
  if (i === 0 && typeof a === 'number')
    return v;

  var half = i / 2;
  var r = i - half * 2;
  if (r === 0)
    return [ set(a[0], half, v), a[1] ];
  else
    return [ a[0], set(a[1], half, v) ];
}
