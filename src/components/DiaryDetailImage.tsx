interface DiaryDetailImageProps {
  src: string;
  alt: string;
}

export default function DiaryDetailImage({ src, alt }: DiaryDetailImageProps) {
  return (
    <div className="diary-detail__image">
      <img src={src} alt={alt} decoding="async" />
    </div>
  );
}
