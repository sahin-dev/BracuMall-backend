import 'dotenv/config';
import { PrismaClient, UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function seedAdmin() {
  const email = (process.env.ADMIN_EMAIL || 'admin@bracu.ac.bd')
    .trim()
    .toLowerCase();
  const password = process.env.ADMIN_PASSWORD || 'Admin@12345';
  const name = process.env.ADMIN_NAME?.trim() || 'System Admin';

  if (password.length < 8) {
    throw new Error('ADMIN_PASSWORD must contain at least 8 characters');
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing && existing.role !== UserRole.admin) {
    throw new Error(
      `Cannot seed admin: ${email} already belongs to a non-admin account`,
    );
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const administratorRole = await prisma.accessRole.upsert({
    where: { slug: 'administrator' },
    create: {
      name: 'Administrator',
      slug: 'administrator',
      description: 'Full platform administration access.',
      accountType: UserRole.admin,
      permissions: ['*'],
      isSystem: true,
    },
    update: {
      accountType: UserRole.admin,
      permissions: ['*'],
      isSystem: true,
    },
  });
  const admin = await prisma.user.upsert({
    where: { email },
    create: {
      email,
      name,
      password: passwordHash,
      role: UserRole.admin,
      accessRoleId: administratorRole.id,
      isApproved: true,
      isEmailVerified: true,
      emailVerifiedAt: new Date(),
    },
    update: {
      name,
      password: passwordHash,
      role: UserRole.admin,
      accessRoleId: administratorRole.id,
      isApproved: true,
      isEmailVerified: true,
      emailVerifiedAt: existing?.emailVerifiedAt || new Date(),
      isSuspended: false,
      failedLoginAttempts: 0,
      lockedUntil: null,
      sessionVersion: { increment: 1 },
    },
    select: { id: true, email: true, name: true, role: true },
  });

  console.log(`Admin account is ready: ${admin.email} (${admin.id})`);
}

seedAdmin()
  .catch((error: unknown) => {
    console.error('Admin seed failed', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
