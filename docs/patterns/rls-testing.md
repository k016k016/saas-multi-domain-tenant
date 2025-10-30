# パターン: RLS テスト

## 方針
- RLSは常時有効のままテストする
- ユーザー切替は `request.jwt.claims` に `sub` を設定して擬似化
- org境界は membership（profiles）で判定されるため、ユーザーとorgの対応をシードで準備しておく

## 事前準備（例）

```sql
-- ユーザーA/Bとorg X/Y を作成（idは実際のUUIDに置換）
insert into organizations (id, name, plan, is_active, created_at)
values ('00000000-0000-0000-0000-0000000000aa','Org X','pro',true,now()),
       ('00000000-0000-0000-0000-0000000000bb','Org Y','pro',true,now());

insert into profiles (id, user_id, org_id, role, metadata, updated_at)
values (gen_random_uuid(), 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','00000000-0000-0000-0000-0000000000aa','admin','{}',now()),
       (gen_random_uuid(), 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','00000000-0000-0000-0000-0000000000bb','member','{}',now());
```

## ユーザー切替（擬似）

```sql
-- ユーザーAとして実行
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"}', true);
```

## 代表テスト

### 1) 同一orgのorganizationsは見える

```sql
select * from organizations;
-- ユーザーAはOrg Xに所属しているので、Org Xのみが返されるはず
```

### 2) 他orgのorganizationsは見えない（0行）

```sql
-- ユーザーAはOrg Xなので、Org Yは0行になるはず
select * from organizations where id = '00000000-0000-0000-0000-0000000000bb';
```

### 3) adminはprofilesにINSERT可能（member/adminのみ）

```sql
insert into profiles (id, user_id, org_id, role, metadata, updated_at)
values (gen_random_uuid(), gen_random_uuid(), '00000000-0000-0000-0000-0000000000aa', 'member', '{}', now());
-- ユーザーAはadminなので成功するはず
```

### 4) owner専用のorganizations UPDATEは失敗する（adminなので）

```sql
update organizations set plan = 'enterprise'
where id = '00000000-0000-0000-0000-0000000000aa';
-- ユーザーAはadminなので、owner専用操作は失敗するはず
```

### 5) activity_logsは自orgをSELECT可能（admin以上はorg全体）

```sql
select * from activity_logs;
-- ユーザーAはadminなので、Org X全体のログが見えるはず
```

### 6) 別ユーザーに切替（ユーザーB＝Org Yのmember）

```sql
select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"}', true);
```

### 7) Org Xのデータには触れない（0行になるはず）

```sql
select * from organizations where id = '00000000-0000-0000-0000-0000000000aa';
-- ユーザーBはOrg Yに所属しているので、Org Xは見えないはず（0行）
```

## 注意
- **DELETE は極力使わず "無効化" 方針を検討**（監査／復元性の観点）
- **RLSの"無効化テスト"は禁止**（本番相当の堅さを担保）
- **テストデータは `infra/supabase/seed.sql` で管理**

## 参照
- [テナンシー仕様](../spec/tenancy.md)
- [RLSポリシー詳細](../../infra/supabase/RLS.md)
- [Supabase RLS ドキュメント](https://supabase.com/docs/guides/auth/row-level-security)
