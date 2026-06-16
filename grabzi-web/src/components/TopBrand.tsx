"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Icon } from "./Icon";

/** Логотип GRABZI — фирменный маскот-лого grabzi.ae (line-art). size = высота в px. */
export function Wordmark({ size = 26 }: { size?: number }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src="/brand/logo.png" alt="GRABZI" style={{ height: size, width: "auto", display: "block" }} />
  );
}

/**
 * Тонкая брендовая шапка (НЕ навбар — без меню-ссылок): опциональная стрелка «назад»
 * + логотип-словомарк, ведущий на главную. Снимает «тупики» после удаления навбара.
 */
export function TopBrand({ back = true }: { back?: boolean }) {
  const router = useRouter();
  return (
    <header style={{
      display: "flex", alignItems: "center", gap: 12,
      paddingBlock: 12, paddingInline: 4, marginBlockEnd: 4,
    }}>
      {back && (
        <button onClick={() => router.back()} aria-label="Back"
          style={{
            inlineSize: 40, blockSize: 40, borderRadius: 9999, display: "grid", placeItems: "center",
            background: "var(--color-paper)", border: "1px solid var(--color-border)", color: "var(--color-brand)",
          }}>
          <Icon name="chevron-left" size={20} stroke={2.2} />
        </button>
      )}
      <div style={{ flex: 1 }} />
      {/* мелкий лого — справа вверху */}
      <Link href="/" aria-label="GRABZI home" style={{ display: "inline-flex", alignItems: "center" }}>
        <Wordmark size={38} />
      </Link>
    </header>
  );
}
