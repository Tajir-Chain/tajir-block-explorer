import type { Feature } from './types';
import type { GasRefuelProviderConfig } from 'types/client/gasRefuelProviderConfig';

import chain from '../chain';
import { getEnvValue, parseEnvJson } from '../utils';
import marketplace from './marketplace';

const value = parseEnvJson<GasRefuelProviderConfig | GasRefuelProviderConfig[]>(getEnvValue('NEXT_PUBLIC_GAS_REFUEL_PROVIDER_CONFIG'));

const title = 'Get gas button';

const config: Feature<{
  items: Array<{
    name: string;
    logoUrl?: string;
    url: string;
    dappId?: string;
  }>;
}> = (() => {
  if (value) {
    const itemsArray = Array.isArray(value) ? value : [ value ];
    
    return Object.freeze({
      title,
      isEnabled: true,
      items: itemsArray.map((item) => ({
        name: item.name,
        logoUrl: item.logo,
        url: item.url_template.replace('{chainId}', chain.id || ''),
        dappId: marketplace.isEnabled ? item.dapp_id : undefined,
      })),
    });
  }

  return Object.freeze({
    title,
    isEnabled: false,
    items: [],
  });
})();

export default config;
