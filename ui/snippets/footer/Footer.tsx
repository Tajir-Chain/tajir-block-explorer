import type { GridProps, HTMLChakraProps } from "@chakra-ui/react";
import { Box, Grid, Flex, Text, VStack } from "@chakra-ui/react";
import { useQuery } from "@tanstack/react-query";
import React from "react";

import type { CustomLinksGroup } from "types/footerLinks";

import config from "configs/app";
import type { ResourceError } from "lib/api/resources";
import useApiQuery from "lib/api/useApiQuery";
import useFetch from "lib/hooks/useFetch";
import useIssueUrl from "lib/hooks/useIssueUrl";
import { Link } from "toolkit/chakra/link";
import { Skeleton } from "toolkit/chakra/skeleton";
import { copy } from "toolkit/utils/htmlEntities";
import IconSvg from "ui/shared/IconSvg";
import { CONTENT_MAX_WIDTH } from "ui/shared/layout/utils";
import NetworkAddToWallet from "ui/shared/NetworkAddToWallet";
import AdditionalInfoButton from "ui/shared/AdditionalInfoButton";
import { PopoverBody, PopoverContent, PopoverRoot, PopoverTrigger } from "toolkit/chakra/popover";
import { DialogBody, DialogContent, DialogHeader, DialogRoot, DialogTrigger } from "toolkit/chakra/dialog";
import useIsMobile from "lib/hooks/useIsMobile";

import FooterLinkItem from "./FooterLinkItem";
import IntTxsIndexingStatus from "./IntTxsIndexingStatus";
import getApiVersionUrl from "./utils/getApiVersionUrl";

const MAX_LINKS_COLUMNS = 4;

const FRONT_VERSION_URL = `https://github.com/blockscout/frontend/tree/${config.UI.footer.frontendVersion}`;
const FRONT_COMMIT_URL = `https://github.com/blockscout/frontend/commit/${config.UI.footer.frontendCommit}`;

