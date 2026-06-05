'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Field,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field'

type ErrorCode =
  | 'required'
  | 'invalid_credentials'
  | 'generic'
  | null

export default function LoginForm() {
  const router = useRouter()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [errorCode, setErrorCode] = useState<ErrorCode>(null)
  const [isLoading, setIsLoading] = useState(false)

  async function handleSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault()
    if (isLoading) return

    setErrorCode(null)

    if (!username.trim() || !password) {
      setErrorCode('required')
      return
    }

    setIsLoading(true)
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      })

      if (res.ok) {
        router.push('/')
        return
      }

      let data: { code?: string } = {}
      try {
        data = await res.json()
      } catch {
        // non-JSON error body
      }

      if (data.code === 'INVALID_CREDENTIALS') {
        setErrorCode('invalid_credentials')
      } else if (data.code === 'VALIDATION_ERROR') {
        setErrorCode('required')
      } else {
        setErrorCode('generic')
      }
    } finally {
      setIsLoading(false)
    }
  }

  const fieldError =
    errorCode === 'required' ? 'Username and password are required' : null

  const formError =
    errorCode === 'invalid_credentials'
      ? 'Invalid username or password'
      : errorCode === 'generic'
        ? 'Login failed. Please try again.'
        : null

  const hasFieldError = !!fieldError

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
      <FieldGroup>
        <Field data-invalid={hasFieldError ? true : undefined}>
          <FieldLabel htmlFor="username">Username</FieldLabel>
          <Input
            id="username"
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            required
            aria-invalid={hasFieldError ? true : undefined}
            aria-describedby={hasFieldError ? 'login-error' : undefined}
          />
        </Field>

        <Field data-invalid={hasFieldError ? true : undefined}>
          <FieldLabel htmlFor="password">Password</FieldLabel>
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
            aria-invalid={hasFieldError ? true : undefined}
            aria-describedby={hasFieldError ? 'login-error' : undefined}
          />
        </Field>
      </FieldGroup>

      <p
        id="login-error"
        role="alert"
        aria-live="assertive"
        aria-atomic="true"
        style={{ minHeight: '1em' }}
        className="text-sm text-destructive"
      >
        {fieldError ?? formError ?? ''}
      </p>

      <Button type="submit" disabled={isLoading} className="w-full">
        {isLoading ? 'Signing in…' : 'Sign in'}
      </Button>
    </form>
  )
}
