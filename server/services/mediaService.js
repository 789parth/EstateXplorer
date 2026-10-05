const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');
const { Readable } = require('stream');

/**
 * Returns the GridFS Bucket instance for the active MongoDB Atlas connection.
 */
const getMediaBucket = () => {
  if (!mongoose.connection || !mongoose.connection.db) {
    throw new Error('MongoDB database connection is not active or ready');
  }
  return new mongoose.mongo.GridFSBucket(mongoose.connection.db, {
    bucketName: 'media',
  });
};

/**
 * Uploads a buffer (from Multer memoryStorage) directly into MongoDB Atlas GridFS.
 */
const uploadBufferToGridFS = async (buffer, originalname, mimetype, uploadedBy = 'anonymous') => {
  const bucket = getMediaBucket();
  const ext = path.extname(originalname || '').toLowerCase();
  const isVideo = mimetype?.startsWith('video/') || /mp4|webm|ogg|mov|m4v|avi|mkv/.test(ext);
  const prefix = isVideo ? 'property-video-' : 'property-image-';
  const uniqueFilename = `${prefix}${Date.now()}-${Math.round(Math.random() * 1e9)}${ext || (isVideo ? '.mp4' : '.jpg')}`;

  const uploadStream = bucket.openUploadStream(uniqueFilename, {
    contentType: mimetype || (isVideo ? 'video/mp4' : 'image/jpeg'),
    metadata: {
      originalName: originalname || uniqueFilename,
      uploadedBy: String(uploadedBy),
      isVideo: Boolean(isVideo),
      uploadedAt: new Date(),
    },
  });

  const readableStream = Readable.from(buffer);

  await new Promise((resolve, reject) => {
    readableStream.pipe(uploadStream)
      .on('finish', resolve)
      .on('error', reject);
  });

  return {
    fileId: uploadStream.id.toString(),
    filename: uniqueFilename,
    url: `/api/upload/file/${uniqueFilename}`,
    size: buffer.length,
    mimetype: mimetype || (isVideo ? 'video/mp4' : 'image/jpeg'),
    isVideo,
  };
};

/**
 * Streams a media file (Image or Video) from MongoDB Atlas GridFS to the HTTP response.
 * Includes full HTTP 206 Range Request support for smooth video streaming and fast image delivery worldwide.
 */
const streamFileFromGridFS = async (req, res, idOrFilename) => {
  try {
    const bucket = getMediaBucket();
    const rawTarget = String(idOrFilename || req.params.filename || req.params.idOrFilename || req.params[0] || req.path || '');
    const cleanNoQuery = rawTarget.split('?')[0];
    const baseTarget = path.basename(cleanNoQuery);
    const cleanIdOrFilename = baseTarget || cleanNoQuery.replace(/^[\/\\]+/, '').replace(/^uploads\//, '').replace(/^api\/upload\/file\//, '');
    const isObjectId = mongoose.Types.ObjectId.isValid(cleanIdOrFilename) && cleanIdOrFilename.length === 24;

    const query = isObjectId
      ? { $or: [{ _id: new mongoose.Types.ObjectId(cleanIdOrFilename) }, { filename: cleanIdOrFilename }, { filename: baseTarget }] }
      : { $or: [{ filename: cleanIdOrFilename }, { filename: baseTarget }, { 'metadata.originalName': baseTarget }] };

    const files = await bucket.find(query).limit(1).toArray();

    if (!files || files.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Requested media not found in MongoDB Atlas database',
      });
    }

    const file = files[0];
    const fileSize = file.length;
    const contentType = file.contentType || (file.metadata && file.metadata.contentType) || 'application/octet-stream';

    // Global CDN & Browser Caching (1 year cache for immutable content)
    res.set({
      'Content-Type': contentType,
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'public, max-age=31536000, immutable',
      'Access-Control-Allow-Origin': '*',
      'Cross-Origin-Resource-Policy': 'cross-origin',
    });

    const range = req.headers?.range;

    if (range && range.startsWith('bytes=')) {
      // Handle HTTP 206 Partial Content (critical for video playback & seeking on iOS/Safari/Chrome)
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

      if (start >= fileSize || (parts[1] && end >= fileSize)) {
        res.status(416).set('Content-Range', `bytes */${fileSize}`);
        return res.end();
      }

      const chunkSize = end - start + 1;

      res.status(206).set({
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Content-Length': chunkSize,
      });

      const downloadStream = bucket.openDownloadStream(file._id, {
        start,
        end: end + 1, // GridFS end is exclusive
      });

      downloadStream.on('error', (err) => {
        console.error('GridFS streaming error:', err.message);
        if (!res.headersSent) res.status(500).end();
      });

      downloadStream.pipe(res);
    } else {
      // Full file streaming
      res.set('Content-Length', fileSize);
      const downloadStream = bucket.openDownloadStream(file._id);

      downloadStream.on('error', (err) => {
        console.error('GridFS streaming error:', err.message);
        if (!res.headersSent) res.status(500).end();
      });

      downloadStream.pipe(res);
    }
  } catch (err) {
    console.error('Error streaming file from Atlas GridFS:', err);
    if (!res.headersSent) {
      res.status(500).json({ success: false, message: 'Failed to retrieve media from database' });
    }
  }
};

/**
 * Automatically migrates existing local disk uploads to MongoDB Atlas GridFS on startup.
 * Once safely migrated to the cloud, local files are removed so no user data lives on local disk.
 */
const migrateLocalUploadsToAtlas = async () => {
  try {
    const localUploadDir = path.join(__dirname, '../uploads');
    if (!fs.existsSync(localUploadDir)) return;

    const files = fs.readdirSync(localUploadDir);
    if (files.length === 0) return;

    const bucket = getMediaBucket();

    for (const filename of files) {
      const filePath = path.join(localUploadDir, filename);
      const stats = fs.statSync(filePath);
      if (!stats.isFile()) continue;

      // Check if already in MongoDB Atlas GridFS
      const existing = await bucket.find({ filename }).toArray();
      if (existing && existing.length > 0) {
        // Already stored in MongoDB Atlas, remove local file
        try {
          fs.unlinkSync(filePath);
        } catch (e) {}
        continue;
      }

      // Read and upload to Atlas
      const ext = path.extname(filename).toLowerCase();
      const isVideo = /mp4|webm|ogg|mov|m4v|avi|mkv/.test(ext);
      const mimetype = isVideo ? 'video/mp4' : (ext === '.png' ? 'image/png' : 'image/jpeg');

      const fileBuffer = fs.readFileSync(filePath);
      const uploadStream = bucket.openUploadStream(filename, {
        contentType: mimetype,
        metadata: {
          originalName: filename,
          migratedFromLocal: true,
          isVideo,
          uploadedAt: new Date(),
        },
      });

      const readable = Readable.from(fileBuffer);
      await new Promise((resolve, reject) => {
        readable.pipe(uploadStream).on('finish', resolve).on('error', reject);
      });

      console.log(`[Atlas Storage] Migrated local file ${filename} to MongoDB Atlas GridFS`);

      // Remove local copy after successful cloud migration
      try {
        fs.unlinkSync(filePath);
      } catch (e) {}
    }

    console.log('[Atlas Storage] All media now securely stored in MongoDB Atlas Cloud Database.');
  } catch (err) {
    console.warn('[Atlas Storage] Migration check note:', err.message);
  }
};

module.exports = {
  getMediaBucket,
  uploadBufferToGridFS,
  streamFileFromGridFS,
  migrateLocalUploadsToAtlas,
};