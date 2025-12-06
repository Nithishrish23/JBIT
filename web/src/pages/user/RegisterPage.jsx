import { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../api/client";
import SeoHelmet from '../../components/SeoHelmet'; // Import SeoHelmet

export default function RegisterPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("user");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    try {
      // Always register as a buyer; seller access must be requested from the dashboard
      const res = await api.post("/api/auth/register", { name, email, password, phone, role: 'user' });
      // backend may return access_token; if not, just redirect to login
      const token = res.data.access_token || res.data.accessToken || res.data.token;
      if (token) localStorage.setItem("access_token", token);
      if (res.data.user) localStorage.setItem("user", JSON.stringify(res.data.user));

      const user = res.data.user;
      if (user?.role === "admin") navigate("/admin/dashboard");
      else if (user?.role === "seller") navigate("/seller/dashboard");
      else navigate("/");
    } catch (err) {
      setError(err?.response?.data?.message || err?.response?.data?.description || "Registration failed");
    }
  };

  return (
    <>
      <SeoHelmet
        title="Register"
        description="Create a new account on JB Solutions to start shopping."
      />

      <div className="flex justify-center mt-10">
        <form
          onSubmit={submit}
          className="bg-white rounded-xl shadow p-5 w-full max-w-md space-y-3 text-sm"
        >
          <h1 className="text-lg font-semibold mb-2">Create an account</h1>
          {error && <div className="text-red-600 text-xs">{error}</div>}

          <div>
            <label className="block mb-1 text-xs">Full name</label>
            <input
              className="border rounded w-full px-2 py-1"
              value={name}
              onChange={(e) => setName(e.target.value)}
              type="text"
              required
            />
          </div>

          <div>
            <label className="block mb-1 text-xs">Email</label>
            <input
              className="border rounded w-full px-2 py-1"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              required
            />
          </div>

          <div>
            <label className="block mb-1 text-xs">Phone Number</label>
            <input
              className="border rounded w-full px-2 py-1"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              type="tel"
              placeholder="e.g. 9876543210"
              required
            />
          </div>

          <div>
            <label className="block mb-1 text-xs">Password</label>
            <input
              className="border rounded w-full px-2 py-1"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              required
            />
          </div>

          <div>
            <label className="block mb-1 text-xs">Register as</label>
            <div className="text-sm text-gray-600">Buyer account (to sell, request seller access from your dashboard)</div>
          </div>

          <button
            type="submit"
            className="w-full bg-slate-900 text-white rounded py-2 text-sm"
          >
            Create account
          </button>
        </form>
      </div>
    </>
  );
}
