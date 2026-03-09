export function LancamentoListSkeleton() {
    return (
        <div className="space-y-3 animate-pulse">
            {[...Array(4)].map((_, i) => (
                <div
                    key={i}
                    className="bg-card rounded-2xl p-4 flex gap-4 items-center"
                    style={{ opacity: 1 - i * 0.18 }}
                >
                    <div className="w-12 h-12 rounded-full bg-muted shrink-0" />
                    <div className="flex-1 space-y-2">
                        <div className="h-4 bg-muted rounded-full w-3/5" />
                        <div className="h-3 bg-muted rounded-full w-2/5" />
                    </div>
                    <div className="h-5 w-20 bg-muted rounded-full" />
                </div>
            ))}
        </div>
    );
}
