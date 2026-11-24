BEGIN;

SET LOCAL lock_timeout = '5s';

ALTER TABLE public.users
    ALTER COLUMN "lojaAutorizada" SET DEFAULT 'SANTA_RITA';

UPDATE public.users
SET "lojaAutorizada" = 'SANTA_RITA',
    "lojaPadrao" = CASE WHEN "lojaPadrao" IS NOT NULL THEN 'SANTA_RITA'::public."Loja" END,
    updated_at = CURRENT_TIMESTAMP
WHERE "lojaAutorizada" <> 'SANTA_RITA'
   OR "lojaPadrao" <> 'SANTA_RITA';

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'public.users'::regclass AND conname = 'users_so_santa_rita'
    ) THEN
        ALTER TABLE public.users ADD CONSTRAINT users_so_santa_rita
            CHECK ("lojaAutorizada" = 'SANTA_RITA'
               AND ("lojaPadrao" IS NULL OR "lojaPadrao" = 'SANTA_RITA'));
    END IF;
END $$;

COMMIT;
