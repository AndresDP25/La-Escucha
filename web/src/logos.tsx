/**
 * Logos de cuentas. El archivo va en web/public/logos/.
 * Para sumar uno: copiar la imagen ahí y agregar el slug en LOGOS.
 * Si dos cuentas comparten marca, apuntan al mismo archivo.
 */
const LOGOS: Record<string, string> = {
  'pro-argentina': '/logos/pro.jpg',
  'pro-ciudad': '/logos/pro.jpg',
  'san-fernando': '/logos/sanfer.jpg',
};

export function accountLogo(slug: string | null | undefined): string | null {
  if (!slug) return null;
  return LOGOS[slug] ?? null;
}

export function AccountLogo({
  slug,
  size = 28,
}: {
  slug?: string | null;
  size?: number;
}) {
  const src = accountLogo(slug);
  if (!src) return null;
  return (
    <img
      className="account-logo"
      src={src}
      alt=""
      width={size}
      height={size}
    />
  );
}
