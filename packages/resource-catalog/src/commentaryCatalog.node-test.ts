import assert from 'node:assert/strict'
import test from 'node:test'

import { BUNDLED_MOBILE_RESOURCE_CATALOG } from './catalog'
import { BASE_COMMENTARY_CATALOG, COMMENTARY_CATALOG } from './commentaryCatalog'

test('the active commentary catalog contains retained resources only', () => {
  assert.ok(BASE_COMMENTARY_CATALOG.length > 0)
  for (const entry of COMMENTARY_CATALOG) {
    for (const language of entry.languages) {
      assert.ok(
        BUNDLED_MOBILE_RESOURCE_CATALOG.resources[`database:${entry.publicationId}:${language}`]
      )
    }
  }
  for (const removed of BASE_COMMENTARY_CATALOG) {
    assert.ok(!COMMENTARY_CATALOG.some(entry => entry.id === removed.id))
  }
})

test('commentary short names do not duplicate their language', () => {
  for (const commentary of COMMENTARY_CATALOG) {
    assert.doesNotMatch(commentary.shortName, /(?:\s|[-_])(fr|en)$/i)
  }
})
