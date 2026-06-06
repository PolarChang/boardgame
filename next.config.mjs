/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "cf.geekdo-images.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "boardgamegeek.com",
        pathname: "/**",
      },
    ],
  },
};

export default nextConfig;
