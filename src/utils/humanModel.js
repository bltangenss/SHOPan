const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export const HUMAN_MODELS = {
  female: {
    minY: -0.010073230601847172,
    height: 1.755947277881205,
    referenceChest: 90,
    referenceShoulder: 40,
  },
  male: {
    minY: -0.010073230601847172,
    height: 1.755947277881205,
    referenceChest: 100,
    referenceShoulder: 44,
  },
};

export function getHumanModel(gender) {
  return HUMAN_MODELS[gender] || HUMAN_MODELS.female;
}

export function getHumanTransform(gender, measurements) {
  const model = getHumanModel(gender);
  const requestedHeight = measurements.height / 100;
  const heightScale = requestedHeight / model.height;
  const chestRatio = measurements.chest / model.referenceChest;
  const shoulderRatio = measurements.shoulder / model.referenceShoulder;
  const widthFactor = clamp(chestRatio * 0.55 + shoulderRatio * 0.45, 0.9, 1.12);
  const depthFactor = clamp(0.94 + (chestRatio - 0.94) * 0.58, 0.91, 1.1);

  return {
    scale: [heightScale * widthFactor, heightScale, heightScale * depthFactor],
    shiftY: -model.minY * heightScale,
  };
}
