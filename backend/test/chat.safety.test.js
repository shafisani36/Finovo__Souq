import { test } from 'node:test'
import assert from 'node:assert/strict'
import { detectRisks } from '../src/modules/chat/chat.safety.js'

test('ordinary questions raise no warning', () => {
  for (const text of ['Is it still available?', 'What is the mileage?', 'هل السيارة متوفرة؟', 'Price is 25,000 SAR', '']) {
    assert.deepEqual(detectRisks(text), [], text)
  }
})

test('deposits, bank details and transfers are flagged in English and Arabic', () => {
  assert.deepEqual(detectRisks('Send a 500 SAR deposit first'), ['payment'])
  assert.deepEqual(detectRisks('IBAN SA03 8000 0000 6080 1016 7519'), ['payment'])
  assert.deepEqual(detectRisks('حول عربون ٢٠٠ ريال'), ['payment'])
})

test('links, off-platform contact and code requests are flagged', () => {
  assert.deepEqual(detectRisks('pay here https://bit.ly/abc'), ['link'])
  assert.deepEqual(detectRisks('message me on whatsapp'), ['off_platform'])
  assert.deepEqual(detectRisks('رقمي ٠٥٥١٢٣٤٥٦٧'), ['off_platform'], 'Arabic digits count too')
  assert.deepEqual(detectRisks('send me the code you received'), ['code'])
  assert.deepEqual(detectRisks('can we meet tomorrow?'), ['meeting'])
})
