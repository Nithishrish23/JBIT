
import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../api/client";
import { getImageUrl } from "../utils/image";

export default function Header({ isAdmin }) {
    const [user, setUser] = useState(null);
    const [cartCount, setCartCount] = useState(0);
    const [keyword, setKeyword] = useState("");
    const [settings, setSettings] = useState({});
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [notifications, setNotifications] = useState([]);
    const navigate = useNavigate();

    const loadUser = () => {
        const u = localStorage.getItem("user");
        if (u) {
            try {
                const userData = JSON.parse(u);
                setUser(userData);
                if (userData.role === 'admin') {
                    api.get("/api/admin/notifications").then(res => setNotifications(res.data)).catch(() => { });
                }
                api.get("/api/user/cart").then((res) => {
                    setCartCount(res.data.items.reduce((acc, item) => acc + item.quantity, 0));
                }).catch(() => { });
            } catch (e) {
                console.error("Failed to parse user data", e);
                setUser(null);
            }
        } else {
            setUser(null);
            setCartCount(0);
            setNotifications([]);
        }
    };

    useEffect(() => {
        loadUser();

        window.addEventListener("auth-change", loadUser);

        api.get("/api/settings/public").then(res => {
            setSettings(res.data);
        }).catch(err => console.error(err));

        return () => {
            window.removeEventListener("auth-change", loadUser);
        };
    }, []);

    const handleLogout = () => {
        api.post('/api/auth/logout').finally(() => {
            localStorage.removeItem("access_token"); // Ensure consistency with other files using access_token
            localStorage.removeItem("user");
            window.dispatchEvent(new Event("auth-change")); // Trigger event for other components
            navigate("/login");
        });
    };

    const handleSearch = (e) => {
        e.preventDefault();
        if (keyword.trim()) {
            navigate(`/search?q=${encodeURIComponent(keyword)}`);
            setIsMenuOpen(false);
        }
    };

    return (
        <header className={`${isAdmin ? 'bg-sidebarbg text-textprimary' : 'bg-header-bg text-header-text'} shadow-sm sticky top-0 z-50 border-b border-slate-200 transition-all duration-500 h-[72px] flex items-center`}>
            <div className="container mx-auto px-4 lg:px-8 h-full">
                <div className="flex items-center justify-between gap-8 h-full">

                    {/* Logo Area */}
                    <Link to="/" className="flex items-center gap-3 group shrink-0">
                        <div className="relative w-[380px] h-auto flex items-center justify-center shrink-0 text-slate-900 p-2">
                            {settings.site_logo ? (
                                <img src={getImageUrl(settings.site_logo)} alt="Logo" className="w-full h-auto object-contain max-h-[60px]" />
                            ) : (
                                <span className="material-symbols-outlined text-5xl">devices</span>
                            )}
                        </div>
                    </Link>

                    {/* Search Bar (Desktop) */}
                    <form onSubmit={handleSearch} className="hidden md:block flex-1 max-w-[500px] relative group">
                        <input
                            type="text"
                            placeholder="Search for products..."
                            value={keyword}
                            onChange={(e) => setKeyword(e.target.value)}
                            className="w-full h-[40px] bg-slate-100 text-slate-900 border-0 rounded-lg py-2 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:bg-white transition-all text-sm font-sans"
                        />
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 material-symbols-outlined text-[20px] group-focus-within:text-blue-500 transition-colors">search</span>
                    </form>

                    {/* Mobile Menu Toggle */}
                    <button
                        className="md:hidden p-2 text-slate-600 hover:text-slate-900 transition-colors"
                        onClick={() => setIsMenuOpen(!isMenuOpen)}
                    >
                        <span className="material-symbols-outlined text-[28px]">menu</span>
                    </button>

                    {/* Desktop Navigation */}
                    <nav className="hidden md:flex items-center gap-6 font-sans text-sm font-medium text-slate-600">
                        <Link to="/" className="hover:text-blue-600 transition-colors">Home</Link>
                        <Link to="/search" className="hover:text-blue-600 transition-colors">Shop</Link>

                        {/* User Actions */}
                        <div className="flex items-center gap-4 border-l border-slate-200 pl-6">
                            {user ? (
                                <div className="flex items-center gap-4">
                                    {/* Notification Icon */}
                                    <button
                                        className="relative group text-slate-500 hover:text-blue-600 transition-colors"
                                        onClick={() => user.role === 'admin' && navigate('/admin/notifications')}
                                        title={notifications.length > 0 ? `${notifications.length} alerts` : "No new notifications"}
                                    >
                                        <span className="material-symbols-outlined text-[22px]">notifications</span>
                                        {notifications.length > 0 && (
                                            <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
                                        )}
                                    </button>

                                    <div className="flex items-center gap-3 group relative cursor-pointer" onClick={() => navigate("/profile")}>
                                        <div className="relative">
                                            {user.profile_photo ? (
                                                <img src={getImageUrl(user.profile_photo)} alt={user.name} className="w-[32px] h-[32px] rounded-full border border-slate-200 object-cover" />
                                            ) : (
                                                <div className="w-[32px] h-[32px] rounded-full bg-slate-100 flex items-center justify-center text-slate-500">
                                                    <span className="material-symbols-outlined text-[20px]">person</span>
                                                </div>
                                            )}
                                        </div>
                                        <span className="text-slate-700 group-hover:text-blue-600 transition-colors hidden lg:block">{user.name.split(' ')[0]}</span>
                                        <button onClick={(e) => { e.stopPropagation(); handleLogout(); }} className="text-slate-400 hover:text-red-500 transition-colors ml-2" title="Logout">
                                            <span className="material-symbols-outlined text-[20px]">logout</span>
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex items-center gap-3">
                                    <Link to="/login" className="text-slate-700 hover:text-blue-600 transition-colors">Login</Link>
                                    <Link to="/register" className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors shadow-sm">
                                        Register
                                    </Link>
                                </div>
                            )}

                            <Link to="/cart" className="relative group text-slate-600 hover:text-blue-600 transition-colors">
                                <span className="material-symbols-outlined text-[24px]">shopping_cart</span>
                                {cartCount > 0 && (
                                    <span className="absolute -top-2 -right-2 bg-red-500 text-white text-[10px] w-4 h-4 flex items-center justify-center rounded-full font-bold">
                                        {cartCount}
                                    </span>
                                )}
                            </Link>
                        </div>
                    </nav>
                </div>

                {/* Mobile Menu Dropdown */}
                {isMenuOpen && (
                    <div className="md:hidden absolute top-[72px] left-0 right-0 bg-white border-b border-slate-200 animate-fadeIn shadow-lg z-40">
                        <div className="p-4 space-y-4">
                            <form onSubmit={handleSearch} className="relative">
                                <input
                                    type="text"
                                    placeholder="Search..."
                                    value={keyword}
                                    onChange={(e) => setKeyword(e.target.value)}
                                    className="w-full h-[40px] bg-slate-100 text-slate-900 rounded-lg px-4 pl-10 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                                />
                                <button type="submit" className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                                    <span className="material-symbols-outlined text-[20px]">search</span>
                                </button>
                            </form>
                            <div className="flex flex-col gap-2 text-sm font-medium text-slate-600">
                                <Link to="/" className="py-2 border-b border-slate-100" onClick={() => setIsMenuOpen(false)}>Home</Link>
                                <Link to="/search" className="py-2 border-b border-slate-100" onClick={() => setIsMenuOpen(false)}>Shop</Link>
                                <Link to="/cart" className="py-2 border-b border-slate-100 flex items-center justify-between" onClick={() => setIsMenuOpen(false)}>
                                    My Cart {cartCount > 0 && <span className="bg-blue-100 text-blue-700 text-xs rounded-full px-2 py-0.5">{cartCount}</span>}
                                </Link>
                                {user ? (
                                    <>
                                        <Link to="/profile" className="py-2 border-b border-slate-100" onClick={() => setIsMenuOpen(false)}>My Profile</Link>
                                        <button onClick={() => { handleLogout(); setIsMenuOpen(false); }} className="text-red-500 py-2 text-left">Logout</button>
                                    </>
                                ) : (
                                    <div className="flex gap-3 mt-2">
                                        <Link to="/login" className="flex-1 py-2 text-center border border-slate-200 rounded-lg" onClick={() => setIsMenuOpen(false)}>Login</Link>
                                        <Link to="/register" className="flex-1 py-2 text-center bg-blue-600 text-white rounded-lg" onClick={() => setIsMenuOpen(false)}>Register</Link>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </header>
    );
}
