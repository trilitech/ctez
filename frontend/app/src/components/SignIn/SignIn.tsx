import {
  Button as ChakraButton,
  Flex,
  Icon,
  Popover,
  PopoverBody,
  PopoverCloseButton,
  PopoverContent,
  PopoverFooter,
  PopoverHeader,
  PopoverTrigger,
  Table,
  TableCaption,
  Tbody,
  Td,
  Text,
  Tr,
  useDisclosure,
} from '@chakra-ui/react';
import { useCallback } from 'react';
import Button from '../button';
import { trimAddress } from '../../utils/addressUtils';
import { useWallet } from '../../wallet/hooks';
import { getBeaconInstance } from '../../wallet';
import { APP_NAME, NETWORK } from '../../utils/globals';
import { setWalletProvider } from '../../contracts/client';
import { useUserBalance, useUserLqtData } from '../../api/queries';
import Identicon from '../avatar';
import { formatNumber as formatNumberUtil, formatNumberStandard } from '../../utils/numbers';
import { ReactComponent as copy } from '../../assets/images/sidebar/content_copy.svg';

const SignIn: React.FC = () => {
  const [{ pkh: userAddress, network }, setWallet, disconnectWallet] = useWallet();
  const { isOpen, onOpen, onClose } = useDisclosure();
  const { data: balance } = useUserBalance(userAddress);
  const { data: userLqtData } = useUserLqtData(userAddress);

  const formatNumber = useCallback((number?: number, shiftedBy = -6) => {
    if (typeof number !== 'number') {
      return null;
    }

    return formatNumberUtil(number, shiftedBy);
  }, []);

  const connectWallet = async () => {
    const newWallet = await getBeaconInstance(APP_NAME, true, NETWORK);
    newWallet?.wallet && setWalletProvider(newWallet.wallet);
    newWallet && setWallet(newWallet);
  };

  const onDisconnectWallet = () => {
    disconnectWallet();
  };

  if (!userAddress) {
    return (
      <Button
        border="1px solid rgba(0, 0, 0, 0.07)"
        backgroundColor="transparent"
        onClick={connectWallet}
      >
        Connect wallet
      </Button>
    );
  }

  return (
    <>
      <Popover
        placement="bottom"
        computePositionOnMount
        isOpen={isOpen}
        onClose={onClose}
        offset={[0, -40]}
      >
        <PopoverTrigger>
          <ChakraButton w={0} minW={0} p={0} />
        </PopoverTrigger>
        <PopoverContent mx={4}>
          <PopoverCloseButton />
          <PopoverHeader>
            <Flex alignItems="center">
              <Identicon type="tzKtCat" seed={userAddress} avatarSize="sm" />
              <Text onClick={() => navigator.clipboard.writeText(userAddress)} ml={2}>
                {trimAddress(userAddress, 'medium')}
              </Text>
              <Icon
                onClick={() => navigator.clipboard.writeText(userAddress)}
                ml={2}
                w={3}
                h={3}
                color="light.tradebg"
                _hover={{ cursor: 'pointer' }}
                as={copy}
              />
            </Flex>
          </PopoverHeader>
          <PopoverBody>
            <Table variant="unstyled" size="sm">
              <Tbody>
                {typeof balance !== 'undefined' && (
                  <>
                    <Tr>
                      <Td>tez:</Td>
                      <Td textAlign="right">
                        {formatNumberStandard(formatNumber(balance.xtz, 0))}
                      </Td>
                    </Tr>
                    <Tr>
                      <Td>ctez:</Td>
                      <Td textAlign="right">
                        {formatNumberStandard(formatNumber(balance.ctez, 0))}
                      </Td>
                    </Tr>
                  </>
                )}
                {typeof balance !== 'undefined' && (
                  <>
                    <Tr>
                      <Td>tez in ovens:</Td>
                      <Td textAlign="right">
                        {formatNumberStandard(formatNumber(balance.tezInOvens, 0))}
                      </Td>
                    </Tr>
                    <Tr>
                      <Td>ctez outstanding:</Td>
                      <Td textAlign="right">
                        {formatNumberStandard(formatNumber(balance.ctezOutstanding, 0))}
                      </Td>
                    </Tr>
                  </>
                )}
                {/* {typeof userLqtData?.tezDexLqt !== 'undefined' && (
                  <Tr>
                    <Td>Tez LQT:</Td>
                    <Td textAlign="right">
                      {userLqtData.tezDexLqt.dividedBy(1e6).toString(10)}
                    </Td>
                  </Tr>
                )} */}
                {typeof userLqtData?.tezDexLqtShare !== 'undefined' && (
                  <Tr>
                    <Td>Tez LQT Pool share:</Td>
                    <Td textAlign="right">{userLqtData?.tezDexLqtShare.toFixed(2)}%</Td>
                  </Tr>
                )}
                {/* {typeof userLqtData?.ctezDexLqt !== 'undefined' && (
                  <Tr>
                    <Td>Ctez LQT:</Td>
                    <Td textAlign="right">
                      {userLqtData?.ctezDexLqt.dividedBy(1e6).toString(10)}
                    </Td>
                  </Tr>
                )} */}
                {typeof userLqtData?.ctezDexLqtShare !== 'undefined' && (
                  <Tr>
                    <Td>Ctez LQT Pool share:</Td>
                    <Td textAlign="right">{userLqtData?.ctezDexLqtShare.toFixed(2)}%</Td>
                  </Tr>
                )}
              </Tbody>

              <TableCaption mt={0}>{network}</TableCaption>
            </Table>
          </PopoverBody>

          <PopoverFooter>
            <Button mx="auto" variant="outline" onClick={onDisconnectWallet}>
              Sign Out
            </Button>
          </PopoverFooter>
        </PopoverContent>
      </Popover>

      <Button border="1px solid rgba(0, 0, 0, 0.07)" backgroundColor="transparent" onClick={onOpen}>
        {trimAddress(userAddress)}
      </Button>
    </>
  );
};

export { SignIn };
