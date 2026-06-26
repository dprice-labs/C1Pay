import { getAuthUser } from '@/lib/auth'
import { getInboxRequests, getOutgoingRequests } from '@/lib/requests'
import { createLogger } from '@/lib/logger'
import { RequestCard } from './RequestCard'
import { OutgoingRequestCard } from './OutgoingRequestCard'
import { RequestListSection } from './RequestListSection'

const log = createLogger('inbox-page')

export default async function InboxPage() {
  const { userId } = await getAuthUser()
  // allSettled (not all) so a failure in one query doesn't take down the section that
  // would otherwise have rendered fine — each section degrades independently.
  const [incomingResult, outgoingResult] = await Promise.allSettled([
    getInboxRequests(userId),
    getOutgoingRequests(userId),
  ])

  if (incomingResult.status === 'rejected') {
    log.error(`getInboxRequests failed: ${incomingResult.reason}`)
  }
  if (outgoingResult.status === 'rejected') {
    log.error(`getOutgoingRequests failed: ${outgoingResult.reason}`)
  }

  const incoming = incomingResult.status === 'fulfilled' ? incomingResult.value : []
  const outgoing = outgoingResult.status === 'fulfilled' ? outgoingResult.value : []

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8">
      <RequestListSection
        heading="Inbox"
        headingClassName="text-2xl font-semibold"
        as="h1"
        items={incoming}
        emptyText="No pending requests."
        error={incomingResult.status === 'rejected' ? 'Could not load your inbox right now.' : undefined}
        renderItem={(item) => <RequestCard item={item} />}
      />

      <RequestListSection
        heading="Outgoing requests"
        headingClassName="text-xl font-semibold"
        as="h2"
        items={outgoing}
        emptyText="No outgoing requests."
        error={
          outgoingResult.status === 'rejected' ? 'Could not load your outgoing requests right now.' : undefined
        }
        renderItem={(item) => <OutgoingRequestCard item={item} />}
      />
    </div>
  )
}
