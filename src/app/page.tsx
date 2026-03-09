import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <div className="flex h-screen w-full flex-col items-center justify-center bg-background text-foreground">
      <div className="text-center space-y-4">
        <h1 className="text-3xl font-bold tracking-tight text-primary">Cícero Joias</h1>
        <p className="text-muted-foreground text-sm max-w-sm mx-auto">
          Sistema base inicializado com sucesso. Fase 1: Next.js + Tailwind v4 + Shadcn concluído.
        </p>
        <Button className="mt-4 bg-primary hover:bg-primary/90 text-primary-foreground">
          Prosseguir
        </Button>
      </div>
    </div>
  );
}
