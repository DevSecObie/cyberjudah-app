import type { TimelineSection } from './types'
import cyberJudahSections from '~assets/cyberjudah/timeline-sections.json'

// The app carries only the published CyberJudah timeline.
export const getEvents = async (): Promise<TimelineSection[]> =>
  cyberJudahSections as TimelineSection[]
