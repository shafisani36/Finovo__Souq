import { isValidObjectId } from 'mongoose'
import ApiError from '../../utils/ApiError.js'
import { toText } from '../../utils/pagination.js'
import { CATEGORY_ICONS, FIELD_INPUT_TYPES, LISTING_TYPES } from './category.model.js'

const MAX_FIELDS = 20
const MAX_OPTIONS = 50
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const FIELD_KEY_PATTERN = /^[a-z][a-zA-Z0-9]{1,29}$/

export const slugify = (text) => toText(text).toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60)

const optionalNumber = (value) => (value === undefined || value === null || value === '' ? undefined : Number(value))

const cleanField = (raw, index, errors) => {
  const at = (name) => `fields.${index}.${name}`
  const field = {
    fieldKey: toText(raw?.fieldKey),
    label: toText(raw?.label),
    inputType: toText(raw?.inputType),
    required: raw?.required === true,
    filterable: raw?.filterable === true,
  }

  if (!FIELD_KEY_PATTERN.test(field.fieldKey)) errors[at('fieldKey')] = 'Use 2 to 30 letters or digits, starting with a lowercase letter (for example "fuelType")'
  if (field.label.length < 2 || field.label.length > 40) errors[at('label')] = 'Label must be 2 to 40 characters'
  if (!FIELD_INPUT_TYPES.includes(field.inputType)) errors[at('inputType')] = 'Choose text, number or list'

  if (field.inputType === 'select') {
    const options = [...new Set((Array.isArray(raw?.options) ? raw.options : []).map((o) => toText(String(o)).slice(0, 60)).filter(Boolean))]
    if (!options.length || options.length > MAX_OPTIONS) errors[at('options')] = `Add 1 to ${MAX_OPTIONS} options`
    field.options = options
  }

  if (field.inputType === 'number') {
    const min = optionalNumber(raw?.min)
    const max = optionalNumber(raw?.max)
    const unit = toText(raw?.unit).slice(0, 10)
    if ([min, max].some((n) => n !== undefined && !Number.isFinite(n))) errors[at('min')] = 'Minimum and maximum must be numbers'
    else if (min !== undefined && max !== undefined && min > max) errors[at('max')] = 'Maximum must be greater than the minimum'
    Object.assign(field, min !== undefined && { min }, max !== undefined && { max }, unit && { unit })
  }

  // Free text cannot be filtered reliably, so only lists and numbers become filters
  if (field.inputType === 'text') field.filterable = false
  return field
}

/**
 * Validates the admin category form. `partial` is used for edits, where missing keys stay unchanged.
 * Returns only the keys that were sent, cleaned.
 */
export const validateCategory = (body, { partial = false } = {}) => {
  const errors = {}
  const data = {}
  const has = (key) => !partial || body[key] !== undefined

  if (has('name')) {
    data.name = toText(body.name)
    if (data.name.length < 2 || data.name.length > 60) errors.name = 'Name must be 2 to 60 characters'
  }
  if (body.nameAr !== undefined) {
    data.nameAr = toText(body.nameAr)
    if (data.nameAr.length > 60) errors.nameAr = 'Arabic name must be at most 60 characters'
  }
  if (body.slug !== undefined && body.slug !== '') {
    data.slug = toText(body.slug).toLowerCase()
    if (!SLUG_PATTERN.test(data.slug) || data.slug.length > 60) errors.slug = 'Use lowercase letters, digits and dashes only'
  }
  if (has('parentId')) {
    data.parent = body.parentId || null
    if (data.parent && !isValidObjectId(data.parent)) errors.parentId = 'Choose a valid parent category'
  }
  if (has('description')) {
    data.description = toText(body.description)
    if (data.description.length > 160) errors.description = 'Keep the description under 160 characters'
  }
  if (has('icon')) {
    data.icon = body.icon || null
    if (data.icon && !CATEGORY_ICONS.includes(data.icon)) errors.icon = 'Choose an icon from the list'
  }
  if (has('listingTypes')) {
    const types = Array.isArray(body.listingTypes) ? [...new Set(body.listingTypes)] : []
    if (types.some((t) => !LISTING_TYPES.includes(t))) errors.listingTypes = 'Choose sale, rent or service'
    data.listingTypes = types
  }
  if (has('isActive')) data.isActive = body.isActive !== false

  if (has('fields')) {
    const raw = Array.isArray(body.fields) ? body.fields : []
    if (raw.length > MAX_FIELDS) errors.fields = `A category can have up to ${MAX_FIELDS} own fields`
    data.fields = raw.slice(0, MAX_FIELDS).map((f, i) => cleanField(f, i, errors))
    const keys = data.fields.map((f) => f.fieldKey)
    const duplicate = keys.find((key, i) => key && keys.indexOf(key) !== i)
    if (duplicate) errors.fields = `The field key "${duplicate}" is used twice`
  }

  if (Object.keys(errors).length) throw ApiError.validation(errors)
  return data
}
