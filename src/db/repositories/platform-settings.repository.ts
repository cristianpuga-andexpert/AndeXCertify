import { eq } from 'drizzle-orm';
import { db } from '../index';
import { platformSettings, PlatformSettingsRow } from '../schema';

const SINGLETON_ID = 'singleton';

/** Returns the global platform settings, creating the default row if missing. */
export async function getPlatformSettings(): Promise<PlatformSettingsRow> {
  const rows = await db.select().from(platformSettings).where(eq(platformSettings.id, SINGLETON_ID));
  if (rows[0]) return rows[0];
  const [created] = await db
    .insert(platformSettings)
    .values({ id: SINGLETON_ID })
    .onConflictDoNothing()
    .returning();
  if (created) return created;
  // Race: another request created it — re-read
  const again = await db.select().from(platformSettings).where(eq(platformSettings.id, SINGLETON_ID));
  return again[0];
}

export async function updatePlatformSettings(patch: {
  publicRegistrationEnabled?: boolean;
  defaultSignupPlan?:         PlatformSettingsRow['defaultSignupPlan'];
  signupBillingCycle?:        string;
}): Promise<PlatformSettingsRow> {
  await getPlatformSettings(); // ensure the row exists
  const [row] = await db
    .update(platformSettings)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(platformSettings.id, SINGLETON_ID))
    .returning();
  return row;
}
