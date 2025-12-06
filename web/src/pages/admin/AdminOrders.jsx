import React, { useState, useEffect } from "react";
import { Helmet } from "react-helmet";
import api from "../../api/client";

export default function AdminOrders() {
  const [orders, setOrders] = useState([]);
  const [categories, setCategories] = useState([]);
  const [filters, setFilters] = useState({
    sku: "",
    category_id: "",
    status: "",
    start_date: "",
    end_date: ""
  });

  const fetchOrders = () => {
    const params = new URLSearchParams();
    Object.keys(filters).forEach(key => {
        if (filters[key]) params.append(key, filters[key]);
    });
    api.get(`/api/admin/orders?${params.toString()}`).then((res) => {
      setOrders(res.data);
    });
  };

  const fetchCategories = () => {
      api.get("/api/categories").then(res => setCategories(res.data));
  }

  useEffect(() => {
    fetchOrders();
    fetchCategories();
  }, []);

  const handleFilterChange = (e) => {
      setFilters({...filters, [e.target.name]: e.target.value});
  }

  return (
    <>
      <Helmet>
        <title>Orders</title>
      </Helmet>
      <div className="space-y-6">
        {/* Header */}
        <header className="flex flex-wrap justify-between items-center gap-4">
            <div>
                <h1 className="text-textprimary text-3xl font-bold tracking-tight">Orders</h1>
                <p className="text-textsecondary text-base font-normal">Manage and track customer orders.</p>
            </div>
            <div className="flex gap-2">
                <button onClick={fetchOrders} className="flex items-center justify-center gap-2 rounded-lg h-10 px-4 bg-sidebarbg text-textsecondary text-sm font-bold border border-primary/20 hover:bg-brandbg/10">
                    <span className="material-symbols-outlined text-lg">refresh</span>
                    <span>Refresh</span>
                </button>
            </div>
        </header>

        {/* Search & Filter Bar */}
        <div className="bg-sidebarbg p-4 rounded-xl border border-primary/20 space-y-4 shadow-sm">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Search / SKU */}
                <div className="relative flex items-center">
                    <span className="material-symbols-outlined absolute left-3 text-textmuted">search</span>
                    <input 
                        name="sku" 
                        placeholder="Search by SKU..." 
                        value={filters.sku} 
                        onChange={handleFilterChange} 
                        className="w-full pl-10 pr-4 h-10 rounded-lg border border-primary/20 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 text-textprimary bg-transparent" 
                    />
                </div>
                {/* Category */}
                <div className="relative">
                    <select name="category_id" value={filters.category_id} onChange={handleFilterChange} className="w-full h-10 pl-3 pr-8 rounded-lg border border-primary/20 text-sm bg-transparent text-textprimary focus:outline-none focus:ring-2 focus:ring-primary/50 appearance-none">
                        <option value="">All Categories</option>
                        {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                    <span className="material-symbols-outlined absolute right-2 top-2.5 text-textmuted pointer-events-none">expand_more</span>
                </div>
                {/* Status */}
                <div className="relative">
                    <select name="status" value={filters.status} onChange={handleFilterChange} className="w-full h-10 pl-3 pr-8 rounded-lg border border-primary/20 text-sm bg-transparent text-textprimary focus:outline-none focus:ring-2 focus:ring-primary/50 appearance-none">
                        <option value="">All Statuses</option>
                        <option value="pending">Pending</option>
                        <option value="paid">Paid</option>
                        <option value="shipped">Shipped</option>
                        <option value="delivered">Delivered</option>
                        <option value="cancelled">Cancelled</option>
                    </select>
                    <span className="material-symbols-outlined absolute right-2 top-2.5 text-textmuted pointer-events-none">expand_more</span>
                </div>
                {/* Filter Button */}
                <button onClick={fetchOrders} className="h-10 px-6 bg-primary hover:bg-primary/90 text-white text-sm font-bold rounded-lg transition-colors">
                    Apply Filters
                </button>
            </div>
            <div className="flex flex-wrap gap-4 text-sm items-center">
                <span className="text-textsecondary font-medium">Date Range:</span>
                <input type="date" name="start_date" value={filters.start_date} onChange={handleFilterChange} className="h-9 px-3 border border-primary/20 rounded-lg text-textprimary bg-transparent" />
                <span className="text-textmuted">-</span>
                <input type="date" name="end_date" value={filters.end_date} onChange={handleFilterChange} className="h-9 px-3 border border-primary/20 rounded-lg text-textprimary bg-transparent" />
            </div>
        </div>

        {/* Orders Table */}
        <div className="bg-sidebarbg rounded-xl border border-primary/20 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                    <thead className="bg-brandbg/10 border-b border-primary/10">
                        <tr>
                            <th className="px-6 py-4 font-semibold text-textsecondary">Order ID</th>
                            <th className="px-6 py-4 font-semibold text-textsecondary">Customer</th>
                            <th className="px-6 py-4 font-semibold text-textsecondary">Seller(s)</th>
                            <th className="px-6 py-4 font-semibold text-textsecondary">Date</th>
                            <th className="px-6 py-4 font-semibold text-textsecondary">Total</th>
                            <th className="px-6 py-4 font-semibold text-textsecondary">Status</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-primary/10">
                        {orders.map((order) => (
                            <tr key={order.id} className="hover:bg-brandbg/5 transition-colors">
                                <td className="px-6 py-4 font-medium text-textprimary">#{order.id}</td>
                                <td className="px-6 py-4 text-textsecondary">{order.customer_name || order.user_name}</td>
                                <td className="px-6 py-4 text-textsecondary">{order.seller_names || '-'}</td>
                                <td className="px-6 py-4 text-textsecondary">{new Date(order.created_at).toLocaleDateString()}</td>
                                <td className="px-6 py-4 font-medium text-textprimary">₹{Number(order.total).toFixed(2)}</td>
                                <td className="px-6 py-4">
                                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium
                                        ${order.status === 'paid' ? 'bg-success/10 text-success' : 
                                          order.status === 'pending' ? 'bg-warning/10 text-warning' :
                                          order.status === 'cancelled' ? 'bg-error/10 text-error' :
                                          'bg-info/10 text-info'}`}>
                                        {order.status}
                                    </span>
                                </td>
                            </tr>
                        ))}
                        {orders.length === 0 && (
                            <tr>
                                <td colSpan="6" className="p-8 text-center text-textmuted">No orders found matching criteria.</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
            {/* Footer/Pagination Placeholder */}
            <div className="flex items-center justify-between p-4 border-t border-primary/10 bg-brandbg/5">
                <p className="text-sm text-textsecondary">Showing {orders.length} results</p>
                {/* Add pagination controls here if backend supports it */}
            </div>
        </div>
      </div>
    </>
  );
}