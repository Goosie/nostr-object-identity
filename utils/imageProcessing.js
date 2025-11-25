import sharp from 'sharp'
import Jimp from 'jimp'
import { imageHash } from 'image-hash'
import { promisify } from 'util'

const imageHashAsync = promisify(imageHash)

export class ImageProcessor {
  constructor() {
    this.hashCache = new Map()
  }

  // Generate perceptual hash using image-hash library
  async generatePHash(imagePath) {
    try {
      const hash = await imageHashAsync(imagePath, 16, 'hex')
      return hash
    } catch (error) {
      console.error('Error generating pHash:', error)
      throw error
    }
  }

  // Generate multiple perceptual hashes for robust matching
  async generateRobustPHashFromBuffer(imageBuffer) {
    try {
      const hashes = []
      const tempBasePath = `/tmp/temp_${Date.now()}`
      
      // Normalize image first - remove EXIF orientation and standardize
      const normalizedBuffer = await sharp(imageBuffer)
        .rotate() // Auto-rotate based on EXIF
        .resize(512, 512, { 
          fit: 'inside',
          withoutEnlargement: false,
          background: { r: 255, g: 255, b: 255, alpha: 1 }
        })
        .jpeg({ quality: 90 })
        .toBuffer()
      
      // Generate hash for original normalized image
      const originalPath = `${tempBasePath}_original.jpg`
      await sharp(normalizedBuffer).toFile(originalPath)
      const originalHash = await this.generatePHash(originalPath)
      hashes.push({ type: 'original', hash: originalHash })
      
      // Generate hash for strategic rotations to handle orientation issues
      // Use fewer angles but cover common scenarios: phone orientations, slight tilts, and 90-degree rotations
      for (let rotation of [15, 30, 45, 90, 135, 180, 225, 270, 315, 345]) {
        const rotatedPath = `${tempBasePath}_rot${rotation}.jpg`
        await sharp(normalizedBuffer)
          .rotate(rotation, { background: { r: 255, g: 255, b: 255, alpha: 1 } })
          .toFile(rotatedPath)
        const rotatedHash = await this.generatePHash(rotatedPath)
        hashes.push({ type: `rotated_${rotation}`, hash: rotatedHash })
      }
      
      // Generate hash for slightly scaled versions to handle zoom differences
      for (let scale of [0.9, 1.1]) {
        const scaledPath = `${tempBasePath}_scale${scale}.jpg`
        await sharp(normalizedBuffer)
          .resize(Math.round(512 * scale), Math.round(512 * scale), { 
            fit: 'inside',
            background: { r: 255, g: 255, b: 255, alpha: 1 }
          })
          .toFile(scaledPath)
        const scaledHash = await this.generatePHash(scaledPath)
        hashes.push({ type: `scaled_${scale}`, hash: scaledHash })
      }
      
      // Clean up temp files
      const fs = await import('fs')
      const filesToClean = [originalPath]
      
      // Add all rotation files
      for (let rotation of [15, 30, 45, 90, 135, 180, 225, 270, 315, 345]) {
        filesToClean.push(`${tempBasePath}_rot${rotation}.jpg`)
      }
      
      // Add scale files
      for (let scale of [0.9, 1.1]) {
        filesToClean.push(`${tempBasePath}_scale${scale}.jpg`)
      }
      
      for (let filePath of filesToClean) {
        try { fs.unlinkSync(filePath) } catch (e) {}
      }
      
      // Return the original hash as primary, but store all variants
      const primaryHash = originalHash
      
      // If primary hash is all zeros, generate fallback
      if (primaryHash === '0000000000000000000000000000000000000000000000000000000000000000') {
        console.log('Simple image detected, generating fallback hash')
        const metadata = await sharp(normalizedBuffer).metadata()
        const stats = await sharp(normalizedBuffer).stats()
        
        const fallbackData = `${metadata.width}x${metadata.height}_${metadata.format}_${JSON.stringify(stats.channels)}`
        const crypto = await import('crypto')
        const fallbackHash = crypto.createHash('sha256').update(fallbackData).digest('hex').substring(0, 64)
        console.log('Generated fallback hash:', fallbackHash)
        return { primary: fallbackHash, variants: hashes }
      }
      
      return { primary: primaryHash, variants: hashes }
    } catch (error) {
      console.error('Error generating robust pHash from buffer:', error)
      throw error
    }
  }

  // Generate perceptual hash from buffer (legacy method for compatibility)
  async generatePHashFromBuffer(imageBuffer) {
    const result = await this.generateRobustPHashFromBuffer(imageBuffer)
    return result.primary
  }

  // Calculate Hamming distance between two hex hashes
  hammingDistance(hash1, hash2) {
    if (hash1.length !== hash2.length) {
      throw new Error('Hash lengths must be equal')
    }

    let distance = 0
    
    // Convert hex to binary and compare bit by bit
    for (let i = 0; i < hash1.length; i++) {
      const hex1 = parseInt(hash1[i], 16)
      const hex2 = parseInt(hash2[i], 16)
      
      // XOR the hex digits and count set bits
      const xor = hex1 ^ hex2
      distance += this.countSetBits(xor)
    }
    
    return distance
  }
  
  // Count number of set bits in a number
  countSetBits(n) {
    let count = 0
    while (n) {
      count += n & 1
      n >>= 1
    }
    return count
  }

  // Check if two images are similar based on pHash
  areSimilar(hash1, hash2, threshold = 15) {
    const distance = this.hammingDistance(hash1, hash2)
    return distance <= threshold
  }

