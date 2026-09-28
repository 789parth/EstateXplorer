const express = require('express');
const multer = require('multer');
const path = require('path');
const { protect } = require('../middleware/authMiddleware');
const AppError = require('../utils/AppError');
const {
  uploadBufferToGridFS,
  streamFileFromGridFS,
  getMediaBucket,
} = require('../services/mediaService');

const router = express.Router();

// Use Multer Memory Storage so files are held in RAM and streamed directly to MongoDB Atlas
const storage = multer.memoryStorage();

// File filter for image and video formats
const fileFilter = (req, file, cb) => {
  const allowedImageTypes = /jpeg|jpg|png|webp|gif|avif|svg|pdf/;
  const allowedVideoTypes = /mp4|webm|ogg|mov|m4v|avi|mkv/;
  const ext = path.extname(file.originalname).toLowerCase().replace('.', '');

  const isImageOrDoc = allowedImageTypes.test(file.mimetype) || allowedImageTypes.test(ext);
  const isVideo = file.mimetype.startsWith('video/') || allowedVideoTypes.test(ext);

  if (isImageOrDoc || isVideo) {
    return cb(null, true);
  }
  cb(new AppError('Only document (PDF), image (JPEG, PNG, WEBP, GIF, AVIF) and video (MP4, WEBM, MOV) files are allowed!', 400), false);
};

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit to support high-quality photos and videos
  fileFilter,
});

// @desc    Upload single photo or video to MongoDB Atlas GridFS
// @route   POST /api/upload
// @access  Private
router.post('/', protect, upload.single('image'), async (req, res, next) => {
  try {
    if (!req.file) {
      return next(new AppError('Please provide a photo or video file to upload', 400));
    }

    const uploaded = await uploadBufferToGridFS(
      req.file.buffer,
      req.file.originalname,
      req.file.mimetype,
      req.user?._id || req.user?.id || 'authenticated_user'
    );

    res.status(200).json({
      success: true,
      message: 'File successfully stored in MongoDB Atlas Database',
      data: {
        url: uploaded.url,
        filename: uploaded.filename,
        size: uploaded.size,
        mimetype: uploaded.mimetype,
        isVideo: uploaded.isVideo,
      },
    });
  } catch (err) {
    console.error('Atlas Upload Error:', err);
    next(new AppError(`Failed to upload media to database: ${err.message}`, 500));
  }
});

// @desc    Upload multiple photos/videos to MongoDB Atlas GridFS
// @route   POST /api/upload/multiple
// @access  Private
router.post('/multiple', protect, upload.array('images', 10), async (req, res, next) => {
  try {
    if (!req.files || req.files.length === 0) {
      return next(new AppError('Please provide media files to upload', 400));
    }

    const uploadPromises = req.files.map((file) =>
      uploadBufferToGridFS(
        file.buffer,
        file.originalname,
        file.mimetype,
        req.user?._id || req.user?.id || 'authenticated_user'
      )
    );

    const uploadedFiles = await Promise.all(uploadPromises);

    res.status(200).json({
      success: true,
      message: 'Files successfully stored in MongoDB Atlas Database',
      data: uploadedFiles,
      urls: uploadedFiles.map((f) => f.url),
    });
  } catch (err) {
    console.error('Atlas Multiple Upload Error:', err);
    next(new AppError(`Failed to upload media to database: ${err.message}`, 500));
  }
});

// @desc    Public stream media endpoint (Worldwide accessible direct from MongoDB Atlas)
// @route   GET /api/upload/file/:idOrFilename
// @access  Public
router.get('/file/:idOrFilename', async (req, res) => {
  await streamFileFromGridFS(req, res, req.params.idOrFilename);
});

// @desc    Alternative public stream endpoint
// @route   GET /api/upload/:idOrFilename
// @access  Public
router.get('/:idOrFilename', async (req, res, next) => {
  if (req.params.idOrFilename === 'multiple' || req.params.idOrFilename === 'file') {
    return next();
  }
  await streamFileFromGridFS(req, res, req.params.idOrFilename);
});

module.exports = router;
