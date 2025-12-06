import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import Header from './Header';
import Sidebar from './Sidebar';
import Footer from './Footer';
import Toast from './Toast';

export default function Layout({ children }) {
  const location = useLocation();
  const [user, setUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('user'));
    } catch {
      return null;
    }
  });

  useEffect(() => {
    const handleAuthChange = () => {
      try {
        setUser(JSON.parse(localStorage.getItem('user')));
      } catch {
        setUser(null);
      }
    };

    window.addEventListener('auth-change', handleAuthChange);
    return () => window.removeEventListener('auth-change', handleAuthChange);
  }, []);

  const isAdminRoute = location.pathname.startsWith('/admin');
  const isSellerRoute = location.pathname.startsWith('/seller');
  
  // Exclude login pages from dashboard layout
  const isLoginPage = location.pathname === '/admin/login' || location.pathname === '/seller/login';
  const isDashboard = (isAdminRoute || isSellerRoute) && !isLoginPage;

  if (isDashboard) {
    // Determine sidebar role based on the route
    const sidebarRole = isAdminRoute ? 'admin' : 'seller';
    
    return (
      <div className="min-h-screen bg-pagebg font-sans text-textprimary flex flex-col">
        <Header isAdmin={isAdminRoute} />
        <Toast />
        <div className="flex flex-1 w-full">
          {/* Sidebar: fixed width on md+ screens, hidden on small screens */}
           <div className="hidden md:block w-64 flex-shrink-0 border-r border-[rgba(212,164,55,0.08)] bg-sidebarbg relative">
             {/*
              Use max-h instead of fixed height so the sidebar can shrink gracefully
              when content or surrounding layout changes. `top-[80px]` offsets the
              sticky container below the header. `box-border` keeps padding inside
              the max-height calculation. */}
             <div className="sticky top-[80px] box-border max-h-[calc(100vh-80px)] overflow-y-auto p-4">
               <Sidebar role={sidebarRole} />
             </div>
           </div>

          {/* Main content - constrained width for better visual balance */}
          <div className="flex-1 flex flex-col min-w-0">
            <div className="flex-1 py-8 px-4 lg:px-10 xl:px-16 overflow-x-hidden">
              <div className="w-full">{children}</div>
            </div>
            <Footer />
          </div>
        </div>
      </div>
    );
  }

  // User / Public Layout (Full Width)
  return (
    <div className="min-h-screen bg-pagebg font-sans text-textprimary flex flex-col">
      <Header />
      <Toast />
      <main className="flex-1 w-full">
        {children}
      </main>
      <Footer />
    </div>
  );
}
