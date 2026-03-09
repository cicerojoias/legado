"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Em produção, isso iria para um Sentry/Log nativo invés de logar pra usuário.
    console.error("Critical Error Boundary Caught:", error.message);
  }, [error]);

  return (
    <html>
      <body className="flex h-screen w-screen flex-col items-center justify-center bg-[#F7F5F0] text-[#1A1A1A]">
        <h2 className="text-2xl font-bold text-[#184434] mb-4">
          Algo deu errado.
        </h2>
        <p className="text-[#6B6358] mb-6 max-w-md text-center">
          Ocorreu um erro interno na aplicação. Nossa equipe foi notificada discretamente.
        </p>
        <Button onClick={() => reset()} className="bg-[#184434] hover:bg-[#122b20]">
          Tentar Novamente
        </Button>
      </body>
    </html>
  );
}
