import React, { useEffect, useState, useMemo } from "react";
import axios from "axios";
import { Input, Button, Select, Table, Tag, Tooltip, message, Pagination } from "antd";
import {
  BellOutlined,
  SearchOutlined,
  CheckOutlined,
  CheckCircleOutlined,
  FileTextOutlined,
  PaperClipOutlined,
  EyeOutlined,
  ClockCircleOutlined,
  UserOutlined,
  FilterOutlined,
  FolderOutlined,
} from "@ant-design/icons";
import { API_BASE_URL } from "../config/api.js";
import { formatDateTime } from "../config/date.js";

const GhNotification = () => {
  const [notifications, setNotifications] = useState([]);
  const [searchText, setSearchText] = useState("");
  const [selectedProjectId, setSelectedProjectId] = useState("ALL");
  const [loading, setLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);

  useEffect(() => {
    const rawUser = window.localStorage.getItem("ppm_user");
    if (!rawUser) return;
    try {
      const parsedUser = JSON.parse(rawUser);
      setLoading(true);
      axios
        .get(
          `${API_BASE_URL}/notifications/by-quotation-user/?name=${encodeURIComponent(
            parsedUser.name
          )}`
        )
        .then((res) => {
          const filtered = (res.data || []).filter(
            (n) => n.trigerred_by !== "Coordinator" && n.is_read !== 1
          );
          setNotifications(filtered);
        })
        .catch((error) => console.error("Error fetching notifications:", error))
        .finally(() => setLoading(false));
    } catch (e) {
      console.error("Error parsing user data:", e);
    }
  }, []);

  // Extract unique Project IDs
  const projectIdList = useMemo(() => {
    const map = new Map();
    notifications.forEach((n) => {
      const id = n.project_number
        ? String(n.project_number).trim()
        : n.proposal_name
        ? `Proposal: ${n.proposal_name}`
        : "General Updates";
      map.set(id, (map.get(id) || 0) + 1);
    });
    return Array.from(map.entries()).map(([id, count]) => ({ id, count }));
  }, [notifications]);

  // Filter notifications based on search text AND selected Project ID
  const filteredNotifications = useMemo(() => {
    return notifications.filter((n) => {
      const id = n.project_number
        ? String(n.project_number).trim()
        : n.proposal_name
        ? `Proposal: ${n.proposal_name}`
        : "General Updates";

      if (selectedProjectId !== "ALL" && id !== selectedProjectId) {
        return false;
      }

      if (!searchText) return true;
      const searchLower = searchText.toLowerCase();
      return (
        n.message?.toLowerCase().includes(searchLower) ||
        n.user_name?.toLowerCase().includes(searchLower) ||
        n.project_number?.toString().includes(searchLower) ||
        n.proposal_name?.toLowerCase().includes(searchLower) ||
        n.document_name?.toLowerCase().includes(searchLower)
      );
    });
  }, [notifications, searchText, selectedProjectId]);

  // Paginated notifications for non-scrolling layout
  const paginatedNotifications = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredNotifications.slice(start, start + pageSize);
  }, [filteredNotifications, currentPage, pageSize]);

  const markAsRead = (id) => {
    axios
      .put(`${API_BASE_URL}/notifications/${id}`, { is_read: 1 })
      .then(() => {
        setNotifications((prev) => prev.filter((n) => n.id !== id));
        message.success("Notification marked as read");
      })
      .catch((error) => console.error("Error marking as read:", error));
  };

  const markAllAsRead = () => {
    if (notifications.length === 0) return;
    const promises = notifications.map((n) =>
      axios.put(`${API_BASE_URL}/notifications/${n.id}`, { is_read: 1 })
    );
    Promise.all(promises)
      .then(() => {
        setNotifications([]);
        message.success("All notifications cleared");
      })
      .catch((error) => console.error("Error marking all as read:", error));
  };

  const viewDocument = (url) => {
    if (!url) return;
    const resolved = /^https?:\/\//i.test(url)
      ? url
      : `${API_BASE_URL}${String(url).startsWith("/") ? "" : "/"}${url}`;
    window.open(resolved, "_blank", "noopener,noreferrer");
  };

  const getCategoryStyle = (n) => {
    const text = (
      (n.message || "") +
      " " +
      (n.document_name || "") +
      " " +
      (n.proposal_name || "")
    ).toLowerCase();

    if (
      text.includes("po") ||
      text.includes("order") ||
      text.includes("approval") ||
      text.includes("accepted")
    ) {
      return {
        label: "PO & Approval",
        borderStyle: "border-l-emerald-500 hover:border-l-emerald-600",
        badgeStyle: "bg-emerald-50 text-emerald-700 border-emerald-200/80",
        icon: <CheckCircleOutlined className="text-emerald-600" />,
      };
    }
    if (
      text.includes("document") ||
      text.includes("upload") ||
      text.includes("file")
    ) {
      return {
        label: "Document",
        borderStyle: "border-l-purple-500 hover:border-l-purple-600",
        badgeStyle: "bg-purple-50 text-purple-700 border-purple-200/80",
        icon: <PaperClipOutlined className="text-purple-600" />,
      };
    }
    if (text.includes("proposal") || text.includes("quote")) {
      return {
        label: "Proposal",
        borderStyle: "border-l-blue-500 hover:border-l-blue-600",
        badgeStyle: "bg-blue-50 text-blue-700 border-blue-200/80",
        icon: <FileTextOutlined className="text-blue-600" />,
      };
    }
    return {
      label: "Update",
      borderStyle: "border-l-amber-500 hover:border-l-amber-600",
      badgeStyle: "bg-amber-50 text-amber-700 border-amber-200/80",
      icon: <BellOutlined className="text-amber-600" />,
    };
  };

  return (
    <div className="h-screen w-full bg-slate-50/80 p-4 md:p-6 font-sans flex flex-col overflow-hidden">
      <div className="w-full space-y-4 flex-1 flex flex-col min-h-0">
        {/* Top Light Header Card */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/80 flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 shadow-2xs">
              <BellOutlined style={{ fontSize: 22 }} />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-xl font-bold text-slate-800 tracking-tight m-0">
                  Notification Center
                </h1>
                {notifications.length > 0 && (
                  <span className="bg-blue-600 text-white text-xs font-bold px-2.5 py-0.5 rounded-full shadow-2xs">
                    {notifications.length} Unread
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 m-0 mt-0.5 font-normal">
                Real-time activity alerts, proposal approvals, and project updates
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Select Project ID Dropdown Container */}
            <div className="flex items-center gap-2 bg-slate-100 px-3 py-1.5 rounded-xl border border-slate-200">
              <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5 shrink-0">
                <FolderOutlined className="text-blue-600" /> Select Project ID:
              </span>
              <Select
                value={selectedProjectId}
                onChange={(val) => {
                  setSelectedProjectId(val);
                  setCurrentPage(1);
                }}
                className="w-44 md:w-52 text-xs"
                popupMatchSelectWidth={false}
                options={[
                  { value: "ALL", label: `All Project IDs (${notifications.length})` },
                  ...projectIdList.map((p) => ({
                    value: p.id,
                    label: `${p.id.startsWith("Proposal:") ? p.id : "Project #" + p.id} (${p.count})`,
                  })),
                ]}
              />
            </div>

            {/* Search Input */}
            <Input
              placeholder="Search details..."
              prefix={<SearchOutlined className="text-slate-400" />}
              value={searchText}
              onChange={(e) => {
                setSearchText(e.target.value);
                setCurrentPage(1);
              }}
              className="w-36 md:w-44 text-xs py-1.5 rounded-xl border-slate-200"
              allowClear
            />

            {notifications.length > 0 && (
              <Tooltip title="Mark all notifications as read">
                <Button
                  onClick={markAllAsRead}
                  icon={<CheckOutlined />}
                  size="middle"
                  className="rounded-xl border-slate-200 text-slate-700 text-xs font-semibold hover:border-slate-300"
                >
                  Clear All
                </Button>
              </Tooltip>
            )}
          </div>
        </div>

        {/* Content Section: Cards Grid with Left Category Accent Borders */}
        <div className="flex-1 flex flex-col justify-between min-h-0 bg-white rounded-2xl p-5 shadow-sm border border-slate-200/90">
          {filteredNotifications.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center py-16 text-center">
              <div className="w-16 h-16 bg-indigo-50 rounded-2xl flex items-center justify-center mb-3 text-indigo-400 shadow-xs border border-indigo-100/50">
                <BellOutlined style={{ fontSize: 28 }} />
              </div>
              <h3 className="text-base font-bold text-slate-800 m-0">
                No notifications found
              </h3>
              <p className="text-xs text-slate-500 mt-1 max-w-xs leading-relaxed">
                {selectedProjectId !== "ALL"
                  ? `No unread notifications matching ${selectedProjectId}.`
                  : searchText
                  ? "No matching notification alerts found."
                  : "You are all caught up! Zero unread alerts."}
              </p>
            </div>
          ) : (
            <div className="space-y-3 overflow-y-auto pr-1 flex-1">
              {paginatedNotifications.map((n) => {
                const cat = getCategoryStyle(n);
                const projLabel = n.project_number
                  ? `Project #${n.project_number}`
                  : n.proposal_name
                  ? `Proposal: ${n.proposal_name}`
                  : "General Notice";

                return (
                  <div
                    key={n.id}
                    className={`bg-white rounded-xl p-4 border border-slate-200/90 border-l-4 ${cat.borderStyle} shadow-2xs hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 flex flex-col md:flex-row md:items-center justify-between gap-3 group`}
                  >
                    <div className="space-y-2 flex-1 min-w-0">
                      {/* Top Badges Row */}
                      <div className="flex flex-wrap items-center gap-2">
                        {/* Project Badge */}
                        <span className="text-[11px] font-bold bg-slate-900 text-white px-2.5 py-0.5 rounded-md shadow-2xs">
                          {projLabel}
                        </span>

                        {/* Category Badge */}
                        <span
                          className={`inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-0.5 rounded-md border ${cat.badgeStyle}`}
                        >
                          {cat.icon}
                          {cat.label}
                        </span>

                        <span className="text-xs font-semibold text-slate-600 flex items-center gap-1">
                          <UserOutlined className="text-slate-400 text-[11px]" />
                          {n.user_name || "System"}
                        </span>
                      </div>

                      {/* Notification Message */}
                      <p className="text-xs font-medium text-slate-800 m-0 leading-relaxed truncate md:whitespace-normal">
                        {n.message}
                      </p>

                      {/* Attached File Name Tag */}
                      {n.document_name && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-md border border-purple-200/60">
                          <PaperClipOutlined className="text-purple-500" />
                          File: {n.document_name}
                        </span>
                      )}
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center gap-2 shrink-0 pt-1 md:pt-0">
                      {n.document_url && (
                        <Button
                          type="default"
                          size="small"
                          onClick={() => viewDocument(n.document_url)}
                          icon={<EyeOutlined />}
                          className="bg-indigo-50/70 border-indigo-200 text-indigo-700 hover:text-indigo-800 hover:border-indigo-300 font-semibold text-xs rounded-lg"
                        >
                          View Document ↗
                        </Button>
                      )}
                      <Button
                        type="primary"
                        size="small"
                        onClick={() => markAsRead(n.id)}
                        icon={<CheckOutlined />}
                        className="bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs rounded-lg shadow-2xs"
                      >
                        Mark Read
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Pagination Footer */}
          {filteredNotifications.length > 0 && (
            <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-2 shrink-0">
              <span className="text-xs font-medium text-slate-500">
                Showing {paginatedNotifications.length} of {filteredNotifications.length} notifications
              </span>
              <Pagination
                current={currentPage}
                pageSize={pageSize}
                total={filteredNotifications.length}
                onChange={(page, newSize) => {
                  setCurrentPage(page);
                  if (newSize && newSize !== pageSize) {
                    setPageSize(newSize);
                    setCurrentPage(1);
                  }
                }}
                showSizeChanger={true}
                pageSizeOptions={["5", "10", "15", "20", "25"]}
                size="small"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default GhNotification;