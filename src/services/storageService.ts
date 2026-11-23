import { getDownloadURL, ref, uploadBytesResumable } from 'firebase/storage';
import { storage } from '../lib/firebase';

export interface UploadResult {
  url: string;
  storagePath: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
}

const MAX_INVOICE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB
const MAX_PHOTO_SIZE_BYTES = 8 * 1024 * 1024; // 8 MB

const ALLOWED_INVOICE_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'text/xml',
  'application/xml',
]);

const ALLOWED_PHOTO_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
]);

function sanitizeFileName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .slice(0, 120);
}

function uploadToStoragePath(
  file: File,
  storagePath: string,
  onProgress?: (percent: number) => void,
): Promise<UploadResult> {
  return new Promise((resolve, reject) => {
    const storageRef = ref(storage, storagePath);
    const task = uploadBytesResumable(storageRef, file, {
      contentType: file.type || 'application/octet-stream',
    });

    task.on(
      'state_changed',
      (snapshot) => {
        if (snapshot.totalBytes > 0 && onProgress) {
          const pct = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
          onProgress(pct);
        }
      },
      (error) => {
        reject(
          new Error(
            error.code === 'storage/unauthorized'
              ? 'Firebase Storage bloqueou o upload (regras de Storage não configuradas). Você pode informar o link externo do arquivo abaixo ou ativar as regras do Storage no console do Firebase.'
              : `Falha no envio para o Storage (${error.code || error.message}).`,
          ),
        );
      },
      async () => {
        try {
          const url = await getDownloadURL(task.snapshot.ref);
          resolve({
            url,
            storagePath,
            fileName: file.name.slice(0, 200),
            contentType: file.type,
            sizeBytes: file.size,
          });
        } catch (err) {
          reject(err);
        }
      },
    );
  });
}

export async function uploadInvoiceFile(
  file: File,
  ownerId: string,
  constructionId: string,
  onProgress?: (percent: number) => void,
): Promise<UploadResult> {
  if (file.size > MAX_INVOICE_SIZE_BYTES) {
    throw new Error('O arquivo da Nota Fiscal excede o limite de 10 MB.');
  }
  if (file.type && !ALLOWED_INVOICE_TYPES.has(file.type)) {
    throw new Error('Formato não suportado. Envie PDF, JPG, PNG, WebP ou XML.');
  }

  const safeName = sanitizeFileName(file.name);
  const path = `users/${ownerId}/constructions/${constructionId}/invoices/${Date.now()}_${safeName}`;
  return uploadToStoragePath(file, path, onProgress);
}

export async function uploadConstructionPhotoFile(
  file: File,
  ownerId: string,
  constructionId: string,
  category: string,
  onProgress?: (percent: number) => void,
): Promise<UploadResult> {
  if (file.size > MAX_PHOTO_SIZE_BYTES) {
    throw new Error('A fotografia excede o limite de 8 MB.');
  }
  if (file.type && !ALLOWED_PHOTO_TYPES.has(file.type)) {
    throw new Error('Formato de imagem inválido. Utilize JPG, PNG ou WebP.');
  }

  const safeName = sanitizeFileName(file.name);
  const path = `users/${ownerId}/constructions/${constructionId}/photos/${category}_${Date.now()}_${safeName}`;
  return uploadToStoragePath(file, path, onProgress);
}
