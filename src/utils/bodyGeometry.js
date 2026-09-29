// All measurements come in centimetres from the form.
// Scene units = metres (1 unit = 1m).
// This is a *stylised, procedural* mannequin built from primitives — a
// genuine approximation of human proportions and joints, not a scanned or
// rigged photorealistic mesh (that needs external 3D assets/GPU models this
// offline prototype doesn't have access to).

const cmToM = (cm) => cm / 100;

export const radiusFromCircumference = (cm) => cmToM(cm) / (2 * Math.PI);

/**
 * Derive every dimension the body, joints and garments need from the
 * measurements + gender preset. Gender only nudges the *shape* slightly
 * (jaw width, waist definition, hair style) — the numbers you enter are
 * still what drives the silhouette.
 */
export function computeBodyMetrics({ height, chest, waist, hips, shoulder, gender = 'female' }) {
  const H = cmToM(height);
  const isFem = gender === 'female';

  const chestR = radiusFromCircumference(chest);
  const waistR = radiusFromCircumference(waist) * (isFem ? 0.97 : 1);
  const hipR = radiusFromCircumference(hips) * (isFem ? 1.02 : 1);
  const shoulderHalf = cmToM(shoulder) / 2;

  // ---- Landmark heights (fractions of total height, standard croquis proportions) ----
  const y = {
    floor: 0,
    ankle: 0.045 * H,
    knee: 0.285 * H,
    hip: 0.5 * H, // crotch — where legs meet torso (matches the SMPL measurement calibration)
    waist: 0.62 * H,
    chest: 0.74 * H,
    shoulder: 0.82 * H,
    neckBase: 0.855 * H,
    chin: 0.875 * H,
    headTop: H,
  };

  const headR = {
    x: 0.06 * H * (isFem ? 0.98 : 1.04),
    y: 0.069 * H,
    z: 0.058 * H * (isFem ? 0.97 : 1.05),
  };
  const neckR = Math.max(shoulderHalf * 0.32, 0.026 * H);

  // ---- Arm chain: shoulder -> elbow -> wrist -> hand ----
  const arm = {
    upperLen: 0.2 * H,
    foreLen: 0.17 * H,
    handLen: 0.065 * H,
    upperR: chestR * 0.27,
    elbowR: chestR * 0.27 * 0.92,
    wristR: chestR * 0.27 * 0.6,
    handR: chestR * 0.27 * 0.56,
    gap: shoulderHalf * 1.02,
    splay: 0.16, // outward lean, radians
  };

  // ---- Leg chain: hip -> knee -> ankle -> foot ----
  const leg = {
    thighLen: y.hip - y.knee,
    calfLen: y.knee - y.ankle,
    thighR: hipR * 0.55,
    kneeR: hipR * 0.55 * 0.74,
    ankleR: hipR * 0.55 * 0.5,
    gap: hipR * 0.42,
    footLen: 0.16 * H,
    footH: 0.032 * H,
  };

  return {
    H,
    gender,
    chestR,
    waistR,
    hipR,
    shoulderHalf,
    headR,
    neckR,
    y,
    arm,
    leg,
    hairStyle: isFem ? 'long' : 'short',
  };
}

/**
 * Torso point profile (radius vs. height) for a Lathe geometry — used for
 * the bare body and every torso garment, with different eases/hems.
 */
export function torsoProfile(metrics, { hemY, ease = 1 } = {}) {
  const { hipR, waistR, chestR, shoulderHalf, neckR, y } = metrics;
  const hem = hemY ?? y.hip;

  const pts = [
    { y: hem, r: hipR * 0.97 * ease },
    { y: y.hip, r: hipR * ease },
    { y: y.hip + (y.waist - y.hip) * 0.4, r: hipR * 0.9 * ease + waistR * 0.1 * ease },
    { y: y.waist, r: waistR * ease },
    { y: y.waist + (y.chest - y.waist) * 0.55, r: waistR * 0.55 * ease + chestR * 0.45 * ease },
    { y: y.chest, r: chestR * ease },
    { y: (y.chest + y.shoulder) / 2, r: chestR * 0.98 * ease },
    { y: y.shoulder, r: shoulderHalf * 0.86 * ease },
    { y: y.neckBase, r: neckR * ease * 0.9 },
  ];

  return pts.filter((p) => p.y >= hem - 1e-6);
}

/** Skirt-style flare below the hip, used for the dress hem. */
export function dressProfile(metrics, { hemY, flareR, ease = 1.12 } = {}) {
  const top = torsoProfile(metrics, { hemY: metrics.y.hip, ease });
  const { hipR, y } = metrics;
  const hem = hemY ?? 0.28 * metrics.H;
  const flare = flareR ?? hipR * 1.5;

  const skirt = [
    { y: hem, r: flare },
    { y: y.hip * 0.55 + hem * 0.45, r: hipR * ease * 1.08 },
    { y: y.hip, r: hipR * ease },
  ];

  return [...skirt, ...top.filter((p) => p.y > y.hip)];
}

/** Simple straight skirt (knee/midi length), narrower flare than the dress. */
export function skirtProfile(metrics, { hemY, ease = 1.1 } = {}) {
  const { hipR, waistR, y } = metrics;
  const hem = hemY ?? 0.32 * metrics.H;
  return [
    { y: hem, r: hipR * ease * 0.92 },
    { y: y.hip * 0.5 + hem * 0.5, r: hipR * ease * 1.02 },
    { y: y.hip, r: hipR * ease },
    { y: y.waist, r: waistR * ease },
  ];
}

export function latheGeometryFromProfile(profile) {
  return profile.map((p) => ({ x: Math.max(p.r, 0.001), y: p.y }));
}

/** Basic tailoring size chart driven by chest circumference (cm), unisex. */
export function suggestedSize(chestCm) {
  if (chestCm < 84) return 'XS';
  if (chestCm < 92) return 'S';
  if (chestCm < 100) return 'M';
  if (chestCm < 108) return 'L';
  if (chestCm < 116) return 'XL';
  return 'XXL';
}
