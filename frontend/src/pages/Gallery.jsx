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
  }, [])

  const closeLightbox = useCallback(() => {
    setLightboxOpen(false)
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

  return (
    <div className="space-y-6">
      {/* Photos Section */}
      <motion.div className="card" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <h2>Photos</h2>
        <div className="gallery-grid">
          {images.map((img, idx) => (
            <motion.div
              key={img.id}
              className="photo"
              whileHover={{ scale: 1.03 }}
              onClick={() => openLightbox(idx, 'image')}
            >
              <img
                src={`${base}/api/files/${img.id}`}
                alt="gallery item"
                className="cursor-pointer w-full h-full object-cover"
              />
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* Videos Section */}
      <motion.div className="card" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <h2>Videos</h2>
        <div className="gallery-grid">
          {videos.map((vid, idx) => (
            <motion.div
              key={vid.id}
              className="video"
              whileHover={{ scale: 1.03 }}
              onClick={() => openLightbox(idx, 'video')}
            >
              <video
                src={`${base}/api/files/${vid.id}`}
                className="cursor-pointer w-full h-full object-cover"
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
            className="fixed inset-0 bg-black/90 flex items-center justify-center z-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <button
              className="absolute top-4 right-4 text-white z-50"
              onClick={closeLightbox}
            >
              <X size={32} />
            </button>

            <button
              className="hidden md:flex absolute left-4 text-white p-2 bg-black/50 rounded-full z-50"
              onClick={prevItem}
            >
              <ChevronLeft size={32} />
            </button>

            <button
              className="hidden md:flex absolute right-4 text-white p-2 bg-black/50 rounded-full z-50"
              onClick={nextItem}
            >
              <ChevronRight size={32} />
            </button>

            <motion.div
              className="max-w-4xl w-full px-4"
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
                  className="w-full h-auto max-h-[80vh] object-contain mx-auto"
                />
              ) : (
                <video
                  src={`${base}/api/files/${videos[currentIndex]?.id}`}
                  controls
                  autoPlay
                  className="w-full h-auto max-h-[80vh] object-contain mx-auto"
                />
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
