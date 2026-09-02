import 'dotenv/config';
import { CategoryFilterType, PrismaClient, StoreMode, UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const DEMO_BUYER = {
  email: 'demo.buyer@g.bracu.ac.bd',
  password: process.env.DEMO_BUYER_PASSWORD || 'Buyer@12345',
  name: 'Demo Buyer',
};

const DEMO_SELLER = {
  email: 'demo.seller@g.bracu.ac.bd',
  password: process.env.DEMO_SELLER_PASSWORD || 'Seller@12345',
  name: 'Demo Seller',
  storeName: "Demo Seller's Store",
};

async function ensureAccessRole(slug: string, accountType: UserRole, name: string) {
  return prisma.accessRole.upsert({
    where: { slug },
    create: {
      name,
      slug,
      accountType,
      permissions: [],
      isSystem: true,
      description: `Standard ${accountType} account.`,
    },
    update: { accountType, isSystem: true },
  });
}

async function ensureCategory() {
  const existing = await prisma.category.findFirst({ where: { isActive: true } });
  if (existing) return existing;
  return prisma.category.create({
    data: {
      name: 'General',
      slug: 'general',
      mode: StoreMode.general,
      filterType: CategoryFilterType.general,
      isActive: true,
    },
  });
}

async function uniqueSlug(base: string) {
  const root =
    base.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') ||
    'store';
  let slug = root;
  let suffix = 1;
  while (await prisma.store.findUnique({ where: { slug } })) {
    slug = `${root}-${++suffix}`;
  }
  return slug;
}

async function seedBuyer() {
  const email = DEMO_BUYER.email.trim().toLowerCase();
  const buyerRole = await ensureAccessRole('buyer', UserRole.buyer, 'Buyer');
  const passwordHash = await bcrypt.hash(DEMO_BUYER.password, 12);

  const user = await prisma.user.upsert({
    where: { email },
    create: {
      email,
      name: DEMO_BUYER.name,
      password: passwordHash,
      role: UserRole.buyer,
      accessRoleId: buyerRole.id,
      isEmailVerified: true,
      emailVerifiedAt: new Date(),
    },
    update: {
      password: passwordHash,
      accessRoleId: buyerRole.id,
      isEmailVerified: true,
      isSuspended: false,
      failedLoginAttempts: 0,
      lockedUntil: null,
    },
    select: { id: true, email: true },
  });

  console.log(`Demo buyer ready: ${user.email} (${user.id})`);
}

async function seedSeller() {
  const email = DEMO_SELLER.email.trim().toLowerCase();
  const sellerRole = await ensureAccessRole('seller', UserRole.seller, 'Seller');
  const category = await ensureCategory();
  const passwordHash = await bcrypt.hash(DEMO_SELLER.password, 12);

  const user = await prisma.$transaction(async (tx) => {
    const created = await tx.user.upsert({
      where: { email },
      create: {
        email,
        name: DEMO_SELLER.name,
        password: passwordHash,
        role: UserRole.seller,
        accessRoleId: sellerRole.id,
        isApproved: true,
        isEmailVerified: true,
        emailVerifiedAt: new Date(),
      },
      update: {
        password: passwordHash,
        role: UserRole.seller,
        accessRoleId: sellerRole.id,
        isApproved: true,
        isEmailVerified: true,
        isSuspended: false,
        failedLoginAttempts: 0,
        lockedUntil: null,
      },
    });

    const existingStore = await tx.store.findFirst({
      where: { ownerId: created.id },
    });
    if (!existingStore) {
      const slug = await uniqueSlug(DEMO_SELLER.storeName);
      await tx.store.create({
        data: {
          ownerId: created.id,
          name: DEMO_SELLER.storeName,
          slug,
          categoryId: category.id,
          categoryName: category.name,
          mode: category.mode,
        },
      });
    }
    return created;
  });

  console.log(`Verified demo seller ready: ${user.email} (${user.id})`);
}

async function seedDemoAccounts() {
  await seedBuyer();
  await seedSeller();
}

seedDemoAccounts()
  .catch((error: unknown) => {
    console.error('Demo account seed failed', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
