import { NextRequest, NextResponse } from 'next/server';
import type { CrmBrand } from '@/lib/crmBrand.shared';
import { getCrmBrandFromCookie } from '@/lib/crmBrand';
import { getSession } from '@/lib/auth/session';
import {
  getBrandProfile,
  upsertBrandProfile,
  validateEligibleLeadTypes,
} from '@/lib/services/dtBrandProfileService';

function parseBrandParam(value: string | null, fallback: CrmBrand): CrmBrand {
  if (value === 'fitty' || value === 'fitelo') return value;
  return fallback;
}

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (session.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await context.params;
  const cookieBrand = await getCrmBrandFromCookie();
  const brand = parseBrandParam(request.nextUrl.searchParams.get('brand'), cookieBrand);

  const profile = await getBrandProfile(id, brand);
  if (!profile) {
    return NextResponse.json(
      { error: 'Brand profile not found' },
      { status: 404 }
    );
  }

  return NextResponse.json({ data: profile });
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (session.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  try {
    const { id } = await context.params;
    const body = await request.json();
    const cookieBrand = await getCrmBrandFromCookie();
    const brand = parseBrandParam(typeof body?.brand === 'string' ? body.brand : null, cookieBrand);

    const patch: { is_active?: boolean; eligible_lead_types?: ReturnType<typeof validateEligibleLeadTypes> } = {};

    if (typeof body?.is_active === 'boolean') {
      patch.is_active = body.is_active;
    }

    if (body?.eligible_lead_types != null) {
      patch.eligible_lead_types = validateEligibleLeadTypes(body.eligible_lead_types);
    }

    if (!Object.keys(patch).length) {
      return NextResponse.json({ error: 'No valid fields provided for update' }, { status: 400 });
    }

    const updated = await upsertBrandProfile(id, brand, patch);
    return NextResponse.json({ data: updated });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    const status = message.includes('not found') ? 404 : message.includes('agents') || message.includes('lead type') ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
