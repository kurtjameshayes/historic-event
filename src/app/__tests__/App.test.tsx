import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from '../App'

vi.mock('../services/api', () => ({
  createSession: vi.fn(),
}))

vi.mock('../services/sse', () => ({
  connectSSE: vi.fn(() => vi.fn()),
}))

vi.mock('../components/StatusScreen', () => ({
  StatusScreen: ({ query, sessionId }: { query: string; sessionId: string }) => (
    <div data-testid="status-screen">
      <span data-testid="status-query">{query}</span>
      <span data-testid="status-session">{sessionId}</span>
    </div>
  ),
}))

vi.mock('../components/ResultsScreen', () => ({
  ResultsScreen: ({ onReset }: { onReset: () => void }) => (
    <div data-testid="results-screen">
      <button onClick={onReset}>New Query</button>
    </div>
  ),
}))

vi.mock('../components/HistoryScreen', () => ({
  HistoryScreen: () => <div data-testid="history-screen">History</div>,
}))

vi.mock('../components/AboutScreen', () => ({
  AboutScreen: ({ onBack }: { onBack: () => void }) => (
    <div data-testid="about-screen">
      <button onClick={onBack}>Back</button>
    </div>
  ),
}))

beforeEach(() => {
  vi.clearAllMocks()
})

describe('App', () => {
  it('renders the input screen by default', () => {
    render(<App />)
    expect(screen.getByPlaceholderText(/ask about a historical event/i)).toBeInTheDocument()
  })

  it('shows the nav bar with all buttons', () => {
    render(<App />)
    expect(screen.getByText('New Query')).toBeInTheDocument()
    expect(screen.getByText('Investigation Results')).toBeInTheDocument()
    expect(screen.getByText('About')).toBeInTheDocument()
  })

  it('navigates to history screen', async () => {
    render(<App />)
    await userEvent.click(screen.getByText('Investigation Results'))
    expect(screen.getByTestId('history-screen')).toBeInTheDocument()
  })

  it('navigates to about screen', async () => {
    render(<App />)
    await userEvent.click(screen.getByText('About'))
    expect(screen.getByTestId('about-screen')).toBeInTheDocument()
  })

  it('transitions to researching state after submitting query', async () => {
    const { createSession } = await import('../services/api')
    const mockCreate = vi.mocked(createSession)
    mockCreate.mockResolvedValueOnce({ session_id: 'test-session', query_id: 'q1' })

    render(<App />)

    const input = screen.getByPlaceholderText(/ask about a historical event/i)
    await userEvent.type(input, 'What caused the Fall of the Berlin Wall?')
    await userEvent.click(screen.getByText('Investigate'))

    await waitFor(() => {
      expect(screen.getByTestId('status-screen')).toBeInTheDocument()
    })
  })

  it('shows error when session creation fails', async () => {
    const { createSession } = await import('../services/api')
    const mockCreate = vi.mocked(createSession)
    mockCreate.mockRejectedValueOnce(new Error('Server error'))

    render(<App />)

    const input = screen.getByPlaceholderText(/ask about a historical event/i)
    await userEvent.type(input, 'Test query')
    await userEvent.click(screen.getByText('Investigate'))

    await waitFor(() => {
      expect(screen.getByText(/server error/i)).toBeInTheDocument()
    })
  })

  it('resets to input screen via title button', async () => {
    render(<App />)
    await userEvent.click(screen.getByText('About'))
    expect(screen.getByTestId('about-screen')).toBeInTheDocument()

    await userEvent.click(screen.getByText('Historical Causal Timeline'))
    expect(screen.getByPlaceholderText(/ask about a historical event/i)).toBeInTheDocument()
  })
})
