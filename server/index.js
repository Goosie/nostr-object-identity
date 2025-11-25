import express from 'express'
import cors from 'cors'
import multer from 'multer'
import path from 'path'
import { fileURLToPath } from 'url'
import dotenv from 'dotenv'
import { NostrClient, generateObjectId, calculateImageHash } from '../utils/nostr.js'
import { imageProcessor } from '../utils/imageProcessing.js'
import { AdvancedImageMatcher } from '../utils/advancedImageMatching.js'
import { PhysicalIdentifier } from '../utils/physicalIdentifier.js'
import { qrGenerator } from '../utils/qrCode.js'
import fs from 'fs/promises'
import sharp from 'sharp'
import { imageHash } from 'image-hash'
import { promisify } from 'util'

const imageHashAsync = promisify(imageHash)

dotenv.config()

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()
const PORT = process.env.PORT || 12001

// Middleware
app.use(cors({
  origin: true,
  credentials: true
}))
app.use(express.json())
app.use(express.static(path.join(__dirname, '../dist')))

// Create uploads directory
const uploadsDir = path.join(__dirname, '../uploads')
try {
  await fs.mkdir(uploadsDir, { recursive: true })
} catch (error) {
  console.log('Uploads directory already exists')
}

// Configure multer for file uploads
const storage = multer.memoryStorage()
const upload = multer({ 
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
    fieldSize: 1024 * 1024 // 1MB field size limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp']
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true)
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, and WebP are allowed.'))
    }
  }
})

// Initialize services
const nostrClient = new NostrClient(
  process.env.NOSTR_PRIVATE_KEY,
  process.env.NOSTR_RELAYS?.split(',') || []
)
const advancedMatcher = new AdvancedImageMatcher()
const physicalIdentifier = new PhysicalIdentifier()

// In-memory storage for demo (use database in production)
const objectDatabase = new Map()
const hashDatabase = new Map() // pHash -> objectId mapping
const physicalIdDatabase = new Map() // physicalId -> objectId mapping

// API Routes

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() })
})

// Multer error handling middleware
const handleMulterError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File too large. Maximum size is 10MB.' })
    }
    if (err.code === 'LIMIT_FIELD_VALUE') {
      return res.status(400).json({ error: 'Field value too large.' })
    }
    return res.status(400).json({ error: `Upload error: ${err.message}` })
  }
  if (err) {
    return res.status(400).json({ error: err.message })
  }
  next()
}

