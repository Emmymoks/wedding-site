import React, { useState } from 'react'
import { Routes, Route, NavLink, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'

import Home from './pages/Home'
import Gallery from './pages/Gallery'
import Upload from './pages/Upload'
import Admin from './pages/Admin'
import AdminDashboard from './pages/AdminDashboard'

const Header = () => {
  const nav = useNavigate()
  const [open, setOpen] = useState(false)

  return (
    <header className="header">
      {/* Brand */}
      <div className="brand" onClick={() => nav('/')}>
        <div className="logo">J&T</div>
        <div className="title">Joy & Tobi Wedding</div>
      </div>

      {/* Desktop Nav */}
      <nav className="nav">
        <NavLink to="/" className={({ isActive }) => (isActive ? 'active' : '')}>
          Home
        </NavLink>
        <NavLink to="/gallery" className={({ isActive }) => (isActive ? 'active' : '')}>
          Gallery
        </NavLink>
        <NavLink to="/upload" className={({ isActive }) => (isActive ? 'active' : '')}>
          Upload
        </NavLink>
      </nav>

      {/* Mobile Toggle */}
      <button className="mobile-toggle" onClick={() => setOpen(!open)}>
        <span className={`bar top ${open ? 'open' : ''}`} />
        <span className={`bar middle ${open ? 'open' : ''}`} />
        <span className={`bar bottom ${open ? 'open' : ''}`} />
      </button>

      {/* Mobile Menu */}
      <AnimatePresence>
        {open && (
          <motion.nav
            className="mobile-menu"
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.25 }}
          >
            <NavLink to="/" onClick={() => setOpen(false)} className={({ isActive }) => (isActive ? 'active' : '')}>
              Home
            </NavLink>
            <NavLink to="/gallery" onClick={() => setOpen(false)} className={({ isActive }) => (isActive ? 'active' : '')}>
              Gallery
            </NavLink>
            <NavLink to="/upload" onClick={() => setOpen(false)} className={({ isActive }) => (isActive ? 'active' : '')}>
              Upload
            </NavLink>
          </motion.nav>
        )}
      </AnimatePresence>
    </header>
  )
}

export default function App() {
  return (
    <div className="app">
      <Header />
      <main>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/gallery" element={<Gallery />} />
          <Route path="/upload" element={<Upload />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="/admin/dashboard" element={<AdminDashboard />} />
        </Routes>
      </main>
    </div>
  )
}
