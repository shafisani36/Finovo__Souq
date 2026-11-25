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
  /** The viewer's side of the deal */
  role: 'buyer' | 'seller';
  listingId: string;
  listingTitle: string;
  listingPrice: number;
  listingPhotoUrl: string | null;
  listingCategorySlug: string;
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
