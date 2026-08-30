import { ForbiddenException } from '@nestjs/common';

/**
 * Throws a ForbiddenException unless `isOwner` is true. Centralizes the
 * "is this the caller's own resource" check so every module doesn't
 * hand-roll its own `if (...) throw new ForbiddenException(...)`.
 */
export function assertOwnership(
  isOwner: boolean,
  message = 'Not authorized to access this resource',
): void {
  if (!isOwner) throw new ForbiddenException(message);
}
