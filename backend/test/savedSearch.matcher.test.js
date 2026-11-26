import { test } from 'node:test'
import assert from 'node:assert/strict'
import { matchesCriteria } from '../src/modules/alerts/savedSearch.matcher.js'

const categories = { vehicles: { id: 'v' }, cars: { id: 'c' }, property: { id: 'p' } }
const bySlug = (slug) => categories[slug]
const car = {
  title: 'Toyota Camry 2021',
  description: 'Single owner, full service history',
  price: 72000,
  city: 'Riyadh',
  categoryPath: ['v', 'c'],
  attributes: { make: 'Toyota', year: 2021, mileage: 40000 },
}

test('empty criteria match everything', () => {
  assert.equal(matchesCriteria({}, car, bySlug), true)
})

test('a parent category matches ads in its branch', () => {
  assert.equal(matchesCriteria({ category: 'vehicles' }, car, bySlug), true)
  assert.equal(matchesCriteria({ category: 'property' }, car, bySlug), false)
  assert.equal(matchesCriteria({ category: 'deleted-category' }, car, bySlug), false)
})

test('city, price and text', () => {
  assert.equal(matchesCriteria({ city: 'Jeddah' }, car, bySlug), false)
  assert.equal(matchesCriteria({ minPrice: '50000', maxPrice: '80000' }, car, bySlug), true)
  assert.equal(matchesCriteria({ maxPrice: '70000' }, car, bySlug), false)
  assert.equal(matchesCriteria({ q: 'service HISTORY' }, car, bySlug), true)
  assert.equal(matchesCriteria({ q: 'nissan' }, car, bySlug), false)
})

test('detail filters', () => {
  assert.equal(matchesCriteria({ f_make: 'Toyota', f_year_min: '2020', f_mileage_max: '50000' }, car, bySlug), true)
  assert.equal(matchesCriteria({ f_make: 'Honda' }, car, bySlug), false)
  assert.equal(matchesCriteria({ f_year_min: '2022' }, car, bySlug), false)
  assert.equal(matchesCriteria({ f_bedrooms_min: '2' }, car, bySlug), false)
  assert.equal(matchesCriteria({ f_year_min: 'abc' }, car, bySlug), true)
})
