import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const root = fileURLToPath(new URL('../../../..', import.meta.url))
test('isolated artifact exports only deletion and rejects the inherited project', () => {
  const build = spawnSync(process.execPath, ['scripts/prepare-cyberjudah-deletion.mjs'], { cwd: root, encoding: 'utf8' })
  assert.equal(build.status, 0, build.stderr)
  const artifact = resolve(root, '.scratch/generated/cyberjudah-deletion')
  assert.deepEqual(readdirSync(artifact).sort(), [
    'deleteStudyTree.js', 'deletionEntry.js', 'package.json', 'studyFiles.js', 'users.js',
  ])
  const manifest = JSON.parse(readFileSync(resolve(artifact, 'package.json'), 'utf8'))
  assert.equal(manifest.engines.node, '22')
  for (const projectId of ['cyberjudah-app', 'bible-strong-app']) {
    const result = spawnSync(process.execPath, ['-e', `console.log(JSON.stringify(Object.keys(require(${JSON.stringify(resolve(artifact, 'deletionEntry.js'))}))))`], {
      cwd: root, encoding: 'utf8', env: {
        ...process.env,
        FIREBASE_CONFIG: JSON.stringify({ projectId }), GCLOUD_PROJECT: projectId,
        NODE_PATH: [resolve(root, 'apps/api/functions/node_modules'), resolve(root, 'node_modules')].join(':'),
      },
    })
    if (projectId === 'cyberjudah-app') {
      assert.equal(result.status, 0, result.stderr)
      assert.deepEqual(JSON.parse(result.stdout.trim()), ['deleteUser'])
    } else {
      assert.notEqual(result.status, 0)
      assert.match(result.stderr, /require project cyberjudah-app/)
    }
  }
})
