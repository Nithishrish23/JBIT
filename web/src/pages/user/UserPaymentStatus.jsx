
import React, { useState, useEffect } from "react";
import { Helmet } from "react-helmet";
import { useSearchParams, Link } from "react-router-dom";
import api from "../../api/client";

export default function UserPaymentStatus() {
  const [searchParams] = useSearchParams();
  const orderId = searchParams.get("order_id");
  const statusParam = searchParams.get("status");
  const reasonParam = searchParams.get("reason");
  
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [retryLoading, setRetryLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const fetchOrder = () => {
    setLoading(true);
    if (orderId) {
        api.get(`/api/user/orders/${orderId}`)
          .then(async (res) => {
            let fetchedOrder = res.data;
            // If URL says success but DB says unpaid, try to sync
            const isSuccessUrl = new URLSearchParams(window.location.search).get("success") === "true";
            const isFailedParam = new URLSearchParams(window.location.search).get("status") === "failed";
            
            if (isSuccessUrl && !isFailedParam && fetchedOrder.payment_status !== 'paid') {
                setSyncing(true);
                try {
                    const syncRes = await api.post(`/api/user/orders/${fetchedOrder.id}/sync_payment`);
                    if (syncRes.data.status === 'paid') {
                        fetchedOrder = { ...fetchedOrder, payment_status: 'paid', status: 'paid' };
                    }
                } catch(e) {
                    console.error("Sync failed", e);
                } finally {
                    setSyncing(false);
                }
            }
            setOrder(fetchedOrder);
            setLoading(false);
          })
          .catch(() => setLoading(false));
      } else {
        setLoading(false);
      }
  };

  useEffect(() => {
    if (orderId && statusParam === 'failed') {
        // Report failure to backend
        api.post('/api/payments/failure', { 
            order_id: orderId, 
            reason: reasonParam || 'Payment failed at gateway' 
        }).catch(err => console.error("Failed to report payment failure", err));
    }
    fetchOrder();
  }, [orderId, statusParam]);

  const handleRetryPayment = async () => {
    if (!order) return;
    setRetryLoading(true);
    try {
        const res = await api.post(`/api/user/orders/${order.id}/retry`, {
            payment_method: 'razorpay' // Defaulting to razorpay for retry
        });

        if (res.data.pg === 'razorpay') {
            const { razorpay_order_id, amount, currency, razorpay_key, order_id } = res.data;
            
            if (!window.Razorpay) {
                alert("Razorpay SDK not loaded.");
                setRetryLoading(false);
                return;
            }

            const options = {
                key: razorpay_key,
                amount: Math.round(amount * 100),
                currency: currency,
                name: "JB Solutions",
                description: "Retry Order Payment",
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
                        // Reload page to show success state
                        window.location.href = `/payment-status?order_id=${order_id}&success=true`;
                    } catch (verifyErr) {
                        console.error(verifyErr);
                        alert("Verification failed");
                    }
                },
                theme: { color: "#3399cc" },
                modal: {
                    ondismiss: function() {
                        setRetryLoading(false);
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
        alert("Failed to initiate retry.");
    } finally {
        setRetryLoading(false);
    }
  };

  // Determine if we show success or failure
  // If status param is 'failed', show failed.
  // If order is loaded and payment_status is 'paid', show success.
  // If order is loaded and payment_status is 'unpaid', show failed/retry.
  
  const isPaid = order && order.payment_status === 'paid';
  const isPendingPayment = order && order.status === 'pending_payment';
  const isFailed = statusParam === 'failed' || (order && order.payment_status !== 'paid');

  return (
    <>
      <Helmet>
        <title>Payment Status</title>
      </Helmet>
      <div className="max-w-4xl mx-auto p-6">
        <div className="bg-white rounded-xl shadow-lg overflow-hidden">
            {loading || syncing ? (
                <div className="p-10 text-center">
                    <p>{syncing ? "Verifying payment with bank..." : "Loading order details..."}</p>
                </div>
            ) : !order ? (
                <div className="p-10 text-center text-red-500">Order not found.</div>
            ) : isPaid ? (
                // SUCCESS VIEW
                <div>
                    <div className="bg-green-50 p-8 text-center border-b border-green-100">
                        <div className="mx-auto w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-4">
                            <span className="material-symbols-outlined text-3xl">check_circle</span>
                        </div>
                        <h1 className="text-2xl font-bold text-green-800 mb-2">Order Placed Successfully!</h1>
                        <p className="text-green-700">Order #{order.id}</p>
                        <p className="text-sm text-green-600 mt-2">Thank you for shopping with us.</p>
                        
                        <div className="mt-6">
                            <Link to="/orders" className="inline-block bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 transition-colors">
                                Go to My Orders
                            </Link>
                        </div>
                    </div>
                    
                    {/* Tracking Section */}
                    <div className="p-6 border-b">
                        <h2 className="text-lg font-semibold mb-4">Tracking Status</h2>
                        {order.tracking ? (
                            <div className="bg-slate-50 p-4 rounded-lg">
                                <div className="flex justify-between items-center mb-4">
                                    <div>
                                        <p className="text-sm text-gray-500">Tracking ID</p>
                                        <p className="font-mono font-medium">{order.tracking.tracking_id}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-sm text-gray-500">Estimated Delivery</p>
                                        <p className="font-medium">{order.tracking.estimated_delivery}</p>
                                    </div>
                                </div>
                                <div className="space-y-4">
                                    {order.tracking.history.map((event, idx) => (
                                        <div key={idx} className="flex gap-4">
                                            <div className="flex flex-col items-center">
                                                <div className="w-3 h-3 bg-blue-600 rounded-full"></div>
                                                {idx < order.tracking.history.length - 1 && <div className="w-0.5 h-full bg-blue-200 my-1"></div>}
                                            </div>
                                            <div>
                                                <p className="font-medium text-sm">{event.status}</p>
                                                <p className="text-xs text-gray-500">{new Date(event.timestamp).toLocaleString()}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ) : (
                            <p className="text-gray-500">Tracking information pending.</p>
                        )}
                    </div>

                    {/* Order Items */}
                    <div className="p-6">
                        <h2 className="text-lg font-semibold mb-4">Order Summary</h2>
                        <div className="space-y-3">
                            {order.items && order.items.map((item, idx) => (
                                <div key={idx} className="flex justify-between text-sm border-b pb-2 last:border-0">
                                    <span>{item.product_name} <span className="text-gray-500">x{item.quantity}</span></span>
                                    <span>₹{item.subtotal.toFixed(2)}</span>
                                </div>
                            ))}
                            <div className="flex justify-between font-bold pt-2">
                                <span>Total</span>
                                <span>₹{order.total_amount.toFixed(2)}</span>
                            </div>
                        </div>
                        <div className="mt-6 text-center">
                            <Link to="/orders" className="text-blue-600 hover:underline">View All Orders</Link>
                        </div>
                    </div>
                </div>
            ) : (
                // FAILED / PENDING VIEW
                <div className="p-8 text-center">
                    <div className={`mx-auto w-16 h-16 rounded-full flex items-center justify-center mb-4 ${isPendingPayment ? 'bg-yellow-100 text-yellow-600' : 'bg-red-100 text-red-600'}`}>
                        <span className="material-symbols-outlined text-3xl">{isPendingPayment ? 'payments' : 'error'}</span>
                    </div>
                    <h1 className={`text-2xl font-bold mb-2 ${isPendingPayment ? 'text-yellow-800' : 'text-red-700'}`}>
                        {isPendingPayment ? "Complete Your Payment" : "Payment Failed"}
                    </h1>
                    <p className="text-gray-600 mb-4">
                        {reasonParam || (isPendingPayment ? "Your order is pending. Please complete the payment to proceed." : "Your payment didn't go through. Please try again.")}
                    </p>
                    
                    <div className="bg-gray-50 p-4 rounded-lg mb-6 max-w-md mx-auto">
                        <h3 className="font-semibold text-sm mb-2">Order Summary</h3>
                        <p className="text-sm">Order #{order.id}</p>
                        <p className="font-bold mt-1">Total: ₹{order.total_amount.toFixed(2)}</p>
                    </div>

                    <div className="flex flex-col gap-3 max-w-xs mx-auto">
                        <button 
                            onClick={handleRetryPayment} 
                            disabled={retryLoading}
                            className="bg-slate-900 text-white py-2 px-4 rounded-lg hover:bg-slate-800 disabled:bg-slate-400 transition-colors"
                        >
                            {retryLoading ? "Processing..." : (isPendingPayment ? "Pay Now" : "Retry Payment")}
                        </button>
                        <Link to="/support" className="text-sm text-gray-500 hover:text-gray-800">Contact Support</Link>
                        <Link to="/orders" className="text-sm text-blue-600 hover:underline">Go to My Orders</Link>
                    </div>
                </div>
            )}
        </div>
      </div>
    </>
  );
}
