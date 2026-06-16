import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  output: "standalone",
  experimental: {
    // dev: не сохранять сборку Turbopack на диск (.next) между сессиями — иначе после правок
    // CSS/кода dev-сервер мог отдавать УСТАРЕВШИЙ кэш (приходилось чистить .next вручную).
    // Холодный старт чуть медленнее, зато правки применяются сразу. Прод-сборку не трогает.
    turbopackFileSystemCacheForDev: false,
  },
};

export default nextConfig;
