/**
 * REST endpoints from the Finovo Souq Technical Plan (section 8), relative to VITE_API_URL (/api/v1).
 * Endpoints marked "proposed" are additions this frontend needs; confirm them with the backend team.
 */

/**
 * Endpoints the Express backend already serves (shafisani36/Finovo__Souq, backend/src/modules/auth).
 * Everything else is answered by the mock API while VITE_MOCK_PENDING_ENDPOINTS is "true".
 */
export const LIVE_ENDPOINTS: readonly string[] = [
  '/auth/register',
  '/auth/login',
  '/auth/refresh',
  '/auth/logout',
  '/auth/logout-all',
  '/auth/me',
];

export const endpoints = {
  auth: {
    register: '/auth/register',
    login: '/auth/login',
    refresh: '/auth/refresh',
    logout: '/auth/logout',
    logoutAll: '/auth/logout-all',
    me: '/auth/me',
    forgotPassword: '/auth/password/forgot', // not in the backend yet
  },
  users: {
    me: '/users/me',
    deletionRequest: '/users/me/deletion-request',
    savedListings: '/users/me/saved-listings',
    savedListing: (listingId: string) => `/users/me/saved-listings/${listingId}`,
    savedSearches: '/users/me/saved-searches',
    savedSearch: (id: string) => `/users/me/saved-searches/${id}`,
  },
  categories: {
    list: '/categories',
  },
  listings: {
    create: '/listings',
    mine: '/listings/mine',
    byId: (id: string) => `/listings/${id}`,
    submit: (id: string) => `/listings/${id}/submit`,
    withdraw: (id: string) => `/listings/${id}/withdraw`,
    availability: (id: string) => `/listings/${id}/availability`,
    photos: (id: string) => `/listings/${id}/photos`,
    photo: (id: string, photoId: string) => `/listings/${id}/photos/${photoId}`,
    reports: (id: string) => `/listings/${id}/reports`,
    search: '/search/listings',
  },
  sellers: {
    byId: (id: string) => `/sellers/${id}`,
  },
  conversations: {
    list: '/conversations',
    messages: (id: string) => `/conversations/${id}/messages`,
  },
  notifications: {
    list: '/notifications',
    markRead: (id: string) => `/notifications/${id}/read`,
  },
  dashboards: {
    admin: '/admin/dashboard', // proposed
    user: '/dashboard/user', // proposed
  },
  support: {
    messages: '/support/messages', // proposed
  },
  admin: {
    moderationQueue: '/admin/moderation/listings',
    approve: (id: string) => `/admin/listings/${id}/approve`,
    reject: (id: string) => `/admin/listings/${id}/reject`,
    hide: (id: string) => `/admin/listings/${id}/hide`,
    users: '/admin/users',
    userStatus: (id: string) => `/admin/users/${id}/status`,
    reports: '/admin/reports',
    reportStatus: (id: string) => `/admin/reports/${id}/status`, // proposed
    categories: '/admin/categories',
  },
} as const;
