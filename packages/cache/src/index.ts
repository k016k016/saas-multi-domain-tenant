/**
 * キャッシュの抽象レイヤー
 *
 * このパッケージはキャッシュ用のインターフェイスと、
 * 雛形段階・テスト用のインメモリ実装だけを提供します。
 *
 * Redis / Upstash / Cloudflare KV などの実ストアへの接続は、
 * 各プロダクト側で CacheClient インターフェイスを実装して行う想定です。
 */

export interface CacheSetOptions {
  /**
   * 有効期限（秒）
   */
  ttlSeconds?: number;
}

export interface CacheClient {
  get<T = unknown>(key: string): Promise<T | null>;
  set<T = unknown>(key: string, value: T, options?: CacheSetOptions): Promise<void>;
  delete(key: string): Promise<void>;
}

/**
 * シンプルなインメモリキャッシュ実装。
 *
 * - プロセス内の Map を利用
 * - TTL が切れたキーは次回アクセス時に削除
 * - 分散環境ではノード間で共有されないため、本番用途ではなく
 *   雛形・テスト・開発環境用の簡易実装として扱ってください。
 */
export function createInMemoryCache(): CacheClient {
  type Entry = { value: unknown; expiresAt?: number };
  const store = new Map<string, Entry>();

  return {
    async get<T>(key: string): Promise<T | null> {
      const entry = store.get(key);
      if (!entry) return null;

      if (entry.expiresAt && entry.expiresAt < Date.now()) {
        store.delete(key);
        return null;
      }

      return entry.value as T;
    },

    async set<T>(key: string, value: T, options?: CacheSetOptions): Promise<void> {
      const ttlMs = options?.ttlSeconds ? options.ttlSeconds * 1000 : undefined;
      const expiresAt = ttlMs ? Date.now() + ttlMs : undefined;
      store.set(key, { value, expiresAt });
    },

    async delete(key: string): Promise<void> {
      store.delete(key);
    },
  };
}

