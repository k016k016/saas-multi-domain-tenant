-- ============================================================
-- E2E Test Setup: Schema Patch
-- ============================================================
-- 目的: FK・制約・RLS を修正
-- 実行: Supabase SQL Editor または psql で実行（Service Role推奨）

-- FK: profiles.id → auth.users(id)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'profiles_user_fk'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_user_fk
      FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END$$;

-- FK: profiles.org_id → organizations.id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'profiles_org_fk'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_org_fk
      FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;
  END IF;
END$$;

-- role チェック制約（member/admin/owner のみ）
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('member','admin','owner'));

-- org ごとに owner は常に1人（部分一意インデックス）
CREATE UNIQUE INDEX IF NOT EXISTS profiles_one_owner_per_org
  ON public.profiles(org_id)
  WHERE role = 'owner';

-- RLS 有効化
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;
