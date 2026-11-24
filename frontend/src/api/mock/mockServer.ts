/**
 * In-browser mock of the Finovo Souq REST API (Technical Plan section 8).
 * It applies the same role, ownership and visibility rules the Express API must enforce,
 * so frontend flows behave the same once the real backend is connected.
 */
import { ApiError } from '../errors';
import type {
  AdminDashboard,
  AppNotification,
  AuthSession,
  Conversation,
  KpiMetric,
  Listing,
  ListingDraftPayload,
  ListingPhoto,
  ListingReport,
  ListingSearchParams,
  Message,
  Paginated,
  ReportReason,
  ReportStatus,
  SavedSearch,
  UserDashboard,
  StatusCount,
  ListingStatus,
  TimePoint,
  User,
  UserRole,
} from '../../types';
import {
  buildSeedListings,
  daysAgo,
  seedCategories,
  seedConversations,
  seedMessages,
  seedNotifications,
  seedReports,
  seedSavedListings,
  seedSavedSearches,
  seedUsers,
  type MockConversation,
  type MockReport,
  type MockUser,
} from './mockData';

interface MockRequest {
  method: string;
  body?: unknown;
  params?: Record<string, string | number | boolean | null | undefined>;
  token: string | null;
  /** Signed-in user from the real backend, used when only the pending endpoints are mocked */
  sessionUser?: User | null;
}

type Handler = (ctx: { req: MockRequest; params: Record<string, string>; body: Record<string, unknown> }) => unknown;

/* ---------- In-memory database ---------- */
const db = {
  users: seedUsers.map((u) => ({ ...u })),
  categories: seedCategories.map((c) => ({ ...c })),
  listings: [] as Listing[],
  conversations: seedConversations.map((c) => ({ ...c, lastReadAt: { ...c.lastReadAt } })) as MockConversation[],
  messages: [...seedMessages],
  savedListings: [...seedSavedListings],
  savedSearches: [...seedSavedSearches],
  notifications: seedNotifications.map((n) => ({ ...n })),
  reports: [...seedReports] as MockReport[],
};
db.listings = buildSeedListings(db.users, db.categories);

let idCounter = 9000;
const nextId = (prefix: string) => `${prefix}_${++idCounter}`;
const nowIso = () => new Date().toISOString();

/* ---------- Helpers ---------- */
const publicUser = (u: MockUser): User => {
  const { password: _password, ...rest } = u;
  void _password;
  return rest;
};

const isPublic = (l: Listing) => l.status === 'published' && l.availability === 'available';

function hydrateListing(l: Listing): Listing {
  const activeListings = db.listings.filter((x) => x.sellerId === l.sellerId && isPublic(x)).length;
  return { ...l, seller: { ...l.seller, activeListings } };
}

function paginate<T>(items: T[], page = 1, pageSize = 12): Paginated<T> {
  const safeSize = Math.min(Math.max(pageSize, 1), 50);
  const totalPages = Math.max(1, Math.ceil(items.length / safeSize));
  const safePage = Math.min(Math.max(page, 1), totalPages);
  return {
    items: items.slice((safePage - 1) * safeSize, safePage * safeSize),
    page: safePage,
    pageSize: safeSize,
    total: items.length,
    totalPages,
  };
}

function currentUser(req: MockRequest): MockUser | null {
  if (!req.token) return null;
  if (req.token.startsWith('mock-token.')) {
    const id = req.token.slice('mock-token.'.length);
    const found = db.users.find((u) => u.id === id);
    return found && found.status !== 'suspended' ? found : null;
  }
  // A real backend token: mirror that account so the mocked screens have someone to work for
  const real = req.sessionUser;
  if (!real?.id) return null;
  let mirrored = db.users.find((u) => u.id === real.id);
  if (!mirrored) {
    mirrored = { ...real, password: '' };
    db.users.push(mirrored);
  } else {
    Object.assign(mirrored, { name: real.name, email: real.email, role: real.role, status: real.status });
  }
  return mirrored.status !== 'suspended' ? mirrored : null;
}

function requireUser(req: MockRequest, roles?: UserRole[]): MockUser {
  const u = currentUser(req);
  if (!u) throw new ApiError('Your session has ended. Please sign in again.', 401, 'UNAUTHENTICATED');
  if (roles && !roles.includes(u.role)) throw new ApiError('You do not have permission to do this.', 403, 'FORBIDDEN');
  return u;
}

