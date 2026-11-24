/* ---------- Users and roles ---------- */
/** Roles match the backend user model: one "user" account can both buy and sell */
export type UserRole = 'admin' | 'user';
export type UserStatus = 'active' | 'suspended';

export interface User {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: UserRole;
  status: UserStatus;
  isEmailVerified: boolean;
  /** Not stored by the auth service yet; kept for the profile and listing screens */
  city: string | null;
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
}

/* ---------- Categories ---------- */
export type CategoryIconKey = 'car' | 'property' | 'electronics' | 'furniture' | 'services';

export interface CategoryField {
  fieldKey: string;
  label: string;
  inputType: 'text' | 'number' | 'select';
  required: boolean;
  filterable: boolean;
  options?: string[];
  unit?: string;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  icon: CategoryIconKey;
  description: string;
  fields: CategoryField[];
  listingCount: number;
}

/* ---------- Listings ---------- */
export type ListingStatus =
  | 'draft'
  | 'pending_review'
  | 'published'
  | 'changes_required'
  | 'rejected'
  | 'hidden'
  | 'withdrawn';

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

export type ListingSort = 'newest' | 'price_asc' | 'price_desc';

export interface ListingSearchParams {
  q?: string;
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
  listingId: string;
  listingTitle: string;
  listingPrice: number;
  counterpart: { id: string; name: string };
  lastMessage: string;
  lastMessageAt: string;
  unreadCount: number;
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  body: string;
  createdAt: string;
}

/* ---------- Saved items and notifications ---------- */
export interface SavedSearch {
  id: string;
  label: string;
  criteria: ListingSearchParams;
  createdAt: string;
}

export type NotificationType =
  | 'listing_approved'
  | 'changes_required'
  | 'listing_rejected'
  | 'new_message'
  | 'report_update'
  | 'system';

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

export type ModerationAction = 'approve' | 'request_changes' | 'reject' | 'hide';

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
