/**
 * Supabaseクライアント
 *
 * 将来的にはここでSupabaseクライアントを初期化し、
 * RLS(Row Level Security)が有効な状態でデータアクセスを行う。
 *
 * 重要: RLSを無効化・バイパスする実装は許可しない。
 */

import { createClient } from '@supabase/supabase-js';

// TODO: 環境変数から取得
const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || '';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// 将来的にはここでDatabase型定義をエクスポート
// export type Database = ...
