import type { Menu, Product } from '@prisma/client';

export function campusDayAndTime(date: Date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Dhaka',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const weekday = parts.find((part) => part.type === 'weekday')?.value.toLowerCase() ?? 'sun';
  const hour = parts.find((part) => part.type === 'hour')?.value ?? '00';
  const minute = parts.find((part) => part.type === 'minute')?.value ?? '00';
  return { day: weekday.slice(0, 3), time: `${hour}:${minute}` };
}

function withinWindow(
  days: string[] | null | undefined,
  from: string | null | undefined,
  until: string | null | undefined,
  day: string,
  time: string,
) {
  if (days?.length && !days.includes(day)) return false;
  if (from && time < from) return false;
  if (until && time > until) return false;
  return true;
}

type AvailabilityProduct = Pick<
  Product,
  'name' | 'isActive' | 'soldOutToday' | 'productType' | 'availableDays' | 'availableFrom' | 'availableUntil'
>;

/**
 * A food item is available when: the item itself isn't sold out, its parent
 * menu (if any) isn't manually switched off and isn't outside its own
 * auto-schedule window, and the item's own window (if set) also matches —
 * the item's window narrows the menu's window, it never widens it.
 */
export function isItemAvailableNow(
  menu: Menu | null,
  product: AvailabilityProduct,
  at: Date = new Date(),
): { available: boolean; reason?: string } {
  if (!product.isActive) return { available: false, reason: `${product.name} is not available` };
  if (product.soldOutToday) return { available: false, reason: `${product.name} is sold out today` };
  if (product.productType !== 'food') return { available: true };

  const { day, time } = campusDayAndTime(at);

  if (menu) {
    if (!menu.isAvailable) {
      return { available: false, reason: `${menu.title} is currently unavailable` };
    }
    if (menu.autoSchedule && !withinWindow(menu.availableDays, menu.availableFrom, menu.availableUntil, day, time)) {
      return { available: false, reason: `${menu.title} is not being served at the selected time` };
    }
  }

  if (!withinWindow(product.availableDays, product.availableFrom, product.availableUntil, day, time)) {
    return { available: false, reason: `${product.name} is not available at the selected time` };
  }

  return { available: true };
}
