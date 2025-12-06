
import React, { useState, useEffect } from "react";
import { Helmet } from "react-helmet";
import { Link, useNavigate } from "react-router-dom";
import api from "../../api/client";
import { getImageUrl } from "../../utils/image";

export default function UserCart() {
  const [cart, setCart] = useState(null);
  const [couponCode, setCouponCode] = useState("");
  const [couponError, setCouponError] = useState("");
  const [couponSuccess, setCouponSuccess] = useState("");
  const navigate = useNavigate();

  const fetchCart = () => {
    api.get("/api/user/cart").then((res) => {
      setCart(res.data);
      if (res.data.coupon) {
          setCouponCode(res.data.coupon.code);
          setCouponSuccess(`Coupon applied! ${res.data.coupon.discount_percent}% OFF`);
      } else {
          setCouponCode("");
          setCouponSuccess("");
      }
    }).catch(() => setCart(null));
  };

  useEffect(() => {
    fetchCart();
  }, []);

  const handleRemoveItem = (itemId) => {
    api.delete(`/api/user/cart/items/${itemId}`).then(() => {
      fetchCart();
    });
  };

  const handleUpdateQuantity = (itemId, product_id, newQty) => {
      // Implement logic to update quantity on backend
      api.put(`/api/user/cart/items/${itemId}`, { quantity: newQty }).then(() => fetchCart()).catch(console.error);
  };

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

  if (!cart || cart.items.length === 0) {
    return (
      <>
        <Helmet><title>Your Cart</title></Helmet>
        <div className="flex flex-1 justify-center py-5">
            <div className="layout-content-container flex flex-col max-w-[960px] flex-1 px-4 text-center py-20">
                <h1 className="text-[#36454F] text-3xl font-bold">Your Cart is Empty</h1>
                <p className="text-[#6A737D] mt-2">Looks like you haven't added anything yet.</p>
                <Link to="/" className="mt-6 inline-block bg-[#8A9A5B] text-white px-6 py-3 rounded-lg font-bold hover:bg-[#4F7942] transition-colors">Continue Shopping</Link>
            </div>
        </div>
      </>
    )
  }

  const hasOutOfStockItems = cart.items.some(item => item.stock_qty === 0 || item.quantity > item.stock_qty);

  return (
    <>
      <Helmet>
        <title>Your Cart</title>
      </Helmet>
      <div className="font-display text-[#36454F] bg-[#F8F6F0] min-h-screen px-4 sm:px-6 lg:px-10 py-8">
        <div className="mx-auto max-w-7xl">
            <div className="flex flex-wrap justify-between gap-3 p-4">
                <h1 className="text-4xl font-black leading-tight tracking-tight min-w-72">Your Shopping Cart</h1>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mt-6">
                <div className="lg:col-span-2">
                    <div className="overflow-hidden rounded-xl border border-[#E0E0E0] bg-[#FFFFFF]">
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-[#F8F6F0]">
                                    <tr>
                                        <th className="px-6 py-4 text-left text-sm font-medium text-[#6A737D] uppercase tracking-wider w-2/5">Product</th>
                                        <th className="px-6 py-4 text-left text-sm font-medium text-[#6A737D] uppercase tracking-wider w-1/5">Price</th>
                                        <th className="px-6 py-4 text-left text-sm font-medium text-[#6A737D] uppercase tracking-wider w-1/5">Quantity</th>
                                        <th className="px-6 py-4 text-left text-sm font-medium text-[#6A737D] uppercase tracking-wider w-1/5">Subtotal</th>
                                        <th className="px-6 py-4 text-left text-sm font-medium text-[#6A737D]"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-[#E0E0E0]">
                                    {cart.items.map((item) => {
                                        const pImg = item.image_url ? getImageUrl(item.image_url) : "https://via.placeholder.com/100";
                                        const isOutOfStock = (item.stock_qty === 0 || item.quantity > item.stock_qty);
                                        return (
                                        <tr key={item.id} className={isOutOfStock ? 'opacity-50 bg-red-50' : ''}>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="flex items-center gap-4">
                                                    <div className="relative flex-shrink-0 h-16 w-16 bg-center bg-no-repeat bg-cover rounded-lg bg-gray-200" style={{backgroundImage: `url("${pImg}")`}}>
                                                        {isOutOfStock && (
                                                            <div className="absolute inset-0 bg-red-600 bg-opacity-75 flex items-center justify-center text-white text-xs font-bold p-1 rounded-lg">
                                                                OUT OF STOCK
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div>
                                                        <div className={`text-base font-semibold ${isOutOfStock ? 'text-red-700' : ''}`}>{item.product_name}</div>
                                                        {isOutOfStock && <div className="text-sm text-red-600 font-medium">Out of Stock!</div>}
                                                        <div className="text-sm text-[#6A737D]">Product ID: {item.product_id}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                                <div className="flex flex-col">
                                                    <span>₹{item.price.toFixed(2)}</span>
                                                    {item.mrp && item.mrp > item.price && <span className="text-xs text-gray-400 line-through">₹{item.mrp.toFixed(2)}</span>}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="flex items-center">
                                                    <button 
                                                        className="p-1 rounded-full text-[#C19A6B] hover:bg-[#C19A6B]/10"
                                                        onClick={() => handleUpdateQuantity(item.id, item.product_id, item.quantity - 1)}
                                                        disabled={isOutOfStock || item.quantity <= 1}
                                                    >-</button>
                                                    <input className="w-12 text-center bg-transparent border-0 focus:ring-0" type="text" value={item.quantity} readOnly/>
                                                    <button 
                                                        className="p-1 rounded-full text-[#C19A6B] hover:bg-[#C19A6B]/10"
                                                        onClick={() => handleUpdateQuantity(item.id, item.product_id, item.quantity + 1)}
                                                        disabled={isOutOfStock || item.quantity >= item.stock_qty} // Assuming cart item usually doesn't have stock_qty directly unless joined, relying on parent prop if passed or just disable if out
                                                    >+</button>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-[#C19A6B]">₹{(item.price * item.quantity).toFixed(2)}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                                <button onClick={() => handleRemoveItem(item.id)} className="p-2 rounded-full hover:bg-red-500/10 text-[#6A737D] hover:text-red-600">
                                                    <span className="material-symbols-outlined text-xl">delete</span>
                                                </button>
                                            </td>
                                        </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                        </div>
                        {hasOutOfStockItems && (
                            <div className="p-4 text-red-700 bg-red-100 rounded-b-xl text-sm font-medium flex items-center gap-2">
                                <span className="material-symbols-outlined text-xl">error</span>
                                Some items in your cart are out of stock.
                            </div>
                        )}
                    </div>
                    <Link to="/" className="inline-block text-[#8A9A5B] text-sm font-medium leading-normal p-4 underline hover:no-underline">Continue Shopping</Link>
                </div>
                <div className="lg:col-span-1">
                    <div className="bg-[#FFFFFF] rounded-xl border border-[#E0E0E0] p-6 sticky top-24">
                        <h2 className="text-2xl font-bold leading-tight tracking-tight pb-4 border-b border-[#E0E0E0]">Order Summary</h2>
                        
                        {/* Coupon Section */}
                        <div className="py-4 border-b border-[#E0E0E0]">
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
                        <button 
                            onClick={() => navigate('/checkout')} 
                            disabled={hasOutOfStockItems}
                            className="flex w-full mt-4 cursor-pointer items-center justify-center overflow-hidden rounded-lg h-12 bg-[#8A9A5B] text-white gap-2 text-base font-bold leading-normal tracking-wide hover:bg-[#8A9A5B]/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Proceed to Checkout
                        </button>
                        <div className="mt-6 text-center">
                            <p className="text-xs text-[#6A737D]">Items in your cart are not reserved.</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
      </div>
    </>
  );
}
