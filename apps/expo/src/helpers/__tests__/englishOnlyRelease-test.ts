import {
  ENABLED_APP_LANGUAGES,
  getDefaultBibleVersion,
  isAppLanguageEnabled,
} from '../languageUtils'
import { BUNDLED_MOBILE_RESOURCE_CATALOG } from '../mobileResourceCatalog'

it('ships the approved 19 English resources and retained original-language texts only', () => {
  expect(ENABLED_APP_LANGUAGES).toEqual(['en'])
  expect(isAppLanguageEnabled('fr')).toBe(false)
  expect(getDefaultBibleVersion('fr')).toBe('KJV')
  expect(Object.keys(BUNDLED_MOBILE_RESOURCE_CATALOG.resources).sort()).toEqual(
    [
      'bible-interlinear:BHG:en',
      'bible-strong:KJV',
      'bible:BHG',
      'bible:KJV',
      'bible:KJVA',
      'bible:TR1624',
      'bible:TR1894',
      'bible:WEB1833',
      'database:ISBE:en',
      'database:JEWISH_ENCYCLOPEDIA:en',
      'database:NAVE:en',
      'database:SMITH:en',
      'database:TIMELINE:en',
      'database:UNFOLDINGWORD_TW:en',
      'database:cyberjudah:en',
      'dictionary-directory',
      'strong-lexicon:entities',
      'strong-lexicon:resources',
      'strong-lexicon:simple-en',
    ].sort()
  )
  expect(BUNDLED_MOBILE_RESOURCE_CATALOG.resourceCount).toBe(19)
  expect(BUNDLED_MOBILE_RESOURCE_CATALOG.resources['database:NAVE:en']).toMatchObject({
    archiveSha256: '3e76be5791d33d23b21fb40f334d4e2b28c968d69e19ea41d6c0f32fed824766',
    archiveBytes: 2010816,
    resourceRevision: 'nave-en-a3ca283196d0eb084276',
  })
})
