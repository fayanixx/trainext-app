import { describe, expect, it } from 'vitest'
import { toCsv } from '@/lib/csv'

describe('toCsv', () => {
  it('escapes commas, quotes, and newlines', () => {
    const csv = toCsv(
      [{ name: 'Doe, Jane', note: 'Said "done"\nnext line' }],
      [
        { label: 'Name', value: (row) => row.name },
        { label: 'Note', value: (row) => row.note }
      ]
    )

    expect(csv).toBe('Name,Note\r\n"Doe, Jane","Said ""done""\nnext line"')
  })
})
