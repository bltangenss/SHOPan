/** Shoulder -> elbow -> wrist -> hand-end points for one arm (side = 1 or -1). */
export function armPoints(metrics, side) {
  const { y, arm, headR } = metrics;
  const shoulder = [side * arm.gap, y.shoulder, 0];
  const elbow = [
    side * (arm.gap + Math.sin(arm.splay) * arm.upperLen),
    y.shoulder - Math.cos(arm.splay) * arm.upperLen,
    headR.z * 0.15,
  ];
  const wrist = [
    elbow[0] + side * Math.sin(arm.splay * 0.55) * arm.foreLen,
    elbow[1] - Math.cos(arm.splay * 0.55) * arm.foreLen,
    elbow[2] + headR.z * 0.25,
  ];
  const handEnd = [
    wrist[0] + side * Math.sin(arm.splay * 0.3) * arm.handLen,
    wrist[1] - Math.cos(arm.splay * 0.3) * arm.handLen,
    wrist[2] + headR.z * 0.08,
  ];
  return { shoulder, elbow, wrist, handEnd };
}

/** Hip -> knee -> ankle points for one leg (side = 1 or -1). */
export function legPoints(metrics, side) {
  const { y, leg } = metrics;
  const hip = [side * leg.gap, y.hip, 0];
  const knee = [side * leg.gap * 0.86, y.knee, leg.thighR * 0.5];
  const ankle = [side * leg.gap * 0.8, y.ankle, leg.thighR * 0.15];
  return { hip, knee, ankle };
}

/** Linear interpolation between two 3-tuples. */
export function lerp3(a, b, t) {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}
