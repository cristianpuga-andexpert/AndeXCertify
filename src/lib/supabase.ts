/**
 * Supabase has been replaced by our self-hosted JWT auth system.
 * This file is kept as an empty stub during the transition to avoid
 * import errors from files not yet migrated. Remove once all callers
 * have been updated to use auth-context / api.ts instead.
 */

// No-op shims so residual imports don't crash during the migration.
export const supabase = null as unknown as never;
export const signInWithGoogle = () => { throw new Error('Supabase removed — use useAuth().login()'); };
export const signInWithEmail  = () => { throw new Error('Supabase removed — use useAuth().login()'); };
export const logOut           = () => { throw new Error('Supabase removed — use useAuth().logout()'); };
