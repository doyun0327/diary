import './DotsLoading.css';

type DotsLoadingProps = {
  className?: string;
  /** 접근성 문구 */
  label?: string;
};

/** . 이 순서대로 커졌다 작아지는 로딩 */
export default function DotsLoading({ className = '', label }: DotsLoadingProps) {
  return (
    <span
      className={`dots-loading${className ? ` ${className}` : ''}`}
      role="status"
      aria-live="polite"
      aria-label={label}
    >
      <span className="dots-loading__dot" aria-hidden />
      <span className="dots-loading__dot" aria-hidden />
      <span className="dots-loading__dot" aria-hidden />
    </span>
  );
}
