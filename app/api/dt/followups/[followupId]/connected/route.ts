import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { isConnectedChoice, type ConnectedChoicePayload } from '@/lib/lifecycle/leadLifecycleValidation';
import { recordConnectedOutcome } from '@/lib/services/leadLifecycleEngine';

interface ConnectedBody {
  choice: string;
  payload?: ConnectedChoicePayload;
  notes?: string;
}

export async function POST(request: NextRequest, context: { params: Promise<{ followupId: string }> }) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (session.role !== 'dt' && session.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { followupId } = await context.params;
    const body = (await request.json()) as ConnectedBody;

    if (!isConnectedChoice(body.choice)) {
      return NextResponse.json({ error: 'Invalid connected choice' }, { status: 400 });
    }

    const result = await recordConnectedOutcome({
      followupId,
      dtId: session.id,
      choice: body.choice,
      payload: body.payload ?? {},
      notes: body.notes,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('Record connected outcome error:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 400 }
    );
  }
}
