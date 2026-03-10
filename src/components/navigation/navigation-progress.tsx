'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

export function NavigationProgress() {
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const [progress, setProgress] = useState(0);
    const [visible, setVisible] = useState(false);
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const cleanup = useCallback(() => {
        if (timerRef.current) clearTimeout(timerRef.current);
        if (intervalRef.current) clearInterval(intervalRef.current);
        timerRef.current = null;
        intervalRef.current = null;
    }, []);

    // When route changes, complete the bar and hide
    useEffect(() => {
        if (!visible) return;
        cleanup();
        setProgress(100);
        timerRef.current = setTimeout(() => {
            setVisible(false);
            setProgress(0);
        }, 300);
    }, [pathname, searchParams, cleanup]); // eslint-disable-line react-hooks/exhaustive-deps

    // Listen for clicks on internal links
    useEffect(() => {
        function handleClick(e: MouseEvent) {
            const anchor = (e.target as HTMLElement).closest('a');
            if (!anchor) return;

            const href = anchor.getAttribute('href');
            if (!href || href.startsWith('#') || href.startsWith('http') || href.startsWith('mailto:')) return;

            // Don't trigger for same page
            const url = new URL(href, window.location.origin);
            if (url.pathname === pathname && url.search === window.location.search) return;

            // Start progress
            cleanup();
            setVisible(true);
            setProgress(20);

            // Simulate progress increments
            intervalRef.current = setInterval(() => {
                setProgress(prev => {
                    if (prev >= 90) {
                        if (intervalRef.current) clearInterval(intervalRef.current);
                        return 90;
                    }
                    return prev + Math.random() * 15;
                });
            }, 200);
        }

        document.addEventListener('click', handleClick, true);
        return () => {
            document.removeEventListener('click', handleClick, true);
            cleanup();
        };
    }, [pathname, cleanup]);

    if (!visible) return null;

    return (
        <div className="fixed top-0 left-0 right-0 z-[100] h-0.5">
            <div
                className="h-full bg-accent transition-all duration-300 ease-out"
                style={{ width: `${progress}%` }}
            />
        </div>
    );
}