function findListing(id: string): Listing {
  const l = db.listings.find((x) => x.id === id);
  if (!l) throw new ApiError('This ad could not be found.', 404, 'NOT_FOUND');
  return l;
}

function requireOwnedListing(req: MockRequest, id: string): Listing {
  const u = requireUser(req, ['user']);
  const l = findListing(id);
  if (l.sellerId !== u.id) throw new ApiError('This ad could not be found.', 404, 'NOT_FOUND');
  return l;
}

function notify(userId: string, n: Omit<AppNotification, 'id' | 'read' | 'createdAt'>) {
  db.notifications.unshift({ ...n, id: nextId('ntf'), userId, read: false, createdAt: nowIso() });
}

function session(u: MockUser): AuthSession {
  return { accessToken: `mock-token.${u.id}`, sessionId: `mock-session.${u.id}`, user: publicUser(u) };
}

function validationError(fields: Record<string, string>): never {
  throw new ApiError('Please check the highlighted fields.', 422, 'VALIDATION_ERROR', fields);
}

function str(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function conversationView(c: MockConversation, viewerId: string): Conversation {
  const listing = findListing(c.listingId);
  const counterpartId = c.participantIds.find((p) => p !== viewerId)!;
  const counterpart = db.users.find((u) => u.id === counterpartId)!;
  const msgs = db.messages.filter((m) => m.conversationId === c.id);
  const last = msgs[msgs.length - 1];
  const lastRead = c.lastReadAt[viewerId] ?? c.createdAt;
  return {
    id: c.id,
    listingId: c.listingId,
    listingTitle: listing.title,
    listingPrice: listing.price,
    counterpart: { id: counterpart.id, name: counterpart.name },
    lastMessage: last?.body ?? '',
    lastMessageAt: last?.createdAt ?? c.createdAt,
    unreadCount: msgs.filter((m) => m.senderId !== viewerId && m.createdAt > lastRead).length,
  };
}

function conversationsFor(userId: string): Conversation[] {
  return db.conversations
    .filter((c) => c.participantIds.includes(userId))
    .map((c) => conversationView(c, userId))
    .sort((a, b) => b.lastMessageAt.localeCompare(a.lastMessageAt));
}

function reportView(r: MockReport): ListingReport {
  const listing = db.listings.find((l) => l.id === r.listingId);
  const reporter = db.users.find((u) => u.id === r.reporterId);
  return {
    id: r.id,
    listingId: r.listingId,
    listingTitle: listing?.title ?? 'Deleted ad',
    reporter: { id: r.reporterId, name: reporter?.name ?? 'Unknown user' },
    reason: r.reason,
    details: r.details,
    status: r.status,
    createdAt: r.createdAt,
  };
}

/** Deterministic pseudo-random series so charts look the same on every reload */
function series(days: number, base: number, spread: number, seed: number): TimePoint[] {
  const points: TimePoint[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const wave = Math.sin((i + seed) / 3.1) * spread + Math.cos((i * seed) / 7.3) * (spread / 2);
    const trend = ((days - i) / days) * spread * 0.8;
    points.push({ date: daysAgo(i).slice(0, 10), value: Math.max(0, Math.round(base + wave + trend)) });
  }
  return points;
}

function kpi(key: string, label: string, value: number, previousValue: number, format: KpiMetric['format'] = 'number'): KpiMetric {
  return { key, label, value, previousValue, format };
}

function rangeDays(value: unknown): number {
  return value === '7d' ? 7 : value === '90d' ? 90 : 30;
}

function applySearch(params: ListingSearchParams): Listing[] {
  const q = (params.q ?? '').toString().trim().toLowerCase();
  let items = db.listings.filter(isPublic);
  if (q) items = items.filter((l) => `${l.title} ${l.description} ${Object.values(l.attributes).join(' ')}`.toLowerCase().includes(q));
  if (params.city) items = items.filter((l) => l.city === params.city);
  if (params.category) items = items.filter((l) => l.categorySlug === params.category);
  if (params.minPrice) items = items.filter((l) => l.price >= Number(params.minPrice));
  if (params.maxPrice) items = items.filter((l) => l.price <= Number(params.maxPrice));
  const sorted = [...items];
  if (params.sort === 'price_asc') sorted.sort((a, b) => a.price - b.price);
  else if (params.sort === 'price_desc') sorted.sort((a, b) => b.price - a.price);
  else sorted.sort((a, b) => (b.publishedAt ?? '').localeCompare(a.publishedAt ?? ''));
  return sorted.map(hydrateListing);
}

function validateDraft(body: Record<string, unknown>): ListingDraftPayload {
  const errors: Record<string, string> = {};
  const category = db.categories.find((c) => c.id === body.categoryId);
  if (!category) errors.categoryId = 'Choose a category.';
  const title = str(body.title);
  if (title.length < 10 || title.length > 90) errors.title = 'Title must be 10 to 90 characters.';
  const description = str(body.description);
  if (description.length < 30) errors.description = 'Description must be at least 30 characters.';
  const price = Number(body.price);
  if (!Number.isFinite(price) || price <= 0) errors.price = 'Enter a price greater than 0.';
  if (!str(body.city)) errors.city = 'Choose a city.';
  if (!str(body.district)) errors.district = 'Enter the district.';
  const attributes = (body.attributes ?? {}) as Record<string, string | number>;
  category?.fields.forEach((f) => {
    if (f.required && (attributes[f.fieldKey] === undefined || attributes[f.fieldKey] === '')) errors[`attributes.${f.fieldKey}`] = `${f.label} is required.`;
  });
  if (Object.keys(errors).length) validationError(errors);
  return {
    categoryId: category!.id,
    listingType: (body.listingType as ListingDraftPayload['listingType']) ?? 'sale',
    title,
    description,
    price,
    city: str(body.city),
    district: str(body.district),
    attributes,
  };
}

/* ---------- Routes ---------- */
const routes: [string, string, Handler][] = [
  /* Auth */
  ['POST', '/auth/login', ({ body }) => {
    const email = str(body.email).toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) validationError({ email: 'Please provide a valid email address.' });
    const found = db.users.find((u) => u.email.toLowerCase() === email);
    if (!found || found.password !== body.password) throw new ApiError('Invalid email or password', 401, 'UNAUTHENTICATED');
    if (found.status === 'suspended') throw new ApiError('Your account is suspended', 403, 'FORBIDDEN');
    return session(found);
  }],
  ['POST', '/auth/register', ({ body }) => {
    const errors: Record<string, string> = {};
    const name = str(body.name);
    const email = str(body.email).toLowerCase();
    const password = typeof body.password === 'string' ? body.password : '';
    if (name.length < 2) errors.name = 'Name must contain at least 2 characters.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = 'Please provide a valid email address.';
    if (password.length < 8 || !/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password) || !/[^A-Za-z0-9]/.test(password)) {
      errors.password = 'Password does not meet the rules.';
    }
    if (Object.keys(errors).length) validationError(errors);
    if (db.users.some((u) => u.email.toLowerCase() === email)) throw new ApiError('Email is already registered', 409, 'CONFLICT');
    const created: MockUser = {
      id: nextId('u'),
      name,
      email,
      phone: str(body.phone) || null,
      role: 'user',
      status: 'active',
      isEmailVerified: false,
      city: null,
      createdAt: nowIso(),
      password,
    };
    db.users.push(created);
    return session(created);
  }],
  ['GET', '/auth/me', ({ req }) => {
    const u = requireUser(req);
    return { user: { id: u.id, role: u.role } };
  }],
  ['POST', '/auth/password/forgot', () => undefined],
  ['POST', '/auth/logout', () => undefined],
  ['POST', '/auth/logout-all', () => undefined],

  /* Support (proposed) */
  ['POST', '/support/messages', ({ body }) => {
    const errors: Record<string, string> = {};
    if (str(body.name).length < 2) errors.name = 'Enter your name.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(str(body.email))) errors.email = 'Enter a valid email address.';
    if (!str(body.topic)) errors.topic = 'Choose a topic.';
    if (str(body.message).length < 20) errors.message = 'Write at least 20 characters.';
    if (Object.keys(errors).length) validationError(errors);
    return { id: nextId('sup'), receivedAt: nowIso() };
  }],

  /* Current user */
  ['GET', '/users/me', ({ req }) => publicUser(requireUser(req))],
  ['PATCH', '/users/me', ({ req, body }) => {
    const u = requireUser(req);
    const name = str(body.name);
    if (body.name !== undefined && name.length < 2) validationError({ name: 'Enter your full name.' });
    if (body.name !== undefined) u.name = name;
    if (body.phone !== undefined) u.phone = str(body.phone) || null;
    if (body.city !== undefined) u.city = str(body.city) || null;
    return publicUser(u);
  }],
  ['POST', '/users/me/deletion-request', ({ req }) => {
    requireUser(req, ['user']);
    return undefined;
  }],

  /* Categories */
  ['GET', '/categories', () =>
    db.categories.map((c) => ({ ...c, listingCount: db.listings.filter((l) => l.categoryId === c.id && isPublic(l)).length })),
  ],

  /* Search and listings */
  ['GET', '/search/listings', ({ req }) => {
    const p = (req.params ?? {}) as ListingSearchParams;
    return paginate(applySearch(p), Number(p.page) || 1, Number(p.pageSize) || 12);
  }],
  ['GET', '/listings/mine', ({ req }) => {
    const u = requireUser(req, ['user']);
    const status = req.params?.status;
    const items = db.listings
      .filter((l) => l.sellerId === u.id && (!status || status === 'all' || l.status === status))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .map(hydrateListing);
    return paginate(items, Number(req.params?.page) || 1, 20);
  }],
  ['GET', '/listings/:id', ({ req, params }) => {
    const l = findListing(params.id);
    const u = currentUser(req);
    const canSeePrivate = u && (u.role === 'admin' || u.id === l.sellerId);
    // Sold or rented ads stay viewable by link, but only approved ads are ever public
    if (l.status !== 'published' && !canSeePrivate) throw new ApiError('This ad could not be found.', 404, 'NOT_FOUND');
    if (!canSeePrivate) l.views += 1;
    return hydrateListing(l);
  }],
  ['POST', '/listings', ({ req, body }) => {
    const u = requireUser(req, ['user']);
    const data = validateDraft(body);
    const category = db.categories.find((c) => c.id === data.categoryId)!;
    const created: Listing = {
      id: nextId('lst'),
      sellerId: u.id,
      seller: { id: u.id, name: u.name, city: u.city, memberSince: u.createdAt, phoneVerified: Boolean(u.phone), activeListings: 0 },
      ...data,
      categorySlug: category.slug,
      categoryName: category.name,
      currency: 'SAR',
      status: 'draft',
      availability: 'available',
      photos: [],
      views: 0,
      moderationNote: null,
      createdAt: nowIso(),
      updatedAt: nowIso(),
      publishedAt: null,
    };
    db.listings.unshift(created);
    return created;
  }],
  ['PATCH', '/listings/:id', ({ req, params, body }) => {
    const l = requireOwnedListing(req, params.id);
    const data = validateDraft({ ...l, ...body });
    Object.assign(l, data, { updatedAt: nowIso() });
    // Material edits to a live ad send it back for review
    if (l.status === 'published') l.status = 'pending_review';
    return hydrateListing(l);
  }],
  ['POST', '/listings/:id/photos', ({ req, params }) => {
    const l = requireOwnedListing(req, params.id);
    const form = req.body instanceof FormData ? req.body : null;
    const files = (form?.getAll('photos') ?? []).filter((f): f is File => f instanceof File);
    if (!files.length) validationError({ photos: 'Add at least one photo.' });
    if (l.photos.length + files.length > 10) validationError({ photos: 'You can add up to 10 photos.' });
    const added: ListingPhoto[] = files.map((file, index) => ({
      id: nextId('pho'),
      url: URL.createObjectURL(file),
      position: l.photos.length + index,
    }));
    l.photos.push(...added);
    return added;
  }],
  ['POST', '/listings/:id/submit', ({ req, params }) => {
    const l = requireOwnedListing(req, params.id);
    if (!['draft', 'changes_required'].includes(l.status)) throw new ApiError('Only drafts or ads needing changes can be submitted.', 409, 'INVALID_STATUS');
    l.status = 'pending_review';
    l.moderationNote = null;
    l.updatedAt = nowIso();
    return hydrateListing(l);
  }],
  ['POST', '/listings/:id/withdraw', ({ req, params }) => {
    const l = requireOwnedListing(req, params.id);
    if (['withdrawn', 'hidden', 'rejected'].includes(l.status)) throw new ApiError('This ad cannot be withdrawn.', 409, 'INVALID_STATUS');
    l.status = 'withdrawn';
    l.updatedAt = nowIso();
    return hydrateListing(l);
  }],
  ['PATCH', '/listings/:id/availability', ({ req, params, body }) => {
    const l = requireOwnedListing(req, params.id);
    if (l.status !== 'published') throw new ApiError('Only live ads can be marked as sold or rented.', 409, 'INVALID_STATUS');
    const availability = body.availability;
    if (availability !== 'available' && availability !== 'sold' && availability !== 'rented') validationError({ availability: 'Choose a valid option.' });
    if (availability === 'rented' && l.listingType !== 'rent') validationError({ availability: 'Only rental ads can be marked as rented.' });
    l.availability = availability as Listing['availability'];
    l.updatedAt = nowIso();
    return hydrateListing(l);
  }],
  ['POST', '/listings/:id/reports', ({ req, params, body }) => {
    const u = requireUser(req, ['user']);
    const l = findListing(params.id);
    if (l.sellerId === u.id) throw new ApiError('You cannot report your own ad.', 409, 'OWN_LISTING');
    if (!str(body.reason)) validationError({ reason: 'Choose a reason.' });
    const created: MockReport = {
      id: nextId('rep'),
      listingId: l.id,
      reporterId: u.id,
      reason: body.reason as ReportReason,
      details: str(body.details) || null,
      status: 'open',
      createdAt: nowIso(),
    };
    db.reports.unshift(created);
    return reportView(created);
  }],

  /* Saved listings and searches */
  ['GET', '/users/me/saved-listings', ({ req }) => {
    const u = requireUser(req, ['user']);
    return db.savedListings
      .filter((s) => s.userId === u.id)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((s) => db.listings.find((l) => l.id === s.listingId))
      .filter((l): l is Listing => Boolean(l && l.status === 'published'))
      .map(hydrateListing);
  }],
  ['POST', '/users/me/saved-listings/:listingId', ({ req, params }) => {
    const u = requireUser(req, ['user']);
    const l = findListing(params.listingId);
    if (!isPublic(l)) throw new ApiError('This ad is no longer available.', 409, 'NOT_AVAILABLE');
    if (!db.savedListings.some((s) => s.userId === u.id && s.listingId === l.id)) {
      db.savedListings.push({ userId: u.id, listingId: l.id, createdAt: nowIso() });
    }
    return undefined;
  }],
  ['DELETE', '/users/me/saved-listings/:listingId', ({ req, params }) => {
    const u = requireUser(req, ['user']);
    db.savedListings = db.savedListings.filter((s) => !(s.userId === u.id && s.listingId === params.listingId));
    return undefined;
  }],
  ['GET', '/users/me/saved-searches', ({ req }) => {
    const u = requireUser(req, ['user']);
    return db.savedSearches.filter((s) => s.userId === u.id).map(({ userId: _userId, ...s }) => s);
  }],
  ['POST', '/users/me/saved-searches', ({ req, body }) => {
    const u = requireUser(req, ['user']);
    const label = str(body.label);
    if (!label) validationError({ label: 'Give this search a name.' });
    if (db.savedSearches.filter((s) => s.userId === u.id).length >= 20) throw new ApiError('You can keep up to 20 saved searches.', 409, 'LIMIT_REACHED');
    const created = { id: nextId('ss'), userId: u.id, label, criteria: (body.criteria ?? {}) as ListingSearchParams, createdAt: nowIso() };
    db.savedSearches.unshift(created);
    const { userId: _userId, ...rest } = created;
    return rest as SavedSearch;
  }],
  ['DELETE', '/users/me/saved-searches/:id', ({ req, params }) => {
    const u = requireUser(req, ['user']);
    db.savedSearches = db.savedSearches.filter((s) => !(s.userId === u.id && s.id === params.id));
    return undefined;
  }],

  /* Conversations */
  ['GET', '/conversations', ({ req }) => conversationsFor(requireUser(req, ['user']).id)],
  ['POST', '/conversations', ({ req, body }) => {
    const u = requireUser(req, ['user']);
    const l = findListing(str(body.listingId));
    if (l.sellerId === u.id) throw new ApiError('You cannot message yourself about your own ad.', 409, 'OWN_LISTING');
    if (!isPublic(l)) throw new ApiError('This ad is no longer available.', 409, 'NOT_AVAILABLE');
    let conv = db.conversations.find((c) => c.listingId === l.id && c.participantIds.includes(u.id));
    if (!conv) {
      conv = { id: nextId('cnv'), listingId: l.id, participantIds: [u.id, l.sellerId], createdAt: nowIso(), lastMessageAt: nowIso(), lastReadAt: {} };
      db.conversations.unshift(conv);
    }
    return conversationView(conv, u.id);
  }],
  ['GET', '/conversations/:id/messages', ({ req, params }) => {
    const u = requireUser(req, ['user']);
    const conv = db.conversations.find((c) => c.id === params.id);
    // Participants only; anyone else gets "not found" so conversation ids are not leaked
    if (!conv || !conv.participantIds.includes(u.id)) throw new ApiError('Conversation not found.', 404, 'NOT_FOUND');
    conv.lastReadAt[u.id] = nowIso();
    return db.messages.filter((m) => m.conversationId === conv.id);
  }],
  ['POST', '/conversations/:id/messages', ({ req, params, body }) => {
    const u = requireUser(req, ['user']);
    const conv = db.conversations.find((c) => c.id === params.id);
    if (!conv || !conv.participantIds.includes(u.id)) throw new ApiError('Conversation not found.', 404, 'NOT_FOUND');
    const text = str(body.body);
    if (!text) validationError({ body: 'Write a message.' });
    if (text.length > 2000) validationError({ body: 'Messages can be up to 2000 characters.' });
    const msg: Message = { id: nextId('msg'), conversationId: conv.id, senderId: u.id, body: text, createdAt: nowIso() };
    db.messages.push(msg);
    conv.lastMessageAt = msg.createdAt;
    conv.lastReadAt[u.id] = msg.createdAt;
    const recipient = conv.participantIds.find((p) => p !== u.id)!;
    const recipientRole = db.users.find((x) => x.id === recipient)?.role ?? 'user';
    notify(recipient, { type: 'new_message', title: 'New message', body: `${u.name} sent you a message.`, link: `/${recipientRole}/messages?c=${conv.id}` });
    return msg;
  }],

  /* Notifications */
  ['GET', '/notifications', ({ req }) => {
    const u = requireUser(req);
    return db.notifications.filter((n) => n.userId === u.id).map(({ userId: _userId, ...n }) => n);
  }],
  ['PATCH', '/notifications/:id/read', ({ req, params }) => {
    const u = requireUser(req);
    const n = db.notifications.find((x) => x.id === params.id && x.userId === u.id);
    if (n) n.read = true;
    return undefined;
  }],

  /* Dashboards (proposed endpoints) */
  ['GET', '/admin/dashboard', ({ req }): AdminDashboard => {
    requireUser(req, ['admin']);
    const days = rangeDays(req.params?.range);
    const pending = db.listings.filter((l) => l.status === 'pending_review');
    const live = db.listings.filter(isPublic).length;
    const decided = db.listings.filter((l) => ['published', 'rejected', 'changes_required', 'hidden'].includes(l.status));
    const approved = decided.filter((l) => l.status === 'published').length;
    const openReports = db.reports.filter((r) => r.status === 'open' || r.status === 'reviewing').length;
    const activeUsers = db.users.filter((u) => u.status === 'active').length;
    const trend = series(days, 38, 14, 3);
    const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return {
      kpis: [
        kpi('liveListings', 'Live ads', live * 132, live * 118),
        kpi('pendingReview', 'Pending review', pending.length, pending.length + 2),
        kpi('activeUsers', 'Active users', activeUsers * 1240, activeUsers * 1105),
        kpi('openReports', 'Open reports', openReports, Math.max(0, openReports - 1)),
      ],
      listingsTrend: trend,
      approvalsTrend: trend.map((p, i) => ({ date: p.date, value: Math.round(p.value * (0.62 + ((i * 7) % 5) * 0.05)) })),
      categoryBreakdown: db.categories.map((c, i) => ({
        slug: c.slug,
        name: c.name,
        count: db.listings.filter((l) => l.categoryId === c.id && isPublic(l)).length * [148, 96, 121, 74, 52][i],
      })),
      activityByWeekday: weekdays.map((day, i) => ({ day, value: [420, 610, 680, 590, 720, 380, 460][i] })),
      approvalRate: decided.length ? Math.round((approved / decided.length) * 100) : 0,
      pendingQueue: pending.slice(0, 5).map(hydrateListing),
      recentReports: db.reports.slice(0, 5).map(reportView),
    };
  }],
  ['GET', '/dashboard/user', ({ req }): UserDashboard => {
    const u = requireUser(req, ['user']);
    const days = rangeDays(req.params?.range);
    const mine = db.listings.filter((l) => l.sellerId === u.id);
    const live = mine.filter(isPublic);
    const totalViews = mine.reduce((sum, l) => sum + l.views, 0);
    const convs = conversationsFor(u.id);
    const unread = convs.reduce((sum, c) => sum + c.unreadCount, 0);
    const savedIds = db.savedListings.filter((s) => s.userId === u.id).map((s) => s.listingId);
    const saved = db.listings.filter((l) => savedIds.includes(l.id) && l.status === 'published').map(hydrateListing);
    const statuses: ListingStatus[] = ['published', 'pending_review', 'changes_required', 'draft', 'rejected', 'withdrawn'];
    const adsByStatus: StatusCount[] = statuses
      .map((status) => ({ status, count: mine.filter((l) => l.status === status).length }))
      .filter((s) => s.count > 0);
    // Accounts with no ads still get a believable chart shape at zero
    const scale = mine.length ? 1 : 0;
    const views = series(days, 160, 60, 5);
    const messages = series(days, 18, 8, 2);
    return {
      kpis: [
        kpi('liveListings', 'Live ads', live.length, Math.max(0, live.length - 1)),
        kpi('totalViews', 'Total views', totalViews, Math.round(totalViews * 0.84)),
        kpi('conversations', 'Conversations', convs.length, Math.max(0, convs.length - 1)),
        kpi('saved', 'Saved ads', saved.length, Math.max(0, saved.length - 1)),
      ],
      engagement: views.map((p, i) => ({ date: p.date, views: p.value * scale, messages: messages[i].value * scale })),
      adsByStatus,
      responseRate: convs.length === 0 ? 0 : unread > 0 ? 82 : 96,
      myListings: [...mine].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 6).map(hydrateListing),
      actionRequired: mine.filter((l) => l.status === 'changes_required' || l.status === 'draft').map(hydrateListing),
      recentConversations: convs.slice(0, 4),
      savedListings: saved.slice(0, 4),
    };
  }],

  /* Admin */
  ['GET', '/admin/moderation/listings', ({ req }) => {
    requireUser(req, ['admin']);
    const status = (req.params?.status as string) || 'pending_review';
    const category = req.params?.category as string | undefined;
    const q = ((req.params?.q as string) ?? '').toLowerCase();
    const items = db.listings
      .filter((l) => (status === 'all' || l.status === status) && (!category || l.categorySlug === category))
      .filter((l) => !q || l.title.toLowerCase().includes(q) || l.seller.name.toLowerCase().includes(q))
      .sort((a, b) => a.updatedAt.localeCompare(b.updatedAt))
      .map(hydrateListing);
    return paginate(items, Number(req.params?.page) || 1, 10);
  }],
  ['POST', '/admin/listings/:id/approve', ({ req, params }) => {
    requireUser(req, ['admin']);
    const l = findListing(params.id);
    if (l.status !== 'pending_review') throw new ApiError('Only ads waiting for review can be approved.', 409, 'INVALID_STATUS');
    l.status = 'published';
    l.publishedAt = l.publishedAt ?? nowIso();
    l.moderationNote = null;
    l.updatedAt = nowIso();
    notify(l.sellerId, { type: 'listing_approved', title: 'Ad approved', body: `Your ad "${l.title}" is now live.`, link: `/listings/${l.id}` });
    return hydrateListing(l);
  }],
  ['POST', '/admin/listings/:id/reject', ({ req, params, body }) => {
    requireUser(req, ['admin']);
    const l = findListing(params.id);
    const reason = str(body.reason);
    if (reason.length < 10) validationError({ reason: 'Explain the reason in at least 10 characters.' });
    if (l.status !== 'pending_review') throw new ApiError('Only ads waiting for review can be rejected.', 409, 'INVALID_STATUS');
    const askChanges = body.mode === 'changes';
    l.status = askChanges ? 'changes_required' : 'rejected';
    l.moderationNote = reason;
    l.updatedAt = nowIso();
    notify(l.sellerId, {
      type: askChanges ? 'changes_required' : 'listing_rejected',
      title: askChanges ? 'Changes required' : 'Ad rejected',
      body: `"${l.title}": ${reason}`,
      link: '/account/listings',
    });
    return hydrateListing(l);
  }],
  ['POST', '/admin/listings/:id/hide', ({ req, params, body }) => {
    requireUser(req, ['admin']);
    const l = findListing(params.id);
    const reason = str(body.reason);
    if (reason.length < 10) validationError({ reason: 'Explain the reason in at least 10 characters.' });
    l.status = 'hidden';
    l.moderationNote = reason;
    l.updatedAt = nowIso();
    return hydrateListing(l);
  }],
  ['GET', '/admin/users', ({ req }) => {
    requireUser(req, ['admin']);
    const q = ((req.params?.q as string) ?? '').toLowerCase();
    const role = req.params?.role as string | undefined;
    const status = req.params?.status as string | undefined;
    const items = db.users
      .filter((u) => (!role || role === 'all' || u.role === role) && (!status || status === 'all' || u.status === status))
      .filter((u) => !q || u.name.toLowerCase().includes(q) || (u.email ?? '').toLowerCase().includes(q) || (u.phone ?? '').includes(q))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map(publicUser);
    return paginate(items, Number(req.params?.page) || 1, 10);
  }],
  ['PATCH', '/admin/users/:id/status', ({ req, params, body }) => {
    const admin = requireUser(req, ['admin']);
    const target = db.users.find((u) => u.id === params.id);
    if (!target) throw new ApiError('User not found.', 404, 'NOT_FOUND');
    if (target.id === admin.id || target.role === 'admin') throw new ApiError('Admin accounts cannot be suspended here.', 409, 'PROTECTED_ACCOUNT');
    if (body.status !== 'active' && body.status !== 'suspended') validationError({ status: 'Choose a valid status.' });
    if (str(body.reason).length < 5) validationError({ reason: 'Add a short reason.' });
    target.status = body.status as 'active' | 'suspended';
    return publicUser(target);
  }],
  ['GET', '/admin/reports', ({ req }) => {
    requireUser(req, ['admin']);
    const status = req.params?.status as string | undefined;
    const items = db.reports.filter((r) => !status || status === 'all' || r.status === status).map(reportView);
    return paginate(items, Number(req.params?.page) || 1, 10);
  }],
  ['PATCH', '/admin/reports/:id/status', ({ req, params, body }) => {
    requireUser(req, ['admin']);
    const r = db.reports.find((x) => x.id === params.id);
    if (!r) throw new ApiError('Report not found.', 404, 'NOT_FOUND');
    const allowed: ReportStatus[] = ['open', 'reviewing', 'resolved', 'dismissed'];
    if (!allowed.includes(body.status as ReportStatus)) validationError({ status: 'Choose a valid status.' });
    r.status = body.status as ReportStatus;
    return reportView(r);
  }],
];

