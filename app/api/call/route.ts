import { NextRequest, NextResponse } from 'next/server';
import { resolveCallBrand } from '@/lib/services/callBrandResolver';
import { createOrUpdateAdhocCallLogBySid } from '@/lib/services/callLogService';
import { connectCall } from '@/lib/services/exotel';
import { resolveExotelExophone } from '@/lib/services/exotelExophone';
import { getSession } from '@/lib/auth/session';
import { toUserFacingMessage } from '@/lib/errors/userFacingError';

interface CallRequestBody {
  agentPhone?: string;
  customerPhone?: string;
  customerId?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as CallRequestBody;
    const agentPhone = body.agentPhone?.trim();
    const customerPhone = body.customerPhone?.trim();

    if (!agentPhone || !customerPhone) {
      return NextResponse.json(
        { success: false, error: 'Agent phone and customer phone are required' },
        { status: 400 }
      );
    }

    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const brand = await resolveCallBrand(body.customerId || null);
    const exophone = await resolveExotelExophone(brand);

    const exotelResponse = await connectCall({
      from: agentPhone,
      to: customerPhone,
      brand,
    });

    const callSid = exotelResponse.callSid?.trim();
    console.log('[Call] Exotel response:', {
      callSidFound: !!callSid,
      status: exotelResponse.status ?? null,
    });

    if (!callSid) {
      return NextResponse.json(
        { success: false, error: 'Exotel did not return callSid' },
        { status: 502 }
      );
    }

    await createOrUpdateAdhocCallLogBySid({
      providerCallSid: callSid,
      dtId: session.id,
      dtPhone: agentPhone,
      customerPhone,
      customerId: body.customerId || null,
      exotelNumber: exophone,
      providerStatusRaw: exotelResponse.status || 'initiated',
      rawPayload: exotelResponse.raw,
    });

    return NextResponse.json({
      success: true,
      callSid,
      status: exotelResponse.status,
    });
  } catch (error) {
    const message = toUserFacingMessage(error, 'Failed to initiate call');
    console.error('Error initiating Exotel call:', error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
