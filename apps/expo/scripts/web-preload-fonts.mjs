// Adds <link rel="preload"> for the reading and title faces to the exported index.html, so the
// browser fetches them while it parses the page instead of after the app's script has run.
import { readFile, readdir, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { join, relative, sep } from 'node:path'

const dist = fileURLToPath(new URL('../dist/', import.meta.url))
const faces = ['LiterataBook-Regular', 'Inter-Bold', 'FiraCode-Regular']
const types = { '.otf': 'font/otf', '.ttf': 'font/ttf', '.woff2': 'font/woff2' }

const files = await readdir(join(dist, 'assets/src/assets/fonts'))
const links = faces.map(face => {
  const file = files.find(name => name.startsWith(`${face}.`))
  if (!file) throw new Error(`Exported font missing: ${face}`)
  const href =
    '/' +
    relative(dist, join(dist, 'assets/src/assets/fonts', file))
      .split(sep)
      .join('/')
  const type = types[file.slice(file.lastIndexOf('.'))]
  return `<link rel="preload" href="${href}" as="font" type="${type}" crossorigin>`
})

const indexPath = join(dist, 'index.html')
const html = await readFile(indexPath, 'utf8')
if (!html.includes('</head>')) throw new Error('index.html has no </head>')
await writeFile(indexPath, html.replace('</head>', `${links.join('')}</head>`))
console.log(`Preloading ${links.length} fonts in index.html`)
