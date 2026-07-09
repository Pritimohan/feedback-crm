'use client';

import React, { createContext, useCallback, useContext, useLayoutEffect, useMemo, useState } from 'react';
import type { CrmBrand } from '@/lib/crmBrand.shared';
import { readBrandFromBrowserCookie, serializeBrandCookie } from '@/lib/crmBrand.shared';

type BrandContextValue = {
  brand: CrmBrand;
  setBrand: (b: CrmBrand) => void;
  toggleBrand: () => void;
};

const BrandContext = createContext<BrandContextValue | null>(null);

export function BrandProvider({ children }: { children: React.ReactNode }) {
  // SSR has no document; initializer must match server output. Real cookie is applied in useEffect.
  const [brand, setBrandState] = useState<CrmBrand>('fitty');

  useLayoutEffect(() => {
    setBrandState(readBrandFromBrowserCookie());
  }, []);

  const setBrand = useCallback((b: CrmBrand) => {
    if (typeof window === 'undefined') return;
    const current = readBrandFromBrowserCookie();
    if (b === current) return;
    document.cookie = serializeBrandCookie(b);
    // Full reload so client-mounted pages (fetch in useEffect) pick up the new cookie.
    window.location.reload();
  }, []);

  const toggleBrand = useCallback(() => {
    const current = readBrandFromBrowserCookie();
    setBrand(current === 'fitty' ? 'fitelo' : 'fitty');
  }, [setBrand]);

  const value = useMemo(() => ({ brand, setBrand, toggleBrand }), [brand, setBrand, toggleBrand]);

  return <BrandContext.Provider value={value}>{children}</BrandContext.Provider>;
}

export function useCrmBrand(): BrandContextValue {
  const ctx = useContext(BrandContext);
  if (!ctx) {
    throw new Error('useCrmBrand must be used within BrandProvider');
  }
  return ctx;
}
