/* ---------- Users and roles ---------- */
/** Roles match the backend user model: one "user" account can both buy and sell */
export type UserRole = 'admin' | 'user';
export type UserStatus = 'pending' | 'active' | 'suspended';
/** Sellers can post ads once an admin approves the account; buyers browse, save and chat */
export type AccountType = 'buyer' | 'seller';

export interface User {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: UserRole;
  accountType: AccountType;
  status: UserStatus;
  isEmailVerified: boolean;
  city: string | null;
  avatarUrl: string | null;
  createdAt: string;
}

export interface AuthSession {
  accessToken: string;
  /** Needed by POST /auth/logout to revoke this device's session */
  sessionId: string | null;
  user: User;
}

export interface RegisterPayload {
  name: string;
  email: string;
  password: string;
  phone?: string;
  accountType: AccountType;
}

/* ---------- Categories ---------- */
export const CATEGORY_ICON_KEYS = [
  'car', 'motorcycle', 'parts', 'property', 'land', 'store', 'electronics', 'phone', 'laptop', 'tv', 'camera',
  'gaming', 'furniture', 'sofa', 'bed', 'kitchen', 'decor', 'services', 'cleaning', 'truck', 'tools', 'education', 'tag',
] as const;
export type CategoryIconKey = (typeof CATEGORY_ICON_KEYS)[number];

export interface CategoryField {
  fieldKey: string;
  label: string;
  inputType: 'text' | 'number' | 'select';
  required: boolean;
  filterable: boolean;
  options?: string[];
  unit?: string;
  min?: number;
  max?: number;
}

/** One node of the category tree, as the public API returns it (fields and types already inherited) */
export interface Category {
  id: string;
  name: string;
  slug: string;
  parentId: string | null;
  depth: number;
  /** Ids from the top-level category down to this one */
  path: string[];
  icon: CategoryIconKey;
  description: string;
  /** Only final categories (without subcategories) can hold ads */
  isLeaf: boolean;
  listingTypes: ListingType[];
  fields: CategoryField[];
  /** Live ads in this category and everything below it */
  listingCount: number;
}

/** Admin view of a category: own settings separate from what it inherits */
export interface AdminCategory {
  id: string;
  name: string;
  slug: string;
  parentId: string | null;
  depth: number;
  path: string[];
  description: string;
  icon: CategoryIconKey | null;
  effectiveIcon: CategoryIconKey;
  listingTypes: ListingType[];
  effectiveListingTypes: ListingType[];
  fields: CategoryField[];
  inheritedFields: CategoryField[];
  isActive: boolean;
  /** False when this category or one above it is hidden */
  isVisible: boolean;
  isLeaf: boolean;
  childCount: number;
  directListings: number;
  liveListings: number;
}

export interface CategoryPayload {
  name?: string;
  slug?: string;
  parentId?: string | null;
  description?: string;
  icon?: CategoryIconKey | null;
  listingTypes?: ListingType[];
  fields?: CategoryField[];
  isActive?: boolean;
}

/* ---------- Listings ---------- */
export type ListingStatus =
  | 'draft'
  | 'pending_review'
  | 'published'
  | 'changes_required'
  | 'rejected'
  | 'hidden'
  | 'withdrawn'
  | 'expired';

export type ListingAvailability = 'available' | 'sold' | 'rented';
export type ListingType = 'sale' | 'rent' | 'service';

export interface ListingPhoto {
  id: string;
  url: string;
  position: number;
}

export interface SellerSummary {
  id: string;
  name: string;
  avatarUrl: string | null;
  city: string | null;
  memberSince: string;
  phoneVerified: boolean;
  activeListings: number;
}

export interface Listing {
  id: string;
  sellerId: string;
  seller: SellerSummary;
  categoryId: string;
  categorySlug: string;
  categoryName: string;
  categoryIcon: CategoryIconKey;
  /** Breadcrumb from the top-level category down to the ad's category */
  categoryTrail: { id: string; name: string; slug: string }[];
  listingType: ListingType;
  title: string;
  description: string;
  price: number;
  currency: 'SAR';
  city: string;
  district: string;
  attributes: Record<string, string | number>;
  status: ListingStatus;
  availability: ListingAvailability;
  photos: ListingPhoto[];
  views: number;
  moderationNote: string | null;
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
  /** A live ad goes offline at this time unless the seller renews it */
  expiresAt: string | null;
  /** Set while an admin promotion is running: shown first in search with a "Featured" label */
  featuredUntil: string | null;
}

export interface ListingDraftPayload {
  categoryId: string;
  listingType: ListingType;
  title: string;
  description: string;
  price: number;
  city: string;
  district: string;
  attributes: Record<string, string | number>;
}

/** newest = featured first, then newest; latest = newest only */
export type ListingSort = 'newest' | 'latest' | 'price_asc' | 'price_desc';

export interface ListingSearchParams {
  q?: string;
  /** Only this seller's live ads (seller profile page) */
  seller?: string;
  /** Only ads with a running promotion */
  featured?: 'true';
  /** Category detail filters: f_<key> for lists, f_<key>_min / f_<key>_max for numbers */
  [filterKey: `f_${string}`]: string | undefined;
  city?: string;
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  sort?: ListingSort;
  page?: number;
  pageSize?: number;
}

export interface Paginated<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

