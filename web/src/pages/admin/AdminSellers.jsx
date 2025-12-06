
import React, { useState, useEffect } from "react";
import { Helmet } from "react-helmet";
import api from "../../api/client";

export default function AdminSellers() {
  const [sellers, setSellers] = useState([]);
  const [requests, setRequests] = useState([]);
  const [withdrawals, setWithdrawals] = useState([]);
  const [activeTab, setActiveTab] = useState('sellers');

  const [showAddModal, setShowAddModal] = useState(false);
  const [newSeller, setNewSeller] = useState({ 
      name: "", email: "", password: "", phone: "", gst_number: "",
      address: { address_line_1: "", city: "", state: "", postal_code: "" }
  });
  
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingSeller, setEditingSeller] = useState(null);

  const [loading, setLoading] = useState(false);


  const fetchSellers = () => api.get('/api/admin/sellers').then(res => setSellers(res.data)).catch(() => setSellers([]));
  const fetchRequests = () => api.get('/api/admin/seller-requests').then(res => setRequests(res.data)).catch(() => setRequests([]));
  const fetchWithdrawals = () => api.get('/api/admin/withdrawals').then(res => setWithdrawals(res.data)).catch(() => setWithdrawals([]));

  useEffect(() => {
    fetchSellers();
    fetchRequests();
    fetchWithdrawals();
  }, []);

  const handleApprove = async (sellerId) => {
    if (!window.confirm('Approve this user as a seller?')) return;
    try {
      await api.put(`/api/admin/sellers/${sellerId}/approve`);
      // Update local state
      setSellers(sellers.map(s => s.id === sellerId ? { ...s, is_approved: true, role: 'seller' } : s));
      setRequests(requests.map(r => r.user_id === sellerId ? { ...r, status: 'approved' } : r));
      alert('Seller approved');
    } catch (err) {
      console.error('Approve failed', err);
      alert('Failed to approve');
    }
  }

  const handleReject = async (sellerId) => {
    if (!window.confirm('Reject/Deny this seller? They will not be able to sell.')) return;
    try {
        // Use the status endpoint we added
        await api.put(`/api/admin/sellers/${sellerId}/status`, { is_approved: false });
        setSellers(sellers.map(s => s.id === sellerId ? { ...s, is_approved: false } : s));
        alert('Seller rejected/denied');
    } catch (err) {
        console.error(err);
        alert('Failed to reject');
    }
  }

  const handleDelete = async (sellerId) => {
      if (!window.confirm('Are you sure you want to delete this seller? This cannot be undone.')) return;
      try {
          await api.delete(`/api/admin/users/${sellerId}`);
          setSellers(sellers.filter(s => s.id !== sellerId));
          alert('Seller deleted');
      } catch (err) {
          console.error(err);
          alert('Failed to delete');
      }
  }

  const openEditModal = (seller) => {
      setEditingSeller({ ...seller });
      setShowEditModal(true);
  }

  const handleUpdateSeller = async (e) => {
      e.preventDefault();
      try {
          const res = await api.put(`/api/admin/users/${editingSeller.id}`, {
              name: editingSeller.name,
              email: editingSeller.email
          });
          setSellers(sellers.map(s => s.id === editingSeller.id ? { ...s, ...res.data } : s));
          setShowEditModal(false);
          alert('Seller updated');
      } catch (err) {
          console.error(err);
          alert('Update failed');
      }
  }

  const handleSendPayout = async (withdrawalId) => {
    if (!window.confirm('Send payout for this withdrawal now?')) return;
    try {
      const res = await api.put(`/api/admin/withdrawals/${withdrawalId}/complete`);
      // update state
      setWithdrawals(withdrawals.map(w => w.id === withdrawalId ? { ...w, status: 'completed' } : w));
      alert('Payout recorded');
    } catch (err) {
      console.error('Payout failed', err);
      alert('Failed to send payout');
    }
  }

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    if (name.startsWith('addr_')) {
        const field = name.replace('addr_', '');
        setNewSeller(prev => ({ ...prev, address: { ...prev.address, [field]: value } }));
    } else {
        setNewSeller({ ...newSeller, [name]: value });
    }
  };

  const handleAddSeller = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post("/api/admin/sellers", newSeller);
      alert("Seller added successfully!");
      setNewSeller({ 
          name: "", email: "", password: "", phone: "", gst_number: "",
          address: { address_line_1: "", city: "", state: "", postal_code: "" }
      });
      setShowAddModal(false);
      fetchSellers(); // Refresh the list
    } catch (error) {
      console.error("Failed to add seller:", error);
      alert(error.response?.data?.error || "Failed to add seller.");
    } finally {
      setLoading(false);
    }
  };


  return (
    <>
      <Helmet>
        <title>Sellers & Requests</title>
      </Helmet>
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold">Sellers Management</h1>
        <button
            onClick={() => setShowAddModal(true)}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
            Add New Seller
        </button>
        <div>
          <div className="bg-white rounded-xl shadow p-4 overflow-x-auto">
              <div className="flex items-center gap-3 mb-4">
                <button onClick={() => setActiveTab('sellers')} className={`px-3 py-1 rounded ${activeTab==='sellers' ? 'bg-slate-900 text-white' : 'bg-gray-100'}`}>Sellers</button>
                <button onClick={() => setActiveTab('requests')} className={`px-3 py-1 rounded ${activeTab==='requests' ? 'bg-slate-900 text-white' : 'bg-gray-100'}`}>Requests</button>
                <button onClick={() => setActiveTab('withdrawals')} className={`px-3 py-1 rounded ${activeTab==='withdrawals' ? 'bg-slate-900 text-white' : 'bg-gray-100'}`}>Withdrawals</button>
              </div>

              {activeTab === 'sellers' && (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left bg-gray-50">
                      <th className="p-3 rounded-l-lg">ID</th>
                      <th className="p-3">Name</th>
                      <th className="p-3">Contact</th>
                      <th className="p-3">GST</th>
                      <th className="p-3">Address</th>
                      <th className="p-3">Status</th>
                      <th className="p-3 rounded-r-lg">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sellers.map((seller) => (
                      <tr key={seller.id} className="border-t hover:bg-gray-50">
                        <td className="p-3">{seller.id}</td>
                        <td className="p-3 font-medium">
                            <div>{seller.name}</div>
                            <div className="text-xs text-gray-500">{seller.email}</div>
                        </td>
                        <td className="p-3">{seller.phone || '-'}</td>
                        <td className="p-3">{seller.gst_number || '-'}</td>
                        <td className="p-3 max-w-xs truncate" title={seller.address ? `${seller.address.address_line_1}, ${seller.address.city}` : ''}>
                            {seller.address ? `${seller.address.city}, ${seller.address.state}` : '-'}
                        </td>
                        <td className="p-3">
                          <span className={`px-2 py-1 rounded-full text-xs ${seller.is_approved ? 'bg-green-100 text-green-800 border border-green-200' : 'bg-red-100 text-red-800 border border-red-200'}`}>
                              {seller.is_approved ? 'Approved' : 'Pending'}
                          </span>
                        </td>
                        <td className="p-3 space-x-2 whitespace-nowrap">
                          {!seller.is_approved ? (
                            <button onClick={() => handleApprove(seller.id)} className="bg-green-600 text-white px-2 py-1 rounded text-xs hover:bg-green-700">Approve</button>
                          ) : (
                            <button onClick={() => handleReject(seller.id)} className="bg-yellow-600 text-white px-2 py-1 rounded text-xs hover:bg-yellow-700">Deny</button>
                          )}
                          <button onClick={() => openEditModal(seller)} className="bg-blue-600 text-white px-2 py-1 rounded text-xs hover:bg-blue-700">Edit</button>
                          <button onClick={() => handleDelete(seller.id)} className="bg-red-600 text-white px-2 py-1 rounded text-xs hover:bg-red-700">Delete</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {activeTab === 'requests' && (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left">
                      <th className="p-2">ID</th>
                      <th className="p-2">User</th>
                      <th className="p-2">Requested At</th>
                      <th className="p-2">Note</th>
                      <th className="p-2">Status</th>
                      <th className="p-2">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {requests.map(r => (
                      <tr key={r.id} className="border-t">
                        <td className="p-2">{r.id}</td>
                        <td className="p-2">{r.user_name || r.user_id}</td>
                        <td className="p-2">{new Date(r.requested_at).toLocaleString()}</td>
                        <td className="p-2">{r.note || '-'}</td>
                        <td className="p-2">{r.status}</td>
                        <td className="p-2">
                          {r.status === 'requested' && (
                            <button onClick={() => handleApprove(r.user_id)} className="bg-green-600 text-white px-3 py-1 rounded">Approve</button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {activeTab === 'withdrawals' && (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left">
                      <th className="p-2">ID</th>
                      <th className="p-2">Seller</th>
                      <th className="p-2">Amount</th>
                      <th className="p-2">Status</th>
                      <th className="p-2">Requested At</th>
                      <th className="p-2">Payments</th>
                      <th className="p-2">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {withdrawals.map(w => (
                      <tr key={w.id} className="border-t">
                        <td className="p-2">{w.id}</td>
                        <td className="p-2">{w.seller_name || w.seller_id}</td>
                        <td className="p-2">₹{Number(w.amount || 0).toFixed(2)}</td>
                        <td className="p-2">{w.status}</td>
                        <td className="p-2">{new Date(w.requested_at).toLocaleString()}</td>
                        <td className="p-2">
                          {w.payments && w.payments.length > 0 ? (
                            w.payments.map(p => <div key={p.id} className="text-xs">{p.method || 'manual'} {p.amount}</div>)
                          ) : ('-')}
                        </td>
                        <td className="p-2">
                          {w.status !== 'completed' && (
                            <button onClick={() => handleSendPayout(w.id)} className="bg-amber-600 text-white px-3 py-1 rounded">Send Now</button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

          </div>
        </div>
      </div>

      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl p-8 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-800">Add New Seller</h2>
                <button onClick={() => setShowAddModal(false)} className="text-gray-400 hover:text-gray-600">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            </div>
            
            <form onSubmit={handleAddSeller} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Basic Info */}
                  <div className="md:col-span-2">
                      <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Account Details</h3>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                    <input
                      type="text"
                      name="name"
                      value={newSeller.name}
                      onChange={handleInputChange}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
                    <input
                      type="email"
                      name="email"
                      value={newSeller.email}
                      onChange={handleInputChange}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                    <input
                      type="password"
                      name="password"
                      value={newSeller.password}
                      onChange={handleInputChange}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
                    <input
                      type="tel"
                      name="phone"
                      value={newSeller.phone}
                      onChange={handleInputChange}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                      placeholder="e.g. 9876543210"
                      required
                    />
                  </div>

                  {/* Business Info */}
                  <div className="md:col-span-2 mt-2">
                      <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Business Details</h3>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">GST Number</label>
                    <input
                      type="text"
                      name="gst_number"
                      value={newSeller.gst_number}
                      onChange={handleInputChange}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                      placeholder="Optional"
                    />
                  </div>
                  
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Address Line 1</label>
                    <input
                      type="text"
                      name="addr_address_line_1"
                      value={newSeller.address.address_line_1}
                      onChange={handleInputChange}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
                    <input
                      type="text"
                      name="addr_city"
                      value={newSeller.address.city}
                      onChange={handleInputChange}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
                    <input
                      type="text"
                      name="addr_state"
                      value={newSeller.address.state}
                      onChange={handleInputChange}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Postal Code</label>
                    <input
                      type="text"
                      name="addr_postal_code"
                      value={newSeller.address.postal_code}
                      onChange={handleInputChange}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                      required
                    />
                  </div>
              </div>

              <div className="flex justify-end gap-3 pt-6 border-t border-gray-100">
                <button
                  type="button"
                  className="px-6 py-2.5 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition-colors"
                  onClick={() => setShowAddModal(false)}
                  disabled={loading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 shadow-lg shadow-blue-600/30 transition-all disabled:opacity-70"
                  disabled={loading}
                >
                  {loading ? "Creating..." : "Create Seller Account"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showEditModal && editingSeller && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-md p-6">
            <h2 className="text-lg font-bold mb-4">Edit Seller</h2>
            <form onSubmit={handleUpdateSeller} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Name</label>
                <input
                  type="text"
                  value={editingSeller.name}
                  onChange={e => setEditingSeller({...editingSeller, name: e.target.value})}
                  className="mt-1 block w-full border rounded px-3 py-2"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Email</label>
                <input
                  type="email"
                  value={editingSeller.email}
                  onChange={e => setEditingSeller({...editingSeller, email: e.target.value})}
                  className="mt-1 block w-full border rounded px-3 py-2"
                  required
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  className="px-4 py-2 border rounded text-gray-600"
                  onClick={() => setShowEditModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
