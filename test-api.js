#!/usr/bin/env node

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Test API endpoints
const API_BASE = 'http://localhost:12001/api'

async function testHealthEndpoint() {
  console.log('🔍 Testing health endpoint...')
  try {
    const response = await fetch(`${API_BASE}/health`)
    const data = await response.json()
    console.log('✅ Health check passed:', data)
    return true
  } catch (error) {
    console.error('❌ Health check failed:', error.message)
    return false
  }
}

async function testListObjects() {
  console.log('🔍 Testing list objects endpoint...')
  try {
    const response = await fetch(`${API_BASE}/objects`)
    const data = await response.json()
    console.log(`✅ Objects list retrieved: ${data.length} objects`)
    return data
  } catch (error) {
    console.error('❌ List objects failed:', error.message)
    return []
  }
}

async function createTestImage() {
  console.log('🎨 Creating test image...')
  
  // Create a simple colored rectangle as test image
  const canvas = `
    <svg width="400" height="300" xmlns="http://www.w3.org/2000/svg">
      <rect width="400" height="300" fill="#667eea"/>
      <text x="200" y="150" text-anchor="middle" fill="white" font-size="24" font-family="Arial">
        Test Poster #1
      </text>
      <text x="200" y="180" text-anchor="middle" fill="white" font-size="16" font-family="Arial">
        by Test Artist
      </text>
    </svg>
  `
  
  const testImagePath = path.join(__dirname, 'test-poster.svg')
  fs.writeFileSync(testImagePath, canvas)
  console.log('✅ Test image created:', testImagePath)
  return testImagePath
}

async function runTests() {
  console.log('🚀 Starting API tests...\n')
  
  // Test health endpoint
  const healthOk = await testHealthEndpoint()
  if (!healthOk) {
    console.log('❌ Server not responding. Make sure the server is running on port 12001')
    return
  }
  
  console.log('')
  
  // Test list objects
  const objects = await testListObjects()
  
  console.log('')
  
  // Create test image
  const testImagePath = await createTestImage()
  
  console.log('')
  console.log('🎉 Basic API tests completed!')
  console.log('')
  console.log('📋 Next steps:')
  console.log('1. Open your browser to: https://work-1-mnajxehvbzgudrvj.prod-runtime.all-hands.dev')
  console.log('2. Try creating an object identity with the test image')
  console.log('3. Test the verification functionality')
  console.log('4. Explore the zap and story features')
  console.log('')
  console.log('🔧 Server endpoints:')
  console.log('- Frontend: https://work-1-mnajxehvbzgudrvj.prod-runtime.all-hands.dev (port 12000)')
  console.log('- API: https://work-2-mnajxehvbzgudrvj.prod-runtime.all-hands.dev (port 12001)')
}

runTests().catch(console.error)