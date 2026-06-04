'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

const ERROR_ID = 'register-error'

export default function RegisterForm() {
  const router = useRouter()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (isLoading) return

    setError(null)

    if (!username.trim() || !password) {
      setError('Username and password are required')
      return
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    setIsLoading(true)
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      })

      if (res.ok) {
        router.push('/login')
        return
      }

      let data: { code?: string } = {}
      try {
        data = await res.json()
      } catch {
        // non-JSON error body (e.g. HTML 500 page)
      }

      if (data.code === 'USERNAME_TAKEN') {
        setError('Username already taken')
      } else if (data.code === 'VALIDATION_ERROR') {
        setError('Username and password are required')
      } else {
        setError('Registration failed. Please try again.')
      }
    } finally {
      setIsLoading(false)
    }
  }

  const isPasswordMismatch = error === 'Passwords do not match'
  const hasUsernameOrPasswordError = error !== null && !isPasswordMismatch

  return (
    <form onSubmit={handleSubmit} noValidate>
      <div>
        <label htmlFor="username">Username</label>
        <input
          id="username"
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoComplete="username"
          required
          aria-invalid={hasUsernameOrPasswordError || undefined}
          aria-describedby={hasUsernameOrPasswordError ? ERROR_ID : undefined}
        />
      </div>
      <div>
        <label htmlFor="password">Password</label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
          required
          aria-invalid={hasUsernameOrPasswordError || undefined}
          aria-describedby={hasUsernameOrPasswordError ? ERROR_ID : undefined}
        />
      </div>
      <div>
        <label htmlFor="confirm-password">Confirm password</label>
        <input
          id="confirm-password"
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          autoComplete="new-password"
          required
          aria-invalid={isPasswordMismatch || undefined}
          aria-describedby={isPasswordMismatch ? ERROR_ID : undefined}
        />
      </div>
      <p
        id={ERROR_ID}
        aria-live="assertive"
        aria-atomic="true"
        style={{ minHeight: '1em' }}
      >
        {error ?? ''}
      </p>
      <button type="submit" disabled={isLoading}>
        {isLoading ? 'Creating account…' : 'Create account'}
      </button>
    </form>
  )
}
