import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import {
  getActiveLifecycleConfig,
  getDefaultLifecycleConfigBundle,
} from '@/lib/services/lifecycleConfigService';

export async function GET() {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (session.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const active = await getActiveLifecycleConfig();
    const defaults = getDefaultLifecycleConfigBundle();

    return NextResponse.json({
      config: active.config,
      defaults,
      version: active.version,
      versionId: active.id,
      updatedAt: active.updatedAt,
    });
  } catch (error) {
    console.error('[admin/config/lifecycle GET]', error);
    return NextResponse.json({ error: 'Failed to load lifecycle config' }, { status: 500 });
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
    const { saveLifecycleConfig } = await import('@/lib/services/lifecycleConfigService');
    const result = await saveLifecycleConfig(body, session.id);

    return NextResponse.json({
      success: true,
      version: result.version,
      versionId: result.versionId,
      pendingUpdatesSummary: result.pendingUpdatesSummary,
    });
  } catch (error) {
    console.error('[admin/config/lifecycle PUT]', error);
    const message =
      error instanceof Error ? error.message : 'Failed to save lifecycle config';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
