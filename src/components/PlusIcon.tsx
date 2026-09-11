interface PlusIconProps {
  size?: number;
  strokeWidth?: number | string;
  className?: string;
}

/** 공통 + 아이콘 */
function PlusIcon({ size = 22, strokeWidth = 2.25, className }: PlusIconProps) {
  return (
    <svg
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </svg>
  );
}

export default PlusIcon;
