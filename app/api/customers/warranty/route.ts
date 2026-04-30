import { NextRequest, NextResponse } from 'next/server';
import {
  createOrEnsureCustomerLifecycle,
  type CreateCustomerInput,
} from '@/lib/services/customerCreateService';

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as CreateCustomerInput;
    const result = await createOrEnsureCustomerLifecycle(body, 'fitelo');
    if (result.status === 'created') {
      return NextResponse.json({ data: result.data }, { status: 201 });
    }

    return NextResponse.json(
      {
        data: result.data,
        status:
          result.data.lifecycle_action === 'created'
            ? 'existing_customer_lifecycle_updated'
            : 'existing_customer_already_active',
      },
      { status: 200 }
    );
  } catch (error) {
    if (error instanceof Error && error.message === 'VALIDATION_PHONE_NAME_REQUIRED') {
      return NextResponse.json({ error: 'phone and name are required' }, { status: 400 });
    }
    if (error instanceof Error && error.message === 'VALIDATION_PHONE_INVALID') {
      return NextResponse.json({ error: 'phone must be a valid 10-digit Indian number' }, { status: 400 });
    }
    if (error instanceof Error && error.message === 'CONFLICT_ACTIVE_LEAD') {
      return NextResponse.json(
        { error: 'An active lead of this type already exists for this customer' },
        { status: 409 }
      );
    }
    console.error('Create warranty customer error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
