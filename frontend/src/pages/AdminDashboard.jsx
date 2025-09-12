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
  const token = localStorage.getItem('token')
  const scannerRef = useRef(null)
  const base = import.meta.env.VITE_BACKEND_URL

  useEffect(() => {
    if (!token) nav('/admin')
    fetchAll()
  }, [])

  async function fetchAll() {
    try {
      const g = await axios.get(`${base}/api/guests`, {
        headers: { Authorization: 'Bearer ' + token }
      })
      setGuests(g.data)

      const f = await axios.get(`${base}/api/uploads`, {
        headers: { Authorization: 'Bearer ' + token }
      })
      setFiles(f.data)
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
      g =>
        (g.firstName + ' ' + g.lastName).trim().toLowerCase() === norm
    )
    if (found)
      alert('✅ Confirmed Guest: ' + (found.firstName + ' ' + found.lastName))
    else alert('❌ Invalid Guest QR')
  }

  return (
    <div
      className="space-y-6"
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
        <h3>Guest List</h3>
        <form
          onSubmit={addGuest}
          className="row"
          style={{ gap: 12, marginBottom: 20 }}
        >
          <input
            className="uploader-input"
            value={first}
            onChange={e => setFirst(e.target.value)}
            placeholder="First name"
          />
          <input
            className="uploader-input"
            value={last}
            onChange={e => setLast(e.target.value)}
            placeholder="Last name"
          />
          <button className="btn btn-primary" type="submit">
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
                padding: '10px 14px',
                borderBottom: '1px solid #eee'
              }}
            >
              <span>
                {g.firstName} {g.lastName}
              </span>
              <button
                className="btn btn-secondary"
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
        <h3>QR Scanner</h3>
        <div id="reader" style={{ width: 300, marginBottom: 14 }}></div>
        <div className="row gap" style={{ gap: 10, marginBottom: 10 }}>
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

      {/* File Approvals with Preview */}
      <motion.div
        className="card"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h3>Uploads (Approve / Delete)</h3>
        <div
          className="gallery-grid"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
            gap: 20
          }}
        >
          {files.map(f => {
            const type = f.mimetype || f.contentType || ''
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
                {type.startsWith('video') ? (
                  <video
                    controls
                    style={{ width: '100%', height: 160, objectFit: 'cover' }}
                  >
                    <source src={`${base}/api/files/${f._id}`} />
                  </video>
                ) : (
                  <img
                    src={`${base}/api/files/${f._id}`}
                    alt={f.filename}
                    style={{
                      width: '100%',
                      height: 160,
                      objectFit: 'cover',
                      display: 'block'
                    }}
                  />
                )}
                <div className="photo-meta" style={{ padding: 12 }}>
                  <span style={{ display: 'block', marginBottom: 8 }}>
                    <strong>{f.metadata?.uploader || 'Anonymous'}</strong> —{' '}
                    {f.metadata?.approved ? '✅ Approved' : '❌ Pending'}
                  </span>
                  <span
                    style={{
                      display: 'block',
                      fontSize: '0.85em',
                      color: '#666',
                      marginBottom: 8
                    }}
                  >
                    {f.filename}
                  </span>
                  <div className="row gap" style={{ gap: 10 }}>
                    <button
                      className="btn btn-primary"
                      onClick={() => approveFile(f._id)}
                    >
                      Approve
                    </button>
                    <button
                      className="btn btn-secondary"
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
  )
}
