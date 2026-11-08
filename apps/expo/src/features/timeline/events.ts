import { TimelineSection } from './types'
import cyberJudahSections from '~assets/cyberjudah/timeline-sections.json'

export const getEvents = async () => cyberJudahSections as TimelineSection[]
