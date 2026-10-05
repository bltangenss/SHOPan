import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import test from 'node:test';

function glbDocument(buffer) {
  assert.equal(buffer.subarray(0, 4).toString('ascii'), 'glTF');
  assert.equal(buffer.readUInt32LE(4), 2);
  assert.equal(buffer.readUInt32LE(8), buffer.length);
  const jsonLength = buffer.readUInt32LE(12);
  assert.equal(buffer.readUInt32LE(16), 0x4e4f534a);
  return JSON.parse(buffer.subarray(20, 20 + jsonLength).toString('utf8').trim());
}

test('realistic avatar includes rigged clothes, idle motion and facial detail', async () => {
  const [bodyBuffer, headBuffer] = await Promise.all([
    readFile(new URL('../public/models/vitruvian-body.glb', import.meta.url)),
    readFile(new URL('../public/models/vitruvian-head.glb', import.meta.url)),
  ]);
  const body = glbDocument(bodyBuffer);
  const head = glbDocument(headBuffer);

  assert.ok(body.skins?.length > 0);
  assert.ok(body.animations.some((clip) => clip.name === 'Idle'));
  assert.ok(body.meshes.some((mesh) => mesh.name === 'Plane.001'));
  assert.ok(body.meshes.some((mesh) => mesh.name === 'Plane.002'));
  assert.ok(head.materials.some((material) => material.name === 'VitSkin'));
  assert.ok(head.meshes.some((mesh) => mesh.extras?.targetNames?.includes('Eyes_Closed_Max')));

  const texture = await stat(new URL('../public/models/vit-face-bc.webp', import.meta.url));
  assert.ok(texture.size > 10_000);
});
