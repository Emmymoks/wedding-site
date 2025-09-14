import React, { useEffect, useState, useCallback } from 'react'
import axios from 'axios'
import { motion, AnimatePresence } from 'framer-motion'

export default function Gallery() {
  const [images, setImages] = useState([])
  const [videos, setVideos] = useState([])
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [allItems, setAllItems] = useState([])

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
  }, [])

  const closeLightbox = useCallback(() => {
    setLightboxOpen(false)
  }, [])

  const nextItem = useCallback(() => {
    setCurrentIndex(prev => (prev + 1) % allItems.length)
  }, [allItems])

  const prevItem = useCallback(() => {
    setCurrentIndex(prev => (prev - 1 + allItems.length) % allItems.length)
  }, [allItems])

  return (
    <div className="space-y-6">
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
                src={`${base}/api/files/${i.id}?thumb=1`}  // thumbnail version
                alt="gallery item"
                className="cursor-pointer"
                loading="lazy"
              />
            </motion.div>
          ))}
        </div>
      </motion.div>

      <motion.div className="card" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <h2>Videos</h2>
        <div className="gallery-grid">
          {videos.map((v, idx) => (
            <motion.div
              key={v.id}
              className="photo"
              whileHover={{ scale: 1.03 }}
              onClick={() => openLightbox(images.length + idx)}
            >
              <video
                src={`${base}/api/files/${v.id}?thumb=1`} // low-res/thumbnail poster
                className="cursor-pointer"
                preload="none"
              />
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
            {/* Close Button */}
            <button className="lightbox-close" onClick={closeLightbox}>
              ×
            </button>

            <motion.div
              key={currentIndex}
              className="lightbox-content"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              drag="x"
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.2}
              onDragEnd={(e, { offset, velocity }) => {
                const swipe = offset.x * velocity.x
                if (swipe < -1000) {
                  nextItem()
                } else if (swipe > 1000) {
                  prevItem()
                }
              }}
            >
              {allItems[currentIndex]?.type === 'image' ? (
                <img
                  src={`${base}/api/files/${allItems[currentIndex].id}`} // full-res only here
                  alt="preview"
                  className="lightbox-media"
                />
              ) : (
                <video
                  src={`${base}/api/files/${allItems[currentIndex].id}`} // full-res video here
                  controls
                  autoPlay
                  className="lightbox-media"
                />
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
