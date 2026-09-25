import React from 'react';

import type { FeaturedNetwork } from 'types/networks';
import { NETWORK_GROUPS } from 'types/networks';

import * as mixpanel from 'lib/mixpanel/index';
import { useDisclosure } from 'toolkit/hooks/useDisclosure';

const NETWORKS: Array<FeaturedNetwork> = [
  {
    title: 'Mainnet',
    url: 'https://tjrscan.com/',
    group: 'Mainnets',
  },
  {
    title: 'Testnet',
    url: 'https://testnet.tjrscan.com/',
    group: 'Testnets',
  },
];

export default function useNetworkMenu() {
  const { open, onClose, onOpen, onOpenChange, onToggle } = useDisclosure();

  const handleOpenChange = React.useCallback((details: { open: boolean }) => {
    if (details.open) {
      mixpanel.logEvent(mixpanel.EventTypes.BUTTON_CLICK, { Content: 'Network menu', Source: 'Header' });
    }
    onOpenChange(details);
  }, [ onOpenChange ]);

  return React.useMemo(() => ({
    open,
    onClose,
    onOpen,
    onToggle,
    onOpenChange: handleOpenChange,
    isPending: false,
    data: NETWORKS,
    availableTabs: NETWORK_GROUPS.filter((tab) => NETWORKS.some(({ group }) => group === tab)),
  }), [ open, onClose, onOpen, onToggle, handleOpenChange ]);
}
