import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  createSession,
  getSession,
  getTimeline,
  getNarrative,
  deepenThread,
  listSessions,
  restartSession,
} from '../api'

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

function jsonResponse(data: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(data),
  }
}

beforeEach(() => {
  mockFetch.mockReset()
})

describe('createSession', () => {
  it('sends POST with query and config', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ session_id: 's1', query_id: 'q1' }, 201))

    const result = await createSession('What caused WW2?', {
      max_depth: 3,
      max_cycles: 2,
      max_sources_per_thread: 5,
      focus_threads: ['political'],
    })

    expect(result.session_id).toBe('s1')
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/sessions'),
      expect.objectContaining({ method: 'POST' }),
    )

    const body = JSON.parse(mockFetch.mock.calls[0][1].body)
    expect(body.query).toBe('What caused WW2?')
    expect(body.max_depth).toBe(3)
  })

  it('throws on server error', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ error: 'query is required' }, 400))
    await expect(createSession('', {} as any)).rejects.toThrow('query is required')
  })
})

describe('getSession', () => {
  it('fetches session by id', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ id: 's1', query: 'test', status: 'PLAN' }))
    const result = await getSession('s1')
    expect(result.query).toBe('test')
    expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('/api/sessions/s1'), expect.anything())
  })
})

describe('getTimeline', () => {
  it('fetches timeline data', async () => {
    const timelineData = {
      target_event: { name: 'Test', date: '2000' },
      threads: [],
      events: [],
      edges: [],
      subtopics: [],
      narrative: 'A narrative',
    }
    mockFetch.mockResolvedValueOnce(jsonResponse(timelineData))
    const result = await getTimeline('s1')
    expect(result.narrative).toBe('A narrative')
  })
})

describe('getNarrative', () => {
  it('fetches narrative', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ narrative: 'The story...' }))
    const result = await getNarrative('s1')
    expect(result.narrative).toBe('The story...')
  })
})

describe('deepenThread', () => {
  it('sends POST with thread_id', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ status: 'deepening', session_id: 's1' }))
    const result = await deepenThread('s1', 't-political')
    expect(result.status).toBe('deepening')

    const body = JSON.parse(mockFetch.mock.calls[0][1].body)
    expect(body.thread_id).toBe('t-political')
  })
})

describe('listSessions', () => {
  it('fetches all sessions', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse([{ id: 's1', query: 'Q1' }]))
    const result = await listSessions()
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('s1')
  })

  it('passes search parameter', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse([]))
    await listSessions('Berlin')
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('search=Berlin'),
      expect.anything(),
    )
  })

  it('omits search param when undefined', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse([]))
    await listSessions()
    expect(mockFetch.mock.calls[0][0]).not.toContain('search=')
  })
})

describe('restartSession', () => {
  it('sends POST and returns status', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ status: 'restarted', session_id: 's1' }))
    const result = await restartSession('s1')
    expect(result.status).toBe('restarted')
  })
})

describe('error handling', () => {
  it('throws with error message from response body', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ error: 'Not found' }, 404))
    await expect(getSession('bad-id')).rejects.toThrow('Not found')
  })

  it('throws with status code when no error body', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: () => Promise.reject(new Error('no json')),
    })
    await expect(getSession('bad-id')).rejects.toThrow('500')
  })
})
