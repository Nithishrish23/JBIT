import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet";
import api from "../../api/client";

export default function SellerLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    try {
      const res = await api.post("/api/auth/login", { email, password });
      const user = res.data.user;
      
      if (user.role !== "seller") {
          setError("Unauthorized. This login is for Sellers only.");
          return;
      }

      const token = res.data.access_token || res.data.accessToken;
      if (token) localStorage.setItem("access_token", token);
      localStorage.setItem("user", JSON.stringify(user));
      
      window.dispatchEvent(new Event("auth-change"));
      navigate("/seller/dashboard");
    } catch (err) {
      setError("Invalid credentials");
    }
  };

  return (
    <>
      <Helmet>
        <title>Seller Login</title>
      </Helmet>
      <div className="flex items-center justify-center min-h-[60vh]">
        <form onSubmit={submit} className="bg-white rounded-xl shadow-lg p-8 w-full max-w-sm space-y-6 border border-gray-200">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-textprimary">Seller Login</h1>
            <p className="text-textsecondary text-sm mt-1">Manage your store</p>
          </div>
          
          {error && <div className="bg-red-50 text-red-600 text-sm p-3 rounded">{error}</div>}
          
          <div className="space-y-4">
            <div>
                <label className="block mb-1 text-sm font-medium text-textsecondary">Email</label>
                <input
                className="border border-gray-300 rounded-lg w-full px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none text-textprimary"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                type="email"
                required
                />
            </div>
            <div>
                <label className="block mb-1 text-sm font-medium text-textsecondary">Password</label>
                <input
                className="border border-gray-300 rounded-lg w-full px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none text-textprimary"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type="password"
                required
                />
            </div>
          </div>

          <button type="submit" className="w-full bg-blue-600 text-white rounded-lg py-2.5 text-sm font-bold hover:bg-blue-700 transition-colors">
            Login to Seller Portal
          </button>
        </form>
      </div>
    </>
  );
}
