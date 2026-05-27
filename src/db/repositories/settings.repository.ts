import { eq } from 'drizzle-orm';
import { db } from '../index';
import { organizationSettings, SettingsRow, SettingsInsert } from '../schema';
import { OrganizationSettings } from '../../types';

type StampStyle = NonNullable<OrganizationSettings['stampStyle']>;

function rowToSettings(row: SettingsRow): OrganizationSettings {
  return {
    name:            row.name,
    rut:             row.rut,
    lema:            row.lema ?? undefined,
    useCustomStamp:  row.useCustomStamp ?? undefined,
    customStampName: row.customStampName ?? undefined,
    stampStyle:      (row.stampStyle as StampStyle) ?? undefined,
    logoUrl:         row.logoUrl ?? undefined,
    updatedAt:       row.updatedAt instanceof Date
                       ? row.updatedAt.toISOString()
                       : String(row.updatedAt),
  };
}

export async function getSettingsByUser(userId: string): Promise<OrganizationSettings | null> {
  const rows = await db
    .select()
    .from(organizationSettings)
    .where(eq(organizationSettings.userId, userId));
  return rows[0] ? rowToSettings(rows[0]) : null;
}

export async function upsertSettings(
  userId: string,
  data: Partial<Omit<OrganizationSettings, 'updatedAt'>>
): Promise<OrganizationSettings> {
  const now = new Date();

  const values: SettingsInsert = {
    userId,
    name:            data.name            ?? '',
    rut:             data.rut             ?? '',
    lema:            data.lema            ?? null,
    useCustomStamp:  data.useCustomStamp  ?? null,
    customStampName: data.customStampName ?? null,
    stampStyle:      (data.stampStyle as SettingsInsert['stampStyle']) ?? null,
    logoUrl:         data.logoUrl         ?? null,
    updatedAt:       now,
  };

  const [row] = await db
    .insert(organizationSettings)
    .values(values)
    .onConflictDoUpdate({
      target: organizationSettings.userId,
      set: {
        name:            values.name,
        rut:             values.rut,
        lema:            values.lema,
        useCustomStamp:  values.useCustomStamp,
        customStampName: values.customStampName,
        stampStyle:      values.stampStyle,
        logoUrl:         values.logoUrl,
        updatedAt:       now,
      },
    })
    .returning();

  return rowToSettings(row);
}
