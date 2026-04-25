import { NextRequest, NextResponse } from 'next/server';
import { getCrmBrandFromCookie } from '@/lib/crmBrand';
import { leadDbBrandMatchesCrmFilter } from '@/lib/crmBrand.shared';
import { getSession } from '@/lib/auth/session';
import { getSupabaseServiceClient } from '@/lib/supabase/server';
import { getLeadFollowupDetails } from '@/lib/services/leadFollowupQueryService';

const BUCKET_NAME = 'review-screenshots';
const MAX_UPLOAD_SIZE_BYTES = 10 * 1024 * 1024;

function sanitizePathSegment(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64) || 'unknown';
}

function getExtensionFromName(fileName: string): string {
  const lastDot = fileName.lastIndexOf('.');
  if (lastDot === -1) return 'bin';
  const ext = fileName.slice(lastDot + 1).toLowerCase();
  return ext.replace(/[^a-z0-9]/g, '') || 'bin';
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (session.role !== 'dt' && session.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const formData = await request.formData();
    const upload = formData.get('file');
    const followupId = String(formData.get('followupId') ?? '').trim();

    if (!(upload instanceof File)) {
      return NextResponse.json({ error: 'Image file is required' }, { status: 400 });
    }
    if (!upload.type.startsWith('image/')) {
      return NextResponse.json({ error: 'Only image uploads are allowed' }, { status: 400 });
    }
    if (upload.size > MAX_UPLOAD_SIZE_BYTES) {
      return NextResponse.json({ error: 'Image size must be 10MB or less' }, { status: 400 });
    }

    if (followupId) {
      const brand = await getCrmBrandFromCookie();
      const detail = await getLeadFollowupDetails(followupId);
      if (!detail || !leadDbBrandMatchesCrmFilter(detail.lead.brand, brand)) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
      }
    }

    const supabase = getSupabaseServiceClient();
    const fileBytes = await upload.arrayBuffer();
    const extension = getExtensionFromName(upload.name);
    const safeFollowupId = sanitizePathSegment(followupId || 'no-followup');
    const objectPath = `followups/${safeFollowupId}/${Date.now()}-${crypto.randomUUID()}.${extension}`;

    const { error: uploadError } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(objectPath, fileBytes, {
        cacheControl: '3600',
        contentType: upload.type,
        upsert: false,
      });

    if (uploadError) {
      throw new Error(uploadError.message);
    }

    const { data: signedData, error: signedError } = await supabase.storage
      .from(BUCKET_NAME)
      .createSignedUrl(objectPath, 3600);

    if (signedError) {
      throw new Error(signedError.message);
    }

    return NextResponse.json({
      success: true,
      data: {
        bucket: BUCKET_NAME,
        path: objectPath,
        signedUrl: signedData.signedUrl,
        maxSizeBytes: MAX_UPLOAD_SIZE_BYTES,
      },
    });
  } catch (error) {
    console.error('Review screenshot upload error:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}
