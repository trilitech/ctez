import { Flex, FormControl, FormLabel, Input, Stack, useToast, Radio, RadioGroup } from '@chakra-ui/react';
import { useTranslation } from 'react-i18next';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useFormik } from 'formik';
import { CollectFromLiquidityParams } from '../../../interfaces';
import { collectFromLiquidity } from '../../../contracts/cfmm';
import { COLLECT_BTN_TXT } from '../../../constants/liquidity';
import { useWallet } from '../../../wallet/hooks';
import { useActualCtezStorage, useCtezStorage, useUserLqtData } from '../../../api/queries';
import Button from '../../button';
import { useThemeColors, useTxLoader } from '../../../hooks/utilHooks';
import {
  formatNumberStandard,
  inputFormatNumberStandard,
} from '../../../utils/numbers';
import { calcRedeemedAmount } from './utlils';

const CollectFromLiquidity: React.FC = () => {
  const [{ pkh: userAddress }] = useWallet();
  const [side, setSide] = React.useState('ctez')
  const [otherValues, setOtherValues] = useState({
    proceedsReceived: 0,
    subsidyReceived: 0,
  });
  const toast = useToast();
  const { data: ctezStorage } = useCtezStorage();
  const { data: actualCtezStorage } = useActualCtezStorage();
  const { t } = useTranslation(['common']);
  const [text2, inputbg, text4, maxColor] = useThemeColors([
    'text2',
    'inputbg',
    'text4',
    'maxColor',
  ]);
  const handleProcessing = useTxLoader();
  const { data: userLqtData } = useUserLqtData(userAddress);

  const isCtezSide = side === 'ctez';
  const lqtBalance = isCtezSide ? userLqtData?.ctezDexLqt : userLqtData?.tezDexLqt;

  const calcMinValues = useCallback(
    async () => {
      if (!lqtBalance) {
        setOtherValues({
          proceedsReceived: 0,
          subsidyReceived: 0,
        });
      } else if (ctezStorage && actualCtezStorage && userAddress) {
        const dex = isCtezSide ? actualCtezStorage.sell_ctez : actualCtezStorage.sell_tez;
        const account = await (isCtezSide ? ctezStorage.sell_ctez : ctezStorage.sell_tez).liquidity_owners.get(userAddress);
        const totalLiquidityShares = dex.total_liquidity_shares.toNumber();
        const proceedsReceived = calcRedeemedAmount(lqtBalance, dex.proceeds_reserves.toNumber(), totalLiquidityShares, account?.proceeds_owed.toNumber() || 0);
        const subsidyReceived = calcRedeemedAmount(lqtBalance, dex.subsidy_reserves.toNumber(), totalLiquidityShares, account?.subsidy_owed.toNumber() || 0);

        setOtherValues({
          proceedsReceived: formatNumberStandard(proceedsReceived / 1e6),
          subsidyReceived: formatNumberStandard(subsidyReceived / 1e6),
        });
      }
    },
    [ctezStorage, actualCtezStorage, side],
  );

  const handleFormSubmit = async () => {
    if (userAddress) {
      try {
        const data: CollectFromLiquidityParams = {
          to: userAddress,
          isCtezSide,
        };
        const result = await collectFromLiquidity(data);
        handleProcessing(result);
      } catch (error: any) {
        const errorText = error.data[1].with.string as string || t('txFailed');
        toast({
          description: errorText,
          status: 'error',
        });
      }
    }
  };

  const { handleSubmit, isSubmitting, errors } = useFormik({
    initialValues: {},
    onSubmit: handleFormSubmit,
  });

  const onHandleSideChanged = useCallback((sideValue: string) => {
    setSide(sideValue);
  }, []);

  useEffect(() => {
    calcMinValues();
  }, [calcMinValues, lqtBalance, side]);

  const { buttonText, errorList } = useMemo(() => {
    if (!userAddress) {
      return { buttonText: COLLECT_BTN_TXT.CONNECT, errorList: [COLLECT_BTN_TXT.CONNECT] };
    }
    if (lqtBalance) {
      if (!otherValues.proceedsReceived && !otherValues.subsidyReceived) {
        return { buttonText: COLLECT_BTN_TXT.NO_WITHDRAWS, errorList: [COLLECT_BTN_TXT.NO_WITHDRAWS] };
      }
      return { buttonText: COLLECT_BTN_TXT.REDEEM, errorList: [] };
    }

    return { buttonText: COLLECT_BTN_TXT.NO_SHARE, errorList: [COLLECT_BTN_TXT.NO_SHARE] };
  }, [errors, userAddress, lqtBalance, otherValues.proceedsReceived, otherValues.subsidyReceived]);

  return (
    <form onSubmit={handleSubmit} id="remove-liquidity-form">
      <Stack colorScheme="gray" spacing={2}>
        <RadioGroup onChange={onHandleSideChanged} value={side} color={text2}>
          <Stack direction='row' mb={4} spacing={8}>
            <Radio value='ctez'>Ctez</Radio>
            <Radio value='tez'>Tez</Radio>
          </Stack>
        </RadioGroup>
        <FormControl id="to-input-amount" mb={2}>
          <FormLabel color={text2} fontSize="xs">
            LQT Balance
          </FormLabel>
          <Input
            name="lqtBalance"
            id="lqtBalance"
            value={inputFormatNumberStandard((lqtBalance || 0) / 1e6)}
            color={text2}
            bg={inputbg}
            readOnly
            placeholder="0.0"
            type="text"
            lang="en-US"
          />
        </FormControl>

        <Flex alignItems="center" direction="column" justifyContent="space-between">
          <FormControl id="to-input-amount">
            <FormLabel color={text2} fontSize="xs">
              Proceeds ({isCtezSide ? 'tez' : 'ctez'}) to withdraw
            </FormLabel>
            <Input
              readOnly
              mb={2}
              // border={0}
              placeholder="0.0"
              type="text"
              color={text2}
              lang="en-US"
              value={otherValues.proceedsReceived}
            />
          </FormControl>

          <FormControl id="to-input-amount">
            <FormLabel color={text2} fontSize="xs">
              Subsidy (ctez) to withdraw
            </FormLabel>
            <Input
              readOnly
              mb={2}
              // border={0}
              placeholder="0.0"
              type="text"
              color={text2}
              lang="en-US"
              value={otherValues.subsidyReceived}
            />
          </FormControl>
        </Flex>
        <Button
          walletGuard
          variant="outline"
          type="submit"
          isLoading={isSubmitting}
          disabled={isSubmitting || errorList.length > 0}
        >
          {buttonText}
        </Button>
      </Stack>
    </form>
  );
};

export default CollectFromLiquidity;
