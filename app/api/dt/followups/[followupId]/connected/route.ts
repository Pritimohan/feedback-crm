import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { getCrmBrandFromCookie } from '@/lib/crmBrand';
import { leadDbBrandMatchesCrmFilter } from '@/lib/crmBrand.shared';
import { getSession } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { isConnectedChoice, type ConnectedChoicePayload } from '@/lib/lifecycle/leadLifecycleValidation';
import { sendConnectedIssueRowToGoogleSheet } from '@/lib/services/googleSheetWebhook';
import { recordConnectedOutcome } from '@/lib/services/leadLifecycleEngine';
import { getLeadFollowupDetails } from '@/lib/services/leadFollowupQueryService';

interface ConnectedBody {
  choice: string;
  payload?: ConnectedChoicePayload;
  notes?: string;
}

function resolveSheetName(brand: string | null | undefined): 'fitelo' | 'fitty' | null {
  const normalized = brand?.trim().toLowerCase();
  if (!normalized) return null;
  if (normalized === 'fitelo') return 'fitelo';
  if (normalized === 'fitty') return 'fitty';
  return null;
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
    const brand = await getCrmBrandFromCookie();
    const existing = await getLeadFollowupDetails(followupId);
    if (!existing || !leadDbBrandMatchesCrmFilter(existing.lead.brand, brand)) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

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

    if (body.choice === 'issue_with_product') {
      const sheetName = resolveSheetName(existing.lead.brand);
      if (sheetName) {
        try {
          const [dtUser] = await db
            .select({ name: users.name })
            .from(users)
            .where(eq(users.id, session.id))
            .limit(1);

          const issueDescription = body.payload?.issue_description?.trim() || 'N/A';
          const orderId = existing.latestOrder?.shopify_order_id?.trim() || 'N/A';
          const productPurchased = existing.latestOrder?.product_name?.trim() || 'N/A';

          await sendConnectedIssueRowToGoogleSheet({
            sheetName,
            row: {
              customerPhoneNo: existing.customer.phone,
              customerName: existing.customer.name,
              brand: existing.lead.brand ?? 'N/A',
              orderId,
              productPurchased,
              issue: issueDescription,
              raisedByDt: dtUser?.name ?? 'N/A',
              timestamp: new Date().toISOString(),
            },
          });
        } catch (webhookError) {
          console.error('Google Sheet sync failed for connected issue outcome:', webhookError);
        }
      }
    }

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
