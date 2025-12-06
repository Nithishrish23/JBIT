
import React, { useState, useEffect } from "react";
import { Helmet } from "react-helmet";
import { Link } from "react-router-dom";
import api from "../../api/client";
import { getImageUrl } from "../../utils/image";

export default function UserWishlist() {
  const [items, setItems] = useState([]);

  const fetchWishlist = () => {
    api.get("/api/user/wishlist")
      .then((res) => {
        setItems(res.data || []);
      })
      .catch((err) => {
        console.error('Failed to load wishlist', err);
        setItems([]);
      });
  };

  useEffect(() => {
    fetchWishlist();
  }, []);

  const handleRemove = (wishlistItemId) => {
    api.delete(`/api/user/wishlist/${wishlistItemId}`)
      .then(() => {
        fetchWishlist();
      })
      .catch((err) => {
        console.error('Failed to remove from wishlist', err);
        alert('Failed to remove item from wishlist');
      });
  };

  const handleAddToCart = (productId) => {
      api.post('/api/user/cart/items', { product_id: productId, quantity: 1 })
      .then(() => {
          alert('Added to cart');
          navigate(`/product/${productId}`);
      })
      .catch(() => alert('Failed to add to cart'));
  }

  return (
    <>
      <Helmet>
        <title>Your Wishlist</title>
      </Helmet>
      <div className="font-display text-[#1C1B1A] bg-[#FDFBF7] min-h-screen flex flex-col gap-8 py-8 px-4 sm:px-10">
        <div className="max-w-7xl mx-auto w-full space-y-8">
            <div className="flex flex-wrap justify-between items-center gap-4">
                <div className="flex flex-col gap-2">
                    <p className="text-4xl font-black leading-tight tracking-tight">My Wishlist</p>
                    <p className="text-[#6b7280] text-base font-normal">{items.length > 0 ? `You have ${items.length} items saved` : 'Your wishlist is empty'}</p>
                </div>
                <Link to="/addresses" className="text-blue-600 font-bold hover:underline flex items-center gap-1">
                    <span className="material-symbols-outlined">location_on</span>
                    Manage Addresses
                </Link>
            </div>

            {/* Toolbar */}
            <div className="flex flex-col sm:flex-row justify-between items-center gap-4 px-4 py-3 border-y border-black/10">
                <div className="flex items-center gap-2">
                    <button className="p-2 flex items-center gap-2 rounded-lg hover:bg-black/5 text-[#1C1B1A]">
                        <span className="material-symbols-outlined text-xl">filter_list</span>
                        <span className="text-sm font-medium">Filter</span>
                    </button>
                    <button className="p-2 flex items-center gap-2 rounded-lg hover:bg-black/5 text-[#1C1B1A]">
                        <span className="material-symbols-outlined text-xl">swap_vert</span>
                        <span className="text-sm font-medium">Sort</span>
                    </button>
                </div>
                <div className="flex items-center gap-2">
                    {items.length > 0 && (
                        <button className="flex min-w-[84px] cursor-pointer items-center justify-center overflow-hidden rounded-lg h-10 px-4 bg-[#4CAF50] text-white text-sm font-bold tracking-wide">
                            <span className="truncate">Add All to Cart</span>
                        </button>
                    )}
                </div>
            </div>

            {/* Grid */}
            <div className="grid grid-cols-[repeat(auto-fill,minmax(250px,1fr))] gap-6">
                {items.map((item) => {
                    const productImageUrl = (item.product?.images && item.product.images.length > 0) 
                                            ? getImageUrl(item.product.images[0].download_url) 
                                            : getImageUrl(null);
                    return (
                        <div key={item.id} className="flex flex-col group bg-white rounded-xl overflow-hidden shadow-sm border border-black/5 hover:shadow-md transition-shadow">
                            <div className="relative w-full bg-center bg-no-repeat aspect-square bg-cover overflow-hidden">
                                <img 
                                    src={productImageUrl} 
                                    alt={item.product?.name || 'Product Image'} 
                                    className="w-full h-full object-cover"
                                    onError={(e) => e.target.src = getImageUrl(null)}
                                />
                                {item.product?.stock_qty === 0 && (
                                    <div className="absolute inset-0 bg-red-600 bg-opacity-75 flex items-center justify-center text-white font-bold text-lg pointer-events-none z-10">
                                        NO STOCK
                                    </div>
                                )}
                                <button 
                                    onClick={() => handleRemove(item.id)}
                                    className="absolute top-3 right-3 flex items-center justify-center size-8 rounded-full bg-white/80 backdrop-blur-sm text-[#1C1B1A] opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white"
                                >
                                    <span className="material-symbols-outlined text-xl">close</span>
                                </button>
                            </div>
                            <div className="p-4 flex flex-col gap-4 flex-grow">
                                <div className="flex flex-col gap-1">
                                    <Link to={`/product/${item.product?.id || ''}`} className="text-[#1C1B1A] text-base font-medium leading-normal hover:underline line-clamp-1">
                                        {item.product?.name || 'Unknown Product'}
                                    </Link>
                                    <p className="text-[#6b7280] text-sm font-normal">In Stock</p>
                                </div>
                                <p className="text-[#1C1B1A] text-lg font-bold leading-normal">₹{Number(item.product?.price || 0).toFixed(2)}</p>
                                <button 
                                    onClick={() => handleAddToCart(item.product?.id)}
                                    className="flex mt-auto w-full cursor-pointer items-center justify-center overflow-hidden rounded-lg h-10 px-4 bg-[#2196F3] text-white text-sm font-bold tracking-wide hover:bg-blue-600 transition-colors"
                                >
                                    Add to Cart
                                </button>
                            </div>
                        </div>
                    );
                })}
            
                {items.length === 0 && (
                    <div className="col-span-full text-center py-10">
                        <p className="text-[#6b7280]">Start saving your favorite items!</p>
                        <Link to="/" className="text-blue-600 hover:underline mt-2 inline-block">Browse Products</Link>
                    </div>
                )}
            </div>
        </div>
      </div>
    </>  );
}
