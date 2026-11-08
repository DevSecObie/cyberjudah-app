// Build Bible Strong's English Strong lexicon module (strong_lexicon.simple-en.sqlite) from
// CyberJudah's published Strong's dictionaries: the same entries the CyberJudah server serves
// online (cyberjudah data/strongs/hebrew.json and greek.json, read by its /bs strong-lexicon feed).
// Each entry's word, gloss and definition are written exactly as the online reader shows them.
//
//   node scripts/build-cyberjudah-strong-lexicon.mjs path/to/cyberjudah/data/strongs
import { readFile, writeFile, rm } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { DatabaseSync } from 'node:sqlite'
import { join, resolve } from 'node:path'
import { execFileSync } from 'node:child_process'

const app = resolve(import.meta.dirname, '..')
const source = process.argv[2]
if (!source) throw new Error('usage: build-cyberjudah-strong-lexicon.mjs <cyberjudah/data/strongs>')
const output = join(app, 'public/offline/databases')
const file = 'strong_lexicon.simple-en.sqlite'
const hash = data => createHash('sha256').update(data).digest('hex')

const sources = JSON.parse(await readFile(join(source, 'sources.json'), 'utf8'))
const dictionaries = {
  hebrew: JSON.parse(await readFile(join(source, 'hebrew.json'), 'utf8')),
  greek: JSON.parse(await readFile(join(source, 'greek.json'), 'utf8')),
}

// The online reader's text, as the CyberJudah server writes it (bot/src/bs/strongs.ts).
const GREEK = {
  α: 'a',
  β: 'b',
  γ: 'g',
  δ: 'd',
  ε: 'e',
  ζ: 'z',
  η: 'ē',
  θ: 'th',
  ι: 'i',
  κ: 'k',
  λ: 'l',
  μ: 'm',
  ν: 'n',
  ξ: 'x',
  ο: 'o',
  π: 'p',
  ρ: 'r',
  σ: 's',
  ς: 's',
  τ: 't',
  υ: 'u',
  φ: 'ph',
  χ: 'ch',
  ψ: 'ps',
  ω: 'ō',
}
const greekTransliteration = lemma =>
  lemma
    .normalize('NFD')
    .toLowerCase()
    .split(/\s+/)
    .map(word => {
      let out = ''
      const letters = [...word]
      for (let i = 0; i < letters.length; i++) {
        const ch = letters[i]
        if (/[\u0300-\u036f]/.test(ch)) continue
        const marks =
          letters
            .slice(i + 1)
            .join('')
            .match(/^[\u0300-\u036f]*/)?.[0] ?? ''
        const rough = marks.includes('\u0314')
        if (ch === 'γ' && /[γκξχ]/.test(letters[i + 1] ?? '')) {
          out += 'n'
          continue
        }
        if (ch === 'υ' && /[αεηο]/.test(out.slice(-1))) {
          out += 'u'
          continue
        }
        const latin = GREEK[ch] ?? (/[a-z]/.test(ch) ? ch : '')
        if (ch === 'ρ' && rough) {
          out += 'rh'
          continue
        }
        out = rough && /^[aeēiouō]*$/.test(out) ? `h${out}${latin}` : out + latin
      }
      return out
    })
    .join(' ')
const ORIGIN =
  /^(?:from|of|compare|apparently|probably|perhaps|akin|including|namely|used|which|and|or|by|through|in|as|occurs|an? (?:prolonged|primary|reduplicated|form|derivative|middle|adverb|particle)|adverb|feminine|neuter|masculine|plural|contracted|corresponding|another|\()/i
const clauses = text => {
  const out = []
  let depth = 0,
    start = 0
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '(') depth++
    else if (text[i] === ')') depth = Math.max(0, depth - 1)
    else if (text[i] === ';' && depth === 0) {
      out.push(text.slice(start, i))
      start = i + 1
    }
  }
  return [...out, text.slice(start)].map(s => s.trim()).filter(Boolean)
}
const strongText = data =>
  [data.derivation, data.def]
    .map(s => (s ?? '').trim())
    .filter(Boolean)
    .join(' ')
