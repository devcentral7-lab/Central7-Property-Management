import type { ReactNode } from "react";
import { WHATSAPP_PATH, whatsappHref } from "@/lib/whatsapp";

export function WhatsAppIcon({ className = "h-3.5 w-3.5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <path d={WHATSAPP_PATH} />
    </svg>
  );
}

/** Small green WhatsApp button that opens a chat with the number. Renders nothing for unusable numbers. */
export function WhatsAppLink({ phone, className = "" }: { phone: string | null | undefined; className?: string }) {
  const href = whatsappHref(phone);
  if (!href) return null;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      data-nav-skip
      title="Chat on WhatsApp"
      aria-label={`Chat with ${phone} on WhatsApp`}
      className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[#25D366] transition hover:bg-[#25D366]/15 hover:text-[#128C7E] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#25D366]/40 ${className}`}
    >
      <WhatsAppIcon className="h-4 w-4" />
    </a>
  );
}

/** Phone number followed by its WhatsApp button. */
export function PhoneWithWhatsApp({
  phone,
  children,
  className = "",
}: {
  phone: string;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <span className={`inline-flex max-w-full items-center gap-1 align-middle ${className}`}>
      <span className="min-w-0 truncate">{children ?? phone}</span>
      <WhatsAppLink phone={phone} />
    </span>
  );
}
