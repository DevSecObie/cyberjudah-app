import { createRequire } from 'node:module'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const source = resolve(root, 'apps/api/functions')
const require = createRequire(resolve(source, 'package.json'))
const ts = require('typescript')
const output = resolve(root, '.scratch/generated/cyberjudah-deletion')
const config = ts.readConfigFile(resolve(source, 'tsconfig.json'), ts.sys.readFile)
if (config.error) throw new Error(ts.flattenDiagnosticMessageText(config.error.messageText, '\n'))
const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, source)
const program = ts.createProgram([resolve(source, 'src/deletionEntry.ts')], {
  ...parsed.options, rootDir: resolve(source, 'src'), outDir: output,
  sourceMap: false, noEmitOnError: true,
})
const diagnostics = ts.getPreEmitDiagnostics(program)
if (diagnostics.length) {
  process.stderr.write(ts.formatDiagnosticsWithColorAndContext(diagnostics, {
    getCanonicalFileName: path => path, getCurrentDirectory: () => root,
    getNewLine: () => '\n',
  }))
  process.exit(1)
}
rmSync(output, { recursive: true, force: true })
if (program.emit().emitSkipped) throw new Error('Deletion artifact compilation failed')
const version = name => {
  let directory = dirname(require.resolve(name))
  while (dirname(directory) !== directory) {
    const manifest = resolve(directory, 'package.json')
    if (existsSync(manifest)) {
      const data = JSON.parse(readFileSync(manifest, 'utf8'))
      if (data.name === name) return data.version
    }
    directory = dirname(directory)
  }
  throw new Error(`Cannot resolve installed version of ${name}`)
}
mkdirSync(output, { recursive: true })
writeFileSync(resolve(output, 'package.json'), JSON.stringify({
  name: 'cyberjudah-deletion-functions', private: true, version: '1.0.0',
  main: 'deletionEntry.js', engines: { node: '22' },
  dependencies: { 'firebase-admin': version('firebase-admin'), 'firebase-functions': version('firebase-functions') },
}, null, 2) + '\n')
console.log('Prepared .scratch/generated/cyberjudah-deletion; no deployment performed.')