const strongGloss = (code, data) => {
  const def = (data.def ?? '').trim()
  const parts = code[0] === 'G' ? clauses(data.derivation ?? '') : []
  const first = parts.findIndex((p, i) => i > 0 && !ORIGIN.test(p))
  const lead = first < 0 ? '' : parts.slice(first).join('; ')
  return [lead, def].filter(Boolean).join('; ') || (data.kjv ?? '').trim()
}
const html = text =>
  String(text)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')

const entries = []
for (const [language, dictionary] of Object.entries(dictionaries)) {
  for (const [raw, data] of Object.entries(dictionary)) {
    const match = /^([HG])0*([1-9]\d*)$/.exec(raw)
    if (!match || (match[1] === 'H') !== (language === 'hebrew'))
      throw new Error(`Invalid Strong number ${raw}`)
    const code = `${match[1]}${Number(match[2])}`
    const baseCode = Number(match[2])
    const lemma = (data.lemma ?? '').trim()
    entries.push({
      id: baseCode + (language === 'greek' ? 100000 : 0),
      language,
      baseCode,
      code,
      original: lemma,
      transliteration:
        data.xlit || (language === 'greek' && lemma ? greekTransliteration(lemma) : ''),
      pronunciation: (data.pron ?? '').trim(),
      gloss: strongGloss(code, data),
      meaning: [strongText(data), data.kjv?.trim(), data.source?.trim()]
        .filter(Boolean)
        .map(text => `<p>${html(text)}</p>`)
        .join(''),
    })
  }
}
entries.sort((a, b) => a.id - b.id)

const contentRevision = hash(JSON.stringify(entries))
const resourceRevision = `cj-strong-lexicon-simple-en-${contentRevision.slice(0, 24)}`
const dbPath = join(output, file)
execFileSync('mkdir', ['-p', output])
await rm(dbPath, { force: true })
const db = new DatabaseSync(dbPath)
db.exec(`PRAGMA journal_mode=DELETE;
CREATE TABLE DictionaryMeta (key TEXT PRIMARY KEY, value TEXT NOT NULL) WITHOUT ROWID;
CREATE TABLE StepEntries (
  id INTEGER PRIMARY KEY, language TEXT NOT NULL, baseCode INTEGER NOT NULL,
  eStrong TEXT NOT NULL, dStrong TEXT NOT NULL, uStrong TEXT NOT NULL, original TEXT NOT NULL,
  transliteration TEXT NOT NULL, morph TEXT NOT NULL, gloss TEXT NOT NULL, meaning TEXT NOT NULL,
  classicTransliteration TEXT NOT NULL, pronunciation TEXT NOT NULL);
CREATE INDEX idx_StepEntries_language_baseCode ON StepEntries(language,baseCode);
CREATE INDEX idx_StepEntries_eStrong ON StepEntries(eStrong);
CREATE TABLE StepEntryIdentities (stepEntryId INTEGER PRIMARY KEY, stepCode TEXT NOT NULL);
CREATE UNIQUE INDEX idx_StepEntryIdentities_stepCode ON StepEntryIdentities(stepCode);
CREATE TABLE LexiconTranslations (
  stepEntryId INTEGER NOT NULL, language TEXT NOT NULL, gloss TEXT NOT NULL, meaning TEXT NOT NULL,
  meaningHtml TEXT NOT NULL, PRIMARY KEY(stepEntryId,language)) WITHOUT ROWID;
CREATE TABLE LexiconNameMeanings (
  stepEntryId INTEGER NOT NULL, language TEXT NOT NULL, valueHtml TEXT NOT NULL,
  valueText TEXT NOT NULL, source TEXT NOT NULL, sourceField TEXT NOT NULL,
  sourceTextSha256 TEXT NOT NULL, translationEngine TEXT NOT NULL,
  PRIMARY KEY(stepEntryId,language)) WITHOUT ROWID;
CREATE TABLE RelationKinds (
  id INTEGER PRIMARY KEY, kind TEXT NOT NULL UNIQUE, labelEn TEXT NOT NULL, labelFr TEXT NOT NULL);
CREATE TABLE LexiconRelations (
  id INTEGER PRIMARY KEY, fromStepEntryId INTEGER NOT NULL, toStepEntryId INTEGER,
  toStepCode TEXT NOT NULL, groupKind TEXT NOT NULL, relationKindId INTEGER NOT NULL,
  sortOrder INTEGER NOT NULL);
CREATE TABLE MorphologyCodes (
  id INTEGER PRIMARY KEY, code TEXT NOT NULL, normalizedCode TEXT NOT NULL, language TEXT NOT NULL,
  scope TEXT NOT NULL, meaning TEXT NOT NULL, description TEXT NOT NULL);
CREATE TABLE MorphologyCodeTranslations (
  morphologyCodeId INTEGER NOT NULL, language TEXT NOT NULL, meaning TEXT NOT NULL,
  description TEXT NOT NULL, PRIMARY KEY(morphologyCodeId,language)) WITHOUT ROWID;
BEGIN;`)
const entryInsert = db.prepare("INSERT INTO StepEntries VALUES(?,?,?,'','',?,?,?,'',?,?,'',?)")
const identityInsert = db.prepare('INSERT INTO StepEntryIdentities VALUES(?,?)')
for (const entry of entries) {
  entryInsert.run(
    entry.id,
    entry.language,
    entry.baseCode,
    entry.code,
    entry.original,
    entry.transliteration,
    entry.gloss,
    entry.meaning,
    entry.pronunciation
  )
  identityInsert.run(entry.id, entry.code)
}
const meta = db.prepare('INSERT INTO DictionaryMeta VALUES(?,?)')
for (const [key, value] of Object.entries({
  moduleKind: 'simple-en',
  moduleSchemaVersion: '1',
  resourceIdentity: 'strong-lexicon:simple-en',
  resourceRevision,
  language: 'en',
  source: sources.dictionaries,
}))
  meta.run(key, value)
