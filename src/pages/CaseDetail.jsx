import { useParams, Link } from 'react-router-dom'
import { useEffect } from 'react'
import cases from '../data/cases.json'

const VERDICT_LABELS = {
  death: 'Put to death', plague: 'Plague', exile: 'Exile', captivity: 'Captivity',
  curse: 'Cursed', restitution: 'Restitution', spared: 'Spared',
  reprieve: 'Reprieve', temporal: 'Temporal judgment', unrecorded: 'Sentence not recorded',
  blessed: 'Kept the law'
}

export function CaseDetail() {
  const { slug } = useParams()
  const idx = cases.findIndex(c => c.slug === slug)
  const c = cases[idx]

  useEffect(() => { window.scrollTo(0, 0) }, [slug])

  if (!c) {
    return (
      <div className="page">
        <h1>Case not found</h1>
        <p>No case with slug "{slug}".</p>
        <Link to="/cases">Back to case files</Link>
      </div>
    )
  }

  const blessing = c.verdict === 'blessed'
  const prev = idx > 0 ? cases[idx - 1] : null
  const next = idx < cases.length - 1 ? cases[idx + 1] : null
  const offenseParas = c.offenseFull?.length ? c.offenseFull : [c.offense]
  const judgmentParas = c.judgmentFull?.length ? c.judgmentFull : [c.judgment]

  return (
    <div className="page">
      <div className="breadcrumbs">
        <Link to="/cases">Cases</Link>
        <span>/</span>
        <Link to={`/cases?era=${c.era}`}>{c.era}</Link>
        <span>/</span>
        {c.name}
      </div>

      <div className="case-head">
        <p className="kicker">
          <span className="mono" style={{ marginRight: '0.5rem' }}>{c.code}</span>
          {c.era}
        </p>
        <h1>{c.name}</h1>
        <div className="meta">
          <span className={`verdict verdict--${c.verdict}`}>
            {VERDICT_LABELS[c.verdict] || c.verdict}
          </span>
          <span style={{ color: 'var(--ink-muted)' }}>{c.charge}</span>
        </div>
      </div>

      <div className="case-body">
        <p>{c.summary}</p>

        <h2>{blessing ? 'The Obedience' : 'The Offense'}</h2>
        {offenseParas.map((p, i) => <p key={i}>{p}</p>)}

        <h2>{blessing ? 'The Blessing' : 'The Judgment'}</h2>
        {judgmentParas.map((p, i) => <p key={i}>{p}</p>)}

        {c.refs?.length > 0 && (
          <>
            <h2>Scripture</h2>
            <ul>
              {c.refs.map((r, i) => <li key={i} className="mono">{r}</li>)}
            </ul>
          </>
        )}

        {c.passages?.length > 0 && (
          <>
            <h2>Scripture Passages</h2>
            {c.passages.map((p, i) => (
              <div key={i} className="scripture">
                <span className="ref">{p.ref || p.cite}</span>
                {p.verses?.map((v, j) => (
                  <p key={j}><sup className="mono">{v.num}</sup> {v.text}</p>
                ))}
                {p.text && !p.verses && <p>{p.text}</p>}
              </div>
            ))}
          </>
        )}

        {c.studyContent?.length > 0 && (
          <>
            <h2>Study Commentary</h2>
            <p style={{ color: 'var(--ink-muted)', marginBottom: '1rem', fontSize: '0.9rem' }}>
              Verse-by-verse teaching from the daily reading notes.
            </p>
            {c.studyContent.map((ch, i) => (
              <details key={i}>
                <summary>{ch.chapter} <span className="mono" style={{ color: 'var(--ink-muted)' }}>({ch.entries.length} {ch.entries.length === 1 ? 'verse' : 'verses'})</span></summary>
                <div className="inner">
                  {ch.entries.map((e, j) => (
                    <div key={j} style={{ marginBottom: '1rem' }}>
                      <p className="mono" style={{ color: 'var(--cyan)', fontSize: '0.85rem' }}>{e.ref}</p>
                      {e.commentary && <p>{e.commentary}</p>}
                      {e.precepts?.length > 0 && (
                        <ul>
                          {e.precepts.map((pr, k) => (
                            <li key={k}><span className="mono">{pr.ref}</span>{pr.text ? ` — ${pr.text}` : ''}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ))}
                </div>
              </details>
            ))}
          </>
        )}

        {c.teachingExcerpts?.length > 0 && (
          <>
            <h2>Teaching Excerpts</h2>
            <p style={{ color: 'var(--ink-muted)', marginBottom: '1rem', fontSize: '0.9rem' }}>
              Timestamped references from class recordings.
            </p>
            {c.teachingExcerpts.map((t, i) => (
              <details key={i}>
                <summary>
                  <a href={`https://www.youtube.com/watch?v=${t.videoId}`} target="_blank" rel="noopener noreferrer">{t.title}</a>
                  {t.date && <span className="mono" style={{ color: 'var(--ink-muted)', marginLeft: '0.5rem' }}>{t.date}</span>}
                </summary>
                <div className="inner">
                  <ul>
                    {t.excerpts.map((e, j) => (
                      <li key={j}>
                        <a href={`https://www.youtube.com/watch?v=${t.videoId}&t=${Math.floor(e.timestamp)}s`} target="_blank" rel="noopener noreferrer" className="mono">{e.time}</a>
                        <span style={{ marginLeft: '0.5rem' }}>{e.text}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </details>
            ))}
          </>
        )}

        {c.laws?.length > 0 && (
          <>
            <h2>{blessing ? 'Laws Kept' : 'Laws Broken'}</h2>
            <ul>
              {c.laws.map((l, i) => <li key={i} className="mono">{l}</li>)}
            </ul>
          </>
        )}

        {c.topics?.length > 0 && (
          <>
            <h2>Topics</h2>
            <div className="chips">
              {c.topics.map(t => <span key={t} className="chip">{t.replace(/-/g, ' ')}</span>)}
            </div>
          </>
        )}

        {c.themes?.length > 0 && (
          <div className="chips" style={{ marginTop: '2rem' }}>
            {c.themes.map(t => <span key={t} className="chip">{t.replace(/-/g, ' ')}</span>)}
          </div>
        )}
      </div>

      <div className="pager">
        {prev ? <Link to={`/cases/${prev.slug}`}>&larr; {prev.name}</Link> : <Link to="/cases">All cases</Link>}
        {next ? <Link to={`/cases/${next.slug}`}>{next.name} &rarr;</Link> : <Link to="/cases">All cases</Link>}
      </div>
    </div>
  )
}
