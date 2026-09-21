import sharp from 'sharp';
import { HttpError } from './http';
import { encrypt } from './security';
export async function prepareImage(base64: string, mimeType: string, avatar = false) {
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(base64))
    throw new HttpError(400, 'INVALID_IMAGE', 'Choose a JPEG or PNG image.');
  const bytes = Buffer.from(base64, 'base64');
  if (bytes.length > 3 * 1024 * 1024)
    throw new HttpError(413, 'IMAGE_TOO_LARGE', 'Choose an image smaller than 3 MB.');
  const jpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  const png = bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  if ((mimeType === 'image/jpeg' && !jpeg) || (mimeType === 'image/png' && !png))
    throw new HttpError(400, 'INVALID_IMAGE', 'The image type does not match the file.');
  try {
    const clean = await sharp(bytes, { limitInputPixels: 20000000 })
      .rotate()
      .resize({
        width: avatar ? 512 : 1600,
        height: avatar ? 512 : 1600,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .jpeg({ quality: 85 })
      .toBuffer();
    return encrypt(clean);
  } catch {
    throw new HttpError(400, 'INVALID_IMAGE', 'This image could not be processed.');
  }
}