/* ---------- Messaging ---------- */
export interface Conversation {
  id: string;
  /** The viewer's side of the deal */
  role: 'buyer' | 'seller';
  listingId: string;
  listingTitle: string;
  listingPrice: number;
  listingPhotoUrl: string | null;
  listingCategoryIcon: CategoryIconKey;
  listingAvailable: boolean;
  counterpart: { id: string; name: string; avatarUrl: string | null };
  lastMessage: string;
  lastMessageAt: string;
  lastMessageMine: boolean;
  unreadCount: number;
  /** Messages sent before this time have been read by the other person */
  counterpartLastReadAt: string | null;
  blockedByMe: boolean;
  blockedByThem: boolean;
}

export type MessageType = 'text' | 'image' | 'voice';

export interface MessageAttachment {
  /** Signed link that expires after an hour; reload the conversation for a fresh one */
  url: string;
  mime: string;
  size: number;
  width: number | null;
  height: number | null;
  duration: number | null;
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  type: MessageType;
  body: string;
  attachment: MessageAttachment | null;
  deleted: boolean;
  createdAt: string;
}

export interface MessagePage {
  items: Message[];
  hasMore: boolean;
}

/* ---------- Saved items and notifications ---------- */
export interface SavedSearch {
  id: string;
  label: string;
  criteria: ListingSearchParams;
  /** Notify me when a newly approved ad matches */
  alertsEnabled: boolean;
  createdAt: string;
}

export type NotificationType =
  | 'listing_approved'
  | 'changes_required'
  | 'listing_rejected'
  | 'new_message'
  | 'report_update'
  | 'system'
  | 'saved_search_match'
  | 'price_drop'
  | 'listing_expiring'
  | 'listing_expired'
  | 'listing_featured';

export interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  link: string | null;
  read: boolean;
  createdAt: string;
}

/* ---------- Moderation ---------- */
export type ReportStatus = 'open' | 'reviewing' | 'resolved' | 'dismissed';

export const REPORT_REASONS = [
  'Prohibited item',
  'Scam or fraud',
  'Wrong category',
  'Duplicate ad',
  'Misleading price or details',
  'Offensive content',
  'Other',
] as const;

export type ReportReason = (typeof REPORT_REASONS)[number];

export interface ListingReport {
  id: string;
  listingId: string;
  listingTitle: string;
  reporter: { id: string; name: string };
  reason: ReportReason;
  details: string | null;
  status: ReportStatus;
  createdAt: string;
}

/* ---------- Dashboards ---------- */
export interface KpiMetric {
  key: string;
  label: string;
  value: number;
  previousValue: number;
  format: 'number' | 'currency' | 'percent';
}

export interface TimePoint {
  date: string;
  value: number;
}

export interface CategoryCount {
  slug: string;
  name: string;
  count: number;
}

export interface WeekdayCount {
  day: string;
  value: number;
}

export interface AdminDashboard {
  kpis: KpiMetric[];
  listingsTrend: TimePoint[];
  approvalsTrend: TimePoint[];
  categoryBreakdown: CategoryCount[];
  activityByWeekday: WeekdayCount[];
  approvalRate: number;
  pendingQueue: Listing[];
  recentReports: ListingReport[];
}

export interface StatusCount {
  status: ListingStatus;
  count: number;
}

export interface DailyEngagement {
  date: string;
  views: number;
  messages: number;
}

/** One dashboard for a "user" account: the ads they sell and the ads they follow */
export interface UserDashboard {
  kpis: KpiMetric[];
  engagement: DailyEngagement[];
  adsByStatus: StatusCount[];
  responseRate: number;
  myListings: Listing[];
  actionRequired: Listing[];
  recentConversations: Conversation[];
  savedListings: Listing[];
}

export type ModerationAction =
  | 'listing_approved'
  | 'listing_changes_requested'
  | 'listing_rejected'
  | 'listing_hidden'
  | 'seller_approved'
  | 'user_suspended'
  | 'user_reactivated'
  | 'listing_featured'
  | 'listing_unfeatured';

export interface ModerationLogEntry {
  id: string;
  action: ModerationAction;
  admin: { id: string; name: string } | null;
  listing: { id: string; title: string } | null;
  user: { id: string; name: string; email: string } | null;
  reason: string | null;
  previousStatus: string;
  newStatus: string;
  createdAt: string;
}

/* ---------- Site settings ---------- */
export type LegalPageSlug = 'help' | 'safety' | 'terms' | 'privacy';
export type SocialNetwork = 'x' | 'instagram' | 'facebook' | 'tiktok' | 'youtube';

export interface SiteContact {
  email: string;
  phone: string;
  hours: string;
  city: string;
}

/** What every visitor gets; an admin changes these without a deploy */
export interface SiteSettings {
  contact: SiteContact;
  social: Record<SocialNetwork, string>;
  announcement: { text: string; tone: 'info' | 'warning'; link: string | null } | null;
  listings: { maxPhotos: number; expiryDays: number };
}

export interface LegalPage {
  slug: LegalPageSlug;
  title: string;
  /** Light formatting: "## " headings, "- " list items and **bold** */
  body: string;
  updatedAt: string;
}

export interface AdminSettings {
  contact: SiteContact;
  social: Record<SocialNetwork, string>;
  announcement: { enabled: boolean; text: string; tone: 'info' | 'warning'; link: string };
  listings: { maxPhotos: number; expiryDays: number };
  pages: Record<LegalPageSlug, Omit<LegalPage, 'slug'>>;
  updatedAt: string;
}
