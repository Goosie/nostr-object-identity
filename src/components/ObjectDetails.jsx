import React, { useState, useEffect } from 'react'

function ObjectDetails({ object, onUpdate }) {
  const [activeTab, setActiveTab] = useState('details')
  const [thread, setThread] = useState([])
  const [newContent, setNewContent] = useState('')
  const [zapAmount, setZapAmount] = useState(100)
  const [zapComment, setZapComment] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)

  useEffect(() => {
    if (activeTab === 'thread') {
      fetchThread()
    }
  }, [activeTab, object.id])

  const fetchThread = async () => {
    try {
      const response = await fetch(`/api/objects/${object.id}/thread`)
      const data = await response.json()
      setThread(data.thread || [])
    } catch (error) {
      console.error('Error fetching thread:', error)
    }
  }

  const handleZap = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setSuccess(null)

    try {
      const response = await fetch(`/api/objects/${object.id}/zap`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          amount: zapAmount,
          comment: zapComment
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to send zap')
      }

      setSuccess(`Successfully zapped ${zapAmount} sats! Artist gets ${data.artistShare} sats, object gets ${data.objectShare} sats.`)
      setZapComment('')
      onUpdate()

    } catch (error) {
      console.error('Error sending zap:', error)
      setError(error.message)
    } finally {
      setLoading(false)
    }
  }

  const handleAddContent = async (e) => {
    e.preventDefault()
    if (!newContent.trim()) return

    setLoading(true)
    setError(null)
    setSuccess(null)

    try {
      const response = await fetch(`/api/objects/${object.id}/content`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          content: newContent,
          contentType: 'text'
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to add content')
      }

      setSuccess('Content added successfully!')
      setNewContent('')
      fetchThread()

    } catch (error) {
      console.error('Error adding content:', error)
      setError(error.message)
    } finally {
      setLoading(false)
    }
  }

  const tabs = [
    { id: 'details', label: 'Details', icon: '📋' },
    { id: 'zap', label: 'Zap Sats', icon: '⚡' },
    { id: 'thread', label: 'Story Thread', icon: '🧵' },
    { id: 'add-content', label: 'Add Content', icon: '✍️' }
  ]

  return (
    <div>
      <div style={{ display: 'flex', gap: '20px', marginBottom: '30px', alignItems: 'flex-start' }}>
        <div style={{ flexShrink: 0 }}>
          <img 
            src={`/api/images/${object.id}.jpg`}
            alt={object.name}
            style={{ 
              width: '300px', 
              height: '225px', 
              objectFit: 'cover', 
              borderRadius: '12px',
              boxShadow: '0 5px 15px rgba(0,0,0,0.1)'
            }}
          />
        </div>
        
        <div style={{ flex: 1 }}>
          <h1 style={{ marginBottom: '10px' }}>{object.name}</h1>
          <p style={{ fontSize: '1.2rem', color: '#666', marginBottom: '20px' }}>
            by <strong>{object.artist}</strong>
          </p>
          
          <div style={{ display: 'flex', gap: '20px', marginBottom: '20px' }}>
            <div>
              <span className="badge">{object.type}</span>
            </div>
            <div style={{ color: '#666' }}>
              Created: {new Date(object.createdAt).toLocaleDateString()}
            </div>
          </div>

          <div className="stats">
            <div className="stat">
              <div className="stat-value">{object.satsBalance}</div>
              <div className="stat-label">Sats Balance</div>
            </div>
            <div className="stat">
              <div className="stat-value">{object.views}</div>
              <div className="stat-label">Views</div>
            </div>
          </div>

          {object.description && (
            <div style={{ marginTop: '20px', padding: '15px', background: '#f8f9fa', borderRadius: '8px' }}>
              <h4 style={{ marginBottom: '10px' }}>Description</h4>
              <p style={{ margin: 0, lineHeight: '1.6' }}>{object.description}</p>
            </div>
          )}
        </div>
      </div>

      <div className="tabs">
        {tabs.map(tab => (
          <button
            key={tab.id}
            className={`tab ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            <span>{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="alert alert-error">
          {error}
        </div>
      )}

      {success && (
        <div className="alert alert-success">
          {success}
        </div>
      )}

      {activeTab === 'details' && (
        <div>
          <h3>Object Details</h3>
          
          <div className="grid">
            <div>
              <h4>Technical Information</h4>
              <p><strong>Object ID:</strong> <code>{object.id}</code></p>
              <p><strong>Image Hash:</strong> <code>{object.imageHash}</code></p>
              <p><strong>Perceptual Hash:</strong> <code>{object.pHash}</code></p>
              <p><strong>Nostr Event ID:</strong> <code>{object.nostrEventId}</code></p>
            </div>
            
            <div>
              <h4>Nostr Information</h4>
              <p><strong>Nostr Address:</strong></p>
              <code style={{ 
                display: 'block', 
                padding: '10px', 
                background: '#f0f0f0', 
                borderRadius: '4px',
                wordBreak: 'break-all',
                fontSize: '0.9rem'
              }}>
                {object.naddr}
              </code>
            </div>
          </div>

          <div style={{ marginTop: '30px' }}>
            <h4>Certificate QR Code</h4>
            <p>Scan this QR code to verify the object's authenticity:</p>
            <div style={{ textAlign: 'center', margin: '20px 0' }}>
              <button 
                className="btn btn-secondary"
                onClick={() => {
                  const url = `/api/certificates/${object.id}`
                  const link = document.createElement('a')
                  link.href = url
                  link.download = `${object.name}_certificate.png`
                  link.click()
                }}
              >
                📥 Download Certificate
              </button>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'zap' && (
        <div>
          <h3>⚡ Zap Sats to Object</h3>
          <p style={{ marginBottom: '20px', color: '#666' }}>
            Support the artist and contribute to the object's community fund. 
            50% goes to the artist, 50% stays with the object for future community decisions.
          </p>

          <form onSubmit={handleZap}>
            <div className="form-group">
              <label htmlFor="zapAmount">Amount (sats)</label>
              <input
                type="number"
                id="zapAmount"
                value={zapAmount}
                onChange={(e) => setZapAmount(parseInt(e.target.value) || 0)}
                min="1"
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="zapComment">Comment (optional)</label>
              <textarea
                id="zapComment"
                value={zapComment}
                onChange={(e) => setZapComment(e.target.value)}
                placeholder="Leave a message with your zap..."
                rows="3"
              />
            </div>

            <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' }}>
              {[21, 100, 500, 1000, 5000].map(amount => (
                <button
                  key={amount}
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setZapAmount(amount)}
                >
                  {amount} sats
                </button>
              ))}
            </div>

            <button 
              type="submit" 
              className="btn btn-primary"
              disabled={loading || zapAmount <= 0}
            >
              {loading ? (
                <div className="loading">
                  <div className="spinner"></div>
                  Sending Zap...
                </div>
              ) : (
                <>
                  ⚡ Zap {zapAmount} sats
                </>
              )}
            </button>
          </form>
        </div>
      )}

      {activeTab === 'thread' && (
        <div>
          <h3>🧵 Story Thread</h3>
          <p style={{ marginBottom: '20px', color: '#666' }}>
            Follow the complete story and updates about this object.
          </p>

          {thread.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
              <div style={{ fontSize: '3rem', marginBottom: '20px' }}>📝</div>
              <h4>No story content yet</h4>
              <p>Be the first to add content to this object's story!</p>
            </div>
          ) : (
            <div>
              {thread.map((event, index) => (
                <div 
                  key={event.id} 
                  style={{ 
                    padding: '20px', 
                    border: '1px solid #e0e0e0', 
                    borderRadius: '8px',
                    marginBottom: '15px',
                    background: '#fafafa'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                    <strong>Story Update #{index + 1}</strong>
                    <span style={{ color: '#666', fontSize: '0.9rem' }}>
                      {new Date(event.created_at * 1000).toLocaleString()}
                    </span>
                  </div>
                  <p style={{ margin: 0, lineHeight: '1.6' }}>{event.content}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'add-content' && (
        <div>
          <h3>✍️ Add Content to Story</h3>
          <p style={{ marginBottom: '20px', color: '#666' }}>
            Add new content to this object's story thread. This will be published as a Nostr event.
          </p>

          <form onSubmit={handleAddContent}>
            <div className="form-group">
              <label htmlFor="newContent">Story Content</label>
              <textarea
                id="newContent"
                value={newContent}
                onChange={(e) => setNewContent(e.target.value)}
                placeholder="Share an update, story, or additional information about this object..."
                rows="6"
                required
              />
            </div>

            <button 
              type="submit" 
              className="btn btn-primary"
              disabled={loading || !newContent.trim()}
            >
              {loading ? (
                <div className="loading">
                  <div className="spinner"></div>
                  Publishing...
                </div>
              ) : (
                <>
                  📝 Add to Story
                </>
              )}
            </button>
          </form>
        </div>
      )}
    </div>
  )
}

export default ObjectDetails