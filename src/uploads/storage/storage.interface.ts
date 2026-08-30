export const STORAGE_SERVICE = 'STORAGE_SERVICE';

export interface StorageService {
  save(file: Express.Multer.File, folder: string): Promise<string>;
  savePrivate(file: Express.Multer.File): Promise<string>;
  getPrivatePath(storageKey: string): string;
}
