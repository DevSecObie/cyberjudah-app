import { CYBERJUDAH_TEACHINGS, parseCommentaryProjectionId } from './commentarySelection'
import { COMMENTARY_CATALOG_BY_ID } from '~helpers/commentaryCatalog'

/** Associated writings remain available in Resources, but not in inline Bible reading. */
export function isInlineCommentaryEligible(id: string): boolean {
  const projection = parseCommentaryProjectionId(id)
  return !!projection && projection.resourceId !== 'egw-writings'
}

/** Inline reading is an opt-in subset, never a second independent catalog selection. */
export function normalizeInlineCommentaries(value: unknown, selected: readonly string[]): string[] {
  // CyberJudah shows its teachings as chips in the reader unless inline reading is switched off.
  if (
    process.env.EXPO_PUBLIC_RESOURCE_PROFILE === 'cyberjudah' &&
    (!Array.isArray(value) || !value.length)
  ) {
    value = [CYBERJUDAH_TEACHINGS]
  }
  if (!Array.isArray(value)) return []
  const enabled = new Set(
    value.filter(
      (item): item is string => typeof item === 'string' && isInlineCommentaryEligible(item)
    )
  )
  return [...new Set(selected)].filter(item => enabled.has(item)).slice(0, 5)
}

/**
 * CyberJudah's notes under the verses stay off until each one carries its teacher's name (Bishop
 * Nathanyel, Bishop Kani...) instead of "CyberJudah" (Obie, 2026-10-31). The reader shows plain
 * text and its menu leaves the option out; turn this back on when the teachers' commentaries exist.
 */
export function isInlineCommentaryPaused(): boolean {
  return process.env.EXPO_PUBLIC_RESOURCE_PROFILE === 'cyberjudah'
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
