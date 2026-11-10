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
  const gradle = await readFile(join(app, 'android/app/build.gradle'), 'utf8')
  assert.match(gradle, /applicationId ['"]io\.cyberjudah\.app['"]/)
  // The Google Play build must carry the version code it picked, or Play refuses the upload.
  const versionCode = process.env.CYBERJUDAH_ANDROID_VERSION_CODE
  if (versionCode) assert.match(gradle, new RegExp(`versionCode ${versionCode}\\b`))
} else if (platform === 'ios') {
  const podProperties = JSON.parse(await readFile(join(app, 'ios/Podfile.properties.json'), 'utf8'))
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
  const target = process.env.CYBERJUDAH_IOS_TARGET || 'staging'
  const bundles = { staging: 'io.cyberjudah.app.dev', production: 'io.cyberjudah.app' }
  assert(bundles[target], 'CYBERJUDAH_IOS_TARGET must be staging or production')
  assert.equal(config.BUNDLE_ID, bundles[target])
} else throw new Error('Choose android or ios')
console.log(`${platform}: CyberJudah Firebase project and application identity verified`)
