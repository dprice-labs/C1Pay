import type { ReactNode } from 'react'

/**
 * A titled list-or-empty-state section, shared by the inbox page's incoming and
 * outgoing request lists.
 */
export function RequestListSection<T extends { id: number }>({
  heading,
  headingClassName,
  as: Heading,
  items,
  emptyText,
  error,
  renderItem,
}: {
  heading: string
  headingClassName: string
  as: 'h1' | 'h2'
  items: T[]
  emptyText: string
  error?: string
  renderItem: (item: T) => ReactNode
}) {
  return (
    <section className="flex flex-col gap-6">
      <Heading className={headingClassName}>{heading}</Heading>
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground">{emptyText}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {items.map((item) => (
            <li key={item.id}>{renderItem(item)}</li>
          ))}
        </ul>
      )}
    </section>
  )
}
