import React, { useEffect, useState } from 'react'
import axios from 'axios'
import { motion } from 'framer-motion'

export default function Gallery() {
  const [images, setImages] = useState([])
  const [videos, setVideos] = useState([])

  useEffect(() => { fetchData() }, [])

  async function fetchData() {
    try {
      const imgRes = await axios.get('/api/gallery?type=image')
      const vidRes = await axios.get('/api/gallery?type=video')
      setImages(imgRes.data)
      setVideos(vidRes.data)
    } catch (e) {
      console.error(e)
    }
  }

  return (
    <div className="space-y-6">
      <motion.div className="card" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <h2>Photos</h2>
        <div className="gallery-grid">
          {images.map(i => (
            <motion.div key={i.id} className="photo" whileHover={{ scale: 1.03 }}>
              <img src={`/api/files/${i.id}`} alt={i.originalname} />
              <div className="photo-meta">
                <span>{i.originalname}</span>
                <a href={`/api/files/${i.id}?download=1`} target="_blank" rel="noreferrer">Download</a>
              </div>
            </motion.div>
          ))}
        </div>
      </motion.div>

      <motion.div className="card" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <h2>Videos</h2>
        <div className="gallery-grid">
          {videos.map(v => (
            <motion.div key={v.id} className="photo" whileHover={{ scale: 1.03 }}>
              <video controls>
                <source src={`/api/files/${v.id}`} />
                Your browser does not support video.
              </video>
              <div className="photo-meta">
                <span>{v.originalname}</span>
                <a href={`/api/files/${v.id}?download=1`} target="_blank" rel="noreferrer">Download</a>
              </div>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </div>
  )
}
