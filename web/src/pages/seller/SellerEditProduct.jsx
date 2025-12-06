import React, { useState, useEffect } from "react";
import { Helmet } from "react-helmet";
import { useNavigate, useParams } from "react-router-dom";
import api from "../../api/client";
import { getImageUrl } from "../../utils/image";

export default function SellerEditProduct() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  
  const [formData, setFormData] = useState({
      name: "",
      description: "",
      price: "",
      mrp: "",
      stock_qty: "",
  });
  const [currentImages, setCurrentImages] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    api.get(`/api/seller/products/${id}`).then((res) => {
      const p = res.data;
      setFormData({
          name: p.name,
          description: p.description,
          price: p.price,
          mrp: p.mrp || "",
          stock_qty: p.stock_qty
      });
      setCurrentImages(p.images || []);
      setLoading(false);
    }).catch(err => {
        console.error(err);
        setError("Failed to load product");
        setLoading(false);
    });
  }, [id]);

  const handleChange = (e) => {
      const { name, value } = e.target;
      setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    const payload = {
        name: formData.name,
        description: formData.description,
        price: parseFloat(formData.price),
        mrp: formData.mrp ? parseFloat(formData.mrp) : 0,
        quantity: parseInt(formData.stock_qty)
    };

    try {
      await api.put(`/api/seller/products/${id}`, payload);
      navigate("/seller/products");
    } catch (err) {
      setError("Failed to update product.");
      console.error(err);
    }
  };

  if (loading) return <div className="p-8 text-center">Loading...</div>;

  return (
    <>
      <Helmet>
        <title>Edit Product</title>
      </Helmet>
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold text-slate-800">Edit Product</h1>
            <button onClick={() => navigate('/seller/products')} className="text-sm text-slate-500 hover:text-slate-800">
                &larr; Back to Products
            </button>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-6 border-b border-slate-100 bg-slate-50">
                <h2 className="font-semibold text-slate-700">Product Details</h2>
                <p className="text-xs text-slate-500 mt-1">Update your product information below.</p>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-6">
                {error && <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg text-sm">{error}</div>}
                
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Product Name</label>
                        <input
                            type="text"
                            name="name"
                            className="w-full border border-slate-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                            value={formData.name}
                            onChange={handleChange}
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
                        <textarea
                            name="description"
                            className="w-full border border-slate-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all min-h-[120px]"
                            value={formData.description}
                            onChange={handleChange}
                            required
                        ></textarea>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Selling Price (₹)</label>
                            <input
                                type="number"
                                name="price"
                                step="0.01"
                                className="w-full border border-slate-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                                value={formData.price}
                                onChange={handleChange}
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">MRP (₹)</label>
                            <input
                                type="number"
                                name="mrp"
                                step="0.01"
                                className="w-full border border-slate-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                                value={formData.mrp}
                                onChange={handleChange}
                                placeholder="Optional"
                            />
                            <p className="text-[10px] text-slate-500 mt-1">Must be higher than selling price to show discount.</p>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Stock Quantity</label>
                            <input
                                type="number"
                                name="stock_qty"
                                className="w-full border border-slate-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                                value={formData.stock_qty}
                                onChange={handleChange}
                                required
                            />
                        </div>
                    </div>
                </div>

                <div className="pt-6 border-t border-slate-100">
                    <label className="block text-sm font-medium text-slate-700 mb-3">Product Images</label>
                    <div className="flex gap-4 overflow-x-auto pb-2">
                        {currentImages.length > 0 ? currentImages.map(img => (
                            <div key={img.id} className="relative group shrink-0">
                                <img src={getImageUrl(img.download_url)} className="w-24 h-24 object-cover rounded-lg border border-slate-200 shadow-sm" />
                            </div>
                        )) : (
                            <div className="text-sm text-slate-400 italic">No images uploaded.</div>
                        )}
                    </div>
                    <p className="text-xs text-slate-500 mt-2 bg-blue-50 text-blue-700 px-3 py-2 rounded inline-block">
                        <span className="font-bold">Note:</span> Image editing is currently available only via re-uploading in a new version or contacting support.
                    </p>
                </div>

                <div className="flex gap-4 pt-4">
                    <button
                        type="button"
                        onClick={() => navigate('/seller/products')}
                        className="flex-1 px-6 py-3 border border-slate-300 rounded-lg text-slate-700 font-medium hover:bg-slate-50 transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 shadow-md hover:shadow-lg transition-all"
                    >
                        Update Product
                    </button>
                </div>
            </form>
        </div>
      </div>
    </>
  );
}