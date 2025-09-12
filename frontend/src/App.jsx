import React, { useState } from 'react'
import { Routes, Route, Link, useNavigate } from 'react-router-dom'
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
        <div className="logo">W</div>
        <div className="title">John & Doe Wedding</div>
      </div>

      {/* Desktop Nav */}
      <nav className="nav">
        <Link to="/">Home</Link>
        <Link to="/gallery">Gallery</Link>
        <Link to="/upload">Upload</Link>
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
            <Link to="/" onClick={() => setOpen(false)}>Home</Link>
            <Link to="/gallery" onClick={() => setOpen(false)}>Gallery</Link>
            <Link to="/upload" onClick={() => setOpen(false)}>Upload</Link>
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
