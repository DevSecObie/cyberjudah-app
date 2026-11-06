import { lazy } from 'react'

// On the web each tab type's screen is its own file, fetched the first time a tab of that type
// is shown, so opening the site only loads the Bible reader. The phone imports them directly.
export const CompareVersesTabScreen = lazy(() => import('~features/bible/CompareVersesTabScreen'))
export const StrongTabScreen = lazy(() => import('~features/lexique/StrongTabScreen'))
export const CommentariesTabScreen = lazy(
  () => import('~features/commentaries/CommentariesTabScreen')
)
export const CommentaryResourceTabScreen = lazy(
  () => import('~features/commentaries/CommentaryResourceTabScreen')
)
export const InvalidCommentaryTabScreen = lazy(
  () => import('~features/commentaries/InvalidCommentaryTabScreen')
)
export const DictionaryTabScreen = lazy(() => import('~features/dictionnary/DictionaryTabScreen'))
export const NaveTabScreen = lazy(() => import('~features/nave/NaveTabScreen'))
export const NotesTabScreen = lazy(() => import('~features/notes/NotesTabScreen'))
export const PlanTabScreen = lazy(() => import('~features/plans/PlanTabScreen'))
export const SearchTabScreen = lazy(() => import('~features/search/SearchTabScreen'))
export const StudiesTabScreen = lazy(() => import('~features/studies/StudiesTabScreen'))
export const TimelineTabScreen = lazy(() => import('~features/timeline/TimelineTabScreen'))
export const NewTabScreen = lazy(() => import('./NewTab/NewTabScreen'))
