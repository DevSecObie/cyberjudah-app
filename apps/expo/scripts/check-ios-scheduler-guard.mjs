// Release assertion: the installed (patched) React Native keeps the native scheduler delegate
// lifetime guard (.yarn/patches/react-native-npm-0.88.0-*.patch). React Native 0.88 has no
// enableSchedulerDelegateInvalidation flag, so the guard is patched into Scheduler itself: each
// rendering update queued with the raw delegate pointer carries a token that teardown or a new
// delegate invalidates, and the update no-ops instead of using a dangling delegate.
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

const scheduler = resolve(
  import.meta.dirname,
  '../node_modules/react-native/ReactCommon/react/renderer/scheduler'
)
const source = readFileSync(join(scheduler, 'Scheduler.cpp'), 'utf8')
const header = readFileSync(join(scheduler, 'Scheduler.h'), 'utf8')

const checks = [
  ['the token is declared', /std::shared_ptr<std::atomic<bool>> delegateInvalidated_/.test(header)],
  ['teardown invalidates it', /~Scheduler\(\) \{\s*\/\/[^\n]*\n[^\n]*\n\s*\*delegateInvalidated_ = true;/.test(source)],
  [
    'a new delegate invalidates the old token and takes a fresh one',
    /setDelegate\(SchedulerDelegate\* delegate\) \{[\s\S]*?\*delegateInvalidated_ = true;\s*delegateInvalidated_ = std::make_shared<std::atomic<bool>>\(false\);/.test(
      source
    ),
  ],
  [
    'both deferred delegate calls check the token',
    (source.match(/invalidated = delegateInvalidated_,/g) ?? []).length === 2 &&
      (source.match(/if \(\*invalidated\) \{\s*return;\s*\}/g) ?? []).length === 2,
  ],
]
const missing = checks.filter(([, ok]) => !ok).map(([name]) => name)
if (missing.length) {
  console.error(`Missing native scheduler delegate lifetime guard: ${missing.join('; ')}`)
  process.exit(1)
}
console.log('React Native scheduler delegate lifetime guard is in place')
