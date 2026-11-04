/**
 * What the original-language Bible is, whatever revision is published. The published revision,
 * its archives and the text each index was built for are read from the Artifact catalog.
 *
 * Kept apart from the catalog so that a reader of the identity alone, such as the public site,
 * does not bundle the catalog: its build, and the pages kept under it, would then change with
 * every publication (ADR-0084).
 */
const BIBLE_STRONG_INTERLINEAR_IDENTITY = {
  applicationVersionId: 'BHG',
  datasetId: 'STEP',
  sourceVersion: 'TAHOT/TAGNT',
  attribution: 'Données créées par STEPBible.org à partir des travaux de Tyndale House Cambridge',
  license: 'CC BY 4.0',
  sourceUrl: 'https://github.com/STEPBible/STEPBible-Data',
} as const

/**
 * The CyberJudah profile publishes its own original-language Bible: the Westminster Leningrad
 * Codex and Scrivener's 1894 Textus Receptus, with English glosses from the King James Version.
 */
const CYBERJUDAH_INTERLINEAR_IDENTITY = {
  applicationVersionId: 'BHG',
  datasetId: 'CYBERJUDAH',
  sourceVersion: 'WLC/TR1894',
  attribution:
    'Westminster Leningrad Codex and Scrivener’s 1894 Textus Receptus (public domain). Hebrew word tags: Open Scriptures Hebrew Bible Project (CC BY 4.0). Greek word tags: Maurice A. Robinson (public domain).',
  license: 'Public domain; Hebrew word tags CC BY 4.0',
  sourceUrl: 'https://github.com/openscriptures/morphhb',
} as const

export type InterlinearBibleIdentity = {
  readonly applicationVersionId: 'BHG'
  readonly datasetId: string
  readonly sourceVersion: string
  readonly attribution: string
  readonly license: string
  readonly sourceUrl: string
}

export const BHG_INTERLINEAR_IDENTITY: InterlinearBibleIdentity =
  process.env.EXPO_PUBLIC_RESOURCE_PROFILE === 'cyberjudah'
    ? CYBERJUDAH_INTERLINEAR_IDENTITY
    : BIBLE_STRONG_INTERLINEAR_IDENTITY
