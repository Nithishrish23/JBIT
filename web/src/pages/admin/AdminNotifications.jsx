import React, { useState, useEffect } from 'react';
import { Helmet } from "react-helmet";
import api from '../../api/client';

export default function AdminNotifications() {
  const [target, setTarget] = useState('all_users'); // all_users, all_sellers, specific
  const [selectedUser, setSelectedUser] = useState(''); // For specific user ID or Search
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  
  // User Search State
  const [users, setUsers] = useState([]);
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);

  useEffect(() => {
    // Fetch simplified user list for search
    api.get('/api/admin/users').then(res => {
        setUsers(res.data);
    }).catch(console.error);
  }, []);

  const handleSearchUser = (e) => {
      const term = e.target.value;
      setSelectedUser(term);
      if(term.length > 1) {
          const matches = users.filter(u => 
              u.name.toLowerCase().includes(term.toLowerCase()) || 
              u.email.toLowerCase().includes(term.toLowerCase())
          );
          setFilteredUsers(matches);
          setShowDropdown(true);
      } else {
          setShowDropdown(false);
      }
  };

  const selectUser = (u) => {
      setSelectedUser(`${u.id} - ${u.name} (${u.email})`);
      setShowDropdown(false);
  };

  const handleSend = () => {
    if (!subject || !message) {
        alert("Subject and Message are required");
        return;
    }
    
    let userId = null;
    if (target === 'specific') {
        // Extract ID from string "123 - Name..."
        const match = selectedUser.match(/^(\d+) -/);
        if (match) {
            userId = parseInt(match[1]);
        } else {
            // If they just typed an ID
             if(!isNaN(selectedUser)) userId = parseInt(selectedUser);
             else {
                 alert("Invalid user selection. Please search and select a user.");
                 return;
             }
        }
    }

    if (target === 'specific' && !userId) {
        alert("Please select a valid user");
        return;
    }

    setLoading(true);
    api.post('/api/admin/notifications/send', {
        target,
        user_id: userId,
        subject,
        message
    }).then(res => {
        alert(res.data.message);
        setSubject('');
        setMessage('');
        setSelectedUser('');
    }).catch(err => {
        alert(err.response?.data?.error || "Failed to send notification");
    }).finally(() => setLoading(false));
  };

  return (
    <>
      <Helmet>
        <title>Send Notifications</title>
      </Helmet>
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex flex-col gap-1">
            <h1 className="text-slate-900 text-2xl font-bold">Broadcast Notifications</h1>
            <p className="text-slate-500 text-sm">Send emails and push notifications to your users.</p>
        </div>

        <div className="bg-white p-6 rounded-xl shadow border border-slate-200 space-y-6">
            
            {/* Target Selection */}
            <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Recipient Target</label>
                <div className="flex flex-wrap gap-4">
                    <label className="flex items-center gap-2 p-3 border rounded-lg cursor-pointer hover:bg-slate-50 transition-colors w-full sm:w-auto">
                        <input 
                            type="radio" 
                            name="target" 
                            checked={target === 'all_users'} 
                            onChange={() => setTarget('all_users')} 
                            className="accent-slate-900 w-4 h-4"
                        />
                        <div className="flex flex-col">
                            <span className="font-medium text-slate-800">All Users</span>
                            <span className="text-xs text-slate-500">Everyone on platform</span>
                        </div>
                    </label>
                    
                    <label className="flex items-center gap-2 p-3 border rounded-lg cursor-pointer hover:bg-slate-50 transition-colors w-full sm:w-auto">
                        <input 
                            type="radio" 
                            name="target" 
                            checked={target === 'all_sellers'} 
                            onChange={() => setTarget('all_sellers')} 
                            className="accent-slate-900 w-4 h-4"
                        />
                        <div className="flex flex-col">
                            <span className="font-medium text-slate-800">All Sellers</span>
                            <span className="text-xs text-slate-500">Only active sellers</span>
                        </div>
                    </label>

                    <label className="flex items-center gap-2 p-3 border rounded-lg cursor-pointer hover:bg-slate-50 transition-colors w-full sm:w-auto">
                        <input 
                            type="radio" 
                            name="target" 
                            checked={target === 'specific'} 
                            onChange={() => setTarget('specific')} 
                            className="accent-slate-900 w-4 h-4"
                        />
                        <div className="flex flex-col">
                            <span className="font-medium text-slate-800">Specific User</span>
                            <span className="text-xs text-slate-500">Search by name/email</span>
                        </div>
                    </label>
                </div>
            </div>

            {/* User Search (Conditional) */}
            {target === 'specific' && (
                <div className="relative animate-fadeIn">
                    <label className="block text-sm font-medium text-slate-700 mb-1">Search User</label>
                    <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 material-symbols-outlined text-[20px]">search</span>
                        <input 
                            type="text" 
                            className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                            placeholder="Type name or email..."
                            value={selectedUser}
                            onChange={handleSearchUser}
                            onFocus={() => selectedUser.length > 1 && setShowDropdown(true)}
                        />
                    </div>
                    {showDropdown && filteredUsers.length > 0 && (
                        <div className="absolute z-10 w-full bg-white border shadow-lg rounded-lg mt-1 max-h-60 overflow-y-auto">
                            {filteredUsers.map(u => (
                                <div 
                                    key={u.id} 
                                    onClick={() => selectUser(u)}
                                    className="p-3 hover:bg-slate-50 cursor-pointer border-b last:border-0 flex justify-between items-center"
                                >
                                    <div>
                                        <div className="font-medium text-slate-800">{u.name}</div>
                                        <div className="text-xs text-slate-500">{u.email}</div>
                                    </div>
                                    <span className={`text-[10px] uppercase px-2 py-0.5 rounded ${u.role === 'seller' ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-600'}`}>
                                        {u.role}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Content */}
            <div className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Subject</label>
                    <input 
                        type="text" 
                        className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                        placeholder="Notification Title"
                        value={subject}
                        onChange={e => setSubject(e.target.value)}
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Message</label>
                    <textarea 
                        className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 min-h-[150px]"
                        placeholder="Enter your message here (supports HTML for email)..."
                        value={message}
                        onChange={e => setMessage(e.target.value)}
                    />
                    <p className="text-xs text-slate-400 mt-1 text-right">Will be sent as Email & Push Notification</p>
                </div>
            </div>

            <button 
                onClick={handleSend} 
                disabled={loading}
                className="w-full py-3 bg-slate-900 text-white font-medium rounded-lg hover:bg-slate-800 disabled:opacity-70 transition-all flex items-center justify-center gap-2"
            >
                {loading ? (
                    <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                ) : (
                    <>
                        <span className="material-symbols-outlined text-[20px]">send</span> Send Notification
                    </>
                )}
            </button>

        </div>
      </div>
    </>
  );
}
