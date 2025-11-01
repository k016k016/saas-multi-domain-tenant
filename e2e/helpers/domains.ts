export const DOMAINS = {
  WWW: process.env.NEXT_PUBLIC_WWW_URL!,
  APP: process.env.NEXT_PUBLIC_APP_URL!,
  ADMIN: process.env.NEXT_PUBLIC_ADMIN_URL!,
  OPS: process.env.NEXT_PUBLIC_OPS_URL!,
} as const;
