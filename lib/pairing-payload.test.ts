import { describe, expect, it } from 'vitest'
import { parsePairingPayload } from './pairing-payload'

const good = { v: 1, host: '100.87.175.39', port: 50987, code: 'F96CFMS8' }

describe('parsePairingPayload', () => {
  it('reads one of ours', () => {
    expect(parsePairingPayload(JSON.stringify(good))).toEqual({
      host: '100.87.175.39',
      port: 50987,
      code: 'F96CFMS8'
    })
  })

  it('ignores any other barcode the camera happens to see', () => {
    for (const raw of [
      '',
      'https://example.com',
      'not json',
      '[]',
      'null',
      JSON.stringify({ ...good, v: 2 }),
      JSON.stringify({ ...good, host: '' }),
      JSON.stringify({ ...good, port: 0 }),
      JSON.stringify({ ...good, port: 99999 }),
      JSON.stringify({ ...good, port: '50987' }),
      JSON.stringify({ ...good, code: 'short' })
    ]) {
      expect(parsePairingPayload(raw), raw).toBeNull()
    }
  })
})
