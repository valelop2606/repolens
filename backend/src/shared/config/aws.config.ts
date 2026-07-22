import { registerAs } from '@nestjs/config';

/**
 * AWS configuration namespace.
 * Access via ConfigService.get('aws.region') etc.
 */
export default registerAs('aws', () => ({
  region: process.env.AWS_REGION ?? 'us-east-1',
  s3: {
    bucket: process.env.AWS_S3_BUCKET ?? 'codebase-understanding-uploads',
  },
  bedrock: {
    modelId: process.env.BEDROCK_MODEL_ID ?? 'anthropic.claude-3-sonnet-20240229-v1:0',
  },
}));
