import React, { useState, useEffect } from "react";
import { Helmet } from "react-helmet";
import { Link } from "react-router-dom";
import api from "../../api/client";

import { getImageUrl } from "../../utils/image";

export default function AdminAds() {
  const [ads, setAds] = useState([]);
  const [editingAd, setEditingAd] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    text: '',
    image_url: '',
    footer_logo_url: '',
    target_url: '',
    position: 'home_banner',
    priority: 0,
    is_active: true,
    start_date: '',
    end_date: '',
    target_roles: '',
    product_id: '' // New field
  });
  const [allProducts, setAllProducts] = useState([]); // New state
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    loadAds();
    api.get("/api/products?limit=9999").then((res) => { // Fetch a large number of products
      setAllProducts(res.data.items);
    });
  }, []);

  const loadAds = () => {
    api.get("/api/admin/ads").then((res) => {
      setAds(res.data);
    });
  };

  const handleFileUpload = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      
      setUploading(true);
      const fd = new FormData();
      fd.append('file', file);
      
      try {
          const res = await api.post('/api/upload', fd, {
              headers: { 'Content-Type': 'multipart/form-data' }
          });
          setFormData(prev => ({ ...prev, image_url: res.data.url }));
      } catch (err) {
          console.error("Upload failed", err);
          alert("Upload failed");
      } finally {
          setUploading(false);
      }
  }

  const handleCreate = () => {
    setEditingAd(null);
    setFormData({
      title: '',
      text: '',
      image_url: '',
      footer_logo_url: '',
      target_url: '',
      position: 'home_banner',
      priority: 0,
      is_active: true,
      start_date: '',
      end_date: '',
      target_roles: '',
      product_id: ''
    });
    setIsModalOpen(true);
  };

  const handleEdit = (ad) => {
    setEditingAd(ad);
    setFormData({
      title: ad.title,
      text: ad.text || '',
      image_url: ad.image_url || '',
      footer_logo_url: ad.footer_logo_url || '',
      target_url: ad.target_url || '',
      position: ad.position,
      priority: ad.priority,
      is_active: ad.is_active,
      start_date: ad.start_date ? ad.start_date.slice(0, 16) : '',
      end_date: ad.end_date ? ad.end_date.slice(0, 16) : '',
      target_roles: ad.target_roles || '',
      product_id: ad.product_id || ''
    });
    setIsModalOpen(true);
  };

  const handleDelete = async (id) => {
    if (window.confirm("Are you sure you want to delete this ad?")) {
      await api.delete(`/api/admin/ads/${id}`);
      loadAds();
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingAd) {
        await api.put(`/api/admin/ads/${editingAd.id}`, formData);
      } else {
        await api.post("/api/admin/ads", formData);
      }
      setIsModalOpen(false);
      loadAds();
    } catch (err) {
      console.error(err);
      alert("Failed to save ad");
    }
  };

  return (
    <>
      <Helmet>
        <title>Advertisements</title>
      </Helmet>
      <div className="space-y-4">
        <div className="flex justify-between items-center">
            <h1 className="text-2xl font-semibold">Advertisements</h1>
            <button onClick={handleCreate} className="bg-slate-900 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-slate-800">Add New Ad</button>
        </div>
        
        <div className="bg-white rounded-xl shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 border-b">
                <tr>
                    <th className="p-4">Image</th>
                    <th className="p-4">Title/Text</th>
                    <th className="p-4">Product</th>
                    <th className="p-4">Price</th>
                    <th className="p-4">Placement</th>
                    <th className="p-4">Schedule</th>
                    <th className="p-4">Analytics</th>
                    <th className="p-4">Active</th>
                    <th className="p-4 text-right">Actions</th>
                </tr>
                </thead>
                <tbody className="divide-y">
                {ads.map((ad) => (
                    <tr key={ad.id} className="hover:bg-slate-50">
                    <td className="p-4">
                        <img src={getImageUrl(ad.image_url) || "https://placehold.co/100x50"} alt="Ad" className="h-12 object-cover rounded" />
                    </td>
                    <td className="p-4">
                        <div className="font-medium">{ad.title}</div>
                        <div className="text-xs text-gray-500 truncate max-w-[200px]">{ad.text}</div>
                    </td>
                    <td className="p-4">
                        {ad.product_name ? <Link to={`/product/${ad.product_id}`} className="text-blue-600 hover:underline">{ad.product_name}</Link> : '-'}
                    </td>
                    <td className="p-4">
                        {ad.product_price ? `₹${Number(ad.product_price).toFixed(2)}` : '-'}
                    </td>
                    <td className="p-4">
                        <div>{ad.position}</div>
                        <div className="text-xs text-gray-500">P: {ad.priority}</div>
                    </td>
                    <td className="p-4 text-xs">
                        <div>Start: {ad.start_date ? new Date(ad.start_date).toLocaleDateString() : '-'}</div>
                        <div>End: {ad.end_date ? new Date(ad.end_date).toLocaleDateString() : '-'}</div>
                    </td>
                    <td className="p-4 text-xs">
                        <div>Views: {ad.views}</div>
                        <div>Clicks: {ad.clicks}</div>
                        <div>CTR: {ad.views > 0 ? ((ad.clicks / ad.views) * 100).toFixed(1) : 0}%</div>
                    </td>
                    <td className="p-4">
                        <button 
                            onClick={async () => {
                                const newStatus = !ad.is_active;
                                await api.put(`/api/admin/ads/${ad.id}`, { is_active: newStatus });
                                loadAds();
                            }}
                            className={`relative inline-flex items-center h-6 rounded-full w-11 transition-colors focus:outline-none ${ad.is_active ? 'bg-green-600' : 'bg-gray-200'}`}
                        >
                            <span className={`transform transition-transform ${ad.is_active ? 'translate-x-6' : 'translate-x-1'} inline-block w-4 h-4 transform bg-white rounded-full`}/>
                        </button>
                    </td>
                    <td className="p-4 text-right space-x-2 whitespace-nowrap">
                        <button onClick={() => handleEdit(ad)} className="text-blue-600 hover:text-blue-800 font-medium">Edit</button>
                        <button onClick={() => handleDelete(ad.id)} className="text-red-600 hover:text-red-800 font-medium">Delete</button>
                    </td>
                    </tr>
                ))}
                {ads.length === 0 && <tr><td colSpan="9" className="p-8 text-center text-gray-500">No advertisements found.</td></tr>}
                </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-lg w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto">
                <h2 className="text-xl font-bold mb-4">{editingAd ? 'Edit Ad' : 'New Ad'}</h2>
                <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-slate-700 mb-1">Title</label>
                        <input type="text" required className="w-full border rounded-lg px-3 py-2" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} />
                    </div>
                    <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-slate-700 mb-1">Text Content / Subtitle</label>
                        <textarea className="w-full border rounded-lg px-3 py-2 h-20" value={formData.text} onChange={e => setFormData({...formData, text: e.target.value})} placeholder="Ad description text..."></textarea>
                    </div>
                    
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Image</label>
                        <div className="flex flex-col gap-2">
                            <div className="flex gap-2">
                                <input type="text" required className="w-full border rounded-lg px-3 py-2 text-sm" value={formData.image_url} onChange={e => setFormData({...formData, image_url: e.target.value})} placeholder="/api/files/..." />
                                <label className="cursor-pointer bg-gray-100 border px-3 py-2 rounded text-sm hover:bg-gray-200 whitespace-nowrap">
                                    Upload
                                    <input type="file" className="hidden" onChange={handleFileUpload} />
                                </label>
                            </div>
                            {uploading && <span className="text-xs text-blue-500">Uploading...</span>}
                            {formData.image_url && <img src={getImageUrl(formData.image_url)} alt="Preview" className="h-20 object-cover rounded border" />}
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Footer Logo URL (Optional)</label>
                        <input type="text" className="w-full border rounded-lg px-3 py-2" value={formData.footer_logo_url} onChange={e => setFormData({...formData, footer_logo_url: e.target.value})} placeholder="URL for dynamic footer logo" />
                    </div>
                    
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Target URL</label>
                        <input type="text" className="w-full border rounded-lg px-3 py-2" value={formData.target_url} onChange={e => setFormData({...formData, target_url: e.target.value})} />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Link to Product (Optional)</label>
                        <select
                            className="w-full border rounded-lg px-3 py-2"
                            value={formData.product_id || ''}
                            onChange={e => setFormData({...formData, product_id: e.target.value ? parseInt(e.target.value) : null})}
                        >
                            <option value="">-- Select Product --</option>
                            {allProducts.map(p => (
                                <option key={p.id} value={p.id}>
                                    {p.name} (₹{p.price.toFixed(2)})
                                </option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Target Roles (Optional)</label>
                        <input type="text" className="w-full border rounded-lg px-3 py-2" value={formData.target_roles} onChange={e => setFormData({...formData, target_roles: e.target.value})} placeholder="e.g., user,seller" />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Start Date</label>
                        <input type="datetime-local" className="w-full border rounded-lg px-3 py-2" value={formData.start_date} onChange={e => setFormData({...formData, start_date: e.target.value})} />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">End Date</label>
                        <input type="datetime-local" className="w-full border rounded-lg px-3 py-2" value={formData.end_date} onChange={e => setFormData({...formData, end_date: e.target.value})} />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Position</label>
                        <select className="w-full border rounded-lg px-3 py-2" value={formData.position} onChange={e => setFormData({...formData, position: e.target.value})}>
                            <option value="home_banner">Home Banner</option>
                            <option value="sidebar">Sidebar</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Priority</label>
                        <input type="number" className="w-full border rounded-lg px-3 py-2" value={formData.priority} onChange={e => setFormData({...formData, priority: e.target.value})} />
                    </div>
                    
                    <div className="md:col-span-2 flex items-center gap-2">
                        <input type="checkbox" id="is_active" checked={formData.is_active} onChange={e => setFormData({...formData, is_active: e.target.checked})} />
                        <label htmlFor="is_active" className="text-sm font-medium text-slate-700">Active</label>
                    </div>
                    
                    <div className="md:col-span-2 flex justify-end gap-2 mt-4 border-t pt-4">
                        <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg">Cancel</button>
                        <button type="submit" className="px-4 py-2 bg-slate-900 text-white font-bold rounded-lg hover:bg-slate-800">Save</button>
                    </div>
                </form>
            </div>
        </div>
      )}
    </>
  );
}
