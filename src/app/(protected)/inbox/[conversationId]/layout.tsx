/**
 * Layout da conversa individual.
 *
 * Estabelece altura explícita para o chat sem depender do overflow-y-auto do <main>:
 * - Mobile: calc(100dvh - 4rem) → desconta a bottom nav (h-16 = 4rem)
 * - Desktop (md+): h-full → main.flex-1 já ocupa 100dvh
 *
 * overflow-hidden impede que o swipe-to-reply ou qualquer translação de bubble
 * cause scroll horizontal/vertical na página.
 */
export default function ConversationLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="h-[calc(100dvh-4rem)] md:h-full overflow-hidden flex flex-col">
      {children}
    </div>
  )
}
