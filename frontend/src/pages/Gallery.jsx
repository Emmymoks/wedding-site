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

      // merge into single array for lightbox navigation
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
                src={`${base}/api/files/${i.id}`}
                alt="gallery item"
                className="cursor-pointer"
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
                src={`${base}/api/files/${v.id}`}
                className="cursor-pointer"
              />
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* Lightbox Popup */}
      <AnimatePresence>
        {lightboxOpen && (
          <motion.div
            className="fixed inset-0 bg-black/90 flex items-center justify-center z-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {/* Close Button */}
            <button
              className="absolute top-6 right-6 text-white text-4xl font-bold hover:scale-110 transition-transform"
              onClick={closeLightbox}
            >
              ×
            </button>

            <motion.div
              key={currentIndex}
              className="max-w-5xl w-full px-4"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
            >
              {allItems[currentIndex]?.type === 'image' ? (
                <img
                  src={`${base}/api/files/${allItems[currentIndex].id}`}
                  alt="preview"
                  className="w-full h-auto max-h-[85vh] object-contain mx-auto rounded-lg"
                />
              ) : (
                <video
                  src={`${base}/api/files/${allItems[currentIndex].id}`}
                  controls
                  autoPlay
                  className="w-full h-auto max-h-[85vh] object-contain mx-auto rounded-lg"
                />
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
