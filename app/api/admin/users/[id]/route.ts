import { NextRequest, NextResponse } from 'next/server';
import { and, eq, ne } from 'drizzle-orm';
import { getSession } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { hashPassword } from '@/lib/auth/jwt';

function validateRole(role: string) {
  return role === 'admin' || role === 'dt';
}

export async function GET(_: NextRequest, context: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (session.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await context.params;
  const [user] = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      active_status: users.active_status,
      created_at: users.created_at,
      updated_at: users.updated_at,
    })
    .from(users)
    .where(eq(users.id, id));

  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });
  return NextResponse.json({ data: user });
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (session.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  try {
    const { id } = await context.params;
    const body = await request.json();

    const updates: Partial<typeof users.$inferInsert> = {};

    if (typeof body?.name === 'string') {
      const name = body.name.trim();
      if (!name) return NextResponse.json({ error: 'Name cannot be empty' }, { status: 400 });
      updates.name = name;
    }

    if (typeof body?.email === 'string') {
      const email = body.email.trim().toLowerCase();
      if (!email) return NextResponse.json({ error: 'Email cannot be empty' }, { status: 400 });

      const [existing] = await db
        .select({ id: users.id })
        .from(users)
        .where(and(eq(users.email, email), ne(users.id, id)));
      if (existing) {
        return NextResponse.json({ error: 'User with this email already exists' }, { status: 409 });
      }
      updates.email = email;
    }

    if (typeof body?.role === 'string') {
      if (!validateRole(body.role)) {
        return NextResponse.json({ error: 'Role must be admin or dt' }, { status: 400 });
      }
      updates.role = body.role;
    }

    if (typeof body?.active_status === 'boolean') {
      updates.active_status = body.active_status;
    }

    if (typeof body?.password === 'string' && body.password.trim()) {
      if (body.password.length < 6) {
        return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 });
      }
      updates.password_hash = await hashPassword(body.password);
    }

    if (!Object.keys(updates).length) {
      return NextResponse.json({ error: 'No valid fields provided for update' }, { status: 400 });
    }

    updates.updated_at = new Date();
    const [updated] = await db
      .update(users)
      .set(updates)
      .where(eq(users.id, id))
      .returning({
        id: users.id,
        name: users.name,
        email: users.email,
        role: users.role,
        active_status: users.active_status,
        updated_at: users.updated_at,
      });

    if (!updated) return NextResponse.json({ error: 'User not found' }, { status: 404 });
    return NextResponse.json({ data: updated });
  } catch (error) {
    console.error('Update admin user error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(_: NextRequest, context: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (session.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await context.params;
  const [deleted] = await db
    .delete(users)
    .where(eq(users.id, id))
    .returning({ id: users.id });

  if (!deleted) return NextResponse.json({ error: 'User not found' }, { status: 404 });
  return NextResponse.json({ success: true });
}
