const PUBLIC_APPNAME = 'reliefweb.int--aipae7quahJea3ode';

export function reliefWebAppName(): string {
  const configured = process.env.AGENTS_RELIEFWEB_APPNAME?.trim();
  return configured && configured.length > 0 ? configured : PUBLIC_APPNAME;
}
