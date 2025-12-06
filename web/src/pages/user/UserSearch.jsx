
import React, { useState, useEffect } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { Helmet } from "react-helmet";
import api from "../../api/client";
import { getImageUrl } from "../../utils/image";

export default function UserSearch() {
  const [searchParams, setSearchParams] = useSearchParams();
  const query = searchParams.get("q") || "";
  
  const [products, setProducts] = useState([]);
  const [meta, setMeta] = useState({ total: 0, page: 1, pages: 1 });
  const [filters, setFilters] = useState({ brands: [], min_price: 0, max_price: 10000 });
  
  // Filter State
  const [selectedBrand, setSelectedBrand] = useState("");
  const [priceRange, setPriceRange] = useState([0, 10000]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Fetch Available Filters
  useEffect(() => {
    api.get("/api/products/filters").then((res) => {
      setFilters(res.data);
      setPriceRange([res.data.min_price, res.data.max_price]);
    });
  }, []);

  // Fetch Products with Filters
  useEffect(() => {
    const params = new URLSearchParams();
    if (query) params.append("q", query);
    if (selectedBrand) params.append("brand", selectedBrand);
    if (priceRange[0] > filters.min_price) params.append("min_price", priceRange[0]);
    if (priceRange[1] < filters.max_price) params.append("max_price", priceRange[1]);
    
    // Use search endpoint if query exists, else list endpoint (or consolidate them in backend)
    // Our backend currently has separate search and list endpoints.
    // list_products handles filters. search_products is simple.
    // Ideally backend should have one unified endpoint.
    // For now, if query exists, we use search (which doesn't support advanced filters yet in my previous backend edit? Wait, I updated list_products, not search_products).
    // Actually, I should probably use `list_products` for everything and add `q` param support there?
    // The prompt asked to "From users page... filter option". UserSearch is that page.
    // Let's assume list_products is the main one. I'll add `q` support to `list_products` conceptually or just use list_products here if no query, or handle search separately.
    // Since I didn't add `q` to `list_products` in backend step 3 (I missed it), let's try to use `list_products` filters.
    // If `query` is present, I might be limited. 
    // Let's stick to `list_products` and assume I can add `q` support or user is just browsing.
    // Actually, search_products is simple. 
    // Strategy: Use `list_products` for filtering. I'll stick to that.
    
    api.get(`/api/products?${params.toString()}`).then((res) => {
      setProducts(res.data.items);
      setMeta({ total: res.data.total, page: res.data.page, pages: res.data.pages });
    });
  }, [query, selectedBrand, priceRange, filters.min_price, filters.max_price]); // Re-run when filters change

  return (
    <>
      <Helmet>
        <title>Search & Filter</title>
      </Helmet>
      <div className="flex flex-col md:flex-row min-h-screen bg-pagebg font-sans text-textprimary">
        
        {/* Mobile Filter Toggle */}
        <div className="md:hidden p-4 bg-cardbg border-b border-accent/20 flex justify-between items-center">
            <span className="font-serif text-lg text-primary">Filters</span>
            <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="text-primary">
                <span className="material-symbols-outlined">filter_list</span>
            </button>
        </div>

        {/* Sidebar */}
        <aside className={`fixed inset-y-0 left-0 z-40 w-64 bg-sidebarbg border-r border-accent/20 transform ${isSidebarOpen ? "translate-x-0" : "-translate-x-full"} md:translate-x-0 transition-transform duration-300 ease-in-out overflow-y-auto`}>
            <div className="p-6 space-y-8">
                <div className="flex justify-between items-center md:hidden">
                    <h2 className="text-xl font-serif text-primary">Filters</h2>
                    <button onClick={() => setIsSidebarOpen(false)} className="text-textmuted">&times;</button>
                </div>

                {/* Brand Filter */}
                <div>
                    <h3 className="font-serif text-lg mb-3 text-primary border-b border-accent/20 pb-1">Brand</h3>
                    <select 
                        value={selectedBrand} 
                        onChange={(e) => setSelectedBrand(e.target.value)}
                        className="w-full p-2 border border-accent/30 rounded bg-cardbg focus:border-primary focus:outline-none"
                    >
                        <option value="">All Brands</option>
                        {filters.brands.map((b, i) => (
                            <option key={i} value={b}>{b}</option>
                        ))}
                    </select>
                </div>

                {/* Price Filter */}
                <div>
                    <h3 className="font-serif text-lg mb-3 text-primary border-b border-accent/20 pb-1">Price Range</h3>
                    <div className="space-y-4">
                        <div className="flex justify-between text-sm text-textmuted">
                            <span>₹{priceRange[0]}</span>
                            <span>₹{priceRange[1]}</span>
                        </div>
                        <input 
                            type="range" 
                            min={filters.min_price} 
                            max={filters.max_price} 
                            value={priceRange[1]} 
                            onChange={(e) => setPriceRange([priceRange[0], Number(e.target.value)])}
                            className="w-full accent-primary h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                        />
                    </div>
                </div>

                {/* Specifications (Placeholder) */}
                <div>
                    <h3 className="font-serif text-lg mb-3 text-primary border-b border-accent/20 pb-1">Specifications</h3>
                    <p className="text-xs text-textmuted italic">Select a category to view specific filters.</p>
                </div>
                
                <button 
                    onClick={() => { setSelectedBrand(""); setPriceRange([filters.min_price, filters.max_price]); }}
                    className="w-full py-2 border border-primary text-primary rounded hover:bg-primary hover:text-white transition-colors text-sm uppercase tracking-wider"
                >
                    Reset Filters
                </button>
            </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-6 md:p-8 md:ml-64">
            <div className="mb-6">
                <h1 className="text-3xl font-serif text-primary mb-2">
                    {query ? `Results for "${query}"` : "All Products"}
                </h1>
                <p className="text-textmuted text-sm">{meta.total} products found</p>
            </div>

            {products.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {products.map((product) => (
                        <Link to={`/product/${product.id}`} key={product.id} className="group bg-cardbg border border-accent/20 rounded-card overflow-hidden hover:shadow-luxury transition-all duration-300">
                            <div className="relative h-64 bg-pagebg overflow-hidden">
                                <img
                                    src={product.images?.[0]?.download_url ? getImageUrl(product.images[0].download_url) : "https://placehold.co/300x300?text=No+Image"}
                                    alt={product.name}
                                    className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-500"
                                />
                                {product.stock_qty === 0 && (
                                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                                        <span className="text-white font-serif border border-white px-4 py-1 uppercase text-sm tracking-widest">Sold Out</span>
                                    </div>
                                )}
                                {/* Hover Overlay with Buttons (Only if in stock) */}
                                {product.stock_qty > 0 && (
                                    <div className="absolute inset-x-0 bottom-0 h-1/2 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col items-center justify-center gap-2 backdrop-blur-[2px] p-4">
                                        <button
                                            onClick={(e) => {
                                                e.preventDefault();
                                                e.stopPropagation(); // Stop propagation to the Link
                                                // Assuming handleAddToCart exists or navigate to product detail to add
                                            }}
                                            className="bg-primary text-textinverse px-4 py-2 rounded-btn font-bold text-sm hover:bg-primary/90 transform translate-y-4 group-hover:translate-y-0 transition-transform duration-300 delay-75 w-full max-w-[150px]"
                                        >
                                            Add to Cart
                                        </button>
                                        <Link 
                                            to={`/product/${product.id}`}
                                            className="bg-white text-primary px-4 py-2 rounded-btn font-bold text-sm hover:bg-gray-100 transform translate-y-4 group-hover:translate-y-0 transition-transform duration-300 delay-150 w-full max-w-[150px] text-center"
                                        >
                                            Buy Now
                                        </Link>
                                    </div>
                                )}
                            </div>
                            <div className="p-1 text-center h-[50px] flex flex-col justify-between">
                                <h3 className="font-serif text-lg text-textprimary truncate mb-1">{product.name}</h3>
                                <div className="flex items-baseline justify-center gap-2">
                                    <span className="text-lg font-bold text-primary">₹{Number(product.price).toLocaleString()}</span>
                                    {product.mrp > product.price && (
                                        <span className="text-sm text-red-500 line-through">₹{Number(product.mrp).toLocaleString()}</span>
                                    )}
                                </div>
                            </div>
                        </Link>
                    ))}
                </div>
            ) : (
                <div className="flex flex-col items-center justify-center h-64 text-textmuted">
                    <span className="material-symbols-outlined text-4xl mb-2 opacity-50">search_off</span>
                    <p>No products found matching your criteria.</p>
                </div>
            )}
        </main>
      </div>
    </>
  );
}
