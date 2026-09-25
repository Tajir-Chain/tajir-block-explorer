import { Box, Text, chakra } from '@chakra-ui/react';
import React from 'react';

import type { FeaturedNetwork } from 'types/networks';

import IconSvg from 'ui/shared/IconSvg';

interface Props extends FeaturedNetwork {
  isActive?: boolean;
  isMobile?: boolean;
}

const NetworkMenuLink = ({ title, isActive: isActiveProp, isMobile, url }: Props) => {
  const isActive = (() => {
    if (isActiveProp !== undefined) {
      return isActiveProp;
    }

    try {
      const itemOrigin = new URL(url).origin;
      const currentOrigin = window.location.origin;

      return itemOrigin === currentOrigin;
    } catch (error) {
      return false;
    }
  })();

  return (
    <Box as="li" listStyleType="none">
      <chakra.a
        display="flex"
        href={ isActive ? undefined : url }
        aria-disabled={ isActive || undefined }
        px={ 2 }
        py="6px"
        alignItems="center"
        cursor={ isActive ? 'default' : 'pointer' }
        pointerEvents={ isActive ? 'none' : 'auto' }
        borderRadius="base"
        color={ isActive ? 'yellow.500' : 'text.primary' }
        fontWeight={ isActive ? 600 : 500 }
        bg={ isActive ? { base: 'blackAlpha.50', _dark: 'whiteAlpha.100' } : 'transparent' }
        _hover={ isActive ? undefined : { color: 'yellow.500' } }
      >
        <Text
          marginLeft={ 2 }
          color="inherit"
          fontSize="sm"
          lineHeight={ isMobile ? '20px' : '24px' }
        >
          { title }
        </Text>
        { isActive && (
          <IconSvg
            name="check"
            boxSize="20px"
            marginLeft="auto"
            color="yellow.500"
          />
        ) }
      </chakra.a>
    </Box>
  );
};

export default React.memo(NetworkMenuLink);
