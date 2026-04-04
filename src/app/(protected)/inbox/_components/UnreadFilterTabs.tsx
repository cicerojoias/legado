'use client'

import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

interface UnreadFilterTabsProps {
  unreadTotal: number
}

export function UnreadFilterTabs({ unreadTotal }: UnreadFilterTabsProps) {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const isUnread = searchParams.get('filter') === 'unread'

  const setFilter = (filter: 'all' | 'unread') => {
    const params = new URLSearchParams(searchParams.toString())
    if (filter === 'unread') {
      params.set('filter', 'unread')
    } else {
      params.delete('filter')
    }
    const qs = params.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname)
  }

  return (
    <div className="flex items-center gap-2 px-3 py-2 border-b shrink-0">
      <button
        onClick={() => setFilter('all')}
        className={cn(
          'h-8 px-4 rounded-full text-sm font-medium transition-colors',
          !isUnread
            ? 'bg-primary text-primary-foreground'
            : 'text-muted-foreground hover:bg-muted/60'
        )}
      >
        Todas
      </button>
      <button
        onClick={() => setFilter('unread')}
        className={cn(
          'h-8 px-4 rounded-full text-sm font-medium transition-colors flex items-center gap-1.5',
          isUnread
            ? 'bg-primary text-primary-foreground'
            : 'text-muted-foreground hover:bg-muted/60'
        )}
      >
        Não lidas
        {unreadTotal > 0 && (
          <span
            className={cn(
              'min-w-[18px] h-[18px] rounded-full text-[11px] font-bold flex items-center justify-center px-1 leading-none',
              isUnread ? 'bg-white/30 text-white' : 'bg-green-500 text-white'
            )}
          >
            {unreadTotal > 99 ? '99+' : unreadTotal}
          </span>
        )}
      </button>
    </div>
  )
}
