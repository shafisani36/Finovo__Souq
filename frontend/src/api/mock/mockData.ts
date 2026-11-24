/**
 * Seed data for the mock API (VITE_USE_MOCK_API=true).
 * Only loaded in mock mode; never part of a production request path.
 */
import type {
  AppNotification,
  Category,
  Listing,
  ListingAvailability,
  ListingReport,
  ListingStatus,
  ListingType,
  Message,
  ReportReason,
  ReportStatus,
  SavedSearch,
  User,
  UserRole,
  UserStatus,
} from '../../types';

const DAY_MS = 24 * 60 * 60 * 1000;

export function daysAgo(days: number, hours = 0): string {
  return new Date(Date.now() - days * DAY_MS - hours * 60 * 60 * 1000).toISOString();
}

/* ---------- Users ---------- */
export interface MockUser extends User {
  password: string;
}

function user(
  id: string,
  name: string,
  email: string,
  phone: string,
  role: UserRole,
  city: string,
  createdDaysAgo: number,
  status: UserStatus = 'active',
  password = 'Password@123',
): MockUser {
  return {
    id,
    name,
    email,
    phone,
    isEmailVerified: true,
    role,
    status,
    city,
    createdAt: daysAgo(createdDaysAgo),
    password,
  };
}

export const seedUsers: MockUser[] = [
  user('u_admin', 'Hassan Al-Mutairi', 'admin@finovosouq.com', '+966500000001', 'admin', 'Riyadh', 400, 'active', 'Admin@123'),
  user('u_seller1', 'Faisal Al-Harbi', 'user@finovosouq.com', '+966500000002', 'user', 'Riyadh', 210, 'active', 'User@1234'),
  user('u_seller2', 'Noura Al-Qahtani', 'noura@example.com', '+966500000003', 'user', 'Jeddah', 160),
  user('u_seller3', 'Omar Motors', 'omar.motors@example.com', '+966500000004', 'user', 'Dammam', 320),
  user('u_seller4', 'Reem Home Services', 'reem.services@example.com', '+966500000005', 'user', 'Khobar', 95),
  user('u_customer1', 'Sara Al-Otaibi', 'sara@example.com', '+966500000006', 'user', 'Riyadh', 120),
  user('u_customer2', 'Khalid Al-Shehri', 'khalid@example.com', '+966500000007', 'user', 'Mecca', 60),
  user('u_customer3', 'Lama Al-Dosari', 'lama@example.com', '+966500000008', 'user', 'Medina', 34),
  user('u_customer4', 'Yousef Al-Ghamdi', 'yousef@example.com', '+966500000009', 'user', 'Taif', 12),
  user('u_customer5', 'Abdullah Al-Zahrani', 'abdullah@example.com', '+966500000010', 'user', 'Abha', 80, 'suspended'),
  user('u_seller5', 'Majed Electronics', 'majed.electronics@example.com', '+966500000011', 'user', 'Riyadh', 140),
];

/* ---------- Categories ---------- */
const GENERAL_CONDITIONS = ['New', 'Like new', 'Used - good', 'Used - fair'];

