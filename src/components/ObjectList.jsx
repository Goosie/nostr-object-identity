import React, { useState } from 'react'

function ObjectList({ objects, onObjectSelect, onRefresh }) {
  const [sortBy, setSortBy] = useState('newest')
  const [filterType, setFilterType] = useState('all')

  const sortedAndFilteredObjects = objects
    .filter(obj => filterType === 'all' || obj.type === filterType)
    .sort((a, b) => {
      switch (sortBy) {
        case 'newest':
          return b.createdAt - a.createdAt
        case 'oldest':
          return a.createdAt - b.createdAt
        case 'name':
          return a.name.localeCompare(b.name)
        case 'artist':
          return a.artist.localeCompare(b.artist)
        case 'sats':
          return b.satsBalance - a.satsBalance
        case 'views':
          return b.views - a.views
        default:
          return 0
      }
    })

  const uniqueTypes = [...new Set(objects.map(obj => obj.type))]

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2>All Objects ({objects.length})</h2>
        <button 
          className="btn btn-secondary"
          onClick={onRefresh}
        >
          🔄 Refresh
        </button>
      </div>

      <div style={{ display: 'flex', gap: '20px', marginBottom: '30px', flexWrap: 'wrap' }}>
        <div>
          <label style={{ display: 'block', marginBottom: '5px', fontWeight: '600' }}>
            Sort by:
          </label>
          <select 
            value={sortBy} 
            onChange={(e) => setSortBy(e.target.value)}
            style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
          >
            <option value="newest">Newest First</option>
            <option value="oldest">Oldest First</option>
            <option value="name">Name A-Z</option>
            <option value="artist">Artist A-Z</option>
            <option value="sats">Most Sats</option>
            <option value="views">Most Views</option>
          </select>
        </div>

        <div>
          <label style={{ display: 'block', marginBottom: '5px', fontWeight: '600' }}>
            Filter by type:
          </label>
          <select 
            value={filterType} 
            onChange={(e) => setFilterType(e.target.value)}
            style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
          >
            <option value="all">All Types</option>
            {uniqueTypes.map(type => (
              <option key={type} value={type}>
                {type.charAt(0).toUpperCase() + type.slice(1)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {sortedAndFilteredObjects.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
          <div style={{ fontSize: '3rem', marginBottom: '20px' }}>📭</div>
          <h3>No objects found</h3>
          <p>
            {filterType !== 'all' 
              ? `No objects of type "${filterType}" found.`
              : 'No objects have been created yet. Create the first one!'
            }
          </p>
        </div>
      ) : (
        <div className="grid">
          {sortedAndFilteredObjects.map(object => (
            <ObjectCard 
              key={object.id} 
              object={object} 
              onSelect={() => onObjectSelect(object)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function ObjectCard({ object, onSelect }) {
  const [imageError, setImageError] = useState(false)

  return (
    <div className="object-card">
      <div style={{ display: 'flex', gap: '15px' }}>
        <div style={{ flexShrink: 0 }}>
          {!imageError ? (
            <img 
              src={`/api/images/${object.id}.jpg`}
              alt={object.name}
              className="object-image"
              onError={() => setImageError(true)}
              style={{ width: '120px', height: '90px' }}
            />
          ) : (
            <div 
              style={{ 
                width: '120px', 
                height: '90px', 
                background: '#f0f0f0', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                borderRadius: '8px',
                color: '#666'
              }}
            >
              🖼️
            </div>
          )}
        </div>
        
        <div style={{ flex: 1 }}>
          <div className="object-info">
            <h3>{object.name}</h3>
            <p><strong>Artist:</strong> {object.artist}</p>
            <p><strong>Type:</strong> <span className="badge">{object.type}</span></p>
            <p><strong>Created:</strong> {new Date(object.createdAt).toLocaleDateString()}</p>
            
            <div className="stats" style={{ marginTop: '10px' }}>
              <div className="stat">
                <div className="stat-value">{object.satsBalance}</div>
                <div className="stat-label">Sats</div>
              </div>
              <div className="stat">
                <div className="stat-value">{object.views}</div>
                <div className="stat-label">Views</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {object.description && (
        <div style={{ marginTop: '15px', padding: '10px', background: '#f8f9fa', borderRadius: '4px' }}>
          <p style={{ fontSize: '0.9rem', color: '#666', margin: 0 }}>
            {object.description.length > 100 
              ? `${object.description.substring(0, 100)}...`
              : object.description
            }
          </p>
        </div>
      )}

      <div style={{ marginTop: '15px', display: 'flex', gap: '10px' }}>
        <button 
          className="btn btn-primary"
          onClick={onSelect}
          style={{ flex: 1 }}
        >
          View Details
        </button>
        
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
          📥 Certificate
        </button>
      </div>
    </div>
  )
}

export default ObjectList