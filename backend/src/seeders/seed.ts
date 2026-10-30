/**
 * ReportSetu intentionally has no demo seed data.
 *
 * Accounts and clinical records must be created through the application
 * workflows after the PostgreSQL schema has been migrated.
 */
export const runSeeder = async (): Promise<void> => {
  throw new Error(
    'Demo seeding is disabled. Create records through the authenticated application workflows.'
  );
};
