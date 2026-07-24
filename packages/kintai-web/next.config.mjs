import { PrismaPlugin } from "@prisma/nextjs-monorepo-workaround-plugin";

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
  // monorepo のサーバレス配置で Prisma のクエリエンジン(.so.node)を
  // バンドル横へコピーする公式ワークアラウンド（Vercel の engine-not-found 対策）。
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.plugins = [...config.plugins, new PrismaPlugin()];
    }
    return config;
  },
};

export default nextConfig;
