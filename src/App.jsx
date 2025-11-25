import React, { useState, useEffect } from 'react'
import CreateObject from './components/CreateObject'
import VerifyObject from './components/VerifyObject'
import ObjectList from './components/ObjectList'
import ObjectDetails from './components/ObjectDetails'

function App() {
  const [activeTab, setActiveTab] = useState('create')
  const [selectedObject, setSelectedObject] = useState(null)
  const [objects, setObjects] = useState([])

  useEffect(() => {
    fetchObjects()
  }, [])

  const fetchObjects = async () => {
    try {
      const response = await fetch('/api/objects')
      const data = await response.json()
      setObjects(data)
    } catch (error) {
      console.error('Error fetching objects:', error)
    }
  }

  const handleObjectCreated = (newObject) => {
    setObjects(prev => [newObject, ...prev])
    setActiveTab('list')
  }

  const handleObjectSelect = (object) => {
    setSelectedObject(object)
    setActiveTab('details')
  }

  const tabs = [
    { id: 'create', label: 'Create Identity', icon: '📷' },
    { id: 'verify', label: 'Verify Object', icon: '🔍' },
    { id: 'list', label: 'All Objects', icon: '📋' },
  ]

  if (selectedObject && activeTab === 'details') {
    return (
      <div className="container">
        <div className="header">
          <h1>🎨 Nostr Object Identity</h1>
          <p>Create and verify digital identities for physical objects</p>
        </div>
        
        <div className="card">
          <button 
            className="btn btn-secondary"
            onClick={() => {
              setSelectedObject(null)
              setActiveTab('list')
            }}
            style={{ marginBottom: '20px' }}
          >
            ← Back to List
          </button>
          
          <ObjectDetails 
            object={selectedObject} 
            onUpdate={fetchObjects}
          />
        </div>
      </div>
    )
  }

  return (
    <div className="container">
      <div className="header">
        <h1>🎨 Nostr Object Identity</h1>
        <p>Create and verify digital identities for physical objects</p>
      </div>

      <div className="card">
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

        {activeTab === 'create' && (
          <CreateObject onObjectCreated={handleObjectCreated} />
        )}

        {activeTab === 'verify' && (
          <VerifyObject />
        )}

        {activeTab === 'list' && (
          <ObjectList 
            objects={objects} 
            onObjectSelect={handleObjectSelect}
            onRefresh={fetchObjects}
          />
        )}
      </div>
    </div>
  )
}

export default App