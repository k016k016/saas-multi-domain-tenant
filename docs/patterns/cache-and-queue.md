# キャッシュ / キュー パターン（@repo/cache と Redis など）

このドキュメントでは、`@repo/cache` パッケージが提供するキャッシュの抽象レイヤーと、
Redis などのストアに接続する際の考え方をまとめます。

目的は次の2つです。

- どのプロダクトでも共通して使える「キャッシュの型」を用意する
- 実際のストア（Redis / Upstash / Cloudflare KV など）は各プロダクト側で自由に選べるようにする

---

## @repo/cache が提供するもの

`packages/cache/src/index.ts` には、次のような型と実装が含まれます。

```ts
export interface CacheSetOptions {
  ttlSeconds?: number;
}

export interface CacheClient {
  get<T = unknown>(key: string): Promise<T | null>;
  set<T = unknown>(key: string, value: T, options?: CacheSetOptions): Promise<void>;
  delete(key: string): Promise<void>;
}

export function createInMemoryCache(): CacheClient;
```

ポイント:

- **CacheClient**: キャッシュ操作の最小インターフェイス（get / set / delete）のみ定義
- **ttlSeconds**: TTL（秒）指定をオプションでサポート
- **createInMemoryCache()**: プロセス内の `Map` を使った簡易キャッシュ（本番用途ではなく、雛形・ローカル用）

このレイヤー自体は、Redis など具体的なストアには依存していません。

---

## 雛形での使い方（インメモリキャッシュ）

雛形段階では、`createInMemoryCache()` を直接使うだけでも一定の効果があります。

例: 高頻度で参照される設定値をキャッシュする（擬似コード）

```ts
import { createInMemoryCache } from '@repo/cache';

const cache = createInMemoryCache();

export async function getOrgSettings(orgId: string) {
  const cacheKey = `org-settings:${orgId}`;
  const cached = await cache.get<any>(cacheKey);
  if (cached) return cached;

  // ここで Supabase などから設定を取得
  const settings = await fetchOrgSettingsFromDb(orgId);

  await cache.set(cacheKey, settings, { ttlSeconds: 60 });
  return settings;
}
```

注意:

- インメモリ実装は **各サーバープロセスごとに独立** しているため、分散環境では一貫性は保証されません。
- 本番で一貫したキャッシュを使いたい場合は、Redis などの共有ストアを使う必要があります。

---

## 本番プロダクトでの Redis 実装方針（例）

このスターター自体は Redis に依存しませんが、実プロダクトでは Redis を使うことを強く想定しています。

例えば `ioredis` を使うと、次のような `CacheClient` 実装が考えられます（擬似コード）。

```ts
import Redis from 'ioredis';
import type { CacheClient, CacheSetOptions } from '@repo/cache';

export function createRedisCache(redisUrl: string): CacheClient {
  const client = new Redis(redisUrl);

  return {
    async get<T>(key: string): Promise<T | null> {
      const raw = await client.get(key);
      if (!raw) return null;
      return JSON.parse(raw) as T;
    },

    async set<T>(key: string, value: T, options?: CacheSetOptions): Promise<void> {
      const payload = JSON.stringify(value);
      if (options?.ttlSeconds) {
        await client.set(key, payload, 'EX', options.ttlSeconds);
      } else {
        await client.set(key, payload);
      }
    },

    async delete(key: string): Promise<void> {
      await client.del(key);
    },
  };
}
```

### 差し替えの考え方

- 雛形 / ローカル: `createInMemoryCache()` を使う
- 本番: 環境変数などで Redis 接続情報を受け取り、`createRedisCache()` に差し替える

アプリ側のコードは `CacheClient` インターフェイスだけを見ればよく、
Redis 以外のストア（Upstash / Cloudflare KV 等）に差し替える余地を残せます。

---

## キュー（Job Queue）との関係

このスターターには、まだキュー専用のパッケージはありませんが、
通知・バッチ処理などを非同期で扱いたい場合は以下のような分割を推奨します。

- `@repo/cache`: 読み取り頻度の高いデータのキャッシュ用
- （将来）`@repo/queue`: メール送信や重いバッチ処理を後ろに送るためのジョブキュー用

Redis を使う場合でも、

- キャッシュ: `GET` / `SET`（短い TTL）
- キュー: `LPUSH` / `BRPOP` などリスト系コマンド

と用途が違うため、アプリ側のコードでは **キャッシュとキューの責務を明確に分ける** のがおすすめです。

---

## このレイヤーに「入れるもの」と「入れないもの」

**入れるもの（共通化したいもの）**

- キャッシュのインターフェイス（`CacheClient`）
- TTL オプション（`CacheSetOptions`）
- 雛形・開発用のインメモリ実装（`createInMemoryCache()`）

**入れないもの（各プロダクトで決めるもの）**

- 具体的なストア接続（Redis / Upstash / Cloudflare KV などの SDK 呼び出し）
- キャッシュキーの戦略（どの値をどのキーでキャッシュするか）
- ジョブキューの実装（BullMQ / Cloud Tasks / Redis Lists など）

この分割により、「共通で再利用したいキャッシュ基盤はこのリポジトリに寄せつつ、
実際のストア選定や運用戦略は各プロダクトで自由に設計する」ことができます。

