import React, { useState, useEffect } from "react";
import { Helmet } from "react-helmet";
import api from "../../api/client";
import { Link } from "react-router-dom";

export default function SellerDashboard() {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    api.get("/api/seller/dashboard/stats").then((res) => {
      setStats(res.data);
    }).catch(err => {
      console.error('Failed to load seller stats', err);
    });
  }, []);

  return (
    <>
      <Helmet>
        <title>Seller Dashboard</title>
      </Helmet>
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-slate-800">Seller Dashboard</h1>
        
        {stats ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider">Total Sales</h3>
              <p className="text-3xl font-bold text-slate-900 mt-2">₹{Number(stats.total_sales || 0).toFixed(2)}</p>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider">Products</h3>
              <p className="text-3xl font-bold text-slate-900 mt-2">{stats.product_count}</p>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider">Pending Orders</h3>
              <p className="text-3xl font-bold text-slate-900 mt-2">{stats.pending_orders}</p>
            </div>
          </div>
        ) : (
          <div className="text-gray-500">Loading stats...</div>
        )}

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-lg font-bold text-slate-800 mb-4">Quick Actions</h2>
          <div className="flex flex-wrap gap-4 text-sm font-medium text-blue-600">
            <Link to="/seller/products" className="hover:text-blue-800 hover:underline bg-blue-50 px-4 py-2 rounded-lg transition-colors">Manage Products</Link>
            <Link to="/seller/orders" className="hover:text-blue-800 hover:underline bg-blue-50 px-4 py-2 rounded-lg transition-colors">View Orders</Link>
            <Link to="/seller/inventory" className="hover:text-blue-800 hover:underline bg-blue-50 px-4 py-2 rounded-lg transition-colors">Update Inventory</Link>
            <Link to="/seller/withdrawals" className="hover:text-blue-800 hover:underline bg-blue-50 px-4 py-2 rounded-lg transition-colors">Request Withdrawal</Link>
          </div>
        </div>
      </div>
    </>
  );
}
