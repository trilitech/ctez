import {
  Flex,
  FormControl,
  FormLabel,
  Icon,
  Input,
  InputGroup,
  InputRightElement,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Text,
  useToast,
} from '@chakra-ui/react';
import { MdInfo } from 'react-icons/md';
import { useTranslation } from 'react-i18next';
import * as Yup from 'yup';
import { useFormik } from 'formik';
import { useCallback, useMemo } from 'react';
import { isMonthFromLiquidation } from '../../api/contracts';
import { IMintRepayForm } from '../../constants/oven-operations';
import { mintOrBurn } from '../../contracts/ctez';
import { logger } from '../../utils/logger';
import Button from '../button';
import { BUTTON_TXT } from '../../constants/swap';
import { CTezIcon } from '../icons';
import { AllOvenDatum } from '../../interfaces';
import { useOvenStats, useThemeColors, useTxLoader } from '../../hooks/utilHooks';
import { formatNumberStandard, inputFormatNumberStandard } from '../../utils/numbers';
import { useActualCtezStorage } from '../../api/queries';

interface IMintProps {
  isOpen: boolean;
  onClose: () => void;
  oven: AllOvenDatum | null;
}

const Mint: React.FC<IMintProps> = ({ isOpen, onClose, oven }) => {
  const { t } = useTranslation(['common']);
  const { data: storage } = useActualCtezStorage();
  const toast = useToast();
  const [cardbg, text2, text1, inputbg, text4, maxColor] = useThemeColors([
    'tooltipbg',
    'text2',
    'text1',
    'inputbg',
    'text4',
    'maxColor',
  ]);
  const { stats, baseStats } = useOvenStats(oven);
  const handleProcessing = useTxLoader();

  const getRightElement = useCallback(() => {
    return (
      <InputRightElement backgroundColor="transparent" w={24} color={text2}>
        <CTezIcon height={28} width={28} />
        <Text fontWeight="500" mx={2}>
          ctez
        </Text>
      </InputRightElement>
    );
  }, [text2]);

  const maxValue = (): number => stats?.remainingMintableCtez ?? 0;

  const validationSchema = Yup.object().shape({
    amount: Yup.number()
      .typeError('Amount must be a number')
      .min(0.000001)
      .max(maxValue(), `${t('insufficientBalance')}`)
      .test({
        test: (value) => {
          if (
            value !== undefined &&
            baseStats?.drift !== undefined &&
            baseStats?.currentTarget !== undefined
          ) {
            const newOutstanding = (stats?.outStandingCtez ?? 0) + value;
            const tez = stats?.ovenBalance ?? 0;

            const result = !!storage && isMonthFromLiquidation(
              newOutstanding,
              baseStats?.currentTarget,
              tez,
              baseStats?.drift,
              stats?.feeIndex ?? 2 ** 64,
              storage
            );
            return !result;
          }
          return false;
        },
        message: t('excessiveMintingError'),
      })
      .required(t('required')),
  });
  const initialValues: IMintRepayForm = {
    amount: '',
  };

  const handleFormSubmit = async (data: IMintRepayForm) => {
    if (oven?.key.id) {
      try {
        const amount = data?.amount;
        const result = await mintOrBurn(Number(oven.key.id), Number(amount));
        handleProcessing(result);
        onClose();
      } catch (error : any) {
        logger.warn(error);
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
  const { buttonText, errorList } = useMemo(() => {
    const errorListLocal = Object.values(errors);
    if (values.amount) {
      if (errorListLocal.length > 0) {
        return { buttonText: errorListLocal[0], errorList: errorListLocal };
      }

      return { buttonText: BUTTON_TXT.MINT, errorList: errorListLocal };
    }

    return { buttonText: BUTTON_TXT.ENTER_AMT, errorList: errorListLocal };
  }, [errors, values.amount]);

  return (
    <Modal isOpen={isOpen} onClose={onClose} isCentered>
      <ModalOverlay />
      <form onSubmit={handleSubmit}>
        <ModalContent>
          <ModalHeader color={text1} fontWeight="500">
            {t('mintctez')}
          </ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <Flex mr={-2} ml={-2} p={2} borderRadius={14} backgroundColor={cardbg}>
              <Icon fontSize="2xl" color={text4} as={MdInfo} m={1} />
              <Text fontSize="xs" ml={2}>
                If the collateral ratio in a vault is observed at or below the emergency collateral
                ratio, the vault becomes available for liquidation. This applies until the
                collateralratio is re-established at or above the target collateral ratio.
              </Text>
            </Flex>
            <FormControl id="to-input-amount" mt={2} mb={6} w="100%">
              <FormLabel fontWeight="500" color={text2} fontSize="xs">
                {t('amount')}
              </FormLabel>
              <InputGroup>
                <Input
                  type="text"
                  name="amount"
                  id="amount"
                  color={text2}
                  bg={inputbg}
                  lang="en-US"
                  placeholder="0.0"
                  value={inputFormatNumberStandard(values.amount)}
                  onChange={handleChange}
                />
                {getRightElement()}
              </InputGroup>
              <Text color={text4} fontSize="xs" mt={1}>
                Balance: {formatNumberStandard(stats?.remainingMintableCtez ?? 0)}{' '}
                <Text
                  as="span"
                  cursor="pointer"
                  color={maxColor}
                  onClick={() =>
                    formik.setFieldValue(
                      'amount',
                      formatNumberStandard(stats?.remainingMintableCtez),
                    )
                  }
                >
                  (Max)
                </Text>
              </Text>
            </FormControl>
          </ModalBody>
          <ModalFooter>
            <Button
              w="100%"
              variant="outline"
              type="submit"
              disabled={isSubmitting || errorList.length > 0}
            >
              {buttonText}
            </Button>
          </ModalFooter>
        </ModalContent>
      </form>
    </Modal>
  );
};

export default Mint;
