import React from 'react';
import { Helmet } from 'react-helmet';

const SeoHelmet = ({
  title,
  description,
  url,
  imageUrl,
  productData = null // For JSON-LD product schema
}) => {
  const defaultTitle = "JB IT Solutions - Premium Electronics";
  const defaultDescription = "Discover the latest electronics, laptops, mobiles, and accessories at JB IT Solutions. Best prices and warranty guaranteed.";
  const defaultImageUrl = "https://placehold.co/1200x630?text=JB+IT+Solutions"; // Generic image for social shares
  const defaultUrl = window.location.href;

  const pageTitle = title ? `${title} – JB IT Solutions` : defaultTitle;
  const pageDescription = description || defaultDescription;
  const pageUrl = url || defaultUrl;
  const pageImageUrl = imageUrl || defaultImageUrl;

  // JSON-LD Product Schema
  const jsonLdSchema = productData ? {
    "@context": "https://schema.org/",
    "@type": "Product",
    "name": productData.name,
    "image": productData.images.map(img => img.url),
    "description": productData.description,
    "sku": productData.sku,
    "brand": {
      "@type": "Brand",
      "name": productData.brandName
    },
    "offers": {
      "@type": "Offer",
      "url": productData.url,
      "priceCurrency": "INR",
      "price": productData.price,
      "availability": productData.inStock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      "itemCondition": "https://schema.org/NewCondition"
    }
  } : null;

  return (
    <Helmet>
      <title>{pageTitle}</title>
      <meta name="description" content={pageDescription} />
      <link rel="canonical" href={pageUrl} />

      {/* Open Graph / Facebook */}
      <meta property="og:type" content="website" />
      <meta property="og:url" content={pageUrl} />
      <meta property="og:title" content={pageTitle} />
      <meta property="og:description" content={pageDescription} />
      <meta property="og:image" content={pageImageUrl} />

      {/* Twitter */}
      <meta property="twitter:card" content="summary_large_image" />
      <meta property="twitter:url" content={pageUrl} />
      <meta property="twitter:title" content={pageTitle} />
      <meta property="twitter:description" content={pageDescription} />
      <meta property="twitter:image" content={pageImageUrl} />

      {/* JSON-LD for Product */}
      {jsonLdSchema && (
        <script type="application/ld+json">
          {JSON.stringify(jsonLdSchema)}
        </script>
      )}
    </Helmet>
  );
};

export default SeoHelmet;
