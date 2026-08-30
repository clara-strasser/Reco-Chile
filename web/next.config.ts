import createNextIntlPlugin from "next-intl/plugin";

import type { NextConfig } from "next";

const nextConfig: NextConfig = {/* config options here */};

// Wires `i18n/request.ts` (the default path) into the build so that server
// components can resolve messages for the active `[locale]` segment.
const withNextIntl = createNextIntlPlugin();

export default withNextIntl(nextConfig);
