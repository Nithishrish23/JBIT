import React, { useState, useEffect } from "react";
import { Helmet } from "react-helmet";
import api from "../../api/client";
import { getImageUrl } from "../../utils/image";
import { useSocket } from "../../contexts/SocketContext";

export default function AdminProducts() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [sellers, setSellers] = useState([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newProduct, setNewProduct] = useState({ 
    name: "", description: "", price: "", stock_qty: "", seller_id: "", category_id: "", sku: ""
  });
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(false);
  const socket = useSocket();

  const fetchProducts = () => {
    // Fetch ALL products (admin view)
    api.get("/api/admin/products").then((res) => {
      setProducts(res.data);
    }).catch(err => console.error("Failed to fetch products", err));
  }

  const fetchCategories = () => {
    api.get("/api/categories").then((res) => {
      setCategories(res.data);
    });
  };

  const fetchSellers = () => {
    api.get("/api/admin/sellers").then((res) => {
      setSellers(res.data);
    });
  };

  useEffect(() => {
    fetchProducts();
    fetchCategories();
    fetchSellers();
  }, []);

  useEffect(() => {
    if (!socket) return;

    const handleUpdate = (payload) => {
        if (payload.resource === 'product') {
            fetchProducts();
        }
    };

    socket.on('resource_update', handleUpdate);

    return () => {
        socket.off('resource_update', handleUpdate);
    };
  }, [socket]);

  const handleAction = (productId, status) => {
    api.put(`/api/admin/products/${productId}/status`, { status })
      .then(() => {
        // Update local state
        setProducts(products.map(p => p.id === productId ? { ...p, status } : p));
      })
      .catch(err => alert("Failed to update status"));
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setNewProduct({ ...newProduct, [name]: value });
  };

  const handleAddProduct = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    const formData = new FormData();
    formData.append("name", newProduct.name);
    formData.append("description", newProduct.description);
    formData.append("price", newProduct.price);
    formData.append("stock_qty", newProduct.stock_qty);
    formData.append("seller_id", newProduct.seller_id);
    formData.append("category_id", newProduct.category_id);
    formData.append("sku", newProduct.sku);
    
    for (let i = 0; i < images.length; i++) {
        formData.append("images", images[i]);
    }

    try {
      await api.post("/api/admin/products", formData, {
          headers: { "Content-Type": "multipart/form-data" }
      });
      alert("Product added successfully!");
      setNewProduct({ name: "", description: "", price: "", stock_qty: "", seller_id: "", category_id: "", sku: "" });
      setImages([]);
      setShowAddModal(false);
      fetchProducts(); // Refresh the list
    } catch (error) {
      console.error("Failed to add product:", error);
      alert(error.response?.data?.error || "Failed to add product.");
    } finally {
      setLoading(false);
    }
  };


  return (
    <>
      <Helmet>
        <title>Product Management</title>
      </Helmet>
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold text-textprimary">Product Management</h1>
        <button
            onClick={() => setShowAddModal(true)}
            className="bg-primary text-white px-4 py-2 rounded hover:bg-primary/90"
        >
            Add New Product
        </button>
        <div className="bg-sidebarbg rounded-xl shadow-sm p-4 border border-primary/20">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b border-primary/10">
                <th className="p-2 text-textsecondary">ID</th>
                <th className="p-2 text-textsecondary">Image</th>
                <th className="p-2 text-textsecondary">Name</th>
                <th className="p-2 text-textsecondary">SKU</th>
                <th className="p-2 text-textsecondary">Seller</th>
                <th className="p-2 text-textsecondary">Price</th>
                <th className="p-2 text-textsecondary">Status</th>
                <th className="p-2 text-textsecondary">Actions</th>
              </tr>
            </thead>
            <tbody>
              {products.map((product) => (
                <tr key={product.id} className="border-b border-primary/10 hover:bg-brandbg/5">
                  <td className="p-2 text-textprimary">{product.id}</td>
                  <td className="p-2">
                      <img src={getImageUrl(product.images && product.images.length > 0 ? product.images[0].download_url : null)} alt={product.name} className="w-10 h-10 object-cover rounded bg-brandbg/20" onError={e => e.target.src=getImageUrl(null)} />
                  </td>
                  <td className="p-2 text-textprimary">{product.name}</td>
                  <td className="p-2 text-textsecondary">{product.sku || '-'}</td>
                  <td className="p-2 text-textsecondary">{product.seller_name}</td>
                  <td className="p-2 text-textprimary">₹{Number(product.price).toFixed(2)}</td>
                  <td className="p-2">
                    <span className={`px-2 py-1 rounded text-xs ${
                        product.status === 'approved' ? 'bg-success/10 text-success' :
                        product.status === 'rejected' ? 'bg-error/10 text-error' :
                        'bg-warning/10 text-warning'
                    }`}>
                        {product.status}
                    </span>
                  </td>
                  <td className="p-2 space-x-2">
                    {product.status !== 'approved' && (
                        <button onClick={() => handleAction(product.id, 'approved')} className="bg-success text-white px-3 py-1 rounded hover:bg-success/90 text-xs">Approve</button>
                    )}
                    {product.status !== 'rejected' && (
                        <button onClick={() => handleAction(product.id, 'rejected')} className="bg-error text-white px-3 py-1 rounded hover:bg-error/90 text-xs">Reject</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-sidebarbg rounded-2xl shadow-luxury w-full max-w-3xl p-8 max-h-[90vh] overflow-y-auto border border-primary/20">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h2 className="text-2xl font-bold text-textprimary">Add New Product</h2>
                    <p className="text-sm text-textsecondary">Fill in the details to create a new product listing.</p>
                </div>
                <button onClick={() => setShowAddModal(false)} className="text-textmuted hover:text-textprimary">
                    <span className="material-symbols-outlined">close</span>
                </button>
            </div>
            
            <form onSubmit={handleAddProduct} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="col-span-1 md:col-span-2">
                    <label className="block text-sm font-semibold text-textsecondary mb-1">Product Name</label>
                    <input
                      type="text"
                      name="name"
                      value={newProduct.name}
                      onChange={handleInputChange}
                      className="w-full border border-primary/20 bg-transparent rounded-lg px-4 py-2 focus:ring-2 focus:ring-primary/50 focus:border-primary outline-none transition-all text-textprimary"
                      placeholder="e.g. Organic Alphonso Mangoes"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-textsecondary mb-1">SKU</label>
                    <input
                      type="text"
                      name="sku"
                      value={newProduct.sku}
                      onChange={handleInputChange}
                      className="w-full border border-primary/20 bg-transparent rounded-lg px-4 py-2 focus:ring-2 focus:ring-primary/50 focus:border-primary outline-none transition-all text-textprimary"
                      placeholder="e.g. MANGO-ALP-001"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-textsecondary mb-1">Category</label>
                    <select
                      name="category_id"
                      value={newProduct.category_id}
                      onChange={handleInputChange}
                      className="w-full border border-primary/20 bg-sidebarbg rounded-lg px-4 py-2 focus:ring-2 focus:ring-primary/50 focus:border-primary outline-none transition-all text-textprimary"
                      required
                    >
                      <option value="">Select Category</option>
                      {categories.map(category => (
                        <option key={category.id} value={category.id}>{category.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="col-span-1 md:col-span-2">
                    <label className="block text-sm font-semibold text-textsecondary mb-1">Description</label>
                    <textarea
                      name="description"
                      value={newProduct.description}
                      onChange={handleInputChange}
                      rows="4"
                      className="w-full border border-primary/20 bg-transparent rounded-lg px-4 py-2 focus:ring-2 focus:ring-primary/50 focus:border-primary outline-none transition-all resize-none text-textprimary"
                      placeholder="Detailed description of the product..."
                    />
                  </div>

                  <div>
                      <label className="block text-sm font-semibold text-textsecondary mb-1">Price (₹)</label>
                      <div className="relative">
                          <span className="absolute left-3 top-2 text-textmuted">₹</span>
                          <input
                            type="number"
                            name="price"
                            value={newProduct.price}
                            onChange={handleInputChange}
                            className="w-full border border-primary/20 bg-transparent rounded-lg pl-8 pr-4 py-2 focus:ring-2 focus:ring-primary/50 focus:border-primary outline-none transition-all text-textprimary"
                            placeholder="0.00"
                            required
                            min="0"
                            step="0.01"
                          />
                      </div>
                  </div>

                  <div>
                      <label className="block text-sm font-semibold text-textsecondary mb-1">Stock Quantity</label>
                      <input
                        type="number"
                        name="stock_qty"
                        value={newProduct.stock_qty}
                        onChange={handleInputChange}
                        className="w-full border border-primary/20 bg-transparent rounded-lg px-4 py-2 focus:ring-2 focus:ring-primary/50 focus:border-primary outline-none transition-all text-textprimary"
                        placeholder="0"
                        required
                        min="0"
                      />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-textsecondary mb-1">Seller</label>
                    <select
                      name="seller_id"
                      value={newProduct.seller_id}
                      onChange={handleInputChange}
                      className="w-full border border-primary/20 bg-sidebarbg rounded-lg px-4 py-2 focus:ring-2 focus:ring-primary/50 focus:border-primary outline-none transition-all text-textprimary"
                      required
                    >
                      <option value="">Select Seller</option>
                      {sellers.map(seller => (
                        <option key={seller.id} value={seller.id}>{seller.name} ({seller.email})</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-textsecondary mb-1">Product Images</label>
                    <input 
                        type="file" 
                        multiple 
                        onChange={(e) => setImages(e.target.files)} 
                        className="w-full text-sm text-textmuted file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20 transition-all cursor-pointer" 
                    />
                  </div>
              </div>

              <div className="flex justify-end gap-3 pt-6 border-t border-primary/10">
                <button
                  type="button"
                  className="px-6 py-2.5 border border-primary/20 rounded-lg text-textsecondary font-medium hover:bg-brandbg/10 transition-colors"
                  onClick={() => setShowAddModal(false)}
                  disabled={loading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-primary text-white rounded-lg font-medium hover:bg-primary/90 shadow-lg shadow-primary/30 transition-all disabled:opacity-70 disabled:shadow-none"
                  disabled={loading}
                >
                  {loading ? (
                      <span className="flex items-center gap-2">
                          <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Adding...
                      </span>
                  ) : "Add Product"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}