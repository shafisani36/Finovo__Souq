/**
 * Starting category tree, inserted once when the categories collection is empty.
 * After that, admins manage categories from the dashboard.
 */
const CONDITION = { fieldKey: 'condition', label: 'Condition', inputType: 'select', required: true, filterable: true, options: ['New', 'Like new', 'Used - good', 'Used - fair'] }
const VEHICLE_CONDITION = { ...CONDITION, options: ['New', 'Used'] }
const YEAR = { fieldKey: 'year', label: 'Year', inputType: 'number', required: true, filterable: true, min: 1950 }
const MILEAGE = { fieldKey: 'mileage', label: 'Mileage', inputType: 'number', required: true, filterable: true, unit: 'km', min: 0 }
const BEDROOMS = { fieldKey: 'bedrooms', label: 'Bedrooms', inputType: 'number', required: true, filterable: true, min: 0, max: 20 }
const BATHROOMS = { fieldKey: 'bathrooms', label: 'Bathrooms', inputType: 'number', required: true, filterable: true, min: 0, max: 20 }
const FURNISHED = { fieldKey: 'furnished', label: 'Furnished', inputType: 'select', required: false, filterable: true, options: ['Furnished', 'Semi furnished', 'Unfurnished'] }
const BRAND = (options) => ({ fieldKey: 'brand', label: 'Brand', inputType: 'select', required: true, filterable: true, options })

