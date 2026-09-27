import { randomUUID } from 'node:crypto';
import {
  DeleteObjectsCommand,
  GetObjectCommand,
  NoSuchKey,
  S3Client,
} from '@aws-sdk/client-s3';
import { createPresignedPost } from '@aws-sdk/s3-presigned-post';
import { AnalysisError } from './errors';
import type { ImagePart } from './analyze';

/**
 * 사진 임시 보관 (S3).
 *
 * 브라우저가 Lambda를 거치지 않고 S3에 바로 올리도록 업로드 전용 주소를 발급하고,
 * 분석할 때 꺼내 읽은 뒤 곧바로 지웁니다. 지우지 못한 사진도 버킷의 수명 규칙이
 * 하루 뒤에 지웁니다(무저장 원칙).
 */

export const MAX_IMAGES = 10;
/** 한 장 최대 크기. 브라우저에서 줄여 보내므로 보통 1MB 안쪽입니다 */
const MAX_IMAGE_BYTES = 3.5 * 1024 * 1024;
/** Bedrock 요청 한 건은 20MB까지라 base64로 늘어나는 것까지 감안한 합계 제한 */
const MAX_TOTAL_BYTES = 14 * 1024 * 1024;
/** 업로드 주소 유효 시간(초) */
const UPLOAD_URL_TTL = 300;

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
type AllowedType = (typeof ALLOWED_TYPES)[number];

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

const s3 = new S3Client({});

const keyFor = (uploadId: string, index: number) => `uploads/${uploadId}/${index}`;

export function isAllowedType(value: unknown): value is AllowedType {
  return ALLOWED_TYPES.includes(value as AllowedType);
}

export interface UploadSlot {
  /** 브라우저가 form POST를 보낼 주소 */
  url: string;
  /** form에 함께 넣어야 하는 필드. 파일은 맨 마지막에 file 필드로 붙입니다 */
  fields: Record<string, string>;
}

export async function createUploadSlots(
  bucket: string,
  contentTypes: AllowedType[],
): Promise<{ uploadId: string; slots: UploadSlot[] }> {
  const uploadId = randomUUID();
  const slots = await Promise.all(
    contentTypes.map((contentType, index) =>
      createPresignedPost(s3, {
        Bucket: bucket,
        Key: keyFor(uploadId, index),
        // 크기와 형식을 S3가 직접 검사하므로 이 주소로 큰 파일이나 다른 파일은 못 올립니다.
        Conditions: [
          ['content-length-range', 1, MAX_IMAGE_BYTES],
          ['eq', '$Content-Type', contentType],
        ],
        Fields: { 'Content-Type': contentType },
        Expires: UPLOAD_URL_TTL,
      }),
    ),
  );
  return { uploadId, slots };
}

/** 올라온 사진을 읽고, 성공하든 실패하든 바로 지웁니다 */
export async function takeImages(bucket: string, uploadId: string, count: number): Promise<ImagePart[]> {
  if (!UUID.test(uploadId)) throw new AnalysisError('bad_request', '업로드 정보가 올바르지 않아요.');
  if (!Number.isInteger(count) || count < 1 || count > MAX_IMAGES) {
    throw new AnalysisError('bad_request', `사진은 한 번에 ${MAX_IMAGES}장까지 올릴 수 있어요.`);
  }

  const keys = Array.from({ length: count }, (_, index) => keyFor(uploadId, index));

  try {
    const images = await Promise.all(keys.map((key) => readImage(bucket, key)));
    const total = images.reduce((sum, image) => sum + image.bytes, 0);
    if (total > MAX_TOTAL_BYTES) {
      throw new AnalysisError('too_large', '사진 용량이 너무 커요. 장수를 줄여서 다시 올려 주세요.');
    }
    return images.map(({ mediaType, data }) => ({ mediaType, data }));
  } finally {
    await s3
      .send(
        new DeleteObjectsCommand({
          Bucket: bucket,
          Delete: { Objects: keys.map((Key) => ({ Key })), Quiet: true },
        }),
      )
      .catch((error: unknown) => {
        // 지우기에 실패해도 수명 규칙이 하루 안에 지우므로 분석은 계속합니다.
        console.error('failed to delete uploads', { uploadId, error });
      });
  }
}

async function readImage(bucket: string, key: string): Promise<ImagePart & { bytes: number }> {
  try {
    const object = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
    const mediaType = object.ContentType;
    if (!isAllowedType(mediaType) || !object.Body) {
      throw new AnalysisError('bad_request', '사진 형식이 올바르지 않아요.');
    }
    const bytes = await object.Body.transformToByteArray();
    return { mediaType, data: Buffer.from(bytes).toString('base64'), bytes: bytes.length };
  } catch (error) {
    if (error instanceof NoSuchKey) {
      throw new AnalysisError('not_found', '사진이 다 올라가지 않았어요. 다시 시도해 주세요.');
    }
    throw error;
  }
}
