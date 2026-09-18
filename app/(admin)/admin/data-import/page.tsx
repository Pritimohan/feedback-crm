'use client';

import { useState } from 'react';
import {
  Alert,
  App,
  Button,
  Card,
  Col,
  Row,
  Space,
  Statistic,
  Table,
  Tag,
  Typography,
  Upload,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { DownloadOutlined, InboxOutlined, ReloadOutlined, UploadOutlined } from '@ant-design/icons';
import type { CreateCustomerInput } from '@/lib/services/customerCreateService';
import { getErrorFromResponse, toUserFacingMessage } from '@/lib/errors/userFacingError';

const { Title, Paragraph, Text } = Typography;
const { Dragger } = Upload;

interface PreviewRow {
  rowNumber: number;
  valid: boolean;
  errors: string[];
  data: CreateCustomerInput | null;
}

interface PreviewResponse {
  summary: { total: number; valid: number; invalid: number };
  rows: PreviewRow[];
}

type ImportStatus = 'created' | 'updated' | 'already_active' | 'error';

interface ImportResultRow {
  rowNumber: number;
  status: ImportStatus;
  message?: string;
  lead_id?: string;
  lifecycle_id?: string;
  phone: string;
  name: string;
}

interface ImportResponse {
  summary: {
    total: number;
    created: number;
    updated: number;
    already_active: number;
    failed: number;
  };
  results: ImportResultRow[];
}

function statusTag(status: ImportStatus) {
  switch (status) {
    case 'created':
      return <Tag color="green">Created</Tag>;
    case 'updated':
      return <Tag color="blue">Updated</Tag>;
    case 'already_active':
      return <Tag color="gold">Already active</Tag>;
    default:
      return <Tag color="red">Failed</Tag>;
  }
}

export default function DataImportPage() {
  const { message } = App.useApp();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [importLoading, setImportLoading] = useState(false);
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [importResult, setImportResult] = useState<ImportResponse | null>(null);

  const resetState = () => {
    setSelectedFile(null);
    setPreview(null);
    setImportResult(null);
  };

  const downloadTemplate = async () => {
    try {
      const response = await fetch('/api/admin/data-import/feedback/template');
      if (!response.ok) {
        throw new Error(await getErrorFromResponse(response, 'Failed to download template'));
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = 'feedback-leads-import-template.xlsx';
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      message.error(toUserFacingMessage(error, 'Failed to download template'));
    }
  };

  const runPreview = async () => {
    if (!selectedFile) {
      message.warning('Please select an Excel file first');
      return;
    }

    try {
      setPreviewLoading(true);
      setImportResult(null);
      const formData = new FormData();
      formData.append('file', selectedFile);

      const response = await fetch('/api/admin/data-import/feedback/preview', {
        method: 'POST',
        body: formData,
      });
      if (!response.ok) {
        throw new Error(await getErrorFromResponse(response, 'Failed to preview file'));
      }
      const json = await response.json();

      setPreview(json as PreviewResponse);
      message.success(`Validated ${json.summary.total} rows`);
    } catch (error) {
      message.error(toUserFacingMessage(error, 'Failed to preview file'));
    } finally {
      setPreviewLoading(false);
    }
  };

  const runImport = async () => {
    if (!preview) return;
    const validRows = preview.rows.filter((row) => row.valid && row.data);
    if (!validRows.length) {
      message.warning('No valid rows to import');
      return;
    }

    try {
      setImportLoading(true);
      const response = await fetch('/api/admin/data-import/feedback/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rows: validRows.map((row) => ({
            rowNumber: row.rowNumber,
            data: row.data,
          })),
        }),
      });
      if (!response.ok) {
        throw new Error(await getErrorFromResponse(response, 'Failed to import rows'));
      }
      const json = await response.json();

      setImportResult(json as ImportResponse);
      message.success(
        `Import complete: ${json.summary.created} created, ${json.summary.updated} updated, ${json.summary.already_active} already active, ${json.summary.failed} failed`
      );
    } catch (error) {
      message.error(toUserFacingMessage(error, 'Failed to import rows'));
    } finally {
      setImportLoading(false);
    }
  };

  const previewColumns: ColumnsType<PreviewRow> = [
    { title: 'Row', dataIndex: 'rowNumber', key: 'rowNumber', width: 70 },
    {
      title: 'Phone',
      key: 'phone',
      render: (_, row) => row.data?.phone ?? <Text type="secondary">-</Text>,
    },
    {
      title: 'Name',
      key: 'name',
      render: (_, row) => row.data?.name ?? <Text type="secondary">-</Text>,
    },
    {
      title: 'Brand',
      key: 'brand',
      render: (_, row) => row.data?.brand ?? <Text type="secondary">-</Text>,
    },
    {
      title: 'Status',
      key: 'valid',
      width: 100,
      render: (_, row) =>
        row.valid ? <Tag color="green">Valid</Tag> : <Tag color="red">Invalid</Tag>,
    },
    {
      title: 'Errors',
      key: 'errors',
      render: (_, row) =>
        row.errors.length ? (
          <Text type="danger">{row.errors.join('; ')}</Text>
        ) : (
          <Text type="secondary">-</Text>
        ),
    },
  ];

  const resultColumns: ColumnsType<ImportResultRow> = [
    { title: 'Row', dataIndex: 'rowNumber', key: 'rowNumber', width: 70 },
    { title: 'Phone', dataIndex: 'phone', key: 'phone' },
    { title: 'Name', dataIndex: 'name', key: 'name' },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: ImportStatus) => statusTag(status),
    },
    {
      title: 'Message',
      dataIndex: 'message',
      key: 'message',
      render: (value: string | undefined) => value ?? '-',
    },
  ];

  return (
    <div>
      <Title level={2}>Data Import</Title>
      <Paragraph type="secondary">
        Upload an Excel sheet to create feedback leads. Column headers must match the feedback API
        payload fields (phone, name, brand, etc.).
      </Paragraph>

      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <Card title="Step 1 — Upload Excel">
          <Space direction="vertical" style={{ width: '100%' }} size="middle">
            <Dragger
              accept=".xlsx,.xls"
              maxCount={1}
              beforeUpload={(file) => {
                setSelectedFile(file);
                setPreview(null);
                setImportResult(null);
                return false;
              }}
              onRemove={() => {
                setSelectedFile(null);
                setPreview(null);
                setImportResult(null);
              }}
              fileList={
                selectedFile
                  ? [{ uid: '1', name: selectedFile.name, status: 'done' as const }]
                  : []
              }
            >
              <p className="ant-upload-drag-icon">
                <InboxOutlined />
              </p>
              <p className="ant-upload-text">Click or drag Excel file to this area</p>
              <p className="ant-upload-hint">Supports .xlsx and .xls (max 5MB, 500 rows)</p>
            </Dragger>

            <Space wrap>
              <Button icon={<DownloadOutlined />} onClick={() => void downloadTemplate()}>
                Download template
              </Button>
              <Button
                type="primary"
                icon={<UploadOutlined />}
                loading={previewLoading}
                disabled={!selectedFile}
                onClick={() => void runPreview()}
              >
                Validate &amp; Preview
              </Button>
              {preview || importResult ? (
                <Button icon={<ReloadOutlined />} onClick={resetState}>
                  Import another file
                </Button>
              ) : null}
            </Space>
          </Space>
        </Card>

        {preview ? (
          <Card title="Step 2 — Preview">
            <Row gutter={16} style={{ marginBottom: 16 }}>
              <Col span={8}>
                <Statistic title="Total rows" value={preview.summary.total} />
              </Col>
              <Col span={8}>
                <Statistic title="Valid" value={preview.summary.valid} valueStyle={{ color: '#1d4838' }} />
              </Col>
              <Col span={8}>
                <Statistic
                  title="Invalid"
                  value={preview.summary.invalid}
                  valueStyle={{ color: preview.summary.invalid ? '#cf1322' : undefined }}
                />
              </Col>
            </Row>

            {preview.summary.invalid > 0 ? (
              <Alert
                type="warning"
                showIcon
                style={{ marginBottom: 16 }}
                message={`${preview.summary.invalid} invalid row(s) will be skipped on import.`}
              />
            ) : null}

            <Table
              columns={previewColumns}
              dataSource={preview.rows}
              rowKey="rowNumber"
              pagination={{ pageSize: 20 }}
              size="small"
            />

            <div style={{ marginTop: 16 }}>
              <Button
                type="primary"
                loading={importLoading}
                disabled={preview.summary.valid === 0 || !!importResult}
                onClick={() => void runImport()}
              >
                Import {preview.summary.valid} valid row{preview.summary.valid === 1 ? '' : 's'}
              </Button>
            </div>
          </Card>
        ) : null}

        {importResult ? (
          <Card title="Step 3 — Import results">
            <Row gutter={16} style={{ marginBottom: 16 }}>
              <Col span={4}>
                <Statistic title="Total" value={importResult.summary.total} />
              </Col>
              <Col span={5}>
                <Statistic title="Created" value={importResult.summary.created} />
              </Col>
              <Col span={5}>
                <Statistic title="Updated" value={importResult.summary.updated} />
              </Col>
              <Col span={5}>
                <Statistic title="Already active" value={importResult.summary.already_active} />
              </Col>
              <Col span={5}>
                <Statistic
                  title="Failed"
                  value={importResult.summary.failed}
                  valueStyle={{ color: importResult.summary.failed ? '#cf1322' : undefined }}
                />
              </Col>
            </Row>

            <Table
              columns={resultColumns}
              dataSource={importResult.results}
              rowKey="rowNumber"
              pagination={{ pageSize: 20 }}
              size="small"
            />
          </Card>
        ) : null}
      </Space>
    </div>
  );
}