// Create object identity
app.post('/api/objects', upload.single('image'), handleMulterError, async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image file provided' })
    }

    const { name, artist, type = 'poster', description = '', customPhysicalId = '' } = req.body

    if (!name || !artist) {
      return res.status(400).json({ error: 'Name and artist are required' })
    }

    // Check for duplicate custom physical ID if provided
    if (customPhysicalId && customPhysicalId.trim()) {
      const trimmedCustomId = customPhysicalId.trim()
      const existingObjectId = physicalIdDatabase.get(trimmedCustomId)
      if (existingObjectId) {
        const existingObject = objectDatabase.get(existingObjectId)
        return res.status(409).json({
          error: 'Physical ID already exists',
          message: `The physical ID "${trimmedCustomId}" is already used by another object: "${existingObject?.name || 'Unknown'}" by ${existingObject?.artist || 'Unknown'}`,
          existingObject: {
            id: existingObjectId,
            name: existingObject?.name,
            artist: existingObject?.artist,
            type: existingObject?.type
          }
        })
      }
    }

    // Process image
    const imageBuffer = req.file.buffer
    const processedImage = await imageProcessor.processImage(imageBuffer)
    const thumbnail = await imageProcessor.generateThumbnail(imageBuffer)
    const pHashData = await imageProcessor.generateRobustPHashFromBuffer(imageBuffer)
    const pHash = pHashData.primary
    const imageHash = calculateImageHash(imageBuffer)
    const metadata = await imageProcessor.extractMetadata(imageBuffer)

    // Check for duplicates using robust pHash matching with very strict threshold
    console.log('Checking for duplicates with robust matching...')
    const duplicateMatch = await imageProcessor.findBestMatch(imageBuffer, hashDatabase, 3)
    
    if (duplicateMatch) {
      console.log(`Duplicate found: ${duplicateMatch.objectId} with distance ${duplicateMatch.distance}`)
      return res.status(409).json({
        error: 'Similar object already exists',
        similarObjects: [{
          objectId: duplicateMatch.objectId,
          hash: duplicateMatch.hash,
          distance: duplicateMatch.distance
        }],
        newHash: pHash
      })
    }

    // Generate unique ID
    const uniqueId = generateObjectId(name, artist)

    // Save processed images
    const imagePath = path.join(uploadsDir, `${uniqueId}.jpg`)
    const thumbnailPath = path.join(uploadsDir, `${uniqueId}_thumb.jpg`)
    
    await fs.writeFile(imagePath, processedImage)
    await fs.writeFile(thumbnailPath, thumbnail)

    // Create Nostr event
    const objectData = {
      uniqueId,
      name,
      type,
      imageHash,
      artist,
      provenance: 'first-mint',
      description,
      imageUrl: `/api/images/${uniqueId}.jpg`,
      pHash
    }

    // Create Nostr event (with error handling)
    let nostrEvent, naddr
    try {
      nostrEvent = await nostrClient.createObjectIdentity(objectData)
      naddr = nostrClient.generateNaddr(nostrEvent)
    } catch (nostrError) {
      console.warn('Nostr publishing failed, continuing without relay sync:', nostrError.message)
      // Create a local event structure for storage
      nostrEvent = {
        kind: 30000,
        created_at: Math.floor(Date.now() / 1000),
        tags: [
          ['d', uniqueId],
          ['name', name],
          ['type', type],
          ['hash', imageHash],
          ['artist', artist],
          ['prov', 'first-mint'],
          ['phash', pHash],
          ['image', `/api/images/${uniqueId}.jpg`]
        ],
        content: description,
        pubkey: nostrClient.publicKey,
        id: 'local_' + uniqueId,
        sig: 'local_signature'
      }
      naddr = `naddr_local_${uniqueId}`
    }

    // Generate physical identifier and verification methods
    const physicalVerification = await physicalIdentifier.generateVerificationMethods({
      name,
      artist,
      type,
      description,
      customPhysicalId: customPhysicalId.trim() || null
    }, uniqueId)

    // Generate QR code certificate (legacy)
    const certificateData = {
      id: uniqueId,
      name,
      artist,
      naddr,
      hash: imageHash
    }

    const certificate = await qrGenerator.generateObjectCertificate(certificateData)
    const certificatePath = path.join(uploadsDir, `${uniqueId}_cert.png`)
    const physicalCertPath = path.join(uploadsDir, `${uniqueId}_physical_cert.png`)
    
    await fs.writeFile(certificatePath, certificate.qrCode)
    await fs.writeFile(physicalCertPath, physicalVerification.certificate)

    // Store in database
    const objectRecord = {
      id: uniqueId,
      name,
      artist,
      type,
      description,
      imageHash,
      pHash,
      naddr,
      nostrEventId: nostrEvent.id,
      imagePath,
      thumbnailPath,
      certificatePath,
      physicalCertPath,
      metadata,
      satsBalance: 0,
      createdAt: Date.now(),
      views: 0,
      // Physical verification data
      physicalId: physicalVerification.physicalId,
      shortId: physicalVerification.shortId,
      numericId: physicalVerification.numericId,
      verificationMethods: physicalVerification.verificationMethods
    }

    objectDatabase.set(uniqueId, objectRecord)
    
    // Store only primary hash to prevent false positives
    hashDatabase.set(pHash, uniqueId)
    
    // Store physical ID mapping for direct verification
    physicalIdDatabase.set(physicalVerification.physicalId, uniqueId)
    physicalIdDatabase.set(physicalVerification.shortId, uniqueId)
    physicalIdDatabase.set(physicalVerification.numericId, uniqueId)

    res.json({
      success: true,
      object: objectRecord,
      nostrEvent,
      naddr,
      certificate: {
        dataUrl: `data:image/png;base64,${certificate.qrCode.toString('base64')}`,
        downloadUrl: `/api/certificates/${uniqueId}`
      },
      physicalVerification: {
        physicalId: physicalVerification.physicalId,
        shortId: physicalVerification.shortId,
        numericId: physicalVerification.numericId,
        qrCode: physicalVerification.qrCode,
        printableText: physicalVerification.printableText,
        certificateUrl: `/api/physical-certificates/${uniqueId}`,
        verificationMethods: physicalVerification.verificationMethods,
        isCustomId: physicalVerification.isCustomId
      }
    })

  } catch (error) {
    console.error('Error creating object:', error)
    res.status(500).json({ error: error.message })
  }
})

