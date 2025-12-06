
import React, { useState, useEffect } from "react";
import { Helmet } from "react-helmet";
import { Link } from "react-router-dom";
import api from "../../api/client";
import { getImageUrl } from "../../utils/image";

export default function SellerProducts() {
  const [products, setProducts] = useState([]);

  useEffect(() => {
    api.get("/api/seller/products").then((res) => {
      setProducts(res.data);
    });
  }, []);

  return (
    <>
      <Helmet>
        <title>My Products</title>
      </Helmet>
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-semibold">My Products</h1>
          <Link to="/seller/products/add" className="bg-slate-900 text-white px-4 py-2 rounded-lg text-sm">
            Add New Product
          </Link>
        </div>
        <div className="bg-white rounded-xl shadow p-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left">
                <th className="p-2">Image</th>
                <th className="p-2">Name</th>
                <th className="p-2">Price</th>
                <th className="p-2">Stock</th>
                <th className="p-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {products.map((product) => (
                <tr key={product.id} className="border-t">
                  <td className="p-2">
                      <img src={getImageUrl(product.images && product.images.length > 0 ? product.images[0].download_url : null)} alt={product.name} className="w-10 h-10 object-cover rounded bg-gray-100" onError={e => e.target.src=getImageUrl(null)} />
                  </td>
                  <td className="p-2">{product.name}</td>
                  <td className="p-2">₹{Number(product.price).toFixed(2)}</td>
                  <td className="p-2">{product.stock_qty || product.stock}</td>
                  <td className="p-2">{product.is_approved ? 'Approved' : 'Pending'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
