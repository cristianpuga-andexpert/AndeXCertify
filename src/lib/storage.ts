import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl as awsGetSignedUrl } from '@aws-sdk/s3-request-presigner';
import fs from 'fs/promises';
import path from 'path';

// ── Storage driver: local disk vs S3 ──────────────────────────────────────────
// Local disk: files saved to ./dev-storage/ and served via Express at
// /dev-storage/<key>. S3 is never called.
//
// Selection (decoupled from DEV_MODE so you can run real auth + local storage):
//   STORAGE_DRIVER=local  → always local disk
//   STORAGE_DRIVER=s3     → always S3
//   (unset)               → local if DEV_MODE=true, otherwise S3
const DEV_MODE = process.env.DEV_MODE === 'true';
const DEV_STORAGE_DIR = path.resolve(process.cwd(), 'dev-storage');

export function isLocalStorage(): boolean {
  const driver = process.env.STORAGE_DRIVER;
  if (driver === 'local') return true;
  if (driver === 's3')    return false;
  return DEV_MODE; // backward-compatible default
}

async function devEnsureDir(key: string): Promise<string> {
  const filePath = path.join(DEV_STORAGE_DIR, key);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  return filePath;
}

function devPublicUrl(key: string): string {
  return `/dev-storage/${key}`;
}

// ── S3 helpers (production) ───────────────────────────────────────────────────

function getClient(): S3Client {
  const endpoint = process.env.S3_ENDPOINT;
  const accessKeyId = process.env.S3_ACCESS_KEY_ID;
  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY;

  if (!endpoint || !accessKeyId || !secretAccessKey) {
    throw new Error('S3 environment variables are not configured (S3_ENDPOINT, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY)');
  }

  return new S3Client({
    endpoint,
    region: process.env.S3_REGION || 'auto',
    credentials: { accessKeyId, secretAccessKey },
    // Required for non-AWS providers (Hetzner, Backblaze, etc.)
    forcePathStyle: true,
  });
}

function getBucket(): string {
  const bucket = process.env.S3_BUCKET;
  if (!bucket) throw new Error('S3_BUCKET environment variable is not set');
  return bucket;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Upload a Buffer. In DEV mode saves to local disk; in production uploads to S3.
 */
export async function uploadFile(
  buffer: Buffer,
  key: string,
  mimeType: string
): Promise<string> {
  if (isLocalStorage()) {
    const filePath = await devEnsureDir(key);
    await fs.writeFile(filePath, buffer);
    console.log(`[Local Storage] Saved: ${filePath}`);
    return devPublicUrl(key);
  }

  const client = getClient();
  await client.send(
    new PutObjectCommand({
      Bucket:      getBucket(),
      Key:         key,
      Body:        buffer,
      ContentType: mimeType,
    })
  );
  // Return a URL using the public endpoint pattern
  const endpoint = process.env.S3_ENDPOINT!.replace(/\/$/, '');
  return `${endpoint}/${getBucket()}/${key}`;
}

/**
 * Upload a base64-encoded string. Strips the data URI prefix if present.
 */
export async function uploadFromBase64(
  base64: string,
  key: string,
  mimeType: string
): Promise<string> {
  const raw = base64.includes(',') ? base64.split(',')[1] : base64;
  const buffer = Buffer.from(raw, 'base64');
  return uploadFile(buffer, key, mimeType);
}

/**
 * Delete an object by key. In DEV mode removes from local disk.
 */
export async function deleteFile(key: string): Promise<void> {
  if (isLocalStorage()) {
    const filePath = path.join(DEV_STORAGE_DIR, key);
    await fs.rm(filePath, { force: true });
    console.log(`[Local Storage] Deleted: ${filePath}`);
    return;
  }

  const client = getClient();
  await client.send(
    new DeleteObjectCommand({
      Bucket: getBucket(),
      Key:    key,
    })
  );
}

/**
 * Generate a pre-signed URL for temporary access.
 * In DEV mode returns a direct local URL (no expiry needed).
 */
export async function getSignedUrl(
  key: string,
  expiresInSeconds = 3600
): Promise<string> {
  if (isLocalStorage()) {
    return devPublicUrl(key);
  }

  const client = getClient();
  const command = new GetObjectCommand({
    Bucket: getBucket(),
    Key:    key,
  });
  return awsGetSignedUrl(client, command, { expiresIn: expiresInSeconds });
}
