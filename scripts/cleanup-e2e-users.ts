import { cleanupE2EUsers } from './cleanup-e2e-users-lib';

cleanupE2EUsers().catch((error) => {
  console.error('[cleanup-e2e-users] Failed:', error);
  process.exit(1);
});
