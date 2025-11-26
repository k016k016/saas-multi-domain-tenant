import { cleanupE2EUsers } from './scripts/cleanup-e2e-users-lib';

export default async function globalTeardown() {
  try {
    await cleanupE2EUsers({ quiet: true });
  } catch (error) {
    console.error('[playwright globalTeardown] Cleanup failed:', error);
  }
}
