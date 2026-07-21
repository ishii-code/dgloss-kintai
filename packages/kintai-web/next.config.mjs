/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // ワークスペースの ESM ソースを Next 側でトランスパイルする。
  transpilePackages: [
    "@dgloss-kintai/contracts",
    "@dgloss-kintai/core",
    "@dgloss-kintai/api",
  ],
  // Prisma 系はバンドルせず外部モジュールとして扱う（動的 import 時のみ実ロード）。
  serverExternalPackages: ["@prisma/client", "@dgloss-kintai/db"],
};

export default nextConfig;
