import { NextRequest, NextResponse } from 'next/server';
import {
  createCustomerWithAutoLeadLifecycle,
  isDuplicatePhoneError,
  type CreateCustomerInput,
} from '@/lib/services/customerCreateService';

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as CreateCustomerInput;
    const data = await createCustomerWithAutoLeadLifecycle(body, 'fitelo');
    return NextResponse.json({ data }, { status: 201 });
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
    if (isDuplicatePhoneError(error)) {
      return NextResponse.json({ error: 'Customer with this phone already exists' }, { status: 409 });
    }
    console.error('Create warranty customer error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
