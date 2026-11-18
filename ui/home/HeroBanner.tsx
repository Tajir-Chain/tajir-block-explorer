// we use custom heading size for hero banner
// eslint-disable-next-line no-restricted-imports
import { Box, Flex, Heading, Text } from '@chakra-ui/react';
import React from 'react';

import config from 'configs/app';
import RewardsButton from 'ui/rewards/RewardsButton';
// import AdBanner from 'ui/shared/ad/AdBanner';
import SearchBar from 'ui/snippets/searchBar/SearchBarDesktop';
import SearchBarMobile from 'ui/snippets/searchBar/SearchBarMobile';
import UserProfileDesktop from 'ui/snippets/user/profile/UserProfileDesktop';
import UserWalletDesktop from 'ui/snippets/user/wallet/UserWalletDesktop';
import CopyToClipboard from 'ui/shared/CopyToClipboard';

// export const BACKGROUND_DEFAULT =
//   'radial-gradient(103.03% 103.03% at 0% 0%, rgba(183, 148, 244, 0.8) 0%, rgba(0, 163, 196, 0.8) 100%), var(--chakra-colors-blue-400)';
export const BACKGROUND_DEFAULT =
  "url('/assets/bg-hero.png') no-repeat center center / cover";
const TEXT_COLOR_DEFAULT = 'white';
const BORDER_DEFAULT = 'none';

const copyableHoverStyle = {
  color: 'white',
  _before: {
    content: `" "`,
    position: 'absolute' as const,
    top: '-2px',
    left: '-8px',
    width: 'calc(100% + 12px)',
    height: 'calc(100% + 4px)',
    borderRadius: 'base',
    borderColor: 'green.600',
    borderWidth: '1px',
    borderStyle: 'dashed',
    bgColor: 'green.900',
    zIndex: -1,
  },
};

const hasNetworkInfo = Boolean(config.chain.rpcUrls?.[0] || config.chain.id);

