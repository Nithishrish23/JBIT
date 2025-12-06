
import React, { useState, useEffect } from "react";
import { Helmet } from "react-helmet";
import { Link } from "react-router-dom";
import api from "../../api/client";

export default function UserOrders() {
  const [orders, setOrders] = useState([]);
  const [modalOrder, setModalOrder] = useState(null);
  const [loadingInvoice, setLoadingInvoice] = useState(false);
  const [processingOrderId, setProcessingOrderId] = useState(null);

  useEffect(() => {
    api.get("/api/user/orders").then((res) => {
      setOrders(res.data);
    });
  }, []);

  const handlePayNow = async (orderId) => {
    setProcessingOrderId(orderId);
    try {
        const res = await api.post(`/api/user/orders/${orderId}/retry`, {
            payment_method: 'razorpay'
        });

        if (res.data.pg === 'razorpay') {
            const { razorpay_order_id, amount, currency, razorpay_key, order_id } = res.data;
            
            if (!window.Razorpay) {
                alert("Razorpay SDK not loaded.");
                setProcessingOrderId(null);
                return;
            }

            const options = {
                key: razorpay_key,
                amount: Math.round(amount * 100),
                currency: currency,
                name: "JB Solutions",
                description: "Complete Order Payment",
                order_id: razorpay_order_id,
                retry: {
                    enabled: false
                },
                handler: async function (response) {
                    try {
                        await api.post('/api/payments/razorpay/verify', {
                            order_id: order_id,
                            razorpay_order_id: response.razorpay_order_id,
                            razorpay_payment_id: response.razorpay_payment_id,
                            razorpay_signature: response.razorpay_signature
                        });
                        // Redirect to Success Page
                        window.location.href = `/payment-status?order_id=${order_id}&success=true`;
                    } catch (verifyErr) {
                        console.error(verifyErr);
                        alert("Payment verification failed.");
                        setProcessingOrderId(null);
                    }
                },
                theme: { color: "#3399cc" },
                modal: {
                    ondismiss: function() {
                        setProcessingOrderId(null);
                    }
                }
            };
            const rzp1 = new window.Razorpay(options);
            rzp1.on('payment.failed', function (response){
                api.post('/api/payments/failure', {
                    order_id: order_id,
                    reason: response.error.description,
                    payment_id: response.error.metadata.payment_id
                }).then(() => {
                     window.location.href = `/payment/failed?order_id=${order_id}&status=failed&reason=${encodeURIComponent(response.error.description)}`;
                });
            });
            rzp1.open();
        }
    } catch (err) {
        console.error(err);
        alert("Failed to initiate payment.");
        setProcessingOrderId(null);
    }
  };

  const viewInvoice = async (orderId) => {
    try {
      setLoadingInvoice(true);
      const res = await api.get(`/order/${orderId}/invoice`, { responseType: 'blob' });
      const blob = new Blob([res.data], { type: 'text/html' });
      const url = window.URL.createObjectURL(blob);
      window.open(url, '_blank');
      setLoadingInvoice(false);
    } catch (err) {
      setLoadingInvoice(false);
      console.error('Failed to load invoice', err);
      alert('Failed to load invoice');
    }
  };

  const openTrack = async (orderId) => {
    try {
      // Use the explicit track endpoint for delivery info
      const res = await api.get(`/order/${orderId}/track`);
      // The /order/:id/track endpoint returns { order_id, status, delivery_info }
      setModalOrder({
        id: res.data.order_id,
        status: res.data.status,
        payment_status: undefined,
        delivery_info: res.data.delivery_info,
      });
    } catch (err) {
      console.error('Failed to load order detail', err);
      alert('Failed to load order details');
    }
  };

  const cancelOrder = async (orderId) => {
    if(!window.confirm("Are you sure you want to cancel this order?")) return;
    try {
        await api.post(`/api/orders/${orderId}/cancel`);
        // Refresh orders
        const res = await api.get("/api/user/orders");
        setOrders(res.data);
        alert("Order cancelled successfully");
    } catch(err) {
        console.error("Failed to cancel order", err);
        alert("Failed to cancel order");
    }
  }

  return (
    <>
      <Helmet>
        <title>Your Orders</title>
      </Helmet>
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold">Your Orders</h1>
        <div className="bg-white rounded-xl shadow p-4 overflow-x-auto">
          <table className="w-full text-sm min-w-[600px]">
            <thead>
              <tr className="text-left">
                <th className="p-2">Order ID</th>
                <th className="p-2">Date</th>
                <th className="p-2">Products</th>
                <th className="p-2">Total</th>
                <th className="p-2">Status</th>
                <th className="p-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.id} className="border-t">
                  <td className="p-2">#{order.id}</td>
                  <td className="p-2">{new Date(order.created_at).toLocaleDateString()}</td>
                  <td className="p-2">
                    {order.items && order.items.length > 0 ? (
                        <div className="flex flex-col gap-2">
                            {order.items.map((item, idx) => (
                                <div key={idx}>
                                    <Link 
                                        to={`/product/${item.product_id}`}
                                        className="text-blue-600 hover:underline font-medium block"
                                    >
                                        {item.product_name}
                                    </Link>
                                    <div className="text-xs text-gray-500">Quantity: {item.quantity}</div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <span className="italic text-gray-400">No items</span>
                    )}
                  </td>
                  <td className="p-2">₹{Number(order.total || order.total_amount || 0).toFixed(2)}</td>
                  <td className="p-2">
                    <span className={`px-2 py-1 rounded-full text-xs ${
                        order.status === 'pending_payment' ? 'bg-yellow-100 text-yellow-800' :
                        order.status === 'paid' ? 'bg-green-100 text-green-800' :
                        order.status === 'cancelled' || order.status === 'payment_failed' ? 'bg-red-100 text-red-800' :
                        'bg-gray-100'
                    }`}>
                        {order.status === 'pending_payment' ? 'Pending Payment' : order.status === 'payment_failed' ? 'Payment Failed' : order.status}
                    </span>
                  </td>
                  <td className="p-2 space-x-3">
                    {order.status !== 'payment_failed' ? (
                      <>
                        {order.status === 'pending_payment' && (
                            <button 
                                onClick={() => handlePayNow(order.id)} 
                                disabled={processingOrderId === order.id}
                                className="text-blue-600 hover:underline font-medium disabled:text-blue-300"
                            >
                                {processingOrderId === order.id ? 'Processing...' : 'Pay Now'}
                            </button>
                        )}
                        <button onClick={() => viewInvoice(order.id)} className="text-gray-600 hover:underline">Invoice</button>
                        <button onClick={() => openTrack(order.id)} className="text-gray-600 hover:underline">Track</button>
                        {(order.status === 'pending' || order.status === 'pending_payment' || order.status === 'paid') && (
                            <button onClick={() => cancelOrder(order.id)} className="text-red-600 hover:underline">Cancel</button>
                        )}
                      </>
                    ) : (
                      null
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {modalOrder && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-lg w-full max-w-xl p-6">
              <h2 className="text-lg font-semibold mb-2">Order #{modalOrder.id}</h2>
              <p className="text-sm text-gray-600 mb-2">Status: <strong>{modalOrder.status}</strong></p>
              <p className="text-sm text-gray-600 mb-2">Payment: {modalOrder.payment_status}</p>
              <p className="text-sm text-gray-600 mb-4">Delivery Info: {modalOrder.delivery_info || 'No tracking info yet'}</p>
              <div className="flex justify-end gap-2">
                <button className="px-3 py-1 rounded border" onClick={() => { setModalOrder(null); }}>Close</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
