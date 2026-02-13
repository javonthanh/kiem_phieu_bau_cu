/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "export", // Bắt buộc
  trailingSlash: true,
  //distDir: "out", // Thư mục xuất file tĩnh
  images: {
    unoptimized: true, // Electron không hỗ trợ Image Optimization của Next.js
  },
  typescript: {
    // !! CẢNH BÁO !!
    // Cho phép build hoàn tất ngay cả khi dự án có lỗi TypeScript.
    ignoreBuildErrors: true,
  },
};

module.exports = nextConfig;
