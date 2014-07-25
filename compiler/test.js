var state = 0;

function step(world, state) {
  state = state + 1;
  if (state >= 40)
    state = 0;
  return [ state, state / 10 ];
}

var p = [ state, step ];

p[1](0, p[0]);
