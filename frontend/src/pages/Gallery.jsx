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
  }, [])

  const closeLightbox = useCallback(() => {
    setLightboxOpen(false)
    // Pause any playing video when closing lightbox
    if (videoRef.current) {
      videoRef.current.pause()
    }
  }, [])

  const nextItem = useCallback(() => {
    setCurrentIndex(prev => {
      const next = (prev + 1) % allItems.length
      setLoading(true)
      return next
    })
  }, [allItems])

  const prevItem = useCallback(() => {
    setCurrentIndex(prev => {
      const prevIdx = (prev - 1 + allItems.length) % allItems.length
      setLoading(true)
      return prevIdx
    })
  }, [allItems])

  // Handle video play on mobile
  const handleVideoPlay = useCallback(() => {
    setLoading(false)
    if (videoRef.current) {
      // On mobile, we need to explicitly play the video
      const playPromise = videoRef.current.play()
      if (playPromise !== undefined) {
        playPromise.catch(error => {
          console.log("Auto-play was prevented:", error)
          // Show controls if autoplay fails
          if (videoRef.current) {
            videoRef.current.controls = true
          }
        })
      }
    }
  }, [])

  // Keyboard navigation
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

  // Preload next/previous images for smoother UX
  useEffect(() => {
    if (!lightboxOpen || allItems.length === 0) return
    const preload = index => {
      const item = allItems[index]
      if (!item) return
      if (item.type === 'image') {
        const img = new Image()
        img.src = `${base}/api/files/${item.id}`
      }
    }
    preload((currentIndex + 1) % allItems.length)
    preload((currentIndex - 1 + allItems.length) % allItems.length)
  }, [lightboxOpen, currentIndex, allItems, base])

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
            onClick={closeLightbox}
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
              onClick={(e) => e.stopPropagation()} // Prevent closing when clicking on content
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
                <video
                  ref={videoRef}
                  src={`${base}/api/files/${allItems[currentIndex].id}`}
                  controls
                  autoPlay
                  playsInline
                  muted
                  preload="auto"
                  className="lightbox-media"
                  style={{ maxHeight: '90vh', maxWidth: '100%' }}
                  onLoadedData={handleVideoPlay}
                  onPlay={() => setLoading(false)}
                />
              )}
            </motion.div>

            {/* Navigation buttons */}
            {allItems.length > 1 && (
              <>
                <button 
                  className="lightbox-nav lightbox-nav-left" 
                  onClick={(e) => { e.stopPropagation(); prevItem(); }}
                >
                  ‹
                </button>
                <button 
                  className="lightbox-nav lightbox-nav-right" 
                  onClick={(e) => { e.stopPropagation(); nextItem(); }}
                >
                  ›
                </button>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
