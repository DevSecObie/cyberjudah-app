import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import cases from '../data/cases.json'

const VERDICT_LABELS = {
  death: 'Death', plague: 'Plague', exile: 'Exile', captivity: 'Captivity',
  curse: 'Cursed', restitution: 'Restitution', spared: 'Spared',
  reprieve: 'Reprieve', temporal: 'Temporal', unrecorded: 'Unrecorded',
  blessed: 'Blessed'
}

const ALL_ERAS = [...new Set(cases.map(c => c.era))]
const ALL_VERDICTS = [...new Set(cases.map(c => c.verdict))]

export function CaseList() {
  const [query, setQuery] = useState('')
  const [verdictFilter, setVerdictFilter] = useState(null)

  const filtered = useMemo(() => {
    let list = cases
    if (verdictFilter) list = list.filter(c => c.verdict === verdictFilter)
    if (query.trim()) {
      const q = query.toLowerCase()
      list = list.filter(c =>
        c.name.toLowerCase().includes(q) ||
        c.charge.toLowerCase().includes(q) ||
        c.code.toLowerCase().includes(q) ||
        c.era.toLowerCase().includes(q)
      )
    }
    return list
  }, [query, verdictFilter])

  const grouped = useMemo(() => {
    const map = new Map()
    for (const c of filtered) {
      if (!map.has(c.era)) map.set(c.era, [])
      map.get(c.era).push(c)
    }
    return [...map.entries()]
  }, [filtered])

  return (
    <div className="page">
      <h1>Case Files</h1>
      <p className="count-banner">{filtered.length} of {cases.length} cases</p>

      <div className="search-bar">
        <input
          type="text" placeholder="Search by name, charge, code, or era..."
          value={query} onChange={e => setQuery(e.target.value)}
        />
      </div>

      <div className="filters">
        <button
          className={`filter-btn ${!verdictFilter ? 'active' : ''}`}
          onClick={() => setVerdictFilter(null)}
        >All</button>
        {ALL_VERDICTS.map(v => (
          <button key={v}
            className={`filter-btn ${verdictFilter === v ? 'active' : ''}`}
            onClick={() => setVerdictFilter(verdictFilter === v ? null : v)}
          >{VERDICT_LABELS[v] || v}</button>
        ))}
      </div>

      {grouped.map(([era, list]) => (
        <div key={era}>
          <div className="era-heading">{era} ({list.length})</div>
          {list.map(c => (
            <div key={c.slug} className="case-row">
              <span className="code mono">{c.code}</span>
              <span className="name">
                <Link to={`/cases/${c.slug}`}>{c.name}</Link>
              </span>
              <span className={`verdict verdict--${c.verdict}`}>
                {VERDICT_LABELS[c.verdict] || c.verdict}
              </span>
              <span className="charge">{c.charge}</span>
            </div>
          ))}
        </div>
      ))}

      {filtered.length === 0 && (
        <p style={{ color: 'var(--ink-muted)', marginTop: '2rem', textAlign: 'center' }}>
          No cases match your search.
        </p>
      )}
    </div>
  )
}
