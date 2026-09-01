import React, { useState, useEffect } from 'react';
import { Modal, Form, Input, Button, message } from 'antd';
import axios from 'axios';
import { API_BASE_URL, getCurrentUser, setCurrentUser } from '../config/api';

export default function ProfileCompletionModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form] = Form.useForm();
  const [currentUserData, setCurrentUserData] = useState(null);

  useEffect(() => {
    const user = getCurrentUser();
    if (!user) return;

    setCurrentUserData(user);

    const hasDesignation = Boolean(user.designation && String(user.designation).trim());
    const hasType = Boolean(user.type && String(user.type).trim());

    // Show modal if either designation OR type is missing/empty
    if (!hasDesignation || !hasType) {
      form.setFieldsValue({
        designation: user.designation || '',
        type: user.type || '',
      });
      setIsOpen(true);
    }
  }, [form]);

  const handleSkip = () => {
    setIsOpen(false);
  };

  const handleSubmit = async (values) => {
    const desig = (values.designation || '').trim();
    const typeVal = (values.type || '').trim();

    if (!desig || !typeVal) {
      message.error('Please fill in both Designation and Type fields before submitting.');
      return;
    }

    const userId = currentUserData?.id || currentUserData?.user_id;
    if (!userId) {
      message.error('User ID not found. Please re-log in.');
      return;
    }

    setLoading(true);
    try {
      const response = await axios.put(`${API_BASE_URL}/users/${userId}`, {
        designation: desig,
        type: typeVal,
      });

      // Update current user in localStorage & memory
      const updatedUser = {
        ...currentUserData,
        ...response.data,
        designation: desig,
        type: typeVal,
      };

      setCurrentUser(updatedUser);
      setCurrentUserData(updatedUser);

      message.success('Profile details updated successfully!');
      setIsOpen(false);
    } catch (err) {
      console.error('Failed to update user profile:', err);
      const errMsg = err.response?.data?.detail || 'Failed to save profile details. Please try again.';
      message.error(errMsg);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <Modal
      title={
        <div className="font-bold text-slate-800 text-lg border-b pb-2">
          Please enter details to be added for all documents
        </div>
      }
      open={isOpen}
      onCancel={handleSkip}
      footer={null}
      destroyOnClose
      maskClosable={false}
      centered
      className="rounded-2xl"
    >
      <div className="py-2">
        <p className="text-sm text-slate-600 mb-4">
          Your profile is missing designation or field/domain type information. Providing these details ensures they appear accurately across generated documents.
        </p>

        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          requiredMark={false}
        >
          {/* Designation */}
          <Form.Item
            name="designation"
            label={
              <div className="flex flex-col">
                <span className="font-semibold text-slate-700">Designation</span>
                <span className="text-xs text-slate-500 font-normal mt-0.5">
                  e.g. SCIENTIST-C, SCIENTIST-D, SCIENTIST-E, GH SMC, CH SMPM
                </span>
              </div>
            }
            rules={[{ required: true, message: 'Please enter your designation' }]}
          >
            <Input
              placeholder="Enter designation..."
              size="large"
              className="rounded-xl w-full"
            />
          </Form.Item>

          {/* Field / Domain Type */}
          <Form.Item
            name="type"
            label={
              <div className="flex flex-col">
                <span className="font-semibold text-slate-700">Field / Domain Type</span>
                <span className="text-xs text-slate-500 font-normal mt-0.5">
                  e.g. Computer Science, Mechanical, Electrical & Communication
                </span>
              </div>
            }
            rules={[{ required: true, message: 'Please enter your field type' }]}
          >
            <Input
              placeholder="Enter field/domain type..."
              size="large"
              className="rounded-xl w-full"
            />
          </Form.Item>

          <div className="flex items-center justify-end gap-3 pt-4 border-t mt-6">
            <Button
              size="large"
              onClick={handleSkip}
              className="rounded-xl border-slate-300 text-slate-600 hover:text-slate-800"
            >
              Skip for now
            </Button>
            <Button
              type="primary"
              htmlType="submit"
              size="large"
              loading={loading}
              className="rounded-xl bg-blue-600 hover:bg-blue-500 shadow-md shadow-blue-500/20"
            >
              Submit
            </Button>
          </div>
        </Form>
      </div>
    </Modal>
  );
}
