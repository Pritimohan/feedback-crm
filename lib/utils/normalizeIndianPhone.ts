export function normalizeIndianPhone(phone: string): string | null {
  const trimmed = phone.trim();
  if (!trimmed) return null;

  const hasPlus = trimmed.startsWith('+');
  const digitsOnly = trimmed.replace(/\D/g, '');

  if (hasPlus) {
    if (!trimmed.startsWith('+91')) return null;
    if (digitsOnly.length !== 12 || !digitsOnly.startsWith('91')) return null;
    const local = digitsOnly.slice(2);
    if (!/^\d{10}$/.test(local)) return null;
    return `+91${local}`;
  }

  if (digitsOnly.length === 12 && digitsOnly.startsWith('91')) {
    const local = digitsOnly.slice(2);
    if (!/^\d{10}$/.test(local)) return null;
    return `+91${local}`;
  }

  if (/^\d{10}$/.test(digitsOnly)) {
    return `+91${digitsOnly}`;
  }

  return null;
}
