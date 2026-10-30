import sections from '~assets/cyberjudah/timeline-sections.json'
import { mapRange, rowGap, rowHeight, rows } from '../constants'
import { layoutTimelineRows } from '../layoutTimelineRows'
import { TimelineEvent, TimelineSection } from '../types'

jest.mock('~helpers/utils', () => ({ wp: (value: number) => value }))
jest.mock('~i18n', () => ({ getFixedT: () => (key: string) => key }))

// The same geometry as useTimeline, without the animated values.
const geometry = ({ startYear, endYear, interval }: TimelineSection) => {
  const scrollViewWidth = Math.abs(startYear - endYear) * (100 / interval)
  const yearsToPx = (years: number) =>
    Math.round(mapRange(years, [startYear, endYear], [0, scrollViewWidth]))
  const calculateEventWidth = (yearStart: number, yearEnd: number, isFixed?: boolean) => {
    const width = yearsToPx(startYear + Math.abs(yearStart - yearEnd))
    return isFixed || width < 200 ? 200 : width
  }
  return { yearsToPx, calculateEventWidth }
}

const layout = (section: TimelineSection) =>
  layoutTimelineRows({
    id: section.id,
    events: section.events,
    ...geometry(section),
    calculateLabel: (start, end) => `${start}-${end}`,
  })

const overlaps = (section: TimelineSection, events: TimelineEvent[]) => {
  const { yearsToPx, calculateEventWidth } = geometry(section)
  const boxes = events.map(event => {
    const top = event.row * (rowHeight + rowGap)
    const left = yearsToPx(event.start)
    return {
      slug: event.slug,
      top,
      bottom: top + (event.type === 'major' ? 60 : 25),
      left,
      right: left + calculateEventWidth(event.start, event.end, event.isFixed),
    }
  })
  return boxes.flatMap((a, i) =>
    boxes
      .slice(i + 1)
      .filter(b => a.top < b.bottom && b.top < a.bottom && a.left < b.right && b.left < a.right)
      .map(b => [a.slug, b.slug])
  )
}

const timeline = sections as TimelineSection[]
const americanCaptivity = timeline.filter(section => section.id.startsWith('fc-'))

it('draws no American captivity card on top of another', () => {
  expect(americanCaptivity).toHaveLength(5)
  for (const section of americanCaptivity) {
    expect(overlaps(section, section.events).length).toBeGreaterThan(0)
    expect(overlaps(section, layout(section).events)).toEqual([])
  }
})

it('keeps every published row that was already free', () => {
  for (const section of americanCaptivity) {
    const { events } = layout(section)
    const kept = events.filter((event, i) => event.row === section.events[i].row)
    expect(kept.length).toBeGreaterThan(section.events.length / 3)
    expect(events.map(event => event.slug)).toEqual(section.events.map(event => event.slug))
  }
})

it('makes the period tall enough for the rows it uses', () => {
  for (const section of americanCaptivity) {
    const { events, rowCount } = layout(section)
    expect(rowCount).toBeGreaterThanOrEqual(rows)
    for (const event of events) {
      expect(event.row + (event.type === 'major' ? 2 : 1)).toBeLessThanOrEqual(rowCount)
    }
  }
})

it("leaves Bible Strong's hand-placed periods as they are", () => {
  for (const section of timeline.filter(section => !section.id.startsWith('fc-'))) {
    expect(layout(section)).toEqual({ events: section.events, rowCount: rows })
  }
})
