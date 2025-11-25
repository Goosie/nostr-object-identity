import sharp from 'sharp'
import { imageHash } from 'image-hash'
import { promisify } from 'util'
import crypto from 'crypto'

const imageHashAsync = promisify(imageHash)

export class AdvancedImageMatcher {
  constructor() {
    this.hashCache = new Map()
  }

  // Calculate Hamming distance between two hex hashes
  hammingDistance(hash1, hash2) {
    if (hash1.length !== hash2.length) return Infinity
    
    let distance = 0
    for (let i = 0; i < hash1.length; i++) {
      const xor = parseInt(hash1[i], 16) ^ parseInt(hash2[i], 16)
      distance += xor.toString(2).split('1').length - 1
    }
    return distance
  }

  // Generate color histogram for additional matching
  async generateColorHistogram(imageBuffer) {
    try {
      const { data, info } = await sharp(imageBuffer)
        .resize(64, 64)
        .raw()
        .toBuffer({ resolveWithObject: true })
      
      const histogram = { r: new Array(16).fill(0), g: new Array(16).fill(0), b: new Array(16).fill(0) }
      
      for (let i = 0; i < data.length; i += 3) {
        const r = Math.floor(data[i] / 16)
        const g = Math.floor(data[i + 1] / 16)
        const b = Math.floor(data[i + 2] / 16)
        
        histogram.r[r]++
        histogram.g[g]++
        histogram.b[b]++
      }
      
      return histogram
    } catch (error) {
      console.error('Error generating color histogram:', error)
      return null
    }
  }

  // Compare color histograms
  compareColorHistograms(hist1, hist2) {
    if (!hist1 || !hist2) return 1.0
    
    let totalDiff = 0
    let totalPixels = 0
    
    for (let channel of ['r', 'g', 'b']) {
      for (let i = 0; i < 16; i++) {
        totalDiff += Math.abs(hist1[channel][i] - hist2[channel][i])
        totalPixels += hist1[channel][i] + hist2[channel][i]
      }
    }
    
    return totalPixels > 0 ? totalDiff / totalPixels : 1.0
  }

  // Generate edge pattern hash
  async generateEdgeHash(imageBuffer) {
    try {
      const edgeBuffer = await sharp(imageBuffer)
        .resize(32, 32)
        .greyscale()
        .convolve({
          width: 3,
          height: 3,
          kernel: [-1, -1, -1, -1, 8, -1, -1, -1, -1]
        })
        .raw()
        .toBuffer()
      
      let hash = ''
      const threshold = 128
      
      for (let i = 0; i < edgeBuffer.length; i++) {
        hash += edgeBuffer[i] > threshold ? '1' : '0'
      }
      
      return hash
    } catch (error) {
      console.error('Error generating edge hash:', error)
      return null
    }
  }

  // Compare edge hashes
  compareEdgeHashes(edge1, edge2) {
    if (!edge1 || !edge2 || edge1.length !== edge2.length) return 1.0
    
    let differences = 0
    for (let i = 0; i < edge1.length; i++) {
      if (edge1[i] !== edge2[i]) differences++
    }
    
    return differences / edge1.length
  }

