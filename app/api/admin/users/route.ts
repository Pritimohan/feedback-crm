import { NextRequest, NextResponse } from 'next/server';
import { and, asc, eq, ilike, or } from 'drizzle-orm';
import { getSession } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { hashPassword } from '@/lib/auth/jwt';

function validateRole(role: string) {
  return role === 'admin' || role === 'dt';
}

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (session.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const sp = request.nextUrl.searchParams;
  const role = sp.get('role');
  const status = sp.get('status');
  const q = sp.get('q')?.trim();

  const filters = [];
  if (role && validateRole(role)) filters.push(eq(users.role, role));
  if (status === 'active') filters.push(eq(users.active_status, true));
  if (status === 'inactive') filters.push(eq(users.active_status, false));
  if (q) {
    filters.push(or(ilike(users.name, `%${q}%`), ilike(users.email, `%${q}%`))!);
  }

  const rows = await db
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
    .where(filters.length ? and(...filters) : undefined)
    .orderBy(asc(users.name));

  return NextResponse.json({ data: rows });
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (session.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  try {
    const body = await request.json();
    const name = typeof body?.name === 'string' ? body.name.trim() : '';
    const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
    const role = typeof body?.role === 'string' ? body.role : '';
    const password = typeof body?.password === 'string' ? body.password : '';

    if (!name || !email || !password || !validateRole(role)) {
      return NextResponse.json(
        { error: 'name, email, role(admin|dt), and password are required' },
        { status: 400 }
      );
    }
    if (password.length < 6) {
      return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 });
    }

    const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, email));
    if (existing) {
      return NextResponse.json({ error: 'User with this email already exists' }, { status: 409 });
    }

    const passwordHash = await hashPassword(password);
    const [created] = await db
      .insert(users)
      .values({
        name,
        email,
        role,
        password_hash: passwordHash,
        active_status: true,
      })
      .returning({
        id: users.id,
        name: users.name,
        email: users.email,
        role: users.role,
        active_status: users.active_status,
      });

    return NextResponse.json({ data: created }, { status: 201 });
  } catch (error) {
    console.error('Create admin user error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
