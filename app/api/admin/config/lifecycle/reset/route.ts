import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { resetLifecycleConfigToDefaults } from '@/lib/services/lifecycleConfigService';

export async function POST() {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (session.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const result = await resetLifecycleConfigToDefaults(session.id);

    return NextResponse.json({
      success: true,
      config: (await import('@/lib/services/lifecycleConfigService')).getDefaultLifecycleConfigBundle(),
      version: result.version,
      versionId: result.versionId,
      pendingUpdatesSummary: result.pendingUpdatesSummary,
    });
  } catch (error) {
    console.error('[admin/config/lifecycle/reset POST]', error);
    const message =
      error instanceof Error ? error.message : 'Failed to reset lifecycle config';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
