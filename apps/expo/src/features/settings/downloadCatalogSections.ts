import {
  getSimpleStrongModuleId,
  isStandaloneStrongModule,
} from '@bible-strong/resource-domain/strong-lexicon'
import { versions, type Version } from '~helpers/bibleVersions'
import { databases } from '~helpers/databases'
import {
  LANGUAGE_SPECIFIC_DBS,
  SHARED_DBS,
  FRENCH_ONLY_DBS,
  type DatabaseId,
  type ResourceLanguage,
} from '~helpers/databaseTypes'
import {
  createCommentaryDownloadItem,
  createOfflineCopyDownloadItem,
} from '~helpers/downloadItemFactory'
import { createOfflineCopyId } from '~helpers/offlineCopyId'
import { MOBILE_RESOURCE_CATALOG } from '~helpers/mobileResourceCatalog'
import type { StrongLexiconModuleId } from '~helpers/strongLexiconPublications'
import { getCommentaryCatalogForLanguage } from '~helpers/commentaryCatalog'
import type { DictionaryWork } from '~features/resources/dictionaryAccess'
import { buildBibleVersionGroups } from './downloadVersionGroups'
import { buildBibleItems, type UnifiedDownloadItem } from './downloadBibleItems'
import {
  buildDownloadResourceSections,
  flattenDownloadSubsections,
  type DisplayDownloadItem,
  type DownloadResourceSection,
} from './downloadResourceSections'

type UnifiedItem = UnifiedDownloadItem
type UnifiedSection = DownloadResourceSection & { data: DisplayDownloadItem[] }

function buildDatabaseItems(
  lang: ResourceLanguage,
  includeLegacyDictionary: boolean
): UnifiedItem[] {
  const allDbs = databases(lang)
  return LANGUAGE_SPECIFIC_DBS.flatMap(dbId => {
    if (
      dbId === 'BIBLES' ||
      dbId === 'MHY' ||
      (!includeLegacyDictionary && dbId === 'DICTIONNAIRE') ||
      (lang === 'en' && FRENCH_ONLY_DBS.includes(dbId))
    ) {
      return []
    }
    const db = allDbs[dbId as keyof typeof allDbs]
    const id = createOfflineCopyId({ kind: 'database', databaseId: dbId, language: lang })
    const artifact = MOBILE_RESOURCE_CATALOG.resources[id]
    return db && artifact
      ? [
          {
            id,
            name: db.name,
            subtitle: db.desc,
            estimatedSize: artifact.archiveBytes,
            lang: lang as 'fr' | 'en',
            searchText: `${db.name} ${db.desc} ${dbId}`.toLowerCase(),
          },
        ]
      : []
  })
}

function buildDictionaryItems(works: readonly DictionaryWork[]): UnifiedItem[] {
  return works.flatMap(work => {
    const identity = {
      kind: 'dictionary' as const,
      work: work.resource.work,
      resourceId: work.resourceId,
      language: work.resource.language,
    }
    try {
      const item = createOfflineCopyDownloadItem(identity)
      const name = work.authors[0] ? `${work.authors[0]} — ${work.title}` : work.title
      return [
        {
          id: item.id,
          name,
          subtitle: [work.description, work.edition].filter(Boolean).join(' · '),
          estimatedSize: item.estimatedSize,
          lang: work.resource.language,
          searchText: [work.title, work.abbreviation, work.source, ...work.authors]
            .join(' ')
            .toLocaleLowerCase(),
        },
      ]
    } catch {
      return []
    }
  })
}

function buildCommentaryItems(lang: ResourceLanguage): UnifiedItem[] {
  return getCommentaryCatalogForLanguage(lang)
    .filter(
      entry =>
        MOBILE_RESOURCE_CATALOG.resources[
          createOfflineCopyId({
            kind: 'commentary',
            resourceId: entry.publicationId,
            language: lang,
          })
        ]
    )
    .map(entry => {
      const identity = {
        kind: 'commentary' as const,
        resourceId: entry.publicationId,
        language: lang,
      }
      const item = createCommentaryDownloadItem(identity, entry.title)
      return {
        id: item.id,
        name: entry.title,
        subtitle: `${entry.author} · ${entry.rights}`,
        estimatedSize: item.estimatedSize,
        lang,
        searchText: [entry.title, entry.author, entry.shortName, entry.tradition, ...entry.tags]
          .join(' ')
          .toLocaleLowerCase(),
      }
    })
}

