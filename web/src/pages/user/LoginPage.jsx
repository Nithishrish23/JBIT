
import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import api from "../../api/client";
import SeoHelmet from '../../components/SeoHelmet'; // Import SeoHelmet

export default function LoginPage() {
  const [email, setEmail] = useState("user@example.com");
  const [password, setPassword] = useState("user123");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    try {
      const res = await api.post("/api/auth/login", { email, password });
      const user = res.data.user;

      if (user.role !== "user") {
          setError(`Access Denied. This login is for Shoppers. Please use the ${user.role === 'admin' ? 'Admin' : 'Seller'} Login.`);
          return;
      }

      // Support both possible token keys, prefer snake_case `access_token`
      const token = res.data.access_token || res.data.accessToken || res.data.token;
      if (token) localStorage.setItem("access_token", token);
      localStorage.setItem("user", JSON.stringify(user));
      
      // Notify app of auth change
      window.dispatchEvent(new Event("auth-change"));

      navigate("/");
    } catch (err) {
      setError("Invalid credentials");
    }
  };

  return (
    <>
      <SeoHelmet
        title="Login"
        description="Login to your JB Solutions account to access your orders, wishlist, and exclusive offers."
      />
      <div className="flex justify-center mt-10 px-4">
        <div className="w-full max-w-sm space-y-6">
            <form
            onSubmit={submit}
            className="bg-white rounded-xl shadow p-6 space-y-4 text-sm border border-gray-100"
            >
            <h1 className="text-xl font-bold text-textprimary mb-2">Shopper Login</h1>
            {error && <div className="bg-red-50 text-red-600 p-3 rounded text-xs">{error}</div>}
            
            <div>
                <label className="block mb-1.5 text-xs font-medium text-textsecondary">Email</label>
                <input
                className="border border-gray-300 rounded-lg w-full px-3 py-2 focus:ring-2 focus:ring-green-600 focus:border-transparent outline-none transition-all text-textprimary"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                type="email"
                required
                />
            </div>
            <div>
                <label className="block mb-1.5 text-xs font-medium text-textsecondary">Password</label>
                <input
                className="border border-gray-300 rounded-lg w-full px-3 py-2 focus:ring-2 focus:ring-green-600 focus:border-transparent outline-none transition-all text-textprimary"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type="password"
                required
                />
            </div>
            <button
                type="submit"
                className="w-full bg-slate-900 text-white rounded-lg py-2.5 text-sm font-semibold hover:bg-slate-800 transition-colors"
            >
                Login
            </button>
            </form>

            <div className="text-center space-y-2">
                <p className="text-xs text-gray-500">Don't have an account? <Link to="/register" className="text-green-700 hover:underline">Sign up</Link></p>
                <div className="pt-4 border-t border-gray-200">
                    <p className="text-xs text-gray-400 mb-2">Partner Logins</p>
                    <div className="flex justify-center gap-4 text-xs font-medium">
                        <Link to="/seller/login" className="text-blue-600 hover:text-blue-800">Seller Login</Link>
                        <span className="text-gray-300">|</span>
                        <Link to="/admin/login" className="text-purple-600 hover:text-purple-800">Admin Login</Link>
                    </div>
                </div>
            </div>
        </div>
      </div>
    </>
  );
}
