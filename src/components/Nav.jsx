import { Link } from 'react-router-dom'

export function Nav() {
  return (
    <nav>
      <div className="inner">
        <Link to="/" className="brand">Case Studies of the Bible</Link>
        <Link to="/cases">All Cases</Link>
      </div>
    </nav>
  )
}
