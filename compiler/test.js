var state = 0;

function step(world, state) {
  console.log(state);
  state = state + 1;
  if (state >= 40)
    state = 0;
  return [ state, state / 10 ];
}

[ state, step ];
