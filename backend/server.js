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
const DEFAULT_ALLOWED = [
  'http://localhost:5173',
  'http://localhost:3000',
  'https://wedding-site-sigma-indol.vercel.app',
];
const extra = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);
const allowedOrigins = Array.from(new Set([...DEFAULT_ALLOWED, ...extra]));

app.use(
  cors({
    origin(origin, cb) {
      if (!origin) return cb(null, true);
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
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

// ensure admin
async function ensureAdmin() {
  const pwd = process.env.ADMIN_INIT_PASSWORD || 'admin123';
  const existing = await User.findOne({ username: 'User1' }).exec();
  if (!existing) {
    const hash = await bcrypt.hash(pwd, 10);
    await User.create({ username: 'User1', password: hash });
    console.log('✅ Created initial admin user: User1');
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
            uploader: req.body?.uploader || 'anonymous',
            approved: false
          },
          contentType: file.mimetype
        };
        resolve(fileInfo);
      });
    })
});
const upload = multer({ storage });

/* ---------- Helpers (thumbnails) ---------- */
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
      uploadStream.on('error', (err) => reject(err));
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

    await new Promise((resolve, reject) => {
      const writeStream = fs.createWriteStream(tempInput);
      bucket.openDownloadStream(_id)
        .pipe(writeStream)
        .on('finish', resolve)
        .on('error', reject);
    });

    await new Promise((resolve, reject) => {
      ffmpeg(tempInput)
        .screenshots({
          count: 1,
          folder: path.dirname(tempOutput),
          filename: path.basename(tempOutput),
          timemarks: [ '00:00:01.000' ],
          size: '320x?'
        })
        .on('end', resolve)
        .on('error', reject);
    });

    const thumbBuf = fs.readFileSync(tempOutput);

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
        } catch {
          resolve(null);
        } finally {
          try { fs.unlinkSync(tempInput); } catch {}
          try { fs.unlinkSync(tempOutput); } catch {}
        }
      });
      uploadStream.on('error', (err) => reject(err));
    });
  } catch (err) {
    console.error('generateVideoThumbnail error:', err);
    return null;
  }
}

/* ---------- Routes ---------- */

// AUTH routes, Users, Guests, Uploads — unchanged ...

/* Stream/download file (UPDATED for video streaming support) */
app.get('/api/files/:id', async (req, res) => {
  try {
    const _id = new mongoose.Types.ObjectId(req.params.id);
    const file = await mongoose.connection.db.collection('uploads.files').findOne({ _id });
    if (!file) return res.status(404).json({ error: 'File not found' });

    const wantsThumb = req.query.thumb && (req.query.thumb === '1' || req.query.thumb === 'true');
    if (wantsThumb) {
      const thumb = await findThumbnailByOriginalId(file._id);
      if (thumb) {
        res.set('Content-Type', thumb.contentType || 'image/jpeg');
        return bucket.openDownloadStream(thumb._id).pipe(res);
      }
    }

    let allow = !!(file.metadata?.approved);
    if (!allow) {
      let token = req.headers.authorization?.split(' ')[1] || req.query.token;
      if (token) {
        try { jwt.verify(token, JWT_SECRET); allow = true; } catch {}
      }
    }
    if (!allow) return res.status(403).json({ error: 'Not approved yet' });

    const contentType = file.contentType || 'application/octet-stream';
    res.set('Content-Type', contentType);

    if (contentType.startsWith('video/')) {
      const fileSize = file.length;
      const range = req.headers.range;

      if (range) {
        const parts = range.replace(/bytes=/, "").split("-");
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
        const chunkSize = (end - start) + 1;

        res.writeHead(206, {
          "Content-Range": `bytes ${start}-${end}/${fileSize}`,
          "Accept-Ranges": "bytes",
          "Content-Length": chunkSize,
          "Content-Type": contentType
        });

        bucket.openDownloadStream(_id, { start, end: end + 1 }).pipe(res);
      } else {
        res.writeHead(200, {
          "Content-Length": fileSize,
          "Content-Type": contentType,
          "Accept-Ranges": "bytes"
        });
        bucket.openDownloadStream(_id).pipe(res);
      }
    } else {
      bucket.openDownloadStream(_id).pipe(res);
    }
  } catch (e) {
    console.error('Stream file error:', e);
    res.status(400).json({ error: e.message });
  }
});

// Thumbnails, Gallery, Health — unchanged ...

/* ---------- Start Server ---------- */
(async () => {
  await initDb();
  await ensureAdmin();
  app.listen(PORT, HOST, () => {
    console.log(`✅ Server listening at http://${HOST}:${PORT}`);
  });
})();
