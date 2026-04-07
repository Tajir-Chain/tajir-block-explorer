import { Flex, Separator, Box, HStack } from '@chakra-ui/react';
import React from 'react';

import config from 'configs/app';
import { useMultichainContext } from 'lib/contexts/multichain';
import useAccount from 'lib/web3/useAccount';
import useIsMobile from 'lib/hooks/useIsMobile';
import useProvider from 'lib/web3/useProvider';
import { CONTENT_MAX_WIDTH } from 'ui/shared/layout/utils';
import NetworkAddToWallet from 'ui/shared/NetworkAddToWallet';

import DeFiDropdown from './DeFiDropdown';
import NetworkMenu from './NetworkMenu';
import Settings from './settings/Settings';
import TopBarStats from './TopBarStats';

const TopBar = () => {
  const web3 = useProvider();
  const isMobile = useIsMobile();
  const { chainId: accountChainId } = useAccount();
  const multichainContext = useMultichainContext();
  const chainConfig = multichainContext?.chain.app_config ?? config;
  const [currentChainId, setCurrentChainId] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (accountChainId) {
      setCurrentChainId(accountChainId.toString());
      return;
    }

    const provider = web3.data?.provider;
    if (!provider) return;

    const fetchChainId = async () => {
      try {
        const chainId = (await provider.request({
          method: "eth_chainId",
        })) as string;
        setCurrentChainId(chainId);
      } catch (error) {
        console.error("Failed to fetch chainId", error);
      }
    };

    fetchChainId();

    const handleChainChanged = (chainId: string) => {
      setCurrentChainId(chainId);
    };

    provider.on("chainChanged", handleChainChanged);

    return () => {
      if (provider.removeListener) {
        provider.removeListener("chainChanged", handleChainChanged);
      }
    };
  }, [accountChainId, web3.data?.provider]);

  const isChainAlreadyAdded =
    currentChainId &&
    chainConfig.chain.id &&
    Number(currentChainId) === Number(chainConfig.chain.id);

  const hasAddChainButton = Boolean(
    !isChainAlreadyAdded &&
    web3.data?.provider &&
    web3.data?.wallet &&
    chainConfig.chain.rpcUrls.length &&
    chainConfig.features.web3Wallet.isEnabled &&
    !chainConfig.features.opSuperchain.isEnabled &&
    !isMobile,
  );
  const hasDeFiDropdown = Boolean(config.features.deFiDropdown.isEnabled);


  return (
    // not ideal if scrollbar is visible, but better than having a horizontal scroll
    <Box bgColor={{ _light: 'theme.topbar.bg._light', _dark: 'black' }} position="sticky" left={0} width="100%" maxWidth="100vw"
      borderBottomWidth="1px"
      borderColor="border.divider"
    >
      <Flex
        py={3}
        px={{ base: 3, lg: 6 }}
        m="0 auto"
        justifyContent="space-between"
        alignItems="center"
        maxW={`${CONTENT_MAX_WIDTH}px`}
      >
        <HStack gap={0} fontSize="xs">
          {Boolean(config.UI.featuredNetworks.items) && <NetworkMenu />}
          {!config.features.opSuperchain.isEnabled ? <TopBarStats /> : <div />}
        </HStack>
        <HStack
          alignItems="center"
          separator={<Separator mx={{ base: 2, lg: 3 }} height={4} />}
        >
          {(hasAddChainButton || hasDeFiDropdown) && (
            <HStack>
              {hasAddChainButton && <NetworkAddToWallet source="Top bar" />}
              {hasDeFiDropdown && <DeFiDropdown />}
            </HStack>
          )}
          <Settings />
        </HStack>
      </Flex>
    </Box>
  );
};

export default React.memo(TopBar);
