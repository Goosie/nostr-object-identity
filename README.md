# Nostr Object Identity

A comprehensive Nostr application for creating digital identities of physical objects using perceptual hashing and blockchain technology.

## Features

### 🎨 Object Identity Creation
- Take photos of physical objects (posters, books, art, etc.)
- Generate unique digital identities using Nostr events (kind 30000)
- Create tamper-proof certificates with QR codes
- Automatic duplicate detection using perceptual hashing (pHash)

### 🔍 Object Verification
- Verify object authenticity by taking a photo
- Compare against existing objects using pHash similarity
- View object details, stats, and story
- Pay-per-view system for detailed information

### ⚡ Lightning Integration
- Zap sats to objects and artists
- 50/50 payment splitting (artist/object fund)
- Community-driven funding for future decisions
- Lightning Network integration ready

### 🧵 Story Threading
- Add content and updates to objects
- Create threaded stories as Nostr events
- Follow complete object history
- Community contributions

### 🏷️ Digital Certificates
- Generate QR codes for physical attachment
- Secure certificate verification
- Download certificates for printing
- Tamper-proof validation

## Technology Stack

- **Frontend**: React + Vite
- **Backend**: Node.js + Express
- **Nostr**: nostr-tools for protocol implementation
- **Image Processing**: Sharp + Jimp for optimization
- **Perceptual Hashing**: image-hash for duplicate detection
- **QR Codes**: qrcode library for certificate generation
- **File Upload**: Multer for image handling

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd nostr-object-identity
```

2. Install dependencies:
```bash
npm install
```

3. Configure environment variables:
```bash
cp .env.example .env
# Edit .env with your configuration
```

4. Build the frontend:
```bash
npm run build
```

5. Start the server:
```bash
npm start
```

6. For development:
```bash
npm run dev
```

## Configuration

### Environment Variables

- `NOSTR_PRIVATE_KEY`: Your Nostr private key (hex format)
- `NOSTR_RELAYS`: Comma-separated list of Nostr relays
- `PORT`: Server port (default: 12001)
- `UPLOAD_DIR`: Directory for uploaded images

### Nostr Relays

Default relays:
- wss://relay.damus.io
- wss://nos.lol
- wss://relay.nostr.band
- wss://relay.snort.social

## API Endpoints

### Objects
- `POST /api/objects` - Create new object identity
- `GET /api/objects` - List all objects
- `GET /api/objects/:id` - Get object details
- `POST /api/verify` - Verify object by image

### Interactions
- `POST /api/objects/:id/zap` - Zap sats to object
- `POST /api/objects/:id/content` - Add content to object story
- `GET /api/objects/:id/thread` - Get object story thread

### Assets
- `GET /api/images/:filename` - Serve object images
- `GET /api/certificates/:id` - Download object certificates

## Nostr Event Structure

### Object Identity (Kind 30000)
```json
{
  "kind": 30000,
  "tags": [
    ["d", "unique-object-id"],
    ["name", "Object Name"],
    ["type", "poster|book|art|sculpture|other"],
    ["hash", "sha256-of-image"],
    ["artist", "Artist Name"],
    ["prov", "provenance-info"],
    ["phash", "perceptual-hash"],
    ["image", "image-url"]
  ],
  "content": "Object description and story"
}
```

### Zap Events (Kind 9734)
```json
{
  "kind": 9734,
  "tags": [
    ["e", "object-event-id"],
    ["amount", "amount-in-sats"],
    ["relays", "relay1", "relay2"]
  ],
  "content": "Zap comment"
}
```

### Story Content (Kind 1)
```json
{
  "kind": 1,
  "tags": [
    ["e", "object-event-id", "", "reply"],
    ["content-type", "text"]
  ],
  "content": "Story update or additional content"
}
```

## Security Features

### Duplicate Detection
- Perceptual hashing (pHash) for image similarity
- Configurable similarity threshold
- Hamming distance calculation
- Automatic duplicate prevention

### Certificate Security
- SHA-256 hashing for data integrity
- QR code generation with tamper detection
- Secure certificate validation
- Physical attachment capability

### Data Protection
- Image optimization and compression
- Secure file upload handling
- Input validation and sanitization
- Error handling and logging

## Usage Examples

### Creating an Object Identity

1. Navigate to the "Create Identity" tab
2. Upload an image of your object
3. Fill in object details (name, artist, type, description)
4. Click "Create Object Identity"
5. Download the generated certificate QR code
6. Attach the certificate to your physical object

### Verifying an Object

1. Navigate to the "Verify Object" tab
2. Take a photo of the object you want to verify
3. Upload the image
4. Click "Verify Object"
5. View verification results and object details
6. Optionally pay sats for detailed information

### Adding to Object Story

1. Select an object from the list
2. Navigate to the "Add Content" tab
3. Write your story update or additional information
4. Click "Add to Story"
5. Content is published as a Nostr event

## Future Enhancements

### RGB Smart Contracts
- Integration with RGB protocol
- Smart contract deployment for objects
- Automated royalty distribution
- Decentralized governance

### Advanced Features
- Multi-signature object ownership
- Fractional ownership tokens
- Auction and marketplace integration
- Advanced analytics and insights

### Community Features
- Voting system for object funds
- Community-driven curation
- Reputation and trust scores
- Social features and following

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is open source and available under the MIT License.

## Support

For support and questions:
- Create an issue on GitHub
- Join our Nostr community
- Contact the development team

---

Built with ❤️ for the Nostr ecosystem and physical object authentication.