import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockGetConfig = vi.fn().mockResolvedValue({ apiUrl: 'https://api.example.com' })
vi.stubGlobal('electronAPI', { getConfig: mockGetConfig, saveImage: vi.fn(), setConfig: vi.fn() })

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

import { listCodes, deleteCode } from '../api'

beforeEach(() => vi.clearAllMocks())

describe('listCodes', () => {
  it('发起 GET /codes 请求并返回数组', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([{ id: 'abc', scan_count: 5, created_at: '2026-01-01T00:00:00Z' }]),
    })
    const result = await listCodes()
    expect(mockFetch).toHaveBeenCalledWith('https://api.example.com/codes')
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('abc')
  })
})

describe('deleteCode', () => {
  it('发起 DELETE /codes/:id 请求', async () => {
    mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve({ success: true }) })
    await deleteCode('abc')
    expect(mockFetch).toHaveBeenCalledWith('https://api.example.com/codes/abc', { method: 'DELETE' })
  })
})
