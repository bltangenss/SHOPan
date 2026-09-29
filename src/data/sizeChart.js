// Quick-select presets: each size maps to a full, internally-consistent set
// of measurements (not just one number), separately for each gender. Chest
// values line up with the thresholds in suggestedSize() (bodyGeometry.js)
// so the catalog's "recommended size" always agrees with the preset you
// picked here.

export const SIZE_CHART = {
  female: {
    XS: { height: 158, chest: 80, waist: 62, hips: 86, shoulder: 35 },
    S: { height: 161, chest: 88, waist: 68, hips: 92, shoulder: 37 },
    M: { height: 166, chest: 96, waist: 76, hips: 100, shoulder: 39 },
    L: { height: 170, chest: 104, waist: 86, hips: 108, shoulder: 41 },
    XL: { height: 173, chest: 112, waist: 94, hips: 116, shoulder: 43 },
    XXL: { height: 176, chest: 120, waist: 102, hips: 124, shoulder: 45 },
  },
  male: {
    XS: { height: 168, chest: 80, waist: 66, hips: 84, shoulder: 41 },
    S: { height: 172, chest: 88, waist: 72, hips: 90, shoulder: 43 },
    M: { height: 178, chest: 96, waist: 80, hips: 96, shoulder: 46 },
    L: { height: 183, chest: 104, waist: 88, hips: 102, shoulder: 49 },
    XL: { height: 187, chest: 112, waist: 96, hips: 108, shoulder: 52 },
    XXL: { height: 190, chest: 120, waist: 104, hips: 114, shoulder: 55 },
  },
};

export const SIZE_ORDER = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];
