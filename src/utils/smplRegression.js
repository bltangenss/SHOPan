import regressionData from '../data/measurement_to_beta.json';

/**
 * Predicts the 10 SMPL shape (beta) parameters from real body measurements,
 * using a ridge regression trained by sampling thousands of SMPL bodies and
 * measuring their actual 3D geometry (see /smpl-pipeline in the project
 * history). Re-measuring the predicted body typically lands within a few cm
 * of the requested numbers — it is a best-fit approximation, not an exact
 * inversion (5 numbers can't uniquely determine 10 hidden shape components).
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

  const betas = new Array(10).fill(0);
  for (let col = 0; col < 10; col++) {
    let sum = 0;
    for (let row = 0; row < 6; row++) {
      sum += x[row] * W[row][col];
    }
    betas[col] = sum;
  }
  return betas;
}
