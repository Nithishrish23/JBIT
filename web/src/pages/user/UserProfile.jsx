
import React, { useState, useEffect, useRef } from "react";
import { Helmet } from "react-helmet";
import api, { upload, baseURL } from "../../api/client";
import { Link } from "react-router-dom";
import { getImageUrl } from "../../utils/image";

export default function UserProfile() {
  const [user, setUser] = useState(null);
  const [recentOrders, setRecentOrders] = useState([]);
  const [isEditing, setIsEditing] = useState(false);
  
  // Form State
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [profilePhotoFile, setProfilePhotoFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);

  // Password Change State
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const fileInputRef = useRef(null);

  useEffect(() => {
    const currentUser = JSON.parse(localStorage.getItem("user"));
    if (currentUser) {
      setUser(currentUser);
      setName(currentUser.name || "");
      setPhone(currentUser.phone || "");
      // If user has a profile photo, it comes as a full URL string from backend 'to_dict'
      setPreviewUrl(getImageUrl(currentUser.profile_photo));
    }
    
    // Fetch recent orders
    api.get("/api/user/orders?limit=5").then((res) => {
        setRecentOrders(res.data);
    }).catch(err => console.error(err));
  }, []);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setProfilePhotoFile(file);
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  const handleSaveProfile = async () => {
    try {
      let profile_photo_id = undefined;

      // 1. Upload photo if selected
      if (profilePhotoFile) {
        const formData = new FormData();
        formData.append("file", profilePhotoFile);
        const uploadRes = await upload("/api/upload", formData);
        profile_photo_id = uploadRes.data.id;
      }

      // 2. Update profile
      const payload = { name, phone };
      if (profile_photo_id) {
        payload.profile_photo_id = profile_photo_id;
      }

      const res = await api.put('/api/user/profile', payload);
      
      // 3. Update local state & storage
      localStorage.setItem("user", JSON.stringify(res.data.user));
      setUser(res.data.user);
      setIsEditing(false);
      setProfilePhotoFile(null); // Reset file input
      
      // Update preview to the confirmed URL from backend to be safe (or keep current preview)
      if (res.data.user.profile_photo) {
          setPreviewUrl(getImageUrl(res.data.user.profile_photo));
      }

      // Notify other components
      window.dispatchEvent(new Event("auth-change"));
      alert("Profile updated!");

    } catch (err) {
      console.error(err);
      alert("Failed to update profile");
    }
  };

  const handleChangePassword = async (e) => {
      e.preventDefault();
      if (newPassword !== confirmPassword) {
          alert("New passwords do not match");
          return;
      }
      if (newPassword.length < 6) {
          alert("Password must be at least 6 characters");
          return;
      }

      try {
          await api.put('/api/user/password', { current_password: currentPassword, new_password: newPassword });
          alert("Password changed successfully");
          setShowPasswordModal(false);
          setCurrentPassword("");
          setNewPassword("");
          setConfirmPassword("");
      } catch (err) {
          console.error(err);
          alert(err.response?.data?.description || "Failed to change password");
      }
  }

  if (!user) return <div>Loading...</div>;

  // Default placeholder image
  const defaultPhoto = "https://lh3.googleusercontent.com/aida-public/AB6AXuBXV3941cBDFJW1fpcAcAz-965DzvTE34zZhF4djVYQj-mqjbbNcAgFX1GQTHNNNiRlFwtVz0JnkNq_r8ls5_MU8N9NKRRJuwS7GzoxotJ-fyQlRqCNY1RSEDXCkb1AAHi7M3Uh-zeKr6CnVbbwyGa4AwJEcpTSNFpfShn94Ck-wwVQupRAotcLCY6U3hvThwyjZgpAh_p-FwgRW2jrzUC5Kme6-fWlvDsd5HzBO__ahLuWR6ySwkWoRxFa3EBlHX9NOJd6zC0FPcuw";

  return (
    <>
      <Helmet>
        <title>Your Profile</title>
      </Helmet>
      <div className="flex flex-col gap-8 font-display text-[#3C3633]">
        <div>
            <h1 className="text-3xl font-black tracking-tight">My Profile</h1>
            <p className="text-[#7C736D] text-base mt-1">View and edit your personal details and manage your account.</p>
        </div>

        {/* Profile Details Card */}
        <div className="flex flex-col sm:flex-row items-stretch justify-between gap-6 rounded-lg bg-[#F9F5E9] border border-[#EADDCA] p-6 shadow-sm">
            <div className="flex flex-1 flex-col gap-4">
                <div className="flex flex-col">
                    <p className="text-sm text-[#E59500] uppercase font-bold tracking-wider">Full Name</p>
                    {isEditing ? (
                        <input className="border rounded px-2 py-1 mt-1" value={name} onChange={e => setName(e.target.value)} />
                    ) : (
                        <p className="text-lg font-medium">{user.name}</p>
                    )}
                </div>
                <div className="flex flex-col">
                    <p className="text-sm text-[#E59500] uppercase font-bold tracking-wider">Email Address</p>
                    <p className="text-lg font-medium">{user.email}</p>
                </div>
                <div className="flex flex-col">
                    <p className="text-sm text-[#E59500] uppercase font-bold tracking-wider">Phone Number</p>
                    {isEditing ? (
                        <input className="border rounded px-2 py-1 mt-1" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+91 98765 43210" />
                    ) : (
                        <p className="text-lg font-medium">{user.phone || <span className="text-gray-400 italic">Not set</span>}</p>
                    )}
                </div>
            </div>
            <div className="flex flex-col gap-4 items-center sm:items-end justify-between">
                <div className="relative group">
                    <div 
                        className="w-32 h-32 bg-center bg-no-repeat bg-cover rounded-full border-4 border-white shadow-sm" 
                        style={{backgroundImage: `url("${previewUrl || defaultPhoto}")`}}
                    ></div>
                    
                    {isEditing && (
                        <div 
                            className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => fileInputRef.current?.click()}
                        >
                            <span className="text-white text-xs font-bold uppercase">Change</span>
                        </div>
                    )}
                    <input 
                        type="file" 
                        ref={fileInputRef} 
                        className="hidden" 
                        accept="image/*" 
                        onChange={handleFileChange}
                    />
                </div>

                {isEditing ? (
                    <div className="flex gap-2">
                        <button onClick={() => { setIsEditing(false); setProfilePhotoFile(null); setPreviewUrl(user.profile_photo ? getImageUrl(user.profile_photo) : null); }} className="rounded-lg h-10 px-4 border border-[#8C6A5D] text-[#8C6A5D] text-sm font-bold">Cancel</button>
                        <button onClick={handleSaveProfile} className="rounded-lg h-10 px-4 bg-[#8C6A5D] text-white text-sm font-bold hover:bg-[#8C6A5D]/80">Save</button>
                    </div>
                ) : (
                    <button onClick={() => setIsEditing(true)} className="flex w-full sm:w-auto items-center justify-center rounded-lg h-10 px-5 bg-[#8C6A5D] text-white text-sm font-bold hover:bg-[#8C6A5D]/80">
                        <span className="truncate">Edit Profile</span>
                    </button>
                )}
            </div>
        </div>

        {/* Login Details Card */}
        <h2 className="text-2xl font-bold tracking-tight pt-4">Login Details</h2>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 rounded-lg bg-white border border-[#E4E0D5] p-6 shadow-sm">
            <div className="flex flex-col">
                <p className="text-base font-medium">Password</p>
                <p className="text-[#7C736D] text-sm">Last changed on 12th Aug 2023 <span className="text-xs text-gray-400">(Placeholder)</span></p>
            </div>
            <button onClick={() => setShowPasswordModal(true)} className="flex min-w-[84px] items-center justify-center rounded-lg h-10 px-5 border border-[#E4E0D5] text-[#3C3633] text-sm font-bold hover:bg-[#8C6A5D]/10 hover:text-[#8C6A5D] hover:border-[#8C6A5D]/20">
                <span>Change Password</span>
            </button>
        </div>

        {/* Addresses Section */}
        <h2 className="text-2xl font-bold tracking-tight pt-4">Saved Addresses</h2>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 rounded-lg bg-white border border-[#E4E0D5] p-6 shadow-sm">
            <div className="flex flex-col">
                <p className="text-base font-medium">Delivery Addresses</p>
                <p className="text-[#7C736D] text-sm">Manage your saved addresses for faster checkout.</p>
            </div>
            <Link to="/addresses" className="flex min-w-[84px] items-center justify-center rounded-lg h-10 px-5 bg-[#8C6A5D] text-white text-sm font-bold hover:bg-[#8C6A5D]/90">
                <span>Manage Addresses</span>
            </Link>
        </div>

        {/* Recent Orders */}
        <div>
            <h2 className="text-2xl font-bold tracking-tight pt-4 mb-4">Recent Orders</h2>
            <div className="rounded-lg bg-[#EAF2EA] border border-[#D5E1D6] shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-[#5E8C61]/10 text-[#5E8C61] uppercase tracking-wider text-xs">
                            <tr>
                                <th className="px-6 py-3">Order ID</th>
                                <th className="px-6 py-3">Date</th>
                                <th className="px-6 py-3">Status</th>
                                <th className="px-6 py-3 text-right">Total</th>
                                <th className="px-6 py-3 text-center">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {recentOrders.map((order) => (
                                <tr key={order.id} className="border-b border-[#D5E1D6]">
                                    <td className="px-6 py-4 font-medium">#{order.id}</td>
                                    <td className="px-6 py-4 text-[#7C736D]">{new Date(order.created_at).toLocaleDateString()}</td>
                                    <td className="px-6 py-4">
                                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium 
                                            ${order.status === 'delivered' ? 'bg-green-200 text-green-800' : 
                                              order.status === 'pending' ? 'bg-yellow-200 text-yellow-800' : 'bg-gray-200 text-gray-800'}`}>
                                            {order.status}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-right font-medium">₹{Number(order.total).toFixed(2)}</td>
                                    <td className="px-6 py-4 text-center">
                                        <Link to={`/orders`} className="font-medium text-[#5E8C61] hover:underline">View Details</Link>
                                    </td>
                                </tr>
                            ))}
                            {recentOrders.length === 0 && (
                                <tr>
                                    <td colSpan="5" className="px-6 py-4 text-center text-gray-500">No recent orders.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>

        {/* Password Modal */}
        {showPasswordModal && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                <div className="bg-white rounded-xl shadow-lg w-full max-w-md p-6 relative">
                    <h2 className="text-xl font-bold mb-4">Change Password</h2>
                    <form onSubmit={handleChangePassword} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium mb-1">Current Password</label>
                            <input 
                                type="password"
                                value={currentPassword} 
                                onChange={e => setCurrentPassword(e.target.value)} 
                                className="w-full border rounded px-3 py-2 text-sm" 
                                required 
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1">New Password</label>
                            <input 
                                type="password"
                                value={newPassword} 
                                onChange={e => setNewPassword(e.target.value)} 
                                className="w-full border rounded px-3 py-2 text-sm" 
                                required 
                                minLength={6}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1">Confirm New Password</label>
                            <input 
                                type="password"
                                value={confirmPassword} 
                                onChange={e => setConfirmPassword(e.target.value)} 
                                className="w-full border rounded px-3 py-2 text-sm" 
                                required 
                            />
                        </div>
                        <div className="flex justify-end gap-2 pt-2">
                            <button 
                                type="button"
                                onClick={() => setShowPasswordModal(false)} 
                                className="px-4 py-2 border rounded text-gray-600 hover:bg-gray-50"
                            >
                                Cancel
                            </button>
                            <button 
                                type="submit" 
                                className="px-4 py-2 bg-[#8C6A5D] text-white rounded hover:bg-[#8C6A5D]/90"
                            >
                                Change Password
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        )}
      </div>
    </>
  );
}
