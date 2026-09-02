import React from 'react';
import { Helmet } from 'react-helmet';

// Social + canonical tags only. The page's own <Helmet> must keep a literal
// <title> and <meta name="description">, because the llms.txt build step reads
// those two tags straight out of the page file's source.
const Seo = ({ title, description, image, url, siteName, type = 'website' }) => {
    const origin = window.location.origin;
    const canonical = url || origin + window.location.pathname;
    const imageUrl = image
        ? (/^https?:\/\//i.test(image) ? image : origin + (image.startsWith('/') ? image : `/${image}`))
        : '';

    return (
        <Helmet>
            <link rel="canonical" href={canonical} />
            <meta property="og:url" content={canonical} />
            <meta property="og:locale" content="fr_FR" />
            <meta property="og:type" content={type} />
            {siteName && <meta property="og:site_name" content={siteName} />}
            {title && <meta property="og:title" content={title} />}
            {description && <meta property="og:description" content={description} />}
            {imageUrl && <meta property="og:image" content={imageUrl} />}
            <meta name="twitter:card" content={imageUrl ? 'summary_large_image' : 'summary'} />
            {title && <meta name="twitter:title" content={title} />}
            {description && <meta name="twitter:description" content={description} />}
            {imageUrl && <meta name="twitter:image" content={imageUrl} />}
        </Helmet>
    );
}

export default Seo;

export { Seo };
