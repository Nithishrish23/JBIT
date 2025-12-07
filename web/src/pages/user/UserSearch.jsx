import React, { useState, useEffect, useCallback } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { Helmet } from "react-helmet";
import api from "../../api/client";
import { getImageUrl } from "../../utils/image";

// Debounce helper
const useDebounce = (value, delay) => {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debouncedValue;
};

export default function UserSearch() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialQuery = searchParams.get("q") || "";
  
  const [products, setProducts] = useState([]);
  const [meta, setMeta] = useState({ total: 0, page: 1, pages: 1 });
  const [availableFilters, setAvailableFilters] = useState({ brands: [], min_price: 0, max_price: 10000 });
  
  // UI State
  const [isMobileFilterOpen, setIsMobileFilterOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  // Filter State
  const [query, setQuery] = useState(initialQuery);
  const [selectedBrands, setSelectedBrands] = useState([]);
  const [priceRange, setPriceRange] = useState([0, 10000]);
  const [sort, setSort] = useState("relevance");

  // Debounced values for API calls
  const debouncedQuery = useDebounce(query, 500);
  const debouncedPriceRange = useDebounce(priceRange, 500);
  const debouncedBrands = useDebounce(selectedBrands, 500);

  // Fetch Available Filters (Brands, Min/Max Price)
  useEffect(() => {
    api.get("/api/products/filters").then((res) => {
      setAvailableFilters(res.data);
      setPriceRange([0, res.data.max_price || 10000]); // Default max to actual max
    }).catch(console.error);
  }, []);

  // Sync URL with Query State
  useEffect(() => {
      setQuery(searchParams.get("q") || "");
  }, [searchParams]);

  // Fetch Products
  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (debouncedQuery) params.append("q", debouncedQuery);
    
    debouncedBrands.forEach(b => params.append("brand", b)); // API currently takes one brand, let's just take the last one or fix API. 
    // Current API logic: `brand = request.args.get('brand')`. It only takes one. 
    // For multiple brands, backend needs `request.args.getlist('brand')` and `filter(Product.brand.in_(brands))`.
    // Assuming single brand selection for now based on backend `product.py`.
    if (debouncedBrands.length > 0) params.append("brand", debouncedBrands[0]); 

    params.append("min_price", debouncedPriceRange[0]);
    params.append("max_price", debouncedPriceRange[1]);
    params.append("sort_by", sort);
    params.append("limit", 12);

    api.get(`/api/products?${params.toString()}`).then((res) => {
      setProducts(res.data.items);
      setMeta({ total: res.data.total, page: res.data.page, pages: res.data.pages });
      setLoading(false);
    }).catch(err => {
        console.error(err);
        setLoading(false);
    });
  }, [debouncedQuery, debouncedBrands, debouncedPriceRange, sort]);

  const toggleBrand = (brand) => {
      // Since backend only supports one brand filter currently (based on my read of product.py `request.args.get('brand')`),
      // we'll toggle single selection.
      if (selectedBrands.includes(brand)) {
          setSelectedBrands([]);
      } else {
          setSelectedBrands([brand]);
      }
  };

  const handlePriceChange = (idx, val) => {
      const newRange = [...priceRange];
      newRange[idx] = Number(val);
      setPriceRange(newRange);
  };

  return (
    <>
      <Helmet>
        <title>Search Products</title>
      </Helmet>
      <div className="min-h-screen bg-gray-50 font-sans text-slate-900">
        
        <div className="max-w-7xl mx-auto px-4 py-6 flex flex-col lg:flex-row gap-8 relative">
            
            {/* Sidebar Filters */}
            <aside className={`
                lg:w-64 lg:block flex-shrink-0
                fixed lg:static inset-y-0 left-0 z-50 bg-white lg:bg-transparent w-[280px] shadow-xl lg:shadow-none
                transform transition-transform duration-300 ease-in-out p-6 lg:p-0 overflow-y-auto lg:overflow-visible
                ${isMobileFilterOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
            `}>
                <div className="flex justify-between items-center lg:hidden mb-6">
                    <h2 className="text-xl font-bold">Filters</h2>
                    <button onClick={() => setIsMobileFilterOpen(false)} className="p-2 text-gray-500">
                        <span className="material-symbols-outlined">close</span>
                    </button>
                </div>

                <div className="space-y-8">
                    {/* Categories (Static or Fetched) - Could add here */}
                    
                    {/* Price Filter */}
                    <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
                        <h3 className="font-semibold text-sm uppercase tracking-wider text-gray-500 mb-4">Price Range</h3>
                        <div className="space-y-4">
                            <div className="flex gap-4">
                                <div className="w-1/2">
                                    <label className="text-xs text-gray-400 mb-1 block">Min</label>
                                    <input 
                                        type="number" 
                                        value={priceRange[0]} 
                                        onChange={(e) => handlePriceChange(0, e.target.value)}
                                        className="w-full border rounded-lg px-2 py-1.5 text-sm"
                                    />
                                </div>
                                <div className="w-1/2">
                                    <label className="text-xs text-gray-400 mb-1 block">Max</label>
                                    <input 
                                        type="number" 
                                        value={priceRange[1]} 
                                        onChange={(e) => handlePriceChange(1, e.target.value)}
                                        className="w-full border rounded-lg px-2 py-1.5 text-sm"
                                    />
                                </div>
                            </div>
                            <input 
                                type="range" 
                                min="0" 
                                max={availableFilters.max_price || 10000} 
                                value={priceRange[1]} 
                                onChange={(e) => handlePriceChange(1, e.target.value)}
                                className="w-full accent-blue-600 h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                            />
                        </div>
                    </div>

                    {/* Brand Filter */}
                    {availableFilters.brands.length > 0 && (
                        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
                            <h3 className="font-semibold text-sm uppercase tracking-wider text-gray-500 mb-4">Brands</h3>
                            <div className="space-y-2 max-h-60 overflow-y-auto custom-scrollbar pr-2">
                                {availableFilters.brands.map((brand, idx) => (
                                    <label key={idx} className="flex items-center gap-3 cursor-pointer group">
                                        <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${selectedBrands.includes(brand) ? 'bg-blue-600 border-blue-600' : 'border-gray-300 bg-white group-hover:border-blue-400'}`}>
                                            {selectedBrands.includes(brand) && <span className="material-symbols-outlined text-white text-[16px]">check</span>}
                                        </div>
                                        <input 
                                            type="checkbox" 
                                            className="hidden"
                                            checked={selectedBrands.includes(brand)}
                                            onChange={() => toggleBrand(brand)}
                                        />
                                        <span className="text-sm text-gray-700 group-hover:text-blue-600">{brand}</span>
                                    </label>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </aside>

            {/* Mobile Backdrop */}
            {isMobileFilterOpen && (
                <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setIsMobileFilterOpen(false)}></div>
            )}

            {/* Main Content */}
            <main className="flex-1">
                {/* Toolbar */}
                <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
                    <div className="flex items-center gap-4 w-full sm:w-auto">
                        <button 
                            onClick={() => setIsMobileFilterOpen(true)}
                            className="lg:hidden flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg shadow-sm text-sm font-medium"
                        >
                            <span className="material-symbols-outlined text-[20px]">filter_list</span> Filters
                        </button>
                        <p className="text-sm text-gray-500">
                            Showing <span className="font-bold text-slate-900">{meta.total}</span> results
                            {query && <span> for "<span className="text-slate-900">{query}</span>"</span>}
                        </p>
                    </div>

                    <div className="flex items-center gap-2 w-full sm:w-auto">
                        <label className="text-sm text-gray-500 whitespace-nowrap">Sort by:</label>
                        <select 
                            value={sort} 
                            onChange={(e) => setSort(e.target.value)}
                            className="border-none bg-transparent text-sm font-bold text-slate-900 focus:ring-0 cursor-pointer hover:text-blue-600"
                        >
                            <option value="relevance">Relevance</option>
                            <option value="price_low_high">Price: Low to High</option>
                            <option value="price_high_low">Price: High to Low</option>
                            <option value="newest">Newest Arrivals</option>
                        </select>
                    </div>
                </div>

                {/* Product Grid */}
                {loading ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                        {[1,2,3,4,5,6].map(i => (
                            <div key={i} className="bg-white rounded-xl p-4 h-80 animate-pulse">
                                <div className="bg-gray-200 h-48 w-full rounded-lg mb-4"></div>
                                <div className="bg-gray-200 h-4 w-3/4 rounded mb-2"></div>
                                <div className="bg-gray-200 h-4 w-1/2 rounded"></div>
                            </div>
                        ))}
                    </div>
                ) : products.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                        {products.map((product) => (
                            <Link to={`/product/${product.id}`} key={product.id} className="group bg-white rounded-xl border border-gray-100 overflow-hidden hover:shadow-xl transition-all duration-300 flex flex-col">
                                <div className="relative aspect-[4/5] overflow-hidden bg-gray-100">
                                    <img
                                        src={getImageUrl(product.images?.[0]?.download_url)}
                                        alt={product.name}
                                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                        onError={(e) => e.target.src = "https://placehold.co/300x400?text=No+Image"}
                                    />
                                    {product.stock_qty === 0 && (
                                        <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                                            <span className="bg-red-600 text-white px-3 py-1 text-xs font-bold uppercase tracking-wider">Sold Out</span>
                                        </div>
                                    )}
                                </div>
                                <div className="p-4 flex flex-col flex-1">
                                    <h3 className="font-medium text-slate-900 line-clamp-2 mb-2 group-hover:text-blue-600 transition-colors">{product.name}</h3>
                                    
                                    {/* Rating Placeholder */}
                                    <div className="flex items-center gap-1 mb-3">
                                        <div className="flex text-yellow-400 text-xs">
                                            <span className="material-symbols-outlined !text-[14px]" style={{fontVariationSettings: "'FILL' 1"}}>star</span>
                                        </div>
                                        <span className="text-xs text-gray-400">({product.review_count || 0})</span>
                                    </div>

                                    <div className="mt-auto flex items-center justify-between">
                                        <div className="flex flex-col">
                                            <span className="text-lg font-bold text-slate-900">₹{Number(product.price).toLocaleString()}</span>
                                            {product.mrp > product.price && (
                                                <span className="text-xs text-gray-400 line-through">₹{Number(product.mrp).toLocaleString()}</span>
                                            )}
                                        </div>
                                        <button className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center hover:bg-blue-600 hover:text-white transition-colors">
                                            <span className="material-symbols-outlined text-[18px]">add</span>
                                        </button>
                                    </div>
                                </div>
                            </Link>
                        ))}
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center py-20 text-center">
                        <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center text-gray-400 mb-4">
                            <span className="material-symbols-outlined text-4xl">search_off</span>
                        </div>
                        <h3 className="text-xl font-bold text-slate-900 mb-2">No results found</h3>
                        <p className="text-gray-500 max-w-md">
                            We couldn't find any products matching your filters. Try adjusting your search or filters.
                        </p>
                        <button 
                            onClick={() => { setQuery(""); setSelectedBrands([]); setPriceRange([0, availableFilters.max_price]); }}
                            className="mt-6 text-blue-600 font-medium hover:underline"
                        >
                            Clear all filters
                        </button>
                    </div>
                )}
            </main>
        </div>
      </div>
    </>
  );
}