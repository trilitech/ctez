import { Flex, Box, useColorMode, Text, useMediaQuery } from '@chakra-ui/react';
import React, { useEffect, useState } from 'react';
import { useLocation, matchPath } from 'react-router-dom';
import { FiMoon, FiSun } from 'react-icons/fi';
import { GiHamburgerMenu } from 'react-icons/gi';
import { ReactComponent as AllOvens } from '../../assets/images/sidebar/allovens.svg';
import { ReactComponent as MyOvens } from '../../assets/images/sidebar/myovens.svg';
import { ReactComponent as Trade } from '../../assets/images/sidebar/trade.svg';
import { ReactComponent as AnalyticsIcon } from '../../assets/images/sidebar/analytics-icon.svg';
import { ReactComponent as Faq } from '../../assets/images/sidebar/faq.svg';
import { ReactComponent as Arrow } from '../../assets/images/icons/rightArrow.svg';
import { ReactComponent as ArrowDark } from '../../assets/images/icons/rightArrowDark.svg';
import { ReactComponent as Close } from '../../assets/images/icons/close.svg';
import Button from '../button';
import SignIn from '../SignIn';
import { useThemeColors } from '../../hooks/utilHooks';

export interface IHeaderProps {
  handleToggled: ((value: boolean) => void) | undefined;
  toggled: boolean;
}

interface HeaderIconText {
  text: string | null;
  icon: JSX.Element | null;
}

const Header: React.FC<IHeaderProps> = ({ handleToggled, toggled }) => {
  const [mobileScreen] = useMediaQuery(['(max-width: 600px)']);
  const { colorMode, toggleColorMode } = useColorMode();
  const [headerBackground, bannerbg, bannertext, trynow] = useThemeColors([
    'headerBg',
    'bannerBg',
    'bannerText',
    'tryNow',
  ]);
  const location = useLocation();
  const [headerIconText, setHeaderIconText] = useState<HeaderIconText>({ text: null, icon: null });

  const setHeader = (pathName: string) => {
    if (
      matchPath(pathName, {
        path: '/myovens/:address',
      }) != null
    ) {
      // const ovenAddress = pathName.substr(pathName.lastIndexOf('/') + 1, pathName.length);
      setHeaderIconText({ text: `My Oven Details`, icon: null });
    } else if (
      matchPath(pathName, {
        path: '/myovens',
        exact: true,
      })
    ) {
      setHeaderIconText({ text: `My Ovens`, icon: <MyOvens /> });
    } else if (
      matchPath(pathName, {
        path: '/myV1Ovens',
        exact: true,
      })
    ) {
      setHeaderIconText({ text: `My V1 Ovens`, icon: <MyOvens /> });
    } else if (
      matchPath(pathName, {
        path: '/ovens',
        exact: true,
      })
    ) {
      setHeaderIconText({ text: `All Ovens`, icon: <AllOvens /> });
    } else if (
      matchPath(pathName, {
        path: '/trade',
        exact: true,
      })
    ) {
      setHeaderIconText({ text: `Trade`, icon: <Trade /> });
    } else if (
      matchPath(pathName, {
        path: '/analytics',
        exact: true,
      })
    ) {
      setHeaderIconText({ text: `Analytics`, icon: <AnalyticsIcon /> });
    } else if (
      matchPath(pathName, {
        path: '/faq',
        exact: true,
      })
    ) {
      setHeaderIconText({ text: `FAQ`, icon: <Faq /> });
    } else {
      setHeaderIconText({ text: null, icon: null });
    }
  };

  const isFrontpage = () => {
    return location.pathname === '/';
  };

  useEffect(() => {
    const pathName = location.pathname;
    setHeader(pathName);
  }, [location]);
  const [isBannerOpen, setBannerOpen] = useState(false);
  const closeBanner = () => {
    setBannerOpen(false);
  };

  return (
    <Box width="100%">
      {isBannerOpen && (
        <Box width="100%" alignItems="center" className="banner" backgroundColor={bannerbg}>
          <Box className="bannermiddle">
            <span className="banner-text" color={bannertext}>
              {mobileScreen
                ? 'Plenty V3 is live!'
                : 'Plenty V3 is live!'}{' '}
              <a
                style={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                href="https://app.plenty.network/pools/v3"
                target="_blank"
                rel="noreferrer"
              >
                <span className="trynow" color={trynow}>
                  Try now
                </span>{' '}
{/* {!mobileScreen && (
                  <span className="newBadge" color="#ffffff">
                    New
                  </span>
                )}
                {colorMode === 'light' ? <Arrow /> : <ArrowDark />} */}
              </a>
            </span>
          </Box>
          <Box className="bannerright" style={{ cursor: 'pointer' }}>
            <span className="closeIconBanner">
              <Close onClick={() => closeBanner()} width={30} height={30} />
            </span>
          </Box>
        </Box>
      )}
      <Flex
        padding="16px"
        alignItems="center"
        background={!isFrontpage() ? headerBackground : undefined}
      >
        <Button
          border="1px solid rgba(0, 0, 0, 0.07)"
          backgroundColor="transparent"
          className="md-menu"
          onClick={() => handleToggled && handleToggled(!toggled)}
        >
          <GiHamburgerMenu />
        </Button>
        <Flex alignItems="center" marginStart={{ base: '5px', md: '30px' }} marginEnd="5px">
          <Box display={{ base: 'none', md: 'block' }} marginEnd={{ md: '5px' }}>
            {headerIconText.icon}
          </Box>
          <Box whiteSpace="nowrap">
            <Text fontWeight={600}>{headerIconText.text}</Text>
          </Box>
        </Flex>
        <Box marginStart="auto" marginEnd="10px" cursor="pointer" onClick={toggleColorMode}>
          {colorMode === 'light' ? <FiSun size={26} /> : <FiMoon size={26} />}
        </Box>
        <SignIn />
      </Flex>
    </Box>
  );
};

export { Header };
