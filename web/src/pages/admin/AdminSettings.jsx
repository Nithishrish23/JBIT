
import React, { useState, useEffect } from "react";
import { Helmet } from "react-helmet";
import api, { upload } from "../../api/client";
import { getImageUrl } from "../../utils/image";

export default function AdminSettings() {
  const [paymentSettings, setPaymentSettings] = useState({
    razorpay_key_id: "",
    razorpay_key_secret: "",
    stripe_secret_key: "",
    stripe_webhook_secret: "",
  });
  
  const [siteSettings, setSiteSettings] = useState({
      site_logo: "",
      home_banner_image: "",
      home_banner_video: "",
      home_banner_heading: "",
      home_banner_subheading: ""
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    Promise.all([
        api.get("/api/admin/payment-gateways"),
        api.get("/api/admin/site-settings")
    ]).then(([payRes, siteRes]) => {
      setPaymentSettings(payRes.data);
      setSiteSettings(siteRes.data);
      setLoading(false);
    }).catch(err => {
      console.error(err);
      setLoading(false);
    });
  }, []);

  const handlePaymentChange = (e) => {
    setPaymentSettings({ ...paymentSettings, [e.target.name]: e.target.value });
  };

  const handleSiteChange = (e) => {
      setSiteSettings({ ...siteSettings, [e.target.name]: e.target.value });
  };

  const handleFileUpload = async (e, field) => {
      const file = e.target.files[0];
      if (!file) return;
      
      setUploading(true);
      const formData = new FormData();
      formData.append('file', file);
      
      try {
          const res = await api.post('/api/upload', formData, {
              headers: { 'Content-Type': 'multipart/form-data' }
          });
          // Store relative URL in state/DB, let frontend resolve it for display
          // Or store full URL? Storing relative is more portable.
          // But UserHome expects full URL or resolves it.
          // Let's store relative URL to be clean, and use getImageUrl everywhere.
          setSiteSettings(prev => ({ ...prev, [field]: res.data.url }));
      } catch (err) {
          console.error("Upload failed", err);
          alert("Upload failed");
      } finally {
          setUploading(false);
      }
  }

  const handleSubmit = (e) => {
    e.preventDefault();
    setSaving(true);
    Promise.all([
        api.post("/api/admin/payment-gateways", paymentSettings),
        api.post("/api/admin/site-settings", siteSettings)
    ]).then(() => {
      setSaving(false);
      alert("Settings updated successfully");
    }).catch(err => {
      console.error(err);
      setSaving(false);
      alert("Failed to update settings");
    });
  };

  if (loading) return <div>Loading...</div>;

  return (
    <>
      <Helmet>
        <title>Platform Settings</title>
      </Helmet>
      <div className="space-y-8 max-w-4xl">
        <h1 className="text-2xl font-semibold">Platform Settings</h1>
        <form onSubmit={handleSubmit} className="space-y-8">
            
            {/* Site Customization */}
            <div className="bg-white rounded-xl shadow p-6 space-y-6">
                <h2 className="text-xl font-bold text-slate-800 border-b pb-2">Site Customization</h2>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-700">Site Title</label>
                        <input
                            type="text"
                            name="site_title"
                            value={siteSettings.site_title || ""}
                            onChange={handleSiteChange}
                            className="mt-1 block w-full border rounded px-3 py-2"
                            placeholder="JB Solutions"
                        />
                    </div>

                    <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-700">Items Per Page</label>
                        <input
                            type="number"
                            name="items_per_page"
                            value={siteSettings.items_per_page || 12}
                            onChange={handleSiteChange}
                            className="mt-1 block w-full border rounded px-3 py-2"
                            min="1"
                        />
                    </div>

                    <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-700">Category Grid Columns</label>
                        <input
                            type="number"
                            name="category_grid_columns"
                            value={siteSettings.category_grid_columns || 4}
                            onChange={handleSiteChange}
                            className="mt-1 block w-full border rounded px-3 py-2"
                            min="1"
                            max="6"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700">Site Logo URL</label>
                        <div className="flex gap-2 mt-1">
                            <input
                                type="text"
                                name="site_logo"
                                value={siteSettings.site_logo}
                                onChange={handleSiteChange}
                                className="block w-full border rounded px-3 py-2 text-sm"
                                placeholder="/api/files/..."
                            />
                            <input type="file" className="hidden" id="logo-upload" onChange={(e) => handleFileUpload(e, 'site_logo')} />
                            <label htmlFor="logo-upload" className="cursor-pointer bg-gray-100 border px-3 py-2 rounded text-sm hover:bg-gray-200">Upload</label>
                        </div>
                        {siteSettings.site_logo && <img src={getImageUrl(siteSettings.site_logo)} alt="Logo Preview" className="mt-2 h-10 object-contain" />}K
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700">Home Banner Image</label>
                        <div className="flex gap-2 mt-1">
                            <input
                                type="text"
                                name="home_banner_image"
                                value={siteSettings.home_banner_image}
                                onChange={handleSiteChange}
                                className="block w-full border rounded px-3 py-2 text-sm"
                            />
                            <input type="file" className="hidden" id="banner-upload" onChange={(e) => handleFileUpload(e, 'home_banner_image')} />
                            <label htmlFor="banner-upload" className="cursor-pointer bg-gray-100 border px-3 py-2 rounded text-sm hover:bg-gray-200">Upload</label>
                        </div>
                        {siteSettings.home_banner_image && <img src={getImageUrl(siteSettings.home_banner_image)} alt="Banner Preview" className="mt-2 h-20 object-cover rounded" />}K
                    </div>

                    <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-700">Home Banner Video URL (Overrides Image)</label>
                        <div className="flex gap-2 mt-1">
                            <input
                                type="text"
                                name="home_banner_video"
                                value={siteSettings.home_banner_video}
                                onChange={handleSiteChange}
                                className="block w-full border rounded px-3 py-2 text-sm"
                                placeholder="MP4 URL or similar"
                            />
                            <input type="file" className="hidden" id="video-upload" accept="video/*" onChange={(e) => handleFileUpload(e, 'home_banner_video')} />
                            <label htmlFor="video-upload" className="cursor-pointer bg-gray-100 border px-3 py-2 rounded text-sm hover:bg-gray-200">Upload</label>
                        </div>
                    </div>

                    <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-700">Banner Heading</label>
                        <input
                            type="text"
                            name="home_banner_heading"
                            value={siteSettings.home_banner_heading}
                            onChange={handleSiteChange}
                            className="mt-1 block w-full border rounded px-3 py-2"
                        />
                    </div>

                    <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-700">Banner Subheading</label>
                        <input
                            type="text"
                            name="home_banner_subheading"
                            value={siteSettings.home_banner_subheading}
                            onChange={handleSiteChange}
                            className="mt-1 block w-full border rounded px-3 py-2"
                        />
                    </div>
                </div>
            </div>

            {/* Site Theme Customization */}
            <div className="bg-white rounded-xl shadow p-6 space-y-6">
                <h2 className="text-xl font-bold text-slate-800 border-b pb-2">Theme Colors</h2>
                
                {/* Section 0: Brand Colors */}
                <div>
                    <h3 className="font-semibold text-lg mb-3 text-gray-700">0. Brand Colors</h3>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">Primary Brand Color</label>
                            <div className="flex items-center gap-2">
                                <input type="color" name="theme_brand_primary" value={siteSettings.theme_brand_primary || '#9c7373'} onChange={handleSiteChange} className="h-10 w-10 rounded cursor-pointer border-0 p-0" />
                                <span className="text-xs uppercase text-gray-600">{siteSettings.theme_brand_primary}</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Section 1: Text Colors */}
                <div>
                    <h3 className="font-semibold text-lg mb-3 text-gray-700">1. Text Colors</h3>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">Primary Text</label>
                            <div className="flex items-center gap-2">
                                <input type="color" name="theme_text_primary" value={siteSettings.theme_text_primary || '#000000'} onChange={handleSiteChange} className="h-10 w-10 rounded cursor-pointer border-0 p-0" />
                                <span className="text-xs uppercase text-gray-600">{siteSettings.theme_text_primary}</span>
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">Secondary Text</label>
                            <div className="flex items-center gap-2">
                                <input type="color" name="theme_text_secondary" value={siteSettings.theme_text_secondary || '#0d0d0c'} onChange={handleSiteChange} className="h-10 w-10 rounded cursor-pointer border-0 p-0" />
                                <span className="text-xs uppercase text-gray-600">{siteSettings.theme_text_secondary}</span>
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">Muted Text</label>
                            <div className="flex items-center gap-2">
                                <input type="color" name="theme_text_muted" value={siteSettings.theme_text_muted || '#0a0a0a'} onChange={handleSiteChange} className="h-10 w-10 rounded cursor-pointer border-0 p-0" />
                                <span className="text-xs uppercase text-gray-600">{siteSettings.theme_text_muted}</span>
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">Inverse Text</label>
                            <div className="flex items-center gap-2">
                                <input type="color" name="theme_text_inverse" value={siteSettings.theme_text_inverse || '#EFE7D6'} onChange={handleSiteChange} className="h-10 w-10 rounded cursor-pointer border-0 p-0" />
                                <span className="text-xs uppercase text-gray-600">{siteSettings.theme_text_inverse}</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Section 2: Button Colors */}
                <div>
                    <h3 className="font-semibold text-lg mb-3 text-gray-700">2. Button Colors</h3>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">Button Background</label>
                            <div className="flex items-center gap-2">
                                <input type="color" name="theme_button_bg" value={siteSettings.theme_button_bg || '#9c7373'} onChange={handleSiteChange} className="h-10 w-10 rounded cursor-pointer border-0 p-0" />
                                <span className="text-xs uppercase text-gray-600">{siteSettings.theme_button_bg}</span>
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">Button Text</label>
                            <div className="flex items-center gap-2">
                                <input type="color" name="theme_button_text" value={siteSettings.theme_button_text || '#ffffff'} onChange={handleSiteChange} className="h-10 w-10 rounded cursor-pointer border-0 p-0" />
                                <span className="text-xs uppercase text-gray-600">{siteSettings.theme_button_text}</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Section 3: Header Colors */}
                <div>
                    <h3 className="font-semibold text-lg mb-3 text-gray-700">3. Header Colors</h3>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">Header Background</label>
                            <div className="flex items-center gap-2">
                                <input type="color" name="theme_header_bg" value={siteSettings.theme_header_bg || '#f5e9d1'} onChange={handleSiteChange} className="h-10 w-10 rounded cursor-pointer border-0 p-0" />
                                <span className="text-xs uppercase text-gray-600">{siteSettings.theme_header_bg}</span>
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">Header Text</label>
                            <div className="flex items-center gap-2">
                                <input type="color" name="theme_header_text" value={siteSettings.theme_header_text || '#272420'} onChange={handleSiteChange} className="h-10 w-10 rounded cursor-pointer border-0 p-0" />
                                <span className="text-xs uppercase text-gray-600">{siteSettings.theme_header_text}</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Section 4: Footer Colors */}
                <div>
                    <h3 className="font-semibold text-lg mb-3 text-gray-700">4. Footer Colors</h3>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">Footer Background</label>
                            <div className="flex items-center gap-2">
                                <input type="color" name="theme_footer_bg" value={siteSettings.theme_footer_bg || '#f5e9d1'} onChange={handleSiteChange} className="h-10 w-10 rounded cursor-pointer border-0 p-0" />
                                <span className="text-xs uppercase text-gray-600">{siteSettings.theme_footer_bg}</span>
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">Footer Text</label>
                            <div className="flex items-center gap-2">
                                <input type="color" name="theme_footer_text" value={siteSettings.theme_footer_text || '#272420'} onChange={handleSiteChange} className="h-10 w-10 rounded cursor-pointer border-0 p-0" />
                                <span className="text-xs uppercase text-gray-600">{siteSettings.theme_footer_text}</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Section 5: Banner Colors */}
                <div>
                    <h3 className="font-semibold text-lg mb-3 text-gray-700">5. Banner Colors</h3>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">Banner Background</label>
                            <div className="flex items-center gap-2">
                                <input type="color" name="theme_banner_bg" value={siteSettings.theme_banner_bg || '#f5e9d1'} onChange={handleSiteChange} className="h-10 w-10 rounded cursor-pointer border-0 p-0" />
                                <span className="text-xs uppercase text-gray-600">{siteSettings.theme_banner_bg}</span>
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">Banner Text</label>
                            <div className="flex items-center gap-2">
                                <input type="color" name="theme_banner_text" value={siteSettings.theme_banner_text || '#000000'} onChange={handleSiteChange} className="h-10 w-10 rounded cursor-pointer border-0 p-0" />
                                <span className="text-xs uppercase text-gray-600">{siteSettings.theme_banner_text}</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Section 6: Status Colors */}
                <div>
                    <h3 className="font-semibold text-lg mb-3 text-gray-700">6. Status Colors</h3>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">Success</label>
                            <div className="flex items-center gap-2">
                                <input type="color" name="theme_status_success" value={siteSettings.theme_status_success || '#15e53f'} onChange={handleSiteChange} className="h-10 w-10 rounded cursor-pointer border-0 p-0" />
                                <span className="text-xs uppercase text-gray-600">{siteSettings.theme_status_success}</span>
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">Warning</label>
                            <div className="flex items-center gap-2">
                                <input type="color" name="theme_status_warning" value={siteSettings.theme_status_warning || '#ddeb24'} onChange={handleSiteChange} className="h-10 w-10 rounded cursor-pointer border-0 p-0" />
                                <span className="text-xs uppercase text-gray-600">{siteSettings.theme_status_warning}</span>
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">Error</label>
                            <div className="flex items-center gap-2">
                                <input type="color" name="theme_status_error" value={siteSettings.theme_status_error || '#DC2626'} onChange={handleSiteChange} className="h-10 w-10 rounded cursor-pointer border-0 p-0" />
                                <span className="text-xs uppercase text-gray-600">{siteSettings.theme_status_error}</span>
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">Info</label>
                            <div className="flex items-center gap-2">
                                <input type="color" name="theme_status_info" value={siteSettings.theme_status_info || '#3B82F6'} onChange={handleSiteChange} className="h-10 w-10 rounded cursor-pointer border-0 p-0" />
                                <span className="text-xs uppercase text-gray-600">{siteSettings.theme_status_info}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Payment Gateways */}
            <div className="bg-white rounded-xl shadow p-6 space-y-6">
                <h2 className="text-xl font-bold text-slate-800 border-b pb-2">Payment Gateways</h2>
                
                {/* Razorpay */}
                <div>
                    <h3 className="font-medium text-lg mb-2 text-blue-600">Razorpay</h3>
                    <div className="space-y-3">
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Key ID</label>
                            <input
                                type="text"
                                name="razorpay_key_id"
                                value={paymentSettings.razorpay_key_id || ""}
                                onChange={handlePaymentChange}
                                className="mt-1 block w-full border rounded px-3 py-2"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Key Secret</label>
                            <input
                                type="password"
                                name="razorpay_key_secret"
                                value={paymentSettings.razorpay_key_secret || ""}
                                onChange={handlePaymentChange}
                                className="mt-1 block w-full border rounded px-3 py-2"
                            />
                        </div>
                    </div>
                </div>

                <hr/>

                {/* Stripe */}
                <div>
                    <h3 className="font-medium text-lg mb-2 text-purple-600">Stripe</h3>
                    <div className="space-y-3">
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Secret Key</label>
                            <input
                                type="password"
                                name="stripe_secret_key"
                                value={paymentSettings.stripe_secret_key || ""}
                                onChange={handlePaymentChange}
                                className="mt-1 block w-full border rounded px-3 py-2"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Webhook Secret</label>
                            <input
                                type="password"
                                name="stripe_webhook_secret"
                                value={paymentSettings.stripe_webhook_secret || ""}
                                onChange={handlePaymentChange}
                                className="mt-1 block w-full border rounded px-3 py-2"
                            />
                        </div>
                    </div>
                </div>
            </div>

            <div className="pt-2 flex gap-4">
                <button
                    type="submit"
                    disabled={saving || uploading}
                    className="bg-slate-900 text-white px-6 py-3 rounded-lg hover:bg-slate-800 disabled:opacity-50 font-bold"
                >
                    {saving ? "Saving..." : "Save All Settings"}
                </button>
                {uploading && <span className="text-sm text-gray-500 self-center">Uploading file...</span>}
            </div>
        </form>
      </div>
    </>
  );
}
