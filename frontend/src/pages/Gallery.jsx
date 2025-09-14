import React, { useEffect, useState, useCallback } from 'react'
import axios from 'axios'
import { motion, AnimatePresence } from 'framer-motion'

export default function Gallery() {
  const [allItems, setAllItems] = useState([])
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [currentIndex, setCurrentIndex] = useState(0)

  const base = import.meta.env.VITE_BACKEND_URL

  useEffect(() => {
    fetchData()
  }, [])

  async function fetchData() {
    try {
      const imgRes = await axios.get(`${base}/api/gallery?type=image`)
      const vidRes = await axios.get(`${base}/api/gallery?type=video`)
      const combined = [
        ...imgRes.data.map(i => ({ ...i, type: 'image' })),
        ...vidRes.data.map(v => ({ ...v, type: 'video' }))
      ]
      setAllItems(combined)
      if (combined.length > 0) {
        setCurrentIndex(0)
        setLightboxOpen(true)
      }
    } catch (e) {
      console.error(e)
    }
  }

  const closeLightbox = useCallback(() => setLightboxOpen(false), [])
  const nextItem = useCallback(
    () => setCurrentIndex(prev => (prev + 1) % allItems.length),
    [allItems]
  )
  const prevItem = useCallback(
    () => setCurrentIndex(prev => (prev - 1 + allItems.length) % allItems.length),
    [allItems]
  )

  return (
    <div className="relative w-full h-full">
      {/* Lightbox */}
      <AnimatePresence>
        {lightboxOpen && allItems.length > 0 && (
          <motion.div
            className="fixed inset-0 bg-black/95 flex items-center justify-center z-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {/* Close */}
            <button
              className="absolute top-4 right-4 text-white text-3xl"
              onClick={closeLightbox}
            >
              ×
            </button>

            {/* Prev (desktop) */}
            <button
              className="hidden md:flex absolute left-4 text-white p-3 bg-black/50 rounded-full text-2xl"
              onClick={prevItem}
            >
              ‹
            </button>

            {/* Next (desktop) */}
            <button
              className="hidden md:flex absolute right-4 text-white p-3 bg-black/50 rounded-full text-2xl"
              onClick={nextItem}
            >
              ›
            </button>

            {/* Media with swipe */}
            <motion.div
              key={currentIndex}
              className="max-w-5xl w-full px-4"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              drag="x"
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.2}
              onDragEnd={(e, { offset, velocity }) => {
                const swipe = offset.x * velocity.x
                if (swipe < -1000) nextItem()
                else if (swipe > 1000) prevItem()
              }}
            >
              {allItems[currentIndex].type === 'image' ? (
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