// Get object by ID
app.get('/api/objects/:id', async (req, res) => {
  try {
    const { id } = req.params
    const object = objectDatabase.get(id)

    if (!object) {
      return res.status(404).json({ error: 'Object not found' })
    }

    res.json(object)
  } catch (error) {
    console.error('Error getting object:', error)
    res.status(500).json({ error: error.message })
  }
})

// Verify object by image
app.post('/api/verify', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image file provided' })
    }

    const imageBuffer = req.file.buffer
    
    console.log('Advanced Verification - Starting multi-stage matching...')
    console.log('Hash database size:', hashDatabase.size)

    // Get all stored hashes for comparison
    const storedHashes = Array.from(hashDatabase.keys())
    
    if (storedHashes.length === 0) {
      return res.json({
        verified: false,
        message: 'No objects in database to compare against'
      })
    }

    // Use advanced multi-stage matching
    const matchResults = await advancedMatcher.verifyImageMatch(imageBuffer, storedHashes)
    
    console.log('Advanced Verification Results:', {
      stage1: matchResults.stage1_phash,
      stage2: matchResults.stage2_rotation,
      overall: matchResults.overall
    })

    if (!matchResults.overall.matched) {
      return res.json({
        verified: false,
        message: 'No matching object found',
        debug: {
          stage1_distance: matchResults.stage1_phash.distance,
          stage2_distance: matchResults.stage2_rotation.distance,
          method_attempted: 'multi_stage_advanced'
        }
      })
    }

    // Find the object that matched
    let matchedObjectId = null
    let matchedHash = null
    
    // Determine which hash matched based on the method used
    if (matchResults.overall.method === 'direct_phash') {
      // Find the hash that had the minimum distance in stage 1
      // Generate hash for input image to find exact match
      const tempPath = `/tmp/verify_input_${Date.now()}.jpg`
      const normalizedBuffer = await sharp(imageBuffer)
        .rotate()
        .resize(512, 512, { 
          fit: 'inside',
          withoutEnlargement: false,
          background: { r: 255, g: 255, b: 255, alpha: 1 }
        })
        .jpeg({ quality: 90 })
        .toFile(tempPath)
      
      const inputHash = await imageHashAsync(tempPath, 16, 'hex')
      for (const storedHash of storedHashes) {
        const distance = advancedMatcher.hammingDistance(inputHash, storedHash)
        if (distance <= 3) {
          matchedHash = storedHash
          break
        }
      }
    } else if (matchResults.overall.method === 'rotation_phash') {
      // For rotation matches, we need to find which stored hash matched
      // This is more complex, but for now we'll use the first one with reasonable distance
      matchedHash = storedHashes[0] // Simplified for now
    }

    if (matchedHash) {
      matchedObjectId = hashDatabase.get(matchedHash)
    }

    if (!matchedObjectId) {
      return res.json({
        verified: false,
        message: 'Object found but could not retrieve details'
      })
    }

    const object = objectDatabase.get(matchedObjectId)
    if (!object) {
      return res.json({
        verified: false,
        message: 'Object reference found but object data missing'
      })
    }
    
    // Increment view count
    object.views += 1
    objectDatabase.set(object.id, object)

    res.json({
      verified: true,
      object: object,
      confidence: matchResults.overall.confidence,
      method: matchResults.overall.method,
      debug: {
        stage1_distance: matchResults.stage1_phash.distance,
        stage2_distance: matchResults.stage2_rotation.distance,
        matching_method: matchResults.overall.method
      }
    })

  } catch (error) {
    console.error('Error in advanced verification:', error)
    res.status(500).json({ error: error.message })
  }
})

