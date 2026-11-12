-- CreateTable
CREATE TABLE "compras_parceladas" (
    "id" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "categoria" TEXT,
    "loja" "Loja" NOT NULL,
    "valor_total" DECIMAL(10,2) NOT NULL,
    "qtd_parcelas" INTEGER NOT NULL,
    "primeiro_vencimento" DATE NOT NULL,
    "cartao_titular" TEXT NOT NULL,
    "cartao_banco" TEXT,
    "cartao_bandeira" TEXT,
    "observacao" TEXT,
    "cancelado_at" TIMESTAMP(3),
    "usuario_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "compras_parceladas_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE "parcelas_compra" (
    "id" TEXT NOT NULL,
    "compra_id" TEXT NOT NULL,
    "numero" INTEGER NOT NULL,
    "valor" DECIMAL(10,2) NOT NULL,
    "vencimento" DATE NOT NULL,
    "lancamento_id" TEXT,
    "paga_at" TIMESTAMP(3),
    "cancelada_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "parcelas_compra_pkey" PRIMARY KEY ("id")
);
-- CreateIndex
CREATE INDEX "compras_parceladas_loja_cancelado_at_idx" ON "compras_parceladas"("loja", "cancelado_at");
-- CreateIndex
CREATE INDEX "compras_parceladas_usuario_id_idx" ON "compras_parceladas"("usuario_id");
-- CreateIndex
CREATE UNIQUE INDEX "parcelas_compra_lancamento_id_key" ON "parcelas_compra"("lancamento_id");
-- CreateIndex
CREATE INDEX "parcelas_compra_vencimento_lancamento_id_cancelada_at_idx" ON "parcelas_compra"("vencimento", "lancamento_id", "cancelada_at");
-- CreateIndex
CREATE UNIQUE INDEX "parcelas_compra_compra_id_numero_key" ON "parcelas_compra"("compra_id", "numero");
-- AddForeignKey
ALTER TABLE "compras_parceladas" ADD CONSTRAINT "compras_parceladas_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "parcelas_compra" ADD CONSTRAINT "parcelas_compra_compra_id_fkey" FOREIGN KEY ("compra_id") REFERENCES "compras_parceladas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "parcelas_compra" ADD CONSTRAINT "parcelas_compra_lancamento_id_fkey" FOREIGN KEY ("lancamento_id") REFERENCES "lancamentos"("id") ON DELETE SET NULL ON UPDATE CASCADE;
-- RLS das tabelas novas (padrão de prisma/sql/rls-seguranca.sql)
ALTER TABLE public.compras_parceladas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parcelas_compra ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.compras_parceladas, public.parcelas_compra FROM anon, authenticated;