export const seedCategories: Category[] = [
  {
    id: 'cat_cars',
    name: 'Cars',
    slug: 'cars',
    icon: 'car',
    description: 'New and used cars from owners and dealers',
    listingCount: 0,
    fields: [
      { fieldKey: 'make', label: 'Make', inputType: 'select', required: true, filterable: true, options: ['Toyota', 'Hyundai', 'Nissan', 'Lexus', 'Kia', 'Ford', 'Honda', 'Chevrolet', 'Mercedes-Benz', 'BMW'] },
      { fieldKey: 'model', label: 'Model', inputType: 'text', required: true, filterable: false },
      { fieldKey: 'year', label: 'Year', inputType: 'number', required: true, filterable: true },
      { fieldKey: 'mileage', label: 'Mileage', inputType: 'number', required: true, filterable: true, unit: 'km' },
      { fieldKey: 'transmission', label: 'Transmission', inputType: 'select', required: true, filterable: true, options: ['Automatic', 'Manual'] },
      { fieldKey: 'condition', label: 'Condition', inputType: 'select', required: true, filterable: true, options: ['New', 'Used'] },
    ],
  },
  {
    id: 'cat_property',
    name: 'Property',
    slug: 'property',
    icon: 'property',
    description: 'Apartments, villas and land for sale or rent',
    listingCount: 0,
    fields: [
      { fieldKey: 'propertyType', label: 'Property type', inputType: 'select', required: true, filterable: true, options: ['Apartment', 'Villa', 'Floor', 'Land', 'Office', 'Shop'] },
      { fieldKey: 'area', label: 'Area', inputType: 'number', required: true, filterable: true, unit: 'm²' },
      { fieldKey: 'bedrooms', label: 'Bedrooms', inputType: 'number', required: true, filterable: true },
      { fieldKey: 'bathrooms', label: 'Bathrooms', inputType: 'number', required: true, filterable: true },
    ],
  },
  {
    id: 'cat_electronics',
    name: 'Electronics',
    slug: 'electronics',
    icon: 'electronics',
    description: 'Phones, laptops, TVs, cameras and gaming',
    listingCount: 0,
    fields: [
      { fieldKey: 'itemType', label: 'Item type', inputType: 'select', required: true, filterable: true, options: ['Mobile phone', 'Laptop', 'Television', 'Camera', 'Gaming', 'Other'] },
      { fieldKey: 'brand', label: 'Brand', inputType: 'text', required: false, filterable: false },
      { fieldKey: 'condition', label: 'Condition', inputType: 'select', required: true, filterable: true, options: GENERAL_CONDITIONS },
    ],
  },
  {
    id: 'cat_furniture',
    name: 'Home & Furniture',
    slug: 'home-furniture',
    icon: 'furniture',
    description: 'Sofas, beds, dining sets and home decor',
    listingCount: 0,
    fields: [
      { fieldKey: 'itemType', label: 'Item type', inputType: 'select', required: true, filterable: true, options: ['Sofa', 'Bed', 'Dining set', 'Wardrobe', 'Office furniture', 'Decor', 'Other'] },
      { fieldKey: 'condition', label: 'Condition', inputType: 'select', required: true, filterable: true, options: GENERAL_CONDITIONS },
    ],
  },
  {
    id: 'cat_services',
    name: 'Services',
    slug: 'services',
    icon: 'services',
    description: 'Cleaning, moving, maintenance and more',
    listingCount: 0,
    fields: [
      { fieldKey: 'serviceCategory', label: 'Service category', inputType: 'select', required: true, filterable: true, options: ['Cleaning', 'Moving', 'Maintenance', 'AC repair', 'Tutoring', 'Car services', 'Other'] },
      { fieldKey: 'areaCovered', label: 'Area covered', inputType: 'text', required: true, filterable: false },
      { fieldKey: 'priceType', label: 'Price type', inputType: 'select', required: true, filterable: false, options: ['Fixed', 'Starting from'] },
    ],
  },
];

/* ---------- Listings ---------- */
interface ListingSeed {
  id: string;
  sellerId: string;
  categoryId: string;
  listingType: ListingType;
  title: string;
  price: number;
  city: string;
  district: string;
  attributes: Record<string, string | number>;
  status: ListingStatus;
  availability?: ListingAvailability;
  views: number;
  createdDaysAgo: number;
  moderationNote?: string;
  description?: string;
}

