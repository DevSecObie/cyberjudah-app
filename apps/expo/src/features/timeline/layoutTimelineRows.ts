import { rowGap, rowHeight, rows } from './constants'
import { TimelineEvent } from './types'

// Bible Strong's periods ship with hand-placed rows. The CyberJudah periods of the
// American captivity carry far more events, many on the same row at the same time,
// so their cards were drawn on top of one another. Those periods keep each published
// row that is free and move only the cards that would overlap to the nearest free row.
const repackedSection = (id: string) => id.startsWith('fc-')

const majorHeight = 60
const minorHeight = 25
const minGap = 8

const rowsTaken = (type: TimelineEvent['type']) =>
  Math.ceil(((type === 'major' ? majorHeight : minorHeight) + rowGap) / (rowHeight + rowGap))

// A minor card sizes to its text; this estimate stays on the wide side.
const minorWidth = (title: string, label: string) => 40 + title.length * 6 + label.length * 5

export const layoutTimelineRows = ({
  id,
  events,
  yearsToPx,
  calculateEventWidth,
  calculateLabel,
}: {
  id: string
  events: TimelineEvent[]
  yearsToPx: (years: number) => number
  calculateEventWidth: (yearStart: number, yearEnd: number, isFixed?: boolean) => number
  calculateLabel: (start: number, end: number) => string
}) => {
  if (!repackedSection(id)) {
    return { events, rowCount: rows }
  }

  const taken = new Map<number, [number, number][]>()
  const boxes = events.map(event => {
    const left = yearsToPx(event.start)
    const width =
      event.type === 'major'
        ? calculateEventWidth(event.start, event.end, event.isFixed)
        : minorWidth(event.title, calculateLabel(event.start, event.end))
    return { event, left, right: left + width, span: rowsTaken(event.type) }
  })
  type Box = (typeof boxes)[number]

  const isFree = ({ left, right, span }: Box, row: number) => {
    for (let r = row; r < row + span; r++) {
      if ((taken.get(r) ?? []).some(([l, rr]) => left < rr + minGap && l < right + minGap)) {
        return false
      }
    }
    return true
  }
  const take = ({ left, right, span }: Box, row: number) => {
    for (let r = row; r < row + span; r++) {
      taken.set(r, [...(taken.get(r) ?? []), [left, right]])
    }
  }

  const placed = new Map<TimelineEvent, number>()
  const moved: Box[] = []
  for (const box of boxes) {
    if (isFree(box, box.event.row)) {
      take(box, box.event.row)
      placed.set(box.event, box.event.row)
    } else {
      moved.push(box)
    }
  }
  for (const box of moved) {
    const preferred = box.event.row
    let row = preferred
    for (let distance = 1; !isFree(box, row); distance++) {
      if (preferred - distance >= 0 && isFree(box, preferred - distance)) {
        row = preferred - distance
        break
      }
      row = preferred + distance
    }
    take(box, row)
    placed.set(box.event, row)
  }

  const laidOut = events.map(event => ({ ...event, row: placed.get(event) ?? event.row }))
  const rowCount = Math.max(rows, ...laidOut.map(event => event.row + rowsTaken(event.type)))
  return { events: laidOut, rowCount }
}
