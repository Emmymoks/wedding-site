import React, { useState } from 'react'
import axios from 'axios'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'

export default function Admin() {
  const [username, setUsername] = useState('User1')
  const [password, setPassword] = useState('')
  const [resetKey, setResetKey] = useState('')
  const [newPass, setNewPass] = useState('')
  const nav = useNavigate()
  const base = import.meta.env.VITE_BACKEND_URL

  async function login(e) {
    e.preventDefault()
    try {
      const res = await axios.post(`${base}/api/auth/login`, { username, password })
      localStorage.setItem('token', res.data.token)
      nav('/admin/dashboard')
    } catch {
      alert('Login failed')
    }
  }

  async function reset(e) {
    e.preventDefault()
    try {
      await axios.post(`${base}/api/auth/reset-password`, {
        username,
        newPassword: newPass,
        secretKey: resetKey
      })
      alert('Password reset OK. Use new password to login.')
    } catch {
      alert('Reset failed')
    }
  }

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

      {/* Auth Card */}
      <motion.div
        className="card auth-card relative z-10"
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        style={{ maxWidth: 420, margin: '60px auto', padding: '32px' }}
      >
        <h2 className="upload-title">Admin Login</h2>
        <p className="upload-subtitle">Access the dashboard to manage guests & uploads.</p>

        {/* Login form */}
        <form onSubmit={login} className="upload-form">
          <input
            className="uploader-input"
            placeholder="Username"
            value={username}
            onChange={e => setUsername(e.target.value)}
          />
          <input
            className="uploader-input"
            type="password"
            placeholder="Password"
            value={password}
            onChange={e => setPassword(e.target.value)}
          />
          <button className="btn btn-primary" type="submit">Login</button>
        </form>

        <hr style={{ margin: '28px 0' }} />

        {/* Reset form */}
        <h3 style={{ marginBottom: 10 }}>Reset Password</h3>
        <form onSubmit={reset} className="upload-form">
          <input
            className="uploader-input"
            placeholder="Secret key"
            value={resetKey}
            onChange={e => setResetKey(e.target.value)}
          />
          <input
            className="uploader-input"
            placeholder="New password"
            type="password"
            value={newPass}
            onChange={e => setNewPass(e.target.value)}
          />
          <button className="btn btn-secondary" type="submit">Reset</button>
        </form>
      </motion.div>
    </div>
  )
}
