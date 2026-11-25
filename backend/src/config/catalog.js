/**
 * Categories and their ad fields. Kept in code because adding a category also needs
 * a matching icon and filters in the frontend; listing counts are added at request time.
 */
const GENERAL_CONDITIONS = ['New', 'Like new', 'Used - good', 'Used - fair']

export const CATEGORIES = [
  {
    id: 'cat_cars',
    name: 'Cars',
    slug: 'cars',
    icon: 'car',
    description: 'New and used cars from owners and dealers',
    listingTypes: ['sale'],
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
    listingTypes: ['sale', 'rent'],
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
    listingTypes: ['sale'],
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
    listingTypes: ['sale'],
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
    listingTypes: ['service'],
    fields: [
      { fieldKey: 'serviceCategory', label: 'Service category', inputType: 'select', required: true, filterable: true, options: ['Cleaning', 'Moving', 'Maintenance', 'AC repair', 'Tutoring', 'Car services', 'Other'] },
      { fieldKey: 'areaCovered', label: 'Area covered', inputType: 'text', required: true, filterable: false },
      { fieldKey: 'priceType', label: 'Price type', inputType: 'select', required: true, filterable: false, options: ['Fixed', 'Starting from'] },
    ],
  },
]

export const findCategory = (idOrSlug) => CATEGORIES.find((c) => c.id === idOrSlug || c.slug === idOrSlug)

export const SAUDI_CITIES = ['Riyadh', 'Jeddah', 'Mecca', 'Medina', 'Dammam', 'Khobar', 'Taif', 'Abha', 'Tabuk', 'Buraidah']
