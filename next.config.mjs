/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      // Cloudinary / Vercel Blob do të shtohen këtu kur të konfigurohet storage
      { protocol: "https", hostname: "res.cloudinary.com" },
      { protocol: "https", hostname: "**.public.blob.vercel-storage.com" },
    ],
  },
};

export default nextConfig;
