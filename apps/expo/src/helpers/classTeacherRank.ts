// Class order (2026-11-02): the Bishops first, in this order (Nathanyel, Yawasap, Kani),
// then the Deacons, then the Captains, then everyone else; Zakai's classes always come last.
const BISHOPS = [/nathanyel/i, /yawasap/i, /kan[ia]\b/i]

export const classTeacherRank = (teacher?: string | null): number => {
  const name = (teacher ?? '').trim()
  if (/^zakai\b/i.test(name)) return 9
  if (/^(bishop|elder)\b/i.test(name)) {
    const at = BISHOPS.findIndex(pattern => pattern.test(name))
    return at >= 0 ? at : BISHOPS.length
  }
  if (/^deacon\b/i.test(name)) return 4
  if (/^captain\b/i.test(name)) return 5
  return 6
}
