import { Flex, FormControl, FormLabel, Input, Stack, useToast, InputGroup, Slider, SliderTrack, SliderFilledTrack, SliderThumb } from '@chakra-ui/react';
import { addMinutes } from 'date-fns/fp';
import { useTranslation } from 'react-i18next';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { number, object, string } from 'yup';
import { useFormik } from 'formik';
import BigNumber from 'bignumber.js';
import { RemoveLiquidityParams } from '../../../interfaces';
import { removeLiquidity } from '../../../contracts/ctez';
import { IRemoveLiquidityForm, REMOVE_BTN_TXT } from '../../../constants/liquidity';
import { useWallet } from '../../../wallet/hooks';
import { useActualCtezStorage, useUserLqtData } from '../../../api/queries';
import Button from '../../button';
import { useAppSelector } from '../../../redux/store';
import { useThemeColors, useTxLoader } from '../../../hooks/utilHooks';
import { BUTTON_TXT, TOKEN } from '../../../constants/swap';
import { calcRedeemedAmount } from './utlils';
import DexSideSelector, { DexSide } from './DexSideSelector';
import TokenInputIcon from '../TokenInputIcon';

const RemoveLiquidity: React.FC = () => {
  const [{ pkh: userAddress }] = useWallet();
  const [side, setSide] = React.useState<DexSide>('ctez')
  const [otherValues, setOtherValues] = useState({
    minSelfReceived: '0',
    minProceedsReceived: '0',
    minSubsidyReceived: '0',
  });
  const toast = useToast();
  const { data: ctezStorage } = useActualCtezStorage();
  const { t } = useTranslation(['common']);
  const [text2, inputbg, text4, maxColor] = useThemeColors([
    'text2',
    'inputbg',
    'text4',
    'maxColor',
  ]);
  const { slippage, deadline: deadlineFromStore } = useAppSelector((state) => state.trade);
  const handleProcessing = useTxLoader();
  const { data: userLqtData } = useUserLqtData(userAddress);

  const isCtezSide = side === 'ctez';
  const lqtBalance = ((isCtezSide ? userLqtData?.ctezDexLqt : userLqtData?.tezDexLqt) ?? new BigNumber(0)).dividedBy(1e6);

  const calcMinValues = useCallback(
    async (lqtBurned: BigNumber) => {
      if (!lqtBurned) {
        setOtherValues({
          minSelfReceived: '0',
          minProceedsReceived: '0',
          minSubsidyReceived: '0',
        });
      } else if (ctezStorage && userAddress) {
        const dex = isCtezSide ? ctezStorage.sell_ctez : ctezStorage.sell_tez;
        const account = await dex.liquidity_owners.get(userAddress);
        const slippageFactor = (1 - slippage * 0.01);
        const lqtBurnedNat = BigNumber.min(lqtBurned, lqtBalance).multipliedBy(1e6);
        const minSelfReceived = calcRedeemedAmount(lqtBurnedNat, dex.self_reserves, dex.total_liquidity_shares, new BigNumber(0)).multipliedBy(slippageFactor);
        const minProceedsReceived = calcRedeemedAmount(lqtBurnedNat, dex.proceeds_reserves, dex.total_liquidity_shares, account?.proceeds_owed || new BigNumber(0)).multipliedBy(slippageFactor);
        const minSubsidyReceived = calcRedeemedAmount(lqtBurnedNat, dex.subsidy_reserves, dex.total_liquidity_shares, account?.subsidy_owed || new BigNumber(0)).multipliedBy(slippageFactor);

        setOtherValues({
          minSelfReceived: minSelfReceived.dividedBy(1e6).toFixed(6, BigNumber.ROUND_CEIL),
          minProceedsReceived: minProceedsReceived.dividedBy(1e6).toFixed(6, BigNumber.ROUND_CEIL),
          minSubsidyReceived: minSubsidyReceived.dividedBy(1e6).toFixed(6, BigNumber.ROUND_CEIL),
        });
      }
    },
    [ctezStorage, slippage, side, lqtBalance.toString(10), userAddress],
  );

  const initialValues: IRemoveLiquidityForm = {
    lqtBurned: lqtBalance.toString(10),
    lqtBurnedPercent: 100,
    deadline: Number(deadlineFromStore),
    slippage: Number(slippage),
  };

  const validationSchema = object().shape({
    lqtBurned: string()
      .required(t('required'))
      .test({
        test: (value) => {
          return !!value && !(new BigNumber(value).isNaN());
        },
        message: 'Amount must be a number',
      })
      .test({
        test: (value) => {
          return !!value && new BigNumber(value).isLessThanOrEqualTo(lqtBalance);
        },
        message: t('insufficientBalance'),
      })
      .test({
        test: (value) => {
          return !!value && new BigNumber(value).isPositive();
        },
        message: t('shouldPositive'),
      }),
    lqtBurnedPercent: number()
      .min(0, 'should be positive')
      .max(100, 'should be less than 100'),
    deadline: number().min(0).optional(),
    slippage: number().min(0).optional(),
  });

  const handleFormSubmit = async (formData: IRemoveLiquidityForm) => {
    if (userAddress) {
      try {
        const deadline = addMinutes(deadlineFromStore)(new Date());
        const data: RemoveLiquidityParams = {
          deadline,
          to: userAddress,
          lqtBurned: new BigNumber(formData.lqtBurned).multipliedBy(1e6),
          minSelfReceived: new BigNumber(otherValues.minSelfReceived).multipliedBy(1e6),
          minProceedsReceived: new BigNumber(otherValues.minProceedsReceived).multipliedBy(1e6),
          minSubsidyReceived: new BigNumber(otherValues.minSubsidyReceived).multipliedBy(1e6),
          isCtezSide,
        };
        const result = await removeLiquidity(data, userAddress);
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

  const { values, handleChange, handleSubmit, isSubmitting, errors, ...formik } = useFormik({
    initialValues,
    validationSchema,
    onSubmit: handleFormSubmit,
  });

  const onHandleSideChanged = useCallback((sideValue: DexSide) => {
    setSide(sideValue);
  }, []);

  useEffect(() => {
    formik.setFieldValue('lqtBurned', lqtBalance.toString(10));
  }, [lqtBalance.toString(10)]);

  const debounceTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  const debouncedCalcMinValues = useCallback((lqtBurned: BigNumber) => {
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }
    debounceTimeoutRef.current = setTimeout(() => {
      calcMinValues(lqtBurned);
    }, 500);
  }, [calcMinValues]);

  useEffect(() => {
    debouncedCalcMinValues(new BigNumber(values.lqtBurned));
    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, [debouncedCalcMinValues, values.lqtBurned]);

  useEffect(() => {
    calcMinValues(new BigNumber(values.lqtBurned));
  }, [values.slippage, side]);

  useEffect(() => {
    const newLqtBurned = lqtBalance.multipliedBy(values.lqtBurnedPercent / 100).toFixed(6);
    formik.setFieldValue('lqtBurned', newLqtBurned);
  }, [values.lqtBurnedPercent, lqtBalance.toString(10)]);

  // useEffect(() => {
  //   const lqtBurnedValue = new BigNumber(values.lqtBurned);
  //   if (!lqtBurnedValue.isNaN() && lqtBalance.gt(0)) {
  //     const newPercent = lqtBurnedValue.dividedBy(lqtBalance).multipliedBy(100).toNumber();
  //     formik.setFieldValue('lqtBurnedPercent', Math.max(0, Math.min(100, newPercent)));
  //   }
  // }, [values.lqtBurned, lqtBalance.toString(10)]);

  const { buttonText, errorList } = useMemo(() => {
    const errorListLocal = Object.values(errors);
    if (!userAddress) {
      return { buttonText: BUTTON_TXT.CONNECT, errorList: errorListLocal };
    }
    
    if (lqtBalance.isZero()) {
      return { buttonText: BUTTON_TXT.NO_SHARE, errorList: [BUTTON_TXT.NO_SHARE] };
    }

    if (values.lqtBurned) {
      if (errorListLocal.length > 0) {
        return { buttonText: errorListLocal[0], errorList: errorListLocal };
      }

      return { buttonText: REMOVE_BTN_TXT.REMOVE_LIQ, errorList: errorListLocal };
    }

    return { buttonText: BUTTON_TXT.ENTER_AMT, errorList: errorListLocal };
  }, [errors, userAddress, values.lqtBurned, lqtBalance.toString(10)]);

  return (
    <form onSubmit={handleSubmit} id="remove-liquidity-form">
      <Stack colorScheme="gray" spacing={2}>
        <DexSideSelector onChange={onHandleSideChanged} value={side} />
        <FormControl id="to-input-amount" mb={2}>
          <FormLabel color={text2} fontSize="xs">
            LQT % to burn
          </FormLabel>
          {/* <Input
            name="lqtBurned"
            id="lqtBurned"
            value={values.lqtBurned}
            color={text2}
            bg={inputbg}
            onChange={handleChange}
            placeholder="0.0"
            type="text"
            lang="en-US"
          />
          {typeof lqtBalance !== 'undefined' && (
            <Text color={text4} fontSize="xs" mt={1} mb={2} display="flex" flexWrap="nowrap" gridGap={1}>
              <Text as="span" flexShrink={1} isTruncated>
                Balance: {lqtBalance.toString(10)}
              </Text>
              <Text
                as="span"
                cursor="pointer"
                color={maxColor}
                onClick={() => {
                  formik.setFieldValue('lqtBurnedPercent', 100);
                  formik.setFieldValue('lqtBurned', lqtBalance.toString(10));
                }}
              >
                (Max)
              </Text>
            </Text>
          )} */}
          <Input
            type="number"
            name="lqtBurnedPercent"
            id="lqtBurnedPercent"
            min={0}
            max={100}
            step={1}
            value={values.lqtBurnedPercent}
            onChange={e => {
              let val = Number(e.target.value);
              if (Number.isNaN(val)) val = 0;
              val = Math.max(0, Math.min(100, Math.floor(val)));
              formik.setFieldValue('lqtBurnedPercent', val);
            }}
            color={text2}
            bg={inputbg}
            mt={2}
            fontSize="sm"
          />
          <Slider
            value={values.lqtBurnedPercent}
            min={0}
            max={100}
            step={1}
            focusThumbOnChange={false}
            onChange={val => formik.setFieldValue('lqtBurnedPercent', val)}
            mt={2}
            mb={2}
          >
            <SliderTrack>
              <SliderFilledTrack />
            </SliderTrack>
            <SliderThumb sx={{ transform: 'translate(-50%, -50%)' }} _active={{ transform: 'translate(-50%, -50%) scale(1.2)' }} />
          </Slider>
        </FormControl>


        <Flex alignItems="center" direction="column" justifyContent="space-between">
          <FormControl id="to-input-amount">
            <FormLabel color={text2} fontSize="xs">
              Min. self tokens to withdraw
            </FormLabel>
            <InputGroup>
              <Input
                readOnly
                mb={2}
                placeholder="0.0"
                type="text"
                color={text2}
                lang="en-US"
                value={otherValues.minSelfReceived}
              />
              <TokenInputIcon token={isCtezSide ? TOKEN.CTez : TOKEN.Tez} />
            </InputGroup>
          </FormControl>

          <FormControl id="to-input-amount">
            <FormLabel color={text2} fontSize="xs">
              Min. proceeds to withdraw
            </FormLabel>
            <InputGroup>
              <Input
                readOnly
                mb={2}
                placeholder="0.0"
                type="text"
                color={text2}
                lang="en-US"
                value={otherValues.minProceedsReceived}
              />
              <TokenInputIcon token={isCtezSide ? TOKEN.Tez : TOKEN.CTez} />
            </InputGroup>
          </FormControl>

          <FormControl id="to-input-amount">
            <FormLabel color={text2} fontSize="xs">
              Min. subsidy to withdraw
            </FormLabel>
            <InputGroup>
              <Input
                readOnly
                mb={2}
                placeholder="0.0"
                type="text"
                color={text2}
                lang="en-US"
                value={otherValues.minSubsidyReceived}
              />
              <TokenInputIcon token={TOKEN.CTez} />
            </InputGroup>
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

export default RemoveLiquidity;
