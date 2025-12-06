import React, { useState, useEffect } from "react";
import { Helmet } from "react-helmet";
import api from "../../api/client";

export default function AdminWithdrawals() {
  const [withdrawals, setWithdrawals] = useState([]);
  const [processing, setProcessing] = useState({});
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectId, setRejectId] = useState(null);
  const [rejectReason, setRejectReason] = useState('');

  const fetchWithdrawals = () => {
    api.get("/api/admin/withdrawals").then((res) => {
      setWithdrawals(res.data);
    });
  };

  useEffect(() => {
    fetchWithdrawals();
  }, []);

  const handleApprove = (withdrawalId) => {
    if (!window.confirm('Confirm payout approval? This will trigger a Razorpay Payout.')) return;
    setProcessing(prev => ({ ...prev, [withdrawalId]: true }));
    
    api.put(`/api/admin/withdrawals/${withdrawalId}/approve`)
      .then((res) => {
        setWithdrawals(prev => prev.map(w => w.id === withdrawalId ? { ...w, status: 'approved', payout_id: res.data.payout_id } : w));
        alert(`Approved. Payout ID: ${res.data.payout_id || 'N/A'}`);
      })
      .catch(err => {
        console.error('Approve failed', err);
        alert(`Failed to approve: ${err.response?.data?.error || 'Unknown error'}`);
      })
      .finally(() => {
        setProcessing(prev => ({ ...prev, [withdrawalId]: false }));
      });
  };

  const openRejectModal = (id) => {
      setRejectId(id);
      setRejectReason('');
      setShowRejectModal(true);
  };

  const handleReject = () => {
      if (!rejectReason) {
          alert("Please provide a reason");
          return;
      }
      setProcessing(prev => ({ ...prev, [rejectId]: true }));
      api.put(`/api/admin/withdrawals/${rejectId}/reject`, { reason: rejectReason })
      .then(() => {
          setWithdrawals(prev => prev.map(w => w.id === rejectId ? { ...w, status: 'rejected' } : w));
          setShowRejectModal(false);
      })
      .catch(err => {
        console.error('Reject failed', err);
        alert('Failed to reject');
      })
      .finally(() => {
        setProcessing(prev => ({ ...prev, [rejectId]: false }));
      });
  };

  return (
    <>
      <Helmet>
        <title>Withdrawal Management</title>
      </Helmet>
      <div className="space-y-6 relative">
        <h1 className="text-2xl font-semibold text-slate-800">Withdrawal Management</h1>
        
        <div className="bg-white rounded-xl shadow overflow-hidden border border-slate-200">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="p-4 font-medium">ID</th>
                  <th className="p-4 font-medium">Seller</th>
                  <th className="p-4 font-medium">Amount</th>
                  <th className="p-4 font-medium">Status</th>
                  <th className="p-4 font-medium">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {withdrawals.map((w) => (
                  <tr key={w.id} className="hover:bg-slate-50 transition-colors">
                    <td className="p-4 text-slate-500">#{w.id}</td>
                    <td className="p-4 font-medium text-slate-700">{w.seller_name}</td>
                    <td className="p-4 font-bold text-slate-800">₹{w.amount.toFixed(2)}</td>
                    <td className="p-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-bold border ${
                        w.status === 'completed' || w.status === 'approved' ? 'bg-green-100 text-green-800 border-green-200' :
                        w.status === 'rejected' ? 'bg-red-100 text-red-800 border-red-200' :
                        'bg-amber-100 text-amber-800 border-amber-200'
                      }`}>
                        {w.status.toUpperCase()}
                      </span>
                    </td>
                    <td className="p-4">
                      {w.status === 'requested' || w.status === 'pending' ? (
                        <div className="flex gap-2">
                            <button 
                                disabled={processing[w.id]} 
                                onClick={() => handleApprove(w.id)} 
                                className="bg-green-600 text-white px-3 py-1.5 rounded hover:bg-green-700 disabled:bg-green-300 text-xs font-medium transition-colors shadow-sm"
                            >
                              {processing[w.id] ? 'Processing...' : 'Approve & Pay'}
                            </button>
                            <button 
                                disabled={processing[w.id]} 
                                onClick={() => openRejectModal(w.id)} 
                                className="bg-red-50 text-red-600 border border-red-200 px-3 py-1.5 rounded hover:bg-red-100 disabled:opacity-50 text-xs font-medium transition-colors"
                            >
                              Reject
                            </button>
                        </div>
                      ) : (
                        <span className="text-slate-400 text-xs">-</span>
                      )}
                    </td>
                  </tr>
                ))}
                {withdrawals.length === 0 && (
                    <tr>
                        <td colSpan="6" className="p-8 text-center text-slate-400">No withdrawal requests found.</td>
                    </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Reject Modal */}
        {showRejectModal && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                <div className="bg-white rounded-lg p-6 w-96 shadow-xl">
                    <h3 className="text-lg font-semibold mb-4">Reject Withdrawal</h3>
                    <textarea 
                        className="w-full border rounded p-2 mb-4 text-sm h-24" 
                        placeholder="Reason for rejection..."
                        value={rejectReason}
                        onChange={e => setRejectReason(e.target.value)}
                    />
                    <div className="flex justify-end gap-2">
                        <button onClick={() => setShowRejectModal(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded text-sm">Cancel</button>
                        <button onClick={handleReject} className="px-4 py-2 bg-red-600 text-white rounded text-sm hover:bg-red-700">Confirm Reject</button>
                    </div>
                </div>
            </div>
        )}
      </div>
    </>
  );
}