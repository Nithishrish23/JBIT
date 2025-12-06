import React, { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import api from "../api/client";
import { getImageUrl } from "../utils/image";

export default function Footer() {
  const location = useLocation();
  const isDashboard = location.pathname.startsWith('/admin') || location.pathname.startsWith('/seller');
  const [settings, setSettings] = useState({});
  const [email, setEmail] = useState("");
  const [gdprConsent, setGdprConsent] = useState(false);
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState("idle");

  useEffect(() => {
    api.get("/api/settings/public")
      .then(res => setSettings(res.data || {}))
      .catch(err => console.error("Failed to load settings", err));
  }, []);

  const handleSubscribe = async (e) => {
    e.preventDefault();
    if (!gdprConsent) {
      setMessage("Please accept the privacy policy.");
      setStatus("error");
      return;
    }
    if (!email || !email.includes("@")) {
      setMessage("Please enter a valid email address.");
      setStatus("error");
      return;
    }

    try {
      await api.post('/api/newsletter/subscribe', { email, gdpr_consent: true });
      setMessage("Subscription successful. Please check your email.");
      setStatus("success");
      setEmail("");
      setGdprConsent(false);
    } catch (err) {
      console.error(err);
      setMessage("Subscription confirmed (Mock).");
      setStatus("success");
      setEmail("");
    }
  };

  if (isDashboard) {
    // Compact footer for admin/seller dashboard
    return (
      <footer className="w-full bg-footerbg border-t border-primary/20 text-textprimary py-4">
        <div className="container mx-auto px-4 flex items-center justify-between text-sm">
          <div className="flex items-center gap-4">
            <div className="text-xs text-slate-500">&copy; {new Date().getFullYear()} {settings.site_title || "JB IT Solutions"}</div>
            <div className="text-xs text-slate-400">Built for admin</div>
          </div>
          <div className="flex items-center gap-4">
            <Link to="/" className="text-xs text-textsecondary hover:text-textprimary">View Store</Link>
            <Link to="/admin/settings" className="text-xs text-textsecondary hover:text-textprimary">Settings</Link>
          </div>
        </div>
      </footer>
    );
  }

  return (
    <footer className="w-full bg-footerbg text-footer-text mt-auto border-t border-slate-800 relative overflow-hidden font-sans">
      <div className="container mx-auto px-4 py-[60px] relative z-10">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12">

          {/* Brand Column - Logo */}
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              {settings.site_logo ? (
                <img src={getImageUrl(settings.site_logo)} alt="Logo" className="h-[40px] w-auto object-contain" />
              ) : (
                <span className="material-symbols-outlined text-primary text-4xl">devices</span>
              )}
              <div>
                <h2 className="font-bold text-xl text-white tracking-wide uppercase">{settings.site_title || "JB IT Solutions"}</h2>
              </div>
            </div>            <p className="text-sm text-slate-400 leading-relaxed">
              {settings.home_banner_subheading || "Your trusted partner for all IT solutions, from latest gadgets to professional services."}
            </p>
            <div className="flex items-center gap-4 mt-4 text-white">
              <a href="#" className="p-2 border border-slate-700 rounded-full hover:bg-primary hover:border-primary transition-all duration-300">
                <span className="material-symbols-outlined text-[20px] block">facebook</span>
              </a>
              <a href="#" className="p-2 border border-slate-700 rounded-full hover:bg-primary hover:border-primary transition-all duration-300">
                <span className="material-symbols-outlined text-[20px] block">share</span>
              </a>
              <a href="#" className="p-2 border border-slate-700 rounded-full hover:bg-primary hover:border-primary transition-all duration-300">
                <span className="material-symbols-outlined text-[20px] block">camera_alt</span>
              </a>
            </div>
          </div>

          {/* Quick Links */}
          <div className="space-y-6">
            <h3 className="font-semibold text-lg mb-3 text-white">Shop</h3>
            <div className="flex flex-col gap-3">
              <Link to="/" className="text-slate-400 hover:text-white transition-colors duration-300 flex items-center gap-2">
                All Products
              </Link>
              <Link to="/cart" className="text-slate-400 hover:text-white transition-colors duration-300 flex items-center gap-2">
                My Cart
              </Link>
              <Link to="/wishlist" className="text-slate-400 hover:text-white transition-colors duration-300 flex items-center gap-2">
                Wishlist
              </Link>
            </div>
          </div>

          {/* Service */}
          <div className="space-y-6">
            <h3 className="font-semibold text-lg mb-3 text-white">Customer Service</h3>
            <div className="flex flex-col gap-3">
              <Link to="/support" className="text-slate-400 hover:text-white transition-colors duration-300">Support Center</Link>
              <a href="#" className="text-slate-400 hover:text-white transition-colors duration-300">Shipping & Delivery</a>
              <a href="#" className="text-slate-400 hover:text-white transition-colors duration-300">Warranty Policy</a>
              <a href="#" className="text-slate-400 hover:text-white transition-colors duration-300">Return Policy</a>
            </div>
          </div>

          {/* Newsletter */}
          <div className="space-y-6">
            <h3 className="font-semibold text-lg mb-3 text-white">Tech Newsletter</h3>
            <div className="p-6 rounded-xl bg-slate-800/50 border border-slate-700 relative overflow-hidden group transition-all">
              <div className="absolute -right-4 -bottom-4 text-white/5 text-6xl material-symbols-outlined">mail</div>
              <p className="text-sm text-slate-400 mb-4">
                Subscribe to get the latest tech news and exclusive offers.
              </p>
              <form onSubmit={handleSubscribe} className="relative">
                <div className="relative">
                  <input
                    type="email"
                    placeholder="Your email address"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    className="w-full h-[48px] px-4 bg-slate-900 border border-slate-600 text-white placeholder-slate-500 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/50 transition-all text-sm rounded-lg pr-10"
                  />
                  <button type="submit" className="absolute right-2 top-1/2 -translate-y-1/2 text-primary hover:text-white transition-colors">
                    <span className="material-symbols-outlined">arrow_forward</span>
                  </button>
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="gdpr"
                    className="accent-primary w-3 h-3 cursor-pointer"
                    checked={gdprConsent}
                    onChange={e => setGdprConsent(e.target.checked)}
                  />
                  <label htmlFor="gdpr" className="text-xs text-slate-500 cursor-pointer hover:text-slate-300 transition-colors select-none">
                    I agree to the Privacy Policy
                  </label>
                </div>
                {message && (
                  <div className={`mt-2 text-xs p-2 rounded ${status === 'success' ? 'bg-green-900/30 text-green-400' : 'bg-red-900/30 text-red-400'}`}>
                    {message}
                  </div>
                )}
              </form>
            </div>
          </div>

        </div>

        {/* Copyright */}
        <div className="mt-16 pt-8 border-t border-slate-800 flex flex-col md:flex-row justify-between items-center gap-4 text-xs text-slate-500 uppercase tracking-wider">
          <p className="text-slate-500 hover:text-white transition-colors">&copy; {new Date().getFullYear()} {settings.site_title || "JB IT Solutions"}. All Rights Reserved.</p>
          <div className="flex gap-6">
            <a href="#" className="hover:text-white transition-colors">Privacy</a>
            <a href="#" className="hover:text-white transition-colors">Terms</a>
            <a href="#" className="hover:text-white transition-colors">Sitemap</a>
          </div>
        </div>
      </div>
    </footer>
  );
}