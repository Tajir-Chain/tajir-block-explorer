import { Box } from '@chakra-ui/react';
import React from 'react';

import config from 'configs/app';
import { Alert } from 'toolkit/chakra/alert';

// Type definitions
interface MaintenanceAlertConfig {
  message?: string;
}

interface UIConfig {
  maintenanceAlert: MaintenanceAlertConfig;
}

interface AppConfig {
  UI: UIConfig;
}

// Cast config with proper type
const typedConfig = config as AppConfig;

const MaintenanceAlert = () => {
  const message = typedConfig.UI.maintenanceAlert.message;

  if (!message) return null;

  return (
    <Alert status="info" showIcon>
      <Box
        dangerouslySetInnerHTML={{ __html: message }}
        css={{
          '& a': {
            color: 'link.primary',
            _hover: {
              color: 'link.primary.hover',
            },
          },
        }}
      />
    </Alert>
  );
};

export default MaintenanceAlert;
