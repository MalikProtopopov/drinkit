"use client";

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "*", "0", "⌫"];

export function NumPad({
  onPress,
  onBackspace,
}: {
  onPress: (digit: string) => void;
  onBackspace: () => void;
}) {
  return (
    <div className="grid grid-cols-3 gap-3 px-2 pb-safe">
      {KEYS.map((k) => {
        const isBack = k === "⌫";
        const isEmpty = k === "*";
        return (
          <button
            key={k}
            type="button"
            disabled={isEmpty}
            onClick={() => {
              if (isBack) onBackspace();
              else if (!isEmpty) onPress(k);
            }}
            className="h-14 rounded-2xl bg-[#F2F2F4] active:bg-[#E4E4E8] text-2xl font-semibold flex items-center justify-center transition disabled:opacity-0"
          >
            {isBack ? (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 5H10l-7 7 7 7h12a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2z" />
                <path d="M16 10l-5 5M11 10l5 5" />
              </svg>
            ) : (
              k
            )}
          </button>
        );
      })}
    </div>
  );
}
