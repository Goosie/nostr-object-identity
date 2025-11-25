import React, { useState, useRef } from 'react'

function VerifyObject() {
  const [selectedFile, setSelectedFile] = useState(null)
  const [preview, setPreview] = useState(null)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const [dragOver, setDragOver] = useState(false)
  const [showPayPerView, setShowPayPerView] = useState(false)
  const [verificationMethod, setVerificationMethod] = useState('image') // 'image' or 'physical'
  const [physicalId, setPhysicalId] = useState('')
  
  const fileInputRef = useRef(null)

  const handleFileSelect = (file) => {
    if (file && file.type.startsWith('image/')) {
      setSelectedFile(file)
      
      const reader = new FileReader()
      reader.onload = (e) => {
        setPreview(e.target.result)
      }
      reader.readAsDataURL(file)
      setError(null)
      setResult(null)
    } else {
      setError('Please select a valid image file (JPEG, PNG, or WebP)')
    }
  }

  const handleFileChange = (e) => {
    const file = e.target.files[0]
    if (file) {
      handleFileSelect(file)
    }
  }

  const handleDragOver = (e) => {
    e.preventDefault()
    setDragOver(true)
  }

  const handleDragLeave = (e) => {
    e.preventDefault()
    setDragOver(false)
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setDragOver(false)
    
    const file = e.dataTransfer.files[0]
    if (file) {
      handleFileSelect(file)
    }
  }

  const handleVerify = async () => {
    if (verificationMethod === 'image' && !selectedFile) {
      setError('Please select an image file')
      return
    }
    
    if (verificationMethod === 'physical' && !physicalId.trim()) {
      setError('Please enter a Physical ID')
      return
    }

    setLoading(true)
    setError(null)
    setResult(null)

    try {
      let response, data

      if (verificationMethod === 'physical') {
        // Physical ID verification
        response = await fetch('/api/verify-physical', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ physicalId: physicalId.trim() })
        })
        data = await response.json()
      } else {
        // Image verification
        const formData = new FormData()
        formData.append('image', selectedFile)

        response = await fetch('/api/verify', {
          method: 'POST',
          body: formData
        })
        data = await response.json()
      }

      if (!response.ok) {
        throw new Error(data.error || 'Failed to verify object')
      }

      setResult(data)
      
      if (data.verified) {
        setShowPayPerView(true)
      }

    } catch (error) {
      console.error('Error verifying object:', error)
      setError(error.message)
    } finally {
      setLoading(false)
    }
  }

  const handleZap = async (amount) => {
    if (!result?.object?.id) return

    try {
      const response = await fetch(`/api/objects/${result.object.id}/zap`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          amount,
          comment: 'Pay-per-view payment'
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to send zap')
      }

      setShowPayPerView(false)
      // Refresh result to show updated balance
      setResult(prev => ({
        ...prev,
        object: {
          ...prev.object,
          satsBalance: data.newBalance
        }
      }))

    } catch (error) {
      console.error('Error sending zap:', error)
      setError(error.message)
    }
  }

  return (
    <div>
      <h2>Verify Object</h2>
      <p style={{ marginBottom: '30px', color: '#666' }}>
        Verify an object's identity using a photo or its Physical ID
      </p>

      {error && (
        <div className="alert alert-error">
          {error}
        </div>
      )}

      {/* Verification Method Selector */}
      <div className="form-group" style={{ marginBottom: '30px' }}>
        <label>Verification Method</label>
        <div style={{ display: 'flex', gap: '20px', marginTop: '10px' }}>
          <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
            <input
              type="radio"
              value="image"
              checked={verificationMethod === 'image'}
              onChange={(e) => setVerificationMethod(e.target.value)}
              style={{ marginRight: '8px' }}
            />
            📷 Photo Verification
          </label>
          <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
            <input
              type="radio"
              value="physical"
              checked={verificationMethod === 'physical'}
              onChange={(e) => setVerificationMethod(e.target.value)}
              style={{ marginRight: '8px' }}
            />
            🏷️ Physical ID
          </label>
        </div>
      </div>

      {/* Physical ID Input */}
      {verificationMethod === 'physical' && (
        <div className="form-group" style={{ marginBottom: '30px' }}>
          <label>Physical ID</label>
          <input
            type="text"
            value={physicalId}
            onChange={(e) => setPhysicalId(e.target.value)}
            placeholder="Enter Physical ID (e.g., mieobby2-7571755 or 66542179)"
            style={{
              width: '100%',
              padding: '12px',
              border: '2px solid #ddd',
              borderRadius: '8px',
              fontSize: '16px',
              fontFamily: 'monospace'
            }}
          />
          <p style={{ fontSize: '0.9rem', color: '#666', marginTop: '8px' }}>
            💡 Find the Physical ID on the object's certificate sticker or QR code
          </p>
        </div>
      )}

      {/* Image Upload (only show for image verification) */}
      {verificationMethod === 'image' && (
        <div className="form-group">
        <label>Object Image</label>
        <div 
          className={`file-upload ${dragOver ? 'dragover' : ''}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          {preview ? (
            <div>
              <img 
                src={preview} 
                alt="Preview" 
                style={{ maxWidth: '200px', maxHeight: '200px', borderRadius: '8px' }}
              />
              <p style={{ marginTop: '10px' }}>Click to change image</p>
            </div>
          ) : (
            <div>
              <div style={{ fontSize: '3rem', marginBottom: '10px' }}>🔍</div>
              <p>Drag and drop an image here, or click to select</p>
              <p style={{ fontSize: '0.9rem', color: '#666' }}>Supports JPEG, PNG, and WebP</p>
            </div>
          )}
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          style={{ display: 'none' }}
        />
        </div>
      )}

      <button 
        onClick={handleVerify}
        className="btn btn-primary"
        disabled={loading || (verificationMethod === 'image' && !selectedFile) || (verificationMethod === 'physical' && !physicalId.trim())}
        style={{ marginBottom: '30px' }}
      >
        {loading ? (
          <div className="loading">
            <div className="spinner"></div>
            Verifying...
          </div>
        ) : (
          <>
            {verificationMethod === 'physical' ? '🏷️ Verify by Physical ID' : '🔍 Verify by Photo'}
          </>
        )}
      </button>

      {result && (
        <div className={`verification-result ${result.verified ? 'verification-success' : 'verification-failed'}`}>
          {result.verified ? (
            <div>
              <h3>✅ Object Verified!</h3>
              <div style={{ marginTop: '20px' }}>
                <div className="grid">
                  <div>
                    <img 
                      src={result.object.imagePath ? `/api/images/${result.object.id}.jpg` : '/placeholder.jpg'}
                      alt={result.object.name}
                      className="object-image"
                    />
                  </div>
                  <div>
                    <h4>{result.object.name}</h4>
                    <p><strong>Artist:</strong> {result.object.artist}</p>
                    <p><strong>Type:</strong> {result.object.type}</p>
                    <p><strong>Created:</strong> {new Date(result.object.createdAt).toLocaleDateString()}</p>
                    <p><strong>Similarity:</strong> {(result.similarity * 100).toFixed(1)}%</p>
                    
                    <div className="stats">
                      <div className="stat">
                        <div className="stat-value">{result.object.satsBalance}</div>
                        <div className="stat-label">Sats Balance</div>
                      </div>
                      <div className="stat">
                        <div className="stat-value">{result.object.views}</div>
                        <div className="stat-label">Views</div>
                      </div>
                    </div>
                  </div>
                </div>

                {result.object.description && (
                  <div style={{ marginTop: '20px' }}>
                    <h5>Description:</h5>
                    <p>{result.object.description}</p>
                  </div>
                )}

                <div style={{ marginTop: '20px' }}>
                  <p><strong>Nostr Address:</strong> <code>{result.object.naddr}</code></p>
                </div>
              </div>
            </div>
          ) : (
            <div>
              <h3>❌ Object Not Found</h3>
              <p>No matching object found in the database. This object may not have been registered yet.</p>
            </div>
          )}
        </div>
      )}

      {showPayPerView && result?.verified && (
        <div className="card" style={{ marginTop: '20px', border: '2px solid #667eea' }}>
          <h4>💰 Pay-per-View</h4>
          <p>To see more details about this object and support the artist, please pay a small amount:</p>
          
          <div style={{ display: 'flex', gap: '10px', marginTop: '15px', flexWrap: 'wrap' }}>
            <button 
              className="btn btn-secondary"
              onClick={() => handleZap(10)}
            >
              ⚡ 10 sats
            </button>
            <button 
              className="btn btn-secondary"
              onClick={() => handleZap(50)}
            >
              ⚡ 50 sats
            </button>
            <button 
              className="btn btn-secondary"
              onClick={() => handleZap(100)}
            >
              ⚡ 100 sats
            </button>
            <button 
              className="btn btn-secondary"
              onClick={() => handleZap(500)}
            >
              ⚡ 500 sats
            </button>
          </div>
          
          <p style={{ fontSize: '0.9rem', color: '#666', marginTop: '10px' }}>
            50% goes to the artist, 50% stays with the object for future community decisions
          </p>
          
          <button 
            className="btn btn-secondary"
            onClick={() => setShowPayPerView(false)}
            style={{ marginTop: '10px' }}
          >
            Skip for now
          </button>
        </div>
      )}
    </div>
  )
}

export default VerifyObject