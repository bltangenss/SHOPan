import regressionData from '../data/measurement_to_beta.json' with { type: 'json' };

export const SMPL_SHAPE_COMPONENTS = 300;
export const MEASUREMENT_DRIVEN_COMPONENTS = 10;

/**
 * Produces the full 300-value SMPL shape vector. The five available body
 * measurements drive the first 10 principal components through the existing
 * calibrated regression. The remaining components stay neutral because five
 * measurements cannot identify 290 extra degrees of freedom reliably.
 */
export function predictBetas(gender, measurements) {
  const reg = regressionData[gender] ?? regressionData.female;
  const W = reg.weights; // (6, 10): rows = [height_m, chest_m, waist_m, hip_m, shoulder_m, bias]

  const x = [
    measurements.height / 100,
    measurements.chest / 100,
    measurements.waist / 100,
    measurements.hips / 100,
    measurements.shoulder / 100,
    1,
  ];

  const betas = new Array(SMPL_SHAPE_COMPONENTS).fill(0);
  for (let col = 0; col < MEASUREMENT_DRIVEN_COMPONENTS; col++) {
    let sum = 0;
    for (let row = 0; row < 6; row++) {
      sum += x[row] * W[row][col];
    }
    betas[col] = sum;
  }
  return betas;
}
