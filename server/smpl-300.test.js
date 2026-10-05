import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { MEASUREMENT_DRIVEN_COMPONENTS, predictBetas, SMPL_SHAPE_COMPONENTS } from '../src/utils/smplRegression.js';

const MODELS = ['female', 'male'];

function glbDocument(buffer) {
  assert.equal(buffer.subarray(0, 4).toString('ascii'), 'glTF');
  assert.equal(buffer.readUInt32LE(4), 2);
  assert.equal(buffer.readUInt32LE(8), buffer.length);
  const jsonLength = buffer.readUInt32LE(12);
  assert.equal(buffer.readUInt32LE(16), 0x4e4f534a);
  return JSON.parse(buffer.subarray(20, 20 + jsonLength).toString('utf8').trim());
}

test('body measurements produce an honest 300-component SMPL vector', () => {
  const betas = predictBetas('female', { height: 168, chest: 92, waist: 74, hips: 98, shoulder: 40 });
  assert.equal(betas.length, SMPL_SHAPE_COMPONENTS);
  assert.ok(betas.slice(0, MEASUREMENT_DRIVEN_COMPONENTS).every(Number.isFinite));
  assert.ok(betas.slice(MEASUREMENT_DRIVEN_COMPONENTS).every((value) => value === 0));
});

for (const gender of MODELS) {
  test(`${gender} browser model exposes all 300 SMPL shape targets`, async () => {
    const buffer = await readFile(new URL(`../public/models/smpl_${gender}_300.glb`, import.meta.url));
    const document = glbDocument(buffer);
    const mesh = document.meshes[0];
    assert.equal(mesh.primitives[0].targets.length, SMPL_SHAPE_COMPONENTS);
    assert.equal(mesh.weights.length, SMPL_SHAPE_COMPONENTS);
    assert.equal(mesh.extras.targetNames.length, SMPL_SHAPE_COMPONENTS);
    assert.equal(mesh.extras.smplShapeComponents, SMPL_SHAPE_COMPONENTS);
    assert.equal(mesh.extras.measurementDrivenComponents, MEASUREMENT_DRIVEN_COMPONENTS);
  });
}