db.exec('COMMIT; ANALYZE; VACUUM;')
if (db.prepare('PRAGMA integrity_check').get().integrity_check !== 'ok')
  throw new Error('Invalid SQLite archive')
db.close()

execFileSync('python3', [
  '-c',
  `import zipfile,sys,pathlib\np=pathlib.Path(sys.argv[1])\nwith zipfile.ZipFile(str(p)+'.zip','w',compression=zipfile.ZIP_DEFLATED,compresslevel=9) as z:\n info=zipfile.ZipInfo(p.name,(2026,10,25,0,0,0)); info.compress_type=zipfile.ZIP_DEFLATED; info.external_attr=0o100644<<16; z.writestr(info,p.read_bytes())`,
  dbPath,
])
const data = await readFile(dbPath)
const archive = await readFile(dbPath + '.zip')
await rm(dbPath)

const catalogPath = join(app, 'src/assets/cyberjudah/offline-catalog.json')
const catalog = JSON.parse(await readFile(catalogPath, 'utf8'))
const id = 'strong-lexicon:simple-en'
catalog.resources[id] = {
  id,
  url: `https://api.cyberjudah.io/v1/offline-artifacts/databases/${file}.zip?sha256=${hash(archive)}`,
  file: `databases/${file}.zip`,
  entry: file,
  entries: { canonical: { entry: file, sha256: hash(data), bytes: data.length } },
  archiveSha256: hash(archive),
  archiveBytes: archive.length,
  contentSha256: hash(data),
  contentBytes: data.length,
  installedBytes: data.length,
  peakInstallationBytes: data.length * 2 + archive.length,
  strategy: 'archive-extract',
  resourceRevision,
}
catalog.resourceCount = Object.keys(catalog.resources).length
await writeFile(catalogPath, JSON.stringify(catalog, null, 2) + '\n')
await writeFile(join(app, 'public/offline/catalog.json'), JSON.stringify(catalog))
console.log(
  JSON.stringify({
    entries: entries.length,
    hebrew: entries.filter(e => e.language === 'hebrew').length,
    greek: entries.filter(e => e.language === 'greek').length,
    resourceRevision,
    archiveBytes: archive.length,
    contentBytes: data.length,
  })
)

// Shared packaging adapter reads src/assets/cyberjudah/canonical-book-map.json.
execFileSync('python3', [join(app, 'scripts/normalize-cyberjudah-content.py')], { stdio: 'inherit' })
