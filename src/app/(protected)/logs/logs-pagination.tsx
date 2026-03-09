'use client';

import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { useCallback } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LogsPaginationProps {
    currentPage: number;
    totalPages: number;
}

export function LogsPagination({ currentPage, totalPages }: LogsPaginationProps) {
    const searchParams = useSearchParams();
    const router = useRouter();
    const pathname = usePathname();

    const goToPage = useCallback(
        (page: number) => {
            const params = new URLSearchParams(searchParams.toString());
            if (page <= 1) {
                params.delete('page');
            } else {
                params.set('page', String(page));
            }
            router.push(`${pathname}?${params.toString()}`);
        },
        [searchParams, router, pathname]
    );

    return (
        <div className="flex items-center justify-center gap-3 py-4">
            <button
                onClick={() => goToPage(currentPage - 1)}
                disabled={currentPage <= 1}
                className={cn(
                    "p-2 rounded-lg border transition-colors",
                    currentPage <= 1
                        ? "opacity-40 cursor-not-allowed"
                        : "hover:bg-accent/10"
                )}
            >
                <ChevronLeft className="w-4 h-4" />
            </button>

            <span className="text-sm text-muted-foreground tabular-nums">
                {currentPage} / {totalPages}
            </span>

            <button
                onClick={() => goToPage(currentPage + 1)}
                disabled={currentPage >= totalPages}
                className={cn(
                    "p-2 rounded-lg border transition-colors",
                    currentPage >= totalPages
                        ? "opacity-40 cursor-not-allowed"
                        : "hover:bg-accent/10"
                )}
            >
                <ChevronRight className="w-4 h-4" />
            </button>
        </div>
    );
}
