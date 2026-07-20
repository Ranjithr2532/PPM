import { useState, useEffect } from 'react';
import { Modal, Button, Card, Spin, Badge, Empty, Tag, message, Collapse } from 'antd';
import { FileTextOutlined, EyeOutlined, CalendarOutlined, UserOutlined, DollarOutlined, ProgressOutlined, DownOutlined } from '@ant-design/icons';
import { API_BASE_URL } from '../config/api.js';
import { formatDateTime } from '../config/date.js';

const StageWiseView = ({ projectId, visible, onClose }) => {
  const [stageData, setStageData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [viewUrl, setViewUrl] = useState(null);
  const [urlModalVisible, setUrlModalVisible] = useState(false);

  useEffect(() => {
    if (visible && projectId) {
      fetchStageData();
    }
  }, [visible, projectId]);

  const fetchStageData = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/proposals/stage_wise/${projectId}`, {
        headers: { accept: 'application/json' },
      });
      if (!response.ok) {
        throw new Error('Failed to fetch stage data');
      }
      const data = await response.json();
      setStageData(data);
    } catch (error) {
      console.error('Error fetching stage data:', error);
      message.error('Failed to load stage data');
    } finally {
      setLoading(false);
    }
  };

  const handleViewDocument = (url) => {
    setViewUrl(url);
    setUrlModalVisible(true);
  };

  const getStageIcon = (stageName) => {
    const icons = {
      'Enquiry': '📋',
      'Proposal': '📝',
      'PO': '📄',
      'PO Acknowledgment': '✅',
      'Progress': '📊',
      'Payments': '💰',
      'Closure Report': '🎯'
    };
    return icons[stageName] || '📌';
  };

  const getStageColor = (index) => {
    const colors = [
      'from-blue-500 to-blue-600',
      'from-purple-500 to-purple-600',
      'from-green-500 to-green-600',
      'from-orange-500 to-orange-600',
      'from-pink-500 to-pink-600',
      'from-indigo-500 to-indigo-600',
      'from-red-500 to-red-600'
    ];
    return colors[index % colors.length];
  };

  const renderDocumentCard = (doc) => (
    <Card
      key={doc.id}
      className="mb-3 shadow-md hover:shadow-xl transition-all duration-300 border-l-4 border-blue-500"
      hoverable
    >
      <div className="flex justify-between items-start">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <FileTextOutlined className="text-blue-500 text-lg" />
            <h4 className="font-semibold text-lg text-gray-800 m-0">{doc.name}</h4>
          </div>
          <p className="text-gray-600 mb-3">{doc.description}</p>
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <UserOutlined />
              <span>Uploaded by: <span className="font-medium">{doc.uploaded_by}</span></span>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <CalendarOutlined />
              <span>Updated: {formatDateTime(doc.updated_at)}</span>
            </div>
          </div>
        </div>
        <Button
          type="primary"
          icon={<EyeOutlined />}
          onClick={() => handleViewDocument(doc.url)}
          className="bg-gradient-to-r from-blue-500 to-blue-600 border-none"
        >
          View
        </Button>
      </div>
    </Card>
  );

  const renderPaymentCard = (payment) => (
    <Card
      key={payment.id}
      className="mb-3 shadow-md hover:shadow-xl transition-all duration-300 border-l-4 border-green-500"
      hoverable
    >
      <div className="flex items-start gap-3">
        <DollarOutlined className="text-green-500 text-2xl mt-1" />
        <div className="flex-1">
          <div className="flex justify-between items-start mb-2">
            <h4 className="font-semibold text-lg text-gray-800 m-0">Payment Details</h4>
            <Tag color="green">Active</Tag>
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <UserOutlined />
              <span>Updated by: <span className="font-medium">{payment.updated_by}</span></span>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <CalendarOutlined />
              <span>Updated: {formatDateTime(payment.updated_at)}</span>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );

  const renderProgressCard = (progress) => (
    <Card
      key={progress.id}
      className="mb-3 shadow-md hover:shadow-xl transition-all duration-300 border-l-4 border-orange-500"
      hoverable
    >
      <div className="flex items-start gap-3">
        <ProgressOutlined className="text-orange-500 text-2xl mt-1" />
        <div className="flex-1">
          <h4 className="font-semibold text-lg text-gray-800 mb-2">Progress Update</h4>
          <p className="text-gray-700 mb-3 bg-gray-50 p-3 rounded-lg">{progress.remarks}</p>
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <UserOutlined />
              <span>Updated by: <span className="font-medium">{progress.updated_by}</span></span>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <CalendarOutlined />
              <span>Updated: {formatDateTime(progress.updated_at)}</span>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );

  const renderStageContent = (stage) => {
    const hasDocuments = stage.documents && stage.documents.length > 0;
    const hasPayments = stage.payments && stage.payments.length > 0;
    const hasProgress = stage.progress && stage.progress.length > 0;
    const hasAnyData = hasDocuments || hasPayments || hasProgress;

    if (!hasAnyData) {
      return (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="No data available for this stage"
          className="py-8"
        />
      );
    }

    return (
      <div className="space-y-4">
        {hasDocuments && (
          <Collapse
            defaultActiveKey={['documents']}
            expandIconPosition="end"
            className="bg-white"
            items={[
              {
                key: 'documents',
                label: (
                  <div className="flex items-center gap-2">
                    <FileTextOutlined className="text-blue-500" />
                    <span className="font-semibold text-gray-700">
                      Documents ({stage.documents.length})
                    </span>
                  </div>
                ),
                children: (
                  <div className="space-y-3">
                    {stage.documents.map(renderDocumentCard)}
                  </div>
                )
              }
            ]}
          />
        )}
        {hasPayments && (
          <Collapse
            defaultActiveKey={['payments']}
            expandIconPosition="end"
            className="bg-white"
            items={[
              {
                key: 'payments',
                label: (
                  <div className="flex items-center gap-2">
                    <DollarOutlined className="text-green-500" />
                    <span className="font-semibold text-gray-700">
                      Payments ({stage.payments.length})
                    </span>
                  </div>
                ),
                children: (
                  <div className="space-y-3">
                    {stage.payments.map(renderPaymentCard)}
                  </div>
                )
              }
            ]}
          />
        )}
        {hasProgress && (
          <Collapse
            defaultActiveKey={['progress']}
            expandIconPosition="end"
            className="bg-white"
            items={[
              {
                key: 'progress',
                label: (
                  <div className="flex items-center gap-2">
                    <ProgressOutlined className="text-orange-500" />
                    <span className="font-semibold text-gray-700">
                      Progress Updates ({stage.progress.length})
                    </span>
                  </div>
                ),
                children: (
                  <div className="space-y-3">
                    {stage.progress.map(renderProgressCard)}
                  </div>
                )
              }
            ]}
          />
        )}
      </div>
    );
  };

  return (
    <>
      <Modal
        title={
          <div className="flex items-center gap-3">
            <span className="text-2xl">🎯</span>
            <span className="text-xl font-bold">Project Stage Details</span>
          </div>
        }
        open={visible}
        onCancel={onClose}
        width={1200}
        footer={[
          <Button key="close" type="primary" onClick={onClose} size="large">
            Close
          </Button>
        ]}
        bodyStyle={{ maxHeight: '70vh', overflowY: 'auto' }}
      >
        {loading ? (
          <div className="flex justify-center items-center py-20">
            <Spin size="large" />
          </div>
        ) : (
          <div className="space-y-4">
            {stageData.map((stage, index) => {
              const itemCount = 
                (stage.documents?.length || 0) + 
                (stage.payments?.length || 0) + 
                (stage.progress?.length || 0);
              
              return (
                <div
                  key={stage.stage_id}
                  className="rounded-xl overflow-hidden shadow-lg border border-gray-200 hover:shadow-xl transition-shadow duration-300"
                >
                  <div className={`bg-gradient-to-r ${getStageColor(index)} p-5 text-white`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="text-3xl">{getStageIcon(stage.stage_name)}</span>
                        <div>
                          <h3 className="text-xl font-bold m-0">{stage.stage_name}</h3>
                          <p className="text-white/80 text-sm m-0">Stage ID: {stage.stage_id}</p>
                        </div>
                      </div>
                      <Badge 
                        count={itemCount} 
                        showZero 
                        style={{ 
                          backgroundColor: 'white', 
                          color: '#1890ff',
                          fontWeight: 'bold',
                          fontSize: '14px',
                          boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
                        }}
                      />
                    </div>
                  </div>
                  <div className="p-6 bg-gray-50">
                    {renderStageContent(stage)}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Modal>

      <Modal
        title="Document Viewer"
        open={urlModalVisible}
        onCancel={() => setUrlModalVisible(false)}
        width={1000}
        footer={[
          <Button key="close" onClick={() => setUrlModalVisible(false)}>
            Close
          </Button>,
          <Button 
            key="open" 
            type="primary" 
            onClick={() => window.open(viewUrl, '_blank')}
          >
            Open in New Tab
          </Button>
        ]}
      >
        {viewUrl && (
          <iframe
            src={viewUrl}
            style={{ width: '100%', height: '70vh', border: 'none' }}
            title="Document Viewer"
          />
        )}
      </Modal>
    </>
  );
};

export default StageWiseView;