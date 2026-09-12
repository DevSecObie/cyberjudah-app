import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter, Routes, Route } from 'react-router-dom'
import './styles.css'
import { Nav } from './components/Nav'
import { Cover } from './pages/Cover'
import { CaseList } from './pages/CaseList'
import { CaseDetail } from './pages/CaseDetail'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <HashRouter>
      <div className="shell">
        <Nav />
        <Routes>
          <Route path="/" element={<Cover />} />
          <Route path="/cases" element={<CaseList />} />
          <Route path="/cases/:slug" element={<CaseDetail />} />
        </Routes>
        <footer>&copy; 2026 Obediyah Israel. All rights reserved.</footer>
      </div>
    </HashRouter>
  </StrictMode>
)
