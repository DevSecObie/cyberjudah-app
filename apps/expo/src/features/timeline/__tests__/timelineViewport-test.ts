import sections from '~assets/cyberjudah/timeline-sections.json'
import type { TimelineSection } from '../types'
import {
  getTimelineContentWidth,
  getTimelineFocusEvent,
  getTimelineViewport,
  getTimelineYearAtMarker,
} from '../timelineViewport'

const periods = sections as TimelineSection[]

it('opens First Generation with Adam’s complete caption visible below the header', () => {
  const period = periods[0]
  const event = getTimelineFocusEvent(period.events, period.startYear, period.endYear, 1)!
  expect(event.slug).toBe('adam')
  const focus = { x: 146 + 176, y: 50 + 11 * 40 }
  const viewport = getTimelineViewport({
    width: 1640,
    height: 1210,
    viewportWidth: 440,
    viewportHeight: 650,
    focus,
    markerOffset: 176,
    topOffset: 50,
    entrance: 1,
  })
  expect(focus.x + viewport.x).toBe(176)
  expect(focus.x + viewport.x + 200).toBeLessThanOrEqual(440)
  expect(focus.y + viewport.y).toBe(50)
  expect(getTimelineYearAtMarker(viewport.x, 0, 1200, -4100, -2900)).toBe(-3954)
})

it.each([320, 390, 440, 768])(
  'keeps the focused entry visible across all periods at width %i',
  size => {
    for (const period of periods) {
      for (const entrance of [0, 1] as const) {
        const event = getTimelineFocusEvent(
          period.events,
          period.startYear,
          period.endYear,
          entrance
        )!
        const offset = Math.round(size * 0.4)
        const contentWidth = getTimelineContentWidth(
          ((period.endYear - period.startYear) * 100) / period.interval,
          size,
          offset
        )
        const focus = {
          x: Math.round(((event.start - period.startYear) * 100) / period.interval) + offset,
          y: 50 + event.row * 40,
        }
        const viewport = getTimelineViewport({
          width: contentWidth,
          height: 1210,
          viewportWidth: size,
          viewportHeight: 500,
          focus,
          markerOffset: offset,
          topOffset: 50,
          entrance,
        })
        expect(focus.x + viewport.x).toBeGreaterThanOrEqual(0)
        expect(focus.x + viewport.x + 200).toBeLessThanOrEqual(size)
        expect(focus.y + viewport.y).toBeGreaterThanOrEqual(0)
        expect(focus.y + viewport.y + 60).toBeLessThanOrEqual(500)
      }
    }
  }
)

it('does not create inverted pan bounds when the workspace is larger than the chart', () => {
  expect(
    getTimelineViewport({
      width: 200,
      height: 300,
      viewportWidth: 800,
      viewportHeight: 1000,
      markerOffset: 320,
      topOffset: 50,
      entrance: 0,
    })
  ).toEqual({ minX: 0, minY: 0, x: 0, y: 0 })
})

it('uses the period’s own entries instead of an earlier overlapping lifetime', () => {
  const period = periods[1]
  expect(getTimelineFocusEvent(period.events, period.startYear, period.endYear, 1)?.slug).toBe(
    'noah'
  )
  expect(getTimelineFocusEvent([], 0, 100, 1)).toBeUndefined()
})

it('keeps the current-year marker within the period during entrance and overscroll', () => {
  expect(getTimelineYearAtMarker(440, 440, 1200, -4100, -2900)).toBe(-4100)
  expect(getTimelineYearAtMarker(100, 0, 1200, -4100, -2900)).toBe(-4100)
  expect(getTimelineYearAtMarker(-1400, 0, 1200, -4100, -2900)).toBe(-2900)
})
