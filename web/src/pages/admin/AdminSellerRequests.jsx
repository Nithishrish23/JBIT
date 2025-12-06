import React, { useState, useEffect } from "react";
import { Helmet } from "react-helmet";
import api from "../../api/client";

export default function AdminSellerRequests(){
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetch = () => {
    setLoading(true);
    api.get('/api/admin/seller-requests').then(res => {
      setRequests(res.data);
      setLoading(false);
    }).catch(err => {
      console.error('Failed to fetch seller requests', err);
      setLoading(false);
    })
  }

  useEffect(() => { fetch(); }, []);

  const approve = (userId) => {
    api.put(`/api/admin/sellers/${userId}/approve`).then(() => {
      setRequests(requests.map(r => r.user_id === userId ? { ...r, status: 'approved' } : r));
    }).catch(err => {
      console.error('Approve failed', err);
      alert('Failed to approve');
    })
  }

  const reject = (reqId) => {
    if(!window.confirm("Are you sure you want to reject this request?")) return;
    api.put(`/api/admin/seller-requests/${reqId}/reject`).then(() => {
      setRequests(requests.map(r => r.id === reqId ? { ...r, status: 'rejected' } : r));
    }).catch(err => {
      console.error('Reject failed', err);
      alert('Failed to reject');
    })
  }

  return (
    <>
      <Helmet><title>Seller Requests</title></Helmet>
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold">Seller Requests</h1>
        <div className="bg-white rounded-xl shadow p-4">
          {loading ? <div>Loading...</div> : (
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
                    <td className="p-2">
                        <span className={`px-2 py-1 rounded-full text-xs ${
                            r.status === 'approved' ? 'bg-green-100 text-green-800' :
                            r.status === 'rejected' ? 'bg-red-100 text-red-800' :
                            'bg-yellow-100 text-yellow-800'
                        }`}>
                            {r.status}
                        </span>
                    </td>
                    <td className="p-2 space-x-2">
                      {r.status === 'requested' && (
                        <>
                            <button onClick={() => approve(r.user_id)} className="bg-green-600 text-white px-3 py-1 rounded text-xs">Approve</button>
                            <button onClick={() => reject(r.id)} className="bg-red-600 text-white px-3 py-1 rounded text-xs">Reject</button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </>
  )
}
