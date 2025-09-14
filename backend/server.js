require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const crypto = require('crypto');
const multer = require('multer');
const Grid = require('gridfs-stream');
const { GridFsStorage } = require('multer-gridfs-storage');
const path = require('path');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const app = express();
app.use(express.json());

/* -------------------- CORS -------------------- */
const allowedOrigins = [
  'http://localhost:5173',
  'https://wedding-site-sigma-indol.vercel.app'
];

const extra = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

allowedOrigins.push(...extra);

app.use(
  cors({
    origin(origin, cb) {
      if (!origin) return cb(null, true);
      if (allowedOrigins.some(o => origin.startsWith(o))) {
        return cb(null, true);
      }
      console.warn('❌ Blocked by CORS:', origin);
      return cb(new Error('Not allowed by CORS: ' + origin));
    },
    credentials: true
  })
);
/* ------------------------------------------------- */

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/wedding';
const JWT_SECRET = process.env.JWT_SECRET || 'secret';
const RESET_SECRET_KEY = process.env.RESET_SECRET_KEY || 'supersecretkey';
const PORT = process.env.PORT || 5000;
const HOST = '0.0.0.0';

let gfs;
let bucket;

async function initDb() {
  try {
    await mongoose.connect(MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('✅ Mongoose connected');

    bucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, {
      bucketName: 'uploads'
    });

    gfs = Grid(mongoose.connection.db, mongoose.mongo);
    gfs.collection('uploads');

    console.log('✅ GridFS ready');
  } catch (err) {
    console.error('❌ MongoDB connection error:', err);
    process.exit(1);
  }
}

const UserSchema = new mongoose.Schema({
  username: { type: String, unique: true },
  password: String
});
const User = mongoose.models.User || mongoose.model('User', UserSchema);

const GuestSchema = new mongoose.Schema({
  firstName: String,
  lastName: String
});
const Guest = mongoose.models.Guest || mongoose.model('Guest', GuestSchema);

const FileMetaSchema = new mongoose.Schema({}, { strict: false, collection: 'uploads.files' });
const FileMeta = mongoose.models.FileMeta || mongoose.model('FileMeta', FileMetaSchema, 'uploads.files');

function authMiddleware(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).json({ error: 'No token' });
  const token = auth.split(' ')[1];
  try {
    const data = jwt.verify(token, JWT_SECRET);
    req.user = data;
    return next();
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

async function ensureAdmin() {
  try {
    const pwd = process.env.ADMIN_INIT_PASSWORD || 'admin123';
    const existing = await User.findOne({ username: 'User1' }).exec();
    if (!existing) {
      const hash = await bcrypt.hash(pwd, 10);
      await User.create({ username: 'User1', password: hash });
      console.log('✅ Created initial admin user: User1');
    } else {
      console.log('ℹ️ Admin user already exists');
    }
  } catch (err) {
    console.error('Error ensuring admin user:', err);
  }
}

/* ---------- Storage (multer + GridFS) ---------- */
const storage = new GridFsStorage({
  url: MONGO_URI,
  file: (req, file) =>
    new Promise((resolve, reject) => {
      crypto.randomBytes(16, (err, buf) => {
        if (err) return reject(err);
        const filename = buf.toString('hex') + path.extname(file.originalname);
        const fileInfo = {
          filename,
          bucketName: 'uploads',
          metadata: {
            originalname: file.originalname,
            uploader: req.body && req.body.uploader ? req.body.uploader : 'anonymous',
            approved: false
          },
          contentType: file.mimetype
        };
        resolve(fileInfo);
      });
    })
});
const upload = multer({ storage });

/* ---------- Routes ---------- */

// Auth
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Missing credentials' });
    const user = await User.findOne({ username }).exec();
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return res.status(401).json({ error: 'Invalid credentials' });
    const token = jwt.sign({ id: user._id, username: user.username }, JWT_SECRET, { expiresIn: '12h' });
    res.json({ token });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/auth/reset-password', async (req, res) => {
  try {
    const { username, newPassword, secretKey } = req.body;
    if (secretKey !== RESET_SECRET_KEY) return res.status(403).json({ error: 'Bad secret key' });
    const user = await User.findOne({ username }).exec();
    if (!user) return res.status(404).json({ error: 'User not found' });
    const hash = await bcrypt.hash(newPassword, 10);
    user.password = hash;
    await user.save();
    res.json({ ok: true });
  } catch (err) {
    console.error('Reset password error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Create new admin users
app.post('/api/users', authMiddleware, async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Missing fields' });
    const hash = await bcrypt.hash(password, 10);
    const u = await User.create({ username, password: hash });
    res.json({ id: u._id, username: u.username });
  } catch (e) {
    console.error('Create user error:', e);
    res.status(400).json({ error: e.message });
  }
});

// Guests CRUD
app.get('/api/guests', authMiddleware, async (req, res) => {
  const guests = await Guest.find().lean().exec();
  res.json(guests);
});
app.post('/api/guests', authMiddleware, async (req, res) => {
  const { firstName, lastName } = req.body;
  const g = await Guest.create({ firstName, lastName });
  res.json(g);
});
app.delete('/api/guests/:id', authMiddleware, async (req, res) => {
  await Guest.findByIdAndDelete(req.params.id).exec();
  res.json({ ok: true });
});
app.put('/api/guests/:id', authMiddleware, async (req, res) => {
  const g = await Guest.findByIdAndUpdate(req.params.id, req.body, { new: true }).exec();
  res.json(g);
});

// Upload
app.post('/api/uploads', upload.array('files', 12), (req, res) => {
  try {
    const out = (req.files || []).map(f => ({
      id: f.id || f._id || null,
      filename: f.filename,
      originalname: (f.metadata && f.metadata.originalname) || f.originalname || ''
    }));
    res.json({ files: out });
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ error: 'Upload failed' });
  }
});

