import React, { useEffect, useState, useCallback } from 'react'
import axios from 'axios'
import { motion, AnimatePresence } from 'framer-motion'
import { X, ChevronLeft, ChevronRight } from 'lucide-react'

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

      // Merge into single array for lightbox navigation
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
    setCurrentIndex((prev) => (prev + 1) % allItems.length)
  }, [allItems])

  const prevItem = useCallback(() => {
    setCurrentIndex((prev) => (prev - 1 + allItems.length) % allItems.length)
  }, [allItems])

  return (
    <div className="space-y-6">
      <motion.div
        className="card"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      >
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

      <motion.div
        className="card"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      >
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

      {/* Lightbox Modal */}
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
              className="absolute top-4 right-4 text-white text-3xl"
              onClick={closeLightbox}
            >
              <X size={32} />
            </button>

            {/* Prev Button (Desktop only) */}
            <button
              className="hidden md:flex absolute left-4 text-white p-2 bg-black/50 rounded-full"
              onClick={prevItem}
            >
              <ChevronLeft size={32} />
            </button>

            {/* Next Button (Desktop only) */}
            <button
              className="hidden md:flex absolute right-4 text-white p-2 bg-black/50 rounded-full"
              onClick={nextItem}
            >
              <ChevronRight size={32} />
            </button>

            {/* Lightbox Content with swipe */}
            <motion.div
              key={currentIndex}
              className="max-w-4xl w-full px-4"
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
                  src={`${base}/api/files/${allItems[currentIndex].id}`}
                  alt="preview"
                  className="w-full h-auto max-h-[80vh] object-contain mx-auto rounded-lg"
                />
              ) : (
                <video
                  src={`${base}/api/files/${allItems[currentIndex].id}`}
                  controls
                  className="w-full h-auto max-h-[80vh] object-contain mx-auto rounded-lg"
                />
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
