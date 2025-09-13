import React, { useEffect, useState, useCallback } from 'react'
import axios from 'axios'
import { motion, AnimatePresence } from 'framer-motion'
import { X, ChevronLeft, ChevronRight } from 'lucide-react'

export default function Gallery() {
  const [images, setImages] = useState([])
  const [videos, setVideos] = useState([])
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [currentType, setCurrentType] = useState('image')

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
    } catch (e) {
      console.error(e)
    }
  }

  const openLightbox = useCallback((index, type) => {
    setCurrentIndex(index)
    setCurrentType(type)
    setLightboxOpen(true)
    // Prevent background scrolling when lightbox is open
    document.body.style.overflow = 'hidden'
  }, [])

  const closeLightbox = useCallback(() => {
    setLightboxOpen(false)
    // Re-enable scrolling when lightbox is closed
    document.body.style.overflow = 'auto'
  }, [])

  const nextItem = useCallback(() => {
    if (currentType === 'image') {
      setCurrentIndex(prev => (prev + 1) % images.length)
    } else {
      setCurrentIndex(prev => (prev + 1) % videos.length)
    }
  }, [currentType, images.length, videos.length])

  const prevItem = useCallback(() => {
    if (currentType === 'image') {
      setCurrentIndex(prev => (prev - 1 + images.length) % images.length)
    } else {
      setCurrentIndex(prev => (prev - 1 + videos.length) % videos.length)
    }
  }, [currentType, images.length, videos.length])

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!lightboxOpen) return
      
      if (e.key === 'Escape') closeLightbox()
      if (e.key === 'ArrowRight') nextItem()
      if (e.key === 'ArrowLeft') prevItem()
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [lightboxOpen, closeLightbox, nextItem, prevItem])

  return (
    <div className="space-y-6 p-4">
      {/* Photos Section */}
      <motion.div className="card bg-white rounded-lg shadow-md p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <h2 className="text-2xl font-bold mb-4">Photos</h2>
        <div className="gallery-grid grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {images.map((img, idx) => (
            <motion.div
              key={img.id}
              className="photo overflow-hidden rounded-lg cursor-pointer"
              whileHover={{ scale: 1.03 }}
              onClick={() => openLightbox(idx, 'image')}
            >
              <img
                src={`${base}/api/files/${img.id}`}
                alt="gallery item"
                className="w-full h-48 object-cover"
              />
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* Videos Section */}
      <motion.div className="card bg-white rounded-lg shadow-md p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <h2 className="text-2xl font-bold mb-4">Videos</h2>
        <div className="gallery-grid grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {videos.map((vid, idx) => (
            <motion.div
              key={vid.id}
              className="video overflow-hidden rounded-lg cursor-pointer"
              whileHover={{ scale: 1.03 }}
              onClick={() => openLightbox(idx, 'video')}
            >
              <video
                src={`${base}/api/files/${vid.id}`}
                className="w-full h-48 object-cover"
                muted
              />
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* Lightbox Modal */}
      <AnimatePresence>
        {lightboxOpen && (
          <motion.div
            className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closeLightbox}
          >
            <button
              className="absolute top-4 right-4 text-white z-50 bg-gray-800 rounded-full p-2 hover:bg-gray-700 transition-colors"
              onClick={closeLightbox}
            >
              <X size={32} />
            </button>

            <button
              className="hidden md:flex absolute left-4 text-white p-2 bg-black bg-opacity-50 rounded-full z-50 hover:bg-opacity-70 transition-colors"
              onClick={(e) => {
                e.stopPropagation();
                prevItem();
              }}
            >
              <ChevronLeft size={32} />
            </button>

            <button
              className="hidden md:flex absolute right-4 text-white p-2 bg-black bg-opacity-50 rounded-full z-50 hover:bg-opacity-70 transition-colors"
              onClick={(e) => {
                e.stopPropagation();
                nextItem();
              }}
            >
              <ChevronRight size={32} />
            </button>

            <motion.div 
              className="relative max-w-4xl w-full max-h-screen px-4 flex items-center justify-center"
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              transition={{ type: "spring", damping: 20 }}
              onClick={(e) => e.stopPropagation()}
              drag="x"
              dragConstraints={{ left: 0, right: 0 }}
              onDragEnd={(e, info) => {
                if (info.offset.x > 100) prevItem()
                if (info.offset.x < -100) nextItem()
              }}
            >
              {currentType === 'image' ? (
                <img
                  src={`${base}/api/files/${images[currentIndex]?.id}`}
                  alt="lightbox"
                  className="max-w-full max-h-screen object-contain rounded-lg"
                />
              ) : (
                <video
                  src={`${base}/api/files/${videos[currentIndex]?.id}`}
                  controls
                  autoPlay
                  className="max-w-full max-h-screen object-contain rounded-lg"
                />
              )}
            </motion.div>

            {/* Mobile navigation hints */}
            <div className="md:hidden absolute bottom-4 left-0 right-0 flex justify-center text-white text-sm">
              Swipe to navigate
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
