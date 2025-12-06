import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet";
import api from "../../api/client";

export default function AdminOnboarding() {
  const [formData, setFormData] = useState({
    new_password: "",
    confirm_password: "",
    name: "",
    phone: "",
    address: "",
    shop_name: ""
  });
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData({...formData, [e.target.name]: e.target.value});
  };

  const submit = async (e) => {
    e.preventDefault();
    setError("");

    if (formData.new_password !== formData.confirm_password) {
        setError("Passwords do not match");
        return;
    }

    try {
      const tempToken = localStorage.getItem("temp_token");
      if (!tempToken) {
          setError("Session expired. Please login again.");
          return;
      }

      // Use temp_token for authorization header manually for this request if api client doesn't pick it up automatically
      // Assuming api client picks up 'access_token' from localStorage, we might need to temporarily set it or pass header
      
      const res = await api.post("/api/auth/complete-onboarding", {
          new_password: formData.new_password,
          name: formData.name,
          phone: formData.phone,
          address: formData.address,
          shop_name: formData.shop_name
      }, {
          headers: { Authorization: `Bearer ${tempToken}` }
      });

      // On success, we get a real token
      const token = res.data.access_token;
      if (token) {
          localStorage.setItem("access_token", token);
          localStorage.removeItem("temp_token");
      }
      localStorage.setItem("user", JSON.stringify(res.data.user));
      
      window.dispatchEvent(new Event("auth-change"));
      navigate("/admin/dashboard");

    } catch (err) {
      setError(err.response?.data?.error || "Failed to complete onboarding");
    }
  };

  return (
    <>
      <Helmet>
        <title>Admin Setup</title>
      </Helmet>
      <div className="flex items-center justify-center min-h-[80vh] py-10">
        <form onSubmit={submit} className="bg-cardbg rounded-xl shadow-lg p-8 w-full max-w-md space-y-6 border border-black/10">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-textprimary">Welcome!</h1>
            <p className="text-textsecondary text-sm mt-1">Please complete your profile to continue.</p>
          </div>

          {error && <div className="bg-red-50 text-red-600 text-sm p-3 rounded">{error}</div>}

          <div className="space-y-4">
            <div>
              <label className="block mb-1 text-sm font-medium text-textsecondary">Shop Name</label>
              <input
                name="shop_name"
                className="border border-black/20 bg-transparent text-textprimary rounded-lg w-full px-3 py-2 focus:ring-2 focus:ring-primary focus:outline-none"
                value={formData.shop_name}
                onChange={handleChange}
                type="text"
                required
              />
            </div>
            <div>
              <label className="block mb-1 text-sm font-medium text-textsecondary">Full Name</label>
              <input
                name="name"
                className="border border-black/20 bg-transparent text-textprimary rounded-lg w-full px-3 py-2 focus:ring-2 focus:ring-primary focus:outline-none"
                value={formData.name}
                onChange={handleChange}
                type="text"
                required
              />
            </div>
            <div>
              <label className="block mb-1 text-sm font-medium text-textsecondary">Phone Number</label>
              <input
                name="phone"
                className="border border-black/20 bg-transparent text-textprimary rounded-lg w-full px-3 py-2 focus:ring-2 focus:ring-primary focus:outline-none"
                value={formData.phone}
                onChange={handleChange}
                type="tel"
                required
              />
            </div>
            <div>
              <label className="block mb-1 text-sm font-medium text-textsecondary">Address</label>
              <textarea
                name="address"
                className="border border-black/20 bg-transparent text-textprimary rounded-lg w-full px-3 py-2 focus:ring-2 focus:ring-primary focus:outline-none"
                value={formData.address}
                onChange={handleChange}
                required
                rows="2"
              />
            </div>
            
            <div className="pt-4 border-t border-gray-200">
                <p className="text-xs text-gray-500 mb-2">Set your permanent password</p>
                <div className="space-y-3">
                    <div>
                    <label className="block mb-1 text-sm font-medium text-textsecondary">New Password</label>
                    <input
                        name="new_password"
                        className="border border-black/20 bg-transparent text-textprimary rounded-lg w-full px-3 py-2 focus:ring-2 focus:ring-primary focus:outline-none"
                        value={formData.new_password}
                        onChange={handleChange}
                        type="password"
                        required
                    />
                    </div>
                    <div>
                    <label className="block mb-1 text-sm font-medium text-textsecondary">Confirm Password</label>
                    <input
                        name="confirm_password"
                        className="border border-black/20 bg-transparent text-textprimary rounded-lg w-full px-3 py-2 focus:ring-2 focus:ring-primary focus:outline-none"
                        value={formData.confirm_password}
                        onChange={handleChange}
                        type="password"
                        required
                    />
                    </div>
                </div>
            </div>
          </div>

          <button type="submit" className="w-full bg-green-600 text-white rounded-lg py-2.5 text-sm font-bold hover:bg-green-700 transition-colors">
            Complete Setup
          </button>
        </form>
      </div>
    </>
  );
}
