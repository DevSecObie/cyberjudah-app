import type { CatalogResult } from '../discovery/catalogSearch'
import type { FuseResultMatch } from 'fuse.js'
import type { SearchResult } from '~helpers/biblesDb'
import type { RelationEndpoint } from '~features/studyRelations/domain'
import type { SearchItemType } from '~state/searchFilters'
import type { BibleReferenceSegment } from '~helpers/bcvParser'

export type MatchRange = [number, number]
export type SearchReferenceMode = 'navigation' | 'target'

export type SearchEntityResult = {
  id: string
  catalogResult?: CatalogResult
  type: SearchItemType
  title: string
  chip?: string
  subtitle?: string
  description?: string
  iconType: SearchItemType
  endpoint?: RelationEndpoint
  strongReference?: {
    language: 'greek' | 'hebrew'
    code: string
  }
  passage?: SearchResult
  passageReason?: string
  referenceSegment?: BibleReferenceSegment
  matches?: readonly FuseResultMatch[]
  /** A CyberJudah class to open in the player, and the moment to start at. */
  classWorkId?: string
  /** A recording to play by its video, for one the class library does not list. */
  classVideo?: string
  classStart?: number
}

export type SearchEntityResultWithEndpoint = SearchEntityResult & {
  endpoint: RelationEndpoint
}
