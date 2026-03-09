'use client';

import { useEffect } from 'react';
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';

export function DateNavigation({ currentDate }: { currentDate: string }) {
    const router = useRouter();
    const searchParams = useSearchParams();

    // currentDate is "YYYY-MM-DD"
    const parsedDate = new Date(currentDate + "T12:00:00Z");

    const buildUrl = (date: Date) => {
        const params = new URLSearchParams(searchParams.toString());
        params.set('date', date.toISOString().split('T')[0]);
        return `/hoje?${params.toString()}`;
    };

    const prevDate = new Date(parsedDate);
    prevDate.setDate(prevDate.getDate() - 1);

    const nextDate = new Date(parsedDate);
    nextDate.setDate(nextDate.getDate() + 1);

    // Prefetch adjacent dates as soon as the current date renders.
    // This causes Next.js to fetch the server data in the background,
    // so when the user clicks an arrow, the page already has the data cached.
    useEffect(() => {
        router.prefetch(buildUrl(prevDate));
        router.prefetch(buildUrl(nextDate));
        const todayParams = new URLSearchParams(searchParams.toString());
        todayParams.delete('date');
        router.prefetch(`/hoje?${todayParams.toString()}`);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentDate]);

    const onNextDay = () => router.push(buildUrl(nextDate));
    const onPrevDay = () => router.push(buildUrl(prevDate));

    const onTodayDay = () => {
        const params = new URLSearchParams(searchParams.toString());
        params.delete('date');
        router.push(`/hoje?${params.toString()}`);
    };

    const formatShortDate = (date: Date) => {
        return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', '');
    };

    return (
        <div className="flex items-center justify-between w-full max-w-sm mx-auto mt-2">
            <button
                onClick={onPrevDay}
                className="flex items-center justify-center p-2 rounded-full hover:bg-muted active:scale-95 transition-all text-muted-foreground"
            >
                <ChevronLeft className="w-5 h-5" />
            </button>

            <button
                onClick={onTodayDay}
                className="flex items-center gap-2 font-medium px-4 py-2 rounded-full hover:bg-muted active:scale-95 transition-all"
            >
                <Calendar className="w-4 h-4 text-primary" />
                <span suppressHydrationWarning>{formatShortDate(parsedDate)}</span>
            </button>

            <button
                onClick={onNextDay}
                className="flex items-center justify-center p-2 rounded-full hover:bg-muted active:scale-95 transition-all text-muted-foreground"
            >
                <ChevronRight className="w-5 h-5" />
            </button>
        </div>
    );
}