const listingSeeds: ListingSeed[] = [
  { id: 'lst_1001', sellerId: 'u_seller1', categoryId: 'cat_cars', listingType: 'sale', title: 'Toyota Camry GLE 2022 - single owner, full agency service', price: 92000, city: 'Riyadh', district: 'Al Malqa', attributes: { make: 'Toyota', model: 'Camry GLE', year: 2022, mileage: 48000, transmission: 'Automatic', condition: 'Used' }, status: 'published', views: 1840, createdDaysAgo: 6 },
  { id: 'lst_1002', sellerId: 'u_seller1', categoryId: 'cat_cars', listingType: 'sale', title: 'Hyundai Tucson 2021 panoramic roof', price: 78500, city: 'Riyadh', district: 'Al Yasmin', attributes: { make: 'Hyundai', model: 'Tucson', year: 2021, mileage: 61000, transmission: 'Automatic', condition: 'Used' }, status: 'published', views: 1210, createdDaysAgo: 11 },
  { id: 'lst_1003', sellerId: 'u_seller1', categoryId: 'cat_electronics', listingType: 'sale', title: 'iPhone 15 Pro Max 256GB Natural Titanium', price: 4300, city: 'Riyadh', district: 'Olaya', attributes: { itemType: 'Mobile phone', brand: 'Apple', condition: 'Like new' }, status: 'pending_review', views: 0, createdDaysAgo: 1 },
  { id: 'lst_1004', sellerId: 'u_seller1', categoryId: 'cat_furniture', listingType: 'sale', title: 'L-shaped grey fabric sofa, 7 seats', price: 2100, city: 'Riyadh', district: 'Al Narjis', attributes: { itemType: 'Sofa', condition: 'Used - good' }, status: 'changes_required', views: 96, createdDaysAgo: 4, moderationNote: 'Please add at least two clear photos of the sofa and mention any stains or damage.' },
  { id: 'lst_1005', sellerId: 'u_seller1', categoryId: 'cat_cars', listingType: 'sale', title: 'Nissan Patrol LE Platinum 2019', price: 165000, city: 'Riyadh', district: 'Hittin', attributes: { make: 'Nissan', model: 'Patrol LE Platinum', year: 2019, mileage: 112000, transmission: 'Automatic', condition: 'Used' }, status: 'published', availability: 'sold', views: 2960, createdDaysAgo: 40 },
  { id: 'lst_1006', sellerId: 'u_seller1', categoryId: 'cat_electronics', listingType: 'sale', title: 'MacBook Air M2 13-inch 512GB', price: 3900, city: 'Riyadh', district: 'Al Sahafa', attributes: { itemType: 'Laptop', brand: 'Apple', condition: 'Used - good' }, status: 'draft', views: 0, createdDaysAgo: 0 },
  { id: 'lst_1007', sellerId: 'u_seller1', categoryId: 'cat_property', listingType: 'rent', title: '2-bedroom apartment near King Fahd Road', price: 45000, city: 'Riyadh', district: 'Al Wurud', attributes: { propertyType: 'Apartment', area: 140, bedrooms: 2, bathrooms: 2 }, status: 'withdrawn', views: 410, createdDaysAgo: 55 },
  { id: 'lst_1008', sellerId: 'u_seller1', categoryId: 'cat_electronics', listingType: 'sale', title: 'PlayStation 5 with two controllers', price: 1750, city: 'Riyadh', district: 'Al Aqiq', attributes: { itemType: 'Gaming', brand: 'Sony', condition: 'Like new' }, status: 'published', views: 760, createdDaysAgo: 9 },

  { id: 'lst_2001', sellerId: 'u_seller2', categoryId: 'cat_property', listingType: 'sale', title: 'Modern villa with private pool in Obhur', price: 3450000, city: 'Jeddah', district: 'Obhur Al Shamaliyah', attributes: { propertyType: 'Villa', area: 620, bedrooms: 6, bathrooms: 7 }, status: 'published', views: 5120, createdDaysAgo: 14 },
  { id: 'lst_2002', sellerId: 'u_seller2', categoryId: 'cat_property', listingType: 'rent', title: 'Furnished studio, monthly rent, Al Rawdah', price: 3200, city: 'Jeddah', district: 'Al Rawdah', attributes: { propertyType: 'Apartment', area: 55, bedrooms: 1, bathrooms: 1 }, status: 'published', views: 2240, createdDaysAgo: 3 },
  { id: 'lst_2003', sellerId: 'u_seller2', categoryId: 'cat_property', listingType: 'sale', title: 'Residential land 900 m² on a corner plot', price: 1250000, city: 'Jeddah', district: 'Al Shati', attributes: { propertyType: 'Land', area: 900, bedrooms: 0, bathrooms: 0 }, status: 'pending_review', views: 0, createdDaysAgo: 2 },
  { id: 'lst_2004', sellerId: 'u_seller2', categoryId: 'cat_furniture', listingType: 'sale', title: 'Solid oak dining table with 8 chairs', price: 5400, city: 'Jeddah', district: 'Al Zahra', attributes: { itemType: 'Dining set', condition: 'Used - good' }, status: 'published', views: 690, createdDaysAgo: 8 },
  { id: 'lst_2005', sellerId: 'u_seller2', categoryId: 'cat_property', listingType: 'rent', title: 'Office space 200 m² on Tahlia Street', price: 180000, city: 'Jeddah', district: 'Al Andalus', attributes: { propertyType: 'Office', area: 200, bedrooms: 0, bathrooms: 2 }, status: 'published', availability: 'rented', views: 1330, createdDaysAgo: 46 },

  { id: 'lst_3001', sellerId: 'u_seller3', categoryId: 'cat_cars', listingType: 'sale', title: 'Lexus ES 350 2023 - dealer warranty remaining', price: 189000, city: 'Dammam', district: 'Al Faisaliyah', attributes: { make: 'Lexus', model: 'ES 350', year: 2023, mileage: 18000, transmission: 'Automatic', condition: 'Used' }, status: 'published', views: 3010, createdDaysAgo: 5 },
  { id: 'lst_3002', sellerId: 'u_seller3', categoryId: 'cat_cars', listingType: 'sale', title: 'Ford F-150 Raptor 2020 black edition', price: 215000, city: 'Dammam', district: 'Al Shati', attributes: { make: 'Ford', model: 'F-150 Raptor', year: 2020, mileage: 74000, transmission: 'Automatic', condition: 'Used' }, status: 'published', views: 2480, createdDaysAgo: 12 },
  { id: 'lst_3003', sellerId: 'u_seller3', categoryId: 'cat_cars', listingType: 'sale', title: 'Kia Sportage 2024 brand new, zero km', price: 112000, city: 'Dammam', district: 'Al Mazruiyah', attributes: { make: 'Kia', model: 'Sportage', year: 2024, mileage: 0, transmission: 'Automatic', condition: 'New' }, status: 'pending_review', views: 0, createdDaysAgo: 0 },
  { id: 'lst_3004', sellerId: 'u_seller3', categoryId: 'cat_cars', listingType: 'sale', title: 'Mercedes-Benz C200 2018 AMG kit', price: 98000, city: 'Khobar', district: 'Al Ulaya', attributes: { make: 'Mercedes-Benz', model: 'C200', year: 2018, mileage: 96000, transmission: 'Automatic', condition: 'Used' }, status: 'published', views: 1720, createdDaysAgo: 18 },
  { id: 'lst_3005', sellerId: 'u_seller3', categoryId: 'cat_cars', listingType: 'sale', title: 'Cheap Honda Accord - message for details', price: 1, city: 'Dammam', district: 'Al Badiyah', attributes: { make: 'Honda', model: 'Accord', year: 2015, mileage: 210000, transmission: 'Automatic', condition: 'Used' }, status: 'hidden', views: 240, createdDaysAgo: 21, moderationNote: 'Hidden after reports: placeholder price.' },

  { id: 'lst_4001', sellerId: 'u_seller4', categoryId: 'cat_services', listingType: 'service', title: 'Deep home cleaning - villas and apartments', price: 350, city: 'Khobar', district: 'Al Rakah', attributes: { serviceCategory: 'Cleaning', areaCovered: 'Khobar, Dammam, Dhahran', priceType: 'Starting from' }, status: 'published', views: 980, createdDaysAgo: 7 },
  { id: 'lst_4002', sellerId: 'u_seller4', categoryId: 'cat_services', listingType: 'service', title: 'Split AC cleaning and gas refill', price: 120, city: 'Khobar', district: 'Al Thuqbah', attributes: { serviceCategory: 'AC repair', areaCovered: 'Eastern Province', priceType: 'Fixed' }, status: 'published', views: 1450, createdDaysAgo: 2 },
  { id: 'lst_4003', sellerId: 'u_seller4', categoryId: 'cat_services', listingType: 'service', title: 'House moving with packing and assembly', price: 1500, city: 'Dammam', district: 'Al Nur', attributes: { serviceCategory: 'Moving', areaCovered: 'Dammam to any city', priceType: 'Starting from' }, status: 'pending_review', views: 0, createdDaysAgo: 1 },

  { id: 'lst_5001', sellerId: 'u_seller5', categoryId: 'cat_electronics', listingType: 'sale', title: 'Samsung 65-inch QLED 4K Smart TV', price: 2600, city: 'Riyadh', district: 'Al Rabwah', attributes: { itemType: 'Television', brand: 'Samsung', condition: 'Like new' }, status: 'published', views: 870, createdDaysAgo: 4 },
  { id: 'lst_5002', sellerId: 'u_seller5', categoryId: 'cat_electronics', listingType: 'sale', title: 'Canon EOS R6 body with 24-105mm lens', price: 8900, city: 'Riyadh', district: 'Al Malaz', attributes: { itemType: 'Camera', brand: 'Canon', condition: 'Used - good' }, status: 'published', views: 640, createdDaysAgo: 10 },
  { id: 'lst_5003', sellerId: 'u_seller5', categoryId: 'cat_electronics', listingType: 'sale', title: 'Samsung Galaxy S24 Ultra 512GB', price: 3700, city: 'Riyadh', district: 'Al Murabba', attributes: { itemType: 'Mobile phone', brand: 'Samsung', condition: 'New' }, status: 'published', views: 1530, createdDaysAgo: 1 },
  { id: 'lst_5004', sellerId: 'u_seller5', categoryId: 'cat_furniture', listingType: 'sale', title: 'King size bed with orthopedic mattress', price: 1800, city: 'Riyadh', district: 'Al Rawdah', attributes: { itemType: 'Bed', condition: 'Used - good' }, status: 'published', views: 520, createdDaysAgo: 15 },
  { id: 'lst_5005', sellerId: 'u_seller5', categoryId: 'cat_electronics', listingType: 'sale', title: 'Dell XPS 15 i7 32GB RAM', price: 5200, city: 'Medina', district: 'Quba', attributes: { itemType: 'Laptop', brand: 'Dell', condition: 'Used - good' }, status: 'rejected', views: 0, createdDaysAgo: 3, moderationNote: 'Photos appear to be taken from the manufacturer website.' },
  { id: 'lst_5006', sellerId: 'u_seller2', categoryId: 'cat_property', listingType: 'rent', title: '3-bedroom family apartment in Al Naseem', price: 38000, city: 'Mecca', district: 'Al Naseem', attributes: { propertyType: 'Apartment', area: 165, bedrooms: 3, bathrooms: 2 }, status: 'published', views: 1190, createdDaysAgo: 6 },
  { id: 'lst_5007', sellerId: 'u_seller3', categoryId: 'cat_cars', listingType: 'sale', title: 'Chevrolet Tahoe LT 2021 seven seater', price: 172000, city: 'Medina', district: 'Al Aziziyah', attributes: { make: 'Chevrolet', model: 'Tahoe LT', year: 2021, mileage: 69000, transmission: 'Automatic', condition: 'Used' }, status: 'published', views: 1610, createdDaysAgo: 13 },
];