  // Robust similarity check that handles rotations and scaling
  async findBestMatch(newImageBuffer, hashToObjectMap, threshold = 12) {
    try {
      const newHashData = await this.generateRobustPHashFromBuffer(newImageBuffer)
      const newHashes = [newHashData.primary, ...newHashData.variants.map(v => v.hash)]
      
      let bestMatch = null
      let bestDistance = Infinity
      
      for (const [existingHash, objectId] of hashToObjectMap.entries()) {
        // First try direct comparison with primary hash (most strict)
        const primaryDistance = this.hammingDistance(newHashData.primary, existingHash)
        console.log(`Primary comparison ${newHashData.primary.substring(0, 16)}... with ${existingHash.substring(0, 16)}..., distance: ${primaryDistance}`)
        
        if (primaryDistance <= threshold && primaryDistance < bestDistance) {
          bestDistance = primaryDistance
          bestMatch = { objectId, distance: primaryDistance, hash: existingHash }
        }
        
        // Only try variants if primary didn't match and we're in creation mode (threshold <= 3)
        if (primaryDistance > threshold && threshold <= 3) {
          for (const newHash of newHashes.slice(1)) { // Skip primary, already tested
            try {
              const distance = this.hammingDistance(newHash, existingHash)
              console.log(`Variant comparison ${newHash.substring(0, 16)}... with ${existingHash.substring(0, 16)}..., distance: ${distance}`)
              
              if (distance < bestDistance && distance <= threshold) {
                bestDistance = distance
                bestMatch = { objectId, distance, hash: existingHash }
              }
            } catch (e) {
              console.log(`Hash comparison failed: ${e.message}`)
            }
          }
        }
      }
      
      return bestMatch
    } catch (error) {
      console.error('Error in robust matching:', error)
      return null
    }
  }

  // Process and optimize image for storage
  async processImage(imageBuffer, options = {}) {
    const {
      width = 800,
      height = 600,
      quality = 80,
      format = 'jpeg'
    } = options

    try {
      const processedBuffer = await sharp(imageBuffer)
        .resize(width, height, { 
          fit: 'inside',
          withoutEnlargement: true 
        })
        .jpeg({ quality })
        .toBuffer()

      return processedBuffer
    } catch (error) {
      console.error('Error processing image:', error)
      throw error
    }
  }

  // Generate thumbnail
  async generateThumbnail(imageBuffer, size = 200) {
    try {
      const thumbnail = await sharp(imageBuffer)
        .resize(size, size, { 
          fit: 'cover',
          position: 'center'
        })
        .jpeg({ quality: 70 })
        .toBuffer()

      return thumbnail
    } catch (error) {
      console.error('Error generating thumbnail:', error)
      throw error
    }
  }

  // Extract image metadata
  async extractMetadata(imageBuffer) {
    try {
      const metadata = await sharp(imageBuffer).metadata()
      return {
        width: metadata.width,
        height: metadata.height,
        format: metadata.format,
        size: metadata.size,
        density: metadata.density,
        hasAlpha: metadata.hasAlpha,
        orientation: metadata.orientation
      }
    } catch (error) {
      console.error('Error extracting metadata:', error)
      throw error
    }
  }

  // Advanced pHash comparison with multiple algorithms
  async compareImages(imageBuffer1, imageBuffer2) {
    try {
      const hash1 = await this.generatePHashFromBuffer(imageBuffer1)
      const hash2 = await this.generatePHashFromBuffer(imageBuffer2)
      
      const hammingDistance = this.hammingDistance(hash1, hash2)
      const similarity = 1 - (hammingDistance / (hash1.length * 4)) // Normalize to 0-1
      
      return {
        hash1,
        hash2,
        hammingDistance,
        similarity,
        areSimilar: this.areSimilar(hash1, hash2)
      }
    } catch (error) {
      console.error('Error comparing images:', error)
      throw error
    }
  }

  // Batch process multiple images
  async batchProcess(imageBuffers, options = {}) {
    const results = []
    
    for (let i = 0; i < imageBuffers.length; i++) {
      try {
        const processed = await this.processImage(imageBuffers[i], options)
        const pHash = await this.generatePHashFromBuffer(processed)
        const metadata = await this.extractMetadata(imageBuffers[i])
        
        results.push({
          index: i,
          processed,
          pHash,
          metadata,
          success: true
        })
      } catch (error) {
        results.push({
          index: i,
          error: error.message,
          success: false
        })
      }
    }
    
    return results
  }

  // Find similar images in a collection
  async findSimilarImages(targetHash, imageHashes, threshold = 5) {
    const similar = []
    
    for (const [id, hash] of imageHashes.entries()) {
      if (this.areSimilar(targetHash, hash, threshold)) {
        similar.push({
          id,
          hash,
          distance: this.hammingDistance(targetHash, hash)
        })
      }
    }
    
    return similar.sort((a, b) => a.distance - b.distance)
  }

  // Cache hash for performance
  cacheHash(id, hash) {
    this.hashCache.set(id, hash)
  }

  // Get cached hash
  getCachedHash(id) {
    return this.hashCache.get(id)
  }

  // Clear cache
  clearCache() {
    this.hashCache.clear()
  }
}

// Utility functions
export function hexToBinary(hex) {
  return hex.split('').map(char => 
    parseInt(char, 16).toString(2).padStart(4, '0')
  ).join('')
}

export function binaryToHex(binary) {
  const chunks = binary.match(/.{4}/g) || []
  return chunks.map(chunk => parseInt(chunk, 2).toString(16)).join('')
}

// Export singleton instance
export const imageProcessor = new ImageProcessor()