export const DEFAULT_CATEGORIES = [
  {
    name: 'Vehicles',
    slug: 'vehicles',
    icon: 'car',
    description: 'Cars, motorcycles and spare parts',
    listingTypes: ['sale'],
    children: [
      {
        name: 'Cars',
        slug: 'cars',
        description: 'New and used cars from owners and dealers',
        fields: [
          { fieldKey: 'make', label: 'Make', inputType: 'select', required: true, filterable: true, options: ['Toyota', 'Hyundai', 'Nissan', 'Lexus', 'Kia', 'Ford', 'Honda', 'Chevrolet', 'Mercedes-Benz', 'BMW', 'Other'] },
          { fieldKey: 'model', label: 'Model', inputType: 'text', required: true },
          YEAR,
          MILEAGE,
          { fieldKey: 'transmission', label: 'Transmission', inputType: 'select', required: true, filterable: true, options: ['Automatic', 'Manual'] },
          VEHICLE_CONDITION,
        ],
      },
      {
        name: 'Motorcycles',
        slug: 'motorcycles',
        icon: 'motorcycle',
        description: 'Motorcycles, scooters and quad bikes',
        fields: [
          { fieldKey: 'make', label: 'Make', inputType: 'select', required: true, filterable: true, options: ['Honda', 'Yamaha', 'Suzuki', 'Kawasaki', 'Harley-Davidson', 'BMW', 'Other'] },
          YEAR,
          MILEAGE,
          VEHICLE_CONDITION,
        ],
      },
      {
        name: 'Spare Parts',
        slug: 'spare-parts',
        icon: 'parts',
        description: 'Parts, tyres and accessories',
        fields: [
          { fieldKey: 'partType', label: 'Part type', inputType: 'select', required: true, filterable: true, options: ['Engine', 'Body', 'Tyres & wheels', 'Electrical', 'Interior', 'Accessories', 'Other'] },
          VEHICLE_CONDITION,
        ],
      },
    ],
  },
  {
    name: 'Property',
    slug: 'property',
    icon: 'property',
    description: 'Apartments, villas, land and commercial space for sale or rent',
    listingTypes: ['sale', 'rent'],
    fields: [{ fieldKey: 'area', label: 'Area', inputType: 'number', required: true, filterable: true, unit: 'm²', min: 1 }],
    children: [
      { name: 'Apartments', slug: 'apartments', description: 'Apartments and floors', fields: [BEDROOMS, BATHROOMS, FURNISHED] },
      { name: 'Villas', slug: 'villas', description: 'Villas and houses', fields: [BEDROOMS, BATHROOMS, FURNISHED] },
      { name: 'Land', slug: 'land', icon: 'land', description: 'Residential, commercial and farm land', listingTypes: ['sale'] },
      {
        name: 'Commercial',
        slug: 'commercial',
        icon: 'store',
        description: 'Offices, shops and warehouses',
        fields: [{ fieldKey: 'propertyType', label: 'Property type', inputType: 'select', required: true, filterable: true, options: ['Office', 'Shop', 'Warehouse', 'Building'] }],
      },
    ],
  },
  {
    name: 'Electronics',
    slug: 'electronics',
    icon: 'electronics',
    description: 'Phones, computers, TVs, cameras and gaming',
    listingTypes: ['sale'],
    fields: [CONDITION],
    children: [
      { name: 'Mobile Phones', slug: 'mobile-phones', icon: 'phone', description: 'Smartphones and accessories', fields: [BRAND(['Apple', 'Samsung', 'Huawei', 'Xiaomi', 'Oppo', 'Google', 'Other'])] },
      {
        name: 'Computers',
        slug: 'computers',
        icon: 'laptop',
        description: 'Laptops, desktops and accessories',
        children: [
          { name: 'Laptops', slug: 'laptops', fields: [BRAND(['Apple', 'Dell', 'HP', 'Lenovo', 'Asus', 'Acer', 'Other'])] },
          { name: 'Desktops', slug: 'desktops', fields: [BRAND(['Apple', 'Dell', 'HP', 'Lenovo', 'Custom built', 'Other'])] },
          { name: 'Computer Accessories', slug: 'computer-accessories', description: 'Monitors, keyboards, printers and more' },
        ],
      },
      { name: 'TV & Audio', slug: 'tv-audio', icon: 'tv', description: 'Televisions, speakers and headphones' },
      { name: 'Cameras', slug: 'cameras', icon: 'camera', description: 'Cameras, lenses and drones' },
      { name: 'Gaming', slug: 'gaming', icon: 'gaming', description: 'Consoles, games and accessories' },
      { name: 'Other Electronics', slug: 'other-electronics' },
    ],
  },
  {
    name: 'Home & Furniture',
    slug: 'home-furniture',
    icon: 'furniture',
    description: 'Furniture, kitchen and home decor',
    listingTypes: ['sale'],
    fields: [CONDITION],
    children: [
      { name: 'Sofas & Chairs', slug: 'sofas-chairs', icon: 'sofa' },
      { name: 'Beds & Wardrobes', slug: 'beds-wardrobes', icon: 'bed' },
      { name: 'Dining', slug: 'dining', description: 'Dining tables and sets' },
      { name: 'Office Furniture', slug: 'office-furniture' },
      { name: 'Kitchen & Appliances', slug: 'kitchen-appliances', icon: 'kitchen' },
      { name: 'Home Decor', slug: 'home-decor', icon: 'decor' },
      { name: 'Other Furniture', slug: 'other-furniture' },
    ],
  },
  {
    name: 'Services',
    slug: 'services',
    icon: 'services',
    description: 'Cleaning, moving, maintenance and more',
    listingTypes: ['service'],
    fields: [
      { fieldKey: 'areaCovered', label: 'Area covered', inputType: 'text', required: true },
      { fieldKey: 'priceType', label: 'Price type', inputType: 'select', required: true, options: ['Fixed', 'Starting from'] },
    ],
    children: [
      { name: 'Cleaning', slug: 'cleaning', icon: 'cleaning' },
      { name: 'Moving', slug: 'moving', icon: 'truck' },
      { name: 'Maintenance & Repair', slug: 'maintenance-repair', icon: 'tools', description: 'AC, plumbing, electrical and handyman' },
      { name: 'Tutoring', slug: 'tutoring', icon: 'education' },
      { name: 'Car Services', slug: 'car-services', icon: 'car' },
      { name: 'Other Services', slug: 'other-services' },
    ],
  },
]

/**
 * Where ads from the first version (five fixed categories) move to.
 * The first matching rule wins; the attribute picks the new subcategory.
 */
export const LEGACY_CATEGORY_MAP = {
  cat_cars: { default: 'cars' },
  cat_property: { attribute: 'propertyType', map: { Apartment: 'apartments', Floor: 'apartments', Villa: 'villas', Land: 'land', Office: 'commercial', Shop: 'commercial' }, default: 'apartments' },
  cat_electronics: { attribute: 'itemType', map: { 'Mobile phone': 'mobile-phones', Laptop: 'laptops', Television: 'tv-audio', Camera: 'cameras', Gaming: 'gaming' }, default: 'other-electronics' },
  cat_furniture: { attribute: 'itemType', map: { Sofa: 'sofas-chairs', Bed: 'beds-wardrobes', Wardrobe: 'beds-wardrobes', 'Dining set': 'dining', 'Office furniture': 'office-furniture', Decor: 'home-decor' }, default: 'other-furniture' },
  cat_services: { attribute: 'serviceCategory', map: { Cleaning: 'cleaning', Moving: 'moving', Maintenance: 'maintenance-repair', 'AC repair': 'maintenance-repair', Tutoring: 'tutoring', 'Car services': 'car-services' }, default: 'other-services' },
}
