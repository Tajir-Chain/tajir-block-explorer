import { Image } from "@chakra-ui/react";
import React, { useEffect, useState } from "react";

import config from "configs/app";
import { useMultichainContext } from "lib/contexts/multichain";
import useAddChainClick from "lib/web3/useAddChainClick";
import useProvider from "lib/web3/useProvider";
import { Button } from "toolkit/chakra/button";

interface Props {
  source: "Footer" | "Top bar";
}

const NetworkAddToWallet = ({ source }: Props) => {
  const { data: { wallet, provider } = {} } = useProvider();
  const multichainContext = useMultichainContext();
  const chainConfig = multichainContext?.chain.app_config ?? config;
  const [currentChainId, setCurrentChainId] = useState<string | null>(null);

  useEffect(() => {
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
  }, [provider]);

  const handleClick = useAddChainClick({ source });

  const isChainAlreadyAdded =
    currentChainId &&
    chainConfig.chain.id &&
    Number(currentChainId) === Number(chainConfig.chain.id);

  if (!wallet || isChainAlreadyAdded) {
    return null;
  }

  return (
    <Button
      variant="outline"
      size="sm"
      borderWidth="1px"
      fontWeight="500"
      color="yellow.400"
      borderColor="yellow.400"
      onClick={handleClick}
      _light={{
        backgroundColor: "yellow.50",
      }}
      _dark={{
        backgroundColor: "#f3cd521A",
      }}
    >
      <Image
        src="https://res.cloudinary.com/dd98ifrkd/image/upload/v1767863617/609DD8F3-B622-4A2D-99E7-12316BC973C4-fotor-bg-remover-2025112012277_1_4_jls0lm.svg"
        alt="Wallet Icon"
        boxSize={4}
        mr={1}
      />
      Add {chainConfig.chain.name}
    </Button>
  );
};

export default React.memo(NetworkAddToWallet);


