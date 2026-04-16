import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { createLifecycleForLead } from '@/lib/services/leadLifecycleEngine';

interface CreateLifecycleBody {
  anchorDate?: string;
  lifecycleType?: string;
}

export async function POST(request: NextRequest, context: { params: Promise<{ leadId: string }> }) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (session.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { leadId } = await context.params;
    const body = (await request.json()) as CreateLifecycleBody;
    const anchorDate = body.anchorDate ? new Date(body.anchorDate) : new Date();

    const lifecycleId = await createLifecycleForLead({
      leadId,
      anchorDate,
      lifecycleType: body.lifecycleType,
    });

    return NextResponse.json({ lifecycleId }, { status: 201 });
  } catch (error) {
    console.error('Create admin lifecycle error:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 400 }
    );
  }
}
