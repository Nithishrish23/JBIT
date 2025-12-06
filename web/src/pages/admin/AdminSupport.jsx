import React, { useState, useEffect } from 'react';
import { Helmet } from "react-helmet";
import api from '../../api/client';

export default function AdminSupport() {
  const [tickets, setTickets] = useState([]);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    fetchTickets();
  }, []);

  const fetchTickets = () => {
    api.get('/api/admin/support').then(res => setTickets(res.data));
  };

  const handleStatusUpdate = (id, newStatus) => {
      api.put(`/api/admin/support/${id}/status`, { status: newStatus })
        .then(() => fetchTickets())
        .catch(err => alert("Failed to update status"));
  };

  const filteredTickets = tickets.filter(t => filter === 'all' || t.status === filter);

  return (
    <>
      <Helmet>
        <title>Support Tickets</title>
      </Helmet>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
            <h1 className="text-2xl font-semibold text-slate-800">Support Tickets</h1>
            <div className="flex gap-2">
                <button onClick={() => setFilter('all')} className={`px-3 py-1 rounded-lg text-sm ${filter === 'all' ? 'bg-slate-800 text-white' : 'bg-white border'}`}>All</button>
                <button onClick={() => setFilter('open')} className={`px-3 py-1 rounded-lg text-sm ${filter === 'open' ? 'bg-red-100 text-red-800 font-bold' : 'bg-white border'}`}>Open</button>
                <button onClick={() => setFilter('closed')} className={`px-3 py-1 rounded-lg text-sm ${filter === 'closed' ? 'bg-green-100 text-green-800 font-bold' : 'bg-white border'}`}>Closed</button>
            </div>
        </div>

        <div className="bg-white rounded-xl shadow overflow-hidden border border-slate-200">
            <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 text-slate-500 border-b">
                    <tr>
                        <th className="p-4 font-medium">Date</th>
                        <th className="p-4 font-medium">User</th>
                        <th className="p-4 font-medium">Subject</th>
                        <th className="p-4 font-medium">Message</th>
                        <th className="p-4 font-medium">Status</th>
                        <th className="p-4 font-medium">Action</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                    {filteredTickets.map(ticket => (
                        <tr key={ticket.id} className="hover:bg-slate-50">
                            <td className="p-4 text-slate-500 whitespace-nowrap">
                                {new Date(ticket.created_at).toLocaleDateString()}
                            </td>
                            <td className="p-4">
                                <div className="font-medium text-slate-800">{ticket.user_name}</div>
                                <div className="text-xs text-slate-500">{ticket.email}</div>
                            </td>
                            <td className="p-4 font-medium text-slate-700">{ticket.subject}</td>
                            <td className="p-4 text-slate-600 max-w-xs truncate" title={ticket.message}>{ticket.message}</td>
                            <td className="p-4">
                                <span className={`px-2 py-1 rounded-full text-xs font-bold uppercase ${
                                    ticket.status === 'open' ? 'bg-red-100 text-red-700' :
                                    ticket.status === 'closed' ? 'bg-green-100 text-green-700' :
                                    'bg-amber-100 text-amber-700'
                                }`}>
                                    {ticket.status}
                                </span>
                            </td>
                            <td className="p-4">
                                {ticket.status === 'open' ? (
                                    <button 
                                        onClick={() => handleStatusUpdate(ticket.id, 'closed')}
                                        className="text-green-600 hover:underline text-xs font-medium"
                                    >
                                        Mark Closed
                                    </button>
                                ) : (
                                    <button 
                                        onClick={() => handleStatusUpdate(ticket.id, 'open')}
                                        className="text-slate-500 hover:underline text-xs"
                                    >
                                        Reopen
                                    </button>
                                )}
                            </td>
                        </tr>
                    ))}
                    {filteredTickets.length === 0 && (
                        <tr><td colSpan="6" className="p-8 text-center text-slate-400">No tickets found.</td></tr>
                    )}
                </tbody>
            </table>
        </div>
      </div>
    </>
  );
}
