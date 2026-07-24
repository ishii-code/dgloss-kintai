import path from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaPlugin } from "@prisma/nextjs-monorepo-workaround-plugin";

const dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // ワークスペースの ESM ソースを Next 側でトランスパイルする。
  transpilePackages: [
    "@dgloss-kintai/contracts",
    "@dgloss-kintai/core",
    "@dgloss-kintai/api",
  ],
  // monorepo 全体をトレース基点にする（依存が repo ルート node_modules にあるため）。
  outputFileTracingRoot: path.join(dirname, "..", ".."),
  // Prisma のクエリエンジン(.so.node)は動的ロードされ静的トレースから漏れるため、
  // API ルートの関数バンドルに明示的に含める（Vercel の engine-not-found 対策）。
  outputFileTracingIncludes: {
    "/api/**/*": [
      "../../node_modules/.pnpm/@prisma+client*/node_modules/.prisma/client/*.so.node",
      "../../node_modules/.pnpm/@prisma+client*/node_modules/.prisma/client/schema.prisma",
    ],
  },
  // webpack 側でもエンジンをバンドル横へコピーする公式ワークアラウンド。
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.plugins = [...config.plugins, new PrismaPlugin()];
    }
    return config;
  },
};

export default nextConfig;
