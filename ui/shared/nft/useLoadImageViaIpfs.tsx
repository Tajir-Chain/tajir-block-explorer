import React from 'react';

export default function useLoadImageViaIpfs() {
  return React.useCallback(async(url: string) => {
    // Keep Helia/libp2p out of the Next.js SSR graph — it pulls Node-only
    // protocol imports that break page data collection.
    const { verifiedFetch } = await import('@helia/verified-fetch');
    const response = await verifiedFetch(url);

    if (response.status !== 200) {
      throw new Error('Failed to load image');
    }

    const blob = await response.blob();
    const src = URL.createObjectURL(blob);
    return src;
  }, [ ]);
}
