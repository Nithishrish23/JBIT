
import { Routes, Route, Navigate } from "react-router-dom";
import Layout from "./components/Layout";
import UserDashboard from "./pages/user/UserDashboard";
import UserHome from "./pages/user/UserHome";
import UserCategory from "./pages/user/UserCategory";
import UserProductDetail from "./pages/user/UserProductDetail";
import UserCart from "./pages/user/UserCart";
import UserWishlist from "./pages/user/UserWishlist";
import UserOrders from "./pages/user/UserOrders";
import UserCheckout from "./pages/user/UserCheckout";
import UserPaymentStatus from "./pages/user/UserPaymentStatus";
import UserProfile from "./pages/user/UserProfile";
import UserAddresses from "./pages/user/UserAddresses";
import UserSupport from "./pages/user/UserSupport";
import UserSearch from "./pages/user/UserSearch";

import SellerDashboard from "./pages/seller/SellerDashboard";
import SellerProducts from "./pages/seller/SellerProducts";
import SellerAddProduct from "./pages/seller/SellerAddProduct";
import SellerInventory from "./pages/seller/SellerInventory";
import SellerOrders from "./pages/seller/SellerOrders";
import SellerWithdrawals from "./pages/seller/SellerWithdrawals";
import SellerBillingPurchase from "./pages/seller/SellerBillingPurchase";
import SellerBillingSales from "./pages/seller/SellerBillingSales";

import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminUsers from "./pages/admin/AdminUsers";
import AdminSellers from "./pages/admin/AdminSellers";
import AdminSellerRequests from "./pages/admin/AdminSellerRequests";
import AdminProducts from "./pages/admin/AdminProducts";
import AdminCategories from "./pages/admin/AdminCategories";
import AdminOrders from "./pages/admin/AdminOrders";
import AdminWithdrawals from "./pages/admin/AdminWithdrawals";
import AdminAds from "./pages/admin/AdminAds";
import AdminSettings from "./pages/admin/AdminSettings";
import AdminLogs from "./pages/admin/AdminLogs";
import AdminLogin from "./pages/admin/AdminLogin";
import AdminOnboarding from "./pages/admin/AdminOnboarding";
import AdminNotifications from "./pages/admin/AdminNotifications";
import AdminSupport from "./pages/admin/AdminSupport";

import LoginPage from "./pages/user/LoginPage";
import RegisterPage from "./pages/user/RegisterPage";
import SellerLogin from "./pages/seller/SellerLogin";

import React, { useState, useEffect } from "react";
import api from "./api/client";

function getCurrentUserSync() {
  try {
    const user = localStorage.getItem("user");
    return user ? JSON.parse(user) : null;
  } catch {
    return null;
  }
}

const ProtectedRoute = ({ children, role }) => {
  // Initialize synchronously from localStorage to avoid blank renders on reload
  const [user, setUser] = useState(getCurrentUserSync());

  useEffect(() => {
    // Keep in sync if something else updates localStorage
    const u = getCurrentUserSync();
    setUser(u);
  }, []);

  if (!user) {
      // Redirect to role-specific login if trying to access a protected route directly
      if (role === 'admin') return <Navigate to="/admin/login" />;
      if (role === 'seller') return <Navigate to="/seller/login" />;
      return <Navigate to="/login" />;
  }
  if (role && user.role !== role) return <Navigate to="/" />;
  return children;
};

import { SocketProvider } from "./contexts/SocketContext";

