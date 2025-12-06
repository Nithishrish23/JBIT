import React, { useEffect, useState } from 'react';
import api from '../api/client';
import Layout from '../components/Layout';

export default function Dashboard() {
  const [stats, setStats] = useState({
    total_clients: 0,
    active_clients: 0,
    total_licenses: 0,
    total_revenue: 0
  });

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const res = await api.get('/dashboard/stats');
      setStats(res.data);
    } catch (err) {
      console.error("Failed to fetch stats", err);
    }
  };

  const StatCard = ({ title, value, color }) => (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
      <h3 className="text-gray-500 text-sm font-medium uppercase tracking-wider">{title}</h3>
      <div className={`text-3xl font-bold mt-2 ${color}`}>{value}</div>
    </div>
  );

  return (
    <Layout>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard title="Total Clients" value={stats.total_clients} color="text-blue-600" />
        <StatCard title="Active Clients" value={stats.active_clients} color="text-green-600" />
        <StatCard title="Total Licenses" value={stats.total_licenses} color="text-purple-600" />
        <StatCard title="Total Revenue" value={`₹${stats.total_revenue.toLocaleString()}`} color="text-yellow-600" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <h3 className="text-lg font-semibold mb-4">Recent Activity</h3>
          <div className="text-gray-500 text-center py-8">No recent activity to display.</div>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <h3 className="text-lg font-semibold mb-4">System Health</h3>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Server Status</span>
              <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm">Online</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Database Connection</span>
              <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm">Healthy</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">License Server</span>
              <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm">Active</span>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
