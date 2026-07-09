import { type NextRequest } from 'next/server';
import { verifyToken, type JWTPayload } from './jwt';

export async function getAuthFromRequest(
  request: NextRequest
): Promise<{ user: JWTPayload | null; userRole: string | null }> {
  const token = request.cookies.get('token')?.value;
  if (!token) return { user: null, userRole: null };

  const payload = await verifyToken(token);
  if (!payload) return { user: null, userRole: null };

  return { user: payload, userRole: payload.role };
}
