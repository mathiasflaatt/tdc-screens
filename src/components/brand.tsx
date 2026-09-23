type WordmarkProps = { label?: string };

/** TDC pixel wordmark (T · long D · C) from the website's letter assets. */
export function Wordmark({ label }: WordmarkProps) {
  const a11y = label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true };
  return (
    <span className="tdc-wordmark" {...a11y}>
      <span className="tdc-wordmark__letter tdc-wordmark__letter--t" />
      <span className="tdc-wordmark__letter tdc-wordmark__letter--d" />
      <span className="tdc-wordmark__letter tdc-wordmark__letter--c" />
    </span>
  );
}

/** Wordmark linking to the screen selector, for non-kiosk pages. */
export function BrandLink({ href = '/' }: { href?: string }) {
  return (
    <a className="brand-link" href={href} aria-label="TDC 2026 conference displays">
      <Wordmark />
    </a>
  );
}
