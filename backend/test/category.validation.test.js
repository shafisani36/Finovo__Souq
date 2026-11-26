import { test } from 'node:test'
import assert from 'node:assert/strict'
import { slugify, validateCategory } from '../src/modules/categories/category.validation.js'

const errorsOf = (fn) => {
  try {
    fn()
    return null
  } catch (error) {
    return Object.fromEntries(error.errors.map((e) => [e.field, e.message]))
  }
}

test('slugify', () => {
  assert.equal(slugify('Home & Furniture'), 'home-and-furniture')
  assert.equal(slugify('  TV / Audio!! '), 'tv-audio')
})

test('valid category with fields', () => {
  const data = validateCategory({
    name: 'Trucks',
    parentId: '',
    listingTypes: ['sale', 'sale'],
    fields: [
      { fieldKey: 'axles', label: 'Axles', inputType: 'number', min: '2', max: '6', filterable: true },
      { fieldKey: 'notes', label: 'Notes', inputType: 'text', filterable: true },
      { fieldKey: 'fuel', label: 'Fuel', inputType: 'select', options: ['Diesel', 'Diesel', ' Petrol ', ''] },
    ],
  })
  assert.equal(data.parent, null)
  assert.deepEqual(data.listingTypes, ['sale'])
  assert.deepEqual(data.fields[0], { fieldKey: 'axles', label: 'Axles', inputType: 'number', required: false, filterable: true, min: 2, max: 6 })
  assert.equal(data.fields[1].filterable, false)
  assert.deepEqual(data.fields[2].options, ['Diesel', 'Petrol'])
})

test('rejects bad input', () => {
  const errors = errorsOf(() => validateCategory({
    name: 'X',
    parentId: 'nope',
    icon: 'rocket',
    listingTypes: ['auction'],
    fields: [
      { fieldKey: 'Bad key', label: 'A', inputType: 'date' },
      { fieldKey: 'size', label: 'Size', inputType: 'number', min: 10, max: 2 },
      { fieldKey: 'colour', label: 'Colour', inputType: 'select', options: [] },
    ],
  }))
  assert.ok(errors.name && errors.parentId && errors.icon && errors.listingTypes)
  assert.ok(errors['fields.0.fieldKey'] && errors['fields.0.label'] && errors['fields.0.inputType'])
  assert.ok(errors['fields.1.max'])
  assert.ok(errors['fields.2.options'])
})

test('duplicate field keys', () => {
  const errors = errorsOf(() => validateCategory({ name: 'Boats', fields: [{ fieldKey: 'size', label: 'Size', inputType: 'text' }, { fieldKey: 'size', label: 'Size 2', inputType: 'text' }] }))
  assert.match(errors.fields, /used twice/)
})

test('partial edit only returns sent keys', () => {
  assert.deepEqual(validateCategory({ isActive: false }, { partial: true }), { isActive: false })
})
