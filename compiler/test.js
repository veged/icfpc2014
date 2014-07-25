function dup(a) {
  while (a < 10) {
    a = a + 1;
  }
  return [ a, a * 2 ];
}

[ dup(1)[1], typeof 1 ];
