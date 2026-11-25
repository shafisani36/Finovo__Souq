import { findCategory, SAUDI_CITIES } from '../../config/catalog.js'
import ApiError from '../../utils/ApiError.js'
import { toText } from '../../utils/pagination.js'

const MAX_PRICE = 100_000_000

/** Checks the category-specific details and keeps only the fields that category defines */
const cleanAttributes = (category, input, errors) => {
  const attributes = {}
  const source = input && typeof input === 'object' ? input : {}

  for (const field of category.fields) {
    const raw = source[field.fieldKey]
    const empty = raw === undefined || raw === null || toText(String(raw)) === ''
    const key = `attributes.${field.fieldKey}`

    if (empty) {
      if (field.required) errors[key] = `${field.label} is required`
      continue
    }

    if (field.inputType === 'number') {
      const value = Number(raw)
      const maxYear = new Date().getFullYear() + 1
      if (!Number.isFinite(value) || value < 0) errors[key] = `${field.label} must be a positive number`
      else if (field.fieldKey === 'year' && (value < 1950 || value > maxYear)) errors[key] = 'Enter a valid year'
      else attributes[field.fieldKey] = value
    } else {
      const value = toText(String(raw)).slice(0, 80)
      if (field.options && !field.options.includes(value)) errors[key] = `Choose a valid ${field.label.toLowerCase()}`
      else attributes[field.fieldKey] = value
    }
  }

  return attributes
}

/** Validates a full ad; for edits pass the merged old and new values */
export const validateListing = (body) => {
  const errors = {}
  const category = findCategory(toText(body.categoryId))
  if (!category) throw ApiError.validation({ categoryId: 'Choose a category' })

  const title = toText(body.title)
  const description = toText(body.description)
  const price = Number(body.price)
  const city = toText(body.city)
  const district = toText(body.district)
  const listingType = toText(body.listingType) || category.listingTypes[0]

  if (title.length < 10 || title.length > 90) errors.title = 'Title must be 10 to 90 characters'
  if (description.length < 30 || description.length > 4000) errors.description = 'Description must be 30 to 4000 characters'
  if (!Number.isFinite(price) || price <= 0 || price > MAX_PRICE) errors.price = 'Enter a price greater than 0'
  if (!SAUDI_CITIES.includes(city)) errors.city = 'Choose a city from the list'
  if (district.length < 2 || district.length > 60) errors.district = 'Enter the district or area'
  if (!category.listingTypes.includes(listingType)) errors.listingType = 'This category does not allow that ad type'

  const attributes = cleanAttributes(category, body.attributes, errors)
  if (Object.keys(errors).length) throw ApiError.validation(errors)

  return { categoryId: category.id, listingType, title, description, price, city, district, attributes }
}