function buildStrongLexiconItems(
  lang: ResourceLanguage,
  t: (key: string, options?: Record<string, unknown>) => string
): UnifiedItem[] {
  const simpleModuleId = getSimpleStrongModuleId(lang)
  const coreId = createOfflineCopyId({ kind: 'strong-lexicon-module', moduleId: 'core' })
  const simpleId = createOfflineCopyId({ kind: 'strong-lexicon-module', moduleId: simpleModuleId })
  const candidates: (Omit<UnifiedItem, 'id' | 'estimatedSize'> & {
    moduleId: StrongLexiconModuleId
  })[] = [
    {
      moduleId: simpleModuleId,
      name: t(
        lang === 'fr'
          ? 'offlineSetup.resources.simpleLexiconFr'
          : 'offlineSetup.resources.simpleLexiconEn'
      ),
      subtitle: t('offlineSetup.option.simpleLexiconDescription'),
      lang,
      searchText: 'strong lexique simple grec hébreu français anglais',
    },
    {
      moduleId: 'core',
      name: t('offlineSetup.resources.detailedLexicon'),
      parentItemId: simpleId,
      subtitle: t('offlineSetup.option.strongLexiconDescription'),
      lang: 'other',
      searchText: 'strong lexique grec hébreu core step morphology',
    },
    {
      moduleId: 'resources',
      name: t('offlineSetup.resources.greekDictionary'),
      subtitle: t('offlineSetup.option.greekDictionaryDescription'),
      parentItemId: coreId,
      lang: 'other',
      searchText: 'strong grec lsj tflsj ressources',
    },
    {
      moduleId: 'entities',
      name: t('offlineSetup.resources.entities'),
      subtitle: t('offlineSetup.option.entitiesDescription'),
      parentItemId: coreId,
      lang: 'other',
      searchText: 'strong entités bibliques personnes lieux groupes',
    },
  ]
  // An online reader does not imply an installable archive. Filter before calling the
  // strict download factory, so a smaller publication catalog cannot crash this screen.
  return candidates.flatMap(({ moduleId, parentItemId, ...details }) => {
    const identity = { kind: 'strong-lexicon-module' as const, moduleId }
    const id = createOfflineCopyId(identity)
    if (!MOBILE_RESOURCE_CATALOG.resources[id]) return []
    if (!isStandaloneStrongModule(moduleId) && !MOBILE_RESOURCE_CATALOG.resources[coreId]) return []
    const item = createOfflineCopyDownloadItem(identity)
    return [
      {
        ...details,
        id,
        estimatedSize: item.estimatedSize,
        ...(parentItemId && MOBILE_RESOURCE_CATALOG.resources[parentItemId]
          ? { parentItemId }
          : {}),
      },
    ]
  })
}

function buildSharedDatabaseItems(): UnifiedItem[] {
  const allDbs = databases('fr')
  return SHARED_DBS.filter(
    (dbId): dbId is Exclude<DatabaseId, 'BIBLES'> =>
      dbId !== 'BIBLES' &&
      dbId in allDbs &&
      !!MOBILE_RESOURCE_CATALOG.resources[
        createOfflineCopyId({ kind: 'database', databaseId: dbId, language: 'fr' })
      ]
  ).map(dbId => {
    const db = allDbs[dbId as keyof typeof allDbs]
    return {
      id: createOfflineCopyId({ kind: 'database', databaseId: dbId, language: 'fr' }),
      name: db.name,
      subtitle: db.desc,
      estimatedSize:
        MOBILE_RESOURCE_CATALOG.resources[
          createOfflineCopyId({ kind: 'database', databaseId: dbId, language: 'fr' })
        ].archiveBytes,
      lang: 'fr' as const,
      searchText: `${db.name} ${db.desc} ${dbId}`.toLowerCase(),
    }
  })
}

export function buildDownloadCatalogSections(
  appLang: string,
  t: (key: string, options?: Record<string, unknown>) => string,
  dictionaryWorks: readonly DictionaryWork[]
): UnifiedSection[] {
  const allVersions = Object.values(versions) as Version[]
  const bibleGroups = new Map(
    buildBibleVersionGroups(allVersions, appLang).map(group => [
      group.key,
      buildBibleItems(group.versions, appLang, t),
    ])
  )
  const frenchDictionaries = dictionaryWorks.filter(work => work.resource.language === 'fr')
  const englishDictionaries = dictionaryWorks.filter(work => work.resource.language === 'en')
  const sharedStudyTools = buildSharedDatabaseItems()
  const sections = buildDownloadResourceSections({
    titles: {
      french: t('versionCatalog.language.fr'),
      english: t('versionCatalog.language.en'),
      original: t('downloads.language.original'),
      bibles: t('downloads.subsection.bibles'),
      commentaries: t('downloads.subsection.commentaries'),
      dictionaries: t('downloads.subsection.dictionaries'),
      studyTools: t('downloads.subsection.studyTools'),
      otherResources: t('downloads.subsection.otherResources'),
    },
    french: {
      studyTools: buildStrongLexiconItems('fr', t),
      bibles: bibleGroups.get('bible-fr') ?? [],
      commentaries: buildCommentaryItems('fr'),
      dictionaries: buildDictionaryItems(frenchDictionaries),
      otherResources: buildDatabaseItems('fr', frenchDictionaries.length === 0),
    },
    english: {
      studyTools: buildStrongLexiconItems('en', t),
      bibles: bibleGroups.get('bible-en') ?? [],
      commentaries: buildCommentaryItems('en'),
      dictionaries: buildDictionaryItems(englishDictionaries),
      otherResources: buildDatabaseItems('en', englishDictionaries.length === 0),
    },
    originalBibles: bibleGroups.get('bible-original') ?? [],
    sharedStudyTools,
  })

  return sections
    .filter(section => section.subsections.length > 0)
    .map(section => ({
      ...section,
      data: flattenDownloadSubsections(section.key, section.subsections),
    }))
}