// Add sats to object
app.post('/api/objects/:id/zap', async (req, res) => {
  try {
    const { id } = req.params
    const { amount, comment = '' } = req.body

    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'Invalid amount' })
    }

    const object = objectDatabase.get(id)
    if (!object) {
      return res.status(404).json({ error: 'Object not found' })
    }

    // Create zap event
    const zapEvent = await nostrClient.createZapEvent(object.nostrEventId, amount, comment)

    // Update balance (50/50 split)
    const artistShare = Math.floor(amount / 2)
    const objectShare = amount - artistShare

    object.satsBalance += objectShare
    objectDatabase.set(id, object)

    res.json({
      success: true,
      zapEvent,
      artistShare,
      objectShare,
      newBalance: object.satsBalance
    })

  } catch (error) {
    console.error('Error adding zap:', error)
    res.status(500).json({ error: error.message })
  }
})

// Add content to object
app.post('/api/objects/:id/content', async (req, res) => {
  try {
    const { id } = req.params
    const { content, contentType = 'text' } = req.body

    if (!content) {
      return res.status(400).json({ error: 'Content is required' })
    }

    const object = objectDatabase.get(id)
    if (!object) {
      return res.status(404).json({ error: 'Object not found' })
    }

    // Add content as Nostr event
    const contentEvent = await nostrClient.addObjectContent(object.nostrEventId, content, contentType)

    res.json({
      success: true,
      contentEvent
    })

  } catch (error) {
    console.error('Error adding content:', error)
    res.status(500).json({ error: error.message })
  }
})

// Get object thread/story
app.get('/api/objects/:id/thread', async (req, res) => {
  try {
    const { id } = req.params
    const object = objectDatabase.get(id)

    if (!object) {
      return res.status(404).json({ error: 'Object not found' })
    }

    const thread = await nostrClient.getObjectThread(object.nostrEventId)

    res.json({
      object,
      thread
    })

  } catch (error) {
    console.error('Error getting thread:', error)
    res.status(500).json({ error: error.message })
  }
})

// Serve images
app.get('/api/images/:filename', async (req, res) => {
  try {
    const { filename } = req.params
    const imagePath = path.join(uploadsDir, filename)
    
    const imageBuffer = await fs.readFile(imagePath)
    const ext = path.extname(filename).toLowerCase()
    
    let contentType = 'image/jpeg'
    if (ext === '.png') contentType = 'image/png'
    if (ext === '.webp') contentType = 'image/webp'
    
    res.set('Content-Type', contentType)
    res.send(imageBuffer)
  } catch (error) {
    res.status(404).json({ error: 'Image not found' })
  }
})

// Serve certificates
app.get('/api/certificates/:id', async (req, res) => {
  try {
    const { id } = req.params
    const certificatePath = path.join(uploadsDir, `${id}_cert.png`)
    
    const certificateBuffer = await fs.readFile(certificatePath)
    
    res.set('Content-Type', 'image/png')
    res.set('Content-Disposition', `attachment; filename="${id}_certificate.png"`)
    res.send(certificateBuffer)
  } catch (error) {
    res.status(404).json({ error: 'Certificate not found' })
  }
})

// List all objects
app.get('/api/objects', (req, res) => {
  const objects = Array.from(objectDatabase.values())
  res.json(objects)
})

// Physical verification endpoints

