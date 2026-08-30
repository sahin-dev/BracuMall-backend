/**
 * Hard cap for list endpoints that don't accept pagination params from the
 * client yet. Prevents an unbounded `findMany` from returning the entire
 * collection once a table grows large; callers still get the most recent
 * records first as long as the query orders by `createdAt: 'desc'`.
 */
export const MAX_LIST_SIZE = 200;
