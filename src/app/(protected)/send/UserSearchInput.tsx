'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface User {
  id: number
  username: string
}

interface UserSearchInputProps {
  onSelect: (user: User) => void
}

export function UserSearchInput({ onSelect }: UserSearchInputProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<User[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const [isOpen, setIsOpen] = useState(true)

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const controllerRef = useRef<AbortController | null>(null)

  // Abort any in-flight request and clear the pending debounce on unmount.
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      controllerRef.current?.abort()
    }
  }, [])

  async function runSearch(term: string) {
    // Aborting the previous request guarantees out-of-order responses can never
    // clobber the latest query's results.
    controllerRef.current?.abort()
    const controller = new AbortController()
    controllerRef.current = controller
    setLoading(true)
    setError(false)

    try {
      const res = await fetch(`/api/users/search?q=${encodeURIComponent(term)}`, {
        signal: controller.signal,
      })
      if (!res.ok) {
        setResults([])
        setError(true)
        return
      }
      const data: User[] = await res.json()
      setResults(data)
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return
      setResults([])
      setError(true)
    } finally {
      if (!controller.signal.aborted) setLoading(false)
    }
  }

  function handleChange(value: string) {
    setQuery(value)
    setActiveIndex(-1)
    setIsOpen(true)
    if (debounceRef.current) clearTimeout(debounceRef.current)

    const term = value.trim()
    if (term.length < 1) {
      controllerRef.current?.abort()
      setResults([])
      setLoading(false)
      setError(false)
      return
    }

    debounceRef.current = setTimeout(() => runSearch(term), 250)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Escape') {
      e.preventDefault()
      setActiveIndex(-1)
      setIsOpen(false)
      return
    }
    if (results.length === 0 || !isOpen) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex((i) => Math.min(i + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter' && activeIndex >= 0) {
      e.preventDefault()
      const user = results[activeIndex]
      if (user) onSelect(user)
    }
  }

  const uid = useId()
  const inputId = `${uid}input`
  const listboxId = `${uid}listbox`
  const trimmedQuery = query.trim()
  const isExpanded = trimmedQuery.length > 0 && results.length > 0 && isOpen
  const statusMessage = loading
    ? 'Searching…'
    : error
      ? 'Search failed — please try again'
      : trimmedQuery.length > 0 && results.length === 0
        ? 'No users found'
        : ''

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={inputId}>Search by username</Label>
        <Input
          id={inputId}
          type="search"
          autoComplete="off"
          placeholder="e.g. alice"
          value={query}
          onChange={(e) => handleChange(e.target.value)}
          onKeyDown={handleKeyDown}
          role="combobox"
          aria-label="Search for a recipient by username"
          aria-autocomplete="list"
          aria-haspopup="listbox"
          aria-expanded={isExpanded}
          aria-controls={listboxId}
          aria-activedescendant={activeIndex >= 0 ? `${uid}option${activeIndex}` : undefined}
        />
      </div>

      {/* Live region kept outside the listbox so the listbox holds only `option`
          children (a valid ARIA listbox); status changes are still announced. */}
      <div
        role="status"
        aria-live="polite"
        className={`px-1 text-sm ${error ? 'text-destructive' : 'text-muted-foreground'}`}
      >
        {statusMessage}
      </div>

      {/* Always rendered (even with no results) so `aria-controls` on the input
          above always resolves to a real element — axe's aria-valid-attr-value
          rule flags a dangling reference otherwise. */}
      <ul
        id={listboxId}
        role="listbox"
        aria-label="Matching users"
        className={results.length > 0 && isOpen ? 'flex flex-col gap-1' : 'hidden'}
      >
        {results.map((user, index) => (
          <li
            key={user.id}
            role="option"
            aria-selected={index === activeIndex}
            id={`${uid}option${index}`}
            onClick={() => onSelect(user)}
            className="w-full cursor-pointer rounded-md border bg-card px-4 py-2 text-sm hover:bg-accent"
          >
            {user.username}
          </li>
        ))}
      </ul>
    </div>
  )
}