function describe(seed: ListingSeed): string {
  if (seed.description) return seed.description;
  const lines = [
    `${seed.title}.`,
    '',
    `Located in ${seed.district}, ${seed.city}. Serious buyers only, please message through Finovo Souq and I will reply as soon as possible.`,
    '',
    'Viewing is available by appointment. Price is negotiable for quick deals.',
  ];
  return lines.join('\n');
}

export function buildSeedListings(users: MockUser[], categories: Category[]): Listing[] {
  return listingSeeds.map((seed) => {
    const seller = users.find((u) => u.id === seed.sellerId)!;
    const category = categories.find((c) => c.id === seed.categoryId)!;
    const createdAt = daysAgo(seed.createdDaysAgo, 3);
    return {
      id: seed.id,
      sellerId: seed.sellerId,
      seller: {
        id: seller.id,
        name: seller.name,
        city: seller.city,
        memberSince: seller.createdAt,
        phoneVerified: Boolean(seller.phone),
        activeListings: 0,
      },
      categoryId: category.id,
      categorySlug: category.slug,
      categoryName: category.name,
      listingType: seed.listingType,
      title: seed.title,
      description: describe(seed),
      price: seed.price,
      currency: 'SAR',
      city: seed.city,
      district: seed.district,
      attributes: seed.attributes,
      status: seed.status,
      availability: seed.availability ?? 'available',
      photos: [],
      views: seed.views,
      moderationNote: seed.moderationNote ?? null,
      createdAt,
      updatedAt: createdAt,
      publishedAt: seed.status === 'published' ? createdAt : null,
    };
  });
}

