import { Box, Text, chakra } from '@chakra-ui/react';
import React from 'react';

import type { FeaturedNetwork } from 'types/networks';

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
        color={ isActive ? { base: 'yellow.400', _dark: 'yellow.500' } : 'text.primary' }
        fontWeight={ isActive ? 600 : 500 }
        _hover={ isActive ? undefined : { color: { base: 'yellow.400', _dark: 'yellow.500' } } }
      >
        <Text
          marginLeft={ 2 }
          color="inherit"
          fontSize="sm"
          lineHeight={ isMobile ? '20px' : '24px' }
        >
          { title }
        </Text>
      </chakra.a>
    </Box>
  );
};

export default React.memo(NetworkMenuLink);
