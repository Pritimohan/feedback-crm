'use client';

import { useState, useEffect } from 'react';
import { Typography, Table, Input, Switch, Button, Space, Card, message, Image, Tag, Row, Col, Statistic } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { SyncOutlined, CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons';

const { Title, Paragraph } = Typography;
const { Search } = Input;
interface TrackedProduct { id: string; shopify_product_id: string; shopify_variant_id: string; product_name: string; sku: string | null; image_url: string | null; is_tracked: boolean; source: string; created_at: string; updated_at: string; }

export default function ConfigPage() {
  const [products, setProducts] = useState<TrackedProduct[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<TrackedProduct[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { void fetchProducts(); }, []);
  const fetchProducts = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/config/products');
      if (!response.ok) throw new Error('Failed to fetch products');
      const data = await response.json();
      setProducts(data); setFilteredProducts(data);
    } catch { message.error('Failed to load products'); } finally { setLoading(false); }
  };

  const handleSearch = (value: string) => {
    setFilteredProducts(products.filter((product) => product.product_name.toLowerCase().includes(value.toLowerCase()) || product.sku?.toLowerCase().includes(value.toLowerCase()) || product.shopify_variant_id.includes(value)));
  };
  const trackedCount = products.filter((p) => p.is_tracked).length;
  const totalCount = products.length;
  const columns: ColumnsType<TrackedProduct> = [
    { title: 'Image', dataIndex: 'image_url', key: 'image', width: 100, render: (imageUrl: string | null) => imageUrl ? <Image src={imageUrl.split(',')[0]} alt="Product" width={60} height={60} style={{ objectFit: 'cover', borderRadius: 4 }} /> : <div style={{ width: 60, height: 60, backgroundColor: '#eeeae3', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 4, color: '#99998f', fontSize: 10 }}>No Image</div> },
    { title: 'Product Name', dataIndex: 'product_name', key: 'product_name', render: (name: string) => <strong>{name}</strong> },
    { title: 'Variant ID', dataIndex: 'shopify_variant_id', key: 'shopify_variant_id', render: (id: string) => <code style={{ fontSize: 12 }}>{id}</code> },
    { title: 'SKU', dataIndex: 'sku', key: 'sku', render: (sku: string | null) => sku ? <code style={{ fontSize: 12 }}>{sku}</code> : <Tag>No SKU</Tag> },
    { title: 'Track Orders', dataIndex: 'is_tracked', key: 'is_tracked', width: 120, render: (isTracked: boolean) => <Switch checked={isTracked} checkedChildren={<CheckCircleOutlined />} unCheckedChildren={<CloseCircleOutlined />} disabled /> },
  ];
  return (
    <div>
      <Title level={2}>Product Configuration</Title>
      <Paragraph type="secondary">Sync products from Shopify and configure which products should be tracked.</Paragraph>
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} lg={6}><Card><Statistic title="Total Products" value={totalCount} prefix={<SyncOutlined />} /></Card></Col>
        <Col xs={24} sm={12} lg={6}><Card><Statistic title="Tracked Products" value={trackedCount} prefix={<CheckCircleOutlined />} valueStyle={{ color: '#1d4838' }} /></Card></Col>
        <Col xs={24} sm={12} lg={6}><Card><Statistic title="Not Tracked" value={totalCount - trackedCount} prefix={<CloseCircleOutlined />} valueStyle={{ color: '#99998f' }} /></Card></Col>
      </Row>
      <Card style={{ marginBottom: 24 }}><Space wrap><Button type="primary" icon={<SyncOutlined />} disabled>Sync Products from Shopify</Button><Button disabled>Enable All Visible</Button><Button disabled>Disable All Visible</Button></Space></Card>
      <Search placeholder="Search by product name, SKU, or variant ID" onSearch={handleSearch} onChange={(e) => handleSearch(e.target.value)} style={{ marginBottom: 16, maxWidth: 400 }} allowClear />
      <Table columns={columns} dataSource={filteredProducts} loading={loading} rowKey="id" pagination={{ pageSize: 20, showTotal: (total) => `Total ${total} products` }} />
    </div>
  );
}
