type LogoProps = {
  wordmark?: boolean;
  className?: string;
};

export function Logo({ wordmark = true, className }: LogoProps) {
  const classes = className ? `logo ${className}` : 'logo';

  return (
    <span className={classes}>
      <svg
        className="logo-mark"
        viewBox="0 0 48 48"
        fill="currentColor"
        aria-hidden="true"
      >
        <path d="M3 12l19 9L45 7 32 29 22 41l-4-17z" />
        <path d="m23 22 9 7" stroke="var(--background)" strokeWidth="2" />
      </svg>
      {wordmark ? <span className="logo-word">SupplyEagle</span> : null}
    </span>
  );
}
