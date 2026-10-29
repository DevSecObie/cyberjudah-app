import { readFile, readdir } from 'node:fs/promises'
import assert from 'node:assert/strict'
import { resolve, join } from 'node:path'
import { execFileSync } from 'node:child_process'
const app = resolve(import.meta.dirname, '..'),
  platform = process.argv[2]
if (platform === 'android') {
  const config = JSON.parse(await readFile(join(app, 'android/app/google-services.json'), 'utf8'))
  assert.equal(config.project_info.project_id, 'cyberjudah-app')
  assert(
    config.client.some(c => c.client_info.android_client_info?.package_name === 'io.cyberjudah.app')
  )
} else if (platform === 'ios') {
  const files = await readdir(join(app, 'ios'), { recursive: true })
  const path = files.find(f => f.endsWith('/GoogleService-Info.plist') && !f.startsWith('Pods/'))
  assert(path, 'Generated iOS Firebase configuration is missing')
  const config = JSON.parse(
    execFileSync(
      'python3',
      [
        '-c',
        'import plistlib,json,sys; print(json.dumps(plistlib.load(open(sys.argv[1],"rb"))))',
        join(app, 'ios', path),
      ],
      { encoding: 'utf8' }
    )
  )
  assert.equal(config.PROJECT_ID, 'cyberjudah-app')
  assert.equal(config.BUNDLE_ID, 'io.cyberjudah.app.dev')
} else throw new Error('Choose android or ios')
console.log(`${platform}: CyberJudah Firebase project and application identity verified`)
