import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import {
  getExotelConfig,
  saveExotelConfig,
} from '@/lib/services/exotelConfigService';

export async function GET() {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (session.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const config = await getExotelConfig();

    return NextResponse.json({
      fitty: {
        exophone: config.fitty.exophone ?? '',
        updatedAt: config.fitty.updatedAt,
      },
      fitelo: {
        exophone: config.fitelo.exophone ?? '',
        updatedAt: config.fitelo.updatedAt,
      },
    });
  } catch (error) {
    console.error('[admin/config/exotel GET]', error);
    return NextResponse.json({ error: 'Failed to load Exotel config' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (session.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const result = await saveExotelConfig(
      { fitty: body?.fitty, fitelo: body?.fitelo },
      session.id
    );

    return NextResponse.json({
      success: true,
      fitty: result.fitty,
      fitelo: result.fitelo,
      updatedAt: result.updatedAt,
    });
  } catch (error) {
    console.error('[admin/config/exotel PUT]', error);
    const message =
      error instanceof Error ? error.message : 'Failed to save Exotel config';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