const HeroBanner = () => {

  const background = {
    _light:
      config.UI.homepage.heroBanner?.background?.[0] ||
      BACKGROUND_DEFAULT,
    _dark:
      config.UI.homepage.heroBanner?.background?.[1] ||
      config.UI.homepage.heroBanner?.background?.[0] ||
      BACKGROUND_DEFAULT,
  };

  const textColor = {
    _light:
      // light mode
      config.UI.homepage.heroBanner?.text_color?.[0] ||
      TEXT_COLOR_DEFAULT,
    // dark mode
    _dark:
      config.UI.homepage.heroBanner?.text_color?.[1] ||
      config.UI.homepage.heroBanner?.text_color?.[0] ||
      TEXT_COLOR_DEFAULT,
  };

  const border = {
    _light:
      config.UI.homepage.heroBanner?.border?.[0] || BORDER_DEFAULT,
    _dark:
      config.UI.homepage.heroBanner?.border?.[1] || config.UI.homepage.heroBanner?.border?.[0] || BORDER_DEFAULT,
  };

  return (
    <Flex
      w="100%"
      background={ background }
      border={ border }
      borderRadius="lg"
      p={{ base: 4, lg: 8 }}
      columnGap={ 8 }
      alignItems="center"
    >
      <Box flexGrow={ 1 } minW={ 0 } py={{ base: 4, lg: 4 }}>
        <Flex mb={{ base: 2, lg: 3 }} justifyContent="space-between" alignItems="center" columnGap={ 2 }>
          <Heading
            as="h1"
            fontSize={{ base: '18px', lg: '30px' }}
            lineHeight={{ base: '24px', lg: '36px' }}
            fontWeight={{ base: 500, lg: 700 }}
            color={ textColor }
          >
            {
              config.meta.seo.enhancedDataEnabled ?
                `${ config.app.nameLatest || config.chain.name } blockchain explorer` :
                `${ config.app.nameLatest || config.chain.name } explorer`
            }
          </Heading>
          { config.UI.navigation.layout === 'vertical' && (
            <Box display={{ base: 'none', lg: 'flex' }} gap={ 2 }>
              { config.features.rewards.isEnabled && <RewardsButton variant="hero"/> }
              {
                (config.features.account.isEnabled && <UserProfileDesktop buttonVariant="hero"/>) ||
                (config.features.blockchainInteraction.isEnabled && <UserWalletDesktop buttonVariant="hero"/>)
              }
            </Box>
          ) }
        </Flex>

        { /* Mobile: stacked network info so the URL can shrink and the copy icon stays fully visible */ }
        { hasNetworkInfo && (
          <Flex
            display={{ base: 'flex', lg: 'none' }}
            direction="column"
            alignItems="stretch"
            gap={ 2 }
            mb={ 3 }
            w="100%"
            minW={ 0 }
            bg="blackAlpha.400"
            backdropFilter="blur(12px)"
            borderRadius="md"
            border="1px solid"
            borderColor="whiteAlpha.200"
            py={ 2 }
            px={ 3 }
          >
            { config.chain.rpcUrls?.[0] && (
              <Box minW={ 0 }>
                <Text fontSize="2xs" fontWeight="medium" color="whiteAlpha.600">
                  RPC URL
                </Text>
                <Flex
                  alignItems="center"
                  minW={ 0 }
                  className="address-entity"
                  borderRadius="md"
                  cursor="pointer"
                  position="relative"
                  color="white"
                  _hover={ copyableHoverStyle }
                >
                  <Text
                    fontSize="xs"
                    color="inherit"
                    minW={ 0 }
                    overflow="hidden"
                    textOverflow="ellipsis"
                    whiteSpace="nowrap"
                  >
                    { config.chain.rpcUrls[0] }
                  </Text>
                  <CopyToClipboard
                    text={ config.chain.rpcUrls[0] }
                    boxSize={ 5 }
                    ml={ 1 }
                    flexShrink={ 0 }
                  />
                </Flex>
              </Box>
            ) }

            { config.chain.id && (
              <Box minW={ 0 }>
                <Text fontSize="2xs" fontWeight="medium" color="whiteAlpha.600">
                  Chain ID
                </Text>
                <Flex
                  alignItems="center"
                  minW={ 0 }
                  className="address-entity"
                  borderRadius="md"
                  cursor="pointer"
                  position="relative"
                  color="white"
                  _hover={ copyableHoverStyle }
                >
                  <Text fontSize="xs" color="inherit">
                    { config.chain.id }
                  </Text>
                  <CopyToClipboard
                    text={ String(config.chain.id) }
                    boxSize={ 5 }
                    ml={ 1 }
                    flexShrink={ 0 }
                  />
                </Flex>
              </Box>
            ) }
          </Flex>
        ) }

        <Box display={{ base: 'flex', lg: 'none' }}>
          <SearchBarMobile isHeroBanner/>
        </Box>
        <Box display={{ base: 'none', lg: 'flex' }} >
          <SearchBar isHeroBanner/>
        </Box>
      </Box>

      { /* Desktop: vertical side panel */ }
      { hasNetworkInfo && (
        <Flex
          display={{ base: 'none', lg: 'flex' }}
          direction="column"
          justifyContent="center"
          alignItems="flex-start"
          flexShrink={ 0 }
          bg="blackAlpha.400"
          backdropFilter="blur(12px)"
          borderRadius="md"
          border="1px solid"
          borderColor="whiteAlpha.200"
          py={ 2.5 }
          px={ 4 }
          gap={ 2 }
          boxShadow="0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)"
        >
          { config.chain.rpcUrls?.[0] && (
            <Box>
              <Text fontSize="xs" fontWeight="normal" color="whiteAlpha.700">
                RPC URL
              </Text>
              <Flex
                alignItems="center"
                className="address-entity"
                borderRadius="md"
                cursor="pointer"
                position="relative"
                color="white"
                _hover={ copyableHoverStyle }
              >
                <Text fontSize="xs" color="inherit" maxW="260px" overflow="hidden" textOverflow="ellipsis" whiteSpace="nowrap">
                  { config.chain.rpcUrls[0] }
                </Text>
                <CopyToClipboard
                  text={ config.chain.rpcUrls[0] }
                  boxSize={ 5 }
                  ml={ 1 }
                />
              </Flex>
            </Box>
          ) }

          { config.chain.id && (
            <Box>
              <Text fontSize="xs" fontWeight="normal" color="whiteAlpha.700">
                Chain ID
              </Text>
              <Flex
                alignItems="center"
                className="address-entity"
                borderRadius="md"
                cursor="pointer"
                position="relative"
                color="white"
                _hover={ copyableHoverStyle }
              >
                <Text fontSize="xs" color="inherit">
                  { config.chain.id }
                </Text>
                <CopyToClipboard
                  text={ String(config.chain.id) }
                  boxSize={ 5 }
                  ml={ 1 }
                />
              </Flex>
            </Box>
          ) }
        </Flex>
      ) }
    </Flex>
  );
};

export default React.memo(HeroBanner);

