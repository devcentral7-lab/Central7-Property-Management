import Image from "next/image";

export function BrandLogo({
  size = 32,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
  return (
    <Image
      src="/logo.jpg"
      alt="Central 7"
      width={size}
      height={size}
      priority
      className={`shrink-0 rounded-md object-cover ${className}`}
      style={{ width: size, height: size }}
    />
  );
}
