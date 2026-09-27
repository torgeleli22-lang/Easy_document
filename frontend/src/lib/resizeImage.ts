/**
 * 사진을 올리기 전에 브라우저 안에서 줄입니다.
 *
 * 휴대폰 원본 사진(3~10MB)을 그대로 올리면 느리고, AI도 어차피 줄여서 읽습니다.
 * 긴 변을 2000px로 맞추면 A4 문서의 글자는 충분히 읽히고 용량은 보통 1MB 안쪽입니다.
 */

const MAX_EDGE = 2000;
const JPEG_QUALITY = 0.85;

export async function resizeImage(file: File): Promise<Blob> {
  // imageOrientation: 'from-image'로 휴대폰 사진의 회전 정보(EXIF)를 반영합니다.
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  try {
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('canvas를 쓸 수 없습니다');

    // PNG의 투명 배경이 JPEG에서 검게 나오지 않게 흰 바탕을 깝니다.
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, width, height);
    context.drawImage(bitmap, 0, 0, width, height);

    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error('사진을 변환하지 못했습니다'))),
        'image/jpeg',
        JPEG_QUALITY,
      );
    });
  } finally {
    bitmap.close();
  }
}
