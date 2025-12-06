import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet";
import api from "../../api/client";

export default function AdminLogin() {
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

      if (user.role !== "admin") {
        setError("Unauthorized. This login is for Administrators only.");
        return;
      }

      if (res.data.require_onboarding) {
          localStorage.setItem("temp_token", res.data.temp_token);
          localStorage.setItem("user", JSON.stringify(user));
          navigate("/admin/onboarding");
          return;
      }

      const token = res.data.access_token || res.data.accessToken;
      if (token) localStorage.setItem("access_token", token);
      localStorage.setItem("user", JSON.stringify(user));

      window.dispatchEvent(new Event("auth-change"));
      navigate("/admin/dashboard");
    } catch (err) {
      setError("Invalid credentials");
    }
  };

  return (
    <>
      <Helmet>
        <title>Admin Login</title>
      </Helmet>
      <div className="flex items-center justify-center min-h-[60vh]">
        <form onSubmit={submit} className="bg-cardbg rounded-xl shadow-lg p-8 w-full max-w-sm space-y-6 border border-black/10">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-textprimary">Admin Login</h1>
            <p className="text-textsecondary text-sm mt-1">Restricted Access</p>
          </div>

          {error && <div className="bg-red-50 text-red-600 text-sm p-3 rounded">{error}</div>}

          <div className="space-y-4">
            <div>
              <label className="block mb-1 text-sm font-medium text-textsecondary">Email</label>
              <input
                className="border border-black/20 bg-transparent text-textprimary rounded-lg w-full px-3 py-2 focus:ring-2 focus:ring-primary focus:outline-none placeholder-textmuted"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                type="email"
                required
              />
            </div>
            <div>
              <label className="block mb-1 text-sm font-medium text-textsecondary">Password</label>
              <input
                className="border border-black/20 bg-transparent text-textprimary rounded-lg w-full px-3 py-2 focus:ring-2 focus:ring-primary focus:outline-none placeholder-textmuted"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type="password"
                required
              />
            </div>
          </div>

          <button type="submit" className="w-full bg-blue-600 text-white rounded-lg py-2.5 text-sm font-bold hover:bg-primary/90 transition-colors">
            Login to Dashboard
          </button>
        </form>
      </div>
    </>
  );
}
