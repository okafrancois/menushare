import Link from "next/link";

export function Brand() {
  return (
    <Link href="/" className="brand" aria-label="MenuShare, accueil">
      <span className="brand-mark">M</span>
      <span>
        MenuShare
        <small>Menus vivants</small>
      </span>
    </Link>
  );
}

