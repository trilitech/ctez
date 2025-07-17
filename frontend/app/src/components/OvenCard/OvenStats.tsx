import {
  Center,
  Divider,
  Flex,
  Icon,
  Skeleton,
  SkeletonText,
  Stack,
  Text,
  Tooltip,
} from '@chakra-ui/react';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { MdInfo } from 'react-icons/md';
import { useOvenStats, useThemeColors } from '../../hooks/utilHooks';
import ProgressPill from './ProgressPill';
import { AllOvenDatum } from '../../interfaces';
import data from '../../assets/data/info.json';
import CopyAddress from '../CopyAddress';

const OvenStats: React.FC<{ oven: AllOvenDatum | undefined; isImported: boolean }> = ({ oven }) => {
  const { stats } = useOvenStats(oven);
  const { t } = useTranslation(['common']);
  const [background, textcolor, text3, cardbg, text4] = useThemeColors([
    'cardbg',
    'textColor',
    'text3',
    'tooltipbg1',
    'text4',
  ]);

  const showInfo = useMemo(() => {
    return (
      <div>
        <Flex mr={-2} ml={-2} p={2} borderRadius={14} backgroundColor={cardbg}>
          <Icon fontSize="2xl" color={text4} as={MdInfo} m={1} />
          <Text color="gray.500" fontSize="xs" ml={2}>
            {data.find((item) => item.topic === 'oven address')?.content}
          </Text>
        </Flex>
      </div>
    );
  }, [cardbg, text4]);
  const showInfoCollateralRatio = useMemo(() => {
    return (
      <div>
        <Flex mr={-2} ml={-2} p={2} borderRadius={14} backgroundColor={cardbg}>
          <Icon fontSize="2xl" color={text4} as={MdInfo} m={1} />
          <Text color="gray.500" fontSize="xs" ml={2}>
            {data.find((item) => item.topic === 'collateral ratio')?.content}
          </Text>
        </Flex>
      </div>
    );
  }, [cardbg, text4]);
  const showInfoCollateralUtilization = useMemo(() => {
    return (
      <div>
        <Flex mr={-2} ml={-2} p={2} borderRadius={14} backgroundColor={cardbg}>
          <Icon fontSize="2xl" color={text4} as={MdInfo} m={1} />
          <Text color="gray.500" fontSize="xs" ml={2}>
            {data.find((item) => item.topic === 'Collateral Utilization')?.content}
          </Text>
        </Flex>
      </div>
    );
  }, [cardbg, text4]);

  return (
    <Stack p={8} spacing={4} backgroundColor={background} borderRadius={16}>
      <div>
        <Text color={textcolor} fontWeight="600">
          {t('ovenStats')}
          <Tooltip label={showInfo} placement="right" borderRadius={14} backgroundColor={cardbg}>
            <span>
              <Icon opacity="0.3" fontSize="lg" color={text4} as={MdInfo} m={1} mb={1} />
            </span>
          </Tooltip>
        </Text>
        <Flex mt={2}>
          <Text fontSize="sm" mr={1} fontWeight="500">
            {t('ovenAddress')}:
          </Text>
          <Text color="light.text2" fontSize="xs">
            {oven?.value.address == null ? (
              <SkeletonText noOfLines={1} w="300px" />
            ) : (
              <Text color={text3} as="span" fontSize="sm">
                <CopyAddress address={oven?.value.address}>{oven?.value.address}</CopyAddress>
              </Text>
            )}
          </Text>
        </Flex>
      </div>

      <Divider />

      <Flex w="100%">
        <Stack w="30%" alignItems="center">
          {stats?.collateralRatio == null ? (
            <Skeleton>0000</Skeleton>
          ) : (
            <Text fontSize="lg" fontWeight="600">
              {stats?.collateralRatio ?? '0000'}%
            </Text>
          )}

          <Text color={text3} fontSize="xs">
            {t('collateralratio')}
            <Tooltip
              label={showInfoCollateralRatio}
              placement="right"
              borderRadius={14}
              backgroundColor={cardbg}
            >
              <span>
                <Icon opacity="0.3" fontSize="md" color={text4} as={MdInfo} m={1} mb={1} />
              </span>
            </Tooltip>
          </Text>
        </Stack>

        <Center height="48px" mx={6}>
          <Divider orientation="vertical" />
        </Center>

        <Stack w="70%" textAlign="right">
          <Skeleton isLoaded={stats?.collateralUtilization != null}>
            <ProgressPill
              value={stats?.collateralUtilization ?? 0}
              oven={null}
              type={null}
              warning={null}
            />
          </Skeleton>
          <Text color={text3} fontSize="xs">
            {t('collateralUtilization')}
            <Tooltip
              label={showInfoCollateralUtilization}
              placement="right"
              borderRadius={14}
              backgroundColor={cardbg}
            >
              <span>
                <Icon opacity="0.3" fontSize="md" color={text4} as={MdInfo} m={1} mb={1} />
              </span>
            </Tooltip>
          </Text>
        </Stack>
      </Flex>
    </Stack>
  );
};

export default OvenStats;
