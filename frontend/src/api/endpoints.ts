/**
 * REST endpoints of the backend (backend/src/app.js), relative to VITE_API_URL (/api/v1).
 */

export const endpoints = {
  site: {
    settings: '/settings',
    page: (slug: string) => `/pages/${slug}`,
  },
  sellers: {
    profile: (id: string) => `/sellers/${id}`,
  },
  auth: {
    register: '/auth/register',
    login: '/auth/login',
    refresh: '/auth/refresh',
    logout: '/auth/logout',
    logoutAll: '/auth/logout-all',
    forgotPassword: '/auth/password/forgot',
    verifyResetCode: '/auth/password/verify',
    resetPassword: '/auth/password/reset',
  },
  users: {
    me: '/users/me',
    avatar: '/users/me/avatar',
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
    renew: (id: string) => `/listings/${id}/renew`,
    similar: (id: string) => `/listings/${id}/similar`,
    availability: (id: string) => `/listings/${id}/availability`,
    photos: (id: string) => `/listings/${id}/photos`,
    photo: (id: string, photoId: string) => `/listings/${id}/photos/${photoId}`,
    photoOrder: (id: string) => `/listings/${id}/photos/order`,
    reports: (id: string) => `/listings/${id}/reports`,
    search: '/search/listings',
  },
  conversations: {
    list: '/conversations',
    messages: (id: string) => `/conversations/${id}/messages`,
    message: (id: string, messageId: string) => `/conversations/${id}/messages/${messageId}`,
    attachments: (id: string) => `/conversations/${id}/attachments`,
    read: (id: string) => `/conversations/${id}/read`,
    block: (id: string) => `/conversations/${id}/block`,
  },
  notifications: {
    list: '/notifications',
    markRead: (id: string) => `/notifications/${id}/read`,
    readAll: '/notifications/read-all',
  },
  dashboards: {
    admin: '/admin/dashboard',
    user: '/dashboard/user',
  },
  support: {
    messages: '/support/messages',
  },
  admin: {
    moderationQueue: '/admin/moderation/listings',
    approve: (id: string) => `/admin/listings/${id}/approve`,
    reject: (id: string) => `/admin/listings/${id}/reject`,
    hide: (id: string) => `/admin/listings/${id}/hide`,
    users: '/admin/users',
    userStatus: (id: string) => `/admin/users/${id}/status`,
    approveUser: (id: string) => `/admin/users/${id}/approve`,
    history: '/admin/history',
    promotions: '/admin/promotions',
    feature: (id: string) => `/admin/listings/${id}/feature`,
    categories: '/admin/categories',
    category: (id: string) => `/admin/categories/${id}`,
    categoryOrder: '/admin/categories/reorder',
    settings: '/admin/settings',
    settingsPage: (slug: string) => `/admin/settings/pages/${slug}`,
    reports: '/admin/reports',
    reportStatus: (id: string) => `/admin/reports/${id}/status`,
  },
} as const;
