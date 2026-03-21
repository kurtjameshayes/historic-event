import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HistoryScreen } from '../HistoryScreen'

vi.mock('motion/react', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  },
}))

const mockListSessions = vi.fn()
const mockGetTimeline = vi.fn()
const mockRestartSession = vi.fn()

vi.mock('../../services/api', () => ({
  listSessions: (...args: any[]) => mockListSessions(...args),
  getTimeline: (...args: any[]) => mockGetTimeline(...args),
  restartSession: (...args: any[]) => mockRestartSession(...args),
}))

beforeEach(() => {
  vi.clearAllMocks()
  vi.useFakeTimers({ shouldAdvanceTime: true })
})

afterEach(() => {
  vi.useRealTimers()
})

import { afterEach } from 'vitest'

describe('HistoryScreen', () => {
  const mockOnLoadResults = vi.fn()
  const mockOnResumeSession = vi.fn()

  it('renders the title and search input', async () => {
    mockListSessions.mockResolvedValue([])

    render(
      <HistoryScreen onLoadResults={mockOnLoadResults} onResumeSession={mockOnResumeSession} />,
    )

    expect(screen.getByText('Investigation History')).toBeInTheDocument()
    expect(screen.getByPlaceholderText(/search investigations/i)).toBeInTheDocument()
  })

  it('shows empty state when no sessions', async () => {
    mockListSessions.mockResolvedValue([])

    render(
      <HistoryScreen onLoadResults={mockOnLoadResults} onResumeSession={mockOnResumeSession} />,
    )

    await waitFor(() => {
      expect(screen.getByText(/no investigations found/i)).toBeInTheDocument()
    })
  })

  it('displays sessions after loading', async () => {
    mockListSessions.mockResolvedValue([
      {
        id: 's1',
        query_id: 'q1',
        query: 'What caused WW2?',
        status: 'COMPLETE',
        created_at: new Date().toISOString(),
        updated_at: null,
        completed_at: new Date().toISOString(),
        config: { max_depth: 3, max_cycles: 2 },
      },
    ])

    render(
      <HistoryScreen onLoadResults={mockOnLoadResults} onResumeSession={mockOnResumeSession} />,
    )

    await waitFor(() => {
      expect(screen.getByText(/What caused WW2/)).toBeInTheDocument()
    })
  })

  it('shows error status badge for errored sessions', async () => {
    mockListSessions.mockResolvedValue([
      {
        id: 's2',
        query_id: 'q2',
        query: 'Failed query',
        status: 'ERROR',
        created_at: new Date().toISOString(),
        updated_at: null,
        completed_at: null,
        config: { max_depth: 1, max_cycles: 1 },
      },
    ])

    render(
      <HistoryScreen onLoadResults={mockOnLoadResults} onResumeSession={mockOnResumeSession} />,
    )

    await waitFor(() => {
      expect(screen.getByText('Error')).toBeInTheDocument()
    })
  })

  it('shows error when fetch fails', async () => {
    mockListSessions.mockRejectedValue(new Error('Network error'))

    render(
      <HistoryScreen onLoadResults={mockOnLoadResults} onResumeSession={mockOnResumeSession} />,
    )

    await waitFor(() => {
      expect(screen.getByText(/Network error/)).toBeInTheDocument()
    })
  })

  it('loads results when clicking complete session', async () => {
    mockListSessions.mockResolvedValue([
      {
        id: 's1',
        query_id: 'q1',
        query: 'Berlin Wall query',
        status: 'COMPLETE',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        completed_at: new Date().toISOString(),
        config: { max_depth: 1, max_cycles: 1 },
      },
    ])
    mockGetTimeline.mockResolvedValueOnce({
      target_event: { name: 'Berlin Wall' },
      threads: [],
      events: [],
      edges: [],
      subtopics: [],
      narrative: 'story',
    })

    render(
      <HistoryScreen onLoadResults={mockOnLoadResults} onResumeSession={mockOnResumeSession} />,
    )

    await waitFor(() => {
      expect(screen.getByText(/Berlin Wall query/)).toBeInTheDocument()
    })

    await userEvent.click(screen.getByText(/Berlin Wall query/))

    await waitFor(() => {
      expect(mockOnLoadResults).toHaveBeenCalled()
    })
  })
})
