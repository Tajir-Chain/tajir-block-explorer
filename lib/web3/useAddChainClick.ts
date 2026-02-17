import React from 'react';

import config from 'configs/app';
import { useMultichainContext } from 'lib/contexts/multichain';
import * as mixpanel from 'lib/mixpanel/index';
import { toaster } from 'toolkit/chakra/toaster';

import useAddChain from './useAddChain';
import useProvider from './useProvider';
import useSwitchChain from './useSwitchChain';
import { getHexadecimalChainId } from './utils';

interface Props {
  source: 'Footer' | 'Top bar' | 'Chain widget';
  onSuccess?: () => void;
}

export default function useAddChainClick({ source, onSuccess }: Props) {
  const { data: { wallet, provider } = {} } = useProvider();
  const addChain = useAddChain();
  const switchChain = useSwitchChain();
  const multichainContext = useMultichainContext();
  const chainConfig = multichainContext?.chain.app_config ?? config;

  return React.useCallback(async () => {
    if (!wallet || !provider) {
      return;
    }

    try {
      // Check if the wallet is already on the target chain
      const currentChainId = await provider.request({ method: 'eth_chainId' }) as string;
      const targetChainId = chainConfig.chain.id ? getHexadecimalChainId(Number(chainConfig.chain.id)) : null;

      if (targetChainId && currentChainId.toLowerCase() === targetChainId.toLowerCase()) {
        toaster.info({
          title: 'Already Added',
          description: 'This network is already added to your wallet',
        });
        return;
      }

      await addChain();
      await switchChain();

      toaster.success({
        title: 'Success',
        description: 'Successfully added network to your wallet',
      });

      mixpanel.logEvent(mixpanel.EventTypes.ADD_TO_WALLET, {
        Target: 'network',
        Wallet: wallet,
        Source: source,
      });

      onSuccess?.();
    } catch (error) {
      toaster.error({
        title: 'Error',
        description: (error as Error)?.message || 'Something went wrong',
      });
    }
  }, [addChain, provider, wallet, switchChain, source, onSuccess, chainConfig]);
}
