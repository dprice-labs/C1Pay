'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field'

type ErrorCode =
  | 'required'
  | 'password_too_short'
  | 'password_mismatch'
  | 'username_taken'
  | 'generic'
  | null

export default function RegisterForm() {
  const router = useRouter()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
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

    if (password.length < 8) {
      setErrorCode('password_too_short')
      return
    }

    if (password !== confirmPassword) {
      setErrorCode('password_mismatch')
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
        // non-JSON error body
      }

      if (data.code === 'USERNAME_TAKEN') {
        setErrorCode('username_taken')
      } else if (data.code === 'VALIDATION_ERROR') {
        setErrorCode('required')
      } else {
        setErrorCode('generic')
      }
    } finally {
      setIsLoading(false)
    }
  }

  const usernameError =
    errorCode === 'required'
      ? 'Username is required'
      : errorCode === 'username_taken'
        ? 'Username already taken'
        : null

  const passwordError =
    errorCode === 'required'
      ? 'Password is required'
      : errorCode === 'password_too_short'
        ? 'Password must be at least 8 characters'
        : null

  const confirmPasswordError =
    errorCode === 'password_mismatch' ? 'Passwords do not match' : null

  const formError =
    errorCode === 'generic' ? 'Registration failed. Please try again.' : null

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
      <FieldGroup>
        <Field data-invalid={usernameError ? true : undefined}>
          <FieldLabel htmlFor="username">Username</FieldLabel>
          <Input
            id="username"
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            required
            aria-invalid={usernameError ? true : undefined}
            aria-describedby={usernameError ? 'username-error' : undefined}
          />
          {usernameError && (
            <FieldError id="username-error" aria-live="polite">
              {usernameError}
            </FieldError>
          )}
        </Field>

        <Field data-invalid={passwordError ? true : undefined}>
          <FieldLabel htmlFor="password">Password</FieldLabel>
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            required
            aria-invalid={passwordError ? true : undefined}
            aria-describedby={passwordError ? 'password-error' : undefined}
          />
          {passwordError && (
            <FieldError id="password-error" aria-live="polite">
              {passwordError}
            </FieldError>
          )}
        </Field>

        <Field data-invalid={confirmPasswordError ? true : undefined}>
          <FieldLabel htmlFor="confirm-password">Confirm password</FieldLabel>
          <Input
            id="confirm-password"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            autoComplete="new-password"
            required
            aria-invalid={confirmPasswordError ? true : undefined}
            aria-describedby={
              confirmPasswordError ? 'confirm-password-error' : undefined
            }
          />
          {confirmPasswordError && (
            <FieldError id="confirm-password-error" aria-live="polite">
              {confirmPasswordError}
            </FieldError>
          )}
        </Field>
      </FieldGroup>

      {formError && (
        <p
          role="alert"
          aria-live="assertive"
          aria-atomic="true"
          className="text-sm text-destructive"
        >
          {formError}
        </p>
      )}

      <Button type="submit" disabled={isLoading} className="w-full">
        {isLoading ? 'Creating account…' : 'Create account'}
      </Button>
    </form>
  )
}
