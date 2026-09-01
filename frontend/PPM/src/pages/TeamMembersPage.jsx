import React, { useState, useEffect, useMemo } from 'react';
import {
  Table,
  Button,
  Modal,
  Form,
  Input,
  Select,
  AutoComplete,
  Tag,
  Space,
  Popconfirm,
  Card,
  Row,
  Col,
  Typography,
  message,
  Tooltip,
  Badge,
  Divider,
  Statistic
} from 'antd';
import {
  UserAddOutlined,
  EditOutlined,
  DeleteOutlined,
  SearchOutlined,
  TeamOutlined,
  IdcardOutlined,
  ApartmentOutlined,
  CheckCircleOutlined,
  ReloadOutlined,
  FilterOutlined,
  CrownOutlined,
  SafetyCertificateOutlined
} from '@ant-design/icons';
import axios from 'axios';
import { API_BASE_URL } from '../config/api.js';

const { Title, Text, Paragraph } = Typography;
const { Option } = Select;

// Standard suggestions for designation, type, and role
const DESIGNATION_OPTIONS = [
  'Project Associate-I',
  'Project Associate-II',
  'Project Assistant-I',
  'Project Assistant-II',
  'Senior Technical Assistant-I',
  'Senior Technical Assistant-II',
  'Research Associate',
  'Consultant',
  'Senior Technician',
  'Technician',
  'Administrative Assistant'
];

const TYPE_OPTIONS = [
  'Computer Science',
  'Electronics & Communication',
  'Mechanical',
  'Electrical & Electronics',
  'Information Science',
  'Civil',
];

const ROLE_OPTIONS = [
  'Project Co-ordinator',
  'Project Leader',
  'OT Integration',
  'OT Developer',
  'OT/IT Developer Lead',
  'OT/IT Developer',
  'OT Technician',
  'Full Stack IT Developer',
  'IT Developer Lead',
  'Lead Design Engineer',
  'Technical Support',
  'Quality Assurance',
  'Research Scholar'
];

