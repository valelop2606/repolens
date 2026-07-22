import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

/**
 * StorageService abstracts all S3 operations.
 *
 * Architectural rule: no module should call AWS SDK directly.
 * All storage I/O goes through this service.
 */
@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor(private readonly config: ConfigService) {
    const accessKeyId = this.config.get<string>('aws.accessKeyId', '');
    const secretAccessKey = this.config.get<string>('aws.secretAccessKey', '');

    this.client = new S3Client({
      region: this.config.get<string>('aws.region', 'us-east-1'),
      ...(accessKeyId && secretAccessKey
        ? { credentials: { accessKeyId, secretAccessKey } }
        : {}),
    });
    this.bucket = this.config.get<string>('aws.s3.bucket', 'codebase-understanding-uploads');
  }

  /**
   * Upload a buffer to S3 under the given key.
   */
  async upload(key: string, body: Buffer, contentType = 'application/octet-stream'): Promise<string> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
      }),
    );
    this.logger.log(`Uploaded object: ${key}`);
    return key;
  }

  /**
   * Generate a pre-signed GET URL valid for the given number of seconds.
   */
  async getSignedUrl(key: string, expiresInSeconds = 3600): Promise<string> {
    return getSignedUrl(
      this.client,
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
      { expiresIn: expiresInSeconds },
    );
  }

  /**
   * Delete a stored object.
   */
  async delete(key: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
    );
    this.logger.log(`Deleted object: ${key}`);
  }
}
