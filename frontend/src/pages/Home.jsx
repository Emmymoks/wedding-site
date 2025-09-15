import React, { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'

export default function Home() {
  const [latest, setLatest] = useState([])
  const nav = useNavigate()
  const base = import.meta.env.VITE_BACKEND_URL

  // try to load a small preview; if backend not available it's okay
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${base}/api/gallery?type=image`)
        if (!res.ok) return
        const data = await res.json()
        setLatest(data.slice(0, 4))
      } catch (e) {
        // silently ignore — preview will be static
      }
    })()
  }, [base])

  // static fallback thumbnails if API returns nothing
  const fallback = [
    'https://ik.imagekit.io/emmymoks/IMG-20250914-WA0018.jpg?tr=w-300,h-200,fo-auto',
    'https://ik.imagekit.io/emmymoks/IMG-20250914-WA0021.jpg?tr=w-300,h-200,fo-auto',
    'https://ik.imagekit.io/emmymoks/IMG-20250914-WA0024.jpg?tr=w-300,h-200,fo-auto',
    'https://ik.imagekit.io/emmymoks/IMG-20250914-WA0022.jpg?tr=w-300,h-200,fo-auto'
  ]

  // use backend thumbnails if available, otherwise fallback
  const previewItems = latest.length
    ? latest.map(i => `${base}/api/files/${i.id}?thumb=1`)
    : fallback

  return (
    <div className="space-y-6">
      <motion.section
        className="hero"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6 }}
      >
        <div className="hero-left">
          <motion.h1
            className="h1"
            initial={{ y: 10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.1 }}
          >
            Welcome to our wedding
          </motion.h1>
          <motion.p
            className="lead"
            initial={{ y: 10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2 }}
          >
            Dear friends & family, we're so happy you're here. This page is a place to share memories: photos,
            videos and messages. Use the upload page to send moments you captured at our wedding. everything is approved by our admin
            team before appearing in the gallery.
          </motion.p>

          <div className="cta-row">
            <button className="btn btn-primary" onClick={() => nav('/gallery')}>
              View Gallery
            </button>
            <button className="btn btn-secondary" onClick={() => nav('/upload')}>
              Upload Photos
            </button>
          </div>
        </div>

        <motion.div
          className="hero-right"
          initial={{ scale: 0.98 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.25 }}
        >
          <div
            style={{
              width: '100%',
              borderRadius: 16,
              overflow: 'hidden',
              boxShadow: 'var(--shadow-2)'
            }}
          >
            <img
              src="https://ik.imagekit.io/emmymoks/IMG-20250914-WA0019.jpg?updatedAt=1757861448258&tr=w-800,h-500,fo-auto"
              alt="hero"
              style={{ width: '100%', height: 340, objectFit: 'cover' }}
              loading="lazy"
            />
          </div>
        </motion.div>
      </motion.section>

      <div className="card">
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ margin: 0 }}>Latest from the gallery</h3>
            <p className="small" style={{ marginTop: 6 }}>
              A small preview — click to open the full gallery.
            </p>
          </div>
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
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.98 }}
              style={{
                display: 'block',
                borderRadius: 14,
                overflow: 'hidden',
                boxShadow: 'var(--shadow-1)'
              }}
            >
              <img
                src={src}
                alt={`preview-${idx}`}
                style={{
                  width: '100%',
                  height: 200,
                  objectFit: 'cover',
                  display: 'block'
                }}
                loading="lazy"
              />
            </motion.a>
          ))}
        </div>
      </div>
    </div>
  )
}
