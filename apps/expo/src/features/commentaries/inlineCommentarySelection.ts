import { CYBERJUDAH_TEACHINGS, parseCommentaryProjectionId } from './commentarySelection'
import { COMMENTARY_CATALOG_BY_ID } from '~helpers/commentaryCatalog'

/** Associated writings remain available in Resources, but not in inline Bible reading. */
export function isInlineCommentaryEligible(id: string): boolean {
  const projection = parseCommentaryProjectionId(id)
  return !!projection && projection.resourceId !== 'egw-writings'
}

/** Inline reading is an opt-in subset, never a second independent catalog selection. */
export function normalizeInlineCommentaries(value: unknown, selected: readonly string[]): string[] {
  const eligible = Array.isArray(value)
    ? value.filter(
        (item): item is string => typeof item === 'string' && isInlineCommentaryEligible(item)
      )
    : []
  // CyberJudah shows the Bishops' commentaries as chips in the reader unless inline reading is
  // switched off; a list saved for the old single "cyberjudah" commentary counts as none.
  const enabled = new Set<string>(
    process.env.EXPO_PUBLIC_RESOURCE_PROFILE === 'cyberjudah' && !eligible.length
      ? CYBERJUDAH_TEACHINGS
      : eligible
  )
  return [...new Set(selected)].filter(item => enabled.has(item)).slice(0, 5)
}

/**
 * Paused 2026-10-31 while CyberJudah's notes under the verses said "CyberJudah"; back on now each
 * Bishop's commentary carries his name. Kept so a later pause is one line.
 */
export function isInlineCommentaryPaused(): boolean {
  return false
}

/** Selection IDs are UI identities; the delivery API uses publication identities (e.g. MHY). */
export function getInlineCommentaryResources(
  value: unknown,
  selected: readonly string[],
  enabled = true
) {
  if (!enabled || isInlineCommentaryPaused()) return []
  return normalizeInlineCommentaries(value, selected).flatMap(id => {
    const projection = parseCommentaryProjectionId(id)
    const entry = projection ? COMMENTARY_CATALOG_BY_ID.get(projection.resourceId) : undefined
    return entry && projection
      ? [{ resourceId: entry.publicationId, language: projection.language }]
      : []
  })
}
