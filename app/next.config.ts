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
  // Кэширование статичных видео/превью карточек (public/videos): браузер держит их в кэше
  // и не перезагружает при повторном открытии карточки напитка. Загруженные медиа (/api/media)
  // кэшируются на стороне бэкенда (CachedStaticFiles).
  async headers() {
    return [
      {
        source: "/videos/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=604800, stale-while-revalidate=86400" }],
      },
    ];
  },
};

export default nextConfig;
