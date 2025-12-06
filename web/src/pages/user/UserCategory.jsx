
import React, { useState, useEffect, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import api from "../../api/client";
import { getImageUrl } from "../../utils/image";
import SeoHelmet from '../../components/SeoHelmet'; 
import ProductFilter from "../../components/ProductFilter";

export default function UserCategory() {
  const { slug } = useParams();
  const [products, setProducts] = useState([]);
  const [category, setCategory] = useState(null);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, limit: 12 });
  const [siteSettings, setSiteSettings] = useState({});
  const [filters, setFilters] = useState({
      min_price: "",
      max_price: "",
      in_stock: false,
      sort_by: "relevance"
  });

  const fetchProducts = useCallback(async (page, currentFilters = filters) => {
    try {
        const settingsRes = await api.get("/api/settings/public");
        const limit = settingsRes.data.items_per_page || 12;
        setSiteSettings(settingsRes.data); 
        setPagination(prev => ({ ...prev, limit: limit })); 
        
        const params = new URLSearchParams({
            category: slug,
            page: page,
            limit: limit,
            ...currentFilters.min_price && { min_price: currentFilters.min_price },
            ...currentFilters.max_price && { max_price: currentFilters.max_price },
            in_stock: currentFilters.in_stock,
            sort_by: currentFilters.sort_by
        });

        const productsRes = await api.get(`/api/products?${params.toString()}`);
        setProducts(productsRes.data.items || []);
        setPagination(prev => ({
            ...prev,
            page: productsRes.data.page,
            totalPages: productsRes.data.pages,
            total: productsRes.data.total
        }));
    } catch (err) {
        console.error("Failed to fetch products or settings", err);
    }
  }, [slug, filters]); // filters dependency ensures useCallback updates if we rely on closure, but passing args is safer

  useEffect(() => {
    if (slug) {
      api.get(`/api/categories/slug/${slug}`).then(res => setCategory(res.data));
      fetchProducts(1);
    }
  }, [slug]); // Remove fetchProducts from dependency if it causes loop, or ensure fetchProducts is stable. With useCallback filters dep, it changes on filter change.

  const handleFilterChange = (name, value) => {
      if (name === 'reset') {
          const resetFilters = { min_price: "", max_price: "", in_stock: false, sort_by: "relevance" };
          setFilters(resetFilters);
          fetchProducts(1, resetFilters);
      } else {
          const newFilters = { ...filters, [name]: value };
          setFilters(newFilters);
          fetchProducts(1, newFilters);
      }
  };

  const gridColsClass = siteSettings.category_grid_columns ? `lg:grid-cols-${siteSettings.category_grid_columns}` : 'lg:grid-cols-4';

  return (
    <>
      <SeoHelmet
        title={category ? category.name : "Browse Category"}
        description={category ? `Browse our collection of ${category.name}. ${category.description || ''}` : "Browse products by category."}
      />
      <div className="container mx-auto px-4 py-8 font-sans text-textprimary">
        <h1 className="text-4xl font-serif text-textprimary text-center mb-6">
          {category ? category.name : "Loading..."}
        </h1>
        <div className="w-24 h-1 bg-primary mx-auto mb-10 rounded-full"></div>

        <div className="flex flex-col lg:flex-row gap-8 items-start">
            {/* Filters Sidebar */}
            <div className="w-full lg:w-1/4">
                <ProductFilter 
                    showCategory={false}
                    filters={filters}
                    onFilterChange={handleFilterChange}
                />
            </div>

            {/* Product Grid */}
            <div className="w-full lg:w-3/4">
              {products.length > 0 ? (
                <>
                    <div className={`grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 ${gridColsClass} gap-8`}>
                    {products.map((product) => (
                        <Link to={`/product/${product.id}`} key={product.id} className="group bg-cardbg rounded-card shadow-soft hover:shadow-xl transition-all duration-300 relative border border-primary/20 hover:border-primary flex flex-col h-full overflow-hidden">
                            <div className="relative aspect-[4/5] overflow-hidden bg-pagebg">
                                <img 
                                    src={getImageUrl(product.images && product.images.length > 0 ? product.images[0].download_url : null)} 
                                    alt={product.name} 
                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" 
                                    onError={(e) => e.target.src = getImageUrl(null)}
                                />
                                {product.stock_qty === 0 && (
                                    <div className="absolute inset-0 bg-white/80 backdrop-blur-sm flex items-center justify-center">
                                        <span className="border-2 border-error text-error px-4 py-2 font-serif uppercase tracking-widest">Sold Out</span>
                                    </div>
                                )}
                            </div> 
                            <div className="p-5 text-center flex flex-col flex-1">
                                <h4 className="font-serif text-lg text-textprimary mb-2 line-clamp-1 group-hover:text-primary transition-colors">{product.name}</h4>
                                <div className="text-primary font-bold text-xl font-sans mt-auto">
                                    {product.mrp > product.price && (
                                        <span className="text-sm text-red-500 line-through mr-2">₹{Number(product.mrp).toLocaleString()}</span>
                                    )}
                                    ₹{Number(product.price).toLocaleString()}
                                    {product.mrp > product.price && (
                                        <span className="text-xs text-green-600 ml-2">
                                            ({Math.round(((product.mrp - product.price) / product.mrp) * 100)}% OFF)
                                        </span>
                                    )}
                                </div>
                            </div>
                        </Link>
                    ))}
                    </div>

                    {/* Pagination Controls */}
                    {pagination.totalPages > 1 && (
                        <div className="flex justify-center mt-12 gap-4">
                            <button 
                                onClick={() => fetchProducts(pagination.page - 1)}
                                className="btn-outline px-6 py-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                                disabled={pagination.page === 1}
                            >
                                Previous
                            </button>
                            <span className="px-6 py-2 text-primary font-serif flex items-center border border-transparent">
                                Page {pagination.page} of {pagination.totalPages}
                            </span>
                            <button 
                                onClick={() => fetchProducts(pagination.page + 1)}
                                disabled={pagination.page === pagination.totalPages}
                                className="btn-outline px-6 py-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Next
                            </button>
                        </div>
                    )}
                </>
              ) : (
                <p className="text-sm text-gray-500 text-center py-10">No products found matching filters.</p>
              )}
            </div>
        </div>
      </div>
    </>
  );
}