// Admin list files
app.get('/api/uploads', authMiddleware, async (req, res) => {
  try {
    const files = await FileMeta.find().lean().exec();
    res.json(files);
  } catch (err) {
    console.error('List uploads error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Approve file
app.post('/api/uploads/:id/approve', authMiddleware, async (req, res) => {
  try {
    const id = req.params.id;
    const file = await FileMeta.findByIdAndUpdate(id, { $set: { 'metadata.approved': true } }, { new: true }).exec();
    res.json(file);
  } catch (err) {
    console.error('Approve error:', err);
    res.status(400).json({ error: err.message });
  }
});

// Delete file
app.delete('/api/uploads/:id', authMiddleware, async (req, res) => {
  const id = req.params.id;
  try {
    await bucket.delete(new mongoose.Types.ObjectId(id));
    res.json({ ok: true });
  } catch (e) {
    console.error('Delete file error:', e);
    res.status(400).json({ error: e.message });
  }
});

// Stream/download file (supports ?token= for admins)
app.get('/api/files/:id', async (req, res) => {
  try {
    const _id = new mongoose.Types.ObjectId(req.params.id);

    const files = await mongoose.connection.db.collection('uploads.files').find({ _id }).toArray();
    if (!files || files.length === 0) return res.status(404).json({ error: 'File not found' });
    const file = files[0];

    let allow = false;
    if (file.metadata && file.metadata.approved) allow = true;

    // Support Authorization header OR ?token query
    if (!allow) {
      let token = null;
      if (req.headers.authorization) {
        token = req.headers.authorization.split(' ')[1];
      } else if (req.query.token) {
        token = req.query.token;
      }

      if (token) {
        try {
          jwt.verify(token, JWT_SECRET);
          allow = true;
        } catch {
          allow = false;
        }
      }
    }

    if (!allow) return res.status(403).json({ error: 'Not approved yet' });

    res.set('Content-Type', file.contentType || 'application/octet-stream');
    const forceDownload = req.query.download && req.query.download !== '0';
    if (forceDownload) {
      res.set(
        'Content-Disposition',
        'attachment; filename="' +
          (file.metadata && file.metadata.originalname
            ? file.metadata.originalname.replace(/"/g, '')
            : file.filename) +
          '"'
      );
    } else {
      res.set(
        'Content-Disposition',
        'inline; filename="' +
          (file.metadata && file.metadata.originalname
            ? file.metadata.originalname.replace(/"/g, '')
            : file.filename) +
          '"'
      );
    }

    const downloadStream = bucket.openDownloadStream(_id);
    downloadStream.on('error', err => {
      console.error('Download stream error:', err);
      res.status(404).end();
    });
    downloadStream.pipe(res);
  } catch (e) {
    console.error('Stream file error:', e);
    res.status(400).json({ error: e.message });
  }
});

// Gallery (public, approved only)
app.get('/api/gallery', async (req, res) => {
  try {
    const type = req.query.type;
    const q = { 'metadata.approved': true };
    if (type === 'image') q.contentType = { $regex: 'image' };
    if (type === 'video') q.contentType = { $regex: 'video' };
    const files = await mongoose.connection.db.collection('uploads.files').find(q).toArray();
    const out = files.map(f => ({
      id: f._id,
      filename: f.filename,
      originalname: f.metadata && f.metadata.originalname,
      contentType: f.contentType
    }));
    res.json(out);
  } catch (err) {
    console.error('Gallery list error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Health
app.get('/', (req, res) => res.send('Wedding backend running'));

/* ---------- Start Server ---------- */
(async () => {
  await initDb();
  await ensureAdmin();

  app.listen(PORT, HOST, () => {
    console.log(`✅ Server listening at http://${HOST}:${PORT}`);
  });
})();
