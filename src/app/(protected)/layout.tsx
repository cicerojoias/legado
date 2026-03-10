import { Suspense } from "react";
import { Sidebar } from "@/components/navigation/sidebar";
import { BottomNav } from "@/components/navigation/bottom-nav";
import { NavigationProgress } from "@/components/navigation/navigation-progress";

export default function ProtectedLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="flex h-[100dvh] w-full overflow-hidden bg-background">
            <Suspense fallback={null}>
                <NavigationProgress />
            </Suspense>

            {/* Desktop Sidebar (hidden on mobile) */}
            <div className="hidden md:flex">
                <Suspense fallback={null}>
                    <Sidebar />
                </Suspense>
            </div>

            {/* Main Content Area */}
            <main className="flex-1 overflow-y-auto pb-16 md:pb-0">
                {children}
            </main>

            {/* Mobile Bottom Navigation (hidden on desktop) */}
            <div className="md:hidden fixed bottom-0 left-0 right-0 z-50">
                <Suspense fallback={null}>
                    <BottomNav />
                </Suspense>
            </div>
        </div>
    );
}