  // Multi-stage verification system
  async verifyImageMatch(imageBuffer, storedHashes) {
    console.log('Advanced verification - Starting multi-stage matching...')
    
    const results = {
      stage1_phash: { matched: false, distance: Infinity, confidence: 0 },
      stage2_rotation: { matched: false, distance: Infinity, confidence: 0 },
      stage3_color: { matched: false, similarity: 1.0, confidence: 0 },
      stage4_edge: { matched: false, similarity: 1.0, confidence: 0 },
      overall: { matched: false, confidence: 0, method: 'none' }
    }

    try {
      // Normalize the input image
      const normalizedBuffer = await sharp(imageBuffer)
        .rotate() // Auto-rotate based on EXIF
        .resize(512, 512, { 
          fit: 'inside',
          withoutEnlargement: false,
          background: { r: 255, g: 255, b: 255, alpha: 1 }
        })
        .jpeg({ quality: 90 })
        .toBuffer()

      // Generate primary hash for input image
      const tempPath = `/tmp/verify_${Date.now()}.jpg`
      await sharp(normalizedBuffer).toFile(tempPath)
      const inputHash = await imageHashAsync(tempPath, 16, 'hex')

      // STAGE 1: Direct pHash comparison (strictest)
      console.log('Stage 1: Direct pHash comparison')
      for (const storedHash of storedHashes) {
        const distance = this.hammingDistance(inputHash, storedHash)
        console.log(`  Direct comparison: ${inputHash.substring(0, 16)}... vs ${storedHash.substring(0, 16)}..., distance: ${distance}`)
        
        if (distance <= 3) { // Very strict for exact matches
          results.stage1_phash = { matched: true, distance, confidence: 0.95 }
          results.overall = { matched: true, confidence: 0.95, method: 'direct_phash' }
          console.log('  ✓ Stage 1 MATCH: Direct pHash')
          return results
        }
        
        results.stage1_phash.distance = Math.min(results.stage1_phash.distance, distance)
      }

      // STAGE 2: Rotation-tolerant pHash comparison
      console.log('Stage 2: Rotation-tolerant comparison')
      const rotationAngles = [5, 10, 15, 30, 45, 90, 180, 270, 345, 350, 355]
      
      for (const angle of rotationAngles) {
        const rotatedBuffer = await sharp(normalizedBuffer)
          .rotate(angle, { background: { r: 255, g: 255, b: 255, alpha: 1 } })
          .toBuffer()
        
        const rotatedPath = `/tmp/verify_rot${angle}_${Date.now()}.jpg`
        await sharp(rotatedBuffer).toFile(rotatedPath)
        const rotatedHash = await imageHashAsync(rotatedPath, 16, 'hex')
        
        for (const storedHash of storedHashes) {
          const distance = this.hammingDistance(rotatedHash, storedHash)
          
          if (distance <= 8) { // More lenient for rotated images
            results.stage2_rotation = { matched: true, distance, confidence: 0.85 }
            results.overall = { matched: true, confidence: 0.85, method: 'rotation_phash' }
            console.log(`  ✓ Stage 2 MATCH: Rotation ${angle}°, distance: ${distance}`)
            return results
          }
          
          results.stage2_rotation.distance = Math.min(results.stage2_rotation.distance, distance)
        }
      }

      // STAGE 3: Color histogram comparison
      console.log('Stage 3: Color histogram comparison')
      const inputHistogram = await this.generateColorHistogram(normalizedBuffer)
      
      // We need to store color histograms for comparison - for now, skip this stage
      console.log('  Stage 3 skipped: No stored color histograms available')

      // STAGE 4: Edge pattern comparison
      console.log('Stage 4: Edge pattern comparison')
      const inputEdgeHash = await this.generateEdgeHash(normalizedBuffer)
      
      // We need to store edge hashes for comparison - for now, skip this stage
      console.log('  Stage 4 skipped: No stored edge hashes available')

      // Clean up temp files
      try {
        const fs = await import('fs')
        await fs.promises.unlink(tempPath)
        for (const angle of rotationAngles) {
          try {
            await fs.promises.unlink(`/tmp/verify_rot${angle}_${Date.now()}.jpg`)
          } catch (e) {
            // File might not exist, ignore
          }
        }
      } catch (e) {
        // Ignore cleanup errors
      }

      console.log('Advanced verification - No matches found in any stage')
      return results

    } catch (error) {
      console.error('Error in advanced verification:', error)
      return results
    }
  }

  // Enhanced object creation with multiple hash types
  async createObjectHashes(imageBuffer) {
    try {
      const normalizedBuffer = await sharp(imageBuffer)
        .rotate() // Auto-rotate based on EXIF
        .resize(512, 512, { 
          fit: 'inside',
          withoutEnlargement: false,
          background: { r: 255, g: 255, b: 255, alpha: 1 }
        })
        .jpeg({ quality: 90 })
        .toBuffer()

      const tempPath = `/tmp/create_${Date.now()}.jpg`
      await sharp(normalizedBuffer).toFile(tempPath)
      
      const primaryHash = await imageHashAsync(tempPath, 16, 'hex')
      const colorHistogram = await this.generateColorHistogram(normalizedBuffer)
      const edgeHash = await this.generateEdgeHash(normalizedBuffer)

      // Clean up
      try {
        const fs = await import('fs')
        await fs.promises.unlink(tempPath)
      } catch (e) {
        // Ignore cleanup errors
      }

      return {
        primaryHash,
        colorHistogram,
        edgeHash,
        timestamp: Date.now()
      }
    } catch (error) {
      console.error('Error creating object hashes:', error)
      throw error
    }
  }
}