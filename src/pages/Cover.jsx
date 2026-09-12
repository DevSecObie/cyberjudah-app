import { Link } from 'react-router-dom'
import cases from '../data/cases.json'

const eras = [...new Set(cases.map(c => c.era))]
const verdicts = [...new Set(cases.map(c => c.verdict))]

export function Cover() {
  return (
    <div className="cover">
      <p className="volume">Volume I</p>
      <h1>Case Studies of the Bible</h1>
      <p className="subtitle">A Legal Analysis of the Scriptures from Genesis to Malachi</p>
      <p className="author">Obediyah Israel</p>
      <div className="stats">
        <div><strong>{cases.length}</strong> cases</div>
        <div><strong>{eras.length}</strong> eras</div>
        <div><strong>{verdicts.length}</strong> verdicts</div>
      </div>
      <Link to="/cases" className="enter">Open the Case Files</Link>
    </div>
  )
}
