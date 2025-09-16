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
  const [isZoomed, setIsZoomed] = useState(false)
  const [filter, setFilter] = useState('all')
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
    setIsZoomed(false)
  }, [])

  const closeLightbox = useCallback(() => {
    setLightboxOpen(false)
    setIsZoomed(false)
    if (videoRef.current) {
      videoRef.current.pause()
    }
  }, [])

  const nextItem = useCallback(() => {
    setCurrentIndex(prev => {
      const next = (prev + 1) % filteredItems.length
      setLoading(true)
      setIsZoomed(false)
      return next
    })
  }, [allItems, filter])

  const prevItem = useCallback(() => {
    setCurrentIndex(prev => {
      const prevIdx = (prev - 1 + filteredItems.length) % filteredItems.length
      setLoading(true)
      setIsZoomed(false)
      return prevIdx
    })
  }, [allItems, filter])

  const toggleZoom = useCallback(() => {
    if (filteredItems[currentIndex]?.type === 'image') {
      setIsZoomed(prev => !prev)
    }
  }, [currentIndex, filteredItems])

  const handleVideoPlay = useCallback(() => {
    setLoading(false)
    if (videoRef.current) {
      const playPromise = videoRef.current.play()
      if (playPromise !== undefined) {
        playPromise.catch(error => {
          console.log("Auto-play was prevented:", error)
          if (videoRef.current) {
            videoRef.current.controls = true
          }
        })
      }
    }
  }, [])

  useEffect(() => {
    if (!lightboxOpen) return
    const handleKey = e => {
      if (e.key === 'ArrowRight') nextItem()
      if (e.key === 'ArrowLeft') prevItem()
      if (e.key === 'Escape') closeLightbox()
      if (e.key === ' ' && filteredItems[currentIndex]?.type === 'video') {
        e.preventDefault()
        if (videoRef.current) {
          if (videoRef.current.paused) {
            videoRef.current.play()
          } else {
            videoRef.current.pause()
          }
        }
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [lightboxOpen, nextItem, prevItem, closeLightbox, currentIndex, filteredItems])

  useEffect(() => {
    if (!lightboxOpen || filteredItems.length === 0) return
    const preload = index => {
      const item = filteredItems[index]
      if (!item) return
      if (item.type === 'image') {
        const img = new Image()
        img.src = `${base}/api/files/${item.id}`
      }
    }
    preload((currentIndex + 1) % filteredItems.length)
    preload((currentIndex - 1 + filteredItems.length) % filteredItems.length)
  }, [lightboxOpen, currentIndex, filteredItems, base])

  // Filtered view
  const filteredItems =
    filter === 'photos'
      ? images.map(i => ({ ...i, type: 'image' }))
      : filter === 'videos'
      ? videos.map(v => ({ ...v, type: 'video' }))
      : allItems

  return (
    <div className="space-y-6 relative">
      {/* Floating shapes */}
      <div className="floating-shapes">
        <span className="shape ring">◯</span>
        <span className="shape heart">❤</span>
        <span className="shape ring">◯</span>
        <span className="shape heart">❤</span>
      </div>

      {/* Filter buttons */}
      <div className="card filter-buttons flex gap-4 justify-center">
        <button
          className={`btn ${filter === 'all' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setFilter('all')}
        >
          All
        </button>
        <button
          className={`btn ${filter === 'photos' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setFilter('photos')}
        >
          Photos
        </button>
        <button
          className={`btn ${filter === 'videos' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setFilter('videos')}
        >
          Videos
        </button>
      </div>

      {/* Gallery grid */}
      <motion.div className="card" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <h2 className="mb-4 text-center capitalize">{filter}</h2>
        <div className="gallery-grid">
          {filteredItems.map((item, idx) => (
            <motion.div
              key={item.id}
              className="photo relative"
              whileHover={{ scale: 1.03 }}
              onClick={() => openLightbox(idx)}
            >
              <img
                src={`${base}/api/files/${item.id}?thumb=1`}
                alt={item.originalname || 'gallery item'}
                className="cursor-pointer"
                loading="lazy"
                decoding="async"
              />
              {item.type === 'video' && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/40 text-white text-3xl font-bold">
                  ▶
                </div>
              )}
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* Lightbox Overlay (untouched) */}
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
              onClick={(e) => e.stopPropagation()}
            >
              {loading && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/30 z-10">
                  <div className="w-12 h-12 border-4 border-white border-t-transparent rounded-full animate-spin"></div>
                </div>
              )}

              {filteredItems[currentIndex]?.type === 'image' ? (
                <img
                  src={`${base}/api/files/${filteredItems[currentIndex].id}`}
                  alt="preview"
                  className={`lightbox-media ${isZoomed ? 'lightbox-media-zoomed' : ''}`}
                  loading="eager"
                  decoding="sync"
                  onLoad={() => setLoading(false)}
                  onClick={toggleZoom}
                />
              ) : (
                <video
                  ref={videoRef}
                  src={`${base}/api/files/${filteredItems[currentIndex].id}`}
                  controls
                  autoPlay
                  playsInline
                  muted
                  preload="auto"
                  className="lightbox-media lightbox-video"
                  onLoadedData={handleVideoPlay}
                  onPlay={() => setLoading(false)}
                  onClick={(e) => e.stopPropagation()}
                />
              )}
            </motion.div>

            {filteredItems.length > 1 && (
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
