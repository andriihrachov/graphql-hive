import assert from 'node:assert';
import { describe, test } from 'node:test';
import { sql } from 'slonik';
import { initMigrationTestingEnvironment } from './utils/testkit';

await describe('migration: drop-personal-org', async () => {
  await test('should remove all existing personal orgs that does not have projects', async () => {
    const { db, runTo, complete, done, seed } = await initMigrationTestingEnvironment();

    try {
      // Run migrations all the way to the point before the one we are testing
      await runTo('2023.02.21T14.32.24.supertokens-4.0.0.sql');

      // Seed the DB with orgs
      const user = await seed.user();
      const emptyOrgs = await Promise.all([
        db.one(
          sql`INSERT INTO public.organizations (clean_id, name, user_id, type) VALUES ('personal-empty', 'personal-empty', ${user.id}, 'PERSONAL') RETURNING *;`,
        ),
        db.one(
          sql`INSERT INTO public.organizations (clean_id, name, user_id, type) VALUES ('regular-empty', 'regular-empty', ${user.id}, 'REGULAR') RETURNING *;`,
        ),
      ]);
      const orgsWithProjects = await Promise.all([
        await db.one(
          sql`INSERT INTO public.organizations (clean_id, name, user_id, type) VALUES ('personal-project', 'personal-project', ${user.id}, 'PERSONAL') RETURNING *;`,
        ),
        await db.one(
          sql`INSERT INTO public.organizations (clean_id, name, user_id, type) VALUES ('regular-project', 'regular-project', ${user.id}, 'PERSONAL') RETURNING *;`,
        ),
      ]);

      // Seed with projects
      await db.one(
        sql`INSERT INTO public.projects (clean_id, name, type, org_id) VALUES ('proj-1', 'proj-1', 'SINGLE', ${orgsWithProjects[0].id}) RETURNING *;`,
      );
      await db.one(
        sql`INSERT INTO public.projects (clean_id, name, type, org_id) VALUES ('proj-2', 'proj-2', 'SINGLE', ${orgsWithProjects[1].id}) RETURNING *;`,
      );

      // Run the additional remaining migrations
      await complete();

      // Only this one should be deleted, the rest should still exists
      assert.equal(
        await db.maybeOne(sql`SELECT * FROM public.organizations WHERE id = ${emptyOrgs[0].id}`),
        null,
      );
      assert.notEqual(
        await db.maybeOne(sql`SELECT * FROM public.organizations WHERE id = ${emptyOrgs[1].id}`),
        null,
      );
      assert.notEqual(
        await db.maybeOne(
          sql`SELECT * FROM public.organizations WHERE id = ${orgsWithProjects[0].id}`,
        ),
        null,
      );
      assert.notEqual(
        await db.maybeOne(
          sql`SELECT * FROM public.organizations WHERE id = ${orgsWithProjects[1].id}`,
        ),
        null,
      );
    } finally {
      await done();
    }
  });
});
