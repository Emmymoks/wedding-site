import React, { useState } from 'react'
import axios from 'axios'
import { motion } from 'framer-motion'

export default function Upload() {
  const [files, setFiles] = useState(null)
  const [uploader, setUploader] = useState('')
  const [status, setStatus] = useState('')
  const base = import.meta.env.VITE_BACKEND_URL

  async function handleSubmit(e) {
    e.preventDefault()
    if (!files || files.length === 0) return alert('Pick files first')

    const form = new FormData()
    for (const f of files) form.append('files', f)
    form.append('uploader', uploader || 'guest')

    try {
      setStatus('Uploading...')
      await axios.post(`${base}/api/uploads`, form, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
      setStatus('✅ Uploaded! Awaiting admin approval.')
    } catch (e) {
      console.error(e)
      setStatus('❌ Upload failed, try again.')
    }
  }

  return (
    <motion.div
      className="card upload-card"
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

        {/* File input */}
        <label className="file-drop-zone">
          <span className="file-instructions">Drag & Drop or Click to Select Files</span>
          <input
            type="file"
            multiple
            accept="image/*,video/*,image/heif"
            onChange={e => setFiles(e.target.files)}
            hidden
          />
        </label>

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
  )
}
