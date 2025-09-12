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

// CORS - allow origins from environment or allow all (for simplicity)
const ALLOWED = (process.env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
if (ALLOWED.length > 0) {
  app.use(cors({
    origin(origin, cb) {
      // allow server-to-server (no origin)
      if (!origin) return cb(null, true);
      if (ALLOWED.includes(origin)) return cb(null, true);
      cb(new Error('Not allowed by CORS'));
    }
  }));
} else {
  app.use(cors());
}

// Environment
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/wedding';
const JWT_SECRET = process.env.JWT_SECRET || 'secret';
const PORT = process.env.PORT || 5000;
const RESET_SECRET_KEY = process.env.RESET_SECRET_KEY || 'supersecretkey';
const HOST = process.env.HOST || '0.0.0.0';

// Models (define after connecting where appropriate)
let gfs;            // gridfs-stream instance
let bucket;         // GridFSBucket instance

// Connect Mongoose and initialize GridFS once ready
async function initDb() {
  try {
    // Connect mongoose main connection
    await mongoose.connect(MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('✅ Mongoose connected');

    // Create GridFS bucket from mongoose connection DB
    bucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, { bucketName: 'uploads' });

    // gridfs-stream uses the native driver DB and mongo from mongoose
    gfs = Grid(mongoose.connection.db, mongoose.mongo);
    gfs.collection('uploads');

    console.log('✅ GridFS (gfs + bucket) ready');
  } catch (err) {
    console.error('❌ MongoDB connection error:', err);
    process.exit(1);
  }
}

// Mongoose schemas & models
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

// Auth middleware
function authMiddleware(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).json({ error: 'No token' });
  const token = auth.split(' ')[1];
  try {
    const data = jwt.verify(token, JWT_SECRET);
    req.user = data;
    return next();
  } catch (e) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

// Create initial admin (run after DB connected)
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

/* ---------- Storage (multer + multer-gridfs-storage) ---------- */
const storage = new GridFsStorage({
  url: MONGO_URI,
  file: (req, file) => {
    return new Promise((resolve, reject) => {
      crypto.randomBytes(16, (err, buf) => {
        if (err) return reject(err);
        const filename = buf.toString('hex') + path.extname(file.originalname);
        const fileInfo = {
          filename,
          bucketName: 'uploads',
          metadata: {
            originalname: file.originalname,
            uploader: (req.body && req.body.uploader) ? req.body.uploader : 'anonymous',
            approved: false
          },
          contentType: file.mimetype
        };
        resolve(fileInfo);
      });
    });
  }
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

// Create new admin users (protected)
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

// Guests (CRUD) - protected
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

/* Upload endpoint (public) */
app.post('/api/uploads', upload.array('files', 12), (req, res) => {
  // req.files contains info. Be defensive about id/_id
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

/* Admin: list files (metadata) */
app.get('/api/uploads', authMiddleware, async (req, res) => {
  try {
    const files = await FileMeta.find().lean().exec();
    res.json(files);
  } catch (err) {
    console.error('List uploads error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

/* Approve & delete files (admin) */
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

app.delete('/api/uploads/:id', authMiddleware, async (req, res) => {
  const id = req.params.id;
  try {
    await bucket.delete(new mongoose.Types.ObjectId(id));
    // Also remove metadata entry if needed (GridFS bucket delete already removes files & chunks)
    res.json({ ok: true });
  } catch (e) {
    console.error('Delete file error:', e);
    res.status(400).json({ error: e.message });
  }
});

/* Stream/download file
   - Public access allowed only if metadata.approved === true
   - Admin (valid token) can view even if not approved so they can review uploads
*/
app.get('/api/files/:id', async (req, res) => {
  try {
    const mongoose = require('mongoose');
    const _id = new mongoose.Types.ObjectId(req.params.id);

    const files = await mongoose.connection.db.collection('uploads.files').find({ _id }).toArray();
    if (!files || files.length === 0) return res.status(404).json({ error: 'File not found' });
    const file = files[0];

    // Check approval - allow if approved OR admin token provided and valid
    let allow = false;
    if (file.metadata && file.metadata.approved) allow = true;

    // if not approved, see if request has valid admin token
    if (!allow) {
      const auth = req.headers.authorization;
      if (auth) {
        const token = auth.split(' ')[1];
        try {
          jwt.verify(token, JWT_SECRET);
          allow = true;
        } catch (e) {
          allow = false;
        }
      }
    }

    if (!allow) return res.status(403).json({ error: 'Not approved yet' });

    // Set headers — allow inline viewing or download query param to force attachment
    res.set('Content-Type', file.contentType || 'application/octet-stream');
    const forceDownload = req.query.download && req.query.download !== '0';
    if (forceDownload) {
      res.set('Content-Disposition', 'attachment; filename="' + (file.metadata && file.metadata.originalname ? file.metadata.originalname.replace(/"/g, '') : file.filename) + '"');
    } else {
      res.set('Content-Disposition', 'inline; filename="' + (file.metadata && file.metadata.originalname ? file.metadata.originalname.replace(/"/g, '') : file.filename) + '"');
    }

    const downloadStream = bucket.openDownloadStream(_id);
    downloadStream.on('error', (err) => {
      console.error('Download stream error:', err);
      res.status(404).end();
    });
    downloadStream.pipe(res);
  } catch (e) {
    console.error('Stream file error:', e);
    res.status(400).json({ error: e.message });
  }
});

/* Public gallery listing (only approved files) */
app.get('/api/gallery', async (req, res) => {
  try {
    const type = req.query.type; // "image" or "video" optional
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

/* Start everything */
(async () => {
  await initDb();
  await ensureAdmin();

  app.listen(PORT, HOST, () => {
    console.log(`✅ Server listening at http://${HOST}:${PORT}`);
  });
})();
