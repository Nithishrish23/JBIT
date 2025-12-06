
import React, { useState, useEffect } from "react";
import { Helmet } from "react-helmet";
import { useNavigate } from "react-router-dom";
import api from "../../api/client";

export default function SellerAddProduct() {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [mrp, setMrp] = useState("");
  const [stock, setStock] = useState("");
  const [sku, setSku] = useState("");
  const [brand, setBrand] = useState("");
  const [specifications, setSpecifications] = useState([{ key: "", value: "" }]);
  const [categoryId, setCategoryId] = useState("");
  const [images, setImages] = useState([]);
  const [categories, setCategories] = useState([]);
  const [error, setError] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    api.get("/api/seller/categories").then((res) => {
      setCategories(res.data);
      if (res.data.length > 0) {
        setCategoryId(res.data[0].id);
      }
    });
  }, []);

  const handleSpecChange = (index, field, value) => {
    const newSpecs = [...specifications];
    newSpecs[index][field] = value;
    setSpecifications(newSpecs);
  };

  const addSpecRow = () => {
    setSpecifications([...specifications, { key: "", value: "" }]);
  };

  const removeSpecRow = (index) => {
    const newSpecs = specifications.filter((_, i) => i !== index);
    setSpecifications(newSpecs);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    // Convert specs array to object
    const specsObj = {};
    specifications.forEach(item => {
        if (item.key.trim()) specsObj[item.key.trim()] = item.value;
    });

    const formData = new FormData();
    formData.append("name", name);
    formData.append("description", description);
    formData.append("price", price);
    formData.append("mrp", mrp);
    formData.append("stock_qty", stock); 
    formData.append("sku", sku);
    formData.append("brand", brand);
    formData.append("specifications", JSON.stringify(specsObj));
    formData.append("category_id", categoryId);
    for (let i = 0; i < images.length; i++) {
      formData.append("files", images[i]);
    }

    try {
      await api.post("/api/seller/products", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });
      navigate("/seller/products");
    } catch (err) {
      setError("Failed to add product. Please check your input.");
      console.error(err);
    }
  };

  const handleGenerateFromText = async () => {
    const input = name.trim() || description.trim();
    if (!input) {
        alert("Please enter a product name or description first.");
        return;
    }
    setAiLoading(true);
    try {
        const res = await api.post('/api/ai/generate-from-text', { text: input });
        if (res.data.title) setName(res.data.title);
        if (res.data.description) setDescription(res.data.description);
    } catch (err) {
        alert(err.response?.data?.error || "AI generation failed.");
    } finally {
        setAiLoading(false);
    }
  };

  const handleGenerateFromImage = async () => {
    if (images.length === 0) {
        alert("Please upload an image first.");
        return;
    }
    setAiLoading(true);
    const formData = new FormData();
    formData.append("image", images[0]); // Send the first image
    try {
        const res = await api.post('/api/ai/generate-from-image', formData, {
            headers: { "Content-Type": "multipart/form-data" },
        });
        if (res.data.title) setName(res.data.title);
        if (res.data.description) setDescription(res.data.description);
        if (res.data.category_hint) {
            const suggestedCategory = categories.find(cat => cat.name.toLowerCase().includes(res.data.category_hint.toLowerCase()));
            if (suggestedCategory) {
                setCategoryId(suggestedCategory.id);
            }
        }
    } catch (err) {
        alert(err.response?.data?.error || "AI image analysis failed.");
    } finally {
        setAiLoading(false);
    }
  };

  // Auto-trigger AI on image upload
  useEffect(() => {
    if (images.length > 0 && !name && !description) {
        handleGenerateFromImage();
    }
  }, [images]);


  return (
    <>
      <Helmet>
        <title>Add New Product</title>
      </Helmet>
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold">Add New Product</h1>
        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-xl shadow p-5 w-full max-w-2xl space-y-4 text-sm"
        >
          {error && <div className="text-red-600 text-xs">{error}</div>}
          <div>
            <label className="block mb-1 text-xs font-medium">Product Name</label>
            <input
              className="border rounded w-full px-3 py-2"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
                <label className="block mb-1 text-xs font-medium">SKU</label>
                <input
                className="border rounded w-full px-3 py-2"
                value={sku}
                onChange={(e) => setSku(e.target.value)}
                placeholder="Stock Keeping Unit"
                />
            </div>
            <div>
                <label className="block mb-1 text-xs font-medium">Brand</label>
                <input
                className="border rounded w-full px-3 py-2"
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
                placeholder="Brand Name"
                />
            </div>
          </div>
          <div>
            <label className="block mb-1 text-xs font-medium">Description</label>
            <div className="relative">
                <textarea
                className="border rounded w-full px-3 py-2 pb-8"
                rows="4"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe your masterpiece..."
                required
                ></textarea>
                <button 
                    type="button" 
                    onClick={handleGenerateFromText}
                    disabled={aiLoading}
                    className="absolute bottom-2 right-2 text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded hover:bg-purple-200 flex items-center gap-1 transition-colors"
                    title="Generate/Enhance with AI"
                >
                    <span className="material-symbols-outlined text-[14px]">auto_awesome</span>
                    {aiLoading ? 'Thinking...' : 'AI Writer'}
                </button>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block mb-1 text-xs font-medium">Price (Selling)</label>
              <input type="number" className="border rounded w-full px-3 py-2" value={price} onChange={(e) => setPrice(e.target.value)} required />
            </div>
            <div>
              <label className="block mb-1 text-xs font-medium">MRP</label>
              <input type="number" className="border rounded w-full px-3 py-2" value={mrp} onChange={(e) => setMrp(e.target.value)} placeholder="Optional" />
            </div>
            <div>
              <label className="block mb-1 text-xs font-medium">Stock</label>
              <input type="number" className="border rounded w-full px-3 py-2" value={stock} onChange={(e) => setStock(e.target.value)} required />
            </div>
            <div>
              <label className="block mb-1 text-xs font-medium">Category</label>
              <select className="border rounded w-full px-3 py-2 bg-white" value={categoryId} onChange={(e) => setCategoryId(e.target.value)} required>
                {categories.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block mb-1 text-xs font-medium">Specifications</label>
            {specifications.map((spec, index) => (
                <div key={index} className="flex gap-2 mb-2">
                    <input 
                        placeholder="Key (e.g. Material)" 
                        className="border rounded w-1/3 px-2 py-1"
                        value={spec.key}
                        onChange={(e) => handleSpecChange(index, 'key', e.target.value)}
                    />
                    <input 
                        placeholder="Value (e.g. Teak Wood)" 
                        className="border rounded w-1/3 px-2 py-1"
                        value={spec.value}
                        onChange={(e) => handleSpecChange(index, 'value', e.target.value)}
                    />
                    <button type="button" onClick={() => removeSpecRow(index)} className="text-red-500 text-xs">Remove</button>
                </div>
            ))}
            <button type="button" onClick={addSpecRow} className="text-blue-600 text-xs">+ Add Specification</button>
          </div>

          <div>
            <label className="block mb-1 text-xs font-medium">Product Images</label>
            <input type="file" multiple onChange={(e) => setImages(Array.from(e.target.files))} className="text-xs" />
          </div>

          <div className="flex gap-4">
            <button type="button" onClick={handleGenerateFromText} disabled={aiLoading || !name.trim()} className="flex-1 bg-blue-500 text-white rounded py-2 text-sm hover:bg-blue-600 disabled:opacity-50">
                {aiLoading ? 'Generating...' : 'Suggest from Name'}
            </button>
            <button type="button" onClick={handleGenerateFromImage} disabled={aiLoading || images.length === 0} className="flex-1 bg-purple-500 text-white rounded py-2 text-sm hover:bg-purple-600 disabled:opacity-50">
                {aiLoading ? 'Analyzing Image...' : 'Suggest from Image'}
            </button>
          </div>
          
          <button type="submit" className="w-full bg-slate-900 text-white rounded py-2 text-sm">
            Add Product
          </button>
        </form>
      </div>
    </>
  );
}