/* ---------- Conversations ---------- */
export interface MockConversation {
  id: string;
  listingId: string;
  participantIds: [string, string];
  createdAt: string;
  lastMessageAt: string;
  lastReadAt: Record<string, string>;
}

export const seedConversations: MockConversation[] = [
  { id: 'cnv_1', listingId: 'lst_1001', participantIds: ['u_customer1', 'u_seller1'], createdAt: daysAgo(3), lastMessageAt: daysAgo(0, 2), lastReadAt: { u_customer1: daysAgo(0, 1), u_seller1: daysAgo(1) } },
  { id: 'cnv_2', listingId: 'lst_2002', participantIds: ['u_customer1', 'u_seller2'], createdAt: daysAgo(2), lastMessageAt: daysAgo(1, 5), lastReadAt: { u_customer1: daysAgo(2), u_seller2: daysAgo(1, 5) } },
  { id: 'cnv_3', listingId: 'lst_1008', participantIds: ['u_customer2', 'u_seller1'], createdAt: daysAgo(4), lastMessageAt: daysAgo(0, 6), lastReadAt: { u_customer2: daysAgo(0, 6), u_seller1: daysAgo(2) } },
  { id: 'cnv_4', listingId: 'lst_1002', participantIds: ['u_customer3', 'u_seller1'], createdAt: daysAgo(6), lastMessageAt: daysAgo(2), lastReadAt: { u_customer3: daysAgo(2), u_seller1: daysAgo(2) } },
];

