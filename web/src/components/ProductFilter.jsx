
import React from 'react';

export default function ProductFilter({ 
    categories = [], 
    filters, 
    onFilterChange, 
    showCategory = true 
}) {
    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        onFilterChange(name, type === 'checkbox' ? checked : value);
    };

    return (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-primary/10 space-y-8 h-fit sticky top-24">
            <div className="flex items-center justify-between">
                <h3 className="font-serif text-xl text-primary">Filters</h3>
                <button 
                    onClick={() => onFilterChange('reset')}
                    className="text-sm text-gray-500 hover:text-primary underline"
                >
                    Reset
                </button>
            </div>

            {/* Sort By */}
            <div className="space-y-3">
                <h4 className="font-semibold text-sm text-gray-900 uppercase tracking-wider">Sort By</h4>
                <div className="relative">
                    <select 
                        name="sort_by" 
                        value={filters.sort_by || 'relevance'} 
                        onChange={handleChange}
                        className="w-full pl-3 pr-8 py-2 border border-primary/20 rounded-lg focus:outline-none focus:border-primary text-sm appearance-none bg-transparent cursor-pointer"
                    >
                        <option value="relevance">Relevance</option>
                        <option value="price_low_high">Price: Low to High</option>
                        <option value="price_high_low">Price: High to Low</option>
                        <option value="popularity">Popularity</option>
                        <option value="newest">Newest Arrivals</option>
                    </select>
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-500">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                    </div>
                </div>
            </div>

            {/* Availability */}
            <div className="space-y-3">
                <h4 className="font-semibold text-sm text-gray-900 uppercase tracking-wider">Availability</h4>
                <label className="flex items-center gap-3 cursor-pointer group">
                    <div className="relative flex items-center">
                        <input 
                            type="checkbox" 
                            name="in_stock" 
                            checked={filters.in_stock || false} 
                            onChange={handleChange}
                            className="peer h-5 w-5 cursor-pointer appearance-none rounded border border-primary/30 shadow transition-all checked:border-primary checked:bg-primary hover:shadow-md"
                        />
                        <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-white opacity-0 peer-checked:opacity-100">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                        </span>
                    </div>
                    <span className="text-gray-700 group-hover:text-primary transition-colors">In Stock Only</span>
                </label>
            </div>

            {/* Price Range */}
            <div className="space-y-3">
                <h4 className="font-semibold text-sm text-gray-900 uppercase tracking-wider">Price Range</h4>
                <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">₹</span>
                        <input 
                            type="number" 
                            name="min_price" 
                            value={filters.min_price || ''} 
                            onChange={handleChange} 
                            placeholder="Min"
                            className="w-full pl-6 pr-2 py-2 border border-primary/20 rounded-lg focus:outline-none focus:border-primary text-sm"
                        />
                    </div>
                    <span className="text-gray-400">-</span>
                    <div className="relative flex-1">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">₹</span>
                        <input 
                            type="number" 
                            name="max_price" 
                            value={filters.max_price || ''} 
                            onChange={handleChange} 
                            placeholder="Max"
                            className="w-full pl-6 pr-2 py-2 border border-primary/20 rounded-lg focus:outline-none focus:border-primary text-sm"
                        />
                    </div>
                </div>
            </div>

            {/* Categories */}
            {showCategory && categories.length > 0 && (
                <div className="space-y-3">
                    <h4 className="font-semibold text-sm text-gray-900 uppercase tracking-wider">Category</h4>
                    <div className="flex flex-col gap-2 max-h-[300px] overflow-y-auto custom-scrollbar pr-2">
                        <label className="flex items-center gap-3 cursor-pointer group">
                            <input 
                                type="radio" 
                                name="category" 
                                value="" 
                                checked={!filters.category} 
                                onChange={handleChange}
                                className="hidden"
                            />
                            <span className={`text-sm transition-colors ${!filters.category ? 'text-primary font-bold' : 'text-gray-600 group-hover:text-primary'}`}>
                                All Categories
                            </span>
                        </label>
                        {categories.map(cat => (
                            <label key={cat.id} className="flex items-center gap-3 cursor-pointer group">
                                <input 
                                    type="radio" 
                                    name="category" 
                                    value={cat.slug} 
                                    checked={filters.category === cat.slug} 
                                    onChange={handleChange}
                                    className="hidden"
                                />
                                <span className={`text-sm transition-colors ${filters.category === cat.slug ? 'text-primary font-bold' : 'text-gray-600 group-hover:text-primary'}`}>
                                    {cat.name}
                                </span>
                            </label>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
