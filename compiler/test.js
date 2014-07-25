function step(state, world) {
  state = state + 1;
  if (state >= 40)
    state = 0;
  return [ state, state / 10 ];
}

[ 0, step ];
