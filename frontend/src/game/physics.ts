// Pure motion helpers used by the game loop.
// All functions are framerate-independent (they take `dt` in seconds) so the
// game feels identical on 30/60/120 FPS devices.

// Dead zone with smooth re-scale: ignore micro-jitter under |v| < zone, then
// ramp output back up from 0 once you cross the threshold.
export function applyDeadZone(v: number, zone = 0.06): number {
  if (Math.abs(v) < zone) return 0;
  const sign = v < 0 ? -1 : 1;
  return sign * ((Math.abs(v) - zone) / (1 - zone));
}

// Framerate-independent exponential filter: result moves a fraction `a` toward
// target, where `a = 1 - exp(-dt/tau)`.  Lower tau = snappier response.
export function expFilterCoeff(dt: number, tau: number): number {
  return 1 - Math.exp(-dt / tau);
}

export function expFilter(
  current: number,
  target: number,
  dt: number,
  tau: number
): number {
  return current + (target - current) * expFilterCoeff(dt, tau);
}

// One Euler step of a damped spring on a 1D variable.
// Returns the new {pos, vel}.  Tuned by spring constant k and damping d.
// For critical damping use d = 2 * sqrt(k).
export function springStep(
  pos: number,
  vel: number,
  target: number,
  dt: number,
  k: number,
  d: number
): { pos: number; vel: number } {
  const a = k * (target - pos) - d * vel;
  const v = vel + a * dt;
  const p = pos + v * dt;
  return { pos: p, vel: v };
}

// Cubic smoothstep (3t² - 2t³).  Useful for ease-in/ease-out fades.
export function smoothstep(t: number): number {
  const c = Math.max(0, Math.min(1, t));
  return c * c * (3 - 2 * c);
}
