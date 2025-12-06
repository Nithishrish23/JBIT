import React, { useState, useEffect } from "react";
import { Helmet } from "react-helmet";
import { useNavigate, Link } from "react-router-dom";
import api from "../../api/client";

export default function UserCheckout() {
  const [cart, setCart] = useState(null);
  const [addresses, setAddresses] = useState([]);
  const [selectedAddressId, setSelectedAddressId] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState('pay_later');
  const [couponCode, setCouponCode] = useState("");
  const [couponError, setCouponError] = useState("");
  const [couponSuccess, setCouponSuccess] = useState("");
  const navigate = useNavigate();

  const fetchCart = () => {
    api.get("/api/user/cart").then((res) => {
      if (!res.data || res.data.items.length === 0) {
        navigate("/cart"); // Redirect if cart is empty
      } else {
        setCart(res.data);
        if (res.data.coupon) {
            setCouponCode(res.data.coupon.code);
            setCouponSuccess(`Coupon applied! ${res.data.coupon.discount_percent}% OFF`);
        } else {
            setCouponCode("");
            setCouponSuccess("");
        }
      }
    });
  };

  useEffect(() => {
    fetchCart();

    api.get("/api/user/addresses").then((res) => {
      setAddresses(res.data);
      if (res.data.length > 0) {
        const defaultAddress = res.data.find(addr => addr.is_default);
        if (defaultAddress) {
          setSelectedAddressId(defaultAddress.id);
        } else {
          setSelectedAddressId(res.data[0].id); // Fallback to first address if no default
        }
      } else {
        navigate("/addresses?redirect=checkout");
      }
    });
  }, [navigate]);

  const handleApplyCoupon = () => {
      if (!couponCode.trim()) return;
      setCouponError("");
      setCouponSuccess("");
      api.post('/api/cart/apply-coupon', { code: couponCode })
        .then(() => {
            fetchCart();
        })
        .catch(err => {
            setCouponError(err.response?.data?.error || "Invalid Coupon");
            setCouponSuccess("");
        });
  };

  const handleRemoveCoupon = () => {
      api.post('/api/cart/remove-coupon').then(() => {
          fetchCart();
          setCouponCode("");
          setCouponSuccess("");
          setCouponError("");
      });
  };


  const handlePlaceOrder = async () => {
    if (!selectedAddressId) {
      alert("Please select a shipping address.");
      return;
    }

    try {
        const res = await api.post('/api/user/orders', {
            address_id: selectedAddressId,
            payment_method: paymentMethod
        });

        if (paymentMethod === 'pay_later' || paymentMethod === 'cod') {
            navigate("/orders"); // Redirect directly to orders page as requested
        } else if (paymentMethod === 'stripe') {
            // Initiate Stripe
            const { client_secret, publishable_key } = await api.post('/api/payments/initiate/stripe', { order_id: res.data.order_id }).then(r => r.data);
            
            // For Stripe, we typically use Elements. For simplicity in this prototype, we'll alert.
            // In a real app, you'd redirect to a dedicated Stripe payment page or render Elements here.
            // Since we don't have the full Elements setup in this single file easily without context:
            alert("Stripe integration ready. In a real app, this would open the Stripe Payment Element. Mocking success for prototype.");
            // Verify manually (mock)
            // navigate(`/payment-status?order_id=${res.data.order_id}&success=true`);
            
        } else if (paymentMethod === 'razorpay' || paymentMethod === 'upi') {
            const { razorpay_order_id, amount, currency, razorpay_key, order_id, method_preference } = res.data;
            
            if (!window.Razorpay) {
                alert("Razorpay SDK not loaded. Please refresh the page.");
                return;
            }

            const options = {
                key: razorpay_key,
                amount: Math.round(amount * 100), // Amount in paise, rounded to avoid float issues
                currency: currency,
                name: "JB Solutions",
                description: "Order Payment",
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
                        navigate(`/payment-status?order_id=${order_id}&success=true`);
                    } catch (verifyErr) {
                        console.error(verifyErr);
                        alert("Payment verification failed. Please contact support.");
                    }
                },
                prefill: {
                    // You might want to fetch user details to prefill here
                    name: "Valued Customer",
                    email: "",
                    contact: "",
                    method: method_preference // 'upi' if selected
                },
                theme: {
                    color: "#3399cc"
                }
            };
            
            if (method_preference === 'upi') {
                // Optional: You can force specific config for UPI if needed, 
                // but usually prefill.method is enough or Razorpay handles it.
            }
            
            const rzp1 = new window.Razorpay(options);
            rzp1.on('payment.failed', function (response){
                api.post('/api/payments/failure', {
                    order_id: order_id,
                    reason: response.error.description,
                    payment_id: response.error.metadata.payment_id
                }).then(() => {
                    navigate(`/payment/failed?order_id=${order_id}&status=failed&reason=${encodeURIComponent(response.error.description)}`);
                });
            });
            rzp1.open();
        }
    } catch (err) {
        console.error(err);
        alert("Failed to place order. " + (err.response?.data?.description || err.message));
    }
  };

  if (!cart) return <div>Loading...</div>;

  return (
    <>
      <Helmet>
        <title>Checkout</title>
      </Helmet>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="md:col-span-2 bg-white rounded-xl shadow p-5 space-y-6">
          <div>
            <h1 className="text-xl font-semibold mb-4">Select Shipping Address</h1>
            {addresses.length > 0 ? (
              <div className="space-y-3">
                {addresses.map(addr => (
                  <label key={addr.id} className="flex items-center gap-4 border rounded-lg p-3 cursor-pointer">
                    <input type="radio" name="address" value={addr.id} checked={selectedAddressId === addr.id} onChange={() => setSelectedAddressId(addr.id)} />
                    <div className="text-sm">
                      <p>{addr.address_line_1}, {addr.city}, {addr.state} - {addr.postal_code}</p>
                    </div>
                  </label>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500">No addresses found. <Link to="/addresses" className="text-blue-600">Add one here.</Link></p>
            )}
          </div>
          
          <div>
            <h1 className="text-xl font-semibold mb-4">Payment Method</h1>
            <div className="space-y-3">
                <label className="flex items-center gap-4 border rounded-lg p-3 cursor-pointer">
                    <input type="radio" name="payment" value="pay_later" checked={paymentMethod === 'pay_later'} onChange={() => setPaymentMethod('pay_later')} />
                    <span className="text-sm font-medium">Cash on Delivery (COD)</span>
                </label>
                <label className="flex items-center gap-4 border rounded-lg p-3 cursor-pointer">
                    <input type="radio" name="payment" value="razorpay" checked={paymentMethod === 'razorpay'} onChange={() => setPaymentMethod('razorpay')} />
                    <span className="text-sm font-medium">Pay with Razorpay (Cards, Netbanking)</span>
                </label>
                <label className="flex items-center gap-4 border rounded-lg p-3 cursor-pointer">
                    <input type="radio" name="payment" value="stripe" checked={paymentMethod === 'stripe'} onChange={() => setPaymentMethod('stripe')} />
                    <span className="text-sm font-medium">Pay with Stripe</span>
                </label>
                <label className="flex items-center gap-4 border rounded-lg p-3 cursor-pointer">
                    <input type="radio" name="payment" value="upi" checked={paymentMethod === 'upi'} onChange={() => setPaymentMethod('upi')} />
                    <span className="text-sm font-medium">Pay with UPI</span>
                </label>
            </div>
          </div>

        </div>
        <div className="md:col-span-1">
            <div className="bg-white rounded-xl shadow p-5 space-y-4">
                <h2 className="text-lg font-semibold">Order Summary</h2>
                {cart.items.map(item => (
                    <div key={item.id} className="flex justify-between text-sm">
                        <span>{item.product_name} x {item.quantity}</span>
                        <span>₹{(item.price * item.quantity).toFixed(2)}</span>
                    </div>
                ))}

                {/* Coupon Section */}
                <div className="py-4 border-t border-b border-[#E0E0E0]">
                    <label className="text-xs font-bold text-[#6A737D] uppercase tracking-wider mb-2 block">Promo Code</label>
                    <div className="flex gap-2">
                        <input 
                            type="text" 
                            placeholder="Enter code" 
                            value={couponCode}
                            onChange={(e) => setCouponCode(e.target.value)}
                            disabled={!!cart.coupon}
                            className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#8A9A5B]"
                        />
                        {cart.coupon ? (
                            <button onClick={handleRemoveCoupon} className="px-4 py-2 bg-red-50 text-red-600 rounded-lg text-sm font-bold hover:bg-red-100">Remove</button>
                        ) : (
                            <button onClick={handleApplyCoupon} className="px-4 py-2 bg-slate-800 text-white rounded-lg text-sm font-bold hover:bg-slate-900">Apply</button>
                        )}
                    </div>
                    {couponError && <p className="text-red-500 text-xs mt-2">{couponError}</p>}
                    {couponSuccess && <p className="text-green-600 text-xs mt-2">{couponSuccess}</p>}
                </div>
                
                <div className="py-4 space-y-3 border-b border-[#E0E0E0]">
                    <div className="flex justify-between">
                        <p className="text-[#6A737D]">Subtotal</p>
                        <p className="font-medium">₹{cart.total.toFixed(2)}</p>
                    </div>
                    {cart.discount > 0 && (
                        <div className="flex justify-between text-green-600">
                            <p>Discount</p>
                            <p className="font-medium">-₹{cart.discount.toFixed(2)}</p>
                        </div>
                    )}
                    <div className="flex justify-between">
                        <p className="text-[#6A737D]">Shipping</p>
                        <p className="font-medium">Free</p>
                    </div>
                </div>
                <div className="flex justify-between items-center py-4">
                    <p className="text-lg font-bold">Order Total</p>
                    <p className="text-2xl font-black text-[#8A9A5B]">₹{(cart.final_total || cart.total).toFixed(2)}</p>
                </div>
                <button onClick={handlePlaceOrder} disabled={!selectedAddressId} className="w-full text-center bg-slate-900 text-white rounded py-2 text-sm disabled:bg-slate-400 hover:bg-slate-800 transition-colors">
                    Place Order
                </button>
            </div>
        </div>
      </div>
    </>
  );
}