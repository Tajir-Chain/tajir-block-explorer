import React from "react";

import config from "configs/app";
import useAddChainClick from "lib/web3/useAddChainClick";
import useProvider from "lib/web3/useProvider";
import { WALLETS_INFO } from "lib/web3/wallets";
import { Button } from "toolkit/chakra/button";
import IconSvg from "ui/shared/IconSvg";
import { Image } from "@chakra-ui/react";

interface Props {
  source: "Footer" | "Top bar";
  onAddSuccess?: () => void;
}

const NetworkAddToWallet = ({ source, onAddSuccess }: Props) => {
  const { data: { wallet } = {} } = useProvider();

  const handleClick = useAddChainClick({ source, onSuccess: onAddSuccess });

  if (!wallet) {
    return null;
  }

  const walletInfo = WALLETS_INFO[wallet];

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
        backgroundColor: "transparent",
      }}
    >
      {/* <IconSvg name={ walletInfo.icon } boxSize={ 3 }/> */}
      <Image
        src="https://res.cloudinary.com/dd98ifrkd/image/upload/v1767863617/609DD8F3-B622-4A2D-99E7-12316BC973C4-fotor-bg-remover-2025112012277_1_4_jls0lm.svg"
        alt="Wallet Icon"
        boxSize={4}
        mr={1}
      />
      Add {config.chain.name}
    </Button>
  );
};

export default React.memo(NetworkAddToWallet);
