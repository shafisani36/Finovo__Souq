/**
 * Product-level settings in one place.
 * Values marked "proposed" are waiting for team lead approval (see Technical Plan section 16.1).
 */
export const APP_NAME = 'Finovo Souq';
export const CURRENCY = 'SAR';
export const DEFAULT_LOCALE = 'en-SA';

export const SAUDI_CITIES = [
  'Riyadh',
  'Jeddah',
  'Mecca',
  'Medina',
  'Dammam',
  'Khobar',
  'Taif',
  'Abha',
  'Tabuk',
  'Buraidah',
] as const;

/** Proposed upload limits - confirm before launch */
export const LISTING_PHOTO_LIMITS = {
  maxCount: 10,
  maxSizeBytes: 5 * 1024 * 1024,
  acceptedTypes: ['image/jpeg', 'image/png', 'image/webp'],
} as const;

/** Proposed pagination default */
export const DEFAULT_PAGE_SIZE = 12;


/** Support contact details shown on the Contact page - proposed, confirm before launch */
export const SUPPORT_CONTACT = {
  email: 'support@finovosouq.com',
  hours: 'Sunday to Thursday, 9:00 to 18:00 (Riyadh time)',
  city: 'Riyadh, Saudi Arabia',
} as const;
