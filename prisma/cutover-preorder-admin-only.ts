import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// One-off hard cutover: pre-order becomes an admin-managed-store-only
// capability. Turns isPreOrder off on every non-admin product so it stops
// being advertised/orderable going forward. Existing PreOrder documents are
// untouched — PreOrdersService never re-checks product.isPreOrder once a
// PreOrder exists, so anything already placed keeps moving through its
// normal pending/confirmed/awaiting_payment -> fulfilled/cancelled flow.
async function cutoverPreOrderAdminOnly() {
  const result = await prisma.product.updateMany({
    where: { isPreOrder: true, isAdminManaged: false },
    data: {
      isPreOrder: false,
      preOrderDeadline: null,
      preOrderPaymentType: 'postpaid',
      preOrderDepositAmount: null,
      preOrderPostpaidDepositPercent: null,
      preOrderLimit: null,
    },
  });

  console.log(
    `Pre-order cutover complete: ${result.count} non-admin product(s) had pre-order disabled.`,
  );
}

cutoverPreOrderAdminOnly()
  .catch((error: unknown) => {
    console.error('Pre-order cutover failed', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
