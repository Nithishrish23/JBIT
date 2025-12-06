
import React, { useState, useEffect } from "react";
import { Helmet } from "react-helmet";
import api from "../../api/client";

export default function AdminLogs() {
  const [logs, setLogs] = useState([]);
  const [error, setError] = useState(null);

  const fetchLogs = () => {
    api.get("/api/admin/logs")
      .then((res) => {
        setLogs(res.data.logs || []);
        setError(null);
      })
      .catch((err) => {
        console.error("Failed to fetch logs", err);
        setError("Failed to load logs");
      });
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  return (
    <>
      <Helmet>
        <title>System Logs</title>
      </Helmet>
      <div className="space-y-4">
        <div className="flex justify-between items-center">
            <h1 className="text-2xl font-semibold">System Logs</h1>
            <button onClick={fetchLogs} className="bg-gray-200 px-3 py-1 rounded text-sm hover:bg-gray-300">Refresh</button>
        </div>
        <div className="bg-slate-900 text-gray-300 p-4 rounded-xl shadow font-mono text-xs h-96 overflow-y-auto whitespace-pre-wrap">
            {error ? (
                <div className="text-red-400">{error}</div>
            ) : (
                logs.length > 0 ? logs.join("") : "No logs available."
            )}
        </div>
      </div>
    </>
  );
}
