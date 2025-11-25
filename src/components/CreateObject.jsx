import React, { useState, useRef } from 'react'

function CreateObject({ onObjectCreated }) {
  const [formData, setFormData] = useState({
    name: '',
    artist: '',
    type: 'poster',
    description: '',
    customPhysicalId: ''
  })
  const [selectedFile, setSelectedFile] = useState(null)
  const [preview, setPreview] = useState(null)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const [dragOver, setDragOver] = useState(false)
  
  const fileInputRef = useRef(null)

  const handleInputChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const handleFileSelect = (file) => {
    if (file && file.type.startsWith('image/')) {
      setSelectedFile(file)
      
      const reader = new FileReader()
      reader.onload = (e) => {
        setPreview(e.target.result)
      }
      reader.readAsDataURL(file)
      setError(null)
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

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (!selectedFile) {
      setError('Please select an image file')
      return
    }

    if (!formData.name || !formData.artist) {
      setError('Name and artist are required')
      return
    }

    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const formDataToSend = new FormData()
      formDataToSend.append('image', selectedFile)
      formDataToSend.append('name', formData.name)
      formDataToSend.append('artist', formData.artist)
      formDataToSend.append('type', formData.type)
      formDataToSend.append('description', formData.description)
      if (formData.customPhysicalId.trim()) {
        formDataToSend.append('customPhysicalId', formData.customPhysicalId.trim())
      }

      const response = await fetch('/api/objects', {
        method: 'POST',
        body: formDataToSend
      })

      const data = await response.json()

      if (!response.ok) {
        if (response.status === 409) {
          setError(`Similar object already exists! Found ${data.similarObjects.length} similar object(s).`)
          setResult({ type: 'duplicate', data })
        } else {
          throw new Error(data.error || 'Failed to create object')
        }
        return
      }

      setResult({ type: 'success', data })
      onObjectCreated(data.object)
      
      // Reset form
      setFormData({
        name: '',
        artist: '',
        type: 'poster',
        description: ''
      })
      setSelectedFile(null)
      setPreview(null)

    } catch (error) {
      console.error('Error creating object:', error)
      setError(error.message)
    } finally {
      setLoading(false)
    }
  }

  const downloadCertificate = () => {
    if (result?.data?.certificate?.downloadUrl) {
      const link = document.createElement('a')
      link.href = result.data.certificate.downloadUrl
      link.download = `${result.data.object.name}_certificate.png`
      link.click()
    }
  }

  return (
    <div>
      <h2>Create Object Identity</h2>
      <p style={{ marginBottom: '30px', color: '#666' }}>
        Take a photo of your object to create a unique digital identity on Nostr
      </p>

      {error && (
        <div className="alert alert-error">
          {error}
        </div>
      )}

      {result?.type === 'duplicate' && (
        <div className="alert alert-warning">
          <h4>Duplicate Object Detected</h4>
          <p>A similar object already exists in the system:</p>
          {result.data.similarObjects.map((similar, index) => (
            <div key={index} style={{ marginTop: '10px', padding: '10px', background: 'rgba(0,0,0,0.1)', borderRadius: '4px' }}>
              <strong>Object ID:</strong> {similar.objectId}<br />
              <strong>Similarity Distance:</strong> {similar.distance}
            </div>
          ))}
        </div>
      )}

      {result?.type === 'success' && (
        <div className="alert alert-success">
          <h4>✅ Object Identity Created Successfully!</h4>
          <p><strong>Object ID:</strong> {result.data.object.id}</p>
          <p><strong>Nostr Address:</strong> {result.data.naddr}</p>
          
          {/* Physical Verification Information */}
          {result.data.physicalVerification && (
            <div style={{ marginTop: '20px', padding: '15px', backgroundColor: '#f8f9fa', borderRadius: '8px' }}>
              <h5>🏷️ Physical Verification IDs</h5>
              {result.data.physicalVerification.isCustomId && (
                <div style={{ marginBottom: '10px', padding: '8px', backgroundColor: '#d4edda', borderRadius: '4px', color: '#155724' }}>
                  ✅ <strong>Custom ID Used:</strong> Your provided identifier is now the primary physical ID!
                </div>
              )}
              <div style={{ fontFamily: 'monospace', fontSize: '14px' }}>
                <p><strong>Primary Physical ID:</strong> <code>{result.data.physicalVerification.physicalId}</code></p>
                {result.data.physicalVerification.shortId !== result.data.physicalVerification.physicalId && (
                  <p><strong>Short ID:</strong> <code>{result.data.physicalVerification.shortId}</code></p>
                )}
                <p><strong>Numeric ID:</strong> <code>{result.data.physicalVerification.numericId}</code></p>
              </div>
              <p style={{ fontSize: '0.9rem', color: '#666', marginTop: '10px' }}>
                💡 {result.data.physicalVerification.isCustomId 
                  ? 'Users can verify this object by entering your custom ID (like ISBN number or poster title).' 
                  : 'These IDs can be used to verify the object without taking a photo. Print them on a sticker and attach to the back of your object.'
                }
              </p>
              {result.data.physicalVerification.isCustomId && (
                <p style={{ fontSize: '0.85rem', color: '#28a745', marginTop: '5px' }}>
                  🎯 <strong>Perfect for verification!</strong> Users can simply enter "{result.data.physicalVerification.physicalId}" to verify this object.
                </p>
              )}
            </div>
          )}
          
          <div className="qr-code" style={{ marginTop: '20px' }}>
            <h5>Certificate QR Code:</h5>
            <img 
              src={result.data.certificate.dataUrl} 
              alt="Certificate QR Code"
              style={{ maxWidth: '200px', margin: '10px 0' }}
            />
            <br />
            <button 
              className="btn btn-secondary"
              onClick={downloadCertificate}
            >
              📥 Download Certificate
            </button>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label>Object Image *</label>
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
                <div style={{ fontSize: '3rem', marginBottom: '10px' }}>📷</div>
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

        <div className="grid">
          <div className="form-group">
            <label htmlFor="name">Object Name *</label>
            <input
              type="text"
              id="name"
              name="name"
              value={formData.name}
              onChange={handleInputChange}
              placeholder="e.g., Bitcoin Boma #1"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="artist">Artist/Creator *</label>
            <input
              type="text"
              id="artist"
              name="artist"
              value={formData.artist}
              onChange={handleInputChange}
              placeholder="e.g., Perry"
              required
            />
          </div>
        </div>

        <div className="form-group">
          <label htmlFor="type">Object Type</label>
          <select
            id="type"
            name="type"
            value={formData.type}
            onChange={handleInputChange}
          >
            <option value="poster">Poster</option>
            <option value="book">Book</option>
            <option value="art">Art Object</option>
            <option value="sculpture">Sculpture</option>
            <option value="other">Other</option>
          </select>
        </div>

        <div className="form-group">
          <label htmlFor="customPhysicalId">
            Physical ID (Optional)
            <small style={{ display: 'block', color: '#666', fontWeight: 'normal', marginTop: '4px' }}>
              {formData.type === 'book' && 'Enter ISBN number (e.g., 978-0-123456-78-9)'}
              {formData.type === 'poster' && 'Enter poster title or catalog number'}
              {formData.type === 'art' && 'Enter artwork catalog number or title'}
              {formData.type === 'sculpture' && 'Enter sculpture name or catalog number'}
              {formData.type === 'other' && 'Enter any unique identifier for this object'}
            </small>
          </label>
          <input
            type="text"
            id="customPhysicalId"
            name="customPhysicalId"
            value={formData.customPhysicalId}
            onChange={handleInputChange}
            placeholder={
              formData.type === 'book' ? 'ISBN: 978-0-123456-78-9' :
              formData.type === 'poster' ? 'Poster title or catalog #' :
              formData.type === 'art' ? 'Artwork catalog # or title' :
              formData.type === 'sculpture' ? 'Sculpture name or catalog #' :
              'Unique identifier'
            }
            style={{ fontFamily: 'monospace' }}
          />
          <small style={{ color: '#888', fontSize: '0.85em', marginTop: '4px', display: 'block' }}>
            💡 If provided, this will be used as the primary physical ID instead of generating a random one.
            This makes verification much easier - users can simply enter the ISBN or title to verify the object.
          </small>
        </div>

        <div className="form-group">
          <label htmlFor="description">Description</label>
          <textarea
            id="description"
            name="description"
            value={formData.description}
            onChange={handleInputChange}
            placeholder="Tell the story of this object..."
            rows="4"
          />
        </div>

        <button 
          type="submit" 
          className="btn btn-primary"
          disabled={loading}
        >
          {loading ? (
            <div className="loading">
              <div className="spinner"></div>
              Creating Identity...
            </div>
          ) : (
            <>
              🎨 Create Object Identity
            </>
          )}
        </button>
      </form>
    </div>
  )
}

export default CreateObject