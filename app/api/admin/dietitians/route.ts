import { NextResponse } from 'next/server';
import { and, eq, asc } from 'drizzle-orm';
import { getSession } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (session.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const dts = await db
    .select({ id: users.id, name: users.name, email: users.email })
    .from(users)
    .where(and(eq(users.role, 'dt'), eq(users.active_status, true)))
    .orderBy(asc(users.name));
  return NextResponse.json(dts);
}
