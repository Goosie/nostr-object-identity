# Deployment Guide

## Quick Start

The Nostr Object Identity application is now running and ready to use!

### Access URLs

- **Frontend Application**: https://work-1-mnajxehvbzgudrvj.prod-runtime.all-hands.dev
- **API Server**: https://work-2-mnajxehvbzgudrvj.prod-runtime.all-hands.dev

### Current Status

✅ **Server Running**: Port 12001  
✅ **Frontend Built**: Production build ready  
✅ **Development Server**: Port 12000  
✅ **API Endpoints**: All functional  
✅ **File Upload**: Configured  
✅ **Image Processing**: Ready  
✅ **Nostr Integration**: Active  

## Testing the Application

### 1. Create Your First Object Identity

1. Open the frontend URL in your browser
2. Navigate to the "Create Identity" tab
3. Upload an image (or use the test image created at `/workspace/project/test-poster.svg`)
4. Fill in the object details:
   - **Name**: "Bitcoin Boma #1" (or your choice)
   - **Artist**: "Perry" (or your name)
   - **Type**: Select from dropdown
   - **Description**: Add a story about your object
5. Click "Create Object Identity"
6. Download the generated QR certificate

### 2. Verify Object Authenticity

1. Navigate to the "Verify Object" tab
2. Upload the same image (or take a new photo)
3. Click "Verify Object"
4. See the verification results and similarity score
5. Try the pay-per-view feature

### 3. Explore Object Details

1. Go to "All Objects" tab
2. Click on any object to view details
3. Try zapping sats to the object
4. Add content to the object's story thread

## Production Deployment

### Prerequisites

- Node.js 18+ 
- npm or yarn
- Domain name and SSL certificate
- Nostr relay access
- Lightning Network node (optional)

### Environment Configuration

Create a production `.env` file:

```bash
# Nostr Configuration
NOSTR_PRIVATE_KEY=your_actual_private_key_here
NOSTR_RELAYS=wss://relay.damus.io,wss://nos.lol,wss://relay.nostr.band,wss://relay.snort.social

# Lightning Network (optional)
LIGHTNING_NODE_URL=your_lightning_node_url
LIGHTNING_MACAROON=your_macaroon_here

# Production Configuration
NODE_ENV=production
PORT=3001
UPLOAD_DIR=/var/uploads
```

### Build and Deploy

```bash
# Install dependencies
npm install --production

# Build frontend
npm run build

# Start production server
npm start
```

### Nginx Configuration

```nginx
server {
    listen 80;
    server_name your-domain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;
    
    ssl_certificate /path/to/certificate.crt;
    ssl_certificate_key /path/to/private.key;
    
    # Frontend
    location / {
        root /path/to/project/dist;
        try_files $uri $uri/ /index.html;
    }
    
    # API
    location /api/ {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### Docker Deployment

Create `Dockerfile`:

```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install --production

COPY . .
RUN npm run build

EXPOSE 3001

CMD ["npm", "start"]
```

Create `docker-compose.yml`:

```yaml
version: '3.8'

services:
  nostr-app:
    build: .
    ports:
      - "3001:3001"
    environment:
      - NODE_ENV=production
      - PORT=3001
    volumes:
      - ./uploads:/app/uploads
      - ./.env:/app/.env
    restart: unless-stopped
```

Deploy with Docker:

```bash
docker-compose up -d
```

### Database Integration (Optional)

For production, consider replacing the in-memory storage with a database:

#### PostgreSQL Setup

```bash
npm install pg
```

Create database schema:

```sql
CREATE TABLE objects (
    id VARCHAR(255) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    artist VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL,
    description TEXT,
    image_hash VARCHAR(255) NOT NULL,
    phash VARCHAR(255) NOT NULL,
    naddr TEXT NOT NULL,
    nostr_event_id VARCHAR(255) NOT NULL,
    sats_balance INTEGER DEFAULT 0,
    views INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_phash ON objects(phash);
CREATE INDEX idx_artist ON objects(artist);
CREATE INDEX idx_type ON objects(type);
```

#### Redis for Caching

```bash
npm install redis
```

Use Redis for:
- pHash cache
- Session storage
- Rate limiting
- Real-time features

### Monitoring and Logging

#### PM2 Process Manager

```bash
npm install -g pm2

# Start with PM2
pm2 start npm --name "nostr-app" -- start

# Monitor
pm2 monit

# Logs
pm2 logs nostr-app
```

#### Health Monitoring

Set up monitoring for:
- `/api/health` endpoint
- Server response times
- Error rates
- Upload success rates
- Nostr relay connectivity

### Security Considerations

#### File Upload Security

- Validate file types and sizes
- Scan uploads for malware
- Use separate domain for user content
- Implement rate limiting

#### API Security

- Add authentication for sensitive operations
- Implement CORS properly
- Use HTTPS everywhere
- Validate all inputs
- Add request rate limiting

#### Nostr Security

- Secure private key storage
- Use environment variables
- Rotate keys periodically
- Monitor relay connections

### Scaling Considerations

#### Horizontal Scaling

- Use load balancer
- Separate API and frontend servers
- Implement session sharing
- Use CDN for static assets

#### Performance Optimization

- Image optimization and CDN
- Database indexing
- Caching strategies
- Connection pooling

### Backup Strategy

#### Data Backup

- Regular database backups
- Upload directory backups
- Configuration backups
- Nostr event backups

#### Recovery Plan

- Automated backup verification
- Recovery testing
- Disaster recovery procedures
- Data retention policies

## Maintenance

### Regular Tasks

- Monitor server health
- Update dependencies
- Check Nostr relay status
- Review error logs
- Backup verification

### Updates

```bash
# Update dependencies
npm update

# Rebuild frontend
npm run build

# Restart services
pm2 restart nostr-app
```

### Troubleshooting

#### Common Issues

1. **Image upload fails**
   - Check file permissions
   - Verify upload directory exists
   - Check file size limits

2. **Nostr events not publishing**
   - Verify relay connectivity
   - Check private key format
   - Monitor relay responses

3. **pHash comparison errors**
   - Verify image processing libraries
   - Check image format support
   - Monitor hash generation

#### Debug Mode

```bash
DEBUG=* npm start
```

#### Log Analysis

```bash
# View recent logs
tail -f /var/log/nostr-app.log

# Search for errors
grep -i error /var/log/nostr-app.log
```

## Support

For deployment support:
- Check the GitHub issues
- Review the documentation
- Contact the development team
- Join the Nostr community

---

🚀 **Your Nostr Object Identity application is ready for production!**