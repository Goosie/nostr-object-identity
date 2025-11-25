import crypto from 'crypto'
import QRCode from 'qrcode'
import sharp from 'sharp'

export class PhysicalIdentifier {
  constructor() {
    this.identifierCache = new Map()
  }

  // Generate a unique physical identifier for an object
  generatePhysicalId(objectData) {
    const timestamp = Date.now()
    const randomBytes = crypto.randomBytes(16).toString('hex')
    const objectHash = crypto.createHash('sha256')
      .update(JSON.stringify({
        name: objectData.name,
        artist: objectData.artist,
        type: objectData.type,
        timestamp
      }))
      .digest('hex')
      .substring(0, 16)
    
    // Create a unique physical ID: timestamp + random + object hash
    const physicalId = `${timestamp.toString(36)}-${randomBytes.substring(0, 8)}-${objectHash.substring(0, 8)}`
    
    return {
      physicalId,
      timestamp,
      shortId: physicalId.substring(0, 16), // Shorter version for printing
      numericId: parseInt(objectHash.substring(0, 8), 16).toString().substring(0, 8) // Pure numeric version
    }
  }

  // Generate QR code containing the physical ID
  async generatePhysicalQR(physicalId, objectId) {
    try {
      const qrData = {
        type: 'nostr_object_verification',
        physicalId,
        objectId,
        verifyUrl: `${process.env.BASE_URL || 'http://localhost:12001'}/api/verify-physical/${physicalId}`,
        timestamp: Date.now()
      }

      const qrCodeDataURL = await QRCode.toDataURL(JSON.stringify(qrData), {
        errorCorrectionLevel: 'H', // High error correction for damaged stickers
        type: 'image/png',
        quality: 0.92,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        },
        width: 200
      })

      return {
        qrCodeDataURL,
        qrData,
        printableText: `ID: ${physicalId}\nVerify: /verify-physical/${physicalId}`
      }
    } catch (error) {
      console.error('Error generating physical QR code:', error)
      throw error
    }
  }

  // Generate a physical certificate/sticker image
  async generatePhysicalCertificate(objectData, physicalId, qrCodeDataURL) {
    try {
      // Create certificate background
      const width = 400
      const height = 300
      
      // Convert QR code data URL to buffer
      const qrBuffer = Buffer.from(qrCodeDataURL.split(',')[1], 'base64')
      
      const certificateBuffer = await sharp({
        create: {
          width,
          height,
          channels: 3,
          background: { r: 255, g: 255, b: 255 }
        }
      })
      .composite([
        {
          input: qrBuffer,
          top: 20,
          left: 20,
          blend: 'over'
        },
        {
          input: Buffer.from(`
            <svg width="180" height="260">
              <rect width="180" height="260" fill="white" stroke="black" stroke-width="2"/>
              <text x="10" y="30" font-family="Arial" font-size="14" font-weight="bold">NOSTR OBJECT ID</text>
              <text x="10" y="50" font-family="Arial" font-size="10">Name: ${objectData.name}</text>
              <text x="10" y="70" font-family="Arial" font-size="10">Artist: ${objectData.artist}</text>
              <text x="10" y="90" font-family="Arial" font-size="10">Type: ${objectData.type}</text>
              <text x="10" y="120" font-family="Arial" font-size="8" font-weight="bold">Physical ID:</text>
              <text x="10" y="135" font-family="monospace" font-size="7">${physicalId}</text>
              <text x="10" y="160" font-family="Arial" font-size="8">Scan QR or visit:</text>
              <text x="10" y="175" font-family="monospace" font-size="6">/verify-physical/${physicalId.substring(0, 20)}</text>
              <text x="10" y="200" font-family="Arial" font-size="8">This certificate proves</text>
              <text x="10" y="215" font-family="Arial" font-size="8">object authenticity</text>
              <text x="10" y="240" font-family="Arial" font-size="6">Created: ${new Date().toISOString().split('T')[0]}</text>
            </svg>
          `),
          top: 20,
          left: 220,
          blend: 'over'
        }
      ])
      .png()
      .toBuffer()

      return certificateBuffer
    } catch (error) {
      console.error('Error generating physical certificate:', error)
      throw error
    }
  }

  // Verify a physical ID
  verifyPhysicalId(physicalId, storedPhysicalId) {
    return physicalId === storedPhysicalId
  }

  // Generate multiple verification methods
  async generateVerificationMethods(objectData, objectId) {
    try {
      const physicalIdentifier = this.generatePhysicalId(objectData)
      const qrCode = await this.generatePhysicalQR(physicalIdentifier.physicalId, objectId)
      const certificate = await this.generatePhysicalCertificate(objectData, physicalIdentifier.physicalId, qrCode.qrCodeDataURL)

      return {
        physicalId: physicalIdentifier.physicalId,
        shortId: physicalIdentifier.shortId,
        numericId: physicalIdentifier.numericId,
        qrCode: qrCode.qrCodeDataURL,
        qrData: qrCode.qrData,
        printableText: qrCode.printableText,
        certificate,
        verificationMethods: {
          qr_scan: `Scan QR code with any QR reader`,
          manual_entry: `Enter ID: ${physicalIdentifier.shortId}`,
          numeric_entry: `Enter numeric ID: ${physicalIdentifier.numericId}`,
          url_visit: `Visit: /verify-physical/${physicalIdentifier.physicalId}`
        }
      }
    } catch (error) {
      console.error('Error generating verification methods:', error)
      throw error
    }
  }

  // Extract physical ID from QR code scan
  parseQRScan(qrScanResult) {
    try {
      const qrData = JSON.parse(qrScanResult)
      if (qrData.type === 'nostr_object_verification' && qrData.physicalId) {
        return {
          valid: true,
          physicalId: qrData.physicalId,
          objectId: qrData.objectId,
          timestamp: qrData.timestamp
        }
      }
      return { valid: false, error: 'Invalid QR code format' }
    } catch (error) {
      // Try as plain text physical ID
      if (typeof qrScanResult === 'string' && qrScanResult.length > 10) {
        return {
          valid: true,
          physicalId: qrScanResult,
          objectId: null,
          timestamp: null
        }
      }
      return { valid: false, error: 'Could not parse QR code' }
    }
  }
}