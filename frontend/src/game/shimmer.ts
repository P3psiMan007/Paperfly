// Cheap, listener-free shimmer phase 0..1. Reads off performance.now() each
// time it's called instead of using an Animated.Value listener (which forces
// a setState every frame). Pass `now` from the render that's already happening
// so we don't introduce a new render trigger.
export function shimmerPhaseAt(now: number, periodMs = 3500): number {
  return (now % periodMs) / periodMs;
}