const Footer = () => {
  const { data: backendVersionData } = useApiQuery(
    "general:config_backend_version",
    {
      queryOptions: {
        staleTime: Infinity,
        enabled: !config.features.opSuperchain.isEnabled,
      },
    },
  );
  const apiVersionUrl = getApiVersionUrl(backendVersionData?.backend_version);
  const issueUrl = useIssueUrl(backendVersionData?.backend_version);

  const BLOCKSCOUT_LINKS = [
    {
      icon: "edit" as const,
      iconSize: "16px",
      text: "Submit an issue",
      url: "https://github.com/",
    },
    {
      icon: "social/git" as const,
      iconSize: "18px",
      text: "Contribute",
      url: "https://github.com/",
    },
    {
      icon: "social/twitter" as const,
      iconSize: "18px",
      text: "X (ex-Twitter)",
      url: "https://x.com/",
    },
    {
      icon: "social/discord" as const,
      iconSize: "24px",
      text: "Discord",
      url: "https://discord.com/",
    },
    {
      icon: "brands/blockscout" as const,
      iconSize: "18px",
      text: "All chains",
      url: "/",
    },
    {
      icon: "donate" as const,
      iconSize: "20px",
      text: "Donate",
      url: "/",
    },
  ];

  const frontendLink = (() => {
    if (config.UI.footer.frontendVersion) {
      return (
        <Link href={FRONT_VERSION_URL} external noIcon>
          {config.UI.footer.frontendVersion}
        </Link>
      );
    }

    if (config.UI.footer.frontendCommit) {
      return (
        <Link href={FRONT_COMMIT_URL} external noIcon>
          {config.UI.footer.frontendCommit}
        </Link>
      );
    }

    return null;
  })();

  const fetch = useFetch();
  const isMobile = useIsMobile();

  const { isPlaceholderData, data: linksData } = useQuery<
    unknown,
    ResourceError<unknown>,
    Array<CustomLinksGroup>
  >({
    queryKey: ["footer-links"],
    queryFn: async () =>
      fetch(config.UI.footer.links || "", undefined, {
        resource: "footer-links",
      }),
    enabled: Boolean(config.UI.footer.links),
    staleTime: Infinity,
    placeholderData: [],
  });

  const colNum = isPlaceholderData
    ? 1
    : Math.min(linksData?.length || Infinity, MAX_LINKS_COLUMNS) + 1;

  const renderNetworkInfo = React.useCallback(
    (gridArea?: GridProps["gridArea"]) => {
      return (
        <Flex
          alignItems="center"
          gridArea={gridArea}
          flexWrap="wrap"
          justifyContent="flex-start"
          columnGap={3}
          rowGap={2}
          mb={{ base: 5, lg: 10 }}
          _empty={{ display: "none" }}
        >
          {!config.UI.indexingAlert.intTxs.isHidden && <IntTxsIndexingStatus />}
          {!config.features.opSuperchain.isEnabled && (
            <NetworkAddToWallet source="Footer" />
          )}
        </Flex>
      );
    },
    [],
  );

  const renderProjectInfo = React.useCallback(
    (gridArea?: GridProps["gridArea"]) => {
      const logoColor = { base: "blue.600", _dark: "white" };

      return (
        <Box gridArea={gridArea}>
          <Flex columnGap={2} textStyle="xs" alignItems="center">
            <span>Made with</span>
            <Link
              href=""
              external
              noIcon
              display="inline-flex"
              color={logoColor}
              _hover={{ color: logoColor }}
            >
              <img
                src="https://res.cloudinary.com/dd98ifrkd/image/upload/v1767854952/logo-placeholder_o6xmnt.svg"
                alt=""
                width="80px"
              />
            </Link>
          </Flex>
          <Text mt={3} fontSize="xs">
            Tajir is a tool for inspecting and analyzing EVM based blockchains.
            Blockchain explorer for Tajir Networks.
          </Text>
          <Box mt={6} alignItems="start" textStyle="xs">
            {apiVersionUrl && (
              <Text>
                Backend:{" "}
                <Text
                  as="span"
                  color={{ base: "green.600", _dark: "green.300" }}
                  fontWeight="500"
                >
                  v9.3.2
                </Text>
              </Text>
            )}

            {frontendLink && (
              <Text>
                Frontend:{" "}
                <Text
                  as="span"
                  color={{ base: "green.600", _dark: "green.300" }}
                  fontWeight="500"
                >
                  v2.5.3
                </Text>
              </Text>
            )}
            <Flex alignItems="center" columnGap={1} mt={2}>
              <Text>
                Copyright {copy} Tajir Chain {new Date().getFullYear()}
              </Text>

              {isMobile ? (
                <DialogRoot size="full">
                  <DialogTrigger asChild>
                    <AdditionalInfoButton aria-label="About explorer" />
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>About</DialogHeader>
                    <DialogBody p={2}>
                      <Text>
                        Explorer software based on Blockscout (GPL-3.0). Source available
                      </Text>
                    </DialogBody>
                  </DialogContent>
                </DialogRoot>
              ) : (
                <PopoverRoot positioning={{ placement: "top" }}>
                  <PopoverTrigger>
                    <AdditionalInfoButton aria-label="About explorer" />
                  </PopoverTrigger>
                  <PopoverContent w="300px" borderWidth="1px" borderColor="border.divider" borderRadius="base">
                    <PopoverBody>
                      <Text fontSize="xs">
                        Explorer software based on Blockscout (GPL-3.0). Source available
                      </Text>
                    </PopoverBody>
                  </PopoverContent>
                </PopoverRoot>
              )}
            </Flex>
          </Box>
        </Box>
      );
    },
    [apiVersionUrl, backendVersionData?.backend_version, frontendLink],
  );

  const containerProps: HTMLChakraProps<"div"> = {
    as: "footer",
    borderTopWidth: "1px",
    borderTopColor: "border.divider",
    bg: { base: "whiteAlpha.900", _dark: "blackAlpha.900" },
  };

  const contentProps: GridProps = {
    px: {
      base: 4,
      lg: config.UI.navigation.layout === "horizontal" ? 6 : 12,
      "2xl": 6,
    },
    py: { base: 4, lg: 8 },
    gridTemplateColumns: { base: "1fr", lg: "minmax(auto, 470px) 1fr" },
    columnGap: { lg: "32px", xl: "100px" },
    maxW: `${CONTENT_MAX_WIDTH}px`,
    m: "0 auto",
  };

  const renderRecaptcha = (gridArea?: GridProps["gridArea"]) => {
    if (!config.services.reCaptchaV2.siteKey) {
      return <Box gridArea={gridArea} />;
    }

    return (
      <Box gridArea={gridArea} textStyle="xs" mt={6}>
        <span>This site is protected by reCAPTCHA and the Google </span>
        <Link href="https://policies.google.com/privacy" external noIcon>
          Privacy Policy
        </Link>
        <span> and </span>
        <Link href="https://policies.google.com/terms" external noIcon>
          Terms of Service
        </Link>
        <span> apply.</span>
      </Box>
    );
  };

  if (config.UI.footer.links) {
    return (
      <Box {...containerProps}>
        <Grid {...contentProps}>
          <div>
            {renderNetworkInfo()}
            {renderProjectInfo()}
            {renderRecaptcha()}
          </div>

          <Grid
            gap={{
              base: 6,
              lg: colNum === MAX_LINKS_COLUMNS + 1 ? 2 : 8,
              xl: 12,
            }}
            gridTemplateColumns={{
              base: "repeat(auto-fill, 160px)",
              lg: `repeat(${colNum}, 135px)`,
              xl: `repeat(${colNum}, 160px)`,
            }}
            justifyContent={{ lg: "flex-end" }}
            mt={{ base: 8, lg: 0 }}
          >
            {[{ title: "Tajir", links: BLOCKSCOUT_LINKS }, ...(linksData || [])]
              .slice(0, colNum)
              .map((linkGroup) => (
                <Box key={linkGroup.title}>
                  <Skeleton
                    fontWeight={500}
                    mb={3}
                    display="inline-block"
                    loading={isPlaceholderData}
                  >
                    {linkGroup.title}
                  </Skeleton>
                  <VStack gap={1} alignItems="start">
                    {linkGroup.links.map((link) => (
                      <FooterLinkItem
                        {...link}
                        key={link.text}
                        isLoading={isPlaceholderData}
                      />
                    ))}
                  </VStack>
                </Box>
              ))}
          </Grid>
        </Grid>
      </Box>
    );
  }

  return (
    <Box {...containerProps}>
      <Grid
        {...contentProps}
        gridTemplateAreas={{
          lg: `
          "network links-top"
          "info links-bottom"
          "recaptcha links-bottom"
        `,
        }}
      >
        {renderNetworkInfo({ lg: "network" })}
        {renderProjectInfo({ lg: "info" })}
        {renderRecaptcha({ lg: "recaptcha" })}

        <Grid
          gridArea={{ lg: "links-bottom" }}
          gap={1}
          gridTemplateColumns={{
            base: "repeat(auto-fill, 160px)",
            lg: "repeat(2, 160px)",
            xl: "repeat(3, 160px)",
          }}
          gridTemplateRows={{
            base: "auto",
            lg: "repeat(3, auto)",
            xl: "repeat(2, auto)",
          }}
          gridAutoFlow={{ base: "row", lg: "column" }}
          alignContent="start"
          justifyContent={{ lg: "flex-end" }}
          mt={{ base: 8, lg: 0 }}
        >
          {BLOCKSCOUT_LINKS.map((link) => (
            <FooterLinkItem {...link} key={link.text} />
          ))}
        </Grid>
      </Grid>
    </Box>
  );
};

export default React.memo(Footer);
