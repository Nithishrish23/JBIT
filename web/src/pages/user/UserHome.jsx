import React, { useState, useEffect } from "react";
import { Helmet } from "react-helmet";
import { Link, useNavigate } from "react-router-dom";
import api from "../../api/client";
import { getImageUrl } from "../../utils/image";
import ProductFilter from "../../components/ProductFilter";

export default function UserHome() {
    const [featuredProducts, setFeaturedProducts] = useState([]);
    const [normalProducts, setNormalProducts] = useState([]);
    const [categories, setCategories] = useState([]);
    const [settings, setSettings] = useState({});
    const [currentSlide, setCurrentSlide] = useState(0);
    const [ads, setAds] = useState([]);
    const [slides, setSlides] = useState([]);
    const [showFilters, setShowFilters] = useState(false);


    // Filters
    const [filters, setFilters] = useState({
        category: "",
        min_price: "",
        max_price: "",
        in_stock: false,
        sort_by: "relevance"
    });

    // Pagination & View Mode State
    const [pagination, setPagination] = useState({ page: 1, totalPages: 1, limit: 12 });

    const navigate = useNavigate();

    const nextSlide = () => {
        setCurrentSlide((prev) => (prev + 1) % (slides.length || 1));
    };

    const prevSlide = () => {
        setCurrentSlide((prev) => (prev - 1 + (slides.length || 1)) % (slides.length || 1));
    };

    const fetchProducts = (page, currentFilters = filters) => {
        api.get("/api/settings/public").then(settingsRes => {
            const limit = settingsRes.data.items_per_page || 12;

            const params = new URLSearchParams({
                page: page,
                limit: limit,
                ...currentFilters.category && { category: currentFilters.category },
                ...currentFilters.min_price && { min_price: currentFilters.min_price },
                ...currentFilters.max_price && { max_price: currentFilters.max_price },
                in_stock: currentFilters.in_stock,
                sort_by: currentFilters.sort_by
            });

            api.get(`/api/products?${params.toString()}`).then((res) => {
                setNormalProducts(res.data.items || []);
                setPagination(prev => ({
                    ...prev,
                    page: res.data.page,
                    totalPages: res.data.pages,
                    total: res.data.total,
                    limit: limit
                }));
            });
        });
    };

    useEffect(() => {
        api.get("/api/products/featured").then((res) => setFeaturedProducts(res.data));

        // Initial fetch for paginated products
        fetchProducts(1);

        api.get("/api/categories").then((res) => setCategories(res.data));
        api.get("/api/settings/public").then((res) => setSettings(res.data));
    }, []);

    const handleFilterChange = (name, value) => {
        if (name === 'reset') {
            const resetFilters = { category: "", min_price: "", max_price: "", in_stock: false, sort_by: "relevance" };
            setFilters(resetFilters);
            fetchProducts(1, resetFilters);
        } else {
            const newFilters = { ...filters, [name]: value };
            setFilters(newFilters);
            fetchProducts(1, newFilters);
        }
    };

    useEffect(() => {
        const timer = setInterval(() => {
            setCurrentSlide((prev) => (prev + 1) % (slides.length || 1));
        }, 5000);
        return () => clearInterval(timer);
    }, [slides.length]);

    const handleAddToCart = (productId) => {
        if (!localStorage.getItem('access_token')) {
            alert("Please login to add to cart");
            return;
        }
        api.post('/api/user/cart/items', { product_id: productId, quantity: 1 })
            .then(() => {
                alert('Added to cart'); // Keep alert for confirmation
                navigate(`/product/${productId}`); // Navigate to product detail page
            })
            .catch((err) => {
                console.error(err);
                alert('Add to cart failed');
            });
    };

    useEffect(() => {
        // Fetch Banner Ads
        api.get("/api/ads?position=home_banner").then((res) => {
            setAds(res.data);
            if (res.data.length > 0) {
                const mappedSlides = res.data.map((ad, idx) => ({
                    id: ad.id,
                    image: ad.image_url ? getImageUrl(ad.image_url) : null,
                    title: ad.title || `Ad ${idx + 1}`,
                    subtitle: ad.text,
                    cta: "Shop Now",
                    target_url: ad.target_url,
                    product_id: ad.product_id,
                    footer_logo_url: ad.footer_logo_url ? getImageUrl(ad.footer_logo_url) : null
                }));
                setSlides(mappedSlides);
            } else {
                // Fallback Default Banner
                setSlides([
                    {
                        id: 'default',
                        image: settings.home_banner_image ? getImageUrl(settings.home_banner_image) : null,
                        title: settings.home_banner_heading || "JB Solutions",
                        subtitle: settings.home_banner_subheading || "Upgrade your life with the latest electronics.",
                        cta: "Explore Shop",
                        target_url: "/search"
                    }
                ]);
            }
        });
    }, [settings]);

    const gridColsClass = settings.category_grid_columns ? `lg:grid-cols-${settings.category_grid_columns}` : 'lg:grid-cols-4';

    return (
        <>
            <Helmet>
                <title>{settings.site_title || "JB Solutions"}</title>
            </Helmet>
            <div className="flex flex-col font-sans text-textprimary bg-pagebg min-h-screen">

                {/* HERO SECTION */}
                <section className="w-full bg-slate-50 flex justify-center py-6">
                    <div className="w-full max-w-screen-xl h-[500px] bg-white flex justify-center items-center overflow-hidden relative rounded-2xl shadow-lg mx-4 group">
                        {slides.length > 0 && (
                            <div className="w-full h-full flex justify-center items-center relative">
                                {slides.map((slide, index) => {
                                    const linkUrl = slide.product_id ? `/product/${slide.product_id}` : (slide.target_url || "#");
                                    return (
                                        <a
                                            key={slide.id}
                                            href={linkUrl}
                                            className={`absolute inset-0 flex justify-center items-center transition-opacity duration-700 ${index === currentSlide ? 'opacity-100 z-10' : 'opacity-0 z-0'}`}
                                            onClick={(e) => {
                                                if (linkUrl === "#") e.preventDefault();
                                            }}
                                        >
                                            {slide.image ? (
                                                <div className="relative w-full h-full">
                                                    <img src={slide.image} alt={slide.title} className="w-full h-full object-cover object-center" />
                                                    <div className="absolute inset-0 flex flex-col justify-center items-start pl-10 md:pl-20 bg-gradient-to-r from-black/70 to-transparent">
                                                        <h2 className="text-4xl md:text-5xl font-bold text-white mb-4 max-w-xl">{slide.title}</h2>
                                                        {slide.subtitle && <p className="text-lg text-white/90 mb-8 max-w-lg">{slide.subtitle}</p>}
                                                        {linkUrl !== "#" && (
                                                            <button className="px-8 py-3 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 transition-colors shadow-lg">
                                                                {slide.cta || "Shop Now"}
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="w-full h-full bg-slate-900 flex flex-col justify-center items-center text-center p-4">
                                                    <h2 className="text-4xl md:text-6xl font-bold text-white mb-6">{slide.title}</h2>
                                                    {slide.subtitle && <p className="text-xl text-slate-300 mb-8 max-w-2xl">{slide.subtitle}</p>}
                                                    {linkUrl !== "#" && (
                                                        <button className="px-8 py-3 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 transition-colors shadow-lg">
                                                            {slide.cta || "Shop Now"}
                                                        </button>
                                                    )}
                                                </div>
                                            )}
                                        </a>
                                    );
                                })}
                            </div>
                        )}

                        {/* Navigation Arrows */}
                        {slides.length > 1 && (
                            <>
                                <button
                                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); prevSlide(); }}
                                    className="absolute left-4 top-1/2 -translate-y-1/2 bg-white/20 hover:bg-white/40 text-white p-3 rounded-full transition-colors z-20 backdrop-blur-sm"
                                >
                                    <span className="material-symbols-outlined text-2xl">chevron_left</span>
                                </button>
                                <button
                                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); nextSlide(); }}
                                    className="absolute right-4 top-1/2 -translate-y-1/2 bg-white/20 hover:bg-white/40 text-white p-3 rounded-full transition-colors z-20 backdrop-blur-sm"
                                >
                                    <span className="material-symbols-outlined text-2xl">chevron_right</span>
                                </button>
                            </>
                        )}
                    </div>
                </section>

                <div className="container mx-auto px-4 py-12 flex flex-col gap-16">

                    {/* CATEGORIES SECTION */}
                    <section>
                        <div className="flex justify-between items-end mb-8">
                            <div>
                                <h2 className="text-blue-600 font-bold text-sm tracking-wider uppercase mb-2">SHOP BY CATEGORY</h2>
                                <h3 className="text-3xl font-bold text-slate-900">Top Categories</h3>
                            </div>
                            <Link to="/search" className="text-blue-600 font-medium hover:underline flex items-center gap-1">
                                View All <span className="material-symbols-outlined text-lg">arrow_forward</span>
                            </Link>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                            {categories.slice(0, 4).map((cat) => (
                                <Link
                                    key={cat.id}
                                    to={`/category/${cat.slug}`}
                                    className="
        group relative bg-white
        h-[140px] sm:h-[150px] lg:h-[160px]
        rounded-lg overflow-hidden
        border border-slate-200
        shadow-sm hover:shadow-md
        transition-all duration-300
      "
                                >
                                    {/* Image */}
                                    <div className="absolute inset-0">
                                        <img
                                            src={getImageUrl(cat.image_url)}
                                            alt={cat.name}
                                            className="
            w-full h-full object-cover
            group-hover:scale-105
            transition-transform duration-300
          "
                                            onError={(e) =>
                                            (e.target.src =
                                                'https://placehold.co/300x300?text=Category')
                                            }
                                        />
                                        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent"></div>
                                    </div>

                                    {/* Text */}
                                    <div className="absolute bottom-0 left-0 w-full p-3 sm:p-4">
                                        <h4
                                            className="
            text-sm sm:text-base
            font-semibold text-white
            leading-tight
          "
                                        >
                                            {cat.name}
                                        </h4>

                                        <p
                                            className="
            text-[11px] sm:text-xs
            text-slate-300
            opacity-0 group-hover:opacity-100
            transition-opacity duration-300
          "
                                        >
                                            Explore Collection
                                        </p>
                                    </div>
                                </Link>
                            ))}
                        </div>

                    </section>

                    {/* PRODUCTS SECTION */}
                    {/* PRODUCTS SECTION */}
                    <section id="collection">
                        {/* Section Header */}
                        <div className="text-center mb-8">
                            <h3 className="text-3xl font-bold text-slate-900">
                                Latest Arrivals
                            </h3>
                            <p className="text-slate-500 mt-2">
                                Check out the newest gadgets and accessories.
                            </p>
                        </div>

                        {/* Mobile / Tablet Top Bar */}
                        <div className="flex items-center justify-between mb-4 lg:hidden">
                            <span className="text-sm text-slate-600">
                                {pagination.total || normalProducts.length} Products
                            </span>

                            <button
                                onClick={() => setShowFilters(true)}
                                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white
                 rounded-lg text-sm font-semibold shadow"
                            >
                                <span className="material-symbols-outlined text-base">tune</span>
                                Filter
                            </button>
                        </div>

                        <div className="flex gap-8 items-start">
                            {/* DESKTOP FILTER SIDEBAR */}
                            <div className="hidden lg:block w-1/4">
                                <div className="sticky top-6">
                                    <ProductFilter
                                        categories={categories}
                                        filters={filters}
                                        onFilterChange={handleFilterChange}
                                    />
                                </div>
                            </div>

                            {/* PRODUCTS GRID */}
                            <div className="w-full lg:w-3/4">
                                <div
                                    className={`grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 ${gridColsClass} gap-6`}
                                >
                                    {normalProducts.map((product) => (
                                        <Link
                                            key={product.id}
                                            to={`/product/${product.id}`}
                                            className="group bg-white border border-slate-200 rounded-xl
                       overflow-hidden hover:shadow-lg transition-all duration-300 flex flex-col"
                                        >
                                            {/* Image */}
                                            <div className="relative w-full h-[220px] bg-white p-4 overflow-hidden">
                                                <img
                                                    src={
                                                        product.images?.[0]?.download_url
                                                            ? getImageUrl(product.images[0].download_url)
                                                            : "https://placehold.co/300x300?text=Product"
                                                    }
                                                    alt={product.name}
                                                    className="w-full h-full object-contain
                           transition-transform duration-500 group-hover:scale-105"
                                                />

                                                {product.stock_qty === 0 && (
                                                    <div className="absolute inset-0 bg-white/80 flex items-center justify-center">
                                                        <span className="bg-red-600 text-white px-4 py-1 text-xs font-bold rounded">
                                                            Out of Stock
                                                        </span>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Content */}
                                            <div className="p-4 flex flex-col flex-1 border-t">
                                                <h4 className="font-semibold text-slate-900 truncate mb-2 group-hover:text-blue-600">
                                                    {product.name}
                                                </h4>

                                                <div className="flex items-end justify-between mt-auto">
                                                    <div>
                                                        {product.mrp > product.price && (
                                                            <span className="block text-xs line-through text-red-500">
                                                                ₹{Number(product.mrp).toLocaleString()}
                                                            </span>
                                                        )}
                                                        <span className="text-lg font-bold">
                                                            ₹{Number(product.price).toLocaleString()}
                                                        </span>
                                                    </div>

                                                    <button
                                                        onClick={(e) => {
                                                            e.preventDefault();
                                                            e.stopPropagation();
                                                            handleAddToCart(product.id);
                                                        }}
                                                        disabled={product.stock_qty === 0}
                                                        className="p-2 rounded-full bg-blue-50 text-blue-600
                             hover:bg-blue-600 hover:text-white transition disabled:opacity-50"
                                                    >
                                                        <span className="material-symbols-outlined text-xl">
                                                            add_shopping_cart
                                                        </span>
                                                    </button>
                                                </div>
                                            </div>
                                        </Link>
                                    ))}
                                </div>

                                {/* Pagination */}
                                {pagination.totalPages > 1 && (
                                    <div className="flex justify-center gap-3 mt-12">
                                        <button
                                            disabled={pagination.page === 1}
                                            onClick={() => fetchProducts(pagination.page - 1)}
                                            className="px-4 py-2 border rounded-md text-sm disabled:opacity-50"
                                        >
                                            Previous
                                        </button>

                                        <span className="px-4 py-2 bg-slate-900 text-white rounded-md text-sm">
                                            Page {pagination.page} of {pagination.totalPages}
                                        </span>

                                        <button
                                            disabled={pagination.page === pagination.totalPages}
                                            onClick={() => fetchProducts(pagination.page + 1)}
                                            className="px-4 py-2 border rounded-md text-sm disabled:opacity-50"
                                        >
                                            Next
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* MOBILE / TABLET FILTER DRAWER */}
                        {showFilters && (
                            <div className="fixed inset-0 z-50 lg:hidden">
                                {/* Overlay */}
                                <div
                                    className="absolute inset-0 bg-black/40"
                                    onClick={() => setShowFilters(false)}
                                ></div>

                                {/* Drawer */}
                                <div
                                    className="absolute right-0 top-0 h-full w-[85%] sm:w-[60%]
                   bg-white shadow-xl transform transition-transform duration-300"
                                >
                                    {/* Header */}
                                    <div className="flex items-center justify-between p-4 border-b">
                                        <h3 className="text-lg font-bold">Filters</h3>
                                        <button onClick={() => setShowFilters(false)}>
                                            <span className="material-symbols-outlined">close</span>
                                        </button>
                                    </div>

                                    {/* Filter Content */}
                                    <div className="p-4 overflow-y-auto h-[calc(100%-120px)]">
                                        <ProductFilter
                                            categories={categories}
                                            filters={filters}
                                            onFilterChange={handleFilterChange}
                                        />
                                    </div>

                                    {/* Footer */}
                                    <div className="p-4 border-t">
                                        <button
                                            onClick={() => setShowFilters(false)}
                                            className="w-full py-3 bg-blue-600 text-white rounded-lg font-semibold"
                                        >
                                            Apply Filters
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </section>

                    {/* <section className="bg-slate-50 py-16 rounded-2xl border border-slate-200 relative overflow-hidden">
                        <div className="text-center max-w-3xl mx-auto px-4 relative z-10">
                            <h3 className="text-2xl font-bold text-slate-900 mb-8">Customer Reviews</h3>
                            <div className="bg-white p-8 rounded-xl shadow-sm border border-slate-100">
                                <div className="flex justify-center text-yellow-400 mb-4">
                                    {[1, 2, 3, 4, 5].map(i => <span key={i} className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>)}
                                </div>
                                <p className="text-lg text-slate-600 italic mb-6">
                                    "Excellent service! I ordered a gaming laptop and it arrived within 2 days. The packaging was secure and the product is genuine. Highly recommended for all IT needs."
                                </p>
                                <div className="flex items-center justify-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 font-bold">
                                        A
                                    </div>
                                    <div className="text-left">
                                        <p className="font-bold text-slate-900 text-sm">Arjun Mehta</p>
                                        <p className="text-xs text-slate-500">Verified Buyer</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </section> */}

                </div>
            </div>
        </>
    );
}
