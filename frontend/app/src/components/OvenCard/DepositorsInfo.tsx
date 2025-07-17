import { Divider, Flex, Icon, Stack, Tag, Text, Tooltip } from '@chakra-ui/react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MdEdit, MdInfo } from 'react-icons/md';
import { useOvenDelegate, useOvenStorage } from '../../api/queries';
import { useWallet } from '../../wallet/hooks';
import Button from '../button';
import Identicon from '../avatar';
import ChangeDepositor from '../modals/ChangeDepositor';
import { AllOvenDatum } from '../../interfaces';
import SkeletonLayout from '../skeleton';
import data from '../../assets/data/info.json';
import CopyAddress from '../CopyAddress';
import { useThemeColors } from '../../hooks/utilHooks';

const DepositorsInfo: React.FC<{ oven: AllOvenDatum | undefined; isImported: boolean }> = ({
  oven,
  isImported,
}) => {
  const [{ pkh: userAddress }] = useWallet();
  const { t } = useTranslation(['common']);
  const { data: ovenStorageData } = useOvenStorage(oven?.value.address);
  const { data: baker } = useOvenDelegate(oven?.value.address);
  const [edit, setEdit] = useState(false);
  const [background, textcolor, cardbg, text4] = useThemeColors([
    'cardbg',
    'textColor',
    'tooltipbg1',
    'text4',
  ]);

  const showInfo = useMemo(() => {
    return (
      <div>
        <Flex mr={-2} ml={-2} p={2} borderRadius={14} backgroundColor={cardbg}>
          <Icon fontSize="2xl" color={text4} as={MdInfo} m={1} />
          <Text color="gray.500" fontSize="xs" ml={2}>
            {data.find((item) => item.topic === 'Authorized Depositors')?.content}
          </Text>
        </Flex>
      </div>
    );
  }, [cardbg, text4]);
  const getWhiteList = (recvData: any) => {
    try {
      if (!recvData?.depositors?.whitelist)
        return [];
      const list = Array.prototype.slice.call(recvData.depositors.whitelist);
      return list;
    } catch (err) {
      console.log(err);
      return [];
    }
  };

  const { depositors, canAnyoneDeposit, isLoading } = useMemo(() => {
    if (!oven || !ovenStorageData || !userAddress) {
      return { depositors: [], canAnyoneDeposit: false, isLoading: true };
    }

    const canAnyoneDepositLocal =
      ovenStorageData &&
      !Array.isArray(ovenStorageData.depositors) &&
      Object.keys(ovenStorageData.depositors).includes('any');
    const whitelist = getWhiteList(ovenStorageData);
    return {
      canAnyoneDeposit: canAnyoneDepositLocal,
      depositors: canAnyoneDepositLocal
        ? []
        : [
            {
              value: oven.key.owner,
              label: oven.key.owner === userAddress ? 'You' : 'Owner',
            },
            ...(whitelist as string[])?.map((dep) => ({
              value: dep,
              label: dep === baker ? 'Baker' : null,
            })),
          ],
      isLoading: false,
    };
  }, [baker, oven, ovenStorageData, userAddress]);

  const content = useMemo(() => {
    if (isLoading) {
      return <SkeletonLayout component="AddressCard" count={3} />;
    }

    if (canAnyoneDeposit) {
      return <Text>{t('everyoneAllowed')}</Text>;
    }

    return depositors.map((dep) => (
      <Flex key={dep.value} w="100%" boxShadow="lg" px={3} py={1} borderRadius={6}>
        <Identicon seed={dep.value ?? undefined} type="tzKtCat" avatarSize="sm" />
        <Text as="span" my="auto" flexGrow={1} mx={2}>
          <CopyAddress address={dep.value}>{dep.value}</CopyAddress>
        </Text>
        {dep.label && (
          <Tag size="sm" borderRadius="full" variant="solid" h={4} my="auto">
            {dep.label}
          </Tag>
        )}
      </Flex>
    ));
  }, [canAnyoneDeposit, depositors, isLoading]);

  return (
    <>
      <Stack p={8} spacing={4} borderRadius={16} backgroundColor={background}>
        <Text color={textcolor} fontWeight="600">
          {t('allowedDepositors')}
          <Tooltip label={showInfo} placement="right" borderRadius={14} backgroundColor={cardbg}>
            <span>
              <Icon opacity="0.3" fontSize="lg" color={text4} as={MdInfo} m={1} mb={1} />
            </span>
          </Tooltip>
        </Text>

        <Divider />

        {content}

        {!isImported && (
          <Button w="100%" variant="outline" leftIcon={<MdEdit />} onClick={() => setEdit(true)}>
            {t('editDepositors')}
          </Button>
        )}
      </Stack>

      {oven && (
        <ChangeDepositor
          isOpen={edit}
          onClose={() => setEdit(false)}
          oven={oven}
          ovenStorage={ovenStorageData}
          canAnyoneDeposit={canAnyoneDeposit}
        />
      )}
    </>
  );
};

export default DepositorsInfo;