export const seedMessages: Message[] = [
  { id: 'msg_1', conversationId: 'cnv_1', senderId: 'u_customer1', body: 'Hello, is the Camry still available?', createdAt: daysAgo(3) },
  { id: 'msg_2', conversationId: 'cnv_1', senderId: 'u_seller1', body: 'Yes, it is available. You can view it this week in Al Malqa.', createdAt: daysAgo(2, 20) },
  { id: 'msg_3', conversationId: 'cnv_1', senderId: 'u_customer1', body: 'Great. Does it have the full service history from the agency?', createdAt: daysAgo(1) },
  { id: 'msg_4', conversationId: 'cnv_1', senderId: 'u_seller1', body: 'Yes, all services were done at Abdul Latif Jameel. I can share the records when you visit.', createdAt: daysAgo(0, 2) },
  { id: 'msg_5', conversationId: 'cnv_2', senderId: 'u_customer1', body: 'Is the studio available from next month?', createdAt: daysAgo(2) },
  { id: 'msg_6', conversationId: 'cnv_2', senderId: 'u_seller2', body: 'It is available from the 1st. Water and electricity are included.', createdAt: daysAgo(1, 5) },
  { id: 'msg_7', conversationId: 'cnv_3', senderId: 'u_customer2', body: 'Would you accept 1,500 SAR for the PS5?', createdAt: daysAgo(0, 7) },
  { id: 'msg_8', conversationId: 'cnv_3', senderId: 'u_customer2', body: 'I can pick it up today.', createdAt: daysAgo(0, 6) },
  { id: 'msg_9', conversationId: 'cnv_4', senderId: 'u_customer3', body: 'Has the Tucson been in any accident?', createdAt: daysAgo(3) },
  { id: 'msg_10', conversationId: 'cnv_4', senderId: 'u_seller1', body: 'No accidents. The car is in original paint.', createdAt: daysAgo(2) },
];

/* ---------- Saved items ---------- */
export const seedSavedListings: { userId: string; listingId: string; createdAt: string }[] = [
  { userId: 'u_customer1', listingId: 'lst_1001', createdAt: daysAgo(3) },
  { userId: 'u_customer1', listingId: 'lst_2002', createdAt: daysAgo(2) },
  { userId: 'u_customer1', listingId: 'lst_3001', createdAt: daysAgo(1) },
  { userId: 'u_customer1', listingId: 'lst_5001', createdAt: daysAgo(0, 4) },
];

export const seedSavedSearches: (SavedSearch & { userId: string })[] = [
  { id: 'ss_1', userId: 'u_customer1', label: 'SUVs in Riyadh under 120,000 SAR', criteria: { category: 'cars', city: 'Riyadh', maxPrice: 120000 }, createdAt: daysAgo(10) },
  { id: 'ss_2', userId: 'u_customer1', label: 'Apartments for rent in Jeddah', criteria: { category: 'property', city: 'Jeddah' }, createdAt: daysAgo(5) },
];

