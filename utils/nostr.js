import { generateSecretKey, getPublicKey, finalizeEvent, SimplePool, nip19 } from 'nostr-tools'
import { createHash } from 'crypto'
import WebSocket from 'ws'

// Make WebSocket available globally for nostr-tools
global.WebSocket = WebSocket

export class NostrClient {
  constructor(privateKey = null, relays = []) {
    this.privateKey = privateKey || generateSecretKey()
    this.publicKey = getPublicKey(this.privateKey)
    this.relays = relays.length > 0 ? relays : [
      'wss://relay.damus.io',
      'wss://nos.lol',
      'wss://relay.nostr.band',
      'wss://relay.snort.social'
    ]
    this.pool = new SimplePool()
  }

  // Create object identity event (kind 30000 - parameterized replaceable event)
  async createObjectIdentity(objectData) {
    const {
      uniqueId,
      name,
      type,
      imageHash,
      artist,
      provenance = 'first-mint',
      description = '',
      imageUrl = '',
      pHash = ''
    } = objectData

    const event = {
      kind: 30000,
      created_at: Math.floor(Date.now() / 1000),
      tags: [
        ['d', uniqueId], // unique ID per object (slug)
        ['name', name],
        ['type', type],
        ['hash', imageHash],
        ['artist', artist],
        ['prov', provenance],
        ['phash', pHash], // perceptual hash for duplicate detection
        ['image', imageUrl]
      ],
      content: description,
      pubkey: this.publicKey
    }

    const signedEvent = finalizeEvent(event, this.privateKey)
    
    // Publish to relays
    await this.publishEvent(signedEvent)
    
    return signedEvent
  }

  // Publish event to relays
  async publishEvent(event) {
    const promises = this.relays.map(relay => 
      this.pool.publish([relay], event)
    )
    
    await Promise.allSettled(promises)
    return event
  }

  // Find object by pHash (for duplicate detection)
  async findObjectByPHash(pHash, threshold = 5) {
    const filter = {
      kinds: [30000],
      '#phash': [pHash]
    }

    const events = await this.pool.querySync(this.relays, filter)
    return events
  }

  // Find object by unique ID
  async findObjectById(uniqueId) {
    const filter = {
      kinds: [30000],
      '#d': [uniqueId]
    }

    const events = await this.pool.querySync(this.relays, filter)
    return events.length > 0 ? events[0] : null
  }

  // Get all objects by artist
  async getObjectsByArtist(artist) {
    const filter = {
      kinds: [30000],
      '#artist': [artist]
    }

    const events = await this.pool.querySync(this.relays, filter)
    return events
  }

  // Create zap event for object
  async createZapEvent(objectId, amount, comment = '') {
    const event = {
      kind: 9734, // Zap request
      created_at: Math.floor(Date.now() / 1000),
      tags: [
        ['e', objectId], // reference to object event
        ['amount', amount.toString()],
        ['relays', ...this.relays]
      ],
      content: comment,
      pubkey: this.publicKey
    }

    const signedEvent = finalizeEvent(event, this.privateKey)
    await this.publishEvent(signedEvent)
    
    return signedEvent
  }

  // Add content/story to object (as thread)
  async addObjectContent(objectId, content, contentType = 'text') {
    const event = {
      kind: 1, // Text note
      created_at: Math.floor(Date.now() / 1000),
      tags: [
        ['e', objectId, '', 'reply'], // reply to object identity
        ['content-type', contentType]
      ],
      content: content,
      pubkey: this.publicKey
    }

    const signedEvent = finalizeEvent(event, this.privateKey)
    await this.publishEvent(signedEvent)
    
    return signedEvent
  }

  // Get object thread (all related content)
  async getObjectThread(objectId) {
    const filter = {
      kinds: [1],
      '#e': [objectId]
    }

    const events = await this.pool.querySync(this.relays, filter)
    return events.sort((a, b) => a.created_at - b.created_at)
  }

  // Generate naddr for object
  generateNaddr(event) {
    return nip19.naddrEncode({
      identifier: event.tags.find(tag => tag[0] === 'd')[1],
      pubkey: event.pubkey,
      kind: event.kind,
      relays: this.relays
    })
  }

  // Close connections
  close() {
    this.pool.close(this.relays)
  }
}

// Utility functions
export function generateObjectId(name, artist, timestamp = Date.now()) {
  const data = `${name}-${artist}-${timestamp}`
  return createHash('sha256').update(data).digest('hex').substring(0, 16)
}

export function calculateImageHash(imageBuffer) {
  return createHash('sha256').update(imageBuffer).digest('hex')
}