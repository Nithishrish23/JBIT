import React, { useState, useEffect } from "react";
import { Helmet } from "react-helmet";
import api from "../../api/client";

export default function AdminCategories() {
  const [categories, setCategories] = useState([]);
  const [formData, setFormData] = useState({ name: '', slug: '', description: '' });
  const [editingId, setEditingId] = useState(null);

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = () => {
    api.get("/api/admin/categories").then((res) => {
      setCategories(res.data);
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (editingId) {
        api.put(`/api/admin/categories/${editingId}`, formData).then(() => {
            fetchCategories();
            resetForm();
        }).catch(err => alert("Failed to update category"));
    } else {
        api.post("/api/admin/categories", formData).then(() => {
            fetchCategories();
            resetForm();
        }).catch(err => alert("Failed to create category"));
    }
  };

  const handleEdit = (cat) => {
      setEditingId(cat.id);
      setFormData({ name: cat.name, slug: cat.slug, description: cat.description, is_approved: cat.is_approved });
  };

  const handleDelete = (id) => {
      if(!window.confirm("Delete this category?")) return;
      api.delete(`/api/admin/categories/${id}`)
        .then(() => fetchCategories())
        .catch(err => alert("Failed to delete: " + (err.response?.data?.error || err.message)));
  };

  const handleApprove = (cat) => {
      api.put(`/api/admin/categories/${cat.id}`, { is_approved: !cat.is_approved })
        .then(() => fetchCategories())
        .catch(err => alert("Failed to update status"));
  };

  const resetForm = () => {
      setFormData({ name: '', slug: '', description: '' });
      setEditingId(null);
  };

  return (
    <>
      <Helmet>
        <title>Category Management</title>
      </Helmet>
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold text-slate-800">Category Management</h1>
        
        {/* Form */}
        <div className="bg-white p-6 rounded-xl shadow border border-slate-200">
            <h2 className="text-lg font-medium mb-4">{editingId ? 'Edit Category' : 'Add New Category'}</h2>
            <form onSubmit={handleSubmit} className="flex flex-wrap gap-4 items-end">
                <div className="flex-1 min-w-[200px]">
                    <label className="block text-xs font-medium text-slate-600 mb-1">Name</label>
                    <input 
                        className="w-full border rounded px-3 py-2 text-sm" 
                        value={formData.name} 
                        onChange={e => setFormData({...formData, name: e.target.value, slug: e.target.value.toLowerCase().replace(/\s+/g, '-')})} 
                        required 
                    />
                </div>
                <div className="flex-1 min-w-[200px]">
                    <label className="block text-xs font-medium text-slate-600 mb-1">Slug</label>
                    <input 
                        className="w-full border rounded px-3 py-2 text-sm bg-slate-50" 
                        value={formData.slug} 
                        onChange={e => setFormData({...formData, slug: e.target.value})} 
                        required 
                    />
                </div>
                <div className="flex-1 min-w-[200px]">
                     <label className="block text-xs font-medium text-slate-600 mb-1">Description</label>
                     <input 
                        className="w-full border rounded px-3 py-2 text-sm" 
                        value={formData.description} 
                        onChange={e => setFormData({...formData, description: e.target.value})} 
                     />
                </div>
                <div className="flex gap-2">
                    {editingId && (
                        <button type="button" onClick={resetForm} className="px-4 py-2 border rounded text-sm hover:bg-slate-50">Cancel</button>
                    )}
                    <button type="submit" className="px-6 py-2 bg-slate-900 text-white rounded text-sm hover:bg-slate-800">
                        {editingId ? 'Update' : 'Add'}
                    </button>
                </div>
            </form>
        </div>

        {/* List */}
        <div className="bg-white rounded-xl shadow overflow-hidden border border-slate-200">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-slate-500 border-b border-slate-200">
              <tr>
                <th className="p-4 font-medium">Name</th>
                <th className="p-4 font-medium">Slug</th>
                <th className="p-4 font-medium">Created By</th>
                <th className="p-4 font-medium">Status</th>
                <th className="p-4 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {categories.map(cat => (
                <tr key={cat.id} className="hover:bg-slate-50">
                  <td className="p-4 font-medium">{cat.name}</td>
                  <td className="p-4 text-slate-500">{cat.slug}</td>
                  <td className="p-4 text-slate-500">{cat.seller_name}</td>
                  <td className="p-4">
                      <button 
                        onClick={() => handleApprove(cat)} 
                        className={`px-2 py-1 rounded text-xs font-bold border ${cat.is_approved ? 'bg-green-100 text-green-700 border-green-200' : 'bg-amber-100 text-amber-700 border-amber-200'}`}
                      >
                          {cat.is_approved ? 'Active' : 'Pending'}
                      </button>
                  </td>
                  <td className="p-4 flex gap-2">
                      <button onClick={() => handleEdit(cat)} className="text-blue-600 hover:underline">Edit</button>
                      <button onClick={() => handleDelete(cat.id)} className="text-red-600 hover:underline">Delete</button>
                  </td>
                </tr>
              ))}
              {categories.length === 0 && (
                  <tr><td colSpan="5" className="p-8 text-center text-slate-400">No categories found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
