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
const sharp = require('sharp'); // for image thumbnails
const stream = require('stream');
const ffmpeg = require('fluent-ffmpeg'); // for video thumbnails
const ffmpegInstaller = require('@ffmpeg-installer/ffmpeg');
const os = require('os');
const fs = require('fs');

ffmpeg.setFfmpegPath(ffmpegInstaller.path);

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
      uploadStream.on('error', reject);
    });
  } catch (err) {
    console.error('generateImageThumbnail error:', err);
    return null;
  }
}

async function generateVideoThumbnail(originalFile) {
  try {
    const _id = new mongoose.Types.ObjectId(originalFile._id);
    const tempInput = path.join(os.tmpdir(), `${_id}.mp4`);
    const tempOutput = path.join(os.tmpdir(), `${_id}_thumb.jpg`);

    // Save video locally from GridFS
    const writeStream = fs.createWriteStream(tempInput);
    await new Promise((resolve, reject) => {
      bucket.openDownloadStream(_id).pipe(writeStream).on('finish', resolve).on('error', reject);
    });

    // Extract first frame
    await new Promise((resolve, reject) => {
      ffmpeg(tempInput)
        .on('end', resolve)
        .on('error', reject)
        .screenshots({
          count: 1,
          folder: os.tmpdir(),
          filename: `${_id}_thumb.jpg`,
          size: '320x?'
        });
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
        const stored = await mongoose.connection.db.collection('uploads.files').findOne({ _id: file._id });
        resolve(stored);
        fs.unlinkSync(tempInput);
        fs.unlinkSync(tempOutput);
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

// (Auth, Guests, Users same as before...)

// Upload
app.post('/api/uploads', upload.array('files', 12), async (req, res) => {
  try {
    const out = (req.files || []).map(f => ({
      id: f.id || f._id || null,
      filename: f.filename,
      originalname: f.metadata?.originalname || '',
      contentType: f.contentType
    }));

    // Generate thumbnails async
    (async () => {
      for (const f of req.files || []) {
        const stored = await mongoose.connection.db.collection('uploads.files').findOne({ _id: f.id || f._id });
        if (!stored) continue;
        const existingThumb = await findThumbnailByOriginalId(stored._id);
        if (existingThumb) continue;

        if (f.contentType.match(/^image\//)) {
          await generateImageThumbnail(stored);
          console.log('Generated image thumbnail for', stored._id);
        } else if (f.contentType.match(/^video\//)) {
          await generateVideoThumbnail(stored);
          console.log('Generated video thumbnail for', stored._id);
        }
      }
    })();

    res.json({ files: out });
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ error: 'Upload failed' });
  }
});

// Files streaming (unchanged except now works for videos too with ?thumb=1)

// Gallery (unchanged, clients should request ?thumb=1 when rendering previews)

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
