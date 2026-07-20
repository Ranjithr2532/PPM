import React, { useEffect, useState } from "react";
import axios from "axios";
import { API_BASE_URL } from "../config/api.js";
import { formatDateTime } from "../config/date.js";

const GhNotification = () => {
  const [notifications, setNotifications] = useState([]);
  const [searchText, setSearchText] = useState('');

  useEffect(() => {

      const rawUser = window.localStorage.getItem("ppm_user");
      const parsedUser = JSON.parse(rawUser);

    axios.get(`${API_BASE_URL}/notifications/by-quotation-user/?name=${encodeURIComponent(parsedUser.name)}`)
      .then((notificationsRes) => {
        const filtered = notificationsRes.data.filter(
          (n) => n.trigerred_by !== "Coordinator" && n.is_read !== 1
        );
        setNotifications(filtered);
      })
      .catch((error) => console.error("Error fetching notifications:", error));
  }, []);

  // Filter notifications based on search text
  const filteredNotifications = notifications.filter((n) => {
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

  const markAsRead = (id) => {
    axios
      .put(`${API_BASE_URL}/notifications/${id}`, { is_read: 1 })
      .then(() => {
        setNotifications(notifications.filter((n) => n.id !== id));
      })
      .catch((error) => console.error("Error marking as read:", error));
  };

  const viewDocument = (url) => {
    if (!url) return;
    const resolved = /^https?:\/\//i.test(url)
      ? url
      : `${API_BASE_URL}${String(url).startsWith('/') ? '' : '/'}${url}`;
    window.open(resolved, '_blank', 'noopener,noreferrer');
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        backgroundColor: "#f8fafc",
        padding: "40px 20px",
        fontFamily: "'Inter', 'Segoe UI', sans-serif",
      }}
    >
      {/* Remove or increase maxWidth — this is the key change */}
      <div style={{ maxWidth: "1500px", margin: "0 auto" }}>  
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: "40px" }}>
          <h1
            style={{
              fontSize: "32px",
              fontWeight: "600",
              color: "#1e293b",
              margin: "0 0 8px 0",
            }}
          >
            Notifications
          </h1>
          <p style={{ color: "#64748b", fontSize: "16px" }}>
            {filteredNotifications.length > 0
              ? `You have ${filteredNotifications.length} notification${filteredNotifications.length > 1 ? "s" : ""}`
              : searchText ? "No matching notifications found" : "No new notifications"}
          </p>
        </div>

        {/* Search Bar */}
        <div style={{ marginBottom: "16px", display: "flex", justifyContent: "center" }}>
          <input
            type="text"
            placeholder="Search notifications..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            style={{
              width: "400px",
              maxWidth: "100%",
              padding: "8px 14px",
              borderRadius: "8px",
              border: "1px solid #d1d5db",
              fontSize: "14px",
              outline: "none",
              backgroundColor: "white",
            }}
            onFocus={(e) => {
              e.target.style.borderColor = "#3b82f6";
            }}
            onBlur={(e) => {
              e.target.style.borderColor = "#d1d5db";
            }}
          />
        </div>

        {/* Empty State */}
        {filteredNotifications.length === 0 ? (
          <div
            style={{
              background: "white",
              borderRadius: "16px",
              padding: "80px 40px",
              textAlign: "center",
              boxShadow: "0 4px 20px rgba(0,0,0,0.05)",
              border: "1px solid #e2e8f0",
            }}
          >
            <div
              style={{
                width: "80px",
                height: "80px",
                backgroundColor: "#f1f5f9",
                borderRadius: "50%",
                margin: "0 auto 24px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <span style={{ fontSize: "36px" }}>Check</span>
            </div>
            <h3 style={{ fontSize: "22px", fontWeight: "600", color: "#1e293b", margin: "0 0 8px" }}>
              All caught up!
            </h3>
            <p style={{ color: "#64748b", fontSize: "16px" }}>
              There are no new notifications at the moment.
            </p>
          </div>
        ) : (
          /* Notifications List */
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            {filteredNotifications.map((n, i) => (
              <div
                key={n.id}
                style={{
                  background: "white",
                  borderRadius: "14px",
                  padding: "24px",
                  boxShadow: "0 4px 16px rgba(0,0,0,0.06)",
                  border: "1px solid #e2e8f0",
                  transition: "all 0.25s ease",
                  animation: `fadeIn 0.4s ease-out ${i * 0.1}s both`,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.boxShadow = "0 10px 30px rgba(0,0,0,0.1)";
                  e.currentTarget.style.transform = "translateY(-2px)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.boxShadow = "0 4px 16px rgba(0,0,0,0.06)";
                  e.currentTarget.style.transform = "translateY(0)";
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px" }}>
                      <strong style={{ fontSize: "17px", color: "#1e293b" }}>{n.user_name}</strong>
                      <span style={{ color: "#94a3b8", fontSize: "14px" }}>•</span>
                      <span style={{ color: "#64748b", fontSize: "14px" }}>
                        {formatDateTime(n.created_at)}
                      </span>
                    </div>

                    <p style={{ fontSize: "16px", color: "#475569", lineHeight: "1.6", margin: "12px 0" }}>
                      {n.message}
                    </p>

                    {/* Optional details */}
                    {(n.project_number || n.proposal_name || n.document_name) && (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "10px", marginTop: "12px" }}>
                        {n.project_number && (
                          <span
                            style={{
                              background: "#f8fafc",
                              color: "#475569",
                              padding: "6px 12px",
                              borderRadius: "8px",
                              fontSize: "13px",
                              border: "1px solid #e2e8f0",
                            }}
                          >
                            Project #{n.project_number}
                          </span>
                        )}
                        {n.proposal_name && (
                          <span
                            style={{
                              background: "#f8fafc",
                              color: "#475569",
                              padding: "6px 12px",
                              borderRadius: "8px",
                              fontSize: "13px",
                              border: "1px solid #e2e8f0",
                            }}
                          >
                            {n.proposal_name}
                          </span>
                        )}
                        {n.document_name && (
                          <span
                            style={{
                              background: "#f8fafc",
                              color: "#475569",
                              padding: "6px 12px",
                              borderRadius: "8px",
                              fontSize: "13px",
                              border: "1px solid #e2e8f0",
                            }}
                          >
                            {n.document_name}
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Mark as Read Button */}
                  <div style={{ display: "flex", gap: "8px" }}>
                    {n.document_url && (
                      <button
                        onClick={() => viewDocument(n.document_url)}
                        style={{
                          backgroundColor: "#f8fafc",
                          color: "#1e293b",
                          border: "1px solid #cbd5e1",
                          padding: "10px 16px",
                          borderRadius: "10px",
                          fontSize: "14px",
                          fontWeight: "500",
                          cursor: "pointer",
                        }}
                      >
                        View Document
                      </button>
                    )}
                    <button
                      onClick={() => markAsRead(n.id)}
                      style={{
                        backgroundColor: "#1e293b",
                        color: "white",
                        border: "none",
                        padding: "10px 20px",
                        borderRadius: "10px",
                        fontSize: "14px",
                        fontWeight: "500",
                        cursor: "pointer",
                        transition: "all 0.2s",
                      }}
                      onMouseEnter={(e) => {
                        e.target.style.backgroundColor = "#0f172a";
                        e.target.style.transform = "scale(1.05)";
                      }}
                      onMouseLeave={(e) => {
                        e.target.style.backgroundColor = "#1e293b";
                        e.target.style.transform = "scale(1)";
                      }}
                    >
                      Mark as Read
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Simple fade-in animation */}
      <style jsx>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(15px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
};

export default GhNotification;