export default function TeamMembersPage() {
  const [staffList, setStaffList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [centres, setCentres] = useState([]);
  const [groups, setGroups] = useState([]);

  // Logged-in user context
  const [currentUser, setCurrentUser] = useState(null);
  const [userCentre, setUserCentre] = useState(null);
  const [userGroup, setUserGroup] = useState(null);

  // Filters & Search
  const [searchText, setSearchText] = useState('');
  const [selectedTypeFilter, setSelectedTypeFilter] = useState('ALL');
  const [selectedGroupFilter, setSelectedGroupFilter] = useState(null);
  const [adminCentreFilter, setAdminCentreFilter] = useState(null);
  const [adminGroupFilter, setAdminGroupFilter] = useState(null);

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState(null);

  const [form] = Form.useForm();
  const [editForm] = Form.useForm();

  // 1. Read logged in user from localStorage
  useEffect(() => {
    try {
      const rawUser = localStorage.getItem('ppm_user');
      if (rawUser) {
        const parsed = JSON.parse(rawUser);
        setCurrentUser(parsed);
      }
    } catch (e) {
      console.error('Error reading ppm_user', e);
    }
  }, []);

  const isAdmin = useMemo(() => {
    if (!currentUser?.role) return false;
    const r = currentUser.role.toLowerCase().trim();
    return r === 'admin' || r === 'guest' || r === 'director';
  }, [currentUser]);

  // 2. Fetch Centres & Groups to resolve Centre ID & Group ID
  const fetchMetadata = async () => {
    try {
      const [centresRes, groupsRes] = await Promise.all([
        axios.get(`${API_BASE_URL}/centres/`).catch(() => ({ data: [] })),
        axios.get(`${API_BASE_URL}/groups/`).catch(() => ({ data: [] }))
      ]);

      const cList = Array.isArray(centresRes.data) ? centresRes.data : [];
      const gList = Array.isArray(groupsRes.data) ? groupsRes.data : [];

      setCentres(cList);
      setGroups(gList);

      return { centres: cList, groups: gList };
    } catch (e) {
      console.error('Error loading centres/groups', e);
      return { centres: [], groups: [] };
    }
  };

  // 3. Resolve user's centre and group IDs
  useEffect(() => {
    if (!currentUser) return;

    fetchMetadata().then(({ centres: cList, groups: gList }) => {
      const uCenterName = (currentUser.center || currentUser.centre || '').toLowerCase().trim();
      const uGroupName = (currentUser.group || '').toLowerCase().trim();

      // Find matched Centre
      const matchedCentre = cList.find(
        (c) =>
          (c.name && c.name.toLowerCase().trim() === uCenterName) ||
          (c.code && c.code.toLowerCase().trim() === uCenterName) ||
          (currentUser.center_id && c.id === currentUser.center_id)
      );

      // Find matched Group
      const matchedGroup = gList.find(
        (g) =>
          (g.name && g.name.toLowerCase().trim() === uGroupName) ||
          (g.code && g.code.toLowerCase().trim() === uGroupName) ||
          (currentUser.group_id && g.id === currentUser.group_id)
      );

      setUserCentre(matchedCentre || (uCenterName ? { name: currentUser.center || currentUser.centre } : null));
      setUserGroup(matchedGroup || (uGroupName ? { name: currentUser.group } : null));
    });
  }, [currentUser]);

  // 4. Fetch Staff list from backend based on Centre ID
  const fetchStaff = async () => {
    setLoading(true);
    try {
      let res;
      // If user has a resolved centre ID, fetch team members of that centre
      if (!isAdmin && userCentre?.id) {
        res = await axios.get(`${API_BASE_URL}/staff/center/${userCentre.id}`);
      } else if (isAdmin && adminCentreFilter) {
        res = await axios.get(`${API_BASE_URL}/staff/center/${adminCentreFilter}`);
      } else {
        res = await axios.get(`${API_BASE_URL}/staff/`);
      }
      setStaffList(Array.isArray(res.data) ? res.data : []);
    } catch (error) {
      console.error('Failed to fetch staff list', error);
      message.error('Failed to fetch staff list for your centre');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStaff();
  }, [userCentre, adminCentreFilter, isAdmin]);

  // 5. Add New Staff Member (Auto-binds Scientist's Centre & Group)
  const handleCreateStaff = async (values) => {
    try {
      // Determine centre_id and group_id
      let finalCentreId = userCentre?.id || null;
      let finalGroupId = values.group_id || userGroup?.id || null;

      if (isAdmin) {
        finalCentreId = values.centre_id || finalCentreId;
      }

      const payload = {
        name: values.name.trim(),
        centre_id: finalCentreId,
        group_id: finalGroupId,
        designation: values.designation || null,
        type: values.type || null,
        role: values.role || null
      };

      await axios.post(`${API_BASE_URL}/staff/`, payload);
      message.success(`Team member "${payload.name}" added successfully!`);
      setIsAddModalOpen(false);
      form.resetFields();
      fetchStaff();
    } catch (error) {
      console.error('Error creating staff member', error);
      const detail = error.response?.data?.detail || 'Failed to add team member';
      message.error(typeof detail === 'string' ? detail : JSON.stringify(detail));
    }
  };

  // 6. Update Staff Member
  const handleUpdateStaff = async (values) => {
    if (!editingStaff) return;
    try {
      const payload = {
        name: values.name.trim(),
        centre_id: values.centre_id !== undefined ? values.centre_id : editingStaff.centre_id,
        group_id: values.group_id !== undefined ? values.group_id : editingStaff.group_id,
        designation: values.designation || null,
        type: values.type || null,
        role: values.role || null
      };

      await axios.put(`${API_BASE_URL}/staff/${editingStaff.pf_id}`, payload);
      message.success(`Team member updated successfully!`);
      setIsEditModalOpen(false);
      setEditingStaff(null);
      editForm.resetFields();
      fetchStaff();
    } catch (error) {
      console.error('Error updating staff member', error);
      const detail = error.response?.data?.detail || 'Failed to update team member';
      message.error(typeof detail === 'string' ? detail : JSON.stringify(detail));
    }
  };

  // 7. Delete Staff Member
  const handleDeleteStaff = async (pf_id, staffName) => {
    try {
      await axios.delete(`${API_BASE_URL}/staff/${pf_id}`);
      message.success(`Team member "${staffName}" deleted successfully`);
      fetchStaff();
    } catch (error) {
      console.error('Error deleting staff member', error);
      message.error('Failed to delete staff member');
    }
  };

  // Open Edit Modal
  const openEditModal = (record) => {
    setEditingStaff(record);
    editForm.setFieldsValue({
      name: record.name,
      designation: record.designation,
      type: record.type,
      role: record.role,
      centre_id: record.centre_id,
      group_id: record.group_id
    });
    setIsEditModalOpen(true);
  };
  // Derive available groups based on active centre
  const availableGroups = useMemo(() => {
    const activeCentreId = isAdmin ? adminCentreFilter : userCentre?.id;
    let filtered = groups;
    if (activeCentreId) {
      filtered = groups.filter(g => g.centre_id === activeCentreId);
    }
    // Sort alphabetically by name
    return [...filtered].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  }, [groups, userCentre, adminCentreFilter, isAdmin]);

  // Filtered List
  const filteredStaff = useMemo(() => {
    return staffList.filter((item) => {
      // Text search
      const matchesSearch =
        !searchText ||
        (item.name && item.name.toLowerCase().includes(searchText.toLowerCase())) ||
        (item.designation && item.designation.toLowerCase().includes(searchText.toLowerCase())) ||
        (item.role && item.role.toLowerCase().includes(searchText.toLowerCase())) ||
        (item.type && item.type.toLowerCase().includes(searchText.toLowerCase())) ||
        String(item.pf_id).includes(searchText);

      // Type filter
      const matchesType =
        selectedTypeFilter === 'ALL' ||
        (item.type && item.type.toLowerCase().includes(selectedTypeFilter.toLowerCase()));

      // Group filter
      const matchesGroup = 
        !selectedGroupFilter || 
        item.group_id === selectedGroupFilter ||
        (item.group_name && item.group_name === selectedGroupFilter);

      return matchesSearch && matchesType && matchesGroup;
    });
  }, [staffList, searchText, selectedTypeFilter, selectedGroupFilter]);

  // Statistics
  const stats = useMemo(() => {
    const total = staffList.length;
    const cse = staffList.filter((s) => (s.type || '').toLowerCase().includes('computer') || (s.type || '').toLowerCase().includes('it')).length;
    const ece = staffList.filter((s) => (s.type || '').toLowerCase().includes('electron') || (s.type || '').toLowerCase().includes('ec')).length;
    const mech = staffList.filter((s) => (s.type || '').toLowerCase().includes('mech')).length;
    const eee = staffList.filter((s) => (s.type || '').toLowerCase().includes('electric')).length;
    return { total, cse, ece, mech, eee };
  }, [staffList]);

  // Tag color helper for BE Course / Discipline
  const getTypeColor = (typeStr) => {
    if (!typeStr) return 'default';
    const lower = typeStr.toLowerCase();
    if (lower.includes('computer') || lower.includes('information') || lower.includes('it')) return 'geekblue';
    if (lower.includes('electron') || lower.includes('ec')) return 'cyan';
    if (lower.includes('mech')) return 'orange';
    if (lower.includes('electric') || lower.includes('eee')) return 'gold';
    if (lower.includes('civil')) return 'green';
    if (lower.includes('metallurgy') || lower.includes('material')) return 'purple';
    return 'blue';
  };

  const getRoleColor = (roleStr) => {
    if (!roleStr) return 'default';
    const lower = roleStr.toLowerCase();
    if (lower.includes('principal') || lower.includes('pi') || lower.includes('leader')) return 'magenta';
    if (lower.includes('co-pi') || lower.includes('lead')) return 'volcano';
    if (lower.includes('support')) return 'gold';
    return 'blue';
  };

  // Table Columns
  const columns = [
    {
      title: 'Sl No',
      key: 'serial',
      width: 80,
      align: 'center',
      render: (_, __, index) => (
        <span className="text-[14px] text-slate-700">{index + 1}</span>
      )
    },
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      render: (name, record) => (
        <div>
          <div className="font-medium text-[14px] text-slate-800">
            {name}
          </div>
          {record.designation && (
            <div className="text-xs text-slate-500 mt-0.5">{record.designation}</div>
          )}
        </div>
      )
    },
    {
      title: 'Centre / Group',
      key: 'centre_group',
      render: (_, record) => {
        const cCode = record.centre_code || centres.find((c) => c.id === record.centre_id)?.code || record.centre_name || '—';
        const gCode = record.group_code || groups.find((g) => g.id === record.group_id)?.code || record.group_name || '—';
        return (
          <div className="text-[14px] text-slate-700">
            {cCode} / {gCode}
          </div>
        );
      }
    },
    {
      title: 'Type',
      dataIndex: 'type',
      key: 'type',
      width: 210,
      render: (typeVal) => (
        <span className="text-[14px] text-slate-700">
          {typeVal || '—'}
        </span>
      )
    },
    {
      title: 'Role',
      dataIndex: 'role',
      key: 'role',
      width: 190,
      render: (roleVal) => (
        <span className="text-[14px] text-slate-700">
          {roleVal || '—'}
        </span>
      )
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 120,
      align: 'center',
      render: (_, record) => (
        <Space size="small">
          <Tooltip title="Edit Staff Member">
            <Button
              type="text"
              size="small"
              icon={<EditOutlined className="text-blue-600" />}
              onClick={() => openEditModal(record)}
              className="hover:bg-blue-50 rounded"
            />
          </Tooltip>
          <Tooltip title="Delete Staff Member">
            <Popconfirm
              title="Delete Staff Member"
              description={`Are you sure you want to delete ${record.name}?`}
              onConfirm={() => handleDeleteStaff(record.pf_id, record.name)}
              okText="Yes, Delete"
              cancelText="Cancel"
              okButtonProps={{ danger: true }}
            >
              <Button
                type="text"
                size="small"
                danger
                icon={<DeleteOutlined />}
                className="hover:bg-rose-50 rounded"
              />
            </Popconfirm>
          </Tooltip>
        </Space>
      )
    }
  ];

  return (
    <div className="space-y-6 pb-12 max-w-7xl mx-auto">
      {/* Header Banner */}
      <div className="bg-white rounded-2xl p-6 sm:p-8 shadow-sm border border-slate-200 relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <Title level={2} style={{ color: '#1e293b', margin: 0, fontWeight: 700 }}>
              Staff & Team Management
            </Title>

            {/* Scientist Auto-detected Centre/Group Pill */}
            {currentUser && (
              <div className="mt-3 flex flex-wrap items-center gap-2.5">
                <span className="text-xs text-slate-500 font-medium">Logged in as:</span>
                <Tag color="cyan" className="rounded-md font-semibold text-xs py-0.5 border-none">
                  {currentUser.name}
                </Tag>
                <span className="text-slate-300">•</span>
                <span className="text-xs text-slate-500 font-medium">Centre:</span>
                <Tag color="blue" className="rounded-md font-semibold text-xs py-0.5 border-none">
                  {userCentre?.code || userCentre?.name || currentUser.center || currentUser.centre || 'N/A'}
                </Tag>
                <span className="text-slate-300">•</span>
                <span className="text-xs text-slate-500 font-medium">Group:</span>
                <Tag color="purple" className="rounded-md font-semibold text-xs py-0.5 border-none">
                  {userGroup?.code || userGroup?.name || currentUser.group || 'N/A'}
                </Tag>
              </div>
            )}
          </div>

          {/* Add Team Member Primary Action */}
          <div className="flex items-center gap-3">
            <Button
              type="primary"
              size="large"
              icon={<UserAddOutlined />}
              onClick={() => {
                form.resetFields();
                if (userGroup?.id) {
                  form.setFieldsValue({ group_id: userGroup.id });
                }
                setIsAddModalOpen(true);
              }}
              className="bg-blue-500 hover:bg-blue-400 text-white font-semibold rounded-xl h-12 px-6 shadow-lg shadow-blue-500/25 border-none flex items-center gap-2 transition-all duration-200 hover:scale-105"
            >
              Add Team Member
            </Button>
            <Tooltip title="Refresh Data">
              <Button
                size="large"
                icon={<ReloadOutlined />}
                onClick={fetchStaff}
                loading={loading}
                className="bg-white/10 hover:bg-white/20 text-white border-white/20 rounded-xl h-12 w-12 flex items-center justify-center"
              />
            </Tooltip>
          </div>
        </div>
      </div>



      {/* Filter & Search Bar */}
      <Card className="rounded-2xl border-slate-200 shadow-sm">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
            {/* Search Input */}
            <Input
              placeholder="Search by name, designation, role, or ID..."
              prefix={<SearchOutlined className="text-slate-400" />}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              allowClear
              className="w-full sm:w-80 rounded-xl"
            />
            {/* Group Filter */}
            <Select
              placeholder="Filter by Group"
              value={selectedGroupFilter}
              onChange={(val) => setSelectedGroupFilter(val)}
              allowClear
              className="w-full sm:w-48 rounded-xl"
              showSearch
              optionFilterProp="children"
            >
              {availableGroups.map((g) => (
                <Option key={g.id} value={g.id}>
                  {g.name}
                </Option>
              ))}
            </Select>
          </div>

          {/* Admin filters if applicable */}
          {isAdmin && (
            <div className="flex items-center gap-2 w-full md:w-auto">
              <Select
                placeholder="Filter by Centre"
                value={adminCentreFilter}
                onChange={(val) => setAdminCentreFilter(val)}
                allowClear
                className="w-40"
              >
                {centres.map((c) => (
                  <Option key={c.id} value={c.id}>
                    {c.name}
                  </Option>
                ))}
              </Select>
              <Select
                placeholder="Filter by Group"
                value={adminGroupFilter}
                onChange={(val) => setAdminGroupFilter(val)}
                allowClear
                className="w-40"
              >
                {groups.map((g) => (
                  <Option key={g.id} value={g.id}>
                    {g.name}
                  </Option>
                ))}
              </Select>
            </div>
          )}
        </div>

        {/* Staff Table */}
        <div className="mt-6 overflow-x-auto">
          <Table
            columns={columns}
            dataSource={filteredStaff}
            rowKey="pf_id"
            loading={loading}
            pagination={{
              pageSize: 10,
              showSizeChanger: true,
              pageSizeOptions: ['10', '20', '50'],
              showTotal: (total) => `Total ${total} team members`
            }}
            className="staff-table"
          />
        </div>
      </Card>

      {/* ========================================================================= */}
      {/* ADD STAFF MEMBER MODAL                                                    */}
      {/* ========================================================================= */}
      <Modal
        title={
          <div className="flex items-center gap-2 text-slate-800 font-bold text-lg">
            <UserAddOutlined className="text-blue-600" />
            <span>Add New Team Member</span>
          </div>
        }
        open={isAddModalOpen}
        onCancel={() => {
          setIsAddModalOpen(false);
          form.resetFields();
        }}
        footer={null}
        width={560}
        destroyOnClose
        className="rounded-2xl"
      >
        <div className="mb-4 p-3 bg-blue-50/70 border border-blue-100 rounded-xl">
          <div className="text-xs font-semibold text-blue-900 flex items-center gap-1.5">
            <CheckCircleOutlined className="text-blue-600" /> Auto-Assigned Centre:
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <Tag color="blue" className="font-semibold text-xs py-0.5">
              {userCentre?.name || currentUser?.center || currentUser?.centre || 'Assigned automatically'}
            </Tag>
          </div>
          <p className="text-[11px] text-blue-700/80 mt-1 mb-0">
            Centre ID is automatically linked from your scientist profile.
          </p>
        </div>

        <Form
          form={form}
          layout="vertical"
          onFinish={handleCreateStaff}
        >
          {/* Staff Full Name */}
          <Form.Item
            name="name"
            label={<span className="font-semibold text-slate-700">Full Name</span>}
            rules={[
              { required: true, message: 'Please enter the staff member name' },
              { min: 2, message: 'Name must be at least 2 characters' }
            ]}
          >
            <Input
              placeholder="e.g. Dr. A. Sharma / Ranjith Kumar"
              size="large"
              className="rounded-xl"
            />
          </Form.Item>

          {/* Group */}
          <Form.Item
            name="group_id"
            label={<span className="font-semibold text-slate-700">Group</span>}
            rules={[{ required: true, message: 'Please select a group' }]}
          >
            <Select
              placeholder="Select group..."
              size="large"
              allowClear
              showSearch
              optionFilterProp="children"
              className="rounded-xl w-full"
            >
              {availableGroups.map((g) => (
                <Option key={g.id} value={g.id}>
                  {g.name}
                </Option>
              ))}
            </Select>
          </Form.Item>

          {/* Designation */}
          <Form.Item
            name="designation"
            label={<span className="font-semibold text-slate-700">Designation</span>}
            rules={[{ required: true, message: 'Please select or enter designation' }]}
          >
            <AutoComplete
              options={DESIGNATION_OPTIONS.map((desig) => ({ value: desig }))}
              placeholder="Select from list or type custom designation..."
              size="large"
              className="rounded-xl w-full"
              filterOption={(inputValue, option) =>
                (option?.value || '').toLowerCase().includes(inputValue.toLowerCase())
              }
              allowClear
            />
          </Form.Item>

          <Row gutter={16}>
            {/* Type */}
            <Col span={12}>
              <Form.Item
                name="type"
                label={<span className="font-semibold text-slate-700">Type</span>}
              >
                <AutoComplete
                  options={TYPE_OPTIONS.map((t) => ({ value: t }))}
                  placeholder="Select or type..."
                  size="large"
                  className="rounded-xl w-full"
                  filterOption={(inputValue, option) =>
                    (option?.value || '').toLowerCase().includes(inputValue.toLowerCase())
                  }
                  allowClear
                />
              </Form.Item>
            </Col>

            {/* Role */}
            <Col span={12}>
              <Form.Item
                name="role"
                label={<span className="font-semibold text-slate-700">Roles</span>}
              >
                <AutoComplete
                  options={ROLE_OPTIONS.map((r) => ({ value: r }))}
                  placeholder="Select or type role..."
                  size="large"
                  className="rounded-xl w-full"
                  filterOption={(inputValue, option) =>
                    (option?.value || '').toLowerCase().includes(inputValue.toLowerCase())
                  }
                  allowClear
                />
              </Form.Item>
            </Col>
          </Row>

          {/* Admin Overrides (Only shown if admin) */}
          {isAdmin && (
            <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl mb-4">
              <Text className="text-xs font-semibold text-amber-900">Admin Override (Optional):</Text>
              <Row gutter={12} className="mt-2">
                <Col span={24}>
                  <Form.Item name="centre_id" label="Change Centre" className="mb-0">
                    <Select placeholder="Default user centre" allowClear>
                      {centres.map((c) => (
                        <Option key={c.id} value={c.id}>
                          {c.name}
                        </Option>
                      ))}
                    </Select>
                  </Form.Item>
                </Col>
              </Row>
            </div>
          )}

          <Divider className="my-4" />

          <div className="flex items-center justify-end gap-3">
            <Button
              onClick={() => {
                setIsAddModalOpen(false);
                form.resetFields();
              }}
              className="rounded-xl"
            >
              Cancel
            </Button>
            <Button
              type="primary"
              htmlType="submit"
              icon={<CheckCircleOutlined />}
              className="bg-blue-600 hover:bg-blue-500 rounded-xl px-6 font-semibold"
            >
              Save Team Member
            </Button>
          </div>
        </Form>
      </Modal>

      {/* ========================================================================= */}
      {/* EDIT STAFF MEMBER MODAL                                                   */}
      {/* ========================================================================= */}
      <Modal
        title={
          <div className="flex items-center gap-2 text-slate-800 font-bold text-lg">
            <EditOutlined className="text-blue-600" />
            <span>Edit Team Member #{editingStaff?.pf_id}</span>
          </div>
        }
        open={isEditModalOpen}
        onCancel={() => {
          setIsEditModalOpen(false);
          setEditingStaff(null);
          editForm.resetFields();
        }}
        footer={null}
        width={560}
        destroyOnClose
        className="rounded-2xl"
      >
        <Form form={editForm} layout="vertical" onFinish={handleUpdateStaff}>
          <Form.Item
            name="name"
            label={<span className="font-semibold text-slate-700">Full Name</span>}
            rules={[{ required: true, message: 'Please enter staff name' }]}
          >
            <Input size="large" className="rounded-xl" />
          </Form.Item>

          <Form.Item
            name="group_id"
            label={<span className="font-semibold text-slate-700">Group</span>}
            rules={[{ required: true, message: 'Please select a group' }]}
          >
            <Select
              placeholder="Select group..."
              size="large"
              allowClear
              showSearch
              optionFilterProp="children"
              className="rounded-xl w-full"
            >
              {availableGroups.map((g) => (
                <Option key={g.id} value={g.id}>
                  {g.name}
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="designation"
            label={<span className="font-semibold text-slate-700">Designation</span>}
          >
            <AutoComplete
              options={DESIGNATION_OPTIONS.map((desig) => ({ value: desig }))}
              placeholder="Select from list or type custom designation..."
              size="large"
              className="rounded-xl w-full"
              filterOption={(inputValue, option) =>
                (option?.value || '').toLowerCase().includes(inputValue.toLowerCase())
              }
              allowClear
            />
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="type"
                label={<span className="font-semibold text-slate-700">Type</span>}
              >
                <AutoComplete
                  options={TYPE_OPTIONS.map((t) => ({ value: t }))}
                  placeholder="Select or type..."
                  size="large"
                  className="rounded-xl w-full"
                  filterOption={(inputValue, option) =>
                    (option?.value || '').toLowerCase().includes(inputValue.toLowerCase())
                  }
                  allowClear
                />
              </Form.Item>
            </Col>

            <Col span={12}>
              <Form.Item
                name="role"
                label={<span className="font-semibold text-slate-700">Roles</span>}
              >
                <AutoComplete
                  options={ROLE_OPTIONS.map((r) => ({ value: r }))}
                  placeholder="Select or type role..."
                  size="large"
                  className="rounded-xl w-full"
                  filterOption={(inputValue, option) =>
                    (option?.value || '').toLowerCase().includes(inputValue.toLowerCase())
                  }
                  allowClear
                />
              </Form.Item>
            </Col>
          </Row>

          <Divider className="my-4" />

          <div className="flex items-center justify-end gap-3">
            <Button
              onClick={() => {
                setIsEditModalOpen(false);
                setEditingStaff(null);
                editForm.resetFields();
              }}
              className="rounded-xl"
            >
              Cancel
            </Button>
            <Button
              type="primary"
              htmlType="submit"
              className="bg-blue-600 hover:bg-blue-500 rounded-xl px-6 font-semibold"
            >
              Update Details
            </Button>
          </div>
        </Form>
      </Modal>
    </div>
  );
}
