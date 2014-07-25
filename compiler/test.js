var a, b = 2;

function dup(a) {
  if (a < 2) {
    return dup(a + 1);
  }
}

a = 1;

dup(a);
