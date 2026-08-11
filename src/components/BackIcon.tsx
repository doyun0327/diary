interface BackIconProps {
  size?: number;
  strokeWidth?: number | string;
  className?: string;
}

/** 프로젝트 공통 뒤로가기 쉐브론 */
function BackIcon({ size = 20, strokeWidth = 2, className }: BackIconProps) {
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
      <path d="M15 18l-6-6 6-6" />
    </svg>
  );
}

export default BackIcon;
