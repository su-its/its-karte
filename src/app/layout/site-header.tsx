import Link from "next/link";
import Image from "next/image";

export function SiteHeader() {
  return (
    <header className="border-b bg-background">
      <div className="flex h-16 items-center px-8 gap-5">
        <Link href="/" className="flex items-center gap-3 font-bold text-lg tracking-tight">
          <Image src="/icon.png" alt="ITS" width={36} height={36} className="rounded" />
          ITS 電子カルテ管理システム
        </Link>
      </div>
    </header>
  );
}
