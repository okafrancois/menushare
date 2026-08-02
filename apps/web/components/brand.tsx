import Link from "next/link";

export function Brand() {
  return (
    <Link href="/" className="brand" aria-label="MenuShare, accueil">
      <img className="brand-mark" src="/icon.svg" alt="" />
      <span>
        MenuShare
        <small>Menus vivants</small>
      </span>
    </Link>
  );
}
