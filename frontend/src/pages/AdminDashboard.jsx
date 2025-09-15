import React, { useEffect, useState, useRef } from 'react'
import axios from 'axios'
import { useNavigate } from 'react-router-dom'
import { Html5Qrcode } from 'html5-qrcode'
import { motion } from 'framer-motion'

export default function AdminDashboard() {
  const nav = useNavigate()
  const [guests, setGuests] = useState([])
  const [files, setFiles] = useState([])
  const [first, setFirst] = useState('')
  const [last, setLast] = useState('')
  const [scanResult, setScanResult] = useState('')
  const [showPendingOnly, setShowPendingOnly] = useState(false)
  const token = localStorage.getItem('token')
  const scannerRef = useRef(null)
  const base = import.meta.env.VITE_BACKEND_URL

  useEffect(() => {
    if (!token) nav('/admin')
    fetchAll()
  }, [])

  async function fetchAll() {
    try {
      // Guests
      const g = await axios.get(`${base}/api/guests`, {
        headers: { Authorization: 'Bearer ' + token }
      })
      setGuests(g.data)

      // Files metadata
      const f = await axios.get(`${base}/api/uploads`, {
        headers: { Authorization: 'Bearer ' + token }
      })

      // ✅ Filter out thumbnails (only originals)
      const originals = f.data.filter(file => !file.metadata?.isThumbnail)

      // Attach lightweight previews
      const withPreviews = originals.map(file => {
        const type = file.mimetype || file.contentType || ''
        return {
          ...file,
          previewUrl: `${base}/api/files/${file._id}?thumb=1`
        }
      })

      setFiles(withPreviews)
    } catch (e) {
      console.error(e)
    }
  }

  async function addGuest(e) {
    e.preventDefault()
    await axios.post(
      `${base}/api/guests`,
      { firstName: first, lastName: last },
      { headers: { Authorization: 'Bearer ' + token } }
    )
    setFirst('')
    setLast('')
    fetchAll()
  }

  async function deleteGuest(id) {
    await axios.delete(`${base}/api/guests/${id}`, {
      headers: { Authorization: 'Bearer ' + token }
    })
    fetchAll()
  }

  async function approveFile(id) {
    await axios.post(
      `${base}/api/uploads/${id}/approve`,
      {},
      { headers: { Authorization: 'Bearer ' + token } }
    )
    fetchAll()
  }

  async function deleteFile(id) {
    await axios.delete(`${base}/api/uploads/${id}`, {
      headers: { Authorization: 'Bearer ' + token }
    })
    fetchAll()
  }

  async function startScanner() {
    setScanResult('')
    const html5QrCode = new Html5Qrcode('reader')
    try {
      await html5QrCode.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: 250 },
        decoded => {
          setScanResult(decoded)
          html5QrCode.stop()
          checkGuest(decoded)
        }
      )
      scannerRef.current = html5QrCode
    } catch (e) {
      console.error(e)
    }
  }

  async function stopScanner() {
    if (scannerRef.current) await scannerRef.current.stop()
    scannerRef.current = null
  }

  function checkGuest(decoded) {
    const norm = decoded.trim().toLowerCase()
    const found = guests.find(
      g => (g.firstName + ' ' + g.lastName).trim().toLowerCase() === norm
    )
    if (found) {
      alert('✅ Confirmed Guest: ' + (found.firstName + ' ' + found.lastName))
    } else {
      alert('❌ Invalid Guest QR')
    }
  }

  const displayedFiles = showPendingOnly
    ? files.filter(f => !f.metadata?.approved)
    : files

  return (
    <div className="page-wrapper">
      {/* Floating Background Shapes */}
      <div className="floating-shapes">
        <div className="shape heart">❤</div>
        <div className="shape ring">💍</div>
        <div className="shape heart">❤</div>
        <div className="shape ring">💍</div>
        <div className="shape heart">❤</div>
      </div>

      {/* Dashboard Content */}
      <div
        className="space-y-6 relative z-10"
        style={{ maxWidth: 1100, margin: '0 auto', padding: '20px' }}
      >
        <div
          className="row space-between"
          style={{ justifyContent: 'space-between', marginBottom: 24 }}
        >
          <h2 className="upload-title">Admin Dashboard</h2>
          <button
            className="btn btn-secondary"
            onClick={() => {
              localStorage.removeItem('token')
              nav('/admin')
            }}
          >
            Logout
          </button>
        </div>

        {/* Guests */}
        <motion.div
          className="card"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h3 style={{ marginBottom: 16 }}>Guest List</h3>
          <form
            onSubmit={addGuest}
            className="row"
            style={{ gap: 16, marginBottom: 24, flexWrap: 'wrap' }}
          >
            <input
              className="uploader-input"
              value={first}
              onChange={e => setFirst(e.target.value)}
              placeholder="First name"
              style={{ flex: 1, minWidth: 200, padding: 10 }}
            />
            <input
              className="uploader-input"
              value={last}
              onChange={e => setLast(e.target.value)}
              placeholder="Last name"
              style={{ flex: 1, minWidth: 200, padding: 10 }}
            />
            <button className="btn btn-primary" type="submit" style={{ padding: '10px 20px' }}>
              Add
            </button>
          </form>
          <div className="list">
            {guests.map(g => (
              <motion.div
                key={g._id}
                className="list-item"
                whileHover={{ scale: 1.01 }}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '12px 16px',
                  borderBottom: '1px solid #eee'
                }}
              >
                <span>
                  {g.firstName} {g.lastName}
                </span>
                <button
                  className="btn btn-secondary"
                  style={{ padding: '6px 14px' }}
                  onClick={() => deleteGuest(g._id)}
                >
                  Delete
                </button>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* QR Scanner */}
        <motion.div
          className="card"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h3 style={{ marginBottom: 16 }}>QR Scanner</h3>
          <div id="reader" style={{ width: 320, marginBottom: 16 }}></div>
          <div className="row gap" style={{ gap: 12, marginBottom: 16 }}>
            <button className="btn btn-primary" onClick={startScanner}>
              Start
            </button>
            <button className="btn btn-secondary" onClick={stopScanner}>
              Stop
            </button>
          </div>
          <div>
            <strong>Result:</strong> {scanResult}
          </div>
        </motion.div>

        {/* File Approvals */}
        <motion.div
          className="card"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div
            className="row space-between"
            style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}
          >
            <h3>Uploads (Approve / Delete)</h3>
            <button
              className="btn btn-secondary"
              onClick={() => setShowPendingOnly(prev => !prev)}
            >
              {showPendingOnly ? 'Show All' : 'Show Only Pending'}
            </button>
          </div>

          <div className="gallery-grid">
            {displayedFiles.map(f => {
              const approved = f.metadata?.approved
              return (
                <motion.div
                  key={f._id}
                  className="photo"
                  whileHover={{ scale: 1.02 }}
                  style={{
                    borderRadius: 12,
                    overflow: 'hidden',
                    boxShadow: '0 4px 14px rgba(0,0,0,0.08)',
                    background: '#fff',
                    display: 'flex',
                    flexDirection: 'column'
                  }}
                >
                  <img
                    src={f.previewUrl}
                    alt={f.filename}
                    style={{
                      width: '100%',
                      height: 180,
                      objectFit: 'cover',
                      display: 'block'
                    }}
                    loading="lazy"
                  />
                  <div className="photo-meta" style={{ padding: 14 }}>
                    <span style={{ display: 'block', marginBottom: 10 }}>
                      <strong>{f.metadata?.uploader || 'Anonymous'}</strong> —{' '}
                      {approved ? '✅ Approved' : '❌ Pending'}
                    </span>
                    <span
                      style={{
                        display: 'block',
                        fontSize: '0.85em',
                        color: '#666',
                        marginBottom: 12
                      }}
                    >
                      {f.filename}
                    </span>
                    <div className="row gap" style={{ gap: 12 }}>
                      {!approved && (
                        <button
                          className="btn btn-primary"
                          style={{ padding: '8px 16px' }}
                          onClick={() => approveFile(f._id)}
                        >
                          Approve
                        </button>
                      )}
                      <button
                        className="btn btn-secondary"
                        style={{ padding: '8px 16px' }}
                        onClick={() => deleteFile(f._id)}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </motion.div>
              )
            })}
          </div>
        </motion.div>
      </div>
    </div>
  )
}
