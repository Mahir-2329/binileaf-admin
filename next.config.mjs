/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  images: {
    formats: ['image/webp'],
    // Photographs are served signed (`/media/…?k=…`). Next 16 refuses a query
    // string on a local image unless a pattern says otherwise, and a pattern
    // with no `search` allows any — the second entry keeps the default for
    // everything else.
    localPatterns: [{ pathname: '/media/**' }, { pathname: '/**', search: '' }],
    deviceSizes: [360, 640, 828, 1080, 1200, 1600],
    imageSizes: [48, 64, 96, 128, 200, 256, 320, 384],
  },
  // The admin is never indexed and never cached at the edge.
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'same-origin' },
        ],
      },
    ];
  },
};

export default nextConfig;
