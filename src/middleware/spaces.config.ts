import { S3Client } from '@aws-sdk/client-s3';

export const s3 = new S3Client({
  endpoint: 'https://sgp1.digitaloceanspaces.com',
  region: 'sgp1', // DigitalOcean Spaces region - Singapore
  credentials: {
    accessKeyId: process.env.DO_SPACES_KEY!,
    secretAccessKey: process.env.DO_SPACES_SECRET!,
  },
  forcePathStyle: false, // DigitalOcean Spaces uses virtual-hosted-style
  requestHandler: {
    connectionTimeout: 30000, // 30 seconds connection timeout
    socketTimeout: 120000, // 2 minutes socket timeout for large files
  },
  maxAttempts: 5, // Increase retry attempts from default 3 to 5
});
