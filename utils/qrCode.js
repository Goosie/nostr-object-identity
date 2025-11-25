import QRCode from 'qrcode'
import { createHash } from 'crypto'

export class QRCodeGenerator {
  constructor() {
    this.defaultOptions = {
      errorCorrectionLevel: 'M',
      type: 'image/png',
      quality: 0.92,
      margin: 1,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      },
      width: 256
    }
  }

  // Generate QR code for object certificate
  async generateObjectCertificate(objectData, options = {}) {
    const {
      id,
      name,
      artist,
      naddr,
      hash,
      timestamp = Date.now()
    } = objectData

    // Create certificate data
    const certificateData = {
      id,
      name,
      artist,
      naddr,
      hash,
      timestamp,
      type: 'object-certificate',
      version: '1.0'
    }

    const dataString = JSON.stringify(certificateData)
    const qrOptions = { ...this.defaultOptions, ...options }

    try {
      const qrCodeBuffer = await QRCode.toBuffer(dataString, qrOptions)
      return {
        qrCode: qrCodeBuffer,
        data: certificateData,
        dataString
      }
    } catch (error) {
      console.error('Error generating QR code:', error)
      throw error
    }
  }

  // Generate QR code for payment/zap
  async generatePaymentQR(paymentData, options = {}) {
    const {
      objectId,
      amount,
      recipient,
      lightning_address,
      description = ''
    } = paymentData

    const paymentInfo = {
      objectId,
      amount,
      recipient,
      lightning_address,
      description,
      type: 'payment',
      timestamp: Date.now()
    }

    const dataString = JSON.stringify(paymentInfo)
    const qrOptions = { ...this.defaultOptions, ...options }

    try {
      const qrCodeBuffer = await QRCode.toBuffer(dataString, qrOptions)
      return {
        qrCode: qrCodeBuffer,
        data: paymentInfo,
        dataString
      }
    } catch (error) {
      console.error('Error generating payment QR code:', error)
      throw error
    }
  }

  // Generate QR code for object verification
  async generateVerificationQR(objectId, pHash, options = {}) {
    const verificationData = {
      objectId,
      pHash,
      type: 'verification',
      timestamp: Date.now()
    }

    const dataString = JSON.stringify(verificationData)
    const qrOptions = { ...this.defaultOptions, ...options }

    try {
      const qrCodeBuffer = await QRCode.toBuffer(dataString, qrOptions)
      return {
        qrCode: qrCodeBuffer,
        data: verificationData,
        dataString
      }
    } catch (error) {
      console.error('Error generating verification QR code:', error)
      throw error
    }
  }

  // Generate simple text QR code
  async generateTextQR(text, options = {}) {
    const qrOptions = { ...this.defaultOptions, ...options }

    try {
      const qrCodeBuffer = await QRCode.toBuffer(text, qrOptions)
      return qrCodeBuffer
    } catch (error) {
      console.error('Error generating text QR code:', error)
      throw error
    }
  }

  // Generate QR code as SVG
  async generateSVG(data, options = {}) {
    const qrOptions = { ...this.defaultOptions, ...options, type: 'svg' }

    try {
      const svgString = await QRCode.toString(data, qrOptions)
      return svgString
    } catch (error) {
      console.error('Error generating SVG QR code:', error)
      throw error
    }
  }

  // Generate QR code as data URL
  async generateDataURL(data, options = {}) {
    const qrOptions = { ...this.defaultOptions, ...options }

    try {
      const dataURL = await QRCode.toDataURL(data, qrOptions)
      return dataURL
    } catch (error) {
      console.error('Error generating data URL QR code:', error)
      throw error
    }
  }

  // Validate QR code data
  validateCertificateData(dataString) {
    try {
      const data = JSON.parse(dataString)
      
      const requiredFields = ['id', 'name', 'artist', 'naddr', 'hash', 'timestamp', 'type']
      const hasAllFields = requiredFields.every(field => data.hasOwnProperty(field))
      
      if (!hasAllFields) {
        return { valid: false, error: 'Missing required fields' }
      }

      if (data.type !== 'object-certificate') {
        return { valid: false, error: 'Invalid certificate type' }
      }

      return { valid: true, data }
    } catch (error) {
      return { valid: false, error: 'Invalid JSON data' }
    }
  }

  // Generate secure hash for QR code verification
  generateSecureHash(data) {
    const dataString = typeof data === 'string' ? data : JSON.stringify(data)
    return createHash('sha256').update(dataString).digest('hex')
  }

  // Create tamper-proof certificate
  async generateSecureCertificate(objectData, secretKey, options = {}) {
    const certificateData = {
      ...objectData,
      timestamp: Date.now(),
      type: 'secure-certificate',
      version: '1.0'
    }

    // Add signature
    const dataString = JSON.stringify(certificateData)
    const signature = createHash('sha256')
      .update(dataString + secretKey)
      .digest('hex')

    const secureData = {
      ...certificateData,
      signature
    }

    const qrOptions = { ...this.defaultOptions, ...options }

    try {
      const qrCodeBuffer = await QRCode.toBuffer(JSON.stringify(secureData), qrOptions)
      return {
        qrCode: qrCodeBuffer,
        data: secureData,
        signature
      }
    } catch (error) {
      console.error('Error generating secure certificate:', error)
      throw error
    }
  }

  // Verify secure certificate
  verifyCertificate(certificateData, secretKey) {
    try {
      const { signature, ...dataWithoutSignature } = certificateData
      const dataString = JSON.stringify(dataWithoutSignature)
      const expectedSignature = createHash('sha256')
        .update(dataString + secretKey)
        .digest('hex')

      return signature === expectedSignature
    } catch (error) {
      console.error('Error verifying certificate:', error)
      return false
    }
  }
}

// Export singleton instance
export const qrGenerator = new QRCodeGenerator()