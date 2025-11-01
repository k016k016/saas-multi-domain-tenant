var __require = /* @__PURE__ */ ((x) => typeof require !== "undefined" ? require : typeof Proxy !== "undefined" ? new Proxy(x, {
  get: (a, b) => (typeof require !== "undefined" ? require : a)[b]
}) : x)(function(x) {
  if (typeof require !== "undefined") return require.apply(this, arguments);
  throw Error('Dynamic require of "' + x + '" is not supported');
});

// src/index.ts
import { createServerClient as createSupabaseServerClient } from "@supabase/ssr";
import { createBrowserClient as createSupabseBrowserClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// src/audit.ts
async function logActivity(supabase, logData) {
  try {
    const { error } = await supabase.from("activity_logs").insert({
      org_id: logData.orgId,
      user_id: logData.userId,
      action: logData.action,
      payload: logData.payload ?? {},
      created_at: (/* @__PURE__ */ new Date()).toISOString()
    });
    if (error) {
      console.error("[logActivity] Insert failed:", error);
      return { error: error.message };
    }
    return {};
  } catch (err) {
    console.error("[logActivity] Unexpected error:", err);
    return { error: "\u76E3\u67FB\u30ED\u30B0\u306E\u8A18\u9332\u306B\u5931\u6557\u3057\u307E\u3057\u305F" };
  }
}

// src/index.ts
async function createServerClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be set. See infra/supabase/SETUP.md for setup instructions."
    );
  }
  const cookieStore = await cookies();
  return createSupabaseServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(
            ({ name, value, options }) => cookieStore.set(name, value, {
              ...options,
              // サブドメイン間でSupabase Sessionを共有するため、domain を .local.test に設定
              domain: ".local.test"
            })
          );
        } catch {
        }
      }
    }
  });
}
function createBrowserClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be set. See infra/supabase/SETUP.md for setup instructions."
    );
  }
  return createSupabseBrowserClient(supabaseUrl, supabaseAnonKey);
}
function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!supabaseUrl || !supabaseServiceRoleKey) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set. See infra/supabase/SETUP.md for setup instructions."
    );
  }
  const { createClient } = __require("@supabase/supabase-js");
  return createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}
export {
  createBrowserClient,
  createServerClient,
  getSupabaseAdmin,
  logActivity
};
