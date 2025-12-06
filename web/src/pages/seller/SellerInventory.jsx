
import React, { useState, useEffect } from "react";
import { Helmet } from "react-helmet";
import api from "../../api/client";

export default function SellerInventory() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProducts();
  }, []);

  const loadProducts = () => {
    setLoading(true);
    api.get("/api/seller/products")
      .then((res) => {
        setProducts(res.data);
      })
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  };

  const handleStockChange = (productId, newStock) => {
    const stockVal = parseInt(newStock, 10);
    if (isNaN(stockVal) || stockVal < 0) return;

    // Optimistic UI update
    setProducts(products.map(p => p.id === productId ? {...p, stock_qty: stockVal} : p));
    
    // API call to update stock
    api.put(`/api/seller/products/${productId}/stock`, { stock: stockVal })
       .then(() => {
           console.log('Stock updated');
       })
       .catch(err => {
           console.error('Failed to update stock', err);
           // Revert or reload on error could be added here
           loadProducts(); 
       });
  };

  return (
    <>
      <Helmet>
        <title>Inventory Management</title>
      </Helmet>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold text-slate-800">Inventory Management</h1>
            <button onClick={loadProducts} className="text-sm text-blue-600 hover:underline">Refresh</button>
        </div>
        
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
                <thead className="bg-gray-50 text-gray-600 font-medium border-b border-gray-200">
                <tr>
                    <th className="p-4">Product Name</th>
                    <th className="p-4">SKU</th>
                    <th className="p-4">Current Stock</th>
                    <th className="p-4">Update Stock</th>
                </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                {products.map((product) => (
                    <tr key={product.id} className="hover:bg-gray-50 transition-colors">
                    <td className="p-4 font-medium text-slate-900">{product.name}</td>
                    <td className="p-4 text-gray-500">{product.sku || '-'}</td>
                    <td className="p-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            product.stock_qty > 10 ? 'bg-green-100 text-green-800' : 
                            product.stock_qty > 0 ? 'bg-yellow-100 text-yellow-800' : 
                            'bg-red-100 text-red-800'
                        }`}>
                            {product.stock_qty}
                        </span>
                    </td>
                    <td className="p-4">
                        <div className="flex items-center gap-2">
                            <input 
                                type="number" 
                                min="0"
                                value={product.stock_qty} 
                                onChange={(e) => handleStockChange(product.id, e.target.value)} 
                                className="border border-gray-300 rounded-lg w-24 px-3 py-1.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-slate-700" 
                            />
                        </div>
                    </td>
                    </tr>
                ))}
                {products.length === 0 && !loading && (
                    <tr>
                        <td colSpan="4" className="p-8 text-center text-gray-500">No products found.</td>
                    </tr>
                )}
                </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}
