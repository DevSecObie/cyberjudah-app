import { TimelineSection } from './types'
import { Asset } from 'expo-asset'
import * as FileSystem from 'expo-file-system/legacy'
import { usesCyberJudahEditorial } from '~helpers/editorialProfile'
import cyberJudahSections from '~assets/cyberjudah/timeline-sections.json'

// Manually unfixed : 1242 - 1244
// export const events: TimelineSection[] = require('~assets/timeline/events.txt')
export const getEvents = async () => {
  if (usesCyberJudahEditorial()) return cyberJudahSections as TimelineSection[]
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const [{ localUri }] = await Asset.loadAsync(require('~assets/timeline/events.txt'))

  const json = JSON.parse(await FileSystem.readAsStringAsync(localUri as string))
  return json as TimelineSection[]
}
