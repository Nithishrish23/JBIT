import React, { useState, useEffect } from "react";
import { Helmet } from "react-helmet";
import api from "../../api/client";
import { getImageUrl } from "../../utils/image";

export default function SellerCategories() {
  const [categories, setCategories] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({ name: '', description: '', image: null });
  const [imagePreview, setImagePreview] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = () => {
    api.get("/api/seller/categories").then((res) => {
      setCategories(res.data);
    });
  };

  const handleFileChange = (e) => {
      const file = e.target.files[0];
      if (file) {
          setFormData({ ...formData, image: file });
          setImagePreview(URL.createObjectURL(file));
      }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    const fd = new FormData();
    fd.append('name', formData.name);
    fd.append('description', formData.description);
    if (formData.image) {
        fd.append('image', formData.image);
    }

    try {
      await api.post("/api/seller/categories/request", fd, {
          headers: { "Content-Type": "multipart/form-data" }
      });
      alert("Category requested successfully! Pending admin approval.");
      setShowModal(false);
      setFormData({ name: '', description: '', image: null });
      setImagePreview(null);
      fetchCategories();
    } catch (err) {
      console.error(err);
      alert("Failed to request category: " + (err.response?.data?.error || err.message));
    } finally {
        setLoading(false);
    }
  };

  return (
    <>
      <Helmet>
        <title>Categories</title>
      </Helmet>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
            <div>
                <h1 className="text-2xl font-bold text-slate-800">Categories</h1>
                <p className="text-sm text-gray-500">View available categories or request a new one.</p>
            </div>
            <button onClick={() => setShowModal(true)} className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 font-medium">
                Request New Category
            </button>
        </div>

        <div className="bg-white rounded-xl shadow overflow-hidden border border-gray-100">
            <table className="w-full text-sm text-left">
                <thead className="bg-gray-50 text-gray-500 border-b">
                    <tr>
                        <th className="p-4">Image</th>
                        <th className="p-4">Name</th>
                        <th className="p-4">Description</th>
                        <th className="p-4">Status</th>
                        <th className="p-4">Type</th>
                    </tr>
                </thead>
                <tbody className="divide-y">
                    {categories.map(cat => (
                        <tr key={cat.id} className="hover:bg-gray-50">
                            <td className="p-4">
                                <img src={getImageUrl(cat.image_url)} alt={cat.name} className="w-10 h-10 object-cover rounded bg-gray-100" />
                            </td>
                            <td className="p-4 font-medium">{cat.name}</td>
                            <td className="p-4 text-gray-500">{cat.description || '-'}</td>
                            <td className="p-4">
                                <span className={`px-2 py-1 rounded-full text-xs ${cat.is_approved ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                                    {cat.is_approved ? 'Active' : 'Pending Approval'}
                                </span>
                            </td>
                            <td className="p-4 text-xs text-gray-500">
                                {cat.seller_id ? 'My Request' : 'Global'}
                            </td>
                        </tr>
                    ))}
                    {categories.length === 0 && (
                        <tr><td colSpan="5" className="p-8 text-center text-gray-400">No categories found.</td></tr>
                    )}
                </tbody>
            </table>
        </div>

        {showModal && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
                <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
                    <h2 className="text-xl font-bold mb-4">Request New Category</h2>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Category Name</label>
                            <input 
                                type="text" 
                                className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
                                value={formData.name}
                                onChange={e => setFormData({...formData, name: e.target.value})}
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                            <textarea 
                                className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
                                value={formData.description}
                                onChange={e => setFormData({...formData, description: e.target.value})}
                                rows="3"
                            ></textarea>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Category Image</label>
                            <div className="flex items-center gap-4">
                                {imagePreview && (
                                    <img src={imagePreview} alt="Preview" className="w-16 h-16 object-cover rounded-lg border" />
                                )}
                                <input 
                                    type="file" 
                                    accept="image/*"
                                    onChange={handleFileChange}
                                    className="text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                                />
                            </div>
                        </div>
                        <div className="flex justify-end gap-3 pt-4">
                            <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 border rounded-lg text-gray-600 hover:bg-gray-50">Cancel</button>
                            <button type="submit" disabled={loading} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
                                {loading ? 'Submitting...' : 'Submit Request'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        )}
      </div>
    </>
  );
}