export default function App() {
  useEffect(() => {
    api.get("/api/settings/public").then(res => {
      if (res.data.site_title) {
        document.title = res.data.site_title;
      }
      
      // Apply Theme Colors
      const theme = res.data;
      const root = document.documentElement;
      
      // Map settings keys to CSS variables
      // Brand
      if (theme.theme_brand_primary) root.style.setProperty('--theme-brand-primary', theme.theme_brand_primary);
      if (theme.theme_brand_secondary) root.style.setProperty('--theme-brand-secondary', theme.theme_brand_secondary);
      if (theme.theme_brand_accent) root.style.setProperty('--theme-brand-accent', theme.theme_brand_accent);
      if (theme.theme_brand_background) root.style.setProperty('--theme-brand-background', theme.theme_brand_background);
      
      // Layout
      if (theme.theme_layout_background) root.style.setProperty('--theme-layout-background', theme.theme_layout_background);
      if (theme.theme_layout_card) root.style.setProperty('--theme-layout-card', theme.theme_layout_card);
      if (theme.theme_layout_sidebar) root.style.setProperty('--theme-layout-sidebar', theme.theme_layout_sidebar);
      if (theme.theme_layout_footer) root.style.setProperty('--theme-layout-footer', theme.theme_layout_footer);
      
      // Text
      if (theme.theme_text_primary) root.style.setProperty('--theme-text-primary', theme.theme_text_primary);
      if (theme.theme_text_secondary) root.style.setProperty('--theme-text-secondary', theme.theme_text_secondary);
      if (theme.theme_text_muted) root.style.setProperty('--theme-text-muted', theme.theme_text_muted);
      if (theme.theme_text_inverse) root.style.setProperty('--theme-text-inverse', theme.theme_text_inverse);
      
      // Button Colors
      if (theme.theme_button_bg) root.style.setProperty('--theme-button-bg', theme.theme_button_bg);
      if (theme.theme_button_text) root.style.setProperty('--theme-button-text', theme.theme_button_text);

      // Header Colors
      if (theme.theme_header_bg) root.style.setProperty('--theme-header-bg', theme.theme_header_bg);
      if (theme.theme_header_text) root.style.setProperty('--theme-header-text', theme.theme_header_text);

      // Footer Colors
      if (theme.theme_footer_bg) root.style.setProperty('--theme-footer-bg', theme.theme_footer_bg);
      if (theme.theme_footer_text) root.style.setProperty('--theme-footer-text', theme.theme_footer_text);

      // Banner Colors
      if (theme.theme_banner_bg) root.style.setProperty('--theme-banner-bg', theme.theme_banner_bg);
      if (theme.theme_banner_text) root.style.setProperty('--theme-banner-text', theme.theme_banner_text);
      
      // Status
      if (theme.theme_status_success) root.style.setProperty('--theme-status-success', theme.theme_status_success);
      if (theme.theme_status_warning) root.style.setProperty('--theme-status-warning', theme.theme_status_warning);
      if (theme.theme_status_error) root.style.setProperty('--theme-status-error', theme.theme_status_error);
      if (theme.theme_status_info) root.style.setProperty('--theme-status-info', theme.theme_status_info);

    }).catch(err => console.error("Failed to load site settings", err));
  }, []);

  return (
    <SocketProvider>
      <Layout>
        <Routes>
            {/* User */}
            <Route path="/" element={<UserHome />} />
            <Route path="/category/:slug" element={<UserCategory />} />
            <Route path="/product/:id" element={<UserProductDetail />} />
            <Route path="/cart" element={<UserCart />} />
            <Route path="/wishlist" element={<UserWishlist />} />
            <Route path="/orders" element={<UserOrders />} />
            <Route path="/checkout" element={<UserCheckout />} />
            <Route path="/payment-status" element={<UserPaymentStatus />} />
            <Route path="/payment/failed" element={<UserPaymentStatus />} />
            <Route path="/profile" element={<UserProfile />} />
            <Route path="/addresses" element={<UserAddresses />} />
            <Route path="/support" element={<UserSupport />} />
            <Route path="/search" element={<UserSearch />} />

            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />

            {/* Seller Public */}
            <Route path="/seller/login" element={<SellerLogin />} />

            {/* Seller Protected */}
            <Route
              path="/seller/dashboard"
              element={
                <ProtectedRoute role="seller">
                  <SellerDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/seller/products"
              element={
                <ProtectedRoute role="seller">
                  <SellerProducts />
                </ProtectedRoute>
              }
            />
            <Route
              path="/seller/products/add"
              element={
                <ProtectedRoute role="seller">
                  <SellerAddProduct />
                </ProtectedRoute>
              }
            />
            <Route
              path="/seller/inventory"
              element={
                <ProtectedRoute role="seller">
                  <SellerInventory />
                </ProtectedRoute>
              }
            />
            <Route
              path="/seller/orders"
              element={
                <ProtectedRoute role="seller">
                  <SellerOrders />
                </ProtectedRoute>
              }
            />
            <Route
              path="/seller/withdrawals"
              element={
                <ProtectedRoute role="seller">
                  <SellerWithdrawals />
                </ProtectedRoute>
              }
            />
            <Route
              path="/seller/billing/purchase"
              element={
                <ProtectedRoute role="seller">
                  <SellerBillingPurchase />
                </ProtectedRoute>
              }
            />
            <Route
              path="/seller/billing/sales"
              element={
                <ProtectedRoute role="seller">
                  <SellerBillingSales />
                </ProtectedRoute>
              }
            />

            {/* Admin Public */}
            <Route path="/admin/login" element={<AdminLogin />} />
            <Route path="/admin/onboarding" element={<AdminOnboarding />} />

            {/* Admin Protected */}
            <Route
              path="/admin/dashboard"
              element={
                <ProtectedRoute role="admin">
                  <AdminDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/users"
              element={
                <ProtectedRoute role="admin">
                  <AdminUsers />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/sellers"
              element={
                <ProtectedRoute role="admin">
                  <AdminSellers />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/seller-requests"
              element={
                <ProtectedRoute role="admin">
                  <AdminSellerRequests />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/products"
              element={
                <ProtectedRoute role="admin">
                  <AdminProducts />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/categories"
              element={
                <ProtectedRoute role="admin">
                  <AdminCategories />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/orders"
              element={
                <ProtectedRoute role="admin">
                  <AdminOrders />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/withdrawals"
              element={
                <ProtectedRoute role="admin">
                  <AdminWithdrawals />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/ads"
              element={
                <ProtectedRoute role="admin">
                  <AdminAds />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/notifications"
              element={
                <ProtectedRoute role="admin">
                  <AdminNotifications />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/support"
              element={
                <ProtectedRoute role="admin">
                  <AdminSupport />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/logs"
              element={
                <ProtectedRoute role="admin">
                  <AdminLogs />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/settings"
              element={
                <ProtectedRoute role="admin">
                  <AdminSettings />
                </ProtectedRoute>
              }
            />

            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
      </Layout>
    </SocketProvider>
  );
}
