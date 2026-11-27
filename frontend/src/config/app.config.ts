/**
 * Product-level settings in one place.
 * Values marked "proposed" are waiting for team lead approval (see Technical Plan section 16.1).
 */
export const APP_NAME = 'Finovo Souq';
export const CURRENCY = 'SAR';

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

/** Photo file rules (the server allows up to 8 MB); how many photos an ad may have is set by admins in Settings */
export const LISTING_PHOTO_LIMITS = {
  maxSizeBytes: 8 * 1024 * 1024,
  acceptedTypes: ['image/jpeg', 'image/png', 'image/webp'],
} as const;

/** Proposed pagination default */
export const DEFAULT_PAGE_SIZE = 12;


