import { eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { Db } from '../db/index.js';
import { locations } from '../db/schema.js';
import type { AuthEnv } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/auth.js';

const createLocationSchema = z.object({
  name: z.string().min(1).max(200),
  lat: z.number().optional(),
  lng: z.number().optional(),
  radiusM: z.number().int().positive().optional(),
});

const updateLocationSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  lat: z.number().nullable().optional(),
  lng: z.number().nullable().optional(),
  radiusM: z.number().int().positive().nullable().optional(),
  active: z.boolean().optional(),
});

export function locationsRoutes(getDb: (c: { env: AuthEnv['Bindings'] }) => Db) {
  const app = new Hono<AuthEnv>();

  app.use('*', requireAdmin);

  app.get('/', async (c) => {
    const db = getDb(c);
    const rows = await db.select().from(locations).orderBy(locations.name);
    return c.json({ locations: rows });
  });

  app.post('/', async (c) => {
    const body = createLocationSchema.safeParse(await c.req.json());
    if (!body.success) {
      return c.json({ error: 'Invalid request body' }, 400);
    }

    const db = getDb(c);
    const [location] = await db
      .insert(locations)
      .values({
        name: body.data.name,
        codeToken: randomUUID(),
        lat: body.data.lat ?? null,
        lng: body.data.lng ?? null,
        radiusM: body.data.radiusM ?? null,
      })
      .returning();

    return c.json({ location }, 201);
  });

  app.patch('/:id', async (c) => {
    const body = updateLocationSchema.safeParse(await c.req.json());
    if (!body.success) {
      return c.json({ error: 'Invalid request body' }, 400);
    }

    const db = getDb(c);
    const id = c.req.param('id');

    const updates: Record<string, unknown> = {};
    if (body.data.name !== undefined) updates.name = body.data.name;
    if (body.data.lat !== undefined) updates.lat = body.data.lat;
    if (body.data.lng !== undefined) updates.lng = body.data.lng;
    if (body.data.radiusM !== undefined) updates.radiusM = body.data.radiusM;
    if (body.data.active !== undefined) updates.active = body.data.active;

    const [location] = await db
      .update(locations)
      .set(updates)
      .where(eq(locations.id, id))
      .returning();

    if (!location) {
      return c.json({ error: 'Location not found' }, 404);
    }

    return c.json({ location });
  });

  app.post('/:id/rotate', async (c) => {
    const db = getDb(c);
    const id = c.req.param('id');
    const newToken = randomUUID();

    const [location] = await db
      .update(locations)
      .set({ codeToken: newToken })
      .where(eq(locations.id, id))
      .returning();

    if (!location) {
      return c.json({ error: 'Location not found' }, 404);
    }

    return c.json({ location });
  });

  return app;
}
