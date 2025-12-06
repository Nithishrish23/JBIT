import React, { useState, useEffect } from "react";
import { Helmet } from "react-helmet";
import { Link } from "react-router-dom";
import api from "../../api/client";

export default function UserDashboard() {
  const [recentOrders, setRecentOrders] = useState([]);
  // avoid reading localStorage during render — load in effect
  const [user, setUser] = useState(undefined);
  const [sellerRequestMsg, setSellerRequestMsg] = useState(null);

  useEffect(() => {
    try {
      setUser(JSON.parse(localStorage.getItem("user")));
    } catch {
      setUser(null);
    }
  }, []);

  const requestSeller = async () => {
    try {
      const res = await api.post('/api/user/request-seller', {});
      setSellerRequestMsg(`Request submitted. Status: ${res.data.status || res.data.message || 'requested'}`);
    } catch (err) {
      const msg = err?.response?.data?.message || err?.response?.data?.description || 'Failed to submit request';
      setSellerRequestMsg(msg);
    }
  }

  useEffect(() => {
    // Fetch last 3 orders
    api.get("/api/user/orders?limit=3").then((res) => {
      setRecentOrders(res.data);
    });
  }, []);

  return (
    <>
      <Helmet>
        <title>User Dashboard</title>
      </Helmet>
      <div className="space-y-4">
        <Link to="/profile" className="hover:underline">
            <h1 className="text-2xl font-semibold">Welcome, {user?.name}!</h1>
        </Link>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Link to="/orders" className="bg-white rounded-xl shadow p-5 hover:shadow-lg transition">
                <h3 className="font-semibold">Your Orders</h3>
                <p className="text-sm text-gray-500">Track and manage your orders.</p>
            </Link>
            <Link to="/profile" className="bg-white rounded-xl shadow p-5 hover:shadow-lg transition">
                <h3 className="font-semibold">Your Profile</h3>
                <p className="text-sm text-gray-500">Edit your profile and password.</p>
            </Link>
            <Link to="/addresses" className="bg-white rounded-xl shadow p-5 hover:shadow-lg transition">
                <h3 className="font-semibold">Your Addresses</h3>
                <p className="text-sm text-gray-500">Manage your shipping addresses.</p>
            </Link>
        </div>
        {user && user.role !== 'seller' && (
          <div className="bg-white rounded-xl shadow p-5">
            <h2 className="font-semibold mb-2">Seller Account</h2>
            <p className="text-sm text-gray-600 mb-3">Want to sell on the platform? Submit a request and an admin will review it.</p>
            <div className="flex items-center gap-3">
              <button className="bg-amber-600 text-white px-4 py-2 rounded" onClick={requestSeller}>Request Seller Access</button>
              {sellerRequestMsg && <div className="text-sm text-gray-700">{sellerRequestMsg}</div>}
            </div>
          </div>
        )}
        <div className="bg-white rounded-xl shadow p-5">
            <h2 className="font-semibold mb-2">Recent Orders</h2>
            {recentOrders.length > 0 ? recentOrders.map(order => (
                <div key={order.id} className="flex justify-between items-center text-sm border-t py-2">
                    <span>Order #{order.id}</span>
                    <p className="text-3xl font-bold text-slate-900 mt-2">₹{order.total.toFixed(2)}</p>
                    <span>{order.status}</span>
                </div>
            )) : <p className="text-sm text-gray-500">You have no recent orders.</p>}
        </div>
      </div>
    </>
  );
}