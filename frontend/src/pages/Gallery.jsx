import React, { useEffect, useState, useCallback, useRef } from 'react'
import axios from 'axios'
import { motion, AnimatePresence } from 'framer-motion'

export default function Gallery() {
  const [images, setImages] = useState([])
  const [videos, setVideos] = useState([])
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [allItems, setAllItems] = useState([])
  const [loading, setLoading] = useState(false)
  const [muted, setMuted] = useState(true) // 🔑 default mute for autoplay

  const videoRef = useRef(null)
  const base = import.meta.env.VITE_BACKEND_URL

  useEffect(() => {
    fetchData()
  }, [])

  async function fetchData() {
    try {
      const imgRes = await axios.get(`${base}/api/gallery?type=image`)
      const vidRes = await axios.get(`${base}/api/gallery?type=video`)
      setImages(imgRes.data)
      setVideos(vidRes.data)

      const combined = [
        ...imgRes.data.map(i => ({ ...i, type: 'image' })),
        ...vidRes.data.map(v => ({ ...v, type: 'video' }))
      ]
      setAllItems(combined)
    } catch (e) {
      console.error(e)
    }
  }

  const openLightbox = useCallback(index => {
    setCurrentIndex(index)
    setLightboxOpen(true)
    setLoading(true)
    setMuted(true) // reset mute each time
  }, [])

  const closeLightbox = useCallback(() => {
    setLightboxOpen(false)
    setMuted(true)
  }, [])

  const nextItem = useCallback(() => {
    setCurrentIndex(prev => {
      const next = (prev + 1) % allItems.length
      setLoading(true)
      setMuted(true)
      return next
    })
  }, [allItems])

  const prevItem = useCallback(() => {
    setCurrentIndex(prev => {
      const prevIdx = (prev - 1 + allItems.length) % allItems.length
      setLoading(true)
      setMuted(true)
      return prevIdx
    })
  }, [allItems])

  // 🔑 Keyboard navigation
  useEffect(() => {
    if (!lightboxOpen) return
    const handleKey = e => {
      if (e.key === 'ArrowRight') nextItem()
      if (e.key === 'ArrowLeft') prevItem()
      if (e.key === 'Escape') closeLightbox()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [lightboxOpen, nextItem, prevItem, closeLightbox])

  return (
    <div className="space-y-6">
      {/* Images */}
      <motion.div className="card" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <h2>Photos</h2>
        <div className="gallery-grid">
          {images.map((i, idx) => (
            <motion.div
              key={i.id}
              className="photo"
              whileHover={{ scale: 1.03 }}
              onClick={() => openLightbox(idx)}
            >
              <img
                src={`${base}/api/files/${i.id}?thumb=1`}
                alt={i.originalname || 'gallery photo'}
                className="cursor-pointer"
                loading="lazy"
                decoding="async"
              />
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* Videos */}
      <motion.div className="card" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <h2>Videos</h2>
        <div className="gallery-grid">
          {videos.map((v, idx) => (
            <motion.div
              key={v.id}
              className="photo relative"
              whileHover={{ scale: 1.03 }}
              onClick={() => openLightbox(images.length + idx)}
            >
              <img
                src={`${base}/api/files/${v.id}?thumb=1`}
                alt={v.originalname || 'gallery video'}
                className="cursor-pointer"
                loading="lazy"
                decoding="async"
              />
              <div className="absolute inset-0 flex items-center justify-center bg-black/40 text-white text-3xl font-bold">
                ▶
              </div>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* Lightbox Overlay */}
      <AnimatePresence>
        {lightboxOpen && (
          <motion.div
            className="lightbox-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <button className="lightbox-close" onClick={closeLightbox}>
              ×
            </button>

            <motion.div
              key={currentIndex}
              className="lightbox-content relative"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3, ease: 'easeInOut' }}
              drag="x"
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.15}
              onDragEnd={(e, { offset }) => {
                if (offset.x < -100) nextItem()
                else if (offset.x > 100) prevItem()
              }}
            >
              {/* Spinner */}
              {loading && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/30 z-10">
                  <div className="w-12 h-12 border-4 border-white border-t-transparent rounded-full animate-spin"></div>
                </div>
              )}

              {allItems[currentIndex]?.type === 'image' ? (
                <img
                  src={`${base}/api/files/${allItems[currentIndex].id}`}
                  alt="preview"
                  className="lightbox-media"
                  loading="eager"
                  decoding="sync"
                  onLoad={() => setLoading(false)}
                />
              ) : (
                <div className="relative">
                  <video
                    ref={videoRef}
                    src={`${base}/api/files/${allItems[currentIndex].id}`}
                    controls
                    autoPlay
                    playsInline
                    muted={muted}
                    preload="auto"
                    className="lightbox-media"
                    style={{ maxHeight: '90vh', maxWidth: '100%' }}
                    onLoadedData={() => setLoading(false)}
                  />
                  {/* Mute/Unmute toggle */}
                  <button
                    className="absolute bottom-4 right-4 bg-black/60 text-white px-3 py-2 rounded"
                    onClick={() => {
                      setMuted(m => !m)
                      if (videoRef.current) {
                        videoRef.current.muted = !videoRef.current.muted
                      }
                    }}
                  >
                    {muted ? '🔇 Unmute' : '🔊 Mute'}
                  </button>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