function matchRoute(method: string, path: string): { handler: Handler; params: Record<string, string> } | null {
  const pathParts = path.split('?')[0].split('/').filter(Boolean);
  for (const [routeMethod, pattern, handler] of routes) {
    if (routeMethod !== method) continue;
    const patternParts = pattern.split('/').filter(Boolean);
    if (patternParts.length !== pathParts.length) continue;
    const params: Record<string, string> = {};
    const matched = patternParts.every((part, i) => {
      if (part.startsWith(':')) {
        params[part.slice(1)] = decodeURIComponent(pathParts[i]);
        return true;
      }
      return part === pathParts[i];
    });
    if (matched) return { handler, params };
  }
  return null;
}

const wait = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));

export async function handleMockRequest<T>(path: string, req: MockRequest): Promise<T> {
  await wait(250 + Math.random() * 300);
  const match = matchRoute(req.method, path);
  if (!match) throw new ApiError(`Mock API has no route for ${req.method} ${path}`, 404, 'NOT_FOUND');
  const body = req.body && !(req.body instanceof FormData) && typeof req.body === 'object' ? (req.body as Record<string, unknown>) : {};
  const result = match.handler({ req, params: match.params, body });
  // Return copies so screens cannot mutate the mock database by accident
  return (result === undefined ? undefined : structuredClone(result)) as T;
}
