// server.js
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
const sharp = require('sharp');
const stream = require('stream');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegInstaller = require('@ffmpeg-installer/ffmpeg');
const os = require('os');
const fs = require('fs');

ffmpeg.setFfmpegPath(ffmpegInstaller.path);

const app = express();
app.use(express.json());

/* -------------------- CORS -------------------- */
// default allowed origins (dev + known frontends)
const DEFAULT_ALLOWED = [
  'http://localhost:5173',
  'http://localhost:3000',
  'https://wedding-site-sigma-indol.vercel.app',
  // add the Vercel hostname you referenced in logs — keep generic matching in code below
];

// also allow additional via env
const extra = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

const allowedOrigins = Array.from(new Set([...DEFAULT_ALLOWED, ...extra]));

// permissive check: allow exact or origin startsWith any allowed origin
app.use(
  cors({
    origin(origin, cb) {
      // allow non-browser requests (curl, server-to-server)
      if (!origin) return cb(null, true);

      // exact match or startsWith (for subpaths or trailing slash differences)
      if (allowedOrigins.some(o => origin === o || origin.startsWith(o))) {
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

// Schemas
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

// auth middleware
function authMiddleware(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).json({ error: 'No token' });
  const token = auth.split(' ')[1];
  try {
    const data = jwt.verify(token, JWT_SECRET);
    req.user = data;
    return next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

// ensure admin
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

/* ---------- Helpers ---------- */
function streamToBuffer(readStream) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    readStream.on('data', (c) => chunks.push(c));
    readStream.on('end', () => resolve(Buffer.concat(chunks)));
    readStream.on('error', (err) => reject(err));
  });
}

async function findThumbnailByOriginalId(originalId) {
  const files = await mongoose.connection.db
    .collection('uploads.files')
    .find({ 'metadata.originalId': new mongoose.Types.ObjectId(originalId), 'metadata.isThumbnail': true })
    .toArray();
  return files && files.length ? files[0] : null;
}

async function generateImageThumbnail(originalFile) {
  try {
    const _id = new mongoose.Types.ObjectId(originalFile._id);
    const readStream = bucket.openDownloadStream(_id);
    const buf = await streamToBuffer(readStream);

    const thumbBuf = await sharp(buf).resize({ width: 300, withoutEnlargement: true }).jpeg({ quality: 75 }).toBuffer();

    const uploadStream = bucket.openUploadStream(originalFile.filename + '_thumb.jpg', {
      metadata: {
        originalId: new mongoose.Types.ObjectId(originalFile._id),
        isThumbnail: true,
        uploader: originalFile.metadata?.uploader || 'system'
      },
      contentType: 'image/jpeg'
    });

    const bufferStream = new stream.PassThrough();
    bufferStream.end(thumbBuf);
    bufferStream.pipe(uploadStream);

    return new Promise((resolve, reject) => {
      uploadStream.on('finish', async (file) => {
        const stored = await mongoose.connection.db.collection('uploads.files').findOne({ _id: file._id });
        resolve(stored);
      });
      uploadStream.on('error', (err) => {
        console.error('Thumbnail upload error:', err);
        reject(err);
      });
    });
  } catch (err) {
    console.error('generateImageThumbnail error:', err);
    return null;
  }
}

async function generateVideoThumbnail(originalFile) {
  try {
    const _id = new mongoose.Types.ObjectId(originalFile._id);
    const tempInput = path.join(os.tmpdir(), `${_id}.bin`);
    const tempOutput = path.join(os.tmpdir(), `${_id}_thumb.jpg`);

    // Save video locally from GridFS
    await new Promise((resolve, reject) => {
      const writeStream = fs.createWriteStream(tempInput);
      bucket.openDownloadStream(_id)
        .pipe(writeStream)
        .on('finish', resolve)
        .on('error', reject);
    });

    // Extract a single frame (first second)
    await new Promise((resolve, reject) => {
      ffmpeg(tempInput)
        .screenshots({
          count: 1,
          folder: path.dirname(tempOutput),
          filename: path.basename(tempOutput),
          timemarks: [ '00:00:01.000' ], // attempt at 1s
          size: '320x?'
        })
        .on('end', resolve)
        .on('error', reject);
    });

    const thumbBuf = fs.readFileSync(tempOutput);

    // Save thumbnail to GridFS
    const uploadStream = bucket.openUploadStream(originalFile.filename + '_thumb.jpg', {
      metadata: {
        originalId: new mongoose.Types.ObjectId(originalFile._id),
        isThumbnail: true,
        uploader: originalFile.metadata?.uploader || 'system'
      },
      contentType: 'image/jpeg'
    });

    const bufferStream = new stream.PassThrough();
    bufferStream.end(thumbBuf);
    bufferStream.pipe(uploadStream);

    return new Promise((resolve, reject) => {
      uploadStream.on('finish', async (file) => {
        try {
          const stored = await mongoose.connection.db.collection('uploads.files').findOne({ _id: file._id });
          resolve(stored);
        } catch (e) {
          resolve(null);
        } finally {
          // cleanup temp files
          try { fs.unlinkSync(tempInput); } catch (e) {}
          try { fs.unlinkSync(tempOutput); } catch (e) {}
        }
      });
      uploadStream.on('error', (err) => {
        console.error('Video thumbnail upload error:', err);
        reject(err);
      });
    });
  } catch (err) {
    console.error('generateVideoThumbnail error:', err);
    return null;
  }
}

/* ---------- Routes ---------- */

// AUTH
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

// Create admin user
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
  try {
    const guests = await Guest.find().lean().exec();
    res.json(guests);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
});
app.post('/api/guests', authMiddleware, async (req, res) => {
  try {
    const { firstName, lastName } = req.body;
    const g = await Guest.create({ firstName, lastName });
    res.json(g);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
});
app.delete('/api/guests/:id', authMiddleware, async (req, res) => {
  try {
    await Guest.findByIdAndDelete(req.params.id).exec();
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
});
app.put('/api/guests/:id', authMiddleware, async (req, res) => {
  try {
    const g = await Guest.findByIdAndUpdate(req.params.id, req.body, { new: true }).exec();
    res.json(g);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
});

// Upload route
app.post('/api/uploads', upload.array('files', 12), async (req, res) => {
  try {
    const out = (req.files || []).map(f => ({
      id: f.id || f._id || null,
      filename: f.filename,
      originalname: (f.metadata && f.metadata.originalname) || f.originalname || '',
      contentType: f.contentType
    }));

    // generate thumbnails asynchronously (non-blocking)
    (async () => {
      try {
        for (const f of req.files || []) {
          // fetch stored doc
          const stored = await mongoose.connection.db.collection('uploads.files').findOne({ _id: f.id || f._id });
          if (!stored) continue;
          const existingThumb = await findThumbnailByOriginalId(stored._id);
          if (existingThumb) continue;

          if (stored.contentType && stored.contentType.match(/^image\//)) {
            await generateImageThumbnail(stored);
            console.log('Generated image thumbnail for', stored._id.toString());
          } else if (stored.contentType && stored.contentType.match(/^video\//)) {
            await generateVideoThumbnail(stored);
            console.log('Generated video thumbnail for', stored._id.toString());
          }
        }
      } catch (err) {
        console.error('Background thumbnail generation error:', err);
      }
    })();

    res.json({ files: out });
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ error: 'Upload failed' });
  }
});

// Admin list files metadata
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

// Delete file (and delete any thumbnails referencing it)
app.delete('/api/uploads/:id', authMiddleware, async (req, res) => {
  const id = req.params.id;
  try {
    // delete original
    await bucket.delete(new mongoose.Types.ObjectId(id));

    // delete any thumbnails referencing this original
    const thumbs = await mongoose.connection.db
      .collection('uploads.files')
      .find({ 'metadata.originalId': new mongoose.Types.ObjectId(id) })
      .toArray();

    for (const t of thumbs) {
      try {
        await bucket.delete(t._id);
      } catch (e) {
        // ignore
      }
    }

    res.json({ ok: true });
  } catch (e) {
    console.error('Delete file error:', e);
    res.status(400).json({ error: e.message });
  }
});

/* Stream/download file
   - public access for approved files
   - admin preview via Authorization header OR ?token query param
   - thumbnail via ?thumb=1
*/
app.get('/api/files/:id', async (req, res) => {
  try {
    const _id = new mongoose.Types.ObjectId(req.params.id);

    const files = await mongoose.connection.db.collection('uploads.files').find({ _id }).toArray();
    if (!files || files.length === 0) return res.status(404).json({ error: 'File not found' });
    const file = files[0];

    const wantsThumb = req.query.thumb && (req.query.thumb === '1' || req.query.thumb === 'true');

    // If thumbnail requested and original is image/video -> try to find stored thumbnail
    if (wantsThumb) {
      // look for thumbnail referencing this original
      const thumb = await findThumbnailByOriginalId(file._id);
      if (thumb) {
        res.set('Content-Type', thumb.contentType || 'image/jpeg');
        res.set('Cache-Control', 'public, max-age=604800'); // 7 days
        const thumbStream = bucket.openDownloadStream(thumb._id);
        return thumbStream.pipe(res);
      } else {
        // If original is image, attempt to generate on-the-fly and stream
        if (file.contentType && file.contentType.match(/^image\//)) {
          const generated = await generateImageThumbnail(file);
          if (generated) {
            res.set('Content-Type', generated.contentType || 'image/jpeg');
            res.set('Cache-Control', 'public, max-age=604800');
            const s = bucket.openDownloadStream(generated._id);
            return s.pipe(res);
          }
        }
        // For videos, try generate a video thumb (might be slow) and stream if created
        if (file.contentType && file.contentType.match(/^video\//)) {
          const generated = await generateVideoThumbnail(file);
          if (generated) {
            res.set('Content-Type', generated.contentType || 'image/jpeg');
            res.set('Cache-Control', 'public, max-age=604800');
            const s = bucket.openDownloadStream(generated._id);
            return s.pipe(res);
          }
        }
        // fallback to original file stream if thumbnail not available
      }
    }

    // Authorization for original/inline file
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

    // Stream original
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

// Convenience thumbnail endpoint (returns thumbnail for original file id)
app.get('/api/thumbnails/:id', async (req, res) => {
  try {
    const originalId = new mongoose.Types.ObjectId(req.params.id);
    // find existing thumbnail referencing original id
    const thumb = await mongoose.connection.db.collection('uploads.files').findOne({ 'metadata.originalId': originalId, 'metadata.isThumbnail': true });

    if (thumb) {
      res.set('Content-Type', thumb.contentType || 'image/jpeg');
      res.set('Cache-Control', 'public, max-age=604800');
      const thumbStream = bucket.openDownloadStream(thumb._id);
      return thumbStream.pipe(res);
    }

    // If no thumb found, try to fetch original and generate if image/video
    const orig = await mongoose.connection.db.collection('uploads.files').findOne({ _id: originalId });
    if (!orig) return res.status(404).json({ error: 'Original file not found' });

    if (orig.contentType && orig.contentType.match(/^image\//)) {
      const generated = await generateImageThumbnail(orig);
      if (generated) {
        res.set('Content-Type', generated.contentType || 'image/jpeg');
        res.set('Cache-Control', 'public, max-age=604800');
        const s = bucket.openDownloadStream(generated._id);
        return s.pipe(res);
      }
    } else if (orig.contentType && orig.contentType.match(/^video\//)) {
      const generated = await generateVideoThumbnail(orig);
      if (generated) {
        res.set('Content-Type', generated.contentType || 'image/jpeg');
        res.set('Cache-Control', 'public, max-age=604800');
        const s = bucket.openDownloadStream(generated._id);
        return s.pipe(res);
      }
    }

    // fallback: stream original (but this will be full file)
    res.set('Content-Type', orig.contentType || 'application/octet-stream');
    bucket.openDownloadStream(originalId).pipe(res);
  } catch (e) {
    console.error('Thumbnail error:', e);
    res.status(500).json({ error: 'Thumbnail generation error' });
  }
});

// Gallery (public, approved only)
// returns metadata only — clients should request thumbnail via /api/files/:id?thumb=1 or /api/thumbnails/:id
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

// health
app.get('/', (req, res) => res.send('Wedding backend running'));

/* ---------- Start Server ---------- */
(async () => {
  await initDb();
  await ensureAdmin();

  app.listen(PORT, HOST, () => {
    console.log(`✅ Server listening at http://${HOST}:${PORT}`);
  });
})();
