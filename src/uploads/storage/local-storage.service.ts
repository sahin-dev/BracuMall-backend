import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { StorageService } from './storage.interface';

const UPLOADS_ROOT = join(process.cwd(), 'uploads');
const PRIVATE_UPLOADS_ROOT = join(process.cwd(), 'private-uploads');

@Injectable()
export class LocalStorageService implements StorageService {
  save(file: Express.Multer.File, folder: string): Promise<string> {
    const dir = join(UPLOADS_ROOT, folder);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

    const safeName = file.originalname.replace(/[^a-zA-Z0-9.\-_]/g, '_');
    const filename = `${randomUUID()}-${safeName}`;
    writeFileSync(join(dir, filename), file.buffer);

    return Promise.resolve(`/uploads/${folder}/${filename}`);
  }

  savePrivate(file: Express.Multer.File): Promise<string> {
    if (!existsSync(PRIVATE_UPLOADS_ROOT))
      mkdirSync(PRIVATE_UPLOADS_ROOT, { recursive: true });
    const safeName = file.originalname.replace(/[^a-zA-Z0-9.\-_]/g, '_');
    const storageKey = `${randomUUID()}-${safeName}`;
    writeFileSync(join(PRIVATE_UPLOADS_ROOT, storageKey), file.buffer);
    return Promise.resolve(storageKey);
  }

  getPrivatePath(storageKey: string) {
    return join(PRIVATE_UPLOADS_ROOT, storageKey);
  }
}
