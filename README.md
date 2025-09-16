# masters-blunders

Experimentation for my master's thesis. Aims to acchieve a intuitive and easy-to-use robot programming framework using react. Might include a custom react renderer.

## Goals:

1. Write safe checks and conditions once only.
2. Type safety.
3. Render (parts) of the state.
   - Interchangable serializer functions.
   - Can be served using http.
   - Can be sent via websockets.
4. Monitor render times (FPS) and provide handles for loops exceeding min FPS.
5. Support external requests/triggers (mounted inside states).
6. Testability.

What we've proven so far:

- guards
- error boundaries
- parallel execution of states
- performance (to some extent)
- testability (to some extent)
- nice way to handle complex state machines

TODO:

- make it reactive using zustand
- test react xstate
