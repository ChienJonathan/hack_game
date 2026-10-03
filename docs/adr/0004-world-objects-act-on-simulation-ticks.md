---
status: accepted
---

# Advance world objects on simulation ticks

The simulator advances in fixed 100 ms ticks, evaluates each World Object's Behavior Rules, and runs the process logic for each matching rule. Commands set world state or object intent synchronously; the simulator then moves and reacts to that state independently of rendering, so movement, pickup, guard pursuit, combat, and room transitions are determined by object rules.
