import React, { useState } from 'react'
import axios from 'axios'
import { motion } from 'framer-motion'

export default function Upload() {
  const [files, setFiles] = useState([])
  const [uploader, setUploader] = useState('')
  const [status, setStatus] = useState('')
  const base = import.meta.env.VITE_BACKEND_URL

  // Handle file selection
  function handleFileSelect(e) {
    const selected = Array.from(e.target.files)
    setFiles(prev => [...prev, ...selected])
  }

  // Handle drag + drop
  function handleDrop(e) {
    e.preventDefault()
    const dropped = Array.from(e.dataTransfer.files)
    setFiles(prev => [...prev, ...dropped])
  }

  function handleDragOver(e) {
    e.preventDefault()
  }

  // Submit upload
  async function handleSubmit(e) {
    e.preventDefault()
    if (files.length === 0) return alert('Pick files first')

    const form = new FormData()
    for (const f of files) form.append('files', f)
    form.append('uploader', uploader || 'guest')

    try {
      setStatus('Uploading...')
      await axios.post(`${base}/api/uploads`, form, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
      setStatus('✅ Uploaded! Awaiting admin approval.')
      setFiles([]) // clear files after upload
    } catch (e) {
      console.error(e)
      setStatus('❌ Upload failed, try again.')
    }
  }

  return (
    <div className="space-y-6 relative">
      {/* Floating Background Shapes (same as Home.jsx) */}
      <div className="floating-shapes">
        <div className="shape heart">❤</div>
        <div className="shape ring">💍</div>
        <div className="shape heart">❤</div>
        <div className="shape ring">💍</div>
        <div className="shape heart">❤</div>
        <div className="shape heart">❤</div>
        <div className="shape ring">💍</div>
        <div className="shape heart">❤</div>
        <div className="shape ring">💍</div>
        <div className="shape heart">❤</div>
      </div>

      {/* Upload Card */}
      <motion.div
        className="card upload-card relative z-10"
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
      >
        <h2 className="upload-title">📤 Upload Photos & Videos</h2>
        <p className="upload-subtitle">
          Share your favorite memories. Files will be reviewed before being added to the gallery.
        </p>

        <form onSubmit={handleSubmit} className="upload-form">
          {/* Uploader name */}
          <input
            className="input uploader-input"
            placeholder="Your name (optional)"
            value={uploader}
            onChange={e => setUploader(e.target.value)}
          />

          {/* File drop/select */}
          <div
            className="file-drop-zone"
            onDrop={handleDrop}
            onDragOver={handleDragOver}
          >
            <span className="file-instructions">
              Drag & Drop or Click to Select Files
            </span>
            <input
              type="file"
              multiple
              accept="image/*,video/*"
              onChange={handleFileSelect}
            />
          </div>

          {/* Show selected files */}
          {files.length > 0 && (
            <ul className="file-list">
              {files.map((f, i) => (
                <li key={i}>{f.name}</li>
              ))}
            </ul>
          )}

          {/* Submit button + status */}
          <div className="upload-actions">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="btn btn-primary"
              type="submit"
            >
              Upload
            </motion.button>
            <motion.span
              key={status}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.4 }}
              className="status"
            >
              {status}
            </motion.span>
          </div>
        </form>
      </motion.div>
    </div>
  )
}
