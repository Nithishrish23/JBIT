import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import api from '../../api/client';
import SeoHelmet from '../../components/SeoHelmet'; // Import SeoHelmet

export default function UserProductDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [product, setProduct] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [activeTab, setActiveTab] = useState('description');
  const [mainImage, setMainImage] = useState('');
  const [reviews, setReviews] = useState([]);
  const [reviewForm, setReviewForm] = useState({ rating: 5, comment: '' });
  const [submittingReview, setSubmittingReview] = useState(false);

  const fetchReviews = () => {
      api.get(`/api/products/${id}/reviews`)
        .then(res => setReviews(res.data))
        .catch(err => console.error("Failed to load reviews", err));
  };

  useEffect(() => {
    if (id) {
      api.get(`/api/products/${id}`)
        .then(response => {
          setProduct(response.data);
          if (response.data.images && response.data.images.length > 0) {
            setMainImage(response.data.images[0].download_url);
          }
        })
        .catch(error => {
          console.error("Failed to fetch product", error);
          setProduct(null);
        });
      fetchReviews();
    }
  }, [id]);

  const getFullUrl = (url) => {
      if (!url) return 'https://via.placeholder.com/600x400?text=No+Image';
      if (url.startsWith('http')) return url;
      return `http://localhost:5000${url}`;
  };

  const handleAddToCart = () => {
    if (!localStorage.getItem('access_token')) {
        alert("Please login to add to cart");
        navigate('/login');
        return;
    }
    api.post('/api/user/cart/items', { product_id: id, quantity: quantity })
      .then(() => {
        alert(`${product?.name || 'Product'} has been added to your cart!`);
      })
      .catch((err) => {
        console.error('Add to cart failed', err);
        alert('Failed to add to cart');
      });
  };

  const handleBuyNow = () => {
      if (!localStorage.getItem('access_token')) {
          alert("Please login to buy");
          navigate('/login');
          return;
      }
      // Add to cart then redirect to checkout
      api.post('/api/user/cart/items', { product_id: id, quantity: quantity })
      .then(() => {
        navigate('/checkout');
      })
      .catch((err) => {
        console.error('Buy now failed', err);
        alert('Failed to proceed');
      });
  }

  const submitReview = (e) => {
      e.preventDefault();
      if (!localStorage.getItem('access_token')) {
          alert("Please login to submit a review");
          navigate('/login');
          return;
      }
      setSubmittingReview(true);
      api.post(`/api/products/${id}/reviews`, reviewForm)
          .then(() => {
              alert("Review submitted!");
              setReviewForm({ rating: 5, comment: '' });
              fetchReviews();
              // Refresh product to get updated rating
              api.get(`/api/products/${id}`).then(res => setProduct(res.data));
          })
          .catch((err) => {
              console.error(err);
              alert(err.response?.data?.description || "Failed to submit review");
          })
          .finally(() => setSubmittingReview(false));
  }

  if (!product) {
    return <div className="p-10 text-center">Loading product details...</div>;
  }

  const images = product.images && product.images.length > 0 
    ? product.images.map(img => img.download_url) 
    : [];

  const productSeoData = {
    name: product.name,
    description: product.description,
    images: images.map(img => ({ url: getFullUrl(img) })),
    sku: product.sku || '',
    brandName: product.seller?.name || 'Generic',
    url: window.location.href,
    price: product.price,
    inStock: product.stock_qty > 0
  };

  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const hasReviewed = reviews.some(r => r.user_id === user.id);

  return (
    <>
      <SeoHelmet
        title={product.name}
        description={product.description}
        imageUrl={getFullUrl(mainImage || images[0])}
        productData={productSeoData}
      />
      
      <div className="font-sans text-slate-900 bg-white min-h-screen">
        <div className="flex flex-col w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            {/* Breadcrumbs */}
            <div className="flex flex-wrap gap-2 py-4 text-sm font-medium text-slate-500">
                <Link to="/" className="hover:text-blue-600 transition-colors">Home</Link>
                <span>/</span>
                <Link to="/search" className="hover:text-blue-600 transition-colors">Shop</Link>
                <span>/</span>
                <span className="text-slate-900">{product.name}</span>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 mt-4">
                {/* Left Column: Images */}
                <div className="flex flex-col gap-4 sticky top-24 self-start">
                    <div 
                        className="w-full bg-white rounded-xl border border-slate-200 aspect-[4/3] overflow-hidden relative group p-4 flex items-center justify-center cursor-zoom-in"
                        onMouseMove={(e) => {
                            const { left, top, width, height } = e.currentTarget.getBoundingClientRect();
                            const x = ((e.clientX - left) / width) * 100;
                            const y = ((e.clientY - top) / height) * 100;
                            e.currentTarget.style.setProperty('--zoom-origin', `${x}% ${y}%`);
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.removeProperty('--zoom-origin');
                        }}
                    >
                        <img 
                            src={getFullUrl(mainImage || images[0])}
                            alt={product.name}
                            className="max-w-full max-h-full object-contain transition-transform duration-200 group-hover:scale-150 origin-[var(--zoom-origin,center)]"
                            onError={(e) => e.target.src = 'https://via.placeholder.com/600x400?text=Product+Image'}
                        />
                    </div>
                    {images.length > 0 && (
                        <div className="grid grid-cols-5 gap-3">
                            {images.map((img, idx) => (
                                <div 
                                    key={idx}
                                    onClick={() => setMainImage(img)}
                                    className={`w-full bg-white aspect-square rounded-lg cursor-pointer overflow-hidden relative border p-1 transition-all ${mainImage === img ? 'border-blue-600 ring-1 ring-blue-600' : 'border-slate-200 hover:border-blue-400'}`} 
                                >
                                    <img 
                                        src={getFullUrl(img)}
                                        alt={`Thumbnail ${idx}`}
                                        className="w-full h-full object-contain"
                                    />
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Right Column: Details */}
                <div className="flex flex-col gap-6">
                    <div className="flex flex-col gap-2 border-b border-slate-100 pb-6">
                        <h1 className="text-3xl font-bold text-slate-900 leading-tight">{product.name}</h1>
                        
                        <div className="flex items-center gap-4 mt-1">
                            <div className="flex text-yellow-400 text-sm">
                                {[...Array(5)].map((_, i) => (
                                    <span key={i} className={`material-symbols-outlined !text-lg ${i < Math.round(product.average_rating || 0) ? 'text-yellow-400' : 'text-slate-200'}`} style={{fontVariationSettings: "'FILL' 1"}}>star</span>
                                ))}
                            </div>
                            <span className="text-sm text-blue-600 font-medium cursor-pointer hover:underline" onClick={() => setActiveTab('reviews')}>
                                {product.review_count || 0} Reviews
                            </span>
                        </div>

                        <div className="flex items-end gap-3 mt-4">
                            <div className="text-3xl font-bold text-slate-900">₹{Number(product.price).toLocaleString()}</div>
                            {product.mrp > 0 && (
                                <>
                                    <div className="text-lg text-slate-400 line-through mb-1">₹{Number(product.mrp).toLocaleString()}</div>
                                    {product.mrp > product.price && (
                                        <div className="text-sm text-green-600 font-bold mb-1.5 bg-green-50 px-2 py-0.5 rounded">
                                            {Math.round(((product.mrp - product.price) / product.mrp) * 100)}% OFF
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                        <p className="text-xs text-slate-500">Inclusive of all taxes</p>
                        
                        <div className="mt-4 text-slate-700 leading-relaxed">
                            {product.description}
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-col gap-4">
                        <div className="flex items-center gap-4">
                            <label className="text-sm font-semibold text-slate-700">Quantity</label>
                            <div className="flex items-center border border-slate-300 rounded-lg bg-white h-10">
                                <button 
                                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                                    className="w-10 h-full flex items-center justify-center text-slate-600 hover:bg-slate-100 rounded-l-lg"
                                >-</button>
                                <input 
                                    className="w-12 h-full text-center bg-transparent text-slate-900 font-medium focus:outline-none" 
                                    id="quantity" 
                                    type="text" 
                                    value={quantity} 
                                    readOnly
                                />
                                <button 
                                    onClick={() => setQuantity(Math.min(product.stock_qty, quantity + 1))}
                                    className="w-10 h-full flex items-center justify-center text-slate-600 hover:bg-slate-100 rounded-r-lg"
                                >+</button>
                            </div>
                            <div className={`text-sm font-medium ${product.stock_qty > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                {product.stock_qty > 0 ? 'In Stock' : 'Out of Stock'}
                            </div>
                        </div>

                        <div className="flex gap-3 mt-2">
                            <button 
                                onClick={handleAddToCart}
                                disabled={product.stock_qty < 1}
                                className="flex-1 bg-slate-900 text-white h-12 rounded-lg font-bold hover:bg-slate-800 transition-colors disabled:bg-slate-300 disabled:cursor-not-allowed"
                            >
                                {product.stock_qty < 1 ? "Sold Out" : "Add to Cart"}
                            </button>
                            <button 
                                onClick={handleBuyNow}
                                disabled={product.stock_qty < 1}
                                className="flex-1 bg-blue-600 text-white h-12 rounded-lg font-bold hover:bg-blue-700 transition-colors disabled:bg-blue-300 disabled:cursor-not-allowed"
                            >
                                Buy Now
                            </button>
                        </div>
                    </div>

                    {/* Authenticity Badge */}
                    <div className="bg-blue-50 border border-blue-100 p-4 rounded-lg flex items-start gap-3">
                        <div className="mt-1 text-blue-600">
                            <span className="material-symbols-outlined text-2xl">verified_user</span>
                        </div>
                        <div>
                            <h4 className="font-bold text-slate-900 text-sm">Authentic Product</h4>
                            <p className="text-sm text-slate-600">100% Genuine Product with Brand Warranty. Sourced directly from authorized distributors.</p>
                        </div>
                    </div>

                    {/* Seller Info */}
                    <div className="border-t border-slate-100 pt-4 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-slate-200 overflow-hidden flex-shrink-0">
                                <img src={product.seller?.avatar ? getFullUrl(product.seller.avatar) : "https://placehold.co/100x100?text=S"} alt="Seller" className="w-full h-full object-cover" />
                            </div>
                            <div>
                                <p className="font-medium text-slate-900 text-sm">Sold By: {product.seller?.name || "JB IT Retail"}</p>
                                <p className="text-xs text-blue-600 flex items-center gap-1">
                                    Authorized Seller <span className="material-symbols-outlined text-[14px]">check_circle</span>
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Tabs Section */}
            <div className="w-full mt-16 bg-slate-50 border-t border-slate-200 py-12">
                <div className="max-w-6xl mx-auto px-4">
                    <div className="flex justify-center border-b border-slate-200 mb-8">
                        {['description', 'specifications', 'reviews'].map((tab) => (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab)}
                                className={`px-6 py-3 text-sm font-bold tracking-wide transition-all border-b-2 ${
                                    activeTab === tab 
                                    ? 'text-blue-600 border-blue-600' 
                                    : 'text-slate-500 border-transparent hover:text-slate-800'
                                }`}
                            >
                                {tab.charAt(0).toUpperCase() + tab.slice(1)}
                            </button>
                        ))}
                    </div>
                    
                    <div className="bg-white p-8 rounded-xl border border-slate-200 shadow-sm min-h-[300px]">
                        {activeTab === 'description' && (
                            <div className="prose max-w-none text-slate-600">
                                <h3 className="text-xl font-bold text-slate-900 mb-4">Product Overview</h3>
                                <div className="leading-relaxed space-y-4 whitespace-pre-line">
                                    {product.description}
                                </div>
                            </div>
                        )}
                        {activeTab === 'specifications' && (
                            <div className="overflow-hidden rounded-lg border border-slate-200">
                                <table className="min-w-full text-left text-sm">
                                    <tbody className="divide-y divide-slate-200">
                                        <tr className="bg-slate-50">
                                            <th className="py-3 px-4 font-semibold text-slate-700 w-1/3">SKU</th>
                                            <td className="py-3 px-4 text-slate-600 font-mono">{product.sku || 'N/A'}</td>
                                        </tr>
                                        <tr>
                                            <th className="py-3 px-4 font-semibold text-slate-700">Brand</th>
                                            <td className="py-3 px-4 text-slate-600">{product.brand || 'Generic'}</td>
                                        </tr>
                                        <tr className="bg-slate-50">
                                            <th className="py-3 px-4 font-semibold text-slate-700">Availability</th>
                                            <td className="py-3 px-4 text-slate-600">{product.stock_qty > 0 ? 'In Stock' : 'Out of Stock'}</td>
                                        </tr>
                                        {/* Add more dynamic specs here if available in product data */}
                                    </tbody>
                                </table>
                            </div>
                        )}
                        {activeTab === 'reviews' && (
                            <div className="flex flex-col gap-8">
                                <h3 className="text-xl font-bold text-slate-900">Customer Reviews</h3>
                                
                                {/* Reviews List */}
                                <div className="space-y-6">
                                    {reviews.length > 0 ? (
                                        reviews.map((review) => (
                                            <div key={review.id} className="border-b border-slate-100 pb-6 last:border-0">
                                                <div className="flex items-center justify-between mb-2">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-600 text-xs">
                                                            {review.user_name ? review.user_name[0].toUpperCase() : 'U'}
                                                        </div>
                                                        <div>
                                                            <span className="font-bold text-slate-900 text-sm block">{review.user_name}</span>
                                                            <span className="text-xs text-slate-400">{new Date(review.created_at).toLocaleDateString()}</span>
                                                        </div>
                                                    </div>
                                                    <div className="flex text-yellow-400">
                                                        {[...Array(5)].map((_, i) => (
                                                            <span key={i} className={`material-symbols-outlined !text-sm ${i < review.rating ? '' : 'text-slate-200'}`} style={{fontVariationSettings: "'FILL' 1"}}>star</span>
                                                        ))}
                                                    </div>
                                                </div>
                                                <p className="text-slate-600 text-sm pl-11">{review.comment}</p>
                                            </div>
                                        ))
                                    ) : (
                                        <p className="text-center text-slate-500 italic py-4">No reviews yet. Be the first to review this product.</p>
                                    )}
                                </div>

                                {/* Review Form */}
                                <div className="bg-slate-50 p-6 rounded-xl border border-slate-200 mt-4">
                                    <h4 className="font-bold text-slate-900 mb-4">Write a Review</h4>
                                    {localStorage.getItem('access_token') ? (
                                        !hasReviewed ? (
                                            <form onSubmit={submitReview} className="flex flex-col gap-4">
                                                <div>
                                                    <label className="block text-sm font-medium text-slate-700 mb-1">Rating</label>
                                                    <div className="flex gap-1">
                                                        {[1, 2, 3, 4, 5].map((star) => (
                                                            <button
                                                                type="button"
                                                                key={star}
                                                                onClick={() => setReviewForm({ ...reviewForm, rating: star })}
                                                                className={`text-2xl transition-transform hover:scale-110 ${star <= reviewForm.rating ? 'text-yellow-400' : 'text-slate-300'}`}
                                                            >
                                                                <span className="material-symbols-outlined" style={{fontVariationSettings: "'FILL' 1"}}>star</span>
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>
                                                <div>
                                                    <label className="block text-sm font-medium text-slate-700 mb-1">Review</label>
                                                    <textarea
                                                        rows="3"
                                                        className="w-full border border-slate-300 rounded-lg p-3 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                                        placeholder="Share your thoughts about the product..."
                                                        value={reviewForm.comment}
                                                        onChange={(e) => setReviewForm({ ...reviewForm, comment: e.target.value })}
                                                        required
                                                    ></textarea>
                                                </div>
                                                <button
                                                    type="submit"
                                                    disabled={submittingReview}
                                                    className="bg-blue-600 text-white px-6 py-2 rounded-lg font-bold text-sm hover:bg-blue-700 disabled:opacity-50 self-start"
                                                >
                                                    {submittingReview ? 'Submitting...' : 'Submit Review'}
                                                </button>
                                            </form>
                                        ) : (
                                            <div className="p-4 bg-green-50 text-green-700 text-sm rounded border border-green-100">
                                                You have already reviewed this product. Thank you!
                                            </div>
                                        )
                                    ) : (
                                        <div className="text-sm text-slate-600">
                                            Please <Link to="/login" className="text-blue-600 font-bold hover:underline">login</Link> to write a review.
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
      </div>
    </>
  );
}
