# 勤怠システム（Next.js + Prisma）本番イメージ。
# モノレポを丸ごとビルドし、web を next start で提供する。起動時に Prisma マイグレーションを適用。
FROM node:22-bookworm-slim AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable
WORKDIR /app

# ---- 依存インストール＋ビルド ----
FROM base AS build
# lockfile を活かすため、まず manifest 群だけコピーして install（レイヤキャッシュ最適化）
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY packages/kintai-contracts/package.json packages/kintai-contracts/
COPY packages/kintai-core/package.json packages/kintai-core/
COPY packages/kintai-leave/package.json packages/kintai-leave/
COPY packages/kintai-compliance/package.json packages/kintai-compliance/
COPY packages/kintai-jobs/package.json packages/kintai-jobs/
COPY packages/kintai-api/package.json packages/kintai-api/
COPY packages/kintai-db/package.json packages/kintai-db/
COPY packages/kintai-connector-jinjer/package.json packages/kintai-connector-jinjer/
COPY packages/kintai-web/package.json packages/kintai-web/
RUN pnpm install --frozen-lockfile

# ソースを入れて全パッケージをビルド（db は prisma generate、web は next build）
COPY . .
RUN pnpm -r build

# ---- 実行 ----
FROM base AS runner
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /app ./
EXPOSE 3000
# 起動時: マイグレーション適用 →（任意）デモ従業員シード → web 起動。
# KINTAI_SEED_DEMO=true のときだけデモ従業員を投入する（本番の実データは jinjer 移行で用意）。
CMD ["sh", "-c", "pnpm --filter @dgloss-kintai/db exec prisma migrate deploy && { [ \"$KINTAI_SEED_DEMO\" = true ] && pnpm --filter @dgloss-kintai/db run seed || true; } && exec pnpm --filter @dgloss-kintai/web start -- --hostname 0.0.0.0 --port 3000"]
