const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]

/** 2025-12-28 as "December 28, 2025". */
export const longDate = (iso?: string | null) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? '')
  return m ? `${MONTHS[+m[2] - 1]} ${+m[3]}, ${m[1]}` : ''
}
