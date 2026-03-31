import { ConversationListRealtimeSync } from './_components/ConversationListRealtimeSync'

export default function InboxLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <ConversationListRealtimeSync />
      {children}
    </>
  )
}
