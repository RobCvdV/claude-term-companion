import { describe, expect, it } from 'vitest'
import { activeHost, forget, key, label, parseBook, remember, EMPTY_BOOK } from './hosts'

const mini = { host: '100.87.175.39', port: 50987, name: 'mac-mini' }
const vm = { host: '100.92.4.11', port: 50987, name: 'vm-ubuntu' }

describe('remember', () => {
  it('adds a host and makes it the live one', () => {
    const book = remember(EMPTY_BOOK, mini)
    expect(book.hosts).toEqual([mini])
    expect(activeHost(book)).toEqual(mini)
  })

  it('keeps the ones already there', () => {
    const book = remember(remember(EMPTY_BOOK, mini), vm)
    expect(book.hosts).toEqual([mini, vm])
    expect(activeHost(book)).toEqual(vm)
  })

  it('updates a host it already knows rather than duplicating it', () => {
    const book = remember(remember(EMPTY_BOOK, mini), { ...mini, name: 'renamed' })
    expect(book.hosts).toHaveLength(1)
    expect(book.hosts[0].name).toBe('renamed')
  })

  it('does not lose a name when the host has not told us one', () => {
    const book = remember(remember(EMPTY_BOOK, mini), { host: mini.host, port: mini.port })
    expect(book.hosts[0].name).toBe('mac-mini')
  })

  it('treats a different port as a different host', () => {
    const book = remember(remember(EMPTY_BOOK, mini), { ...mini, port: 50988 })
    expect(book.hosts).toHaveLength(2)
  })
})

describe('forget', () => {
  it('hands the connection to what is left', () => {
    const book = forget(remember(remember(EMPTY_BOOK, mini), vm), key(vm))
    expect(book.hosts).toEqual([mini])
    expect(activeHost(book)).toEqual(mini)
  })

  it('leaves the live one alone when another goes', () => {
    const book = forget(remember(remember(EMPTY_BOOK, mini), vm), key(mini))
    expect(activeHost(book)).toEqual(vm)
  })

  it('empties out on the last one', () => {
    const book = forget(remember(EMPTY_BOOK, mini), key(mini))
    expect(book).toEqual({ hosts: [], active: null })
  })
})

describe('parseBook', () => {
  it('round-trips', () => {
    const book = remember(remember(EMPTY_BOOK, mini), vm)
    expect(parseBook(JSON.stringify(book))).toEqual(book)
  })

  it('starts over rather than throwing on rubbish', () => {
    expect(parseBook(null)).toEqual(EMPTY_BOOK)
    expect(parseBook('not json')).toEqual(EMPTY_BOOK)
    expect(parseBook('[]')).toEqual(EMPTY_BOOK)
    expect(parseBook('{"hosts":"nope"}')).toEqual(EMPTY_BOOK)
  })

  it('drops entries that could never be dialled', () => {
    const book = parseBook('{"hosts":[{"host":"","port":1},{"port":2},{"host":"a","port":0},{"host":"b","port":"7"}]}')
    expect(book.hosts).toEqual([{ host: 'b', port: 7 }])
    expect(book.active).toBe('b:7')
  })

  it('falls back to the first host when the stored active one is gone', () => {
    expect(parseBook('{"hosts":[{"host":"a","port":1}],"active":"b:2"}').active).toBe('a:1')
  })
})

describe('label', () => {
  it('falls back to the address until the Mac names itself', () => {
    expect(label({ host: 'a', port: 1 })).toBe('a')
    expect(label({ host: 'a', port: 1, name: '  ' })).toBe('a')
    expect(label(mini)).toBe('mac-mini')
  })
})
