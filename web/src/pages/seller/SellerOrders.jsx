
import React, { useState, useEffect } from "react";
import { Helmet } from "react-helmet";
import api from "../../api/client";

export default function SellerOrders() {
  const [orders, setOrders] = useState([]);
  const [editOrder, setEditOrder] = useState(null);
  const [formStatus, setFormStatus] = useState("");
  const [formDeliveryInfo, setFormDeliveryInfo] = useState("");

  const fetchOrders = () => {
    api.get("/api/seller/orders").then((res) => {
      setOrders(res.data);
    });
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  const openEdit = (order) => {
    setEditOrder(order);
    setFormStatus(order.status);
    // Note: current API for seller orders doesn't return delivery_info in the list, 
    // but we can default to empty or fetch detail if needed. 
    // For simplicity, we start empty or use what we have if we expanded the API.
    setFormDeliveryInfo(""); 
  };

  const handleSave = async () => {
    if (!editOrder) return;
    try {
        await api.put(`/api/orders/${editOrder.order_id}/status`, {
            status: formStatus,
            delivery_info: formDeliveryInfo
        });
        alert("Order updated");
        setEditOrder(null);
        fetchOrders();
    } catch (err) {
        console.error("Failed to update order", err);
        alert("Failed to update order");
    }
  };

  return (
    <>
      <Helmet>
        <title>Seller Orders</title>
      </Helmet>
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold">Seller Orders</h1>
        <div className="bg-white rounded-xl shadow p-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left">
                <th className="p-2">Order ID</th>
                <th className="p-2">Product</th>
                <th className="p-2">Quantity</th>
                <th className="p-2">Total Price</th>
                <th className="p-2">Status</th>
                <th className="p-2">Action</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((item, idx) => (
                <tr key={idx} className="border-t">
                  <td className="p-2">#{item.order_id}</td>
                  <td className="p-2">{item.product_name}</td>
                  <td className="p-2">{item.quantity}</td>
                  <td className="p-2">₹{item.price.toFixed(2)}</td>
                  <td className="p-2">
                    <span className={`px-2 py-1 rounded text-xs ${
                        item.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                        item.status === 'shipped' ? 'bg-blue-100 text-blue-800' :
                        item.status === 'delivered' ? 'bg-green-100 text-green-800' :
                        'bg-gray-100'
                    }`}>
                        {item.status}
                    </span>
                  </td>
                  <td className="p-2">
                    <button onClick={() => openEdit(item)} className="text-blue-600 hover:underline">Update</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {editOrder && (
            <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
                <div className="bg-white rounded-lg shadow-lg w-full max-w-md p-6 space-y-4">
                    <h2 className="text-lg font-bold">Update Order #{editOrder.order_id}</h2>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Status</label>
                        <select 
                            className="w-full border rounded px-3 py-2 mt-1"
                            value={formStatus}
                            onChange={e => setFormStatus(e.target.value)}
                        >
                            <option value="pending">Pending</option>
                            <option value="shipped">Shipped</option>
                            <option value="delivered">Delivered</option>
                            <option value="cancelled">Cancelled</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Delivery Info / Tracking</label>
                        <textarea 
                            className="w-full border rounded px-3 py-2 mt-1 h-24"
                            value={formDeliveryInfo}
                            onChange={e => setFormDeliveryInfo(e.target.value)}
                            placeholder="e.g. Fedex #123456789"
                        />
                    </div>
                    <div className="flex justify-end gap-2 pt-2">
                        <button 
                            className="px-4 py-2 border rounded text-gray-600"
                            onClick={() => setEditOrder(null)}
                        >
                            Cancel
                        </button>
                        <button 
                            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                            onClick={handleSave}
                        >
                            Save Changes
                        </button>
                    </div>
                </div>
            </div>
        )}
      </div>
    </>
  );
}
