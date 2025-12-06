import React, { useState, useEffect } from 'react';
import { Helmet } from "react-helmet";
import { Link } from 'react-router-dom';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import api from '../../api/client';

export default function AdminDashboard() {
    const [chartData, setChartData] = useState([]);
    const [summary, setSummary] = useState({});
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(true);

    // Date Filter State
    const [filter, setFilter] = useState('30d'); // 7d, 30d, month, year, custom
    const [dates, setDates] = useState({ start: '', end: '' });

    const calculateDates = (type) => {
        const end = new Date();
        let start = new Date();
        let interval = 'day';

        if (type === '7d') {
            start.setDate(end.getDate() - 7);
        } else if (type === '30d') {
            start.setDate(end.getDate() - 30);
        } else if (type === 'month') {
            start = new Date(end.getFullYear(), end.getMonth(), 1);
        } else if (type === 'year') {
            start = new Date(end.getFullYear(), 0, 1);
            interval = 'month';
        }

        return {
            start: start.toISOString().split('T')[0],
            end: end.toISOString().split('T')[0],
            interval
        };
    };

    const loadDashboard = async () => {
        setLoading(true);
        try {
            let params = {};
            if (filter === 'custom') {
                params = { start_date: dates.start, end_date: dates.end, interval: 'day' };
            } else {
                params = calculateDates(filter);
            }

            const response = await api.get('/api/admin/dashboard', { params });
            const d = response.data || {};
            setSummary(d);
            setChartData(d.chart_data || []);
            setError(null);
        } catch (err) {
            console.error('Admin dashboard load failed', err);
            setError(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadDashboard();
    }, [filter]); // Reload when filter changes

    const handleCustomDateChange = (e) => {
        setDates({ ...dates, [e.target.name]: e.target.value });
    };

    return (
        <>
            <Helmet>
                <title>Admin Dashboard</title>
            </Helmet>
            <div className="space-y-6">
                {/* Page Header */}
                <div className="flex flex-col sm:flex-row flex-wrap justify-between items-start gap-4">
                    <div className="flex flex-col gap-1">
                        <h1 className="text-textprimary text-3xl font-bold tracking-tight">Dashboard Overview</h1>
                        <p className="text-textsecondary text-base font-normal">Overview of platform performance.</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <select
                            value={filter}
                            onChange={(e) => setFilter(e.target.value)}
                            className="h-10 rounded-lg border border-primary/20 text-sm px-3 focus:ring-2 focus:ring-primary/50 focus:outline-none bg-sidebarbg text-textprimary"
                        >
                            <option value="7d">Last 7 Days</option>
                            <option value="30d">Last 30 Days</option>
                            <option value="month">This Month</option>
                            <option value="year">This Year</option>
                            <option value="custom">Custom Range</option>
                        </select>

                        {filter === 'custom' && (
                            <>
                                <input type="date" name="start" value={dates.start} onChange={handleCustomDateChange} className="h-10 border border-primary/20 rounded-lg px-2 text-sm bg-sidebarbg text-textprimary" />
                                <input type="date" name="end" value={dates.end} onChange={handleCustomDateChange} className="h-10 border border-primary/20 rounded-lg px-2 text-sm bg-sidebarbg text-textprimary" />
                                <button onClick={loadDashboard} className="h-10 px-4 bg-primary text-white text-sm font-bold rounded-lg hover:bg-primary/90">Apply</button>
                            </>
                        )}

                        <button onClick={loadDashboard} className="flex items-center justify-center rounded-lg h-10 px-4 bg-cardbg text-white text-sm font-medium border border-white/10 hover:bg-cardbg/90">
                            <span className="material-symbols-outlined text-lg">refresh</span>
                        </button>
                    </div>
                </div>

                {/* Stats Grid */}
                {!loading && !error && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                        <div className="flex flex-col gap-2 rounded-xl p-6 bg-cardbg border border-white/10 shadow-sm">
                            <p className="text-black/70 text-base font-medium">Total Revenue</p>
                            <p className="text-black text-3xl font-bold tracking-tight">₹{Number(summary.total_sales || 0).toFixed(2)}</p>
                            <p className="text-black/50 text-xs">In selected period</p>
                        </div>
                        <div className="flex flex-col gap-2 rounded-xl p-6 bg-cardbg border border-white/10 shadow-sm">
                            <p className="text-black/70 text-base font-medium">Total Orders</p>
                            <p className="text-black text-3xl font-bold tracking-tight">{summary.total_orders || 0}</p>
                            <p className="text-black/50 text-xs">In selected period</p>
                        </div>
                        <div className="flex flex-col gap-2 rounded-xl p-6 bg-cardbg border border-white/10 shadow-sm">
                            <p className="text-black/70 text-base font-medium">Total Sellers</p>
                            <p className="text-black  text-3xl font-bold tracking-tight">{summary.total_sellers || 0}</p>
                            <p className="text-black/50 text-xs">All time</p>
                        </div>
                        <div className="flex flex-col gap-2 rounded-xl p-6 bg-cardbg border border-white/10 shadow-sm">
                            <p className="text-black/70 text-base font-medium">Total Users</p>
                            <p className="text-black text-3xl font-bold tracking-tight">{summary.total_users || 0}</p>
                            <p className="text-black/50 text-xs">All time</p>
                        </div>
                    </div>
                )}

                {/* Charts */}
                {!loading && !error && (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <div className="lg:col-span-2 flex flex-col gap-2 rounded-xl border border-primary/20 p-6 bg-sidebarbg shadow-sm">
                            <p className="text-blue-600 text-base font-medium">Sales Trends</p>
                            <div className="h-[300px] w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={chartData}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                                        <XAxis dataKey="name" stroke="#0a0a0a" />
                                        <YAxis stroke="#0a0a0a" />
                                        <Tooltip contentStyle={{ backgroundColor: '#6d5adbff', border: '1px solid #0d4288ff' }} />
                                        <Line type="monotone" dataKey="sales" stroke="#9c7373" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} name="Sales (₹)" />
                                        <Line type="monotone" dataKey="orders" stroke="#15e53f" strokeWidth={2} dot={{ r: 3 }} name="Orders" />
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                        <div className="flex flex-col gap-4">
                            {/* Pending Withdrawals Card */}
                            <div className="flex flex-col gap-4 rounded-xl p-6 bg-cardbg border border-white/10 shadow-sm flex-1">
                                <div className="flex justify-between items-center">
                                    <h3 className="font-semibold text-black">Pending Withdrawals</h3>
                                    <span className="inline-flex items-center justify-center text-xs font-bold px-2 py-1 rounded-full bg-warning/20 text-info">{summary.pending_withdrawals || 0} New</span>
                                </div>
                                <p className="text-black/70 text-sm">Sellers requesting payouts.</p>
                                <Link to="/admin/withdrawals" className="text-sm font-medium text-info hover:underline mt-auto">Process Withdrawals</Link>
                            </div>
                            {/* Quick Action Card */}
                            <div className="flex flex-col gap-4 rounded-xl p-6 bg-cardbg border border-white/10 shadow-sm flex-1">
                                <h3 className="font-semibold text-black">Quick Actions</h3>
                                <div className="flex flex-col gap-2">
                                    <Link to="/admin/products" className="text-sm text-black/70 hover:text-info flex items-center gap-2"><span className="material-symbols-outlined text-base">inventory_2</span> Manage Products</Link>
                                    <Link to="/admin/sellers" className="text-sm text-black/70 hover:text-info flex items-center gap-2"><span className="material-symbols-outlined text-base">group</span> Manage Sellers</Link>
                                    <Link to="/admin/notifications" className="text-sm text-black/70 hover:text-info flex items-center gap-2"><span className="material-symbols-outlined text-base">campaign</span> Broadcast Notifications</Link>
                                    <Link to="/admin/settings" className="text-sm text-black/70 hover:text-info flex items-center gap-2"><span className="material-symbols-outlined text-base">settings</span> Settings</Link>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Loading/Error States */}
                <div>
                    {loading && <div className="text-sm text-textsecondary">Loading dashboard...</div>}
                    {error && (
                        <div className="bg-error/10 p-4 rounded-xl border border-error/20">
                            <div className="text-error font-semibold">Error loading dashboard</div>
                            <div className="text-error/80 text-sm">{error.message}</div>
                            <button className="mt-2 text-sm text-info underline" onClick={loadDashboard}>Retry</button>
                        </div>
                    )}

                </div>

            </div>
        </>
    );
}