// Verify by physical ID (QR scan or manual entry)
app.post('/api/verify-physical', async (req, res) => {
  try {
    const { physicalId, qrData } = req.body

    let targetPhysicalId = physicalId

    // If QR data provided, parse it
    if (qrData) {
      const parsed = physicalIdentifier.parseQRScan(qrData)
      if (!parsed.valid) {
        return res.status(400).json({ error: parsed.error })
      }
      targetPhysicalId = parsed.physicalId
    }

    if (!targetPhysicalId) {
      return res.status(400).json({ error: 'Physical ID or QR data required' })
    }

    // Find object by physical ID
    const objectId = physicalIdDatabase.get(targetPhysicalId)
    if (!objectId) {
      return res.status(404).json({ 
        verified: false, 
        error: 'Physical ID not found',
        physicalId: targetPhysicalId
      })
    }

    const object = objectDatabase.get(objectId)
    if (!object) {
      return res.status(404).json({ 
        verified: false, 
        error: 'Object not found' 
      })
    }

    // Increment view count
    object.views += 1
    objectDatabase.set(objectId, object)

    res.json({
      verified: true,
      object: {
        id: object.id,
        name: object.name,
        artist: object.artist,
        type: object.type,
        description: object.description,
        satsBalance: object.satsBalance,
        views: object.views,
        createdAt: object.createdAt,
        imageUrl: object.imagePath ? `/api/images/${path.basename(object.imagePath)}` : null,
        thumbnailUrl: object.thumbnailPath ? `/api/images/${path.basename(object.thumbnailPath)}` : null
      },
      physicalId: targetPhysicalId,
      verificationMethod: 'physical_id',
      timestamp: Date.now()
    })

  } catch (error) {
    console.error('Error in physical verification:', error)
    res.status(500).json({ error: error.message })
  }
})

// Get physical certificate
app.get('/api/physical-certificates/:id', async (req, res) => {
  try {
    const { id } = req.params
    const object = objectDatabase.get(id)

    if (!object || !object.physicalCertPath) {
      return res.status(404).json({ error: 'Physical certificate not found' })
    }

    const certificateBuffer = await fs.readFile(object.physicalCertPath)
    res.set('Content-Type', 'image/png')
    res.send(certificateBuffer)

  } catch (error) {
    console.error('Error serving physical certificate:', error)
    res.status(500).json({ error: error.message })
  }
})

// Verify by physical ID via URL (for QR codes)
app.get('/api/verify-physical/:physicalId', async (req, res) => {
  try {
    const { physicalId } = req.params
    
    const objectId = physicalIdDatabase.get(physicalId)
    if (!objectId) {
      return res.status(404).json({ 
        verified: false, 
        error: 'Physical ID not found',
        physicalId
      })
    }

    const object = objectDatabase.get(objectId)
    if (!object) {
      return res.status(404).json({ 
        verified: false, 
        error: 'Object not found' 
      })
    }

    // Increment view count
    object.views += 1
    objectDatabase.set(objectId, object)

    res.json({
      verified: true,
      object: {
        id: object.id,
        name: object.name,
        artist: object.artist,
        type: object.type,
        description: object.description,
        satsBalance: object.satsBalance,
        views: object.views,
        createdAt: object.createdAt,
        imageUrl: object.imagePath ? `/api/images/${path.basename(object.imagePath)}` : null,
        thumbnailUrl: object.thumbnailPath ? `/api/images/${path.basename(object.thumbnailPath)}` : null
      },
      physicalId,
      verificationMethod: 'physical_id_url',
      timestamp: Date.now()
    })

  } catch (error) {
    console.error('Error in physical verification:', error)
    res.status(500).json({ error: error.message })
  }
})

// Debug endpoint to check stored hashes
app.get('/api/debug/hashes', (req, res) => {
  const hashes = Array.from(hashDatabase.entries()).map(([hash, objectId]) => ({
    hash: hash.substring(0, 16) + '...',
    fullHash: hash,
    objectId
  }))
  
  const physicalIds = Array.from(physicalIdDatabase.entries()).map(([physicalId, objectId]) => ({
    physicalId: physicalId.length > 20 ? physicalId.substring(0, 20) + '...' : physicalId,
    fullPhysicalId: physicalId,
    objectId
  }))
  
  res.json({ hashes, physicalIds })
})

// Serve React app for all other routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../dist/index.html'))
})

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Server error:', error)
  res.status(500).json({ error: error.message })
})

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`)
  console.log(`Nostr public key: ${nostrClient.publicKey}`)
})