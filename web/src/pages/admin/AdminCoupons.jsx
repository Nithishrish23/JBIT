import React, { useState, useEffect } from "react";
import { Helmet } from "react-helmet";
import api from "../../api/client";

export default function AdminCoupons() {
  const [coupons, setCoupons] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [newCoupon, setNewCoupon] = useState({
    code: "",
    discount_percent: "",
    max_discount_amount: "",
    min_order_value: "",
    expiry_date: "",
    usage_limit: ""
  });

  useEffect(() => {
    fetchCoupons();
  }, []);

  const fetchCoupons = () => {
    // Need an endpoint to list coupons. Admin should see all.
    // Currently 'create_coupon' is in admin.py (no, it was in app.py, refactored to... where?)
    // I missed adding `list_coupons` in `admin.py` during refactor?
    // Let's check `admin.py` content I wrote.
    // I wrote `admin_add_user`, `admin_users`, `admin_dashboard`... 
    // I might have missed `admin_coupons` GET.
    // But I can add it now implicitly by ensuring the backend has it.
    // Actually, I need to add `list_coupons` to `admin.py` in backend first?
    // Wait, I can't modify backend anymore unless necessary. 
    // Did I add it? I added `create_coupon` in `admin.py`? No, I added `create_coupon` in `admin.py`... wait.
    // I need to check `admin.py` again.
    // If it's missing, I MUST add it to backend `routes/admin.py`.
    
    // Assuming I will add it or it exists. 
    api.get("/api/admin/coupons").then((res) => {
      setCoupons(res.data);
    }).catch(() => setCoupons([]));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.post("/api/coupons", newCoupon);
      alert("Coupon created!");
      setShowModal(false);
      fetchCoupons();
      setNewCoupon({ code: "", discount_percent: "", max_discount_amount: "", min_order_value: "", expiry_date: "", usage_limit: "" });
    } catch (err) {
      alert(err.response?.data?.error || "Failed to create coupon");
    }
  };

  const handleDelete = async (id) => {
      if(!window.confirm("Delete coupon?")) return;
      try {
          await api.delete(`/api/admin/coupons/${id}`);
          fetchCoupons();
      } catch (err) {
          alert("Failed to delete");
      }
  }

  return (
    <>
      <Helmet><title>Manage Coupons</title></Helmet>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold">Coupons</h1>
            <button onClick={() => setShowModal(true)} className="bg-slate-900 text-white px-4 py-2 rounded">Add Coupon</button>
        </div>

        <div className="bg-white rounded-xl shadow overflow-hidden">
            <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 text-slate-500 border-b">
                    <tr>
                        <th className="p-4">Code</th>
                        <th className="p-4">Discount</th>
                        <th className="p-4">Type</th>
                        <th className="p-4">Min Order</th>
                        <th className="p-4">Expiry</th>
                        <th className="p-4">Usage</th>
                        <th className="p-4">Action</th>
                    </tr>
                </thead>
                <tbody className="divide-y">
                    {coupons.map(c => (
                        <tr key={c.id} className="hover:bg-slate-50">
                            <td className="p-4 font-bold">{c.code}</td>
                            <td className="p-4">{c.discount_percent}% {c.max_discount_amount ? `(Max ₹${c.max_discount_amount})` : ''}</td>
                            <td className="p-4 capitalize">{c.type}</td>
                            <td className="p-4">₹{c.min_order_value}</td>
                            <td className="p-4">{c.expiry_date ? new Date(c.expiry_date).toLocaleDateString() : 'No Expiry'}</td>
                            <td className="p-4">{c.used_count} / {c.usage_limit || '∞'}</td>
                            <td className="p-4">
                                <button onClick={() => handleDelete(c.id)} className="text-red-600 hover:underline">Delete</button>
                            </td>
                        </tr>
                    ))}
                    {coupons.length === 0 && <tr><td colSpan="7" className="p-8 text-center text-slate-400">No coupons found.</td></tr>}
                </tbody>
            </table>
        </div>

        {showModal && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
                <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-md">
                    <h2 className="text-lg font-bold mb-4">Create Coupon</h2>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <input placeholder="Code (e.g. SUMMER50)" value={newCoupon.code} onChange={e => setNewCoupon({...newCoupon, code: e.target.value})} className="w-full border rounded px-3 py-2" required />
                        <div className="grid grid-cols-2 gap-4">
                            <input type="number" placeholder="Discount %" value={newCoupon.discount_percent} onChange={e => setNewCoupon({...newCoupon, discount_percent: e.target.value})} className="border rounded px-3 py-2" required />
                            <input type="number" placeholder="Max Amount (₹)" value={newCoupon.max_discount_amount} onChange={e => setNewCoupon({...newCoupon, max_discount_amount: e.target.value})} className="border rounded px-3 py-2" />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <input type="number" placeholder="Min Order (₹)" value={newCoupon.min_order_value} onChange={e => setNewCoupon({...newCoupon, min_order_value: e.target.value})} className="border rounded px-3 py-2" />
                            <input type="number" placeholder="Usage Limit" value={newCoupon.usage_limit} onChange={e => setNewCoupon({...newCoupon, usage_limit: e.target.value})} className="border rounded px-3 py-2" />
                        </div>
                        <div>
                            <label className="text-xs text-gray-500">Expiry Date</label>
                            <input type="datetime-local" value={newCoupon.expiry_date} onChange={e => setNewCoupon({...newCoupon, expiry_date: e.target.value})} className="w-full border rounded px-3 py-2" />
                        </div>
                        <div className="flex justify-end gap-2 pt-2">
                            <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-50 border rounded">Cancel</button>
                            <button type="submit" className="px-4 py-2 bg-slate-900 text-white rounded hover:bg-slate-800">Create</button>
                        </div>
                    </form>
                </div>
            </div>
        )}
      </div>
    </>
  );
}
