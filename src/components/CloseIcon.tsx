interface CloseIconProps {
  size?: number;
  strokeWidth?: number | string;
  className?: string;
}

/** 시트/메뉴 공통 닫기(X) 아이콘 */
function CloseIcon({ size = 18, strokeWidth = 2.4, className }: CloseIconProps) {
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
      aria-hidden
    >
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  );
}

export default CloseIcon;
