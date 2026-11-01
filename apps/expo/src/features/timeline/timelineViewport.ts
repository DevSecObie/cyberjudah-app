import type { TimelineEvent } from './types'

type Point = { x: number; y: number }

export const getTimelineYearAtMarker = (
  x: number,
  lineX: number,
  periodWidth: number,
  startYear: number,
  endYear: number
) => {
  'worklet'
  if (periodWidth <= 0) return startYear
  // The chart and marker share the same horizontal inset, which cancels out.
  const position = Math.max(0, Math.min(periodWidth, lineX - x))
  return Math.round(startYear + (position / periodWidth) * (endYear - startYear))
}

export const getTimelineContentWidth = (
  periodWidth: number,
  viewportWidth: number,
  markerOffset: number
) => periodWidth + Math.max(viewportWidth, markerOffset + 200)

export const getTimelineFocusEvent = (
  events: TimelineEvent[],
  startYear: number,
  endYear: number,
  entrance: 0 | 1
) => {
  // Lifetimes can overlap several periods. Prefer an entry that starts in this
  // period, rather than positioning the camera before the section's own bounds.
  const inPeriod = events.filter(event => event.start >= startYear && event.start <= endYear)
  return (inPeriod.length ? inPeriod : events).reduce<TimelineEvent | undefined>(
    (selected, event) => {
      if (!selected) return event
      return (entrance ? event.start < selected.start : event.start > selected.start)
        ? event
        : selected
    },
    undefined
  )
}

export const getTimelineViewport = ({
  width,
  height,
  viewportWidth,
  viewportHeight,
  focus,
  markerOffset,
  topOffset,
  entrance,
}: {
  width: number
  height: number
  viewportWidth: number
  viewportHeight: number
  focus?: Point
  markerOffset: number
  topOffset: number
  entrance: 0 | 1
}) => {
  const minX = Math.min(0, viewportWidth - width)
  const minY = Math.min(0, viewportHeight - height)
  // Keep the existing 140pt caption and 60pt image visible on narrow screens.
  const left = Math.min(markerOffset, Math.max(0, viewportWidth - 200))
  const top = Math.min(topOffset, Math.max(0, viewportHeight - 60))

  return {
    minX,
    minY,
    x: focus ? Math.max(minX, Math.min(0, left - focus.x)) : entrance ? 0 : minX,
    y: focus ? Math.max(minY, Math.min(0, top - focus.y)) : 0,
  }
}
