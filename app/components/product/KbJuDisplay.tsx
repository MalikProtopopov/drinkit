export function KbJuDisplay({ value, label, unit }: { value: string | number; label: string; unit?: string }) {
  return (
    <div className="text-center text-white flex-1">
      <div className="font-extrabold text-[19px] leading-tight">
        {value}
        {unit && <span className="text-[12.5px] font-bold opacity-80"> {unit}</span>}
      </div>
      <div className="text-[12.5px] leading-tight mt-0.5 font-semibold opacity-70">{label}</div>
    </div>
  );
}
