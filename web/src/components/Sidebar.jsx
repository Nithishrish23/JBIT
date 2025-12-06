import React from 'react';
import { Link } from 'react-router-dom';

export default function Sidebar({ role = 'admin' }) {
  return (
    <aside className="w-full bg-sidebarbg md:bg-transparent md:rounded-xl md:shadow-none">
      <div className="bg-sidebarbg md:bg-transparent rounded-lg md:rounded-none p-4 md:p-0">
        <div className="mb-4 font-semibold text-lg text-textprimary">{role === 'admin' ? 'Admin Menu' : role === 'seller' ? 'Seller Menu' : 'Menu'}</div>
        <nav className="flex flex-col gap-2 text-sm">
          {role === 'admin' && (
            <>
              <Link to="/admin/dashboard" className="block px-3 py-2 rounded-md hover:bg-brandbg/20 hover:text-primary">Dashboard</Link>
              <Link to="/admin/orders" className="block px-3 py-2 rounded-md hover:bg-brandbg/20 hover:text-primary">Orders</Link>
              <Link to="/admin/products" className="block px-3 py-2 rounded-md hover:bg-brandbg/20 hover:text-primary">Products</Link>
              <Link to="/admin/categories" className="block px-3 py-2 rounded-md hover:bg-brandbg/20 hover:text-primary">Categories</Link>
              <Link to="/admin/coupons" className="block px-3 py-2 rounded-md hover:bg-brandbg/20 hover:text-primary">Coupons</Link>
              <Link to="/admin/users" className="block px-3 py-2 rounded-md hover:bg-brandbg/20 hover:text-primary">Users</Link>
              <Link to="/admin/sellers" className="block px-3 py-2 rounded-md hover:bg-brandbg/20 hover:text-primary">Sellers</Link>
              <Link to="/admin/notifications" className="block px-3 py-2 rounded-md hover:bg-brandbg/20 hover:text-primary">Notifications</Link>
              <Link to="/admin/support" className="block px-3 py-2 rounded-md hover:bg-brandbg/20 hover:text-primary">Support Tickets</Link>
              <Link to="/admin/ads" className="block px-3 py-2 rounded-md hover:bg-brandbg/20 hover:text-primary">Ads</Link>
              <Link to="/admin/withdrawals" className="block px-3 py-2 rounded-md hover:bg-brandbg/20 hover:text-primary">Withdrawals</Link>
              <Link to="/admin/logs" className="block px-3 py-2 rounded-md hover:bg-brandbg/20 hover:text-primary">System Logs</Link>
              <Link to="/admin/settings" className="block px-3 py-2 rounded-md hover:bg-brandbg/20 hover:text-primary">Settings</Link>
            </>
          )}
          {role === 'seller' && (
            <>
              <Link to="/seller/dashboard" className="block px-3 py-2 rounded-md hover:bg-brandbg/20 hover:text-primary">Dashboard</Link>
              <Link to="/seller/products" className="block px-3 py-2 rounded-md hover:bg-brandbg/20 hover:text-primary">Products</Link>
              <Link to="/seller/products/add" className="block px-3 py-2 rounded-md hover:bg-brandbg/20 hover:text-primary">Add Product</Link>
              <Link to="/seller/inventory" className="block px-3 py-2 rounded-md hover:bg-brandbg/20 hover:text-primary">Inventory</Link>
              <Link to="/seller/orders" className="block px-3 py-2 rounded-md hover:bg-brandbg/20 hover:text-primary">Orders</Link>
              <Link to="/seller/categories" className="block px-3 py-2 rounded-md hover:bg-brandbg/20 hover:text-primary">Categories</Link>
              <Link to="/seller/coupons" className="block px-3 py-2 rounded-md hover:bg-brandbg/20 hover:text-primary">Coupons</Link>
              <Link to="/seller/withdrawals" className="block px-3 py-2 rounded-md hover:bg-brandbg/20 hover:text-primary">Withdrawals</Link>
            </>
          )}
        </nav>
      </div>
    </aside>
  );
}