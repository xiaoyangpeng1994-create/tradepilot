/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: { remotePatterns: [{ protocol: "https", hostname: "**" }] },
  transpilePackages: ["react-markdown", "remark-gfm"],
  experimental: {
    // Next.js 14：让 webpack 不打包这些 Node.js 原生模块，保持运行时 require
    serverComponentsExternalPackages: ["@libsql/client", "@prisma/adapter-libsql"],
  },
};
export default nextConfig;
