import React, { useEffect, useState } from 'react';
import api from '../api/client';
import Layout from '../components/Layout';

export default function Revenue() {
  const [data, setData] = useState({
    total_revenue: 0,
    monthly_revenue: 0,
    todays_sales: 0,
    recent_transactions: []
  });

  useEffect(() => {
    fetchRevenue();
  }, []);

  const fetchRevenue = async () => {
    try {
      const res = await api.get('/revenue');
      setData(res.data);
    } catch (err) { console.error(err); }
  };

  const StatCard = ({ title, value, color }) => (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
      <h3 className="text-gray-500 text-sm font-medium uppercase tracking-wider">{title}</h3>
      <div className={`text-3xl font-bold mt-2 ${color}`}>{value}</div>
    </div>
  );

  return (
    <Layout>
      <h2 className="text-2xl font-bold text-gray-800 mb-6">Revenue Analytics</h2>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <StatCard title="Total Revenue" value={`₹${data.total_revenue.toLocaleString()}`} color="text-green-600" />
        <StatCard title="Monthly Revenue" value={`₹${data.monthly_revenue.toLocaleString()}`} color="text-blue-600" />
        <StatCard title="Today's Sales" value={`₹${data.todays_sales.toLocaleString()}`} color="text-purple-600" />
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="font-semibold text-gray-700">Recent Transactions</h3>
        </div>
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Client</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {data.recent_transactions.map((tx) => (
              <tr key={tx.revenue_id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap text-gray-500">{new Date(tx.transaction_date).toLocaleString()}</td>
                <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900">{tx.client_name}</td>
                <td className="px-6 py-4 whitespace-nowrap text-green-600 font-bold">${tx.amount.toFixed(2)}</td>
                <td className="px-6 py-4 whitespace-nowrap text-gray-400 text-sm font-mono">{tx.revenue_id.substring(0, 8)}...</td>
              </tr>
            ))}
            {data.recent_transactions.length === 0 && (
              <tr>
                <td colSpan="4" className="px-6 py-8 text-center text-gray-500">No transactions found</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Layout>
  );
}
