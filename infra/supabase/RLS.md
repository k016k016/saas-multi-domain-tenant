# RLS ポリシー方針

## 全体原則
- すべての行は `organization_id` でテナント境界を持つ
- RLSは SELECT/INSERT/UPDATE/DELETE 全てに適用
- 判定は「ユーザーが当該orgのメンバーか」「必要ロールを満たすか」で行う
- `owner` は各orgに常に1名。削除不可。owner操作は admin に委譲しない

## 補助関数（例）

実装は `migrations/` に置く。以下は代表例。

```sql
-- 呼び出しユーザーが org に所属しているか
create or replace function is_member_of_org(org uuid)
returns boolean language sql stable as $$
  select exists (
    select 1
    from profiles p
    where p.user_id = auth.uid()
      and p.org_id = org
  );
$$;

-- 呼び出しユーザーが org で指定ロール以上か（roleは 'member'|'admin'|'owner'）
create or replace function has_role_at_least(org uuid, min_role text)
returns boolean language sql stable as $$
  with ranks(role, r) as (
    values ('member', 1), ('admin', 2), ('owner', 3)
  )
  select coalesce(pr.r >= mr.r, false)
  from profiles p
  join ranks pr on pr.role = p.role
  join ranks mr on mr.role = min_role
  where p.user_id = auth.uid() and p.org_id = org
  limit 1;
$$;
```

## テーブル別方針

### organizations

- **SELECT**: 組織メンバーは同一orgのみ参照可
- **UPDATE**: owner のみ可（plan/is_active 等）。admin は不可
- **INSERT / DELETE**: アプリ経由では基本不可（事業者側プロセスで扱う想定）

**代表ポリシー（例）**:

```sql
create policy orgs_select_same_org on organizations
for select using ( is_member_of_org(id) );

create policy orgs_update_owner_only on organizations
for update using ( has_role_at_least(id, 'owner') );

-- insert/deleteは原則禁止
alter table organizations enable row level security;
revoke insert, delete on organizations from authenticated;
```

### profiles（= org内メンバーシップ）

- **SELECT**: 同一orgのみ
- **INSERT**: admin 以上（招待相当）。role は 'member'|'admin' のみ
- **UPDATE**: admin は member/admin のロール変更可、owner は全権（ただし owner→非owner は不可）
- **DELETE**: admin は owner 以外の削除可、owner は自組織の全メンバー対象（ただし owner 自身の削除は不可）

**代表ポリシー（例）**:

```sql
create policy profiles_select_same_org on profiles
for select using ( is_member_of_org(org_id) );

create policy profiles_insert_admin_plus on profiles
for insert with check (
  has_role_at_least(org_id, 'admin')
  and new.role in ('member','admin')
);

create policy profiles_update_role_rules on profiles
for update using ( is_member_of_org(org_id) )
with check (
  -- adminはownerのロール変更不可、ownerは原則可（ただしowner降格は owner譲渡フローでのみ）
  case
    when has_role_at_least(org_id, 'owner') then true
    when has_role_at_least(org_id, 'admin') then old.role != 'owner' and new.role in ('member','admin')
    else false
  end
);

create policy profiles_delete_rules on profiles
for delete using (
  -- adminはownerを消せない。ownerは自分以外の削除可
  (has_role_at_least(org_id, 'admin') and old.role != 'owner')
  or (has_role_at_least(org_id, 'owner') and old.user_id != auth.uid())
);
```

### activity_logs

- **INSERT**: サーバ側のみ（アプリのServer Actionで挿入）
- **SELECT**: admin 以上はorg全体を閲覧可、member は自分の行のみ
- **UPDATE/DELETE**: 不可（監査の不変性）

**代表ポリシー（例）**:

```sql
create policy logs_insert_same_org on activity_logs
for insert with check ( is_member_of_org(org_id) );

create policy logs_select_rules on activity_logs
for select using (
  has_role_at_least(org_id, 'admin')
  or user_id = auth.uid()
);

revoke update, delete on activity_logs from authenticated;
```

## ロール別マトリクス（要点）

| Table | Operation | member | admin | owner |
|-------|-----------|--------|-------|-------|
| **organizations** | SELECT | 同一org | 同一org | 同一org |
| | UPDATE | × | × | ○（契約/状態など） |
| **profiles** | SELECT | 同一org | 同一org | 同一org |
| | INSERT | × | ○（member/admin のみ） | ○ |
| | UPDATE | ×（自分のメタ除く） | ○（owner以外のロール変更） | ○（原則可。降格は譲渡で） |
| | DELETE | × | ○（owner以外） | ○（自分以外。owner自削除不可） |
| **activity_logs** | INSERT | （Server Only） | （Server Only） | （Server Only） |
| | SELECT | 自分の行のみ | org全体 | org全体 |

## 実装上の注意

- **実装はすべて `infra/supabase/migrations/*` に置く**
- **RLSの"無効化テスト"は禁止**
- **本番環境でもRLSは常時有効**
- **テスト方法は [RLSテストパターン](../../docs/patterns/rls-testing.md) を参照**

## 参照

- [テナンシー仕様](../../docs/spec/tenancy.md)
- [マイグレーションファイル](./migrations/20251030121106_initial_schema.sql)
- [RLSテストパターン](../../docs/patterns/rls-testing.md)
