import { Asset } from 'expo-asset'
import type { TimelineSection } from './types'
import { usesCyberJudahEditorial } from '~helpers/editorialProfile'
import cyberJudahSections from '~assets/cyberjudah/timeline-sections.json'

// Bundled timeline geometry is an HTTP asset in the browser, not a native file.
export const getEvents = async (): Promise<TimelineSection[]> => {
  if (usesCyberJudahEditorial()) return cyberJudahSections as TimelineSection[]
  // Metro needs a static asset reference to include this file in web exports.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const [asset] = await Asset.loadAsync(require('~assets/timeline/events.txt'))
  const response = await fetch(asset.uri)
  if (!response.ok) throw new Error(`TIMELINE_ASSET_HTTP_${response.status}`)
  return response.json()
}
