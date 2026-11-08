import { isAppLanguageEnabled } from '~helpers/languageUtils'
import { getDefaultStore, useAtom, useAtomValue, useSetAtom } from 'jotai'

import type { ResourceLanguage } from '~helpers/databaseTypes'
import atomWithAsyncStorage from '~helpers/atomWithAsyncStorage'
import { getLanguage } from '~i18n'

// Resources language state - each resource can have its own language
export type ResourcesLanguageState = {
  STRONG: ResourceLanguage
  DICTIONNAIRE: ResourceLanguage
  NAVE: ResourceLanguage
  MHY: ResourceLanguage
  TIMELINE: ResourceLanguage
}

// Helper to get default resources language based on current UI language
const getDefaultResourcesLanguage = (): ResourcesLanguageState => {
  const defaultLang: ResourceLanguage = getLanguage()
  return {
    STRONG: defaultLang,
    DICTIONNAIRE: defaultLang,
    NAVE: defaultLang,
    MHY: defaultLang,
    TIMELINE: defaultLang,
  }
}

// Jotai atom with MMKV persistence
export const resourcesLanguageAtom = atomWithAsyncStorage<ResourcesLanguageState>(
  'resourcesLanguage',
  getDefaultResourcesLanguage(),
  {
    migrate: value =>
      Object.fromEntries(
        Object.entries(value).map(([key, language]) => [
          key,
          isAppLanguageEnabled(language) ? language : 'en',
        ])
      ) as ResourcesLanguageState,
  }
)

// React hooks
export const useResourceLanguage = (dbId: keyof ResourcesLanguageState) => {
  const [state, setState] = useAtom(resourcesLanguageAtom)
  const lang = isAppLanguageEnabled(state[dbId]) ? state[dbId] : 'en'
  const setLang = (newLang: ResourceLanguage) => {
    setState(prev => ({ ...prev, [dbId]: isAppLanguageEnabled(newLang) ? newLang : 'en' }))
  }
  return [lang, setLang] as const
}

export const useResourcesLanguageValue = () => useAtomValue(resourcesLanguageAtom)
export const useSetResourcesLanguage = () => useSetAtom(resourcesLanguageAtom)

// For non-React contexts (memoize.ts, getSQLTransaction.ts)
// Synchronous access to the current value
export const getResourceLanguage = (dbId: keyof ResourcesLanguageState): ResourceLanguage => {
  const store = getDefaultStore()
  const state = store.get(resourcesLanguageAtom)
  return isAppLanguageEnabled(state[dbId]) ? state[dbId] : 'en'
}

// Reset all resources to a specific language
export const resetAllResourcesLanguage = (lang: ResourceLanguage) => {
  const store = getDefaultStore()
  store.set(resourcesLanguageAtom, {
    STRONG: isAppLanguageEnabled(lang) ? lang : 'en',
    DICTIONNAIRE: isAppLanguageEnabled(lang) ? lang : 'en',
    NAVE: isAppLanguageEnabled(lang) ? lang : 'en',
    MHY: isAppLanguageEnabled(lang) ? lang : 'en',
    TIMELINE: isAppLanguageEnabled(lang) ? lang : 'en',
  })
}
