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
    document.body.style.overflow = 'hidden'
  }, [])

  const closeLightbox = useCallback(() => {
    setLightboxOpen(false)
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
    <div className="min-h-screen bg-gray-100 p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Photos Section */}
        <motion.div 
          className="bg-white rounded-xl shadow-lg p-4 md:p-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <h2 className="text-2xl md:text-3xl font-bold mb-6 text-gray-800">Photos</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {images.map((img, idx) => (
              <motion.div
                key={img.id}
                className="overflow-hidden rounded-lg cursor-pointer shadow-md hover:shadow-xl transition-all duration-300"
                whileHover={{ scale: 1.03 }}
                onClick={() => openLightbox(idx, 'image')}
              >
                <img
                  src={`${base}/api/files/${img.id}`}
                  alt="gallery item"
                  className="w-full h-48 md:h-56 object-cover"
                />
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Videos Section */}
        <motion.div 
          className="bg-white rounded-xl shadow-lg p-4 md:p-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          <h2 className="text-2xl md:text-3xl font-bold mb-6 text-gray-800">Videos</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {videos.map((vid, idx) => (
              <motion.div
                key={vid.id}
                className="overflow-hidden rounded-lg cursor-pointer shadow-md hover:shadow-xl transition-all duration-300"
                whileHover={{ scale: 1.03 }}
                onClick={() => openLightbox(idx, 'video')}
              >
                <div className="relative">
                  <video
                    src={`${base}/api/files/${vid.id}`}
                    className="w-full h-48 md:h-56 object-cover"
                    muted
                  />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="bg-black bg-opacity-50 rounded-full p-3">
                      <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M8 5v14l11-7z" />
                      </svg>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Lightbox Modal */}
        <AnimatePresence>
          {lightboxOpen && (
            <motion.div
              className="fixed inset-0 bg-black bg-opacity-95 z-50 flex items-center justify-center"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={closeLightbox}
            >
              {/* Close Button - Visible on all devices */}
              <motion.button
                className="absolute top-4 right-4 text-white z-50 bg-red-500 rounded-full p-2 hover:bg-red-600 transition-colors"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                onClick={(e) => {
                  e.stopPropagation();
                  closeLightbox();
                }}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
              >
                <X size={32} />
              </motion.button>

              {/* Navigation Buttons - Hidden on mobile */}
              <motion.button
                className="hidden md:flex absolute left-4 text-white p-3 bg-black bg-opacity-50 rounded-full z-50 hover:bg-opacity-70 transition-colors"
                initial={{ x: -20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                onClick={(e) => {
                  e.stopPropagation();
                  prevItem();
                }}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
              >
                <ChevronLeft size={36} />
              </motion.button>

              <motion.button
                className="hidden md:flex absolute right-4 text-white p-3 bg-black bg-opacity-50 rounded-full z-50 hover:bg-opacity-70 transition-colors"
                initial={{ x: 20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                onClick={(e) => {
                  e.stopPropagation();
                  nextItem();
                }}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
              >
                <ChevronRight size={36} />
              </motion.button>

              {/* Lightbox Content */}
              <motion.div 
                className="relative w-full max-w-5xl max-h-screen px-4 flex items-center justify-center"
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.8, opacity: 0 }}
                transition={{ type: "spring", damping: 25, stiffness: 200 }}
                onClick={(e) => e.stopPropagation()}
                drag="x"
                dragConstraints={{ left: 0, right: 0 }}
                onDragEnd={(e, info) => {
                  if (info.offset.x > 100) prevItem()
                  if (info.offset.x < -100) nextItem()
                }}
              >
                {currentType === 'image' ? (
                  <motion.img
                    key={`image-${currentIndex}`}
                    src={`${base}/api/files/${images[currentIndex]?.id}`}
                    alt="lightbox"
                    className="max-w-full max-h-screen object-contain rounded-lg shadow-2xl"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.3 }}
                  />
                ) : (
                  <motion.div 
                    key={`video-${currentIndex}`}
                    className="w-full"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.3 }}
                  >
                    <video
                      src={`${base}/api/files/${videos[currentIndex]?.id}`}
                      controls
                      autoPlay
                      className="max-w-full max-h-screen object-contain rounded-lg shadow-2xl"
                    />
                  </motion.div>
                )}
              </motion.div>

              {/* Mobile Navigation Hint */}
              <motion.div 
                className="md:hidden absolute bottom-8 left-0 right-0 flex justify-center text-white text-sm bg-black bg-opacity-50 py-2"
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
              >
                Swipe left/right to navigate
              </motion.div>

              {/* Current Indicator */}
              <div className="absolute top-4 left-4 text-white bg-black bg-opacity-50 px-3 py-1 rounded-full text-sm">
                {currentIndex + 1} / {currentType === 'image' ? images.length : videos.length}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
