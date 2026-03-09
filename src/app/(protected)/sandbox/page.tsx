import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function SandboxPage() {
    return (
        <div className="p-4 space-y-4 md:p-8">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold tracking-tight">Sandbox da Interface (Teste)</h1>
            </div>

            <p className="text-muted-foreground">
                Esta é uma página de teste isolada para você validar visualmente a estrutura de Navegação e do App Shell construídos na Fase 4 sem a necessidade de um login real no banco de dados.
            </p>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                <Card className="border-none">
                    <CardHeader>
                        <CardTitle>Teste a Responsividade</CardTitle>
                        <CardDescription>Pressione F12 e alterne o modo de dispositivo para "iPhone".</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <p className="text-sm">Você notará que a Sidebar Lateral elegante será escondida e o Bottom Navigation (a barra inferior) assumirá o controle perfeitamente, usando as animações do Framer Motion ao clicar em 'Lançamentos' ou 'Hoje'.</p>
                    </CardContent>
                </Card>

                <Card className="border-none">
                    <CardHeader>
                        <CardTitle>Teste o RBAC</CardTitle>
                        <CardDescription>O isolamento de perfil em tempo real.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <p className="text-sm">Os links visíveis na barra lateral foram definidos no "usePermissions". Como estamos deslogados, você está vendo um menu enxuto padrão, provando a prevenção de renderização de abas sensíveis.</p>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
