import React, { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'

export default function Home() {
  const [latest, setLatest] = useState([])
  const nav = useNavigate()
  const base = import.meta.env.VITE_BACKEND_URL

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${base}/api/gallery?type=image`)
        if (!res.ok) return
        const data = await res.json()
        setLatest(data.slice(0, 4))
      } catch (e) {
        // silently ignore
      }
    })()
  }, [base])

  const fallback = [
    'https://ik.imagekit.io/emmymoks/IMG-20250914-WA0018.jpg?tr=w-300,h-200,fo-auto',
    'https://ik.imagekit.io/emmymoks/IMG-20250914-WA0021.jpg?tr=w-300,h-200,fo-auto',
    'https://ik.imagekit.io/emmymoks/IMG-20250914-WA0024.jpg?tr=w-300,h-200,fo-auto',
    'https://ik.imagekit.io/emmymoks/IMG-20250914-WA0022.jpg?tr=w-300,h-200,fo-auto'
  ]

  const previewItems = latest.length
    ? latest.map(i => `${base}/api/files/${i.id}?thumb=1`)
    : fallback

  return (
    <div className="homepage-wrapper space-y-6">
      {/* Floating Shapes Background */}
      <div className="floating-shapes">
        <span className="shape heart">❤</span>
        <span className="shape ring">💍</span>
        <span className="shape heart">❤</span>
        <span className="shape ring">💍</span>
        <span className="shape heart">❤</span>
      </div>

      {/* Hero Section */}
      <motion.section
        className="hero"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8 }}
      >
        <div className="hero-left">
          <motion.h1
            className="h1"
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2, duration: 0.6 }}
          >
            Welcome to our wedding
          </motion.h1>
          <motion.p
            className="lead"
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.4, duration: 0.6 }}
          >
            Dear friends & family, we're so happy you're here. This page is a place to share memories of Our Wedding: photos,
            videos and messages. Use the upload page to send the moments you captured at our wedding everything is approved by our admin
            team before appearing in the gallery.
          </motion.p>

          <motion.div
            className="cta-row"
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.6, duration: 0.6 }}
          >
            <button className="btn btn-primary" onClick={() => nav('/gallery')}>
              View Gallery
            </button>
            <button className="btn btn-secondary" onClick={() => nav('/upload')}>
              Upload Photos
            </button>
          </motion.div>
        </div>

        <motion.div
          className="hero-right"
          initial={{ x: 80, opacity: 0, scale: 0.95 }}
          animate={{ x: 0, opacity: 1, scale: 1 }}
          transition={{ delay: 0.8, duration: 0.7 }}
        >
          <div className="hero-img-wrapper">
            <img
              src="https://ik.imagekit.io/emmymoks/IMG-20250914-WA0019.jpg?tr=w-800,h-500,fo-auto"
              alt="hero"
              className="hero-img"
              loading="lazy"
            />
          </div>
        </motion.div>
      </motion.section>

      {/* Gallery Preview */}
      <motion.div
        className="card"
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.0, duration: 0.6 }}
      >
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <h3 style={{ margin: 0 }}>Latest from the gallery</h3>
          </motion.div>
          <motion.p
            className="small"
            style={{ marginTop: 6 }}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            A small preview. click to open the full gallery.
          </motion.p>
        </div>

        <div
          style={{
            marginTop: 18,
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: 18
          }}
        >
          {previewItems.map((src, idx) => (
            <motion.a
              key={idx}
              href="/gallery"
              onClick={e => {
                e.preventDefault()
                nav('/gallery')
              }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.96 }}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.2 + idx * 0.15 }}
              className="preview-link"
            >
              <img src={src} alt={`preview-${idx}`} className="preview-img" loading="lazy" />
            </motion.a>
          ))}
        </div>
      </motion.div>
    </div>
  )
}
