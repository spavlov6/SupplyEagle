import type { SupplierEvent } from '@supplyeagle/types';

export const SUPPLIER_EVENTS_CHANNEL = 'supplyeagle:supplier-events';

export function userRoom(userId: string): string {
  return `user:${userId}`;
}

export function parseSupplierEvent(message: string): SupplierEvent | null {
  try {
    const value: unknown = JSON.parse(message);
    if (!isRecord(value)) {
      return null;
    }

    const type = value.type;
    const userId = value.userId;
    const supplierId = value.supplierId;
    if (
      (type === 'supplier.created' ||
        type === 'supplier.reassess' ||
        type === 'analysis.updated') &&
      typeof userId === 'string' &&
      typeof supplierId === 'string'
    ) {
      return { type, userId, supplierId };
    }
  } catch {
    return null;
  }

  return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
