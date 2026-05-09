/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: { remotePatterns: [{ protocol: "https", hostname: "**" }] },
  transpilePackages: ["react-markdown", "remark-gfm"],
  // Next.js 14.x：让 webpack 不打包这些 Node.js 原生模块（对 Route Handlers 也生效）
  serverExternalPackages: ["@libsql/client", "@prisma/adapter-libsql"],
  experimental: {
    serverComponentsExternalPackages: ["@libsql/client", "@prisma/adapter-libsql"],
  },
};
export default nextConfig;
