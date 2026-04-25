'use client';

import React from 'react';
import { Button, Space, Tooltip } from 'antd';
import { SwapOutlined } from '@ant-design/icons';
import { useCrmBrand } from '@/components/providers/BrandProvider';

const FITTY_LOGO = '/brand-logos/Fitty-Logo.avif';
const FITTELO_LOGO = '/brand-logos/Fitelo-Logo.svg';

type BrandSwitcherProps = {
  collapsed?: boolean;
};

export function BrandSwitcher({ collapsed }: BrandSwitcherProps) {
  const { brand, toggleBrand, setBrand } = useCrmBrand();

  if (collapsed) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: '8px 4px' }}>
        <Tooltip title={`${brand === 'fitty' ? 'Fitty' : 'Fitelo'} — swap brand`}>
          <button
            type="button"
            onClick={toggleBrand}
            style={{
              border: 'none',
              background: 'none',
              padding: 0,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            aria-label={`Current brand: ${brand === 'fitty' ? 'Fitty' : 'Fitelo'}. Click to switch.`}
          >
            <img
              key={brand}
              src={brand === 'fitty' ? FITTY_LOGO : FITTELO_LOGO}
              alt=""
              style={{ height: 28, width: 'auto', maxWidth: 44, objectFit: 'contain' }}
            />
          </button>
        </Tooltip>
        <Tooltip title="Switch brand (Fitty ↔ Fitelo)">
          <Button type="text" size="small" icon={<SwapOutlined />} onClick={toggleBrand} aria-label="Reverse brand" />
        </Tooltip>
      </div>
    );
  }

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        padding: '8px 10px',
        flexWrap: 'wrap',
      }}
    >
      <Space size={6} align="center">
        {brand === 'fitty' ? (
          <button
            type="button"
            onClick={() => setBrand('fitelo')}
            style={{
              border: 'none',
              background: 'none',
              padding: 0,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
            }}
            aria-label="Switch to Fitelo"
          >
            <img src={FITTY_LOGO} alt="Fitty" style={{ height: 38, width: 'auto', maxWidth: 140, objectFit: 'contain' }} />
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setBrand('fitty')}
            style={{
              border: 'none',
              background: 'none',
              padding: 0,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
            }}
            aria-label="Switch to Fitty"
          >
            <img key={brand} src={FITTELO_LOGO} alt="Fitelo" style={{ height: 26, width: 'auto', maxWidth: 140, objectFit: 'contain' }} />
          </button>
        )}
        <Tooltip title="Switch brand (Fitty ↔ Fitelo)">
          <Button type="text" size="small" icon={<SwapOutlined />} onClick={toggleBrand} aria-label="Reverse brand" />
        </Tooltip>
      </Space>
    </div>
  );
}