/* ---------- Notifications ---------- */
export const seedNotifications: (AppNotification & { userId: string })[] = [
  { id: 'ntf_1', userId: 'u_seller1', type: 'changes_required', title: 'Changes required', body: 'Your ad "L-shaped grey fabric sofa" needs changes before it can be published.', link: '/account/listings', read: false, createdAt: daysAgo(0, 5) },
  { id: 'ntf_2', userId: 'u_seller1', type: 'new_message', title: 'New message', body: 'Khalid Al-Shehri sent a message about "PlayStation 5 with two controllers".', link: '/account/messages', read: false, createdAt: daysAgo(0, 6) },
  { id: 'ntf_3', userId: 'u_seller1', type: 'listing_approved', title: 'Ad approved', body: 'Your ad "PlayStation 5 with two controllers" is now live.', link: '/listings/lst_1008', read: true, createdAt: daysAgo(9) },
  { id: 'ntf_4', userId: 'u_customer1', type: 'new_message', title: 'New message', body: 'Faisal Al-Harbi replied about "Toyota Camry GLE 2022".', link: '/account/messages', read: false, createdAt: daysAgo(0, 2) },
  { id: 'ntf_5', userId: 'u_customer1', type: 'report_update', title: 'Report reviewed', body: 'Thank you. The ad you reported has been reviewed and hidden.', link: null, read: true, createdAt: daysAgo(4) },
  { id: 'ntf_6', userId: 'u_customer1', type: 'system', title: 'Welcome to Finovo Souq', body: 'Save ads you like and message sellers directly.', link: '/search', read: true, createdAt: daysAgo(120) },
  { id: 'ntf_7', userId: 'u_admin', type: 'system', title: 'New reports waiting', body: 'There are open reports that need review.', link: '/admin/reports', read: false, createdAt: daysAgo(0, 3) },
  { id: 'ntf_8', userId: 'u_admin', type: 'system', title: 'New ad waiting for review', body: 'Omar Motors submitted "Kia Sportage 2024 brand new, zero km".', link: '/admin/moderation', read: false, createdAt: daysAgo(0, 3) },
  { id: 'ntf_9', userId: 'u_admin', type: 'report_update', title: 'Ad reported for fraud', body: 'Lama Al-Dosari reported "Samsung Galaxy S24 Ultra 512GB" as a possible scam.', link: '/admin/reports', read: false, createdAt: daysAgo(1, 2) },
  { id: 'ntf_10', userId: 'u_admin', type: 'system', title: 'Queue cleared', body: 'All ads submitted yesterday were reviewed.', link: null, read: true, createdAt: daysAgo(2) },
  { id: 'ntf_11', userId: 'u_admin', type: 'system', title: 'Account deletion request', body: 'A customer asked to delete their account. Review it in Users.', link: '/admin/users', read: true, createdAt: daysAgo(9) },
];

/* ---------- Reports ---------- */
function report(id: string, listingId: string, reporterId: string, reason: ReportReason, status: ReportStatus, days: number, details: string | null = null) {
  return { id, listingId, reporterId, reason, status, createdAt: daysAgo(days, 2), details };
}

export type MockReport = Omit<ListingReport, 'listingTitle' | 'reporter'> & { reporterId: string };

export const seedReports: MockReport[] = [
  report('rep_1', 'lst_3005', 'u_customer1', 'Misleading price or details', 'resolved', 4, 'The price is listed as 1 SAR.'),
  report('rep_2', 'lst_2003', 'u_customer2', 'Duplicate ad', 'open', 0, 'The same land is posted twice with different prices.'),
  report('rep_3', 'lst_5003', 'u_customer3', 'Scam or fraud', 'open', 1, 'Seller asked for a deposit by bank transfer before viewing.'),
  report('rep_4', 'lst_4002', 'u_customer2', 'Wrong category', 'reviewing', 2),
  report('rep_5', 'lst_1002', 'u_customer3', 'Other', 'dismissed', 6, 'Price seems high.'),
];
